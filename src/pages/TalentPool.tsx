import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Users, Search, Star, MapPin, Award, Zap, UserPlus,
  Filter, Brain, TrendingUp, Globe, Briefcase, CheckCircle2,
} from "lucide-react";

interface TalentProfile {
  id: string;
  name: string;
  location: string;
  country: string;
  skills: string[];
  certifications: string[];
  level: "L1" | "L2" | "L3";
  rating: number;
  jobsCompleted: number;
  availability: "available" | "busy" | "offline";
  hourlyRate: number;
  matchScore: number;
  specialties: string[];
  languages: string[];
  responseTime: string;
  verified: boolean;
}

const mockTalent: TalentProfile[] = [
  { id: "1", name: "James Wilson", location: "London, UK", country: "GB", skills: ["Networking", "Cisco", "Cabling"], certifications: ["CCNA", "CompTIA A+"], level: "L3", rating: 4.9, jobsCompleted: 342, availability: "available", hourlyRate: 85, matchScore: 97, specialties: ["Data Center", "Enterprise Network"], languages: ["English"], responseTime: "< 30 min", verified: true },
  { id: "2", name: "Sarah Chen", location: "Singapore", country: "SG", skills: ["Server Install", "Linux", "VMware"], certifications: ["VCP-DCV", "RHCSA"], level: "L3", rating: 4.8, jobsCompleted: 287, availability: "available", hourlyRate: 90, matchScore: 94, specialties: ["Virtualization", "Cloud Infra"], languages: ["English", "Mandarin"], responseTime: "< 1 hr", verified: true },
  { id: "3", name: "Carlos Mendez", location: "São Paulo, Brazil", country: "BR", skills: ["Electrical", "UPS", "Generator"], certifications: ["Electrical License", "OSHA 30"], level: "L2", rating: 4.7, jobsCompleted: 156, availability: "busy", hourlyRate: 55, matchScore: 88, specialties: ["Power Systems", "Critical Infra"], languages: ["English", "Portuguese", "Spanish"], responseTime: "< 2 hr", verified: true },
  { id: "4", name: "Anna Kowalski", location: "Warsaw, Poland", country: "PL", skills: ["CCTV", "Access Control", "Alarm"], certifications: ["PSP", "CSPM"], level: "L2", rating: 4.6, jobsCompleted: 198, availability: "available", hourlyRate: 50, matchScore: 85, specialties: ["Physical Security", "Surveillance"], languages: ["English", "Polish", "German"], responseTime: "< 1 hr", verified: true },
  { id: "5", name: "Raj Patel", location: "Mumbai, India", country: "IN", skills: ["Fiber Optic", "Structured Cabling", "Testing"], certifications: ["CFOT", "BICSI"], level: "L2", rating: 4.5, jobsCompleted: 412, availability: "available", hourlyRate: 35, matchScore: 82, specialties: ["Fiber Networks", "ISP Infra"], languages: ["English", "Hindi", "Gujarati"], responseTime: "< 30 min", verified: true },
  { id: "6", name: "Marie Dubois", location: "Paris, France", country: "FR", skills: ["WiFi", "RF Survey", "Ruckus"], certifications: ["CWNA", "ECSE"], level: "L1", rating: 4.3, jobsCompleted: 89, availability: "offline", hourlyRate: 45, matchScore: 76, specialties: ["Wireless Networks"], languages: ["English", "French"], responseTime: "< 4 hr", verified: false },
];

const availColor = (a: string) => {
  switch (a) {
    case "available": return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
    case "busy": return "bg-amber-500/10 text-amber-400 border-amber-500/30";
    case "offline": return "bg-muted text-muted-foreground";
    default: return "";
  }
};

const levelColor = (l: string) => {
  switch (l) {
    case "L3": return "bg-purple-500/10 text-purple-400 border-purple-500/30";
    case "L2": return "bg-blue-500/10 text-blue-400 border-blue-500/30";
    case "L1": return "bg-muted text-muted-foreground";
    default: return "";
  }
};

