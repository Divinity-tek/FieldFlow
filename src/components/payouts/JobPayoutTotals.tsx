import { Receipt, Wallet } from "lucide-react";

const fmt = (n: number) => `$${Number(n || 0).toFixed(2)}`;

/**
 * Per-job totals footer — visually separates the engineer payout net
 * from the approved reimbursable claims and shows their sum.
 */
export default function JobPayoutTotals({
  engineerNet,
  approvedClaims,
  pendingClaims = 0,
  compact = false,
}: {
  engineerNet: number;
  approvedClaims: number;
  pendingClaims?: number;
  compact?: boolean;
}) {
  const total = Number(engineerNet || 0) + Number(approvedClaims || 0);
  const text = compact ? "text-xs" : "text-sm";

  return (
    <div className={`rounded-md border border-border bg-muted/40 p-2.5 space-y-1 ${text}`}>
      <div className="flex justify-between">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Wallet className="w-3.5 h-3.5" /> Payout net
        </span>
        <span>{fmt(engineerNet)}</span>
      </div>
      <div className="flex justify-between">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Receipt className="w-3.5 h-3.5" /> Approved reimbursements
        </span>
        <span>+{fmt(approvedClaims)}</span>
      </div>
      {pendingClaims > 0 && (
        <div className="flex justify-between text-muted-foreground italic">
          <span>(pending claims, not included)</span>
          <span>{fmt(pendingClaims)}</span>
        </div>
      )}
      <div className="flex justify-between font-semibold border-t pt-1 text-primary">
        <span>Total payable</span>
        <span>{fmt(total)}</span>
      </div>
    </div>
  );
}
