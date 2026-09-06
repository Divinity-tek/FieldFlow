import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, RefreshCw, Calendar, Clock, Pause, Play } from "lucide-react";
import { toast } from "sonner";

const frequencies = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Bi-weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
];

const RecurringJobs = () => {
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({
    title: "", service_type: "", location: "", frequency: "monthly", description: "", client_id: "",
  });

  const { data: templates, refetch } = useQuery({
    queryKey: ["recurring-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recurring_job_templates")
        .select("*, clients(company_name), engineers(user_id, specialty)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: clients } = useQuery({
    queryKey: ["clients-list"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, company_name");
      return data || [];
    },
  });

  const createTemplate = async () => {
    if (!form.title || !form.service_type || !form.location || !form.client_id) {
      toast.error("Please fill in all required fields");
      return;
    }
    const { error } = await supabase.from("recurring_job_templates").insert({
      ...form,
      created_by: (await supabase.auth.getUser()).data.user?.id,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Recurring job template created");
    setShowNew(false);
    setForm({ title: "", service_type: "", location: "", frequency: "monthly", description: "", client_id: "" });
    refetch();
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    const { error } = await supabase.from("recurring_job_templates").update({ is_active: !isActive }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(isActive ? "Template paused" : "Template activated");
    refetch();
  };

  return (
    <AppLayout title="Recurring Jobs" subtitle="Automate repeating service schedules">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Job Templates</h2>
            <Badge variant="secondary">{templates?.length || 0}</Badge>
          </div>
          <Dialog open={showNew} onOpenChange={setShowNew}>
            <DialogTrigger asChild>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" className="gap-2"><Plus className="w-4 h-4" /> Create Recurring Job</Button>
                </TooltipTrigger>
                <TooltipContent>Set up auto-generated jobs on a schedule</TooltipContent>
              </Tooltip>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Recurring Job Template</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Title *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Monthly HVAC Maintenance" /></div>
                <div><Label>Client *</Label>
                  <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                    <SelectContent>{clients?.map((c) => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Service Type *</Label><Input value={form.service_type} onChange={(e) => setForm({ ...form, service_type: e.target.value })} placeholder="Maintenance" /></div>
                  <div><Label>Frequency</Label>
                    <Select value={form.frequency} onValueChange={(v) => setForm({ ...form, frequency: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{frequencies.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div><Label>Location *</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="123 Main St" /></div>
                <div><Label>Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional notes" /></div>
                <Button onClick={createTemplate} className="w-full">Create Template</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates?.map((t: any) => (
            <Card key={t.id} className={`${!t.is_active ? "opacity-60" : ""}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-sm">{t.title}</CardTitle>
                  <Badge variant={t.is_active ? "default" : "secondary"}>
                    {t.is_active ? "Active" : "Paused"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {t.frequency}</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {t.next_run_at ? new Date(t.next_run_at).toLocaleDateString() : "—"}</span>
                </div>
                <p className="text-xs text-muted-foreground">{t.clients?.company_name} · {t.service_type}</p>
                <p className="text-xs text-muted-foreground">{t.location}</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => toggleActive(t.id, t.is_active)}
                >
                  {t.is_active ? <><Pause className="w-3 h-3" /> Pause</> : <><Play className="w-3 h-3" /> Activate</>}
                </Button>
              </CardContent>
            </Card>
          ))}
          {(!templates || templates.length === 0) && (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              <RefreshCw className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No recurring job templates yet</p>
              <p className="text-xs">Create one to auto-generate jobs on a schedule</p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default RecurringJobs;
