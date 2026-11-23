import { useEffect, useRef, useState } from 'react';
import AppIcon from '../AppIcon';
import { useTheme } from '../../contexts/ThemeContext';
import { hasCoords, placeState, clusterByGrid, distanceM, formatDistance, routeUrl } from '../../utils/placeLogic';

/**
 * Bản đồ Chốn — Leaflet + OpenStreetMap (docs/PLAN_CHON.md quyết định #1).
 * Leaflet tải lười (dynamic import) khi bản đồ hiện lần đầu, không vào chunk chính.
 * Ghim là divIcon HTML của app: muốn đến = đèn tắt (viền), đã đến = đèn sáng. Màu tối của nền
 * bản đồ do CSS (chon.css) — tile OSM gốc là bản sáng.
 *
 * Hai chế độ:
 *  - đầy đủ: `places`, `origin` (vị trí tôi), `hoveredId` (thẻ đang rê → ghim sáng), `focus`
 *    ({ points: [{lat,lng}] } → khung vừa các điểm), `onSelect(place)`, `layer` + `onLayer`, `onLocate`.
 *  - `mini` (form Lưu chốn): một ghim kéo được, chạm bản đồ để cắm; `pin`, `onPinChange`.
 */
// Chưa có gì để căn (không ghim, không vị trí, không chốn có toạ độ): toàn cảnh Việt Nam — không đoán thành phố.
const VN_CENTER = [16.2, 106.3];
const VN_ZOOM = 5;

/**
 * Vị trí của tôi CHỈ khi trình duyệt đã cho phép từ trước — không bật hộp hỏi quyền lúc mở bản đồ
 * (hỏi quyền chỉ khi user bấm "Gần tôi" / "Về vị trí của tôi" / "Dùng vị trí của tôi").
 */
async function silentPosition() {
  try {
    if (!navigator.geolocation || !navigator.permissions?.query) return null;
    const st = await navigator.permissions.query({ name: 'geolocation' });
    if (st.state !== 'granted') return null;
    return await new Promise(resolve => navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 },
    ));
  } catch {
    return null;
  }
}
const OSM_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';   // OSM bỏ tên miền phụ a/b/c
const OSM_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>';

const LANTERN_SVG = lit => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 2.5h4M12 2.5v2M12 17.5V20M10.5 21.5h3"/><rect x="6.5" y="4.5" width="11" height="13" rx="5.5"${lit ? ' fill="currentColor"' : ''}/><path d="M9.7 5c-.9 2.4-.9 9.6 0 12M14.3 5c.9 2.4.9 9.6 0 12"${lit ? ' stroke="#000" stroke-opacity="0.32"' : ''}/></svg>`;

let leafletPromise = null;
const loadLeaflet = () => {
  if (!leafletPromise) {
    leafletPromise = Promise.all([import('leaflet'), import('leaflet/dist/leaflet.css')]).then(([m]) => m.default || m);
  }
  return leafletPromise;
};

