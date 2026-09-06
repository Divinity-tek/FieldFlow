import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Headphones, Search, Plus, Clock, CheckCircle2, AlertTriangle,
  Phone, MessageSquare, Mail, Zap, TrendingUp, Users, Timer,
} from "lucide-react";

interface HelpdeskTicket {
  id: string;
  ticketNumber: string;
  subject: string;
  clientName: string;
  channel: "phone" | "email" | "chat" | "portal";
  priority: "critical" | "high" | "medium" | "low";
  category: "break_fix" | "installation" | "maintenance" | "inquiry" | "complaint";
  status: "new" | "assigned" | "in_progress" | "waiting" | "resolved" | "closed";
  assignedTo: string;
  createdAt: string;
  slaTarget: string;
  slaStatus: "on_track" | "at_risk" | "breached";
  responseTime?: string;
  resolutionTime?: string;
}

const mockTickets: HelpdeskTicket[] = [
  { id: "1", ticketNumber: "HD-20260416-001", subject: "Server down — DC Frankfurt", clientName: "Deutsche Bank", channel: "phone", priority: "critical", category: "break_fix", status: "in_progress", assignedTo: "James Wilson", createdAt: "2026-04-16T08:15:00", slaTarget: "2hr response / 4hr resolution", slaStatus: "on_track", responseTime: "12 min" },
  { id: "2", ticketNumber: "HD-20260416-002", subject: "WiFi AP replacement — Building 3", clientName: "Barclays PLC", channel: "portal", priority: "high", category: "break_fix", status: "assigned", assignedTo: "Sarah Chen", createdAt: "2026-04-16T09:30:00", slaTarget: "4hr response / NBD resolution", slaStatus: "on_track", responseTime: "28 min" },
  { id: "3", ticketNumber: "HD-20260415-009", subject: "UPS battery replacement schedule", clientName: "NHS Trust", channel: "email", priority: "medium", category: "maintenance", status: "waiting", assignedTo: "Carlos Mendez", createdAt: "2026-04-15T14:20:00", slaTarget: "NBD response / 3BD resolution", slaStatus: "at_risk" },
  { id: "4", ticketNumber: "HD-20260415-008", subject: "New site cabling quote request", clientName: "Emirates NBD", channel: "chat", priority: "low", category: "inquiry", status: "resolved", assignedTo: "Anna Kowalski", createdAt: "2026-04-15T11:00:00", slaTarget: "8hr response", slaStatus: "on_track", responseTime: "45 min", resolutionTime: "3.5 hrs" },
  { id: "5", ticketNumber: "HD-20260414-012", subject: "CCTV camera offline — Gate 2", clientName: "DBS Bank", channel: "phone", priority: "high", category: "break_fix", status: "in_progress", assignedTo: "Raj Patel", createdAt: "2026-04-14T22:45:00", slaTarget: "2hr response / 4hr resolution", slaStatus: "breached", responseTime: "1hr 58min" },
  { id: "6", ticketNumber: "HD-20260414-011", subject: "Rack PDU installation — DC2", clientName: "Barclays PLC", channel: "portal", priority: "medium", category: "installation", status: "closed", assignedTo: "James Wilson", createdAt: "2026-04-14T10:00:00", slaTarget: "NBD response / Scheduled", slaStatus: "on_track", responseTime: "2 hrs", resolutionTime: "1 day" },
  { id: "7", ticketNumber: "HD-20260413-005", subject: "Service quality complaint", clientName: "Deutsche Bank", channel: "email", priority: "high", category: "complaint", status: "in_progress", assignedTo: "Team Lead", createdAt: "2026-04-13T16:30:00", slaTarget: "4hr response / 2BD resolution", slaStatus: "on_track", responseTime: "1 hr" },
];

const priorityColor = (p: string) => {
  switch (p) {
    case "critical": return "bg-destructive/10 text-destructive border-destructive/30";
    case "high": return "bg-warning/10 text-warning border-warning/30";
    case "medium": return "bg-warning/10 text-warning border-warning/30";
    case "low": return "bg-info/10 text-info border-info/30";
    default: return "";
  }
};

const statusColor = (s: string) => {
  switch (s) {
    case "new": return "bg-info/10 text-info border-info/30";
    case "assigned": return "bg-primary/10 text-primary border-primary/30";
    case "in_progress": return "bg-warning/10 text-warning border-warning/30";
    case "waiting": return "bg-warning/10 text-warning border-warning/30";
    case "resolved": return "bg-success/10 text-success border-success/30";
    case "closed": return "bg-muted text-muted-foreground";
    default: return "";
  }
};

const slaColor = (s: string) => {
  switch (s) {
    case "on_track": return "bg-success/10 text-success border-success/30";
    case "at_risk": return "bg-warning/10 text-warning border-warning/30";
    case "breached": return "bg-destructive/10 text-destructive border-destructive/30";
    default: return "";
  }
};

