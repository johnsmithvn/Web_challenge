import { useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { usePlaces } from '../hooks/usePlaces';
import { useTrips } from '../hooks/useTrips';
import { useCollections } from '../hooks/useCollections';
import { useIsMobile } from '../hooks/useIsMobile';
import { useConfirm } from '../components/ConfirmModal';
import SkyBackground from '../components/SkyBackground';
import SkeletonList from '../components/SkeletonList';
import AppIcon from '../components/AppIcon';
import ActionMenu from '../components/ActionMenu';
import SearchSelect from '../components/SearchSelect';
import ChonPlaceCard from '../components/chon/ChonPlaceCard';
import ChonCaptureSheet from '../components/chon/ChonCaptureSheet';
import ChonLightSheet from '../components/chon/ChonLightSheet';
import ChonPlaceDetail from '../components/chon/ChonPlaceDetail';
import ChonMap from '../components/chon/ChonMap';
import ChonLayer from '../components/chon/ChonLayer';
import ChonTripCard from '../components/chon/ChonTripCard';
import ChonTripSheet from '../components/chon/ChonTripSheet';
import { KINDS, OCCASIONS, kindOf, DEFAULT_FINANCE_CATS } from '../components/chon/chonData';
import { mergeCategoryOverrides } from '../utils/financeLogic';
import { formatTripRange } from '../utils/tripLogic';
import {
  filterPlaces, sortPlaces, placeState, areaOptions, nearbyClusters, formatDistance, directionsUrl, timeAgo,
} from '../utils/placeLogic';
import { toDateStr } from '../utils/dateUtils';
import '../styles/chon.css';

// Hộp Hẹn ngày và trang Chuyến đi kéo useUserTasks → chỉ tải khi mở. Thư viện Leaflet do ChonMap tự tải lười.
const ChonPlanDialog = lazy(() => import('../components/chon/ChonPlanDialog'));
const ChonTripView = lazy(() => import('../components/chon/ChonTripView'));

/** Form Lưu chốn điền sẵn từ Chia sẻ Android (?share=1&title=&text=&url=), hoặc null. */
const shareFromQuery = (search) => {
  const qs = new URLSearchParams(search);
  if (!qs.get('share')) return null;
  const text = qs.get('text') || '';
  const urlInText = text.match(/https?:\/\/\S+/)?.[0] || '';
  const url = qs.get('url') || urlInText;
  const quote = [qs.get('title'), text.replace(urlInText, '')].filter(Boolean).join(' ').trim();
  return { prefill: { url, quote, name: '' } };
};

const isTyping = el => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);

/**
 * Chốn — nơi muốn đến & nơi đã qua (docs/PLAN_CHON.md, mockup 2A–2D). Auth-only.
 * Route /chon (danh sách + bản đồ), /chon/:placeId (chi tiết, Back của điện thoại chạy đúng) và
 * /chon/trip/:tripId (Chuyến đi, mockup 2E). Lớp nổi render qua ChonLayer (portal) để không bị tab đáy che.
 * Chia sẻ Android (manifest share_target) mở /chon?share=1&title=&text=&url= → form Lưu chốn điền sẵn.
 */
