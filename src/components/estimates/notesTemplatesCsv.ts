// CSV helpers + import normalization for Notes/Terms templates.
// Extracted so they can be unit-tested without React/Supabase.

export type Visibility = "all" | "admin_only" | "team_lead_allowed";

export type NotesTemplateLike = {
  label: string;
  content: string;
  sort_order: number;
  is_active: boolean;
  visibility: Visibility;
};

export const CSV_HEADERS = ["label", "content", "sort_order", "is_active", "visibility"] as const;

const csvEscape = (v: string | number | boolean) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const toCsv = (rows: NotesTemplateLike[]): string => {
  const lines = [CSV_HEADERS.join(",")];
  for (const r of rows) {
    lines.push([r.label, r.content, r.sort_order, r.is_active, r.visibility].map(csvEscape).join(","));
  }
  return lines.join("\n");
};

export const parseCsv = (text: string): Record<string, string>[] => {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') { inQ = false; }
      else { field += c; }
    } else {
      if (c === '"') inQ = true;
      else if (c === ",") { cur.push(field); field = ""; }
      else if (c === "\n" || c === "\r") {
        if (field !== "" || cur.length) { cur.push(field); rows.push(cur); cur = []; field = ""; }
        if (c === "\r" && text[i + 1] === "\n") i++;
      } else field += c;
    }
  }
  if (field !== "" || cur.length) { cur.push(field); rows.push(cur); }
  if (!rows.length) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).filter((r) => r.some((v) => v.trim() !== "")).map((r) => {
    const o: Record<string, string> = {};
    headers.forEach((h, i) => { o[h] = (r[i] ?? "").trim(); });
    return o;
  });
};

export type NormalizedRow =
  | { ok: true; payload: NotesTemplateLike }
  | { ok: false; reason: "missing_required" | "forbidden_visibility" };

/**
 * Normalize a parsed CSV row into a template payload.
 * - Coerces sort_order/is_active.
 * - Defaults invalid visibility values to "all" (lenient — matches importer behavior).
 * - Skips rows missing label/content.
 * - Skips admin_only rows when isAdmin=false.
 */
export const normalizeRow = (
  r: Record<string, string>,
  opts: { isAdmin: boolean }
): NormalizedRow => {
  const lbl = r.label?.trim();
  const cnt = r.content?.trim();
  if (!lbl || !cnt) return { ok: false, reason: "missing_required" };
  const visRaw = r.visibility;
  const vis: Visibility = (["all", "admin_only", "team_lead_allowed"].includes(visRaw)
    ? visRaw
    : "all") as Visibility;
  if (vis === "admin_only" && !opts.isAdmin) return { ok: false, reason: "forbidden_visibility" };
  return {
    ok: true,
    payload: {
      label: lbl,
      content: cnt,
      sort_order: parseInt(r.sort_order) || 0,
      is_active: r.is_active === "" || r.is_active === undefined
        ? true
        : /^(true|1|yes)$/i.test(r.is_active),
      visibility: vis,
    },
  };
};

/**
 * Plan an upsert by matching CSV rows against existing templates by label (case-insensitive).
 * Returns the actions a caller would perform; pure & easy to test.
 */
export type SkipReason = "missing_required" | "forbidden_visibility";
export type UpsertPlan = {
  inserts: NotesTemplateLike[];
  updates: { id: string; payload: NotesTemplateLike }[];
  skipped: { row: Record<string, string>; reason: SkipReason }[];
};

export const planUpsert = (
  rows: Record<string, string>[],
  existing: { id: string; label: string }[],
  opts: { isAdmin: boolean }
): UpsertPlan => {
  const byLabel = new Map(existing.map((t) => [t.label.toLowerCase(), t]));
  const plan: UpsertPlan = { inserts: [], updates: [], skipped: [] };
  for (const r of rows) {
    const n = normalizeRow(r, opts);
    if (n.ok) {
      const match = byLabel.get(n.payload.label.toLowerCase());
      if (match) plan.updates.push({ id: match.id, payload: n.payload });
      else plan.inserts.push(n.payload);
    } else {
      plan.skipped.push({ row: r, reason: (n as { ok: false; reason: SkipReason }).reason });
    }
  }
  return plan;
};
