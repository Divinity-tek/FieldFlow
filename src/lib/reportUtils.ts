// Helpers for the advanced Reports Builder: column toggles, sort, search,
// chart configuration, and multi-format export (CSV, JSON, XLSX).

import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

export type SortDir = "asc" | "desc";
export type ChartType = "none" | "bar" | "line" | "pie";

export function inferColumns<T extends Record<string, unknown>>(rows: T[]): string[] {
  if (!rows.length) return [];
  const keys = new Set<string>();
  for (const r of rows) Object.keys(r).forEach((k) => keys.add(k));
  return Array.from(keys);
}

export function applySearch<T extends Record<string, unknown>>(
  rows: T[],
  query: string,
  columns: string[],
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((r) =>
    columns.some((c) => String(r[c] ?? "").toLowerCase().includes(q)),
  );
}

export function applySort<T extends Record<string, unknown>>(
  rows: T[],
  column: string | null,
  dir: SortDir,
): T[] {
  if (!column) return rows;
  const sorted = [...rows].sort((a, b) => {
    const av = a[column];
    const bv = b[column];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === "number" && typeof bv === "number") return av - bv;
    return String(av).localeCompare(String(bv), undefined, { numeric: true });
  });
  return dir === "desc" ? sorted.reverse() : sorted;
}

export function pickColumns<T extends Record<string, unknown>>(
  rows: T[],
  visible: string[],
): Record<string, unknown>[] {
  if (!visible.length) return rows as Record<string, unknown>[];
  return rows.map((r) => {
    const out: Record<string, unknown> = {};
    for (const c of visible) out[c] = r[c];
    return out;
  });
}

export function exportCSV(rows: Record<string, unknown>[], fileName: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ].join("\n");
  saveAs(new Blob([csv], { type: "text/csv;charset=utf-8" }), `${fileName}.csv`);
}

export function exportJSON(rows: Record<string, unknown>[], fileName: string) {
  saveAs(
    new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" }),
    `${fileName}.json`,
  );
}

export function exportXLSX(rows: Record<string, unknown>[], fileName: string) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Report");
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  saveAs(
    new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `${fileName}.xlsx`,
  );
}

/** Pick reasonable default x/y for a chart given the row keys. */
export function suggestChartAxes(rows: Record<string, unknown>[]): { x?: string; y?: string } {
  if (!rows.length) return {};
  const keys = Object.keys(rows[0]);
  const numericKey = keys.find((k) => typeof rows[0][k] === "number");
  const labelKey = keys.find((k) => typeof rows[0][k] !== "number") ?? keys[0];
  return { x: labelKey, y: numericKey };
}
