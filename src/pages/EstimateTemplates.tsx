import { useEffect, useMemo, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  LayoutTemplate, Plus, Pencil, Trash2, Copy, Share2, Lock, Receipt,
} from "lucide-react";
import {
  EstimateTemplate, EstimateTemplateInput, EstimateTemplateLineItem, EstimateTemplateCustomColumn,
  blankEstimateTemplateInput, listEstimateTemplates,
  createEstimateTemplate, updateEstimateTemplate, deleteEstimateTemplate,
} from "@/lib/estimateTemplates";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";

const CURRENCIES = ["USD", "EUR", "GBP", "AUD", "CAD", "INR", "AED", "SGD"];
const TAX_MODES: Array<{ value: EstimateTemplateInput["tax_mode"]; label: string }> = [
  { value: "none", label: "No tax (0%)" },
  { value: "single", label: "Single tax" },
  { value: "dual_split", label: "Dual taxes (split base)" },
  { value: "compound", label: "Compound (Tax 2 on Tax 1)" },
  { value: "per_line", label: "Per line item" },
];

export default function EstimateTemplates() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<EstimateTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EstimateTemplateInput>(blankEstimateTemplateInput());

  const load = async () => {
    setLoading(true);
    try { setItems(await listEstimateTemplates()); }
    catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const set = <K extends keyof EstimateTemplateInput>(k: K, v: EstimateTemplateInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const validateRate = (v: number | null | undefined): string | null => {
    if (v === null || v === undefined) return null;
    if (!Number.isFinite(v)) return "Must be a number";
    if (v < 0) return "Must be ≥ 0";
    if (v > 1_000_000) return "Too large";
    return null;
  };
  const dispatchFieldErrors: Record<string, string | null> = {
    dispatch_nbd_tm: validateRate(form.dispatch_nbd_tm),
    dispatch_hourly: validateRate(form.dispatch_hourly),
    dispatch_half_day: validateRate(form.dispatch_half_day),
    dispatch_full_day: validateRate(form.dispatch_full_day),
    dispatch_sbd_tm: validateRate(form.dispatch_sbd_tm),
    dispatch_sbd_hourly: validateRate(form.dispatch_sbd_hourly),
    dispatch_sbd_half_day: validateRate(form.dispatch_sbd_half_day),
    dispatch_sbd_full_day: validateRate(form.dispatch_sbd_full_day),
  };
  const hasDispatchErrors = Object.values(dispatchFieldErrors).some((e) => e !== null);

  const parseRate = (s: string): number | null => {
    if (s === "") return null;
    // Allow a lone "-" or partial input to flow through as NaN so validation flags it
    const n = Number(s);
    return Number.isNaN(n) ? (NaN as unknown as number) : n;
  };

  const openNew = () => {
    setEditingId(null);
    setForm(blankEstimateTemplateInput());
    setOpen(true);
  };
  const openEdit = (t: EstimateTemplate) => {
    setEditingId(t.id);
    const { id, owner_id, created_at, updated_at, ...rest } = t;
    setForm({ ...rest, line_items: [...rest.line_items] });
    setOpen(true);
  };
  const duplicate = (t: EstimateTemplate) => {
    setEditingId(null);
    const { id, owner_id, created_at, updated_at, name, ...rest } = t;
    setForm({ ...rest, name: `${name} (copy)`, line_items: [...rest.line_items] });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error("Name is required");
    if (hasDispatchErrors) {
      return toast.error("Please fix the Dispatch Pricing errors before saving");
    }
    try {
      if (editingId) {
        await updateEstimateTemplate(editingId, form);
        toast.success("Template updated");
      } else {
        await createEstimateTemplate(form);
        toast.success("Template created");
      }
      setOpen(false);
      await load();
    } catch (e) { toast.error((e as Error).message); }
  };

  const remove = async (t: EstimateTemplate) => {
    if (!confirm(`Delete template "${t.name}"?`)) return;
    try { await deleteEstimateTemplate(t.id); toast.success("Deleted"); await load(); }
    catch (e) { toast.error((e as Error).message); }
  };

  const addLine = () =>
    set("line_items", [...form.line_items, { description: "", quantity: 1, unit_price: 0, unit: "" }]);
  const updateLine = (i: number, patch: Partial<EstimateTemplateLineItem>) =>
    set("line_items", form.line_items.map((li, idx) => (idx === i ? { ...li, ...patch } : li)));
  const removeLine = (i: number) =>
    set("line_items", form.line_items.filter((_, idx) => idx !== i));

  const addCustomCol = () => {
    const idx = form.custom_columns.length + 1;
    set("custom_columns", [
      ...form.custom_columns,
      { key: `col_${Date.now().toString(36)}`, label: `Column ${idx}`, type: "text" },
    ]);
  };
  const updateCustomCol = (i: number, patch: Partial<EstimateTemplateCustomColumn>) =>
    set("custom_columns", form.custom_columns.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const removeCustomCol = (i: number) => {
    const removed = form.custom_columns[i];
    set("custom_columns", form.custom_columns.filter((_, idx) => idx !== i));
    if (removed) {
      set(
        "line_items",
        form.line_items.map((li) => {
          if (!li.custom) return li;
          const { [removed.key]: _, ...rest } = li.custom;
          return { ...li, custom: rest };
        }),
      );
    }
  };
  const updateLineCustom = (i: number, key: string, value: string) =>
    updateLine(i, { custom: { ...(form.line_items[i].custom || {}), [key]: value } });

  const useTemplate = (t: EstimateTemplate) => {
    navigate(`/estimates?template=${t.id}`);
  };

  return (
    <AppLayout title="Sales Quote Templates">
      <div className="space-y-6">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-display font-bold flex items-center gap-2">
              <LayoutTemplate className="w-6 h-6 text-primary" /> Sales Quote Templates
            </h1>
            <p className="text-muted-foreground text-sm">
              Define reusable sales quote presets — currency, taxes, dispatch rates, branding, notes and starter line items.
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" /> New Template</Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingId ? "Edit Template" : "New Template"}</DialogTitle>
              </DialogHeader>
              <Tabs defaultValue="general" className="w-full">
                <TabsList className="grid grid-cols-5 w-full">
                  <TabsTrigger value="general">General</TabsTrigger>
                  <TabsTrigger value="taxes">Taxes & Discount</TabsTrigger>
                  <TabsTrigger value="dispatch">Dispatch</TabsTrigger>
                  <TabsTrigger value="branding">Branding</TabsTrigger>
                  <TabsTrigger value="lines">Line Items ({form.line_items.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="general" className="space-y-3 pt-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Template Name *</Label>
                      <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Standard NBD service" />
                    </div>
                    <div><Label>Currency</Label>
                      <Select value={form.currency} onValueChange={(v) => set("currency", v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2"><Label>Description</Label>
                      <Textarea rows={2} value={form.description || ""} onChange={(e) => set("description", e.target.value || null)} />
                    </div>
                    <div><Label>Default Sales Quote Title</Label>
                      <Input value={form.default_title || ""} onChange={(e) => set("default_title", e.target.value || null)} placeholder="Hands & Feet — Monthly" />
                    </div>
                    <div><Label>Valid for (days)</Label>
                      <Input type="number" min={0} value={form.valid_for_days ?? ""} onChange={(e) => set("valid_for_days", e.target.value === "" ? null : Number(e.target.value))} />
                    </div>
                    <div className="col-span-2"><Label>Default Notes</Label>
                      <Textarea rows={3} value={form.notes || ""} onChange={(e) => set("notes", e.target.value || null)} />
                    </div>
                    <label className="col-span-2 flex items-center gap-2 text-sm">
                      <Switch checked={form.is_shared} onCheckedChange={(v) => set("is_shared", v)} />
                      Share with team (visible to other users)
                    </label>
                  </div>
                </TabsContent>

                <TabsContent value="taxes" className="space-y-3 pt-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2"><Label>Tax Mode</Label>
                      <Select value={form.tax_mode} onValueChange={(v) => set("tax_mode", v as any)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{TAX_MODES.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label>Tax 1 Label</Label>
                      <Input value={form.tax1_label} onChange={(e) => set("tax1_label", e.target.value)} />
                    </div>
                    <div><Label>Tax 1 Rate (%)</Label>
                      <Input type="number" min={0} step="0.01" value={form.tax1_rate} onChange={(e) => set("tax1_rate", Number(e.target.value) || 0)} />
                    </div>
                    <div><Label>Tax 2 Label</Label>
                      <Input value={form.tax2_label} onChange={(e) => set("tax2_label", e.target.value)} />
                    </div>
                    <div><Label>Tax 2 Rate (%)</Label>
                      <Input type="number" min={0} step="0.01" value={form.tax2_rate} onChange={(e) => set("tax2_rate", Number(e.target.value) || 0)} />
                    </div>
                    <div><Label>Default Discount (%)</Label>
                      <Input type="number" min={0} step="0.01" value={form.discount_percent} onChange={(e) => set("discount_percent", Number(e.target.value) || 0)} />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="dispatch" className="space-y-3 pt-3">
                  <p className="text-xs text-muted-foreground">Pre-fill dispatch service rates per response level (Hands &amp; Feet pricing).</p>
                  <Tabs defaultValue="nbd" className="w-full">
                    <TabsList className="grid grid-cols-2 w-full">
                      <TabsTrigger value="nbd">NBD (Next Business Day)</TabsTrigger>
                      <TabsTrigger value="sbd">SBD (Same Business Day)</TabsTrigger>
                    </TabsList>
                    {([
                      { tab: "nbd", rows: [
                        { field: "dispatch_nbd_tm", label: "NBD T&M (call-out / minimum)", value: form.dispatch_nbd_tm, span: 2 },
                        { field: "dispatch_hourly", label: "NBD Hourly", value: form.dispatch_hourly, span: 1 },
                        { field: "dispatch_half_day", label: "NBD Half-Day", value: form.dispatch_half_day, span: 1 },
                        { field: "dispatch_full_day", label: "NBD Full-Day", value: form.dispatch_full_day, span: 2 },
                      ] },
                      { tab: "sbd", rows: [
                        { field: "dispatch_sbd_tm", label: "SBD T&M (call-out / minimum)", value: form.dispatch_sbd_tm, span: 2 },
                        { field: "dispatch_sbd_hourly", label: "SBD Hourly", value: form.dispatch_sbd_hourly, span: 1 },
                        { field: "dispatch_sbd_half_day", label: "SBD Half-Day", value: form.dispatch_sbd_half_day, span: 1 },
                        { field: "dispatch_sbd_full_day", label: "SBD Full-Day", value: form.dispatch_sbd_full_day, span: 2 },
                      ] },
                    ] as const).map(({ tab, rows }) => (
                      <TabsContent key={tab} value={tab} className="pt-3">
                        <div className="grid grid-cols-2 gap-3">
                          {rows.map((r) => {
                            const err = dispatchFieldErrors[r.field];
                            return (
                              <div key={r.field} className={r.span === 2 ? "col-span-2" : ""}>
                                <Label className={err ? "text-destructive" : ""}>{r.label}</Label>
                                <Input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  value={r.value ?? ""}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    set(r.field as keyof EstimateTemplateInput, (v === "" ? null : Number(v)) as any);
                                  }}
                                  aria-invalid={!!err || undefined}
                                  className={err ? "border-destructive focus-visible:ring-destructive" : ""}
                                />
                                {err && <p className="text-[11px] text-destructive mt-1">{err}</p>}
                              </div>
                            );
                          })}
                        </div>
                      </TabsContent>
                    ))}
                  </Tabs>
                  <div><Label>Dispatch Remarks</Label>
                    <Textarea rows={2} maxLength={1000} value={form.dispatch_remarks || ""} onChange={(e) => set("dispatch_remarks", e.target.value || null)} />
                  </div>
                </TabsContent>

                <TabsContent value="branding" className="space-y-3 pt-3">
                  <label className="flex items-center gap-2 text-sm">
                    <Switch checked={form.branding_enabled} onCheckedChange={(v) => set("branding_enabled", v)} />
                    Apply custom branding from this template
                  </label>
                  {form.branding_enabled && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2"><Label>Company Name</Label>
                        <Input value={form.branding_company_name || ""} onChange={(e) => set("branding_company_name", e.target.value || null)} />
                      </div>
                      <div className="col-span-2"><Label>Logo URL</Label>
                        <Input value={form.branding_logo_url || ""} onChange={(e) => set("branding_logo_url", e.target.value || null)} placeholder="https://…" />
                      </div>
                      <div><Label>Primary Color</Label>
                        <Input value={form.branding_primary_color || ""} onChange={(e) => set("branding_primary_color", e.target.value || null)} placeholder="#1f6feb" />
                      </div>
                      <div><Label>Accent Color</Label>
                        <Input value={form.branding_accent_color || ""} onChange={(e) => set("branding_accent_color", e.target.value || null)} placeholder="#22c55e" />
                      </div>
                      <div className="col-span-2"><Label>Footer Text</Label>
                        <Textarea rows={2} value={form.branding_footer_text || ""} onChange={(e) => set("branding_footer_text", e.target.value || null)} />
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="lines" className="space-y-4 pt-3">
                  <div className="border rounded-md p-3 space-y-2 bg-muted/30">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Custom Columns</p>
                        <p className="text-xs text-muted-foreground">Define your own extra columns that appear on every line item.</p>
                      </div>
                      <Button size="sm" variant="outline" onClick={addCustomCol} className="gap-1">
                        <Plus className="w-3 h-3" /> Add column
                      </Button>
                    </div>
                    {form.custom_columns.length > 0 && (
                      <div className="space-y-2">
                        {form.custom_columns.map((c, i) => (
                          <div key={i} className="grid grid-cols-12 gap-2 items-end">
                            <div className="col-span-11">
                              <Label className="text-xs">Column label</Label>
                              <Input value={c.label} onChange={(e) => updateCustomCol(i, { label: e.target.value })} />
                            </div>
                            <div className="col-span-1 flex justify-end">
                              <Button size="icon" variant="ghost" onClick={() => removeCustomCol(i)} title="Remove column">
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">Pre-filled line items applied when this template is used.</p>
                    <Button size="sm" variant="outline" onClick={addLine} className="gap-1"><Plus className="w-3 h-3" /> Add line</Button>
                  </div>
                  {form.line_items.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-6 text-center border rounded-md">No line items yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {form.line_items.map((li, i) => (
                        <div key={i} className="border rounded-md p-2">
                          <div className="flex flex-wrap gap-2 items-start">
                            <div className="flex-1 min-w-[200px]">
                              <Label className="text-xs">Description</Label>
                              <Input value={li.description} onChange={(e) => updateLine(i, { description: e.target.value })} />
                            </div>
                            <div className="w-20">
                              <Label className="text-xs">Qty</Label>
                              <Input type="number" min={0} step="0.01" value={li.quantity} onChange={(e) => updateLine(i, { quantity: Number(e.target.value) || 0 })} />
                            </div>
                            <div className="w-24">
                              <Label className="text-xs">Unit</Label>
                              <Input value={li.unit} onChange={(e) => updateLine(i, { unit: e.target.value })} placeholder="hr, day, ea" />
                            </div>
                            <div className="w-28">
                              <Label className="text-xs">Unit Price</Label>
                              <Input type="number" min={0} step="0.01" value={li.unit_price} onChange={(e) => updateLine(i, { unit_price: Number(e.target.value) || 0 })} />
                            </div>
                            {form.custom_columns.map((c) => (
                              <div key={c.key} className="w-32">
                                <Label className="text-xs truncate block">{c.label}</Label>
                                <Input
                                  type="text"
                                  value={(li.custom?.[c.key] ?? "") as any}
                                  onChange={(e) => updateLineCustom(i, c.key, e.target.value)}
                                />
                              </div>
                            ))}
                            <div className="flex justify-end pt-5">
                              <Button size="icon" variant="ghost" onClick={() => removeLine(i)} title="Remove">
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
              <DialogFooter className="flex-col sm:flex-row sm:items-center gap-2">
                {hasDispatchErrors && (
                  <span className="text-xs text-destructive sm:mr-auto">Fix dispatch pricing errors before saving.</span>
                )}
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={save} disabled={hasDispatchErrors}>{editingId ? "Save Changes" : "Create Template"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : items.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-muted-foreground">
            No sales quote templates yet. Create one to speed up new sales quotes.
          </CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {items.map((t) => {
              const isOwner = t.owner_id === user?.id;
              return (
                <Card key={t.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                          {t.name}
                          {t.is_shared
                            ? <Badge variant="secondary" className="text-xs gap-1"><Share2 className="w-3 h-3" /> shared</Badge>
                            : <Badge variant="outline" className="text-xs gap-1"><Lock className="w-3 h-3" /> private</Badge>}
                          {!isOwner && <Badge variant="outline" className="text-xs">read-only</Badge>}
                        </CardTitle>
                        {t.description && <p className="text-xs text-muted-foreground mt-1">{t.description}</p>}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button size="icon" variant="ghost" onClick={() => duplicate(t)} title="Duplicate"><Copy className="w-4 h-4" /></Button>
                        {isOwner && (
                          <>
                            <Button size="icon" variant="ghost" onClick={() => openEdit(t)} title="Edit"><Pencil className="w-4 h-4" /></Button>
                            <Button size="icon" variant="ghost" onClick={() => remove(t)} title="Delete"><Trash2 className="w-4 h-4 text-destructive" /></Button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 text-xs text-muted-foreground">
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="outline">{t.currency}</Badge>
                      {t.tax_mode === "none"
                        ? <Badge variant="outline">No tax</Badge>
                        : <Badge variant="outline">{t.tax1_label}: {t.tax1_rate}%</Badge>}
                      {t.tax_mode !== "none" && t.tax2_rate > 0 && <Badge variant="outline">{t.tax2_label}: {t.tax2_rate}%</Badge>}
                      {t.discount_percent > 0 && <Badge variant="outline">−{t.discount_percent}% disc</Badge>}
                      <Badge variant="outline">{t.line_items.length} line(s)</Badge>
                      {t.custom_columns?.length > 0 && <Badge variant="outline">{t.custom_columns.length} custom col(s)</Badge>}
                    </div>
                    {(t.dispatch_hourly || t.dispatch_half_day || t.dispatch_full_day || t.dispatch_nbd_tm || t.dispatch_sbd_tm) && (
                      <div>Dispatch: {[
                        t.dispatch_nbd_tm && `NBD ${t.dispatch_nbd_tm}`,
                        t.dispatch_sbd_tm && `SBD ${t.dispatch_sbd_tm}`,
                        t.dispatch_hourly && `${t.dispatch_hourly}/hr`,
                        t.dispatch_half_day && `${t.dispatch_half_day}/half`,
                        t.dispatch_full_day && `${t.dispatch_full_day}/day`,
                      ].filter(Boolean).join(" • ")}</div>
                    )}
                    <Button size="sm" className="w-full gap-2 mt-2" onClick={() => useTemplate(t)}>
                      <Receipt className="w-4 h-4" /> Use Template
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
