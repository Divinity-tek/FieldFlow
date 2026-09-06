import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Ticket, Users, AlertTriangle, CheckCircle2, Clock, MessageSquare, ArrowUpRight, Edit } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { toast } from "sonner";

import { z } from "zod";

const STATUS_OPTIONS = [
  "draft", "pending_approval", "approved", "dispatched", "in_progress", "completed", "cancelled", "rejected",
] as const;
const PRIORITY_OPTIONS = ["low", "medium", "high", "urgent"] as const;

// Statuses that REQUIRE an engineer to be assigned
const STATUSES_REQUIRING_ENGINEER = new Set(["dispatched", "in_progress", "completed"]);

const quickEditSchema = z
  .object({
    status: z.enum(STATUS_OPTIONS, { errorMap: () => ({ message: "Status is required" }) }),
    priority: z.enum(PRIORITY_OPTIONS, { errorMap: () => ({ message: "Priority is required" }) }),
    engineer_id: z.string().trim().max(64).optional().or(z.literal("")),
    engineer_notes: z.string().trim().max(2000, "Notes must be under 2000 characters").optional().or(z.literal("")),
  })
  .superRefine((val, ctx) => {
    if (STATUSES_REQUIRING_ENGINEER.has(val.status) && !val.engineer_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["engineer_id"],
        message: `An engineer must be assigned when status is "${val.status.replace(/_/g, " ")}"`,
      });
    }
  });

const CoordinatorDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editTicket, setEditTicket] = useState<any>(null);
  const [editForm, setEditForm] = useState({ status: "draft", priority: "medium", engineer_id: "", engineer_notes: "" });
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [slaWarnings, setSlaWarnings] = useState<Array<{ ticket: string; level: "warning" | "danger"; message: string }>>([]);
  const [slaFilter, setSlaFilter] = useState<"all" | "any" | "warning" | "danger">("all");
  const [slaPanel, setSlaPanel] = useState<{ ticket: any; warnings: Array<{ ticket: string; level: "warning" | "danger"; message: string }> } | null>(null);

  const computeSlaWarnings = (ticket: any, prevStatus?: string) => {
    const warnings: Array<{ ticket: string; level: "warning" | "danger"; message: string }> = [];
    const num = ticket.ticket_number ?? "ticket";
    const now = Date.now();
    const scheduled = ticket.scheduled_date ? new Date(ticket.scheduled_date).getTime() : null;
    const created = ticket.created_at ? new Date(ticket.created_at).getTime() : null;

    if (ticket.status === "dispatched") {
      if (!ticket.engineer_id) warnings.push({ ticket: num, level: "danger", message: "Dispatched without an assigned engineer" });
      if (scheduled && scheduled < now) warnings.push({ ticket: num, level: "warning", message: "Dispatched but scheduled date is in the past" });
    }
    if (ticket.status === "in_progress") {
      if (!ticket.scheduled_date) warnings.push({ ticket: num, level: "warning", message: "In progress with no scheduled date set" });
      if (ticket.priority === "urgent" && created && now - created > 4 * 3600_000)
        warnings.push({ ticket: num, level: "danger", message: "Urgent ticket open >4h — possible SLA breach" });
    }
    if (ticket.status === "completed") {
      if (!ticket.actual_hours || Number(ticket.actual_hours) === 0)
        warnings.push({ ticket: num, level: "warning", message: "Completed but no actual hours logged" });
    }
    if (prevStatus && prevStatus !== ticket.status) {
      if (prevStatus === "in_progress" && ticket.status === "draft")
        warnings.push({ ticket: num, level: "warning", message: "Status reverted from in-progress to draft" });
    }
    return warnings;
  };

  const validateEdit = (form: typeof editForm) => {
    const result = quickEditSchema.safeParse(form);
    if (result.success) return {};
    const errs: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!errs[key]) errs[key] = issue.message;
    }
    return errs;
  };

  const updateEditForm = (patch: Partial<typeof editForm>) => {
    const next = { ...editForm, ...patch };
    setEditForm(next);
    setEditErrors(validateEdit(next));
  };

  const { data: engineersList = [] } = useQuery({
    queryKey: ["coordinator-engineers-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("engineers")
        .select("id, specialty, profiles:user_id(full_name)");
      return data ?? [];
    },
  });

  const editMutation = useMutation({
    mutationFn: async ({ id, updates, prevStatus, ticket }: { id: string; updates: Record<string, any>; prevStatus: string; ticket: any }) => {
      if (updates.status === "completed") updates.completed_date = new Date().toISOString();
      const { error } = await supabase.from("dispatch_tickets").update(updates as any).eq("id", id);
      if (error) throw error;
      return { merged: { ...ticket, ...updates }, prevStatus };
    },
    onSuccess: ({ merged, prevStatus }) => {
      toast.success("Ticket updated");
      // Run SLA/delay checks immediately on the updated ticket
      const warns = computeSlaWarnings(merged, prevStatus);
      if (warns.length) {
        warns.forEach((w) =>
          w.level === "danger" ? toast.error(`${w.ticket}: ${w.message}`) : toast.warning(`${w.ticket}: ${w.message}`)
        );
      }
      setSlaWarnings((prev) => [...warns, ...prev.filter((p) => p.ticket !== merged.ticket_number)].slice(0, 10));
      qc.invalidateQueries({ queryKey: ["coordinator-tickets"] });
      qc.invalidateQueries({ queryKey: ["coordinator-sla-breaches"] });
      setEditTicket(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openEdit = (t: any) => {
    const initial = {
      status: t.status ?? "draft",
      priority: t.priority ?? "medium",
      engineer_id: t.engineer_id ?? "",
      engineer_notes: t.engineer_notes ?? "",
    };
    setEditForm(initial);
    setEditErrors({});
    setEditTicket(t);
  };

  const { data: tickets = [] } = useQuery({
    queryKey: ["coordinator-tickets"],
    queryFn: async () => {
      const { data } = await supabase
        .from("dispatch_tickets")
        .select("*, clients(company_name, contact_name), engineers(specialty)")
        .order("created_at", { ascending: false })
        .limit(20);
      return data || [];
    },
  });

  const { data: slaBreaches = [] } = useQuery({
    queryKey: ["coordinator-sla-breaches"],
    queryFn: async () => {
      const { data } = await supabase
        .from("sla_breaches")
        .select("*, jobs(title, status), clients(company_name)")
        .eq("escalation_status", "pending")
        .order("breached_at", { ascending: false })
        .limit(10);
      return data || [];
    },
  });

  const { data: recentJobs = [] } = useQuery({
    queryKey: ["coordinator-jobs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("jobs")
        .select("*, clients(company_name)")
        .in("status", ["pending", "assigned", "in_progress"])
        .order("created_at", { ascending: false })
        .limit(15);
      return data || [];
    },
  });

  const { data: reminders = [] } = useQuery({
    queryKey: ["coordinator-reminders"],
    queryFn: async () => {
      const { data } = await supabase
        .from("follow_up_reminders")
        .select("*, clients(company_name)")
        .eq("is_completed", false)
        .order("due_date", { ascending: true })
        .limit(10);
      return data || [];
    },
  });

  const openTickets = tickets.filter((t: any) => !["completed", "cancelled"].includes(t.status));
  const urgentTickets = tickets.filter((t: any) => t.priority === "urgent" || t.priority === "high");

  const statusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: "bg-muted text-muted-foreground",
      pending: "bg-yellow-500/15 text-yellow-600",
      dispatched: "bg-blue-500/15 text-blue-600",
      in_progress: "bg-primary/15 text-primary",
      completed: "bg-green-500/15 text-green-600",
      cancelled: "bg-destructive/15 text-destructive",
    };
    return colors[status] || "bg-muted text-muted-foreground";
  };

  return (
    <AppLayout title="Coordinator Dashboard" subtitle="Mediate cases, follow up on tickets, and ensure smooth service delivery">
      <div className="space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-border/50">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10"><Ticket className="h-5 w-5 text-primary" /></div>
                <div>
                  <p className="text-2xl font-bold">{openTickets.length}</p>
                  <p className="text-xs text-muted-foreground">Open Tickets</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-destructive/10"><AlertTriangle className="h-5 w-5 text-destructive" /></div>
                <div>
                  <p className="text-2xl font-bold">{urgentTickets.length}</p>
                  <p className="text-xs text-muted-foreground">Urgent / High</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-yellow-500/10"><AlertTriangle className="h-5 w-5 text-yellow-600" /></div>
                <div>
                  <p className="text-2xl font-bold">{slaBreaches.length}</p>
                  <p className="text-xs text-muted-foreground">SLA Breaches</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10"><Clock className="h-5 w-5 text-green-600" /></div>
                <div>
                  <p className="text-2xl font-bold">{reminders.length}</p>
                  <p className="text-xs text-muted-foreground">Pending Follow-ups</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main content tabs */}
        <Tabs defaultValue="tickets" className="space-y-4">
          <TabsList>
            <TabsTrigger value="tickets">Dispatch Tickets</TabsTrigger>
            <TabsTrigger value="jobs">Active Jobs</TabsTrigger>
            <TabsTrigger value="sla">SLA Breaches</TabsTrigger>
            <TabsTrigger value="followups">Follow-ups</TabsTrigger>
          </TabsList>

          <TabsContent value="tickets" className="space-y-3">
            {slaWarnings.length > 0 && (
              <Card className="border-destructive/40 bg-destructive/5">
                <CardHeader className="pb-2 flex-row items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    Recent SLA / Delay Warnings
                  </CardTitle>
                  <Button size="sm" variant="ghost" onClick={() => setSlaWarnings([])}>Clear</Button>
                </CardHeader>
                <CardContent className="pt-0">
                  <ul className="text-xs space-y-1">
                    {slaWarnings.map((w, i) => (
                      <li key={i} className={w.level === "danger" ? "text-destructive" : "text-yellow-700"}>
                        <span className="font-mono mr-2">{w.ticket}</span>{w.message}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <CardTitle className="text-base">Recent Dispatch Tickets</CardTitle>
                  <div className="flex items-center gap-2">
                    <Select value={slaFilter} onValueChange={(v: any) => setSlaFilter(v)}>
                      <SelectTrigger className="h-8 w-[180px] text-xs">
                        <SelectValue placeholder="SLA filter" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All tickets</SelectItem>
                        <SelectItem value="any">With any SLA issue</SelectItem>
                        <SelectItem value="warning">Warnings only</SelectItem>
                        <SelectItem value="danger">Danger only</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button size="sm" variant="outline" onClick={() => navigate("/dispatch-tickets")}>
                      View All <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ticket</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>SLA</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(() => {
                      const enriched = tickets.map((t: any) => {
                        const w = computeSlaWarnings(t);
                        const level: "danger" | "warning" | null = w.some((x) => x.level === "danger")
                          ? "danger"
                          : w.some((x) => x.level === "warning")
                          ? "warning"
                          : null;
                        return { t, warnings: w, level };
                      });
                      const filtered = enriched.filter(({ level }) => {
                        if (slaFilter === "all") return true;
                        if (slaFilter === "any") return !!level;
                        return level === slaFilter;
                      });
                      const rows = filtered.slice(0, 10);
                      if (rows.length === 0) {
                        return (
                          <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                            {slaFilter === "all" ? "No tickets found" : "No tickets match this SLA filter"}
                          </TableCell></TableRow>
                        );
                      }
                      return rows.map(({ t, warnings, level }) => (
                        <TableRow key={t.id} className="hover:bg-muted/50">
                          <TableCell className="font-mono text-xs cursor-pointer" onClick={() => navigate("/dispatch-tickets")}>{t.ticket_number}</TableCell>
                          <TableCell>{(t.clients as any)?.company_name || "—"}</TableCell>
                          <TableCell>
                            <Badge variant={t.priority === "urgent" ? "destructive" : "secondary"} className="text-xs">
                              {t.priority}
                            </Badge>
                          </TableCell>
                          <TableCell><Badge className={`${statusColor(t.status)} text-xs`}>{t.status}</Badge></TableCell>
                          <TableCell>
                            {level ? (
                              <Badge
                                role="button"
                                tabIndex={0}
                                variant={level === "danger" ? "destructive" : "secondary"}
                                className="text-xs cursor-pointer hover:opacity-80"
                                title="Click to view SLA warning details"
                                onClick={(e) => { e.stopPropagation(); setSlaPanel({ ticket: t, warnings }); }}
                                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSlaPanel({ ticket: t, warnings }); } }}
                              >
                                {level === "danger" ? "Breach" : "Warning"} ({warnings.length})
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">OK</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {format(new Date(t.created_at), "MMM d, HH:mm")}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(t); }} title="Quick edit">
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ));
                    })()}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="jobs">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Active Jobs</CardTitle>
                  <Button size="sm" variant="outline" onClick={() => navigate("/jobs")}>
                    View All <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Scheduled</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentJobs.map((j: any) => (
                      <TableRow key={j.id}>
                        <TableCell className="font-medium">{j.title}</TableCell>
                        <TableCell>{(j.clients as any)?.company_name || "—"}</TableCell>
                        <TableCell><Badge className={`${statusColor(j.status)} text-xs`}>{j.status}</Badge></TableCell>
                        <TableCell><Badge variant="secondary" className="text-xs">{j.priority}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {j.scheduled_at ? format(new Date(j.scheduled_at), "MMM d, HH:mm") : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                    {recentJobs.length === 0 && (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No active jobs</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sla">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Pending SLA Breaches</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Job</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Target (min)</TableHead>
                      <TableHead>Breached At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {slaBreaches.map((b: any) => (
                      <TableRow key={b.id}>
                        <TableCell className="font-medium">{(b.jobs as any)?.title || "—"}</TableCell>
                        <TableCell>{(b.clients as any)?.company_name || "—"}</TableCell>
                        <TableCell><Badge variant="destructive" className="text-xs">{b.breach_type}</Badge></TableCell>
                        <TableCell>{b.target_minutes}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {format(new Date(b.breached_at), "MMM d, HH:mm")}
                        </TableCell>
                      </TableRow>
                    ))}
                    {slaBreaches.length === 0 && (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No pending SLA breaches</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="followups">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Pending Follow-up Reminders</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reminders.map((r: any) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.title}</TableCell>
                        <TableCell>{(r.clients as any)?.company_name || "—"}</TableCell>
                        <TableCell className="text-xs">
                          <Badge variant={new Date(r.due_date) < new Date() ? "destructive" : "secondary"} className="text-xs">
                            {format(new Date(r.due_date), "MMM d, yyyy")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{r.description || "—"}</TableCell>
                      </TableRow>
                    ))}
                    {reminders.length === 0 && (
                      <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No pending follow-ups</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Quick Edit Dialog */}
      <Dialog open={!!editTicket} onOpenChange={(o) => !o && setEditTicket(null)}>
        <DialogContent className="max-w-lg">
          {editTicket && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base">
                  <Edit className="w-4 h-4 text-primary" />
                  Quick Edit — {editTicket.ticket_number}
                </DialogTitle>
              </DialogHeader>

              <div className="grid gap-4 mt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Status <span className="text-destructive">*</span></Label>
                    <Select value={editForm.status} onValueChange={(v) => updateEditForm({ status: v })}>
                      <SelectTrigger aria-invalid={!!editErrors.status} className={editErrors.status ? "border-destructive" : ""}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((s) => (
                          <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {editErrors.status && <p className="text-xs text-destructive mt-1">{editErrors.status}</p>}
                  </div>
                  <div>
                    <Label>Priority <span className="text-destructive">*</span></Label>
                    <Select value={editForm.priority} onValueChange={(v) => updateEditForm({ priority: v })}>
                      <SelectTrigger aria-invalid={!!editErrors.priority} className={editErrors.priority ? "border-destructive" : ""}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORITY_OPTIONS.map((p) => (
                          <SelectItem key={p} value={p}>{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {editErrors.priority && <p className="text-xs text-destructive mt-1">{editErrors.priority}</p>}
                  </div>
                </div>

                <div>
                  <Label>
                    Assigned Engineer
                    {STATUSES_REQUIRING_ENGINEER.has(editForm.status) && <span className="text-destructive"> *</span>}
                  </Label>
                  <Select
                    value={editForm.engineer_id || "unassigned"}
                    onValueChange={(v) => updateEditForm({ engineer_id: v === "unassigned" ? "" : v })}
                  >
                    <SelectTrigger aria-invalid={!!editErrors.engineer_id} className={editErrors.engineer_id ? "border-destructive" : ""}>
                      <SelectValue placeholder="Select engineer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {engineersList.map((e: any) => {
                        const p = e.profiles as any;
                        return <SelectItem key={e.id} value={e.id}>{p?.full_name ?? e.specialty}</SelectItem>;
                      })}
                    </SelectContent>
                  </Select>
                  {editErrors.engineer_id && <p className="text-xs text-destructive mt-1">{editErrors.engineer_id}</p>}
                </div>

                <div>
                  <Label>Engineer Notes</Label>
                  <Textarea
                    rows={4}
                    value={editForm.engineer_notes}
                    onChange={(e) => updateEditForm({ engineer_notes: e.target.value })}
                    placeholder="Add notes, updates, or comments..."
                    aria-invalid={!!editErrors.engineer_notes}
                    className={editErrors.engineer_notes ? "border-destructive" : ""}
                  />
                  {editErrors.engineer_notes && <p className="text-xs text-destructive mt-1">{editErrors.engineer_notes}</p>}
                </div>
              </div>

              <DialogFooter className="mt-4 gap-2">
                <Button variant="outline" onClick={() => setEditTicket(null)}>Cancel</Button>
                <Button
                  onClick={() => {
                    const errs = validateEdit(editForm);
                    setEditErrors(errs);
                    if (Object.keys(errs).length > 0) {
                      toast.error("Please fix the highlighted fields");
                      return;
                    }
                    editMutation.mutate({
                      id: editTicket.id,
                      prevStatus: editTicket.status,
                      ticket: editTicket,
                      updates: {
                        status: editForm.status,
                        priority: editForm.priority,
                        engineer_id: editForm.engineer_id || null,
                        engineer_notes: editForm.engineer_notes || null,
                      },
                    });
                  }}
                  disabled={editMutation.isPending || Object.keys(editErrors).length > 0}
                >
                  {editMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Sheet open={!!slaPanel} onOpenChange={(o) => !o && setSlaPanel(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          {slaPanel && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  SLA Warnings — {slaPanel.ticket.ticket_number}
                </SheetTitle>
                <SheetDescription>
                  {(slaPanel.ticket.clients as any)?.company_name || "—"} · status{" "}
                  <span className="font-medium">{slaPanel.ticket.status}</span> · priority{" "}
                  <span className="font-medium">{slaPanel.ticket.priority}</span>
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-3">
                {slaPanel.warnings.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No active SLA warnings.</p>
                ) : (
                  slaPanel.warnings.map((w, i) => (
                    <div
                      key={i}
                      className={`rounded-md border p-3 text-sm ${
                        w.level === "danger"
                          ? "border-destructive/40 bg-destructive/5 text-destructive"
                          : "border-yellow-500/40 bg-yellow-500/5 text-yellow-700"
                      }`}
                    >
                      <div className="flex items-center gap-2 font-medium mb-1">
                        <Badge variant={w.level === "danger" ? "destructive" : "secondary"} className="text-[10px] uppercase">
                          {w.level}
                        </Badge>
                      </div>
                      {w.message}
                    </div>
                  ))
                )}
              </div>
              <div className="mt-6 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => { setSlaPanel(null); openEdit(slaPanel.ticket); }}>
                  <Edit className="h-3.5 w-3.5 mr-1" /> Quick edit
                </Button>
                <Button size="sm" variant="ghost" onClick={() => navigate("/dispatch-tickets")}>
                  Open ticket page <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
};

export default CoordinatorDashboard;
