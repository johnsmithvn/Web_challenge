import { memo } from 'react';
import AppIcon from '../AppIcon';
import ChonKindArt from './ChonKindArt';
import { kindOf, PLATFORM } from './chonData';
import { placeState, planBadge, timeAgo, distanceM, formatDistance, hasCoords } from '../../utils/placeLogic';

/**
 * Thẻ chốn (mockup 2A): hình theo loại + nhãn nguồn, nút đèn góc phải, loại · khu vực, tên, lời trích,
 * ngày lưu · khoảng cách. Đã đến: đèn sáng + sao. Có hẹn: viên hẹn.
 * Bấm thẻ = mở chi tiết; nút đèn = thắp đèn; ⋯ / chuột phải = menu thao tác.
 */
function ChonPlaceCard({ place, origin, today, active, trip = null, onOpenTrip, onOpen, onLight, onMenu, onHover }) {
  const kind = kindOf(place.kind);
  const st = placeState(place);
  const visited = st.state === 'visited';
  const firstSource = (place.place_sources || [])[0];
  const quoteSource = (place.place_sources || []).find(s => s.quote);
  const platform = firstSource ? PLATFORM[firstSource.platform] : null;
  const badge = planBadge(place.plan_task, today);
  const dist = origin && hasCoords(place) ? formatDistance(distanceM(origin, place)) : '';
  const lastNote = st.lastVisit?.note;

  return (
    <article
      className={`chon-card${visited ? ' is-visited' : ''}${active ? ' is-active' : ''}`}
      onMouseEnter={() => onHover?.(place.id)}
      onMouseLeave={() => onHover?.(null)}
      onContextMenu={e => { e.preventDefault(); onMenu(place, { x: e.clientX, y: e.clientY }); }}
    >
      <div className={`chon-card__art chon-kind--${kind.id}`}>
        <ChonKindArt kind={kind.id} />
        {platform && firstSource.platform !== 'other' && (
          <span className="chon-card__src">
            {platform.video && <AppIcon name="play" size={10} weight="fill" />}
            {platform.label}
          </span>
        )}
        <button
          type="button"
          className={`chon-lamp-btn${visited ? ' is-lit' : ''}`}
          onClick={() => onLight(place)}
          aria-label={visited ? `Thắp thêm một lần: ${place.name}` : `Thắp đèn: đánh dấu đã đến ${place.name}`}
          title={visited ? 'Thắp thêm một lần' : 'Thắp đèn · tôi đã đến'}
        >
          <AppIcon name="lantern" size={18} weight={visited ? 'fill' : 'regular'} />
        </button>
      </div>

      <div className="chon-card__body">
        <p className={`chon-card__kind chon-kind--${kind.id}`}>
          <AppIcon name={kind.icon} size={14} />
          {kind.label}
          {place.area && <span className="chon-card__area" title={place.area}>· {place.area}</span>}
        </p>
        {/* Nút phủ cả thẻ để mở chi tiết — tên là nhãn truy cập */}
        <h3 className="chon-card__name">
          <button type="button" className="chon-card__open" onClick={() => onOpen(place)}>{place.name}</button>
        </h3>
        {visited ? (
          <p className="chon-card__visit">
            {st.rating != null && (
              <span className="chon-stars-mini" aria-label={`${st.rating} sao`}>
                <AppIcon name="star" size={13} weight="fill" />{st.rating}
              </span>
            )}
            {st.lastVisit?.revisit === 'yes' && <span>Sẽ quay lại</span>}
            {st.visitCount > 1 && <span>{st.visitCount} lần</span>}
          </p>
        ) : null}
        {visited && lastNote ? (
          <p className="chon-card__quote">“{lastNote}”</p>
        ) : quoteSource ? (
          <p className="chon-card__quote">
            “{quoteSource.quote}”{quoteSource.author && <span className="chon-card__by"> — {quoteSource.author}</span>}
          </p>
        ) : place.note ? (
          <p className="chon-card__quote chon-card__quote--plain">{place.note}</p>
        ) : null}
        {trip && (
          <button type="button" className="chon-link chon-card__trip" onClick={() => onOpenTrip(trip)}>
            <AppIcon name="flag" size={13} />
            Chuyến đi · {(trip.trip_options || []).length ? `${trip.trip_options.length} lựa chọn tour` : trip.title}
          </button>
        )}
        <p className="chon-card__meta">
          <span className="chon-card__when">
            {visited ? `đến ${timeAgo(`${st.lastVisit.visited_on}T12:00:00`)}` : `lưu ${timeAgo(place.created_at)}`}
          </span>
          {badge && (
            <span className={`chon-pill chon-pill--plan${badge.overdue ? ' is-overdue' : ''}`}>
              <AppIcon name="calendar" size={12} />{badge.label}
            </span>
          )}
          {dist && <span className="chon-card__dist"><AppIcon name="navigationArrow" size={12} />{dist}</span>}
        </p>
      </div>

      <button
        type="button"
        className="chon-icon-btn chon-card__more"
        aria-label={`Thao tác với ${place.name}`}
        onClick={e => { const r = e.currentTarget.getBoundingClientRect(); onMenu(place, { x: r.right - 200, y: r.bottom + 4 }); }}
      >
        <AppIcon name="dots" size={18} weight="bold" />
      </button>
    </article>
  );
}

export default memo(ChonPlaceCard);
