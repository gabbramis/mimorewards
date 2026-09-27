-- Agrega estado y link NFC estable para cada negocio.
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;
CREATE UNIQUE INDEX IF NOT EXISTS businesses_slug_key ON businesses(slug) WHERE slug IS NOT NULL;
