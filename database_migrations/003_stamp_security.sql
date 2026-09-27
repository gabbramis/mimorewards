-- Sello centralizado y protegido contra duplicados.
-- Ejecutar después de 001_nfc_flow.sql y sobre el esquema existente.

ALTER TABLE public.stamp_logs
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_stamp_logs_customer_business_created
  ON public.stamp_logs (customer_id, business_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_stamp_logs_idempotency_key
  ON public.stamp_logs (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Una única operación para NFC, QR y sellado manual.
-- El endpoint que la llama debe validar el rol del usuario antes de invocarla.
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

  SELECT b.active, COALESCE(b.reward_target, 10)
    INTO v_business_active, v_target
    FROM public.businesses b
   WHERE b.id = p_business_id;

  IF v_business_active IS DISTINCT FROM TRUE THEN
    RETURN QUERY SELECT FALSE, 'business_inactive', 0, COALESCE(v_target, 10), NULL::UUID;
    RETURN;
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

  v_new_total := LEAST(v_current + 1, v_target);

  UPDATE public.customers
     SET current_stamps = v_new_total,
         total_visits = COALESCE(total_visits, 0) + 1,
         last_visit_at = v_now
   WHERE id = p_customer_id;

  INSERT INTO public.stamp_logs (customer_id, business_id, method, idempotency_key)
  VALUES (p_customer_id, p_business_id, p_method, p_idempotency_key)
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
     SET current_stamps = v_new_total
   WHERE customer_id = p_customer_id
     AND business_id = p_business_id;

  RETURN QUERY SELECT TRUE, 'stamped', v_new_total, v_target, v_log_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_loyalty_stamp(UUID, UUID, TEXT, TEXT, INTEGER, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_loyalty_stamp(UUID, UUID, TEXT, TEXT, INTEGER, BOOLEAN) TO service_role;
