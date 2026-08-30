import assert from 'node:assert/strict';
import { solarToLunar, lunarLabel } from '../../utils/lunarUtils.js';

// ── Mốc đối chiếu (tra được ở mọi lịch vạn niên) ──────────────────────────
// Ví dụ chuẩn trên trang thuật toán gốc: 1/1/2000 = 25/11 âm năm Kỷ Mão 1999.
{
  const l = solarToLunar(1, 1, 2000);
  assert.equal(l.day, 25);
  assert.equal(l.month, 11);
  assert.equal(l.year, 1999);
}

// Tết Nguyên Đán 2026 rơi vào 17/02/2026 dương.
{
  const l = solarToLunar(17, 2, 2026);
  assert.equal(l.day, 1);
  assert.equal(l.month, 1);
  assert.equal(l.year, 2026);
  // Hôm trước phải là ngày cuối tháng Chạp năm trước (30 hoặc 29).
  const eve = solarToLunar(16, 2, 2026);
  assert.equal(eve.month, 12);
  assert.equal(eve.year, 2025);
  assert.ok(eve.day === 29 || eve.day === 30, `giao thừa phải 29/30, nhận ${eve.day}`);
}

// Tết Nguyên Đán 2025 rơi vào 29/01/2025 dương.
{
  const l = solarToLunar(29, 1, 2025);
  assert.equal(l.day, 1);
  assert.equal(l.month, 1);
  assert.equal(l.year, 2025);
}

// ── Bất biến: quét 3 năm liên tục, mọi ngày phải hợp lệ và tăng đều ────────
{
  let prev = null;
  const d = new Date(2024, 0, 1);
  for (let i = 0; i < 365 * 3; i++) {
    const l = solarToLunar(d.getDate(), d.getMonth() + 1, d.getFullYear());
    assert.ok(l.day >= 1 && l.day <= 30, `ngày âm ngoài khoảng: ${l.day}`);
    assert.ok(l.month >= 1 && l.month <= 12, `tháng âm ngoài khoảng: ${l.month}`);
    if (prev) {
      // Ngày âm chỉ được +1, hoặc quay về 1 khi sang tháng mới.
      const ok = l.day === prev.day + 1 || (l.day === 1 && prev.day >= 29);
      assert.ok(ok, `bước nhảy sai: ${prev.day} → ${l.day} tại ${d.toISOString().slice(0, 10)}`);
    }
    prev = l;
    d.setDate(d.getDate() + 1);
  }
}

// ── Nhãn hiện trong ô lịch ────────────────────────────────────────────────
assert.equal(lunarLabel({ day: 1, month: 7 }), '1/7');
assert.equal(lunarLabel({ day: 15, month: 7 }), '15');

console.log('lunarUtils check: OK');
