-- Consentimiento del cliente al crear una tarjeta. Los registros previos quedan
-- sin opt-in promocional; no se infiere consentimiento de tener un teléfono.
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS legal_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS legal_version TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_marketing_opt_in BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_marketing_opt_in_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.customers'::regclass
      AND conname = 'customers_whatsapp_marketing_consent_consistent'
  ) THEN
    ALTER TABLE public.customers
      ADD CONSTRAINT customers_whatsapp_marketing_consent_consistent
      CHECK (
        (whatsapp_marketing_opt_in = true AND whatsapp_marketing_opt_in_at IS NOT NULL)
        OR (whatsapp_marketing_opt_in = false)
      );
  END IF;
END $$;

