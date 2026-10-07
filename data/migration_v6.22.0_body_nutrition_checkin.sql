-- ==============================================================================
-- LIFE HUB — MODULE BODY: NUTRITION & WEEKLY CHECK-IN (v6.22.0)
-- Bảng nhật ký dinh dưỡng, món đã lưu, nước uống và check-in tuần
-- ==============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.body_meal_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  local_date DATE NOT NULL,
  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  name TEXT NOT NULL,
  calories INTEGER NOT NULL CHECK (calories >= 0),
  protein NUMERIC(5,1) DEFAULT 0 CHECK (protein >= 0),
  carbs NUMERIC(5,1) DEFAULT 0 CHECK (carbs >= 0),
  fat NUMERIC(5,1) DEFAULT 0 CHECK (fat >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_body_meal_logs_id_user UNIQUE (id, user_id)
);

CREATE TABLE IF NOT EXISTS public.body_saved_meals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  calories INTEGER NOT NULL CHECK (calories >= 0),
  protein NUMERIC(5,1) DEFAULT 0 CHECK (protein >= 0),
  carbs NUMERIC(5,1) DEFAULT 0 CHECK (carbs >= 0),
  fat NUMERIC(5,1) DEFAULT 0 CHECK (fat >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_body_saved_meals_id_user UNIQUE (id, user_id)
);

CREATE TABLE IF NOT EXISTS public.body_water_logs (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  local_date DATE NOT NULL,
  cups_count SMALLINT NOT NULL DEFAULT 0 CHECK (cups_count >= 0),
  PRIMARY KEY (user_id, local_date)
);

CREATE TABLE IF NOT EXISTS public.body_weekly_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_number SMALLINT NOT NULL CHECK (week_number BETWEEN 1 AND 53),
  year SMALLINT NOT NULL DEFAULT 2026,
  weight_avg NUMERIC(5,2) CHECK (weight_avg > 0),
  waist_cm NUMERIC(4,1) CHECK (waist_cm > 0),
  feel_energy SMALLINT CHECK (feel_energy BETWEEN 1 AND 5),
  feel_sleep SMALLINT CHECK (feel_sleep BETWEEN 1 AND 5),
  feel_hunger SMALLINT CHECK (feel_hunger BETWEEN 1 AND 5),
  feel_soreness SMALLINT CHECK (feel_soreness BETWEEN 1 AND 5),
  notes TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('draft', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_body_weekly_checkins_id_user UNIQUE (id, user_id),
  CONSTRAINT uq_body_weekly_checkins_user_week UNIQUE (user_id, week_number, year)
);

-- RLS
ALTER TABLE public.body_meal_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.body_saved_meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.body_water_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.body_weekly_checkins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users own meal logs" ON public.body_meal_logs;
CREATE POLICY "Users own meal logs" ON public.body_meal_logs
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users own saved meals" ON public.body_saved_meals;
CREATE POLICY "Users own saved meals" ON public.body_saved_meals
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users own water logs" ON public.body_water_logs;
CREATE POLICY "Users own water logs" ON public.body_water_logs
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users own weekly checkins" ON public.body_weekly_checkins;
CREATE POLICY "Users own weekly checkins" ON public.body_weekly_checkins
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_body_meal_logs_user_date
  ON public.body_meal_logs (user_id, local_date DESC);
CREATE INDEX IF NOT EXISTS idx_body_water_logs_user_date
  ON public.body_water_logs (user_id, local_date DESC);
CREATE INDEX IF NOT EXISTS idx_body_weekly_checkins_user_time
  ON public.body_weekly_checkins (user_id, year DESC, week_number DESC);

-- Permissions
REVOKE ALL ON public.body_meal_logs FROM anon, public;
REVOKE ALL ON public.body_saved_meals FROM anon, public;
REVOKE ALL ON public.body_water_logs FROM anon, public;
REVOKE ALL ON public.body_weekly_checkins FROM anon, public;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.body_meal_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.body_saved_meals TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.body_water_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.body_weekly_checkins TO authenticated;

COMMIT;
