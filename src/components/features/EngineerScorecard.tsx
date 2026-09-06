import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Star, Clock, CheckCircle, TrendingUp, Award } from "lucide-react";

interface ScorecardProps {
  engineer: {
    full_name?: string;
    rating?: number | null;
    jobs_completed?: number | null;
  };
  metrics?: {
    onTimeRate: number;
    firstFixRate: number;
    avgResponseMin: number;
    jobsThisWeek: number;
    customerSatisfaction: number;
  };
}

const EngineerScorecard = ({ engineer, metrics }: ScorecardProps) => {
  const m = metrics || {
    onTimeRate: 92,
    firstFixRate: 87,
    avgResponseMin: 18,
    jobsThisWeek: 8,
    customerSatisfaction: 4.7,
  };

  const overallScore = Math.round(
    (m.onTimeRate * 0.25 + m.firstFixRate * 0.25 + m.customerSatisfaction * 20 * 0.3 + Math.min(m.jobsThisWeek * 10, 100) * 0.2)
  );

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-success";
    if (score >= 75) return "text-warning";
    return "text-destructive";
  };

  const getScoreBg = (score: number) => {
    if (score >= 90) return "bg-success";
    if (score >= 75) return "bg-warning";
    return "bg-destructive";
  };

  const stats = [
    { label: "On-Time Rate", value: `${m.onTimeRate}%`, progress: m.onTimeRate, icon: Clock },
    { label: "First-Fix Rate", value: `${m.firstFixRate}%`, progress: m.firstFixRate, icon: CheckCircle },
    { label: "Avg Response", value: `${m.avgResponseMin}m`, progress: Math.max(0, 100 - m.avgResponseMin * 2), icon: TrendingUp },
    { label: "Customer Rating", value: `${m.customerSatisfaction}/5`, progress: m.customerSatisfaction * 20, icon: Star },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Award className="w-5 h-5 text-primary" />
          Performance Scorecard
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Score */}
        <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/50">
          <div className={`text-4xl font-bold font-display ${getScoreColor(overallScore)}`}>
            {overallScore}
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">{engineer.full_name || "Engineer"}</p>
            <p className="text-xs text-muted-foreground">
              Overall Score · {engineer.jobs_completed || 0} jobs completed
            </p>
          </div>
        </div>

        {/* Individual Metrics */}
        <div className="space-y-3">
          {stats.map((s) => (
            <div key={s.label} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <s.icon className="w-3.5 h-3.5" /> {s.label}
                </span>
                <span className="text-sm font-semibold text-foreground">{s.value}</span>
              </div>
              <Progress value={s.progress} className="h-1.5" />
            </div>
          ))}
        </div>

        {/* Weekly Trend */}
        <div className="flex items-center gap-2 pt-2 border-t border-border">
          <TrendingUp className="w-4 h-4 text-success" />
          <span className="text-xs text-muted-foreground">
            {m.jobsThisWeek} jobs this week · Trending {overallScore >= 85 ? "up" : "stable"}
          </span>
        </div>
      </CardContent>
    </Card>
  );
};

export default EngineerScorecard;
