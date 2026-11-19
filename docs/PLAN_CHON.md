# PLAN — Chốn · nơi muốn đến & nơi đã qua

**Trạng thái:** G1 xong (v6.38.0 + vá v6.38.1) · G2 Chuyến đi đã code (v6.39.0, chờ user kiểm) · **Lập:** 2026-11-19 ·
**Người duyệt:** user

**Lệch so với plan khi code G1** (đã chốt trong lúc làm):
- Điện thoại: G1 từng giữ thanh Life Hub + tab đáy chung (lệch §6) → chồng nhiều lớp, tab tràn ngang. **Đã quay về §6**
  (v6.40.0): ẩn thanh chung, thanh trên + tab đáy riêng như Knowledge, nội dung giữa cuộn.
- Ảnh trong cảm nhận, sửa lần ghé, bong bóng cụm trên bản đồ, danh mục Tài chính theo override của user: để sau ở
  G1, **đã làm ở v6.40.0**. Bong bóng dùng `clusterByGrid` (lưới điểm ảnh theo zoom, O(n)); `nearbyClusters` giữ cho gợi
  ý "một buổi" ở đầu danh sách.

Module mới **Chốn** (Hướng 2 của canvas "Sổ Địa Điểm · 2 hướng"): lưu quán ăn, quán cà phê, chỗ đi chơi, chuyến
du lịch mình **muốn đến**; tới nơi thì **thắp đèn** (đã đến) và ghi **cảm nhận**. Đèn tắt = chưa đi, đèn sáng = đã
đến — nhìn danh sách / bản đồ là biết.

**Mockup gốc:** canvas Design, các artboard `2A · chon-home` (máy tính), `2B · chon-capture`, `2C · chon-detail`,
`2D · chon-review` (điện thoại 390×844), `2E · chon-trip` (máy tính). Mockup là khung cứng với dữ liệu mẫu. Chỉ lấy
**giao diện** (màu, chữ, bố cục, bo góc, hình minh hoạ). Dữ liệu và hành vi theo file này.

---

## 1. Quyết định

| # | Vấn đề | Chốt |
|---|---|---|
| 1 | Bản đồ | **Leaflet + OpenStreetMap** (user chốt 2026-11-19). Thêm dependency `leaflet` (không dùng `react-leaflet` — tự gắn vào `ref` trong `ChonMap.jsx`), tile OSM chuẩn, ghi công "© OpenStreetMap" ở góc theo giấy phép ODbL. Màu tối bằng CSS `filter` trên lớp tile (`chon.css`), ghim là `L.divIcon` vẽ bằng HTML/CSS của app. Leaflet chỉ tải lười khi bản đồ hiện (dynamic `import()`), không vào chunk chính. "Chỉ đường" vẫn mở Google Maps. Dữ liệu luôn lưu `lat`/`lng`; bản đồ làm ở đợt 9 |
| 2 | Lấy thông tin từ link (TikTok, FB…) | **Không làm.** Form nhập tay, gọn, dễ dùng. Ngoại lệ rẻ, không cần server: đọc toạ độ / tên từ **link Google Maps đầy đủ** ngay ở client (`parseMapsUrl`), và đoán **nền tảng** từ link (TikTok, Reel FB…) để hiện nhãn |
| 3 | Nhịp làm | **2 giai đoạn.** G1 = Chốn lõi (2A–2D) + nối Nhiệm vụ / Tài chính / Kiến thức. G2 = Chuyến đi (2E). Hết mỗi giai đoạn **dừng cho user duyệt** |
| 4 | Khách | **Chỉ khi đăng nhập** (như Knowledge / Finance). Khách thấy màn giới thiệu + nút đăng nhập |
| 5 | Nền | `<SkyBackground calm />` như Knowledge / Body. Không vẽ thêm trời riêng (mockup tự vẽ sao — bỏ) |
| 6 | Thanh dọc 64px của mockup | **Không làm.** Dùng sidebar Life Hub hiện có, thêm mục **Chốn** |
| 7 | Ảnh bìa | G1 **không** có ảnh bìa thật. Mỗi loại chốn có **hình minh hoạ vẽ bằng code** (bát bún, ốc, ly cà phê, lều, núi…) như mockup. Ảnh chụp chỉ ở **cảm nhận** (dùng upload Drive sẵn có) |
| 8 | Màu riêng | Đèn lồng `#F5B45E` trên trời đêm. Token scoped `--chon-*` (tối + sáng) — hệ token scoped thứ 5, ghi vào DESIGN.md |
| 9 | Route | `/chon` (danh sách), `/chon/:placeId` (chi tiết — nút Back của điện thoại chạy đúng). G2: `/chon/trip/:tripId` |

