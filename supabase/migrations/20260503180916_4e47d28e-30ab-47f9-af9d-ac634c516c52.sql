-- Sync receipt numbering format with invoice format: PREFIX-YYYYMMDD-XXXX
CREATE OR REPLACE FUNCTION public.set_receipt_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.receipt_number IS NULL OR NEW.receipt_number = '' THEN
    NEW.receipt_number := 'RCP-' || to_char(now(), 'YYYYMMDD') || '-' || substr(gen_random_uuid()::text, 1, 4);
  END IF;
  RETURN NEW;
END $$;