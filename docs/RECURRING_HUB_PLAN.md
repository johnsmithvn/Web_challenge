# PLAN — Redesign màn "Định kỳ & Quỹ" theo bản chốt

> Trạng thái: **Proposed** — chưa triển khai, chờ user duyệt (task chạm > 5 file).
> Nguồn thiết kế: `Downloads/Giao dịch — 5 phương án/Định kỳ & Quỹ (bản chốt).dc.html`
> Ngày lập: 2026-10-10. File này là plan tạm — xong việc thì xóa, nội dung còn giá trị chuyển vào
> `DESIGN_FINANCE.md` / `FEATURES.md` / `CHANGELOG.md` (RULES §11).

---

## 0. Đọc trước khi code (bắt buộc, theo thứ tự)

| # | File | Đọc để biết |
|---|------|-------------|
| 1 | `docs/RULES.md` | §3 data owner + logic pure, §5 UI, §10 test, §13 checklist, §14 layout |
| 2 | `DESIGN.md` (root) | Design system chung, Workspace 100dvh |
| 3 | `docs/DESIGN_FINANCE.md` | Hợp đồng Nocturne của Finance (token `--n-*`, light/dark) |
| 4 | `src/components/finance/RecurringScreen.jsx` | Toàn bộ logic hiện có — **mọi hành vi ở đây phải còn sau redesign** |
| 5 | `src/__tests__/finance/financeScreensContract.test.js` | Các assert regex đọc thẳng source RecurringScreen |
| 6 | `src/hooks/useFinance.js` (dòng 270–440) | Tên mutation thật |
| 7 | `src/utils/financeLogic.js` | `billCycle`, `billSettled`, `loanCycle`, `cardStatementSummary`, `cardCarryOver`, `lendingInterest`, `fundBalance` |
| 8 | Mockup `.dc.html` dòng 376–561 | Logic mẫu (dữ liệu trong mockup là **giả**, xem §2) |

---

## 1. Lỗi trong plan cũ (đã kiểm với source)

