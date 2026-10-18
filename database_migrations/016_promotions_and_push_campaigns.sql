-- 016_promotions_and_push_campaigns.sql
-- Migración para soporte nativo de promociones, multiplicador de sellos y notificaciones push duales (Apple y Google Wallet)

-- 1. Businesses campaign & google wallet fields
ALTER TABLE public.businesses
ADD COLUMN IF NOT EXISTS stamp_multiplier INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS active_campaign_name TEXT,
ADD COLUMN IF NOT EXISTS active_campaign_message TEXT,
ADD COLUMN IF NOT EXISTS campaign_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS google_wallet_class_id TEXT;

-- 2. Customers / Loyalty cards wallet identifiers
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS google_wallet_object_id TEXT,
ADD COLUMN IF NOT EXISTS wallet_platform TEXT;

-- Sync existing google_object_id to google_wallet_object_id if present
UPDATE public.customers
SET google_wallet_object_id = google_object_id
WHERE google_wallet_object_id IS NULL AND google_object_id IS NOT NULL;

ALTER TABLE public.loyalty_cards
ADD COLUMN IF NOT EXISTS google_wallet_object_id TEXT,
ADD COLUMN IF NOT EXISTS wallet_platform TEXT;

-- 3. Apple Wallet official web service registrations
CREATE TABLE IF NOT EXISTS public.wallet_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
    device_library_identifier TEXT NOT NULL,
    push_token TEXT NOT NULL,
    pass_type_identifier TEXT NOT NULL,
    serial_number TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT wallet_registrations_device_pass_serial_key UNIQUE (device_library_identifier, pass_type_identifier, serial_number)
);

CREATE INDEX IF NOT EXISTS idx_wallet_registrations_device ON public.wallet_registrations(device_library_identifier);
CREATE INDEX IF NOT EXISTS idx_wallet_registrations_serial ON public.wallet_registrations(serial_number);
CREATE INDEX IF NOT EXISTS idx_wallet_registrations_business ON public.wallet_registrations(business_id);
CREATE INDEX IF NOT EXISTS idx_wallet_registrations_customer ON public.wallet_registrations(customer_id);

ALTER TABLE public.wallet_registrations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'wallet_registrations' AND policyname = 'wallet_registrations_admin_all'
    ) THEN
        CREATE POLICY wallet_registrations_admin_all ON public.wallet_registrations
            FOR ALL
            TO service_role
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;

-- 4. Push campaigns log
CREATE TABLE IF NOT EXISTS public.push_campaigns_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    campaign_type TEXT NOT NULL,
    message TEXT NOT NULL,
    apple_devices_notified INTEGER NOT NULL DEFAULT 0,
    google_passes_notified INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_campaigns_log_business ON public.push_campaigns_log(business_id);
CREATE INDEX IF NOT EXISTS idx_push_campaigns_log_created_at ON public.push_campaigns_log(created_at DESC);

ALTER TABLE public.push_campaigns_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'push_campaigns_log' AND policyname = 'push_campaigns_log_admin_all'
    ) THEN
        CREATE POLICY push_campaigns_log_admin_all ON public.push_campaigns_log
            FOR ALL
            TO service_role
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'push_campaigns_log' AND policyname = 'push_campaigns_log_merchant_select'
    ) THEN
        CREATE POLICY push_campaigns_log_merchant_select ON public.push_campaigns_log
            FOR SELECT
            TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM public.businesses b
                    WHERE b.id = push_campaigns_log.business_id AND b.user_id = auth.uid()
                )
                OR
                EXISTS (
                    SELECT 1 FROM public.business_members bm
                    WHERE bm.business_id = push_campaigns_log.business_id AND bm.user_id = auth.uid()
                )
            );
    END IF;
END $$;

-- 5. Add stamps_added to stamp_logs
ALTER TABLE public.stamp_logs
ADD COLUMN IF NOT EXISTS stamps_added INTEGER NOT NULL DEFAULT 1;

