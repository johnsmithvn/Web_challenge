import { memo } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { solarToLunar } from '../utils/lunarUtils';

/**
 * Nền trang Nhiệm vụ theo mockup "Kanban tối & sáng" (fxA / fxAm / fxC / fxCm).
 * Tối: aurora + Ngân Hà + sao + sao băng + sao chổi; desktop thêm trăng theo âm lịch,
 * sao sáng, chòm sao lần lượt hiện và đường chân trời hành tinh.
 * Sáng: trời bình minh (trước 12h) / hoàng hôn (từ 12h) + mặt trời mọc, mây màu nước, hạt sáng bay.
 * Toạ độ x của mockup tính cả thanh bên 64px của khung → ở đây đã trừ 64.
 */
const px = (v) => `${v}px`;
const pct = (v) => `${(v * 100).toFixed(2)}%`;
// Số giả ngẫu nhiên cố định (như mockup) để mây không đổi hình mỗi lần render
const rnd = (i) => { const x = Math.sin(i * 41.37 + 1.9) * 43758.5453; return x - Math.floor(x); };

// [top, left, width, thời lượng, trễ]
const SHOOTS = [['70px', '81%', 170, 9, 1], ['24px', '59%', 130, 13, 5.5], ['150px', '97%', 210, 17, 9], ['10px', '39%', 150, 23, 14]];
const SHOOTS_M = [['64px', '87%', 110, 9, 1.5], ['18px', '59%', 90, 14, 6], ['140px', '103%', 130, 19, 10.5]];
// Sao sáng 4 cánh: [x, y, cỡ, thời lượng]
const BRIGHT = [[366, 12, 22, 5], [696, 10, 18, 6.5], [816, 66, 16, 4.8], [976, 22, 24, 7], [236, 10, 14, 5.6], [1146, 98, 16, 6], [636, 104, 14, 5.2], [1326, 34, 20, 7.4], [66, 112, 14, 6.2], [1066, 8, 13, 4.4], [296, 92, 12, 5.8]];
// Chòm sao: [tên, điểm, nối]
const CONS = [
  ['Bắc Đẩu', [[0, 30], [40, 26], [72, 34], [100, 46], [110, 80], [150, 84], [160, 52]], [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]]],
  ['Thiên Hậu', [[0, 10], [30, 40], [60, 18], [92, 44], [120, 8]], [[0, 1], [1, 2], [2, 3], [3, 4]]],
  ['Lạp Hộ', [[14, 20], [76, 26], [34, 70], [46, 66], [58, 62], [24, 118], [84, 112], [46, 0]], [[0, 2], [1, 4], [2, 3], [3, 4], [2, 5], [4, 6], [0, 7], [1, 7]]],
  ['Thiên Yết', [[10, 10], [22, 20], [34, 34], [42, 54], [46, 74], [56, 92], [74, 102], [96, 100], [106, 86], [100, 74], [0, 0], [24, 0]], [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [0, 10], [0, 11]]],
  ['Sư Tử', [[14, 30], [30, 10], [54, 8], [64, 30], [52, 56], [120, 48], [150, 66], [112, 78]], [[0, 1], [1, 2], [2, 3], [3, 4], [4, 7], [7, 6], [6, 5], [5, 3]]],
  ['Thiên Nga', [[60, 0], [60, 46], [60, 96], [60, 136], [8, 30], [112, 64]], [[0, 1], [1, 2], [2, 3], [4, 1], [1, 5]]],
];

// Mỗi lượt hiện, chòm sao nhảy tới chỗ ngẫu nhiên trên dải trời phải, thu nhỏ ~0.4, nghiêng ±10°
function placeConstellation(el) {
  const svg = el.firstChild;
  const sc = Math.min(0.4 + Math.random() * 0.06, 54 / ((svg && +svg.getAttribute('height')) || 120));
  el.style.left = px((676 + Math.random() * 440).toFixed(0));
  el.style.top = px((4 + Math.random() * 6).toFixed(0));
  el.style.transform = `scale(${sc.toFixed(2)}) rotate(${((Math.random() - 0.5) * 20).toFixed(0)}deg)`;
  el.lastChild.style.fontSize = px((11 / sc).toFixed(1)); // giữ chữ tên ~11px sau khi thu nhỏ
}
const placeOnce = (el) => { if (el && !el.dataset.placed) { el.dataset.placed = '1'; placeConstellation(el); } };

