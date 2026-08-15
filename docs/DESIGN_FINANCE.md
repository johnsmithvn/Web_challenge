# DESIGN — Finance v6.0 (Nocturne)

**Trạng thái:** code + migration + local auth/CRUD smoke đã triển khai. Production vẫn user-run theo
README. · **Updated:** 2026-08-09

Đây là hợp đồng sản phẩm/kỹ thuật của module Finance hiện hành, không phải kế hoạch triển khai.

## 1. Ba nguyên lý

1. **Không tính số dư tổng.** App ghi chi, thu và tiết kiệm nhưng không suy “tiền còn lại”. Income
   không là mẫu số mặc định của tỷ lệ nào.
2. **Một sổ giao dịch, lọc theo kỳ.** Mọi số trên UI tính lại từ `finance_transactions.occurred_at`.
   Không lưu aggregate cần đồng bộ ngược.
3. **App ghi nhận, không trả hộ.** Hóa đơn/vay/thu định kỳ chỉ là nghĩa vụ. User xác nhận thì RPC tạo
   transaction thật và cập nhật progress nguyên khối.

50/30/20 dùng tổng hạn mức trong `finance_budgets`, không dùng income.

## 2. Phạm vi thời gian

| Khu vực | Kỳ đọc |
|---|---|
| Tổng quan + Giao dịch | Bộ chọn tháng/năm/tất cả dùng chung trong session |
| Ngân sách | Tháng đang chạy |
| Hóa đơn / Thu / Vay / Thẻ / Cho vay | Tháng đang chạy |
| Thống kê | Bộ chọn riêng 3/6/12 tháng |

So sánh kỳ:

- Tháng đang chạy: so cùng cửa sổ số ngày với tháng trước.
- Hai tháng hoàn chỉnh: so tổng.
- Kỳ dài/chưa hoàn chỉnh: so trung bình mỗi ngày.

## 3. Data model

Migration: `data/migration_v6.0.0_finance.sql`.

| Table | Vai trò |
|---|---|
| `finance_transactions` | Sổ duy nhất; expense/income/saving; Task/Inbox/rule references |
| `finance_bills` | Khoản phải trả fixed/ask + recurrence/skip + `note` của quy tắc |
| `finance_income_rules` | Thu định kỳ |
| `finance_loans` | Vay interest/amort và progress |
| `finance_lendings` | Cho vay — khoản phải thu, thu về nhiều lần |
| `finance_cards` | Ngày chốt/đến hạn/sao kê |
| `finance_saving_goals` | Quỹ + lock policy/withdrawal request |
| `finance_deposits` | Nơi gửi thuộc quỹ + rate/term/maturity |
| `finance_shortcuts` | Mẫu nhập nhanh, không giữ amount cố định |
| `finance_budgets` | Hạn mức category dạng standing; UI áp cho tháng đang chạy |
| `finance_category_overrides` | Custom label/color/icon/subcategory |
| `finance_transaction_tags` | Transaction ↔ central tags |

Migration là clean rebuild của Finance legacy và drop `expenses`, `subscriptions`,
`expense_tags`, `subscription_tags`. Không chạy trên database có dữ liệu Finance thật mà chưa backup và
chưa được user chấp thuận.

### Transaction rules

- `amount > 0`; `type ∈ expense|income|saving`.
- Expense/income phải dùng parent category thuộc tập đóng; saving không dùng category.
- `excluded=true` dùng cho principal/card statement payment và thu về khoản cho vay — không được đếm lại như chi mới hay thu nhập mới.
- Bill/income/loan/card period có uniqueness để chặn ghi cùng nghĩa vụ hai lần.
- Trigger validate ownership các FK Finance/Task/Inbox.
- `source_kind` được suy từ reference, không do UI tự gán tùy ý.

### Saving rules

- Balance quỹ = tổng `finance_deposits`, không có cột balance cache.
- Deposit đáo hạn được suy từ ngày mở + kỳ hạn.
- Lock `term` cần `lock_until`; rút trước hạn tạo request và chỉ hoàn tất sau 48 giờ.
- Lãi suất bình quân là weighted average của deposit thực.

