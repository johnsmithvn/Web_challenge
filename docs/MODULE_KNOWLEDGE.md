# Module Knowledge (Kiến Thức)

> Tài liệu duy nhất của module Knowledge (`/collect`), mô tả code đang chạy. Cập nhật 2026-10-25 (v6.33.0 — giao diện "Cực quang").
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
| Giao diện | Kiểu **"Cực quang"**: trời đêm + nhấn mint `--kb-accent` `#6EF2C7`, tiêu đề chữ có chân Spectral (`--kb-display`) với phần nhấn in nghiêng `.kb-em` ("Kho Tàng *Kiến Thức*", tên bạn ở lời chào; màu chủ đề nếu có, không thì vàng đồng `--kb-gold`), chữ Be Vietnam Pro (`--kb-font`), mono chỉ cho phím tắt / code. Bản sáng = trời bình minh / hoàng hôn, nhấn violet. Token `src/styles/kb-tokens.css`; style `src/styles/collect.css`. Nền trời động dùng chung `SkyBackground` bản `calm` (không vật bay, không bụi sao theo chuột) |
| Media | Chỉ là link ngoài (YouTube, Google Drive, file âm thanh / video). Không dùng Supabase Storage |

### 1.1. Bản đồ file

| Vai trò | File |
|---|---|
| Trang, điều phối view, phím tắt | `src/pages/CollectPage.jsx` |
| Cột trái (tìm, viết bài, kiểu xem, chủ đề) | `src/components/kb/KBSidebar.jsx` |
| Nền trời (dùng chung với Nhiệm vụ, FX Lab) | `src/components/SkyBackground.jsx` + `src/styles/sky.css` |
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
- `useCollectionTopics`: `topics` (theo `sort_order`), `addTopic`, `updateTopic`, `reorderTopics(ids)` (ghi lại `sort_order` các dòng đổi chỗ, song song; lỗi thì tải lại), `deleteTopic`,
  `mergeTopics`, `seedStarterTopics`; `MAX_TOPICS = 8`. Danh sách gắn với user nên phản hồi trễ của user trước không lọt vào.
- `CollectPage` gắn thêm `_topic` và `_linkedTasks` (task chưa xong) cho mỗi bài.

---

## 4. Màn hình

### 4.1. Cột trái (`KBSidebar`)

- Trên xuống: "Kho Tàng Kiến Thức" + `N bài · M liên kết` · ô tìm (`/`) · **Viết bài mới** · **Chế độ xem** (Tổng quan ·
  Danh sách · Gallery · Sơ đồ · Canvas; rê chuột hiện phím `G` + chữ) · **Chủ đề** (Tất cả bài · Chưa xếp (chỉ khi có) ·
  từng chủ đề với chấm màu + số bài, chủ đề 0 bài mờ đi · Ghi chú của tôi (khi có)) · "Quản lý" / "＋ Tạo". Không có nút Phím tắt (bảng
  mở bằng `?`; menu tài khoản đã có mục Phím tắt).
- Chủ đề lọc mọi kiểu xem. Chọn chủ đề khi đang ở Tổng quan thì sang Danh sách. Bài mới viết mặc định vào chủ đề đang xem.
- Ẩn khi đang đọc hoặc soạn. Mở Knowledge vào **Tổng quan**; đọc / soạn xong, nút quay lại và `Esc` về đúng kiểu xem trước đó.

### 4.2. Tổng quan (`KBOverview`)

| Khối | Hiện khi | Nội dung |
|---|---|---|
| **Lời chào** | Luôn | Ngày, "Chào buổi sáng/trưa/chiều/tối, <tên>", câu "Bầu trời của bạn có N ngôi sao và M đường nối…"; "Bắt đầu xếp", "Mở bầu trời ↗". Không có bầu trời nhỏ đóng khung (bỏ ở v6.34.0, đã có nút Mở bầu trời) |
| **Xếp nhanh** | Có bài chưa có chủ đề lưu trong 30 ngày (`quickSortQueue`) | Đếm `k / N` + vạch tiến độ; từng bài: loại · nguồn · tuổi, tiêu đề (bấm để mở), trích; "Để sau →". Bên phải lưới chủ đề có số phím `1`–`8`, gợi ý (`suggestTopic`), "+ Chủ đề mới" |
| **Các chủ đề · n/8** | Luôn | Thẻ mỗi chủ đề (quầng màu chủ đề, 0 bài thì mờ): tên, số bài, định nghĩa, 2 bài mới nhất; thẻ cuối **Ghi chú của tôi**; "Quản lý" |
| **Gặp lại hôm nay** | Có bài phù hợp | 3 bài cũ hơn 30 ngày là ghi chú / trích dẫn của mình hoặc có ghi chú (`pickResurface`), cố định trong ngày |
| **Gần đây** | Có lịch sử | 5 bài mở gần nhất trên máy này: tiêu đề · loại · chủ đề · ngày |

