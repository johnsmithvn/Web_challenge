# DESIGN — Finance v2 (module chi tiêu, thiết kế Nocturne)

**Trạng thái:** ✅ Đã triển khai code + migration clean-rebuild; đã replay và smoke authenticated trên Supabase local. Production vẫn chờ user tự chạy `data/migration_v6.0.0_finance.sql`.
**Nguồn:** handoff `_ds_bundle` (Chi tieu.dc.html + README) — thay HẲN module Finance cũ.
**Version dự kiến:** v6.0.0 (MAJOR — đổi schema breaking, drop 2 bảng cũ, kiến trúc mới).

> File này là hợp đồng thiết kế. Code bám đúng đây; lệch phải sửa file này trước.
> Thứ tự triển khai đã áp dụng: hợp đồng thiết kế → migration clean-rebuild + RLS/RPC → logic
> thuần có test → hook auth-gated → page → CSS → kiểm tra desktop/mobile.

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

## 2. Schema DB (migration `data/migration_v6.0.0_finance.sql`, clean rebuild)

Convention bám repo: snake_case, `user_id` FK `auth.users ON DELETE CASCADE`, RLS bật + policy
`user_id = auth.uid()`, trigger `update_updated_at()` (đã có sẵn), CHECK trên giá trị code phân
nhánh theo (`type`, `kind`, `state`…). Parent category là tập đóng đúng handoff nên budget/override
được CHECK theo 11 nhóm chi + 7 nhóm thu; `subcategory_id` vẫn giữ key lịch sử tự do.

### 2.0 DROP module cũ (đầu file migration)
```sql
DROP VIEW IF EXISTS tagged_items;               -- sẽ tạo lại ở cuối, bỏ nhánh expense/subscription
DROP TABLE IF EXISTS finance_transactions CASCADE;
-- ... drop toàn bộ finance_* để schema không thể bị sót cột/ràng buộc từ bản cũ
DROP TABLE IF EXISTS expense_tags CASCADE;
DROP TABLE IF EXISTS subscription_tags CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS subscriptions CASCADE;
```
> ⚠️ **Mất dữ liệu thật vĩnh viễn** — đúng lựa chọn "drop sạch" của user. Toàn file nằm trong
> `BEGIN/COMMIT`, nhưng không có nhánh chuyển dữ liệu cũ.

### 2.1 `finance_transactions` — bảng DUY NHẤT
```
id, user_id
amount            BIGINT   NOT NULL           -- VND nguyên
occurred_at       DATE     NOT NULL           -- khoá lọc kỳ
type              TEXT     CHECK (type IN ('expense','income','saving'))
category_id       TEXT                        -- key trong finance-categories.json
subcategory_id    TEXT
source_card_id    UUID  NULL → finance_cards ON DELETE RESTRICT
source_kind       TEXT GENERATED ('cash'|'card')
excluded          BOOLEAN  DEFAULT false       -- trả gốc vay + trả sao kê thẻ: ngoài mọi tổng chi
necessity         TEXT NULL CHECK (necessity IN ('must','need','want'))
is_fixed          BOOLEAN  DEFAULT false       -- thuộc "phần cố định" (hóa đơn+đăng ký+lãi)
note, merchant    TEXT
items, attachments JSONB   DEFAULT '[]'
-- FK quy tắc & liên kết:
shortcut_id       UUID NULL → finance_shortcuts ON DELETE SET NULL
bill_id           UUID NULL → finance_bills     ON DELETE RESTRICT
bill_period       TEXT NULL                    -- chặn trả 2 lần cùng kỳ (unique với bill_id)
income_rule_id + income_period                 -- UNIQUE theo kỳ nhận
loan_id + loan_period + loan_part              -- interest|principal, UNIQUE từng phần/kỳ
card_id + card_period                          -- thẻ + kỳ sao kê đang trả
saving_goal_id    UUID NULL → finance_saving_goals ON DELETE RESTRICT
saving_dir        TEXT NULL CHECK (saving_dir IN ('in','out'))
inbox_item_id     UUID NULL → collections       ON DELETE SET NULL   -- LIÊN KẾT INBOX
task_id           UUID NULL → user_tasks        ON DELETE SET NULL   -- LIÊN KẾT TASK
created_at, updated_at
INDEX (user_id, occurred_at DESC)
UNIQUE (bill_id, bill_period) WHERE bill_id IS NOT NULL   -- quy tắc nghiệp vụ #3
UNIQUE (income_rule_id, income_period) WHERE income_rule_id IS NOT NULL
UNIQUE (loan_id, loan_period, loan_part) WHERE loan_id IS NOT NULL
```

