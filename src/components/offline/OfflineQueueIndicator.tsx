import { useState } from "react";
import { CloudOff, Cloud, RefreshCw, Trash2, AlertTriangle, Clock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useOfflineCounts } from "@/hooks/useOfflineQueue";
import { drainQueue, retryAction } from "@/lib/offlineSync";
import { remove, clear } from "@/lib/offlineQueue";
import { formatDistanceToNow } from "date-fns";

const OfflineQueueIndicator = () => {
  const { items, pending, failed, conflict, total } = useOfflineCounts();
  const [open, setOpen] = useState(false);

  if (total === 0) return null;

  const hasIssues = failed > 0 || conflict > 0;

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => setOpen(true)}
            className="relative p-2 rounded-xl hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
            aria-label={`Offline queue: ${total} item${total === 1 ? "" : "s"}`}
          >
            {hasIssues ? (
              <CloudOff className="w-5 h-5 text-destructive" />
            ) : pending > 0 ? (
              <Cloud className="w-5 h-5 text-amber-500" />
            ) : (
              <Cloud className="w-5 h-5" />
            )}
            <Badge
              variant={hasIssues ? "destructive" : "secondary"}
              className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] leading-none rounded-full"
            >
              {total}
            </Badge>
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            {pending > 0 && `${pending} pending`}
            {pending > 0 && (failed + conflict) > 0 && ", "}
            {failed > 0 && `${failed} failed`}
            {failed > 0 && conflict > 0 && ", "}
            {conflict > 0 && `${conflict} conflict${conflict === 1 ? "" : "s"}`}
          </p>
        </TooltipContent>
      </Tooltip>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CloudOff className="w-5 h-5" />
              Offline queue
            </DialogTitle>
            <DialogDescription>
              {pending > 0
                ? "These changes were saved while offline and will sync automatically when you're back online."
                : hasIssues
                  ? "Some offline changes couldn't be applied. Review them below."
                  : "All changes are synced."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-between gap-2 py-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> {pending} pending</span>
              {failed > 0 && <span className="inline-flex items-center gap-1 text-destructive"><AlertTriangle className="w-3 h-3" /> {failed} failed</span>}
              {conflict > 0 && <span className="inline-flex items-center gap-1 text-destructive"><AlertTriangle className="w-3 h-3" /> {conflict} conflict</span>}
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => drainQueue()} disabled={!navigator.onLine}>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Sync now
              </Button>
              {hasIssues && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    await clear("conflict");
                    await clear("failed");
                  }}
                >
                  Discard issues
                </Button>
              )}
            </div>
          </div>

          <ScrollArea className="max-h-[50vh] pr-3">
            <ul className="space-y-2">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="rounded-lg border border-border/60 bg-card p-3 text-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">{item.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatDistanceToNow(item.createdAt, { addSuffix: true })}
                        {item.attempts > 0 && ` · ${item.attempts} attempt${item.attempts === 1 ? "" : "s"}`}
                      </p>
                      {item.lastError && (
                        <p className="text-xs text-destructive mt-1 line-clamp-2">{item.lastError}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Badge
                        variant={
                          item.status === "conflict" || item.status === "failed"
                            ? "destructive"
                            : item.status === "syncing"
                              ? "default"
                              : "secondary"
                        }
                        className="text-[10px]"
                      >
                        {item.status}
                      </Badge>
                      {(item.status === "failed" || item.status === "conflict") && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => retryAction(item.id)}
                              className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
                              aria-label="Retry"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent><p>Retry</p></TooltipContent>
                        </Tooltip>
                      )}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => remove(item.id)}
                            className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-destructive"
                            aria-label="Discard"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent><p>Discard</p></TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default OfflineQueueIndicator;
