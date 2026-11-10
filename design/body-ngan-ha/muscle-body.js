(function () {
  if (customElements.get('muscle-body')) return;
  const NAMES = { chest: 'Ngực', shoulders: 'Vai', biceps: 'Tay trước', triceps: 'Tay sau', forearms: 'Cẳng tay', abs: 'Bụng', obliques: 'Liên sườn', traps: 'Cầu vai', lats: 'Xô', lowerback: 'Lưng dưới', glutes: 'Mông', quads: 'Đùi trước', hamstrings: 'Đùi sau', calves: 'Bắp chân' };
  let threeP = null;
  const loadThree = () => threeP || (threeP = import('https://unpkg.com/three@0.160.0/build/three.module.js'));
  const HEAT = [[0, '#E6E0D8'], [0.35, '#F1C29C'], [0.7, '#E8804F'], [1, '#C8361F']];
  const REC = { ready: '#3E9E68', mid: '#E0A23C', low: '#D2462B' };
  const ACCENT = '#6949E8', SECOND = '#C4B6F4', MUSCLE = '#D2C7BC', HOVER = '#B3A2F0', SKIN = '#E9E5DF';

  // [id, x, y, z, sx, sy, sz, rz, ry, mirror]
  const BASE = [
    [0, 1.67, 0.005, .082, .1, .092, 0, 0, 0],
    [0, 1.535, -.005, .05, .065, .05, 0, 0, 0],
    [0, 1.27, 0, .155, .21, .095, 0, 0, 0],
    [0, 1.06, 0, .128, .12, .084, 0, 0, 0],
    [0, .93, 0, .145, .085, .09, 0, 0, 0],
    [.205, 1.25, 0, .042, .13, .044, .06, 0, 1],
    [.224, .99, .01, .035, .12, .036, .04, 0, 1],
    [.233, .82, .015, .03, .055, .022, .03, 0, 1],
    [.086, .67, 0, .066, .2, .062, 0, 0, 1],
    [.088, .47, .015, .05, .05, .05, 0, 0, 1],
    [.09, .31, 0, .046, .17, .048, 0, 0, 1],
    [.09, .035, .045, .042, .03, .09, 0, 0, 1]
  ];
  const MUS = [
    ['chest', .074, 1.37, .07, .085, .06, .042, 0, .28, 1],
    ['shoulders', .175, 1.42, 0, .058, .066, .062, 0, 0, 1],
    ['biceps', .21, 1.25, .027, .036, .086, .032, .06, 0, 1],
    ['triceps', .21, 1.26, -.025, .038, .09, .033, .06, 0, 1],
    ['forearms', .226, 1.01, .012, .036, .1, .036, .04, 0, 1],
    ['abs', .03, 1.2, .078, .028, .03, .022, 0, 0, 1],
    ['abs', .03, 1.13, .079, .028, .031, .022, 0, 0, 1],
    ['abs', .03, 1.06, .077, .027, .032, .022, 0, 0, 1],
    ['obliques', .1, 1.1, .042, .035, .08, .046, 0, .3, 1],
    ['traps', 0, 1.47, -.035, .1, .06, .042, 0, 0, 0],
    ['traps', 0, 1.37, -.072, .06, .085, .03, 0, 0, 0],
    ['lats', .1, 1.25, -.055, .075, .13, .04, -.15, -.25, 1],
    ['lowerback', .035, 1.08, -.07, .032, .07, .026, 0, 0, 1],
    ['glutes', .068, .9, -.058, .072, .075, .06, 0, 0, 1],
    ['quads', .088, .68, .036, .06, .17, .05, 0, 0, 1],
    ['hamstrings', .088, .66, -.034, .055, .17, .045, 0, 0, 1],
    ['calves', .09, .33, -.028, .042, .1, .04, 0, 0, 1]
  ];

  const parseMap = s => { const o = {}; (s || '').split(',').forEach(p => { const [k, v] = p.split(':'); if (k) o[k.trim()] = v; }); return o; };

  class MuscleBody extends HTMLElement {
    static get observedAttributes() { return ['selected', 'mode', 'heat', 'view', 'secondary', 'recovery']; }
    connectedCallback() {
      if (this._on) return;
      this._on = true;
      Object.assign(this.style, { display: 'block', position: 'relative', touchAction: 'none', width: this.style.width || '100%', height: this.style.height || '100%', cursor: 'grab' });
      loadThree().then(T => { if (this._on && !this._r) this._build(T); });
    }
    disconnectedCallback() {
      this._on = false;
      cancelAnimationFrame(this._raf);
      if (this._ro) this._ro.disconnect();
      if (this._r) { this._r.dispose(); this._r.domElement.remove(); this._r = null; }
      if (this._tip) { this._tip.remove(); this._tip = null; }
    }
    attributeChangedCallback(n) {
      if (n === 'view' && this._T) this._applyView();
      if (this._T) this._paint();
    }
    _applyView() {
      const v = (this.getAttribute('view') || 'front').split(':')[0];
      const base = v === 'back' ? Math.PI : 0;
      const k = Math.round((this._rotY - base) / (Math.PI * 2));
      this._tY = base + k * Math.PI * 2;
      this._tX = 0;
    }
    _build(T) {
      this._T = T;
      const r = new T.WebGLRenderer({ antialias: true, alpha: true });
      r.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
      r.outputColorSpace = T.SRGBColorSpace;
      Object.assign(r.domElement.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', display: 'block' });
      this.appendChild(r.domElement);
      this._r = r;
      const tip = document.createElement('div');
      Object.assign(tip.style, { position: 'absolute', pointerEvents: 'none', padding: '5px 9px', borderRadius: '7px', background: '#15161A', color: '#fff', font: "500 12px/1.2 'Be Vietnam Pro',sans-serif", opacity: '0', transition: 'opacity .12s', whiteSpace: 'nowrap', transform: 'translate(-50%,-140%)', zIndex: 2 });
      this.appendChild(tip);
      this._tip = tip;

      const scene = new T.Scene();
      this._scene = scene;
      const cam = new T.PerspectiveCamera(28, 1, .1, 50);
      this._cam = cam;
      this._dist = 4.1;
      scene.add(new T.HemisphereLight(0xffffff, 0xd6cfc4, 1.25));
      const key = new T.DirectionalLight(0xffffff, 1.5); key.position.set(2, 3, 4); scene.add(key);
      const rim = new T.DirectionalLight(0xfff4ea, .7); rim.position.set(-2.5, 2, -3); scene.add(rim);

      const g = new T.Group(); scene.add(g); this._g = g;
      const geo = new T.SphereGeometry(1, 36, 24);
      const skin = new T.MeshStandardMaterial({ color: SKIN, roughness: .7 });
      const add = (row, mat, id) => {
        const [x, y, z, sx, sy, sz, rz, ry, mir] = row;
        const sides = mir && x !== 0 ? [1, -1] : [1];
        sides.forEach(s => {
          const m = new T.Mesh(geo, mat);
          m.position.set(x * s, y, z); m.scale.set(sx, sy, sz); m.rotation.set(0, ry * s, rz * s);
          if (id) m.userData.id = id;
          g.add(m);
        });
      };
      BASE.forEach(b => add(b, skin));
      this._mats = {};
      this._hits = [];
      MUS.forEach(([id, ...row]) => {
        if (!this._mats[id]) this._mats[id] = new T.MeshStandardMaterial({ color: MUSCLE, roughness: .55 });
        add(row, this._mats[id], id);
      });
      g.children.forEach(c => { if (c.userData.id) this._hits.push(c); });

      const cv = document.createElement('canvas'); cv.width = cv.height = 128;
      const cx = cv.getContext('2d'); const gr = cx.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, 'rgba(20,18,14,.28)'); gr.addColorStop(1, 'rgba(20,18,14,0)');
      cx.fillStyle = gr; cx.fillRect(0, 0, 128, 128);
      const sh = new T.Mesh(new T.PlaneGeometry(.9, .9), new T.MeshBasicMaterial({ map: new T.CanvasTexture(cv), transparent: true, depthWrite: false }));
      sh.rotation.x = -Math.PI / 2; sh.position.y = .002; scene.add(sh);

      this._rotY = 0; this._tY = 0; this._rotX = 0; this._tX = 0; this._hover = null;
      this._applyView(); this._rotY = this._tY;
      this._ray = new T.Raycaster(); this._ptr = new T.Vector2();
      this._bind();
      this._ro = new ResizeObserver(() => this._size()); this._ro.observe(this);
      this._size(); this._paint();
      const loop = t => { this._tick(t); this._raf = requestAnimationFrame(loop); };
      this._raf = requestAnimationFrame(loop);
    }
    _size() {
      const w = this.clientWidth || 300, h = this.clientHeight || 500;
      this._r.setSize(w, h, false);
      this._cam.aspect = w / h;
      const fitH = .98 / Math.tan((this._cam.fov / 2) * Math.PI / 180);
      const fitW = .42 / (Math.tan((this._cam.fov / 2) * Math.PI / 180) * this._cam.aspect);
      this._fit = Math.max(fitH, fitW) * 1.06;
      this._cam.updateProjectionMatrix();
    }
    _pick(e) {
      const b = this.getBoundingClientRect();
      this._ptr.set(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1);
      this._ray.setFromCamera(this._ptr, this._cam);
      const hit = this._ray.intersectObjects(this._g.children, false)[0];
      return { id: hit && hit.object.userData.id || null, x: e.clientX - b.left, y: e.clientY - b.top };
    }
    _bind() {
      let down = null;
      this.addEventListener('pointerdown', e => {
        down = { x: e.clientX, y: e.clientY, ry: this._tY, rx: this._tX, moved: false };
        this.setPointerCapture(e.pointerId); this.style.cursor = 'grabbing';
      });
      this.addEventListener('pointermove', e => {
        if (down) {
          const dx = e.clientX - down.x, dy = e.clientY - down.y;
          if (Math.abs(dx) + Math.abs(dy) > 4) down.moved = true;
          this._tY = down.ry + dx * .011;
          this._tX = Math.max(-.35, Math.min(.35, down.rx + dy * .004));
          this._tip.style.opacity = '0';
          return;
        }
        const p = this._pick(e);
        if (p.id !== this._hover) { this._hover = p.id; this._paint(); }
        this.style.cursor = p.id ? 'pointer' : 'grab';
        if (p.id) { this._tip.textContent = NAMES[p.id]; this._tip.style.left = p.x + 'px'; this._tip.style.top = p.y + 'px'; this._tip.style.opacity = '1'; }
        else this._tip.style.opacity = '0';
      });
      const up = e => {
        if (!down) return;
        const moved = down.moved; down = null; this.style.cursor = 'grab';
        if (moved) return;
        const p = this._pick(e);
        if (p.id) this.dispatchEvent(new CustomEvent('muscle-select', { detail: { id: p.id, channel: this.getAttribute('channel') }, bubbles: true, composed: true }));
      };
      this.addEventListener('pointerup', up);
      this.addEventListener('pointercancel', () => { down = null; });
      this.addEventListener('pointerleave', () => { if (!down && this._hover) { this._hover = null; this._paint(); } this._tip.style.opacity = '0'; });
      this.addEventListener('wheel', e => { e.preventDefault(); this._zoom = Math.max(.55, Math.min(1.25, (this._zoom || 1) + e.deltaY * .0012)); }, { passive: false });
    }
    _heatCol(v) {
      const T = this._T; v = Math.max(0, Math.min(1, +v || 0));
      for (let i = 1; i < HEAT.length; i++) if (v <= HEAT[i][0]) {
        const [a0, c0] = HEAT[i - 1], [a1, c1] = HEAT[i];
        return new T.Color(c0).lerp(new T.Color(c1), (v - a0) / (a1 - a0));
      }
      return new T.Color(HEAT[HEAT.length - 1][1]);
    }
    _paint() {
      if (!this._mats) return;
      const T = this._T;
      const mode = this.getAttribute('mode') || 'group';
      const sel = this.getAttribute('selected');
      const sec = (this.getAttribute('secondary') || '').split(',');
      const heat = parseMap(this.getAttribute('heat'));
      const rec = parseMap(this.getAttribute('recovery'));
      Object.entries(this._mats).forEach(([id, m]) => {
        let c, em = 0;
        if (mode === 'heat') { c = this._heatCol(heat[id]); em = id === sel ? .3 : id === this._hover ? .14 : 0; }
        else if (mode === 'rec') { c = new T.Color(REC[rec[id]] || MUSCLE); em = id === sel ? .3 : id === this._hover ? .14 : 0; }
        else { c = new T.Color(id === sel ? ACCENT : id === this._hover ? HOVER : sec.includes(id) ? SECOND : MUSCLE); }
        m.color.copy(c);
        m.emissive.set(mode === 'group' ? '#000000' : ACCENT);
        m.emissiveIntensity = em;
        m.userData.pulse = id === sel;
      });
    }
    _tick(t) {
      this._rotY += (this._tY - this._rotY) * .12;
      this._rotX += (this._tX - this._rotX) * .12;
      this._g.rotation.y = this._rotY;
      this._g.rotation.x = this._rotX;
      const d = this._fit * (this._zoom || 1);
      const ty = .92 + (1 - (this._zoom || 1)) * .45;
      this._cam.position.set(0, ty + .12, d);
      this._cam.lookAt(0, ty, 0);
      const mode = this.getAttribute('mode') || 'group';
      Object.values(this._mats).forEach(m => {
        if (m.userData.pulse) { if (mode === 'group') { m.emissive.set(ACCENT); m.emissiveIntensity = .18 + .14 * Math.sin(t / 300); } else m.emissiveIntensity = .28 + .14 * Math.sin(t / 300); }
      });
      this._r.render(this._scene, this._cam);
    }
  }
  customElements.define('muscle-body', MuscleBody);
})();
