import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Briefcase, CheckCircle, Clock } from "lucide-react";

const TeamLeadDashboard = () => {
  const { data: engineers = [] } = useQuery({
    queryKey: ["tl-engineers"],
    queryFn: async () => {
      const { data } = await supabase.from("engineers").select("*");
      return data ?? [];
    },
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ["tl-jobs"],
    queryFn: async () => {
      const { data } = await supabase.from("jobs").select("*");
      return data ?? [];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["tl-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, full_name");
      return data ?? [];
    },
  });

  const profileMap = new Map(profiles.map((p) => [p.user_id, p.full_name]));
  const activeEngineers = engineers.filter((e) => e.is_available);
  const activeJobs = jobs.filter((j) => !["completed", "cancelled"].includes(j.status));
  const completedJobs = jobs.filter((j) => j.status === "completed");
  const pendingJobs = jobs.filter((j) => j.status === "pending");

  return (
    <AppLayout title="Team Lead Dashboard" subtitle="Manage engineers, jobs, and performance">
      <div className="space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Engineers</p>
                <p className="text-2xl font-bold text-foreground">{engineers.length}</p>
                <p className="text-xs text-muted-foreground">{activeEngineers.length} available</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-accent-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Active Jobs</p>
                <p className="text-2xl font-bold text-foreground">{activeJobs.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold text-foreground">{completedJobs.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pending Assignment</p>
                <p className="text-2xl font-bold text-foreground">{pendingJobs.length}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Engineer Overview */}
        <Card>
          <CardContent className="p-0">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">Engineer Overview</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Engineer</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Specialty</th>
                    <th className="text-center px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Status</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Rating</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Jobs Done</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Active Jobs</th>
                  </tr>
                </thead>
                <tbody>
                  {engineers.map((eng) => {
                    const engJobs = jobs.filter((j) => j.engineer_id === eng.id && !["completed", "cancelled"].includes(j.status));
                    return (
                      <tr key={eng.id} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="px-5 py-3 font-medium text-foreground">{profileMap.get(eng.user_id) || "Unknown"}</td>
                        <td className="px-5 py-3 text-muted-foreground">{eng.specialty}</td>
                        <td className="px-5 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${eng.is_available ? "bg-green-500/10 text-green-500" : "bg-muted text-muted-foreground"}`}>
                            {eng.is_available ? "Available" : "Busy"}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right">⭐ {Number(eng.rating).toFixed(1)}</td>
                        <td className="px-5 py-3 text-right">{eng.jobs_completed ?? 0}</td>
                        <td className="px-5 py-3 text-right font-medium text-foreground">{engJobs.length}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Pending Jobs */}
        <Card>
          <CardContent className="p-0">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">Jobs Needing Attention</h3>
            </div>
            <div className="divide-y divide-border">
              {pendingJobs.length === 0 && (
                <p className="px-5 py-8 text-center text-muted-foreground text-sm">All jobs are assigned 🎉</p>
              )}
              {pendingJobs.map((job) => (
                <div key={job.id} className="px-5 py-3 flex items-center justify-between hover:bg-muted/30">
                  <div>
                    <p className="text-sm font-medium text-foreground">{job.title}</p>
                    <p className="text-xs text-muted-foreground">{job.service_type} · {job.location}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold uppercase ${
                    job.priority === "urgent" ? "bg-destructive/10 text-destructive"
                    : job.priority === "high" ? "bg-amber-500/10 text-amber-500"
                    : "bg-muted text-muted-foreground"
                  }`}>
                    {job.priority}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default TeamLeadDashboard;
