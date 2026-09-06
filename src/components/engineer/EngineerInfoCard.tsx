import { forwardRef } from "react";
import { Star, MapPin, Mail, Phone, Briefcase, Shield, Car } from "lucide-react";

export interface EngineerInfoCardData {
  fullName?: string | null;
  avatarUrl?: string | null;
  specialty?: string | null;
  rating?: number | null;
  jobsCompleted?: number | null;
  location?: string | null;
  email?: string | null;
  phone?: string | null;
  skills?: string[] | null;
  vehiclePlate?: string | null;
  insuranceVerified?: boolean | null;
  qrDataUrl?: string | null;
  /** Public URL the QR encodes — also used to make the QR a clickable link. */
  shareUrl?: string | null;
}

/**
 * Visual "info card" used for the engineer's own preview, the share image,
 * and the PNG/PDF download. Rendered as a fixed-size, branded card so the
 * exported snapshot looks consistent regardless of screen size.
 */
const EngineerInfoCard = forwardRef<HTMLDivElement, { data: EngineerInfoCardData }>(
  ({ data }, ref) => {
    const initials = (data.fullName ?? "?")
      .split(" ")
      .map((n) => n[0])
      .filter(Boolean)
      .join("")
      .toUpperCase()
      .slice(0, 2);

    return (
      <div
        ref={ref}
        className="relative w-[360px] rounded-2xl overflow-hidden bg-card text-card-foreground shadow-xl border border-border"
      >
        {/* Header band */}
        <div className="bg-gradient-to-br from-primary to-primary/70 text-primary-foreground p-5">
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 rounded-full bg-white/15 backdrop-blur flex items-center justify-center overflow-hidden ring-2 ring-white/30">
              {data.avatarUrl ? (
                <img
                  src={data.avatarUrl}
                  alt={data.fullName ?? "avatar"}
                  className="w-full h-full object-cover"
                  crossOrigin="anonymous"
                />
              ) : (
                <span className="text-xl font-bold">{initials}</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-base font-bold truncate">
                {data.fullName ?? "Engineer"}
              </p>
              <p className="text-xs opacity-90 truncate">
                {data.specialty ?? "Field Engineer"}
              </p>
              <div className="flex items-center gap-2 mt-1 text-xs">
                <span className="inline-flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 fill-current" />
                  {Number(data.rating ?? 0).toFixed(1)}
                </span>
                {typeof data.jobsCompleted === "number" && (
                  <span className="inline-flex items-center gap-1 opacity-90">
                    <Briefcase className="w-3.5 h-3.5" />
                    {data.jobsCompleted} jobs
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-3 text-sm">
          {data.location && (
            <Row icon={<MapPin className="w-4 h-4 text-muted-foreground" />}>
              {data.location}
            </Row>
          )}
          {data.email && (
            <Row icon={<Mail className="w-4 h-4 text-muted-foreground" />}>
              <span className="break-all">{data.email}</span>
            </Row>
          )}
          {data.phone && (
            <Row icon={<Phone className="w-4 h-4 text-muted-foreground" />}>
              {data.phone}
            </Row>
          )}
          {data.vehiclePlate && (
            <Row icon={<Car className="w-4 h-4 text-muted-foreground" />}>
              <span className="font-mono">{data.vehiclePlate}</span>
            </Row>
          )}
          {data.insuranceVerified && (
            <Row icon={<Shield className="w-4 h-4 text-emerald-500" />}>
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                Insurance verified
              </span>
            </Row>
          )}

          {data.skills && data.skills.length > 0 && (
            <div className="pt-1">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">
                Skills
              </p>
              <div className="flex flex-wrap gap-1.5">
                {data.skills.slice(0, 10).map((s) => (
                  <span
                    key={s}
                    className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-foreground border border-border"
                  >
                    {s}
                  </span>
                ))}
                {data.skills.length > 10 && (
                  <span className="text-[11px] text-muted-foreground">
                    +{data.skills.length - 10} more
                  </span>
                )}
              </div>
            </div>
          )}

          {data.qrDataUrl && (
            <div className="flex items-center gap-3 pt-2 border-t border-border">
              {data.shareUrl ? (
                <a
                  href={data.shareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Open public profile"
                  className="shrink-0 rounded-md ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <img
                    src={data.qrDataUrl}
                    alt="Scan to open public profile"
                    className="w-16 h-16"
                  />
                </a>
              ) : (
                <img
                  src={data.qrDataUrl}
                  alt="Profile QR"
                  className="w-16 h-16 shrink-0"
                />
              )}
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground">
                  Scan to view this engineer's public profile.
                </p>
                {data.shareUrl && (
                  <p className="text-[10px] text-muted-foreground/80 truncate font-mono mt-0.5">
                    {data.shareUrl.replace(/^https?:\/\//, "")}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  },
);

EngineerInfoCard.displayName = "EngineerInfoCard";

function Row({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span className="text-foreground">{children}</span>
    </div>
  );
}

export default EngineerInfoCard;
