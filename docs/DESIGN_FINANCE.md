# DESIGN — Finance v2 (module chi tiêu, thiết kế Nocturne)

**Trạng thái:** 📝 Thiết kế — chờ user duyệt, **CHƯA code**.
**Nguồn:** handoff `_ds_bundle` (Chi tieu.dc.html + README) — thay HẲN module Finance cũ.
**Version dự kiến:** v6.0.0 (MAJOR — đổi schema breaking, drop 2 bảng cũ, kiến trúc mới).

> File này là hợp đồng thiết kế. Code bám đúng đây; lệch phải sửa file này trước.
> Theo pattern Vault (`DESIGN_ACCOUNT_VAULT.md` + `migration_v5.2.0_vault.sql`): design doc →
> duyệt → migration idempotent + RLS → logic thuần có test → hook dual-mode → page → css.

---

## 0. Ba nguyên lý cốt lõi (vi phạm 1 = phá thiết kế)

1. **App KHÔNG tính số dư.** Không ví, không "tiền của tôi", không dòng tiền thu−chi. `income`
   (thu) vẫn ghi + có lịch sử nhưng **không bao giờ là mẫu số** của bất kỳ tỉ lệ nào. 50/30/20
   tính trên **hạn mức người dùng tự đặt** (`finance_budgets`), không trên thu nhập.
2. **Một bảng, lọc theo kỳ.** Không lưu số tổng nào. Mọi con số trên UI = một phép đếm chạy lại
   trên `finance_transactions` lọc theo `occurred_at`. Sửa giao dịch cũ → mọi báo cáo tự đúng lại,
   không job đồng bộ. Nơi tính tổng **duy nhất** = `periodTotals()` trong `financeLogic.js`.
3. **App không trả tiền hộ — nó ghi lại.** Hóa đơn/vay/thu định kỳ chỉ *nhắc*. Tới ngày → user bấm,
   chọn ngày trả → sinh một `finance_transaction` bình thường mang FK trỏ về quy tắc.

---

## 1. Phạm vi thời gian từng màn (điểm dễ sai nhất)

| Màn | Kỳ đọc |
|---|---|
| Tổng quan (4 chỉ số, donut, nhịp chi, 3 mức) | Kỳ chọn ở bộ lọc |
| Giao dịch | **Chung state bộ lọc với Tổng quan** |
| Ngân sách + 3 mức 50/30/20 | **Luôn tháng đang chạy** |
| Hóa đơn · Thẻ · Khoản vay | **Luôn tháng đang chạy** |
| Thống kê | Bộ chọn riêng 3/6/12 tháng |

Chip ngân sách trên header module luôn nói về **tháng đang chạy**, kể cả khi Tổng quan xem cả năm.

---

## 2. Schema DB (migration `data/migration_v6.0.0_finance.sql`, idempotent)

Convention bám repo: snake_case, `user_id` FK `auth.users ON DELETE CASCADE`, RLS bật + policy
`user_id = auth.uid()`, trigger `update_updated_at()` (đã có sẵn), CHECK **chỉ** trên giá trị code
phân nhánh theo (`type`, `kind`, `state`…), KHÔNG CHECK trên giá trị chỉ tra JSON lấy nhãn
(`category_id`, `subcategory_id`). Prefix `finance_` để tách namespace.

### 2.0 DROP module cũ (đầu file migration)
```sql
DROP VIEW IF EXISTS tagged_items;               -- sẽ tạo lại ở cuối, bỏ nhánh expense/subscription
DROP TABLE IF EXISTS expense_tags CASCADE;
DROP TABLE IF EXISTS subscription_tags CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS subscriptions CASCADE;
```
> ⚠️ **Mất dữ liệu thật vĩnh viễn** — đúng lựa chọn "drop sạch" của user. Không có nhánh migrate.

