/**
 * Con vật vẽ bằng code (thí nghiệm "So sánh con vật" — /fx-lab → Thí nghiệm).
 * Mỗi con = hàm thuần frame(t, o) → danh sách hình [{ d, fill, fb, op, stroke, sw }] theo thứ tự dưới → trên.
 * Chuyển động từ bộ xương: cánh khớp vai–cổ tay chiếu 3/4 (đại bàng); 2 rồng đã chuyển vào app (src/utils/dragonArt.js),
 * Hồ ly 9 đuôi + 2 rồng đã vào app (creatureArt.js); kỳ lân và mèo vẽ lại bị loại (mèo dùng bản lai catfight).
 * Không DOM → node render thử được. Đầu con vật hướng +x.
 */
const TAU = Math.PI * 2;
const r1 = (v) => Math.round(v * 10) / 10;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
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
const line = (a, b) => 'M' + r1(a[0]) + ' ' + r1(a[1]) + 'L' + r1(b[0]) + ' ' + r1(b[1]);
const ellipse = (c, rx, ry, a = 0) => smooth(Array.from({ length: 8 }, (_, i) => add(c, rot([Math.cos(i * TAU / 8) * rx, Math.sin(i * TAU / 8) * ry], a))));

// Pháp tuyến tại điểm i của đường sp (dương = bên trái hướng đi; đường đi đầu → đuôi sang trái thì là phía trên)
function frameAt(sp, i) {
  const a = sp[Math.max(i - 1, 0)], b = sp[Math.min(i + 1, sp.length - 1)];
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, tx = (b[0] - a[0]) / l, ty = (b[1] - a[1]) / l;
  return { tx, ty, nx: -ty, ny: tx };
}

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


// Ống nối nhiều điểm (chân), bề ngang theo từng đoạn
const limb = (pts, ws) => tube(pts, (u) => { const x = u * (ws.length - 1), i = Math.min(Math.floor(x), ws.length - 2); return lerp(ws[i], ws[i + 1], x - i); });

const S = (d, fill, op = 1, extra = {}) => ({ d, fill, op, ...extra });
const K = (d, stroke, sw, op = 1, extra = {}) => ({ d, fill: 'none', stroke, sw, op, ...extra });

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

export const CREATURES = { eagle: EAGLE };
