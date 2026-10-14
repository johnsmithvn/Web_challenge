import { memo, useEffect, useRef } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { solarToLunar, moonPhaseName } from '../utils/lunarUtils';
import { spawnAuroraFlyer } from '../utils/taskFlyersAurora';
import { natureClick } from '../utils/taskNatureFx';
import { hosts as elfHosts, frameKey, spawnElfFlyer, initClk, bgClick, setLastPointer } from '../utils/taskFlyersElf';
import { ForestDay, ForestNight, ForestNightMobile, DayFairiesTop, Constellations } from './TaskForestBackground';

/**
 * Nền trang Nhiệm vụ theo mockup "Kanban tối & sáng" (fxA / fxAm / fxC / fxCm).
 * Tối: aurora + Ngân Hà + sao + sao băng + sao chổi + trăng âm lịch (có chú Cuội) + sao sáng + chòm sao
 * + đom đóm sát đáy; desktop thêm nhãn trăng và đường chân trời hành tinh.
 * Sáng: trời bình minh (trước 12h) / hoàng hôn (từ 12h) + mặt trời mọc, mây màu nước nhấp nhô, hạt sáng bay.
 * Cả hai kiểu (Aurora / Rừng tiên) có vật bay ngẫu nhiên qua trời (utils/taskFlyers*); đêm thêm hiệu ứng
 * thiên nhiên dùng chung (utils/taskNatureFx: cực quang, sao ước nguyện bấm được, nguyệt thực…).
 * Toạ độ x desktop của mockup tính cả thanh bên 64px của khung → ở đây đã trừ 64.
 */
const px = (v) => `${v}px`;
const pct = (v) => `${(v * 100).toFixed(2)}%`;
const seeded = (a, b) => (i) => { const x = Math.sin(i * a + b) * 43758.5453; return x - Math.floor(x); };
// Số giả ngẫu nhiên cố định (như mockup) để mây không đổi hình mỗi lần render
const rnd = seeded(41.37, 1.9);
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// [top, left, width, thời lượng, trễ]
const SHOOTS = [['70px', '81%', 170, 9, 1], ['24px', '59%', 130, 13, 5.5], ['150px', '97%', 210, 17, 9], ['10px', '39%', 150, 23, 14]];
// Rừng tiên đêm: 3 sao băng khác chỗ, không sao chổi
const SHOOTS_ELF = [['60px', '74%', 160, 10, 2], ['28px', '51%', 120, 14, 7], ['130px', '96%', 190, 18, 11]];
const SHOOTS_M = [['64px', '87%', 110, 9, 1.5], ['18px', '59%', 90, 14, 6], ['140px', '103%', 130, 19, 10.5]];
// Sao sáng 4 cánh: [x, y, cỡ, thời lượng] (x desktop đã trừ thanh bên 64px)
const BRIGHT = [[366, 12, 22, 5], [696, 10, 18, 6.5], [816, 66, 16, 4.8], [976, 22, 24, 7], [236, 10, 14, 5.6], [1146, 98, 16, 6], [636, 104, 14, 5.2], [1326, 34, 20, 7.4], [66, 112, 14, 6.2], [1066, 8, 13, 4.4], [296, 92, 12, 5.8]];
// Bảng màu trăng: Aurora (xanh lạnh) / Rừng tiên (ngà ánh lục)
const MOON_PAL = {
  aurora: { halo: '210,222,250', glow1: '240,244,255', glow2: '200,215,250' },
  elf: { halo: '210,236,222', glow1: '240,248,230', glow2: '200,235,215' },
};

