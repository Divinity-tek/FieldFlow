alter table public.partners
add column if not exists payment_account_name text,
add column if not exists payment_iban text,
add column if not exists payment_swift_bic text,
add column if not exists payment_bank_name_address text;