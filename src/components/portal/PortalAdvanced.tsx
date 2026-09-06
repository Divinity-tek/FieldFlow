import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Users, MapPin, FileText, CreditCard, Bell, ShieldCheck, MessageSquare,
  History, Palette, BarChart3, Plus, Trash2, Download, Pencil,
} from "lucide-react";

const NOTIF_EVENTS = [
  { key: "job_scheduled", label: "Job scheduled" },
  { key: "eta_update", label: "ETA update" },
  { key: "engineer_arrived", label: "Engineer arrived on site" },
  { key: "job_completed", label: "Job completed" },
  { key: "estimate_sent", label: "Estimate sent" },
  { key: "invoice_issued", label: "Invoice issued" },
  { key: "invoice_paid", label: "Invoice paid" },
];

const ROLES = [
  { value: "owner", label: "Owner — full access" },
  { value: "approver", label: "Approver — can approve & write" },
  { value: "viewer", label: "Viewer — read-only" },
];

const REQUEST_STATUSES = ["submitted", "in_review", "scheduled", "cancelled", "converted"];

type Props = { clientId: string };

const tbl = (name: string) => supabase.from(name as any);
const logAudit = (clientId: string, action: string, entity_type?: string, entity_id?: string, metadata: any = {}) =>
  tbl("client_audit_log").insert({ client_id: clientId, actor_id: undefined, action, entity_type, entity_id, metadata });