function Moon() {
  const t = new Date();
  const lday = solarToLunar(t.getDate(), t.getMonth() + 1, t.getFullYear()).day;
  const ph = ((lday - 0.5) / 29.530589) * 2 * Math.PI;
  const lit = (1 - Math.cos(ph)) / 2;
  const wax = ph < Math.PI;
  const D = 64, R = D / 2, MX = 436, MY = -1;
  const tw = Math.abs(Math.cos(ph)) * D;
  const ts = wax ? (lit < 0.5 ? 0 : 1) : (lit < 0.5 ? 1 : 0);
  // Phần sáng = nửa đĩa + elip terminator → cắt bằng clip-path
  const clip = `path('M${R} 0 A${R} ${R} 0 0 ${wax ? 1 : 0} ${R} ${D} A${(tw / 2).toFixed(2)} ${R} 0 0 ${ts} ${R} 0 Z')`;
  const name = lday <= 1 ? 'Trăng non' : lday <= 6 ? 'Lưỡi liềm đầu tháng' : lday <= 8 ? 'Thượng huyền'
    : lday <= 13 ? 'Trăng khuyết đầu tháng' : lday <= 16 ? 'Trăng rằm' : lday <= 21 ? 'Trăng khuyết cuối tháng'
      : lday <= 23 ? 'Hạ huyền' : lday <= 29 ? 'Lưỡi liềm cuối tháng' : 'Trăng tàn';
  return (
    <>
      <span className="task-moon-halo" style={{ left: px(MX + R - 260), top: px(MY + R - 260), background: `radial-gradient(closest-side,rgba(210,222,250,${(0.05 + 0.22 * lit).toFixed(3)}),rgba(210,222,250,0))` }} />
      <span className="task-moon" style={{ left: px(MX), top: px(MY) }}>
        <span style={{ position: 'absolute', inset: 0, filter: `drop-shadow(0 0 ${(4 + 14 * lit).toFixed(0)}px rgba(240,244,255,${(0.35 + 0.45 * lit).toFixed(2)})) drop-shadow(0 0 ${(10 + 30 * lit).toFixed(0)}px rgba(200,215,250,${(0.15 + 0.3 * lit).toFixed(2)}))` }}>
          <span className="task-moon__disc" style={{ clipPath: clip, WebkitClipPath: clip }} />
        </span>
      </span>
      <span className="task-moon-label" style={{ left: px(MX + D + 12), top: px(MY + R - 7) }}>
        {`${lday <= 10 ? 'Mồng' : 'Ngày'} ${lday} · ${name}`}
      </span>
    </>
  );
}

function DarkSky({ isMobile }) {
  return (
    <>
      <div className="task-aurora-glow" />
      <div className="task-milkyway" />
      <div className="task-milkyway task-milkyway--dust" />
      {[0, 1, 2, 3].map((i) => <div key={i} className={`task-stars task-stars--${i}`} />)}
      {(isMobile ? SHOOTS_M : SHOOTS).map(([top, left, w, dur, delay]) => (
        <div key={left} className="task-shooting-star" style={{ top, left, width: px(w), animation: `taskShoot ${dur}s linear ${delay}s infinite` }} />
      ))}
      <div className="task-comet-wrapper">
        <span className="task-comet-tail-1" />
        <span className="task-comet-tail-2" />
        <span className="task-comet-head" />
      </div>
      {!isMobile && (
        <>
          <Moon />
          {BRIGHT.map(([x, y, s, d], i) => (
            <span key={i} className="task-bright-star" style={{ left: px(x - s / 2), top: px(y - s / 2), width: px(s), height: px(s), animationDuration: `${d}s`, animationDelay: `${(-i * 1.3).toFixed(1)}s` }} />
          ))}
          {CONS.map(([name, P, lines], i) => {
            const w = Math.max(...P.map((p) => p[0])) + 10;
            const h = Math.max(...P.map((p) => p[1])) + 10;
            const delay = `${-150 + i * 25 + 6}s`;
            return (
              <span
                key={name}
                ref={placeOnce}
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
                <span className="task-cons__name" style={{ left: px(w + 8), top: px(Math.round(h * 0.3)) }}>{name}</span>
              </span>
            );
          })}
          <div className="task-planet-horizon" />
        </>
      )}
    </>
  );
}

