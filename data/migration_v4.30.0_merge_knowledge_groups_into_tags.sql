-- ════════════════════════════════════════════════════════════════════════════
-- migration_v4.30.0_merge_knowledge_groups_into_tags.sql
--
-- Quyết định sản phẩm P2-7 (docs/TASKS.md), chốt 2026-08-01 sau khi thảo luận:
-- `knowledge_groups`/`collection_groups` và `tags`/`collection_tags` đều là
-- quan hệ M:N trên `collections` — cùng giải 1 bài toán ("1 bài viết có thể
-- thuộc nhiều nhóm/chủ đề"). Khác biệt DUY NHẤT là `knowledge_groups` có thêm
-- cột `emoji` + `description` để hiển thị kiểu "folder", còn `tags` thì không.
--
-- CẬP NHẬT quyết định (cùng ngày, sau khi PHASE 1 đã chạy): thay vì giữ lại
-- tính năng "Nhóm" trên UI (hiển thị qua tag có emoji), quyết định XOÁ HẲN
-- tính năng Nhóm khỏi giao diện — chỉ còn tag thường. Vì vậy `tags.emoji`/
-- `description` không còn cần thiết nữa → dọn luôn ở PHASE 2 (xem dưới).
-- Dữ liệu nhóm cũ ĐÃ được PHASE 1 copy thành tag thường (giữ tên, mất emoji)
-- — bài viết KHÔNG mất liên kết, chỉ mất hiển thị "folder" đặc biệt.
--
-- PHASE 1 (đã chạy, an toàn, idempotent):
--   - Thêm tags.emoji, tags.description
--   - Copy dữ liệu knowledge_groups → tags, collection_groups → collection_tags
--   - KHÔNG xoá gì
--
-- PHASE 2 (BREAKING — DROP TABLE + DROP COLUMN, KHÔNG HOÀN LẠI ĐƯỢC) — nằm
-- cuối file, đã COMMENT sẵn. CHỈ bỏ comment & chạy sau khi:
--   1. Đã deploy code mới (CollectPage.jsx không còn UI Nhóm, không còn đọc
--      tags.emoji/description; useCollections.js không còn select emoji)
--   2. Đã backup DB
--   (Nếu chạy Phase 2 khi code cũ còn sống: query join của useCollections.js
--   có 3 bước fallback — full → tags-only → plain — nên khi cột emoji biến
--   mất, code CŨ (nếu còn select emoji) sẽ lỗi ở bước full, tự rớt xuống
--   fallback — KHÔNG crash app, nhưng vẫn nên deploy code mới trước cho gọn.)
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Thêm cột còn thiếu vào tags ───────────────────────────────────────────
ALTER TABLE tags ADD COLUMN IF NOT EXISTS emoji TEXT;
ALTER TABLE tags ADD COLUMN IF NOT EXISTS description TEXT;

-- ── 2. Copy knowledge_groups → tags ──────────────────────────────────────────
-- name lowercase để khớp convention hiện có (useTags.addTag() luôn lowercase
-- trước khi insert) — tránh về sau tạo tag trùng nghĩa khác chữ hoa/thường
-- ("Học Máy" từ group cũ vs "học máy" tag mới tạo) mà UNIQUE(user_id,name)
-- không bắt được (Postgres so sánh TEXT phân biệt hoa/thường).
-- Nếu user đã có tag cùng tên (trùng cả nghĩa) thì GIỮ tag đó, chỉ bổ sung
-- emoji/description nếu tag đó đang thiếu (COALESCE — không đè giá trị đã có).
--
-- DISTINCT ON (user_id, name): code cũ KHÔNG hề chặn tạo 2 nhóm trùng tên
-- (addGroup() không check trùng, bảng knowledge_groups không có UNIQUE trên
-- title) — nếu 1 user có ≥2 nhóm cùng lower(trim(title)), INSERT...SELECT
-- ...ON CONFLICT DO UPDATE sẽ crash "cannot affect row a second time" vì cùng
-- 1 statement update trùng 1 conflict-key 2 lần. Gộp về 1 dòng đại diện mỗi
-- (user_id, name) trước khi insert — dòng bị loại vẫn JOIN đúng ở bước 3 vì
-- so theo tên, không mất liên kết bài viết nào.
INSERT INTO tags (user_id, name, emoji, description)
SELECT DISTINCT ON (kg.user_id, lower(trim(kg.title)))
       kg.user_id, lower(trim(kg.title)), kg.emoji, kg.description
FROM knowledge_groups kg
ORDER BY kg.user_id, lower(trim(kg.title)), kg.emoji NULLS LAST, kg.created_at
ON CONFLICT (user_id, name) DO UPDATE
  SET emoji       = COALESCE(tags.emoji, EXCLUDED.emoji),
      description = COALESCE(tags.description, EXCLUDED.description);

-- ── 3. Copy collection_groups → collection_tags ──────────────────────────────
-- Map qua (user_id, name) vì tag mới sinh ra id khác id của knowledge_group cũ.
-- sort_order CỐ Ý không mang sang (đã xác nhận không dùng).
INSERT INTO collection_tags (collection_id, tag_id)
SELECT cg.collection_id, t.id
FROM collection_groups cg
JOIN knowledge_groups kg ON kg.id = cg.group_id
JOIN tags t ON t.user_id = kg.user_id AND t.name = lower(trim(kg.title))
ON CONFLICT (collection_id, tag_id) DO NOTHING;

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════
-- KIỂM TRA SAU PHASE 1
-- ════════════════════════════════════════════════════════════════════════════
--   -- (A) Số nhóm gốc vs số tag có emoji (>= vì có thể trùng tên bị gộp vào
--   --     tag đã tồn tại — đó là hành vi đúng, không phải mất dữ liệu):
--   SELECT count(*) FROM knowledge_groups;
--   SELECT count(*) FROM tags WHERE emoji IS NOT NULL;
--
--   -- (B) Số liên kết bài↔nhóm gốc vs số liên kết bài↔tag-có-emoji đã copy:
--   SELECT count(*) FROM collection_groups;
--   SELECT count(*) FROM collection_tags ct
--     JOIN tags t ON t.id = ct.tag_id
--    WHERE t.emoji IS NOT NULL;
--
--   -- (C) Đối chiếu từng nhóm cụ thể (thay <user_id> bằng UUID thật muốn kiểm):
--   SELECT kg.title, kg.emoji,
--          (SELECT count(*) FROM collection_groups cg WHERE cg.group_id = kg.id) AS bai_trong_nhom_cu,
--          (SELECT count(*) FROM collection_tags ct
--             JOIN tags t ON t.id = ct.tag_id
--            WHERE t.user_id = kg.user_id AND t.name = lower(trim(kg.title))) AS bai_trong_tag_moi
--     FROM knowledge_groups kg WHERE kg.user_id = '<user_id>';
--   -- 2 cột cuối phải bằng nhau cho mỗi dòng (trừ khi tag đó đã có bài gắn từ
--   -- trước, lúc đó tag_moi >= nhom_cu là đúng, không phải lỗi)
--
-- SMOKE TEST TRÊN APP (bắt buộc — không có test tự động cho phần này):
--   1. /collect → 🧠 Kho Tàng → mọi nhóm cũ phải hiện lại đúng emoji + tên
--   2. Bấm vào 1 nhóm → đúng danh sách bài như trước khi migrate
--   3. Tạo nhóm mới → phải là 1 tag mới có emoji, hiện ngay trong Kho Tàng
--
-- ════════════════════════════════════════════════════════════════════════════
-- PHASE 2 — BREAKING — bỏ comment và chạy SAU khi đã deploy code mới + backup
-- ════════════════════════════════════════════════════════════════════════════
-- BEGIN;
-- DROP TABLE IF EXISTS collection_groups;
-- DROP TABLE IF EXISTS knowledge_groups;
-- ALTER TABLE tags DROP COLUMN IF EXISTS emoji;
-- ALTER TABLE tags DROP COLUMN IF EXISTS description;
-- COMMIT;
