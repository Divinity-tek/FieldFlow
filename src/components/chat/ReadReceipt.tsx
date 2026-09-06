import { Check, CheckCheck } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface ReadReceiptProps {
  /** Names of members who have read this message */
  readByNames: string[];
  /** Total other members in room (excluding sender) */
  totalOtherMembers: number;
}

const ReadReceipt = ({ readByNames, totalOtherMembers }: ReadReceiptProps) => {
  if (totalOtherMembers === 0) return null;

  const allRead = readByNames.length >= totalOtherMembers;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center ml-1">
          {allRead ? (
            <CheckCheck className="w-3.5 h-3.5 text-primary" />
          ) : readByNames.length > 0 ? (
            <CheckCheck className="w-3.5 h-3.5 text-muted-foreground" />
          ) : (
            <Check className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs max-w-[200px]">
        {readByNames.length === 0
          ? "Sent"
          : allRead
            ? `Read by all`
            : `Read by ${readByNames.join(", ")}`}
      </TooltipContent>
    </Tooltip>
  );
};

export default ReadReceipt;
