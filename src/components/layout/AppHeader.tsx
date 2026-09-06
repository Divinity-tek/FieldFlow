import { Search, Menu, HelpCircle, Moon, Sun, BookOpen } from "lucide-react";
import { Link } from "react-router-dom";
import NotificationBell from "@/components/notifications/NotificationBell";
import { useRealtimeNotifications } from "@/hooks/useRealtimeNotifications";
import { useTheme } from "@/hooks/useTheme";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { LanguageSwitcher, CurrencySwitcher } from "@/components/layout/LanguageCurrencySwitcher";
import ContextualHelpDrawer from "@/components/help/ContextualHelpDrawer";
import HelpForThisPageButton from "@/components/help/HelpForThisPageButton";
import FieldFlowMark from "@/components/branding/FieldFlowMark";
import OfflineQueueIndicator from "@/components/offline/OfflineQueueIndicator";

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  onMenuToggle?: () => void;
  onHelpToggle?: () => void;
}

const AppHeader = ({ title, subtitle, onMenuToggle, onHelpToggle }: AppHeaderProps) => {
  const { notifications, unreadCount, markAllRead, markRead } = useRealtimeNotifications();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-40 glass-card px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {onMenuToggle && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onMenuToggle}
                  className="lg:hidden p-2 -ml-2 rounded-xl hover:bg-secondary transition-colors"
                >
                  <Menu className="w-5 h-5 text-foreground" />
                </button>
              </TooltipTrigger>
              <TooltipContent><p>Open navigation menu</p></TooltipContent>
            </Tooltip>
          )}
          <div className="min-w-0 flex items-center gap-2.5">
            <Link to="/" aria-label="FieldFlow home" className="hidden sm:flex shrink-0">
              <FieldFlowMark
                variant="icon"
                width={36}
                height={36}
                alt="FieldFlow logo"
                className="w-9 h-9 object-contain"
              />
            </Link>
            <div className="min-w-0 flex items-center gap-1.5">
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-bold font-display text-foreground truncate tracking-tight">{title}</h1>
                {subtitle && <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 truncate">{subtitle}</p>}
              </div>
              <ContextualHelpDrawer variant="icon" />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="relative hidden sm:block" data-tour="header-search">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search jobs, clients, engineers..."
                  className="w-40 md:w-56 pl-9 pr-4 py-2 rounded-xl border border-input bg-background/80 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 transition-all"
                />
              </div>
            </TooltipTrigger>
            <TooltipContent><p>Search across all data</p></TooltipContent>
          </Tooltip>

          <div className="hidden md:flex items-center gap-2">
            <CurrencySwitcher />
            <LanguageSwitcher />
          </div>

          <div className="hidden lg:block">
            <HelpForThisPageButton />
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={toggleTheme}
                className="p-2 rounded-xl hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                data-tour="header-theme"
              >
                {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
            </TooltipTrigger>
            <TooltipContent><p>{theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}</p></TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onHelpToggle}
                className="p-2 rounded-xl hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                data-tour="header-help"
              >
                <HelpCircle className="w-5 h-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent><p>Help & documentation (press ?)</p></TooltipContent>
          </Tooltip>

          <OfflineQueueIndicator />

          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                to="/help"
                className="p-2 rounded-xl hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                aria-label="Help center"
              >
                <BookOpen className="w-5 h-5" />
              </Link>
            </TooltipTrigger>
            <TooltipContent><p>Help center — guides for every section</p></TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <div data-tour="header-notifications">
                <NotificationBell
                  notifications={notifications}
                  unreadCount={unreadCount}
                  onMarkAllRead={markAllRead}
                  onMarkRead={markRead}
                />
              </div>
            </TooltipTrigger>
            <TooltipContent><p>Notifications{unreadCount > 0 ? ` (${unreadCount} unread)` : ''}</p></TooltipContent>
          </Tooltip>
        </div>
      </div>
    </header>
  );
};

export default AppHeader;