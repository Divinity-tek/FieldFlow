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
import { Shield, CheckCircle2, XCircle, Clock, ExternalLink, Loader2, FileText } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type Engineer = {
  id: string;
  user_id: string;
  identity_selfie_url: string | null;
  id_card_url: string | null;
  identity_status: "pending" | "approved" | "rejected";
  identity_review_note: string | null;
  identity_reviewed_at: string | null;
  identity_submitted_at: string | null;
  profiles?: { full_name: string | null; email: string | null } | null;
};

const statusBadge = (s: string) => {
  if (s === "approved") return <Badge className="gap-1 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-0"><CheckCircle2 className="w-3 h-3" /> Approved</Badge>;
  if (s === "rejected") return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" /> Rejected</Badge>;
  return <Badge variant="secondary" className="gap-1"><Clock className="w-3 h-3" /> Pending</Badge>;
};

const SignedThumb = ({ path, label }: { path: string | null; label: string }) => {
  const { data } = useQuery({
    queryKey: ["id-doc", path],
    queryFn: async () => {
      if (!path) return null;
      // Short-lived signed URL (2 min) — must be re-fetched if reviewer takes longer
      const { data } = await supabase.storage.from("engineer-documents").createSignedUrl(path, 120);
      return data?.signedUrl ?? null;
    },
    enabled: !!path,
    staleTime: 90_000,
    gcTime: 90_000,
  });

  if (!path) {
    return (
      <div className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
        {label}: not uploaded
      </div>
    );
  }
  const isPdf = path.toLowerCase().endsWith(".pdf");
  return (
    <div className="rounded-md border border-border overflow-hidden">
      <div className="px-3 py-1.5 bg-muted/40 flex items-center justify-between">
        <span className="text-xs font-medium">{label}</span>
        {data && (
          <a href={data} target="_blank" rel="noreferrer" className="text-xs inline-flex items-center gap-1 text-primary hover:underline">
            <ExternalLink className="w-3 h-3" /> Open
          </a>
        )}
      </div>
      <div className="bg-muted/20 flex items-center justify-center min-h-32">
        {!data ? (
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        ) : isPdf ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground p-4">
            <FileText className="w-4 h-4" /> PDF document
          </div>
        ) : (
          <img src={data} alt={label} className="max-h-56 w-full object-contain" />
        )}
      </div>
    </div>
  );
};

export default function IdentityVerification() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"pending" | "approved" | "rejected">("pending");
  const [reviewing, setReviewing] = useState<Engineer | null>(null);
  const [decision, setDecision] = useState<"approved" | "rejected">("approved");
  const [note, setNote] = useState("");

  const { data: engineers = [], isLoading } = useQuery({
    queryKey: ["admin-id-verification", tab],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("engineers")
        .select("id,user_id,identity_selfie_url,id_card_url,identity_status,identity_review_note,identity_reviewed_at,identity_submitted_at")
        .eq("identity_status", tab)
        .order("identity_submitted_at", { ascending: false, nullsFirst: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as Engineer[];
    },
  });

  // Hydrate profiles in case the join wasn't possible
  const userIds = useMemo(() => engineers.map((e) => e.user_id), [engineers]);
  const { data: profilesMap = {} } = useQuery({
    queryKey: ["admin-id-verification-profiles", userIds.join(",")],
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
    queryKey: ["admin-id-verification-counts"],
    queryFn: async () => {
      const r: Record<string, number> = { pending: 0, approved: 0, rejected: 0 };
      for (const s of ["pending", "approved", "rejected"] as const) {
        const { count } = await supabase
          .from("engineers")
          .select("id", { count: "exact", head: true })
          .eq("identity_status", s);
        r[s] = count ?? 0;
      }
      return r;
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async () => {
      if (!reviewing) return;
      if (decision === "rejected" && note.trim().length < 5) {
        throw new Error("Please add a note explaining the rejection (min 5 chars)");
      }
      const { error } = await supabase
        .from("engineers")
        .update({
          identity_status: decision,
          identity_review_note: note.trim() || null,
          identity_reviewed_by: user?.id ?? null,
          identity_reviewed_at: new Date().toISOString(),
        } as any)
        .eq("id", reviewing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Identity ${decision}`);
      queryClient.invalidateQueries({ queryKey: ["admin-id-verification"] });
      queryClient.invalidateQueries({ queryKey: ["admin-id-verification-counts"] });
      setReviewing(null);
      setNote("");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to save review"),
  });

  const openReview = (e: Engineer, d: "approved" | "rejected") => {
    setReviewing(e);
    setDecision(d);
    setNote(e.identity_review_note ?? "");
  };

  return (
    <AppLayout title="Identity Verification" subtitle="Review engineer identity submissions">
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
            {!isLoading && engineers.length === 0 && (
              <Card>
                <CardContent className="p-10 text-center text-sm text-muted-foreground">
                  <Shield className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  No {tab} submissions.
                </CardContent>
              </Card>
            )}
            {engineers.map((e) => {
              const prof = e.profiles ?? profilesMap[e.user_id];
              const hasDocs = e.identity_selfie_url || e.id_card_url;
              return (
                <Card key={e.id}>
                  <CardHeader className="pb-2 flex-row items-start justify-between gap-2 space-y-0">
                    <div>
                      <CardTitle className="text-base">{prof?.full_name ?? "Unnamed engineer"}</CardTitle>
                      <p className="text-xs text-muted-foreground">{prof?.email ?? "—"}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {e.identity_submitted_at
                          ? `Submitted ${formatDistanceToNow(new Date(e.identity_submitted_at), { addSuffix: true })}`
                          : "Not submitted yet"}
                        {e.identity_reviewed_at && ` · reviewed ${formatDistanceToNow(new Date(e.identity_reviewed_at), { addSuffix: true })}`}
                      </p>
                    </div>
                    {statusBadge(e.identity_status)}
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <SignedThumb path={e.identity_selfie_url} label="Identity selfie" />
                      <SignedThumb path={e.id_card_url} label="ID card" />
                    </div>
                    {e.identity_review_note && (
                      <div className="rounded-md border border-border p-2.5 bg-muted/30 text-xs">
                        <span className="font-semibold text-foreground">Admin note: </span>
                        <span className="text-muted-foreground">{e.identity_review_note}</span>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2 justify-end">
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => openReview(e, "rejected")} disabled={!hasDocs}>
                        <XCircle className="w-3.5 h-3.5" /> Reject
                      </Button>
                      <Button size="sm" className="gap-1" onClick={() => openReview(e, "approved")} disabled={!hasDocs}>
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
              {decision === "approved" ? "Approve identity" : "Reject identity"}
            </DialogTitle>
            <DialogDescription>
              {reviewing?.profiles?.full_name ?? profilesMap[reviewing?.user_id ?? ""]?.full_name ?? "Engineer"}
              {decision === "rejected" && " — please explain so they know what to resubmit."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              Admin note {decision === "rejected" ? "(required)" : "(optional)"}
            </label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              rows={4}
              placeholder={decision === "approved" ? "Looks good!" : "ID card photo is blurry — please resubmit a clearer image."}
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
