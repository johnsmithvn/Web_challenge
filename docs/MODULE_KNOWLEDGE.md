# Module Knowledge (Kiến Thức)

> Tài liệu duy nhất của module Knowledge (`/collect`). Cập nhật 2026-10-24 từ code nhánh `main`.
> **Phần A** mô tả code đang chạy. **Phần B** là kế hoạch Knowledge v2 (đã duyệt, đang làm) và tiến độ.
> Nhãn theo `docs/RULES.md` §1: **[Đã kiểm]** = đọc từ code/schema, **[Giả định]** = cần xác nhận.
> Bản tóm tắt cho người dùng nằm ở `docs/FEATURES.md`.

## Mục lục

**A. Hiện trạng** — [A1 Tổng quan](#a1-tổng-quan) · [A2 Dữ liệu](#a2-dữ-liệu) · [A3 Màn hình](#a3-màn-hình) ·
[A4 Media](#a4-media) · [A5 Ghi chú cá nhân](#a5-ghi-chú-cá-nhân) · [A6 Thẻ](#a6-thẻ) ·
[A7 Liên kết module khác](#a7-liên-kết-module-khác) · [A8 Kiểm thử](#a8-kiểm-thử) · [A9 Nợ đã biết](#a9-nợ-đã-biết)

**B. Knowledge v2** — [B0 Tiến độ](#b0-tiến-độ) · [B1 Vấn đề](#b1-vấn-đề) · [B2 Nguyên tắc](#b2-nguyên-tắc) ·
[B3 Quy chuẩn phân loại](#b3-quy-chuẩn-phân-loại) · [B4 Luồng UX](#b4-luồng-ux) · [B5 Màn hình](#b5-màn-hình) ·
[B6 Dữ liệu và migration](#b6-dữ-liệu-và-migration) · [B7 Logic thuần](#b7-logic-thuần) ·
[B8 Kế hoạch theo file](#b8-kế-hoạch-theo-file) · [B9 Ngoài phạm vi](#b9-ngoài-phạm-vi) ·
[B10 Rủi ro](#b10-rủi-ro-và-đánh-đổi) · [B11 Checklist test tay](#b11-checklist-test-tay)

---

# A. Hiện trạng

## A1. Tổng quan

| Thuộc tính | Giá trị |
|---|---|
| Route | `/collect`, lazy chunk `CollectPage` (`src/App.jsx`) |
| Đăng nhập | Bắt buộc. Chưa đăng nhập → "Đăng nhập để xem Kho Kiến Thức" |
| Giao diện | Tối mặc định, có bản sáng. Token riêng `src/styles/kb-tokens.css` (nền tím than, chữ vàng đồng `--kb-brass`, font chữ có chân Spectral + mono JetBrains Mono); style ở `src/styles/collect.css` |
| Media | Chỉ là link ngoài (YouTube, Google Drive, file âm thanh/video). Không dùng Supabase Storage |

### A1.1. Bản đồ file

| Vai trò | File |
|---|---|
| Trang, điều phối view và phím tắt | `src/pages/CollectPage.jsx` |
| Đầu trang (tìm, chọn kiểu xem, Bài mới) | `src/components/kb/KBSubHeader.jsx` |
| Danh sách | `src/components/kb/KBListView.jsx` |
| Gallery thẻ | `src/components/kb/KBGalleryView.jsx` |
| Sơ đồ liên kết | `src/components/kb/KBGraphView.jsx` |
| Canvas kéo thả | `src/components/kb/KBCanvasView.jsx` |
| Trang đọc | `src/components/kb/KBReaderView.jsx` |
| Trình soạn thảo | `src/components/kb/KBEditorView.jsx` (+ `TiptapEditor.jsx`, `SlashCommand.jsx`, `extensions/MediaNode.jsx`) |
| Hộp nối `[[ ]]`, quản lý thẻ, phím tắt | `KBLinkModal.jsx`, `KBTagModal.jsx`, `KBShortcutsModal.jsx` |
| Dữ liệu bài | `src/hooks/useCollections.js` |
| Chủ đề (v2) | `src/hooks/useCollectionTopics.js` |
| Ghi chú cá nhân | `src/hooks/useCollectionNotes.js` |
| Thẻ (dùng chung 3 module) | `src/hooks/useTags.js` |
| Logic thuần | `src/utils/kbDeriveUtils.js`, `src/utils/mediaUtils.js` |
| Media | `MediaPreview.jsx`, `CustomAudioPlayer.jsx`, `UrlInputPopover.jsx` |
| Podcast nổi toàn app | `GlobalAudioPlayer.jsx` + `useRandomPodcast.js` |
| API | `api/upload.js` (upload lên Google Drive), `api/stream.js` (proxy phát file Drive) |

## A2. Dữ liệu

### A2.1. Bảng `collections` [Đã kiểm]

| Cột | Vai trò |
|---|---|
| `type` | `CHECK IN ('inbox','note','quote','learn','idea','ai','entertainment','podcast')`, `DEFAULT 'inbox'`. Inbox đã gộp vào Tasks (migration `20260926000000`), app không còn ghi `inbox`. v2 chỉ ghi `note` / `quote` / `podcast` |
| `topic_id` | **v2** — chủ đề (`collection_topics`), NULL = Chưa xếp. FK hai cột `(user_id, topic_id)`. Có sau migration `20261025000000` |
| `title` | Bắt buộc. Với trích dẫn: tên tác giả |
| `url` | Link nguồn; hậu tố `#audio` / `#video` ép cách hiển thị |
| `body`, `body_text`, `word_count`, `content_format` | Markdown thô **hoặc** JSON Tiptap; `body_text` là chữ trơn dùng cho trích đoạn và tìm kiếm |
| `status` | `unread` / `read` / `archived`. UI hiện tại luôn lưu bài mới là `read`, chưa có nút lưu trữ |
| `created_at`, `updated_at` | Trigger `trg_collections_updated_at` |

Bảng phụ: `collection_tags` (bài ↔ thẻ), `task_collections` (bài ↔ task, RLS kiểm cả hai phía), `collection_notes`
(ghi chú cá nhân, cascade khi xoá bài), `collection_topics` (v2).

### A2.2. Dữ liệu `useCollections` trả về

Một query, tối đa 500 bài mới nhất, kèm join: thẻ, id task đã nối, nội dung ghi chú. Mỗi bài có thêm
`_tags`, `_linkedTaskIds`, `_linkedTaskCount`, `_notes`, `_noteCount`. Mặc định bỏ bài `archived`
(tuỳ chọn `includeArchived`).

## A3. Màn hình

### A3.1. Đầu trang (`KBSubHeader`)

Tiêu đề "Kho Tàng Kiến Thức" + số bài · ô tìm (phím `/`) · chọn kiểu xem **Danh sách · Gallery · Sơ đồ · Canvas** ·
nút **＋ Bài mới**. Ẩn khi đang đọc hoặc soạn.

Tìm kiếm (`filterArticles`): không cần dấu, nhiều từ cùng lúc (mọi từ phải khớp), trên tiêu đề, chữ của bài
(`body_text`, không phải JSON thô), link, tên thẻ, ghi chú. Gõ `#tên` để lọc theo thẻ.

### A3.2. Danh sách (`KBListView`)

- Hàng chip loại (7 loại cũ, có số đếm), sắp xếp Mới nhất / Cũ nhất / Dài nhất, nút Chọn.
- Hàng thẻ để lọc (nhiều thẻ = AND).
- Mỗi dòng: icon loại, dòng meta (loại · tên miền · ngày · phút đọc), tiêu đề, trích 200 chữ, nhãn thẻ /
  số liên kết `[[ ]]` / số task / số ghi chú, nút Sửa và Xoá.
- Chọn nhiều: Chọn tất cả, Gắn thẻ, Xoá hàng loạt.

### A3.3. Gallery, Sơ đồ, Canvas

- **Gallery:** lưới thẻ cho mọi bài: nhãn loại, câu trích, tiêu đề và ngày.
- **Sơ đồ:** đồ thị lực, cạnh từ `[[ ]]` và từ thẻ chung (`deriveGraph`), có panel bên.
- **Canvas:** bảng trắng kéo thả node và nối cạnh; lưu ở `localStorage` (`kb_canvas_nodes`, `kb_canvas_edges`).

### A3.4. Trang đọc (`KBReaderView`)

- **Thanh trên:** ← Thư viện · ↑ ↓ bài trước/sau · Tập trung (`F`) · ↔ Liên kết · ◇ Nhiệm vụ (tạo task nối với bài) ·
  ✎ Sửa (`E`) · ⌫ Xoá. Có vạch tiến độ đọc.
- **Nội dung:** meta, tiêu đề, thẻ, media preview nếu có link, thân bài (Tiptap read-only hoặc Markdown),
  phần **Ghi chú cá nhân**.
- **Cột phải, 6 thẻ:** thông tin & thống kê · sơ đồ nhỏ quanh bài · mục lục (bài Markdown) · liên kết đi ·
  backlink · task liên kết.

### A3.5. Trình soạn thảo (`KBEditorView`)

- Chọn Markdown / Visual (bài mới; bài đã có giữ nguyên định dạng), thống kê chữ, nút nối `[[ ]]`, Lưu (`Ctrl+S`).
- Tiêu đề, hàng chip loại, ô thẻ, ô URL (có Audio / Video).
- **Markdown:** khung viết + xem trước song song, thanh công cụ, chèn ảnh / YouTube / audio.
- **Visual (Tiptap):** thanh công cụ, menu `/`, bảng, task list, dán URL media tự thành khối, dán/thả ảnh tự upload.

### A3.6. Phím tắt (`CollectPage`)

`/` tìm · `N` bài mới · `V` chọn nhiều · `J`/`K` di chuyển · `Enter` mở · `E` sửa · `Backspace` xoá ·
`⌘Z` hoàn tác xoá · `G` rồi `L`/`G`/`C`/`Q` đổi kiểu xem · `?` bảng phím tắt · `Esc` lùi từng lớp.

### A3.7. Xoá và hoàn tác

Xoá có xác nhận; toast "Hoàn tác" hoặc `⌘Z` chèn lại bài (bằng `addItem`, giữ nội dung và chủ đề).

## A4. Media

`getMediaType(url)` (`mediaUtils.js`), dừng ở điều kiện khớp đầu tiên:

| Kết quả | Điều kiện | Hiển thị |
|---|---|---|
| `youtube` | `watch?v=`, `youtu.be/`, `/embed/`, `/shorts/` | iframe `youtube-nocookie.com` |
| `drive` | link Google Drive | mặc định trình phát audio qua `/api/stream`; có `#video` → iframe Drive |
| `audio` | `#audio` / `#podcast`, `type=audio`, `mime=audio/*`, đuôi `.mp3 .m4a .ogg .wav .aac .flac .webm` | `CustomAudioPlayer` |
| `video` | `#video`, `type=video`, `mime=video/*`, đuôi `.mp4 .webm .ogg .ogv .mov .mkv` | `<video>` |
| `link` | còn lại | không nhúng |

- Hậu tố `#audio` / `#video` được **lưu thẳng vào URL** (nút Audio/Video ở trình soạn thảo, nút đổi dạng trong
  `MediaPreview`, paste rule của `MediaNode`).
- `/api/stream?id=` chỉ phục vụ file trong thư mục Drive cấu hình của app, có rate limit và hỗ trợ `Range`.
- `/api/upload` cần JWT Supabase, giới hạn 4 MB, upload lên Google Drive (không phải Supabase). Dùng khi dán/thả
  ảnh vào Visual editor hoặc nút upload trong `UrlInputPopover`. v2 không thêm đường upload nào.

## A5. Ghi chú cá nhân

`useCollectionNotes`: thêm / sửa / xoá ghi chú của một bài (optimistic), sắp theo `created_at`. Ở trang đọc:
sửa tại chỗ, `Ctrl+Enter` lưu, `Esc` huỷ. Xoá bài → ghi chú bị xoá theo (cascade).
v2 dùng ghi chú này làm "điều rút ra".

## A6. Thẻ

`useTags` dùng chung cho Finance, Knowledge, Tasks; mỗi module một junction (`collection_tags` cho Knowledge).
Tên thẻ chuẩn hoá chữ thường; trùng tên (`23505`) thì trả thẻ có sẵn. Quản lý tập trung ở Cài đặt; xoá thẻ thì
gỡ khỏi mọi bài (cascade).

## A7. Liên kết module khác

| Module | Cơ chế |
|---|---|
| Tasks → Knowledge | `LinkKBModal` trong task: chọn / bỏ bài đã có (junction `task_collections`), ghi activity log |
| Knowledge → Tasks | Nút ◇ Nhiệm vụ ở trang đọc: `addTask` + `linkCollection` |
| Trang chủ | `useCollections.fetchStats` đếm bài cho ô Knowledge |
| Podcast nổi | `useRandomPodcast` lấy bài `type = 'podcast'` có link, phát ngẫu nhiên ở mọi trang |
| Cài đặt | Quản lý thẻ |

`useUserTasks` chỉ tải task **chưa xong + xong trong hôm nay**.

## A8. Kiểm thử

- `src/__tests__/core/kbDeriveUtils.test.js` — logic thuần: wiki link, đồ thị, backlink, lọc/tìm, đọc giờ,
  Markdown → chữ, mục lục, nhận Tiptap, và toàn bộ hàm v2 (§B7).
- `src/__tests__/core/tagsAndKnowledgeContract.test.js` — contract đọc source cho thẻ và ghi chú.
- Cả hai nằm trong `npm test`. Code gọi Supabase/React test tay.

## A9. Nợ đã biết

| # | Vấn đề | Xử lý |
|---|---|---|
| 1 | Hàng thẻ gộp toàn bộ thẻ của user, lẫn thẻ Finance/Tasks | v2 §B5.4 |
| 2 | Không có nút lưu trữ; bài mới luôn lưu `read` | v2 §B3.4, §B3.5 |
| 3 | `LinkKBModal.TYPE_ICONS` chỉ biết 4 loại cũ (`link/quote/learn/idea`) | v2 §B8 |
| 4 | Xoá hàng loạt gọi `deleteItem` tuần tự | Chưa xử lý |
| 5 | Kiểu xem / bài đang đọc không có URL riêng: F5 về danh sách, Back rời trang | Chưa xử lý, có chủ đích |
| 6 | `useRandomPodcast` không lọc `user_id`, dựa hoàn toàn vào RLS | Chưa xử lý |
| 7 | `type DEFAULT 'inbox'` + CHECK còn `'inbox'` | Để sau (§B6.4) |
| 8 | `collection_notes.sort_order` có trong schema nhưng không dùng | Chưa xử lý |

---

# B. Knowledge v2

> **Đã duyệt 2026-10-24.** Nâng cấp tại chỗ: **giữ toàn bộ chức năng ở Phần A, chỉ thêm và sửa nhẹ**, không gỡ màn nào.
> Giao diện: hướng **1a "Thư phòng"** (giữ ngôn ngữ hình ảnh hiện tại) **mượn 3 thứ từ 1b** (§B5.1).
> Không lưu mockup vào repo; chuẩn hình được mô tả ở §B5.

## B0. Tiến độ

| Bước | Việc | Trạng thái |
|---|---|---|
| B0 | Duyệt thiết kế | ✓ |
| B1 | Logic thuần + test (§B7) | ✓ `npm test` xanh |
| B2 | Migration + `useCollectionTopics` + sửa `useCollections` | Code xong. **Chờ chạy preflight + migration** (§B6.3) |
| B3 | Hàng chip chủ đề, Quản lý chủ đề, trình soạn thảo, Danh sách + Gán chủ đề hàng loạt | Chưa |
| B4 | Tab Tổng quan | Chưa |
| B5 | Trang đọc: Đọc xong, Tiến độ, Xung quanh, Thực hành, Lưu trữ | Chưa |
| B6 | `DATABASE.md`, `FEATURES.md`, `ARCHITECTURE.md`, `DESIGN.md`, `CHANGELOG.md` | Chưa |

> **Thứ tự bắt buộc:** chạy migration **trước** khi chạy bản code có B2 — `addItem` đã ghi cột `topic_id`,
> chưa có cột thì lưu bài sẽ lỗi.

## B1. Vấn đề

**Nỗi đau người dùng đã xác nhận:** cất thì dễ nhưng dùng lại khó · phải quyết định quá nhiều lúc cất · nhiều mục đích
trộn trong một danh sách · không có vòng biến thông tin thành kiến thức của mình.

**Trong code:** 7 loại trộn chủ đề, định dạng và mục đích nên khó chọn; màn chính là danh sách bài chạy dài, không có
"bản đồ"; "liên quan" chỉ có khi tự nối `[[ ]]`; cùng các nợ §A9.

**Đã cân nhắc và không làm:**

| Ý | Vì sao không |
|---|---|
| Gỡ giao diện cũ, làm lại từ đầu | Người dùng thích chức năng hiện tại, chỉ thấy còn thiếu |
| Hộp "Cất vào" nhanh, share từ Facebook, thư viện ngoài | Tự copy link / chữ vào thành bài viết là đủ |
| Upload mới | Supabase bản free; media dùng link ngoài |
| Màn "Inbox" riêng | Inbox đã gộp vào Tasks; thay bằng khối Xếp nhanh |
| Trục "Muốn học / Tra cứu" | Bắt đoán trước, thấy bị xé nhỏ; thay bằng Tiến độ tự ghi |
| Tách module con theo loại | Nhân bản câu hỏi "bỏ vào đâu" |
| Trang tổng hợp tự viết (hub) | Phải tự nối từng nguồn; để sau |
| Giao diện sáng kiểu tạp chí (1c) | Chọn 1a để phần mới cùng kiểu phần cũ |

## B2. Nguyên tắc

1. **Thêm vào, không gỡ.**
2. **Một quyết định khi lưu: Chủ đề**, để trống cũng được.
3. **Trạng thái là việc đã làm**, không phải ngăn phải chọn.
4. **Tìm lại theo cách người dùng nhớ:** vài chữ không dấu, nguồn, thời gian, "những thứ ở gần".
5. **Luật do app giữ** (tối đa 8 chủ đề), không bắt người dùng nhớ.
6. **Không tạo đống việc tồn:** khối nào cũng giới hạn số mục, mục để lâu thì hỏi lại, không có số đếm đỏ.

## B3. Quy chuẩn phân loại

### B3.1. Ba trục

| Trục | Câu hỏi | Ai quyết | Số lượng |
|---|---|---|---|
| **Chủ đề** | Nó thuộc mảng nào trong đời mình? | Người dùng, một lần, để trống được | Tối đa 8, mỗi bài đúng 1 |
| **Loại** | Nó là cái gì? | Máy tự nhận từ link (`contentKind`) | Cố định |
| **Tiến độ** | Mình đã làm gì với nó? | Tự ghi theo nút bấm (`progressOf`) | 5 bước |

Trình soạn thảo có thêm **Kiểu** để giữ tính năng cũ: *Bài viết* (`note`, mặc định) · *Trích dẫn* (`quote`) ·
*Podcast* (`podcast`, trình phát nổi). Bài cũ mang `learn/idea/ai/entertainment` được coi là *Bài viết*.

### B3.2. Chủ đề

**Bộ khởi đầu** (nguồn duy nhất: hàm SQL `seed_starter_collection_topics`):

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
3. Chủ đề đủ rộng để chứa nhiều dạng nội dung; không tạo "AI Videos", "AI Repos".
4. Chủ đề là mảng quan tâm lâu dài; dự án / việc cần làm thuộc Tasks (nút Thực hành).
5. Chỉ tạo chủ đề mới khi có ≥ 5 bài mà không chủ đề nào hợp.
6. **Tối đa 8.** Đủ 8 thì "Tạo chủ đề" đổi thành "Gộp chủ đề"; DB cũng chặn (trigger).
7. Tên 1–4 chữ, không trùng nghĩa; mỗi chủ đề có một dòng định nghĩa.
8. Câu nói gắn với một mảng thì về mảng đó; thứ chỉ để vui → Giải trí.

### B3.3. Loại (`contentKind`)

| Điều kiện | Loại |
|---|---|
| Kiểu Trích dẫn | Trích dẫn |
| `github.com/<owner>/<repo>` (trừ `/topics`, `/orgs`…) | Repo |
| YouTube; Drive có `#video` | Video |
| `facebook.com`, `fb.watch`, `m.facebook.com` | Bài FB |
| Link âm thanh; Drive không có `#video` | Âm thanh |
| Link khác | Bài viết |
| Không có link | Ghi chú |

### B3.4. Tiến độ (`progressOf`)

```
Chưa đọc xong ─▶ Đã đọc ─▶ Đã rút ra ─▶ Đang thực hành ─▶ Đã thực hành
  (unread)      (read)    (có ghi chú)  (có task chưa xong) (task đã xong)
```

- Không bắt buộc đi hết. Trích dẫn dừng ở "Đã đọc" là đủ.
- Bài mới **có link** → `unread`; **không có link** → `read`.
- "Đọc xong" là nút bật/tắt; bấm xong con trỏ vào ô ghi chú cá nhân (bỏ qua được).
- "Đã thực hành" được suy ra: task đã nối nhưng không còn trong danh sách task chưa xong ⇒ đã xong
  (task bị xoá thì junction cascade theo). Lý do: `useUserTasks` không tải task xong từ trước hôm nay.
- `unread` quá 30 ngày (`isStale`) → "Còn muốn đọc không?" [Đọc xong] [Lưu trữ].

### B3.5. Lưu trữ và Xoá

- **Lưu trữ** (`status = 'archived'`): ẩn khỏi mọi danh sách, còn trong DB; tìm kiếm có chip "Gồm cả đã lưu trữ"; có Hoàn tác.
- **Xoá:** như hiện tại.

### B3.6. Thẻ

Giữ nguyên; chỉ sửa hàng lọc để hiện thẻ đang được bài Knowledge dùng.

## B4. Luồng UX

### B4.1. Lưu một bài

1. **＋ Bài mới**.
2. Dán link → nếu tiêu đề trống, tự điền tiêu đề đoán (`guessTitle`: repo → `owner/repo`, YouTube → "Video YouTube",
   Facebook → "Bài Facebook", còn lại → tên miền).
3. Chọn chủ đề: hàng chip, gợi ý (`suggestTopic`) tô sẵn. Không chọn = Chưa xếp.
4. Viết vài dòng "lưu để làm gì" hoặc dán đoạn chữ (nên làm với bài Facebook vì bài có thể bị xoá).
5. Lưu.

### B4.2. Xếp bài chưa có chủ đề

- **Bài trong 30 ngày:** khối **Xếp nhanh** ở Tổng quan, từng bài một: tiêu đề, loại, dòng đầu, chip chủ đề
  (gợi ý tô sẵn) + "Để sau" + "Lưu trữ". Máy tính: phím **1–8**, `→` để sau.
- **Bài cũ hơn:** không hiện ở Tổng quan. Danh sách → chip **Chưa xếp** → Chọn nhiều → **Gán chủ đề**.

### B4.3. Đọc xong, rút ra, thực hành

- **Đọc xong** → "✓ Đã đọc", con trỏ vào ô ghi chú; viết 1 câu → "Đã rút ra".
- **◇ Nhiệm vụ** đổi nhãn thành **◇ Thực hành**, giữ hành vi tạo task nối với bài.

### B4.4. Tìm lại

Ô tìm như §A3.1; khi đang có chữ, hiện thêm chip **Loại** · **Thời gian** (Tuần này, Tháng này, 3 tháng, Cũ hơn) ·
**Gồm cả đã lưu trữ**. Tìm thêm cả tên chủ đề.

### B4.5. Gặp lại và Mở gần đây

- **Gặp lại hôm nay** (`pickResurface`): 3 bài cũ hơn 30 ngày có ghi chú, là trích dẫn hoặc ghi chú của mình; không
  bốc link trơn; cố định trong ngày.
- **Mở gần đây** (`pushRecent`): 3 bài mở gần nhất, `localStorage` key `vl_kb_recent` (10 id).

### B4.6. Quản lý chủ đề

Menu "…" ở hàng chip → hộp **Quản lý chủ đề**: thêm, đổi tên, định nghĩa, màu, lên/xuống, gộp, xoá.
**Gộp** = RPC `merge_collection_topics` (chuyển bài rồi xoá, một transaction). **Xoá** → bài về Chưa xếp.
User chưa có chủ đề nào → nút "Dùng bộ chủ đề gợi ý" (RPC `seed_starter_collection_topics`).

### B4.7. Đếm thao tác

| Tình huống | Bắt buộc | Tuỳ chọn, về sau |
|---|---|---|
| Lướt FB thấy bài hay | Bài mới → dán link (+ chữ) → Lưu | Chủ đề lúc lưu hoặc ở Xếp nhanh |
| Repo AI, muốn thử | Bài mới → dán link → Lưu | Đọc xong (+1 câu) · Thực hành |
| Bài đọc dở | Bài mới → dán link → Lưu | Đọc xong khi đọc hết |
| Truyện hài, câu nói | Bài mới → dán chữ → Lưu | Đọc lại ở Gallery / Gặp lại |

## B5. Màn hình

### B5.1. Chuẩn hình: 1a mượn 1b

- Giữ ngôn ngữ hình ảnh hiện tại (`kb-tokens.css`, có sẵn bản sáng): nền tím than, viền mảnh, chữ tiêu đề Spectral,
  nhãn nhỏ mono viết hoa, màu nhấn vàng đồng; phần mới cùng kiểu phần cũ.
- **Mượn từ 1b:**
  1. **Hàng chip chủ đề cố định dưới tiêu đề** (không thêm cột trái thứ hai vì app đã có thanh điều hướng 232px);
     điện thoại cuộn ngang.
  2. **Xếp nhanh từng bài** bằng phím số / chip.
  3. **Tiến độ 5 bước** trong thẻ thông tin ở cột phải trang đọc.
- **Quy định khi code:** nút hành động ghi "Đọc xong", đã bấm thì hiện "✓ Đã đọc" · không hiển thị dữ liệu cần API
  ngoài (mô tả / ngôn ngữ repo, README, thời lượng video); ảnh thu nhỏ YouTube từ ID video thì được · chữ nhỏ viết hoa
  mono tối thiểu 11px · có bản điện thoại (§B5.7) và bản sáng.

### B5.2. Đầu trang (`KBSubHeader`)

- **Giữ:** tiêu đề, ô tìm, kiểu xem, ＋ Bài mới.
- **Thêm:** tab **Tổng quan** đứng đầu: `Tổng quan · Danh sách · Gallery · Sơ đồ · Canvas`; mở Knowledge vào Tổng quan.
- **Thêm:** hàng chip `Tất cả · Chưa xếp · <chủ đề: chấm màu + số bài> · …`; chip đang chọn lọc mọi kiểu xem.

### B5.3. Tab Tổng quan (mới, `KBOverview`)

| # | Khối | Hiện khi | Giới hạn |
|---|---|---|---|
| 1 | "Đã lưu trữ … · Hoàn tác" | Vừa lưu trữ | 1 dòng |
| 2 | **Xếp nhanh · n/N** | Có bài chưa có chủ đề trong 30 ngày | 1 bài một lúc |
| 3 | **Đọc dở · N** | Có bài `unread` | 3 thẻ + "Xem cả N"; bài > 30 ngày hiện câu hỏi |
| 4 | **Các chủ đề** | Luôn | Thẻ: tên, số bài, định nghĩa, 2 bài mới nhất, "N đọc dở"; thẻ cuối **Ghi chú của tôi** |
| 5 | **Gặp lại hôm nay · Mở gần đây** | Có dữ liệu | 2 cột × 3 bài |

Đang gõ tìm thì các khối ẩn, hiện kết quả như Danh sách.

### B5.4. Danh sách (`KBListView`, sửa nhẹ)

- **Giữ:** dòng bài, sắp xếp, chọn nhiều, xoá / gắn thẻ hàng loạt, hàng thẻ, J/K.
- **Đổi:** bỏ hàng chip 7 loại (đã có hàng chip chủ đề); dòng meta hiện chấm màu + chủ đề, loại, nhãn tiến độ.
- **Thêm:** **Gán chủ đề** trong thanh chọn nhiều; khi lọc một chủ đề, đầu danh sách hiện tên + định nghĩa + "…".
  Đây chính là trang một chủ đề.
- **Sửa:** hàng thẻ chỉ còn thẻ đang được bài Knowledge dùng.

### B5.5. Trang đọc (`KBReaderView`, thêm)

- **Thanh trên — thêm:** chip chủ đề (bấm để đổi), **Đọc xong**, mục **Lưu trữ**; đổi nhãn ◇ Nhiệm vụ → ◇ Thực hành.
- **Cột phải — giữ** 6 thẻ; **thêm** Tiến độ 5 bước vào thẻ thông tin và thẻ **Xung quanh** (`findNeighbors`) ngay dưới:
  *Cùng chủ đề* · *Cùng nguồn* · đường gạch · *Lưu gần thời điểm* (±7 ngày, khác chủ đề, "có thể khác chủ đề").
- Thẻ task liên kết giữ như cũ, thêm dòng "N task đã xong".

### B5.6. Trình soạn thảo (`KBEditorView`, sửa)

- Hàng chip 7 loại → **chip chủ đề** (gợi ý tô sẵn) + **Kiểu: Bài viết / Trích dẫn / Podcast**.
- Tiêu đề tự đoán từ link khi trống.
- Giữ mọi thứ khác.

### B5.7. Điện thoại

Hàng chip cuộn ngang · Tổng quan xếp dọc, Đọc dở 1 cột · Xếp nhanh: chip xuống dòng, đủ lớn để bấm ·
cột phải trang đọc xuống dưới nội dung.

### B5.8. Gallery, Sơ đồ, Canvas

Giữ chức năng; màu và nhãn theo chủ đề thay 7 loại cũ.

## B6. Dữ liệu và migration

### B6.1. Mô hình

| Khái niệm | Lưu ở đâu |
|---|---|
| Chủ đề | Bảng `collection_topics` (mới) |
| Chủ đề của bài | `collections.topic_id` (mới) |
| Kiểu | `collections.type` = `note` / `quote` / `podcast` |
| Loại | Tính từ `url` + `type`, không lưu |
| Chưa đọc xong / Đã đọc / Lưu trữ | `collections.status` |
| Đã rút ra | Có ≥ 1 dòng `collection_notes` |
| Đang / Đã thực hành | `task_collections` + danh sách task chưa xong |
| Mở gần đây | `localStorage` `vl_kb_recent` |

### B6.2. Schema mới (migration `20261025000000_knowledge_topics_v6_32_0.sql`)

- **`collection_topics`**: `id, user_id, name (1–40 ký tự), description, color, sort_order, created_at, updated_at`;
  `UNIQUE (user_id, id)`; tên không trùng theo user (không phân biệt hoa thường); RLS 4 policy theo `auth.uid()`;
  trigger `updated_at`; trigger **tối đa 8** (có advisory lock theo user).
- **`collections.topic_id`**: FK `(user_id, topic_id) → collection_topics (user_id, id) ON DELETE SET NULL (topic_id)` —
  bài và chủ đề luôn cùng chủ; xoá chủ đề → bài về Chưa xếp. Cần **Postgres 15+**, migration tự từ chối nếu thấp hơn.
- **`seed_starter_collection_topics(p_user)`**: chèn bộ 7 chủ đề, chỉ khi user chưa có chủ đề nào. `SECURITY INVOKER`,
  chỉ `authenticated` được gọi.
- **`merge_collection_topics(p_from, p_to)`**: chuyển bài rồi xoá chủ đề nguồn, một transaction. `SECURITY INVOKER`.

### B6.3. Chạy migration

1. **Preflight** (chỉ đọc):
   ```sql
   SHOW server_version;
   SELECT type, status, count(*) FROM collections GROUP BY 1, 2 ORDER BY 1, 2;
   ```
2. Chạy `psql -f supabase/migrations/20261025000000_knowledge_topics_v6_32_0.sql` (người dùng chạy; RULES §12).
3. Migration làm, trong một transaction:
   - tạo bảng, RLS, trigger, cột, FK, index, 2 hàm;
   - tạo bộ chủ đề cho mỗi user đang có bài;
   - gán chủ đề theo `type` cũ: `ai` → Công nghệ & AI · `entertainment` → Giải trí · `learn` → Học tập & Năng suất ·
     `idea` → Ý tưởng & Thiết kế; còn lại Chưa xếp;
   - tạm tắt trigger `updated_at` khi gán để không đổi ngày sửa của bài;
   - verify: RLS bật, đủ 4 policy, FK có, trigger đã bật lại, không user nào quá 8 chủ đề.
4. Không đổi `type`, `status` của bài nào. Không xoá dữ liệu. Chạy lại an toàn.
5. Rollback ghi sẵn cuối file (xoá bảng, cột và hàm — mất mọi chủ đề và cách gán).

### B6.4. Để sau

Thu gọn `type` còn `note/quote/podcast`, bỏ `'inbox'` khỏi CHECK, đổi `DEFAULT 'inbox'` → `'note'`, có bảng sao lưu.

## B7. Logic thuần

`src/utils/kbDeriveUtils.js`, test ở `src/__tests__/core/kbDeriveUtils.test.js`.

| Hàm | Làm gì |
|---|---|
| `normalizeVi`, `itemPlainText` | Bỏ dấu + chữ thường; chữ trơn của bài (`body_text` hoặc suy từ Tiptap / Markdown) |
| `filterArticles` | Lọc loại cũ, thẻ, task, **chủ đề** (`'none'` = Chưa xếp), **loại**, **thời gian** (`7`/`30`/`90`/`old`), **lưu trữ**; tìm không dấu nhiều từ trên tiêu đề, chữ, link, chủ đề (`_topic.name`), thẻ, ghi chú; `#thẻ` |
| `KIND_META`, `contentKind` | Nhãn / ký hiệu và cách nhận Loại (§B3.3) |
| `sourceKey` | Khoá "cùng nguồn": `github.com/<owner>`, trang / nhóm Facebook, tên miền; YouTube → null |
| `guessTitle` | Tiêu đề đoán từ link |
| `progressOf`, `isStale` | Tiến độ (§B3.4); `unread` quá 30 ngày |
| `findNeighbors` | 3 nhóm Xung quanh, không lặp bài |
| `suggestTopic` | Cùng nguồn đã xếp ≥ 2 lần (≥ 50%) → cùng loại dồn về một chủ đề (≥ 3 bài, ≥ 60%; bỏ qua ghi chú / bài viết) → tên chủ đề (phần tách bởi `&`, ≥ 4 ký tự) khớp đúng một chủ đề → không gợi ý |
| `pickResurface` | 3 bài Gặp lại, cố định theo ngày (hash FNV-1a) |
| `pushRecent` | Danh sách Mở gần đây: đưa lên đầu, bỏ trùng, tối đa 10 |

`TYPE_GLYPHS` (7 loại cũ) còn dùng tới B3, sau đó thay bằng `KIND_META` + màu chủ đề.

## B8. Kế hoạch theo file

**Đã làm (B1–B2):** `kbDeriveUtils.js` + test · `useCollectionTopics.js` (mới) · `useCollections.js` (một query thay
chuỗi fallback cũ; join ghi chú; ghi `topic_id`) · migration (mới) · xoá `src/data/knowledge.json` (không còn ai
import từ khi bỏ Inbox) và gỡ khỏi danh sách ở `RULES.md` §6.

**Còn lại:**

| File | Việc | Bước |
|---|---|---|
| `src/components/kb/KBTopicPicker.jsx` (mới) | Hàng chip chọn chủ đề + gợi ý | B3 |
| `src/components/kb/KBTopicModal.jsx` (mới) | Quản lý chủ đề (theo mẫu `KBTagModal`) | B3 |
| `src/pages/CollectPage.jsx` | Lọc chủ đề; gán chủ đề lẻ / hàng loạt; trạng thái bài mới theo §B3.4; `_topic` cho bài; view `overview` mặc định; đọc xong; lưu trữ + hoàn tác; `g t` | B3–B5 |
| `src/components/kb/KBSubHeader.jsx` | Tab Tổng quan; hàng chip chủ đề | B3–B4 |
| `src/components/kb/KBListView.jsx` | §B5.4 | B3 |
| `src/components/kb/KBEditorView.jsx` | §B5.6 | B3 |
| `src/components/kb/KBGalleryView.jsx`, `KBGraphView.jsx`, `KBCanvasView.jsx` | Màu / nhãn theo chủ đề | B3 |
| `src/components/LinkKBModal.jsx` | `TYPE_ICONS` → `KIND_META` | B3 |
| `src/components/kb/KBOverview.jsx` (mới) | Tab Tổng quan §B5.3 | B4 |
| `src/components/kb/KBReaderView.jsx` | §B5.5 | B5 |
| `src/components/kb/KBShortcutsModal.jsx` | Phím mới | B4 |
| `src/styles/collect.css` | Style phần mới | B3–B5 |
| `docs/DATABASE.md`, `FEATURES.md`, `ARCHITECTURE.md`, `DESIGN.md`, `CHANGELOG.md` | Cập nhật đúng vai trò (RULES §11); chỉ thêm phần Knowledge | B6 |

Không xoá component nào.

## B9. Ngoài phạm vi

Thu gọn `type` (§B6.4) · nhóm nhỏ trong chủ đề (khi một chủ đề > ~15 bài) · trang tổng hợp tự viết · lấy tiêu đề /
ảnh / mô tả thật qua server hoặc API · upload mới, share từ app khác, thư viện ngoài · AI phân loại, tìm bằng ngôn ngữ
tự nhiên, ôn tập ngắt quãng.

## B10. Rủi ro và đánh đổi

| Rủi ro | Cách xử lý |
|---|---|
| Ranh giới chủ đề mờ | Định nghĩa hiện khi chọn; phép thử "sẽ tìm ở đâu"; đổi 1 chạm; tìm không phụ thuộc chủ đề |
| Bài cũ chưa xếp làm nản | Không hiện ở Tổng quan; xếp hàng loạt khi rảnh |
| Gợi ý chủ đề sai lúc ít dữ liệu | Chỉ gợi ý, không tự xếp; thiếu dữ kiện thì không gợi ý |
| Đầu trang dày hơn | Hàng chip một dòng, cuộn ngang |
| Join ghi chú làm query nặng hơn | ≤ 500 bài, chỉ lấy `content` |
| Bài Facebook mất nội dung | Khuyến khích dán kèm chữ khi lưu |
| Chạy code B2 trước migration | Lưu bài lỗi vì thiếu `topic_id` → luôn chạy migration trước |

## B11. Checklist test tay

Cần đăng nhập.

- [ ] Chức năng cũ còn: Markdown/Visual, media YouTube/Drive, `[[ ]]`, backlink, Sơ đồ, Canvas, Gallery, chọn nhiều, thẻ, J/K, ⌘Z.
- [ ] Bài mới dán link GitHub, tiêu đề trống → tự `owner/repo`.
- [ ] Chọn chủ đề trong trình soạn thảo; bỏ trống → Chưa xếp.
- [ ] Hàng chip chủ đề lọc đúng ở Danh sách, Gallery, Sơ đồ, Canvas.
- [ ] Chưa xếp + Chọn nhiều + Gán chủ đề → cả loạt chuyển.
- [ ] Tổng quan: Xếp nhanh chỉ bài 30 ngày; phím 1–8; Đọc dở tối đa 3, bài > 30 ngày hiện câu hỏi.
- [ ] Đọc xong → "✓ Đã đọc", con trỏ vào ô ghi chú; viết 1 câu → "Đã rút ra".
- [ ] Thực hành → task ở `/tasks`; xong task → "Đã thực hành".
- [ ] Lưu trữ → biến khỏi danh sách; Hoàn tác; tìm với "Gồm cả đã lưu trữ" thấy lại.
- [ ] Gõ "tam ly" ra bài Tâm lý; `#thẻ` vẫn chạy.
- [ ] Xung quanh: 3 nhóm, không lặp bài.
- [ ] Hàng thẻ không còn thẻ Finance/Tasks.
- [ ] Chủ đề thứ 9 bị chặn, gợi ý Gộp; gộp chuyển hết bài; xoá chủ đề → bài về Chưa xếp.
- [ ] Điện thoại: chip cuộn ngang, Tổng quan xếp dọc, cột phải trang đọc xuống dưới.
- [ ] Chế độ sáng: phần mới đọc rõ.
- [ ] Podcast nổi vẫn phát bài kiểu Podcast.