### 2.1 `finance_transactions` — bảng DUY NHẤT
```
id, user_id
amount            BIGINT   NOT NULL           -- VND nguyên
occurred_at       DATE     NOT NULL           -- khoá lọc kỳ
type              TEXT     CHECK (type IN ('expense','income','saving'))
category_id       TEXT                        -- key trong finance-categories.json
subcategory_id    TEXT
source_card_id    UUID  NULL → finance_cards ON DELETE SET NULL   -- NULL = tiền mặt/có sẵn
excluded          BOOLEAN  DEFAULT false       -- trả gốc vay + trả sao kê thẻ: ngoài mọi tổng chi
necessity         TEXT NULL CHECK (necessity IN ('must','need','want'))
is_fixed          BOOLEAN  DEFAULT false       -- thuộc "phần cố định" (hóa đơn+đăng ký+lãi)
note, merchant    TEXT
items             JSONB    DEFAULT '[]'         -- line items
-- FK quy tắc & liên kết:
shortcut_id       UUID NULL → finance_shortcuts ON DELETE SET NULL
bill_id           UUID NULL → finance_bills     ON DELETE SET NULL
bill_period       TEXT NULL                    -- chặn trả 2 lần cùng kỳ (unique với bill_id)
loan_id           UUID NULL → finance_loans     ON DELETE SET NULL
card_id           UUID NULL → finance_cards     ON DELETE SET NULL   -- thẻ đang trả sao kê
saving_goal_id    UUID NULL → finance_saving_goals ON DELETE SET NULL
saving_dir        TEXT NULL CHECK (saving_dir IN ('in','out'))
inbox_item_id     UUID NULL → collections       ON DELETE SET NULL   -- LIÊN KẾT INBOX
task_id           UUID NULL → user_tasks        ON DELETE SET NULL   -- LIÊN KẾT TASK
created_at, updated_at
INDEX (user_id, occurred_at DESC)
UNIQUE (bill_id, bill_period) WHERE bill_id IS NOT NULL   -- quy tắc nghiệp vụ #3
```

### 2.2 `finance_bills` — Phải trả (segment `out`)
```
name, provider, customer_code TEXT
category_id, subcategory_id   TEXT
rrule            JSONB          -- cùng shape recurrence_rule của task
due_day          INT
amount_mode      TEXT CHECK (amount_mode IN ('fixed','ask'))
amount           BIGINT NULL    -- null khi mode='ask'
term_total       INT NULL       -- trả góp
term_done        INT DEFAULT 0
enabled          BOOLEAN DEFAULT true
finished_at      TIMESTAMPTZ NULL
```
Lịch sử trả = `SELECT * FROM finance_transactions WHERE bill_id = ?` — KHÔNG bảng lịch sử riêng.
Trả góp: mỗi kỳ ghi xong `term_done++`; `term_done == term_total` → `finished_at = now()`, rời
danh sách chính, gom vào dòng "đã kết thúc", không bật lại.

### 2.3 `finance_loans` — Khoản vay (segment `loan`)
```
name, lender TEXT
principal   BIGINT
rate        NUMERIC          -- %/năm
kind        TEXT CHECK (kind IN ('interest','amort'))
term        INT              -- số kỳ
done        INT DEFAULT 0
pay_day     INT
opened_at   DATE
due_at      DATE             -- ngày tất toán gốc (interest)
```
**Lãi = chi tiêu; gốc KHÔNG.** Giao dịch trả gốc mang `excluded = true`.

### 2.4 `finance_cards` — Thẻ tín dụng (segment `card`)
```
name, bank TEXT, last4 TEXT
credit_limit BIGINT
statement_day INT, due_day INT, grace INT   -- chốt ≠ đến hạn; khoảng giữa = thời gian float
annual_fee BIGINT, cash_advance_fee BIGINT, min_pct NUMERIC
```
Trả sao kê = giao dịch `excluded = true`, `card_id = ?` — không phải chi mới (đã tính hôm quẹt).

