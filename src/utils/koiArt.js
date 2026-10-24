/**
 * Cá koi Kohaku nhìn từ trên xuống, thân uốn sóng — dùng ở Rừng tiên đêm (cảnh koi / koistar, koi nhảy khi nước bắn).
 * Hình học sinh thủ tục: xương sống lượn sin chạy đầu → đuôi (chuẩn hoá độ dài cung để thân không co giãn);
 * thân, mảng đỏ, vây, đuôi bám theo xương sống. 12 pha / vòng quẫy 1,2s, mỗi path là <animate attributeName="d">
 * (SMIL, trình duyệt tự nội suy) → không cần thư viện. Đầu cá hướng +x như koi cũ để dùng chung xoay theo đường bay.
 * Hàm thuần, không DOM → self-check bằng node (src/__tests__/tasks/koiArt.test.js).
 */
const W = 240, H = 140;                      // khung vẽ; cá dài ~139 đơn vị (mũi x=198 → chóp đuôi x≈59)
const X0 = 198, YC = 70, LB = 112, LAM = 1.05; // mũi cá, trục giữa, chiều dài thân (u = 1), bước sóng dọc thân
const WM = 14.5, SM = 0.3, WP = 4;           // nửa bề ngang lớn nhất, vị trí lớn nhất, cuống đuôi
export const KOI_KEYS = 12;
export const KOI_CYCLE = 1.2;                // giây / vòng quẫy
export const KOI_FISH_LEN = 139 / W;         // tỉ lệ chiều dài cá trên bề ngang khung

const amp = (u) => 1 + 6 * u * u;            // đầu gần như đứng, càng về đuôi càng lắc

function bw(s) {                             // nửa bề ngang thân tại s
  if (s <= SM) return WM * Math.max(0, 1 - ((SM - s) / SM) ** 2.4) ** (1 / 2.4);
  if (s <= 0.86) return WP + (WM - WP) * Math.max(0, 0.5 + 0.5 * Math.cos(Math.PI * (s - SM) / (0.86 - SM))) ** 0.75;
  return WP;
}

function spine(ph) {
  const pts = [];
  for (let i = -24; i <= 600; i++) { const u = i / 400; pts.push([X0 - LB * u, YC + amp(Math.max(u, 0)) * Math.sin(2 * Math.PI * (u / LAM - ph))]); }
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const base = cum[24];
  const at = (u) => {
    const L = base + LB * u;
    let lo = 0, hi = cum.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cum[mid] <= L) lo = mid; else hi = mid; }
    const f = Math.max(0, Math.min(1, (L - cum[lo]) / ((cum[hi] - cum[lo]) || 1)));
    return [pts[lo][0] + (pts[hi][0] - pts[lo][0]) * f, pts[lo][1] + (pts[hi][1] - pts[lo][1]) * f];
  };
  const tan = (u) => {
    const a = at(u - 0.005), b = at(u + 0.005), tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty) || 1;
    return [tx / l, ty / l];
  };
  // Điểm cách xương sống `off` (dương = phía trên khi cá bơi sang phải)
  const P = (u, off = 0) => { const c = at(u), [tx, ty] = tan(u); return [c[0] + ty * off, c[1] - tx * off]; };
  return { P, tan };
}

// Catmull-Rom → bezier: { c: đóng?, v: đỉnh, o: tiếp tuyến ra (tương đối, tiếp tuyến vào = -o) }
function smooth(pts, closed = true) {
  const n = pts.length;
  const o = pts.map((_, i) => {
    const a = closed ? pts[(i - 1 + n) % n] : pts[Math.max(i - 1, 0)], b = closed ? pts[(i + 1) % n] : pts[Math.min(i + 1, n - 1)];
    return [(b[0] - a[0]) / 6, (b[1] - a[1]) / 6];
  });
  return { c: closed, v: pts, o };
}
const line = (a, b) => ({ c: false, v: [a, b], o: [[0, 0], [0, 0]] });
function circle([x, y], r) {
  const k = 0.5523 * r;
  return { c: true, v: [[x, y - r], [x + r, y], [x, y + r], [x - r, y]], o: [[k, 0], [0, k], [-k, 0], [0, -k]] };
}

// Mảng màu trên thân, toạ độ (s, d) với d = tỉ lệ nửa bề ngang → tự uốn theo thân, chạm mép thì bám mép
function blob(P, sc, dc, rs, rd, seed) {
  return smooth(Array.from({ length: 14 }, (_, k) => {
    const a = 2 * Math.PI * k / 14, r = 1 + 0.13 * Math.sin(2 * a + seed) + 0.07 * Math.sin(3 * a + seed * 1.7);
    const s = Math.max(0.03, Math.min(0.85, sc + rs * r * Math.cos(a))), d = Math.max(-0.95, Math.min(0.95, dc + rd * r * Math.sin(a)));
    return P(s, d * bw(s));
  }));
}

