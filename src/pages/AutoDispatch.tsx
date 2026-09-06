import { useMemo, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Bot, Zap, MapPin, Star, CheckCircle2, Wand2 } from "lucide-react";

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface ScoredEngineer {
  id: string;
  name: string;
  specialty: string;
  rating: number;
  distance: number | null;
  skillMatch: number;
  available: boolean;
  score: number;
  reasons: string[];
}

export default function AutoDispatch() {
  const queryClient = useQueryClient();
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);

  const { data: jobs = [] } = useQuery({
    queryKey: ["auto-dispatch-jobs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("jobs")
        .select("id, title, service_type, priority, location, latitude, longitude, status")
        .in("status", ["pending"])
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: engineers = [] } = useQuery({
    queryKey: ["auto-dispatch-engineers"],
    queryFn: async () => {
      const { data } = await supabase
        .from("engineers")
        .select("id, user_id, specialty, rating, latitude, longitude, is_available, skills, jobs_completed")
        .eq("is_available", true);
      if (!data) return [];
      const userIds = data.map(e => e.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);
      return data.map(e => ({
        ...e,
        full_name: profiles?.find(p => p.user_id === e.user_id)?.full_name || "Engineer",
      }));
    },
  });

  const job = jobs.find(j => j.id === selectedJob) || jobs[0];

  const ranked: ScoredEngineer[] = useMemo(() => {
    if (!job) return [];
    return engineers
      .map(e => {
        const reasons: string[] = [];
        let score = 0;

        // skill match (specialty matches service_type)
        const skillMatch =
          e.specialty?.toLowerCase().includes((job.service_type || "").toLowerCase()) ||
          (e.skills || []).some((s: string) => s.toLowerCase().includes((job.service_type || "").toLowerCase()))
            ? 1
            : 0.4;
        if (skillMatch === 1) reasons.push(`Skill match: ${e.specialty}`);
        score += skillMatch * 40;

        // distance
        let distance: number | null = null;
        if (job.latitude && job.longitude && e.latitude && e.longitude) {
          distance = haversineKm(job.latitude, job.longitude, e.latitude, e.longitude);
          const distScore = Math.max(0, 30 - distance / 5);
          score += distScore;
          reasons.push(`${distance.toFixed(1)} km away`);
        } else {
          score += 10;
        }

        // rating
        const r = Number(e.rating) || 0;
        score += (r / 5) * 20;
        if (r >= 4.5) reasons.push(`Top-rated (${r.toFixed(1)}★)`);

        // experience
        const jc = e.jobs_completed || 0;
        score += Math.min(10, jc / 10);
        if (jc > 50) reasons.push(`${jc} jobs completed`);

        return {
          id: e.id,
          name: e.full_name,
          specialty: e.specialty,
          rating: r,
          distance,
          skillMatch,
          available: !!e.is_available,
          score: Math.round(score),
          reasons,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
  }, [job, engineers]);

  const autoAssign = async () => {
    if (!job || !ranked[0]) return;
    setAssigning(true);
    const top = ranked[0];
    const { error } = await supabase
      .from("jobs")
      .update({ engineer_id: top.id, status: "assigned" })
      .eq("id", job.id);
    setAssigning(false);
    if (error) {
      toast.error("Auto-assign failed: " + error.message);
      return;
    }
    toast.success(`✨ Auto-dispatched to ${top.name} (score ${top.score})`);
    queryClient.invalidateQueries({ queryKey: ["auto-dispatch-jobs"] });
    setSelectedJob(null);
  };

  return (
    <AppLayout title="AI Auto-Dispatch">
      <div className="space-y-6 p-1">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Bot className="w-7 h-7 text-primary" /> AI Auto-Dispatch
            </h1>
            <p className="text-muted-foreground mt-1">
              Multi-factor scoring: skill match, distance, rating, and experience.
            </p>
          </div>
          <Button onClick={autoAssign} disabled={!job || !ranked.length || assigning} size="lg">
            <Wand2 className="w-4 h-4" /> Auto-Assign Best Match
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-base">Pending Jobs ({jobs.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[600px] overflow-auto">
              {jobs.length === 0 && (
                <p className="text-sm text-muted-foreground">No pending jobs to dispatch.</p>
              )}
              {jobs.map(j => (
                <button
                  key={j.id}
                  onClick={() => setSelectedJob(j.id)}
                  className={`w-full text-left p-3 rounded-md border transition-colors ${
                    (selectedJob || jobs[0]?.id) === j.id
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted/50"
                  }`}
                >
                  <div className="font-medium text-sm">{j.title}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <MapPin className="w-3 h-3" /> {j.location}
                  </div>
                  <div className="flex gap-1 mt-2">
                    <Badge variant="outline" className="text-xs">{j.service_type}</Badge>
                    <Badge variant={j.priority === "urgent" ? "destructive" : "secondary"} className="text-xs">
                      {j.priority}
                    </Badge>
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />
                {job ? `Top Matches for: ${job.title}` : "Select a job"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!job && <p className="text-sm text-muted-foreground">Select a pending job from the left.</p>}
              {job && ranked.length === 0 && (
                <p className="text-sm text-muted-foreground">No available engineers.</p>
              )}
              {ranked.map((e, i) => (
                <div
                  key={e.id}
                  className={`p-4 rounded-lg border ${i === 0 ? "border-primary bg-primary/5" : ""}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {i === 0 && <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />}
                        <span className="font-semibold">{e.name}</span>
                        <Badge variant="outline" className="text-xs">{e.specialty}</Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          <Star className="w-3 h-3 fill-amber-500 text-amber-500" /> {e.rating.toFixed(1)}
                        </span>
                        {e.distance != null && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> {e.distance.toFixed(1)} km
                          </span>
                        )}
                      </div>
                      {e.reasons.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {e.reasons.map((r, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs font-normal">
                              {r}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-2xl font-bold text-primary">{e.score}</div>
                      <div className="text-xs text-muted-foreground">match score</div>
                    </div>
                  </div>
                  <Progress value={e.score} className="h-1.5 mt-3" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
