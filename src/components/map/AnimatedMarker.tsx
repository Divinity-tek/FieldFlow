import { useEffect, useRef, useMemo } from "react";
import { Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";

interface AnimatedMarkerProps {
  position: [number, number];
  icon: L.Icon | L.DivIcon;
  children?: React.ReactNode;
  eventHandlers?: Record<string, (...args: any[]) => void>;
  /** Animation duration in ms (default 1000) */
  duration?: number;
  /** Show bearing rotation arrow */
  bearing?: number | null;
}

/**
 * A Leaflet marker that smoothly animates (glides) to new positions
 * like Uber's car markers — no map refresh needed.
 */
export default function AnimatedMarker({
  position,
  icon,
  children,
  eventHandlers,
  duration = 1000,
  bearing,
}: AnimatedMarkerProps) {
  const markerRef = useRef<L.Marker | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const prevPosRef = useRef<[number, number]>(position);

  // Compute the icon with rotation applied
  const rotatedIcon = useMemo(() => {
    if (bearing == null || !(icon instanceof L.DivIcon)) return icon;
    const opts = icon.options;
    const html = opts.html as string;
    // Wrap with rotation transform
    const rotatedHtml = `<div style="transform:rotate(${bearing}deg);transition:transform 1s ease">${html}</div>`;
    return new L.DivIcon({
      ...opts,
      html: rotatedHtml,
    });
  }, [icon, bearing]);

  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;

    const from = prevPosRef.current;
    const to = position;

    // Skip animation if first render or same position
    if (from[0] === to[0] && from[1] === to[1]) return;

    const startLat = from[0];
    const startLng = from[1];
    const deltaLat = to[0] - from[0];
    const deltaLng = to[1] - from[1];
    const startTime = performance.now();

    function animate(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out cubic for natural deceleration
      const eased = 1 - Math.pow(1 - progress, 3);

      const lat = startLat + deltaLat * eased;
      const lng = startLng + deltaLng * eased;
      marker!.setLatLng([lat, lng]);

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        prevPosRef.current = to;
      }
    }

    // Cancel any ongoing animation
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      prevPosRef.current = to;
    };
  }, [position[0], position[1], duration]);

  return (
    <Marker
      ref={markerRef}
      position={prevPosRef.current}
      icon={rotatedIcon}
      eventHandlers={eventHandlers}
    >
      {children}
    </Marker>
  );
}

/**
 * Calculate bearing (heading) in degrees between two lat/lng points.
 */
export function calcBearing(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}
