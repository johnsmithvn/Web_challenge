import { useState } from 'react';
import { NECESSITY_META, Segmented } from './parts';
import AppIcon from '../AppIcon';

const ICONS = [
  'bowlFood', 'gas', 'house', 'shopping', 'squares', 'firstAid', 'game', 'graduation',
  'gift', 'bank', 'dots', 'briefcase', 'trophy', 'deviceMobile', 'trend', 'handCoins', 'refresh',
];
const PALETTE = ['#e2a94e', '#5aa3dd', '#48b3a2', '#e07f93', '#b47fd8', '#7fc060', '#e58159', '#6fd0c6', '#dd76bd', '#9184d9', '#8b91a6'];
const makeKey = (prefix) => `${prefix}-${crypto.randomUUID()}`;
const needCopy = {
  must: 'Không trả thì mất chỗ ở, mất việc, bị phạt. Tiền nhà, điện nước, trả góp, xăng đi làm.',
  need: 'Phải chi nhưng số tiền tùy mình. Ăn uống hằng ngày, thuốc, quần áo cơ bản.',
  want: 'Không chi cũng không ảnh hưởng gì. Quán nước, giải trí, đồ công nghệ mới.',
};

export default function CatsScreen({ fin, nav }) {
  const [editor, setEditor] = useState(null);
  const edit = (group, kind) => setEditor(current => current?.group.key === group.key ? null : { group, kind });

  return (
    <div className="fin-cats">
      <div className="fin-viewbar">
        <Segmented options={[
          { value: 'cats', label: 'Danh mục', hint: 'sửa được', icon: 'tree' },
          { value: 'fields', label: 'Schema', hint: 'tham chiếu', icon: 'table' },
        ]} value={nav.catsTab} onChange={nav.setCatsTab} />
      </div>

      {nav.catsTab === 'cats' ? <CategoryPanel fin={fin} editor={editor} onEdit={edit} onClose={() => setEditor(null)} /> : <SchemaPanel />}
    </div>
  );
}

