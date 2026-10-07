-- ==============================================================================
-- LIFE HUB — MODULE BODY: BIOMETRICS & MEASUREMENTS (v6.22.0)
-- Bảng đo đạc sinh trắc học và hồ sơ thể trạng
-- ==============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.body_measurements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  measured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  local_date DATE NOT NULL,
  time_slot TEXT NOT NULL DEFAULT 'morning' CHECK (time_slot IN ('morning', 'evening', 'any')),
  weight NUMERIC(5,2) NOT NULL CHECK (weight > 0),
  body_fat_pct NUMERIC(4,1) CHECK (body_fat_pct >= 0 AND body_fat_pct <= 100),
  skeletal_muscle_kg NUMERIC(4,1) CHECK (skeletal_muscle_kg >= 0),
  visceral_fat SMALLINT CHECK (visceral_fat >= 0),
  water_pct NUMERIC(4,1) CHECK (water_pct >= 0 AND water_pct <= 100),
  bone_mass_kg NUMERIC(3,1) CHECK (bone_mass_kg >= 0),
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'huawei_scale', 'csv_import')),
  external_id TEXT,
  is_outlier BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_body_measurements_user_source_ext UNIQUE (user_id, source, external_id)
);

CREATE TABLE IF NOT EXISTS public.body_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  height_cm NUMERIC(4,1) CHECK (height_cm > 0),
  gender TEXT NOT NULL DEFAULT 'male' CHECK (gender IN ('male', 'female', 'other')),
  birth_year SMALLINT CHECK (birth_year >= 1900 AND birth_year <= 2100),
  goal_weight_kg NUMERIC(5,2) CHECK (goal_weight_kg > 0),
  activity_level TEXT NOT NULL DEFAULT 'moderate' CHECK (activity_level IN ('sedentary', 'light', 'moderate', 'active', 'very_active')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.body_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.body_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users own body measurements" ON public.body_measurements;
CREATE POLICY "Users own body measurements" ON public.body_measurements
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users own body profiles" ON public.body_profiles;
CREATE POLICY "Users own body profiles" ON public.body_profiles
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_body_measurements_user_date
  ON public.body_measurements(user_id, local_date DESC, measured_at DESC);

-- Permissions
REVOKE ALL ON public.body_measurements FROM anon, public;
REVOKE ALL ON public.body_profiles FROM anon, public;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.body_measurements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.body_profiles TO authenticated;

COMMIT;
