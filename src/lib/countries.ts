// Country & US-state normalization helpers.
// Keeps stored values consistent regardless of how admins type them.

const COUNTRY_ALIASES: Record<string, string> = {
  // United States
  us: "United States",
  usa: "United States",
  "u.s.": "United States",
  "u.s.a.": "United States",
  "united states": "United States",
  "united states of america": "United States",
  america: "United States",

  // United Kingdom
  uk: "United Kingdom",
  "u.k.": "United Kingdom",
  gb: "United Kingdom",
  "great britain": "United Kingdom",
  britain: "United Kingdom",
  england: "United Kingdom",
  scotland: "United Kingdom",
  wales: "United Kingdom",
  "northern ireland": "United Kingdom",
  "united kingdom": "United Kingdom",
  "united kingdom of great britain and northern ireland": "United Kingdom",

  // Common others
  uae: "United Arab Emirates",
  "united arab emirates": "United Arab Emirates",
  india: "India",
  in: "India",
  canada: "Canada",
  ca: "Canada",
  australia: "Australia",
  au: "Australia",
  ireland: "Ireland",
  ie: "Ireland",
};

/** Canonical country name, or original (trimmed/title-cased fallback) if unknown. */
export function normalizeCountry(raw?: string | null): string {
  if (!raw) return "";
  const key = raw.trim().toLowerCase();
  if (!key) return "";
  if (COUNTRY_ALIASES[key]) return COUNTRY_ALIASES[key];

  // Title-case fallback for unknown entries
  return raw
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export function isUS(raw?: string | null): boolean {
  return normalizeCountry(raw) === "United States";
}

const US_STATES: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA",
  hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA",
  kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
  massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS", missouri: "MO",
  montana: "MT", nebraska: "NE", nevada: "NV", "new hampshire": "NH", "new jersey": "NJ",
  "new mexico": "NM", "new york": "NY", "north carolina": "NC", "north dakota": "ND",
  ohio: "OH", oklahoma: "OK", oregon: "OR", pennsylvania: "PA", "rhode island": "RI",
  "south carolina": "SC", "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT",
  vermont: "VT", virginia: "VA", washington: "WA", "west virginia": "WV",
  wisconsin: "WI", wyoming: "WY", "district of columbia": "DC",
};

const US_STATE_CODES = new Set(Object.values(US_STATES));

/** Normalize US state to its 2-letter postal code, or original if not recognized. */
export function normalizeUSState(raw?: string | null): string {
  if (!raw) return "";
  const v = raw.trim();
  if (!v) return "";
  const upper = v.toUpperCase();
  if (upper.length === 2 && US_STATE_CODES.has(upper)) return upper;
  const code = US_STATES[v.toLowerCase()];
  if (code) return code;
  return v;
}

export function isValidUSState(raw?: string | null): boolean {
  if (!raw) return false;
  const code = normalizeUSState(raw);
  return code.length === 2 && US_STATE_CODES.has(code);
}
