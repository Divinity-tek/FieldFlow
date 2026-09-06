import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { formatDistanceToNow, formatDistanceToNowStrict } from "date-fns";
import { AlertTriangle, Clock, MessageSquare, Search, Timer, UserCheck } from "lucide-react";

type TicketStatus = "new" | "open" | "assigned" | "in_progress" | "resolved" | "closed";

const STATUS_FLOW: Record<TicketStatus, TicketStatus[]> = {
  new: ["assigned", "in_progress", "closed"],
  open: ["assigned", "in_progress", "closed"],
  assigned: ["in_progress", "resolved", "closed"],
  in_progress: ["resolved", "closed"],
  resolved: ["closed", "in_progress"],
  closed: [],
};

const statusColor = (s: string) => ({
  new: "bg-info/10 text-info border-info/30",
  open: "bg-info/10 text-info border-info/30",
  assigned: "bg-primary/10 text-primary border-primary/30",
  in_progress: "bg-warning/10 text-warning border-warning/30",
  resolved: "bg-success/10 text-success border-success/30",
  closed: "bg-muted text-muted-foreground",
}[s] ?? "");

const priorityColor = (p: string) => ({
  urgent: "bg-destructive/10 text-destructive border-destructive/30",
  high: "bg-destructive/10 text-destructive border-destructive/30",
  medium: "bg-warning/10 text-warning border-warning/30",
  low: "bg-info/10 text-info border-info/30",
}[p] ?? "");

function SlaTimer({ dueAt, breached, doneAt, label }: { dueAt: string | null; breached: boolean; doneAt: string | null; label: string }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((x) => x + 1), 30000);
    return () => clearInterval(id);
  }, []);
  if (!dueAt) return <span className="text-xs text-muted-foreground">—</span>;
  if (doneAt) return <span className="text-xs text-success">✓ {label} met</span>;
  const due = new Date(dueAt).getTime();
  const now = Date.now();
  const overdue = now > due || breached;
  const dist = formatDistanceToNowStrict(new Date(dueAt), { addSuffix: false });
  return (
    <div className="flex items-center gap-1 text-xs">
      {overdue ? <AlertTriangle className="h-3 w-3 text-destructive" /> : <Clock className="h-3 w-3 text-muted-foreground" />}
      <span className={overdue ? "text-destructive font-medium" : "text-muted-foreground"}>
        {overdue ? `${dist} over` : dist}
      </span>
    </div>
  );
}