Bài chưa xếp cũ hơn 30 ngày không hiện ở đây (xếp hàng loạt từ Danh sách). Kho trống → "Bầu trời còn trống" + Viết bài mới.
Đang gõ tìm thì hiện kết quả như Danh sách.

### 4.3. Danh sách (`KBListView`)

- **Đầu danh sách** (luôn có, dải mở không đóng khung: chỉ quầng màu chủ đề, không vạch dưới, không quả cầu nên không thụt): tên in nghiêng
  (màu chủ đề; Tất cả / Chưa xếp / Ghi chú của tôi màu vàng đồng) + số bài +
  định nghĩa của phạm vi đang xem (một chủ đề · Chưa xếp · Ghi chú của tôi · Tất cả bài). Nút **Xếp nhanh** (Chưa xếp)
  hoặc **Quản lý chủ đề**. Hàng **thẻ** (không nhãn "Thẻ" — dấu # đã nói rõ) để lọc (AND) và "Quản lý thẻ": thẻ đếm trong **phạm vi** (`scopeTagCounts` ở
  `CollectPage`), không theo bộ lọc, nên lọc không làm hàng thẻ biến mất và cả danh sách nhảy.
- **Thanh lọc (một hàng):** **↔ Có liên kết** (bài có `[[ ]]` đi hoặc được trỏ về) · **Nhóm theo** Tháng / Chủ đề / Không ·
  "N kết quả · Xoá lọc" · sắp xếp Mới nhất / Cũ nhất / Dài nhất · Chọn. Nút bật / tắt giữ nguyên chữ (trạng thái bằng màu)
  để các nút cạnh không bị đẩy.
- **Không có lọc Loại** (bỏ ở v6.33.0): Loại tự suy từ link nên với kho thiên về ghi chú gần như không tách được gì, và
  trùng vai với Chủ đề. Loại vẫn hiện ở biểu tượng + meta từng bài, Gallery, Tổng quan.
- **Nhóm** thu gọn được (mũi tên). Nhóm do `CollectPage` tính (`groupArticles`) nên `J`/`K` và ↑ ↓ ở trang đọc đi
  đúng thứ tự đang hiện.
- **Thẻ bài:** biểu tượng loại; meta (chủ đề khi xem Tất cả / Ghi chú của tôi) · loại · tên miền · ngày · phút đọc · #thẻ;
  tiêu đề; một dòng trích; nhãn ↔ liên kết, ◇ nhiệm vụ, ✎ ghi chú; rê chuột hiện Sửa / Xoá.
- **Chọn nhiều:** thanh nổi dính đáy: "Đã chọn N" · Chọn tất cả / Bỏ chọn hết · **Gán chủ đề** (bảng chọn bật lên) · Xoá · ✕.
- **Trống:** chủ đề chưa có bài → "Chưa có bài nào trong X", "Xếp nhanh · N bài chờ", "Viết bài mới"; lọc không ra → "Xoá lọc".

### 4.4. Gallery, Sơ đồ, Canvas

- **Gallery:** lưới so le (CSS columns): loại · ngày, nguồn (chữ cái đầu tên miền), tiêu đề, trích tối đa 4 dòng, chân thẻ là chủ đề + số liên kết; trích dẫn có dấu “ lớn.
- **Sơ đồ ("bầu trời"):** đồ thị lực; mỗi bài là một ngôi sao (to theo số nối, sáng màu chủ đề, bài chưa nối mờ), cạnh `[[ ]]` liền màu nhấn, cạnh thẻ chung đứt màu vàng. Bấm sao → chọn (vòng violet, cạnh của nó đổi màu), bấm lần nữa bỏ chọn; mô phỏng không chạy lại khi chọn. Cột phải: bài đang chọn ("Mở bài ↗", "Nối với · N") hoặc giới thiệu; luôn có "Sao sáng nhất". Điện thoại: cột phải xuống dưới.
- **Canvas:** bảng kéo thả node và nối cạnh; không thanh header — ba nút "＋ Thẻ trắng", "＋ Từ thư viện", "⟷ Nối" nổi góc phải, nền trong suốt; `localStorage` `kb_canvas_nodes`, `kb_canvas_edges`. Màu node lấy theo loại lúc vẽ (node cũ còn lưu màu bảng cũ).
- Sơ đồ và Canvas chỉ lọc theo chủ đề (không theo chữ tìm / thẻ).

