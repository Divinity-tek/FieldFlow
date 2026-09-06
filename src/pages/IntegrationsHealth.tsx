import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Activity, CheckCircle2, XCircle, AlertTriangle, Loader2, RefreshCw,
  Database, ShieldCheck, Radio, HardDrive, Cpu, Bell, Server, Globe, Save, KeyRound,
} from "lucide-react";

interface AiConfig {
  provider: string;
  model: string;
  vision_model: string;
  base_url: string;
  has_api_key: boolean;
}

const PROVIDER_HINTS: Record<string, { base: string; model: string; needsKey: boolean }> = {
  ollama: { base: "http://localhost:11434/v1", model: "llama3.1", needsKey: false },
  groq: { base: "https://api.groq.com/openai/v1", model: "llama-3.3-70b-versatile", needsKey: true },
  gemini: { base: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-2.0-flash", needsKey: true },
};

function AiConfigForm({ onSaved }: { onSaved: () => void }) {
  const [cfg, setCfg] = useState<AiConfig>({ provider: "ollama", model: "", vision_model: "", base_url: "", has_api_key: false });
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase.rpc as any)("get_ai_config");
    if (!error && data && data[0]) {
      const r = data[0] as any;
      setCfg({ provider: r.provider || "ollama", model: r.model || "", vision_model: r.vision_model || "", base_url: r.base_url || "", has_api_key: !!r.has_api_key });
    }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const hint = PROVIDER_HINTS[cfg.provider] || PROVIDER_HINTS.ollama;

  const save = async () => {
    setSaving(true);
    const { error } = await (supabase.rpc as any)("set_ai_config", {
      p_provider: cfg.provider,
      p_model: cfg.model || null,
      p_vision_model: cfg.vision_model || null,
      p_base_url: cfg.base_url || null,
      p_api_key: apiKey || null, // empty => keep existing key
    });
    setSaving(false);
    if (error) { toast.error("Save failed: " + error.message); return; }
    toast.success("AI configuration saved");
    setApiKey("");
    await load();
    onSaved();
  };

  const input = "w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20";

  return (
    <div className="rounded-xl border border-border bg-card p-4 mb-6">
      <div className="flex items-center gap-2 mb-1">
        <Cpu className="w-5 h-5 text-primary" />
        <h2 className="text-sm font-semibold">AI provider configuration</h2>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Saved to the database and used by all AI features. The API key is write-only — it is never displayed back.
      </p>

      {loading ? (
        <div className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="text-xs font-medium">Provider
            <select className={input} value={cfg.provider}
              onChange={(e) => setCfg({ ...cfg, provider: e.target.value })}>
              <option value="ollama">Ollama (local)</option>
              <option value="groq">Groq</option>
              <option value="gemini">Gemini</option>
            </select>
          </label>
          <label className="text-xs font-medium">Chat model
            <input className={input} value={cfg.model} placeholder={hint.model} autoComplete="off"
              onChange={(e) => setCfg({ ...cfg, model: e.target.value })} />
          </label>
          <label className="text-xs font-medium">Vision model (OCR)
            <input className={input} value={cfg.vision_model} placeholder="defaults to chat model" autoComplete="off"
              onChange={(e) => setCfg({ ...cfg, vision_model: e.target.value })} />
          </label>
          <label className="text-xs font-medium">Base URL
            <input className={input} value={cfg.base_url} placeholder={hint.base} autoComplete="off"
              onChange={(e) => setCfg({ ...cfg, base_url: e.target.value })} />
          </label>
          <label className="text-xs font-medium sm:col-span-2">
            <span className="flex items-center gap-1"><KeyRound className="w-3.5 h-3.5" /> API key {hint.needsKey ? "(required)" : "(not needed for Ollama)"}</span>
            <input className={input} type="password" value={apiKey} autoComplete="new-password" name="ai-provider-key"
              placeholder={cfg.has_api_key ? "•••••••• (a key is saved — leave blank to keep)" : "Paste key to save (write-only)"}
              onChange={(e) => setApiKey(e.target.value)} />
          </label>
          <div className="sm:col-span-2 flex items-center gap-3">
            <button onClick={save} disabled={saving}
              className="gradient-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
            </button>
            <span className="text-xs text-muted-foreground">{cfg.has_api_key ? "A key is currently stored." : "No key stored yet."}</span>
          </div>
        </div>
      )}
    </div>
  );
}

