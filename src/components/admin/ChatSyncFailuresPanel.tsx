import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, RefreshCw, Check, X } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

type Failure = {
  id: string;
  room_id: string | null;
  message_id: string | null;
  ticket_id: string | null;
  op: string;
  error: string;
  attempts: number;
  status: string;
  last_attempt_at: string;
  created_at: string;
};

export default function ChatSyncFailuresPanel() {
  const qc = useQueryClient();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["chat-sync-failures"],
    queryFn: async (): Promise<Failure[]> => {
      const { data, error } = await supabase
        .from("chat_sync_failures" as any)
        .select("*")
        .order("last_attempt_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as any;
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("chat-sync-failures")
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_sync_failures" }, () => {
        qc.invalidateQueries({ queryKey: ["chat-sync-failures"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const pendingCount = (data ?? []).filter(f => f.status === "pending").length;

  const retry = async (id: string) => {
    const { data: res, error } = await supabase.rpc("retry_chat_sync" as any, { p_failure_id: id });
    if (error) { toast.error(error.message); return; }
    const r = res as any;
    if (r?.ok) toast.success("Sync retried successfully");
    else toast.error("Retry failed: " + (r?.error ?? "unknown"));
    refetch();
  };

  const resolve = async (id: string, status: "resolved" | "ignored") => {
    const { error } = await supabase.rpc("resolve_chat_sync_failure" as any, {
      p_failure_id: id, p_status: status,
    });
    if (error) { toast.error(error.message); return; }
    toast.success(status === "resolved" ? "Marked resolved" : "Ignored");
    refetch();
  };

  if (!isLoading && (data ?? []).length === 0) return null;

  return (
    <Card className={pendingCount > 0 ? "border-destructive/40" : ""}>
      <div className="p-4 flex items-center justify-between border-b">
        <div className="flex items-center gap-2">
          <AlertTriangle className={`h-5 w-5 ${pendingCount > 0 ? "text-destructive" : "text-muted-foreground"}`} />
          <h3 className="font-semibold">Sync failures</h3>
          {pendingCount > 0 && <Badge variant="destructive">{pendingCount} pending</Badge>}
        </div>
        <Button size="sm" variant="ghost" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
      <ScrollArea className="max-h-[320px]">
        {isLoading ? (
          <div className="p-4 text-sm text-muted-foreground">Loading...</div>
        ) : (
          <div className="divide-y">
            {(data ?? []).map(f => (
              <div key={f.id} className="p-3 flex items-start gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <Badge variant={
                      f.status === "pending" ? "destructive" :
                      f.status === "resolved" ? "default" : "secondary"
                    }>{f.status}</Badge>
                    <Badge variant="outline">{f.op}</Badge>
                    <span className="text-xs text-muted-foreground">attempt #{f.attempts}</span>
                    <span className="text-xs text-muted-foreground font-mono">
                      {format(new Date(f.last_attempt_at), "MMM d HH:mm:ss")}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground font-mono truncate">
                    msg {f.message_id?.slice(0, 8) ?? "—"} · ticket {f.ticket_id?.slice(0, 8) ?? "—"}
                  </div>
                  <div className="text-sm text-destructive mt-1 break-words">{f.error}</div>
                </div>
                {f.status === "pending" && (
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="sm" variant="default" onClick={() => retry(f.id)}>
                      <RefreshCw className="h-3.5 w-3.5 mr-1" />Retry
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => resolve(f.id, "resolved")}>
                      <Check className="h-3.5 w-3.5 mr-1" />Resolve
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => resolve(f.id, "ignored")}>
                      <X className="h-3.5 w-3.5 mr-1" />Ignore
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </Card>
  );
}
