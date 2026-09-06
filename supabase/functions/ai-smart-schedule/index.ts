import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { requireUser, userHasStaffRole } from "../_shared/auth.ts";
import { aiChatCompletion } from "../_shared/ai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = await requireUser(req);
    if (!auth.ok) return auth.response;
    if (!(await userHasStaffRole(auth.userId))) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { job_id } = await req.json();
    if (!job_id) throw new Error("job_id is required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Fetch the job
    const { data: job, error: jobErr } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", job_id)
      .single();
    if (jobErr || !job) throw new Error("Job not found");

    // Fetch all available engineers (with skills)
    const { data: engineers, error: engErr } = await supabase
      .from("engineers")
      .select("*")
      .eq("is_available", true);
    if (engErr) throw new Error("Failed to fetch engineers");

    // Fetch profiles for names
    const userIds = (engineers || []).map((e: any) => e.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", userIds);
    const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p.full_name]));

    // Count active jobs per engineer
    const { data: activeJobs } = await supabase
      .from("jobs")
      .select("engineer_id")
      .not("status", "in", '("completed","cancelled")')
      .not("engineer_id", "is", null);

    const workloadMap = new Map<string, number>();
    (activeJobs || []).forEach((j: any) => {
      workloadMap.set(j.engineer_id, (workloadMap.get(j.engineer_id) || 0) + 1);
    });

    // Fetch SLA policy for this job's client + priority
    let slaPolicy: any = null;
    try {
      const { data } = await supabase
        .from("sla_policies")
        .select("*")
        .eq("client_id", job.client_id)
        .eq("priority", job.priority)
        .eq("is_active", true)
        .maybeSingle();
      slaPolicy = data;
    } catch (_) { /* no SLA policy */ }

    // Calculate SLA urgency factor
    let slaUrgencyFactor = 1.0;
    let slaTimeRemaining: number | null = null;
    if (slaPolicy) {
      const jobCreated = new Date(job.created_at).getTime();
      const now = Date.now();
      const elapsedMinutes = (now - jobCreated) / 60000;
      const responseTarget = slaPolicy.response_time_minutes;
      const remaining = responseTarget - elapsedMinutes;
      slaTimeRemaining = Math.round(remaining);

      if (remaining <= 0) slaUrgencyFactor = 2.0;       // breached
      else if (remaining <= 15) slaUrgencyFactor = 1.8;  // critical
      else if (remaining <= 30) slaUrgencyFactor = 1.4;  // warning
      else if (remaining <= 60) slaUrgencyFactor = 1.2;  // approaching
    }

    // Score each engineer
    const scored = (engineers || []).map((eng: any) => {
      const breakdown: Record<string, { score: number; max: number; detail: string }> = {};
      let totalScore = 0;

      // 1. Specialty match (0-25 points)
      const jobType = (job.service_type || "").toLowerCase();
      const engSpec = (eng.specialty || "").toLowerCase();
      let specScore = 0;
      let specDetail = "No match";
      if (engSpec === jobType) { specScore = 25; specDetail = "Exact match"; }
      else if (jobType.includes(engSpec) || engSpec.includes(jobType)) { specScore = 15; specDetail = "Partial match"; }
      breakdown.specialty = { score: specScore, max: 25, detail: specDetail };
      totalScore += specScore;

      // 2. Skills match (0-20 points)
      const engSkills: string[] = (eng.skills || []).map((s: string) => s.toLowerCase());
      const jobServiceWords = jobType.split(/[\s,]+/);
      let skillMatches = 0;
      if (engSkills.length > 0) {
        // Check if any engineer skills relate to job service type
        skillMatches = engSkills.filter((sk: string) =>
          jobServiceWords.some((w: string) => sk.includes(w) || w.includes(sk))
        ).length;
      }
      const skillScore = engSkills.length > 0
        ? Math.min(Math.round((skillMatches / Math.max(engSkills.length, 1)) * 20 + (engSkills.length >= 3 ? 5 : 0)), 20)
        : 0;
      breakdown.skills = { score: skillScore, max: 20, detail: `${engSkills.length} skills, ${skillMatches} relevant` };
      totalScore += skillScore;

      // 3. Distance (0-20 points)
      let distanceKm: number | null = null;
      let distScore = 0;
      let distDetail = "No location data";
      if (eng.latitude && eng.longitude && job.latitude && job.longitude) {
        distanceKm = haversine(eng.latitude, eng.longitude, job.latitude, job.longitude);
        if (distanceKm <= 5) { distScore = 20; distDetail = `${distanceKm.toFixed(1)}km — very close`; }
        else if (distanceKm <= 15) { distScore = 16; distDetail = `${distanceKm.toFixed(1)}km — nearby`; }
        else if (distanceKm <= 30) { distScore = 10; distDetail = `${distanceKm.toFixed(1)}km — moderate`; }
        else if (distanceKm <= 60) { distScore = 4; distDetail = `${distanceKm.toFixed(1)}km — far`; }
        else { distDetail = `${distanceKm.toFixed(1)}km — very far`; }
      }
      breakdown.distance = { score: distScore, max: 20, detail: distDetail };
      totalScore += distScore;

      // 4. Workload (0-15 points)
      const activeCount = workloadMap.get(eng.id) || 0;
      let wlScore = 0;
      if (activeCount === 0) wlScore = 15;
      else if (activeCount <= 2) wlScore = 10;
      else if (activeCount <= 4) wlScore = 5;
      breakdown.workload = { score: wlScore, max: 15, detail: `${activeCount} active jobs` };
      totalScore += wlScore;

      // 5. Rating (0-12 points)
      const rating = Number(eng.rating) || 0;
      const ratingScore = Math.min(Math.round((rating / 5) * 12), 12);
      breakdown.rating = { score: ratingScore, max: 12, detail: rating > 0 ? `${rating.toFixed(1)}/5` : "No rating" };
      totalScore += ratingScore;

      // 6. Experience (0-8 points)
      const completed = eng.jobs_completed || 0;
      let expScore = 0;
      if (completed >= 100) expScore = 8;
      else if (completed >= 50) expScore = 6;
      else if (completed >= 20) expScore = 4;
      else if (completed >= 5) expScore = 2;
      breakdown.experience = { score: expScore, max: 8, detail: `${completed} completed` };
      totalScore += expScore;

      // Apply SLA urgency multiplier (boosts scores for urgent SLA situations — favors proximity and availability)
      if (slaUrgencyFactor > 1.0) {
        const urgencyBonus = Math.round((breakdown.distance.score + breakdown.workload.score) * (slaUrgencyFactor - 1));
        totalScore += urgencyBonus;
        breakdown.sla_urgency = { score: urgencyBonus, max: 20, detail: `SLA ${slaTimeRemaining !== null && slaTimeRemaining <= 0 ? "BREACHED" : `${slaTimeRemaining}min remaining`}` };
      }

      return {
        engineer_id: eng.id,
        name: profileMap.get(eng.user_id) || eng.specialty,
        specialty: eng.specialty,
        skills: eng.skills || [],
        rating,
        distance_km: distanceKm,
        active_jobs: activeCount,
        jobs_completed: completed,
        hourly_rate: Number(eng.hourly_rate) || 0,
        score: totalScore,
        breakdown,
      };
    });

    scored.sort((a: any, b: any) => b.score - a.score);
    const recommendations = scored.slice(0, 5);

    // Generate AI summary
    let ai_summary = "";
    if (recommendations.length > 0) {
      try {
        const top = recommendations[0];
        const breakdownStr = Object.entries(top.breakdown)
          .map(([k, v]: [string, any]) => `${k}: ${v.score}/${v.max} (${v.detail})`)
          .join(", ");

        const prompt = `You are a field service dispatch assistant. A job "${job.title}" (${job.service_type}, ${job.priority} priority) at ${job.location} needs an engineer.
${slaPolicy ? `SLA: respond within ${slaPolicy.response_time_minutes}min, resolve within ${slaPolicy.resolution_time_minutes}min. Time remaining: ${slaTimeRemaining}min.` : "No SLA policy."}

Top pick: ${top.name} (score: ${top.score}) — Breakdown: ${breakdownStr}
Other candidates: ${recommendations.slice(1).map((r: any) => `${r.name} (${r.score})`).join(", ")}

Write 2 sentences: why the top pick is best, and any SLA or trade-off considerations. Be concise.`;

        const aiResp = await aiChatCompletion({
          messages: [
            { role: "system", content: "You are a concise field service dispatch advisor. Keep responses under 3 sentences." },
            { role: "user", content: prompt },
          ],
        });

        if (aiResp.ok) {
          const aiData = await aiResp.json();
          ai_summary = aiData.choices?.[0]?.message?.content || "";
        }
      } catch (e) {
        console.error("AI summary error:", e);
      }
    }

    return new Response(JSON.stringify({
      recommendations,
      ai_summary,
      sla_info: slaPolicy ? {
        response_target: slaPolicy.response_time_minutes,
        resolution_target: slaPolicy.resolution_time_minutes,
        time_remaining: slaTimeRemaining,
        urgency_factor: slaUrgencyFactor,
      } : null,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Smart schedule error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
