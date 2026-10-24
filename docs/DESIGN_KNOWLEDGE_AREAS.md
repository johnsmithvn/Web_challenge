# Knowledge v2 — Kho theo Vùng

> **Trạng thái:** Đề xuất, chờ duyệt. Chưa có dòng code hay migration nào được viết.
> **Ngày:** 2026-10-24 · **Phạm vi:** module Knowledge (`/collect`).
> Nhãn theo `docs/RULES.md` §1: **[Đã kiểm]** = đọc trực tiếp từ code/schema, **[Giả định]** = cần xác nhận,
> còn lại là **đề xuất**.

---

## 0. Tóm tắt

Knowledge hiện là một danh sách bài viết chạy dài, cất một link cũng phải "viết một bài", và 7 loại hiện tại
trộn lẫn chủ đề, định dạng lẫn mục đích. Bản này đổi Knowledge thành **một kho có bản đồ**:

- Bạn chỉ phải quyết định **một thứ: Vùng** (mảng quan tâm, ví dụ AI, Tâm lý, Tiếng Anh). Để trống cũng được.
- **Loại** (Repo, Video, Bài FB…) do máy tự nhận từ link.
- **Tiến độ** (Chưa đọc xong → Đã đọc → Đã rút ra → Đang/Đã thực hành) tự ghi theo việc bạn làm, không phải ngăn tủ.
- Tìm lại bằng **ô tìm không dấu**, khung **Xung quanh**, và mục **Gặp lại hôm nay**.
- Phần "làm" thuộc về **Tasks**: nút "Thực hành" tạo task nối với mục đó.

---

## 1. Bối cảnh

### 1.1. Hiện trạng [Đã kiểm]

| Điểm | Chi tiết |
|---|---|
| Không có đường cất nhanh | Từ khi bỏ Inbox (migration `20260926000000`), nút `+` nổi chỉ tạo task. Cửa vào duy nhất là "＋ Bài mới" → `KBEditorView` (tiêu đề bắt buộc, chọn 1/7 loại, Markdown/Visual, thẻ). |
| 7 loại trộn 3 trục | `note, quote, learn, idea, ai, entertainment, podcast`: có cái là định dạng, có cái là chủ đề, có cái là mục đích. |
| Màn đầu là dòng chảy bài | `KBListView`: mỗi dòng có trích 200 chữ, phút đọc, nhãn. Thêm 4 kiểu xem, sắp xếp, chọn nhiều, hàng thẻ, phím tắt kiểu Vim. |
| Hàng thẻ lẫn thẻ module khác | `CollectPage.jsx:75` gộp toàn bộ `centralTags` (dùng chung với Finance/Tasks) vào hàng lọc. |
| Tìm kiếm yếu | `filterArticles` (`kbDeriveUtils.js:200`): phải gõ đúng dấu, tìm trên `body` thô (bài Visual là JSON), không tìm trong ghi chú cá nhân. |
| "Liên quan" phải nối tay | Backlink, sơ đồ chỉ dựa vào `[[liên kết]]` tự viết. |
| Trạng thái có mà không dùng | Cột `status` (`unread/read/archived`) có sẵn, UI không dùng; bài mới luôn lưu `read`. |
| Ràng buộc DB | `chk_collections_type` vẫn gồm `'inbox'`; `type DEFAULT 'inbox'`. |

### 1.2. Nỗi đau bạn đã xác nhận

1. Cất thì dễ, dùng lại thì khó.
2. Phải quyết định quá nhiều ngay lúc cất.
3. Nhiều mục đích, nhiều vòng đời trộn trong một danh sách.
4. Không có vòng biến thông tin thành kiến thức của mình.

### 1.3. Những gì đã thử và bỏ

| Ý | Vì sao bỏ |
|---|---|
| Tab "Lưu nhanh / Đọc sau" riêng | Việc ghi nhanh đã có Tasks lo. |
| Màn "Inbox" riêng | Inbox đã gộp vào Tasks hồi tháng 9. Thay bằng khay **Chưa xếp** ngay trên trang đầu. |
| Trục mục đích "Muốn học / Tra cứu" | Bắt đoán trước; repo AI đọc xong muốn thực hành thì không vào ngăn nào. Thay bằng **Tiến độ** tự ghi. |
| Tách module con theo loại (GitHub, Video…) | Nhân bản đúng câu hỏi "bỏ vào đâu". |
| Trang tổng hợp tự viết (hub) | Hay, nhưng phải tự nối từng nguồn. Để sau. |

---

## 2. Nguyên tắc

