import { Fragment, useState } from 'react';
import AppIcon from './AppIcon';
import { solarToLunar } from '../utils/lunarUtils';

/**
 * Nền "Rừng tiên" (mockup "Nhiệm vụ - Rừng tiên (Elf)"):
 *   fxElf(m)  = rừng ngày (desktop 1440×900 / mobile 390×844) — cây SVG sinh thủ tục + suối + nắng xuyên…
 *   fxCtop    = tiên đốm sáng bay TRÊN nội dung (desktop sáng)
 *   fxN / fxNm = rừng đêm desktop / mobile.
 * Toạ độ mockup đổi sang % của trang (phủ mọi cỡ màn hình); vật nhỏ giữ cỡ px.
 * Số ngẫu nhiên cố định như mockup → không nhảy mỗi lần render.
 */
const px = (v) => `${v}px`;
const pct = (v, s) => `${((v / s) * 100).toFixed(3)}%`;
const seeded = (a, b) => (i) => { const x = Math.sin(i * a + b) * 43758.5453; return x - Math.floor(x); };
const SPARK = 'polygon(50% 0,60% 40%,100% 50%,60% 60%,50% 100%,40% 60%,0 50%,40% 40%)';
const DESK = { W: 1440, H: 900 };
const MOB = { W: 390, H: 844 };

/* ── Mảnh dùng chung ── */
function FallingLeaf({ f, x, d, delay, sw, w, h, radius, clip, bg, shadow, flut }) {
  return (
    <span className="tk-fx-dot" style={{ left: pct(x, f.W), top: '-40px', '--sw': px(sw), '--fall': px(f.H + 100), animation: `tkElfLeafFall ${d}s linear ${delay}s infinite` }}>
      <span style={{ position: 'absolute', left: 0, top: 0, width: px(w), height: px(h), borderRadius: radius, clipPath: clip, background: bg, boxShadow: shadow, animation: `tkElfFlutter ${flut}s ease-in-out infinite alternate` }} />
    </span>
  );
}

function Firefly({ f, x, y, v, d, delay, size, bg, glow, blink, blinkDelay }) {
  return (
    <span className="tk-fx-dot" style={{ left: pct(x, f.W), top: pct(y, f.H), '--x1': px(v[0]), '--y1': px(v[1]), '--x2': px(v[2]), '--y2': px(v[3]), animation: `tkElfWander ${d}s ease-in-out ${delay}s infinite` }}>
      <span style={{ position: 'absolute', left: px(-size / 2), top: px(-size / 2), width: px(size), height: px(size), borderRadius: '50%', background: bg, boxShadow: glow, animation: `tkElfGlowBlink ${blink}s ease-in-out ${blinkDelay}s infinite alternate` }} />
    </span>
  );
}

function Dust({ f, x, y, sz, c, d, delay }) {
  return (
    <span style={{ position: 'absolute', left: pct(x, f.W), top: pct(y, f.H), width: px(sz), height: px(sz), filter: 'drop-shadow(0 0 4px rgba(255,226,140,.95))' }}>
      <span style={{ position: 'absolute', inset: 0, background: c, clipPath: SPARK, WebkitClipPath: SPARK, opacity: 0, animation: `tkElfDust ${d}s ease-in-out ${delay}s infinite` }} />
    </span>
  );
}

const pathVars = (p1, p2, p3) => ({ '--x1': px(p1[0]), '--y1': px(p1[1]), '--x2': px(p2[0]), '--y2': px(p2[1]), '--x3': px(p3[0]), '--y3': px(p3[1]) });

function Butterfly({ f, x, y, col, gl, d, dl, p1, p2, p3, glow = 22, shadow2 = 12 }) {
  return (
    <span className="tk-fx-dot" style={{ left: pct(x, f.W), top: pct(y, f.H), ...pathVars(p1, p2, p3), animation: `tkElfFlyPath ${d}s ease-in-out ${-dl}s infinite` }}>
      <span style={{ position: 'absolute', left: px(-glow), top: px(-glow), width: px(glow * 2), height: px(glow * 2), borderRadius: '50%', background: `radial-gradient(closest-side,rgba(${gl},.55),rgba(${gl},0))` }} />
      <AppIcon
        name="butterfly"
        size={22}
        weight="fill"
        style={{ position: 'absolute', left: '-11px', top: '-11px', color: col, filter: `drop-shadow(0 0 5px rgba(${gl},.95)) drop-shadow(0 0 ${shadow2}px rgba(${gl},.6))`, animation: 'tkElfFlap .3s ease-in-out infinite alternate' }}
      />
    </span>
  );
}

// Tiên của rừng đêm desktop (fxN): vệt 6 chấm + cánh mờ + lõi sáng
const NIGHT_FAIRIES = [[360, 150, 24, 0, [260, -60], [520, 40], [200, 90]], [980, 230, 28, 8, [-240, -90], [-420, 10], [-160, 70]], [640, 90, 32, 15, [200, 60], [-120, 120], [-260, 20]]];
function GlowFairies() {
  return NIGHT_FAIRIES.map(([x, y, d, dl, p1, p2, p3], i) => {
    const vars = pathVars(p1, p2, p3);
    const at = { left: pct(x, DESK.W), top: pct(y, DESK.H), ...vars };
    return (
      <Fragment key={i}>
        {[6, 5, 4, 3, 2, 1].map((t) => (
          <span key={t} className="tk-fx-dot" style={{ ...at, animation: `tkElfFlyPath ${d}s ease-in-out ${(-dl + t * 0.14).toFixed(2)}s infinite` }}>
            <span style={{ position: 'absolute', left: px(-(4 - t * 0.4)), top: px(-(4 - t * 0.4)), width: px(8 - t * 0.8), height: px(8 - t * 0.8), borderRadius: '50%', background: `rgba(255,240,200,${(0.75 - t * 0.1).toFixed(2)})`, boxShadow: `0 0 6px 2px rgba(255,226,150,${(0.6 - t * 0.08).toFixed(2)})` }} />
          </span>
        ))}
        <span className="tk-fx-dot" style={{ ...at, animation: `tkElfFlyPath ${d}s ease-in-out ${-dl}s infinite` }}>
          <span className="tk-fairy__halo" />
          <span className="tk-fairy__wings"><span /><span /></span>
          <span className="tk-fairy__core" />
        </span>
      </Fragment>
    );
  });
}

