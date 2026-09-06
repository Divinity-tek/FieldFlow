import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileDown, Mail, Printer, Loader2, X, AlertTriangle, AlertCircle, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { buildDocHtml, downloadDocPdf, type DocBuildInput } from "@/lib/financialDocs";
import { toast } from "sonner";

type IssueLevel = "error" | "warning";
interface Issue { level: IssueLevel; field: string; message: string; }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validatePayload(p: DocBuildInput | null, recipientEmail?: string | null): Issue[] {
  if (!p) return [];
  const issues: Issue[] = [];
  const num = (v: any) => Number(v ?? 0);
  const round = (v: number) => Math.round(v * 100) / 100;

  // Identity / payer
  if (!p.number) issues.push({ level: "error", field: "Receipt #", message: "Missing receipt number" });
  const payerName = p.to?.name?.trim();
  if (!payerName) issues.push({ level: "error", field: "Payer", message: "Payer name is missing" });
  const email = (recipientEmail || p.to?.email || "").trim();
  if (!email) issues.push({ level: "warning", field: "Email", message: "No payer email — emailing will be disabled" });
  else if (!EMAIL_RE.test(email)) issues.push({ level: "error", field: "Email", message: `Invalid email: "${email}"` });

  // Currency
  if (!p.currency) issues.push({ level: "warning", field: "Currency", message: "Currency missing — defaulting to USD" });

  // Payment method / reference
  if (!p.payment_method) issues.push({ level: "warning", field: "Method", message: "No payment method specified" });
  if (p.payment_method && ["Bank transfer", "Wire", "Cheque"].includes(p.payment_method) && !p.payment_reference) {
    issues.push({ level: "warning", field: "Reference", message: `${p.payment_method} usually needs a reference / cheque #` });
  }

  // Totals consistency
  const subtotal = num(p.subtotal);
  const discount = num(p.discount_amount);
  const tax = num(p.tax_amount) + num((p as any).tax2_amount);
  const total = num(p.total);
  const paid = num(p.amount_paid);

  if (subtotal <= 0) issues.push({ level: "error", field: "Subtotal", message: "Subtotal is zero or negative" });
  const expected = round(subtotal - discount + tax);
  if (total > 0 && Math.abs(expected - round(total)) > 0.01) {
    issues.push({
      level: "error",
      field: "Totals",
      message: `Total ${total.toFixed(2)} doesn't match subtotal − discount + tax (${expected.toFixed(2)})`,
    });
  }
  if (paid <= 0) issues.push({ level: "error", field: "Amount paid", message: "Amount paid is zero" });
  if (paid > round(total) + 0.01) {
    issues.push({ level: "warning", field: "Amount paid", message: `Paid (${paid.toFixed(2)}) exceeds total (${total.toFixed(2)})` });
  }
  if (paid > 0 && paid < round(total) - 0.01) {
    issues.push({ level: "warning", field: "Amount paid", message: `Paid (${paid.toFixed(2)}) is less than total (${total.toFixed(2)})` });
  }

  // Dates
  const now = Date.now();
  const issued = p.issued_at ? new Date(p.issued_at as any).getTime() : NaN;
  const paidAt = p.paid_at ? new Date(p.paid_at as any).getTime() : NaN;
  if (isNaN(issued)) issues.push({ level: "warning", field: "Issued date", message: "Issue date missing" });
  else if (issued - now > 86_400_000) issues.push({ level: "warning", field: "Issued date", message: "Issue date is in the future" });
  if (!isNaN(paidAt) && !isNaN(issued) && paidAt < issued - 86_400_000) {
    issues.push({ level: "warning", field: "Paid date", message: "Paid date is before the issue date" });
  }
  if (!isNaN(paidAt) && paidAt - now > 86_400_000) {
    issues.push({ level: "warning", field: "Paid date", message: "Paid date is in the future" });
  }

  return issues;
}


interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  payload: DocBuildInput | null;
  fileName: string;
  recipientEmail?: string | null;
  recipientName?: string | null;
  onConfirmEmail?: () => void;
}