---

## 2. Mối liên kết với module khác

```text
                 ┌──────────── Kiến thức (collections) ────────────┐
                 │  nguồn "bài review dài" trỏ tới 1 bài Kiến thức   │
                 │  "Viết thành bài" → tạo bài mới, nguồn trỏ về     │
                 └───────────────▲──────────────────────────────────┘
                                 │ place_sources.collection_id
  Nhiệm vụ (user_tasks)          │
  "Hẹn ngày đi" ──► task  ◄──── places.plan_task_id ──── places ──── place_visits ────► finance_transactions
  "Đi Ốc đêm hẻm 200"           (1 hẹn đang chờ / chốn)    │      (thắp đèn)        visit.finance_tx_id
  hạn = ngày hẹn                                            │      chi phí → Tài chính, nơi chi = tên chốn
                                                            │
  G2: trips ── trip_places ─────────────────────────────────┘
        ├─ trip_options (so sánh tour, 1 phương án được chốt)
        ├─ prep_task_id → task cha "Chuẩn bị <chuyến>", checklist = subtask có sẵn của Nhiệm vụ
        └─ chốt → giao dịch Tài chính · Du lịch
```

| Từ Chốn | Sang | Cách nối | Ghi chú |
|---|---|---|---|
| **Hẹn ngày** (2B footer, 2C nút) | Nhiệm vụ | Tạo task `Đi <tên chốn>` hạn = ngày chọn (giờ tuỳ chọn) qua `useUserTasks().addTask`; lưu id vào `places.plan_task_id`. Đang có hẹn chưa xong → hẹn lại = dời hạn việc đó (`updateTask`), không tạo việc trùng | Task xoá → FK `SET NULL`, chốn tự hết "đã hẹn". Thẻ chốn hiện viên "Hẹn T6 22/11"; quá hạn mà chưa thắp đèn → viên đổi màu nhắc |
| **Thắp đèn + chi phí** (2D) | Tài chính | RPC `light_place` ghi lần đến + (nếu bật) giao dịch chi `merchant = tên chốn`, danh mục theo loại chốn, trong **một transaction** | Tắt công tắc = không ghi Tài chính. Xoá giao dịch bên Finance → `SET NULL`, lần đến còn nguyên |
| **Nguồn = bài Kiến thức** | Kiến thức | `place_sources.collection_id` | Chọn bài bằng `LinkPicker` + `useCollections().fetchLinkOptions` (đã có cho Task) |
| **Viết thành bài** | Kiến thức | `useCollections().addItem` tạo bài nháp (tiêu đề = tên chốn, nội dung = các cảm nhận), rồi thêm nguồn trỏ về bài | Không đổi gì phía Knowledge |
| **Chỉ đường** | Google Maps (ngoài app) | Mở `maps_url` nếu có, không thì `https://www.google.com/maps/dir/?api=1&destination=lat,lng` | Không cần API key |
| **Rủ bạn** | Hệ điều hành | `navigator.share` (tên + địa chỉ + link), không có thì chép vào clipboard + toast | |
| **Chia sẻ → Life Hub** (Android) | PWA | `share_target` trong `manifest.json` (GET) → mở `/chon?share=1` với `url` / `text` điền sẵn vào form | Đọc xong xoá query (`replaceState`). Không cần service worker |

Ngoài phạm vi G1: bấm hoàn thành task "Đi …" bên Nhiệm vụ tự mở màn thắp đèn (đụng TasksPage — để sau, xem §10).

---

## 3. Cơ sở dữ liệu

Migration mới, additive, idempotent, theo mẫu `20261108000000_knowledge_snippets_v6_36_0.sql`: RLS 4 policy / bảng,
`REVOKE ALL … FROM anon, public`, `GRANT` đúng verb cho `authenticated`, khối `VERIFY` cuối file, `ROLLBACK` ghi chú.
Không sửa bảng của module khác (không thêm cột vào `finance_transactions`, `user_tasks`, `collections`).

