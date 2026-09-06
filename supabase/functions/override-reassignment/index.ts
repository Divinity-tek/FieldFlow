// Admin / team lead override for an engineer's reassignment request.
// - Re-classifies the reassignment (new reason code + label + notes)
// - Optionally swaps the assigned engineer on the job
// - Records a `reassignment_overridden` job_event referencing the source request
// - Notifies all other dispatchers (admin / team_lead / associate_coordinator)
//
// Service role is used because RLS on `notifications` and on cross-engineer
// `jobs` updates would otherwise block this fan-out.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Body {
  job_id: string;
  source_event_id?: string | null; // original reassign_requested event id
  reason_code: string;
  reason_label: string;
  override_notes?: string | null;
  new_engineer_id?: string | null; // optional: actually swap engineer
}

const ALLOWED_ROLES = ["admin", "team_lead", "associate_coordinator"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes?.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const overriderId = userRes.user.id;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Authorize: must hold a dispatch role.
    const { data: myRoles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", overriderId);
    const isDispatch = (myRoles ?? []).some((r: any) =>
      ALLOWED_ROLES.includes(r.role)
    );
    if (!isDispatch) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as Body;
    if (!body?.job_id || typeof body.job_id !== "string") {
      return new Response(JSON.stringify({ error: "job_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const reasonCode = String(body.reason_code ?? "").slice(0, 60).trim();
    const reasonLabel = String(body.reason_label ?? "").slice(0, 120).trim();
    if (!reasonCode || !reasonLabel) {
      return new Response(
        JSON.stringify({ error: "reason_code and reason_label required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    const overrideNotes = body.override_notes
      ? String(body.override_notes).slice(0, 500).trim()
      : null;
    const newEngineerId = body.new_engineer_id ?? null;
    const sourceEventId = body.source_event_id ?? null;

    // Load job + (optional) source event + (optional) new engineer.
    const [{ data: job }, { data: sourceEvent }, { data: newEngineer }] =
      await Promise.all([
        admin
          .from("jobs")
          .select(
            "id, title, engineer_id, previous_engineer_ids, reassign_count",
          )
          .eq("id", body.job_id)
          .maybeSingle(),
        sourceEventId
          ? admin
              .from("job_events")
              .select("id, engineer_id, meta")
              .eq("id", sourceEventId)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        newEngineerId
          ? admin
              .from("engineers")
              .select("id, name, user_id")
              .eq("id", newEngineerId)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

    if (!job) {
      return new Response(JSON.stringify({ error: "job not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const previousEngineerId = job.engineer_id ?? null;
    let didReassign = false;

    // Optionally swap engineer.
    if (newEngineerId && newEngineerId !== previousEngineerId) {
      const prevList: string[] = Array.isArray(job.previous_engineer_ids)
        ? (job.previous_engineer_ids as string[])
        : [];
      const updatedPrev = previousEngineerId
        ? Array.from(new Set([...prevList, previousEngineerId]))
        : prevList;
      const { error: updErr } = await admin
        .from("jobs")
        .update({
          engineer_id: newEngineerId,
          assigned_by: overriderId,
          last_reassigned_at: new Date().toISOString(),
          reassign_count: (job.reassign_count ?? 0) + 1,
          previous_engineer_ids: updatedPrev,
          is_delayed: false,
          delayed_at: null,
          delayed_reason: null,
        })
        .eq("id", job.id);
      if (updErr) throw updErr;
      didReassign = true;
    }

    // Resolve original engineer name for the notification copy.
    const { data: prevEng } = previousEngineerId
      ? await admin
          .from("engineers")
          .select("id, name")
          .eq("id", previousEngineerId)
          .maybeSingle()
      : { data: null };

    // Notify all other dispatchers.
    const { data: roles } = await admin
      .from("user_roles")
      .select("user_id, role")
      .in("role", ALLOWED_ROLES);
    const recipientIds = Array.from(
      new Set(
        (roles ?? [])
          .map((r: any) => r.user_id)
          .filter((uid: string) => uid && uid !== overriderId),
      ),
    );

    const headline = didReassign
      ? `Job reassigned: ${job.title}`
      : `Reassignment reason updated: ${job.title}`;
    const swapPart = didReassign
      ? ` Now assigned to ${newEngineer?.name ?? "a new engineer"}.`
      : "";
    const messageBody =
      `${prevEng?.name ?? "Previous engineer"} → reason updated to "${reasonLabel}".${swapPart}` +
      (overrideNotes ? ` Notes: ${overrideNotes}` : "");

    const meta = {
      job_id: job.id,
      job_title: job.title,
      source_event_id: sourceEventId,
      previous_engineer_id: previousEngineerId,
      new_engineer_id: didReassign ? newEngineerId : null,
      new_engineer_name: didReassign ? (newEngineer?.name ?? null) : null,
      reason_code: reasonCode,
      reason_label: reasonLabel,
      override_notes: overrideNotes,
      overridden_by: overriderId,
      reassigned: didReassign,
    };

    let inserted = 0;
    if (recipientIds.length > 0) {
      const rows = recipientIds.map((uid: string) => ({
        user_id: uid,
        type: didReassign ? "info" : "warning",
        title: headline,
        message: messageBody,
        metadata: { ...meta, source: "reassignment_override" },
      }));
      const { error: insErr, count } = await admin
        .from("notifications")
        .insert(rows, { count: "exact" });
      if (insErr) throw insErr;
      inserted = count ?? rows.length;
    }

    // Audit trail event.
    await admin.from("job_events").insert([
      {
        job_id: job.id,
        engineer_id: didReassign
          ? newEngineerId
          : (previousEngineerId ?? null),
        kind: "reassignment_overridden",
        meta: { ...meta, delivered_to: inserted },
      },
    ]);

    return new Response(
      JSON.stringify({
        ok: true,
        delivered_to: inserted,
        reassigned: didReassign,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("override-reassignment error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
