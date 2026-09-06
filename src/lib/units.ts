/**
 * Shared unit-of-measure normalization utilities.
 *
 * Use `normalizeUnit` everywhere a user-entered unit is read or written
 * (form blur handlers, API saves, CSV imports, line-item conversions).
 *
 * Use `unitKey` only for equality/de-duplication comparisons. It is more
 * aggressive (strips trailing "s") and is NOT meant for storage or display.
 */

const ZERO_WIDTH = /[\u200B-\u200D\uFEFF]/g;

/**
 * Display/storage normalization:
 *  - Unicode NFKC
 *  - Strip zero-width characters
 *  - Collapse internal whitespace
 *  - Trim and lowercase
 *  - Hard cap at 50 chars (matches DB column width)
 */
export function normalizeUnit(raw?: string | null): string {
  return (raw ?? "")
    .normalize("NFKC")
    .replace(ZERO_WIDTH, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .slice(0, 50);
}

/**
 * Canonical key for matching/de-duplication only.
 * Builds on `normalizeUnit` and removes a single trailing plural "s"
 * so "hour" and "hours" merge.
 */
export function unitKey(raw?: string | null): string {
  return normalizeUnit(raw).replace(/s$/, "");
}

/** True when the value is non-empty after normalization. */
export function isUnitProvided(raw?: string | null): boolean {
  return normalizeUnit(raw).length > 0;
}

/**
 * Built-in dictionary of common units of measure. Already normalized
 * (lowercase, trimmed) so they round-trip through `normalizeUnit`.
 */
export const UNIT_DICTIONARY: readonly string[] = [
  "hour",
  "hours",
  "day",
  "days",
  "week",
  "month",
  "year",
  "minute",
  "each",
  "unit",
  "item",
  "piece",
  "pcs",
  "set",
  "pack",
  "box",
  "license",
  "seat",
  "user",
  "session",
  "visit",
  "trip",
  "mile",
  "km",
  "meter",
  "m",
  "ft",
  "sq ft",
  "sq m",
  "kg",
  "lb",
  "liter",
  "gallon",
  "service",
  "project",
  "job",
  "ticket",
  "incident",
  "call",
  "device",
  "node",
  "port",
  "circuit",
  "site",
  "gb",
  "tb",
  "mbps",
];

const RECENT_UNITS_KEY = "ff:recentUnits";
const RECENT_UNITS_MAX = 10;

/** Read recently-used units from localStorage (most-recent first). */
export function getRecentUnits(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_UNITS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((v): v is string => typeof v === "string" && v.length > 0).slice(0, RECENT_UNITS_MAX);
  } catch {
    return [];
  }
}

/** Record a unit as recently used. No-op if empty. */
export function rememberUnit(raw?: string | null): void {
  if (typeof window === "undefined") return;
  const u = normalizeUnit(raw);
  if (!u) return;
  try {
    const current = getRecentUnits().filter((v) => v !== u);
    const next = [u, ...current].slice(0, RECENT_UNITS_MAX);
    window.localStorage.setItem(RECENT_UNITS_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota / disabled storage */
  }
}

/**
 * Build a deduplicated suggestion list for a unit input.
 * Order: matching recents first, then matching dictionary entries.
 */
export function suggestUnits(query?: string | null, limit = 8): string[] {
  const q = normalizeUnit(query);
  const recents = getRecentUnits();
  const pool: string[] = [];
  const seen = new Set<string>();
  const push = (v: string) => {
    const n = normalizeUnit(v);
    if (!n || seen.has(n)) return;
    seen.add(n);
    pool.push(n);
  };
  for (const r of recents) push(r);
  for (const d of UNIT_DICTIONARY) push(d);
  const filtered = q ? pool.filter((u) => u.includes(q) && u !== q) : pool;
  return filtered.slice(0, limit);
}