const PEC = [[0, 3], [5, 5.4], [11, 6.8], [16.5, 6], [20, 3.4], [21.2, 0], [20, -3.6], [16.5, -6], [11, -6], [5, -4], [0, -2.6]];
const PEC_RAYS = [[15, 5.6], [19.4, 3.6], [20.9, 1.2], [20.9, -1.4], [19.4, -3.8], [15.5, -5.6]];

// Vây ngực / bụng: gốc trên mép thân, xoè ra sau-ngoài góc alpha, đầu vây cong theo curl
function fin(P, tan, sb, side, dFrac, alpha, scale, curl) {
  const [bx, by] = P(sb, side * dFrac * bw(sb)), [tx, ty] = tan(sb), nx = ty * side, ny = -tx * side, a = alpha * Math.PI / 180;
  const dx = Math.cos(a) * tx + Math.sin(a) * nx, dy = Math.cos(a) * ty + Math.sin(a) * ny;
  let qx = -dy, qy = dx;
  if (qx * -tx + qy * -ty < 0) { qx = -qx; qy = -qy; }   // b dương = mép trước (phía đầu)
  const L = ([aa, b]) => { const b2 = (b + curl * (aa / 21) ** 2) * scale; return [bx + dx * aa * scale + qx * b2, by + dy * aa * scale + qy * b2]; };
  return [smooth(PEC.map(L)), PEC_RAYS.map((e) => line(L([1.2, e[1] * 0.25]), L(e)))];
}

const TAIL_EDGE = [[0.85, 3.4], [0.9, 4.2], [0.95, 5.8], [1, 7.8], [1.05, 10], [1.1, 12.2], [1.15, 13.8], [1.19, 14.8], [1.225, 13.6], [1.238, 10.2], [1.218, 6.2], [1.185, 2.8]];

function tail(P, ph) {
  // Gợn trên màng vây: đúng 2 nhịp / vòng quẫy (số nguyên) để pha cuối khớp pha đầu, vòng lặp không giật
  const F = (u, d) => P(u, d + 0.8 * Math.sin(2 * Math.PI * (2.6 * u - 2 * ph)) * Math.max(0, (u - 0.85) / 0.4));
  const outline = smooth([...TAIL_EDGE.map(([u, d]) => F(u, d)), F(1.162, 0), ...[...TAIL_EDGE].reverse().map(([u, d]) => F(u, -d))]);
  const rays = [-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1].map((j) => {
    const ue = 1.165 + 0.06 * Math.abs(j) ** 0.8;
    return smooth([0, 0.35, 0.7, 0.97].map((t) => F(0.87 + (ue - 0.87) * t, j * (2.6 + 10.6 * t))), false);
  });
  return [outline, rays];
}

const SS = [0.006, 0.02, 0.045, 0.08, 0.12, 0.17, 0.23, 0.3, 0.37, 0.44, 0.51, 0.58, 0.65, 0.72, 0.79, 0.86, 0.93];
const SH = Array.from({ length: 10 }, (_, i) => 0.06 + 0.74 * i / 9);
const hw = (s) => 0.24 * Math.sin(Math.PI * (s - 0.06) / 0.74) ** 0.8;