function CategoryPanel({ fin, editor, onEdit, onClose }) {
  return <div className="fin-taxonomy">
    <div className="fin-explainer-grid">
      <Explainer icon="pencil" title="Bộ này sửa được">
        Đây là bộ mặc định app dựng sẵn, không phải bộ khóa. Nhóm cha đổi được tên, màu, icon và ẩn đi; chỉ không xóa được vì báo cáo cũ vẫn trỏ vào khóa đó. Danh mục con thêm, sửa, xóa tự do.
      </Explainer>
      <Explainer icon="calculator" title="Mức cắt được suy từ danh mục">
        Ba bậc trả lời một câu: thiếu tiền thì cắt khoản nào trước. Mỗi nhóm và mục con có một bậc mặc định, bạn không phải chọn khi nhập, chỉ sửa ở giao dịch nào thấy sai. Xăng đi làm là Phải trả, ăn ngoài là Cắt bớt được, quán nước là Không bắt buộc.
      </Explainer>
      <Explainer icon="arrowsClockwise" title="Danh mục không phải định kỳ">
        Danh mục trả lời “tiền dùng vào việc gì”. Định kỳ trả lời “giao dịch được tạo ra lúc nào”. Netflix thuộc Dịch vụ đăng ký và có thêm quy tắc lặp, không phải hai khoản ghi riêng.
      </Explainer>
    </div>

    <div className="fin-taxonomy-grid">
      {fin.cats.expenseGroups.map(group => <CategoryCard key={group.key} group={group} necessityKey={fin.cats.necessityByCat[group.key]} editing={editor?.group.key === group.key} onEdit={() => onEdit(group, 'expense')}>
        {editor?.group.key === group.key && <CategoryEditor key={group.key} group={group} kind="expense" fin={fin} onClose={onClose} />}
      </CategoryCard>)}
      <div className="fin-closed-group">
        <AppIcon name="lock" size={20} />
        <strong>{fin.cats.expenseGroups.length} nhóm cha cố định</strong>
        <span>Giữ khóa báo cáo ổn định; hãy thêm mục con thay vì tạo nhóm cha mới.</span>
      </div>
    </div>

    <section className="fin-taxonomy-band">
      <div className="fin-taxonomy-band__head"><div><h2>Nguồn thu - bộ danh mục riêng</h2><p>Thu không bao giờ dùng chung danh mục với chi.</p></div></div>
      <div className="fin-income-cards">
        {fin.cats.incomeGroups.map(group => <CategoryCard key={group.key} group={group} income editing={editor?.group.key === group.key} onEdit={() => onEdit(group, 'income')}>
          {editor?.group.key === group.key && <CategoryEditor key={group.key} group={group} kind="income" fin={fin} onClose={onClose} />}
        </CategoryCard>)}
      </div>
    </section>

    <section className="fin-taxonomy-band">
      <div className="fin-taxonomy-band__head"><div><h2>Ba bậc cắt được - trục thứ hai, không phải danh mục</h2><p>Cắt gì trước khi hết tiền.</p></div></div>
      <div className="fin-necessity-cards">
        {Object.entries(NECESSITY_META).map(([key, meta], index) => <div key={key} className="fin-necessity-card" style={{ '--c': meta.color }}>
          <div><AppIcon name={key === 'must' ? 'lock' : key === 'need' ? 'checkCircle' : 'sparkle'} size={16} /><strong>{meta.label}</strong><span>{[50, 30, 20][index]}% hạn mức</span></div>
          <p>{needCopy[key]}</p>
        </div>)}
      </div>
      <div className="fin-rule-chips">
        <Rule icon="sparkle">Suy từ danh mục con, không hỏi user</Rule>
        <Rule icon="pencil">Sửa được từng giao dịch khi thấy sai</Rule>
        <Rule icon="calculator">Mặc định theo tỉ lệ 50 / 30 / 20</Rule>
        <Rule icon="scissors">Trả lời được: cắt gì trước khi hết tiền</Rule>
      </div>
    </section>

    <section className="fin-taxonomy-band fin-saving-explainer">
      <div className="fin-taxonomy-band__head"><div><h2><AppIcon name="piggyBank" size={18} /> Để dành - loại thứ ba, không phải danh mục</h2></div></div>
      <p>Gửi tiết kiệm không phải chi vì tiền vẫn của bạn, và cũng không phải thu. Nếu nhét nó vào một danh mục chi thì tháng để dành nhiều sẽ trông như tháng tiêu hoang. Vì vậy Để dành là một giá trị của trường loại, ngang hàng với Chi và Thu, rồi trỏ tới một quỹ thay vì danh mục.</p>
      <div className="fin-rule-chips">
        <Rule icon="chartDonut">Không vào donut chi tiêu</Rule>
        <Rule icon="trend">Không trừ vào hạn mức tháng</Rule>
        <Rule icon="wallet">Ghi vào tiến độ quỹ, không vào tổng chi</Rule>
        <Rule icon="arrowsClockwise">Gửi được theo định kỳ</Rule>
        <Rule icon="trend">Lãi tiết kiệm ghi là Thu</Rule>
        <Rule icon="refresh">Rút quỹ không phải thu nhập</Rule>
      </div>
      <div className="fin-lock-grid">
        <LockCard icon="lock" title="Mềm - mặc định">Rút lại một chạm, không hỏi gì thêm. Đủ cho phần lớn người dùng vì thứ hiệu quả nhất là làm tiền biến mất khỏi tầm mắt.</LockCard>
        <LockCard icon="clock" title="Có kỳ hạn - ma sát">Đặt ngày mở. Muốn rút sớm phải gửi yêu cầu và chờ 48 giờ. Không cấm, chỉ chèn đủ thời gian để cơn bốc đồng nguội đi.</LockCard>
        <LockCard icon="bank" title="Ngoài app - khóa thật">Gắn với sổ tiết kiệm thật. App chỉ hiện cái giá của việc rút sớm bằng số tiền lãi có thể mất.</LockCard>
      </div>
      <small>App không giữ tiền nên không hứa “khóa” nếu không khóa được. Phần mềm chỉ tạo ma sát và làm rõ số tiền thực sự có thể tiêu.</small>
    </section>
  </div>;
}

