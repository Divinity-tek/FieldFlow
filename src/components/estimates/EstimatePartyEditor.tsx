import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Pencil, Loader2 } from "lucide-react";
import { toast } from "sonner";

export type PartyKind = "partner" | "client";

interface Props {
  kind: PartyKind;
  party: any | null;
  onSaved?: () => void;
}

interface FormState {
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
  address_line1: string;
  city: string;
  region: string;
  postcode: string;
  country: string;
}

const empty: FormState = {
  company_name: "", contact_name: "", email: "", phone: "",
  address_line1: "", city: "", region: "", postcode: "", country: "",
};

/** Lightweight email validator — trim + lowercase + RFC-lite regex with length caps. */
const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;
function isValidEmail(value: string): boolean {
  const v = value.trim().toLowerCase();
  if (!v || v.length > 254) return false;
  const [local, domain] = v.split("@");
  if (!local || local.length > 64 || !domain) return false;
  return EMAIL_RE.test(v);
}

/** Phone validator — allows +, digits, spaces, dashes, parens; 7-20 digits. */
const PHONE_ALLOWED_RE = /^[+\d\s().-]+$/;
function isValidPhone(value: string): boolean {
  const v = value.trim();
  if (!v) return true; // optional
  if (v.length > 40) return false;
  if (!PHONE_ALLOWED_RE.test(v)) return false;
  const digits = v.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 20;
}

/**
 * Inline edit sheet for the partner/client shown on an estimate.
 * Saves directly to the partners or clients table; the parent should
 * invalidate the estimate query in onSaved so the PDF preview refreshes.
 */
export default function EstimatePartyEditor({ kind, party, onSaved }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(empty);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitted, setSubmitted] = useState(false);

  const validate = (values: FormState): Partial<Record<keyof FormState, string>> => {
    const errs: Partial<Record<keyof FormState, string>> = {};
    if (!values.company_name.trim()) errs.company_name = "Company / name is required";
    if (values.email.trim() && !isValidEmail(values.email)) errs.email = "Enter a valid email address";
    if (!isValidPhone(values.phone)) errs.phone = "Enter a valid phone number";
    return errs;
  };

  // Live re-validate after the first save attempt so highlights clear as users fix fields.
  useEffect(() => {
    if (submitted) setErrors(validate(form));
  }, [form, submitted]);

  useEffect(() => {
    if (!open || !party) return;
    setForm({
      company_name: party.company_name ?? "",
      contact_name: party.contact_name ?? "",
      email: party.email ?? "",
      phone: party.phone ?? party.contact_phone ?? "",
      address_line1: party.address_line1 ?? party.address ?? "",
      city: party.city ?? "",
      region: party.region ?? "",
      postcode: party.postcode ?? "",
      country: party.country ?? "",
    });
    setErrors({});
    setSubmitted(false);
  }, [open, party]);

  const save = useMutation({
    mutationFn: async (values: FormState) => {
      if (!party?.id) throw new Error("Missing party id");
      const table = kind === "partner" ? "partners" : "clients";
      // Clients table also has a legacy single-line "address" — keep it in sync
      const payload: Record<string, any> = {
        company_name: values.company_name.trim(),
        contact_name: values.contact_name.trim() || null,
        email: values.email.trim() || null,
        phone: values.phone.trim() || null,
        address_line1: values.address_line1.trim() || null,
        city: values.city.trim() || null,
        region: values.region.trim() || null,
        postcode: values.postcode.trim() || null,
        country: values.country.trim() || null,
      };
      if (kind === "client") {
        const formatted = [values.address_line1, values.city, values.region, values.postcode, values.country]
          .map((s) => s.trim()).filter(Boolean).join(", ");
        payload.address = formatted || null;
      }
      const { error } = await supabase.from(table as any).update(payload).eq("id", party.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`${kind === "partner" ? "Partner" : "Client"} updated`);
      qc.invalidateQueries({ queryKey: ["estimates"] });
      qc.invalidateQueries({ queryKey: ["estimate-clients"] });
      qc.invalidateQueries({ queryKey: ["estimate-partners"] });
      onSaved?.();
      setOpen(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Save failed"),
  });

  if (!party?.id) return null;

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="gap-1"
        onClick={() => setOpen(true)}
      >
        <Pencil className="w-3 h-3" />
        Edit {kind}
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit {kind === "partner" ? "Partner" : "Client"} Details</SheetTitle>
            <SheetDescription>
              Changes update the {kind} record and refresh the estimate preview & PDF.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-3 py-4">
            <div>
              <Label className={errors.company_name ? "text-destructive" : ""}>
                Company / Name {errors.company_name && <span aria-hidden>*</span>}
              </Label>
              <Input
                value={form.company_name}
                onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                maxLength={200}
                aria-invalid={!!errors.company_name}
                className={errors.company_name ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              {errors.company_name && (
                <p className="text-xs text-destructive mt-1">{errors.company_name}</p>
              )}
            </div>
            <div>
              <Label>Contact Name</Label>
              <Input
                value={form.contact_name}
                onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
                maxLength={150}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className={errors.email ? "text-destructive" : ""}>
                  Email {errors.email && <span aria-hidden>*</span>}
                </Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  aria-invalid={!!errors.email}
                  className={errors.email ? "border-destructive focus-visible:ring-destructive" : ""}
                />
                {errors.email && (
                  <p className="text-xs text-destructive mt-1">{errors.email}</p>
                )}
              </div>
              <div>
                <Label className={errors.phone ? "text-destructive" : ""}>Phone</Label>
                <Input
                  type="tel"
                  inputMode="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  maxLength={40}
                  aria-invalid={!!errors.phone}
                  className={errors.phone ? "border-destructive focus-visible:ring-destructive" : ""}
                />
                {errors.phone && (
                  <p className="text-xs text-destructive mt-1">{errors.phone}</p>
                )}
              </div>
            </div>

            <div className="border-t pt-3 mt-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Address
              </p>
              <div className="space-y-3">
                <div>
                  <Label>Street Address</Label>
                  <Input
                    value={form.address_line1}
                    onChange={(e) => setForm({ ...form, address_line1: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>City</Label>
                    <Input
                      value={form.city}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Region / State</Label>
                    <Input
                      value={form.region}
                      onChange={(e) => setForm({ ...form, region: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Postcode / ZIP</Label>
                    <Input
                      value={form.postcode}
                      onChange={(e) => setForm({ ...form, postcode: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Country</Label>
                    <Input
                      value={form.country}
                      onChange={(e) => setForm({ ...form, country: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <SheetFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                setSubmitted(true);
                const errs = validate(form);
                setErrors(errs);
                if (Object.keys(errs).length > 0) {
                  toast.error("Please fix the highlighted fields");
                  return;
                }
                save.mutate(form);
              }}
              disabled={save.isPending}
            >
              {save.isPending && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
              Save & Update PDF
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}

/** Format a multi-line postal address for the PDF preview. */
export function formatAddressLines(party: any): string[] {
  if (!party) return [];
  const line1 = party.address_line1 || party.address || "";
  const cityRegion = [party.city, party.region].filter(Boolean).join(", ");
  const cityRegionPost = [cityRegion, party.postcode].filter(Boolean).join(" ").trim();
  const country = party.country || "";
  return [line1, cityRegionPost, country].map((s) => String(s).trim()).filter(Boolean);
}
