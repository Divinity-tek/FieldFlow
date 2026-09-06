import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Wallet, ArrowUpRight, ArrowDownLeft, DollarSign, Users, UserCheck,
  Search, Plus, CheckCircle, Clock, AlertCircle, TrendingUp, CreditCard,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const txTypeConfig: Record<string, { icon: any; color: string; label: string }> = {
  deposit: { icon: ArrowDownLeft, color: "text-emerald-500", label: "Deposit" },
  withdrawal: { icon: ArrowUpRight, color: "text-destructive", label: "Withdrawal" },
  payment: { icon: CreditCard, color: "text-blue-500", label: "Payment" },
  payout: { icon: ArrowUpRight, color: "text-violet-500", label: "Payout" },
  refund: { icon: ArrowDownLeft, color: "text-amber-500", label: "Refund" },
  adjustment: { icon: DollarSign, color: "text-muted-foreground", label: "Adjustment" },
};

const payoutStatusConfig: Record<string, { color: string; label: string }> = {
  estimated: { color: "bg-slate-500/10 text-slate-600 border-slate-200", label: "Estimated" },
  pending: { color: "bg-amber-500/10 text-amber-600 border-amber-200", label: "Pending" },
  processing: { color: "bg-blue-500/10 text-blue-600 border-blue-200", label: "Processing" },
  released: { color: "bg-violet-500/10 text-violet-600 border-violet-200", label: "Released" },
  completed: { color: "bg-emerald-500/10 text-emerald-600 border-emerald-200", label: "Completed" },
  failed: { color: "bg-destructive/10 text-destructive border-destructive/20", label: "Failed" },
  rejected: { color: "bg-destructive/10 text-destructive border-destructive/20", label: "Rejected" },
};

