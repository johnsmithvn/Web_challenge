-- ══════════════════════════════════════════════════════════════════════════════
-- LIFE HUB — MODULE BODY: WORKOUT & ROUTINE ENGINE v6.22.0
--
-- Xương sống của module Body:
--   1. body_custom_exercises : Bài tập tự tạo của user (bài có sẵn nằm trong JSON).
--   2. body_routines         : Lộ trình tập (tên, mục tiêu, số tuần, auto_progress).
--   3. body_routine_items    : Kế hoạch mục tiêu hiện tại (Current Blueprint theo thứ 1–7).
--   4. body_workout_sessions : Buổi tập thực tế (local_date, mode, status, duration).
--   5. body_workout_sets     : Chi tiết từng set (set_no theo bài, sequence_order toàn buổi, snapshot mục tiêu).
--
-- RLS own-row đầy đủ, khóa composite (id, user_id) chống bypass RLS, GRANT/REVOKE chuẩn.
-- ══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- 1. BÀI TẬP TỰ TẠO
CREATE TABLE IF NOT EXISTS public.body_custom_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  primary_muscle TEXT NOT NULL,
  secondary_muscles TEXT[] DEFAULT '{}',
  equipment TEXT NOT NULL DEFAULT 'bw',
  level TEXT DEFAULT 'Cơ bản',
  metric TEXT NOT NULL DEFAULT 'rep' CHECK (metric IN ('rep', 's', 'min', 'm', 'km')),
  steps TEXT[] DEFAULT '{}',
  mistake_tip TEXT DEFAULT '',
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_body_custom_exercises_id_user UNIQUE (id, user_id)
);

ALTER TABLE public.body_custom_exercises ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS body_custom_exercises_owner ON public.body_custom_exercises;
CREATE POLICY body_custom_exercises_owner ON public.body_custom_exercises
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_body_custom_exercises_user ON public.body_custom_exercises (user_id);

-- 2. LỘ TRÌNH (ROUTINES)
CREATE TABLE IF NOT EXISTS public.body_routines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  goal TEXT DEFAULT '',
  weeks INT NOT NULL DEFAULT 8 CHECK (weeks > 0),
  start_date DATE NOT NULL,
  auto_progress BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_body_routines_id_user UNIQUE (id, user_id)
);

ALTER TABLE public.body_routines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS body_routines_owner ON public.body_routines;
CREATE POLICY body_routines_owner ON public.body_routines
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Tối đa 1 lộ trình đang active cho mỗi user
CREATE UNIQUE INDEX IF NOT EXISTS idx_body_routines_one_active
  ON public.body_routines (user_id)
  WHERE (is_active = true);

-- 3. MỤC TIÊU BÀI TẬP TRONG LỘ TRÌNH (ROUTINE ITEMS - CURRENT BLUEPRINT)
CREATE TABLE IF NOT EXISTS public.body_routine_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 1 AND 7), -- 1: T2 ... 7: CN
  day_name TEXT DEFAULT '',
  position INT NOT NULL DEFAULT 0,
  exercise_key TEXT NOT NULL,
  target_sets INT NOT NULL DEFAULT 3 CHECK (target_sets > 0),
  target_val NUMERIC NOT NULL DEFAULT 10 CHECK (target_val > 0),
  unit TEXT NOT NULL DEFAULT 'rep' CHECK (unit IN ('rep', 's', 'min', 'm', 'km')),
  kg NUMERIC DEFAULT 0 CHECK (kg >= 0),
  rest_seconds INT DEFAULT 60 CHECK (rest_seconds >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_body_routine_items_id_user UNIQUE (id, user_id),
  CONSTRAINT fk_body_routine_items_routine_user
    FOREIGN KEY (routine_id, user_id)
    REFERENCES public.body_routines(id, user_id)
    ON DELETE CASCADE
);

