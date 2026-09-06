import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/layout/AppLayout";
import { Building2, Briefcase, DollarSign, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";

const PartnerDashboard = () => {
  const { user } = useAuth();

  const { data: partner } = useQuery({
    queryKey: ["partner-record", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("partners")
        .select("id, company_name, commission_rate")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["partner-clients", partner?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id")
        .eq("partner_id", partner!.id);
      if (error) throw error;
      return data;
    },
    enabled: !!partner?.id,
  });

  const clientIds = clients.map((c) => c.id);

  const { data: jobs = [] } = useQuery({
    queryKey: ["partner-jobs", clientIds],
    queryFn: async () => {
      if (clientIds.length === 0) return [];
      const { data, error } = await supabase
        .from("jobs")
        .select("*")
        .in("client_id", clientIds)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: clientIds.length > 0,
  });

  const totalRevenue = jobs
    .filter((j) => j.status === "completed" && j.total_price)
    .reduce((sum, j) => sum + Number(j.total_price), 0);
  const activeJobs = jobs.filter((j) => !["completed", "cancelled"].includes(j.status)).length;

  const stats = [
    { label: "Clients", value: clients.length, icon: Building2, color: "text-primary" },
    { label: "Total Jobs", value: jobs.length, icon: Briefcase, color: "text-info" },
    { label: "Active Jobs", value: activeJobs, icon: TrendingUp, color: "text-warning" },
    { label: "Revenue", value: `$${totalRevenue.toFixed(0)}`, icon: DollarSign, color: "text-success" },
  ];

  return (
    <AppLayout title="Partner Dashboard" subtitle={partner?.company_name ?? "Loading..."}>
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((s) => (
            <div key={s.label} className="bg-card rounded-xl border border-border p-5 shadow-card">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">{s.label}</span>
                <s.icon className={`w-5 h-5 ${s.color}`} />
              </div>
              <p className="text-2xl font-bold text-card-foreground">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-card rounded-xl border border-border shadow-card">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <h2 className="text-base font-semibold text-card-foreground">Recent Jobs</h2>
              <Link to="/partner/jobs" className="text-xs text-primary hover:underline">View all</Link>
            </div>
            <div className="divide-y divide-border">
              {jobs.length === 0 ? (
                <div className="p-5 text-sm text-muted-foreground">No jobs yet.</div>
              ) : jobs.slice(0, 5).map((job) => (
                <div key={job.id} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-card-foreground">{job.title}</p>
                    <p className="text-xs text-muted-foreground">{job.service_type} · {job.location}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${
                    job.status === "completed" ? "bg-success/10 text-success" :
                    job.status === "cancelled" ? "bg-destructive/10 text-destructive" :
                    "bg-warning/10 text-warning"
                  }`}>{job.status.replace(/_/g, " ")}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border shadow-card">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <h2 className="text-base font-semibold text-card-foreground">Your Clients</h2>
              <Link to="/partner/clients" className="text-xs text-primary hover:underline">Manage</Link>
            </div>
            <div className="divide-y divide-border">
              {clients.length === 0 ? (
                <div className="p-5 text-sm text-muted-foreground">No clients yet. Add your first client.</div>
              ) : (
                <ClientList partnerId={partner?.id ?? ""} />
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

function ClientList({ partnerId }: { partnerId: string }) {
  const { data: clients = [] } = useQuery({
    queryKey: ["partner-clients-list", partnerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, company_name, contact_name, email")
        .eq("partner_id", partnerId)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
    enabled: !!partnerId,
  });

  return (
    <>
      {clients.map((c) => (
        <div key={c.id} className="p-4">
          <p className="text-sm font-medium text-card-foreground">{c.company_name}</p>
          <p className="text-xs text-muted-foreground">{c.contact_name} · {c.email}</p>
        </div>
      ))}
    </>
  );
}

export default PartnerDashboard;