### 3.1 G1 — `supabase/migrations/20261119000000_places_v6_38_0.sql`

**`places`** — một chốn

| Cột | Kiểu | Ràng buộc / ý nghĩa |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `user_id` | uuid | `NOT NULL REFERENCES auth.users ON DELETE CASCADE` |
| `name` | text | `length(btrim) 1..120` |
| `kind` | text | `CHECK IN ('food','cafe','outing','travel','stay','other')` — Ăn uống · Cà phê · Đi chơi · Du lịch · Lưu trú · Khác |
| `area` | text | khu vực ("Quận 4", "Hà Giang"), `≤ 60`, mặc định `''` — dùng để lọc & gom |
| `address` | text | `≤ 240`, mặc định `''` |
| `lat`, `lng` | double precision | NULL được; `CHECK ((lat IS NULL) = (lng IS NULL))`, `lat BETWEEN -90 AND 90`, `lng BETWEEN -180 AND 180` |
| `maps_url` | text | `≤ 2000`, phải bắt đầu `http://` / `https://` nếu có |
| `price_per_person` | integer | VND, `≥ 0`, NULL = chưa biết |
| `hours_note` | text | "17:00–02:00 · nghỉ thứ Hai", `≤ 80` — chữ tự do, không dựng lịch mở cửa có cấu trúc |
| `must_try` | text[] | Món nên thử, mặc định `'{}'`, `cardinality ≤ 20` |
| `occasions` | text[] | Hợp với, `<@ ARRAY['friends','date','family','solo']` |
| `note` | text | ghi chú riêng `≤ 2000` |
| `plan_task_id` | uuid | NULL được; FK hai cột `(plan_task_id, user_id) → user_tasks (id, user_id) ON DELETE SET NULL (plan_task_id)` |
| `archived_at` | timestamptz | NULL = đang dùng; có giá trị = trong Thùng rác (giống `collections` archived) |
| `created_at`, `updated_at` | timestamptz | trigger `updated_at` dùng lại hàm có sẵn |

`UNIQUE (id, user_id)` làm đích FK hai cột cho bảng con. Index `(user_id, archived_at)`.

**Trạng thái không lưu cột riêng:** "Muốn đến" = chưa có `place_visits`; "Đã đến" = có ≥ 1 lần. Suy ra ở client
(`placeState`) — một nguồn sự thật, không lệch.

**`place_sources`** — "Ai giới thiệu" (một chốn gộp nhiều lần lưu)

| Cột | Kiểu | Ràng buộc |
|---|---|---|
| `id`, `user_id`, `created_at` | | như trên; `created_at` = ngày lưu |
| `place_id` | uuid | FK hai cột `(place_id, user_id) → places (id, user_id) ON DELETE CASCADE` |
| `platform` | text | `CHECK IN ('tiktok','facebook','instagram','youtube','threads','google_maps','web','friend','other')` — client đoán từ link, user sửa được |
| `url` | text | NULL được, `≤ 2000`, http(s) |
| `author` | text | "@angi.dau", "Minh", `≤ 80` |
| `quote` | text | lời giới thiệu trích lại, `≤ 500` |
| `collection_id` | uuid | NULL được; `REFERENCES collections(id) ON DELETE SET NULL` + trigger kiểm cùng chủ (`collections` không có `UNIQUE (id, user_id)` — không sửa bảng đó) |

Không có CHECK "phải có ít nhất một trường": `collection_id` bị `SET NULL` khi xoá bài Kiến thức, CHECK đó sẽ chặn
luôn việc xoá bài. App kiểm khi lưu (link, tác giả hoặc lời trích — ít nhất một).

**`place_visits`** — mỗi lần thắp đèn

