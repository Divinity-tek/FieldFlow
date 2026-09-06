import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Wrench, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useCurrency } from "@/contexts/CurrencyContext";

interface Part {
  id: string;
  description: string;
  qty: number;
  unit: string | null;
  unit_cost: number | null;
}

interface Props { jobId: string; engineerId: string }

export default function PartsUsedList({ jobId, engineerId }: Props) {
  const qc = useQueryClient();
  const { format: fmt } = useCurrency();
  const [desc, setDesc] = useState("");
  const [qty, setQty] = useState("1");
  const [cost, setCost] = useState("");
  const [adding, setAdding] = useState(false);

  const { data: parts = [] } = useQuery({
    queryKey: ["job-parts", jobId],
    queryFn: async () => {
      const { data } = await supabase
        .from("job_parts_used")
        .select("id,description,qty,unit,unit_cost")
        .eq("job_id", jobId)
        .order("created_at", { ascending: true });
      return (data ?? []) as Part[];
    },
  });

  const add = async () => {
    if (!desc.trim()) return toast.error("Describe the part");
    setAdding(true);
    const { error } = await supabase.from("job_parts_used").insert({
      job_id: jobId,
      engineer_id: engineerId,
      description: desc.trim(),
      qty: parseFloat(qty) || 1,
      unit_cost: cost ? parseFloat(cost) : null,
    });
    setAdding(false);
    if (error) return toast.error(error.message);
    setDesc(""); setQty("1"); setCost("");
    qc.invalidateQueries({ queryKey: ["job-parts", jobId] });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("job_parts_used").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["job-parts", jobId] });
  };

  const total = parts.reduce((s, p) => s + (Number(p.qty) * Number(p.unit_cost ?? 0)), 0);

  return (
    <Card className="border-border/60">
      <CardContent className="p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wrench className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Parts & materials</span>
          </div>
          {total > 0 && <span className="text-xs text-muted-foreground">{fmt(total)}</span>}
        </div>

        {parts.length > 0 && (
          <ul className="space-y-1.5">
            {parts.map((p) => (
              <li key={p.id} className="flex items-center gap-2 text-sm">
                <span className="flex-1 truncate">{p.description}</span>
                <span className="text-xs text-muted-foreground">×{p.qty}</span>
                {p.unit_cost != null && <span className="text-xs text-muted-foreground">{fmt(Number(p.unit_cost))}</span>}
                <button onClick={() => remove(p.id)} className="text-muted-foreground hover:text-destructive p-1">
                  <Trash2 className="w-3 h-3" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="grid grid-cols-12 gap-1.5">
          <Input className="col-span-6 h-9" placeholder="Part / material" value={desc} onChange={(e) => setDesc(e.target.value)} />
          <Input className="col-span-2 h-9" type="number" min="0" step="0.5" value={qty} onChange={(e) => setQty(e.target.value)} />
          <Input className="col-span-3 h-9" type="number" min="0" step="0.01" placeholder="Cost" value={cost} onChange={(e) => setCost(e.target.value)} />
          <Button size="sm" className="col-span-1 h-9 px-0" onClick={add} disabled={adding}>
            {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
