import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface PresenceDotProps {
  isOnline: boolean;
  size?: "sm" | "md";
  className?: string;
}

const PresenceDot = ({ isOnline, size = "sm", className }: PresenceDotProps) => {
  const sizeClass = size === "sm" ? "w-2 h-2" : "w-2.5 h-2.5";

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-block rounded-full border border-background shrink-0",
              sizeClass,
              isOnline
                ? "bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.6)]"
                : "bg-muted-foreground/40",
              className
            )}
          />
        </TooltipTrigger>
        <TooltipContent side="top" className="text-[10px] px-2 py-1">
          {isOnline ? "Online" : "Offline"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default PresenceDot;
