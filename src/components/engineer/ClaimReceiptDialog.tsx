import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Loader2, Upload, X, Receipt as ReceiptIcon, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";

const claimSchema = z.object({
  jobId: z.string().uuid({ message: "Select a job" }),
  amount: z
    .number({ invalid_type_error: "Enter a valid amount" })
    .positive({ message: "Amount must be greater than 0" })
    .max(100000, { message: "Amount looks too large" }),
  note: z
    .string()
    .trim()
    .min(5, { message: "Add a short note (min 5 characters)" })
    .max(500, { message: "Note must be under 500 characters" }),
  filesCount: z.number().int().min(1, { message: "Attach at least one receipt" }),
});

type FieldErrors = Partial<Record<"jobId" | "amount" | "note" | "filesCount", string>>;

type Job = { id: string; title: string; status: string };
type ClaimType = "transport" | "food" | "convenience" | "other";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  engineerId: string | null;
  initialJobId?: string | null;
  onSubmitted?: (summary: { job: Job; claim_type: ClaimType; amount: number; receipts: string[] }) => void;
}

const MAX_BYTES = 10 * 1024 * 1024; // 10MB per file
const MAX_TOTAL_BYTES = 30 * 1024 * 1024; // 30MB total
const MAX_FILES = 5;
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf"];
const ALLOWED_EXT = /\.(jpe?g|png|webp|heic|heif|pdf)$/i;

function validateFile(f: File): string | null {
  const typeOk = ALLOWED_TYPES.includes(f.type) || ALLOWED_EXT.test(f.name);
  if (!typeOk) return `${f.name}: only JPG, PNG, WEBP, HEIC, or PDF allowed`;
  if (f.size === 0) return `${f.name} is empty`;
  if (f.size > MAX_BYTES) return `${f.name} exceeds 10MB limit`;
  return null;
}