// Tiên đốm sáng (fairyFx của mockup): vệt 7 chấm + 2 cánh + lõi. Ngày: vàng ấm, cánh trắng viền vàng; đêm: kem nhạt.
const rFy = seeded(19.19, 4.4);
const DAY_FAIRIES = [[540, 70, 30, 0, [260, -30], [440, 60], [180, 110]], [1150, 150, 34, 11, [-240, -70], [-420, -10], [-160, 70]], [200, 872, 40, 20, [260, -6], [520, 4], [300, -10]]];
const DAY_FAIRIES_M = [[80, 170, 26, 0, [160, -40], [250, 50], [90, 110]], [310, 560, 30, 10, [-170, -90], [-240, 30], [-70, 100]]];
const NIGHT_FAIRIES_M = [[90, 200, 24, 0, [150, -50], [240, 40], [70, 100]], [300, 520, 30, 8, [-160, -90], [-230, 20], [-60, 90]]];
function SpriteFairies({ list, night, f }) {
  const tg = night ? '255,226,150' : '236,178,58';
  const hc = night ? '255,236,170' : '255,206,96';
  const wing = { background: night ? 'rgba(220,245,255,.6)' : 'rgba(255,255,255,.92)', border: night ? 'none' : '1px solid rgba(255,232,170,.9)', boxShadow: night ? 'none' : '0 0 6px rgba(255,214,120,.8)' };
  return list.map(([x, y, d, dl, p1, p2, p3], i) => {
    const at = { left: pct(x, f.W), top: pct(y, f.H), ...pathVars(p1, p2, p3) };
    return (
      <Fragment key={i}>
        {[7, 6, 5, 4, 3, 2, 1].map((t) => {
          const sz = 7.5 - t * 0.8;
          return (
            <span key={t} className="tk-fx-dot" style={{ ...at, animation: `tkElfFlyPath ${d}s ease-in-out ${(-dl + t * 0.15).toFixed(2)}s infinite` }}>
              <span style={{ position: 'absolute', left: px(-sz / 2 + (rFy(i * 9 + t) - 0.5) * 5), top: px(-sz / 2 + 3 + (rFy(i * 9 + t + 50) - 0.5) * 5), width: px(sz), height: px(sz), borderRadius: '50%', background: night ? `rgba(255,240,200,${(0.8 - t * 0.1).toFixed(2)})` : `rgba(255,246,214,${(0.95 - t * 0.1).toFixed(2)})`, boxShadow: `0 0 6px 2px rgba(${tg},${(0.7 - t * 0.08).toFixed(2)})` }} />
            </span>
          );
        })}
        <span className="tk-fx-dot" style={{ ...at, animation: `tkElfFlyPath ${d}s ease-in-out ${-dl}s infinite` }}>
          <span style={{ position: 'absolute', left: '-24px', top: '-24px', width: '48px', height: '48px', borderRadius: '50%', background: `radial-gradient(closest-side,rgba(${hc},${night ? 0.6 : 0.7}),rgba(${hc},0))` }} />
          <span className="tk-sprite__wings">
            <span style={{ ...wing, left: 0, transform: 'rotate(-30deg)' }} />
            <span style={{ ...wing, right: 0, transform: 'rotate(30deg)' }} />
          </span>
          <span className="tk-sprite__core" style={{ boxShadow: night ? '0 0 8px 3px rgba(255,236,170,.95),0 0 20px 6px rgba(255,226,150,.5)' : '0 0 8px 3px rgba(255,206,90,.95),0 0 24px 8px rgba(250,190,70,.5)' }} />
        </span>
      </Fragment>
    );
  });
}

/** Tiên đốm sáng bay trên nội dung (fxCtop — desktop sáng). */
export function DayFairiesTop() {
  return <SpriteFairies list={DAY_FAIRIES} f={DESK} />;
}

/* ══ CÂY RỪNG SINH THỦ TỤC (forest(W,H,m) của mockup) ══
   Thân/cành là dải cong quanh một đường xương (limb), tán lá là cụm tròn méo bằng feTurbulence.
   3 lớp ảnh SVG (xa · giữa · gần) làm nền, rêu rủ + nấm phát sáng là SVG động riêng. Tính 1 lần / cỡ. */
