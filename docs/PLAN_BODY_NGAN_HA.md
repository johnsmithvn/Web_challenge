# PLAN — Body · Ngân hà

**Trạng thái:** đã chốt, sẵn sàng code · **Lập:** 2026-11-09 · **Người duyệt:** user

Đổi giao diện toàn bộ module Body (7 trang + màn tập) sang phong cách **Ngân hà**: tối là đêm sao (kính mờ,
viền phát sáng theo màu chỉ số), sáng là bình minh pastel. File này đủ để code từ đầu tới cuối **không cần hỏi
lại**. Gặp tình huống file này chưa nói tới thì làm theo mục 2 (nguyên tắc) và ghi lại quyết định vào báo cáo cuối.

**Mockup gốc:** [`design/body-ngan-ha/body-ngan-ha.dc.html`](../design/body-ngan-ha/body-ngan-ha.dc.html) (+
`body-kit.js` = dữ liệu mẫu & cách tính, `muscle-body.js`, `support.js`). Mockup là khung 1440×900 cố định với
dữ liệu cứng. Chỉ lấy **giao diện** (màu, cỡ chữ, bo góc, bố cục, trang trí) từ đó. Dữ liệu và hành vi lấy từ app.
Mở file HTML bằng trình duyệt nếu cần nhìn. Số đo cụ thể đã chép vào file này.

---

## 1. Quyết định đã chốt

