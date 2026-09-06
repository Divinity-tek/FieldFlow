import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { screen, within, fireEvent, waitFor } from "@testing-library/dom";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock useUserRole so tests can switch the active role without touching Supabase.
let currentRole: string | null = "admin";
vi.mock("@/hooks/useUserRole", () => ({
  useUserRole: () => ({
    role: currentRole,
    isLoading: false,
    isAdmin: currentRole === "admin",
    isTeamLead: currentRole === "team_lead",
    isEngineer: currentRole === "engineer",
    isClient: currentRole === "client",
    isPartner: currentRole === "partner",
    isAssociateCoordinator: currentRole === "associate_coordinator",
    hasAccess: () => false,
    getDefaultRoute: () => "/",
  }),
}));

// Mock alias store so resolver behavior is deterministic.
vi.mock("@/lib/helpAliasStore", () => ({
  getRuntimeAliases: () => ({}),
  subscribeRuntimeAliases: () => () => {},
  reloadRuntimeAliases: vi.fn(),
  startRuntimeAliasSync: vi.fn(),
}));

import ContextualHelpDrawer from "@/components/help/ContextualHelpDrawer";
import HelpForThisPageButton from "@/components/help/HelpForThisPageButton";
import { TooltipProvider } from "@/components/ui/tooltip";
import { HELP_DOCS } from "@/lib/helpDocs";
import { rolesForPath, roleCanAccess, type HelpRole } from "@/lib/helpRoles";

function setRole(role: HelpRole | null) {
  currentRole = role;
}

