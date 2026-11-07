-- 024_next_client_sequence.sql
-- Implementa el sistema de IDs visuales 100% numéricos y secuenciales por negocio (default 15001)

-- 1. Agregar columna next_client_sequence a public.businesses
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS next_client_sequence INTEGER NOT NULL DEFAULT 15001;

-- 2. Reemplazar restricción global de unique_code por restricción única por negocio (business_id, unique_code)
-- para que cada comercio pueda llevar su propio conteo independiente desde 15001.
ALTER TABLE public.customers
  DROP CONSTRAINT IF EXISTS customers_unique_code_key;

DROP INDEX IF EXISTS public.customers_unique_code_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_business_unique_code
  ON public.customers (business_id, unique_code);

-- 3. Migrar códigos existentes con formato CLI-* a secuencia numérica por negocio (15001, 15002...)
WITH numbered_customers AS (
  SELECT
    id,
    business_id,
    (15000 + ROW_NUMBER() OVER (PARTITION BY business_id ORDER BY created_at ASC, id ASC))::TEXT AS new_code
  FROM public.customers
)
UPDATE public.customers c
SET unique_code = nc.new_code
FROM numbered_customers nc
WHERE c.id = nc.id
  AND (c.unique_code IS NULL OR c.unique_code LIKE 'CLI%');

-- 4. Actualizar next_client_sequence en cada negocio según la cantidad actual de clientes
UPDATE public.businesses b
SET next_client_sequence = GREATEST(
  15001,
  15001 + COALESCE((
    SELECT COUNT(*)::INTEGER
    FROM public.customers c
    WHERE c.business_id = b.id
  ), 0)
);

