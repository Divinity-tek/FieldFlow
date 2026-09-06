import { useState, useEffect } from "react";
import { X, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUserPreference } from "@/hooks/useUserPreference";

interface ContextualHelpBannerProps {
  pageKey: string;
  title: string;
  description: string;
  tips?: string[];
}

const ContextualHelpBanner = ({ pageKey, title, description, tips }: ContextualHelpBannerProps) => {
  const { value: dismissed, update: setDismissed, loaded } = useUserPreference<boolean>(`help-banner-dismissed-${pageKey}`, false);

  const dismiss = () => {
    setDismissed(true);
  };

  if (!loaded || dismissed) return null;

  return (
    <div className="relative mb-6 rounded-xl border border-primary/20 bg-gradient-to-r from-primary/5 via-primary/10 to-accent/5 p-4 pr-12 animate-fade-in">
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-2 top-2 h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
        onClick={dismiss}
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </Button>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Lightbulb className="h-4 w-4" />
        </div>
        <div className="space-y-1.5">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
          {tips && tips.length > 0 && (
            <ul className="mt-2 space-y-1">
              {tips.map((tip, i) => (
                <li key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="h-1 w-1 rounded-full bg-primary/60 shrink-0" />
                  {tip}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContextualHelpBanner;
