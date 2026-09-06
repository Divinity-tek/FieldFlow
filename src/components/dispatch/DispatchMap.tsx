import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default marker icons in bundled builds
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const engineerAvailableIcon = new L.DivIcon({
  className: "",
  html: `<div style="width:32px;height:32px;border-radius:50%;background:#10b981;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center"><svg width="16" height="16" fill="white" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

const engineerUnavailableIcon = new L.DivIcon({
  className: "",
  html: `<div style="width:32px;height:32px;border-radius:50%;background:#6b7280;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center"><svg width="16" height="16" fill="white" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

const jobIcons: Record<string, L.DivIcon> = {
  urgent: new L.DivIcon({
    className: "",
    html: `<div style="width:28px;height:28px;border-radius:6px;background:#ef4444;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center"><svg width="14" height="14" fill="white" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3" fill="#ef4444"/></svg></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28],
  }),
  high: new L.DivIcon({
    className: "",
    html: `<div style="width:28px;height:28px;border-radius:6px;background:#f59e0b;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center"><svg width="14" height="14" fill="white" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3" fill="#f59e0b"/></svg></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28],
  }),
  default: new L.DivIcon({
    className: "",
    html: `<div style="width:28px;height:28px;border-radius:6px;background:#3b82f6;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center"><svg width="14" height="14" fill="white" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3" fill="#3b82f6"/></svg></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28],
  }),
};

export interface EngineerMarker {
  id: string;
  type: "engineer";
  lat: number;
  lng: number;
  name: string;
  specialty: string;
  available: boolean;
  rating: number | null;
}

export interface JobMarker {
  id: string;
  type: "job";
  lat: number;
  lng: number;
  title: string;
  status: string;
  priority: string;
  serviceType: string;
}

interface Props {
  engineers: EngineerMarker[];
  jobs: JobMarker[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

function FlyTo({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], 14, { duration: 0.8 });
  }, [lat, lng, map]);
  return null;
}

const DispatchMap = ({ engineers, jobs, selectedId, onSelect }: Props) => {
  const allMarkers = [...engineers, ...jobs];
  const selected = allMarkers.find((m) => m.id === selectedId);

  // Default center: NYC
  const center: [number, number] = [40.7128, -74.006];

  return (
    <MapContainer
      center={center}
      zoom={12}
      className="w-full h-full"
      style={{ minHeight: 400 }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {selected && <FlyTo lat={selected.lat} lng={selected.lng} />}

      {engineers.map((eng) => (
        <Marker
          key={eng.id}
          position={[eng.lat, eng.lng]}
          icon={eng.available ? engineerAvailableIcon : engineerUnavailableIcon}
          eventHandlers={{ click: () => onSelect(eng.id) }}
        >
          <Popup>
            <div className="text-sm">
              <p className="font-semibold">{eng.name}</p>
              <p className="text-muted-foreground">{eng.specialty}</p>
              <p className={eng.available ? "text-green-600" : "text-gray-500"}>
                {eng.available ? "Available" : "Unavailable"}
              </p>
              {eng.rating !== null && <p>★ {eng.rating}</p>}
            </div>
          </Popup>
        </Marker>
      ))}

      {jobs.map((job) => (
        <Marker
          key={job.id}
          position={[job.lat, job.lng]}
          icon={jobIcons[job.priority] ?? jobIcons.default}
          eventHandlers={{ click: () => onSelect(job.id) }}
        >
          <Popup>
            <div className="text-sm">
              <p className="font-semibold">{job.title}</p>
              <p className="text-muted-foreground">{job.serviceType}</p>
              <p className="capitalize">{job.status.replace(/_/g, " ")} · {job.priority}</p>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
};

export default DispatchMap;