1. **Chỉ một bước bắt buộc: cất vào.** Mọi bước khác tùy chọn và làm lúc đang làm đúng việc đó.
2. **Một quyết định duy nhất: Vùng.** Máy lo phần còn lại.
3. **Trạng thái là việc đã làm, không phải ngăn phải chọn.**
4. **Tìm lại theo cách bạn nhớ:** vài chữ không dấu, nguồn, thời gian, "những thứ ở gần".
5. **Luật do app giữ, không bắt bạn nhớ** (ví dụ giới hạn 8 vùng).
6. **Không để kho thành đống việc tồn mới:** dải nào cũng giới hạn số mục hiện, mục để lâu thì app hỏi lại.

---

## 3. Quy chuẩn phân loại

### 3.1. Ba trục

| Trục | Câu hỏi | Ai quyết | Số lượng |
|---|---|---|---|
| **Vùng** | Nó thuộc mảng nào trong đời mình? | Bạn, một lần, để trống được | 5–8, mỗi mục đúng 1 |
| **Loại** | Nó là cái gì? | Máy tự nhận; chữ không link thì bạn chọn Ghi chú / Trích đoạn | Cố định |
| **Tiến độ** | Mình đã làm gì với nó? | Tự ghi theo nút bạn bấm | Chuỗi trạng thái |

### 3.2. Vùng

**Bộ khởi đầu (đề xuất):**

| Vùng | Định nghĩa (hiện khi chọn) | Ví dụ |
|---|---|---|
| AI & Công nghệ | Công cụ, repo, prompt, kiến thức kỹ thuật | `browser-use`, video prompt few-shot |
| Tâm lý & Cuộc sống | Hành vi, thói quen, cảm xúc, quan điểm sống | Dopamine và lướt điện thoại, "Bớt so sánh mình" |
| Tiếng Anh | Nội dung để học tiếng Anh: nghe, nói, từ vựng | Shadowing 15 phút, 1000 từ thông dụng |
| Cách học | Phương pháp học, ghi nhớ, tập trung (áp dụng cho mọi môn) | Kỹ thuật Feynman, ôn ngắt quãng |
| Giải trí | Đọc/xem cho vui | Truyện hài, đoạn hội thoại hay |

**Luật:**
1. Mỗi mục thuộc đúng một vùng, hoặc chưa có vùng (Chưa xếp).
2. Phân vân giữa hai vùng → chọn **chỗ lần sau mình sẽ đi tìm nó**.
3. Vùng là **mảng quan tâm lâu dài**. Không phải dự án/việc (→ Tasks), không phải định dạng (→ Loại).
4. Chỉ tạo vùng mới khi có **≥ 5 mục** mà không vùng nào hợp.
5. **Tối đa 8 vùng.** Đủ 8 thì nút "Tạo vùng" đổi thành "Gộp vùng". App và DB cùng chặn.
6. Tên vùng 1–3 chữ, không trùng nghĩa nhau; mỗi vùng có một dòng định nghĩa.
7. Câu nói gắn với một mảng thì về mảng đó ("Kỷ luật là tự do" → Tâm lý & Cuộc sống). Thứ chỉ để vui → Giải trí.

### 3.3. Loại

| Điều kiện | Loại | Hiển thị |
|---|---|---|
| `github.com/<owner>/<repo>` | Repo | icon GitHub, tên `owner/repo` |
| YouTube (`watch`, `youtu.be`, `shorts`, `embed`) | Video | ảnh thu nhỏ từ ID video |
| `facebook.com`, `fb.watch`, `m.facebook.com` | Bài FB | icon Facebook |
| Link âm thanh / Drive dạng audio (`getMediaType`) | Âm thanh | trình phát sẵn có |
| Link khác | Bài viết | tên miền |
| Không có link, lời của bạn | Ghi chú của tôi | — |
| Không có link, lời người khác (câu nói, truyện, hội thoại) | Trích đoạn | thẻ lớn dễ đọc |

### 3.4. Tiến độ

```
Chưa đọc xong ─▶ Đã đọc ─▶ Đã rút ra ─▶ Đang thực hành ─▶ Đã thực hành
                (1 chạm)  (có ghi chú)  (có task mở)     (task xong)
```

- Không bắt buộc đi hết. Trích đoạn dừng ở "Đã đọc" là đủ.
- "Đọc xong" là một nút; bấm xong hiện ô "Rút ra gì không?" (bỏ qua được).
- Viết ghi chú hoặc bấm "Thực hành" cũng tự tính là đã đọc.
- Mục "Chưa đọc xong" quá **30 ngày** → app hỏi "Còn muốn đọc không?" [Đọc xong] [Lưu trữ].

### 3.5. Lưu trữ và Xoá

