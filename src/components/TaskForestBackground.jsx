import { Fragment } from 'react';
import AppIcon from './AppIcon';

/**
 * Nền "Rừng tiên" (mockup "Nhiệm vụ - Rừng tiên (Elf)": fxElf = rừng ngày, fxN = rừng đêm).
 * Toạ độ mockup theo khung 1440×900 → đổi sang % của trang để phủ mọi cỡ màn hình;
 * vật nhỏ (lá, đom đóm, bụi tiên) giữ cỡ px. Số ngẫu nhiên cố định như mockup → không nhảy mỗi lần render.
 * Bản sáng dùng tiên phát sáng của bản tối (bỏ tiên có cánh của mockup sáng — theo yêu cầu).
 */
const P = (x) => `${((x / 1440) * 100).toFixed(3)}%`;
const Q = (y) => `${((y / 900) * 100).toFixed(3)}%`;
const px = (v) => `${v}px`;
const seeded = (a, b) => (i) => { const x = Math.sin(i * a + b) * 43758.5453; return x - Math.floor(x); };
const SPARK = 'polygon(50% 0,60% 40%,100% 50%,60% 60%,50% 100%,40% 60%,0 50%,40% 40%)';

/* ── Mảnh dùng chung ngày/đêm ── */
function FallingLeaf({ x, d, delay, sw, w, h, radius, clip, bg, shadow, flut }) {
  return (
    <span className="tk-fx-dot" style={{ left: P(x), top: '-40px', '--sw': px(sw), animation: `tkElfLeafFall ${d}s linear ${delay}s infinite` }}>
      <span style={{ position: 'absolute', left: 0, top: 0, width: px(w), height: px(h), borderRadius: radius, clipPath: clip, background: bg, boxShadow: shadow, animation: `tkElfFlutter ${flut}s ease-in-out infinite alternate` }} />
    </span>
  );
}

function Firefly({ x, y, v, d, delay, size, bg, glow, blink, blinkDelay }) {
  return (
    <span className="tk-fx-dot" style={{ left: P(x), top: Q(y), '--x1': px(v[0]), '--y1': px(v[1]), '--x2': px(v[2]), '--y2': px(v[3]), animation: `tkElfWander ${d}s ease-in-out ${delay}s infinite` }}>
      <span style={{ position: 'absolute', left: px(-size / 2), top: px(-size / 2), width: px(size), height: px(size), borderRadius: '50%', background: bg, boxShadow: glow, animation: `tkElfGlowBlink ${blink}s ease-in-out ${blinkDelay}s infinite alternate` }} />
    </span>
  );
}

function Dust({ x, y, sz, c, d, delay }) {
  return (
    <span style={{ position: 'absolute', left: P(x), top: Q(y), width: px(sz), height: px(sz), filter: 'drop-shadow(0 0 4px rgba(255,226,140,.95))' }}>
      <span style={{ position: 'absolute', inset: 0, background: c, clipPath: SPARK, WebkitClipPath: SPARK, opacity: 0, animation: `tkElfDust ${d}s ease-in-out ${delay}s infinite` }} />
    </span>
  );
}

const pathVars = (p1, p2, p3) => ({ '--x1': px(p1[0]), '--y1': px(p1[1]), '--x2': px(p2[0]), '--y2': px(p2[1]), '--x3': px(p3[0]), '--y3': px(p3[1]) });

