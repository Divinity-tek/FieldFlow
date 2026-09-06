import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowDownToLine, ArrowUpFromLine, Wallet, Scale } from "lucide-react";
import { fmtMoney } from "@/lib/financialDocs";

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" }) : "—";

const StatusPill = ({ status }: { status?: string | null }) => {
  if (!status) return <span className="text-muted-foreground">—</span>;
  const s = status.toLowerCase();
  const variant: any =
    ["paid", "succeeded", "completed", "approved"].includes(s) ? "default"
    : ["pending", "draft", "scheduled"].includes(s) ? "secondary"
    : ["failed", "rejected", "cancelled", "canceled"].includes(s) ? "destructive"
    : "outline";
  return <Badge variant={variant} className="capitalize text-[10px]">{s.replace(/_/g, " ")}</Badge>;
};

export default function AccountingTab() {
  const { data: incoming = [] } = useQuery({
    queryKey: ["accounting-incoming"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_invoice_payments")
        .select("id, amount, currency, status, paid_at, external_ref, receipt_id, clients(company_name), customer_invoices(invoice_number), client_payment_methods(label, brand, last4)")
        .order("paid_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: payouts = [] } = useQuery({
    queryKey: ["accounting-payouts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("engineer_payouts")
        .select("id, amount, status, payout_method, processed_at, created_at, notes, engineers(user_id, profiles:user_id(full_name))")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: pos = [] } = useQuery({
    queryKey: ["accounting-pos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_orders")
        .select("id, po_number, vendor_name, status, receive_status, total, currency, expected_delivery, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: poPayments = [] } = useQuery({
    queryKey: ["accounting-po-payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("po_accounting_entries")
        .select("id, po_id, amount, currency, fx_rate, payment_method, reference, paid_at, purchase_orders(po_number, vendor_name, total, currency)")
        .order("paid_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
  });

  const totals = useMemo(() => {
    const inSucceeded = incoming.filter((p: any) => ["succeeded", "paid", "completed"].includes((p.status || "").toLowerCase()));
    const inPending = incoming.filter((p: any) => !["succeeded", "paid", "completed"].includes((p.status || "").toLowerCase()));
    const totalIn = inSucceeded.reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
    const pendingIn = inPending.reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
    const paidPayouts = payouts.filter((p: any) => ["completed", "paid", "processed"].includes((p.status || "").toLowerCase()));
    const pendingPayouts = payouts.filter((p: any) => !["completed", "paid", "processed"].includes((p.status || "").toLowerCase()));
    const totalPayouts = paidPayouts.reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
    const pendingPayoutsTotal = pendingPayouts.reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
    const poCommitted = pos.reduce((s: number, p: any) => s + Number(p.total || 0), 0);
    const poPaidTotal = poPayments.reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
    const poOutstanding = Math.max(0, poCommitted - poPaidTotal);
    const totalOut = totalPayouts + poPaidTotal;
    return { totalIn, pendingIn, totalPayouts, pendingPayoutsTotal, poCommitted, poPaidTotal, poOutstanding, totalOut, net: totalIn - totalOut };
  }, [incoming, payouts, pos, poPayments]);

  // Aggregate amount paid per PO for status pill
  const paidByPo = useMemo(() => {
    const m: Record<string, number> = {};
    for (const p of poPayments as any[]) {
      m[p.po_id] = (m[p.po_id] || 0) + Number(p.amount || 0);
    }
    return m;
  }, [poPayments]);
  const poPaymentStatus = (po: any) => {
    const paid = paidByPo[po.id] || 0;
    const total = Number(po.total || 0);
    if (total <= 0) return "—";
    if (paid <= 0) return "unpaid";
    if (paid + 0.01 < total) return "partial";
    return "paid";
  };

  const fmtMethod = (pm: any) => {
    if (!pm) return "—";
    return [pm.brand || pm.label, pm.last4 ? `•••• ${pm.last4}` : ""].filter(Boolean).join(" ").trim() || "—";
  };

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-muted-foreground flex items-center gap-1.5"><ArrowDownToLine className="w-3.5 h-3.5 text-emerald-500" />Incoming (received)</CardTitle></CardHeader>
          <CardContent>
            <p className="text-xl font-bold">{fmtMoney(totals.totalIn, "USD")}</p>
            <p className="text-[11px] text-muted-foreground mt-1">Pending: {fmtMoney(totals.pendingIn, "USD")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-muted-foreground flex items-center gap-1.5"><ArrowUpFromLine className="w-3.5 h-3.5 text-rose-500" />Outgoing (paid out)</CardTitle></CardHeader>
          <CardContent>
            <p className="text-xl font-bold">{fmtMoney(totals.totalOut, "USD")}</p>
            <p className="text-[11px] text-muted-foreground mt-1">Payouts {fmtMoney(totals.totalPayouts, "USD")} · POs paid {fmtMoney(totals.poPaidTotal, "USD")} (committed {fmtMoney(totals.poCommitted, "USD")})</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-muted-foreground flex items-center gap-1.5"><Wallet className="w-3.5 h-3.5 text-amber-500" />Pending payouts</CardTitle></CardHeader>
          <CardContent>
            <p className="text-xl font-bold">{fmtMoney(totals.pendingPayoutsTotal, "USD")}</p>
            <p className="text-[11px] text-muted-foreground mt-1">{payouts.filter((p: any) => !["completed","paid","processed"].includes((p.status||"").toLowerCase())).length} awaiting</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-muted-foreground flex items-center gap-1.5"><Scale className="w-3.5 h-3.5 text-primary" />Net cash flow</CardTitle></CardHeader>
          <CardContent>
            <p className={`text-xl font-bold ${totals.net >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
              {fmtMoney(totals.net, "USD")}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">Incoming − Outgoing</p>
          </CardContent>
        </Card>
      </div>

      {/* Incoming payments */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ArrowDownToLine className="w-4 h-4 text-emerald-500" />Incoming payments
            <Badge variant="outline" className="ml-1">{incoming.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b">
                <tr>
                  <th className="text-left py-2 px-2 font-medium">Date</th>
                  <th className="text-left py-2 px-2 font-medium">Client</th>
                  <th className="text-left py-2 px-2 font-medium">Invoice</th>
                  <th className="text-left py-2 px-2 font-medium">Method</th>
                  <th className="text-left py-2 px-2 font-medium">Reference</th>
                  <th className="text-left py-2 px-2 font-medium">Status</th>
                  <th className="text-right py-2 px-2 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {incoming.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-6 text-muted-foreground text-xs">No incoming payments recorded.</td></tr>
                )}
                {incoming.map((p: any) => (
                  <tr key={p.id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="py-2 px-2 whitespace-nowrap">{fmtDate(p.paid_at)}</td>
                    <td className="py-2 px-2">{p.clients?.company_name || "—"}</td>
                    <td className="py-2 px-2 font-mono text-xs">{p.customer_invoices?.invoice_number || "—"}</td>
                    <td className="py-2 px-2 text-xs">{fmtMethod(p.client_payment_methods)}</td>
                    <td className="py-2 px-2 text-xs text-muted-foreground">{p.external_ref || "—"}{p.receipt_id ? " · 🔗 receipt" : ""}</td>
                    <td className="py-2 px-2"><StatusPill status={p.status} /></td>
                    <td className="py-2 px-2 text-right font-medium">{fmtMoney(Number(p.amount || 0), p.currency || "USD")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Outgoing - Engineer payouts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ArrowUpFromLine className="w-4 h-4 text-rose-500" />Engineer payouts
            <Badge variant="outline" className="ml-1">{payouts.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b">
                <tr>
                  <th className="text-left py-2 px-2 font-medium">Date</th>
                  <th className="text-left py-2 px-2 font-medium">Engineer</th>
                  <th className="text-left py-2 px-2 font-medium">Method</th>
                  <th className="text-left py-2 px-2 font-medium">Notes</th>
                  <th className="text-left py-2 px-2 font-medium">Status</th>
                  <th className="text-right py-2 px-2 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {payouts.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-6 text-muted-foreground text-xs">No engineer payouts yet.</td></tr>
                )}
                {payouts.map((p: any) => (
                  <tr key={p.id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="py-2 px-2 whitespace-nowrap">{fmtDate(p.processed_at || p.created_at)}</td>
                    <td className="py-2 px-2">{p.engineers?.profiles?.full_name || "—"}</td>
                    <td className="py-2 px-2 text-xs capitalize">{(p.payout_method || "—").replace(/_/g, " ")}</td>
                    <td className="py-2 px-2 text-xs text-muted-foreground truncate max-w-[280px]">{p.notes || "—"}</td>
                    <td className="py-2 px-2"><StatusPill status={p.status} /></td>
                    <td className="py-2 px-2 text-right font-medium">{fmtMoney(Number(p.amount || 0), "USD")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Outgoing - Purchase orders */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ArrowUpFromLine className="w-4 h-4 text-rose-500" />Purchase orders
            <Badge variant="outline" className="ml-1">{pos.length}</Badge>
            <span className="ml-auto text-xs font-normal text-muted-foreground">
              Outstanding: <strong>{fmtMoney(totals.poOutstanding, "USD")}</strong>
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b">
                <tr>
                  <th className="text-left py-2 px-2 font-medium">Date</th>
                  <th className="text-left py-2 px-2 font-medium">PO #</th>
                  <th className="text-left py-2 px-2 font-medium">Vendor</th>
                  <th className="text-left py-2 px-2 font-medium">Expected</th>
                  <th className="text-left py-2 px-2 font-medium">PO status</th>
                  <th className="text-left py-2 px-2 font-medium">Payment</th>
                  <th className="text-right py-2 px-2 font-medium">Paid / Total</th>
                </tr>
              </thead>
              <tbody>
                {pos.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-6 text-muted-foreground text-xs">No purchase orders yet.</td></tr>
                )}
                {pos.map((p: any) => {
                  const paid = paidByPo[p.id] || 0;
                  return (
                    <tr key={p.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-2 px-2 whitespace-nowrap">{fmtDate(p.created_at)}</td>
                      <td className="py-2 px-2 font-mono text-xs">{p.po_number}</td>
                      <td className="py-2 px-2">{p.vendor_name}</td>
                      <td className="py-2 px-2 text-xs">{fmtDate(p.expected_delivery)}</td>
                      <td className="py-2 px-2"><StatusPill status={p.status} /></td>
                      <td className="py-2 px-2"><StatusPill status={poPaymentStatus(p)} /></td>
                      <td className="py-2 px-2 text-right font-medium">
                        <span className="text-emerald-600 dark:text-emerald-400">{fmtMoney(paid, p.currency || "USD")}</span>
                        <span className="text-muted-foreground"> / {fmtMoney(Number(p.total || 0), p.currency || "USD")}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Outgoing - PO payments (accounting entries) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ArrowUpFromLine className="w-4 h-4 text-rose-500" />PO payments
            <Badge variant="outline" className="ml-1">{poPayments.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b">
                <tr>
                  <th className="text-left py-2 px-2 font-medium">Date</th>
                  <th className="text-left py-2 px-2 font-medium">PO #</th>
                  <th className="text-left py-2 px-2 font-medium">Vendor</th>
                  <th className="text-left py-2 px-2 font-medium">Method</th>
                  <th className="text-left py-2 px-2 font-medium">Reference</th>
                  <th className="text-right py-2 px-2 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {poPayments.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-6 text-muted-foreground text-xs">No PO payments recorded.</td></tr>
                )}
                {(poPayments as any[]).map((p) => (
                  <tr key={p.id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="py-2 px-2 whitespace-nowrap">{fmtDate(p.paid_at)}</td>
                    <td className="py-2 px-2 font-mono text-xs">{p.purchase_orders?.po_number || "—"}</td>
                    <td className="py-2 px-2">{p.purchase_orders?.vendor_name || "—"}</td>
                    <td className="py-2 px-2 text-xs">{p.payment_method || "—"}</td>
                    <td className="py-2 px-2 text-xs text-muted-foreground">{p.reference || "—"}</td>
                    <td className="py-2 px-2 text-right font-medium">{fmtMoney(Number(p.amount || 0), p.currency || "USD")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
