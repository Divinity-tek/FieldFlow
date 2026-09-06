import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ArrowRight, CheckCircle2, XCircle, Minus, Globe, Zap, Shield, Clock,
  Users, Truck, Package, FileText, Phone, MapPin, BarChart3, Bot,
  AlertTriangle, ChevronDown, Star,
} from "lucide-react";

const flowSteps = [
  { id: 1, label: "Request Intake", desc: "Client submits request via portal, email, or phone. Auto-creates ticket with SLA timer.", icon: Phone, color: "bg-blue-500" },
  { id: 2, label: "Validation & SOW", desc: "Coordinator validates scope, creates Statement of Work with line items, hours, and materials.", icon: FileText, color: "bg-indigo-500" },
  { id: 3, label: "Client Approval", desc: "Client reviews and approves SOW & estimated charges before dispatch proceeds.", icon: CheckCircle2, color: "bg-amber-500" },
  { id: 4, label: "Engineer Match", desc: "AI matches best engineer based on skills, proximity, availability, and SLA requirements.", icon: Users, color: "bg-purple-500" },
  { id: 5, label: "Dispatch & Schedule", desc: "Engineer receives assignment with site details, contact info, and scheduled date/time.", icon: MapPin, color: "bg-cyan-500" },
  { id: 6, label: "On-Site Execution", desc: "Engineer arrives (geofence verified), executes SOW tasks, captures photos and notes.", icon: Zap, color: "bg-emerald-500" },
  { id: 7, label: "Completion & Report", desc: "Job report with actual hours, materials used, photos, and client signature captured.", icon: BarChart3, color: "bg-teal-500" },
  { id: 8, label: "Invoice & Payout", desc: "Auto-generate invoice from actuals. Process engineer payout after client payment.", icon: Package, color: "bg-orange-500" },
];

type Status = "yes" | "no" | "partial";
interface CompRow {
  feature: string;
  category: string;
  ours: Status;
  neeco: Status;
  iron: Status;
  notes: string;
}

