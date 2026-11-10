(function () {
  if (window.BodyKit) return;
  const vn = (v, d) => v.toFixed(d).replace('.', ',');
  const nf = n => Math.round(n).toLocaleString('de-DE');
  const f1 = v => Math.round(v * 10) / 10;
  const mmss = s => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  const dash = (r, p) => { const C = 2 * Math.PI * r; return f1(Math.max(0, Math.min(1, p)) * C) + ' ' + f1(C + 2); };
  const RR = [20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 62, 64, 70, 72, 80, 84, 90, 96, 100, 110, 120, 130];
  const rings = p => { const o = { p: Math.round(p * 100) }; RR.forEach(r => { o['r' + r] = dash(r, p); }); return o; };

  const PAGES = [
    { k: 'home', n: 'Tổng quan', ic: 'house-simple', no: '01' },
    { k: 'plan', n: 'Lộ trình', ic: 'path', no: '02' },
    { k: 'prog', n: 'Tiến bộ', ic: 'chart-line-up', no: '03' },
    { k: 'body', n: 'Cơ thể', ic: 'scales', no: '04' },
    { k: 'food', n: 'Dinh dưỡng', ic: 'bowl-food', no: '05' },
    { k: 'map', n: 'Bản đồ cơ', ic: 'person-simple', no: '06' },
    { k: 'lib', n: 'Thư viện bài', ic: 'books', no: '07' }
  ];

  const EXN = {
    'Push-up': ['Chống đẩy tiêu chuẩn', 'Ngực', 'rep'],
    'Pike Push-up': ['Chống đẩy chữ V', 'Vai', 'rep'],
    'Diamond Push-up': ['Hít đất kim cương', 'Tay sau', 'rep'],
    'Plank': ['Tấm ván tĩnh', 'Bụng', 's'],
    'Assisted Pull-up': ['Kéo xà hỗ trợ', 'Xô', 'rep'],
    'Tempo Squat': ['Squat chậm 3-1-1', 'Đùi trước', 'rep'],
    'Glute Bridge': ['Cầu mông', 'Mông', 'rep'],
    'Dead Bug': ['Bọ chết', 'Bụng', 'rep'],
    'Dumbbell Floor Press': ['Đẩy tạ đơn sàn', 'Ngực', 'rep'],
    'Hollow Hold': ['Giữ thân thuyền', 'Bụng', 's'],
    'Inverted Row': ['Kéo người dưới bàn', 'Lưng', 'rep'],
    'Bird Dog': ['Chó chim', 'Lưng dưới', 'rep'],
    'Side Plank': ['Plank nghiêng', 'Liên sườn', 's'],
    'Lateral Raise': ['Dang vai tạ đơn', 'Vai', 'rep'],
    'Biceps Curl': ['Cuốn tạ tay trước', 'Tay trước', 'rep']
  };
  const PX = {
    A1: [['Push-up', 3, 10], ['Pike Push-up', 3, 8], ['Diamond Push-up', 3, 8], ['Plank', 3, 30]],
    B1: [['Assisted Pull-up', 3, 6], ['Tempo Squat', 3, 12], ['Glute Bridge', 3, 15], ['Dead Bug', 3, 10]],
    A2: [['Push-up', 3, 10], ['Dumbbell Floor Press', 3, 12, 5], ['Plank', 3, 30], ['Hollow Hold', 2, 20]],
    B2: [['Inverted Row', 3, 8], ['Glute Bridge', 3, 15], ['Bird Dog', 3, 10], ['Side Plank', 2, 20]],
    A3: [['Lateral Raise', 2, 12, 3], ['Biceps Curl', 2, 12, 5], ['Push-up', 2, 10]]
  };
  const DAYS = [
    { k: 1, s: 'T2', d: '12/10', n: '12', full: 'Thứ Hai', type: 'A', focus: 'Ngực, Vai & Tay sau', ex: 'A1', done: '21 phút' },
    { k: 2, s: 'T3', d: '13/10', n: '13', full: 'Thứ Ba', type: 'B', focus: 'Lưng xô & Chân', ex: 'B1', today: 1 },
    { k: 3, s: 'T4', d: '14/10', n: '14', full: 'Thứ Tư', type: 'A', focus: 'Ngực & Core', ex: 'A2' },
    { k: 4, s: 'T5', d: '15/10', n: '15', full: 'Thứ Năm', type: 'B', focus: 'Dưỡng lưng & Mông', ex: 'B2' },
    { k: 5, s: 'T6', d: '16/10', n: '16', full: 'Thứ Sáu', type: 'A', focus: 'Giữ tay & Vai', ex: 'A3' },
    { k: 6, s: 'T7', d: '17/10', n: '17', full: 'Thứ Bảy', rest: 'Nghỉ · Cầu lông & Yosakoi', meta: 'Vận động ngoài lịch' },
    { k: 7, s: 'CN', d: '18/10', n: '18', full: 'Chủ Nhật', check: 1, rest: 'Check-in tuần', meta: 'Cân sáng, đo vòng eo' }
  ];
  const MINE = [{ n: 'Lịch A/B 5 ngày (30p sáng)', m: '5 buổi/tuần · tuần 2/4', on: true }, { n: 'Toàn thân 3 buổi', m: 'Đã xong · 6 tuần · tháng 9', on: false }];
  const TPLS = [{ n: 'Giảm mỡ giữ cơ', m: '8 tuần · 4 buổi/tuần', lv: 'Cơ bản' }, { n: 'Nhập môn Calisthenics', m: '6 tuần · 3 buổi/tuần', lv: 'Cơ bản' }, { n: 'Tăng cơ tạ đơn tại nhà', m: '8 tuần · 4 buổi/tuần', lv: 'Trung cấp' }];
  const est = L => { let t = 0, n = 0; L.forEach(([en, sets, r]) => { const u = EXN[en][2]; for (let i = 0; i < sets; i++) { t += u === 's' ? r : r * 3; n++; } }); return Math.round((t + Math.max(0, n - 1) * 90) / 60); };
  const exList = key => PX[key].map(([en, sets, t, kg], i) => { const m = EXN[en]; return { i, no: String(i + 1).padStart(2, '0'), n: m[0], en, grp: m[1], sets, t, u: m[2], ul: m[2] === 's' ? 'giây' : 'rep', sx: sets + ' × ' + t + ' ' + (m[2] === 's' ? 'giây' : 'rep'), kg: kg ? kg + ' kg' : '', hasKg: !!kg, dots: Array.from({ length: sets }, (_, j) => ({ j })) }; });

  const PEX = [
    { k: 'plank', en: 'Plank', vi: 'Tấm ván tĩnh', u: 's', tg: 40 },
    { k: 'push', en: 'Push-up', vi: 'Chống đẩy tiêu chuẩn', u: 'rep', tg: 12 },
    { k: 'diamond', en: 'Diamond Push-up', vi: 'Hít đất kim cương', u: 'rep', tg: 8 },
    { k: 'pike', en: 'Pike Push-up', vi: 'Chống đẩy chữ V', u: 'rep', tg: 8 },
    { k: 'squat', en: 'Slow Squat', vi: 'Squat chậm', u: 'rep', tg: 12 },
    { k: 'bridge', en: 'Glute Bridge', vi: 'Cầu mông', u: 'rep', tg: 15 }
  ];
  const PS = {
    plank: [['23/9', [25, 24, 22]], ['28/9', [28, 27, 25]], ['30/9', [30, 28, 28]], ['2/10', [32, 30, 30]], ['5/10', [33, 32, 30]], ['7/10', [30, 32, 35]], ['10/10', [46, 47, 48]], ['12/10', [40, 40, 40]]],
    push: [['23/9', [8, 8, 7]], ['28/9', [9, 8, 8]], ['30/9', [9, 9, 8]], ['2/10', [10, 9, 9]], ['5/10', [10, 10, 9]], ['10/10', [11, 10, 10]], ['12/10', [12, 12, 13]]],
    diamond: [['28/9', [4, 4, 3]], ['2/10', [5, 5, 4]], ['5/10', [5, 5, 5]], ['10/10', [6, 6, 5]], ['12/10', [8, 8, 7]]],
    pike: [['30/9', [5, 5, 5]], ['5/10', [6, 6, 6]], ['7/10', [7, 6, 6]], ['12/10', [8, 8, 8]]],
    squat: [['23/9', [10, 10, 10]], ['30/9', [12, 11, 10]], ['6/10', [12, 12, 11]], ['8/10', [12, 12, 12]]],
    bridge: [['23/9', [12, 12, 12]], ['30/9', [14, 13, 13]], ['6/10', [15, 14, 14]], ['8/10', [15, 15, 14]]]
  };
  const CAL = { 2: 'T', 5: 'A', 6: 'B', 7: 'A', 8: 'B', 10: 'T', 12: 'A' };
  const CALP = { 13: 'B', 14: 'A', 15: 'B', 16: 'A' };

  const SERIES = {
    '7d': { dates: ['7/10', '8/10', '11/10'], w: [64.90, 64.80, 64.65], fat: [15.2, 15.1, 15.0], mus: [29.4, 29.6, 29.7] },
    '30d': { dates: ['12/9', '17/9', '22/9', '27/9', '2/10', '7/10', '8/10', '11/10'], w: [65.05, 65.30, 65.15, 64.95, 65.05, 64.90, 64.80, 64.65], fat: [14.8, 15.0, 14.9, 15.2, 15.1, 15.2, 15.1, 15.0], mus: [28.8, 29.0, 29.1, 29.2, 29.3, 29.4, 29.6, 29.7] },
    '90d': { dates: ['13/7', '20/7', '27/7', '3/8', '10/8', '17/8', '24/8', '31/8', '7/9', '14/9', '21/9', '28/9', '11/10'], w: [66.2, 66.0, 66.1, 65.8, 65.7, 65.75, 65.5, 65.4, 65.2, 65.3, 65.1, 64.95, 64.65], fat: [15.8, 15.7, 15.8, 15.6, 15.5, 15.5, 15.3, 15.4, 15.2, 15.0, 15.1, 15.2, 15.0], mus: [28.5, 28.5, 28.6, 28.7, 28.7, 28.9, 28.9, 29.0, 29.1, 29.0, 29.2, 29.3, 29.7] },
    '365d': { dates: ['11/25', '12/25', '1/26', '2/26', '3/26', '4/26', '5/26', '6/26', '7/26', '8/26', '9/26', '10/26'], w: [67.8, 67.5, 67.6, 67.1, 66.9, 66.6, 66.7, 66.4, 66.1, 65.6, 65.1, 64.65], fat: [17.2, 17.0, 17.1, 16.7, 16.5, 16.3, 16.2, 16.0, 15.8, 15.4, 15.1, 15.0], mus: [27.6, 27.7, 27.7, 27.9, 28.0, 28.2, 28.3, 28.4, 28.5, 28.9, 29.1, 29.7] }
  };
  const RANGES = [{ k: '7d', l: 'Tuần', s: '7 ngày' }, { k: '30d', l: 'Tháng', s: '30 ngày' }, { k: '90d', l: '3 tháng', s: '90 ngày' }, { k: '365d', l: 'Năm', s: '12 tháng' }];
  const TM = [{ k: 'w', l: 'Cân nặng', u: 'kg', d: 2, good: 1, ck: 'acc' }, { k: 'fat', l: 'Tỷ lệ mỡ', u: '%', d: 1, good: -1, ck: 'a3' }, { k: 'mus', l: 'Cơ xương', u: 'kg', d: 1, good: 1, ck: 'good' }];
  const MET = [
    { l: 'Tỷ lệ mỡ', v: '15,0', u: '%', src: 0, d: '−0,4', dg: 1, st: 'Trong chuẩn', rg: '10–20 %', sc: [5, 10, 20, 30], x: 15 },
    { l: 'Cơ xương', v: '29,7', u: 'kg', src: 0, d: '+0,9', dg: 1, st: 'Cao hơn lần trước', rg: 'kg cơ', x: null },
    { l: 'Mỡ nội tạng', v: '5', u: 'mức', src: 0, d: '±0', dg: 0, st: 'Trong chuẩn', rg: 'chuẩn 1–9', sc: [1, 1.01, 9, 15], x: 5 },
    { l: 'Tỷ lệ nước', v: '59,4', u: '%', src: 0, d: '+1,8', dg: 1, st: 'Trong chuẩn', rg: '50–65 %', sc: [40, 50, 65, 75], x: 59.4 },
    { l: 'Trao đổi chất', v: '1.574', u: 'kcal', src: 1, d: '', st: 'Mifflin-St Jeor', rg: 'kcal/ngày', x: null, neutral: 1 },
    { l: 'Khối không mỡ', v: '55,0', u: 'kg', src: 1, d: '+0,3', dg: 1, st: 'Tính từ số đo', rg: 'kg', x: null, neutral: 1 }
  ];
  const COMP = [['Nước', 38.40, 'a2'], ['Đạm & khác', 13.65, 'a3'], ['Mỡ', 9.70, 'bad'], ['Khoáng xương', 2.90, 'good']];

  const MEALS = [
    { n: 'Bữa sáng', ic: 'coffee', t: '7:45', items: [['Bánh mì 2 trứng ốp', '1 ổ', 320, 18, 42, 12], ['Sữa chua Hy Lạp', '170 g', 100, 14, 6, 4]] },
    { n: 'Bữa trưa', ic: 'bowl-food', t: '12:10', items: [['Cơm trắng', '1 bát', 260, 5, 61, 1], ['Ức gà luộc', '150 g', 250, 46, 0, 6], ['Rau muống xào tỏi', '1 đĩa nhỏ', 80, 4, 6, 5], ['Canh bí', '1 bát', 50, 3, 8, 1]] },
    { n: 'Bữa tối', ic: 'fish', t: '19:20', items: [['Cá hồi áp chảo', '120 g', 280, 30, 0, 19], ['Khoai lang luộc', '150 g', 130, 2, 30, 0], ['Salad dầu giấm', '1 đĩa', 150, 2, 8, 9]] },
    { n: 'Ăn nhẹ', ic: 'cookie', t: '21:00', items: [['Chuối', '1 quả', 90, 1, 23, 0], ['Sữa chua uống', '1 hộp', 70, 3, 12, 1]] }
  ];
  const FWEEK = [['T4', 2010, 1], ['T5', 2120, 1], ['T6', 1940, 0], ['T7', 2230, 1], ['CN', 1890, 0], ['T2', 1925, 1], ['T3', 1780, 0]];
  const KT = { kcal: 2050, p: 130, c: 240, f: 65, water: 8 };

  const MUS = [
    ['chest', 'Ngực', 'Chest', 'low', 35], ['shoulders', 'Vai', 'Deltoids', 'low', 42], ['triceps', 'Tay sau', 'Triceps', 'low', 40],
    ['quads', 'Đùi trước', 'Quadriceps', 'mid', 72], ['glutes', 'Mông', 'Glutes', 'mid', 78], ['hamstrings', 'Đùi sau', 'Hamstrings', 'mid', 70], ['calves', 'Bắp chân', 'Calves', 'mid', 85], ['lowerback', 'Lưng dưới', 'Lower back', 'mid', 80],
    ['lats', 'Xô', 'Lats', 'ready', 100], ['biceps', 'Tay trước', 'Biceps', 'ready', 100], ['abs', 'Bụng', 'Abs', 'ready', 100], ['obliques', 'Liên sườn', 'Obliques', 'ready', 100], ['traps', 'Cầu vai', 'Traps', 'ready', 100], ['forearms', 'Cẳng tay', 'Forearms', 'ready', 100]
  ].map(([id, n, en, rec, pct]) => ({ id, n, en, rec, pct, last: rec === 'low' ? '12/10 · Buổi A' : rec === 'mid' ? '10/10 · Buổi tự do' : '8/10 · Buổi B', eta: rec === 'low' ? 'Hồi đủ khoảng 21:00 ngày 14/10' : rec === 'mid' ? 'Tập nhẹ được, tránh tải nặng' : 'Sẵn sàng cho bài nặng' }));
  const MREG = { chest: 'chest', shoulders: 'shoulders', triceps: 'biceps', biceps: 'biceps', forearms: 'biceps', lats: 'lats', traps: 'lats', lowerback: 'lats', quads: 'quads', calves: 'quads', hamstrings: 'glutes', glutes: 'glutes', abs: 'abs', obliques: 'abs' };
  const TODAYM = ['lats', 'quads', 'glutes', 'abs'];
  const RECL = { low: 'Cần nghỉ', mid: 'Đang hồi', ready: 'Sẵn sàng' };

  const REG = [['all', 'Tất cả'], ['chest', 'Ngực'], ['shoulders', 'Vai'], ['lats', 'Lưng & Xô'], ['biceps', 'Tay'], ['quads', 'Chân'], ['glutes', 'Mông'], ['abs', 'Bụng']];
  const REGN = Object.fromEntries(REG);
  const EQL = { bw: 'Không dụng cụ', db: 'Tạ đơn', bar: 'Xà & dây' };
  const LV = ['', 'Cơ bản', 'Trung bình', 'Nâng cao'];
  const LIB = [
    { k: 'incline', a: 'Chống đẩy kê cao tay', b: 'Incline Push-up', r: 'chest', eq: 'bw', lv: 1, sets: '3 × 15 rep', mus: [['Ngực', 100, 'Chính'], ['Vai trước', 50, 'Phụ'], ['Tay sau', 45, 'Phụ']], steps: ['Đặt hai tay lên ghế hoặc bậc cao ngang hông, rộng hơn vai một chút.', 'Lùi chân để thân thẳng từ đầu đến gót, siết bụng.', 'Hạ ngực chạm mép ghế rồi đẩy về vị trí đầu.'], tip: 'Để hông chùng xuống khi mỏi, làm mất đường thẳng thân người.' },
    { k: 'knee', a: 'Chống đẩy quỳ gối', b: 'Knee Push-up', r: 'chest', eq: 'bw', lv: 1, warn: 'khớp gối khi quỳ', sets: '3 × 15 rep', mus: [['Ngực', 100, 'Chính'], ['Vai trước', 50, 'Phụ'], ['Tay sau', 45, 'Phụ']], steps: ['Quỳ gối trên thảm, hai tay đặt rộng hơn vai.', 'Giữ thân thẳng từ đầu tới gối, không chổng mông.', 'Hạ ngực gần sàn, khuỷu khép 45°, rồi đẩy lên.'], tip: 'Chổng mông cao khiến bài tập dễ đi nhưng ngực gần như không làm việc.' },
    { k: 'push', a: 'Push-up', b: 'Chống đẩy tiêu chuẩn', r: 'chest', eq: 'bw', lv: 1, warn: 'cổ tay', sets: '3 × 20 rep', mus: [['Ngực', 100, 'Chính'], ['Vai trước', 60, 'Phụ'], ['Tay sau', 55, 'Phụ'], ['Bụng', 30, 'Giữ thân']], steps: ['Đặt hai tay rộng hơn vai một chút, ngón tay hướng về trước, hai chân duỗi thẳng.', 'Siết bụng và mông để thân người thành một đường thẳng từ đầu đến gót.', 'Gập khuỷu hạ người tới khi ngực cách sàn khoảng một nắm tay, khuỷu khép góc 45° so với thân.', 'Đẩy lòng bàn tay xuống sàn để về vị trí đầu, duỗi tay nhưng không khóa cứng khớp khuỷu.'], tip: 'Võng lưng dưới và để hông chạm sàn trước ngực, làm mất căng ở ngực và dồn áp lực lên thắt lưng.' },
    { k: 'decline', a: 'Chống đẩy kê cao chân', b: 'Decline Push-up', r: 'chest', eq: 'bw', lv: 3, warn: 'cổ tay', sets: '3 × 10 rep', mus: [['Ngực trên', 100, 'Chính'], ['Vai trước', 70, 'Phụ'], ['Tay sau', 50, 'Phụ']], steps: ['Đặt mũi chân lên ghế, hai tay chống sàn rộng hơn vai.', 'Siết bụng giữ hông ngang vai, không để võng lưng.', 'Hạ người tới khi trán gần sàn rồi đẩy mạnh lên.'], tip: 'Đặt chân quá cao làm tải dồn lên vai trước thay vì ngực trên.' },
    { k: 'dips', a: 'Xà kép chúi ngực', b: 'Chest Dips', r: 'chest', eq: 'bar', lv: 3, warn: 'khớp vai trước', sets: '3 × 8 rep', mus: [['Ngực dưới', 100, 'Chính'], ['Tay sau', 70, 'Phụ'], ['Vai trước', 50, 'Phụ']], steps: ['Chống thẳng tay trên xà kép, nghiêng thân về trước khoảng 30°.', 'Hạ người tới khi vai ngang khuỷu tay.', 'Đẩy lên bằng lực ngực, không nhún vai.'], tip: 'Hạ quá sâu khi vai chưa đủ linh hoạt gây căng khớp vai trước.' },
    { k: 'floor', a: 'Dumbbell Floor Press', b: 'Đẩy tạ đơn sàn', r: 'chest', eq: 'db', lv: 1, warn: 'khớp khuỷu', sets: '3 × 12 rep', mus: [['Ngực', 100, 'Chính'], ['Tay sau', 60, 'Phụ']], steps: ['Nằm ngửa trên sàn, gối co, mỗi tay một tạ đơn ngang ngực.', 'Đẩy tạ thẳng lên trên ngực, khép nhẹ khuỷu.', 'Hạ chậm tới khi bắp tay chạm sàn rồi đẩy lên.'], tip: 'Thả khuỷu đập xuống sàn thay vì hạ có kiểm soát.' },
    { k: 'bench', a: 'Đẩy tạ đơn ghế phẳng', b: 'Dumbbell Bench Press', r: 'chest', eq: 'db', lv: 2, warn: 'viêm chóp xoay vai', sets: '3 × 10 rep', mus: [['Ngực', 100, 'Chính'], ['Vai trước', 55, 'Phụ'], ['Tay sau', 50, 'Phụ']], steps: ['Nằm trên ghế phẳng, bàn chân đặt chắc trên sàn, tạ ngang ngực.', 'Đẩy tạ lên, hai tạ chụm nhẹ ở đỉnh.', 'Hạ chậm 2 giây tới khi tạ ngang ngực.'], tip: 'Bung khuỷu 90° khiến khớp vai chịu lực xoắn.' },
    { k: 'lateral', a: 'Lateral Raise', b: 'Dang vai tạ đơn', r: 'shoulders', eq: 'db', lv: 1, sets: '3 × 15 rep', mus: [['Vai giữa', 100, 'Chính'], ['Cầu vai', 30, 'Phụ']], steps: ['Đứng thẳng, mỗi tay một tạ nhẹ, khuỷu hơi cong.', 'Dang tay sang ngang tới khi ngang vai.', 'Hạ chậm, không vung người lấy đà.'], tip: 'Nhún vai khi nâng làm cơ cầu vai làm thay cơ vai giữa.' },
    { k: 'pike', a: 'Pike Push-up', b: 'Chống đẩy chữ V', r: 'shoulders', eq: 'bw', lv: 2, warn: 'cổ tay', sets: '3 × 8 rep', mus: [['Vai trước', 100, 'Chính'], ['Tay sau', 60, 'Phụ'], ['Ngực trên', 35, 'Phụ']], steps: ['Chống tay và chân, đẩy hông cao tạo hình chữ V ngược.', 'Gập khuỷu hạ đỉnh đầu về phía sàn giữa hai tay.', 'Đẩy lên tới khi tay duỗi thẳng.'], tip: 'Hạ đầu ra trước tay thay vì giữa hai tay, làm mất góc đẩy vai.' },
    { k: 'row', a: 'Dumbbell Row', b: 'Chèo tạ đơn', r: 'lats', eq: 'db', lv: 1, warn: 'lưng dưới', sets: '3 × 12 rep', mus: [['Xô', 100, 'Chính'], ['Lưng giữa', 70, 'Phụ'], ['Tay trước', 45, 'Phụ']], steps: ['Một tay và một gối tì lên ghế, lưng thẳng song song sàn.', 'Kéo tạ về phía hông, khép khuỷu sát thân.', 'Hạ tạ chậm, duỗi hết tay.'], tip: 'Xoay thân để kéo tạ, dồn lực lên lưng dưới.' },
    { k: 'pullup', a: 'Kéo xà hỗ trợ', b: 'Assisted Pull-up', r: 'lats', eq: 'bar', lv: 2, sets: '3 × 6 rep', mus: [['Xô', 100, 'Chính'], ['Tay trước', 60, 'Phụ'], ['Lưng giữa', 50, 'Phụ']], steps: ['Bám xà rộng hơn vai, đặt chân lên dây kháng lực.', 'Kéo ngực lên về phía xà, ép bả vai xuống.', 'Hạ người chậm tới khi tay duỗi.'], tip: 'Đung đưa người lấy đà thay vì kéo bằng xô.' },
    { k: 'diamond', a: 'Diamond Push-up', b: 'Hít đất kim cương', r: 'biceps', eq: 'bw', lv: 3, warn: 'cổ tay', sets: '3 × 8 rep', mus: [['Tay sau', 100, 'Chính'], ['Ngực', 60, 'Phụ']], steps: ['Đặt hai tay chụm dưới ngực, ngón cái và trỏ tạo hình kim cương.', 'Giữ khuỷu sát thân khi hạ người.', 'Hạ ngực chạm mu bàn tay rồi đẩy lên.'], tip: 'Bung khuỷu sang hai bên làm mất tác động lên tay sau.' },
    { k: 'goblet', a: 'Goblet Squat', b: 'Squat ôm tạ', r: 'quads', eq: 'db', lv: 1, warn: 'đầu gối', sets: '3 × 12 rep', mus: [['Đùi trước', 100, 'Chính'], ['Mông', 60, 'Phụ']], steps: ['Ôm một tạ đơn sát ngực, chân rộng bằng vai.', 'Đẩy hông ra sau, hạ người tới khi đùi song song sàn.', 'Đạp gót đứng dậy, giữ ngực mở.'], tip: 'Gối đổ vào trong khi đứng dậy.' },
    { k: 'bridge', a: 'Glute Bridge', b: 'Cầu mông', r: 'glutes', eq: 'bw', lv: 1, sets: '3 × 15 rep', mus: [['Mông', 100, 'Chính'], ['Đùi sau', 50, 'Phụ']], steps: ['Nằm ngửa, co gối, bàn chân đặt sát mông.', 'Đạp gót nâng hông tới khi thân thẳng từ vai tới gối.', 'Siết mông 1 giây ở đỉnh rồi hạ chậm.'], tip: 'Ưỡn lưng dưới thay vì nâng bằng mông.' },
    { k: 'plank', a: 'Plank', b: 'Tấm ván tĩnh', r: 'abs', eq: 'bw', lv: 1, warn: 'lưng dưới', sets: '3 × 40 giây', mus: [['Bụng', 100, 'Chính'], ['Vai', 35, 'Giữ thân']], steps: ['Chống cẳng tay dưới vai, duỗi thẳng chân.', 'Siết bụng, mông, giữ thân thẳng từ đầu tới gót.', 'Giữ nhịp thở đều trong suốt thời gian giữ.'], tip: 'Để hông võng xuống, dồn áp lực lên lưng dưới.' }
  ];

  const smooth = P => {
    let d = `M${f1(P[0][0])} ${f1(P[0][1])}`;
    for (let i = 0; i < P.length - 1; i++) {
      const p0 = P[i - 1] || P[i], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2] || p2;
      d += `C${f1(p1[0] + (p2[0] - p0[0]) / 6)} ${f1(p1[1] + (p2[1] - p0[1]) / 6)} ${f1(p2[0] - (p3[0] - p1[0]) / 6)} ${f1(p2[1] - (p3[1] - p1[1]) / 6)} ${f1(p2[0])} ${f1(p2[1])}`;
    }
    return d;
  };
  const spark = (vals, W, H, pad) => {
    pad = pad || 4;
    const mn = Math.min(...vals), mx = Math.max(...vals), sp = (mx - mn) || 1;
    const P = vals.map((v, i) => [pad + i / (vals.length - 1) * (W - pad * 2), pad + (1 - (v - mn) / sp) * (H - pad * 2)]);
    const line = smooth(P);
    const L = P[P.length - 1];
    return { vb: `0 0 ${W} ${H}`, W, H, line, area: line + `L${f1(L[0])} ${H}L${f1(P[0][0])} ${H}Z`, lx: f1(L[0]), ly: f1(L[1]) };
  };
  const trend = (range, tmk, W, H, c) => {
    const S = SERIES[range], tm = TM.find(t => t.k === tmk), vals = S[tm.k];
    const padL = 4, padR = 46, padT = 40, padB = 26;
    const pw = W - padL - padR, ph = H - padT - padB, base = padT + ph;
    let mn = Math.min(...vals), mx = Math.max(...vals); const sp = Math.max(mx - mn, tm.k === 'w' ? .6 : .4);
    mn -= sp * .35; mx += sp * .25;
    const x = i => padL + (vals.length === 1 ? pw / 2 : i / (vals.length - 1) * pw), y = v => padT + (1 - (v - mn) / (mx - mn)) * ph;
    const P = vals.map((v, i) => [x(i), y(v)]);
    const line = smooth(P);
    const area = line + `L${f1(P[P.length - 1][0])} ${base}L${f1(P[0][0])} ${base}Z`;
    const grid = [], labels = [];
    const ly = y(vals[vals.length - 1]);
    for (let k = 0; k <= 3; k++) { const v = mn + (mx - mn) * (k / 3), yy = f1(y(v)); grid.push({ x1: padL, x2: padL + pw, y: yy }); if (Math.abs(yy - (ly - 24)) > 16) labels.push({ x: W - padR + 8, y: yy, t: vn(v, 1), tf: 'translate(0,-50%)' }); }
    const minGap = 72, nL = vals.length - 1, keep = [0];
    for (let i = 1; i < nL; i++) if (x(i) - x(keep[keep.length - 1]) >= minGap && x(nL) - x(i) >= minGap) keep.push(i);
    if (nL > 0) keep.push(nL);
    keep.forEach(i => labels.push({ x: f1(x(i)), y: base + 10, t: S.dates[i], tf: i === 0 ? 'translate(0,0)' : i === nL ? 'translate(-100%,0)' : 'translate(-50%,0)' }));
    const last = P[P.length - 1], n = vals.length - 1;
    const pts = P.map((p, i) => ({ x: f1(p[0]), y: f1(p[1]), r: i === n ? 5.5 : 3.2 }));
    const w = S.w, dw = w[w.length - 1] - w[0];
    return { W, H, vb: `0 0 ${W} ${H}`, c, line, area, grid, labels, pts, base, last: { x: f1(last[0]), y: f1(last[1]), t: vn(vals[n], tm.d) + ' ' + tm.u }, sub: RANGES.find(r => r.k === range).s, hasGoal: tm.k === 'w', goal: '+' + vn(70 - w[w.length - 1], 2) + ' kg', goalTxt: Math.abs(dw) < 1e-9 ? 'Kỳ này cân nặng không đổi.' : dw < 0 ? `Kỳ này giảm ${vn(-dw, 2)} kg, ngược hướng mục tiêu.` : `Kỳ này tăng ${vn(dw, 2)} kg, đúng hướng mục tiêu.` };
  };
  const gauge = T => {
    const cx = 150, cy = 158, Rr = 124, lo = 15, hi = 32, Pi = Math.PI;
    const ang = v => Pi - (Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo) * Pi;
    const pt = (a, r) => { r = r || Rr; return [f1(cx + r * Math.cos(a)), f1(cy - r * Math.sin(a))]; };
    const arc = (a1, a2) => { const p1 = pt(a1), p2 = pt(a2); return `M${p1[0]} ${p1[1]}A${Rr} ${Rr} 0 0 1 ${p2[0]} ${p2[1]}`; };
    const g = 0.014;
    const SEG = [[15, 18.5, T.a2], [18.5, 23, T.good], [23, 25, T.a3], [25, 32, T.bad]];
    const segs = SEG.map(([a, b, c], i) => ({ c, d: arc(ang(a) - (i ? g : 0), ang(b) + (i < 3 ? g : 0)) }));
    const m = pt(ang(22.4));
    const ticks = [[18.5, '18,5'], [23, '23'], [25, '25']].map(([v, t]) => { const p = pt(ang(v), Rr + 22); return { x: p[0], y: p[1], t }; });
    ticks.push({ x: f1(cx - Rr), y: cy + 16, t: '15' }, { x: f1(cx + Rr), y: cy + 16, t: '32' });
    return { track: arc(Pi, 0), segs, mx: m[0], my: m[1], mc: T.good, ticks, legend: [['Thiếu cân', '<18,5', T.a2], ['Bình thường', '18,5–22,9', T.good], ['Thừa cân', '23–24,9', T.a3], ['Béo phì', '≥25', T.bad]].map(([l, r, c]) => ({ l, r, c })) };
  };

  const mealTot = () => { const o = { k: 0, p: 0, c: 0, f: 0 }; MEALS.forEach(m => m.items.forEach(it => { o.k += it[2]; o.p += it[3]; o.c += it[4]; o.f += it[5]; })); return o; };

  const K = { PAGES, DAYS, LIB, MUS, vn, nf, f1, mmss, dash, rings, spark, smooth };
  K.init = () => ({ page: 'home', day: 2, ex: 'plank', range: '30d', tm: 'w', reg: 'all', sel: 'push', mus: 'lats', water: 6, open: { 1: true }, wk: null, trained: false });
  K.tick = fs => {
    const w = fs.wk;
    if (!w || w.done) return null;
    return Object.assign({}, fs, { wk: Object.assign({}, w, { t: (w.t || 0) + 1, rest: Math.max(0, (w.rest || 0) - 1) }) });
  };
  K.isMuscle = id => MUS.some(m => m.id === id);

  K.view = function (fs, T, upd, O) {
    O = O || {};
    const P = on => { const s = on ? T.on : T.off, r = on ? (T.rowOn || T.on) : (T.rowOff || T.off); return { fg: s.fg, bg: s.bg, bd: s.bd, sh: s.sh, fw: s.fw, tf: s.tf || 'none', rbg: r.bg, rbd: r.bd, rsh: r.sh, rtf: r.tf || 'none' }; };
    const TC = t => t === 'A' ? T.acc : t === 'B' ? T.a2 : T.a3;
    const RC = r => r === 'ready' ? T.good : r === 'mid' ? T.a3 : T.bad;
    const NV = on => { const s = on ? (T.navOn || T.on) : (T.navOff || T.off); return { fg: s.fg, bg: s.bg, bd: s.bd, sh: s.sh, fw: s.fw, tf: s.tf || 'none' }; };
    const nav = PAGES.map(p => { const on = p.k === fs.page; return Object.assign({}, p, NV(on), { on, icc: (on ? 'ph-fill ph-' : 'ph ph-') + p.ic, go: () => upd({ page: p.k, wk: null }) }); });
    const pg = {}; PAGES.forEach(p => { pg[p.k] = p.k === fs.page; });
    const page = PAGES.find(p => p.k === fs.page);
    const TD = DAYS.find(d => d.today), TL = exList(TD.ex);
    const trained = !!fs.trained;
    const start = () => { if (!trained) upd({ wk: { i: 0, s: 0, rest: 0, restT: 0, r: null, log: [], t: 0, done: false } }); };
    const dayItem = d => {
      const done = !!d.done || (!!d.today && trained);
      const st = done ? 'done' : d.today ? 'today' : d.check ? 'check' : d.rest ? 'rest' : 'plan';
      const c = d.type ? TC(d.type) : d.check ? T.a3 : T.ink3;
      return { k: d.k, s: d.s, n: d.n, d: d.d, full: d.full, focus: d.focus || d.rest, type: d.type || '', typeL: d.type ? 'Buổi ' + d.type : d.check ? 'Check-in' : 'Nghỉ', c, soft: c + '24', st, isDone: done, isToday: !!d.today, isRest: !d.ex, isPlan: st === 'plan', notDone: !done, lbl: { done: 'Đã tập', today: 'Hôm nay', rest: 'Nghỉ', check: 'Check-in', plan: 'Sắp tới' }[st], stC: done ? T.good : d.today ? T.acc : st === 'check' ? T.a3 : T.ink3, mins: d.ex ? est(PX[d.ex]) + ' phút' : '', nEx: d.ex ? PX[d.ex].length : 0, nSets: d.ex ? PX[d.ex].reduce((a, x) => a + x[1], 0) : 0, ic: done ? 'ph-fill ph-check-circle' : d.today ? 'ph-fill ph-lightning' : d.check ? 'ph ph-clipboard-text' : d.rest ? 'ph ph-coffee' : 'ph ph-circle-dashed' };
    };
    const days = DAYS.map(dayItem);
    const doneN = days.filter(d => d.isDone).length;
    const tot = mealTot();
    const recCount = k => MUS.filter(m => m.rec === k).length;
    const w30 = SERIES['30d'].w;

    const home = {
      hello: 'Tối nay, Minh', date: 'Thứ Ba, 13/10/2026', weekNo: 'Tuần 42',
      tag: 'Buổi ' + TD.type, focus: TD.focus, mins: est(PX[TD.ex]), nEx: TL.length, nSets: TL.reduce((a, x) => a + x.sets, 0),
      list: TL, days, doneN, planN: 5, weekPct: (doneN / 5 * 100).toFixed(0) + '%', weekR: rings(doneN / 5), trained, notTrained: !trained,
      w: '64,65', wD: '−0,40 kg', wSub: '30 ngày qua', spark: spark(w30, O.sparkW || 300, O.sparkH || 56), bmi: '22,4', bmiL: 'Bình thường',
      kcal: nf(tot.k), kcalT: nf(KT.kcal), kcalLeft: nf(KT.kcal - tot.k), kR: rings(tot.k / KT.kcal), kcalPct: Math.round(tot.k / KT.kcal * 100) + '%',
      p: tot.p, pT: KT.p, pR: rings(tot.p / KT.p), pPct: Math.min(100, Math.round(tot.p / KT.p * 100)) + '%',
      water: fs.water, waterT: KT.water, wR: rings(fs.water / KT.water), waterPct: Math.round(fs.water / KT.water * 100) + '%',
      recLow: recCount('low'), recMid: recCount('mid'), recReady: recCount('ready'), recLowN: MUS.filter(m => m.rec === 'low').map(m => m.n).join(', '),
      recBars: MUS.slice(0, 14).map(m => ({ n: m.n, c: RC(m.rec), h: m.pct + '%', id: m.id })),
      check: 'CN 18/10', checkLeft: 'Còn 5 ngày', checkMeta: 'Cân sáng, đo vòng eo',
      goPlan: () => upd({ page: 'plan', day: 2 }), goMap: () => upd({ page: 'map' }), goFood: () => upd({ page: 'food' }), goBody: () => upd({ page: 'body' }), goProg: () => upd({ page: 'prog' })
    };

    const PD = DAYS.find(d => d.k === fs.day) || TD;
    const pdi = dayItem(PD);
    const plan = {
      days: DAYS.map(d => Object.assign(dayItem(d), { sel: P(d.k === fs.day), on: d.k === fs.day, pick: () => upd({ day: d.k }) })),
      cur: Object.assign({}, pdi, { focus: PD.focus || PD.rest, meta: PD.meta || '', hasEx: !!PD.ex, list: PD.ex ? exList(PD.ex) : [], canStart: !!PD.today && !trained, start, restTxt: PD.rest || '', ricon: PD.check ? 'ph-clipboard-text' : 'ph-person-simple-walk' }),
      mine: MINE.map(m => Object.assign({}, m, { c: m.on ? T.acc : T.ink3, lbl: m.on ? 'Đang dùng' : 'Đã xong', ic: m.on ? 'ph-fill ph-play-circle' : 'ph ph-check-circle' })),
      tpls: TPLS, range: '12/10 – 18/10', weekNo: 'Tuần 2 / 4', doneN, planN: 5, pct: (doneN / 5 * 100) + '%'
    };

    const pe = PEX.find(e => e.k === fs.ex) || PEX[0], ss = PS[pe.k], ul = pe.u === 's' ? 's' : 'rep';
    const allMax = Math.max(pe.tg, ...ss.reduce((a, s) => a.concat(s[1]), []));
    const top = Math.ceil(allMax * 1.2 / 5) * 5;
    let run = 0;
    const bests = ss.map(s => Math.max(...s[1])), bi = bests.indexOf(Math.max(...bests));
    const groups = ss.map(([d, a], gi) => { const b = bests[gi]; const pr = gi > 0 && b > run; run = Math.max(run, b); const top1 = gi === bi; return { d, best: b, pr, top1, top: (b / top * 100).toFixed(1) + '%', isLast: gi === ss.length - 1, bars: a.map(v => ({ v, h: (v / top * 100).toFixed(1) + '%', c: top1 ? T.a3 : T.acc, op: v >= pe.tg || top1 ? 1 : .5 })) }; });
    const bestAll = Math.max(...groups.map(g => g.best)), first = groups[0].best, lastB = groups[groups.length - 1].best;
    const bestG = groups.filter(g => g.best === bestAll)[0];
    const rows = groups.map((g, i) => { const prev = i ? groups[i - 1].best : null, df = prev == null ? null : g.best - prev; return { d: g.d, sets: ss[i][1].map(v => ({ v, c: v >= pe.tg ? T.good : T.ink2, bg: v >= pe.tg ? T.good + '22' : T.chip })), best: g.best + ' ' + ul, delta: df == null ? '—' : (df > 0 ? '+' : df < 0 ? '−' : '±') + Math.abs(df), dc: df == null || df === 0 ? T.ink3 : df > 0 ? T.good : T.bad, badge: g.pr ? 'Kỷ lục mới' : g.best >= pe.tg ? 'Đạt mục tiêu' : i === 0 ? 'Buổi đầu' : 'Chưa đạt', bc: g.pr ? T.a3 : g.best >= pe.tg ? T.good : T.ink3, bic: g.pr ? 'ph-fill ph-trophy' : g.best >= pe.tg ? 'ph-fill ph-check-circle' : 'ph ph-circle' }; }).reverse().slice(0, 4);
    const cal = [];
    for (let i = 0; i < 3; i++) cal.push({ n: '', blank: true, c: 'transparent', bg: 'transparent', fg: 'transparent', bd: 'transparent', has: false });
    for (let n = 1; n <= 31; n++) {
      const t = CAL[n], p = CALP[n], today = n === 13, isDone = !!t || (today && trained);
      const c = isDone ? TC(t || 'B') : p ? TC(p) : n === 18 ? T.a3 : 'transparent';
      cal.push({ n: String(n), blank: false, today, has: isDone || !!p || n === 18, isDone, c, fg: today ? T.ink : n > 13 ? T.ink3 : T.ink2, bg: isDone ? TC(t || 'B') + '26' : 'transparent', bd: today ? T.acc : p ? c + '66' : 'transparent', dot: isDone ? c : p ? c + '88' : n === 18 ? T.a3 : 'transparent' });
    }
    while (cal.length % 7) cal.push({ n: '', blank: true, c: 'transparent', bg: 'transparent', fg: 'transparent', bd: 'transparent', dot: 'transparent' });
    const prog = {
      chips: PEX.map(e => Object.assign(P(e.k === fs.ex), { k: e.k, l: e.en, vi: e.vi, on: e.k === fs.ex, pick: () => upd({ ex: e.k }) })),
      en: pe.en, vi: pe.vi, ul, tg: pe.tg, best: bestAll, bestD: bestG.d, nS: ss.length, vs: (lastB - first >= 0 ? '+' : '−') + Math.abs(lastB - first), tgL: pe.tg + ' ' + ul + ' × 3',
      groups, tgPct: (pe.tg / top * 100).toFixed(1) + '%', yTop: top, yMid: Math.round(top / 2), rows, cal, month: 'Tháng 10 · 2026', wk: ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'],
      bestPct: Math.min(100, bestAll / pe.tg * 100).toFixed(0) + '%', ratio: rings(Math.min(1, lastB / pe.tg)),
      legend: [['Buổi A · Đẩy', T.acc], ['Buổi B · Kéo & Chân', T.a2], ['Tự do', T.a3]].map(([l, c]) => ({ l, c }))
    };

    const S = SERIES[fs.range];
    const tcol = k => T[TM.find(t => t.k === k).ck];
    const Ccirc = 2 * Math.PI * (O.donutR || 74), totC = COMP.reduce((a, c) => a + c[1], 0);
    let acc = 0;
    const comp = COMP.map(([l, kg, ck]) => { const len = kg / totC * Ccirc, o = { l, c: T[ck], kg: vn(kg, 2) + ' kg', pct: vn(kg / totC * 100, 1) + '%', w: (kg / totC * 100).toFixed(1) + '%', da: `${f1(Math.max(0, len - 3))} ${f1(Ccirc)}`, off: f1(-acc) }; acc += len; return o; });
    const body = {
      w: '64,65', bmi: '22,4', bmiL: 'Bình thường', std: 'Chuẩn Á Đông', when: '11/10 · 21:40', score: 87, scoreR: rings(.87), g: gauge(T),
      ranges: RANGES.map(r => Object.assign(P(r.k === fs.range), { l: r.l, on: r.k === fs.range, pick: () => upd({ range: r.k }) })),
      tiles: TM.map(t => { const v = S[t.k], df = v[v.length - 1] - v[0], on = t.k === fs.tm, gd = df * t.good; return Object.assign(P(on), { l: t.l, c: tcol(t.k), v: vn(v[v.length - 1], t.d), u: t.u, d: (df > 0 ? '+' : df < 0 ? '−' : '±') + vn(Math.abs(df), t.d), dc: Math.abs(df) < 1e-9 ? T.ink3 : gd > 0 ? T.good : T.bad, on, pick: () => upd({ tm: t.k }) }); }),
      tr: trend(fs.range, fs.tm, O.trW || 820, O.trH || 220, tcol(fs.tm)),
      metrics: MET.map(m => { const has = m.x != null, sc = m.sc || [0, 0, 1, 1], tt = sc[3] - sc[0]; return { l: m.l, v: m.v, u: m.u, src: m.src ? 'Công thức' : 'Đã đo', srcC: m.src ? T.acc : T.good, d: m.d, dc: m.d && m.d !== '±0' ? (m.dg ? T.good : T.bad) : T.ink3, st: m.st, stc: m.neutral ? T.ink2 : T.good, rg: m.rg, bop: has ? 1 : 0, f1: Math.max(0.001, (sc[1] - sc[0]) / tt), f2: (sc[2] - sc[1]) / tt, f3: (sc[3] - sc[2]) / tt, pos: has ? ((m.x - sc[0]) / tt * 100).toFixed(1) + '%' : '50%' }; }),
      comp
    };

    const open = fs.open || {};
    const food = {
      kcal: nf(tot.k), kcalT: nf(KT.kcal), left: nf(KT.kcal - tot.k), kR: rings(tot.k / KT.kcal), kPct: Math.round(tot.k / KT.kcal * 100) + '%',
      macros: [['Đạm', tot.p, KT.p, T.acc], ['Tinh bột', tot.c, KT.c, T.a2], ['Chất béo', tot.f, KT.f, T.a3]].map(([l, v, t, c]) => ({ l, v: v + ' g', t: t + ' g', c, pct: Math.min(100, v / t * 100).toFixed(0) + '%', pn: Math.round(v / t * 100) + '%', R: rings(v / t) })),
      meals: MEALS.map((m, i) => { const on = !!open[i], k = m.items.reduce((a, x) => a + x[2], 0); return { n: m.n, ic: 'ph ph-' + m.ic, t: m.t, kcal: nf(k), nIt: m.items.length + ' món', on, off: !on, chev: on ? 'ph-caret-up' : 'ph-caret-down', toggle: () => upd({ open: Object.assign({}, open, { [i]: !on }) }), pct: (k / KT.kcal * 100).toFixed(1) + '%', items: m.items.map(([n, q, kk, p, c, f]) => ({ n, q, k: nf(kk), p: p + 'g', c: c + 'g', f: f + 'g' })) }; }),
      water: fs.water, waterT: KT.water, wL: vn(fs.water * .25, 2).replace(/,?0+$/, '') + ' L', wR: rings(fs.water / KT.water),
      cups: Array.from({ length: KT.water }, (_, i) => ({ i, full: i < fs.water, c: i < fs.water ? T.a2 : T.track, op: i < fs.water ? 1 : .5, pick: () => upd({ water: i + 1 === fs.water ? i : i + 1 }) })),
      addCup: () => upd({ water: Math.min(KT.water, fs.water + 1) }),
      week: FWEEK.map(([s, v, hit], i) => ({ s, v: nf(v), h: (v / 2400 * 100).toFixed(1) + '%', c: i === 6 ? T.acc : hit ? T.good : T.a3, today: i === 6, fg: i === 6 ? T.ink : T.ink3 })),
      tgPct: (KT.kcal / 2400 * 100).toFixed(1) + '%', avg: nf(FWEEK.reduce((a, x) => a + x[1], 0) / 7), hitN: FWEEK.filter(x => x[2]).length
    };

    const M = MUS.find(m => m.id === fs.mus) || MUS[0];
    const map = {
      recStr: MUS.map(m => m.id + ':' + m.rec).join(','), sel: M.id, mode: 'rec',
      groups: ['low', 'mid', 'ready'].map(k => ({ k, l: RECL[k], c: RC(k), n: recCount(k), items: MUS.filter(m => m.rec === k).map(m => Object.assign(P(m.id === M.id), { id: m.id, n: m.n, on: m.id === M.id, c: RC(m.rec), pct: m.pct + '%', pick: () => upd({ mus: m.id }) })) })),
      cur: { n: M.n, en: M.en, st: RECL[M.rec], c: RC(M.rec), pct: M.pct + '%', pn: M.pct, last: M.last, eta: M.eta, R: rings(M.pct / 100), inToday: TODAYM.includes(M.id), todayTxt: TODAYM.includes(M.id) ? 'Có trong buổi B hôm nay' : 'Không có trong buổi hôm nay', exs: LIB.filter(x => x.r === MREG[M.id]).slice(0, 4).map(x => ({ a: x.a, b: x.b, sets: x.sets, lv: LV[x.lv], go: () => upd({ page: 'lib', sel: x.k, reg: x.r }) })) },
      legend: ['low', 'mid', 'ready'].map(k => ({ l: RECL[k], c: RC(k) }))
    };

    const list = LIB.filter(x => fs.reg === 'all' || x.r === fs.reg);
    const X = LIB.find(x => x.k === fs.sel) || LIB[0];
    const stars = lv => [1, 2, 3].map(j => ({ on: j <= lv, c: j <= lv ? T.a3 : T.track }));
    const lib = {
      regs: REG.map(([k, l]) => Object.assign(P(k === fs.reg), { k, l, n: k === 'all' ? LIB.length : LIB.filter(x => x.r === k).length, on: k === fs.reg, pick: () => upd({ reg: k }) })),
      list: list.map((x, i) => Object.assign(P(x.k === X.k), { k: x.k, a: x.a, b: x.b, no: String(i + 1).padStart(2, '0'), reg: REGN[x.r], eq: EQL[x.eq], lv: LV[x.lv], stars: stars(x.lv), sets: x.sets, warn: x.warn || '', hasWarn: !!x.warn, on: x.k === X.k, pick: () => upd({ sel: x.k }) })),
      count: list.length,
      cur: { a: X.a, b: X.b, reg: REGN[X.r], eq: EQL[X.eq], lv: LV[X.lv], stars: stars(X.lv), sets: X.sets, warn: X.warn || '', hasWarn: !!X.warn, tip: X.tip, steps: X.steps.map((t, i) => ({ i: i + 1, t })), mus: X.mus.map(([n, p, role], i) => ({ n, p: p + '%', role, c: [T.acc, T.a2, T.a4, T.ink3][i] })) }
    };

    let wk = { on: false, isWork: false, isRest: false, isDone: false };
    const w = fs.wk;
    if (w) {
      const e = TL[Math.min(w.i, TL.length - 1)];
      const totalSets = TL.reduce((a, x) => a + x.sets, 0);
      const doneSets = w.done ? totalSets : TL.slice(0, w.i).reduce((a, x) => a + x.sets, 0) + w.s;
      const reps = w.r != null ? w.r : e.t;
      const set = p => upd({ wk: Object.assign({}, w, p) });
      const isRest = !w.done && w.rest > 0;
      wk = {
        on: true, isWork: !w.done && !isRest, isRest, isDone: !!w.done, title: 'Buổi ' + TD.type + ' · ' + TD.focus,
        n: e.n, en: e.en, grp: e.grp, ul: e.ul, sx: e.sx, i: w.i + 1, nEx: TL.length, setNo: w.s + 1, sets: e.sets, reps, tgt: e.t, isS: e.u === 's',
        el: mmss(w.t || 0), pct: (doneSets / totalSets * 100).toFixed(1) + '%', doneSets, totalSets, R: rings(doneSets / totalSets), exR: rings(w.s / e.sets),
        segs: TL.map((x, i) => ({ n: x.n, no: x.no, st: w.done || i < w.i ? 'done' : i === w.i ? 'cur' : 'todo', fill: w.done || i < w.i ? '100%' : i === w.i ? (w.s / x.sets * 100).toFixed(0) + '%' : '0%', c: w.done || i < w.i ? T.good : i === w.i ? T.acc : T.ink3, fg: i === w.i && !w.done ? T.ink : T.ink3 })),
        dots: Array.from({ length: e.sets }, (_, j) => ({ j, st: j < w.s ? 'done' : j === w.s ? 'cur' : 'todo', c: j < w.s ? T.good : j === w.s ? T.acc : T.track, sz: j === w.s ? '14px' : '10px' })),
        rest: mmss(w.rest || 0), restN: w.rest || 0, restR: rings(w.restT ? w.rest / w.restT : 0), next: e.n, nextSet: 'Set ' + (w.s + 1) + ' / ' + e.sets, nextSx: e.sx,
        upNext: TL[w.i + 1] ? TL[w.i + 1].n : 'Hết bài, về đích',
        logReps: (w.log || []).reduce((a, x) => a + x, 0), mins: Math.max(1, Math.round((w.t || 0) / 60)),
        minus: () => set({ r: Math.max(0, reps - (e.u === 's' ? 5 : 1)) }),
        plus: () => set({ r: reps + (e.u === 's' ? 5 : 1) }),
        doneSet: () => {
          const log = (w.log || []).concat([reps]);
          if (w.s + 1 < e.sets) set({ s: w.s + 1, rest: 45, restT: 45, r: null, log });
          else if (w.i + 1 < TL.length) set({ i: w.i + 1, s: 0, rest: 75, restT: 75, r: null, log });
          else set({ done: true, rest: 0, log });
        },
        skipEx: () => { if (w.i + 1 < TL.length) set({ i: w.i + 1, s: 0, rest: 0, r: null }); else set({ done: true, rest: 0 }); },
        skipRest: () => set({ rest: 0 }), addRest: () => set({ rest: (w.rest || 0) + 15, restT: Math.max(w.restT || 0, (w.rest || 0) + 15) }),
        close: () => upd({ wk: null }),
        finish: () => upd({ wk: null, trained: true, page: 'home' })
      };
    }

    return { nav, pg, page, home, plan, prog, body, food, map, lib, wk, start, trained, startL: trained ? 'Đã tập hôm nay' : 'Bắt đầu buổi tập', startIc: trained ? 'ph-fill ph-check-circle' : 'ph-fill ph-play', startOp: trained ? .6 : 1, date: 'Thứ Ba, 13/10/2026', weekNo: 'Tuần 42' };
  };

  window.BodyKit = K;
})();
