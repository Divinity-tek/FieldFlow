import { useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Compass, Trophy } from "lucide-react";
import { BADGES } from "@/hooks/useExplorationTracker";

interface ExplorationProgressProps {
  explored: number;
  total: number;
  percentage: number;
  unlockedBadges: Set<string>;
}

const ExplorationProgress = ({ explored, total, percentage, unlockedBadges }: ExplorationProgressProps) => {
  const [showBadges, setShowBadges] = useState(false);
  const circumference = 2 * Math.PI * 16;
  const offset = circumference - (percentage / 100) * circumference;
  const unlockedCount = unlockedBadges.size;

  return (
    <div className="space-y-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-sidebar-accent/40 transition-colors cursor-default">
            <div className="relative w-8 h-8 shrink-0">
              <svg className="w-8 h-8 -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="16" fill="none" stroke="hsl(var(--sidebar-accent))" strokeWidth="3" />
                <circle
                  cx="18" cy="18" r="16" fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="3"
                  strokeDasharray={circumference}
                  strokeDashoffset={offset}
                  strokeLinecap="round"
                  className="transition-all duration-700 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <Compass className="w-3.5 h-3.5 text-primary" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-sidebar-accent-foreground">Explored</span>
                <span className="text-[11px] font-bold text-primary">{percentage}%</span>
              </div>
              <div className="mt-1 h-1 rounded-full bg-sidebar-accent overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-700 ease-out"
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <span className="text-[10px] text-sidebar-muted mt-0.5 block">
                {explored} of {total} features
              </span>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-[200px]">
          <p className="text-xs font-medium">Platform Exploration</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            You've visited {explored} of {total} features. {unlockedCount} of {BADGES.length} badges unlocked.
          </p>
        </TooltipContent>
      </Tooltip>

      {/* Badge row */}
      <button
        onClick={() => setShowBadges(prev => !prev)}
        className="flex items-center gap-1.5 px-3 py-1 w-full rounded-lg hover:bg-sidebar-accent/40 transition-colors"
      >
        <Trophy className="w-3 h-3 text-sidebar-muted" />
        <span className="text-[10px] font-medium text-sidebar-muted">
          {unlockedCount}/{BADGES.length} Badges
        </span>
        <div className="flex items-center gap-0.5 ml-auto">
          {BADGES.map(badge => (
            <span
              key={badge.id}
              className={`text-xs transition-all duration-300 ${
                unlockedBadges.has(badge.id) ? "opacity-100 scale-100" : "opacity-25 scale-90 grayscale"
              }`}
              title={unlockedBadges.has(badge.id) ? `${badge.label} — ${badge.description}` : `Locked — reach ${badge.threshold}%`}
            >
              {badge.emoji}
            </span>
          ))}
        </div>
      </button>

      {/* Expanded badge details */}
      {showBadges && (
        <div className="px-2 pb-1 space-y-1 animate-fade-in">
          {BADGES.map(badge => {
            const unlocked = unlockedBadges.has(badge.id);
            return (
              <div
                key={badge.id}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] transition-all ${
                  unlocked
                    ? "bg-sidebar-accent/60 text-sidebar-accent-foreground"
                    : "opacity-50 text-sidebar-muted"
                }`}
              >
                <span className={`text-sm ${unlocked ? "" : "grayscale"}`}>{badge.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{badge.label}</p>
                  <p className="text-[10px] opacity-70">{badge.description}</p>
                </div>
                {unlocked ? (
                  <span className="text-[9px] font-bold text-primary uppercase tracking-wider">Unlocked</span>
                ) : (
                  <span className="text-[9px] font-medium uppercase tracking-wider">{badge.threshold}%</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ExplorationProgress;
