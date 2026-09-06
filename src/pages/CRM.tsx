import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { format, formatDistanceToNow, isPast, isToday } from "date-fns";
import {
  Plus, Search, AlertTriangle, MessageSquare, Clock, CheckCircle,
  XCircle, Building2, ArrowUpDown, Phone, Mail, FileText, Users,
  Star, Bell, CalendarClock, TrendingUp, ChevronRight, Smile, Meh, Frown,
  BarChart3, Target, ArrowUpRight, Zap, GripVertical,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
} from "recharts";

const statusStyles: Record<string, string> = {
  open: "bg-warning/10 text-warning border-warning/20",
  in_progress: "bg-primary/10 text-primary border-primary/20",
  resolved: "bg-success/10 text-success border-success/20",
  closed: "bg-muted text-muted-foreground border-border",
};

const statusIcons: Record<string, typeof Clock> = {
  open: Clock,
  in_progress: ArrowUpDown,
  resolved: CheckCircle,
  closed: XCircle,
};

const categoryStyles: Record<string, string> = {
  complaint: "bg-destructive/10 text-destructive border-destructive/20",
  support: "bg-primary/10 text-primary border-primary/20",
  billing: "bg-warning/10 text-warning border-warning/20",
  general: "bg-muted text-muted-foreground border-border",
};

const priorityStyles: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-primary/10 text-primary",
  high: "bg-warning/10 text-warning",
  urgent: "bg-destructive/10 text-destructive",
};

const pipelineStages = [
  { key: "new_lead", label: "New Lead", color: "bg-muted/60 text-muted-foreground", accent: "border-muted-foreground/30" },
  { key: "contacted", label: "Contacted", color: "bg-info/10 text-info", accent: "border-info/30" },
  { key: "qualified", label: "Qualified", color: "bg-primary/10 text-primary", accent: "border-primary/30" },
  { key: "proposal", label: "Proposal", color: "bg-accent/10 text-accent-foreground", accent: "border-accent/30" },
  { key: "negotiation", label: "Negotiation", color: "bg-warning/10 text-warning", accent: "border-warning/30" },
  { key: "won", label: "Won", color: "bg-success/10 text-success", accent: "border-success/30" },
  { key: "lost", label: "Lost", color: "bg-destructive/10 text-destructive", accent: "border-destructive/30" },
];

const commTypeConfig: Record<string, { icon: typeof Phone; color: string; bg: string; label: string }> = {
  call: { icon: Phone, color: "text-primary", bg: "bg-primary/10", label: "Phone Call" },
  email: { icon: Mail, color: "text-info", bg: "bg-info/10", label: "Email" },
  meeting: { icon: Users, color: "text-accent-foreground", bg: "bg-accent/10", label: "Meeting" },
  note: { icon: FileText, color: "text-muted-foreground", bg: "bg-muted/50", label: "Note" },
};

const CHART_COLORS = [
  "hsl(var(--success))",
  "hsl(var(--warning))",
  "hsl(var(--destructive))",
  "hsl(var(--primary))",
  "hsl(var(--muted-foreground))",
];

