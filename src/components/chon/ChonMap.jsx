import { useEffect, useRef, useState } from 'react';
import AppIcon from '../AppIcon';
import { useTheme } from '../../contexts/ThemeContext';
import { hasCoords, placeState } from '../../utils/placeLogic';

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
const DEFAULT_CENTER = [10.7769, 106.7009]; // trung tâm TP.HCM khi chưa có gì để căn
const OSM_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
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
  mini = false, pin = null, onPinChange,
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
      }).setView(DEFAULT_CENTER, mini ? 13 : 12);
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
    // reduceMotion / mini chỉ đọc lúc tạo bản đồ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Khung đổi cỡ (đổi tab, mở cột) → Leaflet phải đo lại
  useEffect(() => {
    if (!ready || !boxRef.current || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => mapRef.current?.invalidateSize());
    ro.observe(boxRef.current);
    return () => ro.disconnect();
  }, [ready]);

  // ── Ghim các chốn ──
  useEffect(() => {
    if (!ready || mini) return;
    const L = LRef.current;
    const group = groupRef.current;
    group.clearLayers();
    const next = new Map();
    const pts = [];
    for (const p of places) {
      if (!hasCoords(p)) continue;
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
      pts.push([p.lat, p.lng]);
    }
    markersRef.current = next;
    // Căn khung một lần khi lần đầu có ghim; sau đó giữ nguyên chỗ user đang xem.
    if (!fittedRef.current && pts.length) {
      fittedRef.current = true;
      if (pts.length === 1) mapRef.current.setView(pts[0], 15);
      else mapRef.current.fitBounds(pts, { padding: [40, 40], maxZoom: 15 });
    }
  }, [ready, mini, places]);

  // Thẻ đang rê ↔ ghim sáng
  useEffect(() => {
    if (!ready) return;
    markersRef.current.forEach((m, id) => {
      const el = m.getElement();
      if (!el) return;
      el.classList.toggle('is-hot', id === hoveredId);
      if (id === hoveredId) m.setZIndexOffset(1000); else m.setZIndexOffset(0);
    });
  }, [ready, hoveredId, places]);

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

  const zoom = d => mapRef.current?.[d > 0 ? 'zoomIn' : 'zoomOut']();

  return (
    <div className={`chon-map${mini ? ' chon-map--mini' : ''}`}>
      <div ref={boxRef} className="chon-map__canvas" role="region" aria-label={mini ? 'Bản đồ chọn vị trí chốn' : 'Bản đồ chốn'} />
      {failed && <p className="chon-map__fail">Không tải được bản đồ. Kiểm tra mạng rồi mở lại trang.</p>}

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
          <button type="button" className="chon-map__btn" aria-label="Phóng to" onClick={() => zoom(1)}><AppIcon name="plus" size={17} /></button>
          <button type="button" className="chon-map__btn" aria-label="Thu nhỏ" onClick={() => zoom(-1)}><AppIcon name="minus" size={17} /></button>
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
