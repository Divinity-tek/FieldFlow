// AI Dispatch Agent edge function
// Actions: assign | reassign-scan | schedule | chat | approve | reject
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { aiChatCompletion } from "../_shared/ai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function haversineKm(a: number, b: number, c: number, d: number) {
  const R = 6371;
  const dLat = ((c - a) * Math.PI) / 180;
  const dLon = ((d - b) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a * Math.PI) / 180) * Math.cos((c * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

interface Settings {
  enabled: boolean;
  autonomy: "suggest" | "auto" | "full";
  weight_skill: number;
  weight_distance: number;
  weight_rating: number;
  weight_experience: number;
  sla_risk_threshold_minutes: number;
  max_auto_assign_radius_km: number;
  require_approval_priorities: string[];
  reassign_scan_enabled: boolean;
  scheduling_enabled: boolean;
}

function scoreEngineer(job: any, eng: any, s: Settings) {
  const reasons: string[] = [];
  let score = 0;

  const svcType = (job.service_type || "").toLowerCase();
  const skills = (eng.skills || []).map((k: string) => (k || "").toLowerCase());
  const skillMatch =
    (eng.specialty || "").toLowerCase().includes(svcType) ||
    skills.some((k: string) => k.includes(svcType))
      ? 1
      : 0.4;
  if (skillMatch === 1) reasons.push(`Skill match: ${eng.specialty}`);
  score += skillMatch * s.weight_skill;

  let distance: number | null = null;
  if (job.latitude && job.longitude && eng.latitude && eng.longitude) {
    distance = haversineKm(job.latitude, job.longitude, eng.latitude, eng.longitude);
    const distScore = Math.max(0, s.weight_distance - (distance / 5));
    score += distScore;
    reasons.push(`${distance.toFixed(1)} km away`);
  } else {
    score += s.weight_distance / 3;
  }

  const r = Number(eng.rating) || 0;
  score += (r / 5) * s.weight_rating;
  if (r >= 4.5) reasons.push(`Top-rated (${r.toFixed(1)}★)`);

  const jc = eng.jobs_completed || 0;
  score += Math.min(s.weight_experience, jc / 10);
  if (jc > 50) reasons.push(`${jc} jobs done`);

  return { score: Math.round(score), reasons, distance };
}

async function getSettings(sb: any): Promise<Settings> {
  const { data } = await sb.from("dispatch_agent_settings").select("*").limit(1).maybeSingle();
  return data;
}

async function logAction(sb: any, row: any): Promise<{ inserted: boolean; duplicate: boolean }> {
  // If idempotency_key supplied, upsert with ON CONFLICT DO NOTHING semantics
  if (row.idempotency_key) {
    const { data, error } = await sb
      .from("dispatch_agent_actions")
      .upsert(row, { onConflict: "idempotency_key", ignoreDuplicates: true })
      .select("id");
    if (error) {
      // Fallback: probe existing row
      const { data: existing } = await sb
        .from("dispatch_agent_actions")
        .select("id")
        .eq("idempotency_key", row.idempotency_key)
        .maybeSingle();
      return { inserted: false, duplicate: !!existing };
    }
    const inserted = Array.isArray(data) && data.length > 0;
    return { inserted, duplicate: !inserted };
  }
  await sb.from("dispatch_agent_actions").insert(row);
  return { inserted: true, duplicate: false };
}

// SHA-1 hex digest for compact, deterministic idempotency keys
async function idkey(parts: (string | number | null | undefined)[]): Promise<string> {
  const raw = parts.map((p) => (p == null ? "" : String(p))).join("|");
  const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Insert a pending approval with idempotency. Returns existing pending row if duplicate.
async function upsertApproval(
  sb: any,
  row: {
    job_id: string;
    recommended_engineer_id: string;
    reason: string;
    score: number;
    idempotency_key: string;
    payload?: Record<string, unknown>;
  },
): Promise<{ approval: any; duplicate: boolean }> {
  const { data: existing } = await sb
    .from("dispatch_agent_approvals")
    .select("*")
    .eq("idempotency_key", row.idempotency_key)
    .maybeSingle();
  if (existing) return { approval: existing, duplicate: true };
  const { data, error } = await sb
    .from("dispatch_agent_approvals")
    .insert(row)
    .select()
    .single();
  if (error) {
    // Race: another concurrent insert won — fetch it
    const { data: again } = await sb
      .from("dispatch_agent_approvals")
      .select("*")
      .eq("idempotency_key", row.idempotency_key)
      .maybeSingle();
    return { approval: again, duplicate: true };
  }
  return { approval: data, duplicate: false };
}

async function rankForJob(sb: any, jobId: string, settings: Settings) {
  const { data: job } = await sb
    .from("jobs")
    .select("id, title, service_type, priority, location, latitude, longitude, status, engineer_id, scheduled_at")
    .eq("id", jobId)
    .maybeSingle();
  if (!job) return { job: null, ranked: [] };

  const { data: engineers } = await sb
    .from("engineers")
    .select("id, user_id, specialty, rating, latitude, longitude, is_available, skills, jobs_completed")
    .eq("is_available", true);

  const ranked = (engineers || [])
    .map((e: any) => ({ engineer: e, ...scoreEngineer(job, e, settings) }))
    .filter((x: any) => x.distance == null || x.distance <= settings.max_auto_assign_radius_km)
    .sort((a: any, b: any) => b.score - a.score);

  return { job, ranked };
}

async function handleAssign(sb: any, userId: string, body: any, settings: Settings) {
  const { jobId, override } = body;
  const { job, ranked } = await rankForJob(sb, jobId, settings);
  if (!job) return json({ error: "Job not found" }, 404);
  if (!ranked.length) return json({ error: "No eligible engineers" }, 400);

  const top = ranked[0];
  const needsApproval =
    !override &&
    settings.require_approval_priorities.includes((job.priority || "").toLowerCase());

  if (needsApproval || settings.autonomy === "suggest") {
    const { data: appr } = await sb
      .from("dispatch_agent_approvals")
      .insert({
        job_id: jobId,
        recommended_engineer_id: top.engineer.id,
        reason: top.reasons.join(" • "),
        score: top.score,
        payload: { top3: ranked.slice(0, 3).map((r: any) => ({ id: r.engineer.id, score: r.score, reasons: r.reasons })) },
      })
      .select()
      .single();
    await logAction(sb, {
      action_type: "assign_suggested",
      job_id: jobId,
      engineer_id: top.engineer.id,
      status: "pending_approval",
      autonomy: settings.autonomy,
      score: top.score,
      reasoning: top.reasons.join(" • "),
      triggered_by: userId,
      payload: { approval_id: appr?.id },
    });
    return json({ status: "pending_approval", approval: appr, recommendation: top });
  }

  const { error } = await sb
    .from("jobs")
    .update({ engineer_id: top.engineer.id, status: "assigned" })
    .eq("id", jobId);
  if (error) return json({ error: error.message }, 500);

  await logAction(sb, {
    action_type: "assign",
    job_id: jobId,
    engineer_id: top.engineer.id,
    status: "completed",
    autonomy: settings.autonomy,
    score: top.score,
    reasoning: top.reasons.join(" • "),
    triggered_by: userId,
  });
  return json({ status: "assigned", engineerId: top.engineer.id, score: top.score, reasons: top.reasons });
}

async function handleReassignScan(sb: any, userId: string, settings: Settings) {
  if (!settings.reassign_scan_enabled) return json({ skipped: "scan_disabled" });
  const cutoff = new Date(Date.now() + settings.sla_risk_threshold_minutes * 60_000).toISOString();
  const { data: atRisk } = await sb
    .from("jobs")
    .select("id, title, status, engineer_id, priority, scheduled_at")
    .lte("scheduled_at", cutoff)
    .in("status", ["assigned", "in_progress"]);

  const results: any[] = [];
  for (const job of atRisk || []) {
    const { ranked } = await rankForJob(sb, job.id, settings);
    const better = ranked.find((r: any) => r.engineer.id !== job.engineer_id);
    if (!better) continue;

    if (settings.autonomy === "full") {
      await sb.from("jobs").update({ engineer_id: better.engineer.id }).eq("id", job.id);
      await logAction(sb, {
        action_type: "reassign",
        job_id: job.id,
        engineer_id: better.engineer.id,
        status: "completed",
        autonomy: "full",
        score: better.score,
        reasoning: `SLA risk — auto-reassigned. ${better.reasons.join(" • ")}`,
        triggered_by: userId,
      });
      results.push({ jobId: job.id, action: "reassigned", to: better.engineer.id });
    } else {
      const { data: appr } = await sb
        .from("dispatch_agent_approvals")
        .insert({
          job_id: job.id,
          recommended_engineer_id: better.engineer.id,
          reason: `SLA risk — ${better.reasons.join(" • ")}`,
          score: better.score,
        })
        .select()
        .single();
      results.push({ jobId: job.id, action: "queued_approval", approvalId: appr?.id });
    }
  }
  return json({ scanned: atRisk?.length || 0, results });
}

async function handleSchedule(sb: any, userId: string, body: any, settings: Settings) {
  if (!settings.scheduling_enabled) return json({ skipped: "scheduling_disabled" });
  const { engineerId } = body;
  const { data: jobs } = await sb
    .from("jobs")
    .select("id, title, scheduled_at, latitude, longitude, priority, status")
    .eq("engineer_id", engineerId)
    .in("status", ["assigned", "in_progress"])
    .order("scheduled_at", { ascending: true });

  // simple nearest-neighbor route order
  const route = (jobs || []).slice().sort((a: any, b: any) => {
    const pa = a.priority === "urgent" ? 0 : 1;
    const pb = b.priority === "urgent" ? 0 : 1;
    if (pa !== pb) return pa - pb;
    return new Date(a.scheduled_at || 0).getTime() - new Date(b.scheduled_at || 0).getTime();
  });
  await logAction(sb, {
    action_type: "schedule",
    engineer_id: engineerId,
    status: "completed",
    autonomy: settings.autonomy,
    reasoning: `Optimized route for ${route.length} jobs`,
    triggered_by: userId,
    payload: { jobs: route.map((j: any) => j.id) },
  });
  return json({ engineerId, route });
}

async function handleApproval(sb: any, userId: string, body: any, decision: "approve" | "reject") {
  const { approvalId } = body;
  const { data: appr } = await sb
    .from("dispatch_agent_approvals")
    .select("*")
    .eq("id", approvalId)
    .maybeSingle();
  if (!appr) return json({ error: "Approval not found" }, 404);

  if (decision === "approve") {
    await sb
      .from("jobs")
      .update({ engineer_id: appr.recommended_engineer_id, status: "assigned" })
      .eq("id", appr.job_id);
  }
  await sb
    .from("dispatch_agent_approvals")
    .update({ status: decision === "approve" ? "approved" : "rejected", resolved_by: userId, resolved_at: new Date().toISOString() })
    .eq("id", approvalId);
  await logAction(sb, {
    action_type: decision === "approve" ? "approval_approved" : "approval_rejected",
    job_id: appr.job_id,
    engineer_id: appr.recommended_engineer_id,
    status: "completed",
    triggered_by: userId,
    reasoning: appr.reason,
  });
  return json({ status: decision });
}

async function handleChat(sb: any, userId: string, body: any, settings: Settings) {
  const { message } = body;

  await sb.from("dispatch_agent_messages").insert({ user_id: userId, role: "user", content: message });

  const { data: pending } = await sb
    .from("jobs")
    .select("id, title, priority, service_type, status, location")
    .eq("status", "pending")
    .limit(20);
  const { data: avail } = await sb
    .from("engineers")
    .select("id, specialty, rating, is_available, jobs_completed")
    .eq("is_available", true)
    .limit(20);

  const sys = `You are the AI Dispatch Agent for a field-service platform. You help admins triage jobs, recommend assignments, and explain decisions. Current settings: autonomy=${settings.autonomy}, enabled=${settings.enabled}. Be concise and action-oriented. Reference job IDs when suggesting actions.`;
  const ctx = `Pending jobs (${pending?.length || 0}): ${JSON.stringify(pending || [])}\nAvailable engineers (${avail?.length || 0}): ${JSON.stringify(avail || [])}`;

  const { data: prior } = await sb
    .from("dispatch_agent_messages")
    .select("role, content")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(20);

  const resp = await aiChatCompletion({
    messages: [
      { role: "system", content: sys },
      { role: "system", content: ctx },
      ...(prior || []).map((m: any) => ({ role: m.role, content: m.content })),
    ],
  });
  if (resp.status === 429) return json({ error: "Rate limit exceeded" }, 429);
  if (resp.status === 402) return json({ error: "AI credits exhausted" }, 402);
  if (!resp.ok) return json({ error: "AI gateway error" }, 500);

  const out = await resp.json();
  const reply = out.choices?.[0]?.message?.content || "";
  await sb.from("dispatch_agent_messages").insert({ user_id: userId, role: "assistant", content: reply });
  return json({ reply });
}

// ---------- Lifecycle notification fan-out ----------
type NotifyKind = "sla_risk" | "job_reassigned" | "job_cancelled" | "escalation" | "job_status";

async function resolveJobRecipients(
  sb: any,
  jobId: string,
  newEngineerId?: string | null,
  oldEngineerId?: string | null,
): Promise<{ clientUserId: string | null; engineerUserIds: string[]; leadUserIds: string[]; createdBy: string | null }> {
  const { data: job } = await sb
    .from("jobs")
    .select("client_id, created_by")
    .eq("id", jobId)
    .maybeSingle();

  let clientUserId: string | null = null;
  if (job?.client_id) {
    const { data: client } = await sb
      .from("clients")
      .select("user_id")
      .eq("id", job.client_id)
      .maybeSingle();
    clientUserId = client?.user_id ?? null;
  }

  const engIds = [newEngineerId, oldEngineerId].filter(Boolean) as string[];
  let engineerUserIds: string[] = [];
  if (engIds.length) {
    const { data: engs } = await sb
      .from("engineers")
      .select("user_id")
      .in("id", engIds);
    engineerUserIds = (engs || []).map((e: any) => e.user_id).filter(Boolean);
  }

  const { data: leads } = await sb
    .from("user_roles")
    .select("user_id")
    .in("role", ["team_lead", "admin"]);
  const leadUserIds = Array.from(new Set((leads || []).map((r: any) => r.user_id))).filter(Boolean);

  return { clientUserId, engineerUserIds, leadUserIds, createdBy: job?.created_by ?? null };
}

async function fanoutLifecycleNotification(
  sb: any,
  opts: {
    jobId: string;
    kind: NotifyKind;
    title: string;
    message: string;
    idempotencyBase: string;
    newEngineerId?: string | null;
    oldEngineerId?: string | null;
    extra?: Record<string, unknown>;
  },
) {
  try {
    const recipients = await resolveJobRecipients(sb, opts.jobId, opts.newEngineerId, opts.oldEngineerId);
    const targets: { user_id: string; role: "client" | "engineer" | "team_lead" }[] = [];
    if (recipients.clientUserId) targets.push({ user_id: recipients.clientUserId, role: "client" });
    for (const uid of recipients.engineerUserIds) targets.push({ user_id: uid, role: "engineer" });
    for (const uid of recipients.leadUserIds) targets.push({ user_id: uid, role: "team_lead" });

    // Dedupe by user
    const seen = new Set<string>();
    const rows = targets
      .filter((t) => {
        if (seen.has(t.user_id)) return false;
        seen.add(t.user_id);
        return true;
      })
      .map((t) => ({
        user_id: t.user_id,
        type: opts.kind,
        title: opts.title,
        message: opts.message,
        metadata: {
          job_id: opts.jobId,
          role: t.role,
          source: "dispatch_agent",
          idempotency_key: `notif:${opts.idempotencyBase}:${t.user_id}`,
          ...opts.extra,
        },
      }));

    if (!rows.length) return;
    // The notifications table doesn't have a unique idempotency column, but the
    // dispatch_agent_actions short-circuit already guarantees we don't reach
    // this code path twice for the same trigger. Web Push fans out via the
    // fire_push_for_notification trigger -> send-push edge function.
    await sb.from("notifications").insert(rows);
  } catch (e) {
    console.error("notification fanout failed", e);
  }
}

async function handleLifecycle(sb: any, body: any, settings: Settings) {
  if (!jobId || !event) return json({ error: "event + jobId required" }, 400);

  // Base idempotency key for this trigger fingerprint. Caller can override.
  // Falls back to a deterministic hash of the meaningful diff so repeated
  // identical webhook/realtime deliveries collapse to one record.
  const baseKey =
    clientKey ||
    (await idkey([
      "lifecycle",
      event,
      jobId,
      oldRow?.status,
      newRow?.status,
      oldRow?.engineer_id,
      newRow?.engineer_id,
      oldRow?.scheduled_at,
      newRow?.scheduled_at,
      newRow?.updated_at, // distinguishes legitimate re-emissions of the same diff
    ]));

  // Always log the trigger (deduped)
  const triggerLog = await logAction(sb, {
    idempotency_key: `trigger:${baseKey}`,
    action_type: `lifecycle_${event}`,
    job_id: jobId,
    status: "received",
    autonomy: settings.autonomy,
    reasoning: `Job lifecycle event: ${event}` +
      (oldRow?.status && newRow?.status && oldRow.status !== newRow.status
        ? ` (${oldRow.status} → ${newRow.status})`
        : ""),
    triggered_by: "00000000-0000-0000-0000-000000000000",
    payload: { event, old_status: oldRow?.status, new_status: newRow?.status, idempotency_key: baseKey },
  });

  if (triggerLog.duplicate) {
    // Already processed this exact trigger — short-circuit.
    return json({ status: "duplicate", event, idempotencyKey: baseKey });
  }

  // React to events
  try {
    if (event === "created" && newRow?.status === "pending" && !newRow?.engineer_id) {
      const { ranked, job } = await rankForJob(sb, jobId, settings);
      if (!job || !ranked.length) {
        await logAction(sb, {
          idempotency_key: `skip:${baseKey}`,
          action_type: "auto_assign_skipped",
          job_id: jobId,
          status: "skipped",
          autonomy: settings.autonomy,
          reasoning: !ranked.length ? "No eligible engineers" : "Job missing",
        });
        return json({ status: "skipped" });
      }
      const top = ranked[0];
      const needsApproval =
        settings.autonomy === "suggest" ||
        settings.require_approval_priorities.includes((job.priority || "").toLowerCase());

      if (needsApproval) {
        const apprKey = await idkey(["approval", "auto_assign", jobId, top.engineer.id]);
        const { approval, duplicate } = await upsertApproval(sb, {
          job_id: jobId,
          recommended_engineer_id: top.engineer.id,
          reason: `New job triggered — ${top.reasons.join(" • ")}`,
          score: top.score,
          idempotency_key: apprKey,
        });
        await logAction(sb, {
          idempotency_key: `action:${baseKey}:auto_assign_queued`,
          action_type: "auto_assign_queued",
          job_id: jobId,
          engineer_id: top.engineer.id,
          status: "pending_approval",
          autonomy: settings.autonomy,
          score: top.score,
          reasoning: top.reasons.join(" • "),
          payload: { approval_id: approval?.id, trigger: "lifecycle_created", duplicate_approval: duplicate },
        });
      } else {
        // Don't re-assign if the engineer is already the recommended one
        if (newRow?.engineer_id !== top.engineer.id) {
          await sb
            .from("jobs")
            .update({ engineer_id: top.engineer.id, status: "assigned" })
            .eq("id", jobId);
        }
        await logAction(sb, {
          idempotency_key: `action:${baseKey}:auto_assign`,
          action_type: "auto_assign",
          job_id: jobId,
          engineer_id: top.engineer.id,
          status: "completed",
          autonomy: settings.autonomy,
          score: top.score,
          reasoning: `Triggered by job creation — ${top.reasons.join(" • ")}`,
        });
      }
    } else if (event === "sla_risk" && settings.reassign_scan_enabled) {
      const { ranked } = await rankForJob(sb, jobId, settings);
      const better = ranked.find((r: any) => r.engineer.id !== newRow?.engineer_id);
      if (better) {
        if (settings.autonomy === "full") {
          // Idempotency guard: skip if the job already has this engineer assigned
          const { data: jobNow } = await sb
            .from("jobs")
            .select("engineer_id")
            .eq("id", jobId)
            .maybeSingle();
          if (jobNow?.engineer_id !== better.engineer.id) {
            await sb.from("jobs").update({ engineer_id: better.engineer.id }).eq("id", jobId);
          }
          await logAction(sb, {
            idempotency_key: `action:${baseKey}:auto_reassign:${better.engineer.id}`,
            action_type: "auto_reassign",
            job_id: jobId,
            engineer_id: better.engineer.id,
            status: "completed",
            autonomy: "full",
            score: better.score,
            reasoning: `SLA risk — ${better.reasons.join(" • ")}`,
          });
        } else {
          const apprKey = await idkey(["approval", "sla_reassign", jobId, better.engineer.id]);
          const { approval, duplicate } = await upsertApproval(sb, {
            job_id: jobId,
            recommended_engineer_id: better.engineer.id,
            reason: `SLA risk — ${better.reasons.join(" • ")}`,
            score: better.score,
            idempotency_key: apprKey,
          });
          await logAction(sb, {
            idempotency_key: `action:${baseKey}:auto_reassign_queued`,
            action_type: "auto_reassign_queued",
            job_id: jobId,
            engineer_id: better.engineer.id,
            status: "pending_approval",
            autonomy: settings.autonomy,
            score: better.score,
            reasoning: `SLA risk auto-detected`,
            payload: { approval_id: approval?.id, duplicate_approval: duplicate },
          });
        }
      }
    } else if (event === "status_changed" && newRow?.status === "completed" && newRow?.engineer_id && settings.scheduling_enabled) {
      await logAction(sb, {
        idempotency_key: `action:${baseKey}:route_reoptimized`,
        action_type: "route_reoptimized",
        job_id: jobId,
        engineer_id: newRow.engineer_id,
        status: "completed",
        autonomy: settings.autonomy,
        reasoning: "Job completed — recalculating remaining route",
      });
    }

    // ---------- Notify recipients (client, engineer(s), team leads) ----------
    const jobLabel = newRow?.title ? `"${newRow.title}"` : `Job ${String(jobId).slice(0, 8)}`;
    if (event === "sla_risk") {
      await fanoutLifecycleNotification(sb, {
        jobId,
        kind: "sla_risk",
        title: "SLA at risk",
        message: `${jobLabel} is at risk of breaching its SLA.`,
        idempotencyBase: baseKey,
        newEngineerId: newRow?.engineer_id,
        extra: { event },
      });
    } else if (event === "reassigned") {
      await fanoutLifecycleNotification(sb, {
        jobId,
        kind: "job_reassigned",
        title: "Job reassigned",
        message: `${jobLabel} has been reassigned to a new engineer.`,
        idempotencyBase: baseKey,
        newEngineerId: newRow?.engineer_id,
        oldEngineerId: oldRow?.engineer_id,
        extra: { event, new_engineer_id: newRow?.engineer_id, old_engineer_id: oldRow?.engineer_id },
      });
    } else if (event === "status_changed" && newRow?.status === "cancelled") {
      await fanoutLifecycleNotification(sb, {
        jobId,
        kind: "job_cancelled",
        title: "Job cancelled",
        message: `${jobLabel} has been cancelled.`,
        idempotencyBase: baseKey,
        newEngineerId: newRow?.engineer_id,
        extra: { event },
      });
    } else if (event === "status_changed" && oldRow?.status !== newRow?.status) {
      // Lightweight status notification for major transitions (skip routine ones)
      const notable = ["completed", "in_progress", "on_hold"];
      if (notable.includes(String(newRow?.status))) {
        await fanoutLifecycleNotification(sb, {
          jobId,
          kind: "job_status",
          title: `Job ${newRow.status}`,
          message: `${jobLabel}: ${oldRow?.status} → ${newRow.status}.`,
          idempotencyBase: baseKey,
          newEngineerId: newRow?.engineer_id,
          extra: { event, old_status: oldRow?.status, new_status: newRow?.status },
        });
      }
    }

    // SLA breach detected via is_delayed flip — extra escalation notice for leads
    if (oldRow?.is_delayed === false && newRow?.is_delayed === true) {
      await fanoutLifecycleNotification(sb, {
        jobId,
        kind: "escalation",
        title: "Job escalation",
        message: `${jobLabel} crossed the SLA threshold and was flagged for escalation.`,
        idempotencyBase: `${baseKey}:escalation`,
        newEngineerId: newRow?.engineer_id,
        extra: { event },
      });
    }
  } catch (e) {
    await logAction(sb, {
      action_type: "lifecycle_error",
      job_id: jobId,
      status: "failed",
      reasoning: e instanceof Error ? e.message : "Unknown",
    });
  }

  return json({ status: "ok", event, idempotencyKey: baseKey });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const auth = req.headers.get("Authorization") || "";

    const body = await req.json().catch(() => ({}));
    const { action } = body;

    const sb = createClient(url, service);

    // The `lifecycle` action is triggered internally by a Postgres trigger via pg_net.
    // Guard it with a shared secret header instead of a user JWT.
    if (action === "lifecycle") {
      const provided = req.headers.get("x-lifecycle-secret") || "";
      const { data: secretRow } = await sb
        .from("dispatch_agent_settings")
        .select("lifecycle_secret")
        .limit(1)
        .maybeSingle();
      const expected = (secretRow as any)?.lifecycle_secret as string | undefined;
      if (!expected || !provided || provided !== expected) {
        return json({ error: "Forbidden" }, 403);
      }
      const settings = await getSettings(sb);
      if (!settings) return json({ error: "Settings not initialized" }, 500);
      if (!settings.enabled) return json({ error: "Agent disabled", settings }, 403);
      return handleLifecycle(sb, body, settings);
    }

    // All other actions require an authenticated user.
    let userId: string | null = null;
    if (auth.startsWith("Bearer ")) {
      const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } });
      const { data } = await userClient.auth.getUser();
      if (data?.user) userId = data.user.id;
    }
    if (!userId) {
      return json({ error: "Unauthorized" }, 401);
    }

    // Internal cron caller for reassign-scan can present a shared secret.
    const cronSecret = Deno.env.get("CRON_SECRET");
    const providedCron = req.headers.get("x-cron-secret") || "";
    const cronAuthorized = !!cronSecret && providedCron === cronSecret;

    // Role gate: only staff can trigger privileged actions.
    if (!cronAuthorized) {
      const { data: rolesData } = await sb
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      const roles = (rolesData ?? []).map((r: any) => r.role);
      const isStaff = roles.some((r: string) =>
        ["admin", "team_lead", "associate_coordinator"].includes(r),
      );
      // `status` is informational and safe to expose to any authenticated user.
      if (!isStaff && action !== "status") {
        return json({ error: "Forbidden" }, 403);
      }
    }

    const settings = await getSettings(sb);
    if (!settings) return json({ error: "Settings not initialized" }, 500);
    if (!settings.enabled && action !== "status") {
      const { lifecycle_secret: _ls2, ...safe } = settings as any;
      return json({ error: "Agent disabled", settings: safe }, 403);
    }

    switch (action) {
      case "status": {
        // Never expose lifecycle_secret — even to staff — through this endpoint.
        const { lifecycle_secret: _ls, ...safeSettings } = (settings as any) ?? {};
        return json({ settings: safeSettings });
      }
      case "assign":
        return handleAssign(sb, userId, body, settings);
      case "reassign-scan":
        return handleReassignScan(sb, userId, settings);
      case "schedule":
        return handleSchedule(sb, userId, body, settings);
      case "chat":
        return handleChat(sb, userId, body, settings);
      case "approve":
        return handleApproval(sb, userId, body, "approve");
      case "reject":
        return handleApproval(sb, userId, body, "reject");
      // lifecycle is handled above with a shared secret check
      case "simulate": {
        const { jobId } = body;
        if (!jobId) return json({ error: "jobId required" }, 400);
        const { job, ranked } = await rankForJob(sb, jobId, settings);
        if (!job) return json({ error: "Job not found" }, 404);
        const top = ranked[0];
        const wouldRequireApproval =
          settings.autonomy === "suggest" ||
          settings.require_approval_priorities.includes((job.priority || "").toLowerCase());

        // Route preview if top engineer assigned
        let routePreview: any[] = [];
        if (top) {
          const { data: existing } = await sb
            .from("jobs")
            .select("id, title, scheduled_at, priority, status, location")
            .eq("engineer_id", top.engineer.id)
            .in("status", ["assigned", "in_progress"]);
          const combined = [...(existing || []), { ...job, _new: true }];
          routePreview = combined.sort((a: any, b: any) => {
            const pa = a.priority === "urgent" ? 0 : 1;
            const pb = b.priority === "urgent" ? 0 : 1;
            if (pa !== pb) return pa - pb;
            return new Date(a.scheduled_at || 0).getTime() - new Date(b.scheduled_at || 0).getTime();
          });
        }

        return json({
          job,
          recommendation: top
            ? {
                engineerId: top.engineer.id,
                score: top.score,
                reasons: top.reasons,
                distanceKm: top.distance,
                wouldRequireApproval,
                outcome: wouldRequireApproval ? "would_queue_approval" : "would_assign",
              }
            : null,
          ranked: ranked.slice(0, 5).map((r: any) => ({
            engineerId: r.engineer.id,
            specialty: r.engineer.specialty,
            rating: r.engineer.rating,
            jobsCompleted: r.engineer.jobs_completed,
            score: r.score,
            distanceKm: r.distance,
            reasons: r.reasons,
          })),
          routePreview,
          settings: {
            autonomy: settings.autonomy,
            maxRadiusKm: settings.max_auto_assign_radius_km,
          },
        });
      }
      default:
        return json({ error: "Unknown action" }, 400);
    }
  } catch (e) {
    console.error("dispatch-agent error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
