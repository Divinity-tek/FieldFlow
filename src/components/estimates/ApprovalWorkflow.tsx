import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Trash2, Check, X, Shield, Clock, ListOrdered, ArrowUp, ArrowDown } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";

const SCOPES = [
  { value: "any", label: "Any (customer or partner)" },
  { value: "customer", label: "Customer (no partner)" },
  { value: "partner", label: "Partner-sourced" },
];

const ROLES = ["admin", "team_lead", "associate_coordinator"] as const;

const CURRENCIES = ["", "USD", "EUR", "GBP", "INR", "AUD", "CAD", "AED"];

const emptyRule = {
  name: "",
  scope: "any",
  min_total: "0",
  max_total: "",
  currency: "",
  required_role: "admin" as (typeof ROLES)[number],
  is_active: true,
  priority: "0",
};

export default function ApprovalWorkflow() {
  const qc = useQueryClient();
  const { isAdmin, isTeamLead } = useUserRole();
  const canManageRules = isAdmin || isTeamLead;
  const [showRuleDialog, setShowRuleDialog] = useState(false);
  const [rule, setRule] = useState(emptyRule);
  const [decisionNote, setDecisionNote] = useState("");
  const [stepsRuleId, setStepsRuleId] = useState<string | null>(null);
  const [newStep, setNewStep] = useState<{ name: string; required_role: (typeof ROLES)[number] }>({ name: "", required_role: "admin" });

  const { data: rules = [] } = useQuery({
    queryKey: ["estimate-approval-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estimate_approval_rules" as any)
        .select("*")
        .order("priority", { ascending: false })
        .order("min_total", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: approvals = [] } = useQuery({
    queryKey: ["estimate-approvals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estimate_approvals" as any)
        .select("*, estimates(estimate_number, title, total, currency, clients(company_name), partners(company_name)), estimate_approval_rules(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const saveRule = useMutation({
    mutationFn: async () => {
      if (!rule.name.trim()) throw new Error("Name is required");
      const payload = {
        name: rule.name.trim(),
        scope: rule.scope,
        min_total: parseFloat(rule.min_total) || 0,
        max_total: rule.max_total === "" ? null : parseFloat(rule.max_total),
        currency: rule.currency || null,
        required_role: rule.required_role,
        is_active: rule.is_active,
        priority: parseInt(rule.priority) || 0,
      };
      const { error } = await supabase.from("estimate_approval_rules" as any).insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["estimate-approval-rules"] });
      toast.success("Rule added");
      setShowRuleDialog(false);
      setRule(emptyRule);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleRule = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("estimate_approval_rules" as any).update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["estimate-approval-rules"] }),
  });

  const deleteRule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("estimate_approval_rules" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["estimate-approval-rules"] });
      toast.success("Rule deleted");
    },
  });

  const { data: allSteps = [] } = useQuery({
    queryKey: ["estimate-approval-rule-steps"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estimate_approval_rule_steps" as any)
        .select("*")
        .order("step_order", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });

  const stepsForRule = (rid: string) => allSteps.filter((s: any) => s.rule_id === rid);

  const addStep = useMutation({
    mutationFn: async () => {
      if (!stepsRuleId) throw new Error("No rule selected");
      const existing = stepsForRule(stepsRuleId);
      const next_order = (existing[existing.length - 1]?.step_order ?? 0) + 1;
      const { error } = await supabase.from("estimate_approval_rule_steps" as any).insert({
        rule_id: stepsRuleId,
        step_order: next_order,
        name: newStep.name.trim() || null,
        required_role: newStep.required_role,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["estimate-approval-rule-steps"] });
      setNewStep({ name: "", required_role: "admin" });
      toast.success("Step added");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteStep = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("estimate_approval_rule_steps" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["estimate-approval-rule-steps"] }),
  });

  const moveStep = useMutation({
    mutationFn: async ({ id, dir }: { id: string; dir: -1 | 1 }) => {
      if (!stepsRuleId) return;
      const list = stepsForRule(stepsRuleId);
      const idx = list.findIndex((s: any) => s.id === id);
      const swap = list[idx + dir];
      if (!swap) return;
      const a = list[idx];
      // swap step_orders via two updates (use temporary high value to avoid unique conflict)
      const tmp = 100000 + Math.floor(Math.random() * 1000);
      const { error: e1 } = await supabase.from("estimate_approval_rule_steps" as any).update({ step_order: tmp }).eq("id", a.id);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("estimate_approval_rule_steps" as any).update({ step_order: a.step_order }).eq("id", swap.id);
      if (e2) throw e2;
      const { error: e3 } = await supabase.from("estimate_approval_rule_steps" as any).update({ step_order: swap.step_order }).eq("id", a.id);
      if (e3) throw e3;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["estimate-approval-rule-steps"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const decide = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" }) => {
      const { error } = await supabase
        .from("estimate_approvals" as any)
        .update({ status, decision_note: decisionNote.trim() || null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["estimate-approvals"] });
      qc.invalidateQueries({ queryKey: ["estimates"] });
      setDecisionNote("");
      toast.success("Decision recorded");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const fmtMoney = (amt: number, cur: string = "USD") =>
    new Intl.NumberFormat(undefined, { style: "currency", currency: cur || "USD" }).format(amt || 0);

  const pendingApprovals = approvals.filter((a) => a.status === "pending");

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary" /> Approval Workflow
          {pendingApprovals.length > 0 && (
            <Badge variant="outline" className="bg-amber-500/10 text-amber-500">{pendingApprovals.length} pending</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="queue">
          <TabsList>
            <TabsTrigger value="queue">Approval Queue</TabsTrigger>
            <TabsTrigger value="rules">Threshold Rules ({rules.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="queue" className="pt-3">
            {approvals.length === 0 && (
              <p className="text-sm text-muted-foreground">No approval requests yet.</p>
            )}
            <div className="space-y-2">
              {approvals.map((a: any) => {
                const est = a.estimates;
                const sourceLabel = est?.partners?.company_name
                  ? `Partner · ${est.partners.company_name}`
                  : `Customer · ${est?.clients?.company_name || "—"}`;
                return (
                  <div key={a.id} className="border border-border rounded-lg p-3 flex flex-wrap items-center gap-3">
                    <div className="flex-1 min-w-[220px]">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <span className="font-mono text-xs text-muted-foreground">{est?.estimate_number || "—"}</span>
                        {est?.title || <span className="text-muted-foreground">Untitled</span>}
                      </div>
                      <div className="text-xs text-muted-foreground">{sourceLabel}</div>
                      <div className="text-xs text-muted-foreground">
                        Rule: {a.estimate_approval_rules?.name || "—"} · requires <span className="font-medium">{a.required_role}</span>
                        {a.total_steps && a.total_steps > 1 && (
                          <> · Step <span className="font-medium">{a.step_order}/{a.total_steps}</span>{a.step_name ? ` · ${a.step_name}` : ""}</>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">{fmtMoney(Number(est?.total || 0), est?.currency)}</div>
                      <Badge variant="outline" className={
                        a.status === "approved" ? "bg-green-500/10 text-green-500" :
                        a.status === "rejected" ? "bg-destructive/10 text-destructive" :
                        "bg-amber-500/10 text-amber-500"
                      }>
                        {a.status === "pending" && <Clock className="w-3 h-3 mr-1 inline" />}
                        {a.status}
                      </Badge>
                    </div>
                    {a.status === "pending" && (
                      <div className="flex items-center gap-2 w-full md:w-auto">
                        <Input
                          placeholder="Optional note"
                          value={decisionNote}
                          onChange={(e) => setDecisionNote(e.target.value)}
                          className="h-9 w-48"
                          maxLength={300}
                        />
                        <Button size="sm" variant="outline" className="text-green-500" onClick={() => decide.mutate({ id: a.id, status: "approved" })}>
                          <Check className="w-3 h-3 mr-1" />Approve
                        </Button>
                        <Button size="sm" variant="outline" className="text-destructive" onClick={() => decide.mutate({ id: a.id, status: "rejected" })}>
                          <X className="w-3 h-3 mr-1" />Reject
                        </Button>
                      </div>
                    )}
                    {a.decision_note && (
                      <p className="text-xs text-muted-foreground w-full">Note: {a.decision_note}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="rules" className="pt-3 space-y-3">
            {canManageRules && (
              <div className="flex justify-end">
                <Dialog open={showRuleDialog} onOpenChange={setShowRuleDialog}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-2"><Plus className="w-3 h-3" /> Add Rule</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>New Approval Rule</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                      <div>
                        <Label>Name</Label>
                        <Input value={rule.name} onChange={(e) => setRule({ ...rule, name: e.target.value })} placeholder="e.g. Partner deals over $10k" maxLength={100} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>Scope</Label>
                          <Select value={rule.scope} onValueChange={(v) => setRule({ ...rule, scope: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {SCOPES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Required Approver Role</Label>
                          <Select value={rule.required_role} onValueChange={(v: any) => setRule({ ...rule, required_role: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Min total</Label>
                          <Input type="number" min={0} step="0.01" value={rule.min_total} onChange={(e) => setRule({ ...rule, min_total: e.target.value })} />
                        </div>
                        <div>
                          <Label>Max total (blank = ∞)</Label>
                          <Input type="number" min={0} step="0.01" value={rule.max_total} onChange={(e) => setRule({ ...rule, max_total: e.target.value })} />
                        </div>
                        <div>
                          <Label>Currency (blank = any)</Label>
                          <Select value={rule.currency || "any"} onValueChange={(v) => setRule({ ...rule, currency: v === "any" ? "" : v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="any">Any</SelectItem>
                              {CURRENCIES.filter(Boolean).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Priority (higher wins)</Label>
                          <Input type="number" value={rule.priority} onChange={(e) => setRule({ ...rule, priority: e.target.value })} />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" onClick={() => setShowRuleDialog(false)}>Cancel</Button>
                        <Button onClick={() => saveRule.mutate()} disabled={saveRule.isPending}>
                          {saveRule.isPending ? "Saving…" : "Add Rule"}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            )}

            {rules.length === 0 && (
              <p className="text-sm text-muted-foreground">No rules configured. Without rules, estimates do not require approval.</p>
            )}
            <div className="space-y-2">
              {rules.map((r: any) => {
                const steps = stepsForRule(r.id);
                return (
                <div key={r.id} className="border border-border rounded-lg p-3 space-y-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex-1 min-w-[220px]">
                      <div className="font-medium text-sm">{r.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.scope} · {fmtMoney(Number(r.min_total), r.currency || "USD")}
                        {r.max_total != null ? ` – ${fmtMoney(Number(r.max_total), r.currency || "USD")}` : "+"}
                        {r.currency ? ` · ${r.currency}` : " · any currency"}
                        · {steps.length > 0
                          ? <>steps: <span className="font-medium">{steps.length}</span> ({steps.map((s:any)=>s.required_role).join(" → ")})</>
                          : <>approver: <span className="font-medium">{r.required_role}</span></>}
                        · priority {r.priority}
                      </div>
                    </div>
                    <Badge variant="outline" className={r.is_active ? "bg-green-500/10 text-green-500" : "bg-muted"}>
                      {r.is_active ? "Active" : "Inactive"}
                    </Badge>
                    {canManageRules && (
                      <>
                        <Button size="sm" variant="outline" className="gap-1" onClick={() => setStepsRuleId(stepsRuleId === r.id ? null : r.id)}>
                          <ListOrdered className="w-3 h-3" /> {stepsRuleId === r.id ? "Hide steps" : "Manage steps"}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => toggleRule.mutate({ id: r.id, is_active: !r.is_active })}>
                          {r.is_active ? "Disable" : "Enable"}
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => { if (confirm("Delete rule?")) deleteRule.mutate(r.id); }}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </>
                    )}
                  </div>

                  {stepsRuleId === r.id && (
                    <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
                      <div className="text-xs text-muted-foreground">
                        Define an ordered chain of approvers. Each step must approve before the next is requested. If empty, the rule's single required role is used.
                      </div>
                      {steps.length === 0 && (
                        <p className="text-xs text-muted-foreground">No steps yet — single-approver mode.</p>
                      )}
                      <div className="space-y-1">
                        {steps.map((s: any, i: number) => (
                          <div key={s.id} className="flex items-center gap-2 text-sm">
                            <span className="font-mono text-xs w-8 text-muted-foreground">#{s.step_order}</span>
                            <span className="flex-1">{s.name || <span className="text-muted-foreground">(unnamed)</span>} — <span className="font-medium">{s.required_role}</span></span>
                            <Button size="icon" variant="ghost" disabled={i === 0} onClick={() => moveStep.mutate({ id: s.id, dir: -1 })}><ArrowUp className="w-3 h-3" /></Button>
                            <Button size="icon" variant="ghost" disabled={i === steps.length - 1} onClick={() => moveStep.mutate({ id: s.id, dir: 1 })}><ArrowDown className="w-3 h-3" /></Button>
                            <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteStep.mutate(s.id)}><Trash2 className="w-3 h-3" /></Button>
                          </div>
                        ))}
                      </div>
                      <div className="flex flex-wrap items-end gap-2 pt-1">
                        <div className="flex-1 min-w-[140px]">
                          <Label className="text-xs">Step name</Label>
                          <Input value={newStep.name} onChange={(e) => setNewStep({ ...newStep, name: e.target.value })} placeholder="e.g. Manager review" maxLength={80} />
                        </div>
                        <div className="min-w-[140px]">
                          <Label className="text-xs">Role</Label>
                          <Select value={newStep.required_role} onValueChange={(v: any) => setNewStep({ ...newStep, required_role: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {ROLES.map((rr) => <SelectItem key={rr} value={rr}>{rr}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <Button size="sm" className="gap-1" onClick={() => addStep.mutate()} disabled={addStep.isPending}>
                          <Plus className="w-3 h-3" /> Add step
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
