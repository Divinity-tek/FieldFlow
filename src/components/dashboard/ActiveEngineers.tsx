import { useMemo } from "react";
import { MapPin, Star } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const statusMap: Record<string, { label: string; dot: string; ring: string }> = {
  available: { label: "Available", dot: "bg-success", ring: "ring-success/30" },
  on_job: { label: "On Job", dot: "bg-accent", ring: "ring-accent/30" },
  on_the_way: { label: "En Route", dot: "bg-warning", ring: "ring-warning/30" },
  offline: { label: "Offline", dot: "bg-muted-foreground", ring: "ring-muted/30" },
};

interface ActiveEngineersProps {
  regionId?: string;
}

const ActiveEngineers = ({ regionId }: ActiveEngineersProps) => {
  const { data: engineers = [] } = useQuery({
    queryKey: ["dashboard-active-engineers"],
    queryFn: async () => {
      const { data: engs } = await supabase.from("engineers").select("*");
      if (!engs?.length) return [];
      const uids = engs.map(e => e.user_id);
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", uids);
      const pm = Object.fromEntries((profiles ?? []).map(p => [p.user_id, p.full_name]));
      return engs.map(e => ({
        ...e,
        name: pm[e.user_id] ?? "Unknown",
        initials: (pm[e.user_id] ?? "??").split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2),
        displayStatus: e.is_available ? "available" : "offline",
      }));
    },
  });

  const filtered = useMemo(() => {
    const list = regionId && regionId !== "all"
      ? engineers.filter(e => e.region_id === regionId)
      : engineers;
    return list.slice(0, 6);
  }, [engineers, regionId]);

  return (
    <div className="bg-card rounded-2xl shadow-card border border-border animate-fade-in stagger-2">
      <div className="flex items-center justify-between p-5 border-b border-border">
        <div>
          <h2 className="text-sm font-semibold font-display text-card-foreground">Engineers</h2>
          <p className="text-[10px] text-muted-foreground mt-0.5">{filtered.length} shown</p>
        </div>
      </div>
      <div className="divide-y divide-border/50">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No engineers found.</p>
        ) : (
          filtered.map((eng, i) => {
            const st = statusMap[eng.displayStatus] ?? statusMap.offline;
            return (
              <div key={eng.id} className={`flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors animate-fade-in stagger-${Math.min(i + 1, 7)}`}>
                <div className="relative">
                  <div className={`w-9 h-9 rounded-full gradient-primary flex items-center justify-center ring-2 ${st.ring}`}>
                    <span className="text-[10px] font-bold text-primary-foreground">{eng.initials}</span>
                  </div>
                  <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card ${st.dot}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-card-foreground truncate">{eng.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-muted-foreground">{eng.specialty}</span>
                    {eng.rating && (
                      <span className="flex items-center gap-0.5 text-[10px] text-warning">
                        <Star className="w-2.5 h-2.5 fill-warning" />
                        {eng.rating}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className={`text-[10px] font-semibold ${eng.displayStatus === "available" ? "text-success" : "text-muted-foreground"}`}>{st.label}</span>
                  <p className="text-[10px] text-muted-foreground">{eng.jobs_completed ?? 0} jobs</p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ActiveEngineers;
