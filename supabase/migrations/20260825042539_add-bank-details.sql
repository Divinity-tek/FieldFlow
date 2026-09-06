CREATE TABLE engineer_bank_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  engineer_id UUID NOT NULL UNIQUE REFERENCES engineers(id) ON DELETE CASCADE,
  account_holder_name TEXT NOT NULL,
  country_code TEXT NOT NULL,       -- ISO 3166-1 alpha-2, e.g. 'US', 'GB', 'IN'
  currency TEXT NOT NULL,           -- ISO 4217, e.g. 'USD', 'GBP', 'INR'
  bank_name TEXT NOT NULL,
  account_number TEXT,              -- generic local account number
  iban TEXT,                        -- for IBAN-using countries (most of EU + many others)
  swift_bic TEXT,                   -- needed for any international wire
  local_bank_code TEXT,             -- the routing/sort/IFSC/BSB/transit value itself
  local_bank_code_type TEXT,        -- label: 'routing_number' | 'sort_code' | 'ifsc' | 'bsb' | 'transit_number' | 'clabe' | 'other'
  additional_notes TEXT,            -- escape hatch for anything unusual (e.g. intermediary bank info)
  verified BOOLEAN NOT NULL DEFAULT false,
  verified_by UUID REFERENCES profiles(user_id),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);