# ARCHITECTURE.md — Life Hub

**Version:** v6.2.0 · **Updated:** 2026-08-09

## Tổng quan

Life Hub là một React SPA. `LandingPage` nằm trong entry chunk; tám page còn lại được lazy-load.
Supabase cung cấp Auth, PostgreSQL và RLS. Frontend hiện dùng fetch + optimistic state, không đăng ký
`postgres_changes`; publication Realtime của schema không đồng nghĩa app đang subscribe realtime.

```text
ThemeProvider
└─ ToastProvider
   └─ AuthProvider
      └─ BrowserRouter
         └─ AppShell
            ├─ PageMeta + OnboardingModal
            ├─ Navbar + QuickCapture + GlobalAudioPlayer
            └─ ErrorBoundary → Suspense → Routes
```

## Cấu trúc repo

```text
src/
├─ App.jsx             route, shell, provider wiring
├─ pages/              một page theo route
├─ components/         UI dùng lại; components/finance chứa các màn Finance
├─ hooks/              state + Supabase/domain actions
├─ contexts/           Auth, Theme, Toast
├─ utils/              logic thuần, gồm Finance/Task/Vault crypto
├─ data/               JSON tĩnh: taxonomy, template, holiday, quote, UI copy
├─ styles/             CSS theo domain; global.css giữ token chung
├─ extensions/         Tiptap MediaNode
├─ lib/supabase.js     Supabase singleton + graceful disabled mode
└─ __tests__/          self-check node:assert

api/                   Vercel Functions cho upload/stream Google Drive
data/                  SQL dùng cho fresh install/production handoff
supabase/migrations/   snapshot migration timestamp cho local
public/                manifest, service worker, icon
docs/                  tài liệu hiện hành
```

Không đóng đinh số lượng file trong tài liệu: danh sách file thật trong repo là nguồn đúng hơn và
không bị stale khi thêm/xóa component.

## Routes và quyền truy cập

| Path | Page | Load | Chế độ dữ liệu |
|---|---|---|---|
| `/` | `LandingPage` | Eager | Public |
| `/tasks` | `TasksPage` | Lazy | List guest in-memory; sync/lịch sử hoàn thành cần login |
| `/focus` | `FocusPage` | Lazy | Guest in-memory hoặc Supabase khi login |
| `/inbox` | `InboxPage` | Lazy | Auth-only |
| `/collect` | `CollectPage` | Lazy | Auth-only |
| `/finance`, `/finance/:screen` | `FinancePage` | Lazy | Auth-only |
| `/incubator` | `IncubatorPage` | Lazy | Auth-only |
| `/accounts` | `AccountsPage` | Lazy | Auth-only + Vault unlock |
| `/settings` | `SettingsPage` | Lazy | Auth-only |
| `/tracker`, `/habits`, `/dashboard`, `/journey` | redirect `/tasks` | — | Bookmark cũ |
| `*` | `LandingPage` | — | Catch-all |

Finance screen hợp lệ: `overview`, `add`, `list`, `cats`, `recurring`. Ngân sách và Thống kê là view
của `overview`, điều khiển bằng query string.

## Mô hình dữ liệu phía client

Không có một “dual-mode” áp dụng cho mọi hook.

| Nhóm | Khi guest | Khi đăng nhập |
|---|---|---|
| Task list | State in-memory, mất khi reload | `user_tasks` + quan hệ/log/XP trên Supabase |
| Focus + XP | State in-memory | `focus_sessions`, `xp_logs` |
| Inbox / Knowledge / Tags / Quotes | Không cho thao tác dữ liệu | Supabase |
| Finance / Incubator | Không cho thao tác dữ liệu | Supabase |
| Vault | Không khả dụng | Supabase ciphertext; phải unlock client-side |

Các hook CRUD thường làm optimistic update rồi rollback khi write lỗi. Không áp dụng giả định này cho
mọi thao tác: Finance RPC, Vault CAS và các flow nhiều bảng tuân theo hợp đồng riêng của domain.

## Data flow theo domain

### Task

```text
TaskListSection / MonthCalendar
        ↓
useUserTasks
  ├─ user_tasks
  ├─ task_tags / task_collections
  ├─ activity_logs qua useActivityLog
  └─ xp_logs qua useXpStore
```

- Task lặp chỉ sinh occurrence kế tiếp sau khi occurrence hiện tại hoàn thành.
- `completed_at` do một action tạo và dùng nhất quán cho pending/completed state.
- Activity diff và note gắn FK thật vào `task_id`; xóa Task sẽ cascade log.

### Inbox và Knowledge

`collections` chứa cả Inbox và Knowledge; `type`/`status` phân nhánh UI. `collection_tags` và
`task_collections` giữ tag/link M:N. `collection_notes` là sub-note của bài Knowledge.