- **Lưu trữ:** ẩn khỏi trang đầu và trang vùng, vẫn còn trong DB. Tìm kiếm có chip "Gồm cả đã lưu trữ". Có Hoàn tác ngay sau khi bấm.
- **Xoá:** chỉ trong menu "…" của trang mục, có xác nhận, như hiện tại.

### 3.6. Để sau (không có ở v1)

- **Nhóm nhỏ trong vùng** (ví dụ Tâm lý: Thói quen · Trì hoãn · Cảm xúc): chỉ khi một vùng > ~15 mục, tối đa ~5 nhóm/vùng, dùng lại bảng `tags`, chỉ hiện bên trong vùng.
- **Thẻ** không hiện ở giao diện chính v1. Thẻ cũ giữ nguyên trong DB, vẫn quản lý ở Cài đặt.

---

## 4. Luồng UX

### 4.1. Cất vào

1. Bấm **＋ Cất vào** (trang đầu Knowledge) → hộp nhỏ, con trỏ đặt sẵn trong ô.
2. Dán link hoặc chữ.
   - **Link:** hiện Loại đã nhận + tiêu đề đoán sẵn (repo → `owner/repo`; không đoán được → tên miền + ngày). Sửa được, không bắt buộc.
   - **Chữ:** chọn *Ghi chú của tôi* / *Trích đoạn*. Nếu chữ được **dán** vào thì mặc định Trích đoạn, **gõ** thì mặc định Ghi chú.
3. Dòng **"Lưu để…"** (tùy chọn, một dòng): lời của bạn, giúp tìm lại sau. Với bài FB nên dán kèm đoạn chữ vì bài có thể bị xoá.
4. **Vùng:** hàng chip các vùng, vùng gợi ý được chọn sẵn (nếu có). Bỏ chọn = Chưa xếp.
5. **Lưu** (hoặc `Ctrl+Enter`). `Esc` đóng. Có link "Viết bài dài →" mở trình soạn thảo đầy đủ, điền sẵn những gì đã nhập.

### 4.2. Xếp mục Chưa xếp

- Trên trang đầu, mỗi dòng Chưa xếp có: chip vùng gợi ý (1 chạm là nhận), "Vùng khác ▾", "Lưu trữ".
- Không có số đếm đỏ, không ép dọn: đây là chỗ chờ, không phải việc phải làm.

### 4.3. Đọc và Đọc xong

- Mở mục → đọc nội dung / bấm mở nguồn.
- Bấm **Đọc xong** → hiện ô "Rút ra gì không?" (một ô, gợi ý: *điều đáng nhớ nhất, áp dụng ở đâu*). Lưu thì thành ghi chú của mục → "Đã rút ra". Bỏ qua → "Đã đọc".

### 4.4. Thực hành

- Bấm **Thực hành** → tạo task "Thử: <tiêu đề>" và nối với mục (dùng lại `addTask` + `linkCollection` đang có).
- Mục hiện "Đang thực hành · 1 task"; task xong thì thành "Đã thực hành". Task có link ngược lại mục như hiện nay.

### 4.5. Tìm lại

- Ô tìm luôn ở đầu trang đầu. Gõ là kết quả thay chỗ toàn bộ phần dưới.
- Tìm **không dấu**, **nhiều từ cùng lúc** (mọi từ phải khớp), trên: tiêu đề, dòng "Lưu để"/nội dung chữ (`body_text`), ghi chú rút ra, tên vùng, tên loại, nguồn.
- Chip lọc hiện khi đang tìm: **Loại** (Repo, Video…) · **Thời gian** (Tuần này, Tháng này, 3 tháng, Cũ hơn) · **Gồm cả đã lưu trữ**.

### 4.6. Gặp lại và Mở gần đây

- **Gặp lại hôm nay:** 3 mục cũ hơn 30 ngày, ưu tiên mục đã rút ra và trích đoạn. Chọn theo ngày nên cả ngày ra cùng 3 mục.
- **Mở gần đây:** 3 mục mở gần nhất trên máy này (`localStorage`).

### 4.7. Quản lý vùng

- Trong trang vùng, menu "…": Đổi tên · Sửa định nghĩa · Đổi màu · Gộp vào vùng khác · Xoá vùng.
- **Gộp:** chuyển mọi mục sang vùng đích rồi xoá vùng cũ.
- **Xoá vùng:** mục bên trong về Chưa xếp, không mất mục nào.

### 4.8. Ba ví dụ, đếm thao tác

| Tình huống | Bắt buộc | Tùy chọn, về sau |
|---|---|---|
| Lướt FB thấy bài hay | Dán link → Lưu (vùng gợi ý sẵn) | — |
| Repo AI, đọc thấy hay, muốn thử | Dán link → Lưu | Đọc xong (+1 câu) · Thực hành |
| Bài tâm lý đọc dở | Dán link → Lưu | Đọc xong khi đọc hết |
| Truyện hài, câu nói hay | Dán chữ → Lưu | Đọc lại bằng "Đọc ngẫu nhiên" |

