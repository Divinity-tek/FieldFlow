import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FolderKanban, Plus, Building2, Calendar, Target, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  MoreHorizontal,
  Pencil,
  Eye,
  Copy,
  Trash2,
} from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  planning: "bg-muted text-muted-foreground",
  in_progress: "bg-primary/15 text-primary",
  on_hold: "bg-warning/15 text-warning",
  completed: "bg-success/15 text-success",
  cancelled: "bg-destructive/15 text-destructive",
};

const INDUSTRIES = ["Telecom & Carriers", "Hospitality", "Energy & Oil/Gas", "Banking & Finance", "Government & Public Sector", "Retail", "Manufacturing", "Healthcare", "Logistics & Transport", "Other"];

const Projects = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", client_id: "", partner_id: "", description: "", project_type: "rollout", industry: "Telecom & Carriers",
    status: "planning", start_date: "", target_end_date: "", total_sites: 0, total_devices: 0, budget: 0, currency: "USD",
  });
  const [editingProject, setEditingProject] = useState<any | null>(null);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*, clients(company_name)").order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-min"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, company_name").order("company_name");
      return data ?? [];
    },
  });

  const { data: partners = [] } = useQuery({
    queryKey: ["partners-min"],
    queryFn: async () => {
      const { data } = await supabase.from("partners").select("id, company_name").order("company_name");
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.name || !form.client_id) throw new Error("Name and client required");
      const { partner_id, ...rest } = form;
      const { error } = await supabase.from("projects").insert({
        ...rest,
        partner_id: partner_id || null,
        start_date: form.start_date || null,
        target_end_date: form.target_end_date || null,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Project created");
      setOpen(false);
      setForm({ name: "", client_id: "", partner_id: "", description: "", project_type: "rollout", industry: "Telecom & Carriers", status: "planning", start_date: "", target_end_date: "", total_sites: 0, total_devices: 0, budget: 0, currency: "USD" });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });
  const update = useMutation({
    mutationFn: async () => {
      if (!editingProject) return;

      const { partner_id, ...rest } = form;

      const { error } = await supabase
        .from("projects")
        .update({
          ...rest,
          partner_id: partner_id || null,
          start_date: form.start_date || null,
          target_end_date: form.target_end_date || null,
        })
        .eq("id", editingProject.id);

      if (error) throw error;
    },

    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });

      toast.success("Project updated");

      setEditingProject(null);
      setOpen(false);
    },
  });

  const totalSites = projects.reduce((s, p) => s + (p.total_sites || 0), 0);
  const totalDevices = projects.reduce((s, p) => s + (p.total_devices || 0), 0);
  const totalBudget = projects.reduce((s, p) => s + Number(p.budget || 0), 0);

  const openEdit = (project: any) => {
    setEditingProject(project);

    setForm({
      name: project.name ?? "",
      client_id: project.client_id ?? "",
      partner_id: project.partner_id ?? "",
      description: project.description ?? "",
      project_type: project.project_type ?? "rollout",
      industry: project.industry ?? "Telecom & Carriers",
      status: project.status ?? "planning",
      start_date: project.start_date ?? "",
      target_end_date: project.target_end_date ?? "",
      total_sites: project.total_sites ?? 0,
      total_devices: project.total_devices ?? 0,
      budget: Number(project.budget ?? 0),
      currency: project.currency ?? "USD",
    });

    setOpen(true);
  };

  const resetForm = () => {
    setEditingProject(null);

    setForm({
      name: "", client_id: "", partner_id: "", description: "", project_type: "rollout", industry: "Telecom & Carriers",
      status: "planning", start_date: "", target_end_date: "", total_sites: 0, total_devices: 0, budget: 0, currency: "USD",
    });
  };

  

  return (
    <AppLayout title="Projects & Rollouts" subtitle="Multi-site project tracking with milestones, devices and budgets">
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><FolderKanban className="w-8 h-8 text-primary" /><div><p className="text-2xl font-bold">{projects.length}</p><p className="text-xs text-muted-foreground">Active projects</p></div></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><Building2 className="w-8 h-8 text-accent" /><div><p className="text-2xl font-bold">{totalSites.toLocaleString()}</p><p className="text-xs text-muted-foreground">Total sites</p></div></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><Target className="w-8 h-8 text-success" /><div><p className="text-2xl font-bold">{totalDevices.toLocaleString()}</p><p className="text-xs text-muted-foreground">Devices to deploy</p></div></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><DollarSign className="w-8 h-8 text-warning" /><div><p className="text-2xl font-bold">${(totalBudget / 1000).toFixed(0)}k</p><p className="text-xs text-muted-foreground">Total budget</p></div></div></CardContent></Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>All projects</CardTitle>
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
              <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />New project</Button></DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                      {editingProject ? "Edit Project" : "Create Project"}
                  </DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2"><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. APAC Router Rollout 2026" /></div>
                  <div><Label>Client *</Label>
                    <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                      <SelectContent>{clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Partner</Label>
                    <Select value={form.partner_id || "none"} onValueChange={(v) => setForm({ ...form, partner_id: v === "none" ? "" : v })}>
                      <SelectTrigger><SelectValue placeholder="Select partner (optional)" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No partner</SelectItem>
                        {partners.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.company_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Industry</Label>
                    <Select value={form.industry} onValueChange={(v) => setForm({ ...form, industry: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{INDUSTRIES.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Project type</Label>
                    <Select value={form.project_type} onValueChange={(v) => setForm({ ...form, project_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="rollout">Hardware rollout</SelectItem>
                        <SelectItem value="migration">Network migration</SelectItem>
                        <SelectItem value="installation">Installation</SelectItem>
                        <SelectItem value="maintenance">Maintenance contract</SelectItem>
                        <SelectItem value="audit">Site audit / survey</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Status</Label>
                    <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="planning">Planning</SelectItem>
                        <SelectItem value="in_progress">In progress</SelectItem>
                        <SelectItem value="on_hold">On hold</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Start date</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
                  <div><Label>Target end date</Label><Input type="date" value={form.target_end_date} onChange={(e) => setForm({ ...form, target_end_date: e.target.value })} /></div>
                  <div><Label>Total sites</Label><Input type="number" value={form.total_sites} onChange={(e) => setForm({ ...form, total_sites: +e.target.value })} /></div>
                  <div><Label>Total devices</Label><Input type="number" value={form.total_devices} onChange={(e) => setForm({ ...form, total_devices: +e.target.value })} /></div>
                  <div><Label>Budget</Label><Input type="number" value={form.budget} onChange={(e) => setForm({ ...form, budget: +e.target.value })} /></div>
                  <div><Label>Currency</Label>
                    <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{["USD", "EUR", "GBP", "AED", "INR"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2"><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                </div>
                <DialogFooter>
                  <Button
                      onClick={() => {
                          if (editingProject)
                              update.mutate();
                          else
                              create.mutate();
                      }}
                  >
                      {editingProject ? "Update" : "Create"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {isLoading ? <p className="text-muted-foreground text-sm">Loading…</p> : projects.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FolderKanban className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No projects yet. Create your first multi-site rollout.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Industry</TableHead>
                    <TableHead>Sites progress</TableHead>
                    <TableHead>Devices</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[60px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects.map((p: any) => {
                    const sitePct = p.total_sites ? Math.round((p.completed_sites / p.total_sites) * 100) : 0;
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-mono text-xs">{p.code}</TableCell>
                        <TableCell className="font-medium">
                            <Link
                                to={`/projects/${p.id}`}
                                className="text-primary hover:underline"
                            >
                                {p.name}
                            </Link>
                        </TableCell>
                        <TableCell>{p.clients?.company_name ?? "—"}</TableCell>
                        <TableCell className="text-xs">{p.industry ?? "—"}</TableCell>
                        <TableCell className="min-w-[180px]">
                          <div className="flex items-center gap-2">
                            <Progress value={sitePct} className="h-2" />
                            <span className="text-xs text-muted-foreground whitespace-nowrap">{p.completed_sites}/{p.total_sites}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">{p.deployed_devices}/{p.total_devices}</TableCell>
                        <TableCell><Badge className={STATUS_COLORS[p.status] ?? ""}>{p.status.replace("_", " ")}</Badge></TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                              >
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>

                            <DropdownMenuContent align="end">

                              <DropdownMenuItem
                                onClick={() => openEdit(p)}
                              >
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>

                              <DropdownMenuItem>
                                <Eye className="mr-2 h-4 w-4" />
                                View
                              </DropdownMenuItem>

                              <DropdownMenuItem>
                                <Copy className="mr-2 h-4 w-4" />
                                Duplicate
                              </DropdownMenuItem>

                              <DropdownMenuItem className="text-destructive">
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>

                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Projects;
