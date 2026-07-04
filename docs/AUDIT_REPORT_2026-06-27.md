# Báo Cáo Audit Toàn Diện — Life Hub

> **Ngày:** 2026-06-27 · **Phiên bản:** v4.23.0 · **Phạm vi:** toàn bộ codebase (`src/`, `api/`, `docs/`)
> **Phương pháp:** quét kiến trúc + audit song song 4 chiều (bảo mật / bug / docs / build-health). Các lỗ hổng API đã được xác minh trực tiếp; pha xác minh đối kháng tự động chưa hoàn tất (chạm giới hạn phiên) — xem mục *Giới hạn của báo cáo*.

---

## 1. Tổng quan dự án

**Life Hub** là SPA "hệ điều hành cuộc sống cá nhân" (tiếng Việt), React 19 + Vite 8, backend Supabase, deploy Vercel. ~22.000 dòng JS/JSX, 111 commit, đang ở giai đoạn **trưởng thành/production** (không phải prototype).

**Kiến trúc:** `main.jsx → App.jsx` với cây provider `ThemeProvider > AuthProvider > BrowserRouter > JourneyProvider > AppShell`. 16 route (2 eager: Landing/Tracker; còn lại lazy-load). Dữ liệu đi qua **21 custom hook** (một hook/domain) bọc Supabase, mỗi row gắn `user_id`. Có chế độ **fallback localStorage** khi không cấu hình Supabase.

**Backend không server riêng:** Supabase (chỉ anon/publishable key) + 3 serverless function Vercel:
- `api/upload.js` — proxy upload Google Drive (Service Account).
- `api/stream.js` — proxy stream media Drive (hỗ trợ Range).
- `api/meta.js` — edge function lấy OG metadata từ URL.

**Tiến độ tính năng:** ~21 module sống hoàn chỉnh (Habit Tracker 21 ngày, Tasks, Knowledge Base/Tiptap, Inbox, Finance, Incubator, Journey, Focus, Dashboard, Quiz, Leaderboard…). Module **Team & Friends đã bị bỏ** (route redirect về `/tracker`) nhưng docs vẫn mô tả như còn sống. Subsystem media/audio (Drive proxy) là phần **mới churn nhiều nhất, rủi ro runtime cao nhất**, một phần chưa commit.

**Tình trạng git:** nhiều file đang sửa dở (đa số hook + nhiều component) + untracked `api/stream.js`, `src/utils/logger.js`, `project_analysis.md` → đang giữa một đợt refactor media + thay `console.*` bằng `logger`.

---

## 2. Bảng điểm

| Hạng mục | Trạng thái |
|---|---|
| Build (`npm run build`) | ✅ OK (~438ms). Cảnh báo: chunk TiptapEditor 657 kB |
| Lint (`npm run lint`) | ❌ **143 vấn đề (111 lỗi, 32 cảnh báo)** — sẽ fail CI |
| Bảo mật API | 🔴 **4 vấn đề cao** (endpoint không xác thực + SSRF) |
| Bug logic | 🟠 5 bug cao + nhiều bug trung bình |
| Docs | 🟠 README lệch thực tế nặng (Imgur/R2, sai version, file không tồn tại) |
| Quản lý secret | ✅ Tốt (không lộ service_role; `.env.local` không bị commit) |

**Tổng: 39 phát hiện** — 9 cao · 17 trung bình · 10 thấp · 3 info. *(Chiều "cleanup/tech-debt" chưa chạy xong — xem mục 7.)*

---

## 3. 🔴 BẢO MẬT — ưu tiên cao nhất (đã xác minh trực tiếp)

Cốt lõi: **cả 3 serverless function đều hoàn toàn ẩn danh** — không xác thực, không gắn user, không rate-limit, CORS `*`.

