import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Bell, CheckCheck, Trash2, Briefcase, AlertTriangle, Info,
  MessageSquare, FileText, Receipt, Clock, Mail, Moon, Filter,
  Search, MailOpen, X, CheckSquare,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const typeConfig: Record<string, { icon: typeof Info; color: string; label: string }> = {
  job_assigned: { icon: Briefcase, color: "bg-primary/10 text-primary", label: "Job Assigned" },
  job_status: { icon: Info, color: "bg-blue-500/10 text-blue-500", label: "Job Status" },
  new_ticket: { icon: AlertTriangle, color: "bg-amber-500/10 text-amber-500", label: "New Ticket" },
  ticket_update: { icon: MessageSquare, color: "bg-purple-500/10 text-purple-500", label: "Ticket Update" },
  sla_breach: { icon: AlertTriangle, color: "bg-destructive/10 text-destructive", label: "SLA Breach" },
  sla_risk: { icon: AlertTriangle, color: "bg-amber-500/10 text-amber-500", label: "SLA Risk" },
  job_reassigned: { icon: Briefcase, color: "bg-purple-500/10 text-purple-500", label: "Reassigned" },
  job_cancelled: { icon: AlertTriangle, color: "bg-destructive/10 text-destructive", label: "Cancelled" },
  escalation: { icon: AlertTriangle, color: "bg-destructive/10 text-destructive", label: "Escalation" },
  estimate_update: { icon: FileText, color: "bg-emerald-500/10 text-emerald-500", label: "Estimate" },
  invoice_update: { icon: Receipt, color: "bg-cyan-500/10 text-cyan-500", label: "Invoice" },
  info: { icon: Info, color: "bg-muted text-muted-foreground", label: "General" },
};

const formatTime = (dateStr: string) => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

