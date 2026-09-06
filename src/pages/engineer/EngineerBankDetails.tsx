import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Landmark, ShieldCheck, Info } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

// Small, common starter list — not exhaustive. The free-text Country field
// fallback below covers anything not listed.
const COUNTRIES = [
  { code: "US", label: "United States", currency: "USD" },
  { code: "GB", label: "United Kingdom", currency: "GBP" },
  { code: "IN", label: "India", currency: "INR" },
  { code: "AE", label: "United Arab Emirates", currency: "AED" },
  { code: "AU", label: "Australia", currency: "AUD" },
  { code: "CA", label: "Canada", currency: "CAD" },
  { code: "DE", label: "Germany", currency: "EUR" },
  { code: "FR", label: "France", currency: "EUR" },
  { code: "SG", label: "Singapore", currency: "SGD" },
  { code: "ZA", label: "South Africa", currency: "ZAR" },
  { code: "PH", label: "Philippines", currency: "PHP" },
  { code: "NG", label: "Nigeria", currency: "NGN" },
  { code: "MX", label: "Mexico", currency: "MXN" },
];

const LOCAL_CODE_TYPES = [
  { value: "routing_number", label: "Routing Number (US)" },
  { value: "sort_code", label: "Sort Code (UK)" },
  { value: "ifsc", label: "IFSC Code (India)" },
  { value: "bsb", label: "BSB (Australia)" },
  { value: "transit_number", label: "Transit Number (Canada)" },
  { value: "clabe", label: "CLABE (Mexico)" },
  { value: "branch_code", label: "Branch Code (generic)" },
  { value: "other", label: "Other / Not sure" },
];

const CURRENCIES = ["USD", "GBP", "EUR", "INR", "AED", "AUD", "CAD", "SGD", "ZAR", "PHP", "NGN", "MXN"];

const emptyForm = {
  account_holder_name: "",
  country_code: "",
  currency: "",
  bank_name: "",
  account_number: "",
  iban: "",
  swift_bic: "",
  local_bank_code: "",
  local_bank_code_type: "",
  additional_notes: "",
};

