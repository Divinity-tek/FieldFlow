import { useState, useMemo } from "react";
import { Plus, Search, MapPin, Globe, Clock, Users, Edit2, Trash2, X } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const timezones = [
  "Europe/London", "Europe/Paris", "Europe/Berlin", "Europe/Madrid",
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "Asia/Tokyo", "Asia/Shanghai", "Asia/Dubai", "Australia/Sydney",
];

interface RegionForm {
  name: string;
  city: string;
  country: string;
  timezone: string;
  is_active: boolean;
}

const emptyForm: RegionForm = { name: "", city: "", country: "UK", timezone: "Europe/London", is_active: true };

const Regions = () => {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<RegionForm>(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [assignDialog, setAssignDialog] = useState<string | null>(null);
  const [selectedEngineerId, setSelectedEngineerId] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data: regions = [], isLoading } = useQuery({
    queryKey: ["regions"],
    queryFn: async () => {
      const { data } = await supabase.from("regions").select("*").order("name");
      return data ?? [];
    },
  });

  const { data: engineers = [] } = useQuery({
    queryKey: ["all-engineers-regions"],
    queryFn: async () => {
      const { data: engs } = await supabase.from("engineers").select("id, user_id, specialty, region_id");
      if (!engs?.length) return [];
      const uids = engs.map(e => e.user_id);
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", uids);
      const pm = Object.fromEntries((profiles ?? []).map(p => [p.user_id, p.full_name]));
      return engs.map(e => ({ ...e, name: pm[e.user_id] ?? "Unknown" }));
    },
  });

  const engineersByRegion = useMemo(() => {
    const map: Record<string, typeof engineers> = {};
    engineers.forEach(e => {
      const key = e.region_id ?? "unassigned";
      if (!map[key]) map[key] = [];
      map[key].push(e);
    });
    return map;
  }, [engineers]);

  const saveMutation = useMutation({
    mutationFn: async (payload: RegionForm & { id?: string }) => {
      if (payload.id) {
        const { error } = await supabase.from("regions").update({
          name: payload.name, city: payload.city, country: payload.country,
          timezone: payload.timezone, is_active: payload.is_active,
        }).eq("id", payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("regions").insert({
          name: payload.name, city: payload.city, country: payload.country,
          timezone: payload.timezone, is_active: payload.is_active,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["regions"] });
      setDialogOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      toast({ title: editingId ? "Region updated" : "Region created" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("regions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["regions"] });
      setDeleteId(null);
      toast({ title: "Region deleted" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const assignMutation = useMutation({
    mutationFn: async ({ engineerId, regionId }: { engineerId: string; regionId: string }) => {
      const { error } = await supabase.from("engineers").update({ region_id: regionId }).eq("id", engineerId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-engineers-regions"] });
      setAssignDialog(null);
      setSelectedEngineerId(null);
      toast({ title: "Engineer assigned to region" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const unassignMutation = useMutation({
    mutationFn: async (engineerId: string) => {
      const { error } = await supabase.from("engineers").update({ region_id: null }).eq("id", engineerId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-engineers-regions"] });
      toast({ title: "Engineer removed from region" });
    },
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return regions;
    return regions.filter(r =>
      r.name.toLowerCase().includes(q) ||
      r.city.toLowerCase().includes(q) ||
      r.country.toLowerCase().includes(q)
    );
  }, [regions, search]);

  const openEdit = (r: any) => {
    setEditingId(r.id);
    setForm({ name: r.name, city: r.city, country: r.country, timezone: r.timezone, is_active: r.is_active });
    setDialogOpen(true);
  };

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const unassignedEngineers = engineers.filter(e => !e.region_id);

  return (
    <AppLayout title="Regions" subtitle="Manage service regions and assign teams">
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card><CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{regions.length}</p>
            <p className="text-xs text-muted-foreground">Total Regions</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-success">{regions.filter(r => r.is_active).length}</p>
            <p className="text-xs text-muted-foreground">Active</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{engineers.filter(e => e.region_id).length}</p>
            <p className="text-xs text-muted-foreground">Assigned Engineers</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-warning">{unassignedEngineers.length}</p>
            <p className="text-xs text-muted-foreground">Unassigned</p>
          </CardContent></Card>
        </div>

        {/* Search + Add */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text" placeholder="Search regions..."
              value={search} onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 rounded-lg border border-input bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 w-full sm:w-72"
            />
          </div>
          <Button onClick={openNew} className="gap-2">
            <Plus className="w-4 h-4" /> Add Region
          </Button>
        </div>

        {/* Region Cards */}
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-8">Loading regions...</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No regions found.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filtered.map(region => {
              const teamMembers = engineersByRegion[region.id] ?? [];
              return (
                <Card key={region.id} className="hover:shadow-elevated transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Globe className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-base">{region.name}</CardTitle>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            <MapPin className="w-3 h-3" /> {region.city}, {region.country}
                          </div>
                        </div>
                      </div>
                      <Badge variant={region.is_active ? "default" : "secondary"} className="text-[10px]">
                        {region.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="w-3.5 h-3.5" /> {region.timezone}
                    </div>

                    {/* Team */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                          <Users className="w-3 h-3" /> Team ({teamMembers.length})
                        </p>
                        <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => setAssignDialog(region.id)}>
                          + Assign
                        </Button>
                      </div>
                      {teamMembers.length > 0 ? (
                        <div className="space-y-1.5">
                          {teamMembers.slice(0, 5).map(eng => (
                            <div key={eng.id} className="flex items-center justify-between bg-muted/50 rounded-md px-2.5 py-1.5">
                              <div>
                                <p className="text-xs font-medium text-foreground">{eng.name}</p>
                                <p className="text-[10px] text-muted-foreground">{eng.specialty}</p>
                              </div>
                              <button onClick={() => unassignMutation.mutate(eng.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                          {teamMembers.length > 5 && (
                            <p className="text-[10px] text-muted-foreground text-center">+{teamMembers.length - 5} more</p>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">No engineers assigned</p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-2 border-t border-border">
                      <Button variant="outline" size="sm" className="flex-1 gap-1 text-xs" onClick={() => openEdit(region)}>
                        <Edit2 className="w-3 h-3" /> Edit
                      </Button>
                      <Button variant="outline" size="sm" className="gap-1 text-xs text-destructive hover:text-destructive" onClick={() => setDeleteId(region.id)}>
                        <Trash2 className="w-3 h-3" /> Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Region" : "Create Region"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Region Name</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. London Central" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>City</Label>
                <Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="London" />
              </div>
              <div className="space-y-2">
                <Label>Country</Label>
                <Input value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} placeholder="UK" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Timezone</Label>
              <Select value={form.timezone} onValueChange={v => setForm(f => ({ ...f, timezone: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {timezones.map(tz => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => saveMutation.mutate({ ...form, id: editingId ?? undefined })}
              disabled={!form.name || !form.city || saveMutation.isPending}
            >
              {saveMutation.isPending ? "Saving..." : editingId ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Engineer Dialog */}
      <Dialog open={!!assignDialog} onOpenChange={() => { setAssignDialog(null); setSelectedEngineerId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Engineer to Region</DialogTitle>
          </DialogHeader>
          {unassignedEngineers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">All engineers are already assigned to regions.</p>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {unassignedEngineers.map(eng => (
                <div
                  key={eng.id}
                  onClick={() => setSelectedEngineerId(eng.id)}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedEngineerId === eng.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Users className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{eng.name}</p>
                    <p className="text-xs text-muted-foreground">{eng.specialty}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAssignDialog(null); setSelectedEngineerId(null); }}>Cancel</Button>
            <Button
              disabled={!selectedEngineerId || assignMutation.isPending}
              onClick={() => {
                if (selectedEngineerId && assignDialog)
                  assignMutation.mutate({ engineerId: selectedEngineerId, regionId: assignDialog });
              }}
            >
              {assignMutation.isPending ? "Assigning..." : "Assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Region?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the region. Engineers assigned to it will become unassigned.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default Regions;
