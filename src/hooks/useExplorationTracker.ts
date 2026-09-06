import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { useUserPreference } from "./useUserPreference";

export interface Badge {
  id: string;
  label: string;
  emoji: string;
  threshold: number;
  description: string;
}

export const BADGES: Badge[] = [
  { id: "explorer", label: "Explorer", emoji: "🧭", threshold: 25, description: "Visited 25% of features" },
  { id: "adventurer", label: "Adventurer", emoji: "⚡", threshold: 50, description: "Visited 50% of features" },
  { id: "pioneer", label: "Pioneer", emoji: "🚀", threshold: 75, description: "Visited 75% of features" },
  { id: "master", label: "Master", emoji: "👑", threshold: 100, description: "Visited every feature!" },
];

export function useExplorationTracker(allPages: string[]) {
  const { value: visitedArray, update: updateVisited, remove: removeVisited, loaded: visitedLoaded } = useUserPreference<string[]>("explored-pages", []);
  const { value: badgesArray, update: updateBadges, remove: removeBadges, loaded: badgesLoaded } = useUserPreference<string[]>("exploration-badges", []);

  const visited = new Set(visitedArray);
  const unlockedBadges = new Set(badgesArray);

  const prevPercentage = useRef<number | null>(null);

  const total = allPages.length;
  const explored = allPages.filter(p => visited.has(p)).length;
  const percentage = total > 0 ? Math.round((explored / total) * 100) : 0;

  // Check for newly unlocked badges
  useEffect(() => {
    if (!visitedLoaded || !badgesLoaded) return;
    if (prevPercentage.current === null) {
      prevPercentage.current = percentage;
      return;
    }
    if (percentage === prevPercentage.current) return;
    prevPercentage.current = percentage;

    const newlyUnlocked: Badge[] = [];
    BADGES.forEach(badge => {
      if (percentage >= badge.threshold && !unlockedBadges.has(badge.id)) {
        newlyUnlocked.push(badge);
      }
    });

    if (newlyUnlocked.length > 0) {
      const nextBadges = [...badgesArray, ...newlyUnlocked.map(b => b.id)];
      updateBadges(nextBadges);

      newlyUnlocked.forEach(badge => {
        toast.success(`${badge.emoji} Badge Unlocked: ${badge.label}!`, {
          description: badge.description,
          duration: 5000,
        });
      });
    }
  }, [percentage, visitedLoaded, badgesLoaded]);

  const markVisited = useCallback((page: string) => {
    if (visited.has(page)) return;
    const next = [...visitedArray, page];
    updateVisited(next);
  }, [visitedArray, updateVisited]);

  const reset = useCallback(() => {
    removeVisited();
    removeBadges();
    prevPercentage.current = null;
  }, [removeVisited, removeBadges]);

  return { visited, markVisited, reset, explored, total, percentage, unlockedBadges };
}
