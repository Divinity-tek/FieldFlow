import { useEffect, useState, useCallback } from "react";
import { Bell, CheckCheck, Plus, UserCheck, X, Trash2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export type MarketplaceEventType = "posted" | "taken" | "cancelled";

export interface MarketplaceNotification {
  id: string;
  type: MarketplaceEventType;
  title: string;
  message: string;
  listingId?: string;
  jobTitle?: string;
  timestamp: number;
  read: boolean;
}

const STORAGE_KEY = "ff:marketplace-notifications";
const MAX_ITEMS = 50;

const readStore = (): MarketplaceNotification[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as MarketplaceNotification[]) : [];
  } catch {
    return [];
  }
};

const writeStore = (items: MarketplaceNotification[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
  window.dispatchEvent(new CustomEvent("ff:marketplace-notifications:update"));
};

export const pushMarketplaceNotification = (
  n: Omit<MarketplaceNotification, "id" | "timestamp" | "read">,
) => {
  const item: MarketplaceNotification = {
    ...n,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    read: false,
  };
  writeStore([item, ...readStore()]);
};

const iconByType = { posted: Plus, taken: UserCheck, cancelled: X } as const;
const colorByType: Record<MarketplaceEventType, string> = {
  posted: "bg-primary/10 text-primary",
  taken: "bg-blue-500/10 text-blue-500",
  cancelled: "bg-destructive/10 text-destructive",
};

const formatTime = (ts: number) => {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(ts).toLocaleDateString();
};

const MarketplaceNotificationCenter = () => {
  const [items, setItems] = useState<MarketplaceNotification[]>(() => readStore());
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const sync = () => setItems(readStore());
    window.addEventListener("ff:marketplace-notifications:update", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("ff:marketplace-notifications:update", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const unread = items.filter(i => !i.read).length;

  const markAllRead = useCallback(() => {
    writeStore(items.map(i => ({ ...i, read: true })));
  }, [items]);

  const markRead = useCallback((id: string) => {
    writeStore(items.map(i => (i.id === id ? { ...i, read: true } : i)));
  }, [items]);

  const clearAll = useCallback(() => writeStore([]), []);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="relative h-10">
          <Bell className="h-4 w-4 mr-2" />
          Activity
          {unread > 0 && (
            <Badge className="ml-2 h-5 px-1.5 min-w-[20px]" variant="destructive">
              {unread > 99 ? "99+" : unread}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end" sideOffset={8}>
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div>
            <h3 className="text-sm font-semibold">Marketplace activity</h3>
            <p className="text-xs text-muted-foreground">Real-time job events</p>
          </div>
          <div className="flex items-center gap-1">
            {unread > 0 && (
              <Button variant="ghost" size="sm" onClick={markAllRead} className="h-7 text-xs">
                <CheckCheck className="h-3 w-3 mr-1" /> Mark all
              </Button>
            )}
            {items.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearAll} className="h-7 text-xs">
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
        <ScrollArea className="max-h-[400px]">
          {items.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No marketplace activity yet
            </div>
          ) : (
            <div className="divide-y">
              {items.map(n => {
                const Icon = iconByType[n.type];
                return (
                  <button
                    key={n.id}
                    onClick={() => markRead(n.id)}
                    className={`w-full text-left px-4 py-3 flex gap-3 hover:bg-muted/50 transition-colors ${
                      !n.read ? "bg-primary/[0.04]" : ""
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${colorByType[n.type]}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-semibold truncate">{n.title}</p>
                        {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">{formatTime(n.timestamp)}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default MarketplaceNotificationCenter;
