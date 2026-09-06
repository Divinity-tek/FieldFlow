import { useState, useMemo } from "react";
import {
  HelpCircle, X, Search, Book, Lightbulb, Keyboard, ExternalLink,
  LayoutDashboard, Briefcase, UserCheck, Building2, Users, MapPin,
  Radar, CalendarDays, FileText, Receipt, Shield, Bot, MessageSquare,
  CreditCard, Wallet, DollarSign, Globe, BarChart3, Bell, Settings,
  ChevronRight, Zap, ClipboardCheck,
} from "lucide-react";

interface HelpItem {
  title: string;
  description: string;
  icon: typeof HelpCircle;
  category: "navigation" | "feature" | "shortcut" | "tip";
  keywords: string[];
}

const helpItems: HelpItem[] = [
  // Navigation
  { title: "Dashboard", description: "Overview of all operations — KPI widgets, charts, activity feed, and real-time metrics.", icon: LayoutDashboard, category: "navigation", keywords: ["home", "overview", "metrics", "kpi"] },
  { title: "Jobs", description: "Create, assign, and manage service jobs. Track status from pending to completion.", icon: Briefcase, category: "navigation", keywords: ["work", "tasks", "service", "orders"] },
  { title: "Engineers", description: "View and manage field engineers — availability, skills, ratings, and performance.", icon: UserCheck, category: "navigation", keywords: ["technicians", "staff", "workers", "field"] },
  { title: "Clients", description: "Manage client accounts and contact details.", icon: Building2, category: "navigation", keywords: ["customers", "accounts", "companies"] },
  { title: "Partners", description: "Manage referral and business partners with commission tracking.", icon: Users, category: "navigation", keywords: ["referrals", "affiliates", "business"] },
  { title: "Dispatch Map", description: "Visual map showing engineer locations, job sites, and optimal routing.", icon: MapPin, category: "navigation", keywords: ["map", "routing", "locations", "gps"] },
  { title: "Live Tracking", description: "Real-time GPS tracking of engineers in the field with smooth animated markers.", icon: Radar, category: "navigation", keywords: ["gps", "real-time", "location", "tracking", "uber"] },
  { title: "Scheduling", description: "Calendar-based scheduling for jobs and engineer availability management.", icon: CalendarDays, category: "navigation", keywords: ["calendar", "availability", "booking", "schedule"] },
  { title: "Estimates", description: "Create and send professional estimates to clients with line items and tax.", icon: FileText, category: "navigation", keywords: ["quotes", "proposals", "pricing"] },
  { title: "Invoices", description: "Generate invoices from completed jobs, track payments, and manage billing.", icon: Receipt, category: "navigation", keywords: ["billing", "payments", "receipts"] },
  { title: "SLA Tracking", description: "Monitor service level agreements — response times, breach alerts, and compliance.", icon: Shield, category: "navigation", keywords: ["compliance", "response time", "breach"] },
  { title: "AI Assistant", description: "Chat with AI to get insights, generate reports, and automate tasks.", icon: Bot, category: "navigation", keywords: ["chat", "ai", "automation", "insights"] },
  { title: "CRM", description: "Full customer relationship management — tickets, communications, pipeline, and satisfaction.", icon: MessageSquare, category: "navigation", keywords: ["tickets", "pipeline", "communications", "support"] },
  { title: "Financials", description: "Revenue reports, expense tracking, profit margins, and financial analytics.", icon: CreditCard, category: "navigation", keywords: ["revenue", "expenses", "profit", "reports"] },
  { title: "Wallet & Payments", description: "Client and engineer wallets — deposits, payouts, and transaction history.", icon: Wallet, category: "navigation", keywords: ["balance", "payouts", "transactions", "money"] },
  { title: "Regions", description: "Manage service regions, coverage areas, and regional performance.", icon: Globe, category: "navigation", keywords: ["areas", "zones", "coverage", "territories"] },
  { title: "Analytics", description: "Advanced analytics — trends, leaderboards, SLA compliance, and regional performance.", icon: BarChart3, category: "navigation", keywords: ["reports", "charts", "trends", "data"] },
  { title: "Notifications", description: "View and manage all alerts — job updates, SLA breaches, and system notifications.", icon: Bell, category: "navigation", keywords: ["alerts", "updates", "messages"] },
  { title: "Settings", description: "Account settings, notification preferences, and system configuration.", icon: Settings, category: "navigation", keywords: ["preferences", "config", "account", "profile"] },
  { title: "Inventory & Assets", description: "Track hardware, spare parts, and equipment — stock levels, locations, and assignments.", icon: Briefcase, category: "navigation", keywords: ["stock", "parts", "equipment", "warehouse", "hardware"] },
  { title: "Site Surveys", description: "Pre-job site assessments with photo uploads, checklists, and recommendations.", icon: ClipboardCheck, category: "navigation", keywords: ["survey", "assessment", "photos", "checklist", "inspection"] },
  { title: "Global Operations", description: "Worldwide overview of engineers, jobs, and regional performance.", icon: Globe, category: "navigation", keywords: ["worldwide", "global", "map", "overview", "executive"] },
  { title: "Internal Chat", description: "Team messaging with channels, pinned messages, reactions, and file sharing.", icon: MessageSquare, category: "navigation", keywords: ["messaging", "channels", "team", "collaboration", "chat"] },
  { title: "Knowledge Base", description: "Technical documentation, troubleshooting guides, and best practices articles.", icon: Book, category: "navigation", keywords: ["docs", "articles", "guides", "troubleshooting", "wiki"] },

  // Features
  { title: "Region Filter", description: "Filter dashboard data by region using the dropdown in the top-right corner of the dashboard.", icon: Globe, category: "feature", keywords: ["filter", "region", "area"] },
  { title: "Export Data", description: "Export tables and reports as CSV or PDF from the Analytics page.", icon: FileText, category: "feature", keywords: ["export", "csv", "pdf", "download"] },
  { title: "Real-time Updates", description: "The activity feed and notifications update automatically every 15 seconds.", icon: Zap, category: "feature", keywords: ["live", "auto-refresh", "realtime"] },
  { title: "Lead Pipeline", description: "Track sales leads through stages: New → Contacted → Qualified → Proposal → Won/Lost.", icon: MessageSquare, category: "feature", keywords: ["sales", "funnel", "stages", "leads"] },
  { title: "Drag & Drop Scheduling", description: "Drag unassigned jobs onto the scheduling calendar to assign them to engineers.", icon: CalendarDays, category: "feature", keywords: ["drag", "drop", "assign", "calendar"] },
  { title: "AI-Powered Insights", description: "Use the Ask AI button on any page to get contextual analysis of your data.", icon: Bot, category: "feature", keywords: ["ai", "analysis", "insights", "smart"] },
  { title: "Bulk Actions", description: "Select multiple items in tables to update status, reassign, or delete in bulk.", icon: Briefcase, category: "feature", keywords: ["bulk", "multi-select", "batch", "mass"] },
  { title: "Animated Live Tracking", description: "Engineer markers glide smoothly on the map with directional arrows showing heading.", icon: Radar, category: "feature", keywords: ["animation", "uber", "smooth", "movement", "live"] },

  // Keyboard shortcuts
  { title: "Toggle Help Panel", description: "Press ? anywhere (outside input fields) to open or close this help panel.", icon: Keyboard, category: "shortcut", keywords: ["help", "panel", "question mark"] },
  { title: "Send Chat Message", description: "Press Enter to send a message in the AI Assistant or Internal Chat.", icon: Keyboard, category: "shortcut", keywords: ["enter", "send", "chat", "message"] },
  { title: "Search Navigation", description: "Click the search bar in the header to quickly find jobs, clients, or engineers.", icon: Keyboard, category: "shortcut", keywords: ["search", "find", "header"] },

  // Tips
  { title: "Quick Tip: Keyboard Search", description: "Click the search bar in the header to quickly find jobs, clients, or engineers.", icon: Search, category: "tip", keywords: ["search", "find", "lookup"] },
  { title: "Quick Tip: Notifications", description: "Click the bell icon to see recent alerts. Unread notifications show a red badge.", icon: Bell, category: "tip", keywords: ["bell", "alerts", "badge"] },
  { title: "Quick Tip: Mobile Menu", description: "On mobile devices, tap the hamburger menu icon to open the sidebar navigation.", icon: LayoutDashboard, category: "tip", keywords: ["mobile", "menu", "hamburger"] },
  { title: "Quick Tip: Dark Mode", description: "Toggle dark mode in Settings → Appearance for comfortable nighttime viewing.", icon: Settings, category: "tip", keywords: ["dark", "theme", "night", "mode"] },
  { title: "Quick Tip: Ask AI", description: "Look for the 'Ask AI' button on pages — it sends page context to the AI Assistant.", icon: Bot, category: "tip", keywords: ["ai", "button", "context", "assistant"] },
  { title: "Quick Tip: Reset Help", description: "Dismissed a help banner? Go to Settings → Help & Hints to bring them all back.", icon: Lightbulb, category: "tip", keywords: ["reset", "banner", "dismissed", "restore"] },
];

