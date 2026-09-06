import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useUserPreference } from "@/hooks/useUserPreference";

export interface TourStep {
  target: string;
  title: string;
  content: string;
  placement?: "top" | "bottom" | "left" | "right";
}

// ── Shared steps ──
const WELCOME_STEP: TourStep = {
  target: "[data-tour='sidebar-logo']",
  title: "Welcome to FieldFlow!",
  content: "This is your field service management hub. Let's take a quick tour of the key features.",
  placement: "right",
};

const HEADER_STEPS: TourStep[] = [
  { target: "[data-tour='header-search']", title: "Quick Search", content: "Search across all data — jobs, clients, engineers, and more.", placement: "bottom" },
  { target: "[data-tour='header-help']", title: "Help & Documentation", content: "Access the help panel anytime. Press ? on your keyboard as a shortcut.", placement: "bottom" },
  { target: "[data-tour='header-notifications']", title: "Notifications", content: "Stay on top of job updates, SLA alerts, and team activity.", placement: "bottom" },
];

// ── Role-specific steps ──
const ADMIN_STEPS: TourStep[] = [
  WELCOME_STEP,
  { target: "[data-tour='nav-dashboard']", title: "Dashboard", content: "Your command centre — view KPIs, charts, active jobs, and engineer activity at a glance.", placement: "right" },
  { target: "[data-tour='nav-jobs']", title: "Job Management", content: "Create, assign, and track service jobs through their full lifecycle.", placement: "right" },
  { target: "[data-tour='nav-dispatch-map']", title: "Dispatch Map", content: "See real-time locations of all engineers and jobs. Assign the closest engineer with AI.", placement: "right" },
  { target: "[data-tour='nav-scheduling']", title: "Scheduling", content: "Drag-and-drop calendar for assigning jobs and managing engineer availability.", placement: "right" },
  { target: "[data-tour='nav-crm']", title: "CRM", content: "Manage tickets, communications, lead pipeline, and client satisfaction scoring.", placement: "right" },
  { target: "[data-tour='nav-analytics']", title: "Analytics", content: "Deep-dive into performance metrics, trends, and operational benchmarks.", placement: "right" },
  ...HEADER_STEPS,
];

const CLIENT_STEPS: TourStep[] = [
  { ...WELCOME_STEP, content: "Welcome! Here you can request services, track jobs, and manage your account." },
  { target: "[data-tour='nav-dashboard']", title: "Your Dashboard", content: "See an overview of your active jobs, recent requests, and account summary.", placement: "right" },
  { target: "[data-tour='nav-new-request']", title: "New Service Request", content: "Submit a new service request — choose service type, location, and priority.", placement: "right" },
  { target: "[data-tour='nav-track-jobs']", title: "Track Jobs", content: "Follow your service jobs in real time — see status, assigned engineer, and progress.", placement: "right" },
  { target: "[data-tour='nav-estimates']", title: "Estimates", content: "Review and approve service estimates before work begins.", placement: "right" },
  { target: "[data-tour='nav-invoices']", title: "Invoices", content: "View and pay invoices for completed services.", placement: "right" },
  ...HEADER_STEPS,
];

const ENGINEER_STEPS: TourStep[] = [
  { ...WELCOME_STEP, content: "Welcome! Here you can manage your jobs, update your profile, and track your performance." },
  { target: "[data-tour='engineer-dashboard']", title: "Your Dashboard", content: "See your active jobs, pending assignments, and performance stats at a glance.", placement: "bottom" },
  { target: "[data-tour='engineer-jobs']", title: "My Jobs", content: "View all assigned jobs — accept, start, navigate, and complete them from here.", placement: "bottom" },
  { target: "[data-tour='engineer-profile']", title: "Your Profile", content: "Update your skills, hourly rate, and service location to get better job matches.", placement: "bottom" },
  ...HEADER_STEPS,
];

