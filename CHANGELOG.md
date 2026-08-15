# CHANGELOG

## Unreleased

### Added
- **Khối "Linked from" trong Vault — item đích thấy được ai đang trỏ tới mình.** Field `link` chỉ lưu
  ở item **nguồn**, nên tài khoản ngân hàng bị 5 thẻ link tới vẫn hiện ra như chẳng liên quan gì. Giờ
  quét ngược mảng `items` (đã giải mã sẵn ở `AccountsPage`, không thêm query/bảng/cột) và liệt kê chip
  `.acc-link` dẫn ngược lại. Một item link qua 2 field thì ra 2 dòng. Ẩn khi đang sửa vì bấm đi là mất
  draft.
  - **Mỗi link ngược đọc như một dòng field**, không phải chip nằm chung một rổ: cột nhãn là **ô đã
    trỏ tới đây** (`Bank login`), cột giá trị là chip item nguồn, cột phải là nút `Details`. Bấm
    Details **xổ giá trị ngay tại chỗ** (`.acc-backdetail`, dạng nhãn/giá trị) — link kiểu này hầu hết
    để liếc ("thẻ nào của bank này, hết hạn bao giờ"), nhảy sang item rồi quay lại thì mất chỗ đứng.
  - Giá trị xổ ra lấy qua `linkableValues()` — vốn đã là **nơi duy nhất** định nghĩa "cái gì được hiện
    mà không cần Reveal", nên secret (mật khẩu, CVV, PIN) không thể rò qua đường này. Hàm trả thêm key
    `field` để dựng hai cột, không phải cắt chuỗi `label` của `<option>`.
- **Hóa đơn nhiều tháng một lần** (`finance_bills.anchor_date` + `rrule.every`, migration
  `data/migration_v6.7.0_finance_bill_multi_month.sql` — user tự chạy trên hosted). Netflix trả theo
  quý, bảo hiểm theo năm: trước đó chỉ có "Mỗi tháng" nên phải nhớ ngoài app. Chu kỳ 1/2/3/6/12 tháng;
  `anchor_date` chỉ quyết định **tháng nào tới lượt**, ngày trong tháng vẫn lấy `due_day` — **ngày cố
  định thắng ngày bắt đầu**, bỏ trống ô ngày thì app lấy ngày của mốc bắt đầu.
  - `rrule.every` không cần sửa CHECK: `finance_valid_rrule` không cấm key thừa. Kỳ vẫn là `YYYY-MM`
    nên `bill_period` và `unique_finance_tx_bill_period` giữ nguyên — mỗi tháng vẫn tối đa một kỳ.
  - `billCycle()` thành **nơi duy nhất** quyết định kỳ của một hóa đơn, thay cho `today.slice(0,7)` rải
    rác. Tháng không tới lượt thì dòng ghi "kỳ sau 11/2026", Nhập nhanh không liệt kê, danh sách kỳ cũ
    trong khối trả lùi theo đúng chu kỳ (hóa đơn quý không liệt kê 6 tháng liền).

### Added
- **Trả góp: nhập tổng nợ + thanh tiến độ theo ô.** Ô *Tổng nợ · tùy chọn* chia đều cho số kỳ rồi điền
  vào ô Số tiền — **không thêm cột DB**, thứ được lưu vẫn là số mỗi kỳ để mọi phép tính (ước lượng, còn
  lại, báo cáo) chạy trên một con số duy nhất. Tiến độ đổi từ thanh liền 5px sang **mỗi kỳ một ô**
  (`TermProgress`, ≤12 kỳ; nhiều hơn thì quay về thanh liền vì ô nhỏ như hạt gạo), kèm `đã trả X · còn Y`
  — thanh liền không trả lời được câu hỏi thật của người đang trả góp là "còn mấy kỳ nữa".

### Fixed
- **Trả thêm một kỳ mà tiến độ trả góp LÙI LẠI** (`finance_bills.term_offset`, migration
  `data/migration_v6.8.0_finance_bill_term_offset.sql` — user tự chạy trên hosted). `term_done` có hai
  nguồn ghi cãi nhau: user gõ tay ô "Đã trả bao nhiêu kỳ" khi khai một khoản trả góp đang chạy dở (3/6,
  các kỳ cũ không định ghi thành giao dịch), còn trigger `finance_refresh_bill_progress()` thì ghi đè
  `term_done = COUNT(giao dịch)`. Bấm Thanh toán lần đầu là 3 bị thay bằng 1 — tiến độ lùi, số còn nợ
  vọt lên, và số user nhập mất hẳn.
  - Tách thành hai dữ liệu vốn khác nhau: `term_offset` (user nhập, app không đụng) và `term_done`
    (thuần suy ra = `term_offset + COUNT`). Ô trong form đổi nhãn thành **"Đã trả trước khi dùng app"**
    và ghi vào `term_offset`; client không còn gửi `term_done`.
  - Migration backfill `term_offset = term_done - COUNT(giao dịch)` nên số đã nhập không mất, rồi tính
    lại toàn bộ `term_done` và verify không hóa đơn nào lệch công thức trước khi COMMIT.
  - Dải ô tiến độ tô **mờ** các kỳ có từ trước (viền accent, ruột nhạt) để phân biệt với kỳ đã ghi thành
    giao dịch trong app — cùng là "đã trả" nhưng chỉ loại sau mới mở ra xem được.
- **Sửa/xóa giao dịch xong, tiến độ hóa đơn vẫn đứng số cũ tới lúc F5.** `term_done` (và tiến độ khoản
  vay, kỳ đã nhận của thu định kỳ) là số **suy ra** từ giao dịch — trigger `finance_transaction_progress_sync`
  đếm lại trong DB. Nhưng `updateTransaction`/`deleteTransaction` chỉ sửa state giao dịch, không kéo rule
  về, nên dòng hóa đơn hiện `kỳ 4/6 · còn 5.028.000đ` trong khi Lịch sử các kỳ đã trống trơn. Giờ giao
  dịch có gắn rule thì sau khi sửa/xóa/thêm sẽ `fetchAll()` cho khớp DB (RPC thanh toán vốn đã làm việc này).

### Added
- **`SkeletonList` — khung chờ dạng danh sách, áp cho toàn bộ màn list** (`src/components/SkeletonList.jsx`
  + `src/styles/skeleton.css`). Trước đó Finance không hiện gì (trang trống rồi list bật ra), sáu màn
  còn lại hiện đúng một dòng chữ "Đang tải…" — cả hai đều làm layout nhảy một cái khi data về.
  - Dòng skeleton giữ **đúng chỗ** của dòng thật (icon 34px · hai dòng chữ · khối số bên phải), bề rộng
    so le theo chu kỳ 3 để không thành khối chữ nhật đều tăm tắp.
  - **Một** vệt sáng chạy ngang cả danh sách thay vì mỗi ô tự nhấp nháy — một layer animate, và mắt đọc
    là "đang tải" chứ không phải "hỏng". Đảo màu ở light theme, `prefers-reduced-motion` tắt vệt sáng.
  - Áp tại 11 chỗ: Hóa đơn · Giao dịch · Nhiệm vụ (cả khối đã hoàn thành) · Inbox · Knowledge · Ghi chú ·
    Tài khoản · Incubator · Tag · Quote · `PageSkeleton` (Suspense của route lazy-load, viết lại để bỏ
    inline style và thẻ `<style>` nhúng).
  - **Đang tải thì không hiện empty state** — trước đây màn Giao dịch/Hóa đơn báo "chưa có gì" ngay cả
    khi data đang trên đường về. Xóa luôn `.settings-loading`, `.inbox-page__loading`,
    `.task-inline-status` đã thành CSS chết.

### Changed
- **Ô ngày gõ tay được, và popover lật lên khi dưới hết chỗ.** Trước đó chỉ bấm chọn trong lịch (chậm
  khi cần lùi vài tháng), và ô ngày nằm cuối trang thì popover mở xuống làm nút Lưu rơi ra ngoài vùng
  cuộn — coi như không bấm được. Giờ ô nhận `dd/mm/yyyy` gõ thẳng (tự chèn `/`, `parseDmy()` từ chối
  29/02 năm thường và 31/04 rồi trả ô về giá trị cũ khi rời ô), nút lịch nằm bên phải; popover đo chỗ
  trống rồi mở lên hoặc xuống.
- **Nói thẳng cơ chế "kỳ" trên giao diện** thay vì để user tự suy: chip `⟳ 3 tháng/lần` cạnh tên hóa
  đơn không chạy hằng tháng (hằng tháng cố tình không có chip — gắn cho mọi dòng thì chip vô nghĩa),
  hộp gập **"Kỳ được tính thế nào"** ở đầu tab Phải trả (4 ý: kỳ ≠ ngày trả · kỳ chạy theo ngày trả ·
  trả xong thì im tới kỳ kế, lỡ kỳ thì vẫn báo quá hạn · sửa nhầm kỳ ở đâu), và bảng schema màn Danh
  mục bổ sung `rrule.every` + `anchor_date` + cách `billCycle()` chọn kỳ.
- **Ô "Ghi vào kỳ" chạy theo ngày trả thay vì chốt cứng lúc mở khối.** Đây là nguồn gốc của cả chuỗi
  "đã trả rồi mà vẫn nhắc": khai một hóa đơn quý hôm nay rồi lùi ngày về 25/07 để ghi lại khoản đã trả
  thật, tiền vẫn bị gắn vào **kỳ sắp tới** vì kỳ chỉ được tính một lần lúc mở khối và không bao giờ nhìn
  lại ngày. `billPeriodForDate()` chọn **mốc kỳ gần ngày trả nhất** — trả muộn vài ngày vẫn thuộc kỳ vừa
  rồi (giữ đúng luật cũ "trả hóa đơn tháng 7 vào tháng 8 vẫn là kỳ 7"), trả sớm vài ngày thì thuộc kỳ
  sắp tới, hòa thì ưu tiên kỳ cũ. Bấm tay một kỳ thì khóa lại, đổi ngày không làm nó nhảy nữa; kỳ suy ra
  mà đã ghi rồi thì lùi về kỳ chưa trả thay vì để DB chặn.
- **Lịch sử các kỳ hiện `kỳ MM/YYYY · ghi dd/mm/yyyy`** thay vì mỗi ngày ghi — hai mốc này khác nhau là
  bình thường, nhưng gắn sai kỳ thì trước đây nhìn vào không tài nào thấy.
- **Giao dịch hiện và sửa được "Thuộc kỳ".** `bill_period` là thứ quyết định hóa đơn có báo quá hạn hay
  không, nhưng màn Giao dịch chưa bao giờ hiện nó — gắn nhầm kỳ là hóa đơn kêu quá hạn dù tiền đã ra
  khỏi ví, mà đường sửa duy nhất là xóa giao dịch rồi ghi lại. Giờ bảng chi tiết có dòng **Thuộc kỳ**,
  và form sửa có ô chọn kỳ (danh sách lùi theo đúng chu kỳ của hóa đơn qua `billPeriods()`, dùng chung
  với khối Thanh toán).
- **Form thêm ở màn Hóa đơn hỏi trước khi vứt nội dung đang gõ.** Đổi segment hoặc bấm Đóng/Hủy giữa
  chừng là mất sạch, không cảnh báo gì. Giờ `nav.confirmDiscard()` (dùng chung `ConfirmModal` sẵn có)
  chặn lại khi form đã có thay đổi so với lúc mở; lưu thành công thì đóng thẳng, không hỏi. "Đã gõ gì
  chưa" so bằng ảnh chụp state lúc mở form — rẻ và chắc hơn gắn cờ vào từng setter.
- **Ô `Brand` của thẻ tín dụng (Vault) gợi ý sẵn tổ chức thẻ.** `<datalist>` native trên `.acc-input`
  (Visa, Mastercard, JCB, American Express, UnionPay, Napas, Discover) — click là chọn, nhưng vẫn gõ
  tay được brand ngoài danh sách nên value cũ không mất. Không thêm field type mới.
- **Mọi ô ngày trong Finance luôn hiện dd/mm/yyyy.** 13 chỗ dùng `<input type="date">` — mà định dạng
  hiển thị của control này do **ngôn ngữ trình duyệt** quyết định (Chrome tiếng Anh ra `07/25/2027`),
  không ép được bằng HTML/CSS/JS. Thay bằng `DateField` (`parts.jsx`) bọc `DatePickerPopover` có sẵn,
  đúng RULES.md §5. `DatePickerPopover` nhận thêm prop `max` để thay attribute `max` của native input
  (ngày trả / ngày đưa tiền vẫn không chọn được tương lai). Ngày trong danh sách khoản lớn nhất và
  lịch sử kỳ cũng đổi từ `2026-08-15` sang `15/08/2026`.

### Fixed
- **Kỳ quý/năm bị lỡ thì biến mất khỏi màn hình.** `billCycle` nhảy thẳng tới kỳ kế mỗi khi tháng đang
  chạy không phải tháng kỳ, nên hóa đơn quý đến hạn 25/07 mà quên trả thì sang 01/08 là mất tăm — không
  quá hạn, không nằm trong tổng, không ai nhắc, tới tận 25/10 mới hiện lại. Giờ nó **bám lại kỳ vừa qua
  khi kỳ đó chưa trả và chưa bỏ** (`billCycle(bill, today, billSettled(bill, txs))`), chỉ khi kỳ đó xong
  mới nhảy tới. Dòng ghi `kỳ 07/2026` (quá hạn) thay vì `kỳ sau 10/2026`.
- **Dải tổng "Tháng N còn phải trả" cộng cả hóa đơn không tới lượt.** Nó hỏi "có giao dịch nào kỳ
  `2026-08` không" cho MỌI hóa đơn, nên hóa đơn quý có kỳ tháng 10 bị tính vào tháng 8. Giờ chỉ tính kỳ
  rơi vào tháng đang xem **cộng** mọi kỳ đã quá hạn. Nhập nhanh và nút Bỏ qua ở đó cũng ghi đúng kỳ của
  hóa đơn thay vì mặc định tháng đang chạy.
- **Ô Số tiền của form hóa đơn chặn luôn nút Tạo.** `pattern="[0-9]*"` còn sót trong khi giá trị hiển
  thị đã nhóm nghìn (`199.000`) → trình duyệt báo "Please match the requested format" và không submit.
  11 ô tiền khác đã là `[0-9.]*` từ trước, chỉ ô này lệch.
- **Sidebar "Sắp tới hạn" nhắc cả những khoản vừa trả xong.** `SubAlert` chỉ đọc `due_day` của hóa đơn
  và ngày đến hạn của thẻ, **không hề query `finance_transactions`** nên không biết kỳ này đã trả hay
  chưa — hóa đơn nước trả sáng nay vẫn nằm đó tới cuối tháng. Giờ widget đọc thêm giao dịch 90 ngày gần
  nhất (đủ phủ kỳ hóa đơn + một chu kỳ sao kê, không kéo cả sổ) và bỏ qua: kỳ đã trả, kỳ đã bỏ, và thẻ
  có sao kê 0đ. Thêm nhãn "Quá N ngày" vì nay số ngày có thể âm.
- **Nhắc phí thường niên của thẻ** (`finance_cards.annual_fee_on`, migration
  `data/migration_v6.6.0_finance_card_annual_fee.sql` — user tự chạy trên hosted). Trước đó app biết
  SỐ TIỀN phí nhưng không biết NGÀY thu, nên phí luôn về bất ngờ — mà đây là khoản duy nhất của thẻ
  có thể xin miễn/giảm nếu biết trước. Cột là DATE chứ không phải ngày-trong-tháng như
  `statement_day`/`due_day`: phí lặp mỗi năm nên cần cả tháng. `nextAnnualFee()` bỏ năm đã lưu và
  tính lại từ hôm nay (29/2 ở năm thường lùi về 28/2). Dòng thẻ hiện ngày thu + đếm ngược, tô cảnh
  báo khi còn ≤30 ngày; sidebar "Sắp tới hạn" nhận thêm mục này khi ≤7 ngày như các nghĩa vụ khác.
- **Segment thứ năm: Cho vay** (`finance_lendings`, migration `data/migration_v6.4.0_finance_lending.sql`
  — user tự chạy trên hosted). Tiền mình cho người khác mượn, thu về **nhiều lần** với số tiền khác nhau
  nên không nhét vào `finance_loans` được. Kèm dải tổng (đang cho vay · đã thu về · hẹn gần nhất), nút
  "Trả hết · X", lịch sử từng lần thu, và **banner ở Tổng quan** khi tới hẹn ≤7 ngày hoặc quá hẹn.
  - Cho mượn **không sinh giao dịch chi** — tiền rời ví nhưng đổi thành khoản phải thu, donut và hạn mức
    nhóm không đổi. Họ trả lại **không tính là thu nhập** (`excluded=true`), nếu tính thì tháng đó thu
    nhập vọt lên ảo và tỉ lệ tiết kiệm sai.
  - Migration sửa hai CHECK của `finance_transactions` (trước chỉ cho `excluded` với trả gốc vay và trả
    sao kê thẻ) và dựng lại chúng thành constraint **có tên** — `finance_tx_branch_shape`,
    `finance_tx_excluded_scope`, `finance_tx_lending_scope`.
  - RPC `finance_record_lending_repayment` chặn thu về quá số đã cho mượn và tự đóng khoản khi thu đủ.
- **Dải tổng cho tab Khoản vay**: tổng dư nợ gốc · lãi phải trả tháng này · hạn tất toán gần nhất, kèm
  câu giải thích vì sao lãi là chi phí còn trả gốc thì không.
- **Ghi chú cho hóa đơn** (`finance_bills.note`, migration `data/migration_v6.3.0_finance_bill_note.sql`
  — user tự chạy trên hosted). Chỗ chứa mọi thứ không đáng có trường riêng: số công tơ, ai đứng tên,
  cách chia tiền với bạn cùng phòng. Hiện trong panel khi bấm mở dòng, sửa trong form, có link
  "Thêm ghi chú" khi trống và dấu ghi chú nhỏ trên dòng. **Không sao chép xuống giao dịch** —
  `finance_pay_bill` vẫn ghi `note = bill.name`, và có assert khoá lại điều đó trong
  `financeMigration.test.js` (mỗi kỳ mang một bản sao ghi chú giống hệt thì rối màn Giao dịch và bảng lọc).
- **Sửa hóa đơn / khoản thu / vay / thẻ ngay trong dòng.** Nút bút chì trên mỗi dòng mở đúng form đã
  dùng để thêm (`RuleForm` một component, hai chế độ) — trước đó tạo xong là không sửa được gì, muốn
  đổi số tiền phải xóa rồi tạo lại, mất luôn liên kết `bill_id` của các kỳ đã ghi. Ô số tiền khi sửa
  kèm cảnh báo vàng **"Số mới áp dụng từ kỳ sau"** vì kỳ đã ghi không bị viết lại.
- **11 mẫu hóa đơn** (Điện, Nước, Internet, Netflix, Trả góp…) điền sẵn tên + nhóm + danh mục con.
  Mẫu **không bao giờ** điền số tiền: bấm qua nhanh mà lưu một con số mặc định thì sai với mọi người dùng.
- **Khối ghi một kỳ mở ngay dưới dòng** thay cho hàng input chen trong cột phải: ô số tiền có nhãn và
  được bôi đen sẵn, ngày trả có nút nhanh *Hôm nay / Hôm qua / Đúng hạn*, nguồn tiền là chip kèm dòng
  giải thích hệ quả, và nút Hủy. Trả bốn hóa đơn liền không phải rời danh sách lần nào.
- **Xóa hóa đơn nói rõ số giao dịch được giữ lại.** `nav.confirmDelete(label, message)` nhận thêm
  message; hóa đơn chỉ là quy tắc nhắc nên các kỳ đã ghi vẫn nằm nguyên ở màn Giao dịch.

### Changed
- **Form thêm dựng lại theo đúng prototype handoff** (`Chi tieu.dc.html`): khối "Chọn loại hóa đơn" với
  20 chip mẫu có icon, lưới 4 cột có nhãn, ghi chú, số tiền dạng segmented `Cố định | Thay đổi từng kỳ`,
  và checkbox "Hóa đơn này có số kỳ hữu hạn" mở ra Tổng số kỳ + Đã trả bao nhiêu kỳ. Bản trước dựng theo
  mô tả trong `HOA-DON.md` — file đó không đặc tả layout form nên nó ra khác handoff.
- **Trạng thái hóa đơn tô đúng như handoff.** Trước: mọi dòng đều có vạch trái nên không dòng nào nổi,
  và mọi mức trễ đều đỏ. Giờ theo đúng bảng màu của prototype — **chỉ ba trạng thái cần hành động** mới
  được tô, tô cả **viền thẻ** lẫn vạch trái: quá hạn ≥4 ngày đỏ · trễ 1–3 ngày vàng · đúng ngày tím.
  Đã trả/chưa tới/đang tắt dùng viền mặc định, vạch trong suốt. Đỏ mà dùng cho cả trễ một ngày thì nhìn
  mãi thành quen, tới lúc trễ thật hết tác dụng cảnh báo.
- **Bảy chi tiết còn lệch prototype ở màn Hóa đơn** (đối chiếu markup gốc, không đoán theo ảnh):
  thanh tiến độ đổi sang nhãn hai đầu (`kỳ 4/12` trái · `còn 20.000.000 đ` phải) và **ruột thanh lấy màu
  nhóm** thay vì tím cố định · khối ghi kỳ đổi sang viền trung tính + nền chìm (viền accent để dành cho
  form thêm/sửa) và có thêm **dòng giải thích theo `amount_mode`** mà bản cũ thiếu hẳn · checkbox "số kỳ
  hữu hạn" thay `input[type=checkbox]` bằng hộp 15px tự vẽ có dấu check mờ/tỏ · form thêm có vòng accent
  và đường ngăn trước mục số kỳ · `.fin-icon-btn:hover` đổi chữ sang `--n-on-accent`.
- **Nút Thanh toán** đổi sang kiểu outline accent (`.fin-btn--outline`) thay vì nút xám `--secondary`.
- **Màn Hóa đơn: bốn segment dùng chung một cấu trúc dòng** (`RuleCard`) — icon 34px, tên + phụ đề,
  số tiền + trạng thái, nút sửa/công tắc/xóa, phần mở thêm nằm dưới. Trước đó Phải trả là một layout,
  Khoản vay và Thẻ là layout khác (`fin-rule--col` + nút xóa `position: absolute` đè lên góc thẻ).
- **Sáu trạng thái phân biệt bằng vạch màu bên trái** (quá hạn đỏ · hôm nay vàng · sắp tới tím · đã trả
  xanh · tắt/kết thúc xám) thay vì chỉ đổi màu chữ. Màu không đứng một mình, luôn kèm chữ.
- **Danh sách hóa đơn sắp theo ngày trong tháng**, không theo mức khẩn: vị trí một hóa đơn không đổi từ
  ngày này sang ngày khác nên không bấm nhầm dòng bên cạnh.
- **Trả trước hạn được.** Nút Thanh toán có mặt từ đầu kỳ thay vì chỉ hiện khi `d <= 0`.
- **Khoản vay hiện đủ thông tin handoff:** thanh tiến độ kỳ, ngày trả hằng tháng, tách lãi/gốc kỳ tới,
  dư nợ gốc, và với loại chỉ-trả-lãi thì có dải cảnh báo ngày tất toán gốc.

- **Đầu form: tab Chi/Thu/Để dành sang trái, nút Lưu sang phải, bỏ dòng "Một khoản mới"** (cả trang đã
  tên "Ghi một khoản"). `.fin-seg` bỏ `margin-left: auto` — đó là thứ đẩy tab sang phải khi còn dòng chữ.

### Đã thử rồi bỏ — đừng làm lại
- **Cho shortcut tự ghi bằng `recent_amounts[0]` khi chưa gõ số.** Nghe như biến 3 động tác thành 1,
  thực tế là **bước lùi**: shortcut không còn "arm" nữa nên mất hai thứ của thiết kế cũ đang được dùng
  thật — ô nhập để ghi một mức tiền **khác** lần trước, và **danh sách các mức đã lưu** (`recent_amounts`,
  tối đa 3) mà bấm mức nào ghi mức đó. Arm biến 1 cú bấm thành 2 nhưng giữ nguyên mọi lựa chọn.
  Đã ghi cảnh báo ngay trên `recordShortcut`.
- **`ALTER TABLE finance_shortcuts ADD COLUMN default_amount`.** Viết migration xong rồi xoá: bảng đã có
  `recent_amounts` mang đủ thông tin, và kể cả có cột đó thì vẫn dính đúng bước lùi ở trên.

- **Màn Hóa đơn đồng bộ khung với bốn màn kia.** Nó đang bị `max-width: 900px` nên trên màn rộng thì
  nội dung dồn về trái còn nửa phải bỏ trống, trong khi Tổng quan/Giao dịch/Nhập nhanh/Danh mục đều
  tràn hết vùng nội dung — bỏ cap. Kèm theo: thanh tab về 12px + bóng nhẹ như `.fin-list__controls`
  (đang là 16px + bóng đậm), dòng hóa đơn về 8px không bóng như `.fin-txrow`/`.fin-category-card`
  (đang là 16px + bóng riêng cho từng dòng), empty state giống `.fin-list-empty`, và các khối mở trong
  dòng không bo to hơn dòng chứa nó. Thang khung đã ghi thành bảng trong `DESIGN_FINANCE.md` §9.
- **Số đếm trên tab** (`Phải trả 2`) chuyển sang `hint` nên hiển thị xám nhạt như tab Danh mục/Schema,
  thay vì dính liền vào nhãn.

- **Icon riêng cho từng hóa đơn** (`finance_bills.icon`, migration
  `data/migration_v6.5.0_finance_bill_icon.sql` — user tự chạy trên hosted). Trước đó icon suy từ nhóm,
  nên ba đồng hồ điện + tiền nước + internet + tiền thuê nhà đều là "Nhà ở & Hóa đơn" → **cùng một icon
  cái nhà**, quét danh sách không phân biệt được dòng nào là dòng nào. Giờ chọn trong 32 icon, bỏ chọn
  thì về icon của nhóm. **Màu icon vẫn theo nhóm**, không cho chọn riêng — để donut, danh sách và biểu
  đồ dùng chung một bảng màu. 20 mẫu hóa đơn điền sẵn icon tương ứng.
- **Nhân bản hóa đơn.** Nút copy trên mỗi dòng chép **quy tắc** sang form thêm ở đầu màn: tên (+ "(bản
  sao)"), nhà cung cấp, mã khách hàng, danh mục, kiểu/số tiền, ngày trả, số kỳ, ghi chú. **Không chép
  lịch sử** — các kỳ đã ghi là giao dịch mang `bill_id` của hóa đơn cũ nên chúng ở nguyên đó; tiến độ
  trả góp, kỳ đã bỏ và mốc kết thúc đều về mặc định. Bản sao **chưa ghi xuống DB** cho tới khi bấm Tạo
  hóa đơn, nên bấm nhầm không để lại rác. Dùng cho ca "ba đồng hồ điện": cùng nhà cung cấp, khác mã.
- **Bỏ được một mức tiền đã lưu của shortcut.** `recent_amounts` là danh sách MRU cắt còn 3, nên một số
  gõ nhầm (vd `123.123.123.123`) nằm lại tới khi ghi đủ 3 mức khác mới bị đẩy ra. Giờ mỗi chip có nút ×.

### Removed
- **115 rule CSS chết trong `finance.css` + `finance-handoff.css`** (65 class không còn JSX nào dùng):
  accordion danh mục cũ `fin-catgroup*`, editor dạng modal `fin-modal*`/`fin-sub-editor*`, bảng schema
  `fin-schema__*`, `fin-income-tile*`, `fin-ask__*`, `fin-level__*`… — tàn dư của các bản UI trước.
  Xoá bằng cách đối chiếu từng class với toàn bộ `src/**/*.jsx`, có chừa các class ghép động
  (`fin-rule__state--${tone}`, `fin-txrow__amt--${type}`, `fin-detail__amount--${type}`).

### Fixed
- **Đổi icon hóa đơn nhưng giao dịch của nó vẫn giữ icon cũ.** `ListScreen` lấy icon từ
  `catInfo(tx.category_id)`, không biết `finance_bills.icon`. Giờ giao dịch có `bill_id` sẽ tra icon
  của hóa đơn và ưu tiên dùng nó; hóa đơn bị xóa hoặc không đặt icon thì về icon nhóm như cũ. Suy lúc
  render, không sao chép icon xuống từng giao dịch.
- **Xóa hóa đơn đã có giao dịch: thất bại trong im lặng.** FK là
  `bill_id … ON DELETE RESTRICT` nên Postgres chặn (`23503`), `deleteRow` nuốt lỗi trả `false`, mà nút
  xóa lại không kiểm kết quả — bấm Xóa xong không có gì xảy ra và không có thông báo. Tệ hơn: hộp xác
  nhận đang hứa "N giao dịch vẫn được giữ lại", tức là hứa một hành vi mà DB đang cấm. Trước mắt đã
  thêm toast nói đúng lý do và lối thoát; **cách sửa thật cần migration** (xem TODO bên dưới).
- **Biểu đồ "Lịch sử các kỳ" vỡ khi hóa đơn mới có 1 kỳ.** Cột dùng `flex: 1` nên một kỳ duy nhất kéo
  rộng hết panel, và thanh cao `amount/max*72 = 72px` cộng nhãn ~14px vượt khung `height: 70px` nên nó
  **tràn ngược lên đè dòng tiêu đề**. Kẹp bề ngang cột (`flex: 0 1 44px`), hạ trần thanh còn 52px,
  khung đổi sang `min-height` + `overflow: hidden`.
- **Ô nhập tiền ở màn Hóa đơn không có dấu ngăn cách nghìn** — gõ `345345345345` phải tự đếm số 0.
  Bảy ô tiền (số tiền hóa đơn · khoản thu · gốc vay · gốc cho vay · hạn mức thẻ · phí thường niên ·
  phí rút tiền mặt) và ô "Số tiền đã trả" trong khối ghi kỳ giờ dùng `groupDigits` như màn Nhập nhanh:
  hiển thị `345.345.345.345`, lưu xuống vẫn là số nguyên.
- **"Mở form đầy đủ" từ shortcut không điền tiêu đề.** `openShortcutInForm` đặt nhóm, danh mục con,
  mức cần thiết, nguồn tiền và số tiền — nhưng bỏ sót `note`. Đường ghi nhanh thì luôn ghi
  `note: shortcut.name`, nên cùng một shortcut ra hai loại giao dịch: bấm nhanh thì có tên, mở form
  thì trống tên.
- **Bấm nhầm "Bỏ kỳ này" là cửa một chiều.** RPC `finance_skip_bill_period` chỉ THÊM kỳ vào
  `skipped_periods`, không bao giờ gỡ; đường gỡ duy nhất trong DB là `finance_pay_bill` — mà nút Thanh
  toán lại bị ẩn đúng khi kỳ đã bị bỏ (`actionable = enabled && !paid && !skipped`). Bấm nhầm là kẹt
  tới tháng sau. Thêm nút **"Bỏ đánh dấu · trả lại kỳ này"** trên dòng đã bỏ kỳ; `skipped_periods` là
  cột own-row RLS nên gỡ bằng UPDATE thẳng, không cần RPC mới và không cần migration.
- **Biểu đồ "Lịch sử các kỳ" của hóa đơn vẽ sai.** `.fin-bill-chart__col` tự tô nền tím và không có
  rule nào cho `<i>` bên trong — mà `<i>` mới là thứ mang `style={{height}}`. Kết quả: mấy khối tím
  đặc bằng nhau, chữ tháng nằm trên nền tím, chiều cao cột vô nghĩa. Giờ cột là flex-column, `<i>` là
  thanh bar thật.
- **Handoff Inbox với `kind` lạ làm trắng màn Hóa đơn.** Payload đọc từ `sessionStorage` được
  `setRecurringSeg` nhận thẳng, segment không hợp lệ thì `SEGMENTS.find(...)` trả `undefined` rồi
  `segMeta.addLabel` ném TypeError. Giờ kiểm giá trị trước khi set.
- **Hóa đơn ngày 31 đếm ngược sai ở tháng ngắn.** `new Date(y, m, 31)` trong tháng 2 tràn sang 03/03 →
  màn Hóa đơn báo "còn 21 ngày" trong khi đúng ra là 18 ngày tới 28/02. `dueDateInMonth` kẹp về ngày
  cuối tháng; `daysUntilDue` dùng nó. Cả hai là pure function, đã có self-check trong
  `src/__tests__/financeLogic.test.js`.
- **Ô "Số tiền" tràn ra ngoài thẻ.** Input `42px` có min-content rất rộng, mà grid item mặc định
  `min-width: auto` → ô tràn khỏi card, thấy rõ khi nó được focus. Thêm `min-width: 0` cho
  `.fin-amount-field > div:nth-child(2)`: chặn ở **cả hai tầng**, không chỉ ở input.
- **Convert Inbox không khớp từ điển thì im lặng thành khoản "Ăn uống".** `matchCategory` trả `null` khi
  text không khớp luật nào trong `NL_DICT` (17 luật regex), và form giữ mặc định `categoryId = 'food'` →
  "mua ổ cứng 2tr" từ Inbox thành khoản Ăn uống, sai mà không có dấu hiệu nào để nhận ra. Giờ rơi về
  `other` › `other.unclassified` ("Khác › Chưa phân loại") — nhóm này đã có sẵn trong
  `finance-categories.json`, không cần thêm gì.
