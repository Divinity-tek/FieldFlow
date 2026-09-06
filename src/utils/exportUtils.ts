/**
 * CSV & PDF export utilities for analytics data
 */

// ── CSV Export ──

export function toCsv(headers: string[], rows: (string | number)[][]): string {
  const escape = (v: string | number) => {
    const s = String(v ?? "");
    return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.map(escape).join(","), ...rows.map((r) => r.map(escape).join(","))].join("\n");
}

export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const blob = new Blob([toCsv(headers, rows)], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, filename);
}

// ── PDF Export (uses browser print) ──

const esc = (v: unknown): string =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

export function downloadPdf(title: string, tables: { heading: string; headers: string[]; rows: (string | number)[][] }[]) {
  const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>${esc(title)}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 32px; color: #1a1a1a; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  .subtitle { color: #666; font-size: 12px; margin-bottom: 24px; }
  h2 { font-size: 14px; margin: 20px 0 8px; border-bottom: 1px solid #e5e5e5; padding-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 20px; }
  th { text-align: left; padding: 6px 10px; background: #f5f5f5; border: 1px solid #ddd; font-weight: 600; text-transform: uppercase; font-size: 10px; color: #555; }
  td { padding: 5px 10px; border: 1px solid #eee; }
  tr:nth-child(even) { background: #fafafa; }
  .right { text-align: right; }
  @media print { body { padding: 16px; } }
</style>
</head>
<body>
  <h1>${esc(title)}</h1>
  <p class="subtitle">Generated on ${esc(new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }))}</p>
  ${tables
    .map(
      (t) => `
    <h2>${esc(t.heading)}</h2>
    <table>
      <thead><tr>${t.headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>
      <tbody>${t.rows.map((r) => `<tr>${r.map((c) => `<td${typeof c === "number" || (typeof c === "string" && /^\$?[\d,.]+%?$/.test(c)) ? ' class="right"' : ""}>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody>
    </table>`
    )
    .join("")}
</body>
</html>`;

  const printWindow = window.open("", "_blank");
  if (!printWindow) return;
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.onload = () => {
    printWindow.print();
  };
}

// ── Helpers ──

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