export default function ClaimReceiptDialog({ open, onOpenChange, engineerId, initialJobId, onSubmitted }: Props) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobId, setJobId] = useState("");
  const [claimType, setClaimType] = useState<ClaimType>("transport");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const validation = useMemo(() => {
    const amt = amount === "" ? NaN : Number(amount);
    const result = claimSchema.safeParse({
      jobId,
      amount: amt,
      note,
      filesCount: files.length,
    });
    if (result.success) return { valid: true, errors: {} as FieldErrors };
    const errors: FieldErrors = {};
    for (const issue of result.error.issues) {
      const k = issue.path[0] as keyof FieldErrors;
      if (k && !errors[k]) errors[k] = issue.message;
    }
    return { valid: false, errors };
  }, [jobId, amount, note, files.length]);

  const showErr = (k: keyof FieldErrors) => (touched[k] ? validation.errors[k] : undefined);
  const markTouched = (k: string) => setTouched((p) => ({ ...p, [k]: true }));

  useEffect(() => {
    if (!open || !engineerId) return;
    setLoadingJobs(true);
    supabase
      .from("jobs_engineer_safe")
      .select("id,title,status,scheduled_at,completed_at")
      .eq("engineer_id", engineerId)
      .in("status", ["assigned", "in_progress", "completed"])
      .order("scheduled_at", { ascending: false, nullsFirst: false })
      .limit(50)
      .then(({ data, error }) => {
        if (error) toast.error("Couldn't load your jobs");
        const list = (data ?? []) as Job[];
        setJobs(list);
        setJobId((prev) => prev || initialJobId || list[0]?.id || "");
        setLoadingJobs(false);
      });
  }, [open, engineerId, initialJobId]);

  const handlePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    const ok: File[] = [];
    let runningTotal = files.reduce((s, f) => s + f.size, 0);
    for (const f of picked) {
      if (files.length + ok.length >= MAX_FILES) {
        toast.error(`Max ${MAX_FILES} receipts per claim`);
        break;
      }
      const err = validateFile(f);
      if (err) { toast.error(err); continue; }
      if (runningTotal + f.size > MAX_TOTAL_BYTES) {
        toast.error(`${f.name}: total upload would exceed 30MB`);
        continue;
      }
      runningTotal += f.size;
      ok.push(f);
    }
    setFiles((prev) => [...prev, ...ok]);
    e.target.value = "";
  };

  const removeFile = (i: number) => setFiles((prev) => prev.filter((_, idx) => idx !== i));

  const reset = () => { setAmount(""); setNote(""); setFiles([]); setTouched({}); };

  const submit = async () => {
    if (!engineerId) return toast.error("No engineer profile");
    setTouched({ jobId: true, amount: true, note: true, filesCount: true });
    if (!validation.valid) {
      const first = Object.values(validation.errors)[0];
      return toast.error(first || "Please complete all required fields");
    }
    const amt = Number(amount);
    if (files.length > MAX_FILES) return toast.error(`Max ${MAX_FILES} receipts per claim`);
    const total = files.reduce((s, f) => s + f.size, 0);
    if (total > MAX_TOTAL_BYTES) return toast.error("Total upload exceeds 30MB");
    for (const f of files) {
      const err = validateFile(f);
      if (err) return toast.error(err);
    }
    setSubmitting(true);
    try {
      const claimUuid = crypto.randomUUID();
      const paths: string[] = [];
      for (const f of files) {
        const safe = f.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
        const path = `${engineerId}/${claimUuid}/${Date.now()}-${safe}`;
        const { error: upErr } = await supabase.storage
          .from("expense-receipts")
          .upload(path, f, { contentType: f.type, upsert: false });
        if (upErr) throw new Error(`${f.name}: ${upErr.message}`);
        paths.push(path);
      }
      const job = jobs.find((j) => j.id === jobId)!;
      const { error: insErr } = await supabase.from("job_payout_claims").insert({
        job_id: jobId,
        engineer_id: engineerId,
        claim_type: claimType,
        amount: amt,
        note: note.trim(),
        receipt_url: paths.join("|"),
      } as any);
      if (insErr) throw new Error(insErr.message);
      toast.success("Expense claim submitted with receipt");
      onSubmitted?.({ job, claim_type: claimType, amount: amt, receipts: paths });
      reset();
      onOpenChange(false);
    } catch (e: any) {
      console.error("claim submit error", e);
      toast.error(e.message || "Failed to submit claim");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!submitting) onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Submit expense claim</DialogTitle>
          <DialogDescription>Attach receipt photos for transport, food, or convenience expenses.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Job <span className="text-destructive">*</span></label>
            <Select
              value={jobId}
              onValueChange={(v) => { setJobId(v); markTouched("jobId"); }}
              disabled={loadingJobs || submitting}
            >
              <SelectTrigger
                onBlur={() => markTouched("jobId")}
                aria-invalid={!!showErr("jobId")}
                className={showErr("jobId") ? "border-destructive" : ""}
              >
                <SelectValue placeholder={loadingJobs ? "Loading…" : "Select a job"} />
              </SelectTrigger>
              <SelectContent>
                {jobs.map((j) => (
                  <SelectItem key={j.id} value={j.id}>
                    <span className="text-sm">{j.title}</span>
                    <span className="text-xs text-muted-foreground ml-2">· {j.status}</span>
                  </SelectItem>
                ))}
                {!loadingJobs && jobs.length === 0 && (
                  <div className="p-2 text-xs text-muted-foreground">No jobs found.</div>
                )}
              </SelectContent>
            </Select>
            {showErr("jobId") && (
              <p className="text-[11px] text-destructive flex items-center gap-1"><AlertCircle className="w-3 h-3" />{showErr("jobId")}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Type</label>
              <Select value={claimType} onValueChange={(v) => setClaimType(v as ClaimType)} disabled={submitting}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="transport">Transport</SelectItem>
                  <SelectItem value="food">Food</SelectItem>
                  <SelectItem value="convenience">Convenience</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Amount <span className="text-destructive">*</span></label>
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onBlur={() => markTouched("amount")}
                placeholder="0.00"
                disabled={submitting}
                aria-invalid={!!showErr("amount")}
                className={showErr("amount") ? "border-destructive" : ""}
              />
              {showErr("amount") && (
                <p className="text-[11px] text-destructive flex items-center gap-1"><AlertCircle className="w-3 h-3" />{showErr("amount")}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">Receipts <span className="text-destructive">*</span></label>
              <span className="text-[10px] text-muted-foreground">{files.length}/{MAX_FILES} files</span>
            </div>
            <label className={`flex items-center justify-center gap-2 p-3 rounded-md border border-dashed bg-muted/30 text-sm cursor-pointer hover:bg-muted/50 ${showErr("filesCount") ? "border-destructive" : "border-border"}`}>
              <ReceiptIcon className="w-4 h-4" /> Add receipt
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf"
                capture="environment"
                multiple
                className="hidden"
                onChange={(e) => { handlePick(e); markTouched("filesCount"); }}
                disabled={submitting || files.length >= MAX_FILES}
              />
            </label>
            <p className="text-[10px] text-muted-foreground">
              JPG, PNG, WEBP, HEIC, or PDF · max 10MB each · up to {MAX_FILES} files (30MB total)
            </p>
            {showErr("filesCount") && (
              <p className="text-[11px] text-destructive flex items-center gap-1"><AlertCircle className="w-3 h-3" />{showErr("filesCount")}</p>
            )}
            {files.length > 0 && (
              <ul className="space-y-1 max-h-40 overflow-auto rounded-md border border-border p-2">
                {files.map((f, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate">🧾 {f.name}</span>
                    <span className="text-muted-foreground shrink-0">{(f.size / 1024).toFixed(0)} KB</span>
                    <button type="button" onClick={() => removeFile(i)} disabled={submitting} className="text-muted-foreground hover:text-destructive">
                      <X className="w-3 h-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">Note <span className="text-destructive">*</span></label>
              <span className="text-[10px] text-muted-foreground">{note.trim().length}/500</span>
            </div>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onBlur={() => markTouched("note")}
              rows={2}
              placeholder="What was this expense for? (min 5 characters)"
              disabled={submitting}
              maxLength={500}
              aria-invalid={!!showErr("note")}
              className={`text-sm ${showErr("note") ? "border-destructive" : ""}`}
            />
            {showErr("note") && (
              <p className="text-[11px] text-destructive flex items-center gap-1"><AlertCircle className="w-3 h-3" />{showErr("note")}</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={submit} disabled={submitting || !validation.valid}>
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {submitting ? "Submitting…" : "Submit claim"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
