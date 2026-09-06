import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Building2, Plus, Mail, Phone, Globe, Receipt, Package,
  ExternalLink, Pencil, Trash2, FileText, Search, X,
} from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import PortalAdvanced from "@/components/portal/PortalAdvanced";
import BulkClientImport from "@/components/portal/BulkClientImport";
import { format } from "date-fns";
import { z } from "zod";

const clientSchema = z.object({
  company_name: z.string().trim().min(1, "Company name is required").max(255, "Max 255 characters"),
  contact_name: z.string().trim().min(1, "Contact person is required").max(255, "Max 255 characters"),
  email: z.string().trim().email("Invalid email address").max(255),
  contact_email: z.string().trim().email("Invalid email").max(255).optional().or(z.literal("")),
  website: z.string().trim().url("Must be a valid URL").max(500).optional().or(z.literal("")),
  logo_url: z.string().trim().url("Must be a valid URL").max(1000).optional().or(z.literal("")),
});

async function resizeImageToWebp(file: File, maxDim: number, quality: number): Promise<Blob | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    return await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/webp", quality)
    );
  } catch {
    return null;
  }
}

type LinkItem = { label: string; url: string };

interface Client {
  id: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string | null;
  address: string | null;
  entity_name: string | null;
  tax_id: string | null;
  tax_country: string | null;
  tax_notes: string | null;
  logo_url: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  website: string | null;
  links: LinkItem[] | null;
  notes: string | null;
  status: string;
}

const emptyForm = {
  company_name: "",
  entity_name: "",
  contact_name: "",
  email: "",
  phone: "",
  address: "",
  tax_id: "",
  tax_country: "",
  tax_notes: "",
  logo_url: "",
  contact_email: "",
  contact_phone: "",
  website: "",
  links_text: "",
  notes: "",
  status: "active",
  billing_contact_name: "",
  billing_contact_email: "",
  billing_contact_phone: "",
};

