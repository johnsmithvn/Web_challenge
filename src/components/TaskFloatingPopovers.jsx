import { useEffect, useRef } from 'react';
import AppIcon from './AppIcon';
import { PRIORITY_LABELS } from '../utils/taskNlpParser';
import { toDateStr } from '../utils/dateUtils';

/**
 * TaskFloatingPopovers — Tập hợp các floating popovers xuất hiện tại chỗ khi click thẻ:
 * 1. Date/Time Picker (có Âm lịch)
 * 2. Priority Picker
 * 3. Status Picker
 * 4. Date Range Picker
 */

export function StatusPopover({ currentStatus, onSelect, onClose, style }) {
  const ref = useRef(null);

  useEffect(() => {
    const handleDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        onClose();
      }
    };
    window.addEventListener('pointerdown', handleDown);
    return () => window.removeEventListener('pointerdown', handleDown);
  }, [onClose]);

  const items = [
    { key: 'todo', label: 'Cần làm', color: '#60A5FA', icon: 'circle' },
    { key: 'doing', label: 'Đang làm', color: '#FBBF24', icon: 'hourglass' },
    { key: 'done', label: 'Hoàn thành', color: '#34D399', icon: 'check-circle' },
    { key: 'skip', label: 'Bỏ qua', color: '#94A3B8', icon: 'prohibit' },
  ];

  return (
    <div
      ref={ref}
      className="tk-popover"
      style={{
        minWidth: '160px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        ...style,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--tk-text-mute)', padding: '4px 8px' }}>
        Chuyển trạng thái
      </div>
      {items.map((it) => (
        <button
          key={it.key}
          type="button"
          onClick={() => {
            onSelect(it.key);
            onClose();
          }}
          style={{
            height: '32px',
            borderRadius: '8px',
            border: 'none',
            background: currentStatus === it.key ? 'var(--tk-border)' : 'transparent',
            color: 'var(--tk-text-main)',
            fontSize: '12.5px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '0 8px',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: it.color }} />
          <span>{it.label}</span>
          {currentStatus === it.key && (
            <span style={{ marginLeft: 'auto', color: 'var(--tk-accent)' }}>
              <AppIcon name="check" size={14} />
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export function PriorityPopover({ currentPriority = 0, onSelect, onClose, style }) {
  const ref = useRef(null);

  useEffect(() => {
    const handleDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        onClose();
      }
    };
    window.addEventListener('pointerdown', handleDown);
    return () => window.removeEventListener('pointerdown', handleDown);
  }, [onClose]);

  const levels = [5, 4, 3, 2, 1, 0];
  const colors = {
    5: '#EF4444',
    4: '#F97316',
    3: '#EAB308',
    2: '#3B82F6',
    1: '#94A3B8',
    0: '#5B6480',
  };

  return (
    <div
      ref={ref}
      className="tk-popover"
      style={{
        minWidth: '170px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        ...style,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--tk-text-mute)', padding: '4px 8px' }}>
        Mức độ ưu tiên
      </div>
      {levels.map((lvl) => (
        <button
          key={lvl}
          type="button"
          onClick={() => {
            onSelect(lvl);
            onClose();
          }}
          style={{
            height: '32px',
            borderRadius: '8px',
            border: 'none',
            background: Number(currentPriority) === lvl ? 'var(--tk-border)' : 'transparent',
            color: colors[lvl],
            fontSize: '12.5px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '0 8px',
            cursor: 'pointer',
          }}
        >
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: colors[lvl] }} />
          <span>{PRIORITY_LABELS[lvl]?.label || 'Không ưu tiên'}</span>
          {Number(currentPriority) === lvl && (
            <span style={{ marginLeft: 'auto', color: 'var(--tk-accent)' }}>
              <AppIcon name="check" size={14} />
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export function TaskDatePickerPopover({
  initialDate,
  initialTime,
  onSave,
  onClose,
  style,
}) {
  const ref = useRef(null);

  useEffect(() => {
    const handleDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        onClose();
      }
    };
    window.addEventListener('pointerdown', handleDown);
    return () => window.removeEventListener('pointerdown', handleDown);
  }, [onClose]);

  const todayStr = toDateStr();

  const handleShortcut = (daysToAdd, timeStr = null) => {
    const [y, m, d] = todayStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + daysToAdd);
    const yy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    onSave(`${yy}-${mm}-${dd}`, timeStr !== null ? timeStr : initialTime);
    onClose();
  };

  return (
    <div
      ref={ref}
      className="tk-popover"
      style={{
        width: '260px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        ...style,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--tk-text-mute)' }}>
          Chọn ngày & giờ
        </span>
        <button
          type="button"
          onClick={() => {
            onSave(null, null);
            onClose();
          }}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--tk-text-mute)',
            fontSize: '11.5px',
            cursor: 'pointer',
          }}
        >
          Xóa hạn
        </button>
      </div>

      {/* Phím tắt nhanh */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
        <button
          type="button"
          onClick={() => handleShortcut(0)}
          style={{
            height: '30px',
            borderRadius: '6px',
            border: '1px solid var(--tk-border)',
            background: 'var(--tk-border-soft)',
            color: 'var(--tk-text-main)',
            fontSize: '12px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Hôm nay
        </button>
        <button
          type="button"
          onClick={() => handleShortcut(1)}
          style={{
            height: '30px',
            borderRadius: '6px',
            border: '1px solid var(--tk-border)',
            background: 'var(--tk-border-soft)',
            color: 'var(--tk-text-main)',
            fontSize: '12px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Ngày mai
        </button>
        <button
          type="button"
          onClick={() => {
            const dow = new Date().getDay();
            const daysUntilMonday = ((1 - dow + 7) % 7) || 7;
            handleShortcut(daysUntilMonday);
          }}
          style={{
            height: '30px',
            borderRadius: '6px',
            border: '1px solid var(--tk-border)',
            background: 'var(--tk-border-soft)',
            color: 'var(--tk-text-main)',
            fontSize: '12px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Thứ Hai
        </button>
        <button
          type="button"
          onClick={() => handleShortcut(7)}
          style={{
            height: '30px',
            borderRadius: '6px',
            border: '1px solid var(--tk-border)',
            background: 'var(--tk-border-soft)',
            color: 'var(--tk-text-main)',
            fontSize: '12px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Tuần sau
        </button>
      </div>

      {/* Input ngày & giờ trực tiếp */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
        <input
          type="date"
          defaultValue={initialDate || todayStr}
          id="tk-pop-date-input"
          style={{
            height: '32px',
            borderRadius: '6px',
            border: '1px solid var(--tk-border)',
            background: 'var(--tk-card-bg)',
            color: 'var(--tk-text-main)',
            padding: '0 8px',
            fontSize: '12.5px',
          }}
        />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
          {['09:00', '12:00', '18:00', '21:00'].map((tm) => (
            <button
              key={tm}
              type="button"
              onClick={() => {
                const dateVal = document.getElementById('tk-pop-date-input')?.value || todayStr;
                onSave(dateVal, tm);
                onClose();
              }}
              style={{
                height: '26px',
                borderRadius: '4px',
                border: '1px solid var(--tk-border)',
                background: initialTime === tm ? 'var(--tk-accent-soft)' : 'transparent',
                color: initialTime === tm ? 'var(--tk-accent)' : 'var(--tk-text-sub)',
                fontSize: '11px',
                cursor: 'pointer',
              }}
            >
              {tm}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
        <button
          type="button"
          onClick={() => {
            const dateVal = document.getElementById('tk-pop-date-input')?.value;
            onSave(dateVal, initialTime);
            onClose();
          }}
          className="tk-btn-primary"
          style={{ flex: 1, height: '32px', fontSize: '12px', justifyContent: 'center' }}
        >
          Áp dụng
        </button>
      </div>
    </div>
  );
}

export function RecurrencePopover({ currentRule, onSelect, onClose, style }) {
  const ref = useRef(null);

  useEffect(() => {
    const handleDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        onClose();
      }
    };
    window.addEventListener('pointerdown', handleDown);
    return () => window.removeEventListener('pointerdown', handleDown);
  }, [onClose]);

  const options = [
    { label: 'Không lặp', rule: null, icon: 'minus' },
    { label: 'Hằng ngày', rule: { type: 'interval', days: 1 }, icon: 'repeat' },
    { label: 'Mỗi 2 ngày', rule: { type: 'interval', days: 2 }, icon: 'repeat' },
    { label: 'Hàng tuần', rule: { type: 'weekly', weekday: new Date().getDay() }, icon: 'calendar' },
    { label: 'Hàng tháng', rule: { type: 'monthly', day: new Date().getDate() }, icon: 'calendar' },
  ];

  return (
    <div
      ref={ref}
      className="tk-popover"
      style={{
        minWidth: '180px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        ...style,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--tk-text-mute)', padding: '4px 8px' }}>
        Chu kỳ lặp lại
      </div>
      {options.map((opt, idx) => {
        const isSelected = (!currentRule && !opt.rule) || (currentRule && opt.rule && currentRule.type === opt.rule.type);
        return (
          <button
            key={idx}
            type="button"
            onClick={() => {
              onSelect(opt.rule);
              onClose();
            }}
            style={{
              height: '32px',
              borderRadius: '8px',
              border: 'none',
              background: isSelected ? 'rgba(94, 242, 194, 0.12)' : 'transparent',
              color: isSelected ? 'var(--tk-accent, #5EF2C2)' : 'var(--tk-text-main)',
              fontSize: '12.5px',
              fontWeight: isSelected ? 600 : 400,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '0 8px',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <AppIcon name={opt.icon} size={14} color={isSelected ? 'var(--tk-accent, #5EF2C2)' : 'var(--tk-text-sub)'} />
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

