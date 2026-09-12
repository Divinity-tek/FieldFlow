import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
// import AskAIButton from "@/components/ai/AskAIButton";
import { Plus, Receipt, DollarSign, Clock, CheckCircle, AlertTriangle, Send, Pencil, FileDown, Trash2, Link2, RefreshCw, QrCode, Printer, Keyboard } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useUserPreference } from "@/hooks/useUserPreference";
import { computeTotals, fmtMoney, downloadDocPdf, openDocPdf, openMultiDocPdf, generateDocPdfBlob, type TaxMode, type FinLineItem } from "@/lib/financialDocs";
import { Checkbox } from "@/components/ui/checkbox";
import { TAX_PRESETS, COMMON_TAX_RATES } from "@/lib/taxPresets";

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-500/10 text-blue-500",
  paid: "bg-green-500/10 text-green-500",
  overdue: "bg-destructive/10 text-destructive",
  cancelled: "bg-muted text-muted-foreground line-through",
};

const emptyLine = (): FinLineItem & { id: string } => ({
  id: crypto.randomUUID(),
  description: "",
  quantity: 1,
  unit_price: 0,
  total: 0,
  tax1_rate: 0,
  tax2_rate: 0,
});

const calculateDueDate = (baseDate: string, days: number): string => {
  if (!baseDate) return "";

  const [year, month, day] = baseDate.split("-").map(Number);

  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);

  const resultYear = date.getFullYear();
  const resultMonth = String(date.getMonth() + 1).padStart(2, "0");
  const resultDay = String(date.getDate()).padStart(2, "0");

  return `${resultYear}-${resultMonth}-${resultDay}`;
};

const CUSTOM_RATE = "__custom__";

const RateSelect = ({
  value,
  onChange,
  disabled,
}: { value: string; onChange: (v: string) => void; disabled?: boolean }) => {
  const numeric = Number(value);
  const isPreset = COMMON_TAX_RATES.includes(numeric) && value !== "" && value !== CUSTOM_RATE;
  const [custom, setCustom] = useState(!isPreset && value !== "" && Number(value) !== 0 ? true : false);

  if (custom) {
    return (
      <div className="flex gap-1">
        <Input
          type="number"
          min={0}
          step={0.01}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="h-9"
        />
        <Button type="button" variant="ghost" size="sm" className="h-9 px-2 text-xs"
          onClick={() => { setCustom(false); onChange("0"); }} disabled={disabled}>
          Preset
        </Button>
      </div>
    );
  }

  return (
    <Select
      value={isPreset ? String(numeric) : "0"}
      disabled={disabled}
      onValueChange={(v) => {
        if (v === CUSTOM_RATE) { setCustom(true); return; }
        onChange(v);
      }}
    >
      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
      <SelectContent className="max-h-72">
        {COMMON_TAX_RATES.map(r => (
          <SelectItem key={r} value={String(r)}>{r}%</SelectItem>
        ))}
        <SelectItem value={CUSTOM_RATE}>Custom…</SelectItem>
      </SelectContent>
    </Select>
  );
};

