import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/layout/AppLayout";
import { format } from "date-fns";
import { CheckCircle, XCircle } from "lucide-react";
import ClientSupportWidget from "@/components/chat/ClientSupportWidget";

const ClientServiceHistory = () => {
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
    queryKey: ["client-history", clientRecord?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select("*")
        .eq("client_id", clientRecord!.id)
        .in("status", ["completed", "cancelled"])
        .order("completed_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!clientRecord?.id,
  });

  return (
    <AppLayout title="Service History" subtitle="Past completed and cancelled jobs">
      <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Job</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Service</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Location</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">Loading...</td></tr>
              ) : jobs.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">No history yet.</td></tr>
              ) : jobs.map((job) => (
                <tr key={job.id} className="hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium text-card-foreground">{job.title}</td>
                  <td className="px-4 py-3 text-muted-foreground">{job.service_type}</td>
                  <td className="px-4 py-3 text-muted-foreground">{job.location}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${
                      job.status === "completed" ? "text-success" : "text-destructive"
                    }`}>
                      {job.status === "completed" ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                      {job.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {job.completed_at ? format(new Date(job.completed_at), "PP") : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-card-foreground">
                    {job.total_price ? `$${Number(job.total_price).toFixed(2)}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <ClientSupportWidget />
    </AppLayout>
  );
};

export default ClientServiceHistory;
