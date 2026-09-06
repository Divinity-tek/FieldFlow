import { Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface AskAIButtonProps {
  prompt: string;
  label?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "icon";
  className?: string;
}

/**
 * Button that opens the global Floating AI Chat with a pre-filled prompt.
 * Dispatches a window event consumed by FloatingAIChat — no navigation.
 *
 * NOTE: FloatingAIChat is currently disabled in App.tsx, so clicking this is a
 * harmless no-op until that feature is re-enabled. The component is restored
 * (it was fully commented out) because 7 pages import and render it.
 */
const AskAIButton = ({ prompt, label = "Ask AI", variant = "outline", size = "sm", className }: AskAIButtonProps) => {
  const handleClick = () => {
    window.dispatchEvent(
      new CustomEvent("ai-assistant-open", { detail: { prompt, autoSend: true } })
    );
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant={variant} size={size} onClick={handleClick} className={className}>
          <Bot className="w-4 h-4 mr-1.5" />
          {label}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p className="text-xs max-w-[200px]">Open the AI assistant with this question pre-filled</p>
      </TooltipContent>
    </Tooltip>
  );
};

export default AskAIButton;
