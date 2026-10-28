-- 020_business_plan_type.sql
-- Plan de suscripción por comercio. 'inicial' limita a 100 clientes; 'pro' y 'black' sin límite.

ALTER TABLE public.businesses
ADD COLUMN IF NOT EXISTS plan_type TEXT NOT NULL DEFAULT 'inicial';

ALTER TABLE public.businesses
DROP CONSTRAINT IF EXISTS businesses_plan_type_check;

ALTER TABLE public.businesses
ADD CONSTRAINT businesses_plan_type_check CHECK (plan_type IN ('inicial', 'pro', 'black'));