| # | Vấn đề | Chốt |
|---|---|---|
| 1 | Tính năng app có mà mockup không vẽ | **Giữ hết.** Không bỏ tính năng nào, chỉ đổi giao diện/bố cục. Mockup thiếu chỗ nào thì giữ bản của app, dựng theo cùng phong cách |
| 2 | Nền động (sao, sao băng, tinh vân, cực quang) | **Không làm.** Giữ `<SkyBackground calm />` như hiện tại |
| 3 | Thanh dọc 88px của mockup | **Không làm.** Dùng **tab ngang kiểu Ngân hà** trên header (không chen thêm thanh dọc cạnh sidebar Life Hub 232px) |
| 4 | Theo dõi nước uống (cốc nước) | **Để sau.** App chưa có, cần bảng dữ liệu mới. Không làm trong plan này. Không vẽ vòng/cốc nước |
| 5 | Bản đồ cơ | **Giữ bố cục atlas cả màn** + đủ 3 chế độ, lật trước/sau, lưới 7 ngày, kỷ lục, cơ phụ trợ, dải bài. Chỉ đổi giao diện. **Không** đổi sang bố cục 3 cột của mockup |
| 6 | Thẻ Phục hồi cơ ở Tổng quan | Giữ hình cơ thể trong thẻ (nay là bản 2D, xem #12). Thêm 3 con số của mockup (Cần nghỉ / Đang hồi / Sẵn sàng). Không thay hình bằng 14 cột màu |
| 12 | Hình cơ thể | **Bỏ mô hình 3D (three.js), thay bằng hình 2D SVG kiểu Ngân hà** dùng chung cho Bản đồ cơ, Tổng quan, chi tiết bài tập (thay luôn `MuscleAnatomy2D` thô hiện tại) và mobile. Hình lấy từ bộ hình của `react-body-highlighter` (**MIT**, đã kiểm `npm view` 2026-11-09: v2.0.5), chép dữ liệu hình vào repo, **không** thêm thư viện. Mất thao tác kéo xoay tự do (thay bằng xem 2 mặt / nút lật). Làm ở **Đợt 0**, xong thì **dừng cho user xem** (điểm dừng duy nhất của plan) |
| 7 | Header trang Tổng quan | Dòng nhỏ `BODY · 01 / 07`, dòng to là **lời chào** "Tối nay, Minh". Trang khác: dòng to là tên trang |
| 8 | Nút Bắt đầu trên header (mọi trang, desktop) | Có buổi dở → pill **Tiếp tục buổi dở**. Hôm nay có lịch chưa tập → **Bắt đầu buổi tập**. Đã tập xong hôm nay → **Đã tập hôm nay** (mờ, không bấm được). Ngày nghỉ / chưa có lộ trình → **Mở lộ trình** (sang trang Lộ trình) |
| 9 | Nút chính (primary) | **Gradient như mockup.** Tối: `#8F96FF → #5EF2C2`, chữ đen. Sáng: `#5A55E0 → #A35BEA`, chữ trắng |
| 10 | Nhịp làm | Đợt 0 xong thì **dừng cho user duyệt hình 2D**. User ưng thì **chạy thẳng Đợt 1 → 11** (mục 5), cuối cùng báo một lần. Test fail thì **dừng và báo** (mục 2) |
| 11 | Mobile | Giữ cấu trúc mobile hiện tại của từng màn, khoác phong cách Ngân hà theo mục 6 |

---

## 2. Nguyên tắc bắt buộc khi code

1. **Không mất tính năng.** Trước khi dựng lại một màn, liệt kê mọi nút/hành động/thông tin màn đó đang có (đọc
   JSX). Xong màn thì đối chiếu lại danh sách. Thiếu thứ nào là chưa xong.
2. **Không đổi dữ liệu và hành vi:** không sửa schema, migration, query ghi; không đổi tên route `/body/:screen`;
   không đổi chữ ký props giữa `BodyPage` và các screen, trừ khi mục này cho phép.
   Ngoại lệ được phép: thêm hàm thuần (mục 7), thêm một query **chỉ đọc** 7 ngày trong `useNutrition` (Đợt 7).
3. **Màu chỉ lấy từ token** `--body-*` (mục 3). Không viết hex mới trong JSX/CSS của Body. Ngoại lệ duy nhất: nút
   điều khiển video trên nền đen trong `ExerciseVideoPlayer.jsx`.
4. **Gặp đoạn style inline khi dựng lại một khối:** chuyển sang class trong `body.css`. Không viết lại khối không
   nằm trong đợt đang làm.
5. **Grid:** cột co giãn luôn là `minmax(0, 1fr)` (RULES §14). Vùng cuộn nội bộ giữ `padding-bottom: 40px` để né FAB.
6. **Chuyển động** (trôi nhẹ, quay quỹ đạo, nhịp sáng, pháo sao) phải tắt được bằng **Giảm chuyển động**:
   `:root[data-reduce-motion] .body-workspace .<class> { animation: none; }`. JS đọc `reduceMotion` từ `useTheme()`.
   Không dùng `prefers-reduced-motion`.
7. **Không dùng `window.alert/confirm/prompt`.** Dialog dùng `ConfirmModal` / modal sẵn có.
8. **Truy cập được:** giữ `aria-*`, focus ring (`outline: 2px solid var(--body-accent)`), touch target mobile ≥ 40px.
   Trang trí thuần (hành tinh, sao, quỹ đạo, pháo) đặt `aria-hidden="true"` và `pointer-events: none`.
9. **Kiểm tra:** sau mỗi đợt chạy `npx eslint <các file vừa sửa>`. Đợt có đụng `src/utils/*` thì chạy thêm
   `npm test`. **Test fail thì dừng**, báo user test nào fail và vì sao, **không** tự sửa test hay logic cho xanh
   (CLAUDE.md). **Không chạy `npm run build`.** **Không** dùng Browser tool tự kiểm UI. **Không commit / push**
   khi user chưa bảo.
10. **Không refactor ngoài phạm vi.** `OverviewScreen` gọi `useWorkouts()` riêng là pattern hiện có, giữ nguyên.
11. **Màu nối chuỗi alpha** kiểu `c + '24'` không chạy được với `var(--x)`. Dùng
    `color-mix(in srgb, var(--x) 14%, transparent)`. SVG dùng màu token thì đặt qua `style={{ fill, stroke }}`.

---

## 3. Design tokens

### 3.1 Bảng token: giữ tên cũ, đổi giá trị

Sửa ở đầu `src/styles/body.css` (`:root` = sáng, `[data-theme="dark"]` = tối). Giữ nguyên tên để các màn tự đổi
theo. Tên `--body-blue*` giữ nguyên nhưng giá trị thành **xanh ngọc** (`a2` của mockup).

| Token | Sáng · Bình minh | Tối · Ngân hà | Vai trò (mockup) |
|---|---|---|---|
| `--body-bg` | `#F5F3FF` | `#080D24` | `bg0` |
| `--body-shell-bg` | `rgba(90,85,224,.06)` | `rgba(255,255,255,.05)` | `chip` (nền chip, ô nhỏ) |
| `--body-card-bg` | `rgba(255,255,255,.62)` | `rgba(255,255,255,.035)` | `panel` (kính) |
| `--body-card-border` | `rgba(90,85,224,.13)` | `rgba(255,255,255,.08)` | `bd` |
| `--body-border-subtle` | `rgba(90,85,224,.11)` | `rgba(255,255,255,.08)` | `line` |
| `--body-text-main` | `#1D1A3D` | `#EEF1FF` | `ink` |
| `--body-text-sub` | `#4F4B74` | `#A6AECB` | `ink2` |
| `--body-text-muted` | `#8683A6` | `#6A7291` | `ink3` |
| `--body-accent` | `#5A55E0` | `#8F96FF` | `acc` |
| `--body-accent-hover` | `#4A45C8` | `#A5ABFF` | |
| `--body-accent-soft` | `rgba(90,85,224,.10)` | `rgba(143,150,255,.16)` | |
| `--body-accent-border` | `rgba(90,85,224,.42)` | `rgba(143,150,255,.42)` | |
| `--body-accent-tint` | `rgba(90,85,224,.05)` | `rgba(143,150,255,.08)` | |
| `--body-green` / `-text` | `#0E9170` / `#0E7F62` | `#5EF2C2` / `#5EF2C2` | `good` |
| `--body-green-soft` / `-border` | `rgba(14,145,112,.10)` / `rgba(14,145,112,.30)` | `rgba(94,242,194,.14)` / `rgba(94,242,194,.35)` | |
| `--body-amber` / `-text` | `#C27C00` / `#A86B00` | `#FFC857` / `#FFC857` | `a3` (sao, kỷ lục) |
| `--body-amber-soft` | `rgba(194,124,0,.10)` | `rgba(255,200,87,.12)` | |
| `--body-red` / `-text` | `#DC3B4A` / `#C2303F` | `#FF6B8A` / `#FF8FA6` | `bad` |
| `--body-red-soft` | `rgba(220,59,74,.10)` | `rgba(255,107,138,.14)` | |
| `--body-blue` / `-text` | `#0A8FB3` / `#08799A` | `#4FD8F0` / `#4FD8F0` | `a2` (xanh ngọc) |
| `--body-blue-soft` | `rgba(10,143,179,.10)` | `rgba(79,216,240,.14)` | |
| `--body-dark-card` | = `--body-hero` | = `--body-hero` | thẻ "đen" cũ thành thẻ hero |
| `--body-dark-card-border` | = `--body-card-border` | = `--body-card-border` | |
| `--body-radius-card` | `22px` | `22px` | (cũ 16px) |

### 3.2 Token mới

| Token | Sáng | Tối | Dùng cho |
|---|---|---|---|
| `--body-pink` | `#CF4199` | `#F57FD0` | `a4`: vòng đạm, icon ngày, cơ phụ thứ 3 |
| `--body-pink-soft` | `rgba(207,65,153,.10)` | `rgba(245,127,208,.14)` | |
| `--body-card-raised` | `rgba(255,255,255,.86)` | `rgba(255,255,255,.055)` | `panel2`: hàng bài, ô con trong thẻ |
| `--body-card-solid` | `#FFFFFF` | `#0E1433` | **nền đặc** cho modal, popover, drawer, bottom sheet, dropdown (kính trong suốt sẽ lộ chữ phía sau) |
| `--body-track` | `rgba(90,85,224,.11)` | `rgba(255,255,255,.09)` | rãnh vòng tròn / thanh tiến độ |
| `--body-hero` | `linear-gradient(135deg,rgba(255,255,255,.88),rgba(255,255,255,.55))` | `linear-gradient(135deg,rgba(143,150,255,.13),rgba(79,216,240,.04) 60%,rgba(255,255,255,.02))` | thẻ chính mỗi trang |
| `--body-shadow` | `0 1px 0 rgba(255,255,255,.9) inset, 0 14px 34px -22px rgba(60,50,150,.45)` | `inset 0 1px 0 rgba(255,255,255,.05)` | bóng thẻ kính |
| `--body-blur` | `blur(14px)` | `blur(14px)` | `backdrop-filter` của thẻ (chỉ desktop, xem 3.4) |
| `--body-btn-grad` | `linear-gradient(135deg,#5A55E0 0%,#A35BEA 100%)` | `linear-gradient(135deg,#8F96FF 0%,#5EF2C2 100%)` | nút chính |
| `--body-btn-ink` | `#FFFFFF` | `#050816` | chữ trên nút chính |
| `--body-btn-shadow` | `0 10px 26px -10px rgba(90,85,224,.75)` | `0 10px 30px -10px rgba(143,150,255,.75)` | |
| `--body-btn2-bg` / `-ink` / `-bd` | `rgba(255,255,255,.78)` / `#2A2660` / `rgba(90,85,224,.18)` | `rgba(255,255,255,.05)` / `#E6EAFF` / `rgba(255,255,255,.12)` | nút phụ |
| `--body-on-bg` / `-fg` / `-bd` / `-sh` | `#5A55E0` / `#FFFFFF` / `#5A55E0` / `0 6px 16px -6px rgba(90,85,224,.6)` | `rgba(143,150,255,.18)` / `#FFFFFF` / `rgba(143,150,255,.55)` / `0 0 20px -6px rgba(143,150,255,.7)` | chip/seg **đang chọn** |
| `--body-off-bg` / `-fg` / `-bd` | `rgba(255,255,255,.62)` / `#4F4B74` / `rgba(90,85,224,.14)` | `rgba(255,255,255,.03)` / `#A6AECB` / `rgba(255,255,255,.08)` | chip/seg **không chọn** |
| `--body-nav-on-bg` / `-fg` / `-bd` / `-sh` | `#FFFFFF` / `#5A55E0` / `rgba(90,85,224,.2)` / `0 8px 20px -10px rgba(90,85,224,.55)` | `rgba(143,150,255,.15)` / `#FFFFFF` / `rgba(143,150,255,.38)` / `0 0 24px -8px rgba(143,150,255,.85)` | tab Body đang mở |
| `--body-row-on-bg` / `-bd` / `-sh` | `#FFFFFF` / `rgba(90,85,224,.42)` / `0 10px 24px -14px rgba(90,85,224,.6)` | `rgba(143,150,255,.12)` / `rgba(143,150,255,.42)` / `0 0 26px -10px rgba(143,150,255,.85)` | hàng/thẻ được chọn trong danh sách |
| `--body-planet` | `radial-gradient(circle at 34% 30%,#FFFFFF 0%,#FFD3EA 28%,#B7A6FF 64%,#7D6CF0 100%)` | `radial-gradient(circle at 34% 30%,#D7D9FF 0%,#8F96FF 26%,#4148B8 58%,#161A4A 100%)` | hành tinh trang trí |
| `--body-planet-sh` | `0 30px 60px -20px rgba(125,108,240,.55), inset -24px -30px 50px rgba(90,70,200,.25)` | `0 0 80px -10px rgba(143,150,255,.6), inset -30px -40px 60px rgba(4,6,20,.6)` | |
| `--body-ring` | `rgba(90,85,224,.3)` | `rgba(200,205,255,.38)` | vành hành tinh, vòng nhịp |
| `--body-tip-bg` / `-bd` | `rgba(194,124,0,.07)` / `rgba(194,124,0,.24)` | `rgba(255,200,87,.07)` / `rgba(255,200,87,.24)` | hộp "Lỗi hay gặp" |
| `--body-stage` | `radial-gradient(50% 45% at 50% 52%,rgba(183,166,255,.42),transparent 72%),rgba(255,255,255,.4)` | `radial-gradient(50% 45% at 50% 52%,rgba(143,150,255,.22),transparent 72%),rgba(255,255,255,.02)` | nền sân khấu hình cơ thể |
| `--body-platform` | `radial-gradient(50% 50% at 50% 50%,rgba(90,85,224,.22),rgba(90,85,224,0) 70%)` | `radial-gradient(50% 50% at 50% 50%,rgba(94,242,194,.32),rgba(94,242,194,0) 70%)` | bệ sáng dưới hình cơ thể |
| `--body-overlay` | `rgba(245,243,255,.93)` | `rgba(4,6,16,.84)` | nền màn tập |
| `--body-title-font` | `'Space Grotesk', var(--body-font)` | (giống) | tiêu đề, số lớn |

Font Space Grotesk 500/600/700 đã nạp sẵn trong `index.html`, không thêm gì.

### 3.3 Chữ

| Vai | Font |
|---|---|
| Nhãn eyebrow (`BODY · 01 / 07`, `KỶ LỤC CÁ NHÂN`, tiêu đề cột bảng) | `500 11px/1 var(--body-mono)`, `letter-spacing: .14–.18em`, màu muted, chữ HOA |
| Tiêu đề trang (header) | `600 32px/1 var(--body-title-font)`, `letter-spacing: -.02em` |
| Tiêu đề hero | `600 40–48px/1.02 var(--body-title-font)`, `letter-spacing: -.03em` |
| Tiêu đề thẻ | `600 16–17px/1 var(--body-title-font)` |
| Số chỉ số lớn | `600 19–24px/1 var(--body-title-font)`; đơn vị theo sau `500 12px var(--body-font)` màu muted |
| Số kỹ thuật (rep, ngày, %) | `600 11.5–13px/1 var(--body-mono)` |
| Chữ thường | `400–500 12–14px var(--body-font)` |

### 3.4 Thẻ, nút, chip (class dùng chung, viết trong `body.css`)

- **`.body-card`** (đã có, đổi): `background: var(--body-card-bg); border: 1px solid var(--body-card-border);
  border-radius: var(--body-radius-card); box-shadow: var(--body-shadow);`. Desktop (`min-width: 841px`) thêm
  `backdrop-filter: var(--body-blur)`. Mobile không blur (đỡ nặng máy), thay bằng nền đặc hơn: sáng
  `rgba(255,255,255,.82)`, tối `rgba(12,18,44,.78)`.
- **`.body-hero`** (mới): như `.body-card` nhưng `background: var(--body-hero); border-radius: 26px;
  position: relative; overflow: hidden`.
- **`.body-tile`** (mới): ô con trong thẻ, `background: var(--body-card-raised); border: 1px solid
  var(--body-card-border); border-radius: 16px`.
- **Modal / popover / drawer / bottom sheet / dropdown:** mọi class nền đang dùng `var(--body-card-bg)` cho các lớp
  nổi này (`.body-modal-panel`, `.body-modal-box`, `.body-bm-modal`, `.body-lib-modal`, `.body-rt-drawer`,
  `.body-rt-pop`, `.body-ls-sheet`, sheet mobile của Bản đồ cơ / Cơ thể…) chuyển sang **`var(--body-card-solid)`**.
  Tìm bằng `grep -n "var(--body-card-bg)" src/styles/body.css` rồi xét từng chỗ. Backdrop modal giữ như cũ.
- **`.body-btn-primary`**: `background: var(--body-btn-grad); color: var(--body-btn-ink); box-shadow:
  var(--body-btn-shadow); border: 0;`, hover `filter: brightness(1.08)`, active `transform: scale(.97)`. Xoá hai
  rule `[data-theme="dark"] .body-btn-primary` cũ. `.body-btn-accent` dùng chung style này.
- **`.body-btn-secondary`**: `background: var(--body-btn2-bg); color: var(--body-btn2-ink); border-color:
  var(--body-btn2-bd)`. Xoá rule hover hex cũ, hover `filter: brightness(1.06)`.
- Nút cỡ lớn (hero): `height: 46px; padding: 0 22px 0 18px; border-radius: 15px; font: 600 14px`.
  Nút header: `height: 42px; border-radius: 14px; font: 600 13.5px`.
- **Chip / segmented chọn lựa** (lọc, khoảng thời gian, chọn bài, vùng cơ, tab con):
  `height: 32–36px; padding: 0 14px; border-radius: 12px; border: 1px solid var(--body-off-bd);
  background: var(--body-off-bg); color: var(--body-off-fg); font: 500 13px`. Đang chọn (`.is-on` / `.active` /
  `aria-pressed`): dùng bộ `--body-on-*`, `font-weight: 600`.
- **Hàng chọn được trong danh sách** (ngày lộ trình, bài thư viện): thường `background: transparent` (sáng
  `rgba(255,255,255,.35)`), viền trong suốt. Được chọn: bộ `--body-row-on-*`.
- **Pill trạng thái**: `height: 28px; padding: 0 11px; border-radius: 999px; background: var(--body-shell-bg);
  border: 1px solid var(--body-card-border); font: 600 11.5px var(--body-mono)`. Màu chữ theo trạng thái.
- **Vòng tiến độ SVG**: rãnh `stroke: var(--body-track)`, cung `stroke-linecap: round`, `filter:
  drop-shadow(0 0 6px <màu>)`, `transition: stroke-dasharray .5s`.
- **Thanh tiến độ**: cao 6–8px, `background: var(--body-track)`, phần đầy là màu chỉ số + `box-shadow: 0 0 10px
  <màu>` (tối) hoặc gradient nút chính.
- **Cột biểu đồ**: `border-radius: 7px 7px 2px 2px; background: linear-gradient(180deg, <màu> 0%, transparent
  115%); box-shadow: 0 -4px 14px -4px <màu>`.
- Thanh cuộn trong Body: rộng 6px, thumb `rgba(140,140,190,.25)`.

### 3.5 Màu theo ý nghĩa (dùng thống nhất mọi trang)

| Ý nghĩa | Token |
|---|---|
| Buổi A / Đẩy / hôm nay / điểm nhấn | `--body-accent` |
| Buổi B / Chân / nước / mục tiêu | `--body-blue` (xanh ngọc) |
| Đã tập (sao sáng) / kỷ lục / tự do / Kéo / check-in | `--body-amber` |
| Toàn thân / đạm | `--body-pink` |
| Tốt / sẵn sàng / đạt / tăng đúng hướng | `--body-green` |
| Cần nghỉ / xấu / cảnh báo chấn thương | `--body-red` |
| Đang hồi | `--body-amber` |
| Sắp tới / nghỉ | `--body-text-muted` |

Đổi theo bảng này: `DAY_TAG_COLORS` trong `workoutLogic.js` → `{ A: 'var(--body-accent)', B: 'var(--body-blue)' }`;
`DAY_TYPE_COLORS` → `{ 'Chân': 'var(--body-blue)', 'Đẩy': 'var(--body-accent)', 'Kéo': 'var(--body-amber)',
'Toàn thân': 'var(--body-pink)' }`. Grep mọi chỗ dùng hai hằng này và kiểm tra không còn nối chuỗi alpha (nguyên tắc 11).

### 3.6 Bảng đổi hex cũ → token (dùng khi quét)

| Hex cũ (cả biến thể gần giống) | Thay bằng |
|---|---|
| `#6949E8`, `#7C5CFC` | `var(--body-accent)` |
| `#5238C9`, `#4A3AA8` | `var(--body-accent-hover)` hoặc `--body-text-sub` nếu là chữ |
| `#B3A2F0`, `#C4B6F4`, `#B9A8FF`, `#F1EEFD` | `var(--body-accent-border)` / `--body-accent-soft` |
| `#2F8A57`, `#3E9E68`, `#7FD3A2`, `#5CC8A8` | `var(--body-green)` / `--body-green-text` |
| `#B57A12`, `#E0A23C`, `#F59E0B`, `#F0B95A`, `#D97706`, `#E0822C` | `var(--body-amber)` |
| `#C23B22`, `#D2462B`, `#E26A5A` | `var(--body-red)` |
| `#2E9D8F`, `#4C8DE0`, `#4A8FE7`, `#3A82F6` | `var(--body-blue)` |
| `#15161A`, `#16171C`, `#262830` (nền thẻ tối) | `var(--body-hero)` / `--body-card-raised` |
| `#9C9AA8`, `#A9A9B2`, `#D8D6E0` (chữ trên thẻ tối) | `var(--body-text-sub)` |
| `#FFFFFF` / `#FFF` làm màu chữ trên thẻ tối | `var(--body-text-main)` |
| `rgba(105,73,232,…)` | `color-mix(in srgb, var(--body-accent) <n>%, transparent)` |

### 3.7 Keyframes (thêm vào `body.css`, tiền tố `body-` để không đụng file khác)

```css
@keyframes body-floaty { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
@keyframes body-pulse { 0%,100% { transform: scale(1); opacity: .28; } 50% { transform: scale(1.6); opacity: .04; } }
@keyframes body-burst { 0% { transform: translate(-50%,-50%) translate(0,0) scale(1); opacity: 1; }
  100% { transform: translate(-50%,-50%) translate(var(--dx),var(--dy)) scale(.2); opacity: 0; } }
/* spin đã có sẵn trong body.css */
```

Class trang trí dùng animation: `.body-deco-floaty` (7s, hành tinh hero; 5s, sao kỷ lục; 3s, sao màn tập xong),
`.body-deco-orbit` (spin 18s/30s/40s/60s linear), `.body-deco-pulse` (2.4s/3.4s), `.body-burst-dot` (1.2–2.1s).
Tắt tất cả bằng `:root[data-reduce-motion] .body-workspace :is(.body-deco-floaty,.body-deco-orbit,.body-deco-pulse,
.body-burst-dot) { animation: none; }`. Riêng `.body-burst-dot` thì ẩn luôn (`display: none`).

### 3.8 Icon cần thêm vào `AppIcon.jsx`

Thêm khoá (Phosphor đã có sẵn trong `node_modules`, chỉ import thêm, `ChartLineUp` và `SkipForward` đã import):
`planet` (Planet), `rocketLaunch` (RocketLaunch), `starFour` (StarFour), `stack` (Stack), `chartLineUp`
(ChartLineUp), `warningDiamond` (WarningDiamond), `handPointing` (HandPointing), `skipForward` (SkipForward),
`fastForward` (FastForward), `circleDashed` (CircleDashed), `clipboardText` (ClipboardText). Khoá nào đã tồn tại
thì dùng lại, không thêm trùng.

---

## 4. Vỏ module: header + tab (desktop)

File: `src/pages/BodyPage.jsx`, phần đầu `src/styles/body.css`.

### 4.1 Bố cục

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ BODY · 01 / 07                         [☾ Thứ Ba, 13/10/2026 · Tuần 42] [▶ Bắt đầu buổi tập] │  ← hàng 1
│ Tối nay, Minh                                                       [+ Ghi nhanh]*          │
│ [⌂ Tổng quan] [Lộ trình] [Tiến bộ] [Cơ thể] [Dinh dưỡng] [Bản đồ cơ] [Thư viện bài]          │  ← hàng 2
├──────────────────────────────────────────────────────────────────────────────┤
│  nội dung trang (.body-content, cuộn nội bộ)                                   │
└──────────────────────────────────────────────────────────────────────────────┘
* "Ghi nhanh" chỉ ở Tổng quan, giữ như hiện tại.
```

- `.body-header`: bỏ `height: 76px`. `display: flex; flex-direction: column; gap: 16px; padding: 24px 30px 0`.
  Nền trong suốt như cũ.
- Hàng 1 (`.body-header-row`, mới): `display: flex; align-items: flex-end; justify-content: space-between; gap: 20px`.
  - Trái: eyebrow `BODY · {no} / 07` (`no` = vị trí trong `SCREENS`, 2 chữ số) và tiêu đề `.body-header-title`
    (`600 32px/1 var(--body-title-font)`, letter-spacing −.02em, gap 9px). Tổng quan: `{timeGreeting}, {displayName}`.
    Trang khác: `screenLabel`. **Bỏ** phần `.body-header-suffix` "· Sức Khỏe & Thể Hình" và dòng sub "Kế hoạch ·
    Tập luyện…". Ngày đã nằm ở chip ngày.
  - Phải (gap 10px): chip ngày → (Ghi nhanh nếu Tổng quan) → nút trạng thái hôm nay (4.3).
  - Chip ngày `.body-date-chip`: cao 40px, padding 0 14px, radius 13px, nền `--body-card-bg`, viền
    `--body-card-border`, `font: 500 13px`, màu `--body-text-sub`, icon `moonStars` 16px màu `--body-pink`.
    Nội dung `{todayStr viết hoa chữ đầu} · Tuần {isoWeek}`, ví dụ "Thứ ba, 13/10/2026 · Tuần 42".
- Hàng 2: `.body-subnav` (đang có) đổi style.
  - Khung: không viền, không nền, `gap: 6px`, `padding: 0`, cuộn ngang ẩn thanh cuộn (giữ).
  - `.body-subnav-btn`: cao 38px, padding 0 14px, radius 12px, viền 1px trong suốt, nền trong suốt, màu
    `--body-text-muted`, `font: 500 13px`, gap 7px, icon 16px.
  - Hover: màu `--body-text-main`, nền `--body-shell-bg`.
  - `.active`: bộ `--body-nav-on-*`, `font-weight: 600`, icon `weight="fill"` (đã có).
  - `transition: all .2s`.
- Icon tab theo mockup: Tổng quan `houseSimple`, Lộ trình `path`, Tiến bộ `chartLineUp`, Cơ thể `scales`,
  Dinh dưỡng `bowlFood`, Bản đồ cơ `personSimple`, Thư viện bài `books` (sửa mảng `SCREENS`).
- `.body-content`: `padding: 18px 30px 60px`.

### 4.2 Responsive desktop

- `≤ 1360px`: giữ rule cũ thu padding tab (0 10px). Chip ngày bỏ phần " · Tuần N" (bọc bằng `<span
  className="body-date-week">`, ẩn đi).
- `≤ 1280px`: ẩn chip ngày.
- `≤ 1180px`: tab chỉ còn icon, tab đang mở giữ chữ (rule cũ). Nút trạng thái hôm nay chỉ còn icon, có `aria-label`.
- `≤ 840px`: header desktop ẩn, dùng header mobile (mục 6).

### 4.3 Nút trạng thái hôm nay (header, mọi trang, desktop)

Logic dùng hàm thuần mới `getTodayTrainingState` (mục 7.1), gọi trong `BodyPage` với `sessions`,
`routineItems` của `useWorkouts()` đang có.

| `state` | Hiển thị | Bấm |
|---|---|---|
| `resume` | Pill **Buổi dở** (giữ `.body-live-pill` + `liveInfo` hiện tại, đổi style): nền `--body-card-raised`, viền `--body-amber`, chấm amber nhấp nháy (`.body-deco-pulse`), chữ `--body-text-main`; nút con "Tiếp tục" = nút chính nhỏ | `resumeLive` (giữ) |
| `start` | Nút chính header, icon `play` fill, "Bắt đầu buổi tập" | `handleStartSession({ weekday, day: weekday, name: dayName })` (cùng payload với Tổng quan) |
| `done` | Nút chính header, icon `checkCircle` fill, "Đã tập hôm nay", `opacity: .6`, `disabled`, `cursor: default` | — |
| `rest` | Nút **phụ** (btn2), icon `path`, "Mở lộ trình" | `setScreen('routine')` |

Ẩn khi đang ở màn tập (`isSession`). Màn tập không có header.

---

## 5. Thứ tự làm (Đợt 0 + dừng duyệt, rồi Đợt 1 → 11 chạy thẳng)

Mỗi đợt: (a) liệt kê tính năng hiện có của màn (nguyên tắc 1), (b) code, (c) eslint các file đã sửa, (d) đối
chiếu danh sách. Đợt có đụng `src/utils` thì chạy `npm test`. Chi tiết mobile của từng màn ở mục 6.

### Đợt 0: Hình cơ thể 2D (thay mô hình 3D) — xong thì DỪNG cho user duyệt

Mockup đã chép vào `design/body-ngan-ha/` (xong khi lập plan). Đợt này làm **trước** đợt token để dễ hoàn tác: nếu
user không ưng thì chỉ cần `git restore` các file của đợt này và xoá file mới, chưa có gì khác thay đổi. Đợt này chỉ
dùng token **đang có sẵn** (`--body-accent`, `--body-blue`, `--body-amber`, `--body-red`, `--body-green`,
`--body-shell-bg`, `--body-card-border`, `--body-text-main`, `--body-text-muted`, `--body-bg`). Đợt 1 sẽ tự đổi chúng
sang giá trị Ngân hà.

**0.1 Lấy dữ liệu hình**
- Tải gói về scratchpad, chỉ **đọc dữ liệu**, không chạy code trong gói: `npm pack react-body-highlighter@2.0.5`
  rồi giải nén trong một thư mục trống riêng. Kiểm lại file `LICENSE` là MIT.
- Tìm dữ liệu hình mặt trước (anterior) và mặt sau (posterior). Gói vẽ từng cơ bằng `polygon points` trên khung
  khoảng `0 0 100 200`. Đọc đúng `viewBox` trong mã nguồn gói và đúng tên các cơ.
- Chép sang **`src/data/body-muscle-figure.json`** theo dạng:
  ```json
  {
    "source": "react-body-highlighter v2.0.5 (MIT) — https://github.com/GV79/react-body-highlighter",
    "viewBox": "0 0 100 200",
    "front": [{ "id": "chest", "points": ["…", "…"] }, { "id": null, "part": "head", "points": ["…"] }],
    "back":  [{ "id": "traps", "points": ["…"] }]
  }
  ```
  `id` là **mã nhóm cơ của app**, `null` cho phần không thuộc 14 nhóm (đầu, cổ, gối, cơ khép/dạng đùi…), các phần
  này vẽ như thân nền. Một nhóm có thể gồm nhiều polygon (trái/phải).
- Bảng ghép tên (kiểm lại tên thật trong gói trước khi ghép):

  | Mã app | Tên trong gói | Mặt |
  |---|---|---|
  | `chest` | `chest` | trước |
  | `shoulders` | `front-deltoids` (trước), `back-deltoids` (sau) | cả hai |
  | `biceps` | `biceps` | trước |
  | `triceps` | `triceps` | sau (và trước nếu gói có) |
  | `forearms` | `forearm` | cả hai |
  | `abs` | `abs` | trước |
  | `obliques` | `obliques` | trước |
  | `traps` | `trapezius` | cả hai |
  | `lats` | `upper-back` | sau |
  | `lowerback` | `lower-back` | sau |
  | `glutes` | `gluteal` | sau |
  | `quads` | `quadriceps` | trước |
  | `hamstrings` | `hamstring` | sau |
  | `calves` | `calves` (+ `left-soleus`, `right-soleus` nếu có) | cả hai |

  Danh sách 14 mã phải khớp `src/data/body-muscles.json` (test `bodyContract` kiểm có đúng 14 nhóm).
- Ghi nguồn + giấy phép vào CHANGELOG (RULES §16.5). Xoá thư mục giải nén sau khi chép xong.

**0.2 Viết lại `src/components/body/MuscleAnatomy2D.jsx`** (giữ tên file, thay toàn bộ ruột)
```
MuscleAnatomy2D({
  side = 'both',          // 'front' | 'back' | 'both' (hai mặt cạnh nhau, gap 8%)
  fills = {},             // { [muscleId]: cssColor } — nhóm không có trong fills vẽ như thân nền
  glow = {},              // { [muscleId]: true } — nhóm phát sáng
  selected = null,        // muscleId đang chọn
  onSelect,               // (id) => void; không truyền = chỉ hiển thị
  labelOf,                // (id) => 'Ngực · Sẵn sàng' cho tooltip/aria; mặc định tên VN từ body-muscles.json
  height = 260,
  className
})
```
- Một `<svg viewBox>` mỗi mặt, `height` theo prop, bề rộng tự theo tỉ lệ.
- **Thân nền** (polygon `id: null` + nhóm không có trong `fills`): `fill: var(--body-shell-bg)`, `stroke:
  var(--body-card-border)`, `stroke-width: .4`, `stroke-linejoin: round`.
- **Nhóm có màu**: `fill: <màu>`, `fill-opacity: .9`, `stroke: <màu>`, `stroke-width: .5`. Nhóm `glow` thêm
  `filter: drop-shadow(0 0 3px <màu>)` (CSS trên `<g>`). `transition: fill .3s, filter .3s`.
- **Đang chọn**: `stroke: var(--body-text-main)`, `stroke-width: 1`, `fill-opacity: 1`, glow mạnh hơn (6px).
- **Hover** (khi có `onSelect`): `filter: brightness(1.15)` và tooltip nhỏ theo con trỏ (`labelOf(id)`): nền
  `--body-card-solid` (Đợt 1 mới có, Đợt 0 tạm dùng `--body-bg`), viền `--body-card-border`, radius 8px,
  `font: 600 12px`. Giữ hành vi tooltip của canvas cũ.
- **Truy cập**: mỗi nhóm bấm được là `<g role="button" tabIndex={0} aria-label={labelOf(id)} aria-pressed={selected
  === id}>`, Enter/Space gọi `onSelect`. Focus hiện viền `--body-accent`. Không có `onSelect` thì
  `aria-hidden="true"` cho cả hình và đặt `role="img"` + `aria-label` mô tả trên khung ngoài.
- Nhãn mặt dưới mỗi hình khi `side = 'both'`: `TRƯỚC` / `SAU` (mono 10px .14em muted).
- Đổi mặt khi `side` đổi giữa front/back: chuyển cảnh `opacity` + `transform: scaleX(.92 → 1)` .3s, tắt khi Giảm
  chuyển động.
- CSS đặt trong `body.css`, class tiền tố `body-fig-*`. Không style inline ngoài màu theo dữ liệu.

**0.3 Hàm tô màu thuần** `muscleFigureFills({ mode, selected, secondary, heatMap, recoveryMap })` →
`src/utils/workoutLogic.js`, trả `{ fills, glow }`. Giá trị màu là chuỗi `var(--body-…)`:
- `mode: 'group'` (chọn nhóm / chi tiết bài): `selected` = `var(--body-accent)` + glow; từng `secondary` =
  `var(--body-blue)`, không glow; còn lại không tô.
- `mode: 'heat'` (mức tập 7 ngày, `heatMap` 0…1): `0` không tô; `(0, .35]` = `--body-blue`; `(.35, .7]` =
  `--body-amber`; `> .7` = `--body-red` + glow. Ngưỡng giữ đúng ý thang 4 màu `HEAT_PALETTE` cũ.
- `mode: 'rec'` (`recoveryMap` id → `ready | mid | low`): ready `--body-green`, mid `--body-amber`, low
  `--body-red` + glow. Nhóm thiếu trong map coi là `ready` (giống code cũ).
- Test trong `src/__tests__/body/workoutLogic.test.js`: đủ 3 mode, ngưỡng heat ở 0 / .35 / .36 / .7 / .71,
  thiếu id trong recoveryMap → ready, `selected` không nằm trong `secondary`.

**0.4 Thay vào các chỗ dùng**
- `MuscleMapScreen.jsx`: bỏ `lazy(() => import('./MuscleBodyCanvas'))` + `Suspense`, dùng `MuscleAnatomy2D` ở giữa
  atlas: desktop `side="both"`, cao `min(68vh, 620px)`. Mobile (≤ 840px) `side={sideView}` (một mặt), nút **Lật mặt**
  giữ để đổi mặt. Desktop đã thấy cả hai mặt nên nút Lật mặt ẩn trên desktop. Chế độ Nhóm cơ / Mức tập / Phục hồi
  đổi `mode` truyền vào `muscleFigureFills`. Bấm nhóm cơ = `handlePickMuscle(id, true)` (giữ). Bỏ hàm tô màu riêng
  ở dòng ~331 (đã có `muscleFigureFills`).
- `OverviewScreen.jsx` thẻ Phục hồi cơ: thay canvas bằng `MuscleAnatomy2D side="both" height={190}` chế độ `rec`,
  **không** `onSelect` (cả thẻ đã bấm sang Bản đồ cơ). Bỏ điều kiện `!isMobileLayout`: mobile cũng hiện hình (cao
  140). Nếu `isMobileLayout` không còn ai dùng thì xoá state + effect của nó.
- `ExerciseDetailModal.jsx`: đổi sang props mới (`mode: 'group'`, `selected = primary`, `secondary`), `side="both"`,
  `height={240}`, không `onSelect` trừ khi modal đang cho bấm cơ (giữ đúng hành vi cũ).
- Grep mọi chỗ còn lại dùng `MuscleAnatomy2D` / `MuscleBodyCanvas` để đổi hết.

**0.5 Dọn bản cũ** (RULES §15.7, "thay xong thì xoá")
- Xoá `src/components/body/MuscleBodyCanvas.jsx`.
- `npm uninstall three` (chỉ canvas dùng three, đã grep 2026-11-09). Kiểm `package.json` và `package-lock.json` sạch
  `three`. Grep `vite.config.js` xem có `manualChunks` / alias nào nhắc `three` thì bỏ.
- Xoá CSS chỉ phục vụ canvas (`.body-2a-muscle-canvas-box` và class canvas/tooltip/loading cũ trong `body.css`),
  grep chắc không còn ai dùng.
- `design/body-ngan-ha/muscle-body.js` là mockup gốc, giữ nguyên làm tư liệu.

**0.6 Điểm dừng**
- Chạy `npm test` + eslint các file đã sửa.
- Báo user mở **Body → Bản đồ cơ** (bấm vài nhóm cơ, đổi 3 chế độ, thu cửa sổ < 840px thử lật mặt), **Tổng quan →
  thẻ Phục hồi cơ**, **Thư viện → chi tiết một bài** (hình cơ chính/phụ). Giao diện lúc này còn màu cũ, chỉ đánh
  giá hình vẽ.
- User ưng → làm tiếp Đợt 1 tới hết, không dừng nữa. User không ưng → hoàn tác Đợt 0, ghi lại lý do, hỏi user hướng
  khác (làm đẹp 3D).

### Đợt 1: Token, thành phần chung, vỏ
Files: `src/styles/body.css`, `src/pages/BodyPage.jsx`, `src/components/AppIcon.jsx`, `src/utils/workoutLogic.js`
(+ test).
1. Thay token theo 3.1, thêm token 3.2 (cả `:root` và `[data-theme="dark"]`).
2. Viết class chung 3.4, keyframes 3.7, rule giảm chuyển động.
3. Đổi nền lớp nổi sang `--body-card-solid` (3.4).
4. Quét **toàn bộ `body.css`** theo bảng 3.6 (≈120 hex, ≈64 rgba). Các rule `[data-theme="dark"] …` chỉ để
   vá màu cũ, sau khi đổi sang token thì không cần nữa → xoá.
5. Thêm icon 3.8.
6. Header + tab + nút trạng thái hôm nay (mục 4). Thêm `getTodayTrainingState` + test (7.1).
7. `DAY_TAG_COLORS` / `DAY_TYPE_COLORS` theo 3.5.
8. Header mobile + chip tab mobile (mục 6.1).
9. Hình cơ thể 2D (`.body-fig-*`): thân nền đổi sang `--body-card-raised`, tooltip sang `--body-card-solid`.

Xong khi: mọi trang đã mang màu Ngân hà (bố cục bên trong chưa đổi), header/tab đúng mục 4, modal không bị trong suốt.

### Đợt 2: Tổng quan (`OverviewScreen.jsx`)
Bố cục desktop: `.body-2a-grid` thành `display: grid; grid-template-columns: minmax(0,1fr) 392px; gap: 18px`.
Trang được phép cao hơn khung nhìn (`.body-content` cuộn). `≤ 1280px`: cột phải thành 340px. `≤ 1100px`: một cột.

**Cột trái**
1. **Hero buổi hôm nay** (thay `.body-2a-dark-card`, class `.body-hero`, padding 28px 30px, gap 18px, min-height 402px):
   - Trang trí góc phải trên (`aria-hidden`, khối 330×330 tại `right:-30px; top:-40px`, `.body-deco-floaty` 7s):
     hành tinh `inset: 44px`, `border-radius: 50%`, nền `--body-planet`, bóng `--body-planet-sh`. Vành: hai elip
     530×100 tại `left:-100px; top:120px; rotate(-14deg)`, một cái `border-top: 2px solid var(--body-ring)` nằm
     **sau** hành tinh, một cái `border-bottom: 2.5px solid var(--body-ring)` nằm **trước**. Vệ tinh: khối `inset:6px`
     quay (`.body-deco-orbit` 18s) mang chấm 14px màu `--body-amber`, `box-shadow: 0 0 18px` cùng màu.
   - Hàng pill: pill trạng thái giữ đủ 4 trạng thái hiện có (Đang tập dở = amber, Xong HH:MM = green, Lên lịch hôm
     nay = accent kèm tiền tố `{Buổi A} · HÔM NAY` khi có tag, Nghỉ ngơi = muted) + pill thời lượng `~{estMinutes}
     phút · {n} bài · {n} set` (khi đã xong/đang tập dùng số thật như hiện tại). Khi đã xong thêm pill `Khối lượng
     {n} kg` (đang có ở ô thứ 4, không được mất).
   - Tiêu đề `{sessionStats.title}`: `600 48px/1.02 var(--body-title-font)`, max-width 560px. Dưới là `weekText`
     (`400 14px/1.55`, màu sub).
   - **Danh sách bài hôm nay (mới, lấy từ `todayRoutineItems` đã có):** lưới 2 cột (max-width 640px, gap 10px), mỗi
     ô `.body-tile` (padding 11px 14px, radius 16px): số thứ tự `01` (mono 13px, `--body-blue`) · tên tiếng Việt
     (600 13.5px, ellipsis) + tên tiếng Anh (11.5px muted) từ `splitExerciseName` · bên phải `{sets} × {target}
     {rep|giây}` (mono 12px). Tối đa 4 ô, dư thì ô thứ 4 ghi "+{n} bài nữa". Nghỉ/không có lịch thì không vẽ lưới.
   - Hàng nút (margin-top auto): giữ đúng nút theo trạng thái hiện có (Tiếp tục buổi tập / Xem buổi tập / Bắt đầu
     tập hôm nay / Xem lộ trình tập), nút chính dùng style hero, icon `rocketLaunch` cho "Bắt đầu". Thêm nút phụ
     "Xem lộ trình tuần" (icon `path`) → `onNavigateTab('routine')`, trừ khi nút chính đã là "Xem lộ trình tập".
2. **Chòm sao tuần này** (thay thẻ "Tuần này", `.body-card`, padding 22px 24px 18px, flex 1, min-height 300px):
   - Đầu thẻ: trái "Chòm sao tuần này" (600 17px title font) + `{weekData.dateRange} · mỗi buổi tập thắp một ngôi
     sao` (12.5px muted). Phải `{số buổi đã tập} / {số buổi theo lịch} SAO` (mono 12.5px, amber).
   - Hàng 3 chỉ số của `weekData.stats` (Buổi / Set / Thời gian) giữ nguyên, dạng nhỏ (số 600 16px title font,
     nhãn 11.5px muted), ngay dưới đầu thẻ.
   - Vùng sao: SVG `viewBox="0 0 834 190"` `width="100%"`, `preserveAspectRatio="xMidYMid meet"`,
     `overflow: visible`. Toạ độ và kiểu do `buildWeekConstellation` (7.2) trả về. Vẽ đoạn nối trước, sao sau.
     Mỗi sao có quầng (`r = halo`, `opacity = hop`; hôm nay thêm `.body-deco-pulse`, `transform-box: fill-box;
     transform-origin: center`) và lõi (`r`, `fill`, `stroke` 2px, `filter: drop-shadow(0 0 8–10px màu)`).
   - Nhãn dưới mỗi sao là HTML định vị tuyệt đối `left: {x/834*100}%`, `top: {ly}px` (tỉ lệ theo chiều cao thật),
     `translateX(-50%)`, rộng 116px: dòng 1 `{T2} · {12}` (mono 11.5px, màu `sc`), dòng 2 tên buổi (500 11.5px,
     `text-wrap: balance`, màu `fc`), dòng 3 **(giữ thông tin cột set cũ)** `{n} set` cho ngày đã tập (mono 10.5px muted).
   - Chú thích dưới: ● amber "Đã tập", ● accent "Hôm nay", ○ viền muted "Sắp tới".
   - Nguồn dữ liệu: cùng nguồn `weekData` đang dùng (ngày trong tuần + buổi đã tập + bài theo weekday). Không viết query mới.

**Cột phải** (gap 18px, theo thứ tự)
3. **Quỹ đạo hôm nay** (thay thẻ "Dinh dưỡng", `.body-card`, padding 20px 22px, gap 14px):
   - Đầu thẻ: "Quỹ đạo hôm nay" + link "Dinh dưỡng" (12px accent) → `onNavigateTab('nutrition')` (thay "Xem thực đơn").
   - Trái: SVG 176×176 xoay −90°, ba vòng đồng tâm stroke 11: r80 = kcal (`--body-accent`), r62 = đạm
     (`--body-pink`), r44 = tinh bột (`--body-blue`). Rãnh `--body-track`. Giữa là icon `sparkle` fill 20px amber.
     Phần trăm lấy từ `nutritionData` (kcal / goal, các macro). Không có mục tiêu thì cung = 0.
   - Phải: danh sách dọc gap 14px, mỗi dòng: chấm màu + nhãn (12px muted), dưới là số (600 19px title font) +
     `/ mục tiêu đơn vị` (12px muted). Dòng: Năng lượng (kcal), rồi **mọi macro** trong `nutritionData.macros`
     (đạm, tinh bột, chất béo, giữ đủ). Macro không có vòng thì chỉ có chấm màu `--body-amber`.
   - Dưới cùng: `{nutritionData.note}` (12px sub) + "{mealsCount} bữa đã ghi" (muted). Không mất hai thông tin này.
4. **Hàng 2 thẻ nhỏ** (`grid-template-columns: repeat(2, minmax(0,1fr)); gap: 14px`):
   - **Cân nặng** (`.body-card`, padding 16px, cả thẻ bấm → `onNavigateTab('biometrics')`): "Cân nặng" (12px
     muted) / số `600 24px` + "kg" / dòng mono amber `{diffText} · {time}` / sparkline 150×40 (`spark.line`, stroke
     accent 2px, glow) + chấm cuối r3.5 + đường mục tiêu nét đứt green nếu có / thanh tiến độ tới mục tiêu +
     `startStr` ↔ `remainText` (giữ). Chưa có dữ liệu: giữ nút "+ Ghi cân nặng ngay".
   - **Check-in tuần**: icon `clipboardText` pink + "Check-in tuần" / ngày check-in (600 24px) / "Còn {n} ngày" hoặc
     "Hôm nay" (mono pink) / dòng `Cân sáng CN · Vòng eo · Ảnh (tùy chọn)` (11.5px sub). Giữ đủ 3 mục chuẩn bị.
5. **Phục hồi cơ** (`.body-card`, grid `200px minmax(0,1fr)` như cũ, cột trái là hình 2D hai mặt từ Đợt 0, cả thẻ
   bấm → `onNavigateTab('muscles')`):
   - Phần phải: đầu "Phục hồi cơ" + link "Bản đồ cơ". **Mới**: hàng 3 số (lưới 3 cột) Cần nghỉ (red) / Đang hồi
     (amber) / Sẵn sàng (green), số `600 20px` title font, nhãn 11.5px muted. Giữ danh sách chip tên cơ theo nhóm
     (`recGroups`). Dòng cuối "Tránh {các cơ cần nghỉ} hôm nay." (12px sub), chỉ hiện khi có cơ cần nghỉ.
   - Màu nhóm trong `recGroups` đổi hex → token (red / amber / green).
6. **Ngày mai** (giữ thẻ, `.body-card`): giữ nội dung, đổi style, tiêu đề 17px title font.

**Modal Ghi nhanh:** giữ nguyên chức năng, nền `--body-card-solid`, tab con dùng chip 3.4, nút lưu = nút chính.

### Đợt 3: Lộ trình (`RoutineScreen.jsx`, class `body-rt-*`)
Desktop: khung chính `display: grid; grid-template-columns: 372px minmax(0,1fr); gap: 18px`. `≤ 1180px`: cột trái 320px.

1. **Cột trái: lịch tuần** (`.body-card`, radius 26px, padding 22px 18px, gap 16px):
   - Đầu: dòng 1 "Tuần {current} / {total}" (600 18px title font) + phạm vi ngày (mono 12px muted). Giữ nút tuần
     trước/sau, "Sửa lộ trình", đổi lộ trình đặt cùng dòng, nút icon nhỏ 30px. Dòng 2 thanh tiến độ cao 6px
     (`--body-btn-grad`). Dòng 3 "{n} / {m} buổi đã xong" (12px muted).
   - Danh sách 7 ngày, gap 6px. Đường đứt dọc trang trí `left: 34px; top: 24px; bottom: 24px; border-left: 1.5px
     dashed var(--body-border-subtle)`.
   - Mỗi ngày (hàng chọn được 3.4, padding 9px 12px, radius 17px): vòng 44px viền 2px màu buổi (3.5), nền
     `color-mix` 14%, số ngày `600 15px` title font · cột giữa: tiêu đề buổi (600 14px, ellipsis) + `{T2} · {Buổi A
     / Nghỉ / Check-in}  {~N phút}` (12px muted) · phải: icon + nhãn trạng thái (600 11.5px): Đã tập
     `checkCircle` green / Hôm nay `lightning` accent / Check-in `clipboardText` amber / Nghỉ `coffee` muted /
     Sắp tới `circleDashed` muted. Giữ mọi badge/trạng thái hiện có (ví dụ buổi dở).
2. **Cột phải, khung trên: chi tiết ngày** (`.body-hero`, padding 26px 28px, gap 20px, flex 1):
   - Trang trí `aria-hidden`: vòng đứt 280px tại `right:-70px; top:-70px`, viền 1.5px dashed màu buổi, opacity .5,
     `.body-deco-orbit` 40s, mang chấm 16px ở đáy. Quả cầu 90px tại `right:30px; top:30px` `radial-gradient(circle at
     35% 30%, #FFFFFF 0%, <màu buổi> 45%, transparent 75%)` opacity .55.
   - Đầu: pill loại buổi (nền màu buổi 14%, viền màu buổi) · `{Thứ Hai} · {12/10}` mono muted · trạng thái. Tiêu đề
     `600 40px/1.05` title font max-width 600px. Hàng meta: `timer` phút · `barbell` bài · `stack` set (icon xanh ngọc).
   - **Hàng bài** (`.body-tile`, radius 18px, padding 14px 18px), lưới `44px minmax(0,1fr) auto auto`, gap 16px:
     số thứ tự `600 22px` màu buổi · tên + `{en} · {nhóm cơ}` · **cụm điều chỉnh giữ nguyên** (−/+ hiệp, −/+ mục
     tiêu, −/+ nghỉ, đơn vị, tăng tiến tự động, kéo thả sắp xếp, xoá) dựng lại thành nút tròn 30px nền
     `--body-shell-bg` · bên phải `{sets} × {target}` mono 14px. Mockup có dãy chấm set (22px viền màu buổi): đặt
     dưới tên bài ở hàng thứ hai.
   - Nút "Bắt đầu buổi này" (nút chính hero, icon `rocketLaunch`) giữ đúng điều kiện hiện có. Khối buổi đang dở
     (`body-rt-ongoing`) giữ. Nút "Thêm bài" giữ.
   - Ngày nghỉ / check-in (`body-rt-empty`): căn giữa, vòng 84px (nền 14% + viền 1.5px màu) icon 36px, tiêu đề
     600 20px, meta 14px sub. Giữ mọi nút đang có ở trạng thái này.
3. **Cột phải, hàng dưới: Lộ trình của tôi + mẫu** (`grid-template-columns: repeat(auto-fill, minmax(180px,1fr));
   gap: 12px`):
   - Thẻ lộ trình (`.body-card`, radius 20px, padding 14px 15px): eyebrow mono 11px (Đang dùng = accent + `play`
     fill; khác = muted + `checkCircle`) · tên (600 13.5px) · meta (11.5px muted). Bấm = hành vi đổi lộ trình hiện có.
   - Thẻ mẫu: viền **dashed**, nền trong suốt, hover nền `--body-accent-tint`, eyebrow `MẪU · {cấp}` xanh ngọc +
     `plusCircle`. Bấm → mở modal tuỳ chỉnh mẫu hiện có.
   - Không bỏ "Tạo lộ trình mới tự do". Thêm một thẻ dashed "Tạo lộ trình mới" ở cuối hàng nếu nút này đang nằm chỗ khác.
4. Banner xem trước, drawer Thêm bài, popover đổi lộ trình, modal tạo/sửa, modal tổng kết chu kỳ: giữ hết, đổi nền
   `--body-card-solid`, chip/seg/nút theo 3.4.

### Đợt 4: Tiến bộ (`WorkoutHistoryScreen.jsx`, class `body-pg-*`)
Desktop: `grid-template-columns: minmax(0,1fr) 336px; gap: 18px`. `≤ 1180px`: cột phải 300px.

1. **Hàng chip chọn bài**: chip 3.4 (cao 36px), **một hàng cuộn ngang** (không xuống dòng) để chứa mọi bài đã tập.
   Chip đang chọn tự cuộn vào giữa (`scrollIntoView({ inline: 'center', block: 'nearest' })`).
2. **Thẻ chính** (`.body-card`, radius 26px, padding 22px 24px, gap 16px):
   - Đầu: tên tiếng Việt (600 24px title font) + `{tên EN} · set tốt nhất mỗi buổi` (mono 12px muted). Phải: 4 chỉ
     số (gap 26px, nhãn 11.5px muted, số `600 22px` title font): Cao nhất (amber) · Mục tiêu (xanh ngọc, kèm `×
     {số hiệp}`) · Số buổi · So với buổi đầu (green nếu ≥ 0, red nếu âm). Lấy từ dữ liệu biểu đồ hiện có.
   - Biểu đồ (giữ SVG hiện tại và dữ liệu, đổi giao diện): trục y trái 34px (mono 10.5px: đỉnh / giữa / 0); lưới
     dashed `--body-border-subtle`; **đường mục tiêu** dashed 1.5px xanh ngọc kèm nhãn số (khung 36×18 radius 6
     nền xanh ngọc chữ `--body-btn-ink`) ở mép trái; mỗi buổi một nhóm cột, mỗi set một cột rộng 13px (kiểu cột 3.4,
     màu accent; nhóm có kỷ lục màu amber; set chưa đạt mục tiêu opacity .5); trên nhóm: số tốt nhất (mono 11px) +
     `starFour` fill amber nếu là nhóm kỷ lục; nhãn ngày dưới trục (mono 10.5px). `transition: height .45s
     cubic-bezier(.2,.8,.2,1)`. Giữ mọi tương tác biểu đồ đang có (tooltip, chọn buổi…).
   - Bảng buổi gần nhất: tiêu đề cột `NGÀY · CÁC SET · TỐT NHẤT · SO TRƯỚC · ĐÁNH GIÁ` (mono 10.5px, letter-spacing
     .1em, muted), lưới `70px minmax(0,1fr) 80px 70px 140px`. Ô set là pill nhỏ (min-width 32, cao 22, radius 7):
     đạt mục tiêu nền green 13% chữ green, chưa đạt nền `--body-shell-bg` chữ sub. "So trước" `+n` green / `−n` red
     / `±0` muted. Đánh giá: `trophy` amber "Kỷ lục mới" / `checkCircle` green "Đạt mục tiêu" / `circle` muted "Chưa
     đạt" / "Buổi đầu". Số dòng giữ như hiện tại, nếu hiện tại không giới hạn thì hiện 4 dòng mới nhất + nút "Xem
     tất cả". Không làm mất dòng nào.
3. **Cột phải**:
   - **Lịch tháng** (`.body-card`, padding 20px): tiêu đề `Tháng {m} · {yyyy}` (600 16px) + nút tháng trước/sau (giữ).
     Lưới 7 cột gap 4px, hàng thứ (mono 10.5px). Ô cao 38px, radius 11px, viền 1.5px: số (500 12.5px title font) +
     chấm 5px có glow. Đã tập: nền màu buổi 15%, chấm màu buổi. Có lịch chưa tập: viền màu buổi 40%. Hôm nay: viền
     accent. Ngày tương lai chữ muted. Chú thích: Buổi A · Buổi B · Tự do. **Bấm ngày vẫn mở chi tiết ngày
     (`body-pg-dayc-*`) như hiện tại**, khối chi tiết đặt ngay dưới lịch.
   - **Kỷ lục cá nhân** (`.body-hero`, padding 20px, flex 1): `starFour` 64px amber góc phải trên (`.body-deco-floaty`
     5s, glow) · eyebrow `KỶ LỤC CÁ NHÂN` · số `600 54px` title font + đơn vị 18px muted · "Đạt ngày {d}. Mục tiêu
     hiện tại {target}." · cuối: "Kỷ lục so với mục tiêu" + % (mono amber) + thanh 8px amber glow.
4. Mobile: mục 6.

### Đợt 5: Cơ thể (`BiometricsScreen.jsx`, class `body-bm-*`)
Giữ 3 tab **Phân tích / Lịch sử / Hồ sơ** và nút **Thêm cân đo**. Thanh trên: seg tab (chip 3.4) bên trái, trạng
thái lần đo + nút chính "Thêm cân đo" (icon `plus`) bên phải.

**Tab Phân tích** desktop: `grid-template-columns: 376px minmax(0,1fr); gap: 18px`. `≤ 1180px`: cột trái 330px.
1. **Lần đo gần nhất** (`.body-card`, padding 20px 22px, gap 12px): đầu "Lần đo gần nhất" + thời điểm (mono 11.5px).
   - **Đồng hồ BMI** nửa vòng (khối 300×176 căn giữa, SVG `viewBox 0 0 300 176`): tâm (150,158), bán kính 124, thang
     15→32. Rãnh `stroke-width: 22` `--body-track`. 4 cung `stroke-width: 12` có glow, khe 0.014 rad giữa các cung:
     15–18,5 xanh ngọc, 18,5–23 green, 23–25 amber, 25–32 red (chuẩn Á Đông). Kim là vòng tròn r11 tại vị trí BMI,
     nền `--body-bg`, viền 4px màu cung của BMI. Vạch số `18,5 / 23 / 25` cách cung 22px, `15` và `32` ở hai đầu dưới
     (mono 10px muted). Giữa: cân nặng `600 46px` title font + "kg", dưới "Cân nặng". Góc tính bằng
     `bmiGaugeAngle` (đã có trong `bodyMetrics.js`). Hình học cung theo hàm `gauge()` trong `design/body-ngan-ha/body-kit.js`.
   - Pill `BMI {x} · {nhãn}` (viền + chữ theo màu nhóm) + pill "Chuẩn Á Đông". Nhãn BMI lấy từ logic hiện có.
   - Chú thích 4 cột (đường kẻ trên): Thiếu cân `<18,5` · Bình thường `18,5–22,9` · Thừa cân `23–24,9` · Béo phì `≥25`.
   - Chưa có cân nặng / chiều cao: giữ empty state hiện tại.
2. **Thành phần cơ thể** (`.body-card`, flex 1): donut 150px (`viewBox 0 0 180 180`, r74, stroke 20, glow, mỗi đoạn
   trừ 3px làm khe). Giữa: cân nặng (600 22px) + "kg tổng". Phải: mỗi phần gồm ô vuông màu 8px radius 3 + tên
   (12px sub) / `{kg} · {%}` (mono 13px). Màu: Nước = xanh ngọc, Đạm & khác = amber, Mỡ = red, Khoáng xương =
   green. Dữ liệu từ khối "THÀNH PHẦN CƠ THỂ" hiện có (chỉ hiện khi đã đo mỡ). Giữ empty state.
3. **Xu hướng** (`.body-card`, padding 20px 24px 16px): đầu "Xu hướng" + `{khoảng} · trung bình ngày` + seg khoảng
   thời gian (giữ). 3 ô chỉ số (lưới 3 cột, chọn được): Cân nặng (accent) / Tỷ lệ mỡ (amber) / Cơ xương (green):
   chấm glow + nhãn, số `600 21px` + đơn vị, chênh lệch mono (green nếu đúng hướng, red nếu ngược). Đang chọn: viền
   1.5px + bộ `--body-row-on-*`. Biểu đồ (giữ SVG + dữ liệu, cao 214px): lưới dashed `3 5`, vùng tô gradient màu chỉ
   số 32% → 0, đường 2.5px glow, chấm điểm r3.2 (điểm cuối r5.5) nền `--body-bg`, nhãn số bên phải + ngày dưới (mono
   10.5px), pill giá trị cuối (nền màu chỉ số, chữ `--body-btn-ink`). Chân thẻ khi xem cân nặng: `flagPennant`
   green + "Mục tiêu {x} kg · còn {y} nữa. {Kỳ này tăng/giảm…}" (giữ logic mục tiêu đang có).
4. **Lưới chỉ số** (`grid-template-columns: repeat(3, minmax(0,1fr)); gap: 14px`): mỗi thẻ (`.body-card`, radius
   20px, padding 14px 16px): tên + nguồn (`Đã đo` green / `Công thức` accent, mono 10px) · số `600 24px` + đơn vị ·
   chênh lệch mono · thước 3 đoạn cao 4px (thấp xanh ngọc .6 / chuẩn green .8 / cao amber .6) + chấm vị trí 10px
   (nền `--body-bg`, viền 2.5px `--body-text-main`). Chỉ số không có thang thì ẩn thước (opacity 0, giữ chiều cao) ·
   trạng thái (600 11.5px green, chỉ số trung tính màu sub) + khoảng chuẩn (mono 10.5px muted). Giữ đủ mọi chỉ số
   đang tính (Tỷ lệ mỡ, Cơ xương, Mỡ nội tạng, Tỷ lệ nước, Trao đổi chất, Khối không mỡ, và các chỉ số khác nếu có).
5. **Khung chi tiết lần đo (`.body-bm-insp`)**: giữ hành vi hiện tại. Nếu đang chiếm cột cố định trên desktop, dựng
   thành ngăn trượt phải (`--body-card-solid`, rộng 380px) mở khi bấm thẻ "Lần đo gần nhất" hoặc một điểm trên biểu
   đồ, đóng bằng nút X / Esc / bấm nền.

**Tab Lịch sử, Hồ sơ, modal Thêm cân đo:** giữ cấu trúc, đổi style (thẻ kính, seg, nút, ô nhập: nền
`--body-card-raised`, viền `--body-card-border`, focus viền accent).

### Đợt 6: (dành chỗ) Kiểm lại Đợt 1–5
Quét lại `body.css` và các file đã sửa: còn hex nào ngoài ngoại lệ (nguyên tắc 3) không, còn rule
`[data-theme="dark"]` vá màu nào thừa không, chạy eslint toàn module Body.

### Đợt 7: Dinh dưỡng (`NutritionScreen.jsx`, `useNutrition.js`, `bodyMetrics.js` + test)
Giữ thanh trên: tiêu đề, dải chọn ngày, tab **Nhật ký / Check-in tuần**, chuyển sang style 3.4.

**Tab Nhật ký** desktop: `grid-template-columns: 320px minmax(0,1fr) 300px; gap: 18px`. `≤ 1280px`: hai cột (`300px
minmax(0,1fr)`), cột phải xuống dưới thành hàng 2 cột.
1. **Năng lượng {ngày}** (`.body-card`, padding 22px): đầu tên thẻ + % mục tiêu (mono). Vòng 240px: rãnh r110 stroke
   14, cung kcal accent glow, vòng chấm mảnh r90 (`stroke-dasharray: 2 6`, `--body-border-subtle`), vệ tinh chấm 10px
   amber quay 30s (`inset: 18px`). Giữa: kcal `600 44px` title font, "/ {mục tiêu} kcal", pill green "Còn {n} kcal"
   (vượt thì pill amber "Vượt {n} kcal"). Dưới (margin-top auto): thanh macro (Đạm accent / Tinh bột xanh ngọc / Chất
   béo amber), mỗi thanh: chấm + tên, `{v} g / {t} g` mono, thanh 8px glow.
2. **Bữa ăn** (`.body-card`, cuộn nội bộ): đầu "Bữa ăn {hôm nay|ngày}" + nút chính nhỏ "Thêm món" (mở modal hiện có).
   Mỗi bữa là accordion `.body-tile` radius 18px: icon tròn 42px (nền `--body-shell-bg`, icon amber: sáng
   `coffee`, trưa `bowlFood`, tối `fish` nếu có trong AppIcon (không có thì `bowlFood`), phụ `cookie`/`sparkle`) ·
   tên bữa (600 14.5px) + `{giờ} · {n} món` · thanh 120×6 (kcal bữa / mục tiêu) · kcal (mono 13px, rộng 70px phải) ·
   caret. Mở ra: các món lưới `minmax(0,1fr) 80px 150px 60px`: tên · lượng · `Đ {p} · B {c} · M {f}` mono ·
   kcal. **Giữ nút sửa/xoá món** đang có (đặt cuối dòng). Bữa đầu tiên có món thì mở sẵn.
3. **Cột phải**:
   - **7 ngày qua** (mới): cột kcal 7 ngày gần nhất (gap 10px), cột hôm nay accent, ngày đạt mục tiêu (±10%) green,
     còn lại amber; đường mục tiêu dashed xanh ngọc opacity .7; nhãn thứ mono 10.5px (hôm nay chữ main). Đầu thẻ `TB
     {n} kcal`, chân `{n} / 7 ngày đạt mục tiêu {goal} kcal`. Dữ liệu: thêm vào `useNutrition` một query **chỉ đọc**
     `body_meal_logs` cột `local_date, kcal` với `local_date >= hôm nay − 6` (cùng user filter / RLS như query hiện
     có, chạy lại khi thêm/sửa/xoá món), trả về `weekLogs`. Cộng theo ngày bằng hàm thuần `sumKcalByDay` (7.3). Kiểm
     tên cột kcal thật trong code hiện có trước khi viết query.
   - **Check-in tuần** (thay chỗ thẻ Nước của mockup): ngày check-in kế tiếp + số ngày còn lại + nút phụ "Mở check-in"
     → chuyển sang tab Check-in tuần.
4. **Tab Check-in tuần** và **modal Thêm món** (món đã lưu, gợi ý): giữ hết, đổi style.

### Đợt 8: Bản đồ cơ (`MuscleMapScreen.jsx`, class `body-atlas-*`)
**Giữ nguyên bố cục atlas cả màn** và mọi chức năng. Hình cơ thể đã là 2D từ Đợt 0. Đợt này chỉ đổi giao diện:
1. Nền vùng atlas: `--body-stage`. Thêm dưới hình (`aria-hidden`): bệ elip 420×90 `--body-platform` tại đáy
   (`bottom: 28px`), vòng elip 300×60 viền 1.5px `--body-ring` nhịp `.body-deco-pulse` 3.4s (`bottom: 44px`).
2. Chữ watermark: màu `--body-text-main` opacity .04 (tối) / .05 (sáng). Bỏ rule dark riêng.
3. Dải chip cơ trên đỉnh: chip 3.4, kèm % phục hồi (mono 10.5px opacity .75) như mockup.
4. Cụm nút công cụ nổi (chế độ, lật mặt, ẩn/hiện bảng): nút 40px radius 13px, nền `--body-card-bg` + blur, viền
   `--body-card-border`. Đang bật dùng bộ `--body-on-*`.
5. Thẻ nổi hai bên (`.body-atlas-desktop-card`): kiểu `.body-card` (kính). Thẻ tên cơ: tên `600 28–32px` title font,
   tên EN mono 12px muted, pill trạng thái viền màu trạng thái. Vòng phục hồi: kiểu vòng 3.4 (r40, stroke 8, màu
   trạng thái, glow). Lưới 7 ngày, kỷ lục, cơ phụ trợ: giữ, đổi style. Trạng thái 3 nấc giữ (không hiện %).
6. Dải bài dưới đáy: thẻ bài kiểu `.body-tile` + mũi tên `arrowUpRight` accent, lọc dụng cụ = chip 3.4.
7. Màu trạng thái còn sót trong DOM (hex) → `var(--body-green/amber/red)`. Màu hình cơ thể đã đi qua
   `muscleFigureFills` từ Đợt 0.
8. Chú thích dưới sân khấu theo chế độ đang bật: Phục hồi = "Cần nghỉ / Đang hồi / Sẵn sàng"; Mức tập = 4 nấc
   (Chưa tập / Ít / Vừa / Nhiều); Nhóm cơ = "Cơ chính / Cơ phụ". Chấm màu + chữ 12px sub, `pointer-events: none`.
9. Gợi ý thao tác góc trái trên (mới, nếu chưa có): pill `handPointing` "Bấm vào nhóm cơ để xem chi tiết".
10. Bottom sheet mobile: mục 6.

### Đợt 9: Thư viện bài (`ExerciseLibraryScreen.jsx`, `ExerciseDetailModal.jsx`, `ExerciseVideoPlayer.jsx`)
Desktop: `grid-template-columns: minmax(0,1fr) 456px; gap: 18px`. `≤ 1280px`: cột phải 400px.
1. **Cột trái**:
   - Hàng 1: ô tìm kiếm (giữ, cao 40px, radius 12px, nền `--body-card-bg`, icon `magnifyingGlass`) + seg dụng cụ (giữ).
   - Hàng 2: chip vùng cơ (3.4, cao 36px) kèm số lượng (mono 11px opacity .7).
   - Danh sách thành **lưới 2 cột** (`repeat(2, minmax(0,1fr))`, `grid-auto-rows: max-content`, gap 10px, cuộn
     nội bộ). `≤ 1100px` một cột. Mỗi thẻ (hàng chọn được 3.4, radius 18px, padding 14px 16px, gap 9px): dòng 1 số
     thứ tự (mono 13px xanh ngọc) · tên VN (600 14px ellipsis) + tên EN (12px muted) · 3 sao `starFour` 11px (sao
     theo cấp: Cơ bản 1, Trung bình 2, Nâng cao 3; sao đủ amber, sao thiếu `--body-track`); dòng 2 chip vùng cơ + chip
     dụng cụ (cao 22px, radius 7, nền `--body-shell-bg`) + `{defaultSets} × {defaultTarget} {rep|giây}` (mono, đẩy
     phải). Bài đã có trong lộ trình: giữ dấu hiệu hiện có.
2. **Cột phải: chi tiết** (`.body-hero`, padding 24px, gap 16px, cuộn nội bộ):
   - Đầu: 3 sao + `{cấp} · {dụng cụ} · {vùng}` (12px muted) · tên `600 30px/1.05` title font · `{tên EN} · gợi ý
     {sets × target}` (13px muted). Giữ nút mở bản đồ cơ.
   - **Giữ tab nội dung hiện có** (`body-lib-tabs`, kể cả "Biến thể"), style chip 3.4.
   - Tab hướng dẫn thêm/đổi theo mockup:
     - **Cơ tham gia**: lưới `90px minmax(0,1fr) 70px`: tên cơ · thanh 8px glow · vai trò. Cơ chính (`primary`) =
       thanh đầy, "Chính", màu accent. Cơ phụ (`secondary`) = thanh 50%, "Phụ", màu lần lượt xanh ngọc / pink /
       muted. Đây là độ nhấn minh hoạ, không phải số đo, nên **không hiện số %**.
     - **Các bước** (`steps`): vòng số 26px (nền `--body-shell-bg`, viền, số `600 12px` title font xanh ngọc) +
       chữ 13.5px/1.5 sub.
     - **Lỗi hay gặp** (`tip`): hộp `--body-tip-bg/-bd`, radius 15px, icon `warningDiamond` amber, "**Lỗi hay
       gặp:** {tip}".
     - **Chú ý chấn thương** (`injury_risk` / `contraindications`, nếu có): dòng `firstAid` red 12px.
     - Các trường khác đang hiển thị (thở, tempo, form cues, nguồn y khoa, video…) giữ ở tab cũ của chúng.
   - Chân: nút phụ "Thêm vào kế hoạch" (mở modal hiện có) + nút chính "Tập ngay" (`onStartExercise`). Giữ đủ.
3. Modal Thêm vào kế hoạch, `ExerciseDetailModal` (video, hình cơ 2D mới từ Đợt 0), `ExerciseVideoPlayer`: đổi nền
   `--body-card-solid`, chip/nút 3.4, quét hex theo 3.6 (trừ điều khiển video trên nền đen).

### Đợt 10: Màn tập (`LiveSessionScreen.jsx`, class `body-ls-*`)
Giữ route `/body/session`, ẩn sidebar Life Hub (đã có), giữ cột trái 320px (cách tập + thứ tự bài), giữ mọi tính
năng (chọn cách tập, hướng dẫn/video, chọn nhanh rep, quay lại set trước, bỏ qua, nghỉ có preset, tạm dừng, huỷ,
sửa số đã ghi, gợi ý tăng mục tiêu, kỷ lục, so với buổi trước, lưu).
1. Nền `.body-ls`: `--body-overlay` + `backdrop-filter: blur(12px)` (desktop) để thấy trời phía sau.
2. **Header màn tập**: eyebrow `CHẾ ĐỘ TẬP` + tiêu đề buổi (600 22px title font). Phải: đồng hồ (pill 40px, icon
   `timer` xanh ngọc, mono 15px) + các nút hiện có (tạm dừng, thoát) dạng nút icon 40px radius 13px.
3. **Thanh đoạn tiến độ** (mới, dưới header): lưới `repeat(số bài, minmax(0,1fr))` gap 12px. Mỗi bài: thanh 6px
   (xong = green, đang tập = accent đầy theo set đã xong / tổng set, chưa = track) + `{01} · {tên}` (12px, ellipsis,
   bài hiện tại chữ main, còn lại muted). Giữ thanh/tiến độ cũ nếu nó mang thông tin khác.
4. **Trạng thái đang tập**: lưới `420px minmax(0,1fr)`, gap 56px, căn giữa dọc.
   - Trái: vòng 400px (r≈182, stroke 16, cung accent glow = set đã xong / số hiệp của bài), vòng đứt trang trí `inset:
     30px` quay 60s. Giữa: `MỤC TIÊU {t} {đơn vị}` (mono 12px .16em), số rep/giây hiện tại `600 132px/1` title font
     letter-spacing −.05em, hàng −/+ (nút tròn 44px nền `--body-card-raised`) quanh nhãn đơn vị. Dải chọn nhanh 7
     số giữ ngay dưới vòng.
   - Phải: `BÀI {i} / {n} · {nhóm cơ}` (mono 12px xanh ngọc) · tên `600 60px/1.02` title font `text-wrap: balance` ·
     `{EN} · {sets × target}` (15px muted) · chấm set (xong green 10px / hiện tại accent 14px / chưa track 10px, glow)
     + `SET {x} / {y}` mono · nút chính lớn "Xong set" (cao 60px, radius 20px, icon `checkCircle`) + nút phụ "Bỏ qua
     bài" (`skipForward`) · giữ nút hướng dẫn / quay lại set trước · chân `Đã xong {a} / {b} set · sau bài này: {tên
     bài sau | Hết bài, về đích}`.
5. **Trạng thái nghỉ**: căn giữa, vòng 340px (r130, stroke 12, cung xanh ngọc đếm ngược, `transition:
   stroke-dasharray 1s linear`), giữa `NGHỈ` + mm:ss `600 84px`. Dưới: `Tiếp theo · Set {x} / {y}` + `{tên} ·
   {sets × target}` (600 26px). Nút phụ "+15 giây" + nút chính "Tập tiếp" (`fastForward`). Giữ preset nghỉ.
6. **Màn xong buổi**: phần đầu thêm theo mockup: `starFour` 96px amber glow `.body-deco-floaty` 3s · tiêu đề "Sao
   {T3} đã sáng" (`600 64px` title font; `{T3}` = thứ hôm nay T2…CN) · "Xong buổi {tag} · {tên buổi}. Chòm sao tuần
   này có thêm một ngôi sao." · 4 ô số (150px, `.body-card`): bài / set / thời gian / tổng rep · giây. **Pháo sao**
   một lần khi vào màn: 48 hạt `.body-burst-dot` (7px tròn, cứ 3 hạt có 1 hạt 10px; cứ 4 hạt có 1 hạt vuông radius
   2px), màu xoay vòng amber / accent / xanh ngọc / pink / green kèm glow, toả từ `left: 50%; top: 40%` theo góc
   ngẫu nhiên cự ly 160–520px, thời lượng 1.2–2.1s, trễ 0–0.25s, `cubic-bezier(.15,.7,.3,1) both`. Dùng RNG có hạt
   cố định (`seed = 3`, công thức `s = s * 16807 % 2147483647` như mockup) để không nhảy khi re-render, tạo một lần
   bằng `useMemo`. Giảm chuyển động thì không vẽ. Phần dưới **giữ nguyên**: danh sách bài kèm số đã ghi, sửa số (ngăn
   `body-ls-sheet`), kỷ lục, so với buổi trước, duyệt gợi ý tăng mục tiêu, nút lưu (nút chính, icon `planet`, đổi chữ
   thành "Lưu & về Tổng quan" **chỉ khi** sau khi lưu app đang chuyển về Tổng quan, còn không thì giữ chữ cũ).
7. Bỏ `--ls-dark`, `--ls-low` hex cũ, thay bằng token.

### Đợt 11: Tài liệu, test, báo cáo
1. **DESIGN.md**: thêm mục `### Body (Ngân hà) — .body-* (body.css)` cạnh mục Knowledge (Cực quang), gồm: bảng token
   (tóm tắt 3.1–3.2), quy tắc kính mờ / lớp nổi đặc, header + tab ngang, màu theo ý nghĩa (3.5), class trang trí và
   giảm chuyển động, hình cơ thể 2D (`MuscleAnatomy2D` + `muscleFigureFills`, nguồn hình MIT), mobile không blur. Link về file plan này. Sửa dòng nói Body dùng chung
   SkyBackground nếu cần (vẫn đúng).
2. **FEATURES.md**: mục Body: nút trạng thái hôm nay trên header, Chòm sao tuần, Quỹ đạo hôm nay, 7 ngày kcal, đồng
   hồ BMI, màn xong buổi "Sao … đã sáng".
3. **CHANGELOG.md**: entry `## v6.37.0 — {ngày}` (theo format các entry trên): Changed: Body đổi sang phong cách Ngân
   hà; hình cơ thể 3D (three.js) thay bằng hình 2D SVG dùng chung, nguồn hình `react-body-highlighter` v2.0.5 (MIT,
   https://github.com/GV79/react-body-highlighter). Removed: `MuscleBodyCanvas`, dependency `three`. Added: chòm sao
   tuần, quỹ đạo hôm nay, biểu đồ kcal 7 ngày, đồng hồ BMI, pháo sao xong buổi, nút trạng thái hôm nay trên header.
   Không bump version trong `package.json` (RULES §11).
4. **PLAN.md**: đánh dấu mục "Body · Ngân hà" là xong.
5. `npm test` toàn bộ + `npx eslint src/pages/BodyPage.jsx src/components/body src/components/AppIcon.jsx
   src/hooks/useNutrition.js src/utils/workoutLogic.js src/utils/bodyMetrics.js`.
6. Lưu Engram (`mem_save` qua MCP, project `web_challenge`): quyết định Ngân hà + vị trí plan.
7. Báo cáo cho user: file đã đổi, quyết định tự đưa ra ngoài plan (nếu có), checklist mục 9. Không nói "build
   pass" hay "UI chạy đúng".

---

## 6. Mobile (≤ 840px)

Nguyên tắc: **giữ cấu trúc mobile hiện có** của từng màn (header mobile + chip tab, thẻ xếp dọc, bottom sheet,
thanh hành động ghim đáy), chỉ khoác Ngân hà. Không blur trên mobile.

### 6.1 Header mobile (`.body-mhead`)
- Hàng trên (giữ nút: về Life Hub, tiêu đề, pill buổi dở, nút ngữ cảnh +, đổi sáng/tối):
  - Thêm eyebrow `BODY · 0N / 07` (mono 10px .16em muted) phía trên tiêu đề.
  - Tiêu đề: `600 20px/1.1 var(--body-title-font)`. Dòng sub giữ (11.5px muted).
  - Nút icon 38px radius 12px: nền `--body-card-bg` (mobile là nền đặc hơn, 3.4), viền `--body-card-border`.
    `.is-dark` (nút + chính) → `--body-btn-grad` + `--body-btn-ink` + `--body-btn-shadow`.
  - Pill buổi dở `.body-mhead-live`: nền `--body-card-raised`, viền amber, chữ mono main, icon accent.
- Dải chip tab: chip cao 34px radius 17px, viền 1px. Thường: bộ `--body-off-*`. Đang mở: bộ `--body-nav-on-*`
  (tối: nền tím mờ + glow; sáng: nền trắng chữ accent + bóng). Giữ tự cuộn chip đang mở vào giữa.
- Mobile **không** có nút trạng thái hôm nay trên header (chật). Nút bắt đầu/tiếp tục nằm ở thẻ hero Tổng quan và
  Lộ trình như hiện tại.

### 6.2 Thành phần chung mobile
- `.body-content`: `padding: 12px 16px 40px` (giữ đệm né FAB).
- Thẻ: radius 20px, padding 16px, gap giữa thẻ 12px.
- Hero: radius 22px. Hành tinh thu nhỏ 120px đặt `right:-24px; top:-24px` opacity .9, vẫn floaty.
- Chữ to giảm: tiêu đề hero 28–30px, số lớn màn tập 96px, tiêu đề trang header 20px.
- Bottom sheet / modal mobile: nền `--body-card-solid`, radius trên 22px, tay nắm 36×4 `--body-track`.
- Thanh hành động ghim đáy: nền `--body-card-solid` + viền trên `--body-card-border`, nút chính full-width gradient.
- Touch target ≥ 40px. Chip lọc cuộn ngang một hàng.

### 6.3 Từng màn trên mobile
- **Tổng quan**: thứ tự giữ: hero (pill trạng thái, tiêu đề 28px, pill thời lượng, danh sách bài **1 cột** tối đa 3
  ô + "+n bài nữa", nút chính full-width) → hàng 2 thẻ Cân nặng + Năng lượng (Năng lượng dùng vòng kcal 96px + 2
  dòng macro chính) → Phục hồi cơ (hình 2D hai mặt cao 140px bên trái, 3 con số + chip nhóm bên phải; mobile giờ đã
  có hình, trước đây bị tắt) → **Chòm sao mini**: SVG cùng
  `viewBox 0 0 834 190` thu theo bề ngang, nhãn chỉ `T2` + số set, bỏ tên buổi; 3 chỉ số tuần ở trên → Check-in tuần.
- **Lộ trình**: giữ layout mobile (`body-rt-m-*`): dải 7 ngày thành hàng vòng 40px cuộn ngang (viền màu buổi, ngày
  chọn = bộ row-on), chi tiết ngày là hero, hàng bài `.body-tile` có cụm −/+ xuống dòng thứ hai, thanh hành động đáy giữ.
- **Tiến bộ**: chip bài cuộn ngang → thẻ chính (4 chỉ số thành lưới 2×2) → biểu đồ cao 200px, cuộn ngang nếu > 8
  buổi → bảng buổi gọn 3 cột (ngày · các set · đánh giá) → lịch → kỷ lục.
- **Cơ thể**: seg 3 tab full-width → đồng hồ BMI (khối co theo bề ngang, `viewBox` giữ tỉ lệ) → thành phần → xu
  hướng (3 ô chỉ số cuộn ngang) → lưới chỉ số **2 cột**. Thêm cân đo: nút + trên header (đang có). Chi tiết lần đo:
  bottom sheet (đang có).
- **Dinh dưỡng**: dải ngày + tab → vòng kcal 200px + macro → bữa ăn accordion (dòng món: tên + kcal, dòng dưới Đ/B/M)
  → 7 ngày qua → check-in tuần. "Thêm món" là thanh ghim đáy nếu hiện tại đang vậy, còn không thì nút trong đầu thẻ bữa ăn.
- **Bản đồ cơ**: hình 2D **một mặt** (cao theo chỗ trống phía trên sheet) + nút Lật mặt + bottom sheet 3 tab (giữ).
  Sheet `--body-card-solid`, tab = chip, nút công cụ nổi 40px kính.
- **Thư viện bài**: danh sách 1 cột thẻ (như desktop nhưng 1 cột) → chi tiết là màn riêng (đang có), hero chi tiết +
  thanh đáy "Thêm vào kế hoạch" / "Tập ngay" (đang có).
- **Màn tập**: giữ layout mobile hiện tại (header + thanh tiến độ, nội dung cuộn, thanh nút đáy). Thanh đoạn tiến độ
  thu còn cao 4px không chữ. Vòng rep 260px, số 96px. Nghỉ: vòng 240px, số 64px. Màn xong: sao 72px, tiêu đề 36px,
  4 ô số thành lưới 2×2, pháo sao 32 hạt cự ly 120–300px.

---

## 7. Logic thuần mới (kèm test)

Tất cả là hàm thuần, không React, không Supabase. Test thêm vào file test **đã có**, đã nằm trong `npm test`.

### 7.1 `getTodayTrainingState({ sessions, routineItems, today })` → `src/utils/workoutLogic.js`
- `weekday` = thứ của `today` (1 = T2 … 7 = CN, CN của JS là 0 → 7). Ngày dùng `toDateStr(today)`.
- Thứ tự ưu tiên:
  1. Có session `status === 'in_progress'` (bất kể ngày) → `{ state: 'resume', session }`.
  2. Có session `completed` với `local_date === hôm nay` → `{ state: 'done', session }`.
  3. Có `routineItems` với `weekday` khớp → `{ state: 'start', weekday, dayName: items[0].day_name || 'Buổi tập hôm nay' }`.
  4. Còn lại → `{ state: 'rest', weekday }`.
- `OverviewScreen.sessionStats` dùng hàm này để lấy `isInProgress / isDone / hasPlan` (một nguồn sự thật), phần
  còn lại của `sessionStats` giữ nguyên.
- Test (`src/__tests__/body/workoutLogic.test.js`): 4 nhánh; buổi dở từ hôm qua vẫn `resume`; đã xong hôm nay
  nhưng còn buổi dở → `resume`; Chủ nhật → weekday 7; `routineItems` rỗng → `rest`.

### 7.2 `buildWeekConstellation(days)` → `src/utils/workoutLogic.js`
- Vào: mảng 7 phần tử `{ label: 'T2', dateNum: '12', title, status, sets }`, `status ∈ 'done' | 'today' | 'planned' | 'rest'`.
  `today` chỉ khi chưa tập xong hôm nay (đã xong là `done`).
- Toạ độ cố định trên khung 834×190: `xs = [44,168,292,416,540,664,788]`, `ys = [112,58,96,40,84,122,66]`, `ly = y + 24`.
- Mỗi điểm trả về: `{ x, y, ly, r, halo, hop, pulse, kind }`:
  - done: `r 9, halo 20, hop .2`, kind `done`
  - today: `r 10, halo 22, hop .28, pulse true`
  - rest: `r 4.5, halo 0`
  - planned: `r 7, halo 0`

  Component quy `kind` ra màu: done = amber (lõi đầy amber), today = accent (lõi đầy accent), rest = muted (lõi
  nền `--body-bg`), planned = màu buổi (lõi nền `--body-bg`). Nhãn: done amber / today accent / còn lại muted. Tên
  buổi: done/today màu main, còn lại sub.
- 6 đoạn nối giữa các điểm liền nhau: `lit = cả hai done` → `{ lit: true, w: 1.8, dash: null, op: .85 }` (amber),
  ngược lại `{ lit: false, w: 1.2, dash: '3 6', op: .5 }` (muted).
- Trả thêm `doneCount`, `plannedCount` (số ngày không phải `rest`).
- Test: 7 điểm đúng toạ độ; đoạn sáng chỉ khi hai đầu done; `doneCount` / `plannedCount` đúng; vào thiếu ngày →
  ném lỗi rõ ràng (`days must have 7 items`).

### 7.3 `sumKcalByDay(logs, endDateStr, n = 7)` → `src/utils/bodyMetrics.js`
- Trả mảng `n` phần tử `{ date, kcal }` từ `endDate − (n−1)` tới `endDate`, ngày không có log là 0, cộng `kcal`
  (ép số, bỏ null/NaN). Dùng `dateUtils` sẵn có để lùi ngày (không tự cộng ms để tránh lệch giờ).
- Test (`src/__tests__/body/bodyMetrics.test.js`): ngày trống = 0; nhiều log cùng ngày cộng dồn; log ngoài khoảng bị
  bỏ; qua ranh giới tháng.

### 7.4 `muscleFigureFills({ mode, selected, secondary, heatMap, recoveryMap })` → `src/utils/workoutLogic.js`
- Quy tắc tô màu và test: xem Đợt 0.3.

---

## 8. Danh sách file sẽ đụng

| File | Đợt |
|---|---|
| `src/data/body-muscle-figure.json` (**mới**) | 0 |
| `src/components/body/MuscleAnatomy2D.jsx` (viết lại) | 0 |
| `src/components/body/MuscleBodyCanvas.jsx` (**xoá**) | 0 |
| `package.json`, `package-lock.json` (gỡ `three`) | 0 |
| `src/styles/body.css` | 0–10 |
| `src/pages/BodyPage.jsx` | 1 |
| `src/components/AppIcon.jsx` | 1 |
| `src/utils/workoutLogic.js` + `src/__tests__/body/workoutLogic.test.js` | 0, 1, 2 |
| `src/components/body/OverviewScreen.jsx` | 0, 2 |
| `src/components/body/RoutineScreen.jsx` | 3 |
| `src/components/body/WorkoutHistoryScreen.jsx` | 4 |
| `src/components/body/BiometricsScreen.jsx` | 5 |
| `src/components/body/NutritionScreen.jsx`, `src/hooks/useNutrition.js`, `src/utils/bodyMetrics.js` + `src/__tests__/body/bodyMetrics.test.js` | 7 |
| `src/components/body/MuscleMapScreen.jsx` | 0, 8 |
| `src/components/body/ExerciseDetailModal.jsx` | 0, 9 |
| `src/components/body/ExerciseLibraryScreen.jsx`, `ExerciseVideoPlayer.jsx` | 9 |
| `src/components/body/LiveSessionScreen.jsx` | 10 |
| `DESIGN.md`, `docs/FEATURES.md`, `docs/PLAN.md`, `CHANGELOG.md` | 11 |

**Không đụng:** `useWorkouts.js`, `useBiometrics`, migration/schema, `SkyBackground`, `sky.css`, sidebar Life Hub,
`src/data/body-muscles.json` (14 nhóm cơ giữ nguyên).

---

## 9. Checklist cho user tự kiểm (đưa vào báo cáo cuối)

Lưu ý: Body cần **đăng nhập** (khách không có dữ liệu). Cần sẵn: một lộ trình đang dùng, vài buổi đã tập trong tuần
và tháng, vài lần cân đo (có tỷ lệ mỡ), vài món ăn hôm nay và mấy ngày trước.

1. Đổi sáng/tối trên từng trang: chữ đọc rõ, không còn thẻ trắng/đen lạc tông, modal không trong suốt.
2. Header: `BODY · 0N / 07` đúng số, Tổng quan hiện lời chào, tab đang mở phát sáng, thu hẹp cửa sổ 1360 → 1280 →
   1180 thấy chip ngày thu rồi ẩn, tab còn icon.
3. Nút trạng thái hôm nay ở 4 tình huống: ngày có lịch chưa tập / đang có buổi tạm dừng / đã tập xong / ngày nghỉ
   (hoặc tắt lộ trình).
4. Tổng quan: hero có danh sách bài, chòm sao đúng ngày đã tập và hôm nay, quỹ đạo khớp số Dinh dưỡng, Phục hồi cơ
   có hình 2D hai mặt tô đúng màu + 3 con số (cả trên mobile), còn thẻ Ngày mai, Ghi nhanh vẫn lưu được.
5. Lộ trình: −/+ hiệp/mục tiêu/nghỉ, tăng tiến tự động, kéo đổi thứ tự, thêm/xoá bài, đổi tuần, đổi/sửa/tạo lộ
   trình, áp mẫu đều còn chạy.
6. Tiến bộ: chọn nhiều bài (chip cuộn ngang), biểu đồ có đường mục tiêu + sao kỷ lục, bấm ngày trên lịch mở chi tiết.
7. Cơ thể: đồng hồ BMI đúng vùng, donut thành phần, đổi chỉ số/khoảng xu hướng, tab Lịch sử + Hồ sơ, Thêm cân đo.
8. Dinh dưỡng: đổi ngày, mở/đóng bữa, thêm/sửa/xoá món, cột 7 ngày cập nhật sau khi thêm món, tab Check-in.
9. Bản đồ cơ: hình 2D hai mặt (desktop) / một mặt + Lật mặt (mobile), 3 chế độ đổi màu đúng, rê chuột hiện tên cơ,
   bấm cơ (cả bằng Tab + Enter) đổi chi tiết, ẩn/hiện bảng, dải bài, bệ sáng dưới hình.
10. Thư viện: tìm, lọc dụng cụ + vùng, lưới 2 cột, tab chi tiết, Thêm vào kế hoạch, Tập ngay.
11. Màn tập: một buổi đủ vòng: Xong set → nghỉ (+15 giây, Tập tiếp) → bỏ qua bài → quay lại set trước → tạm dừng →
    tiếp tục → xong buổi thấy pháo sao + "Sao T… đã sáng", sửa số đã ghi, duyệt gợi ý, lưu.
12. Cài đặt → Chung → bật **Giảm chuyển động**: hành tinh, quỹ đạo, nhịp sáng, pháo sao đều đứng yên/ẩn.
13. Mobile (thu cửa sổ < 840px hoặc điện thoại): header + chip tab, từng màn theo mục 6.3, không có thanh cuộn ngang toàn trang.

---

## 10. Ngoài phạm vi (không làm trong plan này)

- Theo dõi nước uống (bảng mới + vòng nước + cốc nước): làm riêng khi user yêu cầu.
- Nền động Ngân hà (sao, sao băng, tinh vân, cực quang). Nếu sau này muốn thì phải đi qua `/fx-lab` (RULES §15).
- Thanh điều hướng dọc 88px.
- Bố cục 3 cột cho Bản đồ cơ.
- Mô hình 3D giải phẫu thật (file GLB). Nếu sau này muốn quay lại 3D thì làm thành plan riêng.
