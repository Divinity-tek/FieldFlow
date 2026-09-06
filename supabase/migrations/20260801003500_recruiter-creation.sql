ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'recruiter';

CREATE TABLE job_recruiters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  recruiter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT now(),
  assigned_by UUID REFERENCES profiles(id),
  UNIQUE (job_id, recruiter_id)
);


CREATE TYPE nomination_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE candidate_nominations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  recruiter_id UUID NOT NULL REFERENCES profiles(id),
  candidate_name TEXT NOT NULL,
  candidate_email TEXT,
  candidate_phone TEXT,
  resume_url TEXT,
  notes TEXT,
  status nomination_status NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);


-- Recruiters can only see jobs they're assigned to
CREATE POLICY recruiter_view_jobs ON jobs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM job_recruiters
      WHERE job_recruiters.job_id = jobs.id
      AND job_recruiters.recruiter_id = auth.uid()
    )
  );

-- Recruiters can nominate only for jobs they're assigned to
CREATE POLICY recruiter_insert_nomination ON candidate_nominations FOR INSERT
  WITH CHECK (
    recruiter_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM job_recruiters
      WHERE job_recruiters.job_id = candidate_nominations.job_id
      AND job_recruiters.recruiter_id = auth.uid()
    )
  );

-- Recruiters can view their own nominations, but not edit status
CREATE POLICY recruiter_view_own_nominations ON candidate_nominations FOR SELECT
  USING (recruiter_id = auth.uid());