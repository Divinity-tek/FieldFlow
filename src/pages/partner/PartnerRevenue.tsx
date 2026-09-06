import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/layout/AppLayout";
import { DollarSign, TrendingUp, ArrowUpRight, ArrowDownRight } from "lucide-react";

const PartnerRevenue = () => {
  const { user } = useAuth();

  const { data: partner } = useQuery({
    queryKey: ["partner-record", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("partners").select("id, commission_rate").eq("user_id", user!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["partner-clients-rev", partner?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, company_name").eq("partner_id", partner!.id);
      if (error) throw error;
      return data;
    },
    enabled: !!partner?.id,
  });

  const clientIds = clients.map((c) => c.id);

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["partner-revenue-jobs", clientIds],
    queryFn: async () => {
      if (clientIds.length === 0) return [];
      const { data, error } = await supabase
        .from("jobs")
        .select("id, title, client_id, total_price, status, completed_at, service_type")
        .in("client_id", clientIds)
        .eq("status", "completed")
        .order("completed_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: clientIds.length > 0,
  });

  const clientMap = new Map(clients.map((c) => [c.id, c.company_name]));
  const totalRevenue = jobs.reduce((sum, j) => sum + Number(j.total_price ?? 0), 0);
  const commissionRate = partner?.commission_rate ?? 0;
  const commission = totalRevenue * (Number(commissionRate) / 100);

  // Group by client
  const revenueByClient = new Map<string, number>();
  jobs.forEach((j) => {
    const current = revenueByClient.get(j.client_id) ?? 0;
    revenueByClient.set(j.client_id, current + Number(j.total_price ?? 0));
  });

  const clientRevenue = Array.from(revenueByClient.entries())
    .map(([clientId, revenue]) => ({ clientId, name: clientMap.get(clientId) ?? "Unknown", revenue }))
    .sort((a, b) => b.revenue - a.revenue);

  return (
    <AppLayout title="Revenue Tracking" subtitle="Monitor earnings and commissions">
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-card rounded-xl border border-border p-5 shadow-card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Total Revenue</span>
              <DollarSign className="w-5 h-5 text-success" />
            </div>
            <p className="text-2xl font-bold text-card-foreground">${totalRevenue.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground mt-1">{jobs.length} completed jobs</p>
          </div>
          <div className="bg-card rounded-xl border border-border p-5 shadow-card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Your Commission</span>
              <TrendingUp className="w-5 h-5 text-primary" />
            </div>
            <p className="text-2xl font-bold text-card-foreground">${commission.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground mt-1">{commissionRate}% rate</p>
          </div>
          <div className="bg-card rounded-xl border border-border p-5 shadow-card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Avg Job Value</span>
              <ArrowUpRight className="w-5 h-5 text-info" />
            </div>
            <p className="text-2xl font-bold text-card-foreground">
              ${jobs.length > 0 ? (totalRevenue / jobs.length).toFixed(2) : "0.00"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-card rounded-xl border border-border shadow-card">
            <div className="p-5 border-b border-border">
              <h2 className="text-base font-semibold text-card-foreground">Revenue by Client</h2>
            </div>
            <div className="divide-y divide-border">
              {clientRevenue.length === 0 ? (
                <div className="p-5 text-sm text-muted-foreground">No completed jobs yet.</div>
              ) : clientRevenue.map((cr) => (
                <div key={cr.clientId} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-card-foreground">{cr.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {jobs.filter(j => j.client_id === cr.clientId).length} jobs
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-success">${cr.revenue.toFixed(2)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border shadow-card">
            <div className="p-5 border-b border-border">
              <h2 className="text-base font-semibold text-card-foreground">Recent Completed Jobs</h2>
            </div>
            <div className="divide-y divide-border">
              {isLoading ? (
                <div className="p-5 text-sm text-muted-foreground">Loading...</div>
              ) : jobs.length === 0 ? (
                <div className="p-5 text-sm text-muted-foreground">No completed jobs yet.</div>
              ) : jobs.slice(0, 8).map((job) => (
                <div key={job.id} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-card-foreground">{job.title}</p>
                    <p className="text-xs text-muted-foreground">{job.service_type} · {clientMap.get(job.client_id)}</p>
                  </div>
                  <p className="text-sm font-semibold text-card-foreground">
                    {job.total_price ? `$${Number(job.total_price).toFixed(2)}` : "—"}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default PartnerRevenue;
