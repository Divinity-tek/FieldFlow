// Admin-only integrations health check.
//
// Reports the status of server-side dependencies that the browser cannot (and
// must not) inspect directly: AI provider reachability, presence of secrets,
// database connectivity via service role, and storage.
//
// SECURITY: never returns secret VALUES — only booleans for "is it configured".
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { requireUser, userHasStaffRole, corsHeaders } from "../_shared/auth.ts";
import { getAiConfig, aiChatCompletion } from "../_shared/ai.ts";

interface Check {
  id: string;
  label: string;
  status: "ok" | "fail" | "not_configured";
  detail: string;
  latency_ms?: number;
}

async function timed<T>(fn: () => Promise<T>): Promise<[T, number]> {
  const t0 = Date.now();
  const r = await fn();
  return [r, Date.now() - t0];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = await requireUser(req);
    if (!auth.ok) return auth.response;
    if (!(await userHasStaffRole(auth.userId))) {
      return new Response(JSON.stringify({ error: "Admin role required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const checks: Check[] = [];

    // --- Environment / secrets presence (booleans only) ---
    const env = (k: string) => !!Deno.env.get(k);
    const secretPresence: Record<string, boolean> = {
      SUPABASE_URL: env("SUPABASE_URL"),
      SUPABASE_ANON_KEY: env("SUPABASE_ANON_KEY"),
      SUPABASE_SERVICE_ROLE_KEY: env("SUPABASE_SERVICE_ROLE_KEY"),
      AI_PROVIDER: env("AI_PROVIDER"),
      AI_API_KEY: env("AI_API_KEY"),
      AI_MODEL: env("AI_MODEL"),
      AI_BASE_URL: env("AI_BASE_URL"),
      VAPID_PUBLIC_KEY: env("VAPID_PUBLIC_KEY"),
      VAPID_PRIVATE_KEY: env("VAPID_PRIVATE_KEY"),
    };

    // --- Database via service role ---
    try {
      const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const [res, ms] = await timed(() => sb.from("user_roles").select("role", { count: "exact", head: true }));
      checks.push({
        id: "database", label: "Database (Postgres)",
        status: res.error ? "fail" : "ok",
        detail: res.error ? res.error.message : "Service-role query OK",
        latency_ms: ms,
      });
    } catch (e) {
      checks.push({ id: "database", label: "Database (Postgres)", status: "fail", detail: String(e) });
    }

    // --- Storage ---
    try {
      const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const [res, ms] = await timed(() => sb.storage.listBuckets());
      checks.push({
        id: "storage", label: "Storage",
        status: res.error ? "fail" : "ok",
        detail: res.error ? res.error.message : `${(res.data || []).length} bucket(s)`,
        latency_ms: ms,
      });
    } catch (e) {
      checks.push({ id: "storage", label: "Storage", status: "fail", detail: String(e) });
    }

    // --- AI provider (live ping) ---
    try {
      const cfg = await getAiConfig(); // throws if misconfigured (e.g. missing key for groq/gemini)
      try {
        const [resp, ms] = await timed(() => aiChatCompletion({
          messages: [{ role: "user", content: "ping" }],
          max_tokens: 1,
        }));
        let detail = `${cfg.provider} / ${cfg.model} @ ${cfg.baseUrl}`;
        if (!resp.ok) {
          const body = await resp.text();
          checks.push({ id: "ai", label: "AI provider", status: "fail",
            detail: `${detail} — HTTP ${resp.status}: ${body.slice(0, 160)}`, latency_ms: ms });
        } else {
          checks.push({ id: "ai", label: "AI provider", status: "ok", detail, latency_ms: ms });
        }
      } catch (e) {
        checks.push({ id: "ai", label: "AI provider", status: "fail",
          detail: `${cfg.provider} unreachable: ${String(e).slice(0, 160)}` });
      }
    } catch (e) {
      checks.push({ id: "ai", label: "AI provider", status: "not_configured", detail: String(e) });
    }

    // --- Push (VAPID config presence) ---
    checks.push({
      id: "push", label: "Web Push (VAPID)",
      status: secretPresence.VAPID_PUBLIC_KEY && secretPresence.VAPID_PRIVATE_KEY ? "ok" : "not_configured",
      detail: secretPresence.VAPID_PUBLIC_KEY && secretPresence.VAPID_PRIVATE_KEY
        ? "VAPID keys present" : "Set VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY to enable push",
    });

    return new Response(JSON.stringify({
      ok: true,
      generated_at: new Date().toISOString(),
      secrets: secretPresence,
      checks,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