| # | Plan cũ nói | Thực tế | Sửa thành |
|---|-------------|---------|-----------|
| 1 | "≤ 2 file, an toàn < 5 file" | Đụng tối thiểu: `RecurringScreen.jsx`, `finance.css`, util pure mới, test mới, `package.json`, `financeScreensContract.test.js` (có thể), `DESIGN_FINANCE.md`, `FEATURES.md`, `CHANGELOG.md` → **≥ 8 file** | Phải được user duyệt trước (CLAUDE.md bước 5). Giữ nguyên `nav.recurringSeg` để KHÔNG phải sửa `FinancePage`, `OverviewScreen`, `HomeDashboard`, `dashboardAlerts` (xem §3.1) |
| 2 | "Bảo toàn `dueState` có `neverLate`" | `dueState` trong source **không có** `neverLate`. Test tự chép lại một bản riêng có `neverLate`, không import từ source | Giữ nguyên `dueState` như source. Không thêm/bớt nhánh |
| 3 | "8 luồng xóa qua `nav.confirmDelete`" (ngụ ý trong RecurringScreen) | 8 là tổng của **4 file**. RecurringScreen có đúng **4** (bill, loan, lend, card). Test assert `=== 8` | Sau redesign RecurringScreen vẫn phải có **đúng 4** lệnh `nav.confirmDelete(` — không gộp thành 1 hàm chung, không thêm luồng xóa mới |
| 4 | Nút "Bỏ đánh dấu (Undo)" cho cả khoản **Đã trả** | Không có API "hủy thanh toán". Hủy trả = xóa giao dịch → luồng xóa mới → vỡ test count và rủi ro mất data | Undo **chỉ** cho "Bỏ kỳ" của hóa đơn (`unskip` → `updateBill({ skipped_periods })`, đã có). Khoản đã trả: hiện "Đã trả dd/mm" + link sang màn Giao dịch |
| 5 | "Thanh toán: tích hợp PayBlock **hoặc inline confirm**" | Mockup bấm 1 phát là `paid`, không hỏi số tiền/ngày. Hóa đơn `amount_mode: 'ask'` (điện, nước) bắt buộc nhập số | **Luôn dùng `PayBlock`** hiện có (số tiền, ngày trả thật, kỳ, nguồn thẻ, task) |
| 6 | "Form sửa nhanh: Tên, Số tiền, Ngày, Chu kỳ, NCC, Ghi chú" (form mới) | `RuleForm` đã có đủ field + validation từng loại (vd `every > 1` bắt buộc `anchor_date`, auto-K tắt khi sửa) | Render `RuleForm` có sẵn trong panel phải (`initial={item}`). Không viết form mới |
| 7 | Bộ chọn tháng `< T10/2026 >` | Mọi hàm kỳ (`billCycle`, `loanCycle`, `cardStatementSummary`, `daysUntilDue`) tính theo `fin.today`. Xem tháng khác = viết lại logic kỳ + các nút trả sẽ ghi sai kỳ | **Cắt khỏi v1** (YAGNI). Header chỉ hiện "Tháng 10/2026" tĩnh. Cần thì làm task riêng |
| 8 | Timeline: Tuần này / Tuần sau / Cuối tháng / Không có kỳ / Đã xong | Thiếu kỳ **quá hạn từ tháng trước** (hóa đơn quý lỡ từ tháng 7, sao kê cũ `cardCarryOver`, kỳ vay trễ) — code hiện tại có tính (`unpaidBills` gồm `days < 0`) | Thêm nhóm **"QUÁ HẠN"** trên cùng |
| 9 | Quỹ: "Quản lý sổ tiết kiệm và mục tiêu quỹ (goals, deposits)" | Tab Quỹ hiện là `SavingsWorkspace` (import từ `AnalyzeScreen`) — cả một workspace. `moveSaving` bắt buộc có `deposit`; quỹ chưa gắn nơi gửi thì **không góp được** (mockup "Quỹ An Gia · Chưa gắn sổ nào" nhưng "Đã góp" là không thể) | Hàng Quỹ dùng `goal.auto_deposit {amount, day}`. Panel phải hiện thông tin + nút **"Mở quản lý quỹ"** render `SavingsWorkspace` sẵn có. Không viết lại quản lý sổ |
| 10 | Chart 6 kỳ cho mọi loại | Mockup dùng số **random** (`hist()` seed). Thẻ/cho vay không có kỳ cố định | Chart chỉ cho **hóa đơn** (giao dịch `bill_id`), **khoản vay** (`loan_id`), **quỹ** (`saving_goal_id`, `saving_dir='in'`). Dựa trên `BillHistory` có sẵn |
| 11 | Token `var(--n-txt1)`, `var(--bg-primary)` | Finance dùng `--n-txt`, `--n-txt2`, `--n-card`, `--n-sink`, `--n-border`, `--n-accent`, `--n-good`, `--n-warn`, `--n-danger` (dark ở `.finance-module`, light ở `[data-theme="light"] .finance-module`). `--bg-primary` là token global | Chỉ dùng `--n-*`. Màu theo loại → token mới `--n-kind-*` khai báo **ở cả 2 khối** dark/light |
| 12 | Mobile: FAB tròn "+ thêm nguồn chi" góc phải dưới | App đã có QuickCapture FAB toàn cục → đè nhau (RULES §14.3) | Không thêm FAB. Nút "+ Thêm" ở header, mobile thu thành icon |
| 13 | Đọc `docs/DESIGN_SYSTEM.md` | CLAUDE.md yêu cầu `DESIGN.md` + Finance có contract riêng `DESIGN_FINANCE.md` | Xem §0 |
| 14 | Normalizer "trong RecurringScreen hoặc util" | RULES §3: logic ngày/tiền/kỳ không tầm thường **phải** pure + test | Bắt buộc ở `src/utils/recurringHub.js` + test |
| 15 | Không nhắc tính năng nào sẽ mất | Redesign dễ làm rơi: bật/tắt hóa đơn, nhân bản, nhóm "đang tắt", "đã kết thúc", ghi chú hóa đơn, giải thích "Kỳ", cảnh báo thẻ (nợ cũ, float, phí năm, rút tiền mặt), tách gốc/lãi vay, lãi cho vay + `ForfeitCalc`, handoff từ Inbox, hỏi trước khi bỏ form đang gõ, skeleton loading, empty state | Checklist parity ở §6 — mục nào bỏ phải được user đồng ý |

