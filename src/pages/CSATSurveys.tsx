import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import {
  Star, TrendingUp, TrendingDown, BarChart3, Send,
  MessageSquare, ThumbsUp, ThumbsDown, Clock, Users,
  CheckCircle2, AlertTriangle, Award, FileText, Download,
  Plus, Settings, Mail, Calendar,
} from "lucide-react";

interface SurveyResponse {
  id: string;
  jobId: string;
  clientName: string;
  engineerName: string;
  npsScore: number;
  csatScore: number;
  comment: string;
  responseDate: string;
  serviceType: string;
}

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  widgets: string[];
  schedule: string | null;
  lastRun: string;
}

const mockResponses: SurveyResponse[] = [
  { id: "r1", jobId: "JOB-1847", clientName: "Deutsche Telekom", engineerName: "Ahmed Khan", npsScore: 10, csatScore: 5, comment: "Excellent work, arrived on time and resolved the HVAC issue in under 30 minutes. Very professional.", responseDate: "Today", serviceType: "Break-Fix" },
  { id: "r2", jobId: "JOB-1842", clientName: "BNP Paribas", engineerName: "Pierre Dupont", npsScore: 9, csatScore: 5, comment: "Network issue was complex but Pierre handled it expertly. Great communication throughout.", responseDate: "Yesterday", serviceType: "Network Install" },
  { id: "r3", jobId: "JOB-1835", clientName: "Vodafone Group", engineerName: "Luca Bianchi", npsScore: 7, csatScore: 4, comment: "Good work but took a bit longer than expected. Would have liked more status updates.", responseDate: "2 days ago", serviceType: "UPS Maintenance" },
  { id: "r4", jobId: "JOB-1830", clientName: "Siemens AG", engineerName: "Anna Müller", npsScore: 6, csatScore: 3, comment: "The issue was resolved but the engineer had to return the next day for a follow-up. Parts weren't available.", responseDate: "3 days ago", serviceType: "Fire Suppression" },
  { id: "r5", jobId: "JOB-1825", clientName: "Orange SA", engineerName: "Raj Sharma", npsScore: 10, csatScore: 5, comment: "Outstanding service! Raj went above and beyond, even flagged a potential issue with the cooling system.", responseDate: "4 days ago", serviceType: "IMAC" },
  { id: "r6", jobId: "JOB-1820", clientName: "ING Group", engineerName: "Ahmed Khan", npsScore: 8, csatScore: 4, comment: "Solid work, no complaints. Documentation was thorough.", responseDate: "5 days ago", serviceType: "Site Survey" },
  { id: "r7", jobId: "JOB-1815", clientName: "Telefónica", engineerName: "Pierre Dupont", npsScore: 4, csatScore: 2, comment: "Engineer arrived late. Communication was poor. Issue partially resolved.", responseDate: "1 week ago", serviceType: "Break-Fix" },
];

const mockTemplates: ReportTemplate[] = [
  { id: "t1", name: "SLA Compliance Report", description: "Response times, resolution rates, and breach analysis by client and priority level", widgets: ["SLA Breach Chart", "Response Time Heatmap", "Resolution by Priority", "Top Breach Clients"], schedule: "Weekly (Monday)", lastRun: "Today" },
  { id: "t2", name: "Revenue & Profitability", description: "Revenue by service type, client, and region with margin analysis", widgets: ["Revenue Trend", "Margin by Client", "Service Mix Pie", "Regional Revenue Map"], schedule: "Monthly (1st)", lastRun: "Apr 1" },
  { id: "t3", name: "Engineer Performance", description: "Individual and team KPIs including CSAT, first-time fix, and utilization", widgets: ["Engineer Leaderboard", "CSAT by Engineer", "Fix Rate Trend", "Utilization Bars"], schedule: null, lastRun: "Mar 28" },
  { id: "t4", name: "Client Satisfaction Trends", description: "NPS and CSAT trends over time with sentiment analysis", widgets: ["NPS Gauge", "CSAT Trend", "Sentiment Word Cloud", "Detractor Analysis"], schedule: "Weekly (Friday)", lastRun: "Today" },
  { id: "t5", name: "Inventory Health", description: "Stock levels, reorder alerts, and parts consumption forecasts", widgets: ["Low Stock Alerts", "Consumption Trend", "Reorder Calendar", "Cost Forecast"], schedule: null, lastRun: "Apr 10" },
  { id: "t6", name: "Fleet & ESG Report", description: "Vehicle utilization, fuel consumption, and carbon footprint metrics", widgets: ["CO₂ Emissions", "Fuel Trend", "Route Optimization", "Green Scores"], schedule: "Monthly (15th)", lastRun: "Mar 15" },
];

