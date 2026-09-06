
drop policy "engineer_insert_own_payout" on "public"."engineer_payouts";

drop policy "engineer_view_own_payouts" on "public"."engineer_payouts";

alter table "public"."engineer_payouts" drop constraint "engineer_payouts_job_id_fkey";

alter table "public"."engineer_payouts" drop constraint "engineer_payouts_reviewed_by_fkey";

alter table "public"."engineer_payouts" alter column "status" drop default;

alter table "public"."engineer_payouts" alter column status type "public"."payout_status" using status::text::"public"."payout_status";

alter table "public"."engineer_payouts" alter column "status" set default 'pending'::public.payout_status;

alter table "public"."engineer_payouts" drop column "description";

alter table "public"."engineer_payouts" drop column "job_id";

alter table "public"."engineer_payouts" drop column "review_notes";

alter table "public"."engineer_payouts" drop column "reviewed_at";

alter table "public"."engineer_payouts" drop column "reviewed_by";




alter table "public"."projects" add column if not exists "estimate_id" uuid;

CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_estimate_id ON public.projects USING btree (estimate_id) WHERE (estimate_id IS NOT NULL);

-- alter table "public"."projects" add constraint "projects_estimate_id_fkey" FOREIGN KEY (estimate_id) REFERENCES public.estimates(id) not valid;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_constraint 
    WHERE conname = 'projects_estimate_id_fkey'
  ) THEN
    ALTER TABLE "public"."projects" 
      ADD CONSTRAINT "projects_estimate_id_fkey" 
      FOREIGN KEY (estimate_id) REFERENCES public.estimates(id) NOT VALID;
  END IF;
END $$;

alter table "public"."projects" validate constraint "projects_estimate_id_fkey";