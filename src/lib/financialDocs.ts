// Shared finance helpers: tax calculations + professional HTML/PDF builder
// for estimates, invoices, and receipts.

import { toCanvas } from "html-to-image";
import { jsPDF } from "jspdf";

export type TaxMode = "single" | "dual_split" | "compound" | "per_line";

export interface FinLineItem {
  description: string;
  quantity: number;
  unit_price: number;
  total?: number;
  tax1_rate?: number;
  tax2_rate?: number;
  unit?: string | null;
}

export interface TaxInput {
  subtotal: number;
  discount_percent?: number;
  tax_mode?: TaxMode;
  tax_rate?: number;
  tax2_rate?: number;
  lineItems?: FinLineItem[];
}

export interface TaxResult {
  subtotal: number;
  discount_amount: number;
  taxableBase: number;
  tax_amount: number;
  tax2_amount: number;
  total: number;
}

export function computeTotals(input: TaxInput): TaxResult {
  const subtotal = Number(input.subtotal) || 0;
  const discPct = Number(input.discount_percent) || 0;
  const discount_amount = +(subtotal * (discPct / 100)).toFixed(2);
  const taxableBase = +(subtotal - discount_amount).toFixed(2);
  const t1 = Number(input.tax_rate) || 0;
  const t2 = Number(input.tax2_rate) || 0;
  const mode: TaxMode = input.tax_mode || "single";

  let tax_amount = 0;
  let tax2_amount = 0;

  if (mode === "single") {
    tax_amount = +(taxableBase * (t1 / 100)).toFixed(2);
  } else if (mode === "dual_split") {
    tax_amount = +(taxableBase * (t1 / 100)).toFixed(2);
    tax2_amount = +(taxableBase * (t2 / 100)).toFixed(2);
  } else if (mode === "compound") {
    tax_amount = +(taxableBase * (t1 / 100)).toFixed(2);
    tax2_amount = +((taxableBase + tax_amount) * (t2 / 100)).toFixed(2);
  } else if (mode === "per_line") {
    let sum1 = 0, sum2 = 0;
    for (const li of input.lineItems || []) {
      const lineTotal = Number(li.total ?? li.quantity * li.unit_price) || 0;
      // Apply discount proportionally
      const lineNet = subtotal > 0 ? lineTotal * (1 - discPct / 100) : 0;
      sum1 += lineNet * ((Number(li.tax1_rate) || 0) / 100);
      sum2 += lineNet * ((Number(li.tax2_rate) || 0) / 100);
    }
    tax_amount = +sum1.toFixed(2);
    tax2_amount = +sum2.toFixed(2);
  }

  const total = +(taxableBase + tax_amount + tax2_amount).toFixed(2);
  return { subtotal, discount_amount, taxableBase, tax_amount, tax2_amount, total };
}

export function fmtMoney(amount: number, currency = "USD"): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
    }).format(Number(amount) || 0);
  } catch {
    return `${currency} ${(Number(amount) || 0).toFixed(2)}`;
  }
}

const esc = (s: any) =>
  String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");

export type DocKind = "estimate" | "invoice" | "receipt";

export interface PartyInfo {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
}

export interface DocBuildInput {
  kind: DocKind;
  number?: string | null;
  status?: string | null;
  title?: string | null;
  currency?: string;
  issued_at?: string | Date | null;
  due_date?: string | Date | null;
  paid_at?: string | Date | null;
  // Money
  subtotal: number;
  discount_percent?: number;
  discount_amount?: number;
  tax_mode?: TaxMode;
  tax1_label?: string;
  tax_rate?: number;
  tax_amount?: number;
  tax2_label?: string;
  tax2_rate?: number;
  tax2_amount?: number;
  total: number;
  amount_paid?: number;
  balance_due?: number;
  // Lines
  lineItems?: FinLineItem[];
  // Other
  notes?: string | null;
  payment_method?: string | null;
  payment_reference?: string | null;
  signature_data?: string | null;
  signed_at?: string | Date | null;
  signed_by?: string | null;
  // Dispatch (estimate/invoice)
  dispatch?: {
    nbd_tm?: number | null;
    sbd_tm?: number | null;
    hourly?: number | null;
    half_day?: number | null;
    full_day?: number | null;
    sbd_hourly?: number | null;
    sbd_half_day?: number | null;
    sbd_full_day?: number | null;
    remarks?: string | null;
  };
  // Branding
  branding?: {
    logoUrl?: string | null;
    primaryColor?: string | null;
    accentColor?: string | null;
    companyName?: string | null;
    footerText?: string | null;
  };
  // Parties
  from?: PartyInfo;
  to?: PartyInfo;
  // Linked source (e.g. invoice from estimate)
  linkedRef?: { kind: DocKind; number: string } | null;
  // Payment terms shown above the notes block
  payment_terms?: string | null;
  // Optional QR payload — when provided, a QR code is rendered next to the totals
  qr_payload?: string | null;
}

