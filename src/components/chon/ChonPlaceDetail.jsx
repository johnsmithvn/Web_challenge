import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import AppIcon from '../AppIcon';
import SearchSelect from '../SearchSelect';
import ChonKindArt from './ChonKindArt';
import { kindOf, PLATFORM, OCCASION, REVISITS } from './chonData';
import {
  placeState, sortedVisits, dishMentions, nearbyWant, directionsUrl, distanceM, formatDistance, hasCoords,
  formatPriceShort, planBadge, ratingLabel, shortDay, cleanSource,
} from '../../utils/placeLogic';
import { formatVND } from '../../utils/currencyUtils';

const REVISIT = Object.fromEntries(REVISITS.map(r => [r.id, r.label]));
const ddmm = iso => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '');

/**
 * Chi tiết chốn (mockup 2C). Máy tính: ngăn phải; điện thoại: toàn màn (route /chon/:placeId nên Back chạy đúng).
 * Ai giới thiệu (gộp nhiều lần lưu, thêm / xoá, chọn bài Kiến thức), Món nên thử (đếm số lần nhắc),
 * Gần đây cũng muốn đến (+ Gom một tối), Lịch sử ghé, nút đáy Thắp đèn.
 */
export default function ChonPlaceDetail({
  place, places, origin, today, onClose, onEdit, onMenu, onLight, onPlan, onShare, onShowCluster, onOpenPlace,
  onAddSource, onDeleteSource, onDeleteVisit, onWriteArticle, fetchArticles,
}) {
  const kind = kindOf(place.kind);
  const st = placeState(place);
  const visits = sortedVisits(place);
  const dishes = useMemo(() => dishMentions(place), [place]);
  const near = useMemo(() => nearbyWant(place, places), [place, places]);
  const badge = planBadge(place.plan_task, today);
  const dist = origin && hasCoords(place) ? formatDistance(distanceM(origin, place)) : '';
  const sources = place.place_sources || [];

  const [adding, setAdding] = useState(false);
  const [src, setSrc] = useState({ url: '', author: '', quote: '', collection_id: '' });
  const [srcErr, setSrcErr] = useState('');
  const [articles, setArticles] = useState(null);

  useEffect(() => {
    if (!adding || articles) return;
    fetchArticles().then(list => setArticles(list || []));
  }, [adding, articles, fetchArticles]);

  const articleTitle = id => articles?.find(a => a.id === id)?.title;

  const saveSource = async () => {
    const r = cleanSource({ ...src, collection_id: src.collection_id || null });
    if (r.error) { setSrcErr(r.error); return; }
    if (!r.value) { setSrcErr('Ghi link, người giới thiệu, lời trích hoặc chọn một bài Kiến thức.'); return; }
    if (await onAddSource(place.id, r.value)) {
      setAdding(false);
      setSrc({ url: '', author: '', quote: '', collection_id: '' });
      setSrcErr('');
    }
  };

  return (
    <div className="chon-detail-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <aside className="chon-detail" aria-label={`Chi tiết ${place.name}`}>
        <div className={`chon-detail__hero chon-kind--${kind.id}`}>
          <ChonKindArt kind={kind.id} size={150} />
          <div className="chon-detail__bar">
            <button type="button" className="chon-round-btn" onClick={onClose} aria-label="Quay lại"><AppIcon name="caretLeft" size={20} /></button>
            <div className="chon-round-group">
              <button type="button" className="chon-round-btn chon-round-btn--flat" onClick={() => onEdit(place)} aria-label="Sửa chốn"><AppIcon name="pencil" size={17} /></button>
              <button type="button" className="chon-round-btn chon-round-btn--flat" aria-label="Thêm thao tác"
                onClick={e => { const r = e.currentTarget.getBoundingClientRect(); onMenu(place, { x: r.right - 210, y: r.bottom + 4 }); }}>
                <AppIcon name="dots" size={17} weight="bold" />
              </button>
            </div>
          </div>
          <span className={`chon-detail__state${st.state === 'visited' ? ' is-lit' : ''}`}>
            <AppIcon name="lantern" size={14} weight={st.state === 'visited' ? 'fill' : 'regular'} />
            {st.state === 'visited'
              ? `Đã đến · ${st.visitCount} lần · gần nhất ${ddmm(st.lastVisit.visited_on)}`
              : `Muốn đến · lưu ${ddmm(place.created_at)}`}
          </span>
        </div>

        <div className="chon-detail__body">
          <div className="chon-detail__head">
            <p className={`chon-card__kind chon-kind--${kind.id}`}>
              <AppIcon name={kind.icon} size={15} />{kind.label}
              {dishes.length > 0 && <span className="chon-card__area">· {dishes.slice(0, 2).map(d => d.name.toLowerCase()).join(' · ')}</span>}
            </p>
            <h1 className="chon-detail__name">{place.name}</h1>
            {(place.address || place.area || dist) && (
              <p className="chon-detail__addr">{[place.address || place.area, dist && `cách ${dist}`].filter(Boolean).join(' · ')}</p>
            )}
          </div>

          {(place.hours_note || place.price_per_person || place.occasions?.length > 0 || badge) && (
            <div className="chon-chips">
              {badge && (
                <span className={`chon-pill chon-pill--plan${badge.overdue ? ' is-overdue' : ''}`}>
                  <AppIcon name="calendar" size={13} />{badge.label}
                </span>
              )}
              {place.hours_note && <span className="chon-pill"><AppIcon name="clock" size={13} />{place.hours_note}</span>}
              {place.price_per_person > 0 && <span className="chon-pill"><AppIcon name="wallet" size={13} />~{formatPriceShort(place.price_per_person)}/người</span>}
              {(place.occasions || []).map(o => <span key={o} className="chon-pill">{OCCASION[o]?.label}</span>)}
            </div>
          )}

          <div className="chon-detail__actions">
            <a className="chon-btn chon-btn--soft" href={directionsUrl(place)} target="_blank" rel="noopener noreferrer">
              <AppIcon name="navigationArrow" size={16} />Chỉ đường
            </a>
            <button type="button" className="chon-btn chon-btn--ghost" onClick={() => onPlan(place)}>
              <AppIcon name="calendar" size={16} />Hẹn ngày
            </button>
            <button type="button" className="chon-btn chon-btn--ghost" onClick={() => onShare(place)}>
              <AppIcon name="share" size={16} />Rủ bạn
            </button>
          </div>

          {place.note && <p className="chon-detail__note">{place.note}</p>}

          {visits.length > 0 && (
            <section className="chon-detail__sec">
              <h2 className="chon-h2">Những lần ghé <span className="chon-h2__count">{visits.length}</span></h2>
              <ol className="chon-visits">
                {visits.map(v => (
                  <li key={v.id} className="chon-visit">
                    <div className="chon-visit__head">
                      <span className="chon-visit__day">{shortDay(v.visited_on)}{v.visited_on.slice(0, 4) !== today.slice(0, 4) ? `/${v.visited_on.slice(0, 4)}` : ''}</span>
                      {v.rating != null && (
                        <span className="chon-stars-mini" aria-label={`${v.rating} sao`}><AppIcon name="star" size={13} weight="fill" />{v.rating} · {ratingLabel(v.rating)}</span>
                      )}
                      {v.revisit && <span className="chon-visit__tag">{REVISIT[v.revisit]}</span>}
                      <button type="button" className="chon-icon-btn chon-icon-btn--sm" aria-label={`Xoá lần ghé ${shortDay(v.visited_on)}`}
                        onClick={() => onDeleteVisit(place, v)}>
                        <AppIcon name="trash" size={14} />
                      </button>
                    </div>
                    {v.note && <p className="chon-visit__note">“{v.note}”</p>}
                    <p className="chon-visit__meta">
                      {v.liked_dishes?.length > 0 && <span><AppIcon name="heart" size={12} weight="fill" />{v.liked_dishes.join(', ')}</span>}
                      {v.party_size && <span><AppIcon name="users" size={12} />{v.party_size} người</span>}
                      {v.spent > 0 && (
                        <span>
                          <AppIcon name="wallet" size={12} />{formatVND(v.spent)}
                          {v.finance_tx_id && <Link to="/finance/list" className="chon-link"> · đã ghi Tài chính</Link>}
                        </span>
                      )}
                    </p>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <section className="chon-detail__sec">
            <div className="chon-sec-head">
              <h2 className="chon-h2">Ai giới thiệu <span className="chon-h2__count">{sources.length}</span></h2>
              {sources.length > 1 && <span className="chon-faint">đã gộp {sources.length} lần lưu</span>}
            </div>
            {sources.length > 0 && (
              <div className="chon-quotes">
                {sources.map(s => {
                  const pf = PLATFORM[s.platform];
                  return (
                    <article key={s.id} className="chon-quote">
                      <p className="chon-quote__meta">
                        <span className="chon-pill chon-pill--sm">{pf?.video && <AppIcon name="play" size={9} weight="fill" />}{pf?.label || 'Nguồn'}</span>
                        <span className="chon-quote__who">{[s.author, ddmm(s.created_at)].filter(Boolean).join(' · ')}</span>
                        <button type="button" className="chon-icon-btn chon-icon-btn--sm" aria-label="Xoá lời giới thiệu này" onClick={() => onDeleteSource(place, s)}>
                          <AppIcon name="x" size={13} />
                        </button>
                      </p>
                      {s.quote && <p className="chon-quote__text">“{s.quote}”</p>}
                      <p className="chon-quote__links">
                        {s.url && <a href={s.url} target="_blank" rel="noopener noreferrer" className="chon-link"><AppIcon name="external" size={12} />Mở link</a>}
                        {s.collection_id && <Link to="/collect" state={{ openArticleId: s.collection_id }} className="chon-link"><AppIcon name="book" size={12} />Bài Kiến thức</Link>}
                      </p>
                    </article>
                  );
                })}
              </div>
            )}
            {adding ? (
              <div className="chon-panel chon-form chon-form--tight">
                <input className="chon-input" value={src.url} onChange={e => setSrc(s => ({ ...s, url: e.target.value }))}
                  placeholder="Link TikTok, Facebook…" aria-label="Link giới thiệu" inputMode="url" data-autofocus />
                <input className="chon-input" value={src.author} onChange={e => setSrc(s => ({ ...s, author: e.target.value }))}
                  placeholder="Ai giới thiệu" aria-label="Người giới thiệu" maxLength={80} />
                <textarea className="chon-input chon-textarea" rows={2} value={src.quote} maxLength={500}
                  onChange={e => setSrc(s => ({ ...s, quote: e.target.value }))} placeholder="Lời giới thiệu" aria-label="Lời giới thiệu" />
                <SearchSelect
                  options={(articles || []).map(a => ({ value: a.id, label: a.title || 'Bài không tên' }))}
                  value={src.collection_id}
                  onChange={v => setSrc(s => ({ ...s, collection_id: v || '' }))}
                  placeholder={articles ? 'Hoặc chọn một bài Kiến thức (tuỳ chọn)' : 'Đang tải bài Kiến thức…'}
                  clearable
                  ariaLabel="Bài Kiến thức làm nguồn"
                  renderSelected={o => o?.label || articleTitle(src.collection_id)}
                />
                {srcErr && <p className="chon-error" role="alert">{srcErr}</p>}
                <div className="chon-form__row-end">
                  <button type="button" className="chon-btn chon-btn--text chon-btn--sm" onClick={() => { setAdding(false); setSrcErr(''); }}>Huỷ</button>
                  <button type="button" className="chon-btn chon-btn--soft chon-btn--sm" onClick={saveSource}>Thêm</button>
                </div>
              </div>
            ) : (
              <div className="chon-sec-actions">
                <button type="button" className="chon-btn chon-btn--dashed chon-btn--sm" onClick={() => setAdding(true)}>
                  <AppIcon name="plus" size={14} />Thêm lời giới thiệu
                </button>
                <button type="button" className="chon-btn chon-btn--text chon-btn--sm" onClick={() => onWriteArticle(place)}>
                  <AppIcon name="note" size={14} />Viết thành bài Kiến thức
                </button>
              </div>
            )}
          </section>

          {dishes.length > 0 && (
            <section className="chon-detail__sec">
              <h2 className="chon-h2">Món nên thử</h2>
              <div className="chon-chips chon-chips--scroll">
                {dishes.map(d => (
                  <span key={d.name} className="chon-chip chon-chip--dish is-on chon-chip--static">
                    {d.liked && <AppIcon name="heart" size={13} weight="fill" className="chon-heart is-on" />}
                    {d.name}
                    {d.count > 1 && <span className="chon-chip__count" aria-label={`${d.count} lần được nhắc`}>{d.count}</span>}
                  </span>
                ))}
              </div>
            </section>
          )}

          {near.length > 0 && (
            <section className="chon-detail__sec">
              <div className="chon-sec-head">
                <h2 className="chon-h2">Gần đây cũng muốn đến</h2>
                <button type="button" className="chon-btn chon-btn--text chon-btn--sm" onClick={() => onShowCluster([place, ...near.map(n => n.place)])}>
                  <AppIcon name="path" size={15} />Gom một tối
                </button>
              </div>
              <ul className="chon-near">
                {near.map(({ place: p, distance }) => {
                  const k = kindOf(p.kind);
                  return (
                    <li key={p.id}>
                      <button type="button" className="chon-near__row" onClick={() => onOpenPlace(p)}>
                        <span className={`chon-near__icon chon-kind--${k.id}`} aria-hidden="true"><AppIcon name={k.icon} size={16} /></span>
                        <span className="chon-near__text">
                          <span className="chon-near__name">{p.name}</span>
                          <span className="chon-near__sub">cách {formatDistance(distance)}{p.hours_note ? ` · ${p.hours_note}` : ''}</span>
                        </span>
                        <AppIcon name="caretRight" size={16} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {!sources.length && !visits.length && !dishes.length && !place.note && (
            <p className="chon-faint chon-detail__empty">Chưa có gì thêm. Thêm lời giới thiệu, món nên thử hoặc thắp đèn khi đã đến.</p>
          )}
        </div>

        <div className="chon-detail__cta">
          <button type="button" className="chon-btn chon-btn--lamp chon-btn--grow chon-btn--lg" onClick={() => onLight(place)}>
            <AppIcon name="lantern" size={19} weight={st.state === 'visited' ? 'fill' : 'regular'} />
            {st.state === 'visited' ? 'Thắp thêm một lần' : 'Thắp đèn · tôi đã đến'}
          </button>
        </div>
      </aside>
    </div>
  );
}