**Gotcha test (dễ vỡ không hiểu vì sao):**
- `assert.doesNotMatch(recurringSrc, /amount:\s*\d+/)` quét **cả file** RecurringScreen.
  Viết `amount: 0` ở bất kỳ đâu trong file là test fail. Dùng `amount: null` hoặc tính toán (`amount: sum`).
- `assert.match(recurringSrc, /value:\s*'saving'/)` → giữ hằng `SEGMENTS` có `value: 'saving'`.
- `assert.doesNotMatch(..., /onClick=\{\(\) => fin\.delete/)` → xóa luôn qua hàm có `await nav.confirmDelete`.

---

## 2. Map dữ liệu mockup → dữ liệu thật

Mockup có 1 kiểu item phẳng `{ id, kind, n, sub, ic, ev: { d, amt, st, paidOn }, prog, info }`.
Normalizer pure (§4 Phase 1) tạo đúng kiểu đó từ `fin`:

| kind | Nguồn | `ev` (sự kiện tiền RA trong tháng) | `st` | Thanh tiến độ | Hành động chính |
|------|-------|-----------------------------------|------|---------------|-----------------|
| `bill` | `fin.bills` (`enabled && !finished_at`) | `billCycle(bill, today, billSettled(...))`: có kỳ thuộc tháng này hoặc `days < 0` → `d = due.slice(8)`, `amt = billAmountEstimate` | `paid` nếu có tx `bill_id + bill_period`; `skip` nếu period ∈ `skipped_periods`; còn lại `due` | Có `term_total` → kỳ x/y (`TermProgress`); không → ngày đã trôi trong kỳ | Thanh toán (`PayBlock` → `fin.payBill`), Bỏ kỳ (`skipBillPeriod`), Bỏ đánh dấu (chỉ khi `skip`) |
| `card` | `fin.cards` (`!closed_at`) | `cardStatementSummary(...).outstanding + cardCarryOver?.amount > 0` → `d = due_day` | `due` khi còn nợ sao kê; `paid` khi `outstanding = 0` và có tx trả kỳ; nợ chưa chốt → `ev = null` | `cardBalance / credit_limit` | Trả sao kê / Trả sớm dư nợ (`payCardStatement`) |
| `loan` | `fin.loans` (`!closed_at`) | `loanCycle(loan, today, txs)` → `d = due.slice(8)`, `amt = monthlyInterest` (interest) hoặc `monthlyPayment` (amort) | `paid` khi `cycle.done`; `null` cycle (đủ kỳ) → `ev = null` | `progress.done / total` | interest: Trả lãi (`payLoanInterest`) + Tất toán gốc khi `due_at <= today` (`payLoanPrincipal`); amort: Trả kỳ (`payLoanInstallment`) |
| `save` | `fin.goals` (`!closed_at`) | Có `auto_deposit.amount` → `d = auto_deposit.day`, `amt = auto_deposit.amount`; không → `ev = null` ("Gửi tay") | `paid` nếu có tx `saving_goal_id = goal.id && saving_dir = 'in'` trong tháng | tổng deposit / `goal.goal` | "Mở quản lý quỹ" → `SavingsWorkspace` |
| `lend` | `fin.lendings` có `left > 0` | `lent_on` thuộc tháng này → `d = lent_on.slice(8)`, `amt = principal` (tiền ra) ; khác → `ev = null`, hiện "Hẹn dd/mm" | `paid` (= "Đã đưa") khi có ev | đã thu / principal | Ghi khoản họ trả (`record` hiện có: gốc qua RPC + lãi là income riêng) |

Màu theo loại (lấy từ mockup, khai báo token):
`bill #6366F1 · card #3B6FD8 · loan #D9822B · save #2F8A57 · lend #0E9384` — kiểm lại độ tương phản trên nền dark `--n-card #202330`, chỉnh sáng hơn nếu cần.

---

## 3. Quyết định kiến trúc

### 3.1 Giữ hợp đồng `nav.recurringSeg` (không đổi file ngoài)