const TalentPool = () => {
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");
  const [availFilter, setAvailFilter] = useState("all");

  const filtered = mockTalent.filter(t => {
    const matchSearch = t.name.toLowerCase().includes(search.toLowerCase()) || t.skills.some(s => s.toLowerCase().includes(search.toLowerCase())) || t.location.toLowerCase().includes(search.toLowerCase());
    const matchLevel = levelFilter === "all" || t.level === levelFilter;
    const matchAvail = availFilter === "all" || t.availability === availFilter;
    return matchSearch && matchLevel && matchAvail;
  });

  const availableCount = mockTalent.filter(t => t.availability === "available").length;
  const avgRating = (mockTalent.reduce((a, t) => a + t.rating, 0) / mockTalent.length).toFixed(1);
  const countries = new Set(mockTalent.map(t => t.country)).size;

  return (
    <AppLayout title="Talent Pool & Marketplace">
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Talent Pool & Marketplace</h1>
            <p className="text-sm text-muted-foreground">
              AI-driven talent matching — like IRON's Talent Marketplace, with smart scoring
            </p>
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button><UserPlus className="h-4 w-4 mr-2" /> Onboard Talent</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Onboard New Engineer</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Full Name</Label><Input placeholder="Engineer name" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Location</Label><Input placeholder="City, Country" /></div>
                  <div><Label>Level</Label>
                    <Select><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent><SelectItem value="L1">L1 - Basic</SelectItem><SelectItem value="L2">L2 - Advanced</SelectItem><SelectItem value="L3">L3 - Expert</SelectItem></SelectContent>
                    </Select>
                  </div>
                </div>
                <div><Label>Skills (comma separated)</Label><Input placeholder="Networking, Cisco, Cabling" /></div>
                <div><Label>Certifications</Label><Input placeholder="CCNA, CompTIA A+" /></div>
                <div><Label>Notes</Label><Textarea placeholder="Additional information..." /></div>
                <Button className="w-full" onClick={() => toast.success("Talent profile created")}>Save Profile</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card><CardContent className="p-4 text-center">
            <Users className="h-8 w-8 text-primary mx-auto mb-2" />
            <div className="text-2xl font-bold">{mockTalent.length}</div>
            <div className="text-xs text-muted-foreground">Total Engineers</div>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <Zap className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
            <div className="text-2xl font-bold">{availableCount}</div>
            <div className="text-xs text-muted-foreground">Available Now</div>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <Globe className="h-8 w-8 text-blue-400 mx-auto mb-2" />
            <div className="text-2xl font-bold">{countries}</div>
            <div className="text-xs text-muted-foreground">Countries</div>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <Star className="h-8 w-8 text-amber-400 mx-auto mb-2" />
            <div className="text-2xl font-bold">{avgRating}</div>
            <div className="text-xs text-muted-foreground">Avg Rating</div>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <Brain className="h-8 w-8 text-purple-400 mx-auto mb-2" />
            <div className="text-2xl font-bold">AI</div>
            <div className="text-xs text-muted-foreground">Smart Matching</div>
          </CardContent></Card>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search by name, skill, or location..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={levelFilter} onValueChange={setLevelFilter}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Levels</SelectItem>
              <SelectItem value="L1">L1</SelectItem>
              <SelectItem value="L2">L2</SelectItem>
              <SelectItem value="L3">L3</SelectItem>
            </SelectContent>
          </Select>
          <Select value={availFilter} onValueChange={setAvailFilter}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="available">Available</SelectItem>
              <SelectItem value="busy">Busy</SelectItem>
              <SelectItem value="offline">Offline</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Talent Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(t => (
            <Card key={t.id} className="hover:border-primary/30 transition-colors">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-start gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-primary/10 text-primary font-bold">{t.name.split(" ").map(n => n[0]).join("")}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{t.name}</span>
                      {t.verified && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" /> {t.location}</div>
                  </div>
                  <Badge className={levelColor(t.level)}>{t.level}</Badge>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1"><Star className="h-4 w-4 text-amber-400 fill-amber-400" /><span className="text-sm font-medium">{t.rating}</span></div>
                  <span className="text-xs text-muted-foreground">{t.jobsCompleted} jobs</span>
                  <Badge className={availColor(t.availability)}>{t.availability}</Badge>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground">AI Match Score</span>
                    <span className="font-medium text-primary">{t.matchScore}%</span>
                  </div>
                  <Progress value={t.matchScore} className="h-2" />
                </div>

                <div className="flex flex-wrap gap-1">
                  {t.skills.slice(0, 4).map(s => <Badge key={s} variant="outline" className="text-[10px]">{s}</Badge>)}
                  {t.skills.length > 4 && <Badge variant="outline" className="text-[10px]">+{t.skills.length - 4}</Badge>}
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>${t.hourlyRate}/hr</span>
                  <span>⚡ {t.responseTime}</span>
                  <span>🌐 {t.languages.length} lang{t.languages.length > 1 ? "s" : ""}</span>
                </div>

                <div className="flex gap-2">
                  <Button size="sm" className="flex-1">Dispatch</Button>
                  <Button size="sm" variant="outline" className="flex-1">View Profile</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
};

export default TalentPool;