const LIGHT_STARS = [[0.06, 0.05, 3, 6, 0], [0.22, 0.11, 2, 7.5, 2], [0.37, 0.04, 2.5, 8, 3.5], [0.55, 0.09, 2, 6.5, 1.2], [0.71, 0.03, 3, 7, 4.4], [0.86, 0.1, 2.5, 9, 5.6], [0.95, 0.05, 2, 6, 2.8]];
const ORBS = [[0.15, 0.9, 12, 0, 16, 0, 24], [0.42, 0.96, 9, 1, 19, 5, -20], [0.62, 0.9, 14, 2, 21, 9, 28], [0.84, 0.94, 10, 0, 17, 3, -22], [0.3, 0.8, 8, 1, 18, 11, 16]];
const BLUR_CLOUDS = [[0.02, 0.6, 520, 70, 0, 38, 80], [0.42, 0.74, 640, 80, 1, 46, -90], [0.68, 0.52, 420, 60, 2, 42, 70]];
// Mây màu nước: [x, y, rộng, cao] theo tỉ lệ khung
const WC = [[-0.06, 0.008, 0.3, 0.14], [0.36, -0.012, 0.25, 0.11], [0.75, 0.026, 0.32, 0.15], [0.22, 0.15, 0.13, 0.06], [0.6, 0.17, 0.15, 0.07], [-0.05, 0.72, 0.36, 0.16], [0.67, 0.79, 0.39, 0.17]];
const WC_M = [[-0.14, 0.012, 0.62, 0.1], [0.52, -0.005, 0.6, 0.09], [0.18, 0.19, 0.38, 0.055], [-0.16, 0.8, 0.78, 0.11], [0.46, 0.87, 0.74, 0.11]];
const LIGHT_PAL = {
  dawn: { clouds: ['251,207,232', '254,215,170', '221,214,254'], motes: ['253,186,116', '251,207,232', '251,146,60'], star: '#A5B4FC', tint: ['252,218,228', '253,226,204'] },
  dusk: { clouds: ['244,114,182', '251,146,60', '192,132,252'], motes: ['251,146,60', '244,114,182', '253,186,116'], star: '#C084FC', tint: ['253,200,176', '246,168,160'] },
};

function WatercolorCloud({ fx, fy, fw, fh, i, W, H, tint, id }) {
  const w = fw * W, h = fh * H, low = fy > 0.5;
  const puffs = Array.from({ length: 6 }, (_, k) => {
    const t = (k + 0.5) / 6;
    const r = h * (0.26 + 0.3 * Math.sin(Math.PI * t)) * (0.85 + 0.3 * rnd(i * 10 + k));
    return <circle key={k} cx={(w * (0.1 + 0.8 * t)).toFixed(1)} cy={(h - r * 0.8 - h * 0.1).toFixed(1)} r={r.toFixed(1)} />;
  });
  return (
    <svg
      className="task-wc-cloud"
      width={w.toFixed(0)}
      height={h.toFixed(0)}
      viewBox={`0 0 ${w.toFixed(0)} ${h.toFixed(0)}`}
      style={{
        left: pct(fx), top: pct(fy), opacity: low ? 0.85 : 0.95,
        '--dx': px((i % 2 ? -1 : 1) * (40 + rnd(i + 90) * 50)),
        animationDuration: `${(50 + rnd(i + 95) * 40).toFixed(0)}s`,
        filter: `drop-shadow(0 8px 14px rgba(${tint[1]},.28))`,
      }}
    >
      <defs>
        <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={h.toFixed(0)}>
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.5" stopColor="#FFFFFF" />
          <stop offset="1" stopColor={`rgb(${tint[low ? 1 : 0]})`} />
        </linearGradient>
        <filter id={`${id}f`} x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.6" /></filter>
      </defs>
      <g fill={`url(#${id})`} filter={`url(#${id}f)`}>
        {puffs}
        <ellipse cx={(w / 2).toFixed(1)} cy={(h * 0.8).toFixed(1)} rx={(w * 0.46).toFixed(1)} ry={(h * 0.2).toFixed(1)} />
      </g>
    </svg>
  );
}

