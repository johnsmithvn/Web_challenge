import { useState, useMemo } from 'react';
import { upstreamOf, chainTo, isPasswordOnly, identifiersOf, rootKind } from '../utils/vaultLogic';
import ACCOUNT_TEMPLATES from '../data/account-templates.json';
import AppIcon from './AppIcon';

/**
 * RootMap — bản đồ của một gốc định danh (màn Roots, thiết kế PA3 / R0–R2).
 *
 * Props-driven, KHÔNG gọi supabase. `root` là một phần tử của rootsOf() nên cây
 * phụ thuộc đã tính sẵn ở trang; ở đây chỉ tính chiều ngược (upstreamOf) và đường
 * chain tới mục đang trỏ.
 *
 * Bố cục: dải số liệu → CHAIN → [Protected by] → gốc → [Depends on this] → cảnh
 * báo. Desktop xếp ngang, mobile CSS xếp dọc (accounts.css, container query).
 * Bấm một dòng ở "Depends on this" = vẽ lại chain tới nó; nút ↗ mới mở item —
 * hai việc khác nhau nên hai nút, không dồn vào một cú bấm.
 */

const { templates: TEMPLATES, authKinds: AUTH_KINDS } = ACCOUNT_TEMPLATES;
const TPL_BY_KEY = new Map(TEMPLATES.map((t) => [t.key, t]));
const codeOf = (it) => TPL_BY_KEY.get(it.tpl)?.code || '···';

const ROOT_KIND = {
  email: { label: 'Email', icon: 'envelope', hue: 32 },
  phone: { label: 'Phone', icon: 'deviceMobile', hue: 215 },
  identity: { label: 'Identity', icon: 'identification', hue: 200 },
};

/* ── Một dòng ở danh sách gốc (cột giữa / màn list mobile). Dùng lại .acc-row để
   đọc giống danh sách item; gốc chưa ai dựa vào thì mờ đi. ── */
export function RootRow({ root, on, onOpen }) {
  const { item, deps, direct } = root;
  const kind = ROOT_KIND[rootKind(item)];
  const more = deps.length - direct;
  return (
    <button className={`acc-row${on ? ' acc-row--on' : ''}${deps.length ? '' : ' acc-row--dim'}`} onClick={onOpen}>
      <span className="acc-avatar" style={{ '--h': kind.hue }}><AppIcon name={kind.icon} size={16} /></span>
      <span className="acc-row__body">
        <span className="acc-row__top"><span className="acc-row__title acc-rootrow__title">{item.title}</span></span>
        <span className="acc-row__sub">
          {kind.label} · {deps.length ? `${direct} direct${more ? `, ${more} more` : ''}` : 'nothing depends on it'}
        </span>
      </span>
      <span className="acc-row__side">
        <span className="acc-rootrow__count">{deps.length}</span>
        {deps.length > 0 && isPasswordOnly(item) && <span className="acc-row__auth">PWD only</span>}
      </span>
    </button>
  );
}

