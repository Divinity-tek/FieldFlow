import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  ShieldCheck, AlertTriangle, Clock, CheckCircle2, FileWarning,
  Upload, Search, Filter, Plus, Award, Calendar, Eye,
} from "lucide-react";

type CertStatus = "valid" | "expiring" | "expired" | "pending";

interface Certification {
  id: string;
  engineerName: string;
  engineerId: string;
  certName: string;
  certType: "technical" | "safety" | "vendor" | "regulatory";
  issuedDate: string;
  expiryDate: string;
  status: CertStatus;
  issuingBody: string;
  documentUrl?: string;
  verified: boolean;
}

interface InsuranceRecord {
  id: string;
  engineerName: string;
  policyNumber: string;
  provider: string;
  coverageType: string;
  startDate: string;
  endDate: string;
  status: CertStatus;
  coverageAmount: number;
  verified: boolean;
}

interface BackgroundCheck {
  id: string;
  engineerName: string;
  checkType: string;
  provider: string;
  completedDate: string;
  expiryDate: string;
  result: "clear" | "flagged" | "pending";
  notes: string;
}

const mockCerts: Certification[] = [
  { id: "1", engineerName: "James Wilson", engineerId: "e1", certName: "CompTIA A+", certType: "technical", issuedDate: "2024-03-15", expiryDate: "2027-03-15", status: "valid", issuingBody: "CompTIA", verified: true },
  { id: "2", engineerName: "Sarah Chen", engineerId: "e2", certName: "OSHA 30-Hour", certType: "safety", issuedDate: "2023-06-01", expiryDate: "2026-06-01", status: "valid", issuingBody: "OSHA", verified: true },
  { id: "3", engineerName: "Mike Johnson", engineerId: "e3", certName: "Cisco CCNA", certType: "vendor", issuedDate: "2023-01-10", expiryDate: "2026-01-10", status: "expiring", issuingBody: "Cisco", verified: true },
  { id: "4", engineerName: "Lisa Park", engineerId: "e4", certName: "ISO 27001 Auditor", certType: "regulatory", issuedDate: "2022-09-20", expiryDate: "2025-09-20", status: "expired", issuingBody: "IRCA", verified: false },
  { id: "5", engineerName: "Tom Brown", engineerId: "e5", certName: "AWS Solutions Architect", certType: "vendor", issuedDate: "2024-11-01", expiryDate: "2027-11-01", status: "valid", issuingBody: "Amazon", verified: true },
  { id: "6", engineerName: "Emily Davis", engineerId: "e6", certName: "First Aid/CPR", certType: "safety", issuedDate: "2024-01-15", expiryDate: "2026-01-15", status: "valid", issuingBody: "Red Cross", verified: true },
  { id: "7", engineerName: "James Wilson", engineerId: "e1", certName: "BICSI Installer", certType: "technical", issuedDate: "2023-05-20", expiryDate: "2026-05-20", status: "expiring", issuingBody: "BICSI", verified: true },
  { id: "8", engineerName: "Carlos Mendez", engineerId: "e7", certName: "Electrical License", certType: "regulatory", issuedDate: "2024-07-01", expiryDate: "2026-07-01", status: "valid", issuingBody: "State Board", verified: false },
];

const mockInsurance: InsuranceRecord[] = [
  { id: "1", engineerName: "James Wilson", policyNumber: "POL-2024-0451", provider: "Allianz", coverageType: "Professional Liability", startDate: "2024-01-01", endDate: "2025-01-01", status: "expiring", coverageAmount: 2000000, verified: true },
  { id: "2", engineerName: "Sarah Chen", policyNumber: "POL-2024-0788", provider: "AIG", coverageType: "General Liability", startDate: "2024-06-01", endDate: "2025-06-01", status: "valid", coverageAmount: 5000000, verified: true },
  { id: "3", engineerName: "Mike Johnson", policyNumber: "POL-2023-1122", provider: "Zurich", coverageType: "Workers Comp", startDate: "2023-03-01", endDate: "2025-03-01", status: "expired", coverageAmount: 1000000, verified: false },
];

const mockBgChecks: BackgroundCheck[] = [
  { id: "1", engineerName: "James Wilson", checkType: "Criminal Background", provider: "Sterling", completedDate: "2024-01-15", expiryDate: "2026-01-15", result: "clear", notes: "Passed all checks" },
  { id: "2", engineerName: "Sarah Chen", checkType: "Drug Screening", provider: "Quest Diagnostics", completedDate: "2024-06-10", expiryDate: "2025-06-10", result: "clear", notes: "10-panel clear" },
  { id: "3", engineerName: "Mike Johnson", checkType: "Criminal Background", provider: "Sterling", completedDate: "2023-11-01", expiryDate: "2025-11-01", result: "flagged", notes: "Minor traffic violation — approved with note" },
  { id: "4", engineerName: "Tom Brown", checkType: "Reference Check", provider: "Internal", completedDate: "2024-10-20", expiryDate: "2026-10-20", result: "pending", notes: "Awaiting third reference" },
];

const statusColor = (s: CertStatus) => {
  switch (s) {
    case "valid": return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
    case "expiring": return "bg-amber-500/10 text-amber-400 border-amber-500/30";
    case "expired": return "bg-red-500/10 text-red-400 border-red-500/30";
    case "pending": return "bg-blue-500/10 text-blue-400 border-blue-500/30";
  }
};

const resultColor = (r: string) => {
  switch (r) {
    case "clear": return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
    case "flagged": return "bg-amber-500/10 text-amber-400 border-amber-500/30";
    case "pending": return "bg-blue-500/10 text-blue-400 border-blue-500/30";
    default: return "";
  }
};