const comparison: CompRow[] = [
  // Ticket Management
  { feature: "SOW-based dispatch tickets", category: "Ticketing", ours: "yes", neeco: "yes", iron: "yes", notes: "All platforms support scope-of-work based ticketing" },
  { feature: "Auto ticket numbering", category: "Ticketing", ours: "yes", neeco: "yes", iron: "yes", notes: "Automated unique ID generation" },
  { feature: "Multi-type dispatch (Install, Break/Fix, MAC, Survey)", category: "Ticketing", ours: "yes", neeco: "yes", iron: "yes", notes: "Full IMAC + survey + decommission coverage" },
  { feature: "Client approval workflow", category: "Ticketing", ours: "yes", neeco: "yes", iron: "yes", notes: "SOW approval before dispatch" },
  { feature: "Priority-based SLA timers", category: "Ticketing", ours: "yes", neeco: "yes", iron: "yes", notes: "24x7x2, 24x7x4, NBD SLA tiers" },
  { feature: "Ticket escalation chain", category: "Ticketing", ours: "yes", neeco: "yes", iron: "yes", notes: "Engineer → Coordinator → Team Lead → Admin" },

  // Engineer Management
  { feature: "Global engineer network (160+ countries)", category: "Engineers", ours: "partial", neeco: "yes", iron: "yes", notes: "Neeco: 26,000+ engineers. Our platform supports multi-region" },
  { feature: "Skill-based matching", category: "Engineers", ours: "yes", neeco: "yes", iron: "yes", notes: "Match engineers by certifications and specialty" },
  { feature: "Real-time GPS tracking", category: "Engineers", ours: "yes", neeco: "partial", iron: "partial", notes: "Our platform: live tracking with geofence. Competitors: check-in based" },
  { feature: "Geofence arrival/departure", category: "Engineers", ours: "yes", neeco: "no", iron: "no", notes: "Automatic arrival verification — unique to our platform" },
  { feature: "Engineer availability calendar", category: "Engineers", ours: "yes", neeco: "partial", iron: "partial", notes: "Real-time availability with scheduling conflicts" },
  { feature: "Insurance & vehicle verification", category: "Engineers", ours: "yes", neeco: "yes", iron: "partial", notes: "Compliance tracking for field workforce" },

  // Operations
  { feature: "AI-powered scheduling", category: "Operations", ours: "yes", neeco: "partial", iron: "no", notes: "AI smart schedule with demand forecasting" },
  { feature: "Recurring job automation", category: "Operations", ours: "yes", neeco: "yes", iron: "partial", notes: "Auto-generate jobs on schedule" },
  { feature: "Site survey module", category: "Operations", ours: "yes", neeco: "yes", iron: "yes", notes: "Pre-job assessments with photos and checklists" },
  { feature: "Custom forms & checklists", category: "Operations", ours: "yes", neeco: "partial", iron: "partial", notes: "8 field types including signature and photo capture" },
  { feature: "Fleet management", category: "Operations", ours: "yes", neeco: "no", iron: "no", notes: "Vehicle tracking, fuel logs, maintenance — unique" },
  { feature: "Inventory & warehouse", category: "Operations", ours: "yes", neeco: "yes", iron: "partial", notes: "Neeco: ProTrack. Ours: full stock level tracking" },

  // Finance
  { feature: "Automated invoicing from SOW", category: "Finance", ours: "yes", neeco: "yes", iron: "yes", notes: "Auto-generate invoices from completed tickets" },
  { feature: "Engineer payout management", category: "Finance", ours: "yes", neeco: "partial", iron: "partial", notes: "Wallet-based payouts with status tracking" },
  { feature: "Pricing optimization (AI)", category: "Finance", ours: "yes", neeco: "no", iron: "no", notes: "AI-driven dynamic pricing — unique" },
  { feature: "Revenue forecasting", category: "Finance", ours: "yes", neeco: "no", iron: "no", notes: "Predictive revenue analytics — unique" },
  { feature: "Purchase order management", category: "Finance", ours: "yes", neeco: "partial", iron: "partial", notes: "Vendor procurement with PO tracking" },

  // Client Portal
  { feature: "Self-service client portal", category: "Client", ours: "yes", neeco: "partial", iron: "yes", notes: "Full portal: requests, tracking, estimates, invoices" },
  { feature: "Real-time job tracking for clients", category: "Client", ours: "yes", neeco: "partial", iron: "yes", notes: "Clients can track job status live" },
  { feature: "Client ratings & feedback", category: "Client", ours: "yes", neeco: "partial", iron: "yes", notes: "Post-job engineer rating system" },
  { feature: "Service agreement management", category: "Client", ours: "yes", neeco: "yes", iron: "yes", notes: "Contract lifecycle with visit tracking" },

  // Intelligence
  { feature: "AI assistant / copilot", category: "Intelligence", ours: "yes", neeco: "no", iron: "no", notes: "Conversational AI for insights — unique" },
  { feature: "SLA breach auto-detection", category: "Intelligence", ours: "yes", neeco: "yes", iron: "yes", notes: "Automated breach alerts and escalation" },
  { feature: "Knowledge base", category: "Intelligence", ours: "yes", neeco: "partial", iron: "partial", notes: "Technical docs and troubleshooting" },
  { feature: "Custom report builder", category: "Intelligence", ours: "yes", neeco: "partial", iron: "partial", notes: "Aggregated reports with CSV export" },

  // Communication
  { feature: "Internal team chat", category: "Communication", ours: "yes", neeco: "no", iron: "partial", notes: "Real-time messaging with reactions" },
  { feature: "Client support chat", category: "Communication", ours: "yes", neeco: "partial", iron: "yes", notes: "Live support widget" },
  { feature: "Associate coordinator role", category: "Communication", ours: "yes", neeco: "partial", iron: "partial", notes: "Dedicated mediator role — unique" },
];