const WalletPayments = () => {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [showAddTx, setShowAddTx] = useState(false);
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null);
  const [txForm, setTxForm] = useState({ type: "deposit", amount: "", description: "" });
  const [showCreateWallet, setShowCreateWallet] = useState(false);
  const [newWallet, setNewWallet] = useState({ owner_type: "client", owner_id: "" });
  const [payoutFilter, setPayoutFilter] = useState("all");
  const [rejectPayout, setRejectPayout] = useState<any>(null);
  const [rejectNotes, setRejectNotes] = useState("");

  // ── Data ──
  const { data: wallets = [] } = useQuery({
    queryKey: ["wallets"],
    queryFn: async () => {
      const { data } = await supabase.from("wallets").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ["wallet-transactions"],
    queryFn: async () => {
      const { data } = await supabase.from("wallet_transactions").select("*").order("created_at", { ascending: false }).limit(200);
      return data ?? [];
    },
  });

  const { data: payouts = [] } = useQuery({
    queryKey: ["engineer-payouts"],
    queryFn: async () => {
      const { data } = await supabase.from("engineer_payouts").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["wallet-clients"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, company_name");
      return data ?? [];
    },
  });

  const { data: engineers = [] } = useQuery({
    queryKey: ["wallet-engineers"],
    queryFn: async () => {
      const { data: engs } = await supabase.from("engineers").select("id, user_id");
      if (!engs?.length) return [];
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", engs.map(e => e.user_id));
      const pm = Object.fromEntries((profiles ?? []).map(p => [p.user_id, p.full_name]));
      return engs.map(e => ({ id: e.id, name: pm[e.user_id] ?? "Unknown" }));
    },
  });

  const clientMap = useMemo(() => new Map(clients.map(c => [c.id, c.company_name])), [clients]);
  const engineerMap = useMemo(() => new Map(engineers.map(e => [e.id, e.name])), [engineers]);

  const getOwnerName = (type: string, id: string) =>
    type === "client" ? (clientMap.get(id) ?? "Unknown Client") : (engineerMap.get(id) ?? "Unknown Engineer");

  // Filtered wallets
  const filteredWallets = useMemo(() => {
    return wallets.filter((w: any) => {
      const name = getOwnerName(w.owner_type, w.owner_id).toLowerCase();
      const matchesSearch = !search || name.includes(search.toLowerCase());
      const matchesType = ownerFilter === "all" || w.owner_type === ownerFilter;
      return matchesSearch && matchesType;
    });
  }, [wallets, search, ownerFilter, clientMap, engineerMap]);

  // Stats
  const stats = useMemo(() => {
    const clientWallets = wallets.filter((w: any) => w.owner_type === "client");
    const engineerWallets = wallets.filter((w: any) => w.owner_type === "engineer");
    return {
      totalBalance: wallets.reduce((sum: number, w: any) => sum + Number(w.balance), 0),
      clientBalance: clientWallets.reduce((sum: number, w: any) => sum + Number(w.balance), 0),
      engineerBalance: engineerWallets.reduce((sum: number, w: any) => sum + Number(w.balance), 0),
      pendingPayouts: payouts.filter((p: any) => p.status === "pending").reduce((sum: number, p: any) => sum + Number(p.amount), 0),
      releasedPayouts: payouts.filter((p: any) => p.status === "released").reduce((sum: number, p: any) => sum + Number(p.amount), 0),
      estimatedPayouts: payouts.filter((p: any) => p.status === "estimated").reduce((sum: number, p: any) => sum + Number(p.amount), 0),
    };
  }, [wallets, payouts]);

  // Filtered payouts
  const filteredPayouts = useMemo(() => {
    return payouts.filter((p: any) => payoutFilter === "all" || p.status === payoutFilter);
  }, [payouts, payoutFilter]);

  // ── Mutations ──
  const addTransactionMutation = useMutation({
    mutationFn: async () => {
      if (!selectedWalletId) return;
      const wallet = wallets.find((w: any) => w.id === selectedWalletId);
      if (!wallet) return;
      const amount = Number(txForm.amount);
      if (!amount || amount <= 0) throw new Error("Invalid amount");

      const isCredit = ["deposit", "refund"].includes(txForm.type);
      const newBalance = Number(wallet.balance) + (isCredit ? amount : -amount);

      const { error: txError } = await supabase.from("wallet_transactions").insert({
        wallet_id: selectedWalletId,
        type: txForm.type as any,
        amount: isCredit ? amount : -amount,
        balance_after: newBalance,
        description: txForm.description.trim() || null,
      });
      if (txError) throw txError;

      const { error: walletError } = await supabase.from("wallets").update({ balance: newBalance }).eq("id", selectedWalletId);
      if (walletError) throw walletError;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wallets"] });
      qc.invalidateQueries({ queryKey: ["wallet-transactions"] });
      toast.success("Transaction recorded");
      setShowAddTx(false);
      setTxForm({ type: "deposit", amount: "", description: "" });
    },
    onError: (e: any) => toast.error(e.message || "Failed to record transaction"),
  });

  const createWalletMutation = useMutation({
    mutationFn: async () => {
      if (!newWallet.owner_id) throw new Error("Select an owner");
      const { error } = await supabase.from("wallets").insert({
        owner_type: newWallet.owner_type as any,
        owner_id: newWallet.owner_id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wallets"] });
      toast.success("Wallet created");
      setShowCreateWallet(false);
      setNewWallet({ owner_type: "client", owner_id: "" });
    },
    onError: (e: any) => toast.error(e.message?.includes("duplicate") ? "Wallet already exists for this owner" : "Failed to create wallet"),
  });

  const updatePayoutMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const payload: any = { status };
      if (status === "completed") payload.processed_at = new Date().toISOString();
      const { error } = await supabase.from("engineer_payouts").update(payload).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["engineer-payouts"] });
      toast.success("Payout status updated");
    },
    onError: () => toast.error("Failed to update payout"),
  });

  const rejectPayoutMutation = useMutation({
    mutationFn: async () => {
      if (!rejectPayout) return;
      const { error } = await supabase.from("engineer_payouts").update({
        status: "rejected",
        notes: rejectNotes.trim() || null,
      }).eq("id", rejectPayout.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["engineer-payouts"] });
      toast.success("Invoice rejected");
      setRejectPayout(null);
      setRejectNotes("");
    },
    onError: () => toast.error("Failed to reject invoice"),
  });

  const ownerOptions = newWallet.owner_type === "client"
    ? clients.map(c => ({ id: c.id, label: c.company_name }))
    : engineers.map(e => ({ id: e.id, label: e.name }));

  return (
    <AppLayout title="Wallet & Payments" subtitle="Manage client balances, engineer payouts, and transaction history">
      <div className="space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          {[
            { label: "Total Balance", value: stats.totalBalance, icon: Wallet, color: "text-primary" },
            { label: "Client Funds", value: stats.clientBalance, icon: Building2, color: "text-blue-500" },
            { label: "Engineer Balances", value: stats.engineerBalance, icon: UserCheck, color: "text-emerald-500" },
            { label: "Estimated", value: stats.estimatedPayouts, icon: Clock, color: "text-slate-500" },
            { label: "Pending Payouts", value: stats.pendingPayouts, icon: Clock, color: "text-amber-500" },
            { label: "Released", value: stats.releasedPayouts, icon: ArrowUpRight, color: "text-violet-500" },
          ].map(s => (
            <Card key={s.label} className="border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                    <p className="text-xl font-bold text-foreground mt-1">£{s.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className={cn("p-2.5 rounded-lg bg-muted/50", s.color)}>
                    <s.icon className="w-5 h-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="wallets">
          <TabsList>
            <TabsTrigger value="wallets">Wallets</TabsTrigger>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
            <TabsTrigger value="payouts">Engineer Payouts</TabsTrigger>
          </TabsList>

          {/* ── Wallets Tab ── */}
          <TabsContent value="wallets" className="space-y-4 mt-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:flex-none">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="Search wallets..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9 text-sm w-full sm:w-64" />
                </div>
                <Select value={ownerFilter} onValueChange={setOwnerFilter}>
                  <SelectTrigger className="w-32 h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="client">Clients</SelectItem>
                    <SelectItem value="engineer">Engineers</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button size="sm" onClick={() => setShowCreateWallet(true)}>
                <Plus className="w-4 h-4 mr-1" /> New Wallet
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredWallets.map((w: any) => {
                const name = getOwnerName(w.owner_type, w.owner_id);
                const walletTxs = transactions.filter((t: any) => t.wallet_id === w.id).slice(0, 3);
                return (
                  <Card key={w.id} className="border-border/50 hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">{name}</p>
                          <Badge variant="outline" className="text-[9px] mt-1 capitalize">{w.owner_type}</Badge>
                        </div>
                        <p className={cn("text-lg font-bold", Number(w.balance) >= 0 ? "text-foreground" : "text-destructive")}>
                          £{Number(w.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </p>
                      </div>

                      {walletTxs.length > 0 && (
                        <div className="space-y-1.5 mb-3">
                          {walletTxs.map((tx: any) => {
                            const cfg = txTypeConfig[tx.type] || txTypeConfig.adjustment;
                            const TxIcon = cfg.icon;
                            return (
                              <div key={tx.id} className="flex items-center justify-between text-[10px]">
                                <div className="flex items-center gap-1.5">
                                  <TxIcon className={cn("w-3 h-3", cfg.color)} />
                                  <span className="text-muted-foreground">{cfg.label}</span>
                                </div>
                                <span className={cn("font-medium", Number(tx.amount) >= 0 ? "text-emerald-600" : "text-destructive")}>
                                  {Number(tx.amount) >= 0 ? "+" : ""}£{Math.abs(Number(tx.amount)).toFixed(2)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <Button variant="outline" size="sm" className="w-full text-xs h-8" onClick={() => { setSelectedWalletId(w.id); setShowAddTx(true); }}>
                        <Plus className="w-3 h-3 mr-1" /> Add Transaction
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
              {filteredWallets.length === 0 && (
                <p className="text-sm text-muted-foreground col-span-full text-center py-8">No wallets found.</p>
              )}
            </div>
          </TabsContent>

          {/* ── Transactions Tab ── */}
          <TabsContent value="transactions" className="mt-4">
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm">Recent Transactions</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px]">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Type</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Wallet</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Description</th>
                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">Amount</th>
                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">Balance After</th>
                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((tx: any) => {
                        const cfg = txTypeConfig[tx.type] || txTypeConfig.adjustment;
                        const TxIcon = cfg.icon;
                        const wallet = wallets.find((w: any) => w.id === tx.wallet_id);
                        const ownerName = wallet ? getOwnerName(wallet.owner_type, wallet.owner_id) : "—";
                        return (
                          <tr key={tx.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5">
                                <TxIcon className={cn("w-3.5 h-3.5", cfg.color)} />
                                <span className="text-xs font-medium">{cfg.label}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-xs text-foreground">{ownerName}</td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">{tx.description || "—"}</td>
                            <td className={cn("px-4 py-3 text-xs font-semibold text-right", Number(tx.amount) >= 0 ? "text-emerald-600" : "text-destructive")}>
                              {Number(tx.amount) >= 0 ? "+" : ""}£{Math.abs(Number(tx.amount)).toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-xs text-right text-muted-foreground">£{Number(tx.balance_after).toFixed(2)}</td>
                            <td className="px-4 py-3 text-xs text-right text-muted-foreground">{format(new Date(tx.created_at), "dd MMM yyyy HH:mm")}</td>
                          </tr>
                        );
                      })}
                      {transactions.length === 0 && (
                        <tr><td colSpan={6} className="text-center py-8 text-sm text-muted-foreground">No transactions yet.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Payouts Tab ── */}
          <TabsContent value="payouts" className="space-y-4 mt-4">
            <div className="flex items-center gap-2">
              <Select value={payoutFilter} onValueChange={setPayoutFilter}>
                <SelectTrigger className="w-36 h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="estimated">Estimated</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="released">Released</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px]">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Engineer</th>
                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">Amount</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Method</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Status</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Notes</th>
                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">Date</th>
                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPayouts.map((p: any) => {
                        const cfg = payoutStatusConfig[p.status] || payoutStatusConfig.pending;
                        return (
                          <tr key={p.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30">
                            <td className="px-4 py-3 text-xs font-medium text-foreground">{engineerMap.get(p.engineer_id) ?? "Unknown"}</td>
                            <td className="px-4 py-3 text-xs font-semibold text-right text-foreground">£{Number(p.amount).toFixed(2)}</td>
                            <td className="px-4 py-3 text-xs text-muted-foreground capitalize">{(p.payout_method ?? "bank_transfer").replace(/_/g, " ")}</td>
                            <td className="px-4 py-3">
                              <Badge variant="outline" className={cn("text-[10px]", cfg.color)}>{cfg.label}</Badge>
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">{p.notes || "—"}</td>
                            <td className="px-4 py-3 text-xs text-right text-muted-foreground">{format(new Date(p.created_at), "dd MMM yyyy")}</td>
                            <td className="px-4 py-3 text-right">
                              {p.status === "estimated" && (
                                <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={() => updatePayoutMutation.mutate({ id: p.id, status: "pending" })}>
                                  Confirm
                                </Button>
                              )}
                              {p.status === "pending" && (
                                <div className="flex gap-1 justify-end">
                                  <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={() => updatePayoutMutation.mutate({ id: p.id, status: "processing" })}>
                                    Process
                                  </Button>
                                  <Button variant="default" size="sm" className="h-6 text-[10px]" onClick={() => updatePayoutMutation.mutate({ id: p.id, status: "released" })}>
                                    Release
                                  </Button>
                                </div>
                              )}
                              {p.status === "pending" && (
                                <div className="flex gap-1 justify-end">
                                  <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={() => updatePayoutMutation.mutate({ id: p.id, status: "processing" })}>
                                    Process
                                  </Button>
                                  <Button variant="default" size="sm" className="h-6 text-[10px]" onClick={() => updatePayoutMutation.mutate({ id: p.id, status: "released" })}>
                                    Release
                                  </Button>
                                  <Button variant="destructive" size="sm" className="h-6 text-[10px]" onClick={() => setRejectPayout(p)}>
                                    Reject
                                  </Button>
                                </div>
                              )}
                              {p.status === "processing" && (
                                <Button variant="default" size="sm" className="h-6 text-[10px]" onClick={() => updatePayoutMutation.mutate({ id: p.id, status: "released" })}>
                                  Release
                                </Button>
                              )}
                              {p.status === "released" && (
                                <Button variant="default" size="sm" className="h-6 text-[10px]" onClick={() => updatePayoutMutation.mutate({ id: p.id, status: "completed" })}>
                                  Mark Complete
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {filteredPayouts.length === 0 && (
                        <tr><td colSpan={7} className="text-center py-8 text-sm text-muted-foreground">No payouts found.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Add Transaction Dialog */}
      <Dialog open={showAddTx} onOpenChange={o => { if (!o) setShowAddTx(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record Transaction</DialogTitle>
            <DialogDescription>Add a financial transaction to this wallet.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm">Type</Label>
              <Select value={txForm.type} onValueChange={v => setTxForm(f => ({ ...f, type: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="deposit">Deposit</SelectItem>
                  <SelectItem value="withdrawal">Withdrawal</SelectItem>
                  <SelectItem value="payment">Payment</SelectItem>
                  <SelectItem value="payout">Payout</SelectItem>
                  <SelectItem value="refund">Refund</SelectItem>
                  <SelectItem value="adjustment">Adjustment</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm">Amount (£) <span className="text-destructive">*</span></Label>
              <Input type="number" min="0.01" step="0.01" value={txForm.amount} onChange={e => setTxForm(f => ({ ...f, amount: e.target.value }))} className="mt-1" placeholder="0.00" />
            </div>
            <div>
              <Label className="text-sm">Description</Label>
              <Textarea value={txForm.description} onChange={e => setTxForm(f => ({ ...f, description: e.target.value }))} className="mt-1" placeholder="Optional note..." rows={2} maxLength={500} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddTx(false)}>Cancel</Button>
            <Button onClick={() => addTransactionMutation.mutate()} disabled={!txForm.amount || addTransactionMutation.isPending}>
              {addTransactionMutation.isPending ? "Saving..." : "Record"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Wallet Dialog */}
      <Dialog open={showCreateWallet} onOpenChange={o => { if (!o) setShowCreateWallet(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Wallet</DialogTitle>
            <DialogDescription>Create a new wallet for a client or engineer.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm">Owner Type</Label>
              <Select value={newWallet.owner_type} onValueChange={v => setNewWallet({ owner_type: v, owner_id: "" })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="client">Client</SelectItem>
                  <SelectItem value="engineer">Engineer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm">Owner <span className="text-destructive">*</span></Label>
              <Select value={newWallet.owner_id} onValueChange={v => setNewWallet(f => ({ ...f, owner_id: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {ownerOptions.map(o => (
                    <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateWallet(false)}>Cancel</Button>
            <Button onClick={() => createWalletMutation.mutate()} disabled={!newWallet.owner_id || createWalletMutation.isPending}>
              {createWalletMutation.isPending ? "Creating..." : "Create Wallet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejectPayout} onOpenChange={(o) => { if (!o) { setRejectPayout(null); setRejectNotes(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Invoice</DialogTitle>
            <DialogDescription>
              {rejectPayout && `£${Number(rejectPayout.amount).toFixed(2)} from ${engineerMap.get(rejectPayout.engineer_id) ?? "engineer"}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-sm">Reason (shown to engineer)</Label>
            <Textarea value={rejectNotes} onChange={(e) => setRejectNotes(e.target.value)} rows={3} placeholder="Optional reason…" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectPayout(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => rejectPayoutMutation.mutate()} disabled={rejectPayoutMutation.isPending}>
              {rejectPayoutMutation.isPending ? "Rejecting…" : "Reject Invoice"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default WalletPayments;
