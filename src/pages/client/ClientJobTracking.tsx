import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/layout/AppLayout";
import { Search, MapPin, Clock, User } from "lucide-react";
import { format } from "date-fns";
import RateEngineerDialog from "@/components/client/RateEngineerDialog";
import ClientSupportWidget from "@/components/chat/ClientSupportWidget";

const statusOrder = ["pending", "assigned", "accepted", "on_the_way", "in_progress", "completed", "cancelled"] as const;

const ClientJobTracking = () => {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [ratingJob, setRatingJob] = useState<{ jobId: string; engineerId: string; clientId: string } | null>(null);

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
    queryKey: ["client-jobs-tracking", clientRecord?.id],
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

  const { data: existingRatings = [] } = useQuery({
    queryKey: ["client-ratings", clientRecord?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("engineer_ratings")
        .select("job_id")
        .eq("client_id", clientRecord!.id);
      if (error) throw error;
      return data;
    },
    enabled: !!clientRecord?.id,
  });

  const ratedJobIds = new Set(existingRatings.map((r) => r.job_id));

  const filtered = jobs.filter((j) => {
    const matchSearch = j.title.toLowerCase().includes(search.toLowerCase()) ||
      j.location.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || j.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const getStatusStep = (status: string) => statusOrder.indexOf(status as any);

  return (
    <AppLayout title="Job Tracking" subtitle="Monitor your service requests in real-time">
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search jobs..."
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-input bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-input bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
          >
            <option value="all">All Statuses</option>
            {statusOrder.map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
            ))}
          </select>
        </div>

        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading jobs...</div>
        ) : filtered.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-8 text-center text-sm text-muted-foreground">
            No jobs found.
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((job) => (
              <div key={job.id} className="bg-card rounded-xl border border-border shadow-card p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-semibold text-card-foreground">{job.title}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{job.service_type}</p>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${
                    job.priority === "urgent" ? "bg-destructive/10 text-destructive" :
                    job.priority === "high" ? "bg-warning/10 text-warning" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    {job.priority}
                  </span>
                </div>

                {/* Status progress */}
                <div className="mb-4">
                  <div className="flex items-center gap-1">
                    {statusOrder.filter(s => s !== "cancelled").map((s, i) => {
                      const current = getStatusStep(job.status);
                      const isCancelled = job.status === "cancelled";
                      const isActive = !isCancelled && i <= current;
                      return (
                        <div key={s} className="flex-1 flex flex-col items-center">
                          <div className={`h-1.5 w-full rounded-full ${
                            isCancelled ? "bg-destructive/30" :
                            isActive ? "bg-primary" : "bg-muted"
                          }`} />
                          <span className={`text-[10px] mt-1 capitalize ${
                            isActive ? "text-primary font-medium" : "text-muted-foreground"
                          }`}>
                            {s.replace(/_/g, " ")}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {job.status === "cancelled" && (
                    <p className="text-xs text-destructive mt-2 font-medium">This job has been cancelled</p>
                  )}
                </div>

                <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{job.location}</span>
                  {job.scheduled_at && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {format(new Date(job.scheduled_at), "PPp")}
                    </span>
                  )}
                  {job.engineer_id && (
                    <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" />Engineer assigned</span>
                  )}
                  {job.total_price && (
                    <span className="font-medium text-card-foreground">${Number(job.total_price).toFixed(2)}</span>
                  )}
                </div>

                {job.status === "completed" && job.engineer_id && clientRecord?.id && !ratedJobIds.has(job.id) && (
                  <button
                    onClick={() => setRatingJob({ jobId: job.id, engineerId: job.engineer_id!, clientId: clientRecord.id })}
                    className="mt-4 px-4 py-2 rounded-lg gradient-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
                  >
                    Rate Engineer
                  </button>
                )}
                {ratedJobIds.has(job.id) && (
                  <p className="mt-3 text-xs text-success font-medium">✓ Rated</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {ratingJob && (
        <RateEngineerDialog
          jobId={ratingJob.jobId}
          engineerId={ratingJob.engineerId}
          clientId={ratingJob.clientId}
          onClose={() => setRatingJob(null)}
        />
      )}
      <ClientSupportWidget />
    </AppLayout>
  );
};

export default ClientJobTracking;