## 4. Taxonomy và input

`src/data/finance-categories.json` là taxonomy mặc định: 11 nhóm chi, 7 nhóm thu, subcategory và mức
cần thiết. Parent key là tập đóng để constraint/budget/report ổn định. User chỉ override presentation
và subcategory hợp lệ; không tạo parent tùy ý.

- Ô tiền/số nguyên sanitize về digit.
- Ô lãi/phần trăm cho phép decimal.
- Natural-language box dùng `parseCurrencyInput` cho amount và `matchCategory`/`NL_DICT` để đoán nhóm.
- Shortcut không lưu amount; user nhập số mỗi lần.

## 5. Navigation và screen contract

`FinancePage` tạo một object `nav` và truyền qua props; không có `FinanceNav` context.

| Route screen | Nội dung |
|---|---|
| `overview` | Tổng quan; query `view=budget|stats` mở hai sub-view |
| `add` | Nhập nhanh, shortcut, form transaction |
| `list` | Search/filter/group/edit/delete/export CSV |
| `cats` | Category editor và schema reference |
| `recurring` | Phải trả, Sẽ nhận, Khoản vay, Thẻ, Cho vay |

### Tổng quan

- Tổng chi, so kỳ trước, trung bình ngày, tỷ lệ fixed.
- Donut category và necessity must/need/want.
- Spending rhythm theo ngày hoặc tháng, khoản lớn nhất, saving summary.
- Budget luôn tháng hiện tại; ngưỡng 50/30/20 trên tổng limit.
- Stats đọc 3/6/12 tháng theo category/comparison/bill/card.

### Nhập nhanh và giao dịch

- Keyboard `N`, natural language, shortcut và full form.
- Expense/income/saving; nguồn, necessity, Task link và Inbox provenance khi conversion.
- List group theo ngày, có filter/search, edit detail, tag, CSV.
- Mobile detail dùng layout thay thế; desktop có detail column.

### Nghĩa vụ

- Bill fixed hoặc ask (ước tính từ ba transaction gần nhất); có skip period.
- Income rule ghi nhận đã thu, không gọi là overdue.
- Loan interest/amort tách principal/interest.
- Card statement dùng đúng khoảng giữa hai ngày chốt, hỗ trợ trả một phần và chặn vượt outstanding.
- Lending (Cho vay) là segment thứ năm: cho mượn **không** phải chi tiêu, thu về **không** phải thu nhập.
  Giao dịch thu về mang `excluded=true`; chặn thu quá số đã cho mượn; thu đủ thì tự đóng.

Năm segment dùng chung một cấu trúc dòng (`RuleCard`): icon nhóm · tên + phụ đề · số tiền + trạng thái ·
sửa/công tắc/xóa, phần mở thêm (khối ghi kỳ, form sửa, lịch sử) nằm ngay dưới dòng đó.

- Sáu trạng thái chỉ đổi **vạch màu trái + dòng chữ**, cấu trúc dòng giữ nguyên: quá hạn · tới hạn hôm
  nay · sắp tới · đã trả kỳ này · đang tắt · đã kết thúc. Màu luôn đi kèm chữ.
- Danh sách sắp theo **ngày trong tháng**, không theo mức khẩn — vị trí một dòng không đổi theo ngày.
- Ghi một kỳ mở **inline dưới dòng**, không modal: số tiền gợi ý bôi đen sẵn, ngày trả có nút nhanh
  (hôm nay / hôm qua / đúng hạn), nguồn tiền dạng chip. Trả sớm không bị chặn.
- Sửa quy tắc dùng lại đúng form thêm (`RuleForm`, hai chế độ). Sửa số tiền **áp dụng từ kỳ sau**; kỳ đã
  ghi không bị viết lại, nên ô số tiền lúc sửa luôn kèm cảnh báo.
- Mẫu hóa đơn chỉ điền tên/nhóm/danh mục con, **không điền số tiền**.
- `finance_bills.note` là ghi chú của **quy tắc**, hiện khi mở dòng và sửa trong form. `finance_pay_bill`
  vẫn ghi `note = bill.name` xuống transaction; ghi chú quy tắc **không** rơi xuống từng kỳ.
