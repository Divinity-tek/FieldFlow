import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { normalizeCountry, isUS, normalizeUSState, isValidUSState } from "@/lib/countries";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Building2, Edit, Plus, Trash2, Search, UserPlus, MapPin, Globe, Power, PowerOff, Upload, Loader2, X } from "lucide-react";

// ---------- Validation ----------
const US_ZIP_RE = /^\d{5}(-\d{4})?$/;

const partnerSchema = z
  .object({
    company_name: z
      .string()
      .trim()
      .nonempty({ message: "Company name is required" })
      .max(150, { message: "Company name must be 150 characters or less" }),
    contact_name: z
      .string()
      .trim()
      .nonempty({ message: "Contact name is required" })
      .max(100, { message: "Contact name must be 100 characters or less" }),
    email: z
      .string()
      .trim()
      .email({ message: "Invalid email address" })
      .max(255, { message: "Email must be 255 characters or less" }),
    phone: z
      .string()
      .trim()
      .max(40, { message: "Phone must be 40 characters or less" })
      .refine(
        (v) => !v || (/^[+\d\s().-]+$/.test(v) && v.replace(/\D/g, "").length >= 7 && v.replace(/\D/g, "").length <= 20),
        { message: "Enter a valid phone number (7-20 digits)" }
      )
      .optional()
      .or(z.literal("")),
    commission_rate: z
      .number({ invalid_type_error: "Commission must be a number" })
      .min(0, { message: "Commission cannot be negative" })
      .max(100, { message: "Commission cannot exceed 100%" }),
    address_line1: z.string().trim().max(200).optional().or(z.literal("")),
    city: z.string().trim().max(100).optional().or(z.literal("")),
    region: z.string().trim().max(100).optional().or(z.literal("")),
    postcode: z.string().trim().max(20).optional().or(z.literal("")),
    country: z.string().trim().max(100).optional().or(z.literal("")),
    website: z
      .string()
      .trim()
      .max(255, { message: "Website must be 255 characters or less" })
      .url({ message: "Website must be a valid URL (https://example.com)" })
      .optional()
      .or(z.literal("")),
    tax_number: z.string().trim().max(50, { message: "Tax number must be 50 characters or less" }).optional().or(z.literal("")),
    billing_contact_name: z.string().trim().max(100).optional().or(z.literal("")),
    billing_contact_email: z.string().trim().max(255).email({ message: "Invalid billing email" }).optional().or(z.literal("")),
    billing_contact_phone: z
      .string()
      .trim()
      .max(40)
      .refine(
        (v) => !v || (/^[+\d\s().-]+$/.test(v) && v.replace(/\D/g, "").length >= 7 && v.replace(/\D/g, "").length <= 20),
        { message: "Enter a valid billing phone number" }
      )
      .optional()
      .or(z.literal("")),
    logo_url: z
      .string()
      .trim()
      .max(500)
      .url({ message: "Logo URL must be a valid URL" })
      .optional()
      .or(z.literal("")),
    is_active: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (!isUS(data.country)) return;

    if (!data.address_line1?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["address_line1"],
        message: "Street address is required for US partners",
      });
    }
    if (!data.city?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["city"],
        message: "City is required for US partners",
      });
    }
    if (!data.region?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["region"],
        message: "State is required for US partners (e.g. WY)",
      });
    } else if (!isValidUSState(data.region)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["region"],
        message: "Enter a valid US state (2-letter code like WY, or full name)",
      });
    }
    if (!data.postcode?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["postcode"],
        message: "ZIP code is required for US partners",
      });
    } else if (!US_ZIP_RE.test(data.postcode.trim())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["postcode"],
        message: "ZIP must be 5 digits or ZIP+4 (e.g. 82801 or 82801-1234)",
      });
    }
  });

type PartnerForm = z.infer<typeof partnerSchema>;

const emptyForm: PartnerForm = {
  company_name: "",
  contact_name: "",
  email: "",
  phone: "",
  commission_rate: 0,
  address_line1: "",
  city: "",
  region: "",
  postcode: "",
  country: "",
  website: "",
  tax_number: "",
  billing_contact_name: "",
  billing_contact_email: "",
  billing_contact_phone: "",
  logo_url: "",
  is_active: true,
};

