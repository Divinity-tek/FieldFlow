// Shared resolver that maps an arbitrary pathname (including ones with route
// params like /invoices/:id, /jobs/abc-123, /help/some-slug) to the most
// specific HelpDoc registered in HELP_DOCS.
//
// Matching rules (in order of priority):
//   1. Exact match on doc.path === pathname.
//   2. Segment-aware prefix match: pathname must begin with doc.path followed
//      by a "/" so that "/invoicespreview" never matches "/invoices" but
//      "/invoices/abc" does. The longest matching doc.path wins so that
//      "/invoices/preview" beats "/invoices" for "/invoices/preview/123".
//   3. Optional aliases: a doc can declare extra paths via the runtime
//      alias map below (kept here, not in helpDocs.ts, to avoid touching
//      every entry). Aliases follow the same segment-aware rules.
//
// This keeps the contextual drawer and the "Help for this page" button in
// sync and avoids false positives caused by naive startsWith matching.

import { HELP_DOCS, type HelpDoc } from "./helpDocs";
import { getRuntimeAliases } from "./helpAliasStore";

/** Extra path → slug mappings for routes that don't have their own HelpDoc.path. */
const PATH_ALIASES: Record<string, string> = {
  // Invoice deep-links all map to the invoices doc.
  "/invoices/new": "invoices",
  "/invoices/edit": "invoices",
  // Estimate deep-links → estimates doc.
  "/estimates/new": "estimates",
  "/estimates/edit": "estimates",
  // Job detail routes → jobs doc.
  "/jobs/new": "jobs",
  // Engineer profile routes → engineers doc.
  "/engineers/new": "engineers",
  // Client deep-links.
  "/clients": "crm",
  "/clients/new": "crm",
  // Partner deep-links.
  "/partners/new": "partners",
};

/** Returns true when `pathname` lives under `prefix` on a segment boundary. */
function isSegmentPrefix(pathname: string, prefix: string): boolean {
  if (!prefix || prefix === "/") return false;
  if (pathname === prefix) return true;
  return pathname.startsWith(prefix + "/");
}

/** Build the union of (path → slug) entries from HELP_DOCS plus PATH_ALIASES. */
function getPathIndex(): Array<{ path: string; slug: string }> {
  const fromDocs = HELP_DOCS
    .filter((d): d is HelpDoc & { path: string } => Boolean(d.path))
    .map((d) => ({ path: d.path, slug: d.slug }));
  const fromAliases = Object.entries(PATH_ALIASES).map(([path, slug]) => ({ path, slug }));
  // Admin-managed aliases override built-in ones with the same path.
  const runtime = Object.entries(getRuntimeAliases()).map(([path, slug]) => ({ path, slug }));
  const merged = new Map<string, string>();
  for (const e of [...fromDocs, ...fromAliases, ...runtime]) merged.set(e.path, e.slug);
  return Array.from(merged, ([path, slug]) => ({ path, slug }));
}

/**
 * Resolve a pathname (with or without route params) to its best-matching HelpDoc.
 * Returns undefined when nothing reasonable matches.
 */
export function resolveHelpDoc(pathname: string): HelpDoc | undefined {
  if (!pathname) return undefined;
  const cleaned = pathname.split("?")[0].split("#")[0].replace(/\/+$/, "") || "/";

  const index = getPathIndex();

  // 1) Exact match.
  const exact = index.find((e) => e.path === cleaned);
  if (exact) return HELP_DOCS.find((d) => d.slug === exact.slug);

  // 2) Longest segment-aware prefix match.
  const matches = index
    .filter((e) => isSegmentPrefix(cleaned, e.path))
    .sort((a, b) => b.path.length - a.path.length);
  if (matches.length) {
    return HELP_DOCS.find((d) => d.slug === matches[0].slug);
  }

  // 3) Fall back to the first segment as a hint (e.g. "/foo/bar/baz" → "/foo").
  const firstSeg = "/" + cleaned.split("/").filter(Boolean)[0];
  if (firstSeg && firstSeg !== "/") {
    const seg = index
      .filter((e) => e.path === firstSeg)
      .sort((a, b) => b.path.length - a.path.length)[0];
    if (seg) return HELP_DOCS.find((d) => d.slug === seg.slug);
  }

  return undefined;
}
