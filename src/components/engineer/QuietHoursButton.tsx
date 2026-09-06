import { useState } from "react";
import { BellOff, Clock, Moon } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useUserPreference } from "@/hooks/useUserPreference";
import {
  DEFAULT_QUIET_HOURS,
  isQuietNow,
  QUIET_HOURS_PREF_KEY,
  type QuietHoursPrefs,
} from "@/lib/quietHours";

export default function QuietHoursButton() {
  const { value: prefs, update } = useUserPreference<QuietHoursPrefs>(
    QUIET_HOURS_PREF_KEY,
    DEFAULT_QUIET_HOURS,
  );
  const [open, setOpen] = useState(false);

  const quietNow = isQuietNow(prefs);
  const Icon = prefs.enabled && quietNow ? BellOff : Moon;

  const set = (patch: Partial<QuietHoursPrefs>) => update({ ...prefs, ...patch });

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Quiet hours settings"
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition ${
            prefs.enabled
              ? quietNow
                ? "bg-primary/10 text-primary border-primary/30"
                : "bg-muted text-foreground border-border"
              : "bg-background text-muted-foreground border-border hover:text-foreground"
          }`}
        >
          <Icon className="w-3.5 h-3.5" />
          {prefs.enabled
            ? quietNow
              ? `Quiet · until ${prefs.end}`
              : `Quiet ${prefs.start}–${prefs.end}`
            : "Quiet hours"}
        </button>
      </SheetTrigger>

      <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-2">
            <Moon className="w-5 h-5 text-primary" />
            Quiet hours for SLA alerts
          </SheetTitle>
          <SheetDescription>
            Silence toast and push notifications during your preferred hours. Critical alerts can
            still come through.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-5 space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label htmlFor="qh-enabled" className="text-sm font-medium">
                Enable quiet hours
              </Label>
              <p className="text-xs text-muted-foreground">
                {prefs.enabled
                  ? quietNow
                    ? "You're currently in a quiet window."
                    : "Active outside your quiet window."
                  : "All SLA alerts are delivered."}
              </p>
            </div>
            <Switch
              id="qh-enabled"
              checked={prefs.enabled}
              onCheckedChange={(v) => set({ enabled: v })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="qh-start" className="text-xs text-muted-foreground">
                Start
              </Label>
              <Input
                id="qh-start"
                type="time"
                value={prefs.start}
                onChange={(e) => set({ start: e.target.value })}
                disabled={!prefs.enabled}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qh-end" className="text-xs text-muted-foreground">
                End
              </Label>
              <Input
                id="qh-end"
                type="time"
                value={prefs.end}
                onChange={(e) => set({ end: e.target.value })}
                disabled={!prefs.enabled}
              />
            </div>
          </div>

          <div className="flex items-start justify-between gap-4 rounded-lg border bg-muted/40 p-3">
            <div className="space-y-0.5">
              <Label htmlFor="qh-critical" className="text-sm font-medium">
                Allow critical alerts
              </Label>
              <p className="text-xs text-muted-foreground">
                SLA breaches and dispatch cancellations bypass quiet hours.
              </p>
            </div>
            <Switch
              id="qh-critical"
              checked={prefs.allowCritical}
              onCheckedChange={(v) => set({ allowCritical: v })}
              disabled={!prefs.enabled}
            />
          </div>

          <p className="text-[10px] text-muted-foreground/80 flex items-center gap-1.5">
            <Clock className="w-3 h-3" />
            Times use your device's local timezone. Overnight windows (e.g. 22:00–07:00) are
            supported.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