const KIND_LABEL: Record<DocKind, string> = {
  estimate: "ESTIMATE",
  invoice: "INVOICE",
  receipt: "RECEIPT",
};

export async function buildDocHtml(d: DocBuildInput): Promise<string> {
  const cur = d.currency || "USD";
  const fmt = (v: any) => fmtMoney(Number(v) || 0, cur);
  const primary = d.branding?.primaryColor || "#0f172a";
  const accent = d.branding?.accentColor || "#2563eb";
  const company = d.branding?.companyName || d.from?.name || "";
  const footer = d.branding?.footerText || "";
  const logo = d.branding?.logoUrl || "";
  const docLabel = KIND_LABEL[d.kind];

  const issued = d.issued_at ? new Date(d.issued_at).toLocaleDateString() : "";
  const due = d.due_date ? new Date(d.due_date).toLocaleDateString() : "";
  const paid = d.paid_at ? new Date(d.paid_at).toLocaleDateString() : "";

  let qrDataUrl = "";
  let qrError = "";
  if (d.qr_payload) {
    try {
      const QR: any = await import("qrcode");
      const toDataURL = (QR.default ?? QR)?.toDataURL;
      if (typeof toDataURL !== "function") throw new Error("QR library unavailable");
      qrDataUrl = await toDataURL(d.qr_payload, { margin: 1, width: 160 });
    } catch (e: any) {
      qrError = e?.message || "QR generation failed";
      console.warn("[financialDocs] QR generation failed:", e);
    }
  }

  const lineRows = (d.lineItems || [])
    .filter((li) => (li.description || "").trim())
    .map((li, i) => {
      const qty = Number(li.quantity) || 0;
      const up = Number(li.unit_price) || 0;
      const tot = Number(li.total ?? qty * up) || 0;
      const taxBits: string[] = [];
      if ((d.tax_mode || "single") === "per_line") {
        if (li.tax1_rate) taxBits.push(`${d.tax1_label || "Tax"} ${li.tax1_rate}%`);
        if (li.tax2_rate) taxBits.push(`${d.tax2_label || "Tax 2"} ${li.tax2_rate}%`);
      }
      return `<tr>
        <td class="num">${i + 1}</td>
        <td class="desc">${esc(li.description)}${taxBits.length ? `<div class="tax-tags">${taxBits.map(esc).join(" • ")}</div>` : ""}</td>
        <td class="right">${qty}${li.unit ? ` <span style="color:#666;font-size:0.85em">${esc(String(li.unit))}</span>` : ""}</td>
        <td class="right">${fmt(up)}</td>
        <td class="right">${fmt(tot)}</td>
      </tr>`;
    }).join("");

  const totalsRows: string[] = [];
  totalsRows.push(`<tr><td>Subtotal</td><td class="right">${fmt(d.subtotal)}</td></tr>`);
  if ((Number(d.discount_amount) || 0) > 0) {
    totalsRows.push(`<tr><td>Discount${d.discount_percent ? ` (${d.discount_percent}%)` : ""}</td><td class="right">-${fmt(d.discount_amount)}</td></tr>`);
  }
  if ((Number(d.tax_amount) || 0) > 0) {
    totalsRows.push(`<tr><td>${esc(d.tax1_label || "Tax")}${d.tax_rate ? ` (${d.tax_rate}%)` : ""}</td><td class="right">${fmt(d.tax_amount)}</td></tr>`);
  }
  if ((Number(d.tax2_amount) || 0) > 0) {
    const compoundNote = d.tax_mode === "compound" ? " · compound" : "";
    totalsRows.push(`<tr><td>${esc(d.tax2_label || "Tax 2")}${d.tax2_rate ? ` (${d.tax2_rate}%)` : ""}${compoundNote}</td><td class="right">${fmt(d.tax2_amount)}</td></tr>`);
  }
  totalsRows.push(`<tr class="grand"><td>Total</td><td class="right">${fmt(d.total)}</td></tr>`);
  if (d.kind === "invoice" || d.kind === "receipt") {
    if ((Number(d.amount_paid) || 0) > 0) {
      totalsRows.push(`<tr><td>Amount Paid</td><td class="right">-${fmt(d.amount_paid)}</td></tr>`);
    }
    if (d.kind === "invoice" && (Number(d.balance_due) || 0) > 0) {
      totalsRows.push(`<tr class="balance"><td>Balance Due</td><td class="right">${fmt(d.balance_due)}</td></tr>`);
    }
  }

  const filterRows = (rows: Array<[string, any]>) =>
    rows.filter(([, v]) => v != null && v !== "" && Number(v) > 0);
  const nbdRows = d.dispatch ? filterRows([
    ["T&M (call-out)", d.dispatch.nbd_tm],
    ["Hourly", d.dispatch.hourly],
    ["Half Day", d.dispatch.half_day],
    ["Full Day", d.dispatch.full_day],
  ]) : [];
  const sbdRows = d.dispatch ? filterRows([
    ["T&M (call-out)", d.dispatch.sbd_tm],
    ["Hourly", d.dispatch.sbd_hourly],
    ["Half Day", d.dispatch.sbd_half_day],
    ["Full Day", d.dispatch.sbd_full_day],
  ]) : [];

  const renderDispatchTable = (title: string, rows: Array<[string, any]>) => rows.length
    ? `<div class="dispatch-sub">
        <div class="dispatch-sub-title">${esc(title)}</div>
        <table class="mini"><thead><tr><th>Service</th><th class="right">Rate</th></tr></thead>
          <tbody>${rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td class="right">${fmt(v)}</td></tr>`).join("")}</tbody>
        </table>
      </div>` : "";

  const dispatchBlock = (nbdRows.length || sbdRows.length || d.dispatch?.remarks)
    ? `<div class="block">
        <div class="block-title">Dispatch Pricing</div>
        ${renderDispatchTable("NBD (Next Business Day)", nbdRows)}
        ${renderDispatchTable("SBD (Same Business Day)", sbdRows)}
        ${d.dispatch?.remarks ? `<div class="muted pre">${esc(d.dispatch.remarks)}</div>` : ""}
      </div>` : "";

  const partyBlock = (label: string, p?: PartyInfo) => p ? `
    <div class="party">
      <div class="party-label">${esc(label)}</div>
      ${p.name ? `<div class="party-name">${esc(p.name)}</div>` : ""}
      ${p.address ? `<div class="muted pre">${esc(p.address)}</div>` : ""}
      ${p.email ? `<div class="muted">${esc(p.email)}</div>` : ""}
      ${p.phone ? `<div class="muted">${esc(p.phone)}</div>` : ""}
    </div>` : "";

  const statusBadge = d.status ? `<span class="badge">${esc(String(d.status).toUpperCase())}</span>` : "";
  const linkRef = d.linkedRef ? `<div class="muted small">From ${esc(d.linkedRef.kind)} ${esc(d.linkedRef.number)}</div>` : "";

  const paymentBlock = d.kind === "receipt" ? `
    <div class="block payment">
      <div class="block-title">Payment Details</div>
      <table class="mini">
        ${paid ? `<tr><td>Paid On</td><td class="right">${esc(paid)}</td></tr>` : ""}
        ${d.payment_method ? `<tr><td>Method</td><td class="right">${esc(d.payment_method)}</td></tr>` : ""}
        ${d.payment_reference ? `<tr><td>Reference</td><td class="right">${esc(d.payment_reference)}</td></tr>` : ""}
        <tr class="grand"><td>Amount</td><td class="right">${fmt(d.amount_paid ?? d.total)}</td></tr>
      </table>
    </div>` : "";

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<title>${docLabel} ${esc(d.number || "")}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; margin: 0; color: #0f172a; background: #f8fafc; }
  .page { max-width: 820px; margin: 24px auto; padding: 40px 44px; background: #ffffff; box-shadow: 0 1px 3px rgba(0,0,0,.06); }
  .header { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; padding-bottom: 18px; border-bottom: 3px solid ${primary}; }
  .brand { display: flex; align-items: center; gap: 14px; }
  .brand img { max-height: 56px; max-width: 200px; object-fit: contain; }
  .company { font-size: 18px; font-weight: 700; color: ${primary}; line-height: 1.2; }
  .doc-meta { text-align: right; }
  .doc-label { font-size: 26px; font-weight: 800; letter-spacing: 1px; color: ${primary}; margin: 0; }
  .doc-num { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: #475569; font-size: 13px; margin-top: 2px; }
  .badge { display: inline-block; margin-top: 8px; padding: 3px 10px; border-radius: 999px; background: ${accent}1A; color: ${accent}; font-size: 11px; font-weight: 700; letter-spacing: .5px; }
  .meta-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px 18px; margin: 14px 0 4px; font-size: 12px; }
  .meta-grid .label { color: #64748b; text-transform: uppercase; font-size: 10px; letter-spacing: .5px; }
  .meta-grid .value { color: #0f172a; font-weight: 600; }
  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin: 22px 0 8px; }
  .party-label { color: #64748b; text-transform: uppercase; font-size: 10px; letter-spacing: .5px; margin-bottom: 4px; }
  .party-name { font-weight: 700; color: #0f172a; font-size: 14px; }
  .muted { color: #64748b; font-size: 12px; }
  .small { font-size: 11px; }
  .pre { white-space: pre-wrap; }
  .title { margin: 18px 0 6px; font-size: 16px; font-weight: 700; color: ${primary}; }
  .lines-wrap { width: 100%; overflow: hidden; }
  table.lines { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; table-layout: fixed; }
  table.lines col.c-num { width: 28px; }
  table.lines col.c-desc { width: auto; }
  table.lines col.c-qty { width: 60px; }
  table.lines col.c-rate { width: 95px; }
  table.lines col.c-amt { width: 110px; }
  table.lines thead th { text-align: left; padding: 10px 12px; background: ${primary}; color: #ffffff; font-size: 11px; text-transform: uppercase; letter-spacing: .5px; }
  table.lines thead th.right { text-align: right; }
  table.lines tbody td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; vertical-align: top; word-wrap: break-word; overflow-wrap: anywhere; line-height: 1.4; }
  table.lines tbody td.right { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  table.lines tbody td.num { color: #94a3b8; width: 28px; }
  table.lines tbody td.desc { white-space: normal; word-break: break-word; overflow-wrap: anywhere; hyphens: auto; -webkit-hyphens: auto; max-width: 0; }
  .tax-tags { font-size: 11px; color: #64748b; margin-top: 2px; }
  .totals-row { margin-top: 16px; display: grid; grid-template-columns: 1fr auto; gap: 24px; align-items: end; }
  .qr { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; }
  .qr img { width: 110px; height: 110px; }
  .totals { display: flex; justify-content: flex-end; }
  table.totals-tbl { min-width: 280px; border-collapse: collapse; font-size: 13px; }
  table.totals-tbl td { padding: 6px 10px; }
  table.totals-tbl td.right { text-align: right; font-variant-numeric: tabular-nums; }
  table.totals-tbl tr.grand td { border-top: 2px solid ${primary}; font-weight: 800; font-size: 15px; padding-top: 10px; color: ${primary}; }
  table.totals-tbl tr.balance td { background: ${accent}10; color: ${accent}; font-weight: 800; }
  .block { margin-top: 22px; padding: 14px 16px; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc; }
  .block.payment { background: ${accent}0d; border-color: ${accent}40; }
  .block-title { font-size: 12px; font-weight: 700; color: ${primary}; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 8px; }
  table.mini { width: 100%; border-collapse: collapse; font-size: 12px; }
  table.mini td { padding: 4px 0; }
  table.mini td.right { text-align: right; font-variant-numeric: tabular-nums; }
  table.mini tr.grand td { border-top: 1px solid #cbd5e1; padding-top: 6px; font-weight: 700; }
  table.mini th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: .5px; color: #64748b; padding: 4px 0; border-bottom: 1px solid #e2e8f0; }
  table.mini th.right { text-align: right; }
  .dispatch-sub { margin-top: 8px; }
  .dispatch-sub-title { font-size: 11px; font-weight: 700; color: ${accent}; margin-bottom: 4px; }
  .notes { margin-top: 18px; padding: 12px 14px; background: #f1f5f9; border-left: 3px solid ${accent}; border-radius: 4px; font-size: 12px; white-space: pre-wrap; }
  .signature { margin-top: 22px; border-top: 1px dashed #cbd5e1; padding-top: 12px; }
  .signature img { max-height: 80px; max-width: 240px; }
  .footer { margin-top: 28px; padding-top: 14px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 11px; text-align: center; }
  table.lines thead { display: table-header-group; }
  table.lines tfoot { display: table-footer-group; }
  table.lines tr { page-break-inside: avoid; break-inside: avoid; }
  table.lines tbody td { orphans: 3; widows: 3; }
  .block, .notes, .signature, .totals-row, .party, .qr, table.totals-tbl, table.totals-tbl tr, table.totals-tbl tbody, .footer { page-break-inside: avoid; break-inside: avoid; }
  .header { page-break-after: avoid; break-after: avoid; }
  h1, h2, h3, .title, .block-title { page-break-after: avoid; break-after: avoid; }
  /* Keep totals + payment terms grouped with at least the previous content */
  .totals-row { page-break-before: auto; break-before: auto; page-break-inside: avoid; break-inside: avoid; }
  .signature { page-break-before: auto; break-before: auto; page-break-inside: avoid; break-inside: avoid; }
  @page { size: A4; margin: 14mm 12mm; }
  @media print {
    html, body { background: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { margin: 0; }
    .page { box-shadow: none; margin: 0; padding: 0; max-width: 100%; width: 100%; }
    a { color: inherit; text-decoration: none; }
    /* Force a clean break if a row would be cut — browsers honor avoid on tr above. */
    table.lines { page-break-inside: auto; break-inside: auto; }
    table.lines tbody { page-break-inside: auto; break-inside: auto; }
  }
</style>
</head><body><div class="page">
  <div class="header">
    <div class="brand">
      ${logo ? `<img src="${esc(logo)}" alt="logo"/>` : ""}
      <div>
        ${company ? `<div class="company">${esc(company)}</div>` : ""}
        ${d.from?.address ? `<div class="muted pre">${esc(d.from.address)}</div>` : ""}
        ${d.from?.email ? `<div class="muted small">${esc(d.from.email)}</div>` : ""}
      </div>
    </div>
    <div class="doc-meta">
      <p class="doc-label">${docLabel}</p>
      ${d.number ? `<div class="doc-num">${esc(d.number)}</div>` : ""}
      ${statusBadge}
      ${linkRef}
    </div>
  </div>

  <div class="meta-grid">
    ${issued ? `<div><div class="label">Issued</div><div class="value">${esc(issued)}</div></div>` : ""}
    ${due ? `<div><div class="label">${d.kind === "estimate" ? "Valid Until" : "Due"}</div><div class="value">${esc(due)}</div></div>` : ""}
    ${paid && d.kind !== "receipt" ? `<div><div class="label">Paid</div><div class="value">${esc(paid)}</div></div>` : ""}
    ${d.title ? `<div><div class="label">Reference</div><div class="value">${esc(d.title)}</div></div>` : ""}
  </div>

  <div class="parties">
    ${partyBlock("From", d.from)}
    ${partyBlock(d.kind === "receipt" ? "Received From" : "Bill To", d.to)}
  </div>

  ${lineRows ? `
  <div class="lines-wrap">
  <table class="lines">
    <colgroup><col class="c-num"/><col class="c-desc"/><col class="c-qty"/><col class="c-rate"/><col class="c-amt"/></colgroup>
    <thead><tr>
      <th>#</th><th>Description</th><th class="right">Qty</th><th class="right">Rate</th><th class="right">Amount</th>
    </tr></thead>
    <tbody>${lineRows}</tbody>
  </table>
  </div>` : ""}

  <div class="totals-row">
    ${qrDataUrl
      ? `<div class="qr"><img src="${qrDataUrl}" alt="QR"/><div class="muted small">Scan to verify / pay</div></div>`
      : qrError
        ? `<div class="qr"><div class="muted small" style="color:#b91c1c">QR unavailable: ${esc(qrError)}</div></div>`
        : `<div></div>`}
    <div class="totals">
      <table class="totals-tbl">${totalsRows.join("")}</table>
    </div>
  </div>

  ${paymentBlock}
  ${dispatchBlock}
  ${d.payment_terms ? `<div class="notes"><strong>Payment Terms</strong><br/>${esc(d.payment_terms)}</div>` : ""}
  ${d.notes ? `<div class="notes"><strong>Notes</strong><br/>${esc(d.notes)}</div>` : ""}
  ${d.signature_data ? `<div class="signature"><div class="muted small">Signed${d.signed_at ? " on " + new Date(d.signed_at).toLocaleString() : ""}${d.signed_by ? " by " + esc(d.signed_by) : ""}</div><img src="${esc(d.signature_data)}" alt="signature"/></div>` : ""}
  ${footer ? `<div class="footer">${esc(footer)}</div>` : `<div class="footer">This document was generated electronically.</div>`}
</div>
<script>
(function(){
  // A4 printable area at 96dpi with 14mm/12mm margins ≈ 703 x 1056 px.
  // These are conservative fallbacks; actual values are measured at runtime
  // from the document's CSS environment via a 1mm probe.
  var MAX_W = 703;
  var MAX_H = 1056;

  // Measure real px-per-mm and derive printable height from the @page rule
  // (size: A4; margin: 14mm 12mm). This avoids drift between the constant
  // and the browser's actual layout, which is what produced blank bands.
  function getPageMetrics(){
    var probe = document.createElement('div');
    probe.style.cssText = 'position:absolute;left:-9999px;top:-9999px;height:100mm;width:100mm;';
    document.body.appendChild(probe);
    var pxPerMm = probe.getBoundingClientRect().height / 100;
    probe.parentNode.removeChild(probe);
    if (!isFinite(pxPerMm) || pxPerMm <= 0) pxPerMm = 96 / 25.4;
    var pageH = 297 * pxPerMm;
    var pageW = 210 * pxPerMm;
    var marginV = 14 * pxPerMm;
    var marginH = 12 * pxPerMm;
    var contentH = pageH - 2 * marginV;
    var contentW = pageW - 2 * marginH;
    return { pxPerMm: pxPerMm, pageH: pageH, contentH: contentH, contentW: contentW, marginV: marginV };
  }

  // Legibility floor: never shrink below 80% of base (≈10.4px on 13px base).
  // Once the floor is reached, allow wrapping inside line cells so content keeps
  // fitting horizontally without becoming too small to read.
  var MIN_SCALE = 0.8;
  function fitWidth(page){
    var scale = 1;
    var iter = 0;
    var hitFloor = false;
    while (iter++ < 14) {
      var overflow = false;
      var tables = page.querySelectorAll('table.lines, table.totals-tbl');
      for (var i=0;i<tables.length;i++){
        if (tables[i].scrollWidth > tables[i].clientWidth + 1) { overflow = true; break; }
      }
      if (!overflow && page.scrollWidth <= MAX_W + 4) break;
      if (scale - 0.05 < MIN_SCALE) { hitFloor = true; break; }
      scale -= 0.05;
      page.style.fontSize = (scale * 100).toFixed(1) + '%';
      var cells = page.querySelectorAll('table.lines th, table.lines td');
      for (var j=0;j<cells.length;j++){ cells[j].style.padding = (8*scale).toFixed(1)+'px '+(10*scale).toFixed(1)+'px'; }
    }
    if (hitFloor) {
      // Pin to the minimum readable scale and let description cells wrap cleanly
      // instead of shrinking text further. Numeric cells stay on a single line.
      scale = MIN_SCALE;
      page.style.fontSize = (scale * 100).toFixed(1) + '%';
      var cells2 = page.querySelectorAll('table.lines th, table.lines td');
      for (var k=0;k<cells2.length;k++){
        cells2[k].style.padding = (8*scale).toFixed(1)+'px '+(10*scale).toFixed(1)+'px';
      }
      var descCells = page.querySelectorAll('table.lines td.desc');
      for (var d=0;d<descCells.length;d++){
        var dc = descCells[d];
        dc.style.whiteSpace = 'normal';
        dc.style.wordBreak = 'break-word';
        dc.style.overflowWrap = 'anywhere';
        dc.style.hyphens = 'auto';
        dc.style.webkitHyphens = 'auto';
        dc.style.lineHeight = '1.35';
      }
    }
    return scale;
  }

  // Insert explicit page-break spacers before any line-row that would cross a page boundary.
  function paginateRows(page, metrics){
    var rows = page.querySelectorAll('table.lines tbody tr');
    if (!rows.length) return;
    page.querySelectorAll('.pb-spacer').forEach(function(n){ n.remove(); });
    var pageTop = page.getBoundingClientRect().top;
    var contentH = metrics.contentH;
    // Bottom safety margin scales with px-per-mm so it stays ~2mm regardless of DPI.
    var safety = Math.max(4, metrics.pxPerMm * 2);
    for (var i=0;i<rows.length;i++){
      var r = rows[i];
      var rect = r.getBoundingClientRect();
      var topOnPage = ((rect.top - pageTop) % contentH + contentH) % contentH;
      var bottomOnPage = topOnPage + rect.height;
      if (bottomOnPage > contentH - safety) {
        var remaining = contentH - topOnPage;
        // Cap to remaining space (no extra padding) so we never produce a
        // visible blank band larger than the actual gap to the page edge.
        var h = Math.max(0, remaining - 1);
        var spacer = document.createElement('tr');
        spacer.className = 'pb-spacer';
        var td = document.createElement('td');
        td.colSpan = 5;
        td.style.padding = '0';
        td.style.border = '0';
        td.style.height = h + 'px';
        td.style.pageBreakAfter = 'always';
        td.style.breakAfter = 'page';
        spacer.appendChild(td);
        r.parentNode.insertBefore(spacer, r);
      }
    }
  }

  // Push atomic blocks (totals row, signature, footer) onto a fresh page if they
  // would otherwise straddle a page boundary. Spacer height is the *exact*
  // remaining space on the current page (measured, not constant-based) so we
  // don't introduce blank bands on the next page.
  function paginateBlocks(page, metrics){
    page.querySelectorAll('.pb-block-spacer').forEach(function(n){ n.remove(); });
    var pageTop = page.getBoundingClientRect().top;
    var contentH = metrics.contentH;
    var safety = Math.max(4, metrics.pxPerMm * 2);
    var selectors = ['.totals-row', '.signature', '.footer', '.notes'];
    for (var s=0;s<selectors.length;s++){
      var blocks = page.querySelectorAll(selectors[s]);
      for (var i=0;i<blocks.length;i++){
        var el = blocks[i];
        // Skip blocks that already follow a forced break (no measurable gap).
        var rect = el.getBoundingClientRect();
        var topOnPage = ((rect.top - pageTop) % contentH + contentH) % contentH;
        var bottomOnPage = topOnPage + rect.height;
        // Only intervene if the block fits on its own page AND currently straddles.
        if (rect.height < contentH - safety && bottomOnPage > contentH - safety) {
          var remaining = contentH - topOnPage;
          var h = Math.max(0, remaining - 1);
          var spacer = document.createElement('div');
          spacer.className = 'pb-block-spacer';
          spacer.style.height = h + 'px';
          spacer.style.margin = '0';
          spacer.style.padding = '0';
          spacer.style.pageBreakAfter = 'always';
          spacer.style.breakAfter = 'page';
          el.parentNode.insertBefore(spacer, el);
        }
      }
    }
  }

  function run(){
    var page = document.querySelector('.page');
    if (!page) return;
    var metrics = getPageMetrics();
    // Keep MAX_W/MAX_H in sync with measured values for fitWidth's loop.
    MAX_W = metrics.contentW;
    MAX_H = metrics.contentH;
    fitWidth(page);
    requestAnimationFrame(function(){
      paginateRows(page, metrics);
      requestAnimationFrame(function(){ paginateBlocks(page, metrics); });
    });
  }
  if (document.readyState === 'complete') run();
  else window.addEventListener('load', run);
  window.addEventListener('beforeprint', run);
  window.addEventListener('resize', run);
})();
</script>
})();
</script>
</body></html>`;
}