So với hiện tại: cất 1 link cần 6 bước trước khi lưu được.

---

## 5. Màn hình

> Mô tả bố cục và hành vi. **Màu, chữ, khoảng cách chưa chốt** (xem §5.8). Mockup khung đã duyệt cấu trúc:
> tab "1 + 3 · bản đã chốt" trong file mockup HTML.

### 5.1. Đầu trang (thay `KBSubHeader`)

- Tên module · nút **＋ Cất vào** · menu **"…"** (Quản lý vùng, Sơ đồ, Canvas, Phím tắt).
- Bỏ khỏi đầu trang: thanh chọn 4 kiểu xem.

### 5.2. Trang đầu (mới, `KBHome`)

Thứ tự từ trên xuống:

| # | Khối | Hiện khi | Giới hạn |
|---|---|---|---|
| 1 | Ô tìm | Luôn | — |
| 2 | Thanh "Đã lưu trữ … · Hoàn tác" | Vừa lưu trữ | 1 dòng |
| 3 | **Chưa xếp · N** | N > 0 | 3 dòng + "Xem cả N" |
| 4 | **Đọc dở · N** (chưa đọc xong) | N > 0 | 3 thẻ + "Xem cả N"; thẻ > 30 ngày hiện câu hỏi |
| 5 | **Các vùng** | Luôn | Lưới thẻ: tên, số mục, định nghĩa, 2 mục mới nhất, "N đọc dở"; thêm thẻ **Ghi chú của tôi** |
| 6 | Gặp lại hôm nay · Mở gần đây | Có dữ liệu | 2 cột × 3 mục |

- Kho trống: lời mời chọn bộ vùng khởi đầu + "Cất mục đầu tiên".
- Khi đang tìm: khối 2–6 ẩn, hiện chip lọc + kết quả.

### 5.3. Trang một vùng (mới, `KBAreaView`)

- Đầu: chấm màu + tên vùng, dòng định nghĩa, menu "…" quản lý vùng.
- Chia khối theo Loại: Repo · Video · Bài viết · Bài FB · Âm thanh · Ghi chú của tôi · Trích đoạn.
- Mỗi dòng: icon/ảnh thu nhỏ loại, tiêu đề, một dòng "Lưu để", nhãn tiến độ nhỏ bên phải.
- Không có trích 200 chữ, không có "x phút đọc".
- **Trích đoạn hiện dạng thẻ lớn dễ đọc** (dùng lại `KBGalleryView`). Vùng có ≥ 3 trích đoạn có nút **"Đọc ngẫu nhiên một mẩu"**.
- Sắp xếp: mới nhất trước, không có nút sắp xếp.

### 5.4. Trang một mục (sửa `KBReaderView`)

- **Thanh trên:** ← Kho · chip vùng (bấm để đổi) · **Đọc xong** · **Thực hành** · Sửa · "…" (Liên kết, Lưu trữ, Xoá).
- **Đầu bài:** tiêu đề, một dòng meta (loại · nguồn · ngày · tiến độ), khung "Lưu để", media preview như hiện tại.
- **Nội dung** như hiện tại.
- **Ghi chú của bạn** (gộp phần ghi chú cá nhân hiện có): ô "Rút ra gì không?" bung ra sau khi bấm Đọc xong.
- **Cột phải** (xuống dưới nội dung trên điện thoại):
  - **Xung quanh:** *Cùng chủ đề* (cùng vùng, 3 mục) · *Cùng nguồn* (cùng chủ repo / kênh / tên miền) · đường gạch · *Lưu gần thời điểm* (±7 ngày, khác vùng) kèm chú thích "có thể khác chủ đề".
  - **Task liên kết** (giữ thẻ hiện có).
  - **Mục lục** (giữ, chỉ bài Markdown dài).
  - **Liên kết `[[ ]]`** (giữ, chỉ hiện khi có).
- **Bỏ:** thẻ sơ đồ thu nhỏ, thẻ thống kê (đưa số cần thiết lên dòng meta).

### 5.5. Hộp Cất vào (mới, `KBQuickSave`)

Dùng `GenericModal` có sẵn. Nội dung như §4.1. Trên điện thoại hiện dạng tấm từ dưới lên.

### 5.6. Trình soạn thảo (sửa `KBEditorView`)

