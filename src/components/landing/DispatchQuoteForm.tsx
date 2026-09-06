import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

type FormState = "idle" | "submitting" | "success" | "error";

export function DispatchQuoteForm() {
  const [state, setState] = useState<FormState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [leadId, setLeadId] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("submitting");
    setError(null);

    const fd = new FormData(e.currentTarget);
    const payload = Object.fromEntries(fd.entries());

    try {
      const { data, error } = await supabase.functions.invoke("submit-dispatch-lead", {
        body: payload,
      });
      if (error) throw error;
      if (!data?.ok) throw new Error("Request failed");
      setLeadId(data.lead_id ?? null);
      setState("success");
      (e.target as HTMLFormElement).reset();
    } catch (err: any) {
      console.error("Dispatch submit error:", err);
      setError(err?.message || "Something went wrong. Please try again or call our hotline.");
      setState("error");
    }
  }

  if (state === "success") {
    return (
      <motion.div
        initial="hidden"
        animate="visible"
        variants={fadeUp}
        className="rounded-2xl border border-primary/40 bg-primary/[0.06] backdrop-blur-md p-10 text-center"
      >
        <div className="mx-auto w-14 h-14 rounded-full bg-primary/15 flex items-center justify-center mb-4">
          <CheckCircle2 className="w-7 h-7 text-primary" />
        </div>
        <h3 className="font-display text-2xl text-foreground tracking-tight mb-2">Request received</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          A dispatch coordinator has been notified and will confirm availability and pricing — typically in
          under one hour during business hours.
        </p>
        {leadId && (
          <p className="text-[11px] text-muted-foreground mt-4">Reference: {leadId.slice(0, 8).toUpperCase()}</p>
        )}
        <button
          onClick={() => setState("idle")}
          className="mt-6 text-xs text-primary hover:underline"
        >
          Submit another request
        </button>
      </motion.div>
    );
  }

  const inputCls =
    "w-full px-3.5 py-2.5 rounded-lg bg-background/60 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none transition";
  const selectCls =
    "w-full px-3.5 py-2.5 rounded-lg bg-background/60 border border-border text-sm text-foreground focus:border-primary/60 focus:outline-none transition";

  return (
    <motion.form
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
      variants={fadeUp}
      onSubmit={handleSubmit}
      id="dispatch-quote-form"
      className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-md p-7 grid grid-cols-1 sm:grid-cols-2 gap-4"
    >
      {/* Honeypot — hidden from real users, catches bots. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        className="hidden"
        aria-hidden="true"
      />

      {/* Contact */}
      <div className="sm:col-span-2 -mb-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Your details</p>
      </div>
      <div>
        <label className="text-xs font-medium text-foreground mb-1.5 block">Full name *</label>
        <input name="full_name" required maxLength={120} className={inputCls} placeholder="Jane Smith" />
      </div>
      <div>
        <label className="text-xs font-medium text-foreground mb-1.5 block">Work email *</label>
        <input name="email" type="email" required maxLength={255} className={inputCls} placeholder="jane@acme.com" />
      </div>
      <div>
        <label className="text-xs font-medium text-foreground mb-1.5 block">Company *</label>
        <input name="company" required maxLength={160} className={inputCls} placeholder="Acme Corp" />
      </div>
      <div>
        <label className="text-xs font-medium text-foreground mb-1.5 block">Phone</label>
        <input name="phone" type="tel" maxLength={40} className={inputCls} placeholder="+44 20 1234 5678" />
      </div>

      {/* Site */}
      <div className="sm:col-span-2 mt-2 -mb-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Site address</p>
      </div>
      <div className="sm:col-span-2">
        <label className="text-xs font-medium text-foreground mb-1.5 block">Street address *</label>
        <input name="site_address" required maxLength={255} className={inputCls} placeholder="221B Baker Street" />
      </div>
      <div>
        <label className="text-xs font-medium text-foreground mb-1.5 block">City *</label>
        <input name="site_city" required maxLength={120} className={inputCls} placeholder="London" />
      </div>
      <div>
        <label className="text-xs font-medium text-foreground mb-1.5 block">Postal / ZIP code *</label>
        <input name="site_postal_code" required maxLength={40} className={inputCls} placeholder="NW1 6XE" />
      </div>
      <div>
        <label className="text-xs font-medium text-foreground mb-1.5 block">Country *</label>
        <input name="site_country" required maxLength={120} className={inputCls} placeholder="United Kingdom" />
      </div>
      <div>
        <label className="text-xs font-medium text-foreground mb-1.5 block">Site contact on the day</label>
        <input name="site_contact" maxLength={160} className={inputCls} placeholder="Name + mobile" />
      </div>
      <div className="sm:col-span-2">
        <label className="text-xs font-medium text-foreground mb-1.5 block">Site access notes</label>
        <input
          name="site_access_notes"
          maxLength={1000}
          className={inputCls}
          placeholder="Loading bay, security pass, escort required, parking…"
        />
      </div>

      {/* Service level */}
      <div className="sm:col-span-2 mt-2 -mb-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Service level</p>
      </div>
      <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { value: "L1", title: "L1 · Smart hands", desc: "Cabling, swap, reseat, eyes-on-site under remote guidance." },
          { value: "L2", title: "L2 · Configuration", desc: "Switch/router/AP install, basic config, structured cabling." },
          { value: "L3", title: "L3 · Specialist", desc: "Complex troubleshooting, SD-WAN, firewalls, certifications." },
        ].map((opt, idx) => (
          <label
            key={opt.value}
            className="relative cursor-pointer rounded-xl border border-border bg-background/40 p-3.5 hover:border-primary/50 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5"
          >
            <input
              type="radio"
              name="service_level"
              value={opt.value}
              required
              defaultChecked={idx === 0}
              className="sr-only peer"
            />
            <div className="text-sm font-semibold text-foreground">{opt.title}</div>
            <div className="text-[11px] text-muted-foreground leading-snug mt-1">{opt.desc}</div>
          </label>
        ))}
      </div>

      {/* SLA + schedule */}
      <div className="sm:col-span-2 mt-2 -mb-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">SLA &amp; schedule</p>
      </div>
      <div>
        <label className="text-xs font-medium text-foreground mb-1.5 block">Required SLA *</label>
        <select name="sla" required defaultValue="next_business_day" className={selectCls}>
          <option value="p1_4h">P1 · On-site within 4 hours (24/7)</option>
          <option value="same_day">Same business day (≤ 8 hrs)</option>
          <option value="next_business_day">Next business day</option>
          <option value="48_72h">Within 48–72 hours</option>
          <option value="scheduled">Scheduled / project window</option>
        </select>
      </div>
      <div>
        <label className="text-xs font-medium text-foreground mb-1.5 block">On-site duration estimate</label>
        <select name="duration_estimate" defaultValue="2_4h" className={selectCls}>
          <option value="lt_1h">&lt; 1 hour</option>
          <option value="1_2h">1–2 hours</option>
          <option value="2_4h">2–4 hours</option>
          <option value="half_day">Half day</option>
          <option value="full_day">Full day</option>
          <option value="multi_day">Multi-day</option>
        </select>
      </div>
      <div>
        <label className="text-xs font-medium text-foreground mb-1.5 block">Preferred date *</label>
        <input name="preferred_date" type="date" required className={inputCls} />
      </div>
      <div>
        <label className="text-xs font-medium text-foreground mb-1.5 block">Preferred arrival window *</label>
        <select name="preferred_window" required defaultValue="am" className={selectCls}>
          <option value="am">Morning (08:00 – 12:00)</option>
          <option value="pm">Afternoon (12:00 – 17:00)</option>
          <option value="evening">Evening (17:00 – 22:00)</option>
          <option value="overnight">Overnight (22:00 – 06:00)</option>
          <option value="anytime">Any time</option>
        </select>
      </div>

      {/* Scope */}
      <div className="sm:col-span-2 mt-2">
        <label className="text-xs font-medium text-foreground mb-1.5 block">Scope of work *</label>
        <textarea
          name="scope"
          required
          rows={4}
          maxLength={4000}
          className={inputCls}
          placeholder="Devices, ports, cabling, rack location, remote engineer who will guide the on-site tech, deliverables…"
        />
      </div>

      <div className="sm:col-span-2 flex items-center gap-2">
        <input id="dispatch_consent" type="checkbox" required className="w-4 h-4 rounded border-border" />
        <label htmlFor="dispatch_consent" className="text-xs text-muted-foreground">
          I agree to be contacted regarding this dispatch request.
        </label>
      </div>

      {state === "error" && error && (
        <div className="sm:col-span-2 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={state === "submitting"}
          className="w-full gradient-primary text-primary-foreground px-6 py-3 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 justify-center shadow-glow hover:shadow-[0_0_40px_hsl(var(--primary)/0.5)] hover:-translate-y-0.5 disabled:opacity-70 disabled:hover:translate-y-0"
        >
          {state === "submitting" ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Sending request…
            </>
          ) : (
            <>
              Check availability &amp; get quote <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
        <p className="text-[11px] text-muted-foreground text-center mt-3">
          Typical response &lt; 1 hour during business hours · 24/7 hotline for P1 dispatches.
        </p>
      </div>
    </motion.form>
  );
}

export default DispatchQuoteForm;
