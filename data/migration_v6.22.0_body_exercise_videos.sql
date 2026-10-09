-- ==============================================================================
-- LIFE HUB — MODULE BODY: LINK VIDEO TỰ GẮN CHO BÀI TẬP (v6.22.0)
-- Trước đây link nằm trong localStorage (`body_custom_exercise_videos`) — trái RULES §4, đổi máy là mất.
-- Mỗi user tối đa 1 link / bài. `exercise_key` = key bài trong `src/data/body-exercises.json`
-- hoặc id bài tự tạo (`body_custom_exercises`). Frontend tự chuyển link cũ trong localStorage lên
-- bảng này một lần rồi xoá key cũ.
-- Additive, idempotent: chạy lại an toàn, không đụng bảng khác.
-- ==============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.body_exercise_videos (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_key TEXT NOT NULL CHECK (char_length(exercise_key) BETWEEN 1 AND 100),
  video_url TEXT NOT NULL CHECK (char_length(video_url) <= 2048 AND video_url ~* '^https?://'),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, exercise_key)
);

-- RLS
ALTER TABLE public.body_exercise_videos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users own exercise videos" ON public.body_exercise_videos;
CREATE POLICY "Users own exercise videos" ON public.body_exercise_videos
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Permissions (upsert = INSERT + UPDATE, gỡ link = DELETE)
REVOKE ALL ON public.body_exercise_videos FROM anon, public;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.body_exercise_videos TO authenticated;

COMMIT;
