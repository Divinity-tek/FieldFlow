set check_function_bodies = off;

drop extension if exists "pg_net";

create extension if not exists "pg_net" with schema "public";

drop view if exists "public"."jobs_engineer_safe";

drop view if exists "public"."marketplace_listings_engineer_safe";

alter table "public"."jobs" alter column "payout_status" drop default;

alter table "public"."marketplace_listings" alter column "payout_status" drop default;

alter type "public"."payout_status" rename to "payout_status__old_version_to_be_dropped";

create type "public"."payout_status" as enum ('pending', 'processing', 'completed', 'failed');

alter table "public"."jobs" alter column payout_status type "public"."payout_status" using payout_status::text::"public"."payout_status";

alter table "public"."marketplace_listings" alter column payout_status type "public"."payout_status" using payout_status::text::"public"."payout_status";

alter table "public"."jobs" alter column "payout_status" set default 'pending'::public.payout_status;

alter table "public"."marketplace_listings" alter column "payout_status" set default 'pending'::public.payout_status;

drop type "public"."payout_status__old_version_to_be_dropped";
