# Knowledge v2 — Chủ đề, Tổng quan, tìm lại dễ hơn

> **Trạng thái:** Đề xuất, chờ duyệt. Chưa có dòng code hay migration nào được viết.
> **Ngày:** 2026-10-24 · **Phạm vi:** module Knowledge (`/collect`).
> **Cách làm:** nâng cấp tại chỗ — **giữ toàn bộ chức năng hiện có, chỉ thêm và sửa nhẹ**, không gỡ màn nào.
> **Giao diện:** hướng **1a "Thư phòng"** (giữ ngôn ngữ hình ảnh Knowledge hiện tại) **mượn 3 thứ từ 1b** (§5.1).
> Nhãn theo `docs/RULES.md` §1: **[Đã kiểm]** = đọc trực tiếp từ code/schema, **[Giả định]** = cần xác nhận,
> còn lại là **đề xuất**.

---

## 0. Tóm tắt

Knowledge hiện tại vẫn được giữ nguyên: mỗi mục là một bài viết, trình soạn thảo Markdown/Visual, trang đọc chi tiết,
liên kết `[[ ]]`, Sơ đồ, Canvas, Gallery, chọn nhiều, thẻ, phím tắt. Bản này thêm vào những gì còn thiếu:

- **Chủ đề** thay cho 7 loại hiện tại: mỗi bài một chủ đề chính, để trống được.
- **Hàng chip chủ đề** luôn ở đầu trang, bấm một lần là lọc.
- **Tab Tổng quan** (mới, đứng đầu): Xếp nhanh, Đọc dở, Gặp lại hôm nay, Mở gần đây. Tab Danh sách cũ vẫn còn.
- **Tìm kiếm** không cần dấu, nhiều từ, tìm cả trong ghi chú.
- **Trang đọc** thêm chip chủ đề, nút **Đọc xong**, **Tiến độ 5 bước**, thẻ **Xung quanh**.
- **Gán chủ đề hàng loạt** trong chế độ chọn nhiều, để xếp nhanh các bài cũ.

Không thêm upload, không thêm thư viện ngoài. Media vẫn là link YouTube / Drive / file âm thanh như hiện tại.

---

## 1. Bối cảnh

### 1.1. Hiện trạng [Đã kiểm]

| Điểm | Chi tiết |
|---|---|
| 7 loại trộn 3 trục | `note, quote, learn, idea, ai, entertainment, podcast`: có cái là định dạng, có cái là chủ đề, có cái là mục đích → khó chọn khi lưu. |
| Không có "bản đồ" | Màn chính là danh sách bài chạy dài; lọc bằng chip loại và hàng thẻ. |
| Hàng thẻ lẫn thẻ module khác | `CollectPage.jsx:75` gộp toàn bộ `centralTags` (dùng chung với Finance/Tasks) vào hàng lọc. |
| Tìm kiếm yếu | `filterArticles` (`kbDeriveUtils.js:200`): phải gõ đúng dấu, tìm trên `body` thô (bài Visual là JSON), không tìm trong ghi chú cá nhân. |
| "Liên quan" phải nối tay | Backlink, sơ đồ chỉ dựa vào `[[liên kết]]` tự viết. |
| Trạng thái có mà không dùng | Cột `status` (`unread/read/archived`) có sẵn, UI không dùng; bài mới luôn lưu `read`. |
| Task liên kết chỉ thấy task chưa xong | `articlesWithTasks` lọc theo `pendingTasks`. |
| Ràng buộc DB | `chk_collections_type` vẫn gồm `'inbox'`; `type DEFAULT 'inbox'`. App luôn ghi `type` nên chưa gây lỗi. |

### 1.2. Nỗi đau bạn đã xác nhận

1. Cất thì dễ, dùng lại thì khó.
2. Phải quyết định quá nhiều ngay lúc cất.
3. Nhiều mục đích, nhiều vòng đời trộn trong một danh sách.
4. Không có vòng biến thông tin thành kiến thức của mình.

### 1.3. Đã cân nhắc và không làm

| Ý | Vì sao không |
|---|---|
| Gỡ giao diện cũ, làm lại từ đầu | Bạn thích chức năng hiện tại; chỉ thấy còn thiếu. |
| Hộp "Cất vào" nhanh, share từ Facebook, thư viện ngoài | Bạn tự copy link / chữ vào thành bài viết là đủ. |
| Upload video/ảnh mới | Supabase bản free; media dùng link ngoài. |
| Màn "Inbox" riêng | Inbox đã gộp vào Tasks hồi tháng 9. Thay bằng khối Xếp nhanh trong Tổng quan. |
| Trục mục đích "Muốn học / Tra cứu" | Bắt đoán trước, thấy bị xé nhỏ. Thay bằng **Tiến độ** tự ghi theo việc bạn làm. |
| Tách module con theo loại (GitHub, Video…) | Nhân bản đúng câu hỏi "bỏ vào đâu". |
| Trang tổng hợp tự viết (hub) | Phải tự nối từng nguồn. Để sau. |
| Giao diện 1c (sáng, kiểu tạp chí) | Chọn 1a để phần mới cùng một kiểu với phần cũ, không cần bước đổi giao diện. |