- Thay hàng chip 7 loại bằng **bộ chọn vùng** (cùng component với hộp Cất vào).
- Không có link → hiện lựa chọn *Ghi chú của tôi* / *Trích đoạn*.
- Ẩn ô thẻ (thẻ cũ không bị gỡ khi lưu).
- Tiêu đề tự điền từ link khi trống.
- Giữ nguyên Markdown / Visual, thanh công cụ, media.

### 5.7. Ghi chú của tôi (màn danh sách)

- Phần **Điều đã rút ra**: mỗi câu rút ra hiện to, kèm "Rút ra từ: <tên mục> · vùng". Bấm mở mục nguồn.
- Phần **Ghi chú và trích đoạn của tôi**.
- Đây là nơi thấy rõ kiến thức đang tích lại.

### 5.8. Hình ảnh: chưa chốt (bước B1)

Mockup khung đang dùng bảng màu Knowledge hiện tại và bạn thấy chưa đẹp. Trước khi code sẽ làm bản nhìn thật
cho **3 màn: trang đầu, trang vùng, trang mục**, theo một trong ba hướng:

| Hướng | Mô tả |
|---|---|
| A | Giữ ngôn ngữ Knowledge hiện tại (tối, vàng đồng, chữ có chân), làm thoáng hơn |
| B | Theo module Finance trong app |
| C | Sáng, gọn kiểu Notion / Raindrop; thẻ có ảnh thu nhỏ cho video (từ ID YouTube) và repo (ảnh xem trước của GitHub) |

Chọn xong sẽ cập nhật `DESIGN.md` phần Knowledge.

---

## 6. Dữ liệu và migration

### 6.1. Mô hình

| Khái niệm | Lưu ở đâu | Mới hay có sẵn |
|---|---|---|
| Vùng | Bảng mới `collection_areas` | Mới |
| Vùng của mục | `collections.area_id` | Cột mới |
| Loại | Tính từ `url` + `type` (`note` / `quote` / `podcast`) | Có sẵn, thu gọn giá trị |
| Chưa đọc xong / Đã đọc / Lưu trữ | `collections.status` = `unread` / `read` / `archived` | Có sẵn |
| Đã rút ra | Có ≥ 1 dòng `collection_notes` | Có sẵn |
| Đang / Đã thực hành | `task_collections` + `user_tasks.status` | Có sẵn |
| Mở gần đây | `localStorage` key `vl_kb_recent` (10 id) | Mới, chỉ là tiện ích trên máy |

`type` sau khi thu gọn: `note` (mục có link, hoặc ghi chú của tôi) · `quote` (hiện tên là **Trích đoạn**) ·
`podcast` (giữ để `useRandomPodcast` / trình phát nổi không phải sửa; link âm thanh mới tự lưu `podcast`).

### 6.2. Bảng `collection_areas`

```sql
CREATE TABLE collection_areas (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 40),
  description TEXT NOT NULL DEFAULT '',
  color       TEXT NOT NULL DEFAULT '#8b5cf6',
  sort_order  INT  NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, id)                                  -- cho FK hai cột bên dưới
);
CREATE UNIQUE INDEX uq_collection_areas_user_name ON collection_areas (user_id, lower(btrim(name)));
-- RLS: 4 policy select/insert/update/delete, user_id = auth.uid() (giống collections).
-- Trigger updated_at.
-- Trigger BEFORE INSERT: chặn khi user đã có 8 vùng (luật §3.2.5).

ALTER TABLE collections ADD COLUMN area_id UUID;
ALTER TABLE collections ADD CONSTRAINT fk_collections_area
  FOREIGN KEY (user_id, area_id) REFERENCES collection_areas (user_id, id)
  ON DELETE SET NULL (area_id);                         -- Postgres 15+: xoá vùng → mục về Chưa xếp
CREATE INDEX idx_collections_user_area ON collections (user_id, area_id);
```

FK hai cột `(user_id, area_id)` bảo đảm mục và vùng **cùng một chủ** (RULES §7: FK chéo phải kiểm ownership hai phía).
[Giả định] Supabase đang chạy Postgres ≥ 15 cho cú pháp `SET NULL (area_id)`; preflight sẽ kiểm `SHOW server_version`.
Nếu thấp hơn: FK một cột `ON DELETE SET NULL` + trigger kiểm cùng `user_id`.

### 6.3. Migration chia 2 pha

**Pha 1 — chỉ thêm, không phá** (`supabase/migrations/20261025000000_knowledge_areas_v6_32_0.sql`)

1. Preflight:
   ```sql
   SHOW server_version;
   SELECT type, status, count(*) FROM collections GROUP BY 1, 2 ORDER BY 1, 2;
   ```
