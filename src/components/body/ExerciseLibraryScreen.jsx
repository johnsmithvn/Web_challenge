import { useState, useMemo } from 'react';
import AppIcon from '../AppIcon';
import BASE_EXERCISES from '../../data/body-exercises.json';

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
                    Cơ chính: {ex.primary} · {ex.equipment === 'bw' ? 'Bodyweight' : ex.equipment === 'db' ? 'Tạ đơn' : 'Xà'}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {ex.warn && (
                    <span className="body-badge body-badge-amber" style={{ fontSize: '11px', padding: '2px 6px' }}>
                      Lưu ý lưng
                    </span>
                  )}
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
                  Nhóm cơ chính: <strong style={{ color: 'var(--body-text-main)' }}>{selectedEx.primary}</strong>
                  {(selectedEx.secondary || []).length > 0 && (
                    <span> · Phụ: {selectedEx.secondary.join(', ')}</span>
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

            {/* Cảnh báo sức khỏe nếu có */}
            {selectedEx.warn && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 16px',
                borderRadius: '12px',
                background: 'var(--body-amber-soft)',
                border: '1px solid #F4DDBE',
                color: 'var(--body-amber)'
              }}>
                <AppIcon name="warning" size={20} style={{ flex: 'none' }} />
                <div style={{ fontSize: '13px', lineHeight: 1.5 }}>
                  {selectedEx.warn}
                </div>
              </div>
            )}

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
