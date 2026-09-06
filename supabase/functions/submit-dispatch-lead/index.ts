import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const Body = z.object({
  full_name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255),
  company: z.string().trim().min(1).max(160),
  phone: z.string().trim().max(40).optional().nullable(),
  site_address: z.string().trim().min(2).max(255),
  site_city: z.string().trim().min(1).max(120),
  site_postal_code: z.string().trim().min(1).max(40),
  site_country: z.string().trim().min(1).max(120),
  site_contact: z.string().trim().max(160).optional().nullable(),
  site_access_notes: z.string().trim().max(1000).optional().nullable(),
  service_level: z.enum(["L1", "L2", "L3"]),
  sla: z.string().trim().min(1).max(60),
  duration_estimate: z.string().trim().max(60).optional().nullable(),
  preferred_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  preferred_window: z.string().trim().min(1).max(40),
  scope: z.string().trim().min(5).max(4000),
  // Honeypot — bots love filling every field.
  website: z.string().max(0).optional().or(z.literal("")),
});

const SLA_LABEL: Record<string, string> = {
  p1_4h: "P1 · On-site within 4 hours (24/7)",
  same_day: "Same business day (≤ 8 hrs)",
  next_business_day: "Next business day",
  "48_72h": "Within 48–72 hours",
  scheduled: "Scheduled / project window",
};

function htmlEscape(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!),
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const parsed = Body.safeParse(payload);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: "Validation failed", details: parsed.error.flatten().fieldErrors }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  const data = parsed.data;

  // Silently drop honeypot hits.
  if (data.website && data.website.length > 0) {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  const userAgent = req.headers.get("user-agent") ?? null;
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("cf-connecting-ip") ??
    null;
  const sourceUrl = req.headers.get("origin") ?? req.headers.get("referer") ?? null;

  const slaIsP1 = data.sla === "p1_4h";

  const { data: lead, error: insertErr } = await admin
    .from("dispatch_leads")
    .insert({
      full_name: data.full_name,
      email: data.email,
      company: data.company,
      phone: data.phone || null,
      site_address: data.site_address,
      site_city: data.site_city,
      site_postal_code: data.site_postal_code,
      site_country: data.site_country,
      site_contact: data.site_contact || null,
      site_access_notes: data.site_access_notes || null,
      service_level: data.service_level,
      sla: data.sla,
      duration_estimate: data.duration_estimate || null,
      preferred_date: data.preferred_date,
      preferred_window: data.preferred_window,
      scope: data.scope,
      source_url: sourceUrl,
      user_agent: userAgent,
      ip_address: ip,
    })
    .select("id, created_at")
    .single();

  if (insertErr || !lead) {
    console.error("Insert failed:", insertErr);
    return new Response(JSON.stringify({ error: "Could not save request" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // In-app notifications to admins, team_leads, and service_desk users.
  try {
    const { data: staff } = await admin
      .from("user_roles")
      .select("user_id")
      .in("role", ["admin", "team_lead", "service_desk"]);

    if (staff && staff.length > 0) {
      const uniqueUserIds = Array.from(new Set(staff.map((s: any) => s.user_id)));
      const title = `${slaIsP1 ? "🚨 P1 dispatch request" : "New dispatch request"} · ${data.service_level}`;
      const message = `${data.company} — ${data.site_city}, ${data.site_country} (${SLA_LABEL[data.sla] ?? data.sla})`;
      const rows = uniqueUserIds.map((uid) => ({
        user_id: uid,
        title,
        message,
        type: "dispatch_lead",
        metadata: { lead_id: lead.id, sla: data.sla, service_level: data.service_level },
      }));
      await admin.from("notifications").insert(rows);
    }
  } catch (e) {
    console.error("Notification fanout failed (non-fatal):", e);
  }

  // Email notifications via Resend (only if a RESEND_API_KEY is present).
  // Falls back silently when not configured — the lead is still saved and
  // staff are notified in-app.
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (RESEND_API_KEY) {
    try {
      const { data: recipients } = await admin
        .from("dispatch_notification_recipients")
        .select("email")
        .eq("is_active", true);

      const to = (recipients ?? []).map((r: any) => r.email).filter(Boolean);
      if (to.length > 0) {
        const subject = `${slaIsP1 ? "[P1] " : ""}New ${data.service_level} dispatch — ${data.company} (${data.site_city})`;
        const html = `
          <div style="font-family:system-ui,-apple-system,sans-serif;max-width:640px;color:#0f172a">
            <h2 style="margin:0 0 8px">${slaIsP1 ? "🚨 P1 — " : ""}New dispatch request</h2>
            <p style="margin:0 0 16px;color:#475569">A new availability + quote request was submitted on the website.</p>
            <table style="width:100%;border-collapse:collapse;font-size:14px">
              ${[
                ["Service level", data.service_level],
                ["SLA", SLA_LABEL[data.sla] ?? data.sla],
                ["Preferred date", `${data.preferred_date} (${data.preferred_window})`],
                ["Duration estimate", data.duration_estimate ?? "—"],
                ["Company", data.company],
                ["Contact", `${data.full_name} · ${data.email}${data.phone ? " · " + data.phone : ""}`],
                ["Site", `${data.site_address}, ${data.site_city} ${data.site_postal_code}, ${data.site_country}`],
                ["Site contact", data.site_contact ?? "—"],
                ["Access notes", data.site_access_notes ?? "—"],
              ]
                .map(
                  ([k, v]) =>
                    `<tr><td style="padding:6px 10px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:600;width:32%">${htmlEscape(k as string)}</td><td style="padding:6px 10px;border:1px solid #e2e8f0">${htmlEscape(String(v))}</td></tr>`,
                )
                .join("")}
            </table>
            <h3 style="margin:18px 0 6px">Scope of work</h3>
            <p style="white-space:pre-wrap;background:#f8fafc;border:1px solid #e2e8f0;padding:10px;border-radius:6px">${htmlEscape(data.scope)}</p>
            <p style="color:#64748b;font-size:12px;margin-top:18px">Lead ID: ${lead.id}</p>
          </div>`;

        const fromAddr = Deno.env.get("DISPATCH_FROM_EMAIL") ?? "FieldFlow Dispatch <onboarding@resend.dev>";
        const resendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: fromAddr,
            to,
            reply_to: data.email,
            subject,
            html,
          }),
        });
        if (!resendRes.ok) {
          console.error("Resend error:", resendRes.status, await resendRes.text());
        }
      }
    } catch (e) {
      console.error("Email send failed (non-fatal):", e);
    }
  }

  return new Response(JSON.stringify({ ok: true, lead_id: lead.id }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
