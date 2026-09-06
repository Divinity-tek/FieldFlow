import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { ShoppingCart, Plus, Package, DollarSign, Truck, Trash2, Keyboard, Search, X, Inbox, ArrowUp, ArrowDown, ChevronsUpDown, Volume2, VolumeX } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";
import PODetailDialog from "@/components/purchase-orders/PODetailDialog";
import { fmtMoney } from "@/lib/financialDocs";
import { useUserPreference } from "@/hooks/useUserPreference";

interface POItem { description: string; quantity: number; unit_price: number; }

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  approved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  ordered: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  received: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  closed: "bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

const STATUS_FILTERS = ["all", "draft", "submitted", "approved", "ordered", "received", "closed", "cancelled"] as const;
const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "INR", "JPY"];

const PurchaseOrders = () => {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const { value: filter, update: setFilter } = useUserPreference<string>("po_filter", "all");
  const { value: search, update: setSearch } = useUserPreference<string>("po_search", "");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [confirmUnpin, setConfirmUnpin] = useState(false);
  const [jumpInput, setJumpInput] = useState<string>("");
  const firstBtnRef = useRef<HTMLButtonElement>(null);
  const prevBtnRef = useRef<HTMLButtonElement>(null);
  const nextBtnRef = useRef<HTMLButtonElement>(null);
  const lastBtnRef = useRef<HTMLButtonElement>(null);
  const [pageAnnouncement, setPageAnnouncement] = useState("");
  const [focusAnnouncement, setFocusAnnouncement] = useState("");
  const [jumpError, setJumpError] = useState<string | null>(null);
  const { value: pageJump, update: setPageJump } = useUserPreference<number>("po_page_jump", 10);
  const { value: page, update: setPage } = useUserPreference<number>("po_page", 1);
  const { value: pageSize, update: setPageSize } = useUserPreference<number>("po_page_size", 25);
  const { value: pageSound, update: setPageSound } = useUserPreference<boolean>("po_page_sound", false);
  const { value: pageSoundVolume, update: setPageSoundVolume } = useUserPreference<number>("po_page_sound_volume", 50);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const prevPageRef = useRef<number | null>(null);
  const activeNodesRef = useRef<Set<{ osc: OscillatorNode; gain: GainNode }>>(new Set());
  const previewTimeoutsRef = useRef<number[]>([]);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const playPageTone = (direction: "up" | "down" | "edge") => {
    try {
      const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
      if (!Ctx) return;
      if (!audioCtxRef.current) audioCtxRef.current = new Ctx();
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") ctx.resume();
      const vol = Math.min(1, Math.max(0, (Number(pageSoundVolume) || 0) / 100));
      if (vol <= 0) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      // Same volume curve applied to all three tones (up / down / edge)
      const baseFreq = direction === "up" ? 660 : direction === "down" ? 440 : 330;
      osc.frequency.value = baseFreq;
      const peak = 0.02 + vol * 0.18; // scales with slider for every direction
      const fadeIn = 0.025; // 25ms gain fade-in to avoid click at onset
      const now = ctx.currentTime;
      // Exponential ramp from a near-zero floor up to peak for a smoother attack
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(peak, now + fadeIn);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(now + 0.15);
      const node = { osc, gain };
      activeNodesRef.current.add(node);
      osc.onended = () => { activeNodesRef.current.delete(node); };
    } catch {
      /* ignore */
    }
  };
  const stopPreview = () => {
    previewTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
    previewTimeoutsRef.current = [];
    const ctx = audioCtxRef.current;
    const fade = 0.04; // 40ms gain fade-out for a smoother cut
    activeNodesRef.current.forEach(({ osc, gain }) => {
      try {
        if (ctx) {
          const now = ctx.currentTime;
          // Cancel any scheduled ramps and fade from current value to silence
          gain.gain.cancelScheduledValues(now);
          const current = Math.max(gain.gain.value, 0.0001);
          gain.gain.setValueAtTime(current, now);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + fade);
          osc.stop(now + fade);
          window.setTimeout(() => { try { osc.disconnect(); gain.disconnect(); } catch { /* ignore */ } }, Math.ceil(fade * 1000) + 20);
        } else {
          osc.stop();
          osc.disconnect();
          gain.disconnect();
        }
      } catch { /* ignore */ }
    });
    activeNodesRef.current.clear();
    setIsPreviewing(false);
  };
  const startPreview = () => {
    stopPreview();
    setIsPreviewing(true);
    playPageTone("up");
    previewTimeoutsRef.current.push(window.setTimeout(() => playPageTone("down"), 180));
    previewTimeoutsRef.current.push(window.setTimeout(() => playPageTone("edge"), 360));
    previewTimeoutsRef.current.push(window.setTimeout(() => setIsPreviewing(false), 500));
  };
  type SortKey = "po_number" | "vendor_name" | "items" | "total";
  const { value: sortKey, update: setSortKey } = useUserPreference<SortKey | null>("po_sort_key", null);
  const { value: sortDir, update: setSortDir } = useUserPreference<"asc" | "desc">("po_sort_dir", "asc");
  const [form, setForm] = useState({
    vendor_id: "",
    vendor_name: "",
    vendor_email: "",
    vendor_phone: "",
    expected_delivery: "",
    notes: "",
    currency: "USD",
    fx_rate: "1",
    tax_rate: "10",
    shipping_cost: "0",
    payment_terms: "Net 30",
    budget_code: "",
    job_id: "",
  });
  const [items, setItems] = useState<POItem[]>([{ description: "", quantity: 1, unit_price: 0 }]);

  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ["purchase_orders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("purchase_orders").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: vendors = [] } = useQuery({
    queryKey: ["vendors-picker"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vendors").select("id, name, email, phone, default_payment_terms").order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const addItem = () => setItems([...items, { description: "", quantity: 1, unit_price: 0 }]);
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i: number, key: string, value: any) => {
    setItems(items.map((item, idx) => idx === i ? { ...item, [key]: value } : item));
  };

  const subtotal = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const taxRateNum = Number(form.tax_rate) || 0;
  const shippingNum = Number(form.shipping_cost) || 0;
  const tax = subtotal * (taxRateNum / 100);
  const total = subtotal + tax + shippingNum;

  const onPickVendor = (vendorId: string) => {
    const v = vendors.find((x: any) => x.id === vendorId);
    if (!v) { setForm({ ...form, vendor_id: "" }); return; }
    setForm({
      ...form,
      vendor_id: v.id,
      vendor_name: v.name || "",
      vendor_email: v.email || "",
      vendor_phone: v.phone || "",
      payment_terms: v.default_payment_terms || form.payment_terms,
    });
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const payload: any = {
        vendor_id: form.vendor_id || null,
        vendor_name: form.vendor_name,
        vendor_email: form.vendor_email,
        vendor_phone: form.vendor_phone,
        items: items as any,
        subtotal,
        tax_rate: taxRateNum,
        tax_amount: tax,
        shipping_cost: shippingNum,
        total,
        currency: form.currency,
        fx_rate: Number(form.fx_rate) || 1,
        payment_terms: form.payment_terms || null,
        budget_code: form.budget_code || null,
        job_id: form.job_id || null,
        expected_delivery: form.expected_delivery || null,
        notes: form.notes,
        created_by: auth.user?.id || null,
      };
      const { error } = await supabase.from("purchase_orders").insert(payload);
      if (error) throw error;

      // Snapshot vendor item prices into history (best-effort)
      if (form.vendor_id) {
        const rows = items
          .filter((i) => i.description && i.unit_price > 0)
          .map((i) => ({
            vendor_id: form.vendor_id,
            description: i.description,
            unit_price: i.unit_price,
            currency: form.currency,
          }));
        if (rows.length) await supabase.from("vendor_price_history").insert(rows as any);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase_orders"] });
      toast.success("Purchase order created");
      setDialogOpen(false);
      setForm({ vendor_id: "", vendor_name: "", vendor_email: "", vendor_phone: "", expected_delivery: "", notes: "", currency: "USD", fx_rate: "1", tax_rate: "10", shipping_cost: "0", payment_terms: "Net 30", budget_code: "", job_id: "" });
      setItems([{ description: "", quantity: 1, unit_price: 0 }]);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filteredBase = (filter === "all" ? orders : orders.filter((o: any) => o.status === filter))
    .filter((o: any) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return [o.po_number, o.vendor_name, o.budget_code].filter(Boolean).some((s: string) => s.toLowerCase().includes(q));
    });
  // Pin the selected row so its highlight persists across filter/search changes
  // and list refetches while PODetailDialog is open.
  const pinnedSelected = detailId && !filteredBase.some((o: any) => o.id === detailId)
    ? orders.find((o: any) => o.id === detailId)
    : null;
  const filtered = pinnedSelected ? [pinnedSelected, ...filteredBase] : filteredBase;
  const totalSpend = orders.reduce((s: number, o: any) => s + Number(o.total), 0);

  const sorted = sortKey
    ? [...filtered].sort((a: any, b: any) => {
        const dir = sortDir === "asc" ? 1 : -1;
        let av: any; let bv: any;
        if (sortKey === "items") { av = (a.items as any[])?.length || 0; bv = (b.items as any[])?.length || 0; }
        else if (sortKey === "total") { av = Number(a.total || 0); bv = Number(b.total || 0); }
        else { av = (a[sortKey] || "").toString().toLowerCase(); bv = (b[sortKey] || "").toString().toLowerCase(); }
        if (av < bv) return -1 * dir;
        if (av > bv) return 1 * dir;
        return 0;
      })
    : filtered;

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      if (sortDir === "asc") setSortDir("desc");
      else { setSortKey(null); setSortDir("asc"); }
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(1);
  };

  const safePageSize = Math.max(1, Number(pageSize) || 25);
  const totalPages = Math.max(1, Math.ceil(sorted.length / safePageSize));
  const safePage = Math.min(Math.max(1, Number(page) || 1), totalPages);
  const pageStart = (safePage - 1) * safePageSize;
  const paged = sorted.slice(pageStart, pageStart + safePageSize);

  useEffect(() => {
    const total = sorted.length;
    if (total === 0) {
      setPageAnnouncement("No results");
    } else {
      const from = pageStart + 1;
      const to = Math.min(pageStart + safePageSize, total);
      setPageAnnouncement(`Showing ${from} to ${to} of ${total} results, page ${safePage} of ${totalPages}`);
    }
    const prev = prevPageRef.current;
    if (pageSound && prev !== null && prev !== safePage) {
      const dir = safePage === 1 || safePage === totalPages ? "edge" : safePage > prev ? "up" : "down";
      playPageTone(dir as "up" | "down" | "edge");
    }
    prevPageRef.current = safePage;
  }, [safePage, safePageSize, sorted.length, pageStart, totalPages, pageSound]);

  const SortHeader = ({ k, label, align = "left" }: { k: SortKey; label: string; align?: "left" | "right" }) => {
    const active = sortKey === k;
    const Icon = active ? (sortDir === "asc" ? ArrowUp : ArrowDown) : ChevronsUpDown;
    return (
      <button
        type="button"
        onClick={() => toggleSort(k)}
        aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
        className={`inline-flex items-center gap-1 hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded ${align === "right" ? "ml-auto" : ""} ${active ? "text-foreground" : ""}`}
      >
        <span>{label}</span>
        <Icon className={`w-3 h-3 ${active ? "opacity-100" : "opacity-50"}`} aria-hidden="true" />
      </button>
    );
  };

  return (
    <AppLayout title="Purchase Orders">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold">Purchase Orders</h1>
            <p className="text-muted-foreground text-sm">Vendor procurement, PO tracking & approval workflow</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button className="gap-2"><Plus className="w-4 h-4" /> New PO</Button></DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Create Purchase Order</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label>Vendor (from directory)</Label>
                    <Select value={form.vendor_id || "none"} onValueChange={(v) => onPickVendor(v === "none" ? "" : v)}>
                      <SelectTrigger><SelectValue placeholder="Pick a vendor or enter manually" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— Manual entry —</SelectItem>
                        {vendors.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Vendor name</Label><Input value={form.vendor_name} onChange={e => setForm({...form, vendor_name: e.target.value})} /></div>
                  <div><Label>Vendor email</Label><Input value={form.vendor_email} onChange={e => setForm({...form, vendor_email: e.target.value})} /></div>
                  <div><Label>Vendor phone</Label><Input value={form.vendor_phone} onChange={e => setForm({...form, vendor_phone: e.target.value})} /></div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <Label>Currency</Label>
                    <Select value={form.currency} onValueChange={(v) => setForm({...form, currency: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>FX rate</Label><Input type="number" step="0.0001" value={form.fx_rate} onChange={e => setForm({...form, fx_rate: e.target.value})} /></div>
                  <div><Label>Tax rate (%)</Label><Input type="number" step="0.01" value={form.tax_rate} onChange={e => setForm({...form, tax_rate: e.target.value})} /></div>
                  <div><Label>Shipping cost</Label><Input type="number" step="0.01" value={form.shipping_cost} onChange={e => setForm({...form, shipping_cost: e.target.value})} /></div>
                  <div><Label>Payment terms</Label><Input value={form.payment_terms} onChange={e => setForm({...form, payment_terms: e.target.value})} /></div>
                  <div><Label>Budget code</Label><Input placeholder="e.g. JOB-1234 / DEPT-OPS" value={form.budget_code} onChange={e => setForm({...form, budget_code: e.target.value})} /></div>
                  <div><Label>Linked job ID</Label><Input placeholder="optional" value={form.job_id} onChange={e => setForm({...form, job_id: e.target.value})} /></div>
                  <div><Label>Expected delivery</Label><Input type="date" value={form.expected_delivery} onChange={e => setForm({...form, expected_delivery: e.target.value})} /></div>
                </div>

                <div className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm">Line Items</h3>
                    <Button variant="outline" size="sm" onClick={addItem} className="gap-1"><Plus className="w-3 h-3" /> Add Item</Button>
                  </div>
                  {items.map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input className="flex-1" placeholder="Description" value={item.description} onChange={e => updateItem(i, "description", e.target.value)} />
                      <Input className="w-20" type="number" placeholder="Qty" value={item.quantity} onChange={e => updateItem(i, "quantity", parseInt(e.target.value) || 0)} />
                      <Input className="w-24" type="number" placeholder="Price" value={item.unit_price} onChange={e => updateItem(i, "unit_price", parseFloat(e.target.value) || 0)} />
                      <span className="text-sm font-medium w-24 text-right">{fmtMoney(item.quantity * item.unit_price, form.currency)}</span>
                      {items.length > 1 && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeItem(i)}><Trash2 className="w-3 h-3 text-destructive" /></Button>}
                    </div>
                  ))}
                  <div className="border-t pt-2 space-y-1 text-sm text-right">
                    <p>Subtotal: <strong>{fmtMoney(subtotal, form.currency)}</strong></p>
                    <p>Tax ({taxRateNum}%): <strong>{fmtMoney(tax, form.currency)}</strong></p>
                    <p>Shipping: <strong>{fmtMoney(shippingNum, form.currency)}</strong></p>
                    <p className="text-base">Total: <strong>{fmtMoney(total, form.currency)}</strong></p>
                  </div>
                </div>

                <div>
                  <Label>Notes</Label>
                  <Input value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
                </div>
                <Button onClick={() => createMutation.mutate()} disabled={!form.vendor_name || items.every(i => !i.description) || createMutation.isPending}>
                  {createMutation.isPending ? "Creating…" : "Create Purchase Order"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: "Total POs", value: orders.length, icon: ShoppingCart, color: "text-blue-600" },
            { label: "Total Spend", value: `$${totalSpend.toLocaleString()}`, icon: DollarSign, color: "text-emerald-600" },
            { label: "Pending", value: orders.filter((o: any) => o.status === "submitted").length, icon: Package, color: "text-amber-600" },
            { label: "In Transit", value: orders.filter((o: any) => o.status === "ordered").length, icon: Truck, color: "text-purple-600" },
          ].map(s => (
            <Card key={s.label} className="transition-colors hover:bg-muted/30">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-muted ${s.color}`} aria-hidden="true"><s.icon className="w-5 h-5" /></div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground truncate">{s.label}</p>
                  {ordersLoading ? (
                    <Skeleton className="h-6 w-20 mt-1" />
                  ) : (
                    <p className="text-xl font-bold tabular-nums truncate">{s.value}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          {STATUS_FILTERS.map(f => (
            <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)} className="capitalize">
              {f} {f !== "all" && (
                <span className="ml-1.5 text-[10px] opacity-70">
                  {orders.filter((o: any) => o.status === f).length}
                </span>
              )}
            </Button>
          ))}
          <div className="relative ml-auto max-w-xs w-full">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" aria-hidden="true" />
            <Input
              placeholder="Search PO #, vendor, budget code…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-8 h-9"
              aria-label="Search purchase orders"
            />
            {search && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearch("")}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Label htmlFor="po-page-jump" className="text-xs whitespace-nowrap">Pg jump</Label>
            <Select value={String(pageJump ?? 10)} onValueChange={(v) => setPageJump(Number(v))}>
              <SelectTrigger id="po-page-jump" className="h-9 w-[80px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[5, 10, 20, 25, 50, 100].map(n => (
                  <SelectItem key={n} value={String(n)}>{n} rows</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="Keyboard shortcuts"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <Keyboard className="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" align="end" className="max-w-xs text-xs leading-relaxed p-3">
                  <p className="font-semibold mb-2 text-foreground">Keyboard shortcuts</p>
                  <ul className="space-y-1.5">
                    <li className="flex items-center justify-between gap-3"><span>Move row</span><kbd className="px-1.5 py-0.5 rounded border border-border bg-muted font-mono text-[10px]">↑ / ↓</kbd></li>
                    <li className="flex items-center justify-between gap-3"><span>Jump {Math.max(1, Number(pageJump) || 10)} rows</span><kbd className="px-1.5 py-0.5 rounded border border-border bg-muted font-mono text-[10px]">PgUp / PgDn</kbd></li>
                    <li className="flex items-center justify-between gap-3"><span>First / Last row</span><kbd className="px-1.5 py-0.5 rounded border border-border bg-muted font-mono text-[10px]">Home / End or ⌘/Ctrl + Home / End</kbd></li>
                    <li className="flex items-center justify-between gap-3"><span>Open PO detail</span><kbd className="px-1.5 py-0.5 rounded border border-border bg-muted font-mono text-[10px]">Enter / Space</kbd></li>
                  </ul>
                  <p className="mt-2 text-[10px] text-muted-foreground">
                    Change <span className="font-medium text-foreground">Pg jump</span> to control how many rows PageUp/PageDown skips. Saved to your account.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={!!pageSound}
                    aria-label={pageSound ? "Disable pagination sound cues" : "Enable pagination sound cues"}
                    onClick={() => {
                      const next = !pageSound;
                      setPageSound(next);
                      if (next) playPageTone("up");
                    }}
                    className={`inline-flex h-7 w-7 items-center justify-center rounded-md border border-border focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${pageSound ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
                  >
                    {pageSound ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" align="end" className="text-xs">
                  {pageSound ? "Pagination sound cues on" : "Pagination sound cues off"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {pageSound && (
              <div className="flex items-center gap-1.5">
                <Label htmlFor="po-page-sound-volume" className="sr-only">Pagination tone volume</Label>
                <input
                  id="po-page-sound-volume"
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={Number(pageSoundVolume) || 0}
                  onChange={(e) => setPageSoundVolume(Number(e.target.value))}
                  onMouseUp={() => playPageTone("up")}
                  onKeyUp={() => playPageTone("up")}
                  aria-label="Pagination tone volume"
                  aria-valuetext={`${Number(pageSoundVolume) || 0} percent`}
                  className="h-1 w-20 cursor-pointer accent-primary"
                  title={`Tone volume: ${Number(pageSoundVolume) || 0}%`}
                />
                <span className="tabular-nums text-[10px] text-muted-foreground w-7 text-right">{Number(pageSoundVolume) || 0}%</span>
                <button
                  type="button"
                  onClick={startPreview}
                  disabled={(Number(pageSoundVolume) || 0) <= 0}
                  className="text-[10px] px-1.5 py-0.5 rounded border border-border hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Preview pagination tones (up, down, edge)"
                  title="Preview tones"
                >
                  Preview
                </button>
                <button
                  type="button"
                  onClick={stopPreview}
                  disabled={!isPreviewing}
                  className="text-[10px] px-1.5 py-0.5 rounded border border-border hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Stop tone preview"
                  title="Stop preview"
                >
                  Stop
                </button>
              </div>
            )}
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75">
                <TableRow>
                  <TableHead><SortHeader k="po_number" label="PO #" /></TableHead>
                  <TableHead><SortHeader k="vendor_name" label="Vendor" /></TableHead>
                  <TableHead className="text-right"><SortHeader k="items" label="Items" align="right" /></TableHead>
                  <TableHead className="text-right"><SortHeader k="total" label="Total" align="right" /></TableHead>
                  <TableHead>Delivery</TableHead>
                  <TableHead>Receive</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ordersLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={`sk-${i}`}>
                      {Array.from({ length: 7 }).map((__, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-full max-w-[120px]" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : paged.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12">
                      <div className="flex flex-col items-center justify-center text-center gap-2 text-muted-foreground">
                        <div className="rounded-full bg-muted p-3"><Inbox className="w-5 h-5" aria-hidden="true" /></div>
                        <p className="font-medium text-foreground">No purchase orders found</p>
                        <p className="text-xs max-w-sm">
                          {search || filter !== "all"
                            ? "Try clearing filters or adjusting your search to see more results."
                            : "Create your first PO to start tracking vendor procurement."}
                        </p>
                        {(search || filter !== "all") && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-1"
                            onClick={() => { setSearch(""); setFilter("all"); }}
                          >
                            Clear filters
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : paged.map((o: any, idx: number) => {
                  const isSelected = detailId === o.id;
                  const isFocused = focusedId === o.id || (!focusedId && idx === 0);
                  return (
                  <TableRow
                    key={o.id}
                    tabIndex={isFocused ? 0 : -1}
                    data-po-row={o.id}
                    onClick={() => { setFocusedId(o.id); setDetailId(o.id); }}
                    onFocus={() => setFocusedId(o.id)}
                    onKeyDown={(e) => {
                      const PAGE = Math.max(1, Number(pageJump) || 10);
                      const focusRow = (target: any) => {
                        if (!target) return;
                        setFocusedId(target.id);
                        requestAnimationFrame(() => {
                          (document.querySelector(`[data-po-row="${target.id}"]`) as HTMLElement | null)?.focus();
                        });
                      };
                      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                        e.preventDefault();
                        const dir = e.key === "ArrowDown" ? 1 : -1;
                        focusRow(paged[Math.min(paged.length - 1, Math.max(0, idx + dir))]);
                      } else if (e.key === "PageDown" || e.key === "PageUp") {
                        e.preventDefault();
                        const dir = e.key === "PageDown" ? PAGE : -PAGE;
                        focusRow(paged[Math.min(paged.length - 1, Math.max(0, idx + dir))]);
                      } else if (e.key === "Home" || e.key === "End") {
                        e.preventDefault();
                        focusRow(e.key === "Home" ? paged[0] : paged[paged.length - 1]);
                      } else if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setDetailId(o.id);
                      }
                    }}
                    aria-selected={isSelected}
                    className={`cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-inset ${
                      isSelected
                        ? "bg-primary/10 hover:bg-primary/15 ring-1 ring-inset ring-primary/40 shadow-[inset_3px_0_0_0_hsl(var(--primary))]"
                        : isFocused && focusedId
                        ? "bg-muted/60"
                        : "hover:bg-muted/40"
                    }`}
                  >
                    <TableCell className="font-mono font-medium">
                      <span className="inline-flex items-center gap-1.5">
                        {o.po_number}
                        {pinnedSelected && pinnedSelected.id === o.id && (
                          <span className="inline-flex items-center gap-0.5 rounded-full border border-primary/40 text-primary text-[9px] pl-1.5 pr-0.5 py-0">
                            pinned
                            <button
                              type="button"
                              aria-label="Unpin row"
                              title="Clear pinned highlight"
                              onClick={(e) => { e.stopPropagation(); setConfirmUnpin(true); }}
                              onKeyDown={(e) => e.stopPropagation()}
                              className="ml-0.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full hover:bg-primary/15 focus:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                            >
                              <Trash2 className="w-2.5 h-2.5" />
                            </button>
                          </span>
                        )}
                      </span>
                    </TableCell>
                    <TableCell>{o.vendor_name}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{(o.items as any[])?.length || 0}</TableCell>
                    <TableCell className="font-medium text-right tabular-nums">{fmtMoney(Number(o.total || 0), o.currency || "USD")}</TableCell>
                    <TableCell>{o.expected_delivery ? format(new Date(o.expected_delivery), "MMM d, yyyy") : "—"}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{(o.receive_status || "unreceived").replace(/_/g, " ")}</Badge></TableCell>
                    <TableCell><Badge className={statusColors[o.status] || ""}>{o.status}</Badge></TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-t flex-wrap">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Label htmlFor="po-page-size" className="text-xs">Rows per page</Label>
                <Select value={String(safePageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
                  <SelectTrigger id="po-page-size" className="h-8 w-[80px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[10, 25, 50, 100, 200].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
                <span className="ml-2 tabular-nums" aria-live="polite">
                  {sorted.length === 0 ? "0" : `${pageStart + 1}–${Math.min(pageStart + safePageSize, sorted.length)}`} of {sorted.length}
                </span>
              </div>
              <nav
                aria-label="Pagination"
                className="flex items-center gap-1"
                onKeyDown={(e) => {
                  const tag = (e.target as HTMLElement).tagName;
                  if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
                  const jump = Math.max(1, Number(pageJump) || 10);
                  let next: number | null = null;
                  if (e.key === "ArrowLeft") next = safePage - 1;
                  else if (e.key === "ArrowRight") next = safePage + 1;
                  else if (e.key === "Home") next = 1;
                  else if (e.key === "End") next = totalPages;
                  else if (e.key === "PageUp") next = safePage - jump;
                  else if (e.key === "PageDown") next = safePage + jump;
                  if (next !== null) {
                    e.preventDefault();
                    const target = Math.min(totalPages, Math.max(1, next));
                    setPage(target);
                    // Focus management: if the active button becomes disabled, shift focus to a still-enabled neighbor.
                    requestAnimationFrame(() => {
                      const active = document.activeElement as HTMLElement | null;
                      if (!active || !active.hasAttribute("data-pagination-btn")) return;
                      if (!(active as HTMLButtonElement).disabled) return;
                      if (target <= 1) nextBtnRef.current?.focus();
                      else if (target >= totalPages) prevBtnRef.current?.focus();
                    });
                  }
                }}
              >
                <span className="sr-only" aria-live="polite" aria-atomic="true" role="status">{pageAnnouncement}</span>
                <span className="sr-only" aria-live="assertive" aria-atomic="true" role="status">{focusAnnouncement}</span>
                <Button ref={firstBtnRef} data-pagination-btn variant="outline" size="sm" disabled={safePage <= 1} onClick={() => { setPage(1); requestAnimationFrame(() => { if (firstBtnRef.current?.disabled) nextBtnRef.current?.focus(); else firstBtnRef.current?.focus(); }); }} aria-label="Go to first page">« First</Button>
                <Button ref={prevBtnRef} data-pagination-btn variant="outline" size="sm" disabled={safePage <= 1} onClick={() => { const t = Math.max(1, safePage - 1); setPage(t); requestAnimationFrame(() => { if (t <= 1) nextBtnRef.current?.focus(); else prevBtnRef.current?.focus(); }); }} aria-label="Go to previous page">‹ Prev</Button>
                <span className="px-2 text-xs text-muted-foreground" aria-live="polite" aria-atomic="true">Page <span aria-current="page">{safePage}</span> of {totalPages}</span>
                <Button ref={nextBtnRef} data-pagination-btn variant="outline" size="sm" disabled={safePage >= totalPages} onClick={() => { const t = Math.min(totalPages, safePage + 1); setPage(t); requestAnimationFrame(() => { if (t >= totalPages) prevBtnRef.current?.focus(); else nextBtnRef.current?.focus(); }); }} aria-label="Go to next page">Next ›</Button>
                <Button ref={lastBtnRef} data-pagination-btn variant="outline" size="sm" disabled={safePage >= totalPages} onClick={() => { setPage(totalPages); requestAnimationFrame(() => { if (lastBtnRef.current?.disabled) prevBtnRef.current?.focus(); else lastBtnRef.current?.focus(); }); }} aria-label="Go to last page">Last »</Button>
                <form
                  className="flex items-start gap-1 ml-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const input = (e.currentTarget.elements.namedItem("po-jump") as HTMLInputElement | null);
                    const raw = jumpInput.trim();
                    if (raw === "") { setJumpError("Enter a page number"); input?.focus(); return; }
                    const n = parseInt(raw, 10);
                    if (!Number.isFinite(n) || String(n) !== raw.replace(/^0+(?=\d)/, "")) { setJumpError("Enter a whole number"); input?.focus(); return; }
                    if (n < 1 || n > totalPages) { setJumpError(`Must be between 1 and ${totalPages}`); input?.focus(); return; }
                    setJumpError(null);
                    setJumpInput("");
                    setPage(n);
                    // Focus restoration priority:
                    // 1) Prev when jumping to last page
                    // 2) Next when jumping to first page
                    // 3) Next, then Prev, then First, then Last
                    // 4) Fallback: keep focus in the jump input
                    requestAnimationFrame(() => {
                      const tryFocus = (el: HTMLButtonElement | null) =>
                        el && !el.disabled && (el.focus(), true);
                      const labelFor = (el: HTMLButtonElement | null) =>
                        el === firstBtnRef.current ? "First page button"
                        : el === prevBtnRef.current ? "Previous page button"
                        : el === nextBtnRef.current ? "Next page button"
                        : el === lastBtnRef.current ? "Last page button"
                        : "";
                      const ordered =
                        n >= totalPages
                          ? [prevBtnRef.current, firstBtnRef.current, nextBtnRef.current, lastBtnRef.current]
                          : n <= 1
                            ? [nextBtnRef.current, lastBtnRef.current, prevBtnRef.current, firstBtnRef.current]
                            : [nextBtnRef.current, prevBtnRef.current, firstBtnRef.current, lastBtnRef.current];
                      const focused = ordered.find((el) => tryFocus(el)) ?? null;
                      const target = focused
                        ? `Jumped to page ${n}. Focus moved to ${labelFor(focused)}.`
                        : `Jumped to page ${n}. Focus returned to page jump input.`;
                      if (!focused) input?.focus();
                      // Force re-announce even if message is identical
                      setFocusAnnouncement("");
                      requestAnimationFrame(() => setFocusAnnouncement(target));
                    });
                  }}
                >
                  <Label htmlFor="po-jump" className="text-xs whitespace-nowrap text-muted-foreground mt-2">Go to</Label>
                  <div className="flex flex-col">
                    <Input
                      id="po-jump"
                      name="po-jump"
                      type="number"
                      min={1}
                      max={totalPages}
                      value={jumpInput}
                      placeholder={String(safePage)}
                      onChange={(e) => {
                        setJumpInput(e.target.value);
                        if (jumpError) setJumpError(null);
                      }}
                      className={`h-8 w-20 ${jumpError ? "border-destructive focus-visible:ring-destructive" : ""}`}
                      aria-label="Jump to page"
                      aria-invalid={!!jumpError}
                      aria-describedby={jumpError ? "po-jump-error" : undefined}
                    />
                    {jumpError && (
                      <span id="po-jump-error" role="alert" className="text-[10px] text-destructive mt-0.5 whitespace-nowrap">
                        {jumpError}
                      </span>
                    )}
                  </div>
                  <Button type="submit" variant="outline" size="sm">Go</Button>
                </form>
              </nav>
            </div>
          </CardContent>
        </Card>
      </div>

      <PODetailDialog open={!!detailId} onOpenChange={(o) => { if (!o) setDetailId(null); }} poId={detailId} />

      <AlertDialog open={confirmUnpin} onOpenChange={setConfirmUnpin}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unpin this purchase order?</AlertDialogTitle>
            <AlertDialogDescription>
              {pinnedSelected
                ? `PO ${pinnedSelected.po_number} is pinned because it doesn't match the current filter or search. Unpinning clears the highlight and removes it from the list.`
                : "Unpinning clears the highlight for the selected purchase order."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep pinned</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setDetailId(null); setConfirmUnpin(false); }}>
              Unpin
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default PurchaseOrders;
