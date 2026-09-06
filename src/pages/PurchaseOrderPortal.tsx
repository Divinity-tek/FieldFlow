import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fmtMoney } from "@/lib/financialDocs";
import { Check, FileCheck2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function PurchaseOrderPortal() {
  const { token } = useParams<{ token: string }>();
  const { data, refetch, isLoading } = useQuery({
    queryKey: ["po-portal", token],
    enabled: !!token,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_po_by_share_token", { _token: token! });
      if (error) throw error;
      return Array.isArray(data) ? data[0] : data;
    },
  });

  const ack = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("acknowledge_po_by_token", { _token: token! });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Thanks — acknowledgment recorded."); refetch(); },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;
  if (!data) return <div className="p-8 text-center"><h1 className="text-xl font-bold">Purchase order not found</h1><p className="text-muted-foreground text-sm">This link may be invalid or revoked.</p></div>;

  const po: any = data;
  return (
    <div className="min-h-screen bg-muted/20 py-10 px-4">
      <div className="max-w-3xl mx-auto space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 flex-wrap">
              <FileCheck2 className="w-5 h-5 text-primary" />
              <span className="font-mono">{po.po_number}</span>
              <Badge variant="outline" className="capitalize">{po.status}</Badge>
              <span className="ml-auto text-base font-normal">{fmtMoney(Number(po.total||0), po.currency || "USD")}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div><div className="text-muted-foreground text-xs">Vendor</div><div className="font-medium">{po.vendor_name}</div></div>
              <div><div className="text-muted-foreground text-xs">Expected delivery</div><div>{po.expected_delivery ? format(new Date(po.expected_delivery), "PP") : "—"}</div></div>
            </div>
            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted/40"><tr><th className="p-2 text-left">Description</th><th className="p-2 text-right">Qty</th><th className="p-2 text-right">Unit</th><th className="p-2 text-right">Total</th></tr></thead>
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
            <div className="text-right space-y-1 text-xs">
              <div>Subtotal: <strong>{fmtMoney(Number(po.subtotal||0), po.currency)}</strong></div>
              <div>Tax: <strong>{fmtMoney(Number(po.tax_amount||0), po.currency)}</strong></div>
              <div>Shipping: <strong>{fmtMoney(Number(po.shipping_cost||0), po.currency)}</strong></div>
              <div className="text-base">Total: <strong>{fmtMoney(Number(po.total||0), po.currency)}</strong></div>
            </div>
            {po.notes && <div className="text-xs text-muted-foreground border-t pt-2"><strong>Notes:</strong> {po.notes}</div>}
            <div className="flex items-center justify-between border-t pt-3">
              {po.vendor_acknowledged_at ? (
                <span className="text-emerald-600 dark:text-emerald-400 text-xs">✓ Acknowledged on {format(new Date(po.vendor_acknowledged_at), "PP p")}</span>
              ) : (
                <Button onClick={() => ack.mutate()} disabled={ack.isPending}><Check className="w-4 h-4 mr-1" />Acknowledge this PO</Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
