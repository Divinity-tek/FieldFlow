import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import AskAIButton from "@/components/ai/AskAIButton";
import {
  Shield,
  Plus,
  Clock,
  CheckCircle,
  AlertTriangle,
  XCircle,
  TrendingUp,
  Timer,
  ArrowUpCircle,
  Eye,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  RadialBarChart,
  RadialBar,
  Legend,
  LineChart,
  Line,
} from "recharts";
import { format, subDays, differenceInMinutes } from "date-fns";

type SLAStatus = "on_track" | "at_risk" | "breached";

interface JobSLA {
  jobId: string;
  jobTitle: string;
  clientId: string;
  clientName: string;
  priority: string;
  status: string;
  responseTarget: number;
  resolutionTarget: number;
  responseElapsed: number;
  resolutionElapsed: number;
  responseStatus: SLAStatus;
  resolutionStatus: SLAStatus;
  createdAt: string;
  policyId: string;
}

const COLORS = {
  on_track: "#10b981",
  at_risk: "#f59e0b",
  breached: "#ef4444",
};

// Gauge chart component
const GaugeChart = ({ value, label, max = 100 }: { value: number; label: string; max?: number }) => {
  const pct = Math.min((value / max) * 100, 100);
  const color = pct >= 90 ? COLORS.on_track : pct >= 70 ? COLORS.at_risk : COLORS.breached;
  const data = [{ name: label, value: pct, fill: color }];

  return (
    <div className="flex flex-col items-center">
      <ResponsiveContainer width="100%" height={160}>
        <RadialBarChart
          cx="50%"
          cy="80%"
          innerRadius="60%"
          outerRadius="100%"
          startAngle={180}
          endAngle={0}
          data={data}
          barSize={14}
        >
          <RadialBar
            background={{ fill: "hsl(var(--muted))" }}
            dataKey="value"
            cornerRadius={8}
          />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="-mt-12 text-center">
        <p className="text-2xl font-bold" style={{ color }}>{value.toFixed(1)}%</p>
        <p className="text-xs text-muted-foreground mt-1">{label}</p>
      </div>
    </div>
  );
};

