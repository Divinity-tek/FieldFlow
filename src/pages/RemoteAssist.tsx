import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Video, VideoOff, Phone, PhoneOff, Monitor, Pencil,
  Users, Clock, Star, Search, Play, Download, Shield,
  Headphones, Camera, MessageSquare, BookOpen, Wifi,
  CheckCircle2, Circle, XCircle,
} from "lucide-react";

interface Expert {
  id: string;
  name: string;
  speciality: string;
  level: "L2" | "L3";
  status: "available" | "busy" | "offline";
  rating: number;
  sessionsToday: number;
  avgResolution: string;
  languages: string[];
  certifications: string[];
}

interface Session {
  id: string;
  engineerName: string;
  expertName: string;
  assetName: string;
  jobId: string;
  duration: string;
  status: "live" | "completed" | "scheduled";
  annotations: number;
  knowledgeArticles: number;
  resolution: string;
  recording: boolean;
  startedAt: string;
}

const mockExperts: Expert[] = [
  { id: "e1", name: "Dr. Sarah Chen", speciality: "HVAC & Refrigeration", level: "L3", status: "available", rating: 4.9, sessionsToday: 3, avgResolution: "12 min", languages: ["English", "Mandarin"], certifications: ["ASHRAE", "EPA 608"] },
  { id: "e2", name: "Marcus Weber", speciality: "Electrical Systems", level: "L3", status: "available", rating: 4.8, sessionsToday: 5, avgResolution: "15 min", languages: ["English", "German"], certifications: ["Master Electrician", "IEC 61850"] },
  { id: "e3", name: "Aisha Patel", speciality: "Network Infrastructure", level: "L3", status: "busy", rating: 4.7, sessionsToday: 4, avgResolution: "18 min", languages: ["English", "Hindi", "French"], certifications: ["CCNP", "CDCP"] },
  { id: "e4", name: "Jan Kowalski", speciality: "Data Center Operations", level: "L2", status: "available", rating: 4.6, sessionsToday: 2, avgResolution: "22 min", languages: ["English", "Polish"], certifications: ["CDCP", "ITIL v4"] },
  { id: "e5", name: "Elena Rossi", speciality: "Fire Suppression Systems", level: "L3", status: "offline", rating: 4.9, sessionsToday: 0, avgResolution: "10 min", languages: ["English", "Italian", "Spanish"], certifications: ["NFPA", "FM Global"] },
  { id: "e6", name: "Takeshi Yamamoto", speciality: "UPS & Power Systems", level: "L2", status: "available", rating: 4.5, sessionsToday: 1, avgResolution: "20 min", languages: ["English", "Japanese"], certifications: ["Schneider Certified", "ABB Expert"] },
];

const mockSessions: Session[] = [
  { id: "rs1", engineerName: "Ahmed Khan", expertName: "Dr. Sarah Chen", assetName: "Carrier RTU-400", jobId: "JOB-1847", duration: "00:08:23", status: "live", annotations: 4, knowledgeArticles: 2, resolution: "", recording: true, startedAt: "Now" },
  { id: "rs2", engineerName: "Pierre Dupont", expertName: "Aisha Patel", assetName: "Cisco Catalyst 9300", jobId: "JOB-1842", duration: "00:14:50", status: "live", annotations: 7, knowledgeArticles: 3, resolution: "", recording: true, startedAt: "15 min ago" },
  { id: "rs3", engineerName: "Luca Bianchi", expertName: "Marcus Weber", assetName: "APC Symmetra PX", jobId: "JOB-1835", duration: "00:22:15", status: "completed", annotations: 12, knowledgeArticles: 4, resolution: "Capacitor bank replaced — guided module-by-module swap", recording: true, startedAt: "2 hrs ago" },
  { id: "rs4", engineerName: "Anna Müller", expertName: "Elena Rossi", assetName: "FM200 Panel", jobId: "JOB-1830", duration: "00:09:40", status: "completed", annotations: 5, knowledgeArticles: 1, resolution: "Pressure sensor recalibrated via guided procedure", recording: true, startedAt: "Yesterday" },
  { id: "rs5", engineerName: "Raj Sharma", expertName: "Takeshi Yamamoto", assetName: "Eaton 93PM", jobId: "JOB-1855", duration: "—", status: "scheduled", annotations: 0, knowledgeArticles: 0, resolution: "", recording: false, startedAt: "In 2 hrs" },
];