| Cột | Kiểu | Ràng buộc |
|---|---|---|
| `id`, `user_id`, `created_at`, `updated_at` | | |
| `place_id` | uuid | FK hai cột → `places` `ON DELETE CASCADE` |
| `visited_on` | date | `NOT NULL DEFAULT current_date`, không sau hôm nay + 1 (lệch múi giờ) |
| `rating` | smallint | NULL hoặc `1..5` |
| `revisit` | text | NULL hoặc `IN ('yes','maybe','no')` — Sẽ quay lại · Có thể · Một lần thôi |
| `dishes` | text[] | món đã gọi, `≤ 30` |
| `liked_dishes` | text[] | món ngon, `liked_dishes <@ dishes` |
| `party_size` | smallint | NULL hoặc `1..50` ("Đi 3 người") |
| `note` | text | cảm nhận `≤ 4000` |
| `photos` | text[] | URL ảnh từ `/api/upload`, `≤ 10` |
| `spent` | bigint | VND `≥ 0`, NULL = không ghi |
| `finance_tx_id` | uuid | NULL được; `REFERENCES finance_transactions(id) ON DELETE SET NULL` + trigger kiểm cùng chủ |

Nhiều lần đến được (lần đầu, lần 2…): danh sách / bản đồ dùng lần gần nhất; chi tiết chốn hiện lịch sử.

**Trigger `places_check_refs()`** (BEFORE INSERT/UPDATE trên `place_sources`, `place_visits`): `collection_id` /
`finance_tx_id` phải thuộc `NEW.user_id`, sai thì `RAISE`. Đây là pattern "trigger kiểm reference chéo domain" Finance
đang dùng; RLS + junction kiểm hai phía theo RULES §7.

**RPC `light_place(...)` — `SECURITY INVOKER`** (chạy dưới RLS của user, không cần definer):

```text
light_place(p_place_id uuid, p_visited_on date, p_rating smallint, p_revisit text,
            p_dishes text[], p_liked text[], p_party_size smallint, p_note text, p_photos text[],
            p_spent bigint, p_to_finance boolean,
            p_category_id text, p_subcategory_id text, p_necessity text)
  → place_visits row
```

1. Kiểm `p_place_id` thuộc `auth.uid()` và chưa vào thùng rác.
2. Nếu `p_to_finance AND p_spent > 0`: `INSERT finance_transactions (type 'expense', amount, occurred_at =
   p_visited_on, category/subcategory/necessity do client tính bằng `deriveNecessity` sẵn có, merchant = tên chốn,
   note = 'Chốn · <tên>')`.
3. `INSERT place_visits (…, finance_tx_id)`. Lỗi bất kỳ bước nào → rollback cả hai.
`GRANT EXECUTE … TO authenticated`, `REVOKE … FROM anon, public`; `SET search_path = public`.

Sửa / xoá lần đến dùng update/delete thường (RLS). Xoá lần đến **không** tự xoá giao dịch (tiền đã tiêu là thật) —
hộp xác nhận nói rõ và có ô "xoá luôn giao dịch 360.000đ" (gọi `useFinance`-free delete qua RPC nhỏ hoặc để G2; mặc
định G1: chỉ báo, không xoá).

### 3.1b Bản vá — `20261119005000_places_check_refs_fix_v6_38_1.sql`

`places_check_refs()` của v6.38.0 gộp `TG_TABLE_NAME = … AND NEW.cột …` trong một `IF … ELSIF`; PL/pgSQL đọc cả cột
không có ở bảng đang chạy → lỗi 42703, PostgREST trả 400 (lưu chốn có lời giới thiệu và thắp đèn đều hỏng). Bản vá
dùng IF lồng nhau theo bảng. Migration v6.38.0 đã chạy nên không sửa file cũ (snapshot bất biến).

### 3.2 G2 — `20261119010000_trips_v6_39_0.sql` (chốt khi làm G2)

- **`trips`**: `title`, `tagline` ("mùa tam giác mạch"), `region`, `start_date`, `end_date` (`end ≥ start`), `people`
  (1..50), `status` (`planning|booked|done|cancelled`), `place_id` (chốn đích, FK hai cột `SET NULL`), `prep_items`
  jsonb, `prep_task_id` (FK hai cột → `user_tasks`), `extra_costs` jsonb (`{label, amount}`), `finance_tx_id`,
  `rating`, `review`, `note`, `archived_at`.
- **Chuẩn bị — một nguồn sự thật mỗi lúc**: trước khi đẩy, danh sách ở `prep_items` (`{id, text, done}`), sửa ngay trên
  trang chuyến. "Đẩy sang Nhiệm vụ" tạo việc cha "Chuẩn bị <chuyến>" (hạn = trước ngày đi một ngày) + việc con cho mục
  chưa xong, lưu `prep_task_id`, xoá `prep_items`. Sau đó trang chuyến chỉ hiện việc cha + tiến độ, tích ở Nhiệm vụ.