---

## 2. Nguyên tắc

1. **Thêm vào, không gỡ.** Chức năng nào đang có vẫn còn và vẫn ở chỗ cũ.
2. **Một quyết định duy nhất khi lưu: Chủ đề** — và để trống cũng được.
3. **Trạng thái là việc đã làm, không phải ngăn phải chọn.**
4. **Tìm lại theo cách bạn nhớ:** vài chữ không dấu, nguồn, thời gian, "những thứ ở gần".
5. **Luật do app giữ** (ví dụ tối đa 8 chủ đề), không bắt bạn nhớ.
6. **Không biến kho thành đống việc tồn:** khối nào cũng giới hạn số mục hiện, mục để lâu thì app hỏi lại, không có số đếm đỏ.

---

## 3. Quy chuẩn phân loại

### 3.1. Ba trục

| Trục | Câu hỏi | Ai quyết | Số lượng |
|---|---|---|---|
| **Chủ đề** | Nó thuộc mảng nào trong đời mình? | Bạn, một lần, để trống được | Tối đa 8, mỗi bài đúng 1 |
| **Loại** | Nó là cái gì? | Máy tự nhận từ link | Cố định |
| **Tiến độ** | Mình đã làm gì với nó? | Tự ghi theo nút bạn bấm | Chuỗi 5 bước |

Thêm một lựa chọn **Kiểu** trong trình soạn thảo, chỉ để giữ các tính năng đang có:
*Bài viết* (mặc định) · *Trích dẫn* (gallery thẻ trích dẫn) · *Podcast* (trình phát nổi toàn app).

### 3.2. Chủ đề

**Bộ khởi đầu (đề xuất):**

| # | Chủ đề | Định nghĩa (hiện khi chọn) | Ví dụ |
|---|---|---|---|
| 1 | Công nghệ & AI | Repo, công cụ AI, lập trình, web, tự động hoá | `browser-use`, MCP servers, thư viện React |
| 2 | Tâm lý & Con người | Hành vi, cảm xúc, giao tiếp, động lực, các mối quan hệ | Hiệu ứng Zeigarnik, dopamine |
| 3 | Học tập & Năng suất | Phương pháp học, ghi nhớ, tập trung, quản lý thời gian, thói quen | Feynman, ôn ngắt quãng |
| 4 | Ngôn ngữ & Giao tiếp | Tiếng Anh, từ vựng, nghe nói, phát âm, cách diễn đạt | Shadowing, cụm từ tiếng Anh |
| 5 | Ý tưởng & Thiết kế | UX/UI, ý tưởng sản phẩm, cảm hứng thiết kế, tính năng muốn thử | Hiệu ứng loading, mẫu giao diện |
| 6 | Góc nhìn & Cảm hứng | Quan điểm sống, trích dẫn, bài học cá nhân | "Kỷ luật là tự do" |
| 7 | Giải trí | Đọc, xem cho vui: truyện hài, hội thoại hay | Chuyện ông bán bánh mì và con mèo |

**Luật:**
1. Mỗi bài thuộc đúng một chủ đề, hoặc chưa có (Chưa xếp).
2. Phân vân giữa hai chủ đề → chọn **chỗ lần sau mình sẽ đi tìm nó**.
3. Chủ đề phải **đủ rộng để chứa nhiều dạng nội dung**. Không tạo "AI Videos", "AI Repos" — dạng nội dung đã có trục Loại.
4. Chủ đề là **mảng quan tâm lâu dài**. Không phải dự án hay việc cần làm (→ Tasks, qua nút Thực hành).
5. Chỉ tạo chủ đề mới khi có **≥ 5 bài** mà không chủ đề nào hợp.
6. **Tối đa 8 chủ đề.** Đủ 8 thì nút "Tạo chủ đề" đổi thành "Gộp chủ đề". App và DB cùng chặn.
7. Tên 1–4 chữ, không trùng nghĩa nhau; mỗi chủ đề có một dòng định nghĩa.
8. Câu nói gắn với một mảng thì về mảng đó. Thứ chỉ để vui → Giải trí.

### 3.3. Loại (máy tự nhận, chỉ để hiển thị và lọc)

| Điều kiện | Loại |
|---|---|
| `github.com/<owner>/<repo>` | Repo |
| YouTube (`watch`, `youtu.be`, `shorts`, `embed`) | Video |
| Drive dạng video (`#video`) | Video |
| `facebook.com`, `fb.watch`, `m.facebook.com` | Bài FB |
| Link âm thanh / Drive dạng audio (`getMediaType`) | Âm thanh |
| Link khác | Bài viết |
| Không có link, kiểu Trích dẫn | Trích dẫn |
| Không có link | Ghi chú |