const CRM = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [commDialogOpen, setCommDialogOpen] = useState(false);
  const [leadDialogOpen, setLeadDialogOpen] = useState(false);
  const [reminderDialogOpen, setReminderDialogOpen] = useState(false);

  // Ticket form
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("general");
  const [priority, setPriority] = useState<string>("medium");
  const [clientId, setClientId] = useState("");

  // Communication form
  const [commClientId, setCommClientId] = useState("");
  const [commType, setCommType] = useState("note");
  const [commSubject, setCommSubject] = useState("");
  const [commContent, setCommContent] = useState("");

  // Lead form
  const [leadClientId, setLeadClientId] = useState("");
  const [leadStage, setLeadStage] = useState("new_lead");
  const [leadValue, setLeadValue] = useState("");
  const [leadNotes, setLeadNotes] = useState("");
  const [leadCloseDate, setLeadCloseDate] = useState("");

  // Reminder form
  const [reminderClientId, setReminderClientId] = useState("");
  const [reminderTitle, setReminderTitle] = useState("");
  const [reminderDesc, setReminderDesc] = useState("");
  const [reminderDue, setReminderDue] = useState("");

  const { data: clients = [] } = useQuery({
    queryKey: ["crm-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, company_name, contact_name, email, phone, address, created_at")
        .order("company_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["crm-tickets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select("*, clients(company_name, contact_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: communications = [] } = useQuery({
    queryKey: ["crm-communications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_communications")
        .select("*, clients(company_name)")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  const { data: leads = [] } = useQuery({
    queryKey: ["crm-leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_pipeline")
        .select("*, clients(company_name, contact_name)")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: reminders = [] } = useQuery({
    queryKey: ["crm-reminders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("follow_up_reminders")
        .select("*, clients(company_name)")
        .order("due_date", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: ratings = [] } = useQuery({
    queryKey: ["crm-ratings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("engineer_ratings")
        .select("*, clients(company_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Mutations
  const createTicket = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("tickets").insert({
        subject: subject.trim(),
        description: description.trim() || null,
        category: category as any,
        priority: priority as any,
        client_id: clientId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-tickets"] });
      setDialogOpen(false);
      setSubject(""); setDescription(""); setCategory("general"); setPriority("medium"); setClientId("");
      toast({ title: "Ticket created successfully" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const update: any = { status };
      if (status === "resolved") update.resolved_at = new Date().toISOString();
      const { error } = await supabase.from("tickets").update(update).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-tickets"] });
      toast({ title: "Ticket updated" });
    },
  });

  const createComm = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("client_communications").insert({
        client_id: commClientId,
        user_id: user!.id,
        type: commType,
        subject: commSubject.trim(),
        content: commContent.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-communications"] });
      setCommDialogOpen(false);
      setCommClientId(""); setCommType("note"); setCommSubject(""); setCommContent("");
      toast({ title: "Communication logged" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const createLead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("lead_pipeline").insert({
        client_id: leadClientId,
        stage: leadStage,
        deal_value: parseFloat(leadValue) || 0,
        notes: leadNotes.trim() || null,
        expected_close_date: leadCloseDate || null,
        assigned_to: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-leads"] });
      setLeadDialogOpen(false);
      setLeadClientId(""); setLeadStage("new_lead"); setLeadValue(""); setLeadNotes(""); setLeadCloseDate("");
      toast({ title: "Lead added to pipeline" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateLeadStage = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: string }) => {
      const { error } = await supabase.from("lead_pipeline").update({ stage }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-leads"] });
      toast({ title: "Lead stage updated" });
    },
  });

  const createReminder = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("follow_up_reminders").insert({
        client_id: reminderClientId,
        user_id: user!.id,
        title: reminderTitle.trim(),
        description: reminderDesc.trim() || null,
        due_date: new Date(reminderDue).toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-reminders"] });
      setReminderDialogOpen(false);
      setReminderClientId(""); setReminderTitle(""); setReminderDesc(""); setReminderDue("");
      toast({ title: "Reminder created" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleReminder = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const { error } = await supabase.from("follow_up_reminders").update({
        is_completed: completed,
        completed_at: completed ? new Date().toISOString() : null,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-reminders"] });
      toast({ title: "Reminder updated" });
    },
  });

  // Derived data
  const filteredTickets = tickets.filter((t: any) => {
    const matchSearch = !search || t.subject.toLowerCase().includes(search.toLowerCase()) ||
      t.clients?.company_name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || t.status === statusFilter;
    const matchCategory = categoryFilter === "all" || t.category === categoryFilter;
    return matchSearch && matchStatus && matchCategory;
  });

  const stats = {
    total: tickets.length,
    open: tickets.filter((t: any) => t.status === "open").length,
    inProgress: tickets.filter((t: any) => t.status === "in_progress").length,
    resolved: tickets.filter((t: any) => t.status === "resolved" || t.status === "closed").length,
    complaints: tickets.filter((t: any) => t.category === "complaint").length,
  };

  const avgRating = ratings.length > 0
    ? (ratings.reduce((sum: number, r: any) => sum + r.rating, 0) / ratings.length).toFixed(1)
    : "—";
  const satisfactionPct = ratings.length > 0
    ? Math.round((ratings.filter((r: any) => r.rating >= 4).length / ratings.length) * 100)
    : 0;

  const pendingReminders = reminders.filter((r: any) => !r.is_completed);
  const overdueReminders = pendingReminders.filter((r: any) => isPast(new Date(r.due_date)) && !isToday(new Date(r.due_date)));

  const totalPipelineValue = leads
    .filter((l: any) => !["won", "lost"].includes(l.stage))
    .reduce((sum: number, l: any) => sum + (l.deal_value || 0), 0);

  // Rating distribution for chart
  const ratingDistribution = useMemo(() => {
    const dist = [0, 0, 0, 0, 0];
    ratings.forEach((r: any) => { if (r.rating >= 1 && r.rating <= 5) dist[r.rating - 1]++; });
    return dist.map((count, i) => ({ name: `${i + 1}★`, value: count }));
  }, [ratings]);

  // Satisfaction pie data
  const satisfactionPie = useMemo(() => {
    const satisfied = ratings.filter((r: any) => r.rating >= 4).length;
    const neutral = ratings.filter((r: any) => r.rating === 3).length;
    const unsatisfied = ratings.filter((r: any) => r.rating < 3).length;
    return [
      { name: "Satisfied", value: satisfied },
      { name: "Neutral", value: neutral },
      { name: "Unsatisfied", value: unsatisfied },
    ].filter(d => d.value > 0);
  }, [ratings]);

  const kpiCards = [
    { label: "Total Tickets", value: stats.total, icon: MessageSquare, color: "primary", gradient: "from-primary/10 to-primary/5" },
    { label: "Open", value: stats.open, icon: Clock, color: "warning", gradient: "from-warning/10 to-warning/5" },
    { label: "In Progress", value: stats.inProgress, icon: Zap, color: "info", gradient: "from-info/10 to-info/5" },
    { label: "Resolved", value: stats.resolved, icon: CheckCircle, color: "success", gradient: "from-success/10 to-success/5" },
    { label: "Satisfaction", value: avgRating !== "—" ? `${avgRating}★` : "—", icon: Star, color: "warning", gradient: "from-warning/10 to-warning/5" },
    { label: "Pipeline", value: `£${totalPipelineValue.toLocaleString()}`, icon: TrendingUp, color: "success", gradient: "from-success/10 to-success/5" },
    { label: "Overdue", value: overdueReminders.length, icon: Bell, color: overdueReminders.length > 0 ? "destructive" : "muted-foreground", gradient: overdueReminders.length > 0 ? "from-destructive/10 to-destructive/5" : "from-muted/10 to-muted/5" },
  ];

  return (
    <AppLayout title="CRM" subtitle="Manage tickets, communications, pipeline, and client relationships">
      {/* Premium KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
        {kpiCards.map((s, i) => (
          <div
            key={s.label}
            className={`group relative bg-card rounded-2xl border border-border p-3.5 shadow-card hover:shadow-elevated hover:border-${s.color}/20 transition-all duration-300 overflow-hidden animate-fade-in`}
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${s.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl`} />
            <div className="relative z-10 flex items-center gap-2.5">
              <div className={`w-9 h-9 rounded-xl bg-${s.color}/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                <s.icon className={`w-4 h-4 text-${s.color}`} />
              </div>
              <div>
                <p className="text-lg font-bold font-display text-card-foreground leading-tight">{s.value}</p>
                <p className="text-[10px] text-muted-foreground font-medium">{s.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="tickets" className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="tickets" className="gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" /> Tickets
            </TabsTrigger>
            <TabsTrigger value="communications" className="gap-1.5">
              <Phone className="w-3.5 h-3.5" /> Communications
            </TabsTrigger>
            <TabsTrigger value="pipeline" className="gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" /> Pipeline
            </TabsTrigger>
            <TabsTrigger value="reminders" className="gap-1.5">
              <Bell className="w-3.5 h-3.5" /> Reminders
              {overdueReminders.length > 0 && (
                <span className="ml-0.5 px-1.5 py-0.5 text-[9px] rounded-full bg-destructive text-destructive-foreground font-bold">
                  {overdueReminders.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="satisfaction" className="gap-1.5">
              <Star className="w-3.5 h-3.5" /> Satisfaction
            </TabsTrigger>
            <TabsTrigger value="clients" className="gap-1.5">
              <Building2 className="w-3.5 h-3.5" /> Clients
            </TabsTrigger>
          </TabsList>
        </div>

        {/* === TICKETS TAB === */}
        <TabsContent value="tickets" className="animate-fade-in">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search tickets..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="complaint">Complaint</SelectItem>
                <SelectItem value="support">Support</SelectItem>
                <SelectItem value="billing">Billing</SelectItem>
                <SelectItem value="general">General</SelectItem>
              </SelectContent>
            </Select>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="ml-auto gap-2"><Plus className="w-4 h-4" /> New Ticket</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle>Create Ticket</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-2">
                  <Input placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
                  <Textarea placeholder="Description..." value={description} onChange={(e) => setDescription(e.target.value)} />
                  <Select value={clientId} onValueChange={setClientId}>
                    <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                    <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}</SelectContent>
                  </Select>
                  <div className="grid grid-cols-2 gap-3">
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="complaint">Complaint</SelectItem>
                        <SelectItem value="support">Support</SelectItem>
                        <SelectItem value="billing">Billing</SelectItem>
                        <SelectItem value="general">General</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={priority} onValueChange={setPriority}>
                      <SelectTrigger><SelectValue placeholder="Priority" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button className="w-full" disabled={!subject.trim() || !clientId || createTicket.isPending} onClick={() => createTicket.mutate()}>
                    {createTicket.isPending ? "Creating..." : "Create Ticket"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          {isLoading ? (
            <p className="text-muted-foreground text-center py-8">Loading...</p>
          ) : (
            <div className="bg-card rounded-2xl border border-border shadow-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/20">
                    <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Subject</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Client</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Category</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Priority</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Status</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Created</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wider font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTickets.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">No tickets found.</TableCell>
                    </TableRow>
                  ) : filteredTickets.map((ticket: any, i: number) => {
                    const StatusIcon = statusIcons[ticket.status] || Clock;
                    return (
                      <TableRow key={ticket.id} className="hover:bg-muted/20 transition-colors animate-fade-in" style={{ animationDelay: `${Math.min(i * 30, 200)}ms` }}>
                        <TableCell className="font-medium text-card-foreground max-w-[200px] truncate">{ticket.subject}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{ticket.clients?.company_name ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[10px] ${categoryStyles[ticket.category]}`}>{ticket.category}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[10px] ${priorityStyles[ticket.priority]}`}>{ticket.priority}</Badge>
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full ${statusStyles[ticket.status]}`}>
                            <StatusIcon className="w-3 h-3" />
                            {ticket.status.replace("_", " ")}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">{format(new Date(ticket.created_at), "PP")}</TableCell>
                        <TableCell>
                          <Select value={ticket.status} onValueChange={(val) => updateStatus.mutate({ id: ticket.id, status: val })}>
                            <SelectTrigger className="h-7 w-[110px] text-[10px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="open">Open</SelectItem>
                              <SelectItem value="in_progress">In Progress</SelectItem>
                              <SelectItem value="resolved">Resolved</SelectItem>
                              <SelectItem value="closed">Closed</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* === COMMUNICATIONS TAB — Timeline Style === */}
        <TabsContent value="communications" className="animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-card-foreground">{communications.length} communications</p>
              <span className="text-xs text-muted-foreground">logged</span>
            </div>
            <Dialog open={commDialogOpen} onOpenChange={setCommDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2"><Plus className="w-4 h-4" /> Log Communication</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle>Log Communication</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-2">
                  <Select value={commClientId} onValueChange={setCommClientId}>
                    <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                    <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={commType} onValueChange={setCommType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="call">📞 Phone Call</SelectItem>
                      <SelectItem value="email">📧 Email</SelectItem>
                      <SelectItem value="meeting">👥 Meeting</SelectItem>
                      <SelectItem value="note">📝 Note</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input placeholder="Subject" value={commSubject} onChange={(e) => setCommSubject(e.target.value)} />
                  <Textarea placeholder="Details..." value={commContent} onChange={(e) => setCommContent(e.target.value)} />
                  <Button className="w-full" disabled={!commSubject.trim() || !commClientId || createComm.isPending} onClick={() => createComm.mutate()}>
                    {createComm.isPending ? "Saving..." : "Log Communication"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Timeline */}
          <div className="relative">
            <div className="absolute left-[19px] top-2 bottom-2 w-px bg-border/60" />
            <div className="space-y-1">
              {communications.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No communications logged yet.</p>
              ) : communications.map((comm: any, i: number) => {
                const config = commTypeConfig[comm.type] || commTypeConfig.note;
                const Icon = config.icon;
                return (
                  <div
                    key={comm.id}
                    className="relative flex items-start gap-3 pl-2 py-3 hover:bg-muted/10 rounded-xl transition-colors group animate-fade-in"
                    style={{ animationDelay: `${Math.min(i * 40, 300)}ms` }}
                  >
                    <div className={`relative z-10 w-9 h-9 rounded-xl ${config.bg} flex items-center justify-center shrink-0 ring-4 ring-background group-hover:scale-110 transition-transform duration-200`}>
                      <Icon className={`w-4 h-4 ${config.color}`} />
                    </div>
                    <div className="flex-1 min-w-0 bg-card rounded-xl border border-border/60 p-3.5 shadow-sm group-hover:shadow-card transition-shadow">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="font-medium text-sm text-card-foreground truncate">{comm.subject}</p>
                        <Badge variant="outline" className={`text-[9px] shrink-0 ${config.bg} ${config.color} border-0`}>{config.label}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{comm.clients?.company_name}</p>
                      {comm.content && <p className="text-xs text-muted-foreground/80 mt-1.5 line-clamp-2 leading-relaxed">{comm.content}</p>}
                      <p className="text-[10px] text-muted-foreground mt-2">{formatDistanceToNow(new Date(comm.created_at), { addSuffix: true })}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </TabsContent>

        {/* === PIPELINE TAB — Enhanced Kanban === */}
        <TabsContent value="pipeline" className="animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-medium text-card-foreground">{leads.length} leads</p>
              <p className="text-xs text-muted-foreground">£{totalPipelineValue.toLocaleString()} in active pipeline</p>
            </div>
            <Dialog open={leadDialogOpen} onOpenChange={setLeadDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2"><Plus className="w-4 h-4" /> Add Lead</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle>Add Lead to Pipeline</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-2">
                  <Select value={leadClientId} onValueChange={setLeadClientId}>
                    <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                    <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={leadStage} onValueChange={setLeadStage}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {pipelineStages.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input type="number" placeholder="Deal value (£)" value={leadValue} onChange={(e) => setLeadValue(e.target.value)} />
                  <Input type="date" placeholder="Expected close" value={leadCloseDate} onChange={(e) => setLeadCloseDate(e.target.value)} />
                  <Textarea placeholder="Notes..." value={leadNotes} onChange={(e) => setLeadNotes(e.target.value)} />
                  <Button className="w-full" disabled={!leadClientId || createLead.isPending} onClick={() => createLead.mutate()}>
                    {createLead.isPending ? "Adding..." : "Add Lead"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Pipeline funnel summary */}
          <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-2">
            {pipelineStages.map((stage, i) => {
              const count = leads.filter((l: any) => l.stage === stage.key).length;
              const value = leads.filter((l: any) => l.stage === stage.key).reduce((s: number, l: any) => s + (l.deal_value || 0), 0);
              return (
                <div key={stage.key} className="flex items-center">
                  <div className={`px-3 py-2 rounded-lg ${stage.color} text-center min-w-[90px]`}>
                    <p className="text-xs font-bold">{count}</p>
                    <p className="text-[9px] opacity-80">{stage.label}</p>
                    {value > 0 && <p className="text-[9px] font-semibold mt-0.5">£{value.toLocaleString()}</p>}
                  </div>
                  {i < pipelineStages.length - 1 && <ChevronRight className="w-4 h-4 text-muted-foreground/30 shrink-0 mx-0.5" />}
                </div>
              );
            })}
          </div>

          {/* Kanban columns */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {pipelineStages.map((stage, si) => {
              const stageLeads = leads.filter((l: any) => l.stage === stage.key);
              return (
                <div key={stage.key} className="space-y-2 animate-fade-in" style={{ animationDelay: `${si * 60}ms` }}>
                  <div className={`flex items-center justify-between px-2 py-1.5 rounded-lg border ${stage.accent} bg-card`}>
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${stage.color.split(' ')[1]}`}>{stage.label}</span>
                    <span className="text-[10px] font-bold text-muted-foreground bg-muted/50 rounded-full w-5 h-5 flex items-center justify-center">{stageLeads.length}</span>
                  </div>
                  <div className="space-y-2 min-h-[80px]">
                    {stageLeads.map((lead: any) => (
                      <div key={lead.id} className="bg-card rounded-xl border border-border/60 p-3 space-y-1.5 hover:shadow-card hover:border-border transition-all duration-200 group">
                        <p className="text-xs font-medium text-card-foreground truncate">{lead.clients?.company_name}</p>
                        {lead.deal_value > 0 && (
                          <p className="text-xs font-bold text-success flex items-center gap-1">
                            <ArrowUpRight className="w-3 h-3" />£{lead.deal_value.toLocaleString()}
                          </p>
                        )}
                        {lead.expected_close_date && (
                          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <CalendarClock className="w-3 h-3" />{format(new Date(lead.expected_close_date), "PP")}
                          </p>
                        )}
                        {lead.notes && <p className="text-[10px] text-muted-foreground/80 line-clamp-2">{lead.notes}</p>}
                        <Select value={lead.stage} onValueChange={(val) => updateLeadStage.mutate({ id: lead.id, stage: val })}>
                          <SelectTrigger className="h-6 text-[10px] mt-1 opacity-0 group-hover:opacity-100 transition-opacity"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {pipelineStages.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* === REMINDERS TAB === */}
        <TabsContent value="reminders" className="animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <p className="text-sm font-medium text-card-foreground">{pendingReminders.length} pending</p>
              {overdueReminders.length > 0 && (
                <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-[10px] gap-1">
                  <AlertTriangle className="w-3 h-3" />{overdueReminders.length} overdue
                </Badge>
              )}
            </div>
            <Dialog open={reminderDialogOpen} onOpenChange={setReminderDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2"><Plus className="w-4 h-4" /> New Reminder</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle>Create Follow-up Reminder</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-2">
                  <Select value={reminderClientId} onValueChange={setReminderClientId}>
                    <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                    <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input placeholder="Title" value={reminderTitle} onChange={(e) => setReminderTitle(e.target.value)} />
                  <Textarea placeholder="Description..." value={reminderDesc} onChange={(e) => setReminderDesc(e.target.value)} />
                  <Input type="datetime-local" value={reminderDue} onChange={(e) => setReminderDue(e.target.value)} />
                  <Button className="w-full" disabled={!reminderTitle.trim() || !reminderClientId || !reminderDue || createReminder.isPending} onClick={() => createReminder.mutate()}>
                    {createReminder.isPending ? "Creating..." : "Create Reminder"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div className="space-y-2">
            {reminders.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No reminders yet.</p>
            ) : reminders.map((r: any, i: number) => {
              const overdue = !r.is_completed && isPast(new Date(r.due_date)) && !isToday(new Date(r.due_date));
              const dueToday = !r.is_completed && isToday(new Date(r.due_date));
              return (
                <div
                  key={r.id}
                  className={`flex items-center gap-3 bg-card rounded-xl border p-4 transition-all duration-200 hover:shadow-card animate-fade-in ${
                    overdue ? "border-destructive/30 bg-destructive/[0.02]" : dueToday ? "border-warning/30 bg-warning/[0.02]" : "border-border"
                  } ${r.is_completed ? "opacity-50" : ""}`}
                  style={{ animationDelay: `${Math.min(i * 30, 200)}ms` }}
                >
                  <button
                    onClick={() => toggleReminder.mutate({ id: r.id, completed: !r.is_completed })}
                    className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
                      r.is_completed
                        ? "bg-success border-success text-white scale-100"
                        : "border-muted-foreground/40 hover:border-primary hover:scale-110"
                    }`}
                  >
                    {r.is_completed && <CheckCircle className="w-3 h-3" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${r.is_completed ? "line-through text-muted-foreground" : "text-card-foreground"}`}>{r.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">{r.clients?.company_name}</span>
                      {r.description && <span className="text-[10px] text-muted-foreground/70">· {r.description}</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-xs font-semibold ${overdue ? "text-destructive" : dueToday ? "text-warning" : "text-muted-foreground"}`}>
                      {overdue ? "Overdue" : dueToday ? "Today" : format(new Date(r.due_date), "PP")}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{format(new Date(r.due_date), "p")}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* === SATISFACTION TAB — With Charts === */}
        <TabsContent value="satisfaction" className="animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {/* Average Rating */}
            <div className="bg-card rounded-2xl border border-border p-6 text-center shadow-card">
              <div className="text-5xl font-bold font-display text-card-foreground">{avgRating}</div>
              <div className="flex items-center justify-center gap-1 mt-3">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} className={`w-5 h-5 transition-colors ${s <= Math.round(Number(avgRating) || 0) ? "text-warning fill-warning" : "text-muted/50"}`} />
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3">Average Rating · {ratings.length} reviews</p>
            </div>

            {/* Satisfaction Pie */}
            <div className="bg-card rounded-2xl border border-border p-6 shadow-card">
              <p className="text-sm font-semibold font-display text-card-foreground mb-2 text-center">Satisfaction Breakdown</p>
              {satisfactionPie.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={120}>
                    <PieChart>
                      <Pie data={satisfactionPie} cx="50%" cy="50%" innerRadius={35} outerRadius={50} paddingAngle={3} dataKey="value" strokeWidth={0} animationDuration={1000}>
                        {satisfactionPie.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          return (
                            <div className="bg-popover/95 backdrop-blur-md border border-border rounded-lg shadow-elevated p-2 text-xs">
                              <p className="font-semibold">{payload[0].name}: {payload[0].value}</p>
                            </div>
                          );
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex items-center justify-center gap-4 mt-2">
                    {satisfactionPie.map((d, i) => (
                      <span key={d.name} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CHART_COLORS[i] }} />
                        {d.name}
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-8">No data yet</p>
              )}
            </div>

            {/* Rating Distribution Bar */}
            <div className="bg-card rounded-2xl border border-border p-6 shadow-card">
              <p className="text-sm font-semibold font-display text-card-foreground mb-2 text-center">Rating Distribution</p>
              {ratings.length > 0 ? (
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={ratingDistribution} barSize={24}>
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} width={20} />
                    <Bar dataKey="value" fill="hsl(var(--warning))" radius={[6, 6, 0, 0]} animationDuration={1000} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-8">No data yet</p>
              )}
            </div>
          </div>

          {/* Reviews list */}
          <div className="space-y-2">
            {ratings.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No ratings yet.</p>
            ) : ratings.map((r: any, i: number) => (
              <div
                key={r.id}
                className="flex items-start gap-3 bg-card rounded-xl border border-border p-4 hover:shadow-card transition-shadow animate-fade-in"
                style={{ animationDelay: `${Math.min(i * 40, 200)}ms` }}
              >
                <div className={`p-2 rounded-xl shrink-0 ${r.rating >= 4 ? "bg-success/10 text-success" : r.rating >= 3 ? "bg-warning/10 text-warning" : "bg-destructive/10 text-destructive"}`}>
                  {r.rating >= 4 ? <Smile className="w-4 h-4" /> : r.rating >= 3 ? <Meh className="w-4 h-4" /> : <Frown className="w-4 h-4" />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star key={s} className={`w-3.5 h-3.5 ${s <= r.rating ? "text-warning fill-warning" : "text-muted/40"}`} />
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground font-medium">{r.clients?.company_name}</span>
                  </div>
                  {r.review && <p className="text-sm text-card-foreground mt-1.5 leading-relaxed">{r.review}</p>}
                  <p className="text-[10px] text-muted-foreground mt-1.5">{formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</p>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* === CLIENTS TAB === */}
        <TabsContent value="clients" className="animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {clients.length === 0 ? (
              <p className="text-muted-foreground col-span-full text-center py-8">No clients found.</p>
            ) : clients.map((client, i) => {
              const clientTickets = tickets.filter((t: any) => t.client_id === client.id);
              const openCount = clientTickets.filter((t: any) => t.status === "open" || t.status === "in_progress").length;
              const clientComms = communications.filter((c: any) => c.client_id === client.id);
              const clientLeads = leads.filter((l: any) => l.client_id === client.id);
              const clientRatings = ratings.filter((r: any) => r.client_id === client.id);
              const clientAvgRating = clientRatings.length > 0
                ? (clientRatings.reduce((s: number, r: any) => s + r.rating, 0) / clientRatings.length).toFixed(1)
                : null;
              return (
                <div
                  key={client.id}
                  className="bg-card rounded-2xl border border-border p-5 hover:shadow-elevated hover:border-primary/10 transition-all duration-300 group animate-fade-in"
                  style={{ animationDelay: `${Math.min(i * 40, 300)}ms` }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                        <Building2 className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold font-display text-card-foreground">{client.company_name}</p>
                        <p className="text-xs text-muted-foreground">{client.contact_name}</p>
                      </div>
                    </div>
                    {openCount > 0 && (
                      <Badge variant="outline" className="bg-warning/10 text-warning text-[10px] border-warning/20">{openCount} open</Badge>
                    )}
                  </div>
                  <div className="space-y-1 text-xs text-muted-foreground mb-3">
                    <p className="flex items-center gap-1.5"><Mail className="w-3 h-3" />{client.email}</p>
                    {client.phone && <p className="flex items-center gap-1.5"><Phone className="w-3 h-3" />{client.phone}</p>}
                  </div>
                  <div className="pt-3 flex items-center gap-3 border-t border-border/40 flex-wrap text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" />{clientTickets.length}</span>
                    <span className="flex items-center gap-1"><FileText className="w-3 h-3" />{clientComms.length}</span>
                    <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" />{clientLeads.length}</span>
                    {clientAvgRating && (
                      <span className="flex items-center gap-1 text-warning"><Star className="w-3 h-3 fill-warning" />{clientAvgRating}</span>
                    )}
                    <span className="ml-auto">Since {format(new Date(client.created_at), "MMM yyyy")}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
};

export default CRM;