- **`trip_options`**: `name`, `provider`, `price_per_person`, `price_note`, `schedule`, `schedule_note`, `includes[]`,
  `excludes[]`, `source_url`, `source_note`, `pros`, `cons`, `my_note`, `pick` (NULL | `leaning` "Đang nghiêng về" |
  `chosen`), `sort_order`, `rating` (sau chuyến). Partial unique index: mỗi chuyến tối đa một `leaning`, một `chosen`.
  Đổi "nghiêng về" = hai update (bỏ cái cũ rồi đặt cái mới) — lỡ hỏng giữa chừng chỉ mất nhãn, không mất dữ liệu.
- **`trip_places`**: PK `(trip_id, place_id)`, `day_index` (NULL = chưa xếp), `sort_order`, FK hai phía cascade.
- **RPC `choose_trip_option`**: chốt (bỏ chốt / nghiêng về cũ), `planning → booked`, tuỳ chọn ghi giao dịch chi
  (số tiền mặc định = giá × số người, sửa được; danh mục Du lịch).
- **"Dán báo giá"**: `parseQuote` (thuần, có test) tách giá + gồm / chưa gồm từ chữ dán vào form lựa chọn — chỉ điền
  sẵn, user sửa tay. Không gọi server.
- **Lần trước**: `pastTripHint` — chuyến đã đi có chấm điểm, ưu tiên cùng vùng.

---

## 4. Logic thuần (kèm test) — `src/utils/placeLogic.js`

Test: `src/__tests__/core/placeLogic.test.js` (node:assert, nối vào `npm test`).

| Hàm | Làm gì | Edge case phải test |
|---|---|---|
| `placeState(place)` | `'want' \| 'visited'` + lần đến gần nhất, điểm gần nhất | không có visit; nhiều visit cùng ngày |
| `filterPlaces(places, { tab, kind, area, occasion, query, near })` | lọc + tìm (bỏ dấu, dùng `slugifyVi` của `kbDeriveUtils`) trên tên, khu vực, món, tác giả nguồn, trích | chuỗi có dấu / không dấu; chốn trong thùng rác bị loại |
| `sortPlaces(list, mode, origin)` | mới lưu / gần tôi / điểm cao | chốn không toạ độ xếp cuối khi "gần tôi" |
| `distanceM(a, b)` + `formatDistance(m)` | haversine; "650 m", "2,1 km", "68 km" (dấu phẩy thập phân vi-VN) | 0 m; > 100 km làm tròn |
| `nearbyClusters(places, radiusM = 1000)` | gom chốn muốn đến gần nhau (tham lam theo khoảng cách, cụm ≥ 3) → gợi ý "Quận 4 có 3 chốn cách nhau dưới 1 km" | không toạ độ; 2 chốn (không đủ cụm); một chốn chỉ thuộc 1 cụm |
| `parseMapsUrl(url)` | đọc `lat,lng` từ `@lat,lng`, `!3d…!4d…`, `?q=lat,lng`, `ll=`; tên từ `/place/<tên>/` | link rút gọn `maps.app.goo.gl` → trả `{ short: true }` để UI nhắc "mở link rồi chép link đầy đủ" |
| `detectPlatform(url)` | tiktok / facebook (kể cả `fb.watch`) / instagram / youtube (`youtu.be`) / threads / google_maps / web | URL hỏng → `'other'` |
| `findDuplicatePlace(places, { name, area })` | so tên đã bỏ dấu + khu vực → gợi ý "Đã có *Ốc đêm hẻm 200* — thêm lời giới thiệu vào chốn này?" | khác khu vực cùng tên → không trùng |
| `dishMentions(place)` | đếm món được nhắc (must_try + món đã gọi + món ngon qua các lần đến) cho chip "Ốc len xào dừa · 2" | trùng hoa thường / khoảng trắng |
| `ratingLabel(n)` | 1 "Không hợp" · 2 "Tạm" · 3 "Được" · 4 "Ngon, đáng đi" · 5 "Phải quay lại" | NULL |
| `planBadge(place, today)` | viên "Hẹn T6 22/11" / "Quá hẹn 2 ngày" từ task gắn | task đã xong / đã xoá |

