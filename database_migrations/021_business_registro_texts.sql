-- 021_business_registro_texts.sql
-- Textos personalizables de la pantalla pública de registro del cliente.

ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS registro_subtitulo TEXT NOT NULL DEFAULT 'TU TARJETA EMPIEZA ACÁ';
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS registro_titulo TEXT NOT NULL DEFAULT 'Cada visita cuenta.';
