/**
 * Con vật vẽ bằng code (thí nghiệm "So sánh con vật" — /fx-lab → Thí nghiệm).
 * Mỗi con = hàm thuần frame(t, o) → danh sách hình [{ d, fill, fb, op, stroke, sw }] theo thứ tự dưới → trên.
 * Chuyển động từ bộ xương: xương sống lượn sóng (rồng), cánh khớp vai–cổ tay chiếu 3/4 (đại bàng),
 * chân 2 khớp giải ngược IK theo quỹ đạo bàn chân (hồ ly, kỳ lân, mèo), đuôi / bờm / râu là dây trễ pha.
 * Không DOM → node render thử được. Đầu con vật hướng +x.
 */
const TAU = Math.PI * 2;
const r1 = (v) => Math.round(v * 10) / 10;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (x) => { const c = clamp(x, 0, 1); return c * c * (3 - 2 * c); };
const pol = (p, a, l) => [p[0] + Math.cos(a) * l, p[1] + Math.sin(a) * l];
const add = (p, q) => [p[0] + q[0], p[1] + q[1]];
const rot = (v, a) => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a)];

export function smooth(pts, closed = true) {
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
export function tube(sp, w, caps = true) {
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
const DRAGON = {
  w: 380, h: 180, period: 2.4,
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
const DRAGON_EU = {
  w: 340, h: 270, period: 1.5,
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

/* ═══════════════ ĐẠI BÀNG (đầu trắng; cánh khớp vai–cổ tay, nhìn 3/4 từ trên) ═══════════════ */
const WING = [[4, 0], [9, 16], [10, 36], [6, 52], [0, 66], [-6, 70], [-9, 63], [-13, 69], [-16, 61], [-20, 65], [-22, 56], [-26, 58], [-27, 49], [-30, 42], [-31, 30], [-30, 18], [-28, 8], [-24, 0]];
const EAGLE = {
  w: 240, h: 170, period: 0.9,
  defs: '<linearGradient id="egWing" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3A2718"/><stop offset=".55" stop-color="#5B4029"/><stop offset="1" stop-color="#7A5634"/></linearGradient>',
  // o: flap (biên độ 0..1), fold (gập cánh lao xuống 0..1), talon (duỗi móng 0..1)
  frame(t, o = {}) {
    const flap = o.flap ?? 1, fold0 = o.fold ?? 0, talon = o.talon ?? 0;
    const ph = (t / this.period) % 1, cx = 128, cy = 80, e = 0.42, out = [];
    const proj = (X, Y, Z) => [cx + X, cy - Y * Math.cos(e) + Z * Math.sin(e)];
    const th0 = 0.18 + 0.1 * fold0, amp = 0.75 * flap * (1 - 0.8 * fold0);
    const th = th0 + amp * Math.cos(TAU * ph), dth = -amp * Math.sin(TAU * ph);
    const fold = clamp(fold0 + (1 - fold0) * 0.5 * flap * Math.max(0, Math.sin(TAU * (ph - 0.5))), 0, 1);
    const wing = (sideZ, far) => {
      const pts = WING.map(([a, s]) => {
        let A = a, Sx = s;
        if (s > 36) { A -= fold * (s - 36) * 0.95; Sx = 36 + (s - 36) * (1 - 0.55 * fold); }
        Sx *= 1 - 0.22 * fold;
        const ang = th - 0.5 * dth * Math.pow(s / 66, 2);
        return proj(A + 4, Sx * Math.sin(ang), sideZ * Sx * Math.cos(ang));
      });
      out.push(S(smooth(pts), far ? '#2E2016' : 'url(#egWing)', 1, { fb: '#5B4029', stroke: '#1F150D', sw: 0.6 }));
      // Lông bao cánh sáng hơn + đường tách lông
      const cov = [[5, 2], [9, 16], [10, 34], [-4, 36], [-12, 30], [-14, 14], [-12, 2]].map(([a, s]) => { let Sx = s * (1 - 0.22 * fold); const ang = th - 0.5 * dth * Math.pow(s / 66, 2); return proj(a + 4, Sx * Math.sin(ang), sideZ * Sx * Math.cos(ang)); });
      out.push(S(smooth(cov), far ? '#3E2B1C' : '#8A6440', far ? 0.8 : 0.85));
      let fe = '';
      [[-6, 70], [-13, 69], [-20, 65], [-26, 58], [-30, 42], [-31, 30], [-30, 18]].forEach(([a, s]) => {
        const p = (aa, ss) => { let A = aa, Sx = ss; if (ss > 36) { A -= fold * (ss - 36) * 0.95; Sx = 36 + (ss - 36) * (1 - 0.55 * fold); } Sx *= 1 - 0.22 * fold; const ang = th - 0.5 * dth * Math.pow(ss / 66, 2); return proj(A + 4, Sx * Math.sin(ang), sideZ * Sx * Math.cos(ang)); };
        fe += line(p(a * 0.45, s * 0.62), p(a * 0.9, s * 0.95));
      });
      out.push(K(fe, '#1F150D', 0.7, 0.6));
    };
    wing(-1, true);
    // Đuôi trắng xoè
    const tw = 2 * Math.sin(TAU * ph + 1);
    out.push(S(smooth([[-42, -5], [-58, -9 + tw], [-72, -6 + tw], [-76, 1 + tw], [-71, 7 + tw], [-57, 8], [-42, 4]].map((p) => add([cx, cy], p))), '#F8FAFC', 1, { stroke: '#94A3B8', sw: 0.6 }));
    out.push(K([-60, -64, -68].map((x) => line(add([cx, cy], [-46, 0]), add([cx, cy], [x, x === -64 ? 1 + tw : (x === -60 ? -6 + tw : 5 + tw)]))).join(''), '#CBD5E1', 0.6));
    // Chân: co (lông "quần") hoặc duỗi móng ra trước
    const hip = add([cx, cy], [2, 10]), knee = add(hip, rot([4 + 10 * talon, 9], -0.3 * talon)), foot = add(knee, [6 + 14 * talon, 4 + 4 * talon]);
    out.push(S(limb([hip, knee], [6.5, 5]), '#3A281B'));
    out.push(S(limb([knee, foot], [2, 1.6]), '#FBBF24'));
    [-0.9, -0.3, 0.3, 0.9].forEach((o2) => { const a0 = 0.2 + o2 * (0.4 + 0.5 * talon); const c = pol(foot, a0, 3 + 3 * talon); out.push(K('M' + r1(foot[0]) + ' ' + r1(foot[1]) + 'Q' + r1(c[0]) + ' ' + r1(c[1]) + ' ' + r1(pol(c, a0 + 1.4, 2.5)[0]) + ' ' + r1(pol(c, a0 + 1.4, 2.5)[1]), '#111827', 1.2)); });
    // Thân
    out.push(S(smooth([[24, -5], [16, -11], [4, -13], [-12, -12], [-30, -8], [-44, -3], [-44, 4], [-28, 10], [-8, 14], [10, 12], [22, 5]].map((p) => add([cx, cy], p))), '#4A3423', 1, { stroke: '#2A1D13', sw: 0.6 }));
    out.push(S(smooth([[16, 4], [4, 9], [-14, 9], [-30, 6], [-14, 12], [4, 13], [18, 8]].map((p) => add([cx, cy], p))), '#3A281B', 0.8));
    wing(1, false);
    // Đầu trắng, mỏ quặp, mày dữ
    const hd = (p) => add([cx, cy], p);
    out.push(S(smooth([[14, -9], [22, -15], [32, -16], [40, -12], [42, -6], [38, -1], [30, 2], [20, 3], [14, 0]].map(hd)), '#F8FAFC', 1, { stroke: '#94A3B8', sw: 0.5 }));
    out.push(S(smooth([[39, -11], [46, -10], [51, -7], [53, -2.5], [51, 1.5], [49.5, -0.5], [46, -2], [40, -2]].map(hd)), '#F59E0B', 1, { stroke: '#92400E', sw: 0.6 }));
    out.push(K(smooth([[41, -5], [46, -4.6], [50, -3]].map(hd), false), '#92400E', 0.7));
    out.push(S(ellipse(hd([34, -9]), 2.4, 2.1), '#FCD34D', 1, { stroke: '#1F150D', sw: 0.4 }));
    out.push(S(ellipse(hd([34.6, -9]), 1.1, 1.2), '#111827'));
    out.push(K(smooth([[29, -11.5], [34, -12.6], [39, -11]].map(hd), false), '#475569', 1.4));
    return out;
  },
};

/* ═══════════════ HỒ LY 9 ĐUÔI (cáo trắng ánh băng; phi nước đại, chân IK; 9 đuôi linh khí) ═══════════════ */
const FOX = {
  w: 260, h: 160, period: 0.56,
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
        out.push(S(limb([root, k], [6.5, 4.2]), fur, 1, { fb: '#EEF6FF', stroke: '#94A3B8', sw: 0.4 }));
        out.push(S(limb([k, f, ft], [3.6, 2.8, 2.6]), low, 1, { stroke: '#94A3B8', sw: 0.4 }));
      } else {
        const ankle = add(ft, [-7, -9]);
        const [k, a] = ik2(root, ankle, 19, 16, -1);
        out.push(S(limb([root, k], [11.5, 5.6]), fur, 1, { fb: '#EEF6FF', stroke: '#94A3B8', sw: 0.4 }));
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
      out.push(S(tube(pts, (s) => 1.6 + 5.6 * Math.pow(Math.sin(Math.PI * Math.min(1, s * 1.08)), 0.7)), 'url(#fxTail)', k % 2 ? 0.85 : 1, { fb: '#DCEFFD', stroke: '#BAE6FD', sw: 0.5 }));
      out.push(S(ellipse(pts[12], 3, 2, Math.atan2(pts[12][1] - pts[11][1], pts[12][0] - pts[11][0])), '#7DD3FC', 0.6));
    }
    // Thân
    out.push(S(smooth([add(Sh, [13, -15]), add(Sh, [0, -16]), add(mid, [0, -13]), add(Hp, [2, -15]), add(Hp, [-14, -7]), add(Hp, [-12, 9]), add(Hp, [5, 14]), add(mid, [0, 12]), add(Sh, [3, 17]), add(Sh, [17, 8])]), 'url(#fxFur)', 1, { fb: '#EEF6FF', stroke: '#94A3B8', sw: 0.6 }));
    out.push(K(smooth([add(Hp, [-4, -10]), add(mid, [0, -9]), add(Sh, [-6, -10])], false), '#BAE6FD', 1.2, 0.7));
    // Cổ + đầu (lắc ngược nhịp thân)
    const hb = 2.5 * Math.sin(TAU * ph + 2.4), hd0 = add(Sh, [30, -22 + hb]), ha = -0.08 + 0.06 * Math.sin(TAU * ph + 2.4), Lc = (p) => add(hd0, rot([p[0] * 1.3, p[1] * 1.3], ha));
    out.push(S(tube([add(Sh, [6, -6]), add(Sh, [18, -14 + hb / 2]), Lc([-6, 2])], (s) => lerp(11, 8, s)), 'url(#fxFur)', 1, { fb: '#EEF6FF' }));
    out.push(S(poly([[-4, -7], [-9, -24], [2, -10]].map(Lc)), '#C9D9EA'));
    out.push(S(smooth([[-8, -6], [0, -9], [8, -8], [16, -4], [25, 0], [17, 3.5], [6, 6], [-4, 7], [-10, 2]].map(Lc)), 'url(#fxFur)', 1, { fb: '#F5FAFF', stroke: '#94A3B8', sw: 0.6 }));
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

/* ═══════════════ KỲ LÂN (ngựa trắng sừng vàng, đi 4 nhịp; bờm/đuôi pastel) ═══════════════ */
const MANE = ['#C4B5FD', '#F9A8D4', '#A7F3D0', '#FDE68A', '#C4B5FD', '#F9A8D4', '#A7F3D0'];
const UNICORN = {
  w: 250, h: 210, period: 1.25,
  defs: '<linearGradient id="unBody" x1="0" y1="70" x2="0" y2="140" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#DCE3F0"/></linearGradient>'
    + '<linearGradient id="unHorn" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFF7D6"/><stop offset="1" stop-color="#F59E0B"/></linearGradient>',
  // o.drink: 0..1 cúi đầu uống nước (đứng yên khi > 0)
  frame(t, o = {}) {
    const drink = o.drink ?? 0, walk = 1 - ease(drink * 1.5), ph = (t / this.period) % 1, G = 198, out = [];
    const bob = -2.2 * walk * Math.sin(TAU * ph * 2);
    const Sh = [158, 104 + bob], Hp = [88, 108 + bob], mid = [123, 102 + bob];
    const legs = [[Hp, 0.0, false, true], [Sh, 0.25, true, true], [Hp, 0.5, false, false], [Sh, 0.75, true, false]];
    const drawLeg = ([root0, p0, front, far]) => {
      const root = add(root0, front ? [2, 10] : [0, 8]);
      const ft = walk > 0.01 ? footPath(ph + p0, root, G, 36 * walk, 13 * walk, 0.62, front ? 6 : -4) : [root[0] + (front ? 6 : -4) + (far ? -5 : 5), G];
      const col = far ? '#D5DCE8' : 'url(#unBody)';
      if (front) {
        const [k, f] = ik2(root, add(ft, [0, -10]), 30, 27, 1);
        out.push(S(limb([root, k, f], [8.5, 5, 3.6]), col, 1, { fb: '#F1F5F9', stroke: '#94A3B8', sw: 0.5 }));
        out.push(S(limb([f, ft], [3.4, 3.2]), col, 1, { fb: '#F1F5F9' }));
      } else {
        const hock = add(ft, [-6, -26]);
        const [k, a] = ik2(root, hock, 30, 26, -1);
        out.push(S(limb([root, k, a], [13, 6.5, 4]), col, 1, { fb: '#F1F5F9', stroke: '#94A3B8', sw: 0.5 }));
        out.push(S(limb([a, add(ft, [0, -8]), ft], [3.8, 3.4, 3.2]), col, 1, { fb: '#F1F5F9' }));
      }
      out.push(S(smooth([add(ft, [-4.5, -6]), add(ft, [4.5, -6]), add(ft, [5.5, 0]), add(ft, [-5, 0])]), '#F59E0B', 1, { stroke: '#B45309', sw: 0.5 }));
      out.push(S(ellipse(add(ft, [0, -8]), 5, 3.2), far ? '#E9D5FF' : '#F3E8FF', 0.95));
    };
    drawLeg(legs[0]); drawLeg(legs[1]);
    // Đuôi: 5 dải bay xuống sau
    const tb = add(Hp, [-20, -14]);
    [0, 1, 2, 3, 4].forEach((k) => {
      const pts = rope(tb, 12, 6.4, (s, i) => Math.PI - 0.5 + k * 0.1 + 1.25 * s + 0.2 * Math.sin(TAU * ph - i * 0.45 + k * 0.8) * (0.4 + s));
      out.push(S(tube(pts, (s) => 4.4 * Math.sin(Math.PI * Math.min(1, s * 1.1 + 0.08)) + 0.4), MANE[k], 0.95));
    });
    // Thân
    out.push(S(smooth([add(Sh, [18, -10]), add(Sh, [2, -20]), add(mid, [0, -14]), add(Hp, [0, -21]), add(Hp, [-20, -10]), add(Hp, [-16, 12]), add(Hp, [4, 22]), add(mid, [0, 22]), add(Sh, [0, 22]), add(Sh, [17, 9])]), 'url(#unBody)', 1, { fb: '#F8FAFC', stroke: '#94A3B8', sw: 0.7 }));
    // Cổ cong + đầu (cúi xuống khi uống)
    const nod = 0.05 * walk * Math.sin(TAU * ph * 2 + 0.8), na = -1.05 + 1.55 * ease(drink) + nod;
    const n0 = add(Sh, [6, -12]), n1 = pol(n0, na - 0.12, 22), n2 = pol(n1, na + 0.1, 22);
    const ha = na + 1.35, Lc = (p) => add(n2, rot(p, ha));
    // Bờm dọc cổ
    for (let k = 0; k < 7; k++) {
      const s0 = k / 6, root = add([lerp(n2[0], n0[0], s0), lerp(n2[1], n0[1], s0)], rot([-5, -3], na));
      const pts = rope(root, 8, 6.2, (s, i) => 2.3 + 0.45 * s + 0.3 * Math.sin(TAU * ph - i * 0.6 + k * 0.7) * (0.3 + s));
      out.push(S(tube(pts, (s) => 5.6 * (1 - s) + 0.6), MANE[k], 0.95));
    }
    out.push(S(tube([n0, n1, n2], (s) => lerp(14, 10, s)), 'url(#unBody)', 1, { fb: '#F8FAFC', stroke: '#94A3B8', sw: 0.6 }));
    out.push(S(smooth([[-7, -8], [5, -10], [19, -5], [33, 3], [40, 9], [38, 15.5], [30, 17], [18, 12.5], [4, 8.5], [-7, 6]].map(Lc)), 'url(#unBody)', 1, { fb: '#F8FAFC', stroke: '#94A3B8', sw: 0.7 }));
    out.push(S(poly([[0, -9], [-3, -22], [6, -10]].map(Lc)), '#F1F5F9', 1, { stroke: '#94A3B8', sw: 0.6 }));
    out.push(S(poly([[1.4, -10.5], [-1, -18], [4.4, -10.5]].map(Lc)), '#FBCFE8'));
    // Sừng xoắn vàng
    const hb0 = Lc([7, -10]), hdir = ha - 1.95, tip = pol(hb0, hdir, 27);
    out.push(S(poly([pol(hb0, hdir - Math.PI / 2, 3.4), tip, pol(hb0, hdir + Math.PI / 2, 3.4)]), 'url(#unHorn)', 1, { fb: '#FCD34D', stroke: '#B45309', sw: 0.5 }));
    let sp = '';
    for (let k = 1; k < 6; k++) { const c = pol(hb0, hdir, 27 * k / 6.5), w = 3.4 * (1 - k / 6.5); sp += line(pol(c, hdir - Math.PI / 2, w), pol(pol(c, hdir, 2.6), hdir + Math.PI / 2, w * 0.9)); }
    out.push(K(sp, '#B45309', 0.7, 0.7));
    // Mái tóc trước trán
    [0, 1].forEach((k) => { const pts = rope(Lc([4 + k * 3, -9]), 5, 3.6, (s, i) => ha + 0.4 + k * 0.3 + 0.8 * s + 0.2 * Math.sin(TAU * ph - i + k)); out.push(S(tube(pts, (s) => 2.8 * (1 - s) + 0.4), MANE[k + 1], 0.95)); });
    out.push(S(smooth([[5, -3.6], [9, -6.2], [13, -4], [9, -1.6]].map(Lc)), '#312E81'));
    out.push(S(ellipse(Lc([10, -4.2]), 0.8, 0.7), '#FFFFFF'));
    out.push(K(smooth([[6, -6.5], [9.5, -8], [13, -6.6]].map(Lc), false), '#475569', 0.8));
    out.push(S(ellipse(Lc([35, 10]), 1.4, 1), '#94A3B8'));
    out.push(K(smooth([[30, 14.5], [35, 14.2], [38.5, 14.5]].map(Lc), false), '#94A3B8', 0.8));
    drawLeg(legs[2]); drawLeg(legs[3]);
    return out;
  },
};

/* ═══════════════ 2 MÈO ĐÁNH NHAU (đối mặt xù lông → lao vào → cuộn bụi → bật ra) ═══════════════ */
const CATPAL = {
  black: { body: '#232838', light: '#3A4258', rim: '#7C879E', eye: '#5EF2C2', belly: '#3A4258', stripe: null, far: '#171B26' },
  orange: { body: '#F2994A', light: '#F8B977', rim: '#9A4A12', eye: '#84CC16', belly: '#FCE3C8', stripe: '#C96A22', far: '#C47A35' },
};
// Mèo nhìn ngang, dir = 1 quay phải. arch: xù lông (thân nhấc cao, chân thẳng, lưng vồng, đuôi dựng phồng)
function cat(out, x0, dir, pose, t, pal) {
  const { arch = 0, hiss = 0, swat = 0, lift = 0 } = pose, s = 1.7, G = 168, ws = s / 1.2;
  const L = (p) => [x0 + dir * p[0] * s, G - lift + p[1] * s];
  const sway = 2 * hiss * Math.sin(t * 9), up = 7 * arch;
  const B = (p) => L([p[0] + sway, p[1] - up]);
  const rimmed = { stroke: pal.rim, sw: 0.8 };
  // Đuôi: dựng chữ S khi xù, thả ngang khi bình thường
  const tpts = rope(B([-22, -15]), 10, 4.8, (u, i) => {
    const a1 = -Math.PI / 2 - 0.35 - 1.0 * (1 - arch) + 0.95 * u * (1 - 0.35 * arch) + 0.28 * Math.sin(t * 5 - i * 0.6) * (1 - 0.5 * arch);
    return dir > 0 ? a1 : Math.PI - a1;
  });
  out.push(S(tube(tpts, (u) => (2.1 + 0.6 * u) * (1 + 1.2 * arch) * ws), pal.body, 1, rimmed));
  // Chân xa (tối hơn)
  const legTo = (x, top, bend) => [B([x, top]), L([x + sway * 0.5 + bend, (top - up) / 2]), L([x + sway * 0.3, 0])];
  out.push(S(limb(legTo(-16, -9, -1.5), [3.2 * ws, 2.7 * ws, 2.5 * ws]), pal.far, 1, rimmed));
  out.push(S(limb(legTo(11, -9, 1.5), [3 * ws, 2.6 * ws, 2.4 * ws]), pal.far, 1, rimmed));
  // Thân: lưng vồng khi xù
  out.push(S(smooth([[-24, -16], [-9, -24 - 9 * arch], [7, -23 - 3 * arch], [18, -16], [17, -9], [4, -8], [-10, -8], [-23, -9]].map(B)), pal.body, 1, rimmed));
  out.push(S(smooth([[-14, -9], [2, -9], [14, -10.5], [6, -12], [-8, -11.5]].map(B)), pal.belly, 0.55));
  if (pal.stripe) {
    let st = '';
    [[-15, -19], [-8, -23], [-1, -23.5]].forEach(([x, y]) => { st += 'M' + B([x, y - 6 * arch]).map(r1).join(' ') + 'Q' + B([x - 2.5, y + 2]).map(r1).join(' ') + ' ' + B([x - 1, y + 6]).map(r1).join(' '); });
    out.push(K(st, pal.stripe, 1.8, 0.85));
  }
  if (arch > 0.05) {
    let fur = '';
    for (let k = 0; k < 6; k++) { const u = k / 5, x = lerp(-19, 9, u), y = -21 - arch * 9 * Math.sin(Math.PI * (u * 0.75 + 0.12)); fur += poly([B([x - 1.6, y + 1]), B([x - 0.6, y - 3 * arch]), B([x + 1.4, y + 1])]); }
    out.push(S(fur, pal.body));
  }
  // Chân gần + vồ
  out.push(S(limb(legTo(-13, -9, -2), [3.8 * ws, 3 * ws, 2.8 * ws]), pal.body, 1, rimmed));
  const paw = swat > 0.02 ? B([26 + 6 * swat, -15 - 9 * swat]) : L([15 + sway * 0.3, 0]);
  out.push(S(limb([B([13, -11]), swat > 0.02 ? B([20 + 4 * swat, -13 - 5 * swat]) : L([15 + sway * 0.5, (-11 - up) / 2]), paw], [3.6 * ws, 2.9 * ws, 2.7 * ws]), pal.body, 1, rimmed));
  if (swat > 0.3) { let cl = ''; [-0.5, 0, 0.5].forEach((o) => { cl += line(paw, add(paw, [dir * 3.5 * s, (o * 3 - 1) * s])); }); out.push(K(cl, '#F8FAFC', 1)); }
  // Đầu: tai cụp ra sau khi khè
  const hc = B([24 + hiss * 3, -25 + 2 * arch]), H = (p) => [hc[0] + dir * p[0] * s, hc[1] + p[1] * s], eb = hiss * 0.6;
  out.push(S(poly([H([-6, -6]), H([-10 - 4 * eb, -16 + 6 * eb]), H([0, -9])]), pal.far, 1, rimmed));
  out.push(S(ellipse(hc, 9.5 * s, 8.6 * s), pal.body, 1, rimmed));
  out.push(S(poly([H([1, -7]), H([3 - 4 * eb, -18 + 7 * eb]), H([9, -5])]), pal.body, 1, rimmed));
  out.push(S(poly([H([2.6, -7.5]), H([3.6 - 3 * eb, -14 + 5 * eb]), H([7, -6])]), '#FBCFE8', 0.8));
  out.push(S(ellipse(H([5, 3.2]), 5 * s, 3.3 * s), pal.belly, 0.85));
  out.push(S(smooth([H([1, -2.4]), H([4.5, -4 + hiss * 0.8]), H([8, -2.4]), H([4.5, -1])]), pal.eye));
  out.push(K(line(H([4.6, -3.8]), H([4.6, -1.3])), '#0B0F14', 1.4));
  out.push(K(line(H([0, -5.2 + hiss * 0.5]), H([8.5, -3.6 + hiss * 1.4])), pal.rim, 1.4));
  out.push(S(poly([H([9.2, 0.8]), H([10.8, 0.3]), H([10.4, 2])]), '#F472B6'));
  if (hiss > 0.4) { out.push(S(smooth([H([5.8, 4.2]), H([9.8, 3.6]), H([9, 7.5 * hiss]), H([5.4, 6.6 * hiss])]), '#7F1D1D')); out.push(S(poly([H([7.4, 4.2]), H([8, 6.2]), H([8.6, 4.2])]), '#FFFFFF')); }
  let wh = ''; [-1.5, 0.5, 2.5].forEach((y) => { wh += line(H([9, 2 + y * 0.4]), H([18, y * 1.4])); });
  out.push(K(wh, '#E5E7EB', 0.6, 0.85));
}
const CATS = {
  w: 360, h: 185, period: 4.8,
  frame(t) {
    const T = t % this.period, out = [];
    const faceA = 72, faceB = 288;
    if (T < 1.6 || T >= 3.8) {
      const k = T < 1.6 ? T : T - 3.8, rise = T >= 3.8 ? ease(k / 0.3) : 1;
      const hiss = 0.55 + 0.45 * Math.sin(T * 4), swA = Math.max(0, Math.sin(T * 5.2 - 1)) ** 4, swB = Math.max(0, Math.sin(T * 5.2 + 1.8)) ** 4;
      cat(out, faceA, 1, { arch: rise, hiss: hiss * rise, swat: swA * rise }, T, CATPAL.black);
      cat(out, faceB, -1, { arch: rise, hiss: (1.1 - hiss) * rise, swat: swB * rise }, T + 1, CATPAL.orange);
    } else if (T < 2.0) {
      const u = ease((T - 1.6) / 0.4), hop = 26 * Math.sin(Math.PI * u);
      cat(out, lerp(faceA, 150, u), 1, { arch: 0.3, swat: u, lift: hop }, T, CATPAL.black);
      cat(out, lerp(faceB, 210, u), -1, { arch: 0.3, swat: u, lift: hop }, T + 1, CATPAL.orange);
    } else {
      // Cuộn bụi hoạt hình: mây tròn rung + móng / đuôi / sao thò ra
      const u = (T - 2.0) / 1.8, cx = 180, cy = 128, grow = u < 0.12 ? ease(u / 0.12) : u > 0.85 ? 1 + (u - 0.85) * 3 : 1, fade = u > 0.85 ? 1 - (u - 0.85) / 0.15 : 1;
      for (let k = 0; k < 9; k++) {
        const a = k * TAU / 9 + T * 3.2, r = (36 + 8 * Math.sin(T * 13 + k * 2)) * grow;
        out.push(S(ellipse([cx + Math.cos(a) * r * 1.3, cy + Math.sin(a) * r * 0.7], (25 + 6 * Math.sin(T * 17 + k)) * grow, (21 + 4 * Math.cos(T * 15 + k)) * grow), k % 2 ? '#E7E5E4' : '#F5F5F4', 0.95 * fade, { stroke: '#A8A29E', sw: 0.8 }));
      }
      const tick = Math.floor(T * 7);
      const pops = [[0.3, 'paw', CATPAL.black], [1.6, 'tail', CATPAL.orange], [2.9, 'star', null], [4.1, 'paw', CATPAL.orange], [5.3, 'tail', CATPAL.black], [0.9, 'star', null]];
      pops.forEach(([a0, kind, pal], k) => {
        if ((tick + k) % 3 === 0 || fade < 1) return;
        const a = a0 + T * 0.8, p = [cx + Math.cos(a) * 70 * grow, cy + Math.sin(a) * 40 * grow];
        if (kind === 'star') { const st = Array.from({ length: 10 }, (_, i) => pol(p, a + i * TAU / 10, i % 2 ? 3 : 7.5)); out.push(S(poly(st), '#FDE047', 1, { stroke: '#CA8A04', sw: 0.6 })); }
        else if (kind === 'paw') { out.push(S(limb([[cx + Math.cos(a) * 40, cy + Math.sin(a) * 24], p], [3.6, 3.2]), pal.body, 1, { stroke: pal.dark, sw: 0.5 })); let cl = ''; [-0.4, 0, 0.4].forEach((o) => { cl += line(p, pol(p, a + o, 5)); }); out.push(K(cl, '#F8FAFC', 0.9)); }
        else { const pts = rope([cx + Math.cos(a) * 38, cy + Math.sin(a) * 22], 6, 5, (s, i) => a + 0.5 * Math.sin(T * 9 - i)); out.push(S(tube(pts, () => 3.4), pal.body, 1, { stroke: pal.dark, sw: 0.5 })); }
      });
    }
    return out;
  },
};

export const CREATURES = { dragon: DRAGON, dragonEU: DRAGON_EU, eagle: EAGLE, fox: FOX, unicorn: UNICORN, cats: CATS };
