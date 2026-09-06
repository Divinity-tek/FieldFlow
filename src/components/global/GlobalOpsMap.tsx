import { useEffect, useMemo } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

interface RegionPoint {
  id: string;
  name: string;
  city: string;
  country: string;
  activeJobs: number;
  engineers: number;
  revenue: number;
  lat: number;
  lng: number;
}

interface EngineerPoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  available: boolean;
  specialty: string;
}

interface JobPoint {
  id: string;
  title: string;
  lat: number;
  lng: number;
  status: string;
  priority: string;
}

interface Props {
  regions: RegionPoint[];
  engineers: EngineerPoint[];
  jobs: JobPoint[];
}

function FitAll({ points }: { points: { lat: number; lng: number }[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 0) {
      const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 6 });
    }
  }, [points, map]);
  return null;
}

const priorityColor: Record<string, string> = {
  urgent: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#22c55e",
};

const statusColor: Record<string, string> = {
  pending: "#94a3b8",
  assigned: "#3b82f6",
  accepted: "#6366f1",
  on_the_way: "#f59e0b",
  in_progress: "#22c55e",
};

const GlobalOpsMap = ({ regions, engineers, jobs }: Props) => {
  const allPoints = useMemo(() => {
    const pts: { lat: number; lng: number }[] = [];
    regions.forEach((r) => pts.push({ lat: r.lat, lng: r.lng }));
    engineers.forEach((e) => pts.push({ lat: e.lat, lng: e.lng }));
    jobs.forEach((j) => pts.push({ lat: j.lat, lng: j.lng }));
    return pts;
  }, [regions, engineers, jobs]);

  return (
    <div className="w-full h-[480px] rounded-xl overflow-hidden border border-border">
      <MapContainer
        center={[30, 10]}
        zoom={2}
        className="h-full w-full"
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        {allPoints.length > 0 && <FitAll points={allPoints} />}

        {/* Region bubbles — sized by job count */}
        {regions.map((r) => (
          <CircleMarker
            key={`region-${r.id}`}
            center={[r.lat, r.lng]}
            radius={Math.max(12, Math.min(40, 12 + r.activeJobs * 3))}
            pathOptions={{
              color: "hsl(221, 83%, 53%)",
              fillColor: "hsl(221, 83%, 53%)",
              fillOpacity: 0.18,
              weight: 2,
            }}
          >
            <Popup>
              <div className="text-sm space-y-1 min-w-[160px]">
                <p className="font-bold text-base">{r.name}</p>
                <p className="text-muted-foreground">{r.city}, {r.country}</p>
                <div className="grid grid-cols-3 gap-1 pt-1 text-center">
                  <div>
                    <p className="font-semibold">{r.activeJobs}</p>
                    <p className="text-[10px]">Active Jobs</p>
                  </div>
                  <div>
                    <p className="font-semibold">{r.engineers}</p>
                    <p className="text-[10px]">Engineers</p>
                  </div>
                  <div>
                    <p className="font-semibold">£{(r.revenue / 1000).toFixed(0)}k</p>
                    <p className="text-[10px]">Revenue</p>
                  </div>
                </div>
              </div>
            </Popup>
          </CircleMarker>
        ))}

        {/* Engineer dots */}
        {engineers.map((e) => (
          <CircleMarker
            key={`eng-${e.id}`}
            center={[e.lat, e.lng]}
            radius={5}
            pathOptions={{
              color: e.available ? "#22c55e" : "#94a3b8",
              fillColor: e.available ? "#22c55e" : "#94a3b8",
              fillOpacity: 0.9,
              weight: 1,
            }}
          >
            <Popup>
              <div className="text-sm">
                <p className="font-semibold">{e.name}</p>
                <p className="text-muted-foreground">{e.specialty}</p>
                <p className={e.available ? "text-green-600" : "text-gray-500"}>
                  {e.available ? "Available" : "Busy"}
                </p>
              </div>
            </Popup>
          </CircleMarker>
        ))}

        {/* Job dots */}
        {jobs.map((j) => (
          <CircleMarker
            key={`job-${j.id}`}
            center={[j.lat, j.lng]}
            radius={4}
            pathOptions={{
              color: priorityColor[j.priority] || "#94a3b8",
              fillColor: statusColor[j.status] || "#94a3b8",
              fillOpacity: 0.85,
              weight: 2,
            }}
          >
            <Popup>
              <div className="text-sm">
                <p className="font-semibold">{j.title}</p>
                <p>Status: <span className="capitalize">{j.status.replace("_", " ")}</span></p>
                <p>Priority: <span className="capitalize">{j.priority}</span></p>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 px-4 py-2 text-xs bg-card border-t border-border">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full border-2 border-primary bg-primary/20 inline-block" /> Region
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" /> Engineer (available)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-slate-400 inline-block" /> Engineer (busy)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" /> Urgent Job
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block" /> High Job
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 inline-block" /> Medium Job
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" /> Low Job
        </span>
      </div>
    </div>
  );
};

export default GlobalOpsMap;
