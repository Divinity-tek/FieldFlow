// supabase/functions/send-push/index.ts
//
// Sends a Web Push notification to every active subscription for a given user.
// Called by the public.fire_push_for_notification() trigger via pg_net,
// which fires after every insert into public.notifications.
//
// Uses VAPID-signed Web Push directly (no external SDK) — Deno has all the
// crypto we need.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-internal-trigger",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@fieldflow.app";

// ---------- helpers: base64url ----------
function b64urlEncode(buf: Uint8Array): string {
  let s = btoa(String.fromCharCode(...buf));
  return s.replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}
function b64urlDecode(s: string): Uint8Array {
  s = s.replaceAll("-", "+").replaceAll("_", "/");
  while (s.length % 4) s += "=";
  return new Uint8Array(atob(s).split("").map((c) => c.charCodeAt(0)));
}

// ---------- VAPID JWT ----------
async function importVapidPrivateKey(b64url: string): Promise<CryptoKey> {
  const d = b64urlEncode(b64urlDecode(b64url));
  const pub = b64urlDecode(VAPID_PUBLIC_KEY);
  // Public key is uncompressed point: 0x04 || x(32) || y(32). Skip leading 0x04.
  const x = b64urlEncode(pub.slice(1, 33));
  const y = b64urlEncode(pub.slice(33, 65));
  const jwk = { kty: "EC", crv: "P-256", d, x, y, ext: true } as JsonWebKey;
  return crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}

async function importVapidPublicKey(): Promise<CryptoKey> {
  const pub = b64urlDecode(VAPID_PUBLIC_KEY);
  const x = b64urlEncode(pub.slice(1, 33));
  const y = b64urlEncode(pub.slice(33, 65));
  const jwk = { kty: "EC", crv: "P-256", x, y, ext: true } as JsonWebKey;
  return crypto.subtle.importKey("jwk", jwk, { name: "ECDH", namedCurve: "P-256" }, true, []);
}

async function buildVapidJwt(audience: string): Promise<string> {
  const header = { typ: "JWT", alg: "ES256" };
  const claims = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 12, // 12 h
    sub: VAPID_SUBJECT,
  };
  const segments = [
    b64urlEncode(new TextEncoder().encode(JSON.stringify(header))),
    b64urlEncode(new TextEncoder().encode(JSON.stringify(claims))),
  ];
  const unsigned = segments.join(".");
  const key = await importVapidPrivateKey(VAPID_PRIVATE_KEY);
  const sig = new Uint8Array(
    await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(unsigned))
  );
  return `${unsigned}.${b64urlEncode(sig)}`;
}

// ---------- payload encryption (RFC 8291: aes128gcm) ----------
async function encryptPayload(
  plaintext: Uint8Array,
  uaPublicKeyB64: string,
  authSecretB64: string
): Promise<{ body: Uint8Array }> {
  const uaPub = b64urlDecode(uaPublicKeyB64);
  const authSecret = b64urlDecode(authSecretB64);

  // 1. Generate ephemeral ECDH keypair
  const ephemeral = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );
  const ephemeralPubRaw = new Uint8Array(await crypto.subtle.exportKey("raw", ephemeral.publicKey));

  // 2. Import UA public key
  const uaPubKey = await crypto.subtle.importKey(
    "raw",
    uaPub,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );

  // 3. ECDH shared secret
  const ecdhSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: uaPubKey }, ephemeral.privateKey, 256)
  );

  // 4. HKDF-Extract(authSecret, ecdhSecret) -> PRK_key
  const prkKeyHmac = await crypto.subtle.importKey(
    "raw",
    authSecret,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const prkKey = new Uint8Array(await crypto.subtle.sign("HMAC", prkKeyHmac, ecdhSecret));

  // 5. key_info = "WebPush: info\0" || ua_public || as_public
  const keyInfo = concatBytes(
    new TextEncoder().encode("WebPush: info\0"),
    uaPub,
    ephemeralPubRaw
  );

  // 6. IKM = HMAC-SHA-256(PRK_key, key_info || 0x01)
  const prkKeyImport = await crypto.subtle.importKey(
    "raw",
    prkKey,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const ikm = new Uint8Array(
    await crypto.subtle.sign("HMAC", prkKeyImport, concatBytes(keyInfo, new Uint8Array([0x01])))
  );

  // 7. salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // 8. PRK = HMAC-SHA-256(salt, IKM)
  const saltImport = await crypto.subtle.importKey(
    "raw",
    salt,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const prk = new Uint8Array(await crypto.subtle.sign("HMAC", saltImport, ikm));

  // 9. CEK
  const prkImport = await crypto.subtle.importKey(
    "raw",
    prk,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const cekRaw = (
    new Uint8Array(
      await crypto.subtle.sign(
        "HMAC",
        prkImport,
        concatBytes(new TextEncoder().encode("Content-Encoding: aes128gcm\0"), new Uint8Array([0x01]))
      )
    )
  ).slice(0, 16);

  // 10. NONCE
  const nonce = (
    new Uint8Array(
      await crypto.subtle.sign(
        "HMAC",
        prkImport,
        concatBytes(new TextEncoder().encode("Content-Encoding: nonce\0"), new Uint8Array([0x01]))
      )
    )
  ).slice(0, 12);

  // 11. Plaintext padded with single 0x02 then encrypted
  const padded = concatBytes(plaintext, new Uint8Array([0x02]));
  const cek = await crypto.subtle.importKey("raw", cekRaw, { name: "AES-GCM" }, false, ["encrypt"]);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, cek, padded)
  );

  // 12. aes128gcm content header: salt(16) || rs(4 BE) || idlen(1) || keyid(idlen)
  const rs = 4096;
  const rsBytes = new Uint8Array([(rs >>> 24) & 0xff, (rs >>> 16) & 0xff, (rs >>> 8) & 0xff, rs & 0xff]);
  const header = concatBytes(salt, rsBytes, new Uint8Array([ephemeralPubRaw.length]), ephemeralPubRaw);
  const body = concatBytes(header, ciphertext);
  return { body };
}

function concatBytes(...arrs: Uint8Array[]): Uint8Array {
  const total = arrs.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrs) {
    out.set(a, off);
    off += a.length;
  }
  return out;
}

