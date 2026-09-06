import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, MapPin, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

type Job = {
  id: string;
  title: string;
  status: string;
  priority: string | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  scheduled_at: string | null;
};

const statusColor: Record<string, string> = {
  pending: "#6b7280",
  assigned: "#3b82f6",
  in_progress: "#10b981",
  completed: "#8b5cf6",
  cancelled: "#ef4444",
};

const buildIcon = (status: string) =>
  new L.DivIcon({
    className: "",
    html: `<div style="width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${statusColor[status] ?? "#3b82f6"};border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center"><svg style="transform:rotate(45deg)" width="14" height="14" fill="white" viewBox="0 0 24 24"><path d="M12 2C8 2 5 5 5 9c0 5 7 13 7 13s7-8 7-13c0-4-3-7-7-7z"/></svg></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -30],
  });

function FitBounds({ jobs }: { jobs: Job[] }) {
  const map = useMap();
  useEffect(() => {
    const pts = jobs.filter((j) => j.latitude && j.longitude).map((j) => [j.latitude!, j.longitude!] as [number, number]);
    if (pts.length === 0) return;
    if (pts.length === 1) {
      map.setView(pts[0], 13);
      return;
    }
    map.fitBounds(L.latLngBounds(pts), { padding: [30, 30] });
  }, [jobs, map]);
  return null;
}

export default function EngineerJobsMap({ engineerId }: { engineerId: string | null }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [pulse, setPulse] = useState(0);

  const load = async () => {
    if (!engineerId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("jobs_engineer_safe")
      .select("id,title,status,priority,location,latitude,longitude,scheduled_at")
      .eq("engineer_id", engineerId)
      .in("status", ["pending", "assigned", "in_progress"])
      .order("scheduled_at", { ascending: true, nullsFirst: false });
    if (!error) setJobs((data ?? []) as Job[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    if (!engineerId) return;
    const channel = supabase
      .channel(`engineer-jobs-${engineerId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "jobs", filter: `engineer_id=eq.${engineerId}` },
        () => {
          setPulse((p) => p + 1);
          load();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engineerId]);

  const mapped = useMemo(() => jobs.filter((j) => j.latitude && j.longitude), [jobs]);
  const missing = jobs.length - mapped.length;
  const center: [number, number] = mapped[0] ? [mapped[0].latitude!, mapped[0].longitude!] : [51.5074, -0.1278];

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between p-2 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2 text-xs">
          <MapPin className="w-3.5 h-3.5 text-primary" />
          <span className="font-medium text-foreground">Active jobs</span>
          <Badge variant="secondary" className="h-5 text-[10px]">{jobs.length}</Badge>
          {pulse > 0 && (
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> live
            </span>
          )}
        </div>
        <Button variant="ghost" size="sm" className="h-6 px-2" onClick={load} disabled={loading || !engineerId}>
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
        </Button>
      </div>
      <div className="h-64 relative">
        {!engineerId ? (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">No engineer profile</div>
        ) : mapped.length === 0 && !loading ? (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground p-4 text-center">
            {jobs.length === 0 ? "No active jobs." : `No coordinates for your ${jobs.length} active job${jobs.length === 1 ? "" : "s"}.`}
          </div>
        ) : (
          <MapContainer center={center} zoom={11} style={{ height: "100%", width: "100%" }} scrollWheelZoom={false}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
            <FitBounds jobs={mapped} />
            {mapped.map((j) => (
              <Marker key={j.id} position={[j.latitude!, j.longitude!]} icon={buildIcon(j.status)}>
                <Popup>
                  <div className="space-y-1 text-xs">
                    <div className="font-semibold">{j.title}</div>
                    <div className="text-muted-foreground capitalize">{j.status.replace("_", " ")}{j.priority ? ` · ${j.priority}` : ""}</div>
                    {j.location && <div>{j.location}</div>}
                    {j.scheduled_at && <div className="text-muted-foreground">{new Date(j.scheduled_at).toLocaleString()}</div>}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        )}
      </div>
      {missing > 0 && (
        <div className="px-2 py-1 text-[10px] text-muted-foreground border-t border-border bg-muted/20">
          {missing} job{missing === 1 ? "" : "s"} hidden — missing coordinates.
        </div>
      )}
    </div>
  );
}
