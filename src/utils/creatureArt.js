/**
 * Con vật vẽ bằng code cho nền trang Nhiệm vụ (taskFlyersElf.js vẽ lại path mỗi khung bằng rAF qua `liveArt`):
 * - FOX_9TAIL: hồ ly 9 đuôi trắng ánh băng — phi nước đại, chân 2–3 khớp giải IK theo quỹ đạo bàn chân, lưng co duỗi,
 *   9 đuôi lượn trễ pha (cảnh `kitsune`, `foxlant`).
 * - DRAGON_EAST: rồng xanh phương Đông — xương sống lượn sóng (chuẩn hoá độ dài cung), bờm lửa, râu dài, chân đạp mây.
 * - DRAGON_WEST: rồng châu Âu — cánh dơi có xương ngón chiếu 3/4 (xoè khi đập xuống, gập khi nhấc lên), cổ chữ S,
 *   đuôi lượn với đầu mũi giáo.
 * Mỗi con: { w, h, period, defs, frame(t) → hình } + mốc theo tỉ lệ khung tính từ tâm: head / mouth (miệng),
 * feet (mặt đất dưới tâm), tail (chóp đuôi).
 * Hình = [{ d, fill, op, stroke, sw }] thứ tự dưới → trên; fill 'url(#id)' trỏ gradient trong defs.
 * Hàm thuần, không DOM (self-check: src/__tests__/tasks/creatureArt.test.js). Đầu con vật hướng +x.
 */
const TAU = Math.PI * 2;
const r1 = (v) => Math.round(v * 10) / 10;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (x) => { const c = clamp(x, 0, 1); return c * c * (3 - 2 * c); };
const pol = (p, a, l) => [p[0] + Math.cos(a) * l, p[1] + Math.sin(a) * l];
const add = (p, q) => [p[0] + q[0], p[1] + q[1]];
const rot = (v, a) => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a)];

function smooth(pts, closed = true) {
  const n = pts.length;
  const P = (i) => (closed ? pts[(i + n) % n] : pts[clamp(i, 0, n - 1)]);
  let d = 'M' + r1(pts[0][0]) + ' ' + r1(pts[0][1]);
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    d += 'C' + r1(p1[0] + (p2[0] - p0[0]) / 6) + ' ' + r1(p1[1] + (p2[1] - p0[1]) / 6) + ' ' + r1(p2[0] - (p3[0] - p1[0]) / 6) + ' ' + r1(p2[1] - (p3[1] - p1[1]) / 6) + ' ' + r1(p2[0]) + ' ' + r1(p2[1]);
  }
  return closed ? d + 'Z' : d;
}
const poly = (pts) => 'M' + pts.map((p) => r1(p[0]) + ' ' + r1(p[1])).join('L') + 'Z';
const line = (a, b) => 'M' + r1(a[0]) + ' ' + r1(a[1]) + 'L' + r1(b[0]) + ' ' + r1(b[1]);
const ellipse = (c, rx, ry, a = 0) => smooth(Array.from({ length: 8 }, (_, i) => add(c, rot([Math.cos(i * TAU / 8) * rx, Math.sin(i * TAU / 8) * ry], a))));

// Pháp tuyến tại điểm i của đường sp (dương = bên trái hướng đi; đường đi đầu → đuôi sang trái thì là phía trên)
function frameAt(sp, i) {
  const a = sp[Math.max(i - 1, 0)], b = sp[Math.min(i + 1, sp.length - 1)];
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, tx = (b[0] - a[0]) / l, ty = (b[1] - a[1]) / l;
  return { tx, ty, nx: -ty, ny: tx };
}
const side = (sp, i, off) => { const f = frameAt(sp, i); return [sp[i][0] + f.nx * off, sp[i][1] + f.ny * off]; };

// Ống bo tròn hai đầu chạy theo sp, bề ngang w(i/(n-1)) (nửa bề ngang)
function tube(sp, w, caps = true) {
  const n = sp.length, L = [], R = [];
  for (let i = 0; i < n; i++) {
    const f = frameAt(sp, i), wi = w(i / (n - 1));
    L.push([sp[i][0] + f.nx * wi, sp[i][1] + f.ny * wi]);
    R.push([sp[i][0] - f.nx * wi, sp[i][1] - f.ny * wi]);
  }
  const f0 = frameAt(sp, 0), f1 = frameAt(sp, n - 1), w0 = w(0), w1 = w(1);
  const pts = caps ? [[sp[0][0] - f0.tx * w0 * 0.8, sp[0][1] - f0.ty * w0 * 0.8], ...L, [sp[n - 1][0] + f1.tx * w1 * 0.8, sp[n - 1][1] + f1.ty * w1 * 0.8], ...R.reverse()] : [...L, ...R.reverse()];
  return smooth(pts);
}

