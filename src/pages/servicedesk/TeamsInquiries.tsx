import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Inbox, Send, Ticket as TicketIcon, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";

type Inquiry = {
  id: string;
  source: string;
  sender_name: string | null;
  sender_email: string | null;
  subject: string | null;
  body: string | null;
  service_category: string | null;
  country: string | null;
  status: string;
  error_message: string | null;
  ticket_id: string | null;
  matched_client_id: string | null;
  matched_job_id: string | null;
  created_at: string;
};

const empty = {
  sender_name: "",
  sender_email: "",
  subject: "",
  body: "",
  service_category: "",
  country: "",
  region: "",
  city: "",
  client_hint: "",
  job_reference: "",
  priority: "medium",
  category: "support",
};

const statusBadge = (s: string) => {
  if (s === "processed") return <Badge className="bg-emerald-600">processed</Badge>;
  if (s === "failed") return <Badge variant="destructive">failed</Badge>;
  if (s === "skipped") return <Badge variant="secondary">skipped</Badge>;
  return <Badge variant="outline">{s}</Badge>;
};

const TeamsInquiries = () => {
  const qc = useQueryClient();
  const [form, setForm] = useState(empty);
  const [sending, setSending] = useState(false);

  const { data: inquiries = [] } = useQuery({
    queryKey: ["teams-inquiries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teams_inquiries")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as Inquiry[];
    },
  });

  const counts = inquiries.reduce(
    (acc, i) => {
      acc.total++;
      if (i.status === "processed") acc.processed++;
      else if (i.status === "failed") acc.failed++;
      else if (i.status === "skipped") acc.skipped++;
      return acc;
    },
    { total: 0, processed: 0, failed: 0, skipped: 0 }
  );

  const submit = async () => {
    if (!form.subject && !form.body) {
      toast.error("Provide a subject or body");
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("teams-inquiry-ingest", {
        body: { ...form, source: "manual" },
      });
      if (error) throw error;
      const status = (data as any)?.status ?? "ok";
      if (status === "processed") toast.success("Ticket created from inquiry");
      else if (status === "skipped") toast.warning("Inquiry recorded but no client match");
      else toast.message(`Inquiry ${status}`);
      setForm(empty);
      qc.invalidateQueries({ queryKey: ["teams-inquiries"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to ingest inquiry");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Inbox className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Teams Inquiries → Tickets</h1>
          <p className="text-sm text-muted-foreground">
            Inbound chat inquiries are matched to clients & jobs and turned into support tickets
            automatically.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total</p><p className="text-2xl font-bold">{counts.total}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Tickets created</p><p className="text-2xl font-bold text-emerald-600">{counts.processed}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Skipped (no client)</p><p className="text-2xl font-bold">{counts.skipped}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Failed</p><p className="text-2xl font-bold text-destructive">{counts.failed}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Simulate / manual intake</CardTitle>
          <CardDescription>
            Posts to the same edge function the Teams poller will call once Teams is connected.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><Label>Sender name</Label><Input value={form.sender_name} onChange={(e) => setForm({ ...form, sender_name: e.target.value })} /></div>
          <div><Label>Sender email</Label><Input value={form.sender_email} onChange={(e) => setForm({ ...form, sender_email: e.target.value })} placeholder="used to match the client" /></div>
          <div className="md:col-span-2"><Label>Subject</Label><Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></div>
          <div className="md:col-span-2"><Label>Message</Label><Textarea rows={4} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></div>
          <div><Label>Client hint (company)</Label><Input value={form.client_hint} onChange={(e) => setForm({ ...form, client_hint: e.target.value })} /></div>
          <div><Label>Job reference / ID</Label><Input value={form.job_reference} onChange={(e) => setForm({ ...form, job_reference: e.target.value })} /></div>
          <div><Label>Service category</Label><Input value={form.service_category} onChange={(e) => setForm({ ...form, service_category: e.target.value })} /></div>
          <div><Label>Country</Label><Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} /></div>
          <div><Label>Region</Label><Input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} /></div>
          <div><Label>City</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
          <div className="md:col-span-2">
            <Button onClick={submit} disabled={sending}>
              <Send className="h-4 w-4 mr-1" />
              {sending ? "Ingesting…" : "Ingest inquiry"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent inquiries</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {inquiries.length === 0 && (
            <p className="text-sm text-muted-foreground">No inquiries yet.</p>
          )}
          {inquiries.map((i) => (
            <div key={i.id} className="border rounded-md p-3 space-y-1">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  {i.status === "processed" ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  ) : i.status === "failed" ? (
                    <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                  ) : (
                    <Inbox className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                  <span className="font-medium truncate">{i.subject || "(no subject)"}</span>
                  {statusBadge(i.status)}
                  <Badge variant="outline">{i.source}</Badge>
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(i.created_at), { addSuffix: true })}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                from {i.sender_name ?? "—"} {i.sender_email ? `<${i.sender_email}>` : ""}
                {i.service_category ? ` · ${i.service_category}` : ""}
                {i.country ? ` · ${i.country}` : ""}
              </p>
              {i.body && <p className="text-sm line-clamp-2">{i.body}</p>}
              <div className="flex flex-wrap gap-2 pt-1">
                {i.ticket_id && (
                  <Button asChild size="sm" variant="outline">
                    <Link to="/helpdesk">
                      <TicketIcon className="h-3 w-3 mr-1" /> View ticket
                    </Link>
                  </Button>
                )}
                {i.matched_client_id && (
                  <Badge variant="secondary">client matched</Badge>
                )}
                {i.matched_job_id && (
                  <Badge variant="secondary">job linked</Badge>
                )}
                {i.error_message && (
                  <span className="text-xs text-destructive">{i.error_message}</span>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default TeamsInquiries;
