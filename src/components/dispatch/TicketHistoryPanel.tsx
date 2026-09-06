import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Loader2, History, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type Entry = {
  id: string;
  ticket_id: string;
  changed_by: string | null;
  field: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
};

const FIELD_LABEL: Record<string, string> = {
  status: "Status",
  priority: "Priority",
  engineer_id: "Assigned Engineer",
  engineer_notes: "Engineer Notes",
};

export default function TicketHistoryPanel({ ticketId }: { ticketId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["dispatch-ticket-history", ticketId],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("dispatch_ticket_history" as any)
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const entries = (rows ?? []) as unknown as Entry[];

      // Resolve actor names
      const actorIds = Array.from(new Set(entries.map((e) => e.changed_by).filter(Boolean) as string[]));
      let nameMap: Record<string, string> = {};
      if (actorIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, full_name, email")
          .in("user_id", actorIds);
        nameMap = Object.fromEntries((profs ?? []).map((p: any) => [p.user_id, p.full_name || p.email || "Unknown"]));
      }

      // Resolve engineer ids -> names for engineer_id field changes
      const engIds = Array.from(
        new Set(
          entries
            .filter((e) => e.field === "engineer_id")
            .flatMap((e) => [e.old_value, e.new_value])
            .filter(Boolean) as string[]
        )
      );
      let engMap: Record<string, string> = {};
      if (engIds.length) {
        const { data: engs } = await supabase
          .from("engineers")
          .select("id, user_id, specialty")
          .in("id", engIds);
        const userIds = (engs ?? []).map((e: any) => e.user_id).filter(Boolean);
        let pm: Record<string, string> = {};
        if (userIds.length) {
          const { data: profs2 } = await supabase
            .from("profiles")
            .select("user_id, full_name")
            .in("user_id", userIds);
          pm = Object.fromEntries((profs2 ?? []).map((p: any) => [p.user_id, p.full_name]));
        }
        engMap = Object.fromEntries((engs ?? []).map((e: any) => [e.id, pm[e.user_id] || e.specialty || "Engineer"]));
      }

      return entries.map((e) => ({
        ...e,
        actor: e.changed_by ? nameMap[e.changed_by] ?? "Unknown user" : "System",
        old_display:
          e.field === "engineer_id"
            ? e.old_value
              ? engMap[e.old_value] ?? e.old_value
              : "Unassigned"
            : e.old_value ?? "—",
        new_display:
          e.field === "engineer_id"
            ? e.new_value
              ? engMap[e.new_value] ?? e.new_value
              : "Unassigned"
            : e.new_value ?? "—",
      }));
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading history…
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex items-center gap-2 text-sm text-destructive border border-destructive/40 bg-destructive/5 rounded-md p-3">
        <AlertTriangle className="h-4 w-4" /> Failed to load history: {(error as any).message}
      </div>
    );
  }
  if (!data || data.length === 0) {
    return (
      <div className="text-center text-sm text-muted-foreground py-8 flex flex-col items-center gap-2">
        <History className="h-5 w-5" />
        No changes recorded yet.
      </div>
    );
  }

  return (
    <ol className="relative border-l border-border pl-5 space-y-4">
      {data.map((e) => (
        <li key={e.id} className="relative">
          <span className="absolute -left-[7px] top-1.5 h-3 w-3 rounded-full bg-primary" />
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary" className="text-[10px]">{FIELD_LABEL[e.field] ?? e.field}</Badge>
            <span className="font-medium text-foreground">{e.actor}</span>
            <span>·</span>
            <span>{format(new Date(e.created_at), "PPp")}</span>
          </div>
          <p className="text-sm mt-1">
            {e.field === "engineer_notes" ? (
              <span className="text-muted-foreground italic">Notes updated</span>
            ) : (
              <>
                <span className="line-through text-muted-foreground">{e.old_display}</span>
                <span className="mx-1.5">→</span>
                <span className="font-medium">{e.new_display}</span>
              </>
            )}
          </p>
        </li>
      ))}
    </ol>
  );
}
