import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, FileText, History, Download, Upload, RotateCcw } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";

export type Visibility = "all" | "admin_only" | "team_lead_allowed";

export type NotesTemplate = {
  id: string;
  label: string;
  content: string;
  sort_order: number;
  is_active: boolean;
  visibility: Visibility;
  version: number;
};

export type NotesTemplateVersion = {
  id: string;
  template_id: string;
  version: number;
  label: string;
  content: string;
  sort_order: number;
  is_active: boolean;
  visibility: Visibility;
  changed_by: string | null;
  created_at: string;
};

export const useNotesTemplates = () =>
  useQuery({
    queryKey: ["estimate-notes-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estimate_notes_templates" as any)
        .select("*")
        .order("sort_order", { ascending: true })
        .order("label", { ascending: true });
      if (error) throw error;
      return (data as any as NotesTemplate[]) || [];
    },
    staleTime: 60_000,
  });

// ── CSV helpers ──
const csvEscape = (v: string | number | boolean) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const toCsv = (rows: NotesTemplate[]) => {
  const headers = ["label", "content", "sort_order", "is_active", "visibility"];
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push([r.label, r.content, r.sort_order, r.is_active, r.visibility].map(csvEscape).join(","));
  }
  return lines.join("\n");
};
const parseCsv = (text: string): Record<string, string>[] => {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') { inQ = false; }
      else { field += c; }
    } else {
      if (c === '"') inQ = true;
      else if (c === ",") { cur.push(field); field = ""; }
      else if (c === "\n" || c === "\r") {
        if (field !== "" || cur.length) { cur.push(field); rows.push(cur); cur = []; field = ""; }
        if (c === "\r" && text[i + 1] === "\n") i++;
      } else field += c;
    }
  }
  if (field !== "" || cur.length) { cur.push(field); rows.push(cur); }
  if (!rows.length) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).filter((r) => r.some((v) => v.trim() !== "")).map((r) => {
    const o: Record<string, string> = {};
    headers.forEach((h, i) => { o[h] = (r[i] ?? "").trim(); });
    return o;
  });
};

const VISIBILITY_LABELS: Record<Visibility, string> = {
  all: "All roles",
  team_lead_allowed: "Admin + Team Lead",
  admin_only: "Admin only",
};

