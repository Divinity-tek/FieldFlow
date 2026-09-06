import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Visual snapshot of the landing page heading typography tokens.
 *
 * We extract every Tailwind arbitrary-variant class targeting h1, h2,
 * or h3 from Landing.tsx and snapshot the sorted list. Any accidental
 * change, removal, or reordering of heading-related CSS classes will
 * cause this snapshot to fail, flagging the regression for review.
 */
describe("Landing page heading visual snapshot", () => {
  const source = readFileSync(
    resolve(__dirname, "../Landing.tsx"),
    "utf8",
  );

  const headingTokens = Array.from(
    source.matchAll(/\[&_h[1-3][^\]]*\]:[^\s"]+/g),
  )
    .map((m) => m[0])
    .sort();

  it("matches the expected heading class tokens", () => {
    expect(headingTokens).toMatchInlineSnapshot(`
      [
        "[&_h1]:leading-[1.05]",
        "[&_h1]:mb-6",
        "[&_h1]:tracking-[-0.025em]",
        "[&_h2]:leading-[1.15]",
        "[&_h2]:mb-4",
        "[&_h2]:tracking-[-0.02em]",
        "[&_h3]:leading-[1.25]",
        "[&_h3]:mb-3",
        "[&_h3]:tracking-[-0.015em]",
      ]
    `);
  });
});