### 2.5 `finance_saving_goals` — Quỹ (KHÔNG có cột số dư)
```
name TEXT, goal BIGINT
lock_mode  TEXT CHECK (lock_mode IN ('soft','term','external'))   -- mềm/kỳ hạn/ngoài app
lock_until DATE NULL
in_wallet  BOOLEAN DEFAULT true
auto_deposit JSONB NULL
break_count INT DEFAULT 0
closed_at  TIMESTAMPTZ NULL
```
Số dư quỹ = `SUM(finance_deposits.amount) WHERE fund_id = ?` (tính runtime, không lưu).

### 2.6 `finance_deposits` — Nơi gửi (sổ thật của 1 quỹ)
```
fund_id → finance_saving_goals ON DELETE CASCADE
name, bank, account_no TEXT
amount BIGINT, rate NUMERIC, term INT
opened_at DATE, matures_at DATE   -- đếm ngược, vàng khi ≤45 ngày
```

### 2.7 `finance_income_rules` — Thu định kỳ (segment `in`)
```
name, source TEXT
rrule JSONB, due_day INT, amount BIGINT
received_periods JSONB DEFAULT '[]'   -- các kỳ đã nhận (dedup)
enabled BOOLEAN DEFAULT true
```
**Không quá hạn** — chưa nhận chỉ là chưa tới. Bấm "Đã nhận" → giao dịch `type='income'`.

### 2.8 `finance_shortcuts` — Nút nhập nhanh (KHÔNG có cột số tiền)
```
name TEXT, category_id, subcategory_id TEXT
necessity TEXT NULL
recent_amounts JSONB DEFAULT '[]'   -- 3 mức hay nhập, hiện thành chip
use_count INT DEFAULT 0
source_card_id UUID NULL
```

### 2.9 `finance_budgets` — Hạn mức tháng (cơ sở của 50/30/20)
```
user_id, category_id TEXT
limit_amount BIGINT
UNIQUE (user_id, category_id)        -- hạn mức đứng (không theo từng tháng)
```
Tổng hạn mức = mẫu số duy nhất của mọi tỉ lệ. 3 mức 50/30/20 = tổng hạn mức theo `necessity`.

### 2.10 Junction `finance_transaction_tags` + VIEW
```sql
finance_transaction_tags (transaction_id → finance_transactions, tag_id → tags, PK cả hai)
-- VIEW tagged_items tạo lại: bỏ expense/subscription, thêm:
UNION ALL SELECT tag_id, 'finance'::text, transaction_id FROM finance_transaction_tags
```

**9 bảng + 1 junction.** RLS bật hết. Bảng con (bills/loans/cards/goals/deposits/income/shortcuts/
budgets/transactions/junction) policy `FOR ALL USING (user_id = auth.uid())`; junction kiểm
ownership 2 phía như `account_tags`. File có block VERIFY + 3 phép thử phải-báo-lỗi như Vault.

---

## 3. Static content — `src/data/finance-categories.json` (Rule 14)

Một file cho cả feature:
```json
{
  "expenseGroups": [ { "key":"food","label":"Ăn uống","icon":"ph-fork-knife","color":"#e2a94e",
      "subs":[ {"key":"food.rice","label":"Cơm","necessity":"need"}, ... ] }, ... ],   // 11 nhóm
  "incomeGroups":  [ ... ],                                                             // 7 nhóm RIÊNG
  "necessityByCat": { "food":"need", ... },      // NEED_BY_CAT
  "necessityBySub": { "transport.parking":"must", "transport.drink":"want", ... },      // NEED_BY_SUB đè
  "shortcutSeed":  [ {"name":"Cà phê","category_id":"food","subcategory_id":"food.coffee"}, ... ]
}
```
Màu 11 nhóm chi = palette tách biệt (donut đọc được), lấy đúng hex handoff §Design tokens.
`deriveNecessity(cat, sub)` = `necessityBySub[sub] ?? necessityByCat[cat]`.