### 3.4. Tiến độ

```
Chưa đọc xong ─▶ Đã đọc ─▶ Đã rút ra ─▶ Đang thực hành ─▶ Đã thực hành
                (1 chạm)  (có ghi chú)  (có task mở)     (task xong)
```

- Không bắt buộc đi hết. Trích dẫn dừng ở "Đã đọc" là đủ.
- Bài mới **có link** → *Chưa đọc xong*. Bài mới **không có link** (ghi chú, trích dẫn của bạn) → *Đã đọc*.
- "Đọc xong" là một nút bật/tắt. Bấm xong, con trỏ nhảy vào ô ghi chú cá nhân có sẵn để rút ra 1 câu (bỏ qua được).
- Bài *Chưa đọc xong* quá **30 ngày** → app hỏi "Còn muốn đọc không?" [Đọc xong] [Lưu trữ].

### 3.5. Lưu trữ và Xoá

- **Lưu trữ** (mới, dùng `status = 'archived'` có sẵn): ẩn khỏi mọi danh sách, vẫn còn trong DB. Tìm kiếm có chip "Gồm cả đã lưu trữ". Có Hoàn tác.
- **Xoá:** giữ như hiện tại (xác nhận + hoàn tác ⌘Z).

### 3.6. Thẻ

Giữ nguyên như hiện tại. Chỉ sửa lỗi hàng lọc thẻ hiện lẫn thẻ của Finance/Tasks: chỉ hiện thẻ đang được bài Knowledge dùng.

---

## 4. Luồng UX

### 4.1. Lưu một bài (giữ cách cũ, bớt bước)

1. Bấm **＋ Bài mới** như hiện tại.
2. Dán link vào ô URL → nếu ô tiêu đề đang trống, app **tự điền tiêu đề đoán từ link** (repo → `owner/repo`; video YouTube → "Video YouTube"; còn lại → tên miền). Sửa được.
3. Chọn **chủ đề**: hàng chip, chủ đề gợi ý được tô sẵn (nếu có). Không chọn = Chưa xếp.
4. Viết vài dòng "lưu để làm gì", hoặc dán đoạn chữ của bài (nên làm với bài Facebook vì bài có thể bị xoá).
5. Lưu (`Ctrl+S` như hiện tại).

Mọi thứ còn lại của trình soạn thảo giữ nguyên.

### 4.2. Xếp bài chưa có chủ đề

- **Bài mới (trong 30 ngày):** khối **Xếp nhanh** ở Tổng quan hiện **từng bài một**: tiêu đề, loại, dòng đầu nội dung, hàng chip chủ đề (gợi ý tô sẵn) + "Để sau" + "Lưu trữ". Máy tính: phím số **1–8** chọn chủ đề, `→` để sau. Không ép dọn hết.
- **Bài cũ:** không hiện thành đống ở Tổng quan. Vào Danh sách, bấm chip **Chưa xếp**, bật **Chọn nhiều**, chọn một loạt rồi bấm **Gán chủ đề**.

### 4.3. Đọc, Đọc xong, Rút ra

- Mở bài như hiện tại.
- Bấm **Đọc xong** → nhãn đổi thành "✓ Đã đọc", con trỏ vào ô ghi chú cá nhân (đã có sẵn ở trang đọc). Viết 1 câu → "Đã rút ra".

### 4.4. Thực hành

- Nút **◇ Nhiệm vụ** hiện có đổi nhãn thành **◇ Thực hành**, giữ nguyên hành vi: tạo task từ bài và nối với bài.
- Tiến độ hiện "Đang thực hành" khi có task mở, "Đã thực hành" khi mọi task nối với bài đã xong.

### 4.5. Tìm lại

- Vẫn ô tìm hiện tại (phím `/`). Nâng cấp:
  - không cần dấu: "tam ly" ra "Tâm lý";
  - nhiều từ cùng lúc, mọi từ phải khớp;
  - tìm trên tiêu đề, nội dung chữ (`body_text`, không phải JSON thô), ghi chú cá nhân, link, tên chủ đề, tên thẻ;
  - `#tên` vẫn lọc theo thẻ như hiện tại.
- Khi đang có chữ trong ô tìm, hiện thêm chip lọc: **Loại** · **Thời gian** (Tuần này, Tháng này, 3 tháng, Cũ hơn) · **Gồm cả đã lưu trữ**.

### 4.6. Gặp lại và Mở gần đây

- **Gặp lại hôm nay:** 3 bài cũ hơn 30 ngày, ưu tiên bài đã rút ra, trích dẫn và ghi chú của bạn; không bốc link trơn. Chọn theo ngày nên cả ngày ra cùng 3 bài.
- **Mở gần đây:** 3 bài mở gần nhất trên máy này (`localStorage`).