const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export default function ChonMap({
  places = [], origin = null, hoveredId = null, focus = null, onSelect, layer, onLayer, onLocate,
  mini = false, pin = null, onPinChange, fallbackCenter = null, missingCount = 0, caption = '',
}) {
  const { reduceMotion } = useTheme();
  const boxRef = useRef(null);
  const mapRef = useRef(null);
  const LRef = useRef(null);
  const markersRef = useRef(new Map());   // place id → marker
  const groupRef = useRef(null);
  const meRef = useRef(null);
  const pinRef = useRef(null);
  const fittedRef = useRef(false);
  const cbRef = useRef({ onSelect, onPinChange });
  useEffect(() => { cbRef.current = { onSelect, onPinChange }; }, [onSelect, onPinChange]);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  // ── Khởi tạo một lần ──
  useEffect(() => {
    let cancelled = false;
    loadLeaflet().then((L) => {
      if (cancelled || !boxRef.current) return;
      LRef.current = L;
      const map = L.map(boxRef.current, {
        zoomControl: false,
        attributionControl: true,
        scrollWheelZoom: !mini,
        zoomAnimation: !reduceMotion,
        fadeAnimation: !reduceMotion,
        markerZoomAnimation: !reduceMotion,
      }).setView(hasCoords(fallbackCenter) ? [fallbackCenter.lat, fallbackCenter.lng] : VN_CENTER,
        hasCoords(fallbackCenter) ? 13 : VN_ZOOM);
      L.tileLayer(OSM_URL, { maxZoom: 19, attribution: OSM_ATTR }).addTo(map);
      map.attributionControl.setPrefix(false);
      groupRef.current = L.layerGroup().addTo(map);
      if (mini) {
        map.on('click', e => cbRef.current.onPinChange?.({ lat: e.latlng.lat, lng: e.latlng.lng }));
      }
      mapRef.current = map;
      setReady(true);
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markersRef.current = new Map();
      pinRef.current = null;
      meRef.current = null;
    };
    // reduceMotion / mini / fallbackCenter chỉ đọc lúc tạo bản đồ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Chưa có ghim nào để căn và cũng không có chốn gợi ý → thử vị trí của tôi (chỉ khi đã được phép sẵn)
  useEffect(() => {
    if (!ready || hasCoords(fallbackCenter) || hasCoords(pin) || places.some(hasCoords)) return undefined;
    let alive = true;
    silentPosition().then(pos => {
      if (!alive || !pos || !mapRef.current || fittedRef.current || pinRef.current) return;
      mapRef.current.setView([pos.lat, pos.lng], mini ? 15 : 13);
    });
    return () => { alive = false; };
    // chỉ thử một lần lúc bản đồ sẵn sàng
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // Khung đổi cỡ (đổi tab, mở cột) → Leaflet phải đo lại
  useEffect(() => {
    if (!ready || !boxRef.current || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => mapRef.current?.invalidateSize());
    ro.observe(boxRef.current);
    return () => ro.disconnect();
  }, [ready]);

  // Mức zoom hiện tại → gom ghim thành bong bóng ở zoom xa
  const [zoom, setZoom] = useState(12);
  useEffect(() => {
    if (!ready || mini) return undefined;
    const map = mapRef.current;
    const onZoom = () => setZoom(map.getZoom());
    map.on('zoomend', onZoom);
    return () => { map.off('zoomend', onZoom); };
  }, [ready, mini]);

  // ── Ghim các chốn (+ bong bóng cụm) ──
  useEffect(() => {
    if (!ready || mini) return;
    const L = LRef.current;
    const map = mapRef.current;
    const group = groupRef.current;
    group.clearLayers();
    const next = new Map();
    const pts = places.filter(hasCoords).map(p => [p.lat, p.lng]);
    const { singles, clusters } = clusterByGrid(places, map.getZoom());

    for (const c of clusters) {
      const n = c.places.length;
      const litAll = c.places.every(p => placeState(p).state === 'visited');
      const m = L.marker([c.center.lat, c.center.lng], {
        icon: L.divIcon({
          className: `chon-cluster${litAll ? ' is-lit' : ''}`,
          html: `<span class="chon-cluster__dot">${n}</span>`,
          iconSize: [44, 44],
          iconAnchor: [22, 22],
        }),
        keyboard: true,
        title: `${n} chốn`,
        alt: `Cụm ${n} chốn — mở danh sách`,
        riseOnHover: true,
      });
      // Thẻ cụm (mockup 2A): "Quận 4 · 3 chốn trong 900 m", danh sách (bấm = mở chốn), Mở lộ trình N điểm, Phóng to.
      const area = c.places.find(p => p.area)?.area || '';
      let span = 0;
      c.places.forEach((a, i) => c.places.slice(i + 1).forEach(b => { span = Math.max(span, distanceM(a, b)); }));
      const route = routeUrl(c.places);
      const html = `<div class="chon-cpop">
        <p class="chon-cpop__head">${escapeHtml([area, `${n} chốn trong ${formatDistance(Math.max(span, 50))}`].filter(Boolean).join(' · '))}</p>
        <ul class="chon-cpop__list">${c.places.slice(0, 8).map(p => `<li><button type="button" data-id="${escapeHtml(p.id)}">
          <span class="chon-cpop__dot${placeState(p).state === 'visited' ? ' is-lit' : ''}" aria-hidden="true"></span>${escapeHtml(p.name)}</button></li>`).join('')}
          ${n > 8 ? `<li class="chon-cpop__more">+${n - 8} chốn nữa</li>` : ''}</ul>
        ${route ? `<a class="chon-cpop__route" href="${escapeHtml(route)}" target="_blank" rel="noopener noreferrer">Mở lộ trình ${Math.min(n, 10)} điểm</a>` : ''}
        <button type="button" class="chon-cpop__zoom" data-act="zoom">Phóng to vùng này</button>
      </div>`;
      m.bindPopup(html, { className: 'chon-cpop-wrap', closeButton: true, maxWidth: 280, minWidth: 240, offset: [0, -14] });
      m.on('popupopen', (e) => {
        const el = e.popup.getElement();
        el?.querySelectorAll('[data-id]').forEach(btn => btn.addEventListener('click', () => {
          const p = c.places.find(x => String(x.id) === btn.dataset.id);
          map.closePopup();
          if (p) cbRef.current.onSelect?.(p);
        }));
        el?.querySelector('[data-act="zoom"]')?.addEventListener('click', () => {
          map.closePopup();
          const b = c.places.map(p => [p.lat, p.lng]);
          const same = b.every(([la, ln]) => Math.abs(la - b[0][0]) < 1e-5 && Math.abs(ln - b[0][1]) < 1e-5);
          if (same) map.setView(b[0], Math.min(map.getZoom() + 3, 18));
          else map.fitBounds(b, { padding: [60, 60], maxZoom: 17 });
        });
      });
      m.addTo(group);
      c.places.forEach(p => next.set(p.id, m));   // rê thẻ của chốn trong cụm → bong bóng sáng
    }

    for (const p of singles) {
      const lit = placeState(p).state === 'visited';
      const icon = L.divIcon({
        className: `chon-pin${lit ? ' is-lit' : ''}`,
        html: `<span class="chon-pin__dot">${LANTERN_SVG(lit)}</span>`,
        iconSize: [38, 38],
        iconAnchor: [19, 19],
      });
      const m = L.marker([p.lat, p.lng], {
        icon, keyboard: true, title: p.name, alt: `${p.name}, ${lit ? 'đã đến' : 'muốn đến'}`, riseOnHover: true,
      });
      m.bindTooltip(escapeHtml(p.name), { direction: 'top', offset: [0, -18], className: 'chon-map-tip' });
      m.on('click', () => cbRef.current.onSelect?.(p));
      m.addTo(group);
      next.set(p.id, m);
    }
    markersRef.current = next;
    // Căn khung một lần khi lần đầu có ghim; sau đó giữ nguyên chỗ user đang xem. Đổi zoom → zoomend → vẽ lại
    // với cụm mới (zoom nằm trong deps).
    if (!fittedRef.current && pts.length) {
      fittedRef.current = true;
      if (pts.length === 1) map.setView(pts[0], 15);
      else map.fitBounds(pts, { padding: [40, 40], maxZoom: 15 });
    }
  }, [ready, mini, places, zoom]);

  // Thẻ đang rê ↔ ghim sáng (chốn nằm trong cụm → bong bóng của cụm sáng)
  useEffect(() => {
    if (!ready) return;
    const hot = hoveredId ? markersRef.current.get(hoveredId) : null;
    new Set(markersRef.current.values()).forEach((m) => {
      m.getElement()?.classList.toggle('is-hot', m === hot);
      m.setZIndexOffset(m === hot ? 1000 : 0);
    });
  }, [ready, hoveredId, places, zoom]);

  // Vị trí của tôi
  useEffect(() => {
    if (!ready || mini) return;
    const L = LRef.current;
    meRef.current?.remove();
    meRef.current = null;
    if (hasCoords(origin)) {
      meRef.current = L.marker([origin.lat, origin.lng], {
        icon: L.divIcon({ className: 'chon-me', html: '<span></span>', iconSize: [16, 16], iconAnchor: [8, 8] }),
        keyboard: false, interactive: false, alt: 'Vị trí của bạn',
      }).addTo(mapRef.current);
    }
  }, [ready, mini, origin]);

  // Căn tới cụm / chốn được yêu cầu
  useEffect(() => {
    if (!ready || !focus?.points?.length) return;
    const pts = focus.points.filter(hasCoords).map(p => [p.lat, p.lng]);
    if (!pts.length) return;
    if (pts.length === 1) mapRef.current.setView(pts[0], focus.zoom || 16);
    else mapRef.current.fitBounds(pts, { padding: [60, 60], maxZoom: 16 });
  }, [ready, focus]);

  // Chế độ mini: một ghim kéo được
  useEffect(() => {
    if (!ready || !mini) return;
    const L = LRef.current;
    if (!hasCoords(pin)) {
      pinRef.current?.remove();
      pinRef.current = null;
      return;
    }
    if (!pinRef.current) {
      pinRef.current = L.marker([pin.lat, pin.lng], {
        draggable: true,
        icon: L.divIcon({ className: 'chon-pin chon-pin--drop', html: `<span class="chon-pin__dot">${LANTERN_SVG(true)}</span>`, iconSize: [38, 38], iconAnchor: [19, 19] }),
        alt: 'Vị trí chốn — kéo để chỉnh',
      }).addTo(mapRef.current);
      pinRef.current.on('dragend', e => {
        const ll = e.target.getLatLng();
        cbRef.current.onPinChange?.({ lat: ll.lat, lng: ll.lng });
      });
      mapRef.current.setView([pin.lat, pin.lng], Math.max(mapRef.current.getZoom(), 16));
    } else {
      const cur = pinRef.current.getLatLng();
      if (Math.abs(cur.lat - pin.lat) > 1e-7 || Math.abs(cur.lng - pin.lng) > 1e-7) {
        pinRef.current.setLatLng([pin.lat, pin.lng]);
        mapRef.current.panTo([pin.lat, pin.lng]);
      }
    }
  }, [ready, mini, pin]);

  const zoomBy = d => mapRef.current?.[d > 0 ? 'zoomIn' : 'zoomOut']();

  return (
    <div className={`chon-map${mini ? ' chon-map--mini' : ''}`}>
      <div ref={boxRef} className="chon-map__canvas" role="region" aria-label={mini ? 'Bản đồ chọn vị trí chốn' : 'Bản đồ chốn'} />
      {mini && (
        <>
          <span className="chon-map__chip" aria-hidden="true">{hasCoords(pin) ? 'Kéo ghim cho đúng' : 'Chạm để cắm ghim'}</span>
          {/* caption: một ô nhập (thanh địa chỉ của form Lưu chốn) — label để bấm cả thanh là vào ô */}
          {caption && (
            <label className="chon-map__caption"><AppIcon name="mapPin" size={14} />{caption}</label>
          )}
        </>
      )}
      {failed && <p className="chon-map__fail">Không tải được bản đồ. Kiểm tra mạng rồi mở lại trang.</p>}
      {!mini && missingCount > 0 && (
        <p className="chon-map__missing" role="status">
          <AppIcon name="mapPin" size={14} />
          {missingCount === places.length && !places.some(hasCoords)
            ? `${missingCount} chốn chưa có vị trí nên chưa hiện trên bản đồ.`
            : `${missingCount} chốn chưa có vị trí.`}
          {' '}Sửa chốn → dán link Google Maps đầy đủ hoặc cắm ghim.
        </p>
      )}

      {!mini && onLayer && (
        <div className="chon-map__layers chon-seg" role="group" aria-label="Lớp bản đồ">
          {[['want', 'Muốn đến'], ['visited', 'Đã đến'], ['all', 'Tất cả']].map(([id, label]) => (
            <button key={id} type="button" className={`chon-seg__btn${layer === id ? ' is-on' : ''}`}
              aria-pressed={layer === id} onClick={() => onLayer(id)}>{label}</button>
          ))}
        </div>
      )}
      {!mini && onLocate && (
        <button type="button" className="chon-map__btn chon-map__locate" aria-label="Về vị trí của tôi" onClick={onLocate}>
          <AppIcon name="crosshair" size={18} />
        </button>
      )}
      {!mini && (
        <div className="chon-map__zoom">
          <button type="button" className="chon-map__btn" aria-label="Phóng to" onClick={() => zoomBy(1)}><AppIcon name="plus" size={17} /></button>
          <button type="button" className="chon-map__btn" aria-label="Thu nhỏ" onClick={() => zoomBy(-1)}><AppIcon name="minus" size={17} /></button>
        </div>
      )}
      {!mini && (
        <div className="chon-map__legend" aria-hidden="true">
          <span><i className="chon-legend-dot" />Muốn đến</span>
          <span><i className="chon-legend-dot is-lit" />Đã đến</span>
        </div>
      )}
    </div>
  );
}