function Moon({ elf, m }) {
  const t = new Date();
  const lday = solarToLunar(t.getDate(), t.getMonth() + 1, t.getFullYear()).day;
  const ph = ((lday - 0.5) / 29.530589) * 2 * Math.PI;
  const lit = (1 - Math.cos(ph)) / 2;
  const wax = ph < Math.PI;
  const D = m ? 46 : 64, R = D / 2, MY = m ? 50 : -1, HS = m ? 340 : 520;
  const left = (v) => (m ? pct(v / 390) : px(v)); // mobile: toạ độ khung 390px → %
  const MX = m ? 300 : 436;
  const c = MOON_PAL[elf ? 'elf' : 'aurora'];
  const tw = Math.abs(Math.cos(ph)) * D;
  const ts = wax ? (lit < 0.5 ? 0 : 1) : (lit < 0.5 ? 1 : 0);
  // Phần sáng = nửa đĩa + elip terminator → cắt bằng clip-path
  const clip = `path('M${R} 0 A${R} ${R} 0 0 ${wax ? 1 : 0} ${R} ${D} A${(tw / 2).toFixed(2)} ${R} 0 0 ${ts} ${R} 0 Z')`;
  const name = moonPhaseName(lday);
  return (
    <>
      <span className="task-moon-halo" style={{ left: left(MX + R - HS / 2 + (elf ? (wax ? 1 : -1) * (1 - lit) * D * 0.3 : 0)), top: px(MY + R - HS / 2), width: px(HS), height: px(HS), background: `radial-gradient(closest-side,rgba(${c.halo},${(0.05 + 0.22 * lit).toFixed(3)}),rgba(${c.halo},0))` }} />
      <span className="task-moon" style={{ left: left(MX), top: px(MY), width: px(D), height: px(D) }}>
        <span style={{ position: 'absolute', inset: 0, filter: `drop-shadow(0 0 ${(4 + 14 * lit).toFixed(0)}px rgba(${c.glow1},${(0.35 + 0.45 * lit).toFixed(2)})) drop-shadow(0 0 ${(10 + 30 * lit).toFixed(0)}px rgba(${c.glow2},${(0.15 + 0.3 * lit).toFixed(2)}))` }}>
          <span className="task-moon__disc" style={{ clipPath: clip, WebkitClipPath: clip }}>
            {/* Bóng chú Cuội ngồi gốc cây đa (chỉ kiểu Mặc định) */}
            {!elf && (
              <svg viewBox="0 0 64 64" className="task-moon__cuoi">
                <path d="M28 26 C26 18 32 13 38 14 C42 9 50 11 51 17 C57 18 58 26 53 29 C54 34 48 37 44 35 C40 38 32 36 32 32 C27 32 26 28 28 26 Z" />
                <path d="M40 34 C40 40 39 44 37 48 L45 48 C43 44 42 40 42 34 Z" />
                <path d="M28 48 Q41 46 54 48 Q41 50.5 28 48 Z" />
                <circle cx="31" cy="40.5" r="2" />
                <path d="M29.5 42.6 L32.6 42.6 L33.6 46.6 L36.2 46.6 L36.2 48.4 L29 48.4 Z" />
              </svg>
            )}
          </span>
        </span>
      </span>
      {!m && (
        <span className="task-moon-label" style={{ left: px(MX + D + 12), top: px(MY + R - 7) }}>
          {`${lday <= 10 ? 'Mồng' : 'Ngày'} ${lday} · ${name}`}
        </span>
      )}
    </>
  );
}

// Đom đóm lơ lửng nửa dưới trang (ffl của mockup): desktop 18 con, mobile 9
const hsh = seeded(12.9898, 4.1);
function GroundFireflies({ m }) {
  const A = m ? 40 : 70;
  return Array.from({ length: m ? 9 : 18 }, (_, i) => {
    const r = (j) => hsh(i * 17 + j), s = 2.5 + r(1) * 2.5, v = (j) => px(((r(j) - 0.5) * A * 2).toFixed(0));
    return (
      <span
        key={i}
        className="task-ground-ff"
        style={{
          left: pct(r(2)), top: pct(0.62 + r(3) * 0.34), width: px(s.toFixed(1)), height: px(s.toFixed(1)),
          boxShadow: `0 0 ${(s * 3).toFixed(0)}px ${(s * 0.8).toFixed(1)}px rgba(190,242,100,.55)`,
          '--x1': v(4), '--y1': v(5), '--x2': v(6), '--y2': v(7), '--x3': v(8), '--y3': v(9),
          animationDuration: `${(12 + r(10) * 10).toFixed(1)}s, ${(1.8 + r(12) * 2.4).toFixed(2)}s`,
          animationDelay: `${(-r(11) * 20).toFixed(1)}s, ${(-r(13) * 3).toFixed(2)}s`,
        }}
      />
    );
  });
}

