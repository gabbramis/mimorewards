-- 013_wallet_devices.sql
-- Almacena los dispositivos registrados para recibir notificaciones APNs de Apple Wallet

CREATE TABLE IF NOT EXISTS public.wallet_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_library_identifier TEXT NOT NULL,
    pass_type_identifier TEXT NOT NULL,
    serial_number TEXT NOT NULL,
    push_token TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (device_library_identifier, pass_type_identifier, serial_number)
);

CREATE INDEX IF NOT EXISTS idx_wallet_devices_serial 
ON public.wallet_devices(serial_number);

CREATE INDEX IF NOT EXISTS idx_wallet_devices_lookup 
ON public.wallet_devices(device_library_identifier, pass_type_identifier);

-- Habilitar RLS
ALTER TABLE public.wallet_devices ENABLE ROW LEVEL SECURITY;

-- Política para que el service_role tenga control total
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'wallet_devices' AND policyname = 'wallet_devices_admin_all'
    ) THEN
        CREATE POLICY wallet_devices_admin_all ON public.wallet_devices
            FOR ALL
            TO service_role
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;

-- Asegurar que loyalty_cards tenga columna updated_at y trigger para auto-actualizarse
ALTER TABLE public.loyalty_cards 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE OR REPLACE FUNCTION public.set_loyalty_card_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_loyalty_cards_updated_at ON public.loyalty_cards;
CREATE TRIGGER trg_loyalty_cards_updated_at
BEFORE UPDATE ON public.loyalty_cards
FOR EACH ROW
EXECUTE FUNCTION public.set_loyalty_card_updated_at();
