-- Wallet proximity pilot. Does not change stamps, rewards or campaign rules.
BEGIN;

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS wallet_locations_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS wallet_location_revision INTEGER NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.can_manage_wallet_locations(p_business_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_superadmin() OR EXISTS (
    SELECT 1 FROM public.business_members
    WHERE user_id = auth.uid() AND business_id = p_business_id AND role = 'merchant'
  );
$$;
REVOKE ALL ON FUNCTION public.can_manage_wallet_locations(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_wallet_locations(UUID) TO authenticated, service_role;

-- Each row is a physical branch location shared by all passes of this business.
-- Branch-specific users/card assignment are intentionally not enabled in this pilot.
CREATE TABLE IF NOT EXISTS public.branch_wallet_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  address TEXT NOT NULL CHECK (length(btrim(address)) BETWEEN 1 AND 250),
  latitude DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  enabled BOOLEAN NOT NULL DEFAULT false,
  apple_relevant_text TEXT NOT NULL DEFAULT '' CHECK (length(apple_relevant_text) <= 120)
);
CREATE INDEX IF NOT EXISTS branch_wallet_locations_business_idx ON public.branch_wallet_locations(business_id);
ALTER TABLE public.branch_wallet_locations ENABLE ROW LEVEL SECURITY;
-- All mutations go through the atomic server-only RPC below.
REVOKE ALL ON public.branch_wallet_locations FROM anon, authenticated;
GRANT SELECT ON public.branch_wallet_locations TO authenticated;
GRANT ALL ON public.branch_wallet_locations TO service_role;
DROP POLICY IF EXISTS branch_wallet_locations_read ON public.branch_wallet_locations;
CREATE POLICY branch_wallet_locations_read ON public.branch_wallet_locations
  FOR SELECT TO authenticated USING (public.can_manage_wallet_locations(business_id));

CREATE TABLE IF NOT EXISTS public.wallet_location_sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('apple', 'google')),
  target_key TEXT NOT NULL,
  push_token TEXT,
  pass_type_identifier TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'accepted', 'failed', 'skipped')),
  attempts INTEGER NOT NULL DEFAULT 0,
  available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  lease_token UUID,
  locked_until TIMESTAMPTZ,
  error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  UNIQUE (business_id, revision, channel, target_key)
);
CREATE INDEX IF NOT EXISTS wallet_location_sync_due_idx ON public.wallet_location_sync_jobs(status, available_at);
ALTER TABLE public.wallet_location_sync_jobs ENABLE ROW LEVEL SECURITY;
-- Contains private device tokens. Clients only receive sanitized API summaries.
REVOKE ALL ON public.wallet_location_sync_jobs FROM anon, authenticated;
GRANT ALL ON public.wallet_location_sync_jobs TO service_role;

CREATE OR REPLACE FUNCTION public.save_wallet_locations(
  p_business_id UUID, p_enabled BOOLEAN, p_expected_revision INTEGER, p_locations JSONB
) RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_revision INTEGER;
BEGIN
  SELECT wallet_location_revision INTO v_revision FROM public.businesses WHERE id = p_business_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'business_not_found'; END IF;
  IF v_revision <> p_expected_revision THEN RAISE EXCEPTION 'revision_conflict'; END IF;
  IF jsonb_typeof(p_locations) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'invalid_locations'; END IF;
  IF jsonb_array_length(p_locations) > 10 THEN RAISE EXCEPTION 'too_many_locations'; END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_locations) x
    JOIN public.branch_wallet_locations l ON l.id = (x->>'id')::UUID
    WHERE l.business_id <> p_business_id
  ) THEN RAISE EXCEPTION 'location_scope_mismatch'; END IF;

  DELETE FROM public.branch_wallet_locations WHERE business_id = p_business_id;
  INSERT INTO public.branch_wallet_locations(id, business_id, name, address, latitude, longitude, enabled, apple_relevant_text)
  SELECT (x->>'id')::UUID, p_business_id, x->>'name', x->>'address',
    (x->>'latitude')::DOUBLE PRECISION, (x->>'longitude')::DOUBLE PRECISION,
    (x->>'enabled')::BOOLEAN, x->>'appleRelevantText'
  FROM jsonb_array_elements(p_locations) x;

  v_revision := v_revision + 1;
  UPDATE public.businesses SET wallet_locations_enabled = p_enabled, wallet_location_revision = v_revision WHERE id = p_business_id;
  -- Make iOS download the new pass when it receives the empty APNs update.
  UPDATE public.loyalty_cards SET updated_at = now() WHERE business_id = p_business_id;

  INSERT INTO public.wallet_location_sync_jobs(business_id, revision, channel, target_key)
  VALUES (p_business_id, v_revision, 'google', 'class');
  INSERT INTO public.wallet_location_sync_jobs(business_id, revision, channel, target_key, push_token, pass_type_identifier)
  SELECT DISTINCT p_business_id, v_revision, 'apple', md5(d.push_token || ':' || d.pass_type_identifier), d.push_token, d.pass_type_identifier
  FROM (
    SELECT r.push_token, r.pass_type_identifier FROM public.wallet_registrations r
    JOIN public.loyalty_cards c ON c.id::TEXT = r.serial_number AND c.business_id = p_business_id
    WHERE r.business_id = p_business_id OR r.business_id IS NULL
    UNION
    SELECT d.push_token, d.pass_type_identifier FROM public.wallet_devices d
    JOIN public.loyalty_cards c ON c.id::TEXT = d.serial_number WHERE c.business_id = p_business_id
  ) d WHERE length(d.push_token) > 0;
  RETURN v_revision;
