import { useState } from 'react';
import AppIcon from '../AppIcon';
import ChonSheet from './ChonSheet';
import { financeFor } from './chonData';
import { parseCurrencyInput, formatVND } from '../../utils/currencyUtils';

/**
 * Chốt một lựa chọn tour. Số tiền mặc định = giá / người × số người (sửa được: cọc trước, giảm giá nhóm…);
 * công tắc ghi vào Tài chính · Du lịch. Gọi RPC choose_trip_option — chốt và ghi giao dịch trong một transaction.
 *
 * @param {(finance|null) => Promise<boolean>} onConfirm — finance = { amount, category_id, subcategory_id, necessity }
 */
export default function ChonChooseDialog({ trip, option, letter, finCats, onConfirm, onClose }) {
  const fin = financeFor('travel', finCats);
  const suggested = option.price_per_person ? option.price_per_person * (trip.people || 1) : 0;
  const [amount, setAmount] = useState(suggested ? String(suggested) : '');
  const [toFinance, setToFinance] = useState(suggested > 0 && !trip.finance_tx_id);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const amountNum = amount ? parseCurrencyInput(amount) : 0;

  const confirm = async () => {
    if (busy) return;
    if (toFinance && !(amountNum > 0)) { setError('Nhập số tiền để ghi vào Tài chính, hoặc tắt công tắc.'); return; }
    setBusy(true);
    const ok = await onConfirm(toFinance ? { amount: amountNum, ...fin } : null);
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <ChonSheet
      title={`Chốt lựa chọn ${letter}`}
      subtitle={[option.name, option.provider].filter(Boolean).join(' · ')}
      onClose={onClose}
      size="sm"
      footer={(
        <button type="button" className="chon-btn chon-btn--lamp chon-btn--grow" onClick={confirm} disabled={busy} data-autofocus>
          <AppIcon name="check" size={17} weight="bold" />Chốt {letter}
        </button>
      )}
    >
      <div className="chon-form">
        <p className="chon-hint">
          Chuyến chuyển sang <strong>Đã chốt</strong>. Đổi ý vẫn chốt lại lựa chọn khác được
          {trip.finance_tx_id ? ' — giao dịch đã ghi lần trước vẫn giữ bên Tài chính.' : '.'}
        </p>
        <div className="chon-panel chon-spend">
          <span className="chon-spend__icon" aria-hidden="true"><AppIcon name="wallet" size={17} /></span>
          <div className="chon-spend__main">
            <input className="chon-input chon-input--bare chon-spend__input" value={amount} onChange={e => setAmount(e.target.value)}
              inputMode="decimal" placeholder="Số tiền: 4.9tr" aria-label="Số tiền ghi vào Tài chính" />
            <span className="chon-spend__hint">
              {amountNum > 0 ? formatVND(amountNum) : 'Tổng cả nhóm hoặc tiền cọc'}
              {suggested > 0 && ` · gợi ý ${formatVND(option.price_per_person)} × ${trip.people || 1}`}
              {toFinance ? ` · ghi vào Tài chính · ${fin.label}` : ' · không ghi Tài chính'}
            </span>
          </div>
          <button type="button" role="switch" aria-checked={toFinance} aria-label="Ghi vào Tài chính"
            className={`chon-switch${toFinance ? ' is-on' : ''}`} onClick={() => setToFinance(v => !v)}>
            <span aria-hidden="true" />
          </button>
        </div>
        {error && <p className="chon-error" role="alert">{error}</p>}
      </div>
    </ChonSheet>
  );
}