const downloadCsv = (filename: string, rows: any[]) => {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const esc = (v: any) => {
    const s = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
};

export default function PortalAdvanced({ clientId }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" /> Advanced Portal
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="team">
          <TabsList className="flex flex-wrap gap-1 h-auto">
            <TabsTrigger value="team" className="gap-1"><Users className="w-3 h-3" />Team</TabsTrigger>
            <TabsTrigger value="sites" className="gap-1"><MapPin className="w-3 h-3" />Sites</TabsTrigger>
            <TabsTrigger value="requests" className="gap-1"><FileText className="w-3 h-3" />Requests</TabsTrigger>
            <TabsTrigger value="billing" className="gap-1"><CreditCard className="w-3 h-3" />Billing</TabsTrigger>
            <TabsTrigger value="notifs" className="gap-1"><Bell className="w-3 h-3" />Notifications</TabsTrigger>
            <TabsTrigger value="approvals" className="gap-1"><ShieldCheck className="w-3 h-3" />Approvals</TabsTrigger>
            <TabsTrigger value="messages" className="gap-1"><MessageSquare className="w-3 h-3" />Messages</TabsTrigger>
            <TabsTrigger value="audit" className="gap-1"><History className="w-3 h-3" />Audit</TabsTrigger>
            <TabsTrigger value="branding" className="gap-1"><Palette className="w-3 h-3" />Branding</TabsTrigger>
            <TabsTrigger value="reports" className="gap-1"><BarChart3 className="w-3 h-3" />Reports</TabsTrigger>
          </TabsList>

          <TabsContent value="team" className="pt-4"><TeamTab clientId={clientId} /></TabsContent>
          <TabsContent value="sites" className="pt-4"><SitesTab clientId={clientId} /></TabsContent>
          <TabsContent value="requests" className="pt-4"><RequestsTab clientId={clientId} /></TabsContent>
          <TabsContent value="billing" className="pt-4"><BillingTab clientId={clientId} /></TabsContent>
          <TabsContent value="notifs" className="pt-4"><NotifTab clientId={clientId} /></TabsContent>
          <TabsContent value="approvals" className="pt-4"><ApprovalsTab clientId={clientId} /></TabsContent>
          <TabsContent value="messages" className="pt-4"><MessagesTab clientId={clientId} /></TabsContent>
          <TabsContent value="audit" className="pt-4"><AuditTab clientId={clientId} /></TabsContent>
          <TabsContent value="branding" className="pt-4"><BrandingTab clientId={clientId} /></TabsContent>
          <TabsContent value="reports" className="pt-4"><ReportsTab clientId={clientId} /></TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

// ── Team / multi-user ──
function TeamTab({ clientId }: Props) {
  const qc = useQueryClient();
  const { data = [] } = useQuery({
    queryKey: ["client_users", clientId],
    queryFn: async () => {
      const { data, error } = await tbl("client_users").select("*").eq("client_id", clientId).order("created_at");
      if (error) throw error; return data || [];
    },
  });
  const [email, setEmail] = useState(""); const [role, setRole] = useState("viewer");
  const invite = useMutation({
    mutationFn: async () => {
      if (!email.trim()) throw new Error("Email required");
      const { error } = await tbl("client_users").insert({ client_id: clientId, user_id: crypto.randomUUID(), invited_email: email.trim(), role });
      if (error) throw error;
      await logAudit(clientId, "team.invite", "client_users", undefined, { email, role });
    },
    onSuccess: () => { toast({ title: "Invitation recorded" }); setEmail(""); qc.invalidateQueries({ queryKey: ["client_users", clientId] }); },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });
  const updateRole = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => {
      const { error } = await tbl("client_users").update({ role }).eq("id", id); if (error) throw error;
      await logAudit(clientId, "team.role_change", "client_users", id, { role });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["client_users", clientId] }),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await tbl("client_users").delete().eq("id", id); if (error) throw error;
      await logAudit(clientId, "team.remove", "client_users", id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["client_users", clientId] }),
  });
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_180px_auto] gap-2">
        <Input placeholder="user@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
        </Select>
        <Button onClick={() => invite.mutate()} disabled={invite.isPending}><Plus className="h-4 w-4 mr-1" />Invite</Button>
      </div>
      <Table>
        <TableHeader><TableRow><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead></TableHead></TableRow></TableHeader>
        <TableBody>
          {(data as any[]).map((u) => (
            <TableRow key={u.id}>
              <TableCell className="text-sm">{u.invited_email || u.user_id}</TableCell>
              <TableCell>
                <Select value={u.role} onValueChange={(v) => updateRole.mutate({ id: u.id, role: v })}>
                  <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>{ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                </Select>
              </TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="sm" onClick={() => remove.mutate(u.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
              </TableCell>
            </TableRow>
          ))}
          {data.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-4 text-sm">No team members yet.</TableCell></TableRow>}
        </TableBody>
      </Table>
    </div>
  );
}

// ── Sites / saved addresses ──
type SiteForm = { label: string; address_line: string; city: string; postal_code: string; country: string; contact_name: string; contact_phone: string; is_default: boolean };
const EMPTY_SITE: SiteForm = { label: "", address_line: "", city: "", postal_code: "", country: "", contact_name: "", contact_phone: "", is_default: false };

function SitesTab({ clientId }: Props) {
  const qc = useQueryClient();
  const { data = [] } = useQuery({
    queryKey: ["client_addresses", clientId],
    queryFn: async () => { const { data, error } = await tbl("client_addresses").select("*").eq("client_id", clientId).order("is_default", { ascending: false }); if (error) throw error; return data || []; },
  });
  const [f, setF] = useState<SiteForm>(EMPTY_SITE);
  const [editing, setEditing] = useState<{ id: string; form: SiteForm } | null>(null);

  const add = useMutation({
    mutationFn: async () => {
      if (!f.label.trim() || !f.address_line.trim()) throw new Error("Label and address required");
      const { error } = await tbl("client_addresses").insert({ ...f, client_id: clientId }); if (error) throw error;
      await logAudit(clientId, "site.create", "client_addresses", undefined, { label: f.label });
    },
    onSuccess: () => { setF(EMPTY_SITE); qc.invalidateQueries({ queryKey: ["client_addresses", clientId] }); toast({ title: "Site saved" }); },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const update = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const { id, form } = editing;
      if (!form.label.trim() || !form.address_line.trim()) throw new Error("Label and address required");
      const { error } = await tbl("client_addresses").update(form).eq("id", id);
      if (error) throw error;
      await logAudit(clientId, "site.update", "client_addresses", id, { label: form.label });
    },
    onSuccess: () => { setEditing(null); qc.invalidateQueries({ queryKey: ["client_addresses", clientId] }); toast({ title: "Site updated" }); },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      if (!window.confirm("Delete this site? This cannot be undone.")) throw new Error("cancelled");
      const { error } = await tbl("client_addresses").delete().eq("id", id); if (error) throw error;
      await logAudit(clientId, "site.delete", "client_addresses", id);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["client_addresses", clientId] }); toast({ title: "Site deleted" }); },
    onError: (e: any) => { if (e.message !== "cancelled") toast({ title: "Failed", description: e.message, variant: "destructive" }); },
  });

  const renderForm = (val: SiteForm, set: (v: SiteForm) => void) => (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
      <Input placeholder="Label (e.g. HQ) *" value={val.label} onChange={(e) => set({ ...val, label: e.target.value })} maxLength={80} />
      <Input placeholder="Address *" value={val.address_line} onChange={(e) => set({ ...val, address_line: e.target.value })} className="md:col-span-3" maxLength={200} />
      <Input placeholder="City" value={val.city} onChange={(e) => set({ ...val, city: e.target.value })} maxLength={80} />
      <Input placeholder="Postal" value={val.postal_code} onChange={(e) => set({ ...val, postal_code: e.target.value })} maxLength={20} />
      <Input placeholder="Country" value={val.country} onChange={(e) => set({ ...val, country: e.target.value })} maxLength={60} />
      <Input placeholder="Contact phone" value={val.contact_phone} onChange={(e) => set({ ...val, contact_phone: e.target.value })} maxLength={40} />
      <Input placeholder="Contact name" value={val.contact_name} onChange={(e) => set({ ...val, contact_name: e.target.value })} className="md:col-span-3" maxLength={120} />
      <div className="md:col-span-4 flex items-center gap-2 text-sm">
        <Switch checked={val.is_default} onCheckedChange={(v) => set({ ...val, is_default: v })} /> Default site
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="space-y-2 p-3 border rounded-md">
        {renderForm(f, setF)}
        <Button onClick={() => add.mutate()} disabled={add.isPending} className="w-full md:w-auto">
          <Plus className="h-4 w-4 mr-1" />Add Site
        </Button>
      </div>

      <div className="grid gap-2">
        {(data as any[]).map((a) => (
          <div key={a.id} className="flex items-center justify-between border rounded p-2 text-sm">
            <div className="min-w-0">
              <div className="font-medium flex items-center gap-2">{a.label} {a.is_default && <Badge variant="outline">Default</Badge>}</div>
              <div className="text-muted-foreground text-xs truncate">{a.address_line}{a.city ? `, ${a.city}` : ""} {a.postal_code} {a.country}</div>
              {(a.contact_name || a.contact_phone) && (
                <div className="text-muted-foreground text-xs">{[a.contact_name, a.contact_phone].filter(Boolean).join(" · ")}</div>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => setEditing({ id: a.id, form: {
                label: a.label || "", address_line: a.address_line || "", city: a.city || "", postal_code: a.postal_code || "",
                country: a.country || "", contact_name: a.contact_name || "", contact_phone: a.contact_phone || "", is_default: !!a.is_default,
              } })}>
                <Pencil className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => remove.mutate(a.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
            </div>
          </div>
        ))}
        {data.length === 0 && <p className="text-sm text-muted-foreground">No sites yet.</p>}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) setEditing(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Edit site</DialogTitle></DialogHeader>
          {editing && renderForm(editing.form, (form) => setEditing({ ...editing, form }))}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={() => update.mutate()} disabled={update.isPending}>Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Service requests ──
function RequestsTab({ clientId }: Props) {
  const qc = useQueryClient();
  const { data = [] } = useQuery({
    queryKey: ["client_service_requests", clientId],
    queryFn: async () => { const { data, error } = await tbl("client_service_requests").select("*").eq("client_id", clientId).order("created_at", { ascending: false }); if (error) throw error; return data || []; },
  });
  const { data: addresses = [] } = useQuery({
    queryKey: ["client_addresses", clientId],
    queryFn: async () => { const { data, error } = await tbl("client_addresses").select("id,label,address_line,city").eq("client_id", clientId).order("is_default", { ascending: false }); if (error) throw error; return data || []; },
  });

  const emptyForm = { title: "", description: "", priority: "medium", desired_date: "", is_recurring: false, recurrence_rrule: "", address_id: "", service_type: "" };
  const [f, setF] = useState(emptyForm);
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState<Record<number, { pct: number; status: "pending" | "uploading" | "done" | "error"; error?: string }>>({});

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const incoming = Array.from(list);
    const oversize = incoming.find((x) => x.size > 10 * 1024 * 1024);
    if (oversize) { toast({ title: "File too large", description: `${oversize.name} exceeds 10MB`, variant: "destructive" }); return; }
    setFiles((prev) => [...prev, ...incoming].slice(0, 8));
  };

  // Upload via XHR so we can track per-file progress
  const uploadWithProgress = (file: File, path: string, onProgress: (pct: number) => void) =>
    new Promise<void>(async (resolve, reject) => {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) { reject(new Error("Not authenticated")); return; }
      const url = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/portal-attachments/${encodeURI(path)}`;
      const xhr = new XMLHttpRequest();
      xhr.open("POST", url);
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.setRequestHeader("x-upsert", "false");
      if (file.type) xhr.setRequestHeader("Content-Type", file.type);
      xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
      xhr.onerror = () => reject(new Error("Network error during upload"));
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) { onProgress(100); resolve(); }
        else { try { const j = JSON.parse(xhr.responseText); reject(new Error(j.message || `Upload failed (${xhr.status})`)); } catch { reject(new Error(`Upload failed (${xhr.status})`)); } }
      };
      xhr.send(file);
    });

  const create = useMutation({
    mutationFn: async () => {
      if (!f.title.trim()) throw new Error("Title required");
      const initial: Record<number, any> = {};
      files.forEach((_, i) => { initial[i] = { pct: 0, status: "pending" }; });
      setProgress(initial);

      const uploaded: { name: string; path: string; size: number; type: string }[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${clientId}/requests/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
        setProgress((p) => ({ ...p, [i]: { pct: 0, status: "uploading" } }));
        try {
          await uploadWithProgress(file, path, (pct) => setProgress((p) => ({ ...p, [i]: { pct, status: pct >= 100 ? "done" : "uploading" } })));
          setProgress((p) => ({ ...p, [i]: { pct: 100, status: "done" } }));
          uploaded.push({ name: file.name, path, size: file.size, type: file.type });
        } catch (err: any) {
          setProgress((p) => ({ ...p, [i]: { pct: 0, status: "error", error: err.message } }));
          throw err;
        }
      }

      const payload: any = {
        client_id: clientId,
        title: f.title.trim(),
        description: f.description || null,
        priority: f.priority,
        desired_date: f.desired_date || null,
        is_recurring: f.is_recurring,
        recurrence_rrule: f.is_recurring ? (f.recurrence_rrule || null) : null,
        address_id: f.address_id || null,
        service_type: f.service_type || null,
        attachments: uploaded,
      };
      const { error } = await tbl("client_service_requests").insert(payload);
      if (error) throw error;
      await logAudit(clientId, "request.create", "client_service_requests", undefined, { title: f.title, attachments: uploaded.length });
    },
    onSuccess: () => {
      setF(emptyForm); setFiles([]); setProgress({});
      qc.invalidateQueries({ queryKey: ["client_service_requests", clientId] });
      toast({ title: "Request submitted" });
    },
    onError: (e: any) => { toast({ title: "Failed", description: e.message, variant: "destructive" }); },
  });

  const overallPct = files.length === 0 ? 0 : Math.round(
    files.reduce((sum, _, i) => sum + (progress[i]?.pct ?? 0), 0) / files.length
  );
  const isUploading = create.isPending && files.length > 0 && overallPct < 100;

  const cancel = useMutation({
    mutationFn: async (r: any) => {
      const reason = window.prompt("Cancellation reason:") || "—";
      const { error } = await tbl("client_service_requests").update({ status: "cancelled", cancelled_at: new Date().toISOString(), cancelled_reason: reason }).eq("id", r.id);
      if (error) throw error; await logAudit(clientId, "request.cancel", "client_service_requests", r.id, { reason });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["client_service_requests", clientId] }),
  });

  const downloadAttachment = async (path: string, name: string) => {
    const { data, error } = await supabase.storage.from("portal-attachments").createSignedUrl(path, 60);
    if (error || !data) { toast({ title: "Could not open file", description: error?.message, variant: "destructive" }); return; }
    const a = document.createElement("a"); a.href = data.signedUrl; a.target = "_blank"; a.rel = "noreferrer"; a.download = name; a.click();
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 p-3 border rounded-md">
        <Input placeholder="Title *" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} className="md:col-span-2" maxLength={140} />
        <Select value={f.priority} onValueChange={(v) => setF({ ...f, priority: v })}>
          <SelectTrigger><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>{["low","medium","high","urgent"].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
        </Select>

        <Input placeholder="Service type (optional)" value={f.service_type} onChange={(e) => setF({ ...f, service_type: e.target.value })} maxLength={60} />
        <Select value={f.address_id || "none"} onValueChange={(v) => setF({ ...f, address_id: v === "none" ? "" : v })}>
          <SelectTrigger><SelectValue placeholder="Saved site / address" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">— No specific site —</SelectItem>
            {(addresses as any[]).map((a) => (
              <SelectItem key={a.id} value={a.id}>{a.label || a.address_line}{a.city ? ` · ${a.city}` : ""}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input type="date" value={f.desired_date} onChange={(e) => setF({ ...f, desired_date: e.target.value })} />

        <Textarea placeholder="Describe the issue or work needed…" rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} className="md:col-span-3" maxLength={2000} />

        <div className="flex items-center gap-2 text-sm"><Switch checked={f.is_recurring} onCheckedChange={(v) => setF({ ...f, is_recurring: v })} /> Recurring</div>
        {f.is_recurring && <Input placeholder="RRULE e.g. FREQ=WEEKLY;BYDAY=MO" value={f.recurrence_rrule} onChange={(e) => setF({ ...f, recurrence_rrule: e.target.value })} className="md:col-span-2" />}

        <div className="md:col-span-3 space-y-2">
          <Label className="text-xs text-muted-foreground">Attachments (max 8 files, 10MB each)</Label>
          <Input type="file" multiple onChange={(e) => { addFiles(e.target.files); e.currentTarget.value = ""; }} disabled={create.isPending} />
          {files.length > 0 && (
            <div className="space-y-1.5">
              {files.map((file, i) => {
                const p = progress[i];
                const status = p?.status ?? "pending";
                const pct = p?.pct ?? 0;
                return (
                  <div key={i} className="border rounded p-2 space-y-1">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div className="truncate flex-1">
                        <span className="font-medium">{file.name}</span>
                        <span className="text-muted-foreground ml-1">({Math.round(file.size / 1024)} KB)</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {status === "uploading" && <span className="text-muted-foreground">{pct}%</span>}
                        {status === "done" && <Badge variant="outline" className="text-xs">Done</Badge>}
                        {status === "error" && <Badge variant="destructive" className="text-xs" title={p?.error}>Failed</Badge>}
                        {!create.isPending && (
                          <button type="button" onClick={() => { setFiles(files.filter((_, j) => j !== i)); setProgress((pp) => { const n = { ...pp }; delete n[i]; return n; }); }} className="hover:text-destructive">×</button>
                        )}
                      </div>
                    </div>
                    {(status === "uploading" || status === "done") && <Progress value={pct} className="h-1" />}
                    {status === "error" && p?.error && <div className="text-xs text-destructive">{p.error}</div>}
                  </div>
                );
              })}
              {create.isPending && (
                <div className="pt-1 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Overall progress</span>
                    <span className="font-medium">{overallPct}%</span>
                  </div>
                  <Progress value={overallPct} className="h-2" />
                </div>
              )}
            </div>
          )}
        </div>

        <Button onClick={() => create.mutate()} disabled={create.isPending} className="md:col-span-3">
          <Plus className="h-4 w-4 mr-1" />{isUploading ? `Uploading ${overallPct}%…` : create.isPending ? "Submitting…" : "Submit Request"}
        </Button>
      </div>

      <Table>
        <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Priority</TableHead><TableHead>Status</TableHead><TableHead>Desired</TableHead><TableHead>Files</TableHead><TableHead></TableHead></TableRow></TableHeader>
        <TableBody>
          {(data as any[]).map((r) => {
            const atts: any[] = Array.isArray(r.attachments) ? r.attachments : [];
            return (
              <TableRow key={r.id}>
                <TableCell className="text-sm">
                  {r.title} {r.is_recurring && <Badge variant="outline" className="ml-1">Recurring</Badge>}
                  {r.address_id && (() => { const a = (addresses as any[]).find((x) => x.id === r.address_id); return a ? <div className="text-xs text-muted-foreground">📍 {a.label || a.address_line}</div> : null; })()}
                </TableCell>
                <TableCell><Badge variant="outline">{r.priority}</Badge></TableCell>
                <TableCell><Badge variant="outline">{r.status}</Badge></TableCell>
                <TableCell className="text-xs">{r.desired_date || "—"}</TableCell>
                <TableCell className="text-xs">
                  {atts.length === 0 ? "—" : (
                    <div className="flex flex-col gap-0.5">
                      {atts.map((a, i) => (
                        <button key={i} type="button" onClick={() => downloadAttachment(a.path, a.name)} className="text-primary hover:underline text-left truncate max-w-[180px]">
                          {a.name}
                        </button>
                      ))}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {r.status !== "cancelled" && r.status !== "converted" && (
                    <Button size="sm" variant="ghost" onClick={() => cancel.mutate(r)}>Cancel</Button>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
          {data.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-4 text-sm">No requests yet.</TableCell></TableRow>}
        </TableBody>
      </Table>
    </div>
  );
}

// ── Billing ──
function BillingTab({ clientId }: Props) {
  const qc = useQueryClient();
  const { data: methods = [] } = useQuery({
    queryKey: ["client_payment_methods", clientId],
    queryFn: async () => { const { data, error } = await tbl("client_payment_methods").select("*").eq("client_id", clientId).order("is_default", { ascending: false }); if (error) throw error; return data || []; },
  });
  const { data: payments = [] } = useQuery({
    queryKey: ["client_invoice_payments", clientId],
    queryFn: async () => { const { data, error } = await tbl("client_invoice_payments").select("*").eq("client_id", clientId).order("paid_at", { ascending: false }); if (error) throw error; return data || []; },
  });
  const [pm, setPm] = useState({ brand: "Visa", last4: "", exp_month: "", exp_year: "", holder_name: "", is_default: false, is_autopay: false });
  const addPm = useMutation({
    mutationFn: async () => {
      if (!/^\d{4}$/.test(pm.last4)) throw new Error("Enter 4-digit last4");
      const { error } = await tbl("client_payment_methods").insert({
        ...pm, client_id: clientId, type: "card",
        exp_month: pm.exp_month ? parseInt(pm.exp_month) : null, exp_year: pm.exp_year ? parseInt(pm.exp_year) : null,
      }); if (error) throw error; await logAudit(clientId, "billing.add_card", "client_payment_methods", undefined, { brand: pm.brand, last4: pm.last4 });
    },
    onSuccess: () => { setPm({ brand: "Visa", last4: "", exp_month: "", exp_year: "", holder_name: "", is_default: false, is_autopay: false });
      qc.invalidateQueries({ queryKey: ["client_payment_methods", clientId] }); toast({ title: "Payment method saved" }); },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });
  const totalPaid = useMemo(() => (payments as any[]).reduce((s, p) => s + Number(p.amount || 0), 0), [payments]);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_240px] gap-3">
        <div className="space-y-2">
          <Label className="text-xs">Stored payment methods</Label>
          {(methods as any[]).map((m) => (
            <div key={m.id} className="flex items-center justify-between border rounded p-2 text-sm">
              <div>{m.brand} •••• {m.last4} <span className="text-muted-foreground text-xs">{m.exp_month}/{m.exp_year}</span></div>
              <div className="flex gap-2 items-center">
                {m.is_default && <Badge variant="outline">Default</Badge>}
                {m.is_autopay && <Badge variant="outline">Auto-pay</Badge>}
              </div>
            </div>
          ))}
          {methods.length === 0 && <p className="text-xs text-muted-foreground">No saved methods.</p>}
        </div>
        <div className="space-y-2 p-3 border rounded">
          <Label className="text-xs">Add card</Label>
          <Input placeholder="Brand" value={pm.brand} onChange={(e) => setPm({ ...pm, brand: e.target.value })} />
          <Input placeholder="Last 4" maxLength={4} value={pm.last4} onChange={(e) => setPm({ ...pm, last4: e.target.value })} />
          <div className="grid grid-cols-2 gap-1">
            <Input placeholder="MM" value={pm.exp_month} onChange={(e) => setPm({ ...pm, exp_month: e.target.value })} />
            <Input placeholder="YYYY" value={pm.exp_year} onChange={(e) => setPm({ ...pm, exp_year: e.target.value })} />
          </div>
          <div className="flex items-center gap-2 text-xs"><Switch checked={pm.is_default} onCheckedChange={(v) => setPm({ ...pm, is_default: v })} />Default</div>
          <div className="flex items-center gap-2 text-xs"><Switch checked={pm.is_autopay} onCheckedChange={(v) => setPm({ ...pm, is_autopay: v })} />Auto-pay</div>
          <Button size="sm" className="w-full" onClick={() => addPm.mutate()} disabled={addPm.isPending}>Save</Button>
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="text-xs">Statement / receipts (total paid: {totalPaid.toFixed(2)})</Label>
          <Button size="sm" variant="outline" onClick={() => downloadCsv(`statement-${clientId}.csv`, payments as any[])} disabled={!payments.length}>
            <Download className="h-3 w-3 mr-1" />CSV
          </Button>
        </div>
        <Table>
          <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead><TableHead>Receipt</TableHead></TableRow></TableHeader>
          <TableBody>
            {(payments as any[]).map((p) => (
              <TableRow key={p.id}>
                <TableCell className="text-xs">{new Date(p.paid_at).toLocaleDateString()}</TableCell>
                <TableCell>{Number(p.amount).toFixed(2)} {p.currency}</TableCell>
                <TableCell><Badge variant="outline">{p.status}</Badge></TableCell>
                <TableCell>{p.receipt_url ? <a className="text-primary text-xs hover:underline" href={p.receipt_url} target="_blank" rel="noreferrer">View</a> : "—"}</TableCell>
              </TableRow>
            ))}
            {payments.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4 text-sm">No payments yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ── Notification preferences ──
function NotifTab({ clientId }: Props) {
  const qc = useQueryClient();
  const { data = [] } = useQuery({
    queryKey: ["client_notification_prefs", clientId],
    queryFn: async () => { const { data, error } = await tbl("client_notification_prefs").select("*").eq("client_id", clientId).is("user_id", null); if (error) throw error; return data || []; },
  });
  const map = new Map<string, any>(); (data as any[]).forEach((p) => map.set(p.event_key, p));
  const upsert = useMutation({
    mutationFn: async ({ event_key, email_enabled, sms_enabled }: any) => {
      const existing = map.get(event_key);
      if (existing) {
        const { error } = await tbl("client_notification_prefs").update({ email_enabled, sms_enabled }).eq("id", existing.id); if (error) throw error;
      } else {
        const { error } = await tbl("client_notification_prefs").insert({ client_id: clientId, event_key, email_enabled, sms_enabled }); if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["client_notification_prefs", clientId] }),
  });
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Toggle which events trigger email or SMS notifications for this client account.</p>
      <Table>
        <TableHeader><TableRow><TableHead>Event</TableHead><TableHead className="text-center">Email</TableHead><TableHead className="text-center">SMS</TableHead></TableRow></TableHeader>
        <TableBody>
          {NOTIF_EVENTS.map((e) => {
            const p = map.get(e.key);
            const email = p?.email_enabled ?? true; const sms = p?.sms_enabled ?? false;
            return (
              <TableRow key={e.key}>
                <TableCell className="text-sm">{e.label}</TableCell>
                <TableCell className="text-center"><Switch checked={email} onCheckedChange={(v) => upsert.mutate({ event_key: e.key, email_enabled: v, sms_enabled: sms })} /></TableCell>
                <TableCell className="text-center"><Switch checked={sms} onCheckedChange={(v) => upsert.mutate({ event_key: e.key, email_enabled: email, sms_enabled: v })} /></TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// ── In-portal estimate approvals ──
function ApprovalsTab({ clientId }: Props) {
  const qc = useQueryClient();
  const { data: estimates = [] } = useQuery({
    queryKey: ["estimates", clientId],
    queryFn: async () => { const { data, error } = await supabase.from("estimates").select("id,estimate_number,title,total,currency,status").eq("client_id", clientId).order("created_at", { ascending: false }); if (error) throw error; return data || []; },
  });
  const { data: decisions = [] } = useQuery({
    queryKey: ["estimate_decisions", clientId],
    queryFn: async () => { const { data, error } = await tbl("client_estimate_decisions").select("*").eq("client_id", clientId).order("decided_at", { ascending: false }); if (error) throw error; return data || []; },
  });
  const decide = useMutation({
    mutationFn: async ({ estimate_id, decision }: { estimate_id: string; decision: string }) => {
      const comment = window.prompt(`${decision}: optional comment`) || null;
      const sig = window.prompt("Type your full name as signature:") || null;
      if (!sig) throw new Error("Signature required");
      const { error } = await tbl("client_estimate_decisions").insert({ client_id: clientId, estimate_id, decision, comment, signature_data: sig });
      if (error) throw error; await logAudit(clientId, `estimate.${decision}`, "estimates", estimate_id, { comment });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["estimate_decisions", clientId] }); toast({ title: "Decision recorded" }); },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });
  const decisionsByEst = useMemo(() => {
    const m = new Map<string, any>(); (decisions as any[]).forEach((d) => { if (!m.has(d.estimate_id)) m.set(d.estimate_id, d); }); return m;
  }, [decisions]);
  return (
    <Table>
      <TableHeader><TableRow><TableHead>Estimate</TableHead><TableHead>Total</TableHead><TableHead>Status</TableHead><TableHead>Last decision</TableHead><TableHead></TableHead></TableRow></TableHeader>
      <TableBody>
        {(estimates as any[]).map((e) => {
          const d = decisionsByEst.get(e.id);
          return (
            <TableRow key={e.id}>
              <TableCell className="text-sm">{e.estimate_number || e.id.slice(0,8)} — {e.title || "—"}</TableCell>
              <TableCell className="text-sm">{Number(e.total).toFixed(2)} {e.currency}</TableCell>
              <TableCell><Badge variant="outline">{e.status}</Badge></TableCell>
              <TableCell className="text-xs">{d ? `${d.decision} by ${d.signature_data}` : "—"}</TableCell>
              <TableCell className="text-right">
                <Button size="sm" variant="ghost" onClick={() => decide.mutate({ estimate_id: e.id, decision: "approved" })}>Approve</Button>
                <Button size="sm" variant="ghost" onClick={() => decide.mutate({ estimate_id: e.id, decision: "rejected" })}>Reject</Button>
              </TableCell>
            </TableRow>
          );
        })}
        {estimates.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-4 text-sm">No estimates.</TableCell></TableRow>}
      </TableBody>
    </Table>
  );
}

// ── Per-job two-way messaging ──
function MessagesTab({ clientId }: Props) {
  const qc = useQueryClient();
  const { data: jobs = [] } = useQuery({
    queryKey: ["jobs-for-portal", clientId],
    queryFn: async () => { const { data, error } = await supabase.from("jobs").select("id,title,status").eq("client_id", clientId).order("created_at", { ascending: false }).limit(50); if (error) throw error; return data || []; },
  });
  const [jobId, setJobId] = useState<string | null>(null);
  const activeId = jobId || (jobs as any[])[0]?.id;
  const { data: messages = [] } = useQuery({
    queryKey: ["client_job_messages", activeId],
    enabled: !!activeId,
    queryFn: async () => { const { data, error } = await tbl("client_job_messages").select("*").eq("job_id", activeId).order("created_at"); if (error) throw error; return data || []; },
  });
  const [body, setBody] = useState("");
  const send = useMutation({
    mutationFn: async () => {
      if (!body.trim() || !activeId) return;
      const { data: u } = await supabase.auth.getUser();
      const { error } = await tbl("client_job_messages").insert({ client_id: clientId, job_id: activeId, sender_id: u.user?.id, sender_type: "team", body: body.trim() });
      if (error) throw error;
    },
    onSuccess: () => { setBody(""); qc.invalidateQueries({ queryKey: ["client_job_messages", activeId] }); },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });
  return (
    <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-3 h-[400px]">
      <div className="border rounded overflow-y-auto">
        {(jobs as any[]).map((j) => (
          <button key={j.id} onClick={() => setJobId(j.id)} className={`w-full text-left p-2 border-b hover:bg-accent text-sm ${activeId === j.id ? "bg-accent" : ""}`}>
            <div className="truncate">{j.title}</div><Badge variant="outline" className="text-[10px]">{j.status}</Badge>
          </button>
        ))}
        {jobs.length === 0 && <p className="p-2 text-xs text-muted-foreground">No jobs.</p>}
      </div>
      <div className="border rounded flex flex-col">
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {(messages as any[]).map((m) => (
            <div key={m.id} className={`text-sm p-2 rounded max-w-[80%] ${m.sender_type === "team" ? "bg-primary/10 ml-auto" : "bg-muted"}`}>
              <div className="text-[10px] text-muted-foreground">{m.sender_type} · {new Date(m.created_at).toLocaleString()}</div>
              {m.body}
            </div>
          ))}
          {activeId && messages.length === 0 && <p className="text-xs text-muted-foreground">No messages yet.</p>}
        </div>
        <div className="border-t p-2 flex gap-2">
          <Input placeholder="Type a message…" value={body} onChange={(e) => setBody(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send.mutate(); }} />
          <Button onClick={() => send.mutate()} disabled={!body.trim() || send.isPending}>Send</Button>
        </div>
      </div>
    </div>
  );
}

// ── Audit log ──
function AuditTab({ clientId }: Props) {
  const { data = [] } = useQuery({
    queryKey: ["client_audit_log", clientId],
    queryFn: async () => { const { data, error } = await tbl("client_audit_log").select("*").eq("client_id", clientId).order("created_at", { ascending: false }).limit(200); if (error) throw error; return data || []; },
  });
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Most recent 200 portal actions</p>
        <Button size="sm" variant="outline" onClick={() => downloadCsv(`audit-${clientId}.csv`, data as any[])} disabled={!data.length}>
          <Download className="h-3 w-3 mr-1" />CSV
        </Button>
      </div>
      <Table>
        <TableHeader><TableRow><TableHead>When</TableHead><TableHead>Action</TableHead><TableHead>Entity</TableHead><TableHead>Details</TableHead></TableRow></TableHeader>
        <TableBody>
          {(data as any[]).map((a) => (
            <TableRow key={a.id}>
              <TableCell className="text-xs">{new Date(a.created_at).toLocaleString()}</TableCell>
              <TableCell className="text-sm">{a.action}</TableCell>
              <TableCell className="text-xs">{a.entity_type || "—"}</TableCell>
              <TableCell className="text-xs text-muted-foreground truncate max-w-[300px]">{JSON.stringify(a.metadata)}</TableCell>
            </TableRow>
          ))}
          {data.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4 text-sm">No audit events.</TableCell></TableRow>}
        </TableBody>
      </Table>
    </div>
  );
}

// ── Branded portal ──
function BrandingTab({ clientId }: Props) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["client_portal_branding", clientId],
    queryFn: async () => { const { data, error } = await tbl("client_portal_branding").select("*").eq("client_id", clientId).maybeSingle(); if (error) throw error; return data; },
  });
  const [f, setF] = useState({ subdomain: "", primary_color: "#2563eb", accent_color: "#1e293b", logo_url: "", support_email: "", support_phone: "", welcome_message: "" });
  useMemo(() => { if (data) setF({ subdomain: (data as any).subdomain || "", primary_color: (data as any).primary_color || "#2563eb", accent_color: (data as any).accent_color || "#1e293b", logo_url: (data as any).logo_url || "", support_email: (data as any).support_email || "", support_phone: (data as any).support_phone || "", welcome_message: (data as any).welcome_message || "" }); }, [data]);
  const save = useMutation({
    mutationFn: async () => {
      const payload = { ...f, client_id: clientId };
      if (data) { const { error } = await tbl("client_portal_branding").update(payload).eq("id", (data as any).id); if (error) throw error; }
      else { const { error } = await tbl("client_portal_branding").insert(payload); if (error) throw error; }
      await logAudit(clientId, "branding.update", "client_portal_branding");
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["client_portal_branding", clientId] }); toast({ title: "Branding saved" }); },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div><Label className="text-xs">Subdomain</Label><Input placeholder="acme" value={f.subdomain} onChange={(e) => setF({ ...f, subdomain: e.target.value })} /></div>
      <div><Label className="text-xs">Logo URL</Label><Input value={f.logo_url} onChange={(e) => setF({ ...f, logo_url: e.target.value })} /></div>
      <div><Label className="text-xs">Primary color</Label><div className="flex gap-2"><Input type="color" className="w-12 h-10 p-1" value={f.primary_color} onChange={(e) => setF({ ...f, primary_color: e.target.value })} /><Input value={f.primary_color} onChange={(e) => setF({ ...f, primary_color: e.target.value })} /></div></div>
      <div><Label className="text-xs">Accent color</Label><div className="flex gap-2"><Input type="color" className="w-12 h-10 p-1" value={f.accent_color} onChange={(e) => setF({ ...f, accent_color: e.target.value })} /><Input value={f.accent_color} onChange={(e) => setF({ ...f, accent_color: e.target.value })} /></div></div>
      <div><Label className="text-xs">Support email</Label><Input value={f.support_email} onChange={(e) => setF({ ...f, support_email: e.target.value })} /></div>
      <div><Label className="text-xs">Support phone</Label><Input value={f.support_phone} onChange={(e) => setF({ ...f, support_phone: e.target.value })} /></div>
      <div className="md:col-span-2"><Label className="text-xs">Welcome message</Label><Textarea rows={3} value={f.welcome_message} onChange={(e) => setF({ ...f, welcome_message: e.target.value })} /></div>
      <div className="md:col-span-2"><Button onClick={() => save.mutate()} disabled={save.isPending}>Save Branding</Button></div>
    </div>
  );
}

// ── Reports / KPIs ──
function ReportsTab({ clientId }: Props) {
  const { data: jobs = [] } = useQuery({
    queryKey: ["jobs-report", clientId],
    queryFn: async () => { const { data, error } = await supabase.from("jobs").select("id,status,scheduled_at,completed_at,total_price,location").eq("client_id", clientId); if (error) throw error; return data || []; },
  });
  const { data: assets = [] } = useQuery({
    queryKey: ["client_site_assets", clientId],
    queryFn: async () => { const { data, error } = await tbl("client_site_assets").select("*").eq("client_id", clientId).order("next_pm_at"); if (error) throw error; return data || []; },
  });
  const stats = useMemo(() => {
    const total = jobs.length;
    const byStatus: Record<string, number> = {};
    let spend = 0; let totalResp = 0; let respN = 0;
    (jobs as any[]).forEach((j) => {
      byStatus[j.status] = (byStatus[j.status] || 0) + 1;
      spend += Number(j.total_price || 0);
      if (j.scheduled_at && j.completed_at) {
        totalResp += (new Date(j.completed_at).getTime() - new Date(j.scheduled_at).getTime()) / 36e5;
        respN++;
      }
    });
    return { total, byStatus, spend, avgRespHrs: respN ? totalResp / respN : 0 };
  }, [jobs]);
  const upcomingPMs = (assets as any[]).filter((a) => a.next_pm_at && new Date(a.next_pm_at) >= new Date()).slice(0, 10);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Stat label="Total jobs" value={stats.total} />
        <Stat label="Spend" value={stats.spend.toFixed(2)} />
        <Stat label="Avg response (h)" value={stats.avgRespHrs.toFixed(1)} />
        <Stat label="Assets tracked" value={assets.length} />
      </div>
      <div>
        <Label className="text-xs">Jobs by status</Label>
        <div className="flex flex-wrap gap-2 mt-1">
          {Object.entries(stats.byStatus).map(([s, n]) => <Badge key={s} variant="outline">{s}: {n}</Badge>)}
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between mb-1">
          <Label className="text-xs">Upcoming PMs / asset history</Label>
          <Button size="sm" variant="outline" onClick={() => downloadCsv(`assets-${clientId}.csv`, assets as any[])} disabled={!assets.length}>
            <Download className="h-3 w-3 mr-1" />CSV
          </Button>
        </div>
        <Table>
          <TableHeader><TableRow><TableHead>Asset</TableHead><TableHead>Category</TableHead><TableHead>Warranty until</TableHead><TableHead>Next PM</TableHead></TableRow></TableHeader>
          <TableBody>
            {upcomingPMs.map((a: any) => (
              <TableRow key={a.id}>
                <TableCell className="text-sm">{a.name}</TableCell>
                <TableCell className="text-xs">{a.category || "—"}</TableCell>
                <TableCell className="text-xs">{a.warranty_until || "—"}</TableCell>
                <TableCell className="text-xs">{a.next_pm_at || "—"}</TableCell>
              </TableRow>
            ))}
            {upcomingPMs.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4 text-sm">No upcoming PMs.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

const Stat = ({ label, value }: { label: string; value: any }) => (
  <div className="border rounded p-3">
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className="text-xl font-semibold">{value}</div>
  </div>
);