const ComplianceTracker = () => {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const validCerts = mockCerts.filter(c => c.status === "valid").length;
  const expiringCerts = mockCerts.filter(c => c.status === "expiring").length;
  const expiredCerts = mockCerts.filter(c => c.status === "expired").length;
  const overallScore = Math.round((validCerts / mockCerts.length) * 100);

  const filteredCerts = mockCerts.filter(c => {
    const matchSearch = c.engineerName.toLowerCase().includes(search.toLowerCase()) || c.certName.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "all" || c.certType === typeFilter;
    return matchSearch && matchType;
  });

  return (
    <AppLayout title="Compliance & Certification Tracker">
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Compliance & Certification Tracker</h1>
            <p className="text-sm text-muted-foreground">
              Monitor engineer certifications, insurance, and background checks — matching Neeco & IRON standards
            </p>
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" /> Add Certification</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add New Certification</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Engineer</Label><Input placeholder="Select engineer..." /></div>
                <div><Label>Certification Name</Label><Input placeholder="e.g. CompTIA A+" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Issued Date</Label><Input type="date" /></div>
                  <div><Label>Expiry Date</Label><Input type="date" /></div>
                </div>
                <div><Label>Issuing Body</Label><Input placeholder="e.g. CompTIA" /></div>
                <div><Label>Notes</Label><Textarea placeholder="Additional notes..." /></div>
                <Button className="w-full" onClick={() => toast.success("Certification added")}>
                  <Upload className="h-4 w-4 mr-2" /> Save & Upload Document
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card><CardContent className="p-4 text-center">
            <ShieldCheck className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
            <div className="text-2xl font-bold">{overallScore}%</div>
            <div className="text-xs text-muted-foreground">Compliance Score</div>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
            <div className="text-2xl font-bold">{validCerts}</div>
            <div className="text-xs text-muted-foreground">Valid Certs</div>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <Clock className="h-8 w-8 text-amber-400 mx-auto mb-2" />
            <div className="text-2xl font-bold">{expiringCerts}</div>
            <div className="text-xs text-muted-foreground">Expiring Soon</div>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <AlertTriangle className="h-8 w-8 text-red-400 mx-auto mb-2" />
            <div className="text-2xl font-bold">{expiredCerts}</div>
            <div className="text-xs text-muted-foreground">Expired</div>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <Award className="h-8 w-8 text-blue-400 mx-auto mb-2" />
            <div className="text-2xl font-bold">{mockCerts.filter(c => c.verified).length}</div>
            <div className="text-xs text-muted-foreground">Verified</div>
          </CardContent></Card>
        </div>

        {/* Overall compliance bar */}
        <Card><CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Overall Workforce Compliance</span>
            <span className="text-sm text-muted-foreground">{overallScore}%</span>
          </div>
          <Progress value={overallScore} className="h-3" />
        </CardContent></Card>

        <Tabs defaultValue="certifications">
          <TabsList>
            <TabsTrigger value="certifications">Certifications ({mockCerts.length})</TabsTrigger>
            <TabsTrigger value="insurance">Insurance ({mockInsurance.length})</TabsTrigger>
            <TabsTrigger value="background">Background Checks ({mockBgChecks.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="certifications" className="space-y-4">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="Search engineers or certifications..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-40"><Filter className="h-4 w-4 mr-2" /><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="technical">Technical</SelectItem>
                  <SelectItem value="safety">Safety</SelectItem>
                  <SelectItem value="vendor">Vendor</SelectItem>
                  <SelectItem value="regulatory">Regulatory</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Card>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Engineer</TableHead>
                  <TableHead>Certification</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Issuing Body</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Verified</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {filteredCerts.map(c => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.engineerName}</TableCell>
                      <TableCell>{c.certName}</TableCell>
                      <TableCell><Badge variant="outline" className="capitalize">{c.certType}</Badge></TableCell>
                      <TableCell>{c.issuingBody}</TableCell>
                      <TableCell>{new Date(c.expiryDate).toLocaleDateString()}</TableCell>
                      <TableCell><Badge className={statusColor(c.status)}>{c.status}</Badge></TableCell>
                      <TableCell>{c.verified ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <Clock className="h-4 w-4 text-muted-foreground" />}</TableCell>
                      <TableCell><Button variant="ghost" size="sm"><Eye className="h-4 w-4" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="insurance" className="space-y-4">
            <Card>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Engineer</TableHead>
                  <TableHead>Policy #</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Coverage</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>End Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {mockInsurance.map(ins => (
                    <TableRow key={ins.id}>
                      <TableCell className="font-medium">{ins.engineerName}</TableCell>
                      <TableCell className="font-mono text-xs">{ins.policyNumber}</TableCell>
                      <TableCell>{ins.provider}</TableCell>
                      <TableCell>{ins.coverageType}</TableCell>
                      <TableCell>${(ins.coverageAmount / 1000000).toFixed(1)}M</TableCell>
                      <TableCell>{new Date(ins.endDate).toLocaleDateString()}</TableCell>
                      <TableCell><Badge className={statusColor(ins.status)}>{ins.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="background" className="space-y-4">
            <Card>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Engineer</TableHead>
                  <TableHead>Check Type</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {mockBgChecks.map(bg => (
                    <TableRow key={bg.id}>
                      <TableCell className="font-medium">{bg.engineerName}</TableCell>
                      <TableCell>{bg.checkType}</TableCell>
                      <TableCell>{bg.provider}</TableCell>
                      <TableCell>{new Date(bg.completedDate).toLocaleDateString()}</TableCell>
                      <TableCell>{new Date(bg.expiryDate).toLocaleDateString()}</TableCell>
                      <TableCell><Badge className={resultColor(bg.result)}>{bg.result}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{bg.notes}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default ComplianceTracker;