export async function generateDocPdfBlob(d: DocBuildInput): Promise<Blob> {
  const html = await buildDocHtml(d);

  const iframe = document.createElement("iframe");

  iframe.style.position = "fixed";
  iframe.style.left = "-10000px";
  iframe.style.top = "0";
  iframe.style.width = "820px";
  iframe.style.height = "1200px";
  iframe.style.border = "0";
  iframe.style.visibility = "hidden";

  document.body.appendChild(iframe);

  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        reject(new Error("PDF render timed out"));
      }, 20000);

      iframe.onload = () => {
        window.clearTimeout(timeout);
        resolve();
      };

      iframe.onerror = () => {
        window.clearTimeout(timeout);
        reject(new Error("PDF iframe failed to load"));
      };

      iframe.srcdoc = html;
    });

    const doc = iframe.contentDocument;

    if (!doc) {
      throw new Error("Could not access PDF document");
    }

    // Wait for images such as the company logo to load.
    const images = Array.from(doc.images);

    await Promise.all(
      images.map(
        (img) =>
          new Promise<void>((resolve) => {
            if (img.complete) {
              resolve();
              return;
            }

            img.onload = () => resolve();
            img.onerror = () => resolve();
          })
      )
    );

    // Allow the pagination/fit scripts in buildDocHtml() to finish.
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() =>
        requestAnimationFrame(() => resolve())
      )
    );

    const page = doc.querySelector(".page") as HTMLElement | null;

    if (!page) {
      throw new Error("Invoice page could not be rendered");
    }

    const canvas = await toCanvas(page, {
      pixelRatio: 2,
      backgroundColor: "#ffffff",
      cacheBust: true,
    });

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true,
    });

    const pageWidth = 210;
    const pageHeight = 297;

    // const imgWidth = pageWidth;
    // const imgHeight = (canvas.height * imgWidth) / canvas.width;

    // The rendered invoice is one tall canvas.
    // Slice it into A4-sized sections.
    const pxPerMm = canvas.width / pageWidth;
    const pageHeightPx = Math.floor(pageHeight * pxPerMm);

    let sourceY = 0;
    let pdfPage = 0;

    while (sourceY < canvas.height) {
      const sliceHeight = Math.min(
        pageHeightPx,
        canvas.height - sourceY
      );

      const sliceCanvas = document.createElement("canvas");
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = sliceHeight;

      const ctx = sliceCanvas.getContext("2d");

      if (!ctx) {
        throw new Error("Could not create PDF canvas");
      }

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);

      ctx.drawImage(
        canvas,
        0,
        sourceY,
        canvas.width,
        sliceHeight,
        0,
        0,
        canvas.width,
        sliceHeight
      );

      const imageData = sliceCanvas.toDataURL("image/jpeg", 0.92);

      if (pdfPage > 0) {
        pdf.addPage();
      }

      const sliceHeightMm = sliceHeight / pxPerMm;

      pdf.addImage(
        imageData,
        "JPEG",
        0,
        0,
        pageWidth,
        sliceHeightMm,
        undefined,
        "FAST"
      );

      sourceY += sliceHeight;
      pdfPage += 1;
    }

    return pdf.output("blob");
  } finally {
    setTimeout(() => iframe.remove(), 1000);
  }
}