`bill_period`, `income_period` và `loan_period` là **kỳ nghĩa vụ**, không suy từ
`occurred_at`. Ngày giao dịch là ngày tiền thực sự vào/ra do người dùng chọn; các RPC
nhận kỳ đang chạy riêng để một khoản trả muộn vẫn đóng đúng kỳ và không làm lệch báo cáo.

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
skipped_periods  JSONB DEFAULT '[]'   -- bỏ qua bền vững theo YYYY-MM
enabled          BOOLEAN DEFAULT true
finished_at      TIMESTAMPTZ NULL
```
Lịch sử trả = `SELECT * FROM finance_transactions WHERE bill_id = ?` — KHÔNG bảng lịch sử riêng.
Trả góp: trigger đếm lại transaction theo `bill_id` để suy `term_done`; đủ `term_total` thì đặt
`finished_at`, rời danh sách chính, gom vào dòng "đã kết thúc", không bật lại.

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
**Lãi = chi tiêu; gốc KHÔNG.** Giao dịch vay mang `loan_period` + `loan_part`; trigger suy lại
`done` từ sổ giao dịch. Gốc mang `excluded = true` và không được vượt dư gốc.

### 2.4 `finance_cards` — Thẻ tín dụng (segment `card`)
```
name, bank TEXT, last4 TEXT
credit_limit BIGINT
statement_day INT, due_day INT, grace INT   -- chốt ≠ đến hạn; khoảng giữa = thời gian float
annual_fee BIGINT, cash_advance_fee BIGINT, min_pct NUMERIC
```
Trả sao kê = giao dịch `excluded = true`, `card_id` + `card_period` — không phải chi mới. RPC tính
kỳ `(chốt trước, chốt hiện tại]`, trừ các lần đã trả và chặn trả vượt phần còn lại.

### 2.5 `finance_saving_goals` — Quỹ (KHÔNG có cột số dư)
```
name TEXT, goal BIGINT
lock_mode  TEXT CHECK (lock_mode IN ('soft','term','external'))   -- mềm/kỳ hạn/ngoài app
lock_until DATE NULL                 -- bắt buộc với term, NULL với soft/external
in_wallet  BOOLEAN DEFAULT true
auto_deposit JSONB NULL              -- {amount: số nguyên dương, day: 1..31}
withdrawal_request JSONB NULL         -- {requested_at, available_at=+48h, amount, task_id?}
break_count INT DEFAULT 0
closed_at  TIMESTAMPTZ NULL
```
Số dư quỹ = `SUM(finance_deposits.amount) WHERE fund_id = ?` (tính runtime, không lưu).
Với khóa kỳ hạn, yêu cầu rút sớm chỉ tồn tại trước `lock_until` và chờ đúng 48 giờ; sau ngày mở khóa
quỹ vận hành như khóa mềm. Mọi lần rút đều tăng `break_count` và xóa yêu cầu đang chờ.

### 2.6 `finance_deposits` — Nơi gửi (sổ thật của 1 quỹ)
```
fund_id → finance_saving_goals ON DELETE CASCADE
name, bank, account_no TEXT
amount BIGINT, rate NUMERIC, term INT
opened_at DATE, matures_at DATE GENERATED ALWAYS AS (opened_at + term tháng), closed_on DATE
```
`matures_at` do DB tự tính theo ngày mở và kỳ hạn, UI không cho nhập tay; ngày cuối tháng được PostgreSQL
xử lý theo lịch thực tế.

### 2.7 `finance_income_rules` — Thu định kỳ (segment `in`)
```
name, source TEXT, category_id TEXT
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
Tổng hạn mức = mẫu số duy nhất của mọi tỉ lệ. Hạn mức ba mức luôn cố định bằng 50% / 30% / 20%
của tổng hạn mức; chi thực tế được gom theo `necessity` để so với ba ngưỡng đó.

