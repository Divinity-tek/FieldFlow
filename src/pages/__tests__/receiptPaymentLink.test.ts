import { describe, it, expect, beforeEach } from "vitest";

/**
 * Verifies the concurrency guard used in Receipts.tsx when linking a
 * payment-received record to a newly created receipt.
 *
 * The production code performs:
 *   sb.from("client_invoice_payments")
 *     .update({ receipt_id, linked_at })
 *     .eq("id", paymentId)
 *     .is("receipt_id", null)
 *     .select("id")
 *
 * This test simulates two simultaneous receipt creations racing to link the
 * same payment, and asserts that only one of them succeeds.
 */

type Row = { id: string; receipt_id: string | null; linked_at: string | null };

// Minimal in-memory supabase-like client honoring our conditional update
function createFakeClient(initial: Row[]) {
  // Simulated single-row store
  const store = new Map<string, Row>(initial.map((r) => [r.id, { ...r }]));

  return {
    from(_table: string) {
      const filters: { id?: string; receiptIdNull?: boolean } = {};
      let pendingUpdate: Partial<Row> | null = null;

      const api: any = {
        update(values: Partial<Row>) {
          pendingUpdate = values;
          return api;
        },
        eq(col: string, val: string) {
          if (col === "id") filters.id = val;
          return api;
        },
        is(col: string, val: null) {
          if (col === "receipt_id" && val === null) filters.receiptIdNull = true;
          return api;
        },
        select(_cols: string) {
          // Execute the conditional update atomically
          const row = filters.id ? store.get(filters.id) : undefined;
          if (!row) return Promise.resolve({ data: [], error: null });
          if (filters.receiptIdNull && row.receipt_id !== null) {
            return Promise.resolve({ data: [], error: null });
          }
          Object.assign(row, pendingUpdate);
          store.set(row.id, row);
          return Promise.resolve({ data: [{ id: row.id }], error: null });
        },
      };
      return api;
    },
    _store: store,
  };
}

async function tryLinkPayment(sb: any, paymentId: string, receiptId: string) {
  const { data, error } = await sb
    .from("client_invoice_payments")
    .update({ receipt_id: receiptId, linked_at: new Date().toISOString() })
    .eq("id", paymentId)
    .is("receipt_id", null)
    .select("id");
  return { linked: !error && Array.isArray(data) && data.length > 0, error };
}

describe("payment-received linking concurrency", () => {
  let sb: ReturnType<typeof createFakeClient>;
  const PAYMENT_ID = "pmt-1";

  beforeEach(() => {
    sb = createFakeClient([{ id: PAYMENT_ID, receipt_id: null, linked_at: null }]);
  });

  it("only one of two simultaneous receipt creations links the same payment", async () => {
    const [a, b] = await Promise.all([
      tryLinkPayment(sb, PAYMENT_ID, "receipt-A"),
      tryLinkPayment(sb, PAYMENT_ID, "receipt-B"),
    ]);

    const successes = [a, b].filter((r) => r.linked);
    expect(successes.length).toBe(1);

    const stored = (sb as any)._store.get(PAYMENT_ID) as Row;
    expect(stored.receipt_id).not.toBeNull();
    expect(["receipt-A", "receipt-B"]).toContain(stored.receipt_id);
  });

  it("a subsequent attempt against an already-linked payment is rejected", async () => {
    const first = await tryLinkPayment(sb, PAYMENT_ID, "receipt-A");
    const second = await tryLinkPayment(sb, PAYMENT_ID, "receipt-B");

    expect(first.linked).toBe(true);
    expect(second.linked).toBe(false);

    const stored = (sb as any)._store.get(PAYMENT_ID) as Row;
    expect(stored.receipt_id).toBe("receipt-A");
  });

  it("ten concurrent attempts result in exactly one successful link", async () => {
    const attempts = Array.from({ length: 10 }, (_, i) =>
      tryLinkPayment(sb, PAYMENT_ID, `receipt-${i}`)
    );
    const results = await Promise.all(attempts);
    expect(results.filter((r) => r.linked).length).toBe(1);
  });
});
