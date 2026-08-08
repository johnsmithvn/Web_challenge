import { useState } from 'react';
import { NECESSITY_META, CATS, Segmented } from './parts';

export default function CatsScreen({ nav }) {
  const [open, setOpen] = useState(null);
  return (
    <div className="fin-cats">
      <Segmented options={[{ value: 'cats', label: 'Danh mục' }, { value: 'fields', label: 'Schema' }]}
        value={nav.catsTab} onChange={nav.setCatsTab} />

      {nav.catsTab === 'cats' ? (
        <>
          <p className="fin-note">11 nhóm chi (kèm danh mục con + mức cần thiết) và 7 nhóm thu riêng biệt. Sửa hạn mức ở tab Phân tích › Ngân sách. Sửa cấu trúc danh mục sẽ có ở bản sau.</p>
          <div className="fin-card">
            <div className="fin-card__title">Nhóm chi</div>
            {CATS.expenseGroups.map(g => (
              <div key={g.key} className="fin-catgroup">
                <button className="fin-catgroup__head" onClick={() => setOpen(open === g.key ? null : g.key)}
                  style={{ '--c': g.color }}>
                  <span className="fin-catgroup__dot" />
                  <span>{g.icon} {g.label}</span>
                  <span className="fin-catgroup__count">{g.subs.length} mục</span>
                </button>
                {open === g.key && (
                  <div className="fin-catgroup__subs">
                    {g.subs.map(s => (
                      <div key={s.key} className="fin-catgroup__sub">
                        <span>{s.label}</span>
                        <span className="fin-nchip" style={{ '--c': NECESSITY_META[s.necessity].color }}>
                          {NECESSITY_META[s.necessity].label}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="fin-card">
            <div className="fin-card__title">Nhóm thu (riêng biệt)</div>
            <div className="fin-incomerow">
              {CATS.incomeGroups.map(g => (
                <span key={g.key} className="fin-incometag" style={{ '--c': g.color }}>{g.icon} {g.label}</span>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="fin-card fin-schema">
          <div className="fin-card__title">Mô hình dữ liệu</div>
          <p>App <strong>không tính số dư</strong>. Mọi con số là một phép đếm chạy lại trên bảng giao dịch, lọc theo <code>occurred_at</code>. Sửa giao dịch cũ → mọi báo cáo tự đúng lại.</p>
          <ul className="fin-schema__list">
            <li><strong>transaction</strong> — bảng duy nhất. <code>type</code> chi/thu/để dành; <code>excluded</code> cho trả gốc vay & trả sao kê thẻ (ngoài mọi tổng chi); <code>necessity</code> suy từ danh mục con.</li>
            <li><strong>bill</strong> — hóa đơn định kỳ; <code>ask</code> đẩy vào hộp "Cần bạn ghi", không tự ghi. Lịch sử = query giao dịch theo <code>bill_id</code>.</li>
            <li><strong>loan</strong> — lãi là chi tiêu, gốc thì không (gốc mang cờ excluded).</li>
            <li><strong>card</strong> — ngày chốt ≠ đến hạn; khoảng giữa là float. Trả sao kê không phải chi mới.</li>
            <li><strong>saving_goal</strong> — không có cột số dư; số dư = tổng các <strong>deposit</strong>.</li>
            <li><strong>income_rule / shortcut / budget</strong> — thu định kỳ / nút nhập nhanh (không chốt tiền) / hạn mức (cơ sở 50/30/20).</li>
          </ul>
          <p className="fin-note">Chi tiết đầy đủ: <code>docs/DESIGN_FINANCE.md</code> và <code>data/migration_v6.0.0_finance.sql</code>.</p>
        </div>
      )}
    </div>
  );
}