const npsColor = (score: number) => {
  if (score >= 9) return "text-success";
  if (score >= 7) return "text-warning";
  return "text-destructive";
};

const npsLabel = (score: number) => {
  if (score >= 9) return "Promoter";
  if (score >= 7) return "Passive";
  return "Detractor";
};

const CSATSurveys = () => {
  const [autoSend, setAutoSend] = useState(true);

  const promoters = mockResponses.filter(r => r.npsScore >= 9).length;
  const passives = mockResponses.filter(r => r.npsScore >= 7 && r.npsScore < 9).length;
  const detractors = mockResponses.filter(r => r.npsScore < 7).length;
  const nps = Math.round(((promoters - detractors) / mockResponses.length) * 100);
  const avgCSAT = (mockResponses.reduce((a, r) => a + r.csatScore, 0) / mockResponses.length).toFixed(1);
  const responseRate = 78;

  return (
    <AppLayout title="CSAT Surveys & Report Builder" subtitle="Automated post-job surveys & custom reports">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Star className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold font-display text-card-foreground">Surveys & Reports</h2>
              <p className="text-[10px] text-muted-foreground">NPS tracking & drag-drop reports</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm">
              <Switch checked={autoSend} onCheckedChange={setAutoSend} />
              <span className="text-muted-foreground text-xs">Auto-send</span>
            </div>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New Report</Button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "NPS Score", value: `+${nps}`, color: "success" },
            { label: "Avg CSAT", value: `${avgCSAT}/5`, color: "info" },
            { label: "Response Rate", value: `${responseRate}%`, color: "card-foreground" },
            { label: "P / N / D", value: `${promoters}/${passives}/${detractors}`, color: "card-foreground", isRatio: true },
            { label: "Responses (30d)", value: `${mockResponses.length}`, color: "card-foreground" },
          ].map((stat) => (
            <Card key={stat.label} className="hover-lift">
              <CardContent className="p-4 text-center">
                {stat.isRatio ? (
                  <div className="flex justify-center gap-1 text-lg">
                    <span className="text-success font-bold">{promoters}</span>
                    <span className="text-muted-foreground">/</span>
                    <span className="text-warning font-bold">{passives}</span>
                    <span className="text-muted-foreground">/</span>
                    <span className="text-destructive font-bold">{detractors}</span>
                  </div>
                ) : (
                  <div className={`text-3xl font-bold font-display text-${stat.color}`}>{stat.value}</div>
                )}
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="surveys">
          <TabsList>
            <TabsTrigger value="surveys">Survey Responses</TabsTrigger>
            <TabsTrigger value="reports">Report Builder ({mockTemplates.length})</TabsTrigger>
            <TabsTrigger value="settings">Survey Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="surveys" className="space-y-4">
            <Card className="rounded-2xl shadow-card overflow-hidden">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/20">
                      <TableHead className="text-[10px] font-semibold uppercase tracking-wider">Job</TableHead>
                      <TableHead className="text-[10px] font-semibold uppercase tracking-wider">Client</TableHead>
                      <TableHead className="text-[10px] font-semibold uppercase tracking-wider">Engineer</TableHead>
                      <TableHead className="text-[10px] font-semibold uppercase tracking-wider">Service</TableHead>
                      <TableHead className="text-[10px] font-semibold uppercase tracking-wider">NPS</TableHead>
                      <TableHead className="text-[10px] font-semibold uppercase tracking-wider">CSAT</TableHead>
                      <TableHead className="text-[10px] font-semibold uppercase tracking-wider">Comment</TableHead>
                      <TableHead className="text-[10px] font-semibold uppercase tracking-wider">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockResponses.map(r => (
                      <TableRow key={r.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="font-mono text-sm">{r.jobId}</TableCell>
                        <TableCell className="font-medium text-sm">{r.clientName}</TableCell>
                        <TableCell className="text-sm">{r.engineerName}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{r.serviceType}</Badge></TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <span className={`font-bold ${npsColor(r.npsScore)}`}>{r.npsScore}</span>
                            <Badge variant="outline" className={`text-[10px] ${npsColor(r.npsScore)}`}>{npsLabel(r.npsScore)}</Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-0.5">
                            {[1,2,3,4,5].map(s => (
                              <Star key={s} className={`h-3 w-3 ${s <= r.csatScore ? "fill-warning text-warning" : "text-muted"}`} />
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[250px]">
                          <p className="text-xs text-muted-foreground line-clamp-2">{r.comment}</p>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{r.responseDate}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reports" className="space-y-4">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {mockTemplates.map(t => (
                <Card key={t.id} className="hover-lift rounded-2xl">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-sm">{t.name}</h3>
                      {t.schedule && <Badge variant="outline" className="text-[10px] border-info/30 text-info"><Calendar className="h-2.5 w-2.5 mr-0.5" />{t.schedule}</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{t.description}</p>
                    <div className="flex flex-wrap gap-1">
                      {t.widgets.map(w => (
                        <Badge key={w} variant="secondary" className="text-[10px] px-1.5 py-0">{w}</Badge>
                      ))}
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-border/40">
                      <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Last: {t.lastRun}</span>
                      <div className="flex gap-1">
                        <Button variant="outline" size="sm" className="h-7 text-xs"><BarChart3 className="h-3 w-3 mr-1" /> Run</Button>
                        <Button variant="ghost" size="sm" className="h-7 text-xs"><Download className="h-3 w-3" /></Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              <Card className="border-dashed hover-lift rounded-2xl cursor-pointer">
                <CardContent className="p-4 flex flex-col items-center justify-center h-full min-h-[200px] text-muted-foreground">
                  <Plus className="h-8 w-8 mb-2" />
                  <span className="font-medium text-sm">Create Custom Report</span>
                  <span className="text-xs">Drag & drop widgets</span>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <Card className="rounded-2xl shadow-card">
              <CardHeader><CardTitle className="text-lg">Survey Configuration</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="font-medium text-sm">Trigger Rules</h4>
                    {[
                      { label: "Send after job completion", desc: "Auto-send NPS + CSAT survey 1 hour after job status changes to 'completed'", enabled: true },
                      { label: "Send after dispatch ticket close", desc: "Survey dispatched 24 hours after ticket resolution", enabled: true },
                      { label: "Skip for recurring maintenance", desc: "Don't survey for auto-generated recurring jobs", enabled: false },
                      { label: "Rate-limit per client", desc: "Max 1 survey per client per week to prevent survey fatigue", enabled: true },
                    ].map((rule, i) => (
                      <div key={i} className="flex items-start justify-between p-3 bg-muted/30 rounded-xl border">
                        <div>
                          <p className="text-sm font-medium">{rule.label}</p>
                          <p className="text-xs text-muted-foreground">{rule.desc}</p>
                        </div>
                        <Switch defaultChecked={rule.enabled} />
                      </div>
                    ))}
                  </div>
                  <div className="space-y-4">
                    <h4 className="font-medium text-sm">Delivery Channels</h4>
                    {[
                      { icon: Mail, label: "Email Survey", desc: "Branded HTML email with embedded rating", enabled: true },
                      { icon: MessageSquare, label: "In-App Notification", desc: "Push notification in client portal", enabled: true },
                      { icon: Send, label: "SMS Survey", desc: "Quick 1-tap NPS via SMS link", enabled: false },
                    ].map((ch, i) => (
                      <div key={i} className="flex items-start justify-between p-3 bg-muted/30 rounded-xl border">
                        <div className="flex items-start gap-3">
                          <ch.icon className="h-5 w-5 text-muted-foreground mt-0.5" />
                          <div>
                            <p className="text-sm font-medium">{ch.label}</p>
                            <p className="text-xs text-muted-foreground">{ch.desc}</p>
                          </div>
                        </div>
                        <Switch defaultChecked={ch.enabled} />
                      </div>
                    ))}

                    <h4 className="font-medium text-sm mt-6">Escalation Rules</h4>
                    {[
                      { label: "Alert on Detractor (NPS ≤ 6)", desc: "Immediately notify account manager and team lead", enabled: true },
                      { label: "Weekly digest to management", desc: "Summary of all scores with trend analysis", enabled: true },
                    ].map((rule, i) => (
                      <div key={i} className="flex items-start justify-between p-3 bg-muted/30 rounded-xl border">
                        <div>
                          <p className="text-sm font-medium">{rule.label}</p>
                          <p className="text-xs text-muted-foreground">{rule.desc}</p>
                        </div>
                        <Switch defaultChecked={rule.enabled} />
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default CSATSurveys;
