import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import EngineerMobileLayout from "@/components/layout/EngineerMobileLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ClaimReceiptDialog from "@/components/engineer/ClaimReceiptDialog";
import ReceiptCaptureDialog from "@/components/engineer/ReceiptCaptureDialog";
import { Wallet, ChevronRight, Truck, Utensils, Sparkles, MoreHorizontal, Receipt, Plus, Clock, CheckCircle2, XCircle, Camera } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import PayoutBreakdown, { computePayout } from "@/components/payouts/PayoutBreakdown";
import PayoutStatusBadge from "@/components/payouts/PayoutStatusBadge";
import JobPayoutTotals from "@/components/payouts/JobPayoutTotals";
import { useCurrency } from "@/contexts/CurrencyContext";

const CLAIM_META: Record<string, { label: string; icon: any }> = {
  transport: { label: "Transport", icon: Truck },
  food: { label: "Food", icon: Utensils },
  convenience: { label: "Convenience", icon: Sparkles },
  other: { label: "Other", icon: MoreHorizontal },
};

const EngineerEarnings = () => {
  const { user } = useAuth();
  const { format: fmtCurrency } = useCurrency();
  const queryClient = useQueryClient();
  const [claimOpen, setClaimOpen] = useState(false);
  const [claimJobId, setClaimJobId] = useState<string | null>(null);
  const [expenseOpen, setExpenseOpen] = useState(false);

  const { data: engineer } = useQuery({
    queryKey: ["eng-self-earnings", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("engineers")
        .select("id")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["eng-earnings-jobs", engineer?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("jobs_engineer_safe")
        .select("id, title, status, completed_at, created_at, transport_allowance, food_allowance, convenience_allowance, engineer_net, payout_status, payout_paid_amount, payout_approved_at, payout_paid_at")
        .eq("engineer_id", engineer!.id)
        .eq("status", "completed")
        .order("completed_at", { ascending: false, nullsFirst: false });
      return data ?? [];
    },
    enabled: !!engineer?.id,
  });

  const { data: claims = [] } = useQuery({
    queryKey: ["eng-earnings-claims", engineer?.id, jobs.map((j: any) => j.id).join(",")],
    queryFn: async () => {
      const ids = jobs.map((j: any) => j.id);
      if (ids.length === 0) return [];
      const { data } = await supabase
        .from("job_payout_claims")
        .select("id, job_id, claim_type, amount, status, created_at")
        .in("job_id", ids)
        .eq("engineer_id", engineer!.id);
      return data ?? [];
    },
    enabled: !!engineer?.id && jobs.length > 0,
  });

  const { data: recentClaims = [], isLoading: recentLoading } = useQuery({
    queryKey: ["eng-recent-claims", engineer?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("job_payout_claims")
        .select("id, job_id, claim_type, amount, status, note, review_note, created_at, reviewed_at")
        .eq("engineer_id", engineer!.id)
        .order("created_at", { ascending: false })
        .limit(20);
      const rows = (data ?? []) as any[];
      const jobIds = Array.from(new Set(rows.map(r => r.job_id).filter(Boolean)));
      const { data: jobRows } = jobIds.length
        ? await supabase.from("jobs_engineer_safe").select("id, title").in("id", jobIds)
        : { data: [] as any[] };
      const byId = new Map((jobRows ?? []).map((j: any) => [j.id, j]));
      return rows.map(r => ({ ...r, jobs: byId.get(r.job_id) ?? null }));
    },
    enabled: !!engineer?.id,
  });

  const recentCounts = useMemo(() => {
    const c = { pending: 0, approved: 0, rejected: 0 };
    for (const r of recentClaims as any[]) {
      if (r.status === "approved") c.approved++;
      else if (r.status === "rejected") c.rejected++;
      else c.pending++;
    }
    return c;
  }, [recentClaims]);

  // Live-refresh totals when claims are inserted/approved/rejected
  useEffect(() => {
    if (!engineer?.id) return;
    const channel = supabase
      .channel(`eng-claims-${engineer.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "job_payout_claims",
          filter: `engineer_id=eq.${engineer.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["eng-recent-claims"] });
          queryClient.invalidateQueries({ queryKey: ["eng-earnings-claims"] });
          queryClient.invalidateQueries({ queryKey: ["eng-earnings-jobs"] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [engineer?.id, queryClient]);

  const claimsByJob = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const c of claims as any[]) {
      (map[c.job_id] ||= []).push(c);
    }
    return map;
  }, [claims]);

  const totals = useMemo(() => {
    let net = 0, gross = 0, claimsApproved = 0, claimsPending = 0;
    for (const j of jobs as any[]) {
      const p = computePayout({
        base_pay: j.engineer_net ?? 0,
        transport_allowance: j.transport_allowance,
        food_allowance: j.food_allowance,
        convenience_allowance: j.convenience_allowance,
        engineer_net: j.engineer_net,
      });
      net += p.engineerNet;
      gross += p.gross;
    }
    for (const c of recentClaims as any[]) {
      if (c.status === "approved") claimsApproved += Number(c.amount);
      else if (c.status === "pending") claimsPending += Number(c.amount);
    }
    return { net, gross, claimsApproved, claimsPending };
  }, [jobs, recentClaims]);

  const { data: expenses = [] } = useQuery({
    queryKey: ["engineer-expenses", engineer?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("engineer_expenses")
        .select("id, vendor, amount, currency, category, occurred_on, status, receipt_path, created_at")
        .eq("engineer_id", engineer!.id)
        .order("occurred_on", { ascending: false, nullsFirst: false })
        .limit(20);
      return (data ?? []) as any[];
    },
    enabled: !!engineer?.id,
  });

  const expensesTotal = useMemo(
    () => expenses.reduce((s: number, e: any) => s + Number(e.amount ?? 0), 0),
    [expenses],
  );

  return (
    <EngineerMobileLayout title="Earnings">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Summary</h2>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setExpenseOpen(true)}>
              <Camera className="w-4 h-4 mr-1" /> Expense
            </Button>
            <Button size="sm" onClick={() => { setClaimJobId(null); setClaimOpen(true); }}>
              <Plus className="w-4 h-4 mr-1" /> Raise claim
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1">
                <Wallet className="w-3 h-3" /> Payout net
              </div>
              <div className="text-base font-bold">{fmtCurrency(totals.net)}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Gross {fmtCurrency(totals.gross)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1">
                <Receipt className="w-3 h-3" /> Approved claims
              </div>
              <div className="text-base font-bold">{fmtCurrency(totals.claimsApproved)}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Pending {fmtCurrency(totals.claimsPending)}</div>
            </CardContent>
          </Card>
          <Card className="border-primary/40">
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1">
                <Wallet className="w-3 h-3" /> Total payable
              </div>
              <div className="text-base font-bold text-primary">{fmtCurrency(totals.net + totals.claimsApproved)}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Net + approved</div>
            </CardContent>
          </Card>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold">Recent claim history</h2>
            <div className="flex items-center gap-1.5 text-[10px]">
              <Badge variant="secondary" className="gap-1"><Clock className="w-3 h-3" />{recentCounts.pending} pending</Badge>
              <Badge variant="default" className="gap-1"><CheckCircle2 className="w-3 h-3" />{recentCounts.approved} approved</Badge>
              <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" />{recentCounts.rejected} rejected</Badge>
            </div>
          </div>
          {recentLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : recentClaims.length === 0 ? (
            <Card>
              <CardContent className="p-4 text-center text-xs text-muted-foreground">
                No claims submitted yet.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0 divide-y">
                {(recentClaims as any[]).map((c) => {
                  const meta = CLAIM_META[c.claim_type] ?? CLAIM_META.other;
                  const Icon = meta.icon;
                  const statusVariant =
                    c.status === "approved" ? "default" :
                    c.status === "rejected" ? "destructive" : "secondary";
                  const StatusIcon =
                    c.status === "approved" ? CheckCircle2 :
                    c.status === "rejected" ? XCircle : Clock;
                  return (
                    <div key={c.id} className="p-3 flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 text-xs font-medium">
                          <Icon className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{meta.label}</span>
                          <span className="text-muted-foreground">·</span>
                          <Link to={`/jobs/${c.job_id}`} className="truncate text-muted-foreground hover:underline">
                            {c.jobs?.title ?? "Job"}
                          </Link>
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          Submitted {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                          {c.reviewed_at && (
                            <> · Reviewed {formatDistanceToNow(new Date(c.reviewed_at), { addSuffix: true })}</>
                          )}
                        </div>
                        {c.status === "rejected" && c.review_note && (
                          <div className="text-[11px] text-destructive mt-1">Reason: {c.review_note}</div>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <div className={`text-sm font-semibold ${c.status === "rejected" ? "line-through text-muted-foreground" : ""}`}>
                          {fmtCurrency(Number(c.amount))}
                        </div>
                        <Badge variant={statusVariant} className="text-[9px] px-1.5 py-0 h-4 mt-1 gap-1">
                          <StatusIcon className="w-2.5 h-2.5" />{c.status}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </div>

        <div>
          <h2 className="text-sm font-semibold mb-2">Completed jobs ledger</h2>

          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : jobs.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                No completed jobs yet. Your earnings ledger will appear here once you finish a job.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {(jobs as any[]).map((job) => {
                const jobClaims = claimsByJob[job.id] ?? [];
                const approvedSum = jobClaims.filter((c: any) => c.status === "approved").reduce((s: number, c: any) => s + Number(c.amount), 0);
                const pendingSum = jobClaims.filter((c: any) => c.status === "pending").reduce((s: number, c: any) => s + Number(c.amount), 0);
                const net = Number(job.engineer_net ?? 0);
                return (
                  <Card key={job.id}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <Link to={`/jobs/${job.id}`} className="text-sm font-semibold hover:underline flex items-center gap-1">
                            <span className="truncate">{job.title}</span>
                            <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                          </Link>
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            Completed {job.completed_at ? format(new Date(job.completed_at), "PP") : "—"}
                          </div>
                        </div>
                        <PayoutStatusBadge
                          source={{
                            payout_status: job.payout_status,
                            payout_paid_amount: job.payout_paid_amount,
                            payout_approved_at: job.payout_approved_at,
                            payout_paid_at: job.payout_paid_at,
                            engineer_net: job.engineer_net,
                          }}
                          showTimestamps
                        />
                      </div>

                      <PayoutBreakdown
                        compact
                        source={{
                          base_pay: job.engineer_net ?? 0,
                          transport_allowance: job.transport_allowance,
                          food_allowance: job.food_allowance,
                          convenience_allowance: job.convenience_allowance,
                          engineer_net: job.engineer_net,
                        }}
                      />

                      {jobClaims.length > 0 && (
                        <div className="border-t pt-2">
                          <div className="text-[11px] font-medium text-muted-foreground mb-1.5">Reimbursable claims</div>
                          <div className="space-y-1 mb-2">
                            {jobClaims.map((c: any) => {
                              const meta = CLAIM_META[c.claim_type] ?? CLAIM_META.other;
                              const Icon = meta.icon;
                              return (
                                <div key={c.id} className="flex items-center justify-between text-xs">
                                  <span className="flex items-center gap-1.5">
                                    <Icon className="w-3 h-3" />
                                    {meta.label}
                                    <Badge
                                      variant={c.status === "approved" ? "default" : c.status === "rejected" ? "destructive" : "secondary"}
                                      className="text-[9px] px-1 py-0 h-4"
                                    >
                                      {c.status}
                                    </Badge>
                                  </span>
                                  <span className={c.status === "rejected" ? "line-through text-muted-foreground" : ""}>
                                    {fmtCurrency(Number(c.amount))}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <JobPayoutTotals
                        compact
                        engineerNet={net}
                        approvedClaims={approvedSum}
                        pendingClaims={pendingSum}
                      />

                      <div className="flex justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => { setClaimJobId(job.id); setClaimOpen(true); }}
                        >
                          <Plus className="w-3.5 h-3.5 mr-1" /> Add claim for this job
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Reimbursable expenses (OCR receipts) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold">Expenses & deductibles</h2>
            <span className="text-xs text-muted-foreground">{fmtCurrency(expensesTotal)} total</span>
          </div>
          {expenses.length === 0 ? (
            <Card>
              <CardContent className="p-4 text-center text-xs text-muted-foreground">
                No expenses logged. Snap a receipt with the Expense button above.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-1.5">
              {expenses.map((e: any) => (
                <Card key={e.id}>
                  <CardContent className="p-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{e.vendor || "Receipt"}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {e.category ?? "expense"}{e.occurred_on ? ` · ${e.occurred_on}` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold">{fmtCurrency(Number(e.amount ?? 0))}</div>
                      <Badge variant={e.status === "approved" || e.status === "reimbursed" ? "default" : e.status === "rejected" ? "destructive" : "secondary"} className="text-[9px] px-1 py-0 h-4">
                        {e.status}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      <ClaimReceiptDialog
        open={claimOpen}
        onOpenChange={setClaimOpen}
        engineerId={engineer?.id ?? null}
        initialJobId={claimJobId}
        onSubmitted={() => {
          queryClient.invalidateQueries({ queryKey: ["eng-earnings-claims"] });
          queryClient.invalidateQueries({ queryKey: ["eng-recent-claims"] });
        }}
      />
      {engineer?.id && (
        <ReceiptCaptureDialog
          open={expenseOpen}
          onOpenChange={setExpenseOpen}
          engineerId={engineer.id}
        />
      )}
    </EngineerMobileLayout>
  );
};

export default EngineerEarnings;