const NotesTemplates = () => {
  const qc = useQueryClient();
  const { isAdmin, isTeamLead } = useUserRole();
  const canEdit = isAdmin || isTeamLead;
  const { data: templates = [], isLoading } = useNotesTemplates();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<NotesTemplate | null>(null);
  const [label, setLabel] = useState("");
  const [content, setContent] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [isActive, setIsActive] = useState(true);
  const [visibility, setVisibility] = useState<Visibility>("all");

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyTpl, setHistoryTpl] = useState<NotesTemplate | null>(null);

  const reset = () => {
    setEditing(null); setLabel(""); setContent(""); setSortOrder("0"); setIsActive(true); setVisibility("all");
  };

  const openNew = () => { reset(); setOpen(true); };
  const openEdit = (t: NotesTemplate) => {
    setEditing(t);
    setLabel(t.label);
    setContent(t.content);
    setSortOrder(String(t.sort_order));
    setIsActive(t.is_active);
    setVisibility(t.visibility ?? "all");
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!label.trim() || !content.trim()) throw new Error("Label and content are required");
      // Only Admin can assign admin_only visibility
      if (visibility === "admin_only" && !isAdmin) throw new Error("Only Admins can set Admin-only visibility");
      const payload = {
        label: label.trim(),
        content: content.trim(),
        sort_order: parseInt(sortOrder) || 0,
        is_active: isActive,
        visibility,
      };
      if (editing) {
        const { error } = await supabase.from("estimate_notes_templates" as any).update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("estimate_notes_templates" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["estimate-notes-templates"] });
      toast.success(editing ? "Template updated (previous version saved)" : "Template created");
      setOpen(false); reset();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("estimate_notes_templates" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["estimate-notes-templates"] });
      toast.success("Template deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const versionsQ = useQuery({
    queryKey: ["estimate-notes-template-versions", historyTpl?.id],
    enabled: !!historyTpl?.id && historyOpen,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estimate_notes_template_versions" as any)
        .select("*")
        .eq("template_id", historyTpl!.id)
        .order("version", { ascending: false });
      if (error) throw error;
      return (data as any as NotesTemplateVersion[]) || [];
    },
  });

  const restore = useMutation({
    mutationFn: async (v: NotesTemplateVersion) => {
      const { error } = await supabase.from("estimate_notes_templates" as any).update({
        label: v.label,
        content: v.content,
        sort_order: v.sort_order,
        is_active: v.is_active,
        visibility: v.visibility,
      }).eq("id", v.template_id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["estimate-notes-templates"] });
      qc.invalidateQueries({ queryKey: ["estimate-notes-template-versions"] });
      toast.success("Restored from history");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const exportCsv = () => {
    const csv = toCsv(templates);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `notes-templates-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${templates.length} template(s)`);
  };

  const importCsv = useMutation({
    mutationFn: async (file: File) => {
      const text = await file.text();
      const rows = parseCsv(text);
      if (!rows.length) throw new Error("CSV is empty");
      const byLabel = new Map(templates.map((t) => [t.label.toLowerCase(), t]));
      let inserted = 0, updated = 0, skipped = 0;
      for (const r of rows) {
        const lbl = r.label?.trim();
        const cnt = r.content?.trim();
        if (!lbl || !cnt) { skipped++; continue; }
        const vis = (["all", "admin_only", "team_lead_allowed"].includes(r.visibility) ? r.visibility : "all") as Visibility;
        if (vis === "admin_only" && !isAdmin) { skipped++; continue; }
        const payload = {
          label: lbl,
          content: cnt,
          sort_order: parseInt(r.sort_order) || 0,
          is_active: r.is_active === "" || r.is_active === undefined ? true : /^(true|1|yes)$/i.test(r.is_active),
          visibility: vis,
        };
        const existing = byLabel.get(lbl.toLowerCase());
        if (existing) {
          const { error } = await supabase.from("estimate_notes_templates" as any).update(payload).eq("id", existing.id);
          if (error) throw error;
          updated++;
        } else {
          const { error } = await supabase.from("estimate_notes_templates" as any).insert(payload);
          if (error) throw error;
          inserted++;
        }
      }
      return { inserted, updated, skipped };
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["estimate-notes-templates"] });
      toast.success(`Import done — ${r.inserted} new, ${r.updated} updated${r.skipped ? `, ${r.skipped} skipped` : ""}`);
    },
    onError: (e: any) => toast.error(`Import failed: ${e.message}`),
  });

  const onPickCsv: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) importCsv.mutate(f);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="w-4 h-4" /> Notes / Terms Templates
        </CardTitle>
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={exportCsv} className="gap-1">
            <Download className="w-3 h-3" /> Export CSV
          </Button>
          {canEdit && (
            <>
              <label className="inline-flex">
                <input type="file" accept=".csv,text/csv" className="hidden" onChange={onPickCsv} />
                <Button size="sm" variant="outline" asChild className="gap-1 cursor-pointer">
                  <span><Upload className="w-3 h-3" /> Import CSV</span>
                </Button>
              </label>
              <Button size="sm" onClick={openNew} className="gap-1">
                <Plus className="w-3 h-3" /> New Template
              </Button>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : templates.length === 0 ? (
          <p className="text-sm text-muted-foreground">No templates yet.</p>
        ) : (
          <div className="space-y-2">
            {templates.map((t) => (
              <div key={t.id} className="flex items-start gap-3 p-3 rounded border border-border bg-muted/20">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{t.label}</span>
                    {!t.is_active && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Inactive</span>}
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">{VISIBILITY_LABELS[t.visibility ?? "all"]}</span>
                    <span className="text-[10px] text-muted-foreground">v{t.version} · order: {t.sort_order}</span>
                  </div>
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap mt-1 line-clamp-3">{t.content}</p>
                </div>
                {canEdit && (
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => { setHistoryTpl(t); setHistoryOpen(true); }} className="gap-1 text-xs">
                      <History className="w-3 h-3" /> History
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => openEdit(t)} className="gap-1 text-xs">
                      <Pencil className="w-3 h-3" /> Edit
                    </Button>
                    <Button
                      variant="ghost" size="sm"
                      onClick={() => { if (confirm(`Delete template "${t.label}"? Version history will also be removed.`)) del.mutate(t.id); }}
                      className="gap-1 text-xs text-destructive"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={(o) => { if (!o) { setOpen(false); reset(); } }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit Template (v${editing.version})` : "New Notes / Terms Template"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Label *</Label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={120} placeholder="e.g. Net 30 Payment Terms" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Content *</Label>
              <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={8} maxLength={4000} placeholder="Write the predefined notes/terms text…" />
              <p className="text-[11px] text-muted-foreground">{content.length}/4000 — editing creates a new version automatically</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Sort Order</Label>
                <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
              </div>
              <div className="flex items-center justify-between rounded border border-border px-3">
                <Label className="text-xs">Active</Label>
                <Switch checked={isActive} onCheckedChange={setIsActive} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Visibility</Label>
              <Select value={visibility} onValueChange={(v) => setVisibility(v as Visibility)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All roles can use</SelectItem>
                  <SelectItem value="team_lead_allowed">Admin + Team Lead only</SelectItem>
                  <SelectItem value="admin_only" disabled={!isAdmin}>
                    Admin only{!isAdmin ? " (admins only)" : ""}
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Admin-only templates are hidden from Team Leads unless visibility is "Admin + Team Lead".
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => { setOpen(false); reset(); }}>Cancel</Button>
              <Button onClick={() => save.mutate()} disabled={save.isPending}>
                {save.isPending ? "Saving…" : editing ? "Save Changes" : "Create Template"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={historyOpen} onOpenChange={(o) => { if (!o) { setHistoryOpen(false); setHistoryTpl(null); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-4 h-4" /> Version History — {historyTpl?.label}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {versionsQ.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (versionsQ.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No prior versions yet.</p>
            ) : (
              (versionsQ.data ?? []).map((v) => (
                <div key={v.id} className="p-3 rounded border border-border bg-muted/20">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-medium">v{v.version}</span>
                      <span className="text-muted-foreground">{new Date(v.created_at).toLocaleString()}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">{VISIBILITY_LABELS[v.visibility ?? "all"]}</span>
                      {!v.is_active && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Inactive</span>}
                    </div>
                    {canEdit && (
                      <Button size="sm" variant="ghost" className="gap-1 text-xs" onClick={() => restore.mutate(v)} disabled={restore.isPending}>
                        <RotateCcw className="w-3 h-3" /> Restore
                      </Button>
                    )}
                  </div>
                  <div className="text-xs font-medium">{v.label}</div>
                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap mt-1 font-sans">{v.content}</pre>
                </div>
              ))
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Older estimates keep the wording they were created with. Restoring a version updates the active template only.
          </p>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default NotesTemplates;
