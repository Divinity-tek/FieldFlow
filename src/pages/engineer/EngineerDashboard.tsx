import { useEffect, useMemo, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import EngineerMobileLayout from "@/components/layout/EngineerMobileLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Briefcase, CheckCircle, Clock, Star, MapPin, Navigation, Play,
  TrendingUp, DollarSign, Calendar, Zap, AlertCircle, ChevronRight, Award, Radio, Store, Sparkles
} from "lucide-react";
import { format, isToday, isThisWeek, startOfWeek, addDays, differenceInMinutes, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { useCurrency } from "@/contexts/CurrencyContext";
import AvailabilityShiftCard from "@/components/engineer/AvailabilityShiftCard";
import BadgesStrip from "@/components/engineer/BadgesStrip";
import KbSearchPanel from "@/components/engineer/KbSearchPanel";

const EngineerDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { format: formatCurrency } = useCurrency();
  const [available, setAvailable] = useState<boolean>(true);
  const [sharingLocation, setSharingLocation] = useState<boolean>(() => localStorage.getItem("eng-share-loc") === "1");
  const [lastPing, setLastPing] = useState<Date | null>(null);
  const [lastAccuracy, setLastAccuracy] = useState<number | null>(null);
  const [locError, setLocError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);

  const { data: engineer, isLoading: engLoading } = useQuery({
    queryKey: ["eng-self", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("engineers")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (engineer) setAvailable(!!engineer.is_available);
  }, [engineer?.is_available]);

useEffect(() => {
    if (!engLoading && !engineer && user) {
      navigate("/engineer/onboarding", { replace: true });
    }
  }, [engLoading, engineer, user, navigate]);

  if (!engLoading && engineer && engineer.application_status !== "approved") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-sm text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <Clock className="w-7 h-7 text-primary" />
          </div>
          {engineer.application_status === "rejected" ? (
            <>
              <h2 className="text-lg font-semibold text-foreground">Application not approved</h2>
              <p className="text-sm text-muted-foreground">
                {(engineer as any).application_review_note || "Please review your details and reach out to support."}
              </p>
            </>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-foreground">Application under review</h2>
              <p className="text-sm text-muted-foreground">
                An admin is reviewing your engineer application. You'll be able to access jobs once it's approved.
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  const { data: profile } = useQuery({
    queryKey: ["eng-profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ["eng-dash-jobs", engineer?.id],
    queryFn: async () => {
      // Engineers read jobs through the financial-safe view (no margin/cut/split fields exposed).
      const { data: jobRows } = await supabase
        .from("jobs_engineer_safe")
        .select("*")
        .eq("engineer_id", engineer!.id)
        .order("scheduled_at", { ascending: true });
      const rows = (jobRows ?? []) as any[];
      const clientIds = Array.from(new Set(rows.map(r => r.client_id).filter(Boolean)));
      const { data: clientRows } = clientIds.length
        ? await supabase.from("clients").select("id, company_name").in("id", clientIds)
        : { data: [] as any[] };
      const byId = new Map((clientRows ?? []).map((c: any) => [c.id, c]));
      return rows.map(r => ({ ...r, clients: byId.get(r.client_id) ?? null }));
    },
    enabled: !!engineer?.id,
  });

  const { data: ratings = [] } = useQuery({
    queryKey: ["eng-dash-ratings", engineer?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("engineer_ratings")
        .select("rating, review, created_at")
        .eq("engineer_id", engineer!.id)
        .order("created_at", { ascending: false })
        .limit(3);
      return data ?? [];
    },
    enabled: !!engineer?.id,
  });

  const { data: smartAlerts = [] } = useQuery({
    queryKey: ["eng-dash-smart-alerts", engineer?.id],
    queryFn: async () => {
      const { data: alerts } = await supabase
        .from("smart_match_alerts")
        .select("id, created_at, job_id")
        .eq("engineer_id", engineer!.id)
        .order("created_at", { ascending: false })
        .limit(5);
      const rows = (alerts ?? []) as any[];
      const jobIds = Array.from(new Set(rows.map(r => r.job_id).filter(Boolean)));
      const { data: jobRows } = jobIds.length
        ? await supabase
            .from("jobs_engineer_safe")
            .select("id, title, location, engineer_net")
            .in("id", jobIds)
        : { data: [] as any[] };
      const byId = new Map((jobRows ?? []).map((j: any) => [j.id, j]));
      return rows.map(r => ({ ...r, jobs: byId.get(r.job_id) ?? null }));
    },
    enabled: !!engineer?.id,
  });

  useEffect(() => {
    if (!engineer?.id) return;
    const channel = supabase
      .channel("eng-dash-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "jobs", filter: `engineer_id=eq.${engineer.id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["eng-dash-jobs", engineer.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [engineer?.id, queryClient]);

  const toggleAvailability = useMutation({
    mutationFn: async (next: boolean) => {
      const { error } = await supabase.from("engineers").update({ is_available: next }).eq("id", engineer!.id);
      if (error) throw error;
    },
    onSuccess: (_, next) => {
      toast.success(next ? "You're online — receiving new jobs" : "You're offline");
      queryClient.invalidateQueries({ queryKey: ["eng-self", user?.id] });
    },
    onError: () => {
      setAvailable((p) => !p);
      toast.error("Failed to update availability");
    },
  });

  const stats = useMemo(() => {
    const active = jobs.filter((j) => !["completed", "cancelled"].includes(j.status));
    const completed = jobs.filter((j) => j.status === "completed");
    const pending = jobs.filter((j) => j.status === "assigned");
    const inProgress = jobs.filter((j) => j.status === "in_progress");
    const today = jobs.filter((j) => j.scheduled_at && isToday(new Date(j.scheduled_at)));
    const completedToday = completed.filter((j) => j.completed_at && isToday(new Date(j.completed_at)));
    const completedWeek = completed.filter((j) => j.completed_at && isThisWeek(new Date(j.completed_at), { weekStartsOn: 1 }));
    const earningsToday = completedToday.reduce((s, j) => s + Number(j.engineer_net ?? 0), 0);
    const earningsWeek = completedWeek.reduce((s, j) => s + Number(j.engineer_net ?? 0), 0);

    const times = completed
      .filter((j) => j.started_at && j.completed_at)
      .map((j) => differenceInMinutes(new Date(j.completed_at!), new Date(j.started_at!)));
    const avgMin = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;

    // weekly chart (Mon-Sun)
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const weekly = Array.from({ length: 7 }, (_, i) => {
      const d = addDays(weekStart, i);
      const count = completed.filter((j) => j.completed_at && new Date(j.completed_at).toDateString() === d.toDateString()).length;
      return { day: format(d, "EEE"), count };
    });
    const maxDay = Math.max(1, ...weekly.map((w) => w.count));

    const next = active
      .filter((j) => j.scheduled_at)
      .sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime())[0]
      ?? active[0];

    return { active, completed, pending, inProgress, today, completedToday, earningsToday, earningsWeek, avgMin, weekly, maxDay, next };
  }, [jobs]);

  const completionRate = jobs.length ? Math.round((stats.completed.length / jobs.length) * 100) : 0;
  const dailyTarget = 5;
  const todayProgress = Math.min(100, Math.round((stats.completedToday.length / dailyTarget) * 100));

  const startJob = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("jobs").update({ status: "in_progress", started_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Job started");
      queryClient.invalidateQueries({ queryKey: ["eng-dash-jobs", engineer?.id] });
    },
    onError: () => toast.error("Couldn't start job"),
  });

  const acceptJob = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("jobs").update({ status: "accepted" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Job accepted");
      queryClient.invalidateQueries({ queryKey: ["eng-dash-jobs", engineer?.id] });
    },
    onError: () => toast.error("Couldn't accept job"),
  });

  const rejectJob = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("jobs")
        .update({ status: "pending", engineer_id: null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Job rejected — returned to dispatch");
      queryClient.invalidateQueries({ queryKey: ["eng-dash-jobs", engineer?.id] });
    },
    onError: () => toast.error("Couldn't reject job"),
  });

  // Live location sharing
  const stopWatch = () => {
    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  };

  const pushLocation = async (lat: number, lng: number) => {
    if (!engineer?.id) return;
    const { error } = await supabase
      .from("engineers")
      .update({ latitude: lat, longitude: lng, updated_at: new Date().toISOString() })
      .eq("id", engineer.id);
    if (error) setLocError(error.message);
    else { setLocError(null); setLastPing(new Date()); }
  };

  useEffect(() => {
    if (!sharingLocation || !engineer?.id) { stopWatch(); return; }
    if (!("geolocation" in navigator)) {
      setLocError("Geolocation not supported on this device");
      setSharingLocation(false);
      return;
    }
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setLastAccuracy(pos.coords.accuracy);
        pushLocation(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => {
        setLocError(err.message);
        if (err.code === err.PERMISSION_DENIED) {
          toast.error("Location permission denied");
          setSharingLocation(false);
          localStorage.removeItem("eng-share-loc");
        }
      },
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 30000 }
    );
    return stopWatch;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharingLocation, engineer?.id]);

  const toggleLocationSharing = (next: boolean) => {
    if (next) {
      localStorage.setItem("eng-share-loc", "1");
      setSharingLocation(true);
      toast.success("Sharing live location with clients");
    } else {
      localStorage.removeItem("eng-share-loc");
      setSharingLocation(false);
      stopWatch();
      toast.message("Stopped sharing location");
    }
  };

  return (
    <EngineerMobileLayout title="Dashboard">
      <div className="space-y-5">
        {/* Greeting + availability */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-foreground">
              Hey, {profile?.full_name?.split(" ")[0] ?? "Engineer"} 👋
            </h2>
            <p className="text-sm text-muted-foreground">{engineer?.specialty ?? "Field Engineer"}</p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-2 bg-card border border-border rounded-full px-3 py-1.5 shadow-sm">
              <span className={`w-2 h-2 rounded-full ${available ? "bg-green-500 animate-pulse" : "bg-muted-foreground"}`} />
              <span className="text-xs font-medium text-foreground">{available ? "Online" : "Offline"}</span>
              <Switch
                checked={available}
                onCheckedChange={(v) => { setAvailable(v); toggleAvailability.mutate(v); }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground">{available ? "Accepting jobs" : "Not receiving jobs"}</p>
          </div>
        </div>

        {/* Browse Marketplace CTA */}
        <Link to="/marketplace" className="block">
          <Card className="bg-gradient-to-br from-emerald-500 to-teal-600 border-0 text-white hover:opacity-95 transition">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <Store className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">Browse Job Marketplace</p>
                <p className="text-[11px] opacity-90">See posted jobs near you, apply or send a counter-offer</p>
              </div>
              <ChevronRight className="w-5 h-5 opacity-80" />
            </CardContent>
          </Card>
        </Link>

        {/* Badges earned for performance */}
        <BadgesStrip
          jobsCompleted={engineer?.jobs_completed ?? 0}
          rating={Number(engineer?.rating ?? 0)}
        />

        {/* Quick widgets: My Jobs + SmartMatch — surfaced on dashboard landing */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link to="/engineer/jobs" className="block group">
            <Card className="h-full hover:border-primary/40 hover:shadow-md transition">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Briefcase className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">My Jobs</p>
                      <p className="text-[11px] text-muted-foreground">
                        {stats.inProgress.length} in progress · {stats.pending.length} pending
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition" />
                </div>
                {stats.next ? (
                  <div className="mt-3 rounded-lg bg-muted/50 p-2.5">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Next up</p>
                    <p className="text-xs font-medium text-foreground line-clamp-1">{stats.next.title ?? "Untitled job"}</p>
                    {stats.next.scheduled_at && (
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(stats.next.scheduled_at), "EEE, MMM d · p")}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground mt-3">No upcoming jobs scheduled</p>
                )}
              </CardContent>
            </Card>
          </Link>

          <Link to="/engineer/smart-match" className="block group">
            <Card className="h-full hover:border-primary/40 hover:shadow-md transition">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-amber-500" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">SmartMatch Alerts</p>
                      <p className="text-[11px] text-muted-foreground">
                        {smartAlerts.length > 0 ? `${smartAlerts.length} recent match${smartAlerts.length === 1 ? "" : "es"}` : "No matches yet"}
                      </p>
                    </div>
                  </div>
                  {smartAlerts.length > 0 && (
                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{smartAlerts.length}</Badge>
                  )}
                </div>
                {smartAlerts[0]?.jobs ? (
                  <div className="mt-3 rounded-lg bg-muted/50 p-2.5">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Latest match</p>
                    <p className="text-xs font-medium text-foreground line-clamp-1">
                      {(smartAlerts[0].jobs as any).title ?? "Job match"}
                    </p>
                    {(smartAlerts[0].jobs as any).location && (
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3" />
                        <span className="truncate">{(smartAlerts[0].jobs as any).location}</span>
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground mt-3">Set up a saved search to get notified of matching jobs</p>
                )}
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Live location sharing */}
        <Card className={sharingLocation ? "border-green-500/40 bg-green-500/5" : ""}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${sharingLocation ? "bg-green-500/15" : "bg-muted"}`}>
                  <Radio className={`w-5 h-5 ${sharingLocation ? "text-green-600 animate-pulse" : "text-muted-foreground"}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">Live location sharing</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {sharingLocation
                      ? "Clients can track your progress in real time"
                      : "Turn on to let clients see your live location"}
                  </p>
                  {sharingLocation && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[10px] text-muted-foreground">
                      {lastPing && (
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                          Updated {formatDistanceToNow(lastPing, { addSuffix: true })}
                        </span>
                      )}
                      {lastAccuracy != null && (
                        <span>±{Math.round(lastAccuracy)}m accuracy</span>
                      )}
                    </div>
                  )}
                  {locError && (
                    <p className="text-[10px] text-destructive mt-1">{locError}</p>
                  )}
                </div>
              </div>
              <Switch checked={sharingLocation} onCheckedChange={toggleLocationSharing} />
            </div>
          </CardContent>
        </Card>

        {/* Shift availability */}
        {engineer?.id && <AvailabilityShiftCard engineerId={engineer.id} />}

        {/* Earnings hero */}
        <Card className="bg-gradient-to-br from-primary to-primary/70 border-0 text-primary-foreground overflow-hidden relative">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs opacity-80 uppercase tracking-wider">Today's earnings</p>
                <p className="text-3xl font-bold mt-1">{formatCurrency(stats.earningsToday)}</p>
                <p className="text-xs opacity-80 mt-1">This week: {formatCurrency(stats.earningsWeek)}</p>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center">
                <DollarSign className="w-7 h-7" />
              </div>
            </div>
            <div className="mt-4">
              <div className="flex items-center justify-between text-[11px] mb-1.5">
                <span className="opacity-90">Daily target ({stats.completedToday.length}/{dailyTarget} jobs)</span>
                <span className="font-semibold">{todayProgress}%</span>
              </div>
              <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-white rounded-full transition-all duration-700" style={{ width: `${todayProgress}%` }} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Clock className="w-4 h-4 text-amber-500" />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Active</p>
                <p className="text-lg font-bold text-foreground">{stats.active.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="w-4 h-4 text-green-500" />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Completed</p>
                <p className="text-lg font-bold text-foreground">{stats.completed.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Briefcase className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Total Jobs</p>
                <p className="text-lg font-bold text-foreground">{engineer?.jobs_completed ?? 0}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                <Star className="w-4 h-4 text-yellow-500" />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Rating</p>
                <p className="text-lg font-bold text-foreground">⭐ {Number(engineer?.rating ?? 0).toFixed(1)}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Performance row */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] text-muted-foreground">Completion rate</p>
                <TrendingUp className="w-3.5 h-3.5 text-green-500" />
              </div>
              <p className="text-xl font-bold text-foreground">{completionRate}%</p>
              <Progress value={completionRate} className="h-1 mt-2" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] text-muted-foreground">Avg. resolution</p>
                <Zap className="w-3.5 h-3.5 text-primary" />
              </div>
              <p className="text-xl font-bold text-foreground">{stats.avgMin}<span className="text-xs text-muted-foreground ml-1">min</span></p>
              <p className="text-[10px] text-muted-foreground mt-2">across {stats.completed.length} jobs</p>
            </CardContent>
          </Card>
        </div>

        {/* Next job */}
        {stats.next && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Navigation className="w-4 h-4 text-primary" /> Next up
              </h3>
              <Link to="/engineer/jobs" className="text-xs text-primary font-medium flex items-center">
                View all <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{stats.next.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {(stats.next as any).clients?.company_name ?? stats.next.service_type}
                    </p>
                  </div>
                  <Badge variant={stats.next.priority === "urgent" || stats.next.priority === "high" ? "destructive" : "secondary"} className="capitalize text-[10px]">
                    {stats.next.priority}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {stats.next.location}</span>
                  {stats.next.scheduled_at && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {format(new Date(stats.next.scheduled_at), "MMM d, h:mm a")}
                    </span>
                  )}
                </div>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" className="flex-1" asChild>
                    <a
                      href={
                        stats.next.latitude && stats.next.longitude
                          ? `https://www.google.com/maps/dir/?api=1&destination=${stats.next.latitude},${stats.next.longitude}`
                          : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stats.next.location)}`
                      }
                      target="_blank" rel="noreferrer"
                    >
                      <Navigation className="w-3.5 h-3.5 mr-1" /> Navigate
                    </a>
                  </Button>
                  {stats.next.status === "assigned" ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => rejectJob.mutate(stats.next!.id)}
                        disabled={rejectJob.isPending || acceptJob.isPending}
                      >
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => acceptJob.mutate(stats.next!.id)}
                        disabled={acceptJob.isPending || rejectJob.isPending}
                      >
                        <CheckCircle className="w-3.5 h-3.5 mr-1" /> Accept
                      </Button>
                    </>
                  ) : stats.next.status === "accepted" ? (
                    <Button size="sm" className="flex-1" onClick={() => startJob.mutate(stats.next!.id)} disabled={startJob.isPending}>
                      <Play className="w-3.5 h-3.5 mr-1" /> Start
                    </Button>
                  ) : (
                    <Button size="sm" className="flex-1" onClick={() => navigate(`/jobs/${stats.next!.id}`)}>
                      Open <ChevronRight className="w-3.5 h-3.5 ml-1" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Today's schedule */}
        {stats.today.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-primary" /> Today's schedule ({stats.today.length})
            </h3>
            <div className="space-y-2">
              {stats.today.map((job) => (
                <Card key={job.id} className="cursor-pointer hover:border-primary/40 transition-colors" onClick={() => navigate(`/jobs/${job.id}`)}>
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex flex-col items-center justify-center shrink-0">
                      <span className="text-[9px] font-medium text-primary uppercase">
                        {job.scheduled_at ? format(new Date(job.scheduled_at), "MMM") : ""}
                      </span>
                      <span className="text-sm font-bold text-primary leading-none">
                        {job.scheduled_at ? format(new Date(job.scheduled_at), "h:mm") : "--"}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{job.title}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{job.location}</p>
                    </div>
                    <Badge variant="outline" className="capitalize text-[10px]">{job.status.replace(/_/g, " ")}</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Pending acceptance */}
        {stats.pending.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-amber-500" /> Awaiting your acceptance ({stats.pending.length})
            </h3>
            <div className="space-y-2">
              {stats.pending.map((job) => (
                <Card key={job.id} className="border-amber-500/30">
                  <CardContent className="p-4 space-y-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{job.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">{job.service_type} · {job.location}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {job.scheduled_at ? format(new Date(job.scheduled_at), "EEE, MMM d · h:mm a") : "Not scheduled"}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => rejectJob.mutate(job.id)}
                        disabled={rejectJob.isPending || acceptJob.isPending}
                      >
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => acceptJob.mutate(job.id)}
                        disabled={acceptJob.isPending || rejectJob.isPending}
                      >
                        <CheckCircle className="w-3.5 h-3.5 mr-1" /> Accept
                      </Button>
                    </div>
                    <Button size="sm" variant="link" className="px-0 h-auto" onClick={() => navigate(`/jobs/${job.id}`)}>
                      View details <ChevronRight className="w-3 h-3 ml-0.5" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Weekly performance */}
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-primary" /> This week
          </h3>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-end justify-between gap-2 h-24">
                {stats.weekly.map((d, i) => {
                  const h = (d.count / stats.maxDay) * 100;
                  const isTodayCol = d.day === format(new Date(), "EEE");
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                      <div className="w-full flex-1 flex items-end">
                        <div
                          className={`w-full rounded-t-md transition-all duration-700 ${isTodayCol ? "bg-primary" : "bg-primary/30"}`}
                          style={{ height: `${Math.max(h, 4)}%` }}
                          title={`${d.count} jobs`}
                        />
                      </div>
                      <span className={`text-[10px] ${isTodayCol ? "text-primary font-semibold" : "text-muted-foreground"}`}>{d.day}</span>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                <span className="text-[11px] text-muted-foreground">Jobs completed this week</span>
                <span className="text-sm font-bold text-foreground">{stats.weekly.reduce((s, d) => s + d.count, 0)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent reviews */}
        {ratings.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
              <Award className="w-4 h-4 text-yellow-500" /> Recent reviews
            </h3>
            <div className="space-y-2">
              {ratings.map((r, i) => (
                <Card key={i}>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, idx) => (
                          <Star key={idx} className={`w-3.5 h-3.5 ${idx < r.rating ? "fill-yellow-500 text-yellow-500" : "text-muted-foreground/30"}`} />
                        ))}
                      </div>
                      <span className="text-[10px] text-muted-foreground">{format(new Date(r.created_at), "MMM d")}</span>
                    </div>
                    {r.review && <p className="text-xs text-muted-foreground mt-2 italic">"{r.review}"</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" className="h-auto py-3 flex-col gap-1" onClick={() => navigate("/engineer/jobs")}>
            <Briefcase className="w-4 h-4" />
            <span className="text-xs">My Jobs</span>
          </Button>
          <Button variant="outline" className="h-auto py-3 flex-col gap-1" onClick={() => navigate("/engineer/profile")}>
            <Award className="w-4 h-4" />
            <span className="text-xs">Profile</span>
          </Button>
        </div>

        {/* Knowledge base quick search */}
        <KbSearchPanel />
      </div>
    </EngineerMobileLayout>
  );
};

export default EngineerDashboard;
