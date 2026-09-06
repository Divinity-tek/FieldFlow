import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

// CSV column spec — order matters for the template
const COLUMNS = [
  { key: "company_name",  label: "company_name",  required: true,  hint: "Legal/trading name (required)" },
  { key: "contact_name",  label: "contact_name",  required: true,  hint: "Primary contact person (required)" },
  { key: "email",         label: "email",         required: true,  hint: "Primary contact email (required, unique-ish)" },
  { key: "phone",         label: "phone",         required: false, hint: "International format e.g. +44 20 7946 0123" },
  { key: "address",       label: "address",       required: false, hint: "Full single-line address" },
  { key: "website",       label: "website",       required: false, hint: "https://example.com" },
  { key: "tax_country",   label: "tax_country",   required: false, hint: "Country of tax residence" },
  { key: "tax_id",        label: "tax_id",        required: false, hint: "VAT / EIN / GST number" },
  { key: "contact_email", label: "contact_email", required: false, hint: "Secondary contact email" },
  { key: "contact_phone", label: "contact_phone", required: false, hint: "Secondary contact phone" },
  { key: "notes",         label: "notes",         required: false, hint: "Free-text onboarding notes" },
  { key: "status",        label: "status",        required: false, hint: "active | inactive (defaults to active)" },
] as const;

type Row = Record<string, string>;
type ParsedRow = { row: number; values: Row; errors: string[] };

// Lightweight CSV parser (handles quotes, commas inside quotes, CRLF)
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let val = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { val += '"'; i++; }
        else inQuotes = false;
      } else val += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") { cur.push(val); val = ""; }
      else if (ch === "\n") { cur.push(val); rows.push(cur); cur = []; val = ""; }
      else if (ch === "\r") { /* skip */ }
      else val += ch;
    }
  }
  if (val.length > 0 || cur.length > 0) { cur.push(val); rows.push(cur); }
  return rows.filter((r) => r.some((c) => c.trim().length > 0));
}

