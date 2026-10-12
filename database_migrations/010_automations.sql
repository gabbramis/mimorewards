-- Automatizaciones por comercio: configuración (automations), catálogo mínimo
-- de recompensas (rewards, sembrado desde el programa ya configurado en
-- businesses) e historial de ejecuciones (automation_events).
-- Fase 1: solo UI -> Supabase. Sin envíos reales, sin cron, sin integraciones.

-- Catálogo mínimo de recompensas del comercio. Hoy cada comercio tiene una
-- sola recompensa configurada en businesses(reward_description/reward_target);
-- se siembra desde ahí para que el selector use datos reales.
CREATE TABLE IF NOT EXISTS public.rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  stamps_required INT NOT NULL DEFAULT 10,
  active BOOLEAN NOT NULL DEFAULT true,
  -- La recompensa del programa (la que se edita en Configuración). Configuración
  -- la mantiene sincronizada; las futuras recompensas extra usan false.
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rewards_business ON public.rewards(business_id);

-- Por si la tabla ya se creó con una versión anterior de esta migración.
ALTER TABLE public.rewards ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false;

INSERT INTO public.rewards (business_id, name, stamps_required, is_default)
SELECT id, COALESCE(NULLIF(reward_description, ''), 'Recompensa'), COALESCE(reward_target, 10), true
FROM public.businesses
WHERE NOT EXISTS (SELECT 1 FROM public.rewards r WHERE r.business_id = businesses.id);

CREATE TABLE IF NOT EXISTS public.automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('birthday', 'inactive_customer', 'near_reward', 'reward_available', 'first_visit_followup')),
  enabled BOOLEAN NOT NULL DEFAULT false,
  channel TEXT NOT NULL DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp', 'email', 'wallet')),
  trigger_config JSONB NOT NULL DEFAULT '{}',
  message_template TEXT NOT NULL DEFAULT '',
  reward_id UUID REFERENCES public.rewards(id) ON DELETE SET NULL,
  send_time TIME,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, type)
);
CREATE INDEX IF NOT EXISTS idx_automations_business ON public.automations(business_id);

CREATE TABLE IF NOT EXISTS public.automation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id UUID REFERENCES public.automations(id) ON DELETE SET NULL,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  channel TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  provider_message_id TEXT,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_automation_events_business ON public.automation_events(business_id);
CREATE INDEX IF NOT EXISTS idx_automation_events_automation ON public.automation_events(automation_id);

ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rewards_scope ON public.rewards;
CREATE POLICY rewards_scope ON public.rewards
  FOR ALL USING (public.can_access_business(business_id))
  WITH CHECK (public.can_access_business(business_id));

DROP POLICY IF EXISTS automations_scope ON public.automations;
CREATE POLICY automations_scope ON public.automations
  FOR ALL USING (public.can_access_business(business_id))
  WITH CHECK (public.can_access_business(business_id));

DROP POLICY IF EXISTS automation_events_scope ON public.automation_events;
CREATE POLICY automation_events_scope ON public.automation_events
  FOR ALL USING (public.can_access_business(business_id))
  WITH CHECK (public.can_access_business(business_id));
