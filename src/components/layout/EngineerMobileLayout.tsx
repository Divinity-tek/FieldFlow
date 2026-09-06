import { ReactNode, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Briefcase, LayoutDashboard, Store, User, LogOut, Wallet, Bot, Menu,
  Sparkles, Ticket, MessageSquare, BookOpen, Bell,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import NotificationBell from "@/components/notifications/NotificationBell";
import { useRealtimeNotifications } from "@/hooks/useRealtimeNotifications";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import AppSidebar from "./AppSidebar";

interface EngineerMobileLayoutProps {
  children: ReactNode;
  title: string;
}

// Bottom nav (compact). Static — always renders.
const bottomNav = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/engineer" },
  { label: "My Jobs", icon: Briefcase, path: "/engineer/jobs" },
  { label: "Earnings", icon: Wallet, path: "/engineer/earnings" },
  { label: "Assistant", icon: Bot, path: "/engineer/assistant" },
  { label: "Marketplace", icon: Store, path: "/marketplace" },
  { label: "Profile", icon: User, path: "/engineer/profile" },
];

// Full collapsible side menu — superset including secondary destinations.
// Defined as a constant so the menu is never empty, even before any data loads.
const sideMenu = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/engineer" },
  { label: "My Jobs", icon: Briefcase, path: "/engineer/jobs" },
  { label: "SmartMatch Alerts", icon: Sparkles, path: "/engineer/smart-match" },
  { label: "Earnings", icon: Wallet, path: "/engineer/earnings" },
  { label: "Assistant", icon: Bot, path: "/engineer/assistant" },
  { label: "Marketplace", icon: Store, path: "/marketplace" },
  { label: "Dispatch Tickets", icon: Ticket, path: "/dispatch-tickets" },
  { label: "Team Chat", icon: MessageSquare, path: "/internal-chat" },
  { label: "Knowledge Base", icon: BookOpen, path: "/knowledge-base" },
  { label: "Notifications", icon: Bell, path: "/notifications" },
  { label: "Profile", icon: User, path: "/engineer/profile" },
];

const EXACT_ONLY = new Set(["/engineer"]);
const isPathActive = (pathname: string, path: string) => {
  if (EXACT_ONLY.has(path)) return pathname === path;
  return pathname === path || pathname.startsWith(path + "/");
};

const EngineerMobileLayout = ({ children, title }: EngineerMobileLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { notifications, unreadCount, markAllRead, markRead } = useRealtimeNotifications();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  // Defensive: side menu is constant, but in case it ever becomes empty,
  // fall back to bottom nav so the drawer never renders blank.
  const menuItems = sideMenu.length > 0 ? sideMenu : bottomNav;

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar mobileOpen={false} onMobileClose={() => undefined} />

      <div className="min-h-screen flex flex-col lg:ml-[264px]">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <button
                aria-label="Open menu"
                className="lg:hidden text-muted-foreground hover:text-foreground transition-colors p-2 -ml-2 rounded-lg hover:bg-muted"
              >
                <Menu className="w-5 h-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[82%] max-w-xs p-0 flex flex-col">
              <SheetHeader className="px-4 py-4 border-b border-border">
                <SheetTitle className="flex items-center gap-2 text-left">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Briefcase className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-base font-bold">Engineer Menu</span>
                </SheetTitle>
              </SheetHeader>
              <nav className="flex-1 overflow-y-auto py-2">
                {menuItems.map((item) => {
                  const active = isPathActive(location.pathname, item.path);
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setMenuOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
                        active
                          ? "bg-accent text-primary font-semibold border-l-2 border-primary"
                          : "text-foreground hover:bg-muted"
                      }`}
                    >
                      <item.icon className={`w-4 h-4 ${active ? "text-primary" : "text-muted-foreground"}`} />
                      <span className="flex-1">{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
              <div className="border-t border-border p-3">
                <button
                  onClick={() => { setMenuOpen(false); handleLogout(); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign out</span>
                </button>
              </div>
            </SheetContent>
          </Sheet>
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Briefcase className="w-4 h-4 text-primary" />
          </div>
          <h1 className="text-base font-bold text-foreground">{title}</h1>
        </div>
        <div className="flex items-center gap-1">
          <NotificationBell
            notifications={notifications}
            unreadCount={unreadCount}
            onMarkAllRead={markAllRead}
            onMarkRead={markRead}
          />
          <button onClick={handleLogout} className="text-muted-foreground hover:text-foreground transition-colors p-2" aria-label="Sign out">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto pb-20 px-4 py-4 lg:pb-8 lg:px-6 lg:py-6">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border flex items-center justify-around py-2 px-4 lg:hidden">
        {bottomNav.map((item) => {
          const isActive = isPathActive(location.pathname, item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              data-tour={`engineer-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
              className={`flex flex-col items-center gap-1 px-4 py-1.5 rounded-lg transition-colors ${
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      </div>
    </div>
  );
};

export default EngineerMobileLayout;
