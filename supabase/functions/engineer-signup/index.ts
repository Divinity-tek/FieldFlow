// supabase/functions/engineer-signup/index.ts
//
// Creates an engineer's auth account (pre-confirmed — no email link required)
// and submits their application in one call. Engineers rely solely on ADMIN
// APPROVAL as their gate, never on email confirmation.
//
// Replaces the old two-step design (create via client-side supabase.auth.signUp
// + a separate confirm-engineer-email call). Setting email_confirm: true at
// creation time makes that second step unnecessary.
//
// Deploy: supabase functions deploy engineer-signup
// Requires SUPABASE_SERVICE_ROLE_KEY to be set as a function secret (available
// by default as an env var inside Supabase Edge Functions).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const {
    email,
    password,
    full_name,
    phone,
    residential_address,
    specialty,
    city,
    state,
    postcode,
    country,
    skills,
    certification,
    certifications,
    nda_signed,
    id_type,
    id_document_front_name,
    id_document_front_data,
    id_document_back_name,
    id_document_back_data,
  } = body as Record<string, any>;

  if (!email || !password || !full_name) {
    return jsonResponse({ error: "email, password and full_name are required" }, 400);
  }
  if (typeof password !== "string" || password.length < 8) {
    return jsonResponse({ error: "Password must be at least 8 characters" }, 400);
  }
  if (!phone || !postcode || !id_type) {
    return jsonResponse({ error: "phone, postcode and id_type are required" }, 400);
  }
  if (!id_document_front_data || !id_document_back_data) {
    return jsonResponse({ error: "Front and back ID documents are required" }, 400);
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // 1. Create the auth user, pre-confirmed. The on_auth_user_created trigger
  //    (handle_new_user) reads requested_role from metadata and creates the
  //    profile + user_roles row — clamped server-side to a safe allow-list,
  //    so this client-supplied "engineer" value can't grant anything higher.
  const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email: String(email).trim().toLowerCase(),
    password,
    email_confirm: true,
    user_metadata: {
      full_name: String(full_name).trim(),
      requested_role: "engineer",
    },
  });

  if (createError || !createData?.user) {
    const msg = createError?.message || "Failed to create account";
    const status = /already registered|already exists/i.test(msg) ? 409 : 400;
    return jsonResponse({ error: msg }, status);
  }

  const userId = createData.user.id;

  // 2. Submit the application. On failure, roll back the auth user so we
  //    don't leave an orphaned account with no application on file.
  const safeCertifications = Array.isArray(certifications) ? certifications : [];

  const { error: rpcError } = await supabaseAdmin.rpc("submit_engineer_application", {
    p_user_id: userId,
    p_full_name: String(full_name).trim(),
    p_email: String(email).trim().toLowerCase(),
    p_phone: String(phone).trim(),
    p_residential_address: residential_address || null,
    p_specialty: specialty || null,
    p_city: city || null,
    p_state: state || null,
    p_postcode: postcode || null,
    p_country: country || null,
    p_skills: Array.isArray(skills) ? skills : [],
    p_certification: certification || null,
    p_certifications: safeCertifications,
    p_id_type: id_type,
    p_id_document_front_name: id_document_front_name || null,
    p_id_document_front_data: id_document_front_data || null,
    p_id_document_back_name: id_document_back_name || null,
    p_id_document_back_data: id_document_back_data || null,
    p_nda_signed: Boolean(nda_signed),
    p_nda_signed_at: new Date().toISOString(),
  });

  if (rpcError) {
    console.error("submit_engineer_application failed, rolling back user:", rpcError);
    await supabaseAdmin.auth.admin.deleteUser(userId).catch((e) =>
      console.error("Rollback deleteUser also failed:", e)
    );
    return jsonResponse({ error: rpcError.message || "Failed to submit application" }, 500);
  }

  return jsonResponse({ success: true, user_id: userId });
});