const FOREST_CACHE = {};
function buildForest(m) {
  if (FOREST_CACHE[m]) return FOREST_CACHE[m];
  const { W, H } = m ? MOB : DESK;
  const rnd = seeded(91.173, 2.31);
  const AT = { stopColor: 'stop-color', strokeWidth: 'stroke-width', strokeLinecap: 'stroke-linecap' };
  const X = (tag, p, kids) => {
    let s = `<${tag}`;
    for (const k in p) {
      if (k === 'key' || p[k] === undefined || p[k] === null) continue;
      s += ` ${AT[k] || k}="${String(p[k]).replace(/"/g, "'")}"`;
    }
    const ks = kids === undefined ? [] : Array.isArray(kids) ? kids : [kids];
    return `${s}>${ks.flat(9).filter((x) => typeof x === 'string').join('')}</${tag}>`;
  };
  const id = m ? 'M' : 'D', f1 = (v) => String(Math.round(v * 10) / 10), PI = Math.PI, bl = m ? 0.5 : 1, lx = m ? 200 : 620;
  const loop = (pts) => {
    const n = pts.length;
    let d = `M${f1(pts[0][0])} ${f1(pts[0][1])}`;
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      d += `C${f1(p1[0] + (p2[0] - p0[0]) / 6)} ${f1(p1[1] + (p2[1] - p0[1]) / 6)} ${f1(p2[0] - (p3[0] - p1[0]) / 6)} ${f1(p2[1] - (p3[1] - p1[1]) / 6)} ${f1(p2[0])} ${f1(p2[1])}`;
    }
    return `${d}Z`;
  };
  const line = (pts) => {
    let d = `M${f1(pts[0][0])} ${f1(pts[0][1])}`;
    for (let i = 1; i < pts.length - 1; i++) d += `Q${f1(pts[i][0])} ${f1(pts[i][1])} ${f1((pts[i][0] + pts[i + 1][0]) / 2)} ${f1((pts[i][1] + pts[i + 1][1]) / 2)}`;
    const z = pts[pts.length - 1];
    return `${d}L${f1(z[0])} ${f1(z[1])}`;
  };
  const off = (c, h) => [c[0] - Math.sin(c[2]) * h, c[1] + Math.cos(c[2]) * h];
  const limb = (x, y, a, len, w0, w1, bend, sd, flare) => {
    const N = Math.max(8, Math.round(len / 26)), C = [];
    let cx = x, cy = y, q = a;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      C.push([cx, cy, q, t]);
      q += bend / N + Math.sin(t * 6 + sd) * 0.045;
      cx += (Math.cos(q) * len) / N;
      cy += (Math.sin(q) * len) / N;
    }
    const hw = (t) => ((w1 + (w0 - w1) * Math.pow(1 - t, 1.4)) / 2) * (1 + 0.08 * Math.sin(t * 17 + sd * 3)) + (flare ? flare * Math.pow(Math.max(0, 1 - t / 0.16), 2.2) : 0);
    return { C, hw, d: loop([...C.map((c) => off(c, hw(c[3]))), ...C.map((c) => off(c, -hw(c[3]))).reverse()]) };
  };
  const tree = (x, lean, h, w, sd, lv) => {
    const sh = [], fs = [], hl = [], moss = [], tips = [];
    const Tk = limb(x, H + 24, -PI / 2 + lean, h, w, w * 0.34, -lean * 1.2 + (rnd(sd) - 0.5) * 0.25, sd, w * 0.6);
    sh.push(Tk.d);
    for (let r = 0; r < (lv ? 4 : 2); r++) {
      const q = sd * 7 + r, dr = r % 2 ? 1 : -1, ra = 0.22 + rnd(q) * 0.45;
      sh.push(limb(x + dr * w * 0.2, H - w * (0.18 + rnd(q + 3) * 0.25), dr > 0 ? ra : PI - ra, w * (0.9 + rnd(q + 5) * 1.2), w * 0.4, 1.5, dr * (0.35 + rnd(q + 9) * 0.3), q, 0).d);
    }
    for (let b = 0; b < [1, 2, 3][lv]; b++) {
      const q = sd * 13 + b, t = (lv === 2 ? 0.36 : 0.46) + b * (lv === 2 ? 0.13 : 0.16) + rnd(q) * 0.07, p = Tk.C[Math.round(t * (Tk.C.length - 1))], bw = Tk.hw(t) * 1.1;
      const side = lv === 2 ? (x < W / 2 ? 1 : -1) * (b === 1 ? -1 : 1) : ((b + sd) % 2 ? 1 : -1);
      const B = limb(p[0], p[1], p[2] + side * (lv === 2 ? 0.95 + rnd(q + 1) * 0.35 : 0.5 + rnd(q + 1) * 0.35), h * bl * (lv === 2 ? 0.22 + rnd(q + 2) * 0.12 : 0.2 + rnd(q + 2) * 0.14), bw, Math.max(2, bw * 0.2), -side * (lv === 2 ? 0.7 : 0.45) * (0.7 + rnd(q + 3) * 0.6), q, 0);
      sh.push(B.d);
      tips.push(B.C[B.C.length - 1]);
      if (lv) {
        const c = B.C[Math.round((B.C.length - 1) * (0.45 + rnd(q + 4) * 0.2))];
        const Sb = limb(c[0], c[1], c[2] - side * (0.5 + rnd(q + 5) * 0.3), h * 0.1 * bl, bw * 0.38, Math.max(1.5, bw * 0.1), side * 0.3, q + 3, 0);
        sh.push(Sb.d);
        tips.push(Sb.C[Sb.C.length - 1]);
      }
      if (lv === 2) B.C.forEach((c, i) => { if (i > 1 && i % 2 === 0 && c[3] < 0.85) moss.push(off(c, side * B.hw(c[3]) * 0.8)); });
    }
    if (lv) {
      const ls = lx > x ? 1 : -1;
      hl.push(line(Tk.C.filter((c) => c[3] < 0.9).map((c) => off(c, ls * Tk.hw(c[3]) * 0.5))));
      for (let f = 0; f < 5; f++) {
        const o = -0.6 + f * 0.3 + (rnd(sd * 3 + f) - 0.5) * 0.1, t0 = rnd(sd * 5 + f) * 0.35, t1 = Math.min(0.92, t0 + 0.25 + rnd(sd * 11 + f) * 0.4);
        const pts = Tk.C.filter((c) => c[3] >= t0 && c[3] <= t1).map((c, i) => off(c, Tk.hw(c[3]) * o + Math.sin(i * 1.7 + f) * 1.5));
        if (pts.length > 2) fs.push(line(pts));
      }
    }
    return { sh, fs, hl, hw: Tk.hw(0.35), moss, x, w, tips };
  };
  const lob = (n, x0, x1, y0, y1, r0, r1, sd) => Array.from({ length: n }, (_, i) => [x0 + ((i + 0.5 + (rnd(sd + i) - 0.5) * 0.7) / n) * (x1 - x0), y0 + rnd(sd + i + 50) * (y1 - y0), r0 + rnd(sd + i + 90) * (r1 - r0)]);
  const corner = (n, cx, dir, ylo, yhi, r0, r1, sd, span) => Array.from({ length: n }, (_, i) => {
    const u = i / (n - 1);
    return [cx + dir * u * span + (rnd(sd + i) - 0.5) * 30, ylo + (yhi - ylo) * u + (rnd(sd + i + 7) - 0.5) * 30, r1 - (r1 - r0) * u * (0.6 + rnd(sd + i + 3) * 0.4)];
  });
  const S = m ? {
    far: [[60, 0.03, 940, 12], [150, -0.03, 940, 9], [250, 0.04, 940, 11], [335, -0.02, 940, 10]],
    mid: [[34, 0.06, 900, 26], [356, -0.06, 920, 24]],
    near: [[-24, 0.1, 960, 60], [416, -0.11, 960, 56]],
    fc: lob(7, -40, W + 40, -50, 30, 55, 95, 460),
    nc: [...corner(5, -40, 1, 200, -20, 30, 70, 400, 90), ...corner(5, W + 40, -1, 220, -20, 30, 70, 420, 90), ...lob(4, 60, 330, -60, -40, 40, 60, 440)],
  } : {
    far: [[170, 0.03, 1000, 26], [430, -0.04, 1000, 22], [560, 0.03, 1000, 18], [770, -0.02, 1000, 20], [900, 0.04, 1000, 28], [1140, -0.03, 1000, 24], [1320, 0.02, 1000, 20]],
    mid: [[110, 0.07, 980, 64], [340, -0.05, 940, 46], [1020, 0.05, 960, 50], [1250, -0.07, 1000, 70]],
    near: [[-30, 0.1, 1060, 150], [1472, -0.12, 1060, 140]],
    fc: [...lob(15, -80, W + 80, -70, 40, 90, 160, 200), ...lob(4, -60, 260, 80, 200, 70, 120, 240), ...lob(4, 1180, 1500, 60, 200, 70, 120, 260)],
    nc: [...corner(8, -60, 1, 360, -30, 50, 140, 300, 240), ...corner(8, W + 60, -1, 380, -30, 50, 150, 340, 260), ...lob(9, 160, 1300, -95, -55, 60, 100, 380)],
  };
  const C = m
    ? { far: '#94BEA1', farOp: 0.5, fc: '#A9CDB0', fcOp: 0.5, mid: ['#5A876A', '#689376'], midOp: 0.7, near: ['#3C6249', '#47704F'], nearOp: 0.72, nc: ['#8DBA94', '#5E9068'], ncOp: 0.58, rimOp: 0.4, moss: '#7FAE86', fsN: 'rgba(16,40,26,.4)' }
    : { far: '#8DB79B', farOp: 0.55, fc: '#A3C9AA', fcOp: 0.55, mid: ['#4B775C', '#5B8767'], midOp: 0.82, near: ['#21402D', '#2D4E38'], nearOp: 0.95, nc: ['#6FA078', '#3A6A48'], ncOp: 0.8, rimOp: 0.5, moss: '#6E9C70', fsN: 'rgba(6,18,10,.55)' };
  const T0 = S.far.map((t, i) => tree(t[0], t[1], t[2], t[3], 11 + i, 0));
  const T1 = S.mid.map((t, i) => tree(t[0], t[1], t[2], t[3], 31 + i, 1));
  const T2 = S.near.map((t, i) => tree(t[0], t[1], t[2], t[3], 51 + i, 2));
  const clu = (p, r, sd) => Array.from({ length: 4 }, (_, i) => [p[0] + (rnd(sd + i) - 0.5) * r * 1.4, p[1] + (rnd(sd + i + 20) - 0.5) * r * 0.9 - r * 0.15, r * (0.55 + rnd(sd + i + 40) * 0.45)]);
  const midF = T1.flatMap((t, i) => t.tips.flatMap((p, j) => clu(p, (m ? 26 : 58) * (0.8 + rnd(i * 9 + j) * 0.4), 600 + i * 30 + j * 5)));
  const ncAll = [...S.nc, ...T2.flatMap((t, i) => t.tips.flatMap((p, j) => clu(p, (m ? 30 : 66) * (0.8 + rnd(i * 7 + j) * 0.4), 700 + i * 30 + j * 5)))];
  const lit = (L, s) => L.map((c) => [c[0], c[1] - c[2] * 0.22, c[2] * s]);
  const lg = (k, stops, y1, y2) => X('linearGradient', { id: k + id, gradientUnits: 'userSpaceOnUse', x1: 0, y1, x2: 0, y2 }, stops.map(([o, c]) => X('stop', { offset: o, stopColor: c })));
  const flt = (k, fq, sc, b, seed) => X('filter', { id: k + id, x: '-30%', y: '-30%', width: '160%', height: '160%' }, [
    X('feTurbulence', { type: 'fractalNoise', baseFrequency: fq, numOctaves: 3, seed }),
    X('feDisplacementMap', { in: 'SourceGraphic', scale: sc, xChannelSelector: 'R', yChannelSelector: 'G', result: 'dm' }),
    ...(b ? [X('feGaussianBlur', { in: 'dm', stdDeviation: b })] : []),
  ]);
  const blr = (k, v) => X('filter', { id: k + id, x: '-30%', y: '-30%', width: '160%', height: '160%' }, X('feGaussianBlur', { stdDeviation: v }));
  const msk = (k, g) => X('mask', { id: k + id, maskUnits: 'userSpaceOnUse', x: -400, y: -400, width: W + 800, height: H + 800 }, X('rect', { x: -400, y: -400, width: W + 800, height: H + 800, fill: `url(#${g}${id})` }));
  const defs = X('defs', {}, [
    lg('ffg', [[0, '#000'], [1, '#fff']], H * 0.02, H * 0.3), lg('mfg', [[0, '#000'], [1, '#fff']], -H * 0.02, H * 0.2),
    msk('fm', 'ffg'), msk('mm', 'mfg'),
    lg('mdg', [[0, C.mid[0]], [1, C.mid[1]]], 0, H), lg('nrg', [[0, C.near[0]], [1, C.near[1]]], 0, H), lg('ncg', [[0, C.nc[0]], [1, C.nc[1]]], 0, m ? 220 : 380),
    lg('ms1', [[0, 'rgba(238,247,232,0)'], [0.45, 'rgba(238,247,232,.32)'], [1, 'rgba(242,249,236,.8)']], 0, H),
    lg('ms2', [[0, 'rgba(244,250,238,0)'], [0.55, 'rgba(244,250,238,0)'], [1, 'rgba(244,250,238,.45)']], 0, H),
    flt('lf', m ? 0.05 : 0.035, m ? 12 : 22, 1.6, 4), flt('ln', m ? 0.055 : 0.04, m ? 10 : 20, 0.9, 9), flt('lm', m ? 0.055 : 0.04, m ? 10 : 18, 1.8, 13),
    blr('bf', m ? 1.4 : 2.2), blr('bm', 0.6), blr('bh', m ? 2 : 3.5),
  ]);
  const u = (k) => `url(#${k}${id})`;
  const cs = (list, dx = 0, dy = 0) => list.map((c) => X('circle', { cx: f1(c[0] + dx), cy: f1(c[1] + dy), r: f1(c[2]) }));
  const trees = (L, fill, op, fl, mk2, fsC, fsW) => X('g', { fill, opacity: op, filter: fl ? u(fl) : undefined, mask: mk2 ? u(mk2) : undefined }, [
    ...L.flatMap((t) => t.sh.map((d) => X('path', { d }))),
    ...(fsC ? L.flatMap((t) => t.fs.map((d) => X('path', { d, fill: 'none', stroke: fsC, strokeWidth: fsW, strokeLinecap: 'round' }))) : []),
  ]);
  const hls = (L, col, op) => X('g', { fill: 'none', stroke: col, strokeLinecap: 'round', opacity: op, filter: u('bh') }, L.flatMap((t) => t.hl.map((d) => X('path', { d, strokeWidth: f1(t.hw * 0.5) }))));
  const img = (kids) => `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(X('svg', { xmlns: 'http://www.w3.org/2000/svg', width: W, height: H, viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'none' }, kids))}")`;
  const back = img([defs,
    X('g', { fill: C.fc, opacity: C.fcOp, filter: u('lf') }, cs(S.fc)),
    trees(T0, C.far, C.farOp, 'bf', 'fm'),
    X('rect', { x: -400, y: 0, width: W + 800, height: H + 40, fill: u('ms1') })]);
  const mid = img([defs,
    trees(T1, u('mdg'), C.midOp, 'bm', 'mm', 'rgba(28,54,38,.5)', m ? 0.8 : 1.1),
    hls(T1, 'rgba(226,240,190,.9)', 0.4),
    X('g', { fill: '#76A47F', opacity: m ? 0.52 : 0.62, filter: u('lm') }, cs(midF)),
    X('g', { fill: '#D2E8A8', opacity: 0.35, filter: u('bh') }, cs(lit(midF, 0.7))),
    X('rect', { x: -400, y: 0, width: W + 800, height: H + 40, fill: u('ms2') })]);
  const front = img([defs,
    trees(T2, u('nrg'), C.nearOp, null, null, C.fsN, m ? 1.1 : 1.7),
    hls(T2, 'rgba(206,230,160,.9)', 0.35),
    X('g', { fill: '#D4EBA4', opacity: C.rimOp, filter: u('ln') }, cs(ncAll, m ? 3 : 6, m ? 6 : 10)),
    X('g', { fill: u('ncg'), opacity: C.ncOp, filter: u('ln') }, cs(ncAll)),
    X('g', { fill: '#A9D29E', opacity: m ? 0.3 : 0.4, filter: u('bh') }, cs(lit(ncAll, 0.68)))]);
  // Rêu rủ từ cành cây gần + mép tán (đung đưa), nấm phát sáng dưới gốc
  const moss = [];
  const strand = (p, k, len) => {
    const pts = [];
    for (let s2 = 0; s2 <= 6; s2++) pts.push([p[0] + Math.sin(s2 * 1.3 + k) * (m ? 2 : 4), p[1] + (len * s2) / 6]);
    moss.push({ k, d: line(pts), dur: (4 + rnd(k) * 3).toFixed(1), delay: (-rnd(k * 3) * 4).toFixed(1) });
  };
  T2.forEach((t, i) => t.moss.forEach((p, j) => {
    if ((i + j) % 2) return;
    const k = i * 40 + j;
    strand(p, k, (m ? 26 : 50) + rnd(k) * (m ? 50 : 110));
    strand([p[0] + (m ? 4 : 8), p[1] - 2], k + 500, (m ? 16 : 30) + rnd(k + 9) * (m ? 30 : 70));
  }));
  S.nc.forEach((c, i) => {
    if (i % 3 || c[1] + c[2] < 20) return;
    strand([c[0] + (rnd(i + 70) - 0.5) * c[2], c[1] + c[2] * 0.8], 900 + i, (m ? 20 : 40) + rnd(i + 80) * (m ? 50 : 100));
  });
  const shroom = (x, y, s) => ({
    x, y, s, glow: { cx: f1(x), cy: f1(y - s * 0.6), rx: f1(s * 2.8), ry: f1(s * 1.9) },
    dur: (3 + rnd(x) * 3).toFixed(1), delay: (-rnd(x + 1) * 4).toFixed(1),
    caps: [[0, 1], [-s * 1.1, 0.7], [s * 0.95, 0.55]].map(([dx, k2]) => {
      const r = s * k2, cx = x + dx, h2 = s * 1.3 * k2;
      return { stem: { x: f1(cx - r * 0.22), y: f1(y - h2), width: f1(r * 0.44), height: f1(h2), rx: f1(r * 0.2) }, cap: `M${f1(cx - r)} ${f1(y - h2 + 1)}A${f1(r)} ${f1(r * 0.75)} 0 0 1 ${f1(cx + r)} ${f1(y - h2 + 1)}Z` };
    }),
  });
  const shrooms = [
    ...T1.map((t) => shroom(t.x - t.w * 0.7, H - 3, m ? 3 : 5)),
    ...T2.map((t) => shroom(t.x + (t.x < W / 2 ? 1 : -1) * t.w * 0.8, H - 4, m ? 4 : 7)),
  ];
  FOREST_CACHE[m] = { W, H, back, mid, front, moss, shrooms, mossColor: C.moss, mossW: m ? 1.1 : 1.6 };
  return FOREST_CACHE[m];
}

