import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Building, Search, Star, Globe, HandCoins, Plus, Users,
  TrendingUp, Shield, FileCheck, CheckCircle2, AlertTriangle,
} from "lucide-react";

interface Vendor {
  id: string;
  name: string;
  type: "subcontractor" | "supplier" | "oem" | "logistics";
  country: string;
  regions: string[];
  rating: number;
  activeContracts: number;
  totalRevenue: number;
  complianceScore: number;
  status: "active" | "probation" | "suspended" | "onboarding";
  paymentTerms: string;
  slaCompliance: number;
  contactName: string;
  contactEmail: string;
  specialties: string[];
}

const mockVendors: Vendor[] = [
  { id: "1", name: "TechForce Solutions", type: "subcontractor", country: "UK", regions: ["EMEA", "APAC"], rating: 4.8, activeContracts: 12, totalRevenue: 450000, complianceScore: 96, status: "active", paymentTerms: "Net 30", slaCompliance: 98, contactName: "John Smith", contactEmail: "john@techforce.co.uk", specialties: ["Data Center", "Network Install"] },
  { id: "2", name: "Pacific IT Services", type: "subcontractor", country: "Australia", regions: ["APAC"], rating: 4.6, activeContracts: 8, totalRevenue: 280000, complianceScore: 92, status: "active", paymentTerms: "Net 45", slaCompliance: 95, contactName: "Lisa Wong", contactEmail: "lisa@pacificits.au", specialties: ["Cabling", "Wireless"] },
  { id: "3", name: "Cisco Systems", type: "oem", country: "USA", regions: ["Global"], rating: 4.9, activeContracts: 5, totalRevenue: 1200000, complianceScore: 99, status: "active", paymentTerms: "Net 60", slaCompliance: 99, contactName: "Partner Team", contactEmail: "partners@cisco.com", specialties: ["Networking", "Security"] },
  { id: "4", name: "DHL Supply Chain", type: "logistics", country: "Germany", regions: ["Global"], rating: 4.5, activeContracts: 3, totalRevenue: 180000, complianceScore: 94, status: "active", paymentTerms: "Net 30", slaCompliance: 93, contactName: "Mark Weber", contactEmail: "mark@dhl.com", specialties: ["Last Mile", "Warehousing"] },
  { id: "5", name: "InfraBuild LATAM", type: "subcontractor", country: "Brazil", regions: ["LATAM"], rating: 4.2, activeContracts: 4, totalRevenue: 95000, complianceScore: 78, status: "probation", paymentTerms: "Net 15", slaCompliance: 82, contactName: "Carlos Silva", contactEmail: "carlos@infrabuild.br", specialties: ["Electrical", "UPS"] },
  { id: "6", name: "NovaTech Africa", type: "subcontractor", country: "South Africa", regions: ["MEA"], rating: 4.0, activeContracts: 2, totalRevenue: 55000, complianceScore: 70, status: "onboarding", paymentTerms: "Net 30", slaCompliance: 0, contactName: "Thabo Ndlovu", contactEmail: "thabo@novatech.za", specialties: ["CCTV", "Access Control"] },
];

const statusColor = (s: string) => {
  switch (s) {
    case "active": return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
    case "probation": return "bg-amber-500/10 text-amber-400 border-amber-500/30";
    case "suspended": return "bg-red-500/10 text-red-400 border-red-500/30";
    case "onboarding": return "bg-blue-500/10 text-blue-400 border-blue-500/30";
    default: return "";
  }
};

const typeColor = (t: string) => {
  switch (t) {
    case "subcontractor": return "bg-primary/10 text-primary border-primary/30";
    case "oem": return "bg-purple-500/10 text-purple-400 border-purple-500/30";
    case "supplier": return "bg-cyan-500/10 text-cyan-400 border-cyan-500/30";
    case "logistics": return "bg-amber-500/10 text-amber-400 border-amber-500/30";
    default: return "";
  }
};

