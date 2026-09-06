import { ReactNode, useState, useEffect } from "react";
import AppSidebar from "./AppSidebar";
import AppHeader from "./AppHeader";
import HelpPanel from "@/components/help/HelpPanel";
import ContextualHelpBanner from "@/components/help/ContextualHelpBanner";
import { OnboardingProvider, type AppRole } from "@/components/onboarding/OnboardingContext";
import OnboardingOverlay from "@/components/onboarding/OnboardingOverlay";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AppLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
}

const PAGE_HINTS: Record<string, { description: string; tips: string[] }> = {
  Dashboard: {
    description: "Your command centre — monitor KPIs, active jobs, and engineer activity at a glance.",
    tips: ["Click any chart to drill into details", "Use the region filter to focus on a specific area", "Press ? anytime for keyboard shortcuts"],
  },
  Jobs: {
    description: "Create, assign, and track service jobs through their full lifecycle.",
    tips: ["Use bulk actions to update multiple jobs at once", "Filter by status, priority, or region", "Click a job row for full details and history"],
  },
  Engineers: {
    description: "View your field engineers, their skills, ratings, and availability.",
    tips: ["Filter by specialty or skill to find the right engineer", "Click an engineer card to view their profile", "Star ratings update automatically from client reviews"],
  },
  "Dispatch Map": {
    description: "See real-time locations of engineers and jobs on an interactive map.",
    tips: ["Click a marker to view details and assign", "Unassigned jobs appear as orange markers", "The AI panel suggests optimal assignments"],
  },
  CRM: {
    description: "Manage client relationships — tickets, communications, pipeline, and satisfaction.",
    tips: ["Use tabs to switch between Tickets, Communications, Pipeline, and Satisfaction", "Move leads through pipeline stages to track deal progress", "Overdue reminders are highlighted in red"],
  },
  "Engineer Scheduling": {
    description: "Drag-and-drop weekly calendar for assigning jobs and managing availability.",
    tips: ["Drag unassigned jobs onto an engineer's row to assign", "Double-click a cell to toggle availability", "Hover over a job chip for full details"],
  },
  "Advanced Analytics": {
    description: "Deep-dive into performance metrics, trends, and operational benchmarks.",
    tips: ["Switch between tabs for different analytics views", "Charts are interactive — hover for detailed breakdowns", "Export data using the download button"],
  },
  Invoices: {
    description: "Generate, send, and track payment invoices linked to jobs and estimates.",
    tips: ["Create invoices from approved estimates with one click", "Filter by status to find overdue payments", "Click an invoice to view line items and payment history"],
  },
  Estimates: {
    description: "Build detailed service quotes with line items and send them to clients.",
    tips: ["Add multiple line items with quantities and unit prices", "Convert approved estimates directly into invoices", "Set validity dates to auto-expire old quotes"],
  },
  Financials: {
    description: "Track revenue, margins, engineer charges, and payment trends.",
    tips: ["Use tabs to switch between overview, revenue, and payouts", "Charts show trends over time — hover for exact values", "Compare margins across service types"],
  },
  Settings: {
    description: "Configure your account, notification preferences, and appearance.",
    tips: ["Toggle dark mode in the Appearance section", "Set quiet hours to pause notifications", "Use email digest settings for daily summaries"],
  },
  Regions: {
    description: "Define service regions and assign engineer teams to each area.",
    tips: ["Click 'Assign Engineers' to build regional teams", "Toggle regions active/inactive without deleting them", "Use the search bar to find specific regions"],
  },
  "SLA Tracking": {
    description: "Monitor service level compliance, breach alerts, and escalation workflows.",
    tips: ["The dashboard tab shows real-time compliance gauges", "Escalate breaches directly from the Alerts tab", "Create policies per client and priority level"],
  },
  "Live Tracking": {
    description: "Watch engineer movements and active job routes in real time.",
    tips: ["Green markers show available engineers", "Click a route to see estimated arrival time", "The map auto-refreshes every 30 seconds"],
  },
  "Wallet & Payments": {
    description: "Manage client balances, process engineer payouts, and review transactions.",
    tips: ["Top up client wallets with deposits", "Process engineer payouts in bulk", "Filter transactions by type or date range"],
  },
  "AI Assistant": {
    description: "Chat with AI for platform insights, data analysis, and operational guidance.",
    tips: ["Try the quick prompts to get started", "Your conversations are saved and searchable", "Share conversations with team members using the share button"],
  },
  Notifications: {
    description: "Review alerts, configure preferences, and manage your notification history.",
    tips: ["Mark notifications as read individually or in bulk", "Configure which events trigger notifications", "Set quiet hours to pause non-critical alerts"],
  },
  // Inventory & Assets
  "Inventory & Assets": {
    description: "Track hardware, spare parts, and equipment across warehouses and engineers.",
    tips: ["Set minimum stock levels to get low-stock alerts", "Filter by category or status to find items quickly", "Assign items to engineers or specific jobs"],
  },
  // Site Surveys
  "Site Surveys & Assessments": {
    description: "Conduct pre-job site assessments with photos, checklists, and findings.",
    tips: ["Upload photos directly from the field", "Use the checklist to ensure nothing is missed", "Add recommendations for follow-up work"],
  },
  // Global Operations
  "Global Operations": {
    description: "Bird's-eye view of worldwide operations — engineers, jobs, and regions.",
    tips: ["The map shows all active engineers and job locations", "Regional cards break down performance by area", "Use this page for executive reporting and capacity planning"],
  },
  // Internal Chat
  "Internal Chat": {
    description: "Team messaging with channels, direct messages, and job-specific collaboration.",
    tips: ["Create dedicated channels for projects or teams", "Pin important messages so they stay visible", "Use @mentions to notify specific team members"],
  },
  // Knowledge Base
  "Knowledge Base": {
    description: "Technical documentation, guides, and troubleshooting articles for your team.",
    tips: ["Search articles by keyword or filter by category", "Mark articles as helpful to boost their visibility", "Publish new articles to share knowledge across the team"],
  },
  // Client portal pages
  "Client Dashboard": {
    description: "Overview of your active service requests, upcoming jobs, and support access.",
    tips: ["Click a job card to see real-time status", "Use the support chat widget for quick help", "Create new service requests from the dashboard"],
  },
  "Job Tracking": {
    description: "Monitor your service requests in real-time with status updates and engineer details.",
    tips: ["Track engineer location when the job is in progress", "View full job history including notes and photos", "Rate your engineer after the job is completed"],
  },
  "Service History": {
    description: "Browse past completed and cancelled jobs with full details.",
    tips: ["Filter by date range to find specific jobs", "Download job reports for your records", "Review engineer ratings you've given"],
  },
  "New Service Request": {
    description: "Submit a new service request — describe the issue, location, and preferred timing.",
    tips: ["Be specific about the problem to get faster service", "Add photos if they help explain the issue", "Set priority to urgent for critical problems"],
  },
  // Engineer portal pages
  "My Jobs": {
    description: "View your assigned jobs, accept new assignments, and update job status.",
    tips: ["Swipe or tap to accept/decline new jobs", "Update status as you progress through each job", "Add notes and photos to document your work"],
  },
  Profile: {
    description: "Manage your skills, availability, vehicle, and insurance information.",
    tips: ["Keep your skills up to date for better job matching", "Upload insurance documents before they expire", "Set your hourly rate to reflect your experience"],
  },
  // Partner portal pages
  "Partner Dashboard": {
    description: "Overview of your referred clients, active jobs, and commission earnings.",
    tips: ["Track revenue from each referred client", "Monitor job completion rates for your clients", "View commission breakdowns in the Revenue tab"],
  },
  "Client Management": {
    description: "Add and manage clients you've referred to the platform.",
    tips: ["Add new clients with their contact details", "Monitor service quality for your client base", "Track lifetime value of each referral"],
  },
  "Revenue Tracking": {
    description: "Monitor your commission earnings, payouts, and revenue trends.",
    tips: ["View earnings broken down by client", "Track monthly and quarterly trends", "Commission rates are shown per client"],
  },
  // Team Lead portal pages
  "Team Lead Dashboard": {
    description: "Manage your engineering team — jobs, performance, and daily operations.",
    tips: ["Quick-access cards link to Engineers, Jobs, and Performance", "Monitor your team's active job count", "Review performance metrics regularly"],
  },
  "Engineer Management": {
    description: "View and manage engineers in your team — skills, availability, and verification.",
    tips: ["Verify insurance and vehicle documents for compliance", "Filter engineers by specialty to find coverage gaps", "Check availability before assigning new jobs"],
  },
  "Job Management": {
    description: "Assign, reassign, and manage all jobs for your team.",
    tips: ["Reassign jobs between engineers if priorities change", "Update job status directly from the table", "Use search to find specific jobs quickly"],
  },
  "Performance Tracking": {
    description: "Track engineer metrics — completion rates, ratings, and response times.",
    tips: ["Compare performance across your team members", "Identify top performers and those needing support", "Use data to optimize job assignments"],
  },
};