function buildTemplateCsv(): string {
  const header = COLUMNS.map((c) => c.label).join(",");
  const sample1 = [
    "Acme Industries Ltd","Jane Doe","jane@acme.example","+44 20 7946 0000",
    "10 Downing Street, London SW1A 2AA","https://acme.example","United Kingdom",
    "GB123456789","billing@acme.example","+44 20 7946 0001","Priority customer","active",
  ].map((v) => /[,"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v).join(",");
  const sample2 = [
    "Globex Manufacturing","John Smith","john@globex.example","+1 415 555 0142",
    "500 Market St, San Francisco CA 94105","https://globex.example","United States",
    "EIN 12-3456789","ap@globex.example","+1 415 555 0143","Net-30 terms","active",
  ].map((v) => /[,"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v).join(",");
  return [header, sample1, sample2].join("\n");
}

function downloadTemplate() {
  const csv = buildTemplateCsv();
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "client-onboarding-template.csv"; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function isValidEmail(e: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

export default function BulkClientImport() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [parsed, setParsed] = useState<ParsedRow[] | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; failed: number }>({ done: 0, total: 0, failed: 0 });
  const fileRef = useRef<HTMLInputElement | null>(null);

  const reset = () => { setParsed(null); setFileName(""); setProgress({ done: 0, total: 0, failed: 0 }); if (fileRef.current) fileRef.current.value = ""; };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast({ title: "File too large", description: "Max 2MB.", variant: "destructive" }); return; }
    setFileName(file.name);
    const text = await file.text();
    const rows = parseCsv(text);
    if (rows.length === 0) { toast({ title: "Empty file", variant: "destructive" }); return; }

    const header = rows[0].map((h) => h.trim().toLowerCase());
    const colIndex: Record<string, number> = {};
    COLUMNS.forEach((c) => { colIndex[c.key] = header.indexOf(c.label); });

    const missingRequired = COLUMNS.filter((c) => c.required && colIndex[c.key] === -1).map((c) => c.label);
    if (missingRequired.length > 0) {
      toast({ title: "Missing required columns", description: missingRequired.join(", "), variant: "destructive" });
      reset();
      return;
    }

    const out: ParsedRow[] = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const values: Row = {};
      const errs: string[] = [];
      COLUMNS.forEach((c) => {
        const idx = colIndex[c.key];
        const v = idx >= 0 ? (r[idx] ?? "").trim() : "";
        values[c.key] = v;
      });
      if (!values.company_name) errs.push("company_name required");
      if (!values.contact_name) errs.push("contact_name required");
      if (!values.email) errs.push("email required");
      else if (!isValidEmail(values.email)) errs.push("email invalid");
      if (values.contact_email && !isValidEmail(values.contact_email)) errs.push("contact_email invalid");
      if (values.website && !/^https?:\/\//i.test(values.website)) errs.push("website must start with http(s)://");
      if (values.status && !["active", "inactive"].includes(values.status.toLowerCase())) errs.push("status must be active or inactive");
      out.push({ row: i + 1, values, errors: errs });
    }
    setParsed(out);
  };

  const validRows = parsed?.filter((p) => p.errors.length === 0) ?? [];
  const errorRows = parsed?.filter((p) => p.errors.length > 0) ?? [];

  const submit = async () => {
    if (validRows.length === 0) return;
    setSubmitting(true);
    setProgress({ done: 0, total: validRows.length, failed: 0 });

    // Resolve current user + (optional) partner so RLS lets the importer see their new clients
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData?.user?.id ?? null;
    let partnerId: string | null = null;
    if (userId) {
      const { data: partnerRow } = await supabase
        .from("partners")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();
      partnerId = partnerRow?.id ?? null;
    }

    // Insert in chunks so failures don't block everything
    const chunkSize = 25;
    let done = 0, failed = 0;
    for (let i = 0; i < validRows.length; i += chunkSize) {
      const chunk = validRows.slice(i, i + chunkSize).map((r) => ({
        company_name:  r.values.company_name,
        contact_name:  r.values.contact_name,
        email:         r.values.email,
        phone:         r.values.phone || null,
        address:       r.values.address || null,
        website:       r.values.website || null,
        tax_country:   r.values.tax_country || null,
        tax_id:        r.values.tax_id || null,
        contact_email: r.values.contact_email || null,
        contact_phone: r.values.contact_phone || null,
        notes:         r.values.notes || null,
        status:        (r.values.status || "active").toLowerCase(),
        user_id:       userId,
        partner_id:    partnerId,
      }));
      const { error } = await supabase.from("clients").insert(chunk);
      if (error) {
        console.error("Bulk client import error:", error);
        failed += chunk.length;
      } else done += chunk.length;
      setProgress({ done, total: validRows.length, failed });
    }

    setSubmitting(false);
    qc.invalidateQueries({ queryKey: ["clients"] });
    qc.invalidateQueries({ queryKey: ["customer-portal-clients"] });
    if (failed === 0) {
      toast({ title: "Bulk import complete", description: `Imported ${done} client${done === 1 ? "" : "s"}.` });
      setOpen(false); reset();
    } else {
      toast({ title: "Import finished with errors", description: `${done} imported, ${failed} failed. Check console / try again.`, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline"><Upload className="h-4 w-4 mr-2" />Bulk Import</Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5" />Bulk Import Clients</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>How it works</AlertTitle>
            <AlertDescription className="text-sm">
              1. Download the CSV template. 2. Fill one client per row (keep the header). 3. Upload the file to preview &amp; validate. 4. Confirm to import.
            </AlertDescription>
          </Alert>

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={downloadTemplate}>
              <Download className="h-4 w-4 mr-2" />Download CSV Template
            </Button>
            <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleFile} className="hidden" id="bulk-import-file" />
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4 mr-2" />{fileName || "Choose CSV file"}
            </Button>
            {parsed && <Button variant="ghost" onClick={reset} disabled={submitting}>Clear</Button>}
          </div>

          <details className="text-sm">
            <summary className="cursor-pointer font-medium">Column reference ({COLUMNS.length} columns)</summary>
            <div className="mt-2 grid sm:grid-cols-2 gap-1 text-xs text-muted-foreground">
              {COLUMNS.map((c) => (
                <div key={c.key}>
                  <span className="font-mono text-foreground">{c.label}</span>
                  {c.required && <Badge variant="outline" className="ml-1 text-[10px]">required</Badge>}
                  <span className="ml-1">— {c.hint}</span>
                </div>
              ))}
            </div>
          </details>

          {parsed && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-3 text-sm">
                <Badge variant="outline" className="gap-1"><CheckCircle2 className="h-3 w-3 text-green-600" />{validRows.length} valid</Badge>
                {errorRows.length > 0 && <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" />{errorRows.length} with errors</Badge>}
                <Badge variant="secondary">{parsed.length} total</Badge>
              </div>

              <div className="border rounded-md max-h-80 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Row</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Country</TableHead>
                      <TableHead>Status / Errors</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsed.map((p) => (
                      <TableRow key={p.row} className={p.errors.length ? "bg-destructive/5" : ""}>
                        <TableCell className="text-xs text-muted-foreground">{p.row}</TableCell>
                        <TableCell className="text-sm">{p.values.company_name || <em className="text-muted-foreground">—</em>}</TableCell>
                        <TableCell className="text-sm">{p.values.contact_name || <em className="text-muted-foreground">—</em>}</TableCell>
                        <TableCell className="text-sm font-mono text-xs">{p.values.email || <em className="text-muted-foreground">—</em>}</TableCell>
                        <TableCell className="text-sm">{p.values.tax_country || <em className="text-muted-foreground">—</em>}</TableCell>
                        <TableCell>
                          {p.errors.length === 0
                            ? <Badge variant="outline" className="text-green-700 border-green-300">OK</Badge>
                            : <span className="text-xs text-destructive">{p.errors.join("; ")}</span>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {submitting && (
                <div className="text-sm text-muted-foreground">
                  Importing… {progress.done}/{progress.total} {progress.failed > 0 && <span className="text-destructive">({progress.failed} failed)</span>}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={submit} disabled={!parsed || validRows.length === 0 || submitting}>
            {submitting ? "Importing…" : `Import ${validRows.length} client${validRows.length === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
