/**
 * Hiệu ứng thiên nhiên dùng chung cho nền trang Nhiệm vụ (cả Mặc định lẫn Rừng tiên) — port nature-fx.js của mockup:
 * sao ước nguyện (bấm được → thẻ điều ước), chòm Thợ Săn, cầu vồng trăng (+ cầu vồng ban ngày), Ngân Hà,
 * sương rơi, lá bạc, bồ công anh phát sáng + nguyệt thực (1/40 lượt đêm). Chỉ dùng ban đêm.
 * Đã gỡ (user thấy lạc lõng): hồ phát sáng, rêu phát sáng.
 * Khung = cỡ thật của host; keyframe CSS mang tiền tố `tkf-` (tasks-aurora.css).
 * File là code mockup chuyển sang — giữ nguyên cấu trúc cho dễ đối chiếu khi mockup đổi.
 */
const R = Math.random, rr = (a, b) => a + R() * (b - a), f = v => (+v).toFixed(1);
const WISH = ['Ước gì deadline tự lùi một tuần', 'Ước việc tự kéo sang cột Xong', 'Ước họp năm phút là xong', 'Ước cuối tuần dài ba ngày', 'Ước inbox về số 0', 'Ước sếp duyệt ngay lần đầu', 'Ước không còn việc quá hạn', 'Ước cà phê không bao giờ nguội'];
const live = [];
const kit = (host, m, o) => {
  const W = host.clientWidth || (m ? 390 : 1440), H = host.clientHeight || (m ? 844 : 900), k = m ? .72 : 1, font = o.font || "'Cormorant SC',serif";
  const gyAt = o.gyAt || (() => H - (m ? 16 : 10)), gx = o.gx || [.06, .94];
  const fx1 = (html, x, y, fr, dur, delay, tgt) => {
    const e = document.createElement('div');
    e.style.cssText = 'position:absolute;left:' + f(x) + 'px;top:' + f(y) + 'px;width:0;height:0;pointer-events:none';
    e.innerHTML = html; (tgt || host).appendChild(e);
    e.animate(fr, { duration: dur * 1000, delay: (delay || 0) * 1000, fill: 'both' }).onfinish = () => e.remove();
    return e;
  };
  const dot = (sz, c, g) => '<span style="position:absolute;left:' + f(-sz / 2) + 'px;top:' + f(-sz / 2) + 'px;width:' + f(sz) + 'px;height:' + f(sz) + 'px;border-radius:50%;background:' + c + ';box-shadow:0 0 6px 2px rgba(' + g + ',.85)"></span>';
  const env = (a, b) => [{ opacity: 0 }, { opacity: 1, offset: a }, { opacity: 1, offset: b }, { opacity: 0 }];
  const win = (a, b) => { const q = [{ opacity: 0, offset: 0 }]; if (a > 0) q.push({ opacity: 0, offset: a }); q.push({ opacity: 1, offset: Math.min(1, a + .04) }, { opacity: 1, offset: b }, { opacity: 0, offset: Math.min(1, b + .05) }); if (b + .05 < 1) q.push({ opacity: 0, offset: 1 }); return q; };
  const lbl = (txt, x, y, a, b, D) => fx1('<div style="position:absolute;left:0;top:0;transform:translate(-50%,-100%);white-space:nowrap;font:600 ' + (m ? 12 : 14) + 'px/1.2 ' + font + ';letter-spacing:.08em;color:rgba(236,255,246,.92);text-shadow:0 0 10px rgba(94,242,194,.75),0 1px 3px rgba(0,0,0,.7)">' + txt + '</div>', x, y, win(a, b), D);
  return { W, H, k, m, font, gyAt, gx, fx1, dot, env, win, lbl, host, o };
};
const FX = {};
FX.wish = K => {
  const { W, H, k, m, fx1 } = K, dir = R() < .5 ? 1 : -1, y0 = H * rr(.07, .2), len = W * (m ? .6 : .4), x0 = dir > 0 ? W * rr(.06, .3) : W * rr(.7, .94), x1 = x0 + dir * len, y1 = y0 + len * rr(.16, .28), D = m ? 4.8 : 5.6, ang = Math.atan2(y1 - y0, x1 - x0) * 180 / Math.PI, tl = 130 * k;
  const art = '<div style="position:absolute;left:0;top:0;transform:rotate(' + f(ang) + 'deg)"><span style="position:absolute;left:' + f(-tl) + 'px;top:-1px;width:' + f(tl) + 'px;height:2px;border-radius:2px;background:linear-gradient(90deg,rgba(200,240,255,0),rgba(230,248,255,.95))"></span></div><span style="position:absolute;left:-4px;top:-4px;width:8px;height:8px;border-radius:50%;background:#fff;box-shadow:0 0 8px 3px rgba(210,240,255,.95),0 0 24px 9px rgba(125,211,252,.45)"></span><span style="position:absolute;left:-22px;top:-22px;width:44px;height:44px;box-sizing:border-box;border-radius:50%;border:1px dashed rgba(230,248,255,.45);animation:tkf-nfxSpin 5s linear infinite"></span><span style="position:absolute;left:0;top:26px;transform:translateX(-50%);white-space:nowrap;font:600 ' + (m ? 10.5 : 11.5) + 'px/1 \'Be Vietnam Pro\',sans-serif;color:#EAF8FF;text-shadow:0 0 8px rgba(125,211,252,.95),0 1px 2px rgba(0,0,0,.8)">Bấm để ước</span>';
  const fr = [];
  for (let i = 0; i <= 10; i++) { const u = i / 10; fr.push({ transform: 'translate(' + f(x0 + (x1 - x0) * u) + 'px,' + f(y0 + (y1 - y0) * u) + 'px)', opacity: Math.min(1, u / .08, (1 - u) / .1), offset: u }); }
  const rec = { el: fx1(art, 0, 0, fr, D), K }; live.push(rec);
  setTimeout(() => { const i = live.indexOf(rec); if (i >= 0) live.splice(i, 1); }, D * 1000 + 100);
  return D + 1;
};
const hit = (rec, x, y) => {
  const { K } = rec, { W, k, m, fx1, dot, font, o } = K, tgt = o.top && o.top.isConnected ? o.top : K.host;
  rec.el.remove();
  for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2, r = rr(26, 64) * k; fx1(dot(rr(2, 4.2), '#FFF7D6', '253,230,138'), x, y, [{ transform: 'translate(0,0)', opacity: 1 }, { transform: 'translate(' + f(Math.cos(a) * r) + 'px,' + f(Math.sin(a) * r) + 'px)', opacity: 0 }], rr(.9, 1.4), 0, tgt); }
  fx1('<svg width="40" height="40" viewBox="-20 -20 40 40" style="position:absolute;left:-20px;top:-20px;overflow:visible;filter:drop-shadow(0 0 8px rgba(253,230,138,.95))"><path d="M0 -18 L4 -4 L18 0 L4 4 L0 18 L-4 4 L-18 0 L-4 -4 Z" fill="#FFF7D6"/></svg>', x, y, [{ transform: 'scale(.2) rotate(0deg)', opacity: 0 }, { transform: 'scale(1.2) rotate(45deg)', opacity: 1, offset: .3 }, { transform: 'scale(0) rotate(120deg)', opacity: 0 }], 1.2, 0, tgt);
  const w = WISH[Math.floor(R() * WISH.length)], bx = Math.max(150 * k, Math.min(W - 150 * k, x)), below = y < 130;
  fx1('<div style="position:absolute;left:0;top:0;transform:translate(-50%,' + (below ? '0' : '-100%') + ');padding:9px 14px;border-radius:12px;background:rgba(6,18,14,.92);border:1px solid rgba(253,230,138,.45);box-shadow:0 0 26px rgba(253,230,138,.22);display:flex;flex-direction:column;align-items:center;gap:5px;white-space:nowrap"><span style="font:600 10px/1 ' + font + ';letter-spacing:.14em;text-transform:uppercase;color:#FDE68A">Điều ước</span><span style="font:600 ' + (m ? 12 : 13.5) + 'px/1.25 \'Be Vietnam Pro\',sans-serif;color:#F2FFF8">' + w + '</span></div>', bx, below ? y + 26 * k : y - 26 * k, [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'translateY(0)', offset: .08 }, { opacity: 1, transform: 'translateY(0)', offset: .86 }, { opacity: 0, transform: 'translateY(-6px)' }], 4.4, 0, tgt);
};
/** Bấm trúng sao ước nguyện đang bay → nổ sáng + thẻ điều ước. Trả true nếu đã xử lý (bên gọi chặn click). */
export function natureClick(e) {
  if (!live.length) return false;
  const t = e.target; if (!t || !t.closest) return false;
  if (t.closest('button,a,input,textarea,select,label,[draggable="true"],[data-peek],[contenteditable="true"]')) return false;
  try { if (getComputedStyle(t).cursor === 'pointer') return false; } catch { /* phần tử vừa bị gỡ */ }
  for (const rec of live.slice()) {
    if (!rec.el.isConnected) continue;
    const host = rec.K.host, page = host.closest('.tasks-workspace'); if (!page || !page.contains(t)) continue;
    const r = host.getBoundingClientRect(); if (!r.width) continue;
    const b = rec.el.getBoundingClientRect();
    if (Math.hypot(e.clientX - b.left, e.clientY - b.top) < 48 * rec.K.k) { live.splice(live.indexOf(rec), 1); hit(rec, b.left - r.left, b.top - r.top); return true; }
  }
  return false;
}
FX.eclipse = K => {
  const { W, H, k, fx1, o } = K, [mx, my, md] = o.moon || [532, 31, 64], r = md / 2, D = 18;
  fx1('<div style="position:absolute;left:0;top:0;width:' + W + 'px;height:' + H + 'px;background:radial-gradient(' + f(W * .55) + 'px ' + f(H * .6) + 'px at ' + f(mx) + 'px ' + f(my) + 'px,rgba(190,40,30,.24),rgba(120,20,30,.1) 45%,rgba(120,20,30,0) 75%)"></div>', 0, 0, K.win(.28, .66), D);
  fx1('<div style="position:absolute;left:' + f(-r) + 'px;top:' + f(-r) + 'px;width:' + md + 'px;height:' + md + 'px;border-radius:50%;box-shadow:0 0 18px 6px rgba(225,75,50,.55),0 0 64px 24px rgba(170,30,25,.3)"></div>', mx, my, K.win(.32, .64), D);
  const e = fx1('<div style="position:absolute;left:' + f(-r) + 'px;top:' + f(-r) + 'px;width:' + md + 'px;height:' + md + 'px;border-radius:50%;overflow:hidden"><div data-red style="position:absolute;inset:0;opacity:0;background:radial-gradient(circle at 30% 62%,rgba(90,20,15,.4) 0 7%,transparent 12%),radial-gradient(circle at 62% 30%,rgba(90,20,15,.35) 0 9%,transparent 14%),radial-gradient(circle at 40% 38%,#F29A6E,#BC4430 55%,#62180F)"></div><div data-sh style="position:absolute;left:' + f(-md * .06) + 'px;top:' + f(-md * .06) + 'px;width:' + f(md * 1.12) + 'px;height:' + f(md * 1.12) + 'px;border-radius:50%;background:radial-gradient(circle,rgba(8,6,10,.95) 55%,rgba(8,6,10,.7) 72%,rgba(8,6,10,0) 100%)"></div></div>', mx, my, [{ opacity: 1 }, { opacity: 1 }], D);
  const ms = D * 1000, X = v => 'translateX(' + f(v * md) + 'px)';
  e.querySelector('[data-red]').animate([{ opacity: 0, offset: 0 }, { opacity: 0, offset: .3 }, { opacity: .96, offset: .42 }, { opacity: .96, offset: .62 }, { opacity: 0, offset: .74 }, { opacity: 0, offset: 1 }], { duration: ms, fill: 'both' });
  e.querySelector('[data-sh]').animate([{ transform: X(-1.25), opacity: .95, offset: 0 }, { transform: X(0), opacity: .95, offset: .3 }, { transform: X(0), opacity: .3, offset: .42 }, { transform: X(0), opacity: .3, offset: .62 }, { transform: X(0), opacity: .95, offset: .72 }, { transform: X(1.25), opacity: .95, offset: 1 }], { duration: ms, fill: 'both' });
  K.lbl('Nguyệt thực · Trăng máu', Math.max(110 * k, Math.min(W - 110 * k, mx)), my + r + 34 * k, .34, .66, D);
  return D;
};
FX.orion = K => {
  const { W, H, k, m, fx1, dot } = K, D = 15, dir = R() < .5 ? 1 : -1, s = k * (m ? 1.05 : 1.35), cx = W * (dir > 0 ? rr(.14, .36) : rr(.64, .86)), cy = H * (m ? .2 : .25), wk = 56 * k * dir;
  const S = { h: [60, 12], sl: [40, 40], sr: [80, 37], b1: [51, 80], b2: [60, 82], b3: [69, 84], fl: [42, 142], fr: [86, 138], cl: [24, 4], ha: [106, 44], w1: [100, 20], w2: [111, 44], w3: [100, 68] };
  const ln = (a, b, i) => '<path d="M' + S[a] + ' L' + S[b] + '" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1" data-i="' + i + '"/>';
  const st = (p, r, c) => '<circle cx="' + S[p][0] + '" cy="' + S[p][1] + '" r="' + r + '" fill="' + c + '" stroke="none"/>';
  const L = [['h', 'sl'], ['h', 'sr'], ['sl', 'b1'], ['sr', 'b3'], ['b1', 'b2'], ['b2', 'b3'], ['sl', 'cl'], ['sr', 'ha'], ['w1', 'w2'], ['w2', 'w3']];
  const leg = (i, a, b, c) => '<g data-leg="' + i + '" style="transform-origin:' + S[a][0] + 'px ' + S[a][1] + 'px">' + ln(a, b, 10 + i) + st(b, 2.4, c) + '</g>';
  const body = L.map((p, i) => ln(p[0], p[1], i)).join('') + leg(0, 'b1', 'fl', '#F4F8FF') + leg(1, 'b3', 'fr', '#CFE6FF') + ['h', 'sr', 'b1', 'b2', 'b3', 'cl', 'ha', 'w1', 'w2', 'w3'].map(p => st(p, /b\d/.test(p) ? 2.6 : 2, '#F4F8FF')).join('') + st('sl', 2.8, '#FFC4A0');
  const svg = '<div style="position:absolute;left:' + f(-60 * s) + 'px;top:' + f(-80 * s) + 'px;width:' + f(120 * s) + 'px;height:' + f(160 * s) + 'px' + (dir < 0 ? ';transform:scaleX(-1)' : '') + '"><svg width="100%" height="100%" viewBox="0 0 120 160" style="overflow:visible;filter:drop-shadow(0 0 3px rgba(200,230,255,.95))"><g stroke="rgba(200,228,255,.6)" stroke-width="' + (1.1 / s).toFixed(2) + '" fill="none" stroke-linecap="round">' + body + '</g></svg></div>';
  const fr = [{ transform: 'translate(0px,0px)', opacity: 0, offset: 0 }, { transform: 'translate(0px,0px)', opacity: 1, offset: .08 }, { transform: 'translate(0px,0px)', opacity: 1, offset: .2 }];
  for (let i = 1; i <= 6; i++) fr.push({ transform: 'translate(' + f(wk * i / 6) + 'px,' + f(i % 2 ? -5 * k : 0) + 'px)', opacity: 1, offset: .2 + i * .058 });
  fr.push({ transform: 'translate(' + f(wk) + 'px,0px)', opacity: 1, offset: .86 }, { transform: 'translate(' + f(wk) + 'px,0px)', opacity: 0, offset: 1 });
  const e = fx1(svg, cx, cy, fr, D), ms = D * 1000;
  e.querySelectorAll('path').forEach(p => { const a = .03 + (+p.dataset.i) * .006; p.animate([{ strokeDashoffset: '1', offset: 0 }, { strokeDashoffset: '1', offset: a }, { strokeDashoffset: '0', offset: a + .05 }, { strokeDashoffset: '0', offset: 1 }], { duration: ms, fill: 'both' }); });
  e.querySelectorAll('[data-leg]').forEach(g => { const sg = +g.dataset.leg ? 1 : -1, q = [{ transform: 'rotate(0deg)', offset: 0 }, { transform: 'rotate(0deg)', offset: .2 }]; for (let i = 1; i <= 6; i++) q.push({ transform: 'rotate(' + ((i % 2 ? 10 : -10) * sg) + 'deg)', offset: .2 + i * .058 - .029 }); q.push({ transform: 'rotate(0deg)', offset: .56 }, { transform: 'rotate(0deg)', offset: 1 }); g.animate(q, { duration: ms, fill: 'both' }); });
  const hx = cx + wk + dir * 46 * s, hy = cy - 36 * s, ex = Math.max(40 * k, Math.min(W - 40 * k, hx + dir * W * (m ? .5 : .42))), ey = Math.max(30 * k, hy - H * .1), ang = Math.atan2(ey - hy, ex - hx) * 180 / Math.PI;
  fx1('<div style="position:absolute;left:0;top:0;transform:rotate(' + f(ang) + 'deg)"><span style="position:absolute;left:' + f(-46 * k) + 'px;top:-1px;width:' + f(46 * k) + 'px;height:2px;border-radius:2px;background:linear-gradient(90deg,rgba(253,230,138,0),#FFF7D6)"></span><span style="position:absolute;left:-3px;top:-3px;width:6px;height:6px;border-radius:50%;background:#fff;box-shadow:0 0 8px 3px rgba(253,230,138,.9)"></span></div>', hx, hy, [{ transform: 'translate(0,0)', opacity: 0 }, { transform: 'translate(0,0)', opacity: 1, offset: .08 }, { transform: 'translate(' + f(ex - hx) + 'px,' + f(ey - hy) + 'px)', opacity: 1, offset: .92 }, { transform: 'translate(' + f(ex - hx) + 'px,' + f(ey - hy) + 'px)', opacity: 0 }], 1.4, D * .6);
  for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2, rd = rr(18, 44) * k; fx1(dot(rr(2, 3.6), '#FFF7D6', '253,230,138'), ex, ey, [{ transform: 'translate(0,0)', opacity: 0 }, { transform: 'translate(0,0)', opacity: 1, offset: .05 }, { transform: 'translate(' + f(Math.cos(a) * rd) + 'px,' + f(Math.sin(a) * rd) + 'px)', opacity: 0 }], 1.2, D * .6 + 1.3); }
  K.lbl('Chòm sao Thợ Săn', cx + wk / 2, cy + 80 * s + 26 * k, .1, .8, D);
  return D;
};
/**
 * Cầu vồng LỚN vắt ngang trời (v6.30.3, dùng chung: cầu vồng ban ngày + cầu vồng trăng ban đêm + sóc trượt
 * Rừng tiên). Tâm cung nằm thấp nên cung phủ gần hết bề ngang, 2 chân mờ dần xuống đất; dải chính (tím trong →
 * đỏ ngoài) + cầu vồng phụ mờ màu đảo + nền sáng nhẹ trong lòng cung. Chỉ gradient, không blur (nhẹ GPU).
 * night = cầu vồng trăng (nhạt, ngả trắng). Trả html + góc trái trên (x, y) + tâm (cx, cy) + bán kính r.
 */
