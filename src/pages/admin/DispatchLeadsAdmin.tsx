import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  AlertCircle, Building2, Calendar, Clock, DollarSign, Filter,
  Loader2, MapPin, Phone, RefreshCw, Save, Search, User,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type LeadStatus = "new" | "contacted" | "quoted" | "won" | "lost" | "spam";

interface Lead {
  id: string;
  full_name: string;
  email: string;
  company: string;
  phone: string | null;
  site_address: string;
  site_city: string;
  site_postal_code: string;
  site_country: string;
  site_contact: string | null;
  site_access_notes: string | null;
  service_level: "L1" | "L2" | "L3";
  sla: string;
  duration_estimate: string | null;
  preferred_date: string;
  preferred_window: string;
  scope: string;
  status: LeadStatus;
  internal_notes: string | null;
  estimated_turnaround_minutes: number | null;
  quoted_amount: number | null;
  quoted_currency: string;
  quoted_at: string | null;
  won_at: string | null;
  lost_at: string | null;
  closed_at: string | null;
  lost_reason: string | null;
  created_at: string;
  updated_at: string;
}

const SLA_LABEL: Record<string, string> = {
  p1_4h: "P1 · 4h",
  same_day: "Same day",
  next_business_day: "Next BD",
  "48_72h": "48–72h",
  scheduled: "Scheduled",
};

const STATUS_STYLE: Record<LeadStatus, string> = {
  new: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  contacted: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  quoted: "bg-purple-500/15 text-purple-600 border-purple-500/30",
  won: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  lost: "bg-rose-500/15 text-rose-600 border-rose-500/30",
  spam: "bg-muted text-muted-foreground border-border",
};

const STATUS_LABEL: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  quoted: "Quoted",
  won: "Won",
  lost: "Lost",
  spam: "Spam",
};

function formatTurnaround(mins: number | null) {
  if (mins == null) return "—";
  if (mins < 60) return `${mins} min`;
  if (mins < 60 * 24) return `${(mins / 60).toFixed(mins % 60 === 0 ? 0 : 1)} hr`;
  return `${(mins / (60 * 24)).toFixed(1)} d`;
}

export default function DispatchLeadsAdmin() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState<LeadStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [serviceFilter, setServiceFilter] = useState<"all" | "L1" | "L2" | "L3">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: leads, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["dispatch-leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dispatch_leads")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as Lead[];
    },
    refetchInterval: 60_000,
  });

  const stats = useMemo(() => {
    const all = leads ?? [];
    const open = all.filter((l) => !["won", "lost", "spam"].includes(l.status));
    const won = all.filter((l) => l.status === "won");
    const quoted = all.filter((l) => l.status === "quoted");
    const totalQuotedValue = quoted.reduce((s, l) => s + (l.quoted_amount ?? 0), 0);
    const totalWonValue = won.reduce((s, l) => s + (l.quoted_amount ?? 0), 0);
    const closedDeals = all.filter((l) => l.status === "won" || l.status === "lost");
    const winRate = closedDeals.length > 0 ? Math.round((won.length / closedDeals.length) * 100) : null;
    const avgTurnaround = (() => {
      const vals = all.map((l) => l.estimated_turnaround_minutes).filter((v): v is number => v != null);
      if (!vals.length) return null;
      return Math.round(vals.reduce((s, v) => s + v, 0) / vals.length);
    })();
    return { total: all.length, open: open.length, won: won.length, quoted: quoted.length,
      winRate, totalQuotedValue, totalWonValue, avgTurnaround };
  }, [leads]);

  const filtered = useMemo(() => {
    const all = leads ?? [];
    return all.filter((l) => {
      if (tab !== "all" && l.status !== tab) return false;
      if (serviceFilter !== "all" && l.service_level !== serviceFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = `${l.full_name} ${l.email} ${l.company} ${l.site_city} ${l.site_country} ${l.scope}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [leads, tab, serviceFilter, search]);

  const selected = leads?.find((l) => l.id === selectedId) ?? null;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[1600px] mx-auto px-6 py-8">
        <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-display font-bold tracking-tight text-foreground">Dispatch requests</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Review new availability requests, set turnaround commitments, and track quotes through to closure.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Refresh
          </Button>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
          <KpiCard label="Open" value={stats.open} hint={`${stats.total} total`} />
          <KpiCard label="Quoted" value={stats.quoted} />
          <KpiCard label="Won" value={stats.won} />
          <KpiCard label="Win rate" value={stats.winRate == null ? "—" : `${stats.winRate}%`} />
          <KpiCard label="Avg turnaround" value={formatTurnaround(stats.avgTurnaround)} />
          <KpiCard label="Won value" value={`$${(stats.totalWonValue || 0).toLocaleString()}`} hint={`$${stats.totalQuotedValue.toLocaleString()} in pipeline`} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] gap-6">
          {/* List */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
                <TabsList>
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="new">New</TabsTrigger>
                  <TabsTrigger value="contacted">Contacted</TabsTrigger>
                  <TabsTrigger value="quoted">Quoted</TabsTrigger>
                  <TabsTrigger value="won">Won</TabsTrigger>
                  <TabsTrigger value="lost">Lost</TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="ml-auto flex items-center gap-2">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search company, city, scope…"
                    className="pl-8 h-9 w-64"
                  />
                </div>
                <Select value={serviceFilter} onValueChange={(v) => setServiceFilter(v as any)}>
                  <SelectTrigger className="h-9 w-[110px]"><Filter className="w-3.5 h-3.5 mr-1" /><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All levels</SelectItem>
                    <SelectItem value="L1">L1 only</SelectItem>
                    <SelectItem value="L2">L2 only</SelectItem>
                    <SelectItem value="L3">L3 only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {isLoading ? (
              <div className="py-20 text-center text-sm text-muted-foreground">
                <Loader2 className="w-5 h-5 mx-auto animate-spin mb-2" /> Loading requests…
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-20 text-center text-sm text-muted-foreground border border-dashed border-border rounded-xl">
                <AlertCircle className="w-5 h-5 mx-auto mb-2" /> No dispatch requests match your filters.
              </div>
            ) : (
              <div className="border border-border rounded-xl overflow-hidden">
                {filtered.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => setSelectedId(l.id)}
                    className={`w-full text-left p-4 border-b border-border last:border-b-0 hover:bg-muted/40 transition-colors ${
                      selectedId === l.id ? "bg-muted/60" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <Badge variant="outline" className={`${STATUS_STYLE[l.status]} font-medium`}>
                            {STATUS_LABEL[l.status]}
                          </Badge>
                          <Badge variant="outline" className="font-mono">{l.service_level}</Badge>
                          <Badge variant="secondary">{SLA_LABEL[l.sla] ?? l.sla}</Badge>
                          {l.estimated_turnaround_minutes != null && (
                            <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {formatTurnaround(l.estimated_turnaround_minutes)}
                            </span>
                          )}
                          {l.quoted_amount != null && (
                            <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                              <DollarSign className="w-3 h-3" /> {l.quoted_currency} {Number(l.quoted_amount).toLocaleString()}
                            </span>
                          )}
                        </div>
                        <div className="font-semibold text-foreground truncate">{l.company}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {l.full_name} · {l.email} · {l.site_city}, {l.site_country}
                        </div>
                      </div>
                      <div className="text-right text-[11px] text-muted-foreground shrink-0">
                        {formatDistanceToNow(new Date(l.created_at), { addSuffix: true })}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Detail */}
          <div className="lg:sticky lg:top-6 lg:self-start">
            {selected ? (
              <LeadDetail
                key={selected.id}
                lead={selected}
                onSaved={() => qc.invalidateQueries({ queryKey: ["dispatch-leads"] })}
                toast={toast}
              />
            ) : (
              <Card>
                <CardContent className="py-16 text-center text-sm text-muted-foreground">
                  Select a request to view details, set turnaround, log quotes and update status.
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
        <div className="text-2xl font-display font-bold text-foreground mt-1">{value}</div>
        {hint && <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>}
      </CardContent>
    </Card>
  );
}

function LeadDetail({
  lead, onSaved, toast,
}: {
  lead: Lead;
  onSaved: () => void;
  toast: ReturnType<typeof useToast>["toast"];
}) {
  const [draft, setDraft] = useState({
    status: lead.status,
    estimated_turnaround_minutes: lead.estimated_turnaround_minutes ?? "",
    quoted_amount: lead.quoted_amount ?? "",
    quoted_currency: lead.quoted_currency || "USD",
    internal_notes: lead.internal_notes ?? "",
    lost_reason: lead.lost_reason ?? "",
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const patch = {
        status: draft.status,
        estimated_turnaround_minutes:
          draft.estimated_turnaround_minutes === "" ? null : Number(draft.estimated_turnaround_minutes),
        quoted_amount: draft.quoted_amount === "" ? null : Number(draft.quoted_amount),
        quoted_currency: draft.quoted_currency || "USD",
        internal_notes: draft.internal_notes || null,
        lost_reason: draft.status === "lost" ? draft.lost_reason || null : null,
      };
      const { error } = await supabase.from("dispatch_leads").update(patch as any).eq("id", lead.id);
      if (error) throw error;
      toast({ title: "Saved", description: "Dispatch request updated." });
      onSaved();
    } catch (e: any) {
      toast({ title: "Couldn't save", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-base flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={`${STATUS_STYLE[lead.status]} font-medium`}>
                {STATUS_LABEL[lead.status]}
              </Badge>
              <span className="truncate">{lead.company}</span>
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Submitted {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })}
              {" · "}Ref {lead.id.slice(0, 8).toUpperCase()}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Contact + site */}
        <div className="space-y-2 text-sm">
          <Row icon={<User className="w-3.5 h-3.5" />}>
            <span className="font-medium text-foreground">{lead.full_name}</span>
            <a className="text-primary hover:underline ml-2" href={`mailto:${lead.email}`}>{lead.email}</a>
          </Row>
          {lead.phone && (
            <Row icon={<Phone className="w-3.5 h-3.5" />}>
              <a className="text-primary hover:underline" href={`tel:${lead.phone}`}>{lead.phone}</a>
            </Row>
          )}
          <Row icon={<Building2 className="w-3.5 h-3.5" />}>{lead.company}</Row>
          <Row icon={<MapPin className="w-3.5 h-3.5" />}>
            {lead.site_address}, {lead.site_city} {lead.site_postal_code}, {lead.site_country}
            {lead.site_contact && <span className="block text-muted-foreground text-xs">Site contact: {lead.site_contact}</span>}
          </Row>
          <Row icon={<Calendar className="w-3.5 h-3.5" />}>
            {lead.preferred_date} · {lead.preferred_window}
            {lead.duration_estimate && <span className="text-muted-foreground"> · {lead.duration_estimate}</span>}
          </Row>
          <div className="flex gap-2 pt-1">
            <Badge variant="outline" className="font-mono">{lead.service_level}</Badge>
            <Badge variant="secondary">{SLA_LABEL[lead.sla] ?? lead.sla}</Badge>
          </div>
        </div>

        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Scope of work</Label>
          <div className="mt-1.5 text-sm text-foreground whitespace-pre-wrap rounded-md bg-muted/40 border border-border p-3">
            {lead.scope}
          </div>
          {lead.site_access_notes && (
            <p className="text-xs text-muted-foreground mt-2">
              <span className="font-medium">Access notes:</span> {lead.site_access_notes}
            </p>
          )}
        </div>

        {/* Editable fields */}
        <div className="space-y-3 pt-2 border-t border-border">
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={draft.status} onValueChange={(v) => setDraft({ ...draft, status: v as LeadStatus })}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="contacted">Contacted</SelectItem>
                <SelectItem value="quoted">Quoted</SelectItem>
                <SelectItem value="won">Won</SelectItem>
                <SelectItem value="lost">Lost</SelectItem>
                <SelectItem value="spam">Spam</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Estimated turnaround (minutes)</Label>
            <Input
              type="number"
              min={0}
              value={draft.estimated_turnaround_minutes}
              onChange={(e) => setDraft({ ...draft, estimated_turnaround_minutes: e.target.value })}
              placeholder="e.g. 60"
              className="mt-1"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              {draft.estimated_turnaround_minutes !== "" &&
                `Promised: ${formatTurnaround(Number(draft.estimated_turnaround_minutes))}`}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <Label className="text-xs">Quote amount</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={draft.quoted_amount}
                onChange={(e) => setDraft({ ...draft, quoted_amount: e.target.value })}
                placeholder="0.00"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Currency</Label>
              <Input
                value={draft.quoted_currency}
                onChange={(e) => setDraft({ ...draft, quoted_currency: e.target.value.toUpperCase().slice(0, 3) })}
                className="mt-1"
              />
            </div>
          </div>

          {draft.status === "lost" && (
            <div>
              <Label className="text-xs">Lost reason</Label>
              <Input
                value={draft.lost_reason}
                onChange={(e) => setDraft({ ...draft, lost_reason: e.target.value })}
                placeholder="Price, timing, went with incumbent…"
                className="mt-1"
              />
            </div>
          )}

          <div>
            <Label className="text-xs">Internal notes</Label>
            <Textarea
              rows={3}
              value={draft.internal_notes}
              onChange={(e) => setDraft({ ...draft, internal_notes: e.target.value })}
              placeholder="Coordinator notes, follow-up actions…"
              className="mt-1"
            />
          </div>

          {/* Lifecycle timestamps */}
          <div className="text-[11px] text-muted-foreground space-y-0.5 pt-1 border-t border-border">
            {lead.quoted_at && <div>Quoted {formatDistanceToNow(new Date(lead.quoted_at), { addSuffix: true })}</div>}
            {lead.won_at && <div className="text-emerald-600">Won {formatDistanceToNow(new Date(lead.won_at), { addSuffix: true })}</div>}
            {lead.lost_at && <div className="text-rose-600">Lost {formatDistanceToNow(new Date(lead.lost_at), { addSuffix: true })}</div>}
          </div>

          <Button onClick={save} disabled={saving} className="w-full">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save changes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Row({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="text-muted-foreground mt-0.5">{icon}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