2. Trong một transaction: tạo bảng, RLS, trigger, cột `area_id`, FK, index.
3. Tạo bộ vùng khởi đầu (§3.2) cho mỗi user đang có mục Knowledge.
4. Gán vùng theo loại cũ (đề xuất, chờ số liệu preflight):

   | Loại cũ | Vùng |
   |---|---|
   | `ai` | AI & Công nghệ |
   | `entertainment` | Giải trí |
   | `learn` | Cách học (*cần bạn xác nhận: "Học" cũ có thể là khoá tiếng Anh*) |
   | `note`, `idea`, `quote`, `podcast` | Chưa xếp (bạn xếp dần) |

5. Verify cuối file: số mục không đổi; mọi `area_id` khác NULL trỏ đúng vùng cùng chủ.
6. Rollback: bỏ FK, bỏ cột `area_id`, xoá bảng và hàm trigger. Cột `type` chưa bị đụng.

Pha 1 **không đổi `type`, không đổi `status`**. Mục cũ đang `unread` sẽ hiện ở dải Đọc dở (chỉ 3 thẻ).

**Pha 2 — thu gọn `type`** (`supabase/migrations/20261025010000_knowledge_type_collapse_v7_0_0.sql`)
Chỉ chạy **sau khi UI mới đã deploy và bạn dùng ổn 1–2 tuần**.

1. Preflight: `count(*) WHERE type = 'inbox'` phải bằng 0, nếu không thì dừng.
2. Sao lưu: `collections_type_backup_v7 (id, type)` cho mọi mục có `type` thuộc `learn, idea, ai, entertainment`.
3. `UPDATE collections SET type = 'note' WHERE type IN ('learn','idea','ai','entertainment')`.
4. Đổi `DEFAULT` của `type` từ `'inbox'` sang `'note'` (nếu không, insert thiếu `type` sẽ vi phạm CHECK mới).
5. Thay `chk_collections_type` thành `CHECK (type IN ('note','quote','podcast'))`.
6. Verify; rollback: bỏ CHECK mới, khôi phục từ bảng sao lưu, đặt lại CHECK và DEFAULT cũ.

Cả hai pha do **bạn chạy** bằng `psql -f` trên Supabase (CLAUDE.md, RULES §12). Không có `reset`, không `TRUNCATE`, không `DELETE` hàng loạt.

---

## 7. Logic thuần và test

Tất cả trong `src/utils/kbDeriveUtils.js`, test bổ sung vào `src/__tests__/core/kbDeriveUtils.test.js` (đã nằm trong `npm test`).

| Hàm | Làm gì | Ca kiểm chính |
|---|---|---|
| `normalizeVi(s)` | Bỏ dấu, `đ→d`, chữ thường | "Tâm Lý" → "tam ly" |
| `contentKind(item)` | Ra Loại theo §3.3 | github, youtu.be, shorts, fb.watch, mp3, Drive `#audio`, không link + `quote` |
| `sourceKey(url)` | Khoá "cùng nguồn": `github.com/<owner>`, kênh/tên miền | 2 repo cùng chủ → cùng khoá; URL hỏng không ném lỗi |
| `guessTitle(url)` | Tiêu đề đoán từ link | `owner/repo`; YouTube; fallback tên miền |
| `progressOf(item, tasks)` | Tiến độ §3.4 | unread; read; read + note; task mở; mọi task xong |
| `searchItems(items, {q, kind, time, archived})` | Tìm §4.5 | không dấu; nhiều từ AND; tìm trong note; lọc thời gian ở biên 7/30/90 ngày |
| `findNeighbors(item, items)` | 3 nhóm Xung quanh, không trùng | cùng vùng; cùng nguồn trừ đã có; gần thời điểm khác vùng |
| `suggestArea(input, items, areas)` | Gợi ý vùng: cùng nguồn hay xếp ở đâu (≥ 2 lần) → từ khoá vùng → không gợi ý | ít dữ liệu → null, không đoán bừa |
| `pickResurface(items, dateStr, n)` | 3 mục "Gặp lại", cố định trong ngày | cùng ngày cùng kết quả; chỉ mục > 30 ngày |
| `isStale(item, today)` | Chưa đọc xong > 30 ngày | biên 30/31 ngày |

`filterArticles` cũ thay bằng `searchItems`. `TYPE_GLYPHS` thay bằng `KIND_META` (nhãn, icon theo Loại).

---

## 8. Kế hoạch theo file

### 8.1. Tạo mới