const StatusIcon = ({ status }: { status: Status }) => {
  if (status === "yes") return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
  if (status === "no") return <XCircle className="w-4 h-4 text-red-400" />;
  return <Minus className="w-4 h-4 text-amber-500" />;
};

const categories = [...new Set(comparison.map((c) => c.category))];

const DispatchModel = () => {
  const oursYes = comparison.filter((c) => c.ours === "yes").length;
  const neecoYes = comparison.filter((c) => c.neeco === "yes").length;
  const ironYes = comparison.filter((c) => c.iron === "yes").length;

  return (
    <AppLayout title="Dispatch Model" subtitle="Our dispatch workflow compared with Neeco & IRON Service Global">
      <div className="space-y-6">
        {/* Score Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { name: "DispatchMate Pro", score: oursYes, total: comparison.length, desc: "AI-first, full-stack FSM with geofencing, pricing AI, and coordinator role", highlight: true },
            { name: "Neeco Global", score: neecoYes, total: comparison.length, desc: "26,000+ engineers in 160+ countries. Strong logistics & warehousing (ProTrack)", highlight: false },
            { name: "IRON Service Global", score: ironYes, total: comparison.length, desc: "SmartHands on demand, 24/7 helpdesk, IMAC services, unified portal", highlight: false },
          ].map((p) => (
            <Card key={p.name} className={`border ${p.highlight ? "border-primary/40 bg-primary/5" : "border-border/50"}`}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-sm text-card-foreground">{p.name}</h3>
                  {p.highlight && <Badge className="text-[9px] h-4 bg-primary/15 text-primary border-primary/30" variant="outline">Our Platform</Badge>}
                </div>
                <div className="flex items-end gap-1 mb-2">
                  <span className={`text-3xl font-bold font-display ${p.highlight ? "text-primary" : "text-card-foreground"}`}>{p.score}</span>
                  <span className="text-sm text-muted-foreground mb-1">/ {p.total}</span>
                </div>
                <div className="w-full h-2 rounded-full bg-muted overflow-hidden mb-2">
                  <div
                    className={`h-full rounded-full transition-all ${p.highlight ? "bg-primary" : "bg-muted-foreground/40"}`}
                    style={{ width: `${(p.score / p.total) * 100}%` }}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{p.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Dispatch Flow */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              Our Dispatch Workflow
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {flowSteps.map((step, i) => {
                const Icon = step.icon;
                return (
                  <div key={step.id} className="relative">
                    <div className="bg-muted/30 rounded-xl p-3 border border-border/40 h-full">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-8 h-8 rounded-lg ${step.color} flex items-center justify-center`}>
                          <Icon className="w-4 h-4 text-white" />
                        </div>
                        <Badge variant="outline" className="text-[9px] h-4">{step.id}</Badge>
                      </div>
                      <h4 className="text-xs font-semibold text-card-foreground mb-1">{step.label}</h4>
                      <p className="text-[10px] text-muted-foreground leading-relaxed">{step.desc}</p>
                    </div>
                    {i < flowSteps.length - 1 && i % 4 !== 3 && (
                      <ArrowRight className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50 hidden md:block" />
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Feature Comparison Table */}
        <Tabs defaultValue="all">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-card-foreground">Feature Comparison</h3>
            <TabsList className="h-8">
              <TabsTrigger value="all" className="text-xs h-6">All</TabsTrigger>
              {categories.map((cat) => (
                <TabsTrigger key={cat} value={cat} className="text-xs h-6">{cat}</TabsTrigger>
              ))}
            </TabsList>
          </div>

          {["all", ...categories].map((tab) => (
            <TabsContent key={tab} value={tab}>
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[30%]">Feature</TableHead>
                        <TableHead className="text-center w-[12%]">DispatchMate</TableHead>
                        <TableHead className="text-center w-[12%]">Neeco</TableHead>
                        <TableHead className="text-center w-[12%]">IRON</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {comparison
                        .filter((c) => tab === "all" || c.category === tab)
                        .map((row, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-xs font-medium">{row.feature}</TableCell>
                            <TableCell className="text-center"><StatusIcon status={row.ours} /></TableCell>
                            <TableCell className="text-center"><StatusIcon status={row.neeco} /></TableCell>
                            <TableCell className="text-center"><StatusIcon status={row.iron} /></TableCell>
                            <TableCell className="text-[11px] text-muted-foreground">{row.notes}</TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>

        {/* Competitive Advantages */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Star className="w-4 h-4 text-primary" />
                Our Unique Advantages
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[
                  { title: "Geofence Auto-Verification", desc: "Automatic arrival/departure detection — no manual check-ins needed" },
                  { title: "AI Pricing Optimization", desc: "Dynamic pricing based on demand, urgency, complexity, and region" },
                  { title: "Revenue Forecasting", desc: "Predictive analytics for revenue projection and capacity planning" },
                  { title: "Associate Coordinator Role", desc: "Dedicated mediator between clients and engineers for case resolution" },
                  { title: "AI Copilot Assistant", desc: "Conversational AI for instant insights, reports, and recommendations" },
                  { title: "Fleet Management", desc: "Full vehicle lifecycle tracking with fuel, maintenance, and expiry alerts" },
                  { title: "Integrated Team Chat", desc: "Real-time internal communication with reactions, threads, and file sharing" },
                ].map((adv, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-background/60 border border-border/30">
                    <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <div>
                      <h4 className="text-xs font-semibold text-card-foreground">{adv.title}</h4>
                      <p className="text-[10px] text-muted-foreground">{adv.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Areas to Strengthen vs Competitors
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[
                  { title: "Global Engineer Network Scale", desc: "Neeco has 26,000+ engineers in 160+ countries. Expand partner network.", competitor: "Neeco" },
                  { title: "Warehousing & Logistics Depth", desc: "Neeco's ProTrack offers global stocking facilities. Enhance our inventory.", competitor: "Neeco" },
                  { title: "24/7 Managed Helpdesk", desc: "IRON offers round-the-clock helpdesk with L1/L2 support tiers.", competitor: "IRON" },
                  { title: "IMAC Project Bundling", desc: "IRON bundles Install/Move/Add/Change into project workflows.", competitor: "IRON" },
                  { title: "Hardware Replacement SLA", desc: "Neeco offers 24x7x2hr and 24x7x4hr hardware replacement guarantees.", competitor: "Neeco" },
                ].map((gap, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-muted/30 border border-border/30">
                    <Minus className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-semibold text-card-foreground">{gap.title}</h4>
                        <Badge variant="outline" className="text-[9px] h-4">{gap.competitor}</Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground">{gap.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* SLA Tiers */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              SLA Response Tiers (Industry Standard)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { tier: "24x7x2", label: "Critical", desc: "2-hour response, 24/7 coverage. For production-down scenarios.", color: "border-red-500/30 bg-red-500/5" },
                { tier: "24x7x4", label: "High", desc: "4-hour response, 24/7 coverage. For major service disruptions.", color: "border-orange-500/30 bg-orange-500/5" },
                { tier: "NBD", label: "Standard", desc: "Next Business Day response. For non-critical maintenance tasks.", color: "border-blue-500/30 bg-blue-500/5" },
                { tier: "Scheduled", label: "Planned", desc: "Pre-scheduled window. For installations and upgrades.", color: "border-emerald-500/30 bg-emerald-500/5" },
              ].map((sla) => (
                <div key={sla.tier} className={`rounded-xl p-4 border ${sla.color}`}>
                  <Badge variant="outline" className="text-[10px] mb-2">{sla.tier}</Badge>
                  <h4 className="text-sm font-semibold text-card-foreground">{sla.label}</h4>
                  <p className="text-[10px] text-muted-foreground mt-1">{sla.desc}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default DispatchModel;