function Explainer({ icon, title, children }) {
  return <article className="fin-explainer"><AppIcon name={icon} size={19} /><div><strong>{title}</strong><p>{children}</p></div></article>;
}

function Rule({ icon, children }) {
  return <span><AppIcon name={icon} size={13} />{children}</span>;
}

function LockCard({ icon, title, children }) {
  return <article><AppIcon name={icon} size={17} /><strong>{title}</strong><p>{children}</p></article>;
}

function CategoryCard({ group, income = false, necessityKey, editing = false, onEdit, children }) {
  const necessity = NECESSITY_META[group.necessity || necessityKey] || NECESSITY_META.need;
  return <article className={`fin-category-card${group.hidden ? ' is-hidden' : ''}${editing ? ' is-editing' : ''}`} style={{ '--c': group.color }}>
    <div className="fin-category-card__head">
      <span className="fin-category-card__icon"><AppIcon name={group.icon} size={17} weight="duotone" /></span>
      <span className="fin-category-card__title"><strong>{group.label}</strong><small>{group.key}</small></span>
      <span className="fin-category-card__tag">{income ? (group.nature === 'fixed' ? 'Cố định' : 'Biến đổi') : necessity.label}</span>
      <button type="button" className={`fin-icon-btn${editing ? ' is-active' : ''}`} onClick={onEdit} title={`Sửa ${group.label}`} aria-label={`Sửa ${group.label}`}><AppIcon name={editing ? 'x' : 'pencil'} size={14} /></button>
    </div>
    {!editing && <div className="fin-category-card__subs">
      {(group.subs || []).map(sub => <span key={sub.key}>{sub.label}</span>)}
      <button type="button" onClick={onEdit}><AppIcon name="plus" size={11} /> thêm</button>
    </div>}
    {children}
    {group.hidden && <span className="fin-category-card__hidden"><AppIcon name="eyeOff" size={12} /> Đang ẩn</span>}
  </article>;
}