export default function CustomerPortal() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const ALLOWED_LOGO_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml"];
  const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2MB

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
      toast({
        title: "Unsupported file type",
        description: "Logo must be PNG, JPG, WEBP, or SVG.",
        variant: "destructive",
      });
      e.target.value = "";
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      toast({
        title: "File too large",
        description: `Logo must be under 2MB (got ${(file.size / 1024 / 1024).toFixed(2)}MB).`,
        variant: "destructive",
      });
      e.target.value = "";
      return;
    }
    if (file.size === 0) {
      toast({ title: "Empty file", description: "Selected file is empty.", variant: "destructive" });
      e.target.value = "";
      return;
    }
    setUploading(true);
    try {
      let uploadBlob: Blob = file;
      let ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
      let contentType = file.type;

      // Resize/optimize raster images to max 512x512 WebP. Leave SVG untouched.
      if (file.type !== "image/svg+xml") {
        const resized = await resizeImageToWebp(file, 512, 0.85);
        if (resized) {
          uploadBlob = resized;
          ext = "webp";
          contentType = "image/webp";
        }
      }

      const path = `${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("client-logos")
        .upload(path, uploadBlob, { upsert: false, contentType });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("client-logos").getPublicUrl(path);
      setForm((f) => ({ ...f, logo_url: data.publicUrl }));
      toast({
        title: "Logo uploaded",
        description: `Optimized to ${(uploadBlob.size / 1024).toFixed(1)} KB`,
      });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["customer-portal-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .order("company_name");
      if (error) throw error;
      return (data || []) as unknown as Client[];
    },
  });

  const statusOptions = Array.from(new Set(clients.map((c) => c.status).filter(Boolean)));
  const filteredClients = clients.filter((c) => {
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      c.company_name?.toLowerCase().includes(q) ||
      c.contact_name?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      (c.entity_name || "").toLowerCase().includes(q) ||
      (c.phone || "").toLowerCase().includes(q) ||
      (c.contact_email || "").toLowerCase().includes(q)
    );
  });

  const selected = filteredClients.find((c) => c.id === selectedId) || filteredClients[0] || null;
  const activeId = selected?.id;

  const { data: orders = [] } = useQuery({
    queryKey: ["customer-orders", activeId],
    enabled: !!activeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_orders")
        .select("*")
        .eq("client_id", activeId!)
        .order("ordered_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["customer-invoices", activeId],
    enabled: !!activeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_invoices")
        .select("*")
        .eq("client_id", activeId!)
        .order("issued_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const validateAndSubmit = () => {
    const result = clientSchema.safeParse({
      company_name: form.company_name,
      contact_name: form.contact_name,
      email: form.email,
      contact_email: form.contact_email,
      website: form.website,
      logo_url: form.logo_url,
    });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((i) => {
        const k = i.path[0] as string;
        if (k && !fieldErrors[k]) fieldErrors[k] = i.message;
      });
      setErrors(fieldErrors);
      toast({ title: "Please fix the errors", variant: "destructive" });
      return;
    }
    setErrors({});
    upsert.mutate();
  };

  const upsert = useMutation({
    mutationFn: async () => {
      const links: LinkItem[] = form.links_text
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => {
          const [label, url] = l.split("|").map((s) => s.trim());
          return { label: label || url, url: url || label };
        });

      const payload = {
        company_name: form.company_name,
        entity_name: form.entity_name || null,
        contact_name: form.contact_name,
        email: form.email,
        phone: form.phone || null,
        address: form.address || null,
        tax_id: form.tax_id || null,
        tax_country: form.tax_country || null,
        tax_notes: form.tax_notes || null,
        logo_url: form.logo_url || null,
        contact_email: form.contact_email || null,
        contact_phone: form.contact_phone || null,
        website: form.website || null,
        links,
        notes: form.notes || null,
        status: form.status,
        billing_contact_name: form.billing_contact_name || null,
        billing_contact_email: form.billing_contact_email || null,
        billing_contact_phone: form.billing_contact_phone || null,
      };
      if (editing) {
        const { error } = await supabase.from("clients").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("clients").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: editing ? "Client updated" : "Client added" });
      qc.invalidateQueries({ queryKey: ["customer-portal-clients"] });
      setDialogOpen(false);
      setEditing(null);
      setForm(emptyForm);
    },
    onError: (e: any) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Client removed" });
      qc.invalidateQueries({ queryKey: ["customer-portal-clients"] });
      setSelectedId(null);
    },
    onError: (e: any) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (c: Client) => {
    setEditing(c);
    setForm({
      company_name: c.company_name,
      entity_name: c.entity_name || "",
      contact_name: c.contact_name,
      email: c.email,
      phone: c.phone || "",
      address: c.address || "",
      tax_id: c.tax_id || "",
      tax_country: c.tax_country || "",
      tax_notes: c.tax_notes || "",
      logo_url: c.logo_url || "",
      contact_email: c.contact_email || "",
      contact_phone: c.contact_phone || "",
      website: c.website || "",
      links_text: (c.links || []).map((l) => `${l.label} | ${l.url}`).join("\n"),
      notes: c.notes || "",
      status: c.status,
      billing_contact_name: (c as any).billing_contact_name || "",
      billing_contact_email: (c as any).billing_contact_email || "",
      billing_contact_phone: (c as any).billing_contact_phone || "",
    });
    setDialogOpen(true);
  };

  const fmtMoney = (amt: number, cur: string) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: cur || "USD" }).format(amt);

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      paid: "bg-success/10 text-success border-success/20",
      sent: "bg-primary/10 text-primary border-primary/20",
      draft: "bg-muted text-muted-foreground",
      pending: "bg-warning/10 text-warning border-warning/20",
      in_progress: "bg-primary/10 text-primary border-primary/20",
      fulfilled: "bg-success/10 text-success border-success/20",
      active: "bg-success/10 text-success border-success/20",
    };
    return <Badge variant="outline" className={map[s] || ""}>{s}</Badge>;
  };

  return (
    <AppLayout title="Customer Portal">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Building2 className="h-7 w-7 text-primary" />
              Customer Portal
            </h1>
            <p className="text-muted-foreground mt-1">
              Admin-managed customer entities, tax details, contacts, invoices and orders.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <BulkClientImport />
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Add Client</Button>
              </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editing ? "Edit Client" : "Add Client"}</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Company Name *</Label>
                  <Input maxLength={255} value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} aria-invalid={!!errors.company_name} />
                  {errors.company_name && <p className="text-xs text-destructive mt-1">{errors.company_name}</p>}
                </div>
                <div>
                  <Label>Legal Entity Name</Label>
                  <Input maxLength={255} value={form.entity_name} onChange={(e) => setForm({ ...form, entity_name: e.target.value })} />
                </div>
                <div>
                  <Label>Contact Person *</Label>
                  <Input maxLength={255} value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} aria-invalid={!!errors.contact_name} />
                  {errors.contact_name && <p className="text-xs text-destructive mt-1">{errors.contact_name}</p>}
                </div>
                <div>
                  <Label>Account Email *</Label>
                  <Input type="email" maxLength={255} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} aria-invalid={!!errors.email} />
                  {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
                </div>
                <div>
                  <Label>Contact Email</Label>
                  <Input type="email" maxLength={255} value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} aria-invalid={!!errors.contact_email} />
                  {errors.contact_email && <p className="text-xs text-destructive mt-1">{errors.contact_email}</p>}
                </div>
                <div>
                  <Label>Contact Phone</Label>
                  <Input maxLength={50} value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input maxLength={50} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div className="md:col-span-2 border-t pt-3 mt-1">
                  <h4 className="text-sm font-semibold mb-1">Billing Contact</h4>
                  <p className="text-xs text-muted-foreground mb-2">
                    Used as the "Attention" line on estimates and invoices. Leave blank to use the main contact.
                  </p>
                </div>
                <div>
                  <Label>Billing Contact Name</Label>
                  <Input maxLength={100} value={form.billing_contact_name} onChange={(e) => setForm({ ...form, billing_contact_name: e.target.value })} />
                </div>
                <div>
                  <Label>Billing Email</Label>
                  <Input type="email" maxLength={255} value={form.billing_contact_email} onChange={(e) => setForm({ ...form, billing_contact_email: e.target.value })} />
                </div>
                <div>
                  <Label>Billing Phone</Label>
                  <Input maxLength={50} value={form.billing_contact_phone} onChange={(e) => setForm({ ...form, billing_contact_phone: e.target.value })} />
                </div>
                <div>
                  <Label>Website</Label>
                  <Input maxLength={500} value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://" aria-invalid={!!errors.website} />
                  {errors.website && <p className="text-xs text-destructive mt-1">{errors.website}</p>}
                </div>
                <div className="md:col-span-2">
                  <Label>Address</Label>
                  <Input maxLength={500} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                </div>
                <div className="md:col-span-2">
                  <Label>Logo</Label>
                  <div className="flex items-center gap-3 mt-1">
                    <Avatar className="h-14 w-14">
                      <AvatarImage src={form.logo_url || undefined} />
                      <AvatarFallback>{(form.company_name || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-2">
                      <Input
                        type="file"
                        accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml"
                        onChange={handleLogoUpload}
                        disabled={uploading}
                      />
                      <p className="text-xs text-muted-foreground">PNG, JPG, WEBP or SVG · max 2MB</p>
                      <Input
                        maxLength={1000}
                        value={form.logo_url}
                        onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
                        placeholder="…or paste a logo URL"
                        aria-invalid={!!errors.logo_url}
                      />
                      {errors.logo_url && <p className="text-xs text-destructive">{errors.logo_url}</p>}
                    </div>
                  </div>
                </div>
                <div>
                  <Label>Status</Label>
                  <Input value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} />
                </div>
                <div>
                  <Label>Tax ID / VAT</Label>
                  <Input maxLength={100} value={form.tax_id} onChange={(e) => setForm({ ...form, tax_id: e.target.value })} />
                </div>
                <div>
                  <Label>Tax Country</Label>
                  <Input maxLength={100} value={form.tax_country} onChange={(e) => setForm({ ...form, tax_country: e.target.value })} />
                </div>
                <div className="md:col-span-2">
                  <Label>Tax Notes</Label>
                  <Input maxLength={500} value={form.tax_notes} onChange={(e) => setForm({ ...form, tax_notes: e.target.value })} />
                </div>
                <div className="md:col-span-2">
                  <Label>Links (one per line, format: Label | https://url)</Label>
                  <Textarea rows={3} value={form.links_text} onChange={(e) => setForm({ ...form, links_text: e.target.value })} />
                </div>
                <div className="md:col-span-2">
                  <Label>Notes</Label>
                  <Textarea rows={3} maxLength={2000} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setDialogOpen(false); setErrors({}); }}>Cancel</Button>
                <Button onClick={validateAndSubmit} disabled={upsert.isPending || uploading}>
                  {upsert.isPending ? "Saving..." : editing ? "Save Changes" : "Create Client"}
                </Button>
              </DialogFooter>
            </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
          <Card>
            <CardHeader className="space-y-3">
              <CardTitle className="text-base">
                Clients ({filteredClients.length}
                {filteredClients.length !== clients.length ? ` of ${clients.length}` : ""})
              </CardTitle>
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search name, email, contact…"
                    className="pl-8 pr-8 h-9"
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label="Clear search"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    {statusOptions.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-0 max-h-[70vh] overflow-y-auto custom-scrollbar">
              {isLoading && <div className="p-4 text-sm text-muted-foreground">Loading...</div>}
              {!isLoading && clients.length === 0 && (
                <div className="p-4 text-sm text-muted-foreground">No clients yet.</div>
              )}
              {!isLoading && clients.length > 0 && filteredClients.length === 0 && (
                <div className="p-4 text-sm text-muted-foreground">No clients match your filters.</div>
              )}
              <ul className="divide-y">
                {filteredClients.map((c) => (
                  <li
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className={`p-3 cursor-pointer hover:bg-accent flex items-center gap-3 ${
                      selected?.id === c.id ? "bg-accent" : ""
                    }`}
                  >
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={c.logo_url || undefined} />
                      <AvatarFallback>{c.company_name.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{c.company_name}</div>
                      <div className="text-xs text-muted-foreground truncate">{c.contact_name}</div>
                    </div>
                    {statusBadge(c.status)}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {selected && (
            <div className="space-y-4">
              <Card>
                <CardHeader className="flex flex-row items-start justify-between">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16">
                      <AvatarImage src={selected.logo_url || undefined} />
                      <AvatarFallback className="text-lg">{selected.company_name.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-2xl">{selected.company_name}</CardTitle>
                      <p className="text-sm text-muted-foreground">{selected.entity_name || "—"}</p>
                      <div className="mt-1">{statusBadge(selected.status)}</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => openEdit(selected)}>
                      <Pencil className="h-4 w-4 mr-2" />Edit
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => {
                      if (confirm(`Delete ${selected.company_name}?`)) remove.mutate(selected.id);
                    }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="details">
                    <TabsList className="flex flex-wrap h-auto gap-1">
                      <TabsTrigger value="details">Details</TabsTrigger>
                      <TabsTrigger value="tax">Tax</TabsTrigger>
                      <TabsTrigger value="links">Links</TabsTrigger>
                      <TabsTrigger value="invoices">Invoices ({invoices.length})</TabsTrigger>
                      <TabsTrigger value="orders">Orders ({orders.length})</TabsTrigger>
                      <TabsTrigger value="advanced">Advanced</TabsTrigger>
                    </TabsList>

                    <TabsContent value="details" className="space-y-3 pt-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        <Field label="Contact Person" value={selected.contact_name} />
                        <Field label="Account Email" value={selected.email} icon={<Mail className="h-3.5 w-3.5" />} />
                        <Field label="Contact Email" value={selected.contact_email} icon={<Mail className="h-3.5 w-3.5" />} />
                        <Field label="Contact Phone" value={selected.contact_phone} icon={<Phone className="h-3.5 w-3.5" />} />
                        <Field label="Phone" value={selected.phone} icon={<Phone className="h-3.5 w-3.5" />} />
                        <Field label="Website" value={selected.website} icon={<Globe className="h-3.5 w-3.5" />} link />
                        <div className="md:col-span-2"><Field label="Address" value={selected.address} /></div>
                        <div className="md:col-span-2"><Field label="Notes" value={selected.notes} /></div>
                      </div>
                    </TabsContent>

                    <TabsContent value="tax" className="space-y-3 pt-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        <Field label="Tax ID / VAT" value={selected.tax_id} />
                        <Field label="Tax Country" value={selected.tax_country} />
                        <div className="md:col-span-2"><Field label="Tax Notes" value={selected.tax_notes} /></div>
                      </div>
                    </TabsContent>

                    <TabsContent value="links" className="pt-4">
                      {(!selected.links || selected.links.length === 0) && (
                        <p className="text-sm text-muted-foreground">No links added.</p>
                      )}
                      <ul className="space-y-2">
                        {(selected.links || []).map((l, i) => (
                          <li key={i}>
                            <a href={l.url} target="_blank" rel="noreferrer"
                              className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
                              <ExternalLink className="h-3.5 w-3.5" />{l.label}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </TabsContent>

                    <TabsContent value="invoices" className="pt-4">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Invoice #</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Issued</TableHead>
                            <TableHead>Due</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {invoices.map((inv: any) => (
                            <TableRow key={inv.id}>
                              <TableCell className="font-mono text-xs">{inv.invoice_number}</TableCell>
                              <TableCell>{inv.description || "—"}</TableCell>
                              <TableCell>{format(new Date(inv.issued_at), "MMM d, yyyy")}</TableCell>
                              <TableCell>{inv.due_at ? format(new Date(inv.due_at), "MMM d, yyyy") : "—"}</TableCell>
                              <TableCell className="text-right font-medium">{fmtMoney(Number(inv.total), inv.currency)}</TableCell>
                              <TableCell>{statusBadge(inv.status)}</TableCell>
                            </TableRow>
                          ))}
                          {invoices.length === 0 && (
                            <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                              <Receipt className="h-5 w-5 inline mr-2" />No invoices yet.
                            </TableCell></TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </TabsContent>

                    <TabsContent value="orders" className="pt-4">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Order #</TableHead>
                            <TableHead>Title</TableHead>
                            <TableHead>Ordered</TableHead>
                            <TableHead>Fulfilled</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {orders.map((o: any) => (
                            <TableRow key={o.id}>
                              <TableCell className="font-mono text-xs">{o.order_number}</TableCell>
                              <TableCell>{o.title}</TableCell>
                              <TableCell>{format(new Date(o.ordered_at), "MMM d, yyyy")}</TableCell>
                              <TableCell>{o.fulfilled_at ? format(new Date(o.fulfilled_at), "MMM d, yyyy") : "—"}</TableCell>
                              <TableCell className="text-right font-medium">{fmtMoney(Number(o.amount), o.currency)}</TableCell>
                              <TableCell>{statusBadge(o.status)}</TableCell>
                            </TableRow>
                          ))}
                          {orders.length === 0 && (
                            <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                              <Package className="h-5 w-5 inline mr-2" />No orders yet.
                            </TableCell></TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </TabsContent>

                    <TabsContent value="advanced" className="pt-4">
                      <PortalAdvanced clientId={selected.id} />
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

function Field({ label, value, icon, link }: { label: string; value: string | null; icon?: React.ReactNode; link?: boolean }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="flex items-center gap-1.5 mt-0.5">
        {icon}
        {value ? (
          link ? (
            <a href={value} target="_blank" rel="noreferrer" className="text-primary hover:underline truncate">{value}</a>
          ) : (
            <span className="truncate">{value}</span>
          )
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </div>
    </div>
  );
}