ALTER TABLE public.body_routine_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS body_routine_items_owner ON public.body_routine_items;
CREATE POLICY body_routine_items_owner ON public.body_routine_items
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_body_routine_items_lookup
  ON public.body_routine_items (routine_id, weekday, position);

-- 4. BUỔI TẬP THỰC TẾ (WORKOUT SESSIONS)
CREATE TABLE IF NOT EXISTS public.body_workout_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  routine_id UUID,
  planned_weekday SMALLINT CHECK (planned_weekday BETWEEN 1 AND 7),
  local_date DATE NOT NULL,
  title TEXT NOT NULL,
  day_type TEXT DEFAULT '',
  mode TEXT NOT NULL DEFAULT 'straight' CHECK (mode IN ('straight', 'circuit', 'superset')),
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  duration_seconds INT DEFAULT 0 CHECK (duration_seconds >= 0),
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_body_workout_sessions_id_user UNIQUE (id, user_id),
  CONSTRAINT fk_body_workout_sessions_routine_user
    FOREIGN KEY (routine_id, user_id)
    REFERENCES public.body_routines(id, user_id)
    ON DELETE SET NULL (routine_id)
);

ALTER TABLE public.body_workout_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS body_workout_sessions_owner ON public.body_workout_sessions;
CREATE POLICY body_workout_sessions_owner ON public.body_workout_sessions
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_body_workout_sessions_user_date
  ON public.body_workout_sessions (user_id, local_date DESC);

-- Tối đa 1 buổi đang tập dở cho mỗi user
CREATE UNIQUE INDEX IF NOT EXISTS idx_body_sessions_one_in_progress
  ON public.body_workout_sessions (user_id)
  WHERE (status = 'in_progress');

-- 5. CHI TIẾT TỪNG SET (WORKOUT SETS)
CREATE TABLE IF NOT EXISTS public.body_workout_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  routine_item_id UUID,
  exercise_key TEXT NOT NULL,
  exercise_name TEXT NOT NULL,
  set_no INT NOT NULL CHECK (set_no > 0),
  sequence_order INT NOT NULL CHECK (sequence_order > 0),
  target_val NUMERIC NOT NULL CHECK (target_val > 0),
  unit TEXT NOT NULL DEFAULT 'rep' CHECK (unit IN ('rep', 's', 'min', 'm', 'km')),
  actual_val NUMERIC, -- NULL khi set bị bỏ qua
  kg NUMERIC DEFAULT 0 CHECK (kg >= 0),
  is_pr BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_body_workout_sets_id_user UNIQUE (id, user_id),
  CONSTRAINT fk_body_workout_sets_session_user
    FOREIGN KEY (session_id, user_id)
    REFERENCES public.body_workout_sessions(id, user_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_body_workout_sets_routine_item_user
    FOREIGN KEY (routine_item_id, user_id)
    REFERENCES public.body_routine_items(id, user_id)
    ON DELETE SET NULL (routine_item_id)
);

ALTER TABLE public.body_workout_sets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS body_workout_sets_owner ON public.body_workout_sets;
CREATE POLICY body_workout_sets_owner ON public.body_workout_sets
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_body_workout_sets_lookup
  ON public.body_workout_sets (session_id, sequence_order);
CREATE INDEX IF NOT EXISTS idx_body_workout_sets_exercise
  ON public.body_workout_sets (user_id, exercise_key, completed_at DESC);

-- 6. GRANT / REVOKE PERMISSIONS (vì config.toml bật auto_expose_new_tables = false)
REVOKE ALL ON public.body_custom_exercises FROM anon, public;
REVOKE ALL ON public.body_routines FROM anon, public;
REVOKE ALL ON public.body_routine_items FROM anon, public;
REVOKE ALL ON public.body_workout_sessions FROM anon, public;
REVOKE ALL ON public.body_workout_sets FROM anon, public;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.body_custom_exercises TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.body_routines TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.body_routine_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.body_workout_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.body_workout_sets TO authenticated;

COMMIT;
