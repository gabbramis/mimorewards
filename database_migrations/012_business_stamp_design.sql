-- Diseño editable; los clientes y sus saldos permanecen en sus tablas actuales.
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS card_text_color TEXT NOT NULL DEFAULT '#FFFFFF',
  ADD COLUMN IF NOT EXISTS card_accent_color TEXT NOT NULL DEFAULT '#FFFFFF',
  ADD COLUMN IF NOT EXISTS stamp_source TEXT,
  ADD COLUMN IF NOT EXISTS stamp_catalog_id TEXT,
  ADD COLUMN IF NOT EXISTS stamp_completed_url TEXT,
  ADD COLUMN IF NOT EXISTS stamp_pending_url TEXT,
  ADD COLUMN IF NOT EXISTS stamp_pending_effect JSONB;

ALTER TABLE businesses ADD CONSTRAINT businesses_stamp_source_check
  CHECK (stamp_source IS NULL OR stamp_source IN ('collection', 'custom', 'logo'));