Dữ liệu tĩnh `src/data/place-kinds.json`: mỗi loại `{ id, label, icon, artKey, financeSubcategory }` — map sang khoá
danh mục **thật** trong `finance-categories.json` (vd Du lịch → `entertainment.travel`; Ăn uống / Cà phê chọn khoá ăn
ngoài / đồ uống khi code, đối chiếu file).

---

## 5. Data owner — `src/hooks/usePlaces.js`

Theo mẫu `useCollections`: auth-only, `isLoading` khởi tạo theo `enabled`, response gắn user (bỏ response của user cũ).

- `fetchPlaces()` — một query: `places` + `place_sources(*)` + `place_visits(*)`, `archived_at IS NULL`, mới nhất trước,
  `limit 1000`; thùng rác query riêng khi mở.
- `addPlace(fields, firstSource)` — insert chốn rồi nguồn; nguồn lỗi → xoá chốn vừa tạo (rollback rõ ràng) và báo.
- `updatePlace(id, patch)` — optimistic + rollback.
- `archivePlace / restorePlace / deletePlace` — Thùng rác; xoá vĩnh viễn qua `ConfirmModal`.
- `addSource / updateSource / deleteSource`.
- `lightPlace(placeId, visit, { toFinance })` — gọi RPC, **không** optimistic (ghi 2 bảng), xong mới thêm vào state.
- `updateVisit / deleteVisit`.
- `setPlanTask(placeId, taskId | null)`.

"Hẹn ngày" dùng `useUserTasks().addTask` **bên trong popover hẹn ngày** (chỉ mount khi mở) để trang Chốn không tải cả
danh sách việc lúc vào. Kiểm lại khi code: `useUserTasks` fetch trong `useEffect` lúc mount.

---

## 6. Màn hình (G1)

Thư mục `src/components/chon/`, trang `src/pages/ChonPage.jsx`, CSS `src/styles/chon.css` (token `--chon-*` ở đầu file,
tối = giá trị mockup, sáng = "đèn lồng buổi sớm": nền giấy ngà, đèn `#C9781E` đủ tương phản). Workspace pattern như
Knowledge: desktop `100dvh`, header + tab + lọc đứng yên, nội dung cuộn trong, đệm 40px né FAB.

