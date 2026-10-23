/**
 * Con vật vẽ bằng code (thí nghiệm "So sánh con vật" — /fx-lab → Thí nghiệm).
 * Mỗi con = hàm thuần frame(t, o) → danh sách hình [{ d, fill, fb, op, stroke, sw }] theo thứ tự dưới → trên.
 * Chuyển động từ bộ xương: cánh khớp vai–cổ tay chiếu 3/4 (đại bàng); 2 rồng đã chuyển vào app (src/utils/dragonArt.js),
 * mèo xù lông vồ nhau; đuôi là dây trễ pha. Hồ ly 9 đuôi đã vào app (creatureArt.js), kỳ lân vẽ lại bị loại.
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

export const CREATURES = { eagle: EAGLE, cats: CATS };