### 2.10 Junction `finance_transaction_tags` + VIEW
```sql
finance_transaction_tags (transaction_id → finance_transactions, tag_id → tags, PK cả hai)
-- VIEW tagged_items tạo lại: bỏ expense/subscription, thêm:
UNION ALL SELECT tag_id, 'finance'::text, transaction_id FROM finance_transaction_tags
```

### 2.11 `finance_category_overrides` — taxonomy riêng theo người dùng
```sql
user_id, category_id TEXT, kind TEXT
label, color, icon, hidden, necessity, nature, subs JSONB
UNIQUE (user_id, category_id)
```
JSON vẫn là taxonomy mặc định và giữ key ổn định cho giao dịch. Bảng override chỉ lưu phần người
dùng thay đổi: tên, màu, Phosphor icon, ẩn/hiện, mức cần thiết, tính chất và danh mục con. Không có
nút hoặc contract DB để tạo parent group mới.

**10 bảng chính + 1 junction (11 bảng Finance).** RLS bật hết. Bảng con (transactions/bills/loans/cards/goals/deposits/
income/shortcuts/budgets/category_overrides/junction) policy `FOR ALL USING (user_id = auth.uid())`; junction kiểm
ownership 2 phía như `account_tags`. File có block VERIFY + 3 phép thử phải-báo-lỗi như Vault.

---

## 3. Static content — `src/data/finance-categories.json` (Rule 14)

Một file cho cả feature:
```json
{
  "expenseGroups": [ { "key":"food","label":"Ăn uống","icon":"bowlFood","color":"#e2a94e",
      "subs":[ {"key":"food.grocery","label":"Đi chợ / siêu thị","necessity":"need"}, ... ] }, ... ],
  "incomeGroups":  [ {"key":"luong","label":"Lương", ...}, ... ],                 // 7 nhóm RIÊNG
  "necessityByCat": { "food":"need", ... },                                         // mặc định nhóm
  "shortcutSeed":  [ {"name":"Nước / quán","category_id":"food","subcategory_id":"food.drinks"}, ... ]
}
```
Màu 11 nhóm chi = palette tách biệt (donut đọc được), lấy đúng hex handoff §Design tokens.
`deriveNecessity(cat, sub)` đọc `necessity` ngay trên subcategory trước, rồi mới fallback về
`necessityByCat[cat]`.

> JSON là seed mặc định; UI ghi phần chỉnh sửa vào `finance_category_overrides`. Key đã có giao dịch
> không đổi, nên đổi nhãn/màu/icon không làm hỏng báo cáo cũ.
> `NL_DICT` (15 regex đoán danh mục) là **hằng số logic**, nằm trong `financeLogic.js` (không JSON).

---

## 4. Logic thuần — `src/utils/financeLogic.js` (+ `src/__tests__/financeLogic.test.js`)

Không React, không Supabase — testable bằng `node:assert` (bám CLAUDE.md §Testing). Wire vào
`npm test`. Các hàm:

| Hàm | Việc |
|---|---|
| `periodTotals(txs, {from,to}, {savingAsExpense})` | **Nơi tính tổng DUY NHẤT.** Bỏ `excluded`; trả `{total, byCategory, byNecessity, count, days}`. `income` tách riêng. `saving` mặc định tách riêng; khi bật tuỳ chọn chỉ tiền gửi vào quỹ được tính như chi bắt buộc, tiền rút không bị tính lại. |
| `comparePeriods(cur, prev, mode)` | 3 nhánh: tháng đang chạy → cùng cửa sổ ngày; 2 tháng trọn → so tổng; năm chưa trọn → so mức/ngày. |
| `deriveNecessity(cat, sub, cats)` | `subcategory.necessity ?? necessityByCat[cat]`. |
| `parseNaturalLanguage(text)` | `"cà phê 35k"` → `{amount, categoryId, subId}` qua `NL_DICT` + `parseCurrencyInput` (tái dùng). |
| `budgetBreakdown(totals, budgets)` | Ngưỡng cố định 50/30/20 của tổng hạn mức; so chi thực tế theo `necessity`; "cắt được X". |
| `cardFloat(card, today, blendedRate)` | ngày chốt→đến hạn, số ngày float còn lại, lãi ước kiếm từ float. |
| `loanSchedule(loan)` | `interest` (chỉ lãi, gốc cuối kỳ) vs `amort` (đều gốc+lãi). |
| `fundBalance(deposits)` | `SUM(amount)` + lãi suất bình quân gia quyền. |
| `spendingRhythm(txs, unit)` | cột theo ngày (1 tháng) / theo tháng (cả năm) + đường trung bình. |

