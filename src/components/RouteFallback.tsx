import { Loader2 } from "lucide-react";

const RouteFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="flex items-center gap-2.5 text-muted-foreground">
      <Loader2 className="w-4 h-4 animate-spin text-primary" />
      <span className="text-sm font-medium">Loading…</span>
    </div>
  </div>
);

export default RouteFallback;