const statusDot = (s: string) => {
  switch (s) {
    case "available": return <Circle className="h-3 w-3 fill-success text-success" />;
    case "busy": return <Circle className="h-3 w-3 fill-warning text-warning" />;
    default: return <Circle className="h-3 w-3 fill-muted text-muted-foreground" />;
  }
};

const RemoteAssist = () => {
  const [search, setSearch] = useState("");
  const availableExperts = mockExperts.filter(e => e.status === "available").length;
  const liveSessions = mockSessions.filter(s => s.status === "live").length;
  const completedToday = mockSessions.filter(s => s.status === "completed").length;

  const filteredExperts = mockExperts.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.speciality.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout title="Remote Assist & Video Support" subtitle="Real-time video calls with guided troubleshooting">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Video className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold font-display text-card-foreground">AR Remote Assist</h2>
              <p className="text-[10px] text-muted-foreground">Video calls with screen annotation</p>
            </div>
          </div>
          <Button size="sm"><Video className="h-4 w-4 mr-1" /> Start Session</Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: Users, label: "Experts Online", value: availableExperts, color: "success" },
            { icon: Video, label: "Live Sessions", value: liveSessions, color: "info" },
            { icon: CheckCircle2, label: "Completed Today", value: completedToday, color: "muted-foreground" },
            { icon: Clock, label: "Avg Resolution", value: "16m", color: "warning" },
          ].map((stat) => (
            <Card key={stat.label} className="hover-lift">
              <CardContent className="p-4 flex items-center gap-3">
                <stat.icon className={`h-7 w-7 text-${stat.color}`} />
                <div>
                  <div className={`text-2xl font-bold font-display text-${stat.color}`}>{stat.value}</div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="experts">
          <TabsList>
            <TabsTrigger value="experts">Expert Roster</TabsTrigger>
            <TabsTrigger value="sessions">Sessions ({mockSessions.length})</TabsTrigger>
            <TabsTrigger value="tools">Assist Tools</TabsTrigger>
          </TabsList>

          <TabsContent value="experts" className="space-y-4">
            <div className="relative w-64">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search experts..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {filteredExperts.map(expert => (
                <Card key={expert.id} className="hover-lift rounded-2xl">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="text-xs bg-primary/10 text-primary">{expert.name.split(" ").map(n => n[0]).join("")}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{expert.name}</span>
                            {statusDot(expert.status)}
                          </div>
                          <p className="text-xs text-muted-foreground">{expert.speciality}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className={expert.level === "L3" ? "border-primary text-primary" : ""}>{expert.level}</Badge>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Star className="h-3 w-3 text-warning" /> {expert.rating}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {expert.avgResolution}</span>
                      <span className="flex items-center gap-1"><Video className="h-3 w-3" /> {expert.sessionsToday} today</span>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {expert.languages.map(l => (
                        <Badge key={l} variant="secondary" className="text-[10px] px-1.5 py-0">{l}</Badge>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {expert.certifications.map(c => (
                        <Badge key={c} variant="outline" className="text-[10px] px-1.5 py-0 border-success/30 text-success">{c}</Badge>
                      ))}
                    </div>

                    {expert.status === "available" ? (
                      <Button size="sm" className="w-full"><Video className="h-4 w-4 mr-1" /> Connect</Button>
                    ) : expert.status === "busy" ? (
                      <Button variant="outline" size="sm" className="w-full" disabled>In Session</Button>
                    ) : (
                      <Button variant="ghost" size="sm" className="w-full" disabled>Offline</Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="sessions" className="space-y-4">
            <Card className="rounded-2xl shadow-card overflow-hidden">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/20">
                      <TableHead className="text-[10px] font-semibold uppercase tracking-wider">Status</TableHead>
                      <TableHead className="text-[10px] font-semibold uppercase tracking-wider">Field Engineer</TableHead>
                      <TableHead className="text-[10px] font-semibold uppercase tracking-wider">Remote Expert</TableHead>
                      <TableHead className="text-[10px] font-semibold uppercase tracking-wider">Asset / Job</TableHead>
                      <TableHead className="text-[10px] font-semibold uppercase tracking-wider">Duration</TableHead>
                      <TableHead className="text-[10px] font-semibold uppercase tracking-wider">Annotations</TableHead>
                      <TableHead className="text-[10px] font-semibold uppercase tracking-wider">KB Articles</TableHead>
                      <TableHead className="text-[10px] font-semibold uppercase tracking-wider">Recording</TableHead>
                      <TableHead className="text-[10px] font-semibold uppercase tracking-wider">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockSessions.map(s => (
                      <TableRow key={s.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell>
                          <Badge className={
                            s.status === "live" ? "bg-success text-success-foreground animate-pulse" :
                            s.status === "scheduled" ? "bg-info/10 text-info" :
                            "bg-muted text-muted-foreground"
                          }>{s.status === "live" ? "● LIVE" : s.status}</Badge>
                        </TableCell>
                        <TableCell className="font-medium text-sm">{s.engineerName}</TableCell>
                        <TableCell className="text-sm">{s.expertName}</TableCell>
                        <TableCell>
                          <div className="text-sm">{s.assetName}</div>
                          <div className="text-xs text-muted-foreground">{s.jobId}</div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{s.duration}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Pencil className="h-3 w-3 text-muted-foreground" />
                            <span className="text-sm">{s.annotations}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <BookOpen className="h-3 w-3 text-muted-foreground" />
                            <span className="text-sm">{s.knowledgeArticles}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {s.recording ? <Badge variant="outline" className="border-destructive/30 text-destructive text-xs">● REC</Badge> : "—"}
                        </TableCell>
                        <TableCell>
                          {s.status === "live" ? (
                            <div className="flex gap-1">
                              <Button variant="outline" size="sm" className="h-7 text-xs"><Monitor className="h-3 w-3 mr-1" /> Watch</Button>
                              <Button variant="destructive" size="sm" className="h-7 text-xs"><PhoneOff className="h-3 w-3" /></Button>
                            </div>
                          ) : s.status === "completed" ? (
                            <div className="flex gap-1">
                              <Button variant="outline" size="sm" className="h-7 text-xs"><Play className="h-3 w-3 mr-1" /> Replay</Button>
                              <Button variant="ghost" size="sm" className="h-7 text-xs"><Download className="h-3 w-3" /></Button>
                            </div>
                          ) : (
                            <Button variant="outline" size="sm" className="h-7 text-xs">Join Early</Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {mockSessions.filter(s => s.resolution).length > 0 && (
              <Card className="rounded-2xl shadow-card">
                <CardHeader><CardTitle className="text-lg">Session Resolutions</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {mockSessions.filter(s => s.resolution).map(s => (
                    <div key={s.id} className="flex items-start gap-3 p-3 bg-muted/30 rounded-xl border hover:bg-muted/40 transition-colors">
                      <CheckCircle2 className="h-4 w-4 text-success mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">{s.assetName} ({s.jobId})</p>
                        <p className="text-xs text-muted-foreground">{s.resolution}</p>
                        <p className="text-xs text-muted-foreground mt-1">Engineer: {s.engineerName} • Expert: {s.expertName} • Duration: {s.duration}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="tools" className="space-y-4">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { icon: Camera, title: "Live Video Feed", desc: "WebRTC-based HD video with low latency. Field engineer shares camera view of equipment.", status: "Active" },
                { icon: Pencil, title: "Screen Annotation", desc: "Draw arrows, circles, and text on the live video feed. Guide technicians to exact components.", status: "Active" },
                { icon: Monitor, title: "Screen Sharing", desc: "Expert shares diagnostic dashboards, schematics, and documentation during the call.", status: "Active" },
                { icon: MessageSquare, title: "In-Session Chat", desc: "Text chat alongside video for sharing serial numbers, part codes, and error messages.", status: "Active" },
                { icon: BookOpen, title: "KB Auto-Suggest", desc: "AI surfaces relevant knowledge base articles based on the asset type and reported symptoms.", status: "Active" },
                { icon: Shield, title: "Session Recording", desc: "Auto-record all sessions for compliance, training library, and dispute resolution.", status: "Active" },
                { icon: Wifi, title: "Adaptive Bandwidth", desc: "Auto-adjusts video quality based on engineer's network — works on 3G/4G/5G/WiFi.", status: "Active" },
                { icon: Headphones, title: "Multi-Party Call", desc: "Add additional experts or managers to the call for complex escalations.", status: "Beta" },
                { icon: XCircle, title: "AR Overlay (Coming Soon)", desc: "Augmented reality overlays with 3D schematics and step-by-step repair guides projected on equipment.", status: "Planned" },
              ].map((tool, i) => (
                <Card key={i} className="hover-lift rounded-2xl">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                          <tool.icon className="h-4 w-4 text-primary" />
                        </div>
                        <span className="font-medium text-sm">{tool.title}</span>
                      </div>
                      <Badge variant={tool.status === "Active" ? "default" : tool.status === "Beta" ? "secondary" : "outline"} className="text-xs">{tool.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{tool.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default RemoteAssist;
