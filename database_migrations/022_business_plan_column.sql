-- 022_business_plan_column.sql
-- Agrega columna 'plan' (FREE, PRO, BLACK) y sincroniza con 'plan_type' (inicial, pro, black)

ALTER TABLE public.businesses
ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'FREE';

UPDATE public.businesses
SET plan = CASE 
  WHEN plan_type = 'pro' THEN 'PRO'
  WHEN plan_type = 'black' THEN 'BLACK'
  ELSE 'FREE'
END
WHERE plan IS NULL;

CREATE OR REPLACE FUNCTION sync_business_plan_columns()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.plan IS DISTINCT FROM OLD.plan THEN
    IF UPPER(NEW.plan) = 'PRO' THEN
      NEW.plan_type := 'pro';
      NEW.plan := 'PRO';
    ELSIF UPPER(NEW.plan) = 'BLACK' THEN
      NEW.plan_type := 'black';
      NEW.plan := 'BLACK';
    ELSE
      NEW.plan_type := 'inicial';
      NEW.plan := 'FREE';
    END IF;
  ELSIF NEW.plan_type IS DISTINCT FROM OLD.plan_type THEN
    IF LOWER(NEW.plan_type) = 'pro' THEN
      NEW.plan := 'PRO';
    ELSIF LOWER(NEW.plan_type) = 'black' THEN
      NEW.plan := 'BLACK';
    ELSE
      NEW.plan := 'FREE';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_business_plan_columns ON public.businesses;
CREATE TRIGGER trg_sync_business_plan_columns
BEFORE INSERT OR UPDATE ON public.businesses
FOR EACH ROW
EXECUTE FUNCTION sync_business_plan_columns();
