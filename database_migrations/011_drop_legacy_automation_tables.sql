-- Limpieza del prototipo anterior de automatizaciones (superadmin, con
-- business hardcodeado). Reemplazado por automations + automation_events (010).
-- El borrado en cascada de automation_events por customer_id ya está cubierto
-- por su FK ON DELETE CASCADE, igual que el caso anterior.
DROP TABLE IF EXISTS public.automation_logs;
DROP TABLE IF EXISTS public.automation_rules;
