import { useState, useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import EditJobDialog from "@/components/jobs/EditJobDialog";
import JobStatusBadge from "@/components/dashboard/JobStatusBadge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Pencil, Copy, Trash2, Upload, Download, FileText, MessageSquarePlus, History, Repeat2, ArrowRight, CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { formatDistanceToNow, format } from "date-fns";
import PayoutBreakdown from "@/components/payouts/PayoutBreakdown";
import PayoutStatusBadge from "@/components/payouts/PayoutStatusBadge";
import PayoutClaimsPanel from "@/components/payouts/PayoutClaimsPanel";
import JobPayoutTotals from "@/components/payouts/JobPayoutTotals";

export default function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [uploading, setUploading] = useState(false);

  const { data: job, isLoading } = useQuery({
    queryKey: ["job-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("jobs").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: client } = useQuery({
    queryKey: ["job-detail-client", job?.client_id],
    queryFn: async () => {
      if (!job?.client_id) return null;
      const { data } = await supabase.from("clients").select("id, company_name").eq("id", job.client_id).maybeSingle();
      return data;
    },
    enabled: !!job?.client_id,
  });

  const { data: engineerProfile } = useQuery({
    queryKey: ["job-detail-engineer", job?.engineer_id],
    queryFn: async () => {
      if (!job?.engineer_id) return null;
      const { data: e } = await supabase.from("engineers").select("user_id").eq("id", job.engineer_id).maybeSingle();
      if (!e) return null;
      const { data: p } = await supabase.from("profiles").select("full_name, email").eq("user_id", e.user_id).maybeSingle();
      return p;
    },
    enabled: !!job?.engineer_id,
  });

  const { data: notes = [] } = useQuery({
    queryKey: ["job-notes", id],
    queryFn: async () => {
      const { data } = await supabase.from("job_notes").select("*").eq("job_id", id!).order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!id,
  });

  const { data: attachments = [] } = useQuery({
    queryKey: ["job-attachments", id],
    queryFn: async () => {
      const { data } = await supabase.from("job_attachments").select("*").eq("job_id", id!).order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!id,
  });

  const { data: activity = [] } = useQuery({
    queryKey: ["job-activity", id],
    queryFn: async () => {
      const { data } = await supabase.from("job_activity_log").select("*").eq("job_id", id!).order("created_at", { ascending: false }).limit(200);
      return data ?? [];
    },
    enabled: !!id,
  });

  const { data: payoutClaimTotals = { approved: 0, pending: 0 } } = useQuery({
    queryKey: ["job-payout-claim-totals", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("job_payout_claims")
        .select("amount, status")
        .eq("job_id", id!);
      const rows = (data ?? []) as { amount: number; status: string }[];
      return rows.reduce(
        (acc, r) => {
          if (r.status === "approved") acc.approved += Number(r.amount);
          else if (r.status === "pending") acc.pending += Number(r.amount);
          return acc;
        },
        { approved: 0, pending: 0 }
      );
    },
    enabled: !!id,
  });

  const { data: reassignments = [] } = useQuery({
    queryKey: ["job-reassignments", id],
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("job_reassignments" as never)
        .select("*")
        .eq("job_id", id!)
        .order("created_at", { ascending: false })
        .limit(50);
      const list = (rows ?? []) as Array<{
        id: string;
        previous_engineer_id: string | null;
        new_engineer_id: string | null;
        match_score: number | null;
        distance_km: number | null;
        reason: string | null;
        triggered_kind: string;
        triggered_by: string | null;
        created_at: string;
      }>;
      const engIds = Array.from(new Set(list.flatMap(r => [r.previous_engineer_id, r.new_engineer_id]).filter(Boolean) as string[]));
      const userIds = Array.from(new Set(list.map(r => r.triggered_by).filter(Boolean) as string[]));
      let nameByEngId: Record<string, string> = {};
      let nameByUserId: Record<string, string> = {};
      if (engIds.length) {
        const { data: engs } = await supabase.from("engineers").select("id, user_id").in("id", engIds);
        const allUserIds = Array.from(new Set([...(engs ?? []).map(e => e.user_id), ...userIds].filter(Boolean) as string[]));
        const { data: profs } = await supabase.from("profiles").select("user_id, full_name").in("user_id", allUserIds);
        const profMap = Object.fromEntries((profs ?? []).map(p => [p.user_id, p.full_name ?? "Unknown"]));
        nameByEngId = Object.fromEntries((engs ?? []).map(e => [e.id, profMap[e.user_id] ?? "Unknown"]));
        nameByUserId = profMap;
      } else if (userIds.length) {
        const { data: profs } = await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds);
        nameByUserId = Object.fromEntries((profs ?? []).map(p => [p.user_id, p.full_name ?? "Unknown"]));
      }
      return list.map(r => ({
        ...r,
        previous_name: r.previous_engineer_id ? nameByEngId[r.previous_engineer_id] ?? "Unknown" : "Unassigned",
        new_name: r.new_engineer_id ? nameByEngId[r.new_engineer_id] ?? "Unknown" : "Unassigned",
        actor_name: r.triggered_by ? nameByUserId[r.triggered_by] ?? "System" : "System",
      }));
    },
    enabled: !!id,
  });

  const cloneMutation = useMutation({
    mutationFn: async () => {
      if (!job) return null;
      const { data, error } = await supabase.from("jobs").insert({
        title: `${job.title} (copy)`,
        description: job.description,
        service_type: job.service_type,
        client_id: job.client_id,
        location: job.location,
        priority: job.priority,
        geofence_radius: job.geofence_radius,
        region_id: job.region_id,
        latitude: job.latitude,
        longitude: job.longitude,
      }).select("id").single();
      if (error) throw error;
      return data;
    },
    onSuccess: (d) => { toast.success("Job duplicated"); if (d?.id) navigate(`/jobs/${d.id}`); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("jobs").delete().eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Job deleted"); navigate("/jobs"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const addNoteMutation = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not authenticated");
      const { error } = await supabase.from("job_notes").insert({
        job_id: id!,
        author_id: u.user.id,
        content: noteText.trim(),
        is_internal: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNoteText("");
      queryClient.invalidateQueries({ queryKey: ["job-notes", id] });
      toast.success("Note added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      const { error } = await supabase.from("job_notes").delete().eq("id", noteId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["job-notes", id] }),
  });

  const handleUpload = async (file: File) => {
    if (!file || !id) return;
    setUploading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not authenticated");
      const path = `${id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error: uploadErr } = await supabase.storage.from("job-attachments").upload(path, file);
      if (uploadErr) throw uploadErr;
      const { error: insErr } = await supabase.from("job_attachments").insert({
        job_id: id,
        uploaded_by: u.user.id,
        file_path: path,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
      });
      if (insErr) throw insErr;
      queryClient.invalidateQueries({ queryKey: ["job-attachments", id] });
      toast.success("File uploaded");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const downloadAttachment = async (path: string, name: string) => {
    const { data, error } = await supabase.storage.from("job-attachments").createSignedUrl(path, 60);
    if (error) { toast.error(error.message); return; }
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.download = name;
    a.click();
  };

  const deleteAttachment = useMutation({
    mutationFn: async (att: { id: string; file_path: string }) => {
      await supabase.storage.from("job-attachments").remove([att.file_path]);
      const { error } = await supabase.from("job_attachments").delete().eq("id", att.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job-attachments", id] });
      toast.success("Attachment deleted");
    },
  });

  if (isLoading) return <AppLayout title="Job"><p className="text-sm text-muted-foreground">Loading…</p></AppLayout>;
  if (!job) return <AppLayout title="Job not found"><Button asChild variant="outline"><Link to="/jobs"><ArrowLeft className="w-4 h-4 mr-1" />Back</Link></Button></AppLayout>;

  return (
    <AppLayout title={job.title} subtitle={`Job ${job.id.slice(0, 8)}`}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/jobs"><ArrowLeft className="w-4 h-4 mr-1" />All jobs</Link>
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => cloneMutation.mutate()} disabled={cloneMutation.isPending}>
              <Copy className="w-4 h-4 mr-1" />Duplicate
            </Button>
            <Button size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="w-4 h-4 mr-1" />Edit
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="w-4 h-4 mr-1" />Delete
            </Button>
          </div>
        </div>

        <Card className="p-5 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <JobStatusBadge status={job.status} />
            <Badge variant="outline" className="capitalize">{job.priority}</Badge>
            <Badge variant="secondary">{job.service_type}</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div><span className="text-muted-foreground">Client:</span> {client?.company_name ?? "—"}</div>
            <div><span className="text-muted-foreground">Engineer:</span> {engineerProfile?.full_name ?? "Unassigned"}</div>
            <div><span className="text-muted-foreground">Location:</span> {job.location}</div>
            <div><span className="text-muted-foreground">Scheduled:</span> {job.scheduled_at ? format(new Date(job.scheduled_at), "PPp") : "—"}</div>
            <div><span className="text-muted-foreground">Total Price:</span> {job.total_price ? `$${Number(job.total_price).toLocaleString()}` : "—"}</div>
            <div><span className="text-muted-foreground">Geofence:</span> {job.geofence_radius ?? 200}m</div>
          </div>
          {job.description && (
            <div className="text-sm">
              <p className="text-muted-foreground mb-1">Description</p>
              <p className="whitespace-pre-wrap">{job.description}</p>
            </div>
          )}
        </Card>

        <Card className="p-4 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2 gap-2">
              <div className="text-sm font-medium">Payout breakdown</div>
              <PayoutStatusBadge
                source={{
                  payout_status: job.payout_status,
                  payout_paid_amount: job.payout_paid_amount,
                  payout_approved_at: job.payout_approved_at,
                  payout_paid_at: job.payout_paid_at,
                  engineer_net: job.engineer_net,
                }}
                showTimestamps
              />
            </div>
            <PayoutBreakdown source={{
              base_pay: job.engineer_charge ?? job.base_price ?? 0,
              transport_allowance: job.transport_allowance,
              food_allowance: job.food_allowance,
              convenience_allowance: job.convenience_allowance,
              partner_split_percent: job.partner_split_percent,
              platform_split_percent: job.platform_split_percent,
              gross_payout: job.gross_payout,
              partner_cut: job.partner_cut,
              platform_cut: job.platform_cut,
              engineer_net: job.engineer_net,
            }} />
          </div>

          <JobPayoutTotals
            engineerNet={Number(job.engineer_net ?? 0)}
            approvedClaims={payoutClaimTotals.approved}
            pendingClaims={payoutClaimTotals.pending}
          />

          {job?.engineer_id && (
            <div className="border-t pt-4">
              <PayoutClaimsPanel
                jobId={job.id}
                engineerId={job.engineer_id}
                canSubmit={true}
              />
            </div>
          )}
        </Card>


        <Tabs defaultValue="notes">
          <TabsList>
            <TabsTrigger value="notes"><MessageSquarePlus className="w-4 h-4 mr-1" />Notes ({notes.length})</TabsTrigger>
            <TabsTrigger value="attachments"><FileText className="w-4 h-4 mr-1" />Attachments ({attachments.length})</TabsTrigger>
            <TabsTrigger value="activity"><History className="w-4 h-4 mr-1" />Activity ({activity.length})</TabsTrigger>
            <TabsTrigger value="reassignments"><Repeat2 className="w-4 h-4 mr-1" />Reassignments ({reassignments.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="notes" className="space-y-3">
            <Card className="p-4 space-y-2">
              <Textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Add an internal note…" rows={3} />
              <div className="flex justify-end">
                <Button size="sm" disabled={!noteText.trim() || addNoteMutation.isPending} onClick={() => addNoteMutation.mutate()}>
                  Post note
                </Button>
              </div>
            </Card>
            {notes.length === 0 && <p className="text-sm text-muted-foreground">No notes yet.</p>}
            {notes.map(n => (
              <Card key={n.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-sm whitespace-pre-wrap">{n.content}</p>
                    <p className="text-xs text-muted-foreground mt-2">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteNoteMutation.mutate(n.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="attachments" className="space-y-3">
            <Card className="p-4">
              <Label htmlFor="upload" className="text-sm font-medium">Upload a file</Label>
              <div className="flex items-center gap-2 mt-2">
                <Input id="upload" type="file" disabled={uploading} onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }} />
                <Upload className="w-4 h-4 text-muted-foreground" />
              </div>
            </Card>
            {attachments.length === 0 && <p className="text-sm text-muted-foreground">No attachments.</p>}
            {attachments.map(a => (
              <Card key={a.id} className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm truncate">{a.file_name}</p>
                    <p className="text-xs text-muted-foreground">{a.file_size ? `${(a.file_size / 1024).toFixed(1)} KB` : ""} · {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}</p>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => downloadAttachment(a.file_path, a.file_name)}>
                    <Download className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteAttachment.mutate({ id: a.id, file_path: a.file_path })}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="activity" className="space-y-2">
            {activity.length === 0 && <p className="text-sm text-muted-foreground">No activity recorded.</p>}
            {activity.map(a => (
              <div key={a.id} className="flex items-start gap-3 text-sm border-l-2 border-border pl-3 py-1">
                <div className="flex-1">
                  <p>
                    <span className="font-medium capitalize">{a.action}</span>
                    {a.field && <> · <span className="text-muted-foreground">{a.field}</span>: <span className="line-through text-muted-foreground">{a.old_value ?? "—"}</span> → <span>{a.new_value ?? "—"}</span></>}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}</p>
                </div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="reassignments" className="space-y-2">
            <ReassignmentsFilters reassignments={reassignments} />
          </TabsContent>
        </Tabs>
      </div>

      <EditJobDialog job={job} open={editOpen} onOpenChange={setEditOpen} />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this job?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMutation.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}

function Label({ children, className = "", htmlFor }: { children: React.ReactNode; className?: string; htmlFor?: string }) {
  return <label htmlFor={htmlFor} className={`block text-sm ${className}`}>{children}</label>;
}

type ReassignmentRow = {
  id: string;
  previous_engineer_id: string | null;
  new_engineer_id: string | null;
  match_score: number | null;
  distance_km: number | null;
  reason: string | null;
  triggered_kind: string;
  triggered_by: string | null;
  created_at: string;
  previous_name: string;
  new_name: string;
  actor_name: string;
};

function ReassignmentsFilters({ reassignments }: { reassignments: ReassignmentRow[] }) {
  const [kind, setKind] = useState<string>("all");
  const [engineer, setEngineer] = useState<string>("all");
  const [actor, setActor] = useState<string>("all");
  const [reasonQuery, setReasonQuery] = useState<string>("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  const engineers = useMemo(() => {
    const set = new Set<string>();
    reassignments.forEach(r => { if (r.previous_name) set.add(r.previous_name); if (r.new_name) set.add(r.new_name); });
    return Array.from(set).sort();
  }, [reassignments]);

  const actors = useMemo(() => Array.from(new Set(reassignments.map(r => r.actor_name).filter(Boolean))).sort(), [reassignments]);

  const filtered = useMemo(() => reassignments.filter(r => {
    if (kind !== "all" && r.triggered_kind !== kind) return false;
    if (engineer !== "all" && r.previous_name !== engineer && r.new_name !== engineer) return false;
    if (actor !== "all" && r.actor_name !== actor) return false;
    if (reasonQuery.trim() && !(r.reason ?? "").toLowerCase().includes(reasonQuery.trim().toLowerCase())) return false;
    if (dateRange?.from) {
      const t = new Date(r.created_at).getTime();
      const from = new Date(dateRange.from); from.setHours(0, 0, 0, 0);
      if (t < from.getTime()) return false;
      if (dateRange.to) {
        const to = new Date(dateRange.to); to.setHours(23, 59, 59, 999);
        if (t > to.getTime()) return false;
      }
    }
    return true;
  }), [reassignments, kind, engineer, actor, reasonQuery, dateRange]);

  const resetAll = () => { setKind("all"); setEngineer("all"); setActor("all"); setReasonQuery(""); setDateRange(undefined); };
  const hasFilters = kind !== "all" || engineer !== "all" || actor !== "all" || reasonQuery.trim() !== "" || !!dateRange?.from;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-2 p-2 border rounded-md bg-muted/20">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Trigger</Label>
          <Select value={kind} onValueChange={setKind}>
            <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="auto">Auto</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Engineer</Label>
          <Select value={engineer} onValueChange={setEngineer}>
            <SelectTrigger className="h-8 w-44 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All engineers</SelectItem>
              {engineers.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Actor</Label>
          <Select value={actor} onValueChange={setActor}>
            <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actors</SelectItem>
              {actors.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 flex-1 min-w-[180px]">
          <Label className="text-xs text-muted-foreground">Reason contains</Label>
          <Input value={reasonQuery} onChange={e => setReasonQuery(e.target.value)} placeholder="Search reason…" className="h-8 text-xs" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Date range</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn("h-8 justify-start text-left font-normal text-xs w-[220px]", !dateRange?.from && "text-muted-foreground")}
              >
                <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                {dateRange?.from ? (
                  dateRange.to ? (
                    <>{format(dateRange.from, "LLL d, y")} – {format(dateRange.to, "LLL d, y")}</>
                  ) : (
                    format(dateRange.from, "LLL d, y")
                  )
                ) : (
                  <span>Any date</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={dateRange}
                onSelect={setDateRange}
                numberOfMonths={2}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </div>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={resetAll} className="h-8 text-xs">Clear</Button>
        )}
      </div>

      <div className="text-xs text-muted-foreground">
        Showing {filtered.length} of {reassignments.length}
      </div>

      {filtered.length === 0 && (
        <p className="text-sm text-muted-foreground">{reassignments.length === 0 ? "No reassignments yet." : "No reassignments match the current filters."}</p>
      )}
      {filtered.map(r => (
        <Card key={r.id} className="p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium truncate">{r.previous_name}</span>
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="font-medium truncate">{r.new_name}</span>
                <Badge variant={r.triggered_kind === "auto" ? "secondary" : "outline"} className="text-[10px] capitalize">
                  {r.triggered_kind}
                </Badge>
              </div>
              {r.reason && <p className="text-xs text-muted-foreground">{r.reason}</p>}
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>{formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</span>
                <span>· {new Date(r.created_at).toLocaleString()}</span>
                {r.match_score != null && <span>· score {r.match_score}</span>}
                {r.distance_km != null && <span>· {r.distance_km} km</span>}
                <span>· by {r.actor_name}</span>
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