| Mockup | Component | Nội dung |
|---|---|---|
| 2A header | `ChonPage` | Đèn + "Chốn" (Spectral) + "Nơi muốn đến *&* nơi đã qua"; ô tìm (phím `/`); nút **Lưu chốn** (đèn lồng, phím `N`) |
| 2A tab | `ChonPage` | Muốn đến (đếm) · Đã đến (đèn sáng, đếm) · Chuyến đi (G2 — ẩn ở G1, không để tab chết) · Bản đồ (chỉ điện thoại; máy tính bản đồ nằm cột phải) |
| 2A lọc | `ChonFilterBar` | Tất cả · từng loại có đếm · Khu vực ▾ (SearchSelect từ các `area` đã có) · Dịp ▾ · Gần tôi (xin quyền vị trí lần đầu, từ chối thì nút tắt + giải thích). Theo luật chống nhảy của Knowledge: lọc không đổi chiều cao thanh, nút giữ chữ |
| 2A gợi ý cụm | `ChonClusterHint` | từ `nearbyClusters`; "Xem cụm trên bản đồ" |
| 2A thẻ | `ChonPlaceCard` | Hình minh hoạ theo loại + nhãn nền tảng nguồn đầu; nút đèn tròn 40px góc phải (Thắp đèn → mở 2D); loại · khu vực; tên Spectral 21px; trích lời giới thiệu — tác giả; "lưu 3 tuần trước" · khoảng cách (khi có vị trí). Thẻ đã đến: đèn sáng + sao + "Sẽ quay lại". Có hẹn: viên `planBadge`. Menu ⋯ / chuột phải: Sửa · Hẹn ngày · Chỉ đường · Bỏ vào thùng rác (`ActionMenu`) |
| 2A cột phải | `ChonMap` | **theo quyết định #1**. Ghim: muốn đến = viền đèn, đã đến = đèn sáng, cụm = vòng số; lớp Muốn đến / Đã đến / Tất cả; về vị trí tôi; phóng to / thu nhỏ; chú giải. Rê thẻ ↔ sáng ghim |
| 2B | `ChonCaptureSheet` | Bottom sheet (điện thoại) / hộp thoại 560px (máy tính). Thứ tự: **Tên** (autoFocus) · **Loại** (5 ô lớn, chọn một) · **Ở đâu**: khu vực + địa chỉ + ô "Dán link Google Maps" (tự điền toạ độ, tên nếu trống) + vị trí (bản đồ nhỏ kéo ghim nếu có bản đồ) · **Ai giới thiệu**: link (tự nhận nền tảng) + tác giả + trích · **Món nên thử** (chip, Enter để thêm) · **Hợp với** (chip bật/tắt) · Giá / người · Giờ mở. Mục sau "Ở đâu" gập sẵn dưới "Thêm chi tiết" để lưu nhanh 10 giây. Trùng tên + khu vực → thẻ gợi ý gộp. Footer: **Hẹn ngày** · **Lưu vào Muốn đến**. `Ctrl+Enter` lưu, `Esc` đóng (RULES §14). Cũng là form Sửa |
| 2C | `ChonPlaceDetail` | Điện thoại: trang `/chon/:id` toàn màn. Máy tính: ngăn phải 440px trên danh sách. Hình + Back + Sửa + ⋯; viên "Muốn đến · lưu 14/11"; loại · món tiêu biểu; tên 30px; địa chỉ · khoảng cách; viên giờ mở · giá; 3 nút **Chỉ đường · Hẹn ngày · Rủ bạn**; **Ai giới thiệu** (thẻ trích cuộn ngang, "đã gộp N lần lưu", + Thêm lời giới thiệu); **Món nên thử** (chip đếm `dishMentions`); **Gần đây cũng muốn đến** (≤ 3 chốn trong 1 km) + "Gom một tối" (mở bản đồ cụm); **Lịch sử ghé** (khi đã đến: mỗi lần = ngày, sao, trích cảm nhận, chi phí → link sang giao dịch); nút đáy **Thắp đèn · tôi đã đến** (đã đến: "Thắp thêm một lần") |
| 2D | `ChonLightSheet` | Đèn lồng sáng + tên + "Đã đến hôm nay · lần đầu · Đổi ngày" (DatePickerPopover); 5 sao (radiogroup) + `ratingLabel`; Sẽ quay lại / Có thể / Một lần thôi; **Món đã gọi** (chip từ món nên thử, chạm = ngon ♥, + thêm); **Cảm nhận** (textarea) + Thêm ảnh (upload sẵn có) + Đi N người; **Chi phí** (ô tiền dùng lại bộ nhập tiền của Finance) + công tắc "Ghi vào Tài chính · <danh mục>"; "Để sau" đóng không lưu; **Lưu cảm nhận** → `lightPlace`. Hiệu ứng thắp đèn (đèn sáng dần + vài đốm sáng) tắt được bằng Giảm chuyển động |
| — | `ChonEmpty`, `ChonGuest`, `ChonTrash` | Rỗng: một đèn tắt + "Dán một chốn bạn muốn đến"; khách: giới thiệu + đăng nhập; thùng rác theo mẫu `KBTrashView` |

Minh hoạ theo loại: `src/components/chon/ChonKindArt.jsx` (SVG nét sáng như mockup — hình vẽ bằng code nằm trong module,
RULES §16). Icon đèn lồng + các icon loại thêm vào `AppIcon.jsx`.

Điện thoại (≤ 768px): ẩn tab đáy chung như Knowledge (`body.in-chon-workspace`), thanh trên: tìm · Lưu chốn tròn; tab
Muốn đến / Đã đến / Bản đồ ở đáy; thẻ thành hàng ngang gọn (hình 76px + chữ) để thấy nhiều chốn.

---

## 7. Thứ tự làm G1

