import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { listEstimateTemplates, type EstimateTemplate } from "@/lib/estimateTemplates";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import { z } from "zod";
import { normalizeUnit, unitKey, isUnitProvided, rememberUnit } from "@/lib/units";
import { UnitInput } from "@/components/estimates/UnitInput";
import {
  Plus, FileText, Send, Check, X, Trash2, PenTool, Search,
  Copy, GripVertical, Download, Upload, Eye, AlertTriangle, CheckCircle2, Loader2, FileOutput, Info,
} from "lucide-react";


// ── Per-estimate branding override validation ──
const ALLOWED_LOGO_MIME = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"] as const;
const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2MB
const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

const hexColor = z
  .string()
  .trim()
  .regex(HEX_COLOR, { message: "Must be a hex color like #2563eb or #fff" });

const brandingOverrideSchema = z
  .object({
    enabled: z.boolean(),
    logoUrl: z.string().trim().max(2048).url({ message: "Logo URL is invalid" }).or(z.literal("")),
    primaryColor: z.union([z.literal(""), hexColor]),
    accentColor: z.union([z.literal(""), hexColor]),
    companyName: z.string().trim().max(120, { message: "Company name must be ≤120 chars" }),
    footerText: z.string().trim().max(500, { message: "Footer must be ≤500 chars" }),
  })
  .superRefine((v, ctx) => {
    if (!v.enabled) return;
    // At least one override must be set when branding override is enabled
    const anySet = !!(v.logoUrl || v.primaryColor || v.accentColor || v.companyName || v.footerText);
    if (!anySet) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Set at least one branding field or turn off the override",
        path: ["enabled"],
      });
    }
    // If a company name is provided in overrides it must not be just whitespace and ≥2 chars
    if (v.companyName && v.companyName.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Company name must be at least 2 characters",
        path: ["companyName"],
      });
    }
  });

const validateLogoFile = (file: File): string | null => {
  if (!ALLOWED_LOGO_MIME.includes(file.type as any)) {
    return "Logo must be PNG, JPG, WEBP, or SVG";
  }
  if (file.size > MAX_LOGO_BYTES) {
    return `Logo must be under ${(MAX_LOGO_BYTES / 1024 / 1024).toFixed(0)}MB`;
  }
  if (file.size === 0) {
    return "Logo file is empty";
  }
  return null;
};
import SignaturePad from "@/components/features/SignaturePad";
import ApprovalWorkflow from "@/components/estimates/ApprovalWorkflow";
import PricingPresets from "@/components/estimates/PricingPresets";
import EstimateBrandingPanel, { useEstimateBranding } from "@/components/estimates/EstimateBranding";
import NotesTemplates, { useNotesTemplates } from "@/components/estimates/NotesTemplates";
import EstimatePartyEditor, { formatAddressLines } from "@/components/estimates/EstimatePartyEditor";
import { Maximize2, Minimize2, Printer, Mail } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

/** Normalize an email-ish value: trim + lowercase. Returns "" for nullish. */
function normalizeEmail(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase();
}

/** RFC-5322-lite email check, matched to common provider rules and length caps. */
const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;
function isValidEmail(value: string): boolean {
  if (!value || value.length > 254) return false;
  const [local, domain] = value.split("@");
  if (!local || local.length > 64 || !domain) return false;
  return EMAIL_RE.test(value);
}

type RecipientSource = "billing" | "contact" | "primary";
interface ResolvedRecipient {
  email: string;
  source: RecipientSource;
  name: string;
}

/**
 * Resolve the best valid email recipient for an estimate party.
 * Walks billing_contact_email → contact_email → email, normalizing each
 * and validating with isValidEmail. Tracks any candidates that failed
 * validation so callers can surface a clear error.
 */
function resolveBillingRecipient(
  party: any,
): { recipient: ResolvedRecipient | null; invalid: { source: RecipientSource; raw: string }[] } {
  const invalid: { source: RecipientSource; raw: string }[] = [];
  if (!party) return { recipient: null, invalid };

  const candidates: { source: RecipientSource; raw: string }[] = [
    { source: "billing", raw: party.billing_contact_email ?? "" },
    { source: "contact", raw: party.contact_email ?? "" },
    { source: "primary", raw: party.email ?? "" },
  ];

  const displayName =
    (typeof party.billing_contact_name === "string" && party.billing_contact_name.trim()) ||
    (typeof party.contact_name === "string" && party.contact_name.trim()) ||
    (typeof party.company_name === "string" && party.company_name.trim()) ||
    "";

  for (const c of candidates) {
    const raw = typeof c.raw === "string" ? c.raw.trim() : "";
    if (!raw) continue;
    const normalized = normalizeEmail(raw);
    if (isValidEmail(normalized)) {
      return { recipient: { email: normalized, source: c.source, name: displayName }, invalid };
    }
    invalid.push({ source: c.source, raw });
  }
  return { recipient: null, invalid };
}

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  pending_approval: "bg-amber-500/10 text-amber-500",
  sent: "bg-blue-500/10 text-blue-500",
  approved: "bg-green-500/10 text-green-500",
  rejected: "bg-destructive/10 text-destructive",
  expired: "bg-amber-500/10 text-amber-500",
};

const CURRENCIES = ["USD", "EUR", "GBP", "INR", "AUD", "CAD", "AED"];

type LineItem = { description: string; quantity: number; unit_price: number; unit?: string };

const emptyLine: LineItem = { description: "", quantity: 1, unit_price: 0, unit: "" };



