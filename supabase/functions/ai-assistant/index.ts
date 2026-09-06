import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { aiChatCompletion } from "../_shared/ai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Authenticate caller using JWT from request
    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: authError } = await userClient.auth.getUser();
    if (authError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const authedUser = userData.user;
    const userId = authedUser.id;

    // Determine role server-side from user_roles (never trust client)
    const sb = createClient(supabaseUrl, serviceKey);
    const { data: rolesRows } = await sb.from("user_roles").select("role").eq("user_id", userId);
    const roles = (rolesRows || []).map((r: any) => r.role);
    const userRole = roles.includes("admin") || roles.includes("team_lead")
      ? "admin"
      : roles.includes("engineer")
      ? "engineer"
      : "client";

    const { messages } = await req.json();

    const isStaff = userRole === "admin"; // admin/team_lead grouped above

    // Resolve the caller's own client/engineer scope first
    let scopedClientId: string | null = null;
    let scopedEngineerId: string | null = null;
    if (userRole === "client") {
      const { data } = await sb.from("clients").select("id").eq("user_id", userId).maybeSingle();
      scopedClientId = (data as any)?.id ?? null;
    } else if (userRole === "engineer") {
      const { data } = await sb.from("engineers").select("id").eq("user_id", userId).maybeSingle();
      scopedEngineerId = (data as any)?.id ?? null;
    }

    // Build per-role queries. Non-staff users never see cross-tenant data.
    const jobsQuery = sb
      .from("jobs")
      .select("id, title, status, priority, service_type, location, created_at, completed_at, total_price, engineer_id, client_id")
      .order("created_at", { ascending: false })
      .limit(100);
    if (userRole === "client") {
      if (scopedClientId) jobsQuery.eq("client_id", scopedClientId);
      else jobsQuery.eq("id", "00000000-0000-0000-0000-000000000000");
    } else if (userRole === "engineer") {
      if (scopedEngineerId) jobsQuery.eq("engineer_id", scopedEngineerId);
      else jobsQuery.eq("id", "00000000-0000-0000-0000-000000000000");
    }

    const ticketsQuery = sb
      .from("tickets")
      .select("id, subject, description, status, priority, category, client_id, assigned_to, job_id, created_at, updated_at, resolved_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (userRole === "client" && scopedClientId) ticketsQuery.eq("client_id", scopedClientId);
    else if (userRole === "engineer" && scopedEngineerId) ticketsQuery.eq("assigned_to", scopedEngineerId);
    else if (!isStaff) ticketsQuery.eq("id", "00000000-0000-0000-0000-000000000000");

    const [jobsRes, ticketsRes, engineersRes, clientsRes, invoicesRes, slaRes] = await Promise.all([
      jobsQuery,
      ticketsQuery,
      isStaff
        ? sb.from("engineers").select("id, specialty, rating, jobs_completed, is_available, location, user_id").limit(50)
        : Promise.resolve({ data: [] as any[] }),
      isStaff
        ? sb.from("clients").select("id, company_name, contact_name, email, user_id").limit(50)
        : (scopedClientId
            ? sb.from("clients").select("id, company_name, contact_name, email, user_id").eq("id", scopedClientId)
            : Promise.resolve({ data: [] as any[] })),
      isStaff
        ? sb.from("invoices").select("id, invoice_number, status, total, paid_at, due_date").order("created_at", { ascending: false }).limit(50)
        : (userRole === "client" && scopedClientId
            ? sb.from("invoices").select("id, invoice_number, status, total, paid_at, due_date").eq("client_id", scopedClientId).order("created_at", { ascending: false }).limit(50)
            : Promise.resolve({ data: [] as any[] })),
      isStaff
        ? sb.from("sla_policies").select("id, name, client_id, priority, response_time_minutes, resolution_time_minutes, is_active").limit(50)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const jobs = jobsRes.data ?? [];
    const engineers = (engineersRes as any).data ?? [];
    const clients = (clientsRes as any).data ?? [];
    const invoices = (invoicesRes as any).data ?? [];
    const tickets = ticketsRes.data ?? [];

    // Build client/engineer name maps
    const clientMap: Record<string, string> = {};
    clients.forEach((c: any) => { clientMap[c.id] = c.company_name; });

    const totalJobs = jobs.length;
    const completedJobs = jobs.filter((j: any) => j.status === "completed").length;
    const pendingJobs = jobs.filter((j: any) => j.status === "pending").length;
    const totalRevenue = invoices.filter((i: any) => i.status === "paid").reduce((s: number, i: any) => s + Number(i.total || 0), 0);
    const availableEngineers = engineers.filter((e: any) => e.is_available).length;
    const overdueInvoices = invoices.filter((i: any) => i.status === "overdue").length;

    // Ticket stats
    const openTickets = tickets.filter((t: any) => t.status === "open").length;
    const inProgressTickets = tickets.filter((t: any) => t.status === "in_progress").length;
    const resolvedTickets = tickets.filter((t: any) => t.status === "resolved" || t.status === "closed").length;

    // Filter tickets for specific user roles
    let userTickets = tickets;
    if (userRole === "client" && userId) {
      const userClient = clients.find((c: any) => c.user_id === userId);
      if (userClient) {
        userTickets = tickets.filter((t: any) => t.client_id === userClient.id);
      }
    } else if (userRole === "engineer" && userId) {
      const userEngineer = engineers.find((e: any) => e.user_id === userId);
      if (userEngineer) {
        userTickets = tickets.filter((t: any) => t.assigned_to === userEngineer.id);
      }
    }

    const platformContext = `
## Platform Data Snapshot

### Key Metrics
- Total Jobs (recent): ${totalJobs} | Completed: ${completedJobs} | Pending: ${pendingJobs}
- Engineers: ${engineers.length} total, ${availableEngineers} available
- Clients: ${clients.length}
- Revenue (paid invoices): £${totalRevenue.toFixed(2)}
- Overdue Invoices: ${overdueInvoices}
- Active SLA Policies: ${(slaRes.data ?? []).filter((s: any) => s.is_active).length}

### Ticket Overview
- Total Tickets: ${tickets.length} | Open: ${openTickets} | In Progress: ${inProgressTickets} | Resolved: ${resolvedTickets}
${userRole === "client" || userRole === "engineer" ? `- Your Tickets: ${userTickets.length}` : ""}

### Recent Tickets (last 15)
${userTickets.slice(0, 15).map((t: any) => `- [${t.status.toUpperCase()}] "${t.subject}" | Priority: ${t.priority} | Category: ${t.category} | Client: ${clientMap[t.client_id] || "Unknown"} | Created: ${new Date(t.created_at).toLocaleDateString()}${t.resolved_at ? " | Resolved: " + new Date(t.resolved_at).toLocaleDateString() : ""}`).join("\n")}

### Recent Jobs (last 10)
${jobs.slice(0, 10).map((j: any) => `- "${j.title}" | ${j.status} | ${j.priority} | ${j.service_type} | £${j.total_price ?? "N/A"}`).join("\n")}

### Engineers
${engineers.slice(0, 10).map((e: any) => `- ${e.specialty} | Rating: ${e.rating} | Jobs Done: ${e.jobs_completed} | Available: ${e.is_available}`).join("\n")}

### Clients
${clients.slice(0, 10).map((c: any) => `- ${c.company_name} (${c.contact_name})`).join("\n")}

### Invoice Summary
- Paid: ${invoices.filter((i: any) => i.status === "paid").length}
- Sent: ${invoices.filter((i: any) => i.status === "sent").length}
- Overdue: ${overdueInvoices}
- Draft: ${invoices.filter((i: any) => i.status === "draft").length}
`;

    let roleContext = "";
    if (userRole === "client") {
      roleContext = `\nYou are helping a CLIENT user. Focus on their tickets, service requests, job status, invoices, and estimates. Be helpful and customer-service oriented. When they ask about ticket status, provide specific details from their tickets listed above. If they want to raise a concern, guide them on what information to include.`;
    } else if (userRole === "engineer") {
      roleContext = `\nYou are helping an ENGINEER user. Focus on their assigned tickets, jobs, schedules, and technical queries. Help them with troubleshooting guidance, job updates, and workload management. When they ask about tickets assigned to them, provide specific details.`;
    } else {
      roleContext = `\nYou are helping an ADMIN/TEAM LEAD user. Provide comprehensive operational insights across all tickets, jobs, engineers, and clients.`;
    }

    const systemPrompt = `You are FieldFlow AI Assistant — an intelligent support chatbot for the FieldFlow service dispatch platform. You have access to real-time platform data including tickets, jobs, and user information.

${platformContext}
${roleContext}

Your capabilities:
1. **Ticket Support**: Check ticket status, summarize open/resolved tickets, help with ticket queries
2. **Job Tracking**: Provide job status updates, assignment info, and scheduling details
3. **Data Analysis**: Analyze trends, engineer performance, revenue, and SLA compliance
4. **Operational Insights**: Identify bottlenecks, suggest optimizations, and flag issues
5. **Recommendations**: Suggest engineer assignments, pricing adjustments, and scheduling improvements
6. **Troubleshooting**: Help engineers with technical guidance and best practices

Guidelines:
- Be concise and actionable. Use bullet points and tables when helpful.
- When referencing data, cite specific numbers from the platform snapshot.
- For ticket queries, always include: ticket subject, status, priority, and any relevant dates.
- If asked about something outside the data snapshot, explain what you can see and suggest where to look.
- Format responses with markdown for readability.
- Be empathetic and professional, especially when handling client complaints or support queries.`;

    const response = await aiChatCompletion({
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
      stream: true,
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds in Settings > Workspace > Usage." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI service unavailable" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-assistant error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