export async function openDocPdf(d: DocBuildInput) {
  const html = await buildDocHtml(d);
  const w = window.open("", "_blank");
  if (!w) throw new Error("Popup blocked — allow popups for this site to open the PDF preview.");
  w.document.write(html);
  w.document.close();
  w.onload = () => w.print();
  return true;
}

export async function openMultiDocPdf(docs: DocBuildInput[]) {
  if (!docs?.length) throw new Error("No documents to print.");
  const htmls = await Promise.all(docs.map((d) => buildDocHtml(d)));
  // Extract <body> innerHTML and <style> from each, concatenate with page breaks.
  const parser = new DOMParser();
  const styles: string[] = [];
  const bodies: string[] = [];
  htmls.forEach((h) => {
    const doc = parser.parseFromString(h, "text/html");
    doc.querySelectorAll("style").forEach((s) => styles.push(s.innerHTML));
    bodies.push(doc.body.innerHTML);
  });
  // Dedupe identical style blocks
  const uniqueStyles = Array.from(new Set(styles)).join("\n");
  const combined = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Invoices (${docs.length})</title>
<style>${uniqueStyles}
.doc-break { page-break-after: always; break-after: page; }
.doc-break:last-child { page-break-after: auto; break-after: auto; }
</style></head><body>${bodies.map((b) => `<div class="doc-break">${b}</div>`).join("")}
<script>window.addEventListener('load',function(){setTimeout(function(){window.print();},250);});</script>
</body></html>`;
  const w = window.open("", "_blank");
  if (!w) throw new Error("Popup blocked — allow popups for this site to print.");
  w.document.write(combined);
  w.document.close();
  return true;
}

export async function downloadDocPdf(d: DocBuildInput, fileName: string) {
  let html: string;
  try {
    html = await buildDocHtml(d);
  } catch (e: any) {
    throw new Error(`Could not build document: ${e?.message || e}`);
  }
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0"; iframe.style.bottom = "0";
  iframe.style.width = "0"; iframe.style.height = "0"; iframe.style.border = "0";
  document.body.appendChild(iframe);
  try {
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("PDF render timed out")), 15000);
      iframe.onload = () => { clearTimeout(t); resolve(); };
      iframe.onerror = () => { clearTimeout(t); reject(new Error("PDF iframe failed to load")); };
      iframe.srcdoc = html;
    });
    const win = iframe.contentWindow;
    if (!win) throw new Error("PDF preview window unavailable (browser blocked it).");
    (win.document as any).title = fileName.replace(/\.pdf$/i, "");
    win.focus();
    win.print();
  } finally {
    setTimeout(() => iframe.remove(), 1500);
  }
}
