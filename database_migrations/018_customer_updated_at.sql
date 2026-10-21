-- 018_customer_updated_at.sql
-- Agregar columna updated_at a customers para trazabilidad y ordenamiento de tarjetas recientes

ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- Actualizar filas existentes para que tengan su created_at como updated_at inicial
UPDATE public.customers
SET updated_at = COALESCE(created_at, timezone('utc'::text, now()))
WHERE updated_at IS NULL;

-- Trigger para mantener updated_at actualizado automáticamente
CREATE OR REPLACE FUNCTION public.set_customer_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_customer_updated_at ON public.customers;
CREATE TRIGGER trg_customer_updated_at
BEFORE UPDATE ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public.set_customer_updated_at();

-- Índice para acelerar búsquedas ordenadas por updated_at
CREATE INDEX IF NOT EXISTS idx_customers_business_updated_at
ON public.customers (business_id, updated_at DESC);

-- Índice para optimizar recuperación priorizando sellos acumulados y última actividad
CREATE INDEX IF NOT EXISTS idx_customers_business_stamps
ON public.customers (business_id, current_stamps DESC, updated_at DESC);