### S1. SSRF trong `api/meta.js` — `[CAO]`
`fetch(url)` với URL người dùng cung cấp, `redirect:'follow'`, chỉ validate `new URL()`. Không chặn scheme, host, dải IP nội bộ. Attacker có thể dùng hạ tầng Vercel để gọi tới dịch vụ nội bộ/host bất kỳ và đọc lại một phần body (title/og:*). Endpoint này **không có caller frontend** → là attack surface "chết nhưng vẫn live".
→ **Xử lý:** xóa endpoint (không ai dùng) HOẶC bắt buộc `https:`, chặn IP private/loopback/link-local/metadata, re-validate sau mỗi redirect, giới hạn kích thước, thêm auth + rate-limit. [api/meta.js:10-38](../api/meta.js#L10-L38)

### S2. Upload ẩn danh vào Google Drive của chủ sở hữu — `[CAO]`
`POST /api/upload` CORS `*`, **không xác thực**. Cả 2 caller frontend cũng không gửi token. Bất kỳ ai cũng upload tối đa 50MB/request vào Drive của bạn (scope `auth/drive` đầy đủ) → cạn quota/chi phí Google, hosting file lậu/malware gán vào tài khoản bạn, không rate-limit.
→ **Xử lý:** xác thực Supabase JWT server-side, từ chối ẩn danh (401); khóa CORS về origin app; rate-limit; hạ scope SA xuống `drive.file`. [api/upload.js:20-46](../api/upload.js#L20-L46)

### S3. Stream proxy mở — đọc **mọi** file Drive mà SA truy cập được (IDOR) — `[CAO]`
`GET /api/stream?id=` không xác thực, dùng SA (`drive.readonly` toàn tài khoản) trả về bytes của **bất kỳ** file id nào. Không kiểm tra file có thuộc `DRIVE_FOLDER_ID`. → IDOR (đoán/liệt kê id để exfil), lạm dụng băng thông/egress, `s-maxage=86400` biến CDN Vercel thành hosting miễn phí cho attacker.
→ **Xử lý:** bắt buộc JWT + kiểm tra file thuộc user (lưu mapping `file_id → owner` lúc upload); khóa CORS; rate-limit; hạ scope SA. [api/stream.js:62-127](../api/stream.js#L62-L127)

### S4. CORS wildcard trên endpoint không xác thực — `[TRUNG BÌNH]`
`Access-Control-Allow-Origin: *` trên upload+stream + không auth → web bất kỳ victim ghé thăm có thể script tấn công deployment của bạn. [api/upload.js:22](../api/upload.js#L22), [api/stream.js:64](../api/stream.js#L64)

### S5. Query injection khi tạo subfolder Drive — `[TRUNG BÌNH]`
`getOrCreateSubfolder()` nội suy thẳng field `folder` (do client kiểm soát) vào query Drive `name='${folderName}'…` không escape. Folder chứa dấu `'` phá query → poison `folderCache`, lỗi/DoS upload.
→ **Xử lý:** whitelist `folder` thành enum cố định (images|audio|video|documents|uploads). [api/upload.js:84-99](../api/upload.js#L84-L99)

### S6. Toàn bộ phân quyền phụ thuộc 100% vào RLS — `[TRUNG BÌNH]`
Mọi truy cập qua anon key ở client. Không có lớp authz server-side → **phải có RLS đúng** (không có file RLS nào trong repo để kiểm chứng). Rủi ro cụ thể: lookup `username → email` trong `signIn` có thể bị **liệt kê email người dùng (PII)** nếu RLS cho phép đọc ẩn danh bảng `profiles`. Filter `.eq('id', user.id)` ở client **không phải** ranh giới bảo mật.
→ **Xử lý:** commit & kiểm tra policy RLS; `profiles.SELECT` không lộ email cho anon; mọi bảng enforce `auth.uid() = owner`. [src/contexts/AuthContext.jsx:104-115](../src/contexts/AuthContext.jsx#L104-L115)

### Mức thấp/info
- **S7.** `dangerouslySetInnerHTML` trong [ContentSections.jsx:135](../src/components/ContentSections.jsx#L135) — hiện an toàn (data tĩnh) nhưng pattern nguy hiểm nếu nội dung chuyển sang DB/người dùng. `[THẤP]`
- **S8.** Render markdown người dùng qua `react-markdown` **an toàn** (không bật `rehype-raw`). Nhưng `@uiw/react-md-editor` kéo theo `rehype-raw` — đừng dùng `MDEditor.Markdown`/`MarkdownPreview` cho nội dung người dùng. `[INFO]`
- **S9.** ✅ Quản lý secret tốt: không lộ service_role, SA chỉ ở server, `.env.local` không bị track. `[INFO]`

---

## 4. 🟠 BUG LOGIC

**Cao (đã xác minh trực tiếp 3 cái đầu):**

| # | Bug | File |
|---|---|---|
| B1 | **Modal hoàn thành 21 ngày không bao giờ hiện**: `useState(() => streak>=21…)` chạy lazy lúc mount khi `streak=0` (load async), không effect nào set lại → dead code | [TrackerPage.jsx:322-330](../src/pages/TrackerPage.jsx#L322-L330) |
| B2 | **useFocusTimer**: interval đếm ngược gọi `handlePhaseEnd()` qua closure **cũ** (deps chỉ `[running,phase]`) → chuyển pha sai / mất dữ liệu session | [useFocusTimer.js:104-194](../src/hooks/useFocusTimer.js#L104-L194) |
| B3 | **useXpStore.removeXp** dùng `.eq('meta', object)` trên cột JSONB (addXp dùng `.contains`) → delete thường khớp 0 row, **XP không bị trừ khi bỏ tick** | [useXpStore.js:155-169](../src/hooks/useXpStore.js#L155-L169) |
| B4 | **TrackerPage.handleHabitTick** tính `allDone`/`removeXp` từ `habitProg` cũ, gọi `removeXp` không có guard `hasMilestone` → desync XP | [TrackerPage.jsx:350-384](../src/pages/TrackerPage.jsx#L350-L384) |
| B5 | **Incubator executeIntention** đánh dấu "executed" cả khi **không tạo được gì** (thiếu estimated_cost / DB fail) → mất intention không khôi phục được | [IncubatorPage.jsx:293-352](../src/pages/IncubatorPage.jsx#L293-L352) |

**Trung bình (chọn lọc):**
- **B6.** `parseCurrencyInput` mất số thập phân: `12.50` → 12500, `100.00` → 100000 (regex `(?=\d{3})` chỉ bỏ dấu khi theo sau đúng 3 số). [currencyUtils.js:43-57](../src/utils/currencyUtils.js#L43-L57) — **xác minh trực tiếp ✓**
- **B7.** `InboxPage.extractAmount` là parser tiền **thứ hai** lệch chuẩn, mis-parse `1.5m`. Nên dùng lại `parseCurrencyInput`. [InboxPage.jsx:28-35](../src/pages/InboxPage.jsx#L28-L35)
- **B8.** `formatDateTime` dùng `toLocaleDateString` (đúng phải là `toLocaleString`) — có thể mất giờ:phút trên một số engine. [dateUtils.js:29-38](../src/utils/dateUtils.js#L29-L38)
- **B9.** `useCollectionNotes.updateNote` không rollback khi DB fail → UI hiện nội dung chưa lưu. [useCollectionNotes.js:66-87](../src/hooks/useCollectionNotes.js#L66-L87)
- **B10.** `useExpenses.updateExpense` rollback bằng snapshot toàn list cũ → đè mutation đồng thời + churn identity callback. [useExpenses.js:90-111](../src/hooks/useExpenses.js#L90-L111)
- **B11.** Query "completed today" dùng cận `T23:59:59` (lt, loại trừ) → mất task hoàn thành ở giây cuối ngày. Nên dùng cận `nextDay T00:00:00`. [useUserTasks.js:70,391](../src/hooks/useUserTasks.js#L70)
- **B12.** `useActivityLog` bound `created_at` theo UTC + group theo UTC date → heatmap/timeline lệch ngày quanh nửa đêm giờ VN (+07). [useActivityLog.js:62-142](../src/hooks/useActivityLog.js#L62-L142)
- **B13.** `JourneyContext` effect thiếu `user.id` trong deps → đổi tài khoản không remount thì không refetch journey. [JourneyContext.jsx:38-68](../src/contexts/JourneyContext.jsx#L38-L68)

**Thấp:** B14 `AuthContext.getSession` không `.catch` (lỗi mạng lúc boot → kẹt màn hình loading); B15 `useCollections` rollback `fetchItems()` không filter → list mất filter; B16 `useRandomPodcast` query `type='podcast'` không có trong enum collections → tính năng chết âm thầm; B17 `useJourney.renewJourney` đóng habit không scope theo journey + không transaction → có thể mất sạch habit khi fail giữa chừng.

**Bonus (tôi tự phát hiện):** `public/sw.js` — `setInterval` trong service worker **không chạy ổn định** khi tab đóng (comment phóng đại khả năng); cờ `notified` chỉ ở RAM → thông báo lặp khi SW restart; chỉ so `HH:MM` **không kiểm tra ngày** → task báo lại mỗi ngày. [public/sw.js:20-50](../public/sw.js#L20-L50)

---

## 5. 🟠 DOCS — sai lệch so với code

- **D1 `[CAO]`** README mô tả storage **Imgur + Cloudflare R2** (kèm env `IMGUR_CLIENT_ID`, `R2_*`) nhưng code **chỉ dùng Google Drive**. Dev mới làm theo README sẽ setup sai backend. [README.md:49-83,242-275](../README.md)
- **D2** README ghi **v4.12.0** (lùi 11 minor so với `package.json` v4.23.0); DATABASE/ARCHITECTURE/RULES ở v4.22.0 (lùi 1). [README.md:1](../README.md)
- **D3** README trỏ tới file **không tồn tại**: `extensions/AudioNode.js`, `hooks/useFileUpload.js` (đã xóa). [README.md:169,173,245](../README.md)
- **D4** `api/stream.js` không được nhắc trong README/ARCHITECTURE/DATABASE. [api/stream.js](../api/stream.js)
- **D5** DATABASE.md mâu thuẫn số bảng: "25" vs "30 active" vs thực tế 28 `CREATE TABLE` vs 27 bảng dùng trong code. [docs/DATABASE.md:6,57,61](DATABASE.md)
- **D6** `mood_logs`/`friendships` được docs khai báo đã xóa nhưng `schema_v4.4.0.sql` vẫn `CREATE` — file "source of truth" không phản ánh trạng thái hiện tại. [docs/DATABASE.md:112,180](DATABASE.md)
- **D7-D10 `[THẤP]`** README thiếu migration `v4.14.0_collection_types` trong bước cài đặt; README ghi "Tiptap v2" (thực tế v3); checklist Supabase Setup chỉ bảo chạy master schema mà bỏ các migration sau.

---

## 6. 🟡 BUILD / SỨC KHỎE DỰ ÁN

- **H1 `[CAO]`** Lint fail **143 vấn đề (111 lỗi)** — sẽ chặn mọi CI gate. Cụm chính:
  - `no-unused-vars` (49) — riêng TrackerPage:288-289 có 5 biến stats không dùng (gợi ý UI nối dở).
  - `react-hooks/set-state-in-effect` (19).
  - `no-undef` (12) — **ưu tiên**: tham chiếu biến chưa định nghĩa → có thể `ReferenceError` runtime.
  - `react-hooks/exhaustive-deps` (31 cảnh báo) — che giấu stale-closure (liên quan B2/B13).
  - `react-refresh/only-export-components` (7), `no-useless-escape` (4, [mediaUtils.js:35](../src/utils/mediaUtils.js#L35)).
- **H2** Build OK; chunk `TiptapEditor` 657 kB (gzip 203) > ngưỡng 500 kB → cân nhắc code-split.
- **H3** `package.json`: kiểm tra lại **`lucide-react ^1.11.0`** (thư viện này thường ở dải 0.x — nghi ngờ sai package/resolution); xác nhận tương thích Vite 8 / plugin-react 6.

---

## 7. ⚠️ Giới hạn của báo cáo này

1. **Chiều "Cleanup / Tech-debt" chưa hoàn tất** (agent chạm giới hạn phiên). Mới ghi nhận một phần qua quan sát: file quá lớn cần tách (CollectPage 1777 dòng, TrackerPage 1137, IncubatorPage 975, InboxPage 884, TaskListSection 783); lạm dụng inline style; logic streak bị nhân đôi giữa `useHabitStore` và TrackerPage; `project_analysis.md` (untracked) nên cân nhắc gitignore hoặc đưa vào `docs/`.
2. **Pha xác minh đối kháng tự động chưa chạy** (giới hạn phiên). Tuy nhiên: **toàn bộ phát hiện bảo mật + 4 bug (B1, B3, B6 và các API) đã được tôi đọc & xác nhận trực tiếp**. Các bug còn lại có độ tin cậy cao nhưng nên review trước khi sửa.

---

## 8. Khuyến nghị thứ tự ưu tiên

1. **Khẩn (bảo mật):** thêm xác thực + rate-limit cho `api/upload.js` & `api/stream.js`, kiểm tra ownership file; xóa hoặc hardening `api/meta.js`; khóa CORS; whitelist `folder`. **Kiểm tra & commit RLS policy** Supabase, đặc biệt `profiles` (lộ email).
2. **Cao (bug ảnh hưởng người dùng):** sửa B1 (modal hoàn thành), B3+B4 (desync XP), B2 (focus timer), B5 (mất intention), B6 (parse tiền sai 1000×).
3. **Trung bình:** dọn lint (ưu tiên 12 `no-undef`), thống nhất parser tiền, sửa biên ngày/timezone (B11/B12), rollback thiếu (B9/B10), fix `sw.js`.
4. **Docs:** viết lại README (Drive thay Imgur/R2, version 4.23.0, bỏ file không tồn tại, thêm `api/stream.js`); đồng bộ DATABASE.md.
5. **Dọn dẹp:** tách các page khổng lồ, gỡ Team/Friends khỏi docs, chạy lại audit chiều cleanup sau 17:40.
