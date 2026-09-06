import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Package } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";

const CURRENCIES = ["USD", "EUR", "GBP", "INR", "AUD", "CAD", "AED"];

const empty = {
  name: "", description: "", category: "", sku: "",
  unit_price: "0", default_quantity: "1",
  default_tax_rate: "0", default_discount_percent: "0",
  currency: "USD", is_active: true,
};

export default function PricingPresets() {
  const qc = useQueryClient();
  const { isAdmin, isTeamLead } = useUserRole();
  const canManage = isAdmin || isTeamLead;
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(empty);
  const [search, setSearch] = useState("");

  const { data: presets = [] } = useQuery({
    queryKey: ["pricing-presets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pricing_presets" as any).select("*")
        .order("category", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Name is required");
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        category: form.category.trim() || null,
        sku: form.sku.trim() || null,
        unit_price: parseFloat(form.unit_price) || 0,
        default_quantity: parseFloat(form.default_quantity) || 1,
        default_tax_rate: parseFloat(form.default_tax_rate) || 0,
        default_discount_percent: parseFloat(form.default_discount_percent) || 0,
        currency: form.currency,
        is_active: form.is_active,
      };
      if (editingId) {
        const { error } = await supabase.from("pricing_presets" as any).update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("pricing_presets" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pricing-presets"] });
      toast.success(editingId ? "Preset updated" : "Preset created");
      reset();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pricing_presets" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pricing-presets"] });
      toast.success("Preset deleted");
    },
  });

  const reset = () => { setOpen(false); setEditingId(null); setForm(empty); };

  const openEdit = (p: any) => {
    setEditingId(p.id);
    setForm({
      name: p.name, description: p.description || "", category: p.category || "", sku: p.sku || "",
      unit_price: String(p.unit_price), default_quantity: String(p.default_quantity),
      default_tax_rate: String(p.default_tax_rate), default_discount_percent: String(p.default_discount_percent),
      currency: p.currency, is_active: p.is_active,
    });
    setOpen(true);
  };

  const filtered = presets.filter((p: any) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return [p.name, p.description, p.category, p.sku].filter(Boolean).join(" ").toLowerCase().includes(q);
  });

  const fmtMoney = (a: number, c: string) =>
    new Intl.NumberFormat(undefined, { style: "currency", currency: c || "USD" }).format(a || 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <Package className="w-4 h-4 text-primary" /> Pricing Presets
          <Badge variant="outline">{presets.length}</Badge>
        </CardTitle>
        <div className="flex gap-2">
          <Input placeholder="Search…" className="h-9 w-48" value={search} onChange={(e) => setSearch(e.target.value)} />
          {canManage && (
            <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); else setOpen(true); }}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2"><Plus className="w-3 h-3" /> Add Preset</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader><DialogTitle>{editingId ? "Edit" : "New"} Pricing Preset</DialogTitle></DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="md:col-span-2">
                    <Label>Name *</Label>
                    <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={150} />
                  </div>
                  <div>
                    <Label>Category</Label>
                    <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. Installation" maxLength={80} />
                  </div>
                  <div>
                    <Label>SKU</Label>
                    <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} maxLength={80} />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Description</Label>
                    <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={500} />
                  </div>
                  <div>
                    <Label>Unit Price</Label>
                    <Input type="number" min={0} step="0.01" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} />
                  </div>
                  <div>
                    <Label>Currency</Label>
                    <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Default Qty</Label>
                    <Input type="number" min={0} step="0.01" value={form.default_quantity} onChange={(e) => setForm({ ...form, default_quantity: e.target.value })} />
                  </div>
                  <div>
                    <Label>Default Tax %</Label>
                    <Input type="number" min={0} step="0.1" value={form.default_tax_rate} onChange={(e) => setForm({ ...form, default_tax_rate: e.target.value })} />
                  </div>
                  <div>
                    <Label>Default Discount %</Label>
                    <Input type="number" min={0} max={100} step="0.1" value={form.default_discount_percent} onChange={(e) => setForm({ ...form, default_discount_percent: e.target.value })} />
                  </div>
                  <div className="flex items-center gap-2 pt-6">
                    <input id="active" type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
                    <Label htmlFor="active">Active</Label>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={reset}>Cancel</Button>
                  <Button onClick={() => save.mutate()} disabled={save.isPending}>
                    {save.isPending ? "Saving…" : editingId ? "Save" : "Create"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">No presets yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase">Name</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase">Category</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase">SKU</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground uppercase">Unit</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground uppercase">Tax/Disc</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground uppercase">Status</th>
                  {canManage && <th className="text-right px-3 py-2"></th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p: any) => (
                  <tr key={p.id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="px-3 py-2 font-medium">
                      {p.name}
                      {p.description && <div className="text-xs text-muted-foreground line-clamp-1">{p.description}</div>}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{p.category || "—"}</td>
                    <td className="px-3 py-2 font-mono text-xs">{p.sku || "—"}</td>
                    <td className="px-3 py-2 text-right">{fmtMoney(Number(p.unit_price), p.currency)}</td>
                    <td className="px-3 py-2 text-right text-xs">{Number(p.default_tax_rate)}% / {Number(p.default_discount_percent)}%</td>
                    <td className="px-3 py-2 text-right">
                      <Badge variant="outline" className={p.is_active ? "bg-green-500/10 text-green-500" : "bg-muted"}>
                        {p.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    {canManage && (
                      <td className="px-3 py-2 text-right">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(p)}><Pencil className="w-3 h-3" /></Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => { if (confirm("Delete preset?")) remove.mutate(p.id); }}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
