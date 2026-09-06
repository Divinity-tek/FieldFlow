import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Route, MapPin, Clock, TrendingDown, Zap, Fuel,
  Navigation, ArrowRight, RefreshCw, Leaf, Car,
  Target, BarChart3, Users, CheckCircle,
} from "lucide-react";
import AskAIButton from "@/components/ai/AskAIButton";

// Haversine distance
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Nearest-neighbor TSP heuristic
function optimizeRoute(points: { id: string; lat: number; lng: number }[], startLat: number, startLng: number) {
  if (points.length <= 1) return { order: points, totalKm: 0, savedKm: 0 };
  
  // Original order distance
  let originalDist = haversineKm(startLat, startLng, points[0].lat, points[0].lng);
  for (let i = 1; i < points.length; i++) {
    originalDist += haversineKm(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng);
  }

  // Nearest neighbor
  const remaining = [...points];
  const order: typeof points = [];
  let curLat = startLat, curLng = startLng;
  let optimizedDist = 0;

  while (remaining.length > 0) {
    let minDist = Infinity, minIdx = 0;
    remaining.forEach((p, i) => {
      const d = haversineKm(curLat, curLng, p.lat, p.lng);
      if (d < minDist) { minDist = d; minIdx = i; }
    });
    const next = remaining.splice(minIdx, 1)[0];
    order.push(next);
    optimizedDist += minDist;
    curLat = next.lat;
    curLng = next.lng;
  }

  return { order, totalKm: optimizedDist, savedKm: Math.max(0, originalDist - optimizedDist) };
}

