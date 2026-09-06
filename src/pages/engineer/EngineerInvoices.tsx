import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { Receipt, Send, Briefcase } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

// ── Status display config — mirrors WalletPayments.tsx exactly ─────────────
const payoutStatusConfig: Record<string, { color: string; label: string }> = {
  estimated: { color: "bg-slate-500/10 text-slate-600 border-slate-200", label: "Estimated" },
  pending: { color: "bg-amber-500/10 text-amber-600 border-amber-200", label: "Pending Review" },
  processing: { color: "bg-blue-500/10 text-blue-600 border-blue-200", label: "Processing" },
  released: { color: "bg-violet-500/10 text-violet-600 border-violet-200", label: "Released" },
  completed: { color: "bg-emerald-500/10 text-emerald-600 border-emerald-200", label: "Paid" },
  rejected: { color: "bg-destructive/10 text-destructive border-destructive/20", label: "Rejected" },
  failed: { color: "bg-destructive/10 text-destructive border-destructive/20", label: "Failed" },
};

// NOTE: adjust the `jobs` filter below (assigned_engineer_id / status) to
// match your actual jobs table schema.
const EngineerInvoices = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selectedJobId, setSelectedJobId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  // This engineer's own `engineers` row (payouts reference engineers.id, not auth user id)
  const { data: engineerRow } = useQuery({
    queryKey: ["my-engineer-row", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("engineers")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Completed jobs assigned to this engineer, that don't already have a
  // non-rejected payout request submitted against them.
  const { data: eligibleJobs = [], isLoading: jobsLoading } = useQuery({
    queryKey: ["engineer-completed-jobs", engineerRow?.id],
    queryFn: async () => {
      if (!engineerRow) return [];
      const { data: jobs, error } = await supabase
        .from("jobs")
        .select("id, title, completed_at, status")
        .eq("engineer_id", engineerRow.id)
        .eq("status", "completed")
        .order("completed_at", { ascending: false });
      if (error) throw error;

      const { data: existingPayouts } = await supabase
        .from("engineer_payouts")
        .select("job_id, status")
        .eq("engineer_id", engineerRow?.id ?? "");

      const blockedJobIds = new Set(
        (existingPayouts ?? [])
          .filter((p: any) => p.status !== "rejected")
          .map((p: any) => p.job_id)
      );

      return (jobs ?? []).filter((j: any) => !blockedJobIds.has(j.id));
    },
    enabled: !!engineerRow,
  });

  const { data: myPayouts = [], isLoading: payoutsLoading } = useQuery({
    queryKey: ["my-payouts", engineerRow?.id],
    queryFn: async () => {
      if (!engineerRow) return [];
      const { data, error } = await supabase
        .from("engineer_payouts")
        .select("id, amount, status, description, notes, created_at, job_id, jobs(title)")
        .eq("engineer_id", engineerRow.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!engineerRow,
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!engineerRow) throw new Error("Engineer profile not found");
      if (!selectedJobId) throw new Error("Select a completed job");
      const amt = Number(amount);
      if (!amt || amt <= 0) throw new Error("Enter a valid amount");

      // Cast to any to satisfy Supabase client's generated types for insert
      const { error } = await supabase.from("engineer_payouts").insert({
        engineer_id: engineerRow.id,
        job_id: selectedJobId,
        amount: amt,
        notes: description.trim() || null,
        status: "pending",
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Invoice submitted for review 🎉");
      setSelectedJobId("");
      setAmount("");
      setDescription("");
      qc.invalidateQueries({ queryKey: ["my-payouts", engineerRow?.id] });
      qc.invalidateQueries({ queryKey: ["engineer-completed-jobs", engineerRow?.id] });
    },
    onError: (e: any) => toast.error(e.message || "Failed to submit invoice"),
  });

  const selectedJob = useMemo(
    () => eligibleJobs.find((j: any) => j.id === selectedJobId),
    [eligibleJobs, selectedJobId]
  );

  return (
    <AppLayout title="My Invoices" subtitle="Submit payout requests for completed jobs">
      <div className="space-y-6">
        {/* ── Submit form ──────────────────────────────────────────────────── */}
        <div className="rounded-xl border border-border/50 bg-card/95 backdrop-blur-sm shadow-card">
          <div className="flex flex-col space-y-1.5 p-6 pb-4">
            <h3 className="text-xl font-semibold leading-none tracking-tight flex items-center gap-2">
              <Receipt className="w-5 h-5 text-primary" />
              Submit an Invoice
            </h3>
            <p className="text-sm text-muted-foreground">Pick a completed job to request payment for.</p>
          </div>
          <div className="px-6 pb-6 space-y-4">
            <div>
              <Label htmlFor="eng-job">Completed Job <span className="text-destructive">*</span></Label>
              <Select value={selectedJobId} onValueChange={setSelectedJobId} disabled={jobsLoading}>
                <SelectTrigger id="eng-job">
                  <SelectValue placeholder={jobsLoading ? "Loading jobs…" : eligibleJobs.length ? "Select a job" : "No eligible jobs"} />
                </SelectTrigger>
                <SelectContent>
                  {eligibleJobs.map((job: any) => (
                    <SelectItem key={job.id} value={job.id}>
                      {job.title ?? "Untitled job"} {job.completed_at ? `· ${format(new Date(job.completed_at), "dd MMM yyyy")}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!jobsLoading && eligibleJobs.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1.5">
                  No completed jobs available to invoice — either none are completed yet, or you've already submitted for all of them.
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="eng-amount">Amount <span className="text-destructive">*</span></Label>
              <Input
                id="eng-amount"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="eng-desc">Notes for Admin</Label>
              <Textarea
                id="eng-desc"
                placeholder="e.g. Hours worked, parts used, anything relevant to this invoice…"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <Button
              className="gap-2"
              disabled={!selectedJobId || !amount || submitMutation.isPending}
              onClick={() => submitMutation.mutate()}
            >
              <Send className="w-4 h-4" />
              {submitMutation.isPending ? "Submitting…" : "Submit Invoice"}
            </Button>
          </div>
        </div>

        {/* ── History ──────────────────────────────────────────────────────── */}
        <div className="rounded-xl border border-border/50 bg-card/95 backdrop-blur-sm shadow-card">
          <div className="flex flex-col space-y-1.5 p-6 pb-3">
            <h3 className="text-xl font-semibold leading-none tracking-tight">Your Invoices</h3>
          </div>
          <div className="p-0">
            {payoutsLoading ? (
              <p className="text-sm text-muted-foreground text-center py-10">Loading…</p>
            ) : myPayouts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">You haven't submitted any invoices yet.</p>
            ) : (
              <div className="divide-y divide-border">
                {myPayouts.map((p: any) => {
                  const cfg = payoutStatusConfig[p.status] || payoutStatusConfig.pending;
                  return (
                    <div key={p.id} className="p-4 flex items-start justify-between gap-4">
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium flex items-center gap-1.5">
                          <Briefcase className="w-3.5 h-3.5 text-muted-foreground" />
                          {p.jobs?.title ?? "Job"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Submitted {format(new Date(p.created_at), "dd MMM yyyy")}
                        </p>
                        {p.description && <p className="text-xs text-muted-foreground italic mt-1">{p.description}</p>}
                        {p.notes && <p className="text-xs text-muted-foreground mt-1">Admin note: {p.notes}</p>}
                      </div>
                      <div className="text-right space-y-1 shrink-0">
                        <p className="text-sm font-semibold">£{Number(p.amount).toFixed(2)}</p>
                        <Badge variant="outline" className={cn("text-[10px]", cfg.color)}>{cfg.label}</Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default EngineerInvoices;