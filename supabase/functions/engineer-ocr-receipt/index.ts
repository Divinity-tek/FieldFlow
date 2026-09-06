import { requireUser, corsHeaders } from "../_shared/auth.ts";
import { aiChatCompletion } from "../_shared/ai.ts";

interface ReqBody { image_data_url?: string }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = await requireUser(req);
    if (!auth.ok) return auth.response;

    const { image_data_url } = (await req.json()) as ReqBody;
    if (!image_data_url || !image_data_url.startsWith("data:image/")) {
      return new Response(JSON.stringify({ error: "image_data_url (data:image/...) required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const resp = await aiChatCompletion({
      vision: true,
      messages: [
        {
          role: "system",
          content: "You extract receipt details from an image. Always call the return_receipt tool. Use ISO date YYYY-MM-DD. Categories: materials, fuel, parking, tools, meals, other.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Extract the receipt fields." },
            { type: "image_url", image_url: { url: image_data_url } },
          ],
        },
      ],
      tools: [{
        type: "function",
        function: {
          name: "return_receipt",
          description: "Return parsed receipt fields",
          parameters: {
            type: "object",
            properties: {
              vendor: { type: "string" },
              amount: { type: "number" },
              currency: { type: "string" },
              date: { type: "string", description: "ISO date YYYY-MM-DD" },
              category: { type: "string", enum: ["materials", "fuel", "parking", "tools", "meals", "other"] },
            },
            required: ["amount"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "return_receipt" } },
    });

    if (!resp.ok) {
      if (resp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (resp.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits required" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const t = await resp.text();
      console.error("AI gateway error", resp.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await resp.json();
    const call = data?.choices?.[0]?.message?.tool_calls?.[0];
    let receipt: Record<string, unknown> = {};
    if (call?.function?.arguments) {
      try { receipt = JSON.parse(call.function.arguments); } catch { /* ignore */ }
    }
    return new Response(JSON.stringify({ receipt }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ocr-receipt error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