function CategoryEditor({ group, kind, fin, onClose }) {
  const [label, setLabel] = useState(group.label || '');
  const [color, setColor] = useState(group.color || '#9184d9');
  const [icon, setIcon] = useState(group.icon || 'package');
  const [hidden, setHidden] = useState(Boolean(group.hidden));
  const [necessity, setNecessity] = useState(group.necessity || fin.cats.necessityByCat[group.key] || 'need');
  const [nature, setNature] = useState(group.nature || 'variable');
  const [subs, setSubs] = useState((group.subs || []).map(item => ({ ...item })));
  const [newSub, setNewSub] = useState('');
  const [saving, setSaving] = useState(false);

  const removeSub = (index) => setSubs(rows => rows.filter((_, i) => i !== index));
  const appendSub = () => {
    const label = newSub.trim();
    if (!label) return;
    setSubs(rows => [...rows, { key: makeKey(`${group.key}.sub`), label, necessity: kind === 'expense' ? necessity : undefined }]);
    setNewSub('');
  };
  const save = async (event) => {
    event.preventDefault();
    if (!label.trim()) return;
    setSaving(true);
    const cleanSubs = subs.filter(sub => sub.label.trim()).map(sub => ({
      ...sub, label: sub.label.trim(), ...(kind === 'expense' ? { necessity: sub.necessity || necessity } : {}),
    }));
    const saved = await fin.upsertCategoryOverride(group.key, kind, {
      label: label.trim(), color, icon, hidden, necessity: kind === 'expense' ? necessity : null,
      nature, subs: cleanSubs,
    });
    setSaving(false);
    if (saved) onClose();
  };

  // Thứ tự: danh tính nhóm (tên → màu → icon → mặc định) rồi mới tới danh mục con,
  // cuối cùng là ẩn/hiện. Bản cũ nhét ô Tên nhóm xuống giữa, sau cả khối thêm mục con.
  return <form className="fin-category-inline-editor" onSubmit={save}>
      <label className="fin-field"><span>Tên nhóm</span><input className="fin-input" value={label} onChange={e => setLabel(e.target.value)} autoFocus required /></label>
      <fieldset className="fin-swatches"><legend>Màu nhận diện</legend>{PALETTE.map(hex => <button key={hex} type="button" aria-label={`Chọn màu ${hex}`} className={color === hex ? 'is-active' : ''} style={{ background: hex }} onClick={() => setColor(hex)} />)}</fieldset>
      <div className="fin-field"><span>Biểu tượng</span>
        {/* Select cũ chỉ liệt kê TÊN icon ("squares", "dots") — không ai đoán được ra hình gì.
            Lưới nút dùng lại .fin-iconpick của form hóa đơn: thấy hình, màu chạy theo màu nhóm. */}
        <div className="fin-iconpick" style={{ '--c': color }}>
          {ICONS.map(name => <button type="button" key={name} title={name} aria-label={`Chọn icon ${name}`}
            aria-pressed={icon === name} className={icon === name ? 'is-active' : ''} onClick={() => setIcon(name)}>
            <AppIcon name={name} size={16} weight="fill" />
          </button>)}
        </div>
      </div>
      <div className="fin-inline-editor__grid">
        {kind === 'expense' && <label className="fin-field"><span>Mức mặc định của nhóm</span><select className="fin-input" value={necessity} onChange={e => setNecessity(e.target.value)}>{Object.entries(NECESSITY_META).map(([key, meta]) => <option key={key} value={key}>{meta.label}</option>)}</select></label>}
        <label className="fin-field"><span>Tính chất mặc định</span><select className="fin-input" value={nature} onChange={e => setNature(e.target.value)}><option value="variable">Biến đổi theo lần</option><option value="fixed">Cố định / định kỳ</option></select></label>
      </div>

      <div className="fin-field">
        <span>Danh mục con {subs.length > 0 && <small>· {subs.length}</small>}</span>
        {subs.length > 0 && <div className="fin-inline-subchips">{subs.map((sub, index) => <span key={sub.key}>{sub.label || 'Mục mới'}<button type="button" onClick={() => removeSub(index)} aria-label={`Xóa ${sub.label || 'mục mới'}`}><AppIcon name="x" size={9} /></button></span>)}</div>}
        <span className="fin-inline-add">
          <input className="fin-input" value={newSub} onChange={e => setNewSub(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); appendSub(); } }} placeholder="Thêm mục con — vd. Sửa chữa & bảo hành" aria-label="Thêm danh mục con" />
          <button type="button" className="fin-btn fin-btn--secondary fin-btn--sm" onClick={appendSub} disabled={!newSub.trim()}>Thêm</button>
        </span>
      </div>

      <div className="fin-inline-editor__hide">
        <label><input type="checkbox" checked={hidden} onChange={e => setHidden(e.target.checked)} /><AppIcon name={hidden ? 'eyeOff' : 'eye'} size={13} /> {hidden ? 'Hiện nhóm này' : 'Ẩn nhóm này'}</label>
        <small>Ẩn nhóm thì nó biến khỏi form nhập mới, nhưng giao dịch cũ vẫn giữ nguyên khóa và tiếp tục xuất hiện trong báo cáo.</small>
      </div>
      <div className="fin-inline-editor__actions">
        <button type="button" className="fin-btn fin-btn--ghost fin-btn--sm" onClick={onClose}>Hủy</button>
        <button type="submit" className="fin-btn fin-btn--secondary fin-btn--sm" disabled={saving || !label.trim()}>{saving ? 'Đang lưu...' : 'Xong'}</button>
      </div>
    </form>
  ;
}

