import AppIcon from '../AppIcon';
import ChonKindArt from './ChonKindArt';
import { formatTripRange, countdown, pickedOption, tripEstimate, TRIP_STATUS_LABEL } from '../../utils/tripLogic';
import { formatVND } from '../../utils/currencyUtils';

/** Thẻ chuyến đi ở tab Chuyến đi: tên + dòng nhấn, ngày, đếm ngược, trạng thái, lựa chọn đang dùng + ước tính. */
export default function ChonTripCard({ trip, today, onOpen }) {
  const opts = trip.trip_options || [];
  const picked = pickedOption(trip);
  const est = tripEstimate(trip, picked);
  const left = countdown(trip, today);
  const nPlaces = (trip.trip_places || []).length;

  return (
    <article className={`chon-card chon-trip-card is-${trip.status}`}>
      <div className="chon-card__art chon-kind--travel">
        <ChonKindArt kind="travel" />
        <span className={`chon-card__src chon-pill--status is-${trip.status}`}><i aria-hidden="true" />{TRIP_STATUS_LABEL[trip.status]}</span>
      </div>
      <div className="chon-card__body">
        <p className="chon-card__kind chon-kind--travel">
          <AppIcon name="flag" size={14} />Chuyến đi{trip.region && <span className="chon-card__area">· {trip.region}</span>}
        </p>
        <h3 className="chon-card__name">
          <button type="button" className="chon-card__open" onClick={() => onOpen(trip)}>
            {trip.title}{trip.tagline && <em className="chon-trip-card__tag"> {trip.tagline}</em>}
          </button>
        </h3>
        <p className="chon-card__quote chon-card__quote--plain">
          {formatTripRange(trip)}{left ? ` · ${left}` : ''} · {trip.people} người
        </p>
        <p className="chon-card__meta">
          <span className="chon-card__when">
            {picked
              ? `${picked.pick === 'chosen' ? 'Đã chốt' : 'Nghiêng về'} ${picked.name}${est.total ? ` · ≈ ${formatVND(est.total)}` : ''}`
              : opts.length ? `${opts.length} lựa chọn đang so` : 'Chưa có lựa chọn'}
          </span>
          {nPlaces > 0 && <span className="chon-card__dist"><AppIcon name="lantern" size={12} />{nPlaces} chốn</span>}
        </p>
      </div>
    </article>
  );
}