END;
$$;
REVOKE ALL ON FUNCTION public.save_wallet_locations(UUID, BOOLEAN, INTEGER, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_wallet_locations(UUID, BOOLEAN, INTEGER, JSONB) TO service_role;

CREATE OR REPLACE FUNCTION public.claim_wallet_location_jobs(p_business_id UUID DEFAULT NULL)
RETURNS SETOF public.wallet_location_sync_jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- A crashed final attempt must become visibly failed, never stay processing forever.
  UPDATE public.wallet_location_sync_jobs SET status = 'failed', error_code = 'worker_timeout', locked_until = NULL
    WHERE status = 'processing' AND locked_until < now() AND attempts >= 3
      AND (p_business_id IS NULL OR business_id = p_business_id);
  RETURN QUERY
  WITH due AS (
    SELECT id FROM public.wallet_location_sync_jobs
    WHERE (p_business_id IS NULL OR business_id = p_business_id)
      AND NOT EXISTS (SELECT 1 FROM public.wallet_location_sync_jobs busy
        WHERE busy.business_id = wallet_location_sync_jobs.business_id
          AND busy.status = 'processing' AND busy.locked_until >= now())
      AND pg_try_advisory_xact_lock(hashtextextended(business_id::TEXT || ':wallet-location-sync', 0))
      AND attempts < 3 AND available_at <= now()
      AND (status = 'pending' OR (status = 'processing' AND locked_until < now()))
    ORDER BY created_at, id FOR UPDATE SKIP LOCKED LIMIT 10
  )
  UPDATE public.wallet_location_sync_jobs j
    SET status = 'processing', attempts = attempts + 1, lease_token = gen_random_uuid(), locked_until = now() + interval '5 minutes'
    FROM due WHERE j.id = due.id RETURNING j.*;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_wallet_location_jobs(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_wallet_location_jobs(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.wallet_location_sync_summary(p_business_id UUID, p_revision INTEGER)
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'counts', COALESCE((SELECT jsonb_object_agg(status, total) FROM (
      SELECT status, count(*) AS total FROM public.wallet_location_sync_jobs
      WHERE business_id = p_business_id AND revision = p_revision GROUP BY status
    ) counts), '{}'::JSONB),
    'errors', COALESCE((SELECT jsonb_agg(e) FROM (
      SELECT channel, error_code, attempts, status FROM public.wallet_location_sync_jobs
      WHERE business_id = p_business_id AND revision = p_revision AND error_code IS NOT NULL
      ORDER BY created_at DESC LIMIT 20
    ) e), '[]'::JSONB)
  );
$$;
REVOKE ALL ON FUNCTION public.wallet_location_sync_summary(UUID, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wallet_location_sync_summary(UUID, INTEGER) TO service_role;
COMMIT;