### 4.7. Quản lý chủ đề

- Menu "…" trong hàng chip chủ đề → hộp **Quản lý chủ đề**: thêm, đổi tên, sửa định nghĩa, đổi màu, sắp thứ tự, gộp, xoá.
- **Gộp:** chuyển mọi bài sang chủ đề đích rồi xoá chủ đề cũ.
- **Xoá:** bài bên trong về Chưa xếp, không mất bài nào.

### 4.8. Đếm thao tác

| Tình huống | Bắt buộc | Tùy chọn, về sau |
|---|---|---|
| Lướt FB thấy bài hay | Bài mới → dán link (+ dán chữ) → Lưu | Chọn chủ đề lúc lưu hoặc ở Xếp nhanh |
| Repo AI, đọc thấy hay, muốn thử | Bài mới → dán link → Lưu (tiêu đề tự điền) | Đọc xong (+1 câu) · Thực hành |
| Bài tâm lý đọc dở | Bài mới → dán link → Lưu | Đọc xong khi đọc hết |
| Truyện hài, câu nói hay | Bài mới → dán chữ → Lưu | Đọc lại trong Gallery / Gặp lại |

---

## 5. Màn hình

### 5.1. Giao diện: 1a mượn 1b

Chuẩn hình là mockup **1a "Thư phòng"** trong `Knowledge v2 Mockup.dc.html` (Claude Design). Màu, font, khoảng cách
dùng lại `src/styles/kb-tokens.css` (đã có cả bản tối và sáng), nên phần mới cùng kiểu với phần cũ.

**Mượn từ 1b:**
1. **Danh sách chủ đề luôn cách một chạm** — làm thành **hàng chip cố định dưới tiêu đề** (không thêm cột trái thứ hai vì app đã có thanh điều hướng 232px). Điện thoại: cuộn ngang.
2. **Xếp nhanh từng bài** bằng phím số / chip (§4.2).
3. **Tiến độ 5 bước** ở cột phải trang đọc.

**Sửa so với mockup khi code:**
- Nút hành động ghi **"Đọc xong"**; khi đã bấm thì hiện trạng thái "✓ Đã đọc".
- Không hiển thị dữ liệu cần gọi API ngoài: mô tả / ngôn ngữ / giấy phép repo, "Trích README", thời lượng video. Ảnh thu nhỏ YouTube lấy từ ID video thì được.
- Chữ nhỏ viết hoa kiểu mono tối thiểu **11px**, tương phản đủ đọc.
- Có bản điện thoại và chế độ sáng (mockup chưa có, làm theo §5.7 và token sáng sẵn có).

### 5.2. Đầu trang (sửa `KBSubHeader`)

- **Giữ:** tiêu đề, ô tìm, thanh kiểu xem, nút ＋ Bài mới.
- **Thêm vào thanh kiểu xem:** tab **Tổng quan** đứng đầu: `Tổng quan · Danh sách · Gallery · Sơ đồ · Canvas`.
- **Thêm hàng chip chủ đề** ngay dưới: `Tất cả · Chưa xếp · <các chủ đề, có chấm màu và số bài> · …`. Chip đang chọn lọc mọi kiểu xem. "…" mở Quản lý chủ đề.

### 5.3. Tab Tổng quan (mới, `KBOverview`)

| # | Khối | Hiện khi | Giới hạn |
|---|---|---|---|
| 1 | Thanh "Đã lưu trữ … · Hoàn tác" | Vừa lưu trữ | 1 dòng |
| 2 | **Xếp nhanh · n/N** | Có bài chưa có chủ đề trong 30 ngày | 1 bài một lúc |
| 3 | **Đọc dở · N** | Có bài *Chưa đọc xong* | 3 thẻ + "Xem cả N"; bài > 30 ngày hiện câu hỏi |
| 4 | **Các chủ đề** | Luôn | Lưới thẻ: tên, số bài, định nghĩa, 2 bài mới nhất, "N đọc dở"; thẻ cuối **Ghi chú của tôi** |
| 5 | **Gặp lại hôm nay · Mở gần đây** | Có dữ liệu | 2 cột × 3 bài |

Đang gõ tìm thì các khối ẩn, hiện kết quả như tab Danh sách.

### 5.4. Tab Danh sách (giữ `KBListView`, sửa nhẹ)

