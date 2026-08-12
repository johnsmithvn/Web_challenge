# FEATURES.md — Life Hub

**Version:** v6.3.0 · **Updated:** 2026-08-11

Tài liệu này chỉ mô tả tính năng đang chạy. Feature đã xóa và chi tiết release nằm trong
[`CHANGELOG.md`](../CHANGELOG.md).

## Tổng quan truy cập

| Module | Route | Guest | Đăng nhập |
|---|---|:---:|:---:|
| Landing | `/` | ✅ | ✅ |
| Nhiệm vụ | `/tasks` | List in-memory | Full sync + lịch sử/lịch tháng |
| Focus | `/focus` | In-memory | Sync session + XP |
| Inbox | `/inbox` | — | ✅ |
| Knowledge | `/collect` | — | ✅ |
| Finance | `/finance/:screen?` | — | ✅ |
| Incubator | `/incubator` | — | ✅ |
| Vault | `/accounts` | — | Login + Vault unlock |
| Cài đặt | `/settings` | — | ✅ |

## 1. App shell, Auth và Onboarding

**Files:** `src/App.jsx`, `src/contexts/AuthContext.jsx`, `src/components/AuthModal.jsx`,
`src/components/Navbar.jsx`, `src/components/OnboardingModal.jsx`

- Email/password và Google OAuth qua Supabase Auth.
- Đăng nhập bằng username dùng RPC lookup email; kiểm tra username/email tồn tại cũng đi qua RPC.
- Navbar có sidebar desktop, topbar + bottom tabs mobile, user menu, XP bar và cảnh báo Finance.
- Landing là entry public; page khác lazy-load với `Suspense` và `ErrorBoundary`.
- Onboarding ba bước giải thích Inbox → phân loại → xử lý trong module phù hợp. Cờ đã xem nằm ở
  `vl_onboarded`; onboarding không phải route guard.
- Thiếu Supabase env sẽ tắt Auth thật. Task list và Focus vẫn dùng được in-memory; các module auth-only
  hiện cổng đăng nhập thay vì giả lập dữ liệu.

## 2. Nhiệm vụ (`/tasks`)

**Files:** `src/pages/TasksPage.jsx`, `src/components/TaskListSection.jsx`,
`src/components/TaskDetailModal.jsx`, `src/components/MonthCalendar.jsx`,
`src/hooks/useUserTasks.js`, `src/hooks/useActivityLog.js`

### Danh sách

- Chia Task chưa xong thành Quá hạn, Hôm nay và Sắp tới; sắp theo ngày/giờ/priority.
- Tạo và sửa title, description, due date/time, priority, recurrence, tag và liên kết Knowledge.
- Hoàn thành dùng optimistic state; write lỗi rollback cả danh sách đang làm và khối đã hoàn thành.
- Khối Đã hoàn thành lọc theo khoảng ngày với preset; có thể bỏ hoàn thành hoặc xóa.
- Guest có Task in-memory và mất khi reload. Đăng nhập mới sync Supabase, activity log, tag/link và XP.

### Lặp lại, lịch và thông báo

- Recurrence hỗ trợ interval/weekly/monthly; occurrence kế tiếp chỉ sinh sau khi hoàn thành occurrence
  hiện tại và giữ recurrence chain.
- Lịch tháng hiển thị Task pending + completed, ngày âm và holiday từ `holidays.json`. Ô ngày giới hạn
  số chip theo sức chứa; phần dư hiện `+N nữa…`; panel ngày cho xem chi tiết.
- Service worker nhận snapshot Task từ tab và có thể hiện thông báo khi còn được browser đánh thức.
  Không bảo đảm timer chạy mỗi phút khi tab đóng vì browser có quyền suspend service worker.

### Detail, lịch sử và XP

- Detail modal cho xem/sửa Task, activity field-diff và note cá nhân.
- `activity_logs` gắn `task_id`; xóa Task cascade lịch sử. Note sửa được, field-diff không sửa.
- Hoàn thành qua `completeTask` cộng `+10 XP` có dedup; bỏ hoàn thành xóa event tương ứng.
- “Quick Done” từ Inbox tạo thẳng một Task `completed=true`, rồi xóa Inbox item. Luồng này ghi
  `task_created`; nó không đi qua `completeTask`, nên không phát `task_completed` hoặc cộng `+10 XP`.

