import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import EngineerMobileLayout from "@/components/layout/EngineerMobileLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Mail, Phone, MapPin, Star, Briefcase, DollarSign, Pencil, Check, Shield, Car, Camera, FileText, Upload, ExternalLink, IdCard, Eye } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle } from "lucide-react";
import EngineerScorecard from "@/components/features/EngineerScorecard";

import CertificationBadges from "@/components/features/CertificationBadges";
import EngineerInfoCardPreview from "@/components/engineer/EngineerInfoCardPreview";

// Insurance format: "Type — Policy #XXX, Expires YYYY-MM-DD" or similar structured format
const INSURANCE_PATTERN = /^.{3,}\s*[—\-–]\s*(Policy|Ref|No\.?)\s*#?\s*\S+.*\d{4}[-/]\d{2}[-/]\d{2}/i;
const INSURANCE_HINT = "Format: Type — Policy #NUMBER, Expires YYYY-MM-DD";

// Vehicle plate patterns by region
const PLATE_PATTERNS: { label: string; regex: RegExp }[] = [
  { label: "UK", regex: /^[A-Z]{2}\d{2}\s?[A-Z]{3}$/ },           // AB12 CDE
  { label: "EU", regex: /^[A-Z]{1,3}\s?\d{1,4}\s?[A-Z]{0,3}$/ },  // B 1234 AB
  { label: "US", regex: /^[A-Z0-9]{2,8}$/ },                       // ABC1234
  { label: "UAE", regex: /^[A-Z]?\s?\d{1,5}$/ },                   // A 12345
];

const validateInsurance = (value: string): string | null => {
  if (!value.trim()) return null; // optional field
  if (value.trim().length < 10) return "Insurance details are too short — include provider, policy number, and expiry date.";
  if (!INSURANCE_PATTERN.test(value.trim())) return INSURANCE_HINT;
  return null;
};

const validatePlate = (value: string): string | null => {
  if (!value.trim()) return null; // optional field
  const cleaned = value.trim().toUpperCase();
  if (cleaned.length < 2) return "Plate number is too short.";
  const matched = PLATE_PATTERNS.some((p) => p.regex.test(cleaned));
  if (!matched) return `Plate doesn't match known formats (UK: AB12 CDE, US: ABC1234, EU: B 1234 AB).`;
  return null;
};

const SKILLS_BY_CATEGORY: Record<string, string[]> = {
  "HVAC": ["AC Installation", "AC Repair", "Duct Cleaning", "Refrigeration", "Boiler Servicing", "Heat Pump", "Thermostat Setup", "Ventilation Design"],
  "Electrical": ["Wiring", "Panel Upgrades", "Lighting", "Generator Install", "EV Charger", "Troubleshooting", "Code Compliance", "Solar PV"],
  "Plumbing": ["Pipe Fitting", "Drain Cleaning", "Water Heater", "Leak Detection", "Fixture Install", "Backflow Prevention", "Sewer Line", "Gas Plumbing"],
  "Networking": ["Cabling", "Wi-Fi Setup", "Firewall Config", "VPN Setup", "Switch Install", "Network Audit", "Fiber Optic", "IP Phone Systems"],
  "IT Support": ["Desktop Support", "Printer Setup", "OS Install", "Data Recovery", "Malware Removal", "Cloud Migration", "Email Config", "Backup Solutions"],
  "Server & Data": ["Rack Mount", "Server Build", "UPS Install", "Cooling Systems", "Cable Management", "Monitoring Setup", "Virtualization", "Storage Config"],
  "Security Systems": ["CCTV Install", "Alarm Systems", "Access Control", "Intercom", "Motion Sensors", "Remote Monitoring", "Fire Detection", "Perimeter Security"],
  "General Maintenance": ["Painting", "Carpentry", "Flooring", "Drywall", "Locksmith", "Appliance Repair", "Pressure Washing", "Window Repair"],
};

