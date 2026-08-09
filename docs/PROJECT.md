# PROJECT.md — Life Hub

**Bản đồ cấp cao của repo.** Chỉ trả lời "cái gì ở đâu" và "đọc file nào tiếp".
Chi tiết nằm ở các file được trỏ tới — cố tình KHÔNG lặp lại ở đây.

**Version:** v6.2.0 · **Updated:** 2026-08-09

---

## 1. Là cái gì

SPA "Personal Life OS": Inbox, Nhiệm vụ, Knowledge Base, Finance, Incubator, Focus và Account
Vault mã hóa. Phần lớn module có **guest mode** in-memory; Finance và Vault yêu cầu đăng nhập.

| Layer | Chọn gì |
|-------|---------|
| UI | React 19 + Vite 8, vanilla CSS (CSS variables + glassmorphism), không Tailwind |
| Routing | React Router v7, page theo domain và lazy-load |
| Data | Supabase (PostgreSQL + Auth + Realtime), RLS own-row |
| Serverless | 2 Vercel function: `api/upload.js`, `api/stream.js` (Google Drive) |
| Editor | Tiptap 3 + slash command + custom `MediaNode` |
| Hosting | Vercel (`vercel.json` SPA rewrite) |
| localStorage | UI flag/preference, prefix `vl_`. User data **không** được vào đây. v5.0.0: không còn ngoại lệ legacy nào (Life Journey đã gỡ) |

---

## 2. Đọc file nào

| Cần biết | File |
|----------|------|
| Bảng, cột, RLS, RPC, XP, migration | `docs/DATABASE.md` → thứ tự chạy thực tế ở `README.md` |
| Từng tính năng làm gì, tính năng nào đã bỏ | `docs/FEATURES.md` (cuối file là Archived) |
| Thư mục, data flow, localStorage key, quyết định kiến trúc | `docs/ARCHITECTURE.md` |
| Quy tắc cho AI agent / dev (scope, versioning, doc sync) | `docs/RULES.md` |
| Design token, component pattern, responsive, theme | `DESIGN.md` |
| Backlog + trạng thái task | `docs/TASKS.md` · roadmap: `docs/PLAN.md` |
| Lịch sử thay đổi theo version | `CHANGELOG.md` |
| Vấn đề bảo mật/logic đã audit | `docs/AUDIT_REPORT_2026-06-27.md` |
| Cách chạy từ máy trắng | `README.md` |

---

## 3. Bản đồ module

Mỗi route = 1 page trong `src/pages/`. Hook chứa toàn bộ logic Supabase; component chỉ nhận props.

| Route | Page | Hook chính | Bảng chính |
|-------|------|-----------|-----------|
| `/` | LandingPage | — | — |
| `/focus` | FocusPage | useFocusTimer | focus_sessions, xp_logs |
| `/inbox` | InboxPage | useCollections, useUserTasks, useIntentions | collections (type=inbox), user_tasks, intentions; handoff sang Finance qua sessionStorage |
| `/tasks` | TasksPage (2 view: Danh sách / Lịch) | useUserTasks, useCollections | user_tasks, task_collections |
| `/collect` | CollectPage | useCollections, useCollectionNotes, useTags | collections, collection_notes, collection_tags |
| `/finance`, `/finance/:screen` | FinancePage | useFinance | 10 bảng `finance_*` + finance_transaction_tags |
| `/incubator` | IncubatorPage | useIntentions | intentions, intention_logs |
| `/accounts` | AccountsPage | useAccounts | accounts (ciphertext) + vault_config (wrapped DEK) |
| `/settings` | SettingsPage | useTags, useQuotes | tags, inspirational_quotes |
| `/tracker`, `/habits`, `/dashboard`, `/journey` | redirect `/tasks` (route đã gỡ v5.0.0) | — | — |

Xuyên suốt mọi trang: `Navbar`, `QuickCapture` (nút [+] → `collections`),
`GlobalAudioPlayer`, `ErrorBoundary`, `XpBar`, `ConfirmModal`, `GenericModal`, `CustomSelect`.

---

## 4. Data flow

```
User action → hook → isAuthenticated ? Supabase (optimistic + rollback khi lỗi)
                                     : state in-memory
           → setState → re-render
```

