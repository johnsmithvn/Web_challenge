import { upstreamOf, normalizeGroup } from '../utils/vaultLogic';
import ACCOUNT_TEMPLATES from '../data/account-templates.json';
import AccountAvatar from './AccountAvatar';
import AppIcon from './AppIcon';

/**
 * Màn Money links (thiết kế L1 / L4): ví · thẻ nào rút được tiền từ tài khoản nào.
 *
 * `MoneyMatrix` nằm ở pane danh sách (trang đổi grid cho pane này rộng ra, xem
 * `.acc-vault[data-view="money"]`), `MoneyPanel` ở pane chi tiết. Cả hai đọc
 * moneyMatrix() đã tính ở trang; props-driven, không gọi supabase.
 *
 * Bảng chứ không phải sơ đồ mũi tên: quan hệ nhiều–nhiều (ZaloPay ⇒ A·B·C,
 * MoMo ⇒ A·C) vẽ bằng dây là chéo nhau ngay từ 3 ví. Ô chỉ là dấu hiệu, không
 * bấm được — bấm tên hàng / cột để xem chi tiết, nên Tab chỉ đi qua tiêu đề.
 */

const { templates: TEMPLATES } = ACCOUNT_TEMPLATES;
const TPL_BY_KEY = new Map(TEMPLATES.map((t) => [t.key, t]));
const codeOf = (it) => TPL_BY_KEY.get(it.tpl)?.code || '···';
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function MoneyMatrix({ matrix, selected, onSelect }) {
  const { rows, cols, cells } = matrix;
  const top = cols[0];
  const isOn = (type, id) => selected?.type === type && selected?.id === id;

  return (
    <>
      <div className="acc-listhead">
        <h2 className="acc-listhead__title">Money links</h2>
        <span className="acc-listhead__count">{cells}</span>
      </div>
      <p className="acc-roots__hint">Which wallet or card can move money out of which account.</p>

      {!rows.length ? (
        <div className="acc-list__empty">
          No money links yet. A Linked item field such as “Linked bank” becomes one, or set its link kind
          to Money in Edit.
        </div>
      ) : (
        <div className="acc-money">
          <dl className="acc-kpis acc-money__kpis">
            <div className="acc-kpi"><dt>Wallets &amp; cards</dt><dd>{rows.length}</dd></div>
            <div className="acc-kpi"><dt>Accounts</dt><dd>{cols.length}</dd></div>
            <div className="acc-kpi"><dt>Money links</dt><dd>{cells}</dd></div>
            <div className={`acc-kpi${top?.sources.length >= 2 ? ' acc-kpi--warn' : ''}`}>
              <dt>Most exposed</dt><dd>{top ? `${top.item.title} · ${top.sources.length}` : '—'}</dd>
            </div>
          </dl>

          <div className="acc-money__scroll">
            <table className="acc-money__table" aria-label="Money links: rows can pull money from columns">
              <thead>
                <tr>
                  <th scope="col" className="acc-money__corner">Wallet / card ↓ · Account →</th>
                  {cols.map((c) => (
                    <th scope="col" key={c.item.id} className={isOn('col', c.item.id) ? 'acc-money__on' : undefined}>
                      <button type="button" className="acc-money__colbtn" aria-pressed={isOn('col', c.item.id)}
                        onClick={() => onSelect({ type: 'col', id: c.item.id })}>{c.item.title}</button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.item.id} className={isOn('row', r.item.id) ? 'acc-money__on' : undefined}>
                    <th scope="row">
                      <button type="button" className="acc-money__rowbtn" aria-pressed={isOn('row', r.item.id)}
                        onClick={() => onSelect({ type: 'row', id: r.item.id })}>
                        <AccountAvatar item={r.item} />
                        <span className="acc-money__rowname">{r.item.title}</span>
                      </button>
                    </th>
                    {cols.map((c) => (
                      <td key={c.item.id} className={isOn('col', c.item.id) ? 'acc-money__on' : undefined}>
                        {r.targets.has(c.item.id)
                          ? <span className="acc-money__dot" role="img" aria-label={`${r.item.title} can pull money from ${c.item.title}`} />
                          : <span className="acc-money__none" aria-hidden="true" />}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">Can be pulled by</th>
                  {cols.map((c) => (
                    <td key={c.item.id} className={c.sources.length >= 2 ? 'acc-money__exposed' : undefined}>
                      {c.sources.length}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="acc-money__legend">
            <span><span className="acc-money__dot" aria-hidden="true" /> can move money out of that account</span>
            <span>Sign-in links (username, recovery) stay in Roots</span>
          </div>
        </div>
      )}
    </>
  );
}

export function MoneyPanel({ items, matrix, selected, rootIds, backLabel, onBack, onOpenItem, onPickRoot }) {
  const row = selected?.type === 'row' ? matrix.rows.find((r) => r.item.id === selected.id) : null;
  const col = selected?.type === 'col' ? matrix.cols.find((c) => c.item.id === selected.id) : null;
  const item = row?.item || col?.item;
  if (!item) {
    return (
      <div className="acc-detail__blank">
        <div>
          <h2>Nothing selected</h2>
          <p>Pick a wallet, card or account in the table.</p>
        </div>
      </div>
    );
  }

  const signs = upstreamOf(items, item.id);
  const roots = signs.filter((s) => rootIds.has(s.item.id));
  const list = row
    ? { title: 'Pulls money from', rows: row.links }
    : { title: 'Can be pulled by', rows: col.sources.map((s) => ({ item: s, via: '' })) };
  const n = list.rows.length;
  const group = normalizeGroup(item.group).replace('/', ' › ');

  return (
    <article className="acc-detail acc-moneypanel">
      <header className="acc-title">
        <div className="acc-title__main">
          <button className="acc-btn acc-btn--ghost acc-back" onClick={onBack}>
            <AppIcon name="caretLeft" size={15} /> {backLabel}
          </button>
          <div className="acc-title__kicker">{group ? `${group} · ${codeOf(item)}` : codeOf(item)}</div>
          <h1 className="acc-title__h1">{item.title}</h1>
        </div>
        <div className="acc-title__actions">
          <button className="acc-btn" onClick={() => onOpenItem(item.id)}>Open item</button>
        </div>
      </header>

      <section className="acc-sect">
        <div className="acc-sect__head">
          <h3 className="acc-sect__title">{list.title}</h3>
          <span className="acc-sect__meta">{n}</span>
        </div>
        <div className="acc-panel">
          {list.rows.map((r) => (
            <button type="button" key={r.item.id} className="acc-moneyrow" onClick={() => onOpenItem(r.item.id)}>
              <span className="acc-link__code">{codeOf(r.item)}</span>
              <span className="acc-moneyrow__title">{r.item.title}</span>
              {r.via && <span className="acc-moneyrow__sub">{r.via}</span>}
              <AppIcon name="external" size={14} />
            </button>
          ))}
        </div>
      </section>

      <section className="acc-sect">
        <div className="acc-sect__head">
          <h3 className="acc-sect__title">Signs in with</h3>
          <span className="acc-sect__meta">{signs.length}</span>
        </div>
        <div className="acc-panel">
          {signs.map((s) => (
            <button type="button" key={s.item.id} className="acc-moneyrow"
              onClick={() => (rootIds.has(s.item.id) ? onPickRoot(s.item.id) : onOpenItem(s.item.id))}>
              <span className="acc-link__code">{codeOf(s.item)}</span>
              <span className="acc-moneyrow__title acc-moneyrow__title--mono">{s.item.title}</span>
              <span className="acc-moneyrow__sub">{s.via}{rootIds.has(s.item.id) ? ' · root' : ''}</span>
            </button>
          ))}
          {!signs.length && <div className="acc-panel__empty">Nothing recorded</div>}
        </div>
      </section>

      {(row || n >= 2) && (
        <div className="acc-impact acc-impact--warn acc-rootmap__impact" role="status">
          <AppIcon name="warning" size={16} />
          <span>
            {row
              ? <>{roots.length ? `Lose ${roots.map((r) => r.item.title).join(' or ')} and whoever` : 'Whoever'} gets
                into {item.title} can move money out of {plural(n, 'account')}.</>
              : <>{n} wallets or cards can move money out of {item.title}.</>}
          </span>
        </div>
      )}
    </article>
  );
}