function Butterfly({ x, y, col, gl, d, dl, p1, p2, p3, glow = 22, shadow2 = 12 }) {
  return (
    <span className="tk-fx-dot" style={{ left: P(x), top: Q(y), ...pathVars(p1, p2, p3), animation: `tkElfFlyPath ${d}s ease-in-out ${-dl}s infinite` }}>
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

// Tiên phát sáng (fxN): vệt bụi sáng 6 chấm đuổi theo + cánh mờ vỗ nhanh + lõi sáng
const FAIRIES = [[360, 150, 24, 0, [260, -60], [520, 40], [200, 90]], [980, 230, 28, 8, [-240, -90], [-420, 10], [-160, 70]], [640, 90, 32, 15, [200, 60], [-120, 120], [-260, 20]]];
function GlowFairies() {
  return FAIRIES.map(([x, y, d, dl, p1, p2, p3], i) => {
    const vars = pathVars(p1, p2, p3);
    return (
      <Fragment key={i}>
        {[6, 5, 4, 3, 2, 1].map((t) => (
          <span key={t} className="tk-fx-dot" style={{ left: P(x), top: Q(y), ...vars, animation: `tkElfFlyPath ${d}s ease-in-out ${(-dl + t * 0.14).toFixed(2)}s infinite` }}>
            <span style={{ position: 'absolute', left: px(-(4 - t * 0.4)), top: px(-(4 - t * 0.4)), width: px(8 - t * 0.8), height: px(8 - t * 0.8), borderRadius: '50%', background: `rgba(255,240,200,${(0.75 - t * 0.1).toFixed(2)})`, boxShadow: `0 0 6px 2px rgba(255,226,150,${(0.6 - t * 0.08).toFixed(2)})` }} />
          </span>
        ))}
        <span className="tk-fx-dot" style={{ left: P(x), top: Q(y), ...vars, animation: `tkElfFlyPath ${d}s ease-in-out ${-dl}s infinite` }}>
          <span className="tk-fairy__halo" />
          <span className="tk-fairy__wings"><span /><span /></span>
          <span className="tk-fairy__core" />
        </span>
      </Fragment>
    );
  });
}

/* ══ RỪNG NGÀY (fxElf) ══ */
const rD = seeded(12.9898, 7.233);
const FAR_TRUNKS = Array.from({ length: 16 }, (_, i) => [-20 + i * 95 + rD(i + 600) * 40, 12 + rD(i + 610) * 18]);
const MID_TRUNKS = [[40, 48, 1], [210, 38, 1], [360, 28, 1], [880, 30, -1], [1010, 44, -1], [1170, 54, -1], [1300, 36, -1]];
const NEAR_TRUNKS = [[-70, 140, 1], [1366, 124, -1]];
const BRANCHES = [[248, 150, 220, -26], [1046, 130, 230, 22], [70, 300, 190, -16], [1236, 320, 200, 18], [392, 90, 150, -34], [908, 96, 150, 30]];
const FOLIAGE = [[-80, -90, 520, 240], [300, -120, 460, 220], [700, -130, 420, 200], [1000, -110, 520, 240], [1240, -60, 360, 260], [-120, 760, 520, 220], [360, 820, 520, 160], [860, 800, 620, 200], [1160, 740, 420, 240]];
const LEAF_C = ['rgba(64,132,84,.5)', 'rgba(118,178,98,.5)', 'rgba(198,224,104,.6)', 'rgba(244,238,132,.66)'];
const LEAVES = Array.from({ length: 200 }, (_, i) => {
  const top = rD(i + 700) < 0.68, w = 8 + rD(i + 740) * 11;
  return { x: -20 + rD(i + 710) * 1480, y: top ? rD(i + 720) * 240 - 10 : 770 + rD(i + 730) * 140, w, h: w * (0.5 + rD(i + 750) * 0.3), r: Math.round(rD(i + 760) * 180), c: LEAF_C[i % 4] };
});
const STREAM = 'M 596 470 C 588 520, 548 560, 520 610 C 480 680, 420 730, 330 790 C 260 836, 170 870, 80 900 L 760 900 C 700 860, 650 820, 640 770 C 628 700, 640 640, 630 580 C 624 540, 616 500, 612 470 Z';
const BANK = 'M 586 462 C 576 520, 530 560, 498 612 C 452 684, 392 736, 300 796 C 226 840, 130 874, 30 904 L 820 904 C 740 860, 678 820, 666 768 C 652 700, 664 640, 652 578 C 644 536, 632 496, 624 462 Z';
const RIPPLES = ['M 604 490 C 598 540, 572 580, 550 620', 'M 592 640 C 562 690, 522 730, 472 770', 'M 622 700 C 612 760, 562 810, 502 860', 'M 420 800 C 360 840, 300 870, 220 896', 'M 640 800 C 650 840, 640 870, 662 898', 'M 560 836 C 520 868, 470 888, 420 900', 'M 520 760 C 480 800, 430 830, 380 852'];
const GLINTS = [[606, 520], [566, 600], [520, 680], [600, 740], [450, 790], [560, 820], [360, 850], [640, 860], [260, 880]];
const BOKEH = Array.from({ length: 70 }, (_, i) => {
  const a = rD(i + 800) * Math.PI * 2, rr = Math.sqrt(rD(i + 810));
  return { x: 620 + Math.cos(a) * rr * 560, y: 330 + Math.sin(a) * rr * 330, sz: 3 + rD(i + 820) * 4, c: ['#F7F3A0', '#FFFDE2', '#DDF59A'][i % 3], d: (2.5 + rD(i + 830) * 3).toFixed(1), dl: (-rD(i + 840) * 4).toFixed(1) };
});
const SHAFTS = [[880, 260, 26, 0.5, 11, 0], [1090, 180, 23, 0.4, 13, 3], [690, 150, 29, 0.3, 15, 6], [1250, 120, 20, 0.32, 12, 2]];
const DAPPLES = Array.from({ length: 11 }, (_, i) => ({ sz: 60 + rD(i) * 90, x: 80 + rD(i + 40) * 1280, y: 40 + rD(i + 80) * 780, d: (5 + rD(i + 3) * 6).toFixed(1), dl: (-rD(i + 9) * 8).toFixed(1) }));
const DAY_MIST = [[-200, 540, 1000, 200, 60, 50], [500, 670, 1200, 240, -80, 60], [-100, 770, 900, 180, 90, 44]];
const DAY_FALL = Array.from({ length: 18 }, (_, i) => {
  const leaf = i % 3 === 0, d = 14 + rD(i + 5) * 10, w = leaf ? 12 + rD(i + 7) * 6 : 9 + rD(i + 7) * 4;
  return {
    x: 60 + rD(i + 11) * 1320, d: d.toFixed(1), delay: (-rD(i + 19) * d).toFixed(1), sw: (rD(i + 13) > 0.5 ? 1 : -1) * (60 + rD(i + 17) * 90),
    w, h: leaf ? w * 0.6 : w * 0.8, radius: leaf ? '100% 0' : '50% 50% 50% 50% / 70% 70% 30% 30%',
    clip: leaf ? 'none' : 'polygon(0 0,38% 0,50% 16%,62% 0,100% 0,100% 100%,0 100%)',
    bg: leaf ? (i % 2 ? 'linear-gradient(135deg,#B7E3A8,#4E9F5E)' : 'linear-gradient(135deg,#E9D98A,#8FBF5A)') : (i % 2 ? 'linear-gradient(180deg,#FFE9F0,#F7B3CB)' : 'linear-gradient(180deg,#FFF4F8,#F9C9D9)'),
    shadow: '0 2px 4px rgba(30,70,40,.15)', flut: (1.2 + rD(i + 23)).toFixed(2),
  };
});
const DAY_FLIES = Array.from({ length: 14 }, (_, i) => {
  const r = (k) => (rD(i * 7 + k) - 0.5) * 2;
  return { x: 40 + rD(i + 31) * 1360, y: 110 + rD(i + 37) * 740, v: [r(1) * 110, r(2) * 70, r(3) * 110, r(4) * 70], d: (12 + rD(i + 41) * 10).toFixed(1), delay: (-rD(i + 43) * 20).toFixed(1), blink: (1.4 + rD(i + 47) * 1.8).toFixed(2), blinkDelay: (-rD(i + 53) * 3).toFixed(1) };
});
const DAY_DUST = Array.from({ length: 18 }, (_, i) => ({ sz: 6 + rD(i + 61) * 6, c: ['#E2B53E', '#FFFFFF', '#F6DE8D'][i % 3], x: 30 + rD(i + 67) * 1380, y: 20 + rD(i + 71) * 840, d: (3.5 + rD(i + 73) * 4).toFixed(1), delay: (-rD(i + 79) * 6).toFixed(1) }));
const DAY_BUTTERFLIES = [[420, 96, '#2EC4B6', '94,234,212', 26, 0, [180, -40], [360, 30], [150, 70]], [1010, 150, '#E0B23A', '255,214,120', 30, 9, [-200, -50], [-330, 20], [-120, 60]], [150, 330, '#7FB8F0', '147,197,253', 34, 15, [160, -90], [60, -170], [-40, -60]]];

export function ForestDay() {
  return (
    <>
      <div className="tk-forest-vignette" />
      {FAR_TRUNKS.map(([x, w], i) => <span key={`ft${i}`} className="tk-forest-far" style={{ left: P(x), width: px(w) }} />)}
      <span className="tk-forest-glow" />
      {MID_TRUNKS.map(([x, w, f], i) => (
        <Fragment key={`mt${i}`}>
          <span className="tk-forest-root" style={{ left: P(x - w * 0.6), width: px(w * 2.2) }} />
          <span className="tk-forest-mid" style={{ left: P(x), width: px(w), background: `linear-gradient(${f > 0 ? 90 : 270}deg,rgba(46,96,70,.66),rgba(74,126,90,.54) 58%,rgba(222,232,150,.5))` }} />
        </Fragment>
      ))}
      {NEAR_TRUNKS.map(([x, w, f], i) => <span key={`nt${i}`} className="tk-forest-near" style={{ left: P(x), width: px(w), background: `linear-gradient(${f > 0 ? 90 : 270}deg,rgba(26,66,46,.72),rgba(44,96,66,.6) 70%,rgba(190,220,140,.45))` }} />)}
      {BRANCHES.map(([x, y, l, r], i) => (
        <span key={`br${i}`} className="tk-forest-branch" style={{ left: P(x), top: Q(y), width: px(l), transformOrigin: `${r < 0 ? '0' : '100%'} 50%`, transform: `translateX(${r < 0 ? 0 : -l}px) rotate(${r}deg)` }} />
      ))}
      {FOLIAGE.map(([x, y, w, h], i) => <span key={`fo${i}`} className="tk-forest-foliage" style={{ left: P(x), top: Q(y), width: P(w), height: px(h), animationDuration: `${14 + i}s` }} />)}
      {LEAVES.map((l, i) => <span key={`lv${i}`} className="tk-forest-leaf" style={{ left: P(l.x), top: Q(l.y), width: px(l.w), height: px(l.h), transform: `rotate(${l.r}deg)`, background: l.c }} />)}
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
      {BOKEH.map((b, i) => <span key={`bk${i}`} className="tk-forest-bokeh" style={{ left: P(b.x), top: Q(b.y), width: px(b.sz), height: px(b.sz), background: b.c, animationDuration: `${b.d}s`, animationDelay: `${b.dl}s` }} />)}
      <span className="tk-forest-sun" />
      {SHAFTS.map(([x, w, r, a, d, dl], i) => (
        <span key={`sh${i}`} className="tk-forest-shaft" style={{ left: P(x), width: px(w), transform: `rotate(${r}deg)`, background: `linear-gradient(90deg,transparent,rgba(255,241,196,${a}),transparent)`, animationDuration: `${d}s`, animationDelay: `${-dl}s` }} />
      ))}
      {DAPPLES.map((p, i) => <span key={`dp${i}`} className="tk-forest-dapple" style={{ left: P(p.x), top: Q(p.y), width: px(p.sz), height: px(p.sz * 0.7), animationDuration: `${p.d}s`, animationDelay: `${p.dl}s` }} />)}
      {DAY_MIST.map(([x, y, w, h, dx, d], i) => <span key={`ms${i}`} className="tk-forest-mist" style={{ left: P(x), top: Q(y), width: P(w), height: px(h), '--dx': px(dx), animationDuration: `${d}s` }} />)}
      {DAY_FALL.map((l, i) => <FallingLeaf key={`lf${i}`} {...l} />)}
      {DAY_FLIES.map((f, i) => <Firefly key={`ff${i}`} {...f} size={6} bg="#E4F58A" glow="0 0 8px 3px rgba(214,240,110,.9),0 0 22px 8px rgba(190,230,90,.45)" />)}
      {DAY_DUST.map((p, i) => <Dust key={`du${i}`} {...p} />)}
      {DAY_BUTTERFLIES.map(([x, y, col, gl, d, dl, p1, p2, p3], i) => <Butterfly key={`bf${i}`} x={x} y={y} col={col} gl={gl} d={d} dl={dl} p1={p1} p2={p2} p3={p3} />)}
      <GlowFairies />
    </>
  );
}

/* ══ RỪNG ĐÊM (fxN, phần dưới bầu trời) ══ */
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
  return (
    <>
      {CANOPY.map(([x, y, w, h, a, d], i) => (
        <span key={`cn${i}`} className="tk-forest-canopy" style={{ left: P(x), top: Q(y), width: px(w), height: px(h), background: `radial-gradient(closest-side,rgba(1,8,5,${a}),rgba(1,8,5,0))`, animationDuration: `${d}s` }} />
      ))}
      {NIGHT_MIST.map(([x, y, w, h, dx, d], i) => <span key={`ms${i}`} className="tk-forest-mist is-night" style={{ left: P(x), top: Q(y), width: P(w), height: px(h), '--dx': px(dx), animationDuration: `${d}s` }} />)}
      {SPORES.map((s, i) => (
        <span key={`sp${i}`} className="tk-forest-spore" style={{ left: P(s.x), top: Q(s.y), width: px(s.sz), height: px(s.sz), background: `rgba(${s.c},1)`, boxShadow: `0 0 8px 2px rgba(${s.c},.7)`, '--dx': px(s.dx), '--dy': px(s.dy), animationDuration: `${s.d}s`, animationDelay: `${s.delay}s` }} />
      ))}
      {NIGHT_FALL.map((l, i) => <FallingLeaf key={`lf${i}`} {...l} />)}
      {NIGHT_FLIES.map((f, i) => <Firefly key={`ff${i}`} {...f} size={5} />)}
      {NIGHT_DUST.map((p, i) => <Dust key={`du${i}`} {...p} />)}
      <GlowFairies />
      {NIGHT_BUTTERFLIES.map(([x, y, col, gl, d, dl, p1, p2, p3], i) => <Butterfly key={`bf${i}`} x={x} y={y} col={col} gl={gl} d={d} dl={dl} p1={p1} p2={p2} p3={p3} glow={24} shadow2={14} />)}
      <span className="tk-forest-floorglow" />
    </>
  );
}
