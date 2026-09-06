alter table invoices
add column if not exists sent_at timestamptz;