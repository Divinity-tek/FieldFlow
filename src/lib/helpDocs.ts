// Comprehensive in-app help documentation for every section/page.
// Each entry powers the searchable /help knowledge base.

export type HelpDoc = {
  /** Stable slug used in URL: /help/<slug> */
  slug: string;
  /** Page title */
  title: string;
  /** Category bucket for sidebar grouping */
  category: HelpCategory;
  /** App route this doc covers (omit for cross-cutting docs) */
  path?: string;
  /** Short one-liner shown in search results */
  summary: string;
  /** Searchable keywords */
  keywords: string[];
  /** Full doc body in markdown-ish blocks */
  sections: HelpSection[];
};

export type HelpSection = {
  heading: string;
  body: string; // multi-line text; rendered as paragraphs
  bullets?: string[];
};

export type HelpCategory =
  | "Getting Started"
  | "Operations"
  | "Dispatch & Scheduling"
  | "Field Engineers"
  | "Clients & Portal"
  | "Partners"
  | "Sales & Estimates"
  | "Billing & Finance"
  | "Inventory & Assets"
  | "Analytics & Reporting"
  | "Compliance & Contracts"
  | "Communication"
  | "Administration"
  | "Account";

const s = (heading: string, body: string, bullets?: string[]): HelpSection => ({ heading, body, bullets });

const overview = (what: string) => s("Overview", what);
const usage = (steps: string[]) => s("How to use it", "Follow these steps to get the most out of this section:", steps);
const tips = (items: string[]) => s("Tips & best practices", "Recommended habits to make this section work well for your team:", items);
const access = (roles: string) => s("Who can access it", `This section is available to: ${roles}.`);

