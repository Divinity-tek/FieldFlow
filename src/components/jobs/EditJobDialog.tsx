import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Constants } from "@/integrations/supabase/types";
import type { Database } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { Zap, Lock, ChevronsUpDown, Check } from "lucide-react";
import { z } from "zod";
import PayoutBreakdown from "@/components/payouts/PayoutBreakdown";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/hooks/useAuth";
import { getPayoutPermissions } from "@/lib/payoutPermissions";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";


type Job = Database["public"]["Tables"]["jobs"]["Row"];
type JobStatus = Database["public"]["Enums"]["job_status"];
type JobPriority = Database["public"]["Enums"]["job_priority"];

interface Props {
  job: Job | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function EditJobDialog({ job, open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { role } = useUserRole();
  const isOwner = !!(job && user && job.created_by === user.id);
  const perms = getPayoutPermissions(role, isOwner);
  const [form, setForm] = useState({
    title: "",
    service_type: "",
    location: "",
    description: "",
    status: "pending" as JobStatus,
    priority: "medium" as JobPriority,
    engineer_id: "",
    scheduled_at: "",
    total_price: "",
    geofence_radius: "200",
    notes: "",
    required_skills: "",
    is_delayed: false,
    delayed_reason: "",
    auto_reassign_enabled: true,
    reassign_grace_minutes: "15",
    transport_allowance: "",
    food_allowance: "",
    convenience_allowance: "",
    partner_split_percent: "",
    platform_split_percent: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [engineerPickerOpen, setEngineerPickerOpen] = useState(false);

  useEffect(() => {
    if (job) {
      const j = job as Job & {
        required_skills?: string[] | null;
        is_delayed?: boolean | null;
        delayed_reason?: string | null;
        auto_reassign_enabled?: boolean | null;
        reassign_grace_minutes?: number | null;
      };
      setForm({
        title: job.title ?? "",
        service_type: job.service_type ?? "",
        location: job.location ?? "",
        description: job.description ?? "",
        status: job.status,
        priority: job.priority,
        engineer_id: job.engineer_id ?? "",
        scheduled_at: job.scheduled_at ? new Date(job.scheduled_at).toISOString().slice(0, 16) : "",
        total_price: job.total_price ? String(job.total_price) : "",
        geofence_radius: String(job.geofence_radius ?? 200),
        notes: job.notes ?? "",
        required_skills: (j.required_skills ?? []).join(", "),
        is_delayed: !!j.is_delayed,
        delayed_reason: j.delayed_reason ?? "",
        auto_reassign_enabled: j.auto_reassign_enabled ?? true,
        reassign_grace_minutes: String(j.reassign_grace_minutes ?? 15),
        transport_allowance: (job as any).transport_allowance ? String((job as any).transport_allowance) : "",
        food_allowance: (job as any).food_allowance ? String((job as any).food_allowance) : "",
        convenience_allowance: (job as any).convenience_allowance ? String((job as any).convenience_allowance) : "",
        partner_split_percent: (job as any).partner_split_percent ? String((job as any).partner_split_percent) : "",
        platform_split_percent: (job as any).platform_split_percent ? String((job as any).platform_split_percent) : "",
      });
      setErrors({});
    }
  }, [job]);

  const { data: engineers = [] } = useQuery({
    queryKey: ["edit-job-engineers"],
    queryFn: async () => {
      const { data: engs } = await supabase.from("engineers").select("id, user_id");
      if (!engs?.length) return [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", engs.map(e => e.user_id));
      const pm = Object.fromEntries((profiles ?? []).map(p => [p.user_id, p.full_name]));
      return engs.map(e => ({ id: e.id, name: pm[e.user_id] ?? "Unknown" }));
    },
    enabled: open,
  });

  const payoutSchema = z.object({
    transport_allowance: z.string().refine(v => v === "" || (!Number.isNaN(Number(v)) && Number(v) >= 0 && Number(v) <= 100000), "Must be 0–100000"),
    food_allowance: z.string().refine(v => v === "" || (!Number.isNaN(Number(v)) && Number(v) >= 0 && Number(v) <= 100000), "Must be 0–100000"),
    convenience_allowance: z.string().refine(v => v === "" || (!Number.isNaN(Number(v)) && Number(v) >= 0 && Number(v) <= 100000), "Must be 0–100000"),
    partner_split_percent: z.string().refine(v => v === "" || (!Number.isNaN(Number(v)) && Number(v) >= 0 && Number(v) <= 100), "Must be 0–100"),
    platform_split_percent: z.string().refine(v => v === "" || (!Number.isNaN(Number(v)) && Number(v) >= 0 && Number(v) <= 100), "Must be 0–100"),
  }).refine(d => (Number(d.partner_split_percent || 0) + Number(d.platform_split_percent || 0)) <= 100, {
    message: "Partner + Platform split cannot exceed 100%",
    path: ["platform_split_percent"],
  });

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = "Title is required";
    if (!form.service_type.trim()) e.service_type = "Service type is required";
    if (!form.location.trim()) e.location = "Location is required";
    if (form.total_price && Number.isNaN(Number(form.total_price))) e.total_price = "Must be a number";
    const p = payoutSchema.safeParse(form);
    if (!p.success) {
      for (const issue of p.error.issues) {
        const k = issue.path[0] as string;
        if (k && !e[k]) e[k] = issue.message;
      }
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!job) return;
      const skills = form.required_skills
        .split(",")
        .map(s => s.trim())
        .filter(Boolean);
      const grace = Math.max(1, Math.min(720, Number(form.reassign_grace_minutes) || 15));
      const payload: Database["public"]["Tables"]["jobs"]["Update"] & {
        required_skills?: string[];
        is_delayed?: boolean;
        delayed_at?: string | null;
        delayed_reason?: string | null;
        auto_reassign_enabled?: boolean;
        reassign_grace_minutes?: number;
      } = {
        title: form.title.trim(),
        service_type: form.service_type.trim(),
        location: form.location.trim(),
        description: form.description.trim() || null,
        status: form.status,
        priority: form.priority,
        engineer_id: form.engineer_id || null,
        scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null,
        total_price: form.total_price ? Number(form.total_price) : null,
        geofence_radius: Math.max(50, Math.min(5000, Number(form.geofence_radius) || 200)),
        notes: form.notes.trim() || null,
        required_skills: skills,
        is_delayed: form.is_delayed,
        delayed_at: form.is_delayed ? new Date().toISOString() : null,
        delayed_reason: form.is_delayed ? (form.delayed_reason.trim() || null) : null,
        auto_reassign_enabled: form.auto_reassign_enabled,
        reassign_grace_minutes: grace,
        transport_allowance: form.transport_allowance ? Number(form.transport_allowance) : 0,
        food_allowance: form.food_allowance ? Number(form.food_allowance) : 0,
        convenience_allowance: form.convenience_allowance ? Number(form.convenience_allowance) : 0,
        partner_split_percent: form.partner_split_percent ? Number(form.partner_split_percent) : 0,
        platform_split_percent: form.platform_split_percent ? Number(form.platform_split_percent) : 0,
      };
      if (form.status === "completed" && !job.completed_at) payload.completed_at = new Date().toISOString();
      if (form.status === "in_progress" && !job.started_at) payload.started_at = new Date().toISOString();
      const { error } = await supabase.from("jobs").update(payload as never).eq("id", job.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["job-detail", job?.id] });
      queryClient.invalidateQueries({ queryKey: ["job-activity", job?.id] });
      toast.success("Job updated");
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message || "Failed to update job"),
  });

  const reassignMutation = useMutation({
    mutationFn: async () => {
      if (!job) return null;
      const { data, error } = await supabase.rpc("reassign_delayed_job", {
        _job_id: job.id,
        _kind: "manual",
        _reason: "Manual re-dispatch from job editor",
      });
      if (error) throw error;
      return data as { ok: boolean; error?: string; new_engineer_id?: string; score?: number };
    },
    onSuccess: (res) => {
      if (!res?.ok) {
        toast.error(res?.error || "No suitable engineer found");
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["admin-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["job-detail", job?.id] });
      queryClient.invalidateQueries({ queryKey: ["job-activity", job?.id] });
      toast.success(`Reassigned (score ${res.score ?? "—"})`);
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message || "Reassignment failed"),
  });

  const handleSave = () => { if (validate()) updateMutation.mutate(); };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Dispatch Ticket</DialogTitle>
          <DialogDescription>Update ticket details. Changes are tracked in the activity log.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Title</Label>
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} maxLength={200} />
            {errors.title && <p className="text-xs text-destructive mt-1">{errors.title}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Service Type</Label>
              <Input value={form.service_type} onChange={e => setForm(f => ({ ...f, service_type: e.target.value }))} />
              {errors.service_type && <p className="text-xs text-destructive mt-1">{errors.service_type}</p>}
            </div>
            <div>
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v as JobPriority }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Constants.public.Enums.job_priority.map(p => (
                    <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as JobStatus }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Constants.public.Enums.job_status.map(s => (
                    <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g, " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Engineer</Label>
              <Popover open={engineerPickerOpen} onOpenChange={setEngineerPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={engineerPickerOpen}
                    className="w-full justify-between font-normal"
                  >
                    {form.engineer_id
                      ? (engineers.find(e => e.id === form.engineer_id)?.name ?? "Unknown")
                      : "Unassigned"}
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
                          value="__unassigned__"
                          onSelect={() => {
                            setForm(f => ({ ...f, engineer_id: "" }));
                            setEngineerPickerOpen(false);
                          }}
                          className="text-sm"
                        >
                          <Check className={`mr-2 h-4 w-4 ${!form.engineer_id ? "opacity-100" : "opacity-0"}`} />
                          <span className="italic text-muted-foreground">Unassigned</span>
                        </CommandItem>
                        {engineers.map((e) => (
                          <CommandItem
                            key={e.id}
                            value={e.name}
                            onSelect={() => {
                              setForm(f => ({ ...f, engineer_id: e.id }));
                              setEngineerPickerOpen(false);
                            }}
                            className="text-sm"
                          >
                            <Check className={`mr-2 h-4 w-4 ${form.engineer_id === e.id ? "opacity-100" : "opacity-0"}`} />
                            {e.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <div>
            <Label>Location</Label>
            <Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} maxLength={500} />
            {errors.location && <p className="text-xs text-destructive mt-1">{errors.location}</p>}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Scheduled At</Label>
              <Input type="datetime-local" value={form.scheduled_at} onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))} />
            </div>
            <div>
              <Label>Total Price</Label>
              <Input type="number" value={form.total_price} onChange={e => setForm(f => ({ ...f, total_price: e.target.value }))} />
              {errors.total_price && <p className="text-xs text-destructive mt-1">{errors.total_price}</p>}
            </div>
            <div>
              <Label>Geofence (m)</Label>
              <Input type="number" min={50} max={5000} value={form.geofence_radius} onChange={e => setForm(f => ({ ...f, geofence_radius: e.target.value }))} />
            </div>
          </div>
          <div>
            <Label>Description</Label>
            <Textarea rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} maxLength={2000} />
          </div>
          <div className="rounded-md border border-border bg-muted/30 p-3 space-y-3">
            <div>
              <p className="text-sm font-medium">Payout breakdown</p>
              <p className="text-xs text-muted-foreground">
                Allowances paid on top of base price, and revenue splits taken off the gross.
              </p>
              {perms.readOnlyReason && (
                <p className="text-xs text-amber-600 dark:text-amber-500 mt-1.5 flex items-center gap-1">
                  <Lock className="h-3 w-3" /> {perms.readOnlyReason}
                </p>
              )}
              {!perms.canEditPlatformFee && !perms.readOnlyReason && (
                <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                  <Lock className="h-3 w-3" /> Platform fee is admin-only and cannot be changed from this screen.
                </p>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Transport ($)</Label>
                <Input
                  type="number" min={0} step="0.01"
                  value={form.transport_allowance}
                  onChange={e => setForm(f => ({ ...f, transport_allowance: e.target.value }))}
                  placeholder="0"
                  disabled={!perms.canEditAllowances}
                />
                {errors.transport_allowance && <p className="text-xs text-destructive mt-1">{errors.transport_allowance}</p>}
              </div>
              <div>
                <Label className="text-xs">Food ($)</Label>
                <Input
                  type="number" min={0} step="0.01"
                  value={form.food_allowance}
                  onChange={e => setForm(f => ({ ...f, food_allowance: e.target.value }))}
                  placeholder="0"
                  disabled={!perms.canEditAllowances}
                />
                {errors.food_allowance && <p className="text-xs text-destructive mt-1">{errors.food_allowance}</p>}
              </div>
              <div>
                <Label className="text-xs">Convenience ($)</Label>
                <Input
                  type="number" min={0} step="0.01"
                  value={form.convenience_allowance}
                  onChange={e => setForm(f => ({ ...f, convenience_allowance: e.target.value }))}
                  placeholder="0"
                  disabled={!perms.canEditAllowances}
                />
                {errors.convenience_allowance && <p className="text-xs text-destructive mt-1">{errors.convenience_allowance}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Partner split (%)</Label>
                <Input
                  type="number" min={0} max={100} step="0.01"
                  value={form.partner_split_percent}
                  onChange={e => setForm(f => ({ ...f, partner_split_percent: e.target.value }))}
                  placeholder="0"
                  disabled={!perms.canEditPartnerSplit}
                />
                {errors.partner_split_percent && <p className="text-xs text-destructive mt-1">{errors.partner_split_percent}</p>}
              </div>
              <div>
                <Label className="text-xs flex items-center gap-1">
                  Platform fee (%) {!perms.canEditPlatformFee && <Lock className="h-3 w-3 text-muted-foreground" />}
                </Label>
                <Input
                  type="number" min={0} max={100} step="0.01"
                  value={form.platform_split_percent}
                  onChange={e => setForm(f => ({ ...f, platform_split_percent: e.target.value }))}
                  placeholder="0"
                  disabled={!perms.canEditPlatformFee}
                />
                {errors.platform_split_percent && <p className="text-xs text-destructive mt-1">{errors.platform_split_percent}</p>}
              </div>
            </div>
            <div className="rounded border bg-background p-3">
              <PayoutBreakdown source={{
                base_pay: form.total_price ? Number(form.total_price) : 0,
                transport_allowance: Number(form.transport_allowance || 0),
                food_allowance: Number(form.food_allowance || 0),
                convenience_allowance: Number(form.convenience_allowance || 0),
                partner_split_percent: Number(form.partner_split_percent || 0),
                platform_split_percent: Number(form.platform_split_percent || 0),
              }} compact />
            </div>
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>

          <div className="rounded-md border border-border bg-muted/30 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Smart auto-reassignment</p>
                <p className="text-xs text-muted-foreground">
                  Automatically re-dispatch this job to the next best engineer when delayed.
                </p>
              </div>
              <Switch
                checked={form.auto_reassign_enabled}
                onCheckedChange={(v) => setForm(f => ({ ...f, auto_reassign_enabled: v }))}
                aria-label="Enable auto reassignment"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Required skills (comma-separated)</Label>
                <Input
                  value={form.required_skills}
                  onChange={(e) => setForm(f => ({ ...f, required_skills: e.target.value }))}
                  placeholder="e.g. fiber, rack-and-stack"
                />
              </div>
              <div>
                <Label className="text-xs">Grace minutes past schedule</Label>
                <Input
                  type="number"
                  min={1}
                  max={720}
                  value={form.reassign_grace_minutes}
                  onChange={(e) => setForm(f => ({ ...f, reassign_grace_minutes: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="job-is-delayed"
                checked={form.is_delayed}
                onCheckedChange={(v) => setForm(f => ({ ...f, is_delayed: v }))}
                aria-label="Mark job as delayed"
              />
              <Label htmlFor="job-is-delayed" className="text-sm font-medium">Mark as delayed</Label>
            </div>
            {form.is_delayed && (
              <div>
                <Label className="text-xs">Delay reason (optional)</Label>
                <Input
                  value={form.delayed_reason}
                  onChange={(e) => setForm(f => ({ ...f, delayed_reason: e.target.value }))}
                  placeholder="e.g. Engineer no-show"
                />
              </div>
            )}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => reassignMutation.mutate()}
              disabled={reassignMutation.isPending}
              className="gap-2"
            >
              <Zap className="h-4 w-4" />
              {reassignMutation.isPending ? "Re-dispatching..." : "Re-dispatch now"}
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
