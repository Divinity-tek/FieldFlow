import { useState, useMemo, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import AskAIButton from "@/components/ai/AskAIButton";
import EditJobDialog from "@/components/jobs/EditJobDialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, Search, Trash2, UserCheck, RefreshCw, X, Check, Pencil, ChevronLeft, ChevronRight, Eye, Copy, Download } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import JobStatusBadge from "@/components/dashboard/JobStatusBadge";
import RegionFilter from "@/components/filters/RegionFilter";
import { useRegionFilter } from "@/hooks/useRegionFilter";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Constants } from "@/integrations/supabase/types";
import type { Database } from "@/integrations/supabase/types";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ChevronsUpDown } from "lucide-react";
// import { CURRENCIES, useCurrency } from "@/contexts/CurrencyContext";
import { CURRENCIES, useCurrency, type CurrencyCode } from "@/contexts/CurrencyContext";

type JobStatus = Database["public"]["Enums"]["job_status"];
type JobPriority = Database["public"]["Enums"]["job_priority"];


// const [newJob, setNewJob] = useState({
//   title: "", service_type: "", client_id: "", location: "",
//   priority: "medium" as JobPriority, description: "", geofence_radius: "200",
//   currency: currency.code,
// });

const priorityStyles: Record<string, string> = {
  low: "text-muted-foreground",
  medium: "text-info",
  high: "text-warning",
  urgent: "text-destructive",
};

type EditingCell = { jobId: string; field: string } | null;