### 4.5. Trang đọc (`KBReaderView`)

- **Thanh trên:** trong suốt, hai cụm viên nổi để trời và trăng hiện phía sau — trái: ← Kiến thức · ↑ ↓; phải: **viên chủ đề**
  (`KBTopicSelect` = SearchSelect dùng chung, chấm màu từng chủ đề, đổi một lần chọn; "+ Gán chủ đề" mở thẳng nó) · Liên kết · Tập trung (`F`, ẩn cột phải) · Sửa (`E`) · Xoá. Không có đường dẫn
  (tiêu đề đã ở H1, chủ đề ở viên). Vạch tiến độ cuộn trang (scaleX). Điện thoại (≤640px): nút về chỉ còn mũi tên, ẩn nút
  Tập trung (cột phải đã nằm dưới bài).
- **Nội dung:** meta (loại · nguồn · ngày · phút đọc), tiêu đề Spectral, "+ Gán chủ đề" (khi Chưa xếp, mở thẳng select) + #thẻ, media preview, thân bài, **Ghi chú của bạn**.
- **Cột phải:** độ dài / ngày tạo / nguồn · **Lân cận** (sơ đồ sao nhỏ, "Mở bầu trời ↗") · **Xung quanh** (§5.2, mỗi dòng ghi cùng chủ đề / cùng nguồn / cất cùng lúc) · Mục lục (Markdown) · Trỏ tới · Được trỏ về · Nhiệm vụ liên kết (task chưa xong).
- Bài đang đọc / soạn chỉ giữ **id**; nội dung lấy từ dữ liệu sống nên đổi chủ đề, link, `[[ ]]` hiện ngay. Thêm / xoá ghi chú → tải lại danh sách.

### 4.6. Trình soạn thảo (`KBEditorView`)

- Markdown / Visual (chỉ chọn khi tạo mới), thống kê chữ, nút nối `[[ ]]`, Lưu (`Ctrl+S`).
- Tiêu đề · hàng **chủ đề** (gợi ý: viền đứt + chữ "gợi ý"; có Chưa xếp) · **Kiểu** Bài viết / Trích dẫn / Podcast · thẻ · URL.
- Rời ô URL khi tiêu đề trống → tự điền tiêu đề đoán từ link (`guessTitle`: repo → `owner/repo`, YouTube → "Video YouTube", Facebook → "Bài Facebook", còn lại → tên miền).
- Lưu thất bại → báo lỗi và ở lại trình soạn thảo.

### 4.7. Quản lý chủ đề (`KBTopicModal`)

Đầu hộp "Quản lý chủ đề" + "n / 8". Mỗi dòng: tay cầm ⋮⋮ **kéo để đổi thứ tự** (pointer events, chạy cả cảm ứng; khi tay cầm
đang được chọn thì ↑ ↓) · quả cầu màu (bấm mở bảng màu, lưu khi rời) · tên / định nghĩa sửa tại chỗ (lưu khi rời ô, Enter) ·
"Đang xem" · số bài · "Gộp vào…" (RPC merge) + Xoá hiện khi rê chuột (cảm ứng: bấm ⋯). Gộp và xoá có xác nhận. Chân hộp:
"Thêm chủ đề · còn N chỗ" với 7 ô màu (mặc định màu chưa dùng), tên, định nghĩa. Đủ 8 thì đổi thành lời nhắc gộp bớt.
Chưa có chủ đề nào → "Dùng bộ 7 chủ đề gợi ý".

### 4.8. Phím tắt

`/` tìm · `N` bài mới · `V` chọn nhiều · `J`/`K` di chuyển · `Enter` mở · `E` sửa · `F` đọc tập trung · `Backspace` xoá · `⌘Z` hoàn tác xoá
(không chạy khi đang gõ) · `G` rồi `T`/`L`/`G`/`C`/`Q` = Tổng quan / Danh sách / Sơ đồ / Canvas / Gallery · `?` bảng phím
tắt · `Esc` lùi từng lớp (Sơ đồ, Canvas → Tổng quan) · Tổng quan: `1`–`8` xếp bài vào chủ đề, `→` để sau.
Phím tắt trang không chạy khi đang mở hộp thoại.