- **Finance · "Ghim thành shortcut" im lặng không làm gì.** `pinCurrentShortcut` có `if (type !== 'expense')
  return;` — bấm ở tab Thu / Để dành thì không toast, không lỗi, không gì cả. Giờ báo rõ
  "Shortcut chỉ dùng cho khoản Chi".
- **Shortcut ghim ra tên vô nghĩa.** Tên tự sinh từ danh mục con, chưa chọn danh mục con thì ra **tên
  nhóm** ("Ăn uống"). Giờ lấy từ ô **Tiêu đề** bạn vừa gõ (fallback về danh mục con → nhóm) — không cần
  thêm UI đặt tên nào, vì Tiêu đề vốn đã ở đầu form.
- **Không xoá được 4 shortcut mặc định.** Nút xoá có điều kiện `!shortcut.seed`, mà `shortcutSeed` là
  JSON trong `finance-categories.json` chứ không phải row DB → không có gì để `DELETE`. Giờ nút của seed
  là **ẩn** (lưu key `category:sub` vào localStorage — vài cái key, không phải data, và là lựa chọn của
  từng máy). Kèm nút **"Hiện lại N shortcut mặc định"** ở cuối panel: ẩn mà không hiện lại được thì đó là
  cửa một chiều.

### Removed
- **Bỏ nút "Ghim thành shortcut" trùng lặp trong khối "Thông tin thêm".** Panel Shortcut đã có
  "Tạo shortcut từ form" và nó **luôn hiện**; bản trong "Thông tin thêm" nằm sau một khối đang đóng nên
  chỉ góp phần làm user tưởng tính năng không tồn tại.
- **Bỏ ô "Smart" (gõ câu tự nhiên) khỏi form thêm khoản.** Sau khi `Tiêu đề` + `Số tiền` lên đầu form,
  ô Smart bắt user gõ một câu rồi bấm "Hiểu là" **để đổ vào đúng hai ô nằm ngay bên dưới nó** — thêm một
  bước cho việc gõ thẳng còn nhanh hơn. Xoá `nl`/`nlGuess`/`applyNl` + CSS `.fin-smart-input`,
  `.fin-smart-result`.
  - **Logic đọc câu tự nhiên KHÔNG bị xoá**, chỉ dồn về chỗ duy nhất nó có giá trị: **handoff từ Inbox**.
    Text đó không do user gõ trong form nên đoán hộ mới đáng — giờ parse thẳng vào Tiêu đề + Số tiền +
    nhóm (`stripAmountWords` + `parseCurrencyInput` + `matchCategory`), không qua ô trung gian nào.
    `handoff.amount` (số Inbox đã chốt) được tin trước, không có thì mới đoán từ câu.