const getExpiryStatus = (dateStr: string | null): { label: string; class: string; icon: "ok" | "warn" | "expired" | "none" } => {
  if (!dateStr) return { label: "No expiry set", class: "text-muted-foreground", icon: "none" };
  const expiry = new Date(dateStr);
  const now = new Date();
  const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (daysLeft < 0) return { label: `Expired ${Math.abs(daysLeft)} days ago`, class: "text-destructive", icon: "expired" };
  if (daysLeft <= 30) return { label: `Expires in ${daysLeft} days`, class: "text-amber-600 dark:text-amber-400", icon: "warn" };
  return { label: `Expires ${expiry.toLocaleDateString()}`, class: "text-emerald-600 dark:text-emerald-400", icon: "ok" };
};

const EngineerProfile = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [editSkills, setEditSkills] = useState<string[]>([]);
  const [editRate, setEditRate] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editInsurance, setEditInsurance] = useState("");
  const [editVehicle, setEditVehicle] = useState("");
  const [editInsuranceExpiry, setEditInsuranceExpiry] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [uploadingSelfie, setUploadingSelfie] = useState(false);
  const [uploadingIdCard, setUploadingIdCard] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["eng-prof", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: engineer } = useQuery({
    queryKey: ["eng-prof-eng", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("engineers")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: ratings = [] } = useQuery({
    queryKey: ["eng-ratings", engineer?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("engineer_ratings")
        .select("*")
        .eq("engineer_id", engineer!.id)
        .order("created_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
    enabled: !!engineer?.id,
  });

  const openEdit = () => {
    setEditSkills((engineer as any)?.skills ?? []);
    setEditRate(String(engineer?.hourly_rate ?? ""));
    setEditLocation(engineer?.location ?? "");
    setEditInsurance((engineer as any)?.insurance_details ?? "");
    setEditVehicle((engineer as any)?.vehicle_number_plate ?? "");
    setEditInsuranceExpiry((engineer as any)?.insurance_expiry_date ?? "");
    setEditPhone(profile?.phone ?? "");
    setEditEmail(profile?.email ?? "");
    setEditOpen(true);
  };

  const toggleSkill = (skill: string) => {
    setEditSkills((prev) => prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]);
  };

  const handleAvatarUpload = async (file: File) => {
    if (!user?.id || !file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Photo must be under 5 MB"); return; }
    if (!file.type.startsWith("image/")) { toast.error("Please select an image"); return; }
    setUploadingAvatar(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const { error: profErr } = await supabase.from("profiles").update({ avatar_url: pub.publicUrl }).eq("user_id", user.id);
      if (profErr) throw profErr;
      toast.success("Photo updated");
      queryClient.invalidateQueries({ queryKey: ["eng-prof", user.id] });
    } catch (err: any) {
      toast.error(err.message ?? "Upload failed");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleDocUpload = async (file: File) => {
    if (!user?.id || !engineer?.id || !file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("Document must be under 10 MB"); return; }
    setUploadingDoc(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "pdf";
      const path = `${user.id}/policy-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("engineer-documents").upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const { error: engErr } = await supabase.from("engineers").update({ insurance_document_url: path } as any).eq("id", engineer.id);
      if (engErr) throw engErr;
      toast.success("Document uploaded");
      queryClient.invalidateQueries({ queryKey: ["eng-prof-eng", user.id] });
    } catch (err: any) {
      toast.error(err.message ?? "Upload failed");
    } finally {
      setUploadingDoc(false);
    }
  };

  const openDocument = async () => {
    const path = (engineer as any)?.insurance_document_url;
    if (!path) return;
    const { data, error } = await supabase.storage.from("engineer-documents").createSignedUrl(path, 300);
    if (error || !data) { toast.error("Could not open document"); return; }
    window.open(data.signedUrl, "_blank");
  };

  const friendlyValidationError = (raw: string, label: string): { title: string; description?: string } => {
    const msg = (raw || "").toLowerCase();
    if (msg.includes("exceeds 10 mb") || msg.includes("exceeded the maximum allowed size") || msg.includes("payload too large")) {
      return { title: `${label} is too large`, description: "Maximum size is 10 MB. Try a smaller photo or a compressed PDF." };
    }
    if (msg.includes("must be an image") || msg.includes("must be an image or pdf") || msg.includes("invalid_mime_type")) {
      return { title: `${label} has an unsupported file type`, description: label.toLowerCase().includes("id card")
        ? "Allowed: JPG, PNG, WEBP, HEIC, or PDF."
        : "Allowed: JPG, PNG, WEBP, or HEIC." };
    }
    if (msg.includes("not found in storage")) {
      return { title: `${label} upload didn't complete`, description: "The file didn't reach storage. Please retry." };
    }
    if (msg.includes("own folder")) {
      return { title: "Permission error", description: `${label} could not be saved to your account.` };
    }
    if (msg.includes("row-level security") || msg.includes("permission denied")) {
      return { title: "You don't have permission to update this record", description: "Please sign out and back in, then try again." };
    }
    return { title: `${label} couldn't be saved`, description: raw || "An unexpected error occurred." };
  };

  const uploadIdentityFile = async (
    file: File,
    field: "identity_selfie_url" | "id_card_url",
    label: string,
    setBusy: (v: boolean) => void,
  ) => {
    if (!user?.id || !engineer?.id || !file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error(`${label} is too large`, { description: "Maximum size is 10 MB. Please choose a smaller file." });
      return;
    }
    const allowedMimes = field === "id_card_url"
      ? ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf"]
      : ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif"];
    if (!allowedMimes.includes(file.type)) {
      toast.error(`${label} must be ${field === "id_card_url" ? "an image or PDF" : "a photo"}`, {
        description: field === "id_card_url"
          ? "Allowed formats: JPG, PNG, WEBP, HEIC, or PDF."
          : "Allowed formats: JPG, PNG, WEBP, or HEIC.",
      });
      return;
    }
    setBusy(true);
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `${user.id}/${field}-${Date.now()}.${ext}`;
    let uploaded = false;
    try {
      const { error: upErr } = await supabase.storage
        .from("engineer-documents")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      uploaded = true;
      const { error: engErr } = await supabase
        .from("engineers")
        .update({ [field]: path } as any)
        .eq("id", engineer.id);
      if (engErr) throw engErr;
      toast.success(`${label} uploaded`, { description: "Pending admin review." });
      queryClient.invalidateQueries({ queryKey: ["eng-prof-eng", user.id] });
    } catch (err: any) {
      // Roll back the orphaned upload so the next attempt isn't blocked or counted
      if (uploaded) {
        await supabase.storage.from("engineer-documents").remove([path]).catch(() => {});
      }
      const { title, description } = friendlyValidationError(err?.message ?? "", label);
      toast.error(title, description ? { description } : undefined);
      console.error("identity upload failed", { field, error: err });
    } finally {
      setBusy(false);
    }
  };


  const openSignedDoc = async (path?: string | null) => {
    if (!path) return;
    const { data, error } = await supabase.storage.from("engineer-documents").createSignedUrl(path, 300);
    if (error || !data) { toast.error("Could not open file"); return; }
    window.open(data.signedUrl, "_blank");
  };

  const insuranceError = validateInsurance(editInsurance);
  const plateError = validatePlate(editVehicle);

  const handleSave = async () => {
    if (!engineer || editSkills.length === 0 || !editRate || Number(editRate) <= 0 || !editLocation.trim()) {
      toast.error("Please fill in all fields with at least one skill.");
      return;
    }
    if (insuranceError) {
      toast.error(insuranceError);
      return;
    }
    if (plateError) {
      toast.error(plateError);
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("engineers")
        .update({
          skills: editSkills,
          hourly_rate: Number(editRate),
          location: editLocation.trim(),
          insurance_details: editInsurance.trim() || null,
          vehicle_number_plate: editVehicle.trim().toUpperCase() || null,
          insurance_expiry_date: editInsuranceExpiry || null,
        } as any)
        .eq("id", engineer.id);
      if (error) throw error;
      const { error: profErr } = await supabase
        .from("profiles")
        .update({ phone: editPhone.trim() || null, email: editEmail.trim() || null })
        .eq("user_id", user!.id);
      if (profErr) throw profErr;
      toast.success("Profile updated!");
      queryClient.invalidateQueries({ queryKey: ["eng-prof-eng", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["eng-prof", user?.id] });
      setEditOpen(false);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  const availableSkills = SKILLS_BY_CATEGORY[engineer?.specialty ?? ""] ?? [];
  const engineerSkills: string[] = (engineer as any)?.skills ?? [];

  const initials = profile?.full_name
    ? profile.full_name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : "??";

  return (
    <EngineerMobileLayout title="Profile">
      <div className="space-y-5">
        {/* Profile Card */}
        <Card>
          <CardContent className="p-5 flex flex-col items-center text-center">
            <div className="relative mb-3">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt={profile.full_name ?? "avatar"} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl font-bold text-primary">{initials}</span>
                )}
              </div>
              <label className="absolute bottom-0 right-0 bg-primary text-primary-foreground rounded-full p-1.5 cursor-pointer shadow-md hover:opacity-90">
                <Camera className="w-3.5 h-3.5" />
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploadingAvatar}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAvatarUpload(f); e.target.value = ""; }}
                />
              </label>
            </div>
            {uploadingAvatar && <p className="text-[11px] text-muted-foreground mb-1">Uploading…</p>}
            <h2 className="text-lg font-bold text-foreground">{profile?.full_name ?? "Loading..."}</h2>
            <p className="text-sm text-muted-foreground">{engineer?.specialty ?? "Field Engineer"}</p>
            <div className="flex items-center gap-1 mt-2">
              <Star className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-semibold text-foreground">{Number(engineer?.rating ?? 0).toFixed(1)}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => setPreviewOpen(true)}
              disabled={!engineer}
            >
              <IdCard className="w-4 h-4 mr-2" />
              Preview info card
            </Button>
          </CardContent>
        </Card>

        <EngineerInfoCardPreview
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          shareUrl={
            engineer?.id
              ? `${window.location.origin}/engineers/${engineer.id}`
              : undefined
          }
          data={{
            fullName: profile?.full_name,
            avatarUrl: profile?.avatar_url,
            specialty: engineer?.specialty,
            rating: engineer?.rating ?? null,
            jobsCompleted: engineer?.jobs_completed ?? null,
            location: engineer?.location,
            email: (engineer as any)?.show_email !== false ? profile?.email : null,
            phone: (engineer as any)?.show_phone !== false ? profile?.phone : null,
            skills: (engineer as any)?.skills ?? [],
            vehiclePlate:
              (engineer as any)?.show_vehicle !== false
                ? (engineer as any)?.vehicle_number_plate
                : null,
            insuranceVerified:
              (engineer as any)?.show_insurance !== false
                ? (engineer as any)?.insurance_verified ?? false
                : false,
          }}
        />

        {/* Public profile privacy */}
        {engineer && (
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-primary" />
                <p className="text-sm font-semibold text-foreground">
                  Public profile privacy
                </p>
              </div>
              <p className="text-[11px] text-muted-foreground -mt-1">
                Choose what appears on your shared info card and public link.
              </p>
              {[
                { key: "show_email", label: "Email address", icon: Mail },
                { key: "show_phone", label: "Phone number", icon: Phone },
                { key: "show_vehicle", label: "Vehicle plate", icon: Car },
                { key: "show_insurance", label: "Insurance badge", icon: Shield },
              ].map(({ key, label, icon: Icon }) => {
                const checked = (engineer as any)[key] !== false;
                return (
                  <div
                    key={key}
                    className="flex items-center justify-between gap-3 rounded-md border border-border p-2.5"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="text-sm text-foreground truncate">
                        {label}
                      </span>
                    </div>
                    <Switch
                      checked={checked}
                      onCheckedChange={async (next) => {
                        const prev = checked;
                        // optimistic
                        queryClient.setQueryData(
                          ["eng-prof-eng", user?.id],
                          (old: any) => (old ? { ...old, [key]: next } : old),
                        );
                        const { error } = await supabase
                          .from("engineers")
                          .update({ [key]: next } as any)
                          .eq("id", engineer.id);
                        if (error) {
                          queryClient.setQueryData(
                            ["eng-prof-eng", user?.id],
                            (old: any) =>
                              old ? { ...old, [key]: prev } : old,
                          );
                          toast.error("Couldn't update privacy setting");
                        } else {
                          // re-fetch from DB so other tabs / sessions stay in sync
                          queryClient.invalidateQueries({
                            queryKey: ["eng-prof-eng", user?.id],
                          });
                          toast.success(
                            next ? `${label} is now public` : `${label} hidden`,
                          );
                        }
                      }}
                    />
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Details */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <span className="text-foreground">{profile?.email ?? "—"}</span>
            </div>
            {profile?.phone && (
              <div className="flex items-center gap-3 text-sm">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <span className="text-foreground">{profile.phone}</span>
              </div>
            )}
            {engineer?.location && (
              <div className="flex items-center gap-3 text-sm">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <span className="text-foreground">{engineer.location}</span>
              </div>
            )}
            <div className="flex items-center gap-3 text-sm">
              <Briefcase className="w-4 h-4 text-muted-foreground" />
              <span className="text-foreground">{engineer?.jobs_completed ?? 0} jobs completed</span>
            </div>
            {engineer?.hourly_rate && (
              <div className="flex items-center gap-3 text-sm">
                <DollarSign className="w-4 h-4 text-muted-foreground" />
                <span className="text-foreground">${Number(engineer.hourly_rate)}/hr</span>
              </div>
            )}
            {(engineer as any)?.insurance_details && (() => {
              const expiry = getExpiryStatus((engineer as any)?.insurance_expiry_date);
              return (
                <div className="flex items-start gap-3 text-sm">
                  <Shield className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <span className="text-xs font-medium text-foreground">Insurance</span>
                    <p className="text-muted-foreground text-xs">{(engineer as any).insurance_details}</p>
                    <p className={`text-[11px] font-medium mt-0.5 ${expiry.class}`}>
                      {expiry.icon === "expired" && <AlertCircle className="w-3 h-3 inline mr-1" />}
                      {expiry.icon === "warn" && <AlertCircle className="w-3 h-3 inline mr-1" />}
                      {expiry.label}
                    </p>
                  </div>
                </div>
              );
            })()}
            {(engineer as any)?.vehicle_number_plate && (
              <div className="flex items-center gap-3 text-sm">
                <Car className="w-4 h-4 text-orange-500 shrink-0" />
                <div>
                  <span className="text-xs font-medium text-foreground">Vehicle</span>
                  <span className="ml-2 font-mono bg-muted px-2 py-0.5 rounded text-xs">{(engineer as any).vehicle_number_plate}</span>
                </div>
              </div>
            )}
            <div className="flex items-center gap-3 text-sm">
              <FileText className="w-4 h-4 text-purple-500 shrink-0" />
              <div className="flex-1 flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-foreground">Policy document</span>
                {(engineer as any)?.insurance_document_url ? (
                  <Button size="sm" variant="ghost" className="h-6 text-xs gap-1" onClick={openDocument}>
                    <ExternalLink className="w-3 h-3" /> View
                  </Button>
                ) : (
                  <span className="text-[11px] text-muted-foreground">Not uploaded</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Identity Verification */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-500" />
              <p className="text-sm font-semibold text-foreground">Identity Verification</p>
            </div>
            <p className="text-[11px] text-muted-foreground -mt-1">
              Upload a selfie and a photo of your government-issued ID. Max 10 MB each (JPG, PNG, or PDF).
            </p>

            {[
              { field: "identity_selfie_url" as const, label: "Identity selfie", busy: uploadingSelfie, setBusy: setUploadingSelfie, accept: "image/*", capture: "user" as const },
              { field: "id_card_url" as const, label: "ID card", busy: uploadingIdCard, setBusy: setUploadingIdCard, accept: "image/*,application/pdf", capture: "environment" as const },
            ].map((item) => {
              const path = (engineer as any)?.[item.field] as string | undefined;
              return (
                <div key={item.field} className="flex items-center justify-between gap-2 rounded-md border border-border p-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <Camera className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground">{item.label}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {path ? "Uploaded" : "Not uploaded"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {path && (
                      <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => openSignedDoc(path)}>
                        <ExternalLink className="w-3 h-3" /> View
                      </Button>
                    )}
                    <label className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-input bg-card hover:bg-secondary cursor-pointer ${item.busy ? "opacity-60 pointer-events-none" : ""}`}>
                      <Upload className="w-3 h-3" />
                      {item.busy ? "Uploading…" : path ? "Replace" : "Upload"}
                      <input
                        type="file"
                        accept={item.accept}
                        capture={item.capture}
                        className="hidden"
                        disabled={item.busy}
                        onChange={(e) => {
                          const list = Array.from(e.target.files ?? []);
                          if (list.length > 1) {
                            toast.error(`Only one ${item.label.toLowerCase()} allowed`, {
                              description: "Please select a single file. Use Replace to change it later.",
                            });
                            e.target.value = "";
                            return;
                          }
                          const f = list[0];
                          if (f) uploadIdentityFile(f, item.field, item.label, item.setBusy);
                          e.target.value = "";
                        }}
                        multiple={false}
                      />
                    </label>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Skills */}
        {engineerSkills.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <p className="text-sm font-medium text-foreground mb-2">Skills</p>
              <div className="flex flex-wrap gap-1.5">
                {engineerSkills.map((s) => (
                  <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}


        {/* Certifications & Badges */}
        {engineer && <CertificationBadges engineerId={engineer.id} canManage />}

        {/* Performance Scorecard */}
        {engineer && (
          <EngineerScorecard
            engineer={{
              full_name: profile?.full_name,
              rating: engineer.rating,
              jobs_completed: engineer.jobs_completed,
            }}
          />
        )}

        {/* Edit Button */}
        <Button variant="outline" className="w-full gap-2" onClick={openEdit}>
          <Pencil className="w-4 h-4" /> Edit Profile Details
        </Button>

        {/* Availability */}
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Status</span>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
              engineer?.is_available ? "bg-green-500/10 text-green-500" : "bg-muted text-muted-foreground"
            }`}>
              {engineer?.is_available ? "Available" : "Unavailable"}
            </span>
          </CardContent>
        </Card>

        {/* Recent Ratings */}
        {ratings.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Recent Reviews</h3>
            <div className="space-y-2">
              {ratings.map((r) => (
                <Card key={r.id}>
                  <CardContent className="p-3">
                    <div className="flex items-center gap-1 mb-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`w-3 h-3 ${i < r.rating ? "text-amber-500 fill-amber-500" : "text-muted-foreground"}`} />
                      ))}
                    </div>
                    {r.review && <p className="text-xs text-muted-foreground">{r.review}</p>}
                    <p className="text-[10px] text-muted-foreground mt-1">{new Date(r.created_at).toLocaleDateString()}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Skills */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Skills — {engineer?.specialty}</Label>
              <div className="flex flex-wrap gap-2">
                {availableSkills.map((skill) => {
                  const selected = editSkills.includes(skill);
                  return (
                    <Badge
                      key={skill}
                      variant={selected ? "default" : "outline"}
                      className={`cursor-pointer text-sm px-3 py-1.5 transition-all ${
                        selected ? "bg-primary text-primary-foreground hover:bg-primary/90" : "hover:bg-muted"
                      }`}
                      onClick={() => toggleSkill(skill)}
                    >
                      {selected && <Check className="w-3 h-3 mr-1" />}
                      {skill}
                    </Badge>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">{editSkills.length} selected</p>
            </div>

            {/* Rate */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <DollarSign className="w-4 h-4 text-muted-foreground" /> Hourly Rate (USD)
              </Label>
              <Input
                type="number"
                min="1"
                placeholder="e.g. 75"
                value={editRate}
                onChange={(e) => setEditRate(e.target.value)}
              />
            </div>

            {/* Location */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <MapPin className="w-4 h-4 text-muted-foreground" /> Service Location
              </Label>
              <Input
                placeholder="e.g. London, UK"
                value={editLocation}
                onChange={(e) => setEditLocation(e.target.value)}
                maxLength={200}
              />
            </div>

            {/* Insurance Details */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <Shield className="w-4 h-4 text-muted-foreground" /> Insurance Details
              </Label>
              <Textarea
                placeholder="e.g. Public Liability — Policy #PLI-123456, Expires 2027-03-15"
                value={editInsurance}
                onChange={(e) => setEditInsurance(e.target.value)}
                maxLength={500}
                rows={2}
                className={`resize-none ${editInsurance.trim() && insuranceError ? "border-destructive" : ""}`}
              />
              <p className="text-[11px] text-muted-foreground">Provider, policy number, expiry date, etc.</p>
              {editInsurance.trim() && insuranceError && (
                <p className="text-[11px] text-destructive flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {insuranceError}
                </p>
              )}
            </div>

            {/* Insurance Expiry Date */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <AlertCircle className="w-4 h-4 text-muted-foreground" /> Insurance Expiry Date
              </Label>
              <Input
                type="date"
                value={editInsuranceExpiry}
                onChange={(e) => setEditInsuranceExpiry(e.target.value)}
              />
              {editInsuranceExpiry && (() => {
                const status = getExpiryStatus(editInsuranceExpiry);
                return (
                  <p className={`text-[11px] font-medium ${status.class}`}>
                    {status.label}
                  </p>
                );
              })()}
            </div>

            {/* Vehicle Number Plate */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <Car className="w-4 h-4 text-muted-foreground" /> Vehicle Number Plate
              </Label>
              <Input
                placeholder="e.g. AB12 CDE"
                value={editVehicle}
                onChange={(e) => setEditVehicle(e.target.value.toUpperCase())}
                maxLength={20}
                className={editVehicle.trim() && plateError ? "border-destructive" : ""}
              />
              {editVehicle.trim() && plateError && (
                <p className="text-[11px] text-destructive flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {plateError}
                </p>
              )}
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <Phone className="w-4 h-4 text-muted-foreground" /> Contact Phone
              </Label>
              <Input
                type="tel"
                placeholder="e.g. +44 7700 900000"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                maxLength={30}
              />
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <Mail className="w-4 h-4 text-muted-foreground" /> Contact Email
              </Label>
              <Input
                type="email"
                placeholder="you@example.com"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                maxLength={255}
              />
            </div>

            {/* Policy Document Upload */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <FileText className="w-4 h-4 text-muted-foreground" /> Policy Document
              </Label>
              <div className="flex items-center gap-2">
                <label className="flex-1">
                  <input
                    type="file"
                    accept="application/pdf,image/*"
                    className="hidden"
                    disabled={uploadingDoc}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleDocUpload(f); e.target.value = ""; }}
                  />
                  <div className="flex items-center justify-center gap-2 border border-dashed rounded-md py-2 text-xs cursor-pointer hover:bg-muted">
                    <Upload className="w-3.5 h-3.5" />
                    {uploadingDoc ? "Uploading…" : (engineer as any)?.insurance_document_url ? "Replace document" : "Upload PDF or image"}
                  </div>
                </label>
                {(engineer as any)?.insurance_document_url && (
                  <Button type="button" size="sm" variant="outline" onClick={openDocument}>View</Button>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">PDF or image, up to 10 MB. Only you and admins can view it.</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || editSkills.length === 0}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </EngineerMobileLayout>
  );
};

export default EngineerProfile;
