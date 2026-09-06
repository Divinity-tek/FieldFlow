import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3,
  TrendingUp,
  Users,
  CheckCircle,
  DollarSign,
  Clock,
  Shield,
  MapPin,
  Award,
  AlertTriangle,
  Target,
  Zap,
  CalendarIcon,
  Download,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
  RadialBarChart,
  RadialBar,
  ComposedChart,
} from "recharts";
import { format, subDays, differenceInMinutes, startOfWeek, startOfMonth, isAfter, isBefore, startOfDay, endOfDay } from "date-fns";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import RegionFilter from "@/components/filters/RegionFilter";
import AskAIButton from "@/components/ai/AskAIButton";
import { useRegionFilter } from "@/hooks/useRegionFilter";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { downloadCsv, downloadPdf } from "@/utils/exportUtils";

const COLORS = ["hsl(var(--primary))", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4"];
const tooltipStyle = { background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 };

// Gauge component
const GaugeCard = ({ value, label, icon: Icon, color }: { value: number; label: string; icon: any; color: string }) => {
  const gaugeColor = value >= 80 ? "#10b981" : value >= 60 ? "#f59e0b" : "#ef4444";
  const data = [{ value: Math.min(value, 100), fill: gaugeColor }];
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3 mb-2">
          <div className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center`}>
            <Icon className="w-4 h-4" />
          </div>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
        <ResponsiveContainer width="100%" height={80}>
          <RadialBarChart cx="50%" cy="90%" innerRadius="70%" outerRadius="100%" startAngle={180} endAngle={0} data={data} barSize={10}>
            <RadialBar background={{ fill: "hsl(var(--muted))" }} dataKey="value" cornerRadius={6} />
          </RadialBarChart>
        </ResponsiveContainer>
        <p className="text-center -mt-2 text-xl font-bold text-foreground">{value.toFixed(1)}%</p>
      </CardContent>
    </Card>
  );
};

const Analytics = () => {
  const [dateFrom, setDateFrom] = useState<Date | undefined>(subDays(new Date(), 90));
  const [dateTo, setDateTo] = useState<Date | undefined>(new Date());
  const [preset, setPreset] = useState<string>("90d");
  const { regions: filterRegions, selectedRegion, setSelectedRegion } = useRegionFilter();

  const applyPreset = (p: string) => {
    setPreset(p);
    const now = new Date();
    switch (p) {
      case "7d": setDateFrom(subDays(now, 7)); setDateTo(now); break;
      case "30d": setDateFrom(subDays(now, 30)); setDateTo(now); break;
      case "90d": setDateFrom(subDays(now, 90)); setDateTo(now); break;
      case "1y": setDateFrom(subDays(now, 365)); setDateTo(now); break;
      case "all": setDateFrom(undefined); setDateTo(undefined); break;
    }
  };

  const inRange = (dateStr: string) => {
    if (!dateFrom && !dateTo) return true;
    const d = new Date(dateStr);
    if (dateFrom && isBefore(d, startOfDay(dateFrom))) return false;
    if (dateTo && isAfter(d, endOfDay(dateTo))) return false;
    return true;
  };
  const { data: jobs = [] } = useQuery({
    queryKey: ["analytics-jobs"],
    queryFn: async () => {
      const { data } = await supabase.from("jobs").select("*");
      return data ?? [];
    },
  });

  const { data: engineers = [] } = useQuery({
    queryKey: ["analytics-engineers"],
    queryFn: async () => {
      const { data } = await supabase.from("engineers").select("*");
      return data ?? [];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["analytics-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, full_name");
      return data ?? [];
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["analytics-clients"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, company_name");
      return data ?? [];
    },
  });

  const { data: slaBreaches = [] } = useQuery({
    queryKey: ["analytics-sla-breaches"],
    queryFn: async () => {
      const { data } = await supabase.from("sla_breaches").select("*").order("breached_at", { ascending: false }).limit(500);
      return data ?? [];
    },
  });

  const { data: slaPolicies = [] } = useQuery({
    queryKey: ["analytics-sla-policies"],
    queryFn: async () => {
      const { data } = await supabase.from("sla_policies").select("*").eq("is_active", true);
      return data ?? [];
    },
  });

  const { data: regions = [] } = useQuery({
    queryKey: ["analytics-regions"],
    queryFn: async () => {
      const { data } = await supabase.from("regions").select("*").eq("is_active", true);
      return data ?? [];
    },
  });

  const profileMap = new Map(profiles.map((p: any) => [p.user_id, p.full_name]));
  const clientMap = new Map(clients.map((c: any) => [c.id, c.company_name]));
  const regionMap = new Map(regions.map((r: any) => [r.id, r.name]));

  // Filter data by date range and region
  const filteredJobs = useMemo(() => jobs.filter((j: any) => {
    if (!inRange(j.created_at)) return false;
    if (selectedRegion !== "all" && j.region_id !== selectedRegion) return false;
    return true;
  }), [jobs, dateFrom, dateTo, selectedRegion]);
  const filteredBreaches = useMemo(() => slaBreaches.filter((b: any) => inRange(b.breached_at)), [slaBreaches, dateFrom, dateTo]);

  // ─── Core metrics ───
  const completedJobs = filteredJobs.filter((j: any) => j.status === "completed");
  const totalJobs = filteredJobs.length;
  const completionRate = totalJobs > 0 ? (completedJobs.length / totalJobs) * 100 : 0;
  const totalRevenue = completedJobs.reduce((s: number, j: any) => s + (Number(j.total_price) || 0), 0);
  const totalMargin = completedJobs.reduce((s: number, j: any) => s + (Number(j.platform_margin) || 0), 0);
  const totalEngineerCost = completedJobs.reduce((s: number, j: any) => s + (Number(j.engineer_charge) || 0), 0);
  const marginPct = totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : 0;
  const avgJobValue = completedJobs.length > 0 ? totalRevenue / completedJobs.length : 0;

  // Avg completion time (in hours)
  const completionTimes = completedJobs
    .filter((j: any) => j.started_at && j.completed_at)
    .map((j: any) => differenceInMinutes(new Date(j.completed_at), new Date(j.started_at)));
  const avgCompletionTime = completionTimes.length > 0
    ? completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length / 60
    : 0;

  // ─── SLA compliance ───
  const slaComplianceData = useMemo(() => {
    // Build policy lookup
    const policyMap = new Map<string, any>();
    slaPolicies.forEach((p: any) => policyMap.set(`${p.client_id}_${p.priority}`, p));

    let tracked = 0;
    let onTrack = 0;
    let atRisk = 0;
    let breached = 0;

    filteredJobs.filter((j: any) => j.status !== "cancelled").forEach((job: any) => {
      const policy = policyMap.get(`${job.client_id}_${job.priority}`);
      if (!policy) return;
      tracked++;

      const now = new Date();
      const created = new Date(job.created_at);
      const completed = job.completed_at ? new Date(job.completed_at) : null;
      const elapsed = completed
        ? differenceInMinutes(completed, created)
        : differenceInMinutes(now, created);

      const isResolved = job.status === "completed";
      if (isResolved && elapsed <= policy.resolution_time_minutes) onTrack++;
      else if (!isResolved && elapsed > policy.resolution_time_minutes) breached++;
      else if (!isResolved && elapsed > policy.resolution_time_minutes * 0.75) atRisk++;
      else onTrack++;
    });

    const complianceRate = tracked > 0 ? (onTrack / tracked) * 100 : 100;
    return { tracked, onTrack, atRisk, breached, complianceRate };
  }, [filteredJobs, slaPolicies]);

  // ─── Charts data ───

  // Revenue trend (weekly for last 12 weeks)
  const revenueTrend = useMemo(() => {
    const weeks: Record<string, { revenue: number; margin: number; cost: number; jobs: number }> = {};
    filteredJobs.forEach((j: any) => {
      const week = format(startOfWeek(new Date(j.created_at)), "MMM d");
      if (!weeks[week]) weeks[week] = { revenue: 0, margin: 0, cost: 0, jobs: 0 };
      weeks[week].revenue += Number(j.total_price) || 0;
      weeks[week].margin += Number(j.platform_margin) || 0;
      weeks[week].cost += Number(j.engineer_charge) || 0;
      weeks[week].jobs++;
    });
    return Object.entries(weeks).map(([week, d]) => ({ week, ...d }));
  }, [filteredJobs]);

  // Job status distribution
  const statusData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredJobs.forEach((j: any) => {
      const s = j.status.replace(/_/g, " ");
      counts[s] = (counts[s] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredJobs]);

  // Priority distribution
  const priorityData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredJobs.forEach((j: any) => { counts[j.priority] = (counts[j.priority] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredJobs]);

  // Service type
  const serviceTypeData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredJobs.forEach((j: any) => { counts[j.service_type] = (counts[j.service_type] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filteredJobs]);

  // Engineer leaderboard
  const engineerLeaderboard = useMemo(() => {
    return engineers.map((e: any) => {
      const engJobs = completedJobs.filter((j: any) => j.engineer_id === e.id);
      const revenue = engJobs.reduce((s: number, j: any) => s + (Number(j.total_price) || 0), 0);
      const margin = engJobs.reduce((s: number, j: any) => s + (Number(j.platform_margin) || 0), 0);
      const times = engJobs
        .filter((j: any) => j.started_at && j.completed_at)
        .map((j: any) => differenceInMinutes(new Date(j.completed_at), new Date(j.started_at)));
      const avgTime = times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length / 60 : 0;

      // Composite score: 40% jobs, 30% rating, 20% revenue, 10% speed
      const maxJobs = Math.max(...engineers.map((en: any) => en.jobs_completed || 0), 1);
      const maxRev = Math.max(...engineers.map((en: any) => {
        return completedJobs.filter((j: any) => j.engineer_id === en.id).reduce((s: number, j: any) => s + (Number(j.total_price) || 0), 0);
      }), 1);
      const score = (
        ((e.jobs_completed || 0) / maxJobs) * 40 +
        ((Number(e.rating) || 0) / 5) * 30 +
        (revenue / maxRev) * 20 +
        (avgTime > 0 ? Math.max(0, (1 - avgTime / 24)) * 10 : 5)
      );

      return {
        name: profileMap.get(e.user_id) || e.specialty,
        specialty: e.specialty,
        jobsCompleted: e.jobs_completed || 0,
        rating: Number(e.rating) || 0,
        hourlyRate: Number(e.hourly_rate) || 0,
        revenue,
        margin,
        avgTime: avgTime.toFixed(1),
        score: Math.round(score),
        region: e.region_id ? regionMap.get(e.region_id) || "—" : "—",
      };
    }).sort((a, b) => b.score - a.score);
  }, [engineers, completedJobs, profileMap, regionMap]);

  // SLA breach trend (last 30 days)
  const breachTrend = useMemo(() => {
    const days: { date: string; breaches: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = subDays(new Date(), i);
      const dateStr = format(d, "yyyy-MM-dd");
      const label = format(d, "MMM d");
      const count = filteredBreaches.filter((b: any) => b.breached_at?.startsWith(dateStr)).length;
      days.push({ date: label, breaches: count });
    }
    return days;
  }, [filteredBreaches]);

  // Regional performance
  const regionalData = useMemo(() => {
    return regions.map((r: any) => {
      const regionJobs = filteredJobs.filter((j: any) => j.region_id === r.id);
      const regionCompleted = regionJobs.filter((j: any) => j.status === "completed");
      const revenue = regionCompleted.reduce((s: number, j: any) => s + (Number(j.total_price) || 0), 0);
      const engCount = engineers.filter((e: any) => e.region_id === r.id).length;
      return {
        region: r.name,
        city: r.city,
        jobs: regionJobs.length,
        completed: regionCompleted.length,
        revenue,
        engineers: engCount,
        completionRate: regionJobs.length > 0 ? Math.round((regionCompleted.length / regionJobs.length) * 100) : 0,
      };
    }).sort((a, b) => b.revenue - a.revenue);
  }, [regions, filteredJobs, engineers]);

  // Top clients by revenue
  const topClients = useMemo(() => {
    const map: Record<string, { name: string; revenue: number; jobs: number; completed: number }> = {};
    filteredJobs.forEach((j: any) => {
      const name = clientMap.get(j.client_id) || "Unknown";
      if (!map[j.client_id]) map[j.client_id] = { name, revenue: 0, jobs: 0, completed: 0 };
      map[j.client_id].jobs++;
      if (j.status === "completed") {
        map[j.client_id].completed++;
        map[j.client_id].revenue += Number(j.total_price) || 0;
      }
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  }, [filteredJobs, clientMap]);

  const exportCsvReport = (type: string) => {
    const ts = new Date().toISOString().slice(0, 10);
    switch (type) {
      case "kpis":
        downloadCsv(`analytics-kpis-${ts}.csv`,
          ["Metric", "Value"],
          [["Total Jobs", totalJobs], ["Completed", completedJobs.length], ["Revenue", `$${totalRevenue}`], ["Margin %", `${marginPct.toFixed(1)}%`], ["Avg Value", `$${avgJobValue.toFixed(0)}`], ["Avg Time (hrs)", avgCompletionTime.toFixed(1)], ["Engineers", engineers.length], ["SLA Breaches", filteredBreaches.length]]);
        break;
      case "engineers":
        downloadCsv(`engineer-leaderboard-${ts}.csv`,
          ["Rank", "Name", "Specialty", "Region", "Score", "Jobs", "Rating", "Revenue", "Avg Time (h)", "Rate/hr"],
          engineerLeaderboard.map((e, i) => [i + 1, e.name, e.specialty, e.region, e.score, e.jobsCompleted, e.rating.toFixed(1), `$${e.revenue}`, e.avgTime, `$${e.hourlyRate}`]));
        break;
      case "regional":
        downloadCsv(`regional-performance-${ts}.csv`,
          ["Region", "City", "Jobs", "Completed", "Rate %", "Revenue", "Engineers"],
          regionalData.map((r) => [r.region, r.city, r.jobs, r.completed, `${r.completionRate}%`, `$${r.revenue}`, r.engineers]));
        break;
      case "revenue":
        downloadCsv(`revenue-trend-${ts}.csv`,
          ["Week", "Revenue", "Margin", "Cost", "Jobs"],
          revenueTrend.map((r) => [r.week, `$${r.revenue}`, `$${r.margin}`, `$${r.cost}`, r.jobs]));
        break;
      case "clients":
        downloadCsv(`top-clients-${ts}.csv`,
          ["Client", "Revenue", "Jobs", "Completed"],
          topClients.map((c) => [c.name, `$${c.revenue}`, c.jobs, c.completed]));
        break;
    }
  };

  const exportPdfReport = () => {
    const tables: { heading: string; headers: string[]; rows: (string | number)[][] }[] = [
      { heading: "Key Performance Indicators", headers: ["Metric", "Value"], rows: [["Total Jobs", totalJobs], ["Completed", completedJobs.length], ["Revenue", `$${totalRevenue.toLocaleString()}`], ["Margin", `${marginPct.toFixed(1)}%`], ["Avg Value", `$${avgJobValue.toFixed(0)}`], ["Avg Completion Time", `${avgCompletionTime.toFixed(1)}h`], ["SLA Compliance", `${slaComplianceData.complianceRate.toFixed(1)}%`], ["SLA Breaches", filteredBreaches.length]] },
      { heading: "Engineer Leaderboard", headers: ["Rank", "Name", "Specialty", "Region", "Score", "Jobs", "Rating", "Revenue"], rows: engineerLeaderboard.slice(0, 15).map((e, i) => [i + 1, e.name, e.specialty, e.region, e.score, e.jobsCompleted, `⭐ ${e.rating.toFixed(1)}`, `$${e.revenue.toLocaleString()}`]) },
      { heading: "Regional Performance", headers: ["Region", "City", "Jobs", "Completed", "Rate", "Revenue", "Engineers"], rows: regionalData.map((r) => [r.region, r.city, r.jobs, r.completed, `${r.completionRate}%`, `$${r.revenue.toLocaleString()}`, r.engineers]) },
      { heading: "Top Clients", headers: ["Client", "Revenue", "Jobs", "Completed"], rows: topClients.map((c) => [c.name, `$${c.revenue.toLocaleString()}`, c.jobs, c.completed]) },
    ];
    downloadPdf("Analytics Report — FieldFlow", tables);
  };

  return (
    <AppLayout title="Advanced Analytics" subtitle="Comprehensive performance insights, trends & benchmarks">
      <div className="space-y-6">
        {/* Date Range Filter */}
        <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            {[
              { label: "7D", value: "7d" },
              { label: "30D", value: "30d" },
              { label: "90D", value: "90d" },
              { label: "1Y", value: "1y" },
              { label: "All", value: "all" },
            ].map((p) => (
              <button
                key={p.value}
                onClick={() => applyPreset(p.value)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                  preset === p.value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("gap-2 text-xs", !dateFrom && "text-muted-foreground")}>
                <CalendarIcon className="w-3.5 h-3.5" />
                {dateFrom ? format(dateFrom, "MMM d, yyyy") : "Start date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateFrom}
                onSelect={(d) => { setDateFrom(d); setPreset("custom"); }}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>

          <span className="text-xs text-muted-foreground">to</span>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("gap-2 text-xs", !dateTo && "text-muted-foreground")}>
                <CalendarIcon className="w-3.5 h-3.5" />
                {dateTo ? format(dateTo, "MMM d, yyyy") : "End date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateTo}
                onSelect={(d) => { setDateTo(d); setPreset("custom"); }}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>

          {dateFrom && dateTo && (
            <Badge variant="secondary" className="text-[10px]">
              {filteredJobs.length} of {jobs.length} jobs
            </Badge>
          )}

          <div className="ml-auto flex items-center gap-2">
            <RegionFilter regions={filterRegions} value={selectedRegion} onChange={setSelectedRegion} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                  <Download className="w-3.5 h-3.5" /> Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={exportPdfReport}>
                  📄 Full Report (PDF)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportCsvReport("kpis")}>
                  📊 KPIs (CSV)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportCsvReport("revenue")}>
                  💰 Revenue Trend (CSV)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportCsvReport("engineers")}>
                  👷 Engineer Leaderboard (CSV)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportCsvReport("regional")}>
                  🌍 Regional Performance (CSV)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportCsvReport("clients")}>
                  🏢 Top Clients (CSV)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          </div>
          <AskAIButton prompt="Analyze my analytics data: identify performance trends, top performers, SLA compliance rates, revenue patterns, and areas needing improvement." label="AI Analysis" />
        </div>

        {/* Top KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {[
            { label: "Total Jobs", value: totalJobs.toString(), icon: BarChart3, color: "bg-primary/10 text-primary" },
            { label: "Completed", value: completedJobs.length.toString(), icon: CheckCircle, color: "bg-green-500/10 text-green-500" },
            { label: "Revenue", value: `$${(totalRevenue / 1000).toFixed(1)}k`, icon: DollarSign, color: "bg-emerald-500/10 text-emerald-500" },
            { label: "Margin", value: `${marginPct.toFixed(1)}%`, icon: TrendingUp, color: "bg-blue-500/10 text-blue-500" },
            { label: "Avg Value", value: `$${avgJobValue.toFixed(0)}`, icon: Target, color: "bg-violet-500/10 text-violet-500" },
            { label: "Avg Time", value: `${avgCompletionTime.toFixed(1)}h`, icon: Clock, color: "bg-amber-500/10 text-amber-500" },
            { label: "Engineers", value: engineers.length.toString(), icon: Users, color: "bg-indigo-500/10 text-indigo-500" },
            { label: "SLA Breaches", value: filteredBreaches.length.toString(), icon: AlertTriangle, color: "bg-destructive/10 text-destructive" },
          ].map((kpi) => (
            <Card key={kpi.label}>
              <CardContent className="p-3 flex flex-col items-center text-center gap-1">
                <div className={`w-8 h-8 rounded-lg ${kpi.color} flex items-center justify-center`}>
                  <kpi.icon className="w-4 h-4" />
                </div>
                <p className="text-lg font-bold text-foreground leading-tight">{kpi.value}</p>
                <p className="text-[10px] text-muted-foreground">{kpi.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Gauge row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <GaugeCard value={completionRate} label="Job Completion Rate" icon={CheckCircle} color="bg-green-500/10 text-green-500" />
          <GaugeCard value={marginPct} label="Profit Margin" icon={TrendingUp} color="bg-blue-500/10 text-blue-500" />
          <GaugeCard value={slaComplianceData.complianceRate} label="SLA Compliance" icon={Shield} color="bg-primary/10 text-primary" />
          <GaugeCard
            value={engineers.length > 0 ? (engineers.filter((e: any) => e.is_available).length / engineers.length) * 100 : 0}
            label="Engineer Availability"
            icon={Users}
            color="bg-violet-500/10 text-violet-500"
          />
        </div>

        <Tabs defaultValue="revenue" className="space-y-4">
          <TabsList className="flex-wrap">
            <TabsTrigger value="revenue">Revenue & Trends</TabsTrigger>
            <TabsTrigger value="jobs">Job Analytics</TabsTrigger>
            <TabsTrigger value="engineers">Engineer Leaderboard</TabsTrigger>
            <TabsTrigger value="sla">SLA Compliance</TabsTrigger>
            <TabsTrigger value="regional">Regional Performance</TabsTrigger>
          </TabsList>

          {/* Revenue */}
          <TabsContent value="revenue" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
              <Card>
                <CardContent className="p-5 text-center">
                  <p className="text-xs text-muted-foreground">Total Revenue</p>
                  <p className="text-3xl font-bold text-foreground">${totalRevenue.toLocaleString()}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5 text-center">
                  <p className="text-xs text-muted-foreground">Platform Margin</p>
                  <p className="text-3xl font-bold text-green-500">${totalMargin.toLocaleString()}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5 text-center">
                  <p className="text-xs text-muted-foreground">Engineer Costs</p>
                  <p className="text-3xl font-bold text-foreground">${totalEngineerCost.toLocaleString()}</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader><CardTitle className="text-base">Revenue vs Costs Over Time</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={320}>
                  <ComposedChart data={revenueTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="week" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `$${v}`} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Area yAxisId="left" type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.1} name="Revenue" />
                    <Area yAxisId="left" type="monotone" dataKey="margin" stroke="#10b981" fill="#10b981" fillOpacity={0.1} name="Margin" />
                    <Line yAxisId="right" type="monotone" dataKey="jobs" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} name="Jobs" />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Top Clients by Revenue</CardTitle></CardHeader>
              <CardContent>
                {topClients.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={topClients} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `$${v}`} />
                      <YAxis dataKey="name" type="category" width={140} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `$${v.toLocaleString()}`} />
                      <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="Revenue" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="py-12 text-center text-muted-foreground text-sm">No client revenue data yet</div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Jobs */}
          <TabsContent value="jobs" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader><CardTitle className="text-base">Job Status Distribution</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} innerRadius={50} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">Jobs by Priority</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={priorityData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card className="lg:col-span-2">
                <CardHeader><CardTitle className="text-base">Jobs by Service Type</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={serviceTypeData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis dataKey="name" type="category" width={140} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Engineer Leaderboard */}
          <TabsContent value="engineers" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader><CardTitle className="text-base">Performance Scores</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={engineerLeaderboard.slice(0, 10)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="score" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="Score" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">Revenue Generated by Engineer</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={engineerLeaderboard.filter((e) => e.revenue > 0).slice(0, 10)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `$${v}`} />
                      <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `$${v.toLocaleString()}`} />
                      <Bar dataKey="revenue" fill="#10b981" radius={[0, 4, 4, 0]} name="Revenue" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-500" /> Engineer Leaderboard
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[900px]">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase w-12">#</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Engineer</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Specialty</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Region</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Score</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Jobs</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Rating</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Revenue</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Avg Time</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Rate/hr</th>
                      </tr>
                    </thead>
                    <tbody>
                      {engineerLeaderboard.map((eng, i) => (
                        <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="px-4 py-3">
                            {i < 3 ? (
                              <span className={`text-lg ${i === 0 ? "text-amber-400" : i === 1 ? "text-slate-400" : "text-amber-700"}`}>
                                {i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}
                              </span>
                            ) : (
                              <span className="text-muted-foreground font-medium">#{i + 1}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-medium text-foreground">{eng.name}</td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">{eng.specialty}</td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">{eng.region}</td>
                          <td className="px-4 py-3 text-right">
                            <Badge variant="outline" className={`text-xs ${eng.score >= 70 ? "border-green-500/30 text-green-500" : eng.score >= 40 ? "border-amber-500/30 text-amber-500" : "border-destructive/30 text-destructive"}`}>
                              {eng.score}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right text-foreground">{eng.jobsCompleted}</td>
                          <td className="px-4 py-3 text-right text-foreground">⭐ {eng.rating.toFixed(1)}</td>
                          <td className="px-4 py-3 text-right text-foreground">${eng.revenue.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right text-muted-foreground">{eng.avgTime}h</td>
                          <td className="px-4 py-3 text-right text-muted-foreground">${eng.hourlyRate}</td>
                        </tr>
                      ))}
                      {engineerLeaderboard.length === 0 && (
                        <tr><td colSpan={10} className="py-12 text-center text-muted-foreground">No engineer data</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* SLA */}
          <TabsContent value="sla" className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-foreground">{slaComplianceData.tracked}</p>
                  <p className="text-xs text-muted-foreground">Tracked Jobs</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-green-500">{slaComplianceData.onTrack}</p>
                  <p className="text-xs text-muted-foreground">On Track</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-amber-500">{slaComplianceData.atRisk}</p>
                  <p className="text-xs text-muted-foreground">At Risk</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-destructive">{slaComplianceData.breached}</p>
                  <p className="text-xs text-muted-foreground">Breached</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader><CardTitle className="text-base">SLA Compliance Distribution</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: "On Track", value: slaComplianceData.onTrack, color: "#10b981" },
                          { name: "At Risk", value: slaComplianceData.atRisk, color: "#f59e0b" },
                          { name: "Breached", value: slaComplianceData.breached, color: "#ef4444" },
                        ].filter((d) => d.value > 0)}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        innerRadius={50}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {[
                          { color: "#10b981" },
                          { color: "#f59e0b" },
                          { color: "#ef4444" },
                        ].filter((_, i) => [slaComplianceData.onTrack, slaComplianceData.atRisk, slaComplianceData.breached][i] > 0)
                          .map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Breach Trend (30 Days)</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={breachTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} interval={4} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Area type="monotone" dataKey="breaches" stroke="#ef4444" fill="#ef4444" fillOpacity={0.15} />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Regional */}
          <TabsContent value="regional" className="space-y-4">
            {regionalData.length > 0 ? (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader><CardTitle className="text-base">Revenue by Region</CardTitle></CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={regionalData} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis type="number" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `$${v}`} />
                          <YAxis dataKey="region" type="category" width={120} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                          <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `$${v.toLocaleString()}`} />
                          <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader><CardTitle className="text-base">Jobs & Engineers by Region</CardTitle></CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={regionalData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="region" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                          <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                          <Tooltip contentStyle={tooltipStyle} />
                          <Bar dataKey="jobs" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Total Jobs" />
                          <Bar dataKey="engineers" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Engineers" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader><CardTitle className="text-base">Regional Performance Table</CardTitle></CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm min-w-[600px]">
                        <thead>
                          <tr className="border-b border-border bg-muted/30">
                            <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Region</th>
                            <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">City</th>
                            <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Jobs</th>
                            <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Completed</th>
                            <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Rate</th>
                            <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Revenue</th>
                            <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Engineers</th>
                          </tr>
                        </thead>
                        <tbody>
                          {regionalData.map((r) => (
                            <tr key={r.region} className="border-b border-border/50 hover:bg-muted/30">
                              <td className="px-5 py-3 font-medium text-foreground">{r.region}</td>
                              <td className="px-5 py-3 text-muted-foreground">{r.city}</td>
                              <td className="px-5 py-3 text-right text-foreground">{r.jobs}</td>
                              <td className="px-5 py-3 text-right text-foreground">{r.completed}</td>
                              <td className="px-5 py-3 text-right">
                                <Badge variant="outline" className={`text-xs ${r.completionRate >= 80 ? "text-green-500" : r.completionRate >= 50 ? "text-amber-500" : "text-destructive"}`}>
                                  {r.completionRate}%
                                </Badge>
                              </td>
                              <td className="px-5 py-3 text-right font-medium text-foreground">${r.revenue.toLocaleString()}</td>
                              <td className="px-5 py-3 text-right text-foreground">{r.engineers}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="py-16 text-center">
                  <MapPin className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-30" />
                  <p className="text-muted-foreground">No regions configured. Add regions to see regional performance data.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Analytics;
