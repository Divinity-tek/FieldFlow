import { describe, it, expect } from "vitest";
import { rolesForPath, roleCanAccess, ALL_ROLES, type HelpRole } from "./helpRoles";

describe("helpRoles.rolesForPath", () => {
  it("returns exact-match roles for known routes", () => {
    expect(rolesForPath("/dashboard")).toEqual(["admin"]);
    expect(rolesForPath("/invoices")).toEqual(["admin"]);
    expect(rolesForPath("/dispatch-tickets")).toEqual([
      "admin",
      "team_lead",
      "engineer",
      "associate_coordinator",
    ]);
  });

  it("falls back to longest prefix match for sub-routes", () => {
    expect(rolesForPath("/invoices/preview/123")).toEqual(
      rolesForPath("/invoices/preview"),
    );
    expect(rolesForPath("/engineer/jobs/abc")).toEqual(rolesForPath("/engineer/jobs"));
    expect(rolesForPath("/teamlead/engineers/42")).toEqual(
      rolesForPath("/teamlead/engineers"),
    );
  });

  it("falls back to ALL_ROLES for unknown paths", () => {
    expect(rolesForPath("/this-route-does-not-exist")).toEqual(ALL_ROLES);
    expect(rolesForPath(undefined)).toEqual(ALL_ROLES);
  });
});

describe("helpRoles.roleCanAccess", () => {
  const cases: Array<{
    path: string;
    allow: HelpRole[];
    deny: HelpRole[];
  }> = [
    {
      path: "/dashboard",
      allow: ["admin"],
      deny: ["team_lead", "engineer", "client", "partner", "associate_coordinator"],
    },
    {
      path: "/invoices",
      allow: ["admin"],
      deny: ["team_lead", "engineer", "client", "partner", "associate_coordinator"],
    },
    {
      path: "/dispatch-tickets",
      allow: ["admin", "team_lead", "engineer", "associate_coordinator"],
      deny: ["client", "partner"],
    },
    {
      path: "/client",
      allow: ["admin", "client"],
      deny: ["team_lead", "engineer", "partner", "associate_coordinator"],
    },
    {
      path: "/partner/revenue",
      allow: ["admin", "partner"],
      deny: ["team_lead", "engineer", "client", "associate_coordinator"],
    },
    {
      path: "/engineer/jobs",
      allow: ["admin", "engineer"],
      deny: ["team_lead", "client", "partner", "associate_coordinator"],
    },
    {
      path: "/teamlead/performance",
      allow: ["admin", "team_lead"],
      deny: ["engineer", "client", "partner", "associate_coordinator"],
    },
    {
      path: "/coordinator",
      allow: ["admin", "associate_coordinator"],
      deny: ["team_lead", "engineer", "client", "partner"],
    },
  ];

  for (const { path, allow, deny } of cases) {
    it(`grants access to ${allow.join(", ")} on ${path}`, () => {
      for (const r of allow) expect(roleCanAccess(r, path)).toBe(true);
    });
    it(`denies access to ${deny.join(", ")} on ${path}`, () => {
      for (const r of deny) expect(roleCanAccess(r, path)).toBe(false);
    });
  }

  it("admin always wins, even on routes not listed for admin explicitly", () => {
    expect(roleCanAccess("admin", "/some-unmapped-path")).toBe(true);
    expect(roleCanAccess("admin", "/partner/clients")).toBe(true);
  });

  it("treats null/undefined role as preview (allowed) for public docs", () => {
    expect(roleCanAccess(null, "/dashboard")).toBe(true);
    expect(roleCanAccess(undefined, "/invoices")).toBe(true);
  });

  it("respects sub-route matching for restricted sections", () => {
    // /invoices/preview/:idOrNumber inherits admin-only
    expect(roleCanAccess("client", "/invoices/preview/INV-1")).toBe(false);
    expect(roleCanAccess("admin", "/invoices/preview/INV-1")).toBe(true);
    // engineer/jobs/:id inherits admin+engineer
    expect(roleCanAccess("engineer", "/engineer/jobs/job-7")).toBe(true);
    expect(roleCanAccess("client", "/engineer/jobs/job-7")).toBe(false);
  });
});
