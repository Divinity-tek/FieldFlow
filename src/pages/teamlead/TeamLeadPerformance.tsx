import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from "recharts";

const TeamLeadPerformance = () => {
  const { data: engineers = [] } = useQuery({
    queryKey: ["tl-perf-engineers"],
    queryFn: async () => {
      const { data } = await supabase.from("engineers").select("*");
      return data ?? [];
    },
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ["tl-perf-jobs"],
    queryFn: async () => {
      const { data } = await supabase.from("jobs").select("*");
      return data ?? [];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["tl-perf-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, full_name");
      return data ?? [];
    },
  });

  const profileMap = new Map(profiles.map((p) => [p.user_id, p.full_name]));

  // Per-engineer metrics
  const engMetrics = engineers.map((eng) => {
    const name = profileMap.get(eng.user_id) || eng.specialty;
    const engJobs = jobs.filter((j) => j.engineer_id === eng.id);
    const completed = engJobs.filter((j) => j.status === "completed").length;
    const active = engJobs.filter((j) => !["completed", "cancelled"].includes(j.status)).length;
    const revenue = engJobs.reduce((s, j) => s + (Number(j.total_price) || 0), 0);
    return {
      name,
      rating: Number(eng.rating) || 0,
      jobsCompleted: eng.jobs_completed ?? 0,
      activeJobs: active,
      completedThisPeriod: completed,
      revenue,
      hourlyRate: Number(eng.hourly_rate) || 0,
    };
  });

  // Radar data for top 5 engineers
  const topEngineers = [...engMetrics].sort((a, b) => b.jobsCompleted - a.jobsCompleted).slice(0, 5);
  const radarData = topEngineers.map((e) => ({
    name: e.name.split(" ")[0],
    rating: e.rating * 20, // scale to 100
    jobs: Math.min(e.jobsCompleted, 100),
    revenue: Math.min(e.revenue / 100, 100),
  }));

  // Workload distribution
  const workloadData = engMetrics.map((e) => ({
    name: e.name.split(" ")[0],
    active: e.activeJobs,
    completed: e.completedThisPeriod,
  }));

  return (
    <AppLayout title="Performance Tracking" subtitle="Engineer metrics and team performance">
      <div className="space-y-6">
        {/* Leaderboard */}
        <Card>
          <CardHeader><CardTitle className="text-base">Engineer Leaderboard</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left py-3 px-3 font-medium">Rank</th>
                    <th className="text-left py-3 px-3 font-medium">Engineer</th>
                    <th className="text-right py-3 px-3 font-medium">Rating</th>
                    <th className="text-right py-3 px-3 font-medium">Jobs Done</th>
                    <th className="text-right py-3 px-3 font-medium">Active</th>
                    <th className="text-right py-3 px-3 font-medium">Revenue</th>
                    <th className="text-right py-3 px-3 font-medium">Rate/hr</th>
                  </tr>
                </thead>
                <tbody>
                  {[...engMetrics].sort((a, b) => b.jobsCompleted - a.jobsCompleted).map((eng, i) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-3 px-3 font-bold text-foreground">#{i + 1}</td>
                      <td className="py-3 px-3 font-medium text-foreground">{eng.name}</td>
                      <td className="py-3 px-3 text-right">⭐ {eng.rating.toFixed(1)}</td>
                      <td className="py-3 px-3 text-right text-foreground">{eng.jobsCompleted}</td>
                      <td className="py-3 px-3 text-right text-foreground">{eng.activeJobs}</td>
                      <td className="py-3 px-3 text-right text-foreground">${eng.revenue.toLocaleString()}</td>
                      <td className="py-3 px-3 text-right text-muted-foreground">${eng.hourlyRate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Workload Distribution */}
          <Card>
            <CardHeader><CardTitle className="text-base">Workload Distribution</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={workloadData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Bar dataKey="active" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Active Jobs" />
                  <Bar dataKey="completed" fill="#10b981" radius={[4, 4, 0, 0]} name="Completed" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Radar */}
          <Card>
            <CardHeader><CardTitle className="text-base">Top Engineers Performance</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis dataKey="name" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                  <PolarRadiusAxis tick={{ fontSize: 10 }} />
                  <Radar dataKey="rating" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} name="Rating" />
                  <Radar dataKey="jobs" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.15} name="Jobs" />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default TeamLeadPerformance;
