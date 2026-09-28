-- Canje transaccional de recompensas.
-- Ejecutar después de 005_customer_scope.sql.

CREATE TABLE IF NOT EXISTS public.reward_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  reward_description TEXT NOT NULL,
  stamps_redeemed INTEGER NOT NULL,
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reward_redemptions_customer_business
  ON public.reward_redemptions (customer_id, business_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_reward_redemptions_idempotency_key
  ON public.reward_redemptions (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE public.reward_redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reward_redemptions_read_scope ON public.reward_redemptions;
CREATE POLICY reward_redemptions_read_scope ON public.reward_redemptions
  FOR SELECT USING (public.can_access_business(business_id));

CREATE OR REPLACE FUNCTION public.redeem_loyalty_reward(
  p_customer_id UUID,
  p_business_id UUID,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS TABLE (
  accepted BOOLEAN,
  reason TEXT,
  current_stamps INTEGER,
  target_stamps INTEGER,
  redemption_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active BOOLEAN;
  v_target INTEGER;
  v_current INTEGER;
  v_description TEXT;
  v_redemption_id UUID;
BEGIN
  IF p_idempotency_key IS NOT NULL THEN
    SELECT rr.id INTO v_redemption_id
    FROM public.reward_redemptions rr
    WHERE rr.idempotency_key = p_idempotency_key
    LIMIT 1;

    IF v_redemption_id IS NOT NULL THEN
      SELECT c.current_stamps, COALESCE(b.reward_target, 10)
        INTO v_current, v_target
        FROM public.customers c
        JOIN public.businesses b ON b.id = c.business_id
       WHERE c.id = p_customer_id AND c.business_id = p_business_id;

      RETURN QUERY SELECT TRUE, 'already_processed', COALESCE(v_current, 0), COALESCE(v_target, 10), v_redemption_id;
      RETURN;
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_customer_id::TEXT || ':' || p_business_id::TEXT, 0)
  );

  SELECT c.current_stamps, b.active, COALESCE(b.reward_target, 10), COALESCE(b.reward_description, 'Recompensa disponible')
    INTO v_current, v_active, v_target, v_description
    FROM public.customers c
    JOIN public.businesses b ON b.id = c.business_id
   WHERE c.id = p_customer_id AND c.business_id = p_business_id
   FOR UPDATE;

  IF v_current IS NULL THEN
    RETURN QUERY SELECT FALSE, 'customer_not_found', 0, COALESCE(v_target, 10), NULL::UUID;
    RETURN;
  END IF;

  IF v_active IS DISTINCT FROM TRUE THEN
    RETURN QUERY SELECT FALSE, 'business_inactive', v_current, v_target, NULL::UUID;
    RETURN;
  END IF;

  IF v_current < v_target THEN
    RETURN QUERY SELECT FALSE, 'insufficient_stamps', v_current, v_target, NULL::UUID;
    RETURN;
  END IF;

  INSERT INTO public.reward_redemptions (
    customer_id, business_id, reward_description, stamps_redeemed, idempotency_key
  )
  VALUES (p_customer_id, p_business_id, v_description, v_current, p_idempotency_key)
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_redemption_id;

  IF v_redemption_id IS NULL AND p_idempotency_key IS NOT NULL THEN
    SELECT rr.id INTO v_redemption_id
    FROM public.reward_redemptions rr
    WHERE rr.idempotency_key = p_idempotency_key
    LIMIT 1;
    RETURN QUERY SELECT TRUE, 'already_processed', 0, v_target, v_redemption_id;
    RETURN;
  END IF;

  UPDATE public.customers
     SET current_stamps = 0
   WHERE id = p_customer_id AND business_id = p_business_id;

  UPDATE public.loyalty_cards
     SET current_stamps = 0
   WHERE customer_id = p_customer_id AND business_id = p_business_id;

  RETURN QUERY SELECT TRUE, 'redeemed', 0, v_target, v_redemption_id;
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_loyalty_reward(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_loyalty_reward(UUID, UUID, TEXT) TO service_role;
