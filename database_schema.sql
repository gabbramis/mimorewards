-- businesses
CREATE TABLE businesses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE,
    name TEXT NOT NULL,
    logo_url TEXT,
    active BOOLEAN NOT NULL DEFAULT true,
    reward_target INT DEFAULT 10,
    reward_description TEXT
);

-- customers
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unique_code TEXT UNIQUE NOT NULL,
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    phone TEXT,
    birthdate DATE,
    current_stamps INT DEFAULT 0,
    total_visits INT DEFAULT 0,
    last_visit_at TIMESTAMPTZ DEFAULT now(),
    apple_push_token TEXT,
    google_object_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for quick lookup
CREATE INDEX idx_customers_unique_code ON customers(unique_code);
CREATE INDEX idx_customers_phone ON customers(phone);

-- NFC stands resolve a physical support to a business/program.
CREATE TABLE nfc_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nfc_id TEXT UNIQUE NOT NULL,
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    label TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- One digital loyalty card per customer and business.
CREATE TABLE loyalty_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    current_stamps INT DEFAULT 0,
    wallet_status TEXT DEFAULT 'PENDING',
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (customer_id, business_id)
);

-- stamp_logs
CREATE TABLE stamp_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    method TEXT CHECK (method IN ('QR', 'NFC', 'MANUAL')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- automation_rules
CREATE TABLE automation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    rule_type TEXT NOT NULL, -- e.g., 'BIRTHDAY', 'INACTIVE'
    days_margin INT,
    message_template TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- automation_logs
CREATE TABLE automation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    rule_id UUID REFERENCES automation_rules(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'SENT',
    sent_at TIMESTAMPTZ DEFAULT now()
);
