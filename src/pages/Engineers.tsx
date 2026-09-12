import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import {
  Users, CircleCheck, CircleX, Star, Search, UserPlus, Lightbulb,
  X, Mail, Phone, MapPin, Wrench, Shield, Car, AlertTriangle,
  Eye, AlertCircle, Calendar, ShieldCheck, ShieldX, Copy,
  Upload, FileSpreadsheet, ArrowLeft, Filter, Plus,
} from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import EngineerScorecard from "@/components/features/EngineerScorecard";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import AppLayout from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import RegionFilter from "@/components/filters/RegionFilter";
import { useRegionFilter } from "@/hooks/useRegionFilter";
import { useAuth } from "@/hooks/useAuth";
import { CURRENCIES, useCurrency } from "@/contexts/CurrencyContext";

// ── Constants ────────────────────────────────────────────────────────────────
const MAX_FILE_SIZE_MB = 5;
const MAX_ROWS = 500;


const ENGINEER_TYPES = ["FreeLancer", "Full Time Employee(FTE)"] as const;
type EngineerType = typeof ENGINEER_TYPES[number];

const RATE_TYPES = ["Hourly", "Half Day", "Full Day", "Monthly"] as const;
type RateType = typeof RATE_TYPES[number];

interface RateEntry {
  id: string;
  rate_type: RateType;
  rate_amount: string;
  rate_currency: string;
}

const makeRateId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

const emptyRateRow = (currency = "USD"): RateEntry => ({
  id: makeRateId(),
  rate_type: "Hourly",
  rate_amount: "",
  rate_currency: currency,
});

// ── Helpers ──────────────────────────────────────────────────────────────────
const getExpiryStatus = (dateStr: string | null) => {
  if (!dateStr) return { label: "No expiry set", class: "text-muted-foreground", severity: "none" as const };
  const expiry = new Date(dateStr);
  const now = new Date();
  const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (daysLeft < 0) return { label: `Expired ${Math.abs(daysLeft)} days ago`, class: "text-destructive", severity: "expired" as const };
  if (daysLeft <= 30) return { label: `Expires in ${daysLeft} days`, class: "text-amber-600 dark:text-amber-400", severity: "warn" as const };
  return { label: `Expires ${expiry.toLocaleDateString()}`, class: "text-emerald-600 dark:text-emerald-400", severity: "ok" as const };
};

// ── Predefined IT/Computer/AI Skills ──────────────────────────────────────
const PREDEFINED_SKILLS = [
  "JavaScript", "TypeScript", "Python", "Java", "C++", "C#", "PHP", "Ruby", "Go", "Rust",
  "React", "Vue", "Angular", "Node.js", "Express.js", "Django", "Flask", "ASP.NET",
  "MongoDB", "PostgreSQL", "MySQL", "Firebase", "Redis", "Elasticsearch",
  "AWS", "Azure", "Google Cloud", "Docker", "Kubernetes", "CI/CD", "Jenkins",
  "Machine Learning", "Deep Learning", "NLP", "Computer Vision", "TensorFlow",
  "PyTorch", "Scikit-learn", "OpenAI API", "Generative AI",
  "iOS", "Android", "React Native", "Flutter", "Linux", "Windows Server",
  "Git", "REST API", "GraphQL", "Microservices", "System Design", "Agile",
  "Cybersecurity", "Network Administration", "UI/UX Design", "Figma",
  "PLC", "CCTV", "Fibre Splicing", "Low Voltage"
].sort();

// ── Predefined Recruiters ─────────────────────────────────────────────────
const PREDEFINED_RECRUITERS = [
  "TechRecruit Ltd",
  "GlobalTech Staffing",
  "Innovation Talent Partners",
  "DevOps Recruitment Hub",
  "CloudTech Recruiting",
  "AI Specialist Recruitment",
  "Enterprise Solutions Inc",
  "Agile Staffing Partners",
  "Digital Transformation Group",
  "Full Stack Talent",
  "StartUp Hiring Co",
  "Contract Personnel Ltd",
  "Freelance Marketplace",
  "Internal Referral",
  "Direct Application"
].sort();

const CERTIFICATION_OPTIONS = [
  "None",
  "Cisco Certified Network Associate (CCNA)",
  "Microsoft Certified: Azure Fundamentals",
  "AWS Certified Solutions Architect",
  "CompTIA A+",
  "CompTIA Network+",
  "CompTIA Security+",
  "Google Cloud Associate Engineer",
  "Certified Information Systems Security Professional (CISSP)",
  "Certified Kubernetes Administrator (CKA)",
  "Certified Ethical Hacker (CEH)",
  "ITIL Foundation",
  "PMP",
  "Scrum Master"
] as const;

const ID_TYPE_OPTIONS = [
  "Aadhaar Card",
  "PAN Card",
  "Passport",
  "Driving License",
  "National ID",
  "Work Permit"
] as const;

// ── Component ─────────────────────────────────────────────────────────────────
const Engineers = () => {
  const { currency } = useCurrency();

  // ── UI state ─────────────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [showInfoBanner, setShowInfoBanner] = useState(true);
  const [detailEngineer, setDetailEngineer] = useState<any>(null);
  const [skillSearch, setSkillSearch] = useState("");
  const [showSkillDropdown, setShowSkillDropdown] = useState(false);
  const [recruiterSearch, setRecruiterSearch] = useState("");
  const [showRecruiterDropdown, setShowRecruiterDropdown] = useState(false);
  const [frontIdDocumentFile, setFrontIdDocumentFile] = useState<File | null>(null);
  const [backIdDocumentFile, setBackIdDocumentFile] = useState<File | null>(null);
  const [idDocumentSide, setIdDocumentSide] = useState("Front Side");

  // ── File-upload dialog state ──────────────────────────────────────────────
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadPreviewRows, setUploadPreviewRows] = useState<any[]>([]);
  const [allUploadRows, setAllUploadRows] = useState<any[]>([]);
  const [isImporting, setIsImporting] = useState(false);

  // ── Inline "Add Engineer" form state ─────────────────────────────────────
  const [form, setForm] = useState({
    employee_id: "",
    full_name: "",
    email: "",
    phone: "",
    residential_address: "",
    specialty: "",
    location: "",
    city: "",
    state: "",
    postcode: "",
    country: "",
    rates: [emptyRateRow()] as RateEntry[],
    vendor_partner: "FieldFlow (Internal)",
    availability: "Available",
    engineer_type: "Regular FSE" as EngineerType,
    source_recruiter: "",
    skills: "",
    certification: "None",
    id_type: "",
  });
  const [isSavingEngineer, setIsSavingEngineer] = useState(false);

  const [pendingAvailability, setPendingAvailability] = useState<Record<string, boolean>>({});

  const { regions, selectedRegion, setSelectedRegion } = useRegionFilter();
  const { user } = useAuth();
  const { isAdmin: isAdminRole, isTeamLead, isAssociateCoordinator } = useUserRole();
  const canCopyDispatch = isAdminRole || isTeamLead || isAssociateCoordinator;
  const queryClient = useQueryClient();

  const [postcodeLookingUp, setPostcodeLookingUp] = useState(false);
  // ── Postcode → City/State auto-fill ──────────────────────────────────────
