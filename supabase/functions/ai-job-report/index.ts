import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireUser, userHasStaffRole } from "../_shared/auth.ts";
import { aiChatCompletion } from "../_shared/ai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ALLOWED_TYPES = ["job_report", "voice_summary", "revenue_forecast", "asset_maintenance"];
const STAFF_ONLY_TYPES = ["revenue_forecast"];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = await requireUser(req);
    if (!auth.ok) return auth.response;

    const { type, data } = await req.json();
    if (!ALLOWED_TYPES.includes(type)) {
      return new Response(JSON.stringify({ error: "Invalid type" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (STAFF_ONLY_TYPES.includes(type) && !(await userHasStaffRole(auth.userId))) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let systemPrompt = "";
    let userPrompt = "";

    if (type === "job_report") {
      systemPrompt = "You are a professional field service report writer. Generate a concise, client-ready job completion report based on the provided job details. Include: Summary, Work Performed, Findings, Recommendations, and Next Steps. Use professional language. Format with markdown headers.";
      userPrompt = `Generate a job completion report for:\n\nJob: ${data.title}\nService Type: ${data.service_type}\nLocation: ${data.location}\nEngineer Notes: ${data.notes || "No notes provided"}\nStatus: ${data.status}\nStarted: ${data.started_at || "N/A"}\nCompleted: ${data.completed_at || "N/A"}\nFindings: ${data.findings || "N/A"}\nPhotos taken: ${data.photo_count || 0}`;
    } else if (type === "voice_summary") {
      systemPrompt = "You are a field service note summarizer. Given a raw voice transcription from an engineer on-site, extract key information and create a structured summary with: Key Findings, Actions Taken, Parts Used (if mentioned), and Follow-up Required. Be concise and professional.";
      userPrompt = `Summarize this voice transcription from an engineer:\n\n${data.transcript}`;
    } else if (type === "revenue_forecast") {
      systemPrompt = "You are a field service business analyst. Analyze the provided job and revenue data to generate insights and forecasts. Include: Revenue Trend Analysis, Seasonal Patterns, Growth Projections, Risk Factors, and Actionable Recommendations. Use data-driven language with specific numbers.";
      userPrompt = `Analyze this business data and provide revenue forecasting insights:\n\nTotal Jobs: ${data.total_jobs}\nCompleted Jobs: ${data.completed_jobs}\nTotal Revenue: £${data.total_revenue}\nAvg Job Value: £${data.avg_job_value}\nMonthly Breakdown: ${JSON.stringify(data.monthly_data || [])}\nTop Service Types: ${JSON.stringify(data.service_types || [])}\nRegion Performance: ${JSON.stringify(data.region_data || [])}`;
    } else if (type === "asset_maintenance") {
      systemPrompt = "You are a predictive maintenance analyst. Based on the asset data and service history, predict when maintenance will be needed and provide recommendations.";
      userPrompt = `Analyze this asset for maintenance predictions:\n\nAsset: ${data.name}\nType: ${data.asset_type}\nInstall Date: ${data.install_date}\nWarranty Expiry: ${data.warranty_expiry}\nService History: ${JSON.stringify(data.service_history || [])}`;
    }

    const response = await aiChatCompletion({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      stream: true,
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted. Please add funds in Settings > Workspace > Usage." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
