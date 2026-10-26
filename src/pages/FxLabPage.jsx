import { useEffect, useRef, useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import SkyBackground from '../components/SkyBackground';
import { AURORA_POOL, spawnAuroraFlyer } from '../utils/taskFlyersAurora';
import { ELF_POOL, spawnElfFlyer, hosts as elfHosts, frameKey, celebrate, handleMoonClick, waterSplash, setLastPointer } from '../utils/taskFlyersElf';
import { NATURE_TYPES } from '../utils/taskNatureFx';
import '../styles/tasks.css';
import '../styles/tasks-aurora.css';
import '../styles/tasks-elf.css';
import '../styles/fx-lab.css';

/**
 * FX Lab (/fx-lab, sidebar → Khác → FX Lab): xem trước mọi vật bay, kịch bản, tương tác của nền
 * trang Nhiệm vụ. Chạy đúng code thật (SkyBackground + taskFlyers* + CSS) → thấy gì ở đây app chạy y vậy.
 * Quy trình (docs/RULES.md): hiệu ứng mới / sửa lớn vào bể với trọng số 0 (Nháp) → user xem ở đây → duyệt
 * xong mới đặt trọng số thật. Thí nghiệm chưa vào app (Lottie, sprite…) là trang tĩnh trong public/ nhúng ở tab Thí nghiệm.
 * ?embed=1: chỉ vẽ nền (khung Mobile 390 là iframe trỏ về chính trang này), nhận lệnh qua window.__fxLab.
 */

const MOBILE_MQ = '(max-width: 768px)';

const LABELS = {
  jet: 'Phản lực kéo vệt khói', show: 'Phi đội biểu diễn', heli: 'Trực thăng', rocket: 'Tên lửa', birds: 'Đàn chim',
  eagle: 'Đại bàng', balloon: 'Khinh khí cầu', paper: 'Máy bay giấy', banner: 'Máy bay kéo băng rôn', abduct: 'UFO bắt cóc',
  rainbow: 'Cầu vồng sau mưa', owl: 'Cú đêm', bats: 'Đàn dơi', nplane: 'Máy bay đêm nhắn nhủ', iss: 'Trạm vũ trụ ISS',
  astro: 'Phi hành gia', meteors: 'Mưa sao băng', lanterns: 'Đèn trời', whale: 'Cá voi sao', hangnga: 'Chị Hằng',
  dome: 'UFO mái vòm (mobile đổi thành UFO bắt cóc)',
  deer: 'Hươu', butterflies: 'Đàn bướm', bluebird: 'Chim xanh', mushroom: 'Nấm', dandelion: 'Bồ công anh', squirrel: 'Sóc',
  sunray: 'Tia nắng', squirrelchase: 'Sóc rượt nhau', frog: 'Ếch trêu', gnome: 'Chú lùn', bee: 'Ong rơi mật',
  deernut: 'Hươu + hạt dẻ', carrier_pigeon: 'Bồ câu đưa thư', rainbow_slide: 'Sóc trượt cầu vồng',
  koi: 'Cá koi bay', veins: 'Gân sáng mọc từ đất', ring: 'Vòng tiên', starfall: 'Sao rơi', spirit: 'Linh hồn rừng',
  bloom: 'Hoa sen ngọc nở', koistar: 'Koi đớp sao', owlmiss: 'Cú vồ hụt', spiritbow: 'Linh hồn + cầu vồng', dragon: 'Rồng nhỏ hắt xì',
  dragon_east: 'Rồng xanh phương Đông', dragon_west: 'Rồng châu Âu', catfight: '2 mèo đánh nhau',
  leafrider: 'Tiên cưỡi lá', constel: 'Chòm sao hiện hình', whaleeat: 'Cá voi nuốt đom đóm',
  owlsinge: 'Cú cháy lông → kỳ lân chữa lành', kitsune: 'Hồ ly 9 đuôi', unicorn: 'Kỳ lân uống suối', wisp: 'Ma trơi dụ đường',
  witch: 'Phù thuỷ cưỡi chổi', blackcat: 'Mèo đen', fairynap: 'Tiên ngủ gật', ent: 'Người cây ngáp', foxlant: 'Hồ ly giật đèn lồng',
  wispowl: 'Ma trơi doạ cú', witchwhale: 'Phù thuỷ đụng cá voi', heal: 'Kỳ lân chữa lành cú', catwisp: 'Mèo vồ ma trơi',
  witchpotion: 'Phù thuỷ rơi độc dược → mèo khổng lồ', catgiant: 'Mèo hoá khổng lồ', abduct_gnome: 'UFO bắt chú lùn',
  wish: 'Sao ước nguyện (bấm được)', orion: 'Chòm Thợ Săn', moonbow: 'Cầu vồng trăng', milky: 'Ngân Hà', lake: 'Hồ phát sáng',
  dew: 'Sương rơi', silverleaf: 'Lá bạc', glowdand: 'Bồ công anh phát sáng', moss: 'Rêu phát sáng', eclipse: 'Nguyệt thực',
};
const ELF_LABELS = { lanterns: 'Đèn lồng', whale: 'Cá voi', owl: 'Cú', rainbow: 'Cầu vồng' };
const label = (type, style) => (style === 'elf' && ELF_LABELS[type]) || LABELS[type] || `${type} (chưa đặt tên)`;

const MODES = [
  { style: 'default', night: false, title: 'Mặc định · Ngày', pool: AURORA_POOL.day },
  { style: 'default', night: true, title: 'Mặc định · Đêm', pool: AURORA_POOL.night },
  { style: 'elf', night: false, title: 'Rừng tiên · Ngày', pool: ELF_POOL.day },
  { style: 'elf', night: true, title: 'Rừng tiên · Đêm', pool: ELF_POOL.night },
];
// Có code nhưng không nằm trong bể bốc ngẫu nhiên
const EXTRA = {
  'default-night': [['eclipse', '1/40 lượt đêm']],
  'elf-night': [['eclipse', '1/40 lượt đêm']],
};
const EVENTS = [
  { id: 'done', title: 'Xong 1 việc', need: 'elf' },
  { id: 'allDone', title: 'Xong hết việc hôm nay', need: 'elf' },
  { id: 'splash', title: 'Nước bắn + koi nhảy', need: 'elf' },
  { id: 'moon', title: 'Bấm trăng: Thỏ ngọc chào', need: 'night' },
];
const HINTS = [
  'Rừng tiên: bấm nền trời → rung cây, lá rơi, chim / bướm đêm bay ra',
  'Rừng tiên: bấm sát đáy → nước bắn + koi nhảy',
  'Rừng tiên: bấm nấm hoặc đom đóm → nấm nảy / đom đóm bay theo chuột',
  'Rừng tiên: rê chuột → sương tan quanh con trỏ',
  'Ban đêm: rê chuột → bụi sao theo con trỏ',
  'Ban đêm: bấm sao ước nguyện đang bay → thẻ điều ước',
];
const EXPERIMENTS = [
  { id: 'animals', title: 'So sánh đại bàng', desc: 'Đại bàng săn mồi: Hiện tại vs Vẽ bằng code (hồ ly 9 đuôi, 2 rồng, mèo đánh nhau đã vào app)', src: '/fx-experiments/animals.html' },
];

function playOn(stage, type, { elf, night, m }) {
  const host = stage?.querySelector('.task-cosmos-bg:not(.task-fx-top) > .task-fly-host');
  if (!host) return;
  if (!elf) { spawnAuroraFlyer(host, m, night, type); return; }
  spawnElfFlyer(host, m, night, type);
  // Kịch bản nối tiếp (cú cháy lông → chữa lành, độc dược → mèo khổng lồ): app chờ lượt bốc sau, lab tự chạy đúng hẹn
  const nx = host._next;
  if (nx) setTimeout(() => { if (host._next === nx && host.isConnected) { host._next = null; spawnElfFlyer(host, m, night, nx.t); } }, Math.max(0, nx.at - Date.now()) + 100);
}

function eventOn(stage, id, { theme, m }) {
  if (!stage) return;
  const fk = frameKey(theme, m), r = stage.getBoundingClientRect();
  // Ăn mừng bám chỗ con trỏ vừa bấm (nút nằm trên bảng điều khiển) → đặt vào giữa sân khấu
  setLastPointer({ x: r.left + r.width * 0.45, y: r.top + r.height * 0.55, t: Date.now() });
  if (id === 'done' || id === 'allDone') celebrate(fk, id === 'allDone');
  else if (id === 'moon') { const el = stage.querySelector('.task-moon'); if (el) handleMoonClick(el); }
  else if (id === 'splash') { const top = elfHosts[`${fk}_t`]; if (top) waterSplash(top, top.clientWidth * 0.5, top.clientHeight * 0.86, m ? 0.72 : 1); }
}

function Seg({ value, options, onChange, label: aria }) {
  return (
    <div className="fxlab-seg" role="group" aria-label={aria}>
      {options.map(([v, text]) => (
        <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}>{text}</button>
      ))}
    </div>
  );
}

