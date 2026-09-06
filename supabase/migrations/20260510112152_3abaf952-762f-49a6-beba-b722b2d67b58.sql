ALTER TABLE public.job_events DROP CONSTRAINT IF EXISTS job_events_kind_check;
ALTER TABLE public.job_events ADD CONSTRAINT job_events_kind_check
  CHECK (kind = ANY (ARRAY[
    'travel_start','arrived','started','paused','resumed','completed','note',
    'customer_signed','proof_uploaded',
    'escalation_ack','dispatch_notified','eta_updated','reassign_requested'
  ]));