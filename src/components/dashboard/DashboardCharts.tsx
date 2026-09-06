import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays } from "date-fns";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, RadialBarChart, RadialBar,
} from "recharts";
import { TrendingUp, PieChart as PieIcon, BarChart3, Target } from "lucide-react";

interface DashboardChartsProps {
  regionId?: string;
}

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(var(--warning))",
  "hsl(var(--info))",
  "hsl(var(--success))",
  "hsl(var(--destructive))",
  "hsl(var(--muted-foreground))",
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover/95 backdrop-blur-md border border-border rounded-xl shadow-elevated p-3 text-xs animate-scale-in">
      <p className="font-semibold text-popover-foreground mb-1.5">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2 py-0.5">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-semibold text-popover-foreground ml-auto">
            {typeof p.value === 'number' && p.name.toLowerCase().includes('revenue') ? `£${p.value.toLocaleString()}` : p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

const ChartHeader = ({ icon: Icon, title, subtitle, children }: { icon: any; title: string; subtitle: string; children?: React.ReactNode }) => (
  <div className="flex items-center justify-between mb-5">
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div>
        <h3 className="text-sm font-semibold font-display text-card-foreground">{title}</h3>
        <p className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</p>
      </div>
    </div>
    {children}
  </div>
);

const DashboardCharts = ({ regionId }: DashboardChartsProps) => {
  const [chartPeriod, setChartPeriod] = useState<"7d" | "14d" | "30d">("14d");
  const days = chartPeriod === "7d" ? 7 : chartPeriod === "30d" ? 30 : 14;

  const { data: jobs = [] } = useQuery({
    queryKey: ["dashboard-jobs"],
    queryFn: async () => {
      const { data } = await supabase.from("jobs").select("*");
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    return regionId && regionId !== "all" ? jobs.filter(j => j.region_id === regionId) : jobs;
  }, [jobs, regionId]);

  const trendData = useMemo(() => {
    return Array.from({ length: days }, (_, i) => {
      const day = subDays(new Date(), days - 1 - i);
      const dayStr = day.toDateString();
      const dayJobs = filtered.filter(j => new Date(j.created_at).toDateString() === dayStr);
      const completed = dayJobs.filter(j => j.status === "completed");
      return {
        date: format(day, days > 14 ? "MMM d" : "EEE d"),
        Created: dayJobs.length,
        Completed: completed.length,
        Revenue: completed.reduce((s, j) => s + (Number(j.total_price) || 0), 0),
      };
    });
  }, [filtered, days]);

  const statusData = useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.forEach(j => { counts[j.status] = (counts[j.status] || 0) + 1; });
    return Object.entries(counts)
      .map(([name, value]) => ({ name: name.replace(/_/g, " "), value }))
      .sort((a, b) => b.value - a.value);
  }, [filtered]);

  const priorityData = useMemo(() => {
    const counts: Record<string, { total: number; completed: number }> = {};
    filtered.forEach(j => {
      if (!counts[j.priority]) counts[j.priority] = { total: 0, completed: 0 };
      counts[j.priority].total++;
      if (j.status === "completed") counts[j.priority].completed++;
    });
    return Object.entries(counts).map(([name, v]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      Total: v.total,
      Completed: v.completed,
      rate: v.total > 0 ? Math.round((v.completed / v.total) * 100) : 0,
    }));
  }, [filtered]);

  // Completion rate radial
  const completionRate = useMemo(() => {
    const total = filtered.length;
    const completed = filtered.filter(j => j.status === "completed").length;
    return total > 0 ? Math.round((completed / total) * 100) : 0;
  }, [filtered]);

  const radialData = [{ name: "Completion", value: completionRate, fill: "hsl(var(--primary))" }];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* Area chart */}
      <div className="lg:col-span-8 bg-card rounded-2xl shadow-card border border-border p-5 animate-fade-in">
        <ChartHeader icon={TrendingUp} title="Job Trends" subtitle={`Last ${days} days`}>
          <div className="flex bg-muted/50 rounded-lg p-0.5 gap-0.5">
            {(["7d", "14d", "30d"] as const).map(p => (
              <button
                key={p}
                onClick={() => setChartPeriod(p)}
                className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-all duration-200 ${
                  chartPeriod === p
                    ? "bg-card shadow-sm text-card-foreground"
                    : "text-muted-foreground hover:text-card-foreground"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </ChartHeader>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={trendData}>
            <defs>
              <linearGradient id="gradCreated" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradCompleted" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity={0.2} />
                <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} width={30} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="Created" stroke="hsl(var(--primary))" fill="url(#gradCreated)" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, fill: "hsl(var(--card))" }} animationDuration={1200} />
            <Area type="monotone" dataKey="Completed" stroke="hsl(var(--accent))" fill="url(#gradCompleted)" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, fill: "hsl(var(--card))" }} animationDuration={1400} />
          </AreaChart>
        </ResponsiveContainer>
        <div className="flex items-center justify-center gap-6 mt-3">
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><span className="w-3 h-1 rounded-full bg-primary" /> Created</span>
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><span className="w-3 h-1 rounded-full bg-accent" /> Completed</span>
        </div>
      </div>

      {/* Status donut + Completion radial */}
      <div className="lg:col-span-4 flex flex-col gap-4">
        <div className="bg-card rounded-2xl shadow-card border border-border p-5 animate-fade-in flex-1" style={{ animationDelay: '100ms' }}>
          <ChartHeader icon={PieIcon} title="Status Distribution" subtitle={`${filtered.length} total jobs`} />
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={statusData} cx="50%" cy="50%" innerRadius={42} outerRadius={65} paddingAngle={3} dataKey="value" strokeWidth={0} animationDuration={1000} animationBegin={200}>
                {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-1">
            {statusData.map((s, i) => (
              <div key={s.name} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <span className="truncate capitalize">{s.name}</span>
                <span className="font-semibold text-card-foreground ml-auto">{s.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card rounded-2xl shadow-card border border-border p-5 animate-fade-in" style={{ animationDelay: '200ms' }}>
          <ChartHeader icon={Target} title="Completion Rate" subtitle="Overall performance" />
          <div className="flex items-center justify-center">
            <ResponsiveContainer width={120} height={120}>
              <RadialBarChart cx="50%" cy="50%" innerRadius="70%" outerRadius="100%" data={radialData} startAngle={90} endAngle={-270}>
                <RadialBar dataKey="value" cornerRadius={10} background={{ fill: "hsl(var(--muted))" }} animationDuration={1200} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="absolute text-center">
              <p className="text-2xl font-bold font-display text-card-foreground">{completionRate}%</p>
              <p className="text-[9px] text-muted-foreground">completed</p>
            </div>
          </div>
        </div>
      </div>

      {/* Priority bar chart */}
      <div className="lg:col-span-12 bg-card rounded-2xl shadow-card border border-border p-5 animate-fade-in" style={{ animationDelay: '150ms' }}>
        <ChartHeader icon={BarChart3} title="Priority Breakdown" subtitle="Total vs completed by priority level">
          <div className="flex items-center gap-4">
            {priorityData.map(p => (
              <div key={p.name} className="text-center hidden sm:block">
                <p className="text-[10px] text-muted-foreground">{p.name}</p>
                <p className="text-xs font-bold text-card-foreground">{p.rate}%</p>
              </div>
            ))}
          </div>
        </ChartHeader>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={priorityData} barGap={6} barSize={20}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} width={30} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="Total" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} animationDuration={1000} />
            <Bar dataKey="Completed" fill="hsl(var(--accent))" radius={[6, 6, 0, 0]} animationDuration={1200} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default DashboardCharts;