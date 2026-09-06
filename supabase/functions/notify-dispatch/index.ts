// Notify dispatch staff (admins, team leads, coordinators) about an
// engineer's SLA escalation event. Uses the service role to fan-out
// notifications to every dispatcher because engineers cannot insert
// notifications for other users under the table's RLS.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type EventKind = "dispatch_notified" | "reassign_requested";

interface Body {
  job_id: string;
  message: string;
  eta?: string | null; // ISO datetime if engineer has already updated it
  kind?: EventKind; // event kind to log; defaults to dispatch_notified
  reason_code?: string | null; // for reassignment requests
  reason_label?: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Validate caller's JWT and resolve their user id.
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
    const senderId = userRes.user.id;

    const body = (await req.json()) as Body;
    if (!body?.job_id || typeof body.job_id !== "string") {
      return new Response(JSON.stringify({ error: "job_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const message = String(body.message ?? "").slice(0, 500).trim() ||
      "Engineer flagged an SLA escalation.";
    const etaIso = body.eta && !Number.isNaN(new Date(body.eta).getTime())
      ? new Date(body.eta).toISOString()
      : null;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Look up job + engineer for context.
    const [{ data: job }, { data: engineer }] = await Promise.all([
      admin
        .from("jobs")
        .select("id, title, location, priority, scheduled_at, engineer_id")
        .eq("id", body.job_id)
        .maybeSingle(),
      admin
        .from("engineers")
        .select("id, name, user_id")
        .eq("user_id", senderId)
        .maybeSingle(),
    ]);

    if (!job) {
      return new Response(JSON.stringify({ error: "job not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Only the engineer assigned to this job may send escalation/reassignment alerts.
    if (!engineer || job.engineer_id !== engineer.id) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find all dispatch users (admin, team_lead, associate_coordinator).
    const { data: roles, error: rolesErr } = await admin
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["admin", "team_lead", "associate_coordinator"]);
    if (rolesErr) throw rolesErr;

    const recipientIds = Array.from(
      new Set((roles ?? []).map((r: any) => r.user_id).filter(Boolean)),
    );

    const engineerName = engineer?.name ?? "An engineer";
    const etaPretty = etaIso
      ? new Date(etaIso).toLocaleString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })
      : null;

    const kind: EventKind =
      body.kind === "reassign_requested" ? "reassign_requested" : "dispatch_notified";
    const reasonLabel = (body.reason_label ?? "").toString().slice(0, 120).trim() || null;
    const reasonCode = (body.reason_code ?? "").toString().slice(0, 60).trim() || null;

    const isReassign = kind === "reassign_requested";
    const title = isReassign
      ? `Reassignment requested: ${job.title}`
      : `SLA escalation: ${job.title}`;
    const reasonPart = isReassign && reasonLabel ? ` Reason: ${reasonLabel}.` : "";
    const fullMessage = etaPretty
      ? `${engineerName}: ${message} New ETA: ${etaPretty}.${reasonPart}`
      : `${engineerName}: ${message}${reasonPart}`;

    const metadata = {
      job_id: job.id,
      job_title: job.title,
      job_location: job.location,
      job_priority: job.priority,
      scheduled_at: job.scheduled_at,
      engineer_id: engineer?.id ?? null,
      engineer_user_id: senderId,
      engineer_name: engineer?.name ?? null,
      message,
      eta: etaIso,
      source: isReassign ? "reassign_request" : "sla_escalation",
      reason_code: reasonCode,
      reason_label: reasonLabel,
      kind,
    };

    let inserted = 0;
    if (recipientIds.length > 0) {
      const rows = recipientIds.map((uid: string) => ({
        user_id: uid,
        type: isReassign ? "alert" : "warning",
        title,
        message: fullMessage,
        metadata,
      }));
      const { error: insErr, count } = await admin
        .from("notifications")
        .insert(rows, { count: "exact" });
      if (insErr) throw insErr;
      inserted = count ?? rows.length;
    }

    // Audit trail on the job itself.
    await admin.from("job_events").insert([
      {
        job_id: job.id,
        engineer_id: engineer?.id ?? null,
        kind,
        meta: isReassign
          ? {
              delivered_to: inserted,
              reason: message,
              reason_code: reasonCode,
              reason_label: reasonLabel,
            }
          : { delivered_to: inserted, message, eta: etaIso },
      },
    ]);

    return new Response(
      JSON.stringify({ ok: true, delivered_to: inserted }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("notify-dispatch error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