export function bigRainbowArc(W, H, m, night = false) {
  const r = m ? W * 0.8 : Math.max(560, W * 0.55);
  // Đỉnh cung chính ~40px dưới mép trên (desktop) → lộ ở vùng tiêu đề, không nấp hết sau bảng nội dung
  const cx = W / 2, cy = m ? H * 0.5 : 40 + r * 0.954, R2 = r * 1.2;
  const at = (v) => ((v * r) / R2 * 100).toFixed(2) + '%';
  const a = night ? 0.32 : 0.5;
  const C = night
    ? ['226,214,255', '205,232,255', '222,255,232', '255,244,210', '255,226,214', '255,214,224']
    : ['139,92,246', '59,130,246', '34,197,94', '250,204,21', '249,115,22', '239,68,68'];
  let stops = 'transparent ' + at(0.45) + ',rgba(255,255,255,' + (night ? 0.05 : 0.12) + ') ' + at(0.78);
  C.forEach((c, i) => { stops += ',rgba(' + c + ',' + a + ') ' + at(0.814 + i * 0.028); });
  stops += ',transparent ' + at(0.99) + ',transparent ' + at(1.08);
  [...C].reverse().forEach((c, i) => { stops += ',rgba(' + c + ',' + (a * 0.38).toFixed(2) + ') ' + at(1.09 + i * 0.016); });
  stops += ',transparent ' + at(1.19);
  const mk = 'linear-gradient(to top,transparent,#000 38%)';
  const html = '<div style="position:absolute;left:0;top:0;width:' + f(2 * R2) + 'px;height:' + f(R2) + 'px;background:radial-gradient(circle ' + f(R2) + 'px at 50% 100%,' + stops + ');-webkit-mask-image:' + mk + ';mask-image:' + mk + '"></div>';
  return { html, x: cx - R2, y: cy - R2, cx, cy, r };
}
// Mưa lất phất trước khi cầu vồng hiện
const rainThen = (K, color) => {
  const { W, H, m, fx1 } = K;
  for (let i = 0; i < (m ? 30 : 70); i++) fx1('<span style="position:absolute;left:0;top:0;width:1.2px;height:' + rr(10, 18).toFixed(0) + 'px;transform:rotate(8deg);background:linear-gradient(rgba(' + color + ',0),rgba(' + color + ',.7))"></span>', rr(0, W + 60), -20, [{ transform: 'translate(0,0)', opacity: 0 }, { transform: 'translate(-8px,' + f(H * .3) + 'px)', opacity: 1, offset: .25 }, { transform: 'translate(-26px,' + (H + 40) + 'px)', opacity: .6 }], rr(.8, 1.2), R() * 4.4);
};
const bowIn = [{ opacity: 0 }, { opacity: 0, offset: .28 }, { opacity: 1, offset: .42 }, { opacity: 1, offset: .82 }, { opacity: 0 }];
FX.moonbow = K => {
  const D = 15, bow = bigRainbowArc(K.W, K.H, K.m, true);
  rainThen(K, '200,225,245');
  K.fx1(bow.html, bow.x, bow.y, bowIn, D);
  return D;
};
FX.rainbow = K => {
  const D = 16, bow = bigRainbowArc(K.W, K.H, K.m, false);
  rainThen(K, '140,180,220');
  K.fx1(bow.html, bow.x, bow.y, bowIn, D);
  return D;
};
FX.milky = K => {
  const { W, H, m, fx1 } = K, D = 26, bw = W * 1.7, bh = m ? 130 : 230, cx = W * .5, cy = H * (m ? .2 : .27), sg = R() < .5 ? 1 : -1, a0 = sg * rr(16, 24);
  const dust = 'radial-gradient(1px 1px at 12px 18px,#fff,transparent),radial-gradient(1px 1px at 47px 62px,rgba(220,230,255,.9),transparent),radial-gradient(1.5px 1.5px at 83px 33px,#fff,transparent),radial-gradient(1px 1px at 66px 8px,rgba(255,236,210,.9),transparent),radial-gradient(1px 1px at 28px 49px,#fff,transparent),radial-gradient(1.2px 1.2px at 90px 70px,rgba(210,225,255,.9),transparent)';
  const dust2 = 'radial-gradient(.8px .8px at 5px 9px,rgba(255,255,255,.85),transparent),radial-gradient(.8px .8px at 23px 27px,rgba(230,235,255,.8),transparent),radial-gradient(.9px .9px at 33px 4px,rgba(255,245,230,.85),transparent)';
  const em = 'radial-gradient(50% 50% at 50% 50%,#000 25%,transparent 100%)';
  fx1('<div style="position:absolute;left:' + f(-bw / 2) + 'px;top:' + f(-bh / 2) + 'px;width:' + f(bw) + 'px;height:' + bh + 'px;-webkit-mask-image:' + em + ';mask-image:' + em + '"><div style="position:absolute;inset:0;background:linear-gradient(transparent 16%,rgba(170,195,255,.12) 36%,rgba(226,212,255,.22) 49%,rgba(255,232,206,.17) 56%,rgba(170,195,255,.1) 68%,transparent 84%);filter:blur(' + (m ? 6 : 10) + 'px)"></div><div style="position:absolute;inset:0;background:linear-gradient(transparent 44%,rgba(4,10,14,.42) 49%,rgba(4,10,14,.2) 54%,transparent 59%);filter:blur(4px);transform:skewX(-12deg)"></div><div style="position:absolute;inset:0;background:' + dust + ';background-size:96px 74px"></div><div style="position:absolute;inset:0;background:' + dust2 + ';background-size:41px 37px;opacity:.8"></div></div>', cx, cy, [{ transform: 'rotate(' + f(a0) + 'deg)', opacity: 0 }, { transform: 'rotate(' + f(a0 + sg * 1.5) + 'deg)', opacity: 1, offset: .2 }, { transform: 'rotate(' + f(a0 + sg * 5.5) + 'deg)', opacity: 1, offset: .8 }, { transform: 'rotate(' + f(a0 + sg * 7) + 'deg)', opacity: 0 }], D);
  return D;
};
FX.dew = K => {
  const { W, H, k, m, fx1, dot, gyAt, gx } = K, D = 8;
  const drop = '<svg width="8" height="11" viewBox="0 0 8 11" style="position:absolute;left:-4px;top:-8px;overflow:visible;filter:drop-shadow(0 0 4px rgba(186,230,253,.9))"><path d="M4 0 C5.5 3 8 5 8 7.5 C8 9.5 6.2 11 4 11 C1.8 11 0 9.5 0 7.5 C0 5 2.5 3 4 0 Z" fill="rgba(200,240,255,.75)" stroke="#fff" stroke-width=".5"/><circle cx="2.8" cy="7" r="1" fill="#fff"/></svg>';
  const gl = '<svg width="18" height="18" viewBox="-9 -9 18 18" style="position:absolute;left:-9px;top:-9px;overflow:visible;filter:drop-shadow(0 0 5px rgba(224,242,254,.95))"><path d="M0 -9 L1.6 -1.6 L9 0 L1.6 1.6 L0 9 L-1.6 1.6 L-9 0 L-1.6 -1.6 Z" fill="#F0F9FF"/></svg>';
  for (let i = 0; i < (m ? 6 : 10); i++) {
    const x = W * rr(gx[0], gx[1]), y0 = H * rr(.05, .3), gy = gyAt(x) - 2 * k, fall = gy - y0, dl = rr(0, 4.2), dd = rr(2.4, 3.4);
    fx1(gl, x, y0, [{ transform: 'scale(0) rotate(0deg)', opacity: 0 }, { transform: 'scale(1.2) rotate(45deg)', opacity: 1, offset: .5 }, { transform: 'scale(0) rotate(90deg)', opacity: 0 }], dd * .4, dl);
    fx1(drop, x, y0, [{ transform: 'translate(0,0) scale(.2)', opacity: 0 }, { transform: 'translate(0,0) scale(1)', opacity: 1, offset: .3 }, { transform: 'translate(0,0) scale(1)', opacity: 1, offset: .42, easing: 'cubic-bezier(.5,0,1,.7)' }, { transform: 'translate(0,' + f(fall) + 'px) scale(1,1.15)', opacity: 1, offset: .96 }, { transform: 'translate(0,' + f(fall) + 'px) scale(1.6,.3)', opacity: 0 }], dd, dl);
    fx1('<span style="position:absolute;left:-10px;top:-3px;width:20px;height:6px;box-sizing:border-box;border-radius:50%;border:1px solid rgba(200,240,255,.85);box-shadow:0 0 6px rgba(186,230,253,.7)"></span>', x, gy, [{ transform: 'scale(.2)', opacity: 0 }, { transform: 'scale(.3)', opacity: 1, offset: .1 }, { transform: 'scale(1.7)', opacity: 0 }], .8, dl + dd * .96);
    for (let j = 0; j < 3; j++) fx1(dot(rr(1.6, 2.4), '#E0F2FE', '186,230,253'), x, gy, [{ transform: 'translate(0,0)', opacity: 0 }, { transform: 'translate(' + f(rr(-4, 4)) + 'px,' + f(-rr(6, 10) * k) + 'px)', opacity: 1, offset: .4 }, { transform: 'translate(' + f(rr(-12, 12) * k) + 'px,0px)', opacity: 0 }], .6, dl + dd * .96);
  }
  return D;
};
FX.silverleaf = K => {
  const { W, H, k, m, fx1 } = K, D = 10, dir = R() < .5 ? 1 : -1, y0 = H * rr(.3, .6), X0 = dir > 0 ? -60 : W + 60, X1 = dir > 0 ? W + 60 : -60, r0 = (m ? 70 : 110) * k;
  const LEAF = '<svg width="14" height="10" viewBox="0 0 14 10" style="position:absolute;left:-7px;top:-5px;overflow:visible;filter:drop-shadow(0 0 4px rgba(226,240,236,.85))"><path d="M1 5 C4 0 10 0 13 5 C10 10 4 10 1 5 Z" fill="rgba(226,236,233,.88)" stroke="#fff" stroke-width=".5"/><path d="M1 5 H12" stroke="rgba(150,175,170,.8)" stroke-width=".5"/></svg>';
  for (let i = 0; i < (m ? 9 : 15); i++) {
    const ph = rr(0, 6.28), lag = rr(-.08, .08), N = 30, spin = rr(2, 4) * 360 * (R() < .5 ? 1 : -1), sc = rr(.7, 1.2).toFixed(2), kf = [];
    for (let j = 0; j <= N; j++) { const t = j / N, cx = X0 + (X1 - X0) * Math.min(1, Math.max(0, t + lag)), a = ph + t * Math.PI * 5 * dir, rad = r0 * (.35 + .65 * Math.sin(Math.PI * t)); kf.push({ transform: 'translate(' + f(cx + Math.cos(a) * rad) + 'px,' + f(y0 + Math.sin(a) * rad * .45 + Math.sin(t * 3.1) * 30 * k) + 'px) rotate(' + f(spin * t) + 'deg) scale(' + sc + ')', opacity: Math.min(1, t / .06, (1 - t) / .06), offset: t }); }
    fx1(LEAF, 0, 0, kf, D - .6, rr(0, .6));
  }
  for (let i = 0; i < 2; i++) {
    const yy = y0 + (i ? 40 : -50) * k, e = fx1('<svg width="' + W + '" height="120" style="position:absolute;left:0;top:-60px;overflow:visible"><path d="M0 60 Q' + f(W * .25) + ' ' + (i ? 20 : 100) + ' ' + f(W * .5) + ' 60 T' + W + ' 60" pathLength="100" stroke="rgba(226,240,236,.28)" stroke-width="1.2" fill="none" stroke-linecap="round" stroke-dasharray="18 100"/></svg>', 0, yy, [{ opacity: 0 }, { opacity: 1, offset: .15 }, { opacity: 1, offset: .75 }, { opacity: 0 }], 3.2, .6 + i * 1.6);
    e.querySelector('path').animate(dir > 0 ? [{ strokeDashoffset: '18' }, { strokeDashoffset: '-100' }] : [{ strokeDashoffset: '-100' }, { strokeDashoffset: '18' }], { duration: 3200, delay: (.6 + i * 1.6) * 1000, fill: 'both' });
  }
  return D;
};
FX.glowdand = K => {
  const { W, k, m, fx1, gyAt, gx } = K, D = 13, dir = R() < .5 ? 1 : -1, x = W * rr(gx[0] + .04, gx[1] - .04), gy = gyAt(x), hd = 46 * k, hy = gy - hd, n = m ? 12 : 20;
  fx1('<span style="position:absolute;left:-.75px;top:0;width:1.5px;height:' + f(hd) + 'px;background:linear-gradient(rgba(167,255,228,.85),rgba(46,158,116,.6))"></span>', x, hy, K.env(.06, .86), D);
  let fil = ''; for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; fil += '<path d="M0 0 L' + f(Math.cos(a) * 11) + ' ' + f(Math.sin(a) * 11) + '" stroke="rgba(230,255,240,.7)" stroke-width=".6"/>'; }
  fx1('<span style="position:absolute;left:-16px;top:-16px;width:32px;height:32px;border-radius:50%;background:radial-gradient(circle,rgba(242,255,230,.9) 0 16%,rgba(200,255,230,.35) 40%,rgba(200,255,230,0) 70%)"></span><svg width="24" height="24" viewBox="-12 -12 24 24" style="position:absolute;left:-12px;top:-12px;overflow:visible;filter:drop-shadow(0 0 4px rgba(200,255,230,.9))">' + fil + '</svg>', x, hy, [{ transform: 'scale(.4)', opacity: 0 }, { transform: 'scale(' + k.toFixed(2) + ')', opacity: 1, offset: .1 }, { transform: 'scale(' + k.toFixed(2) + ')', opacity: 1, offset: .26 }, { transform: 'scale(' + (k * .85).toFixed(2) + ')', opacity: .45, offset: .5 }, { transform: 'scale(' + (k * .7).toFixed(2) + ')', opacity: 0 }], D);
  let pr = ''; for (let i = 0; i < 6; i++) { const a = (-150 + i * 24) * Math.PI / 180; pr += '<path d="M0 0 L' + f(Math.cos(a) * 6) + ' ' + f(Math.sin(a) * 6) + '"/>'; }
  const seed = '<svg width="14" height="16" viewBox="-7 -9 14 16" style="position:absolute;left:-7px;top:-9px;overflow:visible;filter:drop-shadow(0 0 4px rgba(200,255,230,.95))"><g stroke="rgba(230,255,240,.9)" stroke-width=".6" fill="none">' + pr + '<path d="M0 0 V6"/></g><circle cy="6" r="1" fill="#F2FFB8"/></svg>';
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2, sx = x + Math.cos(a) * 9 * k, sy = hy + Math.sin(a) * 9 * k, tl = .24 + i * (.3 / n), dx = dir * rr(60, 260) * k, dy = rr(160, 400) * k, ph = rr(0, 6.28), kf = [{ transform: 'translate(' + f(sx) + 'px,' + f(sy) + 'px) rotate(0deg)', opacity: 0, offset: 0 }, { transform: 'translate(' + f(sx) + 'px,' + f(sy) + 'px) rotate(0deg)', opacity: 1, offset: .1 }, { transform: 'translate(' + f(sx) + 'px,' + f(sy) + 'px) rotate(0deg)', opacity: 1, offset: tl }];
    for (let j = 1; j <= 6; j++) { const u = j / 6, e = 1 - Math.pow(1 - u, 1.6); kf.push({ transform: 'translate(' + f(sx + dx * e + Math.sin(u * 6 + ph) * 18 * k) + 'px,' + f(sy - dy * e) + 'px) rotate(' + f(Math.sin(u * 5 + ph) * 18) + 'deg)', opacity: j === 6 ? 0 : 1, offset: tl + (1 - tl) * u }); }
    fx1(seed, 0, 0, kf, D);
  }
  return D;
};
export const NATURE_TYPES = ['wish', 'orion', 'moonbow', 'rainbow', 'milky', 'dew', 'silverleaf', 'glowdand'];
export const NATURE_POOL = [['wish', 1.8], ['orion', 1.4], ['moonbow', 1.2], ['milky', 1.3], ['dew', 1.6], ['silverleaf', 1.6], ['glowdand', 1.6]];

