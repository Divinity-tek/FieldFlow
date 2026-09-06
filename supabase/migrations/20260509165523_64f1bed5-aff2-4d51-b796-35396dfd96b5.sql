CREATE OR REPLACE FUNCTION public.validate_engineer_identity_upload()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  obj RECORD;
  allowed_image TEXT[] := ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/heic','image/heif'];
  allowed_id    TEXT[] := ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/heic','image/heif','application/pdf'];
  max_bytes BIGINT := 10 * 1024 * 1024;
  owner_prefix TEXT;
BEGIN
  -- Selfie validation
  IF NEW.identity_selfie_url IS NOT NULL
     AND NEW.identity_selfie_url IS DISTINCT FROM COALESCE(OLD.identity_selfie_url, '') THEN
    SELECT * INTO obj FROM storage.objects
      WHERE bucket_id = 'engineer-documents' AND name = NEW.identity_selfie_url;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Identity selfie file not found in storage';
    END IF;
    IF COALESCE((obj.metadata->>'size')::BIGINT, 0) > max_bytes THEN
      RAISE EXCEPTION 'Identity selfie exceeds 10 MB limit';
    END IF;
    IF NOT ((obj.metadata->>'mimetype') = ANY(allowed_image)) THEN
      RAISE EXCEPTION 'Identity selfie must be an image (JPG, PNG, WEBP, or HEIC)';
    END IF;
    SELECT user_id::text INTO owner_prefix FROM public.engineers WHERE id = NEW.id;
    IF split_part(NEW.identity_selfie_url, '/', 1) <> owner_prefix THEN
      RAISE EXCEPTION 'Identity selfie must be in the engineer''s own folder';
    END IF;
  END IF;

  -- ID card validation
  IF NEW.id_card_url IS NOT NULL
     AND NEW.id_card_url IS DISTINCT FROM COALESCE(OLD.id_card_url, '') THEN
    SELECT * INTO obj FROM storage.objects
      WHERE bucket_id = 'engineer-documents' AND name = NEW.id_card_url;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'ID card file not found in storage';
    END IF;
    IF COALESCE((obj.metadata->>'size')::BIGINT, 0) > max_bytes THEN
      RAISE EXCEPTION 'ID card exceeds 10 MB limit';
    END IF;
    IF NOT ((obj.metadata->>'mimetype') = ANY(allowed_id)) THEN
      RAISE EXCEPTION 'ID card must be an image or PDF';
    END IF;
    SELECT user_id::text INTO owner_prefix FROM public.engineers WHERE id = NEW.id;
    IF split_part(NEW.id_card_url, '/', 1) <> owner_prefix THEN
      RAISE EXCEPTION 'ID card must be in the engineer''s own folder';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_engineer_identity_upload_trg ON public.engineers;
CREATE TRIGGER validate_engineer_identity_upload_trg
BEFORE INSERT OR UPDATE OF identity_selfie_url, id_card_url ON public.engineers
FOR EACH ROW EXECUTE FUNCTION public.validate_engineer_identity_upload();