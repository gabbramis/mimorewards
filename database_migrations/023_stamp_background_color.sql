-- 023_stamp_background_color.sql
-- Agrega la columna stamp_background_color en public.businesses para personalizar
-- el color sólido de la franja de sellos cuando no se utiliza una imagen de banner.

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS stamp_background_color TEXT DEFAULT '#FF1F2D';

-- Inicializar comercios existentes con su primary_color si stamp_background_color es nulo
UPDATE public.businesses
SET stamp_background_color = COALESCE(primary_color, '#FF1F2D')
WHERE stamp_background_color IS NULL;

