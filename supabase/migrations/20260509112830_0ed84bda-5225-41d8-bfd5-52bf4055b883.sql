-- Helper: check if a numeric value changed (treats NULL/0 equivalently)
CREATE OR REPLACE FUNCTION public._payout_changed(old_val numeric, new_val numeric)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(old_val, 0) IS DISTINCT FROM COALESCE(new_val, 0);
$$;

-- Enforcement function for jobs
CREATE OR REPLACE FUNCTION public.enforce_job_payout_role()
RETURNS TRIGGER AS $$
DECLARE
  uid uuid := auth.uid();
  is_admin boolean;
  is_team_lead boolean;
  is_partner boolean;
  is_engineer boolean;
  is_owner boolean;
  changed_allowances boolean;
  changed_partner_split boolean;
  changed_platform_split boolean;
BEGIN
  -- Skip for service-role / no-auth contexts (e.g. background jobs, triggers)
  IF uid IS NULL THEN RETURN NEW; END IF;

  changed_allowances := public._payout_changed(OLD.transport_allowance, NEW.transport_allowance)
                     OR public._payout_changed(OLD.food_allowance, NEW.food_allowance)
                     OR public._payout_changed(OLD.convenience_allowance, NEW.convenience_allowance);
  changed_partner_split := public._payout_changed(OLD.partner_split_percent, NEW.partner_split_percent);
  changed_platform_split := public._payout_changed(OLD.platform_split_percent, NEW.platform_split_percent);

  -- If nothing payout-related changed, allow
  IF NOT (changed_allowances OR changed_partner_split OR changed_platform_split) THEN
    RETURN NEW;
  END IF;

  is_admin := public.has_role(uid, 'admin'::public.app_role);
  IF is_admin THEN RETURN NEW; END IF;

  is_team_lead := public.has_role(uid, 'team_lead'::public.app_role);
  is_partner := public.has_role(uid, 'partner'::public.app_role);
  is_engineer := public.has_role(uid, 'engineer'::public.app_role);
  is_owner := OLD.created_by = uid;

  -- Engineers can never change payout fields
  IF is_engineer AND NOT (is_admin OR is_team_lead OR is_partner) THEN
    RAISE EXCEPTION 'Engineers cannot edit payout amounts. Submit an expense claim instead.';
  END IF;

  -- Platform fee: admin only
  IF changed_platform_split THEN
    RAISE EXCEPTION 'Only admins can change the platform fee percentage.';
  END IF;

  -- Partner: can only edit own jobs
  IF is_partner AND NOT (is_team_lead) AND NOT is_owner THEN
    RAISE EXCEPTION 'Partners can only edit payout fields on jobs they created.';
  END IF;

  -- Team lead and partner (on own jobs) may edit allowances + partner split
  IF is_team_lead OR (is_partner AND is_owner) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'You do not have permission to edit payout fields on this job.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS jobs_enforce_payout_role ON public.jobs;
CREATE TRIGGER jobs_enforce_payout_role
BEFORE UPDATE ON public.jobs
FOR EACH ROW EXECUTE FUNCTION public.enforce_job_payout_role();

-- Enforcement function for marketplace listings (no created_by; resolve owner via job)
CREATE OR REPLACE FUNCTION public.enforce_listing_payout_role()
RETURNS TRIGGER AS $$
DECLARE
  uid uuid := auth.uid();
  is_admin boolean;
  is_team_lead boolean;
  is_partner boolean;
  is_engineer boolean;
  job_owner uuid;
  is_owner boolean;
  changed_allowances boolean;
  changed_partner_split boolean;
  changed_platform_split boolean;
  changed_pay boolean;
BEGIN
  IF uid IS NULL THEN RETURN NEW; END IF;

  changed_allowances := public._payout_changed(OLD.transport_allowance, NEW.transport_allowance)
                     OR public._payout_changed(OLD.food_allowance, NEW.food_allowance)
                     OR public._payout_changed(OLD.convenience_allowance, NEW.convenience_allowance);
  changed_partner_split := public._payout_changed(OLD.partner_split_percent, NEW.partner_split_percent);
  changed_platform_split := public._payout_changed(OLD.platform_split_percent, NEW.platform_split_percent);
  changed_pay := public._payout_changed(OLD.posted_pay, NEW.posted_pay);

  IF NOT (changed_allowances OR changed_partner_split OR changed_platform_split OR changed_pay) THEN
    RETURN NEW;
  END IF;

  is_admin := public.has_role(uid, 'admin'::public.app_role);
  IF is_admin THEN RETURN NEW; END IF;

  is_team_lead := public.has_role(uid, 'team_lead'::public.app_role);
  is_partner := public.has_role(uid, 'partner'::public.app_role);
  is_engineer := public.has_role(uid, 'engineer'::public.app_role);

  IF is_engineer AND NOT (is_team_lead OR is_partner) THEN
    RAISE EXCEPTION 'Engineers cannot edit listing payout amounts.';
  END IF;

  IF changed_platform_split THEN
    RAISE EXCEPTION 'Only admins can change the platform fee percentage.';
  END IF;

  IF is_partner AND NOT is_team_lead THEN
    SELECT created_by INTO job_owner FROM public.jobs WHERE id = NEW.job_id;
    is_owner := job_owner = uid;
    IF NOT is_owner THEN
      RAISE EXCEPTION 'Partners can only edit listings for jobs they created.';
    END IF;
  END IF;

  IF is_team_lead OR is_partner THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'You do not have permission to edit payout fields on this listing.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS listings_enforce_payout_role ON public.marketplace_listings;
CREATE TRIGGER listings_enforce_payout_role
BEFORE UPDATE ON public.marketplace_listings
FOR EACH ROW EXECUTE FUNCTION public.enforce_listing_payout_role();

-- Same enforcement on INSERT for listings (admins set platform fee at posting time)
CREATE OR REPLACE FUNCTION public.enforce_listing_payout_role_insert()
RETURNS TRIGGER AS $$
DECLARE
  uid uuid := auth.uid();
  is_admin boolean;
BEGIN
  IF uid IS NULL THEN RETURN NEW; END IF;
  is_admin := public.has_role(uid, 'admin'::public.app_role);
  IF NOT is_admin AND COALESCE(NEW.platform_split_percent, 0) > 0 THEN
    RAISE EXCEPTION 'Only admins can set the platform fee percentage on a listing.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS listings_enforce_payout_role_insert ON public.marketplace_listings;
CREATE TRIGGER listings_enforce_payout_role_insert
BEFORE INSERT ON public.marketplace_listings
FOR EACH ROW EXECUTE FUNCTION public.enforce_listing_payout_role_insert();