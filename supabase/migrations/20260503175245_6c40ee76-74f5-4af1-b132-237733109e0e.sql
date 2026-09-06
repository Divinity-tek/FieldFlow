ALTER TABLE public.receipts
  ADD COLUMN IF NOT EXISTS refunded_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refunded_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS refund_reason text,
  ADD COLUMN IF NOT EXISTS recurrence text,
  ADD COLUMN IF NOT EXISTS recurrence_next_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS recurrence_active boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_receipts_paid_at ON public.receipts(paid_at);
CREATE INDEX IF NOT EXISTS idx_receipts_recurrence ON public.receipts(recurrence_active, recurrence_next_at);