// Dây trễ pha (đuôi, bờm, râu): góc từng đốt = base + a(i/n)
function rope(root, n, seg, ang) {
  const pts = [root];
  for (let i = 1; i <= n; i++) pts.push(pol(pts[i - 1], ang(i / n, i), seg));
  return pts;
}

// IK 2 đốt: trả [khớp giữa, điểm cuối]; bend = +1/-1 chọn phía gập
function ik2(a, b, l1, l2, bend) {
  const dx = b[0] - a[0], dy = b[1] - a[1], d = clamp(Math.hypot(dx, dy), Math.abs(l1 - l2) + 0.01, l1 + l2 - 0.01), ang = Math.atan2(dy, dx);
  const off = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
  const k = pol(a, ang + bend * off, l1);
  return [k, pol(a, ang, d)];
}

// Quỹ đạo bàn chân: chạm đất lùi về sau (stance), rồi nhấc lên đưa tới (swing)
function footPath(p, root, ground, stride, lift, stance, reach = 0) {
  const q = ((p % 1) + 1) % 1;
  if (q < stance) return [root[0] + reach + stride / 2 - stride * (q / stance), ground];
  const s = (q - stance) / (1 - stance);
  return [root[0] + reach - stride / 2 + stride * ease(s), ground - lift * Math.sin(Math.PI * s)];
}

// Ống nối nhiều điểm (chân), bề ngang theo từng đoạn
const limb = (pts, ws) => tube(pts, (u) => { const x = u * (ws.length - 1), i = Math.min(Math.floor(x), ws.length - 2); return lerp(ws[i], ws[i + 1], x - i); });

// Chuẩn hoá theo độ dài cung: điểm đều nhau dọc đường thô
function resample(raw, n, len) {
  const cum = [0];
  for (let i = 1; i < raw.length; i++) cum.push(cum[i - 1] + Math.hypot(raw[i][0] - raw[i - 1][0], raw[i][1] - raw[i - 1][1]));
  const out = [];
  let j = 0;
  for (let i = 0; i < n; i++) {
    const L = (len * i) / (n - 1);
    while (j < cum.length - 2 && cum[j + 1] < L) j++;
    const f = clamp((L - cum[j]) / ((cum[j + 1] - cum[j]) || 1), 0, 1);
    out.push([lerp(raw[j][0], raw[j + 1][0], f), lerp(raw[j][1], raw[j + 1][1], f)]);
  }
  return out;
}

const S = (d, fill, op = 1, extra = {}) => ({ d, fill, op, ...extra });
const K = (d, stroke, sw, op = 1, extra = {}) => ({ d, fill: 'none', stroke, sw, op, ...extra });

