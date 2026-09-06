import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, CircleMarker, Circle as LeafletCircle } from "react-leaflet";
import AnimatedMarker, { calcBearing } from "@/components/map/AnimatedMarker";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.heat";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import {
  Search, Navigation, Clock, MapPin, User, Activity, Radio,
  RefreshCw, ChevronRight, Wifi, WifiOff, Circle, Route,
  Play, Pause, SkipBack, SkipForward, History, X, Timer,
  Shield, LogIn, LogOut, Bell, Flame, Filter, ChevronDown, Gauge,
  AlertTriangle, Zap,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

// ── ETA helper: haversine distance (km) + assumed avg speed ──
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const AVG_SPEED_KMH = 30; // urban average

function calcEta(engLat: number, engLng: number, jobLat: number, jobLng: number) {
  const dist = haversineKm(engLat, engLng, jobLat, jobLng);
  const minutes = Math.round((dist / AVG_SPEED_KMH) * 60);
  const arrivalTime = new Date(Date.now() + minutes * 60_000);
  return { distKm: dist, minutes, arrivalTime };
}

// ── Custom icons ──
const makeIcon = (color: string, pulse = false, showArrow = false) => new L.DivIcon({
  className: "",
  html: `<div style="position:relative"><div style="width:36px;height:36px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center">${showArrow ? `<svg width="18" height="18" fill="white" viewBox="0 0 24 24"><path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/></svg>` : `<svg width="18" height="18" fill="white" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`}</div>${pulse ? '<div style="position:absolute;top:-4px;left:-4px;width:44px;height:44px;border-radius:50%;border:2px solid ' + color + ';animation:pulse 2s infinite;opacity:.6"></div>' : ''}</div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  popupAnchor: [0, -18],
});

const icons = {
  on_the_way: makeIcon("#8b5cf6", true, true),
  in_progress: makeIcon("#f59e0b", true, true),
  available: makeIcon("#10b981"),
  unavailable: makeIcon("#6b7280"),
};

const jobIcon = (priority: string) => new L.DivIcon({
  className: "",
  html: `<div style="width:24px;height:24px;border-radius:4px;background:${priority === "urgent" ? "#ef4444" : priority === "high" ? "#f59e0b" : "#3b82f6"};border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center"><svg width="12" height="12" fill="white" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/></svg></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 24],
  popupAnchor: [0, -24],
});

const statusColors: Record<string, string> = {
  on_the_way: "bg-violet-500/10 text-violet-600 border-violet-200",
  in_progress: "bg-amber-500/10 text-amber-600 border-amber-200",
  available: "bg-emerald-500/10 text-emerald-600 border-emerald-200",
  unavailable: "bg-muted text-muted-foreground border-border",
};

function FitBounds({ bounds }: { bounds: L.LatLngBoundsExpression | null }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  }, [bounds, map]);
  return null;
}

function FlyTo({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => { map.flyTo([lat, lng], 15, { duration: 0.8 }); }, [lat, lng, map]);
  return null;
}