const Jobs = () => {
  const navigate = useNavigate();
  const { currency } = useCurrency();
  const [search, setSearch] = useState("");
  const { regions, selectedRegion, setSelectedRegion } = useRegionFilter();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<JobStatus | "">("");
  const [reassignEngineerId, setReassignEngineerId] = useState("");
  const [showReassignDialog, setShowReassignDialog] = useState(false);
  const [reassignPickerOpen, setReassignPickerOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editing, setEditing] = useState<EditingCell>(null);
  const [editValue, setEditValue] = useState("");
  const [editJob, setEditJob] = useState<any>(null);
  const [page, setPage] = useState(0);
  const [showNewJob, setShowNewJob] = useState(false);
  const [newJob, setNewJob] = useState({ title: "", service_type: "", client_id: "", location: "", priority: "medium" as JobPriority, description: "", geofence_radius: "200", currency: currency.code });
  const [newJobErrors, setNewJobErrors] = useState<Record<string, string>>({});
  const [openEngineerPickerId, setOpenEngineerPickerId] = useState<string | null>(null);
  const pageSize = 20;
  const queryClient = useQueryClient();

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["admin-jobs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("jobs")
        .select("*")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["admin-jobs-clients"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, company_name");
      return data ?? [];
    },
  });

  const { data: engineers = [] } = useQuery({
    queryKey: ["admin-jobs-engineers"],
    queryFn: async () => {
      const { data: engs } = await supabase
        .from("engineers")
        .select("id, user_id, employee_id, full_name");

      if (!engs?.length) return [];

      const uids = engs
        .map(e => e.user_id)
        .filter(Boolean);

      const { data: profiles } = uids.length
        ? await supabase
            .from("profiles")
            .select("user_id, full_name")
            .in("user_id", uids)
        : { data: [] };

      const pm = Object.fromEntries(
        (profiles ?? []).map(p => [p.user_id, p.full_name])
      );

      return engs.map(e => ({
        id: e.id,
        employee_id: e.employee_id,
        name: e.full_name ?? pm[e.user_id] ?? "Unknown",
      }));
    },
  });

  const clientMap = useMemo(() => new Map(clients.map(c => [c.id, c.company_name])), [clients]);
  

  const filtered = useMemo(() => {
    return jobs.filter(job => {
      const q = search.toLowerCase();
      const matchesSearch = !q ||
        job.title.toLowerCase().includes(q) ||
        job.service_type.toLowerCase().includes(q) ||
        job.location.toLowerCase().includes(q) ||
        (clientMap.get(job.client_id) ?? "").toLowerCase().includes(q) ||
        (engineerMap.get(job.engineer_id) ?? "").toLowerCase().includes(q) ||
        (engineers.find(e => e.id === job.engineer_id)?.employee_id ?? "")
          .toLowerCase()
          .includes(q);
      const matchesRegion = selectedRegion === "all" || job.region_id === selectedRegion;
      const matchesStatus = statusFilter === "all" || job.status === statusFilter;
      const matchesPriority = priorityFilter === "all" || job.priority === priorityFilter;
      return matchesSearch && matchesRegion && matchesStatus && matchesPriority;
    });
  }, [jobs, search, selectedRegion, statusFilter, priorityFilter, clientMap]);

  // Reset page when filters change
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  if (safePage !== page) setPage(safePage);
  const paginated = useMemo(() => filtered.slice(safePage * pageSize, (safePage + 1) * pageSize), [filtered, safePage]);

  // ── Selection logic ──
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    const pageIds = paginated.map(j => j.id);
    const allSelected = pageIds.every(id => selectedIds.has(id));
    if (allSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        pageIds.forEach(id => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds(prev => new Set([...prev, ...pageIds]));
    }
  };

  const clearSelection = () => setSelectedIds(new Set());

  // ── Inline edit mutation ──
  const inlineUpdateMutation = useMutation({
    mutationFn: async ({ jobId, field, value }: { jobId: string; field: string; value: any }) => {
      const payload: Partial<Database["public"]["Tables"]["jobs"]["Update"]> = {};
      (payload as any)[field] = value;
      if (field === "status" && value === "completed") payload.completed_at = new Date().toISOString();
      if (field === "status" && value === "in_progress") payload.started_at = new Date().toISOString();
      const { error } = await supabase.from("jobs").update(payload).eq("id", jobId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-jobs"] });
      toast.success("Job updated");
    },
    onError: () => toast.error("Failed to update job"),
  });

  const startEdit = useCallback((jobId: string, field: string, currentValue: string) => {
    setEditing({ jobId, field });
    setEditValue(currentValue);
  }, []);

  const commitEdit = useCallback(() => {
    if (!editing) return;
    const trimmed = editValue.trim();
    if (!trimmed && (editing.field === "title" || editing.field === "location" || editing.field === "service_type")) {
      toast.error("This field cannot be empty");
      return;
    }
    const value = editing.field === "total_price" ? (trimmed ? Number(trimmed) : null)
      : editing.field === "geofence_radius" ? (trimmed ? Math.max(50, Math.min(5000, Number(trimmed))) : 200)
      : trimmed;
    inlineUpdateMutation.mutate({ jobId: editing.jobId, field: editing.field, value });
    setEditing(null);
  }, [editing, editValue, inlineUpdateMutation]);

  const cancelEdit = useCallback(() => setEditing(null), []);

  const handleSelectChange = useCallback((jobId: string, field: string, value: string) => {
    inlineUpdateMutation.mutate({ jobId, field, value });
  }, [inlineUpdateMutation]);

  const isEditing = (jobId: string, field: string) => editing?.jobId === jobId && editing?.field === field;

  // ── Bulk mutations ──
  const bulkStatusMutation = useMutation({
    mutationFn: async (status: JobStatus) => {
      const ids = Array.from(selectedIds);
      const updates: { status: JobStatus; completed_at?: string; started_at?: string } = { status };
      if (status === "completed") updates.completed_at = new Date().toISOString();
      if (status === "in_progress") updates.started_at = new Date().toISOString();
      const { error } = await supabase.from("jobs").update(updates).in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-jobs"] });
      toast.success(`${selectedIds.size} job(s) status updated`);
      clearSelection();
      setBulkStatus("");
    },
    onError: () => toast.error("Failed to update statuses"),
  });

  const bulkReassignMutation = useMutation({
    mutationFn: async (engineerId: string) => {
      const ids = Array.from(selectedIds);
      const { error } = await supabase.from("jobs").update({ engineer_id: engineerId, status: "assigned" as JobStatus }).in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-jobs"] });
      toast.success(`${selectedIds.size} job(s) reassigned`);
      clearSelection();
      setShowReassignDialog(false);
      setReassignEngineerId("");
    },
    onError: () => toast.error("Failed to reassign jobs"),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async () => {
      const ids = Array.from(selectedIds);
      const { error } = await supabase.from("jobs").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-jobs"] });
      toast.success(`${selectedIds.size} job(s) deleted`);
      clearSelection();
      setShowDeleteConfirm(false);
    },
    onError: () => toast.error("Failed to delete jobs"),
  });

  // ── Create job ──
  const validateNewJob = () => {
    const errors: Record<string, string> = {};
    if (!newJob.title.trim()) errors.title = "Title is required";
    else if (newJob.title.trim().length > 200) errors.title = "Title must be under 200 characters";
    if (!newJob.service_type.trim()) errors.service_type = "Service type is required";
    if (!newJob.client_id) errors.client_id = "Client is required";
    if (!newJob.location.trim()) errors.location = "Location is required";
    else if (newJob.location.trim().length > 500) errors.location = "Location must be under 500 characters";
    if (newJob.description.length > 2000) errors.description = "Description must be under 2000 characters";
    setNewJobErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const createJobMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("jobs").insert({
        title: newJob.title.trim(),
        service_type: newJob.service_type.trim(),
        client_id: newJob.client_id,
        location: newJob.location.trim(),
        priority: newJob.priority,
        description: newJob.description.trim() || null,
        geofence_radius: parseInt(newJob.geofence_radius) || 200,
        currency: newJob.currency,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-jobs"] });
      toast.success("Job created");
      setShowNewJob(false);
      setNewJob({ title: "", service_type: "", client_id: "", location: "", priority: "medium", description: "", geofence_radius: "200", currency: currency.code });
      setNewJobErrors({});
    },
    onError: () => toast.error("Failed to create job"),
  });

  const handleCreateJob = () => {
    if (validateNewJob()) createJobMutation.mutate();
  };

  // ── Clone mutation ──
  const cloneMutation = useMutation({
    mutationFn: async (job: any) => {
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-jobs"] });
      toast.success("Job duplicated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const exportCSV = () => {
    const ids = selectedIds.size > 0 ? Array.from(selectedIds) : filtered.map(j => j.id);
    const rows = jobs.filter(j => ids.includes(j.id));
    if (rows.length === 0) { toast.error("Nothing to export"); return; }
    const headers = ["id","title","service_type","client","engineer","location","status","priority","total_price","scheduled_at","created_at"];
    const csv = [headers.join(",")].concat(rows.map(j => [
      j.id, j.title, j.service_type,
      clientMap.get(j.client_id) ?? "",
      j.engineer_id ? (engineerMap.get(j.engineer_id) ?? "") : "",
      j.location, j.status, j.priority, j.total_price ?? "",
      j.scheduled_at ?? "", j.created_at,
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `jobs-${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} job(s)`);
  };

  const hasSelection = selectedIds.size > 0;
  const renderTextCell = (job: any, field: string, displayValue: string) => {
    if (isEditing(job.id, field)) {
      return (
        <div className="flex items-center gap-1">
          <Input
            autoFocus
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") cancelEdit(); }}
            className="h-7 text-xs w-full min-w-[80px]"
          />
          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={commitEdit}>
            <Check className="w-3 h-3 text-emerald-500" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={cancelEdit}>
            <X className="w-3 h-3 text-muted-foreground" />
          </Button>
        </div>
      );
    }
    return (
      <div
        className="group/cell flex items-center gap-1 cursor-pointer rounded px-1 -mx-1 hover:bg-muted/50 transition-colors"
        onClick={() => startEdit(job.id, field, displayValue)}
      >
        <span className="text-sm text-card-foreground truncate">{displayValue || "—"}</span>
        <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover/cell:opacity-100 transition-opacity shrink-0" />
      </div>
    );
  };

  const renderSelectCell = (job: any, field: string, currentValue: string, options: readonly string[], renderOption?: (v: string) => React.ReactNode) => {
    const UNASSIGNED = "__unassigned__";
    const safeValue = currentValue || UNASSIGNED;
    const safeOptions = options.map(o => o || UNASSIGNED);
    return (
      <Select value={safeValue} onValueChange={(val) => handleSelectChange(job.id, field, val === UNASSIGNED ? "" : val)}>
        <SelectTrigger className="h-7 text-xs border-transparent hover:border-input transition-colors w-auto min-w-[100px] bg-transparent">
          <SelectValue>
            {renderOption ? renderOption(currentValue) : <span className="capitalize">{currentValue.replace(/_/g, " ")}</span>}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {safeOptions.map(o => (
            <SelectItem key={o} value={o} className="text-xs capitalize">
              {renderOption ? renderOption(o === UNASSIGNED ? "" : o) : o.replace(/_/g, " ")}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  };

  // const engineerLabel = (engineer: {
  //   employee_id?: string | null;
  //   name: string;
  // }) =>
  //   engineer.employee_id
  //     ? `${engineer.employee_id} — ${engineer.name}`
  //     : engineer.name;

  const engineerMap = useMemo(
    () => new Map(engineers.map(e => [e.id, e.name])),
    [engineers]
  );

  const engineerLabel = (e: { employee_id?: string | null; name: string }) =>
  e.employee_id ? `${e.employee_id} — ${e.name}` : e.name;

  const renderEngineerSelectCell = (job: any) => {
    const currentId = job.engineer_id ?? "";
    const currentEngineer = currentId
      ? engineers.find(e => e.id === currentId)
      : null;

    const currentName = currentEngineer
      ? engineerLabel(currentEngineer)
      : null;
    const isOpen = openEngineerPickerId === job.id;
    

    return (
      <Popover open={isOpen} onOpenChange={(open) => setOpenEngineerPickerId(open ? job.id : null)}>
        <PopoverTrigger asChild>
          <button
            className="flex items-center gap-1.5 h-7 px-2 rounded text-xs border border-transparent hover:border-input hover:bg-muted/50 transition-colors min-w-[120px] justify-between"
          >
            {currentName ?? <span className="text-muted-foreground italic">Unassigned</span>}
            <ChevronsUpDown className="w-3 h-3 text-muted-foreground shrink-0 ml-1" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-0" align="start">
          <Command>
            <CommandInput placeholder="Search engineers…" className="h-9 text-xs" />
            <CommandList>
              <CommandEmpty className="py-3 text-xs text-center text-muted-foreground">No engineer found.</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  value="__unassigned__"
                  onSelect={() => {
                    handleSelectChange(job.id, "engineer_id", "");
                    setOpenEngineerPickerId(null);
                  }}
                  className="text-xs"
                >
                  <Check className={`mr-2 h-3.5 w-3.5 ${!currentId ? "opacity-100" : "opacity-0"}`} />
                  <span className="italic text-muted-foreground">Unassigned</span>
                </CommandItem>
                {engineers.map((e) => (
                  <CommandItem
                    key={e.id}
                    value={engineerLabel(e)}
                    onSelect={() => {
                      handleSelectChange(job.id, "engineer_id", e.id);
                      setOpenEngineerPickerId(null);
                    }}
                    className="text-xs"
                  >
                    <Check
                      className={`mr-2 h-3.5 w-3.5 ${
                        currentId === e.id ? "opacity-100" : "opacity-0"
                      }`}
                    />
                    {engineerLabel(e)}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  };

  const renderPriceCell = (job: any) => {
    const field = "total_price";
    const val = job.total_price ? String(Number(job.total_price)) : "";
    const currencyMeta = CURRENCIES.find((c) => c.code === (job.currency ?? "USD"));
    if (isEditing(job.id, field)) {
      return (
        <div className="flex items-center gap-1 justify-end">
          <span className="text-xs text-muted-foreground">$</span>
          <Input
            autoFocus
            type="number"
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") cancelEdit(); }}
            className="h-7 text-xs w-24 text-right"
          />
          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={commitEdit}>
            <Check className="w-3 h-3 text-emerald-500" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={cancelEdit}>
            <X className="w-3 h-3 text-muted-foreground" />
          </Button>
        </div>
      );
    }
    return (
      <div
        className="group/cell flex items-center gap-1 justify-end cursor-pointer rounded px-1 -mx-1 hover:bg-muted/50 transition-colors"
        onClick={() => startEdit(job.id, field, val)}
      >
        <span className="text-sm font-semibold text-card-foreground">
          {job.total_price ? `${currencyMeta?.symbol ?? job.currency ?? "$"}${Number(job.total_price).toLocaleString()}` : "—"}
        </span>
        <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover/cell:opacity-100 transition-opacity shrink-0" />
      </div>
    );
  };

  const renderGeofenceCell = (job: any) => {
    const field = "geofence_radius";
    const val = String(job.geofence_radius ?? 200);
    if (isEditing(job.id, field)) {
      return (
        <div className="flex items-center gap-1">
          <Input
            autoFocus
            type="number"
            min={50}
            max={5000}
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") cancelEdit(); }}
            className="h-7 text-xs w-20 text-right"
          />
          <span className="text-xs text-muted-foreground">m</span>
          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={commitEdit}>
            <Check className="w-3 h-3 text-emerald-500" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={cancelEdit}>
            <X className="w-3 h-3 text-muted-foreground" />
          </Button>
        </div>
      );
    }
    return (
      <div
        className="group/cell flex items-center gap-1 cursor-pointer rounded px-1 -mx-1 hover:bg-muted/50 transition-colors"
        onClick={() => startEdit(job.id, field, val)}
      >
        <span className="text-sm text-card-foreground">{val}m</span>
        <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover/cell:opacity-100 transition-opacity shrink-0" />
      </div>
    );
  };

  return (
    <AppLayout title="Dispatch Tickets" subtitle="Manage and track all service jobs">
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by title, client, engineer, employee ID, or location…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 rounded-lg border border-input bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 w-full sm:w-72"
              />
            </div>
            <RegionFilter regions={regions} value={selectedRegion} onChange={setSelectedRegion} />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 w-36 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {Constants.public.Enums.job_status.map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g," ")}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="h-9 w-32 text-xs"><SelectValue placeholder="Priority" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All priorities</SelectItem>
                {Constants.public.Enums.job_priority.map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="h-9 text-xs" onClick={exportCSV}>
              <Download className="w-3 h-3 mr-1" />Export CSV
            </Button>
            <AskAIButton prompt="Analyze my current jobs: identify bottlenecks, overdue jobs, unassigned high-priority jobs, and suggest optimizations." label="AI Analysis" />
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={() => setShowNewJob(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg gradient-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity w-full sm:w-auto justify-center">
                <Plus className="w-4 h-4" /> New Job
              </button>
            </TooltipTrigger>
            <TooltipContent><p className="text-xs">Create a new service job with client and location details</p></TooltipContent>
          </Tooltip>
        </div>

        {/* Bulk Actions Toolbar */}
        {hasSelection && (
          <div className="flex flex-wrap items-center gap-3 p-3 bg-primary/10 border border-primary/20 rounded-lg animate-in fade-in slide-in-from-top-2">
            <span className="text-sm font-medium text-foreground">{selectedIds.size} selected</span>
            <div className="h-5 w-px bg-border" />

            <Select value={bulkStatus} onValueChange={(val) => { setBulkStatus(val as JobStatus); bulkStatusMutation.mutate(val as JobStatus); }}>
              <SelectTrigger className="w-44 h-8 text-xs">
                <RefreshCw className="w-3 h-3 mr-1" />
                <SelectValue placeholder="Update Status" />
              </SelectTrigger>
              <SelectContent>
                {Constants.public.Enums.job_status.map(s => (
                  <SelectItem key={s} value={s} className="text-xs capitalize">{s.replace(/_/g, " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setShowReassignDialog(true)}>
                  <UserCheck className="w-3 h-3 mr-1" /> Reassign
                </Button>
              </TooltipTrigger>
              <TooltipContent><p className="text-xs">Reassign selected jobs to a different engineer</p></TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="destructive" size="sm" className="h-8 text-xs" onClick={() => setShowDeleteConfirm(true)}>
                  <Trash2 className="w-3 h-3 mr-1" /> Delete
                </Button>
              </TooltipTrigger>
              <TooltipContent><p className="text-xs">Permanently delete selected jobs</p></TooltipContent>
            </Tooltip>

            <Button variant="ghost" size="sm" className="h-8 text-xs ml-auto" onClick={clearSelection}>
              <X className="w-3 h-3 mr-1" /> Clear
            </Button>
          </div>
        )}

        <div className="bg-card rounded-xl shadow-card border border-border overflow-hidden overflow-x-auto">
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Loading jobs...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No jobs found.</p>
          ) : (
            <table className="w-full min-w-[850px]">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-3 py-3 w-10">
                    <Checkbox
                      checked={paginated.length > 0 && paginated.every(j => selectedIds.has(j.id))}
                      onCheckedChange={toggleAll}
                    />
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Job</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Service</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Client</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Engineer</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Location</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Priority</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Geofence</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Price</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map(job => (
                  <tr key={job.id} className={`border-b border-border last:border-0 hover:bg-muted/50 transition-colors ${selectedIds.has(job.id) ? "bg-primary/5" : ""}`}>
                    <td className="px-3 py-3.5" onClick={e => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(job.id)}
                        onCheckedChange={() => toggleSelect(job.id)}
                      />
                    </td>
                    <td className="px-5 py-3.5">
                      {renderTextCell(job, "title", job.title)}
                      <p className="text-xs text-muted-foreground mt-0.5">{job.id.slice(0, 8)}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      {renderTextCell(job, "service_type", job.service_type)}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-card-foreground">{clientMap.get(job.client_id) ?? "—"}</td>
                    <td className="px-5 py-3.5">
                      {renderEngineerSelectCell(job)}
                    </td>
                    <td className="px-5 py-3.5">
                      {renderTextCell(job, "location", job.location)}
                    </td>
                    <td className="px-5 py-3.5">
                      {renderSelectCell(
                        job,
                        "status",
                        job.status,
                        Constants.public.Enums.job_status,
                        (v) => <JobStatusBadge status={v as JobStatus} />
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {renderSelectCell(
                        job,
                        "priority",
                        job.priority,
                        Constants.public.Enums.job_priority,
                        (v) => <span className={`text-xs font-semibold uppercase ${priorityStyles[v]}`}>{v}</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {renderGeofenceCell(job)}
                    </td>
                    <td className="px-5 py-3.5">
                      {renderPriceCell(job)}
                    </td>
                    <td className="px-5 py-3.5" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1 justify-end">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(`/jobs/${job.id}`)}>
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent><p className="text-xs">View details</p></TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditJob(job)}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent><p className="text-xs">Edit job</p></TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => cloneMutation.mutate(job)} disabled={cloneMutation.isPending}>
                              <Copy className="w-3.5 h-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent><p className="text-xs">Duplicate</p></TooltipContent>
                        </Tooltip>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {filtered.length > pageSize && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Showing {safePage * pageSize + 1}–{Math.min((safePage + 1) * pageSize, filtered.length)} of {filtered.length} jobs
            </p>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              {Array.from({ length: totalPages }, (_, i) => i)
                .filter(i => i === 0 || i === totalPages - 1 || Math.abs(i - safePage) <= 1)
                .reduce<(number | "ellipsis")[]>((acc, i, idx, arr) => {
                  if (idx > 0 && i - (arr[idx - 1] as number) > 1) acc.push("ellipsis");
                  acc.push(i);
                  return acc;
                }, [])
                .map((item, idx) =>
                  item === "ellipsis" ? (
                    <span key={`e${idx}`} className="px-1 text-xs text-muted-foreground">…</span>
                  ) : (
                    <Button
                      key={item}
                      variant={item === safePage ? "default" : "outline"}
                      size="icon"
                      className="h-8 w-8 text-xs"
                      onClick={() => setPage(item)}
                    >
                      {item + 1}
                    </Button>
                  )
                )}
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={safePage >= totalPages - 1} onClick={() => setPage(safePage + 1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* New Job Dialog */}
      <Dialog open={showNewJob} onOpenChange={(o) => { if (!o) { setShowNewJob(false); setNewJobErrors({}); } }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Dispatch Ticket</DialogTitle>
            <DialogDescription>Fill in the required fields to create a new dispatch ticket.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm">Title <span className="text-destructive">*</span></Label>
              <Input value={newJob.title} onChange={e => setNewJob(f => ({ ...f, title: e.target.value }))} placeholder="e.g. HVAC Repair" className="mt-1" maxLength={200} />
              {newJobErrors.title && <p className="text-xs text-destructive mt-1">{newJobErrors.title}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">Service Type <span className="text-destructive">*</span></Label>
                <Input value={newJob.service_type} onChange={e => setNewJob(f => ({ ...f, service_type: e.target.value }))} placeholder="e.g. Maintenance" className="mt-1" />
                {newJobErrors.service_type && <p className="text-xs text-destructive mt-1">{newJobErrors.service_type}</p>}
              </div>
              <div>
                <Label className="text-sm">Priority</Label>
                <Select value={newJob.priority} onValueChange={(v) => setNewJob(f => ({ ...f, priority: v as JobPriority }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Constants.public.Enums.job_priority.map(p => (
                      <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm">Currency</Label>
                <Select value={newJob.currency} onValueChange={(v) => setNewJob(f => ({ ...f, currency: v as CurrencyCode }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>{c.symbol} {c.code}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-sm">Client <span className="text-destructive">*</span></Label>
              <Select value={newJob.client_id} onValueChange={(v) => setNewJob(f => ({ ...f, client_id: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select client..." /></SelectTrigger>
                <SelectContent>
                  {clients.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {newJobErrors.client_id && <p className="text-xs text-destructive mt-1">{newJobErrors.client_id}</p>}
            </div>
            <div>
              <Label className="text-sm">Location <span className="text-destructive">*</span></Label>
              <Input value={newJob.location} onChange={e => setNewJob(f => ({ ...f, location: e.target.value }))} placeholder="e.g. 123 Main St, London" className="mt-1" maxLength={500} />
              {newJobErrors.location && <p className="text-xs text-destructive mt-1">{newJobErrors.location}</p>}
            </div>
            <div>
              <Label className="text-sm">Description</Label>
              <Textarea value={newJob.description} onChange={e => setNewJob(f => ({ ...f, description: e.target.value }))} placeholder="Optional job details..." className="mt-1" rows={3} maxLength={2000} />
              {newJobErrors.description && <p className="text-xs text-destructive mt-1">{newJobErrors.description}</p>}
            </div>
            <div>
              <Label className="text-sm">Geofence Radius (meters)</Label>
              <Input type="number" min={50} max={5000} value={newJob.geofence_radius} onChange={e => setNewJob(f => ({ ...f, geofence_radius: e.target.value }))} placeholder="200" className="mt-1" />
              <p className="text-xs text-muted-foreground mt-1">Alert radius when engineers arrive/leave (default 200m)</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowNewJob(false); setNewJobErrors({}); }}>Cancel</Button>
            <Button onClick={handleCreateJob} disabled={createJobMutation.isPending}>
              {createJobMutation.isPending ? "Creating..." : "Create Job"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reassign Dialog */}
      <Dialog open={showReassignDialog} onOpenChange={(o) => { setShowReassignDialog(o); if (!o) setReassignPickerOpen(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reassign {selectedIds.size} Job(s)</DialogTitle>
            <DialogDescription>Select an engineer to reassign the selected jobs to.</DialogDescription>
          </DialogHeader>
          <Popover open={reassignPickerOpen} onOpenChange={setReassignPickerOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={reassignPickerOpen}
                className="w-full justify-between font-normal"
              >
                {reassignEngineerId
                  ? (() => {
                      const engineer = engineers.find(e => e.id === reassignEngineerId);
                      return engineer ? engineerLabel(engineer) : "Unknown";
                    })()
                  : "Select engineer..."}
                <ChevronsUpDown className="w-4 h-4 text-muted-foreground shrink-0 ml-2" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
              <Command>
                <CommandInput placeholder="Search engineers…" className="h-9 text-sm" />
                <CommandList>
                  <CommandEmpty className="py-3 text-xs text-center text-muted-foreground">No engineer found.</CommandEmpty>
                  <CommandGroup>
                    {engineers.map((e) => (
                      <CommandItem
                        key={e.id}
                        value={engineerLabel(e)}
                        onSelect={() => {
                          setReassignEngineerId(e.id);
                          setReassignPickerOpen(false);
                        }}
                        className="text-sm"
                      >
                        <Check
                          className={`mr-2 h-4 w-4 ${
                            reassignEngineerId === e.id ? "opacity-100" : "opacity-0"
                          }`}
                        />
                        {engineerLabel(e)}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReassignDialog(false)}>Cancel</Button>
            <Button disabled={!reassignEngineerId || bulkReassignMutation.isPending} onClick={() => bulkReassignMutation.mutate(reassignEngineerId)}>
              {bulkReassignMutation.isPending ? "Reassigning..." : "Reassign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.size} job(s)?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. The selected jobs will be permanently removed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => bulkDeleteMutation.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {bulkDeleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <EditJobDialog job={editJob} open={!!editJob} onOpenChange={(o) => { if (!o) setEditJob(null); }} />
    </AppLayout>
  );
};

export default Jobs;