/* ═══════════════ RỒNG XANH (rồng phương Đông, thân rắn lượn sóng) ═══════════════ */
export const DRAGON_EAST = {
  w: 380, h: 180, period: 2.4, head: [0.47, 0.01],
  defs: '<linearGradient id="drgBody" x1="0" y1="50" x2="0" y2="130" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#0B6B58"/><stop offset=".55" stop-color="#18A07E"/><stop offset="1" stop-color="#5EE0B4"/></linearGradient>'
    + '<linearGradient id="drgMane" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FDE047"/><stop offset="1" stop-color="#F97316"/></linearGradient>',
  frame(t) {
    const ph = t / this.period, N = 46, LB = 285, X0 = 318, YC = 92;
    const amp = (u) => 4 + 14 * Math.sqrt(u);
    const raw = Array.from({ length: 160 }, (_, i) => { const u = (i / 159) * 1.25; return [X0 - LB * u, YC + amp(u) * Math.sin(TAU * (u * 1.45 - ph))]; });
    const sp = resample(raw, N, LB);
    const dw = (u) => (u < 0.16 ? lerp(10.5, 14, ease(u / 0.16)) : lerp(14, 2.4, Math.pow(ease((u - 0.16) / 0.84), 0.85)));
    const at = (u) => Math.round(clamp(u, 0, 1) * (N - 1));
    const out = [];

    // Chân: gốc dưới bụng, 2 đốt đạp nước trong mây; xa = tối, sau thân
    const leg = (u, phase, far) => {
      const i = at(u), w = dw(u), root = side(sp, i, -0.55 * w), f = frameAt(sp, i);
      const aT = Math.atan2(f.ty, f.tx), aD = Math.atan2(-f.ny, -f.nx);
      const sw = Math.sin(TAU * ph * 1.2 + phase);
      const a1 = aD + 0.5 + 0.45 * sw, a2 = a1 - 0.9 - 0.45 * Math.sin(TAU * ph * 1.2 + phase + 1.3);
      const k = pol(root, a1, 13), ft = pol(k, a2, 11);
      const col = far ? '#0A5446' : '#12906F';
      out.push(S(limb([root, k, ft], [4.6, 3.4, 2.6]), col));
      const claws = [-0.7, 0, 0.7].map((o) => { const c1 = pol(ft, a2 + 0.9 + o * 0.6, 4.5); return 'M' + r1(ft[0]) + ' ' + r1(ft[1]) + 'Q' + r1(c1[0]) + ' ' + r1(c1[1]) + ' ' + r1(pol(c1, a2 + 1.9 + o * 0.5, 3)[0]) + ' ' + r1(pol(c1, a2 + 1.9 + o * 0.5, 3)[1]); }).join('');
      out.push(K(claws, far ? '#CBB98A' : '#FEF3C7', 1.3));
      void aT;
    };
    leg(0.2, Math.PI, true); leg(0.6, 0, true);

    // Chùm lửa đuôi
    const tail = sp[N - 1], ft = frameAt(sp, N - 1), aT = Math.atan2(ft.ty, ft.tx);
    [-0.7, -0.25, 0.2, 0.65].forEach((o, k) => {
      const pts = rope(tail, 7, 4.2, (s, i) => aT + o * (0.6 + s) + 0.45 * Math.sin(TAU * ph * 2 - i * 0.6 + k));
      out.push(S(tube(pts, (s) => 3.6 * (1 - s) + 0.4), 'url(#drgMane)', 0.95, { fb: '#F59E0B' }));
    });

    // Thân + bụng vàng + vảy bụng + vệt sáng lưng
    out.push(S(tube(sp, dw), 'url(#drgBody)', 1, { fb: '#18A07E', stroke: '#064E3B', sw: 0.8 }));
    const bi = [], bo = [];
    for (let i = at(0.03); i <= at(0.92); i++) { const w = dw(i / (N - 1)); bi.push(side(sp, i, -0.15 * w)); bo.push(side(sp, i, -0.97 * w)); }
    out.push(S(smooth([...bi, ...bo.reverse()]), '#FCD34D', 1));
    let plates = '';
    for (let u = 0.05; u < 0.9; u += 0.032) { const i = at(u), w = dw(u); plates += line(side(sp, i, -0.2 * w), side(sp, i, -0.92 * w)); }
    out.push(K(plates, '#B45309', 0.7, 0.55));
    const hi = [], ho = [];
    for (let i = at(0.04); i <= at(0.85); i++) { const w = dw(i / (N - 1)); hi.push(side(sp, i, 0.35 * w)); ho.push(side(sp, i, 0.72 * w)); }
    out.push(S(smooth([...hi, ...ho.reverse()]), '#A7F3D0', 0.32));
    // Vảy lưng: chấm cung nhỏ
    let scales = '';
    for (let u = 0.08; u < 0.88; u += 0.028) for (const o of [0.15, 0.55]) {
      const i = at(u), w = dw(u), c = side(sp, i, o * w), f = frameAt(sp, i);
      const a = pol(c, Math.atan2(f.ty, f.tx), 2.2), b = pol(c, Math.atan2(-f.ty, -f.tx), 2.2), m = pol(c, Math.atan2(-f.ny, -f.nx), 1.8);
      scales += 'M' + r1(a[0]) + ' ' + r1(a[1]) + 'Q' + r1(m[0]) + ' ' + r1(m[1]) + ' ' + r1(b[0]) + ' ' + r1(b[1]);
    }
    out.push(K(scales, '#064E3B', 0.6, 0.45));
    // Vây lưng: gai nghiêng về sau, rung nhẹ
    let spikes = '';
    for (let u = 0.07; u < 0.9; u += 0.038) {
      const w = dw(u), h = 7.5 * (1 - u * 0.7) * (1 + 0.12 * Math.sin(TAU * ph * 3 + u * 20));
      const b1 = side(sp, at(u - 0.012), w * 0.92), b2 = side(sp, at(u + 0.014), w * 0.92), tp = side(sp, at(u + 0.026), w * 0.95 + h);
      spikes += 'M' + r1(b1[0]) + ' ' + r1(b1[1]) + 'L' + r1(tp[0]) + ' ' + r1(tp[1]) + 'L' + r1(b2[0]) + ' ' + r1(b2[1]) + 'Z';
    }
    out.push(S(spikes, '#F59E0B', 1, { stroke: '#B45309', sw: 0.5 }));

    // Đầu: khung toạ độ riêng (x tới trước, y xuống)
    const H0 = sp[0], f0 = frameAt(sp, 0), aH = Math.atan2(-f0.ty, -f0.tx), Lc = (p) => add(H0, rot([p[0] * 1.3, p[1] * 1.3], aH));
    // Bờm: 7 lọn bay về sau
    [[-4, -9], [-6, -5], [-7, -1], [-6, 3], [-3, 6], [-1, -11], [-8, -8]].forEach((r, k) => {
      const base = aH + Math.PI - 0.35 + k * 0.09;
      const pts = rope(Lc(r), 8, 4.6, (s, i) => base + 0.3 * s + 0.32 * Math.sin(TAU * ph * 1.6 - i * 0.7 + k * 0.9));
      out.push(S(tube(pts, (s) => 3.6 * (1 - s) + 0.3), 'url(#drgMane)', 0.95, { fb: '#F97316' }));
    });
    leg(0.2, 0, false); leg(0.6, Math.PI, false);
    const horn = (dx, far) => {
      const pts = [[4 + dx, -10], [-4 + dx, -17], [-14 + dx, -22], [-26 + dx, -23]].map(Lc);
      out.push(S(tube(pts, (s) => 2.2 * (1 - s) + 0.5), far ? '#C9B98F' : '#FEF3C7', 1, { stroke: '#92400E', sw: 0.5 }));
      out.push(S(tube([[-8 + dx, -19], [-10 + dx, -24], [-9 + dx, -29]].map(Lc), (s) => 1.4 * (1 - s) + 0.4), far ? '#C9B98F' : '#FEF3C7', 1));
    };
    horn(3, true);
    const jo = 0.12 + 0.08 * Math.sin(TAU * ph);
    const jaw = [[6, 3], [18, 3.2], [30, 3.6], [37, 4.6], [35, 7.2], [24, 8.6], [12, 9], [2, 8.4], [-4, 6]].map((p) => Lc(add([6, 3], rot([p[0] - 6, p[1] - 3], jo))));
    out.push(S(smooth(jaw), '#14876A', 1, { stroke: '#064E3B', sw: 0.6 }));
    const fang = [[29, 2], [31, 6.5], [33, 2]].map((p) => Lc(add([6, 3], rot([p[0] - 6, p[1] - 3], jo * 0.5))));
    out.push(S(poly(fang), '#FFFBEB', 1));
    out.push(S(smooth([[-6, -8], [2, -11.5], [10, -12.5], [17, -10.5], [23, -8.6], [31, -7.6], [37, -6], [41, -3.2], [41.5, -0.2], [38, 1.6], [30, 2], [20, 2.4], [10, 3.8], [0, 6.4], [-7, 4]].map(Lc)), 'url(#drgBody)', 1, { fb: '#1AA582', stroke: '#064E3B', sw: 0.7 }));
    out.push(S(smooth([[14, -2], [24, -1], [34, 0], [26, 1.6], [16, 1.8]].map(Lc)), '#FCD34D', 0.9));
    horn(0, false);
    out.push(S(smooth([[11.5, -6.6], [16, -9.4], [21, -7.2], [16, -4.6]].map(Lc)), '#FDE047', 1, { stroke: '#7C2D12', sw: 0.5 }));
    out.push(K(line(Lc([16.2, -8.8]), Lc([16.4, -5])), '#1C1917', 1.3));
    out.push(K(smooth([[9, -9.6], [16, -11.6], [23, -10]].map(Lc), false), '#064E3B', 1.6));
    out.push(S(ellipse(Lc([37.5, -3.6]), 1.6, 1.1, aH), '#064E3B'));
    // Râu dài + chòm râu cằm
    [[38, -1, 0], [35, 2.5, 1.3]].forEach(([x, y, k]) => {
      const pts = rope(Lc([x, y]), 12, 5.2, (s, i) => aH + Math.PI - 0.25 + 0.55 * s + 0.4 * Math.sin(TAU * ph * 1.3 - i * 0.55 + k));
      out.push(S(tube(pts, (s) => 0.9 * (1 - s) + 0.25, false), '#FDE68A', 0.95));
    });
    [0, 1, 2].forEach((k) => {
      const pts = rope(Lc([16 + k * 2, 8.8]), 4, 3.2, (s, i) => aH + Math.PI / 2 + 0.6 + k * 0.12 + 0.25 * Math.sin(TAU * ph * 2 - i + k));
      out.push(S(tube(pts, (s) => 1.4 * (1 - s) + 0.3), '#F97316', 0.9));
    });
    return out;
  },
};

