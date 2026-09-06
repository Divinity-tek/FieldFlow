import { useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Package, Plus, Search, AlertTriangle, Box, Wrench, Archive } from "lucide-react";
import { toast } from "sonner";
// import AskAIButton from "@/components/ai/AskAIButton";

const statusColors: Record<string, string> = {
  available: "bg-green-500/10 text-green-600 border-green-500/20",
  in_use: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  maintenance: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  retired: "bg-red-500/10 text-red-600 border-red-500/20",
};

const categories = ["Networking", "Cabling", "Tools", "Compute", "Storage", "Power", "General"];

const Inventory = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: "", category: "General", serial_number: "", location: "", warehouse: "", quantity: "1", min_stock_level: "0", unit_cost: "0", notes: "" });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["inventory-items"],
    queryFn: async () => {
      const { data, error } = await supabase.from("inventory_items").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (item: typeof form) => {
      const { error } = await supabase.from("inventory_items").insert({
        name: item.name,
        category: item.category,
        serial_number: item.serial_number || null,
        location: item.location || null,
        warehouse: item.warehouse || null,
        quantity: parseInt(item.quantity) || 1,
        min_stock_level: parseInt(item.min_stock_level) || 0,
        unit_cost: parseFloat(item.unit_cost) || 0,
        notes: item.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
      toast.success("Item added to inventory");
      setDialogOpen(false);
      setForm({ name: "", category: "General", serial_number: "", location: "", warehouse: "", quantity: "1", min_stock_level: "0", unit_cost: "0", notes: "" });
    },
    onError: () => toast.error("Failed to add item"),
  });

  const filtered = items.filter((item: any) => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase()) || item.serial_number?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === "all" || item.status === filterStatus;
    const matchesCategory = filterCategory === "all" || item.category === filterCategory;
    return matchesSearch && matchesStatus && matchesCategory;
  });

  const totalValue = items.reduce((sum: number, i: any) => sum + (i.unit_cost * i.quantity), 0);
  const lowStock = items.filter((i: any) => i.quantity <= i.min_stock_level && i.min_stock_level > 0);
  const inUse = items.filter((i: any) => i.status === "in_use").length;

  return (
    <AppLayout title="Inventory & Assets" subtitle="Track hardware, spare parts, and equipment lifecycle">
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><Package className="w-5 h-5 text-primary" /></div><div><p className="text-2xl font-bold">{items.length}</p><p className="text-xs text-muted-foreground">Total Items</p></div></div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center"><Box className="w-5 h-5 text-blue-500" /></div><div><p className="text-2xl font-bold">{inUse}</p><p className="text-xs text-muted-foreground">In Use</p></div></div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-yellow-500" /></div><div><p className="text-2xl font-bold">{lowStock.length}</p><p className="text-xs text-muted-foreground">Low Stock</p></div></div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center"><Wrench className="w-5 h-5 text-green-500" /></div><div><p className="text-2xl font-bold">£{totalValue.toLocaleString()}</p><p className="text-xs text-muted-foreground">Total Value</p></div></div></CardContent></Card>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search by name, serial number, or location…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="available">Available</SelectItem>
              <SelectItem value="in_use">In Use</SelectItem>
              <SelectItem value="maintenance">Maintenance</SelectItem>
              <SelectItem value="retired">Retired</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button><Plus className="w-4 h-4 mr-1" /> Add Item</Button>
                </TooltipTrigger>
                <TooltipContent><p className="text-xs">Add a new equipment or spare part to inventory</p></TooltipContent>
              </Tooltip>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Inventory Item</DialogTitle></DialogHeader>
              <div className="grid gap-3">
                <div><Label>Name *</Label><Input placeholder="e.g. Cat6 Ethernet Cable" value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Category</Label><Select value={form.category} onValueChange={v => setForm({...form, category: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
                  <div><Label>Serial #</Label><Input placeholder="e.g. SN-2024-001" value={form.serial_number} onChange={e => setForm({...form, serial_number: e.target.value})} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Location</Label><Input placeholder="e.g. Rack A, Shelf 3" value={form.location} onChange={e => setForm({...form, location: e.target.value})} /></div>
                  <div><Label>Warehouse</Label><Input placeholder="e.g. London Central" value={form.warehouse} onChange={e => setForm({...form, warehouse: e.target.value})} /></div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div><Label>Quantity</Label><Input type="number" placeholder="1" value={form.quantity} onChange={e => setForm({...form, quantity: e.target.value})} /></div>
                  <div><Label>Min Stock</Label><Input type="number" placeholder="Alert when below this" value={form.min_stock_level} onChange={e => setForm({...form, min_stock_level: e.target.value})} /></div>
                  <div><Label>Unit Cost (£)</Label><Input type="number" placeholder="0.00" value={form.unit_cost} onChange={e => setForm({...form, unit_cost: e.target.value})} /></div>
                </div>
                <div><Label>Notes</Label><Textarea placeholder="Optional notes about this item…" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div>
                <Button onClick={() => createMutation.mutate(form)} disabled={!form.name || createMutation.isPending}>
                  {createMutation.isPending ? "Adding..." : "Add Item"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          {/* <AskAIButton prompt="Analyze inventory levels, identify items at risk of stockout, and suggest optimal reorder quantities based on usage patterns." label="AI Analysis" /> */}
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Serial #</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No items found</TableCell></TableRow>
                ) : filtered.map((item: any) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>{item.category}</TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">{item.serial_number || "—"}</TableCell>
                    <TableCell><Badge variant="outline" className={statusColors[item.status] || ""}>{item.status.replace("_", " ")}</Badge></TableCell>
                    <TableCell className="text-muted-foreground">{item.warehouse || item.location || "—"}</TableCell>
                    <TableCell className="text-right">
                      <span className={item.quantity <= item.min_stock_level && item.min_stock_level > 0 ? "text-red-500 font-bold" : ""}>
                        {item.quantity}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">£{(item.unit_cost || 0).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Inventory;
