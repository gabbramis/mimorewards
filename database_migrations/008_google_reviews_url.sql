-- Agregar columna para Enlace de Reseñas Google Maps
ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS google_reviews_url text;