const Notifications = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [readFilter, setReadFilter] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);

  // ── Notifications history ──
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["notifications-history", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // ── Preferences ──
  const { data: prefs } = useQuery({
    queryKey: ["notification-prefs", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  type PrefsUpdate = Partial<Omit<NonNullable<typeof prefs>, "id" | "created_at" | "updated_at" | "user_id">>;

  const savePrefsMutation = useMutation({
    mutationFn: async (updates: PrefsUpdate) => {
      if (prefs) {
        const { error } = await supabase
          .from("notification_preferences")
          .update(updates)
          .eq("user_id", user!.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("notification_preferences")
          .insert({ user_id: user!.id, ...updates });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notification-prefs"] });
      toast.success("Preferences saved");
    },
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications-history"] }),
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user!.id)
        .eq("is_read", false);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications-history"] });
      toast.success("All notifications marked as read");
    },
  });

  const deleteReadMutation = useMutation({
    mutationFn: async () => {
      await supabase
        .from("notifications")
        .delete()
        .eq("user_id", user!.id)
        .eq("is_read", true);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications-history"] });
      toast.success("Read notifications cleared");
    },
  });

  const markUnreadMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("notifications").update({ is_read: false }).eq("id", id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications-history"] }),
  });

  const deleteOneMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("notifications").delete().eq("id", id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications-history"] }),
  });

  const deleteAllMutation = useMutation({
    mutationFn: async () => {
      await supabase.from("notifications").delete().eq("user_id", user!.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications-history"] });
      setSelected(new Set());
      toast.success("All notifications cleared");
    },
  });

  const bulkMutation = useMutation({
    mutationFn: async (action: "read" | "unread" | "delete") => {
      const ids = Array.from(selected);
      if (!ids.length) return;
      if (action === "delete") {
        await supabase.from("notifications").delete().in("id", ids);
      } else {
        await supabase
          .from("notifications")
          .update({ is_read: action === "read" })
          .in("id", ids);
      }
    },
    onSuccess: (_d, action) => {
      qc.invalidateQueries({ queryKey: ["notifications-history"] });
      const n = selected.size;
      setSelected(new Set());
      toast.success(
        action === "delete"
          ? `${n} notification${n === 1 ? "" : "s"} deleted`
          : action === "read"
          ? `${n} marked as read`
          : `${n} marked as unread`,
      );
    },
  });

  const filtered = useMemo(() => {
    return notifications.filter((n) => {
      if (typeFilter !== "all" && n.type !== typeFilter) return false;
      if (readFilter === "unread" && n.is_read) return false;
      if (readFilter === "read" && !n.is_read) return false;
      if (search && !n.title.toLowerCase().includes(search.toLowerCase()) && !n.message.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [notifications, typeFilter, readFilter, search]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const togglePref = (key: string) => {
    const current = prefs?.[key as keyof typeof prefs] ?? true;
    savePrefsMutation.mutate({ [key]: !current });
  };

  const alertPrefs = [
    { key: "job_assigned", label: "Job Assignments", desc: "When a job is assigned to you or your team" },
    { key: "job_status_change", label: "Job Status Changes", desc: "When a job status is updated" },
    { key: "sla_risk", label: "SLA Risk", desc: "When a job is approaching its SLA window" },
    { key: "sla_breach", label: "SLA Breaches", desc: "When an SLA target is missed" },
    { key: "escalation", label: "Escalations", desc: "When a job is escalated to higher tiers" },
    { key: "job_reassigned", label: "Job Reassignments", desc: "When a job is moved to a different engineer" },
    { key: "job_cancelled", label: "Job Cancellations", desc: "When a job is cancelled" },
    { key: "new_ticket", label: "New Tickets", desc: "When a new support ticket is created" },
    { key: "ticket_update", label: "Ticket Updates", desc: "When a ticket is updated or resolved" },
    { key: "estimate_update", label: "Estimate Updates", desc: "When an estimate is sent or approved" },
    { key: "invoice_update", label: "Invoice Updates", desc: "When an invoice is paid or overdue" },
  ];

  const rolePrefs = [
    { key: "push_role_client", label: "Client role", desc: "Push notifications you receive as a client (job updates on your tickets)" },
    { key: "push_role_engineer", label: "Engineer role", desc: "Push notifications you receive as an assigned engineer" },
    { key: "push_role_team_lead", label: "Team lead role", desc: "Push notifications for jobs and SLAs in teams you lead" },
    { key: "push_role_admin", label: "Admin role", desc: "Push notifications for system-wide escalations and approvals" },
  ];

  return (
    <AppLayout title="Notifications" subtitle="Manage alerts, preferences, and notification history">
      <Tabs defaultValue="history" className="space-y-6">
        <TabsList>
          <TabsTrigger value="history" className="gap-1.5">
            <Bell className="w-4 h-4" />
            History
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 min-w-[20px] text-[10px]">
                {unreadCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="preferences" className="gap-1.5">
            <Filter className="w-4 h-4" />
            Alert Preferences
          </TabsTrigger>
          <TabsTrigger value="digest" className="gap-1.5">
            <Mail className="w-4 h-4" />
            Email Digest
          </TabsTrigger>
        </TabsList>

        {/* ── History Tab ── */}
        <TabsContent value="history" className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search notifications..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-9 w-56 text-sm"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[150px] h-9 text-sm">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {Object.entries(typeConfig).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={readFilter} onValueChange={setReadFilter}>
                <SelectTrigger className="w-[120px] h-9 text-sm">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="unread">Unread</SelectItem>
                  <SelectItem value="read">Read</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={selectMode ? "secondary" : "ghost"}
                onClick={() => {
                  setSelectMode((v) => !v);
                  setSelected(new Set());
                }}
              >
                <CheckSquare className="w-3.5 h-3.5 mr-1.5" />
                {selectMode ? "Cancel" : "Select"}
              </Button>
              {unreadCount > 0 && (
                <Button size="sm" variant="outline" onClick={() => markAllReadMutation.mutate()}>
                  <CheckCheck className="w-3.5 h-3.5 mr-1.5" /> Mark all read
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => deleteReadMutation.mutate()} className="text-muted-foreground">
                <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Clear read
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    disabled={notifications.length === 0}
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Clear all
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear all notifications?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This permanently deletes every notification in your history (read and unread).
                      This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deleteAllMutation.mutate()}>
                      Clear all
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          {selectMode && (
            <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
              <Checkbox
                checked={
                  filtered.length > 0 && filtered.every((n) => selected.has(n.id))
                    ? true
                    : filtered.some((n) => selected.has(n.id))
                    ? "indeterminate"
                    : false
                }
                onCheckedChange={(c) => {
                  if (c) setSelected(new Set(filtered.map((n) => n.id)));
                  else setSelected(new Set());
                }}
              />
              <span className="text-muted-foreground">
                {selected.size} selected
              </span>
              <div className="ml-auto flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!selected.size}
                  onClick={() => bulkMutation.mutate("read")}
                >
                  <CheckCheck className="w-3.5 h-3.5 mr-1.5" /> Mark read
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!selected.size}
                  onClick={() => bulkMutation.mutate("unread")}
                >
                  <MailOpen className="w-3.5 h-3.5 mr-1.5" /> Mark unread
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  disabled={!selected.size}
                  onClick={() => bulkMutation.mutate("delete")}
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete
                </Button>
              </div>
            </div>
          )}

          <Card>
            <ScrollArea className="h-[520px]">
              {isLoading ? (
                <div className="py-12 text-center text-sm text-muted-foreground">Loading notifications...</div>
              ) : filtered.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  {notifications.length === 0 ? "No notifications yet" : "No notifications match your filters"}
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {filtered.map((n) => {
                    const cfg = typeConfig[n.type] ?? typeConfig.info;
                    const Icon = cfg.icon;
                    const isSelected = selected.has(n.id);
                    const handleRowClick = () => {
                      if (selectMode) {
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (next.has(n.id)) next.delete(n.id);
                          else next.add(n.id);
                          return next;
                        });
                      } else if (!n.is_read) {
                        markReadMutation.mutate(n.id);
                      }
                    };
                    return (
                      <div
                        key={n.id}
                        role="button"
                        tabIndex={0}
                        onClick={handleRowClick}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleRowClick();
                          }
                        }}
                        className={`group w-full text-left px-5 py-4 flex gap-4 hover:bg-muted/50 transition-colors cursor-pointer ${
                          !n.is_read ? "bg-primary/[0.03]" : ""
                        } ${isSelected ? "bg-primary/[0.07]" : ""}`}
                      >
                        {selectMode && (
                          <div
                            className="flex items-center"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(c) => {
                                setSelected((prev) => {
                                  const next = new Set(prev);
                                  if (c) next.add(n.id);
                                  else next.delete(n.id);
                                  return next;
                                });
                              }}
                            />
                          </div>
                        )}
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${cfg.color}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-foreground truncate">{n.title}</p>
                            {!n.is_read && <span className="w-2 h-2 rounded-full bg-primary shrink-0" />}
                            <Badge variant="outline" className="text-[10px] ml-auto shrink-0">{cfg.label}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                          <p className="text-[10px] text-muted-foreground mt-1.5 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {formatTime(n.created_at)}
                          </p>
                        </div>
                        {!selectMode && (
                          <div
                            className="flex items-start gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              title={n.is_read ? "Mark as unread" : "Mark as read"}
                              onClick={() =>
                                n.is_read
                                  ? markUnreadMutation.mutate(n.id)
                                  : markReadMutation.mutate(n.id)
                              }
                            >
                              {n.is_read ? (
                                <MailOpen className="w-3.5 h-3.5" />
                              ) : (
                                <CheckCheck className="w-3.5 h-3.5" />
                              )}
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              title="Delete"
                              onClick={() => deleteOneMutation.mutate(n.id)}
                            >
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </Card>
        </TabsContent>

        {/* ── Alert Preferences Tab ── */}
        <TabsContent value="preferences" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Alert Preferences</CardTitle>
              <CardDescription>Choose which events trigger in-app notifications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {alertPrefs.map((p) => (
                <div key={p.key} className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">{p.label}</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">{p.desc}</p>
                  </div>
                  <Switch
                    checked={(prefs?.[p.key as keyof typeof prefs] as boolean) ?? true}
                    onCheckedChange={() => togglePref(p.key)}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Push by Role</CardTitle>
              <CardDescription>
                Mute push notifications you receive for a specific role context. In-app notifications
                are still recorded in your history.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {rolePrefs.map((p) => (
                <div key={p.key} className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">{p.label}</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">{p.desc}</p>
                  </div>
                  <Switch
                    checked={(prefs?.[p.key as keyof typeof prefs] as boolean) ?? true}
                    onCheckedChange={() => togglePref(p.key)}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Moon className="w-4 h-4" /> Quiet Hours
              </CardTitle>
              <CardDescription>Silence non-critical notifications during these hours</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Enable Quiet Hours</Label>
                <Switch
                  checked={prefs?.quiet_hours_enabled ?? false}
                  onCheckedChange={() =>
                    savePrefsMutation.mutate({ quiet_hours_enabled: !(prefs?.quiet_hours_enabled ?? false) })
                  }
                />
              </div>
              {(prefs?.quiet_hours_enabled ?? false) && (
                <>
                  <div className="flex gap-4 items-center">
                    <div className="flex-1">
                      <Label className="text-xs text-muted-foreground">Start</Label>
                      <Input
                        type="time"
                        value={prefs?.quiet_hours_start ?? "22:00"}
                        onChange={(e) => savePrefsMutation.mutate({ quiet_hours_start: e.target.value })}
                        className="h-9 text-sm"
                      />
                    </div>
                    <div className="flex-1">
                      <Label className="text-xs text-muted-foreground">End</Label>
                      <Input
                        type="time"
                        value={prefs?.quiet_hours_end ?? "07:00"}
                        onChange={(e) => savePrefsMutation.mutate({ quiet_hours_end: e.target.value })}
                        className="h-9 text-sm"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t">
                    <div>
                      <Label className="text-sm font-medium">Allow critical alerts</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        SLA risk, SLA breach, escalations and cancellations will still come through during quiet hours.
                      </p>
                    </div>
                    <Switch
                      checked={prefs?.quiet_hours_allow_critical ?? true}
                      onCheckedChange={() =>
                        savePrefsMutation.mutate({
                          quiet_hours_allow_critical: !(prefs?.quiet_hours_allow_critical ?? true),
                        })
                      }
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Email Digest Tab ── */}
        <TabsContent value="digest" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Mail className="w-4 h-4" /> Email Digest
              </CardTitle>
              <CardDescription>
                Receive a summary of notifications via email at your preferred frequency
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Enable Email Digest</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Get a periodic email summary of missed notifications
                  </p>
                </div>
                <Switch
                  checked={prefs?.email_digest_enabled ?? false}
                  onCheckedChange={() =>
                    savePrefsMutation.mutate({ email_digest_enabled: !(prefs?.email_digest_enabled ?? false) })
                  }
                />
              </div>
              {(prefs?.email_digest_enabled ?? false) && (
                <div>
                  <Label className="text-xs text-muted-foreground">Digest Frequency</Label>
                  <Select
                    value={prefs?.email_digest_frequency ?? "daily"}
                    onValueChange={(v) => savePrefsMutation.mutate({ email_digest_frequency: v })}
                  >
                    <SelectTrigger className="w-[200px] h-9 text-sm mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="realtime">Real-time</SelectItem>
                      <SelectItem value="hourly">Hourly</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
};

export default Notifications;