### 4.9. Xoá và hoàn tác

Xoá có xác nhận; toast "Hoàn tác" hoặc `⌘Z` chèn lại bài (giữ nội dung và chủ đề).

### 4.10. Điện thoại

**Điện thoại (≤768px, đã đăng nhập)** — như Finance: thanh Life Hub + tab đáy chung của app ẩn ở `/collect`
(`body.in-knowledge-workspace` do `CollectPage` gắn; `Navbar` không vẽ hai thanh đó). `KBSidebar` (`isMobile`) vẽ:
- **Hàng trên trong suốt** (trời hiện phía sau): ô tìm · **viên chủ đề** (`KBTopicSelect`: Tất cả bài / Chưa xếp / từng chủ đề /
  Ghi chú của tôi; chọn ở Tổng quan thì sang Danh sách) · nút **＋** Viết bài mới.
- **Tab đáy riêng**: Home (về Life Hub, nơi có đổi sáng / tối, tài khoản) · Tổng quan · Danh sách · Gallery · Sơ đồ · Canvas.
- Trang đọc / soạn: không có hai thanh này (thanh của trang đọc có nút về). Chưa đăng nhập: giữ thanh chung để còn nút đăng nhập.
- Nút tròn QuickCapture ẩn ở `/collect` (đã có Viết bài mới; trên điện thoại sẽ đè tab đáy).

**769–860px** (máy tính bảng hẹp, còn sidebar của app): cột trái thành thanh trên — ô tìm + Viết bài mới,
rồi hai hàng viên cuộn ngang (kiểu xem, chủ đề). Tổng quan, Xếp nhanh, hai khối cuối xuống một cột; dưới 1000px trang đọc
đưa cột phải xuống dưới, Sơ đồ đưa cột phải xuống dưới.

---

## 5. Tìm lại và gợi lại

### 5.1. Tìm kiếm (`filterArticles`)

Không cần dấu ("tam ly" ra "Tâm lý"), nhiều từ cùng lúc (mọi từ phải khớp), trên tiêu đề, chữ của bài (`body_text`,
không phải JSON thô), link, tên chủ đề, tên thẻ, nội dung ghi chú. `#tên` lọc theo thẻ. Hàm còn hỗ trợ lọc loại /
thời gian (`kind`, `time`) và `linked` (Set id bài có liên kết `[[ ]]`). Danh sách dùng `linked`; `kind`, `time` UI chưa dùng.

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
wiki link (`parseWikiLinks`, `findBacklinks`, `getOutboundLinks`, `extractContext`), `deriveGraph`, `filterArticles`, `groupArticles`
(nhóm theo tháng / chủ đề / không, giữ thứ tự danh sách),
`normalizeVi`, `itemPlainText`, `isMine`, `ageDays`, `KIND_META`, `contentKind`, `sourceKey`, `guessTitle`,
`quickSortQueue`, `findNeighbors`, `suggestTopic`, `pickResurface`, `pushRecent`, `readTime`, `markdownToPlainText`,
`extractHeadings`, `isTiptapBody`, `tiptapToPlainText`, `isThemeBreakingColor` + `migrateTiptapDoc` (gỡ màu chữ inline
xám / đen / trắng / quá tối / quá sáng khi nạp bài Visual, đổi `audioBlock` → `mediaBlock`; `TiptapEditor` và
`TiptapReadOnly` cùng gọi).
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
| Giao diện | **v6.33.0: "Cực quang"** (bản thiết kế "Kiến Thức Redesign" 1a/2a; Danh sách 4a, Quản lý chủ đề 4b). Thay "Thư phòng" vàng đồng | Cùng bầu trời với Nhiệm vụ; liên kết giữa bài thành "chòm sao" |
| Nền trời Knowledge | `SkyBackground calm`: sao, cực quang, sao băng; không vật bay, không bụi sao theo chuột | Trang để đọc, nền không được giành chú ý |
| Ô "Lọc trong mục này" thứ hai của bản thiết kế | Không làm | Đã có ô tìm ở cột trái |
| Bộ lọc tiến độ của bản thiết kế | Bỏ, không thay bằng gì | Không có trạng thái đọc (xem trên). Từng thử lọc **Loại** thay vào, bỏ vì gần như không tách được gì và trùng vai Chủ đề |
| Bề rộng Danh sách / Tổng quan / Gallery | Chung `max-width: 1280px` (bằng Gallery cũ, rộng nhất) + lề, `.kb-content` `scrollbar-gutter: stable` | Đổi kiểu xem hoặc lọc ra danh sách ngắn không làm nội dung co giãn, dịch ngang |
| Bộ chủ đề khởi đầu | Chỉ định nghĩa trong SQL | Một nguồn sự thật cho migration và user mới |