| Đợt | Việc | Dừng? |
|---|---|---|
| 0 | Migration `places_v6_38_0.sql` (bảng, trigger, RPC, VERIFY). **Bạn chạy** bằng `psql -f` (không reset DB). Cập nhật `DATABASE.md` | Dừng: bạn chạy migration, báo kết quả |
| 1 | `placeLogic.js` + test + `place-kinds.json`; `npm test` | Test fail → dừng báo |
| 2 | `usePlaces.js` | |
| 3 | Route `/chon`, `/chon/:placeId`, Navbar (sidebar + menu Thêm điện thoại), `ROUTE_META`, `ChonPage` vỏ + token `chon.css` + icon | |
| 4 | Thẻ + lọc + tìm + gợi ý cụm (2A, chưa bản đồ) | |
| 5 | `ChonCaptureSheet` (2B) — tạo, sửa, gộp trùng, Hẹn ngày | |
| 6 | `ChonPlaceDetail` (2C) | |
| 7 | `ChonLightSheet` (2D) + RPC + Tài chính | |
| 8 | Liên kết Kiến thức (chọn bài, Viết thành bài), Rủ bạn, Chia sẻ Android (`manifest.json`) | |
| 9 | Bản đồ theo quyết định #1 | |
| 10 | Docs: `DESIGN.md` (mục Chốn), `ARCHITECTURE.md` (route, data flow), `FEATURES.md`, `CHANGELOG.md`; lint các file đã sửa | **Dừng G1** — giao checklist |

Mỗi đợt: `npx eslint <file vừa sửa>`; không `npm run build`; không tự mở trình duyệt kiểm; không commit khi chưa bảo.

---

## 8. File sẽ đụng (G1)

Mới: `supabase/migrations/20261119000000_places_v6_38_0.sql`, `src/utils/placeLogic.js`,
`src/__tests__/core/placeLogic.test.js`, `src/data/place-kinds.json`, `src/hooks/usePlaces.js`, `src/pages/ChonPage.jsx`,
`src/components/chon/*` (~8 file), `src/styles/chon.css`.
Sửa: `src/App.jsx` (route + meta), `src/components/Navbar.jsx`, `src/components/AppIcon.jsx`, `public/manifest.json`,
`package.json` (script test; + `leaflet` nếu chọn), `docs/DATABASE.md`, `docs/ARCHITECTURE.md`, `docs/FEATURES.md`,
`DESIGN.md`, `CHANGELOG.md`. **Không** sửa Finance / Tasks / Knowledge ngoài việc gọi hook sẵn có.

---

## 9. Checklist bạn tự kiểm (sau G1, cần đăng nhập)

1. Chạy migration xong: `/chon` mở được, rỗng thì thấy đèn tắt + lời mời.
2. Lưu chốn chỉ với tên + loại → thẻ hiện ngay ở Muốn đến. Lưu lần 2 cùng tên + khu vực → được gợi ý gộp, gộp xong
   chi tiết hiện "đã gộp 2 lần lưu".
3. Dán link Google Maps đầy đủ → toạ độ tự điền; link rút gọn → thấy lời nhắc.
4. Lọc loại / khu vực / dịp / tìm không dấu ("oc dem") đều ra; thanh lọc không nhảy chiều cao.
5. Gần tôi: trình duyệt hỏi quyền; cho phép → hiện khoảng cách, xếp gần trước; từ chối → nút tắt, có giải thích.
6. Hẹn ngày → bên Nhiệm vụ có việc "Đi <tên>" đúng hạn; xoá việc đó → viên hẹn trên thẻ biến mất.
7. Thắp đèn có chi phí + bật Tài chính → chốn sang Đã đến, Finance có giao dịch đúng số, nơi chi = tên chốn. Tắt công
   tắc → không có giao dịch.
8. Sáng / tối đều đọc được; Giảm chuyển động tắt hiệu ứng thắp đèn.
9. Điện thoại: tab đáy riêng, sheet Lưu chốn vừa màn, Back từ chi tiết về danh sách.
10. Android (PWA đã cài): Chia sẻ một link TikTok → Life Hub → form mở sẵn link.

---

## 10. Ngoài phạm vi G1

- Chuyến đi (2E) — G2, §3.2.
- Tự lấy tiêu đề / ảnh / caption từ link TikTok, FB… (cần API server, quyết định #2).
- Tìm địa chỉ → toạ độ (geocoding) — cần dịch vụ ngoài.
- Hoàn thành task "Đi …" bên Nhiệm vụ tự mở màn thắp đèn.
- Chốn trên Trang chủ (dashboard).
- Chia sẻ chốn công khai / cho bạn bè xem chung.
