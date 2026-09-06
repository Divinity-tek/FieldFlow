ALTER TABLE public.job_payout_claims REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.job_payout_claims;