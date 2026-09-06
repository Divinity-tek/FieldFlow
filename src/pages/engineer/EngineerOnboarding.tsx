import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Wrench, Zap, Wifi, Server, Shield, Cpu, MonitorSmartphone,
  ThermometerSun, Droplets, ChevronRight, ChevronLeft, Check, MapPin, DollarSign, X,
} from "lucide-react";

const CATEGORIES = [
  { value: "HVAC", label: "HVAC", icon: ThermometerSun, description: "Heating, ventilation & air conditioning" },
  { value: "Electrical", label: "Electrical", icon: Zap, description: "Electrical systems & wiring" },
  { value: "Plumbing", label: "Plumbing", icon: Droplets, description: "Pipes, fixtures & drainage" },
  { value: "Networking", label: "Networking", icon: Wifi, description: "Network & internet infrastructure" },
  { value: "IT Support", label: "IT Support", icon: MonitorSmartphone, description: "Hardware & software support" },
  { value: "Server & Data", label: "Server & Data", icon: Server, description: "Server rooms & data centers" },
  { value: "Security Systems", label: "Security Systems", icon: Shield, description: "CCTV, alarms & access control" },
  { value: "General Maintenance", label: "General Maintenance", icon: Wrench, description: "General building maintenance" },
];

const SKILLS_BY_CATEGORY: Record<string, string[]> = {
  "HVAC": ["AC Installation", "AC Repair", "Duct Cleaning", "Refrigeration", "Boiler Servicing", "Heat Pump", "Thermostat Setup", "Ventilation Design"],
  "Electrical": ["Wiring", "Panel Upgrades", "Lighting", "Generator Install", "EV Charger", "Troubleshooting", "Code Compliance", "Solar PV"],
  "Plumbing": ["Pipe Fitting", "Drain Cleaning", "Water Heater", "Leak Detection", "Fixture Install", "Backflow Prevention", "Sewer Line", "Gas Plumbing"],
  "Networking": ["Cabling", "Wi-Fi Setup", "Firewall Config", "VPN Setup", "Switch Install", "Network Audit", "Fiber Optic", "IP Phone Systems"],
  "IT Support": ["Desktop Support", "Printer Setup", "OS Install", "Data Recovery", "Malware Removal", "Cloud Migration", "Email Config", "Backup Solutions"],
  "Server & Data": ["Rack Mount", "Server Build", "UPS Install", "Cooling Systems", "Cable Management", "Monitoring Setup", "Virtualization", "Storage Config"],
  "Security Systems": ["CCTV Install", "Alarm Systems", "Access Control", "Intercom", "Motion Sensors", "Remote Monitoring", "Fire Detection", "Perimeter Security"],
  "General Maintenance": ["Painting", "Carpentry", "Flooring", "Drywall", "Locksmith", "Appliance Repair", "Pressure Washing", "Window Repair"],
};