const RouteOptimizer = () => {
  const [selectedEngineer, setSelectedEngineer] = useState("all");
  const [optimizing, setOptimizing] = useState(false);

  const { data: engineers = [] } = useQuery({
    queryKey: ["route-engineers"],
    queryFn: async () => {
      const { data } = await supabase.from("engineers").select("id, user_id, latitude, longitude, specialty");
      return data ?? [];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["route-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, full_name");
      return data ?? [];
    },
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ["route-jobs"],
    queryFn: async () => {
      const { data } = await supabase.from("jobs")
        .select("id, title, latitude, longitude, location, status, priority, service_type, engineer_id, scheduled_at")
        .in("status", ["assigned", "accepted", "on_the_way"]);
      return data ?? [];
    },
  });

  const profileMap = useMemo(() => new Map(profiles.map(p => [p.user_id, p.full_name])), [profiles]);

  // Calculate optimized routes per engineer
  const engineerRoutes = useMemo(() => {
    const engWithJobs = engineers.filter(e => e.latitude && e.longitude).map(eng => {
      const name = profileMap.get(eng.user_id) || eng.specialty;
      const engJobs = jobs.filter(j => j.engineer_id === eng.id && j.latitude && j.longitude)
        .map(j => ({ id: j.id, title: j.title, lat: j.latitude!, lng: j.longitude!, location: j.location, priority: j.priority, status: j.status, scheduled_at: j.scheduled_at }));

      if (engJobs.length === 0) return null;

      const points = engJobs.map(j => ({ id: j.id, lat: j.lat, lng: j.lng }));
      const result = optimizeRoute(points, eng.latitude!, eng.longitude!);
      const orderedJobs = result.order.map(p => engJobs.find(j => j.id === p.id)!);
      const avgSpeed = 30; // km/h urban
      const estTime = Math.round((result.totalKm / avgSpeed) * 60);
      const savedTime = Math.round((result.savedKm / avgSpeed) * 60);
      const co2Saved = result.savedKm * 0.21; // kg CO2 per km avg car

      return { id: eng.id, name, jobs: orderedJobs, totalKm: result.totalKm, savedKm: result.savedKm, estTime, savedTime, co2Saved, jobCount: engJobs.length };
    }).filter(Boolean);

    return engWithJobs as NonNullable<typeof engWithJobs[0]>[];
  }, [engineers, jobs, profileMap]);

  const filteredRoutes = selectedEngineer === "all" ? engineerRoutes : engineerRoutes.filter(r => r.id === selectedEngineer);

  // Aggregate KPIs
  const totalSavedKm = engineerRoutes.reduce((s, r) => s + r.savedKm, 0);
  const totalSavedTime = engineerRoutes.reduce((s, r) => s + r.savedTime, 0);
  const totalCO2Saved = engineerRoutes.reduce((s, r) => s + r.co2Saved, 0);
  const totalJobs = engineerRoutes.reduce((s, r) => s + r.jobCount, 0);
  const avgEfficiency = engineerRoutes.length > 0 ? Math.round((totalSavedKm / Math.max(1, engineerRoutes.reduce((s, r) => s + r.totalKm + r.savedKm, 0))) * 100) : 0;

  return (
    <AppLayout title="AI Route Optimizer" subtitle="Intelligent route planning to reduce travel time, fuel costs, and carbon emissions">
      <div className="space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "Distance Saved", value: `${totalSavedKm.toFixed(1)} km`, icon: TrendingDown, color: "text-emerald-500" },
            { label: "Time Saved", value: `${totalSavedTime} min`, icon: Clock, color: "text-blue-500" },
            { label: "CO₂ Reduced", value: `${totalCO2Saved.toFixed(1)} kg`, icon: Leaf, color: "text-green-500" },
            { label: "Routes Optimized", value: engineerRoutes.length, icon: Route, color: "text-primary" },
            { label: "Efficiency Gain", value: `${avgEfficiency}%`, icon: Zap, color: "text-amber-500" },
          ].map((k, i) => (
            <Card key={i}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center">
                  <k.icon className={`h-5 w-5 ${k.color}`} />
                </div>
                <div>
                  <div className="text-lg font-bold">{k.value}</div>
                  <div className="text-xs text-muted-foreground">{k.label}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Controls */}
        <div className="flex gap-3">
          <Select value={selectedEngineer} onValueChange={setSelectedEngineer}>
            <SelectTrigger className="w-52"><SelectValue placeholder="All Engineers" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Engineers</SelectItem>
              {engineerRoutes.map(r => <SelectItem key={r.id} value={r.id}>{r.name} ({r.jobCount} jobs)</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" className="gap-2" onClick={() => { setOptimizing(true); setTimeout(() => setOptimizing(false), 1500); }}>
            <RefreshCw className={`h-4 w-4 ${optimizing ? "animate-spin" : ""}`} /> Re-optimize
          </Button>
          <AskAIButton prompt="Analyze current engineer routes, identify clustering opportunities, suggest multi-day route optimization strategies, and estimate weekly fuel savings." label="AI Route Analysis" />
        </div>

        {/* Routes */}
        <div className="space-y-4">
          {filteredRoutes.map(route => (
            <Card key={route.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Car className="h-4 w-4 text-primary" />
                    {route.name}
                    <Badge variant="secondary" className="text-[10px]">{route.jobCount} stops</Badge>
                  </CardTitle>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1 text-emerald-500"><TrendingDown className="h-3 w-3" /> {route.savedKm.toFixed(1)} km saved</span>
                    <span className="flex items-center gap-1 text-blue-500"><Clock className="h-3 w-3" /> {route.savedTime} min saved</span>
                    <span className="flex items-center gap-1 text-green-500"><Leaf className="h-3 w-3" /> {route.co2Saved.toFixed(1)} kg CO₂</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 overflow-x-auto pb-2">
                  <div className="flex items-center gap-1 shrink-0">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Navigation className="h-4 w-4 text-primary" />
                    </div>
                    <span className="text-[10px] text-muted-foreground">Start</span>
                  </div>
                  {route.jobs.map((job, i) => (
                    <div key={job.id} className="flex items-center gap-2 shrink-0">
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <div className={`rounded-lg border p-2 min-w-[140px] ${
                        job.priority === "urgent" ? "border-destructive/30 bg-destructive/5" :
                        job.priority === "high" ? "border-amber-500/30 bg-amber-500/5" :
                        "border-border"
                      }`}>
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className="text-[8px] h-4">{i + 1}</Badge>
                          <span className="text-[10px] font-medium truncate max-w-[100px]">{job.title}</span>
                        </div>
                        <p className="text-[9px] text-muted-foreground truncate mt-0.5">{job.location}</p>
                        <div className="flex items-center gap-1 mt-1">
                          <Badge variant="outline" className="text-[8px] h-3.5">{job.priority}</Badge>
                          <Badge variant="secondary" className="text-[8px] h-3.5">{job.status.replace(/_/g, " ")}</Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center gap-1 shrink-0">
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                      <CheckCircle className="h-4 w-4 text-emerald-500" />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-3 pt-3 border-t text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Route className="h-3 w-3" /> {route.totalKm.toFixed(1)} km optimized route</span>
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> ~{route.estTime} min drive time</span>
                  <span className="flex items-center gap-1"><Fuel className="h-3 w-3" /> ~{(route.totalKm * 0.08).toFixed(1)} L fuel est.</span>
                </div>
              </CardContent>
            </Card>
          ))}

          {filteredRoutes.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Route className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No active routes to optimize</p>
                <p className="text-xs mt-1">Assign jobs to engineers to see optimized routes</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Summary Table */}
        {engineerRoutes.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" /> Route Efficiency Summary</CardTitle>
            </CardHeader>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/20">
                  <TableHead>Engineer</TableHead>
                  <TableHead className="text-center">Jobs</TableHead>
                  <TableHead className="text-center">Optimized Distance</TableHead>
                  <TableHead className="text-center">Distance Saved</TableHead>
                  <TableHead className="text-center">Time Saved</TableHead>
                  <TableHead className="text-center">CO₂ Saved</TableHead>
                  <TableHead className="text-center">Efficiency</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {engineerRoutes.sort((a, b) => b.savedKm - a.savedKm).map(r => {
                  const eff = r.totalKm + r.savedKm > 0 ? Math.round((r.savedKm / (r.totalKm + r.savedKm)) * 100) : 0;
                  return (
                    <TableRow key={r.id} className="hover:bg-muted/30">
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="text-center">{r.jobCount}</TableCell>
                      <TableCell className="text-center">{r.totalKm.toFixed(1)} km</TableCell>
                      <TableCell className="text-center text-emerald-500 font-medium">{r.savedKm.toFixed(1)} km</TableCell>
                      <TableCell className="text-center text-blue-500">{r.savedTime} min</TableCell>
                      <TableCell className="text-center text-green-500">{r.co2Saved.toFixed(1)} kg</TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center gap-2 justify-center">
                          <Progress value={eff} className="w-12 h-2" />
                          <span className="text-xs">{eff}%</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </AppLayout>
  );
};

export default RouteOptimizer;
