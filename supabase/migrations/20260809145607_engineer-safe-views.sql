create or replace view "public"."jobs_engineer_safe" with (security_invoker = on) as  SELECT id,
    title,
    description,
    status,
    priority,
    service_type,
    client_id,
    engineer_id,
    assigned_by,
    location,
    latitude,
    longitude,
    scheduled_at,
    started_at,
    completed_at,
    notes,
    created_at,
    updated_at,
    region_id,
    geofence_radius,
    required_skills,
    is_delayed,
    delayed_at,
    delayed_reason,
    auto_reassign_enabled,
    reassign_grace_minutes,
    reassign_count,
    last_reassigned_at,
    transport_allowance,
    food_allowance,
    convenience_allowance,
    engineer_net,
    payout_status,
    payout_approved_at,
    payout_paid_at,
    payout_paid_amount
   FROM public.jobs j
  WHERE ((engineer_id IN ( SELECT e.id
           FROM public.engineers e
          WHERE (e.user_id = auth.uid()))) OR (EXISTS ( SELECT 1
           FROM (public.marketplace_applications ma
             JOIN public.engineers e ON ((e.id = ma.engineer_id)))
          WHERE ((ma.job_id = j.id) AND (e.user_id = auth.uid())))));


create or replace view "public"."marketplace_listings_engineer_safe" as  SELECT id,
    job_id,
    posted_by,
    visibility,
    posted_pay,
    pay_negotiable,
    required_certifications,
    required_skills,
    expires_at,
    status,
    view_count,
    created_at,
    updated_at,
    transport_allowance,
    food_allowance,
    convenience_allowance,
    engineer_net,
    payout_status
   FROM public.marketplace_listings l
  WHERE ((status = 'open'::text) OR (EXISTS ( SELECT 1
           FROM (public.marketplace_applications ma
             JOIN public.engineers e ON ((e.id = ma.engineer_id)))
          WHERE ((ma.listing_id = l.id) AND (e.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
           FROM (public.jobs j
             JOIN public.engineers e ON ((e.id = j.engineer_id)))
          WHERE ((j.id = l.job_id) AND (e.user_id = auth.uid())))));


DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_policies 
    WHERE tablename = 'jobs' 
      AND policyname = 'Engineers can view assigned jobs'
  ) THEN
    CREATE POLICY "Engineers can view assigned jobs" 
      ON jobs 
      FOR SELECT 
      USING (/* your existing USING expression here */
                engineer_id IN (
                SELECT e.id FROM engineers e WHERE e.user_id = auth.uid()
                )
                OR EXISTS (
                SELECT 1 FROM marketplace_applications ma
                JOIN engineers e ON e.id = ma.engineer_id
                WHERE ma.job_id = jobs.id AND e.user_id = auth.uid()
                )
            );
  END IF;
END $$;

