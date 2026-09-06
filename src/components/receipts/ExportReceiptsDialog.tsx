import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { fmtMoney } from "@/lib/financialDocs";
import { Download, FileText, FileSpreadsheet, AlertTriangle, ChevronDown, ChevronUp, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export type ExportField = {
  key: string;
  label: string;
  group: "Core" | "Amounts" | "Refund" | "Recurrence" | "Meta";
  get: (r: any) => any;
};

export const RECEIPT_EXPORT_FIELDS: ExportField[] = [
  { key: "receipt_number", label: "Receipt #", group: "Core", get: (r) => r.receipt_number },
  { key: "kind", label: "Type", group: "Core", get: (r) => r.kind },
  { key: "payer", label: "Payer", group: "Core", get: (r) => r.payer_name || r.clients?.company_name || "" },
  { key: "payer_email", label: "Payer email", group: "Core", get: (r) => r.payer_email || r.clients?.contact_email || "" },
  { key: "payer_phone", label: "Payer phone", group: "Core", get: (r) => r.clients?.contact_phone || "" },
  { key: "payment_method", label: "Method", group: "Core", get: (r) => r.payment_method || "" },
  { key: "payment_reference", label: "Reference", group: "Core", get: (r) => r.payment_reference || "" },
  { key: "currency", label: "Currency", group: "Amounts", get: (r) => r.currency || "USD" },
  { key: "subtotal", label: "Subtotal", group: "Amounts", get: (r) => Number(r.subtotal || 0) },
  { key: "discount_amount", label: "Discount", group: "Amounts", get: (r) => Number(r.discount_amount || 0) },
  { key: "tax_amount", label: "Tax", group: "Amounts", get: (r) => Number(r.tax_amount || 0) },
  { key: "total", label: "Total", group: "Amounts", get: (r) => Number(r.total || 0) },
  { key: "amount_paid", label: "Amount paid", group: "Amounts", get: (r) => Number(r.amount_paid || r.total || 0) },
  { key: "refunded_amount", label: "Refunded", group: "Refund", get: (r) => Number(r.refunded_amount || 0) },
  { key: "net", label: "Net", group: "Refund", get: (r) => Number(r.amount_paid || r.total || 0) - Number(r.refunded_amount || 0) },
  { key: "status", label: "Status", group: "Refund", get: (r) => {
    const ref = Number(r.refunded_amount || 0);
    const paid = Number(r.amount_paid || r.total || 0);
    return ref <= 0 ? "Paid" : ref >= paid ? "Refunded" : "Partial";
  }},
  { key: "refunded_at", label: "Refunded at", group: "Refund", get: (r) => r.refunded_at ? new Date(r.refunded_at).toISOString() : "" },
  { key: "refund_reason", label: "Refund reason", group: "Refund", get: (r) => r.refund_reason || "" },
  { key: "recurrence", label: "Recurrence", group: "Recurrence", get: (r) => r.recurrence || "" },
  { key: "recurrence_active", label: "Recurring active", group: "Recurrence", get: (r) => r.recurrence_active ? "Yes" : "No" },
  { key: "recurrence_next_at", label: "Next recurrence", group: "Recurrence", get: (r) => r.recurrence_next_at ? new Date(r.recurrence_next_at).toISOString() : "" },
  { key: "invoice_number", label: "Invoice #", group: "Meta", get: (r) => r.invoices?.invoice_number || "" },
  { key: "paid_at", label: "Paid date", group: "Meta", get: (r) => new Date(r.paid_at || r.created_at).toISOString() },
  { key: "created_at", label: "Created at", group: "Meta", get: (r) => new Date(r.created_at).toISOString() },
  { key: "notes", label: "Notes", group: "Meta", get: (r) => r.notes || "" },
];

const DEFAULT_FIELDS = [
  "receipt_number", "payer", "payment_method", "payment_reference",
  "currency", "subtotal", "tax_amount", "amount_paid",
  "refunded_amount", "net", "status",
  "recurrence", "recurrence_active",
  "paid_at", "invoice_number", "notes",
];

export type ReceiptFilterSummary = {
  search?: string;
  method?: string;
  currency?: string;
  status?: string;
  from?: string;
  to?: string;
};

const summarizeFilters = (f: ReceiptFilterSummary): { label: string; value: string }[] => {
  const out: { label: string; value: string }[] = [];
  if (f.search) out.push({ label: "Search", value: `"${f.search}"` });
  if (f.method && f.method !== "all") out.push({ label: "Method", value: f.method });
  if (f.currency && f.currency !== "all") out.push({ label: "Currency", value: f.currency });
  if (f.status && f.status !== "all") out.push({ label: "Status", value: f.status });
  if (f.from || f.to) out.push({ label: "Date range", value: `${f.from || "…"} → ${f.to || "…"}` });
  return out;
};

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  rows: any[];
  selectedRows?: any[];
  filters: ReceiptFilterSummary;
  primaryCurrency: string;
}

