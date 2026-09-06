
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS sla_risk boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS job_reassigned boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS job_cancelled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS escalation boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS quiet_hours_allow_critical boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS push_role_client boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS push_role_engineer boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS push_role_team_lead boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS push_role_admin boolean NOT NULL DEFAULT true;
