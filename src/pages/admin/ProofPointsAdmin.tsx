import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProofPoints, type ProofPoint } from "@/hooks/useProofPoints";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { PROOF_POINT_ICON_NAMES, getProofPointIcon } from "@/lib/proofPointIcons";
import { ArrowDown, ArrowUp, Loader2, Plus, Save, Trash2 } from "lucide-react";

interface DraftRow extends Omit<ProofPoint, "id"> {
  id?: string;
  _dirty?: boolean;
  _saving?: boolean;
}

export default function ProofPointsAdmin() {
  const { data, isLoading, refetch } = useProofPoints({ includeInactive: true });
  const qc = useQueryClient();
  const { toast } = useToast();
  const [drafts, setDrafts] = useState<Record<string, DraftRow>>({});

  const rows: DraftRow[] = (data ?? []).map((r) => drafts[r.id] ?? r);
  const newRows = Object.values(drafts).filter((d) => !d.id);

  const update = (id: string, patch: Partial<DraftRow>) => {
    setDrafts((prev) => {
      const base = prev[id] ?? data?.find((r) => r.id === id);
      if (!base) return prev;
      return { ...prev, [id]: { ...base, ...patch, _dirty: true } };
    });
  };

  const addNew = () => {
    const tmp = `new-${Date.now()}`;
    setDrafts((prev) => ({
      ...prev,
      [tmp]: {
        icon: "TrendingUp",
        value: "",
        label: "",
        sub: "",
        sort_order: ((data?.length ?? 0) + Object.keys(drafts).length + 1) * 10,
        is_active: true,
        _dirty: true,
      },
    }));
  };

  const save = async (key: string, row: DraftRow) => {
    if (!row.value.trim() || !row.label.trim()) {
      toast({ title: "Value and label are required", variant: "destructive" });
      return;
    }
    setDrafts((prev) => ({ ...prev, [key]: { ...row, _saving: true } }));
    const payload = {
      icon: row.icon,
      value: row.value,
      label: row.label,
      sub: row.sub,
      sort_order: row.sort_order,
      is_active: row.is_active,
    };
    const { error } = row.id
      ? await supabase.from("proof_points").update(payload).eq("id", row.id)
      : await supabase.from("proof_points").insert(payload);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      setDrafts((prev) => ({ ...prev, [key]: { ...row, _saving: false } }));
      return;
    }
    toast({ title: "Saved" });
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    qc.invalidateQueries({ queryKey: ["proof-points"] });
    refetch();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this proof point?")) return;
    const { error } = await supabase.from("proof_points").delete().eq("id", id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Deleted" });
    qc.invalidateQueries({ queryKey: ["proof-points"] });
    refetch();
  };

  const reorder = async (id: string, direction: -1 | 1) => {
    const list = [...(data ?? [])].sort((a, b) => a.sort_order - b.sort_order);
    const idx = list.findIndex((r) => r.id === id);
    const swap = list[idx + direction];
    if (!swap) return;
    const a = list[idx];
    await Promise.all([
      supabase.from("proof_points").update({ sort_order: swap.sort_order }).eq("id", a.id),
      supabase.from("proof_points").update({ sort_order: a.sort_order }).eq("id", swap.id),
    ]);
    qc.invalidateQueries({ queryKey: ["proof-points"] });
    refetch();
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Landing proof points</h1>
          <p className="text-sm text-muted-foreground">
            Edit the stat cards shown in the “Hands & Feet delivery results” section of the landing page.
          </p>
        </div>
        <Button onClick={addNew}>
          <Plus className="w-4 h-4" /> Add proof point
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
        </div>
      ) : (
        <div className="space-y-3">
          {[...rows, ...newRows].map((row, i) => {
            const key = row.id ?? `new-${i}`;
            const Icon = getProofPointIcon(row.icon);
            return (
              <Card key={key} className={row._dirty ? "border-primary/40" : ""}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-3">
                    <span className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                      <Icon className="w-4 h-4 text-primary" />
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">#{row.sort_order}</span>
                    <span className="truncate">{row.label || <em className="text-muted-foreground">(new)</em>}</span>
                    {!row.is_active && (
                      <span className="ml-auto text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-muted text-muted-foreground">
                        Hidden
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                  <div className="md:col-span-3">
                    <Label className="text-xs">Value</Label>
                    <Input
                      value={row.value}
                      placeholder="e.g. 99.2%"
                      onChange={(e) => update(key, { value: e.target.value })}
                    />
                  </div>
                  <div className="md:col-span-3">
                    <Label className="text-xs">Label</Label>
                    <Input
                      value={row.label}
                      placeholder="e.g. SLA compliance"
                      onChange={(e) => update(key, { label: e.target.value })}
                    />
                  </div>
                  <div className="md:col-span-4">
                    <Label className="text-xs">Subtitle</Label>
                    <Input
                      value={row.sub ?? ""}
                      placeholder="Short description"
                      onChange={(e) => update(key, { sub: e.target.value })}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-xs">Icon</Label>
                    <Select value={row.icon} onValueChange={(v) => update(key, { icon: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent className="max-h-72">
                        {PROOF_POINT_ICON_NAMES.map((n) => (
                          <SelectItem key={n} value={n}>{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="md:col-span-2">
                    <Label className="text-xs">Sort order</Label>
                    <Input
                      type="number"
                      value={row.sort_order}
                      onChange={(e) => update(key, { sort_order: Number(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="md:col-span-3 flex items-center gap-3 pb-2">
                    <Switch
                      checked={row.is_active}
                      onCheckedChange={(v) => update(key, { is_active: v })}
                      id={`active-${key}`}
                    />
                    <Label htmlFor={`active-${key}`} className="text-xs cursor-pointer">
                      Show on landing page
                    </Label>
                  </div>

                  <div className="md:col-span-7 flex items-center justify-end gap-2 flex-wrap">
                    {row.id && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => reorder(row.id!, -1)} aria-label="Move up">
                          <ArrowUp className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => reorder(row.id!, 1)} aria-label="Move down">
                          <ArrowDown className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => remove(row.id!)}>
                          <Trash2 className="w-4 h-4" /> Delete
                        </Button>
                      </>
                    )}
                    <Button
                      size="sm"
                      disabled={!row._dirty || row._saving}
                      onClick={() => save(key, row)}
                    >
                      {row._saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Save
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
