import { useState } from "react";
import { useChatSearch, type SearchResult } from "@/hooks/useChatSearch";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, X, Loader2, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatMessageSearchProps {
  onJumpToRoom: (roomId: string, messageId: string) => void;
}

const ChatMessageSearch = ({ onJumpToRoom }: ChatMessageSearchProps) => {
  const { query, setQuery, results, isSearching } = useChatSearch();
  const [open, setOpen] = useState(false);

  const highlightMatch = (text: string, term: string) => {
    if (!term || term.length < 2) return text;
    const idx = text.toLowerCase().indexOf(term.toLowerCase());
    if (idx === -1) return text.length > 120 ? text.slice(0, 120) + "…" : text;
    const start = Math.max(0, idx - 40);
    const end = Math.min(text.length, idx + term.length + 60);
    const snippet = (start > 0 ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : "");
    const parts = snippet.split(new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
    return (
      <span>
        {parts.map((part, i) =>
          part.toLowerCase() === term.toLowerCase() ? (
            <mark key={i} className="bg-primary/20 text-foreground rounded-sm px-0.5">{part}</mark>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </span>
    );
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Search messages…"
          className="pl-9 pr-8 h-9 text-sm"
        />
        {query && (
          <button
            onClick={() => { setQuery(""); setOpen(false); }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {open && query.length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-popover border rounded-lg shadow-lg overflow-hidden">
          {isSearching ? (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Searching…
            </div>
          ) : results.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No messages found for "{query}"
            </div>
          ) : (
            <ScrollArea className="max-h-[320px]">
              <div className="p-1">
                {results.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => {
                      onJumpToRoom(r.room_id, r.id);
                      setOpen(false);
                    }}
                    className="w-full text-left px-3 py-2.5 rounded-md hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <MessageSquare className="w-3 h-3 text-muted-foreground shrink-0" />
                      <span className="text-[11px] font-medium text-muted-foreground truncate">
                        {r.room_name}
                      </span>
                      <span className="text-[10px] text-muted-foreground/60 ml-auto shrink-0">
                        {new Date(r.created_at).toLocaleDateString([], { month: "short", day: "numeric" })}
                      </span>
                    </div>
                    <div className="text-sm leading-snug">
                      {highlightMatch(r.content, query)}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {r.sender_name}
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      )}
    </div>
  );
};

export default ChatMessageSearch;