// Mọi path của 1 pha bơi, theo thứ tự dưới → trên
function frame(ph) {
  const { P, tan } = spine(ph), tw = 2 * Math.PI * ph;
  const [tOut, tRays] = tail(P, ph);
  const pel = [1, -1].map((sd) => fin(P, tan, 0.53, sd, 0.85, 35 + 8 * Math.sin(tw + (sd > 0 ? 0 : Math.PI)), 0.55, 2 * Math.sin(tw - 0.8)));
  const pec = [1, -1].map((sd) => fin(P, tan, 0.26, sd, 0.92, 52 + 13 * Math.sin(tw + (sd > 0 ? 0.4 : Math.PI + 0.4)), 1, 2.8 * Math.sin(tw - 0.6 + (sd > 0 ? 0 : Math.PI))));
  const mid = SH.slice(1, -1);
  const eyes = [1, -1].map((sd) => P(0.085, sd * 0.68 * bw(0.085)));
  return [
    ['fin-tail', [tOut]],
    ['ray-tail', tRays],
    ['fin-pel', pel.map((f) => f[0])],
    ['ray-pel', pel.flatMap((f) => f[1])],
    ['fin-pec', pec.map((f) => f[0])],
    ['ray-pec', pec.flatMap((f) => f[1])],
    ['body', [smooth([P(0, 0), ...SS.map((s) => P(s, bw(s))), ...[...SS].reverse().map((s) => P(s, -bw(s)))])]],
    ['patch', [blob(P, 0.125, 0, 0.075, 0.62, 0.5), blob(P, 0.36, -0.35, 0.1, 1.05, 1.9), blob(P, 0.585, 0.32, 0.095, 0.95, 3.1), blob(P, 0.765, -0.15, 0.045, 0.8, 4.4)]],
    ['sheen', [smooth([...mid.map((s) => P(s, hw(s) * bw(s))), P(SH[9], 0), ...[...mid].reverse().map((s) => P(s, -hw(s) * bw(s))), P(SH[0], 0)])]],
    ['ridge', [smooth([0.33, 0.39, 0.45, 0.51, 0.57, 0.63].map((s) => P(s, 0)), false)]],
    ['eye', eyes.map((e) => circle(e, 1.8))],
    ['eye-hl', eyes.map((e) => circle([e[0] + 0.6, e[1] - 0.6], 0.6))],
  ];
}

const FIN = 'fill="#FFF7F2" stroke="#FFF" stroke-opacity=".55" stroke-width=".6"';
const RAY = 'fill="none" stroke="#D1BDB3" stroke-opacity=".45" stroke-linecap="round"';
const PAINT = {
  'fin-tail': FIN + ' fill-opacity=".74"',
  'ray-tail': RAY + ' stroke-width=".5"',
  'fin-pel': FIN + ' fill-opacity=".74"',
  'ray-pel': RAY + ' stroke-width=".45"',
  'fin-pec': FIN + ' fill-opacity=".8"',
  'ray-pec': RAY + ' stroke-width=".5"',
  body: 'fill="#FFF8F0" stroke="#E8D6C7" stroke-opacity=".7" stroke-width=".7"',
  patch: 'fill="#F04F29" fill-opacity=".95"',
  sheen: 'fill="#FFF" fill-opacity=".28"',
  ridge: 'fill="none" stroke="#FFF" stroke-opacity=".4" stroke-width="1" stroke-linecap="round"',
  eye: 'fill="#141721"',
  'eye-hl': 'fill="#FFF" fill-opacity=".9"',
};

const r1 = (n) => String(Math.round(n * 10) / 10);
export function pathD({ c, v, o }) {
  const n = v.length;
  let d = 'M' + r1(v[0][0]) + ' ' + r1(v[0][1]);
  for (let j = 0; j < (c ? n : n - 1); j++) {
    const a = v[j], b = v[(j + 1) % n], oa = o[j], ob = o[(j + 1) % n];
    d += 'C' + r1(a[0] + oa[0]) + ' ' + r1(a[1] + oa[1]) + ' ' + r1(b[0] - ob[0]) + ' ' + r1(b[1] - ob[1]) + ' ' + r1(b[0]) + ' ' + r1(b[1]);
  }
  return c ? d + 'Z' : d;
}

// [[tên nhóm, [[d pha 0 … d pha 12] cho từng path]]] — pha 12 = pha 0 → vòng lặp liền
export function koiFrames() {
  const fr = Array.from({ length: KOI_KEYS + 1 }, (_, k) => frame(k / KOI_KEYS));
  return fr[0].map(([nm, shapes], gi) => [nm, shapes.map((_, pi) => fr.map((f) => pathD(f[gi][1][pi])))]);
}

let inner = null;
/**
 * Chuỗi <svg> của con koi. css: style cho thẻ svg (vị trí, glow); begin: lệch pha (giây) để nhiều con không quẫy đồng loạt.
 * Khung 240×140 co vào width×height.
 */
export function koiSvg({ width, height, css = '', begin = Math.random() * KOI_CYCLE } = {}) {
  if (!inner) {
    inner = koiFrames().map(([nm, paths]) => '<g ' + PAINT[nm] + '>' + paths.map((ds) => '<path d="' + ds[0] + '"><animate attributeName="d" dur="' + KOI_CYCLE + 's" begin="@B" repeatCount="indefinite" values="' + ds.join(';') + '"/></path>').join('') + '</g>').join('');
  }
  return '<svg width="' + width + '" height="' + height + '" viewBox="0 0 ' + W + ' ' + H + '" style="' + css + '">' + inner.replaceAll('@B', (-begin).toFixed(2) + 's') + '</svg>';
}
