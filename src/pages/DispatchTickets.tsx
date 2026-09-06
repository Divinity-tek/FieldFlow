import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import TicketHistoryPanel from "@/components/dispatch/TicketHistoryPanel";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Plus, Search, FileText, Clock, DollarSign, MapPin, User,
  Phone, CheckCircle, XCircle, AlertTriangle, Eye, Edit, Printer,
  ClipboardList, ArrowUpDown, Loader2, Download, Filter, Save, Trash2, X,
  LayoutGrid, List, GripVertical, Wrench, FolderOpen, Hash, ChevronsUpDown, Check
} from "lucide-react";
import { DndContext, DragEndEvent, useDraggable, useDroppable, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";


// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const DISPATCH_TYPES = [
  { value: "install", label: "Installation" },
  { value: "repair", label: "Break/Fix Repair" },
  { value: "mac", label: "Move / Add / Change" },
  { value: "survey", label: "Site Survey" },
  { value: "decommission", label: "Decommission" },
  { value: "cabling", label: "Cabling / Infrastructure" },
  { value: "delivery", label: "Equipment Delivery" },
  { value: "general", label: "General Support" },
];

/** Rate types for labor billing — mirrors the "Rates" selector used on the Engineer form */
const RATE_TYPES: Array<{ value: string; label: string; unitLabel: string; unitLabelSingular: string }> = [
  { value: "hourly", label: "Hourly", unitLabel: "Hours", unitLabelSingular: "Hour" },
  { value: "half_day", label: "Half Day", unitLabel: "Half Days", unitLabelSingular: "Half Day" },
  { value: "full_day", label: "Full Day", unitLabel: "Days", unitLabelSingular: "Day" },
  { value: "monthly", label: "Monthly", unitLabel: "Months", unitLabelSingular: "Month" },
];

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Draft", variant: "secondary" },
  pending_approval: { label: "Pending Approval", variant: "outline" },
  approved: { label: "Approved", variant: "default" },
  dispatched: { label: "Dispatched", variant: "default" },
  in_progress: { label: "In Progress", variant: "default" },
  completed: { label: "Completed", variant: "default" },
  cancelled: { label: "Cancelled", variant: "destructive" },
  rejected: { label: "Rejected", variant: "destructive" },
};

const PRIORITY_MAP: Record<string, { label: string; color: string }> = {
  low: { label: "Low", color: "text-muted-foreground" },
  medium: { label: "Medium", color: "text-yellow-600" },
  high: { label: "High", color: "text-orange-500" },
  urgent: { label: "Urgent", color: "text-destructive" },
};

/** Common tools/equipment for dispatch jobs — editable at runtime via Add Tool */
const DEFAULT_TOOLS = [
  "Laptop", "Network Switch", "Router", "Patch Panel", "Rack Unit",
  "Ethernet Cables", "Power Cables", "Fiber Optic Kit", "Drill", "Screwdriver Set",
  "Multimeter", "Cable Tester", "Label Maker", "Ladder", "UPS Unit",
  "KVM Switch", "Keyboard / Mouse", "Monitor", "Wireless AP", "CCTV Camera",
];

// ─────────────────────────────────────────────────────────────────────────────
// localStorage helpers
// ─────────────────────────────────────────────────────────────────────────────

type Project = { id: string; name: string; description?: string };
/** Default approver emails shown in the "Approve By" dropdown — edit this list to match your org, or add more from the popup at runtime */
const DEFAULT_APPROVERS: string[] = [
  "admin@fieldflow.com",
  "teamlead@fieldflow.com",
];
const LS_CUSTOM_APPROVERS = "dt_custom_approvers";

/** One labor-rate row — mirrors the Engineer "Rates" pattern (rate_type + quantity + amount) */
interface LaborRateEntry {
  id: string;
  rate_type: string;    // "hourly" | "half_day" | "full_day" | "monthly"
  quantity: number;     // hours / half-days / days / months
  rate_amount: number;  // $ per unit
}

const makeRateId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

const emptyLaborRate = (rateType = "hourly"): LaborRateEntry => ({
  id: makeRateId(),
  rate_type: rateType,
  quantity: 0,
  rate_amount: 75,
});

const laborRowTotal = (r: LaborRateEntry) => Number(r.quantity) * Number(r.rate_amount);

type TicketExtras = { client_ticket_number?: string; project_id?: string; tools?: string[]; labor_rates?: LaborRateEntry[]; approved_by?: string; approver_email?: string; client_partner_id?: string };

/** Statuses at or beyond "approved" — this is when Approved By / Approver Email become required */
const APPROVED_OR_LATER = ["approved", "dispatched", "in_progress", "completed"];

const LS_PROJECTS = "dt_projects";
const LS_TICKET_EXTRAS = "dt_ticket_extras";
const LS_CUSTOM_TOOLS = "dt_custom_tools";
const LS_VIEW_MODE = "dt_view_mode";
const LS_SAVED_VIEWS = "dt_saved_views";

const lsGet = <T,>(key: string, fallback: T): T => {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; }
};
const lsSet = (key: string, value: unknown) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota exceeded */ }
};

const getTicketExtras = (id: string): TicketExtras => {
  const all = lsGet<Record<string, TicketExtras>>(LS_TICKET_EXTRAS, {});
  return all[id] ?? {};
};
const saveTicketExtras = (id: string, extras: TicketExtras) => {
  const all = lsGet<Record<string, TicketExtras>>(LS_TICKET_EXTRAS, {});
  lsSet(LS_TICKET_EXTRAS, { ...all, [id]: extras });
};

/** Auto-generate a ticket number for display (DB will produce the canonical one) */
const generateTicketNumber = () => {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `TKT-${yy}${mm}-${rand}`;
};

// ─────────────────────────────────────────────────────────────────────────────
// Form state
// ─────────────────────────────────────────────────────────────────────────────

const emptyForm = {
  title: "",
  dispatch_type: "general",
  sow_description: "",
  site_address: "",
  contact_person: "",
  contact_phone: "",
  labor_rates: [emptyLaborRate()] as LaborRateEntry[],  // one or more { rate_type, quantity, rate_amount } rows
  travel_time: 0,
  travel_rate: 50,
  materials_cost: 0,
  priority: "medium",
  status: "draft",
  client_id: "",
  client_partner_id: "",      // secondary/partner client tagged on this ticket (localStorage)
  engineer_id: "",
  scheduled_date: "",
  // ── NEW FIELDS ──
  client_ticket_number: "",   // manual client-side ticket reference
  project_id: "",             // linked project (localStorage)
  tools: [] as string[],      // tools/equipment list
};

// ─────────────────────────────────────────────────────────────────────────────
// DispatchTickets component
// ─────────────────────────────────────────────────────────────────────────────