- **Giữ:** dòng bài, sắp xếp, chọn nhiều, xoá hàng loạt, gắn thẻ hàng loạt, hàng thẻ, con trỏ J/K.
- **Đổi:** hàng chip 7 loại → bỏ, vì đã có hàng chip chủ đề ở đầu trang. Dòng meta hiện **chấm màu + chủ đề** và **loại** thay cho nhãn loại cũ; thêm nhãn tiến độ nhỏ.
- **Thêm:** nút **Gán chủ đề** trong thanh chọn nhiều.
- **Khi đang lọc một chủ đề:** phần đầu danh sách hiện tên + định nghĩa chủ đề + "…" quản lý. Đây chính là "trang một chủ đề", không viết màn riêng.
- **Hàng thẻ:** chỉ thẻ đang được bài Knowledge dùng.

### 5.5. Trang đọc (giữ `KBReaderView`, thêm)

- **Thanh trên — giữ:** ← Thư viện, ↑ ↓, Tập trung, ↔ Liên kết, ✎ Sửa, ⌫ Xoá.
  **Thêm:** chip chủ đề (bấm để đổi), nút **Đọc xong**, mục **Lưu trữ**. **Đổi nhãn:** ◇ Nhiệm vụ → ◇ Thực hành.
- **Nội dung, media, ghi chú cá nhân:** giữ nguyên.
- **Cột phải — giữ** 6 thẻ hiện có (thông tin, sơ đồ nhỏ, mục lục, liên kết đi, backlink, task liên kết).
  **Thêm:** **Tiến độ 5 bước** vào thẻ thông tin; thẻ mới **Xung quanh** ngay dưới thẻ thông tin:
  *Cùng chủ đề* (3 bài) · *Cùng nguồn* (cùng chủ repo / kênh / tên miền) · đường gạch · *Lưu gần thời điểm* (±7 ngày, khác chủ đề) kèm chú thích "có thể khác chủ đề".
- Thẻ task liên kết giữ như cũ (chỉ task chưa xong). `useUserTasks` chỉ tải task chưa xong + xong trong hôm nay,
  nên "Đã thực hành" được suy ra: task đã nối mà không còn trong danh sách chưa xong ⇒ đã xong (task bị xoá thì
  junction cascade theo). Thẻ hiện thêm dòng "N task đã xong".

### 5.6. Trình soạn thảo (giữ `KBEditorView`, sửa)

- **Đổi:** hàng chip 7 loại → **hàng chip chủ đề** (gợi ý tô sẵn) + lựa chọn **Kiểu: Bài viết / Trích dẫn / Podcast**.
- **Thêm:** tiêu đề tự đoán từ link khi ô tiêu đề trống.
- **Giữ nguyên:** Markdown/Visual, thanh công cụ, media, thẻ, liên kết `[[ ]]`, phím tắt.

### 5.7. Điện thoại

- Hàng chip chủ đề cuộn ngang; thanh kiểu xem như hiện tại.
- Tổng quan: các khối xếp dọc; Đọc dở thành 1 cột; Gặp lại và Mở gần đây xếp dọc.
- Xếp nhanh: chip chủ đề xuống dòng, nút đủ lớn để bấm.
- Trang đọc: cột phải xuống dưới nội dung (theo layout hiện có).

### 5.8. Gallery, Sơ đồ, Canvas

Giữ nguyên chức năng. Chỉ đổi nguồn màu và nhãn: theo **chủ đề** thay vì 7 loại cũ.

---

## 6. Dữ liệu và migration

### 6.1. Mô hình

| Khái niệm | Lưu ở đâu | Mới hay có sẵn |
|---|---|---|
| Chủ đề | Bảng mới `collection_topics` | Mới |
| Chủ đề của bài | `collections.topic_id` | Cột mới |
| Kiểu (Bài viết / Trích dẫn / Podcast) | `collections.type` = `note` / `quote` / `podcast` | Có sẵn, chỉ dùng 3 giá trị cho bài mới |
| Loại (Repo, Video…) | Tính từ `url` + `type` | Không lưu |
| Chưa đọc xong / Đã đọc / Lưu trữ | `collections.status` = `unread` / `read` / `archived` | Có sẵn |
| Đã rút ra | Có ≥ 1 dòng `collection_notes` | Có sẵn |
| Đang / Đã thực hành | `task_collections` + `user_tasks.status` | Có sẵn |
| Mở gần đây | `localStorage` key `vl_kb_recent` (10 id) | Mới, tiện ích trên máy |

Bài cũ có `type` thuộc `learn, idea, ai, entertainment` vẫn giữ nguyên trong DB; UI coi là kiểu *Bài viết*.

### 6.2. Bảng `collection_topics`

```sql
CREATE TABLE collection_topics (
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
CREATE UNIQUE INDEX uq_collection_topics_user_name ON collection_topics (user_id, lower(btrim(name)));
-- RLS: 4 policy select/insert/update/delete, user_id = auth.uid() (giống collections).
-- Trigger updated_at.
-- Trigger BEFORE INSERT: chặn khi user đã có 8 chủ đề (§3.2 luật 6).

ALTER TABLE collections ADD COLUMN topic_id UUID;
ALTER TABLE collections ADD CONSTRAINT fk_collections_topic
  FOREIGN KEY (user_id, topic_id) REFERENCES collection_topics (user_id, id)
  ON DELETE SET NULL (topic_id);                        -- Postgres 15+: xoá chủ đề → bài về Chưa xếp
CREATE INDEX idx_collections_user_topic ON collections (user_id, topic_id);
```