const EngineerOnboarding = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [category, setCategory] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [hourlyRate, setHourlyRate] = useState("");
  const [location, setLocation] = useState("");
  const [saving, setSaving] = useState(false);

  const toggleSkill = (skill: string) => {
    setSkills((prev) => prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]);
  };

  const canProceed = () => {
    if (step === 0) return !!category;
    if (step === 1) return skills.length > 0;
    if (step === 2) return !!hourlyRate && Number(hourlyRate) > 0 && !!location.trim();
    return false;
  };

  const handleFinish = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("engineers").insert({
        user_id: user.id,
        specialty: category,
        skills,
        hourly_rate: Number(hourlyRate),
        location: location.trim(),
        is_available: true,
      });
      if (error) throw error;
      toast.success("Welcome aboard! Your profile is set up.");
      navigate("/engineer", { replace: true });
    } catch (err: any) {
      toast.error(err.message ?? "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const availableSkills = SKILLS_BY_CATEGORY[category] ?? [];

  const steps = ["Category", "Skills", "Rate & Location"];

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Cpu className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Engineer Onboarding</h1>
          <p className="text-sm text-muted-foreground mt-1">Set up your profile to start receiving jobs</p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                i < step ? "bg-primary text-primary-foreground" : i === step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}>
                {i < step ? <Check className="w-4 h-4" /> : i + 1}
              </div>
              <span className={`text-xs font-medium hidden sm:block ${i === step ? "text-foreground" : "text-muted-foreground"}`}>{s}</span>
              {i < steps.length - 1 && <div className={`w-8 h-0.5 ${i < step ? "bg-primary" : "bg-muted"}`} />}
            </div>
          ))}
        </div>

        {/* Step 0: Category */}
        {step === 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground text-center mb-1">Choose your specialty</h2>
            <p className="text-sm text-muted-foreground text-center mb-4">Select the category that best describes your expertise</p>
            <div className="grid grid-cols-2 gap-3">
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const selected = category === cat.value;
                return (
                  <Card
                    key={cat.value}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      selected ? "ring-2 ring-primary bg-primary/5" : "hover:bg-muted/50"
                    }`}
                    onClick={() => { setCategory(cat.value); setSkills([]); }}
                  >
                    <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${selected ? "bg-primary/15" : "bg-muted"}`}>
                        <Icon className={`w-5 h-5 ${selected ? "text-primary" : "text-muted-foreground"}`} />
                      </div>
                      <p className={`text-sm font-medium ${selected ? "text-primary" : "text-foreground"}`}>{cat.label}</p>
                      <p className="text-[11px] text-muted-foreground leading-tight">{cat.description}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 1: Skills */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground text-center mb-1">Select your skills</h2>
            <p className="text-sm text-muted-foreground text-center mb-4">Pick all the skills you're proficient in for <span className="font-medium text-foreground">{category}</span></p>
            <div className="flex flex-wrap gap-2 justify-center">
              {availableSkills.map((skill) => {
                const selected = skills.includes(skill);
                return (
                  <Badge
                    key={skill}
                    variant={selected ? "default" : "outline"}
                    className={`cursor-pointer text-sm px-3 py-1.5 transition-all ${
                      selected ? "bg-primary text-primary-foreground hover:bg-primary/90" : "hover:bg-muted"
                    }`}
                    onClick={() => toggleSkill(skill)}
                  >
                    {selected && <Check className="w-3 h-3 mr-1" />}
                    {skill}
                  </Badge>
                );
              })}
            </div>
            {skills.length > 0 && (
              <div className="text-center">
                <p className="text-xs text-muted-foreground">{skills.length} skill{skills.length > 1 ? "s" : ""} selected</p>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Rate & Location */}
        {step === 2 && (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-foreground text-center mb-1">Almost done!</h2>
            <p className="text-sm text-muted-foreground text-center mb-4">Set your hourly rate and service area</p>

            <Card>
              <CardContent className="p-5 space-y-5">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-sm font-medium">
                    <DollarSign className="w-4 h-4 text-muted-foreground" /> Hourly Rate (USD)
                  </Label>
                  <Input
                    type="number"
                    min="1"
                    placeholder="e.g. 75"
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-sm font-medium">
                    <MapPin className="w-4 h-4 text-muted-foreground" /> Service Location
                  </Label>
                  <Input
                    placeholder="e.g. London, UK"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    maxLength={200}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Summary */}
            <Card className="bg-muted/50">
              <CardContent className="p-4 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Profile Summary</p>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Category:</span>
                  <span className="font-medium text-foreground">{category}</span>
                </div>
                <div className="flex items-start gap-2 text-sm">
                  <span className="text-muted-foreground shrink-0">Skills:</span>
                  <div className="flex flex-wrap gap-1">
                    {skills.map((s) => (
                      <Badge key={s} variant="secondary" className="text-[11px]">{s}</Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-8">
          {step > 0 ? (
            <Button variant="outline" onClick={() => setStep(step - 1)}>
              <ChevronLeft className="w-4 h-4 mr-1" /> Back
            </Button>
          ) : <div />}

          {step < 2 ? (
            <Button onClick={() => setStep(step + 1)} disabled={!canProceed()}>
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleFinish} disabled={!canProceed() || saving}>
              {saving ? "Saving..." : "Complete Setup"} {!saving && <Check className="w-4 h-4 ml-1" />}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default EngineerOnboarding;
