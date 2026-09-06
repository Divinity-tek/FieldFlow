import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Receipt, DollarSign, AlertTriangle, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import ClientSupportWidget from "@/components/chat/ClientSupportWidget";

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  paid: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  overdue: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  cancelled: "bg-muted text-muted-foreground",
};

const ClientInvoices = () => {
  const { user } = useAuth();

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["client-invoices", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const totalOwed = invoices.filter((i: any) => i.status === "sent" || i.status === "overdue").reduce((s: number, i: any) => s + Number(i.total), 0);
  const totalPaid = invoices.filter((i: any) => i.status === "paid").reduce((s: number, i: any) => s + Number(i.total), 0);
  const overdueCount = invoices.filter((i: any) => i.status === "overdue").length;

  return (
    <AppLayout title="Invoices" subtitle="View and manage your invoices">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <DollarSign className="w-8 h-8 text-blue-500" />
            <div>
              <p className="text-2xl font-bold">${totalOwed.toFixed(2)}</p>
              <p className="text-sm text-muted-foreground">Outstanding Balance</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <CheckCircle className="w-8 h-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold">${totalPaid.toFixed(2)}</p>
              <p className="text-sm text-muted-foreground">Total Paid</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-red-500" />
            <div>
              <p className="text-2xl font-bold">{overdueCount}</p>
              <p className="text-sm text-muted-foreground">Overdue</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm py-4">Loading invoices...</p>
          ) : invoices.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4">No invoices yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Paid On</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv: any) => (
                  <TableRow key={inv.id}>
                    <TableCell className="text-sm font-medium">{inv.invoice_number}</TableCell>
                    <TableCell className="text-sm">{format(new Date(inv.created_at), "MMM d, yyyy")}</TableCell>
                    <TableCell className="text-sm">{inv.due_date ? format(new Date(inv.due_date), "MMM d, yyyy") : "—"}</TableCell>
                    <TableCell className="text-sm font-medium">${Number(inv.total).toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[inv.status] ?? ""}>{inv.status}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{inv.paid_at ? format(new Date(inv.paid_at), "MMM d, yyyy") : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <ClientSupportWidget />
    </AppLayout>
  );
};

export default ClientInvoices;
