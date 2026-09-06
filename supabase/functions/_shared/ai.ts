// Shared, provider-configurable AI client for FieldFlow Edge Functions.
//
// Replaces the previous hard dependency on the Lovable AI gateway.
// All supported providers speak the OpenAI "chat/completions" wire format,
// so a single client works for Ollama (local), Groq, and Gemini.
//
// Configure via Supabase Edge Function secrets:
//   AI_PROVIDER     "ollama" | "groq" | "gemini"   (default: "ollama")
//   AI_API_KEY      provider API key                (not required for ollama)
//   AI_MODEL        chat model id                   (provider default below)
//   AI_VISION_MODEL model id used for image/OCR     (defaults to AI_MODEL)
//   AI_BASE_URL     optional override of the base   (e.g. a custom/self-hosted URL)
//
// Examples:
//   Local Ollama:  AI_PROVIDER=ollama  AI_MODEL=llama3.1
//   Groq:          AI_PROVIDER=groq    AI_API_KEY=gsk_... AI_MODEL=llama-3.3-70b-versatile
//   Gemini:        AI_PROVIDER=gemini  AI_API_KEY=AIza... AI_MODEL=gemini-2.0-flash
//
// Configuration precedence: values saved by an admin in the database
// (public.ai_settings / public.ai_secrets, via the Integrations page) take
// priority; anything not set there falls back to the env vars above.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

type Provider = "ollama" | "groq" | "gemini";

interface ProviderDefaults {
  baseUrl: string;
  model: string;
  visionModel: string;
  requiresKey: boolean;
}

const PROVIDER_DEFAULTS: Record<Provider, ProviderDefaults> = {
  ollama: {
    baseUrl: "http://localhost:11434/v1",
    model: "llama3.1",
    visionModel: "llava",
    requiresKey: false,
  },
  groq: {
    baseUrl: "https://api.groq.com/openai/v1",
    model: "llama-3.3-70b-versatile",
    // Groq vision-capable model; override with AI_VISION_MODEL if needed.
    visionModel: "meta-llama/llama-4-scout-17b-16e-instruct",
    requiresKey: true,
  },
  gemini: {
    // Gemini's OpenAI-compatible endpoint.
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    model: "gemini-2.0-flash",
    visionModel: "gemini-2.0-flash",
    requiresKey: true,
  },
};

export interface AiConfig {
  provider: Provider;
  baseUrl: string;
  apiKey: string;
  model: string;
  visionModel: string;
}

// Reads admin-saved config from the database (service role bypasses RLS).
// Returns null on any error / missing table so we fall back to env vars.
async function loadDbConfig(): Promise<Partial<{
  provider: string; model: string; vision_model: string; base_url: string; api_key: string;
}> | null> {
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !service) return null;
    const sb = createClient(url, service);
    const [{ data: s }, { data: sec }] = await Promise.all([
      sb.from("ai_settings").select("provider,model,vision_model,base_url").limit(1).maybeSingle(),
      sb.from("ai_secrets").select("api_key").limit(1).maybeSingle(),
    ]);
    if (!s && !sec) return null;
    return { ...(s || {}), api_key: (sec as any)?.api_key };
  } catch {
    return null;
  }
}

export async function getAiConfig(): Promise<AiConfig> {
  const db = await loadDbConfig();
  const pick = (dbVal: unknown, env: string) =>
    (typeof dbVal === "string" && dbVal) ? dbVal : Deno.env.get(env);

  const provider = ((pick(db?.provider, "AI_PROVIDER") || "ollama") as string).toLowerCase() as Provider;
  const defaults = PROVIDER_DEFAULTS[provider];
  if (!defaults) {
    throw new Error(`Unsupported AI provider "${provider}". Use one of: ollama, groq, gemini.`);
  }

  const apiKey = (pick(db?.api_key, "AI_API_KEY") || "") as string;
  if (defaults.requiresKey && !apiKey) {
    throw new Error(`An API key is required for provider "${provider}". Set it on the Integrations page or via the AI_API_KEY secret.`);
  }

  const model = (pick(db?.model, "AI_MODEL") || defaults.model) as string;
  return {
    provider,
    baseUrl: ((pick(db?.base_url, "AI_BASE_URL") || defaults.baseUrl) as string).replace(/\/+$/, ""),
    apiKey,
    model,
    visionModel: (pick(db?.vision_model, "AI_VISION_MODEL") || model || defaults.visionModel) as string,
  };
}

export interface ChatOptions {
  messages: unknown[];
  stream?: boolean;
  tools?: unknown;
  tool_choice?: unknown;
  temperature?: number;
  max_tokens?: number;
  response_format?: unknown;
  // Set true to use the configured vision model (image/OCR requests).
  vision?: boolean;
  // Explicit model override; otherwise the configured chat/vision model is used.
  model?: string;
}

/**
 * Calls the configured provider's /chat/completions endpoint and returns the
 * raw fetch Response. Callers that stream can pass `response.body` through;
 * callers that don't can `await response.json()`. The OpenAI-compatible
 * response shape is identical across Ollama, Groq, and Gemini.
 */
export async function aiChatCompletion(opts: ChatOptions): Promise<Response> {
  const cfg = await getAiConfig();
  const model = opts.model || (opts.vision ? cfg.visionModel : cfg.model);

  const body: Record<string, unknown> = {
    model,
    messages: opts.messages,
  };
  if (opts.stream) body.stream = true;
  if (opts.tools) body.tools = opts.tools;
  if (opts.tool_choice) body.tool_choice = opts.tool_choice;
  if (opts.temperature !== undefined) body.temperature = opts.temperature;
  if (opts.max_tokens !== undefined) body.max_tokens = opts.max_tokens;
  if (opts.response_format) body.response_format = opts.response_format;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`;

  return await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}