| File | Việc |
|---|---|
| `supabase/migrations/20261025000000_knowledge_areas_v6_32_0.sql` | Pha 1 (§6.3) |
| `supabase/migrations/20261025010000_knowledge_type_collapse_v7_0_0.sql` | Pha 2, viết sẵn, chạy sau |
| `src/hooks/useCollectionAreas.js` | Data owner cho vùng: fetch, thêm (chặn 8), sửa, gộp, xoá; optimistic có rollback |
| `src/components/kb/KBHome.jsx` | Trang đầu §5.2 |
| `src/components/kb/KBAreaView.jsx` | Trang vùng §5.3 |
| `src/components/kb/KBQuickSave.jsx` | Hộp Cất vào §5.5 |
| `src/components/kb/KBAreaPicker.jsx` | Chọn vùng + gợi ý; dùng ở Cất vào, Soạn thảo, Trang mục, khay Chưa xếp |
| `src/components/kb/KBAround.jsx` | Khung Xung quanh |

### 8.2. Sửa

| File | Việc |
|---|---|
| `src/pages/CollectPage.jsx` | View mới: `home / area / unsorted / reading / mine / reader / editor`; handler cất nhanh, đọc xong, thực hành, lưu trữ + hoàn tác, vùng; bỏ chọn nhiều; rút gọn phím tắt (`/`, `N`, `Esc`, `E`) |
| `src/components/kb/KBSubHeader.jsx` | Tên + Cất vào + menu "…"; bỏ thanh 4 kiểu xem và ô tìm (ô tìm vào `KBHome`) |
| `src/components/kb/KBReaderView.jsx` | Thanh nút mới; chip vùng; ô rút ra; cột phải theo §5.4 |
| `src/components/kb/KBEditorView.jsx` | Bộ chọn vùng thay chip loại; Ghi chú/Trích đoạn; ẩn thẻ; tiêu đề tự điền |
| `src/components/kb/KBGalleryView.jsx` | Dùng cho Trích đoạn trong vùng; thêm "Đọc ngẫu nhiên"; `KIND_META` |
| `src/components/kb/KBGraphView.jsx`, `KBCanvasView.jsx` | Đổi màu theo vùng thay vì loại; chỉ mở từ menu "…" |
| `src/components/LinkKBModal.jsx` | `TYPE_ICONS` cũ → `KIND_META` |
| `src/hooks/useCollections.js` | Join `collection_notes(id, content, created_at)`; nhận/ghi `area_id`; bài mới mặc định `unread`; tuỳ chọn lấy cả mục lưu trữ |
| `src/utils/kbDeriveUtils.js` | Hàm §7; bỏ `filterArticles`, `TYPE_GLYPHS` |
| `src/data/knowledge.json` | Thay 7 loại bằng: bộ vùng khởi đầu (tên, định nghĩa, màu, từ khoá gợi ý), `KIND_META`, giới hạn (8 vùng, 30 ngày, 3 mục/dải) |
| `src/styles/collect.css` | Style khối mới; xoá CSS của hàng loại, hàng thẻ, thanh chọn nhiều, thanh 4 kiểu xem |
| `src/__tests__/core/kbDeriveUtils.test.js` | Ca kiểm §7 |
| `docs/DATABASE.md` | Bảng, cột, CHECK, migration mới |
| `docs/FEATURES.md` | Phần Knowledge + quy chuẩn §3 |
| `docs/ARCHITECTURE.md` | Key `vl_kb_recent`, sơ đồ component Knowledge |
| `docs/MODULE_KNOWLEDGE.md` | Đã lỗi thời từ 09/2026 → viết lại theo v2 hoặc xoá (gộp phần còn đúng vào FEATURES) |
| `DESIGN.md` | Phần Knowledge sau bước B1 |
| `CHANGELOG.md` | Mỗi bước một mục |

### 8.3. Xoá

| File | Lý do |
|---|---|
| `src/components/kb/KBListView.jsx` | Thay bằng `KBHome` + `KBAreaView` |
| `src/components/kb/KBTagModal.jsx` | Gắn thẻ hàng loạt không còn ở v1 |
| File mockup trong scratchpad | Hết vai trò sau khi có bản nhìn thật |

---

## 9. Thứ tự làm

| Bước | Việc | Bạn kiểm gì |
|---|---|---|
| **B0** | Duyệt tài liệu này + quy chuẩn §3 | Đọc, sửa, chốt |
| **B1** | Bản nhìn thật 3 màn (§5.8) | Chọn hướng A/B/C, duyệt hình |
| **B2** | Logic thuần + test (§7) | `npm test` xanh |
| **B3** | Viết migration Pha 1 + `useCollectionAreas` + sửa `useCollections` | Bạn chạy preflight, gửi số liệu; chạy Pha 1 |
| **B4** | UI: trang đầu, vùng, Cất vào, trang mục, soạn thảo | Checklist §12, build tay |
| **B5** | Dọn: xoá file/CSS cũ, Sơ đồ/Canvas vào menu | Không còn màn cũ |
| **B6** | Dùng thật 1–2 tuần → chạy migration Pha 2 | Không lỗi khi lưu mục mới |
| **B7** | Docs + CHANGELOG (làm dần trong từng bước) | — |

