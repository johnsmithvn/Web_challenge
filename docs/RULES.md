# RULES.md — Life Hub

**Version:** v6.12.0 · **Updated:** 2026-08-30

Quy tắc hiện hành cho human developer và coding agent. `CLAUDE.md` là entrypoint ngắn; file này là
policy chi tiết. Lịch sử rule cũ nằm trong git/CHANGELOG, không lặp ở đây.

## 1. Sự thật trước giả định

Trước khi sửa:

1. Kiểm tra file/caller/schema thật đang tồn tại.
2. Đọc flow từ UI → data owner → Supabase/API → state trở lại.
3. Phân biệt rõ:
   - **Verified:** đọc trực tiếp từ source/log/test.
   - **Assumption:** giả định cần xác nhận.
   - **Proposed:** thay đổi chưa triển khai.
4. Không tuyên bố production/deploy/database đã thay đổi nếu không có bằng chứng từ chính môi trường đó.

Nếu thiếu quyết định làm đổi phạm vi hoặc có nguy cơ mất dữ liệu, dừng và hỏi. Không dùng `TODO` để che
một blocker mà user phải quyết định.

## 2. Scope và workflow

- Chỉ sửa file liên quan đến yêu cầu; giữ nguyên thay đổi đang có của user.
- Không chạm `node_modules`, `dist`, `.git` hoặc secret.
- Không đọc/sửa `.env.local`; chỉ dùng `.env.local.example` để biết tên biến.
- Không refactor/rename/move file ngoài phạm vi.
- Ưu tiên xóa code/tài liệu dư, dùng helper/pattern có sẵn và giải pháp native trước dependency mới.
- Task đụng hơn năm file, kiến trúc hoặc schema phải có plan và user duyệt trước khi triển khai.
- Không stage, commit, push, deploy hoặc mở PR nếu user chưa yêu cầu.

`data/schema_v4.24.0.sql` là baseline nhạy cảm; chỉ sửa khi user yêu cầu rõ. Snapshot timestamp trong
`supabase/migrations` là bất biến; schema mới dùng migration mới.

## 3. Architecture và data ownership

### Auth/guest đúng hiện tại

- Task list và Focus có guest in-memory.
- Inbox, Knowledge, Tags/Quotes/Profile, Finance và Vault là auth-only.
- Vault còn cần passphrase unlock sau Supabase Auth.

Không áp một “dual-mode pattern” giả cho mọi hook.

### Data owner

- CRUD/domain logic ưu tiên nằm trong hook hoặc pure util; page/component điều phối UI.
- Dùng data owner hiện có (`useUserTasks`, `useCollections`, `useFinance`, `useAccounts`...) trước khi
  thêm query mới.
- Repo có boundary trực tiếp hợp lệ cho Auth/profile/media và một số component hiện hữu. Không biến
  guideline “component props-driven” thành luật giả, nhưng cũng không mở thêm direct Supabase access
  nếu hook phù hợp đã tồn tại.
- Non-trivial date/money/recurrence/crypto logic phải tách pure để self-check được.

### Optimistic write

- Chỉ optimistic khi có rollback rõ ràng.
- Không ghi activity/log trước khi write chính thành công.
- Whole-row encrypted write phải có revision/CAS; conflict không được silently overwrite.
- Response async phải gắn đúng user/session; lock/sign-out/đổi user làm response cũ mất quyền commit.

## 4. Browser storage

Chỉ lưu preference, UI state, session handoff và cờ migration. Không lưu user content mới, token nhạy
cảm, Vault passphrase, KEK, DEK hoặc decrypted item.

Key hiện tại dùng nhiều prefix lịch sử (`vl_`, `lh_`, `kb_`). Giữ chúng để không làm mất preference;
key mới nên dùng `vl_`. Danh sách hiện hành nằm trong `ARCHITECTURE.md`.

Guest data dùng React memory và được phép mất khi reload; không lén “nâng cấp” thành localStorage.

## 5. UI và design

- Đọc `DESIGN.md` trước khi đổi layout/CSS/component/UX.
- Vanilla CSS; token chung nằm ở `src/styles/global.css`; hỗ trợ dark và light.
- Reuse `ConfirmModal`, `GenericModal`, `CustomSelect`, `DatePickerPopover`, `TagPicker` khi phù hợp.
- Không dùng `window.alert`, `window.confirm`, `window.prompt`.
- Giữ focus indicator, label truy cập được, touch target hợp lý và `prefers-reduced-motion`.
- Vault Keyplate và Finance Nocturne có scoped design contract riêng. Native select/dialog trong Vault
  là ngoại lệ được ghi trong DESIGN; không copy ngoại lệ sang module khác.
- Không bắt buộc custom component khi native control đơn giản hơn và không phá contract/accessibility.

## 6. Static content

Content tĩnh nhiều item cùng schema hoặc được chỉnh độc lập với logic nên nằm trong một JSON theo
feature ở `src/data/`.

Các nguồn hiện hành gồm:

- `account-templates.json`
- `finance-categories.json`
- `holidays.json`
- `knowledge.json`
- `quotes.json`
- `ui-strings.json`

UI config nhỏ gắn chặt với component có thể ở code; không tách JSON chỉ để thỏa số lượng dòng.

## 7. Supabase, RLS và migration