export function ReceiptPreviewDialog({
  open, onOpenChange, payload, fileName, recipientEmail, recipientName, onConfirmEmail,
}: Props) {
  const [html, setHtml] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<"download" | "email" | "print" | null>(null);
  const [issuesOpen, setIssuesOpen] = useState(true);
  const [overrideErrors, setOverrideErrors] = useState(false);
  const [emailInput, setEmailInput] = useState<string>(recipientEmail || "");

  const issues = useMemo(() => validatePayload(payload, emailInput), [payload, emailInput]);
  const errors = issues.filter((i) => i.level === "error");
  const warnings = issues.filter((i) => i.level === "warning");
  const blocked = errors.length > 0 && !overrideErrors;

  useEffect(() => {
    if (open) {
      setOverrideErrors(false);
      setIssuesOpen(true);
      setEmailInput(recipientEmail || "");
    }
  }, [open, payload, recipientEmail]);

  const guard = (action: string): boolean => {
    if (errors.length > 0 && !overrideErrors) {
      toast.error(`Fix ${errors.length} validation error${errors.length === 1 ? "" : "s"} before ${action}, or override below.`);
      setIssuesOpen(true);
      return false;
    }
    if (warnings.length > 0) {
      toast.warning(`${action} with ${warnings.length} warning${warnings.length === 1 ? "" : "s"}`);
    }
    return true;
  };


  useEffect(() => {
    if (!open || !payload) { setHtml(""); return; }
    let cancelled = false;
    setLoading(true);
    buildDocHtml(payload)
      .then((h) => { if (!cancelled) setHtml(h); })
      .catch((e) => toast.error(e?.message || "Failed to build preview"))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, payload]);

  const handleDownload = async () => {
    if (!payload) return;
    if (!guard("downloading")) return;
    setBusy("download");
    try {
      await downloadDocPdf(payload, fileName);
      toast.success("Print dialog opened — choose Save as PDF");
    } catch (e: any) {
      toast.error(e?.message || "Download failed");
    } finally { setBusy(null); }
  };

  const handlePrint = () => {
    const iframe = document.getElementById("receipt-preview-frame") as HTMLIFrameElement | null;
    if (!iframe?.contentWindow) { toast.error("Preview not ready"); return; }
    if (!guard("printing")) return;
    setBusy("print");
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } finally {
      setTimeout(() => setBusy(null), 800);
    }
  };

  const handleEmail = async () => {
    if (!payload) return;
    const email = emailInput.trim();
    if (!email) { toast.error("Enter a recipient email before emailing"); return; }
    if (!guard("emailing")) return;
    setBusy("email");
    try {
      await downloadDocPdf(payload, fileName);
      const subject = encodeURIComponent(`Receipt ${payload.number}`);
      const body = encodeURIComponent(
        `Hi ${recipientName || "there"},\n\n` +
        `Please find attached receipt ${payload.number}.\n\n` +
        `(The PDF was downloaded to your device — please attach it before sending.)\n\nThanks!`
      );
      window.open(`mailto:${email}?subject=${subject}&body=${body}`);
      onConfirmEmail?.();
      toast.success("Mail draft opened — PDF downloaded for attachment");
    } catch (e: any) {
      toast.error(e?.message || "Email failed");
    } finally { setBusy(null); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[88vh] flex flex-col gap-3 p-0">
        <DialogHeader className="px-5 pt-5 flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            <DialogTitle>Receipt preview</DialogTitle>
            {payload?.number && <Badge variant="outline" className="font-mono text-[10px]">{payload.number}</Badge>}
          </div>
          <button onClick={() => onOpenChange(false)} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </DialogHeader>

        {issues.length > 0 ? (
          <div className={`mx-5 rounded-md border text-sm ${errors.length > 0 ? "border-destructive/40 bg-destructive/5" : "border-amber-500/40 bg-amber-500/5"}`}>
            <button type="button" onClick={() => setIssuesOpen((v) => !v)} className="w-full flex items-center gap-2 px-3 py-2 text-left">
              {errors.length > 0
                ? <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
                : <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />}
              <span className="font-medium">
                {errors.length > 0 && <>{errors.length} error{errors.length === 1 ? "" : "s"}</>}
                {errors.length > 0 && warnings.length > 0 && " · "}
                {warnings.length > 0 && <>{warnings.length} warning{warnings.length === 1 ? "" : "s"}</>}
              </span>
              <span className="text-xs text-muted-foreground">
                {errors.length > 0 ? "— printing/emailing blocked" : "— review before sending"}
              </span>
              <span className="flex-1" />
              {issuesOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {issuesOpen && (
              <div className="px-3 pb-3 space-y-1">
                <ul className="space-y-1">
                  {issues.map((it, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs">
                      {it.level === "error"
                        ? <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
                        : <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />}
                      <Badge variant="outline" className="text-[10px] shrink-0">{it.field}</Badge>
                      <span className="text-foreground/90">{it.message}</span>
                    </li>
                  ))}
                </ul>
                {errors.length > 0 && (
                  <label className="flex items-center gap-2 pt-2 mt-2 border-t border-border/60 text-xs cursor-pointer">
                    <input type="checkbox" checked={overrideErrors} onChange={(e) => setOverrideErrors(e.target.checked)} className="accent-destructive" />
                    <span>I understand — let me print/email anyway</span>
                  </label>
                )}
              </div>
            )}
          </div>
        ) : payload && !loading ? (
          <div className="mx-5 flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
            All fields look consistent.
          </div>
        ) : null}

        <div className="flex-1 overflow-hidden mx-5 rounded-md border bg-muted/30">
          {loading ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Building preview…
            </div>
          ) : html ? (
            <iframe
              id="receipt-preview-frame"
              title="Receipt preview"
              srcDoc={html}
              className="w-full h-full bg-white"
            />
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No preview available</div>
          )}
        </div>

        <div className="grid gap-2 px-5">
          <div className="space-y-1">
            <Label>Send receipt to</Label>
            <Input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="recipient@example.com"
            />
          </div>
        </div>

        <DialogFooter className="px-5 pb-5 gap-2 sm:gap-2">
          <div className="flex-1 text-[11px] text-muted-foreground self-center">
            {emailInput.trim()
              ? <>Will email to <span className="font-medium text-foreground">{emailInput.trim()}</span></>
              : "Enter an email address to enable emailing"}
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button variant="outline" onClick={handlePrint} disabled={!html || !!busy || blocked} className="gap-1.5">
            {busy === "print" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
            Print
          </Button>
          <Button variant="outline" onClick={handleEmail} disabled={!html || !!busy || !recipientEmail || blocked} className="gap-1.5">
            {busy === "email" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
            Email
          </Button>
          <Button onClick={handleDownload} disabled={!html || !!busy || blocked} className="gap-1.5">
            {busy === "download" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
            Download PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