/* ═══════════════ RỒNG CHÂU ÂU (thân 4 chân, cánh dơi có xương ngón, cổ chữ S, đuôi mũi giáo) ═══════════════ */
const lerp2 = (p, q, t) => [lerp(p[0], q[0], t), lerp(p[1], q[1], t)];
const WYV = { el: [-12, 28], wr: [8, 52], tips: [[6, 122], [-30, 114], [-62, 94], [-80, 62]], end: [-64, 2] };
export const DRAGON_WEST = {
  w: 340, h: 270, period: 1.5, head: [0.31, -0.13],
  defs: '<linearGradient id="deBody" x1="0" y1="95" x2="0" y2="140" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#7F1D1D"/><stop offset=".6" stop-color="#B91C1C"/><stop offset="1" stop-color="#EF4444"/></linearGradient>'
    + '<linearGradient id="deWing" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#DC2626" stop-opacity=".95"/><stop offset="1" stop-color="#FB923C" stop-opacity=".82"/></linearGradient>',
  // o.flap: biên độ đập cánh 0..1 (0 = lượn)
  frame(t, o = {}) {
    const flapAmt = o.flap ?? 1, ph = (t / this.period) % 1, e = 0.38, out = [];
    const amp = 0.8 * flapAmt, th = 0.25 + amp * Math.cos(TAU * ph), dth = -amp * Math.sin(TAU * ph);
    const fold = 0.55 * flapAmt * Math.max(0, Math.sin(TAU * (ph - 0.5)));
    const c = [164, 150 + 4 * Math.cos(TAU * ph + 0.6)], P = (p) => add(c, p), shoulder = P([14, -12]);
    const proj = (p, side) => { const ang = th - 0.45 * dth * (p[1] / 122) ** 2; return [shoulder[0] + p[0], shoulder[1] - p[1] * Math.sin(ang) * Math.cos(e) + side * p[1] * Math.cos(ang) * Math.sin(e)]; };
    const wing = (side, far) => {
      const k = 1 - 0.22 * fold, wr = [WYV.wr[0] - 4 * fold, WYV.wr[1] * k], el = [WYV.el[0] + 2 * fold, WYV.el[1] * k];
      const tips = WYV.tips.map(([a, s]) => { const v = rot([a - WYV.wr[0], s - WYV.wr[1]], 0.65 * fold); return [wr[0] + v[0] * (1 - 0.42 * fold), wr[1] + v[1] * (1 - 0.42 * fold)]; });
      const W2 = (p) => proj(p, side), tp = tips.map(W2), wrs = W2(wr);
      const mem = [W2([4, 0]), W2([10, 22]), wrs, tp[0]];
      for (let i = 0; i < 3; i++) { mem.push(W2(lerp2(lerp2(tips[i], tips[i + 1], 0.5), wr, 0.24))); mem.push(tp[i + 1]); }
      mem.push(W2(lerp2(lerp2(tips[3], WYV.end, 0.5), wr, 0.2)), W2(WYV.end), W2([-30, 4]));
      out.push(S(smooth(mem), far ? '#7F1D1D' : 'url(#deWing)', far ? 0.95 : 0.9, { fb: far ? '#7F1D1D' : '#E25536', stroke: far ? '#450A0A' : '#7F1D1D', sw: 0.7 }));
      const bone = far ? '#5B1010' : '#991B1B';
      out.push(S(limb([W2([4, 0]), W2(el), wrs], [3.4, 2.8, 2.4]), bone));
      tp.forEach((q) => out.push(S(limb([wrs, q], [1.9, 0.5]), bone)));
      const cl = pol(wrs, -1.9, 5);
      out.push(K('M' + r1(wrs[0]) + ' ' + r1(wrs[1]) + 'Q' + r1(cl[0]) + ' ' + r1(cl[1]) + ' ' + r1(cl[0] + 3) + ' ' + r1(cl[1] + 1), '#FEF3C7', 1.3));
    };
    wing(-1, true);
    // Đuôi lượn chậm + đầu mũi giáo
    const tail = rope(P([-38, -2]), 16, 7, (s, i) => Math.PI + 0.12 + 0.3 * s + (0.08 + 0.3 * s) * Math.sin(TAU * t / 2.2 - i * 0.42));
    out.push(S(tube(tail, (s) => lerp(8.5, 1.5, s)), 'url(#deBody)', 1, { fb: '#B91C1C', stroke: '#450A0A', sw: 0.6 }));
    const q = tail[16], qa = Math.atan2(q[1] - tail[15][1], q[0] - tail[15][0]);
    out.push(S(poly([pol(q, qa + 2.2, 7), pol(q, qa, 13), pol(q, qa - 2.2, 7), pol(q, qa + Math.PI, 1)]), '#7F1D1D', 1, { stroke: '#450A0A', sw: 0.6 }));
    // Chân sau xa, thân, bụng, chân gần
    const leg = (dx, col) => { const sw2 = 2 * Math.sin(TAU * ph); out.push(S(limb([P([-24 + dx, 4]), P([-12 + dx, 18 + sw2]), P([-26 + dx, 24 + sw2]), P([-36 + dx, 22 + sw2])], [9, 5, 3, 2.2]), col, 1, { fb: '#991B1B' })); };
    leg(4, '#5B1010');
    out.push(S(smooth([[36, -6], [22, -14], [0, -16], [-24, -12], [-40, -5], [-38, 6], [-20, 12], [2, 16], [24, 13], [37, 5]].map(P)), 'url(#deBody)', 1, { fb: '#B91C1C', stroke: '#450A0A', sw: 0.7 }));
    out.push(S(smooth([[-30, 6], [-10, 11], [10, 13], [30, 8], [28, 12.5], [8, 17], [-12, 15], [-32, 9.5]].map(P)), '#FCD34D', 1));
    out.push(K([-22, -12, -2, 8, 18, 26].map((x) => line(P([x, 9 + (x > 0 ? 3 : 1)]), P([x - 1, 15.5]))).join(''), '#B45309', 0.7, 0.6));
    leg(0, 'url(#deBody)');
    out.push(S(limb([P([22, 6]), P([14, 18 + 1.5 * Math.sin(TAU * ph)]), P([24, 22])], [5, 3.2, 2.4]), '#991B1B'));
    // Gai lưng (thân + đuôi + cổ)
    let sp = '';
    [[22, -14], [10, -16], [-2, -16.5], [-14, -15], [-26, -12], [-36, -7]].forEach(([x, y]) => { const b = P([x, y]); sp += poly([add(b, [3, 0.6]), add(b, [-4, -8]), add(b, [-3, 0.6])]); });
    for (let i = 1; i < 14; i += 2) { const f = frameAt(tail, i), w = lerp(8.5, 1.5, i / 16), b = [tail[i][0] + f.nx * w * 0.9, tail[i][1] + f.ny * w * 0.9]; sp += poly([b, add(pol(b, Math.atan2(f.ty, f.tx), 3), [f.nx * 6 * (1 - i / 18), f.ny * 6 * (1 - i / 18)]), pol(b, Math.atan2(f.ty, f.tx), 4)]); }
    const neck = rope(P([30, -8]), 7, 7.2, (s, i) => -0.85 + 0.75 * s + 0.05 * Math.sin(TAU * t / 1.5 + i));
    out.push(S(tube(neck, (s) => lerp(10.5, 6.5, s)), 'url(#deBody)', 1, { fb: '#B91C1C', stroke: '#450A0A', sw: 0.6 }));
    for (let i = 1; i < 7; i++) { const f = frameAt(neck, i), w = lerp(10.5, 6.5, i / 7), b = [neck[i][0] - f.nx * w * 0.9, neck[i][1] - f.ny * w * 0.9], a = Math.atan2(-f.ty, -f.tx); sp += poly([b, add(pol(b, a, 3), [-f.nx * 6, -f.ny * 6]), pol(b, a, 4.5)]); }
    out.push(S(sp, '#FEF3C7', 1, { stroke: '#92400E', sw: 0.4 }));
    // Đầu
    const ha = Math.atan2(neck[7][1] - neck[6][1], neck[7][0] - neck[6][0]) + 0.4, Lc = (p) => add(neck[7], rot([p[0] * 1.15, p[1] * 1.15], ha));
    const horn = (dy, col) => out.push(S(tube([[2, -8 + dy], [-8, -14 + dy], [-20, -16 + dy], [-31, -12 + dy]].map(Lc), (s) => 2.8 * (1 - s) + 0.4), col, 1, { stroke: '#92400E', sw: 0.4 }));
    horn(-2, '#C9B98F');
    const jo = 0.1 + 0.07 * Math.sin(TAU * t / 1.5);
    out.push(S(smooth([[4, 3], [16, 3.2], [30, 3], [37, 3.6], [35, 6.2], [24, 7.6], [12, 8], [2, 7.2], [-4, 5]].map((p) => Lc(add([4, 3], rot([p[0] - 4, p[1] - 3], jo))))), '#991B1B', 1, { stroke: '#450A0A', sw: 0.6 }));
    out.push(S([18, 24, 30].map((x) => poly([[x, 2], [x + 1.2, 5], [x + 2.4, 2]].map(Lc))).join(''), '#FFFBEB'));
    out.push(S(smooth([[-6, -7], [4, -10], [14, -9.5], [24, -7], [34, -5.5], [40, -3], [41, 0], [36, 1.6], [24, 2.4], [12, 3.6], [2, 6], [-6, 4]].map(Lc)), 'url(#deBody)', 1, { fb: '#B91C1C', stroke: '#450A0A', sw: 0.7 }));
    [[-5, 3], [-7, 6], [-3, 7]].forEach(([x, y]) => out.push(S(poly([[x, y - 1.5], [x - 7, y + 1], [x, y + 1.5]].map(Lc)), '#FEF3C7')));
    out.push(K(smooth([[8, -8], [14, -9.6], [21, -8]].map(Lc), false), '#450A0A', 1.6));
    out.push(S(smooth([[10.5, -5.4], [14.5, -7.6], [18.5, -5.8], [14.5, -4]].map(Lc)), '#FDE047', 1, { stroke: '#7C2D12', sw: 0.4 }));
    out.push(K(line(Lc([14.6, -7.3]), Lc([14.8, -4.3])), '#1C1917', 1.2));
    out.push(S(ellipse(Lc([37, -2.6]), 1.5, 1), '#450A0A'));
    horn(0, '#FEF3C7');
    wing(1, false);
    return out;
  },
};

