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

// ── Can Chi & Giờ Hoàng Đạo (Đối chiếu theo mốc thực tế từ ảnh chụp) ────────
import {
  getCanChiYear,
  getCanChiMonth,
  getCanChiDay,
  getZodiacHours,
  getUpcomingEvents,
} from '../../utils/lunarUtils.js';

// Ngày 01/09/2026: 20/07 Âm lịch
{
  const l = solarToLunar(1, 9, 2026);
  assert.equal(l.day, 20);
  assert.equal(l.month, 7);
  assert.equal(l.year, 2026);

  // Năm Bính Ngọ
  assert.equal(getCanChiYear(l.year), 'Bính Ngọ');

  // Tháng Bính Thân
  assert.equal(getCanChiMonth(l.year, l.month), 'Bính Thân');

  // Ngày Mậu Dần
  const dayCanChi = getCanChiDay(1, 9, 2026);
  assert.equal(dayCanChi.full, 'Mậu Dần');

  // Giờ hoàng đạo của ngày Dần: Tý, Sửu, Thìn, Tỵ, Mùi, Tuất
  const zodiac = getZodiacHours(1, 9, 2026, 9); // lúc 9h sáng (giờ Tỵ)
  const hoangDaoHours = zodiac.filter((z) => z.isHoangDao).map((z) => z.name);
  assert.deepEqual(hoangDaoHours, ['Tý', 'Sửu', 'Thìn', 'Tỵ', 'Mùi', 'Tuất']);

  // Khung giờ 9-11 là giờ Tỵ phải có isNow === true
  const ty = zodiac.find((z) => z.name === 'Tỵ');
  assert.equal(ty?.isNow, true);
}

// ── Đếm ngược sự kiện ──────────────────────────────────────────────────────
{
  const mockHolidays = {
    solar: { '09-02': 'Quốc khánh' },
    lunar: { '08-15': 'Tết Trung Thu' },
  };
  const baseDate = new Date(2026, 8, 1); // 01/09/2026
  const events = getUpcomingEvents(baseDate, mockHolidays, 30);

  assert.ok(events.length >= 2);
  const qk = events.find((e) => e.title === 'Quốc khánh');
  assert.equal(qk?.diffDays, 1);
  assert.equal(qk?.countdownLabel, 'Còn 1 ngày');

  const tt = events.find((e) => e.title === 'Tết Trung Thu');
  assert.equal(tt?.diffDays, 24);
  assert.equal(tt?.countdownLabel, 'Còn 24 ngày');
}

// ── Ngày lễ quốc tế & Bật/Tắt toggle ──────────────────────────────────────
{
  const mockHolidays = {
    solar: { '09-02': 'Quốc khánh' },
    lunar: {},
    international: { '09-21': 'Quốc tế Hòa bình' },
    japan: { '09-23': 'Thu phân (Shubun no Hi)' },
    fun: { '09-13': 'Ngày Lập trình viên' },
  };
  const baseDate = new Date(2026, 8, 1); // 01/09/2026

  // 1. Mặc định bật international
  const allEvents = getUpcomingEvents(baseDate, mockHolidays, 30, {
    solar: true,
    lunar: true,
    international: true,
    japan: true,
    fun: true,
    custom: true,
  });

  const intlEvent = allEvents.find((e) => e.title === 'Quốc tế Hòa bình');
  assert.ok(intlEvent, 'Phải tìm thấy ngày lễ quốc tế');
  assert.equal(intlEvent.type, 'international');
  assert.equal(intlEvent.diffDays, 20);
  assert.equal(intlEvent.countdownLabel, 'Còn 20 ngày');

  // 2. Tắt international
  const noIntl = getUpcomingEvents(baseDate, mockHolidays, 30, {
    solar: true,
    international: false,
    japan: false,
    fun: false,
    custom: false,
  });
  assert.equal(noIntl.some((e) => e.type === 'international'), false, 'Tắt international phải không còn');
}

// ── Kỷ niệm cá nhân (Custom Anniversaries: Dương lịch & Âm lịch) ───────────
{
  const mockHolidays = { solar: {}, lunar: {}, international: {}, japan: {}, fun: {} };
  const baseDate = new Date(2026, 8, 1); // 01/09/2026 (âm lịch: 20/07 năm Bính Ngọ)

  const customList = [
    {
      id: 'anniv-wedding',
      title: 'Kỷ niệm ngày cưới',
      calType: 'solar',
      day: 5,
      month: 9,
      year: 2023, // 2026 - 2023 = 3 năm
      icon: '💍',
    },
    {
      id: 'anniv-death-anniv',
      title: 'Ngày giỗ cụ nội',
      calType: 'lunar',
      day: 15,
      month: 8, // Rằm tháng 8 âm (08/15 âm rơi vào 25/09/2026 dương)
      year: null,
      icon: '🕊️',
    },
  ];

  const events = getUpcomingEvents(
    baseDate,
    mockHolidays,
    30,
    { solar: true, lunar: true, international: true, custom: true },
    customList
  );

  // Kiểm tra kỷ niệm ngày cưới (Dương lịch + tính số năm)
  const wedding = events.find((e) => e.id === 'anniv-wedding');
  assert.ok(wedding, 'Phải tìm thấy kỷ niệm ngày cưới');
  assert.equal(wedding.diffDays, 4); // 01/09 -> 05/09 là 4 ngày
  assert.equal(wedding.countdownLabel, 'Còn 4 ngày');
  assert.equal(wedding.title, '💍 Kỷ niệm ngày cưới (3 năm)');
  assert.equal(wedding.type, 'custom');
  assert.equal(wedding.isCustom, true);

  // Kiểm tra ngày giỗ (Âm lịch)
  const deathAnniv = events.find((e) => e.id === 'anniv-death-anniv');
  assert.ok(deathAnniv, 'Phải tìm thấy ngày giỗ cụ nội âm lịch');
  assert.equal(deathAnniv.diffDays, 24); // 25/09/2026 là rằm tháng 8
  assert.equal(deathAnniv.title, '🕊️ Ngày giỗ cụ nội');
  assert.equal(deathAnniv.type, 'custom');

  // Kiểm tra tắt custom toggle
  const noCustom = getUpcomingEvents(
    baseDate,
    mockHolidays,
    30,
    { custom: false },
    customList
  );
  assert.equal(noCustom.some((e) => e.type === 'custom'), false, 'Tắt custom phải không còn kỷ niệm');

  // Bất biến sắp xếp: diffDays phải tăng dần
  for (let i = 1; i < events.length; i++) {
    assert.ok(events[i].diffDays >= events[i - 1].diffDays, 'Events phải được sort theo diffDays');
  }
}

console.log('lunarUtils check: OK');