// ── Heatmap layer component ──
function HeatmapLayer({ points, show }: { points: [number, number, number][]; show: boolean }) {
  const map = useMap();
  const layerRef = useRef<L.Layer | null>(null);

  useEffect(() => {
    if (layerRef.current) {
      map.removeLayer(layerRef.current);
      layerRef.current = null;
    }
    if (show && points.length > 0) {
      // @ts-ignore - leaflet.heat extends L
      const heat = L.heatLayer(points, {
        radius: 25,
        blur: 20,
        maxZoom: 15,
        max: 1.0,
        gradient: { 0.2: "#3b82f6", 0.4: "#6366f1", 0.6: "#f59e0b", 0.8: "#f97316", 1.0: "#ef4444" },
      });
      heat.addTo(map);
      layerRef.current = heat;
    }
    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [map, points, show]);

  return null;
}

const LiveTracking = () => {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedEngineerId, setSelectedEngineerId] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [showTrails, setShowTrails] = useState(false);
  const [showGeofences, setShowGeofences] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showJobFilters, setShowJobFilters] = useState(false);
  const [jobStatusFilter, setJobStatusFilter] = useState("all");
  const [jobPriorityFilter, setJobPriorityFilter] = useState("all");
  const [jobServiceFilter, setJobServiceFilter] = useState("all");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [speedThreshold, setSpeedThreshold] = useState(80); // km/h
  const [showSpeedAlerts, setShowSpeedAlerts] = useState(true);
  const [timelineEngineerId, setTimelineEngineerId] = useState<string | null>(null);

  // ── Replay mode state ──
  const [replayMode, setReplayMode] = useState(false);
  const [replayMinutes, setReplayMinutes] = useState(0); // minutes since midnight
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(10); // minutes per second
  const playIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Replay time boundaries
  const replayTimeRange = useMemo(() => {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    return { min: 0, max: currentMinutes };
  }, []);

  // Format minutes to HH:mm
  const formatMinutes = useCallback((m: number) => {
    const h = Math.floor(m / 60);
    const min = m % 60;
    return `${h.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}`;
  }, []);

  // Playback animation
  useEffect(() => {
    if (isPlaying && replayMode) {
      playIntervalRef.current = setInterval(() => {
        setReplayMinutes(prev => {
          const next = prev + 1;
          if (next >= replayTimeRange.max) {
            setIsPlaying(false);
            return replayTimeRange.max;
          }
          return next;
        });
      }, 1000 / playbackSpeed);
    } else {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current);
    }
    return () => { if (playIntervalRef.current) clearInterval(playIntervalRef.current); };
  }, [isPlaying, replayMode, playbackSpeed, replayTimeRange.max]);

  // When entering replay mode, set slider to current time
  const toggleReplayMode = useCallback(() => {
    if (!replayMode) {
      setReplayMinutes(replayTimeRange.max);
      setShowTrails(true); // ensure trails data is fetched
    }
    setIsPlaying(false);
    setReplayMode(!replayMode);
  }, [replayMode, replayTimeRange.max]);

  // ── Real-time subscription for engineer movement ──
  useEffect(() => {
    const channel = supabase
      .channel("engineer-movement")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "engineers" },
        (payload) => {
          // Instantly update the cached engineer data with new position
          qc.setQueryData(["live-engineers"], (old: any[] | undefined) => {
            if (!old) return old;
            return old.map((eng) =>
              eng.id === payload.new.id
                ? { ...eng, latitude: payload.new.latitude, longitude: payload.new.longitude, is_available: payload.new.is_available, location: payload.new.location }
                : eng
            );
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  // ── Real-time subscription for location history (for bearing & trails) ──
  useEffect(() => {
    const channel = supabase
      .channel("location-history-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "engineer_location_history" },
        (payload) => {
          // Append the new location point to the cached history
          qc.setQueryData(["live-location-history"], (old: any[] | undefined) => {
            if (!old) return [payload.new];
            return [...old, payload.new];
          });
          // Also update last-seen data
          qc.setQueryData(["live-last-seen"], (old: any[] | undefined) => {
            const newEntry = { engineer_id: payload.new.engineer_id, recorded_at: payload.new.recorded_at };
            if (!old) return [newEntry];
            const updated = old.filter(e => e.engineer_id !== payload.new.engineer_id);
            return [...updated, newEntry];
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  // ── Real-time subscription for job status changes ──
  useEffect(() => {
    const channel = supabase
      .channel("job-status-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "jobs" },
        () => {
          qc.invalidateQueries({ queryKey: ["live-jobs"] });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  // ── Real-time subscription for geofence events ──
  useEffect(() => {
    const channel = supabase
      .channel("geofence-events-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "geofence_events" },
        () => {
          qc.invalidateQueries({ queryKey: ["live-geofence-events"] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  // ── Data ──
  const { data: engineers = [] } = useQuery({
    queryKey: ["live-engineers"],
    queryFn: async () => {
      const { data } = await supabase.from("engineers").select("id, user_id, specialty, rating, latitude, longitude, is_available, location");
      return data ?? [];
    },
    refetchInterval: autoRefresh ? 30000 : false,
  });

  // ── Last-seen timestamps from location history ──
  const { data: lastSeenData = [] } = useQuery({
    queryKey: ["live-last-seen"],
    queryFn: async () => {
      const { data } = await supabase
        .from("engineer_location_history")
        .select("engineer_id, recorded_at")
        .order("recorded_at", { ascending: false });
      // Deduplicate: keep only the latest per engineer
      const seen = new Map<string, string>();
      (data ?? []).forEach(row => {
        if (!seen.has(row.engineer_id)) seen.set(row.engineer_id, row.recorded_at);
      });
      return Array.from(seen.entries()).map(([engineer_id, recorded_at]) => ({ engineer_id, recorded_at }));
    },
    refetchInterval: autoRefresh ? 30000 : false,
  });

  const lastSeenMap = useMemo(() => new Map(lastSeenData.map(d => [d.engineer_id, d.recorded_at])), [lastSeenData]);

  const { data: profiles = [] } = useQuery({
    queryKey: ["live-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, full_name, phone");
      return data ?? [];
    },
  });

  const { data: activeJobs = [] } = useQuery({
    queryKey: ["live-jobs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("jobs")
        .select("id, title, status, priority, latitude, longitude, location, service_type, engineer_id, client_id, scheduled_at, started_at, description, notes")
        .in("status", ["pending", "assigned", "accepted", "on_the_way", "in_progress"]);
      return data ?? [];
    },
    refetchInterval: autoRefresh ? 30000 : false,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["live-clients"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, company_name");
      return data ?? [];
    },
  });

  // ── Geofence events (today) ──
  const { data: geofenceEvents = [] } = useQuery({
    queryKey: ["live-geofence-events"],
    queryFn: async () => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { data } = await supabase
        .from("geofence_events")
        .select("id, engineer_id, job_id, event_type, distance_meters, created_at")
        .gte("created_at", todayStart.toISOString())
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
    refetchInterval: autoRefresh ? 15000 : false,
  });

  // ── All jobs (for heatmap density) ──
  const { data: allJobs = [] } = useQuery({
    queryKey: ["live-all-jobs-heatmap"],
    queryFn: async () => {
      const { data } = await supabase
        .from("jobs")
        .select("latitude, longitude, priority")
        .not("latitude", "is", null)
        .not("longitude", "is", null);
      return data ?? [];
    },
    enabled: showHeatmap,
  });

  // Heatmap points: [lat, lng, intensity]
  const heatmapPoints = useMemo(() => {
    if (!showHeatmap) return [];
    return allJobs
      .filter(j => j.latitude && j.longitude)
      .map(j => {
        const intensity = j.priority === "urgent" ? 1.0 : j.priority === "high" ? 0.7 : j.priority === "medium" ? 0.4 : 0.2;
        return [j.latitude!, j.longitude!, intensity] as [number, number, number];
      });
  }, [showHeatmap, allJobs]);

  const { data: locationHistory = [] } = useQuery({
    queryKey: ["live-location-history"],
    queryFn: async () => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { data } = await supabase
        .from("engineer_location_history")
        .select("engineer_id, latitude, longitude, recorded_at")
        .gte("recorded_at", todayStart.toISOString())
        .order("recorded_at", { ascending: true });
      return data ?? [];
    },
    enabled: true,
    refetchInterval: autoRefresh ? 30000 : false,
  });

  // Group location history by engineer (with timestamps for replay)
  const trailsByEngineer = useMemo(() => {
    const map = new Map<string, [number, number][]>();
    locationHistory.forEach(p => {
      const points = map.get(p.engineer_id) ?? [];
      points.push([p.latitude, p.longitude]);
      map.set(p.engineer_id, points);
    });
    return map;
  }, [locationHistory]);

  // ── Replay: compute ghost positions at replayMinutes ──
  type HistoryPoint = { latitude: number; longitude: number; recorded_at: string };
  const historyByEngineerTimed = useMemo(() => {
    const map = new Map<string, HistoryPoint[]>();
    locationHistory.forEach(p => {
      const points = map.get(p.engineer_id) ?? [];
      points.push(p);
      map.set(p.engineer_id, points);
    });
    return map;
  }, [locationHistory]);

  const profileMap = useMemo(() => new Map(profiles.map(p => [p.user_id, p])), [profiles]);
  const clientMap = useMemo(() => new Map(clients.map(c => [c.id, c.company_name])), [clients]);

  // Build enriched engineer list with ETA
  const enrichedEngineers = useMemo(() => {
    return engineers.filter(e => e.latitude && e.longitude).map(eng => {
      const profile = profileMap.get(eng.user_id);
      const assignedJobs = activeJobs.filter(j => j.engineer_id === eng.id);
      const activeJob = assignedJobs.find(j => ["on_the_way", "in_progress"].includes(j.status));
      const trackingStatus = activeJob ? activeJob.status : eng.is_available ? "available" : "unavailable";
      const eta = (trackingStatus === "on_the_way" && activeJob?.latitude && activeJob?.longitude)
        ? calcEta(eng.latitude!, eng.longitude!, activeJob.latitude, activeJob.longitude)
        : null;
      const lastSeenRaw = lastSeenMap.get(eng.id);
      const lastSeenAt = lastSeenRaw ? new Date(lastSeenRaw) : null;
      const isOnline = lastSeenAt ? (Date.now() - lastSeenAt.getTime()) < 15 * 60 * 1000 : false;
      const history = historyByEngineerTimed.get(eng.id);
      let speedKmh: number | null = null;
      if (history && history.length >= 2) {
        const p1 = history[history.length - 2];
        const p2 = history[history.length - 1];
        const distKm = haversineKm(p1.latitude, p1.longitude, p2.latitude, p2.longitude);
        const timeDiffHours = (new Date(p2.recorded_at).getTime() - new Date(p1.recorded_at).getTime()) / 3_600_000;
        if (timeDiffHours > 0 && timeDiffHours < 1) {
          speedKmh = Math.round(distKm / timeDiffHours);
        }
      }
      // Calculate bearing from last two history points
      let bearingDeg: number | null = null;
      if (history && history.length >= 2) {
        const p1 = history[history.length - 2];
        const p2 = history[history.length - 1];
        bearingDeg = calcBearing(p1.latitude, p1.longitude, p2.latitude, p2.longitude);
      }
      return {
        ...eng,
        name: profile?.full_name ?? "Unknown",
        phone: profile?.phone,
        trackingStatus,
        activeJob,
        assignedJobCount: assignedJobs.length,
        eta,
        isOnline,
        lastSeenAt,
        speedKmh,
        bearing: bearingDeg,
      };
    });
  }, [engineers, profileMap, activeJobs, lastSeenMap, historyByEngineerTimed]);

  // ── Speeding engineers ──
  const speedingEngineers = useMemo(() => {
    return enrichedEngineers.filter(e => e.speedKmh !== null && e.speedKmh > speedThreshold);
  }, [enrichedEngineers, speedThreshold]);

  // Track which engineers have already triggered a toast to avoid spamming
  const notifiedSpeedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    speedingEngineers.forEach(eng => {
      if (!notifiedSpeedRef.current.has(eng.id)) {
        notifiedSpeedRef.current.add(eng.id);
        toast.error(`⚠️ ${eng.name} is speeding at ${eng.speedKmh} km/h`, {
          description: `Exceeds ${speedThreshold} km/h threshold`,
          duration: 8000,
        });
      }
    });
    // Remove engineers no longer speeding so they can re-trigger later
    const currentIds = new Set(speedingEngineers.map(e => e.id));
    notifiedSpeedRef.current.forEach(id => {
      if (!currentIds.has(id)) notifiedSpeedRef.current.delete(id);
    });
  }, [speedingEngineers, speedThreshold]);

  // ── Replay: compute ghost positions at replayMinutes ──
  const replayPositions = useMemo(() => {
    if (!replayMode) return [];
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const targetTime = new Date(todayStart.getTime() + replayMinutes * 60_000);

    const positions: { engineerId: string; lat: number; lng: number; name: string }[] = [];
    historyByEngineerTimed.forEach((points, engineerId) => {
      let lastBefore: HistoryPoint | null = null;
      let firstAfter: HistoryPoint | null = null;
      for (const p of points) {
        const t = new Date(p.recorded_at);
        if (t <= targetTime) lastBefore = p;
        if (t > targetTime && !firstAfter) firstAfter = p;
      }
      if (lastBefore) {
        let lat = lastBefore.latitude;
        let lng = lastBefore.longitude;
        if (firstAfter) {
          const t0 = new Date(lastBefore.recorded_at).getTime();
          const t1 = new Date(firstAfter.recorded_at).getTime();
          const ratio = (targetTime.getTime() - t0) / (t1 - t0);
          lat = lastBefore.latitude + (firstAfter.latitude - lastBefore.latitude) * ratio;
          lng = lastBefore.longitude + (firstAfter.longitude - lastBefore.longitude) * ratio;
        }
        const eng = enrichedEngineers.find(e => e.id === engineerId);
        positions.push({ engineerId, lat, lng, name: eng?.name ?? "Engineer" });
      }
    });
    return positions;
  }, [replayMode, replayMinutes, historyByEngineerTimed, enrichedEngineers]);

  const filteredEngineers = useMemo(() => {
    return enrichedEngineers.filter(e => {
      const matchesSearch = !search || e.name.toLowerCase().includes(search.toLowerCase()) || e.specialty.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "all" || e.trackingStatus === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [enrichedEngineers, search, statusFilter]);

  // Route lines (engineer → active job)
  const routeLines = useMemo(() => {
    return enrichedEngineers
      .filter(e => e.activeJob?.latitude && e.activeJob?.longitude)
      .map(e => ({
        engineerId: e.id,
        from: [e.latitude!, e.longitude!] as [number, number],
        to: [e.activeJob!.latitude!, e.activeJob!.longitude!] as [number, number],
        status: e.trackingStatus,
      }));
  }, [enrichedEngineers]);

  // Map bounds
  const bounds = useMemo(() => {
    const points = enrichedEngineers.map(e => [e.latitude!, e.longitude!] as [number, number]);
    activeJobs.forEach(j => { if (j.latitude && j.longitude) points.push([j.latitude, j.longitude]); });
    if (points.length < 2) return null;
    return L.latLngBounds(points.map(p => L.latLng(p[0], p[1])));
  }, [enrichedEngineers, activeJobs]);

  const selected = selectedEngineerId ? enrichedEngineers.find(e => e.id === selectedEngineerId) : null;

  // Stats
  const stats = useMemo(() => ({
    total: enrichedEngineers.length,
    active: enrichedEngineers.filter(e => ["on_the_way", "in_progress"].includes(e.trackingStatus)).length,
    available: enrichedEngineers.filter(e => e.trackingStatus === "available").length,
    offline: enrichedEngineers.filter(e => e.trackingStatus === "unavailable").length,
  }), [enrichedEngineers]);
  // Unique service types from active jobs
  const serviceTypes = useMemo(() => {
    const types = new Set(activeJobs.map(j => j.service_type).filter(Boolean));
    return Array.from(types).sort();
  }, [activeJobs]);

  // Filtered jobs for map display
  const filteredJobs = useMemo(() => {
    return activeJobs.filter(j => {
      if (jobStatusFilter !== "all" && j.status !== jobStatusFilter) return false;
      if (jobPriorityFilter !== "all" && j.priority !== jobPriorityFilter) return false;
      if (jobServiceFilter !== "all" && j.service_type !== jobServiceFilter) return false;
      return true;
    });
  }, [activeJobs, jobStatusFilter, jobPriorityFilter, jobServiceFilter]);

  const activeJobFilterCount = [jobStatusFilter, jobPriorityFilter, jobServiceFilter].filter(f => f !== "all").length;

  // Selected job for detail drawer
  const selectedJob = useMemo(() => {
    if (!selectedJobId) return null;
    return activeJobs.find(j => j.id === selectedJobId) ?? null;
  }, [selectedJobId, activeJobs]);

  const selectedJobEngineer = useMemo(() => {
    if (!selectedJob?.engineer_id) return null;
    return enrichedEngineers.find(e => e.id === selectedJob.engineer_id) ?? null;
  }, [selectedJob, enrichedEngineers]);

  const selectedJobClient = useMemo(() => {
    if (!selectedJob?.client_id) return null;
    return clientMap.get(selectedJob.client_id) ?? null;
  }, [selectedJob, clientMap]);

  // ── Mutations for job actions in drawer ──
  const updateJobStatusMutation = useMutation({
    mutationFn: async ({ jobId, status }: { jobId: string; status: string }) => {
      const updates: any = { status };
      if (status === "completed") updates.completed_at = new Date().toISOString();
      if (status === "in_progress" && !selectedJob?.started_at) updates.started_at = new Date().toISOString();
      const { error } = await supabase.from("jobs").update(updates).eq("id", jobId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["live-jobs"] });
    },
  });

  const reassignJobMutation = useMutation({
    mutationFn: async ({ jobId, engineerId }: { jobId: string; engineerId: string | null }) => {
      const { error } = await supabase.from("jobs").update({
        engineer_id: engineerId,
        status: engineerId ? "assigned" : "pending",
      }).eq("id", jobId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["live-jobs"] });
    },
  });

  // ── Timeline data for selected engineer ──
  const timelineEngineer = timelineEngineerId ? enrichedEngineers.find(e => e.id === timelineEngineerId) : null;

  const { data: timelineJobs = [] } = useQuery({
    queryKey: ["timeline-jobs", timelineEngineerId],
    queryFn: async () => {
      const { data } = await supabase
        .from("jobs")
        .select("id, title, status, updated_at, started_at, completed_at")
        .eq("engineer_id", timelineEngineerId!)
        .order("updated_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
    enabled: !!timelineEngineerId,
  });

  const timelineEvents = useMemo(() => {
    if (!timelineEngineerId) return [];
    type TimelineEvent = { id: string; timestamp: Date; type: "geofence" | "job" | "speed"; title: string; subtitle: string; icon: "arrival" | "departure" | "status" | "speed" };
    const events: TimelineEvent[] = [];

    // Geofence events for this engineer
    geofenceEvents
      .filter(e => e.engineer_id === timelineEngineerId)
      .forEach(evt => {
        const job = activeJobs.find(j => j.id === evt.job_id);
        events.push({
          id: `geo-${evt.id}`,
          timestamp: new Date(evt.created_at),
          type: "geofence",
          title: evt.event_type === "arrival" ? "Arrived at job site" : "Left job site",
          subtitle: `${job?.title ?? "Unknown job"} — ${Math.round(evt.distance_meters)}m`,
          icon: evt.event_type === "arrival" ? "arrival" : "departure",
        });
      });

    // Job status changes
    timelineJobs.forEach(job => {
      events.push({
        id: `job-${job.id}`,
        timestamp: new Date(job.updated_at),
        type: "job",
        title: `Job "${job.title}" — ${job.status.replace(/_/g, " ")}`,
        subtitle: job.completed_at ? `Completed ${format(new Date(job.completed_at), "PP")}` : job.started_at ? `Started ${format(new Date(job.started_at), "PP")}` : "Updated",
        icon: "status",
      });
    });

    // Current speed alert
    const eng = enrichedEngineers.find(e => e.id === timelineEngineerId);
    if (eng?.speedKmh && eng.speedKmh > speedThreshold) {
      events.push({
        id: `speed-${eng.id}`,
        timestamp: new Date(),
        type: "speed",
        title: `Speeding: ${eng.speedKmh} km/h`,
        subtitle: `Exceeds ${speedThreshold} km/h threshold`,
        icon: "speed",
      });
    }

    return events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [timelineEngineerId, geofenceEvents, timelineJobs, activeJobs, enrichedEngineers, speedThreshold]);

  return (
    <AppLayout title="Live Tracking" subtitle="Real-time engineer locations and active job routes">
      {/* Pulse animation keyframes */}
      <style>{`@keyframes pulse{0%{transform:scale(1);opacity:.6}50%{transform:scale(1.4);opacity:.2}100%{transform:scale(1);opacity:.6}}`}</style>
      
      <div className="space-y-4">
        {/* Stats bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Tracked", value: stats.total, icon: User, color: "text-foreground" },
            { label: "On Route / Working", value: stats.active, icon: Navigation, color: "text-violet-500" },
            { label: "Available", value: stats.available, icon: Activity, color: "text-emerald-500" },
            { label: "Offline", value: stats.offline, icon: WifiOff, color: "text-muted-foreground" },
          ].map(s => (
            <Card key={s.label} className="border-border/50">
              <CardContent className="p-3 flex items-center gap-3">
                <div className={cn("p-2 rounded-lg bg-muted/50", s.color)}>
                  <s.icon className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground">{s.value}</p>
                  <p className="text-[10px] text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex flex-col lg:flex-row gap-4 h-auto lg:h-[calc(100vh-16rem)]">
          {/* Side panel */}
          <div className="lg:w-80 xl:w-96 space-y-3 flex flex-col">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search engineers..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9 text-sm" />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32 h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="on_the_way">On the Way</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="unavailable">Offline</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-xs text-muted-foreground">{filteredEngineers.length} engineer{filteredEngineers.length !== 1 ? "s" : ""}</p>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <Switch id="trails" checked={showTrails} onCheckedChange={setShowTrails} className="scale-75" />
                  <Label htmlFor="trails" className="text-[10px] text-muted-foreground cursor-pointer flex items-center gap-1">
                    <Route className="w-3 h-3" /> Trails
                  </Label>
                </div>
                <div className="flex items-center gap-1.5">
                  <Switch id="geofences" checked={showGeofences} onCheckedChange={setShowGeofences} className="scale-75" />
                  <Label htmlFor="geofences" className="text-[10px] text-muted-foreground cursor-pointer flex items-center gap-1">
                    <Shield className="w-3 h-3" /> Geofences
                  </Label>
                </div>
                <div className="flex items-center gap-1.5">
                  <Switch id="speedAlerts" checked={showSpeedAlerts} onCheckedChange={setShowSpeedAlerts} className="scale-75" />
                  <Label htmlFor="speedAlerts" className="text-[10px] text-muted-foreground cursor-pointer flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Speed
                    {speedingEngineers.length > 0 && (
                      <span className="w-3.5 h-3.5 rounded-full bg-red-500 text-white text-[7px] flex items-center justify-center font-bold">{speedingEngineers.length}</span>
                    )}
                  </Label>
                </div>
                <div className="flex items-center gap-1.5">
                  <Switch id="heatmap" checked={showHeatmap} onCheckedChange={setShowHeatmap} className="scale-75" />
                  <Label htmlFor="heatmap" className="text-[10px] text-muted-foreground cursor-pointer flex items-center gap-1">
                    <Flame className="w-3 h-3" /> Heatmap
                  </Label>
                </div>
                <Button
                  variant={showJobFilters ? "default" : "outline"}
                  size="sm"
                  className={cn("h-7 text-[10px] gap-1 relative", showJobFilters && "bg-primary")}
                  onClick={() => setShowJobFilters(!showJobFilters)}
                >
                  <Filter className="w-3 h-3" />
                  Jobs
                  {activeJobFilterCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[8px] flex items-center justify-center font-bold">
                      {activeJobFilterCount}
                    </span>
                  )}
                </Button>
                <Button
                  variant={replayMode ? "default" : "outline"}
                  size="sm"
                  className={cn("h-7 text-[10px] gap-1", replayMode && "bg-violet-600 hover:bg-violet-700")}
                  onClick={toggleReplayMode}
                >
                  <History className="w-3 h-3" />
                  Replay
                </Button>
                <Button
                  variant={autoRefresh ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-[10px] gap-1"
                  onClick={() => setAutoRefresh(!autoRefresh)}
                >
                  {autoRefresh ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                  {autoRefresh ? "Live" : "Paused"}
                </Button>
              </div>
            </div>

            {/* Job filter panel */}
            {showJobFilters && (
              <div className="border border-border/50 rounded-lg p-3 bg-muted/30 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
                    <Filter className="w-3.5 h-3.5 text-primary" /> Job Filters
                  </span>
                  <div className="flex items-center gap-1.5">
                    {activeJobFilterCount > 0 && (
                      <Button variant="ghost" size="sm" className="h-6 text-[9px] px-2" onClick={() => { setJobStatusFilter("all"); setJobPriorityFilter("all"); setJobServiceFilter("all"); }}>
                        Clear all
                      </Button>
                    )}
                    <Badge variant="outline" className="text-[9px] h-4">{filteredJobs.length}/{activeJobs.length} jobs</Badge>
                  </div>
                </div>
                <div className="space-y-2">
                  <div>
                    <Label className="text-[10px] text-muted-foreground mb-1 block">Status</Label>
                    <Select value={jobStatusFilter} onValueChange={setJobStatusFilter}>
                      <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="assigned">Assigned</SelectItem>
                        <SelectItem value="accepted">Accepted</SelectItem>
                        <SelectItem value="on_the_way">On the Way</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground mb-1 block">Priority</Label>
                    <Select value={jobPriorityFilter} onValueChange={setJobPriorityFilter}>
                      <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Priorities</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground mb-1 block">Service Type</Label>
                    <Select value={jobServiceFilter} onValueChange={setJobServiceFilter}>
                      <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        {serviceTypes.map(t => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            <ScrollArea className="flex-1 min-h-0">
              <div className="space-y-2 pr-2">
                {filteredEngineers.map(eng => (
                  <Card
                    key={eng.id}
                    className={cn(
                      "cursor-pointer transition-all hover:shadow-md border",
                      selectedEngineerId === eng.id ? "border-primary ring-1 ring-primary/20" : "border-border/50"
                    )}
                    onClick={() => setSelectedEngineerId(selectedEngineerId === eng.id ? null : eng.id)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start gap-3">
                        <div className={cn("w-9 h-9 rounded-full flex items-center justify-center shrink-0 relative",
                          eng.trackingStatus === "on_the_way" ? "bg-violet-500/15" :
                          eng.trackingStatus === "in_progress" ? "bg-amber-500/15" :
                          eng.trackingStatus === "available" ? "bg-emerald-500/15" : "bg-muted"
                        )}>
                          <User className={cn("w-4 h-4",
                            eng.trackingStatus === "on_the_way" ? "text-violet-500" :
                            eng.trackingStatus === "in_progress" ? "text-amber-500" :
                            eng.trackingStatus === "available" ? "text-emerald-500" : "text-muted-foreground"
                          )} />
                          {/* Online/offline indicator dot */}
                          <span className={cn(
                            "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card",
                            eng.isOnline ? "bg-emerald-500" : "bg-muted-foreground/50"
                          )} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-foreground truncate">{eng.name}</p>
                            <Badge variant="outline" className={cn("text-[9px] h-5 shrink-0", statusColors[eng.trackingStatus])}>
                              {eng.trackingStatus === "on_the_way" ? "En Route" :
                               eng.trackingStatus === "in_progress" ? "Working" :
                               eng.trackingStatus === "available" ? "Available" : "Offline"}
                            </Badge>
                          </div>
                          <p className="text-[10px] text-muted-foreground">{eng.specialty}</p>
                          <p className={cn("text-[9px] flex items-center gap-1 mt-0.5", eng.isOnline ? "text-emerald-600" : "text-muted-foreground")}>
                            <Wifi className="w-2.5 h-2.5" />
                            {eng.isOnline ? "Online" : eng.lastSeenAt ? `Last seen ${formatDistanceToNow(eng.lastSeenAt, { addSuffix: true })}` : "No location data"}
                          </p>
                          {eng.isOnline && eng.speedKmh !== null && (
                            <p className={cn("text-[9px] flex items-center gap-1 mt-0.5",
                              eng.speedKmh > speedThreshold ? "text-red-500 font-semibold" : "text-primary"
                            )}>
                              {eng.speedKmh > speedThreshold ? <AlertTriangle className="w-2.5 h-2.5" /> : <Gauge className="w-2.5 h-2.5" />}
                              {eng.speedKmh} km/h
                              {eng.speedKmh > speedThreshold && <span className="text-[8px]">(⚠ speeding)</span>}
                            </p>
                          )}
                          {eng.activeJob && (
                            <div className="mt-1.5 p-1.5 rounded bg-muted/50 border border-border/50">
                              <p className="text-[10px] font-medium text-foreground truncate">{eng.activeJob.title}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                                  <MapPin className="w-2.5 h-2.5" /> {eng.activeJob.location}
                                </span>
                              </div>
                              {eng.activeJob.scheduled_at && (
                                <span className="text-[9px] text-muted-foreground flex items-center gap-0.5 mt-0.5">
                                  <Clock className="w-2.5 h-2.5" /> {formatDistanceToNow(new Date(eng.activeJob.scheduled_at), { addSuffix: true })}
                                </span>
                              )}
                              {eng.eta && (
                                <div className="mt-1 p-1 rounded bg-violet-500/10 border border-violet-200/50">
                                  <span className="text-[9px] font-medium text-violet-600 flex items-center gap-0.5">
                                    <Timer className="w-2.5 h-2.5" />
                                    ETA: {eng.eta.minutes < 1 ? "< 1 min" : `${eng.eta.minutes} min`} · {format(eng.eta.arrivalTime, "HH:mm")}
                                  </span>
                                  <span className="text-[8px] text-violet-500/70 ml-3">
                                    {eng.eta.distKm.toFixed(1)} km away
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                          {eng.assignedJobCount > 0 && !eng.activeJob && (
                            <p className="text-[10px] text-muted-foreground mt-1">{eng.assignedJobCount} job{eng.assignedJobCount > 1 ? "s" : ""} queued</p>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 text-[10px] w-full mt-2 gap-1"
                            onClick={(e) => { e.stopPropagation(); setTimelineEngineerId(eng.id); }}
                          >
                            <Activity className="w-3 h-3" /> Activity Timeline
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {filteredEngineers.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-8">No engineers match your filters.</p>
                )}
              </div>
            </ScrollArea>

            {/* Geofence events feed */}
            {showGeofences && geofenceEvents.length > 0 && (
              <div className="border border-border/50 rounded-lg overflow-hidden">
                <div className="px-3 py-2 bg-muted/30 border-b border-border/50 flex items-center gap-2">
                  <Bell className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-medium text-foreground">Geofence Alerts</span>
                  <Badge variant="outline" className="text-[9px] h-4 ml-auto">{geofenceEvents.length}</Badge>
                </div>
                <ScrollArea className="max-h-36">
                  <div className="divide-y divide-border/30">
                    {geofenceEvents.slice(0, 10).map(evt => {
                      const eng = enrichedEngineers.find(e => e.id === evt.engineer_id);
                      const job = activeJobs.find(j => j.id === evt.job_id);
                      return (
                        <div key={evt.id} className="px-3 py-1.5 flex items-center gap-2">
                          <div className={cn("w-5 h-5 rounded-full flex items-center justify-center shrink-0",
                            evt.event_type === "arrival" ? "bg-emerald-500/15" : "bg-red-500/15"
                          )}>
                            {evt.event_type === "arrival"
                              ? <LogIn className="w-3 h-3 text-emerald-600" />
                              : <LogOut className="w-3 h-3 text-red-500" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-medium text-foreground truncate">
                              {eng?.name ?? "Engineer"} {evt.event_type === "arrival" ? "arrived at" : "left"} {job?.title ?? "job site"}
                            </p>
                            <p className="text-[9px] text-muted-foreground">
                              {Math.round(evt.distance_meters)}m · {formatDistanceToNow(new Date(evt.created_at), { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Speed alerts */}
            {showSpeedAlerts && speedingEngineers.length > 0 && (
              <div className="border border-red-200 rounded-lg overflow-hidden bg-red-500/5">
                <div className="px-3 py-2 bg-red-500/10 border-b border-red-200/50 flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                  <span className="text-xs font-medium text-red-600">Speed Alerts</span>
                  <Badge variant="outline" className="text-[9px] h-4 ml-auto border-red-200 text-red-500">{speedingEngineers.length}</Badge>
                </div>
                <div className="px-3 py-1.5 border-b border-red-100/50 flex items-center gap-2">
                  <Label className="text-[9px] text-muted-foreground whitespace-nowrap">Threshold:</Label>
                  <Input
                    type="number"
                    value={speedThreshold}
                    onChange={e => setSpeedThreshold(Math.max(1, Number(e.target.value)))}
                    className="h-6 w-16 text-[10px] px-1.5"
                    min={1}
                  />
                  <span className="text-[9px] text-muted-foreground">km/h</span>
                </div>
                <ScrollArea className="max-h-36">
                  <div className="divide-y divide-red-100/30">
                    {speedingEngineers.map(eng => (
                      <div
                        key={eng.id}
                        className="px-3 py-1.5 flex items-center gap-2 cursor-pointer hover:bg-red-500/5"
                        onClick={() => setSelectedEngineerId(eng.id)}
                      >
                        <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 bg-red-500/15">
                          <Zap className="w-3 h-3 text-red-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-medium text-foreground truncate">
                            {eng.name} is speeding
                          </p>
                          <p className="text-[9px] text-red-500 font-semibold">
                            {eng.speedKmh} km/h (limit: {speedThreshold} km/h)
                          </p>
                        </div>
                        <Badge variant="outline" className="text-[8px] h-4 border-red-200 text-red-500 shrink-0">
                          +{eng.speedKmh! - speedThreshold} km/h
                        </Badge>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>

          {/* Map */}
          <div className="flex-1 rounded-xl overflow-hidden border border-border shadow-card min-h-[350px] lg:min-h-0 relative">
            <MapContainer center={[51.5074, -0.1278]} zoom={11} className="w-full h-full" style={{ minHeight: 350 }}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {!selected && bounds && <FitBounds bounds={bounds} />}
              {selected && <FlyTo lat={selected.latitude!} lng={selected.longitude!} />}

              {/* Heatmap layer */}
              <HeatmapLayer points={heatmapPoints} show={showHeatmap} />

              {/* Route lines with ETA tooltip */}
              {!replayMode && routeLines.map(line => {
                const eng = enrichedEngineers.find(e => e.id === line.engineerId);
                return (
                  <Polyline
                    key={line.engineerId}
                    positions={[line.from, line.to]}
                    pathOptions={{
                      color: line.status === "on_the_way" ? "#8b5cf6" : "#f59e0b",
                      weight: 3,
                      dashArray: "8 6",
                      opacity: 0.7,
                    }}
                  >
                    {eng?.eta && (
                      <Popup>
                        <div className="text-xs">
                          <p className="font-semibold">{eng.name} → {eng.activeJob?.title}</p>
                          <p className="text-violet-600 font-medium">ETA: {eng.eta.minutes} min · {format(eng.eta.arrivalTime, "HH:mm")}</p>
                          <p className="text-muted-foreground">{eng.eta.distKm.toFixed(1)} km</p>
                        </div>
                      </Popup>
                    )}
                  </Polyline>
                );
              })}

              {/* Movement trails */}
              {showTrails && Array.from(trailsByEngineer.entries()).map(([engineerId, points]) => {
                if (points.length < 2) return null;
                const eng = enrichedEngineers.find(e => e.id === engineerId);
                if (selectedEngineerId && engineerId !== selectedEngineerId) return null;
                const trailColor = eng?.trackingStatus === "on_the_way" ? "#8b5cf6" :
                  eng?.trackingStatus === "in_progress" ? "#f59e0b" : "#10b981";
                return (
                  <Polyline
                    key={`trail-${engineerId}`}
                    positions={points}
                    pathOptions={{ color: trailColor, weight: 3, opacity: 0.5 }}
                  >
                    <Popup>
                      <div className="text-xs">
                        <p className="font-semibold">{eng?.name ?? "Engineer"}</p>
                        <p className="text-muted-foreground">{points.length} location points today</p>
                      </div>
                    </Popup>
                  </Polyline>
                );
              })}

              {/* Small dots at each trail point */}
              {showTrails && Array.from(trailsByEngineer.entries()).map(([engineerId, points]) => {
                if (selectedEngineerId && engineerId !== selectedEngineerId) return null;
                return points.map((p, i) => (
                  <CircleMarker
                    key={`dot-${engineerId}-${i}`}
                    center={p}
                    radius={2.5}
                    pathOptions={{ color: "#6366f1", fillColor: "#6366f1", fillOpacity: 0.6, weight: 1 }}
                  />
                ));
              })}

              {/* Job markers with clustering */}
              {!replayMode && filteredJobs.filter(j => j.latitude && j.longitude).map(job => (
                    <Marker
                      key={job.id}
                      position={[job.latitude!, job.longitude!]}
                      icon={jobIcon(job.priority)}
                      eventHandlers={{ click: () => setSelectedJobId(job.id) }}
                    >
                      <Popup>
                        <div className="text-sm min-w-[140px]">
                          <p className="font-semibold">{job.title}</p>
                          <p className="text-muted-foreground text-xs">{job.service_type}</p>
                          <p className="text-xs capitalize mt-1">{job.status.replace(/_/g, " ")} · {job.priority}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{clientMap.get(job.client_id) ?? ""}</p>
                          <Button size="sm" variant="outline" className="mt-2 h-6 text-[10px] w-full" onClick={() => setSelectedJobId(job.id)}>
                            View Details
                          </Button>
                        </div>
                      </Popup>
                    </Marker>
                  ))}

              {/* Geofence radius circles around active jobs */}
              {showGeofences && !replayMode && filteredJobs.filter(j => j.latitude && j.longitude).map(job => {
                // Check if any engineer has arrived at this job
                const hasArrival = geofenceEvents.some(e => e.job_id === job.id && e.event_type === "arrival");
                return (
                  <LeafletCircle
                    key={`geofence-${job.id}`}
                    center={[job.latitude!, job.longitude!]}
                    radius={(job as any).geofence_radius ?? 200}
                    pathOptions={{
                      color: hasArrival ? "#10b981" : "#6366f1",
                      fillColor: hasArrival ? "#10b981" : "#6366f1",
                      fillOpacity: 0.08,
                      weight: 1.5,
                      dashArray: "6 4",
                    }}
                  >
                    <Popup>
                      <div className="text-xs">
                        <p className="font-semibold">{job.title}</p>
                        <p className="text-muted-foreground">{(job as any).geofence_radius ?? 200}m geofence radius</p>
                        {hasArrival && <p className="text-emerald-600 font-medium">Engineer on site</p>}
                      </div>
                    </Popup>
                  </LeafletCircle>
                );
              })}

              {!replayMode && filteredEngineers.map(eng => (
                <AnimatedMarker
                  key={eng.id}
                  position={[eng.latitude!, eng.longitude!]}
                  icon={icons[eng.trackingStatus as keyof typeof icons] ?? icons.unavailable}
                  bearing={["on_the_way", "in_progress"].includes(eng.trackingStatus) ? eng.bearing : null}
                  duration={1200}
                  eventHandlers={{ click: () => setSelectedEngineerId(eng.id) }}
                >
                  <Popup>
                    <div className="text-sm min-w-[160px]">
                      <div className="flex items-center gap-1.5">
                        <span className={cn("w-2 h-2 rounded-full shrink-0", eng.isOnline ? "bg-emerald-500" : "bg-gray-400")} />
                        <p className="font-semibold">{eng.name}</p>
                      </div>
                      <p className="text-muted-foreground text-xs">{eng.specialty}</p>
                      <p className={cn("text-xs mt-1 capitalize",
                        eng.trackingStatus === "available" ? "text-emerald-600" :
                        eng.trackingStatus === "on_the_way" ? "text-violet-600" :
                        eng.trackingStatus === "in_progress" ? "text-amber-600" : "text-muted-foreground"
                      )}>
                        {eng.trackingStatus.replace(/_/g, " ")}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {eng.isOnline ? "🟢 Online now" : eng.lastSeenAt ? `Last seen ${formatDistanceToNow(eng.lastSeenAt, { addSuffix: true })}` : "No location data"}
                      </p>
                      {eng.isOnline && eng.speedKmh !== null && (
                        <p className="text-[10px] text-primary font-medium mt-0.5">
                          🏎️ {eng.speedKmh} km/h
                        </p>
                      )}
                      {eng.activeJob && <p className="text-xs text-muted-foreground mt-0.5">→ {eng.activeJob.title}</p>}
                      {eng.eta && (
                        <p className="text-xs text-violet-600 font-medium mt-0.5">
                          ETA: {eng.eta.minutes < 1 ? "< 1 min" : `${eng.eta.minutes} min`} ({eng.eta.distKm.toFixed(1)} km)
                        </p>
                      )}
                      {eng.location && <p className="text-xs text-muted-foreground mt-0.5">{eng.location}</p>}
                    </div>
                  </Popup>
                </AnimatedMarker>
              ))}

              {/* Replay ghost markers */}
              {replayMode && replayPositions.map(pos => (
                <Marker
                  key={`replay-${pos.engineerId}`}
                  position={[pos.lat, pos.lng]}
                  icon={makeIcon("#8b5cf6", true)}
                >
                  <Popup>
                    <div className="text-sm min-w-[140px]">
                      <p className="font-semibold">{pos.name}</p>
                      <p className="text-xs text-violet-600">Position at {formatMinutes(replayMinutes)}</p>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>

            {/* Replay time slider overlay */}
            {replayMode && (
              <div className="absolute bottom-4 left-4 right-4 z-[1000] bg-background/95 backdrop-blur-sm border border-border rounded-xl p-3 shadow-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-violet-500" />
                    <span className="text-sm font-semibold text-foreground">Replay Mode</span>
                    <Badge variant="outline" className="text-[10px] h-5 bg-violet-500/10 text-violet-600 border-violet-200">
                      {formatMinutes(replayMinutes)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <Select value={String(playbackSpeed)} onValueChange={v => setPlaybackSpeed(Number(v))}>
                      <SelectTrigger className="w-16 h-7 text-[10px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1×</SelectItem>
                        <SelectItem value="5">5×</SelectItem>
                        <SelectItem value="10">10×</SelectItem>
                        <SelectItem value="30">30×</SelectItem>
                        <SelectItem value="60">60×</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setReplayMinutes(Math.max(0, replayMinutes - 15))}>
                      <SkipBack className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      className={cn("h-7 w-7 p-0", isPlaying ? "bg-amber-500 hover:bg-amber-600" : "bg-violet-600 hover:bg-violet-700")}
                      onClick={() => setIsPlaying(!isPlaying)}
                    >
                      {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setReplayMinutes(Math.min(replayTimeRange.max, replayMinutes + 15))}>
                      <SkipForward className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground" onClick={toggleReplayMode}>
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-muted-foreground w-10 shrink-0">00:00</span>
                  <Slider
                    value={[replayMinutes]}
                    min={0}
                    max={replayTimeRange.max}
                    step={1}
                    onValueChange={([v]) => { setReplayMinutes(v); setIsPlaying(false); }}
                    className="flex-1"
                  />
                  <span className="text-[10px] text-muted-foreground w-10 shrink-0 text-right">{formatMinutes(replayTimeRange.max)}</span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[9px] text-muted-foreground">{replayPositions.length} engineer{replayPositions.length !== 1 ? "s" : ""} visible</span>
                  <span className="text-[9px] text-muted-foreground">{locationHistory.length} data points today</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Job Detail Drawer */}
      <Sheet open={!!selectedJobId} onOpenChange={(open) => { if (!open) setSelectedJobId(null); }}>
        <SheetContent className="w-[400px] sm:w-[450px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-lg">{selectedJob?.title ?? "Job Details"}</SheetTitle>
            <SheetDescription className="text-xs">
              {selectedJob?.service_type} · {selectedJobClient ?? "Unknown Client"}
            </SheetDescription>
          </SheetHeader>

          {selectedJob && (
            <div className="space-y-5 mt-4">
              {/* Status & Priority */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={cn("capitalize text-xs",
                    selectedJob.status === "in_progress" ? "bg-amber-500/15 text-amber-600 border-amber-200" :
                    selectedJob.status === "on_the_way" ? "bg-violet-500/15 text-violet-600 border-violet-200" :
                    selectedJob.status === "accepted" ? "bg-sky-500/15 text-sky-600 border-sky-200" :
                    "bg-muted text-muted-foreground"
                  )} variant="outline">
                    {selectedJob.status.replace(/_/g, " ")}
                  </Badge>
                  <Badge className={cn("capitalize text-xs",
                    selectedJob.priority === "urgent" ? "bg-red-500/15 text-red-600 border-red-200" :
                    selectedJob.priority === "high" ? "bg-amber-500/15 text-amber-600 border-amber-200" :
                    "bg-muted text-muted-foreground"
                  )} variant="outline">
                    {selectedJob.priority}
                  </Badge>
                </div>

                {/* Update Status */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Update Status</Label>
                  <Select
                    value={selectedJob.status}
                    onValueChange={(val) => updateJobStatusMutation.mutate({ jobId: selectedJob.id, status: val })}
                    disabled={updateJobStatusMutation.isPending}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["pending", "assigned", "accepted", "on_the_way", "in_progress", "completed", "cancelled"].map(s => (
                        <SelectItem key={s} value={s} className="text-xs capitalize">{s.replace(/_/g, " ")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              {/* Location */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-primary" /> Location
                </h4>
                <p className="text-sm text-muted-foreground">{selectedJob.location}</p>
                {selectedJob.latitude && selectedJob.longitude && (
                  <p className="text-[10px] text-muted-foreground font-mono">
                    {selectedJob.latitude.toFixed(5)}, {selectedJob.longitude.toFixed(5)}
                  </p>
                )}
                {selectedJob.latitude && selectedJob.longitude && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1.5"
                    onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${selectedJob.latitude},${selectedJob.longitude}`, "_blank")}
                  >
                    <Navigation className="w-3 h-3" /> Open in Maps
                  </Button>
                )}
              </div>

              <Separator />

              {/* Schedule */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-primary" /> Schedule
                </h4>
                {selectedJob.scheduled_at ? (
                  <div>
                    <p className="text-sm text-foreground">{format(new Date(selectedJob.scheduled_at), "PPpp")}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(selectedJob.scheduled_at), { addSuffix: true })}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Not scheduled</p>
                )}
              </div>

              <Separator />

              {/* Assigned Engineer */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-primary" /> Assigned Engineer
                </h4>
                {selectedJobEngineer ? (
                  <div className="p-3 rounded-lg border border-border/50 bg-muted/30 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <div className={cn("w-8 h-8 rounded-full flex items-center justify-center relative",
                        selectedJobEngineer.trackingStatus === "on_the_way" ? "bg-violet-500/15" :
                        selectedJobEngineer.trackingStatus === "in_progress" ? "bg-amber-500/15" :
                        "bg-muted"
                      )}>
                        <User className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className={cn("absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-card",
                          selectedJobEngineer.isOnline ? "bg-emerald-500" : "bg-muted-foreground/50"
                        )} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{selectedJobEngineer.name}</p>
                        <p className="text-[10px] text-muted-foreground">{selectedJobEngineer.specialty}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-0.5">
                        <Wifi className="w-2.5 h-2.5" />
                        {selectedJobEngineer.isOnline ? "Online" : "Offline"}
                      </span>
                      {selectedJobEngineer.speedKmh !== null && (
                        <span className="flex items-center gap-0.5">
                          <Gauge className="w-2.5 h-2.5" />
                          {selectedJobEngineer.speedKmh} km/h
                        </span>
                      )}
                      {selectedJobEngineer.rating && (
                        <span>⭐ {selectedJobEngineer.rating.toFixed(1)}</span>
                      )}
                    </div>
                    {selectedJobEngineer.eta && (
                      <div className="mt-1.5 p-2 rounded bg-violet-500/10 border border-violet-200/50">
                        <span className="text-xs font-medium text-violet-600 flex items-center gap-1">
                          <Timer className="w-3 h-3" />
                          ETA: {selectedJobEngineer.eta.minutes < 1 ? "< 1 min" : `${selectedJobEngineer.eta.minutes} min`} · {format(selectedJobEngineer.eta.arrivalTime, "HH:mm")}
                        </span>
                        <span className="text-[10px] text-violet-500/70 ml-4">
                          {selectedJobEngineer.eta.distKm.toFixed(1)} km away
                        </span>
                      </div>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs w-full mt-1 gap-1.5"
                      onClick={() => { setSelectedJobId(null); setSelectedEngineerId(selectedJobEngineer.id); }}
                    >
                      <Navigation className="w-3 h-3" /> Track Engineer
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No engineer assigned</p>
                )}

                {/* Reassign Engineer */}
                <div className="space-y-1.5 mt-3">
                  <Label className="text-xs font-semibold">Reassign Engineer</Label>
                  <Select
                    value={selectedJob.engineer_id ?? "unassigned"}
                    onValueChange={(val) => reassignJobMutation.mutate({
                      jobId: selectedJob.id,
                      engineerId: val === "unassigned" ? null : val,
                    })}
                    disabled={reassignJobMutation.isPending}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select engineer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned" className="text-xs">Unassigned</SelectItem>
                      {enrichedEngineers.map(eng => (
                        <SelectItem key={eng.id} value={eng.id} className="text-xs">
                          {eng.name} {eng.isOnline ? "🟢" : "⚫"} — {eng.specialty}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              {/* Geofence Events for this job */}
              {(() => {
                const jobEvents = geofenceEvents.filter(e => e.job_id === selectedJob.id);
                if (jobEvents.length === 0) return null;
                return (
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-primary" /> Geofence Events
                    </h4>
                    <div className="space-y-1.5">
                      {jobEvents.map(evt => {
                        const eng = enrichedEngineers.find(e => e.id === evt.engineer_id);
                        return (
                          <div key={evt.id} className="flex items-center gap-2 p-2 rounded border border-border/50 bg-muted/20">
                            <div className={cn("w-5 h-5 rounded-full flex items-center justify-center shrink-0",
                              evt.event_type === "arrival" ? "bg-emerald-500/15" : "bg-red-500/15"
                            )}>
                              {evt.event_type === "arrival"
                                ? <LogIn className="w-3 h-3 text-emerald-600" />
                                : <LogOut className="w-3 h-3 text-red-500" />}
                            </div>
                            <div className="flex-1">
                              <p className="text-[10px] font-medium text-foreground">
                                {eng?.name ?? "Engineer"} {evt.event_type === "arrival" ? "arrived" : "departed"}
                              </p>
                              <p className="text-[9px] text-muted-foreground">
                                {Math.round(evt.distance_meters)}m · {formatDistanceToNow(new Date(evt.created_at), { addSuffix: true })}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Engineer Activity Timeline Drawer */}
      <Sheet open={!!timelineEngineerId} onOpenChange={(open) => { if (!open) setTimelineEngineerId(null); }}>
        <SheetContent className="w-[400px] sm:w-[450px] overflow-y-auto" side="left">
          <SheetHeader>
            <SheetTitle className="text-lg flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              {timelineEngineer?.name ?? "Engineer"} — Activity
            </SheetTitle>
            <SheetDescription className="text-xs">
              {timelineEngineer?.specialty} · {timelineEngineer?.isOnline ? "🟢 Online" : "⚫ Offline"}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4">
            {timelineEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No activity recorded yet.</p>
            ) : (
              <div className="relative pl-6 space-y-0">
                {/* Vertical timeline line */}
                <div className="absolute left-[9px] top-2 bottom-2 w-px bg-border" />

                {timelineEvents.map((evt, idx) => (
                  <div key={evt.id} className="relative pb-4">
                    {/* Timeline dot */}
                    <div className={cn(
                      "absolute -left-6 top-0.5 w-[18px] h-[18px] rounded-full border-2 border-card flex items-center justify-center z-10",
                      evt.icon === "arrival" ? "bg-emerald-500/20" :
                      evt.icon === "departure" ? "bg-red-500/20" :
                      evt.icon === "speed" ? "bg-red-500/20" :
                      "bg-primary/20"
                    )}>
                      {evt.icon === "arrival" && <LogIn className="w-2.5 h-2.5 text-emerald-600" />}
                      {evt.icon === "departure" && <LogOut className="w-2.5 h-2.5 text-red-500" />}
                      {evt.icon === "speed" && <Zap className="w-2.5 h-2.5 text-red-500" />}
                      {evt.icon === "status" && <Activity className="w-2.5 h-2.5 text-primary" />}
                    </div>

                    <div className="pl-2">
                      <p className="text-xs font-medium text-foreground">{evt.title}</p>
                      <p className="text-[10px] text-muted-foreground">{evt.subtitle}</p>
                      <p className="text-[9px] text-muted-foreground/70 mt-0.5">
                        {formatDistanceToNow(evt.timestamp, { addSuffix: true })} · {format(evt.timestamp, "HH:mm")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
};

export default LiveTracking;
