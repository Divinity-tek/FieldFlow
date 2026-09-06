import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import {
  Briefcase, UserCheck, CheckCircle, AlertTriangle, Clock,
  Zap, MapPin, XCircle, Filter,
} from "lucide-react";

const eventConfig: Record<string, { icon: typeof Briefcase; color: string; bg: string; label: string }> = {
  pending: { icon: Clock, color: "text-warning", bg: "bg-warning/10", label: "New" },
  assigned: { icon: UserCheck, color: "text-info", bg: "bg-info/10", label: "Assigned" },
  accepted: { icon: CheckCircle, color: "text-primary", bg: "bg-primary/10", label: "Accepted" },
  on_the_way: { icon: MapPin, color: "text-accent", bg: "bg-accent/10", label: "En Route" },
  in_progress: { icon: Zap, color: "text-primary", bg: "bg-primary/10", label: "Active" },
  completed: { icon: CheckCircle, color: "text-success", bg: "bg-success/10", label: "Done" },
  cancelled: { icon: XCircle, color: "text-destructive", bg: "bg-destructive/10", label: "Cancelled" },
};

type FilterType = "all" | "active" | "completed";

const ActivityFeed = () => {
  const [filter, setFilter] = useState<FilterType>("all");

  const { data: recentJobs = [] } = useQuery({
    queryKey: ["activity-feed-jobs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("jobs")
        .select("id, title, status, service_type, client_id, engineer_id, created_at, updated_at")
        .order("updated_at", { ascending: false })
        .limit(25);
      return data ?? [];
    },
    refetchInterval: 15000,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["activity-feed-clients"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, company_name");
      return data ?? [];
    },
  });

  const { data: engineerNames = [] } = useQuery({
    queryKey: ["activity-feed-engineers"],
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
  const engMap = useMemo(() => new Map(engineerNames.map(e => [e.id, e.name])), [engineerNames]);

  const activities = useMemo(() => {
    let jobs = recentJobs;
    if (filter === "active") jobs = jobs.filter(j => !["completed", "cancelled"].includes(j.status));
    if (filter === "completed") jobs = jobs.filter(j => j.status === "completed");

    return jobs.map(job => {
      const config = eventConfig[job.status] || eventConfig.pending;
      const clientName = clientMap.get(job.client_id) || "Unknown";
      const engineerName = job.engineer_id ? engMap.get(job.engineer_id) : null;

      let description = "";
      switch (job.status) {
        case "pending": description = `New job "${job.title}" for ${clientName}`; break;
        case "assigned": description = `"${job.title}" → ${engineerName ?? "engineer"}`; break;
        case "accepted": description = `${engineerName ?? "Engineer"} accepted "${job.title}"`; break;
        case "on_the_way": description = `${engineerName ?? "Engineer"} en route → ${clientName}`; break;
        case "in_progress": description = `"${job.title}" in progress`; break;
        case "completed": description = `"${job.title}" completed ✓`; break;
        case "cancelled": description = `"${job.title}" cancelled`; break;
        default: description = `"${job.title}" — ${job.status}`;
      }

      return { id: job.id, description, time: job.updated_at, ...config };
    });
  }, [recentJobs, clientMap, engMap, filter]);

  return (
    <div className="bg-card rounded-2xl shadow-card border border-border animate-fade-in">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-success" />
            </span>
            <h3 className="text-sm font-semibold font-display text-card-foreground">Live Activity</h3>
          </div>
        </div>
        <div className="flex bg-muted/50 rounded-lg p-0.5 gap-0.5">
          {(["all", "active", "completed"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-all duration-200 capitalize ${
                filter === f
                  ? "bg-card shadow-sm text-card-foreground"
                  : "text-muted-foreground hover:text-card-foreground"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
      <div className="max-h-[380px] overflow-y-auto custom-scrollbar">
        {activities.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No activity found.</p>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-[27px] top-4 bottom-4 w-px bg-border/50" />
            {activities.map((activity, i) => {
              const Icon = activity.icon;
              return (
                <div
                  key={`${activity.id}-${i}`}
                  className="relative flex items-start gap-3 px-4 py-3 hover:bg-muted/20 transition-colors animate-fade-in"
                  style={{ animationDelay: `${Math.min(i * 50, 350)}ms` }}
                >
                  <div className={`relative z-10 w-7 h-7 rounded-lg ${activity.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                    <Icon className={`w-3.5 h-3.5 ${activity.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-card-foreground leading-relaxed">{activity.description}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${activity.bg} ${activity.color}`}>
                        {activity.label}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(activity.time), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivityFeed;