import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ShieldCheck, CheckCircle2, XCircle, Clock, Loader2, DollarSign, MapPin } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type EngineerApplication = {
  id: string;
  user_id: string;
  specialty: string;
  skills: string[];
  hourly_rate: number | null;
  location: string | null;
  application_status: "pending" | "approved" | "rejected";
  application_review_note: string | null;
  application_reviewed_at: string | null;
  application_submitted_at: string | null;
};

const statusBadge = (s: string) => {
  if (s === "approved") return <Badge className="gap-1 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-0"><CheckCircle2 className="w-3 h-3" /> Approved</Badge>;
  if (s === "rejected") return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" /> Rejected</Badge>;
  return <Badge variant="secondary" className="gap-1"><Clock className="w-3 h-3" /> Pending</Badge>;
};

export default function EngineerApprovals() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"pending" | "approved" | "rejected">("pending");
  const [reviewing, setReviewing] = useState<EngineerApplication | null>(null);
  const [decision, setDecision] = useState<"approved" | "rejected">("approved");
  const [note, setNote] = useState("");
  const [documentsReviewed, setDocumentsReviewed] = useState(false);

  const { data: applications = [], isLoading } = useQuery({
    queryKey: ["admin-engineer-approvals", tab],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("engineers")
        .select("id,user_id,specialty,skills,hourly_rate,location,application_status,application_review_note,application_reviewed_at,application_submitted_at")
        .eq("application_status", tab)
        .order("application_submitted_at", { ascending: false, nullsFirst: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as EngineerApplication[];
    },
  });

  const userIds = useMemo(() => applications.map((a) => a.user_id), [applications]);
  const { data: profilesMap = {} } = useQuery({
    queryKey: ["admin-engineer-approvals-profiles", userIds.join(",")],
    queryFn: async () => {
      if (!userIds.length) return {};
      const { data } = await supabase.from("profiles").select("user_id,full_name,email").in("user_id", userIds);
      const map: Record<string, { full_name: string | null; email: string | null }> = {};
      (data ?? []).forEach((p: any) => { map[p.user_id] = { full_name: p.full_name, email: p.email }; });
      return map;
    },
    enabled: userIds.length > 0,
  });

  const counts = useQuery({
    queryKey: ["admin-engineer-approvals-counts"],
    queryFn: async () => {
      const r: Record<string, number> = { pending: 0, approved: 0, rejected: 0 };
      for (const s of ["pending", "approved", "rejected"] as const) {
        const { count } = await supabase
          .from("engineers")
          .select("id", { count: "exact", head: true })
          .eq("application_status", s);
        r[s] = count ?? 0;
      }
      return r;
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async () => {
      if (!reviewing) return;
      if (decision === "approved" && !documentsReviewed) {
        throw new Error("Please review the engineer's documents before approval");
      }
      if (decision === "rejected" && note.trim().length < 5) {
        throw new Error("Please add a note explaining the rejection (min 5 chars)");
      }
      const { data, error } = await supabase
        .from("engineers")
        .update({
          application_status: decision,
          application_review_note: note.trim() || null,
          application_reviewed_by: user?.id ?? null,
          application_reviewed_at: new Date().toISOString(),
          documents_reviewed: decision === "approved" ? documentsReviewed : false,
          // Approving also flips them available so they start showing up for jobs.
          is_available: decision === "approved" ? true : false,
        } as any)
        .eq("id", reviewing.id)
        .select("id, application_status")
        .maybeSingle();
      if (error) throw error;
      // Supabase/Postgres RLS silently updates 0 rows instead of erroring when
      // the current user's UPDATE policy doesn't match — surface that here
      // instead of showing a false "success" toast.
      if (!data) {
        throw new Error(
          "Update was blocked (0 rows changed). This usually means your account's role isn't covered by the engineers UPDATE policy — confirm you're signed in as an admin and that the latest migrations are applied."
        );
      }
    },
    onSuccess: () => {
      toast.success(`Application ${decision}`);
      queryClient.invalidateQueries({ queryKey: ["admin-engineer-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["admin-engineer-approvals-counts"] });
      setReviewing(null);
      setNote("");
      setDocumentsReviewed(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to save review"),
  });

  const openReview = (a: EngineerApplication, d: "approved" | "rejected") => {
    setReviewing(a);
    setDecision(d);
    setDocumentsReviewed(false);
    setNote(a.application_review_note ?? "");
  };

  return (
    <AppLayout title="Engineer Approvals" subtitle="Review new engineer applications">
      <div className="space-y-4">
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList>
            <TabsTrigger value="pending" className="gap-2">
              <Clock className="w-3.5 h-3.5" /> Pending
              <Badge variant="secondary" className="ml-1">{counts.data?.pending ?? 0}</Badge>
            </TabsTrigger>
            <TabsTrigger value="approved" className="gap-2">
              <CheckCircle2 className="w-3.5 h-3.5" /> Approved
              <Badge variant="secondary" className="ml-1">{counts.data?.approved ?? 0}</Badge>
            </TabsTrigger>
            <TabsTrigger value="rejected" className="gap-2">
              <XCircle className="w-3.5 h-3.5" /> Rejected
              <Badge variant="secondary" className="ml-1">{counts.data?.rejected ?? 0}</Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value={tab} className="mt-4 space-y-4">
            {isLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading…
              </div>
            )}
            {!isLoading && applications.length === 0 && (
              <Card>
                <CardContent className="p-10 text-center text-sm text-muted-foreground">
                  <ShieldCheck className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  No {tab} applications.
                </CardContent>
              </Card>
            )}
            {applications.map((a) => {
              const prof = profilesMap[a.user_id];
              return (
                <Card key={a.id}>
                  <CardHeader className="pb-2 flex-row items-start justify-between gap-2 space-y-0">
                    <div>
                      <CardTitle className="text-base">{prof?.full_name ?? "Unnamed engineer"}</CardTitle>
                      <p className="text-xs text-muted-foreground">{prof?.email ?? "—"}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {a.application_submitted_at
                          ? `Submitted ${formatDistanceToNow(new Date(a.application_submitted_at), { addSuffix: true })}`
                          : "Not submitted yet"}
                        {a.application_reviewed_at && ` · reviewed ${formatDistanceToNow(new Date(a.application_reviewed_at), { addSuffix: true })}`}
                      </p>
                    </div>
                    {statusBadge(a.application_status)}
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      <Badge variant="outline">{a.specialty}</Badge>
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <DollarSign className="w-3.5 h-3.5" /> {a.hourly_rate ?? "—"}/hr
                      </span>
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <MapPin className="w-3.5 h-3.5" /> {a.location ?? "—"}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {(a.skills ?? []).map((s) => (
                        <Badge key={s} variant="secondary" className="text-[11px]">{s}</Badge>
                      ))}
                    </div>
                    {a.application_review_note && (
                      <div className="rounded-md border border-border p-2.5 bg-muted/30 text-xs">
                        <span className="font-semibold text-foreground">Admin note: </span>
                        <span className="text-muted-foreground">{a.application_review_note}</span>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2 justify-end">
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => openReview(a, "rejected")}>
                        <XCircle className="w-3.5 h-3.5" /> Reject
                      </Button>
                      <Button size="sm" className="gap-1" onClick={() => openReview(a, "approved")}>
                        <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!reviewing} onOpenChange={(v) => { if (!v) setReviewing(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {decision === "approved" ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-destructive" />}
              {decision === "approved" ? "Approve application" : "Reject application"}
            </DialogTitle>
            <DialogDescription>
              {profilesMap[reviewing?.user_id ?? ""]?.full_name ?? "Engineer"}
              {decision === "rejected" && " — please explain so they know what to fix."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-md border border-border bg-muted/25 p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-foreground">Document review</span>
                <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={documentsReviewed}
                    onChange={(e) => setDocumentsReviewed(e.target.checked)}
                    disabled={decision === "rejected"}
                  />
                  Documents reviewed
                </label>
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                Review ID documents, supporting proof, and the NDA evidence before approving an engineer.
              </p>
            </div>
            <label className="text-xs font-medium text-muted-foreground">
              Admin note {decision === "rejected" ? "(required)" : "(optional)"}
            </label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              rows={4}
              placeholder={decision === "approved" ? "Welcome aboard!" : "Please add more detail to your skills / service area."}
            />
            <p className="text-[11px] text-muted-foreground text-right">{note.length}/500</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewing(null)} disabled={reviewMutation.isPending}>Cancel</Button>
            <Button
              variant={decision === "rejected" ? "destructive" : "default"}
              onClick={() => reviewMutation.mutate()}
              disabled={reviewMutation.isPending}
            >
              {reviewMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : decision === "approved" ? "Approve" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

