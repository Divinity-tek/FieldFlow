import { describe, it, expect } from "vitest";
import {
  CSV_HEADERS,
  toCsv,
  parseCsv,
  normalizeRow,
  planUpsert,
  type NotesTemplateLike,
} from "./notesTemplatesCsv";

describe("notes templates CSV", () => {
  describe("toCsv / parseCsv round-trip", () => {
    it("emits the expected header row", () => {
      expect(toCsv([]).split("\n")[0]).toBe(CSV_HEADERS.join(","));
    });

    it("escapes commas, quotes, and newlines and round-trips column mapping", () => {
      const rows: NotesTemplateLike[] = [
        { label: "Net 30", content: "Pay within 30 days.", sort_order: 1, is_active: true, visibility: "all" },
        { label: "Comma, label", content: 'He said "hi"\nNew line', sort_order: 2, is_active: false, visibility: "team_lead_allowed" },
      ];
      const csv = toCsv(rows);
      const parsed = parseCsv(csv);
      expect(parsed).toHaveLength(2);
      expect(parsed[0]).toMatchObject({
        label: "Net 30", content: "Pay within 30 days.",
        sort_order: "1", is_active: "true", visibility: "all",
      });
      expect(parsed[1]).toMatchObject({
        label: "Comma, label",
        content: 'He said "hi"\nNew line',
        sort_order: "2",
        is_active: "false",
        visibility: "team_lead_allowed",
      });
    });

    it("ignores blank trailing lines", () => {
      const csv = "label,content,sort_order,is_active,visibility\nA,B,0,true,all\n\n";
      expect(parseCsv(csv)).toHaveLength(1);
    });
  });

  describe("normalizeRow visibility validation", () => {
    it("defaults unknown/empty visibility to 'all'", () => {
      const r = normalizeRow(
        { label: "X", content: "Y", visibility: "wat", sort_order: "", is_active: "" },
        { isAdmin: true }
      );
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.payload.visibility).toBe("all");
    });

    it("skips rows missing required fields", () => {
      expect(normalizeRow({ label: "", content: "x" }, { isAdmin: true }))
        .toEqual({ ok: false, reason: "missing_required" });
      expect(normalizeRow({ label: "x", content: "" }, { isAdmin: true }))
        .toEqual({ ok: false, reason: "missing_required" });
    });

    it("forbids admin_only visibility for non-admins", () => {
      const r = normalizeRow(
        { label: "X", content: "Y", visibility: "admin_only" },
        { isAdmin: false }
      );
      expect(r).toEqual({ ok: false, reason: "forbidden_visibility" });
    });

    it("allows admin_only visibility for admins", () => {
      const r = normalizeRow(
        { label: "X", content: "Y", visibility: "admin_only" },
        { isAdmin: true }
      );
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.payload.visibility).toBe("admin_only");
    });

    it("coerces sort_order and is_active correctly", () => {
      const r = normalizeRow(
        { label: "X", content: "Y", sort_order: "7", is_active: "no", visibility: "all" },
        { isAdmin: true }
      );
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.payload.sort_order).toBe(7);
        expect(r.payload.is_active).toBe(false);
      }
      const def = normalizeRow(
        { label: "X", content: "Y", sort_order: "abc", is_active: "1", visibility: "all" },
        { isAdmin: true }
      );
      if (def.ok) {
        expect(def.payload.sort_order).toBe(0);
        expect(def.payload.is_active).toBe(true);
      }
    });
  });

  describe("planUpsert", () => {
    const existing = [
      { id: "id-net30", label: "Net 30" },
      { id: "id-warranty", label: "Warranty" },
    ];

    it("matches existing rows by label case-insensitively (update) and inserts unknown labels", () => {
      const rows = parseCsv(
        "label,content,sort_order,is_active,visibility\n" +
          "net 30,Updated copy,5,true,all\n" +
          "Brand New,Hello,0,true,team_lead_allowed\n"
      );
      const plan = planUpsert(rows, existing, { isAdmin: true });
      expect(plan.updates).toHaveLength(1);
      expect(plan.updates[0].id).toBe("id-net30");
      expect(plan.updates[0].payload.content).toBe("Updated copy");
      expect(plan.inserts).toHaveLength(1);
      expect(plan.inserts[0].label).toBe("Brand New");
      expect(plan.skipped).toHaveLength(0);
    });

    it("skips invalid + admin-only rows for non-admins", () => {
      const rows = parseCsv(
        "label,content,sort_order,is_active,visibility\n" +
          ",Missing label,0,true,all\n" +
          "Secret,Top secret,0,true,admin_only\n" +
          "Warranty,New warranty text,0,true,all\n"
      );
      const plan = planUpsert(rows, existing, { isAdmin: false });
      expect(plan.skipped.map((s) => s.reason).sort()).toEqual(
        ["forbidden_visibility", "missing_required"].sort()
      );
      expect(plan.updates).toHaveLength(1);
      expect(plan.updates[0].id).toBe("id-warranty");
      expect(plan.inserts).toHaveLength(0);
    });
  });
});
