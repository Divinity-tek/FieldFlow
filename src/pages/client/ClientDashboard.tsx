import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/layout/AppLayout";
import ClientSupportWidget from "@/components/chat/ClientSupportWidget";
import { Briefcase, Clock, CheckCircle, AlertTriangle } from "lucide-react";

const ClientDashboard = () => {
  const { user } = useAuth();

  const { data: clientRecord } = useQuery({
    queryKey: ["client-record", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["client-jobs", clientRecord?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select("*")
        .eq("client_id", clientRecord!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!clientRecord?.id,
  });

  const stats = {
    total: jobs.length,
    active: jobs.filter((j) => !["completed", "cancelled"].includes(j.status)).length,
    completed: jobs.filter((j) => j.status === "completed").length,
    urgent: jobs.filter((j) => j.priority === "urgent").length,
  };

  const statCards = [
    { label: "Total Jobs", value: stats.total, icon: Briefcase, color: "text-primary" },
    { label: "Active", value: stats.active, icon: Clock, color: "text-info" },
    { label: "Completed", value: stats.completed, icon: CheckCircle, color: "text-success" },
    { label: "Urgent", value: stats.urgent, icon: AlertTriangle, color: "text-warning" },
  ];

  return (
    <AppLayout title="Client Dashboard" subtitle="Track your service requests">
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((s) => (
            <div key={s.label} className="bg-card rounded-xl border border-border p-5 shadow-card">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">{s.label}</span>
                <s.icon className={`w-5 h-5 ${s.color}`} />
              </div>
              <p className="text-2xl font-bold text-card-foreground">{isLoading ? "—" : s.value}</p>
            </div>
          ))}
        </div>

        <div className="bg-card rounded-xl border border-border shadow-card">
          <div className="p-5 border-b border-border">
            <h2 className="text-base font-semibold text-card-foreground">Recent Jobs</h2>
          </div>
          <div className="divide-y divide-border">
            {isLoading ? (
              <div className="p-5 text-sm text-muted-foreground">Loading...</div>
            ) : jobs.length === 0 ? (
              <div className="p-5 text-sm text-muted-foreground">No service requests yet.</div>
            ) : (
              jobs.slice(0, 10).map((job) => (
                <div key={job.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-card-foreground">{job.title}</p>
                    <p className="text-xs text-muted-foreground">{job.service_type} · {job.location}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${
                      job.status === "completed" ? "bg-success/10 text-success" :
                      job.status === "cancelled" ? "bg-destructive/10 text-destructive" :
                      job.status === "in_progress" ? "bg-info/10 text-info" :
                      "bg-warning/10 text-warning"
                    }`}>
                      {job.status.replace(/_/g, " ")}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${
                      job.priority === "urgent" ? "bg-destructive/10 text-destructive" :
                      job.priority === "high" ? "bg-warning/10 text-warning" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {job.priority}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      <ClientSupportWidget />
    </AppLayout>
  );
};

export default ClientDashboard;
