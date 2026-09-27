-- Control de acceso de mimo.
-- Antes de ejecutar: si tu compañero ya creó una tabla de perfiles/roles,
-- usen esa tabla y no dupliquen este modelo.

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'merchant' CHECK (role IN ('superadmin', 'merchant', 'staff')),
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.business_members (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'merchant' CHECK (role IN ('merchant', 'staff')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, business_id)
);

CREATE INDEX IF NOT EXISTS idx_business_members_user ON public.business_members(user_id);
CREATE INDEX IF NOT EXISTS idx_business_members_business ON public.business_members(business_id);

CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'superadmin'
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_business(target_business_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_superadmin()
    OR EXISTS (
      SELECT 1 FROM public.business_members
      WHERE user_id = auth.uid() AND business_id = target_business_id
    );
$$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nfc_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_read_own ON public.profiles;
CREATE POLICY profiles_read_own ON public.profiles
  FOR SELECT USING (id = auth.uid() OR public.is_superadmin());

DROP POLICY IF EXISTS business_members_read_scope ON public.business_members;
CREATE POLICY business_members_read_scope ON public.business_members
  FOR SELECT USING (user_id = auth.uid() OR public.is_superadmin());

DROP POLICY IF EXISTS business_members_manage_superadmin ON public.business_members;
CREATE POLICY business_members_manage_superadmin ON public.business_members
  FOR ALL USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

DROP POLICY IF EXISTS businesses_read_scope ON public.businesses;
CREATE POLICY businesses_read_scope ON public.businesses
  FOR SELECT USING (public.can_access_business(id));

DROP POLICY IF EXISTS businesses_manage_superadmin ON public.businesses;
CREATE POLICY businesses_manage_superadmin ON public.businesses
  FOR ALL USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

DROP POLICY IF EXISTS nfc_tags_read_scope ON public.nfc_tags;
CREATE POLICY nfc_tags_read_scope ON public.nfc_tags
  FOR SELECT USING (public.can_access_business(business_id));

DROP POLICY IF EXISTS nfc_tags_manage_superadmin ON public.nfc_tags;
CREATE POLICY nfc_tags_manage_superadmin ON public.nfc_tags
  FOR ALL USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

GRANT EXECUTE ON FUNCTION public.is_superadmin() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_access_business(UUID) TO anon, authenticated, service_role;

-- Después de obtener el UUID desde Authentication > Users:
-- INSERT INTO public.profiles (id, role, display_name)
-- VALUES ('UUID_DEL_USUARIO', 'superadmin', 'Equipo mimo')
-- ON CONFLICT (id) DO UPDATE SET role = 'superadmin';