**Data:** `user_tasks`, `task_collections`, `task_tags`, `activity_logs`, `xp_logs`.

## 3. Focus và XP (`/focus`)

**Files:** `src/pages/FocusPage.jsx`, `src/components/FocusTimer.jsx`,
`src/hooks/useFocusTimer.js`, `src/hooks/useXpStore.js`

- Pomodoro focus/break, pause/resume/reset và tùy chỉnh thời lượng.
- Lưu session hoàn thành, thống kê phút hôm nay và danh sách session gần đây.
- Guest giữ session/XP trong memory; khi đăng nhập dùng `focus_sessions` và `xp_logs`.
- Session Focus hoàn thành cộng `+15 XP`, dedup theo session id.
- Setting timer nằm ở `vl_focus_settings`; không còn liên kết Habit/Journey.

## 4. Inbox (`/inbox`)

**Files:** `src/pages/InboxPage.jsx`, `src/hooks/useCollections.js`, `src/components/QuickCapture.jsx`

- Quick capture toàn app và form nhập nhanh trong Inbox.
- Search, chọn nhiều, snooze, archive/delete và mở detail để sửa nội dung.
- Phân loại item sang bảy loại Knowledge hiện hành.
- Chuyển thành Task pending hoặc completed; chuyển sang Finance transaction/hóa đơn bằng handoff một
  lần trong `sessionStorage`.
- Khi Finance ghi thành công, item Inbox nguồn được xóa. `inbox_item_id` vì vậy là provenance tạm;
  FK `ON DELETE SET NULL` không giữ link bền sau conversion.
- Trang yêu cầu đăng nhập; không có guest fallback cho `collections`.

**Data:** `collections`; handoff tạm: `lh_inbox_to_finance`.

## 5. Knowledge Base (`/collect`)

**Files:** `src/pages/CollectPage.jsx`, `src/components/TiptapEditor.jsx`,
`src/components/SlashCommand.jsx`, `src/extensions/MediaNode.jsx`,
`src/hooks/useCollections.js`, `src/hooks/useCollectionNotes.js`

- Bảy loại: Ghi chú, Trích dẫn, Học, Ý tưởng, AI, Giải trí, Podcast; có view All.
- List/card, search, type/tag/task filter, archive, reader view và editor view.
- Hai chế độ editor: Markdown portable và Tiptap rich text; preference nằm ở `kb_editor_mode`.
- Tiptap có formatting, table, task list, slash menu 15 lệnh và keyboard shortcut panel.
- Media toolbar/slash có Image, YouTube và Audio. Drive/video URL vẫn được nhận diện/render qua media
  layer; không có nút Video riêng trong toolbar/slash.
- Upload image/audio/file yêu cầu Supabase access token và đi qua `api/upload.js`.
- Sub-note theo bài; Task ↔ Knowledge M:N; tag nằm ở junction trung tâm.
- QuoteWidget hiện ở Inbox và Knowledge; có quote hệ thống từ JSON và quote cá nhân từ Supabase.

**Data:** `collections`, `collection_notes`, `collection_tags`, `task_collections`,
`inspirational_quotes`.

## 6. Tags và Cài đặt (`/settings`)

**Files:** `src/pages/SettingsPage.jsx`, `src/hooks/useTags.js`, `src/hooks/useQuotes.js`

- Tag manager: tạo, đổi tên/màu, xem usage breakdown và xóa link có xác nhận.
- Tag plaintext dùng cho Knowledge, Task và Finance transaction qua ba junction riêng để giữ FK.
- Vault tag là ngoại lệ: nằm trong ciphertext và chỉ có sau unlock.
- Quote manager: CRUD quote cá nhân, bật/tắt; quote hệ thống chỉ đọc từ `quotes.json`.
- Profile: avatar, username, display name, email và bio với validation.

**Data:** `tags`, `collection_tags`, `task_tags`, `finance_transaction_tags`,
`inspirational_quotes`, `profiles`.

## 7. Incubator (`/incubator`)

**Files:** `src/pages/IncubatorPage.jsx`, `src/hooks/useIntentions.js`

