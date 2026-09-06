import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Camera, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  engineerId: string;
  jobId?: string | null;
}

export default function ReceiptCaptureDialog({ open, onOpenChange, engineerId, jobId }: Props) {
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [vendor, setVendor] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [category, setCategory] = useState("materials");
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);

  const reset = () => { setFile(null); setPreview(null); setVendor(""); setAmount(""); setDate(""); setCategory("materials"); };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const scan = async () => {
    if (!file) return toast.error("Snap or pick a receipt first");
    setScanning(true);
    try {
      const reader = new FileReader();
      const dataUrl: string = await new Promise((res, rej) => {
        reader.onload = () => res(reader.result as string);
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });
      const { data, error } = await supabase.functions.invoke("engineer-ocr-receipt", {
        body: { image_data_url: dataUrl },
      });
      if (error) throw error;
      const r = data?.receipt ?? {};
      if (r.vendor) setVendor(r.vendor);
      if (r.amount != null) setAmount(String(r.amount));
      if (r.date) setDate(r.date);
      if (r.category) setCategory(r.category);
      toast.success("Receipt scanned");
    } catch (e: any) {
      const msg = e?.message ?? "Scan failed";
      if (msg.includes("429")) toast.error("Too many requests, try again shortly");
      else if (msg.includes("402")) toast.error("AI credits required");
      else toast.error(msg);
    } finally {
      setScanning(false);
    }
  };

  const save = async () => {
    if (!file) return toast.error("Add a receipt photo");
    if (!amount) return toast.error("Enter the amount");
    setSaving(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${engineerId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("engineer-receipts").upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from("engineer_expenses").insert({
        engineer_id: engineerId,
        job_id: jobId ?? null,
        vendor: vendor || null,
        amount: parseFloat(amount),
        occurred_on: date || null,
        category,
        receipt_path: path,
        status: "submitted",
      });
      if (insErr) throw insErr;
      toast.success("Expense submitted");
      qc.invalidateQueries({ queryKey: ["engineer-expenses", engineerId] });
      reset();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!saving && !scanning) onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Capture expense</DialogTitle>
          <DialogDescription>Snap a receipt — AI will fill in the details.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <label className="flex items-center justify-center gap-2 p-4 rounded-md border border-dashed border-border bg-muted/30 cursor-pointer hover:bg-muted/50">
            {preview
              ? <img src={preview} alt="receipt" className="max-h-40 rounded" />
              : <><Camera className="w-5 h-5" /><span className="text-sm">Snap or pick receipt</span></>}
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
          </label>

          {file && (
            <Button type="button" variant="outline" size="sm" onClick={scan} disabled={scanning} className="w-full">
              {scanning ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Sparkles className="w-4 h-4 mr-1.5" />}
              {scanning ? "Scanning…" : "Scan with AI"}
            </Button>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <Label className="text-xs">Vendor</Label>
              <Input value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="e.g. Screwfix" />
            </div>
            <div>
              <Label className="text-xs">Amount</Label>
              <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Category</Label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm">
                <option value="materials">Materials</option>
                <option value="fuel">Fuel</option>
                <option value="parking">Parking / tolls</option>
                <option value="tools">Tools</option>
                <option value="meals">Meals</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving || scanning}>Cancel</Button>
          <Button onClick={save} disabled={saving || scanning || !file || !amount}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
            Submit expense
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
