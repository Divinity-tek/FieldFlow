import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CalendarClock, Moon, Sun, CalendarDays, PartyPopper, Sunrise, ChevronDown, ChevronUp, Save } from "lucide-react";
import { toast } from "sonner";

type Prefs = {
  business_hours: boolean;
  business_start: string;
  business_end: string;
  business_days: number[];
  after_hours: boolean;
  nights: boolean;
  weekends: boolean;
  holidays: boolean;
  notes: string | null;
};

const DAYS = [
  { i: 1, label: "Mon" }, { i: 2, label: "Tue" }, { i: 3, label: "Wed" },
  { i: 4, label: "Thu" }, { i: 5, label: "Fri" }, { i: 6, label: "Sat" }, { i: 0, label: "Sun" },
];

const DEFAULTS: Prefs = {
  business_hours: true,
  business_start: "09:00",
  business_end: "17:00",
  business_days: [1, 2, 3, 4, 5],
  after_hours: false,
  nights: false,
  weekends: false,
  holidays: false,
  notes: "",
};

export default function AvailabilityShiftCard({ engineerId }: { engineerId: string }) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [dirty, setDirty] = useState(false);

  const { data } = useQuery({
    queryKey: ["eng-avail-prefs", engineerId],
    queryFn: async () => {
      const { data } = await supabase
        .from("engineer_availability_preferences")
        .select("*")
        .eq("engineer_id", engineerId)
        .maybeSingle();
      return data;
    },
    enabled: !!engineerId,
  });

  useEffect(() => {
    if (data) {
      setPrefs({
        business_hours: data.business_hours,
        business_start: (data.business_start as string).slice(0, 5),
        business_end: (data.business_end as string).slice(0, 5),
        business_days: data.business_days ?? [1, 2, 3, 4, 5],
        after_hours: data.after_hours,
        nights: data.nights,
        weekends: data.weekends,
        holidays: data.holidays,
        notes: data.notes ?? "",
      });
      setDirty(false);
    }
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = { engineer_id: engineerId, ...prefs, business_start: `${prefs.business_start}:00`, business_end: `${prefs.business_end}:00` };
      const { error } = await supabase
        .from("engineer_availability_preferences")
        .upsert(payload, { onConflict: "engineer_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Availability updated");
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["eng-avail-prefs", engineerId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Couldn't save"),
  });

  const update = <K extends keyof Prefs>(k: K, v: Prefs[K]) => {
    setPrefs((p) => ({ ...p, [k]: v }));
    setDirty(true);
  };

  const toggleDay = (i: number) => {
    const next = prefs.business_days.includes(i)
      ? prefs.business_days.filter((d) => d !== i)
      : [...prefs.business_days, i].sort();
    update("business_days", next);
  };

  const summary = [
    prefs.business_hours && "Business",
    prefs.after_hours && "After-hours",
    prefs.nights && "Nights",
    prefs.weekends && "Weekends",
    prefs.holidays && "Holidays",
  ].filter(Boolean).join(" · ") || "Not set";

  const Row = ({
    icon: Icon, title, subtitle, value, onChange, color,
  }: { icon: any; title: string; subtitle: string; value: boolean; onChange: (v: boolean) => void; color: string }) => (
    <div className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
      <div className="flex items-center gap-3 min-w-0">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="text-[11px] text-muted-foreground truncate">{subtitle}</p>
        </div>
      </div>
      <Switch checked={value} onCheckedChange={onChange} />
    </div>
  );

  return (
    <Card>
      <CardContent className="p-4">
        <button onClick={() => setExpanded((v) => !v)} className="w-full flex items-center justify-between gap-3 text-left">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <CalendarClock className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">Shift availability</p>
              <p className="text-[11px] text-muted-foreground truncate">{summary}</p>
            </div>
          </div>
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>

        {expanded && (
          <div className="mt-4 space-y-1">
            <Row
              icon={Sun} color="bg-amber-500/15 text-amber-600"
              title="Business hours" subtitle={`${prefs.business_start}–${prefs.business_end}, selected weekdays`}
              value={prefs.business_hours} onChange={(v) => update("business_hours", v)}
            />
            {prefs.business_hours && (
              <div className="pl-11 pb-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Start</Label>
                    <Input type="time" value={prefs.business_start} onChange={(e) => update("business_start", e.target.value)} className="h-8 text-xs" />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">End</Label>
                    <Input type="time" value={prefs.business_end} onChange={(e) => update("business_end", e.target.value)} className="h-8 text-xs" />
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {DAYS.map((d) => {
                    const on = prefs.business_days.includes(d.i);
                    return (
                      <button
                        key={d.i}
                        type="button"
                        onClick={() => toggleDay(d.i)}
                        className={`px-2 py-1 rounded-md text-[10px] font-medium border transition-colors ${
                          on ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border hover:bg-muted"
                        }`}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <Row icon={Sunrise} color="bg-orange-500/15 text-orange-600"
              title="After business hours" subtitle="Evenings outside your business window"
              value={prefs.after_hours} onChange={(v) => update("after_hours", v)} />

            <Row icon={Moon} color="bg-indigo-500/15 text-indigo-600"
              title="Nights" subtitle="Late-night calls (10pm – 6am)"
              value={prefs.nights} onChange={(v) => update("nights", v)} />

            <Row icon={CalendarDays} color="bg-blue-500/15 text-blue-600"
              title="Weekends" subtitle="Saturdays and Sundays"
              value={prefs.weekends} onChange={(v) => update("weekends", v)} />

            <Row icon={PartyPopper} color="bg-pink-500/15 text-pink-600"
              title="Public holidays" subtitle="Available on national holidays"
              value={prefs.holidays} onChange={(v) => update("holidays", v)} />

            <div className="pt-3">
              <Label className="text-[10px] text-muted-foreground">Notes (optional)</Label>
              <Input
                value={prefs.notes ?? ""} onChange={(e) => update("notes", e.target.value)}
                placeholder="e.g. No callouts on Fridays"
                className="h-8 text-xs"
              />
            </div>

            <div className="flex justify-end pt-3">
              <Button size="sm" onClick={() => save.mutate()} disabled={!dirty || save.isPending}>
                <Save className="w-3.5 h-3.5 mr-1.5" />
                {save.isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
