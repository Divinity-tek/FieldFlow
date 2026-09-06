import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Typography regression check for the landing page.
 *
 * Verifies that the root container on Landing.tsx still applies the
 * standardized line-height, letter-spacing, and bottom-margin rhythm
 * for h1, h2, and h3 headings. If any of these tokens drift, this
 * test fails so the rhythm stays in sync with the design system.
 */
describe("Landing page heading typography", () => {
  const source = readFileSync(
    resolve(__dirname, "../Landing.tsx"),
    "utf8",
  );

  const expectedTokens: Array<[string, string]> = [
    // h1
    ["h1", "[&_h1]:tracking-[-0.025em]"],
    ["h1", "[&_h1]:leading-[1.05]"],
    ["h1", "[&_h1]:mb-6"],
    // h2
    ["h2", "[&_h2]:tracking-[-0.02em]"],
    ["h2", "[&_h2]:leading-[1.15]"],
    ["h2", "[&_h2]:mb-4"],
    // h3
    ["h3", "[&_h3]:tracking-[-0.015em]"],
    ["h3", "[&_h3]:leading-[1.25]"],
    ["h3", "[&_h3]:mb-3"],
  ];

  it.each(expectedTokens)(
    "%s keeps the standardized typography token %s",
    (_heading, token) => {
      expect(source).toContain(token);
    },
  );
});