/* ═══════════════ HỒ LY 9 ĐUÔI (cáo trắng ánh băng; phi nước đại, chân IK; 9 đuôi linh khí) ═══════════════ */
export const FOX_9TAIL = {
  w: 260, h: 160, period: 0.56, mouth: [0.37, -0.03], feet: 0.41, tail: [-0.33, -0.19],
  defs: '<linearGradient id="fxFur" x1="0" y1="55" x2="0" y2="112" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".6" stop-color="#EEF6FF"/><stop offset="1" stop-color="#C9D9EA"/></linearGradient>'
    + '<linearGradient id="fxTail" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7DD3FC" stop-opacity=".35"/><stop offset=".45" stop-color="#BAE6FD" stop-opacity=".72"/><stop offset="1" stop-color="#F5FAFF" stop-opacity=".95"/></linearGradient>',
  frame(t) {
    const ph = (t / this.period) % 1, G = 146, out = [];
    const bob = -4 * Math.sin(TAU * ph + 0.6), flex = Math.cos(TAU * ph);
    const Sh = [166 + 4 * flex, 100 + bob], Hp = [114 - 4 * flex, 103 + bob - 2 * flex];
    const mid = [(Sh[0] + Hp[0]) / 2, (Sh[1] + Hp[1]) / 2 - 2 * flex];
    // Chân: [gốc, pha, trước?, xa?]
    const legs = [[Sh, 0.0, true, true], [Hp, 0.5, false, true], [Sh, 0.12, true, false], [Hp, 0.62, false, false]];
    const drawLeg = ([root0, p0, front, far]) => {
      const root = add(root0, front ? [2, 6] : [0, 4]);
      const ft = footPath(ph + p0, root, G, front ? 44 : 42, front ? 16 : 12, 0.38, front ? 10 : -6);
      const fur = far ? '#C9D9EA' : 'url(#fxFur)', low = far ? '#B7C8DC' : '#DCE8F5';
      if (front) {
        const [k, f] = ik2(root, add(ft, [0, -5]), 17, 15, 1);
        out.push(S(limb([root, k], [6.5, 4.2]), fur, 1, { stroke: '#94A3B8', sw: 0.4 }));
        out.push(S(limb([k, f, ft], [3.6, 2.8, 2.6]), low, 1, { stroke: '#94A3B8', sw: 0.4 }));
      } else {
        const ankle = add(ft, [-7, -9]);
        const [k, a] = ik2(root, ankle, 19, 16, -1);
        out.push(S(limb([root, k], [11.5, 5.6]), fur, 1, { stroke: '#94A3B8', sw: 0.4 }));
        out.push(S(limb([k, a], [5.2, 3.4]), low, 1, { stroke: '#94A3B8', sw: 0.4 }));
        out.push(S(limb([a, ft], [3.2, 2.6]), low, 1, { stroke: '#94A3B8', sw: 0.4 }));
      }
      out.push(S(ellipse(add(ft, [2, -1.5]), 3.8, 2.3), far ? '#A9BBD1' : '#C9D9EA'));
    };
    drawLeg(legs[0]); drawLeg(legs[1]);
    // 9 đuôi xoè như lửa băng: lượn trễ pha, chóp toả sáng
    const tb = add(Hp, [-13, -8]);
    for (let k = 0; k < 9; k++) {
      const base = Math.PI - 1.08 + k * 0.165;
      const pts = rope(tb, 12, 5.5 + (k % 3) * 0.35, (s, i) => base - 0.2 * s + (0.16 + 0.32 * s) * Math.sin(TAU * ph * 0.5 - i * 0.5 + k * 0.75));
      out.push(S(tube(pts, (s) => 1.6 + 5.6 * Math.pow(Math.sin(Math.PI * Math.min(1, s * 1.08)), 0.7)), 'url(#fxTail)', k % 2 ? 0.85 : 1, { stroke: '#BAE6FD', sw: 0.5 }));
      out.push(S(ellipse(pts[12], 3, 2, Math.atan2(pts[12][1] - pts[11][1], pts[12][0] - pts[11][0])), '#7DD3FC', 0.6));
    }
    // Thân
    out.push(S(smooth([add(Sh, [13, -15]), add(Sh, [0, -16]), add(mid, [0, -13]), add(Hp, [2, -15]), add(Hp, [-14, -7]), add(Hp, [-12, 9]), add(Hp, [5, 14]), add(mid, [0, 12]), add(Sh, [3, 17]), add(Sh, [17, 8])]), 'url(#fxFur)', 1, { stroke: '#94A3B8', sw: 0.6 }));
    out.push(K(smooth([add(Hp, [-4, -10]), add(mid, [0, -9]), add(Sh, [-6, -10])], false), '#BAE6FD', 1.2, 0.7));
    // Cổ + đầu (lắc ngược nhịp thân)
    const hb = 2.5 * Math.sin(TAU * ph + 2.4), hd0 = add(Sh, [30, -22 + hb]), ha = -0.08 + 0.06 * Math.sin(TAU * ph + 2.4), Lc = (p) => add(hd0, rot([p[0] * 1.3, p[1] * 1.3], ha));
    out.push(S(tube([add(Sh, [6, -6]), add(Sh, [18, -14 + hb / 2]), Lc([-6, 2])], (s) => lerp(11, 8, s)), 'url(#fxFur)', 1));
    out.push(S(poly([[-4, -7], [-9, -24], [2, -10]].map(Lc)), '#C9D9EA'));
    out.push(S(smooth([[-8, -6], [0, -9], [8, -8], [16, -4], [25, 0], [17, 3.5], [6, 6], [-4, 7], [-10, 2]].map(Lc)), 'url(#fxFur)', 1, { stroke: '#94A3B8', sw: 0.6 }));
    out.push(S(poly([[0, -8], [-1, -26], [8, -9]].map(Lc)), '#F5FAFF', 1, { stroke: '#94A3B8', sw: 0.5 }));
    out.push(S(poly([[1.2, -10], [0, -18], [5.6, -10]].map(Lc)), '#BAE6FD', 0.85));
    // Hoa văn linh khí: giọt lửa trên trán + vệt má
    out.push(S(smooth([[2, -7.5], [5, -10.5], [8, -7.8], [5, -5.5]].map(Lc)), '#7DD3FC', 0.9));
    out.push(K(smooth([[4, 1.5], [10, 0.4], [15, 1.6]].map(Lc), false), '#7DD3FC', 1, 0.85));
    out.push(S(smooth([[6, -3], [9.5, -5], [13, -3.4], [9.5, -1.8]].map(Lc)), '#0B1A2A'));
    out.push(S(ellipse(Lc([10.5, -3.7]), 0.8, 0.7), '#7DD3FC'));
    out.push(S(ellipse(Lc([24.6, 0.2]), 1.5, 1.2), '#0B1A2A'));
    drawLeg(legs[2]); drawLeg(legs[3]);
    return out;
  },
};