const transactionFields = [
  ['1', 'Số tiền', 'amount', 'BIGINT > 0', 'Mọi tổng và biểu đồ; chỉ nhận số nguyên VND.'],
  ['1', 'Ngày', 'occurred_at', 'DATE', 'Khóa thời gian của mọi báo cáo; không có bảng tổng theo tháng.'],
  ['1', 'Loại', 'type', 'expense / income / saving', 'Chỉ expense vào tổng chi; saving đứng riêng.'],
  ['1', 'Nhóm', 'category_id', '11 nhóm chi hoặc 7 nguồn thu', 'Bắt buộc với chi/thu, để dành không dùng nhóm.'],
  ['2', 'Danh mục con', 'subcategory_id', 'TEXT', 'Bóc tách xăng, gửi xe, quán nước trong cùng nhóm.'],
  ['1', 'Trả bằng', 'source_card_id + source_kind', 'UUID + GENERATED', 'NULL là tiền có sẵn; có id là thẻ tín dụng.'],
  ['3', 'Không tính chi', 'excluded', 'BOOLEAN', 'Chỉ trả nợ gốc và trả sao kê; vẫn có trên dòng thời gian.'],
  ['2', 'Mức cắt được', 'necessity', 'must / need / want', 'Cơ sở cho giới hạn 50/30/20.'],
  ['3', 'Tính chất', 'is_fixed', 'BOOLEAN', 'Phân biệt phần chi cố định và biến đổi.'],
  ['2', 'Tiêu đề', 'note', 'TEXT', 'Tìm kiếm và gợi ý nhập lần sau.'],
  ['3', 'Nơi / người nhận', 'merchant', 'TEXT', 'Xem nơi nào tiêu nhiều và đăng ký quên hủy.'],
  ['3', 'Chi tiết món', 'items', 'JSONB[]', 'Lưu tên, số lượng và giá cho hóa đơn nhiều món.'],
  ['3', 'Ảnh hóa đơn', 'attachments', 'JSONB[]', 'Đối soát, bảo hành và hoàn tiền.'],
  ['3', 'Tag', 'finance_transaction_tags', 'Bảng nối', 'Cắt ngang danh mục mà không nhét mảng id vào giao dịch.'],
  ['auto', 'Hóa đơn', 'bill_id + bill_period', 'UUID + YYYY-MM', 'Kỳ tách khỏi ngày trả, suy từ mốc kỳ gần ngày trả nhất; sửa được ở form sửa giao dịch. Chặn trả trùng kỳ.'],
  ['auto', 'Thu định kỳ', 'income_rule_id + income_period', 'UUID + YYYY-MM', 'Bấm Đã nhận sinh đúng một giao dịch thu mỗi kỳ.'],
  ['auto', 'Khoản vay', 'loan_id + loan_period + loan_part', 'UUID + kỳ + interest/principal', 'Tách lãi được tính chi khỏi gốc bị excluded.'],
  ['auto', 'Sao kê thẻ', 'card_id + card_period', 'UUID + YYYY-MM', 'Trả sao kê bị excluded vì khoản quẹt đã tính lúc phát sinh.'],
  ['quỹ', 'Quỹ / chiều tiền', 'saving_goal_id + saving_dir', 'UUID + in/out', 'Cập nhật nơi gửi và tiến độ quỹ; rút không phải thu.'],
  ['link', 'Liên kết nguồn', 'task_id + inbox_item_id', 'UUID', 'Mở lại Task hoặc ghi chú Inbox đã tạo khoản này.'],
  ['auto', 'Dấu thời gian', 'created_at + updated_at', 'TIMESTAMPTZ', 'Theo dõi lúc bản ghi được tạo và sửa.'],
];

