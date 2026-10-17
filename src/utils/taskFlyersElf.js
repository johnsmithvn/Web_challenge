/**
 * Vật bay + tương tác nền kiểu "Rừng tiên" — port gần nguyên văn mockup "Nhiệm vụ - Rừng tiên (Elf)":
 * EA (hình vẽ: rồng, ếch, chuồn chuồn, lá, chú lùn, ong, quả sồi, sao, chim, bướm đêm, nấm…),
 * EN (đêm: đèn lồng, đốm ma trơi, hồ ly, kỳ lân, phù thuỷ + chổi, mèo đen, tiên ngủ, người cây, cú, cá voi),
 * flyKit (đường bay Bézier + Web Animations), flySpawn (chọn & thả 1 cảnh bay), initClk/addFF (nấm, đom đóm
 * bấm được), mushPop/ffFollow/treeShake (bấm nấm / đom đóm / nền), celebrate/bigCelebrate (xong việc).
 * `s` = khoá khung như mockup: 'c' sáng desktop, 'a' tối desktop, 'cm'/'am' mobile; host lớp trên = s + '_t'.
 * Kích thước khung = kích thước thật của host; keyframe CSS mang tiền tố `tkf-` (tasks-elf.css).
 * File là code mockup chuyển sang — giữ nguyên cấu trúc cho dễ đối chiếu khi mockup đổi.
 */
import { NATURE_POOL, NATURE_TYPES, natureClick, runNature, skyMoon } from './taskNatureFx';