type Status = "idle" | "running" | "ok" | "fail" | "not_configured";

interface Check {
  id: string;
  label: string;
  icon: React.ElementType;
  status: Status;
  detail: string;
  latency?: number;
  group: "Frontend" | "Supabase" | "Server-side";
}

const INITIAL: Check[] = [
  { id: "fe_config", label: "Frontend config (.env)", icon: Globe, status: "idle", detail: "", group: "Frontend" },
  { id: "auth", label: "Supabase Auth / session", icon: ShieldCheck, status: "idle", detail: "", group: "Supabase" },
  { id: "db_browser", label: "Database (RLS, browser)", icon: Database, status: "idle", detail: "", group: "Supabase" },
  { id: "realtime", label: "Realtime (websocket)", icon: Radio, status: "idle", detail: "", group: "Supabase" },
  { id: "functions", label: "Edge Functions reachable", icon: Server, status: "idle", detail: "", group: "Server-side" },
  { id: "database", label: "Database (service role)", icon: Database, status: "idle", detail: "", group: "Server-side" },
  { id: "storage", label: "Storage", icon: HardDrive, status: "idle", detail: "", group: "Server-side" },
  { id: "ai", label: "AI provider", icon: Cpu, status: "idle", detail: "", group: "Server-side" },
  { id: "push", label: "Web Push (VAPID)", icon: Bell, status: "idle", detail: "", group: "Server-side" },
];

const STYLES: Record<Status, { ring: string; text: string; Icon: React.ElementType; label: string }> = {
  idle: { ring: "border-border", text: "text-muted-foreground", Icon: Activity, label: "Not run" },
  running: { ring: "border-primary/40", text: "text-primary", Icon: Loader2, label: "Checking…" },
  ok: { ring: "border-green-500/40", text: "text-green-600", Icon: CheckCircle2, label: "OK" },
  fail: { ring: "border-red-500/50", text: "text-red-600", Icon: XCircle, label: "Failed" },
  not_configured: { ring: "border-amber-500/40", text: "text-amber-600", Icon: AlertTriangle, label: "Not configured" },
};