const VendorManagement = () => {
  const [search, setSearch] = useState("");

  const filtered = mockVendors.filter(v =>
    v.name.toLowerCase().includes(search.toLowerCase()) ||
    v.country.toLowerCase().includes(search.toLowerCase()) ||
    v.specialties.some(s => s.toLowerCase().includes(search.toLowerCase()))
  );

  const totalRevenue = mockVendors.reduce((a, v) => a + v.totalRevenue, 0);
  const avgCompliance = Math.round(mockVendors.reduce((a, v) => a + v.complianceScore, 0) / mockVendors.length);
  const activeVendors = mockVendors.filter(v => v.status === "active").length;

  return (
    <AppLayout title="Vendor Management">
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Vendor & Subcontractor Management</h1>
            <p className="text-sm text-muted-foreground">
              Multi-vendor network management — matching Neeco's global partner network & IRON's vendor portal
            </p>
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" /> Add Vendor</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Onboard New Vendor</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Company Name</Label><Input placeholder="Vendor company name" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Country</Label><Input placeholder="Country" /></div>
                  <div><Label>Payment Terms</Label><Input placeholder="Net 30" /></div>
                </div>
                <div><Label>Contact Name</Label><Input placeholder="Primary contact" /></div>
                <div><Label>Contact Email</Label><Input type="email" placeholder="email@vendor.com" /></div>
                <div><Label>Specialties</Label><Input placeholder="Data Center, Cabling, etc." /></div>
                <div><Label>Notes</Label><Textarea placeholder="Additional notes..." /></div>
                <Button className="w-full" onClick={() => toast.success("Vendor added to onboarding pipeline")}>Add Vendor</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card><CardContent className="p-4 text-center">
            <Building className="h-8 w-8 text-primary mx-auto mb-2" />
            <div className="text-2xl font-bold">{mockVendors.length}</div>
            <div className="text-xs text-muted-foreground">Total Vendors</div>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
            <div className="text-2xl font-bold">{activeVendors}</div>
            <div className="text-xs text-muted-foreground">Active</div>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <Shield className="h-8 w-8 text-blue-400 mx-auto mb-2" />
            <div className="text-2xl font-bold">{avgCompliance}%</div>
            <div className="text-xs text-muted-foreground">Avg Compliance</div>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <HandCoins className="h-8 w-8 text-amber-400 mx-auto mb-2" />
            <div className="text-2xl font-bold">${(totalRevenue / 1000000).toFixed(1)}M</div>
            <div className="text-xs text-muted-foreground">Total Spend</div>
          </CardContent></Card>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search vendors, countries, or specialties..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {/* Vendor Table */}
        <Card>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Vendor</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Regions</TableHead>
              <TableHead>Rating</TableHead>
              <TableHead>Contracts</TableHead>
              <TableHead>Revenue</TableHead>
              <TableHead>SLA %</TableHead>
              <TableHead>Compliance</TableHead>
              <TableHead>Status</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filtered.map(v => (
                <TableRow key={v.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{v.name}</div>
                      <div className="text-xs text-muted-foreground">{v.country} · {v.contactName}</div>
                    </div>
                  </TableCell>
                  <TableCell><Badge className={typeColor(v.type)}>{v.type}</Badge></TableCell>
                  <TableCell><div className="flex flex-wrap gap-1">{v.regions.map(r => <Badge key={r} variant="outline" className="text-[10px]">{r}</Badge>)}</div></TableCell>
                  <TableCell><div className="flex items-center gap-1"><Star className="h-3 w-3 text-amber-400 fill-amber-400" />{v.rating}</div></TableCell>
                  <TableCell>{v.activeContracts}</TableCell>
                  <TableCell>${(v.totalRevenue / 1000).toFixed(0)}K</TableCell>
                  <TableCell>
                    {v.slaCompliance > 0 ? (
                      <div className="flex items-center gap-2">
                        <Progress value={v.slaCompliance} className="h-2 w-16" />
                        <span className="text-xs">{v.slaCompliance}%</span>
                      </div>
                    ) : <span className="text-xs text-muted-foreground">N/A</span>}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={v.complianceScore} className="h-2 w-16" />
                      <span className="text-xs">{v.complianceScore}%</span>
                    </div>
                  </TableCell>
                  <TableCell><Badge className={statusColor(v.status)}>{v.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </AppLayout>
  );
};

export default VendorManagement;