function LightSky({ isMobile, dusk }) {
  const m = isMobile;
  const W = m ? 390 : 1440, H = m ? 844 : 900, k = m ? 0.8 : 1, cw = m ? 0.45 : 1;
  const P = LIGHT_PAL[dusk ? 'dusk' : 'dawn'];
  const sunS = m ? 300 : 460, haloS = sunS * 2.6;
  const cx = dusk ? (m ? 0.74 : 0.78) : (m ? 0.26 : 0.2);
  return (
    <>
      <div className="task-aurora-glow" />
      <div className="task-light-band" />
      <div className="task-light-ribbon" />
      {BLUR_CLOUDS.map(([x, y, w, h, ci, d, dx], i) => (
        <span
          key={`c${i}`}
          className="task-blur-cloud"
          style={{ left: pct(x), top: pct(y), width: px(w * cw), height: px(h * (m ? 0.7 : 1)), background: `radial-gradient(50% 50% at 50% 50%,rgba(${P.clouds[ci]},.75),transparent 70%)`, '--dx': px(dx * cw), animationDuration: `${d}s` }}
        />
      ))}
      <div className="task-sun" style={{ left: pct(cx), top: `calc(100% + ${dusk ? 50 : 10}px)` }}>
        <span className="task-sun__halo" style={{ left: px(-haloS / 2), top: px(-haloS / 2), width: px(haloS), height: px(haloS) }} />
        <span className="task-sun__core" style={{ left: px(-sunS / 2), top: px(-sunS / 2), width: px(sunS), height: px(sunS) }} />
      </div>
      {(m ? WC_M : WC).map(([fx, fy, fw, fh], i) => (
        <WatercolorCloud key={i} fx={fx} fy={fy} fw={fw} fh={fh} i={i} W={W} H={H} tint={P.tint} id={`tk-wc-${m ? 'm' : 'd'}${i}`} />
      ))}
      {ORBS.map(([x, y, s, ci, d, dl, dx], i) => (
        <span
          key={`o${i}`}
          className="task-orb"
          style={{ left: pct(x), top: pct(y), width: px(s * k), height: px(s * k), background: `radial-gradient(circle at 35% 35%,rgba(255,247,237,.9),rgba(${P.motes[ci]},.5) 45%,rgba(${P.motes[ci]},0) 72%)`, '--dx': px(dx), '--dy': px(-(m ? 260 : 320)), animationDuration: `${d}s`, animationDelay: `${dl}s` }}
        />
      ))}
      {LIGHT_STARS.map(([x, y, s, d, dl], i) => (
        <span
          key={`s${i}`}
          className="task-light-star"
          style={{ left: pct(x), top: pct(y), width: px(s), height: px(s), background: P.star, boxShadow: `0 0 ${s * 3}px ${s}px ${P.star}66`, animationDuration: `${d}s`, animationDelay: `${dl}s` }}
        />
      ))}
    </>
  );
}

function TaskSkyBackground({ isMobile }) {
  const { theme } = useTheme();
  const dusk = new Date().getHours() >= 12;
  return (
    <div className={`task-cosmos-bg${dusk ? ' is-dusk' : ''}`} aria-hidden="true">
      {theme === 'light' ? <LightSky isMobile={isMobile} dusk={dusk} /> : <DarkSky isMobile={isMobile} />}
    </div>
  );
}

export default memo(TaskSkyBackground);
