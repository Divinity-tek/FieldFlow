import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Star, MapPin, Phone, ToggleLeft, ToggleRight } from "lucide-react";
import { toast } from "sonner";

const TeamLeadEngineers = () => {
  const [search, setSearch] = useState("");

  const { data: engineers = [], refetch } = useQuery({
    queryKey: ["tl-manage-engineers"],
    queryFn: async () => {
      const { data } = await supabase.from("engineers").select("*");
      return data ?? [];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["tl-manage-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, full_name, phone");
      return data ?? [];
    },
  });

  const profileMap = new Map(profiles.map((p) => [p.user_id, p]));

  const toggleAvailability = async (engineerId: string, currentStatus: boolean | null) => {
    const { error } = await supabase
      .from("engineers")
      .update({ is_available: !currentStatus })
      .eq("id", engineerId);
    if (error) {
      toast.error("Failed to update availability");
    } else {
      toast.success(`Engineer marked as ${!currentStatus ? "available" : "unavailable"}`);
      refetch();
    }
  };

  const filtered = engineers.filter((e) => {
    const name = profileMap.get(e.user_id)?.full_name ?? "";
    return name.toLowerCase().includes(search.toLowerCase()) ||
      e.specialty.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <AppLayout title="Engineer Management" subtitle="Manage availability and assignments">
      <div className="space-y-5">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search engineers..."
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-input bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((eng) => {
            const profile = profileMap.get(eng.user_id);
            const name = profile?.full_name ?? "Unknown";
            const initials = name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
            return (
              <Card key={eng.id} className="hover:shadow-elevated transition-shadow duration-300">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-semibold text-primary">{initials}</span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-card-foreground">{name}</p>
                        <p className="text-xs text-muted-foreground">{eng.specialty}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleAvailability(eng.id, eng.is_available)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                        eng.is_available
                          ? "bg-green-500/10 text-green-500 hover:bg-green-500/20"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {eng.is_available ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
                      {eng.is_available ? "Available" : "Unavailable"}
                    </button>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Star className="w-3.5 h-3.5 text-amber-500" />
                      <span className="font-medium text-card-foreground">{Number(eng.rating).toFixed(1)}</span>
                      <span>· {eng.jobs_completed ?? 0} jobs completed</span>
                    </div>
                    {eng.location && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <MapPin className="w-3.5 h-3.5" /> {eng.location}
                      </div>
                    )}
                    {profile?.phone && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Phone className="w-3.5 h-3.5" /> {profile.phone}
                      </div>
                    )}
                    {eng.hourly_rate && (
                      <p className="text-xs text-muted-foreground">Rate: <span className="font-medium text-card-foreground">${Number(eng.hourly_rate)}/hr</span></p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
};

export default TeamLeadEngineers;
