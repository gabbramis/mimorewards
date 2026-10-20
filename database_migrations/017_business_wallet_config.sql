-- Personalización de Apple Wallet / Google Wallet (logo, banner, textos y código de escaneo).
-- Los colores siguen en primary_color, card_text_color y card_accent_color.
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS wallet_config JSONB NOT NULL DEFAULT '{}'::jsonb;