## 12. Nợ đã biết

| # | Vấn đề |
|---|---|
| 1 | Chọn nhiều chưa gắn thẻ hàng loạt (nút "Gắn thẻ" cũ chỉ mở hộp quản lý thẻ nên đã bỏ) |
| 2 | `KBLinkModal`, `KBTagModal` gọi setState trong effect khi mở (cảnh báo lint) |
| 3 | Xoá hàng loạt gọi `deleteItem` tuần tự |
| 4 | Kiểu xem / bài đang đọc không có URL riêng: F5 về Tổng quan, Back rời trang |
| 5 | `useRandomPodcast` không lọc `user_id`, dựa hoàn toàn vào RLS |
| 6 | `collection_notes.sort_order` có trong schema nhưng không dùng |
| 7 | Mở bài từ Tổng quan / Xung quanh khi bài không nằm trong danh sách đang lọc thì ↑ ↓ đi theo danh sách lọc |
| 8 | `J`/`K` vẫn đi qua bài trong nhóm đang thu gọn |

## 13. Để sau

- Thu gọn `type` còn `note/quote/podcast`, bỏ `'inbox'` khỏi CHECK, đổi `DEFAULT 'inbox'` → `'note'` (có bảng sao lưu).
- Dọn cột `status` (giờ chỉ còn `read`; `archived` / `unread` là dữ liệu cũ).
- Nhóm nhỏ trong chủ đề khi một chủ đề > ~15 bài (dùng lại `tags`).
- Lọc thời gian cho ô tìm (logic đã có trong `filterArticles`).
- Trang tổng hợp tự viết; lấy tiêu đề / ảnh thật qua API.

## 14. Checklist test tay

Cần đăng nhập.

- [ ] Soạn Markdown / Visual, media YouTube / Drive, `[[ ]]`, backlink, Sơ đồ, Canvas, Gallery, chọn nhiều, thẻ, J/K, ⌘Z.
- [ ] Bài mới dán link GitHub, tiêu đề trống → tự `owner/repo`; chọn chủ đề và Kiểu; bỏ trống chủ đề → Chưa xếp.
- [ ] Chủ đề ở cột trái lọc đúng Danh sách / Gallery / Sơ đồ / Canvas; Chưa xếp + Chọn nhiều + Gán chủ đề chuyển cả loạt.
- [ ] Danh sách: ↔ Có liên kết, Nhóm theo Tháng / Chủ đề / Không, thu gọn nhóm; bật lọc không làm đầu danh sách / nút nhảy; `J`/`K` đi đúng thứ tự đang hiện.
- [ ] Tổng quan: Xếp nhanh chỉ bài 30 ngày, phím `1`–`8`, `→`; thẻ chủ đề mở đúng danh sách; Ghi chú của tôi; Gặp lại; Mở gần đây.
- [ ] Trang đọc: đổi chủ đề bằng select hiện ngay; Xung quanh 3 nhóm không lặp; thêm ghi chú → số ghi chú ở danh sách cập nhật.
- [ ] Quản lý chủ đề: kéo ⋮⋮ đổi thứ tự (cả trên điện thoại), ↑ ↓ khi tay cầm được chọn; đổi tên / màu; chủ đề thứ 9 bị chặn; gộp chuyển hết bài; xoá → bài về Chưa xếp.
- [ ] Trang đọc: `F` ẩn / hiện cột phải; "+ Gán chủ đề" mở select. Sơ đồ: bấm sao không làm cả bầu trời chạy lại.
- [ ] Gõ "tam ly" ra bài Tâm lý; `#thẻ` vẫn chạy; hàng thẻ không có thẻ Finance / Tasks.
- [ ] Điện thoại và chế độ sáng: phần mới đọc rõ, không tràn.
- [ ] Podcast nổi vẫn phát bài kiểu Podcast.