const categoryLabels = {
  navigation: "Pages & Navigation",
  feature: "Features",
  shortcut: "Shortcuts",
  tip: "Quick Tips",
};

const categoryIcons = {
  navigation: Book,
  feature: Zap,
  shortcut: Keyboard,
  tip: Lightbulb,
};

interface HelpPanelProps {
  open: boolean;
  onClose: () => void;
}

const HelpPanel = ({ open, onClose }: HelpPanelProps) => {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const filtered = useMemo(() => {
    let items = helpItems;
    if (activeCategory !== "all") {
      items = items.filter(i => i.category === activeCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(i =>
        i.title.toLowerCase().includes(q) ||
        i.description.toLowerCase().includes(q) ||
        i.keywords.some(k => k.includes(q))
      );
    }
    return items;
  }, [search, activeCategory]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-md bg-card border-l border-border shadow-2xl flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <HelpCircle className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-bold font-display text-card-foreground">Help & Documentation</h2>
              <p className="text-[10px] text-muted-foreground">Search tools, features & tips</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 pt-4 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search help topics..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              autoFocus
            />
          </div>
        </div>

        {/* Category filters */}
        <div className="px-5 pb-3 flex gap-1.5 overflow-x-auto">
          <button
            onClick={() => setActiveCategory("all")}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-200 whitespace-nowrap ${
              activeCategory === "all" ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted/50 text-muted-foreground hover:bg-muted"
            }`}
          >
            All ({helpItems.length})
          </button>
          {(Object.keys(categoryLabels) as Array<keyof typeof categoryLabels>).map(cat => {
            const count = helpItems.filter(i => i.category === cat).length;
            if (count === 0) return null;
            const CatIcon = categoryIcons[cat];
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-200 whitespace-nowrap ${
                  activeCategory === cat ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted/50 text-muted-foreground hover:bg-muted"
                }`}
              >
                <CatIcon className="w-3 h-3" />
                {categoryLabels[cat]} ({count})
              </button>
            );
          })}
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto px-5 pb-5 custom-scrollbar">
          {filtered.length === 0 ? (
            <div className="text-center py-12">
              <Search className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No results found</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Try different keywords</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((item, i) => {
                const Icon = item.icon;
                return (
                  <div
                    key={`${item.title}-${i}`}
                    className="group flex items-start gap-3 p-3 rounded-xl border border-border/50 bg-card hover:bg-muted/20 hover:border-border transition-all duration-200 animate-fade-in"
                    style={{ animationDelay: `${Math.min(i * 30, 200)}ms` }}
                  >
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-200">
                      <Icon className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-semibold text-card-foreground">{item.title}</p>
                        <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${
                          item.category === "navigation" ? "bg-primary/10 text-primary" :
                          item.category === "feature" ? "bg-accent/10 text-accent-foreground" :
                          item.category === "tip" ? "bg-warning/10 text-warning" :
                          "bg-muted text-muted-foreground"
                        }`}>
                          {item.category}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{item.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-muted/20">
          <p className="text-[10px] text-muted-foreground text-center">
            Press <kbd className="px-1.5 py-0.5 rounded bg-muted text-[9px] font-mono font-bold">?</kbd> anywhere to toggle help
          </p>
        </div>
      </div>
    </div>
  );
};

export default HelpPanel;