ALTER TABLE public.dispatch_agent_actions ADD COLUMN IF NOT EXISTS idempotency_key text;
CREATE UNIQUE INDEX IF NOT EXISTS dispatch_agent_actions_idempotency_key_uidx
  ON public.dispatch_agent_actions (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE public.dispatch_agent_approvals ADD COLUMN IF NOT EXISTS idempotency_key text;
CREATE UNIQUE INDEX IF NOT EXISTS dispatch_agent_approvals_idempotency_key_uidx
  ON public.dispatch_agent_approvals (idempotency_key)
  WHERE idempotency_key IS NOT NULL;