const Estimates = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Convert-to-invoice dialog state
  const [convertEstimate, setConvertEstimate] = useState<any | null>(null);
  const [convertDueDate, setConvertDueDate] = useState<string>("");
  const [convertKeepLinked, setConvertKeepLinked] = useState(true);
  const [converting, setConverting] = useState(false);

  const openConvertDialog = (est: any) => {
    setConvertEstimate(est);
    const d = new Date();
    d.setDate(d.getDate() + 30);
    setConvertDueDate(d.toISOString().slice(0, 10));
    setConvertKeepLinked(true);
  };

  const handleConvertToInvoice = async () => {
    if (!convertEstimate) return;
    setConverting(true);
    try {
      const { data, error } = await (supabase as any).rpc("convert_estimate_to_invoice", {
        _estimate_id: convertEstimate.id,
        _due_date: convertDueDate || null,
        _keep_linked: convertKeepLinked,
      });
      if (error) throw error;
      toast.success("Invoice created from estimate");
      queryClient.invalidateQueries({ queryKey: ["estimates"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      setConvertEstimate(null);
      const newInvoiceId = typeof data === "string" ? data : (data as any)?.id;
      if (newInvoiceId) {
        navigate(`/invoices/preview?id=${newInvoiceId}`);
      } else {
        navigate("/invoices");
      }
      return data;
    } catch (e: any) {
      toast.error(e?.message || "Failed to convert sales quote to invoice");
    } finally {
      setConverting(false);
    }
  };


  // form state
  const [title, setTitle] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>("none");
  const [currency, setCurrency] = useState("USD");
  const [notes, setNotes] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [taxRate, setTaxRate] = useState("0");
  const [taxMode, setTaxMode] = useState<"single" | "dual_split" | "compound" | "per_line">("compound");
  const [tax2Label, setTax2Label] = useState("Tax 2");
  const [tax2Rate, setTax2Rate] = useState("0");
  const [discountPercent, setDiscountPercent] = useState("0");
  const [lineItems, setLineItems] = useState<LineItem[]>([{ ...emptyLine }]);
  type MergeEvent = {
    at: string;
    incomingDescription: string;
    existingDescription: string;
    normalizedIncoming: string;
    normalizedExisting: string;
    score: number; // 0..1, 1 = exact normalized match
    type: "exact" | "fuzzy";
    threshold?: number;
    addedQty: number;
    newQty: number;
    unit?: string;
    unitPrice: number;
  };
  // Map keyed by stable description+unit+price signature so it survives reorders
  const [mergeLog, setMergeLog] = useState<Record<string, MergeEvent[]>>({});
  const [mergeDrawerOpen, setMergeDrawerOpen] = useState(false);
  // Dispatch Pricing fields (optional rate-card on the estimate)
  const [dispatchNbdTm, setDispatchNbdTm] = useState("");
  const [dispatchSbdTm, setDispatchSbdTm] = useState("");
  const [dispatchHourly, setDispatchHourly] = useState("");
  const [dispatchHalfDay, setDispatchHalfDay] = useState("");
  const [dispatchFullDay, setDispatchFullDay] = useState("");
  const [dispatchSbdHourly, setDispatchSbdHourly] = useState("");
  const [dispatchSbdHalfDay, setDispatchSbdHalfDay] = useState("");
  const [dispatchSbdFullDay, setDispatchSbdFullDay] = useState("");
  const [dispatchRemarks, setDispatchRemarks] = useState("");
  const [dispatchSubmitted, setDispatchSubmitted] = useState(false);
  const [dispatchServerErrors, setDispatchServerErrors] = useState<Record<string, string>>({});

  const validateDispatchRate = (v: string): string | null => {
    const s = v.trim();
    if (s === "") return null;
    const n = Number(s);
    if (!Number.isFinite(n)) return "Must be a number";
    if (n < 0) return "Must be ≥ 0";
    if (n > 1_000_000) return "Too large";
    return null;
  };
  const dispatchErrors = {
    nbd: dispatchServerErrors.dispatch_nbd_tm || validateDispatchRate(dispatchNbdTm),
    sbd: dispatchServerErrors.dispatch_sbd_tm || validateDispatchRate(dispatchSbdTm),
    hourly: dispatchServerErrors.dispatch_hourly || validateDispatchRate(dispatchHourly),
    half: dispatchServerErrors.dispatch_half_day || validateDispatchRate(dispatchHalfDay),
    full: dispatchServerErrors.dispatch_full_day || validateDispatchRate(dispatchFullDay),
    sbdHourly: dispatchServerErrors.dispatch_sbd_hourly || validateDispatchRate(dispatchSbdHourly),
    sbdHalf: dispatchServerErrors.dispatch_sbd_half_day || validateDispatchRate(dispatchSbdHalfDay),
    sbdFull: dispatchServerErrors.dispatch_sbd_full_day || validateDispatchRate(dispatchSbdFullDay),
    remarks:
      dispatchServerErrors.dispatch_remarks ||
      (dispatchRemarks.length > 1000 ? "Max 1000 characters" : null),
  };
  const hasDispatchErrors = Object.values(dispatchErrors).some((e) => e !== null);
  const [signatureEstimateId, setSignatureEstimateId] = useState<string | null>(null);
  const [previewEstimate, setPreviewEstimate] = useState<any | null>(null);
  const [previewItems, setPreviewItems] = useState<any[]>([]);
  const [previewFullscreen, setPreviewFullscreen] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const formCsvInputRef = useRef<HTMLInputElement>(null);
  const brandingLogoInputRef = useRef<HTMLInputElement>(null);

  // per-estimate branding overrides
  const [brandingEnabled, setBrandingEnabled] = useState(false);
  const [brandLogoUrl, setBrandLogoUrl] = useState("");
  const [brandLogoStatus, setBrandLogoStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [brandPrimary, setBrandPrimary] = useState("");
  const [brandAccent, setBrandAccent] = useState("");
  const [brandFooter, setBrandFooter] = useState("");
  const [brandCompanyName, setBrandCompanyName] = useState("");
  const [brandUploading, setBrandUploading] = useState(false);

  // Reset render-status whenever the logo URL changes; <img> handlers below set ok/error.
  useEffect(() => {
    if (!brandingEnabled || !brandLogoUrl) { setBrandLogoStatus("idle"); return; }
    setBrandLogoStatus("loading");
  }, [brandLogoUrl, brandingEnabled]);

  // filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [clientFilter, setClientFilter] = useState<string>("all");

  const { data: estimates = [], isLoading } = useQuery({
    queryKey: ["sales quotes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estimates")
        .select("*, clients(id, company_name, contact_name, email, contact_email, phone, contact_phone, address, address_line1, city, region, postcode, country, website, billing_contact_name, billing_contact_email, billing_contact_phone), partners(id, company_name, contact_name, email, phone, address_line1, city, region, postcode, country, website, billing_contact_name, billing_contact_email, billing_contact_phone)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["estimate-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, company_name, contact_name")
        .order("company_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: partners = [] } = useQuery({
    queryKey: ["estimate-partners"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("partners")
        .select("id, company_name")
        .eq("is_active", true)
        .order("company_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: presets = [] } = useQuery({
    queryKey: ["estimate-presets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pricing_presets" as any)
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as any[];
    },
  });

  // ── Rate Cards (engineer_rate_cards) ──
  const { data: rateCards = [] } = useQuery({
    queryKey: ["estimate-rate-cards"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("engineer_rate_cards")
        .select("*")
        .eq("is_active", true)
        .order("level");
      if (error) throw error;
      return data as any[];
    },
  });

  const [rateCardOpen, setRateCardOpen] = useState(false);
  const [rateCardId, setRateCardId] = useState<string>("");
  const [fuzzyMatchEnabled, setFuzzyMatchEnabled] = useState(false);
  const [fuzzyThreshold, setFuzzyThreshold] = useState(85); // 0-100 similarity %
  type RateRow = { key: string; label: string; rate: number; defaultQty: number; qtyLabel: string; detail: string };
  const [rateSelections, setRateSelections] = useState<Record<string, { selected: boolean; qty: number; note: string }>>({});

  const selectedRateCard = useMemo(
    () => rateCards.find((r: any) => r.id === rateCardId),
    [rateCards, rateCardId]
  );

  const rateRows: RateRow[] = useMemo(() => {
    const rc = selectedRateCard;
    if (!rc) return [];
    const rows: RateRow[] = [];
    const hourly = Number(rc.hourly_rate) || 0;
    const minH = Number(rc.min_hours) || 0;
    if (hourly > 0) {
      rows.push({
        key: "hourly",
        label: `${rc.level} ${rc.level_name} — Hourly`,
        rate: hourly,
        defaultQty: Math.max(minH, 1),
        qtyLabel: "hours",
        detail: minH > 0 ? `Min ${minH} hr charge` : "Standard hourly labor",
      });
    }
    if (Number(rc.travel_rate) > 0) {
      rows.push({ key: "travel", label: "Travel", rate: Number(rc.travel_rate), defaultQty: 1, qtyLabel: "hours", detail: "Travel time to/from site" });
    }
    if (Number(rc.overtime_rate) > 0) {
      rows.push({ key: "overtime", label: "Overtime", rate: Number(rc.overtime_rate), defaultQty: 0, qtyLabel: "hours", detail: "Hours beyond standard schedule" });
    }
    if (Number(rc.after_hours_rate) > 0) {
      rows.push({ key: "after_hours", label: "After Hours", rate: Number(rc.after_hours_rate), defaultQty: 0, qtyLabel: "hours", detail: "Work outside business hours" });
    }
    if (Number(rc.weekend_rate) > 0) {
      rows.push({ key: "weekend", label: "Weekend", rate: Number(rc.weekend_rate), defaultQty: 0, qtyLabel: "hours", detail: "Saturday/Sunday work" });
    }
    if (Number(rc.holiday_rate) > 0) {
      rows.push({ key: "holiday", label: "Holiday", rate: Number(rc.holiday_rate), defaultQty: 0, qtyLabel: "hours", detail: "Public holiday work" });
    }
    if (Number(rc.emergency_multiplier) && Number(rc.emergency_multiplier) !== 1 && hourly > 0) {
      const mult = Number(rc.emergency_multiplier);
      rows.push({
        key: "emergency",
        label: `Emergency Surcharge (×${mult})`,
        rate: +(hourly * (mult - 1)).toFixed(2),
        defaultQty: 0,
        qtyLabel: "hours",
        detail: `Surcharge above hourly (${mult}× emergency multiplier)`,
      });
    }
    return rows;
  }, [selectedRateCard]);

  useEffect(() => {
    if (!selectedRateCard) { setRateSelections({}); return; }
    const next: Record<string, { selected: boolean; qty: number; note: string }> = {};
    for (const r of rateRows) {
      next[r.key] = { selected: r.defaultQty > 0, qty: r.defaultQty, note: "" };
    }
    setRateSelections(next);
    if (selectedRateCard.currency && selectedRateCard.currency !== currency) {
      setCurrency(selectedRateCard.currency);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rateCardId]);

  const rateCardPreviewTotal = useMemo(
    () => rateRows.reduce((s, r) => {
      const sel = rateSelections[r.key];
      if (!sel?.selected) return s;
      return s + (Number(sel.qty) || 0) * r.rate;
    }, 0),
    [rateRows, rateSelections]
  );

  const applyRateCard = () => {
    const rc = selectedRateCard;
    if (!rc) return;
    const newLines: LineItem[] = rateRows
      .filter((r) => rateSelections[r.key]?.selected && (Number(rateSelections[r.key]?.qty) || 0) > 0)
     .map((r) => {
        const sel = rateSelections[r.key];
        const detailParts = [r.detail, sel.note?.trim()].filter(Boolean);
        const unit = (r.qtyLabel || "").trim().replace(/s$/, "");
        return {
          description: `[${rc.level} ${rc.level_name}] ${r.label}${detailParts.length ? ` — ${detailParts.join(" · ")}` : ""}`,
          quantity: Number(sel.qty) || 0,
          unit_price: r.rate,
          unit,
        };
      });
    if (!newLines.length) {
      toast.error("Select at least one rate with quantity > 0");
      return;
    }
    const isEmpty = lineItems.length === 1 && !lineItems[0].description.trim() && !lineItems[0].unit_price;
    const base: LineItem[] = isEmpty ? [] : [...lineItems];
    let merged = 0;
    let added = 0;
    // Robust dedupe key: lowercase, collapse all whitespace, strip zero-width chars,
    // normalize unicode dashes/quotes/bullets, drop trailing punctuation, and round price.
    const normDesc = (s: string) =>
      (s || "")
        .normalize("NFKC")
        .replace(/[\u200B-\u200D\uFEFF]/g, "") // zero-width
        .replace(/[\u2010-\u2015\u2212]/g, "-") // dashes -> '-'
        .replace(/[\u2018\u2019\u201B\u2032]/g, "'") // single quotes
        .replace(/[\u201C\u201D\u201F\u2033]/g, '"') // double quotes
        .replace(/[•·]/g, "-")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .replace(/\s*([\-:·,;])\s*/g, "$1") // tighten around separators
        .replace(/[.,;:\-\s]+$/g, "") // trailing punctuation
        .trim();
    const normUnit = unitKey;
    const keyOf = (li: { description: string; unit_price: number | string; unit?: string }) =>
      `${normDesc(li.description)}|${Math.round(Number(li.unit_price) * 100) / 100}|${normUnit(li.unit)}`;
    // Optional fuzzy similarity (Dice coefficient on character bigrams) — robust for short strings
    const bigrams = (s: string) => {
      const out = new Map<string, number>();
      const t = ` ${s} `;
      for (let i = 0; i < t.length - 1; i++) {
        const g = t.slice(i, i + 2);
        out.set(g, (out.get(g) || 0) + 1);
      }
      return out;
    };
    const similarity = (a: string, b: string) => {
      if (!a && !b) return 1;
      if (!a || !b) return 0;
      if (a === b) return 1;
      const A = bigrams(a), B = bigrams(b);
      let inter = 0, total = 0;
      A.forEach((v) => (total += v));
      B.forEach((v) => (total += v));
      A.forEach((v, k) => {
        const w = B.get(k);
        if (w) inter += Math.min(v, w);
      });
      return total === 0 ? 0 : (2 * inter) / total;
    };
    const threshold = Math.max(0, Math.min(1, fuzzyThreshold / 100));
    const findMatch = (nl: LineItem): { idx: number; score: number; type: "exact" | "fuzzy" } => {
      const nlKey = keyOf(nl);
      const exact = base.findIndex((li) => keyOf(li) === nlKey);
      if (exact >= 0) return { idx: exact, score: 1, type: "exact" };
      if (!fuzzyMatchEnabled) return { idx: -1, score: 0, type: "fuzzy" };
      const nlPrice = Math.round(Number(nl.unit_price) * 100) / 100;
      const nlNorm = normDesc(nl.description);
      const nlUnit = normUnit(nl.unit);
      let bestIdx = -1, bestScore = 0;
      base.forEach((li, i) => {
        const liPrice = Math.round(Number(li.unit_price) * 100) / 100;
        if (liPrice !== nlPrice) return;
        if (normUnit(li.unit) !== nlUnit) return;
        const s = similarity(nlNorm, normDesc(li.description));
        if (s >= threshold && s > bestScore) { bestScore = s; bestIdx = i; }
      });
      return { idx: bestIdx, score: bestScore, type: "fuzzy" };
    };
    const sigOf = (li: { description: string; unit_price: number | string; unit?: string }) =>
      `${(li.description || "").trim()}|${normUnit(li.unit)}|${Math.round(Number(li.unit_price) * 100) / 100}`;
    const newEvents: Record<string, MergeEvent[]> = {};
    for (const nl of newLines) {
      const { idx, score, type } = findMatch(nl);
      if (idx >= 0) {
        const existing = base[idx];
        const newQty = (Number(existing.quantity) || 0) + (Number(nl.quantity) || 0);
        const sig = sigOf(existing);
        const ev: MergeEvent = {
          at: new Date().toISOString(),
          incomingDescription: nl.description,
          existingDescription: existing.description,
          normalizedIncoming: normDesc(nl.description),
          normalizedExisting: normDesc(existing.description),
          score,
          type,
          threshold: type === "fuzzy" ? threshold : undefined,
          addedQty: Number(nl.quantity) || 0,
          newQty,
          unit: existing.unit,
          unitPrice: Math.round(Number(existing.unit_price) * 100) / 100,
        };
        (newEvents[sig] ||= []).push(ev);
        base[idx] = { ...existing, quantity: newQty };
        merged++;
      } else {
        base.push(nl);
        added++;
      }
    }
    setLineItems(base.length ? base : newLines);
    setMergeLog((prev) => {
      const next = { ...prev };
      for (const [sig, evs] of Object.entries(newEvents)) {
        next[sig] = [...(next[sig] || []), ...evs];
      }
      return next;
    });
    const parts: string[] = [];
    if (added) parts.push(`added ${added}`);
    if (merged) parts.push(`merged ${merged}`);
    toast.success(`Rate card applied (${parts.join(", ")})`);
    if (merged) {
      console.groupCollapsed(`[Rate card] ${merged} line(s) merged`);
      Object.values(newEvents).flat().forEach((e) => {
        console.log(
          `${e.type.toUpperCase()} match · score ${(e.score * 100).toFixed(1)}%` +
            (e.threshold ? ` (threshold ${(e.threshold * 100).toFixed(0)}%)` : "") +
            `\n  incoming: "${e.incomingDescription}"\n  existing: "${e.existingDescription}"` +
            `\n  norm in : "${e.normalizedIncoming}"\n  norm ex : "${e.normalizedExisting}"` +
            `\n  +qty ${e.addedQty} → ${e.newQty} ${e.unit || ""} @ ${e.unitPrice}`
        );
      });
      console.groupEnd();
    }
    setRateCardOpen(false);
    setRateCardId("");
  };


  const insertPreset = (presetId: string) => {
    const p = presets.find((x: any) => x.id === presetId);
    if (!p) return;
    if (p.currency && p.currency !== currency) setCurrency(p.currency);
    if (Number(p.default_tax_rate) > 0 && (parseFloat(taxRate) || 0) === 0) {
      setTaxRate(String(p.default_tax_rate));
    }
    if (Number(p.default_discount_percent) > 0 && (parseFloat(discountPercent) || 0) === 0) {
      setDiscountPercent(String(p.default_discount_percent));
    }
    const newLine: LineItem = {
      description: p.description ? `${p.name} — ${p.description}` : p.name,
      quantity: Number(p.default_quantity) || 1,
      unit_price: Number(p.unit_price) || 0,
      unit: p.unit || "",
    };
    const isEmpty = lineItems.length === 1 && !lineItems[0].description.trim() && !lineItems[0].unit_price;
    setLineItems(isEmpty ? [newLine] : [...lineItems, newLine]);
    toast.success(`Added "${p.name}"`);
  };

  const subtotal = useMemo(
    () => lineItems.reduce((s, li) => s + (Number(li.quantity) || 0) * (Number(li.unit_price) || 0), 0),
    [lineItems]
  );
  const discountAmount = useMemo(
    () => subtotal * ((parseFloat(discountPercent) || 0) / 100),
    [subtotal, discountPercent]
  );
  const t1 = parseFloat(taxRate) || 0;
  const t2 = parseFloat(tax2Rate) || 0;
  const taxBase = Math.max(0, subtotal - discountAmount);
  const taxAmount = taxBase * (t1 / 100);
  const tax2Amount =
    taxMode === "compound"
      ? (taxBase + taxAmount) * (t2 / 100)
      : taxMode === "dual_split"
      ? taxBase * (t2 / 100)
      : 0;
  const total = taxBase + taxAmount + tax2Amount;

  const fmtMoney = (amt: number, cur: string = "USD") =>
    new Intl.NumberFormat(undefined, { style: "currency", currency: cur }).format(amt || 0);

  const upsertMutation = useMutation({
    mutationFn: async () => {
      // Validate per-estimate branding overrides before saving
      const parsed = brandingOverrideSchema.safeParse({
        enabled: brandingEnabled,
        logoUrl: brandLogoUrl,
        primaryColor: brandPrimary,
        accentColor: brandAccent,
        companyName: brandCompanyName,
        footerText: brandFooter,
      });
      if (!parsed.success) {
        const first = parsed.error.issues[0];
        throw new Error(`Branding: ${first.message}`);
      }
      const payload = {
        client_id: selectedClientId,
        partner_id: selectedPartnerId === "none" ? null : selectedPartnerId,
        title: title.trim() || null,
        currency,
        subtotal,
        discount_percent: parseFloat(discountPercent) || 0,
        discount_amount: discountAmount,
        tax_rate: parseFloat(taxRate) || 0,
        tax_amount: taxAmount,
        tax_mode: taxMode,
        tax2_label: tax2Label || null,
        tax2_rate: parseFloat(tax2Rate) || 0,
        tax2_amount: tax2Amount,
        total,
        notes: notes.trim() || null,
        valid_until: validUntil || null,
        branding_logo_url: brandingEnabled ? (brandLogoUrl || null) : null,
        branding_primary_color: brandingEnabled ? (brandPrimary || null) : null,
        branding_accent_color: brandingEnabled ? (brandAccent || null) : null,
        branding_footer_text: brandingEnabled ? (brandFooter || null) : null,
        branding_company_name: brandingEnabled ? (brandCompanyName || null) : null,
        dispatch_nbd_tm: dispatchNbdTm.trim() === "" ? null : Number(dispatchNbdTm),
        dispatch_sbd_tm: dispatchSbdTm.trim() === "" ? null : Number(dispatchSbdTm),
        dispatch_hourly: dispatchHourly.trim() === "" ? null : Number(dispatchHourly),
        dispatch_half_day: dispatchHalfDay.trim() === "" ? null : Number(dispatchHalfDay),
        dispatch_full_day: dispatchFullDay.trim() === "" ? null : Number(dispatchFullDay),
        dispatch_sbd_hourly: dispatchSbdHourly.trim() === "" ? null : Number(dispatchSbdHourly),
        dispatch_sbd_half_day: dispatchSbdHalfDay.trim() === "" ? null : Number(dispatchSbdHalfDay),
        dispatch_sbd_full_day: dispatchSbdFullDay.trim() === "" ? null : Number(dispatchSbdFullDay),
        dispatch_remarks: dispatchRemarks.trim() || null,
      };

      let estimateId = editingId;
      if (editingId) {
        const { error } = await supabase.from("estimates").update(payload).eq("id", editingId);
        if (error) throw error;
        await supabase.from("estimate_line_items").delete().eq("estimate_id", editingId);
      } else {
        const { data, error } = await supabase.from("estimates").insert(payload).select().single();
        if (error) throw error;
        estimateId = data.id;
      }

      const candidates = lineItems.filter((li) => li.description.trim());
      const missingUnit = candidates.findIndex((li) => !isUnitProvided(li.unit));
      if (missingUnit >= 0) {
        throw new Error(
          `Line item ${missingUnit + 1} ("${candidates[missingUnit].description.trim().slice(0, 40)}") is missing a unit of measure.`
        );
      }
      const items = candidates.map((li, i) => ({
        estimate_id: estimateId!,
        description: li.description.trim().slice(0, 500),
        quantity: li.quantity,
        unit_price: li.unit_price,
        total: li.quantity * li.unit_price,
        sort_order: i,
        unit: normalizeUnit(li.unit),
      }));
      if (items.length) {
        const { error } = await supabase.from("estimate_line_items").insert(items);
        if (error) throw error;
        items.forEach((it) => rememberUnit(it.unit));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales quotes"] });
      toast.success(editingId ? "Sales Quote updated" : "Sales Quote created");
      resetForm();
    },
    onError: (e: any) => {
      const msg: string = e?.message || "Failed to save sales quote";
      const m = msg.match(/field:(\w+)\s*\|\s*(.+?)(?:\s*$)/);
      if (m) {
        const field = m[1];
        const message = m[2];
        setDispatchServerErrors((prev) => ({ ...prev, [field]: message }));
        setDispatchSubmitted(true);
        toast.error(message);
        return;
      }
      toast.error(msg);
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("estimates").update({ status: status as any }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales quotes"] });
      toast.success("Status updated");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("estimates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales quotes"] });
      toast.success("Sales Quote deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const duplicateMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data: src } = await supabase
        .from("estimates").select("*").eq("id", id).single();
      const { data: items } = await supabase
        .from("estimate_line_items").select("*").eq("estimate_id", id).order("sort_order");
      if (!src) throw new Error("Source not found");
      const { id: _i, created_at, updated_at, estimate_number, signature_data, signed_at, signed_by, ...rest } = src;
      const { data: dup, error } = await supabase
        .from("estimates").insert({ ...rest, status: "draft" as any }).select().single();
      if (error) throw error;
      if (items?.length) {
        await supabase.from("estimate_line_items").insert(
          items.map(({ id: _, created_at, ...li }: any) => ({ ...li, estimate_id: dup.id }))
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estimates"] });
      toast.success("Sales Quote duplicated");
    },
  });

  const saveSignatureMutation = useMutation({
    mutationFn: async ({ id, signatureData }: { id: string; signatureData: string }) => {
      const { error } = await supabase.from("estimates")
        .update({ signature_data: signatureData, signed_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estimates"] });
      setSignatureEstimateId(null);
      toast.success("Signature saved");
    },
  });

  const resetForm = () => {
    setShowCreate(false);
    setEditingId(null);
    setTitle("");
    setSelectedClientId("");
    setSelectedPartnerId("none");
    setCurrency("USD");
    setNotes("");
    setValidUntil("");
    setTaxRate("0");
    setTaxMode("compound");
    setTax2Label("Tax 2");
    setTax2Rate("0");
    setDiscountPercent("0");
    setLineItems([{ ...emptyLine }]);
    setBrandingEnabled(false);
    setBrandLogoUrl("");
    setBrandPrimary("");
    setBrandAccent("");
    setBrandFooter("");
    setBrandCompanyName("");
    setDispatchNbdTm("");
    setDispatchSbdTm("");
    setDispatchHourly("");
    setDispatchHalfDay("");
    setDispatchFullDay("");
    setDispatchSbdHourly("");
    setDispatchSbdHalfDay("");
    setDispatchSbdFullDay("");
    setDispatchRemarks("");
    setDispatchSubmitted(false);
    setDispatchServerErrors({});
  };

  // ====== Estimate Templates ======
  const [templates, setTemplates] = useState<EstimateTemplate[]>([]);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    listEstimateTemplates().then(setTemplates).catch(() => {});
  }, []);

  const applyTemplate = (tplId: string) => {
    const t = templates.find((x) => x.id === tplId);
    if (!t) return;
    if (t.default_title) setTitle(t.default_title);
    setCurrency(t.currency);
    if (t.valid_for_days != null) {
      const d = new Date(); d.setDate(d.getDate() + t.valid_for_days);
      setValidUntil(d.toISOString().split("T")[0]);
    }
    setTaxMode((t.tax_mode as any) || "compound");
    setTaxRate(String(t.tax1_rate ?? 0));
    setTax2Label(t.tax2_label || "Tax 2");
    setTax2Rate(String(t.tax2_rate ?? 0));
    setDiscountPercent(String(t.discount_percent ?? 0));
    if (t.notes) setNotes(t.notes);
    setDispatchNbdTm(t.dispatch_nbd_tm != null ? String(t.dispatch_nbd_tm) : "");
    setDispatchSbdTm((t as any).dispatch_sbd_tm != null ? String((t as any).dispatch_sbd_tm) : "");
    setDispatchHourly(t.dispatch_hourly != null ? String(t.dispatch_hourly) : "");
    setDispatchHalfDay(t.dispatch_half_day != null ? String(t.dispatch_half_day) : "");
    setDispatchFullDay(t.dispatch_full_day != null ? String(t.dispatch_full_day) : "");
    setDispatchSbdHourly((t as any).dispatch_sbd_hourly != null ? String((t as any).dispatch_sbd_hourly) : "");
    setDispatchSbdHalfDay((t as any).dispatch_sbd_half_day != null ? String((t as any).dispatch_sbd_half_day) : "");
    setDispatchSbdFullDay((t as any).dispatch_sbd_full_day != null ? String((t as any).dispatch_sbd_full_day) : "");
    if (t.dispatch_remarks) setDispatchRemarks(t.dispatch_remarks);
    if (t.branding_enabled) {
      setBrandingEnabled(true);
      setBrandLogoUrl(t.branding_logo_url || "");
      setBrandPrimary(t.branding_primary_color || "");
      setBrandAccent(t.branding_accent_color || "");
      setBrandFooter(t.branding_footer_text || "");
      setBrandCompanyName(t.branding_company_name || "");
    }
    if (t.line_items.length) {
      setLineItems(t.line_items.map((li) => ({
        description: li.description,
        quantity: Number(li.quantity) || 1,
        unit_price: Number(li.unit_price) || 0,
        unit: li.unit || "",
      })));
    }
    toast.success(`Applied template "${t.name}"`);
  };

  // Auto-open Create with template from ?template=ID
  useEffect(() => {
    const tplId = searchParams.get("template");
    if (tplId && templates.length > 0) {
      resetForm();
      setShowCreate(true);
      setTimeout(() => applyTemplate(tplId), 0);
      searchParams.delete("template");
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templates, searchParams]);

  const openEdit = async (est: any) => {
    setEditingId(est.id);
    setTitle(est.title || "");
    setSelectedClientId(est.client_id);
    setSelectedPartnerId(est.partner_id || "none");
    setCurrency(est.currency || "USD");
    setNotes(est.notes || "");
    setValidUntil(est.valid_until || "");
    setTaxRate(String(est.tax_rate ?? 0));
    setTaxMode((est.tax_mode as any) || "compound");
    setTax2Label(est.tax2_label || "Tax 2");
    setTax2Rate(String(est.tax2_rate ?? 0));
    setDiscountPercent(String(est.discount_percent ?? 0));
    const hasBrandOverride = !!(est.branding_logo_url || est.branding_primary_color || est.branding_accent_color || est.branding_footer_text || est.branding_company_name);
    setBrandingEnabled(hasBrandOverride);
    setBrandLogoUrl(est.branding_logo_url || "");
    setBrandPrimary(est.branding_primary_color || "");
    setBrandAccent(est.branding_accent_color || "");
    setBrandFooter(est.branding_footer_text || "");
    setBrandCompanyName(est.branding_company_name || "");
    setDispatchNbdTm(est.dispatch_nbd_tm != null ? String(est.dispatch_nbd_tm) : "");
    setDispatchSbdTm(est.dispatch_sbd_tm != null ? String(est.dispatch_sbd_tm) : "");
    setDispatchHourly(est.dispatch_hourly != null ? String(est.dispatch_hourly) : "");
    setDispatchHalfDay(est.dispatch_half_day != null ? String(est.dispatch_half_day) : "");
    setDispatchFullDay(est.dispatch_full_day != null ? String(est.dispatch_full_day) : "");
    setDispatchSbdHourly(est.dispatch_sbd_hourly != null ? String(est.dispatch_sbd_hourly) : "");
    setDispatchSbdHalfDay(est.dispatch_sbd_half_day != null ? String(est.dispatch_sbd_half_day) : "");
    setDispatchSbdFullDay(est.dispatch_sbd_full_day != null ? String(est.dispatch_sbd_full_day) : "");
    setDispatchRemarks(est.dispatch_remarks || "");
    const { data: items } = await supabase
      .from("estimate_line_items").select("*").eq("estimate_id", est.id).order("sort_order");
    setLineItems(
      items?.length
        ? items.map((li: any) => ({ description: li.description, quantity: Number(li.quantity), unit_price: Number(li.unit_price), unit: li.unit || "" }))
        : [{ ...emptyLine }]
    );
    setShowCreate(true);
  };

  const addLineItem = () => setLineItems([...lineItems, { ...emptyLine }]);
  const updateLineItem = (i: number, field: keyof LineItem, value: string | number) => {
    const u = [...lineItems];
    (u[i] as any)[field] = value;
    setLineItems(u);
  };
  const removeLineItem = (i: number) => {
    if (lineItems.length > 1) setLineItems(lineItems.filter((_, idx) => idx !== i));
  };
  const moveLine = (from: number, to: number) => {
    if (to < 0 || to >= lineItems.length) return;
    const u = [...lineItems];
    const [m] = u.splice(from, 1);
    u.splice(to, 0, m);
    setLineItems(u);
  };

  const filtered = useMemo(() => {
    return estimates.filter((e: any) => {
      if (statusFilter !== "all" && e.status !== statusFilter) return false;
      if (clientFilter !== "all" && e.client_id !== clientFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const hay = [
          e.estimate_number, e.title, e.clients?.company_name,
          e.partners?.company_name, e.notes,
        ].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [estimates, statusFilter, clientFilter, search]);

  const stats = useMemo(() => {
    const sum = (s: string) => estimates
      .filter((e: any) => e.status === s)
      .reduce((acc: number, e: any) => acc + Number(e.total || 0), 0);
    return {
      total: estimates.length,
      draft: estimates.filter((e: any) => e.status === "draft").length,
      sent: estimates.filter((e: any) => e.status === "sent").length,
      approvedValue: sum("approved"),
      pipelineValue: sum("sent") + sum("draft"),
    };
  }, [estimates]);

  const exportCsv = () => {
    const rows = [
      ["Number", "Title", "Client", "Partner", "Status", "Currency", "Subtotal", "Discount", "Tax", "Total", "Valid Until", "Created"],
      ...filtered.map((e: any) => [
        e.estimate_number || "",
        e.title || "",
        e.clients?.company_name || "",
        e.partners?.company_name || "",
        e.status,
        e.currency,
        e.subtotal, e.discount_amount, e.tax_amount, e.total,
        e.valid_until || "",
        new Date(e.created_at).toISOString(),
      ]),
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `estimates-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  // === Form CSV template & upload (line items) ===
  const downloadFormTemplate = () => {
    const headers = ["description", "quantity", "unit_price", "unit"];
    const sample = lineItems.length && lineItems.some(li => li.description.trim())
      ? lineItems
      : [{ description: "Sample service", quantity: 1, unit_price: 100, unit: "hour" }];
    const rows = [headers, ...sample.map(li => [li.description, li.quantity, li.unit_price, li.unit || ""])];
    const csv = rows.map(r => r.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `estimate-line-items-template.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("Template downloaded");
  };

  const parseCsv = (text: string): string[][] => {
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
        else if (c === ',') { cur.push(field); field = ""; }
        else if (c === '\n' || c === '\r') {
          if (field !== "" || cur.length) { cur.push(field); rows.push(cur); }
          cur = []; field = "";
          if (c === '\r' && text[i + 1] === '\n') i++;
        } else field += c;
      }
    }
    if (field !== "" || cur.length) { cur.push(field); rows.push(cur); }
    return rows;
  };

  const uploadBrandLogo = async (file: File) => {
    const err = validateLogoFile(file);
    if (err) { toast.error(err); return; }
    setBrandUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `estimate-overrides/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("estimate-branding").upload(path, file, { cacheControl: "3600", upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from("estimate-branding").getPublicUrl(path);
      setBrandLogoUrl(data.publicUrl);
      toast.success("Logo uploaded");
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setBrandUploading(false);
    }
  };

  const handleUploadLineItems = async (file: File) => {
    try {
      const text = await file.text();
      const rows = parseCsv(text).filter(r => r.length && r.some(c => c.trim()));
      if (!rows.length) { toast.error("CSV is empty"); return; }
      const header = rows[0].map(h => h.trim().toLowerCase());
      const di = header.indexOf("description");
      const qi = header.indexOf("quantity");
      const pi = header.indexOf("unit_price");
      const ui = header.indexOf("unit");
      if (di < 0 || qi < 0 || pi < 0) {
        toast.error("CSV must have columns: description, quantity, unit_price");
        return;
      }
      const items: LineItem[] = rows.slice(1).map(r => ({
        description: (r[di] || "").trim().slice(0, 500),
        quantity: parseFloat(r[qi]) || 0,
        unit_price: parseFloat(r[pi]) || 0,
        unit: ui >= 0 ? (r[ui] || "").trim().slice(0, 50) : "",
      })).filter(li => li.description);
      if (!items.length) { toast.error("No valid line items found"); return; }
      setLineItems(items);
      toast.success(`Loaded ${items.length} line item${items.length > 1 ? "s" : ""}`);
    } catch (e: any) {
      toast.error(e.message || "Failed to parse CSV");
    }
  };

  // === PDF preview & download for an estimate ===
  const openPreview = async (est: any) => {
    const { data: items } = await supabase
      .from("estimate_line_items").select("*").eq("estimate_id", est.id).order("sort_order");
    setPreviewItems(items || []);
    setPreviewEstimate(est);
  };

  const { data: branding } = useEstimateBranding();
  const { data: notesTemplates = [] } = useNotesTemplates();

  const buildEstimateHtml = (est: any, items: any[]) => {
    const cur = est.currency || "USD";
    const fmt = (n: number) => new Intl.NumberFormat(undefined, { style: "currency", currency: cur }).format(Number(n) || 0);
    const esc = (s: string) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
    // Merge global branding with per-estimate overrides (overrides win when present).
    const b = {
      logo_url: est.branding_logo_url || branding?.logo_url || "",
      company_name: est.branding_company_name || branding?.company_name || "",
      company_address: branding?.company_address || "",
      company_email: branding?.company_email || "",
      company_phone: branding?.company_phone || "",
      company_website: branding?.company_website || "",
      primary_color: est.branding_primary_color || branding?.primary_color || "#2563eb",
      accent_color: est.branding_accent_color || branding?.accent_color || "#1e293b",
      footer_text: est.branding_footer_text || branding?.footer_text || "",
    };
    const primary = b.primary_color;
    const accent = b.accent_color;
    const rows = items.map(li => `
      <tr>
        <td>${esc(li.description || "")}</td>
        <td class="right">${Number(li.quantity)}</td>
        <td class="right">${fmt(Number(li.unit_price))}</td>
        <td class="right">${fmt(Number(li.quantity) * Number(li.unit_price))}</td>
      </tr>`).join("");

    const companyBlock = `
      <div class="company">
        ${b.logo_url ? `<img src="${b.logo_url}" alt="Logo" class="logo"/>` : ""}
        ${b.company_name ? `<div class="co-name">${esc(b.company_name)}</div>` : ""}
        ${b.company_address ? `<div class="co-line">${esc(b.company_address).replace(/\n/g, "<br/>")}</div>` : ""}
        ${b.company_email ? `<div class="co-line">${esc(b.company_email)}</div>` : ""}
        ${b.company_phone ? `<div class="co-line">${esc(b.company_phone)}</div>` : ""}
        ${b.company_website ? `<div class="co-line">${esc(b.company_website)}</div>` : ""}
      </div>`;

    const partner = est.partners;
    const client = est.clients;
    const partnerAddrLines = formatAddressLines(partner);
    const clientAddrLines = formatAddressLines(client);
    const partnerAddrHtml = partnerAddrLines.length
      ? `<div class="party-line addr">${partnerAddrLines.map(esc).join("<br/>")}</div>`
      : "";
    const clientAddrHtml = clientAddrLines.length
      ? `<div class="party-line addr">${clientAddrLines.map(esc).join("<br/>")}</div>`
      : "";
    const partnerBillingLines = partner
      ? [
          partner.billing_contact_name ? `<div class="party-line"><strong>Attn:</strong> ${esc(partner.billing_contact_name)}</div>` : "",
          partner.billing_contact_email ? `<div class="party-line">✉ ${esc(partner.billing_contact_email)}</div>` : "",
          partner.billing_contact_phone ? `<div class="party-line">📞 ${esc(partner.billing_contact_phone)}</div>` : "",
        ].filter(Boolean).join("")
      : "";
    const partnerBillingBlock = partnerBillingLines
      ? `<div class="party-billing"><div class="party-sublabel" style="color:${primary};">Billing Contact</div>${partnerBillingLines}</div>`
      : "";
    const partnerBlock = partner ? `
      <div class="party">
        <div class="party-label" style="color:${primary};">Partner</div>
        <div class="party-name">${esc(partner.company_name || "")}</div>
        ${partner.contact_name ? `<div class="party-line">${esc(partner.contact_name)}</div>` : ""}
        ${partnerAddrHtml}
        ${partner.phone ? `<div class="party-line">📞 ${esc(partner.phone)}</div>` : ""}
        ${partner.email ? `<div class="party-line">✉ ${esc(partner.email)}</div>` : ""}
        ${partner.website ? `<div class="party-line">${esc(partner.website)}</div>` : ""}
        ${partnerBillingBlock}
      </div>` : `<div class="party"><div class="party-label" style="color:${primary};">Partner</div><div class="party-line muted">—</div></div>`;
    const clientPhone = client?.phone || client?.contact_phone || "";
    const clientEmail = client?.email || client?.contact_email || "";
    const clientBillingLines = client
      ? [
          client.billing_contact_name ? `<div class="party-line"><strong>Attn:</strong> ${esc(client.billing_contact_name)}</div>` : "",
          client.billing_contact_email ? `<div class="party-line">✉ ${esc(client.billing_contact_email)}</div>` : "",
          client.billing_contact_phone ? `<div class="party-line">📞 ${esc(client.billing_contact_phone)}</div>` : "",
        ].filter(Boolean).join("")
      : "";
    const clientBillingBlock = clientBillingLines
      ? `<div class="party-billing"><div class="party-sublabel" style="color:${primary};">Billing Contact</div>${clientBillingLines}</div>`
      : "";
    const clientBlock = client ? `
      <div class="party">
        <div class="party-label" style="color:${primary};">Bill To / Client</div>
        <div class="party-name">${esc(client.company_name || "")}</div>
        ${client.contact_name ? `<div class="party-line">${esc(client.contact_name)}</div>` : ""}
        ${clientAddrHtml}
        ${clientPhone ? `<div class="party-line">📞 ${esc(clientPhone)}</div>` : ""}
        ${clientEmail ? `<div class="party-line">✉ ${esc(clientEmail)}</div>` : ""}
        ${client.website ? `<div class="party-line">${esc(client.website)}</div>` : ""}
        ${clientBillingBlock}
      </div>` : "";

    return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Sales Quote ${est.estimate_number || ""}</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:32px;color:${accent};}
  .head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;gap:24px;border-bottom:3px solid ${primary};padding-bottom:16px;}
  .company{font-size:11px;line-height:1.5;color:${accent};}
  .logo{max-width:160px;max-height:70px;object-fit:contain;display:block;margin-bottom:8px;}
  .co-name{font-weight:700;font-size:14px;color:${primary};margin-bottom:2px;}
  .co-line{color:#555;}
  h1{font-size:24px;margin:0 0 4px;color:${primary};letter-spacing:1px;}
  .muted{color:#666;font-size:12px;}
  .meta{font-size:12px;color:${accent};line-height:1.6;text-align:right;}
  .parties{display:flex;gap:24px;margin:16px 0 8px;}
  .party{flex:1;border:1px solid #eee;border-radius:6px;padding:12px 14px;background:#fafafa;font-size:12px;line-height:1.5;}
  .party-label{font-size:10px;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:6px;}
  .party-name{font-size:13px;font-weight:700;color:${accent};margin-bottom:4px;}
  .party-line{color:#555;}
  .party-line.addr{white-space:normal;}
  .party-billing{margin-top:8px;padding-top:8px;border-top:1px dashed #ddd;}
  .party-sublabel{font-size:9px;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:4px;opacity:0.85;}
  table.items{width:100%;border-collapse:collapse;font-size:12px;margin-top:12px;}
  table.items th{text-align:left;background:${primary};color:#fff;border:1px solid ${primary};padding:10px;font-size:11px;text-transform:uppercase;}
  table.items td{border:1px solid #eee;padding:8px;} .right{text-align:right;}
  .totals{margin-top:16px;display:flex;justify-content:flex-end;}
  .totals table{width:300px;} .totals td{border:none;padding:4px 8px;font-size:12px;}
  .total-row td{border-top:2px solid ${primary};font-weight:bold;font-size:15px;color:${primary};}
  .notes{margin-top:24px;font-size:12px;color:${accent};white-space:pre-wrap;border-top:1px solid #eee;padding-top:12px;}
  .sig{margin-top:24px;} .sig img{max-height:80px;border-bottom:1px solid #999;}
  .footer{margin-top:32px;padding-top:12px;border-top:2px solid ${primary};font-size:11px;color:#666;text-align:center;white-space:pre-wrap;}
  @media print{body{padding:16px;}}
</style></head><body>
<div class="head">
  <div style="flex:1;">
    ${companyBlock}
  </div>
  <div style="text-align:right;">
    <h1>Sales Quote</h1>
    <div class="muted">${est.estimate_number || ""}</div>
    ${est.title ? `<div style="margin-top:6px;font-weight:600;color:${accent};">${esc(est.title)}</div>` : ""}
    <div class="meta" style="margin-top:10px;">
      <div><strong>Status:</strong> ${est.status}</div>
      <div><strong>Date:</strong> ${new Date(est.created_at).toLocaleDateString()}</div>
      ${est.valid_until ? `<div><strong>Valid Until:</strong> ${new Date(est.valid_until).toLocaleDateString()}</div>` : ""}
    </div>
  </div>
</div>
<div class="parties">
  ${partnerBlock}
  ${clientBlock}
</div>
<table class="items">
  <thead><tr><th>Description</th><th class="right">Qty</th><th class="right">Unit Price</th><th class="right">Amount</th></tr></thead>
  <tbody>${rows || `<tr><td colspan="4" class="muted">No line items</td></tr>`}</tbody>
</table>
<div class="totals"><table>
  <tr><td>Subtotal</td><td class="right">${fmt(est.subtotal)}</td></tr>
  ${Number(est.discount_amount) ? `<tr><td>Discount (${est.discount_percent}%)</td><td class="right">−${fmt(est.discount_amount)}</td></tr>` : ""}
  ${Number(est.tax_amount) ? `<tr><td>${est.tax_mode === "single" ? "Tax" : "Tax 1"} (${est.tax_rate}%)</td><td class="right">${fmt(est.tax_amount)}</td></tr>` : ""}
  ${Number(est.tax2_amount) ? `<tr><td>${est.tax2_label || "Tax 2"} (${est.tax2_rate}%)${est.tax_mode === "compound" ? " · compound" : ""}</td><td class="right">${fmt(est.tax2_amount)}</td></tr>` : ""}
  <tr class="total-row"><td>Total</td><td class="right">${fmt(est.total)}</td></tr>
  </table></div>
  ${(() => {
    const cur = est.currency || "USD";
    const fmtRate = (v: any) => v == null || v === "" ? null : new Intl.NumberFormat(undefined, { style: "currency", currency: cur }).format(Number(v));
    const buildTable = (title: string, rows: Array<[string, any]>) => {
      const filtered = rows.filter(([, v]) => v);
      if (!filtered.length) return "";
      const cells = filtered.map(([k, v]) => `<tr><td>${k}</td><td class="right">${v}</td></tr>`).join("");
      return `<div style="margin-top:8px"><div style="font-weight:600;font-size:12px;margin-bottom:4px">${title}</div>
        <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb"><tbody>${cells}</tbody></table></div>`;
    };
    const nbd = buildTable("NBD (Next Business Day)", [
      ["T&M (call-out)", fmtRate(est.dispatch_nbd_tm)],
      ["Hourly", fmtRate(est.dispatch_hourly)],
      ["Half Day", fmtRate(est.dispatch_half_day)],
      ["Full Day", fmtRate(est.dispatch_full_day)],
    ]);
    const sbd = buildTable("SBD (Same Business Day)", [
      ["T&M (call-out)", fmtRate(est.dispatch_sbd_tm)],
      ["Hourly", fmtRate(est.dispatch_sbd_hourly)],
      ["Half Day", fmtRate(est.dispatch_sbd_half_day)],
      ["Full Day", fmtRate(est.dispatch_sbd_full_day)],
    ]);
    if (!nbd && !sbd && !est.dispatch_remarks) return "";
    const remarks = est.dispatch_remarks ? `<div class="muted" style="margin-top:6px;white-space:pre-wrap">${esc(est.dispatch_remarks)}</div>` : "";
    return `<div class="notes"><strong>Dispatch Pricing:</strong>${nbd}${sbd}${remarks}</div>`;
  })()}
  ${est.notes ? `<div class="notes"><strong>Notes / Terms:</strong>\n${esc(est.notes)}</div>` : ""}
${est.signature_data ? `<div class="sig"><div class="muted">Signed${est.signed_at ? " on " + new Date(est.signed_at).toLocaleString() : ""}</div><img src="${est.signature_data}" alt="Signature"/></div>` : ""}
${b.footer_text ? `<div class="footer">${esc(b.footer_text)}</div>` : ""}
</body></html>`;
  };


  const printEstimatePdf = (est: any, items: any[]) => {
    const w = window.open("", "_blank");
    if (!w) { toast.error("Popup blocked"); return; }
    w.document.write(buildEstimateHtml(est, items));
    w.document.close();
    w.onload = () => w.print();
  };

  const safeFileName = (s: string) =>
    String(s || "salesQuote").replace(/[^a-z0-9-_]+/gi, "_").replace(/^_+|_+$/g, "") || "salesQuote";

  const downloadEstimatePdf = async (est: any, items: any[]) => {
    const num = est?.estimate_number || est?.id || "salesQuote";
    const fileName = `SalesQuote_${safeFileName(num)}.pdf`;
    const tId = toast.loading(`Generating ${fileName}…`);
    try {
      const html = buildEstimateHtml(est, items);
      // Render HTML in a hidden iframe and use the browser's print-to-PDF
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      document.body.appendChild(iframe);

      const doc = iframe.contentDocument;
      if (!doc) throw new Error("Unable to access iframe document");
      doc.open();
      doc.write(html);
      doc.close();

      // Set a suggested filename via the document title (browsers use this in Save as PDF)
      const prevTitle = document.title;
      const setTitle = () => {
        try { iframe.contentDocument!.title = fileName.replace(/\.pdf$/i, ""); } catch {}
        document.title = fileName.replace(/\.pdf$/i, "");
      };

      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("PDF generation timed out")), 15000);
        const finish = () => { clearTimeout(timer); resolve(); };
        if (iframe.contentDocument?.readyState === "complete") finish();
        else iframe.onload = () => finish();
      });

      setTitle();
      const win = iframe.contentWindow;
      if (!win) throw new Error("Iframe window unavailable");
      win.focus();
      win.print();

      // Restore title and cleanup shortly after print dialog opens
      setTimeout(() => {
        document.title = prevTitle;
        document.body.removeChild(iframe);
      }, 1000);

      toast.success(`Ready to save as ${fileName}`, { id: tId });
    } catch (err: any) {
      console.error("PDF download failed", err);
      toast.error(err?.message || "Failed to generate PDF", { id: tId });
    }
  };

  return (
    <AppLayout title="Sales Quotes" subtitle="Create, manage and track client quotes">
      <div className="space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total</p><p className="text-2xl font-bold">{stats.total}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Drafts</p><p className="text-2xl font-bold">{stats.draft}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Sent</p><p className="text-2xl font-bold">{stats.sent}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Approved $</p><p className="text-xl font-bold text-green-500">{fmtMoney(stats.approvedValue)}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Pipeline $</p><p className="text-xl font-bold text-blue-500">{fmtMoney(stats.pipelineValue)}</p></CardContent></Card>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input className="pl-8 w-64" placeholder="Search number, title, client…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="pending_approval">Pending approval</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
            <Select value={clientFilter} onValueChange={setClientFilter}>
              <SelectTrigger className="w-48"><SelectValue placeholder="All clients" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All clients</SelectItem>
                {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportCsv} className="gap-2"><Download className="w-4 h-4" />CSV</Button>
            <Button onClick={() => { resetForm(); setShowCreate(true); }} className="gap-2">
              <Plus className="w-4 h-4" /> New Sales Quote
            </Button>
          </div>
        </div>

        {/* Create / Edit Dialog */}
        <Dialog open={showCreate} onOpenChange={(o) => { if (!o) resetForm(); else setShowCreate(true); }}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Sales Quote" : "Create Sales Quote"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Q2 Network upgrade quote" maxLength={200} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Customer *</Label>
                  <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                    <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                    <SelectContent>
                      {clients.length === 0 && <div className="px-2 py-1.5 text-sm text-muted-foreground">No customers found</div>}
                      {clients.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.company_name}{c.contact_name ? ` — ${c.contact_name}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Partner</Label>
                  <Select value={selectedPartnerId} onValueChange={setSelectedPartnerId}>
                    <SelectTrigger><SelectValue placeholder="No partner" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No partner</SelectItem>
                      {partners.map((p) => <SelectItem key={p.id} value={p.id}>{p.company_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Valid Until</Label>
                  <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
                </div>
              </div>

              {/* Line Items */}
              <div className="space-y-2">
                <Label>Line Items</Label>
                <div className="space-y-2">
                  {lineItems.map((li, i) => (
                    <div key={i} className="flex gap-2 items-end">
                      <div className="flex flex-col gap-0.5 pb-2">
                        <button type="button" onClick={() => moveLine(i, i - 1)} className="text-muted-foreground hover:text-foreground" aria-label="Move up">
                          <GripVertical className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex-1">
                        {i === 0 && <span className="text-xs text-muted-foreground">Description</span>}
                        <Input value={li.description} onChange={(e) => updateLineItem(i, "description", e.target.value)} placeholder="Service description" maxLength={500} />
                      </div>
                      <div className="w-20">
                        {i === 0 && <span className="text-xs text-muted-foreground">Qty</span>}
                        <Input type="number" min={0} step="0.01" value={li.quantity} onChange={(e) => updateLineItem(i, "quantity", parseFloat(e.target.value) || 0)} />
                      </div>
                      <div className="w-24">
                        {i === 0 && <span className="text-xs text-muted-foreground">Unit *</span>}
                        <UnitInput
                          value={li.unit ?? ""}
                          onChange={(v) => updateLineItem(i, "unit", v)}
                          invalid={!!li.description.trim() && !(li.unit || "").trim()}
                          ariaLabel="Unit of measure"
                        />
                      </div>
                      <div className="w-28">
                        {i === 0 && <span className="text-xs text-muted-foreground">Unit Price</span>}
                        <Input type="number" min={0} step="0.01" value={li.unit_price} onChange={(e) => updateLineItem(i, "unit_price", parseFloat(e.target.value) || 0)} />
                      </div>
                      <div className="w-28 text-right text-sm font-medium pt-5">
                        {fmtMoney(li.quantity * li.unit_price, currency)}
                      </div>
                      {(() => {
                        const sig = `${(li.description || "").trim()}|${unitKey(li.unit)}|${Math.round(Number(li.unit_price) * 100) / 100}`;
                        const events = mergeLog[sig];
                        if (!events?.length) return null;
                        return (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button type="button" className="shrink-0 pt-5 text-muted-foreground hover:text-foreground" aria-label="Why these merged">
                                <Info className="w-4 h-4" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="left" className="max-w-sm text-xs space-y-2">
                              <p className="font-medium">Merged {events.length} time{events.length === 1 ? "" : "s"} from rate card</p>
                              {events.slice(-3).map((e, idx) => (
                                <div key={idx} className="space-y-0.5 border-t border-border/40 pt-1 first:border-0 first:pt-0">
                                  <div>
                                    <span className="font-mono">{e.type === "exact" ? "exact" : "fuzzy"}</span>
                                    {" · "}
                                    <span className="font-mono">{(e.score * 100).toFixed(1)}%</span>
                                    {e.threshold !== undefined && (
                                      <span className="text-muted-foreground"> (≥ {(e.threshold * 100).toFixed(0)}%)</span>
                                    )}
                                  </div>
                                  <div><span className="text-muted-foreground">in:</span> <span className="font-mono break-all">{e.normalizedIncoming}</span></div>
                                  <div><span className="text-muted-foreground">ex:</span> <span className="font-mono break-all">{e.normalizedExisting}</span></div>
                                  <div className="text-muted-foreground">+{e.addedQty} → {e.newQty} {e.unit || ""} @ {e.unitPrice}</div>
                                </div>
                              ))}
                              {events.length > 3 && (
                                <p className="text-muted-foreground">…and {events.length - 3} earlier. Full detail in browser console.</p>
                              )}
                            </TooltipContent>
                          </Tooltip>
                        );
                      })()}
                      <Button variant="ghost" size="icon" onClick={() => removeLineItem(i)} className="shrink-0" aria-label="Remove line">
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="sm" onClick={addLineItem} className="gap-1"><Plus className="w-3 h-3" /> Add Item</Button>
                  {rateCards.length > 0 && (
                    <Button variant="outline" size="sm" onClick={() => setRateCardOpen(true)} className="gap-1">
                      <FileText className="w-3 h-3" /> Apply Rate Card
                    </Button>
                  )}
                  {Object.values(mergeLog).some((evs) => evs.length > 0) && (
                    <Button variant="outline" size="sm" onClick={() => setMergeDrawerOpen(true)} className="gap-1">
                      <Info className="w-3 h-3" /> Why these merged
                      <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px]">
                        {Object.values(mergeLog).reduce((n, evs) => n + evs.length, 0)}
                      </Badge>
                    </Button>
                  )}
                  {templates.length > 0 && (
                    <Select value="" onValueChange={applyTemplate}>
                      <SelectTrigger className="h-9 w-64">
                        <SelectValue placeholder="Apply sales quote template…" />
                      </SelectTrigger>
                      <SelectContent>
                        {templates.map((t) => (
                          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {presets.length > 0 && (
                    <Select value="" onValueChange={insertPreset}>
                      <SelectTrigger className="h-9 w-64">
                        <SelectValue placeholder="Insert from preset…" />
                      </SelectTrigger>
                      <SelectContent>
                        {presets.map((p: any) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.category ? `[${p.category}] ` : ""}{p.name} · {new Intl.NumberFormat(undefined, { style: "currency", currency: p.currency || "USD" }).format(Number(p.unit_price))}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <Button variant="outline" size="sm" onClick={downloadFormTemplate} className="gap-1">
                    <Download className="w-3 h-3" /> Download Template
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => formCsvInputRef.current?.click()} className="gap-1">
                    <Upload className="w-3 h-3" /> Upload CSV
                  </Button>
                  <input
                    ref={formCsvInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUploadLineItems(f);
                      e.target.value = "";
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Discount (%)</Label>
                  <Input type="number" min={0} max={100} step="0.1" value={discountPercent} onChange={(e) => setDiscountPercent(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Tax Mode</Label>
                  <Select value={taxMode} onValueChange={(v: any) => setTaxMode(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single">Single tax</SelectItem>
                      <SelectItem value="dual_split">Dual split (e.g. CGST/SGST)</SelectItem>
                      <SelectItem value="compound">Compound (tax-on-tax)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tax 1 Rate (%)</Label>
                  <Input type="number" min={0} step="0.1" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>{tax2Label || "Tax 2"} Rate (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.1"
                    value={tax2Rate}
                    onChange={(e) => setTax2Rate(e.target.value)}
                    disabled={taxMode === "single"}
                    placeholder={taxMode === "single" ? "—" : "0"}
                  />
                </div>
              </div>
              {taxMode !== "single" && (
                <div className="space-y-2">
                  <Label>Tax 2 Label</Label>
                  <Input value={tax2Label} onChange={(e) => setTax2Label(e.target.value)} placeholder="e.g. SGST, QST, VAT" />
                </div>
              )}
              <div className="space-y-1 text-right">
                <p className="text-xs text-muted-foreground">Subtotal: {fmtMoney(subtotal, currency)}</p>
                <p className="text-xs text-muted-foreground">Discount: −{fmtMoney(discountAmount, currency)}</p>
                <p className="text-xs text-muted-foreground">Tax 1 ({taxRate || 0}%): {fmtMoney(taxAmount, currency)}</p>
                {taxMode !== "single" && (
                  <p className="text-xs text-muted-foreground">{tax2Label || "Tax 2"} ({tax2Rate || 0}%): {fmtMoney(tax2Amount, currency)}</p>
                )}
                <p className="text-lg font-bold">Total: {fmtMoney(total, currency)}</p>
              </div>

              {/* Per-sales quote branding overrides */}
              <div className="space-y-3 rounded-md border border-border p-3 bg-muted/20">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <Label className="text-sm">Custom branding for this sales quote</Label>
                    <p className="text-[11px] text-muted-foreground">Override global PDF branding for this sales quote only.</p>
                  </div>
                  <Switch checked={brandingEnabled} onCheckedChange={setBrandingEnabled} />
                </div>
                {brandingEnabled && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Logo Preview</Label>
                        <div className={`aspect-square w-full border border-dashed rounded bg-background flex items-center justify-center overflow-hidden ${brandLogoStatus === "error" ? "border-destructive" : "border-border"}`}>
                          {brandLogoUrl ? (
                            <img
                              src={brandLogoUrl}
                              alt="Branding logo preview"
                              className="max-w-full max-h-full object-contain"
                              onLoad={() => setBrandLogoStatus("ok")}
                              onError={() => setBrandLogoStatus("error")}
                            />
                          ) : (
                            <span className="text-[10px] text-muted-foreground">No logo</span>
                          )}
                        </div>
                        {brandLogoUrl && (
                          <div className="flex items-center gap-1 text-[11px]">
                            {brandLogoStatus === "loading" && (<><Loader2 className="w-3 h-3 animate-spin text-muted-foreground" /><span className="text-muted-foreground">Checking preview…</span></>)}
                            {brandLogoStatus === "ok" && (<><CheckCircle2 className="w-3 h-3 text-green-600" /><span className="text-green-700">Renders correctly</span></>)}
                            {brandLogoStatus === "error" && (<><AlertTriangle className="w-3 h-3 text-destructive" /><span className="text-destructive">Failed to load — won't appear in PDF</span></>)}
                          </div>
                        )}
                        <input
                          ref={brandingLogoInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadBrandLogo(f); e.target.value = ""; }}
                        />
                        <Button type="button" variant="outline" size="sm" className="w-full gap-1" onClick={() => brandingLogoInputRef.current?.click()} disabled={brandUploading}>
                          <Upload className="w-3 h-3" />{brandUploading ? "Uploading…" : brandLogoUrl ? "Replace" : "Upload"}
                        </Button>
                        {brandLogoUrl && (
                          <Button type="button" variant="ghost" size="sm" className="w-full text-destructive" onClick={() => { setBrandLogoUrl(""); setBrandLogoStatus("idle"); }}>Remove</Button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Company Name</Label>
                          <Input value={brandCompanyName} onChange={(e) => setBrandCompanyName(e.target.value)} placeholder="Override company name" maxLength={120} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Primary Color</Label>
                          <div className="flex gap-2">
                            <Input type="color" value={brandPrimary || "#2563eb"} onChange={(e) => setBrandPrimary(e.target.value)} className="w-12 h-10 p-1 cursor-pointer" />
                            <Input value={brandPrimary} onChange={(e) => setBrandPrimary(e.target.value)} placeholder="#2563eb" className="flex-1" />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Accent Color</Label>
                          <div className="flex gap-2">
                            <Input type="color" value={brandAccent || "#1e293b"} onChange={(e) => setBrandAccent(e.target.value)} className="w-12 h-10 p-1 cursor-pointer" />
                            <Input value={brandAccent} onChange={(e) => setBrandAccent(e.target.value)} placeholder="#1e293b" className="flex-1" />
                          </div>
                        </div>
                        <div className="space-y-1.5 sm:col-span-2">
                          <Label className="text-xs">Footer Text</Label>
                          <Textarea rows={2} value={brandFooter} onChange={(e) => setBrandFooter(e.target.value)} placeholder="Override footer text for this sales quote" maxLength={500} />
                        </div>
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground">Empty fields fall back to your global branding settings.</p>
                  </div>
                )}
              </div>

              {/* Dispatch Pricing — optional rate card on the estimate */}
              <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Dispatch Pricing</Label>
                  <span className="text-[11px] text-muted-foreground">Rates in {currency} — leave blank if not applicable</span>
                </div>
                <Tabs defaultValue="nbd" className="w-full">
                  <TabsList className="grid grid-cols-2 w-full">
                    <TabsTrigger value="nbd">NBD (Next Business Day)</TabsTrigger>
                    <TabsTrigger value="sbd">SBD (Same Business Day)</TabsTrigger>
                  </TabsList>
                  {([
                    {
                      tab: "nbd" as const,
                      rows: [
                        { key: "nbd", field: "dispatch_nbd_tm", label: "T&M (call-out)", value: dispatchNbdTm, set: setDispatchNbdTm, err: dispatchErrors.nbd, placeholder: "150.00" },
                        { key: "nbd-h", field: "dispatch_hourly", label: "Hourly", value: dispatchHourly, set: setDispatchHourly, err: dispatchErrors.hourly, placeholder: "75.00" },
                        { key: "nbd-half", field: "dispatch_half_day", label: "Half Day", value: dispatchHalfDay, set: setDispatchHalfDay, err: dispatchErrors.half, placeholder: "300.00" },
                        { key: "nbd-full", field: "dispatch_full_day", label: "Full Day", value: dispatchFullDay, set: setDispatchFullDay, err: dispatchErrors.full, placeholder: "550.00" },
                      ],
                    },
                    {
                      tab: "sbd" as const,
                      rows: [
                        { key: "sbd", field: "dispatch_sbd_tm", label: "T&M (call-out)", value: dispatchSbdTm, set: setDispatchSbdTm, err: dispatchErrors.sbd, placeholder: "200.00" },
                        { key: "sbd-h", field: "dispatch_sbd_hourly", label: "Hourly", value: dispatchSbdHourly, set: setDispatchSbdHourly, err: dispatchErrors.sbdHourly, placeholder: "100.00" },
                        { key: "sbd-half", field: "dispatch_sbd_half_day", label: "Half Day", value: dispatchSbdHalfDay, set: setDispatchSbdHalfDay, err: dispatchErrors.sbdHalf, placeholder: "400.00" },
                        { key: "sbd-full", field: "dispatch_sbd_full_day", label: "Full Day", value: dispatchSbdFullDay, set: setDispatchSbdFullDay, err: dispatchErrors.sbdFull, placeholder: "750.00" },
                      ],
                    },
                  ]).map(({ tab, rows }) => (
                    <TabsContent key={tab} value={tab} className="pt-3">
                      <div className="rounded-md border overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/50 text-xs">
                            <tr>
                              <th className="text-left px-3 py-2 font-medium">Service</th>
                              <th className="text-right px-3 py-2 font-medium w-48">Rate ({currency})</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((f) => {
                              const showErr = (dispatchSubmitted || f.value.trim() !== "") && !!f.err;
                              return (
                                <tr key={f.key} className="border-t">
                                  <td className="px-3 py-2">{f.label}</td>
                                  <td className="px-3 py-2">
                                    <Input
                                      type="number"
                                      min={0}
                                      step="0.01"
                                      value={f.value}
                                      onChange={(e) => {
                                        f.set(e.target.value);
                                        setDispatchServerErrors((prev) => {
                                          if (!prev[f.field]) return prev;
                                          const { [f.field]: _omit, ...rest } = prev;
                                          return rest;
                                        });
                                      }}
                                      placeholder={f.placeholder}
                                      aria-invalid={showErr || undefined}
                                      className={`text-right ${showErr ? "border-destructive focus-visible:ring-destructive" : ""}`}
                                    />
                                    {showErr && <p className="text-[11px] text-destructive mt-1">{f.err}</p>}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </TabsContent>
                  ))}
                </Tabs>
                {(() => {
                  const num = (s: string) => {
                    const n = Number(s);
                    return Number.isFinite(n) && n > 0 ? n : 0;
                  };
                  const hourly = num(dispatchHourly);
                  const half = num(dispatchHalfDay);
                  const full = num(dispatchFullDay);
                  const nbd = num(dispatchNbdTm);
                  const sbd = num(dispatchSbdTm);
                  if (!hourly && !half && !full && !nbd && !sbd) return null;
                  const fmtCur = (v: number) =>
                    new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "USD" }).format(v);
                  const parts: string[] = [];
                  if (sbd && nbd) {
                    const diff = sbd - nbd;
                    parts.push(`SBD vs NBD: ${diff >= 0 ? "+" : ""}${fmtCur(diff)} (${nbd ? ((diff / nbd) * 100).toFixed(0) : 0}%)`);
                  }
                  if (hourly) {
                    parts.push(`4h ≈ ${fmtCur(hourly * 4)}`);
                    parts.push(`8h ≈ ${fmtCur(hourly * 8)}`);
                  }
                  if (half && hourly) {
                    const diff = half - hourly * 4;
                    parts.push(`Half-day vs 4h: ${diff >= 0 ? "+" : ""}${fmtCur(diff)}`);
                  }
                  if (full && hourly) {
                    const diff = full - hourly * 8;
                    parts.push(`Full-day vs 8h: ${diff >= 0 ? "+" : ""}${fmtCur(diff)}`);
                  }
                  if (full && half) {
                    parts.push(`2× Half = ${fmtCur(half * 2)} vs Full ${fmtCur(full)}`);
                  }
                  return (
                    <div className="rounded-md border border-border/60 bg-background/60 p-2 text-[11px] text-muted-foreground space-y-0.5">
                      <div className="font-medium text-foreground">Live summary</div>
                      {parts.length > 0 ? (
                        parts.map((p, i) => <div key={i}>• {p}</div>)
                      ) : (
                        <div>Enter rates to see comparisons.</div>
                      )}
                    </div>
                  );
                })()}
                <div className="space-y-1">
                  <Label className={`text-xs ${dispatchSubmitted && dispatchErrors.remarks ? "text-destructive" : ""}`}>Remarks</Label>
                  <Textarea
                    rows={2}
                    value={dispatchRemarks}
                    onChange={(e) => {
                      setDispatchRemarks(e.target.value);
                      setDispatchServerErrors((prev) => {
                        if (!prev.dispatch_remarks) return prev;
                        const { dispatch_remarks: _omit, ...rest } = prev;
                        return rest;
                      });
                    }}
                    placeholder="e.g. After-hours surcharge applies, travel billed separately…"
                    maxLength={1000}
                    aria-invalid={(dispatchSubmitted && !!dispatchErrors.remarks) || undefined}
                    className={dispatchSubmitted && dispatchErrors.remarks ? "border-destructive focus-visible:ring-destructive" : ""}
                  />
                  <div className="flex justify-between text-[11px]">
                    {dispatchSubmitted && dispatchErrors.remarks ? (
                      <span className="text-destructive">{dispatchErrors.remarks}</span>
                    ) : <span />}
                    <span className="text-muted-foreground">{dispatchRemarks.length}/1000</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <Label>Notes / Terms</Label>
                  <Select
                    value=""
                    onValueChange={(v) => {
                      const tpl = notesTemplates.find((t: any) => t.id === v);
                      if (!tpl) return;
                      setNotes((prev) => (prev.trim() ? `${prev.trim()}\n\n${tpl.content}` : tpl.content));
                      toast.success(`Inserted "${tpl.label}"`);
                    }}
                  >
                    <SelectTrigger className="h-8 w-64">
                      <SelectValue placeholder={notesTemplates.length ? "Insert predefined terms…" : "No templates available"} />
                    </SelectTrigger>
                    <SelectContent>
                      {notesTemplates.filter((t: any) => t.is_active).map((t: any) => (
                        <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Payment terms, scope notes, T&Cs…" rows={5} maxLength={2000} />
                <p className="text-[11px] text-muted-foreground">{notes.length}/2000 characters</p>
              </div>

              <div className="space-y-2">
                {brandingEnabled && brandLogoUrl && brandLogoStatus === "error" && (
                  <div className="flex items-start gap-2 rounded border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>The branding logo failed to render. It won't appear in the PDF preview or downloads. Replace or remove it before saving.</span>
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={resetForm}>Cancel</Button>
                  <Button
                    onClick={() => {
                      setDispatchSubmitted(true);
                      if (hasDispatchErrors) {
                        toast.error("Please fix the Dispatch Pricing errors before saving");
                        return;
                      }
                      if (brandingEnabled && brandLogoUrl && brandLogoStatus === "error") {
                        if (!confirm("The branding logo failed to load and won't appear in the PDF. Save anyway?")) return;
                      }
                      upsertMutation.mutate();
                    }}
                    disabled={
                      !selectedClientId ||
                      upsertMutation.isPending ||
                      hasDispatchErrors ||
                      lineItems.every((li) => !li.description.trim())
                    }
                  >
                    {upsertMutation.isPending ? "Saving…" : editingId ? "Save Changes" : "Create Sales Quote"}
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Approval workflow */}
        <ApprovalWorkflow />

        {/* Pricing presets */}
        <PricingPresets />

        {/* PDF branding */}
        <EstimateBrandingPanel />

        {/* Notes / Terms templates */}
        <NotesTemplates />

        {/* List */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[900px]">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">#</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Title</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Customer</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Partner</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Valid Until</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Total</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading && (
                    <tr><td colSpan={8} className="py-8 text-center text-muted-foreground">Loading…</td></tr>
                  )}
                  {!isLoading && filtered.map((est: any) => {
                    const expired = est.valid_until && new Date(est.valid_until) < new Date() && est.status === "sent";
                    return (
                      <tr key={est.id} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{est.estimate_number || "—"}</td>
                        <td className="px-4 py-3 font-medium">{est.title || <span className="text-muted-foreground">—</span>}</td>
                        <td className="px-4 py-3">{est.clients?.company_name || "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{est.partners?.company_name || "—"}</td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={`capitalize ${statusColors[est.status]}`}>{est.status}</Badge>
                          {expired && <Badge variant="outline" className="ml-1 bg-amber-500/10 text-amber-500">Overdue</Badge>}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">
                          {est.valid_until ? new Date(est.valid_until).toLocaleDateString() : "—"}
                        </td>
                        <td className="px-4 py-3 text-right font-bold">{fmtMoney(Number(est.total), est.currency)}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1 flex-wrap">
                            {est.status === "draft" && (
                              <>
                                <Button variant="ghost" size="sm" onClick={() => openEdit(est)} className="text-xs">Edit</Button>
                                <Button variant="ghost" size="sm" onClick={() => updateStatusMutation.mutate({ id: est.id, status: "sent" })} className="gap-1 text-xs"><Send className="w-3 h-3" />Send</Button>
                              </>
                            )}
                            {est.status === "sent" && (
                              <>
                                <Button variant="ghost" size="sm" onClick={() => updateStatusMutation.mutate({ id: est.id, status: "approved" })} className="gap-1 text-xs text-green-500"><Check className="w-3 h-3" />Approve</Button>
                                <Button variant="ghost" size="sm" onClick={() => updateStatusMutation.mutate({ id: est.id, status: "rejected" })} className="gap-1 text-xs text-destructive"><X className="w-3 h-3" />Reject</Button>
                              </>
                            )}
                            {(est.status === "approved" || est.status === "sent") && !est.signature_data && (
                              <Button variant="ghost" size="sm" onClick={() => setSignatureEstimateId(est.id)} className="gap-1 text-xs"><PenTool className="w-3 h-3" />Sign</Button>
                            )}
                            {est.signature_data && (
                              <span className="text-[10px] text-green-500 font-medium flex items-center gap-1"><Check className="w-3 h-3" />Signed</span>
                            )}
                            <Button variant="ghost" size="sm" onClick={() => openPreview(est)} className="gap-1 text-xs"><Eye className="w-3 h-3" />Preview</Button>
                            <Button variant="ghost" size="sm" onClick={async () => { const { data } = await supabase.from("estimate_line_items").select("*").eq("estimate_id", est.id).order("sort_order"); printEstimatePdf(est, data || []); }} className="gap-1 text-xs"><Download className="w-3 h-3" />PDF</Button>
                            <Button variant="ghost" size="sm" onClick={() => duplicateMutation.mutate(est.id)} className="gap-1 text-xs"><Copy className="w-3 h-3" />Dup</Button>
                            {(est.status === "approved" || est.status === "sent" || est.status === "draft") && (
                              <Button variant="ghost" size="sm" className="gap-1 text-xs text-blue-600"
                                onClick={() => openConvertDialog(est)}>
                                <FileOutput className="w-3 h-3" />Convert to Invoice
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" onClick={() => { if (confirm("Delete sales quote?")) deleteMutation.mutate(est.id); }} className="gap-1 text-xs text-destructive"><Trash2 className="w-3 h-3" /></Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {!isLoading && filtered.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-muted-foreground">
                        <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        No sales quotes match your filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Signature Dialog */}
        <Dialog open={!!signatureEstimateId} onOpenChange={(open) => { if (!open) setSignatureEstimateId(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><PenTool className="w-5 h-5" /> Sign Sales Quote</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">Draw your signature below to sign this sales quote.</p>
            <SignaturePad
              onSave={(dataUrl) => {
                if (signatureEstimateId) saveSignatureMutation.mutate({ id: signatureEstimateId, signatureData: dataUrl });
              }}
              existingSignature={estimates.find((e: any) => e.id === signatureEstimateId)?.signature_data}
            />
          </DialogContent>
        </Dialog>

        {/* Convert Estimate to Invoice Dialog */}
        <Dialog open={!!convertEstimate} onOpenChange={(open) => { if (!open && !converting) setConvertEstimate(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><FileOutput className="w-5 h-5" /> Convert to Invoice</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Create a new invoice from sales quote{" "}
                <span className="font-medium text-foreground">{convertEstimate?.estimate_number || ""}</span>.
                Line items, tax settings, and branding will be copied.
              </p>
              <div className="space-y-2">
                <Label htmlFor="convert-due-date">Invoice due date</Label>
                <Input
                  id="convert-due-date"
                  type="date"
                  value={convertDueDate}
                  onChange={(e) => setConvertDueDate(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Defaults to 30 days from today.</p>
              </div>
              <div className="flex items-center justify-between rounded-md border border-border p-3">
                <div className="space-y-0.5">
                  <Label htmlFor="convert-keep-linked" className="text-sm">Keep linked to sales quote</Label>
                  <p className="text-xs text-muted-foreground">Track the invoice back to this sales quote.</p>
                </div>
                <Switch id="convert-keep-linked" checked={convertKeepLinked} onCheckedChange={setConvertKeepLinked} />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setConvertEstimate(null)} disabled={converting}>Cancel</Button>
                <Button onClick={handleConvertToInvoice} disabled={converting} className="gap-2">
                  {converting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileOutput className="w-4 h-4" />}
                  Create Invoice
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Why these merged drawer */}
        <Sheet open={mergeDrawerOpen} onOpenChange={setMergeDrawerOpen}>
          <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Why these merged</SheetTitle>
              <SheetDescription>
                Pairs of line items combined when applying a rate card, with original and normalized descriptions plus similarity scores.
              </SheetDescription>
            </SheetHeader>
            <div className="mt-4 space-y-4">
              {Object.entries(mergeLog).filter(([, evs]) => evs.length).length === 0 ? (
                <p className="text-sm text-muted-foreground">No merges yet.</p>
              ) : (
                Object.entries(mergeLog)
                  .filter(([, evs]) => evs.length)
                  .map(([sig, evs]) => (
                    <div key={sig} className="border rounded-md p-3 space-y-2">
                      <div className="text-xs font-medium text-muted-foreground">
                        Target: <span className="font-mono break-all">{evs[evs.length - 1].existingDescription}</span>
                      </div>
                      {evs.map((e, idx) => (
                        <div key={idx} className="text-xs space-y-1 border-t border-border/40 pt-2 first:border-0 first:pt-0">
                          <div className="flex items-center gap-2">
                            <Badge variant={e.type === "exact" ? "secondary" : "outline"} className="text-[10px]">
                              {e.type}
                            </Badge>
                            <span className="font-mono">{(e.score * 100).toFixed(1)}%</span>
                            {e.threshold !== undefined && (
                              <span className="text-muted-foreground">≥ {(e.threshold * 100).toFixed(0)}%</span>
                            )}
                            <span className="text-muted-foreground ml-auto">
                              +{e.addedQty} → {e.newQty} {e.unit || ""} @ {e.unitPrice}
                            </span>
                          </div>
                          <div className="grid grid-cols-[60px_1fr] gap-x-2 gap-y-0.5">
                            <span className="text-muted-foreground">incoming</span>
                            <span className="font-mono break-all">{e.incomingDescription}</span>
                            <span className="text-muted-foreground">existing</span>
                            <span className="font-mono break-all">{e.existingDescription}</span>
                            <span className="text-muted-foreground">norm in</span>
                            <span className="font-mono break-all">{e.normalizedIncoming}</span>
                            <span className="text-muted-foreground">norm ex</span>
                            <span className="font-mono break-all">{e.normalizedExisting}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))
              )}
              {Object.values(mergeLog).some((evs) => evs.length > 0) && (
                <div className="flex justify-end">
                  <Button variant="ghost" size="sm" onClick={() => setMergeLog({})}>Clear log</Button>
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>

        {/* Apply Rate Card Dialog */}
        <Dialog open={rateCardOpen} onOpenChange={(o) => { setRateCardOpen(o); if (!o) setRateCardId(""); }}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Apply Rate Card</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Rate Card</Label>
                <Select value={rateCardId} onValueChange={setRateCardId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a rate card…" />
                  </SelectTrigger>
                  <SelectContent>
                    {rateCards.map((rc: any) => (
                      <SelectItem key={rc.id} value={rc.id}>
                        {rc.level} · {rc.level_name} · {fmtMoney(Number(rc.hourly_rate) || 0, rc.currency || "USD")}/hr
                        {rc.scope_of_work ? ` — ${rc.scope_of_work.slice(0, 60)}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedRateCard && (
                <>
                  {selectedRateCard.scope_of_work && (
                    <div className="text-xs text-muted-foreground bg-muted/40 rounded p-3">
                      <span className="font-medium text-foreground">Scope: </span>
                      {selectedRateCard.scope_of_work}
                    </div>
                  )}
                  <div className="space-y-2">
                    <div className="text-sm font-medium">
                      Select rates to apply — deselect any that don't apply to this task
                    </div>
                    <div className="border rounded-lg divide-y">
                      {rateRows.map((r) => {
                        const sel = rateSelections[r.key] ?? { selected: false, qty: 0, note: "" };
                        const lineTotal = (Number(sel.qty) || 0) * r.rate;
                        return (
                          <div key={r.key} className={`p-3 ${sel.selected ? "" : "opacity-60"}`}>
                            <div className="flex items-start gap-3">
                              <Checkbox
                                checked={sel.selected}
                                onCheckedChange={(v) =>
                                  setRateSelections((prev) => ({
                                    ...prev,
                                    [r.key]: { ...sel, selected: !!v },
                                  }))
                                }
                                className="mt-1"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-medium text-sm">{r.label}</span>
                                  <Badge variant="secondary" className="text-xs">
                                    {fmtMoney(r.rate, selectedRateCard.currency || currency)} / {r.qtyLabel.replace(/s$/, "")}
                                  </Badge>
                                </div>
                                <div className="text-xs text-muted-foreground mt-0.5">{r.detail}</div>
                                <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr_120px] gap-2 mt-2 items-center">
                                  <div>
                                    <Label className="text-xs">Qty ({r.qtyLabel})</Label>
                                    <Input
                                      type="number"
                                      min={0}
                                      step="0.25"
                                      value={sel.qty}
                                      disabled={!sel.selected}
                                      onChange={(e) =>
                                        setRateSelections((prev) => ({
                                          ...prev,
                                          [r.key]: { ...sel, qty: parseFloat(e.target.value) || 0 },
                                        }))
                                      }
                                      className="h-8"
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-xs">Task detail (optional)</Label>
                                    <Input
                                      value={sel.note}
                                      disabled={!sel.selected}
                                      placeholder="e.g. Onsite cabling, rack 4"
                                      maxLength={200}
                                      onChange={(e) =>
                                        setRateSelections((prev) => ({
                                          ...prev,
                                          [r.key]: { ...sel, note: e.target.value },
                                        }))
                                      }
                                      className="h-8"
                                    />
                                  </div>
                                  <div className="text-right text-sm font-medium">
                                    {fmtMoney(lineTotal, selectedRateCard.currency || currency)}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {rateRows.length === 0 && (
                        <div className="p-4 text-sm text-muted-foreground">This rate card has no chargeable rates configured.</div>
                      )}
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t">
                      <span className="text-sm text-muted-foreground">Estimated subtotal from selected rates</span>
                      <span className="font-semibold">
                        {fmtMoney(rateCardPreviewTotal, selectedRateCard.currency || currency)}
                      </span>
                    </div>
                  </div>
                </>
              )}

              <div className="flex flex-col gap-2 pt-2 border-t">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-col">
                    <Label className="text-sm">Fuzzy description matching</Label>
                    <span className="text-xs text-muted-foreground">
                      Merge with existing line items whose descriptions are similar (same unit price required).
                    </span>
                  </div>
                  <Switch checked={fuzzyMatchEnabled} onCheckedChange={setFuzzyMatchEnabled} />
                </div>
                {fuzzyMatchEnabled && (
                  <div className="flex items-center gap-3">
                    <Label className="text-xs whitespace-nowrap">Similarity threshold</Label>
                    <Slider
                      value={[fuzzyThreshold]}
                      onValueChange={(v) => setFuzzyThreshold(v[0] ?? 85)}
                      min={50}
                      max={100}
                      step={1}
                      className="flex-1"
                    />
                    <span className="text-xs font-mono w-10 text-right">{fuzzyThreshold}%</span>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setRateCardOpen(false)}>Cancel</Button>
                <Button onClick={applyRateCard} disabled={!selectedRateCard || rateCardPreviewTotal <= 0}>
                  Add to Line Items
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Estimate PDF Preview Dialog (supports full-screen print preview) */}

        <Dialog
          open={!!previewEstimate}
          onOpenChange={(o) => {
            if (!o) {
              setPreviewEstimate(null);
              setPreviewItems([]);
              setPreviewFullscreen(false);
            }
          }}
        >
          <DialogContent
            className={
              previewFullscreen
                ? "max-w-none w-screen h-screen sm:rounded-none p-4 flex flex-col gap-3"
                : "max-w-5xl max-h-[92vh] overflow-hidden flex flex-col gap-3"
            }
          >
            <DialogHeader className="shrink-0">
              <DialogTitle className="flex items-center justify-between gap-2 flex-wrap pr-6">
                <span className="flex items-center gap-2">
                  <Eye className="w-5 h-5" /> Sales Quote Preview
                  {previewEstimate?.estimate_number && (
                    <span className="text-xs font-normal text-muted-foreground">
                      {previewEstimate.estimate_number}
                    </span>
                  )}
                </span>
                {previewEstimate && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <EstimatePartyEditor
                      kind="partner"
                      party={previewEstimate.partners}
                      onSaved={() => {
                        // Re-fetch the latest estimate so preview reflects edits
                        queryClient.invalidateQueries({ queryKey: ["estimates"] }).then(async () => {
                          const { data } = await supabase
                            .from("estimates")
                            .select("*, clients(id, company_name, contact_name, email, contact_email, phone, contact_phone, address, address_line1, city, region, postcode, country, website, billing_contact_name, billing_contact_email, billing_contact_phone), partners(id, company_name, contact_name, email, phone, address_line1, city, region, postcode, country, website, billing_contact_name, billing_contact_email, billing_contact_phone)")
                            .eq("id", previewEstimate.id)
                            .maybeSingle();
                          if (data) setPreviewEstimate(data);
                        });
                      }}
                    />
                    <EstimatePartyEditor
                      kind="client"
                      party={previewEstimate.clients}
                      onSaved={async () => {
                        queryClient.invalidateQueries({ queryKey: ["estimates"] });
                        const { data } = await supabase
                          .from("estimates")
                          .select("*, clients(id, company_name, contact_name, email, contact_email, phone, contact_phone, address, address_line1, city, region, postcode, country, website, billing_contact_name, billing_contact_email, billing_contact_phone), partners(id, company_name, contact_name, email, phone, address_line1, city, region, postcode, country, website, billing_contact_name, billing_contact_email, billing_contact_phone)")
                          .eq("id", previewEstimate.id)
                          .maybeSingle();
                        if (data) setPreviewEstimate(data);
                      }}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPreviewFullscreen((v) => !v)}
                      className="gap-1"
                    >
                      {previewFullscreen ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
                      {previewFullscreen ? "Exit full screen" : "Full screen"}
                    </Button>
                    <TooltipProvider>
                      {(() => {
                        const clientRes = resolveBillingRecipient(previewEstimate?.clients);
                        const partnerRes = resolveBillingRecipient(previewEstimate?.partners);
                        const primary = clientRes.recipient || partnerRes.recipient;
                        const secondary =
                          clientRes.recipient && partnerRes.recipient && clientRes.recipient.email !== partnerRes.recipient.email
                            ? partnerRes.recipient
                            : null;
                        const cc = secondary?.email || "";
                        const allInvalid = [...clientRes.invalid, ...partnerRes.invalid];
                        const estNo = previewEstimate?.estimate_number || previewEstimate?.id;
                        const link = `${window.location.origin}/estimates?id=${encodeURIComponent(previewEstimate?.id || "")}`;
                        const subject = `Sales Quote Ready: ${estNo}`;
                        const attnLine = primary?.source === "billing" && primary?.name ? `Attn: ${primary.name}\n` : "";
                        const body = `${attnLine}Your sales quote ${estNo} is ready.\n\nView it here: ${link}\n\nThank you.`;
                        const href = primary
                          ? `mailto:${encodeURIComponent(primary.email)}${cc ? `?cc=${encodeURIComponent(cc)}&` : "?"}subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
                          : "";
                        const sourceLabel = (s: RecipientSource) =>
                          s === "billing" ? "billing contact" : s === "contact" ? "contact email" : "primary email — no billing contact set";
                        const tooltipText = !primary
                          ? allInvalid.length
                            ? `Email addresses look invalid: ${allInvalid.map((i) => `${i.source} (${i.raw})`).join(", ")}. Fix them on the partner or client record.`
                            : "No email found on client or partner. Add a billing contact, contact, or primary email first."
                          : `Sending to ${primary.email} (${sourceLabel(primary.source)})${cc ? ` · cc ${cc}` : ""}${allInvalid.length ? ` · skipped invalid: ${allInvalid.map((i) => i.source).join(", ")}` : ""}`;
                        return (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={!primary}
                                  onClick={() => {
                                    if (!primary) {
                                      if (allInvalid.length) {
                                        toast.error("All available email addresses are invalid", {
                                          description: allInvalid
                                            .map((i) => `${i.source}: "${i.raw}"`)
                                            .join(" · "),
                                        });
                                      } else {
                                        toast.error("No recipient email available");
                                      }
                                      return;
                                    }
                                    if (allInvalid.length) {
                                      toast.warning("Skipped invalid email address(es)", {
                                        description: allInvalid
                                          .map((i) => `${i.source}: "${i.raw}"`)
                                          .join(" · "),
                                      });
                                    }
                                    if (primary.source !== "billing") {
                                      toast.message("No billing contact email set — using fallback", {
                                        description: `Sent to ${primary.email}`,
                                      });
                                    }
                                    window.location.href = href;
                                  }}
                                  className="gap-1"
                                >
                                  <Mail className="w-3 h-3" /> Email sales quote
                                </Button>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-[260px] text-xs">
                              {tooltipText}
                            </TooltipContent>
                          </Tooltip>
                        );
                      })()}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => printEstimatePdf(previewEstimate, previewItems)}
                            className="gap-1"
                          >
                            <Printer className="w-3 h-3" /> Print to PDF
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-[240px] text-xs">
                          Opens your browser's print dialog. Choose "Save as PDF" as the destination to print or save manually.
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            disabled={downloadingPdf}
                            onClick={async () => {
                              setDownloadingPdf(true);
                              try {
                                await downloadEstimatePdf(previewEstimate, previewItems);
                              } finally {
                                setDownloadingPdf(false);
                              }
                            }}
                            className="gap-1"
                          >
                            {downloadingPdf
                              ? <><Loader2 className="w-3 h-3 animate-spin" /> Generating…</>
                              : <><Download className="w-3 h-3" /> Download PDF{previewEstimate?.estimate_number ? ` (${previewEstimate.estimate_number})` : ""}</>}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-[240px] text-xs">
                          Generates the sales quote PDF with the filename SalesQuote_{previewEstimate?.estimate_number || previewEstimate?.id}.pdf and saves it via your browser's print-to-PDF flow.
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                )}
              </DialogTitle>
            </DialogHeader>
            {previewEstimate && (
              <iframe
                title="Sales quote preview"
                className={
                  previewFullscreen
                    ? "w-full flex-1 rounded border border-border bg-white"
                    : "w-full flex-1 min-h-[60vh] rounded border border-border bg-white"
                }
                srcDoc={buildEstimateHtml(previewEstimate, previewItems)}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default Estimates;