> **Sửa danh mục (tên/màu/subcat/mức) từ UI → PHASE SAU.** v1 danh mục seed từ JSON (read-only).
> Tab "Danh mục" hiển thị + cho sửa `finance_budgets` (hạn mức), chưa sửa được cấu trúc danh mục.
> `NL_DICT` (15 regex đoán danh mục) là **hằng số logic**, nằm trong `financeLogic.js` (không JSON).

---

## 4. Logic thuần — `src/utils/financeLogic.js` (+ `src/__tests__/financeLogic.test.js`)

Không React, không Supabase — testable bằng `node:assert` (bám CLAUDE.md §Testing). Wire vào
`npm test`. Các hàm:

| Hàm | Việc |
|---|---|
| `periodTotals(txs, {from,to})` | **Nơi tính tổng DUY NHẤT.** Bỏ `excluded`; trả `{total, byCategory, byNecessity, count, days}`. `income`/`saving` tách riêng, không trừ vào chi. |
| `comparePeriods(cur, prev, mode)` | 3 nhánh: tháng đang chạy → cùng cửa sổ ngày; 2 tháng trọn → so tổng; năm chưa trọn → so mức/ngày. |
| `deriveNecessity(cat, sub, maps)` | `necessityBySub ?? necessityByCat`. |
| `parseNaturalLanguage(text)` | `"cà phê 35k"` → `{amount, categoryId, subId}` qua `NL_DICT` + `parseCurrencyInput` (tái dùng). |
| `budgetBreakdown(txs, budgets)` | 50/30/20 trên tổng hạn mức theo `necessity`; "cắt được X". |
| `cardFloat(card, today, blendedRate)` | ngày chốt→đến hạn, số ngày float còn lại, lãi ước kiếm từ float. |
| `loanSchedule(loan)` | `interest` (chỉ lãi, gốc cuối kỳ) vs `amort` (đều gốc+lãi). |
| `fundBalance(deposits)` | `SUM(amount)` + lãi suất bình quân gia quyền. |
| `spendingRhythm(txs, unit)` | cột theo ngày (1 tháng) / theo tháng (cả năm) + đường trung bình. |

`BLENDED_RATE` = lãi suất bình quân gia quyền của tiền đang gửi (từ `finance_deposits`), truyền vào.

---

## 5. Hooks (dual-mode Supabase-first, guest = in-memory)

`src/hooks/useTransactions.js` (CRUD + fetch theo kỳ), `useBills.js`, `useLoans.js`, `useCards.js`,
`useSavings.js` (goals + deposits), `useIncomeRules.js`, `useShortcuts.js`, `useBudgets.js`. Mỗi
hook theo pattern `use<Entity>` chuẩn RULES §Hook Naming, optimistic + rollback, `fetch/add/update/
delete<Entity>`. "Thanh toán 1 nghĩa vụ" = 1 hàm `payBill/payLoan/payCard/receiveIncome` → gọi
`addTransaction` với FK + `excluded` đúng, rồi cập nhật `term_done`/`received_periods`.

---

## 6. UI — module shell + **child sidebar** + 6 màn

Route `/finance` giữ nguyên (1 route). Trong đó là `FinancePage` = **module shell**:

```
┌ sidebar chính app (232px, đã có) ┬ CHILD SIDEBAR finance (208px) ┬ nội dung + header sticky ┐
│  Inbox / Nhiệm vụ / … / Finance◄ │  Tổng quan                     │  [header: tên màn +      │
│                                   │  Nhập nhanh   (phím N)         │   chip ngân sách tháng]  │
│                                   │  Giao dịch                     │  ...                     │
│                                   │  Danh mục                      │                          │
│                                   │  Hóa đơn                       │                          │
│                                   │  Phân tích                     │                          │
```

`screen` = state string 6 giá trị `overview|add|list|cats|recurring|analyze`. Sub-nav:
`recurring` → segment `out|in|loan|card`; `analyze` → tab `budget|stats`; `cats` → tab `cats|fields`.
`< 760px`: child sidebar → **hàng sub-tab ngang** (scroll ngang) ngay dưới header; sidebar chính →
bottom-tabs (đã có). Điều hướng chéo giữ qua 1 context nhỏ `FinanceNav` (setScreen + params):

