import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, MapPin, CheckCircle2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const services = [
  "IT Support", "Network Setup", "Hardware Repair", "Cabling", "Security Camera Install",
  "POS System", "Printer Service", "Server Maintenance", "WiFi Survey", "Other"
];

const slots = [
  { id: "today_am", label: "Today AM (9-12)", urgent: true },
  { id: "today_pm", label: "Today PM (1-5)", urgent: true },
  { id: "tomorrow_am", label: "Tomorrow AM" },
  { id: "tomorrow_pm", label: "Tomorrow PM" },
  { id: "this_week", label: "This Week (flexible)" },
];

export default function SelfBooking() {
  const [step, setStep] = useState<"form" | "success">("form");
  const [submitting, setSubmitting] = useState(false);
  const [bookingRef, setBookingRef] = useState("");
  const [form, setForm] = useState({
    name: "", company: "", email: "", phone: "",
    service: "", description: "", address: "",
    slot: "tomorrow_am", priority: "medium",
  });

  const submit = async () => {
    if (!form.name || !form.email || !form.service || !form.address) {
      toast.error("Please fill in name, email, service and address");
      return;
    }
    setSubmitting(true);
    try {
      // Insert as a public dispatch ticket (anyone can request a booking).
      // We create or reuse a placeholder client by email.
      const { data: existingClient } = await supabase
        .from("clients")
        .select("id")
        .eq("email", form.email)
        .maybeSingle();

      let clientId = existingClient?.id;
      if (!clientId) {
        const { data: newClient, error: cErr } = await supabase
          .from("clients")
          .insert({
            company_name: form.company || form.name,
            contact_name: form.name,
            email: form.email,
            phone: form.phone,
            address: form.address,
          })
          .select("id")
          .single();
        if (cErr) throw cErr;
        clientId = newClient.id;
      }

      const ref = `BK-${Date.now().toString(36).toUpperCase()}`;
      const { error: jErr } = await supabase.from("jobs").insert({
        client_id: clientId,
        title: `${form.service} — ${form.name}`,
        description: `${form.description}\n\nPreferred slot: ${form.slot}\nBooking ref: ${ref}`,
        service_type: form.service,
        location: form.address,
        priority: form.priority as any,
        status: "pending",
      });
      if (jErr) throw jErr;

      setBookingRef(ref);
      setStep("success");
      toast.success("Booking request received!");
    } catch (e: any) {
      toast.error("Booking failed: " + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (step === "success") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4">
        <Card className="max-w-lg w-full">
          <CardContent className="pt-8 pb-6 text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            </div>
            <h2 className="text-2xl font-bold">Booking Confirmed!</h2>
            <p className="text-muted-foreground">
              Your service request has been received. A coordinator will contact you within 30 minutes.
            </p>
            <div className="p-4 rounded-lg bg-muted/50">
              <div className="text-xs text-muted-foreground">Booking Reference</div>
              <div className="text-xl font-mono font-bold">{bookingRef}</div>
            </div>
            <Button onClick={() => { setStep("form"); setForm({ ...form, name: "", description: "" }); }}>
              Book Another Service
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <Badge variant="secondary" className="gap-1">
            <Sparkles className="w-3 h-3" /> Instant Booking
          </Badge>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            Book a Field Service
          </h1>
          <p className="text-muted-foreground">
            Get a certified engineer on-site — often the same day.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-primary" /> Request Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Full name *</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <Label>Company</Label>
                <Input value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} />
              </div>
              <div>
                <Label>Email *</Label>
                <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>

            <div>
              <Label>Service needed *</Label>
              <Select value={form.service} onValueChange={v => setForm({ ...form, service: v })}>
                <SelectTrigger><SelectValue placeholder="Choose service" /></SelectTrigger>
                <SelectContent>
                  {services.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="flex items-center gap-1"><MapPin className="w-3 h-3" /> Site address *</Label>
              <Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Street, city, postcode" />
            </div>

            <div>
              <Label>Describe the issue</Label>
              <Textarea
                rows={3}
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="What needs to be done? Any specific equipment, models, or constraints?"
              />
            </div>

            <div>
              <Label>Preferred time slot</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                {slots.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setForm({ ...form, slot: s.id, priority: s.urgent ? "high" : "medium" })}
                    className={`p-2 text-sm rounded-md border transition-colors ${
                      form.slot === s.id ? "border-primary bg-primary/10 font-medium" : "hover:bg-muted/50"
                    }`}
                  >
                    {s.label}
                    {s.urgent && <Badge variant="destructive" className="ml-1 text-[10px] py-0">Urgent</Badge>}
                  </button>
                ))}
              </div>
            </div>

            <Button className="w-full" size="lg" onClick={submit} disabled={submitting}>
              {submitting ? "Submitting…" : "Confirm Booking"}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              No account required. We'll email you confirmation and tracking link.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