export default function RootMap({ root, items, rootIds, backLabel, onBack, onOpenItem, onPickRoot }) {
  const { item, deps, depth } = root;
  // Component được key theo id gốc ở trang → đổi gốc là reset điểm đang trỏ
  const [target, setTarget] = useState(null);
  const upstream = useMemo(() => upstreamOf(items, item.id), [items, item.id]);

  const kind = ROOT_KIND[rootKind(item)];
  const path = chainTo(deps, target);
  const chain = [...(upstream[0] ? [upstream[0].item] : []), item, ...path];
  const traced = path[path.length - 1]?.id;

  const activeAuth = item.auth.filter((a) => a.state !== 'off');
  const passwordOnly = isPasswordOnly(item);
  const signinLabel = !activeAuth.length ? 'None'
    : passwordOnly ? 'Password only'
      : activeAuth.length === 1 ? AUTH_KINDS[activeAuth[0].kind]?.label || activeAuth[0].kind
        : `${activeAuth.length} methods`;
  const direct = deps.filter((d) => d.depth === 1).length;

  // Gom cây theo field nối ở cấp 1 ("Username · 4"); con cấp 2, 3 đi theo cha của nó
  const groups = [];
  const byVia = new Map();
  let current = null;
  for (const d of deps) {
    if (d.depth === 1) {
      current = byVia.get(d.via);
      if (!current) { current = { via: d.via, count: 0, rows: [] }; byVia.set(d.via, current); groups.push(current); }
      current.count++;
    }
    current.rows.push(d);
  }

  // Gốc thì mở bản đồ của nó, item thường thì mở trang chi tiết
  const go = (id) => (rootIds.has(id) ? onPickRoot(id) : onOpenItem(id));

  return (
    <article className="acc-detail acc-rootmap">
      <header className="acc-title">
        <div className="acc-title__main">
          <button className="acc-btn acc-btn--ghost acc-back" onClick={onBack}>
            <AppIcon name="caretLeft" size={15} /> {backLabel}
          </button>
          <div className="acc-title__kicker">Identity root · {kind.label}</div>
          <h1 className="acc-title__h1">{item.title}</h1>
          {kind === ROOT_KIND.identity && (
            <div className="acc-rootmap__ids">{[...identifiersOf(item)].join(' · ')}</div>
          )}
        </div>
        <div className="acc-title__actions">
          <button className="acc-btn" onClick={() => onOpenItem(item.id)}>Open item</button>
        </div>
      </header>

      <dl className="acc-kpis">
        <div className="acc-kpi"><dt>Dependents</dt><dd>{deps.length}</dd></div>
        <div className="acc-kpi"><dt>Depth</dt><dd>{depth || '—'}</dd></div>
        <div className={`acc-kpi${passwordOnly ? ' acc-kpi--warn' : ''}`}><dt>Sign-in</dt><dd>{signinLabel}</dd></div>
        <div className="acc-kpi"><dt>Reached via</dt><dd>{upstream.length ? `${upstream.length} item${upstream.length > 1 ? 's' : ''}` : '—'}</dd></div>
      </dl>

      {chain.length > 1 && (
        <section className="acc-sect">
          <div className="acc-sect__head">
            <h3 className="acc-sect__title">Chain</h3>
            <span className="acc-sect__meta">Pick an item below to trace its path</span>
          </div>
          <div className="acc-chain">
            {chain.map((c, i) => (
              <span className="acc-chain__step" key={c.id}>
                {i > 0 && <span className="acc-chain__arrow" aria-hidden="true">→</span>}
                <button type="button" onClick={() => c.id !== item.id && go(c.id)}
                  className={`acc-chain__node${c.id === item.id ? ' acc-chain__node--here' : ''}`}
                  aria-current={c.id === item.id ? 'true' : undefined}>
                  <span className="acc-link__code">{codeOf(c)}</span>{c.title}
                </button>
              </span>
            ))}
          </div>
        </section>
      )}

      <section className="acc-rootmap__map" aria-label="Root map">
        <div className="acc-rootmap__col">
          <h3 className="acc-rootmap__cap">Protected by</h3>
          {activeAuth.map((a) => (
            <div key={a.id}
              className={`acc-guard${passwordOnly && a.kind === 'password' ? ' acc-guard--warn' : ''}`}>
              <span className="acc-guard__code">{AUTH_KINDS[a.kind]?.code || '···'}</span>
              <span className="acc-guard__body">
                <span className="acc-guard__title">{AUTH_KINDS[a.kind]?.label || a.kind}</span>
                <span className="acc-guard__sub">
                  {passwordOnly && a.kind === 'password' ? 'Only sign-in method' : a.state === 'primary' ? 'Primary' : 'On'}
                </span>
              </span>
            </div>
          ))}
          {upstream.map((u) => (
            <button type="button" key={u.item.id} className="acc-guard" onClick={() => go(u.item.id)}>
              <span className="acc-guard__code">{codeOf(u.item)}</span>
              <span className="acc-guard__body">
                <span className="acc-guard__title">{u.item.title}</span>
                <span className="acc-guard__sub">{u.via}{rootIds.has(u.item.id) ? ' · root' : ''}</span>
              </span>
            </button>
          ))}
          {!activeAuth.length && !upstream.length && (
            <div className="acc-rootmap__empty">Nothing recorded</div>
          )}
        </div>

        <span className="acc-rootmap__wire" aria-hidden="true" />

        <div className="acc-rootmap__root" style={{ '--h': kind.hue }}>
          <span className="acc-avatar"><AppIcon name={kind.icon} size={17} /></span>
          <span className="acc-rootmap__root-id">{item.title}</span>
          <span className="acc-rootmap__root-sub">This root · {kind.label} · {codeOf(item)}</span>
        </div>

        <span className="acc-rootmap__wire" aria-hidden="true" />

        <div className="acc-rootmap__col acc-rootmap__col--deps">
          <h3 className="acc-rootmap__cap">Depends on this</h3>
          {groups.map((g) => (
            <div className="acc-depgroup" key={g.via}>
              <div className="acc-depgroup__head">{g.via} · {g.count}</div>
              {g.rows.map((d) => (
                <div key={d.item.id} style={{ '--depth': d.depth - 1 }}
                  className={`acc-deprow${d.depth > 1 ? ' acc-deprow--nested' : ''}${d.item.id === traced ? ' acc-deprow--on' : ''}`}>
                  <button type="button" className="acc-deprow__trace" onClick={() => setTarget(d.item.id)}
                    aria-pressed={d.item.id === traced}>
                    <span className="acc-link__code">{codeOf(d.item)}</span>
                    <span className="acc-deprow__title">{d.item.title}</span>
                    {d.depth > 1 && <span className="acc-deprow__sub">{d.via}</span>}
                  </button>
                  <button type="button" className="acc-act acc-act--x acc-deprow__open"
                    aria-label={`Open ${d.item.title}`} onClick={() => onOpenItem(d.item.id)}>
                    <AppIcon name="external" size={14} />
                  </button>
                </div>
              ))}
            </div>
          ))}
          {!deps.length && <div className="acc-rootmap__empty">Nothing depends on this yet</div>}
        </div>
      </section>

      {deps.length > 0 && (
        <div className="acc-impact acc-impact--warn acc-rootmap__impact" role="status">
          <AppIcon name="warning" size={16} />
          <span>
            Whoever controls this {kind === ROOT_KIND.email ? 'mailbox' : kind === ROOT_KIND.phone ? 'number' : 'identity'} can
            reach {direct} {direct === 1 ? 'item' : 'items'} directly
            {deps.length > direct && `, and ${deps.length - direct} more through them`}.
            {passwordOnly && ' It signs in with a password only.'}
          </span>
        </div>
      )}
    </article>
  );
}
