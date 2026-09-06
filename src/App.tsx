import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
// import FloatingAIChat from "@/components/ai/FloatingAIChat";
import { Toaster } from "@/components/ui/toaster";
import PWAInstallPrompt from "@/components/pwa/PWAInstallPrompt";
import EnableNotificationsBanner from "@/components/notifications/EnableNotificationsBanner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import RouteFallback from "@/components/RouteFallback";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import RoleGuard from "./components/auth/RoleGuard";
import { AuthProvider } from "@/hooks/useAuth";

// const FloatingAIChatGated = () => {
//   const { pathname } = useLocation();
//   if (pathname === "/" || pathname === "") return null;
//   return <FloatingAIChat />;
// };


// Eager: above-the-fold / auth (avoid loader flash for first paint & login)
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import AccessPending from "./pages/AccessPending";

// Lazy: everything else
const Index = lazy(() => import("./pages/Index"));
const Jobs = lazy(() => import("./pages/Jobs"));
const JobDetail = lazy(() => import("./pages/JobDetail"));
const Engineers = lazy(() => import("./pages/Engineers"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Dispatch = lazy(() => import("./pages/Dispatch"));
const ClientDashboard = lazy(() => import("./pages/client/ClientDashboard"));
const CreateServiceRequest = lazy(() => import("./pages/client/CreateServiceRequest"));
const ClientJobTracking = lazy(() => import("./pages/client/ClientJobTracking"));
const ClientServiceHistory = lazy(() => import("./pages/client/ClientServiceHistory"));
const ClientSettings = lazy(() => import("./pages/client/ClientSettings"));
const ClientEstimates = lazy(() => import("./pages/client/ClientEstimates"));
const ClientInvoices = lazy(() => import("./pages/client/ClientInvoices"));
const PartnerDashboard = lazy(() => import("./pages/partner/PartnerDashboard"));
const PartnerClients = lazy(() => import("./pages/partner/PartnerClients"));
const PartnerJobs = lazy(() => import("./pages/partner/PartnerJobs"));
const PartnerRevenue = lazy(() => import("./pages/partner/PartnerRevenue"));
const Partners = lazy(() => import("./pages/Partners"));
const CRM = lazy(() => import("./pages/CRM"));
const Analytics = lazy(() => import("./pages/Analytics"));
const TeamLeadDashboard = lazy(() => import("./pages/teamlead/TeamLeadDashboard"));
const TeamLeadEngineers = lazy(() => import("./pages/teamlead/TeamLeadEngineers"));
const TeamLeadJobs = lazy(() => import("./pages/teamlead/TeamLeadJobs"));
const TeamLeadPerformance = lazy(() => import("./pages/teamlead/TeamLeadPerformance"));
const Financials = lazy(() => import("./pages/Financials"));
const EngineerDashboard = lazy(() => import("./pages/engineer/EngineerDashboard"));
const EngineerJobs = lazy(() => import("./pages/engineer/EngineerJobs"));
const EngineerProfile = lazy(() => import("./pages/engineer/EngineerProfile"));
const EngineerOnboarding = lazy(() => import("./pages/engineer/EngineerOnboarding"));
const EngineerEarnings = lazy(() => import("./pages/engineer/EngineerEarnings"));
const EngineerAssistant = lazy(() => import("./pages/engineer/EngineerAssistant"));
const Settings = lazy(() => import("./pages/Settings"));
const DeviceSettings = lazy(() => import("./pages/DeviceSettings"));
const Estimates = lazy(() => import("./pages/Estimates"));
const Invoices = lazy(() => import("./pages/Invoices"));
const InvoicePreview = lazy(() => import("./pages/InvoicePreview"));
const Receipts = lazy(() => import("./pages/Receipts"));
const SLATracking = lazy(() => import("./pages/SLATracking"));

const SharedConversation = lazy(() => import("./pages/SharedConversation"));
const Regions = lazy(() => import("./pages/Regions"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Scheduling = lazy(() => import("./pages/Scheduling"));
const LiveTracking = lazy(() => import("./pages/LiveTracking"));
const WalletPayments = lazy(() => import("./pages/WalletPayments"));
const Inventory = lazy(() => import("./pages/Inventory"));
const SiteSurveys = lazy(() => import("./pages/SiteSurveys"));
const KnowledgeBase = lazy(() => import("./pages/KnowledgeBase"));
const GlobalOperations = lazy(() => import("./pages/GlobalOperations"));
const InternalChat = lazy(() => import("./pages/InternalChat"));
const ExternalChat = lazy(() => import("./pages/ExternalChat"));
const RecurringJobs = lazy(() => import("./pages/RecurringJobs"));
const DispatchTickets = lazy(() => import("./pages/DispatchTickets"));
const DispatchInbox = lazy(() => import("./pages/DispatchInbox"));
const Timesheets = lazy(() => import("./pages/Timesheets"));
const CustomForms = lazy(() => import("./pages/CustomForms"));
const PurchaseOrders = lazy(() => import("./pages/PurchaseOrders"));
const PurchaseOrderPortal = lazy(() => import("./pages/PurchaseOrderPortal"));
const ReportsBuilder = lazy(() => import("./pages/ReportsBuilder"));
const CoordinatorDashboard = lazy(() => import("./pages/coordinator/CoordinatorDashboard"));
const OrgStructure = lazy(() => import("./pages/OrgStructure"));
const DispatchModel = lazy(() => import("./pages/DispatchModel"));
const RateCards = lazy(() => import("./pages/RateCards"));
const ComplianceTracker = lazy(() => import("./pages/ComplianceTracker"));
const TalentPool = lazy(() => import("./pages/TalentPool"));
const VendorManagement = lazy(() => import("./pages/VendorManagement"));
const Helpdesk = lazy(() => import("./pages/Helpdesk"));
const ServiceDeskDashboard = lazy(() => import("./pages/servicedesk/ServiceDeskDashboard"));
const RoutingRules = lazy(() => import("./pages/servicedesk/RoutingRules"));
const TeamsInquiries = lazy(() => import("./pages/servicedesk/TeamsInquiries"));
const TicketsWorkflow = lazy(() => import("./pages/servicedesk/TicketsWorkflow"));
const RemoteAssist = lazy(() => import("./pages/RemoteAssist"));
const CSATSurveys = lazy(() => import("./pages/CSATSurveys"));
const EstimateTemplates = lazy(() => import("./pages/EstimateTemplates"));
const RouteOptimizer = lazy(() => import("./pages/RouteOptimizer"));
const AutoDispatch = lazy(() => import("./pages/AutoDispatch"));
const AIDispatchAgent = lazy(() => import("./pages/AIDispatchAgent"));
const SLARules = lazy(() => import("./pages/SLARules"));
const SLAEscalation = lazy(() => import("./pages/SLAEscalation"));
const SelfBooking = lazy(() => import("./pages/SelfBooking"));
const SchedulerBoard = lazy(() => import("./pages/SchedulerBoard"));
const RecurringBilling = lazy(() => import("./pages/RecurringBilling"));
const AuditLogs = lazy(() => import("./pages/AuditLogs"));
const ChatSyncAudit = lazy(() => import("./pages/admin/ChatSyncAudit"));
const IntegrationsHealth = lazy(() => import("./pages/IntegrationsHealth"));
const IdentityVerification = lazy(() => import("./pages/admin/IdentityVerification"));
const EngineerApprovals = lazy(() => import("./pages/admin/EngineerApprovals"));
const ProofPointsAdmin = lazy(() => import("./pages/admin/ProofPointsAdmin"));
const DispatchLeadsAdmin = lazy(() => import("./pages/admin/DispatchLeadsAdmin"));
const Projects = lazy(() => import("./pages/Projects"));
const ProjectDetails = lazy(() => import("./pages/ProjectDetails"));
const SmartMatchAlerts = lazy(() => import("./pages/engineer/SmartMatchAlerts"));
const JobMarketplace = lazy(() => import("./pages/JobMarketplace"));
const MarketplaceAdmin = lazy(() => import("./pages/MarketplaceAdmin"));
const CustomerPortal = lazy(() => import("./pages/CustomerPortal"));
const Help = lazy(() => import("./pages/Help"));
const PublicEngineerProfile = lazy(() => import("./pages/PublicEngineerProfile"));

const RecruiterDashboard = lazy(() => import("./pages/recruiter/RecruiterDashboard"));
const RecruiterJobs = lazy(() => import("./pages/recruiter/RecruiterJobs"));
const NominateCandidate = lazy(() => import("./pages/recruiter/NominateCandidate"));

const EngineerInvoices = lazy(() => import("./pages/engineer/EngineerInvoices"));
const EngineerBankDetails = lazy(() => import("./pages/engineer/EngineerBankDetails"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
      <CurrencyProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <PWAInstallPrompt />
          <EnableNotificationsBanner />
          <BrowserRouter>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                {/* Public routes */}
                <Route path="/" element={<Landing />} />
                <Route path="/landing" element={<Landing />} />
                <Route path="/login" element={<Login />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/access-pending" element={<AccessPending />} />
                <Route path="/shared/:token" element={<SharedConversation />} />
                <Route path="/book" element={<SelfBooking />} />
                <Route path="/po/portal/:token" element={<PurchaseOrderPortal />} />
                <Route path="/engineers/:id" element={<PublicEngineerProfile />} />
                

                {/* Admin-only routes */}
                <Route path="/dashboard" element={<RoleGuard allowedRoles={["admin"]}><Index /></RoleGuard>} />
                <Route path="/financials" element={<RoleGuard allowedRoles={["admin"]}><Financials /></RoleGuard>} />
                <Route path="/regions" element={<RoleGuard allowedRoles={["admin"]}><Regions /></RoleGuard>} />
                <Route path="/global-operations" element={<RoleGuard allowedRoles={["admin"]}><GlobalOperations /></RoleGuard>} />
                <Route path="/analytics" element={<RoleGuard allowedRoles={["admin"]}><Analytics /></RoleGuard>} />
                <Route path="/org-structure" element={<RoleGuard allowedRoles={["admin"]}><OrgStructure /></RoleGuard>} />
                {/* <Route path="/dispatch-model" element={<RoleGuard allowedRoles={["admin"]}><DispatchModel /></RoleGuard>} /> */}
                {/* <Route path="/rate-cards" element={<RoleGuard allowedRoles={["admin"]}><RateCards /></RoleGuard>} /> */}
                <Route path="/compliance" element={<RoleGuard allowedRoles={["admin", "team_lead"]}><ComplianceTracker /></RoleGuard>} />
                <Route path="/talent-pool" element={<RoleGuard allowedRoles={["admin", "team_lead"]}><TalentPool /></RoleGuard>} />
                <Route path="/vendors" element={<RoleGuard allowedRoles={["admin", "team_lead"]}><VendorManagement /></RoleGuard>} />
                <Route path="/helpdesk" element={<RoleGuard allowedRoles={["admin", "team_lead", "associate_coordinator", "service_desk"]}><Helpdesk /></RoleGuard>} />
                <Route path="/service-desk" element={<RoleGuard allowedRoles={["admin", "team_lead", "service_desk"]}><ServiceDeskDashboard /></RoleGuard>} />
                <Route path="/service-desk/routing" element={<RoleGuard allowedRoles={["admin", "team_lead", "service_desk"]}><RoutingRules /></RoleGuard>} />
                <Route path="/service-desk/inquiries" element={<RoleGuard allowedRoles={["admin", "team_lead", "service_desk", "associate_coordinator"]}><TeamsInquiries /></RoleGuard>} />
                <Route path="/service-desk/tickets" element={<RoleGuard allowedRoles={["admin", "team_lead", "service_desk", "associate_coordinator"]}><TicketsWorkflow /></RoleGuard>} />
                {/* <Route path="/remote-assist" element={<RoleGuard allowedRoles={["admin", "team_lead", "engineer"]}><RemoteAssist /></RoleGuard>} /> */}
                {/* <Route path="/csat-surveys" element={<RoleGuard allowedRoles={["admin", "team_lead"]}><CSATSurveys /></RoleGuard>} /> */}
                {/* <Route path="/route-optimizer" element={<RoleGuard allowedRoles={["admin", "team_lead"]}><RouteOptimizer /></RoleGuard>} /> */}
                {/* <Route path="/auto-dispatch" element={<RoleGuard allowedRoles={["admin", "team_lead", "associate_coordinator"]}><AutoDispatch /></RoleGuard>} /> */}
                {/* <Route path="/ai-dispatch-agent" element={<RoleGuard allowedRoles={["admin", "team_lead"]}><AIDispatchAgent /></RoleGuard>} /> */}
                {/* <Route path="/sla-rules" element={<RoleGuard allowedRoles={["admin", "team_lead"]}><SLARules /></RoleGuard>} /> */}
                {/* <Route path="/sla-escalation" element={<RoleGuard allowedRoles={["admin", "team_lead"]}><SLAEscalation /></RoleGuard>} /> */}
                {/* <Route path="/scheduler-board" element={<RoleGuard allowedRoles={["admin", "team_lead", "associate_coordinator"]}><SchedulerBoard /></RoleGuard>} /> */}
                <Route path="/recurring-billing" element={<RoleGuard allowedRoles={["admin", "team_lead"]}><RecurringBilling /></RoleGuard>} />
                <Route path="/audit-logs" element={<RoleGuard allowedRoles={["admin"]}><AuditLogs /></RoleGuard>} />
                <Route path="/admin/chat-sync-audit" element={<RoleGuard allowedRoles={["admin"]}><ChatSyncAudit /></RoleGuard>} />
                <Route path="/admin/integrations" element={<RoleGuard allowedRoles={["admin"]}><IntegrationsHealth /></RoleGuard>} />
                <Route path="/admin/identity-verification" element={<RoleGuard allowedRoles={["admin"]}><IdentityVerification /></RoleGuard>} />
                <Route path="/admin/engineer-approvals" element={<RoleGuard allowedRoles={["admin"]}><EngineerApprovals /></RoleGuard>} />
                <Route path="/admin/proof-points" element={<RoleGuard allowedRoles={["admin"]}><ProofPointsAdmin /></RoleGuard>} />
                <Route path="/admin/dispatch-leads" element={<RoleGuard allowedRoles={["admin","team_lead","service_desk"]}><DispatchLeadsAdmin /></RoleGuard>} />
                <Route path="/projects" element={<RoleGuard allowedRoles={["admin", "team_lead", "associate_coordinator"]}><Projects /></RoleGuard>} />
                <Route path="/projects/:projectId" element={<RoleGuard allowedRoles={["admin", "team_lead", "associate_coordinator"]}><ProjectDetails /></RoleGuard>} />

                {/* Admin + Team Lead routes */}
                <Route path="/jobs" element={<RoleGuard allowedRoles={["admin", "team_lead", "associate_coordinator", "service_desk"]}><Jobs /></RoleGuard>} />
                <Route path="/jobs/:id" element={<RoleGuard allowedRoles={["admin", "team_lead", "associate_coordinator", "partner"]}><JobDetail /></RoleGuard>} />
                <Route path="/engineers" element={<RoleGuard allowedRoles={["admin", "team_lead", "associate_coordinator"]}><Engineers /></RoleGuard>} />
                <Route path="/dispatch" element={<RoleGuard allowedRoles={["admin", "team_lead", "associate_coordinator"]}><Dispatch /></RoleGuard>} />
                {/* <Route path="/crm" element={<RoleGuard allowedRoles={["admin", "team_lead", "associate_coordinator", "service_desk"]}><CRM /></RoleGuard>} /> */}
                <Route path="/customer-portal" element={<RoleGuard allowedRoles={["admin"]}><CustomerPortal /></RoleGuard>} />
                <Route path="/estimates" element={<RoleGuard allowedRoles={["admin", "team_lead", "associate_coordinator"]}><Estimates /></RoleGuard>} />
                <Route path="/estimate-templates" element={<RoleGuard allowedRoles={["admin", "team_lead", "associate_coordinator"]}><EstimateTemplates /></RoleGuard>} />
                <Route path="/invoices" element={<RoleGuard allowedRoles={["admin", "service_desk"]}><Invoices /></RoleGuard>} />
                <Route path="/invoices/preview" element={<RoleGuard allowedRoles={["admin"]}><InvoicePreview /></RoleGuard>} />
                <Route path="/invoices/preview/:idOrNumber" element={<RoleGuard allowedRoles={["admin"]}><InvoicePreview /></RoleGuard>} />
                <Route path="/receipts" element={<RoleGuard allowedRoles={["admin"]}><Receipts /></RoleGuard>} />
                {/* <Route path="/sla" element={<RoleGuard allowedRoles={["admin", "team_lead", "associate_coordinator"]}><SLATracking /></RoleGuard>} /> */}
                {/* <Route path="/scheduling" element={<RoleGuard allowedRoles={["admin", "team_lead"]}><Scheduling /></RoleGuard>} /> */}
                <Route path="/live-tracking" element={<RoleGuard allowedRoles={["admin", "team_lead"]}><LiveTracking /></RoleGuard>} />
                <Route path="/wallet" element={<RoleGuard allowedRoles={["admin", "team_lead"]}><WalletPayments /></RoleGuard>} />
                {/* <Route path="/inventory" element={<RoleGuard allowedRoles={["admin", "team_lead"]}><Inventory /></RoleGuard>} /> */}
                <Route path="/site-surveys" element={<RoleGuard allowedRoles={["admin", "team_lead"]}><SiteSurveys /></RoleGuard>} />
                {/* <Route path="/recurring-jobs" element={<RoleGuard allowedRoles={["admin", "team_lead"]}><RecurringJobs /></RoleGuard>} /> */}
                <Route path="/timesheets" element={<RoleGuard allowedRoles={["admin", "team_lead"]}><Timesheets /></RoleGuard>} />
                <Route path="/purchase-orders" element={<RoleGuard allowedRoles={["admin", "team_lead"]}><PurchaseOrders /></RoleGuard>} />
                {/* <Route path="/reports" element={<RoleGuard allowedRoles={["admin", "team_lead"]}><ReportsBuilder /></RoleGuard>} /> */}

                {/* Admin + Team Lead + Engineer shared routes */}
                {/* <Route path="/custom-forms" element={<RoleGuard allowedRoles={["admin", "team_lead", "engineer"]}><CustomForms /></RoleGuard>} /> */}
                <Route path="/dispatch-tickets" element={<RoleGuard allowedRoles={["admin", "team_lead", "engineer", "associate_coordinator", "service_desk"]}><DispatchTickets /></RoleGuard>} />
                <Route path="/dispatch-inbox" element={<RoleGuard allowedRoles={["admin", "team_lead", "associate_coordinator"]}><DispatchInbox /></RoleGuard>} />
                

                {/* Associate Coordinator routes */}
                <Route path="/coordinator" element={<RoleGuard allowedRoles={["admin", "associate_coordinator"]}><CoordinatorDashboard /></RoleGuard>} />

                {/* All authenticated users */}
                <Route path="/internal-chat" element={<ProtectedRoute><InternalChat /></ProtectedRoute>} />
                <Route path="/external-chat" element={<RoleGuard allowedRoles={["admin", "team_lead", "service_desk"]}><ExternalChat /></RoleGuard>} />
                {/* <Route path="/knowledge-base" element={<ProtectedRoute><KnowledgeBase /></ProtectedRoute>} /> */}
                <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
                <Route path="/settings" element={<RoleGuard allowedRoles={["admin"]}><Settings /></RoleGuard>} />
                <Route path="/settings/device" element={<ProtectedRoute><DeviceSettings /></ProtectedRoute>} />

                {/* Team Lead routes */}
                <Route path="/teamlead" element={<RoleGuard allowedRoles={["admin", "team_lead"]}><TeamLeadDashboard /></RoleGuard>} />
                <Route path="/teamlead/engineers" element={<RoleGuard allowedRoles={["admin", "team_lead"]}><TeamLeadEngineers /></RoleGuard>} />
                <Route path="/teamlead/jobs" element={<RoleGuard allowedRoles={["admin", "team_lead"]}><TeamLeadJobs /></RoleGuard>} />
                <Route path="/teamlead/performance" element={<RoleGuard allowedRoles={["admin", "team_lead"]}><TeamLeadPerformance /></RoleGuard>} />

                {/* Engineer routes */}
                {/* Engineer landing → My Jobs (with widgets including SmartMatch) */}
                <Route path="/engineer" element={<Navigate to="/engineer/jobs" replace />} />
                <Route path="/engineer/dashboard" element={<RoleGuard allowedRoles={["admin", "engineer"]}><EngineerDashboard /></RoleGuard>} />
                <Route path="/engineer/onboarding" element={<RoleGuard allowedRoles={["admin", "engineer"]}><EngineerOnboarding /></RoleGuard>} />
                <Route path="/engineer/jobs" element={<RoleGuard allowedRoles={["admin", "engineer"]}><EngineerJobs /></RoleGuard>} />
                <Route path="/engineer/smart-match" element={<RoleGuard allowedRoles={["admin", "engineer"]}><SmartMatchAlerts /></RoleGuard>} />
                <Route path="/engineer/profile" element={<RoleGuard allowedRoles={["admin", "engineer"]}><EngineerProfile /></RoleGuard>} />
                <Route path="/engineer/earnings" element={<RoleGuard allowedRoles={["admin", "engineer"]}><EngineerEarnings /></RoleGuard>} />
                <Route path="/engineer/assistant" element={<RoleGuard allowedRoles={["admin", "engineer"]}><EngineerAssistant /></RoleGuard>} />
                <Route path="/marketplace" element={<RoleGuard allowedRoles={["admin", "team_lead", "engineer", "associate_coordinator"]}><JobMarketplace /></RoleGuard>} />
                <Route path="/marketplace-admin" element={<RoleGuard allowedRoles={["admin", "team_lead", "associate_coordinator"]}><MarketplaceAdmin /></RoleGuard>} />
                <Route path="/engineer/invoices" element={<RoleGuard allowedRoles={["admin", "engineer"]}><EngineerInvoices /></RoleGuard>} />
                <Route path="/engineer/bank-details" element={<RoleGuard allowedRoles={["admin", "engineer"]}><EngineerBankDetails /></RoleGuard>} />

                {/* Client routes */}
                <Route path="/client" element={<RoleGuard allowedRoles={["admin", "client"]}><ClientDashboard /></RoleGuard>} />
                <Route path="/client/new-request" element={<RoleGuard allowedRoles={["admin", "client"]}><CreateServiceRequest /></RoleGuard>} />
                <Route path="/client/tracking" element={<RoleGuard allowedRoles={["admin", "client"]}><ClientJobTracking /></RoleGuard>} />
                <Route path="/client/history" element={<RoleGuard allowedRoles={["admin", "client"]}><ClientServiceHistory /></RoleGuard>} />
                <Route path="/client/settings" element={<RoleGuard allowedRoles={["admin", "client"]}><ClientSettings /></RoleGuard>} />
                <Route path="/client/estimates" element={<RoleGuard allowedRoles={["admin", "client"]}><ClientEstimates /></RoleGuard>} />
                <Route path="/client/invoices" element={<RoleGuard allowedRoles={["admin", "client"]}><ClientInvoices /></RoleGuard>} />

                {/* Partner routes */}
                <Route path="/partners" element={<RoleGuard allowedRoles={["admin"]}><Partners /></RoleGuard>} />
                <Route path="/partner" element={<RoleGuard allowedRoles={["admin", "partner"]}><PartnerDashboard /></RoleGuard>} />
                <Route path="/partner/clients" element={<RoleGuard allowedRoles={["admin", "partner"]}><PartnerClients /></RoleGuard>} />
                <Route path="/partner/jobs" element={<RoleGuard allowedRoles={["admin", "partner"]}><PartnerJobs /></RoleGuard>} />
                <Route path="/partner/revenue" element={<RoleGuard allowedRoles={["admin", "partner"]}><PartnerRevenue /></RoleGuard>} />

                {/* Recruiter routes */}
                <Route path="/recruiter" element={<RoleGuard allowedRoles={["admin", "recruiter"]}><RecruiterDashboard /></RoleGuard>} />
                <Route path="/recruiter/jobs" element={<RoleGuard allowedRoles={["admin", "recruiter"]}><RecruiterJobs /></RoleGuard>} />
                <Route path="/recruiter/nominate/:jobId" element={<RoleGuard allowedRoles={["admin", "recruiter"]}><NominateCandidate /></RoleGuard>} />

                {/* Help center — accessible to anyone signed-in (and also publicly so users can learn before login) */}
                <Route path="/help" element={<Help />} />
                <Route path="/help/:slug" element={<Help />} />

                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
            {/* <FloatingAIChatGated /> */}
          </BrowserRouter>
        </TooltipProvider>
      </CurrencyProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
