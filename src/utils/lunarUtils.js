/**
 * lunarUtils — đổi dương lịch → âm lịch Việt Nam (múi giờ +7).
 *
 * Thuật toán chuẩn của Hồ Ngọc Đức (dựa trên Jean Meeus, "Astronomical
 * Algorithms"): tìm ngày Sóc (new moon) và kinh độ Mặt Trời, từ đó suy ra
 * tháng âm + tháng nhuận. Chép nguyên công thức, KHÔNG tự chế — sai số ở đây
 * đẩy Tết lệch cả ngày.
 *
 * Cố ý không thêm thư viện: chỉ cần đúng 1 hàm đổi ngày, và mọi lib âm lịch
 * đều kéo theo cả bộ format/locale không dùng tới.
 *
 * Hàm thuần, không React/Supabase → test bằng node:assert ở lunarUtils.test.js.
 */

const PI = Math.PI;
const TIMEZONE = 7; // Việt Nam, UTC+7

/** Số ngày Julian của 1 ngày dương lịch (theo lịch Gregory, có nhánh Julius cũ). */
function jdFromDate(dd, mm, yy) {
  const a = Math.floor((14 - mm) / 12);
  const y = yy + 4800 - a;
  const m = mm + 12 * a - 3;
  let jd = dd + Math.floor((153 * m + 2) / 5) + 365 * y
    + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
  if (jd < 2299161) {
    jd = dd + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - 32083;
  }
  return jd;
}

/** Ngày Sóc thứ k tính từ 1/1/1900 (trả về số ngày Julian, đã quy về múi giờ). */
function getNewMoonDay(k, timeZone) {
  const T = k / 1236.85;
  const T2 = T * T;
  const T3 = T2 * T;
  const dr = PI / 180;

  let Jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;
  Jd1 += 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);

  const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
  const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
  const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;

  let C1 = (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * dr * M);
  C1 -= 0.4068 * Math.sin(Mpr * dr) - 0.0161 * Math.sin(dr * 2 * Mpr);
  C1 -= 0.0004 * Math.sin(dr * 3 * Mpr);
  C1 += 0.0104 * Math.sin(dr * 2 * F) - 0.0051 * Math.sin(dr * (M + Mpr));
  C1 -= 0.0074 * Math.sin(dr * (M - Mpr)) - 0.0004 * Math.sin(dr * (2 * F + M));
  C1 -= 0.0004 * Math.sin(dr * (2 * F - M)) + 0.0006 * Math.sin(dr * (2 * F + Mpr));
  C1 += 0.0010 * Math.sin(dr * (2 * F - Mpr)) + 0.0005 * Math.sin(dr * (2 * Mpr + M));

  const deltat = T < -11
    ? 0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3
    : -0.000278 + 0.000265 * T + 0.000262 * T2;

  return Math.floor(Jd1 + C1 - deltat + 0.5 + timeZone / 24);
}

/** Kinh độ Mặt Trời tại ngày Julian jdn, trả về cung 0..11 (mỗi cung 30°). */
function getSunLongitude(jdn, timeZone) {
  const T = (jdn - 2451545.5 - timeZone / 24) / 36525;
  const T2 = T * T;
  const dr = PI / 180;

  const M = 357.52910 + 35999.05030 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
  const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;

  let DL = (1.914600 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M);
  DL += (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) + 0.000290 * Math.sin(dr * 3 * M);

  let L = (L0 + DL) * dr;
  L -= PI * 2 * Math.floor(L / (PI * 2));
  return Math.floor(L / PI * 6);
}

/** Ngày bắt đầu tháng 11 âm của năm dương yy (mốc để đánh số các tháng khác). */
function getLunarMonth11(yy, timeZone) {
  const off = jdFromDate(31, 12, yy) - 2415021;
  const k = Math.floor(off / 29.530588853);
  const nm = getNewMoonDay(k, timeZone);
  return getSunLongitude(nm, timeZone) >= 9 ? getNewMoonDay(k - 1, timeZone) : nm;
}

