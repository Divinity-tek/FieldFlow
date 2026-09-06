import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { buildDocHtml, openDocPdf, type DocBuildInput, type FinLineItem, type TaxMode } from "@/lib/financialDocs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function loadInvoice(idOrNumber: string, hint?: "id" | "number"): Promise<DocBuildInput> {
  const trimmed = idOrNumber.trim();
  const isUuid = UUID_RE.test(trimmed);
  const select = "*, clients(company_name, contact_email, contact_phone, address), partners(company_name, contact_name, email, phone, address_line1, city, region, postcode, country), estimates(estimate_number)";
  const tryBy = async (col: "id" | "invoice_number") => {
    const { data, error } = await supabase.from("invoices").select(select).eq(col, trimmed).limit(1);
    if (error) throw new Error(error.message);
    return data?.[0];
  };
  // Order: explicit hint > uuid heuristic > fallback to the other column
  const order: Array<"id" | "invoice_number"> =
    hint === "id" ? ["id", "invoice_number"]
    : hint === "number" ? ["invoice_number", "id"]
    : isUuid ? ["id", "invoice_number"]
    : ["invoice_number", "id"];
  let inv: any = null;
  for (const col of order) {
    inv = await tryBy(col);
    if (inv) break;
  }
  if (!inv) throw new Error("Invoice not found");
  const { data: items, error: liErr } = await supabase
    .from("invoice_line_items")
    .select("*")
    .eq("invoice_id", inv.id)
    .order("sort_order");
  if (liErr) throw new Error(liErr.message);
  return {
    kind: "invoice",
    number: inv.invoice_number,
    status: inv.status,
    title: inv.title,
    currency: inv.currency || "USD",
    issued_at: inv.created_at,
    due_date: inv.due_date,
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
    balance_due: Number(inv.balance_due ?? Number(inv.total) - Number(inv.amount_paid || 0)),
    lineItems: (items || []) as FinLineItem[],
    notes: inv.notes,
    signature_data: inv.signature_data,
    signed_at: inv.signed_at,
    signed_by: inv.signed_by,
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
    linkedRef:
      inv.estimate_id && inv.estimates?.estimate_number
        ? { kind: "estimate", number: inv.estimates.estimate_number }
        : null,
    payment_terms: inv.due_date
      ? `Payment due by ${new Date(inv.due_date).toLocaleDateString()}.`
      : "Payment due upon receipt.",
  };
}

const LONG_WORDS = [
  "supercalifragilisticexpialidocious",
  "pneumonoultramicroscopicsilicovolcanoconiosis",
  "antidisestablishmentarianism",
  "thermohydrodynamicstabilization",
];

function makeDescription(i: number, longText: boolean) {
  const base = `Line ${i + 1}: On-site engineering visit, diagnostics, parts replacement, calibration and post-service verification`;
  if (!longText) return base;
  return `${base} — including ${LONG_WORDS[i % LONG_WORDS.length]} procedures, multi-stage validation across redundant subsystems, customer sign-off documentation, photographic evidence capture, and remote telemetry baseline reconfiguration.`;
}

function buildSampleDoc(opts: { count: number; longText: boolean; withTaxes: boolean; signed: boolean }): DocBuildInput {
  const items: FinLineItem[] = Array.from({ length: opts.count }, (_, i) => ({
    description: makeDescription(i, opts.longText),
    quantity: (i % 4) + 1,
    unit_price: 75 + (i % 7) * 12.5,
    tax1_rate: opts.withTaxes ? (i % 2 ? 8.25 : 5) : 0,
    tax2_rate: opts.withTaxes && i % 3 === 0 ? 2.5 : 0,
  }));
  const subtotal = items.reduce((s, li) => s + li.quantity * li.unit_price, 0);
  const taxAmount = opts.withTaxes ? subtotal * 0.0825 : 0;
  const tax2Amount = opts.withTaxes ? subtotal * 0.0125 : 0;
  const total = subtotal + taxAmount + tax2Amount;
  return {
    kind: "invoice",
    number: "PREVIEW-0001",
    status: "draft",
    currency: "USD",
    issued_at: new Date(),
    due_date: new Date(Date.now() + 14 * 86400000),
    subtotal,
    tax_mode: opts.withTaxes ? "dual_split" : "single",
    tax1_label: "GST",
    tax_rate: 8.25,
    tax_amount: taxAmount,
    tax2_label: "PST",
    tax2_rate: 1.25,
    tax2_amount: tax2Amount,
    total,
    balance_due: total,
    lineItems: items,
    notes: "Preview document — used to verify wrapping, hyphenation and tax-tag rendering before sending PDFs or emails.",
    payment_terms: "Net 14",
    from: { name: "Your Company", email: "billing@example.com", address: "100 Field Street\nMetro City" },
    to: { name: "Acme Logistics International", email: "ap@acme.example", address: "9001 Industrial Pkwy\nLong Address Line That Should Wrap Cleanly" },
    signed_at: opts.signed ? new Date() : null,
    signed_by: opts.signed ? "Jane Operator" : null,
    signature_data: opts.signed
      ? "data:image/svg+xml;utf8," +
        encodeURIComponent(
          `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 240 80'><path d='M5 60 C 40 10, 80 90, 120 40 S 200 10, 235 50' stroke='#0f172a' stroke-width='2' fill='none'/></svg>`
        )
      : null,
  };
}