const channelIcon = (c: string) => {
  switch (c) {
    case "phone": return <Phone className="h-3 w-3" />;
    case "email": return <Mail className="h-3 w-3" />;
    case "chat": return <MessageSquare className="h-3 w-3" />;
    case "portal": return <Headphones className="h-3 w-3" />;
    default: return null;
  }
};

const Helpdesk = () => {
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");

  const openTickets = mockTickets.filter(t => !["resolved", "closed"].includes(t.status)).length;
  const criticalOpen = mockTickets.filter(t => t.priority === "critical" && !["resolved", "closed"].includes(t.status)).length;
  const breached = mockTickets.filter(t => t.slaStatus === "breached").length;
  const avgResponseMins = 45;

  const filtered = mockTickets.filter(t => {
    const matchSearch = t.subject.toLowerCase().includes(search.toLowerCase()) || t.clientName.toLowerCase().includes(search.toLowerCase()) || t.ticketNumber.toLowerCase().includes(search.toLowerCase());
    const matchPriority = priorityFilter === "all" || t.priority === priorityFilter;
    return matchSearch && matchPriority;
  });

  return (
    <AppLayout title="24/7 Helpdesk" subtitle="Multi-channel service desk with SLA tracking">
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Headphones className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold font-display text-card-foreground">Helpdesk Console</h2>
              <p className="text-[10px] text-muted-foreground">24/7/365 multi-channel support</p>
            </div>
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New Ticket</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Helpdesk Ticket</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Subject</Label><Input placeholder="Brief description of the issue" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Client</Label><Input placeholder="Client name" /></div>
                  <div><Label>Channel</Label>
                    <Select><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent><SelectItem value="phone">Phone</SelectItem><SelectItem value="email">Email</SelectItem><SelectItem value="chat">Chat</SelectItem><SelectItem value="portal">Portal</SelectItem></SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Priority</Label>
                    <Select><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent><SelectItem value="critical">Critical</SelectItem><SelectItem value="high">High</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="low">Low</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div><Label>Category</Label>
                    <Select><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent><SelectItem value="break_fix">Break/Fix</SelectItem><SelectItem value="installation">Installation</SelectItem><SelectItem value="maintenance">Maintenance</SelectItem><SelectItem value="inquiry">Inquiry</SelectItem></SelectContent>
                    </Select>
                  </div>
                </div>
                <div><Label>Description</Label><Textarea placeholder="Full details..." /></div>
                <Button className="w-full" onClick={() => toast.success("Helpdesk ticket created")}>Create Ticket</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Live Status Bar */}
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 flex items-center justify-center gap-3">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-success" />
          </span>
          <span className="text-sm font-medium text-card-foreground">Service Desk LIVE — 24/7/365 Multi-Channel Support Active</span>
          <Badge variant="outline" className="text-[10px]">Phone · Email · Chat · Portal</Badge>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { icon: Headphones, label: "Open Tickets", value: openTickets, color: "primary" },
            { icon: AlertTriangle, label: "Critical Open", value: criticalOpen, color: "destructive" },
            { icon: Timer, label: "Avg Response", value: `${avgResponseMins}m`, color: "warning" },
            { icon: Zap, label: "SLA On-Track", value: `${mockTickets.filter(t => t.slaStatus === "on_track").length}/${mockTickets.length}`, color: "success" },
            { icon: TrendingUp, label: "SLA Breached", value: breached, color: "info" },
          ].map((stat) => (
            <Card key={stat.label} className="hover-lift">
              <CardContent className="p-4 text-center">
                <stat.icon className={`h-7 w-7 text-${stat.color} mx-auto mb-2`} />
                <div className="text-2xl font-bold font-display text-card-foreground">{stat.value}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">{stat.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search tickets, clients..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priority</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tickets Table */}
        <Card className="rounded-2xl shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/20">
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider">Ticket #</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider">Subject</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider">Client</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider">Channel</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider">Priority</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider">Assigned</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider">Response</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider">SLA</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(t => (
                  <TableRow key={t.id} className={`hover:bg-muted/30 transition-colors ${t.slaStatus === "breached" ? "bg-destructive/5" : ""}`}>
                    <TableCell className="font-mono text-xs">{t.ticketNumber}</TableCell>
                    <TableCell className="font-medium text-sm max-w-[200px] truncate">{t.subject}</TableCell>
                    <TableCell className="text-sm">{t.clientName}</TableCell>
                    <TableCell><div className="flex items-center gap-1">{channelIcon(t.channel)}<span className="capitalize text-xs">{t.channel}</span></div></TableCell>
                    <TableCell><Badge className={priorityColor(t.priority)}>{t.priority}</Badge></TableCell>
                    <TableCell className="text-xs">{t.assignedTo}</TableCell>
                    <TableCell className="text-xs">{t.responseTime || "—"}</TableCell>
                    <TableCell><Badge className={slaColor(t.slaStatus)}>{t.slaStatus.replace("_", " ")}</Badge></TableCell>
                    <TableCell><Badge className={statusColor(t.status)}>{t.status.replace("_", " ")}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Helpdesk;