/** Vị trí tháng nhuận trong năm âm bắt đầu từ a11 (năm có 13 tháng). */
function getLeapMonthOffset(a11, timeZone) {
  const k = Math.floor((a11 - 2415021.076998695) / 29.530588853 + 0.5);
  let last = 0;
  let i = 1;
  let arc = getSunLongitude(getNewMoonDay(k + i, timeZone), timeZone);
  do {
    last = arc;
    i++;
    arc = getSunLongitude(getNewMoonDay(k + i, timeZone), timeZone);
  } while (arc !== last && i < 14);
  return i - 1;
}

/**
 * Đổi 1 ngày dương → âm.
 * @param {number} dd ngày (1-31), {number} mm tháng (1-12), {number} yy năm
 * @returns {{day:number, month:number, year:number, leap:boolean}}
 */
export function solarToLunar(dd, mm, yy, timeZone = TIMEZONE) {
  const dayNumber = jdFromDate(dd, mm, yy);
  const k = Math.floor((dayNumber - 2415021.076998695) / 29.530588853);

  let monthStart = getNewMoonDay(k + 1, timeZone);
  if (monthStart > dayNumber) monthStart = getNewMoonDay(k, timeZone);

  let a11 = getLunarMonth11(yy, timeZone);
  let b11 = a11;
  let lunarYear;
  if (a11 >= monthStart) {
    lunarYear = yy;
    a11 = getLunarMonth11(yy - 1, timeZone);
  } else {
    lunarYear = yy + 1;
    b11 = getLunarMonth11(yy + 1, timeZone);
  }

  const lunarDay = dayNumber - monthStart + 1;
  const diff = Math.floor((monthStart - a11) / 29);
  let leap = false;
  let lunarMonth = diff + 11;

  if (b11 - a11 > 365) {
    const leapMonthDiff = getLeapMonthOffset(a11, timeZone);
    if (diff >= leapMonthDiff) {
      lunarMonth = diff + 10;
      if (diff === leapMonthDiff) leap = true;
    }
  }
  if (lunarMonth > 12) lunarMonth -= 12;
  if (lunarMonth >= 11 && diff < 4) lunarYear -= 1;

  return { day: lunarDay, month: lunarMonth, year: lunarYear, leap };
}

/** Nhãn ngắn hiện trong ô lịch: mùng 1 thì kèm tháng, còn lại chỉ số ngày. */
export function lunarLabel(lunar) {
  return lunar.day === 1 ? `${lunar.day}/${lunar.month}` : String(lunar.day);
}

export { jdFromDate };

export const CAN = ['Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ', 'Canh', 'Tân', 'Nhâm', 'Quý'];
export const CHI = ['Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi', 'Thân', 'Dậu', 'Tuất', 'Hợi'];

export const ZODIAC_PERIODS = [
  { chiIndex: 0, name: 'Tý', range: '23-1', icon: '🐭', startHour: 23, endHour: 1 },
  { chiIndex: 1, name: 'Sửu', range: '1-3', icon: '🐮', startHour: 1, endHour: 3 },
  { chiIndex: 2, name: 'Dần', range: '3-5', icon: '🐯', startHour: 3, endHour: 5 },
  { chiIndex: 3, name: 'Mão', range: '5-7', icon: '🐱', startHour: 5, endHour: 7 },
  { chiIndex: 4, name: 'Thìn', range: '7-9', icon: '🐲', startHour: 7, endHour: 9 },
  { chiIndex: 5, name: 'Tỵ', range: '9-11', icon: '🐍', startHour: 9, endHour: 11 },
  { chiIndex: 6, name: 'Ngọ', range: '11-13', icon: '🐴', startHour: 11, endHour: 13 },
  { chiIndex: 7, name: 'Mùi', range: '13-15', icon: '🐐', startHour: 13, endHour: 15 },
  { chiIndex: 8, name: 'Thân', range: '15-17', icon: '🐵', startHour: 15, endHour: 17 },
  { chiIndex: 9, name: 'Dậu', range: '17-19', icon: '🐔', startHour: 17, endHour: 19 },
  { chiIndex: 10, name: 'Tuất', range: '19-21', icon: '🐶', startHour: 19, endHour: 21 },
  { chiIndex: 11, name: 'Hợi', range: '21-23', icon: '🐷', startHour: 21, endHour: 23 },
];