`BLENDED_RATE` = lãi suất bình quân gia quyền của tiền đang gửi (từ `finance_deposits`), truyền vào.

---

## 5. Hook dữ liệu hợp nhất (Supabase, auth-gated)

`src/hooks/useFinance.js` tải và quản lý cả 10 bảng vì hầu hết màn hình cần nhiều tập dữ liệu cùng
lúc. CRUD đơn bảng đi thẳng Supabase; mọi lệnh chạm nhiều bảng gọi 7 RPC DB nguyên khối:
`payBill`, `skipBillPeriod`, `receiveIncome`, `recordLoanPayment`, `payCardStatement`,
`requestSavingWithdrawal`, `moveSaving`. Trigger suy `term_done`/`received_periods`/`loan.done` từ
giao dịch liên kết. Guest chỉ thấy cổng đăng nhập, không có graph dữ liệu in-memory giả.

---

## 6. UI — module shell + **child bar trong sidebar chính** + 5 màn

Route `/finance/:screen?` dùng URL làm nguồn điều hướng. `FinancePage` là **module shell**:

```
┌ sidebar chính app (232px)          ┬ nội dung + header sticky                         ┐
│  Inbox / Nhiệm vụ / …              │  [header: tên màn + chip ngân sách tháng]        │
│  Finance                         ◄  │  ...                                             │
│    ├ Tổng quan                      │                                                  │
│    ├ Nhập nhanh (phím N)            │                                                  │
│    ├ Giao dịch                      │                                                  │
│    ├ Danh mục                       │                                                  │
│    └ Hóa đơn                        │                                                  │
```

Mục Finance xổ 5 child bar trực tiếp bên dưới trong sidebar chính. `screen` = URL param với 5 giá trị
`overview|add|list|cats|recurring`. Tổng quan có tab nội bộ `overview|budget|stats` trên cùng một
route; `recurring` có segment `out|in|loan|card`; `cats` có tab `cats|fields`.
`< 760px`: child sidebar → **hàng sub-tab ngang** (scroll ngang) ngay dưới header; sidebar chính →
bottom-tabs (đã có). Điều hướng chéo giữ qua 1 context nhỏ `FinanceNav` (setScreen + params):

- Cảnh báo thẻ tới hạn (Tổng quan) → `recurring` segment `card`
- Bấm danh mục ở legend donut → `overview?view=stats` đã chọn sẵn nhóm
- Chip ngân sách header → `overview?view=budget`
- Hộp "Cần bạn ghi" (Nhập nhanh) → ghi xong → giao dịch bình thường

**5 màn** (chi tiết bám handoff §Từng màn — không lặp lại đây, tóm điểm phải đúng):
1. **Tổng quan** — ba tab Tổng quan / Ngân sách / Thống kê. Tab Tổng quan có cảnh báo thẻ (nếu có), picker tháng/năm (chọn tháng bất kỳ, Cả năm, Tất cả,
   ‹ › kỳ trước/sau, **chung state với Giao dịch**),
   4 chỉ số, donut + legend bấm được + khối "Bắt buộc đến đâu" (thanh 3 màu), nhịp chi (đổi đơn vị
   theo kỳ), khoản lớn nhất và quỹ tiết kiệm tóm tắt. Tab Ngân sách ghim tháng chạy, có hạn mức,
   quỹ và nơi gửi; tab Thống kê có bộ chọn 3/6/12 tháng và bốn chế độ báo cáo. Không có hàng chờ
   duyệt Inbox tự động.
2. **Nhập nhanh** — ô NL (`NL_DICT`), 5 shortcut (không chốt tiền, chip `recent_amounts`), form;
   hộp "Cần bạn ghi" chỉ gồm hóa đơn `ask` tới hạn; bắt buộc chọn nguồn tiền;
   segmented Chi/Thu/Để dành; cảnh báo trùng quy tắc định kỳ.
