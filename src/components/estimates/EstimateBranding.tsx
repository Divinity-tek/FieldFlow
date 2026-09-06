import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Upload, Image as ImageIcon, Save, Palette } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";

export type EstimateBranding = {
  id?: string;
  company_name?: string | null;
  company_address?: string | null;
  company_email?: string | null;
  company_phone?: string | null;
  company_website?: string | null;
  logo_url?: string | null;
  primary_color: string;
  accent_color: string;
  footer_text?: string | null;
};

const DEFAULTS: EstimateBranding = {
  company_name: "",
  company_address: "",
  company_email: "",
  company_phone: "",
  company_website: "",
  logo_url: "",
  primary_color: "#2563eb",
  accent_color: "#1e293b",
  footer_text: "",
};

export const useEstimateBranding = () =>
  useQuery({
    queryKey: ["estimate-branding"],
    queryFn: async () => {
      const { data } = await supabase
        .from("estimate_branding" as any)
        .select("*")
        .eq("is_active", true)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return (data as any as EstimateBranding) || null;
    },
    staleTime: 60_000,
  });

const EstimateBrandingPanel = () => {
  const qc = useQueryClient();
  const { isAdmin, isTeamLead } = useUserRole();
  const canEdit = isAdmin || isTeamLead;
  const { data: existing } = useEstimateBranding();
  const [form, setForm] = useState<EstimateBranding>(DEFAULTS);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (existing) setForm({ ...DEFAULTS, ...existing });
  }, [existing]);

  const set = <K extends keyof EstimateBranding>(k: K, v: EstimateBranding[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const onLogoUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Please upload an image"); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error("Logo must be under 2MB"); return; }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `logos/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("estimate-branding").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (error) throw error;
      const { data } = supabase.storage.from("estimate-branding").getPublicUrl(path);
      set("logo_url", data.publicUrl);
      toast.success("Logo uploaded");
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload: any = { ...form, is_active: true };
      delete payload.created_at;
      delete payload.updated_at;
      let res;
      if (existing?.id) {
        res = await supabase.from("estimate_branding" as any).update(payload).eq("id", existing.id);
      } else {
        res = await supabase.from("estimate_branding" as any).insert(payload);
      }
      if (res.error) throw res.error;
      toast.success("Branding saved");
      qc.invalidateQueries({ queryKey: ["estimate-branding"] });
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Palette className="w-4 h-4" /> Estimate PDF Branding
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!canEdit && (
          <p className="text-xs text-muted-foreground">
            Only admins and team leads can edit branding. The current settings are applied to all PDFs.
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-4">
          <div className="space-y-2">
            <Label>Logo</Label>
            <div className="aspect-square w-full border border-dashed border-border rounded-md flex items-center justify-center bg-muted/30 overflow-hidden">
              {form.logo_url ? (
                <img src={form.logo_url} alt="Logo preview" className="max-w-full max-h-full object-contain" />
              ) : (
                <ImageIcon className="w-8 h-8 text-muted-foreground" />
              )}
            </div>
            <label className="block">
              <input
                type="file"
                accept="image/*"
                disabled={!canEdit || uploading}
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onLogoUpload(f); e.target.value = ""; }}
              />
              <Button asChild variant="outline" size="sm" className="w-full gap-1" disabled={!canEdit || uploading}>
                <span><Upload className="w-3 h-3" /> {uploading ? "Uploading…" : "Upload Logo"}</span>
              </Button>
            </label>
            {form.logo_url && canEdit && (
              <Button variant="ghost" size="sm" className="w-full text-destructive" onClick={() => set("logo_url", "")}>
                Remove
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Company Name</Label>
              <Input value={form.company_name || ""} disabled={!canEdit} onChange={(e) => set("company_name", e.target.value)} placeholder="Acme Inc." />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email</Label>
              <Input value={form.company_email || ""} disabled={!canEdit} onChange={(e) => set("company_email", e.target.value)} placeholder="billing@acme.com" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Phone</Label>
              <Input value={form.company_phone || ""} disabled={!canEdit} onChange={(e) => set("company_phone", e.target.value)} placeholder="+1 555 123 4567" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Website</Label>
              <Input value={form.company_website || ""} disabled={!canEdit} onChange={(e) => set("company_website", e.target.value)} placeholder="acme.com" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Address</Label>
              <Textarea rows={2} value={form.company_address || ""} disabled={!canEdit} onChange={(e) => set("company_address", e.target.value)} placeholder="123 Main St, City, Country" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Primary Color (header & totals)</Label>
            <div className="flex gap-2">
              <Input type="color" value={form.primary_color} disabled={!canEdit} onChange={(e) => set("primary_color", e.target.value)} className="w-14 h-10 p-1 cursor-pointer" />
              <Input value={form.primary_color} disabled={!canEdit} onChange={(e) => set("primary_color", e.target.value)} className="flex-1" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Accent Color (text & borders)</Label>
            <div className="flex gap-2">
              <Input type="color" value={form.accent_color} disabled={!canEdit} onChange={(e) => set("accent_color", e.target.value)} className="w-14 h-10 p-1 cursor-pointer" />
              <Input value={form.accent_color} disabled={!canEdit} onChange={(e) => set("accent_color", e.target.value)} className="flex-1" />
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Footer Text</Label>
          <Textarea
            rows={2}
            value={form.footer_text || ""}
            disabled={!canEdit}
            onChange={(e) => set("footer_text", e.target.value)}
            placeholder="Thank you for your business!"
            maxLength={500}
          />
        </div>

        {canEdit && (
          <div className="flex justify-end">
            <Button onClick={save} disabled={saving} className="gap-1">
              <Save className="w-3 h-3" /> {saving ? "Saving…" : "Save Branding"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default EstimateBrandingPanel;
