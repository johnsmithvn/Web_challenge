-- ══════════════════════════════════════════════════════════════════════════════
-- LIFE HUB — KNOWLEDGE: SỬA BÀI TRỰC QUAN BỊ HỎNG VÌ "LIÊN KẾT BÀI VIẾT" (v6.37.0)
--
-- Lỗi cũ: nút "Liên kết bài viết" cộng chuỗi "\n\nLiên quan: [[Tên bài]]" thẳng vào thân bài, kể cả bài
-- Trực quan (Tiptap) có thân là JSON → JSON hỏng, trang đọc / trình soạn hiện nguyên đoạn mã {"type":"doc",…}.
-- Code đã sửa (toggleWikiLink); file này sửa các dòng đã hỏng: tách phần JSON gốc (trước dòng xuống đầu tiên —
-- JSON.stringify không bao giờ sinh xuống dòng thật), thêm mỗi dòng "Liên quan: [[…]]" phía sau thành một đoạn văn.
-- Dòng "Liên quan:" trống (sót lại khi gỡ liên kết) bỏ đi.
--
-- Chạy MỘT LẦN trên database đang dùng (SQL Editor của Supabase hoặc psql -f). Không xoá dòng nào, chỉ sửa
-- cột body của đúng các bài mang dấu hiệu lỗi. Chạy lại không sao (lần sau không còn dòng nào khớp).
-- Fail-closed: phần JSON gốc không đọc được thì cả transaction lỗi và không dòng nào bị đổi.
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. Xem trước: các bài sẽ được sửa (chạy riêng câu này nếu muốn xem trước)
SELECT id, title, substr(body, strpos(body, E'\n')) AS phan_dinh_them
FROM collections
WHERE body LIKE '{"type":"doc"%'
  AND strpos(body, E'\nLiên quan:') > 0;

BEGIN;

WITH broken AS (
  SELECT id,
         left(body, strpos(body, E'\n') - 1)::jsonb AS doc,
         substr(body, strpos(body, E'\n')) AS tail
  FROM collections
  WHERE body LIKE '{"type":"doc"%'
    AND strpos(body, E'\nLiên quan:') > 0
)
UPDATE collections c
SET content_format = 'tiptap',
    body = jsonb_set(
      b.doc,
      '{content}',
      coalesce(b.doc -> 'content', '[]'::jsonb) || coalesce((
        SELECT jsonb_agg(
                 jsonb_build_object(
                   'type', 'paragraph',
                   'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', btrim(t.line)))
                 ) ORDER BY t.n)
        FROM regexp_split_to_table(b.tail, E'\n') WITH ORDINALITY AS t(line, n)
        WHERE btrim(t.line) NOT IN ('', 'Liên quan:')
      ), '[]'::jsonb)
    )::text
FROM broken b
WHERE c.id = b.id;

-- 2. Kiểm tra: không còn bài nào mang dấu hiệu lỗi, mọi thân bài đã sửa đọc được là JSON
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM collections
    WHERE body LIKE '{"type":"doc"%' AND strpos(body, E'\nLiên quan:') > 0
  ) THEN
    RAISE EXCEPTION 'Còn bài chưa sửa được — đã huỷ, không dòng nào bị đổi';
  END IF;
END $$;

COMMIT;