`FinancePage` (state + Inbox handoff), `OverviewScreen` (3 deep link), `HomeDashboard` + `dashboardAlerts`
(`targetSeg: 'out'|'card'|'loan'|'lend'|'saving'`) đều mở thẳng một tab. Không sửa chúng — trong
RecurringScreen map segment cũ sang filter mới:

```js
const SEG_TO_KIND = { out: 'bill', card: 'card', loan: 'loan', lend: 'lend', saving: 'save' };
const KIND_TO_SEG = { bill: 'out', card: 'card', loan: 'loan', lend: 'lend', save: 'saving' };
// filter 'all' không có seg tương ứng → giữ state cục bộ, seg chỉ là giá trị khởi tạo/deep link.
```

`SEGMENTS` giữ nguyên (label thêm/sửa/tạo vẫn dùng cho `RuleForm`, và test cần `value: 'saving'`).

### 3.2 Một file component, một file util

- `RecurringScreen.jsx`: giữ `dueState`, `billDraft`, `cycleLabel`, `CycleBadge`, `RuleForm`, `PayBlock`,
  `ForfeitCalc`, `TermProgress`, `RuleProgress`, `BillNote`, `BillHistory`, `BILL_TEMPLATES`, `BILL_ICONS`.
- **Thay** `BillsList / LoansList / LendsList / CardsList` bằng: `HubTiles`, `HubCalendar`, `HubList`,
  `HubDetail`. Code hành động trong `renderBillCard` / `renderLoanCard` / ... **chuyển** (cut-paste,
  không viết lại) vào `BillDetail`, `LoanDetail`, `CardDetail`, `LendDetail` — mỗi cái giữ 1
  `nav.confirmDelete(` của nó.
- `src/utils/recurringHub.js`: chỉ hàm pure (không React, không Supabase).

### 3.3 Không thêm

Bộ chọn tháng, undo thanh toán, FAB, form sửa mới, chart cho thẻ/cho vay, dependency mới.

---

## 4. Các phase — mỗi phase tự đứng được, chạy được, review được

> Sau mỗi phase: `npm test` + `npx eslint src/components/finance/RecurringScreen.jsx src/utils/recurringHub.js`.
> Test fail → **dừng, báo user** (CLAUDE.md), không tự sửa test.

### Phase 1 — Util pure + test (không đụng UI)

**File:** tạo `src/utils/recurringHub.js`, `src/__tests__/finance/recurringHub.test.js`; sửa `package.json`.

Hàm cần viết:

```js
// 1. Gom 5 nguồn thành item phẳng (bảng §2). Không format tiền ở đây — UI lo.
export function buildHubItems(fin) → Item[]
//   Item = { id, kind, name, sub, icon, source /* row gốc */, ev: { day, due, amount, approx, state, paidOn } | null,
//            progress: { pct, label } , overdue: boolean }

// 2. Ranh giới tuần trong tháng. Tuần bắt đầu Thứ 2, kết thúc CN.
export function weekBounds(todayStr) → { thisWeekEnd, nextWeekStart, nextWeekEnd, monthEnd }
//   Cắt về monthEnd nếu tràn sang tháng sau.

// 3. Chia nhóm timeline
export function groupHubItems(items, todayStr, kindFilter) →
//   [{ key: 'overdue'|'thisWeek'|'nextWeek'|'later'|'none'|'done', label, total, items }]
//   overdue = ev.state==='due' && ev.due < today
//   done    = ev.state in ('paid','skip')
//   none    = ev === null

// 4. Số liệu 6 ô KPI
export function hubTotals(items) → { all, bill, card, loan, save, lend } // mỗi ô { value, sub, pct, count }

// 5. Dữ liệu dải lịch
export function calendarDays(items, todayStr) → [{ day, weekday, isToday, isPast, chips: [{ id, kind, state }] }]
```

Test tối thiểu (`node:assert/strict`, kết thúc bằng `console.log('recurringHub check: OK')`):

