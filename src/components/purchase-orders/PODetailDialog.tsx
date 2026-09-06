import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, X, Copy, Mail, Link as LinkIcon, FileCheck2, Truck, Wallet, History, Send, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { fmtMoney } from "@/lib/financialDocs";
import { format } from "date-fns";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  poId: string | null;
}

const STATUS_FLOW = ["draft", "submitted", "approved", "ordered", "received", "closed"] as const;

const matchLabel: Record<string, { label: string; tone: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pending", tone: "secondary" },
  awaiting_invoice: { label: "Awaiting vendor invoice", tone: "outline" },
  awaiting_receipt: { label: "Awaiting receipt", tone: "outline" },
  amount_mismatch: { label: "Amount mismatch", tone: "destructive" },
  matched: { label: "3-way matched", tone: "default" },
};

export default function PODetailDialog({ open, onOpenChange, poId }: Props) {
  const qc = useQueryClient();

  const { data: po, refetch } = useQuery({
    queryKey: ["po-detail", poId],
    enabled: !!poId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_orders")
        .select("*, vendors(name, email, phone, default_payment_terms)")
        .eq("id", poId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: receipts = [] } = useQuery({
    queryKey: ["po-receipts", poId],
    enabled: !!poId && open,
    queryFn: async () => {
      const { data } = await supabase.from("po_receipts").select("*").eq("po_id", poId!).order("received_at", { ascending: false });
      return data || [];
    },
  });

  const { data: approvals = [] } = useQuery({
    queryKey: ["po-approvals", poId],
    enabled: !!poId && open,
    queryFn: async () => {
      const { data } = await supabase.from("po_approvals").select("*").eq("po_id", poId!).order("step_order");
      return data || [];
    },
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["po-payments", poId],
    enabled: !!poId && open,
    queryFn: async () => {
      const { data } = await supabase.from("po_accounting_entries").select("*").eq("po_id", poId!).order("paid_at", { ascending: false });
      return data || [];
    },
  });

  const { data: audit = [] } = useQuery({
    queryKey: ["po-audit", poId],
    enabled: !!poId && open,
    queryFn: async () => {
      const { data } = await supabase.from("po_audit_log").select("*").eq("po_id", poId!).order("created_at", { ascending: false }).limit(100);
      return data || [];
    },
  });

  const { data: inventory = [] } = useQuery({
    queryKey: ["po-inventory-list"],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase.from("inventory_items").select("id, name, quantity, category").order("name").limit(500);
      return data || [];
    },
  });

  // 3-way match
  const [matchStatus, setMatchStatus] = useState<string>("pending");
  useEffect(() => {
    if (!poId || !open) return;
    (async () => {
      const { data } = await supabase.rpc("po_three_way_match", { _po_id: poId });
      if (typeof data === "string") setMatchStatus(data);
    })();
  }, [poId, open, po, receipts, payments]);

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["purchase_orders"] });
    qc.invalidateQueries({ queryKey: ["po-detail", poId] });
    qc.invalidateQueries({ queryKey: ["po-approvals", poId] });
    qc.invalidateQueries({ queryKey: ["po-receipts", poId] });
    qc.invalidateQueries({ queryKey: ["po-payments", poId] });
    qc.invalidateQueries({ queryKey: ["po-audit", poId] });
  };

  // ----- Status pipeline -----
  const advanceStatus = async (next: string) => {
    if (!po) return;
    const { error } = await supabase.from("purchase_orders").update({ status: next }).eq("id", po.id);
    if (error) return toast.error(error.message);
    toast.success(`Marked as ${next}`);
    invalidateAll();
  };

  // ----- Approvals -----
  const addApprovalStep = async () => {
    if (!po) return;
    const next = (approvals[approvals.length - 1]?.step_order || 0) + 1;
    const { error } = await supabase.from("po_approvals").insert({ po_id: po.id, step_order: next, required_role: "team_lead" });
    if (error) return toast.error(error.message);
    invalidateAll();
  };
  const decideApproval = async (id: string, status: "approved" | "rejected", reason?: string) => {
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase.from("po_approvals").update({
      status, reason: reason || null, decided_at: new Date().toISOString(), approver_id: auth.user?.id || null,
    }).eq("id", id);
    if (error) return toast.error(error.message);
    // If all approved, bump PO to approved
    const remaining = approvals.filter((a: any) => a.id !== id && a.status === "pending").length;
    if (status === "approved" && remaining === 0 && po?.status === "submitted") {
      await supabase.from("purchase_orders").update({ status: "approved" }).eq("id", po.id);
    } else if (status === "rejected" && po) {
      await supabase.from("purchase_orders").update({ status: "draft" }).eq("id", po.id);
    }
    invalidateAll();
  };

  // ----- Receiving -----
  const [receiveItems, setReceiveItems] = useState<any[]>([]);
  useEffect(() => {
    if (!po) return;
    setReceiveItems((po.items as any[] || []).map((it: any) => ({
      description: it.description, ordered: Number(it.quantity || 0),
      quantity_received: Number(it.quantity || 0), inventory_item_id: it.inventory_item_id || "", condition: "good", discrepancy_note: "",
    })));
  }, [po]);

  const submitReceipt = async () => {
    if (!po) return;
    const items = receiveItems.filter((r: any) => Number(r.quantity_received) > 0);
    if (!items.length) return toast.error("Enter at least one received quantity");
    const totalReceived = items.reduce((s: number, r: any) => s + Number(r.quantity_received), 0);
    const totalOrdered = items.reduce((s: number, r: any) => s + Number(r.ordered), 0);
    const isPartial = totalReceived < totalOrdered;
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase.from("po_receipts").insert({
      po_id: po.id, received_by: auth.user?.id || null, items, is_partial: isPartial,
    });
    if (error) return toast.error(error.message);
    toast.success(isPartial ? "Partial receipt recorded" : "Full receipt recorded — inventory updated");
    invalidateAll();
  };

  // ----- Vendor share / portal -----
  const ensureShareToken = async () => {
    if (!po) return null;
    if (po.vendor_share_token) return po.vendor_share_token;
    const tok = (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "");
    const { error } = await supabase.from("purchase_orders").update({ vendor_share_token: tok }).eq("id", po.id);
    if (error) { toast.error(error.message); return null; }
    invalidateAll();
    return tok;
  };
  const shareUrl = (tok: string) => `${window.location.origin}/po/portal/${tok}`;

  const copyShareLink = async () => {
    const tok = await ensureShareToken();
    if (!tok) return;
    await navigator.clipboard.writeText(shareUrl(tok));
    toast.success("Vendor portal link copied");
  };
  const emailVendor = async () => {
    if (!po?.vendor_email) return toast.error("No vendor email on this PO");
    const tok = await ensureShareToken();
    if (!tok) return;
    const subject = encodeURIComponent(`Purchase Order ${po.po_number}`);
    const body = encodeURIComponent(`Hi ${po.vendors?.name || po.vendor_name},\n\nPlease review purchase order ${po.po_number} totalling ${fmtMoney(Number(po.total||0), po.currency || "USD")}.\n\nView and acknowledge: ${shareUrl(tok)}\n\nThanks.`);
    window.location.href = `mailto:${po.vendor_email}?subject=${subject}&body=${body}`;
  };

  // ----- Vendor invoice / 3-way match -----
  const [invoiceTotal, setInvoiceTotal] = useState<string>("");
  const [invoiceNumber, setInvoiceNumber] = useState<string>("");
  useEffect(() => {
    if (po) {
      setInvoiceTotal(po.vendor_invoice_total != null ? String(po.vendor_invoice_total) : "");
      setInvoiceNumber(po.vendor_invoice_number || "");
    }
  }, [po]);
  const saveInvoice = async () => {
    if (!po) return;
    const { error } = await supabase.from("purchase_orders").update({
      vendor_invoice_total: invoiceTotal ? Number(invoiceTotal) : null,
      vendor_invoice_number: invoiceNumber || null,
    }).eq("id", po.id);
    if (error) return toast.error(error.message);
    toast.success("Vendor invoice saved");
    invalidateAll();
  };

  // ----- Payments / accounting entries -----
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("Bank transfer");
  const [payRef, setPayRef] = useState("");
  const recordPayment = async () => {
    if (!po) return;
    const amount = Number(payAmount);
    if (!amount || amount <= 0) return toast.error("Enter an amount");
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase.from("po_accounting_entries").insert({
      po_id: po.id, amount, currency: po.currency || "USD", fx_rate: po.fx_rate || 1,
      payment_method: payMethod, reference: payRef || null, created_by: auth.user?.id || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Payment recorded — visible in Accounting");
    setPayAmount(""); setPayRef("");
    invalidateAll();
  };

  if (!po) return null;
  const totalPaid = payments.reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
  const remaining = Math.max(0, Number(po.total || 0) - totalPaid);
  const stepIdx = STATUS_FLOW.indexOf((po.status || "draft") as any);
  const next = stepIdx >= 0 && stepIdx < STATUS_FLOW.length - 1 ? STATUS_FLOW[stepIdx + 1] : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <span className="font-mono">{po.po_number}</span>
            <Badge variant="outline" className="capitalize">{po.status}</Badge>
            <Badge variant="outline" className="capitalize">{(po.receive_status || "unreceived").replace(/_/g, " ")}</Badge>
            <Badge variant={matchLabel[matchStatus]?.tone || "outline"}>{matchLabel[matchStatus]?.label || matchStatus}</Badge>
            <span className="ml-auto text-sm font-normal text-muted-foreground">
              {fmtMoney(Number(po.total || 0), po.currency || "USD")} · {po.vendor_name}
            </span>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="overview" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="shrink-0">
            <TabsTrigger value="overview"><FileCheck2 className="w-3.5 h-3.5 mr-1" />Overview</TabsTrigger>
            <TabsTrigger value="approvals"><Check className="w-3.5 h-3.5 mr-1" />Approvals ({approvals.length})</TabsTrigger>
            <TabsTrigger value="receiving"><Truck className="w-3.5 h-3.5 mr-1" />Receiving ({receipts.length})</TabsTrigger>
            <TabsTrigger value="vendor"><Send className="w-3.5 h-3.5 mr-1" />Vendor</TabsTrigger>
            <TabsTrigger value="accounting"><Wallet className="w-3.5 h-3.5 mr-1" />Accounting ({payments.length})</TabsTrigger>
            <TabsTrigger value="audit"><History className="w-3.5 h-3.5 mr-1" />Audit</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 mt-2 pr-2">
            {/* OVERVIEW */}
            <TabsContent value="overview" className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div><Label className="text-muted-foreground">Vendor</Label><div className="font-medium">{po.vendor_name}</div></div>
                <div><Label className="text-muted-foreground">Currency</Label><div>{po.currency} · FX {po.fx_rate}</div></div>
                <div><Label className="text-muted-foreground">Payment terms</Label><div>{po.payment_terms || po.vendors?.default_payment_terms || "—"}</div></div>
                <div><Label className="text-muted-foreground">Budget code</Label><div>{po.budget_code || "—"}</div></div>
                <div><Label className="text-muted-foreground">Expected delivery</Label><div>{po.expected_delivery ? format(new Date(po.expected_delivery), "PP") : "—"}</div></div>
                <div><Label className="text-muted-foreground">Subtotal</Label><div>{fmtMoney(Number(po.subtotal||0), po.currency)}</div></div>
                <div><Label className="text-muted-foreground">Tax ({po.tax_rate}%)</Label><div>{fmtMoney(Number(po.tax_amount||0), po.currency)}</div></div>
                <div><Label className="text-muted-foreground">Shipping</Label><div>{fmtMoney(Number(po.shipping_cost||0), po.currency)}</div></div>
              </div>
              <div className="border rounded-md">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40 text-left">
                    <tr><th className="p-2">Description</th><th className="p-2 text-right">Qty</th><th className="p-2 text-right">Unit</th><th className="p-2 text-right">Total</th></tr>
                  </thead>
                  <tbody>
                    {(po.items as any[] || []).map((it: any, i: number) => (
                      <tr key={i} className="border-t">
                        <td className="p-2">{it.description}</td>
                        <td className="p-2 text-right">{it.quantity}</td>
                        <td className="p-2 text-right">{fmtMoney(Number(it.unit_price||0), po.currency)}</td>
                        <td className="p-2 text-right">{fmtMoney(Number(it.quantity||0)*Number(it.unit_price||0), po.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {po.notes && <div className="text-xs text-muted-foreground"><strong>Notes:</strong> {po.notes}</div>}
              <div className="flex flex-wrap gap-2 pt-2">
                {STATUS_FLOW.map((s) => (
                  <Button key={s} size="sm" variant={po.status === s ? "default" : "outline"} disabled={po.status === s} onClick={() => advanceStatus(s)} className="capitalize">{s}</Button>
                ))}
                {next && <Button size="sm" onClick={() => advanceStatus(next)} className="ml-auto capitalize">Advance → {next}</Button>}
              </div>
            </TabsContent>

            {/* APPROVALS */}
            <TabsContent value="approvals" className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Add steps; each approver can approve or reject. Rejection returns the PO to draft.</p>
                <Button size="sm" variant="outline" onClick={addApprovalStep}>Add approval step</Button>
              </div>
              {approvals.length === 0 && <p className="text-xs text-muted-foreground py-4 text-center">No approval steps yet.</p>}
              {approvals.map((a: any) => (
                <div key={a.id} className="flex items-center gap-2 p-2 border rounded-md text-xs">
                  <Badge variant="outline">Step {a.step_order}</Badge>
                  <span className="capitalize">{a.required_role.replace(/_/g, " ")}</span>
                  <Badge variant={a.status === "approved" ? "default" : a.status === "rejected" ? "destructive" : "secondary"} className="capitalize">{a.status}</Badge>
                  {a.decided_at && <span className="text-muted-foreground">{format(new Date(a.decided_at), "PP p")}</span>}
                  {a.reason && <span className="text-muted-foreground italic">— {a.reason}</span>}
                  {a.status === "pending" && (
                    <div className="ml-auto flex gap-1">
                      <Button size="sm" variant="outline" className="h-7" onClick={() => decideApproval(a.id, "approved")}><Check className="w-3 h-3" /></Button>
                      <Button size="sm" variant="outline" className="h-7" onClick={() => {
                        const r = window.prompt("Reason for rejection?") || undefined;
                        decideApproval(a.id, "rejected", r);
                      }}><X className="w-3 h-3" /></Button>
                    </div>
                  )}
                </div>
              ))}
            </TabsContent>

            {/* RECEIVING */}
            <TabsContent value="receiving" className="space-y-3">
              <div className="border rounded-md p-3 space-y-2">
                <h4 className="text-sm font-semibold">Record a receipt</h4>
                {receiveItems.map((r: any, i: number) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center text-xs">
                    <div className="col-span-4 truncate">{r.description}</div>
                    <div className="col-span-2 text-muted-foreground">Ordered {r.ordered}</div>
                    <Input type="number" className="col-span-2 h-8" value={r.quantity_received}
                      onChange={(e) => setReceiveItems(receiveItems.map((x, j) => j === i ? { ...x, quantity_received: e.target.value } : x))} />
                    <Select value={r.inventory_item_id || "none"} onValueChange={(v) => setReceiveItems(receiveItems.map((x, j) => j === i ? { ...x, inventory_item_id: v === "none" ? "" : v } : x))}>
                      <SelectTrigger className="col-span-3 h-8"><SelectValue placeholder="Stock to" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Don't add to inventory</SelectItem>
                        {inventory.map((it: any) => <SelectItem key={it.id} value={it.id}>{it.name} ({it.quantity})</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input className="col-span-1 h-8" placeholder="Note" value={r.discrepancy_note}
                      onChange={(e) => setReceiveItems(receiveItems.map((x, j) => j === i ? { ...x, discrepancy_note: e.target.value } : x))} />
                  </div>
                ))}
                <Button size="sm" onClick={submitReceipt}><Truck className="w-3.5 h-3.5 mr-1" />Save receipt</Button>
              </div>
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">History</h4>
                {receipts.length === 0 && <p className="text-xs text-muted-foreground">No receiving events yet.</p>}
                {receipts.map((r: any) => (
                  <div key={r.id} className="border rounded-md p-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span>{format(new Date(r.received_at), "PP p")}</span>
                      <Badge variant={r.is_partial ? "secondary" : "default"}>{r.is_partial ? "Partial" : "Full"}</Badge>
                    </div>
                    <ul className="list-disc pl-5 mt-1 text-muted-foreground">
                      {(r.items as any[]).map((it: any, i: number) => (
                        <li key={i}>{it.description} × {it.quantity_received}{it.discrepancy_note ? ` — ${it.discrepancy_note}` : ""}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* VENDOR */}
            <TabsContent value="vendor" className="space-y-3">
              <div className="border rounded-md p-3 space-y-2 text-xs">
                <h4 className="text-sm font-semibold">Send to vendor</h4>
                <p className="text-muted-foreground">Generate a secure portal link the vendor can open to view the PO and acknowledge receipt. Email opens in your default mail client with the link prefilled.</p>
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" variant="outline" onClick={copyShareLink}><Copy className="w-3.5 h-3.5 mr-1" />Copy portal link</Button>
                  <Button size="sm" onClick={emailVendor} disabled={!po.vendor_email}><Mail className="w-3.5 h-3.5 mr-1" />Email vendor</Button>
                  {po.vendor_share_token && (
                    <a href={shareUrl(po.vendor_share_token)} target="_blank" rel="noreferrer" className="inline-flex items-center text-xs text-primary hover:underline">
                      <LinkIcon className="w-3.5 h-3.5 mr-1" />Open portal
                    </a>
                  )}
                </div>
                {po.vendor_acknowledged_at && (
                  <p className="text-emerald-600 dark:text-emerald-400 mt-1">✓ Acknowledged {format(new Date(po.vendor_acknowledged_at), "PP p")}</p>
                )}
              </div>
              <div className="border rounded-md p-3 space-y-2 text-xs">
                <h4 className="text-sm font-semibold flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" />Vendor invoice (for 3-way match)</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-[10px]">Invoice #</Label><Input className="h-8" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} /></div>
                  <div><Label className="text-[10px]">Total ({po.currency})</Label><Input className="h-8" type="number" value={invoiceTotal} onChange={(e) => setInvoiceTotal(e.target.value)} /></div>
                </div>
                <Button size="sm" variant="outline" onClick={saveInvoice}>Save invoice details</Button>
              </div>
            </TabsContent>

            {/* ACCOUNTING */}
            <TabsContent value="accounting" className="space-y-3">
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="border rounded-md p-2"><Label className="text-muted-foreground">PO total</Label><div className="font-bold">{fmtMoney(Number(po.total||0), po.currency)}</div></div>
                <div className="border rounded-md p-2"><Label className="text-muted-foreground">Paid to date</Label><div className="font-bold">{fmtMoney(totalPaid, po.currency)}</div></div>
                <div className="border rounded-md p-2"><Label className="text-muted-foreground">Remaining</Label><div className={`font-bold ${remaining > 0 ? "text-amber-600" : "text-emerald-600"}`}>{fmtMoney(remaining, po.currency)}</div></div>
              </div>
              <div className="border rounded-md p-3 space-y-2 text-xs">
                <h4 className="text-sm font-semibold">Record outgoing payment</h4>
                <div className="grid grid-cols-3 gap-2">
                  <div><Label className="text-[10px]">Amount</Label><Input className="h-8" type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} /></div>
                  <div><Label className="text-[10px]">Method</Label>
                    <Select value={payMethod} onValueChange={setPayMethod}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["Bank transfer","Wire","Card","Cheque","Cash","Other"].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label className="text-[10px]">Reference</Label><Input className="h-8" value={payRef} onChange={(e) => setPayRef(e.target.value)} /></div>
                </div>
                <Button size="sm" onClick={recordPayment}>Record payment</Button>
              </div>
              <div className="space-y-1">
                {payments.length === 0 && <p className="text-xs text-muted-foreground">No payments recorded yet.</p>}
                {payments.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between text-xs border rounded-md p-2">
                    <span>{format(new Date(p.paid_at), "PP")} · {p.payment_method || "—"} {p.reference ? `· ${p.reference}` : ""}</span>
                    <span className="font-medium">{fmtMoney(Number(p.amount||0), p.currency || po.currency)}</span>
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* AUDIT */}
            <TabsContent value="audit" className="space-y-2">
              {audit.length === 0 && <p className="text-xs text-muted-foreground">No activity yet.</p>}
              {audit.map((a: any) => (
                <div key={a.id} className="text-xs border-l-2 border-primary/30 pl-2 py-1">
                  <div className="font-medium capitalize">{a.action.replace(/_/g, " ")}</div>
                  <div className="text-muted-foreground">{format(new Date(a.created_at), "PP p")}{a.field ? ` · ${a.field}` : ""}{a.old_value ? ` · ${a.old_value} → ${a.new_value}` : ""}{a.note ? ` · ${a.note}` : ""}</div>
                </div>
              ))}
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