- Ghi XP: append vào `xp_logs`, luôn dedup bằng `hasMilestone(reason, meta)` trước khi `addXp`.
  Tổng XP tính runtime = `SUM(amount)`.
- Lịch sử Task: `useActivityLog` ghi `activity_logs` (field-diff + ghi chú) → tab Hoạt động/Ghi chú của Task Detail. Life Log/heatmap đã gỡ ở v5.0.0.
- Cross-user (leaderboard, login bằng username): **chỉ** qua RPC `SECURITY DEFINER`,
  vì từ v4.24.0 `profiles` chỉ đọc được hàng của chính mình.
- Vault: login → chỉ tải `vault_config` → user nhập passphrase → Web Crypto mở DEK trong memory →
  query/decrypt `accounts`. Lock/sign-out/reload xóa key + plaintext state; mọi write mã hóa lại
  toàn item và dùng `updated_at` làm revision chống ghi đè giữa hai tab.

---

## 5. Luật không được phá

1. Không đặt user data vào localStorage. Chỉ UI flag/settings, prefix `vl_`. v5.0.0: **không còn ngoại lệ nào** — 2 key legacy của Life Journey đã hết hiệu lực khi feature bị gỡ.
2. Component không gọi `supabase` trực tiếp. v5.0.0: ngoại lệ duy nhất (FocusBreakdown trong DashboardPage) đã biến mất cùng trang đó — quy tắc giờ không có ngoại lệ.
3. Content tĩnh (>3 item cùng schema) phải ra `src/data/<feature>.json`, không hardcode trong component.
4. Dùng lại component có sẵn: `GenericModal`, `ConfirmModal` + `useConfirm()`, `CustomSelect`,
   `DatePickerPopover`, `TagPicker`. Không `window.confirm/alert/prompt`.
5. RLS bật cho mọi bảng; `auth.uid() = user_id`. v5.0.0: 2 bảng từng cho public SELECT (`programs`, `program_habits`) đã DROP — giờ không bảng nào đọc chéo được.
6. Mọi retry phải có giới hạn (`MAX_RETRIES`, `MAX_ADVANCE = 24`, `lazyRetry` 1 lần).
7. Không tự ý sửa `data/schema_v4.24.0.sql`.
8. Đổi tính năng → cập nhật `docs/FEATURES.md` + `CHANGELOG.md` (RULES.md §8, §13).
9. `npm run build` phải 0 lỗi trước khi coi task là xong.

---

## 6. Chạy

```bash
npm install
npm run dev      # vite dev server
npm run build    # bắt buộc pass trước khi kết thúc task
npm run lint
npm test         # 3 self-check bằng node:assert (không có test framework)
```

Env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (client) ·
`GOOGLE_SERVICE_ACCOUNT_JSON`, `DRIVE_FOLDER_ID` (chỉ server). Mẫu: `.env.local.example`.
Thiếu env Supabase → app vẫn chạy ở chế độ in-memory.
DB: làm đúng thứ tự master → Vault v5.2 → Finance v6.0 → Vault encryption v6.2 trong `README.md`.

---

## 7. Sai lệch đã biết (cập nhật khi fix)

- **`streaks` không bao giờ được cập nhật** — không có trigger `refresh_streak()`, không hook nào ghi.
  Streak người dùng thấy là tính client-side; cột streak của leaderboard vì vậy đứng ở 0.
  Chi tiết + hướng xử lý: `docs/DATABASE.md` § Streak — Source of Truth.
- **`CHANGELOG.md` thiếu entry `v4.24.0`** — bản vá RLS/rò email (chỉ sửa `data/schema_v4.24.0.sql`,
  không bump `package.json`) chưa bao giờ được ghi changelog. Changelog nhảy từ v4.23.0 sang v4.24.1.
- ~~Life Journey lưu trong localStorage~~ — feature đã gỡ ở v5.0.0, ngoại lệ legacy hết hiệu lực
  đã được ghi rõ, chưa migrate. Không sync đa thiết bị, mất khi xoá browser data.
- **Tên file schema giữ nguyên `schema_v4.24.0.sql`** dù docs đã lên v4.26.1 — cố ý, để không phải
  đổi tên file mỗi lần bump patch tài liệu.
