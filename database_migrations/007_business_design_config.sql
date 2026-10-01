-- Agrega color primario para diseño dinámico de tarjetas y restricciones al target
ALTER TABLE businesses ADD COLUMN primary_color TEXT DEFAULT '#E84538';
ALTER TABLE businesses ALTER COLUMN reward_description SET DEFAULT '1 Café o producto gratis';
ALTER TABLE businesses ADD CONSTRAINT check_reward_target CHECK (reward_target >= 4 AND reward_target <= 15);
