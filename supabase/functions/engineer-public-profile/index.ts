// Public, unauthenticated lookup of safe engineer info for the
// /engineers/:id share page. Only non-sensitive fields are returned.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    let id = url.searchParams.get("id");
    if (!id && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      id = body?.id ?? null;
    }
    if (!id) {
      return new Response(JSON.stringify({ error: "Missing id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: eng, error } = await admin
      .from("engineers")
      .select(
        "id, user_id, specialty, rating, jobs_completed, location, skills, vehicle_number_plate, insurance_verified, show_email, show_phone, show_vehicle, show_insurance",
      )
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    if (!eng) {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: prof } = await admin
      .from("profiles")
      .select("full_name, avatar_url, email, phone")
      .eq("user_id", eng.user_id)
      .maybeSingle();

    const e: any = eng;
    const payload = {
      id: eng.id,
      fullName: prof?.full_name ?? null,
      avatarUrl: prof?.avatar_url ?? null,
      specialty: eng.specialty ?? null,
      rating: eng.rating ?? null,
      jobsCompleted: eng.jobs_completed ?? null,
      location: eng.location ?? null,
      skills: e.skills ?? [],
      email: e.show_email ? prof?.email ?? null : null,
      phone: e.show_phone ? prof?.phone ?? null : null,
      vehiclePlate: e.show_vehicle ? e.vehicle_number_plate ?? null : null,
      insuranceVerified: e.show_insurance ? e.insurance_verified ?? false : false,
      privacy: {
        showEmail: !!e.show_email,
        showPhone: !!e.show_phone,
        showVehicle: !!e.show_vehicle,
        showInsurance: !!e.show_insurance,
      },
    };

    return new Response(JSON.stringify(payload), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=60",
      },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? "error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
