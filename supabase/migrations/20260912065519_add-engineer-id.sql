ALTER TABLE engineers
ADD COLUMN employee_id text;

ALTER TABLE engineers
ADD CONSTRAINT engineers_employee_id_unique UNIQUE (employee_id);