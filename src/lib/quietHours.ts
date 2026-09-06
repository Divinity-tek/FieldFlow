// Quiet-hours preferences for engineer SLA alerts.
// Pure helpers — no React, no I/O.

export interface QuietHoursPrefs {
  enabled: boolean;
  /** Local time "HH:MM" (24h) when quiet hours start. */
  start: string;
  /** Local time "HH:MM" (24h) when quiet hours end. May be earlier than start (overnight). */
  end: string;
  /** When true, critical alerts (overdue + cancellations + formal breaches) still fire during quiet hours. */
  allowCritical: boolean;
}

export const DEFAULT_QUIET_HOURS: QuietHoursPrefs = {
  enabled: false,
  start: "22:00",
  end: "07:00",
  allowCritical: true,
};

export const QUIET_HOURS_PREF_KEY = "engineer.sla.quiet_hours";

function parseHHMM(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

/** True if `now` falls inside the configured quiet window. Handles overnight ranges. */
export function isQuietNow(prefs: QuietHoursPrefs, now: Date = new Date()): boolean {
  if (!prefs.enabled) return false;
  const start = parseHHMM(prefs.start);
  const end = parseHHMM(prefs.end);
  if (start === null || end === null || start === end) return false;

  const minutes = now.getHours() * 60 + now.getMinutes();
  if (start < end) {
    // Same-day window, e.g. 13:00–17:00
    return minutes >= start && minutes < end;
  }
  // Overnight window, e.g. 22:00–07:00
  return minutes >= start || minutes < end;
}

/** Severity classification used by the alerts hook to decide what may bypass quiet hours. */
export type AlertSeverity = "info" | "warning" | "critical";

export function shouldDeliverAlert(
  severity: AlertSeverity,
  prefs: QuietHoursPrefs,
  now: Date = new Date(),
): boolean {
  if (!isQuietNow(prefs, now)) return true;
  return prefs.allowCritical && severity === "critical";
}
