import { useState, useMemo, useEffect, useCallback } from 'react';
import AppIcon from '../AppIcon';
import BASE_EXERCISES from '../../data/body-exercises.json';
import MUSCLE_MAP from '../../data/body-muscles.json';
import ExerciseVideoPlayer from './ExerciseVideoPlayer';
import ExerciseDetailModal from './ExerciseDetailModal';
import { splitExerciseName, splitTempo, stepOfUnit } from '../../utils/workoutLogic';
import { normVi } from '../../utils/kanbanUtils';

// Vùng cơ của bộ lọc: gom theo cơ chính
const REGIONS = [
  { key: 'all', label: 'Tất cả' },
  { key: 'chest', label: 'Ngực', muscles: ['chest'] },
  { key: 'shoulders', label: 'Vai', muscles: ['shoulders'] },
  { key: 'back', label: 'Lưng & Xô', muscles: ['lats', 'traps', 'lowerback'] },
  { key: 'arms', label: 'Tay', muscles: ['biceps', 'triceps', 'forearms'] },
  { key: 'legs', label: 'Chân', muscles: ['quads', 'hamstrings', 'calves'] },
  { key: 'glutes', label: 'Mông', muscles: ['glutes'] },
  { key: 'core', label: 'Bụng', muscles: ['abs', 'obliques'] }
];
const regionOf = primary => REGIONS.find(r => r.muscles?.includes(primary)) || null;

const EQUIPMENTS = [
  { key: 'all', label: 'Tất cả', short: 'Tất cả' },
  { key: 'bw', label: 'Không dụng cụ', short: 'Tay không' },
  { key: 'db', label: 'Tạ đơn', short: 'Tạ đơn' },
  { key: 'bar', label: 'Xà & dây', short: 'Xà' },
  { key: 'gym', label: 'Máy tập', short: 'Máy' }
];
const EQ_NAME = { bw: 'Không dụng cụ', db: 'Tạ đơn', bar: 'Xà & dây', gym: 'Máy tập' };
const EQ_SHORT = { bw: 'Bodyweight', db: 'Tạ đơn', bar: 'Xà', gym: 'Máy' };
const LEVEL_NUM = { 'Cơ bản': 1, 'Trung bình': 2, 'Nâng cao': 3 };
const WEEKDAYS = [
  { d: 1, label: 'T2', full: 'Thứ Hai' },
  { d: 2, label: 'T3', full: 'Thứ Ba' },
  { d: 3, label: 'T4', full: 'Thứ Tư' },
  { d: 4, label: 'T5', full: 'Thứ Năm' },
  { d: 5, label: 'T6', full: 'Thứ Sáu' },
  { d: 6, label: 'T7', full: 'Thứ Bảy' },
  { d: 7, label: 'CN', full: 'Chủ Nhật' }
];
const MUSCLE_BAR_COLORS = ['#6949E8', '#A894F2', '#C9BDF7', '#DAD3F9'];

const muscleName = key => MUSCLE_MAP[key]?.name || key;
const unitText = metric => (metric === 's' ? 'giây' : 'rep');
const suggestText = ex => `${ex.defaultSets || 3} × ${ex.defaultTarget || 10} ${unitText(ex.metric)}${ex.defaultKg ? ` · ${ex.defaultKg} kg` : ''}`;
const warnOf = ex => {
  const c = (ex.contraindications || [])[0];
  return c ? `Lưu ý ${c.replace(/^Đau\s+/i, '').toLowerCase()}` : '';
};

