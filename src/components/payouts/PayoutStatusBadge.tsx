import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, CircleDollarSign } from "lucide-react";
import { format } from "date-fns";

export type PayoutStatus = "pending" | "partially_paid" | "paid";

export interface PayoutStatusSource {
  payout_status?: PayoutStatus | string | null;
  payout_paid_amount?: number | null;
  payout_approved_at?: string | null;
  payout_paid_at?: string | null;
  engineer_net?: number | null;
}

const META: Record<PayoutStatus, { label: string; icon: any; cls: string }> = {
  paid: {
    label: "Paid",
    icon: CheckCircle2,
    cls: "bg-green-500/15 text-green-600 border-green-500/30",
  },
  partially_paid: {
    label: "Partially paid",
    icon: CircleDollarSign,
    cls: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  },
  pending: {
    label: "Pending",
    icon: Clock,
    cls: "bg-muted text-muted-foreground border-border",
  },
};

const fmt = (n: number) => `$${Number(n || 0).toFixed(2)}`;

export default function PayoutStatusBadge({
  source,
  showTimestamps = false,
  className = "",
}: {
  source: PayoutStatusSource;
  showTimestamps?: boolean;
  className?: string;
}) {
  const status = (source.payout_status as PayoutStatus) ?? "pending";
  const meta = META[status] ?? META.pending;
  const Icon = meta.icon;
  const paid = Number(source.payout_paid_amount ?? 0);
  const net = Number(source.engineer_net ?? 0);

  return (
    <div className={`space-y-1 ${className}`}>
      <Badge variant="outline" className={`gap-1 ${meta.cls}`}>
        <Icon className="w-3 h-3" />
        {meta.label}
        {status === "partially_paid" && net > 0 && (
          <span className="opacity-80">· {fmt(paid)} / {fmt(net)}</span>
        )}
      </Badge>
      {showTimestamps && (source.payout_approved_at || source.payout_paid_at) && (
        <div className="text-[11px] text-muted-foreground space-y-0.5">
          {source.payout_approved_at && (
            <div>Approved {format(new Date(source.payout_approved_at), "PP p")}</div>
          )}
          {source.payout_paid_at && (
            <div>Paid {format(new Date(source.payout_paid_at), "PP p")}</div>
          )}
        </div>
      )}
    </div>
  );
}