function ForestLive({ F }) {
  return (
    <svg className="tk-forest-anim" viewBox={`0 0 ${F.W} ${F.H}`} preserveAspectRatio="none">
      <defs>
        <radialGradient id={`tkElfShroom${F.W}`}>
          <stop offset="0" stopColor="rgba(150,255,222,.75)" />
          <stop offset="1" stopColor="rgba(150,255,222,0)" />
        </radialGradient>
      </defs>
      <g opacity="0.7">
        {F.moss.map((s) => (
          <path key={s.k} className="tk-forest-moss" d={s.d} stroke={F.mossColor} strokeWidth={F.mossW} style={{ animationDuration: `${s.dur}s`, animationDelay: `${s.delay}s` }} />
        ))}
      </g>
      {F.shrooms.map((h, i) => (
        <g key={i} className="tk-forest-shroom" style={{ animationDuration: `${h.dur}s`, animationDelay: `${h.delay}s` }}>
          <ellipse {...h.glow} fill={`url(#tkElfShroom${F.W})`} />
          {h.caps.map((c, j) => (
            <g key={j}>
              <rect {...c.stem} fill="#EFFFF8" />
              <path d={c.cap} fill="#8EEBCB" />
            </g>
          ))}
        </g>
      ))}
    </svg>
  );
}

/* ══ SƯƠNG MÙ NGẪU NHIÊN (fogBank của mockup) ══
   Một lớp gồm vài mảng sương trôi ngang; cả lớp kéo đến rồi tan theo chu kỳ 38–64s (mỗi lớp nhịp riêng).
   Tan hết (hết 1 vòng) thì xếp lại các mảng ở chỗ ngẫu nhiên → lần sau hiện chỗ khác.
   y0/y1: dải dọc (tỉ lệ khung) · aMax: độ đặc tối đa · sc: hệ số cỡ mảng. */
