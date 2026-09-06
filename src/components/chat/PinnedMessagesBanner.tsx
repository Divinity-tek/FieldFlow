import { useState } from "react";
import { Pin, ChevronDown, ChevronUp, X } from "lucide-react";
import type { PinnedMessage } from "@/hooks/usePinnedMessages";

interface PinnedMessagesBannerProps {
  pinnedMessages: PinnedMessage[];
  getSenderName: (senderId: string) => string;
  onUnpin: (messageId: string) => void;
}

const PinnedMessagesBanner = ({ pinnedMessages, getSenderName, onUnpin }: PinnedMessagesBannerProps) => {
  const [expanded, setExpanded] = useState(false);

  if (pinnedMessages.length === 0) return null;

  const displayed = expanded ? pinnedMessages : pinnedMessages.slice(0, 1);

  return (
    <div className="border-b bg-accent/20 px-4 py-2">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <Pin className="w-3.5 h-3.5 text-primary" />
          Pinned {pinnedMessages.length > 1 ? `(${pinnedMessages.length})` : ""}
        </div>
        {pinnedMessages.length > 1 && (
          <button onClick={() => setExpanded(!expanded)} className="text-muted-foreground hover:text-foreground transition-colors">
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>
      <div className="space-y-1">
        {displayed.map((msg) => (
          <div key={msg.id} className="flex items-start gap-2 group">
            <div className="flex-1 min-w-0">
              <span className="text-[11px] font-medium text-foreground">{getSenderName(msg.sender_id)}: </span>
              <span className="text-[11px] text-muted-foreground line-clamp-1">{msg.content}</span>
            </div>
            <button
              onClick={() => onUnpin(msg.id)}
              className="opacity-0 group-hover:opacity-100 shrink-0 text-muted-foreground hover:text-destructive transition-all"
              title="Unpin"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PinnedMessagesBanner;
