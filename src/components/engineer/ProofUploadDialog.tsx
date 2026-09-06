import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Upload, X, Image as ImageIcon, Video, ChevronLeft, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import SignaturePad from "./SignaturePad";

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, b64] = dataUrl.split(",");
  const mime = header.match(/data:(.*?);base64/)?.[1] || "image/png";
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

function formatStamp(ts: number) {
  try {
    return new Date(ts).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

type Job = { id: string; title: string; status: string };

type ProofItem = {
  id: string;
  file: File;
  capturedAt: number; // ms epoch
  previewUrl: string;
  kind: "image" | "video";
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  engineerId: string | null;
  userId: string;
  initialJobId?: string | null;
  onUploaded?: (summary: { job: Job; files: { name: string; path: string }[] }) => void;
}

const MAX_BYTES = 50 * 1024 * 1024; // 50MB per file

export default function ProofUploadDialog({ open, onOpenChange, engineerId, userId, initialJobId, onUploaded }: Props) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobId, setJobId] = useState<string>("");
  const [items, setItems] = useState<ProofItem[]>([]);
  const [note, setNote] = useState("");
  const [signerName, setSignerName] = useState("");
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [step, setStep] = useState<"edit" | "review">("edit");

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

  // Revoke preview object URLs when items change/unmount
  useEffect(() => {
    return () => {
      items.forEach((it) => URL.revokeObjectURL(it.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    const ok: ProofItem[] = [];
    for (const f of picked) {
      if (f.size > MAX_BYTES) {
        toast.error(`${f.name} is over 50MB`);
        continue;
      }
      const isImg = f.type.startsWith("image/");
      const isVid = f.type.startsWith("video/");
      if (!isImg && !isVid) {
        toast.error(`${f.name} isn't a photo or video`);
        continue;
      }
      ok.push({
        id: crypto.randomUUID(),
        file: f,
        capturedAt: f.lastModified || Date.now(),
        previewUrl: URL.createObjectURL(f),
        kind: isImg ? "image" : "video",
      });
    }
    setItems((prev) => [...prev, ...ok]);
    e.target.value = "";
  };

  const removeItem = (id: string) =>
    setItems((prev) => {
      const tgt = prev.find((p) => p.id === id);
      if (tgt) URL.revokeObjectURL(tgt.previewUrl);
      return prev.filter((p) => p.id !== id);
    });

  const reset = () => {
    items.forEach((it) => URL.revokeObjectURL(it.previewUrl));
    setItems([]);
    setNote("");
    setSignerName("");
    setSignatureDataUrl(null);
    setStep("edit");
  };

  const totalMb = useMemo(
    () => items.reduce((acc, it) => acc + it.file.size, 0) / 1024 / 1024,
    [items],
  );

  const goReview = () => {
    if (!jobId) return toast.error("Pick a job first");
    if (!items.length && !signatureDataUrl) return toast.error("Add a photo, video, or signature");
    if (signatureDataUrl && !signerName.trim()) return toast.error("Enter the signer's name");
    setStep("review");
  };

  const upload = async () => {
    if (!jobId) return toast.error("Pick a job first");
    if (!items.length && !signatureDataUrl) return toast.error("Add a photo, video, or signature");
    if (!userId) return toast.error("Not signed in");
    setUploading(true);
    const job = jobs.find((j) => j.id === jobId)!;
    const uploaded: { name: string; path: string; captured_at?: string }[] = [];
    try {
      for (const it of items) {
        const f = it.file;
        const safe = f.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
        const stampPart = new Date(it.capturedAt).toISOString().replace(/[:.]/g, "-");
        const path = `${jobId}/work_proof/${stampPart}-${crypto.randomUUID()}-${safe}`;
        const { error: upErr } = await supabase.storage
          .from("job-attachments")
          .upload(path, f, { contentType: f.type, upsert: false });
        if (upErr) throw new Error(`${f.name}: ${upErr.message}`);
        const { error: rowErr } = await supabase.from("job_attachments").insert({
          job_id: jobId,
          uploaded_by: userId,
          file_path: path,
          file_name: f.name,
          file_size: f.size,
          mime_type: f.type,
          category: "work_proof",
        } as any);
        if (rowErr) throw new Error(`${f.name}: ${rowErr.message}`);
        uploaded.push({ name: f.name, path, captured_at: new Date(it.capturedAt).toISOString() });
      }

      if (signatureDataUrl) {
        const sigBlob = dataUrlToBlob(signatureDataUrl);
        const safeSigner = signerName.trim().replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 60) || "signature";
        const sigName = `${safeSigner}-signature.png`;
        const sigPath = `${userId}/${jobId}/${Date.now()}-${crypto.randomUUID()}-${sigName}`;
        const { error: sUpErr } = await supabase.storage
          .from("job-signatures")
          .upload(sigPath, sigBlob, { contentType: "image/png", upsert: false });
        if (sUpErr) throw new Error(`signature: ${sUpErr.message}`);
        const { error: sRowErr } = await supabase.from("job_attachments").insert({
          job_id: jobId,
          uploaded_by: userId,
          file_path: sigPath,
          file_name: sigName,
          file_size: sigBlob.size,
          mime_type: "image/png",
          category: "signature",
        } as any);
        if (sRowErr) throw new Error(`signature: ${sRowErr.message}`);
        await supabase.from("job_events").insert({
          job_id: jobId,
          engineer_id: engineerId,
          event_type: "customer_signed",
          metadata: { signer_name: signerName.trim(), signature_path: sigPath, note: note || null },
        } as any);
        uploaded.push({ name: sigName, path: sigPath });
      }

      // Single timeline event capturing per-file capture timestamps
      if (uploaded.length) {
        await supabase.from("job_events").insert({
          job_id: jobId,
          engineer_id: engineerId,
          event_type: "proof_uploaded",
          metadata: {
            note: note || null,
            files: uploaded.map((u) => ({ name: u.name, path: u.path, captured_at: u.captured_at ?? null })),
          },
        } as any);
      }

      toast.success(`Submitted ${uploaded.length} item${uploaded.length === 1 ? "" : "s"} as work proof`);
      onUploaded?.({ job, files: uploaded.map((u) => ({ name: u.name, path: u.path })) });
      reset();
      onOpenChange(false);
    } catch (e: any) {
      console.error("proof upload error", e);
      toast.error(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const selectedJob = jobs.find((j) => j.id === jobId);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!uploading) onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{step === "edit" ? "Upload work proof" : "Review & submit"}</DialogTitle>
          <DialogDescription>
            {step === "edit"
              ? "Attach photos or videos, capture a signature, then review before submitting."
              : "Confirm the items below. Timestamps reflect when each photo or video was captured."}
          </DialogDescription>
        </DialogHeader>

        {step === "edit" && (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Job</label>
              <Select value={jobId} onValueChange={setJobId} disabled={loadingJobs || uploading}>
                <SelectTrigger>
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
                    <div className="p-2 text-xs text-muted-foreground">No active jobs found.</div>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Photos / videos</label>
              <div className="flex gap-2">
                <label className="flex-1 flex items-center justify-center gap-2 p-3 rounded-md border border-dashed border-border bg-muted/30 text-sm cursor-pointer hover:bg-muted/50">
                  <ImageIcon className="w-4 h-4" /> Photo
                  <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={handlePick} disabled={uploading} />
                </label>
                <label className="flex-1 flex items-center justify-center gap-2 p-3 rounded-md border border-dashed border-border bg-muted/30 text-sm cursor-pointer hover:bg-muted/50">
                  <Video className="w-4 h-4" /> Video
                  <input type="file" accept="video/*" capture="environment" multiple className="hidden" onChange={handlePick} disabled={uploading} />
                </label>
              </div>
              {items.length > 0 && (
                <div className="grid grid-cols-3 gap-2 max-h-56 overflow-auto rounded-md border border-border p-2">
                  {items.map((it) => (
                    <div key={it.id} className="relative group rounded-md overflow-hidden border border-border bg-muted/40">
                      {it.kind === "image" ? (
                        <img src={it.previewUrl} alt={it.file.name} className="w-full h-20 object-cover" />
                      ) : (
                        <video src={it.previewUrl} className="w-full h-20 object-cover" muted />
                      )}
                      <div className="absolute inset-x-0 bottom-0 px-1 py-0.5 bg-background/80 backdrop-blur text-[10px] flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5 shrink-0" />
                        <span className="truncate">{formatStamp(it.capturedAt)}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(it.id)}
                        disabled={uploading}
                        className="absolute top-1 right-1 p-0.5 rounded-full bg-background/80 text-muted-foreground hover:text-destructive"
                        aria-label="Remove"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {items.length > 0 && (
                <p className="text-[11px] text-muted-foreground">{items.length} item{items.length === 1 ? "" : "s"} · {totalMb.toFixed(1)} MB</p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Note (optional)</label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Add context for the proof…" disabled={uploading} maxLength={500} className="text-sm" />
            </div>

            <div className="space-y-2 rounded-md border border-border p-3 bg-muted/20">
              <label className="text-xs font-medium text-muted-foreground">Customer signature (optional)</label>
              <Input
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                placeholder="Signer's full name"
                disabled={uploading}
                maxLength={120}
                className="h-9 text-sm"
              />
              <SignaturePad onChange={setSignatureDataUrl} height={160} />
            </div>
          </div>
        )}

        {step === "review" && (
          <div className="space-y-3">
            <div className="rounded-md border border-border p-3 text-sm">
              <div className="text-xs text-muted-foreground">Job</div>
              <div className="font-medium truncate">{selectedJob?.title || "—"}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Status · {selectedJob?.status || "—"}</div>
            </div>

            {items.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">
                  {items.length} attachment{items.length === 1 ? "" : "s"}
                </div>
                <div className="grid grid-cols-3 gap-2 max-h-60 overflow-auto rounded-md border border-border p-2">
                  {items.map((it) => (
                    <div key={it.id} className="rounded-md overflow-hidden border border-border bg-muted/40">
                      {it.kind === "image" ? (
                        <img src={it.previewUrl} alt={it.file.name} className="w-full h-20 object-cover" />
                      ) : (
                        <video src={it.previewUrl} className="w-full h-20 object-cover" muted />
                      )}
                      <div className="px-1.5 py-1 text-[10px]">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Clock className="w-2.5 h-2.5" />
                          <span className="truncate">{formatStamp(it.capturedAt)}</span>
                        </div>
                        <div className="truncate" title={it.file.name}>{it.file.name}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {note && (
              <div className="rounded-md border border-border p-3 text-sm">
                <div className="text-xs text-muted-foreground mb-1">Note</div>
                <div className="whitespace-pre-wrap">{note}</div>
              </div>
            )}

            {signatureDataUrl && (
              <div className="rounded-md border border-border p-3">
                <div className="text-xs text-muted-foreground mb-1">Signed by {signerName}</div>
                <img src={signatureDataUrl} alt="signature" className="w-full max-h-32 object-contain bg-background rounded" />
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {step === "edit" ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={uploading}>Cancel</Button>
              <Button onClick={goReview} disabled={uploading || (!items.length && !signatureDataUrl) || !jobId}>
                Review
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep("edit")} disabled={uploading}>
                <ChevronLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              <Button onClick={upload} disabled={uploading}>
                {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Upload className="w-4 h-4 mr-1" />}
                {uploading ? "Submitting…" : "Submit proof"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