function FogBank({ m, n, y0, y1, aMax, sc }) {
  const { W, H } = m ? MOB : DESK;
  const place = (w, h) => ({
    left: pct(-w * 0.25 + Math.random() * (W - w * 0.5), W),
    top: pct(y0 * H + Math.random() * (y1 - y0) * H - h / 2, H),
  });
  // Random 1 lần khi mount (không đổi theo mỗi lần render)
  const [fog] = useState(() => {
    const R = Math.random, pw = m ? 300 : 680;
    const patches = Array.from({ length: n }, () => {
      const w = Math.round(pw * sc * (0.7 + R() * 0.7)), h = Math.round(w * (0.24 + R() * 0.12)), a = aMax * (0.65 + R() * 0.35), d = 18 + R() * 16;
      const bg = Array.from({ length: 4 }, (_, j) => `radial-gradient(${Math.round(26 + R() * 16)}% ${Math.round(40 + R() * 18)}% at ${Math.round(16 + j * 22 + R() * 8)}% ${Math.round(42 + R() * 20)}%,rgba(248,253,244,${a.toFixed(2)}),rgba(248,253,244,${(a * 0.4).toFixed(2)}) 38%,rgba(248,253,244,0) 72%)`).join(',');
      return { w, h, bg, pos: place(w, h), dx: (R() > 0.5 ? 1 : -1) * (m ? 50 : 140) * (0.6 + R() * 0.8), d: d.toFixed(1), dl: (-R() * d).toFixed(1) };
    });
    const d = 38 + R() * 26;
    return { patches, d: d.toFixed(1), dl: (-R() * d).toFixed(1) };
  });
  const reshuffle = (e) => {
    if (e.target !== e.currentTarget) return; // bỏ qua vòng drift của từng mảng
    for (const c of e.currentTarget.children) Object.assign(c.style, place(+c.dataset.w, +c.dataset.h));
  };
  return (
    <div className="tk-forest-fog" data-fog="" onAnimationIteration={reshuffle} style={{ animationDuration: `${fog.d}s`, animationDelay: `${fog.dl}s` }}>
      {fog.patches.map((p, i) => (
        <span
          key={i}
          className="tk-forest-fog__patch"
          data-w={p.w}
          data-h={p.h}
          style={{ ...p.pos, width: px(p.w), height: px(p.h), background: p.bg, '--dx': px(p.dx), animationDuration: `${p.d}s`, animationDelay: `${p.dl}s` }}
        />
      ))}
    </div>
  );
}

/* ══ RỪNG NGÀY (fxElf) ══ */
const rD = seeded(12.9898, 7.233);
const STREAM = 'M 596 470 C 588 520, 548 560, 520 610 C 480 680, 420 730, 330 790 C 260 836, 170 870, 80 900 L 760 900 C 700 860, 650 820, 640 770 C 628 700, 640 640, 630 580 C 624 540, 616 500, 612 470 Z';
const BANK = 'M 586 462 C 576 520, 530 560, 498 612 C 452 684, 392 736, 300 796 C 226 840, 130 874, 30 904 L 820 904 C 740 860, 678 820, 666 768 C 652 700, 664 640, 652 578 C 644 536, 632 496, 624 462 Z';
const RIPPLES = ['M 604 490 C 598 540, 572 580, 550 620', 'M 592 640 C 562 690, 522 730, 472 770', 'M 622 700 C 612 760, 562 810, 502 860', 'M 420 800 C 360 840, 300 870, 220 896', 'M 640 800 C 650 840, 640 870, 662 898', 'M 560 836 C 520 868, 470 888, 420 900', 'M 520 760 C 480 800, 430 830, 380 852'];
const GLINTS = [[606, 520], [566, 600], [520, 680], [600, 740], [450, 790], [560, 820], [360, 850], [640, 860], [260, 880]];

function dayScene(m) {
  const f = m ? MOB : DESK, { W, H } = f, k = m ? 0.5 : 1;
  const bc = m ? [200, 300, 170, 260] : [620, 330, 560, 330];
  return {
    f,
    glow: m ? [-90, -40, 560, 640] : [120, -60, 1000, 840],
    sun: m ? [150, -220, 340, 320] : [900, -280, 580, 540],
    bokeh: Array.from({ length: m ? 10 : 24 }, (_, i) => {
      const a = rD(i + 800) * Math.PI * 2, rr = Math.sqrt(rD(i + 810)), sz = (m ? 6 : 10) + rD(i + 820) * (m ? 10 : 18);
      return { x: bc[0] + Math.cos(a) * rr * bc[2] - sz / 2, y: bc[1] + Math.sin(a) * rr * bc[3] - sz / 2, sz, d: (3 + rD(i + 830) * 4).toFixed(1), dl: (-rD(i + 840) * 5).toFixed(1) };
    }),
    shafts: m ? [[170, 90, 22, 0.45, 11, 0], [270, 70, 28, 0.35, 13, 3]] : [[880, 260, 26, 0.5, 11, 0], [1090, 180, 23, 0.4, 13, 3], [690, 150, 29, 0.3, 15, 6], [1250, 120, 20, 0.32, 12, 2]],
    dapples: Array.from({ length: m ? 4 : 11 }, (_, i) => {
      const sz = (60 + rD(i) * 90) * k;
      return { x: 40 + rD(i + 40) * (W - 80), y: 40 + rD(i + 80) * (H - 120), sz, d: (5 + rD(i + 3) * 6).toFixed(1), dl: (-rD(i + 9) * 8).toFixed(1) };
    }),
    mist: m ? [[-160, 560, 560, 160, 40, 50], [-60, 690, 600, 180, -50, 60]] : [[-200, 540, 1000, 200, 60, 50], [500, 670, 1200, 240, -80, 60], [-100, 770, 900, 180, 90, 44]],
    fall: Array.from({ length: m ? 7 : 18 }, (_, i) => {
      const leaf = i % 3 === 0, d = 14 + rD(i + 5) * 10, w = leaf ? 12 + rD(i + 7) * 6 : 9 + rD(i + 7) * 4;
      return {
        x: 20 + rD(i + 11) * (W - 40), d: d.toFixed(1), delay: (-rD(i + 19) * d).toFixed(1), sw: (rD(i + 13) > 0.5 ? 1 : -1) * (60 + rD(i + 17) * 90) * k,
        w, h: leaf ? w * 0.6 : w * 0.8, radius: leaf ? '100% 0' : '50% 50% 50% 50% / 70% 70% 30% 30%',
        clip: leaf ? 'none' : 'polygon(0 0,38% 0,50% 16%,62% 0,100% 0,100% 100%,0 100%)',
        bg: leaf ? (i % 2 ? 'linear-gradient(135deg,#B7E3A8,#4E9F5E)' : 'linear-gradient(135deg,#E9D98A,#8FBF5A)') : (i % 2 ? 'linear-gradient(180deg,#FFE9F0,#F7B3CB)' : 'linear-gradient(180deg,#FFF4F8,#F9C9D9)'),
        shadow: '0 2px 4px rgba(30,70,40,.15)', flut: (1.2 + rD(i + 23)).toFixed(2),
      };
    }),
    flies: Array.from({ length: m ? 7 : 14 }, (_, i) => {
      const r = (q) => (rD(i * 7 + q) - 0.5) * 2;
      return { x: 20 + rD(i + 31) * (W - 40), y: 110 + rD(i + 37) * (H - 160), v: [r(1) * 110 * k, r(2) * 70, r(3) * 110 * k, r(4) * 70], d: (12 + rD(i + 41) * 10).toFixed(1), delay: (-rD(i + 43) * 20).toFixed(1), blink: (1.4 + rD(i + 47) * 1.8).toFixed(2), blinkDelay: (-rD(i + 53) * 3).toFixed(1) };
    }),
    dust: Array.from({ length: m ? 7 : 18 }, (_, i) => ({ sz: 6 + rD(i + 61) * 6, c: ['#E2B53E', '#FFFFFF', '#F6DE8D'][i % 3], x: 20 + rD(i + 67) * (W - 40), y: 20 + rD(i + 71) * (H - 60), d: (3.5 + rD(i + 73) * 4).toFixed(1), delay: (-rD(i + 79) * 6).toFixed(1) })),
    butterflies: m
      ? [[110, 300, '#2EC4B6', '94,234,212', 26, 0, [120, -40], [200, 30], [60, 70]]]
      : [[420, 96, '#2EC4B6', '94,234,212', 26, 0, [180, -40], [360, 30], [150, 70]], [1010, 150, '#E0B23A', '255,214,120', 30, 9, [-200, -50], [-330, 20], [-120, 60]], [150, 330, '#7FB8F0', '147,197,253', 34, 15, [160, -90], [60, -170], [-40, -60]]],
  };
}
const DAY = { false: dayScene(false), true: dayScene(true) };

