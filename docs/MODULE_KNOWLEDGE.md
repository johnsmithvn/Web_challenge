# Module Knowledge (Kiến Thức)

> Tài liệu duy nhất của module Knowledge (`/collect`), mô tả code đang chạy. Cập nhật 2026-10-25 (v6.32.0).
> Lịch sử thay đổi nằm ở `CHANGELOG.md`; bản tóm tắt cho người dùng ở `docs/FEATURES.md` §5.

## Mục lục

1. [Tổng quan](#1-tổng-quan) · 2. [Quy chuẩn phân loại](#2-quy-chuẩn-phân-loại) · 3. [Dữ liệu](#3-dữ-liệu) ·
4. [Màn hình](#4-màn-hình) · 5. [Tìm lại và gợi lại](#5-tìm-lại-và-gợi-lại) · 6. [Media](#6-media) ·
7. [Ghi chú cá nhân](#7-ghi-chú-cá-nhân) · 8. [Thẻ](#8-thẻ) · 9. [Liên kết module khác](#9-liên-kết-module-khác) ·
10. [Logic thuần và test](#10-logic-thuần-và-test) · 11. [Quyết định thiết kế](#11-quyết-định-thiết-kế) ·
12. [Nợ đã biết](#12-nợ-đã-biết) · 13. [Để sau](#13-để-sau) · 14. [Checklist test tay](#14-checklist-test-tay)

---

## 1. Tổng quan

| Thuộc tính | Giá trị |
|---|---|
| Route | `/collect`, lazy chunk `CollectPage` (`src/App.jsx`) |
| Đăng nhập | Bắt buộc. Chưa đăng nhập → "Đăng nhập để xem Kho Kiến Thức" |
| Mục đích | Nơi **cất, xem và đọc lại** kiến thức. Không có quy trình đọc / thực hành / lưu trữ (§11) |
| Giao diện | Tối mặc định, có bản sáng. Token `src/styles/kb-tokens.css` (nền tím than, nhấn vàng đồng `--kb-brass`, chữ Spectral + nhãn mono JetBrains Mono); style `src/styles/collect.css` |
| Media | Chỉ là link ngoài (YouTube, Google Drive, file âm thanh / video). Không dùng Supabase Storage |

### 1.1. Bản đồ file

| Vai trò | File |
|---|---|
| Trang, điều phối view, phím tắt | `src/pages/CollectPage.jsx` |
| Đầu trang (tìm, kiểu xem, chip chủ đề) | `src/components/kb/KBSubHeader.jsx` |
| Tổng quan | `src/components/kb/KBOverview.jsx` |
| Danh sách | `src/components/kb/KBListView.jsx` |
| Gallery / Sơ đồ / Canvas | `KBGalleryView.jsx`, `KBGraphView.jsx`, `KBCanvasView.jsx` |
| Trang đọc | `src/components/kb/KBReaderView.jsx` |
| Trình soạn thảo | `src/components/kb/KBEditorView.jsx` (+ `TiptapEditor.jsx`, `SlashCommand.jsx`, `extensions/MediaNode.jsx`) |
| Chọn chủ đề / Quản lý chủ đề | `KBTopicPicker.jsx`, `KBTopicModal.jsx` |
| Nối `[[ ]]`, quản lý thẻ, phím tắt | `KBLinkModal.jsx`, `KBTagModal.jsx`, `KBShortcutsModal.jsx` |
| Dữ liệu bài / chủ đề / ghi chú / thẻ | `useCollections.js`, `useCollectionTopics.js`, `useCollectionNotes.js`, `useTags.js` |
| Logic thuần | `src/utils/kbDeriveUtils.js`, `src/utils/mediaUtils.js` |
| Media | `MediaPreview.jsx`, `CustomAudioPlayer.jsx`, `UrlInputPopover.jsx` |
| Podcast nổi toàn app | `GlobalAudioPlayer.jsx` + `useRandomPodcast.js` |
| API | `api/upload.js` (upload lên Google Drive), `api/stream.js` (proxy phát file Drive) |
| Migration chủ đề | `supabase/migrations/20261025000000_knowledge_topics_v6_32_0.sql` |

---

## 2. Quy chuẩn phân loại

Mỗi bài có **một quyết định duy nhất là Chủ đề**, để trống được. Còn lại máy tự lo.

| Trục | Câu hỏi | Ai quyết |
|---|---|---|
| **Chủ đề** | Nó thuộc mảng nào trong đời mình? | Người dùng, một lần, để trống được (Chưa xếp) |
| **Loại** | Nó là cái gì? | Máy tự nhận từ link (`contentKind`) |
| **Kiểu** | Bài viết / Trích dẫn / Podcast | Người dùng, trong trình soạn thảo; chỉ để giữ gallery trích dẫn và trình phát podcast |

### 2.1. Chủ đề

Bộ khởi đầu (nguồn duy nhất: hàm SQL `seed_starter_collection_topics`):

| # | Chủ đề | Định nghĩa | Màu |
|---|---|---|---|
| 1 | Công nghệ & AI | Repo, công cụ AI, lập trình, web, tự động hoá | `#60a5fa` |
| 2 | Tâm lý & Con người | Hành vi, cảm xúc, giao tiếp, động lực, các mối quan hệ | `#a78bfa` |
| 3 | Học tập & Năng suất | Phương pháp học, ghi nhớ, tập trung, quản lý thời gian, thói quen | `#f59e0b` |
| 4 | Ngôn ngữ & Giao tiếp | Tiếng Anh, từ vựng, nghe nói, phát âm, cách diễn đạt | `#34d399` |
| 5 | Ý tưởng & Thiết kế | UX/UI, ý tưởng sản phẩm, cảm hứng thiết kế, tính năng muốn thử | `#f472b6` |
| 6 | Góc nhìn & Cảm hứng | Quan điểm sống, trích dẫn, bài học cá nhân | `#22d3ee` |
| 7 | Giải trí | Đọc, xem cho vui: truyện hài, hội thoại hay | `#f87171` |

**Luật:**
1. Mỗi bài thuộc đúng một chủ đề, hoặc Chưa xếp.
2. Phân vân giữa hai chủ đề → chọn **chỗ lần sau mình sẽ đi tìm nó**.
3. Chủ đề đủ rộng để chứa nhiều dạng nội dung; không tạo "AI Videos", "AI Repos" (dạng đã có trục Loại).
4. Chủ đề là mảng quan tâm lâu dài, không phải dự án hay việc cần làm (thuộc Tasks).
5. Chỉ tạo chủ đề mới khi có ≥ 5 bài mà không chủ đề nào hợp.
6. **Tối đa 8.** Đủ 8 thì phải gộp bớt; app và DB cùng chặn.
7. Tên 1–4 chữ, không trùng nghĩa; mỗi chủ đề có một dòng định nghĩa.
8. Câu nói gắn với một mảng thì về mảng đó; thứ chỉ để vui → Giải trí.

### 2.2. Loại (`contentKind`)

| Điều kiện | Loại |
|---|---|
| Kiểu Trích dẫn | Trích dẫn |
| `github.com/<owner>/<repo>` (trừ `/topics`, `/orgs`…) | Repo |
| YouTube; Drive có `#video` | Video |
| `facebook.com`, `fb.watch`, `m.facebook.com` | Bài FB |
| Link âm thanh; Drive không có `#video` | Âm thanh |
| Link khác | Bài viết |
| Không có link | Ghi chú |

---

## 3. Dữ liệu

### 3.1. `collections`

| Cột | Vai trò |
|---|---|
| `type` | `CHECK IN ('inbox','note','quote','learn','idea','ai','entertainment','podcast')`, `DEFAULT 'inbox'`. App ghi `note` / `quote` / `podcast`; bài cũ mang `learn/idea/ai/entertainment` được coi là Bài viết. `inbox` không còn dùng (Inbox đã gộp vào Tasks) |
| `topic_id` | Chủ đề; NULL = Chưa xếp. FK `(user_id, topic_id) → collection_topics (user_id, id) ON DELETE SET NULL (topic_id)` — bài và chủ đề luôn cùng chủ, xoá chủ đề thì bài về Chưa xếp |
| `title` | Bắt buộc. Với trích dẫn: tên tác giả |
| `url` | Link nguồn; hậu tố `#audio` / `#video` ép cách hiển thị |
| `body`, `body_text`, `word_count`, `content_format` | Markdown thô **hoặc** JSON Tiptap; `body_text` là chữ trơn cho trích đoạn và tìm kiếm |
| `status` | `unread / read / archived` theo CHECK. UI lưu bài mới là `read`; bài `archived` cũ (từ Inbox) bị ẩn. Không có thao tác nào trong UI đổi `status` |

Bảng phụ: `collection_tags`, `task_collections` (RLS kiểm cả hai phía), `collection_notes` (cascade khi xoá bài).

### 3.2. `collection_topics`

`id, user_id, name (1–40 ký tự), description, color, sort_order, created_at, updated_at` · `UNIQUE (user_id, id)` ·
tên không trùng theo user (không phân biệt hoa thường) · RLS 4 policy theo `auth.uid()` · trigger `updated_at` ·
trigger **tối đa 8 chủ đề** (advisory lock theo user).

**Hàm** (đều `SECURITY INVOKER`, chỉ `authenticated` được gọi):

| Hàm | Làm gì |
|---|---|
| `seed_starter_collection_topics(p_user)` | Chèn bộ 7 chủ đề, chỉ khi user chưa có chủ đề nào (không hồi sinh chủ đề đã xoá) |
| `merge_collection_topics(p_from, p_to)` | Chuyển bài sang chủ đề đích rồi xoá chủ đề nguồn, một transaction |

Migration `20261025000000_knowledge_topics_v6_32_0.sql`: yêu cầu Postgres 15+ (tự từ chối nếu thấp hơn), tạo bộ
chủ đề cho user đang có bài, gán chủ đề theo `type` cũ (`ai` → Công nghệ & AI, `entertainment` → Giải trí,
`learn` → Học tập & Năng suất, `idea` → Ý tưởng & Thiết kế) mà không đổi `updated_at`, có verify và rollback.

### 3.3. Hook trả về

- `useCollections`: một query, tối đa 500 bài mới nhất, bỏ `archived`, join thẻ / id task đã nối / nội dung ghi chú.
  Mỗi bài có `_tags`, `_linkedTaskIds`, `_linkedTaskCount`, `_notes`, `_noteCount`. Có `updateItems(ids, updates)` cho
  thao tác hàng loạt (một request).
- `useCollectionTopics`: `topics` (theo `sort_order`), `addTopic`, `updateTopic`, `moveTopic`, `deleteTopic`,
  `mergeTopics`, `seedStarterTopics`; `MAX_TOPICS = 8`. Danh sách gắn với user nên phản hồi trễ của user trước không lọt vào.
- `CollectPage` gắn thêm `_topic` và `_linkedTasks` (task chưa xong) cho mỗi bài.

---

## 4. Màn hình

### 4.1. Đầu trang (`KBSubHeader`)

- **Hàng 1:** "Kho Tàng Kiến Thức" + số bài · ô tìm (`/`) · kiểu xem **Tổng quan · Danh sách · Gallery · Sơ đồ · Canvas** · **＋ Bài mới**.
- **Hàng 2:** chip `Tất cả · <chủ đề: chấm màu + số bài> · Chưa xếp · ⋯`. Chip lọc Danh sách, Gallery, Sơ đồ, Canvas;
  bấm chip khi đang ở Tổng quan thì sang Danh sách của chủ đề đó; `⋯` mở Quản lý chủ đề.
- Ẩn khi đang đọc hoặc soạn. Mở Knowledge vào **Tổng quan**; đọc / soạn xong, "← Thư viện" và `Esc` quay về đúng kiểu xem trước đó.

### 4.2. Tổng quan (`KBOverview`)

| Khối | Hiện khi | Nội dung |
|---|---|---|
| **Xếp nhanh · còn N** | Có bài chưa có chủ đề lưu trong 30 ngày (`quickSortQueue`) | Từng bài một: loại · nguồn · tuổi, tiêu đề (bấm để mở), dòng đầu; chip chủ đề có số phím `1`–`8` và gợi ý (`suggestTopic`); "Để sau →" (chỉ trong lần mở này) |
| **Các chủ đề · n/8** | Luôn | Thẻ mỗi chủ đề: tên, số bài, định nghĩa, 2 bài mới nhất; thẻ cuối **Ghi chú của tôi**; "Quản lý" |
| **Gặp lại hôm nay** | Có bài phù hợp | 3 bài cũ hơn 30 ngày là ghi chú / trích dẫn của mình hoặc có ghi chú (`pickResurface`), cố định trong ngày |
| **Mở gần đây** | Có lịch sử | 3 bài mở gần nhất trên máy này |

Bài chưa xếp cũ hơn 30 ngày không hiện ở đây (xếp hàng loạt từ Danh sách). Kho trống → "Kho đang trống" + ＋ Bài mới.
Đang gõ tìm thì hiện kết quả như Danh sách.

### 4.3. Danh sách (`KBListView`)

- **Đầu danh sách:** khi lọc một chủ đề → tên + định nghĩa + `⋯` (đây là "trang chủ đề"); mở từ thẻ Ghi chú của tôi →
  "Ghi chú của tôi" (`isMine`: bài không link hoặc có ghi chú).
- Sắp xếp Mới nhất / Cũ nhất / Dài nhất, nút Chọn. Hàng thẻ để lọc (AND), chỉ gồm thẻ đang được bài Knowledge dùng.
- **Dòng bài:** ký hiệu loại tô màu chủ đề; meta chủ đề · loại · tên miền · ngày · phút đọc; tiêu đề; trích 200 chữ;
  nhãn thẻ, số liên kết `[[ ]]`, số nhiệm vụ, số ghi chú; nút Sửa / Xoá.
- **Chọn nhiều:** Chọn tất cả · **Gán chủ đề** · Gắn thẻ · Xoá hàng loạt.

### 4.4. Gallery, Sơ đồ, Canvas

- **Gallery:** lưới thẻ: chủ đề · loại (màu chủ đề), câu trích, tiêu đề và ngày.
- **Sơ đồ:** đồ thị lực, cạnh từ `[[ ]]` và thẻ chung, node tô màu chủ đề, chú thích theo chủ đề, panel bên.
- **Canvas:** bảng kéo thả node và nối cạnh; `localStorage` `kb_canvas_nodes`, `kb_canvas_edges`.
- Sơ đồ và Canvas chỉ lọc theo chủ đề (không theo chữ tìm / thẻ).

### 4.5. Trang đọc (`KBReaderView`)

- **Thanh trên:** ← Thư viện · ↑ ↓ · **chủ đề** (select, đổi một lần chọn) · Tập trung (`F`) · ↔ Liên kết · ✎ Sửa (`E`) · ⌫ Xoá.
  Vạch tiến độ cuộn trang. Điện thoại: thanh xuống dòng.
- **Nội dung:** meta (chủ đề · loại · nguồn · ngày · phút đọc), tiêu đề, thẻ, media preview, thân bài, **Ghi chú cá nhân**.
- **Cột phải:** thông tin & thống kê · **Xung quanh** (§5.2) · sơ đồ nhỏ · mục lục (Markdown) · liên kết đi · backlink · nhiệm vụ liên kết (task chưa xong).
- Bài đang đọc / soạn chỉ giữ **id**; nội dung lấy từ dữ liệu sống nên đổi chủ đề, link, `[[ ]]` hiện ngay. Thêm / xoá ghi chú → tải lại danh sách.

### 4.6. Trình soạn thảo (`KBEditorView`)

- Markdown / Visual (chỉ chọn khi tạo mới), thống kê chữ, nút nối `[[ ]]`, Lưu (`Ctrl+S`).
- Tiêu đề · hàng **chủ đề** (gợi ý: viền đứt + chữ "gợi ý"; có Chưa xếp) · **Kiểu** Bài viết / Trích dẫn / Podcast · thẻ · URL.
- Rời ô URL khi tiêu đề trống → tự điền tiêu đề đoán từ link (`guessTitle`: repo → `owner/repo`, YouTube → "Video YouTube", Facebook → "Bài Facebook", còn lại → tên miền).
- Lưu thất bại → báo lỗi và ở lại trình soạn thảo.

### 4.7. Quản lý chủ đề (`KBTopicModal`)

Sửa tên / định nghĩa / màu ngay trên dòng (lưu khi rời ô), ↑ ↓ đổi thứ tự, "Gộp vào…" (RPC merge), Xoá (bài về Chưa
xếp). Gộp và xoá có xác nhận. Đủ 8 thì ô thêm mới đổi thành lời nhắc gộp bớt. Chưa có chủ đề nào → "Dùng bộ 7 chủ đề gợi ý".

### 4.8. Phím tắt

`/` tìm · `N` bài mới · `V` chọn nhiều · `J`/`K` di chuyển · `Enter` mở · `E` sửa · `Backspace` xoá · `⌘Z` hoàn tác xoá
(không chạy khi đang gõ) · `G` rồi `T`/`L`/`G`/`C`/`Q` = Tổng quan / Danh sách / Sơ đồ / Canvas / Gallery · `?` bảng phím
tắt · `Esc` lùi từng lớp (Sơ đồ, Canvas → Tổng quan) · Tổng quan: `1`–`8` xếp bài vào chủ đề, `→` để sau.
Phím tắt trang không chạy khi đang mở hộp thoại.

### 4.9. Xoá và hoàn tác

Xoá có xác nhận; toast "Hoàn tác" hoặc `⌘Z` chèn lại bài (giữ nội dung và chủ đề).

### 4.10. Điện thoại

Đầu trang xuống dòng, thanh kiểu xem và hàng chip cuộn ngang; lưới Tổng quan 3 → 2 → 1 cột; trang đọc: cột phải xuống dưới nội dung.

---

## 5. Tìm lại và gợi lại

### 5.1. Tìm kiếm (`filterArticles`)

Không cần dấu ("tam ly" ra "Tâm lý"), nhiều từ cùng lúc (mọi từ phải khớp), trên tiêu đề, chữ của bài (`body_text`,
không phải JSON thô), link, tên chủ đề, tên thẻ, nội dung ghi chú. `#tên` lọc theo thẻ. Hàm còn hỗ trợ lọc loại /
thời gian (`kind`, `time`) — UI chưa dùng.

### 5.2. Xung quanh (`findNeighbors`)

Ba nhóm, không bài nào lặp: **Cùng chủ đề** (mới trước) · **Cùng nguồn** (`sourceKey`: chủ repo GitHub, trang / nhóm
Facebook, tên miền; YouTube không tính) · gạch đứt · **Lưu gần thời điểm** (±7 ngày, khác chủ đề, chú thích "có thể khác chủ đề").

### 5.3. Gợi ý chủ đề (`suggestTopic`)

Cùng nguồn đã xếp ≥ 2 lần (≥ 50%) → cùng loại dồn về một chủ đề (≥ 3 bài, ≥ 60%; bỏ qua Ghi chú / Bài viết) → tên chủ
đề (phần tách bởi `&`, ≥ 4 ký tự) xuất hiện trong tiêu đề / nội dung và khớp đúng một chủ đề → không gợi ý. Chỉ gợi ý,
không tự xếp.

### 5.4. Gặp lại hôm nay và Mở gần đây

- `pickResurface`: bài > 30 ngày là của mình (`isMine`) hoặc trích dẫn; chọn theo hash ngày nên cả ngày ra cùng 3 bài.
- `pushRecent`: tối đa 10 id, lưu `localStorage` `vl_kb_recent` (tiện ích trên máy, đọc / ghi trong try/catch).

---

## 6. Media

`getMediaType(url)` (`mediaUtils.js`), dừng ở điều kiện khớp đầu tiên:

| Kết quả | Điều kiện | Hiển thị |
|---|---|---|
| `youtube` | `watch?v=`, `youtu.be/`, `/embed/`, `/shorts/` | iframe `youtube-nocookie.com` |
| `drive` | link Google Drive | mặc định trình phát audio qua `/api/stream`; có `#video` → iframe Drive |
| `audio` | `#audio` / `#podcast`, `type=audio`, `mime=audio/*`, đuôi âm thanh | `CustomAudioPlayer` |
| `video` | `#video`, `type=video`, `mime=video/*`, đuôi video | `<video>` |
| `link` | còn lại | không nhúng |

- Hậu tố `#audio` / `#video` được lưu thẳng vào URL.
- `/api/stream?id=` chỉ phục vụ file trong thư mục Drive của app, có rate limit, hỗ trợ `Range`.
- `/api/upload` cần JWT Supabase, giới hạn 4 MB, upload lên Google Drive; dùng khi dán / thả ảnh vào Visual editor hoặc nút upload trong `UrlInputPopover`.

## 7. Ghi chú cá nhân

`useCollectionNotes`: thêm / sửa / xoá ghi chú của một bài (optimistic), sắp theo `created_at`. Ở trang đọc: sửa tại
chỗ, `Ctrl+Enter` lưu, `Esc` huỷ. Xoá bài → ghi chú bị xoá theo (cascade). Bài có ghi chú vào "Ghi chú của tôi" và có
thể hiện ở "Gặp lại hôm nay".

## 8. Thẻ

`useTags` dùng chung cho Finance, Knowledge, Tasks (junction riêng mỗi module). Hàng lọc ở Danh sách chỉ hiện thẻ bài
Knowledge đang dùng; hộp quản lý thẻ (`KBTagModal`) làm việc trên mọi thẻ của user, như ở Cài đặt.

## 9. Liên kết module khác

| Module | Cơ chế |
|---|---|
| Tasks → Knowledge | `LinkKBModal` trong task: chọn / bỏ bài (junction `task_collections`), ghi activity log; icon theo `KIND_META` |
| Knowledge hiển thị task | Thẻ "Nhiệm vụ liên kết" ở trang đọc, số nhiệm vụ ở dòng bài |
| Trang chủ | `useCollections.fetchStats` đếm bài |
| Podcast nổi | `useRandomPodcast` lấy bài `type = 'podcast'` có link |
| Cài đặt | Quản lý thẻ |

Knowledge không tạo task; nối bài với task làm từ phía Tasks.

## 10. Logic thuần và test

`src/utils/kbDeriveUtils.js`, test `src/__tests__/core/kbDeriveUtils.test.js` (trong `npm test`):
wiki link (`parseWikiLinks`, `findBacklinks`, `getOutboundLinks`, `extractContext`), `deriveGraph`, `filterArticles`,
`normalizeVi`, `itemPlainText`, `isMine`, `ageDays`, `KIND_META`, `contentKind`, `sourceKey`, `guessTitle`,
`quickSortQueue`, `findNeighbors`, `suggestTopic`, `pickResurface`, `pushRecent`, `readTime`, `markdownToPlainText`,
`extractHeadings`, `isTiptapBody`, `tiptapToPlainText`.
Contract test thẻ / ghi chú: `src/__tests__/core/tagsAndKnowledgeContract.test.js`. Code gọi Supabase / React test tay.

## 11. Quyết định thiết kế

| Ý | Kết luận | Lý do |
|---|---|---|
| Gỡ giao diện cũ, làm lại | Không — nâng cấp tại chỗ | Chức năng cũ vẫn dùng tốt, chỉ thiếu |
| 7 loại phân loại | Thay bằng Chủ đề | 7 loại trộn chủ đề / định dạng / mục đích nên khó chọn |
| Trục "Muốn học / Tra cứu" | Không làm | Bắt đoán trước, thấy bị xé nhỏ |
| Trạng thái đọc (Đọc xong, Đọc dở, Tiến độ 5 bước) | **Đã làm rồi bỏ (2026-10-25)** | Knowledge để xem và đọc, không cần thao tác quy trình |
| Nút tạo task từ bài ("Thực hành") | **Bỏ (2026-10-25)** | Như trên; nối bài với task từ phía Tasks |
| Lưu trữ | **Bỏ (2026-10-25)**, chỉ còn Xoá | Gọn; bài không cần thì xoá |
| Hộp "Cất vào" nhanh, share từ app khác, thư viện ngoài, upload mới | Không làm | Tự copy link / chữ là đủ; Supabase bản free |
| Màn "Inbox" riêng | Không làm | Inbox đã gộp vào Tasks; thay bằng Xếp nhanh |
| Tách module con theo loại (GitHub, Video…) | Không làm | Nhân bản câu hỏi "bỏ vào đâu" |
| Trang tổng hợp tự viết (hub) | Để sau | Phải tự nối từng nguồn |
| Giao diện | Hướng "Thư phòng" (giữ ngôn ngữ hiện tại) mượn từ "Bàn làm việc": hàng chip chủ đề, Xếp nhanh từng bài | Phần mới cùng kiểu phần cũ |
| Bộ chủ đề khởi đầu | Chỉ định nghĩa trong SQL | Một nguồn sự thật cho migration và user mới |

## 12. Nợ đã biết

| # | Vấn đề |
|---|---|
| 1 | "Gắn thẻ" trong chọn nhiều chỉ mở hộp quản lý thẻ, không gắn thẻ vào các bài đã chọn |
| 2 | `KBLinkModal`, `KBTagModal` gọi setState trong effect khi mở (cảnh báo lint) |
| 3 | Xoá hàng loạt gọi `deleteItem` tuần tự |
| 4 | Kiểu xem / bài đang đọc không có URL riêng: F5 về Tổng quan, Back rời trang |
| 5 | `useRandomPodcast` không lọc `user_id`, dựa hoàn toàn vào RLS |
| 6 | `collection_notes.sort_order` có trong schema nhưng không dùng |
| 7 | Mở bài từ Tổng quan / Xung quanh khi bài không nằm trong danh sách đang lọc thì ↑ ↓ đi theo danh sách lọc |

## 13. Để sau

- Thu gọn `type` còn `note/quote/podcast`, bỏ `'inbox'` khỏi CHECK, đổi `DEFAULT 'inbox'` → `'note'` (có bảng sao lưu).
- Dọn cột `status` (giờ chỉ còn `read`; `archived` / `unread` là dữ liệu cũ).
- Nhóm nhỏ trong chủ đề khi một chủ đề > ~15 bài (dùng lại `tags`).
- Chip lọc loại / thời gian cho ô tìm (logic đã có trong `filterArticles`).
- Trang tổng hợp tự viết; lấy tiêu đề / ảnh thật qua API.

## 14. Checklist test tay

Cần đăng nhập.

- [ ] Soạn Markdown / Visual, media YouTube / Drive, `[[ ]]`, backlink, Sơ đồ, Canvas, Gallery, chọn nhiều, thẻ, J/K, ⌘Z.
- [ ] Bài mới dán link GitHub, tiêu đề trống → tự `owner/repo`; chọn chủ đề và Kiểu; bỏ trống chủ đề → Chưa xếp.
- [ ] Hàng chip lọc đúng ở Danh sách / Gallery / Sơ đồ / Canvas; Chưa xếp + Chọn nhiều + Gán chủ đề chuyển cả loạt.
- [ ] Tổng quan: Xếp nhanh chỉ bài 30 ngày, phím `1`–`8`, `→`; thẻ chủ đề mở đúng danh sách; Ghi chú của tôi; Gặp lại; Mở gần đây.
- [ ] Trang đọc: đổi chủ đề bằng select hiện ngay; Xung quanh 3 nhóm không lặp; thêm ghi chú → số ghi chú ở danh sách cập nhật.
- [ ] Quản lý chủ đề: đổi tên / màu / thứ tự; chủ đề thứ 9 bị chặn; gộp chuyển hết bài; xoá → bài về Chưa xếp.
- [ ] Gõ "tam ly" ra bài Tâm lý; `#thẻ` vẫn chạy; hàng thẻ không có thẻ Finance / Tasks.
- [ ] Điện thoại và chế độ sáng: phần mới đọc rõ, không tràn.
- [ ] Podcast nổi vẫn phát bài kiểu Podcast.
