import { useEffect, useState, useRef } from "react";
import { useOnboarding } from "./OnboardingContext";
import { Button } from "@/components/ui/button";
import { X, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";

const OnboardingOverlay = () => {
  const { isActive, currentStep, totalSteps, steps, nextStep, prevStep, skipTour, completeTour } = useOnboarding();
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isActive) return;
    const step = steps[currentStep];
    if (!step) return;

    const findTarget = () => {
      const el = document.querySelector(step.target);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "nearest" });
        setTimeout(() => setRect(el.getBoundingClientRect()), 300);
      } else {
        setRect(null);
      }
    };

    findTarget();
    const resizeObserver = new ResizeObserver(findTarget);
    resizeObserver.observe(document.body);
    return () => resizeObserver.disconnect();
  }, [isActive, currentStep, steps]);

  useEffect(() => {
    if (!rect || !tooltipRef.current) return;
    const step = steps[currentStep];
    const placement = step?.placement || "right";
    const ttRect = tooltipRef.current.getBoundingClientRect();
    const pad = 16;
    let top = 0, left = 0;

    switch (placement) {
      case "right":  top = rect.top + rect.height / 2 - ttRect.height / 2; left = rect.right + pad; break;
      case "left":   top = rect.top + rect.height / 2 - ttRect.height / 2; left = rect.left - ttRect.width - pad; break;
      case "bottom": top = rect.bottom + pad; left = rect.left + rect.width / 2 - ttRect.width / 2; break;
      case "top":    top = rect.top - ttRect.height - pad; left = rect.left + rect.width / 2 - ttRect.width / 2; break;
    }

    top = Math.max(8, Math.min(top, window.innerHeight - ttRect.height - 8));
    left = Math.max(8, Math.min(left, window.innerWidth - ttRect.width - 8));
    setTooltipStyle({ top, left });
  }, [rect, currentStep, steps]);

  if (!isActive) return null;

  const step = steps[currentStep];
  const isLast = currentStep === totalSteps - 1;

  return (
    <div className="fixed inset-0 z-[9999]">
      <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: "none" }}>
        <defs>
          <mask id="onboarding-spotlight">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {rect && (
              <rect x={rect.left - 6} y={rect.top - 6} width={rect.width + 12} height={rect.height + 12} rx="12" fill="black" />
            )}
          </mask>
        </defs>
        <rect x="0" y="0" width="100%" height="100%" fill="rgba(0,0,0,0.55)" mask="url(#onboarding-spotlight)" style={{ pointerEvents: "all" }} onClick={skipTour} />
      </svg>

      {rect && (
        <div
          className="absolute rounded-xl border-2 border-primary shadow-[0_0_0_4px_hsl(var(--primary)/0.2)] transition-all duration-500 ease-out pointer-events-none"
          style={{ top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12 }}
        />
      )}

      <div ref={tooltipRef} className="absolute z-[10000] w-80 rounded-2xl border border-primary/20 bg-card shadow-2xl p-5 transition-all duration-500 ease-out animate-fade-in" style={tooltipStyle}>
        <button onClick={skipTour} className="absolute right-3 top-3 p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 mb-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-medium text-muted-foreground">Step {currentStep + 1} of {totalSteps}</span>
        </div>

        <h3 className="text-sm font-bold text-foreground mb-1.5">{step?.title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed mb-4">{step?.content}</p>

        <div className="flex items-center gap-1.5 mb-4">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === currentStep ? "w-6 bg-primary" : i < currentStep ? "w-1.5 bg-primary/40" : "w-1.5 bg-muted"}`} />
          ))}
        </div>

        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={skipTour} className="text-xs text-muted-foreground hover:text-foreground">Skip tour</Button>
          <div className="flex items-center gap-2">
            {currentStep > 0 && (
              <Button variant="outline" size="sm" onClick={prevStep} className="h-8 px-3 text-xs">
                <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Back
              </Button>
            )}
            <Button size="sm" onClick={isLast ? completeTour : nextStep} className="h-8 px-4 text-xs font-semibold">
              {isLast ? "Finish" : "Next"} {!isLast && <ChevronRight className="w-3.5 h-3.5 ml-1" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingOverlay;