export function ForestDay({ isMobile }) {
  const m = !!isMobile, s = DAY[m], f = s.f, F = buildForest(m);
  const P = (x) => pct(x, f.W), Q = (y) => pct(y, f.H);
  const still = m ? ' is-still' : ''; // mockup mobile: mảng sáng lớn đứng yên cho nhẹ
  return (
    <>
      <div className={`tk-forest-vignette${m ? ' is-m' : ''}`} />
      <div className="tk-forest-layer" style={{ backgroundImage: F.back }} />
      <span className={`tk-forest-glow${still}`} style={{ left: P(s.glow[0]), top: Q(s.glow[1]), width: P(s.glow[2]), height: Q(s.glow[3]) }} />
      <div className="tk-forest-layer" style={{ backgroundImage: F.mid }} />
      {!m && (
        <svg className="tk-forest-stream" viewBox="0 0 1440 900" preserveAspectRatio="none">
          <defs>
            <linearGradient id="tkElfStream" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="rgba(246,253,236,.95)" />
              <stop offset="0.4" stopColor="rgba(196,236,228,.82)" />
              <stop offset="1" stopColor="rgba(118,194,210,.78)" />
            </linearGradient>
          </defs>
          <path d={BANK} fill="rgba(96,152,96,.38)" style={{ filter: 'blur(6px)' }} />
          <path d={STREAM} fill="url(#tkElfStream)" style={{ filter: 'blur(1.2px)' }} />
          {RIPPLES.map((d, i) => <path key={i} className="tk-forest-ripple" d={d} style={{ animationDuration: `${(2.2 + i * 0.35).toFixed(2)}s` }} />)}
          {GLINTS.map(([x, y], i) => <circle key={i} className="tk-forest-glint" cx={x} cy={y} r="1.8" style={{ animationDuration: `${(1.6 + rD(i + 790)).toFixed(1)}s`, animationDelay: `${(-rD(i + 795) * 2).toFixed(1)}s` }} />)}
        </svg>
      )}
      {/* Sương sau: giữa hàng cây tầng giữa và cây gần · sương trước: mỏng hơn, phủ trước cây gần */}
      <FogBank m={m} n={m ? 3 : 4} y0={0.32} y1={0.82} aMax={0.6} sc={1} />
      <div className="tk-forest-layer" style={{ backgroundImage: F.front }} />
      <ForestLive F={F} />
      <FogBank m={m} n={m ? 2 : 3} y0={0.55} y1={0.96} aMax={0.38} sc={1.2} />
      {s.bokeh.map((b, i) => <span key={`bk${i}`} className="tk-forest-bokeh" style={{ left: P(b.x), top: Q(b.y), width: px(b.sz), height: px(b.sz), animationDuration: `${b.d}s`, animationDelay: `${b.dl}s` }} />)}
      <span className={`tk-forest-sun${still}`} style={{ left: P(s.sun[0]), top: px(s.sun[1]), width: px(s.sun[2]), height: px(s.sun[3]) }} />
      {s.shafts.map(([x, w, r, a, d, dl], i) => (
        <span key={`sh${i}`} className={`tk-forest-shaft${still}`} style={{ left: P(x), width: px(w), height: px(m ? 1100 : 1400), transform: `rotate(${r}deg)`, background: `linear-gradient(90deg,transparent,rgba(255,241,196,${a}),transparent)`, animationDuration: `${d}s`, animationDelay: `${-dl}s` }} />
      ))}
      {s.dapples.map((p, i) => <span key={`dp${i}`} className={`tk-forest-dapple${still}`} style={{ left: P(p.x), top: Q(p.y), width: px(p.sz), height: px(p.sz * 0.7), animationDuration: `${p.d}s`, animationDelay: `${p.dl}s` }} />)}
      {s.mist.map(([x, y, w, h, dx, d], i) => <span key={`ms${i}`} className={`tk-forest-mist${still}`} style={{ left: P(x), top: Q(y), width: P(w), height: px(h), '--dx': px(dx), animationDuration: `${d}s` }} />)}
      {s.fall.map((l, i) => <FallingLeaf key={`lf${i}`} f={f} {...l} />)}
      {s.flies.map((x, i) => <Firefly key={`ff${i}`} f={f} {...x} size={6} bg="#E4F58A" glow="0 0 8px 3px rgba(214,240,110,.9),0 0 22px 8px rgba(190,230,90,.45)" />)}
      {s.dust.map((p, i) => <Dust key={`du${i}`} f={f} {...p} />)}
      {s.butterflies.map(([x, y, col, gl, d, dl, p1, p2, p3], i) => <Butterfly key={`bf${i}`} f={f} x={x} y={y} col={col} gl={gl} d={d} dl={dl} p1={p1} p2={p2} p3={p3} />)}
      {m && <SpriteFairies list={DAY_FAIRIES_M} f={f} />}
    </>
  );
}

/* ══ RỪNG ĐÊM DESKTOP (fxN, phần dưới bầu trời) ══ */
const rN = seeded(78.233, 3.17);
const CANOPY = [[-190, -210, 520, 320, 0.85, 16], [1340, -190, 380, 340, 0.8, 14], [-180, 240, 280, 760, 0.6, 20], [1340, 320, 260, 700, 0.6, 17]];
const NIGHT_MIST = [[-200, 560, 1000, 200, 60, 50], [500, 690, 1200, 230, -80, 60], [-100, 780, 900, 170, 90, 44]];
const SPORES = Array.from({ length: 14 }, (_, i) => {
  const c = i % 3 ? '94,242,194' : '201,184,245';
  return { c, sz: 3 + rN(i + 3) * 3, x: 40 + rN(i + 5) * 1360, y: 620 + rN(i + 7) * 260, dx: (rN(i + 9) - 0.5) * 80, dy: -(220 + rN(i + 11) * 200), d: (10 + rN(i + 13) * 8).toFixed(1), delay: (-rN(i + 15) * 16).toFixed(1) };
});
const NIGHT_FALL = Array.from({ length: 9 }, (_, i) => {
  const leaf = i % 3 !== 2, d = 16 + rN(i + 21) * 10, w = leaf ? 12 + rN(i + 23) * 6 : 9 + rN(i + 23) * 4;
  return {
    x: 60 + rN(i + 25) * 1320, d: d.toFixed(1), delay: (-rN(i + 31) * d).toFixed(1), sw: (rN(i + 27) > 0.5 ? 1 : -1) * (60 + rN(i + 29) * 90),
    w, h: leaf ? w * 0.6 : w * 0.8, radius: leaf ? '100% 0' : '50% 0 50% 50%', clip: 'none',
    bg: leaf ? 'linear-gradient(135deg,rgba(170,255,215,.95),rgba(40,150,100,.85))' : 'linear-gradient(135deg,#F3EEFF,#B9A6EE)',
    shadow: leaf ? '0 0 10px rgba(94,242,194,.6)' : '0 0 10px rgba(201,184,245,.7)', flut: (1.2 + rN(i + 33)).toFixed(2),
  };
});
const NIGHT_FLIES = Array.from({ length: 26 }, (_, i) => {
  const q = (k) => (rN(i * 7 + k + 100) - 0.5) * 2, mint = i % 4 === 0, g = mint ? '94,242,194' : '210,255,120';
  return {
    x: 30 + rN(i + 131) * 1380, y: 90 + rN(i + 137) * 780, v: [q(1) * 120, q(2) * 80, q(3) * 120, q(4) * 80],
    d: (12 + rN(i + 141) * 12).toFixed(1), delay: (-rN(i + 143) * 20).toFixed(1), bg: mint ? '#C8FFEA' : '#F2FFB8',
    glow: `0 0 8px 3px rgba(${g},.9),0 0 24px 8px rgba(${g},.4)`, blink: (1.4 + rN(i + 147) * 2).toFixed(2), blinkDelay: (-rN(i + 153) * 3).toFixed(1),
  };
});
const NIGHT_DUST = Array.from({ length: 16 }, (_, i) => ({ sz: 5 + rN(i + 161) * 6, c: ['#FFF6D8', '#E3C27A', '#D9FFF0'][i % 3], x: 30 + rN(i + 167) * 1380, y: 20 + rN(i + 171) * 840, d: (3.5 + rN(i + 173) * 4).toFixed(1), delay: (-rN(i + 179) * 6).toFixed(1) }));
const NIGHT_BUTTERFLIES = [[200, 380, '#5EF2C2', '94,234,212', 30, 4, [180, -120], [380, -40], [160, 60]], [1150, 420, '#C9B8F5', '201,184,245', 34, 12, [-180, -100], [-340, 0], [-120, 80]]];

