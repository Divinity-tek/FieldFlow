import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldAlert, Plus, Trash2, Bell, Mail, MessageSquare } from "lucide-react";
import { toast } from "sonner";

interface EscalationRule {
  id: string;
  name: string;
  trigger: "response" | "resolution" | "no_update";
  thresholdMinutes: number;
  notifyRoles: string[];
  channel: "email" | "sms" | "in_app" | "all";
  enabled: boolean;
}

const defaultRules: EscalationRule[] = [
  { id: "1", name: "Urgent: 15-min response breach → Team Lead", trigger: "response", thresholdMinutes: 15, notifyRoles: ["team_lead"], channel: "all", enabled: true },
  { id: "2", name: "High: 30-min response breach → Coordinator", trigger: "response", thresholdMinutes: 30, notifyRoles: ["associate_coordinator", "team_lead"], channel: "in_app", enabled: true },
  { id: "3", name: "Resolution overdue 2hr → Admin escalation", trigger: "resolution", thresholdMinutes: 120, notifyRoles: ["admin"], channel: "email", enabled: true },
  { id: "4", name: "No engineer update in 60 min → re-dispatch", trigger: "no_update", thresholdMinutes: 60, notifyRoles: ["team_lead"], channel: "in_app", enabled: false },
];

export default function SLAEscalation() {
  const [rules, setRules] = useState<EscalationRule[]>(defaultRules);
  const [newRule, setNewRule] = useState<Partial<EscalationRule>>({
    trigger: "response",
    thresholdMinutes: 30,
    channel: "in_app",
    notifyRoles: ["team_lead"],
    enabled: true,
  });

  const addRule = () => {
    if (!newRule.name) {
      toast.error("Give the rule a name");
      return;
    }
    setRules(r => [
      ...r,
      { ...(newRule as EscalationRule), id: crypto.randomUUID() },
    ]);
    setNewRule({ trigger: "response", thresholdMinutes: 30, channel: "in_app", notifyRoles: ["team_lead"], enabled: true });
    toast.success("Escalation rule added");
  };

  const toggle = (id: string) => setRules(r => r.map(x => x.id === id ? { ...x, enabled: !x.enabled } : x));
  const remove = (id: string) => setRules(r => r.filter(x => x.id !== id));

  const channelIcon = (c: string) => {
    if (c === "email") return <Mail className="w-3 h-3" />;
    if (c === "sms") return <MessageSquare className="w-3 h-3" />;
    return <Bell className="w-3 h-3" />;
  };

  return (
    <AppLayout title="SLA Escalation">
      <div className="space-y-6 p-1">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <ShieldAlert className="w-7 h-7 text-primary" /> SLA Auto-Escalation Rules
          </h1>
          <p className="text-muted-foreground mt-1">
            Define rules that fire automatically when SLA targets are at risk or breached.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Active Rules ({rules.filter(r => r.enabled).length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {rules.map(rule => (
                <div key={rule.id} className="p-4 rounded-lg border flex items-start gap-3">
                  <Switch checked={rule.enabled} onCheckedChange={() => toggle(rule.id)} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{rule.name}</div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <Badge variant="outline" className="text-xs">
                        {rule.trigger.replace("_", " ")} ≥ {rule.thresholdMinutes}min
                      </Badge>
                      {rule.notifyRoles.map(role => (
                        <Badge key={role} variant="secondary" className="text-xs">→ {role}</Badge>
                      ))}
                      <Badge variant="outline" className="text-xs flex items-center gap-1">
                        {channelIcon(rule.channel)} {rule.channel}
                      </Badge>
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => remove(rule.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Plus className="w-4 h-4" /> New Rule
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs">Rule name</Label>
                <Input
                  value={newRule.name || ""}
                  onChange={e => setNewRule({ ...newRule, name: e.target.value })}
                  placeholder="e.g. Critical breach → CEO"
                />
              </div>
              <div>
                <Label className="text-xs">Trigger</Label>
                <Select
                  value={newRule.trigger}
                  onValueChange={v => setNewRule({ ...newRule, trigger: v as any })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="response">Response time breach</SelectItem>
                    <SelectItem value="resolution">Resolution time breach</SelectItem>
                    <SelectItem value="no_update">No engineer update</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Threshold (minutes)</Label>
                <Input
                  type="number"
                  value={newRule.thresholdMinutes || 30}
                  onChange={e => setNewRule({ ...newRule, thresholdMinutes: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label className="text-xs">Notify role</Label>
                <Select
                  value={newRule.notifyRoles?.[0]}
                  onValueChange={v => setNewRule({ ...newRule, notifyRoles: [v] })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="team_lead">Team Lead</SelectItem>
                    <SelectItem value="associate_coordinator">Coordinator</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Channel</Label>
                <Select
                  value={newRule.channel}
                  onValueChange={v => setNewRule({ ...newRule, channel: v as any })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in_app">In-app</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                    <SelectItem value="all">All channels</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={addRule}>
                <Plus className="w-4 h-4" /> Add Rule
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
