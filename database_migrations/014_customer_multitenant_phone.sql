-- 014_customer_multitenant_phone.sql
-- Aislamiento multi-tenant: Permitir que un mismo teléfono opere en distintos comercios
-- Eliminando unicidad global sobre el teléfono y estableciendo unicidad compuesta (business_id, phone).

-- 1. Eliminar cualquier constraint UNIQUE aplicada únicamente sobre la columna 'phone' o 'phone_number'
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Buscar constraints únicas sobre la columna phone
    FOR r IN (
        SELECT c.conname
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        JOIN pg_namespace n ON t.relnamespace = n.oid
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
        WHERE n.nspname = 'public'
          AND t.relname = 'customers'
          AND c.contype = 'u'
          AND array_length(c.conkey, 1) = 1
          AND a.attname IN ('phone', 'phone_number')
    ) LOOP
        EXECUTE 'ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
        RAISE NOTICE 'Constraint eliminada: %', r.conname;
    END LOOP;
END $$;

-- 2. Eliminar índices únicos sobre phone solo si existen
DROP INDEX IF EXISTS public.customers_phone_key;
DROP INDEX IF EXISTS public.customers_phone_number_key;
DROP INDEX IF EXISTS public.idx_customers_phone_unique;
DROP INDEX IF EXISTS public.idx_customers_phone_number_unique;

-- 3. Crear índice único compuesto por comercio y teléfono (solo para teléfonos no nulos)
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_business_phone_unique
ON public.customers (business_id, phone)
WHERE phone IS NOT NULL;

-- 4. Asegurar la constraint UNIQUE (business_id, phone) a nivel de tabla
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'public.customers'::regclass 
          AND conname = 'customers_business_id_phone_key'
    ) THEN
        ALTER TABLE public.customers 
        ADD CONSTRAINT customers_business_id_phone_key UNIQUE (business_id, phone);
    END IF;
EXCEPTION
    WHEN duplicate_table OR duplicate_object THEN
        NULL;
END $$;

-- 5. Crear índice para optimizar búsquedas de clientes por comercio y teléfono
CREATE INDEX IF NOT EXISTS idx_customers_business_id_phone
ON public.customers (business_id, phone);