export const HELP_DOCS: HelpDoc[] = [
  // ─────────── Getting Started ───────────
  {
    slug: "landing",
    title: "Landing Page",
    category: "Getting Started",
    path: "/",
    summary: "The public marketing homepage visitors see before signing in.",
    keywords: ["landing", "home", "marketing", "public"],
    sections: [
      overview("The landing page introduces your dispatch platform to prospects and existing customers. It contains hero messaging, feature highlights, calls-to-action and an AI chat widget for instant questions."),
      usage(["Click Sign in (top right) to access the workspace.", "Use the AI chat bubble to ask product questions.", "Click any CTA to start the booking or trial flow."]),
      access("Everyone — no authentication required."),
    ],
  },
  {
    slug: "login",
    title: "Sign In",
    category: "Account",
    path: "/login",
    summary: "Authenticate with email/password or supported social providers.",
    keywords: ["login", "auth", "signin", "password"],
    sections: [
      overview("Sign in to reach your role-specific dashboard. Wrong credentials show an inline error; locked accounts must contact an administrator."),
      usage(["Enter your email and password.", "Click Sign in. You will be redirected to the dashboard for your role.", "Use Forgot password if you cannot remember your credentials."]),
      tips(["Use a password manager.", "Enable browser autofill for faster sign-in.", "Sign out from any shared device."]),
    ],
  },
  {
    slug: "forgot-password",
    title: "Forgot Password",
    category: "Account",
    path: "/forgot-password",
    summary: "Request a reset link sent to your email.",
    keywords: ["password", "reset", "forgot", "recover"],
    sections: [
      overview("Trigger a password-reset email. The link expires after a short window for security."),
      usage(["Enter the email associated with your account.", "Open the email and click the secure reset link.", "Set and confirm your new password."]),
    ],
  },
  {
    slug: "reset-password",
    title: "Reset Password",
    category: "Account",
    path: "/reset-password",
    summary: "Set a new password from the email link.",
    keywords: ["reset", "password", "new password"],
    sections: [
      overview("Opened from the secure email link. Choose a strong password — it must meet the complexity rules shown on screen."),
      usage(["Enter your new password twice.", "Submit. You'll be signed in automatically."]),
    ],
  },
  {
    slug: "self-booking",
    title: "Self-Service Booking",
    category: "Clients & Portal",
    path: "/book",
    summary: "Public page where customers create a service request without signing in.",
    keywords: ["booking", "self service", "request", "public"],
    sections: [
      overview("Share this page with end-customers so they can book a visit themselves. Submissions appear in Dispatch Tickets for triage."),
      usage(["Customer fills site, contact and service-type fields.", "They pick a preferred window.", "On submit, a ticket is created with status Pending Approval."]),
      tips(["Embed the link in your signature and order confirmations.", "Configure rate cards to surface accurate pricing on submission."]),
    ],
  },

  // ─────────── Dashboards ───────────
  {
    slug: "dashboard",
    title: "Admin Dashboard",
    category: "Getting Started",
    path: "/dashboard",
    summary: "Operational snapshot: KPIs, active engineers, jobs and activity feed.",
    keywords: ["dashboard", "kpi", "overview", "stats"],
    sections: [
      overview("Single-pane view of the business: revenue stats, active engineers on the map, recent jobs and an activity feed."),
      s("What you'll see", "The dashboard is composed of:", [
        "Stats cards — jobs today, revenue, completion %, SLA breaches",
        "Charts — trend lines for jobs and revenue",
        "Active engineers — who is on a job right now",
        "Recent jobs — latest 10 with status badges",
        "Activity feed — every system event in chronological order",
      ]),
      tips(["Click any KPI card to drill into the underlying list.", "Bookmark this page as your home."]),
      access("Admin"),
    ],
  },
  {
    slug: "coordinator-dashboard",
    title: "Coordinator Dashboard",
    category: "Getting Started",
    path: "/coordinator",
    summary: "Daily queue view for associate coordinators.",
    keywords: ["coordinator", "queue", "daily"],
    sections: [
      overview("A streamlined dashboard for coordinators: today's tickets, SLA timers, pending approvals and a quick-create button."),
      access("Admin, Associate Coordinator"),
    ],
  },
  {
    slug: "teamlead-dashboard",
    title: "Team Lead Dashboard",
    category: "Getting Started",
    path: "/teamlead",
    summary: "Performance and team-level KPIs for team leads.",
    keywords: ["team lead", "manager", "kpi"],
    sections: [
      overview("Team-level KPIs: engineer utilization, on-time arrival, customer satisfaction, escalations and revenue per engineer."),
      usage(["Use filters to scope to a region or sub-team.", "Drill into an engineer card to see their jobs."]),
      access("Admin, Team Lead"),
    ],
  },
  {
    slug: "engineer-dashboard",
    title: "Engineer Dashboard — How to Use the Platform",
    category: "Field Engineers",
    path: "/engineer",
    summary: "Complete guide for field engineers: dashboard, jobs, tickets, profile, earnings and day-to-day usage.",
    keywords: ["engineer", "field", "today", "route", "dashboard", "how to", "guide", "platform", "usage", "tickets", "jobs", "profile", "earnings"],
    sections: [
      overview("The Engineer Dashboard is your mobile-first home base. It shows the jobs assigned to you today, your next stop with route, and quick actions to update status. Everything you need on a workday is one or two taps away from this screen."),
      s("Your home screen at a glance", "When you sign in as an engineer, you land on /engineer. The page is organized into:", [
        "Today's jobs — the list of work assigned to you for today, sorted by time.",
        "Next stop card — address, customer, ETA and a one-tap navigate button.",
        "Quick stats — jobs completed today, hours logged, on-time score.",
        "Quick actions — Start day, Mark arrived, Start job, Complete job.",
        "Notifications bell — new assignments, schedule changes and messages.",
      ]),
      s("Daily workflow", "A typical day on the platform follows this pattern:", [
        "1. Open Engineer Dashboard and tap Start day to mark yourself available.",
        "2. Review your route — tap Next stop to open turn-by-turn navigation.",
        "3. On arrival, tap Mark arrived. The customer is auto-notified.",
        "4. Tap Start job. The SLA timer begins and your status switches to In progress.",
        "5. Capture photos, scan parts/serials and take the customer signature from the job page.",
        "6. Tap Complete job, add notes/proof, and submit.",
        "7. Move to the next stop. Repeat until your day is done, then tap End day.",
      ]),
      s("My Jobs (/engineer/jobs)", "Open from the sidebar to see every job assigned to you across days, not just today.", [
        "Filter by status: Scheduled, In progress, Completed.",
        "Tap any job to open the full detail page with checklist, parts, photos and signature capture.",
        "Use the map view to see all jobs on a map with directions.",
      ]),
      s("Dispatch Tickets (/dispatch-tickets)", "Engineers see only tickets assigned to them. From the edit dialog you can:", [
        "Update status to Dispatched, In progress, or Completed.",
        "Add Engineer notes that the office can read.",
        "You cannot reassign tickets, change priority, or edit charges — that's reserved for Admin and Team Lead.",
      ]),
      s("Profile & identity verification (/engineer/profile)", "Keep your profile current so dispatch picks you for the right jobs:", [
        "Skills & certifications — add what you're qualified to do.",
        "Service regions — pick the areas you can travel to.",
        "Availability — set your working hours and time off.",
        "Identity verification — upload one selfie and one ID card (max 10MB each, JPG/PNG/WEBP/HEIC; ID card also accepts PDF). Files are reviewed by an admin and stored securely.",
      ]),
      s("Earnings (/engineer/earnings)", "Track money owed to you for completed jobs.", [
        "See per-job payout breakdowns.",
        "Submit receipt claims for tolls, parking and parts.",
        "Watch payout status: Pending → Approved → Paid.",
      ]),
      s("Capturing proof on a job", "Every job has a Proof tab where you collect what billing and the customer need:", [
        "Before / after photos — drag to reorder.",
        "Customer signature — capture on the device.",
        "Voice notes — record short audio updates.",
        "Parts used — pick from inventory or scan a barcode.",
      ]),
      s("Communication", "Stay in touch without leaving the app:", [
        "Internal Chat — message dispatch and team mates in real time.",
        "Notifications bell — read assignments, reschedules and customer replies.",
        "Help button — open this Help Center on any page for the page-specific guide.",
      ]),
      tips([
        "Bookmark /engineer as your home screen — on mobile, Add to Home Screen for app-like access.",
        "Update status as soon as it changes — late updates hurt your on-time score and confuse the customer.",
        "Always upload completion photos before tapping Complete — you can't change them after submission without admin help.",
        "Keep your profile photo, identity selfie and ID card current; missing or expired docs can pause new assignments.",
        "Use voice notes when you don't have time to type.",
      ]),
      access("Admin, Engineer"),
    ],
  },
  {
    slug: "client-dashboard",
    title: "Client Dashboard",
    category: "Clients & Portal",
    path: "/client",
    summary: "Customer-facing portal: requests, estimates and invoices.",
    keywords: ["client", "portal", "customer"],
    sections: [
      overview("Self-service portal where customers see open jobs, history, estimates awaiting approval and invoices to pay."),
      access("Admin, Client"),
    ],
  },
  {
    slug: "partner-dashboard",
    title: "Partner Dashboard",
    category: "Partners",
    path: "/partner",
    summary: "Revenue, jobs and clients overview for channel partners.",
    keywords: ["partner", "channel", "revenue"],
    sections: [
      overview("Channel-partner workspace: assigned clients, active jobs and earned revenue."),
      access("Admin, Partner"),
    ],
  },

  // ─────────── Operations ───────────
  {
    slug: "jobs",
    title: "Jobs",
    category: "Operations",
    path: "/jobs",
    summary: "Master list of all jobs with filtering, search and bulk actions.",
    keywords: ["jobs", "work orders", "tickets"],
    sections: [
      overview("The Jobs page is the canonical list of every work order. Filter by status, region, engineer, priority or date range."),
      usage(["Search by job number, client or site.", "Use Filters to narrow the list.", "Click a row to open the detail drawer.", "Use Bulk actions to assign or reschedule multiple jobs."]),
      tips(["Save common filter combinations as views.", "Export the filtered list to CSV from the toolbar."]),
      access("Admin, Team Lead, Associate Coordinator"),
    ],
  },
  {
    slug: "engineers",
    title: "Engineers",
    category: "Operations",
    path: "/engineers",
    summary: "Directory of field engineers with skills, status and performance.",
    keywords: ["engineers", "technicians", "directory", "skills"],
    sections: [
      overview("Browse and manage your engineer roster. Each profile carries skills, certifications, region, current status and performance scorecards."),
      usage(["Search by name, skill or region.", "Click a row to open the engineer detail.", "Edit skills/certs from the detail drawer."]),
      access("Admin, Team Lead, Associate Coordinator"),
    ],
  },
  {
    slug: "dispatch",
    title: "Dispatch Console",
    category: "Dispatch & Scheduling",
    path: "/dispatch",
    summary: "Live map + side panel for assigning jobs to engineers.",
    keywords: ["dispatch", "map", "assign"],
    sections: [
      overview("The dispatch console combines a live map of engineers with a side panel of unassigned jobs. Drag a job onto an engineer to assign."),
      s("Map controls", "The map supports the usual gestures plus:", [
        "Cluster zoom on dense areas",
        "Filter by region, skill or availability",
        "Animated pins for in-transit engineers",
      ]),
      tips(["Use the AI Schedule panel for suggested assignments.", "Clear filters before bulk-dispatching."]),
      access("Admin, Team Lead, Associate Coordinator"),
    ],
  },
  {
    slug: "dispatch-tickets",
    title: "Dispatch Tickets",
    category: "Dispatch & Scheduling",
    path: "/dispatch-tickets",
    summary: "Kanban + table view of all dispatch tickets with optimistic drag-and-drop.",
    keywords: ["tickets", "kanban", "board", "drag", "status"],
    sections: [
      overview("All dispatch tickets in one place. Switch between table and kanban views; drag cards across columns to change status with optimistic updates."),
      s("Kanban interactions", "On the kanban board you can:", [
        "Drag a card to change its status — the move is applied instantly.",
        "If the save fails, the card snaps back and a toast is shown.",
        "Cards being saved show an Updating… badge with an Undo link.",
        "Clicking Undo asks you to confirm before reverting.",
      ]),
      s("Table view", "The table provides:", [
        "Sortable columns for ticket #, client, status, priority, charges",
        "Inline status badges with the same Updating/Undo affordance",
        "Quick View and Edit buttons per row",
      ]),
      usage(["Click + New Ticket to create one.", "Use the search box to find a ticket by number, client or site.", "Use the view toggle (top right) to switch table ⇄ kanban."]),
      tips(["Rapid drags on the same card are coalesced — only the latest target status is sent.", "Undo is only available while the Updating… badge is visible."]),
      access("Admin, Team Lead, Engineer, Associate Coordinator"),
    ],
  },
  {
    slug: "auto-dispatch",
    title: "Auto-Dispatch",
    category: "Dispatch & Scheduling",
    path: "/auto-dispatch",
    summary: "Configure rules that auto-assign tickets to the best engineer.",
    keywords: ["auto", "rules", "automation"],
    sections: [
      overview("Define rules so new tickets are auto-assigned without human intervention. Rules combine skill, region, availability and load."),
      usage(["Create a rule.", "Pick match criteria (skill, region, priority).", "Pick the assignment strategy (round-robin, least-loaded, AI-best-fit).", "Enable the rule."]),
      access("Admin, Team Lead, Associate Coordinator"),
    ],
  },
  {
    slug: "scheduler-board",
    title: "Scheduler Board",
    category: "Dispatch & Scheduling",
    path: "/scheduler-board",
    summary: "Drag-and-drop calendar to plan engineer schedules across days.",
    keywords: ["schedule", "calendar", "board"],
    sections: [
      overview("Multi-engineer day/week calendar. Drag jobs onto time slots; conflicts are highlighted."),
      tips(["Hold shift while dragging to copy a recurring job.", "Use color codes for job types."]),
      access("Admin, Team Lead, Associate Coordinator"),
    ],
  },
  {
    slug: "scheduling",
    title: "Scheduling",
    category: "Dispatch & Scheduling",
    path: "/scheduling",
    summary: "Date-based scheduling list with filters per engineer.",
    keywords: ["scheduling", "calendar"],
    sections: [
      overview("List-style scheduling view as an alternative to the calendar board."),
      access("Admin, Team Lead"),
    ],
  },
  {
    slug: "live-tracking",
    title: "Live Tracking",
    category: "Dispatch & Scheduling",
    path: "/live-tracking",
    summary: "Real-time map of engineers with ETAs.",
    keywords: ["tracking", "live", "gps", "eta"],
    sections: [
      overview("See where each engineer is right now. Pins update every few seconds; ETA recalculates from current location."),
      access("Admin, Team Lead"),
    ],
  },
  {
    slug: "route-optimizer",
    title: "Route Optimizer",
    category: "Dispatch & Scheduling",
    path: "/route-optimizer",
    summary: "Optimize a day's stops to minimize drive time per engineer.",
    keywords: ["route", "optimize", "tsp"],
    sections: [
      overview("Plan the most efficient route for each engineer. The optimizer considers stop priorities, time windows and SLA deadlines."),
      access("Admin, Team Lead"),
    ],
  },
  {
    slug: "dispatch-model",
    title: "Dispatch Model",
    category: "Dispatch & Scheduling",
    path: "/dispatch-model",
    summary: "Tune the weights used by the AI dispatcher.",
    keywords: ["model", "ai", "weights"],
    sections: [
      overview("Tune how the AI weights skill match, distance, load, customer rating and SLA risk when picking engineers."),
      access("Admin"),
    ],
  },
  {
    slug: "sla",
    title: "SLA Tracking",
    category: "Operations",
    path: "/sla",
    summary: "Track response/resolution SLAs per ticket with breach alerts.",
    keywords: ["sla", "service level"],
    sections: [
      overview("Monitor SLA timers across all open tickets. Cards turn amber as deadlines approach, red on breach."),
      access("Admin, Team Lead, Associate Coordinator"),
    ],
  },
  {
    slug: "sla-escalation",
    title: "SLA Escalation",
    category: "Operations",
    path: "/sla-escalation",
    summary: "Configure the escalation ladder for SLA breaches.",
    keywords: ["escalation", "sla", "rules"],
    sections: [
      overview("Define who gets paged at each escalation level (e.g. team lead at 80% SLA, manager at breach)."),
      access("Admin, Team Lead"),
    ],
  },
  {
    slug: "site-surveys",
    title: "Site Surveys",
    category: "Operations",
    path: "/site-surveys",
    summary: "Pre-installation surveys with checklists and photo capture.",
    keywords: ["survey", "site", "pre-install"],
    sections: [
      overview("Capture site information before installation: cabling paths, power, photos, contacts."),
      access("Admin, Team Lead"),
    ],
  },
  {
    slug: "recurring-jobs",
    title: "Recurring Jobs",
    category: "Operations",
    path: "/recurring-jobs",
    summary: "Templates that auto-create maintenance jobs on a schedule.",
    keywords: ["recurring", "maintenance", "schedule"],
    sections: [
      overview("Set up jobs that repeat — weekly cleaning, monthly check-ups, quarterly inspections."),
      access("Admin, Team Lead"),
    ],
  },
  {
    slug: "timesheets",
    title: "Timesheets",
    category: "Operations",
    path: "/timesheets",
    summary: "Engineer hours by job, with approval workflow.",
    keywords: ["time", "hours", "payroll"],
    sections: [
      overview("Engineer-logged hours per job; team leads approve and the data flows to billing/payroll."),
      access("Admin, Team Lead"),
    ],
  },
  {
    slug: "purchase-orders",
    title: "Purchase Orders",
    category: "Inventory & Assets",
    path: "/purchase-orders",
    summary: "Create and track POs to vendors for parts and equipment.",
    keywords: ["po", "purchase", "vendor"],
    sections: [
      overview("Issue POs, track status (draft → sent → received), and reconcile against invoices."),
      access("Admin, Team Lead"),
    ],
  },
  {
    slug: "inventory",
    title: "Inventory",
    category: "Inventory & Assets",
    path: "/inventory",
    summary: "Parts catalogue with on-hand counts, reorder points and movements.",
    keywords: ["inventory", "stock", "parts"],
    sections: [
      overview("Search the parts catalogue, see on-hand quantities, set reorder points and view recent stock movements."),
      access("Admin, Team Lead"),
    ],
  },
  {
    slug: "remote-assist",
    title: "Remote Assist",
    category: "Field Engineers",
    path: "/remote-assist",
    summary: "Live video/AR co-pilot for engineers on site.",
    keywords: ["remote", "ar", "video"],
    sections: [
      overview("Engineers can request a senior co-pilot via live video with annotation overlays."),
      access("Admin, Team Lead, Engineer"),
    ],
  },

  // ─────────── Sales & Estimates ───────────
  {
    slug: "estimates",
    title: "Estimates",
    category: "Sales & Estimates",
    path: "/estimates",
    summary: "Build, send and track customer estimates.",
    keywords: ["estimate", "quote", "proposal"],
    sections: [
      overview("Author professional estimates with line items, taxes, discounts, branding and an approval workflow."),
      usage(["Click New Estimate.", "Add parties (your business + the client).", "Add line items, set taxes and discounts.", "Send for approval — the client receives a signed link."]),
      tips(["Use templates for repeat work.", "Set notes templates for legal/payment terms."]),
      access("Admin, Team Lead, Associate Coordinator"),
    ],
  },
  {
    slug: "estimate-templates",
    title: "Estimate Templates",
    category: "Sales & Estimates",
    path: "/estimate-templates",
    summary: "Reusable estimate skeletons for common service types.",
    keywords: ["template", "estimate"],
    sections: [overview("Save common estimates as templates so you can spin up new ones in seconds.")],
  },
  {
    slug: "rate-cards",
    title: "Rate Cards",
    category: "Sales & Estimates",
    path: "/rate-cards",
    summary: "Per-client and per-region pricing for services and parts.",
    keywords: ["rate", "pricing", "card"],
    sections: [overview("Pricing books that flow into estimates, invoices and self-booking."), access("Admin")],
  },

  // ─────────── Billing & Finance ───────────
  {
    slug: "invoices",
    title: "Invoices",
    category: "Billing & Finance",
    path: "/invoices",
    summary: "Create, send and track invoices with payment status.",
    keywords: ["invoice", "billing", "payment"],
    sections: [
      overview("All invoices in one list. Filter by status (draft, sent, paid, overdue) and search by client or number."),
      usage(["Generate from a job, estimate or manually.", "Click an invoice to preview it.", "Send via email or download as PDF."]),
      access("Admin"),
    ],
  },
  {
    slug: "invoice-preview",
    title: "Invoice Preview",
    category: "Billing & Finance",
    path: "/invoices/preview",
    summary: "Live preview of an invoice with branded PDF output.",
    keywords: ["invoice", "preview", "pdf"],
    sections: [overview("Print-ready preview of an invoice. Use the toolbar to download, send or copy a payment link.")],
  },
  {
    slug: "receipts",
    title: "Receipts",
    category: "Billing & Finance",
    path: "/receipts",
    summary: "Records of every payment received.",
    keywords: ["receipt", "payment"],
    sections: [overview("View and resend receipts. Each receipt links back to the invoice and the payment method used."), access("Admin")],
  },
  {
    slug: "recurring-billing",
    title: "Recurring Billing",
    category: "Billing & Finance",
    path: "/recurring-billing",
    summary: "Subscriptions and retainer plans with auto-invoicing.",
    keywords: ["subscription", "recurring", "retainer"],
    sections: [overview("Set up retainers and subscriptions that auto-generate invoices on a schedule."), access("Admin, Team Lead")],
  },
  {
    slug: "wallet",
    title: "Wallet & Payments",
    category: "Billing & Finance",
    path: "/wallet",
    summary: "Customer wallet balances, top-ups and payouts.",
    keywords: ["wallet", "payment", "balance"],
    sections: [overview("View and manage customer prepaid wallets and partner payouts."), access("Admin, Team Lead")],
  },
  {
    slug: "financials",
    title: "Financials",
    category: "Billing & Finance",
    path: "/financials",
    summary: "P&L, A/R aging, cash flow and revenue snapshots.",
    keywords: ["financials", "p&l", "ar"],
    sections: [overview("Executive financial view: revenue, costs, A/R aging buckets and cash position."), access("Admin")],
  },

  // ─────────── CRM ───────────
  {
    slug: "crm",
    title: "CRM",
    category: "Sales & Estimates",
    path: "/crm",
    summary: "Clients, contacts and pipeline.",
    keywords: ["crm", "client", "lead", "pipeline"],
    sections: [
      overview("Client and contact directory plus a basic deal pipeline."),
      usage(["Add a client.", "Track contacts under each client.", "Move deals through pipeline stages."]),
      access("Admin, Team Lead, Associate Coordinator"),
    ],
  },
  {
    slug: "customer-portal",
    title: "Customer Portal Settings",
    category: "Clients & Portal",
    path: "/customer-portal",
    summary: "Configure what your clients see in their portal.",
    keywords: ["portal", "customer", "settings"],
    sections: [overview("Toggle which portal sections clients can access; brand the portal."), access("Admin")],
  },
  {
    slug: "client-new-request",
    title: "New Service Request (Client)",
    category: "Clients & Portal",
    path: "/client/new-request",
    summary: "Customers create a new service request from the portal.",
    keywords: ["new request", "client", "ticket"],
    sections: [overview("In-portal flow for clients to submit a new service request — same engine as public booking, just authenticated.")],
  },
  {
    slug: "client-tracking",
    title: "Job Tracking (Client)",
    category: "Clients & Portal",
    path: "/client/tracking",
    summary: "Real-time engineer ETA for the customer.",
    keywords: ["tracking", "client", "eta"],
    sections: [overview("Customers see the assigned engineer on a map with ETA, similar to ride-share apps.")],
  },
  {
    slug: "client-history",
    title: "Service History (Client)",
    category: "Clients & Portal",
    path: "/client/history",
    summary: "All past visits and invoices for the customer.",
    keywords: ["history", "client", "past"],
    sections: [overview("Searchable history of every visit, with the ability to download reports.")],
  },
  {
    slug: "client-settings",
    title: "Client Account Settings",
    category: "Clients & Portal",
    path: "/client/settings",
    summary: "Profile, billing details and notifications for clients.",
    keywords: ["client", "settings"],
    sections: [overview("Where the client manages contacts, billing details and notification preferences.")],
  },
  {
    slug: "client-estimates",
    title: "Estimates (Client)",
    category: "Clients & Portal",
    path: "/client/estimates",
    summary: "Estimates awaiting client approval.",
    keywords: ["estimates", "client", "approval"],
    sections: [overview("Lists estimates the client must approve or reject; signed approvals flow back to your CRM.")],
  },
  {
    slug: "client-invoices",
    title: "Invoices (Client)",
    category: "Clients & Portal",
    path: "/client/invoices",
    summary: "Invoices for the client to view or pay.",
    keywords: ["invoices", "client", "pay"],
    sections: [overview("Outstanding and historical invoices, with a Pay now button when applicable.")],
  },

  // ─────────── Engineer ───────────
  {
    slug: "engineer-jobs",
    title: "My Jobs (Engineer)",
    category: "Field Engineers",
    path: "/engineer/jobs",
    summary: "Engineer's personal job list with status updates.",
    keywords: ["engineer", "my jobs"],
    sections: [overview("Engineer-only list of their assigned jobs with quick status updates."), access("Admin, Engineer")],
  },
  {
    slug: "engineer-profile",
    title: "Engineer Profile",
    category: "Field Engineers",
    path: "/engineer/profile",
    summary: "Skills, certs, regions and availability.",
    keywords: ["profile", "engineer"],
    sections: [overview("Engineers manage their own skill tags, certs, working hours and time-off here.")],
  },
  {
    slug: "engineer-onboarding",
    title: "Engineer Onboarding",
    category: "Field Engineers",
    path: "/engineer/onboarding",
    summary: "Step-through wizard for new engineers.",
    keywords: ["onboarding", "engineer"],
    sections: [overview("Multi-step wizard: profile → docs → certs → kit → first job.")],
  },
  {
    slug: "engineer-smart-match",
    title: "Smart Match Alerts",
    category: "Field Engineers",
    path: "/engineer/smart-match",
    summary: "Notifies engineers about marketplace jobs that fit them.",
    keywords: ["smart match", "alerts"],
    sections: [overview("AI matches open marketplace jobs to engineer profiles and pings them.")],
  },
  {
    slug: "marketplace",
    title: "Job Marketplace",
    category: "Field Engineers",
    path: "/marketplace",
    summary: "Open jobs available for engineers/partners to claim.",
    keywords: ["marketplace", "open jobs"],
    sections: [overview("Open-pool jobs visible to qualified engineers/partners; first-claim or bid based on configuration.")],
  },
  {
    slug: "marketplace-admin",
    title: "Marketplace Admin",
    category: "Administration",
    path: "/marketplace-admin",
    summary: "Approve marketplace listings and review claims.",
    keywords: ["marketplace", "admin"],
    sections: [overview("Admin controls for the marketplace: approve listings, review disputes, set commission.")],
  },

  // ─────────── Team Lead ───────────
  {
    slug: "teamlead-engineers",
    title: "Team Engineers",
    category: "Field Engineers",
    path: "/teamlead/engineers",
    summary: "Roster scoped to a team lead's team.",
    keywords: ["team lead", "engineers"],
    sections: [overview("Team-scoped engineer roster with quick stats and assignment tools.")],
  },
  {
    slug: "teamlead-jobs",
    title: "Team Jobs",
    category: "Operations",
    path: "/teamlead/jobs",
    summary: "Jobs assigned to the team lead's team.",
    keywords: ["team lead", "jobs"],
    sections: [overview("Filtered Jobs page scoped to the team lead's people.")],
  },
  {
    slug: "teamlead-performance",
    title: "Team Performance",
    category: "Analytics & Reporting",
    path: "/teamlead/performance",
    summary: "KPIs aggregated for the team.",
    keywords: ["performance", "team"],
    sections: [overview("Per-engineer scorecards: utilization, on-time, CSAT, revisits.")],
  },

  // ─────────── Partners ───────────
  {
    slug: "partners",
    title: "Partners",
    category: "Partners",
    path: "/partners",
    summary: "Partner directory and onboarding.",
    keywords: ["partners", "channel"],
    sections: [overview("Master list of channel partners with status, region and revenue."), access("Admin")],
  },
  {
    slug: "partner-clients",
    title: "Partner Clients",
    category: "Partners",
    path: "/partner/clients",
    summary: "Clients owned by the partner.",
    keywords: ["partner", "clients"],
    sections: [overview("Clients the partner introduced; commission flows from these.")],
  },
  {
    slug: "partner-jobs",
    title: "Partner Jobs",
    category: "Partners",
    path: "/partner/jobs",
    summary: "Jobs delivered for partner clients.",
    keywords: ["partner", "jobs"],
    sections: [overview("Jobs related to the partner's clients with visibility into status and outcome.")],
  },
  {
    slug: "partner-revenue",
    title: "Partner Revenue",
    category: "Partners",
    path: "/partner/revenue",
    summary: "Commission earnings dashboard for partners.",
    keywords: ["partner", "revenue"],
    sections: [overview("Earned commission, scheduled payouts and historical statements.")],
  },

  // ─────────── Compliance ───────────
  {
    slug: "compliance",
    title: "Compliance Tracker",
    category: "Compliance & Contracts",
    path: "/compliance",
    summary: "Track engineer certs, insurance and background checks.",
    keywords: ["compliance", "certs", "insurance"],
    sections: [overview("Centralized view of every compliance item per engineer with expiry alerts."), access("Admin, Team Lead")],
  },
  {
    slug: "talent-pool",
    title: "Talent Pool",
    category: "Field Engineers",
    path: "/talent-pool",
    summary: "External engineer candidates ready to onboard.",
    keywords: ["talent", "candidates"],
    sections: [overview("Pool of vetted external engineers. Promote one to full engineer when needed."), access("Admin, Team Lead")],
  },
  {
    slug: "vendors",
    title: "Vendor Management",
    category: "Inventory & Assets",
    path: "/vendors",
    summary: "Suppliers, contracts and performance.",
    keywords: ["vendor", "supplier"],
    sections: [overview("Manage suppliers, their contracts and on-time/quality scores."), access("Admin, Team Lead")],
  },
  {
    slug: "helpdesk",
    title: "Internal Helpdesk",
    category: "Communication",
    path: "/helpdesk",
    summary: "Internal support tickets between staff.",
    keywords: ["helpdesk", "support"],
    sections: [overview("Track internal IT/ops support requests."), access("Admin, Team Lead, Associate Coordinator")],
  },
  {
    slug: "global-operations",
    title: "Global Operations",
    category: "Operations",
    path: "/global-operations",
    summary: "Live world map of operations across regions.",
    keywords: ["global", "operations", "world"],
    sections: [overview("Animated globe showing real-time activity across all regions."), access("Admin")],
  },
  {
    slug: "regions",
    title: "Regions",
    category: "Administration",
    path: "/regions",
    summary: "Define the regions you operate in.",
    keywords: ["regions", "geography"],
    sections: [overview("Define regions used for filtering and assignment throughout the app."), access("Admin")],
  },
  {
    slug: "org-structure",
    title: "Org Structure",
    category: "Administration",
    path: "/org-structure",
    summary: "Visual hierarchy of teams and reporting lines.",
    keywords: ["org", "structure", "hierarchy"],
    sections: [overview("Visualize and edit the organization's reporting structure."), access("Admin")],
  },

  // ─────────── Analytics ───────────
  {
    slug: "analytics",
    title: "Analytics",
    category: "Analytics & Reporting",
    path: "/analytics",
    summary: "Cross-cutting analytics dashboards.",
    keywords: ["analytics", "charts"],
    sections: [overview("Pre-built dashboards covering operations, sales, finance and CSAT."), access("Admin")],
  },
  {
    slug: "csat-surveys",
    title: "CSAT Surveys",
    category: "Analytics & Reporting",
    path: "/csat-surveys",
    summary: "Post-job customer satisfaction survey results.",
    keywords: ["csat", "survey", "feedback"],
    sections: [overview("Aggregate and per-engineer CSAT, NPS and verbatim feedback."), access("Admin, Team Lead")],
  },
  {
    slug: "reports",
    title: "Reports Builder",
    category: "Analytics & Reporting",
    path: "/reports",
    summary: "Build custom reports from any data set.",
    keywords: ["reports", "custom", "builder"],
    sections: [
      overview("Drag-and-drop report builder. Pick a data source, columns, filters and a chart type."),
      usage(["Click New Report.", "Select a source (jobs, invoices, engineers).", "Drag fields into rows/columns/filters.", "Save and share."]),
      access("Admin, Team Lead"),
    ],
  },

  // ─────────── Projects / Networking ───────────
  {
    slug: "projects",
    title: "Projects",
    category: "Operations",
    path: "/projects",
    summary: "Multi-job programs (e.g. national rollouts).",
    keywords: ["projects", "program", "rollout"],
    sections: [overview("Group hundreds of jobs under a project umbrella with milestones and a Gantt view."), access("Admin, Team Lead, Associate Coordinator")],
  },

  // ─────────── Communication ───────────
  {
    slug: "internal-chat",
    title: "Internal Chat",
    category: "Communication",
    path: "/internal-chat",
    summary: "Realtime chat across rooms and DMs for staff.",
    keywords: ["chat", "internal", "rooms"],
    sections: [
      overview("Slack-style internal chat with rooms, DMs, presence, typing, reactions and pinned messages."),
      usage(["Pick a room from the left.", "Type @ to mention someone.", "Drop files into the input or paste images.", "Use search to find any message."]),
      access("All authenticated users"),
    ],
  },
  {
    slug: "external-chat",
    title: "External Chat",
    category: "Communication",
    path: "/external-chat",
    summary: "Customer-facing chat across channels (web, WhatsApp, etc.).",
    keywords: ["chat", "external", "customer"],
    sections: [overview("Unified inbox for customer conversations across channels."), access("Admin, Team Lead")],
  },
  {
    slug: "shared-conversation",
    title: "Shared Conversation",
    category: "Communication",
    path: "/shared/:token",
    summary: "Read-only public link to a single conversation.",
    keywords: ["share", "conversation", "public"],
    sections: [overview("Generate a public read-only link to a chat for stakeholders without an account.")],
  },
  {
    slug: "notifications",
    title: "Notifications",
    category: "Communication",
    path: "/notifications",
    summary: "All your alerts in one place with read/unread state.",
    keywords: ["notifications", "alerts"],
    sections: [overview("Inbox of every alert that fired for you. Click to jump to the source."), access("All authenticated users")],
  },

  // ─────────── Knowledge / AI ───────────
  {
    slug: "knowledge-base",
    title: "Knowledge Base",
    category: "Communication",
    path: "/knowledge-base",
    summary: "Internal wiki / how-to articles for staff.",
    keywords: ["wiki", "kb", "articles"],
    sections: [overview("Central place for internal SOPs and how-to articles. Use the search to find an article fast.")],
  },
  {
    slug: "custom-forms",
    title: "Custom Forms",
    category: "Operations",
    path: "/custom-forms",
    summary: "Build custom data-collection forms used in the field.",
    keywords: ["forms", "custom", "checklist"],
    sections: [overview("Drag-and-drop form builder. Attach a form to a job type so engineers fill it on site.")],
  },

  // ─────────── Administration ───────────
  {
    slug: "settings",
    title: "Settings",
    category: "Administration",
    path: "/settings",
    summary: "Workspace, branding, security and notification settings.",
    keywords: ["settings", "config"],
    sections: [
      overview("All configuration knobs for the workspace: branding, locale, security, notifications, integrations."),
      tips(["Review security settings (MFA, session length) at least quarterly.", "Set workspace timezone before inviting users."]),
      access("Admin"),
    ],
  },
  {
    slug: "audit-logs",
    title: "Audit Logs",
    category: "Administration",
    path: "/audit-logs",
    summary: "Tamper-evident log of every sensitive action.",
    keywords: ["audit", "log", "security"],
    sections: [overview("Every create/update/delete on critical entities is logged with actor, timestamp and IP."), access("Admin")],
  },
];

export const HELP_CATEGORIES: HelpCategory[] = [
  "Getting Started",
  "Operations",
  "Dispatch & Scheduling",
  "Field Engineers",
  "Clients & Portal",
  "Partners",
  "Sales & Estimates",
  "Billing & Finance",
  "Inventory & Assets",
  "Analytics & Reporting",
  "Compliance & Contracts",
  "Communication",
  "Administration",
  "Account",
];

export function findHelpDoc(slug: string): HelpDoc | undefined {
  return HELP_DOCS.find((d) => d.slug === slug);
}

export function searchHelpDocs(q: string): HelpDoc[] {
  const term = q.trim().toLowerCase();
  if (!term) return HELP_DOCS;
  return HELP_DOCS.filter((d) => {
    if (d.title.toLowerCase().includes(term)) return true;
    if (d.summary.toLowerCase().includes(term)) return true;
    if (d.keywords.some((k) => k.toLowerCase().includes(term))) return true;
    if (d.category.toLowerCase().includes(term)) return true;
    if (d.sections.some((s) => s.heading.toLowerCase().includes(term) || s.body.toLowerCase().includes(term) || s.bullets?.some((b) => b.toLowerCase().includes(term)))) return true;
    return false;
  });
}
