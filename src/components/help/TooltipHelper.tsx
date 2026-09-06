import { HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface TooltipHelperProps {
  text: string;
  side?: "top" | "right" | "bottom" | "left";
  className?: string;
}

const TooltipHelper = ({ text, side = "top", className }: TooltipHelperProps) => {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <HelpCircle className={`w-3.5 h-3.5 text-muted-foreground/60 hover:text-muted-foreground cursor-help inline-block ml-1 ${className ?? ""}`} />
      </TooltipTrigger>
      <TooltipContent side={side} className="max-w-[250px] text-xs">
        <p>{text}</p>
      </TooltipContent>
    </Tooltip>
  );
};

export default TooltipHelper;