interface PartnerRow {
  id: string;
  user_id: string | null;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string | null;
  commission_rate: number | null;
  address_line1: string | null;
  city: string | null;
  region: string | null;
  postcode: string | null;
  country: string | null;
  website: string | null;
  tax_number: string | null;
  logo_url: string | null;
  is_active: boolean;
  created_at: string;
}

type PartnerFormErrors = Partial<Record<keyof PartnerForm, string>>;

const Partners = () => {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<PartnerForm>(emptyForm);
  const [errors, setErrors] = useState<PartnerFormErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [qaMode, setQaMode] = useState(false);
  const [qaOriginalUrl, setQaOriginalUrl] = useState<string | null>(null);
  const [qaProcessedUrl, setQaProcessedUrl] = useState<string | null>(null);
  const [qaOriginalDims, setQaOriginalDims] = useState<{ w: number; h: number; size: number; type: string } | null>(null);
  const [qaProcessedDims, setQaProcessedDims] = useState<{ w: number; h: number; size: number; type: string } | null>(null);

  /** Run zod schema and flatten field errors into { field: firstMessage }. */
  const validateForm = (values: PartnerForm): PartnerFormErrors => {
    const result = partnerSchema.safeParse(values);
    if (result.success) return {};
    const errs: PartnerFormErrors = {};
    for (const issue of result.error.issues) {
      const key = issue.path[0] as keyof PartnerForm | undefined;
      if (key && !errs[key]) errs[key] = issue.message;
    }
    return errs;
  };

  // Live re-validate after the first save attempt so highlights clear as the user fixes fields.
  useEffect(() => {
    if (submitted) setErrors(validateForm(form));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, submitted]);

  /** Tailwind class fragment for a field's error border + ring. */
  const errClass = (k: keyof PartnerForm) =>
    errors[k] ? "border-destructive focus-visible:ring-destructive" : "";
  const errLabel = (k: keyof PartnerForm) =>
    errors[k] ? "text-destructive" : "";


  const convertToWebFriendly = (file: File): Promise<{ blob: Blob; ext: string; contentType: string }> =>
    new Promise((resolve, reject) => {
      // SVGs are already web-friendly and vector — keep as-is
      if (file.type === "image/svg+xml") {
        resolve({ blob: file, ext: "svg", contentType: "image/svg+xml" });
        return;
      }

      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        try {
          const SIZE = 512; // square output for consistent aspect ratio
          const PADDING = 0.08; // 8% padding around the logo
          const inner = SIZE * (1 - PADDING * 2);

          // Fit logo inside inner box, preserving aspect ratio
          const scale = Math.min(inner / img.width, inner / img.height);
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const dx = Math.round((SIZE - w) / 2);
          const dy = Math.round((SIZE - h) / 2);

          const canvas = document.createElement("canvas");
          canvas.width = SIZE;
          canvas.height = SIZE;
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("Canvas not supported");
          ctx.imageSmoothingQuality = "high";

          // JPEGs can't be transparent — fill white background for padding
          const hasAlpha = ["image/png", "image/webp", "image/gif"].includes(file.type);
          if (!hasAlpha) {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, SIZE, SIZE);
          } else {
            ctx.clearRect(0, 0, SIZE, SIZE);
          }

          ctx.drawImage(img, dx, dy, w, h);

          const outType = hasAlpha ? "image/png" : "image/jpeg";
          const outExt = hasAlpha ? "png" : "jpg";

          canvas.toBlob(
            (blob) => {
              URL.revokeObjectURL(url);
              if (!blob) return reject(new Error("Image conversion failed"));
              resolve({ blob, ext: outExt, contentType: outType });
            },
            outType,
            outType === "image/jpeg" ? 0.9 : undefined
          );
        } catch (err) {
          URL.revokeObjectURL(url);
          reject(err);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Could not read image file"));
      };
      img.src = url;
    });

  const handleLogoUpload = async (file: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be smaller than 5MB");
      return;
    }
    setUploadingLogo(true);
    try {
      // Capture original for QA
      if (qaOriginalUrl) URL.revokeObjectURL(qaOriginalUrl);
      if (qaProcessedUrl) URL.revokeObjectURL(qaProcessedUrl);
      const origUrl = URL.createObjectURL(file);
      const origDims = await new Promise<{ w: number; h: number }>((res) => {
        const i = new Image();
        i.onload = () => res({ w: i.naturalWidth, h: i.naturalHeight });
        i.onerror = () => res({ w: 0, h: 0 });
        i.src = origUrl;
      });
      setQaOriginalUrl(origUrl);
      setQaOriginalDims({ w: origDims.w, h: origDims.h, size: file.size, type: file.type });

      const { blob, ext, contentType } = await convertToWebFriendly(file);
      const procUrl = URL.createObjectURL(blob);
      setQaProcessedUrl(procUrl);
      setQaProcessedDims({
        w: ext === "svg" ? origDims.w : 512,
        h: ext === "svg" ? origDims.h : 512,
        size: blob.size,
        type: contentType,
      });

      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("partner-logos")
        .upload(path, blob, { cacheControl: "3600", upsert: false, contentType });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("partner-logos").getPublicUrl(path);
      setForm((f) => ({ ...f, logo_url: data.publicUrl }));
      toast.success(`Logo uploaded as ${ext.toUpperCase()}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    } finally {
      setUploadingLogo(false);
    }
  };

  const { data: partners = [], isLoading } = useQuery({
    queryKey: ["partners-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("partners")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as PartnerRow[]) ?? [];
    },
  });

  const upsertMutation = useMutation({
    mutationFn: async (values: PartnerForm) => {
      const parsed = partnerSchema.parse(values);
      const normalizedCountry = normalizeCountry(parsed.country);
      const normalizedRegion = isUS(normalizedCountry)
        ? normalizeUSState(parsed.region)
        : parsed.region?.trim() || "";
      const payload = {
        company_name: parsed.company_name,
        contact_name: parsed.contact_name,
        email: parsed.email,
        phone: parsed.phone || null,
        commission_rate: parsed.commission_rate,
        address_line1: parsed.address_line1 || null,
        city: parsed.city || null,
        region: normalizedRegion || null,
        postcode: parsed.postcode || null,
        country: normalizedCountry || null,
        website: parsed.website || null,
        tax_number: parsed.tax_number || null,
        billing_contact_name: parsed.billing_contact_name || null,
        billing_contact_email: parsed.billing_contact_email || null,
        billing_contact_phone: parsed.billing_contact_phone || null,
        logo_url: parsed.logo_url || null,
        is_active: parsed.is_active,
      };

      if (editId) {
        const { error } = await supabase.from("partners").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("partners").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["partners-admin"] });
      toast.success(editId ? "Partner updated" : "Partner created");
      resetForm();
    },
    onError: (e: any) => {
      if (e instanceof z.ZodError) {
        const msgs = e.errors.map((er) => er.message);
        toast.error(msgs[0] ?? "Invalid input", {
          description: msgs.length > 1 ? msgs.slice(1).join(" • ") : undefined,
        });
      } else {
        toast.error(e?.message ?? "Failed to save partner");
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("partners").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["partners-admin"] });
      toast.success("Partner deleted");
      setDeleteId(null);
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to delete"),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("partners")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["partners-admin"] });
      toast.success(vars.is_active ? "Partner enabled" : "Partner disabled");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to update status"),
  });

  const resetForm = () => {
    setForm(emptyForm);
    setEditId(null);
    setErrors({});
    setSubmitted(false);
    setDialogOpen(false);
  };

  const startEdit = (p: PartnerRow) => {
    setEditId(p.id);
    setForm({
      company_name: p.company_name ?? "",
      contact_name: p.contact_name ?? "",
      email: p.email ?? "",
      phone: p.phone ?? "",
      commission_rate: Number(p.commission_rate ?? 0),
      address_line1: p.address_line1 ?? "",
      city: p.city ?? "",
      region: p.region ?? "",
      postcode: p.postcode ?? "",
      country: p.country ?? "",
      website: p.website ?? "",
      tax_number: p.tax_number ?? "",
      billing_contact_name: (p as any).billing_contact_name ?? "",
      billing_contact_email: (p as any).billing_contact_email ?? "",
      billing_contact_phone: (p as any).billing_contact_phone ?? "",
      logo_url: p.logo_url ?? "",
      is_active: p.is_active ?? true,
    });
    setErrors({});
    setSubmitted(false);
    setDialogOpen(true);
  };

  const startCreate = () => {
    setEditId(null);
    setForm(emptyForm);
    setErrors({});
    setSubmitted(false);
    setDialogOpen(true);
  };

  const filtered = partners.filter((p) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      p.company_name?.toLowerCase().includes(q) ||
      p.contact_name?.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q) ||
      p.city?.toLowerCase().includes(q) ||
      p.country?.toLowerCase().includes(q)
    );
  });

  return (
    <AppLayout title="Partner Entities">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Building2 className="h-7 w-7 text-primary" />
              Partner Entities
            </h1>
            <p className="text-muted-foreground">
              Manage organizations that own dispatches. Login linkage is optional.
            </p>
          </div>
          <Button onClick={startCreate} className="gap-2">
            <Plus className="h-4 w-4" /> New Partner
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-4">
              <CardTitle className="text-lg">All Partners</CardTitle>
              <div className="relative w-64 max-w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search partners..."
                  className="pl-9"
                  maxLength={100}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Loading partners…</p>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No partners found.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Company</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Commission</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((p) => (
                      <TableRow key={p.id} className={p.is_active === false ? "opacity-60" : ""}>
                        <TableCell className="font-medium">
                          <div>{p.company_name}</div>
                          {p.address_line1 && (
                            <div className="text-xs text-muted-foreground">
                              {p.address_line1}
                            </div>
                          )}
                          {p.website && (
                            <a
                              href={p.website}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-0.5"
                            >
                              <Globe className="h-3 w-3" />
                              {p.website.replace(/^https?:\/\//, "")}
                            </a>
                          )}
                        </TableCell>
                        <TableCell>
                          <div>{p.contact_name}</div>
                          <div className="text-xs text-muted-foreground">{p.email}</div>
                          {p.phone && (
                            <div className="text-xs text-muted-foreground">{p.phone}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          {p.city || p.country ? (
                            <div className="flex items-start gap-1 text-sm">
                              <MapPin className="h-3.5 w-3.5 mt-0.5 text-muted-foreground" />
                              <div>
                                <div>
                                  {[p.city, p.region].filter(Boolean).join(", ")}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {[p.postcode, p.country].filter(Boolean).join(" · ")}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {Number(p.commission_rate ?? 0).toFixed(2)}%
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {p.is_active === false ? (
                            <Badge variant="outline" className="border-destructive/40 text-destructive gap-1">
                              <PowerOff className="h-3 w-3" /> Disabled
                            </Badge>
                          ) : (
                            <Badge className="bg-green-500/15 text-green-700 dark:text-green-400 border border-green-500/30 gap-1">
                              <Power className="h-3 w-3" /> Active
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {p.user_id ? (
                            <Badge className="bg-green-500/15 text-green-700 dark:text-green-400 border border-green-500/30">
                              Linked
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1">
                              <UserPlus className="h-3 w-3" /> Unlinked
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => startEdit(p)}
                            title="Edit partner"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              toggleActiveMutation.mutate({
                                id: p.id,
                                is_active: !(p.is_active ?? true),
                              })
                            }
                            disabled={toggleActiveMutation.isPending}
                            title={p.is_active === false ? "Enable partner" : "Disable partner"}
                          >
                            {p.is_active === false ? (
                              <Power className="h-4 w-4 text-green-600" />
                            ) : (
                              <PowerOff className="h-4 w-4 text-amber-600" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDeleteId(p.id)}
                            title="Delete partner"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => (o ? setDialogOpen(true) : resetForm())}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Partner" : "New Partner"}</DialogTitle>
            <DialogDescription>
              Login account is optional — partners can be admin-managed.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div className="sm:col-span-2">
              <Label htmlFor="company" className={errLabel("company_name")}>Company Name *</Label>
              <Input
                id="company"
                value={form.company_name}
                maxLength={150}
                onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                aria-invalid={!!errors.company_name}
                className={errClass("company_name")}
              />
              {errors.company_name && <p className="text-xs text-destructive mt-1">{errors.company_name}</p>}
            </div>
            <div>
              <Label htmlFor="contact" className={errLabel("contact_name")}>Contact Name *</Label>
              <Input
                id="contact"
                value={form.contact_name}
                maxLength={100}
                onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
                aria-invalid={!!errors.contact_name}
                className={errClass("contact_name")}
              />
              {errors.contact_name && <p className="text-xs text-destructive mt-1">{errors.contact_name}</p>}
            </div>
            <div>
              <Label htmlFor="email" className={errLabel("email")}>Email *</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                maxLength={255}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                aria-invalid={!!errors.email}
                className={errClass("email")}
              />
              {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
            </div>
            <div>
              <Label htmlFor="phone" className={errLabel("phone")}>Phone</Label>
              <Input
                id="phone"
                type="tel"
                inputMode="tel"
                value={form.phone ?? ""}
                maxLength={40}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                aria-invalid={!!errors.phone}
                className={errClass("phone")}
              />
              {errors.phone && <p className="text-xs text-destructive mt-1">{errors.phone}</p>}
            </div>
            <div>
              <Label htmlFor="commission" className={errLabel("commission_rate")}>Commission Rate (%)</Label>
              <Input
                id="commission"
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={form.commission_rate}
                onChange={(e) =>
                  setForm({ ...form, commission_rate: Number(e.target.value) })
                }
                aria-invalid={!!errors.commission_rate}
                className={errClass("commission_rate")}
              />
              {errors.commission_rate && <p className="text-xs text-destructive mt-1">{errors.commission_rate}</p>}
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="address" className={errLabel("address_line1")}>Address</Label>
              <Input
                id="address"
                value={form.address_line1 ?? ""}
                maxLength={200}
                onChange={(e) => setForm({ ...form, address_line1: e.target.value })}
                aria-invalid={!!errors.address_line1}
                className={errClass("address_line1")}
              />
              {errors.address_line1 && <p className="text-xs text-destructive mt-1">{errors.address_line1}</p>}
            </div>
            <div>
              <Label htmlFor="city" className={errLabel("city")}>City</Label>
              <Input
                id="city"
                value={form.city ?? ""}
                maxLength={100}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                aria-invalid={!!errors.city}
                className={errClass("city")}
              />
              {errors.city && <p className="text-xs text-destructive mt-1">{errors.city}</p>}
            </div>
            <div>
              <Label htmlFor="region" className={errLabel("region")}>Region / State</Label>
              <Input
                id="region"
                value={form.region ?? ""}
                maxLength={100}
                onChange={(e) => setForm({ ...form, region: e.target.value })}
                aria-invalid={!!errors.region}
                className={errClass("region")}
              />
              {errors.region && <p className="text-xs text-destructive mt-1">{errors.region}</p>}
            </div>
            <div>
              <Label htmlFor="postcode" className={errLabel("postcode")}>Postcode</Label>
              <Input
                id="postcode"
                value={form.postcode ?? ""}
                maxLength={20}
                onChange={(e) => setForm({ ...form, postcode: e.target.value })}
                aria-invalid={!!errors.postcode}
                className={errClass("postcode")}
              />
              {errors.postcode && <p className="text-xs text-destructive mt-1">{errors.postcode}</p>}
            </div>
            <div>
              <Label htmlFor="country" className={errLabel("country")}>Country</Label>
              <Input
                id="country"
                value={form.country ?? ""}
                maxLength={100}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
                aria-invalid={!!errors.country}
                className={errClass("country")}
              />
              {errors.country && <p className="text-xs text-destructive mt-1">{errors.country}</p>}
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="website" className={errLabel("website")}>Website</Label>
              <Input
                id="website"
                type="url"
                placeholder="https://example.com"
                value={form.website ?? ""}
                maxLength={255}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
                aria-invalid={!!errors.website}
                className={errClass("website")}
              />
              {errors.website && <p className="text-xs text-destructive mt-1">{errors.website}</p>}
            </div>
            <div>
              <Label htmlFor="tax_number" className={errLabel("tax_number")}>Tax / VAT Number</Label>
              <Input
                id="tax_number"
                placeholder="e.g. EIN 88-1234567 / GSTIN / VAT"
                value={form.tax_number ?? ""}
                maxLength={50}
                onChange={(e) => setForm({ ...form, tax_number: e.target.value })}
                aria-invalid={!!errors.tax_number}
                className={errClass("tax_number")}
              />
              {errors.tax_number && <p className="text-xs text-destructive mt-1">{errors.tax_number}</p>}
            </div>
            <div className="sm:col-span-2 border-t pt-3 mt-1">
              <h4 className="text-sm font-semibold mb-1">Billing Contact</h4>
              <p className="text-xs text-muted-foreground mb-2">
                Used as the "Attention" line on estimates and invoices. Leave blank to use the main contact.
              </p>
            </div>
            <div>
              <Label htmlFor="billing_contact_name" className={errLabel("billing_contact_name")}>Billing Contact Name</Label>
              <Input
                id="billing_contact_name"
                value={form.billing_contact_name ?? ""}
                maxLength={100}
                onChange={(e) => setForm({ ...form, billing_contact_name: e.target.value })}
                aria-invalid={!!errors.billing_contact_name}
                className={errClass("billing_contact_name")}
              />
              {errors.billing_contact_name && <p className="text-xs text-destructive mt-1">{errors.billing_contact_name}</p>}
            </div>
            <div>
              <Label htmlFor="billing_contact_email" className={errLabel("billing_contact_email")}>Billing Email</Label>
              <Input
                id="billing_contact_email"
                type="email"
                value={form.billing_contact_email ?? ""}
                maxLength={255}
                onChange={(e) => setForm({ ...form, billing_contact_email: e.target.value })}
                aria-invalid={!!errors.billing_contact_email}
                className={errClass("billing_contact_email")}
              />
              {errors.billing_contact_email && <p className="text-xs text-destructive mt-1">{errors.billing_contact_email}</p>}
            </div>
            <div>
              <Label htmlFor="billing_contact_phone" className={errLabel("billing_contact_phone")}>Billing Phone</Label>
              <Input
                id="billing_contact_phone"
                type="tel"
                inputMode="tel"
                value={form.billing_contact_phone ?? ""}
                maxLength={40}
                onChange={(e) => setForm({ ...form, billing_contact_phone: e.target.value })}
                aria-invalid={!!errors.billing_contact_phone}
                className={errClass("billing_contact_phone")}
              />
              {errors.billing_contact_phone && <p className="text-xs text-destructive mt-1">{errors.billing_contact_phone}</p>}
            </div>
            <div>
              <Label htmlFor="logo_url">Partner Logo</Label>
              <div className="flex gap-2">
                <Input
                  id="logo_url"
                  type="url"
                  placeholder="https://.../logo.png or upload below"
                  value={form.logo_url ?? ""}
                  maxLength={500}
                  onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
                />
                {form.logo_url ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setForm({ ...form, logo_url: "" })}
                    title="Clear logo"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
              <div className="mt-2">
                <input
                  id="logo_file"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleLogoUpload(file);
                    e.target.value = "";
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  disabled={uploadingLogo}
                  onClick={() => document.getElementById("logo_file")?.click()}
                >
                  {uploadingLogo ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading…
                    </>
                  ) : (
                    <>
                      <Upload className="h-3.5 w-3.5" /> Upload image
                    </>
                  )}
                </Button>
                <span className="ml-2 text-[11px] text-muted-foreground">PNG, JPG, SVG · up to 5MB</span>
                {qaOriginalUrl && qaProcessedUrl && (
                  <Button
                    type="button"
                    variant={qaMode ? "default" : "ghost"}
                    size="sm"
                    className="ml-auto h-7 text-[11px]"
                    onClick={() => setQaMode((v) => !v)}
                  >
                    {qaMode ? "Hide QA compare" : "QA compare"}
                  </Button>
                )}
              </div>
              <div className="mt-2 flex items-center gap-3 rounded-lg border border-dashed border-border bg-muted/30 p-2">
                <div className="w-12 h-12 rounded-md bg-background border border-border flex items-center justify-center overflow-hidden shrink-0">
                  {form.logo_url?.trim() ? (
                    <img
                      src={form.logo_url}
                      alt="Logo preview"
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = "none";
                        const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
                        if (fallback) fallback.style.display = "flex";
                      }}
                      onLoad={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = "block";
                        const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
                        if (fallback) fallback.style.display = "none";
                      }}
                    />
                  ) : null}
                  <div
                    className="w-full h-full hidden items-center justify-center text-[10px] font-bold text-muted-foreground"
                    style={{ display: form.logo_url?.trim() ? "none" : "flex" }}
                  >
                    {form.company_name?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                </div>
                <div className="text-[11px] text-muted-foreground leading-tight">
                  <p className="font-medium text-card-foreground">Live preview</p>
                  <p>{form.logo_url?.trim() ? "Loaded from the URL above." : "Upload a file or paste a URL to preview."}</p>
                </div>
              </div>

              {qaMode && qaOriginalUrl && qaProcessedUrl && (
                <div className="mt-3 rounded-lg border border-border bg-card p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-card-foreground">QA Compare</p>
                    <p className="text-[10px] text-muted-foreground">
                      Original vs processed (512×512, 8% padding)
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Original</span>
                        {qaOriginalDims && (
                          <span className="text-[10px] text-muted-foreground">
                            {qaOriginalDims.w}×{qaOriginalDims.h} · {(qaOriginalDims.size / 1024).toFixed(1)}KB
                          </span>
                        )}
                      </div>
                      <div className="aspect-square w-full rounded-md border border-border bg-muted/30 overflow-hidden flex items-center justify-center">
                        <img src={qaOriginalUrl} alt="Original logo" className="max-w-full max-h-full" />
                      </div>
                      <p className="text-[10px] text-muted-foreground truncate">{qaOriginalDims?.type}</p>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase tracking-wide text-primary">Processed</span>
                        {qaProcessedDims && (
                          <span className="text-[10px] text-muted-foreground">
                            {qaProcessedDims.w}×{qaProcessedDims.h} · {(qaProcessedDims.size / 1024).toFixed(1)}KB
                          </span>
                        )}
                      </div>
                      <div className="aspect-square w-full rounded-md border-2 border-primary/40 bg-muted/30 overflow-hidden flex items-center justify-center">
                        <img src={qaProcessedUrl} alt="Processed logo" className="w-full h-full object-contain" />
                      </div>
                      <p className="text-[10px] text-muted-foreground truncate">{qaProcessedDims?.type}</p>
                    </div>
                  </div>
                  {qaOriginalDims && qaProcessedDims && qaOriginalDims.size > 0 && (
                    <p className="mt-2 text-[10px] text-muted-foreground">
                      Size change: {(((qaProcessedDims.size - qaOriginalDims.size) / qaOriginalDims.size) * 100).toFixed(0)}% · Aspect normalized to 1:1
                    </p>
                  )}
                </div>
              )}
            </div>
            <div className="sm:col-span-2 flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <Label htmlFor="is_active" className="text-base">
                  Active
                </Label>
                <p className="text-xs text-muted-foreground">
                  Disabled partners are hidden from new dispatch flows.
                </p>
              </div>
              <Switch
                id="is_active"
                checked={form.is_active}
                onCheckedChange={(v) => setForm({ ...form, is_active: v })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setSubmitted(true);
                const errs = validateForm(form);
                setErrors(errs);
                if (Object.keys(errs).length > 0) {
                  toast.error("Please fix the highlighted fields");
                  return;
                }
                upsertMutation.mutate(form);
              }}
              disabled={upsertMutation.isPending}
            >
              {upsertMutation.isPending
                ? "Saving…"
                : editId
                ? "Save Changes"
                : "Create Partner"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete partner?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the partner entity. Linked clients will keep
              their records but will no longer reference this partner.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default Partners;
