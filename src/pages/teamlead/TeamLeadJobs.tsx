import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Search, ArrowRightLeft } from "lucide-react";
import JobStatusBadge from "@/components/dashboard/JobStatusBadge";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type JobStatus = Database["public"]["Enums"]["job_status"];

const priorityStyles: Record<string, string> = {
  low: "text-muted-foreground",
  medium: "text-primary",
  high: "text-amber-500",
  urgent: "text-destructive",
};

const TeamLeadJobs = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [reassignJobId, setReassignJobId] = useState<string | null>(null);
  const [selectedEngineerId, setSelectedEngineerId] = useState("");

  const { data: jobs = [] } = useQuery({
    queryKey: ["tl-all-jobs"],
    queryFn: async () => {
      const { data } = await supabase.from("jobs").select("*");
      return data ?? [];
    },
  });

  const { data: engineers = [] } = useQuery({
    queryKey: ["tl-all-engineers"],
    queryFn: async () => {
      const { data } = await supabase.from("engineers").select("*");
      return data ?? [];
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["tl-all-clients"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, company_name");
      return data ?? [];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["tl-all-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, full_name");
      return data ?? [];
    },
  });

  const clientMap = new Map(clients.map((c) => [c.id, c.company_name]));
  const profileMap = new Map(profiles.map((p) => [p.user_id, p.full_name]));
  const engineerNameMap = new Map(engineers.map((e) => [e.id, profileMap.get(e.user_id) ?? e.specialty]));

  const reassignMutation = useMutation({
    mutationFn: async ({ jobId, engineerId }: { jobId: string; engineerId: string }) => {
      const { error } = await supabase
        .from("jobs")
        .update({ engineer_id: engineerId, status: "assigned" as JobStatus })
        .eq("id", jobId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Job reassigned successfully");
      queryClient.invalidateQueries({ queryKey: ["tl-all-jobs"] });
      setReassignJobId(null);
      setSelectedEngineerId("");
    },
    onError: () => toast.error("Failed to reassign job"),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ jobId, status }: { jobId: string; status: JobStatus }) => {
      const completedAt = (status === "completed" || status === "cancelled") ? new Date().toISOString() : undefined;
      const { error } = await supabase.from("jobs").update({
        status,
        ...(completedAt ? { completed_at: completedAt } : {}),
      }).eq("id", jobId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status updated");
      queryClient.invalidateQueries({ queryKey: ["tl-all-jobs"] });
    },
    onError: () => toast.error("Failed to update status"),
  });

  const filtered = jobs.filter((j) => {
    const matchesSearch = j.title.toLowerCase().includes(search.toLowerCase()) ||
      j.service_type.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || j.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <AppLayout title="Job Management" subtitle="Assign, reassign, and manage all jobs">
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search jobs..."
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-input bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="assigned">Assigned</SelectItem>
              <SelectItem value="accepted">Accepted</SelectItem>
              <SelectItem value="on_the_way">On the Way</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Job</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Client</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Engineer</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Status</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Priority</th>
                    <th className="text-center px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((job) => (
                    <tr key={job.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="px-5 py-3">
                        <p className="font-medium text-foreground">{job.title}</p>
                        <p className="text-xs text-muted-foreground">{job.service_type} · {job.location}</p>
                      </td>
                      <td className="px-5 py-3 text-foreground">{clientMap.get(job.client_id) ?? "—"}</td>
                      <td className="px-5 py-3 text-foreground">
                        {job.engineer_id ? engineerNameMap.get(job.engineer_id) ?? "—" : <span className="text-muted-foreground italic">Unassigned</span>}
                      </td>
                      <td className="px-5 py-3">
                        <Select
                          value={job.status}
                          onValueChange={(val) => updateStatusMutation.mutate({ jobId: job.id, status: val as JobStatus })}
                        >
                          <SelectTrigger className="w-32 h-8 text-xs">
                            <JobStatusBadge status={job.status} />
                          </SelectTrigger>
                          <SelectContent>
                            {["pending", "assigned", "accepted", "on_the_way", "in_progress", "completed", "cancelled"].map((s) => (
                              <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`text-xs font-semibold uppercase ${priorityStyles[job.priority]}`}>{job.priority}</span>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <Dialog open={reassignJobId === job.id} onOpenChange={(open) => { if (!open) setReassignJobId(null); }}>
                          <DialogTrigger asChild>
                            <button
                              onClick={() => setReassignJobId(job.id)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5" /> Reassign
                            </button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Reassign Job</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 pt-2">
                              <p className="text-sm text-muted-foreground">Select an engineer for <span className="font-medium text-foreground">{job.title}</span></p>
                              <Select value={selectedEngineerId} onValueChange={setSelectedEngineerId}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Choose engineer" />
                                </SelectTrigger>
                                <SelectContent>
                                  {engineers.filter((e) => e.is_available).map((e) => (
                                    <SelectItem key={e.id} value={e.id}>
                                      {engineerNameMap.get(e.id)} — {e.specialty}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <button
                                disabled={!selectedEngineerId || reassignMutation.isPending}
                                onClick={() => reassignMutation.mutate({ jobId: job.id, engineerId: selectedEngineerId })}
                                className="w-full py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-50"
                              >
                                {reassignMutation.isPending ? "Reassigning..." : "Confirm Reassignment"}
                              </button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default TeamLeadJobs;
