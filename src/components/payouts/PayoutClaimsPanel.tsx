import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Receipt, Truck, Utensils, Sparkles, MoreHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

type ClaimType = "transport" | "food" | "convenience" | "other";

const TYPE_META: Record<ClaimType, { label: string; icon: any }> = {
  transport: { label: "Transport", icon: Truck },
  food: { label: "Food", icon: Utensils },
  convenience: { label: "Convenience", icon: Sparkles },
  other: { label: "Other", icon: MoreHorizontal },
};

export default function PayoutClaimsPanel({
  jobId,
  engineerId,
  canSubmit = true,
}: {
  jobId: string;
  engineerId: string;
  canSubmit?: boolean;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<ClaimType>("transport");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [receiptUrl, setReceiptUrl] = useState("");

  const { data: claims = [] } = useQuery({
    queryKey: ["job-payout-claims", jobId, engineerId],
    queryFn: async () => {
      const { data } = await supabase
        .from("job_payout_claims")
        .select("*")
        .eq("job_id", jobId)
        .eq("engineer_id", engineerId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const createClaim = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("job_payout_claims").insert({
        job_id: jobId,
        engineer_id: engineerId,
        claim_type: type,
        amount: parseFloat(amount || "0"),
        note: note || null,
        receipt_url: receiptUrl || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Claim submitted for review");
      setOpen(false);
      setAmount(""); setNote(""); setReceiptUrl(""); setType("transport");
      qc.invalidateQueries({ queryKey: ["job-payout-claims", jobId] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to submit claim"),
  });

  const deleteClaim = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("job_payout_claims").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Claim removed");
      qc.invalidateQueries({ queryKey: ["job-payout-claims", jobId] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to remove"),
  });

  const totals = claims.reduce(
    (acc: any, c: any) => {
      acc.all += Number(c.amount);
      if (c.status === "approved") acc.approved += Number(c.amount);
      if (c.status === "pending") acc.pending += Number(c.amount);
      return acc;
    },
    { all: 0, approved: 0, pending: 0 }
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Receipt className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">Expense claims</span>
          <Badge variant="secondary">${totals.approved.toFixed(2)} approved</Badge>
          {totals.pending > 0 && <Badge variant="outline">${totals.pending.toFixed(2)} pending</Badge>}
        </div>
        {canSubmit && !open && (
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />Submit claim
          </Button>
        )}
      </div>

      {open && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Type</Label>
                <Select value={type} onValueChange={(v) => setType(v as ClaimType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TYPE_META) as ClaimType[]).map(k => (
                      <SelectItem key={k} value={k}>{TYPE_META[k].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Amount</Label>
                <Input type="number" step="0.01" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Note</Label>
              <Textarea rows={2} placeholder="Brief description…" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Receipt URL (optional)</Label>
              <Input placeholder="https://…" value={receiptUrl} onChange={(e) => setReceiptUrl(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button size="sm" onClick={() => createClaim.mutate()} disabled={createClaim.isPending || !amount}>
                Submit
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {claims.length === 0 ? (
        <div className="text-center text-xs text-muted-foreground py-4">No claims submitted yet.</div>
      ) : (
        <div className="space-y-2">
          {claims.map((c: any) => {
            const Meta = TYPE_META[c.claim_type as ClaimType] ?? TYPE_META.other;
            const Icon = Meta.icon;
            return (
              <div key={c.id} className="flex items-start justify-between gap-2 rounded-md border p-3 text-sm">
                <div className="flex items-start gap-2 min-w-0">
                  <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium">{Meta.label} — ${Number(c.amount).toFixed(2)}</div>
                    {c.note && <div className="text-xs text-muted-foreground truncate">{c.note}</div>}
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {format(new Date(c.created_at), "PP p")}
                      {c.receipt_url && <> · <a href={c.receipt_url} target="_blank" rel="noreferrer" className="underline">receipt</a></>}
                    </div>
                    {c.review_note && c.status !== "pending" && (
                      <div className="text-[11px] mt-1 italic text-muted-foreground">"{c.review_note}"</div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Badge variant={c.status === "approved" ? "default" : c.status === "rejected" ? "destructive" : "secondary"}>
                    {c.status}
                  </Badge>
                  {c.status === "pending" && canSubmit && (
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteClaim.mutate(c.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