/**
 * Tính Can Chi năm âm lịch
 * @param {number} lunarYear
 * @returns {string} VD: "Bính Ngọ"
 */
export function getCanChiYear(lunarYear) {
  const can = CAN[(lunarYear + 6) % 10];
  const chi = CHI[(lunarYear + 8) % 12];
  return `${can} ${chi}`;
}

/**
 * Tính Can Chi tháng âm lịch theo Ngũ Hổ Độn
 * @param {number} lunarYear
 * @param {number} lunarMonth (1-12)
 * @returns {string} VD: "Bính Thân"
 */
export function getCanChiMonth(lunarYear, lunarMonth) {
  const canYearIndex = (lunarYear + 6) % 10;
  const startCanMonth1 = ((canYearIndex % 5) * 2 + 2) % 10;
  const canMonth = CAN[(startCanMonth1 + (lunarMonth - 1)) % 10];
  const chiMonth = CHI[(lunarMonth + 1) % 12];
  return `${canMonth} ${chiMonth}`;
}

/**
 * Tính Can Chi ngày theo số ngày Julian
 * @param {number} dd
 * @param {number} mm
 * @param {number} yy
 * @returns {{ can: string, chi: string, full: string, chiIndex: number }}
 */
export function getCanChiDay(dd, mm, yy) {
  const jd = jdFromDate(dd, mm, yy);
  const canIdx = (jd + 9) % 10;
  const chiIdx = (jd + 1) % 12;
  return {
    can: CAN[canIdx],
    chi: CHI[chiIdx],
    full: `${CAN[canIdx]} ${CHI[chiIdx]}`,
    chiIndex: chiIdx,
  };
}

/**
 * 6 nhóm giờ hoàng đạo theo Chi của ngày
 */
const ZODIAC_HOANG_DAO_MAP = {
  0: [0, 1, 3, 6, 8, 9],    // Ngày Tý: Tý, Sửu, Mão, Ngọ, Thân, Dậu
  6: [0, 1, 3, 6, 8, 9],    // Ngày Ngọ
  1: [2, 3, 5, 8, 10, 11],  // Ngày Sửu: Dần, Mão, Tỵ, Thân, Tuất, Hợi
  7: [2, 3, 5, 8, 10, 11],  // Ngày Mùi
  2: [0, 1, 4, 5, 7, 10],   // Ngày Dần: Tý, Sửu, Thìn, Tỵ, Mùi, Tuất
  8: [0, 1, 4, 5, 7, 10],   // Ngày Thân
  3: [0, 2, 3, 6, 7, 9],    // Ngày Mão: Tý, Dần, Mão, Ngọ, Mùi, Dậu
  9: [0, 2, 3, 6, 7, 9],    // Ngày Dậu
  4: [2, 4, 5, 8, 9, 11],   // Ngày Thìn: Dần, Thìn, Tỵ, Thân, Dậu, Hợi
  10: [2, 4, 5, 8, 9, 11],  // Ngày Tuất
  5: [1, 4, 6, 7, 10, 11],  // Ngày Tỵ: Sửu, Thìn, Ngọ, Mùi, Tuất, Hợi
  11: [1, 4, 6, 7, 10, 11], // Ngày Hợi
};