const DispatchTickets = () => {
  const { user } = useAuth();
  const { isEngineer, isAdmin, isTeamLead } = useUserRole();
  const canManage = isAdmin || isTeamLead;
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);

  // ── Projects (localStorage) ──────────────────────────────────────────────
  const [projects, setProjects] = useState<Project[]>(() => lsGet<Project[]>(LS_PROJECTS, []));
  const [addProjectOpen, setAddProjectOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");

  useEffect(() => { lsSet(LS_PROJECTS, projects); }, [projects]);

  const handleAddProject = () => {
    if (!newProjectName.trim()) return;
    const proj: Project = {
      id: `proj_${Date.now()}`,
      name: newProjectName.trim(),
      description: newProjectDesc.trim() || undefined,
    };
    setProjects((p) => [...p, proj]);
    setForm((f) => ({ ...f, project_id: proj.id }));
    setNewProjectName("");
    setNewProjectDesc("");
    setAddProjectOpen(false);
    toast.success(`Project "${proj.name}" created`);
  };

  // ── Custom tools (localStorage) ──────────────────────────────────────────
  const [customTools, setCustomTools] = useState<string[]>(() => lsGet<string[]>(LS_CUSTOM_TOOLS, []));
  const [newToolName, setNewToolName] = useState("");
  const allTools = useMemo(() => [...DEFAULT_TOOLS, ...customTools], [customTools]);

  useEffect(() => { lsSet(LS_CUSTOM_TOOLS, customTools); }, [customTools]);

  const handleAddCustomTool = () => {
    const name = newToolName.trim();
    if (!name || allTools.includes(name)) return;
    setCustomTools((p) => [...p, name]);
    setForm((f) => ({ ...f, tools: [...f.tools, name] }));
    setNewToolName("");
    toast.success(`Tool "${name}" added`);
  };

  const toggleTool = (tool: string) => {
    setForm((f) => ({
      ...f,
      tools: f.tools.includes(tool) ? f.tools.filter((t) => t !== tool) : [...f.tools, tool],
    }));
  };

  // ── Labor rate rows (multi-rate, mirrors Engineers "Rates") ─────────────
  // NOTE: these must live INSIDE the component because they call setForm,
  // which only exists once `const [form, setForm] = useState(...)` below
  // has run. Defining them at module scope (outside the component) is what
  // was breaking "Add Rate" and the rate-type dropdown — setForm was
  // undefined at that scope and threw a ReferenceError on click.
  const addLaborRateRow = () => {
    setForm((f) => ({
      ...f,
      labor_rates: [...f.labor_rates, emptyLaborRate(f.labor_rates[f.labor_rates.length - 1]?.rate_type ?? "hourly")],
    }));
  };

  const removeLaborRateRow = (id: string) => {
    setForm((f) => ({
      ...f,
      labor_rates: f.labor_rates.length > 1 ? f.labor_rates.filter((r) => r.id !== id) : f.labor_rates,
    }));
  };

  const updateLaborRateRow = (id: string, field: keyof Omit<LaborRateEntry, "id">, value: string | number) => {
    setForm((f) => ({
      ...f,
      labor_rates: f.labor_rates.map((r) => (r.id === id ? { ...r, [field]: value } : r)),
    }));
  };

  // // ── Custom approvers (localStorage) ──────────────────────────────────────
  // const [customApprovers, setCustomApprovers] = useState<string[]>(() => lsGet<string[]>(LS_CUSTOM_APPROVERS, []));
  // const [newApproverEmail, setNewApproverEmail] = useState("");
  // const allApprovers = useMemo(() => [...DEFAULT_APPROVERS, ...customApprovers], [customApprovers]);

  // useEffect(() => { lsSet(LS_CUSTOM_APPROVERS, customApprovers); }, [customApprovers]);

  // const handleAddCustomApprover = () => {
  //   const email = newApproverEmail.trim().toLowerCase();
  //   if (!email || !/^\S+@\S+\.\S+$/.test(email) || allApprovers.includes(email)) return;
  //   setCustomApprovers((p) => [...p, email]);
  //   setPendingApproverEmail(email);
  //   setNewApproverEmail("");
  //   toast.success(`"${email}" added to Approve By list`);
  // };

  // // ── Approval popup (shown when Status is set to Approved-or-later) ──────
  // const [showApprovalPopup, setShowApprovalPopup] = useState(false);
  // const [pendingApproverEmail, setPendingApproverEmail] = useState("");
  // const [pendingStatus, setPendingStatus] = useState<string | null>(null);

  // ── Engineer scope ───────────────────────────────────────────────────────
  const { data: myEngineerId } = useQuery({
    queryKey: ["my-engineer-id", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("engineers").select("id").eq("user_id", user!.id).maybeSingle();
      return data?.id ?? null;
    },
    enabled: !!user?.id && isEngineer,
  });

  const [viewTicket, setViewTicket] = useState<any>(null);
  const [editTicket, setEditTicket] = useState<any>(null);
  const [editForm, setEditForm] = useState({ status: "draft", priority: "medium", engineer_id: "", engineer_notes: "", approved_by: "", approver_email: "" });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [engineerFilter, setEngineerFilter] = useState<string>("all");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [savedViews, setSavedViews] = useState<Array<{ name: string; filters: any }>>(() =>
    lsGet(LS_SAVED_VIEWS, [])
  );
  const [form, setForm] = useState(emptyForm);
  const [viewMode, setViewMode] = useState<"table" | "kanban">(() => (lsGet(LS_VIEW_MODE, "table") as any));

  useEffect(() => { lsSet(LS_VIEW_MODE, viewMode); }, [viewMode]);
  useEffect(() => { lsSet(LS_SAVED_VIEWS, savedViews); }, [savedViews]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  // Per-ticket status coalescing
  const inFlightRef = useRef<Map<string, { pending: string | null }>>(new Map());
  const originalStatusRef = useRef<Map<string, string>>(new Map());
  const [pendingStatusIds, setPendingStatusIds] = useState<Set<string>>(new Set());
  const [filterEngineerPickerOpen, setFilterEngineerPickerOpen] = useState(false);
  const [bulkEngineerPickerOpen, setBulkEngineerPickerOpen] = useState(false);
  const [editEngineerPickerOpen, setEditEngineerPickerOpen] = useState(false);
  const markPending = useCallback((id: string, on: boolean) => {
    setPendingStatusIds((prev) => {
      const has = prev.has(id);
      if (on === has) return prev;
      const next = new Set(prev);
      if (on) next.add(id); else next.delete(id);
      return next;
    });
  }, []);

  // ── Queries ─────────────────────────────────────────────────────────────
  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["dispatch-tickets", isEngineer ? myEngineerId ?? "none" : "all"],
    queryFn: async () => {
      let q = supabase.from("dispatch_tickets").select("*").order("created_at", { ascending: false });
      if (isEngineer) {
        if (!myEngineerId) return [];
        q = q.eq("engineer_id", myEngineerId);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    enabled: !isEngineer || myEngineerId !== undefined,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-list"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, company_name, contact_name");
      return data ?? [];
    },
  });

  const { data: myProfile } = useQuery({
    queryKey: ["my-profile-approver", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from("profiles").select("full_name, email").eq("user_id", user.id).maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  const {
    data: engineers = [],
    isLoading: engineersLoading,
    error: engineersError,
    refetch: refetchEngineers,
    isFetching: engineersFetching,
  } = useQuery({
    queryKey: ["engineers-list"],
    queryFn: async () => {
      const { data: engs, error } = await supabase
        .from("engineers")
        .select("id, user_id, specialty, is_available")
        .eq("is_available", true);
      if (error) throw error;
      const userIds = (engs ?? []).map((e: any) => e.user_id).filter(Boolean);
      let profilesMap: Record<string, string> = {};
      if (userIds.length) {
        const { data: profs, error: pErr } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", userIds);
        if (pErr) throw pErr;
        profilesMap = Object.fromEntries((profs ?? []).map((p: any) => [p.user_id, p.full_name]));
      }
      return (engs ?? []).map((e: any) => ({ ...e, profiles: { full_name: profilesMap[e.user_id] ?? null } }));
    },
    retry: 1,
  });

  const renderEngineerStatus = () => {
    if (engineersLoading) {
      return (
        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading engineers…
        </div>
      );
    }
    if (engineersError) {
      return (
        <div className="mt-1 flex items-start justify-between gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-2 py-1.5 text-xs text-destructive">
          <span className="flex items-start gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5" />
            Failed to load engineers: {(engineersError as any)?.message ?? "Unknown error"}
          </span>
          <button
            type="button"
            className="underline font-medium hover:opacity-80"
            onClick={() => refetchEngineers()}
            disabled={engineersFetching}
          >
            {engineersFetching ? "Retrying…" : "Retry"}
          </button>
        </div>
      );
    }
    if (!engineers.length) {
      return <p className="mt-1 text-xs text-muted-foreground">No available engineers found.</p>;
    }
    return null;
  };

  // ── Mutations ────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: async (payload: typeof form) => {
      const insertData: Record<string, any> = {
        title: payload.title,
        dispatch_type: payload.dispatch_type,
        sow_description: payload.sow_description,
        site_address: payload.site_address,
        contact_person: payload.contact_person || null,
        contact_phone: payload.contact_phone || null,
        // DB columns only hold one rate — mirror the FIRST labor row here for
        // backward-compat with the estimated_charges generated column.
        // The full multi-rate breakdown lives in extras.labor_rates below.
        estimated_hours: Number(payload.labor_rates[0]?.quantity ?? 0),
        hourly_rate: Number(payload.labor_rates[0]?.rate_amount ?? 0),
        travel_time: Number(payload.travel_time),
        travel_rate: Number(payload.travel_rate),
        materials_cost: Number(payload.materials_cost),
        priority: payload.priority,
        status: payload.status,
        client_id: payload.client_id,
        created_by: user?.id,
      };
      if (payload.engineer_id) insertData.engineer_id = payload.engineer_id;
      if (payload.scheduled_date) insertData.scheduled_date = new Date(payload.scheduled_date).toISOString();

      // Insert and get back the new ticket's id + ticket_number
      const { data, error } = await supabase
        .from("dispatch_tickets")
        .insert(insertData as any)
        .select("id, ticket_number")
        .single();
      if (error) throw error;

      // Persist extras (project, tools, client ticket number) to localStorage
      if (data?.id) {
        saveTicketExtras(data.id, {
          client_ticket_number: payload.client_ticket_number || undefined,
          project_id: payload.project_id || undefined,
          tools: payload.tools.length ? payload.tools : undefined,
          labor_rates: payload.labor_rates.length ? payload.labor_rates : undefined,
          client_partner_id: payload.client_partner_id || undefined,
        });
      }
      return data;
    },
    onSuccess: (data) => {
      const num = data?.ticket_number ?? "—";
      toast.success(`Dispatch ticket ${num} created`);
      qc.invalidateQueries({ queryKey: ["dispatch-tickets"] });
      setCreateOpen(false);
      setForm(emptyForm);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updates: Record<string, any> = { status };
      if (status === "completed") updates.completed_date = new Date().toISOString();
      const { error } = await supabase.from("dispatch_tickets").update(updates as any).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, status }: { id: string; status: string }) => {
      await qc.cancelQueries({ queryKey: ["dispatch-tickets"] });
      const list = qc.getQueryData<any[]>(["dispatch-tickets"]) ?? [];
      const prevTicket = list.find((t: any) => t.id === id);
      const prevFields = prevTicket
        ? { status: prevTicket.status, completed_date: prevTicket.completed_date }
        : null;
      qc.setQueryData<any[]>(["dispatch-tickets"], (old) =>
        (old ?? []).map((t: any) =>
          t.id === id
            ? { ...t, status, completed_date: status === "completed" ? new Date().toISOString() : t.completed_date }
            : t,
        ),
      );
      return { id, prevFields };
    },
    onError: (e: any, _v, ctx) => {
      if (ctx?.prevFields) {
        qc.setQueryData<any[]>(["dispatch-tickets"], (old) =>
          (old ?? []).map((t: any) => (t.id === ctx.id ? { ...t, ...ctx.prevFields } : t)),
        );
      }
      toast.error(`Failed to update status: ${e?.message ?? "unknown error"}`);
    },
    onSuccess: () => { toast.success("Status updated"); },
    onSettled: (_d, _e, vars) => {
      const id = (vars as any)?.id as string | undefined;
      if (id) {
        const entry = inFlightRef.current.get(id);
        const pending = entry?.pending ?? null;
        inFlightRef.current.delete(id);
        if (pending) { queueStatusUpdate(id, pending); return; }
        markPending(id, false);
        originalStatusRef.current.delete(id);
      }
      if (qc.isMutating({ mutationKey: ["dispatch-ticket-status"] }) <= 1) {
        qc.invalidateQueries({ queryKey: ["dispatch-tickets"] });
      }
    },
    mutationKey: ["dispatch-ticket-status"],
  });

  const queueStatusUpdate = useCallback((id: string, status: string) => {
    const entry = inFlightRef.current.get(id);
    if (entry) {
      entry.pending = status;
      qc.setQueryData<any[]>(["dispatch-tickets"], (old) =>
        (old ?? []).map((t: any) => (t.id === id ? { ...t, status } : t)),
      );
      return;
    }
    if (!originalStatusRef.current.has(id)) {
      const list = qc.getQueryData<any[]>(["dispatch-tickets"]) ?? [];
      const cur = list.find((t: any) => t.id === id);
      if (cur && cur.status !== status) originalStatusRef.current.set(id, cur.status);
    }
    inFlightRef.current.set(id, { pending: null });
    markPending(id, true);
    updateStatusMutation.mutate({ id, status });
  }, [qc, markPending]);

  const [undoConfirmId, setUndoConfirmId] = useState<string | null>(null);
  const requestUndo = useCallback((id: string) => {
    if (originalStatusRef.current.has(id)) setUndoConfirmId(id);
  }, []);
  const undoStatusUpdate = useCallback((id: string) => {
    const original = originalStatusRef.current.get(id);
    if (!original) return;
    originalStatusRef.current.delete(id);
    queueStatusUpdate(id, original);
  }, [queueStatusUpdate]);

  const editMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, any> }) => {
      if (updates.status === "completed") updates.completed_date = new Date().toISOString();
      const { error } = await supabase.from("dispatch_tickets").update(updates as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ticket updated");
      qc.invalidateQueries({ queryKey: ["dispatch-tickets"] });
      setEditTicket(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openEdit = (t: any) => {
    const extras = getTicketExtras(t.id);
    setEditForm({
      status: t.status ?? "draft",
      priority: t.priority ?? "medium",
      engineer_id: t.engineer_id ?? "",
      engineer_notes: t.engineer_notes ?? "",
      approved_by: extras.approved_by ?? "",
      approver_email: extras.approver_email ?? "",
    });
    setEditTicket(t);
  };

  // ── Computed ─────────────────────────────────────────────────────────────
  const estimatedLaborTotal = form.labor_rates.reduce((sum, r) => sum + laborRowTotal(r), 0);

  const estimatedTotal =
    estimatedLaborTotal
    + (Number(form.travel_time) * Number(form.travel_rate))
    + Number(form.materials_cost);

  const filtered = useMemo(() => tickets.filter((t: any) => {
    const matchSearch = !search
      || t.title?.toLowerCase().includes(search.toLowerCase())
      || t.ticket_number?.toLowerCase().includes(search.toLowerCase())
      || t.site_address?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || t.status === statusFilter;
    const matchPriority = priorityFilter === "all" || t.priority === priorityFilter;
    const matchEngineer = engineerFilter === "all"
      || (engineerFilter === "unassigned" ? !t.engineer_id : t.engineer_id === engineerFilter);
    const matchClient = clientFilter === "all" || t.client_id === clientFilter;
    const created = t.created_at ? new Date(t.created_at) : null;
    const matchFrom = !dateFrom || (created && created >= new Date(dateFrom));
    const matchTo = !dateTo || (created && created <= new Date(dateTo + "T23:59:59"));
    return matchSearch && matchStatus && matchPriority && matchEngineer && matchClient && matchFrom && matchTo;
  }), [tickets, search, statusFilter, priorityFilter, engineerFilter, clientFilter, dateFrom, dateTo]);

  const activeFilterCount = [
    statusFilter !== "all", priorityFilter !== "all", engineerFilter !== "all",
    clientFilter !== "all", !!dateFrom, !!dateTo,
  ].filter(Boolean).length;

  const clearFilters = () => {
    setStatusFilter("all"); setPriorityFilter("all"); setEngineerFilter("all");
    setClientFilter("all"); setDateFrom(""); setDateTo("");
  };

  const allVisibleSelected = filtered.length > 0 && filtered.every((t: any) => selectedIds.includes(t.id));
  const toggleSelectAll = () => {
    setSelectedIds(allVisibleSelected ? [] : filtered.map((t: any) => t.id));
  };
  const toggleSelect = (id: string) => {
    setSelectedIds((p) => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  };

  const bulkUpdateMutation = useMutation({
    mutationFn: async ({ ids, updates }: { ids: string[]; updates: Record<string, any> }) => {
      if (updates.status === "completed") updates.completed_date = new Date().toISOString();
      const { error } = await supabase.from("dispatch_tickets").update(updates as any).in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(`Updated ${v.ids.length} ticket${v.ids.length === 1 ? "" : "s"}`);
      qc.invalidateQueries({ queryKey: ["dispatch-tickets"] });
      setSelectedIds([]);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("dispatch_tickets").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_d, ids) => {
      toast.success(`Deleted ${ids.length} ticket${ids.length === 1 ? "" : "s"}`);
      qc.invalidateQueries({ queryKey: ["dispatch-tickets"] });
      setSelectedIds([]);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const exportCSV = (rows: any[]) => {
    if (!rows.length) { toast.error("Nothing to export"); return; }
    const cols = [
      ["Ticket #", "ticket_number"],
      ["Client Ticket #", (r: any) => getTicketExtras(r.id).client_ticket_number ?? ""],
      ["Title", "title"],
      ["Type", "dispatch_type"],
      ["Project", (r: any) => getProjectName(getTicketExtras(r.id).project_id ?? "")],
      ["Client", (r: any) => getClientName(r.client_id)],
      ["Client Partner", (r: any) => { const pid = getTicketExtras(r.id).client_partner_id; return pid ? getClientName(pid) : ""; }],
      ["Engineer", (r: any) => getEngineerName(r.engineer_id)],
      ["Priority", "priority"],
      ["Status", "status"],
      ["Site Address", "site_address"],
      ["Contact", "contact_person"],
      ["Phone", "contact_phone"],
      ["Tools", (r: any) => (getTicketExtras(r.id).tools ?? []).join("; ")],
      ["Rate Type(s)", (r: any) => (getTicketExtras(r.id).labor_rates ?? []).map((lr) => RATE_TYPES.find((rt) => rt.value === lr.rate_type)?.label ?? lr.rate_type).join("; ")],
      ["Labor Total", (r: any) => (getTicketExtras(r.id).labor_rates ?? []).reduce((s, lr) => s + laborRowTotal(lr), 0).toFixed(2)],
      ["Approve By", (r: any) => getTicketExtras(r.id).approver_email ?? ""],
      ["Estimated Hours", "estimated_hours"],
      ["Hourly Rate", "hourly_rate"],
      ["Estimated Charges", "estimated_charges"],
      ["Actual Charges", "actual_charges"],
      ["Scheduled", "scheduled_date"],
      ["Completed", "completed_date"],
      ["Created", "created_at"],
    ] as Array<[string, string | ((r: any) => any)]>;
    const esc = (v: any) => {
      if (v == null) return "";
      const s = String(v).replace(/"/g, '""');
      return /[",\n]/.test(s) ? `"${s}"` : s;
    };
    const header = cols.map(([h]) => esc(h)).join(",");
    const body = rows.map(r => cols.map(([, k]) => esc(typeof k === "function" ? k(r) : r[k])).join(",")).join("\n");
    const blob = new Blob([header + "\n" + body], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `dispatch-tickets-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const saveCurrentView = () => {
    const name = window.prompt("Name this view:");
    if (!name) return;
    const filters = { statusFilter, priorityFilter, engineerFilter, clientFilter, dateFrom, dateTo, search };
    setSavedViews((p) => [...p.filter(v => v.name !== name), { name, filters }]);
    toast.success(`View "${name}" saved`);
  };
  const applyView = (v: { name: string; filters: any }) => {
    const f = v.filters || {};
    setStatusFilter(f.statusFilter ?? "all");
    setPriorityFilter(f.priorityFilter ?? "all");
    setEngineerFilter(f.engineerFilter ?? "all");
    setClientFilter(f.clientFilter ?? "all");
    setDateFrom(f.dateFrom ?? ""); setDateTo(f.dateTo ?? "");
    setSearch(f.search ?? "");
  };
  const deleteView = (name: string) => setSavedViews((p) => p.filter(v => v.name !== name));

  const stats = {
    total: tickets.length,
    active: tickets.filter((t: any) => ["dispatched"].includes(t.status)).length,
    inProgress: tickets.filter((t: any) => ["in_progress"].includes(t.status)).length,
    pending: tickets.filter((t: any) => ["draft", "pending_approval"].includes(t.status)).length,
    completed: tickets.filter((t: any) => ["completed"].includes(t.status)).length,
    totalEstimated: tickets.reduce((s: number, t: any) => s + Number(t.estimated_charges ?? 0), 0),
  };

  const getEngineerName = (engId: string) => {
    const eng = engineers.find((e: any) => e.id === engId);
    if (!eng) return "Unassigned";
    const p = eng.profiles as any;
    return p?.full_name ?? eng.specialty;
  };
  const getClientName = (clientId: string) =>
    clients.find((c: any) => c.id === clientId)?.company_name ?? "—";
  const getProjectName = (projectId: string) =>
    projects.find((p) => p.id === projectId)?.name ?? "—";

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <AppLayout title="Dispatch Tickets" subtitle="Hands & Feet Support — SOW Management">

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card><CardContent className="pt-4 pb-3">
          <div className="flex items-center justify-between">
            <div><p className="text-xs text-muted-foreground">Total Tickets</p><p className="text-2xl font-bold">{stats.total}</p></div>
            <ClipboardList className="w-8 h-8 text-primary/30" />
          </div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <div className="flex items-center justify-between">
            <div><p className="text-xs text-muted-foreground">Dispatched</p><p className="text-2xl font-bold">{stats.active}</p></div>
            <Clock className="w-8 h-8 text-blue-400/30" />
          </div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <div className="flex items-center justify-between">
            <div><p className="text-xs text-muted-foreground">In-progress</p><p className="text-2xl font-bold">{stats.inProgress}</p></div>
            <Clock className="w-8 h-8 text-blue-400/30" />
          </div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <div className="flex items-center justify-between">
            <div><p className="text-xs text-muted-foreground">Pending Approval</p><p className="text-2xl font-bold">{stats.pending}</p></div>
            <AlertTriangle className="w-8 h-8 text-yellow-400/30" />
          </div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <div className="flex items-center justify-between">
            <div><p className="text-xs text-muted-foreground">Completed</p><p className="text-2xl font-bold">{stats.completed}</p></div>
            <CheckCircle className="w-8 h-8 text-green-400/30" />
          </div>
        </CardContent></Card>
      </div>

      {/* ── Toolbar ── */}
      <div className="flex flex-col sm:flex-row gap-3 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search tickets, ticket #, site address…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="All Statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.entries(STATUS_MAP).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-1.5">
              <Filter className="w-4 h-4" /> Filters
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5">{activeFilterCount}</Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-3 space-y-3" align="end">
            <div>
              <Label className="text-xs">Priority</Label>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {Object.entries(PRIORITY_MAP).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Engineer</Label>
              <Popover open={filterEngineerPickerOpen} onOpenChange={setFilterEngineerPickerOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="h-9 mt-1 w-full justify-between font-normal">
                    {engineerFilter === "all" ? "All"
                      : engineerFilter === "unassigned" ? "Unassigned"
                      : (engineers.find((e: any) => e.id === engineerFilter)?.profiles?.full_name ?? engineers.find((e: any) => e.id === engineerFilter)?.specialty ?? "Unknown")}
                    <ChevronsUpDown className="w-3.5 h-3.5 text-muted-foreground shrink-0 ml-2" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search engineers…" className="h-9 text-sm" />
                    <CommandList>
                      <CommandEmpty className="py-3 text-xs text-center text-muted-foreground">No engineer found.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem value="all" onSelect={() => { setEngineerFilter("all"); setFilterEngineerPickerOpen(false); }}>
                          <Check className={`mr-2 h-4 w-4 ${engineerFilter === "all" ? "opacity-100" : "opacity-0"}`} />
                          All
                        </CommandItem>
                        <CommandItem value="unassigned" onSelect={() => { setEngineerFilter("unassigned"); setFilterEngineerPickerOpen(false); }}>
                          <Check className={`mr-2 h-4 w-4 ${engineerFilter === "unassigned" ? "opacity-100" : "opacity-0"}`} />
                          Unassigned
                        </CommandItem>
                        {engineers.map((e: any) => (
                          <CommandItem
                            key={e.id}
                            value={e.profiles?.full_name ?? e.specialty}
                            onSelect={() => { setEngineerFilter(e.id); setFilterEngineerPickerOpen(false); }}
                          >
                            <Check className={`mr-2 h-4 w-4 ${engineerFilter === e.id ? "opacity-100" : "opacity-0"}`} />
                            {e.profiles?.full_name ?? e.specialty}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label className="text-xs">Client</Label>
              <Select value={clientFilter} onValueChange={setClientFilter}>
                <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {clients.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Created from</Label>
                <Input type="date" className="h-9 mt-1" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">to</Label>
                <Input type="date" className="h-9 mt-1" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </div>
            </div>
            <Separator />
            <div className="flex items-center justify-between gap-2">
              <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1.5">
                <X className="w-3.5 h-3.5" /> Clear
              </Button>
              <Button size="sm" onClick={saveCurrentView} className="gap-1.5">
                <Save className="w-3.5 h-3.5" /> Save view
              </Button>
            </div>
            {savedViews.length > 0 && (
              <>
                <Separator />
                <div>
                  <Label className="text-xs mb-1 block">Saved views</Label>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {savedViews.map((v) => (
                      <div key={v.name} className="flex items-center justify-between text-xs rounded px-2 py-1 hover:bg-muted">
                        <button className="flex-1 text-left" onClick={() => applyView(v)}>{v.name}</button>
                        <button onClick={() => deleteView(v.name)} title="Delete view" className="opacity-60 hover:opacity-100">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </PopoverContent>
        </Popover>

        <Button variant="outline" className="gap-1.5" onClick={() => exportCSV(filtered)}>
          <Download className="w-4 h-4" /> Export CSV
        </Button>
        <div className="inline-flex rounded-md border bg-background p-0.5">
          <Button type="button" size="sm" variant={viewMode === "table" ? "secondary" : "ghost"} className="gap-1.5 h-9" onClick={() => setViewMode("table")}>
            <List className="w-4 h-4" /> Table
          </Button>
          <Button type="button" size="sm" variant={viewMode === "kanban" ? "secondary" : "ghost"} className="gap-1.5 h-9" onClick={() => setViewMode("kanban")}>
            <LayoutGrid className="w-4 h-4" /> Kanban
          </Button>
        </div>
        {canManage && (
          <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
            <Plus className="w-4 h-4" /> New Dispatch Ticket
          </Button>
        )}
      </div>

      {/* ── Bulk action bar ── */}
      {canManage && selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-3 p-2 rounded-md border bg-muted/40">
          <span className="text-sm font-medium px-2">{selectedIds.length} selected</span>
          <Select onValueChange={(v) => bulkUpdateMutation.mutate({ ids: selectedIds, updates: { status: v } })}>
            <SelectTrigger className="h-8 w-[170px]"><SelectValue placeholder="Set status…" /></SelectTrigger>
            <SelectContent>
              {Object.entries(STATUS_MAP).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select onValueChange={(v) => bulkUpdateMutation.mutate({ ids: selectedIds, updates: { priority: v } })}>
            <SelectTrigger className="h-8 w-[160px]"><SelectValue placeholder="Set priority…" /></SelectTrigger>
            <SelectContent>
              {Object.entries(PRIORITY_MAP).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Popover open={bulkEngineerPickerOpen} onOpenChange={setBulkEngineerPickerOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" role="combobox" className="h-8 w-[180px] justify-between font-normal text-xs">
                Assign engineer…
                <ChevronsUpDown className="w-3.5 h-3.5 text-muted-foreground shrink-0 ml-2" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[220px] p-0" align="start">
              <Command>
                <CommandInput placeholder="Search engineers…" className="h-9 text-sm" />
                <CommandList>
                  <CommandEmpty className="py-3 text-xs text-center text-muted-foreground">No engineer found.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      value="unassign"
                      onSelect={() => { bulkUpdateMutation.mutate({ ids: selectedIds, updates: { engineer_id: null } }); setBulkEngineerPickerOpen(false); }}
                    >
                      Unassign
                    </CommandItem>
                    {engineers.map((e: any) => (
                      <CommandItem
                        key={e.id}
                        value={e.profiles?.full_name ?? e.specialty}
                        onSelect={() => { bulkUpdateMutation.mutate({ ids: selectedIds, updates: { engineer_id: e.id } }); setBulkEngineerPickerOpen(false); }}
                      >
                        {e.profiles?.full_name ?? e.specialty}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => exportCSV(filtered.filter((t: any) => selectedIds.includes(t.id)))}>
            <Download className="w-3.5 h-3.5" /> Export
          </Button>
          <Button
            size="sm" variant="destructive" className="gap-1.5"
            onClick={() => {
              if (window.confirm(`Delete ${selectedIds.length} ticket(s)? This cannot be undone.`)) {
                bulkDeleteMutation.mutate(selectedIds);
              }
            }}
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </Button>
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setSelectedIds([])}>Clear</Button>
        </div>
      )}

      {/* ── Table / Kanban ── */}
      {viewMode === "table" ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  {canManage && (
                    <TableHead className="w-10">
                      <Checkbox checked={allVisibleSelected} onCheckedChange={toggleSelectAll} aria-label="Select all" />
                    </TableHead>
                  )}
                  <TableHead>Ticket #</TableHead>
                  <TableHead>Client Ticket #</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Client</TableHead>
                  {!isEngineer && <TableHead>Engineer</TableHead>}
                  <TableHead>Priority</TableHead>
                  {!isEngineer && <TableHead>Est. Charges</TableHead>}
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={12} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                    {isEngineer ? "No tickets are assigned to you yet." : "No dispatch tickets found"}
                  </TableCell></TableRow>
                ) : (
                  filtered.map((t: any) => {
                    const extras = getTicketExtras(t.id);
                    const pri = PRIORITY_MAP[t.priority] ?? PRIORITY_MAP.medium;
                    const st = STATUS_MAP[t.status] ?? STATUS_MAP.draft;
                    const checked = selectedIds.includes(t.id);
                    return (
                      <TableRow
                        key={t.id}
                        className="cursor-pointer hover:bg-muted/50 data-[state=selected]:bg-muted"
                        data-state={checked ? "selected" : undefined}
                        onClick={() => setViewTicket(t)}
                      >
                        {canManage && (
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox checked={checked} onCheckedChange={() => toggleSelect(t.id)} aria-label={`Select ${t.ticket_number}`} />
                          </TableCell>
                        )}
                        <TableCell className="font-mono text-xs">{t.ticket_number}</TableCell>
                        <TableCell className="text-xs text-muted-foreground font-mono">
                          {extras.client_ticket_number || <span className="italic opacity-50">—</span>}
                        </TableCell>
                        <TableCell className="font-medium max-w-[180px] truncate">{t.title}</TableCell>
                        <TableCell className="text-sm">{DISPATCH_TYPES.find(d => d.value === t.dispatch_type)?.label ?? t.dispatch_type}</TableCell>
                        <TableCell className="text-sm">
                          {extras.project_id ? (
                            <span className="inline-flex items-center gap-1">
                              <FolderOpen className="w-3.5 h-3.5 text-muted-foreground" />
                              {getProjectName(extras.project_id)}
                            </span>
                          ) : <span className="text-muted-foreground text-xs">—</span>}
                        </TableCell>
                        <TableCell className="text-sm">{getClientName(t.client_id)}</TableCell>
                        {!isEngineer && <TableCell className="text-sm">{getEngineerName(t.engineer_id)}</TableCell>}
                        <TableCell><span className={`text-xs font-medium ${pri.color}`}>{pri.label}</span></TableCell>
                        {!isEngineer && <TableCell className="font-medium">${Number(t.estimated_charges ?? 0).toFixed(2)}</TableCell>}
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Badge variant={st.variant}>{st.label}</Badge>
                            {pendingStatusIds.has(t.id) && (
                              <>
                                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                                  <Loader2 className="w-3 h-3 animate-spin" /> updating…
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); requestUndo(t.id); }}
                                  className="text-[10px] font-medium underline text-primary hover:opacity-80"
                                >Undo</button>
                              </>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setViewTicket(t); }} title="View">
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); openEdit(t); }} title="Edit">
                            <Edit className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <KanbanBoard
          tickets={filtered}
          isLoading={isLoading}
          sensors={sensors}
          getClientName={getClientName}
          getEngineerName={getEngineerName}
          onCardClick={(t) => setViewTicket(t)}
          onStatusChange={(id, status) => queueStatusUpdate(id, status)}
          pendingIds={pendingStatusIds}
          onUndo={requestUndo}
        />
      )}

      {/* ── Undo Confirmation ── */}
      <AlertDialog open={!!undoConfirmId} onOpenChange={(open) => { if (!open) setUndoConfirmId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Undo status change?</AlertDialogTitle>
            <AlertDialogDescription>
              {(() => {
                if (!undoConfirmId) return null;
                const original = originalStatusRef.current.get(undoConfirmId);
                const label = original ? (STATUS_MAP[original]?.label ?? original) : "the previous status";
                return <>This will revert the ticket back to <strong>{label}</strong>.</>;
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep change</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (undoConfirmId) undoStatusUpdate(undoConfirmId); setUndoConfirmId(null); }}>
              Undo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ══════════════════════════════════════════════════════════════════════
          CREATE DIALOG
      ══════════════════════════════════════════════════════════════════════ */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" /> New Dispatch Ticket — SOW
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4">

            {/* ── Ticket References ── */}
            <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-1.5 text-muted-foreground">
                <Hash className="w-4 h-4" /> Ticket References
              </h4>
              <div className="grid grid-cols-2 gap-3">
                {/* Auto-generated ticket number — read-only preview */}
                <div>
                  <Label className="text-xs">System Ticket # <span className="text-muted-foreground font-normal">(auto-generated)</span></Label>
                  <div className="mt-1 h-9 flex items-center px-3 rounded-md border bg-background text-sm font-mono text-muted-foreground select-none">
                    <span className="opacity-50 text-xs">Auto-assigned on save</span>
                  </div>
                </div>
                {/* Client's own ticket / reference number */}
                <div>
                  <Label className="text-xs">Client Ticket # <span className="text-muted-foreground font-normal">(manual)</span></Label>
                  <Input
                    className="mt-1"
                    value={form.client_ticket_number}
                    onChange={(e) => setForm({ ...form, client_ticket_number: e.target.value })}
                    placeholder="e.g. CHG-2024-0042"
                  />
                </div>
              </div>
            </div>

            {/* ── Basic Info ── */}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Title *</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Server rack installation — Building A"
                />
              </div>
              <div>
                <Label>Dispatch Type *</Label>
                <Select value={form.dispatch_type} onValueChange={(v) => setForm({ ...form, dispatch_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{DISPATCH_TYPES.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            {/* ── Project + Client + Schedule ── */}
            <div className="grid grid-cols-2 gap-3">
              {/* Project Selection */}
              <div className="col-span-2">
                <Label className="flex items-center gap-1.5">
                  <FolderOpen className="w-3.5 h-3.5" /> Project
                </Label>
                <div className="flex gap-2 mt-1">
                  <Select
                    value={form.project_id || "none"}
                    onValueChange={(v) => setForm({ ...form, project_id: v === "none" ? "" : v })}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select project…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No project</SelectItem>
                      {projects.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                          {p.description && <span className="text-muted-foreground ml-1 text-xs">— {p.description}</span>}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 gap-1.5"
                    onClick={() => setAddProjectOpen(true)}
                  >
                    <Plus className="w-3.5 h-3.5" /> New
                  </Button>
                </div>
              </div>

              <div>
                <Label>Client *</Label>
                <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>{clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" /> Client Partner
                </Label>
                <Select
                  value={form.client_partner_id || "none"}
                  onValueChange={(v) => setForm({ ...form, client_partner_id: v === "none" ? "" : v })}
                >
                  <SelectTrigger><SelectValue placeholder="Select client partner" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No partner</SelectItem>
                    {clients.filter((c: any) => c.id !== form.client_id).map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>Scheduled Date</Label>
                <Input type="datetime-local" value={form.scheduled_date} onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })} />
              </div>
            </div>

            <Separator />

            {/* ── Site Details ── */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-1.5"><MapPin className="w-4 h-4" /> Site Details</h4>
              <div>
                <Label>Site Address *</Label>
                <Input
                  value={form.site_address}
                  onChange={(e) => setForm({ ...form, site_address: e.target.value })}
                  placeholder="Full address of the dispatch site"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Contact Person</Label>
                  <Input value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} placeholder="On-site contact name" />
                </div>
                <div>
                  <Label>Contact Phone</Label>
                  <Input value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} placeholder="+1 555-0000" />
                </div>
              </div>
            </div>

            <Separator />

            {/* ── Tools / Equipment ── */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-1.5">
                <Wrench className="w-4 h-4" /> Tools &amp; Equipment
              </h4>
              {form.tools.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-1">
                  {form.tools.map((tool) => (
                    <Badge key={tool} variant="secondary" className="gap-1 pr-1">
                      {tool}
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, tools: f.tools.filter((t) => t !== tool) }))}
                        className="rounded-full hover:bg-muted-foreground/20 p-0.5"
                        aria-label={`Remove ${tool}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <div className="border rounded-lg p-3 bg-muted/20">
                <p className="text-xs text-muted-foreground mb-2">Select tools/equipment needed for this job:</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-44 overflow-y-auto pr-1">
                  {allTools.map((tool) => (
                    <label key={tool} className="flex items-center gap-2 text-xs cursor-pointer rounded px-2 py-1 hover:bg-muted select-none">
                      <Checkbox
                        checked={form.tools.includes(tool)}
                        onCheckedChange={() => toggleTool(tool)}
                        id={`tool-${tool}`}
                      />
                      {tool}
                    </label>
                  ))}
                </div>
                {/* Add custom tool */}
                <div className="flex gap-2 mt-3 pt-2 border-t">
                  <Input
                    className="h-8 text-xs"
                    placeholder="Add custom tool…"
                    value={newToolName}
                    onChange={(e) => setNewToolName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddCustomTool(); } }}
                  />
                  <Button type="button" size="sm" variant="outline" className="h-8 gap-1 shrink-0" onClick={handleAddCustomTool}>
                    <Plus className="w-3.5 h-3.5" /> Add
                  </Button>
                </div>
              </div>
            </div>

            <Separator />

            {/* ── SOW ── */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-1.5"><ClipboardList className="w-4 h-4" /> Statement of Work</h4>
              <Textarea
                value={form.sow_description}
                onChange={(e) => setForm({ ...form, sow_description: e.target.value })}
                placeholder={"Detailed scope of work description...\n\n• Task 1: Description\n• Task 2: Description\n• Deliverables and acceptance criteria"}
                rows={5}
              />
            </div>

            <Separator />

            {/* ── Time & Rate ── */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-1.5"><DollarSign className="w-4 h-4" /> Time, Rate &amp; Estimated Charges</h4>

              {/* ── Labor Rates — one or more rows, same pattern as Engineers "Rates" ── */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="mb-0">Labor Rates</Label>
                  <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={addLaborRateRow}>
                    <Plus className="w-3.5 h-3.5" /> Add Rate
                  </Button>
                </div>
                <div className="space-y-2">
                  {form.labor_rates.map((rate) => {
                    const rt = RATE_TYPES.find((r) => r.value === rate.rate_type) ?? RATE_TYPES[0];
                    const unitLabel = Number(rate.quantity) === 1 ? rt.unitLabelSingular : rt.unitLabel;
                    return (
                      <div key={rate.id} className="flex flex-wrap gap-2 items-center">
                        <Select value={rate.rate_type} onValueChange={(v) => updateLaborRateRow(rate.id, "rate_type", v)}>
                          <SelectTrigger className="w-[130px] shrink-0">
                            <SelectValue placeholder="Rate type" />
                          </SelectTrigger>
                          <SelectContent>
                            {RATE_TYPES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                          </SelectContent>
                        </Select>

                        <Input
                          type="number" min="0" step="0.5"
                          className="w-24"
                          placeholder={unitLabel}
                          value={rate.quantity}
                          onChange={(e) => updateLaborRateRow(rate.id, "quantity", Number(e.target.value))}
                        />
                        <span className="text-xs text-muted-foreground shrink-0 -ml-1">{unitLabel}</span>

                        <div className="relative flex-1 min-w-[110px]">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                          <Input
                            type="number" min="0" step="5"
                            className="pl-6"
                            placeholder="0.00"
                            value={rate.rate_amount}
                            onChange={(e) => updateLaborRateRow(rate.id, "rate_amount", Number(e.target.value))}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">= ${laborRowTotal(rate).toFixed(2)}</span>

                        <Button
                          type="button" variant="ghost" size="sm"
                          className="h-9 w-9 p-0 shrink-0 text-muted-foreground hover:text-destructive disabled:opacity-30"
                          onClick={() => removeLaborRateRow(rate.id)}
                          disabled={form.labor_rates.length === 1}
                          aria-label="Remove rate"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <Label>Travel Time (hrs)</Label>
                  <Input type="number" min="0" step="0.5" value={form.travel_time} onChange={(e) => setForm({ ...form, travel_time: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Travel Rate ($)</Label>
                  <Input type="number" min="0" step="5" value={form.travel_rate} onChange={(e) => setForm({ ...form, travel_rate: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Materials Cost ($)</Label>
                  <Input type="number" min="0" step="1" value={form.materials_cost} onChange={(e) => setForm({ ...form, materials_cost: Number(e.target.value) })} />
                </div>
              </div>

              {/* Charge Summary */}
              <div className="bg-muted/50 rounded-lg p-4 border">
                <div className="space-y-1.5 text-sm">
                  {form.labor_rates.map((r) => {
                    const rt = RATE_TYPES.find((x) => x.value === r.rate_type) ?? RATE_TYPES[0];
                    const unitLabel = Number(r.quantity) === 1 ? rt.unitLabelSingular : rt.unitLabel;
                    return (
                      <div key={r.id} className="flex justify-between">
                        <span className="text-muted-foreground">Labor ({rt.label})</span>
                        <span>{r.quantity} {unitLabel} × ${r.rate_amount} = ${laborRowTotal(r).toFixed(2)}</span>
                      </div>
                    );
                  })}
                  <div className="flex justify-between"><span className="text-muted-foreground">Travel</span><span>{form.travel_time}h × ${form.travel_rate} = ${(form.travel_time * form.travel_rate).toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Materials</span><span>${Number(form.materials_cost).toFixed(2)}</span></div>
                  <Separator className="my-1.5" />
                  <div className="flex justify-between font-semibold text-base">
                    <span>Estimated Total</span>
                    <span className="text-primary">${estimatedTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

          </div>

          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              variant="secondary"
              onClick={() => createMutation.mutate({ ...form, status: "draft" })}
              disabled={!form.title || !form.client_id || createMutation.isPending}
            >
              Save as Draft
            </Button>
            <Button
              onClick={() => createMutation.mutate({ ...form, status: "pending_approval" })}
              disabled={!form.title || !form.client_id || !form.sow_description || createMutation.isPending}
            >
              Submit for Approval
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Project Dialog ── */}
      <Dialog open={addProjectOpen} onOpenChange={setAddProjectOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-primary" /> New Project
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div>
              <Label>Project Name *</Label>
              <Input
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="e.g. NYC Office Rollout Q3"
                onKeyDown={(e) => { if (e.key === "Enter") handleAddProject(); }}
                autoFocus
              />
            </div>
            <div>
              <Label>Description <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
              <Input
                value={newProjectDesc}
                onChange={(e) => setNewProjectDesc(e.target.value)}
                placeholder="Short project description…"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setAddProjectOpen(false)}>Cancel</Button>
            <Button onClick={handleAddProject} disabled={!newProjectName.trim()}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Create Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════════════════════════════════
          VIEW / DETAIL DIALOG
      ══════════════════════════════════════════════════════════════════════ */}
      <Dialog open={!!viewTicket} onOpenChange={() => setViewTicket(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {viewTicket && (() => {
            const extras = getTicketExtras(viewTicket.id);
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-base">
                    <FileText className="w-5 h-5 text-primary" />
                    {viewTicket.ticket_number} — {viewTicket.title}
                  </DialogTitle>
                  {extras.client_ticket_number && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                      <Hash className="w-3 h-3" /> Client Ref: <span className="font-mono font-medium">{extras.client_ticket_number}</span>
                    </p>
                  )}
                </DialogHeader>

                <Tabs defaultValue="sow" className="mt-2">
                  <TabsList className="w-full">
                    <TabsTrigger value="sow" className="flex-1">SOW Details</TabsTrigger>
                    <TabsTrigger value="tools" className="flex-1">Tools</TabsTrigger>
                    <TabsTrigger value="charges" className="flex-1">Charges</TabsTrigger>
                    <TabsTrigger value="status" className="flex-1">Status</TabsTrigger>
                    <TabsTrigger value="history" className="flex-1">History</TabsTrigger>
                  </TabsList>

                  {/* SOW Details */}
                  <TabsContent value="sow" className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs mb-0.5">Dispatch Type</p>
                        <p className="font-medium">{DISPATCH_TYPES.find(d => d.value === viewTicket.dispatch_type)?.label}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs mb-0.5">Priority</p>
                        <p className={`font-medium ${PRIORITY_MAP[viewTicket.priority]?.color}`}>{PRIORITY_MAP[viewTicket.priority]?.label}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs mb-0.5">Client</p>
                        <p className="font-medium">{getClientName(viewTicket.client_id)}</p>
                      </div>
                      {extras.client_partner_id && (
                        <div>
                          <p className="text-muted-foreground text-xs mb-0.5">Client Partner</p>
                          <p className="font-medium">{getClientName(extras.client_partner_id)}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-muted-foreground text-xs mb-0.5">Engineer</p>
                        <p className="font-medium">{getEngineerName(viewTicket.engineer_id)}</p>
                      </div>
                      {extras.project_id && (
                        <div>
                          <p className="text-muted-foreground text-xs mb-0.5">Project</p>
                          <p className="font-medium flex items-center gap-1.5">
                            <FolderOpen className="w-3.5 h-3.5" />
                            {getProjectName(extras.project_id)}
                          </p>
                        </div>
                      )}
                      {extras.client_ticket_number && (
                        <div>
                          <p className="text-muted-foreground text-xs mb-0.5">Client Ticket #</p>
                          <p className="font-mono font-medium">{extras.client_ticket_number}</p>
                        </div>
                      )}
                    </div>

                    <div>
                      <p className="text-muted-foreground text-xs mb-1">Site Address</p>
                      <p className="text-sm flex items-start gap-1.5">
                        <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />{viewTicket.site_address || "—"}
                      </p>
                    </div>
                    {(viewTicket.contact_person || viewTicket.contact_phone) && (
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div><p className="text-muted-foreground text-xs mb-0.5">Contact</p><p className="flex items-center gap-1"><User className="w-3.5 h-3.5" />{viewTicket.contact_person || "—"}</p></div>
                        <div><p className="text-muted-foreground text-xs mb-0.5">Phone</p><p className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{viewTicket.contact_phone || "—"}</p></div>
                      </div>
                    )}
                    <div>
                      <p className="text-muted-foreground text-xs mb-1">Statement of Work</p>
                      <div className="bg-muted/40 rounded-lg p-3 text-sm whitespace-pre-wrap border">
                        {viewTicket.sow_description || "No SOW provided"}
                      </div>
                    </div>
                    {viewTicket.scheduled_date && (
                      <div>
                        <p className="text-muted-foreground text-xs mb-0.5">Scheduled</p>
                        <p className="text-sm">{format(new Date(viewTicket.scheduled_date), "PPp")}</p>
                      </div>
                    )}
                  </TabsContent>

                  {/* Tools Tab */}
                  <TabsContent value="tools" className="mt-4">
                    {extras.tools && extras.tools.length > 0 ? (
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">{extras.tools.length} tool{extras.tools.length !== 1 ? "s" : ""} assigned to this ticket</p>
                        <div className="flex flex-wrap gap-2">
                          {extras.tools.map((tool) => (
                            <Badge key={tool} variant="secondary" className="gap-1.5 py-1 px-2.5">
                              <Wrench className="w-3 h-3" /> {tool}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        <Wrench className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        No tools assigned to this ticket
                      </div>
                    )}
                  </TabsContent>

                  {/* Charges */}
                  <TabsContent value="charges" className="mt-4">
                    <div className="bg-muted/30 rounded-lg border p-4 space-y-3">
                      <h4 className="font-semibold text-sm">Cost Breakdown</h4>
                      <div className="space-y-2 text-sm">
                        {extras.labor_rates?.length ? (
                          extras.labor_rates.map((r) => {
                            const rt = RATE_TYPES.find((x) => x.value === r.rate_type) ?? RATE_TYPES[0];
                            const unitLabel = Number(r.quantity) === 1 ? rt.unitLabelSingular : rt.unitLabel;
                            return (
                              <div key={r.id} className="flex justify-between">
                                <span className="text-muted-foreground">Labor ({rt.label}: {r.quantity} {unitLabel} × ${Number(r.rate_amount).toFixed(2)})</span>
                                <span>${laborRowTotal(r).toFixed(2)}</span>
                              </div>
                            );
                          })
                        ) : (
                          // Legacy ticket created before multi-rate support — fall back to single columns
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Labor ({viewTicket.estimated_hours} × ${Number(viewTicket.hourly_rate).toFixed(2)})</span>
                            <span>${(viewTicket.estimated_hours * viewTicket.hourly_rate).toFixed(2)}</span>
                          </div>
                        )}
                        <div className="flex justify-between"><span className="text-muted-foreground">Travel ({viewTicket.travel_time ?? 0}h × ${Number(viewTicket.travel_rate ?? 0).toFixed(2)})</span><span>${((viewTicket.travel_time ?? 0) * (viewTicket.travel_rate ?? 0)).toFixed(2)}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Materials</span><span>${Number(viewTicket.materials_cost ?? 0).toFixed(2)}</span></div>
                        <Separator />
                        <div className="flex justify-between font-bold text-base">
                          <span>Estimated Total</span>
                          <span className="text-primary">
                            ${(
                              (extras.labor_rates?.length
                                ? extras.labor_rates.reduce((s, r) => s + laborRowTotal(r), 0)
                                : viewTicket.estimated_hours * viewTicket.hourly_rate)
                              + (viewTicket.travel_time ?? 0) * (viewTicket.travel_rate ?? 0)
                              + Number(viewTicket.materials_cost ?? 0)
                            ).toFixed(2)}
                          </span>
                        </div>
                      </div>
                      {(viewTicket.actual_hours > 0 || viewTicket.actual_charges > 0) && (
                        <>
                          <Separator />
                          <h4 className="font-semibold text-sm mt-3">Actuals</h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between"><span className="text-muted-foreground">Actual Hours</span><span>{viewTicket.actual_hours}h</span></div>
                            <div className="flex justify-between font-bold"><span>Actual Charges</span><span>${Number(viewTicket.actual_charges).toFixed(2)}</span></div>
                          </div>
                        </>
                      )}
                    </div>
                  </TabsContent>

                  {/* Status */}
                  <TabsContent value="status" className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs mb-1">Current Status</p>
                        <Badge variant={STATUS_MAP[viewTicket.status]?.variant}>{STATUS_MAP[viewTicket.status]?.label}</Badge>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs mb-1">Client Approval</p>
                        <Badge variant={viewTicket.client_approval_status === "approved" ? "default" : viewTicket.client_approval_status === "rejected" ? "destructive" : "outline"}>
                          {viewTicket.client_approval_status}
                        </Badge>
                      </div>
                    </div>
                    {APPROVED_OR_LATER.includes(viewTicket.status) && extras.approver_email && (
                      <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
                        <p className="text-muted-foreground text-xs mb-0.5">Approve By</p>
                        <p>{extras.approver_email}</p>
                      </div>
                    )}
                    {viewTicket.engineer_notes && (
                      <div>
                        <p className="text-muted-foreground text-xs mb-1">Engineer Notes</p>
                        <div className="bg-muted/40 rounded-lg p-3 text-sm border">{viewTicket.engineer_notes}</div>
                      </div>
                    )}
                    <Separator />
                    <p className="text-xs text-muted-foreground">Update Status:</p>
                    <div className="flex flex-wrap gap-2">
                      {["pending_approval", "approved", "dispatched", "in_progress", "completed", "cancelled"].map((s) => (
                        <Button
                          key={s} size="sm"
                          variant={viewTicket.status === s ? "default" : "outline"}
                          disabled={viewTicket.status === s}
                          onClick={() => {
                            queueStatusUpdate(viewTicket.id, s);
                            setViewTicket({ ...viewTicket, status: s });
                          }}
                        >
                          {STATUS_MAP[s]?.label}
                        </Button>
                      ))}
                    </div>
                    <div className="text-xs text-muted-foreground mt-2">
                      Created: {format(new Date(viewTicket.created_at), "PPp")}
                      {viewTicket.completed_date && <> · Completed: {format(new Date(viewTicket.completed_date), "PPp")}</>}
                    </div>
                  </TabsContent>

                  {/* History */}
                  <TabsContent value="history" className="mt-4">
                    <TicketHistoryPanel ticketId={viewTicket.id} />
                  </TabsContent>
                </Tabs>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════════════════════════════════
          EDIT DIALOG
      ══════════════════════════════════════════════════════════════════════ */}
      <Dialog open={!!editTicket} onOpenChange={(o) => !o && setEditTicket(null)}>
        <DialogContent className="max-w-lg">
          {editTicket && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base">
                  <Edit className="w-5 h-5 text-primary" />
                  Edit {editTicket.ticket_number}
                </DialogTitle>
              </DialogHeader>

              <div className="grid gap-4 mt-2">
                <div className={`grid gap-3 ${isEngineer ? "grid-cols-1" : "grid-cols-2"}`}>
                  <div>
                    <Label>Status</Label>
                    <Select
                        value={editForm.status}
                        onValueChange={(v) => {
                          if (!isEngineer && APPROVED_OR_LATER.includes(v) && v !== editForm.status) {
                            // Auto-capture the acting admin as approver — no picker needed.
                            setEditForm({
                              ...editForm,
                              status: v,
                              approver_email: myProfile?.email ?? user?.email ?? "",
                              approved_by: myProfile?.full_name ?? myProfile?.email ?? user?.email ?? "",
                            });
                          } else {
                            setEditForm({ ...editForm, status: v });
                          }
                        }}
                      >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(STATUS_MAP)
                          .filter(([k]) => !isEngineer || ["dispatched", "in_progress", "completed"].includes(k))
                          .map(([k, v]) => (<SelectItem key={k} value={k}>{v.label}</SelectItem>))}
                      </SelectContent>
                    </Select>
                    {isEngineer && (
                      <p className="text-[11px] text-muted-foreground mt-1">You can mark this ticket as in progress or completed.</p>
                    )}
                  </div>
                  {!isEngineer && (
                    <div>
                      <Label>Priority</Label>
                      <Select value={editForm.priority} onValueChange={(v) => setEditForm({ ...editForm, priority: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
                {!isEngineer && (
                  <div>
                    <Label>Assigned Engineer</Label>
                    <Popover open={editEngineerPickerOpen} onOpenChange={setEditEngineerPickerOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          disabled={engineersLoading || !!engineersError}
                          aria-invalid={!!engineersError}
                          className={`w-full justify-between font-normal ${engineersError ? "border-destructive" : ""}`}
                        >
                          {editForm.engineer_id
                            ? (engineers.find((e: any) => e.id === editForm.engineer_id)?.profiles?.full_name ?? engineers.find((e: any) => e.id === editForm.engineer_id)?.specialty ?? "Unknown")
                            : engineersLoading ? "Loading engineers…" : "Unassigned"}
                          <ChevronsUpDown className="w-4 h-4 text-muted-foreground shrink-0 ml-2" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search engineers…" className="h-9 text-sm" />
                          <CommandList>
                            <CommandEmpty className="py-3 text-xs text-center text-muted-foreground">No engineer found.</CommandEmpty>
                            <CommandGroup>
                              <CommandItem
                                value="unassigned"
                                onSelect={() => { setEditForm({ ...editForm, engineer_id: "" }); setEditEngineerPickerOpen(false); }}
                              >
                                <Check className={`mr-2 h-4 w-4 ${!editForm.engineer_id ? "opacity-100" : "opacity-0"}`} />
                                Unassigned
                              </CommandItem>
                              {engineers.map((e: any) => {
                                const p = e.profiles as any;
                                return (
                                  <CommandItem
                                    key={e.id}
                                    value={p?.full_name ?? e.specialty}
                                    onSelect={() => { setEditForm({ ...editForm, engineer_id: e.id }); setEditEngineerPickerOpen(false); }}
                                  >
                                    <Check className={`mr-2 h-4 w-4 ${editForm.engineer_id === e.id ? "opacity-100" : "opacity-0"}`} />
                                    {p?.full_name ?? e.specialty}
                                  </CommandItem>
                                );
                              })}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    {renderEngineerStatus()}
                  </div>
                )}
                {!isEngineer && APPROVED_OR_LATER.includes(editForm.status) && (
                  <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
                    <CheckCircle className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="text-muted-foreground">Approved by:</span>
                    <span className="font-medium">{editForm.approved_by || editForm.approver_email || "—"}</span>
                  </div>
                )}
                <div>
                  <Label>Engineer Notes</Label>
                  <Textarea
                    rows={4}
                    value={editForm.engineer_notes}
                    onChange={(e) => setEditForm({ ...editForm, engineer_notes: e.target.value })}
                    placeholder="Add notes, updates, or comments..."
                  />
                </div>
              </div>

              <DialogFooter className="mt-4 gap-2">
                <Button variant="outline" onClick={() => setEditTicket(null)}>Cancel</Button>
                <Button
                  onClick={() => {
                    const needsApproval = !isEngineer && APPROVED_OR_LATER.includes(editForm.status);
                    saveTicketExtras(editTicket.id, {
                      ...getTicketExtras(editTicket.id),
                      approved_by: needsApproval ? editForm.approver_email.trim() : getTicketExtras(editTicket.id).approved_by,
                      approver_email: needsApproval ? editForm.approver_email.trim() : getTicketExtras(editTicket.id).approver_email,
                    });
                    editMutation.mutate({
                      id: editTicket.id,
                      updates: isEngineer
                        ? { status: editForm.status, engineer_notes: editForm.engineer_notes || null }
                        : {
                            status: editForm.status,
                            priority: editForm.priority,
                            engineer_id: editForm.engineer_id || null,
                            engineer_notes: editForm.engineer_notes || null,
                          },
                    });
                  }}
                  disabled={editMutation.isPending}
                >
                  {editMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Kanban
// ─────────────────────────────────────────────────────────────────────────────

const KANBAN_COLUMNS: Array<{ key: string; label: string }> = [
  { key: "draft", label: "Draft" },
  { key: "pending_approval", label: "Pending Approval" },
  { key: "approved", label: "Approved" },
  { key: "dispatched", label: "Dispatched" },
  { key: "in_progress", label: "In Progress" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

const KanbanCard = ({ ticket, getClientName, getEngineerName, onClick, isPending, onUndo }: any) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: ticket.id,
    data: ticket,
    disabled: isPending,
  });
  const pri = PRIORITY_MAP[ticket.priority] ?? PRIORITY_MAP.medium;
  const extras = getTicketExtras(ticket.id);
  return (
    <div
      ref={setNodeRef}
      aria-busy={isPending || undefined}
      className={`relative p-3 rounded-lg border bg-card transition-all ${
        isDragging ? "opacity-40 scale-95" : "hover:shadow-md hover:border-primary/40"
      } ${isPending ? "opacity-60" : ""}`}
    >
      {isPending && (
        <div className="absolute top-1.5 right-1.5 flex items-center gap-1">
          <Badge variant="secondary" className="h-5 gap-1 px-1.5 text-[10px]">
            <Loader2 className="w-3 h-3 animate-spin" /> Updating…
          </Badge>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onUndo?.(ticket.id); }}
            className="h-5 px-1.5 rounded text-[10px] font-medium bg-background border hover:bg-accent hover:text-accent-foreground inline-flex items-center"
            aria-label="Undo status change"
          >
            Undo
          </button>
        </div>
      )}
      <div className="flex items-start gap-2">
        <button
          {...listeners} {...attributes}
          className="cursor-grab active:cursor-grabbing mt-0.5 touch-none disabled:cursor-not-allowed"
          aria-label="Drag" disabled={isPending}
        >
          <GripVertical className="w-4 h-4 text-muted-foreground" />
        </button>
        <div className="flex-1 min-w-0" onClick={() => onClick?.(ticket)} role="button">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="font-mono text-[10px] text-muted-foreground">{ticket.ticket_number}</span>
            <span className={`text-[10px] font-semibold ${pri.color}`}>{pri.label}</span>
          </div>
          {extras.client_ticket_number && (
            <p className="text-[10px] text-muted-foreground mb-1 font-mono">
              Client: {extras.client_ticket_number}
            </p>
          )}
          <p className="text-sm font-semibold text-foreground line-clamp-2 mb-1">{ticket.title}</p>
          <div className="flex items-center gap-1 text-xs text-muted-foreground truncate">
            <User className="w-3 h-3 shrink-0" />
            <span className="truncate">{getEngineerName(ticket.engineer_id)}</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground truncate mt-0.5">
            <MapPin className="w-3 h-3 shrink-0" />
            <span className="truncate">{getClientName(ticket.client_id)}</span>
          </div>
          {extras.tools && extras.tools.length > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
              <Wrench className="w-3 h-3 shrink-0" />
              <span className="truncate">{extras.tools.slice(0, 2).join(", ")}{extras.tools.length > 2 ? ` +${extras.tools.length - 2}` : ""}</span>
            </div>
          )}
          {ticket.estimated_charges != null && (
            <div className="text-xs font-medium mt-1">${Number(ticket.estimated_charges).toFixed(2)}</div>
          )}
        </div>
      </div>
    </div>
  );
};

const KanbanColumn = ({ col, tickets, getClientName, getEngineerName, onCardClick, pendingIds, onUndo }: any) => {
  const { setNodeRef, isOver } = useDroppable({ id: col.key, data: { status: col.key } });
  return (
    <div
      ref={setNodeRef}
      className={`min-w-[260px] w-[260px] flex-shrink-0 rounded-xl border-2 p-3 transition-all ${
        isOver ? "border-primary bg-primary/5" : "border-border bg-muted/30"
      }`}
    >
      <div className="flex items-center justify-between mb-3 pb-2 border-b">
        <p className="font-semibold text-sm">{col.label}</p>
        <Badge variant="outline" className="shrink-0">{tickets.length}</Badge>
      </div>
      <div className="space-y-2 min-h-[120px] max-h-[calc(100vh-380px)] overflow-y-auto pr-1">
        {tickets.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4 italic">Drop tickets here</p>
        )}
        {tickets.map((t: any) => (
          <KanbanCard
            key={t.id}
            ticket={t}
            getClientName={getClientName}
            getEngineerName={getEngineerName}
            onClick={onCardClick}
            isPending={pendingIds?.has(t.id)}
            onUndo={onUndo}
          />
        ))}
      </div>
    </div>
  );
};

const KanbanBoard = ({ tickets, isLoading, sensors, getClientName, getEngineerName, onCardClick, onStatusChange, pendingIds, onUndo }: any) => {
  const grouped = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const c of KANBAN_COLUMNS) map[c.key] = [];
    for (const t of tickets) {
      if (map[t.status]) map[t.status].push(t);
      else (map.draft ||= []).push(t);
    }
    return map;
  }, [tickets]);

  const handleDragEnd = (e: DragEndEvent) => {
    const ticket = e.active.data.current as any;
    const targetStatus = (e.over?.data.current as any)?.status;
    if (!ticket || !targetStatus || ticket.status === targetStatus) return;
    onStatusChange(ticket.id, targetStatus);
  };

  if (isLoading) {
    return <div className="text-center py-12 text-muted-foreground">Loading...</div>;
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {KANBAN_COLUMNS.map((c) => (
          <KanbanColumn
            key={c.key}
            col={c}
            tickets={grouped[c.key] || []}
            getClientName={getClientName}
            getEngineerName={getEngineerName}
            onCardClick={onCardClick}
            pendingIds={pendingIds}
            onUndo={onUndo}
          />
        ))}
      </div>
    </DndContext>
  );
};

export default DispatchTickets;
