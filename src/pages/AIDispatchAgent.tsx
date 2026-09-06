import { useEffect, useMemo, useRef, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, X } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Bot, Send, Shield, Activity, Inbox, Settings as Cog, CheckCircle2, XCircle, Sparkles, FlaskConical, MapPin, Trophy, ArrowRight, GitBranch, FileText, ShieldAlert } from "lucide-react";

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dispatch-agent`;

async function callAgent(action: string, payload: Record<string, unknown> = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const resp = await fetch(FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ action, ...payload }),
  });
  const json = await resp.json();
  if (!resp.ok) throw new Error(json.error || "Agent error");
  return json;
}

type Settings = {
  id: string;
  enabled: boolean;
  autonomy: "suggest" | "auto" | "full";
  weight_skill: number;
  weight_distance: number;
  weight_rating: number;
  weight_experience: number;
  sla_risk_threshold_minutes: number;
  max_auto_assign_radius_km: number;
  require_approval_priorities: string[];
  reassign_scan_enabled: boolean;
  scheduling_enabled: boolean;
};

export default function AIDispatchAgent() {
  const qc = useQueryClient();

  const { data: settings } = useQuery({
    queryKey: ["dispatch-agent-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dispatch_agent_settings" as never)
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as Settings;
    },
  });

  const [local, setLocal] = useState<Settings | null>(null);
  useEffect(() => { if (settings) setLocal(settings); }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async (s: Settings) => {
      const { error } = await supabase
        .from("dispatch_agent_settings" as never)
        .update({
          enabled: s.enabled,
          autonomy: s.autonomy,
          weight_skill: s.weight_skill,
          weight_distance: s.weight_distance,
          weight_rating: s.weight_rating,
          weight_experience: s.weight_experience,
          sla_risk_threshold_minutes: s.sla_risk_threshold_minutes,
          max_auto_assign_radius_km: s.max_auto_assign_radius_km,
          require_approval_priorities: s.require_approval_priorities,
          reassign_scan_enabled: s.reassign_scan_enabled,
          scheduling_enabled: s.scheduling_enabled,
        } as never)
        .eq("id", s.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dispatch-agent-settings"] });
      toast.success("Agent settings saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: actions = [] } = useQuery({
    queryKey: ["dispatch-agent-actions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dispatch_agent_actions" as never)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data as unknown as any[]) || [];
    },
    refetchInterval: 10_000,
  });

  const { data: approvals = [] } = useQuery({
    queryKey: ["dispatch-agent-approvals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dispatch_agent_approvals" as never)
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as unknown as any[]) || [];
    },
    refetchInterval: 10_000,
  });

  // Realtime: live updates for agent actions, approvals, and job lifecycle
  const [liveEvents, setLiveEvents] = useState<{ id: string; type: string; label: string; ts: number }[]>([]);
  const pushLive = (e: { type: string; label: string }) =>
    setLiveEvents((prev) => [{ id: crypto.randomUUID(), ts: Date.now(), ...e }, ...prev].slice(0, 25));

  // Lifecycle payload preview: exact event the agent receives
  type LifecycleEvent = {
    id: string;
    ts: number;
    source: "trigger" | "agent";
    event: string;
    jobId?: string;
    old?: Record<string, unknown> | null;
    new?: Record<string, unknown> | null;
    agentAction?: string;
    agentStatus?: string;
    agentReasoning?: string;
    payload: Record<string, unknown>;
  };
  const [lifecycleEvents, setLifecycleEvents] = useState<LifecycleEvent[]>([]);
  const pushLifecycle = (e: Omit<LifecycleEvent, "id" | "ts">) =>
    setLifecycleEvents((prev) =>
      [{ id: crypto.randomUUID(), ts: Date.now(), ...e }, ...prev].slice(0, 50)
    );

  // Seed from recent lifecycle_* agent actions
  useQuery({
    queryKey: ["dispatch-agent-lifecycle-seed"],
    queryFn: async () => {
      const { data } = await supabase
        .from("dispatch_agent_actions" as never)
        .select("*")
        .like("action_type", "lifecycle_%")
        .order("created_at", { ascending: false })
        .limit(20);
      const rows = (data as unknown as any[]) || [];
      setLifecycleEvents(
        rows.map((r) => ({
          id: r.id,
          ts: new Date(r.created_at).getTime(),
          source: "agent" as const,
          event: r.action_type.replace(/^lifecycle_/, ""),
          jobId: r.job_id,
          agentAction: r.action_type,
          agentStatus: r.status,
          agentReasoning: r.reasoning,
          old: r.payload?.old_status ? { status: r.payload.old_status } : null,
          new: r.payload?.new_status ? { status: r.payload.new_status } : null,
          payload: r.payload || {},
        }))
      );
      return rows;
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("dispatch-agent-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "dispatch_agent_actions" }, (p) => {
        const r: any = p.new;
        pushLive({ type: r.action_type, label: `${r.action_type.replace(/_/g, " ")} · ${r.status}` });
        if (typeof r.action_type === "string" && r.action_type.startsWith("lifecycle_")) {
          pushLifecycle({
            source: "agent",
            event: r.action_type.replace(/^lifecycle_/, ""),
            jobId: r.job_id,
            agentAction: r.action_type,
            agentStatus: r.status,
            agentReasoning: r.reasoning,
            old: r.payload?.old_status ? { status: r.payload.old_status } : null,
            new: r.payload?.new_status ? { status: r.payload.new_status } : null,
            payload: r.payload || {},
          });
        }
        qc.invalidateQueries({ queryKey: ["dispatch-agent-actions"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "dispatch_agent_approvals" }, (p) => {
        const r: any = p.new || p.old;
        pushLive({ type: "approval", label: `Approval ${(p.new as any)?.status || "updated"} · job ${String(r?.job_id || "").slice(0, 8)}` });
        qc.invalidateQueries({ queryKey: ["dispatch-agent-approvals"] });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "jobs" }, (p) => {
        const r: any = p.new;
        pushLive({ type: "job_created", label: `New job: ${r.title || r.id?.slice(0, 8)}` });
        pushLifecycle({
          source: "trigger",
          event: "created",
          jobId: r.id,
          old: null,
          new: r,
          payload: { action: "lifecycle", event: "created", jobId: r.id, old: null, new: r },
        });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "jobs" }, (p) => {
        const o: any = p.old, n: any = p.new;
        let event = "updated";
        if (o.status !== n.status) {
          event = "status_changed";
          pushLive({ type: "job_status", label: `Job ${String(n.id).slice(0,8)}: ${o.status} → ${n.status}` });
        } else if (o.is_delayed !== n.is_delayed && n.is_delayed) {
          event = "sla_risk";
          pushLive({ type: "sla", label: `SLA risk on job ${String(n.id).slice(0,8)}` });
        } else if (o.engineer_id !== n.engineer_id) {
          event = "reassigned";
          pushLive({ type: "reassign", label: `Job ${String(n.id).slice(0,8)} reassigned` });
        } else if (o.scheduled_at !== n.scheduled_at) {
          event = "rescheduled";
        }
        pushLifecycle({
          source: "trigger",
          event,
          jobId: n.id,
          old: o,
          new: n,
          payload: { action: "lifecycle", event, jobId: n.id, old: o, new: n },
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  // Lifecycle preview filters
  const [lcFilter, setLcFilter] = useState<string>("all");
  const filteredLifecycle = useMemo(
    () => lifecycleEvents.filter((e) => lcFilter === "all" || e.event === lcFilter),
    [lifecycleEvents, lcFilter]
  );
  const lcEventTypes = useMemo(
    () => Array.from(new Set(lifecycleEvents.map((e) => e.event))),
    [lifecycleEvents]
  );

  const decideApproval = async (id: string, decision: "approve" | "reject") => {
    try {
      await callAgent(decision, { approvalId: id });
      toast.success(`Approval ${decision}d`);
      qc.invalidateQueries({ queryKey: ["dispatch-agent-approvals"] });
      qc.invalidateQueries({ queryKey: ["dispatch-agent-actions"] });
    } catch (e) { toast.error((e as Error).message); }
  };

  const runScan = async () => {
    try {
      const r = await callAgent("reassign-scan");
      toast.success(`Scanned ${r.scanned} jobs`);
      qc.invalidateQueries({ queryKey: ["dispatch-agent-actions"] });
      qc.invalidateQueries({ queryKey: ["dispatch-agent-approvals"] });
    } catch (e) { toast.error((e as Error).message); }
  };

  // Audit filters
  const [fAction, setFAction] = useState<string>("all");
  const [fStatus, setFStatus] = useState<string>("all");
  const [fAutonomy, setFAutonomy] = useState<string>("all");
  const [fJob, setFJob] = useState<string>("");

  const actionTypes = useMemo(
    () => Array.from(new Set(actions.map((a: any) => a.action_type).filter(Boolean))),
    [actions]
  );
  const statuses = useMemo(
    () => Array.from(new Set(actions.map((a: any) => a.status).filter(Boolean))),
    [actions]
  );
  const autonomies = useMemo(
    () => Array.from(new Set(actions.map((a: any) => a.autonomy).filter(Boolean))),
    [actions]
  );

  const filteredActions = useMemo(() => {
    const j = fJob.trim().toLowerCase();
    return (actions as any[]).filter((a) => {
      if (fAction !== "all" && a.action_type !== fAction) return false;
      if (fStatus !== "all" && a.status !== fStatus) return false;
      if (fAutonomy !== "all" && a.autonomy !== fAutonomy) return false;
      if (j && !String(a.job_id ?? "").toLowerCase().includes(j)) return false;
      return true;
    });
  }, [actions, fAction, fStatus, fAutonomy, fJob]);

  const clearFilters = () => { setFAction("all"); setFStatus("all"); setFAutonomy("all"); setFJob(""); };

  const exportCsv = () => {
    const cols = ["created_at", "action_type", "status", "autonomy", "job_id", "engineer_id", "score", "reasoning"];
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = [cols.join(","), ...filteredActions.map((a: any) => cols.map((c) => esc(a[c])).join(","))];
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `dispatch-agent-audit-${new Date().toISOString()}.csv`; link.click();
    URL.revokeObjectURL(url);
  };

  // Trace view: select a job and merge lifecycle → actions → approvals → audit
  const [traceJobId, setTraceJobId] = useState<string>("");

  // Job picker: jobs that have any agent activity, most recent first
  const { data: traceJobs = [] } = useQuery({
    queryKey: ["trace-jobs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("dispatch_agent_actions" as never)
        .select("job_id, created_at")
        .not("job_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(200);
      const seen = new Set<string>();
      const ids: { job_id: string; created_at: string }[] = [];
      for (const r of ((data as unknown as any[]) || [])) {
        if (r.job_id && !seen.has(r.job_id)) {
          seen.add(r.job_id);
          ids.push(r);
        }
      }
      if (!ids.length) return [] as { id: string; title: string; status: string; created_at: string }[];
      const { data: jobs } = await supabase
        .from("jobs")
        .select("id, title, status")
        .in("id", ids.map((i) => i.job_id));
      const byId = new Map((jobs || []).map((j: any) => [j.id, j]));
      return ids.map((i) => ({
        id: i.job_id,
        title: byId.get(i.job_id)?.title || `Job ${i.job_id.slice(0, 8)}`,
        status: byId.get(i.job_id)?.status || "unknown",
        created_at: i.created_at,
      }));
    },
  });

  useEffect(() => {
    if (!traceJobId && traceJobs[0]) setTraceJobId(traceJobs[0].id);
  }, [traceJobs, traceJobId]);

  const { data: traceActions = [] } = useQuery({
    queryKey: ["trace-actions", traceJobId],
    enabled: !!traceJobId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dispatch_agent_actions" as never)
        .select("*")
        .eq("job_id", traceJobId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data as unknown as any[]) || [];
    },
  });

  const { data: traceApprovals = [] } = useQuery({
    queryKey: ["trace-approvals", traceJobId],
    enabled: !!traceJobId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dispatch_agent_approvals" as never)
        .select("*")
        .eq("job_id", traceJobId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data as unknown as any[]) || [];
    },
  });

  const { data: traceAudit = [] } = useQuery({
    queryKey: ["trace-audit", traceJobId],
    enabled: !!traceJobId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("entity_type", "job")
        .eq("entity_id", traceJobId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  // Group everything into clusters anchored by lifecycle_* triggers
  type TraceItem =
    | { kind: "action"; ts: string; row: any }
    | { kind: "approval"; ts: string; row: any }
    | { kind: "audit"; ts: string; row: any };
  type TraceCluster = {
    id: string;
    trigger: any | null;
    items: TraceItem[];
    approvalIds: string[];
  };

  const traceClusters = useMemo<TraceCluster[]>(() => {
    if (!traceJobId) return [];
    const allActions: TraceItem[] = traceActions.map((a) => ({ kind: "action" as const, ts: a.created_at, row: a }));
    const allApprovals: TraceItem[] = traceApprovals.map((a) => ({ kind: "approval" as const, ts: a.created_at, row: a }));
    const allAudit: TraceItem[] = traceAudit.map((a) => ({ kind: "audit" as const, ts: a.created_at, row: a }));

    // Build clusters anchored by lifecycle_* actions; everything between two triggers belongs to the previous one
    const triggers = traceActions
      .filter((a) => typeof a.action_type === "string" && a.action_type.startsWith("lifecycle_"))
      .map((a) => ({ id: a.id, ts: a.created_at, row: a }));

    if (triggers.length === 0) {
      // Single bucket
      const items = [...allActions, ...allApprovals, ...allAudit].sort(
        (a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime(),
      );
      return [{ id: "ungrouped", trigger: null, items, approvalIds: traceApprovals.map((a) => a.id) }];
    }

    const clusters: TraceCluster[] = triggers.map((t, i) => {
      const start = new Date(t.ts).getTime();
      const end = i + 1 < triggers.length ? new Date(triggers[i + 1].ts).getTime() : Infinity;
      const inRange = (ts: string) => {
        const x = new Date(ts).getTime();
        return x >= start && x < end;
      };
      const items = [
        ...allActions.filter((x) => x.row.id !== t.id && inRange(x.ts)),
        ...allApprovals.filter((x) => inRange(x.ts)),
        ...allAudit.filter((x) => inRange(x.ts)),
      ].sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
      const approvalIds = items
        .filter((x) => x.kind === "action")
        .map((x: any) => x.row?.payload?.approval_id)
        .filter(Boolean);
      return { id: t.id, trigger: t.row, items, approvalIds };
    });

    // Anything before the first trigger → pre-cluster
    const firstTs = new Date(triggers[0].ts).getTime();
    const pre = [...allActions, ...allApprovals, ...allAudit].filter(
      (x) => new Date(x.ts).getTime() < firstTs,
    ).sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
    if (pre.length) clusters.unshift({ id: "pre", trigger: null, items: pre, approvalIds: [] });
    return clusters;
  }, [traceJobId, traceActions, traceApprovals, traceAudit]);

  // Realtime: refresh trace queries when this job ticks
  useEffect(() => {
    if (!traceJobId) return;
    const ch = supabase
      .channel(`trace-${traceJobId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "dispatch_agent_actions", filter: `job_id=eq.${traceJobId}` }, () => {
        qc.invalidateQueries({ queryKey: ["trace-actions", traceJobId] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "dispatch_agent_approvals", filter: `job_id=eq.${traceJobId}` }, () => {
        qc.invalidateQueries({ queryKey: ["trace-approvals", traceJobId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [traceJobId, qc]);

  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const chatEnd = useRef<HTMLDivElement>(null);
  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async () => {
    if (!input.trim() || sending) return;
    const msg = input.trim();
    setInput("");
    setMessages((m) => [...m, { role: "user", content: msg }]);
    setSending(true);
    try {
      const r = await callAgent("chat", { message: msg });
      setMessages((m) => [...m, { role: "assistant", content: r.reply }]);
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setSending(false); }
  };

  // Simulation
  const { data: simJobs = [] } = useQuery({
    queryKey: ["sim-jobs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select("id, title, priority, service_type, status, location")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data as any[]) || [];
    },
  });
  const [simJobId, setSimJobId] = useState<string>("");
  const [simResult, setSimResult] = useState<any | null>(null);
  const [simLoading, setSimLoading] = useState(false);

  const runSim = async () => {
    if (!simJobId) return;
    setSimLoading(true); setSimResult(null);
    try {
      const r = await callAgent("simulate", { jobId: simJobId });
      setSimResult(r);
    } catch (e) { toast.error((e as Error).message); }
    finally { setSimLoading(false); }
  };

  const applySim = async () => {
    if (!simJobId) return;
    try {
      const r = await callAgent("assign", { jobId: simJobId, override: true });
      toast.success(r.status === "pending_approval" ? "Queued for approval" : "Assignment applied");
      qc.invalidateQueries({ queryKey: ["dispatch-agent-actions"] });
      qc.invalidateQueries({ queryKey: ["dispatch-agent-approvals"] });
    } catch (e) { toast.error((e as Error).message); }
  };

  if (!local) {
    return (
      <AppLayout title="AI Dispatch Agent">
        <div className="p-8 text-muted-foreground">Loading agent…</div>
      </AppLayout>
    );
  }

  const togglePriority = (p: string) => {
    const has = local.require_approval_priorities.includes(p);
    setLocal({
      ...local,
      require_approval_priorities: has
        ? local.require_approval_priorities.filter((x) => x !== p)
        : [...local.require_approval_priorities, p],
    });
  };

  return (
    <AppLayout title="AI Dispatch Agent" subtitle="End-to-end intelligent dispatch with admin override">
      <div className="space-y-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Bot className="w-7 h-7 text-primary" /> AI Dispatch Agent
            </h1>
            <p className="text-muted-foreground mt-1 max-w-2xl">
              Autonomous assignment, SLA-risk reassignment, route optimization, and
              conversational triage — fully under your control.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={local.enabled ? "default" : "secondary"} className="text-xs">
              {local.enabled ? "Active" : "Disabled"}
            </Badge>
            <Badge variant="outline" className="text-xs uppercase">{local.autonomy}</Badge>
            <Switch
              checked={local.enabled}
              onCheckedChange={(v) => {
                const next = { ...local, enabled: v };
                setLocal(next);
                saveMutation.mutate(next);
              }}
            />
          </div>
        </div>

        {/* Live activity strip */}
        <Card className="border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
              Live agent activity
              <span className="text-xs text-muted-foreground font-normal">
                (real-time job & agent events)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {liveEvents.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Listening for job lifecycle events… create or update a job to see automatic triggers here.
              </p>
            ) : (
              <ScrollArea className="h-24">
                <div className="space-y-1">
                  {liveEvents.map((e) => (
                    <div key={e.id} className="text-xs flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] uppercase">{e.type}</Badge>
                      <span className="flex-1 truncate">{e.label}</span>
                      <span className="text-muted-foreground shrink-0">
                        {new Date(e.ts).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        <Tabs defaultValue="control">
          <TabsList>
            <TabsTrigger value="control"><Cog className="w-4 h-4 mr-1" />Controls</TabsTrigger>
            <TabsTrigger value="approvals">
              <Inbox className="w-4 h-4 mr-1" />Approvals
              {approvals.length > 0 && <Badge variant="destructive" className="ml-2">{approvals.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="simulate"><FlaskConical className="w-4 h-4 mr-1" />Simulate</TabsTrigger>
            <TabsTrigger value="lifecycle"><Activity className="w-4 h-4 mr-1" />Lifecycle</TabsTrigger>
            <TabsTrigger value="audit"><Activity className="w-4 h-4 mr-1" />Audit log</TabsTrigger>
            <TabsTrigger value="trace"><GitBranch className="w-4 h-4 mr-1" />Trace</TabsTrigger>
            <TabsTrigger value="chat"><Sparkles className="w-4 h-4 mr-1" />Chat</TabsTrigger>
          </TabsList>

          {/* CONTROLS */}
          <TabsContent value="control" className="space-y-6">
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Shield className="w-4 h-4" />Autonomy</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {(["suggest", "auto", "full"] as const).map((a) => (
                    <button
                      key={a}
                      onClick={() => setLocal({ ...local, autonomy: a })}
                      className={`text-left p-4 rounded-lg border transition-colors ${
                        local.autonomy === a ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                      }`}
                    >
                      <div className="font-semibold capitalize">{a}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {a === "suggest" && "Recommend only — admin approves every action"}
                        {a === "auto" && "Auto-act, with approval for risky actions"}
                        {a === "full" && "Fully autonomous — exceptions only"}
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Scoring weights</CardTitle></CardHeader>
              <CardContent className="space-y-5">
                {([
                  ["weight_skill", "Skill match", 100],
                  ["weight_distance", "Distance", 100],
                  ["weight_rating", "Rating", 100],
                  ["weight_experience", "Experience", 50],
                ] as const).map(([k, label, max]) => (
                  <div key={k}>
                    <div className="flex justify-between text-sm mb-2">
                      <Label>{label}</Label>
                      <span className="text-muted-foreground">{(local as any)[k]}</span>
                    </div>
                    <Slider
                      value={[(local as any)[k]]}
                      onValueChange={([v]) => setLocal({ ...local, [k]: v } as Settings)}
                      max={max}
                      step={1}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Thresholds & guardrails</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>SLA risk threshold (minutes)</Label>
                    <Input
                      type="number"
                      value={local.sla_risk_threshold_minutes}
                      onChange={(e) => setLocal({ ...local, sla_risk_threshold_minutes: Number(e.target.value) })}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Trigger reassignment if SLA target is closer than this.
                    </p>
                  </div>
                  <div>
                    <Label>Max auto-assign radius (km)</Label>
                    <Input
                      type="number"
                      value={local.max_auto_assign_radius_km}
                      onChange={(e) => setLocal({ ...local, max_auto_assign_radius_km: Number(e.target.value) })}
                    />
                  </div>
                </div>
                <Separator />
                <div>
                  <Label>Require approval for priorities</Label>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {["urgent", "high", "medium", "low"].map((p) => (
                      <Badge
                        key={p}
                        onClick={() => togglePriority(p)}
                        variant={local.require_approval_priorities.includes(p) ? "default" : "outline"}
                        className="cursor-pointer capitalize"
                      >
                        {p}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">SLA reassign scanner</div>
                    <p className="text-xs text-muted-foreground">Continuously scan in-flight jobs for SLA risk.</p>
                  </div>
                  <Switch
                    checked={local.reassign_scan_enabled}
                    onCheckedChange={(v) => setLocal({ ...local, reassign_scan_enabled: v })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">Smart scheduling</div>
                    <p className="text-xs text-muted-foreground">Optimize daily route order per engineer.</p>
                  </div>
                  <Switch
                    checked={local.scheduling_enabled}
                    onCheckedChange={(v) => setLocal({ ...local, scheduling_enabled: v })}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={runScan}>Run SLA scan now</Button>
              <Button onClick={() => saveMutation.mutate(local)} disabled={saveMutation.isPending}>
                Save settings
              </Button>
            </div>
          </TabsContent>

          {/* APPROVALS */}
          <TabsContent value="approvals">
            <Card>
              <CardHeader><CardTitle className="text-base">Pending approvals ({approvals.length})</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {approvals.length === 0 && (
                  <p className="text-sm text-muted-foreground">No actions waiting for approval.</p>
                )}
                {approvals.map((a) => (
                  <div key={a.id} className="p-4 rounded-lg border flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">Job {String(a.job_id).slice(0, 8)}…</div>
                      <div className="text-xs text-muted-foreground mt-1">{a.reason}</div>
                      <div className="text-xs mt-1">
                        Recommend engineer <span className="font-mono">{String(a.recommended_engineer_id).slice(0, 8)}…</span> · score <strong>{a.score}</strong>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button size="sm" variant="outline" onClick={() => decideApproval(a.id, "reject")}>
                        <XCircle className="w-4 h-4" /> Reject
                      </Button>
                      <Button size="sm" onClick={() => decideApproval(a.id, "approve")}>
                        <CheckCircle2 className="w-4 h-4" /> Approve
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* SIMULATE */}
          <TabsContent value="simulate" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FlaskConical className="w-4 h-4 text-primary" /> Dry-run dispatch
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Pick a job and preview the engineer ranking, route, and outcome the agent would choose. Nothing is changed until you apply.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-2 items-end">
                  <div>
                    <Label className="text-xs">Job</Label>
                    <Select value={simJobId} onValueChange={setSimJobId}>
                      <SelectTrigger><SelectValue placeholder="Choose a job to simulate…" /></SelectTrigger>
                      <SelectContent>
                        {simJobs.map((j: any) => (
                          <SelectItem key={j.id} value={j.id}>
                            <span className="capitalize text-xs mr-2">[{j.priority || "—"}]</span>
                            {j.title} <span className="text-muted-foreground">· {String(j.id).slice(0, 6)}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={runSim} disabled={!simJobId || simLoading}>
                    {simLoading ? "Simulating…" : "Run simulation"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={applySim}
                    disabled={!simResult?.recommendation}
                    title="Apply the recommended assignment"
                  >
                    Apply <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>

                {!simResult && !simLoading && (
                  <div className="text-sm text-muted-foreground py-8 text-center border rounded-lg border-dashed">
                    Choose a job and click <strong>Run simulation</strong> to preview the agent's decision.
                  </div>
                )}

                {simResult && (
                  <div className="space-y-4">
                    {/* Outcome */}
                    <div className="p-4 rounded-lg border bg-muted/30">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="default" className="capitalize">
                          {simResult.recommendation?.outcome === "would_assign" ? "Would auto-assign" : "Would queue for approval"}
                        </Badge>
                        <Badge variant="outline" className="uppercase text-xs">
                          autonomy: {simResult.settings?.autonomy}
                        </Badge>
                        {simResult.recommendation?.distanceKm != null && (
                          <Badge variant="outline" className="text-xs">
                            <MapPin className="w-3 h-3 mr-1" /> {simResult.recommendation.distanceKm.toFixed(1)} km
                          </Badge>
                        )}
                        {simResult.recommendation?.score != null && (
                          <Badge variant="secondary" className="text-xs">
                            <Trophy className="w-3 h-3 mr-1" /> score {simResult.recommendation.score}
                          </Badge>
                        )}
                      </div>
                      {simResult.recommendation?.reasons?.length > 0 && (
                        <ul className="text-xs text-muted-foreground mt-2 list-disc list-inside">
                          {simResult.recommendation.reasons.map((r: string, i: number) => <li key={i}>{r}</li>)}
                        </ul>
                      )}
                      {!simResult.recommendation && (
                        <p className="text-sm text-muted-foreground">No eligible engineer found within constraints.</p>
                      )}
                    </div>

                    {/* Ranked engineers */}
                    <div>
                      <div className="text-sm font-medium mb-2">Top engineer candidates</div>
                      <div className="space-y-2">
                        {simResult.ranked?.length === 0 && (
                          <p className="text-xs text-muted-foreground">No candidates available.</p>
                        )}
                        {simResult.ranked?.map((r: any, i: number) => (
                          <div
                            key={r.engineerId}
                            className={`p-3 rounded border text-sm flex items-center justify-between gap-3 ${i === 0 ? "border-primary bg-primary/5" : ""}`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <Badge variant={i === 0 ? "default" : "outline"} className="text-xs">#{i + 1}</Badge>
                                <span className="font-mono text-xs">{String(r.engineerId).slice(0, 8)}</span>
                                {r.specialty && <span className="text-xs text-muted-foreground">· {r.specialty}</span>}
                              </div>
                              <div className="text-xs text-muted-foreground mt-1 truncate">
                                {r.reasons?.join(" • ") || "—"}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="text-sm font-semibold">{r.score}</div>
                              <div className="text-xs text-muted-foreground">
                                {r.distanceKm != null ? `${r.distanceKm.toFixed(1)} km` : "—"}
                                {r.rating ? ` · ${r.rating}★` : ""}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Route preview */}
                    {simResult.routePreview?.length > 0 && (
                      <div>
                        <div className="text-sm font-medium mb-2">Projected route for top engineer</div>
                        <ol className="space-y-1">
                          {simResult.routePreview.map((j: any, i: number) => (
                            <li
                              key={j.id}
                              className={`text-xs flex items-center gap-2 p-2 rounded border ${j._new ? "border-primary bg-primary/10" : ""}`}
                            >
                              <Badge variant="outline" className="text-xs">{i + 1}</Badge>
                              <span className="capitalize text-xs">[{j.priority || "—"}]</span>
                              <span className="truncate flex-1">{j.title}</span>
                              {j._new && <Badge variant="default" className="text-xs">new</Badge>}
                              {j.scheduled_at && (
                                <span className="text-muted-foreground">
                                  {new Date(j.scheduled_at).toLocaleString()}
                                </span>
                              )}
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* LIFECYCLE PAYLOAD PREVIEW */}
          <TabsContent value="lifecycle">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
                <div>
                  <CardTitle className="text-base">Lifecycle event preview</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    Exact payloads dispatched to the AI Dispatch Agent for every job create / update / SLA escalation.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={lcFilter} onValueChange={setLcFilter}>
                    <SelectTrigger className="w-[180px]"><SelectValue placeholder="All events" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All events ({lifecycleEvents.length})</SelectItem>
                      {lcEventTypes.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" onClick={() => setLifecycleEvents([])}>
                    <X className="w-4 h-4 mr-1" />Clear
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {filteredLifecycle.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-8 text-center">
                    Waiting for job lifecycle events… Create or update a job to see the live payload.
                  </div>
                ) : (
                  <ScrollArea className="h-[520px]">
                    <div className="space-y-3 pr-3">
                      {filteredLifecycle.map((e) => (
                        <div key={e.id} className="rounded-md border p-3 space-y-2 bg-card">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <Badge variant={e.source === "agent" ? "default" : "secondary"}>
                                {e.source === "agent" ? "agent received" : "db trigger"}
                              </Badge>
                              <Badge variant="outline">{e.event}</Badge>
                              {e.agentStatus && <Badge variant="outline">{e.agentStatus}</Badge>}
                              {e.jobId && (
                                <span className="text-xs font-mono text-muted-foreground">
                                  job {String(e.jobId).slice(0, 8)}
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {new Date(e.ts).toLocaleTimeString()}
                            </span>
                          </div>
                          {e.agentReasoning && (
                            <div className="text-xs text-muted-foreground">{e.agentReasoning}</div>
                          )}
                          {(e.old || e.new) && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                              <div>
                                <div className="text-muted-foreground mb-1">old</div>
                                <pre className="bg-muted/50 rounded p-2 overflow-auto max-h-40 text-[11px]">
{JSON.stringify(e.old, null, 2)}
                                </pre>
                              </div>
                              <div>
                                <div className="text-muted-foreground mb-1">new</div>
                                <pre className="bg-muted/50 rounded p-2 overflow-auto max-h-40 text-[11px]">
{JSON.stringify(e.new, null, 2)}
                                </pre>
                              </div>
                            </div>
                          )}
                          <details className="text-xs">
                            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                              Full agent payload
                            </summary>
                            <pre className="bg-muted/50 rounded p-2 overflow-auto max-h-60 text-[11px] mt-1">
{JSON.stringify(e.payload, null, 2)}
                            </pre>
                          </details>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* AUDIT */}
          <TabsContent value="audit">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <CardTitle className="text-base">
                  Agent decision history ({filteredActions.length}
                  {filteredActions.length !== actions.length && ` of ${actions.length}`})
                </CardTitle>
                <Button size="sm" variant="outline" onClick={exportCsv} disabled={filteredActions.length === 0}>
                  <Download className="w-4 h-4 mr-1" /> Export CSV
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                  <div className="md:col-span-2">
                    <Label className="text-xs">Job ID contains</Label>
                    <Input
                      placeholder="e.g. a1b2c3"
                      value={fJob}
                      onChange={(e) => setFJob(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Action type</Label>
                    <Select value={fAction} onValueChange={setFAction}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All actions</SelectItem>
                        {actionTypes.map((t) => (
                          <SelectItem key={t as string} value={t as string}>{t as string}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Outcome</Label>
                    <Select value={fStatus} onValueChange={setFStatus}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All outcomes</SelectItem>
                        {statuses.map((t) => (
                          <SelectItem key={t as string} value={t as string}>{t as string}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Agent run mode</Label>
                    <Select value={fAutonomy} onValueChange={setFAutonomy}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All runs</SelectItem>
                        {autonomies.map((t) => (
                          <SelectItem key={t as string} value={t as string}>{t as string}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {(fAction !== "all" || fStatus !== "all" || fAutonomy !== "all" || fJob) && (
                  <Button size="sm" variant="ghost" onClick={clearFilters} className="h-7">
                    <X className="w-3 h-3 mr-1" /> Clear filters
                  </Button>
                )}

                <ScrollArea className="h-[500px]">
                  <div className="space-y-2">
                    {filteredActions.length === 0 && (
                      <p className="text-sm text-muted-foreground">No actions match the current filters.</p>
                    )}
                    {filteredActions.map((a: any) => (
                      <div key={a.id} className="p-3 rounded border text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="text-xs">{a.action_type}</Badge>
                            <Badge
                              variant={a.status === "completed" ? "default" : "secondary"}
                              className="text-xs"
                            >
                              {a.status}
                            </Badge>
                            {a.autonomy && <span className="text-xs text-muted-foreground">{a.autonomy}</span>}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {new Date(a.created_at).toLocaleString()}
                          </span>
                        </div>
                        {a.reasoning && <div className="text-xs text-muted-foreground mt-1">{a.reasoning}</div>}
                        {(a.job_id || a.engineer_id) && (
                          <div className="text-xs font-mono text-muted-foreground mt-1">
                            {a.job_id && <>job {String(a.job_id).slice(0, 8)} </>}
                            {a.engineer_id && <>· eng {String(a.engineer_id).slice(0, 8)}</>}
                            {a.score != null && <> · score {a.score}</>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TRACE */}
          <TabsContent value="trace">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <GitBranch className="w-4 h-4" />Job trace
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    Every lifecycle event linked to the resulting agent action, approval outcome, and audit entry.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={traceJobId} onValueChange={setTraceJobId}>
                    <SelectTrigger className="w-[320px]">
                      <SelectValue placeholder="Select a job with agent activity…" />
                    </SelectTrigger>
                    <SelectContent>
                      {traceJobs.length === 0 ? (
                        <div className="px-2 py-3 text-xs text-muted-foreground">No traced jobs yet</div>
                      ) : (
                        traceJobs.map((j) => (
                          <SelectItem key={j.id} value={j.id}>
                            {j.title} · <span className="text-muted-foreground">{j.status}</span>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {!traceJobId ? (
                  <div className="text-sm text-muted-foreground py-8 text-center">
                    Select a job to view its full trace.
                  </div>
                ) : traceClusters.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-8 text-center">
                    No agent activity for this job yet.
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3 flex-wrap">
                      <span className="flex items-center gap-1"><Activity className="w-3 h-3" /> {traceActions.length} actions</span>
                      <span className="flex items-center gap-1"><ShieldAlert className="w-3 h-3" /> {traceApprovals.length} approvals</span>
                      <span className="flex items-center gap-1"><FileText className="w-3 h-3" /> {traceAudit.length} audit entries</span>
                      <span className="font-mono">job {traceJobId.slice(0, 8)}</span>
                    </div>
                    <ScrollArea className="h-[560px]">
                      <div className="space-y-4 pr-3">
                        {traceClusters.map((c) => {
                          const trig = c.trigger;
                          const event = trig?.action_type?.replace(/^lifecycle_/, "") || "ungrouped";
                          return (
                            <div key={c.id} className="border rounded-md bg-card">
                              <div className="px-3 py-2 border-b bg-muted/30 flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-2">
                                  <Badge variant="default" className="gap-1">
                                    <GitBranch className="w-3 h-3" />
                                    {trig ? `lifecycle: ${event}` : "earlier activity"}
                                  </Badge>
                                  {trig?.payload?.old_status && trig?.payload?.new_status && (
                                    <span className="text-xs text-muted-foreground">
                                      {trig.payload.old_status} → {trig.payload.new_status}
                                    </span>
                                  )}
                                </div>
                                {trig && (
                                  <span className="text-xs text-muted-foreground">
                                    {new Date(trig.created_at).toLocaleString()}
                                  </span>
                                )}
                              </div>
                              {c.items.length === 0 ? (
                                <div className="p-3 text-xs text-muted-foreground">
                                  Trigger received but no downstream actions (deduped or skipped).
                                </div>
                              ) : (
                                <ol className="relative border-l border-border ml-5 my-3 mr-3 space-y-3">
                                  {c.items.map((it, idx) => {
                                    const time = new Date(it.ts).toLocaleTimeString();
                                    if (it.kind === "action") {
                                      const a = it.row;
                                      const isLifecycle = typeof a.action_type === "string" && a.action_type.startsWith("lifecycle_");
                                      return (
                                        <li key={`a-${a.id}-${idx}`} className="ml-4">
                                          <span className="absolute -left-[7px] mt-1.5 w-3 h-3 rounded-full bg-primary border border-background" />
                                          <div className="flex items-center justify-between gap-2 flex-wrap">
                                            <div className="flex items-center gap-2">
                                              <Activity className="w-3 h-3 text-primary" />
                                              <Badge variant="outline">{a.action_type}</Badge>
                                              <Badge variant="secondary">{a.status}</Badge>
                                              {a.score != null && <span className="text-xs text-muted-foreground">score {a.score}</span>}
                                              {isLifecycle && <Badge variant="default" className="text-[10px]">trigger</Badge>}
                                            </div>
                                            <span className="text-xs text-muted-foreground">{time}</span>
                                          </div>
                                          {a.reasoning && (
                                            <p className="text-xs text-muted-foreground mt-1">{a.reasoning}</p>
                                          )}
                                          {a.payload?.approval_id && (
                                            <p className="text-[11px] text-muted-foreground mt-1">
                                              → linked approval <span className="font-mono">{String(a.payload.approval_id).slice(0, 8)}</span>
                                            </p>
                                          )}
                                        </li>
                                      );
                                    }
                                    if (it.kind === "approval") {
                                      const a = it.row;
                                      const color = a.status === "approved" ? "text-green-600" : a.status === "rejected" ? "text-destructive" : "text-amber-600";
                                      return (
                                        <li key={`p-${a.id}-${idx}`} className="ml-4">
                                          <span className={`absolute -left-[7px] mt-1.5 w-3 h-3 rounded-full border border-background ${a.status === "approved" ? "bg-green-500" : a.status === "rejected" ? "bg-destructive" : "bg-amber-500"}`} />
                                          <div className="flex items-center justify-between gap-2 flex-wrap">
                                            <div className="flex items-center gap-2">
                                              <ShieldAlert className={`w-3 h-3 ${color}`} />
                                              <Badge variant="outline">approval</Badge>
                                              <Badge variant="secondary" className={color}>{a.status}</Badge>
                                              <span className="text-xs text-muted-foreground font-mono">{String(a.id).slice(0, 8)}</span>
                                            </div>
                                            <span className="text-xs text-muted-foreground">{time}</span>
                                          </div>
                                          {a.reason && <p className="text-xs text-muted-foreground mt-1">{a.reason}</p>}
                                          {a.resolved_at && (
                                            <p className="text-[11px] text-muted-foreground mt-1">
                                              resolved {new Date(a.resolved_at).toLocaleString()}
                                            </p>
                                          )}
                                        </li>
                                      );
                                    }
                                    const ev = it.row;
                                    return (
                                      <li key={`au-${ev.id}-${idx}`} className="ml-4">
                                        <span className="absolute -left-[7px] mt-1.5 w-3 h-3 rounded-full bg-muted-foreground/50 border border-background" />
                                        <div className="flex items-center justify-between gap-2 flex-wrap">
                                          <div className="flex items-center gap-2">
                                            <FileText className="w-3 h-3 text-muted-foreground" />
                                            <Badge variant="outline">audit</Badge>
                                            <span className="text-xs">{ev.action}</span>
                                            {ev.user_email && (
                                              <span className="text-xs text-muted-foreground">by {ev.user_email}</span>
                                            )}
                                          </div>
                                          <span className="text-xs text-muted-foreground">{time}</span>
                                        </div>
                                      </li>
                                    );
                                  })}
                                </ol>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* CHAT */}
          <TabsContent value="chat">
            <Card className="flex flex-col h-[600px]">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" /> Conversational dispatcher
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col gap-3 min-h-0">
                <ScrollArea className="flex-1 pr-3">
                  <div className="space-y-3">
                    {messages.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        Ask the agent things like “What jobs are overdue?”, “Who should I send to job ABC?”, or
                        “Reassign all urgent jobs in London”.
                      </p>
                    )}
                    {messages.map((m, i) => (
                      <div
                        key={i}
                        className={`p-3 rounded-lg text-sm whitespace-pre-wrap ${
                          m.role === "user" ? "bg-primary/10 ml-8" : "bg-muted mr-8"
                        }`}
                      >
                        {m.content}
                      </div>
                    ))}
                    {sending && <div className="text-xs text-muted-foreground">Agent is thinking…</div>}
                    <div ref={chatEnd} />
                  </div>
                </ScrollArea>
                <div className="flex gap-2">
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                    placeholder="Ask the dispatch agent…"
                    disabled={sending}
                  />
                  <Button onClick={send} disabled={sending || !input.trim()}>
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
