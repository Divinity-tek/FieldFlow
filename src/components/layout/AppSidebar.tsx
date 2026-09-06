import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Briefcase, Users, UserCheck, Building2, BarChart3,
  Settings, Bell, CreditCard, MessageSquare, MapPin, LogOut, PlusCircle,
  Radar, History, ClipboardList, TrendingUp, X, FileText, Receipt, Shield,
  Bot, DollarSign, Globe, CalendarDays, Wallet, Package, ClipboardCheck,
  Truck, BookOpen, Globe2, Headphones, RefreshCw, Cpu, Ticket, Activity,
  Car, Clock, ShoppingCart, FileCheck, BarChart, ChevronDown,
  Network, GitBranch, ShieldCheck, UserSearch, Building, Warehouse, GitCompare,
  Scale, Phone, Plug, Map, Cpu as CpuIcon, Video, Leaf, Star,
  Route, FileSignature, UsersRound, FolderKanban, Cable, Sparkles, Flame, LayoutTemplate, Inbox, Timer, Landmark
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useExplorationTracker } from "@/hooks/useExplorationTracker";
import ExplorationProgress from "./ExplorationProgress";
import { Badge } from "@/components/ui/badge";
import FieldFlowMark from "@/components/branding/FieldFlowMark";

interface NavItem {
  label: string;
  icon: any;
  path: string;
  hint: string;
  children?: { label: string; path: string; hint?: string; icon?: any }[];
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const adminSections: NavSection[] = [
  {
    title: "Overview",
    items: [
      { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard", hint: "Overview of operations, KPIs, and activity" },
      { label: "Analytics", icon: BarChart3, path: "/analytics", hint: "Advanced analytics and leaderboards" },
      // { label: "Reports", icon: BarChart, path: "/reports", hint: "Custom report builder with CSV export" },
    ],
  },
  {
    title: "Operations",
    items: [
      { label: "Dispatch Tickets", icon: Briefcase, path: "/jobs", hint: "Create, assign, and track service jobs" },
      // { label: "AI Auto-Dispatch", icon: Bot, path: "/auto-dispatch", hint: "One-click AI assignment with skill+geo+rating scoring" },
      // { label: "AI Dispatch Agent", icon: Bot, path: "/ai-dispatch-agent", hint: "End-to-end autonomous dispatch with admin controls, audit log, and chat" },
      { label: "Dispatch Map", icon: MapPin, path: "/dispatch", hint: "Map view of engineers and job sites" },
      // { label: "Dispatch Tickets", icon: Ticket, path: "/dispatch-tickets", hint: "Hands & feet support tickets with SOW" },
      { label: "Dispatch Inbox", icon: Inbox, path: "/dispatch-inbox", hint: "Reassignment requests from engineers in the field" },
      { label: "Job Marketplace", icon: Briefcase, path: "/marketplace-admin", hint: "Post jobs publicly and review engineer applications & counter-offers" },
      // { label: "Dispatch Model", icon: Globe2, path: "/dispatch-model", hint: "Our dispatch workflow vs Neeco & IRON" },
      // { label: "Rate Cards", icon: DollarSign, path: "/rate-cards", hint: "L1/L2/L3 engineer rate tiers with min 2hr charge" },
      // { label: "Scheduling", icon: CalendarDays, path: "/scheduling", hint: "Calendar scheduling and availability" },
      // { label: "Scheduler Board", icon: CalendarDays, path: "/scheduler-board", hint: "Drag-and-drop dispatch board for fast assignment" },
      { label: "Live Tracking", icon: Radar, path: "/live-tracking", hint: "Real-time GPS tracking of field staff" },
      // { label: "Recurring Jobs", icon: RefreshCw, path: "/recurring-jobs", hint: "Auto-generate jobs on a schedule" },
      // { label: "SLA Tracking", icon: Shield, path: "/sla", hint: "Monitor SLA compliance and breaches" },
      // { label: "SLA Escalation", icon: ShieldCheck, path: "/sla-escalation", hint: "Auto-escalation rules on SLA breach" },
      // { label: "SLA & Escalation Rules", icon: Shield, path: "/sla-rules", hint: "Tune thresholds, approval gates, and escalation ladder" },
    ],
  },
  {
    title: "Projects & Networks",
    items: [
      { label: "Projects & Rollouts", icon: FolderKanban, path: "/projects", hint: "Multi-site project tracking with milestones, devices, and budget" },
    ],
  },
  {
    title: "People",
    items: [
      { label: "Engineers", icon: UserCheck, path: "/engineers", hint: "Manage field engineers and availability" },
      { label: "Talent Pool", icon: UserSearch, path: "/talent-pool", hint: "AI-driven talent marketplace and matching" },
      // { label: "Clients", icon: Building2, path: "/crm", hint: "Client accounts and contact details" },
      { label: "Customer Portal", icon: Building2, path: "/customer-portal", hint: "Admin-managed customer entities, tax, invoices and orders" },
      {
        label: "Partners",
        icon: Users,
        path: "/partners",
        hint: "Partner entities — companies that own dispatches",
        children: [
          { label: "All Partners", path: "/partners", hint: "List, edit, enable/disable partners", icon: UsersRound },
          { label: "Partner Dashboard", path: "/partner", hint: "Partner-role overview", icon: LayoutDashboard },
          { label: "Partner Clients", path: "/partner/clients", hint: "Clients referred by partners", icon: Building2 },
          { label: "Partner Jobs", path: "/partner/jobs", hint: "Jobs from partner clients", icon: Briefcase },
          { label: "Partner Revenue", path: "/partner/revenue", hint: "Commission and revenue tracking", icon: DollarSign },
        ],
      },
      { label: "Vendors", icon: Building, path: "/vendors", hint: "Subcontractor and vendor network management" },
      { label: "Timesheets", icon: Clock, path: "/timesheets", hint: "Engineer hours, overtime & payroll" },
      { label: "Compliance", icon: ShieldCheck, path: "/compliance", hint: "Certifications, insurance & background checks" },
      { label: "Org Structure", icon: Network, path: "/org-structure", hint: "Role hierarchy and team overview" },
    ],
  },
  {
    title: "Finance",
    items: [
      { label: "Sales Quotes", icon: FileText, path: "/estimates", hint: "Create and send client estimates" },
      { label: "Sales Quote Templates", icon: LayoutTemplate, path: "/estimate-templates", hint: "Reusable estimate presets — taxes, dispatch, branding, line items" },
      { label: "Invoices", icon: Receipt, path: "/invoices", hint: "Generate invoices and track payments" },
      { label: "Receipts", icon: Receipt, path: "/receipts", hint: "Payment receipts and acknowledgements" },
      { label: "Financials", icon: CreditCard, path: "/financials", hint: "Revenue, expenses, and profit reports" },
      { label: "Wallet", icon: Wallet, path: "/wallet", hint: "Client/engineer wallets and payouts" },
      // { label: "Recurring Billing", icon: RefreshCw, path: "/recurring-billing", hint: "MRR/ARR dashboard & subscription management" },
      // { label: "Purchase Orders", icon: ShoppingCart, path: "/purchase-orders", hint: "Vendor procurement and PO tracking" },
    ],
  },
  {
    title: "Inventory",
    items: [
      // { label: "Inventory", icon: Package, path: "/inventory", hint: "Hardware assets, spare parts, and stock levels" },
      { label: "Site Surveys", icon: ClipboardCheck, path: "/site-surveys", hint: "Pre-job site assessments and checklists" },
    ],
  },
  // {
  //   title: "Intelligence",
  //   items: [
  //     { label: "Route Optimizer", icon: Route, path: "/route-optimizer", hint: "AI route optimization to reduce travel & fuel costs" },
  //     { label: "Remote Assist", icon: Video, path: "/remote-assist", hint: "Video calls with AR annotation for field support" },
  //     { label: "Knowledge Base", icon: BookOpen, path: "/knowledge-base", hint: "AI-searchable docs and troubleshooting guides" },
  //     { label: "CSAT Surveys", icon: Star, path: "/csat-surveys", hint: "Post-job NPS/CSAT surveys & report builder" },
  //     { label: "Forms & Checklists", icon: ClipboardList, path: "/custom-forms", hint: "Custom inspection forms and safety checklists" },
  //   ],
  // },
  // {
  //   title: "Communication",
  //   items: [
  //     { label: "Team Chat", icon: MessageSquare, path: "/internal-chat", hint: "Internal team messaging and job chat" },
  //     { label: "Support Chat", icon: Headphones, path: "/external-chat", hint: "Client support and live chat" },
  //     { label: "24/7 Helpdesk", icon: Phone, path: "/helpdesk", hint: "Multi-channel service desk with SLA tracking" },
  //     { label: "Global Ops", icon: Globe2, path: "/global-operations", hint: "Worldwide operations map" },
  //     { label: "Regions", icon: Globe, path: "/regions", hint: "Manage service regions and coverage" },
  //   ],
  // },
  {
    title: "System",
    items: [
      {
        label: "Admin Settings",
        icon: Shield,
        path: "/settings",
        hint: "Manage partners, invoicing, logos, tax details, and PNL",
        children: [
          { label: "Manage Partners", path: "/partners", hint: "Add, edit, enable/disable partner entities", icon: UsersRound },
          { label: "Invoicing", path: "/invoices", hint: "Generate, send, and track invoices", icon: Receipt },
          { label: "Logos & Branding", path: "/partners", hint: "Upload partner logos and branding assets", icon: Sparkles },
          { label: "Tax Details", path: "/partners", hint: "Manage partner tax/VAT numbers", icon: FileSignature },
          { label: "PNL Report", path: "/financials", hint: "Profit & loss, revenue and expenses", icon: TrendingUp },
        ],
      },
      { label: "Audit Logs", icon: History, path: "/audit-logs", hint: "Searchable timeline of every platform action" },
      { label: "Integrations & Health", icon: Activity, path: "/admin/integrations", hint: "Test Supabase, AI provider, storage, push and all connections" },
      { label: "Identity Verification", icon: Shield, path: "/admin/identity-verification", hint: "Review engineer identity selfies and ID cards — approve or reject submissions" },
      { label: "Engineer Approvals", icon: ShieldCheck, path: "/admin/engineer-approvals", hint: "Review new engineer applications — approve or reject signups" },
      { label: "Notifications", icon: Bell, path: "/notifications", hint: "View all alerts and system messages" },
      { label: "Settings", icon: Settings, path: "/settings", hint: "Account and system preferences" },
    ],
  },
];

const clientSections: NavSection[] = [
  {
    title: "Portal",
    items: [
      { label: "Dashboard", icon: LayoutDashboard, path: "/client", hint: "Your service overview" },
      { label: "New Request", icon: PlusCircle, path: "/client/new-request", hint: "Submit a new service request" },
      { label: "Track Jobs", icon: Radar, path: "/client/tracking", hint: "Track active service jobs" },
      { label: "Estimates", icon: FileText, path: "/client/estimates", hint: "View and approve estimates" },
      { label: "Invoices", icon: Receipt, path: "/client/invoices", hint: "View invoices and payment history" },
      { label: "Service History", icon: History, path: "/client/history", hint: "Past completed services" },
      { label: "Settings", icon: Settings, path: "/client/settings", hint: "Account preferences" },
    ],
  },
];

const partnerSections: NavSection[] = [
  {
    title: "Partner",
    items: [
      { label: "Dashboard", icon: LayoutDashboard, path: "/partner", hint: "Partner performance overview" },
      { label: "Clients", icon: Building2, path: "/partner/clients", hint: "Your referred clients" },
      { label: "Service Requests", icon: Briefcase, path: "/partner/jobs", hint: "Jobs from your clients" },
      { label: "Revenue", icon: CreditCard, path: "/partner/revenue", hint: "Commission and revenue tracking" },
    ],
  },
];

const engineerSections: NavSection[] = [
  {
    title: "Field",
    items: [
      { label: "Dashboard", icon: LayoutDashboard, path: "/engineer", hint: "Your job overview and stats" },
      { label: "My Jobs", icon: Briefcase, path: "/engineer/jobs", hint: "Active and past job assignments" },
      { label: "SmartMatch Alerts", icon: Sparkles, path: "/engineer/smart-match", hint: "Saved searches that auto-notify when matching jobs are posted" },
      { label: "Job Marketplace", icon: Briefcase, path: "/marketplace", hint: "Browse public jobs, apply or send counter-offers" },
      { label: "Profile", icon: UserCheck, path: "/engineer/profile", hint: "Skills, certifications, availability" },
      { label: "Dispatch Tickets", icon: Ticket, path: "/dispatch-tickets", hint: "View assigned dispatch tickets" },
      { label: "Team Chat", icon: MessageSquare, path: "/internal-chat", hint: "Communicate with your team" },
      { label: "Knowledge Base", icon: BookOpen, path: "/knowledge-base", hint: "Technical docs and guides" },
      { label: "Notifications", icon: Bell, path: "/notifications", hint: "Alerts and updates" },
      { label: "My Invoices", icon: Receipt, path: "/engineer/invoices", hint: "Submit payout requests for completed jobs" },
      { label: "Bank Details", icon: Landmark, path: "/engineer/bank-details", hint: "Add your payout bank account" },
    ],
  },
];

const teamLeadSections: NavSection[] = [
  {
    title: "Overview",
    items: [
      { label: "Dashboard", icon: LayoutDashboard, path: "/teamlead", hint: "Team performance overview" },
      { label: "Performance", icon: TrendingUp, path: "/teamlead/performance", hint: "Team KPIs and metrics" },
      { label: "Reports", icon: BarChart, path: "/reports", hint: "Custom reports & exports" },
    ],
  },
  {
    title: "Operations",
    items: [
      { label: "Engineers", icon: UserCheck, path: "/teamlead/engineers", hint: "Manage engineers and availability" },
      { label: "Job Management", icon: ClipboardList, path: "/teamlead/jobs", hint: "Assign, escalate, and oversee jobs" },
      { label: "Dispatch Tickets", icon: Ticket, path: "/dispatch-tickets", hint: "SOW tickets, charges, and dispatch" },
      { label: "Dispatch Inbox", icon: Inbox, path: "/dispatch-inbox", hint: "Reassignment requests from engineers" },
      { label: "Scheduling", icon: CalendarDays, path: "/scheduling", hint: "Calendar and engineer scheduling" },
      { label: "Dispatch Map", icon: MapPin, path: "/dispatch", hint: "Map view of engineers and jobs" },
      { label: "Live Tracking", icon: Radar, path: "/live-tracking", hint: "Real-time GPS tracking" },
      { label: "SLA Tracking", icon: Shield, path: "/sla", hint: "SLA compliance and escalations" },
      { label: "Recurring Jobs", icon: RefreshCw, path: "/recurring-jobs", hint: "Scheduled recurring jobs" },
    ],
  },
  {
    title: "Finance",
    items: [
      { label: "Estimates", icon: FileText, path: "/estimates", hint: "Create and validate estimates" },
      { label: "Invoices", icon: Receipt, path: "/invoices", hint: "Invoice management and collection" },
      { label: "Wallet", icon: Wallet, path: "/wallet", hint: "Payment collection and engineer payouts" },
      { label: "Timesheets", icon: Clock, path: "/timesheets", hint: "Engineer hours & payroll" },
      { label: "Purchase Orders", icon: ShoppingCart, path: "/purchase-orders", hint: "Vendor procurement" },
    ],
  },
  {
    title: "Assets & Field",
    items: [
      { label: "Inventory", icon: Package, path: "/inventory", hint: "Parts and equipment management" },
      { label: "Site Surveys", icon: ClipboardCheck, path: "/site-surveys", hint: "Pre-job assessments" },
      { label: "Forms", icon: ClipboardList, path: "/custom-forms", hint: "Inspection forms & checklists" },
    ],
  },
  {
    title: "Communication",
    items: [
      { label: "CRM", icon: Building2, path: "/crm", hint: "Clients, tickets, and follow-ups" },
      { label: "Team Chat", icon: MessageSquare, path: "/internal-chat", hint: "Internal team messaging" },
      { label: "Support Chat", icon: Headphones, path: "/external-chat", hint: "Client support chat" },
      { label: "Knowledge Base", icon: BookOpen, path: "/knowledge-base", hint: "Technical docs and guides" },
    ],
  },
  {
    title: "System",
    items: [
      { label: "Notifications", icon: Bell, path: "/notifications", hint: "Alerts and messages" },
      { label: "Settings", icon: Settings, path: "/settings", hint: "Account preferences" },
    ],
  },
];

const coordinatorSections: NavSection[] = [
  {
    title: "Overview",
    items: [
      { label: "Dashboard", icon: LayoutDashboard, path: "/coordinator", hint: "Cases, tickets & follow-ups overview" },
    ],
  },
  {
    title: "Case Management",
    items: [
      { label: "Dispatch Tickets", icon: Ticket, path: "/dispatch-tickets", hint: "Manage SOW tickets and dispatches" },
      { label: "Dispatch Inbox", icon: Inbox, path: "/dispatch-inbox", hint: "Reassignment requests from engineers" },
      { label: "Jobs", icon: Briefcase, path: "/jobs", hint: "View and update active jobs" },
      { label: "SLA Tracking", icon: Shield, path: "/sla", hint: "Monitor SLA compliance and breaches" },
    ],
  },
  {
    title: "People",
    items: [
      { label: "Clients", icon: Building2, path: "/crm", hint: "Customer accounts and communications" },
      { label: "Engineers", icon: UserCheck, path: "/engineers", hint: "View engineer profiles and availability" },
      { label: "Dispatch Map", icon: MapPin, path: "/dispatch", hint: "Map view of engineers and jobs" },
    ],
  },
  {
    title: "Finance (View)",
    items: [
      { label: "Estimates", icon: FileText, path: "/estimates", hint: "View client estimates" },
      { label: "Invoices", icon: Receipt, path: "/invoices", hint: "View invoice status" },
    ],
  },
  {
    title: "Communication",
    items: [
      { label: "Team Chat", icon: MessageSquare, path: "/internal-chat", hint: "Internal team messaging" },
      { label: "Knowledge Base", icon: BookOpen, path: "/knowledge-base", hint: "Docs and troubleshooting" },
      { label: "Notifications", icon: Bell, path: "/notifications", hint: "Alerts and updates" },
      { label: "Settings", icon: Settings, path: "/settings", hint: "Account preferences" },
    ],
  },
];

const serviceDeskSections: NavSection[] = [
  {
    title: "Service Desk",
    items: [
      { label: "My Queue", icon: Headphones, path: "/service-desk", hint: "My open tickets, unassigned queue, and intake" },
      { label: "Helpdesk", icon: Phone, path: "/helpdesk", hint: "All support tickets" },
      { label: "Routing Rules", icon: Route, path: "/service-desk/routing", hint: "Route inbound inquiries by category & location" },
      { label: "Teams Inquiries", icon: Inbox, path: "/service-desk/inquiries", hint: "Inbound chats auto-converted to tickets" },
      { label: "Ticket Workflow", icon: Timer, path: "/service-desk/tickets", hint: "Status flow, assignment & SLA timers" },
    ],
  },
  {
    title: "Lookup",
    items: [
      { label: "Clients", icon: Building2, path: "/crm", hint: "Find a client to answer questions" },
      { label: "Jobs", icon: Briefcase, path: "/jobs", hint: "Look up job status (read-only)" },
      { label: "Dispatch Tickets", icon: Ticket, path: "/dispatch-tickets", hint: "Read-only dispatch ticket view" },
      { label: "Invoices", icon: Receipt, path: "/invoices", hint: "Check invoice status for billing questions" },
    ],
  },
  {
    title: "Communication",
    items: [
      { label: "Client Chat", icon: MessageSquare, path: "/external-chat", hint: "Chat with clients" },
      { label: "Team Chat", icon: MessageSquare, path: "/internal-chat", hint: "Internal team messaging" },
      { label: "Knowledge Base", icon: BookOpen, path: "/knowledge-base", hint: "Docs and troubleshooting" },
      { label: "Notifications", icon: Bell, path: "/notifications", hint: "Alerts and updates" },
    ],
  },
];


const recruiterSections: NavSection[] = [
  {
    title: "Recruiter",
    items: [
      { label: "Dashboard", icon: LayoutDashboard, path: "/recruiter", hint: "Your assigned jobs and nomination stats" },
      { label: "Assigned Jobs", icon: Briefcase, path: "/recruiter/jobs", hint: "Jobs you've been assigned to recruit for" },
    ],
  },
];

interface AppSidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

const AppSidebar = ({ mobileOpen, onMobileClose }: AppSidebarProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const queryClient = useQueryClient();
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({});

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: userRole, isLoading: roleLoading } = useQuery({
    queryKey: ["user-role", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .limit(1);
      return data?.[0]?.role ?? null;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  // Resolve nav sections by role. Only fall back to admin when we actually know
  // the role is admin or null-but-loaded — never while loading, otherwise
  // engineers/clients see a flash of admin nav (or a blank panel).
  const sections = userRole === "client" ? clientSections
    : userRole === "partner" ? partnerSections
    : userRole === "team_lead" ? teamLeadSections
    : userRole === "engineer" ? engineerSections
    : userRole === "associate_coordinator" ? coordinatorSections
    : userRole === "service_desk" ? serviceDeskSections
    : userRole === "recruiter" ? recruiterSections
    : userRole === "admin" ? adminSections
    : []; // unknown / still loading — render skeleton below


  const allNavItems = useMemo(() => sections.flatMap(s => s.items), [sections]);

  // Unread message counts for chat nav items
  const { data: unreadCounts } = useQuery({
    queryKey: ["sidebar-unread-counts", user?.id],
    queryFn: async () => {
      const { data: memberships } = await supabase
        .from("chat_room_members")
        .select("room_id, last_read_at")
        .eq("user_id", user!.id);
      if (!memberships?.length) return { internal: 0, external: 0 };

      const roomIds = memberships.map(m => m.room_id);
      const { data: rooms } = await supabase
        .from("chat_rooms")
        .select("id, type")
        .in("id", roomIds);

      let internalCount = 0;
      let externalCount = 0;

      for (const membership of memberships) {
        const room = rooms?.find(r => r.id === membership.room_id);
        if (!room) continue;

        let q = supabase
          .from("chat_room_messages")
          .select("id", { count: "exact", head: true })
          .eq("room_id", membership.room_id)
          .neq("sender_id", user!.id);

        if (membership.last_read_at) {
          q = q.gt("created_at", membership.last_read_at);
        }

        const { count } = await q;
        const c = count ?? 0;

        if (room.type === "internal_team" || room.type === "job_specific") {
          internalCount += c;
        } else {
          externalCount += c;
        }
      }

      return { internal: internalCount, external: externalCount };
    },
    enabled: !!user?.id && (sections === adminSections || userRole === "team_lead"),
    refetchInterval: 15000,
  });

  useEffect(() => {
    if (!user) return;
    let debounceTimer: NodeJS.Timeout;
    const channel = supabase
      .channel("sidebar-unread")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "chat_room_messages",
      }, () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["sidebar-unread-counts"] });
        }, 500);
      })
      .subscribe();
    return () => {
      clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  const badgeMap: Record<string, number> = {
    "/internal-chat": unreadCounts?.internal ?? 0,
    "/external-chat": unreadCounts?.external ?? 0,
  };

  const allPagePaths = useMemo(() => allNavItems.map(i => i.path), [allNavItems]);
  const { explored, total, percentage, markVisited, unlockedBadges } = useExplorationTracker(allPagePaths);

  useEffect(() => {
    if (allNavItems.some(i => i.path === location.pathname)) {
      markVisited(location.pathname);
    }
  }, [location.pathname, allNavItems, markVisited]);

  // Engineers previously had the sidebar hidden (mobile-first layout). Show
  // engineer nav sections in the sidebar as well so the dashboard isn't empty.

  const initials = profile?.full_name
    ? profile.full_name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : "??";

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  const toggleSection = (title: string) => {
    setCollapsedSections(prev => ({ ...prev, [title]: !prev[title] }));
  };


  // Active match: exact for index/dashboard-like roots, prefix match otherwise so
  // nested routes (e.g. /engineer/jobs/abc) still highlight the parent nav item.
  const EXACT_ONLY = new Set(["/", "/engineer", "/teamlead", "/partner", "/client", "/coordinator", "/servicedesk"]);
  const matchesPath = (path: string) => {
    if (EXACT_ONLY.has(path)) return location.pathname === path;
    return location.pathname === path || location.pathname.startsWith(path + "/");
  };

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="p-5 border-b border-sidebar-border" data-tour="sidebar-logo">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-white/95 dark:bg-sidebar-accent/40 flex items-center justify-center shadow-glow overflow-hidden p-1">
              <FieldFlowMark
                variant="icon"
                width={40}
                height={40}
                alt="FieldFlow logo"
                className="w-full h-full object-contain"
              />
            </div>
            <span className="sr-only">FieldFlow — Dispatch Pro</span>
          </Link>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onMobileClose}
                className="lg:hidden text-sidebar-muted hover:text-sidebar-foreground transition-colors p-1.5 rounded-lg hover:bg-sidebar-accent"
              >
                <X className="w-5 h-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right"><p>Close menu</p></TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-2 px-3 overflow-y-auto custom-scrollbar">
        {/* Skeleton while role is loading so engineers/clients don't see an empty panel */}
        {sections.length === 0 && roleLoading && (
          <div className="space-y-1.5 px-2 py-2" aria-hidden>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-7 rounded-md bg-sidebar-accent/40 animate-pulse" />
            ))}
          </div>
        )}
        {/* Role resolved but unknown — explain rather than render blank */}
        {sections.length === 0 && !roleLoading && (
          <div className="px-3 py-4 text-[11px] text-sidebar-muted">
            No menu available for your account yet. Please contact an administrator to assign your role.
          </div>
        )}
        {/* Engineer quick actions — surfaced above the nav for one-tap access */}
        {userRole === "engineer" && (
          <div className="mb-2 px-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-muted/70 px-2 mb-1.5">
              Quick actions
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              <Link
                to="/client/new-request"
                onClick={onMobileClose}
                title="Start a new service request"
                className="flex flex-col items-center justify-center gap-1 rounded-lg border border-sidebar-border bg-sidebar-accent/40 hover:bg-sidebar-accent text-sidebar-foreground hover:text-sidebar-primary transition-colors py-2.5"
              >
                <PlusCircle className="w-4 h-4" />
                <span className="text-[9px] font-medium leading-tight text-center">New request</span>
              </Link>
              <Link
                to="/notifications"
                onClick={onMobileClose}
                title="View notifications"
                className="relative flex flex-col items-center justify-center gap-1 rounded-lg border border-sidebar-border bg-sidebar-accent/40 hover:bg-sidebar-accent text-sidebar-foreground hover:text-sidebar-primary transition-colors py-2.5"
              >
                <Bell className="w-4 h-4" />
                <span className="text-[9px] font-medium leading-tight text-center">Notifications</span>
                {badgeMap["/notifications"] > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">
                    {badgeMap["/notifications"] > 9 ? "9+" : badgeMap["/notifications"]}
                  </span>
                )}
              </Link>
              <Link
                to="/dispatch-tickets"
                onClick={onMobileClose}
                title="Open dispatch tickets"
                className="flex flex-col items-center justify-center gap-1 rounded-lg border border-sidebar-border bg-sidebar-accent/40 hover:bg-sidebar-accent text-sidebar-foreground hover:text-sidebar-primary transition-colors py-2.5"
              >
                <Ticket className="w-4 h-4" />
                <span className="text-[9px] font-medium leading-tight text-center">Tickets</span>
              </Link>
            </div>
          </div>
        )}
        {sections.map((section) => {
          const isCollapsed = collapsedSections[section.title];
          const hasActiveItem = section.items.some(item => matchesPath(item.path));

          return (
            <div key={section.title} className="mb-1">
              <button
                onClick={() => toggleSection(section.title)}
                className="w-full flex items-center justify-between px-3 py-1.5 mb-0.5 group"
              >
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-muted/70 group-hover:text-sidebar-muted transition-colors">
                  {section.title}
                </span>
                <ChevronDown className={`w-3 h-3 text-sidebar-muted/50 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`} />
              </button>

              {!isCollapsed && (
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const isActive = matchesPath(item.path);
                    const hasChildren = !!item.children?.length;
                    const isChildActive = hasChildren && item.children!.some(c => matchesPath(c.path));
                    const isOpen = openItems[item.path] ?? isChildActive;

                    if (hasChildren) {
                      return (
                        <div key={`${section.title}-${item.label}-${item.path}`}>
                          <button
                            type="button"
                            onClick={() => setOpenItems(prev => ({ ...prev, [item.path]: !isOpen }))}
                            className={`w-full group/item flex items-center gap-2.5 px-3 py-[7px] rounded-lg text-[13px] font-medium transition-all duration-150 ${
                              isChildActive
                                ? "bg-sidebar-accent text-sidebar-primary shadow-sm"
                                : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                            }`}
                          >
                            <item.icon className={`w-4 h-4 shrink-0 ${isChildActive ? 'text-sidebar-primary' : 'text-sidebar-muted'}`} />
                            <span className="flex-1 truncate text-left">{item.label}</span>
                            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? '' : '-rotate-90'} text-sidebar-muted`} />
                          </button>
                          {isOpen && (
                            <div className="ml-6 mt-0.5 space-y-0.5 border-l border-sidebar-border/60 pl-2">
                              {item.children!.map((child, childIdx) => {
                                const childActive = matchesPath(child.path);
                                return (
                                  <Link
                                    key={`${child.label}-${child.path}-${childIdx}`}
                                    to={child.path}
                                    onClick={onMobileClose}
                                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[12px] transition-colors ${
                                      childActive
                                        ? "bg-sidebar-accent text-sidebar-primary font-medium"
                                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                                    }`}
                                  >
                                    {child.icon && (
                                      <child.icon className={`w-3.5 h-3.5 shrink-0 ${childActive ? 'text-sidebar-primary' : 'text-sidebar-muted'}`} />
                                    )}
                                    <span className="flex-1 truncate">{child.label}</span>
                                    {childActive && <div className="w-1.5 h-1.5 rounded-full bg-sidebar-primary" />}
                                  </Link>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    }

                    return (
                      <Tooltip key={`${section.title}-${item.label}-${item.path}`} delayDuration={600}>
                        <TooltipTrigger asChild>
                          <Link
                            to={item.path}
                            onClick={onMobileClose}
                            data-tour={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                            className={`group/item flex items-center gap-2.5 px-3 py-[7px] rounded-lg text-[13px] font-medium transition-all duration-150 ${
                              isActive
                                ? "bg-sidebar-accent text-sidebar-primary shadow-sm"
                                : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                            }`}
                          >
                            <item.icon className={`w-4 h-4 shrink-0 transition-colors duration-150 ${isActive ? 'text-sidebar-primary' : 'text-sidebar-muted'}`} />
                            <span className="flex-1 truncate">{item.label}</span>
                            {badgeMap[item.path] > 0 && (
                              <Badge variant="destructive" className="ml-auto h-[18px] min-w-[18px] px-1 text-[9px] font-bold rounded-full">
                                {badgeMap[item.path] > 99 ? "99+" : badgeMap[item.path]}
                              </Badge>
                            )}
                            {isActive && !badgeMap[item.path] && (
                              <div className="ml-auto w-1.5 h-1.5 rounded-full bg-sidebar-primary" />
                            )}
                          </Link>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-[200px]">
                          <p className="text-xs font-medium">{item.label}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{item.hint}</p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Exploration Progress */}
      <div className="px-3 pt-2">
        <ExplorationProgress explored={explored} total={total} percentage={percentage} unlockedBadges={unlockedBadges} />
      </div>

      {/* Profile */}
      <div className="p-3 border-t border-sidebar-border">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-sidebar-accent/40 transition-colors">
          <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center ring-2 ring-sidebar-accent">
            <span className="text-[10px] font-bold text-primary-foreground">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-sidebar-accent-foreground truncate">{profile?.full_name || "Loading…"}</p>
            <p className="text-[10px] text-sidebar-muted truncate">{profile?.email || ""}</p>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleLogout}
                className="p-1.5 rounded-lg text-sidebar-muted hover:text-destructive hover:bg-sidebar-accent/60 transition-all"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right"><p>Sign out</p></TooltipContent>
          </Tooltip>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" onClick={onMobileClose}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <aside
            onClick={(e) => e.stopPropagation()}
            className="absolute inset-y-0 left-0 w-[272px] gradient-sidebar flex flex-col border-r border-sidebar-border shadow-elevated animate-slide-in-left"
          >
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 lg:w-[264px] gradient-sidebar border-r border-sidebar-border z-30">
        {sidebarContent}
      </aside>
    </>
  );
};

export default AppSidebar;