export const ExportReceiptsDialog = ({ open, onOpenChange, rows, selectedRows = [], filters, primaryCurrency }: Props) => {
  const [format, setFormat] = useState<"csv" | "pdf">("csv");
  const [selected, setSelected] = useState<Set<string>>(new Set(DEFAULT_FIELDS));
  const hasSelection = selectedRows.length > 0;
  const [scope, setScope] = useState<"filtered" | "selected">(hasSelection ? "selected" : "filtered");

  useEffect(() => {
    if (open) setScope(hasSelection ? "selected" : "filtered");
  }, [open, hasSelection]);

  const exportRows = scope === "selected" ? selectedRows : rows;
  const [issuesOpen, setIssuesOpen] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  // Remember acknowledgments per export scope (signature = scope + sorted row ids)
  const [ackedSignatures, setAckedSignatures] = useState<Set<string>>(new Set());
  // Persistent "always remember for me" preference — stored server-side per user,
  // with localStorage as an offline cache so the UI is responsive on load.
  const ALWAYS_ACK_KEY = "receipts.exportAck.alwaysRemember";
  const PREF_KEY = "receipts.export.always_ack";
  // Initial value: read localStorage as a synchronous fallback so the UI is
  // immediately correct (especially when signed out). When signed in, the
  // server value below will overwrite this.
  const readLocal = (): boolean => {
    if (typeof window === "undefined") return false;
    try { return window.localStorage.getItem(ALWAYS_ACK_KEY) === "1"; } catch { return false; }
  };
  const [alwaysRemember, setAlwaysRemember] = useState<boolean>(readLocal);
  const [prefSyncing, setPrefSyncing] = useState(false);
  const [prefInflight, setPrefInflight] = useState(false);
  const [prefSource, setPrefSource] = useState<"local" | "server">("local");

  // Resolve baseline whenever the dialog opens.
  // Precedence:
  //   1. Signed in + server row exists → server value wins (authoritative).
  //   2. Signed in + no server row    → seed server from localStorage if set,
  //                                     otherwise default to false.
  //   3. Signed out / auth error      → keep localStorage value (already set).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const localVal = readLocal();
      let auth: any = null;
      try {
        const res = await supabase.auth.getUser();
        if (res.error) throw res.error;
        auth = res.data;
      } catch {
        // Auth lookup failed → fall back to localStorage
        if (cancelled) return;
        setAlwaysRemember(localVal);
        baselineRef.current = localVal;
        pendingValueRef.current = localVal;
        baselineLocalRef.current = localVal ? "1" : "0";
        setPrefSource("local");
        return;
      }
      const uid = auth?.user?.id;

      // Signed out — fall back to localStorage cache
      if (!uid) {
        if (cancelled) return;
        setAlwaysRemember(localVal);
        baselineRef.current = localVal;
        pendingValueRef.current = localVal;
        baselineLocalRef.current = localVal ? "1" : "0";
        setPrefSource("local");
        return;
      }

      // Signed in — server is source of truth
      const { data, error } = await supabase
        .from("user_preferences")
        .select("value")
        .eq("user_id", uid)
        .eq("key", PREF_KEY)
        .maybeSingle();
      if (cancelled || error) return;
      // Don't clobber a pending in-flight/debounced toggle the user just made
      if (debounceTimerRef.current || inflightTokenRef.current > 0) return;

      if (data) {
        // Case 1: server row exists — adopt it
        const v = (data.value as any)?.enabled === true;
        setAlwaysRemember(v);
        pendingValueRef.current = v;
        baselineRef.current = v;
        try {
          window.localStorage.setItem(ALWAYS_ACK_KEY, v ? "1" : "0");
          baselineLocalRef.current = v ? "1" : "0";
        } catch { /* ignore */ }
        setPrefSource("server");
      } else {
        // Case 2: no server row yet
        if (localVal) {
          // Seed the server from this device's localStorage so it follows the user
          await supabase
            .from("user_preferences")
            .upsert({ user_id: uid, key: PREF_KEY, value: { enabled: true } }, { onConflict: "user_id,key" });
        }
        setAlwaysRemember(localVal);
        pendingValueRef.current = localVal;
        baselineRef.current = localVal;
        baselineLocalRef.current = localVal ? "1" : "0";
        setPrefSource("server");
      }
    })();
    return () => { cancelled = true; };
  }, [open]);

  // Debounced + race-safe persistence: optimistic UI flips immediately,
  // we only send the LATEST value after the user stops toggling, and we
  // ignore stale responses if newer toggles happen mid-flight.
  const PREF_DEBOUNCE_MS = 400;
  const baselineRef = useRef<boolean>(alwaysRemember);
  const baselineLocalRef = useRef<string | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflightTokenRef = useRef(0);
  const pendingValueRef = useRef<boolean>(alwaysRemember);

  // Initialize baseline from localStorage once
  useEffect(() => {
    try { baselineLocalRef.current = window.localStorage.getItem(ALWAYS_ACK_KEY); } catch { /* ignore */ }
    baselineRef.current = alwaysRemember;
    pendingValueRef.current = alwaysRemember;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flushPreference = async () => {
    const target = pendingValueRef.current;
    const startedFromBaseline = baselineRef.current;
    const myToken = ++inflightTokenRef.current;
    setPrefSyncing(true);
    setPrefInflight(true);
    try {
      const { data: auth, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;
      const uid = auth.user?.id;
      if (!uid) {
        if (myToken === inflightTokenRef.current) {
          toast.message("Saved on this device only — sign in to sync across devices.");
          // Treat current optimistic value as the new baseline
          baselineRef.current = target;
          try { baselineLocalRef.current = window.localStorage.getItem(ALWAYS_ACK_KEY); } catch { /* ignore */ }
        }
        return;
      }
      const { error } = await supabase
        .from("user_preferences")
        .upsert({ user_id: uid, key: PREF_KEY, value: { enabled: target } }, { onConflict: "user_id,key" });
      // Stale response — a newer toggle is already pending/in-flight; ignore.
      if (myToken !== inflightTokenRef.current) return;
      if (error) throw error;
      // Commit new baseline
      baselineRef.current = target;
      try { baselineLocalRef.current = window.localStorage.getItem(ALWAYS_ACK_KEY); } catch { /* ignore */ }
      if (target !== startedFromBaseline) {
        toast.success(target
          ? "Acknowledgment will be remembered on all your devices."
          : "Acknowledgment preference cleared.");
      }
    } catch (e: any) {
      // Only roll back if this is still the most-recent attempt
      if (myToken !== inflightTokenRef.current) return;
      const prev = baselineRef.current;
      const prevLocal = baselineLocalRef.current;
      setAlwaysRemember(prev);
      pendingValueRef.current = prev;
      try {
        if (prevLocal === null) window.localStorage.removeItem(ALWAYS_ACK_KEY);
        else window.localStorage.setItem(ALWAYS_ACK_KEY, prevLocal);
      } catch { /* ignore */ }
      toast.error("Couldn't save preference — change reverted. " + (e?.message || ""));
    } finally {
      if (myToken === inflightTokenRef.current) {
        setPrefSyncing(false);
        setPrefInflight(false);
      }
    }
  };

  const updateAlwaysRemember = (v: boolean) => {
    // Block changes while a sync is actively in-flight to prevent
    // conflicting upserts and double toasts.
    if (prefInflight) return;
    if (v === alwaysRemember) return;
    // Optimistic update — instant UI feedback
    setAlwaysRemember(v);
    pendingValueRef.current = v;
    try { window.localStorage.setItem(ALWAYS_ACK_KEY, v ? "1" : "0"); } catch { /* ignore */ }

    // Debounce: cancel any pending flush, schedule a new one with the latest value
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    // If the user toggled back to the baseline before the debounce fires,
    // skip the round-trip entirely.
    if (v === baselineRef.current) {
      setPrefSyncing(false);
      return;
    }
    setPrefSyncing(true);
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      void flushPreference();
    }, PREF_DEBOUNCE_MS);
  };

  // Cleanup any pending timer on unmount
  useEffect(() => () => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
  }, []);
  const scopeSignature = useMemo(
    () => `${scope}:${exportRows.map((r: any) => r.id).sort().join(",")}`,
    [scope, exportRows]
  );
  useEffect(() => { if (open) setIssuesOpen(false); }, [open]);
  // Re-apply remembered ack whenever the signature changes (or always-remember is on)
  useEffect(() => {
    setAcknowledged(alwaysRemember || ackedSignatures.has(scopeSignature));
  }, [scopeSignature, ackedSignatures, alwaysRemember]);

  const handleAcknowledge = (v: boolean) => {
    setAcknowledged(v);
    setAckedSignatures((prev) => {
      const next = new Set(prev);
      if (v) next.add(scopeSignature); else next.delete(scopeSignature);
      return next;
    });
  };

  const validation = useMemo(() => {
    const round = (v: number) => Math.round(v * 100) / 100;
    type RowIssue = { id: string; label: string; missing: string[] };
    const items: RowIssue[] = [];
    const counters: Record<string, number> = {};
    const bump = (k: string) => { counters[k] = (counters[k] || 0) + 1; };
    exportRows.forEach((r: any) => {
      const missing: string[] = [];
      const payer = (r.payer_name || r.clients?.company_name || "").trim();
      if (!payer) { missing.push("Payer"); bump("Payer"); }
      const subtotal = Number(r.subtotal || 0);
      const total = Number(r.total || 0);
      const paid = Number(r.amount_paid || r.total || 0);
      const tax = Number(r.tax_amount || 0) + Number(r.tax2_amount || 0);
      const discount = Number(r.discount_amount || 0);
      if (subtotal <= 0) { missing.push("Subtotal"); bump("Subtotal"); }
      if (paid <= 0) { missing.push("Amount paid"); bump("Amount paid"); }
      const expected = round(subtotal - discount + tax);
      if (total > 0 && Math.abs(expected - round(total)) > 0.01) {
        missing.push("Totals mismatch"); bump("Totals mismatch");
      }
      const dt = r.paid_at || r.created_at;
      if (!dt || isNaN(new Date(dt).getTime())) { missing.push("Date"); bump("Date"); }
      if (missing.length) items.push({ id: r.id, label: r.receipt_number || "(no #)", missing });
    });
    return { items, counters, count: items.length };
  }, [exportRows]);

  const blocked = validation.count > 0 && !acknowledged;



  const filterChips = useMemo(() => summarizeFilters(filters), [filters]);
  const fields = RECEIPT_EXPORT_FIELDS.filter((f) => selected.has(f.key));
  const groups = useMemo(() => {
    const g: Record<string, ExportField[]> = {};
    RECEIPT_EXPORT_FIELDS.forEach((f) => { (g[f.group] ||= []).push(f); });
    return g;
  }, []);

  const toggle = (key: string) => {
    const n = new Set(selected);
    n.has(key) ? n.delete(key) : n.add(key);
    setSelected(n);
  };
  const setGroup = (group: string, on: boolean) => {
    const n = new Set(selected);
    RECEIPT_EXPORT_FIELDS.filter((f) => f.group === group).forEach((f) => on ? n.add(f.key) : n.delete(f.key));
    setSelected(n);
  };
  const selectAll = () => setSelected(new Set(RECEIPT_EXPORT_FIELDS.map((f) => f.key)));
  const reset = () => setSelected(new Set(DEFAULT_FIELDS));

  const computeTotals = () => {
    const gross = exportRows.reduce((s, r) => s + Number(r.amount_paid || r.total || 0), 0);
    const refunded = exportRows.reduce((s, r) => s + Number(r.refunded_amount || 0), 0);
    return { count: exportRows.length, gross, refunded, net: gross - refunded };
  };

  const exportCsv = () => {
    if (!exportRows.length) { toast.error("Nothing to export"); return; }
    if (!fields.length) { toast.error("Pick at least one field"); return; }
    const exportedAt = new Date();
    const totals = computeTotals();
    const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const meta: string[] = [];
    meta.push(`# Receipts export`);
    meta.push(`# Exported at,${exportedAt.toISOString()} (${exportedAt.toLocaleString()})`);
    meta.push(`# Records,${exportRows.length}`);
    if (scope === "selected") {
      meta.push(`# Scope,Selected rows only (${selectedRows.length})`);
    } else if (filterChips.length) {
      meta.push(`# Filters,"${filterChips.map((c) => `${c.label}: ${c.value}`).join("; ")}"`);
    } else {
      meta.push(`# Filters,(none — all records)`);
    }
    meta.push(`# Totals,Gross ${totals.gross.toFixed(2)} / Refunded ${totals.refunded.toFixed(2)} / Net ${totals.net.toFixed(2)} ${primaryCurrency}`);
    meta.push("");
    const header = fields.map((f) => esc(f.label)).join(",");
    const body = exportRows.map((r) => fields.map((f) => esc(f.get(r))).join(","));
    const csv = [...meta, header, ...body].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `receipts_${exportedAt.toISOString().slice(0, 19).replace(/[:T]/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${exportRows.length} receipts`);
    onOpenChange(false);
  };

  const exportPdf = () => {
    if (!exportRows.length) { toast.error("Nothing to export"); return; }
    if (!fields.length) { toast.error("Pick at least one field"); return; }
    const exportedAt = new Date();
    const totals = computeTotals();
    const esc = (s: any) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
    const fmt = (f: ExportField, r: any) => {
      const v = f.get(r);
      if (["subtotal", "discount_amount", "tax_amount", "total", "amount_paid", "refunded_amount", "net"].includes(f.key)) {
        return fmtMoney(Number(v || 0), r.currency || primaryCurrency);
      }
      if (["paid_at", "created_at", "refunded_at", "recurrence_next_at"].includes(f.key) && v) {
        return new Date(v).toLocaleString();
      }
      return esc(v);
    };
    
    const scopeChip = scope === "selected"
      ? `<span class="chip"><b>Scope:</b> Selected rows only (${selectedRows.length})</span>`
      : "";
    const filterHtml = scope === "selected"
      ? scopeChip
      : (filterChips.length
          ? filterChips.map((c) => `<span class="chip"><b>${esc(c.label)}:</b> ${esc(c.value)}</span>`).join("")
          : `<span class="chip muted">No filters — all records</span>`);
    const html = `<!doctype html><html><head><meta charset="utf-8" />
      <title>Receipts export ${exportedAt.toISOString().slice(0, 10)}</title>
      <style>
        @page { size: A4 landscape; margin: 14mm; }
        * { box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #111; font-size: 11px; }
        h1 { font-size: 18px; margin: 0 0 4px; }
        .meta { color: #555; font-size: 10px; margin-bottom: 8px; }
        .chips { margin: 6px 0 10px; display: flex; flex-wrap: wrap; gap: 4px; }
        .chip { display: inline-block; padding: 2px 6px; border: 1px solid #ddd; border-radius: 999px; font-size: 9px; background: #fafafa; }
        .chip.muted { color: #888; }
        .totals { display: flex; gap: 16px; padding: 6px 8px; background: #f4f6fb; border: 1px solid #e3e8f0; border-radius: 4px; margin-bottom: 10px; font-size: 10px; }
        .totals b { font-size: 12px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border-bottom: 1px solid #e5e5e5; padding: 4px 6px; text-align: left; vertical-align: top; }
        th { background: #f4f6fb; font-size: 9px; text-transform: uppercase; letter-spacing: 0.04em; color: #555; }
        tr:nth-child(even) td { background: #fafafa; }
        .footer { margin-top: 12px; font-size: 9px; color: #888; text-align: right; }
      </style></head><body>
      <h1>Receipts Export</h1>
      <div class="meta">Generated ${exportedAt.toLocaleString()} · ${exportRows.length} record${exportRows.length === 1 ? "" : "s"}</div>
      <div class="chips">${filterHtml}</div>
      <div class="totals">
        <span>Gross <b>${fmtMoney(totals.gross, primaryCurrency)}</b></span>
        <span>Refunded <b>${fmtMoney(totals.refunded, primaryCurrency)}</b></span>
        <span>Net <b>${fmtMoney(totals.net, primaryCurrency)}</b></span>
      </div>
      <table>
        <thead><tr>${fields.map((f) => `<th>${esc(f.label)}</th>`).join("")}</tr></thead>
        <tbody>
          ${exportRows.map((r) => `<tr>${fields.map((f) => `<td>${fmt(f, r)}</td>`).join("")}</tr>`).join("")}
        </tbody>
      </table>
      <div class="footer">Exported ${exportedAt.toISOString()}</div>
      <script>window.addEventListener('load',function(){setTimeout(function(){window.print();},300);});</script>
      </body></html>`;
    const w = window.open("", "_blank");
    if (!w) { toast.error("Popup blocked — allow popups to export PDF"); return; }
    w.document.write(html);
    w.document.close();
    toast.success(`Prepared ${exportRows.length} receipts for PDF`);
    onOpenChange(false);
  };

  const handleExport = () => format === "csv" ? exportCsv() : exportPdf();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Download className="w-4 h-4" />Export receipts</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Summary card */}
          <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs">Records to export</span>
              <Badge variant="secondary">{exportRows.length}</Badge>
            </div>
            <div className="flex items-start justify-between gap-3">
              <span className="text-muted-foreground text-xs pt-0.5">Active filters</span>
              <div className="flex flex-wrap justify-end gap-1 max-w-[70%]">
                {filterChips.length === 0
                  ? <Badge variant="outline" className="text-[10px]">None — all records</Badge>
                  : filterChips.map((c) => (
                      <Badge key={c.label} variant="outline" className="text-[10px]">
                        {c.label}: {c.value}
                      </Badge>
                    ))}
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border pt-2">
              <span>Export timestamp</span>
              <span className="font-mono">{new Date().toLocaleString()}</span>
            </div>
          </div>

          {/* Scope */}
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Which receipts</Label>
            <RadioGroup value={scope} onValueChange={(v) => setScope(v as any)} className="grid grid-cols-2 gap-2 mt-1.5">
              <label className={`flex items-center gap-2 p-2.5 rounded-md border cursor-pointer ${scope === "filtered" ? "border-primary bg-primary/5" : "border-border"}`}>
                <RadioGroupItem value="filtered" />
                <div className="text-sm">
                  Filtered view
                  <span className="text-xs text-muted-foreground ml-1">({rows.length})</span>
                </div>
              </label>
              <label className={`flex items-center gap-2 p-2.5 rounded-md border ${!hasSelection ? "opacity-50 cursor-not-allowed" : "cursor-pointer"} ${scope === "selected" ? "border-primary bg-primary/5" : "border-border"}`}>
                <RadioGroupItem value="selected" disabled={!hasSelection} />
                <div className="text-sm">
                  Selected only
                  <span className="text-xs text-muted-foreground ml-1">
                    ({selectedRows.length}{!hasSelection ? " — none checked" : ""})
                  </span>
                </div>
              </label>
            </RadioGroup>
          </div>

          {/* Validation warnings */}
          {validation.count > 0 && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/5 text-sm">
              <button type="button" onClick={() => setIssuesOpen((v) => !v)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span className="font-medium">
                  {validation.count} of {exportRows.length} receipt{exportRows.length === 1 ? "" : "s"} have missing or inconsistent fields
                </span>
                <span className="text-xs text-muted-foreground">— {Object.entries(validation.counters).map(([k, v]) => `${v} ${k}`).join(", ")}</span>
                <span className="flex-1" />
                {issuesOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {issuesOpen && (
                <div className="px-3 pb-3 max-h-40 overflow-y-auto space-y-1">
                  {validation.items.slice(0, 50).map((it) => (
                    <div key={it.id} className="flex items-start gap-2 text-xs">
                      <Badge variant="outline" className="font-mono text-[10px] shrink-0">{it.label}</Badge>
                      <span className="text-foreground/90">{it.missing.join(", ")}</span>
                    </div>
                  ))}
                  {validation.items.length > 50 && (
                    <div className="text-[11px] text-muted-foreground pt-1">…and {validation.items.length - 50} more</div>
                  )}
                </div>
              )}
              <label className="flex items-center gap-2 px-3 py-2 border-t border-amber-500/30 text-xs cursor-pointer">
                <Checkbox
                  checked={acknowledged}
                  disabled={alwaysRemember}
                  onCheckedChange={(v) => handleAcknowledge(!!v)}
                />
                <span>Export anyway — I understand some fields are incomplete</span>
              </label>
              <label className={`flex flex-col gap-1.5 px-3 py-2 border-t border-amber-500/30 text-xs ${prefInflight ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}>
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={alwaysRemember}
                    disabled={prefInflight}
                    onCheckedChange={(v) => updateAlwaysRemember(!!v)}
                  />
                  <span className="flex-1">Always remember my acknowledgment on my account</span>
                  {(() => {
                    const status = prefInflight
                      ? { label: "Saving…", cls: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400", dot: "bg-amber-500 animate-pulse", icon: "⏳", tip: "Sending your preference change to the server right now. The badge will update once the network request resolves." }
                      : prefSyncing
                      ? { label: "Pending sync", cls: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400", dot: "bg-amber-500 animate-pulse", icon: "⏳", tip: "Your change is debounced locally and queued — it will be pushed to your account shortly." }
                      : prefSource === "server"
                      ? { label: "Synced from server", cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400", dot: "bg-emerald-500", icon: "☁", tip: "This preference was loaded from your signed-in account on the server and follows you across devices." }
                      : { label: "Local device only", cls: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-400", dot: "bg-sky-500", icon: "💾", tip: "Seeded from this browser's localStorage — you're either signed out or the server hasn't returned a value yet. Sign in to sync." };
                    return (
                      <TooltipProvider delayDuration={150}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span tabIndex={0} className={`shrink-0 inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium cursor-help ${status.cls}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                              <span aria-hidden>{status.icon}</span>
                              {status.label}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
                            {status.tip}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    );
                  })()}
                </div>
                <span className="pl-6 text-muted-foreground text-[11px]">
                  {prefInflight
                    ? "Saving your preference to the server…"
                    : prefSyncing
                    ? "Change queued — will sync to your account shortly."
                    : prefSource === "server"
                    ? "This setting is loaded from your account and follows you across devices."
                    : "Saved on this device only. Sign in to sync this preference across devices."}
                </span>
              </label>
              <div className={`px-3 py-1.5 text-[11px] border-t flex items-center gap-1.5 ${
                alwaysRemember
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                  : ackedSignatures.has(scopeSignature)
                  ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400"
                  : "border-amber-500/30 bg-muted/30 text-muted-foreground"
              }`}>
                <span className="flex-1">
                  {alwaysRemember
                    ? "✓ Acknowledgment is always remembered on your account — syncs across all your devices."
                    : ackedSignatures.has(scopeSignature)
                    ? "✓ Acknowledgment remembered for this exact selection — you won't be asked again unless the selection changes."
                    : "Acknowledgment is not remembered yet for this selection. Check a box above to remember it."}
                </span>
                <TooltipProvider delayDuration={150}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" aria-label="What invalidates this acknowledgment?" className="shrink-0 opacity-70 hover:opacity-100">
                        <Info className="w-3.5 h-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
                      <p className="font-medium mb-1">Per-selection memory resets if:</p>
                      <ul className="list-disc pl-4 space-y-0.5">
                        <li>You switch the export scope (filtered ↔ selected)</li>
                        <li>You add or remove any receipt from the selection</li>
                        <li>The filtered list changes (new/edited/deleted receipts, filter or search changes)</li>
                        <li>You close and reopen the dialog in a fresh session</li>
                      </ul>
                      <p className="mt-1.5 font-medium">"Always remember" is saved to your account and syncs across all your devices until you uncheck it.</p>
                      <p className="mt-1 text-muted-foreground">Format, field choices, and file name do not affect the acknowledgment.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          )}

          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Format</Label>
            <RadioGroup value={format} onValueChange={(v) => setFormat(v as any)} className="grid grid-cols-2 gap-2 mt-1.5">
              <label className={`flex items-center gap-2 p-2.5 rounded-md border cursor-pointer ${format === "csv" ? "border-primary bg-primary/5" : "border-border"}`}>
                <RadioGroupItem value="csv" />
                <FileSpreadsheet className="w-4 h-4" />
                <div className="text-sm">CSV <span className="text-xs text-muted-foreground">(Excel/Sheets)</span></div>
              </label>
              <label className={`flex items-center gap-2 p-2.5 rounded-md border cursor-pointer ${format === "pdf" ? "border-primary bg-primary/5" : "border-border"}`}>
                <RadioGroupItem value="pdf" />
                <FileText className="w-4 h-4" />
                <div className="text-sm">PDF <span className="text-xs text-muted-foreground">(print-ready)</span></div>
              </label>
            </RadioGroup>
          </div>

          {/* Field selection */}
          <div>
            <div className="flex items-center justify-between">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Fields ({selected.size})</Label>
              <div className="flex gap-1">
                <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={selectAll}>All</Button>
                <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={reset}>Default</Button>
                <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelected(new Set())}>None</Button>
              </div>
            </div>
            <ScrollArea className="h-[240px] mt-1.5 rounded-md border border-border p-2">
              <div className="space-y-3">
                {Object.entries(groups).map(([group, items]) => {
                  const allOn = items.every((i) => selected.has(i.key));
                  return (
                    <div key={group}>
                      <button type="button" onClick={() => setGroup(group, !allOn)}
                        className="text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground mb-1">
                        {group} {allOn ? "· clear" : "· all"}
                      </button>
                      <div className="grid grid-cols-2 gap-1.5">
                        {items.map((f) => (
                          <label key={f.key} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-1.5 py-1">
                            <Checkbox checked={selected.has(f.key)} onCheckedChange={() => toggle(f.key)} />
                            <span>{f.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleExport} disabled={!exportRows.length || !selected.size || blocked} className="gap-1.5">
            <Download className="w-4 h-4" />Export {format.toUpperCase()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
