import { useState, useMemo } from "react";
import { SmilePlus, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { Reaction } from "@/hooks/useMessageReactions";

const EMOJI_CATEGORIES: { label: string; icon: string; emojis: string[] }[] = [
  {
    label: "Smileys",
    icon: "😀",
    emojis: [
      "😀","😃","😄","😁","😆","😅","🤣","😂","🙂","🙃","😉","😊","😇",
      "🥰","😍","🤩","😘","😗","😚","😙","🥲","😋","😛","😜","🤪","😝",
      "🤑","🤗","🤭","🤫","🤔","🫡","🤐","🤨","😐","😑","😶","🫥","😏",
      "😒","🙄","😬","🤥","😌","😔","😪","🤤","😴","😷","🤒","🤕","🤢",
      "🤮","🥵","🥶","🥴","😵","🤯","🤠","🥳","🥸","😎","🤓","🧐",
    ],
  },
  {
    label: "Gestures",
    icon: "👍",
    emojis: [
      "👍","👎","👊","✊","🤛","🤜","👏","🙌","🫶","👐","🤲","🤝","🙏",
      "✌️","🤞","🫰","🤟","🤘","🤙","👈","👉","👆","👇","☝️","✋","🤚",
      "🖐️","🖖","🫱","🫲","👋","🤏","✍️","💪","🦾","🫵",
    ],
  },
  {
    label: "Hearts",
    icon: "❤️",
    emojis: [
      "❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❤️‍🔥","❤️‍🩹",
      "💕","💞","💓","💗","💖","💘","💝","💟","♥️","💌",
    ],
  },
  {
    label: "Objects",
    icon: "🎉",
    emojis: [
      "🎉","🎊","🎈","🎁","🏆","🥇","🥈","🥉","⚽","🏀","🎯","🎮",
      "🎵","🎶","🎤","🎧","📱","💻","⌚","📷","💡","🔔","📌","📎",
      "✏️","📝","📚","💰","💎","🔑","🔒","⭐","🌟","💫","✨","⚡",
      "🔥","💯","✅","❌","⚠️","💬","💭","🗨️","👁️‍🗨️",
    ],
  },
  {
    label: "Nature",
    icon: "🌸",
    emojis: [
      "🌸","🌺","🌻","🌹","🌷","🌼","🍀","🌿","🍃","🍂","🍁","🌾",
      "🌵","🌴","🌲","🌳","🍄","🐶","🐱","🐭","🐹","🐰","🦊","🐻",
      "🐼","🐨","🐯","🦁","🐮","🐷","🐸","🐵","🐔","🐧","🐦","🦅",
      "🦋","🐛","🐝","🐞","🦀","🐙","🐬","🐳","🦈",
    ],
  },
  {
    label: "Food",
    icon: "🍕",
    emojis: [
      "🍕","🍔","🍟","🌭","🥪","🌮","🌯","🥗","🍝","🍜","🍣","🍱",
      "🍩","🍪","🎂","🍰","🧁","🍫","🍬","🍭","🍿","🥤","☕","🍵",
      "🥂","🍷","🍺","🍻","🥃",
    ],
  },
];

const ALL_EMOJIS = EMOJI_CATEGORIES.flatMap(c => c.emojis.map(e => ({ emoji: e, category: c.label })));

interface MessageReactionsProps {
  reactions: Reaction[];
  currentUserId: string;
  onToggle: (emoji: string) => void;
  isMe: boolean;
}

const MessageReactions = ({ reactions, currentUserId, onToggle, isMe }: MessageReactionsProps) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState(0);

  const filtered = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.toLowerCase();
    return ALL_EMOJIS.filter(e => e.emoji.includes(q) || e.category.toLowerCase().includes(q)).map(e => e.emoji);
  }, [search]);

  return (
    <div className={cn("flex items-center gap-1 flex-wrap mt-1", isMe ? "justify-end" : "justify-start")}>
      {reactions.map((r) => {
        const isMine = r.userIds.includes(currentUserId);
        return (
          <button
            key={r.emoji}
            onClick={() => onToggle(r.emoji)}
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs border transition-colors hover:bg-accent/50",
              isMine ? "border-primary/40 bg-primary/10" : "border-border bg-muted/50"
            )}
          >
            <span>{r.emoji}</span>
            <span className="text-[10px] text-muted-foreground">{r.userIds.length}</span>
          </button>
        );
      })}

      <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setSearch(""); setActiveCategory(0); } }}>
        <PopoverTrigger asChild>
          <button className="inline-flex items-center justify-center w-6 h-6 rounded-full hover:bg-accent/50 text-muted-foreground transition-colors opacity-0 group-hover:opacity-100">
            <SmilePlus className="w-3.5 h-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-0" side={isMe ? "left" : "right"} align="start">
          {/* Search */}
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Search emoji..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="h-8 pl-7 text-xs"
              />
            </div>
          </div>

          {/* Category tabs */}
          {!search.trim() && (
            <div className="flex border-b px-1 pt-1">
              {EMOJI_CATEGORIES.map((cat, i) => (
                <button
                  key={cat.label}
                  onClick={() => setActiveCategory(i)}
                  className={cn(
                    "flex-1 flex items-center justify-center py-1.5 text-base rounded-t transition-colors",
                    activeCategory === i ? "bg-accent" : "hover:bg-accent/50"
                  )}
                  title={cat.label}
                >
                  {cat.icon}
                </button>
              ))}
            </div>
          )}

          {/* Emoji grid */}
          <ScrollArea className="h-[200px]">
            <div className="p-2">
              {search.trim() ? (
                <>
                  {filtered && filtered.length > 0 ? (
                    <div className="grid grid-cols-8 gap-0.5">
                      {filtered.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => { onToggle(emoji); setOpen(false); setSearch(""); }}
                          className="w-8 h-8 flex items-center justify-center rounded hover:bg-accent text-lg transition-colors"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-4">No emoji found</p>
                  )}
                </>
              ) : (
                <>
                  <p className="text-[10px] font-medium text-muted-foreground mb-1.5 px-1">
                    {EMOJI_CATEGORIES[activeCategory].label}
                  </p>
                  <div className="grid grid-cols-8 gap-0.5">
                    {EMOJI_CATEGORIES[activeCategory].emojis.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => { onToggle(emoji); setOpen(false); }}
                        className="w-8 h-8 flex items-center justify-center rounded hover:bg-accent text-lg transition-colors"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default MessageReactions;