- Cảnh báo thẻ tới hạn (Tổng quan) → `recurring` segment `card`
- Bấm danh mục ở legend donut → `analyze/stats` đã chọn sẵn nhóm
- Chip ngân sách header → `analyze/budget`
- Hộp "Cần bạn ghi" (Nhập nhanh) → ghi xong → giao dịch bình thường

**6 màn** (chi tiết bám handoff §Từng màn — không lặp lại đây, tóm điểm phải đúng):
1. **Tổng quan** — cảnh báo thẻ (nếu có), bộ lọc kỳ (15 mục, ‹ ›, **chung state với Giao dịch**),
   4 chỉ số, donut + legend bấm được + khối "Bắt buộc đến đâu" (thanh 3 màu), nhịp chi (đổi đơn vị
   theo kỳ), khoản lớn nhất, quỹ tiết kiệm tóm tắt, Inbox gợi ý.
2. **Nhập nhanh** — ô NL (`NL_DICT`), 5 shortcut (không chốt tiền, chip `recent_amounts`), form;
   hộp "Cần bạn ghi" (hóa đơn `ask` tới hạn **+ mục Inbox chưa xử lý**); bắt buộc chọn nguồn tiền;
   segmented Chi/Thu/Để dành; cảnh báo trùng quy tắc định kỳ.
3. **Giao dịch** — bộ lọc kỳ chung + tìm + chip lọc; nhóm theo ngày thật (thứ trong tuần đúng,
   "Hôm nay/Hôm qua"); nhãn `auto` cho khoản do quy tắc sinh; **cột chi tiết 340px** desktop (ẩn
   hẳn <760px). Chi tiết giao dịch có **ô gắn Task** + link Inbox nguồn (xem §7).
4. **Danh mục** — tab Danh mục (hiển thị 11 nhóm chi + 7 nhóm thu + sửa **hạn mức**), tab Schema
   (trang tài liệu, có thể rút gọn).
5. **Hóa đơn** — 4 segment 1 hàng, nút Thêm cùng hàng (nhãn đổi theo segment), form mở ngay dưới.
   `out` fixed/ask + trả góp kết thúc; `in` không quá hạn; `loan` interest/amort (gốc `excluded`);
   `card` chốt≠đến hạn + float + lãi ước + cảnh báo phí.
6. **Phân tích** — tab Ngân sách (ghim tháng chạy, thẻ gradient, vòng tiến độ, "nên tiêu mỗi ngày",
   hạn mức nhóm, 3 mức, quỹ + nơi gửi); tab Thống kê (bộ chọn 3/6/12, 4 chế độ danh mục/so sánh/
   hóa đơn/thẻ).

---

## 7. Liên kết Task + Inbox (yêu cầu riêng của user)

**Task** (chốt: "gắn giao dịch với task"):
- `finance_transactions.task_id` FK → `user_tasks` ON DELETE SET NULL.
- Trong **cột chi tiết Giao dịch**: ô "Gắn nhiệm vụ" — chọn 1 task (dùng lại `useUserTasks`), hiện
  chip task, bấm mở task. Cho phép xem "đã tiêu bao nhiêu cho task này" (query theo `task_id`).
- 🔜 **Phase sau (đã chốt hoãn):** nghĩa vụ quá hạn (nợ/thẻ tới hạn/quỹ đáo hạn) → tự tạo task nhắc
  trong module Nhiệm Vụ. KHÔNG làm ở v1.

**Inbox** (chốt: cả 2 chiều):
- **Inbox → Giao dịch:** nút ở Inbox mở form Nhập nhanh điền sẵn (thay `handleToExpense` cũ), giao
  dịch tạo ra mang `inbox_item_id`; lưu xong xoá mục Inbox (giữ pattern `deleteInboxItem` cũ).