/**
 * Lấy 12 khung giờ kèm đánh dấu Hoàng Đạo / Hắc Đạo cho ngày cụ thể
 * @param {number} dd
 * @param {number} mm
 * @param {number} yy
 * @param {number} [currentHour] - Giờ hiện tại (0-23) để đánh dấu isNow
 */
export function getZodiacHours(dd, mm, yy, currentHour = null) {
  const { chiIndex } = getCanChiDay(dd, mm, yy);
  const hoangDaoIndices = new Set(ZODIAC_HOANG_DAO_MAP[chiIndex] || []);

  return ZODIAC_PERIODS.map((period) => {
    const isHoangDao = hoangDaoIndices.has(period.chiIndex);
    let isNow = false;
    if (currentHour !== null) {
      if (period.startHour === 23) {
        isNow = currentHour === 23 || currentHour === 0;
      } else {
        isNow = currentHour >= period.startHour && currentHour < period.endHour;
      }
    }

    return {
      ...period,
      isHoangDao,
      isNow,
    };
  });
}

/**
 * Lấy danh sách các sự kiện / ngày lễ sắp tới (dương lịch & âm lịch) kèm số ngày đếm ngược
 * @param {Date} [baseDate]
 * @param {Object} [holidays] - { solar: Record<string, string>, lunar: Record<string, string> }
 * @param {number} [maxDaysAhead=60]
 * @returns {Array<{ title: string, type: 'solar'|'lunar', targetDate: Date, dateStr: string, diffDays: number, countdownLabel: string, solarText: string, lunarText: string, dayOfWeek: string }>}
 */