- Xóa quy tắc không xóa transaction; hộp xác nhận nói đúng số giao dịch được giữ lại.

## 6. Pure logic API

`src/utils/financeLogic.js` không import React/Supabase/JSON và được test bằng `node:assert`.

| Nhóm | API hiện hành |
|---|---|
| Date/period | `ymd`, `parseYmd`, `addDaysStr`, `daysInclusive`, `listPeriodOptions`, `periodFromKey`, `currentMonthPeriod` |
| Totals/comparison | `periodTotals`, `comparePeriods`, `spendingRhythm`, `groupByDate` |
| Category/budget | `deriveNecessity`, `matchCategory`, `budgetBreakdown`, `suggestedDailySpend` |
| Card/loan/bill | `cardCycle`, `cardBalance`, `cardStatementSummary`, `floatInterest`, `loanSchedule`, `billAmountEstimate` |
| Saving | `fundBalance`, `blendedRate`, `maturityWarn` |

`periodTotals` là nơi tính tổng duy nhất. Function cần taxonomy nhận `cats` qua tham số để pure test
không phụ thuộc JSON loader.

## 7. Write boundary

`useFinance` sở hữu state/action của toàn module thay vì mười hook CRUD gần giống nhau. Lý do: các màn
đọc nhiều bảng cùng lúc và RPC ghi chéo transaction/rule.

Tám RPC user-facing:

- `finance_pay_bill`
- `finance_skip_bill_period`
- `finance_receive_income`
- `finance_record_loan_payment`
- `finance_pay_card_statement`
- `finance_record_lending_repayment`
- `finance_request_saving_withdrawal`
- `finance_move_saving`

RPC/trigger phải tự validate owner, reference, amount/period và rollback nguyên transaction khi lỗi.

## 8. Cross-module integration hiện có

### Task

Transaction có `task_id`; form/detail cho chọn hoặc đổi Task. Hiện **chưa có** clickable Task chip,
navigation mở Task hoặc báo cáo “đã chi cho Task này”. Không mô tả ba feature đó là đã triển khai.

### Inbox

Inbox handoff `kind=tx` hoặc `kind=out` qua `lh_inbox_to_finance`. Finance prefill và ghi
`inbox_item_id`, sau đó Inbox item nguồn bị xóa. FK là `ON DELETE SET NULL`, nên đây là conversion
provenance tạm chứ không phải link bền để mở ngược source.

### Tags

Chỉ transaction có central tag qua `finance_transaction_tags`. `tagged_items` branch Finance dùng
kind `finance`. Vault tag không liên quan vì được mã hóa.

## 9. Nocturne visual contract

- Scope trong `.finance-module`; không thay token global.
- Dark Nocturne là bản thiết kế của module, nhưng mọi text/control vẫn phải đọc được trong shell app.
- Phosphor icon qua `AppIcon`; emoji không dùng làm icon điều khiển.
- Desktop có child navigation trong sidebar; mobile giữ vùng chạm và sheet/detail phù hợp.
- Money dùng tabular figures; trạng thái không truyền bằng màu một mình.
- Keyboard/focus/reduced-motion là yêu cầu, không phải polish tùy chọn.

## 10. Security và status

- Module auth-only; không có guest state.
- Mọi bảng bật RLS; junction kiểm hai phía; FK cross-domain có owner validation.
- Không remote-push/link/reset production từ agent.
- Local migration/transaction CRUD đã smoke. Bảy RPC đầy đủ, cross-module flows và responsive data-dày
  vẫn nằm trong `TASKS.md` cho tới khi có bằng chứng kiểm xong.

## 11. Cố ý ngoài phạm vi

- Tự sinh Task nhắc từ nghĩa vụ.
- Ghi `activity_logs` khi thanh toán.
- Tính số dư tổng hoặc “tiền của tôi”.
- Tự động trả/thu thay user.

Chỉ mở các mục này khi có use case thật và một data consumer rõ ràng.
