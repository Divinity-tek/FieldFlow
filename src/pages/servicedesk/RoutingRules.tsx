import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Trash2, Route, Users2, PlayCircle } from "lucide-react";
import { toast } from "sonner";

type Team = {
  id: string;
  name: string;
  description: string | null;
  teams_team_id: string | null;
  teams_channel_id: string | null;
  is_active: boolean;
};

type Rule = {
  id: string;
  name: string;
  service_category: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  priority: number;
  service_desk_team_id: string;
  is_active: boolean;
};

const emptyTeam = { name: "", description: "", teams_team_id: "", teams_channel_id: "", is_active: true };
const emptyRule = {
  name: "",
  service_category: "",
  country: "",
  region: "",
  city: "",
  priority: 100,
  service_desk_team_id: "",
  is_active: true,
};

const RoutingRules = () => {
  const qc = useQueryClient();
  const [teamForm, setTeamForm] = useState(emptyTeam);
  const [ruleForm, setRuleForm] = useState(emptyRule);
  const [sim, setSim] = useState({ service_category: "", country: "", region: "", city: "" });
  const [simResult, setSimResult] = useState<Team | null | undefined>(undefined);

  const { data: teams = [] } = useQuery({
    queryKey: ["sd-teams"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_desk_teams")
        .select("*")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Team[];
    },
  });

  const { data: rules = [] } = useQuery({
    queryKey: ["sd-routing-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_desk_routing_rules")
        .select("*")
        .order("priority")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Rule[];
    },
  });

  const teamById = new Map(teams.map((t) => [t.id, t]));

  const createTeam = async () => {
    if (!teamForm.name.trim()) return toast.error("Team name is required");
    const { error } = await supabase.from("service_desk_teams").insert({
      name: teamForm.name.trim(),
      description: teamForm.description || null,
      teams_team_id: teamForm.teams_team_id || null,
      teams_channel_id: teamForm.teams_channel_id || null,
      is_active: teamForm.is_active,
    });
    if (error) return toast.error(error.message);
    toast.success("Team created");
    setTeamForm(emptyTeam);
    qc.invalidateQueries({ queryKey: ["sd-teams"] });
  };

  const toggleTeam = async (t: Team) => {
    const { error } = await supabase
      .from("service_desk_teams")
      .update({ is_active: !t.is_active })
      .eq("id", t.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["sd-teams"] });
  };

  const deleteTeam = async (id: string) => {
    if (!confirm("Delete this team and all its routing rules?")) return;
    const { error } = await supabase.from("service_desk_teams").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Team removed");
    qc.invalidateQueries({ queryKey: ["sd-teams"] });
    qc.invalidateQueries({ queryKey: ["sd-routing-rules"] });
  };

  const createRule = async () => {
    if (!ruleForm.name.trim()) return toast.error("Rule name is required");
    if (!ruleForm.service_desk_team_id) return toast.error("Pick a target team");
    const { error } = await supabase.from("service_desk_routing_rules").insert({
      name: ruleForm.name.trim(),
      service_category: ruleForm.service_category || null,
      country: ruleForm.country || null,
      region: ruleForm.region || null,
      city: ruleForm.city || null,
      priority: Number(ruleForm.priority) || 100,
      service_desk_team_id: ruleForm.service_desk_team_id,
      is_active: ruleForm.is_active,
    });
    if (error) return toast.error(error.message);
    toast.success("Routing rule created");
    setRuleForm(emptyRule);
    qc.invalidateQueries({ queryKey: ["sd-routing-rules"] });
  };

  const toggleRule = async (r: Rule) => {
    const { error } = await supabase
      .from("service_desk_routing_rules")
      .update({ is_active: !r.is_active })
      .eq("id", r.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["sd-routing-rules"] });
  };

  const deleteRule = async (id: string) => {
    const { error } = await supabase.from("service_desk_routing_rules").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["sd-routing-rules"] });
  };

  const runSimulation = async () => {
    const { data, error } = await supabase.rpc("resolve_service_desk_team", {
      _service_category: sim.service_category || null,
      _country: sim.country || null,
      _region: sim.region || null,
      _city: sim.city || null,
    });
    if (error) return toast.error(error.message);
    if (!data) {
      setSimResult(null);
      return;
    }
    setSimResult(teamById.get(data as string) ?? null);
  };

  const specificity = (r: Rule) =>
    [r.service_category, r.country, r.region, r.city].filter(Boolean).length;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Route className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Service Desk Routing</h1>
          <p className="text-sm text-muted-foreground">
            Send inbound inquiries (Teams, web, etc.) to the right service desk team based on
            service category and location.
          </p>
        </div>
      </div>

      <Tabs defaultValue="rules" className="w-full">
        <TabsList>
          <TabsTrigger value="rules">Routing rules</TabsTrigger>
          <TabsTrigger value="teams">Service desk teams</TabsTrigger>
          <TabsTrigger value="simulate">
            <PlayCircle className="h-4 w-4 mr-1" /> Simulate
          </TabsTrigger>
        </TabsList>

        {/* RULES */}
        <TabsContent value="rules" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">New routing rule</CardTitle>
              <CardDescription>
                Leave a field blank to match anything. More specific rules win; ties broken by
                priority (lower runs first).
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <Label>Name</Label>
                <Input
                  value={ruleForm.name}
                  onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })}
                  placeholder="e.g. Networking — UK"
                />
              </div>
              <div>
                <Label>Priority</Label>
                <Input
                  type="number"
                  value={ruleForm.priority}
                  onChange={(e) =>
                    setRuleForm({ ...ruleForm, priority: parseInt(e.target.value) || 100 })
                  }
                />
              </div>
              <div>
                <Label>Service category</Label>
                <Input
                  value={ruleForm.service_category}
                  onChange={(e) => setRuleForm({ ...ruleForm, service_category: e.target.value })}
                  placeholder="e.g. networking"
                />
              </div>
              <div>
                <Label>Country</Label>
                <Input
                  value={ruleForm.country}
                  onChange={(e) => setRuleForm({ ...ruleForm, country: e.target.value })}
                  placeholder="e.g. United Kingdom"
                />
              </div>
              <div>
                <Label>Region / state</Label>
                <Input
                  value={ruleForm.region}
                  onChange={(e) => setRuleForm({ ...ruleForm, region: e.target.value })}
                />
              </div>
              <div>
                <Label>City</Label>
                <Input
                  value={ruleForm.city}
                  onChange={(e) => setRuleForm({ ...ruleForm, city: e.target.value })}
                />
              </div>
              <div className="md:col-span-2">
                <Label>Target team</Label>
                <Select
                  value={ruleForm.service_desk_team_id}
                  onValueChange={(v) => setRuleForm({ ...ruleForm, service_desk_team_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pick a service desk team" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch
                  checked={ruleForm.is_active}
                  onCheckedChange={(v) => setRuleForm({ ...ruleForm, is_active: v })}
                />
                <Label>Active</Label>
              </div>
              <div className="md:col-span-3">
                <Button onClick={createRule}>
                  <Plus className="h-4 w-4 mr-1" /> Add rule
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Active rules ({rules.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {rules.length === 0 && (
                <p className="text-sm text-muted-foreground">No rules yet.</p>
              )}
              {rules.map((r) => {
                const team = teamById.get(r.service_desk_team_id);
                return (
                  <div
                    key={r.id}
                    className="flex flex-wrap items-center justify-between gap-3 border rounded-md p-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{r.name}</span>
                        <Badge variant="outline">priority {r.priority}</Badge>
                        <Badge variant="secondary">specificity {specificity(r)}</Badge>
                        {!r.is_active && <Badge variant="destructive">disabled</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3">
                        <span>category: {r.service_category ?? "any"}</span>
                        <span>country: {r.country ?? "any"}</span>
                        <span>region: {r.region ?? "any"}</span>
                        <span>city: {r.city ?? "any"}</span>
                        <span>→ {team?.name ?? "unknown team"}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={r.is_active} onCheckedChange={() => toggleRule(r)} />
                      <Button size="icon" variant="ghost" onClick={() => deleteRule(r.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TEAMS */}
        <TabsContent value="teams" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users2 className="h-4 w-4" /> New service desk team
              </CardTitle>
              <CardDescription>
                Optionally map a Microsoft Teams team & channel — used once Teams is connected.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Name</Label>
                <Input
                  value={teamForm.name}
                  onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })}
                  placeholder="e.g. EMEA Networking Desk"
                />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch
                  checked={teamForm.is_active}
                  onCheckedChange={(v) => setTeamForm({ ...teamForm, is_active: v })}
                />
                <Label>Active</Label>
              </div>
              <div className="md:col-span-2">
                <Label>Description</Label>
                <Textarea
                  value={teamForm.description}
                  onChange={(e) => setTeamForm({ ...teamForm, description: e.target.value })}
                />
              </div>
              <div>
                <Label>Teams team ID (optional)</Label>
                <Input
                  value={teamForm.teams_team_id}
                  onChange={(e) => setTeamForm({ ...teamForm, teams_team_id: e.target.value })}
                />
              </div>
              <div>
                <Label>Teams channel ID (optional)</Label>
                <Input
                  value={teamForm.teams_channel_id}
                  onChange={(e) => setTeamForm({ ...teamForm, teams_channel_id: e.target.value })}
                />
              </div>
              <div className="md:col-span-2">
                <Button onClick={createTeam}>
                  <Plus className="h-4 w-4 mr-1" /> Add team
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Teams ({teams.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {teams.length === 0 && (
                <p className="text-sm text-muted-foreground">No teams yet.</p>
              )}
              {teams.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between border rounded-md p-3"
                >
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      {t.name}
                      {!t.is_active && <Badge variant="destructive">disabled</Badge>}
                    </div>
                    {t.description && (
                      <p className="text-xs text-muted-foreground">{t.description}</p>
                    )}
                    {(t.teams_team_id || t.teams_channel_id) && (
                      <p className="text-xs text-muted-foreground">
                        Teams: {t.teams_team_id ?? "—"} / {t.teams_channel_id ?? "—"}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={t.is_active} onCheckedChange={() => toggleTeam(t)} />
                    <Button size="icon" variant="ghost" onClick={() => deleteTeam(t.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* SIMULATE */}
        <TabsContent value="simulate">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Test routing</CardTitle>
              <CardDescription>
                Enter the inquiry attributes — we'll show the team the rules would resolve to.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Service category</Label>
                <Input
                  value={sim.service_category}
                  onChange={(e) => setSim({ ...sim, service_category: e.target.value })}
                />
              </div>
              <div>
                <Label>Country</Label>
                <Input
                  value={sim.country}
                  onChange={(e) => setSim({ ...sim, country: e.target.value })}
                />
              </div>
              <div>
                <Label>Region</Label>
                <Input
                  value={sim.region}
                  onChange={(e) => setSim({ ...sim, region: e.target.value })}
                />
              </div>
              <div>
                <Label>City</Label>
                <Input
                  value={sim.city}
                  onChange={(e) => setSim({ ...sim, city: e.target.value })}
                />
              </div>
              <div className="md:col-span-2">
                <Button onClick={runSimulation}>
                  <PlayCircle className="h-4 w-4 mr-1" /> Resolve team
                </Button>
              </div>
              {simResult !== undefined && (
                <div className="md:col-span-2 mt-2 p-3 border rounded-md bg-muted/30">
                  {simResult ? (
                    <>
                      <div className="text-sm text-muted-foreground">Routes to</div>
                      <div className="text-lg font-semibold">{simResult.name}</div>
                      {simResult.description && (
                        <p className="text-sm text-muted-foreground">{simResult.description}</p>
                      )}
                    </>
                  ) : (
                    <div className="text-sm">No matching rule — inquiry would be unrouted.</div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default RoutingRules;