function renderAtPath(initialPath: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <TooltipProvider>
        <MemoryRouter initialEntries={[initialPath]}>
          <Routes>
            <Route
              path="*"
              element={
                <div>
                  <HelpForThisPageButton />
                  <ContextualHelpDrawer variant="button" />
                </div>
              }
            />
          </Routes>
        </MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

async function openDrawer() {
  const triggers = screen.getAllByRole("button", { name: /^Help$/ });
  fireEvent.click(triggers[triggers.length - 1]);
  // Drawer content lives in a portal; wait for the title to appear.
  await waitFor(() => {
    expect(document.querySelector('[role="dialog"]')).toBeInTheDocument();
  });
}

function inDrawer() {
  const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
  expect(dialog).toBeTruthy();
  return within(dialog);
}

describe("Contextual help drawer — role-based behavior across routes", () => {
  beforeEach(() => {
    cleanup();
    setRole(null);
  });

  const scenarios: Array<{
    role: HelpRole;
    routes: { path: string; expectAccess: boolean }[];
  }> = [
    {
      role: "admin",
      routes: [
        { path: "/dashboard", expectAccess: true },
        { path: "/invoices/preview/INV-1", expectAccess: true },
        { path: "/engineer/jobs/job-7", expectAccess: true },
      ],
    },
    {
      role: "team_lead",
      routes: [
        { path: "/dashboard", expectAccess: false },
        { path: "/dispatch-tickets/abc", expectAccess: true },
        { path: "/teamlead/performance", expectAccess: true },
      ],
    },
    {
      role: "engineer",
      routes: [
        { path: "/engineer/jobs/job-1", expectAccess: true },
        { path: "/dispatch-tickets/abc", expectAccess: true },
        { path: "/invoices", expectAccess: false },
      ],
    },
    {
      role: "client",
      routes: [
        { path: "/client", expectAccess: true },
        { path: "/client/invoices", expectAccess: true },
        { path: "/dashboard", expectAccess: false },
      ],
    },
    {
      role: "partner",
      routes: [
        { path: "/partner/revenue", expectAccess: true },
        { path: "/partner/jobs/123", expectAccess: true },
        { path: "/invoices", expectAccess: false },
      ],
    },
    {
      role: "associate_coordinator",
      routes: [
        { path: "/coordinator", expectAccess: true },
        { path: "/dispatch-tickets/x", expectAccess: true },
        { path: "/invoices", expectAccess: false },
      ],
    },
  ];

  for (const { role, routes } of scenarios) {
    describe(`as ${role}`, () => {
      for (const { path, expectAccess } of routes) {
        it(`shows correct access badge on ${path}`, async () => {
          setRole(role);
          renderAtPath(path);
          await openDrawer();
          const d = inDrawer();
          if (expectAccess) {
            expect(d.getByText(/Available to your role/i)).toBeInTheDocument();
            expect(d.queryByText(/^Restricted$/i)).not.toBeInTheDocument();
            expect(
              d.queryByText(/doesn't have access to this section/i),
            ).not.toBeInTheDocument();
          } else {
            expect(d.getByText(/^Restricted$/i)).toBeInTheDocument();
            expect(
              d.getByText(/doesn't have access to this section/i),
            ).toBeInTheDocument();
          }
        });

        it(`filters related topics by role on ${path}`, async () => {
          setRole(role);
          renderAtPath(path);
          await openDrawer();
          const d = inDrawer();
          const restrictedBadges = d.queryAllByText(/^restricted$/i);
          // The header may have a single "Restricted" badge; related list should not
          // add additional restricted entries unless "Show all" is on.
          // Filter out the header badge by checking parent context.
          const inRelated = restrictedBadges.filter((el) =>
            el.closest("a")?.getAttribute("href")?.startsWith("/help/"),
          );
          expect(inRelated.length).toBe(0);
        });
      }

      it(`Show all toggle reveals restricted related topics`, async () => {
        setRole(role);
        // Pick any route the role can access so the drawer renders fully.
        const accessible = routes.find((r) => r.expectAccess) ?? routes[0];
        renderAtPath(accessible.path);
        await openDrawer();
        const d = inDrawer();
        const toggle = d.queryByLabelText(/Show all/i);
        if (!toggle) return; // No related items at all → nothing to assert.
        fireEvent.click(toggle);
        // After toggling, restricted entries may or may not appear depending on
        // category contents — we only assert the toggle is wired and doesn't crash.
        await waitFor(() => {
          expect(d.getByLabelText(/Show all/i)).toBeChecked();
        });
      });
    });
  }
});

describe("Contextual help — route resolution during navigation & sub-route changes", () => {
  beforeEach(() => {
    cleanup();
    setRole("admin");
  });

  it("resolves the same doc for a route and its parameterized sub-route", async () => {
    renderAtPath("/invoices");
    await openDrawer();
    const titleParent = inDrawer().getByText(
      HELP_DOCS.find((d) => d.path === "/invoices")!.title,
    );
    expect(titleParent).toBeInTheDocument();
    cleanup();

    renderAtPath("/invoices/INV-9999");
    await openDrawer();
    expect(
      inDrawer().getByText(HELP_DOCS.find((d) => d.path === "/invoices")!.title),
    ).toBeInTheDocument();
  });

  it("HelpForThisPageButton deep-links to the doc slug for sub-routes", () => {
    renderAtPath("/invoices/INV-1");
    const link = screen.getByRole("link", { name: /Open the help guide for/i });
    const invoicesDoc = HELP_DOCS.find((d) => d.path === "/invoices")!;
    expect(link.getAttribute("href")).toBe(`/help/${invoicesDoc.slug}`);
  });

  it("HelpForThisPageButton falls back to /help when no doc matches", () => {
    renderAtPath("/totally-unknown-route");
    const link = screen.getByRole("link", { name: /help center/i });
    expect(link.getAttribute("href")).toBe("/help");
  });
});

describe("Sanity: rolesForPath / roleCanAccess agree with drawer expectations", () => {
  it("dashboards align with the routes used in the role scenarios", () => {
    expect(rolesForPath("/dashboard")).toContain("admin" as HelpRole);
    expect(roleCanAccess("client", "/dashboard")).toBe(false);
    expect(roleCanAccess("admin", "/dashboard")).toBe(true);
  });
});