Không commit, không push, không chạy migration nếu bạn chưa bảo.

---

## 10. Ngoài phạm vi v1

- Nhóm nhỏ trong vùng, thẻ trong giao diện chính (§3.6).
- Trang tổng hợp tự viết.
- Nút "Cất vào Kho" ngay trên task (task đọc link xong → thành mục Knowledge).
- Lấy tiêu đề / ảnh thật của trang qua server (Facebook thường chặn).
- Chia sẻ thẳng từ app Facebook/YouTube trên Android (Web Share Target).
- AI tự phân loại, tìm kiếm bằng ngôn ngữ tự nhiên, ôn tập ngắt quãng.

---

## 11. Rủi ro và đánh đổi

| Rủi ro | Cách xử lý |
|---|---|
| Ranh giới vùng mờ (Tâm lý / Cách học) | Định nghĩa + ví dụ hiện khi chọn; phép thử "sẽ tìm ở đâu"; đổi vùng 1 chạm; tìm không phụ thuộc vùng |
| Gợi ý vùng sai lúc ít dữ liệu | Chỉ gợi ý, không tự xếp; không đủ dữ kiện thì không gợi ý |
| Join `collection_notes` làm query nặng hơn | Quy mô cá nhân (≤ 500 mục) nhỏ; nếu chậm thì chỉ lấy `count` và tải nội dung khi mở "Ghi chú của tôi" |
| Pha 2 thu hẹp CHECK khi còn tab cũ đang mở | Chỉ chạy sau khi UI mới deploy; có bảng sao lưu để rollback |
| Bỏ chọn nhiều | Lưu trữ từng mục; nếu cần dọn hàng loạt sẽ thêm lại sau |
| Thẻ cũ bị ẩn | Không mất dữ liệu; vẫn quản lý ở Cài đặt; quay lại khi làm Nhóm nhỏ |
| Bài FB mất nội dung khi bị xoá | Khuyến khích dán kèm đoạn chữ vào "Lưu để" |

---

## 12. Câu hỏi cần bạn quyết

1. Hướng hình ảnh A / B / C (§5.8)?
2. Bộ vùng khởi đầu: 5 vùng như §3.2 (gộp Tâm lý + Quan điểm sống), hay tách riêng thành 6?
3. Loại cũ `learn` ("Học") → vùng Cách học có đúng không? (Gửi kết quả câu preflight §6.3 để quyết chính xác.)
4. Sơ đồ và Canvas: giữ trong menu "…" hay xoá hẳn?
5. Bỏ chọn nhiều ở v1: đồng ý?
6. Phím tắt kiểu Vim (`J/K`, `G` + phím): giữ hay bỏ?
7. Đánh số phiên bản: Pha 2 là v7.0.0 (đổi schema theo RULES), hay gộp vào v6.32.x?

---

## 13. Checklist test tay (sau B4)

Cần đăng nhập (Knowledge không có chế độ khách).

- [ ] Cất link GitHub: tiêu đề tự là `owner/repo`, Loại = Repo, vùng AI được gợi ý (sau khi đã có ≥ 2 repo ở AI).
- [ ] Cất chữ dán vào: mặc định Trích đoạn; gõ tay: mặc định Ghi chú.
- [ ] Cất không chọn vùng → hiện ở khay Chưa xếp; bấm chip gợi ý → rời khay.
- [ ] Mở mục → Đọc xong → viết 1 câu → nhãn "Đã rút ra", câu hiện ở "Ghi chú của tôi".
- [ ] Thực hành → task xuất hiện ở `/tasks`, có link về mục; đánh xong task → "Đã thực hành".
- [ ] Lưu trữ → mục biến khỏi trang đầu; Hoàn tác → quay lại.
- [ ] Gõ "tam ly" ra các mục Tâm lý; chip "Repo" lọc đúng; "Gồm cả đã lưu trữ" hiện mục vừa lưu trữ.
- [ ] Khung Xung quanh: 3 nhóm, không mục nào lặp giữa các nhóm.
- [ ] Vùng Giải trí có ≥ 3 trích đoạn: nút "Đọc ngẫu nhiên" chạy.
- [ ] Tạo vùng thứ 9 bị chặn, gợi ý Gộp; gộp vùng chuyển hết mục.
- [ ] Xoá vùng → mục về Chưa xếp.
- [ ] Trên điện thoại: cột Xung quanh xuống dưới, hộp Cất vào dạng tấm từ dưới lên.
- [ ] Trình phát podcast nổi vẫn chạy với mục âm thanh.
