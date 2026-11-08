import { useState, useMemo, useRef, useEffect, useId } from 'react';
import AppIcon from '../AppIcon';
import { useConfirm } from '../ConfirmModal';
import { useToast } from '../../contexts/ToastContext';
import { useSnippets } from '../../hooks/useSnippets';
import { filterSnippets, groupSnippets, topSnippets, countTools } from '../../utils/snippetUtils';

/**
 * KBSnippetsView — Sổ lệnh: lệnh / đoạn code theo việc cần làm, một trang, bấm là copy.
 * Không tìm: "Hay dùng" (copy nhiều nhất) + nhóm thu gọn được. Đang tìm: kết quả phẳng kèm tên nhóm.
 * Ô tìm là ô của cột trái (`search`); nút Thêm lệnh / phím N do CollectPage mở (`adding`).
 */

// Nhóm đang thu gọn — tiện ích trên máy (RULES §4)
const CLOSED_KEY = 'vl_kb_snippet_closed';
const readClosed = () => {
  try { return JSON.parse(localStorage.getItem(CLOSED_KEY)) || []; } catch { return []; }
};

const EMPTY_DRAFT = { title: '', code: '', tool: '', group_name: '', note: '', warning: '' };

function SnippetForm({ initial, groups, tools, onSave, onCancel }) {
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const listId = useId();
  const set = key => e => { setDraft(d => ({ ...d, [key]: e.target.value })); setError(''); };

  const submit = async () => {
    if (saving) return;
    setSaving(true);
    const res = await onSave(draft);
    setSaving(false);
    if (res?.error) setError(res.error);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); onCancel(); }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submit(); }
  };

  return (
    <form className="kb-snip-form" onKeyDown={onKeyDown} onSubmit={e => { e.preventDefault(); submit(); }}>
      <input
        className="kb-input kb-snip-form__title"
        placeholder="Muốn làm gì? vd: Ghép audio vào video"
        value={draft.title}
        onChange={set('title')}
        aria-label="Việc cần làm"
        autoFocus
      />
      <div className="kb-snip-form__row">
        <input className="kb-input" list={`${listId}-g`} placeholder="Nhóm, vd: Tên và đuôi file" value={draft.group_name} onChange={set('group_name')} aria-label="Nhóm" />
        <input className="kb-input kb-snip-form__tool" list={`${listId}-t`} placeholder="Công cụ, vd: cmd" value={draft.tool} onChange={set('tool')} aria-label="Công cụ" />
        <datalist id={`${listId}-g`}>{groups.map(g => <option key={g} value={g} />)}</datalist>
        <datalist id={`${listId}-t`}>{tools.map(t => <option key={t} value={t} />)}</datalist>
      </div>
      <textarea
        className="kb-input kb-snip-form__code"
        placeholder="Dán lệnh hoặc code vào đây"
        value={draft.code}
        onChange={set('code')}
        rows={Math.min(14, Math.max(3, draft.code.split('\n').length + 1))}
        spellCheck={false}
        aria-label="Lệnh"
      />
      <textarea
        className="kb-input kb-snip-form__note"
        placeholder={'Ghi chú (tuỳ chọn), mỗi ý một dòng, vd:\nSửa D:\\media thành thư mục của mày'}
        value={draft.note}
        onChange={set('note')}
        rows={Math.min(8, Math.max(2, draft.note.split('\n').length))}
        aria-label="Ghi chú"
      />
      <input className="kb-input" placeholder="Cảnh báo (tuỳ chọn), vd: xoá thật, không vào thùng rác" value={draft.warning} onChange={set('warning')} aria-label="Cảnh báo" />
      <div className="kb-snip-form__foot">
        {error && <span className="kb-snip-form__error" role="alert">{error}</span>}
        <span className="kb-spacer" />
        <kbd className="kb-kbd">Ctrl ↵</kbd>
        <button type="button" className="kb-btn-ghost kb-btn-ghost--small" onClick={onCancel}>Huỷ</button>
        <button type="submit" className="kb-btn-primary kb-btn-primary--small" disabled={saving}>Lưu lệnh</button>
      </div>
    </form>
  );
}