const AppLayout = ({ children, title, subtitle }: AppLayoutProps) => {
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const { data: userRole } = useQuery({
    queryKey: ["user-role-layout", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .limit(1);
      return (data?.[0]?.role ?? null) as AppRole;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "?" || (e.key === "/" && e.shiftKey)) {
        e.preventDefault();
        setHelpOpen(prev => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const hint = PAGE_HINTS[title];

  return (
    <OnboardingProvider role={userRole ?? null}>
      <TooltipProvider delayDuration={300}>
        <div className="min-h-screen bg-background">
          <AppSidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
          <div className="lg:ml-[264px] transition-all duration-300">
            <AppHeader
              title={title}
              subtitle={subtitle}
              onMenuToggle={() => setMobileOpen(true)}
              onHelpToggle={() => setHelpOpen(prev => !prev)}
            />
            <main className="p-4 sm:p-6 lg:p-8 animate-fade-in">
              {hint && (
                <ContextualHelpBanner
                  pageKey={title.toLowerCase().replace(/\s+/g, "-")}
                  title={`Welcome to ${title}`}
                  description={hint.description}
                  tips={hint.tips}
                />
              )}
              {children}
            </main>
          </div>
          <HelpPanel open={helpOpen} onClose={() => setHelpOpen(false)} />
          <OnboardingOverlay />
        </div>
      </TooltipProvider>
    </OnboardingProvider>
  );
};

export default AppLayout;