FK hai cột `(user_id, topic_id)` bảo đảm bài và chủ đề **cùng một chủ** (RULES §7).
[Giả định] Supabase chạy Postgres ≥ 15 cho cú pháp `SET NULL (topic_id)`; preflight kiểm `SHOW server_version`.
Nếu thấp hơn: FK một cột `ON DELETE SET NULL` + trigger kiểm cùng `user_id`.

### 6.3. Migration (một pha, chỉ thêm)

File: `supabase/migrations/20261025000000_knowledge_topics_v6_32_0.sql`

1. **Preflight** (bạn chạy trước, gửi kết quả để chốt bảng ánh xạ):
   ```sql
   SHOW server_version;
   SELECT type, status, count(*) FROM collections GROUP BY 1, 2 ORDER BY 1, 2;
   ```
2. Trong một transaction: tạo bảng, RLS, trigger, cột `topic_id`, FK, index.
3. Tạo bộ 7 chủ đề khởi đầu (§3.2) cho mỗi user đang có bài Knowledge.
4. Gán chủ đề theo loại cũ (đề xuất, chờ số liệu preflight):

   | Loại cũ | Chủ đề |
   |---|---|
   | `ai` | Công nghệ & AI |
   | `entertainment` | Giải trí |
   | `learn` | Học tập & Năng suất (*cần bạn xác nhận*) |
   | `idea` | Ý tưởng & Thiết kế (*cần bạn xác nhận*) |
   | `note`, `quote`, `podcast` | Chưa xếp (gán dần bằng Gán chủ đề hàng loạt) |

5. Verify cuối file: số bài không đổi; mọi `topic_id` khác NULL trỏ đúng chủ đề cùng chủ.
6. Rollback: bỏ FK, bỏ cột `topic_id`, xoá bảng và hàm trigger.

Migration **không đổi `type`, không đổi `status`** của bài cũ. Không có `reset`, `TRUNCATE` hay `DELETE` hàng loạt.
Bạn chạy bằng `psql -f` trên Supabase (CLAUDE.md, RULES §12).

### 6.4. Để sau (không làm bây giờ)

Thu gọn `type` còn `note/quote/podcast`, bỏ `'inbox'` khỏi CHECK và đổi `DEFAULT 'inbox'` → `'note'`.
Không gấp vì app luôn ghi `type`; làm khi nào muốn dọn schema, có bảng sao lưu để rollback.

---

## 7. Logic thuần và test

Thêm vào `src/utils/kbDeriveUtils.js`; ca kiểm bổ sung vào `src/__tests__/core/kbDeriveUtils.test.js` (đã nằm trong `npm test`).

| Hàm | Làm gì | Ca kiểm chính |
|---|---|---|
| `normalizeVi(s)` | Bỏ dấu, `đ→d`, chữ thường | "Tâm Lý" → "tam ly" |
| `contentKind(item)` | Ra Loại theo §3.3 | github, youtu.be, shorts, fb.watch, mp3, Drive `#audio`/`#video`, không link + `quote` |
| `sourceKey(url)` | Khoá "cùng nguồn" | 2 repo cùng chủ → cùng khoá; URL hỏng không ném lỗi |
| `guessTitle(url)` | Tiêu đề đoán từ link | `owner/repo`; YouTube; fallback tên miền |
| `progressOf(item, tasks)` | Tiến độ §3.4 | unread; read; read + note; task mở; mọi task xong |
| `filterArticles(…)` (nâng cấp, giữ tên) | Thêm lọc chủ đề, loại, thời gian, lưu trữ; tìm không dấu nhiều từ | không dấu; AND nhiều từ; tìm trong ghi chú và `body_text`; `#thẻ` vẫn chạy; biên 7/30/90 ngày |
| `findNeighbors(item, items)` | 3 nhóm Xung quanh, không trùng | cùng chủ đề; cùng nguồn trừ đã có; gần thời điểm khác chủ đề |
| `suggestTopic(item, items, topics)` | Gợi ý: cùng nguồn hay xếp ở đâu (≥ 2 lần) → cùng loại dồn hẳn về một chủ đề (≥ 3 bài, ≥ 60%, ví dụ repo) → tên chủ đề xuất hiện trong tiêu đề/nội dung (chỉ khi khớp đúng một chủ đề) → không gợi ý | ít dữ liệu → null, không đoán bừa; "ai" quá ngắn không tính |
| `pickResurface(items, dateStr, n)` | 3 bài "Gặp lại", cố định trong ngày | cùng ngày cùng kết quả; chỉ bài > 30 ngày; không bốc link trơn |
| `isStale(item, today)` | *Chưa đọc xong* > 30 ngày | biên 30/31 ngày |

