import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import EngineerMobileLayout from "@/components/layout/EngineerMobileLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Bell, Plus, Trash2, Sparkles, MapPin, DollarSign, Briefcase, Power } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import { Link } from "react-router-dom";

const SmartMatchAlerts = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    service_types: "",
    required_skills: "",
    max_distance_km: "",
    min_pay: "",
    priorities: [] as string[],
    notify_push: true,
    notify_email: true,
  });

  const { data: engineer } = useQuery({
    queryKey: ["engineer-self", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("engineers").select("id").eq("user_id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: searches, isLoading } = useQuery({
    queryKey: ["smart-match-searches", engineer?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("smart_match_searches")
        .select("*")
        .eq("engineer_id", engineer!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!engineer?.id,
  });

  const { data: alerts } = useQuery({
    queryKey: ["smart-match-alerts", engineer?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("smart_match_alerts")
        .select("*")
        .eq("engineer_id", engineer!.id)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      const rows = (data ?? []) as any[];
      const jobIds = Array.from(new Set(rows.map(r => r.job_id).filter(Boolean)));
      const { data: jobRows } = jobIds.length
        ? await supabase
            .from("jobs_engineer_safe")
            .select("id, title, location, service_type, priority, scheduled_at, engineer_net, transport_allowance, food_allowance, convenience_allowance")
            .in("id", jobIds)
        : { data: [] as any[] };
      const byId = new Map((jobRows ?? []).map((j: any) => [j.id, j]));
      return rows.map(r => ({ ...r, jobs: byId.get(r.job_id) ?? null }));
    },
    enabled: !!engineer?.id,
  });

  const createSearch = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Name is required");
      const payload = {
        engineer_id: engineer!.id,
        name: form.name.trim(),
        service_types: form.service_types.split(",").map(s => s.trim()).filter(Boolean),
        required_skills: form.required_skills.split(",").map(s => s.trim()).filter(Boolean),
        priorities: form.priorities,
        max_distance_km: form.max_distance_km ? Number(form.max_distance_km) : null,
        min_pay: form.min_pay ? Number(form.min_pay) : null,
        notify_push: form.notify_push,
        notify_email: form.notify_email,
      };
      const { error } = await supabase.from("smart_match_searches").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("SmartMatch alert created");
      qc.invalidateQueries({ queryKey: ["smart-match-searches"] });
      setOpen(false);
      setForm({ name: "", service_types: "", required_skills: "", max_distance_km: "", min_pay: "", priorities: [], notify_push: true, notify_email: true });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("smart_match_searches").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["smart-match-searches"] }),
  });

  const deleteSearch = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("smart_match_searches").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Alert removed");
      qc.invalidateQueries({ queryKey: ["smart-match-searches"] });
    },
  });

  const togglePriority = (p: string) => {
    setForm(f => ({ ...f, priorities: f.priorities.includes(p) ? f.priorities.filter(x => x !== p) : [...f.priorities, p] }));
  };

  return (
    <EngineerMobileLayout title="SmartMatch Alerts">
      <div className="space-y-6 p-4 max-w-5xl mx-auto">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-primary" /> SmartMatch Alerts
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Get instantly notified when new jobs match your saved criteria.
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" />New Alert</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Create SmartMatch Alert</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Alert name</Label>
                  <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Cisco jobs near me" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Service types</Label>
                    <Input value={form.service_types} onChange={e => setForm(f => ({ ...f, service_types: e.target.value }))} placeholder="installation, repair" />
                    <p className="text-xs text-muted-foreground mt-1">Comma-separated</p>
                  </div>
                  <div>
                    <Label>Required skills</Label>
                    <Input value={form.required_skills} onChange={e => setForm(f => ({ ...f, required_skills: e.target.value }))} placeholder="cisco, fiber" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Max distance (km)</Label>
                    <Input type="number" value={form.max_distance_km} onChange={e => setForm(f => ({ ...f, max_distance_km: e.target.value }))} placeholder="50" />
                  </div>
                  <div>
                    <Label>Min pay</Label>
                    <Input type="number" value={form.min_pay} onChange={e => setForm(f => ({ ...f, min_pay: e.target.value }))} placeholder="200" />
                  </div>
                </div>
                <div>
                  <Label className="mb-2 block">Priorities</Label>
                  <div className="flex flex-wrap gap-2">
                    {["low", "medium", "high", "urgent"].map(p => (
                      <Badge key={p} variant={form.priorities.includes(p) ? "default" : "outline"} className="cursor-pointer capitalize" onClick={() => togglePriority(p)}>
                        {p}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between border-t pt-3">
                  <Label htmlFor="push">Push notifications</Label>
                  <Switch id="push" checked={form.notify_push} onCheckedChange={c => setForm(f => ({ ...f, notify_push: c }))} />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="email">Email notifications</Label>
                  <Switch id="email" checked={form.notify_email} onCheckedChange={c => setForm(f => ({ ...f, notify_email: c }))} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={() => createSearch.mutate()} disabled={createSearch.isPending}>Create alert</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Your saved alerts</h2>
            {isLoading ? (
              <Skeleton className="h-40" />
            ) : !searches?.length ? (
              <Card><CardContent className="p-8 text-center text-muted-foreground">
                <Bell className="w-10 h-10 mx-auto mb-3 opacity-40" />
                No alerts yet. Create one to start getting matches.
              </CardContent></Card>
            ) : searches.map(s => (
              <Card key={s.id} className={!s.is_active ? "opacity-60" : ""}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>{s.name}</span>
                    <div className="flex items-center gap-2">
                      <Switch checked={s.is_active} onCheckedChange={(c) => toggleActive.mutate({ id: s.id, is_active: c })} />
                      <Button variant="ghost" size="icon" onClick={() => deleteSearch.mutate(s.id)}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground space-y-1.5">
                  {s.service_types?.length > 0 && <div className="flex items-center gap-1.5"><Briefcase className="w-3.5 h-3.5" />{s.service_types.join(", ")}</div>}
                  {s.max_distance_km && <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />Within {s.max_distance_km} km</div>}
                  {s.min_pay && <div className="flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5" />Min {s.min_pay}</div>}
                  {s.priorities?.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {s.priorities.map((p: string) => <Badge key={p} variant="outline" className="text-[10px] capitalize">{p}</Badge>)}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Recent matches</h2>
            {!alerts?.length ? (
              <Card><CardContent className="p-8 text-center text-muted-foreground">
                <Power className="w-10 h-10 mx-auto mb-3 opacity-40" />
                No matches yet. We'll notify you the moment a job fits.
              </CardContent></Card>
            ) : alerts.map((a: any) => (
              <Card key={a.id} className="hover:border-primary/50 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <Link to={`/engineer/jobs`} className="font-semibold hover:text-primary">{a.jobs?.title || "Job"}</Link>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{a.jobs?.location}</p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <Badge variant="secondary" className="text-[10px]">{a.jobs?.service_type}</Badge>
                        {a.jobs?.priority && <Badge variant="outline" className="text-[10px] capitalize">{a.jobs.priority}</Badge>}
                        {a.jobs?.engineer_net && Number(a.jobs.engineer_net) > 0 && (
                          <span className="text-xs font-medium text-foreground">${a.jobs.engineer_net}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-lg font-bold text-primary">{Number(a.match_score).toFixed(0)}</div>
                      <p className="text-[10px] text-muted-foreground">match</p>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2">{formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </EngineerMobileLayout>
  );
};

export default SmartMatchAlerts;
