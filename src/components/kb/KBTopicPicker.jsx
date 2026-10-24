/**
 * KBTopicPicker — hàng chip chọn một chủ đề (hoặc Chưa xếp).
 * Dùng ở trình soạn thảo và thanh gán chủ đề hàng loạt.
 * `value`: topic id · `null` = Chưa xếp · `undefined` = chưa chọn gì (thanh gán hàng loạt).
 * `suggestedId` (từ suggestTopic) được đánh dấu "gợi ý" khi bài chưa có chủ đề.
 */
export default function KBTopicPicker({ topics, value, onChange, suggestedId = null, allowNone = true }) {
  return (
    <div className="kb-topic-picker" role="radiogroup" aria-label="Chủ đề">
      {topics.map(t => {
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