`TYPE_GLYPHS` thay bằng `KIND_META` (nhãn, icon theo Loại); màu lấy từ chủ đề.

---

## 8. Kế hoạch theo file

### 8.1. Tạo mới (5)

| File | Việc |
|---|---|
| `supabase/migrations/20261025000000_knowledge_topics_v6_32_0.sql` | Migration §6.3 |
| `src/hooks/useCollectionTopics.js` | Data owner cho chủ đề: fetch, thêm (chặn 8), sửa, sắp thứ tự, gộp, xoá; optimistic có rollback |
| `src/components/kb/KBOverview.jsx` | Tab Tổng quan §5.3 (gồm Xếp nhanh) |
| `src/components/kb/KBTopicPicker.jsx` | Hàng chip chọn chủ đề + gợi ý; dùng ở Xếp nhanh, trình soạn thảo, trang đọc, gán hàng loạt |
| `src/components/kb/KBTopicModal.jsx` | Quản lý chủ đề §4.7 (theo mẫu `KBTagModal`) |

### 8.2. Sửa

| File | Việc |
|---|---|
| `src/pages/CollectPage.jsx` | View `overview` (mặc định); state lọc chủ đề; handler gán chủ đề (lẻ + hàng loạt), đọc xong, lưu trữ + hoàn tác; phím `g t` về Tổng quan; `articlesWithTasks` dùng cả task đã xong |
| `src/components/kb/KBSubHeader.jsx` | Thêm tab Tổng quan; thêm hàng chip chủ đề |
| `src/components/kb/KBListView.jsx` | Bỏ hàng chip loại; meta hiện chủ đề + loại + tiến độ; nút Gán chủ đề; đầu danh sách khi lọc chủ đề; hàng thẻ chỉ thẻ Knowledge |
| `src/components/kb/KBReaderView.jsx` | Chip chủ đề; Đọc xong; Lưu trữ; đổi nhãn Thực hành; Tiến độ; thẻ Xung quanh |
| `src/components/kb/KBEditorView.jsx` | Chip loại → chip chủ đề + Kiểu; tiêu đề tự đoán |
| `src/components/kb/KBGalleryView.jsx`, `KBGraphView.jsx`, `KBCanvasView.jsx` | Màu / nhãn theo chủ đề thay `TYPE_GLYPHS` |
| `src/components/kb/KBShortcutsModal.jsx` | Thêm phím mới (`g t`, số 1–8 ở Xếp nhanh) |
| `src/components/LinkKBModal.jsx` | `TYPE_ICONS` cũ → `KIND_META` |
| `src/hooks/useCollections.js` | Đọc/ghi `topic_id`; join số ghi chú; trạng thái mặc định theo §3.4; tuỳ chọn lấy cả bài lưu trữ |
| `src/utils/kbDeriveUtils.js` | Hàm §7 |
| `src/data/knowledge.json` | 7 loại → bộ chủ đề khởi đầu (tên, định nghĩa, màu), giới hạn (8 chủ đề, 30 ngày, 3 bài/khối). `KIND_META` nằm trong `kbDeriveUtils.js` (cấu hình nhỏ gắn với code, test Node đọc được không cần import JSON) |
| `src/styles/collect.css` | Style phần mới theo 1a |
| `src/__tests__/core/kbDeriveUtils.test.js` | Ca kiểm §7 |
| `docs/DATABASE.md`, `docs/FEATURES.md`, `docs/ARCHITECTURE.md`, `docs/MODULE_KNOWLEDGE.md`, `DESIGN.md`, `CHANGELOG.md` | Cập nhật đúng vai trò (RULES §11); FEATURES có quy chuẩn §3 |

### 8.3. Xoá

Không xoá component nào.

---

## 9. Thứ tự làm

Mỗi bước dùng được ngay, bạn build và kiểm trước khi sang bước sau.

| Bước | Việc | Bạn kiểm gì |
|---|---|---|
| **B0** | Duyệt tài liệu này | Đọc, sửa, chốt |
| **B1** | Logic thuần + test (§7) | `npm test` xanh |
| **B2** | Migration + `useCollectionTopics` + sửa `useCollections` | Chạy preflight, gửi số liệu; chạy migration |
| **B3** | Hàng chip chủ đề, Quản lý chủ đề, trình soạn thảo, Danh sách + Gán chủ đề hàng loạt, tìm kiếm mới | Xếp được bài cũ; tìm "tam ly" ra |
| **B4** | Tab Tổng quan | Xếp nhanh, Đọc dở, Gặp lại, Mở gần đây |
| **B5** | Trang đọc: Đọc xong, Tiến độ, Xung quanh, Thực hành, Lưu trữ | Checklist §12 |
| **B6** | Docs + CHANGELOG | — |

