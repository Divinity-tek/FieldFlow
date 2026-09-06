import { z } from "zod";
import { HELP_DOCS } from "./helpDocs";

/**
 * A valid alias path is a React-Router-style route:
 *   - Starts with "/"
 *   - Lowercase segments separated by "/"
 *   - Each segment is either:
 *       * a literal: [a-z0-9] with optional internal "-" or "_" (e.g. "invoices", "engineer-jobs")
 *       * a param:   ":" + camel/identifier (e.g. ":id", ":idOrNumber")
 *       * a wildcard: "*" (only allowed as the final segment)
 *   - No trailing slash (except root "/")
 *   - No "//", no whitespace, no query/hash
 */

const SEGMENT_RE = /^(?:[a-z0-9]+(?:[-_][a-z0-9]+)*|:[a-zA-Z][a-zA-Z0-9]*|\*)$/;

export type PathValidationResult =
  | { ok: true; cleaned: string }
  | { ok: false; reason: string };

export function validateAliasPath(input: string): PathValidationResult {
  const raw = (input ?? "").trim();
  if (!raw) return { ok: false, reason: "Path is required" };
  if (raw === "/") return { ok: true, cleaned: "/" };
  if (!raw.startsWith("/")) return { ok: false, reason: "Path must start with /" };
  if (/\s/.test(raw)) return { ok: false, reason: "Path cannot contain whitespace" };
  if (raw.includes("?") || raw.includes("#"))
    return { ok: false, reason: "Path cannot include query strings or fragments" };
  if (raw.includes("//"))
    return { ok: false, reason: "Path cannot contain consecutive slashes" };
  if (raw.length > 200) return { ok: false, reason: "Path is too long (max 200 chars)" };

  // Strip trailing slash for comparison.
  const cleaned = raw.replace(/\/+$/, "") || "/";
  const segments = cleaned.slice(1).split("/");

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (!seg) return { ok: false, reason: "Path cannot have empty segments" };
    if (seg === "*" && i !== segments.length - 1)
      return { ok: false, reason: "Wildcard '*' is only allowed as the final segment" };
    if (!SEGMENT_RE.test(seg)) {
      if (seg.startsWith(":")) {
        return {
          ok: false,
          reason: `Param "${seg}" must match :name (letters/digits, starting with a letter)`,
        };
      }
      return {
        ok: false,
        reason: `Segment "${seg}" is invalid — use lowercase letters, digits, "-" or "_"`,
      };
    }
    // Disallow duplicate param names (React Router would reject these).
  }
  const params = segments.filter((s) => s.startsWith(":"));
  const dupe = params.find((p, i) => params.indexOf(p) !== i);
  if (dupe) return { ok: false, reason: `Duplicate route param "${dupe}"` };

  return { ok: true, cleaned };
}

export function validateAliasSlug(slug: string): PathValidationResult {
  const s = (slug ?? "").trim();
  if (!s) return { ok: false, reason: "Help doc is required" };
  const known = HELP_DOCS.some((d) => d.slug === s);
  if (!known) return { ok: false, reason: `Unknown help doc slug "${s}"` };
  return { ok: true, cleaned: s };
}

/** Zod schema for use in forms / mutations. */
export const aliasInputSchema = z
  .object({
    path: z.string(),
    slug: z.string(),
    note: z.string().max(500, "Note must be 500 characters or fewer").optional().nullable(),
  })
  .superRefine((val, ctx) => {
    const p = validateAliasPath(val.path);
    if (p.ok === false) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["path"], message: p.reason });
    }
    const s = validateAliasSlug(val.slug);
    if (s.ok === false) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["slug"], message: s.reason });
    }
  })
  .transform((val) => {
    const p = validateAliasPath(val.path);
    return {
      path: p.ok ? p.cleaned : val.path.trim(),
      slug: val.slug.trim(),
      note: val.note?.trim() || null,
    };
  });

export type AliasInput = z.infer<typeof aliasInputSchema>;
