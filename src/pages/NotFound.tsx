import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Compass, ArrowLeft, Home } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6 relative overflow-hidden">
      <div className="absolute inset-0 dot-pattern opacity-20" />
      <div className="absolute top-1/4 left-1/3 w-[420px] h-[420px] bg-primary/6 rounded-full blur-[140px]" />

      <div className="relative max-w-md w-full text-center space-y-6">
        <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center mx-auto shadow-glow">
          <Compass className="w-7 h-7 text-primary-foreground" />
        </div>

        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-primary font-semibold">Error 404</p>
          <h1 className="text-display-md font-display text-foreground">Page not found</h1>
          <p className="text-sm text-muted-foreground">
            The page <code className="px-1.5 py-0.5 rounded bg-muted text-foreground text-xs">{location.pathname}</code> doesn't exist or was moved.
          </p>
        </div>

        <div className="flex gap-2 justify-center pt-2">
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-border bg-card text-foreground text-sm font-medium hover:bg-secondary/50 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Go back
          </button>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg gradient-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            <Home className="w-3.5 h-3.5" /> Home
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