function Chip({ type, style, weight, note, last, onPlay }) {
  return (
    <button type="button" className={`fxlab-chip${weight === 0 ? ' is-draft' : ''}${last ? ' is-last' : ''}`} onClick={onPlay} title={note || type}>
      <span>{label(type, style)}</span>
      <code>{type}</code>
      {weight === 0 && <em>Nháp</em>}
      {note && <small>{note}</small>}
    </button>
  );
}

function ModeScenes({ mode, current, last, onPlay }) {
  const own = mode.pool.filter(([t]) => !NATURE_TYPES.includes(t));
  const nature = mode.pool.filter(([t]) => NATURE_TYPES.includes(t));
  const extra = EXTRA[`${mode.style}-${mode.night ? 'night' : 'day'}`] || [];
  const chip = ([t, w], note) => <Chip key={t} type={t} style={mode.style} weight={w} note={note} last={current && last === t} onPlay={() => onPlay(t, mode)} />;
  const body = (
    <>
      <div className="fxlab-chips">{own.map((p) => chip(p))}</div>
      {nature.length > 0 && <><h4>Thiên nhiên dùng chung</h4><div className="fxlab-chips">{nature.map((p) => chip(p))}</div></>}
      {extra.length > 0 && <><h4>Ngoài bể ngẫu nhiên</h4><div className="fxlab-chips">{extra.map(([t, note]) => chip([t, 1], note))}</div></>}
    </>
  );
  const count = `${own.length}${nature.length ? ` + ${nature.length} thiên nhiên` : ''}`;
  if (current) return <section className="fxlab-mode is-current"><h3>{mode.title} <small>đang xem · {count}</small></h3>{body}</section>;
  return <details className="fxlab-mode"><summary>{mode.title} <small>{count} · bấm 1 cảnh để chuyển sang</small></summary>{body}</details>;
}

