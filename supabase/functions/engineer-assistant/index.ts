import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { aiChatCompletion } from "../_shared/ai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const tools = [
  {
    type: "function",
    function: {
      name: "get_my_jobs",
      description: "Get jobs assigned to the current engineer, optionally filtered by status.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["pending", "assigned", "in_progress", "completed", "cancelled", "all"], description: "Filter by status, or 'all'" },
          limit: { type: "number", description: "Max number of jobs", default: 20 },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_job_status",
      description: "Change the status of one of the engineer's jobs. Destructive — requires explicit user confirmation. First call with confirm=false to get a preview, then call again with confirm=true after the engineer says yes.",
      parameters: {
        type: "object",
        properties: {
          job_id: { type: "string", description: "Job UUID" },
          new_status: { type: "string", enum: ["assigned", "in_progress", "completed", "cancelled"] },
          notes: { type: "string", description: "Optional notes" },
          confirm: { type: "boolean", description: "Must be true to actually apply the change.", default: false },
        },
        required: ["job_id", "new_status"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "accept_job",
      description: "Accept a pending/offered job. Destructive — requires explicit confirmation (call once with confirm=false to preview, then with confirm=true).",
      parameters: {
        type: "object",
        properties: {
          job_id: { type: "string", description: "Job UUID to accept" },
          confirm: { type: "boolean", default: false },
        },
        required: ["job_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "start_job",
      description: "Mark one of the engineer's jobs as in_progress. Destructive — requires explicit confirmation.",
      parameters: {
        type: "object",
        properties: {
          job_id: { type: "string" },
          confirm: { type: "boolean", default: false },
        },
        required: ["job_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "complete_job",
      description: "Mark one of the engineer's jobs as completed. Destructive — requires explicit confirmation.",
      parameters: {
        type: "object",
        properties: {
          job_id: { type: "string" },
          completion_notes: { type: "string", description: "Optional notes about completion" },
          confirm: { type: "boolean", default: false },
        },
        required: ["job_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_earnings_summary",
      description: "Get the engineer's earnings ledger summary across completed jobs in a time window.",
      parameters: {
        type: "object",
        properties: {
          period: { type: "string", enum: ["week", "month", "quarter", "year", "all"], default: "month" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "submit_expense_claim",
      description: "Submit a reimbursable expense claim for a job. Destructive — requires explicit confirmation (preview first with confirm=false, then confirm=true).",
      parameters: {
        type: "object",
        properties: {
          job_id: { type: "string" },
          claim_type: { type: "string", enum: ["transport", "food", "convenience", "other"] },
          amount: { type: "number", description: "Amount in the platform currency" },
          note: { type: "string" },
          confirm: { type: "boolean", default: false },
        },
        required: ["job_id", "claim_type", "amount"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "browse_marketplace",
      description: "List open marketplace listings the engineer can apply to.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", default: 10 },
          min_pay: { type: "number" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "apply_to_listing",
      description: "Apply to a marketplace listing. Destructive — requires explicit confirmation (preview with confirm=false, then confirm=true after the engineer agrees).",
      parameters: {
        type: "object",
        properties: {
          listing_id: { type: "string" },
          proposed_pay: { type: "number" },
          message: { type: "string" },
          confirm: { type: "boolean", default: false },
        },
        required: ["listing_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "suggest_route",
      description: "Suggest an optimized order for visiting today's scheduled jobs based on scheduled time and location.",
      parameters: { type: "object", properties: {} },
    },
  },
];

async function fetchJobPreview(sb: any, engineerId: string, jobId: string) {
  const { data } = await sb.from("jobs_engineer_safe").select("id,title,status,priority,location,scheduled_at,engineer_id").eq("id", jobId).maybeSingle();
  return data;
}

async function runTool(name: string, args: any, ctx: { sb: any; engineerId: string | null; userId: string }) {
  const { sb, engineerId } = ctx;
  if (!engineerId) return { error: "No engineer profile linked to this user." };
  const confirmed = args.confirm === true;

  switch (name) {
    case "get_my_jobs": {
      let q = sb.from("jobs_engineer_safe").select("id,title,status,priority,service_type,location,scheduled_at,started_at,completed_at,engineer_net,payout_status").eq("engineer_id", engineerId).order("scheduled_at", { ascending: true, nullsFirst: false }).limit(args.limit ?? 20);
      if (args.status && args.status !== "all") q = q.eq("status", args.status);
      const { data, error } = await q;
      if (error) return { error: error.message };
      return { jobs: data };
    }
    case "update_job_status": {
      if (!confirmed) {
        const job = await fetchJobPreview(sb, engineerId, args.job_id);
        if (!job) return { error: "Job not found or not assigned to you." };
        return { needs_confirmation: true, action: "update_job_status", preview: { job, from: job.status, to: args.new_status, notes: args.notes ?? null }, confirm_prompt: `Change "${job.title}" from ${job.status} to ${args.new_status}?` };
      }
      const updates: any = { status: args.new_status };
      if (args.new_status === "in_progress") updates.started_at = new Date().toISOString();
      if (args.new_status === "completed") updates.completed_at = new Date().toISOString();
      if (args.notes) updates.notes = args.notes;
      const { data, error } = await sb.from("jobs").update(updates).eq("id", args.job_id).eq("engineer_id", engineerId).select("id,title,status").maybeSingle();
      if (error) return { error: error.message };
      if (!data) return { error: "Job not found or not assigned to you." };
      return { ok: true, job: data };
    }
    case "accept_job": {
      const { data: job, error: jErr } = await sb.from("jobs_engineer_safe").select("id,title,status,engineer_id,location,scheduled_at").eq("id", args.job_id).maybeSingle();
      if (jErr || !job) return { error: "Job not found" };
      if (job.engineer_id && job.engineer_id !== engineerId) return { error: "This job is assigned to another engineer." };
      // Engineers may only self-assign when the job has been explicitly offered to them,
      // or when they have an approved marketplace application for this job. This prevents
      // bypassing the marketplace review workflow.
      const isOfferedToMe = job.status === "offered" && job.engineer_id === engineerId;
      let hasApprovedApp = false;
      if (!isOfferedToMe) {
        const { data: app } = await sb
          .from("marketplace_applications")
          .select("id,status")
          .eq("job_id", args.job_id)
          .eq("engineer_id", engineerId)
          .eq("status", "accepted")
          .maybeSingle();
        hasApprovedApp = !!app;
      }
      if (!isOfferedToMe && !hasApprovedApp) {
        return { error: "You can only accept jobs explicitly offered to you, or apply via the marketplace and wait for staff approval." };
      }
      if (!confirmed) return { needs_confirmation: true, action: "accept_job", preview: { job }, confirm_prompt: `Accept job "${job.title}"${job.scheduled_at ? ` scheduled ${job.scheduled_at}` : ""}?` };
      const { data, error } = await sb.from("jobs").update({ status: "assigned", engineer_id: engineerId }).eq("id", args.job_id).select("id,title,status").maybeSingle();
      if (error) return { error: error.message };
      return { ok: true, action: "accepted", job: data };
    }
    case "start_job": {
      if (!confirmed) {
        const job = await fetchJobPreview(sb, engineerId, args.job_id);
        if (!job || job.engineer_id !== engineerId) return { error: "Job not found or not assigned to you." };
        return { needs_confirmation: true, action: "start_job", preview: { job }, confirm_prompt: `Start job "${job.title}" now?` };
      }
      const { data, error } = await sb.from("jobs").update({ status: "in_progress", started_at: new Date().toISOString() }).eq("id", args.job_id).eq("engineer_id", engineerId).select("id,title,status").maybeSingle();
      if (error) return { error: error.message };
      if (!data) return { error: "Job not found or not assigned to you." };
      return { ok: true, action: "started", job: data };
    }
    case "complete_job": {
      if (!confirmed) {
        const job = await fetchJobPreview(sb, engineerId, args.job_id);
        if (!job || job.engineer_id !== engineerId) return { error: "Job not found or not assigned to you." };
        return { needs_confirmation: true, action: "complete_job", preview: { job, completion_notes: args.completion_notes ?? null }, confirm_prompt: `Mark "${job.title}" as completed?` };
      }
      const updates: any = { status: "completed", completed_at: new Date().toISOString() };
      if (args.completion_notes) updates.notes = args.completion_notes;
      const { data, error } = await sb.from("jobs").update(updates).eq("id", args.job_id).eq("engineer_id", engineerId).select("id,title,status").maybeSingle();
      if (error) return { error: error.message };
      if (!data) return { error: "Job not found or not assigned to you." };
      return { ok: true, action: "completed", job: data };
    }
    case "get_earnings_summary": {
      const period = args.period ?? "month";
      const since = new Date();
      if (period === "week") since.setDate(since.getDate() - 7);
      else if (period === "month") since.setMonth(since.getMonth() - 1);
      else if (period === "quarter") since.setMonth(since.getMonth() - 3);
      else if (period === "year") since.setFullYear(since.getFullYear() - 1);
      else since.setFullYear(since.getFullYear() - 10);

      const { data: jobs } = await sb.from("jobs_engineer_safe").select("id,title,engineer_net,payout_paid_amount,payout_status,completed_at").eq("engineer_id", engineerId).eq("status", "completed").gte("completed_at", since.toISOString());
      const { data: claims } = await sb.from("job_payout_claims").select("amount,status").eq("engineer_id", engineerId).gte("created_at", since.toISOString());

      const gross = (jobs ?? []).reduce((s: number, j: any) => s + Number(j.engineer_net || 0), 0);
      const paid = (jobs ?? []).reduce((s: number, j: any) => s + Number(j.payout_paid_amount || 0), 0);
      const approvedClaims = (claims ?? []).filter((c: any) => c.status === "approved").reduce((s: number, c: any) => s + Number(c.amount), 0);
      const pendingClaims = (claims ?? []).filter((c: any) => c.status === "pending").reduce((s: number, c: any) => s + Number(c.amount), 0);
      return { period, jobs_count: jobs?.length ?? 0, engineer_net_total: gross, paid_total: paid, outstanding: gross - paid, approved_claims: approvedClaims, pending_claims: pendingClaims };
    }
    case "submit_expense_claim": {
      if (!confirmed) {
        const job = await fetchJobPreview(sb, engineerId, args.job_id);
        return { needs_confirmation: true, action: "submit_expense_claim", preview: { job, claim_type: args.claim_type, amount: args.amount, note: args.note ?? null }, confirm_prompt: `Submit a ${args.claim_type} claim for ${args.amount}${job ? ` on "${job.title}"` : ""}${args.note ? ` (note: ${args.note})` : ""}?` };
      }
      const { data, error } = await sb.from("job_payout_claims").insert({
        job_id: args.job_id,
        engineer_id: engineerId,
        claim_type: args.claim_type,
        amount: args.amount,
        note: args.note ?? null,
      }).select("id,claim_type,amount,status").maybeSingle();
      if (error) return { error: error.message };
      return { ok: true, claim: data };
    }
    case "browse_marketplace": {
      let q = sb.from("marketplace_listings_engineer_safe").select("id,job_id,posted_pay,engineer_net,required_skills,expires_at,status").eq("status", "open").order("created_at", { ascending: false }).limit(args.limit ?? 10);
      if (args.min_pay) q = q.gte("posted_pay", args.min_pay);
      const { data, error } = await q;
      if (error) return { error: error.message };
      const jobIds = (data ?? []).map((l: any) => l.job_id);
      const { data: jobs } = jobIds.length ? await sb.from("jobs_engineer_safe").select("id,title,location,service_type,scheduled_at,priority").in("id", jobIds) : { data: [] };
      const map = Object.fromEntries((jobs ?? []).map((j: any) => [j.id, j]));
      return { listings: (data ?? []).map((l: any) => ({ ...l, job: map[l.job_id] })) };
    }
    case "apply_to_listing": {
      const { data: listing, error: lErr } = await sb.from("marketplace_listings_engineer_safe").select("id,job_id,posted_pay").eq("id", args.listing_id).maybeSingle();
      if (lErr || !listing) return { error: "Listing not found" };
      if (!confirmed) {
        const { data: job } = await sb.from("jobs_engineer_safe").select("id,title,location,scheduled_at").eq("id", listing.job_id).maybeSingle();
        return { needs_confirmation: true, action: "apply_to_listing", preview: { listing, job, proposed_pay: args.proposed_pay ?? null, message: args.message ?? null }, confirm_prompt: `Apply to "${job?.title ?? listing.id}"${args.proposed_pay ? ` at ${args.proposed_pay}` : ""}?` };
      }
      const { data, error } = await sb.from("marketplace_applications").insert({
        listing_id: args.listing_id,
        job_id: listing.job_id,
        engineer_id: engineerId,
        proposed_pay: args.proposed_pay ?? null,
        message: args.message ?? null,
      }).select("id,status").maybeSingle();
      if (error) return { error: error.message };
      return { ok: true, application: data };
    }
    case "suggest_route": {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const end = new Date(); end.setHours(23, 59, 59, 999);
      const { data: jobs } = await sb.from("jobs_engineer_safe").select("id,title,location,latitude,longitude,scheduled_at,priority").eq("engineer_id", engineerId).in("status", ["assigned", "in_progress"]).gte("scheduled_at", start.toISOString()).lte("scheduled_at", end.toISOString());
      if (!jobs || jobs.length === 0) return { jobs: [], suggestion: "No jobs scheduled for today." };
      // Greedy nearest-neighbor by lat/lng if available, else by scheduled time
      const withCoords = jobs.filter((j: any) => j.latitude && j.longitude);
      let ordered: any[] = [];
      if (withCoords.length === jobs.length) {
        const remaining = [...jobs];
        let current = remaining.shift();
        ordered.push(current);
        while (remaining.length) {
          remaining.sort((a: any, b: any) => {
            const da = Math.hypot(a.latitude - current.latitude, a.longitude - current.longitude);
            const db = Math.hypot(b.latitude - current.latitude, b.longitude - current.longitude);
            return da - db;
          });
          current = remaining.shift();
          ordered.push(current);
        }
      } else {
        ordered = [...jobs].sort((a: any, b: any) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
      }
      return { jobs: ordered, method: withCoords.length === jobs.length ? "nearest-neighbor" : "by-time" };
    }
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: authError } = await userClient.auth.getUser();
    if (authError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = userData.user.id;

    const sb = createClient(supabaseUrl, serviceKey);
    const { data: roles } = await sb.from("user_roles").select("role").eq("user_id", userId);
    const isEngineer = (roles ?? []).some((r: any) => r.role === "engineer");
    if (!isEngineer) {
      return new Response(JSON.stringify({ error: "Engineer role required" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data: eng } = await sb.from("engineers").select("id,specialty,rating,jobs_completed,is_available,location").eq("user_id", userId).maybeSingle();
    const engineerId = (eng as any)?.id ?? null;

    const { messages } = await req.json();
    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages array required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const systemPrompt = `You are FieldFlow's Engineer Assistant. You help an engineer manage their jobs, earnings, expense claims, marketplace applications, and daily route.

Engineer profile: ${eng ? JSON.stringify(eng) : "not set up"}.

CRITICAL — two-step confirmation for destructive tools (update_job_status, accept_job, start_job, complete_job, submit_expense_claim, apply_to_listing):
1. First call the tool WITHOUT confirm (or confirm=false). The server will return { needs_confirmation: true, confirm_prompt, preview }.
2. Show the engineer the confirm_prompt + a clear summary of the preview, and ask "Reply 'yes' to confirm or 'no' to cancel." Do NOT call the tool again until the engineer explicitly confirms in their next message.
3. Once they reply yes (or otherwise affirmatively), call the SAME tool again with identical args plus confirm=true to actually execute. If they decline, acknowledge and don't call the tool.
Never set confirm=true on the first call. Never chain confirm=true after a fresh user instruction without an explicit yes.

Be concise. Use markdown. Format job lists as tables when possible. After tool results, give a short helpful summary, never dump raw JSON.`;

    const conversation: any[] = [{ role: "system", content: systemPrompt }, ...messages];
    const toolResults: any[] = [];

    // Tool-calling loop, capped iterations
    for (let i = 0; i < 5; i++) {
      const resp = await aiChatCompletion({ messages: conversation, tools, tool_choice: "auto" });
      if (!resp.ok) {
        if (resp.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again shortly." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (resp.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted. Add funds in Settings > Workspace > Usage." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const t = await resp.text();
        console.error("gateway error", resp.status, t);
        return new Response(JSON.stringify({ error: "AI service unavailable" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const data = await resp.json();
      const msg = data.choices?.[0]?.message;
      if (!msg) break;
      conversation.push(msg);
      const calls = msg.tool_calls ?? [];
      if (!calls.length) {
        return new Response(JSON.stringify({ reply: msg.content ?? "", tool_results: toolResults }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      for (const call of calls) {
        let parsed: any = {};
        try { parsed = JSON.parse(call.function.arguments || "{}"); } catch {}
        const result = await runTool(call.function.name, parsed, { sb, engineerId, userId });
        toolResults.push({ name: call.function.name, args: parsed, result });
        conversation.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
      }
    }

    return new Response(JSON.stringify({ reply: "I performed several actions but couldn't finalize a response. Please try again.", tool_results: toolResults }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("engineer-assistant error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