- [ ] `weekBounds('2026-10-10')` (Thứ 7) → tuần này hết `2026-10-11`, tuần sau `12–18`.
- [ ] `weekBounds('2026-10-11')` (CN) → tuần này chỉ còn hôm nay.
- [ ] `weekBounds('2026-10-28')` (Thứ 4) → tuần này bị cắt về `2026-10-31`, tuần sau rỗng (nằm ngoài tháng).
- [ ] Tháng 2 năm thường: `calendarDays` ra 28 ngày; `due_day: 31` rơi về ngày 28.
- [ ] Hóa đơn quý không tới lượt tháng này → `ev = null` → nhóm `none`.
- [ ] Hóa đơn quý lỡ từ tháng 7 → `overdue: true`, nhóm `overdue`.
- [ ] Hóa đơn đã bỏ kỳ → `state 'skip'` → nhóm `done`.
- [ ] Hóa đơn `enabled: false` hoặc `finished_at` → không có trong items.
- [ ] Thẻ có `cardCarryOver` → amount = outstanding + carry.
- [ ] Quỹ không có `auto_deposit` → `ev = null`.
- [ ] `hubTotals.all.value` = tổng `amount` các item `state === 'due'`.
- [ ] Filter `'bill'` không trả item kind khác.

Wire: thêm `&& node src/__tests__/finance/recurringHub.test.js` vào script `test` ngay sau
`financeScreensContract.test.js`.

**Xong khi:** `npm test` xanh. Chưa có thay đổi UI nào.

### Phase 2 — Khung layout + danh sách + panel chi tiết (đạt parity chức năng)

**File:** `RecurringScreen.jsx`, `finance.css`.

1. Trong `RecurringScreen`: `const items = useMemo(() => buildHubItems(fin), [fin.bills, fin.cards, fin.loans, fin.goals, fin.lendings, fin.transactions, fin.deposits, fin.today])`.
2. State: `filter` (khởi tạo `SEG_TO_KIND[nav.recurringSeg]`), `selectedId`, `mode: 'view' | 'pay' | 'edit'`, `showDone`.
3. Layout:
   ```
   .fin-hub                      grid-template-rows: auto auto auto minmax(0,1fr); height: 100%
     .fin-hub__head              tiêu đề + "Tháng 10/2026" tĩnh + nút "+ Thêm"
     (tiles — phase 3)
     (calendar — phase 4)
     .fin-hub__body              grid-template-columns: minmax(0,1fr) minmax(0,400px)
       .fin-hub__list            overflow-y: auto; padding-bottom: 40px (né FAB)
       .fin-hub__detail          overflow-y: auto
   ```
4. `HubList`: render `groupHubItems(...)`. Hàng = ngày/thứ · icon 36px · tên + sub · thanh tiến độ · số tiền + `dueState(...).text`. Hàng là `<button type="button">`, có `aria-current` khi đang chọn. Nhóm `done` ẩn sau nút "Xem N khoản đã xong".
5. `HubDetail` chọn theo `kind` → `BillDetail | CardDetail | LoanDetail | LendDetail | SaveDetail`. Mỗi cái lấy nguyên khối hành động từ hàm `renderXCard` cũ (PayBlock, skip, unskip, toggle, duplicate, delete, RuleForm edit, BillNote, BillHistory, cảnh báo thẻ, split gốc/lãi, lending math).
6. Nhóm "đang tắt" + "đã kết thúc/đã tất toán/đã thu xong": giữ dưới cùng danh sách dạng `fin-history-section` như hiện tại.
7. Nút "+ Thêm": menu 5 loại → `adding = kind` → `RuleForm seg={KIND_TO_SEG[kind]}` trong panel phải (giữ logic `dirty` + `nav.confirmDiscard`). Loại `save` → `SavingsWorkspace addingGoal`.
8. Giữ `<details className="fin-explain">` "Kỳ được tính thế nào" trong `BillDetail`.
9. Giữ `!fin.hasLoaded ? <SkeletonList .../>` và các `RulesEmpty`.
10. Xóa các component cũ **chỉ sau khi** mọi hành vi đã chuyển sang Detail.

**Xong khi:** checklist §6 tick đủ; `grep -c "nav.confirmDelete(" RecurringScreen.jsx` = 4; `npm test` xanh.

### Phase 3 — 6 ô KPI kiêm bộ lọc