Không commit, không push, không chạy migration nếu bạn chưa bảo.

---

## 10. Ngoài phạm vi

- Thu gọn cột `type` (§6.4).
- Nhóm nhỏ trong chủ đề (khi một chủ đề > ~15 bài).
- Trang tổng hợp tự viết.
- Lấy tiêu đề / ảnh / mô tả thật qua server hoặc API (GitHub, YouTube, Facebook).
- Upload mới, share từ app khác, thư viện ngoài.
- AI tự phân loại, tìm bằng ngôn ngữ tự nhiên, ôn tập ngắt quãng.

---

## 11. Rủi ro và đánh đổi

| Rủi ro | Cách xử lý |
|---|---|
| Ranh giới chủ đề mờ | Định nghĩa + ví dụ hiện khi chọn; phép thử "sẽ tìm ở đâu"; đổi chủ đề 1 chạm; tìm không phụ thuộc chủ đề |
| Bài cũ chưa xếp làm nản | Không hiện ở Tổng quan; xếp hàng loạt trong Danh sách khi rảnh |
| Gợi ý chủ đề sai lúc ít dữ liệu | Chỉ gợi ý, không tự xếp; thiếu dữ kiện thì không gợi ý |
| Thêm tab + hàng chip làm đầu trang dày hơn | Hàng chip một dòng, cuộn ngang; tab Tổng quan thay vai trò "màn chính" của Danh sách |
| Join số ghi chú làm query nặng hơn | ≤ 500 bài, chỉ lấy `count` |
| Bài Facebook mất nội dung khi bị xoá | Khuyến khích dán kèm đoạn chữ khi lưu |
| `DESIGN.md`, `docs/FEATURES.md`, `CHANGELOG.md` đang có thay đổi chưa commit của việc khác | Chỉ thêm phần Knowledge, không đụng phần khác |

---

## 12. Câu hỏi cần bạn quyết

1. Bộ 7 chủ đề §3.2 (tên, định nghĩa) dùng được chưa?
2. Ánh xạ loại cũ: `learn` → Học tập & Năng suất, `idea` → Ý tưởng & Thiết kế có đúng không? (Gửi kết quả preflight §6.3 để chốt.)
3. Mở Knowledge vào tab nào trước: **Tổng quan** (đề xuất) hay **Danh sách** như hiện tại?
4. Lưu mockup 1a vào repo (ví dụ `design/knowledge-v2/`, thư mục chưa có) để làm chuẩn hình, hay để ngoài repo?

---

## 13. Checklist test tay (sau B5)

Cần đăng nhập (Knowledge không có chế độ khách).

- [ ] Mọi chức năng cũ còn: soạn Markdown/Visual, media YouTube/Drive, `[[ ]]`, backlink, Sơ đồ, Canvas, Gallery, chọn nhiều, thẻ, J/K, ⌘Z.
- [ ] Bài mới dán link GitHub, tiêu đề trống → tự thành `owner/repo`.
- [ ] Chọn chủ đề trong trình soạn thảo; bỏ trống → bài vào Chưa xếp.
- [ ] Hàng chip chủ đề lọc đúng ở Danh sách, Gallery, Sơ đồ, Canvas.
- [ ] Chip Chưa xếp + Chọn nhiều + Gán chủ đề → cả loạt chuyển chủ đề.
- [ ] Tổng quan: Xếp nhanh chỉ bài mới trong 30 ngày; phím 1–8 chọn chủ đề; Đọc dở tối đa 3 thẻ, bài > 30 ngày hiện câu hỏi.
- [ ] Đọc xong → "✓ Đã đọc", con trỏ vào ô ghi chú; viết 1 câu → "Đã rút ra".
- [ ] Thực hành → task ở `/tasks`, có link về bài; xong task → "Đã thực hành".
- [ ] Lưu trữ → bài biến khỏi danh sách; Hoàn tác → quay lại; tìm với "Gồm cả đã lưu trữ" thấy lại.
- [ ] Gõ "tam ly" ra bài Tâm lý; `#tên-thẻ` vẫn lọc thẻ.
- [ ] Xung quanh: 3 nhóm, không bài nào lặp giữa các nhóm.
- [ ] Hàng thẻ không còn thẻ của Finance/Tasks.
- [ ] Tạo chủ đề thứ 9 bị chặn, gợi ý Gộp; gộp chuyển hết bài; xoá chủ đề → bài về Chưa xếp.
- [ ] Điện thoại: hàng chip cuộn ngang, Tổng quan xếp dọc, cột phải trang đọc xuống dưới.
- [ ] Chế độ sáng: phần mới đọc rõ.
- [ ] Trình phát podcast nổi vẫn chạy với bài kiểu Podcast.