function SnippetRow({ s, open, copied, showGroup, onToggle, onCopy, onEdit, onDelete }) {
  const lines = s.code.split('\n');
  const firstLine = lines.find(l => l.trim()) || '';
  return (
    <article className={`kb-snip${open ? ' is-open' : ''}`}>
      <div className="kb-snip__head">
        <button className="kb-snip__main" onClick={onToggle} aria-expanded={open}>
          <span className="kb-snip__title">
            {s.warning && <AppIcon name="warning" size={14} className="kb-snip__warn-icon" />}
            {s.title}
          </span>
          <code className="kb-snip__preview">
            {firstLine.trim()}
            {lines.length > 1 && <span className="kb-snip__more"> +{lines.length - 1} dòng</span>}
          </code>
        </button>
        {showGroup && <span className="kb-pill">{s.group_name || 'Chưa xếp'}</span>}
        {s.tool && <span className="kb-snip__tool">{s.tool}</span>}
        <button
          className={`kb-btn-ghost kb-btn-ghost--small kb-snip__copy${copied ? ' is-copied' : ''}`}
          onClick={onCopy}
          aria-label={`Copy lệnh ${s.title}`}
        >
          <AppIcon name={copied ? 'check' : 'copy'} size={14} />
          <span>{copied ? 'Đã copy' : 'Copy'}</span>
        </button>
      </div>
      {open && (
        <div className="kb-snip__body">
          <pre className="kb-snip__code">{s.code}</pre>
          {s.note && <p className="kb-snip__note">{s.note}</p>}
          {s.warning && (
            <p className="kb-snip__warning"><AppIcon name="warning" size={14} /> {s.warning}</p>
          )}
          <div className="kb-snip__actions">
            <button className="kb-btn-ghost kb-btn-ghost--small" onClick={onEdit}>
              <AppIcon name="pencil" size={13} /> Sửa
            </button>
            <button className="kb-icon-btn kb-icon-btn--danger" onClick={onDelete} title="Xoá lệnh" aria-label={`Xoá lệnh ${s.title}`}>
              <AppIcon name="trash" size={14} />
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

export default function KBSnippetsView({ search, adding, onAddingChange }) {
  const { snippets, isLoading, addSnippet, updateSnippet, deleteSnippet, countCopy } = useSnippets();
  const { confirm, ConfirmModal } = useConfirm();
  const { showToast } = useToast();

  const [tool, setTool] = useState('');
  const [openId, setOpenId] = useState(null);
  const [editId, setEditId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [closed, setClosed] = useState(readClosed);
  // Thêm liền nhiều lệnh thường cùng nhóm / công cụ → điền sẵn lựa chọn lần trước
  const [lastPick, setLastPick] = useState({ group_name: '', tool: '' });
  const copyTimer = useRef(null);
  useEffect(() => () => clearTimeout(copyTimer.current), []);

  const tools = useMemo(() => countTools(snippets), [snippets]);
  const groups = useMemo(() => groupSnippets(filterSnippets(snippets, { tool })), [snippets, tool]);
  const groupNames = useMemo(() => groupSnippets(snippets).map(g => g.name).filter(Boolean), [snippets]);
  const searching = !!search.trim();
  const results = useMemo(() => (searching ? filterSnippets(snippets, { q: search, tool }) : []), [snippets, search, tool, searching]);
  const top = useMemo(() => (searching || tool ? [] : topSnippets(snippets)), [snippets, searching, tool]);

  const toggleGroup = (name) => {
    const next = closed.includes(name) ? closed.filter(n => n !== name) : [...closed, name];
    setClosed(next);
    try { localStorage.setItem(CLOSED_KEY, JSON.stringify(next)); } catch { /* storage off: nhớ trong phiên */ }
  };

  const copy = async (s) => {
    try {
      await navigator.clipboard.writeText(s.code);
    } catch {
      showToast('Không copy được. Mở lệnh, bôi đen rồi Ctrl+C.');
      return;
    }
    setCopiedId(s.id);
    clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopiedId(null), 1200);
    countCopy(s.id);
  };

  const saveNew = async (draft) => {
    const res = await addSnippet(draft);
    if (res.error) return res;
    setLastPick({ group_name: res.snippet.group_name, tool: res.snippet.tool });
    onAddingChange(false);
    showToast(`Đã lưu "${res.snippet.title}"`);
    return res;
  };

  const saveEdit = async (id, draft) => {
    const res = await updateSnippet(id, draft);
    if (!res.error) setEditId(null);
    return res;
  };

  const remove = async (s) => {
    const ok = await confirm({
      title: `Xoá lệnh "${s.title}"?`,
      message: 'Lệnh mất hẳn, không khôi phục được.',
      confirmLabel: 'Xoá lệnh',
      danger: true,
    });
    if (!ok) return;
    if (await deleteSnippet(s.id)) showToast(`Đã xoá "${s.title}"`);
    else showToast('Không xoá được. Thử lại.');
  };

  const formLists = { groups: groupNames, tools: tools.map(t => t.tool) };

  // `where` tách khu: một lệnh vừa ở "Hay dùng" vừa ở nhóm của nó thì mở / sửa đúng chỗ đã bấm
  const renderRow = (s, where, showGroup = false) => {
    const key = `${where}:${s.id}`;
    return editId === key ? (
      <SnippetForm
        key={key}
        initial={{ ...EMPTY_DRAFT, ...s }}
        {...formLists}
        onSave={draft => saveEdit(s.id, draft)}
        onCancel={() => setEditId(null)}
      />
    ) : (
      <SnippetRow
        key={key}
        s={s}
        open={openId === key}
        copied={copiedId === s.id}
        showGroup={showGroup}
        onToggle={() => setOpenId(openId === key ? null : key)}
        onCopy={() => copy(s)}
        onEdit={() => { setEditId(key); setOpenId(null); }}
        onDelete={() => remove(s)}
      />
    );
  };

  return (
    <div className="kb-list-view kb-snips" style={{ animation: 'kb-in .22s ease' }}>
      {ConfirmModal}
      <header className="kb-topic-head">
        <div className="kb-topic-head__line">
          <h2 className="kb-topic-head__name">Sổ lệnh</h2>
          <span className="kb-topic-head__count">{snippets.length} lệnh</span>
        </div>
        <p className="kb-topic-head__desc">Lệnh và đoạn code theo việc cần làm. Gõ ở ô tìm, bấm Copy là xong.</p>
        {tools.length > 0 && (
          <div className="kb-tag-row" role="group" aria-label="Lọc theo công cụ">
            <button className={`kb-tag-chip${!tool ? ' is-active' : ''}`} onClick={() => setTool('')} aria-pressed={!tool}>
              Tất cả <span className="kb-tag-chip__count">{snippets.length}</span>
            </button>
            {tools.map(t => (
              <button
                key={t.tool}
                className={`kb-tag-chip kb-snip-chip${tool === t.tool ? ' is-active' : ''}`}
                onClick={() => setTool(tool === t.tool ? '' : t.tool)}
                aria-pressed={tool === t.tool}
              >
                {t.tool} <span className="kb-tag-chip__count">{t.count}</span>
              </button>
            ))}
          </div>
        )}
      </header>

      {adding && (
        <SnippetForm
          initial={{ ...EMPTY_DRAFT, ...lastPick, tool: tool || lastPick.tool }}
          {...formLists}
          onSave={saveNew}
          onCancel={() => onAddingChange(false)}
        />
      )}

      {isLoading ? (
        <div className="kb-loading">Đang tải sổ lệnh…</div>
      ) : snippets.length === 0 ? (
        !adding && (
          <div className="kb-empty">
            <h3 className="kb-empty__title">Sổ lệnh còn trống</h3>
            <p className="kb-empty__desc">Lưu những lệnh hay quên: đổi tên file hàng loạt, ghép audio vào video, macro Excel… Đặt tên theo việc cần làm để lần sau gõ là ra.</p>
            <button className="kb-btn-primary" onClick={() => onAddingChange(true)}>
              <AppIcon name="plus" size={15} weight="bold" /> Thêm lệnh
            </button>
          </div>
        )
      ) : searching ? (
        results.length ? (
          <>
            <p className="kb-list-toolbar__result">{results.length} kết quả</p>
            <div className="kb-snip-list">{results.map(s => renderRow(s, 'q', true))}</div>
          </>
        ) : (
          <div className="kb-empty">
            <h3 className="kb-empty__title">Không có lệnh nào khớp</h3>
            <p className="kb-empty__desc">Thử từ khác, bỏ lọc công cụ, hoặc thêm lệnh mới.</p>
          </div>
        )
      ) : (
        <div className="kb-groups">
          {top.length > 0 && (
            <section>
              <h3 className="kb-group__head kb-snip-top">
                <AppIcon name="star" size={14} />
                Hay dùng
                <span className="kb-group__line" />
              </h3>
              <div className="kb-snip-list">{top.map(s => renderRow(s, 'top', true))}</div>
            </section>
          )}
          {groups.map(g => {
            const open = !closed.includes(g.name);
            return (
              <section key={g.name || '_none'}>
                <button className={`kb-group__head${open ? '' : ' is-closed'}`} onClick={() => toggleGroup(g.name)} aria-expanded={open}>
                  <AppIcon name="caretDown" size={12} weight="bold" className="kb-group__caret" />
                  {g.label}
                  <span className="kb-group__count">{g.items.length}</span>
                  <span className="kb-group__line" />
                </button>
                {open && <div className="kb-snip-list">{g.items.map(s => renderRow(s, 'g'))}</div>}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
