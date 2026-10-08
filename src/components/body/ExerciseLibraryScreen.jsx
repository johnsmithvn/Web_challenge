import { useState, useMemo } from 'react';
import AppIcon from '../AppIcon';
import BASE_EXERCISES from '../../data/body-exercises.json';
import MUSCLE_MAP from '../../data/body-muscles.json';

const REGIONS = [
  { key: 'all', label: 'Tất cả' },
  { key: 'chest', label: 'Ngực' },
  { key: 'shoulders', label: 'Vai' },
  { key: 'lats', label: 'Lưng & Xô' },
  { key: 'biceps', label: 'Tay' },
  { key: 'quads', label: 'Chân' },
  { key: 'glutes', label: 'Mông' },
  { key: 'abs', label: 'Bụng' }
];

const EQUIPMENTS = [
  { key: 'all', label: 'Tất cả' },
  { key: 'bw', label: 'Không dụng cụ' },
  { key: 'db', label: 'Tạ đơn' },
  { key: 'bar', label: 'Xà & dây' }
];

export default function ExerciseLibraryScreen({ onStartExercise, onAddToRoutine, activeRoutine }) {
  const [regionFilter, setRegionFilter] = useState('all');
  const [eqFilter, setEqFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedKey, setSelectedKey] = useState('push-up');

  // Modal thêm vào kế hoạch
  const [showAddModal, setShowAddModal] = useState(false);
  const [addDay, setAddDay] = useState(2); // Thứ 3 mặc định
  const [addSets, setAddSets] = useState(3);
  const [addTarget, setAddTarget] = useState(12);

  // Filter exercises
  const filteredList = useMemo(() => {
    return BASE_EXERCISES.filter(ex => {
      const matchRegion = regionFilter === 'all' || ex.primary === regionFilter || (ex.secondary || []).includes(regionFilter);
      const matchEq = eqFilter === 'all' || ex.equipment === eqFilter;
      const matchSearch = !search || ex.name.toLowerCase().includes(search.toLowerCase()) || ex.primary.toLowerCase().includes(search.toLowerCase());
      return matchRegion && matchEq && matchSearch;
    });
  }, [regionFilter, eqFilter, search]);

  const selectedEx = useMemo(() => {
    return BASE_EXERCISES.find(e => e.key === selectedKey) || filteredList[0] || BASE_EXERCISES[0];
  }, [selectedKey, filteredList]);

  // Danh sách các bài tập thay thế an toàn
  const altExercises = useMemo(() => {
    if (!selectedEx?.alternatives || selectedEx.alternatives.length === 0) return [];
    return selectedEx.alternatives
      .map(altKey => BASE_EXERCISES.find(e => e.key === altKey))
      .filter(Boolean);
  }, [selectedEx]);

  // Chuỗi bậc thang tăng tiến biến thể (Progression Chain)
  const progressionChain = useMemo(() => {
    if (!selectedEx?.progression_chain) return null;
    const chainItems = BASE_EXERCISES
      .filter(e => e.progression_chain === selectedEx.progression_chain)
      .sort((a, b) => (a.progression_level || 0) - (b.progression_level || 0));

    const easierEx = selectedEx.easier_variation
      ? BASE_EXERCISES.find(e => e.key === selectedEx.easier_variation)
      : null;
    const harderEx = selectedEx.harder_variation
      ? BASE_EXERCISES.find(e => e.key === selectedEx.harder_variation)
      : null;

    return {
      chainName: selectedEx.progression_chain,
      chainItems,
      easierEx,
      harderEx,
      note: selectedEx.variation_note
    };
  }, [selectedEx]);

  const handleOpenAddModal = () => {
    if (selectedEx) {
      setAddSets(selectedEx.defaultSets || 3);
      setAddTarget(selectedEx.defaultTarget || 12);
      setShowAddModal(true);
    }
  };

  const handleConfirmAddToRoutine = () => {
    if (!selectedEx) return;
    onAddToRoutine?.({
      weekday: addDay,
      exerciseKey: selectedEx.key,
      name: selectedEx.name,
      sets: addSets,
      targetVal: addTarget,
      unit: selectedEx.metric || 'rep',
      kg: selectedEx.defaultKg != null ? selectedEx.defaultKg : (selectedEx.equipment === 'db' ? 5 : 0),
      restSeconds: 60
    });
    setShowAddModal(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%' }}>
      {/* ── TOP FILTERS ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        {/* Search */}
        <div style={{ position: 'relative', width: '280px' }}>
          <span style={{ position: 'absolute', left: '12px', top: '9px', color: 'var(--body-text-muted)' }}>
            <AppIcon name="search" size={16} />
          </span>
          <input
            type="text"
            placeholder="Tìm bài tập hoặc nhóm cơ..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%',
              height: '36px',
              padding: '0 12px 0 34px',
              borderRadius: '10px',
              border: '1px solid var(--body-card-border)',
              background: 'var(--body-card-bg)',
              color: 'var(--body-text-main)',
              fontSize: '13px',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
        </div>

        {/* Equipment filter */}
        <div style={{ display: 'flex', gap: '6px' }}>
          {EQUIPMENTS.map(eq => (
            <button
              key={eq.key}
              className="body-btn"
              style={{
                height: '32px',
                padding: '0 12px',
                fontSize: '12.5px',
                background: eqFilter === eq.key ? 'var(--body-text-main)' : 'var(--body-card-bg)',
                color: eqFilter === eq.key ? 'var(--body-bg)' : 'var(--body-text-sub)',
                border: '1px solid var(--body-card-border)',
                fontWeight: eqFilter === eq.key ? 600 : 500
              }}
              onClick={() => setEqFilter(eq.key)}
            >
              {eq.label}
            </button>
          ))}
        </div>
      </div>

      {/* Region Tabs */}
      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
        {REGIONS.map(r => (
          <button
            key={r.key}
            className="body-btn"
            style={{
              height: '30px',
              padding: '0 12px',
              fontSize: '12px',
              background: regionFilter === r.key ? 'var(--body-accent)' : 'var(--body-shell-bg)',
              color: regionFilter === r.key ? '#fff' : 'var(--body-text-sub)',
              fontWeight: regionFilter === r.key ? 600 : 500,
              borderRadius: '20px'
            }}
            onClick={() => setRegionFilter(r.key)}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* ── 2-COLUMN MASTER/DETAIL LAYOUT ────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1.2fr) minmax(360px, 1.8fr)', gap: '20px', flex: 1, minHeight: 0 }}>
        {/* Left Column: List */}
        <div className="body-card" style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', padding: '12px' }}>
          <div style={{ fontSize: '12px', color: 'var(--body-text-muted)', padding: '4px 8px', fontWeight: 600 }}>
            {filteredList.length} BÀI TẬP PHÙ HỢP
          </div>

          {filteredList.map(ex => {
            const isSelected = ex.key === selectedEx?.key;
            return (
              <div
                key={ex.key}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 14px',
                  borderRadius: '12px',
                  border: isSelected ? '1.5px solid var(--body-accent)' : '1px solid var(--body-card-border)',
                  background: isSelected ? 'var(--body-accent-soft)' : 'var(--body-card-bg)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onClick={() => setSelectedKey(ex.key)}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: isSelected ? 'var(--body-accent)' : 'var(--body-text-main)' }}>
                    {ex.name}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--body-text-muted)', marginTop: '2px' }}>
                    Cơ chính: {MUSCLE_MAP[ex.primary]?.name || ex.primary} · {ex.equipment === 'bw' ? 'Bodyweight' : ex.equipment === 'db' ? 'Tạ đơn' : 'Xà'}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {(ex.contraindications || []).length > 0 ? (
                    <span className="body-badge body-badge-amber" style={{ fontSize: '10.5px', padding: '2px 6px' }} title={`Không nên tập nếu: ${ex.contraindications.join(', ')}`}>
                      Lưu ý: {ex.contraindications[0].replace('Đau ', '')}
                    </span>
                  ) : ex.warn ? (
                    <span className="body-badge body-badge-amber" style={{ fontSize: '10.5px', padding: '2px 6px' }}>
                      Lưu ý lưng
                    </span>
                  ) : null}
                  <span className="body-badge body-badge-neutral" style={{ fontSize: '11px' }}>
                    {ex.level}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Column: Details */}
        {selectedEx ? (
          <div className="body-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <span className="body-badge body-badge-accent">{selectedEx.level}</span>
                  <span className="body-badge body-badge-neutral">
                    {selectedEx.equipment === 'bw' ? 'Không dụng cụ' : selectedEx.equipment === 'db' ? 'Tạ đơn' : 'Xà'}
                  </span>
                </div>
                <h2 style={{ fontSize: '24px', fontWeight: 700, margin: '0 0 4px 0' }}>{selectedEx.name}</h2>
                <div style={{ fontSize: '13px', color: 'var(--body-text-muted)' }}>
                  Nhóm cơ chính: <strong style={{ color: 'var(--body-text-main)' }}>{MUSCLE_MAP[selectedEx.primary]?.name || selectedEx.primary}</strong>
                  {(selectedEx.secondary || []).length > 0 && (
                    <span> · Phụ: {selectedEx.secondary.map(m => MUSCLE_MAP[m]?.name || m).join(', ')}</span>
                  )}
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '11px', fontFamily: 'var(--body-mono)', color: 'var(--body-text-muted)' }}>GỢI Ý</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--body-accent)' }}>
                  {selectedEx.defaultSets} × {selectedEx.defaultTarget} {selectedEx.metric === 's' ? 'giây' : 'rep'}
                </div>
              </div>
            </div>

            {/* Các bước kỹ thuật */}
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '10px' }}>Hướng dẫn từng bước:</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {(selectedEx.steps || []).map((step, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <span style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: 'var(--body-shell-bg)',
                      color: 'var(--body-text-main)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      fontWeight: 700,
                      flex: 'none'
                    }}>
                      {idx + 1}
                    </span>
                    <span style={{ fontSize: '13.5px', lineHeight: 1.6, color: 'var(--body-text-main)' }}>
                      {step}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Lỗi hay gặp */}
            {selectedEx.tip && (
              <div style={{ padding: '14px', borderRadius: '12px', background: 'var(--body-shell-bg)' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--body-red)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AppIcon name="x" size={14} />
                  <span>Lỗi sai hay gặp:</span>
                </div>
                <div style={{ fontSize: '13px', color: 'var(--body-text-sub)', lineHeight: 1.5 }}>
                  {selectedEx.tip}
                </div>
              </div>
            )}

            {/* ── CẢNH BÁO CHẤN THƯƠNG & BÀI THAY THẾ AN TOÀN ── */}
            {selectedEx.injury_risk && (
              <div style={{
                padding: '16px',
                borderRadius: '14px',
                background: 'rgba(239, 68, 68, 0.04)',
                border: '1.5px solid rgba(239, 68, 68, 0.22)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px', color: '#DC2626', fontWeight: 700, fontSize: '13.5px' }}>
                    <AppIcon name="warning" size={16} />
                    <span>Cảnh báo cơ sinh học & Phòng tránh chấn thương</span>
                  </div>
                  {selectedEx.medical_source && (
                    <span style={{ fontSize: '11px', color: 'var(--body-text-muted)', fontFamily: 'var(--body-mono)' }}>
                      Nguồn: {selectedEx.medical_source}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ fontSize: '13px', lineHeight: 1.55, color: 'var(--body-text-main)' }}>
                    <strong style={{ color: '#DC2626' }}>Tập sai sẽ bị gì: </strong>
                    {selectedEx.injury_risk}
                  </div>
                  {selectedEx.cause && (
                    <div style={{ fontSize: '12.5px', lineHeight: 1.5, color: 'var(--body-text-sub)' }}>
                      <strong>Nguyên nhân cơ học: </strong>
                      {selectedEx.cause}
                    </div>
                  )}
                </div>

                {/* Chống chỉ định */}
                {(selectedEx.contraindications || []).length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px', paddingTop: '4px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--body-text-sub)' }}>
                      Không nên tập nếu đang bị:
                    </span>
                    {selectedEx.contraindications.map((c, cIdx) => (
                      <span key={cIdx} style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        background: 'rgba(239, 68, 68, 0.1)',
                        color: '#DC2626',
                        fontSize: '11.5px',
                        fontWeight: 600
                      }}>
                        ⚠️ {c}
                      </span>
                    ))}
                  </div>
                )}

                {/* Gợi ý bài thay thế an toàn */}
                {altExercises.length > 0 && (
                  <div style={{
                    marginTop: '4px',
                    padding: '12px',
                    borderRadius: '10px',
                    background: 'var(--body-card-bg)',
                    border: '1px solid var(--body-card-border)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--body-accent)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <AppIcon name="shieldCheck" size={14} />
                      <span>Bài tập thay thế an toàn hơn (bảo vệ khớp & cơ):</span>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {altExercises.map(altEx => (
                        <button
                          key={altEx.key}
                          type="button"
                          onClick={() => setSelectedKey(altEx.key)}
                          title="Bấm để xem hướng dẫn bài tập thay thế này"
                          style={{
                            padding: '6px 12px',
                            borderRadius: '8px',
                            background: 'var(--body-shell-bg)',
                            border: '1px solid var(--body-card-border)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '12px',
                            fontWeight: 600,
                            color: 'var(--body-text-main)',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <AppIcon name="arrowRight" size={12} style={{ color: 'var(--body-accent)' }} />
                          <span>{altEx.name}</span>
                          <span style={{ fontSize: '10.5px', color: 'var(--body-text-muted)' }}>
                            ({altEx.equipment === 'bw' ? 'Bodyweight' : altEx.equipment === 'db' ? 'Tạ đơn' : 'Xà'})
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── BẬC THANG BIẾN THỂ BÀI TẬP (PROGRESSION CHAIN) ── */}
            {progressionChain && (
              <div style={{
                padding: '16px',
                borderRadius: '14px',
                background: 'var(--body-shell-bg)',
                border: '1px solid var(--body-card-border)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontWeight: 700, fontSize: '13.5px', color: 'var(--body-text-main)' }}>
                    <AppIcon name="treeStructure" size={16} style={{ color: 'var(--body-accent)' }} />
                    <span>Bậc thang biến thể: {progressionChain.chainName}</span>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--body-text-muted)' }}>
                    {progressionChain.chainItems.length} cấp độ
                  </span>
                </div>

                {/* Thanh chuỗi tiến trình trực quan */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  overflowX: 'auto',
                  padding: '4px 0'
                }}>
                  {progressionChain.chainItems.map((item, idx) => {
                    const isCur = item.key === selectedEx.key;
                    return (
                      <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 'none' }}>
                        <button
                          type="button"
                          onClick={() => setSelectedKey(item.key)}
                          title={`Bấm để xem bài: ${item.name}`}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '9px',
                            border: isCur ? '1.5px solid var(--body-accent)' : '1px solid var(--body-card-border)',
                            background: isCur ? 'var(--body-accent-soft)' : 'var(--body-card-bg)',
                            color: isCur ? 'var(--body-accent)' : 'var(--body-text-main)',
                            fontSize: '12px',
                            fontWeight: isCur ? 700 : 500,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <span style={{
                            width: '18px',
                            height: '18px',
                            borderRadius: '50%',
                            background: isCur ? 'var(--body-accent)' : 'var(--body-shell-bg)',
                            color: isCur ? '#FFF' : 'var(--body-text-muted)',
                            fontSize: '10px',
                            fontWeight: 700,
                            display: 'grid',
                            placeItems: 'center'
                          }}>
                            {idx + 1}
                          </span>
                          <span>{item.name}</span>
                          {isCur && <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--body-accent)' }}>(Hiện tại)</span>}
                        </button>
                        {idx < progressionChain.chainItems.length - 1 && (
                          <span style={{ color: 'var(--body-text-muted)', fontSize: '12px' }}>➔</span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* 2 nút chọn biến thể: Dễ hơn vs Khó hơn */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
                  {progressionChain.easierEx ? (
                    <div style={{
                      padding: '12px',
                      borderRadius: '10px',
                      background: 'var(--body-card-bg)',
                      border: '1px solid #CFE8D8',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px'
                    }}>
                      <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--body-green-text)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <AppIcon name="arrowDown" size={13} />
                        <span>Dễ hơn cho người mới (Regression):</span>
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--body-text-main)' }}>
                        {progressionChain.easierEx.name}
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedKey(progressionChain.easierEx.key)}
                        style={{
                          marginTop: '4px',
                          padding: '6px 10px',
                          borderRadius: '7px',
                          border: 'none',
                          background: 'var(--body-green-soft)',
                          color: 'var(--body-green-text)',
                          fontSize: '11.5px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          alignSelf: 'flex-start'
                        }}
                      >
                        <span>Đổi sang bài dễ hơn này</span>
                        <AppIcon name="arrowRight" size={11} />
                      </button>
                    </div>
                  ) : (
                    <div style={{
                      padding: '12px',
                      borderRadius: '10px',
                      background: 'var(--body-card-bg)',
                      border: '1px dashed var(--body-card-border)',
                      fontSize: '12px',
                      color: 'var(--body-text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      <AppIcon name="checkCircle" size={14} style={{ color: 'var(--body-green)' }} />
                      <span>Đây đã là biến thể dễ nhất cho người mới bắt đầu</span>
                    </div>
                  )}

                  {progressionChain.harderEx ? (
                    <div style={{
                      padding: '12px',
                      borderRadius: '10px',
                      background: 'var(--body-card-bg)',
                      border: '1px solid rgba(105, 73, 232, 0.25)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px'
                    }}>
                      <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--body-accent)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <AppIcon name="arrowUp" size={13} />
                        <span>Khó hơn khi đã quen (Progression):</span>
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--body-text-main)' }}>
                        {progressionChain.harderEx.name}
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedKey(progressionChain.harderEx.key)}
                        style={{
                          marginTop: '4px',
                          padding: '6px 10px',
                          borderRadius: '7px',
                          border: 'none',
                          background: 'var(--body-accent-soft)',
                          color: 'var(--body-accent)',
                          fontSize: '11.5px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          alignSelf: 'flex-start'
                        }}
                      >
                        <span>Thử thách bài khó hơn này</span>
                        <AppIcon name="arrowRight" size={11} />
                      </button>
                    </div>
                  ) : (
                    <div style={{
                      padding: '12px',
                      borderRadius: '10px',
                      background: 'var(--body-card-bg)',
                      border: '1px dashed var(--body-card-border)',
                      fontSize: '12px',
                      color: 'var(--body-text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      <AppIcon name="crown" size={14} style={{ color: '#E0A23C' }} />
                      <span>Đây là cấp độ thử thách cao nhất trong chuỗi</span>
                    </div>
                  )}
                </div>

                {/* Ghi chú cơ sinh học vì sao dễ/khó hơn */}
                {progressionChain.note && (
                  <div style={{
                    fontSize: '12px',
                    lineHeight: 1.55,
                    color: 'var(--body-text-sub)',
                    background: 'var(--body-card-bg)',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--body-card-border)'
                  }}>
                    💡 <strong>Cơ sinh học:</strong> {progressionChain.note}
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '16px', borderTop: '1px solid var(--body-card-border)' }}>
              <button
                className="body-btn"
                onClick={handleOpenAddModal}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--body-shell-bg)' }}
              >
                <AppIcon name="plus" size={14} />
                <span>Thêm vào kế hoạch</span>
              </button>
              <button
                className="body-btn body-btn-primary"
                onClick={() => onStartExercise?.(selectedEx)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <AppIcon name="play" size={14} />
                <span>Tập bài này ngay</span>
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {/* ── MODAL: THÊM VÀO KẾ HOẠCH ────────────────────────────── */}
      {showAddModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div className="body-card" style={{ maxWidth: '440px', width: '100%', display: 'flex', flexDirection: 'column', gap: '18px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '17px', fontWeight: 700 }}>Thêm vào kế hoạch tuần</div>
              <button className="body-btn-icon" onClick={() => setShowAddModal(false)}>
                <AppIcon name="x" size={16} />
              </button>
            </div>

            <div style={{ fontSize: '13px', color: 'var(--body-text-muted)' }}>
              Thêm bài <strong style={{ color: 'var(--body-text-main)' }}>{selectedEx?.name}</strong> vào lộ trình đang theo ({activeRoutine?.name || 'Mặc định'}).
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--body-text-sub)' }}>Chọn thứ trong tuần:</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
                {[
                  { d: 1, label: 'T2' },
                  { d: 2, label: 'T3' },
                  { d: 3, label: 'T4' },
                  { d: 4, label: 'T5' },
                  { d: 5, label: 'T6' },
                  { d: 6, label: 'T7' },
                  { d: 7, label: 'CN' }
                ].map(item => (
                  <button
                    key={item.d}
                    type="button"
                    className="body-btn"
                    style={{
                      padding: '8px 0',
                      textAlign: 'center',
                      background: addDay === item.d ? 'var(--body-accent)' : 'var(--body-shell-bg)',
                      color: addDay === item.d ? '#fff' : 'var(--body-text-main)',
                      fontWeight: 600,
                      borderRadius: '8px'
                    }}
                    onClick={() => setAddDay(item.d)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--body-text-sub)', display: 'block', marginBottom: '4px' }}>Số Set:</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={addSets}
                  onChange={e => setAddSets(Math.max(1, Number(e.target.value)))}
                  style={{ width: '100%', height: '36px', padding: '0 10px', borderRadius: '8px', border: '1px solid var(--body-card-border)', background: 'var(--body-shell-bg)', color: 'var(--body-text-main)', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--body-text-sub)', display: 'block', marginBottom: '4px' }}>Mục tiêu ({selectedEx?.metric === 's' ? 'giây' : 'rep'}):</label>
                <input
                  type="number"
                  min="1"
                  max="300"
                  value={addTarget}
                  onChange={e => setAddTarget(Math.max(1, Number(e.target.value)))}
                  style={{ width: '100%', height: '36px', padding: '0 10px', borderRadius: '8px', border: '1px solid var(--body-card-border)', background: 'var(--body-shell-bg)', color: 'var(--body-text-main)', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
              <button className="body-btn" onClick={() => setShowAddModal(false)}>Hủy</button>
              <button className="body-btn body-btn-primary" onClick={handleConfirmAddToRoutine}>
                Xác nhận thêm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
