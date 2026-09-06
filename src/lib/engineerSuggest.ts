// Lightweight, client-side engineer recommender used by the dispatch inbox to
// suggest a one-click reassignment for an engineer's reassignment request.
// All inputs are already-fetched arrays — no network calls happen here.

export interface SuggestEngineer {
  id: string;
  name: string | null;
  skills: string[] | null;
  region_id: string | null;
  is_available: boolean | null;
  rating: number | null;
  jobs_completed: number | null;
  latitude: number | null;
  longitude: number | null;
}

export interface SuggestJob {
  id: string;
  required_skills: string[] | null;
  region_id: string | null;
  latitude: number | null;
  longitude: number | null;
  engineer_id: string | null;
  previous_engineer_ids: string[] | null;
}

export interface ScoredCandidate {
  engineer: SuggestEngineer;
  score: number;
  reasons: string[];
  skillMatchCount: number;
  missingSkills: string[];
  distanceKm: number | null;
}

function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(x));
}

// Reason-driven weight overrides. Anything not listed uses the defaults.
const REASON_WEIGHTS: Record<
  string,
  { skill: number; region: number; distance: number; rating: number; requireFullSkills: boolean }
> = {
  skills_mismatch: { skill: 25, region: 5, distance: 0.5, rating: 6, requireFullSkills: true },
  vehicle_issue:   { skill: 8,  region: 12, distance: 2.5, rating: 5, requireFullSkills: false },
  traffic:         { skill: 8,  region: 10, distance: 3.0, rating: 5, requireFullSkills: false },
  site_access:     { skill: 10, region: 8,  distance: 1.0, rating: 10, requireFullSkills: false },
  previous_overrun:{ skill: 10, region: 6,  distance: 1.0, rating: 8, requireFullSkills: false },
  personal_emergency:{ skill: 10, region: 8, distance: 1.5, rating: 6, requireFullSkills: false },
  other:           { skill: 10, region: 6,  distance: 1.0, rating: 6, requireFullSkills: false },
};

const DEFAULT_WEIGHTS = REASON_WEIGHTS.other;

export function suggestEngineers(
  job: SuggestJob,
  engineers: SuggestEngineer[],
  reasonCode: string | null | undefined,
  limit = 3,
): ScoredCandidate[] {
  const w = (reasonCode && REASON_WEIGHTS[reasonCode]) || DEFAULT_WEIGHTS;
  const required = (job.required_skills ?? []).map((s) => s.toLowerCase());
  const blocked = new Set<string>(
    [job.engineer_id, ...(job.previous_engineer_ids ?? [])].filter(
      Boolean,
    ) as string[],
  );

  const scored: ScoredCandidate[] = [];
  for (const eng of engineers) {
    if (!eng.id || blocked.has(eng.id)) continue;
    if (eng.is_available === false) continue;

    const engSkills = (eng.skills ?? []).map((s) => String(s).toLowerCase());
    const matched = required.filter((s) => engSkills.includes(s));
    const missing = required.filter((s) => !engSkills.includes(s));

    if (w.requireFullSkills && missing.length > 0) continue;

    const reasons: string[] = [];
    let score = 0;

    if (required.length > 0) {
      const ratio = matched.length / required.length;
      score += ratio * w.skill * required.length;
      if (matched.length > 0) {
        reasons.push(
          `Matches ${matched.length}/${required.length} required skill${required.length === 1 ? "" : "s"}`,
        );
      }
    }

    if (job.region_id && eng.region_id && job.region_id === eng.region_id) {
      score += w.region;
      reasons.push("Same region");
    }

    let distanceKm: number | null = null;
    if (
      job.latitude != null &&
      job.longitude != null &&
      eng.latitude != null &&
      eng.longitude != null
    ) {
      distanceKm = haversineKm(
        { lat: job.latitude, lng: job.longitude },
        { lat: eng.latitude, lng: eng.longitude },
      );
      // Closer is better — convert to a positive bonus that decays with distance.
      const proximityBonus = Math.max(0, 30 - distanceKm) * w.distance;
      score += proximityBonus;
      if (distanceKm <= 10) reasons.push(`~${distanceKm.toFixed(1)} km away`);
    }

    if (typeof eng.rating === "number") {
      score += eng.rating * w.rating;
      if (eng.rating >= 4.5) reasons.push(`Top-rated (${eng.rating.toFixed(1)}★)`);
    }

    if (typeof eng.jobs_completed === "number") {
      score += Math.min(eng.jobs_completed, 200) * 0.05;
    }

    scored.push({
      engineer: eng,
      score,
      reasons,
      skillMatchCount: matched.length,
      missingSkills: missing,
      distanceKm,
    });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}
