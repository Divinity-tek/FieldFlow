import { DollarSign, TrendingUp } from "lucide-react";

type Source = {
  base_pay?: number | null;
  transport_allowance?: number | null;
  food_allowance?: number | null;
  convenience_allowance?: number | null;
  partner_split_percent?: number | null;
  platform_split_percent?: number | null;
  // Optional server-computed values (from DB trigger). When present, used as the source of truth.
  gross_payout?: number | null;
  partner_cut?: number | null;
  platform_cut?: number | null;
  engineer_net?: number | null;
};

export function computePayout(s: Source) {
  const base = Number(s.base_pay ?? 0);
  const transport = Number(s.transport_allowance ?? 0);
  const food = Number(s.food_allowance ?? 0);
  const convenience = Number(s.convenience_allowance ?? 0);

  const partnerPct = Math.min(Math.max(Number(s.partner_split_percent ?? 0), 0), 100);
  let platformPct = Math.min(Math.max(Number(s.platform_split_percent ?? 0), 0), 100);
  if (partnerPct + platformPct > 100) platformPct = 100 - partnerPct;

  // Prefer server-stored gross when available, else compute
  const gross = s.gross_payout != null ? Number(s.gross_payout) : base + transport + food + convenience;
  const partnerCut = s.partner_cut != null ? Number(s.partner_cut) : (gross * partnerPct) / 100;
  const platformCut = s.platform_cut != null ? Number(s.platform_cut) : (gross * platformPct) / 100;
  const engineerNet = s.engineer_net != null ? Number(s.engineer_net) : gross - partnerCut - platformCut;
  const platformMarginPct = gross > 0 ? (platformCut / gross) * 100 : 0;

  return { base, transport, food, convenience, gross, partnerCut, platformCut, engineerNet, partnerPct, platformPct, platformMarginPct };
}

const fmt = (n: number) => `$${n.toFixed(2)}`;

export default function PayoutBreakdown({ source, compact = false }: { source: Source; compact?: boolean }) {
  const p = computePayout(source);
  const rows: { label: string; value: number; muted?: boolean }[] = [
    { label: "Base pay", value: p.base },
    { label: "Transport", value: p.transport, muted: p.transport === 0 },
    { label: "Food", value: p.food, muted: p.food === 0 },
    { label: "Convenience", value: p.convenience, muted: p.convenience === 0 },
  ];

  return (
    <div className={compact ? "text-xs space-y-1" : "text-sm space-y-1.5"}>
      {rows.map((r) => (
        <div key={r.label} className={`flex justify-between ${r.muted ? "text-muted-foreground" : ""}`}>
          <span>{r.label}</span>
          <span>{fmt(r.value)}</span>
        </div>
      ))}
      <div className="flex justify-between font-medium border-t pt-1">
        <span>Gross total</span>
        <span>{fmt(p.gross)}</span>
      </div>
      <div className={`flex justify-between ${p.partnerCut === 0 ? "text-muted-foreground" : ""}`}>
        <span>− Partner split ({p.partnerPct}%)</span>
        <span>−{fmt(p.partnerCut)}</span>
      </div>
      <div className={`flex justify-between ${p.platformCut === 0 ? "text-muted-foreground" : ""}`}>
        <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3" />Platform margin ({p.platformPct}%)</span>
        <span>−{fmt(p.platformCut)}</span>
      </div>
      <div className="flex justify-between font-semibold border-t pt-1 text-primary">
        <span className="flex items-center gap-1"><DollarSign className="h-3.5 w-3.5" />Engineer net</span>
        <span>{fmt(p.engineerNet)}</span>
      </div>
    </div>
  );
}
