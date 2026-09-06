import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Plus, FileDown, Receipt as ReceiptIcon, Trash2, Search, Mail, Copy,
  Undo2, Repeat, Download, X, TrendingUp, DollarSign, Hash, CalendarDays, Eye,
} from "lucide-react";
import { fmtMoney, downloadDocPdf, computeTotals } from "@/lib/financialDocs";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip as RTooltip, CartesianGrid,
} from "recharts";
import { ReceiptPreviewDialog } from "@/components/receipts/ReceiptPreviewDialog";
import { ExportReceiptsDialog } from "@/components/receipts/ExportReceiptsDialog";

const sb = supabase as any;

type Receipt = any;

const METHODS = ["Cash", "Card", "Bank transfer", "Cheque", "Wire", "Other"];
const CURRENCIES = ["USD", "EUR", "GBP", "INR", "AED", "SGD", "AUD", "CAD"];
const RECURRENCES = [
  { value: "none", label: "Not recurring" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Every 2 weeks" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
];

const Receipts = () => {
  const qc = useQueryClient();

  // --- Create / edit dialog ---
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState("none");
  const [partnerId, setPartnerId] = useState("none");
  const [payer, setPayer] = useState("");
  const [email, setEmail] = useState("");
  const [method, setMethod] = useState("Cash");
  const [reference, setReference] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [amount, setAmount] = useState("");
  const [taxRate, setTaxRate] = useState("0");
  const [notes, setNotes] = useState("");
  const [recurrence, setRecurrence] = useState("none");
  const [invoiceId, setInvoiceId] = useState<string>("none");
  const [paymentId, setPaymentId] = useState<string>("none");

  // --- Filters ---
  const [search, setSearch] = useState("");
  const [filterMethod, setFilterMethod] = useState("all");
  const [filterCurrency, setFilterCurrency] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  // --- Selection / dialogs ---
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [refundOf, setRefundOf] = useState<Receipt | null>(null);
  const [refundAmt, setRefundAmt] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [previewReceipt, setPreviewReceipt] = useState<Receipt | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

  const { data: receipts = [], isLoading } = useQuery({
    queryKey: ["receipts"],
    queryFn: async () => {
      const { data, error } = await sb.from("receipts")
        .select("*, clients(company_name, contact_email, contact_phone, address), invoices(invoice_number)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["receipt-clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, company_name, partner_id");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: partners = [] } = useQuery({
    queryKey: ["receipt-partners"],
    queryFn: async () => {
      const { data, error } = await supabase.from("partners").select("id, company_name").order("company_name");
      if (error) throw error;
      return data || [];
    },
  });

  // Open invoices for auto-fill
  const { data: openInvoices = [] } = useQuery({
    queryKey: ["receipt-open-invoices"],
    queryFn: async () => {
      const { data, error } = await sb.from("invoices")
        .select("id, invoice_number, client_id, currency, total, amount_paid, balance_due, status, payment_method, clients(company_name, contact_email)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []).filter((i: any) => Number(i.balance_due ?? (Number(i.total) - Number(i.amount_paid || 0))) > 0.01);
    },
  });

  // Recent payment-received records (client_invoice_payments) for auto-fill
  const { data: paymentsReceived = [] } = useQuery({
    queryKey: ["receipt-payments-received"],
    queryFn: async () => {
      const { data, error } = await sb.from("client_invoice_payments")
        .select("id, amount, currency, paid_at, external_ref, status, invoice_id, client_id, payment_method_id, receipt_id, linked_at, clients(company_name, contact_email), client_payment_methods(label, brand, last4), customer_invoices(invoice_number)")
        .order("paid_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
  });

  const formatPaymentMethod = (pm: any): string => {
    if (!pm) return "";
    const parts = [pm.brand || pm.label, pm.last4 ? `•••• ${pm.last4}` : ""].filter(Boolean);
    return parts.join(" ").trim();
  };

  // Autofill on invoice select
  const applyInvoice = (id: string) => {
    setInvoiceId(id);
    if (id === "none") return;
    const inv = openInvoices.find((i: any) => i.id === id);
    if (!inv) return;
    const due = Number(inv.balance_due ?? (Number(inv.total) - Number(inv.amount_paid || 0)));
    if (inv.client_id) setClientId(inv.client_id);
    if (inv.clients?.company_name) setPayer(inv.clients.company_name);
    if (inv.clients?.contact_email) setEmail(inv.clients.contact_email);
    if (inv.currency) setCurrency(inv.currency);
    if (inv.payment_method) setMethod(inv.payment_method);
    setReference(`Invoice ${inv.invoice_number}`);
    setAmount(String(due > 0 ? due : inv.total));
    setTaxRate("0"); // already taxed on the invoice; receipt records the payment amount as-is
  };

  // Autofill from a payment-received record (pulls reference + amount + method)
  const applyPayment = (id: string) => {
    if (id === "none") { setPaymentId("none"); return; }
    const p: any = paymentsReceived.find((x: any) => x.id === id);
    if (!p) return;
    if (p.receipt_id) {
      toast.error("This payment is already linked to another receipt and can't be reused.");
      return;
    }
    setPaymentId(id);
    if (p.client_id) setClientId(p.client_id);
    if (p.clients?.company_name) setPayer(p.clients.company_name);
    if (p.clients?.contact_email) setEmail(p.clients.contact_email);
    if (p.currency) setCurrency(p.currency);
    if (p.amount) setAmount(String(p.amount));
    setTaxRate("0");
    const pmLabel = formatPaymentMethod(p.client_payment_methods);
    if (pmLabel) {
      // Map known brand to dropdown method when possible
      const lc = pmLabel.toLowerCase();
      if (lc.includes("card") || /visa|master|amex|discover/.test(lc)) setMethod("Card");
      else if (lc.includes("wire")) setMethod("Wire");
      else if (lc.includes("bank") || lc.includes("ach")) setMethod("Bank transfer");
      else if (lc.includes("cheque") || lc.includes("check")) setMethod("Cheque");
    }
    // Build a reference combining the external ref + payment method label + invoice #
    const refParts = [
      p.external_ref ? `Ref ${p.external_ref}` : null,
      pmLabel || null,
      p.customer_invoices?.invoice_number ? `Invoice ${p.customer_invoices.invoice_number}` : null,
    ].filter(Boolean);
    if (refParts.length) setReference(refParts.join(" · "));
  };


  const totals = useMemo(() => computeTotals({
    subtotal: Number(amount) || 0,
    tax_mode: "single",
    tax_rate: Number(taxRate) || 0,
  }), [amount, taxRate]);

  const reset = () => {
    setOpen(false); setClientId("none"); setPartnerId("none"); setPayer(""); setEmail(""); setMethod("Cash");
    setReference(""); setCurrency("USD"); setAmount(""); setTaxRate("0"); setNotes("");
    setRecurrence("none"); setInvoiceId("none"); setPaymentId("none");
  };

  const computeNextAt = (rec: string): Date | null => {
    if (!rec || rec === "none") return null;
    const d = new Date();
    const map: Record<string, () => void> = {
      weekly: () => d.setDate(d.getDate() + 7),
      biweekly: () => d.setDate(d.getDate() + 14),
      monthly: () => d.setMonth(d.getMonth() + 1),
      quarterly: () => d.setMonth(d.getMonth() + 3),
      yearly: () => d.setFullYear(d.getFullYear() + 1),
    };
    map[rec]?.();
    return d;
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const sub = Number(amount) || 0;
      if (sub <= 0) throw new Error("Enter an amount");

      // Hard guard: ensure the selected payment-received record isn't already linked
      if (paymentId !== "none") {
        const { data: pCheck, error: pErr } = await sb
          .from("client_invoice_payments")
          .select("receipt_id")
          .eq("id", paymentId)
          .maybeSingle();
        if (pErr) throw pErr;
        if (pCheck?.receipt_id) {
          throw new Error("That payment is already linked to another receipt. Pick a different one or clear the selection.");
        }
      }

      const next = computeNextAt(recurrence);
      const { data: inserted, error } = await sb.from("receipts").insert({
        kind: invoiceId !== "none" ? "invoice_payment" : "standalone",
        invoice_id: invoiceId !== "none" ? invoiceId : null,
        client_id: clientId === "none" ? null : clientId,
        payer_name: payer || null,
        payer_email: email || null,
        payment_method: method,
        payment_reference: reference || null,
        partner_id: partnerId === "none" ? null : partnerId,
        currency,
        subtotal: totals.subtotal,
        tax_mode: "single",
        tax_rate: Number(taxRate) || 0,
        tax_amount: totals.tax_amount,
        total: totals.total,
        amount_paid: totals.total,
        notes: notes || null,
        recurrence: recurrence === "none" ? null : recurrence,
        recurrence_active: recurrence !== "none",
        recurrence_next_at: next ? next.toISOString() : null,
      }).select("id").single();
      if (error) throw error;
      const newReceiptId = inserted?.id as string | undefined;

      // Sync invoice paid amount when linked
      if (invoiceId !== "none") {
        const inv = openInvoices.find((i: any) => i.id === invoiceId);
        if (inv) {
          const newPaid = Number(inv.amount_paid || 0) + totals.total;
          const newDue = Math.max(0, Number(inv.total) - newPaid);
          await sb.from("invoices").update({
            amount_paid: newPaid,
            balance_due: newDue,
            paid_at: newDue <= 0.01 ? new Date().toISOString() : inv.paid_at,
            status: newDue <= 0.01 ? "paid" : "partial",
            payment_method: method,
          }).eq("id", invoiceId);
        }
      }

      // Link the selected payment-received record to this receipt (only if still unlinked)
      if (paymentId !== "none" && newReceiptId) {
        const { data: linkRows, error: linkErr } = await sb
          .from("client_invoice_payments")
          .update({ receipt_id: newReceiptId, linked_at: new Date().toISOString() })
          .eq("id", paymentId)
          .is("receipt_id", null)
          .select("id");
        if (linkErr) console.warn("Failed to link payment:", linkErr.message);
        else if (!linkRows || linkRows.length === 0) {
          toast.warning("Payment was linked elsewhere just now — receipt was created but not linked to that payment.");
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["receipts"] });
      qc.invalidateQueries({ queryKey: ["receipt-open-invoices"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["receipt-payments-received"] });
      toast.success("Receipt created"); reset();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await sb.from("receipts").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_d, ids) => {
      qc.invalidateQueries({ queryKey: ["receipts"] });
      setSelected(new Set());
      toast.success(`Deleted ${ids.length} receipt${ids.length === 1 ? "" : "s"}`);
    },
  });

  const refundMutation = useMutation({
    mutationFn: async () => {
      if (!refundOf) return;
      const max = Number(refundOf.amount_paid || refundOf.total) - Number(refundOf.refunded_amount || 0);
      const amt = Number(refundAmt);
      if (!(amt > 0)) throw new Error("Enter a refund amount");
      if (amt > max + 0.001) throw new Error(`Max refundable is ${fmtMoney(max, refundOf.currency)}`);
      const newRefunded = Number(refundOf.refunded_amount || 0) + amt;
      const { error } = await sb.from("receipts").update({
        refunded_amount: newRefunded,
        refunded_at: new Date().toISOString(),
        refund_reason: refundReason || null,
      }).eq("id", refundOf.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["receipts"] });
      toast.success("Refund recorded");
      setRefundOf(null); setRefundAmt(""); setRefundReason("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const duplicateMutation = useMutation({
    mutationFn: async (r: Receipt) => {
      const { error } = await sb.from("receipts").insert({
        kind: "standalone",
        client_id: r.client_id,
        payer_name: r.payer_name,
        payer_email: r.payer_email,
        payment_method: r.payment_method,
        payment_reference: r.payment_reference,
        currency: r.currency,
        subtotal: r.subtotal,
        tax_mode: r.tax_mode,
        tax_rate: r.tax_rate,
        tax_amount: r.tax_amount,
        total: r.total,
        amount_paid: r.amount_paid,
        notes: r.notes,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["receipts"] }); toast.success("Duplicated"); },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleRecurringMutation = useMutation({
    mutationFn: async (r: Receipt) => {
      const active = !r.recurrence_active;
      const next = active ? computeNextAt(r.recurrence || "monthly") : null;
      const { error } = await sb.from("receipts").update({
        recurrence_active: active,
        recurrence: r.recurrence || (active ? "monthly" : null),
        recurrence_next_at: next ? next.toISOString() : null,
      }).eq("id", r.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["receipts"] }); toast.success("Schedule updated"); },
  });

  // ---------- Filtered list ----------
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const fromDate = from ? new Date(from).getTime() : 0;
    const toDate = to ? new Date(to).getTime() + 86400000 : Infinity;
    return receipts.filter((r: any) => {
      if (filterMethod !== "all" && r.payment_method !== filterMethod) return false;
      if (filterCurrency !== "all" && r.currency !== filterCurrency) return false;
      const refunded = Number(r.refunded_amount || 0);
      const paid = Number(r.amount_paid || r.total);
      const status = refunded <= 0 ? "paid" : refunded >= paid ? "refunded" : "partial";
      if (filterStatus !== "all" && status !== filterStatus) return false;
      const ts = new Date(r.paid_at || r.created_at).getTime();
      if (ts < fromDate || ts > toDate) return false;
      if (!q) return true;
      const hay = [
        r.receipt_number, r.payer_name, r.payer_email, r.payment_reference,
        r.clients?.company_name, r.invoices?.invoice_number, r.notes,
      ].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [receipts, search, filterMethod, filterCurrency, filterStatus, from, to]);

  // ---------- Stats ----------
  const stats = useMemo(() => {
    const count = filtered.length;
    const gross = filtered.reduce((s: number, r: any) => s + Number(r.amount_paid || r.total), 0);
    const refunded = filtered.reduce((s: number, r: any) => s + Number(r.refunded_amount || 0), 0);
    const net = gross - refunded;
    const avg = count ? net / count : 0;
    const byMethod: Record<string, number> = {};
    filtered.forEach((r: any) => {
      const m = r.payment_method || "Other";
      byMethod[m] = (byMethod[m] || 0) + Number(r.amount_paid || r.total);
    });
    const topMethod = Object.entries(byMethod).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";

    // 30-day trend
    const days: { date: string; total: number }[] = [];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today); d.setDate(today.getDate() - i);
      days.push({ date: d.toISOString().slice(5, 10), total: 0 });
    }
    filtered.forEach((r: any) => {
      const d = new Date(r.paid_at || r.created_at);
      const key = d.toISOString().slice(5, 10);
      const slot = days.find((x) => x.date === key);
      if (slot) slot.total += Number(r.amount_paid || r.total) - Number(r.refunded_amount || 0);
    });
    const primaryCcy = filtered[0]?.currency || "USD";
    return { count, gross, refunded, net, avg, topMethod, days, primaryCcy };
  }, [filtered]);

  // ---------- PDF / email helpers ----------
  const buildDocPayload = (r: Receipt) => ({
    kind: "receipt" as const,
    number: r.receipt_number,
    status: Number(r.refunded_amount || 0) > 0
      ? (Number(r.refunded_amount) >= Number(r.amount_paid || r.total) ? "Refunded" : "Partially Refunded")
      : "Paid",
    currency: r.currency || "USD",
    issued_at: r.created_at,
    paid_at: r.paid_at,
    subtotal: Number(r.subtotal),
    discount_percent: Number(r.discount_percent || 0),
    discount_amount: Number(r.discount_amount || 0),
    tax_mode: r.tax_mode || "single",
    tax1_label: r.tax1_label || "Tax",
    tax_rate: Number(r.tax_rate || 0),
    tax_amount: Number(r.tax_amount || 0),
    tax2_label: r.tax2_label || "Tax 2",
    tax2_rate: Number(r.tax2_rate || 0),
    tax2_amount: Number(r.tax2_amount || 0),
    total: Number(r.total),
    amount_paid: Number(r.amount_paid || r.total),
    payment_method: r.payment_method,
    payment_reference: r.payment_reference,
    notes: r.notes,
    branding: {
      logoUrl: r.branding_logo_url, primaryColor: r.branding_primary_color,
      accentColor: r.branding_accent_color, companyName: r.branding_company_name,
      footerText: r.branding_footer_text,
    },
    to: {
      name: r.payer_name || r.clients?.company_name,
      email: r.payer_email || r.clients?.contact_email,
      phone: r.clients?.contact_phone,
      address: r.clients?.address,
    },
    linkedRef: r.invoice_id && r.invoices?.invoice_number
      ? { kind: "invoice" as const, number: r.invoices.invoice_number } : null,
    payment_terms: "Thank you for your payment. This receipt confirms the amount has been received.",
    qr_payload: JSON.stringify({
      type: "receipt",
      number: r.receipt_number,
      amount: Number(r.amount_paid || r.total),
      currency: r.currency || "USD",
      invoice: r.invoices?.invoice_number || null,
      paid_at: r.paid_at || r.created_at,
    }),
  });

  const downloadPdf = async (r: Receipt) => {
    await downloadDocPdf(buildDocPayload(r), `Receipt_${r.receipt_number}.pdf`);
  };

  const openPreview = (r: Receipt) => setPreviewReceipt(r);

  // Export handled by ExportReceiptsDialog (CSV + PDF, field selection, filter+timestamp metadata)


  const allChecked = filtered.length > 0 && filtered.every((r: any) => selected.has(r.id));
  const someChecked = filtered.some((r: any) => selected.has(r.id));
  const toggleAll = () => {
    if (allChecked) setSelected(new Set());
    else setSelected(new Set(filtered.map((r: any) => r.id)));
  };
  const toggleOne = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const clearFilters = () => {
    setSearch(""); setFilterMethod("all"); setFilterCurrency("all");
    setFilterStatus("all"); setFrom(""); setTo("");
  };

  const hasFilters = search || filterMethod !== "all" || filterCurrency !== "all"
    || filterStatus !== "all" || from || to;

  return (
    <AppLayout title="Receipts" subtitle="Payment receipts (auto-generated and standalone)">
      <div className="space-y-5">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card><CardContent className="p-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground"><span>Net received</span><DollarSign className="w-3.5 h-3.5" /></div>
            <div className="text-xl font-bold mt-1 tabular-nums">{fmtMoney(stats.net, stats.primaryCcy)}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Gross {fmtMoney(stats.gross, stats.primaryCcy)} · Refunded {fmtMoney(stats.refunded, stats.primaryCcy)}</div>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground"><span>Receipts</span><Hash className="w-3.5 h-3.5" /></div>
            <div className="text-xl font-bold mt-1 tabular-nums">{stats.count}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">In current view</div>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground"><span>Average</span><TrendingUp className="w-3.5 h-3.5" /></div>
            <div className="text-xl font-bold mt-1 tabular-nums">{fmtMoney(stats.avg, stats.primaryCcy)}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Per receipt</div>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground"><span>Top method</span><CalendarDays className="w-3.5 h-3.5" /></div>
            <div className="text-xl font-bold mt-1">{stats.topMethod}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">By volume</div>
          </CardContent></Card>
        </div>

        {/* Trend chart */}
        <Card><CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold">30-day net receipts</div>
            <Badge variant="outline" className="text-[10px]">{stats.primaryCcy}</Badge>
          </div>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.days}>
                <defs>
                  <linearGradient id="rcptArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <RTooltip
                  contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", fontSize: 12 }}
                  formatter={(v: any) => fmtMoney(Number(v), stats.primaryCcy)}
                />
                <Area type="monotone" dataKey="total" stroke="hsl(var(--primary))" fill="url(#rcptArea)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent></Card>

        {/* Filters + actions */}
        <Card><CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search #, payer, reference, invoice…" className="pl-8 h-9" />
            </div>
            <Select value={filterMethod} onValueChange={setFilterMethod}>
              <SelectTrigger className="h-9 w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All methods</SelectItem>
                {METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterCurrency} onValueChange={setFilterCurrency}>
              <SelectTrigger className="h-9 w-[110px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All currencies</SelectItem>
                {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-9 w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="partial">Partial refund</SelectItem>
                <SelectItem value="refunded">Refunded</SelectItem>
              </SelectContent>
            </Select>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-[140px]" />
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-[140px]" />
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 gap-1 text-xs">
                <X className="w-3.5 h-3.5" />Clear
              </Button>
            )}
            <div className="flex-1" />
            <Button variant="outline" size="sm" onClick={() => setExportOpen(true)} className="h-9 gap-1.5">
              <Download className="w-3.5 h-3.5" />Export
            </Button>
            <Button onClick={() => setOpen(true)} size="sm" className="h-9 gap-1.5">
              <Plus className="w-4 h-4" />New
            </Button>
          </div>

          {/* Bulk action bar */}
          {selected.size > 0 && (
            <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-md border border-primary/30 bg-primary/5 text-sm">
              <Badge>{selected.size} selected</Badge>
              <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())} className="h-7 text-xs">
                Clear
              </Button>
              <div className="flex-1" />
              <Button variant="outline" size="sm" onClick={() => setExportOpen(true)} className="h-7 gap-1 text-xs">
                <Download className="w-3 h-3" />Export selected
              </Button>
              <Button variant="outline" size="sm" onClick={async () => {
                const rows = receipts.filter((r: any) => selected.has(r.id));
                for (const r of rows) await downloadPdf(r);
                toast.success(`Downloaded ${rows.length} PDFs`);
              }} className="h-7 gap-1 text-xs">
                <FileDown className="w-3 h-3" />Download PDFs
              </Button>
              <Button variant="destructive" size="sm" onClick={() => {
                if (confirm(`Delete ${selected.size} receipt(s)?`)) deleteMutation.mutate(Array.from(selected));
              }} className="h-7 gap-1 text-xs">
                <Trash2 className="w-3 h-3" />Delete
              </Button>
            </div>
          )}
        </CardContent></Card>

        {/* Create dialog */}
        <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); else setOpen(true); }}>
          <DialogContent className="max-w-xl">
            <DialogHeader><DialogTitle>New Receipt</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="flex items-center justify-between">
                  <span>Apply to invoice (optional)</span>
                  {invoiceId !== "none" && (
                    <button type="button" onClick={() => { setInvoiceId("none"); setReference(""); }}
                      className="text-xs text-muted-foreground hover:text-foreground">Clear link</button>
                  )}
                </Label>
                <Select value={invoiceId} onValueChange={applyInvoice}>
                  <SelectTrigger><SelectValue placeholder="Standalone receipt — no invoice" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Standalone — not linked</SelectItem>
                    {openInvoices.map((i: any) => {
                      const due = Number(i.balance_due ?? (Number(i.total) - Number(i.amount_paid || 0)));
                      return (
                        <SelectItem key={i.id} value={i.id}>
                          {i.invoice_number} · {i.clients?.company_name || "—"} · {fmtMoney(due, i.currency)} due
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                {invoiceId !== "none" && (
                  <p className="text-[11px] text-muted-foreground">
                    Payer, amount, currency &amp; reference auto-filled. Saving will mark the invoice paid/partial.
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <Label className="flex items-center justify-between">
                  <span>Pull from payment received (optional)</span>
                  {paymentId !== "none" && (
                    <button type="button" onClick={() => { setPaymentId("none"); setReference(""); }}
                      className="text-xs text-muted-foreground hover:text-foreground">Clear</button>
                  )}
                </Label>
                <Select value={paymentId} onValueChange={applyPayment}>
                  <SelectTrigger><SelectValue placeholder="None — enter reference manually" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None — enter reference manually</SelectItem>
                    {paymentsReceived.map((p: any) => {
                      const when = p.paid_at ? new Date(p.paid_at).toLocaleDateString() : "";
                      const pm = formatPaymentMethod(p.client_payment_methods);
                      const inv = p.customer_invoices?.invoice_number ? ` · Inv ${p.customer_invoices.invoice_number}` : "";
                      const ref = p.external_ref ? ` · ${p.external_ref}` : "";
                      const linked = !!p.receipt_id;
                      return (
                        <SelectItem key={p.id} value={p.id} disabled={linked && p.id !== paymentId}>
                          {linked ? "🔗 " : ""}{when} · {fmtMoney(Number(p.amount || 0), p.currency)} · {p.clients?.company_name || "—"}{inv}{ref}{pm ? ` · ${pm}` : ""}{linked ? " · linked" : ""}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                {paymentId !== "none" && (
                  <p className="text-[11px] text-muted-foreground">
                    Payment reference, amount &amp; method auto-filled from the selected payment record.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label>Client (optional)</Label>
                  <Select value={clientId} onValueChange={(value) => {
                    setClientId(value);
                    const client = clients.find((c: any) => c.id === value);
                    if (client?.partner_id && partnerId === "none") {
                      setPartnerId(client.partner_id);
                    }
                  }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Partner</Label>
                  <Select value={partnerId} onValueChange={setPartnerId}>
                    <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {partners.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.company_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Payer name</Label>
                  <Input value={payer} onChange={(e) => setPayer(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Email</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                <div className="space-y-1"><Label>Reference</Label>
                  <Input value={reference} onChange={(e) => setReference(e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1"><Label>Method</Label>
                  <Select value={method} onValueChange={setMethod}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label>Currency</Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label>Tax %</Label>
                  <Input type="number" min={0} step={0.01} value={taxRate} onChange={(e) => setTaxRate(e.target.value)} /></div>
              </div>
              <div className="space-y-1">
                <Label>Amount (subtotal)</Label>
                <Input type="number" min={0} step={0.01} value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Recurring schedule</Label>
                <Select value={recurrence} onValueChange={setRecurrence}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{RECURRENCES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="rounded-md bg-muted/30 p-2 text-sm flex justify-between">
                <span>Total (incl. tax)</span><span className="font-bold tabular-nums">{fmtMoney(totals.total, currency)}</span>
              </div>
              <div className="space-y-1"><Label>Notes</Label>
                <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={reset}>Cancel</Button>
                <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Saving…" : "Create Receipt"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Refund dialog */}
        <Dialog open={!!refundOf} onOpenChange={(o) => { if (!o) { setRefundOf(null); setRefundAmt(""); setRefundReason(""); } }}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Refund {refundOf?.receipt_number}</DialogTitle></DialogHeader>
            {refundOf && (
              <div className="space-y-3">
                <div className="rounded-md bg-muted/30 p-3 text-sm space-y-1">
                  <div className="flex justify-between"><span className="text-muted-foreground">Total paid</span><span className="font-medium tabular-nums">{fmtMoney(Number(refundOf.amount_paid || refundOf.total), refundOf.currency)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Already refunded</span><span className="font-medium tabular-nums">{fmtMoney(Number(refundOf.refunded_amount || 0), refundOf.currency)}</span></div>
                  <div className="flex justify-between border-t pt-1 mt-1"><span className="text-muted-foreground">Refundable</span><span className="font-bold tabular-nums">{fmtMoney(Number(refundOf.amount_paid || refundOf.total) - Number(refundOf.refunded_amount || 0), refundOf.currency)}</span></div>
                </div>
                <div className="space-y-1">
                  <Label>Refund amount ({refundOf.currency})</Label>
                  <Input type="number" min={0} step={0.01} value={refundAmt} onChange={(e) => setRefundAmt(e.target.value)} />
                  <button type="button" onClick={() => setRefundAmt(String(Number(refundOf.amount_paid || refundOf.total) - Number(refundOf.refunded_amount || 0)))}
                    className="text-xs text-primary hover:underline">Refund full remaining</button>
                </div>
                <div className="space-y-1">
                  <Label>Reason (optional)</Label>
                  <Textarea rows={2} value={refundReason} onChange={(e) => setRefundReason(e.target.value)} />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setRefundOf(null)}>Cancel</Button>
              <Button onClick={() => refundMutation.mutate()} disabled={refundMutation.isPending}>
                {refundMutation.isPending ? "Saving…" : "Record refund"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Table */}
        <Card><CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead><tr className="border-b border-border bg-muted/30">
                <th className="w-10 px-3 py-3">
                  <Checkbox checked={allChecked} ref={(el: any) => { if (el) el.indeterminate = !allChecked && someChecked; }}
                    onCheckedChange={toggleAll} />
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">Receipt #</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">Payer</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">Method</th>
                <th className="text-right px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">Amount</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">Date</th>
                <th className="text-right px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">Actions</th>
              </tr></thead>
              <tbody>
                {filtered.map((r: any) => {
                  const refunded = Number(r.refunded_amount || 0);
                  const paid = Number(r.amount_paid || r.total);
                  const status = refunded <= 0 ? "Paid" : refunded >= paid ? "Refunded" : "Partial refund";
                  const statusColor = status === "Paid" ? "bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/30"
                    : status === "Refunded" ? "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30"
                    : "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30";
                  return (
                    <tr key={r.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="px-3 py-3">
                        <Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggleOne(r.id)} />
                      </td>
                      <td className="px-4 py-3 font-mono font-medium">
                        {r.receipt_number}
                        {r.invoices?.invoice_number && <Badge variant="outline" className="ml-2 text-[10px]">{r.invoices.invoice_number}</Badge>}
                        {r.recurrence_active && (
                          <Badge variant="outline" className="ml-2 text-[10px] gap-0.5"><Repeat className="w-2.5 h-2.5" />{r.recurrence}</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={`text-[10px] ${statusColor}`}>{status}</Badge>
                        {refunded > 0 && (
                          <div className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">−{fmtMoney(refunded, r.currency || "USD")}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">{r.payer_name || r.clients?.company_name || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{r.payment_method || "—"}</td>
                      <td className="px-4 py-3 text-right font-bold tabular-nums">
                        {fmtMoney(paid - refunded, r.currency || "USD")}
                        {refunded > 0 && (
                          <div className="text-[10px] text-muted-foreground font-normal line-through">{fmtMoney(paid, r.currency || "USD")}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(r.paid_at || r.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-0.5">
                          <Button variant="ghost" size="sm" onClick={() => openPreview(r)} title="Preview / print / email" className="h-7 w-7 p-0"><Eye className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => downloadPdf(r)} title="Quick download PDF" className="h-7 w-7 p-0"><FileDown className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => duplicateMutation.mutate(r)} title="Duplicate" className="h-7 w-7 p-0"><Copy className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => { setRefundOf(r); setRefundAmt(""); setRefundReason(""); }}
                            title="Refund" disabled={refunded >= paid} className="h-7 w-7 p-0"><Undo2 className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => toggleRecurringMutation.mutate(r)}
                            title={r.recurrence_active ? "Stop recurrence" : "Make recurring (monthly)"}
                            className={`h-7 w-7 p-0 ${r.recurrence_active ? "text-primary" : ""}`}><Repeat className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => { if (confirm(`Delete ${r.receipt_number}?`)) deleteMutation.mutate([r.id]); }}
                            title="Delete" className="h-7 w-7 p-0 text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!isLoading && filtered.length === 0 && (
                  <tr><td colSpan={8} className="py-12 text-center text-muted-foreground">
                    <ReceiptIcon className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    {receipts.length === 0 ? "No receipts yet." : "No receipts match your filters."}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent></Card>

        <ReceiptPreviewDialog
          open={!!previewReceipt}
          onOpenChange={(o) => { if (!o) setPreviewReceipt(null); }}
          payload={previewReceipt ? buildDocPayload(previewReceipt) : null}
          fileName={previewReceipt ? `Receipt_${previewReceipt.receipt_number}.pdf` : "Receipt.pdf"}
          recipientEmail={previewReceipt?.payer_email || previewReceipt?.clients?.contact_email || null}
          recipientName={previewReceipt?.payer_name || previewReceipt?.clients?.company_name || null}
        />

        <ExportReceiptsDialog
          open={exportOpen}
          onOpenChange={setExportOpen}
          rows={filtered}
          selectedRows={receipts.filter((r: any) => selected.has(r.id))}
          filters={{ search, method: filterMethod, currency: filterCurrency, status: filterStatus, from, to }}
          primaryCurrency={stats.primaryCcy}
        />
      </div>
    </AppLayout>
  );
};

export default Receipts;