- **Inbox → Hóa đơn/Quy tắc:** nút ở Inbox → màn `recurring` segment tương ứng, form điền sẵn tên
  (thay cơ chế `sessionStorage lh_inbox_to_sub` cũ, đổi key → `lh_inbox_to_finance` mang `{kind,
  title, inboxId}`).
- Hộp "Cần bạn ghi" (Nhập nhanh) gộp mục Inbox chưa xử lý (đã chốt).

> Ghi `activity_logs` khi thanh toán: **không chọn** ở v1 (user không tick) — để trống, có thể thêm
> sau cùng luồng auto-task.

---

## 8. Design system Nocturne (dark-only, scoped)

User cho **bỏ qua luật DESIGN.md**. Module dùng thẳng token Nocturne của handoff, **scoped trong
`.finance-module`** (không đụng `global.css`, không phá theme app). Module render **dark cố định**
(Nocturne là dark-only high-fidelity); app light theme không áp vào trong module — chấp nhận như
"cockpit" riêng. Token chính (hex đã resolve từ handoff):

- Nền `#161826` · card `#232532` · chìm `#161826` · gradient `120deg,#232532,#1e2030` · lưu trữ
  `#1c1e2a` · viền `#3f424d`/`rgba(233,233,237,.08)` · ground bão hoà (chỉ thẻ ngân sách) `#262a60`.
- Chữ `#e9e9ed`/`#9397ab`/`#75798c` · trên accent `#d2cefd`.
- Cảnh báo `#e2a94e` (sắp) · `#e07f93` (quá hạn). Accent `#9184d9` + ramp handoff.
- 11 màu nhóm chi = palette riêng (đã ở JSON).
- Type: Inter 400/500, **không đậm hơn 500**, phân cấp bằng cỡ + khoảng trắng (thang px handoff).
- Radius 6/8/14/20. Elevation = viền: `box-shadow: 0 0 0 1px <border>`, không bóng nặng.
- Số tiền: `tabular-nums`, `formatVND` (tái dùng `currencyUtils`), hậu tố `₫`.
- Icons: **Phosphor** `ph ph-*`. → thêm dependency `@phosphor-icons/react` **HOẶC** dùng emoji sẵn
  có để 0 dependency. `TODO: decision needed` (đề xuất: emoji cho v1, Phosphor phase sau).

CSS: 1 file `src/styles/finance.css` (viết lại từ đầu).

---

## 9. Animation & tương tác (bám handoff §Tương tác)

