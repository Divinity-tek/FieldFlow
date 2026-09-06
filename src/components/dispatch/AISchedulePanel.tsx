import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Brain, Sparkles, MapPin, Star, Briefcase, Zap, Loader2, ChevronDown, ChevronUp, AlertTriangle, Clock, Shield, Wrench } from "lucide-react";

interface ScoreBreakdown {
  score: number;
  max: number;
  detail: string;
}

interface Recommendation {
  engineer_id: string;
  name: string;
  specialty: string;
  skills: string[];
  rating: number;
  distance_km: number | null;
  active_jobs: number;
  jobs_completed: number;
  hourly_rate: number;
  score: number;
  breakdown: Record<string, ScoreBreakdown>;
}

interface SlaInfo {
  response_target: number;
  resolution_target: number;
  time_remaining: number | null;
  urgency_factor: number;
}

interface Props {
  jobId: string;
  jobTitle: string;
  onAssign: (engineerId: string) => void;
  onClose: () => void;
}

const BREAKDOWN_LABELS: Record<string, { label: string; icon: typeof Star }> = {
  specialty: { label: "Specialty", icon: Wrench },
  skills: { label: "Skills", icon: Shield },
  distance: { label: "Distance", icon: MapPin },
  workload: { label: "Workload", icon: Briefcase },
  rating: { label: "Rating", icon: Star },
  experience: { label: "Experience", icon: Briefcase },
  sla_urgency: { label: "SLA Urgency", icon: AlertTriangle },
};

const AISchedulePanel = ({ jobId, jobTitle, onAssign, onClose }: Props) => {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [aiSummary, setAiSummary] = useState("");
  const [slaInfo, setSlaInfo] = useState<SlaInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchRecommendations = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-smart-schedule", {
        body: { job_id: jobId },
      });
      if (error) throw error;
      setRecommendations(data.recommendations || []);
      setAiSummary(data.ai_summary || "");
      setSlaInfo(data.sla_info || null);
      setFetched(true);
      if (data.recommendations?.length > 0) {
        setExpandedId(data.recommendations[0].engineer_id);
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to get AI recommendations");
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return "text-green-500";
    if (score >= 45) return "text-amber-500";
    return "text-muted-foreground";
  };

  const getScoreBg = (score: number) => {
    if (score >= 70) return "bg-green-500/10 border-green-500/30";
    if (score >= 45) return "bg-amber-500/10 border-amber-500/30";
    return "bg-muted/50 border-border";
  };

  const getBarColor = (ratio: number) => {
    if (ratio >= 0.75) return "bg-green-500";
    if (ratio >= 0.5) return "bg-amber-500";
    return "bg-muted-foreground";
  };

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            AI Smart Dispatch
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>✕</Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Assigning: <span className="font-medium text-foreground">{jobTitle}</span>
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {!fetched && (
          <Button onClick={fetchRecommendations} disabled={loading} className="w-full gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {loading ? "Analyzing engineers..." : "Get AI Recommendations"}
          </Button>
        )}

        {/* SLA Warning */}
        {slaInfo && slaInfo.time_remaining !== null && (
          <div className={`p-2.5 rounded-lg flex items-center gap-2 text-xs font-medium ${
            slaInfo.time_remaining <= 0
              ? "bg-destructive/10 text-destructive border border-destructive/30"
              : slaInfo.time_remaining <= 30
              ? "bg-amber-500/10 text-amber-600 border border-amber-500/30"
              : "bg-primary/5 text-primary border border-primary/20"
          }`}>
            <Clock className="w-4 h-4 shrink-0" />
            {slaInfo.time_remaining <= 0
              ? `⚠ SLA BREACHED — Response target was ${slaInfo.response_target}min`
              : `SLA: ${slaInfo.time_remaining}min remaining (target: ${slaInfo.response_target}min)`
            }
          </div>
        )}

        {/* AI Summary */}
        {aiSummary && (
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-semibold text-primary">AI Insight</span>
            </div>
            <p className="text-sm text-foreground leading-relaxed">{aiSummary}</p>
          </div>
        )}

        {fetched && recommendations.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No available engineers found.
          </p>
        )}

        {/* Recommendations */}
        <div className="space-y-2">
          {recommendations.map((rec, i) => {
            const isExpanded = expandedId === rec.engineer_id;
            return (
              <div
                key={rec.engineer_id}
                className={`rounded-lg border transition-all ${getScoreBg(rec.score)}`}
              >
                {/* Header */}
                <div className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`text-lg font-bold ${getScoreColor(rec.score)} shrink-0`}>
                        {rec.score}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {i === 0 && "🏆 "}{rec.name}
                        </p>
                        <p className="text-xs text-muted-foreground">{rec.specialty}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant={i === 0 ? "default" : "outline"}
                        onClick={() => onAssign(rec.engineer_id)}
                        className="gap-1"
                      >
                        <Zap className="w-3 h-3" /> Assign
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="px-1.5"
                        onClick={() => setExpandedId(isExpanded ? null : rec.engineer_id)}
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>

                  {/* Quick stats */}
                  <div className="flex flex-wrap gap-1.5">
                    {rec.rating > 0 && (
                      <Badge variant="secondary" className="text-[10px] gap-1">
                        <Star className="w-3 h-3" /> {rec.rating.toFixed(1)}
                      </Badge>
                    )}
                    {rec.distance_km !== null && (
                      <Badge variant="secondary" className="text-[10px] gap-1">
                        <MapPin className="w-3 h-3" /> {rec.distance_km.toFixed(1)}km
                      </Badge>
                    )}
                    <Badge variant="secondary" className="text-[10px] gap-1">
                      <Briefcase className="w-3 h-3" /> {rec.active_jobs} active
                    </Badge>
                    {rec.hourly_rate > 0 && (
                      <Badge variant="secondary" className="text-[10px]">
                        ${rec.hourly_rate}/hr
                      </Badge>
                    )}
                    {rec.skills.length > 0 && (
                      <Badge variant="outline" className="text-[10px]">
                        {rec.skills.length} skills
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Expanded breakdown */}
                {isExpanded && (
                  <div className="px-3 pb-3 pt-1 border-t border-border/50 space-y-2">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Score Breakdown</p>
                    {Object.entries(rec.breakdown).map(([key, val]) => {
                      const meta = BREAKDOWN_LABELS[key] || { label: key, icon: Star };
                      const Icon = meta.icon;
                      const ratio = val.max > 0 ? val.score / val.max : 0;
                      return (
                        <div key={key} className="space-y-0.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <Icon className="w-3 h-3 text-muted-foreground" />
                              <span className="text-xs text-foreground">{meta.label}</span>
                            </div>
                            <span className="text-xs font-medium text-foreground">{val.score}/{val.max}</span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${getBarColor(ratio)}`}
                              style={{ width: `${Math.round(ratio * 100)}%` }}
                            />
                          </div>
                          <p className="text-[10px] text-muted-foreground">{val.detail}</p>
                        </div>
                      );
                    })}

                    {/* Skills list */}
                    {rec.skills.length > 0 && (
                      <div className="pt-1">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Skills</p>
                        <div className="flex flex-wrap gap-1">
                          {rec.skills.map((s: string) => (
                            <Badge key={s} variant="secondary" className="text-[10px] px-1.5 py-0">{s}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default AISchedulePanel;