export default function InvoicePreview() {
  const [count, setCount] = useState(18);
  const [longText, setLongText] = useState(true);
  const [withTaxes, setWithTaxes] = useState(true);
  const [signed, setSigned] = useState(true);
  const [html, setHtml] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [lookup, setLookup] = useState("");
  const [loadedDoc, setLoadedDoc] = useState<DocBuildInput | null>(null);
  const [loadedLabel, setLoadedLabel] = useState<string>("");
  const [searchParams, setSearchParams] = useSearchParams();
  const { idOrNumber: pathIdOrNumber } = useParams();
  const autoLoadedRef = useRef<string | null>(null);

  const sampleDoc = useMemo(
    () => buildSampleDoc({ count, longText, withTaxes, signed }),
    [count, longText, withTaxes, signed]
  );
  const doc = loadedDoc ?? sampleDoc;

  const refresh = async () => {
    setLoading(true);
    try {
      const out = await buildDocHtml(doc);
      setHtml(out);
    } finally {
      setLoading(false);
    }
  };

  const openPdf = async () => {
    await openDocPdf(doc);
  };

  const handleLoad = async (override?: string, hint?: "id" | "number") => {
    const target = (override ?? lookup).trim();
    if (!target) {
      toast.error("Enter an invoice number or ID");
      return;
    }
    setLoading(true);
    const tId = toast.loading(`Loading invoice ${target}…`);
    try {
      const d = await loadInvoice(target, hint);
      setLoadedDoc(d);
      setLoadedLabel(d.number || target);
      const out = await buildDocHtml(d);
      setHtml(out);
      toast.success(`Loaded invoice ${d.number || ""}`, { id: tId });
    } catch (e: any) {
      toast.error(e?.message || "Failed to load invoice", { id: tId });
    } finally {
      setLoading(false);
    }
  };

  const clearLoaded = () => {
    setLoadedDoc(null);
    setLoadedLabel("");
    setHtml("");
    if (searchParams.get("id") || searchParams.get("number") || searchParams.get("invoice")) {
      const next = new URLSearchParams(searchParams);
      next.delete("id");
      next.delete("number");
      next.delete("invoice");
      setSearchParams(next, { replace: true });
    }
  };

  useEffect(() => {
    // Resolve target + hint from any supported source:
    // path: /invoices/preview/:idOrNumber
    // query: ?id=... | ?number=... | ?invoice=...
    const idQ = searchParams.get("id");
    const numQ = searchParams.get("number");
    const generic = searchParams.get("invoice") || pathIdOrNumber || "";
    let target = "";
    let hint: "id" | "number" | undefined;
    if (idQ) { target = idQ; hint = "id"; }
    else if (numQ) { target = numQ; hint = "number"; }
    else if (generic) { target = generic; }
    target = target.trim();
    if (!target) return;
    const key = `${hint ?? "auto"}:${target}`;
    if (autoLoadedRef.current === key) return;
    autoLoadedRef.current = key;
    setLookup(target);
    handleLoad(target, hint);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, pathIdOrNumber]);

  return (
    <div className="container mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Invoice Preview</h1>
          <p className="text-sm text-muted-foreground">
            Inspect wrapping, hyphenation, tax tags, totals and pagination before sending PDFs or emails.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={refresh} disabled={loading}>
            {loading ? "Rendering…" : "Render Preview"}
          </Button>
          <Button onClick={openPdf}>Open Print Preview</Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Load Existing Invoice</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col md:flex-row gap-3 md:items-end">
          <div className="flex-1 space-y-2">
            <Label htmlFor="lookup">Invoice number or ID</Label>
            <Input
              id="lookup"
              placeholder="e.g. INV-20250101-ab12cd or a UUID"
              value={lookup}
              onChange={(e) => setLookup(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleLoad();
              }}
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={() => handleLoad()} disabled={loading}>
              {loading ? "Loading…" : "Load Invoice"}
            </Button>
            {loadedDoc && (
              <Button variant="outline" onClick={clearLoaded}>
                Use Sample
              </Button>
            )}
          </div>
          {loadedDoc && (
            <div className="text-sm text-muted-foreground md:ml-2">
              Showing real invoice <strong>{loadedLabel}</strong>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Sample Controls {loadedDoc && <span className="text-xs text-muted-foreground">(disabled while a real invoice is loaded)</span>}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="space-y-2 md:col-span-2">
            <Label>Line items: {count}</Label>
            <Slider min={1} max={80} step={1} value={[count]} onValueChange={(v) => setCount(v[0])} disabled={!!loadedDoc} />
          </div>
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="long">Long descriptions</Label>
            <Switch id="long" checked={longText} onCheckedChange={setLongText} disabled={!!loadedDoc} />
          </div>
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="tax">Show tax tags</Label>
            <Switch id="tax" checked={withTaxes} onCheckedChange={setWithTaxes} disabled={!!loadedDoc} />
          </div>
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="sig">Include signature</Label>
            <Switch id="sig" checked={signed} onCheckedChange={setSigned} disabled={!!loadedDoc} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rendered Document</CardTitle>
        </CardHeader>
        <CardContent>
          {html ? (
            <iframe
              title="Invoice preview"
              srcDoc={html}
              className="w-full bg-white rounded border"
              style={{ height: "1200px" }}
            />
          ) : (
            <div className="text-sm text-muted-foreground">
              Click <strong>Render Preview</strong> to generate the document with the current controls.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