export function ForestNight() {
  const f = DESK, P = (x) => pct(x, f.W), Q = (y) => pct(y, f.H);
  return (
    <>
      {CANOPY.map(([x, y, w, h, a, d], i) => (
        <span key={`cn${i}`} className="tk-forest-canopy" style={{ left: P(x), top: Q(y), width: px(w), height: px(h), background: `radial-gradient(closest-side,rgba(1,8,5,${a}),rgba(1,8,5,0))`, animationDuration: `${d}s` }} />
      ))}
      {NIGHT_MIST.map(([x, y, w, h, dx, d], i) => <span key={`ms${i}`} className="tk-forest-mist is-night" style={{ left: P(x), top: Q(y), width: P(w), height: px(h), '--dx': px(dx), animationDuration: `${d}s` }} />)}
      {SPORES.map((s, i) => (
        <span key={`sp${i}`} className="tk-forest-spore" style={{ left: P(s.x), top: Q(s.y), width: px(s.sz), height: px(s.sz), background: `rgba(${s.c},1)`, boxShadow: `0 0 8px 2px rgba(${s.c},.7)`, '--dx': px(s.dx), '--dy': px(s.dy), animationDuration: `${s.d}s`, animationDelay: `${s.delay}s` }} />
      ))}
      {NIGHT_FALL.map((l, i) => <FallingLeaf key={`lf${i}`} f={f} {...l} />)}
      {NIGHT_FLIES.map((x, i) => <Firefly key={`ff${i}`} f={f} {...x} size={5} />)}
      {NIGHT_DUST.map((p, i) => <Dust key={`du${i}`} f={f} {...p} />)}
      <GlowFairies />
      {NIGHT_BUTTERFLIES.map(([x, y, col, gl, d, dl, p1, p2, p3], i) => <Butterfly key={`bf${i}`} f={f} x={x} y={y} col={col} gl={gl} d={d} dl={dl} p1={p1} p2={p2} p3={p3} glow={24} shadow2={14} />)}
      <span className="tk-forest-floorglow" />
    </>
  );
}

/* ══ CHÒM SAO (dùng chung Mặc định / Rừng tiên) ══ */
// Chòm sao: [tên, điểm, nối]
const CONS = [
  ['Bắc Đẩu', [[0, 30], [40, 26], [72, 34], [100, 46], [110, 80], [150, 84], [160, 52]], [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]]],
  ['Thiên Hậu', [[0, 10], [30, 40], [60, 18], [92, 44], [120, 8]], [[0, 1], [1, 2], [2, 3], [3, 4]]],
  ['Lạp Hộ', [[14, 20], [76, 26], [34, 70], [46, 66], [58, 62], [24, 118], [84, 112], [46, 0]], [[0, 2], [1, 4], [2, 3], [3, 4], [2, 5], [4, 6], [0, 7], [1, 7]]],
  ['Thiên Yết', [[10, 10], [22, 20], [34, 34], [42, 54], [46, 74], [56, 92], [74, 102], [96, 100], [106, 86], [100, 74], [0, 0], [24, 0]], [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [0, 10], [0, 11]]],
  ['Sư Tử', [[14, 30], [30, 10], [54, 8], [64, 30], [52, 56], [120, 48], [150, 66], [112, 78]], [[0, 1], [1, 2], [2, 3], [3, 4], [4, 7], [7, 6], [6, 5], [5, 3]]],
  ['Thiên Nga', [[60, 0], [60, 46], [60, 96], [60, 136], [8, 30], [112, 64]], [[0, 1], [1, 2], [2, 3], [4, 1], [1, 5]]],
];

// Mỗi lượt hiện, chòm sao nhảy tới chỗ ngẫu nhiên: desktop dải trời phải (~0.4), mobile góc trái dưới trăng
// (~0.32, không tên; data-r = bề rộng dải ngẫu nhiên: Mặc định 190, Rừng tiên 130)
function placeConstellation(el) {
  const m = el.dataset.m === '1';
  const svg = el.firstChild;
  const sc = Math.min((m ? 0.32 : 0.4) + Math.random() * 0.06, (m ? 44 : 54) / ((svg && +svg.getAttribute('height')) || 120));
  el.style.left = px((m ? 16 + Math.random() * (+el.dataset.r || 190) : 676 + Math.random() * 440).toFixed(0));
  el.style.top = px((m ? 56 + Math.random() * 24 : 4 + Math.random() * 6).toFixed(0));
  el.style.transform = `scale(${sc.toFixed(2)}) rotate(${((Math.random() - 0.5) * 20).toFixed(0)}deg)`;
  if (!m) el.lastChild.style.fontSize = px((11 / sc).toFixed(1)); // giữ chữ tên ~11px sau khi thu nhỏ
}
const placeOnce = (el) => { if (el && !el.dataset.placed) { el.dataset.placed = '1'; placeConstellation(el); } };

export function Constellations({ m, range = 190 }) {
  return CONS.map(([name, P, lines], i) => {
    const w = Math.max(...P.map((p) => p[0])) + 10;
    const h = Math.max(...P.map((p) => p[1])) + 10;
    const delay = `${-150 + i * 25 + 6}s`;
    return (
      <span
        key={name}
        ref={placeOnce}
        data-m={m ? '1' : '0'}
        data-r={range}
        className="task-cons"
        style={{ width: px(w), height: px(h + 20), animationDelay: delay }}
        onAnimationIteration={(e) => { if (e.target === e.currentTarget) placeConstellation(e.currentTarget); }}
      >
        <svg width={w} height={h} viewBox={`-5 -5 ${w} ${h}`}>
          <path
            d={lines.map(([a, b]) => `M${P[a][0]} ${P[a][1]}L${P[b][0]} ${P[b][1]}`).join('')}
            pathLength={1}
            style={{ animationDelay: delay }}
          />
          {P.map(([x, y], k) => <circle key={k} cx={x} cy={y} r={k % 3 === 0 ? 2.2 : 1.6} />)}
        </svg>
        {!m && <span className="task-cons__name" style={{ left: px(w + 8), top: px(Math.round(h * 0.3)) }}>{name}</span>}
      </span>
    );
  });
}