- Lưu ý định “someday/maybe” với lý do ban đầu, mô tả, chi phí và thời gian dự kiến.
- Defer bắt buộc ghi lý do; lifecycle và timeline nằm trong `intention_logs`.
- Execute có thể tạo Task và/hoặc Finance expense. Nếu không output nào tạo thành công, intention không
  bị đánh dấu executed để tránh mất dữ liệu âm thầm.
- Abandon chuyển vào khu Đã bỏ qua; item có thể restore hoặc xóa vĩnh viễn có xác nhận.
- Yêu cầu đăng nhập.

**Data:** `intentions`, `intention_logs`, cộng output ở `user_tasks`/`finance_transactions`.

## 8. Finance (`/finance`)

**Files:** `src/pages/FinancePage.jsx`, `src/components/finance/*`, `src/hooks/useFinance.js`,
`src/utils/financeLogic.js`, `src/data/finance-categories.json`

Finance không cố tính “tôi còn bao nhiêu tiền”. Mọi báo cáo được tính lại từ transaction theo kỳ; thu
nhập không tự trở thành mẫu số ngân sách.

### Điều hướng

- `overview`: Tổng quan; query `view=budget|stats` mở Ngân sách hoặc Thống kê.
- `add`: nhập nhanh bằng form, câu tự nhiên hoặc shortcut.
- `list`: tìm/lọc/nhóm transaction, sửa/xóa, CSV export.
- `cats`: taxonomy chi/thu và override label/màu/icon/subcategory.
- `recurring`: hóa đơn, thu định kỳ, khoản vay và thẻ.

### Hành vi chính

- Transaction type: expense, income, saving; số tiền dương; source/category/reference được constraint.
- Hóa đơn fixed/ask, skip period, kỳ trả; thu định kỳ không mang trạng thái “quá hạn”.
- Khoản vay tách gốc/lãi; thẻ tách ngày chốt/đến hạn và sao kê; RPC chặn trả vượt/trùng kỳ.
- Quỹ tiết kiệm có nhiều nơi gửi, đáo hạn, lock soft/term/external và yêu cầu rút term chờ 48 giờ.
- Budget theo nhóm chi; 50/30/20 tính trên tổng hạn mức user đặt, không trên income.
- Transaction có thể gắn Task bằng `task_id`; UI hiện cho chọn/cập nhật liên kết, chưa có màn tổng chi
  theo Task hoặc điều hướng mở Task từ Finance.
- Inbox conversion có thể prefill transaction/hóa đơn; sau khi source Inbox bị xóa, reference được
  set null như mô tả ở phần Inbox.
- Module auth-only; không có Finance guest mode.

**Data:** 10 bảng `finance_*` chính + `finance_transaction_tags`. Schema chi tiết ở
[`DATABASE.md`](DATABASE.md), hợp đồng sản phẩm ở [`DESIGN_FINANCE.md`](DESIGN_FINANCE.md).

## 9. Account Vault (`/accounts`)

**Files:** `src/pages/AccountsPage.jsx`, `src/components/AccountDetail.jsx`,
`src/components/AccountAvatar.jsx`, `src/hooks/useAccounts.js`, `src/utils/vaultCrypto.js`,
`src/utils/vaultLogic.js`, `src/data/account-templates.json`

### Mã hóa và khóa

- Mỗi item là một JSON AES-256-GCM gồm title, template, favorite, note, tag, field, auth method,
  recovery code, link và history.
- Passphrase Vault riêng, tối thiểu 12 ký tự. PBKDF2-SHA256 600.000 vòng tạo KEK; KEK mở DEK ngẫu
  nhiên của user. Server chỉ giữ KDF metadata và DEK đã wrap.
- DEK chỉ ở memory. Lock, sign-out, đổi user hoặc reload xóa key/plaintext khỏi React state.
- Chỉ query item sau unlock. Sai passphrase/config lỗi fail-closed; item ciphertext hỏng bị bỏ qua và
  báo số lượng, không tự sửa/xóa.
- Update/delete dùng `updated_at` làm revision để chặn ghi đè giữa tab/device.

### Dữ liệu và UI

