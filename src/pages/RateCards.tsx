import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import {
  DollarSign, Edit, Plus, Trash2, CheckCircle2, Clock, Zap, Shield,
  AlertTriangle, Calculator, Star, XCircle,
} from "lucide-react";

interface ScopeItem { task: string; included: boolean }

const LEVEL_CONFIG: Record<string, { color: string; icon: any; bg: string }> = {
  L1: { color: "text-blue-600", icon: Shield, bg: "bg-blue-500/10 border-blue-500/30" },
  L2: { color: "text-purple-600", icon: Zap, bg: "bg-purple-500/10 border-purple-500/30" },
  L3: { color: "text-amber-600", icon: Star, bg: "bg-amber-500/10 border-amber-500/30" },
};

const emptyForm = {
  level: "L1",
  level_name: "",
  scope_of_work: "",
  scope_items: [] as ScopeItem[],
  min_hours: 2,
  hourly_rate: 0,
  travel_rate: 0,
  overtime_rate: 0,
  after_hours_rate: 0,
  weekend_rate: 0,
  holiday_rate: 0,
  emergency_multiplier: 1.5,
  currency: "USD",
  is_active: true,
  notes: "",
  partner_id: "" as string,
};

const RateCards = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [newScopeTask, setNewScopeTask] = useState("");
  const [calcHours, setCalcHours] = useState(2);

  const { data: rateCards = [], isLoading } = useQuery({
    queryKey: ["rate-cards"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("engineer_rate_cards")
        .select("*")
        .order("level", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: partners = [] } = useQuery({
    queryKey: ["rate-cards-partners"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("partners")
        .select("id, company_name, logo_url, tax_number, country, is_active")
        .eq("is_active", true)
        .order("company_name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const partnerById = (id?: string | null) => partners.find((p: any) => p.id === id);
  const saveMutation = useMutation({
    mutationFn: async (values: typeof form & { id?: string }) => {
      const payload = {
        level: values.level,
        level_name: values.level_name,
        scope_of_work: values.scope_of_work,
        scope_items: values.scope_items as any,
        min_hours: Number(values.min_hours),
        hourly_rate: Number(values.hourly_rate),
        travel_rate: Number(values.travel_rate),
        overtime_rate: Number(values.overtime_rate),
        after_hours_rate: Number(values.after_hours_rate),
        weekend_rate: Number(values.weekend_rate),
        holiday_rate: Number(values.holiday_rate),
        emergency_multiplier: Number(values.emergency_multiplier),
        currency: values.currency,
        is_active: values.is_active,
        notes: values.notes || null,
        partner_id: values.partner_id ? values.partner_id : null,
        created_by: user?.id,
      };

      if (values.id) {
        const { error } = await supabase
          .from("engineer_rate_cards")
          .update(payload as any)
          .eq("id", values.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("engineer_rate_cards")
          .insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rate-cards"] });
      setDialogOpen(false);
      setEditId(null);
      setForm(emptyForm);
      toast.success(editId ? "Rate card updated" : "Rate card created");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("engineer_rate_cards").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rate-cards"] });
      toast.success("Rate card deleted");
    },
  });

  const openEdit = (card: any) => {
    setEditId(card.id);
    setForm({
      level: card.level,
      level_name: card.level_name,
      scope_of_work: card.scope_of_work,
      scope_items: (card.scope_items || []) as ScopeItem[],
      min_hours: card.min_hours,
      hourly_rate: card.hourly_rate,
      travel_rate: card.travel_rate,
      overtime_rate: card.overtime_rate,
      after_hours_rate: Number(card.after_hours_rate ?? 0),
      weekend_rate: Number(card.weekend_rate ?? 0),
      holiday_rate: Number(card.holiday_rate ?? 0),
      emergency_multiplier: card.emergency_multiplier,
      currency: card.currency,
      is_active: card.is_active,
      notes: card.notes || "",
      partner_id: card.partner_id ?? "",
    });
    setDialogOpen(true);
  };

  const openCreate = () => {
    setEditId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const addScopeItem = () => {
    if (!newScopeTask.trim()) return;
    setForm({ ...form, scope_items: [...form.scope_items, { task: newScopeTask.trim(), included: true }] });
    setNewScopeTask("");
  };

  const removeScopeItem = (idx: number) => {
    setForm({ ...form, scope_items: form.scope_items.filter((_, i) => i !== idx) });
  };

  const calcCharge = (card: any, hours: number) => {
    const billableHours = Math.max(hours, card.min_hours);
    return billableHours * Number(card.hourly_rate);
  };

  return (
    <AppLayout title="Engineer Rate Cards" subtitle="Manage tiered pricing for L1, L2, L3 dispatch levels">
      <div className="space-y-6">
        {/* Rate Cards Grid */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-card-foreground">Active Rate Tiers</h3>
          <Button size="sm" className="gap-1.5" onClick={openCreate}>
            <Plus className="w-3.5 h-3.5" /> Add Rate Card
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {rateCards.filter((c: any) => c.is_active).map((card: any) => {
            const cfg = LEVEL_CONFIG[card.level] || LEVEL_CONFIG.L1;
            const Icon = cfg.icon;
            const scopeItems = (card.scope_items || []) as ScopeItem[];
            return (
              <Card key={card.id} className={`border ${cfg.bg} relative overflow-hidden`}>
                <div className="absolute top-0 right-0 w-24 h-24 rounded-bl-full bg-gradient-to-bl from-muted/30 to-transparent" />
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${cfg.bg}`}>
                        <Icon className={`w-5 h-5 ${cfg.color}`} />
                      </div>
                      <div>
                        <Badge variant="outline" className="text-[10px] h-4 mb-0.5">{card.level}</Badge>
                        <CardTitle className="text-sm">{card.level_name}</CardTitle>
                        {(() => {
                          const p = partnerById(card.partner_id);
                          if (!p) return null;
                          return (
                            <div className="flex items-center gap-1 mt-1">
                              {p.logo_url ? (
                                <img src={p.logo_url} alt="" className="w-3 h-3 rounded object-contain" />
                              ) : (
                                <div className="w-3 h-3 rounded bg-muted/70 text-[7px] flex items-center justify-center font-bold">{p.company_name?.charAt(0)}</div>
                              )}
                              <span className="text-[10px] text-muted-foreground truncate max-w-[140px]">{p.company_name}</span>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(card)}>
                        <Edit className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(card.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Pricing */}
                  <div className="flex items-end gap-1">
                    <span className="text-3xl font-bold font-display text-card-foreground">${Number(card.hourly_rate).toFixed(0)}</span>
                    <span className="text-sm text-muted-foreground mb-1">/hr</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-background/60 rounded-lg p-2 border border-border/30">
                      <p className="text-muted-foreground">Min Charge</p>
                      <p className="font-semibold text-card-foreground">{card.min_hours}hrs (${(card.min_hours * card.hourly_rate).toFixed(0)})</p>
                    </div>
                    <div className="bg-background/60 rounded-lg p-2 border border-border/30">
                      <p className="text-muted-foreground">Travel Rate</p>
                      <p className="font-semibold text-card-foreground">${Number(card.travel_rate).toFixed(0)}/hr</p>
                    </div>
                    <div className="bg-background/60 rounded-lg p-2 border border-border/30">
                      <p className="text-muted-foreground">Overtime</p>
                      <p className="font-semibold text-card-foreground">${Number(card.overtime_rate).toFixed(0)}/hr</p>
                    </div>
                    <div className="bg-background/60 rounded-lg p-2 border border-border/30">
                      <p className="text-muted-foreground">Emergency</p>
                      <p className="font-semibold text-card-foreground">{card.emergency_multiplier}× rate</p>
                    </div>
                    <div className="bg-background/60 rounded-lg p-2 border border-border/30">
                      <p className="text-muted-foreground">After-Hours</p>
                      <p className="font-semibold text-card-foreground">${Number(card.after_hours_rate ?? 0).toFixed(0)}/hr</p>
                    </div>
                    <div className="bg-background/60 rounded-lg p-2 border border-border/30">
                      <p className="text-muted-foreground">Weekend</p>
                      <p className="font-semibold text-card-foreground">${Number(card.weekend_rate ?? 0).toFixed(0)}/hr</p>
                    </div>
                    <div className="bg-background/60 rounded-lg p-2 border border-border/30">
                      <p className="text-muted-foreground">Holiday</p>
                      <p className="font-semibold text-card-foreground">${Number(card.holiday_rate ?? 0).toFixed(0)}/hr</p>
                    </div>
                  </div>

                  <Separator />

                  {/* Scope */}
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Scope of Work</p>
                    <p className="text-[11px] text-muted-foreground mb-2">{card.scope_of_work}</p>
                    {scopeItems.length > 0 && (
                      <div className="space-y-1">
                        {scopeItems.map((item: ScopeItem, i: number) => (
                          <div key={i} className="flex items-center gap-1.5 text-[11px]">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                            <span className="text-card-foreground">{item.task}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Quick Calculator */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Calculator className="w-4 h-4 text-primary" />
              Rate Calculator
              <Badge variant="secondary" className="text-[10px] ml-2">Min 2hrs charge</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 mb-4">
              <Label className="text-xs shrink-0">Hours needed:</Label>
              <Input
                type="number"
                min={1}
                step={0.5}
                value={calcHours}
                onChange={(e) => setCalcHours(Number(e.target.value))}
                className="w-24"
              />
              {calcHours < 2 && (
                <span className="text-[10px] text-amber-600 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Min 2hr charge applies
                </span>
              )}
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tier</TableHead>
                  <TableHead>Rate/hr</TableHead>
                  <TableHead>Billable Hours</TableHead>
                  <TableHead>Labor Cost</TableHead>
                  <TableHead>+ Travel (1hr)</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Emergency Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rateCards.filter((c: any) => c.is_active).map((card: any) => {
                  const billable = Math.max(calcHours, card.min_hours);
                  const labor = billable * Number(card.hourly_rate);
                  const travel = Number(card.travel_rate);
                  const total = labor + travel;
                  const emergency = total * Number(card.emergency_multiplier);
                  return (
                    <TableRow key={card.id}>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{card.level} — {card.level_name}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">${Number(card.hourly_rate).toFixed(2)}</TableCell>
                      <TableCell>{billable}h {calcHours < card.min_hours && <span className="text-[9px] text-amber-500">(min)</span>}</TableCell>
                      <TableCell className="font-medium">${labor.toFixed(2)}</TableCell>
                      <TableCell className="text-muted-foreground">${travel.toFixed(2)}</TableCell>
                      <TableCell className="font-bold text-card-foreground">${total.toFixed(2)}</TableCell>
                      <TableCell className="font-bold text-destructive">${emergency.toFixed(2)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* All Rate Cards Table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">All Rate Cards</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Level</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Min Hours</TableHead>
                  <TableHead>Hourly</TableHead>
                  <TableHead>Travel</TableHead>
                  <TableHead>Overtime</TableHead>
                  <TableHead>Emergency ×</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rateCards.map((card: any) => (
                  <TableRow key={card.id}>
                    <TableCell><Badge variant="outline">{card.level}</Badge></TableCell>
                    <TableCell className="font-medium">{card.level_name}</TableCell>
                    <TableCell>{card.min_hours}h</TableCell>
                    <TableCell>${Number(card.hourly_rate).toFixed(2)}</TableCell>
                    <TableCell>${Number(card.travel_rate).toFixed(2)}</TableCell>
                    <TableCell>${Number(card.overtime_rate).toFixed(2)}</TableCell>
                    <TableCell>{card.emergency_multiplier}×</TableCell>
                    <TableCell>
                      <Badge variant={card.is_active ? "default" : "secondary"}>
                        {card.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(card)}><Edit className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(card.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Create / Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editId ? "Edit Rate Card" : "Create Rate Card"}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 mt-2">
              {/* Dispatch Entity Selector */}
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                <Label className="text-xs font-semibold uppercase tracking-wider text-primary">Dispatch For *</Label>
                <p className="text-[11px] text-muted-foreground mb-2">Select the partner entity that will dispatch under this rate card.</p>
                <Select
                  value={form.partner_id || ""}
                  onValueChange={(v) => setForm({ ...form, partner_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select partner entity..." />
                  </SelectTrigger>
                  <SelectContent>
                    {partners.length === 0 && (
                      <div className="px-2 py-1.5 text-xs text-muted-foreground">No active partners — add one in Partners.</div>
                    )}
                    {partners.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>
                        <div className="flex items-center gap-2">
                          {p.logo_url ? (
                            <img src={p.logo_url} alt="" className="w-4 h-4 rounded object-contain bg-background" />
                          ) : (
                            <div className="w-4 h-4 rounded bg-muted text-[9px] flex items-center justify-center font-bold">
                              {p.company_name?.charAt(0)}
                            </div>
                          )}
                          <span>{p.company_name}</span>
                          {p.country && <span className="text-[10px] text-muted-foreground">· {p.country}</span>}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.partner_id && partnerById(form.partner_id)?.tax_number && (
                  <p className="mt-1.5 text-[10px] text-muted-foreground">
                    Tax #: <span className="font-mono">{partnerById(form.partner_id)?.tax_number}</span>
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Level</Label>
                  <Select value={form.level} onValueChange={(v) => setForm({ ...form, level: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="L1">L1 — Basic</SelectItem>
                      <SelectItem value="L2">L2 — Advanced</SelectItem>
                      <SelectItem value="L3">L3 — Expert</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Level Name *</Label>
                  <Input value={form.level_name} onChange={(e) => setForm({ ...form, level_name: e.target.value })} placeholder="e.g. Basic Support" />
                </div>
              </div>

              <div>
                <Label>Scope of Work Description</Label>
                <Textarea value={form.scope_of_work} onChange={(e) => setForm({ ...form, scope_of_work: e.target.value })} rows={2} placeholder="Describe what this tier covers..." />
              </div>

              {/* Scope items */}
              <div>
                <Label className="mb-1">Scope Items</Label>
                <div className="flex gap-2 mb-2">
                  <Input
                    value={newScopeTask}
                    onChange={(e) => setNewScopeTask(e.target.value)}
                    placeholder="Add scope item..."
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        e.stopPropagation();
                        addScopeItem();
                      }
                    }}
                  />
                  <Button type="button" size="sm" variant="outline" onClick={addScopeItem} disabled={!newScopeTask.trim()}>
                    <Plus className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {form.scope_items.length === 0 && (
                    <p className="text-[11px] text-muted-foreground italic px-1">No scope items yet — type a task and press Enter or click +</p>
                  )}
                  {form.scope_items.map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-1.5 rounded bg-muted/40 text-xs">
                      <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-emerald-500" />{item.task}</span>
                      <Button type="button" variant="ghost" size="icon" className="h-5 w-5" onClick={() => removeScopeItem(i)}><XCircle className="w-3 h-3" /></Button>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Rates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Min Hours *</Label>
                  <Input type="number" min={1} step={0.5} value={form.min_hours} onChange={(e) => setForm({ ...form, min_hours: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Hourly Rate ($) *</Label>
                  <Input type="number" min={0} step={5} value={form.hourly_rate} onChange={(e) => setForm({ ...form, hourly_rate: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Travel Rate ($)</Label>
                  <Input type="number" min={0} step={5} value={form.travel_rate} onChange={(e) => setForm({ ...form, travel_rate: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Overtime Rate ($)</Label>
                  <Input type="number" min={0} step={5} value={form.overtime_rate} onChange={(e) => setForm({ ...form, overtime_rate: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>After-Hours Rate ($/hr)</Label>
                  <Input type="number" min={0} step={5} value={form.after_hours_rate} onChange={(e) => setForm({ ...form, after_hours_rate: Number(e.target.value) })} placeholder="Outside business hours" />
                </div>
                <div>
                  <Label>Weekend Rate ($/hr)</Label>
                  <Input type="number" min={0} step={5} value={form.weekend_rate} onChange={(e) => setForm({ ...form, weekend_rate: Number(e.target.value) })} placeholder="Sat / Sun" />
                </div>
                <div>
                  <Label>Holiday Rate ($/hr)</Label>
                  <Input type="number" min={0} step={5} value={form.holiday_rate} onChange={(e) => setForm({ ...form, holiday_rate: Number(e.target.value) })} placeholder="Public holidays" />
                </div>
                <div>
                  <Label>Emergency Multiplier</Label>
                  <Input type="number" min={1} step={0.1} value={form.emergency_multiplier} onChange={(e) => setForm({ ...form, emergency_multiplier: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Currency</Label>
                  <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="GBP">GBP</SelectItem>
                      <SelectItem value="AED">AED</SelectItem>
                      <SelectItem value="INR">INR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Notes</Label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Internal notes..." />
              </div>

              <div className="flex items-center gap-2">
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                <Label>Active</Label>
              </div>

              {/* Preview */}
              <div className="bg-muted/50 rounded-lg p-3 border">
                <p className="text-xs font-semibold mb-1.5">Charge Preview (2hr min)</p>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div><span className="text-muted-foreground">2hr:</span> <span className="font-medium">${(Math.max(2, form.min_hours) * form.hourly_rate).toFixed(2)}</span></div>
                  <div><span className="text-muted-foreground">4hr:</span> <span className="font-medium">${(4 * form.hourly_rate).toFixed(2)}</span></div>
                  <div><span className="text-muted-foreground">8hr:</span> <span className="font-medium">${(8 * form.hourly_rate).toFixed(2)}</span></div>
                </div>
              </div>
            </div>

            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button
                onClick={() => saveMutation.mutate({ ...form, id: editId || undefined } as any)}
                disabled={!form.partner_id || !form.level_name || !form.hourly_rate || saveMutation.isPending}
              >
                {editId ? "Update" : "Create"} Rate Card
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default RateCards;
