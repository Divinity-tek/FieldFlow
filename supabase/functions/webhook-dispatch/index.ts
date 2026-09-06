import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireUser, userHasStaffRole } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function hmacSHA256(key: string, msg: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(msg));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = await requireUser(req);
    if (!auth.ok) return auth.response;
    if (!(await userHasStaffRole(auth.userId))) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { event_type, payload } = await req.json();
    if (!event_type) return new Response(JSON.stringify({ error: "event_type required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: subs } = await supabase
      .from("webhook_subscriptions")
      .select("*")
      .eq("is_active", true)
      .contains("events", [event_type]);

    if (!subs?.length) return new Response(JSON.stringify({ delivered: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = JSON.stringify({ event: event_type, data: payload, timestamp: new Date().toISOString() });

    const results = await Promise.all(subs.map(async (sub) => {
      const headers: Record<string, string> = { "Content-Type": "application/json", "X-Event-Type": event_type };
      if (sub.secret) headers["X-Signature"] = await hmacSHA256(sub.secret, body);

      let status = 0, respBody = "", success = false;
      try {
        const r = await fetch(sub.url, { method: "POST", headers, body });
        status = r.status;
        respBody = (await r.text()).slice(0, 1000);
        success = r.ok;
      } catch (e) {
        respBody = e instanceof Error ? e.message : "fetch failed";
      }

      await supabase.from("webhook_deliveries").insert({
        subscription_id: sub.id,
        event_type,
        payload,
        response_status: status,
        response_body: respBody,
        success,
      });

      await supabase.from("webhook_subscriptions").update({
        last_triggered_at: new Date().toISOString(),
        failure_count: success ? 0 : (sub.failure_count ?? 0) + 1,
      }).eq("id", sub.id);

      return { id: sub.id, success, status };
    }));

    return new Response(JSON.stringify({ delivered: results.length, results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