const PARTNER_STEPS: TourStep[] = [
  { ...WELCOME_STEP, content: "Welcome! Manage your referred clients, track jobs, and monitor your revenue." },
  { target: "[data-tour='nav-dashboard']", title: "Partner Dashboard", content: "Overview of your clients, active jobs, and commission earnings.", placement: "right" },
  { target: "[data-tour='nav-clients']", title: "Your Clients", content: "Manage the clients you've referred and track their service history.", placement: "right" },
  { target: "[data-tour='nav-jobs']", title: "Jobs", content: "Monitor all jobs for your referred clients.", placement: "right" },
  { target: "[data-tour='nav-revenue']", title: "Revenue", content: "Track your commission earnings and payout history.", placement: "right" },
  ...HEADER_STEPS,
];

const TEAM_LEAD_STEPS: TourStep[] = [
  { ...WELCOME_STEP, content: "Welcome! Oversee your team's engineers, jobs, and performance metrics." },
  { target: "[data-tour='nav-dashboard']", title: "Team Dashboard", content: "Overview of your team's active jobs, engineer status, and performance.", placement: "right" },
  { target: "[data-tour='nav-engineers']", title: "Your Engineers", content: "View and manage the engineers on your team.", placement: "right" },
  { target: "[data-tour='nav-jobs']", title: "Team Jobs", content: "Track all jobs assigned to your team members.", placement: "right" },
  { target: "[data-tour='nav-performance']", title: "Performance", content: "Analyse individual and team performance with detailed metrics.", placement: "right" },
  ...HEADER_STEPS,
];

const RECRUITER_STEPS: TourStep[] = [
  { ...WELCOME_STEP, content: "Welcome! Manage your job postings, candidates, and recruitment pipeline." },
  { target: "[data-tour='nav-dashboard']", title: "Recruiter Dashboard", content: "Overview of your active job postings, candidate status, and recruitment metrics.", placement: "right" },
  { target: "[data-tour='nav-jobs']", title: "Job Postings", content: "Manage your job postings and view applications.", placement: "right" },
  { target: "[data-tour='nav-candidates']", title: "Candidates", content: "Review and manage candidate applications.", placement: "right" },
  ...HEADER_STEPS,
];

export type AppRole = "admin" | "client" | "engineer" | "partner" | "team_lead" | "recruiter" | null;

export function getStepsForRole(role: AppRole): TourStep[] {
  switch (role) {
    case "client": return CLIENT_STEPS;
    case "engineer": return ENGINEER_STEPS;
    case "partner": return PARTNER_STEPS;
    case "team_lead": return TEAM_LEAD_STEPS;
    case "recruiter": return RECRUITER_STEPS;
    default: return ADMIN_STEPS;
  }
}

// ── Context ──
interface OnboardingContextType {
  isActive: boolean;
  currentStep: number;
  totalSteps: number;
  steps: TourStep[];
  startTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  skipTour: () => void;
  completeTour: () => void;
}

const OnboardingContext = createContext<OnboardingContextType>({
  isActive: false,
  currentStep: 0,
  totalSteps: 0,
  steps: [],
  startTour: () => {},
  nextStep: () => {},
  prevStep: () => {},
  skipTour: () => {},
  completeTour: () => {},
});

export const useOnboarding = () => useContext(OnboardingContext);

export const OnboardingProvider = ({ role, children }: { role: AppRole; children: ReactNode }) => {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const steps = getStepsForRole(role);
  const prefKey = `onboarding-completed-${role ?? "admin"}`;
  const { value: completed, update: setCompleted, loaded } = useUserPreference<boolean>(prefKey, false);

  useEffect(() => {
    if (!loaded) return;
    if (!completed) {
      const timer = setTimeout(() => setIsActive(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [loaded, completed]);

  const startTour = () => {
    setCurrentStep(0);
    setIsActive(true);
  };

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      completeTour();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) setCurrentStep(prev => prev - 1);
  };

  const skipTour = () => {
    setCompleted(true);
    setIsActive(false);
    setCurrentStep(0);
  };

  const completeTour = () => {
    setCompleted(true);
    setIsActive(false);
    setCurrentStep(0);
  };

  return (
    <OnboardingContext.Provider
      value={{ isActive, currentStep, totalSteps: steps.length, steps, startTour, nextStep, prevStep, skipTour, completeTour }}
    >
      {children}
    </OnboardingContext.Provider>
  );
};