/* ══ RỪNG ĐÊM MOBILE (fxNm): sao 3 lớp, trăng nhỏ, 2 sao băng, tán tối, đom đóm, tiên ══ */
const rM = seeded(33.71, 1.9);
const NM = (() => {
  const { W, H } = MOB;
  return {
    canopy: [[-150, -130, 380, 280, 0.85], [W - 200, -150, 340, 300, 0.8], [-170, 320, 230, 560, 0.55], [W - 80, 400, 210, 520, 0.55]],
    mist: [[-120, 600, 520, 160], [-60, 720, 560, 160]],
    spores: Array.from({ length: 8 }, (_, i) => {
      const c = i % 3 ? '94,242,194' : '201,184,245';
      return { c, sz: 3 + rM(i + 3) * 3, x: 20 + rM(i + 5) * (W - 40), y: 600 + rM(i + 7) * 220, dx: (rM(i + 9) - 0.5) * 60, dy: -(200 + rM(i + 11) * 180), d: (10 + rM(i + 13) * 8).toFixed(1), delay: (-rM(i + 15) * 16).toFixed(1) };
    }),
    fall: Array.from({ length: 4 }, (_, i) => {
      const d = 16 + rM(i + 21) * 10, w = 11 + rM(i + 23) * 5;
      return { x: 30 + rM(i + 25) * (W - 60), d: d.toFixed(1), delay: (-rM(i + 31) * d).toFixed(1), sw: (rM(i + 27) > 0.5 ? 1 : -1) * (30 + rM(i + 29) * 50), w, h: w * 0.6, radius: '100% 0', clip: 'none', bg: 'linear-gradient(135deg,rgba(170,255,215,.95),rgba(40,150,100,.85))', shadow: '0 0 10px rgba(94,242,194,.6)', flut: (1.2 + rM(i + 33)).toFixed(2) };
    }),
    flies: Array.from({ length: 14 }, (_, i) => {
      const q = (k) => (rM(i * 7 + k + 100) - 0.5) * 2, mint = i % 4 === 0, g = mint ? '94,242,194' : '210,255,120';
      return { x: 20 + rM(i + 131) * (W - 40), y: 110 + rM(i + 137) * (H - 160), v: [q(1) * 60, q(2) * 70, q(3) * 60, q(4) * 70], d: (12 + rM(i + 141) * 12).toFixed(1), delay: (-rM(i + 143) * 20).toFixed(1), bg: mint ? '#C8FFEA' : '#F2FFB8', glow: `0 0 8px 3px rgba(${g},.9),0 0 24px 8px rgba(${g},.4)`, blink: (1.4 + rM(i + 147) * 2).toFixed(2), blinkDelay: (-rM(i + 153) * 3).toFixed(1) };
    }),
    dust: Array.from({ length: 8 }, (_, i) => ({ sz: 5 + rM(i + 161) * 6, c: ['#FFF6D8', '#E3C27A', '#D9FFF0'][i % 3], x: 20 + rM(i + 167) * (W - 40), y: 20 + rM(i + 171) * (H - 60), d: (3.5 + rM(i + 173) * 4).toFixed(1), delay: (-rM(i + 179) * 6).toFixed(1) })),
  };
})();

// Sao sáng của rừng đêm mobile: [x khung desktop, y, cỡ, thời lượng] — x co ×0.27 về khung 390
const NM_BRIGHT = [[430, 12, 22, 5], [880, 66, 16, 4.8], [300, 10, 14, 5.6], [700, 104, 14, 5.2], [130, 112, 14, 6.2], [360, 92, 12, 5.8]];

function MobileMoon() {
  const t = new Date();
  const lday = solarToLunar(t.getDate(), t.getMonth() + 1, t.getFullYear()).day;
  const ph = ((lday - 0.5) / 29.530589) * 2 * Math.PI, lit = (1 - Math.cos(ph)) / 2, wax = ph < Math.PI;
  const D = 44, R = D / 2, MX = 302, MY = 56, tw = Math.abs(Math.cos(ph)) * D;
  const ts = wax ? (lit < 0.5 ? 0 : 1) : (lit < 0.5 ? 1 : 0);
  const clip = `path('M${R} 0 A${R} ${R} 0 0 ${wax ? 1 : 0} ${R} ${D} A${(tw / 2).toFixed(2)} ${R} 0 0 ${ts} ${R} 0 Z')`;
  return (
    <>
      <span className="tk-mmoon-halo" style={{ left: pct(MX + R - 150, MOB.W), top: px(MY + R - 150), background: `radial-gradient(closest-side,rgba(210,236,222,${(0.05 + 0.2 * lit).toFixed(3)}),rgba(210,236,222,0))` }} />
      <span className="tk-mmoon" style={{ left: pct(MX, MOB.W), top: px(MY), width: px(D), height: px(D) }}>
        <span style={{ position: 'absolute', inset: 0, filter: `drop-shadow(0 0 ${(3 + 10 * lit).toFixed(0)}px rgba(240,248,230,${(0.35 + 0.45 * lit).toFixed(2)}))` }}>
          <span className="tk-mmoon__disc" style={{ clipPath: clip, WebkitClipPath: clip }} />
        </span>
      </span>
    </>
  );
}

export function ForestNightMobile() {
  const f = MOB, P = (x) => pct(x, f.W), Q = (y) => pct(y, f.H);
  return (
    <>
      {[0, 1, 2].map((i) => <div key={i} className={`tk-mstars tk-mstars--${i}`} />)}
      <MobileMoon />
      <div className="task-milkyway" style={{ top: '-90px' }} />
      <div className="task-milkyway task-milkyway--dust" style={{ top: '-90px', opacity: 0.8 }} />
      <div className="tk-mstars tk-mstars--3" />
      {NM_BRIGHT.map(([x, y, s, d], i) => (
        <span key={`bs${i}`} className="task-bright-star" style={{ left: pct(x * 0.27 - s / 2, MOB.W), top: px(y - s / 2), width: px(s), height: px(s), animationDuration: `${d}s`, animationDelay: `${(-i * 1.3).toFixed(1)}s` }} />
      ))}
      <Constellations m range={130} />
      <div className="task-shooting-star" style={{ top: '70px', left: '84.6%', width: '110px', animation: 'taskShoot 11s linear 2s infinite' }} />
      <div className="task-shooting-star" style={{ top: '26px', left: '56.4%', width: '90px', animation: 'taskShoot 15s linear 7s infinite' }} />
      {NM.canopy.map(([x, y, w, h, a], i) => (
        <span key={`cn${i}`} className="tk-forest-canopy is-still" style={{ left: P(x), top: Q(y), width: px(w), height: px(h), background: `radial-gradient(closest-side,rgba(1,8,5,${a}),rgba(1,8,5,0))` }} />
      ))}
      {NM.mist.map(([x, y, w, h], i) => <span key={`ms${i}`} className="tk-forest-mist is-night is-still" style={{ left: P(x), top: Q(y), width: px(w), height: px(h) }} />)}
      {NM.spores.map((s, i) => (
        <span key={`sp${i}`} className="tk-forest-spore" style={{ left: P(s.x), top: Q(s.y), width: px(s.sz), height: px(s.sz), background: `rgba(${s.c},1)`, boxShadow: `0 0 8px 2px rgba(${s.c},.7)`, '--dx': px(s.dx), '--dy': px(s.dy), animationDuration: `${s.d}s`, animationDelay: `${s.delay}s` }} />
      ))}
      {NM.fall.map((l, i) => <FallingLeaf key={`lf${i}`} f={f} {...l} />)}
      {NM.flies.map((x, i) => <Firefly key={`ff${i}`} f={f} {...x} size={5} />)}
      {NM.dust.map((p, i) => <Dust key={`du${i}`} f={f} {...p} />)}
      <SpriteFairies list={NIGHT_FAIRIES_M} night f={f} />
    </>
  );
}
