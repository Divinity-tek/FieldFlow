
-- Add new statuses
ALTER TYPE public.ticket_status ADD VALUE IF NOT EXISTS 'new' BEFORE 'open';
ALTER TYPE public.ticket_status ADD VALUE IF NOT EXISTS 'assigned' BEFORE 'in_progress';
