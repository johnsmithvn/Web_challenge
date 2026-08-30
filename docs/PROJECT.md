# PROJECT.md — Life Hub

**Version:** v6.2.0 · **Updated:** 2026-08-09

Bản đồ cấp cao của repo. File này chỉ trả lời “cái gì ở đâu”; chi tiết nằm trong tài liệu được trỏ tới.

## Sản phẩm

Life Hub là SPA quản lý cá nhân gồm Inbox, Nhiệm vụ, Knowledge Base, Finance, Focus và
Account Vault mã hóa. Frontend dùng React/Vite; dữ liệu đồng bộ dùng Supabase Auth + PostgreSQL + RLS.

| Layer | Công nghệ / quy ước |
|---|---|
| UI | React 19, Vite 8, React Router 7, vanilla CSS |
| Data | Supabase; dữ liệu theo user được bảo vệ bằng RLS |
| Media | Vercel Functions → Google Drive |
| Editor | Tiptap 3 + Markdown + custom `MediaNode` |
| Deploy | Vercel SPA + serverless functions |
| Client storage | Chỉ preference, UI state, session handoff và cờ migration; không lưu secret Vault |

## Đọc tài liệu nào

| Cần biết | Nguồn chính |
|---|---|
| Cài local, env, database, deploy, production runbook | [`README.md`](../README.md) |
| Route, module, data flow, browser storage | [`docs/ARCHITECTURE.md`](ARCHITECTURE.md) |
| Bảng, quan hệ, RLS, RPC, migration | [`docs/DATABASE.md`](DATABASE.md) |
| Hành vi đang chạy của từng tính năng | [`docs/FEATURES.md`](FEATURES.md) |
| Việc còn mở | [`docs/TASKS.md`](TASKS.md) |
| Thứ tự roadmap | [`docs/PLAN.md`](PLAN.md) |
| Quy tắc làm việc trong repo | [`docs/RULES.md`](RULES.md) |
| Design system | [`DESIGN.md`](../DESIGN.md) |
| Hợp đồng Finance / Vault | [`docs/DESIGN_FINANCE.md`](DESIGN_FINANCE.md) · [`docs/DESIGN_ACCOUNT_VAULT.md`](DESIGN_ACCOUNT_VAULT.md) |
| Lịch sử phiên bản | [`CHANGELOG.md`](../CHANGELOG.md) |

`CHANGELOG.md` là nơi duy nhất giữ lịch sử feature đã xóa. Tài liệu hiện hành không lặp lại các
release block cũ.

## Bản đồ module

| Route | Page | Data owner | Storage / quyền truy cập |
|---|---|---|---|
| `/` | `LandingPage` | — | Public |
| `/tasks` | `TasksPage` | `useUserTasks`, `useActivityLog` | Guest in-memory; đăng nhập để sync và xem lịch sử hoàn thành |
| `/focus` | `FocusPage` | `useFocusTimer`, `useXpStore` | Guest in-memory; đăng nhập để sync |
| `/inbox` | `InboxPage` | `useCollections` | Yêu cầu đăng nhập |
| `/collect` | `CollectPage` | `useCollections`, `useCollectionNotes`, `useTags` | Yêu cầu đăng nhập |
| `/finance`, `/finance/:screen` | `FinancePage` | `useFinance` | Yêu cầu đăng nhập; 10 bảng chính + junction tag |
| `/accounts` | `AccountsPage` | `useAccounts` | Yêu cầu đăng nhập + Vault passphrase |
| `/settings` | `SettingsPage` | `useTags`, `useQuotes`, profile | Yêu cầu đăng nhập |

Các bookmark `/tracker`, `/habits`, `/dashboard`, `/journey` được chuyển về `/tasks`. URL khác không
khớp route sẽ mở Landing Page.

## Luồng dữ liệu quan trọng

- **Task:** thao tác → `useUserTasks` → optimistic state → Supabase khi đã đăng nhập; lỗi ghi sẽ
  rollback. Mọi thay đổi Task đi qua `activity_logs`; hoàn thành/bỏ hoàn thành cộng/trừ XP có dedup.
- **Inbox / Knowledge:** cùng dùng `collections`; Task liên kết Knowledge qua `task_collections`.
- **Finance:** `useFinance` giữ state cho toàn module; báo cáo luôn tính lại từ giao dịch theo kỳ.
  Inbox có thể handoff sang giao dịch/hóa đơn qua `sessionStorage`; giao dịch có thể gắn Task.
- **Vault:** chỉ đọc `vault_config` trước unlock. Passphrase mở DEK trong memory; sau đó mới query và
  giải mã `accounts`. Lock, sign-out, đổi user hoặc reload xóa key/plaintext khỏi state. Ghi cả item
  dùng `updated_at` làm revision chống ghi đè giữa tab/device.
- **Media:** client gửi Supabase JWT tới `api/upload.js`; `api/stream.js` chỉ stream file nằm dưới
  `DRIVE_FOLDER_ID` và hỗ trợ HTTP Range.

## Quy tắc không được phá

1. Không đưa user data hoặc Vault key/passphrase vào `localStorage`.
2. CRUD domain ưu tiên nằm trong hook; giữ các ngoại lệ boundary hiện có của Auth, profile và media
   thay vì tạo thêm đường truy cập Supabase tùy tiện.
3. Mọi bảng user-owned phải bật RLS và kiểm đúng owner ở cả hai phía của junction/FK.
4. Không tự chạy reset/xóa hàng loạt database. Migration production do user chủ động thực hiện.
5. Không sửa snapshot migration timestamp đã tồn tại; thay đổi mới dùng migration mới.
6. Thay đổi hành vi/schema phải cập nhật đúng tài liệu hiện hành và `CHANGELOG.md`.

## Chạy và kiểm tra

```bash
npm install
npm run dev
npm test
npm run lint
```

`npm test` hiện chạy 14 self-check bằng `node:assert`; không dùng Jest/Vitest. Theo workflow repo,
user chạy production build thủ công trừ khi họ yêu cầu agent điều tra lỗi build.

Production Finance v6.0 và Vault v6.2 vẫn là bước **user-run**. Trạng thái và thứ tự thực hiện hiện tại
nằm trong [`docs/TASKS.md`](TASKS.md) và runbook chính xác nằm trong [`README.md`](../README.md).