const TicketsWorkflow = () => {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [openTicket, setOpenTicket] = useState<any | null>(null);

  const { data: tickets = [] } = useQuery({
    queryKey: ["tickets-workflow", statusFilter],
    queryFn: async () => {
      let q = supabase
        .from("tickets")
        .select("id, subject, status, priority, category, created_at, assigned_to, assigned_at, first_response_at, sla_response_due_at, sla_resolution_due_at, sla_response_breached, sla_resolution_breached, resolved_at, closed_at, client_id, job_id, chat_room_id, escalation_level, escalation_max_level, escalation_unanswered_minutes, last_escalated_at, clients(company_name)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (statusFilter === "active") q = q.not("status", "in", "(resolved,closed)");
      else if (statusFilter !== "all") q = q.eq("status", statusFilter as any);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: assignees = [] } = useQuery({
    queryKey: ["ticket-assignees"],
    queryFn: async () => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["admin", "team_lead", "service_desk", "associate_coordinator"]);
      const ids = Array.from(new Set((roles ?? []).map((r: any) => r.user_id)));
      if (!ids.length) return [];
      const { data: profs } = await supabase.from("profiles").select("user_id, full_name, email").in("user_id", ids);
      return profs ?? [];
    },
  });

  // Per-ticket unread chat counts
  const { data: unreadRows = [] } = useQuery({
    queryKey: ["ticket-unread-counts"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_ticket_unread_counts" as any);
      if (error) throw error;
      return (data ?? []) as { ticket_id: string; unread_count: number }[];
    },
    refetchInterval: 30000,
  });
  const unreadMap = useMemo(() => {
    const m = new Map<string, number>();
    (unreadRows as any[]).forEach((r) => m.set(r.ticket_id, Number(r.unread_count)));
    return m;
  }, [unreadRows]);
  const totalUnread = useMemo(
    () => (unreadRows as any[]).reduce((s, r) => s + Number(r.unread_count), 0),
    [unreadRows],
  );

  // Realtime: refresh unread counts on new messages or read updates
  useEffect(() => {
    const ch = supabase
      .channel("ticket-unread-counts")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_room_messages" },
        () => qc.invalidateQueries({ queryKey: ["ticket-unread-counts"] }))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "chat_room_members" },
        () => qc.invalidateQueries({ queryKey: ["ticket-unread-counts"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const assigneeMap = useMemo(() => {
    const m = new Map<string, any>();
    (assignees as any[]).forEach((a) => m.set(a.user_id, a));
    return m;
  }, [assignees]);

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return (tickets as any[]).filter((t) =>
      !s || t.subject?.toLowerCase().includes(s) || t.clients?.company_name?.toLowerCase().includes(s)
    );
  }, [tickets, search]);

  const stats = useMemo(() => {
    const active = (tickets as any[]).filter((t) => !["resolved", "closed"].includes(t.status));
    return {
      active: active.length,
      unassigned: active.filter((t) => !t.assigned_to).length,
      breached: active.filter((t) => t.sla_resolution_breached || t.sla_response_breached).length,
      atRisk: active.filter((t) => {
        if (t.sla_resolution_breached) return false;
        if (!t.sla_resolution_due_at) return false;
        const ms = new Date(t.sla_resolution_due_at).getTime() - Date.now();
        return ms > 0 && ms < 60 * 60 * 1000;
      }).length,
    };
  }, [tickets]);

  const updateTicket = async (id: string, patch: Record<string, any>, msg: string) => {
    const { error } = await supabase.from("tickets").update(patch as any).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(msg);
    qc.invalidateQueries({ queryKey: ["tickets-workflow"] });
    if (openTicket?.id === id) {
      const { data } = await supabase.from("tickets").select("*, clients(company_name)").eq("id", id).maybeSingle();
      setOpenTicket(data);
    }
  };

  return (
    <AppLayout title="Ticket Workflow" subtitle="Status, assignment & SLA tracking">
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { icon: Timer, label: "Active tickets", value: stats.active },
            { icon: UserCheck, label: "Unassigned", value: stats.unassigned },
            { icon: Clock, label: "At-risk (<1h)", value: stats.atRisk },
            { icon: AlertTriangle, label: "SLA breached", value: stats.breached },
            { icon: MessageSquare, label: "Unread chats", value: totalUnread, accent: totalUnread > 0 },
          ].map((s: any) => (
            <Card key={s.label}>
              <CardContent className="p-4 flex items-center gap-3">
                <s.icon className={`h-7 w-7 ${s.accent ? "text-destructive" : "text-primary"}`} />
                <div>
                  <div className="text-2xl font-bold">{s.value}</div>
                  <div className="text-xs text-muted-foreground">{s.label}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search subject, client..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="assigned">Assigned</SelectItem>
              <SelectItem value="in_progress">In progress</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Subject</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Assignee</TableHead>
                  <TableHead>Response SLA</TableHead>
                  <TableHead>Resolution SLA</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">No tickets.</TableCell></TableRow>
                )}
                {filtered.map((t: any) => {
                  const a = t.assigned_to ? assigneeMap.get(t.assigned_to) : null;
                  const unread = unreadMap.get(t.id) ?? 0;
                  return (
                    <TableRow key={t.id} className={`${t.sla_resolution_breached ? "bg-destructive/5" : ""} ${unread > 0 ? "font-semibold" : ""}`}>
                      <TableCell className="font-medium max-w-[260px]">
                        <div className="flex items-center gap-2">
                          <button className="text-left hover:underline truncate" onClick={() => setOpenTicket(t)}>{t.subject}</button>
                          {unread > 0 && (
                            <Badge variant="destructive" className="h-5 px-1.5 text-[10px] gap-1 shrink-0" title={`${unread} unread chat ${unread === 1 ? "message" : "messages"}`}>
                              <MessageSquare className="h-3 w-3" />
                              {unread}
                            </Badge>
                          )}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-normal">{formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}</div>
                      </TableCell>
                      <TableCell className="text-sm">{t.clients?.company_name ?? "—"}</TableCell>
                      <TableCell><Badge className={priorityColor(t.priority)}>{t.priority}</Badge></TableCell>
                      <TableCell><Badge className={statusColor(t.status)}>{t.status.replace("_", " ")}</Badge></TableCell>
                      <TableCell>
                        <Select value={t.assigned_to ?? "unassigned"} onValueChange={(v) => updateTicket(t.id, { assigned_to: v === "unassigned" ? null : v }, "Assignee updated")}>
                          <SelectTrigger className="h-8 w-44 text-xs"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unassigned">Unassigned</SelectItem>
                            {(assignees as any[]).map((u) => (
                              <SelectItem key={u.user_id} value={u.user_id}>{u.full_name ?? u.email}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {a && <div className="text-[10px] text-muted-foreground mt-0.5">since {formatDistanceToNow(new Date(t.assigned_at ?? t.created_at), { addSuffix: true })}</div>}
                      </TableCell>
                      <TableCell><SlaTimer dueAt={t.sla_response_due_at} breached={t.sla_response_breached} doneAt={t.first_response_at} label="response" /></TableCell>
                      <TableCell><SlaTimer dueAt={t.sla_resolution_due_at} breached={t.sla_resolution_breached} doneAt={t.resolved_at ?? t.closed_at} label="resolution" /></TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-1">
                          {(STATUS_FLOW[t.status as TicketStatus] ?? []).map((next) => (
                            <Button key={next} size="sm" variant="outline" className="h-7 text-xs"
                              onClick={() => updateTicket(t.id, { status: next }, `Marked ${next.replace("_", " ")}`)}>
                              {next.replace("_", " ")}
                            </Button>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      <Sheet open={!!openTicket} onOpenChange={(o) => !o && setOpenTicket(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {openTicket && <TicketDetail ticket={openTicket} assignees={assignees as any[]} onChange={(p, m) => updateTicket(openTicket.id, p, m)} />}
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
};

function parseChatNote(note: string | null): { text: string; attachments: { type: string; url: string }[] } {
  if (!note) return { text: "", attachments: [] };
  const idx = note.indexOf("\n📎 Attachments:\n");
  if (idx === -1) return { text: note, attachments: [] };
  const text = note.slice(0, idx);
  const attLines = note.slice(idx + "\n📎 Attachments:\n".length).split("\n").filter(Boolean);
  const attachments = attLines
    .map((l) => {
      const m = l.match(/^\[([^\]]*)\]\s+(.+)$/);
      return m ? { type: m[1], url: m[2] } : null;
    })
    .filter(Boolean) as { type: string; url: string }[];
  return { text, attachments };
}

const TicketDetail = ({ ticket, assignees, onChange }: { ticket: any; assignees: any[]; onChange: (p: any, m: string) => void }) => {
  const qc = useQueryClient();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const { data: log = [] } = useQuery({
    queryKey: ["ticket-log", ticket.id],
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("ticket_activity_log")
        .select("id, action, field, old_value, new_value, note, created_at, actor_id")
        .eq("ticket_id", ticket.id)
        .order("created_at", { ascending: false });
      const actorIds = Array.from(new Set((rows ?? []).map((r: any) => r.actor_id).filter(Boolean)));
      let actors: Record<string, string> = {};
      if (actorIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, full_name, email")
          .in("user_id", actorIds);
        actors = Object.fromEntries((profs ?? []).map((p: any) => [p.user_id, p.full_name ?? p.email ?? "Unknown"]));
      }
      return (rows ?? []).map((r: any) => ({ ...r, actor_name: actors[r.actor_id] ?? null }));
    },
  });

  // Room members + last_read_at to compute read receipts on each activity
  const { data: members = [] } = useQuery({
    queryKey: ["ticket-room-members", ticket.chat_room_id],
    enabled: !!ticket.chat_room_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("chat_room_members")
        .select("user_id, last_read_at")
        .eq("room_id", ticket.chat_room_id);
      const ids = (data ?? []).map((m: any) => m.user_id);
      let names: Record<string, string> = {};
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles").select("user_id, full_name, email").in("user_id", ids);
        names = Object.fromEntries((profs ?? []).map((p: any) => [p.user_id, p.full_name ?? p.email ?? "Unknown"]));
      }
      return (data ?? []).map((m: any) => ({ ...m, name: names[m.user_id] ?? "Unknown" }));
    },
  });

  useEffect(() => {
    const chans = [
      supabase
        .channel(`ticket-log-${ticket.id}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "ticket_activity_log", filter: `ticket_id=eq.${ticket.id}` },
          () => qc.invalidateQueries({ queryKey: ["ticket-log", ticket.id] }))
        .subscribe(),
    ];
    if (ticket.chat_room_id) {
      chans.push(
        supabase
          .channel(`ticket-members-${ticket.chat_room_id}`)
          .on("postgres_changes", { event: "*", schema: "public", table: "chat_room_members", filter: `room_id=eq.${ticket.chat_room_id}` },
            () => qc.invalidateQueries({ queryKey: ["ticket-room-members", ticket.chat_room_id] }))
          .subscribe()
      );
    }
    return () => { chans.forEach((c) => supabase.removeChannel(c)); };
  }, [ticket.id, ticket.chat_room_id, qc]);

  // Auto mark-as-read when ticket detail opens, and on every new chat message
  useEffect(() => {
    if (!ticket.chat_room_id) return;
    let userId: string | null = null;
    let cancelled = false;

    const markRead = async () => {
      if (!userId) {
        const { data } = await supabase.auth.getUser();
        userId = data.user?.id ?? null;
      }
      if (!userId || cancelled) return;
      const { data: existing } = await supabase
        .from("chat_room_members")
        .select("user_id")
        .eq("room_id", ticket.chat_room_id)
        .eq("user_id", userId)
        .maybeSingle();
      const nowIso = new Date().toISOString();
      if (existing) {
        await supabase
          .from("chat_room_members")
          .update({ last_read_at: nowIso })
          .eq("room_id", ticket.chat_room_id)
          .eq("user_id", userId);
      } else {
        await supabase
          .from("chat_room_members")
          .insert({ room_id: ticket.chat_room_id, user_id: userId, last_read_at: nowIso });
      }
      qc.invalidateQueries({ queryKey: ["ticket-room-members", ticket.chat_room_id] });
      qc.invalidateQueries({ queryKey: ["sidebar-unread-counts"] });
    };

    markRead();

    const ch = supabase
      .channel(`ticket-auto-read-${ticket.chat_room_id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_room_messages", filter: `room_id=eq.${ticket.chat_room_id}` },
        () => markRead(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [ticket.chat_room_id, qc]);

  const computeReads = (createdAt: string, senderId: string | null) => {
    const others = (members as any[]).filter((m) => m.user_id !== senderId);
    const readers = others.filter((m) => m.last_read_at && new Date(m.last_read_at) >= new Date(createdAt));
    return { readers, total: others.length };
  };

  return (
    <div className="space-y-4">
      <SheetHeader><SheetTitle>{ticket.subject}</SheetTitle></SheetHeader>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div><div className="text-muted-foreground text-xs">Status</div><Badge className={statusColor(ticket.status)}>{ticket.status.replace("_", " ")}</Badge></div>
        <div><div className="text-muted-foreground text-xs">Priority</div><Badge className={priorityColor(ticket.priority)}>{ticket.priority}</Badge></div>
        <div><div className="text-muted-foreground text-xs">Client</div>{ticket.clients?.company_name ?? "—"}</div>
        <div><div className="text-muted-foreground text-xs">Created</div>{formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}</div>
        <div className="col-span-2 flex items-center gap-2">
          <div className="text-muted-foreground text-xs">Escalation</div>
          <Badge variant={ticket.escalation_level > 0 ? "destructive" : "secondary"}>
            L{ticket.escalation_level ?? 0} / L{ticket.escalation_max_level ?? 3}
          </Badge>
          {ticket.last_escalated_at && (
            <span className="text-[10px] text-muted-foreground">
              last {formatDistanceToNow(new Date(ticket.last_escalated_at), { addSuffix: true })}
            </span>
          )}
        </div>
      </div>

      {ticket.chat_room_id && (
        <Button asChild size="sm" variant="outline" className="w-full">
          <a href={`/internal-chat?room=${ticket.chat_room_id}`}>💬 Open ticket chat thread</a>
        </Button>
      )}

      <div className="space-y-2">
        <div className="text-xs font-medium text-muted-foreground">Workflow</div>
        <div className="flex flex-wrap gap-1">
          {(STATUS_FLOW[ticket.status as TicketStatus] ?? []).map((next) => (
            <Button key={next} size="sm" variant="outline" onClick={() => onChange({ status: next }, `Marked ${next.replace("_", " ")}`)}>
              → {next.replace("_", " ")}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-medium text-muted-foreground">Priority</div>
        <Select value={ticket.priority} onValueChange={(v) => onChange({ priority: v }, "Priority updated")}>
          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            {["low", "medium", "high", "urgent"].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-medium text-muted-foreground">Assignee</div>
        <Select value={ticket.assigned_to ?? "unassigned"} onValueChange={(v) => onChange({ assigned_to: v === "unassigned" ? null : v }, "Assignee updated")}>
          <SelectTrigger className="h-9"><SelectValue placeholder="Unassigned" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {assignees.map((u) => <SelectItem key={u.user_id} value={u.user_id}>{u.full_name ?? u.email}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">SLA</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-xs">
          <div className="flex justify-between"><span className="text-muted-foreground">Response due</span><SlaTimer dueAt={ticket.sla_response_due_at} breached={ticket.sla_response_breached} doneAt={ticket.first_response_at} label="response" /></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Resolution due</span><SlaTimer dueAt={ticket.sla_resolution_due_at} breached={ticket.sla_resolution_breached} doneAt={ticket.resolved_at ?? ticket.closed_at} label="resolution" /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4" />Escalation policy</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-muted-foreground mb-1">Unanswered min</div>
              <Input
                type="number" min={5} max={1440}
                defaultValue={ticket.escalation_unanswered_minutes ?? 30}
                onBlur={(ev) => {
                  const n = Math.max(5, Math.min(1440, Number(ev.target.value) || 30));
                  if (n !== ticket.escalation_unanswered_minutes) onChange({ escalation_unanswered_minutes: n }, `Escalation timeout set to ${n}m`);
                }}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <div className="text-muted-foreground mb-1">Max level</div>
              <Input
                type="number" min={1} max={10}
                defaultValue={ticket.escalation_max_level ?? 3}
                onBlur={(ev) => {
                  const n = Math.max(1, Math.min(10, Number(ev.target.value) || 3));
                  if (n !== ticket.escalation_max_level) onChange({ escalation_max_level: n }, `Max escalation level set to L${n}`);
                }}
                className="h-8 text-xs"
              />
            </div>
          </div>
          <Button
            size="sm" variant="destructive" className="w-full"
            disabled={(ticket.escalation_level ?? 0) >= (ticket.escalation_max_level ?? 3)}
            onClick={async () => {
              const { error } = await supabase.rpc("escalate_stuck_tickets" as any);
              if (error) { toast.error(error.message); return; }
              toast.success("Escalation check triggered");
              qc.invalidateQueries({ queryKey: ["tickets"] });
              qc.invalidateQueries({ queryKey: ["ticket-log", ticket.id] });
            }}
          >
            ⚠️ Run escalation check now
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle className="text-sm">Activity</CardTitle>
          <Button
            type="button"
            size="sm"
            variant={unreadOnly ? "default" : "outline"}
            className="h-7 text-[11px]"
            onClick={() => setUnreadOnly(v => !v)}
            disabled={!ticket.chat_room_id}
            title={ticket.chat_room_id ? "Toggle unread chat replies" : "No chat room linked"}
          >
            {unreadOnly ? "Showing unread chat" : "Unread chat only"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {(() => {
            const items = (log as any[]).filter((e) => {
              if (!unreadOnly) return true;
              if (!ticket.chat_room_id) return true;
              if (!e.action?.startsWith("chat_reply") || e.action === "chat_reply_deleted") return false;
              const { readers, total } = computeReads(e.created_at, e.actor_id);
              return total > 0 && readers.length < total;
            });
            if (items.length === 0) {
              return <div className="text-xs text-muted-foreground">{unreadOnly ? "No unread chat replies." : "No activity yet."}</div>;
            }
            return items.map((e) => {
            const isChat = e.action?.startsWith("chat_reply");
            const isEscalation = e.action === "ticket_escalated";
            const parsed = parseChatNote(e.note);
            return (
              <div key={e.id} className={`text-xs border-l-2 pl-3 py-1 ${isEscalation ? "border-destructive bg-destructive/5 rounded-r" : isChat ? "border-primary" : "border-border"}`}>
                <div className="font-medium flex items-center gap-2">
                  {isEscalation ? "⚠️ " : isChat ? "💬 " : ""}{e.action.replace(/_/g, " ")}{e.field ? ` · ${e.field}` : ""}
                  {e.actor_name && <span className="text-muted-foreground font-normal">· {e.actor_name}</span>}
                  {isEscalation && !e.actor_id && <span className="text-muted-foreground font-normal">· system</span>}
                </div>
                {isEscalation && e.note && (
                  <div className="mt-1 text-destructive whitespace-pre-wrap">{e.note}</div>
                )}
                {isChat && parsed.text && (
                  <div className={`mt-1 whitespace-pre-wrap ${e.action === "chat_reply_deleted" ? "italic text-muted-foreground" : ""}`}>{parsed.text}</div>
                )}
                {isChat && parsed.attachments.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {parsed.attachments.map((a, i) => (
                      a.type.startsWith("image/") ? (
                        <a key={i} href={a.url} target="_blank" rel="noopener noreferrer">
                          <img src={a.url} alt="attachment" className="h-16 w-16 rounded object-cover border" />
                        </a>
                      ) : a.type.startsWith("video/") ? (
                        <video key={i} src={a.url} controls preload="metadata" className="h-20 w-28 rounded border bg-black" />
                      ) : (
                        <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" className="rounded border bg-muted/50 px-2 py-1 hover:bg-accent/30">
                          📎 attachment
                        </a>
                      )
                    ))}
                  </div>
                )}
                {!isChat && (e.old_value || e.new_value) && (
                  <div className="text-muted-foreground">{e.old_value ?? "—"} → {e.new_value ?? "—"}</div>
                )}
                {!isChat && !e.old_value && !e.new_value && e.note && (
                  <div className="text-muted-foreground">{e.note}</div>
                )}
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <div className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}</div>
                  {isChat && e.action !== "chat_reply_deleted" && ticket.chat_room_id && (() => {
                    const { readers, total } = computeReads(e.created_at, e.actor_id);
                    if (total === 0) return null;
                    const allRead = readers.length >= total;
                    const tip = readers.length === 0
                      ? "Unread by all members"
                      : `Read by ${readers.map((r: any) => r.name).join(", ")}${allRead ? "" : ` · ${total - readers.length} pending`}`;
                    return (
                      <span title={tip} className={`text-[10px] flex items-center gap-0.5 ${allRead ? "text-primary" : readers.length > 0 ? "text-muted-foreground" : "text-muted-foreground/60"}`}>
                        {readers.length === 0 ? "○" : allRead ? "✓✓" : "✓"}
                        <span>{readers.length}/{total}</span>
                      </span>
                    );
                  })()}
                </div>
              </div>
            );
            });
          })()}
        </CardContent>
      </Card>
    </div>
  );
};

export default TicketsWorkflow;
