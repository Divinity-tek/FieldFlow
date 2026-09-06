import { useState, useEffect, useRef } from "react";
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
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetDescription } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Briefcase, MapPin, DollarSign, Clock, Search, Send, SlidersHorizontal, X, ExternalLink, Eye } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { format, formatDistanceToNow } from "date-fns";
import { Sparkles, RefreshCw } from "lucide-react";
import MarketplaceNotificationCenter, { pushMarketplaceNotification } from "@/components/marketplace/MarketplaceNotificationCenter";
import {
  fireBrowserNotification,
  getBrowserNotificationPermission,
  requestBrowserNotificationPermission,
  browserNotificationsSupported,
} from "@/lib/browserNotifications";
import { Bell, BellOff } from "lucide-react";
import PayoutBreakdown from "@/components/payouts/PayoutBreakdown";

const JobMarketplace = () => {
  const { user } = useAuth();
  const { isEngineer } = useUserRole();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedListing, setSelectedListing] = useState<any>(null);
  const [proposedPay, setProposedPay] = useState("");
  const [message, setMessage] = useState("");
  const [appType, setAppType] = useState<"apply" | "counter_offer">("apply");
  const [skillFilters, setSkillFilters] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 5000]);
  const [maxDistance, setMaxDistance] = useState<number>(0); // 0 = no limit
  const [detailsListing, setDetailsListing] = useState<any>(null);
  const [newIds, setNewIds] = useState<Record<string, number>>({}); // id -> ts
  const [updatedIds, setUpdatedIds] = useState<Record<string, number>>({});
  const [now, setNow] = useState(Date.now());
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | "unsupported">(
    () => getBrowserNotificationPermission(),
  );

  const handleEnableBrowserNotifications = async () => {
    const result = await requestBrowserNotificationPermission();
    setNotifPermission(result);
    if (result === "granted") {
      toast.success("Browser notifications enabled");
      fireBrowserNotification({
        title: "Notifications enabled",
        body: "You'll now be alerted when your offers are accepted or rejected.",
        tag: "mp-permission-test",
      });
    } else if (result === "denied") {
      toast.error("Notifications blocked. Enable them from your browser settings.");
    } else if (result === "unsupported") {
      toast.error("Your browser doesn't support notifications.");
    }
  };

  // Tick every 30s to refresh relative timestamps and expire indicators
  useEffect(() => {
    const t = setInterval(() => {
      setNow(Date.now());
      const cutoff = Date.now() - 5 * 60 * 1000;
      setNewIds(prev => Object.fromEntries(Object.entries(prev).filter(([, ts]) => ts > cutoff)));
      setUpdatedIds(prev => Object.fromEntries(Object.entries(prev).filter(([, ts]) => ts > cutoff)));
    }, 30000);
    return () => clearInterval(t);
  }, []);

  const { data: engineer } = useQuery({
    queryKey: ["my-engineer", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("engineers").select("id").eq("user_id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user?.id && isEngineer,
  });

  const { data: listings = [] } = useQuery({
    queryKey: ["marketplace-listings"],
    queryFn: async () => {
      // Engineers read marketplace listings via the financial-safe view (no platform/partner cuts).
      const { data: listingRows } = await supabase
        .from("marketplace_listings_engineer_safe")
        .select("*")
        .eq("status", "open")
        .order("created_at", { ascending: false });
      const rows = (listingRows ?? []) as any[];
      const jobIds = Array.from(new Set(rows.map(r => r.job_id).filter(Boolean)));
      const { data: jobRows } = jobIds.length
        ? await supabase
            .from("jobs_engineer_safe")
            .select("id, title, description, location, service_type, priority, scheduled_at, transport_allowance, food_allowance, convenience_allowance, engineer_net")
            .in("id", jobIds)
        : { data: [] as any[] };
      const byId = new Map((jobRows ?? []).map((j: any) => [j.id, j]));
      return rows.map(r => ({ ...r, jobs: byId.get(r.job_id) ?? null }));
    },
  });

  const { data: myApps = [] } = useQuery({
    queryKey: ["my-marketplace-apps", engineer?.id],
    queryFn: async () => {
      const { data: apps } = await supabase
        .from("marketplace_applications")
        .select("*")
        .eq("engineer_id", engineer!.id)
        .order("created_at", { ascending: false });
      const rows = (apps ?? []) as any[];
      const listingIds = Array.from(new Set(rows.map(r => r.listing_id).filter(Boolean)));
      const { data: listingRows } = listingIds.length
        ? await supabase
            .from("marketplace_listings_engineer_safe")
            .select("id, job_id, status, posted_pay, engineer_net")
            .in("id", listingIds)
        : { data: [] as any[] };
      const jobIds = Array.from(new Set((listingRows ?? []).map((l: any) => l.job_id).filter(Boolean)));
      const { data: jobRows } = jobIds.length
        ? await supabase
            .from("jobs_engineer_safe")
            .select("id, title, location")
            .in("id", jobIds)
        : { data: [] as any[] };
      const jobsById = new Map((jobRows ?? []).map((j: any) => [j.id, j]));
      const listingsById = new Map((listingRows ?? []).map((l: any) => [l.id, { ...l, jobs: jobsById.get(l.job_id) ?? null }]));
      return rows.map(r => ({ ...r, listing: listingsById.get(r.listing_id) ?? null }));
    },
    enabled: !!engineer?.id,
  });

  // Realtime: live updates with conflict-free cache reconciliation (no refetch / flicker)
  const mountedRef = useRef(false);
  useEffect(() => {
    const LISTINGS_KEY = ["marketplace-listings"];

    const fetchOneWithJob = async (id: string) => {
      const { data: listing } = await supabase
        .from("marketplace_listings_engineer_safe")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (!listing) return null;
      const { data: job } = await supabase
        .from("jobs_engineer_safe")
        .select("id, title, description, location, service_type, priority, scheduled_at, transport_allowance, food_allowance, convenience_allowance, engineer_net")
        .eq("id", (listing as any).job_id)
        .maybeSingle();
      return { ...listing, jobs: job ?? null } as any;
    };

    const upsertListing = (row: any) => {
      qc.setQueryData<any[]>(LISTINGS_KEY, (prev = []) => {
        const idx = prev.findIndex(x => x.id === row.id);
        if (idx === -1) return [row, ...prev];
        // Merge — preserve cached `jobs` join if payload lacks it
        const merged = { ...prev[idx], ...row, jobs: row.jobs ?? prev[idx].jobs };
        const next = [...prev];
        next[idx] = merged;
        return next;
      });
    };

    const removeListing = (id: string) => {
      qc.setQueryData<any[]>(LISTINGS_KEY, (prev = []) => prev.filter(x => x.id !== id));
    };

    const channel = supabase
      .channel("marketplace-listings-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "marketplace_listings" },
        async (payload) => {
          const newRow: any = payload.new;
          const oldRow: any = payload.old;
          const listingId = newRow?.id ?? oldRow?.id;
          if (!listingId) return;

          // --- Cache reconciliation ---
          if (payload.eventType === "DELETE") {
            removeListing(listingId);
          } else if (payload.eventType === "INSERT") {
            if (newRow.status === "open") {
              // fetch joined job data, then upsert (dedup by id)
              const full = await fetchOneWithJob(listingId);
              if (full) upsertListing(full);
              else upsertListing(newRow);
            }
          } else if (payload.eventType === "UPDATE") {
            if (newRow.status !== "open") {
              removeListing(listingId);
            } else {
              upsertListing(newRow);
            }
          }

          // --- User feedback (skip on initial flush) ---
          if (!mountedRef.current) return;
          if (payload.eventType === "INSERT" && newRow?.status === "open") {
            setNewIds(p => ({ ...p, [listingId]: Date.now() }));
            toast.info("New job posted to marketplace");
            pushMarketplaceNotification({
              type: "posted",
              title: "New job posted",
              message: `A new job is available${newRow?.posted_pay ? ` · $${newRow.posted_pay}` : ""}.`,
              listingId,
            });
          } else if (payload.eventType === "UPDATE") {
            setUpdatedIds(p => ({ ...p, [listingId]: Date.now() }));
            if (oldRow?.status === "open" && newRow?.status === "assigned") {
              toast.info("A job was just taken");
              pushMarketplaceNotification({
                type: "taken",
                title: "Job taken",
                message: "A marketplace job was just assigned to an engineer.",
                listingId,
              });
            } else if (oldRow?.status === "open" && (newRow?.status === "closed" || newRow?.status === "cancelled")) {
              toast.warning("A job was cancelled or closed");
              pushMarketplaceNotification({
                type: "cancelled",
                title: newRow?.status === "cancelled" ? "Job cancelled" : "Listing closed",
                message: "A marketplace job is no longer available.",
                listingId,
              });
            }
          }
        },
      )
      .subscribe();

    const t = setTimeout(() => { mountedRef.current = true; }, 800);
    return () => {
      clearTimeout(t);
      mountedRef.current = false;
      supabase.removeChannel(channel);
    };
  }, [qc]);

  // Realtime: my marketplace application status (accepted / rejected)
  useEffect(() => {
    if (!engineer?.id) return;
    const APPS_KEY = ["my-marketplace-apps", engineer.id];
    const channel = supabase
      .channel(`my-mp-apps-${engineer.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "marketplace_applications",
          filter: `engineer_id=eq.${engineer.id}`,
        },
        (payload) => {
          const newRow: any = payload.new;
          const oldRow: any = payload.old;
          // Surgical cache merge — preserve cached `listing` join
          qc.setQueryData<any[]>(APPS_KEY, (prev = []) => {
            const idx = prev.findIndex(x => x.id === newRow.id);
            if (idx === -1) return prev;
            const merged = { ...prev[idx], ...newRow, listing: prev[idx].listing };
            const next = [...prev];
            next[idx] = merged;
            return next;
          });

          if (oldRow?.status !== newRow?.status) {
            if (newRow.status === "accepted") {
              toast.success("🎉 Your offer was accepted!");
              pushMarketplaceNotification({
                type: "taken",
                title: "Offer accepted",
                message: "Your application was accepted and the job is now assigned to you.",
                listingId: newRow.listing_id,
              });
              fireBrowserNotification({
                title: "🎉 Offer accepted",
                body: "Your application was accepted — the job is now assigned to you.",
                tag: `mp-app-${newRow.id}`,
                url: "/marketplace",
              });
            } else if (newRow.status === "rejected") {
              toast.error(`Your offer was rejected${newRow.review_note ? `: ${newRow.review_note}` : ""}`);
              pushMarketplaceNotification({
                type: "cancelled",
                title: "Offer rejected",
                message: newRow.review_note || "Your application was not selected for this job.",
                listingId: newRow.listing_id,
              });
              fireBrowserNotification({
                title: "Offer rejected",
                body: newRow.review_note || "Your application was not selected for this job.",
                tag: `mp-app-${newRow.id}`,
                url: "/marketplace",
              });
            } else if (newRow.status === "withdrawn") {
              pushMarketplaceNotification({
                type: "cancelled",
                title: "Offer withdrawn",
                message: "You withdrew your application.",
                listingId: newRow.listing_id,
              });
            }
          }
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [engineer?.id, qc]);

  const applyMutation = useMutation({
    mutationFn: async () => {
      if (!engineer?.id || !selectedListing) throw new Error("Missing data");
      const { error } = await supabase.from("marketplace_applications").insert({
        listing_id: selectedListing.id,
        job_id: selectedListing.job_id,
        engineer_id: engineer.id,
        application_type: appType,
        proposed_pay: proposedPay ? parseFloat(proposedPay) : null,
        message: message || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(appType === "counter_offer" ? "Counter-offer sent" : "Application submitted");
      setSelectedListing(null);
      setProposedPay("");
      setMessage("");
      qc.invalidateQueries({ queryKey: ["my-marketplace-apps"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to apply"),
  });

  const withdrawMutation = useMutation({
    mutationFn: async (appId: string) => {
      const { error } = await supabase
        .from("marketplace_applications")
        .update({ status: "withdrawn", reviewed_at: new Date().toISOString() })
        .eq("id", appId);
      if (error) throw error;
    },
    onMutate: async (appId: string) => {
      const APPS_KEY = ["my-marketplace-apps", engineer?.id];
      await qc.cancelQueries({ queryKey: APPS_KEY });
      const prev = qc.getQueryData<any[]>(APPS_KEY);
      qc.setQueryData<any[]>(APPS_KEY, (old = []) =>
        old.map(a => a.id === appId ? { ...a, status: "withdrawn", reviewed_at: new Date().toISOString() } : a)
      );
      return { prev, APPS_KEY };
    },
    onSuccess: () => toast.success("Application withdrawn"),
    onError: (e: any, _id, ctx: any) => {
      if (ctx?.prev) qc.setQueryData(ctx.APPS_KEY, ctx.prev);
      toast.error(e.message ?? "Failed to withdraw");
    },
  });

  const allSkills = Array.from(new Set(listings.flatMap((l: any) => l.required_skills ?? []))) as string[];

  const getPay = (l: any) => Number(l.posted_pay ?? l.jobs?.engineer_net ?? 0);
  const getDistance = (l: any) => Number(l.distance_km ?? l.posted_distance_km ?? l.jobs?.distance_km ?? NaN);

  const filtered = listings.filter((l: any) => {
    if (search) {
      const q = search.toLowerCase();
      const matches =
        l.jobs?.title?.toLowerCase().includes(q) ||
        l.jobs?.location?.toLowerCase().includes(q) ||
        l.jobs?.service_type?.toLowerCase().includes(q);
      if (!matches) return false;
    }
    if (skillFilters.length > 0) {
      const skills: string[] = l.required_skills ?? [];
      if (!skillFilters.some(s => skills.includes(s))) return false;
    }
    const pay = getPay(l);
    if (pay < priceRange[0] || pay > priceRange[1]) return false;
    if (maxDistance > 0) {
      const d = getDistance(l);
      if (!isNaN(d) && d > maxDistance) return false;
    }
    return true;
  });

  const activeFilterCount =
    (skillFilters.length > 0 ? 1 : 0) +
    (priceRange[0] > 0 || priceRange[1] < 5000 ? 1 : 0) +
    (maxDistance > 0 ? 1 : 0);

  const clearFilters = () => {
    setSkillFilters([]);
    setPriceRange([0, 5000]);
    setMaxDistance(0);
  };

  return (
    <AppLayout title="Job Marketplace">
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold">Job Marketplace</h1>
            <p className="text-muted-foreground mt-1">
              Browse open jobs, apply directly, or send a counter-offer with your proposed rate.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {browserNotificationsSupported() && notifPermission !== "granted" && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleEnableBrowserNotifications}
                title={notifPermission === "denied" ? "Notifications are blocked in browser settings" : "Get alerted when your offer is accepted or rejected"}
              >
                {notifPermission === "denied" ? (
                  <><BellOff className="h-4 w-4 mr-1.5" />Notifications blocked</>
                ) : (
                  <><Bell className="h-4 w-4 mr-1.5" />Enable alerts</>
                )}
              </Button>
            )}
            <MarketplaceNotificationCenter />
          </div>
        </div>

        <Tabs defaultValue="browse">
          <TabsList>
            <TabsTrigger value="browse">Browse jobs ({filtered.length})</TabsTrigger>
            {isEngineer && <TabsTrigger value="my-apps">My applications ({myApps.length})</TabsTrigger>}
          </TabsList>

          <TabsContent value="browse" className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[220px] max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search title, location, service type…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-10">
                    <SlidersHorizontal className="h-4 w-4 mr-2" />
                    Filters
                    {activeFilterCount > 0 && (
                      <Badge variant="secondary" className="ml-2 h-5 px-1.5">{activeFilterCount}</Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 space-y-4" align="end">
                  <div className="space-y-2">
                    <Label className="text-xs">Price range (${priceRange[0]} – ${priceRange[1]})</Label>
                    <Slider
                      min={0}
                      max={5000}
                      step={50}
                      value={priceRange}
                      onValueChange={(v) => setPriceRange([v[0], v[1]] as [number, number])}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Max distance (km) — {maxDistance === 0 ? "Any" : maxDistance}</Label>
                    <Slider
                      min={0}
                      max={500}
                      step={10}
                      value={[maxDistance]}
                      onValueChange={(v) => setMaxDistance(v[0])}
                    />
                  </div>
                  {allSkills.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-xs">Skills</Label>
                      <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                        {allSkills.map(s => {
                          const active = skillFilters.includes(s);
                          return (
                            <Badge
                              key={s}
                              variant={active ? "default" : "outline"}
                              className="cursor-pointer text-xs"
                              onClick={() => setSkillFilters(p => active ? p.filter(x => x !== s) : [...p, s])}
                            >
                              {s}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {activeFilterCount > 0 && (
                    <Button variant="ghost" size="sm" className="w-full" onClick={clearFilters}>
                      <X className="h-3.5 w-3.5 mr-1" /> Clear filters
                    </Button>
                  )}
                </PopoverContent>
              </Popover>
              {activeFilterCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>Reset</Button>
              )}
            </div>

            {filtered.length === 0 ? (
              <Card><CardContent className="p-12 text-center text-muted-foreground">No open listings.</CardContent></Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filtered.map((l: any) => {
                  const isNewLive = !!newIds[l.id];
                  const isUpdatedLive = !!updatedIds[l.id];
                  // Fallback "new" if created within last 5 min even without live event
                  const createdAt = l.created_at ? new Date(l.created_at).getTime() : 0;
                  const isFreshlyCreated = createdAt > 0 && now - createdAt < 5 * 60 * 1000;
                  const showNew = isNewLive || isFreshlyCreated;
                  const lastChangedISO = l.updated_at ?? l.created_at;
                  return (
                  <Card key={l.id} className={`flex flex-col transition-shadow ${isNewLive || isUpdatedLive ? "ring-2 ring-primary/40" : ""}`}>
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <CardTitle className="text-lg leading-tight">{l.jobs?.title ?? "Job"}</CardTitle>
                          {showNew && (
                            <Badge className="text-[10px] gap-1 animate-pulse">
                              <Sparkles className="h-3 w-3" /> New
                            </Badge>
                          )}
                          {isUpdatedLive && !isNewLive && (
                            <Badge variant="outline" className="text-[10px] gap-1">
                              <RefreshCw className="h-3 w-3" /> Updated
                            </Badge>
                          )}
                        </div>
                        <Badge variant="secondary">{l.jobs?.priority}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col gap-3 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="h-4 w-4" /> {l.jobs?.location}
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Briefcase className="h-4 w-4" /> {l.jobs?.service_type}
                      </div>
                      {l.jobs?.scheduled_at && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Clock className="h-4 w-4" /> {format(new Date(l.jobs.scheduled_at), "PP p")}
                        </div>
                      )}
                      <div className="flex items-center gap-2 font-medium">
                        <DollarSign className="h-4 w-4" />
                        {l.posted_pay ?? l.jobs?.engineer_net ?? "Negotiable"}
                        {l.pay_negotiable && <Badge variant="outline" className="ml-1 text-xs">Negotiable</Badge>}
                      </div>
                      {l.required_skills?.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {l.required_skills.slice(0, 4).map((s: string) => (
                            <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-2 mt-auto pt-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDetailsListing(l)}
                        >
                          <Eye className="h-4 w-4 mr-1" /> View
                        </Button>
                        {isEngineer && engineer?.id && (
                          <>
                            <Button
                              size="sm"
                              className="flex-1"
                              onClick={() => { setSelectedListing(l); setAppType("apply"); }}
                            >
                              Apply
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1"
                              onClick={() => { setSelectedListing(l); setAppType("counter_offer"); }}
                            >
                              Counter
                            </Button>
                          </>
                        )}
                      </div>
                      {lastChangedISO && (
                        <div className="text-[10px] text-muted-foreground pt-1 border-t">
                          {l.updated_at && l.updated_at !== l.created_at ? "Updated" : "Posted"}{" "}
                          {formatDistanceToNow(new Date(lastChangedISO), { addSuffix: true })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {isEngineer && (
            <TabsContent value="my-apps" className="space-y-3">
              {myApps.length === 0 ? (
                <Card><CardContent className="p-12 text-center text-muted-foreground">No applications yet.</CardContent></Card>
              ) : (
                myApps.map((a: any) => {
                  const submittedAt = a.created_at ? new Date(a.created_at) : null;
                  const reviewedAt = a.reviewed_at ? new Date(a.reviewed_at) : null;
                  const isAccepted = a.status === "accepted";
                  const isRejected = a.status === "rejected";
                  const isPending = a.status === "pending";
                  const isWithdrawn = a.status === "withdrawn";
                  return (
                  <Card key={a.id}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div>
                          <div className="font-medium">{a.listing?.jobs?.title}</div>
                          <div className="text-sm text-muted-foreground">{a.listing?.jobs?.location}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {a.application_type === "counter_offer" ? "Counter-offer" : "Application"}
                            {a.proposed_pay && ` · $${a.proposed_pay}`}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={
                            isAccepted ? "default" :
                            isRejected ? "destructive" :
                            isWithdrawn ? "outline" :
                            "secondary"
                          }>{a.status}</Badge>
                          {isPending && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => withdrawMutation.mutate(a.id)}
                              disabled={withdrawMutation.isPending}
                            >
                              <X className="h-3.5 w-3.5 mr-1" />
                              Withdraw
                            </Button>
                          )}
                        </div>
                      </div>

                      <ol className="relative border-l border-border pl-5 space-y-3 ml-1">
                        <li className="relative">
                          <span className="absolute -left-[7px] top-1.5 h-3 w-3 rounded-full bg-primary" />
                          <div className="text-xs font-medium">
                            {a.application_type === "counter_offer" ? "Counter-offer submitted" : "Application submitted"}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {submittedAt ? format(submittedAt, "PPp") : "—"}
                          </div>
                        </li>

                        {isPending && (
                          <li className="relative">
                            <span className="absolute -left-[7px] top-1.5 h-3 w-3 rounded-full bg-muted border border-border animate-pulse" />
                            <div className="text-xs font-medium text-muted-foreground">Awaiting review</div>
                            <div className="text-[11px] text-muted-foreground">Pending dispatcher decision</div>
                          </li>
                        )}

                        {isAccepted && (
                          <li className="relative">
                            <span className="absolute -left-[7px] top-1.5 h-3 w-3 rounded-full bg-green-500" />
                            <div className="text-xs font-medium text-green-600">Offer accepted</div>
                            <div className="text-[11px] text-muted-foreground">
                              {reviewedAt ? format(reviewedAt, "PPp") : "—"}
                            </div>
                            {a.review_note && (
                              <div className="text-[11px] mt-1 italic text-muted-foreground">"{a.review_note}"</div>
                            )}
                          </li>
                        )}

                        {isRejected && (
                          <li className="relative">
                            <span className="absolute -left-[7px] top-1.5 h-3 w-3 rounded-full bg-destructive" />
                            <div className="text-xs font-medium text-destructive">Offer rejected</div>
                            <div className="text-[11px] text-muted-foreground">
                              {reviewedAt ? format(reviewedAt, "PPp") : "—"}
                            </div>
                            {a.review_note && (
                              <div className="text-[11px] mt-1 italic text-muted-foreground">"{a.review_note}"</div>
                            )}
                          </li>
                        )}
                        {isWithdrawn && (
                          <li className="relative">
                            <span className="absolute -left-[7px] top-1.5 h-3 w-3 rounded-full bg-muted-foreground" />
                            <div className="text-xs font-medium text-muted-foreground">Offer withdrawn</div>
                            <div className="text-[11px] text-muted-foreground">
                              {reviewedAt ? format(reviewedAt, "PPp") : "—"}
                            </div>
                          </li>
                        )}
                      </ol>
                    </CardContent>
                  </Card>
                  );
                })
              )}
            </TabsContent>
          )}
        </Tabs>

        <Dialog open={!!selectedListing} onOpenChange={(o) => !o && setSelectedListing(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {appType === "counter_offer" ? "Send counter-offer" : "Apply for job"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                <div className="font-medium text-foreground">{selectedListing?.jobs?.title}</div>
                <div>{selectedListing?.jobs?.location}</div>
              </div>
              <div className="space-y-2">
                <Label>Your proposed pay {appType === "apply" && "(optional)"}</Label>
                <Input
                  type="number"
                  placeholder={selectedListing?.posted_pay ? `Posted: $${selectedListing.posted_pay}` : "Enter amount"}
                  value={proposedPay}
                  onChange={(e) => setProposedPay(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Message {appType === "counter_offer" && "(why this rate?)"}</Label>
                <Textarea
                  placeholder="Brief note to the dispatcher…"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedListing(null)}>Cancel</Button>
              <Button onClick={() => applyMutation.mutate()} disabled={applyMutation.isPending}>
                <Send className="h-4 w-4 mr-2" />
                {appType === "counter_offer" ? "Send counter-offer" : "Submit application"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Sheet open={!!detailsListing} onOpenChange={(o) => !o && setDetailsListing(null)}>
          <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto flex flex-col gap-0 p-0">
            {detailsListing && (() => {
              const job = detailsListing.jobs ?? {};
              const pay = detailsListing.posted_pay ?? job.engineer_net;
              const dist = detailsListing.distance_km ?? detailsListing.posted_distance_km ?? job.distance_km;
              return (
                <>
                  <SheetHeader className="p-6 pb-4 border-b">
                    <div className="flex items-start justify-between gap-3">
                      <SheetTitle className="text-xl leading-tight">{job.title ?? "Job details"}</SheetTitle>
                      {job.priority && <Badge variant="secondary" className="capitalize">{job.priority}</Badge>}
                    </div>
                    <SheetDescription className="flex items-center gap-1.5 text-sm">
                      <MapPin className="h-3.5 w-3.5" /> {job.location ?? "Location not set"}
                    </SheetDescription>
                  </SheetHeader>

                  <div className="flex-1 p-6 space-y-5">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg border p-3">
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Estimated pay</div>
                        <div className="mt-1 font-semibold flex items-center gap-1">
                          <DollarSign className="h-4 w-4" />
                          {pay ?? "Negotiable"}
                          {detailsListing.pay_negotiable && <Badge variant="outline" className="ml-1 text-[10px]">Negotiable</Badge>}
                        </div>
                      </div>
                      <div className="rounded-lg border p-3">
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Distance</div>
                        <div className="mt-1 font-semibold">
                          {dist != null && !isNaN(Number(dist)) ? `${Number(dist).toFixed(1)} km` : "—"}
                        </div>
                      </div>
                      <div className="rounded-lg border p-3 col-span-2">
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Service & schedule</div>
                        <div className="mt-1 text-sm flex items-center gap-2">
                          <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />{job.service_type ?? "—"}
                        </div>
                        {job.scheduled_at && (
                          <div className="mt-1 text-sm flex items-center gap-2">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" />{format(new Date(job.scheduled_at), "PPpp")}
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs uppercase text-muted-foreground">Payout breakdown</Label>
                      <div className="mt-1.5 rounded-lg border p-3">
                        <PayoutBreakdown source={{
                          base_pay: detailsListing.posted_pay ?? job.engineer_net ?? 0,
                          transport_allowance: detailsListing.transport_allowance ?? job.transport_allowance,
                          food_allowance: detailsListing.food_allowance ?? job.food_allowance,
                          convenience_allowance: detailsListing.convenience_allowance ?? job.convenience_allowance,
                          engineer_net: detailsListing.engineer_net ?? job.engineer_net,
                        }} />
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs uppercase text-muted-foreground">Full description</Label>
                      <p className="text-sm mt-1.5 whitespace-pre-wrap leading-relaxed">
                        {job.description?.trim() || "No additional description provided."}
                      </p>
                    </div>

                    {detailsListing.required_skills?.length > 0 && (
                      <div>
                        <Label className="text-xs uppercase text-muted-foreground">Required skills</Label>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {detailsListing.required_skills.map((s: string) => (
                            <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {job.location && (
                      <div>
                        <Label className="text-xs uppercase text-muted-foreground">Location preview</Label>
                        <div className="mt-1.5 rounded-lg overflow-hidden border bg-muted aspect-video">
                          <iframe
                            title="Job location preview"
                            width="100%"
                            height="100%"
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade"
                            src={`https://www.google.com/maps?q=${encodeURIComponent(job.location)}&output=embed`}
                          />
                        </div>
                        <Button asChild variant="link" size="sm" className="px-0 h-auto mt-1">
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.location)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="h-3.5 w-3.5 mr-1" /> Open in Google Maps
                          </a>
                        </Button>
                      </div>
                    )}
                  </div>

                  <SheetFooter className="p-4 border-t bg-background sticky bottom-0 flex-row gap-2 sm:justify-end">
                    {isEngineer && engineer?.id ? (
                      <>
                        <Button
                          variant="outline"
                          className="flex-1 sm:flex-none"
                          onClick={() => { setSelectedListing(detailsListing); setAppType("counter_offer"); setDetailsListing(null); }}
                        >
                          Counter-offer
                        </Button>
                        <Button
                          className="flex-1 sm:flex-none"
                          onClick={() => { setSelectedListing(detailsListing); setAppType("apply"); setDetailsListing(null); }}
                        >
                          Apply
                        </Button>
                      </>
                    ) : (
                      <Button variant="outline" onClick={() => setDetailsListing(null)}>Close</Button>
                    )}
                  </SheetFooter>
                </>
              );
            })()}
          </SheetContent>
        </Sheet>
      </div>
    </AppLayout>
  );
};

export default JobMarketplace;