### Changed
- **Finance · form thêm khoản: "Ghi chú" thành "Tiêu đề" và lên đầu form, cùng nút Lưu.** Trước đây nó
  nằm gần cuối form dưới nhãn `Ghi chú · Tùy chọn` nên gần như không ai điền → dòng trong danh sách rơi
  về fallback là tên nhóm ([ListScreen:145](src/components/finance/ListScreen.jsx#L145)
  `tx.note || subLabel || catLabel`) và 20 khoản "Ăn uống" trông y hệt nhau. Đổi nhãn thôi không đủ: nó
  phải nằm ở chỗ user thấy **trước khi** bấm Lưu. Giờ đầu form là một khối gọn: `Tiêu đề` + `Số tiền`
  một hàng, dưới là nút bước tiền + `Lưu` / `Lưu & nhập tiếp`. Nhãn đổi đồng bộ ở ListScreen,
  AnalyzeScreen, CatsScreen và header CSV.
  - Đánh đổi: form dài, chọn nhóm xong phải cuộn lên mới thấy nút Lưu. Bù lại `Enter` vẫn lưu được.
- **Ô nhập tiền có dấu phân cách nghìn:** `groupDigits()` format lúc hiển thị (`45000` → `45.000`) trong
  khi state vẫn là chuỗi digit thuần, nên `parseCurrencyInput` không phải biết gì về dấu `.`. Áp cho cả
  ô số tiền chính, ô nhập nhanh của shortcut, ô đơn giá từng món và ô trả hoá đơn. **`pattern` của mấy ô
  đó phải đổi sang `[0-9.]*`** — `pattern` là constraint validation thật, để `[0-9]*` là submit bị chặn
  ở giá trị `45.000`.

### Fixed
- **"50 nghìn" chỉ đúng nhờ ăn may, và làm bẩn tiêu đề.** `parseCurrencyInput` chỉ hiểu `k`/`m`; "50
  nghìn" ra 50.000 nhờ heuristic auto-k (`val < 10000` → ×1000) — **tắt auto-k trong Cài đặt là nó lưu
  50 đồng**. Giờ có bảng `MAGNITUDE` tường minh (`k/nghìn/ngàn` = ×1000, `m/triệu/tr/củ` = ×1e6).
  Cùng bảng đó dùng cho `stripAmountWords()`, nên "xăng 50 nghìn" ra tiêu đề `xăng` chứ không phải
  `xăng nghìn` (chữ "nghìn" trước đây không bị bóc — mà đó là đúng ví dụ trong placeholder của ô Smart).
  - Lookahead `(?![\p{L}])` là phần không được bỏ: thiếu nó thì "2 cuốn sách" → `ốn sách` (khớp `cu`) và
    "1 trứng" → `ứng` (khớp `tr`). `\b` không cứu được vì chữ Việt có dấu không phải `\w`.
  - `currencyInput.test.js` stub `localStorage` để test được cả trạng thái **tắt** auto-k — chỗ bug thật.

### Added
- **Vault backup / restore (Milestone 4 bước 1):** nút `Export backup` / `Restore from backup` ở **màn
  hình khoá**, không ở header đã unlock — đây đúng là lúc cần khôi phục (máy mới → màn setup), và export
  không cần key nên không có lý do phải vào trong mới sao lưu được.
  - **Export chạy được khi Vault ĐANG KHOÁ:** nó chỉ copy `encrypted_payload` + `encryption_nonce` +
    `encryption_version` + `vault_config`. File backup **không phải plaintext** — ai lấy được vẫn cần
    passphrase gốc. Có `format` + `version` để restore từ chối shape lạ thay vì đoán.
  - **Restore CHẶN khi `backup.userId !== userId`.** AAD gắn cả wrapped key (`vault-key|v1|userId`) lẫn
    từng item (`vault-item|v1|userId|itemId`) vào user id, nên khôi phục sang account khác thì file mở
    ra bình thường mà **không giải mã được gì**. Phát hiện sau khi đã ghi chính là "recovery giả" mà
    RULES cấm → phải chặn trước khi ghi.
  - **Restore CHỈ chạy vào Vault trống**, không xoá gì → không có đường mất data, nên không cần dialog
    "bạn có chắc". Cùng pattern migration v6.2 đã dùng. Ghi đè vault đang có item là nhu cầu khác, hiếm
    hơn, để làm riêng khi cần.
  - **Restore xong thì khoá Vault lại:** key trong memory là của config CŨ. Bắt unlock lại bằng
    passphrase của bản backup cũng chính là bước tự kiểm chứng backup dùng được.
  - Không khôi phục `created_at`/`updated_at` (DB tự quản, grant least-privilege không cho ghi). Mốc
    thời gian thật nằm trong `log` bên trong payload nên không mất.
  - 4 assertion mới trong `vaultHookContract.test.js` khoá cả 4 bất biến trên.
- **Logo riêng cho từng item, lưu mã hoá trong payload:** Edit → `Choose a logo` → ảnh được **vẽ lại
  qua canvas thành PNG 48×48** rồi lưu dạng data URI trong encrypted payload. Vẽ lại nghĩa là không giữ
  một byte nào của file gốc, nên script trong SVG / EXIF / payload lạ bay hết — **bước thu nhỏ đồng thời
  là bước diệt trùng**, và vì thế tuyệt đối không lưu bytes gốc.
  - Cố ý **KHÔNG** dùng Supabase Storage hay Google Drive: URL công khai ở hai chỗ đó là tự khai user có
    tài khoản dịch vụ nào, phá mô hình threat của Vault. Đổi lại phải chịu base64 hai lần — đáng.
  - Cap **16 KB** đặt ở `cleanItem` (chỗ duy nhất mọi đường ghi đều đi qua), không chỉ ở UI. Payload
    phình là mỗi lần mở vault phải tải + giải mã lại: 50 item × ~4 KB = 200 KB/lần unlock, tức ~0.8%
    quota egress free — chi phí thật là **0.1–0.3s tốc độ load**, không phải quota.
  - `AccountAvatar` còn đúng 2 tầng: logo đã lưu → plate màu + chữ cái. **Không tầng nào gọi mạng.**

### Changed
- **Sắp xếp field: 3 icon → 1 grip.** Handle + 2 nút mũi tên ăn gần hết cột nhãn. Giờ chỉ còn một grip
  (`DotsSixVertical`) rộng 18px, là `<button>` nên tab tới được và **↑ / ↓ khi đang focus cũng đổi vị
  trí** — bỏ 2 nút mà không mất đường dùng bàn phím. Grip mờ khi nghỉ, rõ khi trỏ vào dòng. Xoá luôn
  `.acc-act--icon` (chỉ 2 nút cũ dùng, và nó phải `!important` để đè `.acc-act`).

### Fixed
- **Sheet mã dự phòng không có đường xoá:** nút ✕ ở dòng auth `Single-use codes` chỉ bỏ **phương thức**,
  còn section vẫn hiện vì `showCodes` thấy `codes.length > 0` — nên 10 mã do template `Platform account`
  cũ tự sinh không cách nào bỏ được, nằm lẫn với mã thật của provider. Thêm nút **Clear sheet** (chỉ ở
  chế độ Edit, chỉ khi còn mã) đặt cạnh Regenerate.

### Changed
- **Dọn 3 cảnh báo `react-hooks/exhaustive-deps` (36 → 33 warning, 0 error), không đổi hành vi:**
  `AuthContext` đưa `fetchProfile` vào deps (nó là `useCallback` deps rỗng nên identity không đổi);
  `useXpStore` tách `const userId = user?.id` như `useFocusTimer` đã làm — để `user` vào deps là load
  lại toàn bộ `xp_logs` mỗi lần Supabase refresh token phát ra object user mới; `SlashCommand`
  destructure `{ items, command }` ngoài hook thay vì để dep dạng `props.items`.
- **Dropdown chọn item để link hiện thêm subtitle:** trước chỉ `code · title`, nên nhiều tài khoản cùng
  một dịch vụ (5 tài khoản Google) ra mấy dòng giống hệt nhau và không chọn được — buộc user phải nhồi
  email vào title. Giờ là `ACC · Google · abc@gmail.com` qua `itemSubtitle()` đã có sẵn, nên title để
  gọn được. `itemSubtitle` chỉ đọc `SUBTITLE_LABELS` (Primary email, Username, Emails, Email, SSID,
  Service, Full name, Host, Product) nên không có đường lôi giá trị secret vào dropdown.

### Removed
- **Xoá hẳn cơ chế lấy favicon trực tiếp: Vault không còn gọi mạng ra ngoài.** Bỏ `faviconCandidates`,
  `itemUrl`, nút `Logos`, state `useFavicon` và toàn bộ đường truyền prop của nó. Lý do:
  - Mỗi lần mở vault là **N request tới N domain** → chính các domain đó biết IP này vừa mở một vault có
    tài khoản của họ. Nút toggle chỉ **trì hoãn** chuyện đó, không loại bỏ nó, và nó reset mỗi lần reload
    nên thực tế user tưởng tính năng không hoạt động.
  - Chỉ đoán được 2 đường `/apple-touch-icon.png` và `/favicon.ico` → đa số site 404, tức gọi mạng mà
    phần lớn không ra kết quả.
  - Item không có field URL (thẻ ngân hàng, giấy tờ) thì **không bao giờ** có logo.
  Logo lưu trong payload xử được cả ba. **Không dựng lại favicon aggregator** — đã ghi lý do vào
  `AccountAvatar.jsx`, `DESIGN.md` và `docs/FEATURES.md`.
- **Dọn pass đồng bộ key template:** pass ghi lại `tpl` một-lần-mỗi-unlock (v6.3.0) đã chạy xong trên
  production nên đã xoá cùng cờ transient `staleTpl` trong `fetchAll`. **Giữ lại một dòng shim** alias
  `login` → `account` trong `cleanItem`: nó là thứ duy nhất chặn trường hợp sót một item lưu key cũ —
  mất nó thì item đó rơi về kicker `Item · ···` và biến khỏi chip filter. Giá bằng 0, không dọn tiếp.

## v6.3.0 — 2026-08-11
> **Vault UX + gộp template, KHÔNG đổi schema.** Không có migration SQL nào trong bản này: mọi thay đổi
> nằm ở client và ở nội dung encrypted payload. Deploy frontend là đủ.

### Changed
- **Gộp `Website login` + `Platform account` thành một loại `Account`, template Vault còn 9:** hai
  template cũ cùng một hình dạng dữ liệu (url + username + password), chỉ khác số field điền sẵn, nên
  tách ra chỉ làm chip filter mất ý nghĩa (item chia nhóm theo "lúc tạo bấm cái nào") và sinh sẵn 10
  backup code rác cho item không dùng tới. Loại còn lại giữ key `account`, nhãn `Account · ACC`, field
  thu về bộ gọn 4 field và bỏ `codes: 10` — **không ảnh hưởng item đã tạo**, template chỉ điền sẵn lúc
  `createItem`.
- **Item cũ lưu `tpl: 'login'` được đồng bộ hai tầng:** alias trong `cleanItem` (chạy cả lúc đọc và
  lúc ghi) làm UI đúng ngay từ lần unlock đầu; thêm một pass ghi lại **một lần mỗi lần unlock** để
  ciphertext cũng mang key mới, dùng `writeItem` nên không sinh dòng History (dọn nội bộ, không phải
  thay đổi do user). Cả pass đó, cờ `staleTpl` và alias đều là **tạm** — xoá khi không còn item nào lưu
  key cũ. Hệ quả một lần: item được ghi lại sẽ có `updated_at` mới, tức "Updated hôm nay"; mốc sửa thật
  vẫn còn trong History vì mỗi dòng log có timestamp riêng.
- **`tpl` nằm trong ciphertext nên KHÔNG có cách migration bằng SQL:** Supabase không có key. Mọi
  migration nội dung Vault buộc phải chạy client-side sau unlock — ghi lại trong `_merge` của
  `account-templates.json` để lần sau không ai đi tìm file `.sql`.

### Added
- **Đổi Type của item ngay trong chế độ Edit:** select ở vị trí kicker. Đổi type KHÔNG thêm/bớt field
  (field thuộc item, template chỉ điền sẵn lúc tạo) nên là thao tác không mất dữ liệu, và có vào
  History qua `diffLog`. Trước đây tạo sai loại thì chỉ còn cách xoá và tạo lại.
- **Sắp xếp thứ tự field trong Vault:** ở chế độ Edit, kéo thả bằng handle bên trái hoặc dùng nút mũi
  tên lên/xuống. Thứ tự nằm trong encrypted payload nên lưu chung với item, không có cột `position`.
  `draggable` chỉ đặt trên handle (không trên cả row) để không cướp thao tác bôi đen text trong input,
  và `dragstart` có `setData` để Firefox chịu start drag.

### Fixed
- **Finance — nhãn "Hôm qua" lệch 1 ngày ở GMT+7:** `dayLabel` trong `ListScreen` tính ngày hôm qua
  bằng `toISOString()` (UTC) nên nhãn rơi vào hôm-trước-hôm-qua; đổi sang `toDateStr()`. Đây là chỗ
  UTC-date cuối cùng còn sót của Milestone 3.
- **Vault — logo dịch vụ không hiện trên production:** `faviconCandidates` giữ nguyên scheme user gõ,
  nên field Website dạng `http://` sinh ảnh `http://…/favicon.ico` → https prod chặn mixed-content im
  lặng (localhost http thì vẫn load, vì thế chỉ hỏng ở prod). Giờ luôn dựng origin bằng `https://`.

## v6.2.0 — 2026-08-09
> **Account Vault chuyển từ schema plaintext sang full-content encryption phía client.** Mỗi item là
> một AES-256-GCM ciphertext; production migration được bàn giao để user tự chạy và chưa được agent
> áp dụng lên hosted Supabase.

### Added
- **Envelope encryption native Web Crypto:** Vault passphrase tối thiểu 12 ký tự → PBKDF2-SHA256
  600.000 vòng → KEK; DEK 256-bit ngẫu nhiên được KEK bọc trong `vault_config`. Raw DEK chỉ tồn tại
  trong memory sau unlock; AES-GCM AAD gắn key theo user/version và item theo user/id/version.
- **Setup / unlock / manual lock:** locked state không query/hiện nội dung item; lock, sign-out,
  đổi user hoặc reload làm mất key và xóa plaintext khỏi React state.
- **CSPRNG password generator** 12–128 ký tự, bảo đảm đủ upper/lower/digit/symbol.
- **Security contracts:** test wrong passphrase, wrong user/item AAD, tamper, nonce, request epoch,
  optimistic concurrency, empty-Vault migration và least-privilege grants.

### Changed
- **Toàn bộ nội dung user nhập được mã hóa:** title, template, favorite, notes, tags, fields,
  sign-in methods, recovery codes, links và history cùng nằm trong một encrypted JSON/item.
- **Schema Vault:** `accounts` chỉ còn owner/id, timestamps, ciphertext, nonce, version;
  `vault_config` giữ KDF metadata + wrapped DEK. Các bảng plaintext `account_fields`,
  `account_auth`, `account_codes`, `account_logs`, `account_tags` bị bỏ khi Vault trống.
- **Tag Vault tách khỏi tag server:** tag item nằm trong ciphertext; `tagged_items` chỉ còn
  collection/task/finance.
- **README hợp nhất:** runbook gốc chứa local, fresh install và production handoff; README phụ trong
  `supabase/` đã được gộp và xóa.
- **Reset script:** chỉ còn table tồn tại ở schema v6.2, thêm `task_tags` và bọc transaction để lỗi
  không để database ở trạng thái reset dở dang.
- **Tài liệu hiện hành được hợp nhất theo vai trò:** PROJECT/ARCHITECTURE/DATABASE/FEATURES/RULES được
  đối chiếu lại với route, hook, browser storage và schema 27 bảng; PLAN/TASKS chỉ giữ roadmap và
  checkbox còn mở, lịch sử hoàn thành chỉ còn trong CHANGELOG.
- **Runbook an toàn hơn:** README nói rõ guest chỉ có Task/Focus, bổ sung `vault_config` vào threat
  model, cấm chạy baseline riêng trên DB v6.x và bỏ hướng dẫn có thể tạo lại bảng Finance legacy.
- **Copy/comment hiện hành:** Landing và onboarding mô tả đúng 7 loại Knowledge, Finance v6,
  phạm vi guest và quyền riêng tư; comment nguồn không còn dẫn tới Habit/Tracker/Dashboard đã xóa.

### Removed
- **Audit snapshot v4.29.1 đã hết hiệu lực:** xóa
  `docs/AUDIT_REPORT_2026-08-01_duplicate_logic.md`; cả 10 phát hiện gốc đã được xử lý từ v4.29.1 và
  phần lớn file/module được báo cáo đã không còn tồn tại.

### Security
- Migration fail-closed nếu `accounts` có bất kỳ row nào, nên giả định “Vault trống” sai không thể
  âm thầm xóa dữ liệu.
- Request cũ không được commit state sau Lock/sign-out/đổi user. Whole-row update/delete dùng
  `updated_at` làm revision; conflict giữa hai tab bị chặn thay vì ghi đè ciphertext mới hơn.
- Thiếu `vault_config` trong khi còn ciphertext là hard error; không được tạo DEK thay thế.
- Quyền `authenticated` bị revoke mặc định rộng rồi chỉ cấp CRUD cho `accounts` và
  SELECT/INSERT cho `vault_config`; favicon ngoài mạng mặc định tắt; input secret mặc định che.

### Known limits
- Chưa có export/restore, đổi passphrase, rotate DEK, inactivity auto-lock, clipboard auto-clear
  hoặc TOTP generator. Không dùng bản này làm bản sao duy nhất của secret quan trọng.

## v6.1.0 — 2026-08-08
> **`/tasks` full-bleed + khối "Đã hoàn thành" tách khung riêng.** Trang bỏ khổ đọc 900px, chiếm trọn
> cả bề ngang lẫn bề dọc body; nút Thêm lên hàng tab; header nhóm hết nhạt; khối đã xong đổi hẳn ngôn
> ngữ sang xanh lá + lọc theo khoảng ngày.

### Added
- **`TasksPage.jsx`** — nút **Thêm** đứng cùng hàng 2 tab Danh sách/Lịch nhưng dạt hẳn mép phải
  (`.tasks-viewbar__add`, `margin-left: auto`). `showForm` nâng lên TasksPage, truyền xuống
  `TaskListSection` bằng prop — đây là state DUY NHẤT được nâng.
- **Lọc "Đã hoàn thành" theo khoảng ngày A→B** — 7 preset tính lùi từ hôm nay (Hôm nay · Hôm qua ·
  7 ngày · 2 tuần · 3 tháng · 6 tháng · 1 năm) + 2 ô Từ/Đến dùng `DatePickerPopover`. Chọn ngày thủ
  công tự kẹp `from <= to`. Kết quả sắp mới nhất trước; khoảng nhiều ngày thì "Xong lúc" kèm cả ngày.
- **Bỏ tích ngay trên hàng đã xong** — bấm vòng tròn ✓ gọi `uncompleteTask` (hàm đã có sẵn trong
  `useUserTasks`, trước v6.1.0 chưa nơi nào gọi). Hover đổi đỏ để báo trước.
- **Vạch `|` ngăn** vòng tròn tick ↔ nội dung (`.task-row-sep`), dùng chung cho cả hàng chưa xong lẫn
  hàng đã xong.

### Changed
- **`tasks.css`** — `.tasks-page` bỏ `max-width: 900px`, `padding` co giãn theo `clamp()`,
  `min-height: 100dvh` (mobile trừ `--topbar-height` + `--bottom-tabs-height`); `.task-list-card`
  `flex: 1` để kéo dài hết chiều dọc. Tab Lịch cũng full-bleed (`--calendar` bỏ `1180px`).
- **Header nhóm** — Hôm nay / Sắp tới trước đây `0.75rem --text-muted` gần như tàng hình; nay cùng cỡ
  `0.85rem/700 --font-display` với Quá hạn, mỗi nhóm một màu vai trò (đỏ / tím / xám / xanh lá) + số
  đếm dạng huy hiệu. Khối Hôm nay luôn có header (trước chỉ hiện khi có task quá hạn).
- **Ô tick vuông → tròn** (`--radius-sm` → `--radius-full`).
- **Tiêu đề task gói trong 1 dòng** (`.task-title-1line`, ellipsis) — trước đây tiêu đề dài đội cao
  cả hàng.
- **Khối "Đã hoàn thành"** — chuyển ra NGOÀI card danh sách thành hộp bo góc riêng viền xanh lá
  (`.task-done-card`). Mỗi hàng: bo góc + viền xanh lá, **bỏ gạch ngang**, "Xong lúc …" thành huy hiệu
  xanh nổi bật, icon 🗑 đổi thành nút chữ **Xóa**.

### Added — vòng 2 (theo góp ý trực tiếp của user)
- **`DatePickerPopover` có `mode="range"`** — CÙNG 1 component, chọn cả khoảng. `value`/`onChange`
  đổi sang `{ from, to }`; cột shortcut đổi từ hướng tương lai (Ngày mai/Tuần sau/8 tuần) sang
  preset nhìn lùi (Hôm nay/Hôm qua/7 ngày/2 tuần/3 tháng/6 tháng/1 năm); ô giờ tự ẩn. Click 1 =
  mốc đầu, click 2 = mốc cuối (click trước mốc đầu thì tự đảo), click 3 = khoảng mới. Ngày ở giữa
  tô `.dp-grid__cell--in-range`. Bộ lọc "Đã hoàn thành" giờ chỉ còn **1 nút mở 1 picker**.
- **Nút Xem chi tiết (con mắt)** trên mỗi hàng task — mở popup Chi tiết. Đổi lại UX: **bấm vào
  thân task = bung mô tả tại chỗ** (v5.0.0 từng bỏ vì 1 click 2 nghĩa; nay hết xung đột).
- **`src/utils/lunarUtils.js` + `src/__tests__/lunarUtils.test.js`** — đổi dương → âm lịch VN
  (thuật toán Hồ Ngọc Đức / Meeus, không thêm thư viện). Test đối chiếu 1/1/2000, Tết 2025, Tết
  2026 + quét 3 năm liên tục kiểm ngày âm tăng đều.
- **`src/data/holidays.json`** — 11 lễ dương + 11 lễ âm (Rule 14). Ô lịch trúng lễ được tô vàng +
  ngôi sao; panel chi tiết ngày hiện huy hiệu **Âm lịch d/m** và **tên ngày lễ**.

### Changed — vòng 2
- **Sửa task ngay trong popup Chi tiết** — nút **Sửa** chuyển nội dung popup sang đúng form edit
  đang dùng ở `TaskListSection`; không đóng popup, không navigate về list và không tạo đường ghi DB
  thứ hai. Bấm Hủy quay lại nội dung chi tiết.
- **Danh sách hoàn thành cập nhật ngay sau khi tick** — `completedList` nhận cùng `completed_at`
  với optimistic update của task; nếu ghi DB lỗi thì rollback cả hai state. Không cần đổi filter để
  task vừa hoàn thành xuất hiện.
- **Nhãn của task lên thẳng hàng với tiêu đề** (`.task-row-line`); tiêu đề co trước, nhãn giữ
  nguyên; dưới 820px mới cho xuống dòng.
- **Nút icon hết mờ** — bỏ `opacity: 0.5–0.6` + `onMouseEnter/Leave` chỉnh opacity bằng JS, thay
  bằng `.task-act-btn` (ô 30px, `weight="bold"`, hover tím/đỏ rõ). Bỏ nốt emoji còn sót
  (`⏰` trong DatePicker, `⏳` trong MonthCalendar).
- **Ô mô tả tự cao theo nội dung** — `field-sizing: content` (native, không JS đo `scrollHeight`).
- **Lịch: ô các ngày bằng nhau** — `grid-auto-rows: 124px` + ô trống bỏ `aspect-ratio: 1`. Trước
  đây ô trống bị ép vuông theo bề rộng cột nên hàng đầu cao gấp 3 hàng khác. Ngày thường hiện tối
  đa **4 chip**; ngày lễ hiện tối đa **3 chip** để dành một dòng cho tên lễ; `+N nữa…` luôn tính
  theo giới hạn thực của ô. Chip xong (xanh) và sắp tới (tím) đứng CHUNG danh sách.
- **Tên ngày lễ hiện ngay trong ô** — nằm trong luồng bố cục dưới task, không đè lên ngày âm; màn
  hẹp cho phép tối đa 3 dòng. Panel chi tiết ngày vẫn giữ huy hiệu tên lễ đầy đủ.
- **Lịch: hôm nay** đổi từ viền cyan sang viền tím + số ngày trong viên tròn tím đặc.
- **Lịch: light mode** — nav button, khung thống kê, panel chi tiết, viền ô, ngày chưa tới, chip
  đều có cặp override `[data-theme="light"]`; trước đây toàn `rgba(255,255,255,…)` nên vô hình.
- **Số đếm ở header nhóm hiện lại** — badge cũ dùng `background: currentColor` + `color` khác nên
  `currentColor` lấy chính màu chữ MỚI → chữ trùng nền, số biến mất. Nay viền + chữ cùng
  `currentColor`, nền trong suốt.
- **Khối Quá hạn hết 2 lớp viền** — bỏ hộp nền đỏ bao ngoài, từng hàng vốn đã có viền + nền đỏ.

### Files Modified
- `src/pages/TasksPage.jsx`, `src/components/TaskListSection.jsx`, `src/components/TaskDetailModal.jsx`,
  `src/components/DatePickerPopover.jsx`, `src/components/MonthCalendar.jsx`, `src/hooks/useUserTasks.js`
- `src/styles/tasks.css`, `src/styles/datepicker.css`, `src/styles/calendar.css`
- `src/utils/lunarUtils.js`, `src/__tests__/lunarUtils.test.js`, `src/__tests__/taskUiContract.test.js`,
  `src/data/holidays.json`
- `DESIGN.md`, `docs/FEATURES.md`, `docs/TASKS.md`, `docs/ARCHITECTURE.md`, `CHANGELOG.md`, `package.json`

## v6.0.0 — 2026-08-08
> **Module chi tiêu (`/finance`) làm lại từ đầu theo thiết kế Nocturne (handoff).** Thay HẲN Finance
> cũ (expenses + subscriptions). Triết lý: **app không tính số dư** (thu vẫn ghi nhưng không bao giờ
> là mẫu số của tỉ lệ nào); **một bảng giao dịch, mọi báo cáo = đếm lại lọc theo `occurred_at`**;
> **app không trả hộ — chỉ nhắc, tới ngày user bấm ghi ra một giao dịch mang FK trỏ về quy tắc**.
> 6 màn trong một **child sidebar** lồng trong app: Tổng quan · Nhập nhanh (phím N) · Giao dịch ·
> Danh mục · Hóa đơn (4 segment: phải trả/sẽ nhận/vay/thẻ) · Phân tích (ngân sách 50/30/20 + thống
> kê 3/6/12 tháng). Giao dịch **liên kết Task** (FK `task_id`) và **Inbox** (2 chiều). Design system
> Nocturne dark-only scoped. MAJOR theo RULES §9 (đổi schema breaking: drop 2 bảng, kiến trúc mới).
>
> ⚠️ **Mất dữ liệu:** migration DROP `expenses` + `subscriptions` + dữ liệu thật (lựa chọn "drop
> sạch, làm lại từ đầu" của user 2026-08-08). Không có nhánh migrate.
>
> 🔜 Hoãn (đã chốt): tự sinh task nhắc từ nghĩa vụ quá hạn/tới hạn/đáo hạn; sửa cấu trúc danh mục từ
> UI; ghi activity_logs khi thanh toán; icon Phosphor (v1 dùng emoji).

### Added
- **`data/migration_v6.0.0_finance.sql`** — user tự chạy trên Supabase. Idempotent. DROP module cũ
  rồi tạo 9 bảng + 1 junction + view:
  - `finance_transactions` — bảng DUY NHẤT. `type` CHECK(expense/income/saving); `excluded` (trả gốc
    vay + trả sao kê thẻ, ngoài mọi tổng chi); `necessity` CHECK(must/need/want); `is_fixed`;
    `source_card_id`/`card_id`; FK `bill_id`+`bill_period` (UNIQUE chặn trả trùng kỳ), `loan_id`,
    `saving_goal_id`+`saving_dir`, `shortcut_id`, **`inbox_item_id`** (→collections), **`task_id`**
    (→user_tasks).
  - `finance_bills` (amount_mode fixed/ask, trả góp term_done/term_total), `finance_loans`
    (kind interest/amort), `finance_cards` (statement_day≠due_day, grace, float), `finance_saving_goals`
    (KHÔNG cột số dư), `finance_deposits`, `finance_income_rules` (received_periods), `finance_shortcuts`
    (KHÔNG cột số tiền), `finance_budgets` (hạn mức đứng — cơ sở 50/30/20).
  - `finance_transaction_tags` + `tagged_items` recreate (bỏ expense/subscription, thêm `kind='finance'`).
- **`src/utils/financeLogic.js`** + test — logic thuần (không import JSON): `periodTotals` (nơi tính
  tổng duy nhất), `comparePeriods` (3 nhánh), `deriveNecessity`, `matchCategory` (NL_DICT 15 luật),
  `budgetBreakdown` (50/30/20), `cardCycle`/`floatInterest` (stoozing), `loanSchedule` (annuity/lãi),
  `fundBalance`/`blendedRate`, `spendingRhythm`, `listPeriodOptions`. 11 self-check `node:assert`.
- **`src/hooks/useFinance.js`** — hook duy nhất sở hữu 9 bảng + action; fetch 1 lần, lọc kỳ
  client-side; helper thanh toán (`payBill`/`receiveIncome`/`payLoanInterest`/`payLoanPrincipal`/
  `payCardStatement`/`moveSaving`). Auth-gated, dual-mode; cờ `autoFetch` cho nơi chỉ ghi.
- **`src/data/finance-categories.json`** — 11 nhóm chi + danh mục con + necessity, 7 nhóm thu, seed shortcut.
- **`src/pages/FinancePage.jsx`** (module shell + child sidebar) + **`src/components/finance/`** (6 màn
  + parts). **`src/styles/finance.css`** — Nocturne dark scoped + animation `riseIn`.

### Changed
- **`src/hooks/useTags.js`** — junction `finance` (finance_transaction_tags) thay expense/subscription.
- **`src/pages/InboxPage.jsx`** — nút Inbox→Giao dịch (handoff `lh_inbox_to_finance` kind `tx`, mang
  `inbox_item_id`) và Inbox→Hóa đơn (kind `out`); bỏ modal chi tiêu cũ + `useExpenses`.
- **`src/pages/IncubatorPage.jsx`** — "Ấp trứng → chi tiêu" dùng `useFinance().addTransaction`.
- **`src/components/SubAlert.jsx`** — nhắc nghĩa vụ sắp tới hạn từ `finance_bills`/`finance_cards`.
- **`src/pages/SettingsPage.jsx`** — nhãn tag `finance` thay expense/subscription.

### Removed
- **`src/hooks/useExpenses.js`, `src/hooks/useSubscriptions.js`, `src/components/CashflowBar.jsx`,
  `src/data/expense-categories.json`** — module chi tiêu cũ.
- Bảng `expenses`, `subscriptions`, `expense_tags`, `subscription_tags` (DROP trong migration).

## v5.2.0 — 2026-08-05
> **Vault (`/accounts`) làm lại từ đầu theo bản thiết kế Keyplate** — một item = mọi thứ về một tài
> khoản: field **theo loại** (10 loại), giá trị nhiều phần (`multi`), **nhiều liên kết** tới item
> khác trong một field (`link`), **phương thức đăng nhập** (9 kiểu, một cái primary), **sheet mã dự
> phòng dùng 1 lần** (dán từ nhà cung cấp), và **lịch sử thay đổi từng field**. Sửa **inline** ngay
> trong pane chi tiết; Lưu tự diff ra log. MINOR theo RULES §9 (làm lại module chưa từng release).
>
> Thay hẳn bản Account Vault Phase A1 của v5.1.0 (chưa từng deploy — schema chưa chạy trên Supabase,
> nên gỡ luôn cho gọn thay vì giữ như một lớp lịch sử chết). Mất so với v5.1.0: trạng thái tài khoản
> (active/rarely/closed), nhắc hạn đăng nhập lại (`required_cycle_days`), gom theo dịch vụ, favicon
> avatar, nhân bản, 20 mẫu dịch vụ VN. Quyết định của user 2026-08-05: bám sát bản thiết kế.
>
> ⚠️ VẪN CHƯA MÃ HOÁ. `account_fields.value` là plaintext trong Supabase; type `password`/`secret`
> chỉ mask trên UI. Banner cảnh báo cố ý không tắt được — chỉ gỡ khi xong envelope encryption.

### Added
- **`data/migration_v5.2.0_vault.sql`** — user tự chạy trên Supabase. Idempotent. 6 bảng:
  - `accounts` — `service_name` (= title), `tpl` (key template, **không CHECK** — template là
    content), `favorite`, `notes`, `updated_at` + trigger tái dùng `update_updated_at()`.
  - `account_fields` — `type` CHECK(10 loại) thay cờ `is_secret` cũ; `multi_values` jsonb (loại
    `multi`); `links` jsonb `[{id,itemId,value}]` (loại `link`, **nhiều link/field**).
  - `account_auth` — phương thức đăng nhập; `state` CHECK(primary/on/off); partial UNIQUE ép
    **đúng ≤1 primary/item** (đổi primary = hạ cũ trước, nâng mới sau).
  - `account_codes` — mã dự phòng dùng 1 lần (`code`, `used`).
  - `account_logs` — lịch sử; **append-only ép bằng RLS** (chỉ có policy SELECT + INSERT, không
    UPDATE/DELETE); `logged_at` (tránh từ khoá `AT`), hook map → `at`.
  - `account_tags` + `tagged_items` (`kind='account'`) — giữ nguyên từ trước.
- **`/accounts` — layout Keyplate:** header (brand + search + New item) · banner chưa-mã-hoá ·
  filter bar (chip TYPES theo template + chip #TAGS, mỗi cell khai `grid-column`/`grid-row` tường
  minh vì nút Clear có điều kiện) · body 2 pane cuộn độc lập. Breakpoint **900px** xử lý hoàn toàn
  bằng CSS (`.acc-body[data-screen]`), React chỉ giữ `selectedId` + `screen` — **không** hook đo bề
  rộng, **không** resize listener.
- **Pane chi tiết — 9 khối theo thứ tự đặc tả:** tiêu đề (kicker `<template> · <CODE>`) → card
  preview (chỉ item card, số thẻ mask tới khi reveal) → fields → add-custom-field (chỉ sửa) →
  sign-in methods → single-use codes + paste import (chỉ sửa) → notes → history → footer meta.
- **Sửa inline:** "Edit" clone item vào draft cục bộ, mọi thao tác sửa draft, "Save changes" đẩy
  draft lên. `diffLog` chạy **trong hook** (`useAccounts.saveItem`) — không tồn tại đường lưu mà
  không ghi log. Mask secret trong log = `•` × min(len,24), **không bao giờ ghi giá trị thật**.
- **`src/utils/vaultLogic.js`** (thuần, không React) + **`src/__tests__/vaultLogic.test.js`**:
  `TYPES`/`TYPE_HINT`, `isSecretType`, `maskValue`, `scorePassword`, `parseCodes` (giữ khoảng trắng
  trong mã kiểu Google `1234 5678`), `codeSheet` (dùng `crypto.getRandomValues`), `linkableValues`
  (secret không bao giờ được chào làm giá trị link), `matchesQuery` (secret loại khỏi tìm kiếm),
  `itemSubtitle`, `diffLog`, `formatStamp`/`relativeUpdated`. Đã wire vào `npm test`.
- **`src/data/account-templates.json`** — 10 template Keyplate (LGN/ACC/CRD/IDN/NTE/API/WIF/DBS/SRV/
  LIC) + 9 `authKinds` + `filterIcons`. Chữ giữ **tiếng Anh** đúng bản thiết kế.
- **Bộ token Keyplate riêng scope trong `.acc-vault`** (`accounts.css`): #7c5cff, Plus Jakarta Sans,
  radius 18px, `--lift-*`, đủ bộ dark (mặc định) + light override. Không rò biến ra phần còn lại app.
- **`src/components/AccountAvatar.jsx` — logo dịch vụ ở dòng danh sách** (lệch handoff có chủ ý:
  prototype để mã 3 chữ ở ô này, 20 item cùng template thành y hệt nhau, không quét được bằng mắt).
  2 tầng: favicon của chính dịch vụ (`/apple-touch-icon.png` → `/favicon.ico`) → plate màu + chữ
  cái (`avatarHue` trả HUE, CSS chọn lightness theo theme). URL suy từ field `type='url'` đầu tiên,
  **không thêm cột**. **Không lưu ảnh** — CORS chặn đọc byte ảnh cross-origin nên client không cache
  được favicon; hotlink lúc render là đường duy nhất không cần route server.
  **Cố ý KHÔNG dùng dịch vụ favicon bên thứ ba** — gửi cả danh sách domain mình có tài khoản cho một
  bên là tự khai mình dùng dịch vụ nào (test khoá lại điều này). Nút **Logos** ở header tắt hẳn
  (`vl_acc_favicon`). Mã 3 chữ giữ lại thành badge `.acc-row__code`.
- **`normalizeUrl`/`urlHost`/`itemUrl`/`faviconCandidates`/`avatarHue`/`avatarLetter`** vào
  `vaultLogic.js` + test. `normalizeUrl` chặn `javascript:`/`data:`/`file:` — chuỗi này đi thẳng vào
  `href` của field `url` VÀ dùng để dựng origin favicon, nên lọc scheme ở tầng util.

### Changed
- **UX của luồng tạo item** (5 chỗ user báo, 2026-08-05):
  - Danh sách sắp theo **`updated_at` giảm dần** thay vì tên dịch vụ → item vừa tạo/vừa sửa nằm đầu.
    Đây cũng là lý do mỗi dòng có cột thời gian bên phải; tìm theo tên thì dùng search/chip.
  - Dialog template **ở nguyên trong lúc tạo**, card được bấm hiện "Creating…", card khác disable
    (chặn double-click sinh 2 item). Trước đây dialog đóng ngay rồi im lặng vài giây → tưởng lỗi.
  - Tạo xong **vào thẳng chế độ sửa** (`autoEdit`) và **chọn sẵn tiêu đề tạm** để gõ đè, thay vì
    phải tự đi tìm item rồi bấm Edit.
  - `createItem` bỏ 4 round-trip vô ích: `replaceChildren(..., { fresh: true })` bỏ 3 lệnh DELETE
    trên row vừa INSERT, `appendLogs(..., { touch: false })` bỏ lệnh chạm `updated_at` dư.
  - **Chỗ add tag**: thay `TagPicker` dùng chung bằng `TagEditor` — hàng chip bật/tắt liệt kê toàn
    bộ tag hệ thống + ô tạo tag mới, dùng `.acc-chip` sẵn có. `TagPicker` render trigger là chữ
    "+ Tag" 11px `opacity .7` không viền và **style toàn bộ inline** nên CSS vault đè không được →
    trên nền vault gần như vô hình, đó là lý do "không có chỗ add tag". (`TagPicker` vẫn dùng ở
    FinancePage + TaskListSection, không thành file chết.) Hàng **Tags** ở filter bar giữ nguyên
    chỉ-tag-đang-dùng nhưng đổi message thành câu chỉ đường thay vì "No tags yet".
- **`AccountDetail.jsx`** viết lại: view + edit + 9 khối, props-driven, không gọi supabase. Dùng
  `<select>` native (style bằng token vault) thay CustomSelect để giữ fidelity — ghi rõ ngoại lệ
  RULES §4 trong file. Password generator render nhưng **disable** tới khi có mã hoá.
- **`useAccounts.js`** viết lại: fetch 6 bảng (5 query) ghép thành shape đặc tả; `saveItem`/
  `createItem`/`deleteItem`/`toggleFavorite`/`setAuthState`/`setCodeUsed`. Không guest mode.
- **`AccountsPage.jsx`** viết lại. **`App.jsx`** — `ROUTE_META['/accounts']` cập nhật mô tả.
- **`index.html`** — Plus Jakarta Sans thêm weight 400 (Keyplate cần cho body + chip).
- **`DESIGN.md`** — mục `.acc-*` viết lại (ngoại lệ token có chủ ý). **`DESIGN_ACCOUNT_VAULT.md`**
  làm gọn: bỏ phần thiết kế Phase A cũ (lỗi thời), giữ phần envelope encryption (việc tương lai).

### Removed
- `data/migration_v5.1.0_accounts.sql`, `src/components/AccountForm.jsx`,
  `src/components/AccountAvatar.jsx`, `src/utils/accountLinks.js`,
  `src/__tests__/accountLinks.test.js` — thuộc bản v5.1.0 chưa release, bị thay hoàn toàn.
- 8 cột không còn dùng trong thiết kế mới (chưa từng lên Supabase nên chỉ là gỡ khỏi file SQL).

### Files Added
- `data/migration_v5.2.0_vault.sql`, `src/utils/vaultLogic.js`, `src/__tests__/vaultLogic.test.js`
- `src/components/AccountAvatar.jsx`

### Files Modified
- `src/pages/AccountsPage.jsx`, `src/components/AccountDetail.jsx`, `src/hooks/useAccounts.js`,
  `src/styles/accounts.css`, `src/data/account-templates.json`, `src/App.jsx`, `index.html`
- `package.json` (5.2.0 + test script), `DESIGN.md`, `docs/DATABASE.md`, `docs/ARCHITECTURE.md`,
  `docs/FEATURES.md`, `docs/TASKS.md`, `docs/PLAN.md`, `docs/DESIGN_ACCOUNT_VAULT.md`

## v5.0.0 — 2026-08-02
> **BREAKING (DB).** Dựng lại bảng `activity_logs` thành **lịch sử thay đổi + ghi chú cá nhân của
> từng Task**, kèm Task Detail Modal mới — chỗ đọc lịch sử đó. Đồng thời **gỡ hẳn Life Log**:
> heatmap chỉ COUNT số dòng chứ không đọc nội dung, nên nó là người dùng duy nhất của các dòng
> "sự kiện rời rạc"; gỡ nó thì 12 điểm ghi log rải khắp app cũng thành vô dụng và bị xoá theo.
> MAJOR theo RULES §9 (database schema breaking change).

### Added
- **`data/migration_v5.0.0_activity_logs_v2.sql`** — user tự chạy trên Supabase. 2 phần:
  - Phần 1 (an toàn, idempotent): `user_tasks.updated_at` + trigger `user_tasks_updated_at` tái dùng
    hàm chung `update_updated_at()` có sẵn. Task cũ backfill `updated_at = created_at` (không để
    `DEFAULT NOW()` ngay từ đầu — sẽ gán dấu thời gian sai cho mọi task cũ).
  - Phần 2 (**BREAKING, chỉ chạy 1 lần**): `DROP` + `CREATE` `activity_logs` schema v2 —
    `task_id` FK → `user_tasks` ON DELETE CASCADE (mọi dòng đều gắn task), `action`, `field`,
    `old_value`, `new_value`, `note`. Bỏ `label`/`amount`/`meta`. 1 index cho truy vấn đọc duy nhất,
    4 RLS policy, GRANT tường minh + `GRANT UPDATE (note)` cấp cột.
- **Trang chủ `/` viết lại** (`src/pages/LandingPage.jsx` + `src/styles/landing.css` mới) — thay
  landing marketing cũ (923 dòng JSX qua 7 section + 822 dòng CSS) quảng cáo sản phẩm "Thử Thách
  Vượt Lười 21 ngày" không còn tồn tại, kèm testimonial bịa và bảng giá cho app không bán. Bản mới
  làm đúng 2 việc: cửa đăng nhập (`AuthModal` + nút đổi theme riêng, vì `Navbar` tự ẩn ở `/` khi
  chưa đăng nhập) và bản đồ 6 module có thật (Inbox, Nhiệm Vụ, Knowledge, Finance, Incubator,
  Focus) với mô tả đúng tính năng hiện tại. **Net −1.545 dòng.** Cố ý không liệt kê Habit / Lộ
  Trình / Quiz / BXH — đang chờ gỡ ở đợt 3-4.
- **Task Detail Modal** (`src/components/TaskDetailModal.jsx` + `src/styles/task-detail.css`) —
  chỉ đọc field + 2 tab: **🕘 Hoạt động** (lịch sử đổi field kiểu Jira, mỗi dòng 1 field với giá trị
  cũ → mới, nhóm theo ngày, xoá được từng dòng) và **📝 Ghi chú** (ghi chú cá nhân theo thời gian,
  thêm/sửa/xoá). Dựng trên `GenericModal`, tab tái dùng `.tasks-viewbar__tab`, bottom-sheet ≤520px.
- **`src/utils/taskFields.js`** — logic thuần dùng chung cho cả phía ghi lẫn phía đọc: `ACTIONS`,
  `TASK_FIELD_LABELS`, `diffTaskFields()`, `formatTaskFieldValue()`, `describeActivity()`,
  `describeRecurrence()`. Kèm `src/__tests__/taskFields.test.js` (`npm test`).
- **Log mọi thay đổi của task** qua 5 cửa ghi (không phải 1): `addTask`/`spawnRecurringTask` →
  `task_created`; `completeTask` → `task_completed`; `uncompleteTask` → `task_uncompleted`;
  `updateTask` → 1 dòng `task_update` cho **mỗi field đổi**; 4 hàm link/unlink tag & KB →
  `task_tag_*` / `task_link_*`. Diff là **generic** (duyệt key trong payload, không có danh sách
  field cứng) nên cột thêm sau này tự động được log.

### Changed
- **XP đổi nguồn sang Task.** `XP_REWARDS` còn 2 mục: `task_done` (+10, dedup theo `taskId`) và
  `focus_session` (+15). `useUserTasks.completeTask` gọi `addXp`, `uncompleteTask` gọi `removeXp`.
  Đây là **đảo lại quyết định cũ** ("Task cố ý không tính XP" — FEATURES §16) vì 4 nguồn XP cũ đều
  thuộc Habit/Quiz/Challenge. Dòng `xp_logs` cũ giữ nguyên (append-only) → tổng XP không tụt.
- **Focus Timer tách khỏi Habit** — bỏ picker chọn habit, breakdown theo habit, auto-tick habit
  (`CustomEvent focus:habit-tick`), và 2 cột `focus_sessions.habit_id` / `journey_id`.
- **`MonthCalendar` bỏ hẳn "habit mode"** (prop `habitData` + `skipLog`) — người gọi duy nhất là
  `TrackerPage`. Component giờ chỉ còn 1 chế độ, không có prop cấu hình nào phải dọn.
- **`IncubatorPage` bỏ nhánh "Execute → tạo Habit"** — 2 lựa chọn còn lại (Khoản chi / Nhiệm vụ).
  Incubator giữ nguyên, Inbox core không bị đụng.
- **`OnboardingModal` viết lại 3 bước** — nội dung cũ hướng dẫn MVA, streak, trang Habits, Daily
  Challenge; cả 4 đều không còn tồn tại. Bản mới: Chào mừng → Ghi trước phân loại sau → 6 module.
- **`useActivityLog` thu gọn về đúng 1 việc** — chỉ còn `logTaskEvent`/`logFieldChanges`/
  `logTaskRelation`/`addNote`/`updateNote`/`getTaskLogs`/`deleteLog`. Bỏ `logActivity`,
  `getHeatmapData`, `getTodayCount`. Hằng số `ACTIONS` chỉ còn 9 giá trị, tất cả gắn với Task
  (chống gõ sai, vì cột `action` cố ý không có CHECK constraint — mọi lệnh ghi đều fire-and-forget
  nuốt lỗi nên constraint bị vi phạm sẽ làm log biến mất âm thầm).
- **`PRIORITY_OPTIONS` + `WEEKDAYS`** dời từ `TaskListSection.jsx` sang `src/utils/taskFields.js` để
  Detail Modal dùng chung mà không tạo vòng tròn import.
- **`LinkKBModal`** — `onLink`/`onUnlink` nhận thêm tham số `title` để log ghi được TÊN bài viết thay
  vì uuid (sau khi bài viết bị xoá thì không còn nguồn nào tra ngược tên).
- **`docs/DATABASE.md`** — đoạn chê pattern polymorphic viết lại: `activity_logs` không còn là ví dụ
  của bệnh đó nữa (đã dùng FK thật thay `entity_type`/`entity_id`).

### Removed
- **Life Log gỡ hẳn** — route `/life-log`, `src/pages/LifeLogPage.jsx`,
  `src/components/ActivityHeatmap.jsx`, `src/styles/lifelog.css`, mục Navbar, và KPI
  "🔥 Hoạt động hôm nay" + khối heatmap trên Dashboard. Lấy lại được từ git history.
- **12 điểm ghi sự kiện rời rạc** — 11 call site `logActivity` (InboxPage ×8, FinancePage ×2,
  DailyChallenge ×1) + insert trực tiếp trong `useFocusTimer`. Heatmap là người đọc duy nhất của
  chúng; giữ lại sau khi gỡ Life Log thì thành ghi-mà-không-ai-đọc, đúng bệnh của schema v1.
  Không mất dữ liệu nghiệp vụ: chi tiêu ở `expenses`, subscription ở `subscriptions`, focus ở
  `focus_sessions`, XP ở `xp_logs`.
- **`TrackerPage` ngừng ghi activity log khi tick habit** — Habit tracker đang chờ gỡ hẳn
  (xem `docs/TASKS.md` § Backlog). XP không đổi (vẫn qua `addXp`/`removeXp` → `xp_logs`).
- **Habit tracker + Lộ Trình 21 ngày + Dashboard gỡ hẳn** (đợt 4 — đợt lớn nhất). Phải làm cùng
  một lần: `JourneyContext` bọc toàn App và bị 4 hook import (`useCustomHabits`, `useHabitLogs`,
  `useFocusTimer`, `useJourney`), `useXpStore` bị 6 nơi import — gỡ 1 thứ mà giữ phần còn lại là
  vỡ import ngay. Route `/tracker`, `/habits`, `/dashboard`, `/journey` giờ redirect `/tasks`.
  SQL: DROP 8 bảng (`progress`, `habits`, `habit_logs`, `programs`, `program_habits`,
  `user_journeys`, `journey_habits`, `skip_reasons`), bỏ seed 5 lộ trình mẫu, bỏ `progress` +
  `habits` khỏi realtime publication.
- **Đợt 5 — DROP 3 bảng chết còn lại:** `notification_settings` (chưa hook nào từng đọc/ghi;
  `useNotifications` lưu ở localStorage), `friendships` (archived từ v3.0.0), `fitness_logs`
  (feature gỡ v4.26.0, bảng bị bỏ quên). Trigger `handle_new_user()` bỏ luôn INSERT vào
  `notification_settings`. **Schema 30 → 18 bảng, không còn bảng nào không có hook dùng.**
- **Quiz + Bảng Xếp Hạng gỡ hẳn** (đợt 3 của kế hoạch dọn module) — route `/quiz`, `/leaderboard`,
  2 mục Navbar, `XP_REWARDS.quiz_complete`. BXH là tính năng **xã hội** trong app 1 người dùng →
  giá trị 0. SQL đi kèm: `DROP FUNCTION get_leaderboard()` + `DROP TABLE streaks` + gỡ INSERT
  `streaks` khỏi trigger `handle_new_user()`. Bảng `streaks` vốn đã chết từ lâu — chỉ INSERT đúng
  1 lần lúc signup, không nơi nào UPDATE, nên `current_streak`/`longest_streak` luôn = 0 với mọi
  user; streak hiển thị trên UI vốn tính runtime từ `progress`/`habit_logs`. Số bảng 30 → 29.
- **`LoginNudgeModal` sửa lời hứa sai** — 2/3 gạch đầu dòng quảng cáo tính năng không còn tồn tại
  (Team Mode xoá từ v3.0.0, Leaderboard xoá ở đây). Thay bằng lợi ích thật của việc đăng nhập.
- **Hành Trình Cuộc Đời gỡ hẳn** (đợt 1 của kế hoạch dọn module) — route `/life-journey`,
  `LifeJourneyPage.jsx`, `useLifeJourney.js`, `life-journey.css`, mục Navbar. Cô lập hoàn toàn:
  0 phụ thuộc chéo, 0 bảng Supabase. Dữ liệu cột mốc nằm ở localStorage `vl_life_journey_events`
  + `vl_journey_title` — **xoá code KHÔNG xoá localStorage**, dữ liệu vẫn trong trình duyệt nhưng
  không còn đường vào. Nhờ đó `docs/RULES.md` không còn "legacy exception" localStorage nào.
- **Expand mô tả ▸/▾ trên task card** (cả pending lẫn đã hoàn thành) — thay bằng Detail Modal, giữ cả
  hai thì 1 click có 2 nghĩa. Xoá 2 state `expandedTask` / `expandedCompletedId`.

### Files Removed
- `src/pages/LifeLogPage.jsx`, `src/components/ActivityHeatmap.jsx`, `src/styles/lifelog.css`
- `src/pages/LifeJourneyPage.jsx`, `src/hooks/useLifeJourney.js`, `src/styles/life-journey.css`
- Landing cũ (11 file): `HeroSection.jsx`, `ContentSections.jsx`, `RoadmapSection.jsx`,
  `TrackerSection.jsx`, `ReverseSection.jsx`, `TestimonialsSection.jsx`, `PricingSection.jsx`,
  `styles/hero.css`, `styles/sections.css`, `styles/testimonials.css`, `data/testimonials.json`
- Quiz + BXH (5 file): `QuizPage.jsx`, `LeaderboardPage.jsx`, `styles/quiz.css`,
  `styles/leaderboard.css`, `data/quiz.json`
- Habit + Lộ Trình + Dashboard (25 file, đợt 4): `TrackerPage.jsx`, `HabitManager.jsx`,
  `useHabitStore.js`, `useCustomHabits.js`, `useHabitLogs.js`, `JourneyPage.jsx`,
  `JourneyDetailPage.jsx`, `useJourney.js`, `JourneyContext.jsx`, `components/journey/*` (5),
  `DashboardPage.jsx`, `DailyChallenge.jsx`, `CompletionModal.jsx`, `LoginNudgeModal.jsx`,
  `NotificationSettings.jsx`, `useNotifications.js`, `useMoodSkip.js`, `tracker.css`,
  `journey.css`, `daily.css`, `completion.css`, `dashboard.css`, `data/habits.json`,
  `data/programs.json`, `data/challenges.json`

### Files Added
- `data/migration_v5.0.0_activity_logs_v2.sql`
- `src/components/TaskDetailModal.jsx`
- `src/styles/task-detail.css`
- `src/utils/taskFields.js`
- `src/__tests__/taskFields.test.js`

### Files Modified
- `src/hooks/useActivityLog.js` (viết lại), `src/hooks/useUserTasks.js`, `src/hooks/useFocusTimer.js`
- `src/components/TaskListSection.jsx`, `src/components/LinkKBModal.jsx`, `src/components/DailyChallenge.jsx`
- `src/pages/InboxPage.jsx`, `src/pages/FinancePage.jsx`, `src/pages/TrackerPage.jsx`,
  `src/pages/DashboardPage.jsx`, `src/App.jsx`, `src/components/Navbar.jsx`,
  `src/components/MonthCalendar.jsx`
- `data/schema_v4.24.0.sql`, `DESIGN.md`, `docs/DATABASE.md`, `docs/FEATURES.md`,
  `docs/ARCHITECTURE.md`, `docs/PROJECT.md`, `docs/TASKS.md`, `package.json`

- **`data/schema_v4.24.0.sql`** — gộp v5.0.0 vào master schema (user cho phép tường minh, RULES §3).
  Master giữ tính **idempotent**: dùng `CREATE TABLE IF NOT EXISTS` + `ALTER ADD/DROP COLUMN` thay vì
  `DROP TABLE` như file migration. Nghĩa là có **2 đường tới cùng 1 schema cuối** — chạy master thì
  GIỮ lịch sử `activity_logs` cũ (chỉ purge 3 action đã quyết), chạy `migration_v5.0.0_*.sql` thì
  XOÁ SẠCH. Chọn một, đừng chạy cả hai.

### Known
- Xoá 1 task là **mất luôn lịch sử + ghi chú của nó** (FK CASCADE). Đánh đổi đã chốt khi chọn FK
  thật thay polymorphic — đổi lại DB tự dọn, không bao giờ có dòng mồ côi.
- `activity_logs` giờ chỉ phục vụ Task. Muốn log lại thứ khác thì phải có NGƯỜI ĐỌC trước.

---

## v4.31.0 — 2026-08-02
> Task module: xem/xoá task đã hoàn thành (List + Calendar), confirm/toast dùng chung toàn app,
> `task_tags` UI hoàn thiện, chuỗi task lặp lại (`recurrence_parent_id` — quy tắc sửa/xoá/bỏ tích)
> kèm unit test đầu tiên của repo. Dọn 3 file SQL migration standalone trùng lặp với RUNBOOK.sql.

### Added
- **Xem/xoá task đã hoàn thành:** section "✅ Đã hoàn thành" trong Danh sách (collapsed mặc định,
  lọc theo ngày qua `getCompletedTasksRange`); panel chi tiết ngày trong Lịch gộp chung 1 danh sách
  (task xong + task sắp tới), có nút xoá. Lịch giờ hiện cả task sắp tới (chip tím) không chỉ task
  đã xong (chip xanh).
- **`ToastContext`** (`src/contexts/ToastContext.jsx`) — Toast toàn cục, mount 1 lần ở App root,
  gọi được từ bất kỳ đâu kể cả trong hook (không cần mỗi page tự quản lý). Toast dời sang góc phải
  dưới. Dọn bản Toast tự chế trùng lặp trong `TiptapEditor.jsx`.
- **`useConfirm()` áp dụng cho toàn bộ nút xoá task** — pending (view mode + overflow mobile),
  đã hoàn thành (List + Calendar) — gộp chung 1 `handleDeleteTask()`, không lặp code.
- **`task_tags` UI** — `TagPicker` trên form Thêm/Sửa task, badge `🏷` trên card. `useTags.js` thêm
  entity `task` vào `ENTITY_CONFIG` + `getTagUsageBreakdown(tagId)` (đếm riêng theo loại thay vì
  tổng gộp — dùng cho confirm xoá tag ở Settings, hiện rõ "gỡ liên kết", không xoá bảng cha).
- **Chuỗi task lặp lại (`user_tasks.recurrence_parent_id`, self-FK `ON DELETE CASCADE`)** — quy tắc:
  sửa task không đụng row khác đã tồn tại; xoá task **gốc** chỉ xoá đúng nó; xoá task **không phải
  gốc** cascade xoá hết hậu duệ; bỏ tích tự xoá occurrence đã sinh (chống trùng khi tích/bỏ tích
  nhanh). `ON DELETE CASCADE` thuần không tự làm được rule bất đối xứng này — app tự "cắt dây" con
  của task gốc trước khi xoá nó (`useUserTasks.deleteTask`).
- **`src/data/ui-strings.json`** — text tập trung cho ConfirmModal + Toast (bắt đầu nhỏ, không
  migrate toàn app).
- **`src/__tests__/`** — thư mục unit test mới (khác pattern colocated cũ), `node:assert/strict`
  thường, không framework. `recurrenceUtils.test.js` là bài test đầu tiên trong repo cho logic
  không phải CRUD đơn giản.

### Fixed
- **`deleteTask` no-op cho task lịch sử:** gate cũ `if (isAuth && backup)` bỏ qua Supabase delete
  thật nếu task không có trong state `tasks` cục bộ (vd task hoàn thành từ ngày trước, fetch qua
  `getCompletedTasksRange`) — xoá trên UI nhưng KHÔNG xoá dưới DB. Sửa: luôn gọi Supabase khi đã
  auth, `backup` chỉ dùng cho rollback lỗi.
- **Recurring task mất tag + link KB khi sinh occurrence tiếp theo** — gap phát sinh từ việc thêm
  `task_tags` (tag chưa tồn tại lúc code gốc viết). `spawnRecurringTask` giờ copy cả 2.
  Chống sinh trùng: kiểm tra đã có occurrence tiếp theo chưa trước khi insert. Sinh lỗi hẳn sau
  retry → báo qua toast (trước chỉ log console, user không biết chuỗi lặp đã chết).
- **`nextMonthDay` tràn tháng sai** — ngày lặp không tồn tại ở tháng đích (vd "ngày 31" nhưng tháng
  chỉ có 30 ngày) trước để JS tự tràn sang đầu tháng kế tiếp nữa; giờ clamp về ngày cuối tháng đích.

### Removed
- **3 file migration SQL standalone** (`migration_v4.28.0_tags_rls_indexes.sql`,
  `migration_v4.30.0_merge_knowledge_groups_into_tags.sql`,
  `migration_v5.0.0_cleanup_dead_columns.sql`) — nội dung trùng lặp 100% với `RUNBOOK.sql` (đã
  chạy Phần 1+2), giữ cả 2 nơi gây nhầm lẫn khi chạy tay (dán nhầm file cũ vào Supabase SQL editor
  bị auto-correct `--`→`—` gây lỗi syntax). SQL gốc từng version vẫn xem qua `git log`.

### Changed
- **`RUNBOOK.sql` viết lại thuần ASCII** — bỏ hết ký tự Unicode trang trí (box-drawing, em-dash)
  từng gây lỗi copy-paste; cập nhật trạng thái thật đã xác nhận 2026-08-02: **6 cột chết
  (`collections.resolved/course_name/duration_min/reviewed_at/priority`,
  `user_tasks.collection_id`) đều không tồn tại trên DB** — Phần 3 DROP COLUMN giờ chỉ là no-op
  an toàn, chỉ còn DROP TABLE `knowledge_groups`/`collection_groups` + cột `tags.emoji`/`description`
  là quyết định thật cần cân nhắc.
- **2026-08-02, cùng ngày — RUNBOOK.sql Phần 3 đã chạy trên prod:** `DROP TABLE knowledge_groups,
  collection_groups`, `DROP COLUMN tags.emoji/description`, `DROP COLUMN` 2 cột chết còn lại +
  chuẩn hoá `collections.status`. Bỏ bước 3a (backfill `user_tasks.collection_id`) khỏi khối chạy
  vì cột đó đã xác nhận không tồn tại trên DB này — chạy sẽ lỗi `column does not exist` (transaction
  tự rollback, không mất gì). Verify 4 câu sau khi chạy đều trả 0 dòng — thành công hoàn toàn.
- **2026-08-02, cùng ngày — B6: hợp nhất `RUNBOOK.sql` vào `data/schema_v4.24.0.sql`** (theo yêu
  cầu tường minh, RULES §3). `schema_v4.24.0.sql` giờ phản ánh đúng trạng thái cuối: bỏ
  `user_tasks.collection_id` + 5 cột chết `collections`; thêm `user_tasks.recurrence_parent_id`
  (v4.31.0), `task_tags` junction + VIEW `tagged_items` (v4.28.0); RLS 4 junction tag kiểm ownership
  cả 2 phía (v4.28.0 P0-2); `chk_collections_type` có `podcast` thay `emotion`; `chk_collections_status`
  mới (unread/read/archived); xoá hẳn `knowledge_groups`/`collection_groups` khỏi fresh-install
  (chỉ còn `DROP TABLE IF EXISTS` dọn DB cũ). Bảng đếm 31→30 CREATE TABLE. `RUNBOOK.sql` giữ lại
  làm hồ sơ lịch sử, không cần chạy lại trên DB đã update.

---

## v4.30.0 — 2026-08-01
> Quyết định sản phẩm P2-7: `knowledge_groups` (taxonomy M:N thứ 3 trên `collections`) trùng việc
> với `tags`. Sau thảo luận, chốt **bỏ hẳn tính năng "Nhóm" khỏi giao diện** Knowledge Base — không
> gộp hiển thị (tag+emoji) như phương án đầu, mà đơn giản hoá về chỉ còn tag thường. Dữ liệu nhóm cũ
> migrate thành tag thường (không mất liên kết bài viết, chỉ mất hiển thị "folder"). Code xong, SQL
> còn 1 bước breaking chờ user tự chạy (agent không kết nối Supabase) — xem `docs/TASKS.md` v4.30.0.

### Removed
- **Tính năng "Nhóm"/folder trong Knowledge Base** — bỏ hẳn khỏi UI: tab 📁 Nhóm, `GroupPicker`,
  drill-down view, group list, badge folder trên `ArticleCard`. Chỉ còn tag thường (`#tag`)
- **`src/hooks/useKnowledgeGroups.js`** — không còn ai import

### Changed
- **`data/migration_v4.30.0_merge_knowledge_groups_into_tags.sql`** — Phase 1 (đã chạy: thêm cột
  `tags.emoji`/`description`, copy data từ `knowledge_groups`/`collection_groups`), Phase 2 breaking
  (comment sẵn): `DROP TABLE knowledge_groups, collection_groups` **+ `DROP COLUMN tags.emoji,
  tags.description`** (không còn UI nào đọc 2 cột này sau khi bỏ tính năng Nhóm)
- **`data/RUNBOOK.sql`** — gộp 3 migration rời (`v4.28.0`, `v5.0.0`, `v4.30.0`) thành 1 file chạy
  tuần tự cho đỡ rối, giữ nguyên 3 file gốc làm hồ sơ lịch sử

### Fixed (phát hiện qua verify đối kháng khi còn ở phương án "gộp hiển thị", trước khi đổi hướng)
- **SQL:** `INSERT...SELECT...ON CONFLICT DO UPDATE` copy `knowledge_groups→tags` có thể crash
  "cannot affect row a second time" nếu 1 user có ≥2 nhóm cũ trùng tên (không hoa/thường) — code cũ
  chưa từng chặn tạo nhóm trùng tên. Thêm `DISTINCT ON` trước khi insert (vẫn áp dụng dù đổi hướng)
- **`docs/DATABASE.md`** tự mâu thuẫn — dòng tổng kết đã sửa "27 active" nhưng heading
  `### Table Inventory` cách đó vài dòng vẫn ghi "(29 active)"

---

## v4.29.1 — 2026-08-01
> Audit duplicate-logic: 10 phát hiện, tất cả đã fix. Báo cáo snapshot từng nằm tại
> `docs/AUDIT_REPORT_2026-08-01_duplicate_logic.md` và được xóa ở v6.2 khi toàn bộ nội dung đã hết
> hiệu lực. Chủ đề chung: một sự thật từng được giữ độc lập ở nhiều nơi.

### Fixed
- **Lệch ngày UTC (66 chỗ, 21 file)** — `new Date().toISOString().split('T')[0]` bị thay bằng `toDateStr()` (local) ở mọi nơi tính "hôm nay" cho logic nghiệp vụ (`useUserTasks`, `useSubscriptions`, `useJourney`, `useHabitLogs`, `useCollections`, `useHabitStore`, `FinancePage`). Trước đây từ 00:00–06:59 giờ VN, task "Hôm nay" có thể biến mất khỏi list, subscription auto-advance sai
- **`data/reset_user_data.sql`** thiếu `DELETE FROM knowledge_groups` + `inspirational_quotes` — script tự khai "reset toàn bộ, không hoàn tác" nhưng để sót 2 bảng
- **`DashboardPage` biểu đồ chi tiêu luôn ra màu xám** — `CAT_COLORS` tự hardcode keyed theo label tiếng Việt, trong khi data lưu key tiếng Anh → lookup luôn miss. Nay build từ `expense-categories.json` theo `key`, giống `FinancePage`
- **`window.alert()` thứ 2** ở `IncubatorPage.jsx` (guard "Thực thi") — thay bằng state lỗi inline
- **`useUserTasks.spawnRecurringTask`** — thêm `logger.error` khi `recurrence_rule.type` không khớp branch nào, trước đó `return false` âm thầm làm task lặp lại biến mất không dấu vết

### Added
- **`src/components/Toast.jsx`** (`useToast()`) — thay `window.alert()`, cùng pattern với `useConfirm()`/`ConfirmModal`. Áp dụng cho `CollectPage.jsx` (tạo task từ bài KB)
- **`SUBSCRIPTION_CYCLES`/`advanceByCycle`/`monthlyCostForCycle`** (`currencyUtils.js`) — 1 nguồn cho chu kỳ subscription, thay 5 bản viết tay độc lập ở `FinancePage.jsx` + `useSubscriptions.js`
- **`mondayIndex`/`getWeekStart`/`getWeekDates`** (`dateUtils.js`) — 1 nguồn cho công thức "tuần bắt đầu Thứ Hai", thay 5 bản (`useHabitStore`, `TrackerPage`, `DashboardPage` x2, `MonthCalendar`)
- **`useHabitStore.calcStreak`/`getLongestStreak`** giờ export — `TrackerPage.effectiveStreak`/`effectiveLongest` gọi lại thay vì có bản copy riêng

### Changed
- **6 modal tay → `GenericModal`**: `IncubatorPage` (Defer + Execute modal), `InboxPage` (expense modal), `TrackerPage` (Skip Reason), `JourneyDetailPage` (DayDetailModal), `ProgramBrowser` (switch mode), `CustomJourneyModal`. Xoá CSS wrapper chết theo (`incubator-modal*`, `inbox-expense-modal*`, `journey-modal*`, `modal-backdrop`/`auth-modal` copy ở 3 nơi)
- **`FinancePage`** — input ngày gia hạn subscription: native `<input type="date">` → `DatePickerPopover` (đúng RULES.md, đồng bộ với `TaskListSection`)

### Docs
- **Audit snapshot duplicate-logic** — tại thời điểm release có báo cáo đầy đủ 10 phát hiện; file được
  xóa trong đợt dọn tài liệu v6.2 sau khi không còn phản ánh source hiện tại.
- **`docs/TASKS.md`, `docs/PLAN.md`** — rút gọn ~1140 dòng lịch sử đã trùng với CHANGELOG.md thành pointer 1 dòng (verify riêng: không mất task/decision nào đang mở)
- **`project_analysis.md`** (root) — xoá, đã lỗi thời (v4.22.0) và trùng nội dung với `PROJECT.md`/`docs/AUDIT_REPORT_2026-06-27.md`

---

## v4.29.0 — 2026-07-29
> Làm `/tasks` rõ ràng + thêm view Lịch. Ponytail **ultra**: mọi thứ dưới đây
> dùng token/component đã có, **không thêm dependency, không migration, không token mới**.

### Added
- **Hero cho `/tasks`** — số việc cần làm (quá hạn + hôm nay) ở display scale với `.gradient-text` clip `--grad-hero`, kèm 3 tile Quá hạn / Hôm nay / Sắp tới. **Độ nổi mã hoá độ gấp**, không phải bảng màu: quá hạn nền đỏ-alpha, hôm nay tím, sắp tới `opacity 0.6`. Trước đó cả trang cùng cỡ `0.8rem` → không có điểm nhìn
- **Tab 📋 Danh sách / 📅 Lịch** — pill switcher `role="tablist"` + `aria-selected`, dùng lại đúng formula của `.inbox-filter-chip`
- **`MonthCalendar` task mode** — không truyền `habitData` thì ô ngày cao `76px` và hiện **chip tên task** (tối đa 2 + `+N nữa`) thay 1 dấu dot. Đây là thứ làm calendar trông giống Google Calendar
- **Dải màu priority** — `3px border-left` trên `.task-item`, màu lấy từ `PRIORITY_OPTIONS` đã có. Inline chứ không tạo 5 class cho 5 màu
- **Animation tick** — `✓` là `::after`, `:hover` hé mờ, `:active` `scale(1.35)` + `--shadow-green`. **Zero state React, zero DOM thêm.** Kèm escape `prefers-reduced-motion`
- **Empty state** có icon disc + tiêu đề + hint, thay dòng text trơn

### Fixed — lỗi hiển thị lịch (phát hiện khi user gửi screenshot)
- **🔴 `grid-template-columns: repeat(7, 1fr)` làm lệch cả 7 cột.** `1fr` = `minmax(auto, 1fr)`, nên chip task (`white-space: nowrap`) **đẩy cột rộng ra**: trong screenshot ô ngày 28 rộng ~2.5× ô ngày 29. Đây là nguyên nhân thật của "trông như lỗi", không phải padding. Sửa thành `repeat(7, minmax(0, 1fr))` + `min-width: 0` trên `.cal-cell--tasks` và `.cal-cell__chips`. Đo lại: **7 cột đều 147px**, chip nằm trong ô và ellipsis đúng
- **Ô ngày không có viền** → lưới không đọc ra là lưới, chỉ là số trôi lơ lửng. Thêm hairline `1px var(--bg-glass-border)` + fill `--bg-card` theo DESIGN.md ("the 1px hairline that defines every glass edge")
- **Ô "done" tô xanh + chip cũng xanh = khối xanh nặng.** Task mode bỏ fill xanh của ô (`--bg-card`), chỉ đậm viền lên `rgba(0,255,136,0.28)` — màu do chip mang
- **Ô cao 76px mà trống hoác** → `62px` min, padding chặt hơn, số ngày `opacity 0.75`
- **Progress bar vô nghĩa trong task mode** — nó vẽ `% ngày có task`, hiện ra thanh 6% trong track rộng, nhìn như đang lỗi. Bỏ bar ở task mode, giữ con số
- **Khoảng trống hai bên trên màn rộng** — `.tasks-page` nới `900px → 1180px` khi ở view lịch (`.tasks-page--calendar`); view danh sách giữ 900px vì đó là khổ đọc tốt
- Ngày chưa tới ở task mode: viền `dashed` + `opacity 0.45` — giữ ô để lưới liền mạch thay vì biến mất

### Changed
- **`getCompletedTasks(dateStr)` → `getCompletedTasksRange(start, end)`** — calendar cần chip trên **mọi** ô, cách cũ là 1 query/ngày = **30 query/tháng**. Nay 1 query/tháng, group ở client. Đệm ±1 ngày vì `completed_at` là timestamptz so sánh theo **UTC** còn ta group theo ngày **địa phương**
  - **Sửa kèm 1 bug lệch ngày:** cách cũ bucket theo UTC, nên task xong lúc 00:00–07:00 giờ VN rơi vào ô ngày **hôm trước**. Nay group bằng `toDateStr()` (local) → đúng ngày
  - `MonthCalendar` bỏ luôn `loadingTasks` + handler async: click ngày chỉ là filter mảng đã fetch
- **`MonthCalendar`** — `todayStr` đổi từ `toISOString().split('T')[0]` (UTC) sang `toDateStr()` (local). Đây là 1 trong 5 chỗ đã ghi nợ ở v4.26.1

### Removed
- **Block "✅ Đã hoàn thành hôm nay"** khỏi `TaskListSection` (~45 dòng, cả nút ↩ uncomplete + 🗑). Task xong giờ xem ở tab 📅 Lịch — theo đúng yêu cầu. Kéo theo bỏ `completedToday` + `uncompleteTask` khỏi destructure và `totalCount`
- **Tiêu đề + badge đếm** trong card `TaskListSection` — đã có ở hero, để lại là trùng
- Lint: **64 → 62 warning** nhờ code bị xoá

### Notes
- **Cố ý KHÔNG làm week/day time-grid kiểu Google Calendar.** `due_time` mặc định `23:59` nên mọi task sẽ dồn vào 1 hàng đáy — nhìn như hỏng. Phần đắt nhất của GCal (cột giờ, thuật toán xếp event chồng nhau, drag-resize, vạch giờ hiện tại) không đem lại gì cho dữ liệu all-day
- **Cố ý KHÔNG làm** Board view, Gantt, assignee, sprint, custom field, custom status (xem `docs/TASKS.md` § "Cố ý KHÔNG làm")
- `habitData` là **prop optional**, không phải flag cấu hình. Khi cắt feature habit thì xoá nhánh `habitMode` là xong. `/tracker` + `/life-log` giữ nguyên hành vi cũ, **không regression**
- **Chưa verify được bằng browser:** chip task trong ô lịch cần đăng nhập (session browser của agent là guest). Đã verify: route, hero (60px, gradient clip), 3 tile, tab switch, guest gate, CSS `.cal-chip`/`.cal-cell--tasks`/`.cal-cell--empty`/`.task-checkbox-btn::after` đều load, không scroll ngang. **Mày tự mở `/tasks` → tab 📅 Lịch để xem chip.**
- `npm run build` 0 lỗi · `npm run lint` 0 error / 62 warning · `npm test` 3/3

### Files Added
- (không có)

### Files Modified
- `src/pages/TasksPage.jsx` (hero + view switcher), `src/components/TaskListSection.jsx`, `src/components/MonthCalendar.jsx`, `src/hooks/useUserTasks.js`
- `src/pages/TrackerPage.jsx`, `src/pages/LifeLogPage.jsx` (đổi tên prop)
- `src/styles/tasks.css`, `src/styles/calendar.css`
- `DESIGN.md` (2 section mới: Tasks page atoms, Calendar task mode), `docs/FEATURES.md` (§9 viết lại 2 mode, §16, §24), `docs/ARCHITECTURE.md`, `docs/TASKS.md`, `PROJECT.md`, `CHANGELOG.md`, `package.json`

## v4.28.0 — 2026-07-29
> Audit thiết kế DB cho trục **Inbox — Knowledge — Task — Tags**. Tìm được 7 lỗ hổng.
> 2 file migration **user tự chạy trên Supabase** (agent không kết nối được).

### Fixed — code (ship TRƯỚC khi chạy `migration_v5.0.0`)
- **`CollectPage.onCreateTask` link bị mất từ v4.5.0.** Nó truyền `collectionId` vào `addTask()` → ghi vào `user_tasks.collection_id`, cột **deprecated từ v4.5.0 và không được đọc ở đâu**. Kết quả: task tạo từ bài Knowledge **không hiện badge `🔗 N bài`** và **không xuất hiện trong filter `📌 Task`** ở Knowledge. Nay gọi `linkCollection(result.id, item.id)` → vào junction `task_collections`
- **`useUserTasks.addTask`** — bỏ tham số `collectionId` + cột `collection_id`. Hai đường link song song cho cùng 1 quan hệ đã hết
- **`IncubatorPage`** — bỏ `durationEst` truyền vào `addTask`. Tham số này **không tồn tại** trong signature (cột `duration_est` DROP ở v4.9.0) nên đang bị bỏ qua im lặng, để lại chỉ gây tưởng `estimated_time` được mang sang task
- **`useCollections.addItem`** — bỏ ghi `priority` (cột chết); `status` default `'inbox'` → `'unread'`
- **`useCollections.classifyItem`** — `status` luôn `'unread'`, bỏ giá trị `'inbox'` (trùng nghĩa với `type='inbox'`, không query nào filter theo nó)

### Added — `data/migration_v4.28.0_tags_rls_indexes.sql` (AN TOÀN, chạy được ngay)
- **P0-1 · `chk_collections_type` sai.** CHECK có `'emotion'` (grep `src/` = 0 hit) và **thiếu `'podcast'`** (có trong `knowledge.json`, UI cho chọn) → nếu constraint đã áp trên prod thì classify sang 🎧 Podcast **fail constraint violation**. Nếu chưa áp thì đây là **schema drift** (file ≠ prod). Migration `UPDATE ... SET type='note' WHERE type='emotion'` trước rồi áp CHECK mới
- **P0-2 · 4 junction RLS chỉ kiểm ownership 1 phía.** `task_collections` chỉ kiểm `task_id`; 3 bảng `*_tags` chỉ kiểm entity, **không kiểm `tag_id`**. Ghi được row trỏ sang collection/tag của user khác. **Không leak khi đọc** (RLS bảng đích chặn) nhưng tạo rác render thành link trắng. Nay `USING` + `WITH CHECK` kiểm cả 2 phía
- **P1-3 · Thiếu index chiều ngược.** `expense_tags` và `subscription_tags` chỉ có index theo entity, **không có `tag_id`** → query "mọi expense có tag X" full scan. (`collection_tags` đã có đủ 2 chiều.) Thêm 2 index
- **`task_tags` junction** — Task trước đây **không có tag nào**. Composite PK + CASCADE + RLS 2 phía. Chỉ index `tag_id`, **không** tạo index `task_id` vì PK đã index nó làm cột dẫn đầu (3 junction cũ tạo index trùng PK — dư thừa, không copy)
- **VIEW `tagged_items`** — `UNION ALL` 4 junction → 1 query cho "mọi thứ có tag X" thay vì 4 query + ghép client. Dùng **`WITH (security_invoker = true)`**, bắt buộc: view mặc định chạy bằng quyền OWNER và **bỏ qua RLS** → sẽ leak data mọi user

### Added — `data/migration_v5.0.0_cleanup_dead_columns.sql` (🚨 BREAKING, CHƯA CHẠY)
- DROP 5 cột chết trên `collections`: `resolved`, `course_name`, `duration_min`, `reviewed_at`, `priority` (grep 0 hit; `priority` chỉ passthrough INSERT)
- DROP `user_tasks.collection_id` + FK + index, kèm backfill nốt vào junction trước khi xoá
- Chuẩn hoá `collections.status` → CHECK `(unread, read, archived)`. **Giữ `archived`** — đó là
  soft-delete đang dùng thật trong `CollectPage.jsx` và `useCollections.js`; chuẩn hoá về
  `unread|read` như dự định ban đầu **sẽ xoá mất chức năng archive**
- File có mục "KIỂM TRƯỚC" (6 câu SELECT phải = 0), điều kiện tiên quyết, và smoke test 5 bước

### Notes
- **Không** đụng `data/schema_v4.24.0.sql` (RULES §3 + §15 — master schema chỉ sửa khi có chỉ thị rõ ràng). Sau khi chạy 2 migration, master schema sẽ lệch với prod cho tới lần hợp nhất tiếp theo
- **Thứ tự bắt buộc:** deploy code v4.28.0 → chạy `migration_v4.28.0` → (backup) → chạy `migration_v5.0.0`. Chạy v5.0.0 trước khi deploy code sẽ làm mọi INSERT `collections`/`user_tasks` fail
- **Tag KHÔNG bị thừa bảng** — đã có 1 bảng `tags` trung tâm, không có cột `tags TEXT[]` nào lặp. N junction là giá của FK integrity; cố ý **không** làm `taggables` polymorphic vì `entity_id` không FK được → rác vĩnh viễn (đúng bệnh `activity_logs`)
- **Chưa làm:** `parent_id` subtask — có **6 chỗ vỡ ở tầng list** (subtask render 2 lần, nesting đứt ngang section do `due_date NOT NULL`, LinkKBModal trả null, recurring mất checklist, delete để lại rác UI, calendar/notification ồn). Cố ý không trộn với refactor DB. Xem `docs/TASKS.md`
- Còn 1 vi phạm RULES chưa sửa: `alert()` ở `CollectPage.onCreateTask` (RULES cấm `window.alert`). Cần component toast — ngoài scope đợt này
- `npm run build` 0 lỗi · `npm run lint` 64 warning = baseline · `npm test` 3/3 OK

### Files Added
- `data/migration_v4.28.0_tags_rls_indexes.sql`, `data/migration_v5.0.0_cleanup_dead_columns.sql`

### Files Modified
- `src/hooks/useCollections.js`, `src/hooks/useUserTasks.js`, `src/pages/CollectPage.jsx`, `src/pages/IncubatorPage.jsx`
- `docs/DATABASE.md` (thêm `task_tags`, section Views, section Kiến trúc Tag, sửa CHECK + deprecated columns), `docs/TASKS.md`, `CHANGELOG.md`, `package.json`

## v4.27.0 — 2026-07-29
### Added
- **Route `/tasks` — Task thành module độc lập.** Trước đây `TaskListSection` **chỉ** render bên trong
  `TrackerPage` tab "⚡ Hôm Nay"; file lịch sử đó đã bị xóa. Module Task từng bị ràng cứng vào trang
  habit nên không thể cắt habit mà không mất Task. Nay:
  - `src/pages/TasksPage.jsx` — container mỏng, lazy-loaded. **Không** thêm `<h1>` vì card của `TaskListSection` đã có header (tiêu đề + đếm + nút "+ Thêm") — thêm nữa là trùng tiêu đề
  - `src/styles/tasks.css` — tách 105 dòng CSS task (`.task-item`, `.task-checkbox-btn`, `.task-option-btn`, `.task-form-rec-panel`, `.task-desc-box` + light-mode overrides) khỏi `tracker.css`, `TaskListSection` tự import (theo tiền lệ `TrackerSection.jsx`). Lý do tách: `tracker.css` sẽ bị xoá khi cắt feature habit
  - `ROUTE_META['/tasks']` cho SEO title/description

### Changed
- **`Navbar` — `📌 Nhiệm Vụ` vào PRIMARY_NAV, `Life Log` xuống SECONDARY_NAV.** Bottom-tabs mobile đang 6 link + nút "Thêm" = 7; thêm Tasks mà không dời gì sẽ thành 8 tab, quá chật. Life Log là trang xem heatmap (drill-down còn chưa có — xem v4.26.2), phù hợp SECONDARY hơn
- **`TrackerPage`** — xoá `<TaskListSection />` + import. TrackerPage giờ chỉ còn habit/mood/challenge/insight/notification
- **Bonus code-splitting:** main chunk **906.48 kB → 876.53 kB (−30 kB)**. `TaskListSection` (30.42 kB) trước đây nằm trong main chunk vì `TrackerPage` là eager-loaded; nay đi theo chunk `TasksPage` lazy

### Notes
- `.task-list-card`, `.task-actions--desktop/mobile`, `.task-overflow-menu/item` **vẫn ở `global.css`** — cố ý không dời: `global.css` luôn được load nên không có nguy cơ mất khi `tracker.css` bị xoá. Hệ quả: CSS của Task hiện nằm ở 2 file
- **Chưa làm** (cần migration SQL user tự chạy): subtask `parent_id`, junction `task_tags`, inline quick-add theo từng nhóm. Xem `docs/TASKS.md`
- Verify: `npm run build` 0 lỗi · `npm run lint` 64 warning = baseline · `/tasks` render + `tasks.css` áp đúng (`.tasks-page` max-width 900px, `.task-option-btn` padding 4.8/10.4px, `.task-form-rec-panel` bg `rgba(6,182,212,0.04)`) · `/tracker` không còn `.task-list-card` và vẫn render bình thường · 0 console error

### Files Added
- `src/pages/TasksPage.jsx`, `src/styles/tasks.css`

### Files Modified
- `src/App.jsx` (lazy import + route + ROUTE_META), `src/components/Navbar.jsx`, `src/components/TaskListSection.jsx` (thêm import CSS), `src/pages/TrackerPage.jsx`, `src/styles/tracker.css`
- `docs/FEATURES.md` §16, `docs/ARCHITECTURE.md`, `docs/TASKS.md`, `PROJECT.md`, `CHANGELOG.md`, `package.json`

## v4.26.2 — 2026-07-29
### Removed
- **`useActivityLog.getTimelineByDate()`** (31 dòng) — dead code. JSDoc ghi *"for DailyTimeline component"*, nhưng component đó chưa bao giờ tồn tại. Grep toàn `src/`: **0 caller**. Hàm được export nên trông như API sẵn có, thực chất là lời hứa chưa thực hiện. Hook nay còn 3 hàm: `logActivity`, `getHeatmapData`, `getTodayCount`

### Fixed (tài liệu sai — không đổi hành vi runtime)
- **JSDoc `useActivityLog`** khai **6/13 `action` không có caller nào**: `task_add`, `collect_add`, `mood_set`, `xp_earned`, `journey_start`, `journey_complete`. Đồng thời **thiếu 5 action đang ghi thật**: `subscription_add`, `inbox_snooze`, `inbox_classify`, `inbox_bulk_delete`, `inbox_bulk_classify`. Thay bằng bảng 11 action verify từ call site, kèm cột "Written by"
- **`docs/FEATURES.md` §24** mô tả *"Daily drill-down: Click ngày → vertical timeline với action icons, timestamps, labels, XP amounts"* — feature này **không tồn tại**: `handleHeatmapClick` trong `LifeLogPage.jsx:40` là no-op (`() => {}`). Xoá bullet, thêm dòng MonthCalendar (thứ thực sự đang render), sửa list action 7 → 11

### Notes
- ⚠️ **Không** xoá/thêm call site `logActivity` nào (12 chỗ) — heatmap `/life-log` + KPI "Hoạt động" `/dashboard` vẫn chạy nguyên
- Ghi lại 3 giới hạn đã phát hiện vào JSDoc + `docs/TASKS.md` (không giấu TODO chỉ trong code — RULES §"General Practices"):
  - `amount` nhồi **4 đơn vị** vào 1 cột: XP (`habit_done`) / VNĐ (`expense_add`) / số ngày (`inbox_snooze`) / số item (`inbox_bulk_*`), không có cột unit → không SUM/so sánh được
  - Read-side **chỉ COUNT row**. `action`, `label`, `amount`, `meta` ghi vào DB nhưng **chưa được đọc ở đâu**
  - Coverage lệch: `useUserTasks.completeTask` (cách hoàn thành task bình thường) **không log gì** — chỉ Inbox quick-done phát `task_done`
- Cố ý **chưa** thiết kế lại schema: read-side hiện chỉ là 1 con số đếm, chưa biết cần query gì thì thiết kế event schema sẽ lặp lại đúng sai lầm cũ. Chờ xong feature
- `npm run build` 0 lỗi · `npm run lint` 64 warning = baseline · `npm test` 3/3 OK

### Files Modified
- `src/hooks/useActivityLog.js` (−31 dòng logic, JSDoc viết lại)
- `docs/FEATURES.md` §24, `docs/TASKS.md`, `CHANGELOG.md`, `package.json`

## v4.26.1 — 2026-07-28
### Added
- **`npm test`** — chạy cả 3 self-check: `api/_lib/smoke.test.js`, `src/utils/dateUtils.test.js`, `src/utils/mediaUtils.test.js`. Không thêm test framework nào, chỉ `node:assert` + `node <file>`
- **`src/utils/dateUtils.test.js`** — khoá hợp đồng "`toDateStr` phải theo giờ **địa phương**". Case 00:30 sáng sẽ fail ngay nếu ai đó đổi lại thành `toISOString()`. Đã chạy pass ở TZ `Asia/Ho_Chi_Minh`, `UTC`, `America/New_York`
- **`src/utils/mediaUtils.test.js`** — 30 case khoá hành vi trước khi gộp `isAudioUrl`/`isVideoUrl`, gồm các chỗ 2 hàm cũ lệch nhau: `#podcast` chỉ tính audio, `.webm`/`.ogg` khớp cả hai, URL không parse được thì chỉ dựa vào đuôi file

### Changed (Refactor P2 — tầng data, không đổi hành vi)
- **`useUserTasks` / `useIntentions` / `useTags`** — bỏ singleton `getSb()` + `await import('../lib/supabase')` (8 dòng/file), dùng `import { supabase, isSupabaseEnabled }` như 17 hook còn lại. Lazy-import này vốn không tiết kiệm gì: `AuthContext` (provider gốc) đã import tĩnh `supabase`, nên module luôn nằm trong main chunk. Xoá **29 cặp** `const sb = await getSb()` + `if (!sb) return …`; lớp bảo vệ chuyển vào `const isAuth = isSupabaseEnabled && !!user` — mọi hàm DB trong 3 hook đều đã gate bằng `isAuth`, nên không mất guard nào
- **`useCollections`** — `getSnoozedCount` và `fetchSnoozedItems` dùng chung `snoozedFilter()`. Trước đây định nghĩa "snoozed là gì" (3 điều kiện `.eq/.eq/.gt`) bị copy ở 2 nơi, đổi rule phải sửa 2 chỗ
- **`mediaUtils`** — `isAudioUrl` + `isVideoUrl` giống nhau ~90% (mỗi hàm lặp regex đuôi file 2 lần: 1 trong `try`, 1 trong `catch`) → gộp về `isMediaUrl(url, kind, extRe)`, 2 export thành wrapper 1 dòng
- **`dateUtils`: thêm `toDateStr(date?)`** — gộp **4 bản copy y hệt** của hàm sinh chuỗi `yyyy-MM-dd` theo giờ local: `todayStr` (TaskListSection), IIFE `_today` (useIntentions), `localDateStr` (IncubatorPage), `toStr` (DatePickerPopover). 17 callsite đổi tên, hành vi không đổi (cả 4 bản đều là local)

### Notes
- ⚠️ **Còn 5 chỗ dùng `toISOString().split('T')[0]` (UTC) làm "hôm nay"** — `useUserTasks`, `useSubscriptions`, `DashboardPage`, `CashflowBar`, `MonthCalendar`. Ở GMT+7 từ 00:00–06:59 chúng hiểu là *ngày hôm qua*. Đây là **bug timezone**, không phải over-engineering, và sửa nó đổi cách chốt ngày của task/subscription/calendar → cố ý KHÔNG gộp vào đợt refactor này. `TODO: decision needed`
- **Chưa làm** 2 mục còn lại của P2 vì đang chờ quyết định: (a) xoá 2 thang fallback migration ở `useCollections`/`useUserTasks` — cần biết migration `task_collections`/`collection_tags` đã chạy trên prod chưa; (b) bỏ retry của `spawnRecurringTask` — RULES §7 đang liệt kê nó là pattern bắt buộc
- `npm run build` 0 lỗi · `npm run lint` 64 warning = baseline · `npm test` 3/3 OK

### Files Added
- `src/utils/dateUtils.test.js`, `src/utils/mediaUtils.test.js`

### Files Modified
- `src/hooks/useUserTasks.js`, `src/hooks/useIntentions.js`, `src/hooks/useTags.js`, `src/hooks/useCollections.js`
- `src/utils/dateUtils.js`, `src/utils/mediaUtils.js`
- `src/components/TaskListSection.jsx`, `src/components/DatePickerPopover.jsx`, `src/pages/IncubatorPage.jsx`
- `package.json` (script `test` + version), `CHANGELOG.md`, `docs/TASKS.md`, `docs/PLAN.md`, `docs/ARCHITECTURE.md`, `README.md`, `PROJECT.md`

## v4.26.0 — 2026-07-28
### Removed
- **Feature Fitness Log / 🏋️ Sức Khỏe (tab 5 của `/tracker`)** — xoá toàn bộ code frontend:
  - `src/hooks/useFitnessLog.js` (203 dòng) — xoá file
  - `src/pages/TrackerPage.jsx` — xoá tab `fitness` (209 dòng JSX: form nhập, list hôm nay, inline edit, week summary), 5 state `fit*` + `editFit`, entry `{ key: 'fitness' }` trong `TABS`, import hook. **TrackerPage nay còn 4 tab**: ⚡ Hôm Nay · 📅 Lịch · 📊 Tuần · ⚙️ Quản Lý
  - `src/pages/DashboardPage.jsx` — xoá section "🏋️ Sức Khỏe" + card "Tuần Này" (29 dòng), hook `useFitnessLog`, import
  - XP `fitness_done` (+10/buổi) và `logActivity('fitness_done')` biến mất cùng tab — không có chỗ nào khác gọi
- Tổng: **-455 dòng** code

### Notes
- **Bảng `fitness_logs` KHÔNG bị DROP.** `data/schema_v4.24.0.sql` là master schema, RULES §3 cấm sửa khi không có chỉ thị rõ ràng. Bảng vẫn tồn tại trên production, không hook/page nào dùng → an toàn để DROP khi bạn muốn. Ghi nhận trong `docs/DATABASE.md` như bảng archived (giống tiền lệ `friendships`). `TODO: decision needed` — có DROP bảng + data không?
- **Row `activity_logs` cũ với `action = 'fitness_done'` vẫn còn** và vẫn được tính vào heatmap Life Log. Đây là bảng append-only audit (RULES: no UPDATE/DELETE) nên cố ý không xoá. Không gây lỗi render: LifeLogPage không map `action` → label, chỉ đếm.
- **`tpl-fitness` trong `src/data/programs.json` KHÔNG bị xoá** — đó là journey template "Kỷ Luật Thể Chất" (21 ngày: tập luyện / uống nước / ngủ sớm) thuộc feature Journey (§14), không liên quan tới Fitness Log. Xoá nó sẽ mất 1 trong 5 template hệ thống và phá journey đang chạy của user.
- `npm run build` 0 lỗi · `npm run lint` 64 warning = baseline · `node api/_lib/smoke.test.js` OK

### Files Removed
- `src/hooks/useFitnessLog.js`

### Files Modified
- `src/pages/TrackerPage.jsx`, `src/pages/DashboardPage.jsx`, `package.json`
- `docs/FEATURES.md` — xoá §22, **đánh số lại §23–§28 → §22–§27** (header khai báo "§1–§27 đang chạy, số duy nhất và tăng dần"), bỏ dòng XP Fitness, bỏ dòng Data Architecture, sửa "5 tabs" → "4 tabs", thêm dòng vào bảng **Archived / Removed**
- `docs/DATABASE.md` — `fitness_logs` chuyển xuống nhóm archived, **đánh số lại inventory 23–30 → 22–29**, table count `30 active + 1 archived` → `29 active + 2 archived`, bỏ `fitness_logs` khỏi Entity Overview, bỏ dòng XP Fitness
- `docs/ARCHITECTURE.md` — bỏ domain `Fitness`, thêm `fitness_logs` vào `Archived`, `hooks/ (21)` → `(20)`, sửa số bảng active
- `docs/RULES.md` — bỏ dòng `Fitness Log +10` khỏi bảng XP §16
- `PROJECT.md` — module map `/tracker`: `5 tab` → `4 tab`, bỏ `useFitnessLog` + `fitness_logs`; sửa `§1–§28` → `§1–§27`
- `docs/PLAN.md`, `docs/TASKS.md` — ghi nhận việc xoá
- Entry lịch sử của v4.0.0 / v4.0.3 trong `PLAN.md`, `TASKS.md`, `README.md`, CHANGELOG cũ **giữ nguyên** — là log quá khứ, không phải mô tả trạng thái hiện tại

## v4.25.1 — 2026-07-28
### Added
- **`api/_lib/driveToken.js`** — Helper ký JWT Service Account + đổi access token, dùng chung cho `/api/upload` và `/api/stream` (trước đó mỗi file 1 bản copy). Cache token **theo scope** (`Map` scope → token): upload cần `/auth/drive` (ghi), stream chỉ cần `/auth/drive.readonly`. Nếu cache chung 1 biến thì upload có thể nhận token readonly → 403 khó hiểu, nên key theo scope là bắt buộc chứ không phải tùy chọn
- **`api/_lib/smoke.test.js`** — Self-check chạy bằng `node api/_lib/smoke.test.js`, phủ 3 điều `npm run build` không kiểm được: (1) `base64url` cho ra đúng chuỗi như chain `.replace()` cũ (sai là JWT chết âm thầm), (2) format tên file upload không đổi, (3) sign/verify RS256 round-trip với key thật. Đặt trong `_lib/` nên Vercel không route thành endpoint

### Changed
- **`api/upload.js` + `api/stream.js`** — Bỏ 2 bản `getDriveToken` trùng nhau (~27 dòng/file), import từ `_lib/driveToken.js`. Upload nay **cũng cache token** (trước không cache, mỗi request ký JWT mới) — hệ quả: đổi Service Account key thì token cũ còn sống tối đa ~58 phút, giống hành vi `/api/stream` vốn có
- **`api/_lib/*.js`** — 6 chuỗi `.toString('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_')` → `.toString('base64url')` (native Node)
- **`api/_lib/verifyAuth.js`** — Bỏ `createClient()` + helper `withTimeout` tự viết (10 dòng `Promise.race`), thay bằng 1 `fetch` tới `/auth/v1/user` với `AbortSignal.timeout(8000)`. Hành vi giữ nguyên: token sai/hết hạn → `null` → handler trả 401. Thêm `.replace(/\/$/, '')` cho `SUPABASE_URL` (trước `createClient` tự lo dấu `/` cuối). Phụ: `api/` không còn import `@supabase/supabase-js` → bundle serverless nhỏ hơn
- **`api/upload.js`** — `generateFileName()` từ 15 dòng (6 biến `padStart`) còn 4 dòng. **Format tên file giữ y nguyên** `LifeHub_<folder>_<yyyymmdd>_<HHMMSS>_<hex6>.<ext>`, có test khẳng định. Giữ nguyên `Math.floor(Math.random()*0xffffff).padStart(6,'0')` — không đổi nguồn entropy, và `padStart` là cái bảo đảm luôn đủ 6 ký tự

### Docs
- **`docs/PLAN.md`** — Thêm **Phase 12 — Refactor chống over-engineering** (bảng P0–P6 kèm trạng thái, 2 `TODO: decision needed` đang treo) + 2 dòng v4.25.0/v4.25.1 vào bảng version. Bump header v4.22.0 → v4.25.1. Ghi rõ bảng version thiếu v4.23.0/v4.24.x — sai lệch có từ trước, không fix vì ngoài scope
- **`docs/ARCHITECTURE.md`** — Cây `api/` nay liệt kê cả `_lib/driveToken.js` + `_lib/smoke.test.js` (trước chỉ có `verifyAuth.js`)
- **`README.md`** — Cây `api/` bổ sung 2 file `_lib/` mới. Sửa luôn `data/schema_v4.4.0.sql` → `schema_v4.24.0.sql` + `reset_user_data.sql`: file cũ đã bị gộp/xoá từ v4.24.1 nên người mới làm theo README sẽ đi tìm file không tồn tại
- **Header version** — `RULES.md`, `ARCHITECTURE.md`, `DATABASE.md`, `FEATURES.md`, `PROJECT.md` đồng bộ v4.24.1 → **v4.25.1**, Updated 2026-07-28

### Notes
- **Chưa làm** 2 mục còn lại của P1, cố ý bỏ vì rủi ro cao: (a) thay parser multipart tự viết bằng `Response.formData()` — undici từng có vấn đề với filename non-ASCII/file lớn; (b) thay vòng `pump` bằng `Readable.fromWeb().pipe()`. Cả hai vẫn nằm trong `docs/TASKS.md`
- **Không sửa gì thuộc security**: authz folder-boundary của stream, rate limit per-IP, cap 50MB, CORS allowlist, sanitize mimeType — giữ 100%
- `npm run build` 0 lỗi (chỉ build frontend), `npm run lint` 64 warning = baseline, `node api/_lib/smoke.test.js` OK
- ⚠️ **Vẫn cần test tay sau deploy** — build không chạy `api/` bao giờ: upload 1 ảnh, upload 1 audio, seek thanh audio Drive (kiểm 206 Partial Content), gọi `/api/upload` không token phải ra 401

## v4.25.0 — 2026-07-28
### Removed
- **`src/_archived/` (11 file, 2.524 dòng)** — Team + Friends code huỷ từ v3.0.0, 0 import trong toàn repo. Xoá hẳn thay vì giữ làm "tham khảo". Khôi phục được từ git history (thư mục **có** được track, dòng `src/_archived` trong `.gitignore` không untrack file đã commit — ghi chú v4.23.0 "prevents dead code from being committed" là sai). Bỏ luôn dòng đó khỏi `.gitignore`
- **`@uiw/react-md-editor` + `@uiw/react-markdown-preview`** — 0 lần import trong `src/`, editor markdown đang dùng `react-markdown` + Tiptap. `npm install` gỡ **43 package**
- **`logger.debug()`** — không caller
- **`useCollections`: `toggleStar()`, `archiveItem()`, `getInboxCount()`** — không caller (wrapper 1 dòng của `updateItem` + 1 query đếm không ai gọi)
- **`dateUtils`: 8/10 export** — `formatWeekdayDate`, `formatMonthYear`, `formatMonth`, `formatWeekdayNarrow`, `formatDateShort`, `formatWeekdayShort`, `parseDateLocal`, `formatDayMonth` đều không có caller. Giữ `formatDate` + `formatDateTime`

### Fixed
- **`@keyframes fadeIn` xung đột toàn cục** — có 2 định nghĩa khác nhau cùng tên: `global/journey/generic-modal` (chỉ opacity) và `collect/inbox` (opacity + `translateY(-3px)`). Vì `@keyframes` là global và bản load sau thắng, hiệu ứng fadeIn của cả app phụ thuộc vào page nào được lazy-load trước. Nay: `global.css` giữ `fadeIn` (opacity) + thêm `fadeInSlide` (có translateY) dùng chung; xoá 4 bản định nghĩa trùng ở `journey/generic-modal/collect/inbox`; 7 usage trong `inbox.css` + 1 trong `collect.css` đổi sang `fadeInSlide`

### Changed
- **`CollectPage.jsx`** — Xoá `formatDate()` local (trùng `dateUtils.formatDate`, file đã import từ đó rồi); gộp 2 hàm `slugify` khác nhau trong cùng file thành 1 (bản dùng chung nay có `.trim()`, tránh slug bắt đầu bằng dấu `-`); `h1`–`h4` override giống hệt nhau → 1 vòng `Object.fromEntries`
- **`TaskListSection.jsx`** — Xoá 3 alias `filteredToday`/`filteredOverdue`/`filteredFuture` (gán thẳng từ `todayTasks`/`overdueTasks`/`futureTasks`, không filter gì), 14 callsite dùng biến gốc
- **`docs/RULES.md`** — Bỏ 2 luật "Do NOT touch `src/_archived/`" (§3 + §Scope & Restrictions) vì thư mục không còn tồn tại
- **`docs/ARCHITECTURE.md` / `PROJECT.md` / `docs/DATABASE.md` / `docs/FEATURES.md`** — Bỏ/cập nhật các tham chiếu tới `src/_archived/` đang mô tả như trạng thái hiện tại. Ghi rõ code Team/Friends xoá ở v4.25.0, lấy lại được từ git history. Các entry lịch sử trong `docs/PLAN.md`, `docs/TASKS.md` và CHANGELOG cũ giữ nguyên (là log quá khứ, không phải mô tả hiện tại)

### Files Removed
- `src/_archived/` (toàn bộ: `TeamPage.jsx`, `FriendsPage.jsx`, `useTeam.js`, `useTeamCheck.js`, `useTeamRules.js`, `team/*` 4 file, `team.css`, `friends.css`)

### Files Modified
- `.gitignore`, `package.json`, `CHANGELOG.md`
- `src/utils/logger.js`, `src/utils/dateUtils.js`, `src/hooks/useCollections.js`
- `src/pages/CollectPage.jsx`, `src/components/TaskListSection.jsx`
- `src/styles/global.css`, `src/styles/collect.css`, `src/styles/inbox.css`, `src/styles/journey.css`, `src/styles/generic-modal.css`
- `docs/RULES.md`, `docs/ARCHITECTURE.md`, `docs/DATABASE.md`, `docs/FEATURES.md`, `PROJECT.md`

### Notes
- `npm run build` — 0 lỗi. `npm run lint` — 64 warning, **bằng đúng baseline trước khi sửa**, không phát sinh warning mới
- `docs/_archived/` (PDF + 2 file md) **không** bị chạm — khác scope
- Đây là Phase 0 của đợt refactor chống over-engineering. P1–P5 còn lại chờ approve từng phase

## v4.24.1 — 2026-07-27
### Changed (Documentation only — không sửa code app)
- **`docs/DATABASE.md`** — Sửa mâu thuẫn số bảng (26 / 28 / 30 → **31 `CREATE TABLE` = 30 active + `friendships` archived**, đối chiếu trực tiếp `data/schema_v4.24.0.sql`). Bỏ tham chiếu tới `schema_v4.4.0.sql` và các `migration_*.sql` đã bị gộp/xoá. Sửa `collections.type` thành đúng 8 loại của CHECK constraint. Thay query leaderboard cũ (join view `user_xp` không tồn tại) bằng RPC `get_leaderboard()`. Bảng XP: bỏ "Duo streak (v3 planned)", thêm Fitness +10, sửa Quiz thành `score × 5`. Thêm mục **Streak — Source of Truth** ghi rõ `refresh_streak()` không tồn tại + `TODO: decision needed`. Thêm cột deprecated `user_tasks.energy_level/duration_est` (DROPPED v4.9.0) và `collections.tags` (không còn trong schema)
- **`docs/FEATURES.md`** — Dọn active/archived: đánh số lại §1–§28 (trước đó 17/18/19/20/21/22/23 bị trùng, thiếu 13), gom Team Mode / Friends / Habits Page / Mood Log / Link Preview / DailyReview / Energy-Duration tag vào bảng **Archived / Removed** ở cuối file. Sửa Tracker 4 tab → 5 tab, Leaderboard sang RPC, task Energy/Duration → `priority`, đường dẫn `life-journey.css`, bỏ claim `collections.tags` còn tồn tại. Chuyển Data Architecture + Routes xuống cuối file và cập nhật (thêm `/incubator`, `/settings`, catch-all; bỏ Teams/Friends)
- **`docs/ARCHITECTURE.md`** — Rút gọn cây thư mục từ ~150 dòng annotate từng file xuống ~30 dòng (thư mục + số lượng + vai trò). Thay danh sách "Supabase Tables" (có 5 bảng không tồn tại + trỏ tới migration files đã xoá) bằng bảng nhóm theo domain + trỏ về DATABASE.md. Sửa `Routes (12 lazy)` → 13 lazy, sửa Key Design Decision #3 (streak client-side, không có DB trigger)
- **`PROJECT.md`** (mới) — Bản đồ cấp cao 127 dòng: stack, chỉ mục tài liệu, module map (route → page → hook → table), data flow, 9 luật không được phá, cách chạy, và danh sách sai lệch đã biết
- **`package.json`** — version 4.23.0 → 4.24.1 (v4.24.0 là patch RLS/email chỉ sửa schema SQL, không bump package)
- **`docs/RULES.md`** — Sửa 3 tham chiếu `data/schema_v4.4.0.sql` → `data/schema_v4.24.0.sql` (§3, §Scope & Restrictions, §15) vì file cũ đã bị gộp và xoá. §localStorage Rules: ghi rõ ngoại lệ legacy thay cho tuyên bố "NEVER user data" (đang bị `vl_life_journey_events` phản chứng). Đánh số `README Requirement` thành §11 để bịt khoảng trống §10 → §12 (không đánh số lại §12–§16 để không phá các tham chiếu "Rule 14" ở file khác)
- **Ngoại lệ legacy localStorage** — `docs/ARCHITECTURE.md` + `docs/RULES.md` + `PROJECT.md`: `vl_life_journey_events` và `vl_journey_title` là user data thật, chưa migrate sang Supabase. Trước đây 3 file đều tuyên bố localStorage "không chứa user data" trong khi vẫn liệt kê 2 key này. Quyết định: giữ nguyên, ghi rõ là ngoại lệ legacy, kèm hệ quả (không sync đa thiết bị) và cảnh báo không lấy làm tiền lệ
- **`docs/FEATURES.md`** — Bỏ tham chiếu `KnowledgeResurface` trong Incubator Review Banner (component đã xoá ở v4.22.0)
- **Header version** — `RULES.md`, `ARCHITECTURE.md`, `DATABASE.md`, `FEATURES.md`, `PROJECT.md` đồng bộ về v4.24.1. Tên file `data/schema_v4.24.0.sql` giữ nguyên (cố ý — không đổi tên file schema theo patch tài liệu)

## v4.23.0 — 2026-06-14
### Added
- **`api/stream.js`** — Vercel serverless proxy that streams Google Drive files through our server, bypassing CORS. Supports `Range` headers for seeking. Caches Service Account token across hot invocations. Enables custom HTML5 `<audio>` player for Drive audio (previously always fell back to ugly Drive iframe)
- **`getDriveStreamUrl()`** in `mediaUtils.js` — Returns proxy URL (`/api/stream?id=xxx`) for Drive files

### Removed
- **"Dạng Drive" toggle** from MediaPreview — unused option, all Drive content now defaults to audio player format
- **"📁 Auto" format pill** from CollectPage editor — redundant with audio-first default
- **AlertCircle import** from CustomAudioPlayer — no longer used after fallback UI cleanup
- **Verbose iframe fallback warning** ("Đang sử dụng trình phát dự phòng bảo mật của Drive") — replaced with cleaner compact layout

### Changed
- **MediaPreview.jsx** — Drive audio now uses proxy stream URL (`/api/stream?id=xxx`) as primary source, with iframe fallback if proxy fails. Removes CORS dependency
- **GlobalAudioPlayer.jsx** — Switched from direct Drive URL to proxy stream URL for podcast playback
- **CustomAudioPlayer.jsx** — Iframe fallback uses cleaner card layout (`.kb-custom-audio-player.card`) instead of warning header + dark box
- **MediaNode.jsx** — Tiptap `renderHTML()` Drive case synced: default height 80px (audio), only `#video` gets 360px
- **CollectPage.jsx** — Editor format pills reduced from 3 (Auto/Audio/Video) to 2 (Audio/Video)

## v4.22.0 — 2026-06-13
### Removed (Dead Code Cleanup)
- **`useFileUpload.js`** — Hook never imported anywhere in the codebase
- **`KnowledgeResurface.jsx`** — Component never imported by any page or component
- **`App.css`** — Vite scaffolding leftover, zero imports
- **`src/assets/react.svg`** + **`src/assets/vite.svg`** — Default Vite template files, unused
- **`src/constants/`** — Empty directory
- **SubAlert duplicate** from TrackerPage — already rendered globally in Navbar

### Added
- **`GenericModal.jsx`** — Shared modal component (backdrop + container + Body/Footer slots). Replaces cross-module `incubator-modal*` CSS coupling between FinancePage and IncubatorPage
- **`src/styles/generic-modal.css`** — Shared modal styles (previously hardcoded in incubator.css)
- **`src/utils/dateUtils.js`** — Centralized Vietnamese date formatting helpers (`formatDate`, `formatDateTime`, `formatWeekdayDate`, `formatMonthYear`, `formatMonth`, `formatWeekdayNarrow`). Replaces 20+ scattered `toLocaleDateString('vi-VN')` calls
- **`src/_archived`** added to `.gitignore` — Prevents dead archived code from being committed

### Changed
- **FinancePage.jsx** — Removed inline `CustomSelect` re-implementation (40 lines), now imports from `src/components/CustomSelect.jsx`. Migrated Edit Expense modal from `incubator-modal*` classes to `GenericModal`
- **LifeJourneyPage.css** — Moved from `src/pages/` to `src/styles/life-journey.css` to follow project CSS convention

### Fixed (Documentation)
- **ARCHITECTURE.md** — Updated React Router v6 → v7, fixed lazy page count 8 → 13, removed stale `useMoodLog` from DashboardPage data sources, removed dead `KnowledgeResurface` reference, added new files
- **ARCHITECTURE.md** — Removed co-located CSS note for LifeJourneyPage

### Files Added
- `src/components/GenericModal.jsx`
- `src/styles/generic-modal.css`
- `src/utils/dateUtils.js`

### Files Deleted
- `src/hooks/useFileUpload.js`
- `src/components/KnowledgeResurface.jsx`
- `src/App.css`
- `src/assets/react.svg`
- `src/assets/vite.svg`
- `src/constants/` (empty dir)

### Files Modified
- `src/pages/FinancePage.jsx`
- `src/pages/TrackerPage.jsx`
- `src/pages/LifeJourneyPage.jsx`
- `docs/ARCHITECTURE.md`
- `.gitignore`


## v4.21.0 — 2026-05-24
### Changed
- **Optional Journey & Onboarding Redirect Polish:**
  - Loại bỏ hoàn toàn cơ chế tự động chuyển hướng người dùng mới hoặc người dùng không có lộ trình đang hoạt động (active journey) sang trang `/journey`.
  - Loại bỏ logic kiểm tra lộ trình, cờ `vl_journey_redirected` và state `redirectToJourney` trong `AppShell` (`src/App.jsx`).
  - Dọn dẹp các biến và import không sử dụng (`useAuth`, `useActiveJourney`) trong `App.jsx`.
  - Cho phép người dùng tự do truy cập trang Today Tracker (`/tracker`), Inbox, Finance, Collect mà không bị chặn điều hướng.
  - TrackerPage vẫn giữ nguyên banner kêu gọi "Chọn lộ trình" ở dạng không ngăn cản (non-blocking) để người dùng có thể thao tác với thói quen tự do (custom habits) và nhiệm vụ.

## v4.20.1 — 2026-05-24
### Added
- **Smart Money Input Parsing & Configurable Currency Settings:**
  - Triển khai tệp tiện ích `src/utils/currencyUtils.js` để xử lý việc lưu trữ cấu hình tỷ giá USD và Toggle Auto-K trong `localStorage`.
  - Bổ sung cấu phần cấu hình "Cấu Hình Tiền Tệ & Chi Tiêu" trong tab Chung của trang Cài đặt để quản lý tỷ giá quy đổi USD ➔ VND và bật/tắt Auto-K (tự thêm 3 số 0).
  - Chuyển đổi các ô nhập số tiền (chi tiêu, đăng ký, ấp trứng) từ `type="number"` sang `type="text"` để hỗ trợ nhập tự do (ví dụ: `50`, `50k`, `89$`, `1.5m`).
  - Thêm dòng chữ Xem trước (Live Preview) mượt mà có phân tách hàng nghìn theo chuẩn VND (`50.000₫`, `2.260.600₫`) phía dưới các ô nhập tiền.
  - Tự động quy đổi ngoại tệ USD sang VND theo tỷ giá tùy chỉnh của người dùng, đồng thời tự động nối thêm ngữ cảnh gốc (ví dụ: `"(Quy đổi từ 89$)"`) vào ghi chú chi tiêu/tên đăng ký để lưu trữ vết.
  - Loại bỏ các khai báo hàm trùng lặp `formatVND` trong `InboxPage.jsx`, `FinancePage.jsx` và `IncubatorPage.jsx`.

## v4.20.0 — 2026-05-24
### Added
- **Inbox Quick Done Feature:**
  - Bổ sung nút "✓ Xong" bên cạnh "⚡ Task" cho từng inbox item tại danh sách chính và trong Reader view của chi tiết inbox item.
  - Tự động chuyển đổi inbox item thành một Task chính thức với trạng thái đã hoàn thành (completed) trong ngày hôm nay ngay lập tức.
  - Tự động lưu vết hoạt động `task_done` vào `activity_logs` để đồng bộ với Life Log heatmap và lịch sử cá nhân.
  - Tự động xóa/dọn dẹp nguồn inbox item ban đầu sau khi chuyển đổi thành công.
  - Hỗ trợ đầy đủ CSS Light/Dark mode thích ứng cho nút "✓ Xong" với gam màu xanh lục (green) dịu nhẹ.

## v4.19.9 — 2026-05-24
### Fixed
- **Light Mode Task Form Inputs & Buttons Visibility:**
  - Thiết lập các lớp CSS Light Mode cho lớp `.auth-input` trong `auth.css` để bảo đảm các viền (border) và nền (background) của ô nhập tên nhiệm vụ, mô tả, và ô nhập chuỗi ngày lặp lại hiển thị rõ ràng trên nền sáng.
  - Tách biệt và chuẩn hóa các lớp CSS trong `tracker.css` bao gồm `.task-item`, `.task-option-btn` (nút độ ưu tiên, lặp lại, và các nút chọn tần suất lặp lại), `.task-form-rec-panel`, `.task-desc-box`, và `.task-checkbox-btn`.
  - Thay thế toàn bộ mã màu nền/viền tối hardcode (inline style) trong `TaskListSection.jsx` bằng các lớp CSS có hỗ trợ Light Mode overrides tương ứng, giúp toàn bộ form và các nút bấm hiển thị trực quan sắc nét.

## v4.19.8 — 2026-05-24
### Fixed
- **CustomSelect & Title Input Alignment:**
  - Cập nhật hiển thị wrapper div của CustomSelect từ `display: inline-block` sang `display: inline-flex` và bổ sung `vertical-align: middle` nhằm loại bỏ khoảng trống biên (descender spacing) mặc định của trình duyệt.
  - Đồng bộ hóa kích thước bằng cách thiết lập chiều cao cố định `height: 38px !important` cho `.kb-custom-select.kb-type-select`, đảm bảo bộ chọn loại (Type Select) và ô nhập tiêu đề (.kb-editor__title) căn chỉnh hàng ngang chuẩn xác pixel-perfect.

## v4.19.7 — 2026-05-24
### Added
- **Unified Custom Dropdowns:**
  - Thay thế toàn bộ dropdown thẻ `<select>` mặc định của hệ điều hành bằng component `CustomSelect` kính mờ (glassmorphic) tuyệt đẹp tại Inbox page, Collect editor và Incubator execute modal.
  - Đồng bộ màu sắc, đường viền và tương phản chữ cho dropdown list trong cả 2 chế độ Sáng/Tối.
- **Task Overdue UX & Warning Badge:**
  - Bổ sung badge màu vàng vui nhộn `⏳ Nhanh lên sắp hết ngày rồi` cho các nhiệm vụ ngày hôm nay chưa hoàn thành để nhắc nhở và tạo động lực cho người dùng.

### Changed
- **Default Due Time:**
  - Mặc định giờ cho các nhiệm vụ mới tạo là `23:59` thay vì tự lấy giờ hiện tại (tránh việc nhiệm vụ lập tức biến thành quá hạn sau khi tạo).
  - Ẩn nhãn giờ `23:59` và `00:00` trên giao diện danh sách để hiển thị ngày gọn gàng.

### Fixed
- **isOverdue Logic:**
  - Cập nhật logic `isOverdue` trong `TaskListSection.jsx` bỏ qua giờ `23:59` và `00:00` của ngày hiện tại để tránh cảnh báo quá hạn sai lệch cho các nhiệm vụ cả ngày.
- **Style Refinements:**
  - Khắc phục lỗi hiển thị 2 viền (double borders) của custom select bằng cách loại bỏ viền/nền của thẻ div bọc ngoài `.kb-custom-select`.
  - Tăng độ tương phản (contrast) của viền các icon định dạng văn bản `.tp-btn`, dropdown `.tp-toolbar-dropdown` và bộ chọn màu `.tp-color-picker` trong chế độ Sáng (Light Mode) từ 0.18 lên 0.28.
  - Bổ sung viền rõ nét, padding và chiều cao cố định `38px` cho ô nhập tiêu đề bài viết `.kb-editor__title` ở cả hai chế độ Sáng/Tối. Đồng bộ hóa kích thước và căn chỉnh dòng (vertical alignment) hoàn hảo pixel-perfect với nút bấm custom select bên cạnh.

## v4.19.6 — 2026-05-24
### Fixed
- **Light Theme Usability & Borders:**
  - Khắc phục các đường viền (border outlines) và giao diện các nút điều hướng, ô tìm kiếm, bộ lọc trong chế độ Sáng (Light Theme) bị quá mờ hoặc biến mất hoàn toàn.
  - Đồng bộ và bổ sung viền rõ nét cho các nút chức năng ở Sidebar/Topbar (`.sidebar__theme-toggle`, `.topbar__theme-toggle`, `.nav-avatar`) và chỉnh nền trắng/indigo nhạt để nổi bật rõ ràng.
  - Sửa lỗi mờ và thiếu viền cho ô tìm kiếm (`.kb-search`), dropdown lọc (`.kb-sort`), bộ chọn loại (`.kb-type-select`), trường nhập nguồn URL (`.kb-editor__url`), input tạo nhóm (`.kb-create-group__input`), bộ chọn tag (`.kb-tag-input`), và bộ chọn nhóm (`.kb-group-picker`).
  - Refactor nút lọc task (`📌`) từ việc dùng inline styles sang class `.kb-task-filter-btn` để hỗ trợ hiển thị đường viền rõ nét và đổi màu linh hoạt khi được kích hoạt hoặc khi đổi sang chế độ Sáng (Light Mode).
  - Định nghĩa lại màu chữ tags trong Light Mode sang màu tím indigo rõ nét (`#4f46e5`) trên nền tag nhạt để tăng contrast và cải thiện khả năng đọc.
  - Sửa lỗi chữ màu trắng siêu mờ của nhãn định dạng (`🎨 Visual` và `✍️ MD`) trong Light Mode bằng các màu chữ tím đậm (`#6d28d9`) và xanh mòng két (`#0e7490`) có tương phản cao.
  - Khắc phục thanh tiến trình kinh nghiệm (`XpBar`) bị tàng hình trong Light Mode bằng cách hiển thị rõ rãnh tiến trình màu indigo (`rgba(99,102,241,0.16)`) và thanh điền tiến trình gradient rõ nét.
- **Layout & Alignment Updates:**
  - Tái cấu trúc khu vực chân trang của Sidebar: nhóm nút chuyển Theme và Avatar người dùng vào chung một hàng ngang `.sidebar__actions` thay vì xếp dọc lệch nhau. Sử dụng `justify-content: space-between` đẩy Avatar sang góc trái (dưới icon Ngọn lửa) và nút chuyển Theme sang sát lề phải bên ngoài để giao diện cân đối, gọn gàng.
- **Interactive Sorting Dropdown:**
  - Thay thế dropdown lựa chọn cách sắp xếp bài viết (`kb-sort`) từ thẻ `<select>` mặc định của trình duyệt (vốn bị đen/trắng lệch lạc tùy hệ điều hành) thành một menu popover tùy chỉnh (`.kb-sort-dropdown`) dạng kính mờ (glassmorphic) tuyệt đẹp và căn chỉnh thẳng hàng hoàn hảo.
  - Bổ sung thêm tùy chọn sắp xếp bài viết theo thứ tự ngược bảng chữ cái **Z → A** (`rev-alpha`) đáp ứng yêu cầu của người dùng.



## v4.19.5 — 2026-05-24
### Fixed
- **Task Filter Popover UX & Theme Sync:**
  - Khắc phục lỗi hiển thị của bộ lọc Task (`📌 Lọc theo Task`) bị đen sì, chữ tối màu không thể nhìn thấy gì khi chuyển sang chế độ Sáng (Light Mode).
  - Loại bỏ hoàn toàn các mã màu inline hardcode tối màu của popover. Thay thế bằng các class CSS động trong `collect.css` (`.kb-task-filter-popover`, `.kb-task-filter-item`, v.v.) tự động đồng bộ theo biến môi trường sáng/tối của hệ thống (`var(--bg-secondary)`, `var(--text-primary)`).
  - Tối ưu màu sắc của ô tìm kiếm, danh sách tác vụ và checkbox trạng thái trong popover hiển thị sắc nét trên cả 2 theme.

## v4.19.4 — 2026-05-24
### Fixed
- **ArticleCard List Styling & Borders in Light Theme:**
  - Khắc phục lỗi các đường viền bài viết không rõ ràng (quá mờ hoặc mất nét trên/dưới) trong chế độ Sáng (Light Theme).
  - Định nghĩa lại đường viền `.kb-card` sắc nét hơn (`1px solid rgba(99,102,241,0.16)`) và thiết lập nền trắng `#ffffff` thay vì trong suốt để các thẻ nổi bật rõ ràng trên nền trang.
  - Sửa lỗi vỡ border-radius khi render thẻ: chuyển từ CSS selector trực tiếp `.kb-card:first-child` sang selector thông qua div bọc (`.kb-list > div:first-child .kb-card`) do cấu trúc React component chứa wrapper.
  - Di chuyển thanh tác vụ hàng loạt (`inbox-bulk-bar`) ra ngoài thẻ container `.kb-list` để tránh ảnh hưởng đến các selector chọn phần tử đầu/cuối của danh sách bài viết.

## v4.19.3 — 2026-05-24
### Added
- **Format Badges on Article Card and ReaderView:**
  - Bổ sung nhãn định dạng trực quan (`🎨 Visual` hoặc `✍️ MD`/`✍️ Markdown`) hiển thị ngay tại dòng metadata của mỗi thẻ bài viết (`ArticleCard`) ở danh sách ngoài trang Knowledge Base.
  - Đồng bộ thiết kế nhãn định dạng trong `ReaderView` bằng cách sử dụng các CSS class dùng chung mới.
  - Định nghĩa các class màu sắc kính mờ riêng biệt trong `collect.css`: tím nhạt (`rgba(139,92,246,0.12)`) cho Visual Editor và xanh cyan (`rgba(6,182,212,0.12)`) cho Markdown Editor để dễ nhận diện tức thì.

## v4.19.2 — 2026-05-24
### Fixed
- **Markdown Editor Preview Reload:**
  - Khắc phục triệt để lỗi reload lại video/audio player hoặc iframe Google Drive ở khung Preview khi người dùng gõ chữ trong Markdown editor.
  - Chuyển `remarkPlugins={[remarkGfm]}` thành biến hằng số tĩnh `REMARK_PLUGINS` định nghĩa ngoài component để tránh việc ReactMarkdown hủy và khởi dựng lại (remount) toàn bộ cây DOM của preview trên mỗi keystroke.
  - Sử dụng `React.memo` với hàm so sánh tùy biến (custom comparison) cho các component `MediaPreview` và `CustomAudioPlayer` nhằm bỏ qua các thay đổi không liên quan đến tệp nguồn (chỉ re-render khi URL hoặc nội dung tệp thay đổi).
  - Tích hợp phát YouTube qua `MediaPreview` trong Markdown component `a` để thừa hưởng cơ chế memoization này.

## v4.19.0 — 2026-05-24
### Added
- **Custom Glassmorphic Audio Player:**
  - Thiết kế trình phát âm thanh HTML5 tùy chỉnh dạng kính mờ (glassmorphism) tuyệt đẹp thay thế cho player mặc định của trình duyệt hoặc iframe đen của Drive.
  - Tích hợp cơ chế tự động chuyển đổi thông minh (error fallback): tự động hiển thị iframe Drive nếu stream trực tiếp thất bại (do phân quyền/cookies).
- **Markdown Mode Format Toggles:**
  - Hỗ trợ đầy đủ các nút chuyển đổi định dạng (`🎵 Dạng audio`, `📺 Dạng video`, `📁 Dạng Drive`) ngay trên player ở khung Preview của Markdown Editor.
  - Khi click chuyển đổi, hệ thống sẽ tự động tìm kiếm và thay đổi link tương ứng trực tiếp trong textarea viết Markdown ở bên trái (thêm `#audio` / `#video` hoặc xóa tag).
  - Tự động gắn tag `#audio` khi người dùng chèn audio qua nút công cụ 🎵 trên toolbar của Markdown editor.

## v4.18.1 — 2026-05-24
### Fixed
- **Source Link Truncation:** Giới hạn chiều dài của link nguồn (`.kb-reader__source`) hiển thị tối đa 3 dòng bằng cơ chế CSS line-clamp và tự động bẻ chữ (`word-break: break-all`) để tránh tình trạng URL siêu dài (như log terminal) che hết giao diện bài viết.
- **TrackerSection React Keys:** Sửa lỗi thiếu prop `key` trên thẻ Fragment ở vòng lặp render tiến độ tuần trong `TrackerSection.jsx` nhằm loại bỏ cảnh báo lỗi trong console của browser.

## v4.18.0 — 2026-05-24
### Added
- **Advanced Media Classification System:**
  - Tích hợp `getMediaType`, `stripMediaTag`, `isYoutubeUrl`, và `getYoutubeEmbedUrl` vào `mediaUtils.js` để tự động nhận dạng định dạng các link YouTube, YouTube Shorts, Google Drive, direct audio, và direct video.
  - Hỗ trợ parser YouTube Shorts tự động chuyển đổi định dạng link `youtube.com/shorts/...` sang link nhúng `youtube.com/embed/...`.
- **Unified MediaPreview Player:**
  - Giao diện phát đa phương tiện thống nhất với switch-case phân loại các dạng file.
  - Tự động điều chỉnh chiều cao linh hoạt cho Google Drive (90px cho audio, 360px cho video/preview chung).
  - Bổ sung nút bấm chuyển đổi định dạng trực quan (`🎵 Dạng audio`, `📺 Dạng video`, `📁 Dạng Drive`) giúp người dùng thay đổi trực tiếp trên player và đồng bộ tức thì vào database.
- **Tiptap MediaNode Extension:**
  - Tạo mới `MediaNode.js` thay thế cho `AudioNode.js` lỗi thời. Sử dụng `ReactNodeViewRenderer` để nhúng trực tiếp `<MediaPreview>` với các nút chuyển đổi vào visual editor.
  - Hỗ trợ cơ chế tương thích ngược (Backward Compatibility) tự động migrate cấu trúc JSON bài viết từ `audioBlock` sang `mediaBlock` hoàn toàn trên client mà không cần chạy SQL migration.
- **Format Selector Pills in Editor:** Bổ sung bộ chọn dạng pill ở ô nhập link nguồn của editor giúp người dùng gắn tag định dạng thủ công (`#audio` hoặc `#video`) một cách thuận tiện.

## v4.17.0 — 2026-05-24
### Added
- **MediaPreview Component:** Phát triển component React dùng chung `src/components/MediaPreview.jsx` để tập trung hóa toàn bộ logic hiển thị trình phát đa phương tiện. Hỗ trợ tự động phân loại tệp (Audio/Video) và nhà cung cấp (Google Drive vs Direct Link).
- **Compact Audio Player Design:**
  - Nhúng Google Drive Audio thông qua `<iframe>` với chiều cao thu nhỏ (`height="90px"`) để hiển thị giao diện thanh điều khiển phát nhạc tinh gọn của Google mà không bị khoảng đen thừa của khung phát video.
  - Sử dụng thẻ `<audio>` nguyên bản của HTML5 thay thế cho thẻ `<video>` cho các tệp âm thanh trực tiếp (đường dẫn ngoài Google Drive) để hiển thị thanh phát nhạc trực quan và tiết kiệm diện tích.
  - Bổ sung viền thủy tinh (glassmorphic border) và bóng mờ nhẹ (`box-shadow`) cho khung iframe để đồng bộ với ngôn ngữ thiết kế chung của hệ thống.
- **Visual Editor Sync:** Cập nhật Tiptap `AudioNode` sử dụng khung hiển thị `iframe` 90px tương tự đối với tệp Drive âm thanh và thẻ `<audio>` đối với các tệp âm thanh trực tiếp khác.
- **Manual Audio Override:** Cập nhật `isAudioUrl` hỗ trợ tự động phát hiện tham số `type=audio` hoặc mã neo (hashtag) như `#audio` hoặc `#podcast` ở cuối URL nguồn. Giúp người dùng có thể tự cấu hình ép buộc hiển thị thanh phát nhạc thu nhỏ (chiều cao 90px) khi dán các liên kết Google Drive bằng cách thêm ký tự `#audio` vào cuối đường dẫn.

## v4.16.3 — 2026-05-24
### Fixed
- **Google Drive Preview:** Bổ sung helper `extractDriveFileId` và cập nhật `extractDriveDirectUrl` để chuyển đổi link Google Drive sang định dạng `/uc?id=FILE_ID` chuẩn xác hơn thay vì hardcode `authuser=0` và `export=download`. Điều này khắc phục lỗi 403 Forbidden đối với người dùng đăng nhập nhiều tài khoản Google đồng thời và loại bỏ các header bắt buộc tải file (download attachment).
- **Google Drive iframe Embedding:** Cập nhật hiển thị link Google Drive trong `CollectPage` (Markdown + Reader View) và Tiptap `AudioNode` (Visual Editor) sang thẻ `<iframe>` trỏ tới `/preview`. Điều này giải quyết triệt để các rào cản về CORS và chặn cookie bên thứ ba (third-party cookies) trong Chrome.

## v4.16.2 — 2026-05-24
### Changed
- **Documentation:** Bổ sung quy chuẩn đặt tên file upload (`LifeHub_{folder}_{yyyyMMdd}_{HHMMSS}_{hex6}.{ext}`) vào tài liệu `FEATURES.md` để đồng bộ chuẩn mực thiết kế.

## v4.16.1 — 2026-05-24
### Changed
- **Unified Upload Architecture:** Cập nhật `api/upload.js` để định tuyến 100% tất cả các loại file (ảnh, audio, video, pdf) lên Google Drive thông qua Service Account, thay vì cơ chế Hybrid (Imgur + Drive) trước đó.
- **Direct Drive URLs:** Định dạng lại Google Drive link trả về từ `open?id=...` thành `uc?export=view&id=...` giúp trình duyệt có thể render trực tiếp hình ảnh thông qua thẻ `<img>` mà không bị lỗi hiển thị.
- Cập nhật `.env.local.example` và tài liệu hệ thống loại bỏ các dependency về Imgur và R2, hoàn toàn quy chuẩn về một backend lưu trữ duy nhất.

## v4.16.0 — 2026-05-23
### Added
- **Hybrid Storage Architecture:** Updated `/api/upload.js` to route image uploads to Imgur and audio/video/document uploads to Google Drive via a Service Account.
- **Global Mini Player:** Implemented `GlobalAudioPlayer.jsx` to float at the bottom of the screen. Randomly auto-plays podcasts using the new `useRandomPodcast.js` hook.
- **Universal Google Drive Parser:** Added helpers `extractDriveDirectUrl` to parse any Google Drive sharing links into direct stream URLs.
- **Tiptap Audio/Video Node:** Extended `AudioNode` with PasteRules to automatically intercept Google Drive links and standard audio links, rendering an inline media player.
- **Reader View Media Player:** `CollectPage` now renders a native audio/video player if the item type is `podcast` or its source URL is a media/Drive link.

## v4.15.0 — 2026-05-23
### Changed
- **Knowledge Base Categories (JSON Refactor):** Consolidated `TYPES` array from `InboxPage` and `CollectPage` into a central static JSON file `src/data/knowledge.json`.
- **Inbox UI Refactor:** Replaced inline classification buttons with `<select>` dropdowns in `InboxPage` (Detail View, Inline Menu, Bulk Actions) to save space and match the unified types.
- **Collect UI Refactor:** `CollectPage` now dynamically builds `TYPE_META` from `knowledge.json`.
- **SubNotes UX Improvement:** Redesigned the "Thêm ghi chú" (Add sub-note) section in the Knowledge Reader View to behave like Confluence (inline expandable comment box instead of a toggle button).
- **Knowledge Categories Config:** Removed `link` type and replaced `emotion` type with `podcast` type in `knowledge.json` as part of the Audio prep.
### Fixed
- **ReaderView Light Mode Contrast:** Fixed invisible dividers and borders in Light Theme for the ReaderView and SubNotes section.

## v4.14.0 — 2026-05-18
### Added
- **KB Category: Giải trí (Entertainment):** New `entertainment` type with 🎮 Gamepad2 icon (red). Use for anime, music, movies, games.
- **KB Category: Cảm xúc (Emotion):** New `emotion` type with ❤️ Heart icon (pink). Use for healing, reflections, diary, emotional content.

### Changed
- **Removed `link` type:** Links merged into `note`. URL field preserved — no data loss.
- **Merged `knowledge` + `experience` + `learn`:** All consolidated into single `learn` type ("Học"). Covers learning material, knowledge articles, lessons, and experiences.
- **SQL Migration:** `migration_v4.14.0_collection_types.sql` — migrates `link→note`, `experience→learn`, `knowledge→learn`, restructures CHECK constraint (8 types).

### Fixed
- **DB ↔ UI type desync:** The DB CHECK constraint only allowed 6 types but the UI had 8+. Now all 9 types are aligned.

---

## v4.13.1 — 2026-05-18
### Changed
- `docs/PLAN.md` — Version header synced `v4.5.4` → `v4.13.0`, added v4.9.0–v4.13.0 to Semantic Version Map.
- `docs/ARCHITECTURE.md` — Version header synced `v4.11.0` → `v4.13.0`. Removed 3 ghost entries (`DailyTimeline.jsx`, `DailyReview.jsx`, `useLinkMeta.js` — deleted v4.7.0/v4.7.1). Added 5 missing CSS files + `DatePickerPopover.jsx`. Fixed `useMoodSkip.js` + `habits.json` descriptions (mood removed v4.10.1).
- `docs/FEATURES.md` — Cleaned stale `DailyTimeline` ref in Life Log section, cleaned `DailyReview` ref in Sidebar Widgets section (deleted v4.7.1).
- `docs/TASKS.md` — Fixed v4.12.0 status `IN PROGRESS` → `✅ DONE`.

---

## v4.13.0 — 2026-05-17
### Added
- **Postcard Gallery:** Quote-type KB items now render as gradient-backed postcard cards (2-column grid) instead of standard article list. 8-color gradient palette, serif italic typography, line-clamp truncation with fade.
- **PostcardCard component:** Large quote text display, author attribution from title, audio badge detection, responsive (1-col on mobile).
- **QuoteWidget KB integration:** `QuoteWidget` now accepts optional `kbQuotes` prop — KB quote items appear in random rotation alongside system quotes on the Knowledge Base page.

### Changed
- `src/pages/CollectPage.jsx` — Added PostcardCard component, PostcardGrid rendering when `typeFilter === 'quote'`, empty state with 💬 icon, kbQuotes passed to QuoteWidget.
- `src/components/QuoteWidget.jsx` — Accepts `kbQuotes` prop, merges KB quote items into shuffle pool (backward-compatible).
- `src/styles/collect.css` — Postcard gallery CSS (gradients, typography, hover lift, truncation fade, light mode overrides, responsive grid).

---

## v4.12.0 — 2026-05-10
### Added
- **Media in KB Articles (Phase 1):** Image + YouTube support for both Tiptap Visual and Markdown editors.
  - Tiptap: `@tiptap/extension-image` + `@tiptap/extension-youtube` with toolbar buttons (🖼️ + 🎥)
  - Slash commands: `/image` and `/youtube` for quick insertion
  - Markdown: auto-detect YouTube URLs → embed iframe, audio URLs → native player, responsive images
  - CSS: 16:9 responsive video embeds, styled audio players, responsive images
- **Media Utils:** `src/utils/mediaUtils.js` — shared YouTube ID extraction + audio URL detection
- **Upload API (Phase 2):** `api/upload.js` — Vercel serverless proxy to Cloudflare R2 (AWS Sig V4, zero external deps). `useFileUpload.js` hook.
- **UrlInputPopover (Phase 3):** Shared ClickUp-style popover component — replaces `window.prompt()` for Image/YouTube URL input. Labeled input, Hủy/Chèn buttons, Escape/click-outside close, glassmorphism dark/light.
- **QuoteWidget (Phase 4):** Dynamic inspirational quote widget with daily-seeded selection (different quote per page), 🔀 shuffle with crossfade animation, optional audio playback. Mounted on Today, Inbox, Knowledge pages.
- **AudioNode (Phase 5):** Custom Tiptap extension for inline audio players. Toolbar 🎵 + `/audio` slash command + styled player block.
- **User Quotes (Phase 6):** `inspirational_quotes` Supabase table + `useQuotes.js` hook with CRUD and graceful fallback.
- **Imgur Auto-Upload (Phase 7):** `api/upload.js` refactored — dual provider (Imgur auto for images, R2 for audio). Paste/drop images in Tiptap → auto upload + insert.
- **Quote Manager UI (Phase 7):** New Settings tab "Quotes" — add/edit/delete/toggle personal quotes, view system quotes. `SettingsPage.jsx` + CSS.

### Changed
- `src/components/SlashCommand.jsx` — 3 new slash items (Image, YouTube, Audio), no `window.prompt()`
- `src/components/TiptapEditor.jsx` — AudioNode extension + 🎵 toolbar + paste/drop image auto-upload + UrlInputPopover
- `src/pages/TrackerPage.jsx` — Replaced inline hardcoded quote with `<QuoteWidget>`
- `src/pages/InboxPage.jsx` — Added QuoteWidget between quick-add and items list
- `src/pages/CollectPage.jsx` — QuoteWidget + UrlInputPopover (Markdown toolbar: **all `window.prompt` removed**)
- `src/pages/SettingsPage.jsx` — New "Quotes" sidebar tab + QuoteManagerSection component

---

## v4.11.0 — 2026-05-10
### Added
- **Knowledge Groups (M:N):** New organizational layer for Knowledge Base. Users can create named groups (with emoji) and assign articles to multiple groups simultaneously (Many-to-Many). Includes full drill-down view with contextual search, breadcrumb navigation, and group management.
- **Sub-Notes (Threaded Notes):** Personal annotations attached to KB articles. Thread-style notes for book reading highlights, follow-up thoughts, and review notes. Inline editing with Ctrl+Enter to save.
- **Group Picker (Editor):** Searchable group selector with inline creation — type a new name and create group instantly without leaving the editor.
- **Group Badge (Article Cards):** Articles show group badges in list view. Click a badge to navigate directly to that group's drill-down view.
- **Delete UX:** Deleting a group only removes the link (articles preserved). Separate "Delete All" option with strong confirmation for destructive delete.

### Database
- `knowledge_groups` table — user-created folders (title, emoji, description)
- `collection_groups` junction table — M:N link between collections and groups (CASCADE delete)
- `collection_notes` table — threaded sub-notes per article
- Migration: `data/migration_v4.11.0_knowledge_groups.sql`

### Files Added
- `src/hooks/useKnowledgeGroups.js` — CRUD groups, link/unlink articles
- `src/hooks/useCollectionNotes.js` — CRUD sub-notes

### Files Modified
- `src/hooks/useCollections.js` — Added collection_groups join to fetchItems
- `src/pages/CollectPage.jsx` — 📁 Nhóm tab, GroupPicker, SubNotesSection, group badges
- `src/styles/collect.css` — Group cards, breadcrumb, picker, sub-notes styles

---

## v4.10.1 — 2026-05-10
### Changed
- **DatePicker — Always-visible time input:** Time input now always shown (removed "Thêm giờ" toggle). Defaults to current local time (`HH:MM`) when opening picker. "Bây giờ" quick-set button added.
- **DatePicker — Start-time semantics:** Header label changed from "📅 Khi nào" → "📅 Bắt đầu lúc" to clarify the date/time represents when user should START the task, not a deadline.
- **Task default time:** If user doesn't explicitly set a time, defaults to `00:00` (midnight = "start of day / unspecified"). Previously stored as `null`.
- **Task card time badge:** `⏰` badge only shows for tasks with explicitly set time (not `00:00`).
- **Notification logic:** Service Worker skips `00:00` tasks for notifications — only tasks with user-set times trigger reminders.

### Fixed
- **Recurring task spawn bug:** `spawnRecurringTask` was referencing deleted columns `energy_level`/`duration_est` (dropped in v4.9.0). Fixed to use `priority` instead — spawned tasks now inherit the original's priority level.

### Added
- `dp-time__now-btn` CSS class for the "Bây giờ" quick-set button in DatePicker.
- `hideTime` prop on `DatePickerPopover` for contexts where time input should be hidden.
- `nowHHMM()` helper function in DatePicker and TaskListSection.
- **DatePicker mobile responsive:** Bottom-sheet layout on ≤520px, shortcuts hidden (calendar only), safe-area for notch phones.
- **Task card mobile overflow:** Action buttons (📅 ✏️ 🔗 🗑) collapse into `⋯` overflow dropdown on ≤520px. Click-outside auto-close.
- `task-actions--desktop` / `task-actions--mobile` CSS visibility toggle.
- `.task-overflow-menu` / `.task-overflow-item` dropdown styles (dark/light).

### Removed
- **Mood Tracker Feature:** Completely purged the "😊 Tâm Trạng Hôm Nay" feature to simplify the architecture. Removed `useMoodLog`, `MoodTrendChart`, and mood-related UI from `TrackerPage`, `DashboardPage`, `LifeLogPage`, and `JourneyDetailPage`.
- **Database:** Prepared SQL migration to drop `mood_logs` table (`data/migration_v4.10.1_drop_mood.sql`).

### Files Modified
- `src/components/DatePickerPopover.jsx` — always-visible time, smart defaults, label change
- `src/components/TaskListSection.jsx` — default dueTime to now, hide 00:00 badges, mobile overflow menu
- `src/hooks/useUserTasks.js` — default due_time to '00:00', filter SW sync, fix spawn columns
- `src/styles/datepicker.css` — .dp-time__now-btn + mobile bottom-sheet layout
- `src/styles/global.css` — task overflow menu styles (dark/light)
- `src/styles/dashboard.css`, `src/styles/calendar.css` — removed mood-related classes
- `src/data/habits.json` — removed `moods` object
- `docs/FEATURES.md`, `docs/ARCHITECTURE.md`, `docs/DATABASE.md` — purged mood tracker refs
- `data/migration_v4.10.1_drop_mood.sql` — new migration file
- `public/sw.js` — skip 00:00 notifications
- `package.json` — version bump → 4.10.1

## v4.10.0 — 2026-05-09
### Added
- **DatePickerPopover:** ClickUp-style date picker with quick shortcuts (Hôm nay, Ngày mai, Tuần sau, 2/4/8 tuần) + mini calendar grid.
- **Quick date edit:** 📅 button on each task card to change due date instantly via popover.
- New CSS: `src/styles/datepicker.css`

### Changed
- **Task forms:** Replaced native `<input type="date">` + `<input type="time">` with DatePickerPopover trigger button in both Add and Edit forms.
- **Task card actions:** Replaced 🔄 rollover button with 📅 quick date picker.

## v4.9.0 — 2026-05-09
### Changed
- **Task Priority:** Replaced Energy Level (⚡🔋🪫) + Duration Estimate (5p-2h+) with 5-level Priority system (⬇️ Rất thấp → ⚡ Khẩn cấp).
- **Label clarity:** `📅 Ngày` → `📅 Khi nào` to clarify due date meaning.

### Removed
- Energy Level selector (add/edit/view badges)
- Duration Estimate selector (add/edit/view badges)
- Energy Filter chips bar
- DB columns: `energy_level`, `duration_est` (via migration)

### Added
- `priority SMALLINT` column in `user_tasks` (0=None, 1-5)
- Priority selector in Add + Edit forms
- Priority badge on task cards

## v4.8.0 — 2026-05-09
### Changed
- **Incubator UI Redesign:** Replaced single-list + archive toggle with 2-tab layout (🥚 Đang ấp / 🗑 Đã bỏ qua).
- **Card Actions:** Action buttons (Thực thi, Dời, Bỏ) now shown directly on each card instead of hidden in detail view.
- **Abandoned Tab:** Items can be restored (♻️ Khôi phục) or permanently deleted (🗑 Xóa vĩnh viễn).
- **Add Button:** Redesigned with dashed border style for clearer visual hierarchy.

### Added
- `useIntentions.restoreIntention()` — Restores abandoned intentions back to incubating status with activity log.

## v4.7.3 — 2026-05-09
### Fixed
- **Inbox → Task (card view):** `handleToTask` now includes `item.body` in description — previously only passed `item.url`, losing long text content.
- **Incubator → Task (Execute):** Now composes a rich Markdown description with all metadata (💰 cost, ⏱ time, 💡 original reason, 📜 history logs, 📝 description) instead of only `original_reason`.
- **Incubator → Expense date:** Replaced stale `todayStr` closure with `localDateStr()` call to prevent wrong date when app stays open overnight.

## v4.7.2 — 2026-05-09
### Added
- **Incubator Description Field:** `intentions` table now supports a `description` column for long-form content.
- **Incubator Detail UI:** Detail view renders Markdown descriptions. Editor features a split-pane (Write/Preview) layout.
- **Incubator Cards:** Added `📝 Có mô tả` badge indicator.
### Changed
- **Inbox "Ấp Trứng" Action:** Now perfectly maps the item's `body` and `url` to the new `description` field in `intentions`.

## v4.7.1 — 2026-05-09
### Removed
- **`DailyReview` widget** — Removed from Sidebar (`Navbar.jsx`) to reduce UI clutter.
- **`DailyReview.jsx`** — Component completely deleted.

## v4.7.0 — 2026-05-09

### Removed (Dead Code Cleanup)
- **`DailyTimeline.jsx`** — dead component, no import anywhere in codebase
- **`useLinkMeta.js`** — dead hook calling non-existent `/api/meta` endpoint
- **`XP_REWARDS.duo_streak`** — unused constant for unimplemented Team Mode
- **`useLinkMeta` import/usage** in `InboxPage.jsx` — always silently failed
- **Life Journey default events** — replaced hardcoded personal demo data with empty array

### Changed
- **`QuickCapture.jsx`** — rewrote to use `useCollections.addItem()` instead of raw Supabase insert. Now uses `<textarea>` with Shift+Enter for newlines. Added auto-split logic for long text (>25 words → title truncation + body preservation).

### Files Modified
- `src/components/DailyTimeline.jsx` — DELETED
- `src/hooks/useLinkMeta.js` — DELETED
- `src/pages/InboxPage.jsx` — removed useLinkMeta import + destructuring
- `src/hooks/useXpStore.js` — removed duo_streak from XP_REWARDS
- `src/hooks/useLifeJourney.js` — DEFAULT_EVENTS = []
- `src/components/QuickCapture.jsx` — full rewrite (useCollections + textarea)
- `src/styles/quick-capture.css` — textarea support (resize, min-height)
- `docs/FEATURES.md` — removed DailyTimeline reference from Life Log

---



### Added
- **Incubator Detail View:** Click any intention card to open a full detail panel with title, reason, cost/time estimates, meta info, and timeline history. Inline edit mode via "✏️ Sửa" button. Action bar at bottom (Thực thi / Dời lại / Bỏ qua).

### Changed
- **Incubator cards:** Now clickable with hover lift effect. Action buttons moved from card to detail panel for cleaner card UI.
- **Incubator edit flow:** Replaced small edit modal with inline editing in the detail panel.

### Files Modified
- `src/pages/IncubatorPage.jsx` — detail view state, handlers, panel UI
- `src/styles/incubator.css` — detail panel styles, clickable card hover, light mode

---

## v4.6.0 — 2026-05-09

### Added
- **Inbox Detail View:** Click any inbox item to open an inline reader view (reusing Knowledge Base `kb-reader` CSS) with rendered Markdown, metadata, and action buttons (📌 Task, ✏️ Sửa, 🗑 Xóa). Edit mode uses KB-style split-pane (✍️ Write / 👁 Preview).
- **Inbox Description:** Quick-add form now has a 📝 toggle to add an optional description when creating inbox items. Body preview shown on item cards.
- **Settings Profile Section:** New "Hồ sơ" tab in Settings with sidebar navigation. Users can edit display name, email, and bio. Email duplicate check on save.
- **Settings Sidebar:** Extensible sidebar navigation in Settings page ("Chung" + "Hồ sơ"). Responsive — collapses to horizontal tabs on mobile.
- **Auth Form Improvements:** Signup now accepts email as username (auto-fill email field). Smart display_name fallback. Email duplicate check on registration.

### Changed
- **Inbox detail architecture:** Replaced `@uiw/react-md-editor` overlay with inline reader/editor views reusing KB CSS classes (`kb-reader`, `kb-editor`, `kb-split`, `kb-prose`). Bundle size reduced from 915KB → 19.7KB.
- **Quick-add form layout:** Wrapped in row container to accommodate description toggle button.
- **Inbox item cards:** Now clickable (cursor pointer). URL links use `stopPropagation` to avoid opening detail view when clicking links.

### Files Modified
- `src/pages/InboxPage.jsx` — detail view + description toggle + body preview
- `src/styles/inbox.css` — detail panel, desc toggle, body preview, clickable items
- `src/pages/SettingsPage.jsx` — sidebar layout + profile section
- `src/styles/settings.css` — sidebar + profile styles
- `src/components/AuthModal.jsx` — smart signup form
- `src/contexts/AuthContext.jsx` — (no changes, hooks already support body)

---

### Changed
- **`DATABASE.md` overhaul (P0):** Removed 560-line stale SQL block containing 6 phantom tables (`teams`, `reactions`, `quiz_attempts`, `daily_challenge_completions`, `partner_queue` + their RLS policies). Replaced with concise Table Inventory reference to `schema_v4.4.0.sql` as single source of truth.
- **`friendships` marked ARCHIVED:** Entity Overview and Table Inventory now clearly label `friendships` as `[ARCHIVED v3.0.0]`. Table exists in production but is not used by any active code.
- **`user_tasks.collection_id` documented as DEPRECATED:** Added Deprecated Columns section in DATABASE.md. Column superseded by `task_collections` junction table (M:N, v4.5.0). Will be DROPped in v5.0.

### Fixed
- **Habit sort_order not persisted (P1):** `useCustomHabits.reorderHabits()` now batch-updates `sort_order` column in Supabase (fire-and-forget). Previously reorder was UI-only and lost on page refresh. Fetch query now orders by `sort_order ASC, created_at ASC`.

### Files Modified
- `docs/DATABASE.md` — complete rewrite of SQL block + Entity Overview cleanup
- `src/hooks/useCustomHabits.js` — sort_order persist + fetch order + rowToHabit mapping
- `docs/TASKS.md` — v4.5.4 section
- `CHANGELOG.md` — this entry
- `package.json` — version bump → 4.5.4

---

## v4.5.3 — 2026-05-07

### Changed
- **`useCollections.js` JSDoc:** Fixed stale type list — removed deprecated `'want'`, added missing `'note'` to match DB CHECK constraint.
- **`reset_user_data.sql`:** Synced with v4.5.0 schema — added `DELETE FROM task_collections` (was missing), updated table count 24 → 25.

### Removed
- **`placeholder-page.css`:** Orphan CSS with zero imports — dead code from early development.

### Archived
- **`docs/TEAM_DESIGN.md`** → `docs/_archived/` — Team feature fully archived, design doc orphaned.
- **`docs/implementation_plan.md.resolved`** → `docs/_archived/implementation_plan_ai_v3.md` — Resolved AI roadmap from v3.x era.
- **`Chương Trình Kỷ Luật.pdf`** → `docs/_archived/Chuong_Trinh_Ky_Luat.pdf` — Non-code file removed from repo root.
- **`dist/` directory** — Stale build output cleaned (already in .gitignore).

---

## v4.5.2 — 2026-05-07

### Fixed
- **3 empty files recovered:** `useUserTasks.js`, `useCollections.js`, and `LinkKBModal.jsx` were corrupted to 0 bytes in commit `d7c29de`. Restored from `cfff3b2` and re-applied v4.5.0/v4.5.1 upgrades.
  - `useUserTasks.js` — Restored + re-added `task_collections` embedded select with fallback, `linkCollection()`, `unlinkCollection()`, `_collections` array on each task.
  - `useCollections.js` — Restored + re-added `task_collections(task_id)` join for `_linkedTaskIds`/`_linkedTaskCount`, 2-step fallback (full → tags-only → plain).
  - `LinkKBModal.jsx` — Rebuilt from scratch: search + checkbox modal, max 10 results, searches title + body_text/body, linked items sorted first, glassmorphism UI.
- **Deprecated meta tag:** Replaced `<meta name="apple-mobile-web-app-capable">` with `<meta name="mobile-web-app-capable">` in `index.html` to fix Chrome deprecation warning.

### Files Modified
- `src/hooks/useUserTasks.js` — restored + v4.5.0 upgrades
- `src/hooks/useCollections.js` — restored + v4.5.0 upgrades
- `src/components/LinkKBModal.jsx` — rebuilt from spec
- `index.html` — meta tag fix

---

## v4.5.1 — 2026-05-03

### Fixed
- **useUserTasks query crash:** Embedded select `task_collections(...)` returns 400 when junction table not yet created. Added graceful fallback → retry with plain `select('*')`. Tasks now load even without migration.
- **useCollections query crash:** Same `task_collections` join failure. Fallback now retries without `task_collections` (keeps `collection_tags` join), then falls back to plain `select('*')` if both fail.
- **LinkKBModal empty state:** Modal showed "Chưa có bài viết" because `useCollections()` in `TaskListSection` never called `fetchItems()`. Added `useEffect` to trigger `fetchCollections({})` when modal opens (`linkTaskId` set).
- **LinkKBModal search:** Now searches both `title` AND `body_text`/`body` fields (previously title only).
- **profiles INSERT RLS policy missing:** Signup "Database error saving new user" caused by missing INSERT policy on `profiles` table. Added `profiles_insert_own` policy.

### Changed
- **LinkKBModal max results:** Reduced from 20 → 10 for cleaner UX. Scroll for overflow.
- **Settings in avatar dropdown:** Added "⚙️ Cài Đặt" menu item between "Phím Tắt" and "Đăng Xuất" in user avatar dropdown.
- **Edit form KB link button:** Added 🔗 link KB button inside task edit form (opens LinkKBModal inline).
- **Add form KB hint:** Shows "💡 Tạo xong nhiệm vụ rồi nhấn 🔗 để liên kết bài viết Knowledge" in add form.
- **CollectPage Task Filter:** Replaced inline chip row with 📌 icon button + dropdown popup in toolbar. Click-outside auto-close. Scrollable task list.
### Files Modified
- `src/hooks/useUserTasks.js` — fallback query
- `src/hooks/useCollections.js` — 2-step fallback query
- `src/components/LinkKBModal.jsx` — search body, max 10
- `src/components/TaskListSection.jsx` — fetchCollections trigger, edit form 🔗 button, add form hint
- `src/components/Navbar.jsx` — Settings in avatar dropdown
- `data/schema_v4.4.0.sql` — profiles INSERT policy
- `package.json` — version bump → 4.5.1

---

## v4.5.0 — 2026-05-03

### Added
- **Task ↔ Knowledge Base Many-to-Many:** Tasks can now link to MULTIPLE Knowledge Base articles, and each article can be linked to multiple tasks. Replaces the old 1:1 `collection_id` FK.
  - `task_collections` junction table [NEW] — `(task_id, collection_id)` composite PK + RLS + CASCADE delete
  - `useUserTasks.linkCollection(taskId, collectionId)` [NEW] — optimistic junction insert
  - `useUserTasks.unlinkCollection(taskId, collectionId)` [NEW] — optimistic junction delete
  - Embedded Supabase select — 1 query fetches tasks WITH linked collections (no N+1)
- **LinkKBModal component** [NEW] — Search + checkbox modal to link/unlink Knowledge articles to a task. Max 20 search results. Linked items sorted first.
- **CollectPage Task Filter:** New `📌 Task:` filter chip row — filter Knowledge articles by linked task. Shows only active (pending) tasks.
- **CollectPage Task Badge:** Each article card shows `📌 N tasks` badge when linked to tasks.

### Fixed
- **ArticleCard Tiptap excerpt:** When `body_text` is empty (pre-migration articles), ArticleCard now extracts plain text from Tiptap JSON content instead of showing raw JSON.

### Changed
- `useUserTasks.js` — Fetch uses embedded select `task_collections(collection_id, collections(id, title, type))`. Each task exposes `_collections` array.
- `useCollections.js` — Fetch includes `task_collections(task_id)` join. Items expose `_linkedTaskIds` array and `_linkedTaskCount`.
- `TaskListSection.jsx` — Badge `🔗 KB` → `🔗 N bài`. New 🔗 button per task opens LinkKBModal. Imports `useCollections` + `LinkKBModal`.
- `CollectPage.jsx` — `pendingTasks` destructured from `useUserTasks`. `filterTaskId` state + filter logic. Task filter chip row. ArticleCard excerpt fix.

### Database
- `data/schema_v4.4.0.sql` — v4.5.0 section: `task_collections` table + RLS + index + data migration from `user_tasks.collection_id`
- **Migration:** Run the v4.5.0 section of `schema_v4.4.0.sql` in Supabase SQL Editor BEFORE deploying frontend v4.5.0

### Files Modified
- `src/hooks/useUserTasks.js`
- `src/hooks/useCollections.js`
- `src/components/TaskListSection.jsx`
- `src/components/LinkKBModal.jsx` [NEW]
- `src/pages/CollectPage.jsx`
- `data/schema_v4.4.0.sql`
- `package.json` — version bump → 4.5.0

---

## v4.4.0 — 2026-05-02

### Fixed
- **IncubatorPage Execute Modal crash:** `EXPENSE_DATA.map()` called on object root instead of `.categories` array. Also fixed field names `cat.id`→`cat.key`, `cat.name`→`cat.label`. Without this fix, selecting "💰 Ghi nhận Chi tiêu" in Execute Modal would throw `TypeError`.
- **Subscription monthly cost miscalculation:** `getMonthlyCost()` returned full cycle amount for `3month` and `6month` subscriptions instead of dividing by 3 and 6 respectively. A 300k/3-month sub now correctly shows 100k/month.

### Added
- **Task ↔ Knowledge Link:** Tasks can now reference a Knowledge Base item via `collection_id` FK. Create linked tasks from the Knowledge reader view (📌 Task button). Tasks with links show a clickable 🔗 KB badge.
  - `migration_v4.4.0_task_knowledge_link.sql` [NEW] — `ALTER TABLE user_tasks ADD COLUMN collection_id UUID REFERENCES collections(id)`
  - `useUserTasks.addTask()` accepts optional `collectionId`
  - `CollectPage.jsx` ReaderView — 📌 Task action button
  - `TaskListSection.jsx` — 🔗 KB badge with navigate-to-collect
- **Inbox Bulk Actions:** Toggle "☑ Chọn nhiều" mode → checkboxes appear on each item. Bulk classify (📂 picks type for all selected) and bulk delete (🗑). Select all/none toggle. Activity log for bulk operations.
- **Activity Log for Inbox:** `handleClassify()` and `handleSnooze()` now log to activity_logs for traceability in Life Log heatmap/timeline.

### Changed
- `useSubscriptions.js` — `getMonthlyCost()` now handles all 4 cycles correctly
- `InboxPage.jsx` — Bulk mode state + UI + handlers + activity log integration
- `CollectPage.jsx` — Import `useUserTasks`, pass `onCreateTask` to ReaderView
- `TaskListSection.jsx` — Import `useNavigate`, render 🔗 KB badge
- `inbox.css` — ~100 lines: bulk bar, classify menu, checkbox, selected highlight (dark/light)

### Database
- `data/migration_v4.4.0_task_knowledge_link.sql` — Run BEFORE deploying frontend v4.4.0

### Files Modified
- `src/pages/IncubatorPage.jsx`
- `src/hooks/useSubscriptions.js`
- `src/pages/InboxPage.jsx`
- `src/pages/CollectPage.jsx`
- `src/hooks/useUserTasks.js`
- `src/components/TaskListSection.jsx`
- `src/styles/inbox.css`
- `data/migration_v4.4.0_task_knowledge_link.sql` [NEW]

---

## v4.3.0 — 2026-05-01

### Added
- InboxPage: Filter chips (Tất cả / Có URL / Gần đây 7 ngày) — client-side filtering, no search bar
- IncubatorPage: "▼ Xem dự định đã bỏ qua" toggle — collapsible archive view for abandoned intentions
- `useIntentions.fetchAbandoned()` — fetches intentions with status='abandoned'

### Changed
- `InboxPage.jsx` — filter state + chip UI + filtered rendering with smart empty state
- `IncubatorPage.jsx` — archive toggle + read-only abandoned cards
- `inbox.css` — `.inbox-filter-chip` styles (dark/light mode)
- `useIntentions.js` — added `fetchAbandoned` export

### Removed
- `data/migration_v4.3.0_drop_tags_column.sql` — drops deprecated `collections.tags TEXT[]` column

### Files Modified
- `src/pages/InboxPage.jsx`
- `src/pages/IncubatorPage.jsx`
- `src/hooks/useIntentions.js`
- `src/styles/inbox.css`
- `data/migration_v4.3.0_drop_tags_column.sql` [NEW]

---

## v4.2.1 — 2026-05-01

### Added
- `useExpenses.updateExpense(id, updates)` — optimistic update + rollback
- FinancePage: ✏️ edit button on each expense → modal with amount/category/note
- `useSubscriptions.fetchSubs` auto-advances expired `next_due` by cycle (bounded MAX_ADVANCES=24)
- TrackerPage: 🥚 Incubator Review Banner — yellow alert when intentions have review_date ≤ today, links to `/incubator`

### Changed
- `useExpenses.js` — added `updateExpense` export
- `useSubscriptions.js` — `fetchSubs` now auto-advances expired subs
- `TrackerPage.jsx` — imports `useIntentions`, adds review banner widget
- `FinancePage.jsx` — wrapped return in Fragment for edit modal overlay
- `finance.css` — added `.finance-list__edit` styling

### Files Modified
- `src/hooks/useExpenses.js`
- `src/hooks/useSubscriptions.js`
- `src/pages/FinancePage.jsx`
- `src/pages/TrackerPage.jsx`
- `src/styles/finance.css`

---

## v4.2.0 — 2026-05-01

### Added
- **🥚 Incubator Multi-Output Router:** Execute Modal chuyển từ Radio (chọn 1) sang Checkbox (đa lựa chọn). Khi thực thi một dự định, user có thể tạo đồng thời:
  - 💰 **Chi tiêu** → `addExpense()` + dropdown chọn 1 trong 8 category. Tự động điền `estimated_cost`.
  - 🔁 **Thói quen** → `addHabit()` + tự động điền `durationMin` từ `estimated_time`.
  - 📌 **Công việc** → `addTask()` + tự động điền `durationEst` từ `estimated_time`.
- **Auto-suggest:** Pre-check options dựa trên data: cost > 0 → Expense, time > 0 → Habit, cả 2 = 0 → Task.
- **estimated_time UI:**
  - Form: Dropdown `⏱ Cam kết thời gian` (15m/30m/1h/1.5h/2h/nửa ngày) thay vì ô số.
  - Card: Badge `⏱ 1h` / `⏱ 30m` hiển thị cạnh badge 💰 chi phí.
- **Migration:** `data/migration_v4.2.0_incubator_v2.sql` — `converted_to` TEXT → TEXT[], thêm `converted_ids` JSONB.

### Changed
- `useIntentions.js` — `executeIntention(id, { convertedTypes, convertedIds })` thay `{ convertTo, convertedId }`.
- `IncubatorPage.jsx` — Import thêm `useExpenses`, `useCustomHabits`, `expense-categories.json`. Multi-dispatch handler.
- `incubator.css` — Thêm ~150 dòng: exec option cards, checkbox visual, category dropdown, duration badge, light mode.

### Database
- `data/migration_v4.2.0_incubator_v2.sql` — Run BEFORE deploying frontend v4.2.0.

---


### Fixed
- **Sidebar avatar dropdown** (`Navbar.jsx`) — Rewritten with React Portal + `getBoundingClientRect`. Menu no longer clipped by `overflow-y: auto` on sidebar. Renders correctly above avatar at fixed viewport position.
- **Inbox add button** (`useCollections.js`) — Removed `content_format`, `body_text`, `word_count` from `addItem` insert payload. These optional columns (migration v3.2.0) caused insert failure on instances where migration hadn't been applied.
- **Button disabled state** (`global.css`) — Added `.btn-primary:disabled` style with `opacity: 0.4` + `cursor: not-allowed` — previously disabled buttons looked identical to enabled ones.
- **Sidebar layout** (`navbar.css`) — Moved `overflow-y: auto` from `.sidebar` to `.sidebar__nav`. Added `position: relative; z-index: 10` to `.sidebar__bottom` to allow dropdown to escape nav stacking context.

---

## v4.1.0 — 2026-04-30

### Added
- **⚙️ Settings Page (`/settings`):** Trang cài đặt mới — hiện tại quản lý Tags (CRUD, rename, recolor, usage count). Future: Theme, Notifications, Account.
  - `SettingsPage.jsx` [NEW] — Tag Manager UI: danh sách tag + form thêm mới + inline edit + color picker + delete with confirmation.
  - `settings.css` [NEW] — Glassmorphism layout, color picker grid, responsive, dark/light mode.
- **🏷️ Tag Unification (Collection Tags):** Chuyển `collections.tags` (TEXT[]) sang central `tags` + `collection_tags` junction table.
  - `migration_v4.1.0_tag_unification.sql` [NEW] — `collection_tags` table + RLS + indexes + data migration script (TEXT[] → junction).
  - `useTags.js` — `updateTag(id, {name, color})` [NEW], `getTagsForEntity()` [NEW], `getTagUsageCount()` [NEW], `getAllTagUsageCounts()` [NEW]. `linkTag`/`unlinkTag` now support `entityType='collection'`.
  - `useCollections.js` — `fetchItems()` joins `collection_tags(tags(id,name,color))` → `item._tags`. `addItem()` no longer writes to `collections.tags` TEXT[] column.
  - `CollectPage.jsx` — Switched to central tags: TagInput shows color dots, tag filter chips show color dots, save/edit uses `linkTag`/`unlinkTag`.
- **Navbar:** ⚙️ Cài Đặt link in SECONDARY_NAV.

### Changed
- `App.jsx` — Route `/settings` + lazy import SettingsPage + SEO meta.
- `Navbar.jsx` — Added ⚙️ Settings nav link.
- `collections.tags` column — Marked DEPRECATED (comment). Will be removed in v5.0.

### Database
- `data/migration_v4.1.0_tag_unification.sql` — Run BEFORE deploying frontend v4.1.0.

---

## v4.0.3 — 2026-04-30

### Added
- **Fitness edit (Phase 2):** `updateLog(id, fields)` in `useFitnessLog.js` — optimistic update + rollback.
- **Fitness inline edit UI:** Click log item or ✏️ button → inline edit form (session name, duration, energy, notes) + Save/Huỷ.
- **Dashboard Fitness card:** Compact "🏋️ Tuần Này" section with 3 KPI cards + today summary. CTA → Tracker fitness tab.

### Changed
- `useFitnessLog.js` — Phase 2 docstring, full CRUD (add + update + delete).
- Resolves Technical Debt #4 (fitness edit).

---

## v4.0.2 — 2026-04-30

### Fixed
- **spawnRecurringTask retry:** Bounded retry (max 3 attempts, 1s/2s backoff) khi insert recurring task thất bại. Trước đây: silent fail → task lặp lại không được tạo. Bây giờ: retry + structured `console.error` log khi hết retry.

---

## v4.0.1 — 2026-04-30

### Changed
- **InboxPage overflow menu:** Refactor 7 inline action buttons → 2 primary (📌 Task + 🗑) + overflow menu (···) dropdown.
  - Overflow contains: 📂 Phân loại, 💸 Chi tiêu, 🔄 Đăng ký, 🥚 Ấp Trứng, 🕔 Snooze.
  - Click-outside auto-close.
  - Glassmorphic dark/light theme dropdown.
  - Fixes Technical Debt #1 (action overflow since v3.5.0).

---

## v4.0.0 — 2026-04-30

### Added
- **🏋️ Health/Fitness Tab (Phase 1):** Tab thứ 5 trong TrackerPage.
  - `migration_v4.0.0_fitness.sql` [NEW] — `fitness_logs` table + RLS + index.
  - `useFitnessLog.js` [NEW] — addLog, deleteLog, todayLogs, weekSummary.
  - TrackerPage — Form nhập (tên buổi tập + thời gian + năng lượng + ghi chú), today log list, week summary cards.
  - XP integration: +10 XP/buổi tập + logActivity('fitness_done').
- **🔗 Reader View (Metadata Preview):**
  - `api/meta.js` [NEW] — Vercel Edge Function fetch OG metadata (title, image, desc) với 5s timeout + graceful fallback.
  - `useLinkMeta.js` [NEW] — Client-side cache + fetch hook.
  - InboxPage — Preview card (thumbnail + title + desc) cho inbox items có URL.
  - `inbox.css` — Link preview styles (dark/light).

### Changed
- `TrackerPage.jsx` — 5 tabs (thêm 🏋️ Sức Khỏe).
- `InboxPage.jsx` — Auto-fetch link meta, render preview card.

---

## v3.9.0 — 2026-04-30

### Added
- **🥚 Incubator Module (Trạm Ấp Trứng):** Module mới cho "someday-maybe" items.
  - `IncubatorPage.jsx` [NEW] — Card UI với review-due highlighting, expandable timeline logs.
  - `useIntentions.js` [NEW] — CRUD + deferIntention (reason bắt buộc) + executeIntention (→ Task/Expense) + abandonIntention + getLogs.
  - `incubator.css` [NEW] — Full page styles, modals, timeline, dark/light theme.
  - `migration_v3.9.0_incubator.sql` [NEW] — `intentions` + `intention_logs` tables + RLS.

### Changed
- `App.jsx` — Route `/incubator` + lazy import.
- `Navbar.jsx` — Link 🥚 Incubator trong main nav.
- `InboxPage.jsx` — Nút 🥚 Ấp Trứng chuyển inbox item vào Incubator.

---

## v3.8.0 — 2026-04-30

### Added
- **Inbox — Snooze (🕔):** Nút 🕔 Snooze trên inbox item → dropdown 4 options (1 tuần / 2 tuần / 1 tháng / 3 tháng). Item ẩn khỏi danh sách, tự xuất hiện lại khi đến ngày. Badge "🕔 X snoozed" trong header.
- **Migration:** `data/migration_v3.8.0_snooze.sql` — `ALTER TABLE collections ADD snoozed_until DATE`.

### Changed
- `src/hooks/useCollections.js` — `snoozeItem(id, untilDate)`, `getSnoozedCount()`, `fetchItems` filter snoozed inbox items, `getInboxCount` excludes snoozed.
- `src/pages/InboxPage.jsx` — Snooze button + dropdown menu, snoozed count badge in header, handleSnooze helper.
- `src/styles/inbox.css` — Snooze button + menu styles (amber theme, dark/light mode).

---

## v3.7.0 — 2026-04-30

### Added
- **Finance — Cashflow Calendar (📅):** `CashflowBar.jsx` [NEW] — thanh timeline 30 ngày hiển thị subscription due dates. Dot đỏ + tooltip + legend. Mount dưới summary cards trong FinancePage.
- **PARA Tags (🏷️):** `useTags.js` [NEW] — CRUD tags, linkTag/unlinkTag cho expenses + subscriptions. `TagPicker.jsx` [NEW] — searchable dropdown, multi-select, tạo tag mới bằng Enter.
- **Migration:** `data/migration_v3.7.0_para.sql` — `tags`, `expense_tags`, `subscription_tags` tables + RLS + indexes.

### Changed
- `src/pages/FinancePage.jsx` — Import CashflowBar, TagPicker, useTags. Mount CashflowBar sau upcoming alert. TagPicker trong cả expense và subscription forms. Link tags on save.
- `src/styles/finance.css` — Thêm ~130 dòng `.cashflow-bar-*` styles (track, cells, dots, legend, dark/light theme).

---

## v3.6.0 — 2026-04-30

### Added
- **Task — Energy Tag (⚡):** Mỗi task gắn energy level (high/medium/low). Picker 3 nút trong form. Badge emoji trên task card. Filter chips (Tất cả/Cao/Vừa/Thấp) đầu danh sách.
- **Task — Duration Estimate (⏱):** 5 mức thời gian (5p/15p/30p/1h/2h+). Picker trong form, badge hiển thị trên card.
- **Task — Recurring Tasks (🔁):** Toggle "Lặp lại" trong form → chọn Mỗi N ngày / Hàng tuần thứ X / Hàng tháng ngày Y. `recurrence_rule` JSONB lưu vào DB. Spawn-one strategy: completeTask → `spawnRecurringTask()` insert 1 row mới với `due_date` tương lai. Không batch, không vòng lặp.
- **Date helpers:** `addDays()`, `nextWeekday()`, `nextMonthDay()` trong `useUserTasks.js`.
- **Migration:** `data/migration_v3.6.0_tasks.sql` — `ALTER TABLE user_tasks ADD COLUMN energy_level / duration_est / recurrence_rule`.

### Changed
- `src/hooks/useUserTasks.js` — `addTask()` nhận `energyLevel/durationEst/recurrenceRule`. `completeTask()` fire-and-forget `spawnRecurringTask()` khi task có recurrence_rule.
- `src/components/TaskListSection.jsx` — Thêm ENERGY_OPTIONS, DURATION_OPTIONS, WEEKDAYS constants. Form: Energy picker + Duration picker + Recurrence toggle (interval/weekly/monthly). Task cards: 🔁/⚡/⏱ badges. Filter chips trước danh sách. filterFn áp dụng trên filteredToday/filteredOverdue/filteredFuture.

---

## v3.5.0 — 2026-04-30

### Added
- **Inbox — Quick Expense (💸):** Nút "💸 Chi tiêu" trên mỗi inbox item → QuickExpenseModal inline. Regex tự bóc tách số tiền từ text Việt Nam ("Cafe 50k" → 50,000). Pre-fill amount + note + category dropdown 8 loại. Lưu → `addExpense()` + `logActivity()` + xóa item khỏi inbox.
- **Task — Overdue Triage (⚠️):** Task list chia 3 khối: ⚠️ Quá hạn (nền đỏ) / 📅 Hôm nay / 🔮 Sắp tới (collapsed mặc định).
- **Task — Rollover (🔄):** Nút 🔄 trên overdue task → cập nhật `due_date = today` → task chuyển sang section Hôm nay.
- **useUserTasks hook:** Thêm `todayTasks`, `overdueTasks`, `futureTasks` derived state + `rolloverTask()` function.

### Changed
- `src/pages/InboxPage.jsx` — Thêm import `useExpenses`, `useActivityLog`, `EXPENSE_DATA`. Thêm `extractAmount()` regex, `QuickExpenseModal` component, `handleToExpense()`, `handleExpenseSave()`.
- `src/styles/inbox.css` — Thêm ~180 dòng: `.inbox-expense-modal-*` styles (backdrop blur, glassmorphism modal, category grid, amount preview, light mode variants).
- `src/components/TaskListSection.jsx` — Tái cấu trúc: dùng `todayTasks/overdueTasks/futureTasks` thay `pendingTasks`. Extract `renderTask()` helper. Thêm Overdue section, collapsed Future section, Rollover button.
- `src/hooks/useUserTasks.js` — Thêm derived splits + `rolloverTask()`. Export 3 fields mới.

---

## v3.4.0 — 2026-04-27

### Added
- **Google Docs UI for Tiptap Editor:**
  - Integrated `lucide-react` for clean, professional icons replacing text buttons.
  - Added new extensions: `@tiptap/extension-underline`, `@tiptap/extension-text-align`, `@tiptap/extension-text-style`, `@tiptap/extension-color`.
  - Added dropdown for Heading levels (Normal text, H1, H2, H3).
  - Added native color picker for text coloring.
  - Added alignment buttons (Left, Center, Right, Justify).
  - Redesigned toolbar with grouping and vertical dividers.
- **Shortcuts:** Added shortcuts for Underline (`Ctrl+U`) and Alignments (`Ctrl+Shift+L/E/R/J`).

### Changed
- `tiptap.css`: Rewrote `.tp-btn` for icon layout, added `.tp-toolbar-dropdown`, `.tp-select`, and `.tp-color-picker` styling to match Google Docs flat aesthetic.

---

## v3.3.1 — 2026-04-27

### Fixed
- **Light mode CSS:** Comprehensive overrides for Tiptap editor — toolbar buttons, active states, divider, link popover, slash menu, shortcuts modal, footer, code/blockquote/highlight/table/mark all now visible and properly contrasted.
- **Word count realtime:** Tiptap mode now uses `CharacterCount.words()` (accurate) instead of manual text split. Passed as 3rd arg in `onChange(json, text, words)`. EditorView header updates in realtime.
- **Expanded shortcuts panel:** Added 3rd section "✍️ Gõ tắt Markdown" (9 auto-format rules: `# `, `## `, `- `, `1. `, `> `, `---`, etc.). Added Tab/Shift+Tab, Shift+Enter to Khối section.
- **Markdown keyboard shortcuts [NEW]:** `Ctrl+B/I/E/K/1/2/3`, `Ctrl+Shift+X/B/C/7/8/9`, `Ctrl+S` save, `Ctrl+P` block, `Ctrl+.` shortcuts panel. Also added `⌨` button to Markdown toolbar.

### Changed
- `TiptapEditor.jsx` — Export `ShortcutsModal` + `MD_SHORTCUT_SECTIONS` for Markdown reuse. `sections` prop for ShortcutsModal.
- `CollectPage.jsx` — MarkdownEditor now accepts `onSave`, has `handleKeyDown`, `mdShortcutsOpen` state, ShortcutsModal.
- `tiptap.css` — ~200 lines of light mode overrides (was 8 lines).
- `collect.css` — Added `.kb-tb-divider` style.

---

## v3.3.0 — 2026-04-27

### Added
- **Tiptap — Slash Command Menu (`/`):** Gõ `/` trong editor → dropdown 12 block types (Paragraph, H1-H3, Bullet/Ordered/Task List, Blockquote, Code Block, Divider, Table, Highlight). Filter theo text (`/hea` → Heading 1/2/3). Arrow keys + Enter + Escape navigation. Dùng `@tiptap/suggestion` plugin.
- **Tiptap — Keyboard Shortcuts Panel (`Ctrl+.`):** Modal glassmorphism hiển thị 25+ phím tắt, chia 4 nhóm (Văn bản, Khối, Chèn, Chung). Toggle bằng nút `⌨` trên toolbar hoặc `Ctrl+.`.
- **Tiptap — Browser Shortcut Override:** `Ctrl+S` → save article (thay vì Save Page), `Ctrl+P` → blocked (không Print), `Ctrl+.` → toggle shortcuts panel. Xử lý qua `editorProps.handleKeyDown`.
- **SlashCommand.jsx [NEW]:** Component riêng cho Slash Command extension + UI dropdown.
- **`@tiptap/suggestion`** package (0 production deps, peer deps đã có).

### Changed
- `TiptapEditor.jsx` — Thêm `onSave` prop, `SlashCommandExtension`, `ShortcutsModal`, `handleKeyDown` browser override, footer hint (`/` + `Ctrl+.`).
- `CollectPage.jsx` — Pass `onSave={handleSaveDraft}` to TiptapEditor cho Ctrl+S save.
- `tiptap.css` — Thêm styles cho slash menu, shortcuts modal, footer hint, light mode variants.
- `package.json` — Bump version 3.2.1 → 3.3.0.

---

## v3.2.1 — 2026-04-27

### Added
- **Dashboard — Mood Trend Chart:** Thay MoodChart7Day bar chart bằng dot-line SVG chart mới, toggle 7/30 ngày. Hiển thị average mood score, color-coded dots, emoji overlay, grid lines. Import `useMoodLog` vào Dashboard.
- **Dashboard — Focus Breakdown:** Per-habit horizontal bar chart 7 ngày gần nhất. Query trực tiếp `focus_sessions` + join `habits` table từ Supabase. Hiển thị icon, tên habit, progress bar, phút, %.
- **Dashboard — Weekly Review Digest:** Collapsible summary card: Habits hoàn thành, XP, Chi tiêu, Mood TB — so sánh với tuần trước (↑/↓/→). Expand/collapse animation.

### Changed
- `package.json` — Bump version 3.1.0 → 3.2.1 (3.2.0 was documented but never bumped)
- `dashboard.css` — Add styles for MoodTrendChart, FocusBreakdown, WeeklyReview
- `DashboardPage.jsx` — Import `useAuth`, `supabase`, `useMoodLog`. Add 3 new widget components.
- `docs/FEATURES.md` — Update Dashboard section #5 with 3 new widgets
- `docs/ARCHITECTURE.md` — Update DashboardPage data sources diagram
- `docs/PLAN.md` — Fix Phase 7 incomplete items → Phase 8 backlog, add Phase 7.6 v3.2.1
- `docs/TASKS.md` — Mark Team v3 as ❌ CANCELLED, add v3.2.1 section

---

## v3.2.0 — 2026-04-26

### Added
- **Knowledge Base — Dual-Mode Editor:** Tích hợp Tiptap WYSIWYG editor bên cạnh Markdown. Mặc định = Markdown, có toggle sang Visual khi tạo bài mới.
- **Knowledge Base — Mode Lock:** Bài viết lock mode khi tạo (tiptap/markdown), không thể đổi khi edit lại.
- **Knowledge Base — Tag Autocomplete:** TagInput với searchable dropdown (tối đa 10 tags), phân trang scroll, tạo tag mới bằng Enter, lưu DB khi bài được save.
- **Knowledge Base — AI-ready schema:** 3 columns mới: `content_format`, `body_text` (plain text extracted), `word_count` (pre-computed) → sẵn sàng Phase 2 AI (embedding, RAG, semantic search).
- **TiptapEditor component:** `src/components/TiptapEditor.jsx` — WYSIWYG full toolbar (Bold/Italic/Strike/Highlight/Code/H1-H3/Lists/TaskList/Blockquote/CodeBlock/HR/Link/Table/Undo/Redo) + `TiptapReadOnly` cho reader view.
- **Inline Link Popover:** Thay `window.prompt` bằng inline link input bar hiện ngay dưới toolbar khi bấm 🔗.
- **ConfirmModal component:** `src/components/ConfirmModal.jsx` — Promise-based `useConfirm()` hook, drop-in thay toàn bộ `window.confirm()`. Glassmorphism UI, danger variant, Escape key, backdrop click, auto-focus.
- **isTiptapBody auto-detect:** Tự nhận dạng bài Tiptap từ body JSON shape khi `content_format` column chưa được migrate.
- **safeHostname helper:** Guard `new URL(url)` crash với URL invalid/relative.

### Changed
- `useCollections.addItem` — Nhận đầy đủ `content_format`, `body_text`, `word_count` thay vì hardcode fixed fields.
- `ArticleCard` — Dùng `body_text` (plain text) cho excerpt thay vì `body` raw (tránh hiển thị JSON Tiptap).
- `ReaderView` — Auto-detect format, render `TiptapReadOnly` hoặc `ReactMarkdown` tương ứng.
- `handleSave` — Truyền đủ payload mới vào DB khi save/update.
- `HabitManager` — Nút xóa dùng `useConfirm` modal thay `window.confirm`.
- `LifeJourneyPage` — Nút Reset dùng `useConfirm` modal thay `window.confirm`.

### Removed
- `makeExcerpt()` — Dead code, đã thay bằng `body_text.slice(0, 180)`.
- Tất cả `window.confirm()`, `window.alert()`, `window.prompt()` trong active code.

### Fixed
- `TiptapEditor` imports — Đổi từ default sang named exports (`{ Table }`, `{ Link }`, v.v.) để tránh Vite runtime error.
- `new URL(item.url).hostname` không được guard → crash khi URL invalid.

### Database
- `data/migration_v3.2.0_knowledge.sql` — `ALTER TABLE collections ADD COLUMN content_format / body_text / word_count`

---

## v3.1.2 — 2026-04-26

### Added
- **Dashboard:** Mood 7-day chart — inline SVG line chart với emoji overlay, hiển thị xu hướng cảm xúc 7 ngày gần đây
- **Finance:** `CustomSelect` component — thay native `<select>` bằng glassmorphic dropdown với animation slide-down, icon emoji, active highlight
- **Finance Subscription:** 4 chu kỳ: `1 tháng / 3 tháng / 6 tháng / 1 năm` (thay vì chỉ 2)
- **Finance Subscription:** Nút "Tự tính ↻" — auto-fill ngày gia hạn dựa theo chu kỳ chọn
- **Finance Subscription:** Label rõ "📅 Ngày gia hạn tiếp theo" + date field styled với `color-scheme`
- **Life Log:** `selectedDate` mặc định = hôm nay → vào trang là thấy timeline ngay, không cần click heatmap

### Fixed
- `migration_v3.0.0.sql` — Index `idx_activity_logs_user_date` dùng `created_at::date` gây lỗi `ERROR: 42P17` (function not IMMUTABLE) → đổi thành `created_at` plain

### Performance
- `DashboardPage` — `monthStart` và `todayStr` dùng `useMemo` tránh recreation mỗi render
- `DashboardPage` — Chart components bọc `React.memo` tránh re-render không cần thiết
- Bundle: lazy-load tất cả heavy pages

### Database
- `data/schema_v3.1.1.sql` — **Migration gộp mới**: 1 file duy nhất (456 dòng) thay 8 file lịch sử. Dùng cho fresh Supabase project. Gộp tất cả tables trừ Team (archived)

---

## v3.1.1 — 2026-04-26

### Fixed
- **UX Bug:** Bôi đen text bên trong bất kỳ popup/modal nào đều bị đóng popup (close-on-text-select)
- **Root cause:** Các overlay backdrop dùng `onClick` — khi user drag để bôi text, `mouseup` bubble lên backdrop → trigger close
- **Fix:** Thay `onClick` backdrop bằng `onMouseDown` + `onMouseUp` target check — chỉ đóng khi cả mousedown VÀ mouseup đều hit đúng backdrop element (không phải từ bên trong modal)
- **Files affected:**
  - `QuickCapture.jsx` — `.qc-backdrop`
  - `LifeJourneyPage.jsx` — `EventModal .lj-overlay`
  - `CustomJourneyModal.jsx` — `.journey-modal-overlay`
  - `CompletionModal.jsx` — `.completion-overlay`
  - `ContentSections.jsx` — `MiniLesson .modal-overlay`

---

## v3.1.0 — 2026-04-26

### Added
- `DashboardPage.jsx` — Unified Life Hub Dashboard: tổng hợp stats từ tất cả modules
- **Today Overview row:** 4 KPIs hôm nay (Hoạt động từ activity_logs, Focus phút từ useFocusTimer, Chi tiêu hôm nay từ expenses, XP kiếm được hôm nay)
- **Finance Section:** 3 KPI cards (Chi tháng / Đăng ký/tháng / Sắp hết hạn) + Finance Pie donut SVG chart (category breakdown tháng này)
- **Activity Heatmap:** Thay ContributionGraph habit-only bằng ActivityHeatmap (reuse component từ LifeLogPage) — lịch sử toàn hệ thống
- **Section Dividers:** `SectionTitle` component với gradient underline, icon, action link
- **TodayKpi component:** Card với hover lift effect, gradient overlay
- **FinancePie component:** SVG donut chart với legend (category + amount + %)
- `dashboard.css` — Hoàn toàn rewrite: Today KPI row, Finance KPI row, Finance Pie, Section Title dividers, hover animations

### Changed
- `DashboardPage.jsx` — Tích hợp thêm hooks: `useExpenses`, `useSubscriptions`, `useActivityLog`, `useFocusTimer`
- `DashboardPage.jsx` — Giữ nguyên: FlowerJourney, MonthDonut, WeeklyTable, SkipInsight, streak insight
- `DashboardPage.jsx` — Xóa inline `ContributionGraph` (habit-only) → thay bằng `ActivityHeatmap` (all modules)

---

## v3.0.1 — 2026-04-25

### Added
- `KnowledgeResurface.jsx` — "Hôm nay nhớ lại" spaced repetition widget (random Collect resurface, dismiss per session)
- `FinancePage` — Inline SVG Pie chart (category donut) + 7-day bar chart trend
- `InboxPage` — "→ Task" action (📌 converts inbox item to user_task) + "→ Sub" action (🔄 navigates to Finance)
- `TrackerPage` — SubAlert + KnowledgeResurface wired inline between XpBar and Hero section

### Changed
- `widgets.css` — Added KnowledgeResurface styles (cyan accent)
- `finance.css` — Added chart row layout, pie chart, bar chart styles

---

## v3.0.0 — 2026-04-25

### BREAKING — Personal Life Hub Pivot
- **Archived** Team/Friends modules → `src/_archived/` (pages, hooks, components, CSS)
- `/team` and `/friends` routes now redirect to `/tracker`

### Added
- `data/migration_v3.0.0.sql` — 4 new tables: `collections`, `expenses`, `subscriptions`, `activity_logs` + RLS + indexes
- `src/data/expense-categories.json` — 8 default expense categories (Rule 14)

### Changed
- `App.jsx` — Removed TeamPage/FriendsPage lazy imports, routes redirect
- `Navbar.jsx` — Removed Team/Friends nav links
- `TrackerPage.jsx` — Removed `useTeam` import (unused)
- `DailyChallenge.jsx` — Removed `useTeam`, always uses solo challenge pool

### Removed
- `src/pages/TeamPage.jsx` → archived
- `src/pages/FriendsPage.jsx` → archived
- `src/hooks/useTeam.js` → archived
- `src/hooks/useTeamCheck.js` → archived
- `src/hooks/useTeamRules.js` → archived
- `src/styles/team.css` → archived
- `src/styles/friends.css` → archived
- `src/components/team/` (4 components) → archived

### Added — Navigation Restructure (Phase 6.2)
- `Navbar.jsx` — Complete rewrite: Sidebar (desktop, fixed left 220px) + Top bar (mobile) + Bottom tabs (mobile, 6 items)
- `navbar.css` — New sidebar + bottom tabs + topbar layout with glassmorphism, light/dark theme support
- `QuickCapture.jsx` — Global floating [+] button → saves to `collections` table as type='inbox'
- `quick-capture.css` — FAB with gradient + pulse animation, slide-up capture modal
- `placeholder-page.css` — Shared "Coming Soon" layout for unreleased pages
- `InboxPage.jsx` — Placeholder (lazy-loaded)
- `CollectPage.jsx` — Placeholder (lazy-loaded)
- `FinancePage.jsx` — Placeholder (lazy-loaded)
- `LifeLogPage.jsx` — Placeholder (lazy-loaded)

### Changed — Navigation Restructure
- `App.jsx` — Added `.app-content` wrapper for sidebar offset; 4 new routes; QuickCapture component; SEO meta rebranded "Life Hub"
- `Navbar.jsx` — Primary nav (Today, Inbox, Collect, Finance, Life Log) + Secondary nav (Focus, Journey, Stats, Quiz, BXH, Hành Trình)

### Added — Activity Log System (Phase 6.3)
- `useActivityLog.js` — Append-only hook: `logActivity()`, `getHeatmapData()`, `getTimelineByDate()`, `getTodayCount()`
- Wired into TrackerPage (habit_done, habit_undo, mood_set), DailyChallenge (challenge_done), QuickCapture (collect_add), useFocusTimer (focus_done)

### Added — Inbox + Collect Module (Phase 6.4)
- `useCollections.js` — CRUD hook for collections table (add, classify, star, archive, delete, inboxCount)
- `InboxPage.jsx` + `inbox.css` — Quick-add form, inbox items list, classify→type actions, delete
- `CollectPage.jsx` + `collect.css` — Tabbed view (All/Links/Quotes/Want/Learn/Ideas), search, card grid with type-accent borders

### Added — Finance Module (Phase 6.5)
- `useExpenses.js` — CRUD for expenses (VNĐ, date-range fetch, getTotal, getByCategory)
- `useSubscriptions.js` — CRUD for subscriptions (monthly/yearly, toggleActive, getUpcoming, getMonthlyCost)
- `FinancePage.jsx` + `finance.css` — 2 tabs (Chi tiêu + Đăng ký), summary cards, category breakdown bars, expense list, subscription cards with expiry countdown

### Added — Life Log Module (Phase 6.6)
- `ActivityHeatmap.jsx` — GitHub-style SVG heatmap (53×7 grid, purple scale, click-to-drill)
- `DailyTimeline.jsx` — Vertical timeline with action icons, timestamps, labels
- `LifeLogPage.jsx` + `lifelog.css` — Yearly heatmap + today stat badge + drill-down daily timeline

### Added — Sidebar Widgets (Phase 6.7)
- `SubAlert.jsx` — Compact alert showing upcoming subscription renewals (≤7 days), auto-hides when empty
- `DailyReview.jsx` — Today-recap widget (total activity count + last 5 actions), auto-hides when empty
- `widgets.css` — Shared styles for sidebar widgets
- Wired both widgets into `Navbar.jsx` sidebar bottom section

### Changed — Branding
- `package.json` — name: `life-hub`, version: `3.0.0`
- `index.html` — All meta tags + title rebranded to "Life Hub — Personal Life OS"
- `manifest.json` — name/short_name/description updated to Life Hub

---

## v2.3.0 — 2026-04-25

### Added
- `MonthCalendar.jsx` — Display mood emoji on calendar cells (top-left corner indicator)
- `MonthCalendar.jsx` — Show mood + skip reason in day detail panel when clicking a date
- `calendar.css` — `.cal-cell__mood` positioning style

### Changed
- `TrackerPage.jsx` — Pass `moodLog` and `skipLog` to MonthCalendar component

---

## v2.2.3 — 2026-04-25

### Fixed
- `useXpStore.js` — Added `isReady` flag: `hasMilestone()` returns `true` conservatively until DB log loads, preventing double XP awards during async window
- `useXpStore.js` — Server-side dedup in `addXp()`: queries existing entry before INSERT (belt-and-suspenders with client dedup)
- `DailyChallenge.jsx` — Syncs `done` state with XP log on load; prevents re-awarding if localStorage was cleared

### Changed
- `useXpStore.js` — Now exports `isReady` flag for consumers to check load status
- `useXpStore.js` — `duo_streak` marked as TODO (planned for Team v3, not wired yet)

---

## v2.2.2 — 2026-04-25

### Added
- `data/migration_v2.2.2_security.sql` — 5 database security fixes (run manually in Supabase SQL Editor)

### Security Fixes
- `progress` RLS — Teammates can now read each other's progress (was owner-only in team v3 SQL)
- `team_check_logs` RLS — Blocked self-check (checked_id != auth.uid()) + require same team
- `streaks` RLS — Removed client INSERT/UPDATE policies (write only via trigger)
- `xp_logs` — Added CHECK constraint: amount BETWEEN -200 AND 200
- `handle_new_user` trigger — Merged legacy + team v3 versions (creates username + streaks + notification_settings)

### Fixed
- `docs/DATABASE.md` — Synced xp_logs column names to match actual schema (amount/meta, not xp_amount/metadata)

---

## v2.2.1 — 2026-04-25

### Removed
- `src/pages/HabitsPage.jsx` — Deleted deprecated redirect file (dead code since v1.9.0). Route `/habits` now uses inline `<Navigate>` in `App.jsx`

### Changed
- `src/App.jsx` — Removed lazy import + SEO meta for `/habits`. Route kept as inline redirect
- `src/pages/JourneyPage.jsx` — Fixed dead link `/habits` → `/tracker` in success toast
- `src/hooks/useFocusTimer.js` — Updated stale comment reference
- `src/components/TrackerSection.jsx` — Updated stale comment reference
- `src/styles/journey.css` — Updated CSS comment header

---

## v2.2.0 — 2026-04-22

### Added
- `src/pages/LifeJourneyPage.jsx` + `LifeJourneyPage.css` — Life emotion timeline: SVG chart (Catmull-Rom), dual view (compact/expanded), event list grid, stats cards
- `src/hooks/useLifeJourney.js` — CRUD milestones (add/update/delete/resetToDefault), localStorage-only (`vl_life_journey_events`)
- `src/contexts/ThemeContext.jsx` — Dark/Light theme toggle, persist preference in `vl_theme` localStorage key
- Route `/life-journey` + Navbar link "💛 Hành Trình"
- SEO meta for `/life-journey` route in `App.jsx`

### Changed
- `src/App.jsx` — Wrap with `ThemeProvider` (outermost), lazy-load `LifeJourneyPage`
- `src/components/Navbar.jsx` — Add theme toggle button (☀️/🌙), add "💛 Hành Trình" nav link

---

## v2.1.0 — 2026-04-21

### Added
- `src/components/TaskListSection.jsx` — Personal task UI (📌 Nhiệm Vụ) in TrackerPage "Hôm Nay" tab
- `src/hooks/useUserTasks.js` — Task CRUD hook (Supabase-first, guest in-memory)
- `public/sw.js` — Service Worker for background task due-time notifications
- `data/migration_v2.1.0.sql` — `user_tasks` table + RLS + indexes
- Task list: title, description, due date/time, overdue indicator, completion with timestamp
- Calendar integration: click day → see completed tasks with expandable description + completion time
- Service Worker registered in `App.jsx` — notifications work even when tab is closed

### Changed
- `src/components/MonthCalendar.jsx` — Accept `getCompletedTasks` prop, show tasks in day detail panel
- `src/pages/TrackerPage.jsx` — Add `TaskListSection` between Mood and Daily Challenge, pass `getCompletedTasks` to calendar

---

## v2.0.0 — 2026-04-20

### Changed
- **Journey owns its habits.** Each journey creates its own fresh habit rows. When a journey is archived/completed, all its habits are closed (`active=false`). No reuse across journeys.
- **Replace mode:** Archive old journey + close all its habits → create fresh habits from template
- **Append mode:** Archive old journey, keep old habits active → add fresh template habits on top

### Fixed
- **completeJourney:** Now properly closes all active habits (`active=false, status='completed'`) when journey completes.
- **renewJourney:** Now snapshots old habits BEFORE completing, then clones them as fresh rows for the new cycle.
- **XP deduction on un-check:** Added `removeXp()` to `useXpStore`. Un-ticking a daily challenge or habit now properly deducts the XP. Previously XP was only added, never removed.

### Added
- **"Của Tôi" tab:** New tab on Journey page showing user's past journeys with "🔄 Bắt đầu lại" button.
- **Completion celebration UI:** When `completedDays >= targetDays`, ActiveJourneyPanel shows 🎉 banner with 3 actions: "Tiếp Tục Cycle N" (renew), "+21 Ngày" (extend), "✅ Hoàn Thành" (complete & close).

---

## v1.9.5 — 2026-04-20

### Fixed
- **Manage tab shows old habits after replace:** `useCustomHabits` fetched ALL habits from Supabase without filtering `active=true`. After replacing journey, deactivated habits still appeared in Quản Lý tab. Fix: added `.eq('active', true)` to the fetch query.

---

## v1.9.4 — 2026-04-19

### Fixed
- **Redirect loop:** Fixed a deep React batching race condition where `isLoadingJourney` flipped to `false` for exactly one render tick when authentication finished, before the journey fetch could begin. This caused the app to instantly redirect. Converted loading state to a synchronous derived variable to completely eliminate the race condition.

---

## v1.9.3 — 2026-04-19

### Added
- **Journey switch modal:** When switching to a new template, shows modal with 2 options: 🔄 Replace all habits / ➕ Append new habits. Warning: tick state resets, old journey saved to history.
- **lazyRetry wrapper:** Auto-reload on stale chunk errors after Vercel redeployment

### Fixed
- **History sort:** `started_at` (DATE, no time) → `created_at` (TIMESTAMPTZ) for newest-first ordering

---

## v1.9.2 — 2026-04-19

### Fixed
- **Redirect loop persists across reload:** `useRef` resets on page reload → redirect fires again every time. Fix: replaced with `sessionStorage` flag that survives reloads but clears on tab close
- **Cross-journey stale tick:** Switching journeys kept old "Hôm nay ✓" state from `useHabitStore` (localStorage). Fix: removed manual tick button entirely. Daily completion is now **auto-derived** from habit ticks (all habits done = day done)

### Changed
- Hero section now shows read-only status indicator (`X/Y habits` or `Hoàn thành! 🎉`) instead of clickable button

---

## v1.9.1 — 2026-04-19

### Fixed
- **firstTime redirect loop:** `AppShell` redirect fired on every render when `!activeJourney`, even when user was already on /journey. Fix: `useRef` + location check to fire redirect only ONCE
- **Signup → can't login:** DB trigger `handle_new_user` created profile WITHOUT username/email → `signIn` couldn't find profile by username. Fix: pass `username` in auth metadata + update trigger to extract it + change profile upsert `ON CONFLICT DO UPDATE`

### Added
- **Template habits seeded:** SQL migration seeds `program_habits` for all 5 templates (Buổi Sáng Kỷ Luật, Thói Quen Đọc Sách, Mindful Morning, Kỷ Luật Thể Chất, Deep Work 30 Ngày)
- **Month summary cards** in JourneyDetailPage: per-month progress rings with Hoàn thành/Bỏ qua/Còn lại stats

### Migration Required
- Run `data/migration_v1.9.0.sql` in Supabase SQL Editor

---

## v1.9.0 — 2026-04-19

### Fixed
- **Bug 1 — Templates show same 3 habits:** `ProgramBrowser` không join `program_habits` → `prog.habits = undefined`. Fix: `select('*, program_habits(*)')` + normalize
- **Bug 2 — Thêm habit thì mất defaults:** `useCustomHabits` fallback `DEFAULT_HABITS` cho authenticated user khi Supabase trả 0 rows → ghi đè khi user thêm 1 habit. Fix: authenticated user chỉ thấy real data từ DB, không fallback. Guest vẫn thấy demo habits
- **Bug 4 — Mood duplicate:** Cả TrackerPage lẫn HabitsPage đều render Mood section riêng. Fix: gộp thành 1 page duy nhất
- **Bug 5 — Weekly grid "mất data":** Label gây hiểu nhầm. Fix: thêm note "14 ngày gần nhất · lịch đầy đủ ở tab 📅"

### Changed (Page Consolidation)
- `src/pages/TrackerPage.jsx` — **Rewrite toàn bộ.** Absorb all HabitsPage features: per-habit tick, mood (1x), skip reason, calendar, weekly grid, habit manager. 4-tab navigation: ⚡ Hôm Nay | 📅 Lịch | 📊 Tuần | ⚙️ Quản Lý. Performance: `MonthCalendar` + `HabitManager` lazy-loaded, `PerHabitWeeklyGrid` memoized. Empty state CTA khi user chưa có habits
- `src/pages/HabitsPage.jsx` — Deprecated: redirect `/habits` → `/tracker`
- `src/components/Navbar.jsx` — Xóa "📋 Habits" khỏi nav (chỉ còn: Tracker, Focus, Lộ Trình, Team, Stats, Quiz, BXH)

### Added (Journey Dashboard)
- `src/pages/JourneyDetailPage.jsx` — **Rewrite thành full dashboard.** Thêm `JourneyCalendar` (month view, 🟢 all done / 🟡 partial / ⬜ missed / ⚫ outside range). Click ngày → `DayDetailModal` hiển thị: danh sách habits ✅/❌, tâm trạng, focus sessions với timestamp. Giữ stats grid, habit chips, mood distribution

---

## v1.8.1 — 2026-04-19

### Fixed (Critical)
- `src/hooks/useJourney.js` — **Bug:** Sau `startJourney()`, `JourneyContext.activeJourney` vẫn là `null` (stale) vì `useJourney` quản lý local state riêng. **Fix:** Rewrite toàn bộ `useJourney` để đọc `activeJourney` từ `JourneyContext` (single source of truth). Mọi mutation (`start/complete/renew/extend`) đều gọi `setActiveJourney` và `saveLocalJourney` để context + localStorage đồng bộ ngay lập tức → `useHabitLogs`, `useFocusTimer` pick up đúng `journey_id` ngay sau khi bắt đầu journey
- `src/pages/JourneyPage.jsx` — Detect `?firstTime=true` param, hiển thị welcome banner "Chọn lộ trình đầu tiên"

---

## v1.8.0 — 2026-04-19

### Added
- `src/contexts/JourneyContext.jsx` — Single source of truth cho `activeJourney`. Fetch 1 lần khi login, expose qua `useActiveJourney()`. Tránh redundant Supabase calls từ nhiều hooks
- `src/pages/JourneyDetailPage.jsx` — Full page `/journey/:id`: stats đầy đủ của 1 journey (hoàn thành % thực tế, focus hours, XP, mood distribution, danh sách ngày đã tick đủ)
- `data/migration_v1.6.2.sql` — ALTER TABLE focus_sessions ADD COLUMN journey_id (phần 4 — cần chạy thủ công trong Supabase)

### Changed
- `src/App.jsx` — Wrap với `JourneyProvider`. Thêm redirect `/journey?firstTime=true` nếu user login nhưng chưa có journey. Thêm route `/journey/:id`
- `src/hooks/useHabitLogs.js` — Import `useActiveJourney`, tự động pass `journey_id` vào mọi `habit_logs` write (upsert + auto-tick). Không cần truyền prop nữa
- `src/hooks/useFocusTimer.js` — Import `useActiveJourney`, dùng `useRef` pattern để pass `journey_id` vào `focus_sessions` insert
- `src/hooks/useCustomHabits.js` — `addHabit()` tự động gắn `journey_id: activeJourney?.id` khi tạo habit mới
- `src/components/journey/JourneyHistory.jsx` — Mỗi card clickable → navigate `/journey/:id`

### Flow hoàn chỉnh sau v1.8.0
```
User login → JourneyContext fetch activeJourney
  → Nếu không có journey → redirect /journey?firstTime=true
  → Mọi habit tick → habit_logs.journey_id = activeJourney.id
  → Mọi focus session → focus_sessions.journey_id = activeJourney.id  
  → Mọi habit tạo mới → habits.journey_id = activeJourney.id
  → Journey kết thúc → click trong History → /journey/:id → xem full stats
```

---

## v1.7.1 — 2026-04-19

### Fixed (Journey-Habit Integration)
- `src/hooks/useJourney.js` — `startJourney()` giờ INSERT habits từ template vào bảng `habits` của user (trước chỉ snapshot vào `journey_habits`). Habits được link `journey_id` ngay khi tạo
- `src/components/journey/ProgramBrowser.jsx` — `handleStart` giờ truyền `habits` array từ template khi gọi `onStart()`
- `src/pages/JourneyPage.jsx` — `handleStart` forward `habits` xuống `startJourney`. Thêm success toast "X habits mới được thêm" sau khi bắt đầu lộ trình
- `src/components/journey/ActiveJourneyPanel.jsx` — Progress ring/bar giờ tính từ **habit_logs thực tế**: đếm số ngày user tick đủ TẤT CẢ habits của lộ trình (thay vì đếm calendar days). Hiện "Hôm nay đã hoàn thành ✅" hoặc "Chưa tick đủ ⭕"

### Flow sau fix
```
1. User bấm "Bắt Đầu" template "Kỷ Luật Thể Chất"
2. → 3 habits (Tập luyện, Uống 2L, Ngủ trước 23h) tự xuất hiện trong /habits
3. → Mỗi ngày tick đủ 3 = +1 ngày hoàn thành
4. → Progress ring = (ngày tick đủ) / target_days
```

---

## v1.7.0 — 2026-04-19

### Added
- `src/components/ErrorBoundary.jsx` — Class component bắt mọi render error, hiện friendly fallback với "Thử lại" + "Về trang chủ" thay vì màn trắng
- `src/components/PageSkeleton.jsx` — Shimmer skeleton loading placeholder cho lazy-loaded pages
- `public/manifest.json` — PWA Web App Manifest: `display: standalone`, theme-color, icons, categories
- `index.html` — PWA meta tags: `theme-color`, `og:type/url/image/locale`, Twitter Card, `<link rel="manifest">`

### Changed
- `src/App.jsx` — Lazy load 8 pages (HabitsPage, FocusPage, TeamPage, DashboardPage, QuizPage, LeaderboardPage, FriendsPage, JourneyPage) với `React.lazy` + `Suspense`. LandingPage + TrackerPage vẫn eager (entry points). Mỗi page = 1 JS chunk riêng
- `src/App.jsx` — Wrap toàn bộ Routes trong `<ErrorBoundary>` 
- `src/App.jsx` — Thêm `<PageMeta />` component cập nhật `document.title` + `meta[description]` theo route
- `src/components/DailyChallenge.jsx` — Fix: thay hash-by-date bằng pick-by-streak-day. User mới (streak=0/1) sẽ thấy Challenge Ngày 1, không còn hiện "Final Boss"
- `src/pages/TrackerPage.jsx` — Pass `streak` prop vào `<DailyChallenge>`

### Bundle Impact (gzip)
| Before | After |
|--------|-------|
| 1 chunk ~350kB | Main 79kB + pages 0.6-9kB each (lazy loaded) |

---

## v1.6.2 — 2026-04-19

### Added
- `data/migration_v1.6.2.sql` — Tạo bảng `xp_logs` (UUID, amount, reason, meta JSONB, RLS) và `friendships` (requester/addressee FK, status enum, UNIQUE constraint, RLS). Enable Realtime cho `team_check_logs`, `team_members`, `progress`, `xp_logs`

### Fixed
- `GET /xp_logs 404` — bảng chưa tồn tại, cơ bản vì code sử dụng bảng từ trước khi migration chạy
- `GET /friendships 404` — tương tự, bảng chưa được tạo trong DB
- `cannot add postgres_changes callbacks for realtime:team-v3-*` — `team_check_logs` + `team_members` + `progress` chưa được add vào `supabase_realtime` publication

### Changed
- `src/hooks/useMoodSkip.js` — Xóa localStorage khỏi `useMoodLog` + `useSkipReasons`. Supabase-first, load từ DB khi login, in-memory cho guest, rollback khi lỗi
- `src/hooks/useCustomHabits.js` — Supabase-first. One-time migrate `vl_custom_habits` rồi wipe. Load DB on login, in-memory default habits cho guest, optimistic CRUD với rollback
- `src/hooks/useXpStore.js` — Thêm Supabase `xp_logs` làm primary. Migrate `vl_xp_store` 1 lần rồi wipe. async `addXp()` với rollback
- `src/hooks/useFocusTimer.js` — Xóa `vl_focus_sessions` + `vl_custom_habits` + `vl_habit_progress` direct reads. Sessions load từ Supabase on login. XP award qua Supabase trực tiếp (deduped). Habit auto-tick thông qua `CustomEvent focus:habit-tick` (loose coupling)
- `src/hooks/useFocusTimer.js` — Xóa `vl_focus_sessions` + `vl_custom_habits` + `vl_habit_progress` direct reads. Sessions load từ Supabase on login. XP award qua Supabase trực tiếp (deduped). Habit auto-tick thông qua `CustomEvent focus:habit-tick` (loose coupling)
- `src/hooks/useHabitLogs.js` — Xóa `saveLocal()` sau khi fetch từ DB. Wipe `vl_habit_progress` sau migration. Thêm event listener `focus:habit-tick` → auto-tick habit khi focus đủ duration target
- `src/pages/TrackerPage.jsx` — Import `useHabitLogs`, dùng `habitProg` thay direct LS read. Xóa `localStorage.removeItem(vl_habit_data / vl_habit_progress / vl_custom_habits)` khỏi `handleRenew` + `handleNewChallenge`
- `vl_focus_settings` giữ lại trong localStorage — đây là UI preference, không phải user data

### Technical Debt Resolved
- Toàn bộ **user data** bây giờ dùng Supabase làm primary. localStorage chỉ còn UI state flags & settings
- Xóa coupling trực tiếp giữa `useFocusTimer` → `vl_custom_habits` → `vl_habit_progress` (bộ 3 reads LS bị xóa)

---

## v1.6.1 — 2026-04-19

### Changed
- `src/hooks/useHabitStore.js` — Xóa localStorage làm primary storage cho habit data. Supabase `progress` table là sole source of truth khi đã login. Guest mode dùng in-memory state (reset khi refresh — acceptable). Migration vẫn chạy lần cuối để import `vl_habit_data` cũ rồi xoá sạch.
- Bump migration flag key từ `vl_migrated` sang `vl_migrated_v2` để force re-run migration cho user cũ
- Thêm rollback optimistic update khi Supabase toggle thất bại

### Removed
- `src/hooks/useHabitStore.js` — Xóa `localStorage.setItem(STORAGE_KEY, ...)` khỏi tất cả các đường ghi. `vl_habit_data` key không còn được write nữa.

### Technical Debt Resolved
- `vl_habit_data` (localStorage) → Supabase `progress`: data bền vững, cross-device, không còn mất streak khi đăng nhập trên thiết bị khác

---

## v1.6.0 — 2026-04-19

### Added
- `src/pages/JourneyPage.jsx` — Trang Lộ Trình 3 tab: Đang Chạy / Khám Phá / Lịch Sử
- `src/components/journey/ActiveJourneyPanel.jsx` — Progress ring SVG, habit snapshot chips, renew/extend/quit actions với confirm modal
- `src/components/journey/ProgramBrowser.jsx` — Grid 5 templates, category filter tabs, load từ Supabase (fallback local JSON)
- `src/components/journey/JourneyHistory.jsx` — List các journey đã kết thúc, status badges (completed/archived/extended)
- `src/components/journey/CustomJourneyModal.jsx` — Modal tự tạo lộ trình: tên, mô tả, duration picker (14/21/30/60/custom)
- `src/data/programs.json` — 5 system templates (Rule 14: dữ liệu tách khỏi component, dùng làm offline fallback)
- `src/styles/journey.css` — Full CSS: progress ring, program cards glassmorphism, tabs animated, status badges, modals
- Route `/journey` — thêm vào `App.jsx`
- `src/components/Navbar.jsx` — Nav link "🗺 Lộ Trình"

### Changed
- `src/pages/HabitsPage.jsx` — Journey banner: active = "Lộ Trình — Ngày X/Y", inactive = CTA "Chọn lộ trình →". Import `journey.css` + `react-router-dom Link`
- `src/pages/TrackerPage.jsx` — `WeekDots` nhận `journeyStart` prop từ `activeJourney.started_at` → dots anchor đúng ngày bắt đầu journey thật
- `src/components/CompletionModal.jsx` — Thêm Option C "🗺 Chọn Lộ Trình Mới" → navigate `/journey`. Dùng `useNavigate` thay inline handler
- `docs/PLAN.md` — Dashboard Journey Selector thêm vào Phase 6 backlog

### Fixed
- `JourneyPage.jsx` — Dùng `AuthModal` thay `alert()` khi guest click Bắt Đầu
- `JourneyPage.jsx` — Layout wrapper đồng nhất với các page khác: `min-height: 100vh; padding: 6rem 0 4rem; background: var(--bg-primary)` + `.container` div
- `src/styles/journey.css` — `.journey-page` chuẩn hóa theo `tracker-v2-page` pattern, thêm `.journey-page-inner` cho max-width 900px

---

## v1.5.0 — 2026-04-19

### Added
- `data/migration_v1.5.0.sql` — 5 bảng mới: `programs`, `program_habits`, `user_journeys`, `journey_habits`, `habit_logs` + RLS + indexes + 5 seed templates
- `src/hooks/useHabitLogs.js` — Thay thế `vl_habit_progress` localStorage bằng Supabase `habit_logs`. One-time silent migration. Giữ cùng format `habitProg` map để UI backward-compatible
- `src/hooks/useJourney.js` — Lifecycle management: start/complete/renew/extend journey. `ensureDefaultJourney()` auto-wrap habits cũ

### Changed
- `src/pages/HabitsPage.jsx` — Dùng `useHabitLogs` + `useJourney` thay vì đọc/ghi `vl_habit_progress` trực tiếp
- `docs/ARCHITECTURE.md` — Cập nhật hooks, Supabase tables, localStorage keys (v1.5.0)

### Technical Debt Resolved
- `vl_habit_progress` (localStorage) → `habit_logs` (Supabase): data bền vững, cross-device, có thể xem lại lịch sử

---

## v1.4.5 — 2026-04-19

### Added
- `src/data/quotes.json` — 30 câu trích dẫn động lực tiếng Việt (Rule 14: tách ra khỏi component)
- `src/pages/HabitsPage.jsx` — Daily motivational quote card xoay theo ngày trong năm
- `src/pages/HabitsPage.jsx` — Header stat cards: Habits count 🎯 + Ngày còn lại ⏳
- `src/pages/HabitsPage.jsx` — Tab "📊 Theo Tuần": PerHabitWeeklyGrid 14 ngày per-habit
- `src/pages/HabitsPage.jsx` — Per-habit streak 🔥N trong today list
- `src/pages/HabitsPage.jsx` — Counter badge X/N habits done hôm nay
- `src/pages/HabitsPage.jsx` — `computeHabitStreak()` + `dayPct()` helpers

### Changed
- `src/pages/HabitsPage.jsx` — Weekly grid: gradient cell (partial day = tint màu habit)
- `src/pages/HabitsPage.jsx` — Weekly grid: header row % completion toàn bộ habits per-day

---

## v1.4.0 — 2026-04-18

### Added
- `data/migration_v1.4.0.sql` — Thêm cột `action`, `status`, `cycle_count`, `conquered_at` vào bảng `habits`
- `src/data/habits.json` — Thêm field `action` cho 3 default habits
- `src/components/LoginNudgeModal.jsx` — Bottom sheet nhắc đăng ký cho guest sau ngày 1
- `src/styles/completion.css` — Certificate styles (seal, divider, dual CTA options)

### Changed
- `src/hooks/useCustomHabits.js` — Thêm `conquestHabit()`, `renewHabit()`, computed `activeHabits`, `conqueredHabits`
- `src/components/HabitManager.jsx` — Thêm field `action` (hành động cụ thể) vào form
- `src/components/CompletionModal.jsx` — Redesign thành Certificate modal: 2 CTA (Gia Hạn / Thử Thách Mới)
- `src/pages/HabitsPage.jsx` — Thêm Celebration banner + Conquered Habits section + LoginNudgeModal
- `src/pages/TrackerPage.jsx` — Wire `onRenew` / `onNewChallenge` cho CompletionModal

---


### Added
- `src/hooks/useTeam.js` — Team hook: fetch N members (batch), realtime subscription, create/join/leave team
- `src/hooks/useTeamCheck.js` — Check logic: week-2 lock enforcement, submit team_check_logs, validate per-user
- `src/hooks/useTeamRules.js` — Rules hook: propose rules, agree/reject flow, status computation (pending→active/rejected)
- `src/components/team/TeamMemberCard.jsx` — Per-member card: week badge, 7-day mini heatmap, lock state, check button
- `src/components/team/TeammateCheckPanel.jsx` — Done/Fail modal: required reason on fail, realtime feedback
- `src/components/team/JoinSyncModal.jsx` — Week sync modal: restart vs continue choice when joining mid-program
- `src/components/team/TeamRules.jsx` — Rules section: list rules, TeamRuleCard with agree/reject UI, propose form
- `docs/supabase_team_v3.sql` — Full DB migration: 5 new tables, indexes, RLS policies, realtime publication
- `vercel.json` — SPA routing config for Vercel deploy

### Changed
- `src/pages/TeamPage.jsx` — Full refactor: N-member grid (Duo/Trio/Squad), all new hooks + components wired, demo mode with 3 mock members
- `src/styles/team.css` — Full rewrite: N-member responsive grid, member card styles, check panel modal, join sync modal, rules section

### Database Schema (run `docs/supabase_team_v3.sql`)
- `teams` — added `name`, `max_members`, `created_by`, `activated_at`
- `team_members` — junction table (N per team), `role`, `week_sync`
- `user_programs` — per-user 21-day journey, `started_at`, `current_week`, `reset_count`
- `team_check_logs` — accountability checks, UNIQUE(team_id, checked_id, date)
- `team_rules` — reward/punishment rules with trigger types
- `team_rule_agreements` — per-member approval flow

---

## v2.0.0-auth — 2026-04-15

### Added
- `src/lib/supabase.js` — Singleton Supabase client, safe fallback when keys not set
- `.env.local.example` — Template for Supabase credentials
- `src/contexts/AuthContext.jsx` — Full auth context: signIn, signUp, Google OAuth, signOut, profile
- `src/components/AuthModal.jsx` — Login / Register / Google tabs with error UX
- `src/styles/auth.css` — Modal, input, avatar, user menu dropdown styles
- `src/pages/FriendsPage.jsx` — Friend search, send/accept/decline requests, friend list
- `src/styles/friends.css` — Friends page styles

### Changed
- `src/hooks/useHabitStore.js` — Dual mode: Supabase when authenticated, localStorage when guest, auto-migration on first login
- `src/components/Navbar.jsx` — Avatar + dropdown menu when logged in, login button when guest
- `src/pages/TeamPage.jsx` — Real Supabase create/join team, realtime subscription, reactions to DB, auth wall + demo bypass

---

## v1.1.0 — 2026-04-14

### Added
- `src/hooks/useXpStore.js` — XP/Level system: 6 levels, localStorage, milestone awards
- `src/components/XpBar.jsx` — Compact (Navbar) + full card (TrackerPage) XP display
- `src/components/DailyChallenge.jsx` — 21-challenge pool, date-seeded daily challenge, +20 XP on complete
- `src/pages/QuizPage.jsx` — 10 MCQ questions (brain science), route `/quiz`, XP reward
- `src/hooks/useNotifications.js` — Browser Notification API, schedule daily reminder
- `src/components/NotificationSettings.jsx` — Toggle + time picker in TrackerPage
- `src/pages/LeaderboardPage.jsx` — 3 tabs (weekly/monthly/all-time), podium top 3, mock + real user, route `/leaderboard`
- `src/components/TestimonialsSection.jsx` — 4 testimonial cards on LandingPage

### Changed
- `src/components/Navbar.jsx` — Added Quiz, Leaderboard links + compact XpBar
- `src/components/TrackerSection.jsx` — +10 XP per daily check (deduped by date)
- `src/pages/TrackerPage.jsx` — XP milestone toast + browser notification scheduling
- Fix countdown: localStorage-persisted 7-day rolling window

---

## v1.0.0 — 2026-04-13

### Added
- Full design system: CSS tokens, glassmorphism, dark mode, animations (`global.css`)
- `src/components/Navbar.jsx` — Sticky + mobile burger menu
- `src/components/HeroSection.jsx` — Typewriter, floating orbs, dual CTA, stats counter
- `src/components/ContentSections.jsx` — Problem toggle + Knowledge 3-cards + MiniLesson popup
- `src/components/RoadmapSection.jsx` — Interactive 3-week timeline with task expansion
- `src/components/TrackerSection.jsx` — Habit table T2→CN × 3 weeks (PDF-accurate)
- `src/components/ReverseSection.jsx` — Split-screen old vs new approach
- `src/components/PricingSection.jsx` — Pricing card + live countdown timer
- `src/pages/LandingPage.jsx` — 7-section landing assembly
- `src/pages/TrackerPage.jsx` — 28-day heatmap + day-of-week bar chart + insights
- `src/pages/TeamPage.jsx` — Team Mode: invite code, mock teammate, emoji reactions, auth wall
- `src/pages/DashboardPage.jsx` — Analytics dashboard
- `src/hooks/useHabitStore.js` — localStorage: streak, badge, completion tracking
- `src/App.jsx` — BrowserRouter + 4 routes
- `README.md`, `CHANGELOG.md`, SEO meta tags in `index.html`