function DarkSky({ isMobile, elf }) {
  const m = isMobile;
  return (
    <>
      <div className="task-aurora-glow" />
      <div className="task-milkyway" />
      <div className="task-milkyway task-milkyway--dust" />
      {[0, 1, 2, 3].map((i) => <div key={i} className={`task-stars task-stars--${i}`} />)}
      {(m ? SHOOTS_M : elf ? SHOOTS_ELF : SHOOTS).map(([top, left, w, dur, delay]) => (
        <div key={left} className="task-shooting-star" style={{ top, left, width: px(w), animation: `taskShoot ${dur}s linear ${delay}s infinite` }} />
      ))}
      {!elf && (
        <div className="task-comet-wrapper">
          <span className="task-comet-tail-1" />
          <span className="task-comet-tail-2" />
          <span className="task-comet-head" />
        </div>
      )}
      {(!m || !elf) && (
        <>
          <Moon elf={elf} m={m} />
          {BRIGHT.map(([x, y, s, d], i) => (!m || i % 2 === 0) && (
            <span key={i} className="task-bright-star" style={{ left: m ? pct(((x + 64) * 0.27) / 390 - s / 2 / 390) : px(x - s / 2), top: px(y - s / 2), width: px(s), height: px(s), animationDuration: `${d}s`, animationDelay: `${(-i * 1.3).toFixed(1)}s` }} />
          ))}
          <Constellations m={m} />
          {!m && !elf && <div className="task-planet-horizon" />}
        </>
      )}
      {!elf && <GroundFireflies m={m} />}
      {elf && <ForestNight />}
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

// Mây màu nước: lớp ngoài nhấp nhô lên xuống (bob), lớp trong trôi ngang (drift)
function WatercolorCloud({ fx, fy, fw, fh, i, W, H, m, tint, id }) {
  const w = fw * W, h = fh * H, low = fy > 0.5;
  const puffs = Array.from({ length: 6 }, (_, k) => {
    const t = (k + 0.5) / 6;
    const r = h * (0.26 + 0.3 * Math.sin(Math.PI * t)) * (0.85 + 0.3 * rnd(i * 10 + k));
    return <circle key={k} cx={(w * (0.1 + 0.8 * t)).toFixed(1)} cy={(h - r * 0.8 - h * 0.1).toFixed(1)} r={r.toFixed(1)} />;
  });
  return (
    <span
      className="task-wc-bob"
      style={{
        left: pct(fx), top: pct(fy), '--by': px((m ? 5 : 8) + rnd(i + 70) * 8),
        animationDuration: `${(6 + rnd(i + 75) * 5).toFixed(1)}s`, animationDelay: `${(-rnd(i + 80) * 6).toFixed(1)}s`,
      }}
    >
      <svg
        className="task-wc-cloud"
        width={w.toFixed(0)}
        height={h.toFixed(0)}
        viewBox={`0 0 ${w.toFixed(0)} ${h.toFixed(0)}`}
        style={{
          opacity: low ? 0.85 : 0.95,
          '--dx': px((i % 2 ? -1 : 1) * (m ? 26 + rnd(i + 90) * 30 : 80 + rnd(i + 90) * 110)),
          animationDuration: `${(34 + rnd(i + 95) * 26).toFixed(0)}s`, animationDelay: `${(-rnd(i + 85) * 30).toFixed(1)}s`,
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
    </span>
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
        <WatercolorCloud key={i} fx={fx} fy={fy} fw={fw} fh={fh} i={i} W={W} H={H} m={m} tint={P.tint} id={`tk-wc-${m ? 'm' : 'd'}${i}`} />
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

/* ── Vật bay ngẫu nhiên (flyTick của mockup): thả 1 cảnh mỗi 2,5–7,5s (mobile 4–10s), tối đa 5 (mobile 3) cùng lúc ── */
function useFlyers(hostRef, { elf, night, m }) {
  useEffect(() => {
    const host = hostRef.current;
    if (!host || reducedMotion()) return undefined;
    let timer;
    let ends = [];
    const tick = () => {
      if (!host.isConnected) return;
      const now = Date.now();
      ends = ends.filter((t) => t > now);
      if (!document.hidden && ends.length < (m ? 3 : 5) && (elf || host.childElementCount < (m ? 16 : 34))) {
        const dur = elf ? spawnElfFlyer(host, m, night) : (spawnAuroraFlyer(host, m, night), 16);
        ends.push(now + (dur || 10) * 1000);
      }
      timer = setTimeout(tick, (elf ? (m ? 4500 : 3000) : (m ? 4000 : 2500)) + Math.random() * (m ? 6000 : 5000));
    };
    timer = setTimeout(tick, elf ? 1500 + Math.random() * 2000 : 1200 + Math.random() * 1500);
    // Sao ước nguyện (taskNatureFx) bấm được: trúng thì chặn click để không mở nhầm thứ phía dưới.
    // Đăng ký trước bgClick của Rừng tiên (hook gọi trước) nên chặn luôn cả rung cây.
    const onClick = (e) => {
      if (natureClick(e)) { e.stopImmediatePropagation(); e.preventDefault(); }
    };
    window.addEventListener('click', onClick, true);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('click', onClick, true);
      host.replaceChildren();
    };
  }, [hostRef, elf, night, m]);
}

/* ── Rừng tiên: nấm + đom đóm bấm được, bấm nền rung cây, sương tan quanh con trỏ (mockup) ── */
function fogMove(e) {
  const fr = e.target?.closest?.('[data-frame]');
  if (!fr) return;
  const r = fr.getBoundingClientRect();
  if (!r.width) return;
  const st = fr._fog || (fr._fog = { x: 0, y: 0, r: 0, rt: 0, raf: 0, last: 0 });
  st.x = e.clientX - r.left;
  st.y = e.clientY - r.top;
  st.rt = fr.dataset.frame.length > 1 ? 90 : 150;
  st.last = performance.now();
  if (st.raf) return;
  const tick = () => {
    const idle = performance.now() - st.last > 250;
    if (idle) st.rt *= 0.94;
    st.r += (st.rt - st.r) * 0.15;
    const els = fr.querySelectorAll('[data-fog]');
    if (idle && st.r < 2) {
      els.forEach((el) => { el.style.webkitMaskImage = ''; el.style.maskImage = ''; });
      st.raf = 0;
      st.r = 0;
      return;
    }
    const g = `radial-gradient(circle ${st.r.toFixed(0)}px at ${st.x.toFixed(0)}px ${st.y.toFixed(0)}px,transparent 0,rgba(0,0,0,.35) 55%,#000 100%)`;
    els.forEach((el) => { el.style.webkitMaskImage = g; el.style.maskImage = g; });
    st.raf = requestAnimationFrame(tick);
  };
  st.raf = requestAnimationFrame(tick);
}

function useElfInteractions(backRef, topRef, { elf, fk }) {
  useEffect(() => {
    const back = backRef.current, top = topRef.current;
    if (!elf || !back || !top || reducedMotion()) return undefined;
    elfHosts[fk] = back;
    elfHosts[`${fk}_t`] = top;
    const t = setTimeout(() => initClk(fk, back), 900);
    const onUp = (e) => setLastPointer({ x: e.clientX, y: e.clientY, t: Date.now() });
    window.addEventListener('pointerup', onUp, true);
    window.addEventListener('click', bgClick, true);
    window.addEventListener('pointermove', fogMove, { passive: true });
    return () => {
      clearTimeout(t);
      window.removeEventListener('pointerup', onUp, true);
      window.removeEventListener('click', bgClick, true);
      window.removeEventListener('pointermove', fogMove);
      delete back._clkInit;
      back._clk = [];
      top.replaceChildren();
      if (elfHosts[fk] === back) delete elfHosts[fk];
      if (elfHosts[`${fk}_t`] === top) delete elfHosts[`${fk}_t`];
    };
  }, [backRef, topRef, elf, fk]);
}

function TaskSkyBackground({ isMobile }) {
  const { theme, taskStyle } = useTheme();
  const elf = taskStyle === 'elf';
  const night = theme !== 'light';
  const fk = frameKey(theme, isMobile);
  const dusk = new Date().getHours() >= 12;
  const flyRef = useRef(null);
  const topRef = useRef(null);
  useFlyers(flyRef, { elf, night, m: isMobile });
  useElfInteractions(flyRef, topRef, { elf, fk });

  let sky;
  if (night) sky = elf && isMobile ? <><div className="task-aurora-glow" /><ForestNightMobile /></> : <DarkSky isMobile={isMobile} elf={elf} />;
  else if (elf) sky = <><div className="task-aurora-glow" /><ForestDay isMobile={isMobile} /></>;
  else sky = <LightSky isMobile={isMobile} dusk={dusk} />;
  return (
    <>
      <div className={`task-cosmos-bg${dusk ? ' is-dusk' : ''}`} aria-hidden="true">
        {sky}
        <div ref={flyRef} className="task-fly-host" />
      </div>
      {/* Lớp phía trên nội dung (không nhận chuột): tiên đốm sáng (Rừng tiên sáng desktop), đom đóm đi theo, ăn mừng xong việc */}
      {elf && (
        <div className="task-cosmos-bg task-fx-top" aria-hidden="true">
          {!night && !isMobile && <DayFairiesTop />}
          <div ref={topRef} className="task-fly-host" />
        </div>
      )}
    </>
  );
}

export default memo(TaskSkyBackground);