export default function FxLabPage() {
  const [embed] = useState(() => new URLSearchParams(window.location.search).get('embed') === '1');
  const { theme, toggleTheme, taskStyle, setTaskStyle, reduceMotion: reduced } = useTheme();
  const elf = taskStyle === 'elf', night = theme !== 'light';
  const [narrow, setNarrow] = useState(() => window.matchMedia?.(MOBILE_MQ).matches ?? false);
  const [frame, setFrame] = useState('desktop');
  const [auto, setAuto] = useState(() => embed && new URLSearchParams(window.location.search).get('auto') === '1');
  const [round, setRound] = useState(0);
  const [tab, setTab] = useState('scenes');
  const [open, setOpen] = useState(!narrow);
  const [exp, setExp] = useState(null);
  const [queued, setQueued] = useState(null);
  const [last, setLast] = useState(null);
  const stageRef = useRef(null), iframeRef = useRef(null), live = useRef(null), runRef = useRef(null);
  const m = embed || narrow, phone = !embed && !narrow && frame === 'mobile';
  const ctx = { elf, night, theme, m };
  const stageKey = `${taskStyle}-${theme}-${auto}-${round}-${m}-${frame}`;

  useEffect(() => {
    const mq = window.matchMedia?.(MOBILE_MQ);
    if (!mq) return undefined;
    const on = (e) => setNarrow(e.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  // Đổi Kiểu / Ngày-Đêm ở lab là đổi thật trong app → rời trang thì trả lại như lúc vào
  useEffect(() => { live.current = { theme, taskStyle, toggleTheme, setTaskStyle, ctx }; });
  useEffect(() => {
    if (embed) return undefined;
    const orig = { theme: live.current.theme, taskStyle: live.current.taskStyle };
    return () => {
      const cur = live.current;
      if (cur.theme !== orig.theme) cur.toggleTheme();
      if (cur.taskStyle !== orig.taskStyle) cur.setTaskStyle(orig.taskStyle);
    };
  }, [embed]);

  // Khung Mobile: iframe gọi vào lab bên trong qua window.__fxLab
  useEffect(() => {
    if (!embed) return undefined;
    window.__fxLab = {
      play: (type) => playOn(stageRef.current, type, live.current.ctx),
      event: (id) => eventOn(stageRef.current, id, live.current.ctx),
    };
    return () => { delete window.__fxLab; };
  }, [embed]);

  useEffect(() => {
    if (!exp) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setExp(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [exp]);

  function callPhone(fn, tries = 40) {
    const api = iframeRef.current?.contentWindow?.__fxLab;
    if (api) fn(api);
    else if (tries > 0) setTimeout(() => callPhone(fn, tries - 1), 300);
  }

  function run(type) {
    setLast(type);
    if (phone) callPhone((api) => api.play(type));
    else playOn(stageRef.current, type, ctx);
  }
  useEffect(() => { runRef.current = run; });

  // Cảnh thuộc kiểu / giờ khác: chuyển chế độ, chờ nền dựng lại rồi mới chạy
  useEffect(() => {
    if (!queued) return undefined;
    const t = setTimeout(() => { setQueued(null); runRef.current(queued); }, 700);
    return () => clearTimeout(t);
  }, [queued, stageKey]);

  const setMode = (style, nightWanted) => {
    if (style !== taskStyle) setTaskStyle(style);
    if (nightWanted !== night) toggleTheme();
  };
  const play = (type, mode) => {
    if (mode.style !== taskStyle || mode.night !== night) { setMode(mode.style, mode.night); setQueued(type); return; }
    run(type);
  };
  const fire = (id) => (phone ? callPhone((api) => api.event(id)) : eventOn(stageRef.current, id, ctx));

  const stage = (
    <div key={stageKey} ref={stageRef} className={`tasks-workspace fxlab-stage${elf ? ' tk-elf' : ''}`} data-frame={elf ? frameKey(theme, m) : undefined}>
      <SkyBackground isMobile={m} autoFly={auto} />
    </div>
  );
  if (embed) return stage;

  return (
    <div className={`fxlab${narrow ? ' is-narrow' : ''}`}>
      {phone ? (
        <div className="fxlab-phone-wrap">
          <iframe key={stageKey} ref={iframeRef} className="fxlab-phone" src={`/fx-lab?embed=1&auto=${auto ? 1 : 0}`} title="Khung mobile 390 × 844" />
        </div>
      ) : stage}

      {open ? (
        <aside className="fxlab-panel" aria-label="FX Lab">
          <header className="fxlab-head">
            <div>
              <strong>FX Lab</strong>
              <span>Chạy code thật của nền trang Nhiệm vụ</span>
            </div>
            <button type="button" className="fxlab-x" onClick={() => setOpen(false)} aria-label="Thu gọn bảng">×</button>
          </header>

          <div className="fxlab-controls">
            <Seg label="Kiểu" value={taskStyle} options={[['default', 'Mặc định'], ['elf', 'Rừng tiên']]} onChange={(s) => setMode(s, night)} />
            <Seg label="Thời gian" value={night ? 'night' : 'day'} options={[['day', 'Ngày'], ['night', 'Đêm']]} onChange={(v) => setMode(taskStyle, v === 'night')} />
            {!narrow && <Seg label="Khung" value={frame} options={[['desktop', 'Desktop'], ['mobile', 'Mobile 390']]} onChange={setFrame} />}
            <div className="fxlab-line">
              <label className="fxlab-check"><input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> Tự thả ngẫu nhiên như app</label>
              <button type="button" className="fxlab-btn" onClick={() => setRound((r) => r + 1)}>Dọn trời</button>
            </div>
            <p className="fxlab-note">Kiểu và Ngày/Đêm ở đây là đổi thật trong app; rời trang sẽ trả lại như cũ.</p>
            {reduced && <p className="fxlab-note is-warn">Đang bật Giảm chuyển động (Cài đặt → Chung): app tắt nền động nên nhiều hiệu ứng ở đây cũng không chạy.</p>}
          </div>

          <div className="fxlab-tabs" role="tablist">
            {[['scenes', 'Kịch bản'], ['events', 'Tương tác'], ['exp', 'Thí nghiệm']].map(([id, text]) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>{text}</button>
            ))}
          </div>

          <div className="fxlab-body">
            {tab === 'scenes' && (
              <>
                {MODES.filter((md) => md.style === taskStyle && md.night === night).map((md) => <ModeScenes key={md.title} mode={md} current last={last} onPlay={play} />)}
                {MODES.filter((md) => md.style !== taskStyle || md.night !== night).map((md) => <ModeScenes key={md.title} mode={md} last={last} onPlay={play} />)}
                <p className="fxlab-note">Nhãn <em className="fxlab-draft">Nháp</em> = trọng số 0: chỉ chạy ở đây, app không tự bốc.</p>
              </>
            )}
            {tab === 'events' && (
              <>
                <div className="fxlab-chips">
                  {EVENTS.map((ev) => {
                    const off = (ev.need === 'elf' && !elf) || (ev.need === 'night' && !night);
                    return (
                      <button key={ev.id} type="button" className="fxlab-chip" disabled={off} onClick={() => fire(ev.id)} title={off ? (ev.need === 'elf' ? 'Chỉ có ở Rừng tiên' : 'Chỉ có ban đêm') : ev.id}>
                        <span>{ev.title}</span>
                        {off && <code>{ev.need === 'elf' ? 'Rừng tiên' : 'Đêm'}</code>}
                      </button>
                    );
                  })}
                </div>
                <h4>Thử trực tiếp trên nền</h4>
                <ul className="fxlab-hints">{HINTS.map((h) => <li key={h}>{h}</li>)}</ul>
              </>
            )}
            {tab === 'exp' && (
              <div className="fxlab-exps">
                {EXPERIMENTS.map((x) => (
                  <button key={x.id} type="button" className="fxlab-exp-card" onClick={() => setExp(x)}>
                    <strong>{x.title}</strong>
                    <span>{x.desc}</span>
                  </button>
                ))}
                <p className="fxlab-note">Thí nghiệm chưa vào app: trang tĩnh trong <code>public/</code>, mở ở đây để so trước khi quyết định đưa vào.</p>
              </div>
            )}
          </div>
          {last && <footer className="fxlab-foot">Vừa chạy: {label(last, taskStyle)} <code>{last}</code></footer>}
        </aside>
      ) : (
        <button type="button" className="fxlab-fab" onClick={() => setOpen(true)}>FX Lab</button>
      )}

      {exp && (
        <div className="fxlab-exp" role="dialog" aria-label={exp.title}>
          <header>
            <strong>{exp.title}</strong>
            <button type="button" className="fxlab-x" onClick={() => setExp(null)} aria-label="Đóng thí nghiệm">×</button>
          </header>
          <iframe src={exp.src} title={exp.title} />
        </div>
      )}
    </div>
  );
}
