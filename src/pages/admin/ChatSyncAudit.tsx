import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Play, Pause, RotateCcw, AlertTriangle, CheckCircle2, MessageSquare, ArrowRight, Clock, Paperclip } from "lucide-react";
import { format, formatDistanceStrict } from "date-fns";
import ChatSyncFailuresPanel from "@/components/admin/ChatSyncFailuresPanel";

type SyncRow = {
  log_id: string;
  log_created_at: string;
  ticket_id: string;
  actor_id: string | null;
  action: string;
  note: string | null;
  source_message_id: string | null;
  msg_id: string | null;
  msg_created_at: string | null;
  msg_content: string | null;
  msg_metadata: any;
  msg_is_deleted: boolean | null;
  ticket_subject: string | null;
  actor_name: string | null;
};

const PAGE_SIZE = 200;

export default function ChatSyncAudit() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "synced" | "missing" | "deleted" | "slow">("all");
  const [replayIdx, setReplayIdx] = useState<number | null>(null);
  const [replaying, setReplaying] = useState(false);
  const replayRef = useRef<number | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["chat-sync-audit"],
    queryFn: async (): Promise<SyncRow[]> => {
      const { data: logs, error } = await supabase
        .from("ticket_activity_log")
        .select("id, created_at, ticket_id, actor_id, action, note, source_message_id")
        .in("action", ["chat_reply", "chat_reply_deleted", "chat_reply_edited"])
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);
      if (error) throw error;

      const msgIds = (logs ?? []).map(l => l.source_message_id).filter(Boolean) as string[];
      const ticketIds = Array.from(new Set((logs ?? []).map(l => l.ticket_id)));
      const actorIds = Array.from(new Set((logs ?? []).map(l => l.actor_id).filter(Boolean) as string[]));

      const [{ data: msgs }, { data: tickets }, { data: profiles }] = await Promise.all([
        msgIds.length
          ? supabase.from("chat_room_messages").select("id, created_at, content, metadata, is_deleted").in("id", msgIds)
          : Promise.resolve({ data: [] as any[] }),
        ticketIds.length
          ? supabase.from("tickets").select("id, subject").in("id", ticketIds)
          : Promise.resolve({ data: [] as any[] }),
        actorIds.length
          ? supabase.from("profiles").select("id, full_name").in("id", actorIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const msgMap = new Map((msgs ?? []).map((m: any) => [m.id, m]));
      const tMap = new Map((tickets ?? []).map((t: any) => [t.id, t]));
      const pMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

      return (logs ?? []).map(l => {
        const m = l.source_message_id ? msgMap.get(l.source_message_id) : null;
        return {
          log_id: l.id,
          log_created_at: l.created_at,
          ticket_id: l.ticket_id,
          actor_id: l.actor_id,
          action: l.action,
          note: l.note,
          source_message_id: l.source_message_id,
          msg_id: m?.id ?? null,
          msg_created_at: m?.created_at ?? null,
          msg_content: m?.content ?? null,
          msg_metadata: m?.metadata ?? null,
          msg_is_deleted: m?.is_deleted ?? null,
          ticket_subject: tMap.get(l.ticket_id)?.subject ?? null,
          actor_name: l.actor_id ? (pMap.get(l.actor_id)?.full_name ?? null) : null,
        } as SyncRow;
      });
    },
  });

  const enriched = useMemo(() => {
    return (data ?? []).map(r => {
      const lagMs = r.msg_created_at
        ? new Date(r.log_created_at).getTime() - new Date(r.msg_created_at).getTime()
        : null;
      const status: "synced" | "missing" | "deleted" | "slow" =
        !r.source_message_id ? "missing"
        : !r.msg_id ? "missing"
        : r.msg_is_deleted ? "deleted"
        : (lagMs ?? 0) > 5000 ? "slow"
        : "synced";
      return { ...r, lagMs, status };
    });
  }, [data]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return enriched.filter(r => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!s) return true;
      return (
        r.ticket_id.toLowerCase().includes(s) ||
        (r.ticket_subject ?? "").toLowerCase().includes(s) ||
        (r.actor_name ?? "").toLowerCase().includes(s) ||
        (r.note ?? "").toLowerCase().includes(s) ||
        (r.msg_content ?? "").toLowerCase().includes(s) ||
        (r.source_message_id ?? "").toLowerCase().includes(s) ||
        r.action.toLowerCase().includes(s)
      );
    });
  }, [enriched, search, statusFilter]);

  // Replay
  useEffect(() => {
    if (!replaying) return;
    if (replayIdx === null) {
      setReplayIdx(filtered.length - 1);
      return;
    }
    if (replayIdx < 0) {
      setReplaying(false);
      return;
    }
    replayRef.current = window.setTimeout(() => {
      setReplayIdx(i => (i === null ? null : i - 1));
    }, 700);
    return () => {
      if (replayRef.current) window.clearTimeout(replayRef.current);
    };
  }, [replaying, replayIdx, filtered.length]);

  const startReplay = () => {
    setReplayIdx(filtered.length - 1);
    setReplaying(true);
  };
  const pauseReplay = () => setReplaying(false);
  const resetReplay = () => {
    setReplaying(false);
    setReplayIdx(null);
  };

  const counts = useMemo(() => {
    const c = { synced: 0, slow: 0, missing: 0, deleted: 0 };
    enriched.forEach(r => { c[r.status]++; });
    return c;
  }, [enriched]);

  return (
    <AppLayout title="Chat ↔ Activity Sync Audit" subtitle="Search and replay ticket chat synchronization events">
      <div className="space-y-4">
        <ChatSyncFailuresPanel />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">Synced</div>
            <div className="text-2xl font-semibold flex items-center gap-2 text-primary">
              <CheckCircle2 className="h-5 w-5" />{counts.synced}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">Slow (&gt;5s)</div>
            <div className="text-2xl font-semibold flex items-center gap-2 text-amber-500">
              <Clock className="h-5 w-5" />{counts.slow}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">Missing source</div>
            <div className="text-2xl font-semibold flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />{counts.missing}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">Deleted msg</div>
            <div className="text-2xl font-semibold flex items-center gap-2 text-muted-foreground">
              <MessageSquare className="h-5 w-5" />{counts.deleted}
            </div>
          </Card>
        </div>

        <Card className="p-4 flex flex-col md:flex-row md:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search ticket, subject, actor, content, message id..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
            <SelectTrigger className="w-full md:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All states</SelectItem>
              <SelectItem value="synced">Synced</SelectItem>
              <SelectItem value="slow">Slow</SelectItem>
              <SelectItem value="missing">Missing</SelectItem>
              <SelectItem value="deleted">Deleted</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            {!replaying ? (
              <Button size="sm" variant="default" onClick={startReplay} disabled={!filtered.length}>
                <Play className="h-4 w-4 mr-1" />Replay
              </Button>
            ) : (
              <Button size="sm" variant="secondary" onClick={pauseReplay}>
                <Pause className="h-4 w-4 mr-1" />Pause
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={resetReplay}>
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={() => refetch()}>Refresh</Button>
          </div>
        </Card>

        <Card>
          <ScrollArea className="h-[640px]">
            {isLoading ? (
              <div className="p-6 text-muted-foreground">Loading sync events...</div>
            ) : filtered.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">No matching sync events.</div>
            ) : (
              <div className="divide-y">
                {filtered.map((r, i) => {
                  const inReplay = replayIdx !== null && i >= replayIdx;
                  const opacity = replayIdx === null ? 1 : inReplay ? 1 : 0.25;
                  const highlight = i === replayIdx;
                  const attachments = Array.isArray(r.msg_metadata?.attachments) ? r.msg_metadata.attachments : [];
                  return (
                    <div
                      key={r.log_id}
                      className={`p-4 transition ${highlight ? "bg-primary/10 ring-1 ring-primary/30" : "hover:bg-muted/40"}`}
                      style={{ opacity }}
                    >
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <Badge variant={
                              r.status === "synced" ? "default" :
                              r.status === "slow" ? "secondary" :
                              r.status === "deleted" ? "outline" : "destructive"
                            }>
                              {r.status}
                            </Badge>
                            <Badge variant="outline">{r.action}</Badge>
                            {r.lagMs !== null && (
                              <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                lag {formatLag(r.lagMs)}
                              </span>
                            )}
                            {attachments.length > 0 && (
                              <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                                <Paperclip className="h-3 w-3" />{attachments.length}
                              </span>
                            )}
                          </div>
                          <div className="text-sm font-medium truncate">
                            {r.ticket_subject ?? "(no subject)"}
                            <span className="text-xs text-muted-foreground ml-2 font-mono">#{r.ticket_id.slice(0, 8)}</span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            by {r.actor_name ?? "unknown"}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-xs text-muted-foreground">log</div>
                          <div className="text-xs font-mono">{format(new Date(r.log_created_at), "HH:mm:ss.SSS")}</div>
                          <div className="text-[10px] text-muted-foreground">{format(new Date(r.log_created_at), "MMM d, yyyy")}</div>
                        </div>
                      </div>

                      <div className="mt-3 grid md:grid-cols-2 gap-3">
                        <div className="rounded-md border p-2 bg-muted/20">
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                            <span className="inline-flex items-center gap-1"><MessageSquare className="h-3 w-3" />chat message</span>
                            {r.msg_created_at && (
                              <span className="font-mono">{format(new Date(r.msg_created_at), "HH:mm:ss.SSS")}</span>
                            )}
                          </div>
                          <div className="text-sm whitespace-pre-wrap break-words line-clamp-4">
                            {r.msg_content ?? <span className="italic text-muted-foreground">{r.msg_id ? "(empty)" : "source message not found"}</span>}
                          </div>
                          {attachments.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {attachments.slice(0, 4).map((a: any, idx: number) => (
                                <a key={idx} href={a.url} target="_blank" rel="noreferrer"
                                   className="text-[11px] px-2 py-0.5 rounded bg-background border hover:bg-accent truncate max-w-[160px]">
                                  {a.name ?? a.type ?? "attachment"}
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="rounded-md border p-2 bg-muted/20">
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                            <span className="inline-flex items-center gap-1"><ArrowRight className="h-3 w-3" />activity log</span>
                            <span className="font-mono">{format(new Date(r.log_created_at), "HH:mm:ss.SSS")}</span>
                          </div>
                          <div className="text-sm whitespace-pre-wrap break-words line-clamp-4">
                            {r.note ?? <span className="italic text-muted-foreground">(no note)</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </Card>
      </div>
    </AppLayout>
  );
}

function formatLag(ms: number) {
  if (ms < 0) return "—";
  if (ms < 1000) return `${ms}ms`;
  return formatDistanceStrict(0, ms);
}
