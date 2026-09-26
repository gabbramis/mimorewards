-- Mimo NFC entry flow: run this migration against the existing Supabase project.

CREATE TABLE IF NOT EXISTS nfc_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nfc_id TEXT UNIQUE NOT NULL,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  label TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS loyalty_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  current_stamps INT DEFAULT 0,
  wallet_status TEXT DEFAULT 'PENDING',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (customer_id, business_id)
);
