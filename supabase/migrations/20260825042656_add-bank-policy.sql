ALTER TABLE engineer_bank_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY engineer_manage_own_bank_details ON engineer_bank_details
  FOR ALL
  USING (EXISTS (SELECT 1 FROM engineers WHERE engineers.id = engineer_bank_details.engineer_id AND engineers.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM engineers WHERE engineers.id = engineer_bank_details.engineer_id AND engineers.user_id = auth.uid()));

CREATE POLICY admin_view_bank_details ON engineer_bank_details
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));