- `@keyframes riseIn` `.15s ease` cho panel mở ra + toast. **Không có gì khác chuyển động.**
- Toast: nói **hệ quả** không nói "thành công" (vd "Đã ghi Hóa đơn điện — giờ là giao dịch bình
  thường, lên báo cáo"); tự tắt ~2.4s. Dùng lại `ToastContext` có sẵn.
- Toggle 32×18, knob 14; bật `#6b5fb8` tắt `#3f424d`; dòng tắt `opacity .5`.
- Hover nút ghost: nền `rgba(233,233,237,.06)`, chữ `#d2cefd`.
- Focus: `:focus-visible{outline:2px solid #9184d9;outline-offset:2px}` — không ring xanh mặc định.

---

## 10. Responsive

1 breakpoint `< 760px`: child sidebar → sub-tab ngang; grid nhiều cột → 1 cột; cột chi tiết Giao
dịch **ẩn hẳn**; vùng chạm ≥44px; mọi grid track `minmax(0, …)` chống tràn ngang.

---

## 11. Gỡ module cũ — điểm chạm phải sửa (đã grep)

| File | Việc |
|---|---|
| `src/hooks/useExpenses.js`, `useSubscriptions.js` | **Xoá** |
| `src/components/CashflowBar.jsx` | **Xoá** (thay bằng nhịp chi / lịch nghĩa vụ trong module) |
| `src/components/SubAlert.jsx` | Viết lại: đọc nghĩa vụ sắp tới từ `useBills`/`useCards` (giữ chỗ ở sidebar footer) |
| `src/pages/FinancePage.jsx` | Viết lại thành module shell |
| `src/styles/finance.css` | Viết lại |
| `src/data/expense-categories.json` | Thay bằng `finance-categories.json` |
| `src/pages/InboxPage.jsx` | Rewire `handleToExpense`/`handleToSub` → luồng §7; bỏ import `useExpenses` |
| `src/hooks/useTags.js` | `ENTITY_CONFIG`: bỏ expense/subscription, thêm `finance: {table:'finance_transaction_tags', fk:'transaction_id'}`; sửa `getTagUsageBreakdown`/`getAllTagUsageCounts` (bỏ 2 query cũ, thêm finance) |
| `src/pages/SettingsPage.jsx` | `TAG_USAGE_LABELS`: bỏ expense/subscription, thêm `finance:'giao dịch'` |
| `src/utils/currencyUtils.js` | **Giữ** (tái dùng `parseCurrencyInput`, `formatVND`; `SUBSCRIPTION_CYCLES`/`advanceByCycle` thành nền cho `rrule` bill) |
| `data/migration_v6.0.0_finance.sql` | Mới: DROP cũ + 9 bảng + junction + view |
| `data/schema_v4.24.0.sql` | Cập nhật master (bỏ expenses/subscriptions, thêm finance_*) — theo RULES chỉ sửa khi có chỉ thị rõ; **có chỉ thị "làm lại từ đầu"** nên cập nhật. |

Kiểm lại lúc code (grep đã thấy nhưng chỉ là comment/không đụng logic): `taskFields.js` (comment
`expense_add` lịch sử), `useActivityLog.js`, `IncubatorPage.jsx`, `GenericModal.jsx`, `logger.js`.

---

## 12. Docs & versioning (bắt buộc — RULES §8, §13)

Cập nhật: `CHANGELOG.md` (v6.0.0 Added/Changed/Removed), `package.json` version, `docs/FEATURES.md`
(viết lại §Finance), `docs/DATABASE.md` (9 bảng finance_*, drop expenses/subscriptions),
`docs/ARCHITECTURE.md` (hook/page/component mới), `docs/TASKS.md`, `docs/PLAN.md`.

---

## 13. Trình tự code (1 đợt, đúng thứ tự phụ thuộc)

1. `migration_v6.0.0_finance.sql` + cập nhật master schema + `finance-categories.json`.
2. `financeLogic.js` + test → `npm test` xanh.
3. Hooks (useTransactions → còn lại) + rewire `useTags`.
4. Module shell + child sidebar + `FinanceNav` context.
5. 6 màn theo thứ tự: Tổng quan → Nhập nhanh → Giao dịch (+ liên kết Task/Inbox) → Hóa đơn → Phân
   tích → Danh mục.
6. `finance.css` (Nocturne) + animation.
7. Rewire Inbox/SubAlert/Settings; xoá file cũ.
8. Docs + changelog + version. (User build + test cuối.)

---

## 14. Ngoài phạm vi v1 (đã chốt hoãn)

- Auto-sinh task nhắc từ nghĩa vụ quá hạn/tới hạn/đáo hạn.
- Sửa cấu trúc danh mục (tên/màu/subcat/mức cần thiết) từ UI.
- `activity_logs` khi thanh toán.
- Tab Schema đầy đủ (bản v1 rút gọn).
- Phosphor icons nếu chọn emoji cho v1.

---

## 15. Câu hỏi còn treo

- `TODO: decision needed` — **Icon:** Phosphor (`@phosphor-icons/react`, +1 dep) hay emoji (0 dep)?
  Đề xuất **emoji v1**.
- `TODO: decision needed` — Module **dark-only** trong app có light theme: chấp nhận "cockpit" tối
  cố định? Đề xuất **có** (đúng handoff). Nếu không, map token sang `global.css` (mất fidelity).