const schemaSections = [
  ['Danh mục và hạn mức', 'finance_category_overrides + finance_budgets', [
    ['Khóa nhóm', 'category_id + kind', 'TEXT', 'Chỉ nhận đúng 11 nhóm chi hoặc 7 nguồn thu; user không tạo parent mới.'],
    ['Tùy biến', 'label, color, icon, hidden', 'TEXT / BOOLEAN', 'Đổi cách hiển thị mà không làm vỡ giao dịch cũ.'],
    ['Quy tắc mặc định', 'necessity, nature, subs', 'ENUM + JSONB[]', 'Mục con có khóa, nhãn và mức cần thiết riêng.'],
    ['Hạn mức nhóm', 'limit_amount', 'BIGINT >= 0', 'Một dòng mỗi user + nhóm chi; tổng hạn mức là tổng 11 dòng.'],
  ]],
  ['Hóa đơn và nghĩa vụ', 'finance_bills', [
    ['Nhận diện', 'name, provider, customer_code', 'TEXT', 'Tên user đọc; provider và mã khách hàng để phân biệt.'],
    ['Danh mục đích', 'category_id, subcategory_id', 'TEXT bắt buộc', 'Giao dịch sinh ra kế thừa; không tạo nhóm riêng.'],
    ['Lịch', 'rrule, due_day', 'JSONB + 1..31', 'Chu kỳ chuẩn hóa và ngày đến hạn trong tháng.'],
    ['Nhiều tháng một lần', 'rrule.every, anchor_date', '1/2/3/6/12 + DATE', 'anchor_date quyết định THÁNG nào tới lượt; ngày trong tháng vẫn theo due_day.'],
    ['Kỳ đang tính', '(không lưu)', 'billCycle()', 'Tháng không tới lượt thì nhảy tới kỳ kế — trừ khi kỳ vừa qua chưa trả, lúc đó bám lại nó để báo quá hạn.'],
    ['Số tiền', 'amount_mode, amount', 'fixed/ask + BIGINT', 'ask bắt nhập lại khi thanh toán; fixed điền sẵn.'],
    ['Số kỳ', 'term_total, term_offset, term_done, finished_at', 'INT + DATE', 'term_offset là kỳ đã trả trước khi dùng app (user nhập); term_done = offset + số giao dịch, trigger tự tính. Đủ kỳ cuối thì kết thúc vĩnh viễn.'],
    ['Bỏ kỳ', 'skipped_periods', 'JSONB[]', 'Không sinh giao dịch cho kỳ bị bỏ, kỳ sau vẫn hoạt động.'],
  ]],
  ['Thẻ tín dụng', 'finance_cards', [
    ['Nhận diện', 'name, bank, last4', 'TEXT', 'Bốn số cuối phân biệt hai thẻ cùng ngân hàng.'],
    ['Hạn mức', 'credit_limit', 'BIGINT', 'Mẫu số của phần đã sử dụng.'],
    ['Hai mốc ngày', 'statement_day, due_day', 'INT 1..31', 'Ngày chốt và ngày đến hạn là hai khái niệm khác nhau.'],
    ['Điều khoản', 'grace, annual_fee, cash_advance_fee, min_pct', 'Số', 'Tính lợi ích hoãn trả và cảnh báo phí.'],
    ['Dư nợ / sao kê', '(không lưu tổng)', 'Query giao dịch', 'Tính lại từ source_card_id và card_id theo kỳ.'],
  ]],
  ['Khoản vay', 'finance_loans', [
    ['Khoản gốc', 'principal', 'BIGINT > 0', 'Dư nợ còn lại tính từ gốc trừ giao dịch phần principal.'],
    ['Lãi và kiểu trả', 'rate, kind', 'NUMERIC + interest/amort', 'Quyết định lịch tách lãi và gốc.'],
    ['Tiến độ', 'term, done, pay_day', 'INT', 'Kỳ n/N và ngày trả hằng tháng.'],
    ['Mốc thời gian', 'opened_at, due_at, finished_at', 'DATE', 'Theo dõi mở vay, hạn tất toán và hoàn thành.'],
  ]],
  ['Quỹ tiết kiệm', 'finance_saving_goals', [
    ['Tên và mục tiêu', 'name, goal', 'TEXT + BIGINT', 'Goal là mẫu số tiến độ; không có cột số dư.'],
    ['Mức khóa', 'lock_mode, lock_until', 'soft/term/external + DATE', 'Term tạo ma sát 48 giờ khi rút sớm; tới ngày mở thì xử lý như mềm.'],
    ['Chưa gửi ngân hàng', 'in_wallet', 'BOOLEAN', 'Giải thích tiền quỹ đang ở tài khoản thường.'],
    ['Gửi định kỳ', 'auto_deposit', '{amount, day}', 'Kế hoạch nhắc gửi mỗi tháng, không tự chuyển tiền.'],
    ['Hành vi rút', 'withdrawal_request, break_count', 'JSONB + INT', 'Yêu cầu đang chờ và số lần phá quỹ.'],
    ['Hoàn thành', 'closed_at', 'TIMESTAMPTZ', 'Rời danh sách chính nhưng giữ lịch sử.'],
  ]],
  ['Nơi gửi tiền', 'finance_deposits', [
    ['Thuộc quỹ', 'fund_id', 'FK cùng user', 'Số dư quỹ = SUM(amount) của các nơi gửi chưa tất toán.'],
    ['Nhận diện', 'name, bank, account_no', 'TEXT', 'Sổ/tài khoản và thông tin đối chiếu.'],
    ['Tiền và lãi', 'amount, rate', 'BIGINT + NUMERIC', 'Tổng đang gửi, lãi năm và lãi suất gia quyền.'],
    ['Kỳ hạn', 'term, opened_at, matures_at', 'INT + DATE + GENERATED DATE', 'Ngày đáo hạn tự tính, còn 45 ngày thì cảnh báo.'],
    ['Tất toán', 'closed_on', 'DATE', 'Ẩn khỏi số dư hiện tại nhưng giữ lịch sử.'],
  ]],
  ['Thu định kỳ', 'finance_income_rules', [
    ['Nguồn thu', 'category_id', '7 khóa nguồn thu', 'Không dùng chung danh mục chi.'],
    ['Lịch nhận', 'rrule, due_day', 'JSONB + INT', 'Tới ngày hiện nút Đã nhận, không tự ghi.'],
    ['Số tham chiếu', 'amount', 'BIGINT > 0', 'Chỉ điền sẵn, không làm mẫu số của ngân sách.'],
    ['Đã nhận', 'received_periods', 'JSONB[]', 'Chặn ghi trùng một kỳ.'],
  ]],
  ['Nhập nhanh', 'finance_shortcuts', [
    ['Đích', 'category_id, subcategory_id', 'TEXT', 'Bỏ qua bước chọn nhóm.'],
    ['Mức cắt được', 'necessity', 'must/need/want', 'Kế thừa hoặc ghi đè theo mục con.'],
    ['Mức hay nhập', 'recent_amounts', 'JSONB[]', 'Gợi ý ba số gần đây; không có số tiền cố định.'],
    ['Xếp hạng', 'use_count, sort_order', 'INT', 'Shortcut dùng nhiều được đẩy lên trước.'],
    ['Trả bằng', 'source_card_id', 'UUID hoặc NULL', 'Nhớ nguồn thanh toán khi cần.'],
  ]],
];

