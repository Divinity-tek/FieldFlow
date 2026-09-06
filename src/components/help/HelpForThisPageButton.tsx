import { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { resolveHelpDoc } from "@/lib/helpRouteMatch";

interface HelpForThisPageButtonProps {
  /** Override the path used to resolve the doc; defaults to the current route. */
  path?: string;
  /** Visual style. */
  variant?: "default" | "outline" | "ghost" | "secondary";
  /** Size. */
  size?: "default" | "sm" | "icon";
  /** Override label text. */
  label?: string;
  className?: string;
}

/**
 * Renders a "Help for this page" button. When the current route has a matching
 * help doc, it deep-links to /help/<slug>. Otherwise it falls back to /help.
 */
const HelpForThisPageButton = ({
  path,
  variant = "outline",
  size = "sm",
  label = "Help for this page",
  className,
}: HelpForThisPageButtonProps) => {
  const location = useLocation();
  const effectivePath = path ?? location.pathname;
  const doc = useMemo(() => resolveHelpDoc(effectivePath), [effectivePath]);
  const target = doc ? `/help/${doc.slug}` : "/help";
  const tooltip = doc ? `Open the help guide for ${doc.title}` : "Browse the help center";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button asChild variant={variant} size={size} className={className}>
          <Link to={target} aria-label={tooltip}>
            <LifeBuoy className="h-4 w-4 mr-1.5" />
            {label}
          </Link>
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{tooltip}</p>
      </TooltipContent>
    </Tooltip>
  );
};

export default HelpForThisPageButton;