3. **Giao dịch** — bộ lọc kỳ chung + tìm + chip lọc; nhóm theo ngày thật (thứ trong tuần đúng,
   "Hôm nay/Hôm qua"); nhãn `auto` cho khoản do quy tắc sinh; **cột chi tiết 340px** desktop (ẩn
   hẳn <760px). Chi tiết giao dịch có **ô gắn Task** + link Inbox nguồn (xem §7).
4. **Danh mục** — 11 nhóm chi + 7 nhóm thu; parent là tập đóng. Bút sửa mở editor ngay trong card
   (không modal), đẩy hàng dưới xuống; cho sửa nhãn, màu, Phosphor icon, ẩn/hiện, mức cần thiết,
   tính chất và danh mục con. Tab Schema mô tả đủ bảng, FK và nguyên tắc tính tổng.
5. **Hóa đơn** — 4 segment 1 hàng, nút Thêm cùng hàng (nhãn đổi theo segment), form mở ngay dưới.
   `out` fixed/ask + trả góp kết thúc; `in` không quá hạn; `loan` interest/amort (gốc `excluded`);
   `card` chốt≠đến hạn + float + lãi ước + cảnh báo phí.
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
- Finance không tự tải, phân loại hoặc hiển thị hàng chờ duyệt Inbox. Chỉ mục được người dùng chủ
  động gửi từ Inbox mới mở form Finance và tạo liên kết `inbox_item_id`.

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
- Icons: **Phosphor** qua `@phosphor-icons/react`; toàn app dùng mapper tập trung `AppIcon` và tên
  semantic trong JSON, không dùng emoji làm icon UI.

CSS: `src/styles/finance.css` cho hệ Nocturne + `src/styles/finance-handoff.css` cho các surface mở rộng.

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
| `data/migration_v6.0.0_finance.sql` | Mới: DROP cũ + 10 bảng chính + junction + view |
| `data/schema_v4.24.0.sql` | **KHÔNG sửa** — theo đúng precedent Vault: migration layer chồng lên master (master tạo expenses/subscriptions → migration drop). Không retro-edit master cho module mới. |

Kiểm lại lúc code (grep đã thấy nhưng chỉ là comment/không đụng logic): `taskFields.js` (comment
`expense_add` lịch sử), `useActivityLog.js`, `IncubatorPage.jsx`, `GenericModal.jsx`, `logger.js`.

---

## 12. Docs & versioning (bắt buộc — RULES §8, §13)

Cập nhật: `CHANGELOG.md` (v6.0.0 Added/Changed/Removed), `package.json` version, `docs/FEATURES.md`
(viết lại §Finance), `docs/DATABASE.md` (10 bảng finance_*, drop expenses/subscriptions),
`docs/ARCHITECTURE.md` (hook/page/component mới), `docs/TASKS.md`, `docs/PLAN.md`.

---

## 13. Trình tự code (1 đợt, đúng thứ tự phụ thuộc)

1. `migration_v6.0.0_finance.sql` + `finance-categories.json` (không retro-edit master schema).
2. `financeLogic.js` + test → `npm test` xanh.
3. Hooks (useTransactions → còn lại) + rewire `useTags`.
4. Module shell + child sidebar + `FinanceNav` context.
5. 5 màn theo thứ tự: Tổng quan (gồm Ngân sách + Thống kê) → Nhập nhanh → Giao dịch (+ liên kết
   Task/Inbox) → Hóa đơn → Danh mục.
6. `finance.css` (Nocturne) + animation.
7. Rewire Inbox/SubAlert/Settings; xoá file cũ.
8. Docs + changelog + version. (User build + test cuối.)

---

## 14. Ngoài phạm vi v1 (đã chốt hoãn)

- Auto-sinh task nhắc từ nghĩa vụ quá hạn/tới hạn/đáo hạn.
- `activity_logs` khi thanh toán.

---

## 15. Quyết định thiết kế đã chốt

- Icon toàn app dùng Phosphor; emoji chỉ còn là nội dung người dùng nhập, không phải icon điều khiển.
- Module Finance giữ Nocturne dark-only, scoped trong `.finance-module` để không ảnh hưởng theme app.
