import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/layout/AppLayout";
import { toast } from "sonner";
import { ArrowLeft, Send } from "lucide-react";

const serviceTypes = [
  "Networking",
  "IT Support",
  "Electrical",
  "Security Systems",
  "HVAC",
  "Plumbing",
  "General Maintenance",
  "Other",
];

const CreateServiceRequest = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    title: "",
    description: "",
    service_type: "",
    location: "",
    priority: "medium" as "low" | "medium" | "high" | "urgent",
    scheduled_at: "",
  });

  const { data: clientRecord } = useQuery({
    queryKey: ["client-record", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      if (!clientRecord?.id) throw new Error("Client record not found");
      if (!form.title.trim()) throw new Error("Title is required");
      if (!form.service_type) throw new Error("Service type is required");
      if (!form.location.trim()) throw new Error("Location is required");

      const { error } = await supabase.from("jobs").insert({
        title: form.title.trim().slice(0, 255),
        description: form.description.trim().slice(0, 2000),
        service_type: form.service_type,
        location: form.location.trim().slice(0, 500),
        priority: form.priority,
        scheduled_at: form.scheduled_at || null,
        client_id: clientRecord.id,
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-jobs"] });
      toast.success("Service request created successfully!");
      navigate("/client");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  return (
    <AppLayout title="New Service Request" subtitle="Describe the service you need">
      <div className="max-w-2xl">
        <button
          onClick={() => navigate("/client")}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-5 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>

        <form
          onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}
          className="bg-card rounded-xl border border-border shadow-card p-6 space-y-5"
        >
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Title *</label>
            <input
              name="title"
              value={form.title}
              onChange={handleChange}
              required
              maxLength={255}
              placeholder="e.g. Network setup for office"
              className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Service Type *</label>
            <select
              name="service_type"
              value={form.service_type}
              onChange={handleChange}
              required
              className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring/20"
            >
              <option value="">Select a service type</option>
              {serviceTypes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Description</label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              maxLength={2000}
              rows={4}
              placeholder="Describe what you need..."
              className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Location *</label>
              <input
                name="location"
                value={form.location}
                onChange={handleChange}
                required
                maxLength={500}
                placeholder="e.g. 123 Main St, NYC"
                className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Priority</label>
              <select
                name="priority"
                value={form.priority}
                onChange={handleChange}
                className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring/20"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Preferred Schedule</label>
            <input
              name="scheduled_at"
              type="datetime-local"
              value={form.scheduled_at}
              onChange={handleChange}
              className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring/20"
            />
          </div>

          <button
            type="submit"
            disabled={mutation.isPending}
            className="w-full gradient-primary text-primary-foreground py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            {mutation.isPending ? "Submitting..." : "Submit Request"}
          </button>
        </form>
      </div>
    </AppLayout>
  );
};

export default CreateServiceRequest;