useEffect(() => {
  const postcode = form.postcode.trim();
  const country = form.country.trim();

  if (!postcode || postcode.length < 3) return;

  const countryCode = country.length === 2 ? country.toLowerCase() : "";
  const targetUrl = countryCode
    ? `https://api.zippopotam.us/${countryCode}/${postcode}`
    : `https://api.zippopotam.us/us/${postcode}`;

  const proxiedUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;

  const controller = new AbortController();
  const timer = setTimeout(async () => {
    try {
      const res = await fetch(proxiedUrl, { signal: controller.signal });
      if (!res.ok) return;

      const data = await res.json();
      const place = data.places?.[0];
      if (!place) return;

      setForm((prev) => ({
        ...prev,
        city: prev.city.trim() ? prev.city : (place["place name"] ?? ""),
        state: prev.state.trim() ? prev.state : (place["state"] ?? place["state abbreviation"] ?? ""),
      }));
    } catch {
      // silent
    }
  }, 600);

  return () => {
    clearTimeout(timer);
    controller.abort();
  };
}, [form.postcode, form.country]);
  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: isAdmin } = useQuery({
    queryKey: ["is-admin", user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data } = await supabase
        .from("user_roles").select("role")
        .eq("user_id", user.id).eq("role", "admin").maybeSingle();
      return !!data;
    },
    enabled: !!user,
  });

  const { data: engineers = [], isLoading } = useQuery({
    queryKey: ["all-engineers"],
    queryFn: async () => {
      const { data: engs, error: engError } = await supabase
        .from("engineers")
        .select("*");

      if (engError) {
        console.error("Error fetching engineers:", engError);
        throw engError;
      }

      if (!engs || engs.length === 0) {
        return [];
      }

      // Get only valid user IDs from the engineers table
      const userIds = engs
        .map((e) => e.user_id)
        .filter((id): id is string => Boolean(id));

      // Engineer personal details come from profiles
      const { data: profiles, error: profileError } = userIds.length
        ? await supabase
            .from("profiles")
            .select("user_id, full_name, email, phone")
            .in("user_id", userIds)
        : { data: [], error: null };

      if (profileError) {
        console.error("Error fetching engineer profiles:", profileError);
        throw profileError;
      }

      const profileMap = Object.fromEntries(
        (profiles ?? []).map((p) => [p.user_id, p])
      );

      return engs.map((e) => {
        const profile = e.user_id
          ? profileMap[e.user_id]
          : undefined;

        // For existing engineers, name comes from profiles.
        // For newly-created admin engineers, full_name may exist
        // directly on engineers.
        const name =
          (e as any).full_name?.trim() ||
          profile?.full_name?.trim() ||
          "Unknown";

        return {
          ...e,

          name,

          full_name:
            (e as any).full_name?.trim() ||
            profile?.full_name?.trim() ||
            null,

          email:
            (e as any).email?.trim() ||
            profile?.email?.trim() ||
            null,

          phone:
            (e as any).phone?.trim() ||
            profile?.phone?.trim() ||
            null,

          avatar: name
            .split(" ")
            .map((w: string) => w[0])
            .join("")
            .toUpperCase()
            .slice(0, 2),

          skills: (e as any).skills ?? [],

          rate_type:
            (e as any).rate_type ?? "Hourly",

          rate_amount:
            (e as any).rate_amount ??
            (e as any).hourly_rate ??
            null,

          rates:
            (e as any).rates ?? [],

          engineer_type:
            (e as any).engineer_type ?? "FreeLancer",

          vendor_partner:
            (e as any).vendor_partner ?? null,
        };
      });
    },
  });

  const { data: bankDetails } = useQuery({
    queryKey: ["bank-details", detailEngineer?.id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("engineer_bank_details")
        .select("*")
        .eq("engineer_id", detailEngineer.id)
        .maybeSingle();
      return data;
    },
    enabled: !!detailEngineer?.id && isAdmin,
  });

  const allEngineers = useMemo(() => engineers, [engineers]);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = allEngineers.length;
    const available = allEngineers.filter((e) => e.is_available).length;
    const unavailable = total - available;
    const rated = allEngineers.filter((e) => (e.rating ?? 0) > 0);
    const avgRating = rated.length ? rated.reduce((s, e) => s + (e.rating ?? 0), 0) / rated.length : 0;
    return { total, available, unavailable, avgRating };
  }, [allEngineers]);

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return allEngineers.filter((eng) => {
      const q = search.toLowerCase();
      const matchesSearch = !q ||
        eng.name.toLowerCase().includes(q) ||
        eng.specialty?.toLowerCase().includes(q) ||
        eng.location?.toLowerCase().includes(q) ||
        (eng.email ?? "").toLowerCase().includes(q) ||
        eng.skills.some((s: string) => s.toLowerCase().includes(q));
      const matchesType = typeFilter === "all" || (eng.engineer_type ?? "FreeLancer") === typeFilter;
      const matchesRegion = selectedRegion === "all" || eng.region_id === selectedRegion;
      return matchesSearch && matchesType && matchesRegion;
    });
  }, [allEngineers, search, typeFilter, selectedRegion]);

  // ── Form helpers ──────────────────────────────────────────────────────────
  const setField = (k: keyof typeof form, v: any) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const resetForm = () => {
    setForm({
      employee_id: "", full_name: "", email: "", phone: "", residential_address: "",
      specialty: "", location: "", city: "", state: "", postcode: "", country: "",
      rates: [emptyRateRow()],
      vendor_partner: "FieldFlow (Internal)", availability: "Available",
      engineer_type: "FreeLancer", source_recruiter: "", skills: "", certification: "None", id_type: "",
    });
    setFrontIdDocumentFile(null);
    setBackIdDocumentFile(null);
    setIdDocumentSide("Front Side");
  };

  // ── Multi-rate helpers ────────────────────────────────────────────────────
  const addRateRow = () => {
    setForm((prev) => ({
      ...prev,
      rates: [...prev.rates, emptyRateRow(prev.rates[prev.rates.length - 1]?.rate_currency ?? "USD")],
    }));
  };

  const removeRateRow = (id: string) => {
    setForm((prev) => ({
      ...prev,
      rates: prev.rates.length > 1 ? prev.rates.filter((r) => r.id !== id) : prev.rates,
    }));
  };

  const updateRateRow = (id: string, field: keyof Omit<RateEntry, "id">, value: string) => {
    setForm((prev) => ({
      ...prev,
      rates: prev.rates.map((r) => (r.id === id ? { ...r, [field]: value } : r)),
    }));
  };

  // Validate phone: digits, spaces, +, -, (), min 7 chars
  const validatePhone = (phone: string) => {
    if (!phone) return true; // optional
    return /^[+\d][\d\s\-()+]{5,19}$/.test(phone.trim());
  };

  const fileToDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });

  const handleIdDocumentChange = (e: ChangeEvent<HTMLInputElement>, side: "front" | "back") => {
    const file = e.target.files?.[0] ?? null;
    if (!file) {
      if (side === "front") setFrontIdDocumentFile(null); else setBackIdDocumentFile(null);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File too large", { description: "Please upload an ID image smaller than 5MB." });
      e.target.value = "";
      return;
    }
    if (side === "front") setFrontIdDocumentFile(file); else setBackIdDocumentFile(file);
  };

  const handleAddEngineer = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.full_name.trim() || !form.email.trim() || !form.phone.trim() || !form.postcode.trim() || !form.id_type.trim()) {
      toast.error("Required fields missing", {
        description: "Please fill Full Name, Email, Phone, Zip Code, and ID Type.",
      });
      return;
    }
    if (!frontIdDocumentFile || !backIdDocumentFile) {
      toast.error("ID documents required", {
        description: "Please upload both front and back ID images before submitting.",
      });
      return;
    }
    if (!validatePhone(form.phone)) {
      toast.error("Invalid phone number", { description: "Enter a valid international phone number, e.g. +44 7700 900000" });
      return;
    }
    setIsSavingEngineer(true);
    try {
      const skills = form.skills.split(",").map((s) => s.trim()).filter(Boolean);
      const frontIdDocumentData = frontIdDocumentFile ? await fileToDataUrl(frontIdDocumentFile) : null;
      const backIdDocumentData = backIdDocumentFile ? await fileToDataUrl(backIdDocumentFile) : null;

      const parsedRates = form.rates
        .filter((r) => r.rate_amount.trim() !== "")
        .map((r) => ({
          rate_type: r.rate_type,
          rate_amount: Number(r.rate_amount),
          rate_currency: r.rate_currency,
        }));
      const primaryRate = parsedRates[0] ?? null;

      // Row shape matches the public.engineers columns exactly (see
      // supabase/migrations/20260719190000_engineers_form_fields.sql) so this
      // insert writes straight to the DB — no localStorage involved.
      const newEngineerRow = {
        employee_id: form.employee_id.trim() || null,
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        residential_address: form.residential_address.trim() || null,
        specialty: form.specialty.trim() || null,
        location: [form.city, form.state, form.country].filter(Boolean).join(", ") || form.location.trim() || null,
        city: form.city.trim() || null,
        state: form.state.trim() || null,
        postcode: form.postcode.trim() || null,
        country: form.country.trim() || null,
        skills,
        rates: parsedRates,
        rate_type: primaryRate?.rate_type ?? "Hourly",
        rate_amount: primaryRate?.rate_amount ?? null,
        hourly_rate: primaryRate?.rate_type === "Hourly" ? primaryRate.rate_amount : null,
        rate_currency: primaryRate?.rate_currency ?? "USD",
        vendor_partner: form.vendor_partner,
        is_available: form.availability === "Available",
        engineer_type: form.engineer_type,
        source_recruiter: form.source_recruiter.trim() || null,
        certification: form.certification && form.certification !== "None" ? form.certification : null,
        id_type: form.id_type || null,
        id_document_front_name: frontIdDocumentFile?.name ?? null,
        id_document_front_data: frontIdDocumentData,
        id_document_back_name: backIdDocumentFile?.name ?? null,
        id_document_back_data: backIdDocumentData,
        jobs_completed: 0,
        rating: 0,
        show_email: true, show_insurance: false, show_phone: true, show_vehicle: false,
        vehicle_number_plate: null, insurance_verified: false, vehicle_verified: false,
        region_id: selectedRegion === "all" ? null : selectedRegion,
        // Admin-added engineers don't have a matching auth.users account yet
        // (that only exists once they sign up / are invited), so user_id is
        // left null rather than incorrectly stamped with the admin's own id.
        user_id: null,
      };

      const { error: insertError } = await supabase.from("engineers").insert(newEngineerRow);
      if (insertError) throw insertError;

      toast.success(`${form.full_name.trim()} added successfully 🎉`);
      queryClient.invalidateQueries({ queryKey: ["all-engineers"] });
      resetForm();
    } catch (err: any) {
      toast.error("Failed to save engineer", { description: err?.message ?? "Something went wrong." });
    } finally {
      setIsSavingEngineer(false);
    }
  };

  // ── File import ───────────────────────────────────────────────────────────
  const parseExcelFile = async (file: File) => {
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      toast.error("File too large", { description: `Max ${MAX_FILE_SIZE_MB} MB.` }); return;
    }
    setUploadedFileName(file.name);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(worksheet);
      if (rows.length === 0) { toast.warning("Empty file"); setUploadedFileName(null); return; }
      if (rows.length > MAX_ROWS) { toast.error(`Max ${MAX_ROWS} rows`); setUploadedFileName(null); return; }
      setAllUploadRows(rows);
      setUploadPreviewRows(rows.slice(0, 5));
      toast.success("File ready", { description: `${rows.length} engineer(s) found.` });
    } catch { toast.error("Could not read file"); setUploadedFileName(null); }
  };

  const handleSubmitImport = async () => {
    if (!allUploadRows.length) return;
    setIsImporting(true);
    try {
      // Row shape matches the public.engineers columns exactly (see
      // supabase/migrations/20260719190000_engineers_form_fields.sql).
      const imported = allUploadRows.map((row) => {
        const rateAmount = row.RateAmount ? Number(row.RateAmount) : (row.HourlyRate ? Number(row.HourlyRate) : null);
        const rateType = row.RateType ?? "Hourly";
        const rateCurrency = row.RateCurrency ?? "USD";
        return {
          employee_id: row.EmployeeID ?? row.employee_id ?? null,
          full_name: row.Name ?? row.full_name ?? "Unknown",
          email: row.Email ?? row.email ?? null,
          phone: row.Phone ? String(row.Phone) : null,
          residential_address: row.ResidentialAddress ?? row.Address ?? null,
          specialty: row.Specialty ?? null,
          location: row.Location ?? null,
          city: row.City ?? null,
          state: row.State ?? null,
          postcode: row.Postcode ?? row.ZipCode ?? null,
          country: row.Country ?? null,
          skills: row.Skills ? String(row.Skills).split(",").map((s: string) => s.trim()) : [],
          rate_type: rateType,
          rate_amount: rateAmount,
          hourly_rate: row.HourlyRate ? Number(row.HourlyRate) : null,
          rate_currency: rateCurrency,
          rates: rateAmount != null ? [{ rate_type: rateType, rate_amount: rateAmount, rate_currency: rateCurrency }] : [],
          is_available: true, jobs_completed: 0, rating: 0,
          engineer_type: row.EngineerType ?? "FreeLancer",
          vendor_partner: row.VendorPartner ?? "FieldFlow (Internal)",
          source_recruiter: row.Recruiter ?? row.SourceRecruiter ?? null,
          certification: row.Certification && row.Certification !== "None" ? row.Certification : null,
          id_type: row.IdType ?? null,
          show_email: true, show_insurance: false, show_phone: true, show_vehicle: false,
          vehicle_number_plate: null, insurance_verified: false, vehicle_verified: false,
          region_id: selectedRegion === "all" ? null : selectedRegion,
          // Imported engineers don't have a matching auth.users account yet.
          user_id: null,
        };
      });

      const { error: importError } = await supabase.from("engineers").insert(imported);
      if (importError) throw importError;

      toast.success(`${imported.length} engineer(s) imported 🎉`);
      queryClient.invalidateQueries({ queryKey: ["all-engineers"] });
      setShowImportDialog(false);
      setUploadedFileName(null); setUploadPreviewRows([]); setAllUploadRows([]);
    } catch (err: any) {
      toast.error("Import failed", { description: err?.message ?? "Something went wrong." });
    } finally { setIsImporting(false); }
  };

  // ── Verify & availability helpers ─────────────────────────────────────────
  const handleVerify = async (engineerId: string, field: "insurance" | "vehicle", currentlyVerified: boolean) => {
    const updates: any = {};
    if (field === "insurance") {
      updates.insurance_verified = !currentlyVerified;
      updates.insurance_verified_at = !currentlyVerified ? new Date().toISOString() : null;
      updates.insurance_verified_by = !currentlyVerified ? user?.id : null;
    } else {
      updates.vehicle_verified = !currentlyVerified;
      updates.vehicle_verified_at = !currentlyVerified ? new Date().toISOString() : null;
      updates.vehicle_verified_by = !currentlyVerified ? user?.id : null;
    }
    const { error } = await supabase.from("engineers").update(updates).eq("id", engineerId);
    if (error) { toast.error("Failed to update verification status"); return; }
    toast.success(`${field === "insurance" ? "Insurance" : "Vehicle"} ${!currentlyVerified ? "verified" : "unverified"}`);
    queryClient.invalidateQueries({ queryKey: ["all-engineers"] });
    setDetailEngineer((prev: any) => prev ? { ...prev, ...updates } : null);
  };

  // const verifyBankDetails = async (bankDetailsId: string, currentlyVerified: boolean) => {
  //   // This table is not yet included in the generated Supabase Database type.
  //   const { error } = await supabase.from("engineer_bank_details" as any).update({
  //     verified: !currentlyVerified,
  //     verified_at: !currentlyVerified ? new Date().toISOString() : null,
  //     verified_by: !currentlyVerified ? user?.id : null,
  //   }).eq("id", bankDetailsId);
  //   if (error) { toast.error("Failed to update verification"); return; }
  //   toast.success(!currentlyVerified ? "Bank details verified" : "Verification removed");
  //   queryClient.invalidateQueries({ queryKey: ["bank-details", detailEngineer?.id] });
  // };

  const verifyBankDetails = async (bankDetailsId: string, currentlyVerified: boolean) => {
    const { error } = await supabase.rpc("set_bank_details_verified" as any, {
      _bank_details_id: bankDetailsId,
      _verified: !currentlyVerified,
    });
    if (error) { toast.error("Failed to update verification"); return; }
    toast.success(!currentlyVerified ? "Bank details verified" : "Verification removed");
    queryClient.invalidateQueries({ queryKey: ["bank-details", detailEngineer?.id] });
  };

  const handleToggleAvailability = async (engineerId: string, next: boolean) => {
    setPendingAvailability((p) => ({ ...p, [engineerId]: true }));
    const { error } = await supabase.from("engineers").update({ is_available: next }).eq("id", engineerId);
    setPendingAvailability((p) => { const { [engineerId]: _, ...rest } = p; return rest; });
    if (error) { toast.error("Failed to update availability"); return; }
    toast.success(`Marked ${next ? "available" : "unavailable"}`);
    queryClient.invalidateQueries({ queryKey: ["all-engineers"] });
    queryClient.invalidateQueries({ queryKey: ["engineers-list"] });
    queryClient.invalidateQueries({ queryKey: ["coordinator-engineers-list"] });
    setDetailEngineer((prev: any) => prev && prev.id === engineerId ? { ...prev, is_available: next } : prev);
  };

  const formatRateValue = (amount: number | string | null | undefined, currencyCode?: string | null) => {
    const normalizedCurrency = (currencyCode || "USD").toUpperCase();
    const amountNumber = Number(amount);
    if (!Number.isFinite(amountNumber)) return null;

    const currencyMeta = CURRENCIES.find((entry) => entry.code === normalizedCurrency);
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: normalizedCurrency,
        maximumFractionDigits: 2,
      }).format(amountNumber);
    } catch {
      return `${currencyMeta?.symbol ?? normalizedCurrency}${amountNumber.toFixed(2)}`;
    }
  };

  const resolveRateForEngineer = (eng: any) => {
    const selectedType = eng?.rate_type ?? "Hourly";
    const rateRows = Array.isArray(eng?.rates) ? eng.rates : [];
    const matchingRow = rateRows.find((r: any) => String(r?.rate_type ?? "") === String(selectedType));
    const chosenRow = matchingRow ?? rateRows[0] ?? null;
    const amount = chosenRow?.rate_amount ?? eng?.rate_amount ?? eng?.hourly_rate ?? null;
    const rateType = chosenRow?.rate_type ?? selectedType;
    const currencyCode = chosenRow?.rate_currency ?? eng?.rate_currency ?? "USD";

    if (amount === null || amount === undefined || Number.isNaN(Number(amount))) return null;

    return {
      amount: Number(amount),
      rate_type: rateType,
      currency_code: currencyCode,
    };
  };

  const copyDispatchDetails = (eng: any) => {
    const resolvedRate = resolveRateForEngineer(eng);
    const rateLines: string[] = resolvedRate
      ? [`  • ${currency.symbol}${Number(resolvedRate.amount).toFixed(2)} / ${resolvedRate.rate_type}`]
      : [];
    const lines = [
      `━━━ ENGINEER DISPATCH DETAILS ━━━`,
      `Name: ${eng.name}`,
      eng.specialty ? `Specialty: ${eng.specialty}` : null,
      eng.phone ? `Phone: ${eng.phone}` : null,
      eng.location ? `Location: ${eng.location}` : null,
      `Rating: ${Number(eng.rating ?? 0).toFixed(1)} ⭐ | Jobs: ${eng.jobs_completed ?? 0}`,
      eng.skills?.length ? `Skills: ${eng.skills.join(", ")}` : null,
      rateLines.length ? `Rates:\n${rateLines.join("\n")}` : null,
      eng.vehicle_number_plate ? `Vehicle: ${eng.vehicle_number_plate}` : null,
      `Status: ${eng.is_available ? "Available" : "Unavailable"}`,
      `Insurance: ${eng.insurance_verified ? "Verified ✓" : "Not Verified"}`,
      `Vehicle Check: ${eng.vehicle_verified ? "Verified ✓" : "Not Verified"}`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ].filter(Boolean).join("\n");
    navigator.clipboard.writeText(lines);
    toast.success("Dispatch details copied to clipboard");
  };

  // ── Rate display helper ───────────────────────────────────────────────────
  const formatRate = (eng: any) => {
    const resolvedRate = resolveRateForEngineer(eng);
    if (!resolvedRate) return null;
    return `${currency.symbol}${Number(resolvedRate.amount).toFixed(2)}`;
  };

  const rateLabel = (eng: any) => {
    const resolvedRate = resolveRateForEngineer(eng);
    const rt = resolvedRate?.rate_type ?? eng?.rate_type ?? "Hourly";
    if (rt === "Hourly") return "/ hr";
    if (rt === "Half Day") return "/ half day";
    if (rt === "Full Day") return "/ day";
    if (rt === "Monthly") return "/ mo";
    return "";
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <AppLayout title="Engineers" subtitle="Manage your field engineering team">
      <div className="space-y-6">

        {/* ── Info Banner ──────────────────────────────────────────────────── */}
        {showInfoBanner && (
          <div className="relative rounded-xl border border-primary/20 bg-gradient-to-r from-primary/5 via-primary/10 to-accent/5 p-4 pr-12 animate-fade-in">
            <button
              onClick={() => setShowInfoBanner(false)}
              className="absolute right-2 top-2 h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Lightbulb className="h-4 w-4" />
              </div>
              <div className="space-y-1.5">
                <p className="text-sm font-semibold text-foreground">Welcome to Engineers</p>
                <p className="text-sm text-muted-foreground leading-relaxed">View your field engineers, their skills, ratings, and availability.</p>
                <ul className="mt-2 space-y-1">
                  {["Filter by specialty or skill to find the right engineer", "Click an engineer row to view their profile", "Star ratings update automatically from client reviews"].map((tip) => (
                    <li key={tip} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="h-1 w-1 rounded-full bg-primary/60 shrink-0" />
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* ── Stats Cards ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: Users, label: "Total Engineers", value: stats.total, color: "text-blue-600", bg: "text-blue-600 opacity-20" },
            { icon: CircleCheck, label: "Available Now", value: stats.available, color: "text-green-600", bg: "text-green-600 opacity-20" },
            { icon: CircleX, label: "Unavailable", value: stats.unavailable, color: "text-red-500", bg: "text-red-500 opacity-20" },
            { icon: Star, label: "Avg Rating", value: stats.avgRating.toFixed(1), color: "text-amber-600", bg: "text-amber-600 opacity-20" },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="rounded-xl border border-border/50 bg-card/95 backdrop-blur-sm shadow-card">
              <div className="p-6 pt-4 pb-3 flex items-center gap-3">
                <Icon className={`w-8 h-8 ${color} opacity-20`} />
                <div>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className={`text-2xl font-bold ${color}`}>{value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Add Engineer Form ─────────────────────────────────────────────── */}
        <div className="rounded-xl border border-border/50 bg-card/95 backdrop-blur-sm shadow-card">
          <div className="flex flex-col space-y-1.5 p-6 pb-4">
            <h3 className="text-xl font-semibold leading-none tracking-tight flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" />
              Add Engineer
            </h3>
          </div>
          <div className="px-6 pb-6 space-y-5">
            <form onSubmit={handleAddEngineer} className="space-y-5">

              {/* Contact Information */}
              <div>
                <div className="flex items-center gap-2 py-2 px-3 rounded-md mb-3 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400">
                  <Mail className="w-4 h-4" />
                  <span className="font-semibold text-sm">Contact Information</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="ff-employee-id">Employee ID</Label>
                    <Input
                      id="ff-employee-id"
                      placeholder="e.g. EMP-001"
                      value={form.employee_id}
                      onChange={(e) => setField("employee_id", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="ff-full-name">Full Name <span className="text-destructive">*</span></Label>
                    <Input id="ff-full-name" placeholder="e.g. Marcus Reed" value={form.full_name} onChange={(e) => setField("full_name", e.target.value)} required />
                  </div>
                  <div>
                    <Label htmlFor="ff-email">Email Address <span className="text-destructive">*</span></Label>
                    <Input id="ff-email" type="email" placeholder="engineer@example.com" value={form.email} onChange={(e) => setField("email", e.target.value)} required />
                  </div>
                  <div>
                    <Label htmlFor="ff-phone">Phone Number <span className="text-destructive">*</span></Label>
                    <Input id="ff-phone" type="tel" placeholder="+1 555 123 4567" value={form.phone} onChange={(e) => setField("phone", e.target.value)} required />
                  </div>
                  <div>
                    <Label htmlFor="ff-address">Residential Address</Label>
                    <Input id="ff-address" placeholder="Home / mailing address" value={form.residential_address} onChange={(e) => setField("residential_address", e.target.value)} />
                  </div>
                </div>
              </div>

              <div className="h-px bg-border" />

              {/* Professional Details */}
              <div>
                <div className="flex items-center gap-2 py-2 px-3 rounded-md mb-3 bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400">
                  <Wrench className="w-4 h-4" />
                  <span className="font-semibold text-sm">Professional Details</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="ff-specialty">Specialty / Trade</Label>
                    <Input id="ff-specialty" placeholder="e.g. HVAC, Electrical, Networking" value={form.specialty} onChange={(e) => setField("specialty", e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="ff-location">Work Location / Region</Label>
                    <Input id="ff-location" placeholder="e.g. New York, London, Remote" value={form.location} onChange={(e) => setField("location", e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="ff-city">City</Label>
                    <Input id="ff-city" placeholder="e.g. Frankfurt" value={form.city} onChange={(e) => setField("city", e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="ff-state">State</Label>
                    <Input id="ff-state" placeholder="e.g. Hesse" value={form.state} onChange={(e) => setField("state", e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="ff-postcode">Zip Code <span className="text-destructive">*</span></Label>
                    <Input id="ff-postcode" placeholder="e.g. 60311" value={form.postcode} onChange={(e) => setField("postcode", e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="ff-country">Country</Label>
                    <Input id="ff-country" placeholder="e.g. Germany" value={form.country} onChange={(e) => setField("country", e.target.value)} />
                  </div>

                  {/* Rates — multiple entries supported */}
                  <div className="md:col-span-2">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="mb-0">Rates</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1 text-xs"
                        onClick={addRateRow}
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Rate
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {form.rates.map((rate) => (
                        <div key={rate.id} className="flex gap-2 items-center">
                          <Select value={rate.rate_type} onValueChange={(v) => updateRateRow(rate.id, "rate_type", v)}>
                            <SelectTrigger className="w-36 shrink-0">
                              <SelectValue placeholder="Rate type" />
                            </SelectTrigger>
                            <SelectContent>
                              {RATE_TYPES.map((rt) => <SelectItem key={rt} value={rt}>{rt}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <Select value={rate.rate_currency} onValueChange={(v) => updateRateRow(rate.id, "rate_currency", v)}>
                            <SelectTrigger className="w-24 shrink-0">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {CURRENCIES.map((c) => (
                                <SelectItem key={c.code} value={c.code}>{c.symbol} {c.code}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            value={rate.rate_amount}
                            onChange={(e) => updateRateRow(rate.id, "rate_amount", e.target.value)}
                            className="flex-1"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-9 w-9 p-0 shrink-0 text-muted-foreground hover:text-destructive disabled:opacity-30"
                            onClick={() => removeRateRow(rate.id)}
                            disabled={form.rates.length === 1}
                            aria-label="Remove rate"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Vendor Partner */}
                  <div>
                    <Label>Vendor Partner</Label>
                    <Select value={form.vendor_partner} onValueChange={(v) => setField("vendor_partner", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FieldFlow (Internal)">🏢 FieldFlow (Internal)</SelectItem>
                        <SelectItem value="External">🤝 External Partner</SelectItem>
                        <SelectItem value="Subcontractor">🔧 Subcontractor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Availability */}
                  <div>
                    <Label>Availability</Label>
                    <Select value={form.availability} onValueChange={(v) => setField("availability", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Available">✅ Available</SelectItem>
                        <SelectItem value="Unavailable">❌ Unavailable</SelectItem>
                        <SelectItem value="On Leave">🏖️ On Leave</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Engineer Type */}
                  <div>
                    <Label>Engineer Type</Label>
                    <Select value={form.engineer_type} onValueChange={(v) => setField("engineer_type", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ENGINEER_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Sourced by Recruiter Dropdown */}
                  <div>
                    <Label htmlFor="ff-recruiter">Sourced by (external recruiter)</Label>
                    <div className="relative">
                      <div className="border border-input rounded-md p-2 bg-background min-h-10 flex items-center cursor-text">
                        {form.source_recruiter && (
                          <div className="bg-primary/20 text-primary px-2 py-1 rounded text-sm flex items-center gap-2">
                            {form.source_recruiter}
                            <button
                              type="button"
                              onClick={() => setField("source_recruiter", "")}
                              className="hover:text-destructive font-bold cursor-pointer"
                            >
                              ×
                            </button>
                          </div>
                        )}
                        {!form.source_recruiter && (
                          <input
                            type="text"
                            id="ff-recruiter"
                            placeholder="Search or add recruiter..."
                            value={recruiterSearch}
                            onChange={(e) => setRecruiterSearch(e.target.value)}
                            onFocus={() => setShowRecruiterDropdown(true)}
                            onBlur={() => setTimeout(() => setShowRecruiterDropdown(false), 200)}
                            className="flex-1 outline-none text-sm bg-transparent"
                          />
                        )}
                      </div>
                      {/* Dropdown */}
                      {showRecruiterDropdown && !form.source_recruiter && (
                        <div className="absolute top-full left-0 right-0 mt-1 border border-input rounded-md bg-background shadow-md z-50 max-h-64 overflow-y-auto">
                          {recruiterSearch.trim() && !PREDEFINED_RECRUITERS.includes(recruiterSearch.trim()) && (
                            <button
                              type="button"
                              onClick={() => {
                                setField("source_recruiter", recruiterSearch.trim());
                                setRecruiterSearch("");
                              }}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-accent flex items-center gap-2 border-b"
                            >
                              <Plus className="w-4 h-4" />
                              Add "{recruiterSearch.trim()}"
                            </button>
                          )}
                          {PREDEFINED_RECRUITERS.filter(
                            (recruiter) =>
                              recruiter.toLowerCase().includes(recruiterSearch.toLowerCase())
                          ).map((recruiter) => (
                            <button
                              key={recruiter}
                              type="button"
                              onClick={() => {
                                setField("source_recruiter", recruiter);
                                setRecruiterSearch("");
                              }}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
                            >
                              {recruiter}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Skills Multi-Select */}
                  <div className="md:col-span-2">
                    <Label htmlFor="ff-skills">Skills</Label>
                    <div className="relative">
                      <div className="border border-input rounded-md p-2 bg-background min-h-10 flex flex-wrap gap-2 items-center cursor-text">
                        {form.skills && form.skills.split(",").map((skill) => {
                          const trimmedSkill = skill.trim();
                          return trimmedSkill ? (
                            <div key={trimmedSkill} className="bg-primary/20 text-primary px-2 py-1 rounded text-sm flex items-center gap-2">
                              {trimmedSkill}
                              <button
                                type="button"
                                onClick={() => {
                                  const newSkills = form.skills
                                    .split(",")
                                    .map((s) => s.trim())
                                    .filter((s) => s !== trimmedSkill)
                                    .join(", ");
                                  setField("skills", newSkills);
                                }}
                                className="hover:text-destructive font-bold cursor-pointer"
                              >
                                ×
                              </button>
                            </div>
                          ) : null;
                        })}
                        <input
                          type="text"
                          id="ff-skills"
                          placeholder="Search or add skills..."
                          value={skillSearch}
                          onChange={(e) => setSkillSearch(e.target.value)}
                          onFocus={() => setShowSkillDropdown(true)}
                          onBlur={() => setTimeout(() => setShowSkillDropdown(false), 200)}
                          className="flex-1 min-w-[150px] outline-none text-sm bg-transparent"
                        />
                      </div>
                      {showSkillDropdown && (
                        <div className="absolute top-full left-0 right-0 mt-1 border border-input rounded-md bg-background shadow-md z-50 max-h-64 overflow-y-auto">
                          {skillSearch.trim() && !PREDEFINED_SKILLS.includes(skillSearch.trim()) && !form.skills.includes(skillSearch.trim()) && (
                            <button
                              type="button"
                              onClick={() => {
                                const currentSkills = form.skills.split(",").map((s) => s.trim()).filter(Boolean);
                                currentSkills.push(skillSearch.trim());
                                setField("skills", currentSkills.join(", "));
                                setSkillSearch("");
                              }}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-accent flex items-center gap-2 border-b"
                            >
                              <Plus className="w-4 h-4" />
                              Add "{skillSearch.trim()}"
                            </button>
                          )}
                          {PREDEFINED_SKILLS.filter(
                            (skill) =>
                              skill.toLowerCase().includes(skillSearch.toLowerCase()) &&
                              !form.skills.includes(skill)
                          ).map((skill) => (
                            <button
                              key={skill}
                              type="button"
                              onClick={() => {
                                const currentSkills = form.skills.split(",").map((s) => s.trim()).filter(Boolean);
                                currentSkills.push(skill);
                                setField("skills", currentSkills.join(", "));
                                setSkillSearch("");
                              }}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
                            >
                              {skill}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Certification Dropdown */}
                  <div>
                    <Label htmlFor="ff-certification">Certification</Label>
                    <Select value={form.certification} onValueChange={(value) => setField("certification", value)}>
                      <SelectTrigger id="ff-certification">
                        <SelectValue placeholder="Select certification" />
                      </SelectTrigger>
                      <SelectContent>
                        {CERTIFICATION_OPTIONS.map((option) => (
                          <SelectItem key={option} value={option}>{option}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* ID Type Dropdown */}
                  <div>
                    <Label htmlFor="ff-id-type">ID Type <span className="text-destructive">*</span></Label>
                    <Select value={form.id_type} onValueChange={(value) => setField("id_type", value)}>
                      <SelectTrigger id="ff-id-type">
                        <SelectValue placeholder="Select ID type" />
                      </SelectTrigger>
                      <SelectContent>
                        {ID_TYPE_OPTIONS.map((option) => (
                          <SelectItem key={option} value={option}>{option}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Upload ID Documents */}
                  <div className="md:col-span-2">
                    <Label htmlFor="ff-id-upload">Upload ID Documents <span className="text-destructive">*</span></Label>
                    <div className="mt-1 flex flex-col gap-3 rounded-md border border-dashed border-input p-3">
                      <div className="grid gap-3 md:grid-cols-2">
                        <div>
                          <Label htmlFor="ff-front-id" className="text-sm">Front Side ID Image</Label>
                          <input id="ff-front-id" type="file" accept="image/*,.pdf" onChange={(e) => handleIdDocumentChange(e, "front")} className="text-sm w-full mt-1" />
                          {frontIdDocumentFile && <p className="text-xs text-muted-foreground mt-1">Selected: {frontIdDocumentFile.name}</p>}
                        </div>
                        <div>
                          <Label htmlFor="ff-back-id" className="text-sm">Back Side ID Image</Label>
                          <input id="ff-back-id" type="file" accept="image/*,.pdf" onChange={(e) => handleIdDocumentChange(e, "back")} className="text-sm w-full mt-1" />
                          {backIdDocumentFile && <p className="text-xs text-muted-foreground mt-1">Selected: {backIdDocumentFile.name}</p>}
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">Please upload both front and back side ID images. Both are mandatory.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="submit"
                  disabled={
                    isSavingEngineer ||
                    !form.full_name.trim() ||
                    !form.email.trim() ||
                    !form.phone.trim() ||
                    !form.postcode.trim() ||
                    !form.id_type.trim() ||
                    !frontIdDocumentFile ||
                    !backIdDocumentFile
                  }
                  className="gap-2"
                >
                  <UserPlus className="w-4 h-4" />
                  {isSavingEngineer ? "Submitting..." : "Submit"}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>Clear</Button>
              </div>
            </form>
          </div>
        </div>

        {/* ── Engineer Roster Table ─────────────────────────────────────────── */}
        <div className="rounded-xl border border-border/50 bg-card/95 backdrop-blur-sm shadow-card">
          <div className="flex flex-col space-y-1.5 p-6 pb-3">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xl font-semibold leading-none tracking-tight flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Engineer Roster
              </h3>
              <Badge variant="secondary" className="ml-2">
                {filtered.length} of {allEngineers.length}
              </Badge>

              {/* Type filter */}
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-44 ml-2 h-9 text-sm font-normal">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {ENGINEER_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>

              {/* Region filter */}
              <RegionFilter regions={regions} value={selectedRegion} onChange={setSelectedRegion} />

              {/* Search */}
              <div className="relative ml-auto w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  className="pl-9 pr-8 h-9 text-sm"
                  placeholder="Search name, email, skill, location…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Import button */}
              <Button variant="outline" size="sm" className="gap-1.5 h-9" onClick={() => setShowImportDialog(true)}>
                <FileSpreadsheet className="w-4 h-4" /> Import
              </Button>
            </div>
          </div>

          <div className="p-0">
            {isLoading ? (
              <p className="text-sm text-muted-foreground text-center py-10">Loading engineers…</p>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">No engineers found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full caption-bottom text-sm">
                  <thead className="[&_tr]:border-b">
                    <tr className="border-b bg-muted/40">
                      {["Name", "ID Type / ID", "Contact", "Address / Postcode", "Vendor", "Type", "Specialty", "Certification", "Work Location", "Skills", "Rate", "Jobs", "Rating", "Status"].map((h) => (
                        <th key={h} className={`h-12 px-4 text-left align-middle font-medium text-muted-foreground whitespace-nowrap ${["Rate", "Jobs", "Rating", "Status"].includes(h) ? "text-right" : ""}`}>
                          {h}
                        </th>
                      ))}
                      {(isAdmin || canCopyDispatch) && <th className="h-12 px-4 text-center align-middle font-medium text-muted-foreground">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="[&_tr:last-child]:border-0">
                    {filtered.map((eng) => (
                      <tr key={eng.id} className="border-b transition-colors hover:bg-muted/20 cursor-pointer" onClick={() => isAdmin && setDetailEngineer(eng)}>

                        {/* Name */}
                        <td className="p-4 align-middle font-medium whitespace-nowrap">{eng.name}</td>

                        {/* ID Type / ID */}
                        <td className="p-4 align-middle text-sm text-muted-foreground whitespace-nowrap font-mono">
                          {eng.employee_id || "—"}
                        </td>

                        {/* Contact */}
                        <td className="p-4 align-middle">
                          <div className="space-y-0.5 text-sm">
                            {(eng.email) && (
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <Mail className="w-3 h-3 shrink-0" />
                                <span className="truncate max-w-[160px]">{eng.email}</span>
                              </div>
                            )}
                            {eng.phone && (
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <Phone className="w-3 h-3 shrink-0" />
                                <span>{eng.phone}</span>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Address */}
                        <td className="p-4 align-middle text-sm text-muted-foreground max-w-[180px]">
                          {eng.residential_address || eng.postcode ? (
                            <div className="flex items-start gap-1">
                              <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
                              <span className="line-clamp-2">{[eng.residential_address, eng.postcode].filter(Boolean).join(", ")}</span>
                            </div>
                          ) : (
                            <span className="italic text-xs">—</span>
                          )}
                        </td>

                        {/* Vendor */}
                        <td className="p-4 align-middle text-sm">
                          {eng.vendor_partner && eng.vendor_partner !== "FieldFlow (Internal)"
                            ? <span className="text-xs font-medium">{eng.vendor_partner}</span>
                            : <span className="text-muted-foreground italic text-xs">Internal</span>
                          }
                        </td>

                        {/* Type */}
                        <td className="p-4 align-middle">
                          <div className="inline-flex items-center rounded-full border font-semibold text-[10px] px-1.5 py-0 border-gray-300 text-gray-600 dark:border-gray-600 dark:text-gray-400 whitespace-nowrap">
                            {eng.engineer_type ? eng.engineer_type.replace("Regular ", "").replace(" FSE", " FSE") : "FSE"}
                          </div>
                        </td>

                        {/* Specialty */}
                        <td className="p-4 align-middle">
                          {eng.specialty
                            ? <Badge variant="outline" className="text-xs font-normal">{eng.specialty}</Badge>
                            : <span className="text-muted-foreground italic text-xs">—</span>
                          }
                        </td>

                        {/* Certification */}
                        <td className="p-4 align-middle text-sm">
                          {eng.certification ? (
                            <span className="text-xs font-medium">{eng.certification}</span>
                          ) : (
                            <span className="text-muted-foreground italic text-xs">—</span>
                          )}
                        </td>

                        {/* Work Location */}
                        <td className="p-4 align-middle text-sm text-muted-foreground whitespace-nowrap">
                          {eng.location || [eng.city, eng.country].filter(Boolean).join(", ") || <span className="italic">—</span>}
                        </td>

                        {/* Skills */}
                        <td className="p-4 align-middle max-w-[160px]">
                          {eng.skills?.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {eng.skills.slice(0, 3).map((s: string) => (
                                <Badge key={s} variant="secondary" className="text-[10px] px-1.5 py-0">{s}</Badge>
                              ))}
                              {eng.skills.length > 3 && <Badge variant="outline" className="text-[10px] px-1.5 py-0">+{eng.skills.length - 3}</Badge>}
                            </div>
                          ) : <span className="text-muted-foreground italic text-xs">—</span>}
                        </td>

                        {/* Rate */}
                        <td className="p-4 align-middle text-right text-sm whitespace-nowrap">
                          {formatRate(eng) ? (
                            <span>{formatRate(eng)} <span className="text-muted-foreground text-xs">{rateLabel(eng)}</span></span>
                          ) : (
                            <span className="text-muted-foreground italic">—</span>
                          )}
                        </td>

                        {/* Jobs */}
                        <td className="p-4 align-middle text-right text-sm">{eng.jobs_completed ?? 0}</td>

                        {/* Rating */}
                        <td className="p-4 align-middle text-right text-sm">
                          <span className="flex items-center justify-end gap-0.5">
                            <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                            {Number(eng.rating ?? 0).toFixed(1)}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="p-4 align-middle text-right">
                          {canCopyDispatch ? (
                            <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                              <Switch
                                checked={!!eng.is_available}
                                disabled={!!pendingAvailability[eng.id]}
                                onCheckedChange={(v) => handleToggleAvailability(eng.id, v)}
                                aria-label="Toggle availability"
                              />
                            </div>
                          ) : (
                            <Badge
                              className={eng.is_available
                                ? "bg-green-100 text-green-700 border-green-300"
                                : "bg-red-100 text-red-700 border-red-300"
                              }
                              variant="outline"
                            >
                              {eng.is_available ? "Available" : "Unavailable"}
                            </Badge>
                          )}
                        </td>

                        {/* Actions */}
                        {(isAdmin || canCopyDispatch) && (
                          <td className="p-4 align-middle text-center" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1">
                              {isAdmin && (
                                <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px] gap-1" onClick={() => setDetailEngineer(eng)}>
                                  <Eye className="w-3 h-3" /> Details
                                </Button>
                              )}
                              {canCopyDispatch && (
                                <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onClick={() => copyDispatchDetails(eng)}>
                                  <Copy className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Import Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={showImportDialog} onOpenChange={(open) => { if (!open) { setShowImportDialog(false); setUploadedFileName(null); setUploadPreviewRows([]); setAllUploadRows([]); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4" /> Import Engineers from File
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <p className="text-sm text-muted-foreground">
              Upload an Excel file (<code className="text-xs bg-muted px-1 py-0.5 rounded">.xlsx</code> / <code className="text-xs bg-muted px-1 py-0.5 rounded">.xls</code>) with columns:{" "}
              <strong>Name, Email, Phone, Specialty, Location, Skills, HourlyRate, EngineerType</strong>.
              Max {MAX_FILE_SIZE_MB} MB · {MAX_ROWS} rows.
            </p>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => { e.preventDefault(); setDragActive(false); const f = e.dataTransfer.files?.[0]; if (f) parseExcelFile(f); }}
              onClick={() => document.getElementById("excel-upload-input")?.click()}
              className={`relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed transition-all duration-200 py-10 px-6 cursor-pointer
                ${dragActive ? "border-primary bg-primary/5 scale-[1.01]" : "border-border hover:border-primary/60 hover:bg-muted/40"}`}
            >
              <input id="excel-upload-input" type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) parseExcelFile(f); }} />
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <Upload className="w-6 h-6 text-muted-foreground" />
              </div>
              {uploadedFileName ? (
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">{uploadedFileName}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{allUploadRows.length > 0 ? `${allUploadRows.length} engineers ready` : "Processing…"}</p>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">Drop your file here</p>
                  <p className="text-xs text-muted-foreground mt-0.5">or click to browse</p>
                </div>
              )}
            </div>
            {uploadPreviewRows.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Preview — first {uploadPreviewRows.length} of {allUploadRows.length} rows</p>
                <div className="rounded-lg border border-border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr>{Object.keys(uploadPreviewRows[0]).slice(0, 4).map((k) => <th key={k} className="px-3 py-2 text-left font-medium text-muted-foreground">{k}</th>)}</tr>
                    </thead>
                    <tbody>
                      {uploadPreviewRows.map((row, i) => (
                        <tr key={i} className="border-t border-border">
                          {Object.values(row).slice(0, 4).map((v: any, j) => <td key={j} className="px-3 py-2 text-foreground truncate max-w-[80px]">{String(v)}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <div className="flex gap-3 pt-1">
              <Button variant="ghost" className="flex-1" onClick={() => { setShowImportDialog(false); setUploadedFileName(null); setUploadPreviewRows([]); setAllUploadRows([]); }}>Cancel</Button>
              <Button className="flex-1" disabled={!allUploadRows.length || isImporting} onClick={handleSubmitImport}>
                {isImporting ? "Importing…" : allUploadRows.length > 0 ? `Import ${allUploadRows.length} Engineers` : "Import Engineers"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Admin Detail Dialog ────────────────────────────────────────────── */}
      <Dialog open={!!detailEngineer} onOpenChange={(open) => !open && setDetailEngineer(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">{detailEngineer?.name} — Details</DialogTitle>
          </DialogHeader>
          {detailEngineer && (
            <div className="space-y-5 pt-2">
              <EngineerScorecard engineer={{ full_name: detailEngineer.name, rating: detailEngineer.rating, jobs_completed: detailEngineer.jobs_completed }} />
              <div className="space-y-2 pt-3 border-t border-border">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Bank Details</p>
                  {bankDetails && (
                    <Badge variant="outline" className={bankDetails.verified
                      ? "bg-green-100 text-green-700 border-green-300"
                      : "bg-amber-100 text-amber-700 border-amber-300"
                    }>
                      {bankDetails.verified ? "Verified" : "Unverified"}
                    </Badge>
                  )}
                </div>
                {!bankDetails ? (
                  <p className="text-sm text-muted-foreground italic">No bank details submitted yet.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-muted-foreground">Account Holder</div><div className="font-medium text-foreground">{bankDetails.account_holder_name}</div>
                    <div className="text-muted-foreground">Country / Currency</div><div className="font-medium text-foreground">{bankDetails.country_code} · {bankDetails.currency}</div>
                    <div className="text-muted-foreground">Bank</div><div className="font-medium text-foreground">{bankDetails.bank_name}</div>
                    {bankDetails.iban && (<><div className="text-muted-foreground">IBAN</div><div className="font-medium text-foreground font-mono">{bankDetails.iban}</div></>)}
                    {bankDetails.account_number && (<><div className="text-muted-foreground">Account No.</div><div className="font-medium text-foreground font-mono">{bankDetails.account_number}</div></>)}
                    {bankDetails.local_bank_code && (<><div className="text-muted-foreground">{bankDetails.local_bank_code_type ?? "Local Code"}</div><div className="font-medium text-foreground font-mono">{bankDetails.local_bank_code}</div></>)}
                    {bankDetails.swift_bic && (<><div className="text-muted-foreground">SWIFT/BIC</div><div className="font-medium text-foreground font-mono">{bankDetails.swift_bic}</div></>)}
                  </div>
                )}
                {bankDetails && (
                  <Button
                    size="sm"
                    variant={bankDetails.verified ? "outline" : "default"}
                    className="w-full mt-2"
                    onClick={() => verifyBankDetails(bankDetails.id, bankDetails.verified)}
                  >
                    {bankDetails.verified ? "Remove Verification" : "Mark as Verified"}
                  </Button>
                )}
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Engineer Info</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-muted-foreground">ID Type / ID</div>
                  <div className="font-medium text-foreground font-mono break-all">
                    {detailEngineer.id_type ? `${detailEngineer.id_type} / ${detailEngineer.id}` : detailEngineer.id}
                  </div>
                  <div className="text-muted-foreground">Specialty</div><div className="font-medium text-foreground">{detailEngineer.specialty ?? "—"}</div>
                  <div className="text-muted-foreground">Certification</div><div className="font-medium text-foreground">{detailEngineer.certification ?? "—"}</div>
                  <div className="text-muted-foreground">Rating</div>
                  <div className="font-medium text-foreground flex items-center gap-1"><Star className="w-3.5 h-3.5 text-warning" />{Number(detailEngineer.rating ?? 0).toFixed(1)}</div>
                  <div className="text-muted-foreground">Jobs</div><div className="font-medium text-foreground">{detailEngineer.jobs_completed ?? 0} completed</div>
                  {detailEngineer.location && (<><div className="text-muted-foreground">Location</div><div className="font-medium text-foreground">{detailEngineer.location}</div></>)}
                  {(() => {
                    const resolvedRate = resolveRateForEngineer(detailEngineer);
                    if (resolvedRate) {
                      return (
                        <>
                          <div className="text-muted-foreground">Rate</div>
                          <div className="font-medium text-foreground">
                            {currency.symbol}{Number(resolvedRate.amount).toFixed(2)} / {resolvedRate.rate_type}
                          </div>
                        </>
                      );
                    }
                    return null;
                  })()}
                  <div className="text-muted-foreground">Type</div><div className="font-medium text-foreground">{detailEngineer.engineer_type ?? "Regular FSE"}</div>
                </div>
              </div>

              {canCopyDispatch && (
                <div className="pt-3 border-t border-border">
                  <Button variant="default" className="w-full gap-2" onClick={() => copyDispatchDetails(detailEngineer)}>
                    <Copy className="w-4 h-4" /> Copy Dispatch Details
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Engineers;