/**
 * Chạy 1 hiệu ứng. o: moon [x, y, cỡ] (tâm trăng, px thật) · top (lớp trên nội dung) · font · gx [từ, đến] (dải
 * mặt đất theo tỉ lệ bề ngang) · gyAt(x) (mặt đất). Trả thời lượng (s).
 */
export function runNature(type, host, m, o) {
  const fn = FX[type];
  if (!fn || !host || !host.isConnected) return 0;
  return fn(kit(host, m, o || {}));
}

/* Mốc cảnh thật trên trang (để hình bay/nguyệt thực khớp chỗ vẽ trong SkyBackground / TaskForestBackground) */
// Tâm + cỡ trăng: desktop Moon (436, -1, 64px); mobile Mặc định 46px tại x 300/390, y 50; mobile Rừng tiên 44px tại x 302/390, y 56
export const skyMoon = (W, m, elf) => (!m ? [468, 31, 64] : elf ? [W * 302 / 390 + 22, 78, 44] : [W * 300 / 390 + 23, 73, 46]);
// Mép trên đường chân trời hành tinh (.task-planet-horizon: elip rộng 124% trang, đỉnh cách đáy 165px, cao 900px)
export const horizonY = (x, W, H) => { const dx = (x - W / 2) / (W * .62); return H + 285 - 450 * Math.sqrt(Math.max(0, 1 - dx * dx)); };
