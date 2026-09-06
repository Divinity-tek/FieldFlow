import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import JobStatusBadge from "./JobStatusBadge";

const priorityStyles: Record<string, string> = {
  low: "text-muted-foreground bg-muted/50",
  medium: "text-info bg-info/10",
  high: "text-warning bg-warning/10",
  urgent: "text-destructive bg-destructive/10",
};

interface RecentJobsProps {
  regionId?: string;
}

const RecentJobs = ({ regionId }: RecentJobsProps) => {
  const { data: jobs = [] } = useQuery({
    queryKey: ["dashboard-recent-jobs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("jobs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      return data ?? [];
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["dashboard-clients"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, company_name");
      return data ?? [];
    },
  });

  const { data: engineers = [] } = useQuery({
    queryKey: ["dashboard-engineers-names"],
    queryFn: async () => {
      const { data: engs } = await supabase.from("engineers").select("id, user_id");
      if (!engs?.length) return [];
      const uids = engs.map(e => e.user_id);
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", uids);
      const pm = Object.fromEntries((profiles ?? []).map(p => [p.user_id, p.full_name]));
      return engs.map(e => ({ id: e.id, name: pm[e.user_id] ?? "Unknown" }));
    },
  });

  const clientMap = useMemo(() => new Map(clients.map(c => [c.id, c.company_name])), [clients]);
  const engineerMap = useMemo(() => new Map(engineers.map(e => [e.id, e.name])), [engineers]);

  const filtered = useMemo(() => {
    if (!regionId || regionId === "all") return jobs;
    return jobs.filter(j => j.region_id === regionId);
  }, [jobs, regionId]);

  return (
    <div className="bg-card rounded-2xl shadow-card border border-border animate-fade-in">
      <div className="flex items-center justify-between p-5 border-b border-border">
        <div>
          <h2 className="text-sm font-semibold font-display text-card-foreground">Recent Jobs</h2>
          <p className="text-[10px] text-muted-foreground mt-0.5">{filtered.length} jobs</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No jobs found.</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className="text-left px-5 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Job</th>
                <th className="text-left px-5 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Client</th>
                <th className="text-left px-5 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Engineer</th>
                <th className="text-left px-5 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="text-left px-5 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Priority</th>
                <th className="text-right px-5 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Price</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((job, i) => (
                <tr key={job.id} className={`border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors animate-fade-in stagger-${Math.min(i + 1, 7)}`}>
                  <td className="px-5 py-3">
                    <p className="text-sm font-medium text-card-foreground truncate max-w-[160px]">{job.title}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">{job.id.slice(0, 8)}</p>
                  </td>
                  <td className="px-5 py-3 text-sm text-card-foreground">{clientMap.get(job.client_id) ?? "—"}</td>
                  <td className="px-5 py-3 text-sm text-card-foreground">
                    {job.engineer_id ? engineerMap.get(job.engineer_id) ?? "—" : <span className="text-muted-foreground italic text-xs">Unassigned</span>}
                  </td>
                  <td className="px-5 py-3"><JobStatusBadge status={job.status} /></td>
                  <td className="px-5 py-3">
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${priorityStyles[job.priority]}`}>{job.priority}</span>
                  </td>
                  <td className="px-5 py-3 text-right text-sm font-semibold text-card-foreground font-display">
                    {job.total_price ? `£${Number(job.total_price).toLocaleString()}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default RecentJobs;
