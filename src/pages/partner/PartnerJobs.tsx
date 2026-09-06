import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/layout/AppLayout";
import { Plus, Search, Send } from "lucide-react";
import { toast } from "sonner";

const serviceTypes = ["Networking", "IT Support", "Electrical", "Security Systems", "HVAC", "Plumbing", "General Maintenance", "Other"];

const PartnerJobs = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);

  const { data: partner } = useQuery({
    queryKey: ["partner-record", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("partners").select("id").eq("user_id", user!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["partner-clients-select", partner?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, company_name").eq("partner_id", partner!.id);
      if (error) throw error;
      return data;
    },
    enabled: !!partner?.id,
  });

  const clientIds = clients.map((c) => c.id);

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["partner-all-jobs", clientIds],
    queryFn: async () => {
      if (clientIds.length === 0) return [];
      const { data, error } = await supabase.from("jobs").select("*").in("client_id", clientIds).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: clientIds.length > 0,
  });

  const [form, setForm] = useState({ title: "", description: "", service_type: "", location: "", priority: "medium" as const, client_id: "", scheduled_at: "" });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!form.title.trim() || !form.service_type || !form.location.trim() || !form.client_id) throw new Error("Title, service type, location, and client are required");
      const { error } = await supabase.from("jobs").insert({
        title: form.title.trim().slice(0, 255),
        description: form.description.trim().slice(0, 2000) || null,
        service_type: form.service_type,
        location: form.location.trim().slice(0, 500),
        priority: form.priority,
        client_id: form.client_id,
        scheduled_at: form.scheduled_at || null,
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partner-all-jobs"] });
      toast.success("Service request created!");
      setShowCreate(false);
      setForm({ title: "", description: "", service_type: "", location: "", priority: "medium", client_id: "", scheduled_at: "" });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const clientMap = new Map(clients.map((c) => [c.id, c.company_name]));

  const filtered = jobs.filter((j) => {
    const matchSearch = j.title.toLowerCase().includes(search.toLowerCase()) || j.location.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || j.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <AppLayout title="Service Requests" subtitle="Create and track jobs for your clients">
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
          <div className="flex gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search jobs..." className="pl-9 pr-4 py-2 rounded-lg border border-input bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 w-60" />
            </div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-input bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20">
              <option value="all">All Statuses</option>
              {["pending","assigned","accepted","on_the_way","in_progress","completed","cancelled"].map(s => <option key={s} value={s}>{s.replace(/_/g," ")}</option>)}
            </select>
          </div>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg gradient-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity">
            <Plus className="w-4 h-4" /> New Request
          </button>
        </div>

        <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Job</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Client</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Service</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Priority</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">Loading...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">No jobs found.</td></tr>
                ) : filtered.map((job) => (
                  <tr key={job.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <p className="font-medium text-card-foreground">{job.title}</p>
                      <p className="text-xs text-muted-foreground">{job.location}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{clientMap.get(job.client_id) ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{job.service_type}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${
                        job.status === "completed" ? "bg-success/10 text-success" :
                        job.status === "cancelled" ? "bg-destructive/10 text-destructive" :
                        "bg-warning/10 text-warning"
                      }`}>{job.status.replace(/_/g, " ")}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${
                        job.priority === "urgent" ? "bg-destructive/10 text-destructive" :
                        job.priority === "high" ? "bg-warning/10 text-warning" :
                        "bg-muted text-muted-foreground"
                      }`}>{job.priority}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-card-foreground">
                      {job.total_price ? `$${Number(job.total_price).toFixed(2)}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card rounded-xl border border-border shadow-elevated w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-card-foreground">New Service Request</h3>
              <button onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Client *</label>
                <select value={form.client_id} onChange={(e) => setForm(f => ({ ...f, client_id: e.target.value }))} required className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring/20">
                  <option value="">Select client</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Title *</label>
                <input value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))} required maxLength={255} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring/20" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Service Type *</label>
                <select value={form.service_type} onChange={(e) => setForm(f => ({ ...f, service_type: e.target.value }))} required className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring/20">
                  <option value="">Select type</option>
                  {serviceTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Description</label>
                <textarea value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} maxLength={2000} rows={3} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring/20 resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Location *</label>
                  <input value={form.location} onChange={(e) => setForm(f => ({ ...f, location: e.target.value }))} required maxLength={500} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring/20" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Priority</label>
                  <select value={form.priority} onChange={(e) => setForm(f => ({ ...f, priority: e.target.value as any }))} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring/20">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Preferred Schedule</label>
                <input type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm(f => ({ ...f, scheduled_at: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring/20" />
              </div>
              <button type="submit" disabled={createMutation.isPending} className="w-full gradient-primary text-primary-foreground py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
                <Send className="w-4 h-4" /> {createMutation.isPending ? "Submitting..." : "Submit Request"}
              </button>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
};

export default PartnerJobs;