function SchemaPanel() {
  const scopes = [
    ['Tổng quan', 'Kỳ đang chọn', 'Tháng vẽ theo ngày, năm vẽ theo tháng; cùng một truy vấn khác độ phân giải.'],
    ['Giao dịch', 'Cùng kỳ với Tổng quan', 'Một state kỳ duy nhất nên danh sách luôn giải thích đúng số trên Tổng quan.'],
    ['Ngân sách', 'Luôn tháng đang chạy', 'Đây là công cụ điều khiển hiện tại, không phải báo cáo quá khứ.'],
    ['Hóa đơn, thẻ, vay', 'Luôn tháng đang chạy', 'Nghĩa vụ sắp tới không phụ thuộc kỳ báo cáo.'],
    ['Thống kê', 'Khoảng riêng 3 / 6 / 12 tháng', 'Dùng để đặt nhiều kỳ cạnh nhau nên có bộ chọn riêng.'],
  ];
  const principles = [
    ['tree', 'Nhóm cha đóng, mục con mở', '11 nhóm chi và 7 nguồn thu tách biệt. Mục con để user tự thêm.'],
    ['lightning', 'Shortcut không nhớ số cố định', 'Nó nhớ đích và các mức hay dùng, số tiền vẫn được xác nhận mỗi lần.'],
    ['receipt', 'Hóa đơn là lịch, danh mục là mục đích', 'Mỗi lần trả tạo một giao dịch gắn bill_id nên không có bảng lịch sử riêng.'],
    ['checkCircle', 'App không trả tiền hộ', 'Tới ngày chỉ nhắc; user bấm và chọn ngày đã trả thật.'],
    ['piggyBank', 'Để dành không phải chi', 'Tiền gửi và rút thay đổi quỹ, không làm méo phân bổ chi.'],
    ['tray', 'Inbox và Task có dấu vết', 'Giao dịch giữ khóa nguồn để mở lại công việc hoặc ghi chú gốc.'],
    ['scissors', 'Không lưu trường không dùng', 'Tổng và số dư đều được query lại từ dữ liệu gốc.'],
  ];

  return <div className="fin-schema-page">
    <div className="fin-schema-notice"><AppIcon name="book" size={19} /><p><strong>Trang tham chiếu - không sửa ở đây.</strong> Đây là đặc tả đang khớp với migration và code. Tùy chỉnh của người dùng nằm ở tab Danh mục; thêm hoặc bớt trường ở đây là thay cấu trúc dữ liệu.</p></div>
    <p className="fin-schema-lead">Mỗi trường phải trả lời được “màn hình hoặc thống kê nào cần nó”. App không lưu tổng theo tháng, tỉ trọng danh mục, dư nợ hay số dư quỹ. Các con số đó đều được tính lại từ sổ giao dịch và nơi gửi tiền.</p>
    <SchemaBlock title="Mô hình báo cáo: một sổ, lọc theo kỳ" subtitle="Không có bảng tổng dựng sẵn."><SimpleTable headers={['Nơi hiển thị', 'Kỳ nó đọc', 'Vì sao']} rows={scopes} /></SchemaBlock>
    <SchemaBlock title="Sổ giao dịch duy nhất" subtitle="finance_transactions là nguồn sự thật của chi, thu, để dành và mọi liên kết nghiệp vụ."><SpecTable rows={transactionFields} tier /></SchemaBlock>
    {schemaSections.map(([title, table, rows]) => <SchemaBlock key={table} title={title} subtitle={table}><SpecTable rows={rows} /></SchemaBlock>)}
    <section className="fin-schema-block"><div className="fin-schema-block__head"><div><h2>Nguyên tắc thiết kế</h2><p>Các bất biến cần giữ khi mở rộng module.</p></div></div><div className="fin-schema-principles">{principles.map(([icon, title, body]) => <article key={title}><AppIcon name={icon} size={18} /><strong>{title}</strong><p>{body}</p></article>)}</div></section>
  </div>;
}

function SchemaBlock({ title, subtitle, children }) {
  return <section className="fin-schema-block"><div className="fin-schema-block__head"><div><h2>{title}</h2><p>{subtitle}</p></div></div>{children}</section>;
}

function SimpleTable({ headers, rows }) {
  return <div className="fin-data-table-wrap"><table className="fin-data-table"><thead><tr>{headers.map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row[0]}>{row.map(cell => <td key={cell}>{cell}</td>)}</tr>)}</tbody></table></div>;
}

function SpecTable({ rows, tier = false }) {
  return <div className="fin-data-table-wrap"><table className="fin-data-table fin-spec-table"><thead><tr>{tier && <th>Bậc</th>}<th>Trường</th><th>Khóa thật</th><th>Kiểu</th><th>Dùng để làm gì</th></tr></thead><tbody>{rows.map(row => <tr key={`${row[0]}-${row[1]}`}>{tier && <td><span className="fin-tier-chip">{row[0]}</span></td>}<td>{row[tier ? 1 : 0]}</td><td><code>{row[tier ? 2 : 1]}</code></td><td>{row[tier ? 3 : 2]}</td><td>{row[tier ? 4 : 3]}</td></tr>)}</tbody></table></div>;
}
