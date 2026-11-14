-- 025_merchant_notifications.sql
-- Tabla de notificaciones operativas para el panel del comercio (Dashboard / Caja)

CREATE TABLE IF NOT EXISTS public.merchant_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('success', 'error', 'prize')),
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_merchant_notifications_business_created
  ON public.merchant_notifications (business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_merchant_notifications_business_unread
  ON public.merchant_notifications (business_id, is_read)
  WHERE is_read = false;

ALTER TABLE public.merchant_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS merchant_notifications_scope ON public.merchant_notifications;
CREATE POLICY merchant_notifications_scope ON public.merchant_notifications
  FOR ALL USING (public.can_access_business(business_id))
  WITH CHECK (public.can_access_business(business_id));