- 9 template và 10 field type; password/secret che mặc định, có reveal/copy và password generator
  dùng Web Crypto CSPRNG. `Website login` + `Platform account` đã gộp thành một loại `Account` ở
  v6.3.0 — hai loại đó cùng hình dạng dữ liệu, tách ra chỉ làm chip filter mất nghĩa.
- Field sắp xếp được bằng kéo thả (handle bên trái) hoặc nút mũi tên; thứ tự nằm trong encrypted
  payload. Đổi Type của item ngay trong chế độ Edit — không thêm/bớt field nào.
- Sign-in method, primary state, one-time recovery code, paste import, encrypted history/diff log.
- Search/filter chỉ chạy client-side sau decrypt. Vault tag không đi qua bảng `tags`.
- Link item là pointer trong encrypted JSON; target đã xóa hiển thị “Missing item”.
- Bố cục hai pane, chuyển thành list/detail một cột ở container hẹp.
- **Logo item do user tự chọn, lưu mã hoá, KHÔNG gọi mạng.** Edit → `Choose a logo` → ảnh được vẽ lại
  qua canvas thành PNG 48×48 rồi lưu dạng data URI trong encrypted payload (cap 16 KB ở `cleanItem`).
  Item chưa đặt logo thì hiện plate màu + chữ cái đầu — trạng thái bình thường, không phải lỗi.
  - Vẽ lại qua canvas nên không giữ byte nào của file gốc → script trong SVG / EXIF bay hết. **Bước thu
    nhỏ đồng thời là bước diệt trùng**, vì thế không bao giờ lưu bytes gốc.
  - v6.3.0 trở về trước lấy favicon trực tiếp từ origin dịch vụ, gác sau nút `Logos`. **Đã xoá hẳn**
    (`faviconCandidates`, `itemUrl`, toggle): mỗi lần mở vault là N request tới N domain, tức chính các
    domain đó biết IP này vừa mở vault có tài khoản của họ; và item không có field URL thì không bao giờ
    có logo. Không dùng aggregator (google.com/s2, DuckDuckGo, Clearbit) — gửi danh sách domain cho một
    bên thứ ba là tự khai user dùng ngân hàng nào, sàn nào.
- Logo nằm trong payload, **không** ở Supabase Storage hay Drive: URL công khai ở hai chỗ đó phá đúng
  mô hình threat vừa nói. Đổi lại chịu base64 hai lần (~4 KB/item; 50 item = 200 KB mỗi lần unlock).

**Data:** `accounts` ciphertext + `vault_config`. Không có guest mode.

**Giới hạn:** chưa có export/restore, recovery/reset passphrase cho dữ liệu cũ, đổi passphrase, rotate
DEK, inactivity auto-lock, clipboard auto-clear hoặc TOTP generator. Không dùng Vault làm bản sao duy
nhất của secret quan trọng. Chi tiết: [`DESIGN_ACCOUNT_VAULT.md`](DESIGN_ACCOUNT_VAULT.md).

## 10. Media, widget và PWA

- `api/upload.js`: authenticated multipart upload vào Google Drive folder đã cấu hình.
- `api/stream.js`: folder-scoped readonly proxy, hỗ trợ HTTP Range/seek cho media.
- `GlobalAudioPlayer`: tiếp tục phát khi đổi page; `CustomAudioPlayer` dùng cho audio inline.
- `SubAlert`: sidebar cảnh báo hóa đơn/thẻ tới hạn; tự ẩn khi không có data hoặc chưa login.
- `QuoteWidget`: quote theo ngày + shuffle + audio khi có URL.
- Manifest + service worker cung cấp install metadata/cache cơ bản và Task notification best-effort.

## Routes cũ

| Route | Hành vi hiện tại |
|---|---|
| `/tracker` | Redirect `/tasks` |
| `/habits` | Redirect `/tasks` |
| `/dashboard` | Redirect `/tasks` |
| `/journey` | Redirect `/tasks` |

Habit, Journey, Dashboard, Quiz, Leaderboard, Life Log, Team/Friends và Finance legacy không còn là
feature hiện hành. Muốn xem lý do/thời điểm xóa, đọc `CHANGELOG.md`; không khôi phục bằng cách chạy lại
SQL/file lịch sử riêng lẻ.
