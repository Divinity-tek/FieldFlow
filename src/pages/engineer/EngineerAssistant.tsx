import { useState, useRef, useEffect, useCallback } from "react";
import EngineerMobileLayout from "@/components/layout/EngineerMobileLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Bot, Send, Loader2, Mic, MicOff, Briefcase, Wallet, Receipt, Map as MapIcon, Store, ListChecks, CheckCircle2, PlayCircle, Flag, Camera, Paperclip, ReceiptText, ChevronDown, ChevronUp, X, Undo2, Cloud, CloudOff, CloudUpload, AlertCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import ProofUploadDialog from "@/components/engineer/ProofUploadDialog";
import ClaimReceiptDialog from "@/components/engineer/ClaimReceiptDialog";
import EngineerJobsMap from "@/components/engineer/EngineerJobsMap";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

type Msg = { role: "user" | "assistant"; content: string };

const ASSISTANT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/engineer-assistant`;

const VOICE_LANGS: Array<[string, string]> = [
  ["en-US", "English (US)"],
  ["en-GB", "English (UK)"],
  ["en-AU", "English (AU)"],
  ["en-IN", "English (IN)"],
  ["es-ES", "Español (ES)"],
  ["es-MX", "Español (MX)"],
  ["fr-FR", "Français"],
  ["de-DE", "Deutsch"],
  ["it-IT", "Italiano"],
  ["pt-BR", "Português (BR)"],
  ["pt-PT", "Português (PT)"],
  ["nl-NL", "Nederlands"],
  ["pl-PL", "Polski"],
  ["ru-RU", "Русский"],
  ["tr-TR", "Türkçe"],
  ["ar-SA", "العربية"],
  ["hi-IN", "हिन्दी"],
  ["zh-CN", "中文 (简体)"],
  ["zh-TW", "中文 (繁體)"],
  ["ja-JP", "日本語"],
  ["ko-KR", "한국어"],
];
const SUPPORTED_VOICE_CODES = new Set(VOICE_LANGS.map(([c]) => c));

const quickActions = [
  { label: "Today's jobs", icon: Briefcase, prompt: "Show me my jobs scheduled for today, sorted by start time." },
  { label: "Accept a job", icon: CheckCircle2, prompt: "List my pending jobs so I can accept one. Then ask which job ID to accept and call accept_job." },
  { label: "Start a job", icon: PlayCircle, prompt: "List my assigned jobs that are ready to start, then ask which one and call start_job." },
  { label: "Complete a job", icon: Flag, prompt: "List my in-progress jobs, then ask which one to mark completed and call complete_job." },
  { label: "Upload work proof", icon: Camera, action: "proof" as const },
  { label: "Claim with receipt", icon: ReceiptText, action: "receipt" as const },
  { label: "Earnings this month", icon: Wallet, prompt: "Summarize my earnings for the past month — net, paid, outstanding, and claims." },
  { label: "Optimize my route", icon: MapIcon, prompt: "Suggest the best route for my jobs today." },
  { label: "Browse marketplace", icon: Store, prompt: "Show me 5 open marketplace listings I could apply to." },
  { label: "Submit expense", icon: Receipt, prompt: "Help me submit a transport expense claim for my most recent completed job." },
  { label: "What's pending?", icon: ListChecks, prompt: "List all my jobs that are still pending or in progress." },
];

const EngineerAssistant = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [preVoiceInput, setPreVoiceInput] = useState<string | null>(null);
  const [lastVoiceText, setLastVoiceText] = useState<string | null>(null);
  const [proofOpen, setProofOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(true);
  const [engineerId, setEngineerId] = useState<string | null>(null);
  const [sessionLang, setSessionLang] = useState<string | null>(null);
  const [fallbackOpen, setFallbackOpen] = useState(false);
  const [fallbackInfo, setFallbackInfo] = useState<{ tried: string; reason: string } | null>(null);
  const [fallbackPick, setFallbackPick] = useState<string>("en-US");
  const [voiceLang, setVoiceLang] = useState<string>(() => {
    if (typeof window === "undefined") return "en-US";
    return localStorage.getItem("engineer_assistant_voice_lang") || navigator.language || "en-US";
  });
  const [shortcutsEnabled, setShortcutsEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("engineer_assistant_voice_shortcuts") !== "0";
  });
  const recognitionRef = useRef<any>(null);
  const cancelledRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Per-engineer storage keys for voice preferences
  const langKey = engineerId ? `engineer_assistant_voice_lang:${engineerId}` : null;
  const sessionKey = engineerId ? `engineer_assistant_voice_session_lang:${engineerId}` : null;

  useEffect(() => {
    if (!user) return;
    supabase.from("engineers").select("id").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setEngineerId((data as any)?.id ?? null));
  }, [user]);

  // Load per-engineer voice language preferences once we know the engineer id.
  // Tracks the updated_at of the most recently applied cloud value for conflict resolution.
  // Newest cloud write (by updated_at) always wins — local writes echo through and may be
  // superseded if another device wrote at (nearly) the same time.
  const lastSyncedAtRef = useRef<number>(0);

  // Promise that resolves once the cloud-saved voice language has been fetched
  // for the current engineer/user. startVoice awaits this so a brand new device
  // never starts recognition with the wrong language before the cloud value lands.
  const voiceLangCloudReadyRef = useRef<Promise<void> | null>(null);
  const voiceLangCloudResolveRef = useRef<(() => void) | null>(null);

  const loadVoiceLangFromCloud = useCallback(async () => {
    if (!user?.id || !engineerId) return;
    const cloudKey = `engineer_assistant_voice_lang:${engineerId}`;
    const { data } = await supabase
      .from("user_preferences")
      .select("value, updated_at")
      .eq("user_id", user.id)
      .eq("key", cloudKey)
      .maybeSingle();
    const remote = (data as any)?.value;
    const remoteLang = typeof remote === "string" ? remote : remote?.lang;
    const remoteAt = (data as any)?.updated_at ? new Date((data as any).updated_at).getTime() : 0;
    if (remoteLang && (remoteLang === "auto" || SUPPORTED_VOICE_CODES.has(remoteLang))) {
      if (remoteAt >= lastSyncedAtRef.current) {
        lastSyncedAtRef.current = remoteAt;
        setVoiceLang(remoteLang);
        try {
          localStorage.setItem(cloudKey, remoteLang);
          localStorage.setItem("engineer_assistant_voice_lang", remoteLang);
        } catch {}
      }
    }
  }, [user?.id, engineerId]);

  // Session override stays device-local; saved preference syncs across devices via user_preferences.
  useEffect(() => {
    if (!engineerId) return;
    let cancelled = false;
    try {
      const savedLang = localStorage.getItem(`engineer_assistant_voice_lang:${engineerId}`);
      if (savedLang) setVoiceLang(savedLang);
      const savedSession = localStorage.getItem(`engineer_assistant_voice_session_lang:${engineerId}`);
      if (savedSession) setSessionLang(savedSession);
    } catch {}

    // Pull cloud-synced preference (overrides local cache so it propagates across devices)
    if (!user?.id) return;

    // Reset the readiness gate for this user/engineer combo
    voiceLangCloudReadyRef.current = new Promise<void>((resolve) => {
      voiceLangCloudResolveRef.current = resolve;
    });

    loadVoiceLangFromCloud()
      .catch(() => {})
      .finally(() => {
        if (cancelled) return;
        voiceLangCloudResolveRef.current?.();
      });

    // Realtime: keep this device in sync if the user changes it elsewhere.
    // Conflict resolution: only apply when the incoming row is strictly newer than
    // what we last applied. Equal/older events are ignored (covers our own echo and
    // simultaneous writes where another device's later updated_at wins).
    const cloudKey = `engineer_assistant_voice_lang:${engineerId}`;
    const channel = supabase
      .channel(`voice-lang-sync:${user.id}:${engineerId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_preferences", filter: `user_id=eq.${user.id}` },
        (payload: any) => {
          const row = payload.new ?? payload.old;
          if (!row || row.key !== cloudKey) return;
          const incomingAt = row.updated_at ? new Date(row.updated_at).getTime() : Date.now();
          if (incomingAt <= lastSyncedAtRef.current) return; // older or same — keep current
          const v = row.value;
          const lang = typeof v === "string" ? v : v?.lang;
          if (!lang || (lang !== "auto" && !SUPPORTED_VOICE_CODES.has(lang))) return;
          lastSyncedAtRef.current = incomingAt;
          // If the newer remote value is different from what we have locally, another
          // device won the conflict — surface it so the user knows their last change
          // was overridden by a more recent one.
          setVoiceLang((prev) => {
            if (prev !== lang) {
              toast.message(
                `Voice language updated from another device: ${VOICE_LANGS.find(([c]) => c === lang)?.[1] ?? lang}`,
                { description: "Newest change wins across devices." }
              );
            }
            return lang;
          });
          try {
            localStorage.setItem(cloudKey, lang);
            localStorage.setItem("engineer_assistant_voice_lang", lang);
          } catch {}
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [engineerId, user?.id]);

  // Sync status for the cloud-synced voice language preference
  const [voiceLangSyncStatus, setVoiceLangSyncStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Persist saved voice language to the cloud whenever it changes
  const syncVoiceLangToCloud = useCallback(
    async (lang: string) => {
      if (!user?.id || !engineerId) return;
      const cloudKey = `engineer_assistant_voice_lang:${engineerId}`;
      setVoiceLangSyncStatus("saving");
      const { data, error } = await supabase
        .from("user_preferences")
        .upsert(
          { user_id: user.id, key: cloudKey, value: lang as any },
          { onConflict: "user_id,key" }
        )
        .select("value, updated_at")
        .maybeSingle();
      if (error) {
        setVoiceLangSyncStatus("error");
        return;
      }
      // Conflict resolution: trust the row returned by the database. If another
      // device wrote a newer value at (almost) the same time, the upsert may have
      // overwritten it — but Postgres' returned row is now authoritative, so we
      // re-fetch once more in case our write was the older one and got overridden
      // by a concurrent realtime update arriving after this RPC.
      const authoritative = (data as any)?.value;
      const authoritativeLang = typeof authoritative === "string" ? authoritative : authoritative?.lang;
      const authoritativeAt = (data as any)?.updated_at ? new Date((data as any).updated_at).getTime() : Date.now();
      if (authoritativeLang && authoritativeAt >= lastSyncedAtRef.current) {
        lastSyncedAtRef.current = authoritativeAt;
        if (authoritativeLang !== lang) {
          // Another device's newer value won — adopt it locally.
          setVoiceLang(authoritativeLang);
          try {
            localStorage.setItem(cloudKey, authoritativeLang);
            localStorage.setItem("engineer_assistant_voice_lang", authoritativeLang);
          } catch {}
          toast.message(
            `Kept newer voice language from another device: ${VOICE_LANGS.find(([c]) => c === authoritativeLang)?.[1] ?? authoritativeLang}`,
            { description: "Newest change wins across devices." }
          );
        }
      }
      setVoiceLangSyncStatus("saved");
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => {
        setVoiceLangSyncStatus((s) => (s === "saved" ? "idle" : s));
      }, 2500);
    },
    [user?.id, engineerId]
  );

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isLoading]);

  const sendMessage = useCallback(async (text: string) => {
    const t = text.trim();
    if (!t || isLoading || !user) return;
    const next = [...messages, { role: "user" as const, content: t }];
    setMessages(next);
    setInput("");
    setLastVoiceText(null);
    setPreVoiceInput(null);
    setIsLoading(true);
    try {
      const { data: sessionRes } = await supabase.auth.getSession();
      const token = sessionRes.session?.access_token;
      const resp = await fetch(ASSISTANT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messages: next }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        toast.error(data.error || "Assistant request failed");
        return;
      }
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply || "(no response)" }]);
    } catch (e: any) {
      console.error(e);
      toast.error("Failed to reach assistant");
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading, user]);

  const startVoice = async () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      toast.error("Voice input isn't supported in this browser. Try Chrome or Edge.");
      return;
    }
    // On a fresh device, wait for the cloud-saved language to land before
    // starting recognition. No session override is honored here so the cloud
    // value can win on first use.
    if (!sessionLang && voiceLangCloudReadyRef.current) {
      try {
        await Promise.race([
          voiceLangCloudReadyRef.current,
          new Promise<void>((resolve) => setTimeout(resolve, 1500)),
        ]);
      } catch {}
    }
    // Resolve effective language: session override > auto-detect > stored preference
    let resolvedLang: string;
    if (sessionLang) {
      resolvedLang = sessionLang;
    } else if (voiceLang === "auto") {
      const detected = navigator.languages?.[0] || navigator.language || "";
      if (!detected || !SUPPORTED_VOICE_CODES.has(detected)) {
        // Auto-detect failed — open fallback prompt instead of starting
        setFallbackInfo({ tried: detected || "(none)", reason: "Auto-detect couldn't match a supported language" });
        setFallbackPick("en-US");
        setFallbackOpen(true);
        return;
      }
      resolvedLang = detected;
      const label = VOICE_LANGS.find(([c]) => c === resolvedLang)?.[1] ?? resolvedLang;
      toast.success(`Auto-detected language: ${label}`, {
        description: `Using ${resolvedLang} for this speech session`,
      });
    } else {
      resolvedLang = voiceLang;
    }
    const rec = new SR();
    rec.lang = resolvedLang;
    rec.interimResults = true;
    rec.continuous = true;
    const baseline = input;
    setPreVoiceInput(baseline);
    cancelledRef.current = false;
    let finalText = "";
    rec.onresult = (e: any) => {
      let interim = "";
      let newFinal = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const txt = e.results[i][0].transcript;
        if (e.results[i].isFinal) newFinal += txt;
        else interim += txt;
      }
      if (newFinal) finalText += newFinal;
      setInterimTranscript(interim);
      const combined = (baseline ? baseline + (baseline.endsWith(" ") ? "" : " ") : "") + (finalText + interim).trim();
      setInput(combined);
    };
    rec.onerror = (e: any) => {
      console.error("speech error", e);
      const code = e?.error;
      if (code === "language-not-supported" || code === "bad-grammar") {
        setFallbackInfo({ tried: resolvedLang, reason: `Recognition language "${resolvedLang}" isn't supported here` });
        setFallbackPick(SUPPORTED_VOICE_CODES.has(resolvedLang) ? resolvedLang : "en-US");
        setFallbackOpen(true);
      } else if (code && code !== "no-speech" && code !== "aborted") {
        toast.error(`Voice error: ${code}`);
      }
      setIsListening(false);
      setInterimTranscript("");
    };
    rec.onend = () => {
      setIsListening(false);
      setInterimTranscript("");
      if (cancelledRef.current) {
        setInput(baseline);
        setLastVoiceText(null);
        setPreVoiceInput(null);
        return;
      }
      const spoken = finalText.trim();
      if (spoken) {
        setLastVoiceText(spoken);
      } else {
        setPreVoiceInput(null);
      }
    };
    recognitionRef.current = rec;
    try {
      rec.start();
      setIsListening(true);
    } catch (err) {
      console.error(err);
      toast.error("Could not start voice input");
    }
  };

  const stopVoice = () => {
    cancelledRef.current = false;
    recognitionRef.current?.stop();
  };

  const cancelVoice = () => {
    cancelledRef.current = true;
    recognitionRef.current?.stop();
  };

  const undoVoice = () => {
    if (preVoiceInput === null) return;
    setInput(preVoiceInput);
    setLastVoiceText(null);
    setPreVoiceInput(null);
    toast.success("Reverted last voice input");
  };

  // Keyboard shortcuts: Ctrl/Cmd+Shift+M toggle start/stop, Esc cancel while listening, Ctrl/Cmd+Shift+Z undo
  useEffect(() => {
    if (!shortcutsEnabled) return;
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.shiftKey && (e.key === "M" || e.key === "m")) {
        e.preventDefault();
        if (isListening) stopVoice();
        else startVoice();
        return;
      }
      if (e.key === "Escape" && isListening) {
        e.preventDefault();
        cancelVoice();
        return;
      }
      if (mod && e.shiftKey && (e.key === "Z" || e.key === "z")) {
        if (!isListening && lastVoiceText && preVoiceInput !== null) {
          e.preventDefault();
          undoVoice();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shortcutsEnabled, isListening, lastVoiceText, preVoiceInput, voiceLang, input]);

  return (
    <EngineerMobileLayout title="Assistant">
      <div className="space-y-3">
        <Card className="p-3 bg-primary/5 border-primary/20">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">Engineer Assistant</p>
              <p className="text-xs text-muted-foreground">Ask about jobs, earnings, claims, marketplace, or your route.</p>
            </div>
          </div>
        </Card>

        <div>
          <button
            type="button"
            onClick={() => setMapOpen((v) => !v)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-md bg-card border border-border text-xs font-medium text-foreground hover:bg-accent/50"
          >
            <span className="flex items-center gap-2"><MapIcon className="w-3.5 h-3.5 text-primary" /> Job locations (live)</span>
            {mapOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {mapOpen && (
            <div className="mt-2">
              <EngineerJobsMap engineerId={engineerId} />
            </div>
          )}
        </div>

        {messages.length === 0 && (
          <div className="grid grid-cols-2 gap-2">
            {quickActions.map((a: any) => (
              <button
                key={a.label}
                onClick={() => {
                  if (a.action === "proof") setProofOpen(true);
                  else if (a.action === "receipt") setReceiptOpen(true);
                  else sendMessage(a.prompt);
                }}
                className="flex items-center gap-2 p-3 rounded-lg bg-card border border-border hover:bg-accent/50 active:scale-[0.98] transition text-left"
              >
                <a.icon className="w-4 h-4 text-primary shrink-0" />
                <span className="text-xs font-medium text-foreground">{a.label}</span>
              </button>
            ))}
          </div>
        )}

        <ScrollArea className="h-[55vh] rounded-lg border border-border bg-card">
          <div ref={scrollRef} className="p-3 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                  {m.role === "assistant" ? (
                    <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-ul:my-1 prose-table:text-xs">
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex items-center gap-2 text-muted-foreground text-xs">
                <Loader2 className="w-3 h-3 animate-spin" /> Thinking…
              </div>
            )}
          </div>
        </ScrollArea>

        {(isListening || interimTranscript || lastVoiceText) && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 font-medium text-foreground">
                {isListening ? (
                  <>
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75 animate-ping" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive" />
                    </span>
                    Listening…
                  </>
                ) : (
                  <><Mic className="w-3.5 h-3.5 text-primary" /> Voice transcript ready — review before sending</>
                )}
              </span>
              <div className="flex items-center gap-1">
                {isListening && (
                  <>
                    <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={cancelVoice} aria-label="Cancel voice input">
                      <X className="w-3 h-3 mr-1" /> Cancel
                    </Button>
                    <Button type="button" size="sm" variant="secondary" className="h-6 px-2 text-xs" onClick={stopVoice} aria-label="Stop and keep transcript">
                      Stop
                    </Button>
                  </>
                )}
                {!isListening && lastVoiceText && preVoiceInput !== null && (
                  <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={undoVoice} aria-label="Undo last voice input">
                    <Undo2 className="w-3 h-3 mr-1" /> Undo
                  </Button>
                )}
              </div>
            </div>
            {(interimTranscript || lastVoiceText) && (
              <p className="text-muted-foreground italic break-words">
                {interimTranscript || lastVoiceText}
              </p>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 -mb-1 flex-wrap">
          <label className="text-[11px] text-muted-foreground flex items-center gap-1.5 flex-wrap">
            <Mic className="w-3 h-3" /> Voice language
            {shortcutsEnabled && (
              <span className="hidden sm:inline text-[10px] opacity-70">· ⌘/Ctrl+⇧+M start/stop · Esc cancel · ⌘/Ctrl+⇧+Z undo</span>
            )}
          </label>
          <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer select-none" title="Enable keyboard shortcuts for voice control">
            <input
              type="checkbox"
              checked={shortcutsEnabled}
              onChange={(e) => {
                setShortcutsEnabled(e.target.checked);
                try { localStorage.setItem("engineer_assistant_voice_shortcuts", e.target.checked ? "1" : "0"); } catch {}
              }}
              className="h-3 w-3 accent-primary"
              aria-label="Enable voice keyboard shortcuts"
            />
            Shortcuts
          </label>
          <select
            value={voiceLang}
            onChange={(e) => {
              const next = e.target.value;
              setVoiceLang(next);
              // Manual choice clears any session-only override so the saved preference is what's used.
              setSessionLang(null);
              try {
                if (langKey) localStorage.setItem(langKey, next);
                localStorage.setItem("engineer_assistant_voice_lang", next); // legacy/global fallback
                if (sessionKey) localStorage.removeItem(sessionKey);
              } catch {}
              syncVoiceLangToCloud(next);
              if (isListening) { cancelledRef.current = true; recognitionRef.current?.stop(); }
            }}
            disabled={isListening}
            className="h-7 rounded-md border border-border bg-background text-xs px-2 text-foreground disabled:opacity-50"
            aria-label="Speech recognition language"
          >
            {[["auto", "Auto-detect"] as [string, string], ...VOICE_LANGS].map(([code, label]) => (
              <option key={code} value={code}>{label}{sessionLang && code === sessionLang ? " (session)" : ""}</option>
            ))}
          </select>
          <span
            className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"
            role="status"
            aria-live="polite"
            title={
              voiceLangSyncStatus === "saving" ? "Syncing voice language across devices…"
              : voiceLangSyncStatus === "saved" ? "Voice language synced across devices"
              : voiceLangSyncStatus === "error" ? "Failed to sync voice language"
              : "Voice language sync"
            }
          >
            {voiceLangSyncStatus === "saving" && (<><Loader2 className="h-3 w-3 animate-spin" /> Saving…</>)}
            {voiceLangSyncStatus === "saved" && (<><CloudUpload className="h-3 w-3 text-primary" /> Saved</>)}
            {voiceLangSyncStatus === "error" && (<><AlertCircle className="h-3 w-3 text-destructive" /> <span className="text-destructive">Sync failed</span></>)}
            {voiceLangSyncStatus === "idle" && (user?.id && engineerId ? (<><Cloud className="h-3 w-3" /> Synced</>) : (<><CloudOff className="h-3 w-3" /> Local only</>))}
          </span>
          <button
            type="button"
            onClick={async () => {
              if (isListening) { cancelledRef.current = true; recognitionRef.current?.stop(); }
              const DEFAULT_LANG = "auto";
              setVoiceLang(DEFAULT_LANG);
              setSessionLang(null);
              try {
                if (langKey) localStorage.removeItem(langKey);
                if (sessionKey) localStorage.removeItem(sessionKey);
                localStorage.removeItem("engineer_assistant_voice_lang");
              } catch {}
              if (user?.id && engineerId) {
                setVoiceLangSyncStatus("saving");
                const cloudKey = `engineer_assistant_voice_lang:${engineerId}`;
                const { error } = await supabase
                  .from("user_preferences")
                  .delete()
                  .eq("user_id", user.id)
                  .eq("key", cloudKey);
                if (error) {
                  setVoiceLangSyncStatus("error");
                  toast.error("Couldn't reset cloud preference");
                  return;
                }
                lastSyncedAtRef.current = 0;
                setVoiceLangSyncStatus("saved");
                toast.success("Voice language reset to default (Auto-detect)");
              } else {
                toast.success("Voice language reset to default (Auto-detect)");
              }
            }}
            disabled={isListening}
            className="h-7 rounded-md border border-border bg-background text-[10px] px-2 text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-50"
            title="Clear your saved voice language across devices and revert to Auto-detect"
            aria-label="Reset voice language to default"
          >
            Reset to default
          </button>
        </div>

        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage(input);
              }
            }}
            placeholder={isListening ? "Listening…" : "Ask anything or tap mic to speak"}
            rows={2}
            className="resize-none text-sm"
          />
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={() => setProofOpen(true)}
              aria-label="Upload work proof"
              title="Upload photos or videos as work proof"
            >
              <Paperclip className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={() => setReceiptOpen(true)}
              aria-label="Submit expense claim with receipt"
              title="Submit expense claim with receipt photo"
            >
              <ReceiptText className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant={isListening ? "destructive" : "outline"}
              onClick={isListening ? stopVoice : startVoice}
              aria-label={isListening ? "Stop listening" : "Start voice input"}
              title={isListening ? "Stop and keep transcript" : "Start voice input"}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </Button>
            <Button
              type="button"
              size="icon"
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isLoading}
              aria-label="Send"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <ProofUploadDialog
          open={proofOpen}
          onOpenChange={setProofOpen}
          engineerId={engineerId}
          userId={user?.id ?? ""}
          onUploaded={({ job, files }) => {
            const summary = `📸 Uploaded ${files.length} work-proof file${files.length === 1 ? "" : "s"} to **${job.title}**:\n${files.map((f) => `- ${f.name}`).join("\n")}`;
            setMessages((prev) => [...prev, { role: "assistant", content: summary }]);
          }}
        />

        <ClaimReceiptDialog
          open={receiptOpen}
          onOpenChange={setReceiptOpen}
          engineerId={engineerId}
          onSubmitted={({ job, claim_type, amount, receipts }) => {
            const summary = `🧾 Submitted **${claim_type}** claim of **${amount}** on **${job.title}** with ${receipts.length} receipt photo${receipts.length === 1 ? "" : "s"}. Status: pending review.`;
            setMessages((prev) => [...prev, { role: "assistant", content: summary }]);
          }}
        />

        <Dialog open={fallbackOpen} onOpenChange={setFallbackOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Pick a recognition language</DialogTitle>
              <DialogDescription>
                {fallbackInfo?.reason || "Auto-detect failed"}
                {fallbackInfo?.tried ? <> · tried <span className="font-mono">{fallbackInfo.tried}</span></> : null}.
                Choose a language to use for this session only.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <select
                value={fallbackPick}
                onChange={(e) => setFallbackPick(e.target.value)}
                className="w-full h-9 rounded-md border border-border bg-background text-sm px-2 text-foreground"
                aria-label="Fallback recognition language"
              >
                {VOICE_LANGS.map(([code, label]) => (
                  <option key={code} value={code}>{label}</option>
                ))}
              </select>
              <p className="text-[11px] text-muted-foreground">
                This won't change your saved preference. To make it permanent, pick it from the language menu after the session.
              </p>
            </div>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="ghost" onClick={() => setFallbackOpen(false)}>Cancel</Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setSessionLang(null);
                  setVoiceLang(fallbackPick);
                  try {
                    if (langKey) localStorage.setItem(langKey, fallbackPick);
                    localStorage.setItem("engineer_assistant_voice_lang", fallbackPick);
                    if (sessionKey) localStorage.removeItem(sessionKey);
                  } catch {}
                  syncVoiceLangToCloud(fallbackPick);
                  setFallbackOpen(false);
                  setTimeout(() => startVoice(), 50);
                }}
              >
                Save & start
              </Button>
              <Button
                onClick={() => {
                  setSessionLang(fallbackPick);
                  try { if (sessionKey) localStorage.setItem(sessionKey, fallbackPick); } catch {}
                  setFallbackOpen(false);
                  setTimeout(() => startVoice(), 50);
                }}
              >
                Use for this session
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {sessionLang && (
          <div className="text-[11px] text-muted-foreground flex items-center gap-2">
            <span>Session language override: <span className="font-mono text-foreground">{sessionLang}</span> (remembered until cleared)</span>
            <button
              type="button"
              className="underline hover:text-foreground"
              onClick={() => {
                setSessionLang(null);
                try { if (sessionKey) localStorage.removeItem(sessionKey); } catch {}
              }}
            >
              Clear
            </button>
          </div>
        )}
      </div>
    </EngineerMobileLayout>
  );
};

export default EngineerAssistant;
