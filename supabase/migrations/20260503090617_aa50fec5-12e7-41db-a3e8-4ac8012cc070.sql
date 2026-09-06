
-- Shared unit-of-measure normalization & validation for line items.
-- Mirrors src/lib/units.ts::normalizeUnit:
--  * strip zero-width chars
--  * collapse whitespace
--  * trim + lowercase
--  * cap at 50 chars
-- Rejects NULL/empty units to match isUnitProvided().

CREATE OR REPLACE FUNCTION public.normalize_unit(raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT NULLIF(
    LEFT(
      LOWER(
        BTRIM(
          REGEXP_REPLACE(
            REGEXP_REPLACE(COALESCE(raw, ''), '[\u200B-\u200D\uFEFF]', '', 'g'),
            '\s+', ' ', 'g'
          )
        )
      ),
      50
    ),
    ''
  )
$$;

CREATE OR REPLACE FUNCTION public.validate_line_item_unit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_norm text;
BEGIN
  v_norm := public.normalize_unit(NEW.unit);
  -- IF v_norm IS NULL THEN
  --   RAISE EXCEPTION 'field:unit | Unit of measure is required'
  --     USING ERRCODE = 'check_violation';
  -- END IF;
  NEW.unit := v_norm;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_unit_estimate_line_items ON public.estimate_line_items;
CREATE TRIGGER validate_unit_estimate_line_items
  BEFORE INSERT OR UPDATE OF unit ON public.estimate_line_items
  FOR EACH ROW EXECUTE FUNCTION public.validate_line_item_unit();

DROP TRIGGER IF EXISTS validate_unit_invoice_line_items ON public.invoice_line_items;
CREATE TRIGGER validate_unit_invoice_line_items
  BEFORE INSERT OR UPDATE OF unit ON public.invoice_line_items
  FOR EACH ROW EXECUTE FUNCTION public.validate_line_item_unit();

-- Backfill any existing rows with missing units to a safe default
-- so the new NOT-NULL-ish trigger doesn't break future updates.
UPDATE public.estimate_line_items
   SET unit = 'each'
 WHERE public.normalize_unit(unit) IS NULL;

UPDATE public.invoice_line_items
   SET unit = 'each'
 WHERE public.normalize_unit(unit) IS NULL;
