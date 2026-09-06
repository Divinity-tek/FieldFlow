ALTER TABLE public.client_invoice_payments
  ADD COLUMN IF NOT EXISTS receipt_id uuid REFERENCES public.receipts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS linked_at timestamp with time zone;
CREATE INDEX IF NOT EXISTS idx_client_pmt_receipt ON public.client_invoice_payments(receipt_id);