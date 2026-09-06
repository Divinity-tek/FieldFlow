import { describe, it, expect } from "vitest";
import { resolveHelpDoc } from "./helpRouteMatch";
import { HELP_DOCS } from "./helpDocs";
import { roleCanAccess, type HelpRole } from "./helpRoles";

const slugFor = (path: string) => resolveHelpDoc(path)?.slug;

describe("helpRouteMatch.resolveHelpDoc", () => {
  it("returns the exact doc for an exact path", () => {
    const doc = HELP_DOCS.find((d) => d.path === "/invoices");
    expect(doc).toBeDefined();
    expect(slugFor("/invoices")).toBe(doc!.slug);
  });

  it("matches sub-routes with route params via segment-aware prefix", () => {
    const invoices = HELP_DOCS.find((d) => d.path === "/invoices")!;
    expect(slugFor("/invoices/abc-123")).toBe(invoices.slug);
    expect(slugFor("/invoices/123?tab=details")).toBe(invoices.slug);
    expect(slugFor("/invoices/123#section")).toBe(invoices.slug);
    expect(slugFor("/invoices/")).toBe(invoices.slug);
  });

  it("does NOT match paths that share a prefix but break the segment boundary", () => {
    // /invoicespreview must not be treated as a child of /invoices
    const invoices = HELP_DOCS.find((d) => d.path === "/invoices")!;
    expect(slugFor("/invoicespreview")).not.toBe(invoices.slug);
  });

  it("prefers the longest matching prefix", () => {
    const preview = HELP_DOCS.find((d) => d.path === "/invoices/preview");
    if (preview) {
      expect(slugFor("/invoices/preview/INV-1")).toBe(preview.slug);
    }
  });

  it("resolves PATH_ALIASES (e.g. /invoices/new → invoices doc)", () => {
    expect(slugFor("/invoices/new")).toBe("invoices");
    expect(slugFor("/jobs/new")).toBe("jobs");
    expect(slugFor("/estimates/new")).toBe("estimates");
  });

  it("returns undefined for completely unknown paths", () => {
    expect(slugFor("/totally-unknown-route-xyz")).toBeUndefined();
    expect(resolveHelpDoc("")).toBeUndefined();
  });
});

describe("contextual help: route resolution + role filtering integration", () => {
  // For a few representative routes, verify both the resolved doc AND role gating.
  const scenarios: Array<{
    path: string;
    allow: HelpRole[];
    deny: HelpRole[];
  }> = [
    {
      path: "/invoices/preview/INV-9",
      allow: ["admin"],
      deny: ["client", "engineer", "team_lead", "partner", "associate_coordinator"],
    },
    {
      path: "/dispatch-tickets/abc",
      allow: ["admin", "team_lead", "engineer", "associate_coordinator"],
      deny: ["client", "partner"],
    },
    {
      path: "/engineer/jobs/job-1",
      allow: ["admin", "engineer"],
      deny: ["team_lead", "client", "partner", "associate_coordinator"],
    },
  ];

  for (const { path, allow, deny } of scenarios) {
    it(`resolves a doc for ${path} and gates by role correctly`, () => {
      const doc = resolveHelpDoc(path);
      // We don't require every route to have a dedicated doc, but at minimum the
      // role gate (which is what the drawer uses) must reflect ROUTE_ROLES.
      const checkPath = doc?.path ?? path;
      for (const r of allow) expect(roleCanAccess(r, checkPath)).toBe(true);
      for (const r of deny) expect(roleCanAccess(r, checkPath)).toBe(false);
    });
  }
});
