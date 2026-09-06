import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Activity, Search } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function AuditLogs() {
  const [search, setSearch] = useState("");

  const { data: logs, isLoading } = useQuery({
    queryKey: ["audit-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
  });

  const filtered = logs?.filter(l =>
    !search ||
    l.action.toLowerCase().includes(search.toLowerCase()) ||
    l.entity_type.toLowerCase().includes(search.toLowerCase()) ||
    (l.user_email ?? "").toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  return (
    <AppLayout title="Audit Logs" subtitle="Searchable timeline of every action across the platform">
      <div className="space-y-6">

        <Card className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by action, entity, or user..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </Card>

        <Card>
          <ScrollArea className="h-[600px]">
            {isLoading ? (
              <div className="p-6 text-muted-foreground">Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">No audit events recorded yet.</div>
            ) : (
              <div className="divide-y">
                {filtered.map((log) => (
                  <div key={log.id} className="p-4 hover:bg-muted/50 transition">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline">{log.action}</Badge>
                          <Badge variant="secondary">{log.entity_type}</Badge>
                          {log.entity_id && <code className="text-xs text-muted-foreground">{log.entity_id.slice(0, 8)}</code>}
                        </div>
                        <p className="text-sm mt-1 text-muted-foreground">
                          {log.user_email ?? "system"}
                        </p>
                        {log.changes && (
                          <pre className="text-xs mt-2 p-2 bg-muted rounded overflow-x-auto max-w-2xl">
                            {JSON.stringify(log.changes, null, 2).slice(0, 300)}
                          </pre>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </Card>
      </div>
    </AppLayout>
  );
}