export function getUpcomingEvents(
  baseDate = new Date(),
  holidays = { solar: {}, lunar: {}, international: {}, japan: {}, fun: {} },
  maxDaysAhead = 60,
  enabledTypes = { solar: true, lunar: true, international: true, japan: false, fun: true, custom: true },
  customEvents = []
) {
  const start = new Date(baseDate);
  start.setHours(0, 0, 0, 0);

  const events = [];
  const solarHolidays = holidays?.solar || {};
  const lunarHolidays = holidays?.lunar || {};
  const internationalHolidays = holidays?.international || {};
  const japanHolidays = holidays?.japan || {};
  const funHolidays = holidays?.fun || {};

  const isSolarOn = enabledTypes?.solar !== false;
  const isLunarOn = enabledTypes?.lunar !== false;
  const isInternationalOn = enabledTypes?.international !== false;
  const isJapanOn = Boolean(enabledTypes?.japan);
  const isFunOn = Boolean(enabledTypes?.fun);
  const isCustomOn = enabledTypes?.custom !== false;

  for (let offset = 0; offset <= maxDaysAhead; offset++) {
    const current = new Date(start);
    current.setDate(start.getDate() + offset);

    const dd = current.getDate();
    const mm = current.getMonth() + 1;
    const yy = current.getFullYear();
    const solarKey = `${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
    const dateStr = `${yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
    const countdownLabel = offset === 0 ? 'Hôm nay' : offset === 1 ? 'Còn 1 ngày' : `Còn ${offset} ngày`;
    const solarText = `${String(dd).padStart(2, '0')}/${String(mm).padStart(2, '0')}/${yy}`;
    const dayOfWeek = current.toLocaleDateString('vi-VN', { weekday: 'short' });

    let lunarCache = null;
    const getLunar = () => {
      if (!lunarCache) {
        lunarCache = solarToLunar(dd, mm, yy);
      }
      return lunarCache;
    };

    // 1. Kiểm tra lễ dương Việt Nam
    if (isSolarOn && solarHolidays[solarKey]) {
      const lunar = getLunar();
      const canChiYear = getCanChiYear(lunar.year);
      events.push({
        title: solarHolidays[solarKey],
        type: 'solar',
        category: 'vietnam',
        targetDate: current,
        dateStr,
        diffDays: offset,
        countdownLabel,
        solarText,
        lunarText: `${lunar.day}/${lunar.month}, ${canChiYear}`,
        dayOfWeek,
      });
    }

    // 2. Kiểm tra lễ âm lịch Việt Nam & Á Đông
    if (isLunarOn) {
      const lunar = getLunar();
      const lunarKey = `${String(lunar.month).padStart(2, '0')}-${String(lunar.day).padStart(2, '0')}`;
      if (lunarHolidays[lunarKey]) {
        const canChiYear = getCanChiYear(lunar.year);
        events.push({
          title: lunarHolidays[lunarKey],
          type: 'lunar',
          category: 'lunar',
          targetDate: current,
          dateStr,
          diffDays: offset,
          countdownLabel,
          solarText,
          lunarText: `${lunar.day}/${lunar.month}, ${canChiYear}`,
          dayOfWeek,
        });
      }
    }

    // 3. Kiểm tra lễ quốc tế (LHQ & Thế giới)
    if (isInternationalOn && internationalHolidays[solarKey]) {
      const lunar = getLunar();
      const canChiYear = getCanChiYear(lunar.year);
      events.push({
        title: internationalHolidays[solarKey],
        type: 'international',
        category: 'international',
        targetDate: current,
        dateStr,
        diffDays: offset,
        countdownLabel,
        solarText,
        lunarText: `${lunar.day}/${lunar.month}, ${canChiYear}`,
        dayOfWeek,
      });
    }

    // 4. Kiểm tra lễ Nhật Bản
    if (isJapanOn && japanHolidays[solarKey]) {
      const lunar = getLunar();
      const canChiYear = getCanChiYear(lunar.year);
      events.push({
        title: japanHolidays[solarKey],
        type: 'japan',
        category: 'japan',
        targetDate: current,
        dateStr,
        diffDays: offset,
        countdownLabel,
        solarText,
        lunarText: `${lunar.day}/${lunar.month}, ${canChiYear}`,
        dayOfWeek,
      });
    }

    // 4. Kiểm tra ngày đặc biệt & Dev
    if (isFunOn && funHolidays[solarKey]) {
      const lunar = getLunar();
      const canChiYear = getCanChiYear(lunar.year);
      events.push({
        title: funHolidays[solarKey],
        type: 'fun',
        category: 'fun',
        targetDate: current,
        dateStr,
        diffDays: offset,
        countdownLabel,
        solarText,
        lunarText: `${lunar.day}/${lunar.month}, ${canChiYear}`,
        dayOfWeek,
      });
    }

    // 5. Kiểm tra ngày kỷ niệm cá nhân (Custom Anniversaries)
    if (isCustomOn && Array.isArray(customEvents) && customEvents.length > 0) {
      const lunar = getLunar();
      for (const anniv of customEvents) {
        if (!anniv || !anniv.title) continue;
        let isMatch = false;
        if (anniv.calType === 'solar') {
          isMatch = Number(anniv.day) === dd && Number(anniv.month) === mm;
        } else if (anniv.calType === 'lunar') {
          isMatch = Number(anniv.day) === lunar.day && Number(anniv.month) === lunar.month;
        }
        if (isMatch) {
          const canChiYear = getCanChiYear(lunar.year);
          let extraNote = '';
          if (anniv.year && Number(anniv.year) > 0) {
            const passedYears = yy - Number(anniv.year);
            if (passedYears > 0) {
              extraNote = ` (${passedYears} năm)`;
            }
          }
          events.push({
            id: anniv.id,
            title: `${anniv.icon || '💖'} ${anniv.title}${extraNote}`,
            type: 'custom',
            category: 'custom',
            targetDate: current,
            dateStr,
            diffDays: offset,
            countdownLabel,
            solarText,
            lunarText: `${lunar.day}/${lunar.month}, ${canChiYear}`,
            dayOfWeek,
            isCustom: true,
          });
        }
      }
    }
  }

  events.sort((a, b) => a.diffDays - b.diffDays);
  return events;
}


