import { describe, it, expect } from "vitest";
import {
  validateAliasPath,
  validateAliasSlug,
  aliasInputSchema,
} from "./helpAliasValidation";
import { HELP_DOCS } from "./helpDocs";

const KNOWN_SLUG = HELP_DOCS[0].slug;

describe("validateAliasPath", () => {
  const valid = [
    "/",
    "/invoices",
    "/invoices/new",
    "/invoices/:id",
    "/invoices/:idOrNumber/edit",
    "/jobs/:jobId/notes",
    "/engineer-jobs",
    "/engineer_jobs/:id",
    "/files/*",
  ];
  for (const p of valid) {
    it(`accepts "${p}"`, () => {
      expect(validateAliasPath(p).ok).toBe(true);
    });
  }

  const invalid: Array<[string, RegExp]> = [
    ["", /required/i],
    ["invoices", /must start with \//i],
    ["/invoices new", /whitespace/i],
    ["/invoices?tab=1", /query/i],
    ["/invoices#x", /query/i],
    ["/invoices//new", /consecutive/i],
    ["/Invoices", /invalid|lowercase/i],
    ["/invoices/:1id", /param/i],
    ["/invoices/:id/:id", /duplicate/i],
    ["/files/*/extra", /wildcard/i],
    ["/" + "a".repeat(250), /too long/i],
    ["/inv@ices", /invalid|lowercase/i],
  ];
  for (const [p, re] of invalid) {
    it(`rejects "${p}"`, () => {
      const r = validateAliasPath(p);
      expect(r.ok).toBe(false);
      if (r.ok === false) expect(r.reason).toMatch(re);
    });
  }

  it("strips trailing slashes", () => {
    const r = validateAliasPath("/invoices/");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.cleaned).toBe("/invoices");
  });
});

describe("validateAliasSlug", () => {
  it("accepts known doc slugs", () => {
    expect(validateAliasSlug(KNOWN_SLUG).ok).toBe(true);
  });
  it("rejects unknown slugs", () => {
    const r = validateAliasSlug("not-a-real-slug-xyz");
    expect(r.ok).toBe(false);
  });
  it("rejects empty", () => {
    expect(validateAliasSlug("").ok).toBe(false);
  });
});

describe("aliasInputSchema", () => {
  it("parses a valid input and trims/cleans values", () => {
    const r = aliasInputSchema.safeParse({
      path: "  /invoices/new/  ",
      slug: `  ${KNOWN_SLUG}  `,
      note: "  hi  ",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.path).toBe("/invoices/new");
      expect(r.data.slug).toBe(KNOWN_SLUG);
      expect(r.data.note).toBe("hi");
    }
  });

  it("rejects invalid path with field-level error", () => {
    const r = aliasInputSchema.safeParse({ path: "invoices", slug: KNOWN_SLUG, note: "" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.includes("path"))).toBe(true);
    }
  });

  it("rejects unknown slug with field-level error", () => {
    const r = aliasInputSchema.safeParse({ path: "/x", slug: "nope", note: "" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.includes("slug"))).toBe(true);
    }
  });

  it("rejects notes longer than 500 chars", () => {
    const r = aliasInputSchema.safeParse({
      path: "/x",
      slug: KNOWN_SLUG,
      note: "n".repeat(501),
    });
    expect(r.success).toBe(false);
  });
});