// ---------- send a single push ----------
async function sendPushTo(sub: { endpoint: string; p256dh: string; auth: string }, payload: object): Promise<{ ok: boolean; status: number; body?: string }> {
  const url = new URL(sub.endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const jwt = await buildVapidJwt(audience);

  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const { body } = await encryptPayload(plaintext, sub.p256dh, sub.auth);

  const res = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      "Authorization": `vapid t=${jwt}, k=${VAPID_PUBLIC_KEY}`,
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      "TTL": "86400",
      "Urgency": "high",
    },
    body,
  });

  let errText: string | undefined;
  if (!res.ok) {
    try { errText = await res.text(); } catch { /* ignore */ }
  }
  return { ok: res.ok, status: res.status, body: errText };
}

// ---------- handler ----------
// Cache the trigger secret for the function instance lifetime.
let cachedTriggerSecret: string | null = null;
async function getTriggerSecret(client: ReturnType<typeof createClient>): Promise<string | null> {
  if (cachedTriggerSecret) return cachedTriggerSecret;
  try {
    const { data, error } = await client
      .schema("vault")
      .from("decrypted_secrets")
      .select("decrypted_secret")
      .eq("name", "push_trigger_secret")
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    cachedTriggerSecret = (data as { decrypted_secret: string }).decrypted_secret ?? null;
    return cachedTriggerSecret;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // ----- AUTHENTICATION -----
  // Accept either:
  //   (a) a valid logged-in user JWT (e.g. for admin debugging), OR
  //   (b) the X-Internal-Trigger header matching the Vault `push_trigger_secret`,
  //       which is set by the public.fire_push_for_notification() DB trigger.
  const supabaseAuth = createClient(SUPABASE_URL, SERVICE_ROLE);
  const trigger = req.headers.get("x-internal-trigger") ?? "";
  const expected = await getTriggerSecret(supabaseAuth);
  let authorized = false;
  if (expected && trigger && trigger === expected) {
    authorized = true;
  } else {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (authHeader.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      const { data, error } = await supabaseAuth.auth.getClaims(token);
      if (!error && data?.claims?.sub) {
        // Only staff roles may invoke this endpoint manually, to prevent
        // arbitrary users from spamming/phishing push notifications.
        const { data: roles } = await supabaseAuth
          .from("user_roles")
          .select("role")
          .eq("user_id", data.claims.sub);
        const isStaff = (roles ?? []).some((r: any) =>
          ["admin", "team_lead", "associate_coordinator", "service_desk"].includes(r.role),
        );
        if (isStaff) authorized = true;
      }
    }
  }
  if (!authorized) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return new Response(
      JSON.stringify({ error: "VAPID keys not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { user_id, title, body: msgBody, url, tag, type, notification_id } = body ?? {};
  if (!user_id || !title) {
    return new Response(JSON.stringify({ error: "Missing user_id or title" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  // ── Honor user notification preferences (per-event toggles, per-role push, quiet hours) ──
  try {
    const evtType: string = typeof type === "string" ? type : "";
    const role: string = typeof body?.role === "string" ? body.role : "";
    // Events considered critical — may bypass quiet hours when allowed.
    const CRITICAL = new Set(["sla_breach", "sla_risk", "escalation", "job_cancelled"]);
    // Map notification type → preference column (only types users can mute).
    const EVENT_PREF: Record<string, string> = {
      job_assigned: "job_assigned",
      job_status: "job_status_change",
      sla_breach: "sla_breach",
      sla_risk: "sla_risk",
      job_reassigned: "job_reassigned",
      job_cancelled: "job_cancelled",
      escalation: "escalation",
      new_ticket: "new_ticket",
      ticket_update: "ticket_update",
      estimate_update: "estimate_update",
      invoice_update: "invoice_update",
    };
    const ROLE_PREF: Record<string, string> = {
      client: "push_role_client",
      engineer: "push_role_engineer",
      team_lead: "push_role_team_lead",
      admin: "push_role_admin",
    };

    const { data: prefs } = await supabase
      .from("notification_preferences")
      .select("*")
      .eq("user_id", user_id)
      .maybeSingle();

    if (prefs) {
      const evtCol = EVENT_PREF[evtType];
      if (evtCol && (prefs as any)[evtCol] === false) {
        return new Response(
          JSON.stringify({ ok: true, sent: 0, reason: `muted:${evtType}` }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const roleCol = ROLE_PREF[role];
      if (roleCol && (prefs as any)[roleCol] === false) {
        return new Response(
          JSON.stringify({ ok: true, sent: 0, reason: `muted_role:${role}` }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      // Quiet hours
      if (prefs.quiet_hours_enabled) {
        const parse = (s: string) => {
          const m = /^(\d{1,2}):(\d{2})/.exec(String(s ?? ""));
          return m ? Number(m[1]) * 60 + Number(m[2]) : null;
        };
        const start = parse(prefs.quiet_hours_start);
        const end = parse(prefs.quiet_hours_end);
        if (start !== null && end !== null && start !== end) {
          const now = new Date();
          const minutes = now.getUTCHours() * 60 + now.getUTCMinutes();
          const inQuiet =
            start < end ? minutes >= start && minutes < end : minutes >= start || minutes < end;
          const allowCritical = prefs.quiet_hours_allow_critical !== false;
          if (inQuiet && !(allowCritical && CRITICAL.has(evtType))) {
            return new Response(
              JSON.stringify({ ok: true, sent: 0, reason: "quiet_hours" }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
      }
    }
  } catch (e) {
    console.error("prefs check failed (continuing)", e);
  }

  const { data: subs, error: fetchErr } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", user_id)
    .eq("is_active", true);

  if (fetchErr) {
    console.error("fetch subs failed", fetchErr);
    return new Response(JSON.stringify({ error: fetchErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!subs || subs.length === 0) {
    return new Response(JSON.stringify({ ok: true, sent: 0, reason: "no subscriptions" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const payload = {
    title: String(title).slice(0, 200),
    body: String(msgBody ?? "").slice(0, 500),
    url: typeof url === "string" ? url : "/notifications",
    tag: tag ?? `fieldflow:${notification_id ?? Date.now()}`,
    type: type ?? "general",
    notification_id,
  };

  const results = await Promise.all(
    subs.map(async (sub) => {
      try {
        const r = await sendPushTo(sub, payload);
        if (!r.ok) {
          // 404/410 = expired/unsubscribed → mark inactive
          if (r.status === 404 || r.status === 410) {
            await supabase
              .from("push_subscriptions")
              .update({ is_active: false, last_failure_at: new Date().toISOString() })
              .eq("id", sub.id);
          } else {
            await supabase
              .from("push_subscriptions")
              .update({
                failure_count: (sub as any).failure_count ? (sub as any).failure_count + 1 : 1,
                last_failure_at: new Date().toISOString(),
              })
              .eq("id", sub.id);
          }
          return { id: sub.id, ok: false, status: r.status, error: r.body };
        }
        await supabase
          .from("push_subscriptions")
          .update({ last_success_at: new Date().toISOString(), failure_count: 0 })
          .eq("id", sub.id);
        return { id: sub.id, ok: true, status: r.status };
      } catch (e) {
        return { id: sub.id, ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    })
  );

  const sent = results.filter((r) => r.ok).length;
  return new Response(
    JSON.stringify({ ok: true, sent, failed: results.length - sent, results }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
