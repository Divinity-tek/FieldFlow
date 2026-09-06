import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/layout/AppLayout";
import { Plus, Search, Building2, Mail, Phone, X } from "lucide-react";
import { toast } from "sonner";

type ClientForm = { company_name: string; contact_name: string; email: string; phone: string; address: string };
type ClientErrors = Partial<Record<keyof ClientForm, string>>;

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;
const PHONE_ALLOWED_RE = /^[+\d\s().-]+$/;

function validateClient(form: ClientForm): ClientErrors {
  const errs: ClientErrors = {};
  if (!form.company_name.trim()) errs.company_name = "Company name is required";
  if (!form.contact_name.trim()) errs.contact_name = "Contact name is required";
  // Email is mandatory when creating a client
  const email = form.email.trim().toLowerCase();
  if (!email) errs.email = "Email is required";
  else if (email.length > 254 || !EMAIL_RE.test(email)) errs.email = "Enter a valid email address";
  const phone = form.phone.trim();
  if (phone) {
    const digits = phone.replace(/\D/g, "");
    if (!PHONE_ALLOWED_RE.test(phone) || digits.length < 7 || digits.length > 20) {
      errs.phone = "Enter a valid phone number (7-20 digits)";
    }
  }
  return errs;
}

const PartnerClients = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<ClientForm>({ company_name: "", contact_name: "", email: "", phone: "", address: "" });
  const [errors, setErrors] = useState<ClientErrors>({});
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (submitted) setErrors(validateClient(form));
  }, [form, submitted]);

  const { data: partner } = useQuery({
    queryKey: ["partner-record", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("partners").select("id").eq("user_id", user!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["partner-clients-full", partner?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("partner_id", partner!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!partner?.id,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const errs = validateClient(form);
      if (Object.keys(errs).length > 0) {
        setErrors(errs);
        throw new Error("Please fix the highlighted fields");
      }
      const { error } = await supabase.from("clients").insert({
        partner_id: partner!.id,
        company_name: form.company_name.trim().slice(0, 255),
        contact_name: form.contact_name.trim().slice(0, 255),
        email: form.email.trim().toLowerCase().slice(0, 255),
        phone: form.phone.trim().slice(0, 50) || null,
        address: form.address.trim().slice(0, 500) || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partner-clients-full"] });
      queryClient.invalidateQueries({ queryKey: ["partner-clients"] });
      toast.success("Client added!");
      setShowAdd(false);
      setForm({ company_name: "", contact_name: "", email: "", phone: "", address: "" });
      setErrors({});
      setSubmitted(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const filtered = clients.filter((c) =>
    c.company_name.toLowerCase().includes(search.toLowerCase()) ||
    c.contact_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout title="Client Management" subtitle="Add and manage your clients">
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search clients..." className="pl-9 pr-4 py-2 rounded-lg border border-input bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 w-72" />
          </div>
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg gradient-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity">
            <Plus className="w-4 h-4" /> Add Client
          </button>
        </div>

        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-8 text-center text-sm text-muted-foreground">
            {clients.length === 0 ? "No clients yet. Add your first client to get started." : "No results found."}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((c) => (
              <div key={c.id} className="bg-card rounded-xl border border-border p-5 shadow-card hover:shadow-elevated transition-shadow">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-card-foreground">{c.company_name}</p>
                    <p className="text-xs text-muted-foreground">{c.contact_name}</p>
                  </div>
                </div>
                <div className="space-y-1.5 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2"><Mail className="w-3.5 h-3.5" />{c.email}</div>
                  {c.phone && <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5" />{c.phone}</div>}
                  {c.address && <p className="truncate">{c.address}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card rounded-xl border border-border shadow-elevated w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-card-foreground">Add Client</h3>
              <button onClick={() => setShowAdd(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setSubmitted(true);
                const errs = validateClient(form);
                setErrors(errs);
                if (Object.keys(errs).length > 0) {
                  toast.error("Please fix the highlighted fields");
                  return;
                }
                addMutation.mutate();
              }}
              className="space-y-4"
              noValidate
            >
              <div>
                <label className={`block text-sm font-medium mb-1 ${errors.company_name ? "text-destructive" : "text-foreground"}`}>Company Name *</label>
                <input
                  value={form.company_name}
                  onChange={(e) => setForm(f => ({ ...f, company_name: e.target.value }))}
                  maxLength={255}
                  aria-invalid={!!errors.company_name}
                  className={`w-full px-3 py-2 rounded-lg border bg-background text-foreground text-sm focus:outline-none focus:ring-2 ${errors.company_name ? "border-destructive focus:ring-destructive/20" : "border-input focus:ring-ring/20"}`}
                />
                {errors.company_name && <p className="text-xs text-destructive mt-1">{errors.company_name}</p>}
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${errors.contact_name ? "text-destructive" : "text-foreground"}`}>Contact Name *</label>
                <input
                  value={form.contact_name}
                  onChange={(e) => setForm(f => ({ ...f, contact_name: e.target.value }))}
                  maxLength={255}
                  aria-invalid={!!errors.contact_name}
                  className={`w-full px-3 py-2 rounded-lg border bg-background text-foreground text-sm focus:outline-none focus:ring-2 ${errors.contact_name ? "border-destructive focus:ring-destructive/20" : "border-input focus:ring-ring/20"}`}
                />
                {errors.contact_name && <p className="text-xs text-destructive mt-1">{errors.contact_name}</p>}
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${errors.email ? "text-destructive" : "text-foreground"}`}>Email *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                  maxLength={255}
                  aria-invalid={!!errors.email}
                  className={`w-full px-3 py-2 rounded-lg border bg-background text-foreground text-sm focus:outline-none focus:ring-2 ${errors.email ? "border-destructive focus:ring-destructive/20" : "border-input focus:ring-ring/20"}`}
                />
                {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-sm font-medium mb-1 ${errors.phone ? "text-destructive" : "text-foreground"}`}>Phone</label>
                  <input
                    type="tel"
                    inputMode="tel"
                    value={form.phone}
                    onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))}
                    maxLength={40}
                    aria-invalid={!!errors.phone}
                    className={`w-full px-3 py-2 rounded-lg border bg-background text-foreground text-sm focus:outline-none focus:ring-2 ${errors.phone ? "border-destructive focus:ring-destructive/20" : "border-input focus:ring-ring/20"}`}
                  />
                  {errors.phone && <p className="text-xs text-destructive mt-1">{errors.phone}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Address</label>
                  <input value={form.address} onChange={(e) => setForm(f => ({ ...f, address: e.target.value }))} maxLength={500} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring/20" />
                </div>
              </div>
              <button type="submit" disabled={addMutation.isPending} className="w-full gradient-primary text-primary-foreground py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50">
                {addMutation.isPending ? "Adding..." : "Add Client"}
              </button>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
};

export default PartnerClients;