export const hosts = {};
// Khoá khung như mockup: c/a = sáng/tối desktop, cm/am = mobile (đặt vào data-frame của trang)
export const frameKey = (theme, isMobile) => (theme === 'light' ? 'c' : 'a') + (isMobile ? 'm' : '');
let lastPointer = null;
export const setLastPointer = (p) => { lastPointer = p; };
const motionOK = () => !(typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

const EA = {
  DRG: '<svg width="44" height="30" viewBox="0 0 44 30" style="position:absolute;inset:0;overflow:visible;filter:drop-shadow(0 0 6px rgba(94,242,194,.7))"><path d="M10 18 C4 18 0 22 -4 20 C-1 24 4 25 8 22" fill="none" stroke="#5EF2C2" stroke-width="2.4" stroke-linecap="round"/><path d="M-4 20 L-7.5 16.5 L-6 22.5 Z" fill="#A7FFE4"/><g style="transform-origin:18px 14px;animation:tkf-eFlapY .3s ease-in-out infinite alternate"><path d="M18 14 C14 4 8 0 4 2 C8 6 9 9 10 12 C12 10 15 11 18 14 Z" fill="rgba(167,255,228,.55)" stroke="#5EF2C2" stroke-width=".8"/></g><ellipse cx="18" cy="18" rx="10" ry="6.5" fill="#2BB58A"/><ellipse cx="19" cy="20.5" rx="6.5" ry="3.4" fill="#C8FFEA"/><path d="M13 23 L12 27 M21 24 L21 28" stroke="#2BB58A" stroke-width="2.2" stroke-linecap="round"/><path d="M10 13 L12 10 L13.6 13 L15.4 10.4 L16.8 13 L18.6 10.8 L19.6 13 Z" fill="#A7FFE4"/><g data-k="hd" style="transform-origin:26px 15px"><circle cx="30" cy="12" r="6.4" fill="#2BB58A"/><ellipse cx="35.5" cy="14" rx="4" ry="3" fill="#36C99A"/><circle cx="38" cy="13" r=".7" fill="#0B3B2C"/><path d="M27 7 L25.5 2.5 L29 5.6 Z M31.5 6.2 L32 1.6 L34 6 Z" fill="#FDE68A"/><circle cx="31" cy="10.6" r="1.9" fill="#fff"/><circle cx="31.6" cy="10.8" r="1" fill="#0B3B2C"/><ellipse cx="28" cy="15" rx="1.6" ry=".9" fill="#F9A8D4" opacity=".75"/></g><g style="transform-origin:18px 14px;animation:tkf-eFlapY .3s ease-in-out -.15s infinite alternate"><path d="M20 14 C18 6 14 2 10 3 C13 7 14 10 14 13 C16 12 18 12 20 14 Z" fill="rgba(200,255,236,.75)" stroke="#5EF2C2" stroke-width=".8"/></g></svg>',
  FROG: '<svg width="40" height="30" viewBox="0 0 40 30" style="position:absolute;inset:0;overflow:visible;filter:drop-shadow(0 1px 2px rgba(30,60,40,.3))"><ellipse cx="18" cy="26" rx="20" ry="4.5" fill="#4E8B5F"/><path d="M18 26 L36 23" stroke="#3B6E4A" stroke-width="1"/><path d="M8 24 C6 16 12 10 20 10 C28 10 32 16 30 24 Z" fill="#6DBE5A"/><ellipse cx="19" cy="21" rx="7" ry="4" fill="#C9EBA6"/><circle cx="14" cy="10" r="4" fill="#6DBE5A"/><circle cx="25" cy="10" r="4" fill="#6DBE5A"/><circle cx="14.6" cy="9.6" r="2.2" fill="#fff"/><circle cx="25.6" cy="9.6" r="2.2" fill="#fff"/><circle cx="15.2" cy="9.4" r="1.1" fill="#1A1A1A"/><circle cx="26.2" cy="9.4" r="1.1" fill="#1A1A1A"/><path d="M22 15.6 Q27 17.6 30 15" stroke="#2F6B34" stroke-width=".9" fill="none" stroke-linecap="round"/><g data-k="tg" style="transform-origin:29px 15.6px;transform:rotate(-32deg) scaleX(0)"><path d="M29 15.6 H99" stroke="#F472B6" stroke-width="2.2" stroke-linecap="round"/><circle cx="99" cy="15.6" r="2.3" fill="#F472B6"/></g><path d="M9 24 C5 25 4 27 7 28 M29 24 C33 25 34 27 31 28" stroke="#5AA84A" stroke-width="2" fill="none" stroke-linecap="round"/><ellipse cx="11" cy="17" rx="1.4" ry=".8" fill="#F9A8D4" opacity=".7"/></svg>',
  DFLY: '<svg width="26" height="14" viewBox="0 0 26 14" style="position:absolute;inset:0;overflow:visible;filter:drop-shadow(0 0 3px rgba(125,211,252,.8))"><g style="transform-origin:12px 6px;animation:tkf-flap .06s linear infinite alternate"><ellipse cx="9" cy="3" rx="6" ry="2" fill="rgba(186,230,253,.7)" stroke="rgba(255,255,255,.9)" stroke-width=".4" transform="rotate(-15 9 3)"/><ellipse cx="15" cy="3" rx="6" ry="2" fill="rgba(186,230,253,.7)" stroke="rgba(255,255,255,.9)" stroke-width=".4" transform="rotate(15 15 3)"/></g><path d="M1 7 H18" stroke="#0EA5E9" stroke-width="2" stroke-linecap="round"/><circle cx="20" cy="7" r="2.4" fill="#0369A1"/><circle cx="21" cy="6.2" r=".8" fill="#E0F2FE"/></svg>',
  LEAF: '<svg width="12" height="16" viewBox="0 0 12 16" style="position:absolute;left:-6px;top:-2px;overflow:visible"><path d="M6 0 C1 4 1 11 6 16 C11 11 11 4 6 0 Z" fill="#6FA86A"/><path d="M6 1 V15" stroke="#4E8B5F" stroke-width=".7"/></svg>',
  GNOME: '<svg width="34" height="30" viewBox="0 0 34 30" style="position:absolute;inset:0;overflow:visible;filter:drop-shadow(0 1px 2px rgba(30,50,30,.3))"><defs><clipPath id="gnC"><rect x="-6" y="-24" width="46" height="54"/></clipPath></defs><g clip-path="url(#gnC)"><g data-k="gn"><path d="M9 14 C8 6 12 0 17 0 C22 0 26 6 25 14 Z" fill="#E4572E"/><circle cx="13" cy="6" r="1.4" fill="#fff"/><circle cx="20" cy="4.6" r="1.2" fill="#fff"/><circle cx="21.6" cy="9.4" r="1.3" fill="#fff"/><path d="M8 14 C8 12.6 26 12.6 26 14 C26 15.4 8 15.4 8 14 Z" fill="#F4E3C8"/><ellipse cx="17" cy="19" rx="6" ry="5" fill="#FDDCC4"/><g data-k="eyes"><circle cx="14.8" cy="18.4" r=".95" fill="#2A2A2A"/><circle cx="19.2" cy="18.4" r=".95" fill="#2A2A2A"/></g><ellipse cx="17" cy="20.6" rx="1.4" ry="1.1" fill="#F49B8B"/><path d="M11.5 21 C12 27 22 27 22.5 21 C20 23 14 23 11.5 21 Z" fill="#F8FAFC"/></g></g><path d="M0 30 C0 22 6 17 14 18 C18 15 26 15 30 19 C34 21 35 26 34 30 Z" fill="#7C8B6E"/><path d="M3 24 C8 20 14 21 18 19" stroke="#9FB08E" stroke-width="1.4" fill="none"/><path d="M2 30 C6 27 10 28 13 26 M20 22 C24 21 28 22 31 25" stroke="#5E8C4F" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
  BEE: '<svg width="30" height="28" viewBox="0 0 30 28" style="position:absolute;inset:0;overflow:visible;filter:drop-shadow(0 1px 1.5px rgba(80,60,20,.35))"><g style="transform-origin:15px 7px;animation:tkf-flap .08s ease-in-out infinite alternate"><ellipse cx="11" cy="4" rx="5" ry="3.4" fill="rgba(255,255,255,.8)" stroke="#CBD5E1" stroke-width=".5"/><ellipse cx="18" cy="3.6" rx="4.4" ry="3" fill="rgba(255,255,255,.8)" stroke="#CBD5E1" stroke-width=".5"/></g><ellipse cx="15" cy="10" rx="8" ry="5.4" fill="#FACC15"/><path d="M11 5.4 V14.6 M15.4 4.6 V15.4" stroke="#1F2937" stroke-width="2"/><circle cx="23" cy="9" r="3.6" fill="#1F2937"/><circle cx="24.2" cy="8.2" r=".8" fill="#fff"/><path d="M7 10 L4.6 10.6" stroke="#1F2937" stroke-width="1.2" stroke-linecap="round"/><path d="M13 15 L12 19 M17 15 L18 19" stroke="#1F2937" stroke-width=".8"/><path d="M10 19 H20 L19 26 C17 28 13 28 11 26 Z" fill="#D97706" stroke="#92400E" stroke-width=".6"/><path d="M10 19 C12 21 18 21 20 19 L19.6 21.6 C17 23 13 23 10.4 21.6 Z" fill="#FBBF24"/></svg>',
  LEAFR: '<svg width="40" height="26" viewBox="0 0 40 26" style="position:absolute;inset:0;overflow:visible;filter:drop-shadow(0 0 6px rgba(94,242,194,.7))"><path d="M-34 19 C-22 17 -10 20 2 19" stroke="rgba(242,255,184,.6)" stroke-width="1.4" fill="none" stroke-dasharray="1 4" stroke-linecap="round"/><path d="M2 20 C10 13 28 13 38 17 C30 24 12 25 2 20 Z" fill="#2E9E74" stroke="#7DE8C4" stroke-width=".8"/><path d="M4 20 C14 18 26 17.5 36 17.4" stroke="#7DE8C4" stroke-width=".6" fill="none"/><path d="M38 17 C40 15 40 13 38.4 12.4" stroke="#2E9E74" stroke-width="1.2" fill="none" stroke-linecap="round"/><circle cx="20" cy="8" r="9" fill="rgba(242,255,184,.25)"/><g style="transform-origin:20px 8px;animation:tkf-flap .12s ease-in-out infinite alternate"><path d="M20 8 C15 0 10 2 11 6 C12 9 16 9 20 8 Z M20 8 C25 0 30 2 29 6 C28 9 24 9 20 8 Z" fill="rgba(255,255,255,.55)" stroke="rgba(255,255,255,.95)" stroke-width=".5"/></g><circle cx="20" cy="9" r="4.4" fill="#FBFFE8" style="filter:drop-shadow(0 0 5px rgba(210,255,120,1))"/><path d="M17 13 L20 15 L23 13" stroke="#F2FFB8" stroke-width="1" fill="none" stroke-linecap="round"/></svg>',
  ACORN: '<svg width="8" height="10" viewBox="0 0 8 10" style="position:absolute;inset:0;overflow:visible"><ellipse cx="4" cy="6.2" rx="3.2" ry="3.6" fill="#B45309"/><path d="M.6 4 C1 1.6 7 1.6 7.4 4 Z" fill="#78350F"/><path d="M4 1.8 V.2" stroke="#78350F" stroke-width=".9"/></svg>',
  STAR: '<svg width="16" height="16" viewBox="-8 -8 16 16" style="position:absolute;left:-8px;top:-8px;overflow:visible"><path d="M0 -8 L2 -2 L8 0 L2 2 L0 8 L-2 2 L-8 0 L-2 -2 Z" fill="#FDE047"/></svg>',
  BIRD: '<svg width="22" height="16" viewBox="0 0 22 16" style="position:absolute;inset:0;overflow:visible;filter:drop-shadow(0 1px 1.5px rgba(60,40,20,.3))"><path d="M3 9 L-2 7 L-1 11 Z" fill="#92400E"/><ellipse cx="10" cy="9.5" rx="7" ry="4.6" fill="#B45309"/><ellipse cx="11" cy="11" rx="4.6" ry="2.6" fill="#FDE68A"/><circle cx="16.6" cy="6.6" r="3.4" fill="#B45309"/><path d="M19.6 6 L22.4 6.8 L19.6 7.8 Z" fill="#F59E0B"/><circle cx="17.6" cy="6" r=".7" fill="#111"/><g style="transform-origin:10px 8px;animation:tkf-eFlapY .12s ease-in-out infinite alternate"><path d="M6 8 C8 1 13 0 15 3 C12 5 10 7 10 9 Z" fill="#92400E"/></g></svg>',
  MOTH: '<svg width="22" height="16" viewBox="0 0 22 16" style="position:absolute;inset:0;overflow:visible;filter:drop-shadow(0 0 5px rgba(94,242,194,.9))"><g style="transform-origin:11px 8px;animation:tkf-flap .1s ease-in-out infinite alternate"><path d="M11 8 C7 0 0 1 1 7 C2 10 7 10 11 8 Z M11 8 C15 0 22 1 21 7 C20 10 15 10 11 8 Z" fill="rgba(167,255,228,.6)" stroke="#C8FFEA" stroke-width=".6"/><path d="M11 8.5 C8 13 4 14 4.5 11 Z M11 8.5 C14 13 18 14 17.5 11 Z" fill="rgba(167,255,228,.45)"/></g><path d="M11 5 V12" stroke="#E8FFF4" stroke-width="1.4" stroke-linecap="round"/></svg>',
  MUSH: n => '<svg width="100%" height="100%" viewBox="0 0 20 22" style="position:absolute;inset:0;overflow:visible;filter:' + (n ? 'drop-shadow(0 0 6px rgba(94,242,194,.85))' : 'drop-shadow(0 0 4px rgba(253,224,71,.6))') + '"><path d="M8 11 C8 16 7 19 6 22 H14 C13 19 12 16 12 11 Z" fill="#FFF7E6"/><path d="M1 11 C1 5 5 1 10 1 C15 1 19 5 19 11 C15 12.4 5 12.4 1 11 Z" fill="' + (n ? '#2BB58A' : '#F59E0B') + '"/><circle cx="6" cy="6.4" r="1.4" fill="' + (n ? '#C8FFEA' : '#FFF7E6') + '"/><circle cx="11.6" cy="4" r="1.1" fill="' + (n ? '#C8FFEA' : '#FFF7E6') + '"/><circle cx="14.6" cy="8" r="1.3" fill="' + (n ? '#C8FFEA' : '#FFF7E6') + '"/></svg>',
  PIGEON: '<svg width="36" height="28" viewBox="0 0 36 28" style="position:absolute;inset:0;overflow:visible;filter:drop-shadow(0 1px 2px rgba(60,60,80,.25))"><ellipse cx="16" cy="16" rx="10" ry="7" fill="#F1F5F9" stroke="#CBD5E1" stroke-width=".6"/><circle cx="25" cy="11" r="5" fill="#F8FAFC"/><path d="M28.5 10.5 L34 11.5 L28.5 13 Z" fill="#F59E0B"/><circle cx="26" cy="10" r=".9" fill="#1E293B"/><ellipse cx="15" cy="18" rx="7" ry="4" fill="#E2E8F0"/><g style="transform-origin:14px 13px;animation:tkf-eFlapY .16s ease-in-out infinite alternate"><path d="M14 13 C12 4 4 1 0 4 C4 9 7 13 14 14 Z" fill="#E2E8F0" stroke="#CBD5E1" stroke-width=".6"/></g><g data-k="letter" style="transform-origin:30px 14px"><rect x="28" y="13" width="9" height="7" rx="1" fill="#FFF" stroke="#E2E8F0" stroke-width=".6"/><path d="M28 13 L32.5 17 L37 13" stroke="#CBD5E1" stroke-width=".6" fill="none"/><path d="M31.5 15.5 C31.5 14.8 32.2 14.2 32.5 14.6 C32.8 14.2 33.5 14.8 33.5 15.5 C33.5 16.2 32.5 16.8 32.5 16.8 C32.5 16.8 31.5 16.2 31.5 15.5 Z" fill="#F43F5E"/></g></svg>',
  LETTER: '<div style="position:absolute;left:-14px;top:-10px;width:28px;height:20px;border-radius:2px;background:#FFFDF7;box-shadow:0 2px 8px rgba(0,0,0,.15);border:1px solid #FBCFE8;display:flex;align-items:center;justify-content:center"><svg width="12" height="10" viewBox="0 0 12 10"><path d="M6 9 C6 9 1 5.5 1 2.8 C1 1.2 2.2 0 3.7 0 C4.7 0 5.5 .6 6 1.4 C6.5 .6 7.3 0 8.3 0 C9.8 0 11 1.2 11 2.8 C11 5.5 6 9 6 9 Z" fill="#F43F5E"/></svg></div>',
  HAMMER: '<svg width="20" height="20" viewBox="0 0 20 20" style="position:absolute;inset:0;overflow:visible"><rect x="8" y="1" width="10" height="6" rx="1" fill="#71717A" stroke="#3F3F46" stroke-width=".7"/><rect x="6" y="2" width="2" height="4" fill="#A1A1AA"/><rect x="18" y="2" width="2" height="4" fill="#A1A1AA"/><rect x="2" y="3" width="14" height="2.4" rx="1" transform="rotate(45 9 4)" fill="#A16207"/></svg>',
  UFO_TINY: '<svg width="48" height="24" viewBox="0 0 48 24" style="position:absolute;inset:0;overflow:visible;filter:drop-shadow(0 0 8px rgba(94,242,194,.8))"><path d="M16 10 Q16 2 24 2 Q32 2 32 10 Z" fill="rgba(167,255,228,.5)" stroke="#5EF2C2" stroke-width=".8"/><ellipse cx="24" cy="12" rx="22" ry="6" fill="#132E24" stroke="#5EF2C2" stroke-width="1.2"/><ellipse cx="24" cy="11" rx="15" ry="3" fill="#2E6B56"/><circle cx="9" cy="13" r="1.5" fill="#FDE68A"/><circle cx="16" cy="15" r="1.5" fill="#A7FFE4"/><circle cx="24" cy="16" r="1.5" fill="#FDE68A"/><circle cx="32" cy="15" r="1.5" fill="#A7FFE4"/><circle cx="39" cy="13" r="1.5" fill="#FDE68A"/></svg>',
  BUNNY: '<svg width="32" height="36" viewBox="0 0 32 36" style="position:absolute;inset:0;overflow:visible;filter:drop-shadow(0 0 6px rgba(255,255,255,.9))"><path d="M9 16 C6 8 6 0 9 0 C12 0 13 8 11 16 Z M23 16 C26 8 26 0 23 0 C20 0 19 8 21 16 Z" fill="#FFF"/><path d="M9.5 13 C8 7 8 2 9.5 2 C11 2 11.5 7 10.5 13 Z M22.5 13 C24 7 24 2 22.5 2 C21 2 20.5 7 21.5 13 Z" fill="#FBCFE8"/><ellipse cx="16" cy="22" rx="10" ry="9" fill="#FFF"/><ellipse cx="16" cy="24" rx="1.6" ry="1.1" fill="#F472B6"/><circle cx="12" cy="20" r="1.4" fill="#1E293B"/><circle cx="20" cy="20" r="1.4" fill="#1E293B"/><circle cx="12.5" cy="19.5" r=".4" fill="#FFF"/><circle cx="20.5" cy="19.5" r=".4" fill="#FFF"/><ellipse cx="9" cy="23" rx="2" ry="1.1" fill="#FDA4AF" opacity=".7"/><ellipse cx="23" cy="23" rx="2" ry="1.1" fill="#FDA4AF" opacity=".7"/><path d="M14 26 Q16 27.5 18 26" stroke="#1E293B" stroke-width=".8" fill="none" stroke-linecap="round"/></svg>',
  CW: [[[.05,.32],[.2,.16],[.42,.1],[.66,.12],[.86,.24],[1,.4],[.84,.5],[.6,.56],[.34,.54],[.15,.46],[.05,.32]], [[.05,.32],[-.12,.18],[-.12,.46],[.05,.32]], [[.5,.55],[.42,.68]]],
  CD: [[[.12,.42],[.22,.32],[.6,.32],[.7,.36],[.62,.5],[.2,.52],[.12,.42]], [[.6,.32],[.72,.12],[.84,.1],[.86,.18],[.74,.22]], [[.72,.12],[.66,-.04]], [[.78,.11],[.86,-.06]], [[.24,.52],[.22,.8]], [[.58,.5],[.6,.8]]]
};
const ENL = (i, o, d, c, w) => '<g data-leg="' + i + '" style="transform-origin:' + o + '"><path d="' + d + '" stroke="' + c + '" stroke-width="' + w + '" stroke-linecap="round" fill="none"/></g>';
const EN = {
  LANT: '<div style="position:absolute;left:-10px;top:-8px;width:34px;height:38px;border-radius:50%;background:radial-gradient(closest-side,rgba(253,224,130,.5),rgba(253,224,130,0));animation:tkf-twinkleB 1.6s ease-in-out infinite"></div><span style="position:absolute;left:6.5px;top:-6px;width:1px;height:7px;background:rgba(227,194,122,.8)"></span><span style="position:absolute;left:2px;top:1px;width:10px;height:2px;border-radius:1px;background:#8A6416"></span><span style="position:absolute;left:1px;top:3px;width:12px;height:14px;border-radius:40%;background:radial-gradient(60% 60% at 50% 55%,#FFF7D6,#FCD34D 55%,#F59E0B);box-shadow:0 0 10px 3px rgba(252,211,77,.55)"></span><span style="position:absolute;left:2px;top:17px;width:10px;height:2px;border-radius:1px;background:#8A6416"></span><span style="position:absolute;left:6.5px;top:19px;width:1px;height:4px;background:rgba(227,194,122,.8)"></span>',
  FF: '<span style="position:absolute;left:-10px;top:-10px;width:20px;height:20px;border-radius:50%;background:radial-gradient(closest-side,rgba(210,255,120,.5),rgba(210,255,120,0))"></span><span style="position:absolute;left:-2px;top:-2px;width:4px;height:4px;border-radius:50%;background:#F2FFB8;box-shadow:0 0 6px 2px rgba(210,255,120,.85)"></span>',
  WISP: '<div style="position:absolute;left:-14px;top:-11px;width:48px;height:48px;border-radius:50%;background:radial-gradient(closest-side,rgba(125,211,252,.45),rgba(125,211,252,0));animation:tkf-twinkleB 1.4s ease-in-out infinite"></div><svg width="20" height="26" viewBox="0 0 20 26" style="position:absolute;inset:0;overflow:visible;filter:drop-shadow(0 0 6px rgba(125,211,252,.95))"><g style="transform-origin:10px 22px;animation:tkf-eWob .6s ease-in-out infinite alternate"><path d="M10 0 C13 6 18 10 18 16 C18 21 14 25 10 25 C6 25 2 21 2 16 C2 11 7 8 10 0 Z" fill="rgba(186,230,253,.7)"/><path d="M10 8 C12 12 14 14 14 17 C14 20 12 22 10 22 C8 22 6 20 6 17 C6 14 9 12 10 8 Z" fill="#F0F9FF"/></g><circle cx="8.2" cy="17" r=".9" fill="#0C4A6E"/><circle cx="11.8" cy="17" r=".9" fill="#0C4A6E"/></svg>',
  FOX: '<svg width="64" height="36" viewBox="0 0 64 36" style="position:absolute;inset:0;overflow:visible;filter:drop-shadow(0 0 6px rgba(125,211,252,.85))">' + Array.from({ length: 9 }, (_, i) => { const th = (165 + i * 11.5) * Math.PI / 180, L = 20 + (i % 3) * 3, tx = 20 + Math.cos(th) * L, ty = 19 + Math.sin(th) * L, mx = (20 + tx) / 2, my = (19 + ty) / 2, px = -Math.sin(th) * 4.5, py = Math.cos(th) * 4.5; return '<g style="transform-origin:20px 19px;animation:tkf-eTail ' + (.5 + (i % 4) * .12).toFixed(2) + 's ease-in-out ' + (-i * .13).toFixed(2) + 's infinite alternate"><path d="M20 19 Q' + (mx + px).toFixed(1) + ' ' + (my + py).toFixed(1) + ' ' + tx.toFixed(1) + ' ' + ty.toFixed(1) + ' Q' + (mx - px).toFixed(1) + ' ' + (my - py).toFixed(1) + ' 20 19 Z" fill="rgba(125,211,252,.5)" stroke="#BAE6FD" stroke-width=".7"/></g>'; }).join('') + ENL(1, '26px 23px', 'M26 23 L24 34', '#C9D9EA', 2.4) + ENL(2, '46px 22px', 'M46 22 L48 34', '#C9D9EA', 2.4) + '<path d="M20 21 C19 15 27 13 37 14 C45 15 49 13 51 11 L55 9 C59 11 59 17 55 21 C51 25 31 27 24 25.5 C21 24.5 20 23 20 21 Z" fill="#EEF6FF"/><path d="M49 13 C50 7 54 4 58 5 L63 9.5 C64 11.5 62.5 13 60 13 C58 15 54 16 51 16.5 Z" fill="#F5FAFF"/><path d="M52 7 L52.5 .5 L56 5.5 Z M56 5 L59 0 L59.5 6 Z" fill="#F5FAFF"/><path d="M53 5.5 L53.3 2.4 M57.2 4.6 L58.6 2" stroke="#7DD3FC" stroke-width=".8"/><circle cx="57.5" cy="8.6" r=".95" fill="#0B1A2A"/><circle cx="63" cy="10.6" r=".8" fill="#0B1A2A"/><path d="M42 15.5 Q47 17.5 52 15.5" stroke="#7DD3FC" stroke-width=".8" fill="none"/>' + ENL(0, '29px 23px', 'M29 23 L30 34', '#EEF6FF', 2.6) + ENL(3, '50px 21px', 'M50 21 L52 34', '#EEF6FF', 2.6) + '</svg>',
  UNI: '<svg width="90" height="80" viewBox="0 0 90 80" style="position:absolute;inset:0;overflow:visible;filter:drop-shadow(0 0 8px rgba(233,213,255,.85)) drop-shadow(0 2px 3px rgba(20,30,40,.3))">' + ENL(1, '30px 50px', 'M30 49 L28 64 L27 77', '#E4DDF2', 3.2) + ENL(2, '57px 49px', 'M57 48 L59 63 L58 77', '#E4DDF2', 3.2) + '<g style="transform-origin:19px 40px;animation:tkf-eTail 1.6s ease-in-out infinite alternate"><path d="M19 40 C9 38 5 46 8 58 C10 51 14 47 19 45 Z" fill="#C4B5FD"/><path d="M19 42 C12 42 9 48 11 55 C13 50 16 47 19 46 Z" fill="#F9A8D4"/></g><path d="M18 40 C17 33 26 30 40 31 C52 32 58 30 62 27 L66 24 C70 30 68 40 63 47 C57 54 34 55 25 52 C19 50 18 45 18 40 Z" fill="#FFFFFF"/><g data-k="head" style="transform-origin:62px 34px"><path d="M60 30 C62 24 64 18 68 15 C72 12 78 13 81 17 C84 20 85 23 83 25.5 C80 26.5 76 25.5 72 27 C69 29 67 33 66 38 Z" fill="#FFFFFF"/><path d="M67 15 C60 17 58 25 59 33 C61 27 63 23 66 21 Z" fill="#C4B5FD"/><path d="M65 18 C60 20 57 25 56 30 C59 27 62 24 65 22 Z" fill="#F9A8D4"/><path d="M69 14 L67 8 L72 12 Z" fill="#F3EEFF"/><path d="M73 13 L80 -3 L76 14 Z" fill="#FDE68A" stroke="#FFF7D6" stroke-width=".6"/><path d="M74.5 9 L78 8 M75.5 5 L78.5 4" stroke="#E3B04B" stroke-width=".6"/><circle data-k="hg" cx="79.6" cy="-2.5" r="5" fill="rgba(255,247,214,.9)" style="opacity:0"/><circle cx="76" cy="18.6" r="1.2" fill="#2E2A3B"/><circle cx="83.4" cy="23.4" r="1" fill="#C7B8D8"/></g>' + ENL(0, '34px 50px', 'M34 50 L35 64 L34 78', '#FFFFFF', 3.4) + ENL(3, '61px 47px', 'M61 46 L64 62 L64 78', '#FFFFFF', 3.4) + '</svg>',
  WITCH: '<svg width="56" height="34" viewBox="0 0 56 34" style="position:absolute;inset:0;overflow:visible;filter:drop-shadow(0 0 2px rgba(167,255,228,.6))"><g data-k="broom"><path d="M2 25 L55 18" stroke="#3A2A18" stroke-width="2" stroke-linecap="round"/><path d="M5 25 L-9 18 L-11 25 L-8 31 Z" fill="#5A4024"/><path d="M-8 20 L3 24 M-10 25 L3 25.5 M-8 30 L3 26.5" stroke="#7A5A34" stroke-width=".6"/></g><g style="transform-origin:26px 11px;animation:tkf-eRibbon .5s ease-in-out infinite alternate"><path d="M27 10 C19 9 11 14 3 11 C9 16 17 19 25 18 Z" fill="#1E3A2E"/></g><path d="M22 23 C20 15 24 9 30 9 C34 9 36 13 36 17 L41 23 C35 25 28 25 22 23 Z" fill="#0A1410"/><path d="M33 22 L37 28 L41 28.5" stroke="#0A1410" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="32.5" cy="6.5" r="3.6" fill="#0A1410"/><path d="M26 4.5 L40 3.6 L35 -2 L32 -11 L30 -3 Z" fill="#0A1410"/><path d="M24.5 5 L42 3.4" stroke="#0A1410" stroke-width="1.8" stroke-linecap="round"/><path d="M35.8 6.2 L37.4 7" stroke="#FDE68A" stroke-width=".8"/></svg>',
  BROOM: '<svg width="66" height="16" viewBox="-11 16 66 16" style="position:absolute;left:-33px;top:-8px;overflow:visible"><path d="M2 25 L55 18" stroke="#3A2A18" stroke-width="2" stroke-linecap="round"/><path d="M5 25 L-9 18 L-11 25 L-8 31 Z" fill="#5A4024"/><path d="M-8 20 L3 24 M-10 25 L3 25.5 M-8 30 L3 26.5" stroke="#7A5A34" stroke-width=".6"/></svg>',
  CAT: '<svg width="34" height="34" viewBox="0 0 34 34" style="position:absolute;inset:0;overflow:visible"><g data-k="bd" style="filter:drop-shadow(0 0 3px rgba(167,255,228,.4))"><g style="transform-origin:10px 30px;animation:tkf-eTail 1.8s ease-in-out infinite alternate"><path d="M10 31 C2 31 0 23 4 17" stroke="#050B09" stroke-width="2.6" fill="none" stroke-linecap="round"/></g><path d="M8 33 C6 25 10 17 17 17 C24 17 27 25 25 33 Z" fill="#050B09"/><circle cx="18" cy="12" r="6.5" fill="#050B09"/><path d="M12.5 8.5 L12 1 L17 6 Z M19 6 L24 1 L23.5 8.5 Z" fill="#050B09"/></g><g style="filter:drop-shadow(0 0 3px #D9F99D)"><g style="transform-origin:18px 12px;animation:tkf-eBlink 3.6s infinite"><ellipse cx="15.3" cy="12" rx="1.8" ry="2.1" fill="#D9F99D"/><ellipse cx="15.3" cy="12" rx=".55" ry="1.7" fill="#050B09"/><g data-k="eR" style="transform-origin:21px 12px"><ellipse cx="21" cy="12" rx="1.8" ry="2.1" fill="#D9F99D"/><ellipse cx="21" cy="12" rx=".55" ry="1.7" fill="#050B09"/></g></g></g></svg>',
  FAIRY: '<svg width="40" height="44" viewBox="0 0 40 44" style="position:absolute;inset:0;overflow:visible;filter:drop-shadow(0 0 7px rgba(244,171,226,.75))"><path d="M20 44 C20 36 21 30 20 26" stroke="#2E9E74" stroke-width="1.6" fill="none"/><path d="M20 37 C14 35 11 31 12 29 C16 30 19 33 20 37 Z" fill="#2E9E74"/><path d="M4 14 C4 26 12 28 20 28 C28 28 36 26 36 14 C30 20 26 20 20 20 C14 20 10 20 4 14 Z" fill="rgba(232,160,220,.85)"/><ellipse cx="13" cy="15" rx="5.5" ry="3" fill="rgba(200,240,255,.65)" stroke="rgba(255,255,255,.8)" stroke-width=".4" transform="rotate(-25 13 15)" style="animation:tkf-twinkleB 2.4s ease-in-out infinite"/><ellipse cx="21" cy="19.5" rx="6" ry="3.4" fill="#BFF5DA"/><circle cx="27" cy="16.5" r="3.4" fill="#FFE4D6"/><path d="M24 15.5 C24 12.5 28 11.5 30.4 13.6 C29 13.4 27 13.6 25.6 15.6 Z" fill="#FCD34D"/><path d="M26.6 17 Q27.6 17.8 28.6 17" stroke="#7C4A3A" stroke-width=".6" fill="none"/><path d="M6 18 C8 26 14 28 20 28 C26 28 32 26 34 18 C30 23 26 24 20 24 C14 24 10 23 6 18 Z" fill="rgba(249,168,212,.92)"/><circle cx="12" cy="22" r=".8" fill="#FFF7D6"/><circle cx="28" cy="23" r=".7" fill="#FFF7D6"/></svg>',
  ENT: '<svg width="160" height="140" viewBox="-30 0 160 140" style="position:absolute;inset:0;overflow:visible;-webkit-mask-image:linear-gradient(transparent,#000 22%,#000 78%,transparent);mask-image:linear-gradient(transparent,#000 22%,#000 78%,transparent)"><path d="M22 140 C24 100 20 60 26 0 L74 0 C80 60 76 100 78 140 Z" fill="#10231B" stroke="rgba(94,242,194,.2)" stroke-width="1"/><path d="M34 6 C32 40 36 64 33 120 M66 10 C68 50 64 80 67 126 M50 92 C48 108 52 122 50 138 M44 14 C46 24 42 30 44 38" stroke="#08130F" stroke-width="2" fill="none" stroke-linecap="round"/><g data-k="armL" style="transform-origin:26px 44px"><path d="M26 44 C14 38 4 28 -8 24 M8 32 C4 24 0 20 -4 13" stroke="#10231B" stroke-width="5" fill="none" stroke-linecap="round"/></g><g data-k="armR" style="transform-origin:74px 44px"><path d="M74 44 C86 38 96 28 108 24 M92 32 C96 24 100 20 104 13" stroke="#10231B" stroke-width="5" fill="none" stroke-linecap="round"/></g><path d="M29 45 Q37 40 46 45 M54 45 Q63 40 71 45" stroke="#08130F" stroke-width="3.2" fill="none" stroke-linecap="round"/><g data-k="eyes" style="transform-origin:50px 52px;filter:drop-shadow(0 0 5px rgba(253,230,138,.95))"><ellipse cx="38" cy="52" rx="5" ry="4" fill="#FDE68A"/><ellipse cx="62" cy="52" rx="5" ry="4" fill="#FDE68A"/><circle cx="38.6" cy="52.4" r="1.7" fill="#3A2A10"/><circle cx="61.4" cy="52.4" r="1.7" fill="#3A2A10"/></g><path d="M42 64 Q50 62 58 64" stroke="#08130F" stroke-width="2" fill="none"/><g data-k="mouth" style="transform-origin:50px 74px"><ellipse cx="50" cy="74" rx="8" ry="7" fill="#040A08" stroke="rgba(94,242,194,.35)" stroke-width="1"/></g></svg>',
  OWL: '<svg width="30" height="34" viewBox="0 0 30 34" style="position:absolute;inset:0;overflow:visible;filter:drop-shadow(0 0 5px rgba(94,242,194,.35))"><g data-k="wings" style="opacity:0"><g style="transform-origin:15px 18px;animation:tkf-eFlapY .22s ease-in-out infinite alternate"><path d="M7 18 C-4 10 -9 15 -11 21 C-3 19 2 21 7 23 Z M23 18 C34 10 39 15 41 21 C33 19 28 21 23 23 Z" fill="#3B4A44" stroke="rgba(167,255,228,.35)" stroke-width=".6"/></g></g><path d="M6 27 C4 18 6 12 15 11 C24 12 26 18 24 27 C22 32 8 32 6 27 Z" fill="#3B4A44" stroke="rgba(167,255,228,.3)" stroke-width=".6"/><path d="M10 25 C10 19 12 17 15 17 C18 17 20 19 20 25 Z" fill="#56685F"/><path d="M5 10 C4 4 9 1 15 1 C21 1 26 4 25 10 C24 15 6 15 5 10 Z" fill="#46574F" stroke="rgba(167,255,228,.3)" stroke-width=".6"/><path d="M6 3.5 L5 -1 L9.5 2 Z M24 3.5 L25 -1 L20.5 2 Z" fill="#46574F"/><circle cx="10.5" cy="8" r="3.4" fill="#0E1A16"/><circle cx="19.5" cy="8" r="3.4" fill="#0E1A16"/><g style="transform-origin:15px 8px;animation:tkf-eBlink 3.4s infinite"><circle cx="10.5" cy="8" r="2.4" fill="#5EF2C2"/><circle cx="19.5" cy="8" r="2.4" fill="#5EF2C2"/><circle cx="10.8" cy="8.1" r="1" fill="#04140D"/><circle cx="19.8" cy="8.1" r="1" fill="#04140D"/></g><path d="M14 10.6 L15 13 L16 10.6 Z" fill="#E3C27A"/><path d="M11 30 L10 33 M19 30 L20 33" stroke="#E3C27A" stroke-width="1.3" stroke-linecap="round"/><g data-k="soot" style="opacity:0"><ellipse cx="11" cy="20" rx="4" ry="3" fill="#151A18"/><ellipse cx="20" cy="24" rx="3.5" ry="2.6" fill="#151A18"/><ellipse cx="16" cy="3" rx="4" ry="2" fill="#151A18"/><path d="M13 -2 C12 -6 15 -8 14 -12 M18 -1 C19 -5 16 -7 18 -11" stroke="rgba(160,170,165,.6)" stroke-width="1" fill="none" stroke-linecap="round"/></g></svg>',
  WHALE: '<svg width="220" height="90" viewBox="0 0 220 90" style="position:absolute;inset:0;overflow:visible;filter:drop-shadow(0 0 14px rgba(94,242,194,.45))"><g style="transform-origin:24px 50px;animation:tkf-eTail 2.6s ease-in-out infinite alternate"><path d="M26 50 C16 44 8 38 -8 28 C-2 38 0 45 3 50 C0 55 -2 62 -8 72 C8 62 16 56 26 50 Z" fill="rgba(36,74,92,.6)" stroke="rgba(167,255,228,.65)" stroke-width="1"/></g><path d="M20 50 C30 26 80 14 130 18 C170 21 200 34 214 47 C218 51 216 57 210 60 C190 70 150 78 110 76 C70 74 34 68 20 50 Z" fill="rgba(36,74,92,.62)" stroke="rgba(167,255,228,.7)" stroke-width="1.2"/><path d="M96 70 C130 72 172 66 204 56 M100 64 C134 66 170 60 198 51" stroke="rgba(167,255,228,.35)" stroke-width="1" fill="none"/><g style="transform-origin:134px 62px;animation:tkf-eTail 3.2s ease-in-out -.8s infinite alternate"><path d="M134 62 C132 76 124 86 110 90 C116 80 120 70 122 62 Z" fill="rgba(36,74,92,.7)" stroke="rgba(167,255,228,.55)" stroke-width="1"/></g><circle cx="192" cy="44" r="2.6" fill="#A7FFE4"/></svg>',
  LEAF: '<svg width="14" height="10" viewBox="0 0 14 10" style="position:absolute;inset:0;overflow:visible;filter:drop-shadow(0 0 4px rgba(226,240,236,.85))"><path d="M1 5 C4 0 10 0 13 5 C10 10 4 10 1 5 Z" fill="rgba(226,236,233,.85)" stroke="#fff" stroke-width=".5"/><path d="M1 5 H12" stroke="rgba(150,175,170,.8)" stroke-width=".5"/></svg>',
  POTION: '<svg width="18" height="24" viewBox="0 0 18 24" style="position:absolute;left:-9px;top:-12px;overflow:visible;filter:drop-shadow(0 0 8px rgba(192,132,252,.9))"><path d="M7 2 H11 V5 H7 Z" fill="#854D0E"/><rect x="6" y="5" width="6" height="3" rx=".5" fill="#E2E8F0" opacity=".8"/><path d="M6 7 C2 10 1 14 1 18 C1 21 4 23 9 23 C14 23 17 21 17 18 C17 14 16 10 12 7 Z" fill="rgba(192,132,252,.45)" stroke="#C084FC" stroke-width="1"/><ellipse cx="9" cy="18" rx="6" ry="3.5" fill="#A855F7"/><circle cx="7" cy="16" r="1.2" fill="#F3E8FF"/><circle cx="11" cy="14" r=".8" fill="#F3E8FF"/></svg>',
  LOTUS: '<svg width="60" height="50" viewBox="0 0 60 50" style="position:absolute;inset:0;overflow:visible;filter:drop-shadow(0 0 12px rgba(94,242,194,.95))"><path d="M6 42 C16 46 44 46 54 42 C46 48 14 48 6 42 Z" fill="#103B2C"/><ellipse cx="30" cy="42" rx="28" ry="6" fill="#134E39" stroke="#5EF2C2" stroke-width=".8"/><g data-k="petals" style="transform-origin:30px 40px"><path d="M30 40 C14 36 6 22 14 14 C22 22 26 34 30 40 Z" fill="rgba(167,255,228,.7)" stroke="#A7FFE4" stroke-width=".7"/><path d="M30 40 C46 36 54 22 46 14 C38 22 34 34 30 40 Z" fill="rgba(167,255,228,.7)" stroke="#A7FFE4" stroke-width=".7"/><path d="M30 40 C20 34 16 16 24 8 C30 16 30 30 30 40 Z" fill="rgba(200,255,236,.85)" stroke="#C8FFEA" stroke-width=".7"/><path d="M30 40 C40 34 44 16 36 8 C30 16 30 30 30 40 Z" fill="rgba(200,255,236,.85)" stroke="#C8FFEA" stroke-width=".7"/><path d="M30 40 C26 30 26 12 30 4 C34 12 34 30 30 40 Z" fill="#FFF7ED" stroke="#FDE68A" stroke-width=".8"/></g><circle cx="30" cy="22" r="3.5" fill="#FDE68A" style="filter:drop-shadow(0 0 6px #FDE68A)"/></svg>'
};

function flyKit(host, m) {
  const W = host.clientWidth || (m ? 390 : 1440), H = host.clientHeight || (m ? 844 : 900), k = m ? .72 : 1, R = Math.random, rr = (a, b) => a + R() * (b - a);
  const ln = (a, b, t0, t1, n = 3) => ({ p: [a, [a[0] + (b[0] - a[0]) / 3, a[1] + (b[1] - a[1]) / 3], [a[0] + (b[0] - a[0]) * 2 / 3, a[1] + (b[1] - a[1]) * 2 / 3], b], t: [t0, t1], n });
  const cr = (Q, n = 8) => Q.slice(0, -1).map((a, i) => { const b = Q[i + 1], pa = Q[i - 1] || a, pb = Q[i + 2] || b; return { p: [a, [a[0] + (b[0] - pa[0]) / 6, a[1] + (b[1] - pa[1]) / 6], [b[0] - (pb[0] - a[0]) / 6, b[1] - (pb[1] - a[1]) / 6], b], t: [a[2], b[2]], n }; });
  const bz = (s, u) => { const [a, b, c, d] = s.p, v = 1 - u; return [v * v * v * a[0] + 3 * v * v * u * b[0] + 3 * v * u * u * c[0] + u * u * u * d[0], v * v * v * a[1] + 3 * v * v * u * b[1] + 3 * v * u * u * c[1] + u * u * u * d[1]]; };
  const at = (segs, t) => { const s = segs.find(z => t <= z.t[1]) || segs[segs.length - 1]; return bz(s, Math.max(0, Math.min(1, (t - s.t[0]) / ((s.t[1] - s.t[0]) || 1)))); };
  const fly = (art, w, h, segs, dur, o = {}) => {
    const el = document.createElement('div'), fl = !!o.flip, tk = o.tk ?? 0, kz = o.k ?? k, dl = (o.delay || 0) * 1000;
    el.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;pointer-events:none;will-change:transform';
    el.innerHTML = '<div style="position:absolute;left:' + (-w / 2) + 'px;top:' + (-h / 2) + 'px;width:' + w + 'px;height:' + h + 'px;transform:scale(' + (fl ? -kz : kz) + ',' + kz + ')"><div style="position:relative;width:100%;height:100%;' + (o.inner || '') + '">' + art + '</div></div>';
    const pts = [];
    segs.forEach((s, si) => { const n = s.n || 8; for (let i = si ? 1 : 0; i <= n; i++) { const u = i / n, q = bz(s, u); pts.push({ x: q[0], y: q[1], o: s.t[0] + (s.t[1] - s.t[0]) * u }); } });
    let prev = null;
    const kf = pts.map((q, i) => {
      const a = pts[Math.min(i + 1, pts.length - 1)], b = pts[Math.max(i - 1, 0)], dx = a.x - b.x, dy = a.y - b.y;
      let g;
      if (Math.hypot(dx, dy) < .01) g = prev ?? 0;
      else if (tk === 1) { g = Math.atan2(dy, dx) * 180 / Math.PI - (fl ? 180 : 0); if (prev == null) g = ((g % 360) + 540) % 360 - 180; else { while (g - prev > 180) g -= 360; while (g - prev < -180) g += 360; } }
      else g = (fl ? -1 : 1) * Math.atan2(dy, Math.abs(dx)) * 180 / Math.PI;
      prev = g;
      const f = { transform: 'translate(' + q.x.toFixed(1) + 'px,' + q.y.toFixed(1) + 'px) rotate(' + (tk === 1 ? g : g * tk).toFixed(1) + 'deg)' + (o.scf ? ' scale(' + o.scf(q.o).toFixed(3) + ')' : ''), offset: Math.min(1, Math.max(0, q.o)) };
      if (o.opf) f.opacity = Math.max(0, Math.min(1, o.opf(q.o)));
      return f;
    });
    host.appendChild(el);
    el.animate(kf, { duration: dur * 1000, delay: dl, easing: o.ease || 'linear', fill: 'both' }).onfinish = () => el.remove();
    (o.sync || []).forEach(([sel, fr]) => el.querySelectorAll(sel).forEach(t => t.animate(fr, { duration: dur * 1000, delay: dl, fill: 'both' })));
    if (o.on) o.on(el, dur * 1000, dl);
    return el;
  };
  const fx1 = (html, x, y, fr, dur, delay = 0) => { const e = document.createElement('div'); e.style.cssText = 'position:absolute;left:' + x.toFixed(1) + 'px;top:' + y.toFixed(1) + 'px;width:0;height:0;pointer-events:none'; e.innerHTML = html; host.appendChild(e); e.animate(fr, { duration: dur * 1000, delay: delay * 1000, fill: 'both' }).onfinish = () => e.remove(); return e; };
  const walk = (el, ms, dl, p0, p1, per, amp) => { const an = [...el.querySelectorAll('[data-leg]')].map(g => g.animate([{ transform: 'rotate(' + (-amp) + 'deg)' }, { transform: 'rotate(' + amp + 'deg)' }], { duration: per, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out', delay: dl - (+g.dataset.leg % 2 ? per : 0) })); if (p0 != null) { setTimeout(() => an.forEach(a => a.pause()), dl + ms * p0); setTimeout(() => an.forEach(a => a.play()), dl + ms * p1); } setTimeout(() => an.forEach(a => a.cancel()), dl + ms + 100); };
  const dot = (sz, c, g) => '<span style="position:absolute;left:' + (-sz / 2).toFixed(1) + 'px;top:' + (-sz / 2).toFixed(1) + 'px;width:' + sz.toFixed(1) + 'px;height:' + sz.toFixed(1) + 'px;border-radius:50%;background:' + c + ';box-shadow:0 0 6px 2px rgba(' + g + ',.85)"></span>';
  return { W, H, k, R, rr, ln, cr, at, fly, fx1, walk, dot };
}

function flySpawn(host, m, night) {
  const { W, H, k, R, rr, ln, cr, at, fly, fx1, walk, dot } = flyKit(host, m);
  const pool = (night ? [['lanterns', 2.5], ['owl', 2], ['koi', 2], ['veins', 2], ['ring', 1.5], ['starfall', 2], ['spirit', 1], ['bloom', 2.2], ['whale', 1.6], ['koistar', 1.6], ['owlmiss', 1.6], ['spiritbow', 1.2], ['dragon', 2], ['leafrider', 2], ['constel', 1.6], ['whaleeat', 1.4], ['owlsinge', 1.4], ...NATURE_POOL, ['kitsune', 1.8], ['unicorn', 1.5], ['wisp', 1.6], ['witch', 1.6], ['blackcat', 1.6], ['fairynap', 1.5], ['ent', 1.4], ['foxlant', 1.5], ['wispowl', 1.4], ['witchwhale', 1.3], ['heal', .9], ['catwisp', 1.4], ['witchpotion', 1.8], ['catgiant', 1.5], ['abduct_gnome', 1.8]] : [['deer', 2], ['butterflies', 2.5], ['bluebird', 2.5], ['mushroom', 2], ['dandelion', 2.5], ['squirrel', 2], ['sunray', 1.5], ['squirrelchase', 1.8], ['frog', 2], ['rainbow', 1.2], ['gnome', 2], ['bee', 2], ['deernut', 1.6], ['carrier_pigeon', 2.2], ['rainbow_slide', 1.8]]).filter(t => t[0] !== host.dataset.last);
  let pick = R() * pool.reduce((a, t) => a + t[1], 0), type = pool[0][0];
  for (const [n, w] of pool) { if ((pick -= w) <= 0) { type = n; break; } }
  host.dataset.last = type;
  if (night && host._next && Date.now() > host._next.at) { type = host._next.t; host._next = null; }
  if (type === 'owlsinge') host._next = { t: 'heal', at: Date.now() + 10000 };
  if (type === 'witchpotion') host._next = { t: 'catgiant', at: Date.now() + 6000 };
  if (night && R() < 1 / 40) type = 'eclipse';
  if (type === 'eclipse' || NATURE_TYPES.includes(type)) { const sk = Object.keys(hosts).find(z => hosts[z] === host); return runNature(type, host, m, { moon: skyMoon(W, m, true), top: sk && hosts[sk + '_t'] }); }
  const sp = m ? .55 : 1, dir = R() < .5 ? 1 : -1, flip = dir < 0, P = (x, y, t) => [dir > 0 ? x : W - x, y, t], X0 = -170 * k, X1 = W + 170 * k, hold = (p, t0, t1) => ln(p, p, t0, t1, 2);
  const bub = (txt, x, y, a, b, D) => fx1('<div style="position:absolute;left:0;top:0;transform:translate(-50%,-100%);padding:3px 8px;border-radius:9px;' + (night ? 'background:rgba(8,21,15,.92);border:1px solid rgba(94,242,194,.35);color:#E8FFF4' : 'background:rgba(255,255,255,.95);border:1px solid #D9EBDD;color:#2F5E44') + ';font:700 10px/1 \'Be Vietnam Pro\',sans-serif;white-space:nowrap">' + txt + '</div>', x, y, [{ opacity: 0, offset: 0 }, { opacity: 0, offset: Math.min(1, a) }, { opacity: 1, offset: Math.min(1, a + .02) }, { opacity: 1, offset: Math.min(1, b) }, { opacity: 0, offset: Math.min(1, b + .03) }, { opacity: 0, offset: 1 }], D);
  const headK = ts => [{ transform: 'rotate(0deg)', offset: 0 }, { transform: 'rotate(0deg)', offset: ts - .03 }, { transform: 'rotate(-14deg)', offset: ts - .008 }, { transform: 'rotate(10deg)', offset: ts + .004 }, { transform: 'rotate(0deg)', offset: ts + .03 }, { transform: 'rotate(0deg)', offset: 1 }];
  const sneeze = (x, y, sgn, kd, dl) => {
    fx1('<div style="position:absolute;left:0;top:-8px;width:52px;height:16px;border-radius:50%;background:radial-gradient(60% 60% at 8% 50%,#F2FFB8,#5EF2C2 45%,rgba(94,242,194,0) 75%);transform-origin:0 50%"></div>', x, y, [{ transform: 'scale(' + (sgn * .2 * kd).toFixed(2) + ',' + (.4 * kd).toFixed(2) + ')', opacity: 0 }, { transform: 'scale(' + (sgn * kd).toFixed(2) + ',' + kd.toFixed(2) + ')', opacity: 1, offset: .25 }, { transform: 'scale(' + (sgn * 1.25 * kd).toFixed(2) + ',' + (1.1 * kd).toFixed(2) + ')', opacity: 0 }], .9, dl);
    for (let i = 0; i < 6; i++) fx1(dot(rr(2, 3.5), '#C8FFEA', '94,242,194'), x + sgn * rr(10, 40) * kd, y + rr(-6, 6) * kd, [{ transform: 'translate(0,0)', opacity: 0 }, { transform: 'translate(0,0)', opacity: 1, offset: .2 }, { transform: 'translate(' + (sgn * rr(10, 30) * kd).toFixed(1) + 'px,' + (-rr(10, 30) * kd).toFixed(1) + 'px)', opacity: 0 }], 1.2, dl);
    fx1('<div style="position:absolute;left:-30px;top:-34px;width:60px;text-align:center;font:800 11px/1 \'Be Vietnam Pro\',sans-serif;color:#E8FFF4;text-shadow:0 0 6px rgba(94,242,194,.9)">Hắt xì!</div>', x - sgn * 14 * kd, y, [{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'translateY(0)', offset: .2 }, { opacity: 1, transform: 'translateY(0)', offset: .7 }, { opacity: 0, transform: 'translateY(-4px)' }], 1.4, Math.max(0, dl - .3));
  };
  const GY = m ? H - 16 : H - 8, SA = dir > 0 ? X0 : X1, SB = dir > 0 ? X1 : X0;
  const tr = (art, x, y, t, t2, dx, dy, D) => fx1(art, x, y, [{ transform: 'translate(0,0)', opacity: 0, offset: 0 }, { transform: 'translate(0,0)', opacity: 0, offset: t }, { transform: 'translate(0,0)', opacity: 1, offset: Math.min(t2, t + .006) }, { transform: 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px)', opacity: 0, offset: t2 }, ...(t2 < 1 ? [{ transform: 'translate(0,0)', opacity: 0, offset: 1 }] : [])], D);
  const puff = (x, y, t, D) => { for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; tr('<span style="position:absolute;left:-4px;top:-4px;width:8px;height:8px;border-radius:50%;background:rgba(186,230,253,.6);filter:blur(1.5px)"></span>', x, y, t, Math.min(1, t + .08), Math.cos(a) * 22 * k, Math.sin(a) * 18 * k - 10 * k, D); } };
  const FLM = '<span style="position:absolute;left:-5px;top:-10px;width:10px;height:14px;border-radius:50% 50% 45% 45%;background:radial-gradient(circle at 50% 70%,#F0F9FF,#7DD3FC 45%,rgba(125,211,252,0) 75%)"></span>';
  if (type === 'kitsune') {
    const kz = k * 1.25, y = GY - 18 * kz, D = rr(7, 8.5) * (m ? .8 : 1);
    const segs = cr(Array.from({ length: 9 }, (_, j) => [SA + (SB - SA) * j / 8, y - (j % 2 ? 12 : 0) * kz, j / 8]), 8);
    fly(EN.FOX, 64, 36, segs, D, { flip, k: kz, tk: .3, on: (el, ms, dl) => walk(el, ms, dl, null, null, 150, 28) });
    for (let t = .03; t < .97; t += .025) { const [px, py] = at(segs, t); tr(FLM, px - dir * 28 * kz, py + rr(-10, 4) * kz, t, Math.min(1, t + .1), -dir * rr(4, 16) * k, -rr(14, 34) * k, D); }
    return D;
  }
  if (type === 'unicorn') {
    const kz = k * 1.15, y = GY - 38 * kz, D = 17, S = [W * rr(.3, .7), y], rx = S[0] + dir * 46 * kz, wy = GY - 27 * kz;
    fly('<div data-k="tilt" style="position:absolute;inset:0;transform-origin:30% 96%">' + EN.UNI + '</div>', 90, 80, [ln([SA, y], S, 0, .32, 4), hold(S, .32, .68), ln(S, [SB, y], .68, 1, 4)], D, { flip, k: kz, on: (el, ms, dl) => walk(el, ms, dl, .32, .68, 420, 16), sync: [
      ['[data-k="head"]', [{ transform: 'rotate(0deg)', offset: 0 }, { transform: 'rotate(0deg)', offset: .35 }, { transform: 'rotate(40deg)', offset: .41 }, { transform: 'rotate(36deg)', offset: .5 }, { transform: 'rotate(40deg)', offset: .58 }, { transform: 'rotate(0deg)', offset: .64 }, { transform: 'rotate(0deg)', offset: 1 }]],
      ['[data-k="tilt"]', [{ transform: 'rotate(0deg)', offset: 0 }, { transform: 'rotate(0deg)', offset: .35 }, { transform: 'rotate(8deg)', offset: .41 }, { transform: 'rotate(8deg)', offset: .58 }, { transform: 'rotate(0deg)', offset: .64 }, { transform: 'rotate(0deg)', offset: 1 }]],
      ['[data-k="hg"]', [{ opacity: 0, offset: 0 }, { opacity: 0, offset: .4 }, { opacity: 1, offset: .45 }, { opacity: .55, offset: .52 }, { opacity: 1, offset: .58 }, { opacity: 0, offset: .66 }, { opacity: 0, offset: 1 }]]] });
    fx1('<div style="position:absolute;left:0;top:0;transform:scale(' + kz.toFixed(2) + ');transform-origin:0 0"><div style="position:absolute;left:-34px;top:-28px;width:68px;height:28px;border-radius:16px 20px 4px 4px;background:linear-gradient(#1F3D30,#0D1E17);box-shadow:inset 0 2px 0 rgba(94,242,194,.22)"></div><div style="position:absolute;left:-28px;top:-31px;width:56px;height:8px;border-radius:50%;background:radial-gradient(closest-side,#E0F2FE,rgba(125,211,252,.55) 60%,rgba(125,211,252,0));box-shadow:0 0 14px 2px rgba(125,211,252,.45)"></div><span style="position:absolute;left:' + (dir > 0 ? 24 : -27) + 'px;top:-26px;width:3px;height:26px;border-radius:2px;background:linear-gradient(rgba(186,230,253,.85),rgba(125,211,252,0))"></span></div>', rx, GY, [{ opacity: 0 }, { opacity: 1, offset: .06 }, { opacity: 1, offset: .92 }, { opacity: 0 }], D);
    [.44, .5, .56].forEach(t => fx1('<span style="position:absolute;left:-12px;top:-3px;width:24px;height:6px;box-sizing:border-box;border-radius:50%;border:1px solid rgba(224,242,254,.85)"></span>', rx - dir * 6 * kz, wy, [{ transform: 'scale(.3)', opacity: 0, offset: 0 }, { transform: 'scale(.3)', opacity: 0, offset: t }, { transform: 'scale(.4)', opacity: 1, offset: t + .005 }, { transform: 'scale(1.4)', opacity: 0, offset: t + .06 }, { transform: 'scale(1.4)', opacity: 0, offset: 1 }], D));
    for (let i = 0; i < 10; i++) fx1(dot(rr(2, 3.4), '#FFF7D6', '253,230,138'), S[0] + dir * 56 * kz + rr(-6, 6) * k, y - 18 * kz + rr(-6, 6) * k, [{ transform: 'translate(0,0)', opacity: 0 }, { transform: 'translate(0,0)', opacity: 1, offset: .2 }, { transform: 'translate(' + (rr(-14, 14) * k).toFixed(1) + 'px,' + (-rr(20, 46) * k).toFixed(1) + 'px)', opacity: 0 }], 1.6, (.44 + i * .012) * D);
    bub('Nước suối tiên ngọt ghê~', S[0], y - 46 * kz, .6, .7, D);
    return D;
  }
  if (type === 'wisp') {
    const D = 11, y = H * rr(.5, .72), M = P(W * .38, y - 20 * k), E = P(W * .74, y + 10 * k);
    const segs = [...cr([P(-30, y + 30 * k, 0), P(W * .12, y - 30 * k, .12), P(W * .26, y + 24 * k, .25), [M[0], M[1], .36]], 8), hold([M[0], M[1]], .36, .5), ...cr([[M[0], M[1], .5], P(W * .5, y + 36 * k, .6), P(W * .62, y - 34 * k, .7), [E[0], E[1], .8]], 8), hold([E[0], E[1]], .8, .84), hold([E[0], E[1]], .84, .86), hold([E[0], E[1]], .86, 1)];
    fly(EN.WISP, 20, 26, segs, D, { k: k * 1.2, opf: t => t > .855 ? 0 : Math.min(1, t / .05), scf: t => t > .845 ? 1.9 : 1 });
    bub('Theo ta nào…', M[0], M[1] - 26 * k, .37, .49, D); puff(E[0], E[1], .855, D); bub('Phụt!', E[0], E[1] - 20 * k, .86, .95, D);
    return D;
  }
  if (type === 'witch') {
    const [mx, my] = skyMoon(W, m, true), D = rr(8, 9.5) * (m ? .75 : 1), kz = k * 1.3, A = [SA, my + rr(70, 130) * k, 0], B = [SB, my + rr(50, 120) * k, 1];
    const segs = cr([A, [(A[0] + mx) / 2, (A[1] + my) / 2 + 12 * k, .25], [mx, my + 4 * k, .5], [(B[0] + mx) / 2, (B[1] + my) / 2 - 8 * k, .75], B], 10);
    fly(EN.WITCH, 56, 34, segs, D, { flip, k: kz, tk: .35 });
    for (let t = .03; t < .97; t += .03) { const [px, py] = at(segs, t); tr(dot(rr(1.6, 3), '#C8FFEA', '94,242,194'), px - dir * 30 * kz, py + 8 * kz, t, Math.min(1, t + .12), rr(-8, 8), rr(10, 30) * k, D); }
    bub('Hí hí hí~', mx, my + 44 * k, .5, .64, D);
    return D;
  }
  if (type === 'blackcat') {
    const side = R() < .5 ? -1 : 1, kz = k * 1.3, y = H * rr(.3, .55), len = (m ? 120 : 190) * k, D = 10, cx = side < 0 ? len * .62 : W - len * .62, cy = y - 4 * k - 16 * kz, L = len.toFixed(0);
    const lv = [.35, .5, .72, .86].map((p, i) => { const lx = (len * p).toFixed(0), ly = i % 2 ? 10 : 24; return '<ellipse cx="' + lx + '" cy="' + ly + '" rx="7" ry="3.4" fill="#12301F" stroke="rgba(94,242,194,.3)" stroke-width=".6" transform="rotate(' + (i % 2 ? -30 : 25) + ' ' + lx + ' ' + ly + ')"/>'; }).join('');
    fx1('<svg width="' + L + '" height="40" viewBox="0 0 ' + L + ' 40" style="position:absolute;left:' + (side < 0 ? 0 : -L) + 'px;top:-20px;overflow:visible' + (side > 0 ? ';transform:scaleX(-1)' : '') + '"><path d="M-10 20 C' + (len * .3).toFixed(0) + ' 16 ' + (len * .6).toFixed(0) + ' 22 ' + L + ' 17" stroke="#0B1712" stroke-width="' + (7 * k).toFixed(1) + '" stroke-linecap="round" fill="none"/><path d="M' + (len * .7).toFixed(0) + ' 19 C' + (len * .78).toFixed(0) + ' 10 ' + (len * .84).toFixed(0) + ' 6 ' + (len * .92).toFixed(0) + ' 4" stroke="#0B1712" stroke-width="' + (3 * k).toFixed(1) + '" fill="none" stroke-linecap="round"/>' + lv + '</svg>', side < 0 ? 0 : W, y, [{ opacity: 0 }, { opacity: 1, offset: .08 }, { opacity: 1, offset: .9 }, { opacity: 0 }], D);
    fly(EN.CAT, 34, 34, [hold([cx, cy], 0, 1)], D, { flip: side > 0, k: kz, opf: t => Math.min(1, t / .04, (1 - t) / .06), sync: [['[data-k="bd"]', [{ opacity: 0, offset: 0 }, { opacity: 0, offset: .14 }, { opacity: 1, offset: .3 }, { opacity: 1, offset: 1 }]], ['[data-k="eR"]', [{ transform: 'scaleY(1)', offset: 0 }, { transform: 'scaleY(1)', offset: .52 }, { transform: 'scaleY(.1)', offset: .55 }, { transform: 'scaleY(.1)', offset: .6 }, { transform: 'scaleY(1)', offset: .63 }, { transform: 'scaleY(1)', offset: 1 }]]] });
    bub('Meo~', cx, cy - 24 * kz, .56, .72, D);
    return D;
  }
  if (type === 'fairynap') {
    const kz = k * 1.3, x = W * rr(.12, .88), y = GY - 22 * kz, D = 12, hx = x + 7 * kz, hy = y - 7 * kz;
    fly(EN.FAIRY, 40, 44, [hold([x, y], 0, 1)], D, { k: kz, opf: t => Math.min(1, t / .08, (1 - t) / .08), inner: 'transform-origin:50% 100%;animation:tkf-eWob 2.6s ease-in-out infinite alternate' });
    for (let i = 0; i < 5; i++) { const dl = 1 + i * 1.9; fx1('<span style="position:absolute;left:-6px;top:-6px;width:12px;height:12px;box-sizing:border-box;border-radius:50%;border:1px solid rgba(224,242,254,.85);background:radial-gradient(circle at 35% 35%,rgba(255,255,255,.7),rgba(200,240,255,.15) 60%,rgba(200,240,255,0))"></span>', hx, hy, [{ transform: 'translate(0,0) scale(.2)', opacity: 0 }, { transform: 'translate(0,0) scale(.3)', opacity: 1, offset: .1 }, { transform: 'translate(' + (4 * k).toFixed(1) + 'px,' + (-24 * k).toFixed(1) + 'px) scale(1.5)', opacity: 1, offset: .82 }, { transform: 'translate(' + (5 * k).toFixed(1) + 'px,' + (-28 * k).toFixed(1) + 'px) scale(2)', opacity: 0 }], 1.7, dl); fx1('<span style="position:absolute;left:0;top:0;font:700 ' + (10 + (i % 3) * 2) + 'px/1 \'Cormorant SC\',serif;color:#E8FFF4;text-shadow:0 0 6px rgba(244,171,226,.9)">z</span>', hx - 8 * kz, hy - 6 * kz, [{ transform: 'translate(0,0)', opacity: 0 }, { transform: 'translate(-4px,-8px)', opacity: 1, offset: .3 }, { transform: 'translate(-12px,-34px)', opacity: 0 }], 2, dl + .6); }
    return D;
  }
  if (type === 'ent') {
    const side = m ? (R() < .5 ? -1 : 1) : 1, kz = k * (m ? 1.3 : 1.7), x = side < 0 ? 24 * kz : W - 24 * kz, y = H * (m ? .48 : .5), D = 11;
    const shake = [{ transform: 'rotate(0deg)', offset: 0 }, { transform: 'rotate(0deg)', offset: .4 }, ...[.43, .46, .49, .52, .55].map((o, i) => ({ transform: 'rotate(' + (i % 2 ? -7 : 7) + 'deg)', offset: o })), { transform: 'rotate(0deg)', offset: .58 }, { transform: 'rotate(0deg)', offset: 1 }];
    fly(EN.ENT, 160, 140, [hold([x, y], 0, 1)], D, { k: kz, flip: side > 0, opf: t => Math.min(1, t / .14, (1 - t) / .1), sync: [
      ['[data-k="eyes"]', [{ transform: 'scaleY(.05)', offset: 0 }, { transform: 'scaleY(.05)', offset: .18 }, { transform: 'scaleY(1)', offset: .24 }, { transform: 'scaleY(1)', offset: .32 }, { transform: 'scaleY(.35)', offset: .36 }, { transform: 'scaleY(.35)', offset: .56 }, { transform: 'scaleY(1)', offset: .6 }, { transform: 'scaleY(1)', offset: .66 }, { transform: 'scaleY(.1)', offset: .69 }, { transform: 'scaleY(1)', offset: .72 }, { transform: 'scaleY(1)', offset: .82 }, { transform: 'scaleY(.05)', offset: .88 }, { transform: 'scaleY(.05)', offset: 1 }]],
      ['[data-k="mouth"]', [{ transform: 'scale(.35,.2)', offset: 0 }, { transform: 'scale(.35,.2)', offset: .34 }, { transform: 'scale(1,1.4)', offset: .42 }, { transform: 'scale(1.05,1.5)', offset: .52 }, { transform: 'scale(.35,.2)', offset: .58 }, { transform: 'scale(.35,.2)', offset: 1 }]],
      ['[data-k="armL"]', shake], ['[data-k="armR"]', shake]] });
    for (let i = 0; i < 9; i++) fx1('<svg width="10" height="7" viewBox="0 0 10 7" style="position:absolute;left:-5px;top:-3.5px;overflow:visible;filter:drop-shadow(0 0 3px rgba(94,242,194,.8))"><path d="M0 3.5 C3 0 7 0 10 3.5 C7 7 3 7 0 3.5 Z" fill="' + (i % 2 ? '#3FBF8F' : '#7DE8C4') + '"/></svg>', x + rr(-58, 58) * kz, y - rr(26, 57) * kz, [{ transform: 'translate(0,0) rotate(0deg)', opacity: 0 }, { transform: 'translate(0,0) rotate(0deg)', opacity: 1, offset: .08 }, { transform: 'translate(' + rr(-30, 30).toFixed(1) + 'px,' + (rr(120, 220) * k).toFixed(1) + 'px) rotate(' + rr(-300, 300).toFixed(0) + 'deg)', opacity: 0 }], 2.6, .44 * D + rr(0, .6));
    bub('Ngáaaap~', x - side * 10 * kz, y - 72 * kz, .4, .56, D);
    return D;
  }
  if (type === 'foxlant') {
    const kz = k * 1.25, y = GY - 18 * kz, D = 11 * (m ? .85 : 1), lx = W * rr(.38, .62), ly = GY - 66 * kz;
    const segs = cr([[SA, y, 0], [lx - dir * 130 * kz, y, .3], [lx - dir * 31 * kz, ly + 7 * kz, .4], [lx + dir * 60 * kz, y, .5], [lx + dir * 240 * kz, y - 8 * kz, .64], [SB, y, 1]], 8);
    fly(EN.FOX + '<div data-k="lt" style="position:absolute;left:57px;top:13px;opacity:0;transform:scale(.8);transform-origin:0 0">' + EN.LANT + '</div>', 64, 36, segs, D, { flip, k: kz, tk: .3, on: (el, ms, dl) => walk(el, ms, dl, .35, .47, 150, 28), sync: [['[data-k="lt"]', [{ opacity: 0, offset: 0 }, { opacity: 0, offset: .399 }, { opacity: 1, offset: .401 }, { opacity: 1, offset: 1 }]]] });
    fx1('<div style="position:absolute;left:-7px;top:-9px;transform:scale(' + kz.toFixed(2) + ');transform-origin:7px 9px">' + EN.LANT + '</div>', lx, ly, [{ transform: 'translateY(0)', opacity: 0, offset: 0 }, { transform: 'translateY(-4px)', opacity: 1, offset: .08 }, { transform: 'translateY(3px)', opacity: 1, offset: .22 }, { transform: 'translateY(-3px)', opacity: 1, offset: .36 }, { transform: 'translateY(0)', opacity: 1, offset: .399 }, { transform: 'translateY(0)', opacity: 0, offset: .401 }, { transform: 'translateY(0)', opacity: 0, offset: 1 }], D);
    for (let i = 0; i < (m ? 5 : 8); i++) {
      const ph = rr(0, 6.28), r0 = rr(16, 30) * k, lag = rr(.05, .13), Qf = [];
      for (let j = 0; j <= 6; j++) { const a = ph + j * 1.1; Qf.push([lx + Math.cos(a) * r0, ly + Math.sin(a) * r0 * .7, j / 6 * .4]); }
      [.46, .53, .6, .67, .74, .81, .88, .94, 1].forEach(t => { const [px, py] = at(segs, Math.max(.4, t - lag)); Qf.push([px + rr(-14, 14) * k - dir * 20 * kz, py - rr(10, 40) * k, t]); });
      fly(EN.FF, 0, 0, cr(Qf, 5), D, { k: 1, opf: t => Math.min(1, t / .05, (1 - t) / .03) });
    }
    bub('Của ta!', lx + dir * 60 * kz, y - 28 * kz, .48, .6, D); bub('Trả đèn đây!', lx + dir * 150 * kz, ly - 30 * k, .6, .74, D);
    return D;
  }
  if (type === 'wispowl') {
    const D = 13, y = H * rr(.3, .48), ko = k * 1.1;
    const Qw = [P(-30, y, 0), P(W * .18, y - 60 * k, .1), P(W * .32, y + 40 * k, .2), P(W * .26, y - 30 * k, .28), P(W * .46, y + 50 * k, .38), P(W * .6, y - 50 * k, .48), P(W * .52, y + 20 * k, .56), P(W * .68, y, .64)], E = Qw[Qw.length - 1];
    fly(EN.WISP, 20, 26, [...cr(Qw, 8), hold([E[0], E[1]], .64, .69), hold([E[0], E[1]], .69, .71), hold([E[0], E[1]], .71, 1)], D, { k: k * 1.2, opf: t => t > .705 ? 0 : Math.min(1, t / .04), scf: t => t > .695 ? 1.9 : 1 });
    const Qo = Qw.map((p, i) => [p[0] - dir * 34 * k, p[1] + 8 * k, i ? p[2] + .07 : 0]), Eo = Qo[Qo.length - 1];
    fly(EN.OWL, 30, 34, [...cr(Qo, 8), hold([Eo[0], Eo[1]], .71, .86), ...cr([[Eo[0], Eo[1], .86], [Eo[0] + dir * 30 * k, Eo[1] - 60 * k, .92], [Eo[0] + dir * 90 * k, -60, 1]], 6)], D, { k: ko, tk: .2, sync: [['[data-k="wings"]', [{ opacity: 1 }, { opacity: 1 }]]] });
    for (let s2 = 0; s2 < 3; s2++) { const q = [{ transform: 'translate(0px,0px)', opacity: 0, offset: 0 }]; for (let j = 0; j <= 12; j++) { const u = j / 12, a = s2 * 2.09 + u * Math.PI * 4, px = Eo[0] + Math.cos(a) * 14 * k, py = Eo[1] - 20 * ko + Math.sin(a) * 5 * k; if (!j) q.push({ transform: 'translate(' + px.toFixed(1) + 'px,' + py.toFixed(1) + 'px)', opacity: 0, offset: .72 }); q.push({ transform: 'translate(' + px.toFixed(1) + 'px,' + py.toFixed(1) + 'px)', opacity: j === 12 ? 0 : 1, offset: .725 + u * .135 }); } q.push({ transform: q[q.length - 1].transform, opacity: 0, offset: 1 }); fx1('<div style="transform:scale(.55)">' + EA.STAR + '</div>', 0, 0, q, D); }
    puff(E[0], E[1], .705, D); bub('Phụt!', E[0], E[1] - 20 * k, .71, .75, D); bub('Ơ… đây là đâu?', Eo[0], Eo[1] - 34 * ko, .76, .87, D);
    return D;
  }
  if (type === 'witchwhale') {
    const D = 20 * (m ? .8 : 1), kw = k * (m ? .9 : 1.1), kz = k * 1.25, y = H * rr(.2, .3), tm = .42;
    const ws = cr(Array.from({ length: 7 }, (_, j) => P(-260 * kw + (W + 520 * kw) * j / 6, y + Math.sin(j * 1.3) * 22 * k, j / 6)), 10);
    fly(EN.WHALE, 220, 90, ws, D, { flip, tk: .25, k: kw, opf: t => .88 * Math.min(1, t / .08, (1 - t) / .08) });
    const [wx, wy] = at(ws, tm), C = [wx + dir * 100 * kw, wy - 6 * kw], back = t => { const [x, yy] = at(ws, t); return [x + dir * 10 * kw, yy - 27 * kw - 13 * kz]; };
    const Qr = [[SB, C[1] - 40 * k, 0], [(SB + C[0]) / 2, C[1] - 20 * k, .22], [C[0], C[1], tm], [C[0] + dir * 34 * k, C[1] - 70 * k, .48]];
    [.53, .6, .68, .76, .84, .92, 1].forEach(t => { const b = back(t); Qr.push([b[0], b[1], t]); });
    fly(EN.WITCH, 56, 34, cr(Qr, 8), D, { flip: dir > 0, k: kz, tk: .15, sync: [['[data-k="broom"]', [{ opacity: 1, offset: 0 }, { opacity: 1, offset: tm - .002 }, { opacity: 0, offset: tm + .002 }, { opacity: 0, offset: 1 }]]] });
    const bs = 'scale(' + kz.toFixed(2) + ')', bT = 'translate(' + (-dir * 60 * k).toFixed(1) + 'px,' + (GY - C[1] - 6 * k).toFixed(1) + 'px) rotate(' + (-dir * 620) + 'deg) ' + bs;
    fx1(EN.BROOM, C[0], C[1], [{ transform: 'translate(0,0) rotate(0deg) ' + bs, opacity: 0, offset: 0 }, { transform: 'translate(0,0) rotate(0deg) ' + bs, opacity: 0, offset: tm - .002 }, { transform: 'translate(0,0) rotate(0deg) ' + bs, opacity: 1, offset: tm + .002, easing: 'cubic-bezier(.5,0,1,.6)' }, { transform: bT, opacity: 1, offset: .62 }, { transform: bT, opacity: 0, offset: .7 }, { transform: bT, opacity: 0, offset: 1 }], D);
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; tr(dot(rr(2, 3.4), '#FFF7D6', '253,230,138'), C[0], C[1], tm, tm + .05, Math.cos(a) * 30 * k, Math.sin(a) * 30 * k, D); }
    const r1 = back(.6);
    bub('Bốp!', C[0], C[1] - 24 * k, tm, tm + .06, D); bub('Ối, chổi của ta!', r1[0], r1[1] - 26 * k, .56, .68, D);
    return D;
  }
  if (type === 'heal') {
    const D = 17, ko = k * 1.25, ku = k * 1.15, ox = W * rr(.32, .68), oy = GY - 17 * ko, uy = GY - 38 * ku, S = [ox - dir * 80 * ku, uy], hx = S[0] + dir * 45 * ku, hy = uy - 36 * ku;
    const os = [hold([ox, oy], 0, .64), ...cr([[ox, oy, .64], [ox + dir * 40 * k, oy - 90 * k, .74], [ox + dir * 150 * k, oy - 230 * k, .86], [ox + dir * 340 * k, -80, 1]], 6)];
    fly(EN.OWL, 30, 34, os, D, { k: ko, tk: .2, opf: t => Math.min(1, t / .05), sync: [['[data-k="soot"]', [{ opacity: 1, offset: 0 }, { opacity: 1, offset: .5 }, { opacity: 0, offset: .6 }, { opacity: 0, offset: 1 }]], ['[data-k="wings"]', [{ opacity: 0, offset: 0 }, { opacity: 0, offset: .63 }, { opacity: 1, offset: .645 }, { opacity: 1, offset: 1 }]]] });
    fly(EN.UNI, 90, 80, [ln([SA, uy], S, 0, .3, 4), hold(S, .3, .7), ln(S, [SB, uy], .7, 1, 4)], D, { flip, k: ku, on: (el, ms, dl) => walk(el, ms, dl, .3, .7, 420, 16), sync: [['[data-k="head"]', [{ transform: 'rotate(0deg)', offset: 0 }, { transform: 'rotate(0deg)', offset: .32 }, { transform: 'rotate(18deg)', offset: .36 }, { transform: 'rotate(18deg)', offset: .58 }, { transform: 'rotate(0deg)', offset: .62 }, { transform: 'rotate(0deg)', offset: 1 }]], ['[data-k="hg"]', [{ opacity: 0, offset: 0 }, { opacity: 0, offset: .35 }, { opacity: 1, offset: .39 }, { opacity: 1, offset: .57 }, { opacity: 0, offset: .62 }, { opacity: 0, offset: 1 }]]] });
    for (let i = 0; i < 14; i++) { const t0 = .39 + i * .012, dx = ox + rr(-8, 8) * k - hx, dy = oy + rr(-10, 8) * k - hy; fx1(dot(rr(2, 3.4), '#FBE7FF', '233,213,255'), hx, hy, [{ transform: 'translate(0,0)', opacity: 0, offset: 0 }, { transform: 'translate(0,0)', opacity: 0, offset: t0 }, { transform: 'translate(0,0)', opacity: 1, offset: t0 + .005 }, { transform: 'translate(' + (dx * .5).toFixed(1) + 'px,' + (dy * .5 - 24 * k).toFixed(1) + 'px)', opacity: 1, offset: t0 + .03 }, { transform: 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px)', opacity: 0, offset: t0 + .06 }, { transform: 'translate(0,0)', opacity: 0, offset: 1 }], D); }
    fx1('<div style="position:absolute;left:-30px;top:-30px;width:60px;height:60px;border-radius:50%;background:radial-gradient(closest-side,rgba(251,231,255,.55),rgba(233,213,255,0))"></div>', ox, oy, [{ opacity: 0, offset: 0 }, { opacity: 0, offset: .46 }, { opacity: 1, offset: .5 }, { opacity: 1, offset: .58 }, { opacity: 0, offset: .64 }, { opacity: 0, offset: 1 }], D);
    const [ax, ay] = at(os, .78);
    bub('Huhu, cháy hết lông rồi…', ox, oy - 26 * ko, .05, .22, D); bub('Cảm ơn kỳ lân!', ax, ay - 26 * k, .74, .86, D);
    return D;
  }
  if (type === 'catwisp') {
    const D = 10, kz = k * 1.3, cx = W * rr(.25, .7), cy = GY - 17 * kz, wx = cx + dir * 110 * k, wy = GY - 30 * k, up = [wx + dir * 24 * k, wy - 100 * k];
    fly(EN.CAT, 34, 34, [hold([cx, cy], 0, .38), hold([cx, cy], .38, .46), ...cr([[cx, cy, .46], [(cx + wx) / 2, cy - 64 * k, .5], [wx, cy, .54]], 6), hold([wx, cy], .54, 1)], D, { flip: dir < 0, k: kz, opf: t => Math.min(1, t / .05, (1 - t) / .08), scf: t => t > .4 && t < .46 ? .86 : 1 });
    fly(EN.WISP, 20, 26, [...cr([[wx, wy, 0], [wx + 6 * k, wy - 8 * k, .15], [wx - 5 * k, wy + 4 * k, .3], [wx + 3 * k, wy - 6 * k, .44], [wx, wy, .5]], 6), ln([wx, wy], up, .5, .53, 3), hold(up, .53, .72), ...cr([[up[0], up[1], .72], [up[0] + dir * 90 * k, up[1] - 80 * k, .86], [up[0] + dir * 200 * k, -60, 1]], 6)], D, { k: k * 1.15, opf: t => Math.min(1, t / .05, (1 - t) / .05) });
    bub('Hụt!', wx, cy - 30 * kz, .55, .68, D); bub('Hí hí~', up[0], up[1] - 26 * k, .58, .72, D);
    return D;
  }
  if (type === 'bloom') {
    const D = 9, bx = W * rr(.25, .75), by = GY - 14 * k;
    fx1(EN.LOTUS, bx - 30 * k, by - 36 * k, [
      { transform: 'scale(0.3) translateY(24px)', opacity: 0 },
      { transform: 'scale(0.85) translateY(6px)', opacity: 0.75, offset: 0.16 },
      { transform: 'scale(1.08) translateY(0)', opacity: 1, offset: 0.38 },
      { transform: 'scale(1) translateY(0)', opacity: 1, offset: 0.8 },
      { transform: 'scale(0.88) translateY(12px)', opacity: 0 }
    ], D);
    for (let i = 0; i < (m ? 9 : 16); i++) {
      const dx = rr(-38, 38) * k, dy = -rr(60, 160) * k;
      fx1(dot(rr(2.4, 4.2), '#C8FFEA', '94,242,194'), bx + rr(-16, 16) * k, by - 20 * k, [
        { transform: 'translate(0,0) scale(0)', opacity: 0, offset: 0 },
        { transform: 'translate(0,0) scale(1)', opacity: 1, offset: 0.25 },
        { transform: 'translate(' + (dx * .5).toFixed(1) + 'px,' + (dy * .5).toFixed(1) + 'px) scale(1.2)', opacity: .9, offset: 0.6 },
        { transform: 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px) scale(0)', opacity: 0, offset: 1 }
      ], D * rr(0.7, 0.95), 0.25 * D + R() * 0.4);
    }
    bub('Hoa sen ngọc nở rộ ✨', bx, by - 46 * k, 0.35, 0.65, D);
    return D;
  }
  if (type === 'witchpotion') {
    const [mx, my] = skyMoon(W, m, true), D = rr(8, 9.5) * (m ? .75 : 1), kz = k * 1.3;
    const A = [SA, my + rr(60, 100) * k, 0], B = [SB, my + rr(40, 90) * k, 1], dropT = 0.42;
    const segs = cr([A, [(A[0] + mx) / 2, (A[1] + my) / 2 + 10 * k, .25], [mx, my + 4 * k, dropT], [(B[0] + mx) / 2, (B[1] + my) / 2 - 8 * k, .75], B], 10);
    fly(EN.WITCH, 56, 34, segs, D, { flip, k: kz, tk: .35 });
    const [dx, dy] = at(segs, dropT), gyP = GY - 8 * k, impactX = dx + dir * 30 * k;
    fx1(EN.POTION, dx, dy, [
      { transform: 'translate(0,0) rotate(0deg) scale(1)', opacity: 0, offset: 0 },
      { transform: 'translate(0,0) rotate(0deg) scale(1)', opacity: 1, offset: dropT },
      { transform: 'translate(' + (dir * 30 * k).toFixed(1) + 'px,' + (gyP - dy).toFixed(1) + 'px) rotate(540deg) scale(1)', opacity: 1, offset: 0.72 },
      { transform: 'translate(' + (dir * 30 * k).toFixed(1) + 'px,' + (gyP - dy).toFixed(1) + 'px) rotate(540deg) scale(0)', opacity: 0, offset: 0.74 },
      { transform: 'translate(' + (dir * 30 * k).toFixed(1) + 'px,' + (gyP - dy).toFixed(1) + 'px) scale(0)', opacity: 0, offset: 1 }
    ], D);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2, r = rr(20, 50) * k;
      fx1(dot(rr(2.5, 4), '#E879F9', '216,112,240'), impactX, gyP, [
        { transform: 'translate(0,0)', opacity: 0, offset: 0 },
        { transform: 'translate(0,0)', opacity: 0, offset: 0.72 },
        { transform: 'translate(0,0)', opacity: 1, offset: 0.73 },
        { transform: 'translate(' + (Math.cos(a) * r).toFixed(1) + 'px,' + (Math.sin(a) * r * 0.6 - 15 * k).toFixed(1) + 'px)', opacity: 0, offset: 0.95 },
        { transform: 'translate(0,0)', opacity: 0, offset: 1 }
      ], D);
    }
    bub('Ối! Rơi mất độc dược rồi!', mx, my + 44 * k, 0.44, 0.65, D);
    bub('Choang! ✨', impactX, gyP - 24 * k, 0.72, 0.86, D);
    return D;
  }
  if (type === 'catgiant') {
    const D = 11, kz = k * 1.3, cx = W * rr(.35, .65), cy = GY - 17 * kz;
    fly(EN.CAT, 34, 34, [hold([cx, cy], 0, 1)], D, {
      flip: dir < 0,
      k: kz,
      opf: t => Math.min(1, t / 0.05, (1 - t) / 0.05),
      scf: t => {
        if (t < 0.25) return 1;
        if (t < 0.35) return 1 + (t - 0.25) * 18;
        if (t < 0.60) return 2.8;
        if (t < 0.70) return 2.8 - (t - 0.60) * 18;
        return 1;
      }
    });
    fx1('<div style="position:absolute;left:-60px;top:-60px;width:120px;height:120px;border-radius:50%;background:radial-gradient(circle,rgba(216,112,240,.45),rgba(94,242,194,.3) 50%,transparent 70%)"></div>', cx, cy, [
      { opacity: 0, transform: 'scale(0.5)', offset: 0 },
      { opacity: 0, transform: 'scale(0.5)', offset: 0.26 },
      { opacity: 1, transform: 'scale(2.2)', offset: 0.35 },
      { opacity: 1, transform: 'scale(2.3)', offset: 0.58 },
      { opacity: 0, transform: 'scale(0.8)', offset: 0.68 },
      { opacity: 0, offset: 1 }
    ], D);
    bub('Liếm liếm...', cx, cy - 28 * kz, 0.12, 0.24, D);
    bub('NGOAOOO!! 🦁', cx, cy - 80 * kz, 0.35, 0.56, D);
    sneeze(cx + (dir > 0 ? 1 : -1) * 20 * kz, cy - 30 * kz, dir > 0 ? 1 : -1, kz * 1.6, 0.60 * D);
    bub('Hắt xì! ...Meo?', cx, cy - 28 * kz, 0.72, 0.9, D);
    return D;
  }
  if (type === 'abduct_gnome') {
    const D = 14, gx = W * rr(.35, .65), gyG = (m ? H - 14 : H - 6) - 15 * k, uy = H * rr(.18, .28);
    const bh = Math.round((gyG - uy) / k + 20), liftY = uy + 38 * k;
    const UFO = '<div data-k="beam" style="position:absolute;left:9px;top:16px;width:30px;height:' + bh + 'px;opacity:0;clip-path:polygon(32% 0,68% 0,100% 100%,0 100%);background:linear-gradient(rgba(94,242,194,.75),rgba(94,242,194,0))"></div>' + EA.UFO_TINY;
    const ufoPath = cr([P(X0, uy - 40, 0), P(gx, uy, .24), P(gx + 2, uy + 4, .4), P(gx - 2, uy - 4, .6), P(gx, uy, .72), P(X1 + 60, -120, 1)], 8);
    fly(UFO, 48, 24, ufoPath, D, {
      tk: 0,
      sync: [
        ['[data-k="beam"]', [{ opacity: 0, offset: 0 }, { opacity: 0, offset: 0.28 }, { opacity: 0.85, offset: 0.32 }, { opacity: 0.85, offset: 0.64 }, { opacity: 0, offset: 0.68 }, { opacity: 0, offset: 1 }]],
        ['svg', [
          { transform: 'translate(0,0) rotate(0deg)', offset: 0 },
          { transform: 'translate(0,0) rotate(0deg)', offset: 0.44 },
          { transform: 'translate(-3px, -2px) rotate(-6deg)', offset: 0.48 },
          { transform: 'translate(4px, 3px) rotate(8deg)', offset: 0.52 },
          { transform: 'translate(-4px, 2px) rotate(-8deg)', offset: 0.58 },
          { transform: 'translate(3px, -3px) rotate(6deg)', offset: 0.64 },
          { transform: 'translate(0,0) rotate(0deg)', offset: 0.7 },
          { transform: 'translate(0,0) rotate(0deg)', offset: 1 }
        ]]
      ]
    });
    const GN = EA.GNOME + '<div data-k="hmr" style="position:absolute;left:22px;top:4px;opacity:0;transform-origin:2px 16px">' + EA.HAMMER + '</div>';
    fly(GN, 34, 30, [
      hold([gx, gyG], 0, 0.32),
      ln([gx, gyG], [gx, liftY], 0.32, 0.46, 6),
      hold([gx, liftY], 0.46, 0.66),
      ln([gx, liftY], [gx, gyG], 0.66, 0.78, 6),
      hold([gx, gyG], 0.78, 1)
    ], D, {
      k: k * 1.2,
      sync: [
        ['[data-k="hmr"]', [
          { opacity: 0, transform: 'rotate(0deg)', offset: 0 },
          { opacity: 0, transform: 'rotate(0deg)', offset: 0.46 },
          { opacity: 1, transform: 'rotate(-45deg)', offset: 0.48 },
          { opacity: 1, transform: 'rotate(30deg)', offset: 0.51 },
          { opacity: 1, transform: 'rotate(-40deg)', offset: 0.55 },
          { opacity: 1, transform: 'rotate(35deg)', offset: 0.59 },
          { opacity: 1, transform: 'rotate(0deg)', offset: 0.66 },
          { opacity: 0, transform: 'rotate(0deg)', offset: 0.68 },
          { opacity: 0, offset: 1 }
        ]]
      ]
    });
    bub('Ủa gì vậy?!', gx, gyG - 30 * k, 0.34, 0.44, D);
    bub('Cốp! Cốp! 🔨', gx, liftY - 26 * k, 0.50, 0.64, D);
    bub('Xoẹt! Xoẹt! ⚡', gx + 30 * k, uy - 18 * k, 0.54, 0.68, D);
    bub('Chừa thói bắt cóc nhé!', gx, gyG - 30 * k, 0.80, 0.95, D);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2, r = rr(15, 35) * k;
      fx1(dot(rr(2, 3.5), '#FDE047', '253,224,71'), gx, liftY - 8 * k, [
        { transform: 'translate(0,0)', opacity: 0, offset: 0 },
        { transform: 'translate(0,0)', opacity: 0, offset: 0.50 },
        { transform: 'translate(0,0)', opacity: 1, offset: 0.52 },
        { transform: 'translate(' + (Math.cos(a) * r).toFixed(1) + 'px,' + (Math.sin(a) * r).toFixed(1) + 'px)', opacity: 0, offset: 0.64 },
        { transform: 'translate(0,0)', opacity: 0, offset: 1 }
      ], D);
    }
    return D;
  }
  if (type === 'carrier_pigeon') {
    const y = H * rr(.12, .32), D = rr(13, 17) * sp, dropT = 0.44;
    const segs = cr([P(X0, y, 0), P(W * .3, y + rr(-20, 30), .3), P(W * .55, y + rr(-10, 20), dropT), P(X1, y + rr(-30, 20), 1)], 8);
    fly(EA.PIGEON, 36, 28, segs, D, {
      flip,
      tk: .25,
      k: k * 1.15,
      sync: [
        ['[data-k="letter"]', [
          { opacity: 1, offset: 0 },
          { opacity: 1, offset: dropT - 0.01 },
          { opacity: 0, offset: dropT + 0.01 },
          { opacity: 0, offset: 1 }
        ]]
      ]
    });
    const [lx, ly] = at(segs, dropT), gyL = GY - 10 * k;
    const hr = new Date().getHours();
    const isMorning = hr >= 5 && hr <= 9;
    const isLateNight = hr >= 23 || hr < 4;
    const quotes = isMorning
      ? ['Chào buổi sáng! Ngày mới đầy năng lượng nhé ☀️', 'Cà phê sáng rồi tập trung nào ☕', 'Hôm nay sẽ hoàn thành thật nhiều việc! ✨']
      : isLateNight
      ? ['Nghỉ ngơi sớm thôi bạn ơi~ 🌙', 'Đừng thức khuya quá nhé!', 'Ngủ ngon nhé chiến binh! ✨']
      : ['Bạn đang làm rất tốt ✨', 'Uống miếng nước đi bạn ơi ☕', 'Tập trung nào chiến binh! 💪', 'Hôm nay là một ngày tuyệt vời 🌸'];
    const quote = quotes[Math.floor(R() * quotes.length)];
    const swaySegs = cr([
      [lx, ly, dropT],
      [lx - 20 * k, (ly + gyL) * 0.35, dropT + 0.12],
      [lx + 24 * k, (ly + gyL) * 0.65, dropT + 0.24],
      [lx - 12 * k, (ly + gyL) * 0.85, dropT + 0.34],
      [lx, gyL, dropT + 0.42],
      [lx, gyL, 1]
    ], 6);
    fly(EA.LETTER, 28, 20, swaySegs, D, {
      tk: 0,
      k: k * 1.1,
      inner: 'animation:tkf-eBob 1.2s ease-in-out infinite alternate',
      opf: t => t < dropT ? 0 : Math.min(1, (1 - t) / 0.06)
    });
    bub(`💌 "${quote}"`, lx, gyL - 32 * k, dropT + 0.44, 0.96, D);
    return D;
  }
  if (type === 'rainbow_slide') {
    const D = 14, rw = m ? 320 : 760, rh = rw / 2, cx = W * rr(.35, .65), top = H * rr(.1, .22);
    fx1('<div style="position:absolute;left:' + (-rw / 2) + 'px;top:0;width:' + rw + 'px;height:' + rh + 'px;background:radial-gradient(circle ' + rh + 'px at 50% 100%,transparent 72%,rgba(239,68,68,.42) 75%,rgba(249,115,22,.42) 79%,rgba(250,204,21,.42) 83%,rgba(34,197,94,.38) 87%,rgba(59,130,246,.36) 91%,rgba(139,92,246,.34) 95%,transparent 98%);-webkit-mask-image:linear-gradient(to top,transparent,#000 40%);mask-image:linear-gradient(to top,transparent,#000 40%)"></div>', cx, top, [{ opacity: 0 }, { opacity: 0, offset: .2 }, { opacity: 1, offset: .35 }, { opacity: 1, offset: .85 }, { opacity: 0 }], D);
    const SQ = '<svg width="34" height="26" viewBox="0 0 34 26" style="position:absolute;inset:0;overflow:visible;filter:drop-shadow(0 1px 2px rgba(60,40,20,.35))"><path d="M13 20 C2 23 -2 12 2 6 C5 1 12 2 12 8 C12 12 8 12 8 15 C9 18 12 18 14 18 Z" fill="#C2783F"/><ellipse cx="19" cy="17" rx="8" ry="6" fill="#B86B34"/><ellipse cx="20.5" cy="19" rx="5" ry="3.4" fill="#F1D3AE"/><path d="M15 22 L13 25 M22 22 L24 25" stroke="#9A5527" stroke-width="1.6" stroke-linecap="round"/><circle cx="26" cy="11" r="4.6" fill="#B86B34"/><circle cx="27.6" cy="10.4" r=".9" fill="#1A1A1A"/></svg>';
    const startX = cx - rw * 0.35, endX = cx + rw * 0.35;
    const arcY = t => top + rh - Math.sin(t * Math.PI) * rh * 0.85;
    const slideSegs = cr([
      [startX, top + rh, 0],
      [startX, top + rh, 0.35],
      [cx - rw * 0.18, arcY(0.3), 0.45],
      [cx, arcY(0.5), 0.55],
      [cx + rw * 0.18, arcY(0.7), 0.65],
      [endX, top + rh - 10, 0.75],
      [endX + 80 * k, top + rh - 5, 0.88],
      [endX + 80 * k, top + rh - 5, 1]
    ], 8);
    fly(SQ, 34, 26, slideSegs, D, {
      k: k * 1.15,
      tk: 0.6,
      opf: t => t < 0.32 ? 0 : Math.min(1, (1 - t) / 0.08)
    });
    bub('Vui quá đi~ 🌈✨', cx + rw * 0.08, arcY(0.6) - 28 * k, 0.52, 0.74, D);
    for (let t = 0.38; t < 0.76; t += 0.04) {
      const [px, py] = at(slideSegs, t);
      fx1(dot(rr(2, 4), '#FDE047', '253,224,71'), px, py + 8 * k, [
        { transform: 'translate(0,0) scale(0)', opacity: 0, offset: 0 },
        { transform: 'translate(0,0) scale(0)', opacity: 0, offset: t },
        { transform: 'translate(0,0) scale(1)', opacity: 1, offset: t + 0.01 },
        { transform: 'translate(' + rr(-10, 10) + 'px,' + rr(-10, 10) + 'px) scale(0)', opacity: 0, offset: Math.min(1, t + 0.12) },
        { transform: 'translate(0,0)', opacity: 0, offset: 1 }
      ], D);
    }
    return D;
  }
  if (type === 'frog') {
    const kf = k * 1.15, fx = W * rr(.2, .8), fy = m ? H - 50 : H * .84, sg = fx < W / 2 ? 1 : -1, D = 9, mx = fx + sg * 9 * kf, my = fy + .6 * kf, tx = fx + sg * 68.4 * kf, ty = fy - 36.5 * kf, tE = .53;
    fly(EA.FROG, 40, 30, [hold([fx, fy], 0, 1)], D, { flip: sg < 0, k: kf, opf: t => Math.min(1, t / .06, (1 - t) / .06), sync: [['[data-k="tg"]', [{ transform: 'rotate(-32deg) scaleX(0)', offset: 0 }, { transform: 'rotate(-32deg) scaleX(0)', offset: .5 }, { transform: 'rotate(-32deg) scaleX(1)', offset: tE }, { transform: 'rotate(-32deg) scaleX(0)', offset: .58 }, { transform: 'rotate(-32deg) scaleX(0)', offset: 1 }]]] });
    const fade = [{ opacity: 0 }, { opacity: 1, offset: .06 }, { opacity: 1, offset: .9 }, { opacity: 0 }];
    fx1('<span style="position:absolute;left:-.6px;top:' + (-90 * k).toFixed(0) + 'px;width:1.2px;height:' + (90 * k).toFixed(0) + 'px;background:linear-gradient(rgba(91,140,90,0),#5B8C5A)"></span>', tx, ty, fade, D);
    const lt = 'translate(' + (mx - tx).toFixed(1) + 'px,' + (my - ty).toFixed(1) + 'px) rotate(' + (-sg * 40) + 'deg) scale(.7)';
    fx1(EA.LEAF, tx, ty, [{ transform: 'translate(0,0) rotate(0deg) scale(1)', opacity: 0, offset: 0 }, { transform: 'translate(0,0) rotate(0deg) scale(1)', opacity: 1, offset: .06 }, { transform: 'translate(0,0) rotate(0deg) scale(1)', opacity: 1, offset: tE }, { transform: lt, opacity: 1, offset: .58 }, { transform: lt, opacity: 0, offset: .6 }, { transform: lt, opacity: 0, offset: 1 }], D);
    const hv = [tx + sg * 4 * k, ty - 16 * k];
    fly(EA.DFLY, 26, 14, [...cr([[tx + sg * 260 * k, ty - 100 * k, 0], [tx + sg * 60 * k, ty - 40 * k, .18], [hv[0], hv[1], .26], [hv[0] + 3 * k, hv[1] - 2 * k, .34], [hv[0] - 2 * k, hv[1] + 2 * k, .42], [hv[0], hv[1], .5], [tx - sg * 20 * k, ty - 80 * k, .54], [tx - sg * 220 * k, -60, .75]], 6), ln([tx - sg * 220 * k, -60], [tx - sg * 220 * k, -60], .75, 1, 1)], D, { flip: sg > 0, tk: .2, opf: t => t > .75 ? 0 : 1 });
    bub('Lêu lêu~', tx - sg * 20 * k, ty - 90 * k, .54, .66, D);
    bub('Ặc… lá!', fx, fy - 26 * kf, .6, .82, D);
    return D;
  }
  if (type === 'rainbow') {
    const D = 14, rw = m ? 320 : 760, rh = rw / 2, cx = W * rr(.3, .7), top = H * rr(.1, .22), n = m ? 34 : 80;
    for (let i = 0; i < n; i++) fx1('<span style="position:absolute;left:0;top:0;width:1.2px;height:' + rr(10, 18).toFixed(0) + 'px;transform:rotate(8deg);background:linear-gradient(rgba(150,190,225,0),rgba(140,180,220,.85))"></span>', rr(0, W + 60), -20, [{ transform: 'translate(0,0)', opacity: 0 }, { transform: 'translate(-8px,' + (H * .3).toFixed(0) + 'px)', opacity: 1, offset: .25 }, { transform: 'translate(-26px,' + (H + 40) + 'px)', opacity: .7 }], rr(.8, 1.2), R() * 4.2);
    fx1('<div style="position:absolute;left:' + (-rw / 2) + 'px;top:0;width:' + rw + 'px;height:' + rh + 'px;background:radial-gradient(circle ' + rh + 'px at 50% 100%,transparent 72%,rgba(239,68,68,.42) 75%,rgba(249,115,22,.42) 79%,rgba(250,204,21,.42) 83%,rgba(34,197,94,.38) 87%,rgba(59,130,246,.36) 91%,rgba(139,92,246,.34) 95%,transparent 98%);-webkit-mask-image:linear-gradient(to top,transparent,#000 40%);mask-image:linear-gradient(to top,transparent,#000 40%)"></div>', cx, top, [{ opacity: 0 }, { opacity: 0, offset: .3 }, { opacity: 1, offset: .42 }, { opacity: 1, offset: .82 }, { opacity: 0 }], D);
    return D;
  }
  if (type === 'gnome') {
    const kz = k * 1.2, gx = W * rr(.1, .9), gy2 = (m ? H - 14 : H - 6) - 15 * kz, D = 8;
    fly(EA.GNOME, 34, 30, [hold([gx, gy2], 0, 1)], D, { k: kz, opf: t => Math.min(1, t / .05, (1 - t) / .05), sync: [['[data-k="gn"]', [{ transform: 'translateY(18px)', offset: 0 }, { transform: 'translateY(18px)', offset: .12 }, { transform: 'translateY(6px)', offset: .2 }, { transform: 'translateY(6px)', offset: .28 }, { transform: 'translateY(-5px)', offset: .34 }, { transform: 'translateY(-5px)', offset: .8 }, { transform: 'translateY(18px)', offset: .86 }, { transform: 'translateY(18px)', offset: 1 }]], ['[data-k="eyes"]', [{ transform: 'translateX(0)', offset: 0 }, { transform: 'translateX(0)', offset: .36 }, { transform: 'translateX(-1.4px)', offset: .4 }, { transform: 'translateX(-1.4px)', offset: .5 }, { transform: 'translateX(1.4px)', offset: .55 }, { transform: 'translateX(1.4px)', offset: .64 }, { transform: 'translateX(0)', offset: .68 }, { transform: 'translateX(0)', offset: 1 }]]] });
    bub('Suỵt!', gx, gy2 - 22 * kz, .68, .8, D);
    return D;
  }
  if (type === 'bee') {
    const y = H * rr(.25, .5), D = rr(14, 18) * sp, segs = cr(Array.from({ length: 8 }, (_, j) => P(X0 + (X1 - X0) * j / 7, y + Math.sin(j * 2.1) * 24 * k + j * 6 * k, j / 7)), 8), td = rr(.4, .6), [bx, by] = at(segs, td), gyB = m ? H - 18 : H * .92, kb = k * 1.1;
    fly(EA.BEE, 30, 28, segs, D, { flip, tk: .15, k: kb, inner: 'transform-origin:50% 20%;animation:tkf-eWob .5s ease-in-out infinite alternate' });
    const y0 = by + 12 * kb;
    fx1('<span style="position:absolute;left:-2px;top:-3px;width:4px;height:5px;border-radius:50%;background:#F59E0B;box-shadow:0 0 3px rgba(245,158,11,.7)"></span>', bx, y0, [{ transform: 'translateY(0)', opacity: 1, easing: 'cubic-bezier(.5,0,1,1)' }, { transform: 'translateY(' + (gyB - y0).toFixed(0) + 'px)', opacity: 1 }], 1.1, td * D);
    fx1('<span style="position:absolute;left:-7px;top:-2px;width:14px;height:4px;border-radius:50%;background:#F59E0B"></span>', bx, gyB, [{ transform: 'scale(0)', opacity: 0 }, { transform: 'scale(1.2,1)', opacity: 1, offset: .1 }, { transform: 'scale(1)', opacity: 1, offset: .8 }, { transform: 'scale(1)', opacity: 0 }], 3, td * D + 1.1);
    const [qx, qy] = at(segs, td + .03);
    bub('Ối, rơi mật!', qx, qy - 22 * kb, td + .01, td + .1, D);
    return D;
  }
  if (type === 'dragon') {
    const y = H * rr(.15, .4), D = rr(14, 18) * sp, kd = k * 1.1, segs = cr(Array.from({ length: 7 }, (_, j) => P(X0 + (X1 - X0) * j / 6, y + Math.sin(j * 1.7) * 30 * k, j / 6)), 8), ts = rr(.35, .6), [nx, ny] = at(segs, ts);
    fly(EA.DRG, 44, 30, segs, D, { flip, tk: .3, k: kd, sync: [['[data-k="hd"]', headK(ts)]] });
    sneeze(nx + dir * 18 * kd, ny - kd, dir, kd, ts * D);
    return D;
  }
  if (type === 'leafrider') {
    const y0 = H * rr(.2, .45), D = rr(9, 12) * sp;
    fly(EA.LEAFR, 40, 26, cr([P(X0, y0, 0), P(W * .25, y0 + 60 * k, .25), P(W * .5, y0 - 30 * k, .5), P(W * .75, y0 + 50 * k, .75), P(X1, y0 - 40 * k, 1)], 10), D, { flip, tk: 1, k: k * 1.1 });
    return D;
  }
  if (type === 'constel') {
    const D = 10, S = m ? 170 : 290, cx = W * rr(.3, .7), cy = H * rr(.16, .3), sh = R() < .5 ? EA.CW : EA.CD, pt = p => [cx + dir * (p[0] - .5) * S, cy + (p[1] - .3) * S], seen = {}, uniq = [];
    sh.forEach(l => l.forEach(p => { const kk = p.join(','); if (!seen[kk]) { seen[kk] = 1; uniq.push(p); } }));
    uniq.forEach(p => { const [x, y] = pt(p), ox = rr(-220, 220) * k, oy = rr(-160, 160) * k, sx2 = rr(-200, 200) * k, sy2 = rr(-120, 160) * k; fx1(dot(rr(3, 4.5), '#F2FFB8', '210,255,120'), x, y, [{ transform: 'translate(' + ox.toFixed(0) + 'px,' + oy.toFixed(0) + 'px)', opacity: 0 }, { transform: 'translate(' + (ox * .5).toFixed(0) + 'px,' + (oy * .5).toFixed(0) + 'px)', opacity: 1, offset: .12 }, { transform: 'translate(0,0)', opacity: 1, offset: .3 }, { transform: 'translate(0,0)', opacity: .7, offset: .55 }, { transform: 'translate(0,0)', opacity: 1, offset: .78 }, { transform: 'translate(' + sx2.toFixed(0) + 'px,' + sy2.toFixed(0) + 'px)', opacity: 0 }], D); });
    const d = sh.map(l => 'M' + l.map(p => pt(p).map(v => v.toFixed(1)).join(' ')).join(' L')).join(' ');
    fx1('<svg width="' + W + '" height="' + H + '" style="position:absolute;left:0;top:0;overflow:visible;filter:drop-shadow(0 0 3px rgba(210,255,120,.7))"><path d="' + d + '" fill="none" stroke="rgba(230,255,190,.55)" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/></svg>', 0, 0, [{ opacity: 0 }, { opacity: 0, offset: .3 }, { opacity: 1, offset: .38 }, { opacity: 1, offset: .74 }, { opacity: 0, offset: .8 }, { opacity: 0 }], D);
    return D;
  }
  if (type === 'deer' || type === 'deernut') {
    const gy = m ? H - 46 : H * .8, sx = W * rr(.35, .6), D = rr(20, 24) * (m ? .65 : 1);
    const leg = (i, o, d, c, w) => '<g data-leg="' + i + '" style="transform-origin:' + o + '"><path d="' + d + '" stroke="' + c + '" stroke-width="' + w + '" stroke-linecap="round" fill="none"/></g>';
    fly('<svg width="90" height="80" viewBox="0 0 90 80" style="position:absolute;inset:0;overflow:visible;filter:drop-shadow(0 0 8px rgba(255,246,214,.9)) drop-shadow(0 2px 3px rgba(40,70,50,.25))">' + leg(1, '30px 50px', 'M30 49 L28 64 L27 77', '#E6DFCC', 3.2) + leg(2, '57px 49px', 'M57 48 L59 63 L58 77', '#E6DFCC', 3.2) + '<path d="M18 40 C17 33 26 30 40 31 C52 32 58 30 62 27 L66 24 C70 30 68 40 63 47 C57 54 34 55 25 52 C19 50 18 45 18 40 Z" fill="#FFFDF6"/><path d="M19 38 C15 35 13 39 16 42 Z" fill="#FFFDF6"/><circle cx="32" cy="36" r="1.3" fill="#F3DFA8"/><circle cx="38" cy="34" r="1.1" fill="#F3DFA8"/><circle cx="44" cy="36.5" r="1.2" fill="#F3DFA8"/><circle cx="50" cy="34" r="1" fill="#F3DFA8"/><g data-k="head" style="transform-origin:64px 26px"><path d="M60 30 C62 24 64 18 68 15 C72 12 78 13 81 17 C84 20 85 23 83 25.5 C80 26.5 76 25.5 72 27 C69 29 67 33 66 38 Z" fill="#FFFDF6"/><path d="M68 16 L61 12.5 L66.5 19 Z" fill="#F1E8D2"/><circle cx="76" cy="18.6" r="1.1" fill="#2E3B33"/><circle cx="83.4" cy="23.4" r="1.1" fill="#BFA98A"/><path d="M70 13 C68 7 64 4 58 2 M66 8.5 C63 8 61 5.5 61 2 M72 12.5 C74 6 78 3 84 1.5 M76 7 C79 6 80.5 3.5 80.5 0" stroke="#F5D98A" stroke-width="1.6" fill="none" stroke-linecap="round"/><circle cx="58" cy="2" r="1.4" fill="#FFF7D6"/><circle cx="84" cy="1.5" r="1.4" fill="#FFF7D6"/><circle cx="80.5" cy="0" r="1.1" fill="#FFF7D6"/></g>' + leg(0, '34px 50px', 'M34 50 L35 64 L34 78', '#FFFFFF', 3.4) + leg(3, '61px 47px', 'M61 46 L64 62 L64 78', '#FFFFFF', 3.4) + '</svg>', 90, 80, [...cr([P(X0, gy, 0), P(sx * .5, gy + 2, .2), P(sx, gy, .4)], 8), hold(P(sx, gy), .4, .62), ...cr([P(sx, gy, .62), P(sx + (W - sx) * .25, gy - 2, .8), P(sx + (W - sx) * .5, gy - 4, 1)], 8)], D, { flip, k: k * 1.1, opf: t => Math.min(1, t / .04, (1 - t) / .22), sync: [['[data-k="head"]', [{ transform: 'scaleX(1)', offset: 0 }, { transform: 'scaleX(1)', offset: .44 }, { transform: 'scaleX(-1)', offset: .48 }, { transform: 'scaleX(-1)', offset: .57 }, { transform: 'scaleX(1)', offset: .61 }, { transform: 'scaleX(1)', offset: 1 }]]], on: (el, ms, dl) => walk(el, ms, dl, .4, .62, 420, 14) });
    if (type === 'deernut') {
      const kd = k * 1.1, sgn = flip ? -1 : 1, hx = P(sx, gy)[0] + sgn * 26 * kd, hy = gy - 24 * kd, qx = Math.min(W - 30, Math.max(30, hx + sgn * 150 * k)), qy = Math.max(70 * k, hy - 220 * k), t1 = .46, t2 = .5, SQ = '<svg width="34" height="26" viewBox="0 0 34 26" style="position:absolute;inset:0;overflow:visible;filter:drop-shadow(0 1px 2px rgba(60,40,20,.35))"><path d="M13 20 C2 23 -2 12 2 6 C5 1 12 2 12 8 C12 12 8 12 8 15 C9 18 12 18 14 18 Z" fill="#C2783F"/><path d="M5 6 C7 4 10 5 10 8" stroke="#E5AD74" stroke-width="1.2" fill="none"/><ellipse cx="19" cy="17" rx="8" ry="6" fill="#B86B34"/><ellipse cx="20.5" cy="19" rx="5" ry="3.4" fill="#F1D3AE"/><path d="M15 22 L13 25 M22 22 L24 25" stroke="#9A5527" stroke-width="1.6" stroke-linecap="round"/><g data-k="hd" style="transform-origin:23px 14px"><circle cx="26" cy="11" r="4.6" fill="#B86B34"/><path d="M24 7.5 L24.6 3.6 L27 7 Z" fill="#9A5527"/><circle cx="27.6" cy="10.4" r=".9" fill="#1A1A1A"/><circle cx="30.4" cy="12" r=".7" fill="#3A2A20"/></g><ellipse cx="27.5" cy="17" rx="2.2" ry="2.6" fill="#A16207"/><path d="M25.1 15.6 Q27.5 13.6 29.9 15.6 Z" fill="#713F12"/></svg>', gnd = gy + 36 * kd;
      fx1('<div style="position:absolute;left:' + (-30 * k) + 'px;top:0;width:' + (60 * k) + 'px;height:' + (4 * k) + 'px;border-radius:3px;background:linear-gradient(90deg,rgba(110,80,50,0),#7A5A3A 20%,#7A5A3A 80%,rgba(110,80,50,0))"></div>', qx, qy + 12 * k, [{ opacity: 0 }, { opacity: 1, offset: .05 }, { opacity: 1, offset: .92 }, { opacity: 0 }], D);
      fly(SQ, 34, 26, [hold([qx, qy], 0, 1)], D, { flip: sgn > 0, opf: t => Math.min(1, t / .05, (1 - t) / .05) });
      const a0 = [qx - sgn * 10 * k, qy - 2 * k], a1 = [hx + sgn * 46 * k, gnd];
      fly(EA.ACORN, 8, 10, [ln(a0, a0, 0, t1, 1), ...cr([[a0[0], a0[1], t1], [(qx + hx) / 2, Math.min(qy, hy) - 40 * k, (t1 + t2) / 2], [hx, hy, t2], [hx + sgn * 28 * k, hy - 26 * k, t2 + .04], [a1[0], a1[1], .6]], 6), ln(a1, a1, .6, 1, 1)], D, { k: k * 1.2, opf: t => t < t1 - .005 || t > .75 ? 0 : 1 });
      fx1(EA.STAR, hx, hy, [{ transform: 'scale(.2)', opacity: 0 }, { transform: 'scale(' + k + ')', opacity: 1, offset: .3 }, { transform: 'scale(' + 1.3 * k + ')', opacity: 0 }], .6, t2 * D);
      bub('?!', hx, hy - 22 * k, t2 + .01, .6, D);
      bub('Hí hí!', qx, qy - 22 * k, t2 + .02, t2 + .12, D);
    }
    else if (R() < .6) {
      const kd = k * 1.1, ax = P(sx, gy)[0] + (flip ? -1 : 1) * 25 * kd, ay = gy - 44 * kd, bc = R() < .5 ? '196,181,253' : '249,168,212';
      const BF = '<svg width="18" height="14" viewBox="0 0 18 14" style="position:absolute;inset:0;overflow:visible;filter:drop-shadow(0 0 4px rgba(' + bc + ',.95))"><g style="transform-origin:9px 7px;animation:tkf-flap .16s ease-in-out infinite alternate"><path d="M9 7 C6 0 0 0 1 5 C2 8 6 8 9 7 Z M9 7 C12 0 18 0 17 5 C16 8 12 8 9 7 Z" fill="rgba(' + bc + ',.6)" stroke="rgba(255,255,255,.95)" stroke-width=".6"/></g><path d="M9 4 V11" stroke="#6B5B40" stroke-width="1" stroke-linecap="round"/></svg>', pa = [ax, ay];
      fly(BF, 18, 14, [...cr([[ax + rr(-220, 220) * k, -30, 0], [ax + rr(-90, 90) * k, ay - 130 * k, .3], [ax + 24 * k, ay - 34 * k, .4], [ax, ay, .45]], 6), ln(pa, pa, .45, .6, 2), ...cr([[ax, ay, .6], [ax + rr(-70, 70) * k, ay - 110 * k, .72], [ax + rr(-220, 220) * k, -40, 1]], 6)], D, { tk: .2, k: k * 1.1 });
    }
    return D;
  }
  if (type === 'butterflies') {
    const cx = W * rr(.2, .8), cy = H * rr(.15, .45), n = m ? 5 : 8, D = rr(11, 14) * (m ? .8 : 1), C = ['110,231,183', '196,181,253', '252,211,77', '249,168,212'];
    fx1('<div style="position:absolute;left:' + (-60 * k) + 'px;top:' + (-H) + 'px;width:' + (120 * k) + 'px;height:' + (H * 1.6) + 'px;transform:rotate(14deg);background:linear-gradient(90deg,rgba(255,248,220,0),rgba(255,248,220,.45),rgba(255,248,220,0))' + (m ? '' : ';filter:blur(10px)') + '"></div>', cx, cy, [{ opacity: 0 }, { opacity: 1, offset: .2 }, { opacity: 1, offset: .75 }, { opacity: 0 }], D);
    for (let i = 0; i < n; i++) {
      const r = rr(40, 110) * k, ph = R() * Math.PI * 2, loops = rr(1.2, 1.8), N = 18, cw = R() < .5 ? 1 : -1, c = C[i % 4];
      const Q = Array.from({ length: N + 1 }, (_, j) => { const a = ph + cw * loops * Math.PI * 2 * j / N; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r * .55 + Math.sin(j * 1.7) * 6, j / N]; });
      fly('<svg width="18" height="14" viewBox="0 0 18 14" style="position:absolute;inset:0;overflow:visible;filter:drop-shadow(0 0 4px rgba(' + c + ',.95))"><g style="transform-origin:9px 7px;animation:tkf-flap .16s ease-in-out infinite alternate"><path d="M9 7 C6 0 0 0 1 5 C2 8 6 8 9 7 Z M9 7 C12 0 18 0 17 5 C16 8 12 8 9 7 Z" fill="rgba(' + c + ',.6)" stroke="rgba(255,255,255,.95)" stroke-width=".6"/><path d="M9 7.5 C7 12 3 13 3.5 10 C4 8.5 7 8 9 7.5 Z M9 7.5 C11 12 15 13 14.5 10 C14 8.5 11 8 9 7.5 Z" fill="rgba(' + c + ',.5)" stroke="rgba(255,255,255,.85)" stroke-width=".5"/></g><path d="M9 4 V11" stroke="#6B5B40" stroke-width="1" stroke-linecap="round"/></svg>', 18, 14, cr(Q, 4), D, { tk: .25, delay: R() * 1.2, opf: t => Math.min(1, t / .1, (1 - t) / .15) });
    }
    return D + 1.2;
  }
  if (type === 'bluebird') {
    const y = H * rr(.1, .38), D = rr(11, 15) * sp;
    fly('<div style="position:absolute;left:-96px;top:5px;width:100px;height:10px;background-image:radial-gradient(1.4px 1.4px at 6px 4px,#FDE68A,transparent),radial-gradient(1px 1px at 18px 8px,#FFF7D6,transparent),radial-gradient(1.2px 1.2px at 28px 2px,#FCD34D,transparent);background-size:34px 10px;-webkit-mask-image:linear-gradient(to left,#000,transparent);mask-image:linear-gradient(to left,#000,transparent);filter:drop-shadow(0 0 3px rgba(253,224,71,.9))"></div><svg width="46" height="20" viewBox="0 0 46 20" style="position:absolute;inset:0;overflow:visible;filter:drop-shadow(0 0 4px rgba(125,211,252,.75))"><g style="transform-origin:18px 9px;animation:tkf-eRibbon 1.4s ease-in-out infinite alternate"><path d="M18 9 C10 4 4 12 -14 6" stroke="#7DD3FC" stroke-width="1.6" fill="none" stroke-linecap="round"/><path d="M18 10 C10 14 2 8 -12 15" stroke="#C4B5FD" stroke-width="1.4" fill="none" stroke-linecap="round"/></g><ellipse cx="27" cy="10" rx="10" ry="5.2" fill="#3B82F6"/><ellipse cx="29" cy="12" rx="6" ry="3" fill="#BFDBFE"/><circle cx="36" cy="8" r="4.2" fill="#2563EB"/><path d="M39.6 7 L44 8.4 L39.6 9.6 Z" fill="#F59E0B"/><circle cx="37.4" cy="7.2" r=".9" fill="#0B1220"/><g style="transform-origin:26px 8px;animation:tkf-eFlapY .22s ease-in-out infinite alternate"><path d="M22 8 C24 0 30 -2 34 1 C30 4 28 7 28 9 Z" fill="#60A5FA"/></g></svg>', 46, 20, cr([P(X0, y, 0), P(W * .3, y + rr(-40, 40), .3), P(W * .6, y + rr(-50, 30), .6), P(X1, y + rr(-60, 20), 1)], 10), D, { flip, tk: .3 });
    return D;
  }
  if (type === 'mushroom') {
    const x = W * rr(.08, .92), y = (m ? H - 10 : H) - rr(18, 50) * k, D = 7, s = k * rr(.9, 1.3);
    fx1('<svg width="26" height="26" viewBox="0 0 26 26" style="position:absolute;left:-13px;top:-26px;overflow:visible;filter:drop-shadow(0 0 6px rgba(253,224,71,.8))"><path d="M10 14 C10 20 9 24 8 26 H18 C17 24 16 20 16 14 Z" fill="#FFF7E6"/><path d="M1 14 C1 6 7 1 13 1 C19 1 25 6 25 14 C20 15.5 6 15.5 1 14 Z" fill="#F59E0B"/><path d="M1 14 C1 6 7 1 13 1 C19 1 25 6 25 14" fill="none" stroke="#FDE68A" stroke-width="1"/><circle cx="8" cy="8" r="1.6" fill="#FFF7E6"/><circle cx="15" cy="5" r="1.3" fill="#FFF7E6"/><circle cx="19" cy="10" r="1.5" fill="#FFF7E6"/></svg>', x, y, [{ transform: 'scale(0)', opacity: 0, offset: 0 }, { transform: 'scale(' + (s * 1.08).toFixed(2) + ')', opacity: 1, offset: .12 }, { transform: 'scale(' + s.toFixed(2) + ')', opacity: 1, offset: .18 }, { transform: 'scale(' + (s * 1.15).toFixed(2) + ',' + (s * .9).toFixed(2) + ')', opacity: 1, offset: .3 }, { transform: 'scale(' + s.toFixed(2) + ')', opacity: 1, offset: .34 }, { transform: 'scale(' + s.toFixed(2) + ')', opacity: 1, offset: .85 }, { transform: 'scale(0)', opacity: 0, offset: 1 }], D);
    for (let i = 0; i < (m ? 12 : 20); i++) { const dx = rr(-50, 50) * k, dy = -rr(70, 190) * k; fx1(dot(rr(2, 4.5), '#FFF3B0', '253,224,71'), x, y - 18 * s, [{ transform: 'translate(0,0)', opacity: 0, offset: 0 }, { transform: 'translate(0,0)', opacity: 0, offset: .3 }, { transform: 'translate(' + (dx * .3).toFixed(1) + 'px,' + (dy * .4).toFixed(1) + 'px)', opacity: 1, offset: .45 }, { transform: 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px)', opacity: 0, offset: 1 }], D * rr(.75, 1), R() * .5); }
    return D;
  }
  if (type === 'dandelion') {
    const n = m ? 6 : 10, y0 = H * rr(.2, .6), D0 = rr(14, 20) * sp;
    const fan = Array.from({ length: 11 }, (_, j) => { const a = -Math.PI * j / 10; return 'M7 7 L' + (7 + 6 * Math.cos(a)).toFixed(1) + ' ' + (7 + 6 * Math.sin(a)).toFixed(1); }).join(' ');
    for (let i = 0; i < n; i++) {
      const y = y0 + rr(-80, 80) * k, w = Array.from({ length: 6 }, (_, j) => P(X0 + (X1 - X0) * j / 5 + rr(-30, 30), y + rr(-40, 40) * k - j * rr(4, 12), j / 5));
      fly('<svg width="14" height="20" viewBox="0 0 14 20" style="position:absolute;inset:0;overflow:visible;filter:drop-shadow(0 1px 1.5px rgba(40,80,60,.4))"><path d="M7 7 V18" stroke="#F5F1E3" stroke-width=".8"/><ellipse cx="7" cy="18.5" rx="1" ry="1.6" fill="#B7A27A"/><path d="' + fan + '" stroke="rgba(255,255,255,.95)" stroke-width=".6" stroke-linecap="round"/><circle cx="7" cy="7" r=".9" fill="#fff"/></svg>', 14, 20, cr(w, 8), D0 * rr(.85, 1.15), { delay: R() * 3, inner: 'transform-origin:50% 30%;animation:tkf-eSway ' + rr(1.4, 2.4).toFixed(1) + 's ease-in-out ' + (-R() * 2).toFixed(1) + 's infinite alternate' });
    }
    return D0 * 1.15 + 3;
  }
  if (type === 'squirrel' || type === 'squirrelchase') {
    const y0 = H * rr(.1, .22), step = 70 * k, px = W * rr(.4, .6), D = rr(9, 12) * (m ? .7 : 1);
    const hops = (xa, xb, t0, t1) => { const n = Math.max(2, Math.round(Math.abs(xb - xa) / step)), Q = []; for (let j = 0; j <= n * 2; j++) Q.push(P(xa + (xb - xa) * j / (n * 2), j % 2 ? y0 - 16 * k : y0, t0 + (t1 - t0) * j / (n * 2))); return cr(Q, 4); };
    const nib = [{ transform: 'rotate(0deg)', offset: 0 }]; for (let j = 0; j <= 6; j++) nib.push({ transform: 'rotate(' + (j % 2 ? 10 : 0) + 'deg)', offset: .46 + j * .02 }); nib.push({ transform: 'rotate(0deg)', offset: 1 });
    const SQ = '<svg width="34" height="26" viewBox="0 0 34 26" style="position:absolute;inset:0;overflow:visible;filter:drop-shadow(0 1px 2px rgba(60,40,20,.35))"><path d="M13 20 C2 23 -2 12 2 6 C5 1 12 2 12 8 C12 12 8 12 8 15 C9 18 12 18 14 18 Z" fill="#C2783F"/><path d="M5 6 C7 4 10 5 10 8" stroke="#E5AD74" stroke-width="1.2" fill="none"/><ellipse cx="19" cy="17" rx="8" ry="6" fill="#B86B34"/><ellipse cx="20.5" cy="19" rx="5" ry="3.4" fill="#F1D3AE"/><path d="M15 22 L13 25 M22 22 L24 25" stroke="#9A5527" stroke-width="1.6" stroke-linecap="round"/><g data-k="hd" style="transform-origin:23px 14px"><circle cx="26" cy="11" r="4.6" fill="#B86B34"/><path d="M24 7.5 L24.6 3.6 L27 7 Z" fill="#9A5527"/><circle cx="27.6" cy="10.4" r=".9" fill="#1A1A1A"/><circle cx="30.4" cy="12" r=".7" fill="#3A2A20"/></g><ellipse cx="27.5" cy="17" rx="2.2" ry="2.6" fill="#A16207"/><path d="M25.1 15.6 Q27.5 13.6 29.9 15.6 Z" fill="#713F12"/></svg>';
    if (type === 'squirrelchase') {
      const D2 = rr(10, 13) * (m ? .7 : 1), xs = W * rr(.55, .72), sf = 'display:inline-block;' + (flip ? 'transform:scaleX(-1);' : '');
      const q = '<div data-k="q" style="position:absolute;left:22px;top:-20px;padding:3px 7px;border-radius:9px 9px 9px 2px;background:#fff;border:1px solid #D9EBDD;color:#2F5E44;white-space:nowrap;opacity:0"><span style="' + sf + 'font:800 11px/1 \'Be Vietnam Pro\',sans-serif">?!</span></div>';
      fly(q + SQ, 34, 26, [...hops(X0, xs, 0, .68), ...cr([P(xs, y0, .68), P(xs + 30 * k, y0 - 64 * k, .74), P(xs + 60 * k, y0, .8)], 6), hold(P(xs + 60 * k, y0), .8, 1)], D2, { flip, tk: .35, opf: t => Math.min(1, (1 - t) / .08), sync: [['[data-k="q"]', [{ opacity: 0, offset: 0 }, { opacity: 0, offset: .8 }, { opacity: 1, offset: .82 }, { opacity: 1, offset: .94 }, { opacity: 0, offset: .97 }, { opacity: 0, offset: 1 }]]] });
      const bc = '249,168,212', BF = '<svg width="18" height="14" viewBox="0 0 18 14" style="position:absolute;inset:0;overflow:visible;filter:drop-shadow(0 0 4px rgba(' + bc + ',.95))"><g style="transform-origin:9px 7px;animation:tkf-flap .16s ease-in-out infinite alternate"><path d="M9 7 C6 0 0 0 1 5 C2 8 6 8 9 7 Z M9 7 C12 0 18 0 17 5 C16 8 12 8 9 7 Z" fill="rgba(' + bc + ',.6)" stroke="rgba(255,255,255,.95)" stroke-width=".6"/></g><path d="M9 4 V11" stroke="#6B5B40" stroke-width="1" stroke-linecap="round"/></svg>';
      const bp = Array.from({ length: 8 }, (_, j) => { const u = j / 7; return P(X0 + 100 * k + (xs + 50 * k - X0 - 100 * k) * u, y0 - 34 * k + Math.sin(j * 1.9) * 16 * k, u * .7); });
      fly(BF, 18, 14, cr([...bp, P(xs + 70 * k, y0 - 110 * k, .76), P(xs + 30 * k, y0 - 210 * k, .86), P(xs + rr(-60, 120) * k, -40, 1)], 5), D2, { tk: .2, k: k * 1.1 });
      return D2;
    }
    fly(SQ, 34, 26, [...hops(X0, px, 0, .45), hold(P(px, y0), .45, .6), ...hops(px, X1, .6, 1)], D, { flip, tk: .35, sync: [['[data-k="hd"]', nib]] });
    return D;
  }
  if (type === 'sunray') {
    const D = rr(12, 16) * (m ? .7 : 1), bw = m ? 140 : 260;
    fx1('<div style="position:absolute;left:' + (-bw / 2) + 'px;top:' + (-H * .2).toFixed(0) + 'px;width:' + bw + 'px;height:' + (H * 1.5).toFixed(0) + 'px;transform:rotate(18deg);transform-origin:50% 0;background:linear-gradient(90deg,rgba(255,244,200,0),rgba(255,244,200,.5) 50%,rgba(255,244,200,0))' + (m ? '' : ';filter:blur(14px)') + ';mix-blend-mode:screen"></div>', 0, 0, [{ transform: 'translateX(' + (dir > 0 ? -bw * 2 : W + bw * 2) + 'px)', opacity: 0 }, { opacity: 1, offset: .2 }, { opacity: 1, offset: .8 }, { transform: 'translateX(' + (dir > 0 ? W + bw * 2 : -bw * 2) + 'px)', opacity: 0 }], D);
    return D;
  }
  if (type === 'lanterns') {
    const n = m ? 5 : 8, y = H * rr(.3, .5), D = rr(26, 32) * sp, path = cr(Array.from({ length: 6 }, (_, j) => P(X0 + (X1 - X0) * j / 5, y + rr(-30, 30) * k, j / 5)), 10), gap = rr(.9, 1.3) * (m ? .8 : 1);
    const LANT = '<div style="position:absolute;left:-10px;top:-8px;width:34px;height:38px;border-radius:50%;background:radial-gradient(closest-side,rgba(253,224,130,.5),rgba(253,224,130,0));animation:tkf-twinkleB 1.6s ease-in-out infinite"></div><span style="position:absolute;left:6.5px;top:-6px;width:1px;height:7px;background:rgba(227,194,122,.8)"></span><span style="position:absolute;left:2px;top:1px;width:10px;height:2px;border-radius:1px;background:#8A6416"></span><span style="position:absolute;left:1px;top:3px;width:12px;height:14px;border-radius:40%;background:radial-gradient(60% 60% at 50% 55%,#FFF7D6,#FCD34D 55%,#F59E0B);box-shadow:0 0 10px 3px rgba(252,211,77,.55)"></span><span style="position:absolute;left:2px;top:17px;width:10px;height:2px;border-radius:1px;background:#8A6416"></span><span style="position:absolute;left:6.5px;top:19px;width:1px;height:4px;background:rgba(227,194,122,.8)"></span>';
    for (let i = 0; i < n; i++) fly(LANT, 14, 22, path, D, { delay: i * gap, inner: '--by:' + rr(3, 6).toFixed(1) + 'px;animation:tkf-eBob ' + rr(1.6, 2.4).toFixed(2) + 's ease-in-out ' + (-R() * 2).toFixed(2) + 's infinite alternate' });
    return D + n * gap;
  }
  if (type === 'owl' || type === 'owlmiss' || type === 'owlsinge') {
    const OWL = '<svg width="30" height="38" viewBox="0 0 30 38" style="position:absolute;inset:0;overflow:visible;filter:drop-shadow(0 0 5px rgba(94,242,194,.35))"><g data-k="wings" style="opacity:0"><g style="transform-origin:15px 20px;animation:tkf-eFlapY .22s ease-in-out infinite alternate"><path d="M7 20 C-4 12 -9 17 -11 23 C-3 21 2 23 7 25 Z M23 20 C34 12 39 17 41 23 C33 21 28 23 23 25 Z" fill="#3B4A44" stroke="rgba(167,255,228,.35)" stroke-width=".6"/></g></g><path d="M6 30 C4 20 6 14 15 13 C24 14 26 20 24 30 C22 35 8 35 6 30 Z" fill="#3B4A44" stroke="rgba(167,255,228,.3)" stroke-width=".6"/><path d="M10 28 C10 22 12 19 15 19 C18 19 20 22 20 28 Z" fill="#56685F"/><path d="M12 22 L13 23.5 L14 22 M16 22 L17 23.5 L18 22 M13.5 25 L14.5 26.5 L15.5 25" stroke="#7C9188" stroke-width=".6" fill="none"/><path d="M11 33 L10 36.5 M19 33 L20 36.5" stroke="#E3C27A" stroke-width="1.4" stroke-linecap="round"/><g data-k="head" style="transform-origin:15px 10px"><path d="M5 12 C4 5 9 2 15 2 C21 2 26 5 25 12 C24 17 6 17 5 12 Z" fill="#46574F" stroke="rgba(167,255,228,.3)" stroke-width=".6"/><path d="M6 4.5 L5 0 L9.5 3 Z M24 4.5 L25 0 L20.5 3 Z" fill="#46574F"/><g data-k="back" style="opacity:0"><path d="M10 7 Q15 10 20 7 M11 10.5 Q15 13 19 10.5" stroke="#5E7268" stroke-width="1" fill="none"/></g><g data-k="eyes"><circle cx="10.5" cy="9.5" r="3.7" fill="#0E1A16"/><circle cx="19.5" cy="9.5" r="3.7" fill="#0E1A16"/><g style="transform-origin:15px 9.5px;animation:tkf-eBlink 3.4s infinite"><circle cx="10.5" cy="9.5" r="2.6" fill="#5EF2C2"/><circle cx="19.5" cy="9.5" r="2.6" fill="#5EF2C2"/><circle cx="10.8" cy="9.6" r="1.1" fill="#04140D"/><circle cx="19.8" cy="9.6" r="1.1" fill="#04140D"/></g><path d="M14 12.4 L15 15 L16 12.4 Z" fill="#E3C27A"/></g></g></svg>';
    if (type === 'owlsinge') {
      const D2 = rr(12, 14), px = W * rr(.3, .7), py = H * rr(.16, .3), ts = .45, kd = k * 1.1, sx0 = dir > 0 ? X0 : X1, ex0 = dir > 0 ? X1 : X0, dxp = px - dir * 70 * k, dyp = py + 4 * k;
      fx1('<div style="position:absolute;left:' + (-26 * k) + 'px;top:0;width:' + (52 * k) + 'px;height:' + (4 * k) + 'px;border-radius:3px;background:linear-gradient(90deg,rgba(74,58,44,0),#4A3A2C 20%,#4A3A2C 80%,rgba(74,58,44,0))"></div>', px, py + 17 * k, [{ opacity: 0 }, { opacity: 1, offset: .05 }, { opacity: 1, offset: .9 }, { opacity: 0 }], D2);
      fly(OWL, 30, 38, [hold([px, py], 0, .8), ...cr([[px, py, .8], [px + dir * 90 * k, py - 50 * k, .9], [px + dir * 260 * k, -90, 1]], 8)], D2, { opf: t => Math.min(1, t / .06), sync: [['svg', [{ transform: 'scale(1)', offset: 0 }, { transform: 'scale(1)', offset: ts + .02 }, { transform: 'scale(1.28)', offset: ts + .045 }, { transform: 'scale(1.22)', offset: ts + .16 }, { transform: 'scale(1)', offset: ts + .2 }, { transform: 'scale(1)', offset: 1 }]], ['[data-k="wings"]', [{ opacity: 0, offset: 0 }, { opacity: 0, offset: .8 }, { opacity: 1, offset: .82 }, { opacity: 1, offset: 1 }]]] });
      fly(EA.DRG, 44, 30, cr([[sx0, py + 60 * k, 0], [px - dir * 220 * k, py + 30 * k, ts * .6], [dxp, dyp, ts], [dxp + dir * 6 * k, dyp - 4 * k, ts + .06], [px + dir * 150 * k, py - 80 * k, .75], [ex0, py - 140 * k, 1]], 8), D2, { flip, tk: .3, k: kd, sync: [['[data-k="hd"]', headK(ts)]] });
      sneeze(dxp + dir * 18 * kd, dyp - kd, dir, kd, ts * D2);
      for (let i = 0; i < 7; i++) fx1('<span style="position:absolute;left:-4px;top:-4px;width:8px;height:8px;border-radius:50%;background:rgba(80,90,85,.55)"></span>', px + rr(-10, 10) * k, py + rr(-12, 8) * k, [{ transform: 'translate(0,0) scale(.4)', opacity: 0 }, { transform: 'translate(0,0) scale(1)', opacity: .9, offset: .2 }, { transform: 'translate(' + rr(-12, 12).toFixed(1) + 'px,' + (-rr(20, 40) * k).toFixed(1) + 'px) scale(1.8)', opacity: 0 }], rr(1.2, 1.8), ts * D2 + .1 + R() * .3);
      bub('Grừ!! Cháy lông rồi!', px, py - 26 * k, ts + .06, ts + .28, D2);
      return D2;
    }
    if (type === 'owlmiss') {
      const D2 = rr(11, 13), fx = W * rr(.35, .6), fy = H * rr(.3, .45), tm = .45, lx = Math.min(W - 40, fx + 220 * k), ly = H * rr(.16, .26), Lx = P(lx, ly)[0];
      const q = '<div data-k="q" style="position:absolute;left:24px;top:-18px;padding:3px 7px;border-radius:9px 9px 9px 2px;background:rgba(8,21,15,.92);border:1px solid rgba(94,242,194,.35);color:#E8FFF4;white-space:nowrap;opacity:0;font:800 11px/1 \'Be Vietnam Pro\',sans-serif">?</div>';
      fx1('<div style="position:absolute;left:' + (-26 * k) + 'px;top:0;width:' + (52 * k) + 'px;height:' + (4 * k) + 'px;border-radius:3px;background:linear-gradient(90deg,rgba(74,58,44,0),#4A3A2C 20%,#4A3A2C 80%,rgba(74,58,44,0))"></div>', Lx, ly + 17 * k, [{ opacity: 0, offset: 0 }, { opacity: 0, offset: .55 }, { opacity: 1, offset: .6 }, { opacity: 1, offset: .9 }, { opacity: 0, offset: 1 }], D2);
      const s0 = P(-60, fy - 220 * k);
      fly(q + OWL, 30, 38, [ln(s0, s0, 0, .15, 1), ...cr([[s0[0], s0[1], .15], P(fx - 130 * k, fy - 70 * k, .33), P(fx, fy + 10 * k, tm), P(fx + 110 * k, fy - 20 * k, .53), P(lx, ly, .62)], 8), hold(P(lx, ly), .62, .85), ...cr([P(lx, ly, .85), P(lx + 90 * k, ly - 80 * k, .93), P(lx + 260 * k, -90, 1)], 6)], D2, { opf: t => t < .14 ? 0 : 1, sync: [['[data-k="wings"]', [{ opacity: 1, offset: 0 }, { opacity: 1, offset: .61 }, { opacity: 0, offset: .63 }, { opacity: 0, offset: .85 }, { opacity: 1, offset: .86 }, { opacity: 1, offset: 1 }]], ['[data-k="q"]', [{ opacity: 0, offset: 0 }, { opacity: 0, offset: .64 }, { opacity: 1, offset: .66 }, { opacity: 1, offset: .82 }, { opacity: 0, offset: .85 }, { opacity: 0, offset: 1 }]]] });
      const ff = '<div style="position:absolute;left:-12px;top:-12px;width:24px;height:24px;border-radius:50%;background:radial-gradient(closest-side,rgba(210,255,120,.55),rgba(210,255,120,0))"></div>' + dot(4.5, '#F2FFB8', '210,255,120') + '<div data-k="hh" style="position:absolute;left:8px;top:-22px;white-space:nowrap;opacity:0;font:700 10px/1 \'Be Vietnam Pro\',sans-serif;color:#E8FFF4;text-shadow:0 0 6px rgba(94,242,194,.9)">hí hí</div>';
      fly(ff, 0, 0, cr([P(fx - 70 * k, fy + 30 * k, 0), P(fx - 30 * k, fy + 10 * k, .2), P(fx + 6 * k, fy - 4 * k, .35), P(fx, fy, tm - .03), P(fx + 14 * k, fy - 60 * k, tm + .01), P(fx - 40 * k, fy - 100 * k, .62), P(fx - 120 * k, fy - 70 * k, .82), P(fx - 200 * k, fy - 110 * k, 1)], 6), D2, { tk: 0, opf: t => Math.min(1, t / .05, (1 - t) / .1), sync: [['[data-k="hh"]', [{ opacity: 0, offset: 0 }, { opacity: 0, offset: tm + .02 }, { opacity: 1, offset: tm + .04 }, { opacity: 1, offset: tm + .14 }, { opacity: 0, offset: tm + .17 }, { opacity: 0, offset: 1 }]]] });
      return D2;
    }
    const px = W * rr(.15, .85), py = H * rr(.14, .32), D = rr(11, 13);
    fx1('<div style="position:absolute;left:' + (-26 * k) + 'px;top:0;width:' + (52 * k) + 'px;height:' + (4 * k) + 'px;border-radius:3px;background:linear-gradient(90deg,rgba(74,58,44,0),#4A3A2C 20%,#4A3A2C 80%,rgba(74,58,44,0))"></div>', px, py + 17 * k, [{ opacity: 0 }, { opacity: 1, offset: .05 }, { opacity: 1, offset: .9 }, { opacity: 0 }], D);
    fly(OWL, 30, 38, [hold([px, py], 0, .72), ...cr([[px, py, .72], [px + dir * 90 * k, py - 50 * k, .84], [px + dir * 260 * k, -90, 1]], 8)], D, { opf: t => Math.min(1, t / .06), scf: t => t < .72 ? 1 : 1 - (t - .72) * 1.6, sync: [
      ['[data-k="head"]', [{ transform: 'scaleX(1)', offset: 0 }, { transform: 'scaleX(1)', offset: .28 }, { transform: 'scaleX(.06)', offset: .31 }, { transform: 'scaleX(1)', offset: .34 }, { transform: 'scaleX(1)', offset: .52 }, { transform: 'scaleX(.06)', offset: .55 }, { transform: 'scaleX(1)', offset: .58 }, { transform: 'scaleX(1)', offset: 1 }]],
      ['[data-k="eyes"]', [{ opacity: 1, offset: 0 }, { opacity: 1, offset: .31 }, { opacity: 0, offset: .311 }, { opacity: 0, offset: .55 }, { opacity: 1, offset: .551 }, { opacity: 1, offset: 1 }]],
      ['[data-k="back"]', [{ opacity: 0, offset: 0 }, { opacity: 0, offset: .31 }, { opacity: 1, offset: .311 }, { opacity: 1, offset: .55 }, { opacity: 0, offset: .551 }, { opacity: 0, offset: 1 }]],
      ['[data-k="wings"]', [{ opacity: 0, offset: 0 }, { opacity: 0, offset: .72 }, { opacity: 1, offset: .74 }, { opacity: 1, offset: 1 }]]] });
    return D;
  }
  if (type === 'koi' || type === 'koistar') {
    const n = m ? 2 : 3, D = rr(22, 28) * sp;
    const KOI = '<svg width="64" height="26" viewBox="0 0 64 26" style="position:absolute;inset:0;overflow:visible;filter:drop-shadow(0 0 8px rgba(94,242,194,.55))"><g style="transform-origin:16px 13px;animation:tkf-eTail .9s ease-in-out infinite alternate"><path d="M16 13 C10 6 4 2 0 3 C3 8 4 11 3 13 C4 15 3 18 0 23 C4 24 10 20 16 13 Z" fill="rgba(255,237,213,.75)" stroke="rgba(255,255,255,.8)" stroke-width=".6"/></g><path d="M14 13 C20 5 40 3 52 7 C60 9 63 12 63 13 C63 14 60 17 52 19 C40 23 20 21 14 13 Z" fill="rgba(255,251,242,.92)"/><path d="M30 6 C36 5 42 7 44 11 C40 12 34 11 30 6 Z M22 17 C26 19 32 20 36 18 C32 15 26 15 22 17 Z M50 8 C54 9 57 11 57 12 C53 12 51 10 50 8 Z" fill="#FB923C" fill-opacity=".85"/><g style="transform-origin:38px 18px;animation:tkf-eTail .7s ease-in-out -.3s infinite alternate"><path d="M38 18 C36 23 32 25 28 25 C31 22 33 20 34 18 Z" fill="rgba(255,237,213,.7)"/></g><path d="M36 4 C38 1 42 1 44 4 Z" fill="rgba(255,237,213,.7)"/><circle cx="56" cy="11.4" r="1" fill="#1E293B"/><path d="M62 14 C64 16 64 18 62 20" stroke="rgba(255,237,213,.6)" stroke-width=".6" fill="none"/></svg>';
    if (type === 'koistar') {
      const xs0 = W * rr(.35, .65), ys = H * rr(.2, .3), yb = ys + 170 * k, D2 = rr(11, 13) * (m ? .75 : 1), tc = .55, sxS = P(xs0, ys)[0], a0 = [sxS + dir * 160 * k, -40], a1 = [a0[0] + (sxS - a0[0]) * .002, a0[1] + (ys - a0[1]) * .002];
      fly('<div style="position:absolute;left:-10px;top:1px;width:126px;height:2px;border-radius:2px;background:linear-gradient(90deg,rgba(253,230,138,0),rgba(253,230,138,.6) 50%,#FFF7D6)"></div><span style="position:absolute;right:-6px;top:-4px;width:10px;height:10px;border-radius:50%;background:#FFF7D6;box-shadow:0 0 12px 5px rgba(253,230,138,.9)"></span>', 120, 4, [ln(a0, a1, 0, .3, 1), ln(a1, [sxS, ys], .3, tc, 10)], D2, { tk: 1, opf: t => t < .3 || t > tc - .005 ? 0 : 1 });
      fly('<div data-k="g" style="position:absolute;left:-10px;top:-14px;width:84px;height:54px;border-radius:50%;background:radial-gradient(closest-side,rgba(253,230,138,.6),rgba(253,230,138,0));opacity:0"></div>' + KOI, 64, 26, cr([P(X0, yb + 30, 0), P(xs0 - 260 * k, yb, .3), P(xs0 - 90 * k, yb - 20 * k, .45), P(xs0, ys, tc), P(xs0 + 90 * k, yb - 20 * k, .65), P(xs0 + 260 * k, yb + 10 * k, .8), P(X1, yb + 30, 1)], 8), D2, { flip, tk: 1, sync: [['[data-k="g"]', [{ opacity: 0, offset: 0 }, { opacity: 0, offset: tc }, { opacity: 1, offset: tc + .02 }, { opacity: .6, offset: 1 }]]] });
      fx1('<div style="position:absolute;left:-50px;top:-50px;width:100px;height:100px;border-radius:50%;background:radial-gradient(closest-side,rgba(255,247,214,.9),rgba(253,230,138,.3) 50%,rgba(253,230,138,0))"></div>', sxS, ys, [{ opacity: 0, transform: 'scale(.2)' }, { opacity: 1, transform: 'scale(' + k + ')', offset: .25 }, { opacity: 0, transform: 'scale(' + 1.5 * k + ')' }], 1, tc * D2);
      for (let i = 0; i < 16; i++) { const a = R() * Math.PI * 2, r = rr(30, 90) * k; fx1(dot(rr(2.5, 4), '#FFF3B0', '253,224,71'), sxS, ys, [{ transform: 'translate(0,0)', opacity: 0 }, { transform: 'translate(0,0)', opacity: 1, offset: .05 }, { transform: 'translate(' + (Math.cos(a) * r).toFixed(1) + 'px,' + (Math.sin(a) * r + 30 * k).toFixed(1) + 'px)', opacity: 0 }], rr(1.2, 2), tc * D2); }
      return D2 + 1;
    }
    for (let i = 0; i < n; i++) { const y = H * rr(.15, .6), amp = rr(30, 60) * k; fly(KOI, 64, 26, cr(Array.from({ length: 9 }, (_, j) => P(X0 + (X1 - X0) * j / 8, y + (j % 2 ? amp : -amp) * (j && j < 8 ? 1 : .3), j / 8)), 8), D * rr(.85, 1.1), { flip, tk: 1, delay: i * rr(1.5, 3), k: k * rr(.75, 1.05) }); }
    return D * 1.1 + 6;
  }
  if (type === 'veins') {
    const D = 7, x0 = W * rr(.1, .9);
    for (let v = 0; v < 3; v++) {
      let x = x0 + (v - 1) * rr(18, 40) * k, y = H + 10, d = 'M' + x.toFixed(1) + ' ' + y.toFixed(1); const top = H * rr(.22, .45), br = [];
      while (y > top) { const ny = y - rr(30, 55) * k, nx = x + rr(-14, 14) * k; d += ' Q' + (x + rr(-10, 10) * k).toFixed(1) + ' ' + ((y + ny) / 2).toFixed(1) + ' ' + nx.toFixed(1) + ' ' + ny.toFixed(1); if (R() < .35) { const s = R() < .5 ? -1 : 1, ex = nx + s * rr(16, 34) * k, ey = ny - rr(10, 30) * k; br.push('M' + nx.toFixed(1) + ' ' + ny.toFixed(1) + ' Q' + ((nx + ex) / 2).toFixed(1) + ' ' + (ny - 4).toFixed(1) + ' ' + ex.toFixed(1) + ' ' + ey.toFixed(1)); } x = nx; y = ny; }
      const e = fx1('<svg width="' + W + '" height="' + H + '" style="position:absolute;left:0;top:0;overflow:visible;filter:drop-shadow(0 0 5px rgba(94,242,194,.95))"><path data-v="1" d="' + d + '" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1" fill="none" stroke="#A7FFE4" stroke-width="' + (1.8 * k).toFixed(1) + '" stroke-linecap="round"/>' + br.map(b => '<path data-v="2" d="' + b + '" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1" fill="none" stroke="#5EF2C2" stroke-width="' + (1.2 * k).toFixed(1) + '" stroke-linecap="round"/>').join('') + '</svg>', 0, 0, [{ opacity: 0 }, { opacity: 1, offset: .05 }, { opacity: 1, offset: .65 }, { opacity: 0 }], D, v * .35);
      e.querySelectorAll('[data-v="1"]').forEach(p => p.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 2600, delay: v * 350, easing: 'ease-out', fill: 'both' }));
      e.querySelectorAll('[data-v="2"]').forEach(p => p.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 1200, delay: v * 350 + 1400 + R() * 800, easing: 'ease-out', fill: 'both' }));
    }
    return D + 1;
  }
  if (type === 'ring') {
    const x = W * rr(.15, .85), y = m ? H * rr(.62, .82) : H * rr(.72, .9), D = 8, rx = 70 * k, ry = 18 * k;
    const mush = Array.from({ length: 9 }, (_, i) => { const a = i / 9 * Math.PI * 2; return '<span style="position:absolute;left:' + (Math.cos(a) * rx - 3).toFixed(1) + 'px;top:' + (Math.sin(a) * ry - 6).toFixed(1) + 'px;width:6px;height:6px;border-radius:50% 50% 20% 20%;background:#C8FFEA;box-shadow:0 0 6px 2px rgba(94,242,194,.85)"></span>'; }).join('');
    fx1('<div style="position:absolute;left:' + (-rx) + 'px;top:' + (-ry) + 'px;width:' + (rx * 2) + 'px;height:' + (ry * 2) + 'px;border-radius:50%;border:2px solid rgba(167,255,228,.85);box-shadow:0 0 16px 4px rgba(94,242,194,.55),inset 0 0 14px 2px rgba(94,242,194,.45)"></div>' + mush, x, y, [{ transform: 'scale(.2)', opacity: 0 }, { transform: 'scale(1)', opacity: 1, offset: .12 }, { transform: 'scale(1.04)', opacity: 1, offset: .8 }, { transform: 'scale(1.2)', opacity: 0 }], D);
    fx1('<div style="position:absolute;left:' + (-rx * .8) + 'px;top:' + (-260 * k) + 'px;width:' + (rx * 1.6) + 'px;height:' + (260 * k) + 'px;background:linear-gradient(to top,rgba(167,255,228,.45),rgba(167,255,228,0));-webkit-mask-image:linear-gradient(90deg,transparent,#000 30%,#000 70%,transparent);mask-image:linear-gradient(90deg,transparent,#000 30%,#000 70%,transparent)"></div>', x, y, [{ opacity: 0, transform: 'scaleY(.2)' }, { opacity: 0, transform: 'scaleY(.2)', offset: .12 }, { opacity: 1, transform: 'scaleY(1)', offset: .3 }, { opacity: .8, transform: 'scaleY(1)', offset: .7 }, { opacity: 0, transform: 'scaleY(1.1)' }], D);
    for (let i = 0; i < 14; i++) { const ox = rr(-rx * .7, rx * .7), dy = -rr(90, 230) * k; fx1(dot(rr(2, 4), '#C8FFEA', '94,242,194'), x + ox, y, [{ transform: 'translate(0,0)', opacity: 0, offset: 0 }, { transform: 'translate(0,0)', opacity: 0, offset: .2 }, { transform: 'translate(' + rr(-8, 8).toFixed(1) + 'px,' + (dy * .5).toFixed(1) + 'px)', opacity: 1, offset: .45 }, { transform: 'translate(' + rr(-16, 16).toFixed(1) + 'px,' + dy.toFixed(1) + 'px)', opacity: 0, offset: 1 }], D * rr(.7, .95), R() * .8); }
    return D;
  }
  if (type === 'starfall') {
    const xi = W * rr(.2, .8), yi = H * rr(.22, .4), xs = xi + dir * rr(200, 400) * k, T = 1.3;
    fly('<div style="position:absolute;left:-10px;top:1px;width:126px;height:2px;border-radius:2px;background:linear-gradient(90deg,rgba(167,255,228,0),rgba(200,255,236,.6) 50%,#FFF7D6)"></div><span style="position:absolute;right:-6px;top:-4px;width:10px;height:10px;border-radius:50%;background:#FFF7D6;box-shadow:0 0 12px 5px rgba(253,230,138,.9)"></span>', 120, 4, [ln([xs, -40], [xi, yi], 0, 1, 10)], T, { tk: 1, opf: t => t < .96 ? Math.min(1, t / .1) : 0 });
    fx1('<div style="position:absolute;left:-60px;top:-60px;width:120px;height:120px;border-radius:50%;background:radial-gradient(closest-side,rgba(255,247,214,.9),rgba(210,255,120,.35) 45%,rgba(210,255,120,0))"></div>', xi, yi, [{ opacity: 0, transform: 'scale(.2)' }, { opacity: 1, transform: 'scale(' + k + ')', offset: .2 }, { opacity: 0, transform: 'scale(' + 1.6 * k + ')' }], 1.2, T * .95);
    for (let i = 0; i < (m ? 20 : 32); i++) { const a = R() * Math.PI * 2, r = rr(40, 170) * k, dx = Math.cos(a) * r, dy = Math.sin(a) * r * .7, mint = i % 4 === 0; fx1(dot(rr(3, 5), mint ? '#C8FFEA' : '#F2FFB8', mint ? '94,242,194' : '210,255,120'), xi, yi, [{ transform: 'translate(0,0)', opacity: 0, offset: 0 }, { transform: 'translate(' + (dx * .6).toFixed(1) + 'px,' + (dy * .6).toFixed(1) + 'px)', opacity: 1, offset: .15 }, { opacity: .35, offset: .35 }, { opacity: 1, offset: .55 }, { opacity: .4, offset: .75 }, { transform: 'translate(' + dx.toFixed(1) + 'px,' + (dy + 50 * k).toFixed(1) + 'px)', opacity: 0, offset: 1 }], rr(4, 6), T); }
    return T + 6;
  }
  if (type === 'spirit' || type === 'spiritbow') {
    const D = rr(34, 42) * sp, kz = m ? .45 : .95, y = (m ? H - 8 : H) - 150 * kz + 10;
    const leg = (i, o, d, c, w) => '<g data-leg="' + i + '" style="transform-origin:' + o + '"><path d="' + d + '" stroke="' + c + '" stroke-width="' + w + '" stroke-linecap="round" fill="none"/></g>';
    const SPA = '<svg width="260" height="300" viewBox="0 0 260 300" style="position:absolute;inset:0;overflow:visible;filter:blur(1.2px) drop-shadow(0 0 16px rgba(94,242,194,.25))">' + leg(1, '80px 170px', 'M80 170 L76 240 L74 300', '#08130F', 12) + leg(2, '170px 170px', 'M170 170 L174 240 L172 300', '#08130F', 12) + '<path d="M196 70 C190 40 176 22 150 10 M184 44 C172 40 164 30 162 16 M196 70 C204 40 220 22 246 12 M210 44 C222 38 230 28 232 14 M190 56 C180 56 172 52 168 46 M204 54 C214 54 222 50 226 44" stroke="#0B1A15" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M60 130 C60 104 90 96 130 98 C160 100 176 94 186 84 L192 74 C196 68 206 68 208 76 C210 84 206 90 200 96 C192 108 190 140 180 162 C164 182 98 184 78 176 C62 170 58 150 60 130 Z" fill="#0B1A15" stroke="rgba(94,242,194,.22)" stroke-width="1.5"/><path d="M190 80 C192 64 208 60 218 68 C226 74 230 82 226 88 C218 90 208 88 200 92 Z" fill="#0B1A15"/><circle cx="212" cy="74" r="2.8" fill="#5EF2C2" style="animation:tkf-twinkle 2.4s infinite"/><circle cx="150" cy="10" r="2.6" fill="#C9B8F5" style="animation:tkf-twinkle 1.8s infinite"/><circle cx="246" cy="12" r="2.6" fill="#C9B8F5" style="animation:tkf-twinkle 2.1s -.6s infinite"/><circle cx="162" cy="16" r="2" fill="#5EF2C2" style="animation:tkf-twinkle 1.6s -.3s infinite"/><circle cx="232" cy="14" r="2" fill="#5EF2C2" style="animation:tkf-twinkle 2.3s -1s infinite"/>' + leg(0, '92px 172px', 'M92 172 L96 240 L94 300', '#0B1A15', 13) + leg(3, '182px 168px', 'M182 168 L188 238 L188 300', '#0B1A15', 13) + '</svg>';
    if (type === 'spiritbow') {
      const D3 = rr(30, 36) * sp, cx = W * rr(.42, .58), yl = y - 150 * kz - 10 * k, n = m ? 4 : 6, gap = rr(.8, 1.1), DL = D3 * .5, LANT = '<div style="position:absolute;left:-10px;top:-8px;width:34px;height:38px;border-radius:50%;background:radial-gradient(closest-side,rgba(253,224,130,.5),rgba(253,224,130,0));animation:tkf-twinkleB 1.6s ease-in-out infinite"></div><span style="position:absolute;left:6.5px;top:-6px;width:1px;height:7px;background:rgba(227,194,122,.8)"></span><span style="position:absolute;left:2px;top:1px;width:10px;height:2px;border-radius:1px;background:#8A6416"></span><span style="position:absolute;left:1px;top:3px;width:12px;height:14px;border-radius:40%;background:radial-gradient(60% 60% at 50% 55%,#FFF7D6,#FCD34D 55%,#F59E0B);box-shadow:0 0 10px 3px rgba(252,211,77,.55)"></span><span style="position:absolute;left:2px;top:17px;width:10px;height:2px;border-radius:1px;background:#8A6416"></span><span style="position:absolute;left:6.5px;top:19px;width:1px;height:4px;background:rgba(227,194,122,.8)"></span>', TO = '50% 100%';
      fly(SPA, 260, 300, [ln(P(-200 * kz - 60, y), P(cx, y), 0, .35, 4), hold(P(cx, y), .35, .7), ln(P(cx, y), P(W + 200 * kz + 60, y), .7, 1, 4)], D3, { flip, k: kz, opf: t => .6 * Math.min(1, t / .1, (1 - t) / .1), on: (el, ms, dl) => walk(el, ms, dl, .35, .7, 1300, 9), sync: [['svg', [{ transform: 'rotate(0deg)', transformOrigin: TO, offset: 0 }, { transform: 'rotate(0deg)', transformOrigin: TO, offset: .46 }, { transform: 'rotate(9deg)', transformOrigin: TO, offset: .52 }, { transform: 'rotate(9deg)', transformOrigin: TO, offset: .6 }, { transform: 'rotate(0deg)', transformOrigin: TO, offset: .66 }, { transform: 'rotate(0deg)', transformOrigin: TO, offset: 1 }]]] });
      const lp = cr([P(X1 + 60, yl + 40, 0), P(cx + 160 * k, yl - 10 * k, .35), P(cx, yl - 60 * k, .5), P(cx - 160 * k, yl - 10 * k, .65), P(X0 - 60, yl + 30, 1)], 10);
      for (let i = 0; i < n; i++) fly(LANT, 14, 22, lp, DL, { delay: D3 * .3 + i * gap, inner: '--by:' + rr(3, 6).toFixed(1) + 'px;animation:tkf-eBob ' + rr(1.6, 2.4).toFixed(2) + 's ease-in-out ' + (-R() * 2).toFixed(2) + 's infinite alternate' });
      return D3;
    }
    fly(SPA, 260, 300, [ln(P(-200 * kz - 60, y), P(W + 200 * kz + 60, y), 0, 1, 4)], D, { flip, k: kz, opf: t => .55 * Math.min(1, t / .12, (1 - t) / .12), on: (el, ms, dl) => walk(el, ms, dl, null, null, 1300, 9) });
    return D;
  }
  if (type === 'whale' || type === 'whaleeat') {
    const y = H * rr(.16, .3), D = rr(36, 44) * sp, kw = k * (m ? .9 : 1.1);
    const sp2 = [[60, 30], [80, 25], [100, 22], [120, 21], [140, 22], [160, 26], [178, 32]].map(([x, y2], i) => '<circle cx="' + x + '" cy="' + y2 + '" r="1.8" fill="#C8FFEA" style="animation:tkf-twinkle ' + (1.6 + i * .2).toFixed(1) + 's ' + (-i * .3).toFixed(1) + 's infinite"/>').join('');
    const WH = '<svg width="220" height="90" viewBox="0 0 220 90" style="position:absolute;inset:0;overflow:visible;filter:drop-shadow(0 0 14px rgba(94,242,194,.45))"><g style="transform-origin:24px 50px;animation:tkf-eTail 2.6s ease-in-out infinite alternate"><path d="M26 50 C16 44 8 38 -8 28 C-2 38 0 45 3 50 C0 55 -2 62 -8 72 C8 62 16 56 26 50 Z" fill="rgba(36,74,92,.6)" stroke="rgba(167,255,228,.65)" stroke-width="1"/></g><path d="M20 50 C30 26 80 14 130 18 C170 21 200 34 214 47 C218 51 216 57 210 60 C190 70 150 78 110 76 C70 74 34 68 20 50 Z" fill="rgba(36,74,92,.62)" stroke="rgba(167,255,228,.7)" stroke-width="1.2"/><path d="M96 70 C130 72 172 66 204 56 M100 64 C134 66 170 60 198 51" stroke="rgba(167,255,228,.35)" stroke-width="1" fill="none"/><g style="transform-origin:134px 62px;animation:tkf-eTail 3.2s ease-in-out -.8s infinite alternate"><path d="M134 62 C132 76 124 86 110 90 C116 80 120 70 122 62 Z" fill="rgba(36,74,92,.7)" stroke="rgba(167,255,228,.55)" stroke-width="1"/></g><circle cx="192" cy="44" r="2.6" fill="#A7FFE4"/>' + sp2 + '</svg>';
    const segs = cr(Array.from({ length: 7 }, (_, j) => P(-260 * kw + (W + 520 * kw) * j / 6, y + Math.sin(j * 1.3) * 26 * k, j / 6)), 10);
    fly(WH, 220, 90, segs, D, { flip, tk: .25, k: kw, opf: t => .88 * Math.min(1, t / .08, (1 - t) / .08) });
    if (type === 'whaleeat') {
      const LANT = '<div style="position:absolute;left:-10px;top:-8px;width:34px;height:38px;border-radius:50%;background:radial-gradient(closest-side,rgba(253,224,130,.5),rgba(253,224,130,0));animation:tkf-twinkleB 1.6s ease-in-out infinite"></div><span style="position:absolute;left:6.5px;top:-6px;width:1px;height:7px;background:rgba(227,194,122,.8)"></span><span style="position:absolute;left:2px;top:1px;width:10px;height:2px;border-radius:1px;background:#8A6416"></span><span style="position:absolute;left:1px;top:3px;width:12px;height:14px;border-radius:40%;background:radial-gradient(60% 60% at 50% 55%,#FFF7D6,#FCD34D 55%,#F59E0B);box-shadow:0 0 10px 3px rgba(252,211,77,.55)"></span><span style="position:absolute;left:2px;top:17px;width:10px;height:2px;border-radius:1px;background:#8A6416"></span><span style="position:absolute;left:6.5px;top:19px;width:1px;height:4px;background:rgba(227,194,122,.8)"></span>', mo = (flip ? -1 : 1) * 95 * kw, tE = .42, tB = .6, n = m ? 4 : 6, [ex, ey] = at(segs, tE), lx = ex + mo, [bx, by] = at(segs, tB);
      for (let i = 0; i < n; i++) { const ox = rr(-34, 34) * k, oy = rr(-22, 22) * k; fx1(LANT, lx + ox, ey + oy - 10 * k, [{ opacity: 0, transform: 'scale(1)', offset: 0 }, { opacity: 1, transform: 'scale(1)', offset: .06 }, { opacity: 1, transform: 'scale(1)', offset: tE - .01 }, { opacity: 0, transform: 'scale(.2)', offset: tE + .015 }, { opacity: 0, transform: 'scale(.2)', offset: 1 }], D); }
      for (let i = 0; i < n; i++) { const dx = mo * .25 + rr(-70, 70) * k, dy = -rr(50, 140) * k; fx1(LANT, bx + mo, by - 8 * k, [{ opacity: 0, transform: 'translate(0,0) scale(.3)', offset: 0 }, { opacity: 0, transform: 'translate(0,0) scale(.3)', offset: tB }, { opacity: 1, transform: 'translate(' + (dx * .2).toFixed(1) + 'px,' + (dy * .2).toFixed(1) + 'px) scale(1)', offset: tB + .025 }, { opacity: 1, transform: 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px) scale(1)', offset: .92 }, { opacity: 0, transform: 'translate(' + dx.toFixed(1) + 'px,' + (dy - 20).toFixed(1) + 'px) scale(1)', offset: 1 }], D); }
      bub('Ợ~', bx + mo, by - 34 * k, tB - .005, tB + .1, D);
      return D;
    }
    const tb = rr(.4, .6), [bx, by] = at(segs, tb), bxo = bx + (flip ? -1 : 1) * 50 * kw, byo = by - 26 * kw;
    for (let i = 0; i < (m ? 12 : 20); i++) fx1(dot(rr(2, 3.6), '#C8FFEA', '94,242,194'), bxo, byo, [{ transform: 'translate(0,0)', opacity: 0 }, { transform: 'translate(' + (rr(-30, 30) * k).toFixed(1) + 'px,' + (-rr(40, 90) * k).toFixed(1) + 'px)', opacity: 1, offset: .4 }, { transform: 'translate(' + (rr(-60, 60) * k).toFixed(1) + 'px,' + (-rr(10, 40) * k).toFixed(1) + 'px)', opacity: 0 }], rr(2, 3), tb * D + R() * .4);
    return D;
  }
  const n = m ? 3 : 5, D = 8;
  for (let i = 0; i < n; i++) {
    const x = R() < .5 ? W * rr(.01, .1) : W * rr(.9, .99), y = H * rr(.15, .75), c = R() < .5 ? '201,184,245' : '244,171,226', s = k * rr(.8, 1.2), rot = rr(-30, 30);
    const pet = [0, 60, 120, 180, 240, 300].map(a => '<ellipse cx="0" cy="-7" rx="4" ry="7.5" fill="rgba(' + c + ',.85)" stroke="rgba(255,255,255,.7)" stroke-width=".6" transform="rotate(' + a + ')"/>').join('');
    fx1('<svg width="30" height="30" viewBox="-15 -15 30 30" style="position:absolute;left:-15px;top:-15px;overflow:visible;filter:drop-shadow(0 0 6px rgba(' + c + ',.95))">' + pet + '<circle r="3" fill="#FDE68A"/></svg>', x, y, [{ transform: 'rotate(' + rot + 'deg) scale(0)', opacity: 0 }, { transform: 'rotate(' + (rot + 20) + 'deg) scale(' + s.toFixed(2) + ')', opacity: 1, offset: .25 }, { transform: 'rotate(' + (rot + 30) + 'deg) scale(' + (s * 1.05).toFixed(2) + ')', opacity: 1, offset: .7 }, { transform: 'rotate(' + (rot + 40) + 'deg) scale(0)', opacity: 0 }], D, i * rr(.4, .9));
  }
  return D + 4;
}

function initClk(s, host) {
  if (!host || !host.isConnected || host._clkInit) return; host._clkInit = 1; host._clk = [];
  const m = s.length > 1, night = s[0] === 'a', k = m ? .72 : 1, FW = m ? 390 : 1440;
  // Nấm mọc sát mép dưới trang, x theo tỉ lệ bề ngang mockup. Đặt bằng % (không chốt px lúc mở trang) để vẫn đúng
  // chỗ khi trang đổi cỡ — mobile: thanh địa chỉ ẩn/hiện làm trang cao/thấp đi; vùng bấm tính lại ở bgClick.
  (m ? [130, 252] : [100, 560, 1010]).forEach(x => { const fx = x / FW, e = document.createElement('div'); e.style.cssText = 'position:absolute;left:calc(' + (fx * 100).toFixed(3) + '% - ' + 10 * k + 'px);top:calc(100% - ' + 22 * k + 'px);width:' + 20 * k + 'px;height:' + 22 * k + 'px;transform-origin:50% 100%;pointer-events:none'; e.innerHTML = EA.MUSH(night); host.appendChild(e); host._clk.push({ kind: 'mush', el: e, fx, x: 0, y: 0 }); });
  for (let i = 0; i < 3; i++) addFF(s, host);
}

function addFF(s, host) {
  if (!host || !host.isConnected) return;
  const m = s.length > 1, night = s[0] === 'a', { rr } = flyKit(host, m), c = night ? ['#F2FFB8', '210,255,120'] : ['#FFF3B0', '250,204,21'], e = document.createElement('div');
  e.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;pointer-events:none';
  e.innerHTML = '<span style="position:absolute;left:-12px;top:-12px;width:24px;height:24px;border-radius:50%;background:radial-gradient(closest-side,rgba(' + c[1] + ',.5),rgba(' + c[1] + ',0))"></span><span style="position:absolute;left:-2.5px;top:-2.5px;width:5px;height:5px;border-radius:50%;background:' + c[0] + ';box-shadow:0 0 6px 2px rgba(' + c[1] + ',.9)"></span>';
  // Lượn theo % của lớp nền (không chốt px) → vẫn trong vùng đúng khi trang đổi cỡ (thanh địa chỉ mobile, xoay máy)
  const pts = Array.from({ length: 6 }, () => [rr(.08, .92) * 100, rr(.22, .82) * 100]);
  host.appendChild(e);
  e._an = e.animate(pts.map(p => ({ left: p[0].toFixed(2) + '%', top: p[1].toFixed(2) + '%', easing: 'ease-in-out' })), { duration: rr(26, 38) * 1000, iterations: Infinity, direction: 'alternate' });
  e.firstChild.animate([{ opacity: .35 }, { opacity: 1 }], { duration: rr(1200, 2000), iterations: Infinity, direction: 'alternate' });
  (host._clk = host._clk || []).push({ kind: 'ff', el: e });
}

function isUI(t, fr) {
  for (let n = t; n && n !== fr; n = n.parentElement) {
    if (n.nodeType !== 1) continue;
    if (/^(INPUT|TEXTAREA|SELECT|BUTTON|A|LABEL)$/.test(n.tagName) || n.isContentEditable || n.getAttribute('draggable') === 'true' || (n.dataset && n.dataset.peek)) return true;
    const pk = Object.keys(n).find(x => x.startsWith('__reactProps')), p = pk && n[pk];
    if (p && (p.onClick || p.onMouseDown || p.onPointerDown || p.onDoubleClick)) return true;
    if (n.style && n.style.cursor === 'pointer') return true;
  }
  return false;
}

function bgClick(e) {
  const fr = e.target && e.target.closest && e.target.closest('[data-frame]'); if (!fr || !hosts || !(motionOK())) return;
  const s = fr.dataset.frame, host = hosts[s], top = hosts[s + '_t']; if (!host || !top || !host.isConnected || !fr.contains(host)) return;
  if (natureClick(e)) return;
  if (isUI(e.target, fr)) return;
  const r = fr.getBoundingClientRect(); if (!r.width) return;
  const sc = fr.offsetWidth / r.width, x = (e.clientX - r.left) * sc, y = (e.clientY - r.top) * sc, k = s.length > 1 ? .72 : 1;
  let best = null, bd = 36 * k;
  (host._clk || []).forEach(c => { if (c.kind === 'mush') { c.x = c.fx * host.clientWidth; c.y = host.clientHeight - 10 * k; } let cx = c.x, cy = c.y; if (c.kind === 'ff') { const b = c.el.getBoundingClientRect(); cx = (b.left - r.left) * sc; cy = (b.top - r.top) * sc; } const d = Math.hypot(cx - x, cy - y); if (d < bd) { bd = d; best = c; } });
  if (best && best.kind === 'mush') return mushPop(s, best);
  if (best && best.kind === 'ff') return ffFollow(s, fr, host, top, best);
  if (y > host.clientHeight * 0.72) return waterSplash(top, x, y, k);
  treeShake(s, top, x, y);
}

function waterSplash(top, x, y, k = 1) {
  const { fx1, dot } = flyKit(top, false);
  const D = 1.4;
  fx1('<span style="position:absolute;left:-24px;top:-8px;width:48px;height:16px;box-sizing:border-box;border-radius:50%;border:1.5px solid rgba(167,255,228,.85);box-shadow:0 0 10px rgba(94,242,194,.7)"></span>', x, y, [
    { transform: 'scale(0.2)', opacity: 0 },
    { transform: 'scale(0.8)', opacity: 1, offset: 0.2 },
    { transform: 'scale(1.8)', opacity: 0, offset: 1 }
  ], D);
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI * (0.2 + (i / 7) * 0.6);
    const r = 24 * k;
    fx1(dot(2.4, '#C8FFEA', '94,242,194'), x, y, [
      { transform: 'translate(0,0) scale(1)', opacity: 1 },
      { transform: 'translate(' + (Math.cos(a) * r).toFixed(1) + 'px,' + (Math.sin(a) * r - 12).toFixed(1) + 'px) scale(0)', opacity: 0 }
    ], 0.7);
  }
  const KOI_MINI = '<svg width="34" height="18" viewBox="0 0 34 18" style="position:absolute;left:-17px;top:-9px;overflow:visible;filter:drop-shadow(0 0 6px rgba(94,242,194,.8))"><path d="M2 9 C8 3 24 2 32 9 C24 16 8 15 2 9 Z" fill="#FB923C"/><path d="M12 4 Q16 2 20 5 Z M10 13 Q14 16 18 13 Z" fill="#FDBA74"/><circle cx="28" cy="8" r="1" fill="#1E293B"/></svg>';
  fx1(KOI_MINI, x, y, [
    { transform: 'translate(0, 4px) rotate(-35deg) scale(0.6)', opacity: 0 },
    { transform: 'translate(0, -28px) rotate(0deg) scale(1)', opacity: 1, offset: 0.45 },
    { transform: 'translate(0, 8px) rotate(35deg) scale(0.8)', opacity: 0, offset: 0.95 },
    { transform: 'translate(0, 8px) scale(0)', opacity: 0, offset: 1 }
  ], 0.9);
  fx1('<div style="position:absolute;left:14px;top:-36px;padding:2px 7px;border-radius:8px;background:rgba(8,21,15,.92);border:1px solid rgba(94,242,194,.4);color:#5EF2C2;font:700 10px/1 \'Be Vietnam Pro\',sans-serif;white-space:nowrap">Tõm! 🐟</div>', x, y, [
    { opacity: 0, transform: 'translateY(4px)' },
    { opacity: 1, transform: 'translateY(0)', offset: 0.2 },
    { opacity: 1, transform: 'translateY(0)', offset: 0.7 },
    { opacity: 0, transform: 'translateY(-6px)' }
  ], 1.1);
}

function handleMoonClick(moonEl) {
  if (!moonEl || moonEl._bunnyActive) return;
  moonEl._bunnyActive = true;
  const bunny = document.createElement('div');
  bunny.style.cssText = 'position:absolute;right:-10px;top:-18px;width:32px;height:36px;pointer-events:none;z-index:20;transform-origin:50% 100%';
  const messages = [
    'Chào bạn! Chúc bạn buổi tối tốt lành 🐰✨',
    'Còn thức chăm chỉ thế! Nghỉ sớm nha 🌙',
    'Cố lên nha, bạn đang làm rất tốt! 🌟',
    'Thỏ ngọc chúc bạn ngủ ngon~ 🥕'
  ];
  const msg = messages[Math.floor(Math.random() * messages.length)];
  bunny.innerHTML = EA.BUNNY + '<div style="position:absolute;left:34px;top:-10px;padding:4px 9px;border-radius:10px 10px 10px 2px;background:rgba(24,28,58,.94);border:1px solid rgba(249,168,212,.45);color:#FFF1F7;font:700 11px/1.2 \'Be Vietnam Pro\',sans-serif;white-space:nowrap;box-shadow:0 4px 12px rgba(0,0,0,.3)">' + msg + '</div>';
  moonEl.appendChild(bunny);
  bunny.animate([
    { transform: 'translateY(24px) scale(0.4)', opacity: 0 },
    { transform: 'translateY(0) scale(1)', opacity: 1, offset: 0.15 },
    { transform: 'translateY(0) scale(1)', opacity: 1, offset: 0.82 },
    { transform: 'translateY(24px) scale(0.4)', opacity: 0, offset: 1 }
  ], { duration: 4000, easing: 'cubic-bezier(.25,.8,.25,1)', fill: 'both' }).onfinish = () => {
    bunny.remove();
    moonEl._bunnyActive = false;
  };
}

function mushPop(s, c) {
  const top = hosts[s + '_t'], m = s.length > 1, night = s[0] === 'a', { k, rr, fx1, dot } = flyKit(top, m), G = night ? ['#C8FFEA', '94,242,194'] : ['#FFF3B0', '253,224,71'];
  c.el.animate([{ transform: 'scale(1,1)' }, { transform: 'scale(1.3,.7)', offset: .2 }, { transform: 'scale(.85,1.3)', offset: .45 }, { transform: 'scale(1.08,.94)', offset: .7 }, { transform: 'scale(1,1)' }], { duration: 650, easing: 'ease-out' });
  for (let i = 0; i < 14; i++) { const dx = rr(-40, 40) * k, dy = -rr(50, 140) * k; fx1(dot(rr(2, 4), G[0], G[1]), c.x, c.y - 8 * k, [{ transform: 'translate(0,0)', opacity: 0 }, { transform: 'translate(' + (dx * .4).toFixed(1) + 'px,' + (dy * .5).toFixed(1) + 'px)', opacity: 1, offset: .3 }, { transform: 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px)', opacity: 0 }], rr(1.2, 2), .12); }
  fx1('<div style="position:absolute;left:-30px;top:-46px;width:60px;text-align:center;font:800 12px/1 \'Be Vietnam Pro\',sans-serif;color:' + (night ? '#E8FFF4' : '#7C3A10') + ';text-shadow:0 0 6px ' + (night ? 'rgba(94,242,194,.9)' : 'rgba(255,255,255,.95)') + '">boing!</div>', c.x, c.y, [{ opacity: 0, transform: 'translateY(6px) scale(.6)' }, { opacity: 1, transform: 'translateY(0) scale(1)', offset: .2 }, { opacity: 1, transform: 'translateY(-4px) scale(1)', offset: .7 }, { opacity: 0, transform: 'translateY(-10px) scale(1)' }], 1.1);
}

function ffFollow(s, fr, host, top, c) {
  const r = fr.getBoundingClientRect(), sc = fr.offsetWidth / r.width, b = c.el.getBoundingClientRect();
  let px = (b.left - r.left) * sc, py = (b.top - r.top) * sc, tx = px, ty = py;
  if (c.el._an) c.el._an.cancel();
  host._clk = host._clk.filter(z => z !== c); top.appendChild(c.el);
  c.el.style.transform = 'translate(' + px.toFixed(1) + 'px,' + py.toFixed(1) + 'px)'; c.el.firstChild.style.transform = 'scale(1.6)';
  const { k, fx1, dot } = flyKit(top, s.length > 1), G = s[0] === 'a' ? ['#F2FFB8', '210,255,120'] : ['#FFF3B0', '250,204,21'];
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; fx1(dot(2.5, G[0], G[1]), px, py, [{ transform: 'translate(0,0)', opacity: 1 }, { transform: 'translate(' + (Math.cos(a) * 26 * k).toFixed(1) + 'px,' + (Math.sin(a) * 26 * k).toFixed(1) + 'px)', opacity: 0 }], .7); }
  const mv = e => { const r2 = fr.getBoundingClientRect(); if (!r2.width) return; const s2 = fr.offsetWidth / r2.width; tx = (e.clientX - r2.left) * s2 + 16; ty = (e.clientY - r2.top) * s2 - 16; };
  window.addEventListener('pointermove', mv, { passive: true });
  const t0 = performance.now(), step = () => {
    if (!c.el.isConnected) return window.removeEventListener('pointermove', mv);
    const t = performance.now() - t0;
    if (t > 6000) { window.removeEventListener('pointermove', mv); c.el.animate([{ transform: c.el.style.transform, opacity: 1 }, { transform: 'translate(' + (px + 80).toFixed(0) + 'px,' + (py - 260).toFixed(0) + 'px)', opacity: 0 }], { duration: 1600, easing: 'ease-in', fill: 'forwards' }).onfinish = () => c.el.remove(); setTimeout(() => addFF(s, host), 7000); return; }
    px += (tx - px) * .08 + Math.sin(t / 260) * .6; py += (ty - py) * .08 + Math.cos(t / 310) * .6;
    c.el.style.transform = 'translate(' + px.toFixed(1) + 'px,' + py.toFixed(1) + 'px)'; requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function treeShake(s, top, x, y) {
  const m = s.length > 1, night = s[0] === 'a', { W, k, R, rr, cr, fly, fx1 } = flyKit(top, m);
  const LC = night ? ['#2E9E74', '#3FBF8F', '#7DE8C4'] : ['#6FA86A', '#A3C76D', '#E3B04B'], gl = night ? 'filter:drop-shadow(0 0 3px rgba(94,242,194,.8))' : '';
  for (let i = 0; i < (m ? 6 : 9); i++) {
    const x0 = x + rr(-70, 70) * k, y0 = Math.max(-10, y - rr(140, 240) * k), dx = rr(-50, 50) * k, dy = rr(220, 340) * k, rot = rr(-200, 200);
    fx1('<svg width="12" height="9" viewBox="0 0 12 9" style="position:absolute;left:-6px;top:-4.5px;overflow:visible;' + gl + '"><path d="M1 4.5 C3 0 9 0 11 4.5 C9 9 3 9 1 4.5 Z" fill="' + LC[i % 3] + '"/><path d="M1 4.5 H11" stroke="rgba(0,0,0,.2)" stroke-width=".6"/></svg>', x0, y0, [{ transform: 'translate(0,0) rotate(0deg)', opacity: 0 }, { transform: 'translate(' + (dx * .3).toFixed(1) + 'px,' + (dy * .2).toFixed(1) + 'px) rotate(' + (rot * .3).toFixed(0) + 'deg)', opacity: 1, offset: .15 }, { transform: 'translate(' + (-dx * .2).toFixed(1) + 'px,' + (dy * .6).toFixed(1) + 'px) rotate(' + (rot * .7).toFixed(0) + 'deg)', opacity: 1, offset: .6 }, { transform: 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px) rotate(' + rot.toFixed(0) + 'deg)', opacity: 0 }], rr(2.4, 3.6), R() * .3);
  }
  const sg = x < W / 2 ? 1 : -1, bx = x, by = Math.max(20, y - 150 * k);
  fly(night ? EA.MOTH : EA.BIRD, 22, 16, cr([[bx, by, 0], [bx + sg * 60 * k, by - 50 * k, .3], [bx + sg * 200 * k, by - 160 * k, .7], [bx + sg * 360 * k, -60, 1]], 8), 2.2, { flip: sg < 0, tk: .4, opf: t => Math.min(1, t / .06) });
}

// allDone: mọi việc tới hạn hôm nay đã xong → bắn thêm cảnh ăn mừng lớn (React tính, truyền vào)
function celebrate(s, allDone) {
  const host = hosts && hosts[s + '_t']; if (!host || !host.isConnected || !(motionOK())) return;
  const m = s.length > 1, night = s[0] === 'a', { W, H, k, rr, cr, at, fly, fx1, dot } = flyKit(host, m);
  let x = W * .6, y = H * .5; const fr = host.closest('[data-frame]'), lp = lastPointer;
  if (fr && lp && Date.now() - lp.t < 2500) { const r = fr.getBoundingClientRect(); if (r.width) { x = (lp.x - r.left) * W / r.width; y = (lp.y - r.top) * H / r.height; } }
  const G = night ? ['#C8FFEA', '94,242,194'] : ['#FFF3B0', '253,224,71'], sx = x < W / 2 ? 1 : -1, D = 3.4;
  const segs = cr([[x, y, 0], [x + 26 * k, y - 34 * k, .14], [x, y - 70 * k, .28], [x - 30 * k, y - 40 * k, .42], [x, y - 22 * k, .52], [x + sx * 60 * k, y - 110 * k, .72], [x + sx * 180 * k, y - 240 * k, .88], [x + sx * 300 * k, -80, 1]], 8);
  fly('<div style="position:absolute;left:-14px;top:-14px;width:52px;height:52px;border-radius:50%;background:radial-gradient(closest-side,rgba(' + G[1] + ',.55),rgba(' + G[1] + ',0))"></div><svg width="24" height="24" viewBox="0 0 24 24" style="position:absolute;inset:0;overflow:visible"><g style="transform-origin:12px 12px;animation:tkf-flap .12s ease-in-out infinite alternate"><path d="M12 12 C6 2 0 4 2 10 C3 13 8 13 12 12 Z M12 12 C18 2 24 4 22 10 C21 13 16 13 12 12 Z" fill="rgba(255,255,255,.6)" stroke="rgba(255,255,255,.95)" stroke-width=".5"/></g><circle cx="12" cy="13" r="4.6" fill="#FFFBEB" style="filter:drop-shadow(0 0 6px rgba(' + G[1] + ',1))"/></svg>', 24, 24, segs, D, { k: k * 1.2, opf: t => Math.min(1, t / .04, (1 - t) / .08) });
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; fx1(dot(rr(2.5, 4), G[0], G[1]), x, y, [{ transform: 'translate(0,0)', opacity: 1 }, { transform: 'translate(' + (Math.cos(a) * 44 * k).toFixed(1) + 'px,' + (Math.sin(a) * 44 * k).toFixed(1) + 'px)', opacity: 0 }], .9); }
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + (R() - 0.5) * 0.4, bDist = rr(60, 110) * k, bDur = rr(1.6, 2.4);
    const bHue = night ? ['#A7F3D0', '#FDE047', '#C4B5FD', '#F9A8D4'][i] : ['#86EFAC', '#FDE047', '#FDA4AF', '#93C5FD'][i];
    const bSvg = '<svg width="14" height="14" viewBox="0 0 14 14" style="overflow:visible;' + (night ? 'filter:drop-shadow(0 0 4px ' + bHue + ')' : '') + '"><g style="transform-origin:7px 7px;animation:tkf-flap .15s ease-in-out infinite alternate"><path d="M7 7 C3 1 0 3 2 8 C3 10 6 9 7 7 Z M7 7 C11 1 14 3 12 8 C11 10 8 9 7 7 Z" fill="' + bHue + '" opacity="0.88"/></g><ellipse cx="7" cy="7.5" rx="0.8" ry="2.2" fill="#334155"/></svg>';
    fx1(bSvg, x, y, [{ transform: 'translate(0,0) scale(0.6)', opacity: 1 }, { transform: 'translate(' + (Math.cos(a) * bDist * 0.5).toFixed(1) + 'px,' + (Math.sin(a) * bDist * 0.5 - 20 * k).toFixed(1) + 'px) scale(1)', opacity: 0.95, offset: 0.4 }, { transform: 'translate(' + (Math.cos(a) * bDist).toFixed(1) + 'px,' + (Math.sin(a) * bDist - 60 * k).toFixed(1) + 'px) scale(0.9)', opacity: 0, offset: 1 }], bDur, R() * 0.15);
  }
  for (let t = .05; t < .9; t += .045) { const [px, py] = at(segs, t), t2 = Math.min(1, t + .35); fx1(dot(rr(2, 3.6), G[0], G[1]), px, py, [{ transform: 'translate(0,0)', opacity: 0, offset: 0 }, { transform: 'translate(0,0)', opacity: 0, offset: t * .99 }, { transform: 'translate(0,0)', opacity: 1, offset: t }, { transform: 'translate(' + rr(-14, 14).toFixed(1) + 'px,' + (rr(30, 70) * k).toFixed(1) + 'px)', opacity: 0, offset: t2 }, ...(t2 < 1 ? [{ transform: 'translate(0,0)', opacity: 0, offset: 1 }] : [])], D + 1); }
  if (allDone) setTimeout(() => bigCelebrate(s), 900);
}

function bigCelebrate(s) {
  if (s[0] === 'a' && hosts[s] && motionOK()) runNature('aurora', hosts[s], s.length > 1, { boost: true, D: 11 });
  const host = hosts && hosts[s + '_t']; if (!host || !host.isConnected) return;
  const m = s.length > 1, night = s[0] === 'a', { W, H, k, rr, fx1 } = flyKit(host, m), D = 7, cx = W / 2, S = m ? 6.5 : 10, cy = H * .38, n = m ? 36 : 54;
  fx1('<div style="position:absolute;left:0;top:0;width:' + W + 'px;height:' + H + 'px;background:radial-gradient(60% 55% at 50% 45%,' + (night ? 'rgba(94,242,194,.28)' : 'rgba(255,246,214,.6)') + ',rgba(255,246,214,0) 75%)"></div>', 0, 0, [{ opacity: 0 }, { opacity: 1, offset: .15 }, { opacity: 1, offset: .7 }, { opacity: 0 }], D);
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2, hx = 16 * Math.pow(Math.sin(a), 3) * S, hy = -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) * S, sx = rr(0, W) - cx, sy = H * rr(.75, 1.05) - cy, sz = rr(3.5, 6) * (m ? .8 : 1);
    fx1('<span style="position:absolute;left:' + (-sz / 2).toFixed(1) + 'px;top:' + (-sz / 2).toFixed(1) + 'px;width:' + sz.toFixed(1) + 'px;height:' + sz.toFixed(1) + 'px;border-radius:50%;background:#F2FFB8;box-shadow:0 0 8px 3px rgba(210,255,120,.9),0 0 22px 7px rgba(210,255,120,.35)"></span>', cx, cy, [{ transform: 'translate(' + sx.toFixed(1) + 'px,' + sy.toFixed(1) + 'px)', opacity: 0, offset: 0, easing: 'cubic-bezier(.25,.8,.3,1)' }, { transform: 'translate(' + hx.toFixed(1) + 'px,' + hy.toFixed(1) + 'px)', opacity: 1, offset: .42 }, { transform: 'translate(' + (hx * 1.03).toFixed(1) + 'px,' + (hy * 1.03).toFixed(1) + 'px)', opacity: .9, offset: .72 }, { transform: 'translate(' + hx.toFixed(1) + 'px,' + (hy - 90 * k).toFixed(1) + 'px)', opacity: 0, offset: 1 }], D, rr(0, .4));
  }
  fx1('<div style="position:absolute;left:-220px;top:0;width:440px;text-align:center;font:700 ' + (m ? 22 : 34) + 'px/1.1 \'Cormorant SC\',serif;letter-spacing:.04em;color:' + (night ? '#E8FFF4' : '#1C3324') + ';text-shadow:0 0 18px ' + (night ? 'rgba(94,242,194,.85)' : 'rgba(255,240,190,.95)') + '">Xong hết việc hôm nay!</div>', cx, cy + 20 * S, [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 0, transform: 'translateY(10px)', offset: .38 }, { opacity: 1, transform: 'translateY(0)', offset: .5 }, { opacity: 1, transform: 'translateY(0)', offset: .82 }, { opacity: 0, transform: 'translateY(-6px)' }], D);
}

export { flySpawn as spawnElfFlyer, initClk, addFF, isUI, bgClick, celebrate, bigCelebrate, handleMoonClick, waterSplash };