const SLATracking = () => {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [policyName, setPolicyName] = useState("");
  const [priority, setPriority] = useState("medium");
  const [responseTime, setResponseTime] = useState("60");
  const [resolutionTime, setResolutionTime] = useState("480");
  const [showEscalate, setShowEscalate] = useState<JobSLA | null>(null);
  const [escalationNotes, setEscalationNotes] = useState("");
  const [showBreachDetail, setShowBreachDetail] = useState<string | null>(null);

  const { data: slaPolicies = [] } = useQuery({
    queryKey: ["sla-policies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sla_policies")
        .select("*, clients(company_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["sla-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, company_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ["sla-jobs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select("id, title, status, priority, client_id, created_at, started_at, completed_at")
        .not("status", "eq", "cancelled");
      if (error) throw error;
      return data;
    },
  });

  const { data: slaBreaches = [] } = useQuery({
    queryKey: ["sla-breaches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sla_breaches")
        .select("*, jobs(title), clients(company_name), sla_policies(name)")
        .order("breached_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  const clientMap = new Map(clients.map((c) => [c.id, c.company_name]));

  const policyLookup = new Map<string, any>();
  slaPolicies.forEach((p: any) => {
    if (p.is_active) {
      policyLookup.set(`${p.client_id}_${p.priority}`, p);
    }
  });

  const jobSLAs: JobSLA[] = useMemo(() => {
    return jobs
      .map((job: any) => {
        const policy = policyLookup.get(`${job.client_id}_${job.priority}`);
        if (!policy) return null;

        const now = new Date();
        const created = new Date(job.created_at);
        const started = job.started_at ? new Date(job.started_at) : null;
        const completed = job.completed_at ? new Date(job.completed_at) : null;

        const responseElapsed = started
          ? (started.getTime() - created.getTime()) / 60000
          : (now.getTime() - created.getTime()) / 60000;

        const resolutionElapsed = completed
          ? (completed.getTime() - created.getTime()) / 60000
          : (now.getTime() - created.getTime()) / 60000;

        const getStatus = (elapsed: number, target: number, isResolved: boolean): SLAStatus => {
          if (isResolved) return elapsed <= target ? "on_track" : "breached";
          if (elapsed > target) return "breached";
          if (elapsed > target * 0.75) return "at_risk";
          return "on_track";
        };

        const isResponded = !!started || job.status === "completed";
        const isResolved = job.status === "completed";

        return {
          jobId: job.id,
          jobTitle: job.title,
          clientId: job.client_id,
          clientName: clientMap.get(job.client_id) || "Unknown",
          priority: job.priority,
          status: job.status,
          responseTarget: policy.response_time_minutes,
          resolutionTarget: policy.resolution_time_minutes,
          responseElapsed: Math.round(responseElapsed),
          resolutionElapsed: Math.round(resolutionElapsed),
          responseStatus: getStatus(responseElapsed, policy.response_time_minutes, isResponded),
          resolutionStatus: getStatus(resolutionElapsed, policy.resolution_time_minutes, isResolved),
          createdAt: job.created_at,
          policyId: policy.id,
        } as JobSLA;
      })
      .filter(Boolean) as JobSLA[];
  }, [jobs, slaPolicies, clients]);

  // Stats
  const totalTracked = jobSLAs.length;
  const breachedResponse = jobSLAs.filter((j) => j.responseStatus === "breached").length;
  const breachedResolution = jobSLAs.filter((j) => j.resolutionStatus === "breached").length;
  const atRisk = jobSLAs.filter(
    (j) => j.responseStatus === "at_risk" || j.resolutionStatus === "at_risk"
  ).length;
  const onTrack = jobSLAs.filter(
    (j) => j.responseStatus === "on_track" && j.resolutionStatus === "on_track"
  ).length;
  const complianceRate = totalTracked > 0 ? (onTrack / totalTracked) * 100 : 100;
  const responseCompliance = totalTracked > 0
    ? ((totalTracked - breachedResponse) / totalTracked) * 100
    : 100;
  const resolutionCompliance = totalTracked > 0
    ? ((totalTracked - breachedResolution) / totalTracked) * 100
    : 100;

  const pieData = [
    { name: "On Track", value: onTrack, color: COLORS.on_track },
    { name: "At Risk", value: atRisk, color: COLORS.at_risk },
    { name: "Breached", value: breachedResponse + breachedResolution, color: COLORS.breached },
  ].filter((d) => d.value > 0);

  // Breach by client
  const clientBreaches: Record<string, { client: string; breached: number; total: number }> = {};
  jobSLAs.forEach((j) => {
    if (!clientBreaches[j.clientName]) {
      clientBreaches[j.clientName] = { client: j.clientName, breached: 0, total: 0 };
    }
    clientBreaches[j.clientName].total++;
    if (j.responseStatus === "breached" || j.resolutionStatus === "breached") {
      clientBreaches[j.clientName].breached++;
    }
  });
  const clientBreachData = Object.values(clientBreaches).sort((a, b) => b.breached - a.breached);

  // Breach trend (last 7 days from sla_breaches table)
  const breachTrend = useMemo(() => {
    const days: { date: string; breaches: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = subDays(new Date(), i);
      const dateStr = format(d, "yyyy-MM-dd");
      const label = format(d, "EEE");
      const count = slaBreaches.filter((b: any) =>
        b.breached_at?.startsWith(dateStr)
      ).length;
      days.push({ date: label, breaches: count });
    }
    return days;
  }, [slaBreaches]);

  // Escalation status counts
  const escalationCounts = useMemo(() => {
    const pending = slaBreaches.filter((b: any) => b.escalation_status === "pending").length;
    const acknowledged = slaBreaches.filter((b: any) => b.escalation_status === "acknowledged").length;
    const resolved = slaBreaches.filter((b: any) => b.escalation_status === "resolved").length;
    return { pending, acknowledged, resolved };
  }, [slaBreaches]);

  const createPolicyMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("sla_policies").insert({
        client_id: selectedClientId,
        name: policyName,
        priority: priority as any,
        response_time_minutes: parseInt(responseTime),
        resolution_time_minutes: parseInt(resolutionTime),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sla-policies"] });
      toast.success("SLA policy created");
      resetForm();
    },
    onError: (e: any) => {
      if (e.message?.includes("unique_client_priority")) {
        toast.error("This client already has a policy for this priority level");
      } else {
        toast.error("Failed to create SLA policy");
      }
    },
  });

  const logBreachMutation = useMutation({
    mutationFn: async (job: JobSLA) => {
      const breachType = job.responseStatus === "breached" ? "response" : "resolution";
      const elapsed = breachType === "response" ? job.responseElapsed : job.resolutionElapsed;
      const target = breachType === "response" ? job.responseTarget : job.resolutionTarget;

      const { error } = await supabase.from("sla_breaches").insert({
        job_id: job.jobId,
        client_id: job.clientId,
        sla_policy_id: job.policyId,
        breach_type: breachType,
        target_minutes: target,
        actual_minutes: elapsed,
        notes: escalationNotes || null,
        escalation_status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sla-breaches"] });
      toast.success("Breach logged and escalation created");
      setShowEscalate(null);
      setEscalationNotes("");
    },
    onError: () => toast.error("Failed to log breach"),
  });

  const updateEscalationMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("sla_breaches")
        .update({ escalation_status: status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sla-breaches"] });
      toast.success("Escalation updated");
    },
  });

  const togglePolicyMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from("sla_policies")
        .update({ is_active: active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sla-policies"] });
      toast.success("Policy updated");
    },
  });

  const resetForm = () => {
    setShowCreate(false);
    setSelectedClientId("");
    setPolicyName("");
    setPriority("medium");
    setResponseTime("60");
    setResolutionTime("480");
  };

  const formatMinutes = (m: number) => {
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    const rem = m % 60;
    return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
  };

  const statusIcon = (s: SLAStatus) => {
    if (s === "on_track") return <CheckCircle className="w-4 h-4 text-green-500" />;
    if (s === "at_risk") return <AlertTriangle className="w-4 h-4 text-amber-500" />;
    return <XCircle className="w-4 h-4 text-destructive" />;
  };

  const statusBadge = (s: SLAStatus) => {
    const styles = {
      on_track: "bg-green-500/10 text-green-500",
      at_risk: "bg-amber-500/10 text-amber-500",
      breached: "bg-destructive/10 text-destructive",
    };
    const labels = { on_track: "On Track", at_risk: "At Risk", breached: "Breached" };
    return (
      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${styles[s]}`}>
        {labels[s]}
      </span>
    );
  };

  const escalationBadge = (status: string) => {
    const map: Record<string, string> = {
      pending: "bg-destructive/10 text-destructive",
      acknowledged: "bg-amber-500/10 text-amber-500",
      resolved: "bg-green-500/10 text-green-500",
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${map[status] || "bg-muted text-muted-foreground"}`}>
        {status}
      </span>
    );
  };

  const alertJobs = jobSLAs
    .filter((j) => j.responseStatus !== "on_track" || j.resolutionStatus !== "on_track")
    .sort((a, b) => {
      const aScore = (a.responseStatus === "breached" ? 2 : a.responseStatus === "at_risk" ? 1 : 0) +
        (a.resolutionStatus === "breached" ? 2 : a.resolutionStatus === "at_risk" ? 1 : 0);
      const bScore = (b.responseStatus === "breached" ? 2 : b.responseStatus === "at_risk" ? 1 : 0) +
        (b.resolutionStatus === "breached" ? 2 : b.resolutionStatus === "at_risk" ? 1 : 0);
      return bScore - aScore;
    });

  return (
    <AppLayout title="SLA Tracking" subtitle="Service level compliance, breach monitoring & escalations">
      <div className="space-y-6">
        <div className="flex justify-end">
          <AskAIButton prompt="Analyze SLA compliance: identify breach patterns, at-risk clients, response time trends, and recommend improvements." label="AI Analysis" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Compliance</p>
                <p className="text-xl font-bold text-foreground">{complianceRate.toFixed(1)}%</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">On Track</p>
                <p className="text-xl font-bold text-foreground">{onTrack}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">At Risk</p>
                <p className="text-xl font-bold text-foreground">{atRisk}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-destructive/10 flex items-center justify-center">
                <XCircle className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Breached</p>
                <p className="text-xl font-bold text-foreground">{breachedResponse + breachedResolution}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <ArrowUpCircle className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Open Escalations</p>
                <p className="text-xl font-bold text-foreground">{escalationCounts.pending}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="dashboard" className="space-y-4">
          <TabsList>
            <TabsTrigger value="dashboard">Compliance Dashboard</TabsTrigger>
            <TabsTrigger value="alerts">Breach Alerts ({alertJobs.length})</TabsTrigger>
            <TabsTrigger value="escalations">Escalations ({slaBreaches.length})</TabsTrigger>
            <TabsTrigger value="policies">SLA Policies ({slaPolicies.length})</TabsTrigger>
          </TabsList>

          {/* Dashboard */}
          <TabsContent value="dashboard" className="space-y-4">
            {/* Gauge Charts */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6 pb-4">
                  <GaugeChart value={complianceRate} label="Overall Compliance" />
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 pb-4">
                  <GaugeChart value={responseCompliance} label="Response SLA" />
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 pb-4">
                  <GaugeChart value={resolutionCompliance} label="Resolution SLA" />
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">SLA Status Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  {pieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={90}
                          innerRadius={50}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          {pieData.map((d, i) => (
                            <Cell key={i} fill={d.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">
                      No SLA-tracked jobs yet. Create policies to start tracking.
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Breach Trend (7 Days)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={breachTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                      <Line type="monotone" dataKey="breaches" stroke={COLORS.breached} strokeWidth={2} dot={{ fill: COLORS.breached }} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Breaches by Client</CardTitle>
              </CardHeader>
              <CardContent>
                {clientBreachData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={clientBreachData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis dataKey="client" type="category" width={120} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                      <Bar dataKey="breached" fill={COLORS.breached} radius={[0, 4, 4, 0]} name="Breached" />
                      <Bar dataKey="total" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="Total Tracked" opacity={0.3} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">
                    No data available
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Alerts */}
          <TabsContent value="alerts" className="space-y-4">
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[800px]">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Job</th>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Client</th>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Priority</th>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Response SLA</th>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Resolution SLA</th>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Status</th>
                        <th className="text-center px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Escalate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {alertJobs.map((j) => (
                        <tr key={j.jobId} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="px-5 py-3 font-medium text-foreground">{j.jobTitle}</td>
                          <td className="px-5 py-3 text-foreground">{j.clientName}</td>
                          <td className="px-5 py-3">
                            <span className={`text-xs font-semibold uppercase ${
                              j.priority === "urgent" ? "text-destructive" :
                              j.priority === "high" ? "text-amber-500" :
                              "text-muted-foreground"
                            }`}>{j.priority}</span>
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-1.5">
                              {statusIcon(j.responseStatus)}
                              <span className="text-xs text-muted-foreground">
                                {formatMinutes(j.responseElapsed)} / {formatMinutes(j.responseTarget)}
                              </span>
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-1.5">
                              {statusIcon(j.resolutionStatus)}
                              <span className="text-xs text-muted-foreground">
                                {formatMinutes(j.resolutionElapsed)} / {formatMinutes(j.resolutionTarget)}
                              </span>
                            </div>
                          </td>
                          <td className="px-5 py-3 capitalize text-xs text-muted-foreground">
                            {j.status.replace(/_/g, " ")}
                          </td>
                          <td className="px-5 py-3 text-center">
                            {(j.responseStatus === "breached" || j.resolutionStatus === "breached") && (
                              <Button
                                size="sm"
                                variant="destructive"
                                className="h-7 text-xs gap-1"
                                onClick={() => setShowEscalate(j)}
                              >
                                <ArrowUpCircle className="w-3 h-3" /> Escalate
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {alertJobs.length === 0 && (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-muted-foreground">
                            <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
                            All tracked jobs are within SLA targets
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Escalations */}
          <TabsContent value="escalations" className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-destructive">{escalationCounts.pending}</p>
                  <p className="text-xs text-muted-foreground mt-1">Pending</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-amber-500">{escalationCounts.acknowledged}</p>
                  <p className="text-xs text-muted-foreground mt-1">Acknowledged</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-green-500">{escalationCounts.resolved}</p>
                  <p className="text-xs text-muted-foreground mt-1">Resolved</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[800px]">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Job</th>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Client</th>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Type</th>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Target vs Actual</th>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Breached At</th>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Status</th>
                        <th className="text-center px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {slaBreaches.map((b: any) => (
                        <tr key={b.id} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="px-5 py-3 font-medium text-foreground">{b.jobs?.title || "—"}</td>
                          <td className="px-5 py-3 text-foreground">{b.clients?.company_name || "—"}</td>
                          <td className="px-5 py-3 capitalize text-xs">{b.breach_type}</td>
                          <td className="px-5 py-3 text-xs text-muted-foreground">
                            {formatMinutes(b.target_minutes)} → {b.actual_minutes ? formatMinutes(b.actual_minutes) : "ongoing"}
                          </td>
                          <td className="px-5 py-3 text-xs text-muted-foreground">
                            {format(new Date(b.breached_at), "MMM d, HH:mm")}
                          </td>
                          <td className="px-5 py-3">{escalationBadge(b.escalation_status)}</td>
                          <td className="px-5 py-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {b.escalation_status === "pending" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs"
                                  onClick={() => updateEscalationMutation.mutate({ id: b.id, status: "acknowledged" })}
                                >
                                  Acknowledge
                                </Button>
                              )}
                              {b.escalation_status === "acknowledged" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs"
                                  onClick={() => updateEscalationMutation.mutate({ id: b.id, status: "resolved" })}
                                >
                                  Resolve
                                </Button>
                              )}
                              {b.notes && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0"
                                  onClick={() => setShowBreachDetail(b.id)}
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {slaBreaches.length === 0 && (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-muted-foreground">
                            <Shield className="w-8 h-8 mx-auto mb-2 opacity-40" />
                            No breach escalations recorded yet
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Policies */}
          <TabsContent value="policies" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => setShowCreate(true)} className="gap-2">
                <Plus className="w-4 h-4" /> New SLA Policy
              </Button>
            </div>

            <Dialog open={showCreate} onOpenChange={setShowCreate}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Create SLA Policy</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Client</Label>
                    <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                      <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                      <SelectContent>
                        {clients.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Policy Name</Label>
                    <Input
                      value={policyName}
                      onChange={(e) => setPolicyName(e.target.value)}
                      placeholder="e.g. Standard SLA, Premium SLA"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Priority Level</Label>
                    <Select value={priority} onValueChange={setPriority}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Response Time (min)</Label>
                      <Input
                        type="number"
                        min={1}
                        value={responseTime}
                        onChange={(e) => setResponseTime(e.target.value)}
                      />
                      <p className="text-[10px] text-muted-foreground">{formatMinutes(parseInt(responseTime) || 0)}</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Resolution Time (min)</Label>
                      <Input
                        type="number"
                        min={1}
                        value={resolutionTime}
                        onChange={(e) => setResolutionTime(e.target.value)}
                      />
                      <p className="text-[10px] text-muted-foreground">{formatMinutes(parseInt(resolutionTime) || 0)}</p>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={resetForm}>Cancel</Button>
                    <Button
                      onClick={() => createPolicyMutation.mutate()}
                      disabled={!selectedClientId || !policyName || createPolicyMutation.isPending}
                    >
                      Create Policy
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[600px]">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Policy</th>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Client</th>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Priority</th>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Response</th>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Resolution</th>
                        <th className="text-center px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Active</th>
                      </tr>
                    </thead>
                    <tbody>
                      {slaPolicies.map((p: any) => (
                        <tr key={p.id} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="px-5 py-3 font-medium text-foreground">{p.name}</td>
                          <td className="px-5 py-3 text-foreground">{p.clients?.company_name || "—"}</td>
                          <td className="px-5 py-3">
                            <span className={`text-xs font-semibold uppercase ${
                              p.priority === "urgent" ? "text-destructive" :
                              p.priority === "high" ? "text-amber-500" :
                              "text-muted-foreground"
                            }`}>{p.priority}</span>
                          </td>
                          <td className="px-5 py-3 text-muted-foreground flex items-center gap-1">
                            <Timer className="w-3.5 h-3.5" /> {formatMinutes(p.response_time_minutes)}
                          </td>
                          <td className="px-5 py-3 text-muted-foreground">
                            {formatMinutes(p.resolution_time_minutes)}
                          </td>
                          <td className="px-5 py-3 text-center">
                            <Switch
                              checked={p.is_active}
                              onCheckedChange={(checked) =>
                                togglePolicyMutation.mutate({ id: p.id, active: checked })
                              }
                            />
                          </td>
                        </tr>
                      ))}
                      {slaPolicies.length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-muted-foreground">
                            <Shield className="w-8 h-8 mx-auto mb-2 opacity-40" />
                            No SLA policies yet. Create your first policy.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Escalate Dialog */}
        <Dialog open={!!showEscalate} onOpenChange={() => { setShowEscalate(null); setEscalationNotes(""); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ArrowUpCircle className="w-5 h-5 text-destructive" />
                Escalate SLA Breach
              </DialogTitle>
            </DialogHeader>
            {showEscalate && (
              <div className="space-y-4">
                <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20 space-y-1">
                  <p className="text-sm font-medium text-foreground">{showEscalate.jobTitle}</p>
                  <p className="text-xs text-muted-foreground">Client: {showEscalate.clientName}</p>
                  <div className="flex gap-4 mt-2 text-xs">
                    <span>Response: {formatMinutes(showEscalate.responseElapsed)} / {formatMinutes(showEscalate.responseTarget)} {statusBadge(showEscalate.responseStatus)}</span>
                  </div>
                  <div className="flex gap-4 text-xs">
                    <span>Resolution: {formatMinutes(showEscalate.resolutionElapsed)} / {formatMinutes(showEscalate.resolutionTarget)} {statusBadge(showEscalate.resolutionStatus)}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Escalation Notes</Label>
                  <Textarea
                    value={escalationNotes}
                    onChange={(e) => setEscalationNotes(e.target.value)}
                    placeholder="Describe the issue, actions taken, and recommended next steps..."
                    rows={3}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => { setShowEscalate(null); setEscalationNotes(""); }}>Cancel</Button>
                  <Button
                    variant="destructive"
                    onClick={() => logBreachMutation.mutate(showEscalate)}
                    disabled={logBreachMutation.isPending}
                  >
                    Log Breach & Escalate
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Breach Detail Dialog */}
        <Dialog open={!!showBreachDetail} onOpenChange={() => setShowBreachDetail(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Escalation Notes</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              {slaBreaches.find((b: any) => b.id === showBreachDetail)?.notes || "No notes"}
            </p>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default SLATracking;
