import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DollarSign, TrendingUp, Users, Percent } from "lucide-react";
// import AskAIButton from "@/components/ai/AskAIButton";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area,
} from "recharts";
import JobStatusBadge from "@/components/dashboard/JobStatusBadge";
import AccountingTab from "@/components/financials/AccountingTab";

const COLORS = ["hsl(var(--primary))", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

const Financials = () => {
  const { data: jobs = [] } = useQuery({
    queryKey: ["fin-jobs"],
    queryFn: async () => {
      const { data } = await supabase.from("jobs").select("*");
      return data ?? [];
    },
  });

  const { data: engineers = [] } = useQuery({
    queryKey: ["fin-engineers"],
    queryFn: async () => {
      const { data } = await supabase.from("engineers").select("*");
      return data ?? [];
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["fin-clients"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, company_name");
      return data ?? [];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["fin-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, full_name");
      return data ?? [];
    },
  });

  const clientMap = new Map(clients.map((c) => [c.id, c.company_name]));
  const profileMap = new Map(profiles.map((p) => [p.user_id, p.full_name]));
  const engineerNameMap = new Map(engineers.map((e) => [e.id, profileMap.get(e.user_id) ?? e.specialty]));

  // Financial aggregates
  const completedJobs = jobs.filter((j) => j.status === "completed");
  const totalRevenue = completedJobs.reduce((s, j) => s + (Number(j.total_price) || 0), 0);
  const totalEngineerCost = completedJobs.reduce((s, j) => s + (Number(j.engineer_charge) || 0), 0);
  const totalMargin = completedJobs.reduce((s, j) => s + (Number(j.platform_margin) || 0), 0);
  const avgJobValue = completedJobs.length ? totalRevenue / completedJobs.length : 0;
  const marginPercent = totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : 0;

  // Pending revenue (non-completed priced jobs)
  const pendingRevenue = jobs
    .filter((j) => !["completed", "cancelled"].includes(j.status) && j.total_price)
    .reduce((s, j) => s + (Number(j.total_price) || 0), 0);

  // Revenue by service type
  const revenueByService = completedJobs.reduce<Record<string, number>>((acc, j) => {
    acc[j.service_type] = (acc[j.service_type] || 0) + (Number(j.total_price) || 0);
    return acc;
  }, {});
  const serviceRevenueData = Object.entries(revenueByService).map(([name, value]) => ({ name, value }));

  // Revenue by month
  const monthlyData = jobs.reduce<Record<string, { revenue: number; cost: number; margin: number }>>((acc, j) => {
    const month = new Date(j.created_at).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    if (!acc[month]) acc[month] = { revenue: 0, cost: 0, margin: 0 };
    acc[month].revenue += Number(j.total_price) || 0;
    acc[month].cost += Number(j.engineer_charge) || 0;
    acc[month].margin += Number(j.platform_margin) || 0;
    return acc;
  }, {});
  const monthlyChartData = Object.entries(monthlyData).map(([month, d]) => ({ month, ...d }));

  // Engineer cost breakdown
  const engineerCosts = engineers.map((eng) => {
    const engJobs = completedJobs.filter((j) => j.engineer_id === eng.id);
    const totalCharge = engJobs.reduce((s, j) => s + (Number(j.engineer_charge) || 0), 0);
    const totalRev = engJobs.reduce((s, j) => s + (Number(j.total_price) || 0), 0);
    return {
      name: profileMap.get(eng.user_id) || eng.specialty,
      charge: totalCharge,
      revenue: totalRev,
      margin: totalRev - totalCharge,
      jobs: engJobs.length,
      rate: Number(eng.hourly_rate) || 0,
    };
  }).filter((e) => e.jobs > 0).sort((a, b) => b.revenue - a.revenue);

  // Margin breakdown pie
  const marginPieData = [
    { name: "Platform Margin", value: totalMargin },
    { name: "Engineer Costs", value: totalEngineerCost },
    { name: "Base Costs", value: Math.max(totalRevenue - totalMargin - totalEngineerCost, 0) },
  ].filter((d) => d.value > 0);

  return (
    <AppLayout title="Financials" subtitle="Pricing, charges, margins, and payment tracking">
      <div className="space-y-6">
        <div className="flex justify-end">
          {/* <AskAIButton prompt="Analyze revenue, profit margins, engineer charges vs platform margins, and suggest pricing optimizations." label="AI Analysis" /> */}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Revenue</p>
                <p className="text-xl font-bold text-foreground">${totalRevenue.toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Platform Margin</p>
                <p className="text-xl font-bold text-foreground">${totalMargin.toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Engineer Costs</p>
                <p className="text-xl font-bold text-foreground">${totalEngineerCost.toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <Percent className="w-5 h-5 text-accent-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Margin %</p>
                <p className="text-xl font-bold text-foreground">{marginPercent.toFixed(1)}%</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-xs text-muted-foreground">Pending Revenue</p>
              <p className="text-xl font-bold text-foreground">${pendingRevenue.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">Avg job: ${avgJobValue.toFixed(0)}</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Revenue Overview</TabsTrigger>
            <TabsTrigger value="accounting">Accounting</TabsTrigger>
            <TabsTrigger value="engineers">Engineer Charges</TabsTrigger>
            <TabsTrigger value="jobs">Job Pricing</TabsTrigger>
          </TabsList>

          <TabsContent value="accounting" className="space-y-4">
            <AccountingTab />
          </TabsContent>

          {/* Revenue Overview */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader><CardTitle className="text-base">Revenue vs Costs Over Time</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={monthlyChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                      <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.15} name="Revenue" />
                      <Area type="monotone" dataKey="cost" stroke="#ef4444" fill="#ef4444" fillOpacity={0.1} name="Engineer Costs" />
                      <Area type="monotone" dataKey="margin" stroke="#10b981" fill="#10b981" fillOpacity={0.1} name="Margin" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">Cost Breakdown</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={marginPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {marginPieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(value: number) => `$${value.toLocaleString()}`} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card className="lg:col-span-2">
                <CardHeader><CardTitle className="text-base">Revenue by Service Type</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={serviceRevenueData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `$${v}`} />
                      <YAxis dataKey="name" type="category" width={140} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                      <Tooltip formatter={(value: number) => `$${value.toLocaleString()}`} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                      <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="Revenue" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Engineer Charges */}
          <TabsContent value="engineers" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Engineer Financial Breakdown</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[600px]">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="text-left py-3 px-3 font-medium">Engineer</th>
                        <th className="text-right py-3 px-3 font-medium">Jobs</th>
                        <th className="text-right py-3 px-3 font-medium">Rate/hr</th>
                        <th className="text-right py-3 px-3 font-medium">Total Charged</th>
                        <th className="text-right py-3 px-3 font-medium">Revenue Generated</th>
                        <th className="text-right py-3 px-3 font-medium">Net Margin</th>
                        <th className="text-right py-3 px-3 font-medium">Margin %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {engineerCosts.map((eng, i) => {
                        const mp = eng.revenue > 0 ? ((eng.margin / eng.revenue) * 100).toFixed(1) : "0";
                        return (
                          <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
                            <td className="py-3 px-3 font-medium text-foreground">{eng.name}</td>
                            <td className="py-3 px-3 text-right text-foreground">{eng.jobs}</td>
                            <td className="py-3 px-3 text-right text-muted-foreground">${eng.rate}</td>
                            <td className="py-3 px-3 text-right text-foreground">${eng.charge.toLocaleString()}</td>
                            <td className="py-3 px-3 text-right text-foreground">${eng.revenue.toLocaleString()}</td>
                            <td className="py-3 px-3 text-right font-semibold text-green-500">${eng.margin.toLocaleString()}</td>
                            <td className="py-3 px-3 text-right text-muted-foreground">{mp}%</td>
                          </tr>
                        );
                      })}
                      {engineerCosts.length === 0 && (
                        <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">No completed jobs with financial data yet</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Revenue vs Charges by Engineer</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={engineerCosts}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} angle={-15} textAnchor="end" height={60} />
                    <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `$${v}`} />
                    <Tooltip formatter={(value: number) => `$${value.toLocaleString()}`} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                    <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Revenue" />
                    <Bar dataKey="charge" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Engineer Charge" />
                    <Bar dataKey="margin" fill="#10b981" radius={[4, 4, 0, 0]} name="Net Margin" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Job Pricing */}
          <TabsContent value="jobs" className="space-y-4">
            <Card>
              <CardContent className="p-0">
                <div className="px-5 py-4 border-b border-border">
                  <h3 className="text-sm font-semibold text-foreground">Job Pricing Details</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[700px]">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Job</th>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Client</th>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Engineer</th>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Status</th>
                        <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Base Price</th>
                        <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Eng. Charge</th>
                        <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Margin</th>
                        <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {jobs.filter((j) => j.total_price).map((job) => (
                        <tr key={job.id} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="px-5 py-3">
                            <p className="font-medium text-foreground">{job.title}</p>
                            <p className="text-xs text-muted-foreground">{job.service_type}</p>
                          </td>
                          <td className="px-5 py-3 text-foreground">{clientMap.get(job.client_id) ?? "—"}</td>
                          <td className="px-5 py-3 text-foreground">{job.engineer_id ? engineerNameMap.get(job.engineer_id) ?? "—" : <span className="text-muted-foreground italic">—</span>}</td>
                          <td className="px-5 py-3"><JobStatusBadge status={job.status} /></td>
                          <td className="px-5 py-3 text-right text-foreground">${Number(job.base_price || 0).toLocaleString()}</td>
                          <td className="px-5 py-3 text-right text-foreground">${Number(job.engineer_charge || 0).toLocaleString()}</td>
                          <td className="px-5 py-3 text-right font-medium text-green-500">${Number(job.platform_margin || 0).toLocaleString()}</td>
                          <td className="px-5 py-3 text-right font-bold text-foreground">${Number(job.total_price || 0).toLocaleString()}</td>
                        </tr>
                      ))}
                      {jobs.filter((j) => j.total_price).length === 0 && (
                        <tr><td colSpan={8} className="py-8 text-center text-muted-foreground">No priced jobs yet</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Financials;
