import { Award, Star, Zap, Clock, Trophy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface Props {
  jobsCompleted: number;
  rating: number; // 0-5
  onTimeRate?: number; // 0-1
  avgResponseMin?: number;
}

export default function BadgesStrip({ jobsCompleted, rating, onTimeRate, avgResponseMin }: Props) {
  const badges = [
    { id: "veteran", label: "Veteran", icon: Trophy, earned: jobsCompleted >= 100, hint: "100 jobs" },
    { id: "rising", label: "Rising star", icon: Award, earned: jobsCompleted >= 10 && jobsCompleted < 100, hint: "10 jobs" },
    { id: "fivestar", label: "5★ pro", icon: Star, earned: rating >= 4.8 && jobsCompleted >= 5, hint: "4.8★+" },
    { id: "ontime", label: "On-time hero", icon: Clock, earned: (onTimeRate ?? 0) >= 0.95, hint: "95% on time" },
    { id: "fast", label: "Fast responder", icon: Zap, earned: avgResponseMin != null && avgResponseMin <= 5, hint: "≤5 min reply" },
  ];
  const earned = badges.filter((b) => b.earned);
  if (earned.length === 0) return null;

  return (
    <Card className="border-border/60">
      <CardContent className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <Award className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">Your badges</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {earned.map(({ id, label, icon: Icon, hint }) => (
            <div key={id} className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-primary/10 text-primary text-xs">
              <Icon className="w-3.5 h-3.5" />
              <span className="font-medium">{label}</span>
              <span className="text-primary/60">· {hint}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
