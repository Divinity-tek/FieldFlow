import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FileText, CheckCircle, XCircle, Clock, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import ClientSupportWidget from "@/components/chat/ClientSupportWidget";

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  approved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  expired: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
};

const ClientEstimates = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedEstimate, setSelectedEstimate] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const { data: estimates = [], isLoading } = useQuery({
    queryKey: ["client-estimates", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estimates")
        .select("*, estimate_line_items(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" }) => {
      const { error } = await supabase.from("estimates").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ["client-estimates"] });
      toast.success(`Estimate ${status}`);
      setDetailOpen(false);
    },
    onError: () => toast.error("Failed to update estimate"),
  });

  const openDetail = (est: any) => {
    setSelectedEstimate(est);
    setDetailOpen(true);
  };

  const actionableEstimates = estimates.filter((e: any) => e.status === "sent");
  const totalApproved = estimates.filter((e: any) => e.status === "approved").reduce((s: number, e: any) => s + Number(e.total), 0);

  return (
    <AppLayout title="Estimates" subtitle="Review and approve service quotes">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <FileText className="w-8 h-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{estimates.length}</p>
              <p className="text-sm text-muted-foreground">Total Estimates</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <Clock className="w-8 h-8 text-blue-500" />
            <div>
              <p className="text-2xl font-bold">{actionableEstimates.length}</p>
              <p className="text-sm text-muted-foreground">Awaiting Your Response</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <DollarSign className="w-8 h-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold">${totalApproved.toFixed(2)}</p>
              <p className="text-sm text-muted-foreground">Approved Value</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Estimates</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm py-4">Loading estimates...</p>
          ) : estimates.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4">No estimates yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Valid Until</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {estimates.map((est: any) => (
                  <TableRow key={est.id}>
                    <TableCell className="text-sm">{format(new Date(est.created_at), "MMM d, yyyy")}</TableCell>
                    <TableCell className="text-sm">{est.estimate_line_items?.length ?? 0} items</TableCell>
                    <TableCell className="text-sm font-medium">${Number(est.total).toFixed(2)}</TableCell>
                    <TableCell className="text-sm">{est.valid_until ? format(new Date(est.valid_until), "MMM d, yyyy") : "—"}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[est.status] ?? ""}>{est.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => openDetail(est)}>View</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Estimate Details</DialogTitle>
            <DialogDescription>Review the line items and approve or reject this quote.</DialogDescription>
          </DialogHeader>
          {selectedEstimate && (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(selectedEstimate.estimate_line_items ?? [])
                    .sort((a: any, b: any) => a.sort_order - b.sort_order)
                    .map((item: any) => (
                      <TableRow key={item.id}>
                        <TableCell className="text-sm">{item.description}</TableCell>
                        <TableCell className="text-sm text-right">{item.quantity}</TableCell>
                        <TableCell className="text-sm text-right">${Number(item.unit_price).toFixed(2)}</TableCell>
                        <TableCell className="text-sm text-right">${Number(item.total).toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
              <div className="flex justify-between text-sm border-t pt-3">
                <span>Subtotal</span>
                <span>${Number(selectedEstimate.subtotal).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Tax ({Number(selectedEstimate.tax_rate)}%)</span>
                <span>${Number(selectedEstimate.tax_amount).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-semibold border-t pt-2">
                <span>Total</span>
                <span>${Number(selectedEstimate.total).toFixed(2)}</span>
              </div>
              {selectedEstimate.notes && (
                <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">{selectedEstimate.notes}</p>
              )}
              {selectedEstimate.status === "sent" && (
                <DialogFooter className="gap-2">
                  <Button
                    variant="destructive"
                    onClick={() => updateStatus.mutate({ id: selectedEstimate.id, status: "rejected" })}
                    disabled={updateStatus.isPending}
                  >
                    <XCircle className="w-4 h-4 mr-1" /> Reject
                  </Button>
                  <Button
                    onClick={() => updateStatus.mutate({ id: selectedEstimate.id, status: "approved" })}
                    disabled={updateStatus.isPending}
                  >
                    <CheckCircle className="w-4 h-4 mr-1" /> Approve
                  </Button>
                </DialogFooter>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
      <ClientSupportWidget />
    </AppLayout>
  );
};

export default ClientEstimates;