export default function ExerciseLibraryScreen({
  onStartExercise,
  onAddToRoutine,
  activeRoutine,
  routineItems = [],
  exerciseMap
}) {
  const allExercises = useMemo(
    () => (exerciseMap?.size ? Array.from(exerciseMap.values()) : BASE_EXERCISES),
    [exerciseMap]
  );
  const findEx = useCallback(key => allExercises.find(e => e.key === key) || null, [allExercises]);

  // Video chỉ mount 1 bản: đầu màn chi tiết (mobile) hoặc trong tab Tổng quan (desktop)
  const [isMobile, setIsMobile] = useState(() => Boolean(window.matchMedia?.('(max-width: 840px)').matches));
  useEffect(() => {
    const mq = window.matchMedia?.('(max-width: 840px)');
    if (!mq) return undefined;
    const onChange = e => setIsMobile(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const [region, setRegion] = useState('all');
  const [eqFilter, setEqFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedKey, setSelectedKey] = useState(() => (BASE_EXERCISES.some(e => e.key === 'push-up') ? 'push-up' : BASE_EXERCISES[0]?.key));
  const [tab, setTab] = useState('ov'); // 'ov' | 'tech' | 'safe' | 'var'
  const [mobileOpen, setMobileOpen] = useState(false);
  const [detailEx, setDetailEx] = useState(null);

  // Thêm vào kế hoạch
  const [showAdd, setShowAdd] = useState(false);
  const [addDay, setAddDay] = useState(() => new Date().getDay() || 7);
  const [addSets, setAddSets] = useState(3);
  const [addTarget, setAddTarget] = useState(12);

  const filtered = useMemo(() => {
    const q = normVi(search.trim());
    const reg = REGIONS.find(r => r.key === region);
    return allExercises.filter(ex => {
      if (reg?.muscles && !reg.muscles.includes(ex.primary)) return false;
      if (eqFilter !== 'all' && ex.equipment !== eqFilter) return false;
      if (!q) return true;
      const hay = normVi([ex.name, muscleName(ex.primary), regionOf(ex.primary)?.label, ...(ex.secondary || []).map(muscleName)].join(' '));
      return hay.includes(q);
    });
  }, [allExercises, search, region, eqFilter]);

  const ex = findEx(selectedKey) || filtered[0] || allExercises[0];
  const names = splitExerciseName(ex?.name || '');

  // Chuỗi bậc thang biến thể (cùng progression_chain, theo cấp độ)
  const chain = useMemo(() => {
    if (!ex) return null;
    const items = ex.progression_chain
      ? allExercises.filter(e => e.progression_chain === ex.progression_chain).sort((a, b) => (a.progression_level || 0) - (b.progression_level || 0))
      : [];
    const easier = ex.easier_variation ? findEx(ex.easier_variation) : null;
    const harder = ex.harder_variation ? findEx(ex.harder_variation) : null;
    if (items.length < 2 && !easier && !harder) return null;
    return { name: ex.progression_chain || 'Biến thể', items, easier, harder, note: ex.variation_note };
  }, [ex, allExercises, findEx]);

  const contra = ex?.contraindications || [];
  const alternatives = (ex?.alternatives || []).map(findEx).filter(Boolean);
  const curTab = tab === 'var' && !chain ? 'ov' : tab;
  const tabs = [
    { key: 'ov', label: 'Tổng quan', icon: 'info' },
    { key: 'tech', label: 'Kỹ thuật', icon: 'listNumbers' },
    { key: 'safe', label: 'An toàn', icon: 'firstAidKit', badge: contra.length || null },
    ...(chain ? [{ key: 'var', label: 'Biến thể', icon: 'stairs' }] : [])
  ];

  const muscles = ex ? [
    { name: muscleName(ex.primary), role: 'Chính', w: 100 },
    ...(ex.secondary || []).map((m, i) => ({ name: muscleName(m), role: 'Phụ', w: Math.max(30, 60 - i * 10) }))
  ] : [];
  const tempo = splitTempo(ex?.tempo || '');
  const facts = [];
  if (ex?.breathing) facts.push({ icon: 'wind', label: 'NHỊP THỞ', text: ex.breathing });
  if (ex?.tempo) facts.push({ icon: 'metronome', label: 'NHỊP ĐỘ (TEMPO)', text: tempo.code ? `${tempo.code} · ${tempo.text}` : tempo.text });
  if (!facts.length && ex) facts.push({ icon: 'target', label: 'GỢI Ý BẮT ĐẦU', text: `${suggestText(ex)}, nghỉ 60–90 giây giữa các set.` });

  const pickEx = key => {
    setSelectedKey(key);
    setMobileOpen(true);
  };

  const openAdd = () => {
    if (!ex) return;
    setAddSets(ex.defaultSets || 3);
    setAddTarget(ex.defaultTarget || 12);
    setShowAdd(true);
  };

  // Ngày đã có bài này / ngày có lịch tập (để chọn thứ cho đúng)
  const dayInfo = useMemo(() => {
    const map = new Map();
    routineItems.forEach(it => {
      const cur = map.get(it.weekday) || { count: 0, has: false, name: it.day_name || '' };
      cur.count += 1;
      if (ex && it.exercise_key === ex.key) cur.has = true;
      map.set(it.weekday, cur);
    });
    return map;
  }, [routineItems, ex]);

  const handleConfirmAdd = () => {
    if (!ex || !activeRoutine) return;
    const existing = dayInfo.get(addDay);
    onAddToRoutine?.({
      weekday: addDay,
      dayName: existing?.name || 'Buổi tập',
      exerciseKey: ex.key,
      name: ex.name,
      sets: addSets,
      targetVal: addTarget,
      unit: ex.metric || 'rep',
      kg: ex.defaultKg != null ? ex.defaultKg : (ex.equipment === 'db' ? 5 : 0),
      restSeconds: 60
    });
    setShowAdd(false);
  };

  // Escape: đóng modal → đóng chi tiết (mobile)
  useEffect(() => {
    if (!showAdd && !mobileOpen) return undefined;
    const onKey = e => {
      if (e.key !== 'Escape') return;
      if (showAdd) setShowAdd(false);
      else setMobileOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showAdd, mobileOpen]);

  if (!ex) return null;

  const secondaryText = (ex.secondary || []).map(muscleName).join(', ');
  const step = stepOfUnit(ex.metric);
  const addDayFull = WEEKDAYS.find(w => w.d === addDay)?.full || '';

  return (
    <div className="body-lib">
      {/* ── CỘT TRÁI: tìm + lọc + danh sách ───────────────────────── */}
      <section className={`body-lib-card body-lib-list${mobileOpen ? ' is-behind' : ''}`}>
        <div className="body-lib-filters">
          <div className="body-lib-mtitle">
            <span className="body-lib-count">{filtered.length} BÀI TẬP PHÙ HỢP</span>
          </div>
          <label className="body-lib-search">
            <AppIcon name="search" size={16} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Tìm bài tập hoặc nhóm cơ…"
              aria-label="Tìm bài tập"
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} aria-label="Xóa tìm kiếm">
                <AppIcon name="x" size={11} />
              </button>
            )}
          </label>
          <div className="body-lib-seg" role="group" aria-label="Dụng cụ">
            {EQUIPMENTS.map(e => (
              <button key={e.key} type="button" className={eqFilter === e.key ? 'is-on' : ''} onClick={() => setEqFilter(e.key)} aria-pressed={eqFilter === e.key} title={e.label}>
                {e.short}
              </button>
            ))}
          </div>
          <div className="body-lib-regions" role="group" aria-label="Vùng cơ">
            {REGIONS.map(r => (
              <button key={r.key} type="button" className={region === r.key ? 'is-on' : ''} onClick={() => setRegion(r.key)} aria-pressed={region === r.key}>
                {r.label}
              </button>
            ))}
          </div>
        </div>
        <span className="body-lib-count is-desktop">{filtered.length} BÀI TẬP PHÙ HỢP</span>
        <div className="body-lib-items">
          {filtered.map(item => {
            const nm = splitExerciseName(item.name);
            const lv = LEVEL_NUM[item.level] || 1;
            const warn = warnOf(item);
            const on = item.key === ex.key;
            return (
              <button key={item.key} type="button" className={`body-lib-item${on ? ' is-on' : ''}`} onClick={() => pickEx(item.key)} aria-pressed={on}>
                <span className="body-lib-item-main">
                  <b>{nm.vn}</b>
                  {nm.en && <small>{nm.en}</small>}
                  <span className="body-lib-item-tags">
                    <em>{regionOf(item.primary)?.label || muscleName(item.primary)} · {EQ_SHORT[item.equipment] || 'Bodyweight'}</em>
                    {warn && <em className="is-warn"><AppIcon name="warning" size={11} weight="fill" /><span>{warn}</span></em>}
                  </span>
                </span>
                <span className="body-lib-level" aria-label={`Cấp độ ${item.level || 'Cơ bản'}`}>
                  <span className="body-lib-bars">
                    <i className="is-on" />
                    <i className={lv >= 2 ? 'is-on' : ''} />
                    <i className={lv >= 3 ? 'is-on' : ''} />
                  </span>
                  <small>{item.level || 'Cơ bản'}</small>
                </span>
                <AppIcon name="caretRight" size={15} className="body-lib-caret" />
              </button>
            );
          })}
          {filtered.length === 0 && (
            <div className="body-lib-noresult">
              <AppIcon name="search" size={22} />
              <span>Không có bài nào khớp bộ lọc</span>
            </div>
          )}
        </div>
      </section>

      {/* ── CHI TIẾT BÀI: cột phải (desktop) / màn riêng (mobile) ──────── */}
      <section className={`body-lib-card body-lib-detail${mobileOpen ? ' is-open' : ''}`} aria-label={`Chi tiết ${names.vn}`}>
        <div className="body-lib-dtop">
          <button type="button" className="body-lib-icon-btn is-ghost" onClick={() => setMobileOpen(false)} aria-label="Quay lại danh sách">
            <AppIcon name="back" size={19} />
          </button>
          <span>Chi tiết bài tập</span>
          <button type="button" className="body-lib-icon-btn is-ghost" onClick={() => setDetailEx(ex)} aria-label="Mở bản đồ cơ">
            <AppIcon name="personSimple" size={19} />
          </button>
        </div>

        <div className="body-lib-dscroll">
          {isMobile && (
            <div className="body-lib-mvideo">
              <ExerciseVideoPlayer exerciseKey={ex.key} exerciseName={ex.name} defaultUrl={ex.video_url} />
            </div>
          )}

          <div className="body-lib-dhead">
            <div className="body-lib-dtitles">
              <div className="body-lib-dchips">
                <em className="is-level">{ex.level || 'Cơ bản'}</em>
                <em>{EQ_NAME[ex.equipment] || 'Không dụng cụ'}</em>
              </div>
              <h2>{names.vn}</h2>
              <p>
                {names.en ? `${names.en} · ` : ''}Nhóm cơ chính <b>{muscleName(ex.primary)}</b>
                <span className="body-lib-d-text">{secondaryText ? ` · Phụ: ${secondaryText}` : ''}</span>
              </p>
              <div className="body-lib-mfacts">
                <div><span>Nhóm cơ chính</span><b>{muscleName(ex.primary)}</b></div>
                <div><span>Gợi ý</span><b className="is-accent">{suggestText(ex)}</b></div>
              </div>
            </div>
            <div className="body-lib-dactions">
              <span className="body-lib-suggest">
                <small>GỢI Ý</small>
                <b>{suggestText(ex)}</b>
              </span>
              <button type="button" className="body-lib-btn" onClick={openAdd}>
                <AppIcon name="plus" size={14} />Thêm vào kế hoạch
              </button>
              <button type="button" className="body-lib-btn is-dark" onClick={() => onStartExercise?.(ex)}>
                <AppIcon name="play" size={13} weight="fill" />Tập bài này ngay
              </button>
            </div>
          </div>

          <div className="body-lib-tabs" role="tablist" aria-label="Nội dung bài tập">
            {tabs.map(t => (
              <button key={t.key} type="button" role="tab" aria-selected={curTab === t.key} className={curTab === t.key ? 'is-on' : ''} onClick={() => setTab(t.key)}>
                <AppIcon name={t.icon} size={15} />
                {t.label}
                {t.badge ? <i>{t.badge}</i> : null}
              </button>
            ))}
          </div>

          <div className="body-lib-tabbody">
            {curTab === 'ov' && (
              <div className="body-lib-ov">
                <div className="body-lib-ov-video">
                  {!isMobile && <ExerciseVideoPlayer exerciseKey={ex.key} exerciseName={ex.name} defaultUrl={ex.video_url} />}
                  <button type="button" className="body-lib-link" onClick={() => setDetailEx(ex)}>
                    <AppIcon name="personSimple" size={14} />Xem bản đồ cơ &amp; hướng dẫn đầy đủ
                  </button>
                </div>
                <div className="body-lib-ov-side">
                  <div className="body-lib-muscles">
                    <b>Vùng cơ tác động</b>
                    {muscles.map((m, i) => (
                      <div key={m.name}>
                        <span><span>{m.name}</span><small>{m.role}</small></span>
                        <span className="body-lib-mbar"><i style={{ width: `${m.w}%`, background: MUSCLE_BAR_COLORS[Math.min(i, 3)] }} /></span>
                      </div>
                    ))}
                  </div>
                  {facts.map(fc => (
                    <div key={fc.label} className="body-lib-fact">
                      <span><AppIcon name={fc.icon} size={15} /></span>
                      <div>
                        <small>{fc.label}</small>
                        <p>{fc.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {curTab === 'tech' && (
              <div className="body-lib-tech">
                <div className="body-lib-steps">
                  <b>Hướng dẫn từng bước</b>
                  {(ex.steps || []).map((s, i) => (
                    <div key={i}>
                      <span>{i + 1}</span>
                      <p>{s}</p>
                    </div>
                  ))}
                </div>
                <div className="body-lib-tech-side">
                  {(ex.form_cues || []).length > 0 && (
                    <div className="body-lib-cues">
                      <b><AppIcon name="crosshair" size={15} />Điểm neo vị trí, góc độ &amp; biên độ</b>
                      {ex.form_cues.map((c, i) => (
                        <span key={i}><AppIcon name="checkCircle" size={14} weight="fill" />{c}</span>
                      ))}
                    </div>
                  )}
                  {ex.tip && (
                    <div className="body-lib-mistake">
                      <b><AppIcon name="xCircle" size={15} />Lỗi sai hay gặp</b>
                      <p>{ex.tip}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {curTab === 'safe' && (
              <div className="body-lib-safe">
                {(ex.injury_risk || ex.cause) && (
                  <div className="body-lib-risk">
                    <b><AppIcon name="warning" size={16} weight="fill" />Cảnh báo cơ sinh học &amp; phòng tránh chấn thương</b>
                    <div>
                      {ex.injury_risk && (<><span>Tập sai sẽ bị gì</span><p>{ex.injury_risk}</p></>)}
                      {ex.cause && (<><span className="is-muted">Nguyên nhân cơ học</span><p className="is-muted">{ex.cause}</p></>)}
                    </div>
                  </div>
                )}
                {contra.length > 0 && (
                  <div className="body-lib-block">
                    <b>Không nên tập nếu đang bị</b>
                    <div className="body-lib-contra">
                      {contra.map(c => <span key={c}><AppIcon name="prohibit" size={13} />{c}</span>)}
                    </div>
                  </div>
                )}
                {alternatives.length > 0 && (
                  <div className="body-lib-block">
                    <b><AppIcon name="shieldCheck" size={15} className="is-green" />Bài thay thế an toàn hơn (bảo vệ khớp &amp; cơ)</b>
                    <div className="body-lib-alts">
                      {alternatives.map(a => {
                        const an = splitExerciseName(a.name);
                        return (
                          <button key={a.key} type="button" onClick={() => pickEx(a.key)}>
                            <span>
                              <b>{an.vn}</b>
                              <small>{an.en ? `${an.en} · ` : ''}{EQ_SHORT[a.equipment] || 'Bodyweight'}</small>
                            </span>
                            <AppIcon name="arrowRight" size={15} />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                <small className="body-lib-disclaimer">
                  Thông tin mang tính tham khảo chung, không thay thế tư vấn của bác sĩ / chuyên gia vật lý trị liệu. Dừng tập nếu thấy đau bất thường.
                  {ex.medical_source ? ` Nguồn: ${ex.medical_source}.` : ''}
                </small>
              </div>
            )}

            {curTab === 'var' && chain && (
              <div className="body-lib-var">
                <div className="body-lib-ladder">
                  <div className="body-lib-ladder-head">
                    <b>Bậc thang biến thể</b>
                    <small>{chain.name} · {chain.items.length} cấp độ</small>
                  </div>
                  <div className="body-lib-ladder-list">
                    {chain.items.map((c, i) => {
                      const cn = splitExerciseName(c.name);
                      const cur = c.key === ex.key;
                      const done = i < chain.items.findIndex(x => x.key === ex.key);
                      return (
                        <button key={c.key} type="button" className={`${cur ? 'is-cur' : ''}${done ? ' is-done' : ''}`} onClick={() => setSelectedKey(c.key)} aria-current={cur ? 'true' : undefined}>
                          <i>{i + 1}</i>
                          <span>
                            <b>{cn.vn}</b>
                            {cn.en && <small>{cn.en}</small>}
                          </span>
                          {cur && <em>Đang xem</em>}
                          <small className="body-lib-ladder-lv">{c.level}</small>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="body-lib-var-side">
                  <div className="body-lib-var-cards">
                    <button type="button" className="is-easy" disabled={!chain.easier} onClick={() => chain.easier && setSelectedKey(chain.easier.key)}>
                      <small><AppIcon name="arrowDown" size={13} />Dễ hơn · cho người mới</small>
                      <b>{chain.easier ? splitExerciseName(chain.easier.name).vn : 'Đây đã là biến thể dễ nhất'}</b>
                      {chain.easier && <em>Đổi sang bài dễ hơn<AppIcon name="arrowRight" size={11} /></em>}
                    </button>
                    <button type="button" className="is-hard" disabled={!chain.harder} onClick={() => chain.harder && setSelectedKey(chain.harder.key)}>
                      <small><AppIcon name="arrowUp" size={13} />Khó hơn · khi đã quen</small>
                      <b>{chain.harder ? splitExerciseName(chain.harder.name).vn : 'Đây là cấp độ cao nhất'}</b>
                      {chain.harder && <em>Thử thách bài khó hơn<AppIcon name="arrowRight" size={11} /></em>}
                    </button>
                  </div>
                  {chain.note && (
                    <div className="body-lib-note">
                      <AppIcon name="lightbulb" size={16} />
                      <p><b>Cơ sinh học:</b> {chain.note}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Mobile: thanh hành động đáy màn chi tiết */}
        <div className="body-lib-mbar-actions">
          <button type="button" className="body-lib-btn is-square" onClick={openAdd} aria-label="Thêm vào kế hoạch">
            <AppIcon name="plus" size={19} />
          </button>
          <button type="button" className="body-lib-btn is-dark" onClick={() => onStartExercise?.(ex)}>
            <AppIcon name="play" size={14} weight="fill" />Tập bài này ngay
          </button>
        </div>
      </section>

      {/* ── THÊM VÀO KẾ HOẠCH ──────────────────────────────────────── */}
      {showAdd && (
        <>
          <div className="body-lib-modal-backdrop" onClick={() => setShowAdd(false)} />
          <div className="body-lib-modal" role="dialog" aria-modal="true" aria-label="Thêm vào kế hoạch tuần">
            <span className="body-lib-sheet-grip" />
            <div className="body-lib-modal-head">
              <span>
                <small>THÊM VÀO {activeRoutine?.name ? activeRoutine.name.toUpperCase() : 'LỘ TRÌNH'}</small>
                <b>{names.vn}</b>
              </span>
              <button type="button" className="body-lib-icon-btn" onClick={() => setShowAdd(false)} aria-label="Đóng">
                <AppIcon name="x" size={15} />
              </button>
            </div>
            {!activeRoutine ? (
              <div className="body-lib-modal-body">
                <div className="body-lib-note">
                  <AppIcon name="info" size={16} />
                  <p>Chưa có lộ trình đang theo. Tạo hoặc chọn lộ trình ở tab Lộ trình trước, rồi thêm bài vào.</p>
                </div>
              </div>
            ) : (
              <div className="body-lib-modal-body">
                <div className="body-lib-field">
                  <span>Thứ trong tuần</span>
                  <div className="body-lib-days">
                    {WEEKDAYS.map(w => {
                      const info = dayInfo.get(w.d);
                      return (
                        <button key={w.d} type="button" className={addDay === w.d ? 'is-on' : ''} onClick={() => setAddDay(w.d)} aria-pressed={addDay === w.d}>
                          <b>{w.label}</b>
                          <small>{info?.has ? 'đã có' : info?.count ? `${info.count} bài` : 'nghỉ'}</small>
                        </button>
                      );
                    })}
                  </div>
                  {dayInfo.get(addDay)?.has && <small className="body-lib-warn">Ngày này đã có bài này — thêm nữa sẽ thành 2 mục.</small>}
                </div>
                <div className="body-lib-fields2">
                  <div className="body-lib-field">
                    <span>Số hiệp</span>
                    <div className="body-lib-stepper">
                      <button type="button" onClick={() => setAddSets(v => Math.max(1, v - 1))} aria-label="Giảm số hiệp"><AppIcon name="minus" size={14} /></button>
                      <b>{addSets}</b>
                      <button type="button" onClick={() => setAddSets(v => Math.min(10, v + 1))} aria-label="Tăng số hiệp"><AppIcon name="plus" size={14} /></button>
                    </div>
                  </div>
                  <div className="body-lib-field">
                    <span>Mục tiêu mỗi hiệp</span>
                    <div className="body-lib-stepper">
                      <button type="button" onClick={() => setAddTarget(v => Math.max(step, v - step))} aria-label="Giảm mục tiêu"><AppIcon name="minus" size={14} /></button>
                      <b>{addTarget}<small>{unitText(ex.metric)}</small></b>
                      <button type="button" onClick={() => setAddTarget(v => v + step)} aria-label="Tăng mục tiêu"><AppIcon name="plus" size={14} /></button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div className="body-lib-modal-foot">
              <button type="button" className="body-lib-btn" onClick={() => setShowAdd(false)}>Hủy</button>
              <button type="button" className="body-lib-btn is-dark" onClick={handleConfirmAdd} disabled={!activeRoutine}>
                Thêm vào {addDayFull}
              </button>
            </div>
          </div>
        </>
      )}

      <ExerciseDetailModal exercise={detailEx} isOpen={Boolean(detailEx)} onClose={() => setDetailEx(null)} />
    </div>
  );
}
