# PROJECT.md — Life Hub

**Bản đồ cấp cao của repo.** Chỉ trả lời "cái gì ở đâu" và "đọc file nào tiếp".
Chi tiết nằm ở các file được trỏ tới — cố tình KHÔNG lặp lại ở đây.

**Version:** v4.26.1 · **Updated:** 2026-07-28

---

## 1. Là cái gì

SPA "Personal Life OS" một người dùng: habit tracking 21 ngày có gamification (XP/level/streak),
task, knowledge base có editor WYSIWYG, chi tiêu + subscription, incubator cho ý tưởng, và
heatmap lịch sử hoạt động. Chạy được ở 2 chế độ: **guest** (in-memory, mất khi refresh) và
**authenticated** (Supabase là primary store).

| Layer | Chọn gì |
|-------|---------|
| UI | React 19 + Vite 8, vanilla CSS (CSS variables + glassmorphism), không Tailwind |
| Routing | React Router v7, 13 page lazy + 2 eager |
| Data | Supabase (PostgreSQL + Auth + Realtime), RLS own-row |
| Serverless | 2 Vercel function: `api/upload.js`, `api/stream.js` (Google Drive) |
| Editor | Tiptap 3 + slash command + custom `MediaNode` |
| Hosting | Vercel (`vercel.json` SPA rewrite) |
| localStorage | UI flag/preference, prefix `vl_`. User data mới **không** được vào đây — trừ 2 ngoại lệ legacy của Life Journey (§7) |

---

## 2. Đọc file nào

| Cần biết | File |
|----------|------|
| Bảng, cột, RLS, RPC, XP, migration | `docs/DATABASE.md` → source of truth: `data/schema_v4.24.0.sql` |
| Từng tính năng làm gì, tính năng nào đã bỏ | `docs/FEATURES.md` (§1–§27 active, cuối file là Archived) |
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
| `/tracker` | TrackerPage (4 tab) | useHabitStore, useCustomHabits, useHabitLogs | progress, habits, habit_logs |
| `/focus` | FocusPage | useFocusTimer | focus_sessions, xp_logs |
| `/journey`, `/journey/:id` | JourneyPage, JourneyDetailPage | useJourney (+ JourneyContext) | programs, user_journeys, journey_habits |
| `/inbox` | InboxPage | useCollections, useExpenses | collections (type=inbox), expenses |
| `/tasks` | TasksPage (2 view: Danh sách / Lịch) | useUserTasks, useCollections | user_tasks, task_collections |
| `/collect` | CollectPage | useCollections, useKnowledgeGroups, useCollectionNotes, useTags | collections, knowledge_groups, collection_groups, collection_notes, collection_tags |
| `/finance` | FinancePage | useExpenses, useSubscriptions, useTags | expenses, subscriptions, *_tags |
| `/incubator` | IncubatorPage | useIntentions | intentions, intention_logs |
| `/life-log` | LifeLogPage | useActivityLog | activity_logs |
| `/dashboard` | DashboardPage | tổng hợp nhiều hook (+ 1 query supabase trực tiếp) | nhiều |
| `/leaderboard` | LeaderboardPage | — (RPC `get_leaderboard`) | profiles, streaks, xp_logs, progress |
| `/quiz` | QuizPage | useXpStore | xp_logs |
| `/life-journey` | LifeJourneyPage | useLifeJourney | — (localStorage-only) |
| `/settings` | SettingsPage | useTags, useQuotes | tags, inspirational_quotes |
| `/habits`, `/team`, `/friends` | redirect `/tracker` | — | — |

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
- Ghi hoạt động: `logActivity()` append vào `activity_logs` → nuôi heatmap Life Log.
- Cross-user (leaderboard, login bằng username): **chỉ** qua RPC `SECURITY DEFINER`,
  vì từ v4.24.0 `profiles` chỉ đọc được hàng của chính mình.

---

## 5. Luật không được phá

1. Không đặt user data mới vào localStorage. Chỉ UI flag/settings, prefix `vl_`. Ngoại lệ legacy duy nhất được phép tồn tại: `vl_life_journey_events`, `vl_journey_title` (§7) — không lấy làm tiền lệ.
2. Component không gọi `supabase` trực tiếp (ngoại lệ đã có: FocusBreakdown trong DashboardPage).
3. Content tĩnh (>3 item cùng schema) phải ra `src/data/<feature>.json`, không hardcode trong component.
4. Dùng lại component có sẵn: `GenericModal`, `ConfirmModal` + `useConfirm()`, `CustomSelect`,
   `DatePickerPopover`, `TagPicker`. Không `window.confirm/alert/prompt`.
5. RLS bật cho mọi bảng; `auth.uid() = user_id`. Ngoại lệ public SELECT: `programs`, `program_habits`.
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
DB: chạy `data/schema_v4.24.0.sql` một lần trong Supabase SQL Editor (idempotent).

---

## 7. Sai lệch đã biết (cập nhật khi fix)

- **`streaks` không bao giờ được cập nhật** — không có trigger `refresh_streak()`, không hook nào ghi.
  Streak người dùng thấy là tính client-side; cột streak của leaderboard vì vậy đứng ở 0.
  Chi tiết + hướng xử lý: `docs/DATABASE.md` § Streak — Source of Truth.
- **`CHANGELOG.md` thiếu entry `v4.24.0`** — bản vá RLS/rò email (chỉ sửa `data/schema_v4.24.0.sql`,
  không bump `package.json`) chưa bao giờ được ghi changelog. Changelog nhảy từ v4.23.0 sang v4.24.1.
- **Life Journey lưu trong localStorage** (`vl_life_journey_events`, `vl_journey_title`) — ngoại lệ legacy
  đã được ghi rõ, chưa migrate. Không sync đa thiết bị, mất khi xoá browser data.
- **Tên file schema giữ nguyên `schema_v4.24.0.sql`** dù docs đã lên v4.26.1 — cố ý, để không phải
  đổi tên file mỗi lần bump patch tài liệu.