-- 6. Update record_loyalty_stamp with multiplier logic
CREATE OR REPLACE FUNCTION public.record_loyalty_stamp(
  p_customer_id UUID,
  p_business_id UUID,
  p_method TEXT DEFAULT 'NFC',
  p_idempotency_key TEXT DEFAULT NULL,
  p_cooldown_minutes INTEGER DEFAULT 180,
  p_enforce_cooldown BOOLEAN DEFAULT TRUE
)
RETURNS TABLE (
  accepted BOOLEAN,
  reason TEXT,
  current_stamps INTEGER,
  target_stamps INTEGER,
  log_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_active BOOLEAN;
  v_target INTEGER;
  v_multiplier INTEGER;
  v_campaign_expires_at TIMESTAMPTZ;
  v_stamps_to_add INTEGER := 1;
  v_current INTEGER;
  v_last_stamp TIMESTAMPTZ;
  v_new_total INTEGER;
  v_log_id UUID;
  v_now TIMESTAMPTZ := now();
BEGIN
  IF p_method NOT IN ('NFC', 'QR', 'MANUAL') THEN
    RETURN QUERY SELECT FALSE, 'invalid_method', 0, 0, NULL::UUID;
    RETURN;
  END IF;

  -- La clave hace que un retry del mismo request sea inocuo.
  IF p_idempotency_key IS NOT NULL THEN
    SELECT sl.id
      INTO v_log_id
      FROM public.stamp_logs sl
     WHERE sl.idempotency_key = p_idempotency_key
     LIMIT 1;

    IF v_log_id IS NOT NULL THEN
      SELECT c.current_stamps, COALESCE(b.reward_target, 10)
        INTO v_current, v_target
        FROM public.customers c
        JOIN public.businesses b ON b.id = c.business_id
       WHERE c.id = p_customer_id
         AND c.business_id = p_business_id;

      RETURN QUERY SELECT TRUE, 'already_processed', COALESCE(v_current, 0), COALESCE(v_target, 10), v_log_id;
      RETURN;
    END IF;
  END IF;

  -- Serializa intentos simultáneos del mismo cliente dentro del negocio.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_customer_id::TEXT || ':' || p_business_id::TEXT, 0)
  );

  SELECT b.active, COALESCE(b.reward_target, 10), COALESCE(b.stamp_multiplier, 1), b.campaign_expires_at
    INTO v_business_active, v_target, v_multiplier, v_campaign_expires_at
    FROM public.businesses b
   WHERE b.id = p_business_id;

  IF v_business_active IS DISTINCT FROM TRUE THEN
    RETURN QUERY SELECT FALSE, 'business_inactive', 0, COALESCE(v_target, 10), NULL::UUID;
    RETURN;
  END IF;

  -- Chequear si la campaña está vigente y tiene multiplicador activo
  IF v_campaign_expires_at IS NOT NULL AND v_campaign_expires_at > v_now AND v_multiplier > 1 THEN
    v_stamps_to_add := v_multiplier;
  ELSE
    v_stamps_to_add := 1;
  END IF;

  SELECT c.current_stamps
    INTO v_current
    FROM public.customers c
   WHERE c.id = p_customer_id
     AND c.business_id = p_business_id
   FOR UPDATE;

  IF v_current IS NULL THEN
    RETURN QUERY SELECT FALSE, 'customer_not_found', 0, v_target, NULL::UUID;
    RETURN;
  END IF;

  IF p_enforce_cooldown THEN
    SELECT sl.created_at
      INTO v_last_stamp
      FROM public.stamp_logs sl
     WHERE sl.customer_id = p_customer_id
       AND sl.business_id = p_business_id
       AND sl.method IN ('NFC', 'QR')
     ORDER BY sl.created_at DESC
     LIMIT 1;

    IF v_last_stamp IS NOT NULL
       AND v_last_stamp > v_now - make_interval(mins => GREATEST(p_cooldown_minutes, 0)) THEN
      RETURN QUERY SELECT FALSE, 'cooldown', v_current, v_target, NULL::UUID;
      RETURN;
    END IF;
  END IF;

  IF v_current >= v_target THEN
    RETURN QUERY SELECT FALSE, 'reward_pending', v_current, v_target, NULL::UUID;
    RETURN;
  END IF;

  v_new_total := LEAST(v_current + v_stamps_to_add, v_target);

  UPDATE public.customers
     SET current_stamps = v_new_total,
         total_visits = COALESCE(total_visits, 0) + 1,
         last_visit_at = v_now
   WHERE id = p_customer_id;

  INSERT INTO public.stamp_logs (customer_id, business_id, method, idempotency_key, stamps_added)
  VALUES (p_customer_id, p_business_id, p_method, p_idempotency_key, v_stamps_to_add)
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_log_id;

  -- Si otra petición ganó la clave durante un retry, no se vuelve a contar.
  IF v_log_id IS NULL AND p_idempotency_key IS NOT NULL THEN
    SELECT sl.id
      INTO v_log_id
      FROM public.stamp_logs sl
     WHERE sl.idempotency_key = p_idempotency_key
     LIMIT 1;
  END IF;

  UPDATE public.loyalty_cards
     SET current_stamps = v_new_total,
         updated_at = v_now
   WHERE customer_id = p_customer_id
     AND business_id = p_business_id;

  RETURN QUERY SELECT TRUE, 'stamped', v_new_total, v_target, v_log_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_loyalty_stamp(UUID, UUID, TEXT, TEXT, INTEGER, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_loyalty_stamp(UUID, UUID, TEXT, TEXT, INTEGER, BOOLEAN) TO service_role;
