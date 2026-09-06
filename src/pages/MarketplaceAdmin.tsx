import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Check, X } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const MarketplaceAdmin = () => {
  const qc = useQueryClient();
  const [postOpen, setPostOpen] = useState(false);
  const [jobId, setJobId] = useState<string>("");
  const [postedPay, setPostedPay] = useState("");
  const [requiredSkills, setRequiredSkills] = useState("");
  const [transport, setTransport] = useState("");
  const [food, setFood] = useState("");
  const [convenience, setConvenience] = useState("");
  const [partnerSplit, setPartnerSplit] = useState("");
  const [platformSplit, setPlatformSplit] = useState("");
  const [rejectApp, setRejectApp] = useState<any>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [reviewClaim, setReviewClaim] = useState<any>(null);
  const [claimReviewNote, setClaimReviewNote] = useState("");

  const { data: openJobs = [] } = useQuery({
    queryKey: ["unassigned-jobs-for-mp"],
    queryFn: async () => {
      const { data } = await supabase
        .from("jobs")
        .select("id, title, location, service_type")
        .is("engineer_id", null)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });

  const { data: listings = [] } = useQuery({
    queryKey: ["mp-listings-admin"],
    queryFn: async () => {
      const { data } = await supabase
        .from("marketplace_listings")
        .select(`*, jobs:job_id(title, location)`)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: applications = [] } = useQuery({
    queryKey: ["mp-applications-admin"],
    queryFn: async () => {
      const { data } = await supabase
        .from("marketplace_applications")
        .select(`*, listing:listing_id(*, jobs:job_id(title, location)),
                  engineer:engineer_id(id, user_id, specialty, rating, jobs_completed, hourly_rate)`)
        .order("created_at", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });

  const postMutation = useMutation({
    mutationFn: async () => {
      const skills = requiredSkills.split(",").map((s) => s.trim()).filter(Boolean);
      const { error } = await supabase.from("marketplace_listings").insert({
        job_id: jobId,
        posted_pay: postedPay ? parseFloat(postedPay) : null,
        required_skills: skills,
        transport_allowance: transport ? parseFloat(transport) : 0,
        food_allowance: food ? parseFloat(food) : 0,
        convenience_allowance: convenience ? parseFloat(convenience) : 0,
        partner_split_percent: partnerSplit ? parseFloat(partnerSplit) : 0,
        platform_split_percent: platformSplit ? parseFloat(platformSplit) : 0,
      });
      if (error) throw error;
      // Mirror to job so it persists once assigned
      await supabase.from("jobs").update({
        transport_allowance: transport ? parseFloat(transport) : 0,
        food_allowance: food ? parseFloat(food) : 0,
        convenience_allowance: convenience ? parseFloat(convenience) : 0,
        partner_split_percent: partnerSplit ? parseFloat(partnerSplit) : 0,
        platform_split_percent: platformSplit ? parseFloat(platformSplit) : 0,
      }).eq("id", jobId);
    },
    onSuccess: () => {
      toast.success("Listing posted to marketplace");
      setPostOpen(false);
      setJobId(""); setPostedPay(""); setRequiredSkills("");
      setTransport(""); setFood(""); setConvenience("");
      setPartnerSplit(""); setPlatformSplit("");
      qc.invalidateQueries({ queryKey: ["mp-listings-admin"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const { data: claims = [] } = useQuery({
    queryKey: ["mp-claims-admin"],
    queryFn: async () => {
      const { data } = await supabase
        .from("job_payout_claims")
        .select(`*, job:job_id(title, location), engineer:engineer_id(specialty, user_id)`)
        .order("created_at", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });

  const reviewClaimMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" }) => {
      const { error } = await supabase
        .from("job_payout_claims")
        .update({
          status,
          review_note: claimReviewNote || null,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Claim updated");
      setReviewClaim(null); setClaimReviewNote("");
      qc.invalidateQueries({ queryKey: ["mp-claims-admin"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const acceptMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("accept_marketplace_application", { _application_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Application accepted, engineer assigned");
      qc.invalidateQueries({ queryKey: ["mp-applications-admin"] });
      qc.invalidateQueries({ queryKey: ["mp-listings-admin"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("reject_marketplace_application", {
        _application_id: rejectApp.id,
        _note: rejectNote || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Application rejected");
      setRejectApp(null); setRejectNote("");
      qc.invalidateQueries({ queryKey: ["mp-applications-admin"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const closeListing = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("marketplace_listings").update({ status: "closed" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Listing closed");
      qc.invalidateQueries({ queryKey: ["mp-listings-admin"] });
    },
  });

  const pendingApps = applications.filter((a: any) => a.status === "pending");

  return (
    <AppLayout title="Marketplace Admin">
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold">Marketplace Admin</h1>
            <p className="text-muted-foreground mt-1">Post jobs publicly and review engineer applications & counter-offers.</p>
          </div>
          <Dialog open={postOpen} onOpenChange={setPostOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Post job to marketplace</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Post job to marketplace</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Select job</Label>
                  <Select value={jobId} onValueChange={setJobId}>
                    <SelectTrigger><SelectValue placeholder="Choose an unassigned job" /></SelectTrigger>
                    <SelectContent>
                      {openJobs.map((j: any) => (
                        <SelectItem key={j.id} value={j.id}>
                          {j.title} — {j.location}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Posted pay (optional)</Label>
                  <Input type="number" placeholder="e.g. 350" value={postedPay} onChange={(e) => setPostedPay(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Required skills (comma-separated)</Label>
                  <Input placeholder="cabling, fiber, ccna" value={requiredSkills} onChange={(e) => setRequiredSkills(e.target.value)} />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Transport</Label>
                    <Input type="number" placeholder="0" value={transport} onChange={(e) => setTransport(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Food</Label>
                    <Input type="number" placeholder="0" value={food} onChange={(e) => setFood(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Convenience</Label>
                    <Input type="number" placeholder="0" value={convenience} onChange={(e) => setConvenience(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Partner split %</Label>
                    <Input type="number" placeholder="0" value={partnerSplit} onChange={(e) => setPartnerSplit(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Platform fee %</Label>
                    <Input type="number" placeholder="0" value={platformSplit} onChange={(e) => setPlatformSplit(e.target.value)} />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setPostOpen(false)}>Cancel</Button>
                <Button disabled={!jobId || postMutation.isPending} onClick={() => postMutation.mutate()}>Post</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs defaultValue="applications">
          <TabsList>
            <TabsTrigger value="applications">Applications ({pendingApps.length} pending)</TabsTrigger>
            <TabsTrigger value="listings">Listings ({listings.length})</TabsTrigger>
            <TabsTrigger value="claims">Expense claims ({claims.filter((c: any) => c.status === "pending").length} pending)</TabsTrigger>
          </TabsList>

          <TabsContent value="applications" className="space-y-3">
            {applications.length === 0 ? (
              <Card><CardContent className="p-12 text-center text-muted-foreground">No applications yet.</CardContent></Card>
            ) : (
              applications.map((a: any) => (
                <Card key={a.id}>
                  <CardContent className="p-4 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex-1 min-w-[240px]">
                      <div className="font-medium">{a.listing?.jobs?.title}</div>
                      <div className="text-sm text-muted-foreground">{a.listing?.jobs?.location}</div>
                      <div className="text-xs mt-1 flex flex-wrap gap-2">
                        <Badge variant="outline">{a.application_type === "counter_offer" ? "Counter-offer" : "Apply"}</Badge>
                        {a.proposed_pay && <Badge variant="secondary">${a.proposed_pay}</Badge>}
                        <span className="text-muted-foreground">
                          Engineer: {a.engineer?.specialty} · ⭐ {a.engineer?.rating ?? "—"} · {a.engineer?.jobs_completed ?? 0} jobs
                        </span>
                      </div>
                      {a.message && <div className="text-sm mt-2 italic">"{a.message}"</div>}
                      <div className="text-xs text-muted-foreground mt-1">{format(new Date(a.created_at), "PP p")}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {a.status === "pending" ? (
                        <>
                          <Button size="sm" onClick={() => acceptMutation.mutate(a.id)} disabled={acceptMutation.isPending}>
                            <Check className="h-4 w-4 mr-1" />Accept
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setRejectApp(a)}>
                            <X className="h-4 w-4 mr-1" />Reject
                          </Button>
                        </>
                      ) : (
                        <Badge variant={a.status === "accepted" ? "default" : "destructive"}>{a.status}</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="listings" className="space-y-3">
            {listings.map((l: any) => (
              <Card key={l.id}>
                <CardContent className="p-4 flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <div className="font-medium">{l.jobs?.title}</div>
                    <div className="text-sm text-muted-foreground">{l.jobs?.location}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Posted {format(new Date(l.created_at), "PP")} · {l.view_count} views
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={l.status === "open" ? "default" : "secondary"}>{l.status}</Badge>
                    {l.status === "open" && (
                      <Button size="sm" variant="outline" onClick={() => closeListing.mutate(l.id)}>Close</Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
          <TabsContent value="claims" className="space-y-3">
            {claims.length === 0 ? (
              <Card><CardContent className="p-12 text-center text-muted-foreground">No claims submitted yet.</CardContent></Card>
            ) : (
              claims.map((c: any) => (
                <Card key={c.id}>
                  <CardContent className="p-4 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex-1 min-w-[240px]">
                      <div className="font-medium capitalize">{c.claim_type} — ${Number(c.amount).toFixed(2)}</div>
                      <div className="text-sm text-muted-foreground">
                        {c.job?.title} · {c.job?.location}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {c.engineer?.specialty ?? "Engineer"} · {format(new Date(c.created_at), "PP p")}
                        {c.receipt_url && <> · <a href={c.receipt_url} target="_blank" rel="noreferrer" className="underline">receipt</a></>}
                      </div>
                      {c.note && <div className="text-sm mt-2 italic">"{c.note}"</div>}
                      {c.review_note && c.status !== "pending" && (
                        <div className="text-xs mt-1 text-muted-foreground italic">Review: "{c.review_note}"</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {c.status === "pending" ? (
                        <>
                          <Button size="sm" onClick={() => { setReviewClaim({ ...c, _status: "approved" }); setClaimReviewNote(""); }}>
                            <Check className="h-4 w-4 mr-1" />Approve
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => { setReviewClaim({ ...c, _status: "rejected" }); setClaimReviewNote(""); }}>
                            <X className="h-4 w-4 mr-1" />Reject
                          </Button>
                        </>
                      ) : (
                        <Badge variant={c.status === "approved" ? "default" : "destructive"}>{c.status}</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>

        <Dialog open={!!reviewClaim} onOpenChange={(o) => !o && setReviewClaim(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{reviewClaim?._status === "approved" ? "Approve" : "Reject"} claim</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <Label>Note (sent to engineer)</Label>
              <Textarea value={claimReviewNote} onChange={(e) => setClaimReviewNote(e.target.value)} rows={3} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setReviewClaim(null)}>Cancel</Button>
              <Button
                variant={reviewClaim?._status === "rejected" ? "destructive" : "default"}
                onClick={() => reviewClaimMutation.mutate({ id: reviewClaim.id, status: reviewClaim._status })}
                disabled={reviewClaimMutation.isPending}
              >
                Confirm
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!rejectApp} onOpenChange={(o) => !o && setRejectApp(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Reject application</DialogTitle></DialogHeader>
            <div className="space-y-2">
              <Label>Note (sent to engineer)</Label>
              <Textarea value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} rows={3} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectApp(null)}>Cancel</Button>
              <Button variant="destructive" onClick={() => rejectMutation.mutate()} disabled={rejectMutation.isPending}>Reject</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default MarketplaceAdmin;