- Tên bảng/cột lowercase snake_case; bảng số nhiều; junction `<entity>_<entity>`.
- Mọi bảng user-owned bật RLS và kiểm `auth.uid()` đúng owner.
- Junction/FK chéo domain phải kiểm ownership cả hai phía.
- View trên bảng RLS dùng `security_invoker=true` trừ khi có security design khác được review.
- Không cấp verb app không dùng; RLS không bảo vệ TRUNCATE nên ACL least-privilege vẫn bắt buộc.
- Function `SECURITY DEFINER` phải có input validation, owner check/search path và grant tối thiểu.
- Migration breaking ghi rõ preflight, transaction, rollback/fail-closed và verify cuối file.
- Không retro-edit migration timestamp. Không dùng remote push khi production history chưa baseline.

Fresh/local/production order duy nhất nằm trong README. Không mô tả `schema_v4.24.0.sql` là schema v6.2
độc lập và không chạy lại baseline một mình trên database Finance/Vault cuối.

## 8. Secret và API safety

Không commit/hardcode API key, service-role key, Google Service Account JSON, OAuth secret, token hoặc
password.

- `VITE_*` được đưa vào browser; chỉ dùng giá trị public phù hợp.
- `GOOGLE_SERVICE_ACCOUNT_JSON`, `DRIVE_FOLDER_ID`, `ALLOWED_ORIGIN` là server-side.
- Upload phải xác thực Supabase JWT.
- Stream chỉ phục vụ file dưới folder được cấu hình và giữ Range semantics.
- Retry, pagination và loop luôn bounded; write không idempotent không retry mù.

## 9. XP và Task log

- XP nguồn hiện tại: hoàn thành Task `+10`, Focus session `+15`.
- Dedup theo metadata id trong data owner trước/đang lúc add.
- Bỏ hoàn thành Task xóa đúng XP event; vì vậy không mô tả `xp_logs` là tuyệt đối immutable.
- Mọi đường thay đổi Task cần log sau khi write thành công; note và field-diff tuân theo RLS riêng.
- Không thêm event log nếu chưa có consumer thật.

## 10. Test và verification

Self-check dùng `node:assert/strict`, không Jest/Vitest.

- Test logic mới ở `src/__tests__` và wire vào `npm test`; giữ hai test colocated cũ tại chỗ.
- Mỗi logic có branch/edge case phải có ít nhất một check nhỏ chứng minh hành vi.
- Chạy `npm test` khi chạm logic được test; chạy lint khi thay JS/JSX.
- Nếu test có sẵn fail, báo rõ trước khi sửa kỳ vọng hoặc logic chỉ để làm xanh.
- Không tự chạy `npm run build`; user build thủ công. Chỉ chạy khi user yêu cầu hoặc báo lỗi build,
  rồi sửa/re-run tới khi sạch.
- Không nói UI đã verified nếu chưa browser-check. Khi không dùng browser, giao checklist click tay.
- `npm run build` không chạy `api/`; API cần smoke ở môi trường có env thật.

Với docs-only, tối thiểu chạy link/path checker, stale-claim scan và `git diff --check`; không build chỉ
để đổi Markdown.

## 11. Documentation và versioning

Mỗi nguồn có một vai trò:

| File | Chỉ cập nhật khi |
|---|---|
| `README.md` | setup/runbook/deploy/path user-facing đổi |
| `PROJECT.md` | module map hoặc doc routing đổi |
| `ARCHITECTURE.md` | route/data flow/storage/boundary đổi |
| `DATABASE.md` | table/column/RLS/RPC/migration đổi |
| `FEATURES.md` | hành vi user-facing đổi |
| `DESIGN.md` / design domain | visual/product contract đổi |
| `TASKS.md` | task mở/trạng thái thực tế đổi |
| `PLAN.md` | thứ tự milestone đổi |
| `CHANGELOG.md` | mọi thay đổi repo cần ghi lịch sử |

Không copy release history vào PLAN/TASKS/FEATURES. Completed work chỉ ở CHANGELOG; tài liệu hiện hành
mô tả trạng thái hiện tại. Xóa doc/file superseded sau khi gộp thông tin duy nhất còn cần.

Semantic version:

- PATCH: fix nhỏ, docs hoặc cải tiến không breaking.
- MINOR: feature/module mới hoặc behavior không breaking.
- MAJOR: kiến trúc/interface/schema breaking.

Không bump `package.json` cho mọi chỉnh sửa tài liệu; chỉ bump khi đang chuẩn bị release/version mới.

## 12. Cấm xóa/reset database không xin phép

Đây là rule ưu tiên cao nhất.

Không tự chạy:

- `supabase db reset` hoặc linked reset
- `DROP DATABASE`
- `DROP SCHEMA ... CASCADE`
- `TRUNCATE`
- `DELETE` hàng loạt / reset script
- tool hoặc script gián tiếp thực hiện các hành động trên

Trước hành động destructive:

1. Xác định chính xác environment và target.
2. Giải thích dữ liệu nào mất và khả năng phục hồi.
3. Đề xuất migration/cách ít phá hủy hơn.
4. Xin user cho phép rõ ràng.

Không suy ra quyền xóa từ câu “test”, “local” hoặc “làm toàn bộ”.

## 13. Completion checklist

- [ ] Diff chỉ chứa phạm vi đã duyệt; thay đổi user có sẵn được giữ nguyên.
- [ ] Claim đã đối chiếu source/test/log, không dựa trên docs cũ.
- [ ] Test/lint/link/path check phù hợp đã chạy và kết quả được nói đúng.
- [ ] Tài liệu đúng vai trò được cập nhật, không lặp lịch sử.
- [ ] `CHANGELOG.md` có entry ngắn dưới version hiện tại.
- [ ] Production/manual work còn lại được ghi rõ là user-run.
- [ ] Không stage/commit/push/deploy/reset nếu user chưa yêu cầu.