- 6 `<button aria-pressed={filter===k}>` từ `hubTotals(items)`: icon, nhãn, số lớn (tabular-nums), dòng phụ, thanh % mini, số đếm.
- Bấm ô → `setFilter(k)`; nếu ô thuộc 5 loại thì cũng `nav.setRecurringSeg(KIND_TO_SEG[k])` để back/deep link nhất quán.
- Lọc làm mờ (opacity) chip lịch không khớp, không ẩn (theo mockup).

### Phase 4 — Dải lịch tháng

- Desktop: grid `repeat(N, minmax(0,1fr))`, N = số ngày tháng. Mỗi ngày: cột chip + số ngày + thứ.
- Chip: `due` nền màu loại nhạt; `paid` xám; `skip` viền `1.5px dashed`. Chip đang chọn: `box-shadow` 2 vòng.
- Chip là `<button>` có `aria-label="Tên · số tiền · trạng thái"`; bấm → `setSelectedId` + `scrollIntoView({ block: 'nearest' })` hàng tương ứng (dùng `ref` map theo id).
- Ngày quá khứ chữ nhạt, hôm nay nền `--n-accent-soft`.
- Tôn trọng `prefers-reduced-motion` cho scroll (`behavior: 'auto'`).

### Phase 5 — Mobile (≤ 768px, breakpoint đã dùng trong `finance.css`)

- Ô KPI: `display:flex; overflow-x:auto; scroll-snap-type:x mandatory`.
- Lịch: chuyển sang dải chấm (chỉ CSS + một biến thể render nhỏ).
- `.fin-hub__body` 1 cột; `.fin-hub__detail` thành sheet: `position: fixed; inset: auto 0 0; max-height: 85dvh; transform: translateY(100%)`, mở khi có `selectedId` (`.is-open` → `translateY(0)`). Có nút đóng, `Escape` đóng, backdrop bấm để đóng. **Cùng một component** với desktop, không nhân đôi.
- Không thêm FAB.

### Phase 6 — Tài liệu & kết thúc

- `docs/DESIGN_FINANCE.md`: mục màn Định kỳ (layout hub, token `--n-kind-*`, quy tắc chip).
- `docs/FEATURES.md`: hành vi mới (lọc theo ô, lịch, nhóm timeline, quá hạn).
- `CHANGELOG.md`: entry dưới version hiện tại.
- Xóa file plan này.
- Báo user: file đã đổi, checklist click tay (§7), tradeoff (§3.3). **Không** tự build.

---

## 5. Bảng file bị đụng

| File | Phase | Loại thay đổi |
|------|-------|---------------|
| `src/utils/recurringHub.js` | 1 | Mới |
| `src/__tests__/finance/recurringHub.test.js` | 1 | Mới |
| `package.json` | 1 | Thêm 1 lệnh vào `test` |
| `src/components/finance/RecurringScreen.jsx` | 2–5 | Sửa lớn |
| `src/styles/finance.css` | 2–5 | Thêm block `.fin-hub*`, token `--n-kind-*` ở cả dark + light |
| `src/__tests__/finance/financeScreensContract.test.js` | — | **Không sửa** nếu giữ được 4 confirmDelete + `value: 'saving'`. Nếu buộc phải sửa → hỏi user |
| `docs/DESIGN_FINANCE.md`, `docs/FEATURES.md`, `CHANGELOG.md` | 6 | Cập nhật |

Không đụng: `FinancePage.jsx`, `OverviewScreen.jsx`, `HomeDashboard.jsx`, `dashboardAlerts.js`, `useFinance.js`, `AnalyzeScreen.jsx`, DB/migration.

---

## 6. Checklist parity (không được mất sau Phase 2)

Hóa đơn
- [ ] Thanh toán qua PayBlock (chọn kỳ, ngày trả thật, trả bằng thẻ, gắn task)
- [ ] Bỏ kỳ + Bỏ đánh dấu
- [ ] Bật/tắt (`Toggle`), nhóm "Quy tắc đang tắt"
- [ ] Nhân bản (`billDraft`) → form thêm điền sẵn + toast
- [ ] Sửa (`RuleForm`), cảnh báo "Số mới áp dụng từ kỳ sau"
- [ ] Xóa qua `nav.confirmDelete` (nội dung báo số giao dịch giữ lại)
- [ ] Ghi chú (`BillNote`) + "Thêm ghi chú" focus ô ghi chú
- [ ] Lịch sử kỳ (`BillHistory`)
- [ ] Tiến độ trả góp (`TermProgress`), nhóm "Quy tắc đã kết thúc"
- [ ] Badge chu kỳ (`CycleBadge`), "kỳ sau mm/yyyy" cho hóa đơn nhiều tháng
- [ ] Giải thích "Kỳ được tính thế nào"
- [ ] Tổng còn phải trả + cảnh báo N hóa đơn quá hạn