Inbox có hai handoff sang Finance qua `sessionStorage`: giao dịch (`kind=tx`) và hóa đơn/quy tắc
(`kind=out`). Handoff chỉ là dữ liệu tạm của thao tác điều hướng, không phải nguồn dữ liệu bền.

### Finance

`useFinance` là data owner duy nhất cho module và fetch state nhiều bảng một lần. UI lọc/tính báo cáo
phía client bằng `financeLogic`; RPC database xử lý các write nguyên khối như trả hóa đơn, nhận thu,
trả vay/thẻ và chuyển tiền tiết kiệm. Không có balance tổng lưu sẵn.

### Vault

```text
Supabase Auth
  → load vault_config only
  → passphrase + PBKDF2 derive KEK
  → unwrap DEK vào memory
  → query accounts ciphertext
  → AES-GCM decrypt trong browser
```

- Một item = một encrypted JSON; Supabase không đọc được nội dung user nhập.
- Epoch/sequence guard chặn response cũ đưa plaintext trở lại sau lock, sign-out hoặc đổi user.
- Update/delete so `updated_at`; zero-row là conflict, không ghi đè bản mới hơn.
- Favicon service mặc định tắt và chỉ bật trong phiên unlock hiện tại; lựa chọn này không persist.

Chi tiết mật mã: [`DESIGN_ACCOUNT_VAULT.md`](DESIGN_ACCOUNT_VAULT.md).

### Media

`UrlInputPopover`/Tiptap gửi multipart cùng Supabase access token tới `api/upload.js`. Function xác
thực user, upload vào thư mục Drive được cấu hình và trả URL. `api/stream.js` xác minh file thuộc
`DRIVE_FOLDER_ID`, lấy token readonly và proxy Range/seek. Hai function dùng rate limit in-memory theo
instance; đây không phải quota phân tán toàn hệ thống.

## Browser storage đang dùng

### `localStorage`

| Key | Nội dung |
|---|---|
| `vl_theme` | light/dark preference |
| `vl_onboarded` | đã đóng onboarding |
| `vl_focus_settings` | thời lượng Focus/break |
| `vl_xp_store` | dữ liệu XP legacy chỉ để migrate rồi xóa |
| `vl_xp_migrated` | cờ migration XP theo user |
| `kb_editor_mode` | Markdown/Tiptap preference |
| `lh_usd_rate`, `lh_auto_k` | preference nhập/đổi tiền |
| `lh_finance_saving_as_expense` | preference báo cáo Finance |

### `sessionStorage`

| Key | Nội dung |
|---|---|
| `lh_finance_period` | kỳ Finance đang xem |
| `lh_inbox_to_finance` | payload handoff một lần từ Inbox |

Các prefix cũ được giữ để không làm mất preference. Key mới nên dùng `vl_`, nhưng không rename key
đang tồn tại chỉ để đẹp convention. Không key nào được chứa Vault passphrase, KEK, DEK hoặc decrypted
Vault item.

## Supabase và security boundary

- Mọi bảng user-owned bật RLS; junction kiểm ownership cả entity lẫn tag/đích liên kết.
- `profiles` chỉ đọc/sửa row chính mình. Ba RPC Auth (`login_email`, `username_exists`, `email_exists`)
  là boundary có chủ ý cho lookup trước đăng nhập.
- `tagged_items` dùng `security_invoker=true`; Vault tag không tham gia view vì nằm trong ciphertext.
- `vault_config` chỉ cấp SELECT/INSERT cho authenticated ở v6.2; app không có đường update/delete config.
- Component thường nhận props và gọi hook, nhưng repo có boundary component gọi trực tiếp Auth/profile,
  media upload hoặc query nhỏ. Không mở rộng ngoại lệ nếu logic đã có data owner phù hợp.

Schema và thứ tự cài đặt: [`DATABASE.md`](DATABASE.md) và [`README.md`](../README.md).

## Error, loading và performance

- `React.lazy` + `Suspense` tách page chunk; `ErrorBoundary` giữ lỗi render không biến thành trang trắng.
- Hook phải phân biệt loading/empty/error và không commit response của user/session cũ.
- Retry/loop luôn có giới hạn. Không thêm retry nếu operation không idempotent hoặc không có cách phân
  biệt write đã thành công.
- Static content lặp lại nằm trong `src/data`; logic nghiệp vụ có edge case nằm trong pure util và có
  self-check nhỏ.

## Quyết định hiện tại

- Production database không được tự động push/link/reset từ agent.
- Snapshot trong `supabase/migrations` là bất biến; schema mới dùng migration timestamp mới.
- `data/schema_v4.24.0.sql` là baseline lịch sử đến v5.0, không phải toàn bộ schema v6.2 đứng riêng.
- Source of truth cho lịch sử là `CHANGELOG.md`; kiến trúc hiện hành không giữ section gạch ngang của
  feature đã xóa.
