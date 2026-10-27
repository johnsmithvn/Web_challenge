import SearchSelect from '../SearchSelect';
import AppIcon from '../AppIcon';

const topicDot = (color) => <span className="kb-dot" style={color ? { '--kb-topic': color } : undefined} />;
// Menu rộng hơn viên (viên co theo tên chủ đề); neo mép phải để không tràn khỏi màn hẹp
const TOPIC_MENU_STYLE = { left: 'auto', width: 240 };

/**
 * KBTopicSelect — viên chọn chủ đề (trang đọc + hàng trên điện thoại): SearchSelect dùng chung,
 * vẽ thành viên tròn theo màu chủ đề, mỗi dòng có chấm màu. `options`: [{ value, label, color? }].
 * `value` không được là '' (SearchSelect coi '' là chưa chọn) → dùng 'none' / 'all'.
 * `empty`: bài chưa xếp → viên viền đứt, chữ mờ (không tô màu).
 */
export function KBTopicSelect({ options, value, onChange, empty = false, ariaLabel, inputRef }) {
  const color = empty ? null : options.find((o) => o.value === value)?.color;
  return (
    <SearchSelect
      className={`kb-topic-select${empty ? ' is-empty' : ''}`}
      style={color ? { '--kb-topic': color } : undefined}
      size="sm"
      value={value}
      onChange={onChange}
      options={options}
      renderSelected={(o) => <>{topicDot()}<span className="search-select__selected-text">{o.label}</span></>}
      renderOption={(o, { isSelected }) => (
        <>
          <span className="search-select__option-main">
            {topicDot(o.color)}
            <span className="search-select__option-label">{o.label}</span>
          </span>
          {isSelected && <AppIcon name="check" size={14} />}
        </>
      )}
      searchPlaceholder="Tìm chủ đề…"
      noResultsText="Không có chủ đề này"
      ariaLabel={ariaLabel}
      inputRef={inputRef}
      // Danh sách ngắn: mở viên trên điện thoại không bật bàn phím ảo che nửa màn hình
      // (bàn phím thật trên máy tính vẫn gõ lọc được)
      inputProps={{ inputMode: 'none' }}
      menuStyle={TOPIC_MENU_STYLE}
    />
  );
}

/**
 * KBTopicPicker — hàng chip chọn một chủ đề (hoặc Chưa xếp).
 * Dùng ở trình soạn thảo và thanh gán chủ đề hàng loạt.
 * `value`: topic id · `null` = Chưa xếp · `undefined` = chưa chọn gì (thanh gán hàng loạt).
 * `suggestedId` (từ suggestTopic) được đánh dấu "gợi ý" khi bài chưa có chủ đề.
 * `showKeys`: hiện phím số 1–9 trước mỗi chủ đề (Xếp nhanh).
 */
export default function KBTopicPicker({ topics, value, onChange, suggestedId = null, allowNone = true, showKeys = false }) {
  return (
    <div className="kb-topic-picker" role="radiogroup" aria-label="Chủ đề">
      {topics.map((t, i) => {
        const active = value === t.id;
        const suggested = !value && suggestedId === t.id;
        return (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={active}
            className={`kb-chip${active ? ' kb-chip--active' : ''}${suggested ? ' kb-chip--suggested' : ''}`}
            onClick={() => onChange(t.id)}
            title={t.description || t.name}
          >
            {showKeys && <kbd className="kb-chip__key">{i + 1}</kbd>}
            <span className="kb-chip__dot" style={{ background: t.color }} />
            {t.name}
            {suggested && <span className="kb-chip__hint">gợi ý</span>}
          </button>
        );
      })}
      {allowNone && (
        <button
          type="button"
          role="radio"
          aria-checked={value === null}
          className={`kb-chip kb-chip--quiet${value === null ? ' kb-chip--active' : ''}`}
          onClick={() => onChange(null)}
        >
          Chưa xếp
        </button>
      )}
    </div>
  );
}