Khoản vay
- [ ] Trả lãi (interest) / Trả kỳ tách gốc-lãi (amort) / Tất toán gốc khi tới hạn
- [ ] Split: dư nợ gốc, phải trả kỳ này, lãi đã trả, tổng lãi
- [ ] Cảnh báo tới hạn tất toán gốc
- [ ] Lịch sử đã tất toán; Sửa; Xóa qua confirmDelete

Thẻ tín dụng
- [ ] Trả sao kê / Trả sớm dư nợ; mặc định = outstanding + carry
- [ ] Cảnh báo nợ kỳ cũ, float, phí rút tiền mặt, phí thường niên
- [ ] Hạn mức đã dùng; Sửa; Xóa qua confirmDelete

Cho vay
- [ ] Ghi khoản họ trả (tách gốc RPC + lãi income, toast lỗi nửa chừng)
- [ ] Lãi tới hẹn/hôm nay, bù lãi mất, tổng sẽ nhận
- [ ] Lịch sử các lần trả; Lịch sử đã thu xong
- [ ] `ForfeitCalc` + chọn sổ bị đập trong form
- [ ] Xóa qua confirmDelete (thông báo phải xóa giao dịch trước)

Chung
- [ ] Handoff từ Inbox (`nav.handoff.kind`) điền tên vào form thêm
- [ ] Hỏi trước khi bỏ form đang gõ (`nav.confirmDiscard`)
- [ ] Deep link `recurringSeg` từ Tổng quan / Dashboard chọn đúng filter
- [ ] Skeleton khi chưa `hasLoaded`; empty state từng loại
- [ ] Quỹ: `SavingsWorkspace` vẫn mở được đầy đủ

---

## 7. Checklist click tay cho user (sau khi code xong)

> Cần **đăng nhập** (Finance là auth-only, guest không vào được). Cần sẵn dữ liệu: ít nhất 1 hóa đơn
> chưa trả, 1 hóa đơn đã trả, 1 hóa đơn quý, 1 thẻ có sao kê, 1 khoản vay, 1 quỹ có `auto_deposit`, 1 khoản cho vay.

1. Mở `/finance/recurring` → 6 ô hiện số, lịch có chip, danh sách có nhóm.
2. Bấm từng ô KPI → danh sách lọc đúng, chip lịch không khớp bị mờ.
3. Bấm chip trên lịch → hàng được chọn + cuộn tới, panel phải đổi.
4. Hóa đơn chưa trả → Thanh toán → nhập số/ngày → xác nhận → hàng chuyển nhóm "Đã xong".
5. Bỏ kỳ → Bỏ đánh dấu → quay lại "cần trả".
6. Sửa, Nhân bản, Tắt/Bật, Xóa (phải hiện modal xác nhận) từng loại.
7. Từ Tổng quan bấm cảnh báo thẻ / cho vay / quỹ → mở đúng filter.
8. Dark ↔ light: chữ, chip, thanh tiến độ đọc được.
9. Mobile 375px: ô KPI cuộn ngang, chạm hàng → sheet mở, Esc/nút đóng hoạt động, không đè QuickCapture FAB.

---

## 8. Câu hỏi cần user chốt trước khi bắt đầu

1. **Bộ chọn tháng**: cắt khỏi v1 (đề xuất) hay làm luôn (thành task lớn, phải sửa logic kỳ)?
2. **Undo**: chỉ cho "Bỏ kỳ" (đề xuất) — khoản đã trả muốn hủy thì vào màn Giao dịch?
3. **Quỹ**: panel phải mở `SavingsWorkspace` sẵn có (đề xuất) hay làm lại UI quỹ trong hub?
4. **Duyệt phạm vi ≥ 8 file** theo §5?