const EngineerBankDetails = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState(emptyForm);

  const { data: engineerRow } = useQuery({
    queryKey: ["my-engineer-row-bank", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase.from("engineers").select("id").eq("user_id", user.id).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: existing, isLoading } = useQuery({
    queryKey: ["my-bank-details", engineerRow?.id],
    queryFn: async () => {
      if (!engineerRow) return null;
      const { data, error } = await (supabase as any)
        .from("engineer_bank_details")
        .select("*")
        .eq("engineer_id", engineerRow.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!engineerRow,
  });

  useEffect(() => {
    if (!existing) return;
    setForm({
      account_holder_name: existing.account_holder_name ?? "",
      country_code: existing.country_code ?? "",
      currency: existing.currency ?? "",
      bank_name: existing.bank_name ?? "",
      account_number: existing.account_number ?? "",
      iban: existing.iban ?? "",
      swift_bic: existing.swift_bic ?? "",
      local_bank_code: existing.local_bank_code ?? "",
      local_bank_code_type: existing.local_bank_code_type ?? "",
      additional_notes: existing.additional_notes ?? "",
    });
  }, [existing]);

  const setField = (k: keyof typeof form, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const handleCountryChange = (code: string) => {
    const country = COUNTRIES.find((c) => c.code === code);
    setForm((prev) => ({
      ...prev,
      country_code: code,
      currency: country?.currency ?? prev.currency,
    }));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!engineerRow) throw new Error("Engineer profile not found");
      if (!form.account_holder_name.trim()) throw new Error("Account holder name is required");
      if (!form.country_code) throw new Error("Select a country");
      if (!form.currency) throw new Error("Select a currency");
      if (!form.bank_name.trim()) throw new Error("Bank name is required");
      if (!form.iban.trim() && !form.account_number.trim()) {
        throw new Error("Provide either an IBAN or a local account number");
      }

      const payload = {
        engineer_id: engineerRow.id,
        account_holder_name: form.account_holder_name.trim(),
        country_code: form.country_code,
        currency: form.currency,
        bank_name: form.bank_name.trim(),
        account_number: form.account_number.trim() || null,
        iban: form.iban.trim() || null,
        swift_bic: form.swift_bic.trim() || null,
        local_bank_code: form.local_bank_code.trim() || null,
        local_bank_code_type: form.local_bank_code_type || null,
        additional_notes: form.additional_notes.trim() || null,
        // Any edit resets verification — admin should re-check after a change.
        verified: false,
        verified_by: null,
        verified_at: null,
      };

      const { error } = await (supabase as any)
        .from("engineer_bank_details")
        .upsert(payload, { onConflict: "engineer_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Bank details saved");
      qc.invalidateQueries({ queryKey: ["my-bank-details", engineerRow?.id] });
    },
    onError: (e: any) => toast.error(e.message || "Failed to save bank details"),
  });

  return (
    <AppLayout title="Bank Details" subtitle="Add your payout information — used for job invoice payments">
      <div className="space-y-6 max-w-2xl">
        {existing && (
          <div className="rounded-xl border border-border/50 bg-card/95 backdrop-blur-sm shadow-card p-4 flex items-center gap-3">
            {existing.verified ? (
              <>
                <ShieldCheck className="w-5 h-5 text-green-600 shrink-0" />
                <div>
                  <p className="text-sm font-medium">Verified</p>
                  <p className="text-xs text-muted-foreground">An admin has confirmed these details.</p>
                </div>
              </>
            ) : (
              <>
                <Info className="w-5 h-5 text-amber-600 shrink-0" />
                <div>
                  <p className="text-sm font-medium">Pending verification</p>
                  <p className="text-xs text-muted-foreground">
                    Saved, but not yet reviewed by an admin. Editing again will reset verification.
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        <div className="rounded-xl border border-border/50 bg-card/95 backdrop-blur-sm shadow-card">
          <div className="flex flex-col space-y-1.5 p-6 pb-4">
            <h3 className="text-xl font-semibold leading-none tracking-tight flex items-center gap-2">
              <Landmark className="w-5 h-5 text-primary" />
              Payout Bank Account
            </h3>
            <p className="text-sm text-muted-foreground">
              We support payouts to most countries. Fill in what applies to your bank — IBAN for most of Europe
              and beyond, or your local account number + routing code for others.
            </p>
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>
          ) : (
            <div className="px-6 pb-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Label htmlFor="bd-name">Account Holder Name <span className="text-destructive">*</span></Label>
                  <Input
                    id="bd-name"
                    placeholder="Exactly as it appears on your bank account"
                    value={form.account_holder_name}
                    onChange={(e) => setField("account_holder_name", e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="bd-country">Country <span className="text-destructive">*</span></Label>
                  <Select value={form.country_code} onValueChange={handleCountryChange}>
                    <SelectTrigger id="bd-country"><SelectValue placeholder="Select country" /></SelectTrigger>
                    <SelectContent>
                      {COUNTRIES.map((c) => (
                        <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="bd-currency">Payout Currency <span className="text-destructive">*</span></Label>
                  <Select value={form.currency} onValueChange={(v) => setField("currency", v)}>
                    <SelectTrigger id="bd-currency"><SelectValue placeholder="Select currency" /></SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="bd-bank-name">Bank Name <span className="text-destructive">*</span></Label>
                  <Input
                    id="bd-bank-name"
                    placeholder="e.g. HSBC, Chase, HDFC Bank"
                    value={form.bank_name}
                    onChange={(e) => setField("bank_name", e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="bd-iban">IBAN</Label>
                  <Input
                    id="bd-iban"
                    placeholder="e.g. GB29 NWBK 6016 1331 9268 19"
                    value={form.iban}
                    onChange={(e) => setField("iban", e.target.value.toUpperCase())}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Use this if your bank issues IBANs.</p>
                </div>

                <div>
                  <Label htmlFor="bd-account-number">Local Account Number</Label>
                  <Input
                    id="bd-account-number"
                    placeholder="If no IBAN, enter your account number"
                    value={form.account_number}
                    onChange={(e) => setField("account_number", e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="bd-code-type">Local Bank Code Type</Label>
                  <Select value={form.local_bank_code_type} onValueChange={(v) => setField("local_bank_code_type", v)}>
                    <SelectTrigger id="bd-code-type"><SelectValue placeholder="Select type (if applicable)" /></SelectTrigger>
                    <SelectContent>
                      {LOCAL_CODE_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="bd-code">Local Bank Code</Label>
                  <Input
                    id="bd-code"
                    placeholder="e.g. sort code, IFSC, routing number"
                    value={form.local_bank_code}
                    onChange={(e) => setField("local_bank_code", e.target.value)}
                  />
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="bd-swift">SWIFT / BIC Code</Label>
                  <Input
                    id="bd-swift"
                    placeholder="e.g. HBUKGB4B — needed for international wire transfers"
                    value={form.swift_bic}
                    onChange={(e) => setField("swift_bic", e.target.value.toUpperCase())}
                  />
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="bd-notes">Additional Notes</Label>
                  <Textarea
                    id="bd-notes"
                    placeholder="Anything else needed to process your payout — intermediary bank, branch address, etc."
                    rows={3}
                    value={form.additional_notes}
                    onChange={(e) => setField("additional_notes", e.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2">
                <ShieldCheck className="w-4 h-4 text-muted-foreground shrink-0" />
                <p className="text-xs text-muted-foreground">
                  Only you and admins can view these details.
                </p>
              </div>

              <Button
                className="gap-2"
                disabled={saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
              >
                {saveMutation.isPending ? "Saving…" : existing ? "Update Bank Details" : "Save Bank Details"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default EngineerBankDetails;