const Invoices = () => {
  const qc = useQueryClient();
  const [showEditor, setShowEditor] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [focusedInvoiceId, setFocusedInvoiceId] = useState<string | null>(null);
  const { value: invPageJump, update: setInvPageJump } = useUserPreference<number>("invoices_page_jump", 10);

  // Form state
  const [clientId, setClientId] = useState("");
  const [partnerId, setPartnerId] = useState<string>("none");
  const [title, setTitle] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [dueDate, setDueDate] = useState("");
  const [dueDays, setDueDays] = useState("30");
  const [purchaseOrderNumber, setPurchaseOrderNumber] = useState("");
  const [invoiceBaseDate, setInvoiceBaseDate] = useState("");
  const [taxEnabled, setTaxEnabled] = useState(true);
  const [taxMode, setTaxMode] = useState<TaxMode>("compound");
  const [tax1Label, setTax1Label] = useState("Tax");
  const [taxRate, setTaxRate] = useState("0");
  const [tax2Label, setTax2Label] = useState("Tax 2");
  const [tax2Rate, setTax2Rate] = useState("0");
  const [taxPreset, setTaxPreset] = useState<string>("none");
  const [discountPercent, setDiscountPercent] = useState("0");
  const [notes, setNotes] = useState("");
  const [lineItems, setLineItems] = useState<(FinLineItem & { id: string })[]>([emptyLine()]);
  const [estimateId, setEstimateId] = useState<string | null>(null);
  const [estimateLinkActive, setEstimateLinkActive] = useState(false);

  // QR preview/retry (for editor)
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [qrError, setQrError] = useState<string>("");
  const [qrLoading, setQrLoading] = useState(false);
  const [qrAttempt, setQrAttempt] = useState(0);
  // Logo embedding inside QR
  const [qrLogoUrl, setQrLogoUrl] = useState<string>("");
  const [qrLogoSize, setQrLogoSize] = useState<number>(20); // % of QR width (10–30)
  const [qrEcc, setQrEcc] = useState<"L" | "M" | "Q" | "H">("H");
  const [qrLogoBackdrop, setQrLogoBackdrop] = useState<boolean>(true);
  const [qrLogoPadding, setQrLogoPadding] = useState<number>(12); // % of logo width (0–30)
  const [qrLogoBackdropColor, setQrLogoBackdropColor] = useState<string>("#ffffff");
  const [qrLogoBackdropType, setQrLogoBackdropType] = useState<"solid" | "gradient">("solid");
  const [qrLogoBackdropColor2, setQrLogoBackdropColor2] = useState<string>("#e5e7eb");
  const [qrLogoBackdropAngle, setQrLogoBackdropAngle] = useState<number>(135); // degrees
  const [qrCleanDataUrl, setQrCleanDataUrl] = useState<string>(""); // logo-less reference for compare

  // Payment dialog
  const [payInvoice, setPayInvoice] = useState<any>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("Bank transfer");
  const [payRef, setPayRef] = useState("");

  const { data: invoices = [] } = useQuery({
    queryKey: ["invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select(`
          *,
          clients(company_name, contact_email, contact_phone, address),
          partners(
            company_name,
            contact_name,
            email,
            phone,
            address_line1,
            city,
            region,
            postcode,
            country,
            payment_account_name,
            payment_iban,
            payment_swift_bic,
            payment_bank_name_address
          ),
          estimates(estimate_number)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["invoice-clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, company_name, partner_id");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: partners = [] } = useQuery({
    queryKey: ["invoice-partners"],
    queryFn: async () => {
      const { data, error } = await supabase.from("partners").select("id, company_name").order("company_name");
      if (error) throw error;
      return data || [];
    },
  });

  // Estimates available for one-click invoice generation (exclude already-converted/rejected)
  const { data: convertibleEstimates = [] } = useQuery({
    queryKey: ["invoice-convertible-estimates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estimates")
        .select("id, estimate_number, title, total, currency, status, client_id, clients(company_name)")
        .in("status", ["draft", "sent", "approved"] as any)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
  });

  const subtotal = useMemo(
    () => lineItems.reduce((s, li) => s + (Number(li.quantity) || 0) * (Number(li.unit_price) || 0), 0),
    [lineItems]
  );

  const totals = useMemo(
    () => computeTotals({
      subtotal,
      discount_percent: Number(discountPercent) || 0,
      tax_mode: taxEnabled ? taxMode : "single",
      tax_rate: taxEnabled ? Number(taxRate) || 0 : 0,
      tax2_rate: taxEnabled ? Number(tax2Rate) || 0 : 0,
      lineItems: taxEnabled ? lineItems : lineItems.map(li => ({ ...li, tax1_rate: 0, tax2_rate: 0 })),
    }),
    [subtotal, discountPercent, taxEnabled, taxMode, taxRate, tax2Rate, lineItems]
  );

  // Validate the chosen Tax % combination against the selected Country/Region preset.
  // Tolerance allows minor rounding (e.g. 9.975 → 9.98) without false positives.
  // Estimated scanability for the embedded-logo QR. Coverage is approx area% the logo occupies;
  // ECC determines how much we can lose. Risk ≈ coverage / capacity.
  const qrScanability = useMemo(() => {
    const capacity = { L: 7, M: 15, Q: 25, H: 30 }[qrEcc];
    if (!qrLogoUrl) {
      return { level: "excellent" as const, label: "No logo — best scanability", color: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30", coverage: 0, capacity, hint: "" };
    }
    // Backdrop padding (when enabled) adds white area around the logo and counts toward coverage.
    const padFactor = qrLogoBackdrop ? 1 + (Math.min(30, Math.max(0, qrLogoPadding)) * 2) / 100 : 1;
    const effective = Math.min(30, Math.max(10, qrLogoSize)) * padFactor;
    const coverage = +(effective * effective / 100).toFixed(1); // approx % of QR area
    const ratio = coverage / capacity;
    if (ratio <= 0.55) return { level: "excellent" as const, label: "Excellent — scans on any reader", color: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30", coverage, capacity, hint: "" };
    if (ratio <= 0.85) return { level: "good"      as const, label: "Good — most readers OK",          color: "bg-sky-500/15 text-sky-600 border-sky-500/30",          coverage, capacity, hint: "Test scan on a phone before printing." };
    if (ratio <= 1.05) return { level: "marginal"  as const, label: "Marginal — may fail on tilt/blur", color: "bg-amber-500/15 text-amber-700 border-amber-500/30",     coverage, capacity, hint: qrEcc !== "H" ? "Bump ECC to H or shrink the logo." : "Shrink the logo below 22%." };
    return                  { level: "risky"     as const, label: "Risky — likely to fail",          color: "bg-destructive/15 text-destructive border-destructive/40", coverage, capacity, hint: qrEcc !== "H" ? "Use ECC H and reduce logo size." : "Reduce logo size to ≤20%." };
  }, [qrLogoUrl, qrLogoSize, qrEcc, qrLogoBackdrop, qrLogoPadding]);

  // Iteratively adjust ECC, logo size, and padding until the scanability ratio
  // (coverage / capacity) lands in the Excellent band (≤ 0.55). Mirrors the live
  // meter formula so the result matches what the user sees.
  const autoTuneQr = () => {
    if (!qrLogoUrl) {
      setQrEcc("M");
      setQrLogoBackdrop(true);
      setQrLogoPadding(12);
      setQrLogoSize(20);
      toast.success("Tuned: no logo — ECC M");
      return;
    }
    const TARGET = 0.55; // Excellent band
    const CAPACITY = { L: 7, M: 15, Q: 25, H: 30 } as const;
    const eccLadder: Array<keyof typeof CAPACITY> = ["M", "Q", "H"]; // start from current or M, climb
    const ratioFor = (ecc: keyof typeof CAPACITY, size: number, pad: number, backdrop: boolean) => {
      const padFactor = backdrop ? 1 + (Math.min(30, Math.max(0, pad)) * 2) / 100 : 1;
      const eff = Math.min(30, Math.max(10, size)) * padFactor;
      const coverage = (eff * eff) / 100;
      return coverage / CAPACITY[ecc];
    };

    // Start from current settings, ensure backdrop is on for branding/contrast.
    let ecc: keyof typeof CAPACITY = (qrEcc === "L" ? "M" : qrEcc) as any;
    let size = Math.min(30, Math.max(10, qrLogoSize));
    let pad = Math.min(30, Math.max(0, qrLogoPadding));
    const backdrop = true;

    // Step 1: try lowering padding first (keeps brand frame visible).
    let guard = 0;
    while (ratioFor(ecc, size, pad, backdrop) > TARGET && pad > 6 && guard++ < 30) pad -= 1;
    // Step 2: climb ECC ladder if still over target.
    while (ratioFor(ecc, size, pad, backdrop) > TARGET && eccLadder.indexOf(ecc) < eccLadder.length - 1) {
      ecc = eccLadder[eccLadder.indexOf(ecc) + 1];
    }
    // Step 3: shrink logo size 1% at a time down to the 10% floor.
    guard = 0;
    while (ratioFor(ecc, size, pad, backdrop) > TARGET && size > 10 && guard++ < 30) size -= 1;
    // Step 4: as a last resort, drop padding to 0.
    while (ratioFor(ecc, size, pad, backdrop) > TARGET && pad > 0) pad -= 1;

    const finalRatio = ratioFor(ecc, size, pad, backdrop);
    setQrEcc(ecc);
    setQrLogoBackdrop(true);
    setQrLogoPadding(pad);
    setQrLogoSize(size);
    if (finalRatio <= TARGET) {
      toast.success(`Tuned to Excellent: ECC ${ecc}, logo ${size}%, pad ${pad}%`);
    } else {
      toast.warning(`Best achievable: ECC ${ecc}, logo ${size}%, pad ${pad}% — consider a smaller logo`);
    }
  };

  // Validate the chosen Tax % combination against the selected Country/Region preset.
  // Tolerance allows minor rounding (e.g. 9.975 → 9.98) without false positives.
  const taxValidation = useMemo(() => {
    if (!taxEnabled || taxPreset === "none") return { ok: true as const, errors: [] as string[] };
    const preset = TAX_PRESETS.find((p) => p.id === taxPreset);
    if (!preset) return { ok: true as const, errors: [] as string[] };
    const errors: string[] = [];
    const t1 = Number(taxRate);
    const t2 = Number(tax2Rate);
    const tol = 0.01;

    if (taxMode !== preset.mode) {
      errors.push(`Tax mode "${taxMode}" doesn't match the "${preset.label}" preset (expects "${preset.mode}").`);
    }
    if (Number.isNaN(t1) || t1 < 0 || t1 > 100) {
      errors.push(`${preset.tax1_label} rate must be between 0% and 100%.`);
    } else if (Math.abs(t1 - preset.tax1_rate) > tol) {
      errors.push(`${preset.tax1_label} should be ${preset.tax1_rate}% for "${preset.label}" — got ${t1}%.`);
    }
    if (preset.mode !== "single" && preset.mode !== "per_line") {
      const expected2 = preset.tax2_rate ?? 0;
      if (Number.isNaN(t2) || t2 < 0 || t2 > 100) {
        errors.push(`${preset.tax2_label || "Tax 2"} rate must be between 0% and 100%.`);
      } else if (Math.abs(t2 - expected2) > tol) {
        errors.push(`${preset.tax2_label || "Tax 2"} should be ${expected2}% for "${preset.label}" — got ${t2}%.`);
      }
    }
    return { ok: errors.length === 0, errors };
  }, [taxEnabled, taxPreset, taxMode, taxRate, tax2Rate]);

  // Live QR preview in the editor — also surfaces failures so users can retry
  const qrPayload = useMemo(() => JSON.stringify({
    type: "invoice",
    number: editingId ? editingId.slice(0, 8) : "DRAFT",
    total: totals.total,
    currency,
    balance: totals.total,
    due: dueDate || null,
  }), [editingId, totals.total, currency, dueDate]);

  useEffect(() => {
    if (!showEditor) return;
    let cancelled = false;
    setQrLoading(true);
    setQrError("");
    (async () => {
      try {
        const QR: any = await import("qrcode");
        const toCanvas = (QR.default ?? QR)?.toCanvas;
        const toDataURL = (QR.default ?? QR)?.toDataURL;
        if (typeof toCanvas !== "function" || typeof toDataURL !== "function") {
          throw new Error("QR library not available");
        }
        const size = 320;
        const canvas = document.createElement("canvas");
        await new Promise<void>((res, rej) =>
          toCanvas(canvas, qrPayload, { errorCorrectionLevel: qrEcc, margin: 1, width: size },
            (err: any) => err ? rej(err) : res())
        );
        if (qrLogoUrl) {
          await new Promise<void>((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
              const ctx = canvas.getContext("2d");
              if (!ctx) return reject(new Error("Canvas 2D context unavailable"));
              const pct = Math.min(30, Math.max(10, qrLogoSize)) / 100;
              const lw = Math.round(size * pct);
              const lx = Math.round((size - lw) / 2);
              const padPct = Math.min(30, Math.max(0, qrLogoPadding)) / 100;
              const pad = Math.round(lw * padPct);
              if (qrLogoBackdrop) {
                const x = lx - pad, y = lx - pad, w = lw + pad * 2, h = lw + pad * 2;
                if (qrLogoBackdropType === "gradient") {
                  const rad = ((qrLogoBackdropAngle % 360) * Math.PI) / 180;
                  const cx = x + w / 2, cy = y + h / 2;
                  const half = Math.hypot(w, h) / 2;
                  const dx = Math.cos(rad) * half, dy = Math.sin(rad) * half;
                  const g = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
                  g.addColorStop(0, qrLogoBackdropColor || "#ffffff");
                  g.addColorStop(1, qrLogoBackdropColor2 || "#ffffff");
                  ctx.fillStyle = g;
                } else {
                  ctx.fillStyle = qrLogoBackdropColor || "#ffffff";
                }
                ctx.fillRect(x, y, w, h);
              }
              ctx.drawImage(img, lx, lx, lw, lw);
              resolve();
            };
            img.onerror = () => reject(new Error("Logo image failed to load (check URL/CORS)"));
            img.src = qrLogoUrl;
          });
        }
        const url = canvas.toDataURL("image/png");
        // Always render a clean (logo-less) reference at the same ECC for comparison
        const cleanUrl: string = await toDataURL(qrPayload, { errorCorrectionLevel: qrEcc, margin: 1, width: size });
        if (!cancelled) { setQrDataUrl(url); setQrCleanDataUrl(cleanUrl); setQrError(""); }
      } catch (e: any) {
        if (!cancelled) { setQrDataUrl(""); setQrError(e?.message || "QR generation failed"); }
      } finally {
        if (!cancelled) setQrLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [showEditor, qrPayload, qrAttempt, qrLogoUrl, qrLogoSize, qrEcc, qrLogoBackdrop, qrLogoPadding, qrLogoBackdropColor, qrLogoBackdropType, qrLogoBackdropColor2, qrLogoBackdropAngle]);

  const generateInvoiceNumber = () => {
    const d = new Date();
    return `INV-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}-${String(invoices.length + 1).padStart(4, "0")}`;
  };

  const resetForm = () => {
    setShowEditor(false);
    setEditingId(null);
    setClientId(""); setPartnerId("none"); setTitle(""); setCurrency("USD");
    const today = new Date();

    const todayYear = today.getFullYear();
    const todayMonth = String(today.getMonth() + 1).padStart(2, "0");
    const todayDay = String(today.getDate()).padStart(2, "0");

    const todayInput = `${todayYear}-${todayMonth}-${todayDay}`;

    setInvoiceBaseDate(todayInput);
    setDueDays("30");
    setDueDate(calculateDueDate(todayInput, 30));
    setPurchaseOrderNumber("");
    setTaxEnabled(true);
    setTaxMode("compound"); setTax1Label("Tax"); setTaxRate("0"); setTax2Label("Tax 2"); setTax2Rate("0"); setTaxPreset("none");
    setDiscountPercent("0"); setNotes(""); setLineItems([emptyLine()]);
    setEstimateId(null); setEstimateLinkActive(false);
  };

  const openEdit = async (inv: any) => {
    setEditingId(inv.id);
    setClientId(inv.client_id);
    setPartnerId(inv.partner_id || "none");
    setTitle(inv.title || "");
    setCurrency(inv.currency || "USD");
    setPurchaseOrderNumber(inv.purchase_order_number || "");

    const invoiceDate = inv.created_at
      ? new Date(inv.created_at)
      : new Date();

    const invoiceDateOnly = new Date(
      invoiceDate.getFullYear(),
      invoiceDate.getMonth(),
      invoiceDate.getDate()
    );

    const invoiceDateInput = [
      invoiceDateOnly.getFullYear(),
      String(invoiceDateOnly.getMonth() + 1).padStart(2, "0"),
      String(invoiceDateOnly.getDate()).padStart(2, "0"),
    ].join("-");

    setInvoiceBaseDate(invoiceDateInput);

    if (inv.due_date) {
      const [year, month, day] = inv.due_date.split("-").map(Number);

      const dueDateValue = new Date(year, month - 1, day);

      const differenceInDays = Math.round(
        (dueDateValue.getTime() - invoiceDateOnly.getTime()) /
          (1000 * 60 * 60 * 24)
      );

      const standardTerms = ["0", "7", "10", "15", "30", "45", "60"];

      if (standardTerms.includes(String(differenceInDays))) {
        setDueDays(String(differenceInDays));
      } else {
        setDueDays("custom");
      }

      setDueDate(inv.due_date);
    } else {
      setDueDays("0");
      setDueDate("");
    }
    setTaxMode((inv.tax_mode || "compound") as TaxMode);
    setTax1Label(inv.tax1_label || "Tax");
    setTaxRate(String(inv.tax_rate ?? 0));
    setTax2Label(inv.tax2_label || "Tax 2");
    setTax2Rate(String(inv.tax2_rate ?? 0));
    setTaxPreset(inv.tax_preset || "none");
    // Prefer the persisted flag; fall back to inferring from amounts/rates for legacy invoices
    if (typeof inv.tax_enabled === "boolean") {
      setTaxEnabled(inv.tax_enabled);
    } else {
      const hasAnyTax = Number(inv.tax_amount || 0) > 0 || Number(inv.tax2_amount || 0) > 0
        || Number(inv.tax_rate || 0) > 0 || Number(inv.tax2_rate || 0) > 0;
      setTaxEnabled(hasAnyTax);
    }
    setDiscountPercent(String(inv.discount_percent ?? 0));
    setNotes(inv.notes || "");
    setEstimateId(inv.estimate_id || null);
    setEstimateLinkActive(!!inv.estimate_link_active);
    const { data: items } = await supabase
      .from("invoice_line_items").select("*").eq("invoice_id", inv.id).order("sort_order");
    setLineItems(
      (items && items.length ? items : []).map((it: any) => ({
        id: it.id, description: it.description, quantity: Number(it.quantity), unit_price: Number(it.unit_price),
        total: Number(it.total), tax1_rate: Number(it.tax1_rate || 0), tax2_rate: Number(it.tax2_rate || 0),
      }))
    );
    if (!items || items.length === 0) setLineItems([emptyLine()]);
    setShowEditor(true);
  };

  const upsertMutation = useMutation({
    mutationFn: async () => {
      if (!clientId) throw new Error("Select a client");
      const visibleItems = lineItems.filter((li) => li.description.trim());
      if (!visibleItems.length) throw new Error("Add at least one line item");

      const payload: any = {
        client_id: clientId,
        partner_id: partnerId === "none" ? null : partnerId,
        title: title.trim() || null,
        currency,
        due_date: dueDate || null,
        purchase_order_number: purchaseOrderNumber.trim() || null,
        subtotal: totals.subtotal,
        discount_percent: Number(discountPercent) || 0,
        discount_amount: totals.discount_amount,
        tax_mode: taxEnabled ? taxMode : "single",
        tax1_label: tax1Label.trim() || "Tax",
        tax_rate: taxEnabled ? Number(taxRate) || 0 : 0,
        tax_amount: totals.tax_amount,
        tax2_label: tax2Label.trim() || "Tax 2",
        tax2_rate: taxEnabled ? Number(tax2Rate) || 0 : 0,
        tax2_amount: totals.tax2_amount,
        total: totals.total,
        notes: notes.trim() || null,
        tax_enabled: taxEnabled,
        tax_preset: taxPreset === "none" ? null : taxPreset,
      };

      let id = editingId;
      if (editingId) {
        const { error } = await supabase.from("invoices").update(payload).eq("id", editingId);
        if (error) throw error;
        await supabase.from("invoice_line_items").delete().eq("invoice_id", editingId);
      } else {
        const { data, error } = await supabase
          .from("invoices").insert({ ...payload, invoice_number: generateInvoiceNumber() })
          .select().single();
        if (error) throw error;
        id = data.id;
      }
      const items = visibleItems.map((li, i) => ({
        invoice_id: id!,
        description: li.description.trim().slice(0, 500),
        quantity: Number(li.quantity) || 0,
        unit_price: Number(li.unit_price) || 0,
        total: (Number(li.quantity) || 0) * (Number(li.unit_price) || 0),
        tax1_rate: Number(li.tax1_rate) || 0,
        tax2_rate: Number(li.tax2_rate) || 0,
        sort_order: i,
      }));
      const { error: liErr } = await supabase.from("invoice_line_items").insert(items);
      if (liErr) throw liErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      toast.success(editingId ? "Invoice updated" : "Invoice created");
      resetForm();
    },
    onError: (e: any) => toast.error(e.message || "Failed to save invoice"),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const update: any = { status };
      if (status === "paid") update.paid_at = new Date().toISOString();
      const { error } = await supabase.from("invoices").update(update).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["invoices"] }); toast.success("Status updated"); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("invoices").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["invoices"] }); toast.success("Invoice deleted"); },
    onError: (e: any) => toast.error(e.message),
  });

  // Generate a new invoice from an existing estimate via the SQL RPC.
  const [estimateToConvertId, setEstimateToConvertId] = useState<string>("");
  const [showConvertPreview, setShowConvertPreview] = useState(false);

  // Fetch full preview data (partner, client, line items) for the picked estimate.
  const { data: convertPreview, isLoading: convertPreviewLoading } = useQuery({
    queryKey: ["invoice-convert-preview", estimateToConvertId],
    enabled: !!estimateToConvertId && showConvertPreview,
    queryFn: async () => {
      const { data: est, error } = await supabase
        .from("estimates")
        .select("*, clients(company_name, contact_name, email, phone, address_line1, city, region, postcode, country), partners(company_name, contact_name, email, phone, address_line1, city, region, postcode, country)")
        .eq("id", estimateToConvertId)
        .single();
      if (error) throw error;
      const { data: items } = await supabase
        .from("estimate_line_items")
        .select("*")
        .eq("estimate_id", estimateToConvertId)
        .order("sort_order");
      return { est, items: items || [] };
    },
  });

  const convertEstimateMutation = useMutation({
    mutationFn: async (estimateId: string) => {
      if (!estimateId) throw new Error("Pick an estimate first");
      const { data, error } = await (supabase as any).rpc("convert_estimate_to_invoice", {
        _estimate_id: estimateId,
        _keep_linked: true,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["invoice-convertible-estimates"] });
      setEstimateToConvertId("");
      setShowConvertPreview(false);
      toast.success("Invoice generated from estimate");
    },
    onError: (e: any) => toast.error(e.message || "Failed to generate invoice"),
  });

  const syncFromEstimateMutation = useMutation({
    mutationFn: async (inv: any) => {
      if (!inv.estimate_id) throw new Error("Invoice is not linked to an estimate");
      if (!inv.estimate_link_active) throw new Error("Link is inactive — re-enable from edit dialog");
      const { data: est, error: eErr } = await supabase
        .from("estimates").select("*").eq("id", inv.estimate_id).single();
      if (eErr) throw eErr;
      const { data: srcItems } = await supabase
        .from("estimate_line_items").select("*").eq("estimate_id", inv.estimate_id).order("sort_order");

      const { error: updErr } = await supabase.from("invoices").update({
        title: est.title, currency: est.currency,
        subtotal: est.subtotal, discount_percent: est.discount_percent,
        discount_amount: est.discount_amount,
        tax_mode: est.tax_mode, tax1_label: est.tax1_label,
        tax_rate: est.tax_rate, tax_amount: est.tax_amount,
        tax2_label: est.tax2_label, tax2_rate: est.tax2_rate, tax2_amount: est.tax2_amount,
        total: est.total, notes: est.notes,
        dispatch_nbd_tm: est.dispatch_nbd_tm, dispatch_sbd_tm: (est as any).dispatch_sbd_tm, dispatch_hourly: est.dispatch_hourly,
        dispatch_half_day: est.dispatch_half_day, dispatch_full_day: est.dispatch_full_day,
        dispatch_sbd_hourly: (est as any).dispatch_sbd_hourly,
        dispatch_sbd_half_day: (est as any).dispatch_sbd_half_day,
        dispatch_sbd_full_day: (est as any).dispatch_sbd_full_day,
        dispatch_remarks: est.dispatch_remarks,
      }).eq("id", inv.id);
      if (updErr) throw updErr;
      await supabase.from("invoice_line_items").delete().eq("invoice_id", inv.id);
      if (srcItems?.length) {
        await supabase.from("invoice_line_items").insert(srcItems.map((it: any, i: number) => ({
          invoice_id: inv.id, description: it.description,
          quantity: it.quantity, unit_price: it.unit_price, total: it.total,
          tax1_rate: it.tax1_rate || 0, tax2_rate: it.tax2_rate || 0, sort_order: i,
        })));
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Invoice synced from source estimate");
    },
    onError: (e: any) => toast.error(e.message || "Sync failed"),
  });

  const recordPaymentMutation = useMutation({
    mutationFn: async () => {
      if (!payInvoice) throw new Error("No invoice selected");
      const amt = Math.max(0, Number(payAmount) || 0);
      if (amt <= 0) throw new Error("Enter a payment amount");
      const newPaid = Math.min(Number(payInvoice.total), Number(payInvoice.amount_paid || 0) + amt);
      const isFull = newPaid >= Number(payInvoice.total);
      const { error: updErr } = await supabase.from("invoices").update({
        amount_paid: newPaid,
        status: isFull ? "paid" : payInvoice.status,
        paid_at: isFull ? new Date().toISOString() : payInvoice.paid_at,
      }).eq("id", payInvoice.id);
      if (updErr) throw updErr;

      // Create receipt
      const { data: rec, error: rErr } = await (supabase as any).from("receipts").insert({
        kind: "invoice_payment" as const,
        invoice_id: payInvoice.id,
        client_id: payInvoice.client_id,
        partner_id: payInvoice.partner_id,
        payer_name: payInvoice.clients?.company_name || null,
        payer_email: payInvoice.clients?.contact_email || null,
        payment_method: payMethod || null,
        payment_reference: payRef || null,
        currency: payInvoice.currency || "USD",
        subtotal: payInvoice.subtotal,
        tax_mode: payInvoice.tax_mode || "single",
        tax1_label: payInvoice.tax1_label || "Tax",
        tax_rate: payInvoice.tax_rate || 0,
        tax_amount: payInvoice.tax_amount || 0,
        tax2_label: payInvoice.tax2_label || "Tax 2",
        tax2_rate: payInvoice.tax2_rate || 0,
        tax2_amount: payInvoice.tax2_amount || 0,
        discount_percent: payInvoice.discount_percent || 0,
        discount_amount: payInvoice.discount_amount || 0,
        total: payInvoice.total,
        amount_paid: amt,
        notes: `Payment for invoice ${payInvoice.invoice_number}`,
        branding_logo_url: payInvoice.branding_logo_url,
        branding_primary_color: payInvoice.branding_primary_color,
        branding_accent_color: payInvoice.branding_accent_color,
        branding_company_name: payInvoice.branding_company_name,
        branding_footer_text: payInvoice.branding_footer_text,
      }).select().single();
      if (rErr) throw rErr;
      return rec;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["receipts"] });
      toast.success("Payment recorded — receipt created");
      setPayInvoice(null); setPayAmount(""); setPayMethod("Bank transfer"); setPayRef("");
    },
    onError: (e: any) => toast.error(e.message || "Failed to record payment"),
  });

  // Update client → auto fill partner
  useEffect(() => {
    if (!clientId) return;
    const c = clients.find((x: any) => x.id === clientId);
    if (c?.partner_id && partnerId === "none") setPartnerId(c.partner_id);
  }, [clientId, clients]); // eslint-disable-line

  // Stats
  const totalOutstanding = invoices
    .filter((i: any) => ["sent", "overdue"].includes(i.status))
    .reduce((s: number, i: any) => s + Number(i.balance_due ?? i.total), 0);
  const totalPaid = invoices.reduce((s: number, i: any) => s + Number(i.amount_paid || 0), 0);
  const overdueCount = invoices.filter((i: any) => i.status === "overdue").length;
  
  const queryClient = useQueryClient();

  async function blobToBase64(blob: Blob): Promise<string> {
    const buffer = await blob.arrayBuffer();

    let binary = "";
    const bytes = new Uint8Array(buffer);

    const chunkSize = 0x8000;

    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }

    return btoa(binary);
  }

  const sendInvoice = async (inv: any) => {
    const clientEmail = inv.clients?.contact_email;
    const partnerEmail = inv.partners?.email;
    const partnerName = inv.partners?.company_name;

    if (!clientEmail) {
      toast.error("Client email is not available for this invoice.");
      return;
    }

    if (!partnerEmail) {
      toast.error("Partner email is not available for this invoice.");
      return;
    }

    try {
      toast.loading("Preparing invoice...", {
        id: `send-invoice-${inv.id}`,
      });

      // 1. Build the same invoice document used for PDF/Print
      const docInput = await buildInvoiceDoc(inv);

      // 2. Generate an actual PDF Blob
      const pdfBlob = await generateDocPdfBlob(docInput);

      // 3. Convert PDF to Base64
      const pdfBase64 = await blobToBase64(pdfBlob);

      toast.loading("Sending invoice...", {
        id: `send-invoice-${inv.id}`,
      });

      // 4. Send PDF through Supabase Edge Function
      const { data, error } = await supabase.functions.invoke(
        "send-invoice",
        {
          body: {
            to: clientEmail,
            from: partnerName
            ? `${partnerName} <${partnerEmail}>`
            : partnerEmail,
            clientName: inv.clients?.company_name,
            invoiceNumber: inv.invoice_number,
            fileName: `Invoice_${inv.invoice_number}.pdf`,
            pdfBase64,
          },
        }
      );

      if (error) {
        throw error;
      }

      if (!data?.success) {
        throw new Error(
          data?.error || "Failed to send invoice email"
        );
      }

      // 5. Email was successfully sent.
      // Only NOW mark invoice as sent.
      const { error: updateError } = await supabase
        .from("invoices")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
        })
        .eq("id", inv.id);

      if (updateError) {
        throw updateError;
      }

      toast.success(`Invoice sent to ${clientEmail}`, {
        id: `send-invoice-${inv.id}`,
      });

      // Refresh invoice list
      queryClient.invalidateQueries({
        queryKey: ["invoices"],
      });
    } catch (error) {
      console.error("Send invoice failed:", error);

      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to send invoice",
        {
          id: `send-invoice-${inv.id}`,
        }
      );
    }
  };

  const buildInvoiceDoc = async (inv: any) => {
    const { data: items, error: itemsErr } = await supabase
      .from("invoice_line_items").select("*").eq("invoice_id", inv.id).order("sort_order");
    if (itemsErr) throw new Error(`Could not load line items: ${itemsErr.message}`);
    if (!Number.isFinite(Number(inv.total))) throw new Error("Invoice total is invalid.");
    return {
      kind: "invoice" as const,
      number: inv.invoice_number,
      status: inv.status,
      title: inv.title,
      currency: inv.currency || "USD",
      issued_at: inv.created_at,
      due_date: inv.due_date,
      purchase_order_number: inv.purchase_order_number,
      paid_at: inv.paid_at,
      subtotal: Number(inv.subtotal),
      discount_percent: Number(inv.discount_percent || 0),
      discount_amount: Number(inv.discount_amount || 0),
      tax_mode: (inv.tax_mode || "single") as TaxMode,
      tax1_label: inv.tax1_label || "Tax",
      tax_rate: Number(inv.tax_rate || 0),
      tax_amount: Number(inv.tax_amount || 0),
      tax2_label: inv.tax2_label || "Tax 2",
      tax2_rate: Number(inv.tax2_rate || 0),
      tax2_amount: Number(inv.tax2_amount || 0),
      total: Number(inv.total),
      amount_paid: Number(inv.amount_paid || 0),
      balance_due: Number(inv.balance_due ?? (inv.total - (inv.amount_paid || 0))),
      lineItems: (items || []) as any,
      notes: inv.notes,
      signature_data: inv.signature_data,
      signed_at: inv.signed_at,
      signed_by: inv.signed_by,
      dispatch: {
        nbd_tm: inv.dispatch_nbd_tm, sbd_tm: inv.dispatch_sbd_tm, hourly: inv.dispatch_hourly,
        half_day: inv.dispatch_half_day, full_day: inv.dispatch_full_day,
        sbd_hourly: inv.dispatch_sbd_hourly, sbd_half_day: inv.dispatch_sbd_half_day, sbd_full_day: inv.dispatch_sbd_full_day,
        remarks: inv.dispatch_remarks,
      },
      branding: {
        logoUrl: inv.branding_logo_url,
        primaryColor: inv.branding_primary_color,
        accentColor: inv.branding_accent_color,
        companyName: inv.branding_company_name,
        footerText: inv.branding_footer_text,
      },
      from: inv.partners ? {
        name: inv.partners.company_name || inv.branding_company_name || undefined,
        email: inv.partners.email || undefined,
        phone: inv.partners.phone || undefined,
        address: [
          inv.partners.contact_name,
          inv.partners.address_line1,
          [inv.partners.city, inv.partners.region, inv.partners.postcode].filter(Boolean).join(", "),
          inv.partners.country,
        ].filter(Boolean).join("\n") || undefined,
      } : (inv.branding_company_name ? { name: inv.branding_company_name } : undefined),
      to: {
        name: inv.clients?.company_name,
        email: inv.clients?.contact_email,
        phone: inv.clients?.contact_phone,
        address: inv.clients?.address,
      },
      linkedRef: inv.estimate_id && inv.estimates?.estimate_number
        ? { kind: "estimate" as const, number: inv.estimates.estimate_number } : null,
      payment_terms: inv.due_date
        ? `Payment due by ${new Date(inv.due_date).toLocaleDateString()}. Late payments may incur interest as per agreement.`
        : "Payment due upon receipt.",
      payment_details: inv.partners
        ? {
            account_name: inv.partners.payment_account_name || null,
            iban: inv.partners.payment_iban || null,
            swift_bic: inv.partners.payment_swift_bic || null,
            bank_name_address: inv.partners.payment_bank_name_address || null,
          }
        : null,
    };
  };

  const exportInvoice = async (inv: any, mode: "download" | "print" = "download") => {
    if (!inv?.id) {
      toast.error("Cannot generate PDF: invoice is missing an ID. Save it first.");
      return;
    }
    const tId = toast.loading(`${mode === "print" ? "Opening print preview" : "Preparing"} Invoice ${inv.invoice_number || ""}…`);
    try {
      const docInput = await buildInvoiceDoc(inv);
      if (mode === "print") {
        await openDocPdf(docInput);
        toast.success("Print preview opened in a new tab.", { id: tId });
      } else {
        await downloadDocPdf(docInput, `Invoice_${inv.invoice_number}.pdf`);
        toast.success("PDF ready — use your browser dialog to save.", { id: tId });
      }
    } catch (e: any) {
      console.error("[Invoices] PDF generation failed:", e);
      toast.error(e?.message || "PDF generation failed. Please try again.", {
        id: tId,
        description: "Check popup blocker settings or try a different browser if the issue persists.",
      });
    }
  };

  const downloadPdf = (inv: any) => exportInvoice(inv, "download");
  const printPdf = (inv: any) => exportInvoice(inv, "print");

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const toggleSelect = (id: string, on: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id); else next.delete(id);
      return next;
    });
  };
  const toggleSelectAll = (on: boolean, list: any[]) => {
    setSelectedIds(on ? new Set(list.map((i) => i.id)) : new Set());
  };
  const bulkPrint = async () => {
    const list = (invoices as any[]).filter((i) => selectedIds.has(i.id));
    if (!list.length) return;
    const tId = toast.loading(`Preparing ${list.length} invoices for print…`);
    try {
      const docs = await Promise.all(list.map((inv) => buildInvoiceDoc(inv)));
      await openMultiDocPdf(docs);
      toast.success(`Print preview opened for ${list.length} invoices.`, { id: tId });
    } catch (e: any) {
      console.error("[Invoices] Bulk print failed:", e);
      toast.error(e?.message || "Bulk print failed.", { id: tId });
    }
  };

  return (
    <AppLayout title="Invoices" subtitle="Generate, send, and reconcile invoices">
      <div className="space-y-5">
        <div className="flex justify-end">
          {/* <AskAIButton prompt="Analyze my invoices: outstanding balance, overdue, payment trends, and recommended follow-ups." label="AI Analysis" /> */}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card><CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center"><Clock className="w-5 h-5 text-blue-500" /></div>
            <div><p className="text-xs text-muted-foreground">Outstanding</p>
              <p className="text-lg font-bold">{fmtMoney(totalOutstanding)}</p></div>
          </CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-green-500/10 flex items-center justify-center"><CheckCircle className="w-5 h-5 text-green-500" /></div>
            <div><p className="text-xs text-muted-foreground">Collected</p>
              <p className="text-lg font-bold">{fmtMoney(totalPaid)}</p></div>
          </CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-destructive/10 flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-destructive" /></div>
            <div><p className="text-xs text-muted-foreground">Overdue</p>
              <p className="text-lg font-bold">{overdueCount}</p></div>
          </CardContent></Card>
        </div>

        <div className="flex flex-wrap justify-end items-end gap-2">
          <div className="flex items-end gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Generate from Estimate</Label>
              <Select value={estimateToConvertId} onValueChange={setEstimateToConvertId}>
                <SelectTrigger className="w-[280px]">
                  <SelectValue placeholder={convertibleEstimates.length ? "Pick an estimate…" : "No eligible estimates"} />
                </SelectTrigger>
                <SelectContent>
                  {convertibleEstimates.map((e: any) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.estimate_number} — {e.clients?.company_name || "—"} ({e.currency} {Number(e.total || 0).toFixed(2)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              className="gap-2"
              disabled={!estimateToConvertId || convertEstimateMutation.isPending}
              onClick={() => setShowConvertPreview(true)}
            >
              <Link2 className="w-4 h-4" /> Preview & Generate
            </Button>
          </div>
          <Button onClick={() => { resetForm(); setShowEditor(true); }} className="gap-2">
            <Plus className="w-4 h-4" /> New Invoice
          </Button>
        </div>

        {/* Convert-from-estimate Preview Dialog */}
        <Dialog open={showConvertPreview} onOpenChange={setShowConvertPreview}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Preview invoice from estimate</DialogTitle>
            </DialogHeader>
            {convertPreviewLoading || !convertPreview ? (
              <p className="text-sm text-muted-foreground py-6">Loading preview…</p>
            ) : (() => {
              const est = convertPreview.est as any;
              const partner = est?.partners;
              const client = est?.clients;
              const fmtAddr = (p: any) => [p?.address_line1, [p?.city, p?.region].filter(Boolean).join(", "), p?.postcode, p?.country].filter(Boolean).join(" · ");
              return (
                <div className="space-y-4 text-sm">
                  <div className="rounded-md border p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{est.estimate_number}</span>
                      <Badge variant="outline">{est.status}</Badge>
                    </div>
                    <div className="text-muted-foreground mt-1">{est.title || "—"}</div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="rounded-md border p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Partner</p>
                      {partner ? (
                        <>
                          <p className="font-medium">{partner.company_name}</p>
                          {partner.contact_name && <p>{partner.contact_name}</p>}
                          {partner.email && <p className="text-muted-foreground">{partner.email}</p>}
                          {partner.phone && <p className="text-muted-foreground">{partner.phone}</p>}
                          {fmtAddr(partner) && <p className="text-muted-foreground">{fmtAddr(partner)}</p>}
                        </>
                      ) : <p className="text-muted-foreground">No partner attached</p>}
                    </div>
                    <div className="rounded-md border p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Client</p>
                      {client ? (
                        <>
                          <p className="font-medium">{client.company_name}</p>
                          {client.contact_name && <p>{client.contact_name}</p>}
                          {client.email && <p className="text-muted-foreground">{client.email}</p>}
                          {client.phone && <p className="text-muted-foreground">{client.phone}</p>}
                          {fmtAddr(client) && <p className="text-muted-foreground">{fmtAddr(client)}</p>}
                        </>
                      ) : <p className="text-muted-foreground">No client</p>}
                    </div>
                  </div>

                  <div className="rounded-md border">
                    <div className="px-3 py-2 text-xs uppercase tracking-wide text-muted-foreground border-b">Line items</div>
                    {convertPreview.items.length === 0 ? (
                      <p className="px-3 py-2 text-muted-foreground">No line items</p>
                    ) : convertPreview.items.map((it: any) => (
                      <div key={it.id} className="px-3 py-2 flex justify-between border-b last:border-b-0">
                        <span className="truncate pr-2">{it.description || "—"}</span>
                        <span className="text-muted-foreground whitespace-nowrap">
                          {it.quantity} × {fmtMoney(Number(it.unit_price || 0), est.currency)} = {fmtMoney(Number(it.total || 0), est.currency)}
                        </span>
                      </div>
                    ))}
                    <div className="px-3 py-2 flex justify-between font-semibold">
                      <span>Total</span>
                      <span>{fmtMoney(Number(est.total || 0), est.currency)}</span>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={() => setShowConvertPreview(false)}>Cancel</Button>
                    <Button
                      disabled={convertEstimateMutation.isPending}
                      onClick={() => convertEstimateMutation.mutate(estimateToConvertId)}
                      className="gap-2"
                    >
                      <Link2 className="w-4 h-4" /> Generate Invoice
                    </Button>
                  </div>
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>

        {/* Editor */}
        <Dialog open={showEditor} onOpenChange={(o) => { if (!o) resetForm(); else setShowEditor(true); }}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Invoice" : "Create Invoice"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {estimateId && (
                <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
                  <Link2 className="w-4 h-4" />
                  <span>Linked to source estimate</span>
                  <label className="ml-auto flex items-center gap-2 text-xs">
                    <input type="checkbox" checked={estimateLinkActive}
                      onChange={(e) => setEstimateLinkActive(e.target.checked)} />
                    Keep link active
                  </label>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Client *</Label>
                  <Select value={clientId} onValueChange={setClientId}>
                    <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                    <SelectContent>
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
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1 col-span-2">
                  <Label>Reference / Title</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Project Alpha — Aug 2025" />
                </div>
                <div className="space-y-1">
                  <Label>Purchase Order Number</Label>
                  <Input
                    value={purchaseOrderNumber}
                    onChange={(e) => setPurchaseOrderNumber(e.target.value)}
                    placeholder="e.g. PO-2026-00125"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Currency</Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["USD","EUR","GBP","INR","AED","SGD","AUD","CAD"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Payment Terms</Label>

                  <Select
                    value={dueDays}
                    onValueChange={(value) => {
                        setDueDays(value);

                        if (value === "custom") {
                          return;
                        }

                        setDueDate(
                          calculateDueDate(invoiceBaseDate, Number(value))
                        );
                      }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select payment terms" />
                    </SelectTrigger>

                    <SelectContent>
                      <SelectItem value="0">
                        Due on receipt
                      </SelectItem>

                      <SelectItem value="7">
                        7 days
                      </SelectItem>

                      <SelectItem value="10">
                        10 days
                      </SelectItem>

                      <SelectItem value="15">
                        15 days
                      </SelectItem>

                      <SelectItem value="30">
                        30 days
                      </SelectItem>

                      <SelectItem value="45">
                        45 days
                      </SelectItem>

                      <SelectItem value="60">
                        60 days
                      </SelectItem>

                      <SelectItem value="custom">
                        Custom date
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label>Due Date</Label>

                  {dueDays === "custom" ? (
                    <Input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                    />
                  ) : (
                    <div className="h-10 flex items-center rounded-md border bg-muted/40 px-3 text-sm font-medium">
                      {dueDate
                        ? new Date(`${dueDate}T00:00:00`).toLocaleDateString()
                        : "—"}
                    </div>
                  )}
                </div>
              </div>

              {/* Line items */}
              <div className="space-y-2">
                <Label>Line Items</Label>
                {lineItems.map((li, idx) => (
                  <div key={li.id} className="grid grid-cols-12 gap-2 items-start">
                    <Input className="col-span-5" placeholder="Description"
                      value={li.description}
                      onChange={(e) => setLineItems(p => p.map(x => x.id === li.id ? { ...x, description: e.target.value } : x))} />
                    <Input className="col-span-2" type="number" min={0} step={0.01} placeholder="Qty"
                      value={li.quantity}
                      onChange={(e) => setLineItems(p => p.map(x => x.id === li.id ? { ...x, quantity: Number(e.target.value) } : x))} />
                    <Input className="col-span-2" type="number" min={0} step={0.01} placeholder="Rate"
                      value={li.unit_price}
                      onChange={(e) => setLineItems(p => p.map(x => x.id === li.id ? { ...x, unit_price: Number(e.target.value) } : x))} />
                    <div className="col-span-2 text-sm font-medium pt-2 text-right tabular-nums">
                      {fmtMoney((Number(li.quantity) || 0) * (Number(li.unit_price) || 0), currency)}
                    </div>
                    <Button variant="ghost" size="icon" className="col-span-1"
                      onClick={() => setLineItems(p => p.filter(x => x.id !== li.id))} aria-label="Remove">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    {taxEnabled && taxMode === "per_line" && (
                      <>
                        <Input className="col-span-3 col-start-6" type="number" min={0} step={0.01} placeholder={`${tax1Label} %`}
                          value={li.tax1_rate}
                          onChange={(e) => setLineItems(p => p.map(x => x.id === li.id ? { ...x, tax1_rate: Number(e.target.value) } : x))} />
                        <Input className="col-span-3" type="number" min={0} step={0.01} placeholder={`${tax2Label} %`}
                          value={li.tax2_rate}
                          onChange={(e) => setLineItems(p => p.map(x => x.id === li.id ? { ...x, tax2_rate: Number(e.target.value) } : x))} />
                      </>
                    )}
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => setLineItems(p => [...p, emptyLine()])} className="gap-1">
                  <Plus className="w-3 h-3" /> Add Item
                </Button>
              </div>

              {/* Tax controls */}
              <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <Label className="text-sm font-semibold">Taxation</Label>
                    <p className="text-[11px] text-muted-foreground">Pick a global preset or set your own. Toggle off for tax-exempt invoices.</p>
                  </div>
                  <Switch checked={taxEnabled} onCheckedChange={setTaxEnabled} aria-label="Enable tax" />
                </div>

                {taxEnabled && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Country / Region preset</Label>
                        <Select
                          value={taxPreset}
                          onValueChange={(id) => {
                            setTaxPreset(id);
                            const p = TAX_PRESETS.find(x => x.id === id);
                            if (!p || p.id === "none") return;
                            setTaxMode(p.mode);
                            setTax1Label(p.tax1_label);
                            setTaxRate(String(p.tax1_rate));
                            setTax2Label(p.tax2_label || "Tax 2");
                            setTax2Rate(String(p.tax2_rate ?? 0));
                          }}
                        >
                          <SelectTrigger className="h-8"><SelectValue placeholder="Choose region…" /></SelectTrigger>
                          <SelectContent className="max-h-72">
                            {TAX_PRESETS.map(p => (
                              <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Tax mode</Label>
                        <Select value={taxMode} onValueChange={(v) => { setTaxMode(v as TaxMode); setTaxPreset("none"); }}>
                          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="single">Single tax</SelectItem>
                            <SelectItem value="dual_split">Dual split (e.g. CGST+SGST)</SelectItem>
                            <SelectItem value="compound">Compound (tax on tax)</SelectItem>
                            <SelectItem value="per_line">Per-line item</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Tax 1 label</Label>
                        <Input value={tax1Label} onChange={(e) => { setTax1Label(e.target.value); setTaxPreset("none"); }} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Tax 1 rate %</Label>
                        <RateSelect
                          value={taxRate}
                          disabled={taxMode === "per_line"}
                          onChange={(v) => { setTaxRate(v); setTaxPreset("none"); }}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Tax 2 label</Label>
                        <Input value={tax2Label} onChange={(e) => { setTax2Label(e.target.value); setTaxPreset("none"); }}
                          disabled={taxMode === "single"} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Tax 2 rate %</Label>
                        <RateSelect
                          value={tax2Rate}
                          disabled={taxMode === "single" || taxMode === "per_line"}
                          onChange={(v) => { setTax2Rate(v); setTaxPreset("none"); }}
                        />
                      </div>
                    </div>
                  </>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Discount %</Label>
                    <Input type="number" min={0} max={100} step={0.01} value={discountPercent}
                      onChange={(e) => setDiscountPercent(e.target.value)} />
                  </div>
                </div>

                {!taxValidation.ok && (
                  <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-2 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-destructive">
                      <AlertTriangle className="w-3.5 h-3.5" /> Tax preset mismatch
                    </div>
                    <ul className="text-[11px] text-destructive/90 list-disc list-inside space-y-0.5">
                      {taxValidation.errors.map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                    <div className="flex gap-2 pt-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px]"
                        onClick={() => {
                          const p = TAX_PRESETS.find(x => x.id === taxPreset);
                          if (!p) return;
                          setTaxMode(p.mode);
                          setTax1Label(p.tax1_label);
                          setTaxRate(String(p.tax1_rate));
                          setTax2Label(p.tax2_label || "Tax 2");
                          setTax2Rate(String(p.tax2_rate ?? 0));
                        }}
                      >
                        Reset to preset values
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 text-[11px]"
                        onClick={() => setTaxPreset("none")}
                      >
                        Switch to custom
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Totals preview */}
              <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1 text-sm">
                <div className="flex justify-between"><span>Subtotal</span><span className="tabular-nums">{fmtMoney(totals.subtotal, currency)}</span></div>
                {totals.discount_amount > 0 && (
                  <div className="flex justify-between text-muted-foreground"><span>Discount</span><span className="tabular-nums">-{fmtMoney(totals.discount_amount, currency)}</span></div>
                )}
                {totals.tax_amount > 0 && (
                  <div className="flex justify-between"><span>{tax1Label}{taxRate ? ` (${taxRate}%)` : ""}</span><span className="tabular-nums">{fmtMoney(totals.tax_amount, currency)}</span></div>
                )}
                {totals.tax2_amount > 0 && (
                  <div className="flex justify-between"><span>{tax2Label}{tax2Rate ? ` (${tax2Rate}%)` : ""}{taxMode === "compound" ? " · compound" : ""}</span><span className="tabular-nums">{fmtMoney(totals.tax2_amount, currency)}</span></div>
                )}
                <div className="flex justify-between font-bold border-t border-border pt-1 mt-1"><span>Total</span><span className="tabular-nums">{fmtMoney(totals.total, currency)}</span></div>
              </div>

              {/* QR preview + retry + logo embed controls */}
              <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-3">
                <div className="flex items-start gap-3">
                  {/* Live preview — embedded version */}
                  <div className="flex flex-col items-center gap-1 shrink-0">
                    <div className="w-[140px] h-[140px] flex items-center justify-center rounded bg-background border border-border">
                      {qrLoading ? (
                        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                      ) : qrDataUrl ? (
                        <img src={qrDataUrl} alt="Invoice QR preview" className="w-[132px] h-[132px]" />
                      ) : (
                        <QrCode className="w-8 h-8 text-muted-foreground" />
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground">{qrLogoUrl ? "With logo" : "Final QR"}</span>
                  </div>

                  {/* Live preview — clean reference for compare (only when logo is embedded) */}
                  {qrLogoUrl && !qrError && (
                    <div className="flex flex-col items-center gap-1 shrink-0">
                      <div className="w-[140px] h-[140px] flex items-center justify-center rounded bg-background border border-dashed border-border">
                        {qrCleanDataUrl ? (
                          <img src={qrCleanDataUrl} alt="Reference QR without logo" className="w-[132px] h-[132px]" />
                        ) : (
                          <QrCode className="w-8 h-8 text-muted-foreground" />
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground">Reference (no logo)</span>
                    </div>
                  )}

                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Label className="text-sm font-semibold">Verification QR</Label>
                      {qrError && <Badge variant="destructive" className="text-[10px]">Unavailable</Badge>}
                      {qrLogoUrl && !qrError && <Badge variant="secondary" className="text-[10px]">Logo embedded</Badge>}
                      {!qrError && (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-medium ${qrScanability.color}`}>
                          {qrScanability.label}
                        </span>
                      )}
                      {!qrError && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-[11px] ml-auto"
                          onClick={autoTuneQr}
                          title="Auto-tune backdrop, padding, logo size, and ECC for best scanability"
                        >
                          Auto
                        </Button>
                      )}
                    </div>
                    {qrError ? (
                      <p className="text-[11px] text-destructive" title={qrError}>
                        {qrError}. Click retry — if it persists, check your network or browser extensions.
                      </p>
                    ) : (
                      <>
                        <p className="text-[11px] text-muted-foreground">Embedded into the PDF for scan-to-verify / pay.</p>
                        <div className="text-[11px] text-muted-foreground space-y-0.5">
                          <div className="flex items-center justify-between gap-2">
                            <span>Logo coverage</span>
                            <span className="tabular-nums">{qrScanability.coverage}% of QR area</span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span>ECC capacity ({qrEcc})</span>
                            <span className="tabular-nums">~{qrScanability.capacity}% recoverable</span>
                          </div>
                          <div className="h-1.5 bg-muted rounded overflow-hidden">
                            <div
                              className={`h-full transition-all ${
                                qrScanability.level === "excellent" ? "bg-emerald-500"
                                : qrScanability.level === "good" ? "bg-sky-500"
                                : qrScanability.level === "marginal" ? "bg-amber-500"
                                : "bg-destructive"
                              }`}
                              style={{ width: `${Math.min(100, (qrScanability.coverage / qrScanability.capacity) * 100)}%` }}
                            />
                          </div>
                          {qrScanability.hint && (
                            <p className="text-[11px] text-amber-700 dark:text-amber-500">{qrScanability.hint}</p>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <Button
                      type="button"
                      variant={qrError ? "destructive" : "outline"}
                      size="sm"
                      className="gap-1"
                      disabled={qrLoading}
                      onClick={() => setQrAttempt((n) => n + 1)}
                    >
                      <RefreshCw className={`w-3 h-3 ${qrLoading ? "animate-spin" : ""}`} />
                      {qrError ? "Retry QR" : "Regenerate"}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="gap-1"
                      disabled={!qrDataUrl || qrLoading || !!qrError}
                      onClick={() => {
                        if (!qrDataUrl) return;
                        const a = document.createElement("a");
                        a.href = qrDataUrl;
                        const base = editingId ? editingId.slice(0, 8) : "draft";
                        a.download = `invoice-qr-${base}.png`;
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                        toast.success("QR code downloaded");
                      }}
                    >
                      <FileDown className="w-3 h-3" />
                      PNG
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="gap-1"
                      disabled={qrLoading || !!qrError}
                      onClick={async () => {
                        try {
                          const QR: any = await import("qrcode");
                          const toString = (QR.default ?? QR)?.toString;
                          if (typeof toString !== "function") throw new Error("QR library unavailable");
                          const svg: string = await toString(qrPayload, { type: "svg", errorCorrectionLevel: qrEcc, margin: 1, width: 320 });
                          const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          const base = editingId ? editingId.slice(0, 8) : "draft";
                          a.download = `invoice-qr-${base}.svg`;
                          document.body.appendChild(a);
                          a.click();
                          a.remove();
                          URL.revokeObjectURL(url);
                          toast.success("QR code SVG downloaded");
                        } catch (e: any) {
                          toast.error(e?.message || "Failed to export SVG");
                        }
                      }}
                    >
                      <FileDown className="w-3 h-3" />
                      SVG
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-12 gap-2 items-end border-t border-border/60 pt-2">
                  <div className="col-span-6 space-y-1">
                    <Label className="text-xs">Center logo URL (optional)</Label>
                    <div className="flex gap-1">
                      <Input
                        value={qrLogoUrl}
                        onChange={(e) => setQrLogoUrl(e.target.value.trim())}
                        placeholder="https://… or upload below"
                        maxLength={2048}
                      />
                      <Input
                        type="file"
                        accept="image/png,image/jpeg,image/svg+xml,image/webp"
                        className="w-32 text-[11px]"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          if (f.size > 1_000_000) {
                            toast.error("Logo must be under 1 MB");
                            return;
                          }
                          const r = new FileReader();
                          r.onload = () => setQrLogoUrl(String(r.result || ""));
                          r.onerror = () => toast.error("Could not read logo file");
                          r.readAsDataURL(f);
                        }}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground">Embeds at the QR center. Use ECC "H" with logos ≥20%.</p>
                  </div>
                  <div className="col-span-3 space-y-1">
                    <Label className="text-xs">Logo size: {qrLogoSize}%</Label>
                    <input
                      type="range"
                      min={10}
                      max={30}
                      step={1}
                      value={qrLogoSize}
                      onChange={(e) => setQrLogoSize(Number(e.target.value))}
                      disabled={!qrLogoUrl}
                      className="w-full accent-primary"
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs">Error correction</Label>
                    <Select value={qrEcc} onValueChange={(v) => setQrEcc(v as any)}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="L">L — Low (~7%)</SelectItem>
                        <SelectItem value="M">M — Medium (~15%)</SelectItem>
                        <SelectItem value="Q">Q — Quartile (~25%)</SelectItem>
                        <SelectItem value="H">H — High (~30%)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-1">
                    {qrLogoUrl && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-9 w-full text-[11px]"
                        onClick={() => setQrLogoUrl("")}
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-5 flex items-center gap-2">
                    <Switch
                      id="qr-backdrop"
                      checked={qrLogoBackdrop}
                      onCheckedChange={setQrLogoBackdrop}
                      disabled={!qrLogoUrl}
                      aria-label="White logo backdrop"
                    />
                    <Label htmlFor="qr-backdrop" className="text-xs">
                      White logo backdrop
                      <span className="block text-[10px] text-muted-foreground font-normal">
                        Improves scan reliability for transparent / dark logos.
                      </span>
                    </Label>
                  </div>
                  <div className="col-span-6 space-y-1">
                    <Label className="text-xs">Backdrop padding: {qrLogoPadding}%</Label>
                    <input
                      type="range"
                      min={0}
                      max={30}
                      step={1}
                      value={qrLogoPadding}
                      onChange={(e) => setQrLogoPadding(Number(e.target.value))}
                      disabled={!qrLogoUrl || !qrLogoBackdrop}
                      className="w-full accent-primary"
                    />
                    <p className="text-[10px] text-muted-foreground">% of logo width — bigger padding = safer eyes but more QR area covered.</p>
                  </div>
                  <div className="col-span-1" />
                </div>

                <div className="grid grid-cols-12 gap-2 items-start">
                  <div className="col-span-5 space-y-1">
                    <Label className="text-xs">Backdrop style</Label>
                    <Select
                      value={qrLogoBackdropType}
                      onValueChange={(v) => setQrLogoBackdropType(v as "solid" | "gradient")}
                      disabled={!qrLogoUrl || !qrLogoBackdrop}
                    >
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="solid">Solid color</SelectItem>
                        <SelectItem value="gradient">Linear gradient</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-7 space-y-1">
                    <Label htmlFor="qr-backdrop-color" className="text-xs">
                      {qrLogoBackdropType === "gradient" ? "Gradient colors" : "Backdrop color"}
                    </Label>
                    <div className="flex items-center gap-2">
                      <input
                        id="qr-backdrop-color"
                        type="color"
                        value={qrLogoBackdropColor}
                        onChange={(e) => setQrLogoBackdropColor(e.target.value)}
                        disabled={!qrLogoUrl || !qrLogoBackdrop}
                        className="h-8 w-10 rounded border border-input bg-background p-0.5 disabled:opacity-50"
                        aria-label="Logo backdrop color"
                      />
                      <Input
                        value={qrLogoBackdropColor}
                        onChange={(e) => setQrLogoBackdropColor(e.target.value)}
                        disabled={!qrLogoUrl || !qrLogoBackdrop}
                        placeholder="#ffffff"
                        className="h-8 text-xs font-mono"
                        maxLength={7}
                      />
                      {qrLogoBackdropType === "gradient" && (
                        <>
                          <input
                            type="color"
                            value={qrLogoBackdropColor2}
                            onChange={(e) => setQrLogoBackdropColor2(e.target.value)}
                            disabled={!qrLogoUrl || !qrLogoBackdrop}
                            className="h-8 w-10 rounded border border-input bg-background p-0.5 disabled:opacity-50"
                            aria-label="Logo backdrop second color"
                          />
                          <Input
                            value={qrLogoBackdropColor2}
                            onChange={(e) => setQrLogoBackdropColor2(e.target.value)}
                            disabled={!qrLogoUrl || !qrLogoBackdrop}
                            placeholder="#e5e7eb"
                            className="h-8 text-xs font-mono"
                            maxLength={7}
                          />
                        </>
                      )}
                      {qrLogoBackdropType === "solid" && qrLogoBackdropColor.toLowerCase() !== "#ffffff" && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-xs"
                          disabled={!qrLogoUrl || !qrLogoBackdrop}
                          onClick={() => setQrLogoBackdropColor("#ffffff")}
                        >
                          Reset
                        </Button>
                      )}
                    </div>
                    {qrLogoBackdropType === "gradient" && (
                      <div className="flex items-center gap-2 pt-1">
                        <Label className="text-[10px] text-muted-foreground whitespace-nowrap">Angle: {qrLogoBackdropAngle}°</Label>
                        <input
                          type="range"
                          min={0}
                          max={360}
                          step={5}
                          value={qrLogoBackdropAngle}
                          onChange={(e) => setQrLogoBackdropAngle(Number(e.target.value))}
                          disabled={!qrLogoUrl || !qrLogoBackdrop}
                          className="w-full accent-primary"
                        />
                      </div>
                    )}
                    <p className="text-[10px] text-muted-foreground">
                      Solid white is safest. Gradients and dark colors look great for branding but reduce contrast — watch the scanability meter.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <Label>Notes / Terms</Label>
                <Textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)}
                  placeholder="Payment terms, scope notes, T&Cs…" maxLength={2000} />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={resetForm}>Cancel</Button>
                <Button
                  onClick={() => {
                    if (!taxValidation.ok) {
                      toast.error("Fix tax preset mismatch before saving", {
                        description: taxValidation.errors[0],
                      });
                      return;
                    }
                    upsertMutation.mutate();
                  }}
                  disabled={upsertMutation.isPending || !taxValidation.ok}
                  title={!taxValidation.ok ? "Resolve tax preset mismatch first" : undefined}
                >
                  {upsertMutation.isPending ? "Saving…" : (editingId ? "Save Changes" : "Create Invoice")}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Payment dialog */}
        <Dialog open={!!payInvoice} onOpenChange={(o) => { if (!o) setPayInvoice(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record Payment</DialogTitle>
            </DialogHeader>
            {payInvoice && (
              <div className="space-y-3">
                <div className="rounded-md bg-muted/40 p-3 text-sm">
                  <div><strong>{payInvoice.invoice_number}</strong> · {payInvoice.clients?.company_name || "—"}</div>
                  <div className="text-muted-foreground">Total {fmtMoney(payInvoice.total, payInvoice.currency)} · Already paid {fmtMoney(payInvoice.amount_paid || 0, payInvoice.currency)} · Balance {fmtMoney(Number(payInvoice.total) - Number(payInvoice.amount_paid || 0), payInvoice.currency)}</div>
                </div>
                <div className="space-y-1">
                  <Label>Amount</Label>
                  <Input type="number" min={0} step={0.01} value={payAmount} onChange={(e) => setPayAmount(e.target.value)}
                    placeholder={String(Number(payInvoice.total) - Number(payInvoice.amount_paid || 0))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Method</Label>
                    <Select value={payMethod} onValueChange={setPayMethod}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["Bank transfer","Card","Cash","Cheque","Wire","Other"].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Reference (optional)</Label>
                    <Input value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder="Txn ID, cheque #, etc." />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setPayInvoice(null)}>Cancel</Button>
                  <Button onClick={() => recordPaymentMutation.mutate()} disabled={recordPaymentMutation.isPending}>
                    {recordPaymentMutation.isPending ? "Recording…" : "Record & Generate Receipt"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* List */}
        <Card>
          <CardContent className="p-0">
            {selectedIds.size > 0 && (
              <div className="flex items-center justify-between gap-3 px-5 py-2 border-b bg-primary/5">
                <span className="text-sm font-medium">{selectedIds.size} selected</span>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={bulkPrint} className="gap-1"><Printer className="w-3.5 h-3.5" />Print Selected</Button>
                  <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>Clear</Button>
                </div>
              </div>
            )}
            <div className="flex items-center justify-between gap-3 px-5 py-2 border-b bg-muted/20">
              <span className="text-xs text-muted-foreground">{(invoices as any[]).length} invoice{(invoices as any[]).length === 1 ? "" : "s"}</span>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Label htmlFor="inv-page-jump" className="text-xs whitespace-nowrap">Pg jump</Label>
                <Select value={String(invPageJump ?? 10)} onValueChange={(v) => setInvPageJump(Number(v))}>
                  <SelectTrigger id="inv-page-jump" className="h-8 w-[80px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[5, 10, 20, 25, 50, 100].map(n => (
                      <SelectItem key={n} value={String(n)}>{n} rows</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <TooltipProvider delayDuration={150}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        aria-label="Keyboard shortcuts"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <Keyboard className="w-3.5 h-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" align="end" className="max-w-xs text-xs leading-relaxed p-3">
                      <p className="font-semibold mb-2 text-foreground">Keyboard shortcuts</p>
                      <ul className="space-y-1.5">
                        <li className="flex items-center justify-between gap-3"><span>Move row</span><kbd className="px-1.5 py-0.5 rounded border border-border bg-muted font-mono text-[10px]">↑ / ↓</kbd></li>
                        <li className="flex items-center justify-between gap-3"><span>Jump {Math.max(1, Number(invPageJump) || 10)} rows</span><kbd className="px-1.5 py-0.5 rounded border border-border bg-muted font-mono text-[10px]">PgUp / PgDn</kbd></li>
                        <li className="flex items-center justify-between gap-3"><span>First / Last row</span><kbd className="px-1.5 py-0.5 rounded border border-border bg-muted font-mono text-[10px]">Home / End</kbd></li>
                        <li className="flex items-center justify-between gap-3"><span>Edit invoice</span><kbd className="px-1.5 py-0.5 rounded border border-border bg-muted font-mono text-[10px]">Enter</kbd></li>
                        <li className="flex items-center justify-between gap-3"><span>Toggle select</span><kbd className="px-1.5 py-0.5 rounded border border-border bg-muted font-mono text-[10px]">Space</kbd></li>
                      </ul>
                      <p className="mt-2 text-[10px] text-muted-foreground">
                        Change <span className="font-medium text-foreground">Pg jump</span> to control how many rows PageUp/PageDown skips. Saved to your account.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[940px]">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-3 py-3 w-10">
                      <Checkbox
                        checked={(invoices as any[]).length > 0 && selectedIds.size === (invoices as any[]).length}
                        onCheckedChange={(v) => toggleSelectAll(!!v, invoices as any[])}
                        aria-label="Select all invoices"
                      />
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Invoice #</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Client</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Status</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Due</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Total</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Balance</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(invoices as any[]).map((inv: any, idx: number) => {
                    const balance = Number(inv.balance_due ?? (Number(inv.total) - Number(inv.amount_paid || 0)));
                    const checked = selectedIds.has(inv.id);
                    const list = invoices as any[];
                    const isFocused = focusedInvoiceId === inv.id || (!focusedInvoiceId && idx === 0);
                    const focusRow = (target: any) => {
                      if (!target) return;
                      setFocusedInvoiceId(target.id);
                      requestAnimationFrame(() => {
                        (document.querySelector(`[data-inv-row="${target.id}"]`) as HTMLElement | null)?.focus();
                      });
                    };
                    return (
                      <tr
                        key={inv.id}
                        data-inv-row={inv.id}
                        tabIndex={isFocused ? 0 : -1}
                        onFocus={() => setFocusedInvoiceId(inv.id)}
                        onKeyDown={(e) => {
                          const tag = (e.target as HTMLElement).tagName;
                          if (tag === "INPUT" || tag === "BUTTON" || tag === "A" || tag === "TEXTAREA") return;
                          const PAGE = Math.max(1, Number(invPageJump) || 10);
                          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                            e.preventDefault();
                            const dir = e.key === "ArrowDown" ? 1 : -1;
                            focusRow(list[Math.min(list.length - 1, Math.max(0, idx + dir))]);
                          } else if (e.key === "PageDown" || e.key === "PageUp") {
                            e.preventDefault();
                            const dir = e.key === "PageDown" ? PAGE : -PAGE;
                            focusRow(list[Math.min(list.length - 1, Math.max(0, idx + dir))]);
                          } else if (e.key === "Home" || e.key === "End") {
                            e.preventDefault();
                            focusRow(e.key === "Home" ? list[0] : list[list.length - 1]);
                          } else if (e.key === "Enter") {
                            e.preventDefault();
                            openEdit(inv);
                          } else if (e.key === " ") {
                            e.preventDefault();
                            toggleSelect(inv.id, !checked);
                          }
                        }}
                        aria-selected={checked}
                        className={`border-b border-border/50 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-inset ${
                          checked ? "bg-primary/5" : isFocused && focusedInvoiceId ? "bg-muted/40" : "hover:bg-muted/30"
                        }`}
                      >
                        <td className="px-3 py-3">
                          <Checkbox checked={checked} onCheckedChange={(v) => toggleSelect(inv.id, !!v)} aria-label={`Select ${inv.invoice_number}`} />
                        </td>
                        <td className="px-5 py-3 font-mono font-medium">
                          {inv.invoice_number}
                          {inv.estimate_id && (
                            <Badge variant="outline" className="ml-2 text-[10px] gap-1"><Link2 className="w-2.5 h-2.5" />{inv.estimates?.estimate_number || "estimate"}</Badge>
                          )}
                        </td>
                        <td className="px-5 py-3">{inv.clients?.company_name || "—"}</td>
                        <td className="px-5 py-3">
                          <Badge variant="outline" className={`capitalize ${statusColors[inv.status] || ""}`}>{inv.status}</Badge>
                        </td>
                        <td className="px-5 py-3 text-muted-foreground">{inv.due_date ? new Date(inv.due_date).toLocaleDateString() : "—"}</td>
                        <td className="px-5 py-3 text-right font-bold tabular-nums">{fmtMoney(Number(inv.total), inv.currency || "USD")}</td>
                        <td className="px-5 py-3 text-right tabular-nums text-muted-foreground">{fmtMoney(balance, inv.currency || "USD")}</td>
                        <td className="px-5 py-3">
                          <div className="flex justify-end items-center gap-1 flex-wrap">
                            {inv.status === "draft" && (
                              <>
                                <Button variant="ghost" size="sm" onClick={() => openEdit(inv)} className="gap-1 text-xs"><Pencil className="w-3 h-3" />Edit</Button>
                                <Button variant="ghost" size="sm" onClick={() => sendInvoice(inv)} className="gap-1 text-xs"><Send className="w-3 h-3" />Send</Button>
                              </>
                            )}
                            {balance > 0 && inv.status !== "draft" && inv.status !== "cancelled" && (
                              <Button variant="ghost" size="sm" onClick={() => { setPayInvoice(inv); setPayAmount(String(balance)); }} className="gap-1 text-xs text-green-600">
                                <DollarSign className="w-3 h-3" />Record Payment
                              </Button>
                            )}
                            {inv.estimate_id && inv.estimate_link_active && inv.status === "draft" && (
                              <Button variant="ghost" size="sm" onClick={() => syncFromEstimateMutation.mutate(inv)} className="gap-1 text-xs"><Link2 className="w-3 h-3" />Sync</Button>
                            )}
                            <div className="flex items-center gap-1 shrink-0 ml-auto">
                              <Button variant="outline" size="sm" onClick={() => printPdf(inv)} className="gap-1 text-xs shrink-0" title="Print preview"><Printer className="w-3 h-3" /><span className="hidden sm:inline">Print</span></Button>
                              <Button variant="outline" size="sm" onClick={() => downloadPdf(inv)} className="gap-1 text-xs shrink-0" title="Download PDF"><FileDown className="w-3 h-3" /><span className="hidden sm:inline">PDF</span></Button>
                              {inv.status === "draft" && (
                                <Button variant="ghost" size="sm" onClick={() => { if (confirm(`Delete invoice ${inv.invoice_number}?`)) deleteMutation.mutate(inv.id); }} className="gap-1 text-xs text-destructive shrink-0" title="Delete"><Trash2 className="w-3 h-3" /></Button>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {invoices.length === 0 && (
                    <tr><td colSpan={8} className="py-12 text-center text-muted-foreground">
                      <Receipt className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      No invoices yet. Create your first one.
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Invoices;
