import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Globe, Users, Briefcase, MapPin, TrendingUp, Activity } from "lucide-react";
import AskAIButton from "@/components/ai/AskAIButton";
import GlobalOpsMap from "@/components/global/GlobalOpsMap";

const GlobalOperations = () => {
  const { data: engineers = [] } = useQuery({
    queryKey: ["engineers-global"],
    queryFn: async () => {
      const { data } = await supabase.from("engineers").select("*");
      return data || [];
    },
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ["jobs-global"],
    queryFn: async () => {
      const { data } = await supabase.from("jobs").select("*");
      return data || [];
    },
  });

  const { data: regions = [] } = useQuery({
    queryKey: ["regions-global"],
    queryFn: async () => {
      const { data } = await supabase.from("regions").select("*");
      return data || [];
    },
  });

  const { data: shipments = [] } = useQuery({
    queryKey: ["shipments-global"],
    queryFn: async () => {
      const { data } = await supabase.from("shipments").select("*");
      return data || [];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-global"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, user_id");
      return data || [];
    },
  });

  const activeJobs = jobs.filter((j: any) => !["completed", "cancelled"].includes(j.status));
  const availableEngineers = engineers.filter((e: any) => e.is_available);
  const activeRegions = regions.filter((r: any) => r.is_active);
  const inTransitShipments = shipments.filter((s: any) => ["shipped", "in_transit"].includes(s.status));

  // Group jobs by region
  const regionStats = useMemo(() => {
    const regionMap = Object.fromEntries(regions.map((r: any) => [r.id, r]));
    const stats: Record<string, { name: string; city: string; country: string; jobs: number; engineers: number; activeJobs: number; revenue: number }> = {};

    regions.forEach((r: any) => {
      stats[r.id] = { name: r.name, city: r.city, country: r.country, jobs: 0, engineers: 0, activeJobs: 0, revenue: 0 };
    });

    jobs.forEach((j: any) => {
      if (j.region_id && stats[j.region_id]) {
        stats[j.region_id].jobs++;
        if (!["completed", "cancelled"].includes(j.status)) stats[j.region_id].activeJobs++;
        stats[j.region_id].revenue += j.total_price || 0;
      }
    });

    engineers.forEach((e: any) => {
      if (e.region_id && stats[e.region_id]) stats[e.region_id].engineers++;
    });

    return Object.values(stats).sort((a, b) => b.jobs - a.jobs);
  }, [regions, jobs, engineers]);

  // Group by country
  const countryStats = useMemo(() => {
    const byCountry: Record<string, { jobs: number; engineers: number; regions: number; revenue: number }> = {};
    regionStats.forEach(r => {
      if (!byCountry[r.country]) byCountry[r.country] = { jobs: 0, engineers: 0, regions: 0, revenue: 0 };
      byCountry[r.country].jobs += r.jobs;
      byCountry[r.country].engineers += r.engineers;
      byCountry[r.country].regions++;
      byCountry[r.country].revenue += r.revenue;
    });
    return Object.entries(byCountry).sort((a, b) => b[1].jobs - a[1].jobs);
  }, [regionStats]);

  // Prepare map data
  const profileMap = useMemo(() => Object.fromEntries(profiles.map((p: any) => [p.user_id, p.full_name])), [profiles]);

  // Compute region centers from engineer positions
  const mapRegions = useMemo(() => {
    const regionEngs: Record<string, { lats: number[]; lngs: number[] }> = {};
    engineers.forEach((e: any) => {
      if (e.region_id && e.latitude && e.longitude) {
        if (!regionEngs[e.region_id]) regionEngs[e.region_id] = { lats: [], lngs: [] };
        regionEngs[e.region_id].lats.push(e.latitude);
        regionEngs[e.region_id].lngs.push(e.longitude);
      }
    });
    return regionStats
      .filter(r => {
        const rid = regions.find((reg: any) => reg.name === r.name)?.id;
        return rid && regionEngs[rid];
      })
      .map(r => {
        const rid = regions.find((reg: any) => reg.name === r.name)?.id!;
        const engs = regionEngs[rid];
        return {
          id: rid, name: r.name, city: r.city, country: r.country,
          activeJobs: r.activeJobs, engineers: r.engineers, revenue: r.revenue,
          lat: engs.lats.reduce((a, b) => a + b, 0) / engs.lats.length,
          lng: engs.lngs.reduce((a, b) => a + b, 0) / engs.lngs.length,
        };
      });
  }, [regionStats, engineers, regions]);

  const mapEngineers = useMemo(() => engineers
    .filter((e: any) => e.latitude && e.longitude)
    .map((e: any) => ({
      id: e.id, name: profileMap[e.user_id] || "Engineer", lat: e.latitude, lng: e.longitude,
      available: e.is_available ?? false, specialty: e.specialty,
    })), [engineers, profileMap]);

  const mapJobs = useMemo(() => jobs
    .filter((j: any) => j.latitude && j.longitude && !["completed", "cancelled"].includes(j.status))
    .map((j: any) => ({
      id: j.id, title: j.title, lat: j.latitude, lng: j.longitude,
      status: j.status, priority: j.priority,
    })), [jobs]);

  return (
    <AppLayout title="Global Operations" subtitle="Worldwide view of engineers, jobs, logistics, and regional performance">
      <div className="space-y-6">
        {/* Global KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card><CardContent className="pt-6 text-center"><Globe className="w-6 h-6 text-primary mx-auto mb-1" /><p className="text-2xl font-bold">{activeRegions.length}</p><p className="text-xs text-muted-foreground">Active Regions</p></CardContent></Card>
          <Card><CardContent className="pt-6 text-center"><Users className="w-6 h-6 text-blue-500 mx-auto mb-1" /><p className="text-2xl font-bold">{engineers.length}</p><p className="text-xs text-muted-foreground">Total Engineers</p></CardContent></Card>
          <Card><CardContent className="pt-6 text-center"><Briefcase className="w-6 h-6 text-green-500 mx-auto mb-1" /><p className="text-2xl font-bold">{activeJobs.length}</p><p className="text-xs text-muted-foreground">Active Jobs</p></CardContent></Card>
          <Card><CardContent className="pt-6 text-center"><MapPin className="w-6 h-6 text-yellow-500 mx-auto mb-1" /><p className="text-2xl font-bold">{availableEngineers.length}</p><p className="text-xs text-muted-foreground">Available Now</p></CardContent></Card>
          <Card><CardContent className="pt-6 text-center"><Activity className="w-6 h-6 text-red-500 mx-auto mb-1" /><p className="text-2xl font-bold">{inTransitShipments.length}</p><p className="text-xs text-muted-foreground">Shipments Moving</p></CardContent></Card>
          <Card><CardContent className="pt-6 text-center"><TrendingUp className="w-6 h-6 text-purple-500 mx-auto mb-1" /><p className="text-2xl font-bold">£{jobs.reduce((s: number, j: any) => s + (j.total_price || 0), 0).toLocaleString()}</p><p className="text-xs text-muted-foreground">Total Revenue</p></CardContent></Card>
        </div>

        <div className="flex justify-end">
          <AskAIButton prompt="Provide a comprehensive global operations analysis: regional performance, engineer utilization, logistics efficiency, and strategic recommendations for expansion." label="AI Global Analysis" />
        </div>

        {/* Interactive Map */}
        <Card>
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Globe className="w-5 h-5 text-primary" /> Live Operations Map</CardTitle></CardHeader>
          <CardContent>
            <GlobalOpsMap regions={mapRegions} engineers={mapEngineers} jobs={mapJobs} />
          </CardContent>
        </Card>

        {/* Country Overview */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Country Overview</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {countryStats.map(([country, stats]) => (
                <Card key={country} className="border border-border">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-sm">{country}</h4>
                      <Badge variant="outline">{stats.regions} region{stats.regions > 1 ? "s" : ""}</Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div><p className="text-lg font-bold">{stats.jobs}</p><p className="text-[10px] text-muted-foreground">Jobs</p></div>
                      <div><p className="text-lg font-bold">{stats.engineers}</p><p className="text-[10px] text-muted-foreground">Engineers</p></div>
                      <div><p className="text-lg font-bold">£{(stats.revenue / 1000).toFixed(0)}k</p><p className="text-[10px] text-muted-foreground">Revenue</p></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {countryStats.length === 0 && (
                <p className="text-muted-foreground col-span-full text-center py-4">No regional data available. Add regions to see global overview.</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Regional Breakdown */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Regional Performance</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {regionStats.map((region) => (
                <div key={region.name} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <MapPin className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{region.name}</p>
                      <p className="text-xs text-muted-foreground">{region.city}, {region.country}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <div className="text-center"><p className="font-semibold">{region.activeJobs}</p><p className="text-[10px] text-muted-foreground">Active</p></div>
                    <div className="text-center"><p className="font-semibold">{region.engineers}</p><p className="text-[10px] text-muted-foreground">Engineers</p></div>
                    <div className="text-center"><p className="font-semibold">£{region.revenue.toLocaleString()}</p><p className="text-[10px] text-muted-foreground">Revenue</p></div>
                  </div>
                </div>
              ))}
              {regionStats.length === 0 && (
                <p className="text-muted-foreground text-center py-4">No regions configured yet.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default GlobalOperations;
