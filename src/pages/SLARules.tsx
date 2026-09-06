import { useEffect, useMemo, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Shield, Plus, Trash2, AlertTriangle, Clock, BellRing, Save, RotateCcw } from "lucide-react";

type EscalationLevel = {
  level: number;
  after_minutes: number;
  action: "notify" | "reassign" | "escalate";
  notify_roles: string[];
};

type Rules = {
  id: string;
  sla_risk_threshold_minutes: number;
  sla_warning_threshold_minutes: number;
  sla_breach_threshold_minutes: number;
  reassign_on_sla_breach: boolean;
  notify_on_sla_warning: boolean;
  reassign_scan_enabled: boolean;
  require_approval_priorities: string[];
  approval_required_statuses: string[];
  approval_required_service_types: string[];
  escalation_levels: EscalationLevel[];
  working_hours_only: boolean;
  working_hours_start: string;
  working_hours_end: string;
};

const PRIORITIES = ["low", "medium", "high", "urgent"];
const STATUSES = ["pending", "assigned", "in_progress", "on_hold", "completed", "cancelled"];
const ROLES = ["admin", "team_lead", "coordinator", "engineer"];
const ACTIONS: EscalationLevel["action"][] = ["notify", "reassign", "escalate"];

function ChipToggle({
  value,
  options,
  onChange,
}: {
  value: string[];
  options: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value.includes(o);
        return (
          <button
            key={o}
            type="button"
            onClick={() =>
              onChange(on ? value.filter((v) => v !== o) : [...value, o])
            }
            className={
              "px-3 py-1 text-xs rounded-full border transition-colors " +
              (on
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background hover:bg-muted text-muted-foreground border-border")
            }
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

export default function SLARules() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["sla-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dispatch_agent_settings" as never)
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as Rules;
    },
  });

  const [rules, setRules] = useState<Rules | null>(null);
  useEffect(() => {
    if (data) {
      // Normalize escalation_levels just in case it comes back as string or null
      const lvls = Array.isArray(data.escalation_levels)
        ? data.escalation_levels
        : typeof data.escalation_levels === "string"
        ? JSON.parse(data.escalation_levels)
        : [];
      setRules({ ...data, escalation_levels: lvls });
    }
  }, [data]);

  const dirty = useMemo(
    () => JSON.stringify(rules) !== JSON.stringify(data && { ...data, escalation_levels: Array.isArray(data.escalation_levels) ? data.escalation_levels : [] }),
    [rules, data]
  );

  const save = useMutation({
    mutationFn: async (r: Rules) => {
      const { error } = await supabase
        .from("dispatch_agent_settings" as never)
        .update({
          sla_risk_threshold_minutes: r.sla_risk_threshold_minutes,
          sla_warning_threshold_minutes: r.sla_warning_threshold_minutes,
          sla_breach_threshold_minutes: r.sla_breach_threshold_minutes,
          reassign_on_sla_breach: r.reassign_on_sla_breach,
          notify_on_sla_warning: r.notify_on_sla_warning,
          reassign_scan_enabled: r.reassign_scan_enabled,
          require_approval_priorities: r.require_approval_priorities,
          approval_required_statuses: r.approval_required_statuses,
          approval_required_service_types: r.approval_required_service_types,
          escalation_levels: r.escalation_levels,
          working_hours_only: r.working_hours_only,
          working_hours_start: r.working_hours_start,
          working_hours_end: r.working_hours_end,
        } as never)
        .eq("id", r.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sla-rules"] });
      qc.invalidateQueries({ queryKey: ["dispatch-agent-settings"] });
      toast.success("SLA & escalation rules saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !rules) {
    return (
      <AppLayout title="SLA & Escalation Rules">
        <div className="p-6 text-sm text-muted-foreground">Loading rules…</div>
      </AppLayout>
    );
  }

  const update = <K extends keyof Rules>(key: K, value: Rules[K]) =>
    setRules({ ...rules, [key]: value });

  const updateLevel = (idx: number, patch: Partial<EscalationLevel>) => {
    const next = rules.escalation_levels.map((l, i) => (i === idx ? { ...l, ...patch } : l));
    update("escalation_levels", next);
  };

  const addLevel = () => {
    const nextLevel = (rules.escalation_levels.at(-1)?.level ?? 0) + 1;
    update("escalation_levels", [
      ...rules.escalation_levels,
      { level: nextLevel, after_minutes: 15, action: "notify", notify_roles: ["team_lead"] },
    ]);
  };

  const removeLevel = (idx: number) =>
    update(
      "escalation_levels",
      rules.escalation_levels.filter((_, i) => i !== idx).map((l, i) => ({ ...l, level: i + 1 })),
    );

  const newServiceType = (val: string) => {
    const v = val.trim().toLowerCase();
    if (!v || rules.approval_required_service_types.includes(v)) return;
    update("approval_required_service_types", [...rules.approval_required_service_types, v]);
  };

  return (
    <AppLayout title="SLA & Escalation Rules">
      <div className="p-6 max-w-5xl space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="w-6 h-6 text-primary" />
              SLA & Escalation Rules
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Tune thresholds, approval gates, and escalation steps. Changes apply to the AI Dispatch Agent immediately.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" disabled={!dirty} onClick={() => data && setRules({ ...data, escalation_levels: Array.isArray(data.escalation_levels) ? data.escalation_levels : [] })}>
              <RotateCcw className="w-4 h-4 mr-1" />Reset
            </Button>
            <Button disabled={!dirty || save.isPending} onClick={() => save.mutate(rules)}>
              <Save className="w-4 h-4 mr-1" />{save.isPending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>

        {/* THRESHOLDS */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4" />Time thresholds
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Warning threshold (min before due)</Label>
              <Input
                type="number"
                min={0}
                value={rules.sla_warning_threshold_minutes}
                onChange={(e) => update("sla_warning_threshold_minutes", Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">Triggers an early warning before SLA risk.</p>
            </div>
            <div className="space-y-2">
              <Label>SLA risk threshold (min)</Label>
              <Input
                type="number"
                min={0}
                value={rules.sla_risk_threshold_minutes}
                onChange={(e) => update("sla_risk_threshold_minutes", Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">Agent considers jobs due within this window “at risk”.</p>
            </div>
            <div className="space-y-2">
              <Label>Breach threshold (min after due)</Label>
              <Input
                type="number"
                min={0}
                value={rules.sla_breach_threshold_minutes}
                onChange={(e) => update("sla_breach_threshold_minutes", Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">0 = breach the moment SLA is missed.</p>
            </div>

            <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <label className="flex items-center justify-between gap-2 p-3 border rounded-md">
                <div>
                  <div className="text-sm font-medium">Notify on warning</div>
                  <div className="text-xs text-muted-foreground">Send alerts when warning threshold hits.</div>
                </div>
                <Switch
                  checked={rules.notify_on_sla_warning}
                  onCheckedChange={(v) => update("notify_on_sla_warning", v)}
                />
              </label>
              <label className="flex items-center justify-between gap-2 p-3 border rounded-md">
                <div>
                  <div className="text-sm font-medium">Auto-reassign on breach</div>
                  <div className="text-xs text-muted-foreground">Agent reassigns when SLA is breached.</div>
                </div>
                <Switch
                  checked={rules.reassign_on_sla_breach}
                  onCheckedChange={(v) => update("reassign_on_sla_breach", v)}
                />
              </label>
              <label className="flex items-center justify-between gap-2 p-3 border rounded-md">
                <div>
                  <div className="text-sm font-medium">Periodic reassign scan</div>
                  <div className="text-xs text-muted-foreground">Sweep at-risk jobs on a schedule.</div>
                </div>
                <Switch
                  checked={rules.reassign_scan_enabled}
                  onCheckedChange={(v) => update("reassign_scan_enabled", v)}
                />
              </label>
            </div>
          </CardContent>
        </Card>

        {/* WORKING HOURS */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4" />Working hours
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="flex items-center justify-between gap-2 p-3 border rounded-md md:col-span-3">
              <div>
                <div className="text-sm font-medium">Count working hours only</div>
                <div className="text-xs text-muted-foreground">SLA timers pause outside working hours.</div>
              </div>
              <Switch
                checked={rules.working_hours_only}
                onCheckedChange={(v) => update("working_hours_only", v)}
              />
            </label>
            <div className="space-y-2">
              <Label>Start</Label>
              <Input
                type="time"
                value={rules.working_hours_start?.slice(0, 5) || "08:00"}
                onChange={(e) => update("working_hours_start", e.target.value)}
                disabled={!rules.working_hours_only}
              />
            </div>
            <div className="space-y-2">
              <Label>End</Label>
              <Input
                type="time"
                value={rules.working_hours_end?.slice(0, 5) || "18:00"}
                onChange={(e) => update("working_hours_end", e.target.value)}
                disabled={!rules.working_hours_only}
              />
            </div>
          </CardContent>
        </Card>

        {/* APPROVAL GATES */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />Approval gates
            </CardTitle>
            <p className="text-xs text-muted-foreground">Force admin approval for risky dispatch actions.</p>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>Priorities that require approval</Label>
              <ChipToggle
                value={rules.require_approval_priorities}
                options={PRIORITIES}
                onChange={(v) => update("require_approval_priorities", v)}
              />
            </div>
            <Separator />
            <div className="space-y-2">
              <Label>Statuses that require approval before reassignment</Label>
              <ChipToggle
                value={rules.approval_required_statuses}
                options={STATUSES}
                onChange={(v) => update("approval_required_statuses", v)}
              />
            </div>
            <Separator />
            <div className="space-y-2">
              <Label>Service types that require approval</Label>
              {rules.approval_required_service_types.length === 0 ? (
                <p className="text-xs text-muted-foreground">None — add a service type below.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {rules.approval_required_service_types.map((s) => (
                    <Badge key={s} variant="secondary" className="gap-1">
                      {s}
                      <button
                        type="button"
                        aria-label={`Remove ${s}`}
                        onClick={() =>
                          update(
                            "approval_required_service_types",
                            rules.approval_required_service_types.filter((x) => x !== s),
                          )
                        }
                        className="hover:text-destructive"
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <div className="flex gap-2 max-w-sm">
                <Input
                  placeholder="e.g. fiber-installation"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      newServiceType((e.target as HTMLInputElement).value);
                      (e.target as HTMLInputElement).value = "";
                    }
                  }}
                />
                <Button
                  variant="outline"
                  onClick={(e) => {
                    const input = (e.currentTarget.previousSibling as HTMLInputElement);
                    if (input) {
                      newServiceType(input.value);
                      input.value = "";
                    }
                  }}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ESCALATION LEVELS */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <BellRing className="w-4 h-4" />Escalation ladder
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Steps fire sequentially after the SLA risk threshold is hit.
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={addLevel}>
              <Plus className="w-4 h-4 mr-1" />Add level
            </Button>
          </CardHeader>
          <CardContent>
            {rules.escalation_levels.length === 0 ? (
              <p className="text-sm text-muted-foreground">No escalation levels configured.</p>
            ) : (
              <ScrollArea className="max-h-[420px]">
                <div className="space-y-3 pr-3">
                  {rules.escalation_levels.map((lvl, idx) => (
                    <div key={idx} className="border rounded-md p-3 space-y-3 bg-card">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline">Level {lvl.level}</Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeLevel(idx)}
                          aria-label="Remove level"
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">After (minutes)</Label>
                          <Input
                            type="number"
                            min={0}
                            value={lvl.after_minutes}
                            onChange={(e) => updateLevel(idx, { after_minutes: Number(e.target.value) })}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Action</Label>
                          <Select
                            value={lvl.action}
                            onValueChange={(v) => updateLevel(idx, { action: v as EscalationLevel["action"] })}
                          >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {ACTIONS.map((a) => (
                                <SelectItem key={a} value={a}>{a}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Notify roles</Label>
                          <ChipToggle
                            value={lvl.notify_roles}
                            options={ROLES}
                            onChange={(v) => updateLevel(idx, { notify_roles: v })}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {dirty && (
          <div className="sticky bottom-4 flex justify-end">
            <div className="bg-card border shadow-lg rounded-full px-4 py-2 flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Unsaved changes</span>
              <Button size="sm" onClick={() => save.mutate(rules)} disabled={save.isPending}>
                <Save className="w-4 h-4 mr-1" />Save
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