export default function IntegrationsHealth() {
  const [checks, setChecks] = useState<Check[]>(INITIAL);
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState<string | null>(null);

  const set = (id: string, patch: Partial<Check>) =>
    setChecks((cur) => cur.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  const runAll = useCallback(async () => {
    setRunning(true);
    setChecks(INITIAL.map((c) => ({ ...c, status: "running" as Status, detail: "" })));

    // 1. Frontend config
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const pid = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    set("fe_config", {
      status: url && key && pid ? "ok" : "fail",
      detail: url && key && pid ? `Project ${pid}` : "Missing one of VITE_SUPABASE_URL / KEY / PROJECT_ID",
    });

    // 2. Auth session
    try {
      const t0 = performance.now();
      const { data, error } = await supabase.auth.getSession();
      const ms = Math.round(performance.now() - t0);
      set("auth", {
        status: error ? "fail" : data.session ? "ok" : "fail",
        detail: error ? error.message : data.session ? `Session valid (${data.session.user.email})` : "No session",
        latency: ms,
      });
    } catch (e) { set("auth", { status: "fail", detail: String(e) }); }

    // 3. Database via browser (RLS-scoped)
    try {
      const t0 = performance.now();
      const { error } = await supabase.from("user_roles").select("role").limit(1);
      const ms = Math.round(performance.now() - t0);
      set("db_browser", { status: error ? "fail" : "ok", detail: error ? error.message : "Read OK (RLS)", latency: ms });
    } catch (e) { set("db_browser", { status: "fail", detail: String(e) }); }

    // 4. Realtime websocket
    await new Promise<void>((resolve) => {
      const t0 = performance.now();
      let done = false;
      const finish = (status: Status, detail: string) => {
        if (done) return; done = true;
        set("realtime", { status, detail, latency: Math.round(performance.now() - t0) });
        try { supabase.removeChannel(channel); } catch { /* noop */ }
        resolve();
      };
      const channel = supabase.channel("health-" + Date.now());
      channel.subscribe((st) => {
        if (st === "SUBSCRIBED") finish("ok", "Websocket connected");
        else if (st === "CHANNEL_ERROR" || st === "TIMED_OUT") finish("fail", `Realtime ${st}`);
      });
      setTimeout(() => finish("fail", "Realtime timed out (5s)"), 5000);
    });

    // 5. Server-side via health-check edge function
    try {
      const t0 = performance.now();
      const { data, error } = await supabase.functions.invoke("health-check");
      const ms = Math.round(performance.now() - t0);
      if (error) {
        set("functions", { status: "fail", detail: `Not deployed or error: ${error.message}`, latency: ms });
        ["database", "storage", "ai", "push"].forEach((id) =>
          set(id, { status: "fail", detail: "Edge function unavailable" }));
      } else {
        set("functions", { status: "ok", detail: "health-check responded", latency: ms });
        const map: Record<string, any> = {};
        (data?.checks || []).forEach((c: any) => { map[c.id] = c; });
        ["database", "storage", "ai", "push"].forEach((id) => {
          const c = map[id];
          if (c) set(id, { status: c.status as Status, detail: c.detail, latency: c.latency_ms });
          else set(id, { status: "fail", detail: "No result" });
        });
      }
    } catch (e) {
      set("functions", { status: "fail", detail: String(e) });
      ["database", "storage", "ai", "push"].forEach((id) =>
        set(id, { status: "fail", detail: "Edge function unavailable" }));
    }

    setLastRun(new Date().toLocaleString());
    setRunning(false);
  }, []);

  useEffect(() => { runAll(); }, [runAll]);

  const groups = ["Frontend", "Supabase", "Server-side"] as const;
  const okCount = checks.filter((c) => c.status === "ok").length;

  return (
    <div className="p-5 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Activity className="w-6 h-6 text-primary" /> Integrations &amp; Health
        </h1>
        <button
          onClick={runAll}
          disabled={running}
          className="gradient-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 disabled:opacity-50"
        >
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {running ? "Running…" : "Run all checks"}
        </button>
      </div>
      <p className="text-sm text-muted-foreground mb-5">
        {okCount}/{checks.length} healthy{lastRun ? ` · last run ${lastRun}` : ""}. Secret values are never shown — only whether each connection works.
      </p>

      <AiConfigForm onSaved={runAll} />

      {groups.map((g) => (
        <div key={g} className="mb-6">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{g}</h2>
          <div className="grid gap-2">
            {checks.filter((c) => c.group === g).map((c) => {
              const s = STYLES[c.status];
              const RowIcon = c.icon;
              return (
                <div key={c.id} className={`flex items-center gap-3 rounded-xl border ${s.ring} bg-card px-4 py-3`}>
                  <RowIcon className="w-5 h-5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{c.label}</div>
                    {c.detail && <div className="text-xs text-muted-foreground truncate">{c.detail}</div>}
                  </div>
                  {typeof c.latency === "number" && c.status !== "running" && (
                    <span className="text-xs text-muted-foreground tabular-nums">{c.latency} ms</span>
                  )}
                  <span className={`flex items-center gap-1 text-xs font-semibold ${s.text} shrink-0`}>
                    <s.Icon className={`w-4 h-4 ${c.status === "running" ? "animate-spin" : ""}`} />
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <p className="text-xs text-muted-foreground mt-2">
        Server-side checks require the <code>health-check</code> edge function to be deployed
        (<code>supabase functions deploy health-check</code>). AI status reflects the configured
        provider (Ollama / Groq / Gemini) set via Edge Function secrets.
      </p>
    </div>
  );
}
