import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { aiChatCompletion } from "../_shared/ai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are the FieldFlow public assistant on the company landing page.

YOUR ROLE — strictly limited:
1. Answer questions about FieldFlow services: field service management, HVAC, plumbing, electrical, IT, and general maintenance.
2. Explain how the platform works for clients: booking jobs, tracking engineers, getting estimates, invoicing.
3. Help visitors check ticket/job status if they provide a ticket number or email (tell them to log in to the client portal for detailed status).
4. Provide coverage area and pricing tier information (general tiers only — no exact internal pricing).
5. Guide visitors on how to sign up or contact sales.

STRICT RULES — YOU MUST FOLLOW:
- NEVER reveal internal company data: revenue, margins, engineer names/locations, admin settings, database structure, API details, system architecture.
- NEVER act as an admin tool. Refuse any request for admin actions, data exports, user lists, or internal reports.
- NEVER share internal pricing formulas, commission rates, payout details, or financial metrics.
- NEVER discuss other customers' data, jobs, or tickets.
- If asked about anything internal or administrative, politely redirect: "I can only help with service information and general inquiries. For internal matters, please log in to your dashboard."
- Keep responses concise, friendly, and professional.
- If unsure, suggest the visitor contact sales@fieldflow.com or call support.

SERVICE INFORMATION YOU CAN SHARE:
- FieldFlow offers field service management for businesses
- Services include HVAC, plumbing, electrical, IT support, general maintenance
- Features: real-time engineer tracking, digital estimates, invoicing, SLA monitoring
- Client portal available for job tracking, service history, and communication
- Coverage: multiple regions with 24/7 support for urgent requests
- Pricing: tiered plans (Starter, Professional, Enterprise) — direct them to sales for exact pricing`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ reply: "Please send a valid message." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Limit conversation history to prevent abuse
    const recentMessages = messages.slice(-10);

    const response = await aiChatCompletion({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...recentMessages.map((m: { role: string; content: string }) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: String(m.content).slice(0, 2000), // limit input size
        })),
      ],
      max_tokens: 600,
      temperature: 0.4,
    });

    if (!response.ok) {
      console.error("AI gateway error:", response.status);
      return new Response(
        JSON.stringify({ reply: "I'm having trouble connecting right now. Please try again in a moment." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content ?? "I couldn't generate a response. Please try again.";

    return new Response(
      JSON.stringify({ reply }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Landing chat error:", error);
    return new Response(
      JSON.stringify({ reply: "Something went wrong. Please try again or contact support@fieldflow.com." }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
