-- Alcance de datos para superadmin y usuarios asignados a un comercio.
-- El alta pública y los sellos pasan por endpoints server-only/service_role.

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stamp_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customers_read_scope ON public.customers;
CREATE POLICY customers_read_scope ON public.customers
  FOR SELECT USING (public.can_access_business(business_id));

DROP POLICY IF EXISTS customers_update_scope ON public.customers;
CREATE POLICY customers_update_scope ON public.customers
  FOR UPDATE USING (public.can_access_business(business_id))
  WITH CHECK (public.can_access_business(business_id));

DROP POLICY IF EXISTS loyalty_cards_read_scope ON public.loyalty_cards;
CREATE POLICY loyalty_cards_read_scope ON public.loyalty_cards
  FOR SELECT USING (public.can_access_business(business_id));

DROP POLICY IF EXISTS loyalty_cards_update_scope ON public.loyalty_cards;
CREATE POLICY loyalty_cards_update_scope ON public.loyalty_cards
  FOR UPDATE USING (public.can_access_business(business_id))
  WITH CHECK (public.can_access_business(business_id));

DROP POLICY IF EXISTS stamp_logs_read_scope ON public.stamp_logs;
CREATE POLICY stamp_logs_read_scope ON public.stamp_logs
  FOR SELECT USING (public.can_access_business(business_id));

DROP POLICY IF EXISTS automation_rules_scope ON public.automation_rules;
CREATE POLICY automation_rules_scope ON public.automation_rules
  FOR ALL USING (public.can_access_business(business_id))
  WITH CHECK (public.can_access_business(business_id));

DROP POLICY IF EXISTS automation_logs_read_scope ON public.automation_logs;
CREATE POLICY automation_logs_read_scope ON public.automation_logs
  FOR SELECT USING (public.can_access_business(business_id));
