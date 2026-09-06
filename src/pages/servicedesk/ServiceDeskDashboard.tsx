import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Headphones, Ticket, Briefcase, Users, AlertCircle, Clock, Inbox, PlusCircle } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

const priorityVariant: Record<string, "default" | "destructive" | "secondary" | "outline"> = {
  urgent: "destructive",
  high: "destructive",
  medium: "default",
  low: "secondary",
};

const ServiceDeskDashboard = () => {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: myTickets = [] } = useQuery({
    queryKey: ["sd-my-tickets", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("tickets")
        .select("id, subject, status, priority, created_at, client_id, clients(company_name)")
        .eq("assigned_to", user!.id)
        .in("status", ["open", "in_progress"])
        .order("created_at", { ascending: false })
        .limit(25);
      return data ?? [];
    },
  });

  const { data: unassigned = [] } = useQuery({
    queryKey: ["sd-unassigned"],
    queryFn: async () => {
      const { data } = await supabase
        .from("tickets")
        .select("id, subject, status, priority, created_at, client_id, clients(company_name)")
        .is("assigned_to", null)
        .in("status", ["open", "in_progress"])
        .order("created_at", { ascending: false })
        .limit(25);
      return data ?? [];
    },
  });

  const { data: resolvedToday = 0 } = useQuery({
    queryKey: ["sd-resolved-today", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const { count } = await supabase
        .from("tickets")
        .select("id", { count: "exact", head: true })
        .eq("assigned_to", user!.id)
        .eq("status", "resolved")
        .gte("resolved_at", start.toISOString());
      return count ?? 0;
    },
  });

  const stats = useMemo(() => ([
    { label: "My open tickets", value: myTickets.length, icon: Ticket, tone: "text-primary" },
    { label: "Unassigned in queue", value: unassigned.length, icon: Inbox, tone: "text-orange-500" },
    { label: "Resolved by me today", value: resolvedToday, icon: AlertCircle, tone: "text-green-500" },
    { label: "Avg first response", value: "—", icon: Clock, tone: "text-muted-foreground" },
  ]), [myTickets.length, unassigned.length, resolvedToday]);

  const claim = async (id: string) => {
    if (!user?.id) return;
    const { error } = await supabase.from("tickets").update({ assigned_to: user.id, status: "in_progress" }).eq("id", id);
    if (error) {
      toast.error("Could not claim ticket: " + error.message);
      return;
    }
    toast.success("Ticket claimed");
    qc.invalidateQueries({ queryKey: ["sd-unassigned"] });
    qc.invalidateQueries({ queryKey: ["sd-my-tickets"] });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <Headphones className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Service Desk</h1>
            <p className="text-sm text-muted-foreground">Inbound support queue, intake, and client lookup</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline"><Link to="/helpdesk"><PlusCircle className="h-4 w-4 mr-1" />New ticket</Link></Button>
          <Button asChild size="sm" variant="outline"><Link to="/jobs"><Briefcase className="h-4 w-4 mr-1" />Job intake</Link></Button>
          <Button asChild size="sm" variant="outline"><Link to="/crm"><Users className="h-4 w-4 mr-1" />Find client</Link></Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className={`h-8 w-8 ${s.tone}`} />
              <div>
                <div className="text-2xl font-semibold">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">My queue</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {myTickets.length === 0 && <p className="text-sm text-muted-foreground">No open tickets assigned to you.</p>}
            {myTickets.map((t: any) => (
              <Link to="/helpdesk" key={t.id} className="block rounded-md border p-3 hover:bg-accent transition">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{t.subject}</div>
                    <div className="text-xs text-muted-foreground">
                      {t.clients?.company_name ?? "—"} · {formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}
                    </div>
                  </div>
                  <Badge variant={priorityVariant[t.priority] ?? "default"}>{t.priority}</Badge>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Unassigned queue</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {unassigned.length === 0 && <p className="text-sm text-muted-foreground">Queue is empty. Nice work.</p>}
            {unassigned.map((t: any) => (
              <div key={t.id} className="rounded-md border p-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">{t.subject}</div>
                  <div className="text-xs text-muted-foreground">
                    {t.clients?.company_name ?? "—"} · {formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={priorityVariant[t.priority] ?? "default"}>{t.priority}</Badge>
                  <Button size="sm" onClick={() => claim(t.id)}>Claim</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ServiceDeskDashboard;