export default function ChonPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { confirm, ConfirmModal } = useConfirm();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const location = useLocation();
  const { placeId, tripId } = useParams();
  const today = toDateStr();

  const {
    places, trash, isLoading, loadError, fetchPlaces, addPlace, updatePlace, archivePlace, restorePlace, deletePlace,
    addSource, deleteSource, lightPlace, updateVisit, deleteVisit, setPlanTask, fetchCategoryOverrides,
  } = usePlaces();
  const tripApi = useTrips();
  const { trips, tripTrash, tripsLoading, fetchTrips, addTrip, updateTrip, archiveTrip, restoreTrip, deleteTrip } = tripApi;
  const { addItem: addArticle, fetchLinkOptions } = useCollections();

  // ── Lọc / xem ──
  const [tab, setTab] = useState('want');            // want | visited | trips | trash; điện thoại thêm 'map'
  const [kind, setKind] = useState('');
  const [area, setArea] = useState('');
  const [occasion, setOccasion] = useState('');
  const [query, setQuery] = useState('');
  const [near, setNear] = useState(false);
  const [origin, setOrigin] = useState(null);
  const [locating, setLocating] = useState(false);
  const [mapLayer, setMapLayer] = useState('want');
  const [mapFocus, setMapFocus] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);
  const searchRef = useRef(null);

  // ── Hộp thoại ──
  const [capture, setCapture] = useState(() => shareFromQuery(location.search)); // { place?, prefill? }
  const [lighting, setLighting] = useState(null);    // place
  const [editingVisit, setEditingVisit] = useState(null); // { place, visit }
  const [planning, setPlanning] = useState(null);    // place
  const [menu, setMenu] = useState(null);            // { place, at }
  const [tripSheet, setTripSheet] = useState(null);  // { trip?, prefill? }

  useEffect(() => { if (user) { fetchPlaces(); fetchTrips(); } }, [user, fetchPlaces, fetchTrips]);

  // Danh mục Tài chính theo tuỳ chỉnh của user (tên, mức cần thiết) cho Thắp đèn / Chốt chuyến
  const [finCats, setFinCats] = useState(DEFAULT_FINANCE_CATS);
  useEffect(() => {
    if (!user) return undefined;
    let alive = true;
    fetchCategoryOverrides().then(rows => { if (alive) setFinCats(mergeCategoryOverrides(DEFAULT_FINANCE_CATS, rows)); });
    return () => { alive = false; };
  }, [user, fetchCategoryOverrides]);

  // Chia sẻ từ Android: form đã mở sẵn lúc vào trang (shareFromQuery); xoá query để tải lại không mở lại.
  useEffect(() => {
    if (new URLSearchParams(location.search).get('share')) navigate(location.pathname, { replace: true });
  }, [location.search, location.pathname, navigate]);

  const list = useMemo(() => {
    if (tab === 'trash' || tab === 'trips') return [];
    const visible = filterPlaces(places, { tab: tab === 'map' ? 'all' : tab, kind, area, occasion, query });
    return sortPlaces(visible, near && origin ? 'near' : 'recent', origin);
  }, [places, tab, kind, area, occasion, query, near, origin]);
  const counts = useMemo(() => {
    let want = 0, visited = 0;
    for (const p of places) placeState(p).state === 'visited' ? visited++ : want++;
    return { want, visited };
  }, [places]);
  const kindCounts = useMemo(() => {
    const scope = filterPlaces(places, { tab: tab === 'visited' ? 'visited' : 'want' });
    const m = {};
    scope.forEach(p => { m[p.kind] = (m[p.kind] || 0) + 1; });
    return m;
  }, [places, tab]);
  const areas = useMemo(() => areaOptions(places), [places]);
  const cluster = useMemo(() => nearbyClusters(filterPlaces(places, { tab: 'want' }))[0] || null, [places]);
  const mapPlaces = useMemo(
    () => (isMobile ? list : filterPlaces(places, { tab: mapLayer, kind, area, occasion, query })),
    [isMobile, list, places, mapLayer, kind, area, occasion, query],
  );
  // Chốn mới nhất có toạ độ: tâm bản đồ khi chưa có gì khác để căn (thay vì đóng cứng một thành phố)
  const recentCenter = useMemo(() => {
    const p = places.find(x => Number.isFinite(x.lat) && Number.isFinite(x.lng));
    return p ? { lat: p.lat, lng: p.lng } : null;
  }, [places]);
  const missingCoords = useMemo(() => mapPlaces.filter(p => !Number.isFinite(p.lat)).length, [mapPlaces]);
  const detail = placeId ? (places.find(p => p.id === placeId) || null) : null;
  const openTrip = tripId ? (trips.find(t => t.id === tripId) || null) : null;
  // Chốn đích → chuyến (thẻ "Hà Giang loop" có link sang chuyến của nó)
  const tripByPlace = useMemo(() => {
    const m = new Map();
    trips.forEach(t => { if (t.place_id && !m.has(t.place_id)) m.set(t.place_id, t); });
    return m;
  }, [trips]);
  const sortedTrips = useMemo(() => {
    const rank = { planning: 0, booked: 0, done: 1, cancelled: 2 };
    return [...trips].sort((a, b) => rank[a.status] - rank[b.status]
      || (rank[a.status] === 1 ? String(b.start_date || '').localeCompare(String(a.start_date || ''))
        : String(a.start_date || '9999').localeCompare(String(b.start_date || '9999'))));
  }, [trips]);
  const hasFilter = !!(kind || area || occasion || query);

  // ── Vị trí ──
  const locate = useCallback((then) => {
    if (!navigator.geolocation) { showToast('Trình duyệt này không lấy được vị trí.', { icon: 'warning' }); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const o = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setOrigin(o);
        then?.(o);
      },
      (err) => {
        setLocating(false);
        setNear(false);
        showToast(err.code === 1
          ? 'Bạn đã chặn quyền vị trí. Bật lại trong cài đặt trang của trình duyệt để dùng Gần tôi.'
          : 'Chưa lấy được vị trí. Thử lại sau.', { icon: 'warning' });
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  }, [showToast]);

  const toggleNear = () => {
    if (near) { setNear(false); return; }
    setNear(true);
    if (!origin) locate();
  };

  // ── Thao tác ──
  // Mở chi tiết nhớ trang đang đứng (vd trang chuyến) để Đóng quay về đúng chỗ; chi tiết → chi tiết giữ nguyên gốc.
  const openPlace = useCallback(p => navigate(`/chon/${p.id}`, {
    state: { from: location.state?.from || (location.pathname.startsWith('/chon/trip/') ? location.pathname : '/chon') },
  }), [navigate, location.pathname, location.state]);
  const closeDetail = useCallback(() => navigate(location.state?.from || '/chon'), [navigate, location.state]);

  const showCluster = useCallback((pts) => {
    setMapFocus({ points: pts, at: Date.now() });
    if (isMobile) { setTab('map'); if (placeId) navigate('/chon'); }
  }, [isMobile, placeId, navigate]);

  const handleSave = useCallback(async (fields, source, { plan } = {}) => {
    if (capture?.place) {
      const r = await updatePlace(capture.place.id, fields);
      if (r.error) { showToast(r.error, { icon: 'warning' }); return false; }
      showToast('Đã lưu thay đổi');
      return true;
    }
    const r = await addPlace(fields, source);
    if (r.error) { showToast(r.error, { icon: 'warning' }); return false; }
    showToast(`Đã lưu “${r.data.name}” vào Muốn đến`, { icon: 'checkCircle' });
    if (tab !== 'want' && tab !== 'map') setTab('want');
    if (plan) setPlanning(r.data);
    return true;
  }, [capture, updatePlace, addPlace, showToast, tab]);

  const handleMerge = useCallback(async (existing, source) => {
    if (!source) { showToast(`“${existing.name}” đã có trong danh sách`); openPlace(existing); return true; }
    const r = await addSource(existing.id, source);
    if (r.error) { showToast(r.error, { icon: 'warning' }); return false; }
    showToast(`Đã thêm lời giới thiệu vào “${existing.name}”`);
    openPlace(existing);
    return true;
  }, [addSource, showToast, openPlace]);

  const handleLight = useCallback(async (visit, finance) => {
    const p = lighting;
    const r = await lightPlace(p.id, visit, finance);
    if (r.error) { showToast(r.error, { icon: 'warning' }); return false; }
    showToast(finance ? `Đã thắp đèn “${p.name}” · ghi vào Tài chính` : `Đã thắp đèn “${p.name}”`, { icon: 'checkCircle' });
    return true;
  }, [lighting, lightPlace, showToast]);

  const handleTrash = useCallback(async (p) => {
    const r = await archivePlace(p);
    if (r.error) { showToast(r.error, { icon: 'warning' }); return; }
    if (placeId === p.id) closeDetail();
    showToast(`Đã bỏ “${p.name}” vào thùng rác`);
  }, [archivePlace, showToast, placeId, closeDetail]);

  const handleDeleteForever = useCallback(async (p) => {
    const ok = await confirm({
      title: `Xoá vĩnh viễn “${p.name}”?`,
      message: 'Chốn, lời giới thiệu và các lần ghé mất hẳn, không khôi phục được. Giao dịch đã ghi bên Tài chính vẫn giữ.',
      confirmLabel: 'Xoá vĩnh viễn',
      danger: true,
    });
    if (!ok) return;
    const r = await deletePlace(p.id);
    if (r.error) showToast(r.error, { icon: 'warning' });
  }, [confirm, deletePlace, showToast]);

  const handleEditVisit = useCallback(async (value) => {
    const { place: p, visit: v } = editingVisit;
    const r = await updateVisit(p.id, v.id, value);
    if (r.error) { showToast(r.error, { icon: 'warning' }); return false; }
    showToast('Đã lưu lần ghé');
    return true;
  }, [editingVisit, updateVisit, showToast]);

  const handleDeleteVisit = useCallback(async (p, v) => {
    const ok = await confirm({
      title: 'Xoá lần ghé này?',
      message: v.finance_tx_id
        ? 'Cảm nhận của lần ghé mất hẳn. Giao dịch đã ghi bên Tài chính KHÔNG bị xoá — xoá ở Tài chính nếu cần.'
        : 'Cảm nhận của lần ghé mất hẳn, không khôi phục được.',
      confirmLabel: 'Xoá',
      danger: true,
    });
    if (!ok) return;
    const r = await deleteVisit(p.id, v.id);
    if (r.error) showToast(r.error, { icon: 'warning' });
  }, [confirm, deleteVisit, showToast]);

  const handleDeleteSource = useCallback(async (p, s) => {
    const ok = await confirm({ title: 'Xoá lời giới thiệu này?', confirmLabel: 'Xoá', danger: true });
    if (!ok) return;
    const r = await deleteSource(p.id, s.id);
    if (r.error) showToast(r.error, { icon: 'warning' });
  }, [confirm, deleteSource, showToast]);

  const handleAddSource = useCallback(async (id, source) => {
    const r = await addSource(id, source);
    if (r.error) { showToast(r.error, { icon: 'warning' }); return false; }
    return true;
  }, [addSource, showToast]);

  const handlePlanned = useCallback(async (task) => {
    const r = await setPlanTask(planning.id, task);
    if (r.error) showToast(r.error, { icon: 'warning' });
    else showToast(`Đã thêm “${task.title}” vào Nhiệm vụ`, { icon: 'calendar' });
  }, [planning, setPlanTask, showToast]);

  const handleShare = useCallback(async (p) => {
    const text = [p.name, p.address || p.area].filter(Boolean).join(' · ');
    const url = directionsUrl(p);
    try {
      if (navigator.share) { await navigator.share({ title: p.name, text, url }); return; }
      await navigator.clipboard.writeText(`${text}\n${url}`);
      showToast('Đã chép tên + link chỉ đường để gửi bạn');
    } catch (err) {
      if (err?.name !== 'AbortError') showToast('Chưa chia sẻ được. Thử lại.', { icon: 'warning' });
    }
  }, [showToast]);

  const handleWriteArticle = useCallback(async (p) => {
    const lines = [`# ${p.name}`, ''];
    if (p.address || p.area) lines.push(`📍 ${[p.address, p.area].filter(Boolean).join(', ')}`, '');
    (p.place_sources || []).filter(s => s.quote).forEach(s => lines.push(`> ${s.quote}${s.author ? ` — ${s.author}` : ''}`, ''));
    [...(p.place_visits || [])].sort((a, b) => a.visited_on.localeCompare(b.visited_on)).forEach(v => {
      if (v.note) lines.push(`**${v.visited_on}**${v.rating ? ` · ${v.rating}/5` : ''}`, '', v.note, '');
    });
    const article = await addArticle({ title: p.name, body: lines.join('\n'), body_text: lines.join('\n'), content_format: 'markdown', status: 'read' });
    if (!article) { showToast('Chưa tạo được bài Kiến thức. Thử lại.', { icon: 'warning' }); return; }
    await addSource(p.id, { platform: 'other', url: null, author: '', quote: '', collection_id: article.id });
    navigate('/collect', { state: { openArticleId: article.id } });
  }, [addArticle, addSource, navigate, showToast]);

  const menuItems = menu ? [
    { key: 'open', icon: 'external', label: 'Mở chi tiết', onSelect: () => openPlace(menu.place) },
    { key: 'edit', icon: 'pencil', label: 'Sửa', onSelect: () => setCapture({ place: menu.place }) },
    { key: 'light', icon: 'lantern', label: placeState(menu.place).state === 'visited' ? 'Thắp thêm một lần' : 'Thắp đèn · đã đến', onSelect: () => setLighting(menu.place) },
    { key: 'plan', icon: 'calendar', label: 'Hẹn ngày', onSelect: () => setPlanning(menu.place) },
    { key: 'dir', icon: 'navigationArrow', label: 'Chỉ đường', onSelect: () => window.open(directionsUrl(menu.place), '_blank', 'noopener,noreferrer') },
    { key: 'share', icon: 'share', label: 'Rủ bạn', onSelect: () => handleShare(menu.place) },
    { key: 'trash', icon: 'trash', label: 'Bỏ vào thùng rác', danger: true, divider: true, onSelect: () => handleTrash(menu.place) },
  ] : [];

  // ── Chuyến đi ──
  const goTrip = useCallback(t => navigate(`/chon/trip/${t.id}`), [navigate]);
  const backToTrips = useCallback(() => { setTab('trips'); navigate('/chon'); }, [navigate]);

  const handleSaveTrip = useCallback(async (fields) => {
    if (tripSheet?.trip) {
      const r = await updateTrip(tripSheet.trip.id, fields);
      if (r.error) { showToast(r.error, { icon: 'warning' }); return false; }
      return true;
    }
    const r = await addTrip(fields);
    if (r.error) { showToast(r.error, { icon: 'warning' }); return false; }
    showToast(`Đã tạo chuyến “${r.data.title}”`, { icon: 'checkCircle' });
    goTrip(r.data);
    return true;
  }, [tripSheet, updateTrip, addTrip, showToast, goTrip]);

  const handleTrashTrip = useCallback(async (t) => {
    const r = await archiveTrip(t);
    if (r.error) { showToast(r.error, { icon: 'warning' }); return; }
    showToast(`Đã bỏ chuyến “${t.title}” vào thùng rác`);
    if (tripId === t.id) backToTrips();
  }, [archiveTrip, showToast, tripId, backToTrips]);

  const handleDeleteTripForever = useCallback(async (t) => {
    const ok = await confirm({
      title: `Xoá vĩnh viễn chuyến “${t.title}”?`,
      message: 'Các lựa chọn tour và lịch chốn của chuyến mất hẳn. Chốn, việc bên Nhiệm vụ và giao dịch bên Tài chính vẫn giữ.',
      confirmLabel: 'Xoá vĩnh viễn',
      danger: true,
    });
    if (!ok) return;
    const r = await deleteTrip(t.id);
    if (r.error) showToast(r.error, { icon: 'warning' });
  }, [confirm, deleteTrip, showToast]);

  const shareTrip = useCallback(async (t) => {
    const text = [`${t.title}${t.tagline ? ` — ${t.tagline}` : ''}`, formatTripRange(t), `${t.people} người`].join(' · ');
    try {
      if (navigator.share) { await navigator.share({ title: t.title, text }); return; }
      await navigator.clipboard.writeText(text);
      showToast('Đã chép thông tin chuyến để gửi bạn');
    } catch (err) {
      if (err?.name !== 'AbortError') showToast('Chưa chia sẻ được. Thử lại.', { icon: 'warning' });
    }
  }, [showToast]);

  const planTripFor = useCallback(p => setTripSheet({ prefill: { title: p.name, region: p.area, place_id: p.id } }), []);

  const anyModal = !!(capture || lighting || editingVisit || planning || menu || detail || tripSheet || tripId);

  // Phím tắt: / tìm, N lưu chốn
  useEffect(() => {
    const onKey = (e) => {
      if (anyModal || isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === '/') { e.preventDefault(); searchRef.current?.focus(); }
      else if (e.key === 'n' || e.key === 'N') { e.preventDefault(); setCapture({}); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [anyModal]);

  if (!user) {
    return (
      <div className="chon-page">
        <SkyBackground isMobile={isMobile} calm />
        <div className="chon-guest">
          <AppIcon name="lantern" size={44} />
          <h1 className="chon-guest__title">Chốn</h1>
          <p>Lưu quán ăn, quán cà phê, chỗ đi chơi bạn muốn đến. Tới nơi thì thắp đèn và ghi lại cảm nhận.</p>
          <p className="chon-faint">Đăng nhập để dùng Chốn.</p>
        </div>
      </div>
    );
  }

  const showMapPane = (!isMobile || tab === 'map') && tab !== 'trips';
  const listTab = tab === 'map' ? null : tab;

  // Lớp nổi dùng chung cho danh sách và trang chuyến — render qua portal (ChonLayer)
  const overlays = (
    <ChonLayer>
      {ConfirmModal}
      {menu && <ActionMenu at={menu.at} items={menuItems} onClose={() => setMenu(null)} label={`Thao tác với ${menu.place.name}`} />}

      {placeId && !detail && !isLoading && (
        <div className="chon-detail-backdrop" onMouseDown={closeDetail}>
          <div className="chon-empty chon-empty--float">
            <p>Không thấy chốn này — có thể đã vào thùng rác.</p>
            <button type="button" className="chon-btn chon-btn--soft" onClick={closeDetail}>Về danh sách</button>
          </div>
        </div>
      )}

      {detail && (
        <ChonPlaceDetail
          place={detail}
          places={places}
          origin={origin}
          today={today}
          trip={tripByPlace.get(detail.id) || null}
          onOpenTrip={goTrip}
          onPlanTrip={planTripFor}
          onClose={closeDetail}
          onEdit={p => setCapture({ place: p })}
          onMenu={(p, at) => setMenu({ place: p, at })}
          onLight={setLighting}
          onPlan={setPlanning}
          onShare={handleShare}
          onShowCluster={showCluster}
          onOpenPlace={openPlace}
          onAddSource={handleAddSource}
          onDeleteSource={handleDeleteSource}
          onEditVisit={(p, v) => setEditingVisit({ place: p, visit: v })}
          onDeleteVisit={handleDeleteVisit}
          onWriteArticle={handleWriteArticle}
          fetchArticles={fetchLinkOptions}
        />
      )}

      {capture && (
        <ChonCaptureSheet
          place={capture.place || null}
          prefill={capture.prefill}
          places={places}
          onSave={handleSave}
          onMerge={handleMerge}
          onClose={() => setCapture(null)}
        />
      )}

      {lighting && <ChonLightSheet place={lighting} finCats={finCats} onSave={handleLight} onClose={() => setLighting(null)} />}
      {editingVisit && (
        <ChonLightSheet place={editingVisit.place} visit={editingVisit.visit} finCats={finCats}
          onSave={handleEditVisit} onClose={() => setEditingVisit(null)} />
      )}

      {tripSheet && (
        <ChonTripSheet
          trip={tripSheet.trip || null}
          prefill={tripSheet.prefill}
          places={places}
          onSave={handleSaveTrip}
          onClose={() => setTripSheet(null)}
        />
      )}

      {planning && (
        <Suspense fallback={null}>
          <ChonPlanDialog
            place={planning}
            onPlanned={handlePlanned}
            onError={msg => showToast(msg, { icon: 'warning' })}
            onClose={() => setPlanning(null)}
          />
        </Suspense>
      )}
    </ChonLayer>
  );

  if (tripId) {
    return (
      <div className="chon-page">
        <SkyBackground isMobile={isMobile} calm />
        <div className="chon-shell chon-shell--trip">
          {openTrip ? (
            <Suspense fallback={<SkeletonList rows={3} lines={2} right={false} label="Đang tải chuyến đi" />}>
              <ChonTripView
                key={openTrip.id}
                trip={openTrip}
                trips={trips}
                places={places}
                today={today}
                api={tripApi}
                finCats={finCats}
                onBack={backToTrips}
                onEdit={() => setTripSheet({ trip: openTrip })}
                onTrash={() => handleTrashTrip(openTrip)}
                onShare={() => shareTrip(openTrip)}
                onOpenPlace={openPlace}
                onLightPlace={setLighting}
                onToast={msg => showToast(msg)}
              />
            </Suspense>
          ) : tripsLoading ? (
            <SkeletonList rows={3} lines={2} right={false} label="Đang tải chuyến đi" />
          ) : (
            <div className="chon-empty">
              <p>Không thấy chuyến này — có thể đã vào thùng rác.</p>
              <button type="button" className="chon-btn chon-btn--soft" onClick={backToTrips}>Về danh sách chuyến</button>
            </div>
          )}
        </div>
        {overlays}
      </div>
    );
  }

  const onTrips = tab === 'trips';

  return (
    <div className="chon-page">
      <SkyBackground isMobile={isMobile} calm />

      <div className="chon-shell">
        <header className="chon-header">
          <div className="chon-brand">
            <span className="chon-brand__icon" aria-hidden="true"><AppIcon name="lantern" size={23} /></span>
            <div>
              <h1 className="chon-brand__title">Chốn</h1>
              <p className="chon-brand__sub">Nơi muốn đến <em>&amp;</em> nơi đã qua</p>
            </div>
          </div>
          <label className="chon-search">
            <AppIcon name="search" size={17} />
            <input ref={searchRef} type="search" value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Tìm quán, món, khu vực, người giới thiệu…" aria-label="Tìm chốn" />
            {!isMobile && <kbd>/</kbd>}
          </label>
          {onTrips ? (
            <button type="button" className="chon-btn chon-btn--lamp chon-header__add" onClick={() => setTripSheet({})} aria-label="Lên chuyến đi">
              <AppIcon name="plus" size={17} weight="bold" /><span className="chon-header__add-label">Lên chuyến đi</span>
            </button>
          ) : (
            <button type="button" className="chon-btn chon-btn--lamp chon-header__add" onClick={() => setCapture({})} aria-label="Lưu chốn">
              <AppIcon name="plus" size={17} weight="bold" /><span className="chon-header__add-label">Lưu chốn</span>
            </button>
          )}
        </header>

        <div className="chon-tabs" role="tablist" aria-label="Chốn">
          <button type="button" role="tab" aria-selected={tab === 'want'} className={`chon-tab${tab === 'want' ? ' is-on' : ''}`} onClick={() => setTab('want')}>
            <AppIcon name="lantern" size={17} />Muốn đến<span className="chon-tab__count">{counts.want}</span>
          </button>
          <button type="button" role="tab" aria-selected={tab === 'visited'} className={`chon-tab${tab === 'visited' ? ' is-on' : ''}`} onClick={() => setTab('visited')}>
            <AppIcon name="lantern" size={17} weight="fill" className="chon-tab__lit" />Đã đến<span className="chon-tab__count">{counts.visited}</span>
          </button>
          <button type="button" role="tab" aria-selected={onTrips} className={`chon-tab${onTrips ? ' is-on' : ''}`} onClick={() => setTab('trips')}>
            <AppIcon name="flag" size={17} />Chuyến đi<span className="chon-tab__count">{trips.length}</span>
          </button>
          {isMobile && (
            <button type="button" role="tab" aria-selected={tab === 'map'} className={`chon-tab${tab === 'map' ? ' is-on' : ''}`} onClick={() => setTab('map')}>
              <AppIcon name="mapTrifold" size={17} />Bản đồ
            </button>
          )}
          <button type="button" role="tab" aria-selected={tab === 'trash'} aria-label="Thùng rác"
            className={`chon-tab chon-tab--end${tab === 'trash' ? ' is-on' : ''}`} onClick={() => setTab('trash')}>
            <AppIcon name="trash" size={16} />{!isMobile && 'Thùng rác'}
            {trash.length + tripTrash.length > 0 && <span className="chon-tab__count">{trash.length + tripTrash.length}</span>}
          </button>
        </div>

        {tab !== 'trash' && !onTrips && (
          <div className="chon-filters" role="group" aria-label="Lọc chốn">
            {/* Điện thoại: hàng loại chốn cuộn ngang; hàng ô chọn bên dưới KHÔNG cuộn — menu thả xuống của ô chọn
                là position: absolute, nằm trong khung cuộn sẽ bị cắt. Máy tính: hai nhóm display: contents = một hàng. */}
            <div className="chon-filters__kinds">
              <button type="button" className={`chon-chip${!kind ? ' is-on' : ''}`} aria-pressed={!kind} onClick={() => setKind('')}>Tất cả</button>
              {KINDS.filter(k => k.id !== 'other' || kindCounts.other).map(k => (
                <button key={k.id} type="button" className={`chon-chip chon-kind--${k.id}${kind === k.id ? ' is-on' : ''}`}
                  aria-pressed={kind === k.id} onClick={() => setKind(kind === k.id ? '' : k.id)}>
                  <AppIcon name={k.icon} size={15} className="chon-chip__icon" />{k.label}
                  <span className="chon-chip__n">{kindCounts[k.id] || 0}</span>
                </button>
              ))}
            </div>
            <div className="chon-filters__more">
            <span className="chon-filters__sep" aria-hidden="true" />
            <SearchSelect
              className="chon-select"
              size="md"
              options={[{ value: '', label: 'Mọi khu vực' }, ...areas.map(a => ({ value: a.name, label: a.name, badge: a.count }))]}
              value={area}
              onChange={v => setArea(v || '')}
              placeholder="Khu vực"
              searchPlaceholder="Tìm khu vực…"
              ariaLabel="Lọc theo khu vực"
              noResultsText="Chưa có khu vực này"
            />
            <SearchSelect
              className="chon-select"
              size="md"
              options={[{ value: '', label: 'Mọi dịp' }, ...OCCASIONS.map(o => ({ value: o.id, label: o.label }))]}
              value={occasion}
              onChange={v => setOccasion(v || '')}
              placeholder="Dịp"
              searchPlaceholder="Chọn dịp"
              ariaLabel="Lọc theo dịp"
              inputProps={{ inputMode: 'none' }}
            />
            <button type="button" className={`chon-chip chon-chip--near${near ? ' is-on' : ''}`} aria-pressed={near} onClick={toggleNear} disabled={locating}>
              <AppIcon name="crosshair" size={15} />{locating ? 'Đang tìm…' : 'Gần tôi'}
            </button>
            {hasFilter && (
              <button type="button" className="chon-btn chon-btn--text chon-btn--sm" onClick={() => { setKind(''); setArea(''); setOccasion(''); setQuery(''); }}>
                Bỏ lọc
              </button>
            )}
            </div>
          </div>
        )}

        <div className={`chon-main${tab === 'trash' || onTrips ? ' chon-main--single' : ''}${tab === 'map' ? ' chon-main--map' : ''}`}>
          {listTab && (
            <div className="chon-list">
              {listTab === 'trash' ? (
                <TrashList
                  trash={trash}
                  tripTrash={tripTrash}
                  onRestore={async p => { const r = await restorePlace(p); if (!r.error) showToast(`Đã khôi phục “${p.name}”`); }}
                  onDelete={handleDeleteForever}
                  onRestoreTrip={async t => { const r = await restoreTrip(t); if (!r.error) showToast(`Đã khôi phục chuyến “${t.title}”`); }}
                  onDeleteTrip={handleDeleteTripForever}
                />
              ) : onTrips ? (
                tripsLoading && trips.length === 0 ? (
                  <SkeletonList rows={3} lines={2} right={false} label="Đang tải chuyến đi" />
                ) : trips.length === 0 ? (
                  <div className="chon-empty">
                    <AppIcon name="flag" size={40} />
                    <p>Chưa có chuyến đi nào.</p>
                    <p className="chon-faint">Lên chuyến để so các lựa chọn tour cạnh nhau, xếp chốn theo ngày và chuẩn bị đồ.</p>
                    <button type="button" className="chon-btn chon-btn--lamp" onClick={() => setTripSheet({})}>
                      <AppIcon name="plus" size={16} weight="bold" />Lên chuyến đi
                    </button>
                  </div>
                ) : (
                  <div className="chon-grid chon-grid--trips">
                    {sortedTrips.map(t => <ChonTripCard key={t.id} trip={t} today={today} onOpen={goTrip} />)}
                  </div>
                )
              ) : (
                <>
                  {listTab === 'want' && cluster && !hasFilter && (
                    <div className="chon-hint-card">
                      <span className="chon-hint-card__icon" aria-hidden="true"><AppIcon name="navigationArrow" size={18} /></span>
                      <p>
                        {cluster.area ? `${cluster.area} có ` : 'Có '}
                        <strong>{cluster.places.length} chốn muốn đến</strong> cách nhau dưới {formatDistance(Math.max(cluster.spanM, 100))} — đủ cho một buổi.
                      </p>
                      <button type="button" className="chon-btn chon-btn--outline chon-btn--sm" onClick={() => showCluster(cluster.places)}>
                        Xem cụm trên bản đồ
                      </button>
                    </div>
                  )}

                  {isLoading && places.length === 0 ? (
                    <SkeletonList rows={4} lines={2} right={false} label="Đang tải chốn" />
                  ) : loadError ? (
                    <div className="chon-empty">
                      <p>{loadError}</p>
                      <button type="button" className="chon-btn chon-btn--soft" onClick={fetchPlaces}>Tải lại</button>
                    </div>
                  ) : list.length === 0 ? (
                    <EmptyState tab={listTab} filtered={hasFilter} onAdd={() => setCapture({})} onClear={() => { setKind(''); setArea(''); setOccasion(''); setQuery(''); }} />
                  ) : (
                    <div className="chon-grid">
                      {list.map(p => (
                        <ChonPlaceCard
                          key={p.id}
                          place={p}
                          origin={origin}
                          today={today}
                          active={hoveredId === p.id}
                          trip={tripByPlace.get(p.id) || null}
                          onOpenTrip={goTrip}
                          onOpen={openPlace}
                          onLight={setLighting}
                          onMenu={(place, at) => setMenu({ place, at })}
                          onHover={isMobile ? undefined : setHoveredId}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {showMapPane && tab !== 'trash' && (
            <aside className="chon-map-pane" aria-label="Bản đồ chốn">
              <ChonMap
                places={mapPlaces}
                origin={origin}
                fallbackCenter={recentCenter}
                missingCount={missingCoords}
                hoveredId={hoveredId}
                focus={mapFocus}
                onSelect={openPlace}
                layer={isMobile ? undefined : mapLayer}
                onLayer={isMobile ? undefined : setMapLayer}
                onLocate={() => locate(o => setMapFocus({ points: [o], zoom: 15, at: Date.now() }))}
              />
            </aside>
          )}
        </div>
      </div>

      {overlays}
    </div>
  );
}

function EmptyState({ tab, filtered, onAdd, onClear }) {
  if (filtered) {
    return (
      <div className="chon-empty">
        <p>Không có chốn nào khớp bộ lọc.</p>
        <button type="button" className="chon-btn chon-btn--soft" onClick={onClear}>Bỏ lọc</button>
      </div>
    );
  }
  if (tab === 'visited') {
    return (
      <div className="chon-empty">
        <AppIcon name="lantern" size={40} />
        <p>Chưa thắp ngọn đèn nào.</p>
        <p className="chon-faint">Tới một chốn trong Muốn đến rồi bấm nút đèn để ghi lại cảm nhận.</p>
      </div>
    );
  }
  return (
    <div className="chon-empty">
      <AppIcon name="lantern" size={40} />
      <p>Lưu một chốn bạn muốn đến.</p>
      <p className="chon-faint">Thấy quán ngon trên TikTok, chỗ đẹp bạn kể — ghi tên là đủ.</p>
      <button type="button" className="chon-btn chon-btn--lamp" onClick={onAdd}><AppIcon name="plus" size={16} weight="bold" />Lưu chốn</button>
    </div>
  );
}

function TrashList({ trash, tripTrash, onRestore, onDelete, onRestoreTrip, onDeleteTrip }) {
  if (!trash.length && !tripTrash.length) {
    return <div className="chon-empty"><p>Thùng rác trống.</p></div>;
  }
  return (
    <>
      {trash.length > 0 && (
        <ul className="chon-trash" aria-label="Chốn trong thùng rác">
          {trash.map(p => {
            const k = kindOf(p.kind);
            return (
              <li key={p.id} className="chon-trash__row">
                <span className={`chon-near__icon chon-kind--${k.id}`} aria-hidden="true"><AppIcon name={k.icon} size={16} /></span>
                <span className="chon-near__text">
                  <span className="chon-near__name">{p.name}</span>
                  <span className="chon-near__sub">{[p.area, `bỏ ${timeAgo(p.archived_at)}`].filter(Boolean).join(' · ')}</span>
                </span>
                <button type="button" className="chon-btn chon-btn--ghost chon-btn--sm" onClick={() => onRestore(p)}>
                  <AppIcon name="refresh" size={14} />Khôi phục
                </button>
                <button type="button" className="chon-icon-btn chon-icon-btn--danger" aria-label={`Xoá vĩnh viễn ${p.name}`} onClick={() => onDelete(p)}>
                  <AppIcon name="trash" size={16} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {tripTrash.length > 0 && (
        <ul className="chon-trash" aria-label="Chuyến đi trong thùng rác">
          {tripTrash.map(t => (
            <li key={t.id} className="chon-trash__row">
              <span className="chon-near__icon chon-kind--travel" aria-hidden="true"><AppIcon name="flag" size={16} /></span>
              <span className="chon-near__text">
                <span className="chon-near__name">{t.title}</span>
                <span className="chon-near__sub">{['Chuyến đi', t.region, `bỏ ${timeAgo(t.archived_at)}`].filter(Boolean).join(' · ')}</span>
              </span>
              <button type="button" className="chon-btn chon-btn--ghost chon-btn--sm" onClick={() => onRestoreTrip(t)}>
                <AppIcon name="refresh" size={14} />Khôi phục
              </button>
              <button type="button" className="chon-icon-btn chon-icon-btn--danger" aria-label={`Xoá vĩnh viễn chuyến ${t.title}`} onClick={() => onDeleteTrip(t)}>
                <AppIcon name="trash" size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
