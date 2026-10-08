import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import AppIcon from '../AppIcon';

// Tọa độ khối dựng 3D cơ thể và các nhóm cơ (giải phẫu hình khối)
const BASE = [
  [0, 1.67, 0.005, .082, .1, .092, 0, 0, 0], // Đầu
  [0, 1.535, -.005, .05, .065, .05, 0, 0, 0], // Cổ
  [0, 1.27, 0, .155, .21, .095, 0, 0, 0], // Thân trên
  [0, 1.06, 0, .128, .12, .084, 0, 0, 0], // Eo
  [0, .93, 0, .145, .085, .09, 0, 0, 0], // Hông
  [.205, 1.25, 0, .042, .13, .044, .06, 0, 1], // Bắp tay
  [.224, .99, .01, .035, .12, .036, .04, 0, 1], // Cẳng tay
  [.233, .82, .015, .03, .055, .022, .03, 0, 1], // Bàn tay
  [.086, .67, 0, .066, .2, .062, 0, 0, 1], // Đùi
  [.088, .47, .015, .05, .05, .05, 0, 0, 1], // Khớp gối
  [.09, .31, 0, .046, .17, .048, 0, 0, 1], // Cẳng chân
  [.09, .035, .045, .042, .03, .09, 0, 0, 1] // Bàn chân
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

const NAMES = {
  chest: 'Ngực',
  shoulders: 'Vai',
  biceps: 'Tay trước',
  triceps: 'Tay sau',
  forearms: 'Cẳng tay',
  abs: 'Bụng',
  obliques: 'Liên sườn',
  traps: 'Cầu vai',
  lats: 'Xô',
  lowerback: 'Lưng dưới',
  glutes: 'Mông',
  quads: 'Đùi trước',
  hamstrings: 'Đùi sau',
  calves: 'Bắp chân'
};

const MUSCLE_SIDES = {
  chest: 'front',
  abs: 'front',
  obliques: 'front',
  biceps: 'front',
  quads: 'front',
  forearms: 'front',
  shoulders: 'both',
  traps: 'back',
  lats: 'back',
  triceps: 'back',
  lowerback: 'back',
  glutes: 'back',
  hamstrings: 'back',
  calves: 'back'
};

const HEAT_PALETTE = [[0, '#E6E0D8'], [0.35, '#F1C29C'], [0.7, '#E8804F'], [1, '#C8361F']];
const REC_PALETTE = { ready: '#3E9E68', mid: '#E0A23C', low: '#D2462B' };
const COLOR_ACCENT = '#6949E8';
const COLOR_SECOND = '#C4B6F4';
const COLOR_MUSCLE = '#D2C7BC';
const COLOR_HOVER = '#B3A2F0';
const COLOR_SKIN = '#E9E5DF';

// Helper cập nhật màu sắc các khối cơ
function applyMaterialColors(s, selId, curMode, secList = [], hMap = {}, rMap = {}) {
  if (!s?.mats || !s?.renderer) return;

  const heatColor = (val) => {
    const v = Math.max(0, Math.min(1, +val || 0));
    for (let i = 1; i < HEAT_PALETTE.length; i++) {
      if (v <= HEAT_PALETTE[i][0]) {
        const [a0, c0] = HEAT_PALETTE[i - 1];
        const [a1, c1] = HEAT_PALETTE[i];
        return new THREE.Color(c0).lerp(new THREE.Color(c1), (v - a0) / (a1 - a0));
      }
    }
    return new THREE.Color(HEAT_PALETTE[HEAT_PALETTE.length - 1][1]);
  };

  Object.entries(s.mats).forEach(([id, mat]) => {
    let col;
    let em = 0;
    const isSel = id === selId;
    const isHov = id === s.hovered;

    if (curMode === 'heat') {
      col = heatColor(hMap[id] || 0);
      em = isSel ? 0.3 : isHov ? 0.14 : 0;
    } else if (curMode === 'rec') {
      const rk = rMap[id] || 'ready';
      col = new THREE.Color(REC_PALETTE[rk] || COLOR_MUSCLE);
      em = isSel ? 0.3 : isHov ? 0.14 : 0;
    } else {
      col = new THREE.Color(
        isSel ? COLOR_ACCENT : isHov ? COLOR_HOVER : secList.includes(id) ? COLOR_SECOND : COLOR_MUSCLE
      );
    }

    mat.color.copy(col);
    mat.emissive.set(curMode === 'group' ? '#000000' : COLOR_ACCENT);
    mat.emissiveIntensity = em;
    mat.userData.pulse = isSel;
  });
}

export default function MuscleBodyCanvas({
  selectedId = 'chest',
  onSelectMuscle,
  viewSide = 'front', // 'front' | 'back'
  mode = 'group', // 'group' | 'heat' | 'rec'
  secondaryList = [],
  heatMap = {}, // id -> ratio 0..1
  recoveryMap = {} // id -> 'ready' | 'mid' | 'low'
}) {
  const containerRef = useRef(null);
  const onSelectMuscleRef = useRef(onSelectMuscle);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState({ text: '', x: 0, y: 0, visible: false });

  // Update callback ref without triggering scene recreation
  useEffect(() => {
    onSelectMuscleRef.current = onSelectMuscle;
  }, [onSelectMuscle]);

  // Keep latest props accessible inside stable canvas event listeners
  const propsRef = useRef({
    selectedId,
    mode,
    secondaryList,
    heatMap,
    recoveryMap,
    viewSide
  });

  useEffect(() => {
    propsRef.current = {
      selectedId,
      mode,
      secondaryList,
      heatMap,
      recoveryMap,
      viewSide
    };
  }, [selectedId, mode, secondaryList, heatMap, recoveryMap, viewSide]);

  const sceneRefs = useRef({
    renderer: null,
    camera: null,
    scene: null,
    group: null,
    mats: {},
    rotY: 0,
    targetRotY: 0,
    rotX: 0,
    targetRotX: 0,
    zoom: 1,
    fit: 4.1,
    raf: null,
    hovered: null
  });

  // Rotate camera to front or back view smoothly
  useEffect(() => {
    const s = sceneRefs.current;
    if (!s.renderer) return;
    const base = viewSide === 'back' ? Math.PI : 0;
    const k = Math.round((s.rotY - base) / (Math.PI * 2));
    s.targetRotY = base + k * Math.PI * 2;
    s.targetRotX = 0;
  }, [viewSide]);

  // Update material colors whenever selection, mode or data changes
  useEffect(() => {
    applyMaterialColors(sceneRefs.current, selectedId, mode, secondaryList, heatMap, recoveryMap);
  }, [selectedId, mode, secondaryList, heatMap, recoveryMap]);

  // Initialize Three.js scene (Direct npm import + Leak-proof cleanup)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const s = sceneRefs.current;
    let renderer = null;
    let ro = null;
    let rafId = null;

    // Resource tracking for full disposal
    const geometriesToDispose = [];
    const materialsToDispose = [];
    const texturesToDispose = [];

    try {
      // 1. Renderer
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.domElement.style.position = 'absolute';
      renderer.domElement.style.inset = '0';
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      renderer.domElement.style.display = 'block';
      container.appendChild(renderer.domElement);
      s.renderer = renderer;

      // 2. Scene & Camera
      const scene = new THREE.Scene();
      s.scene = scene;
      const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
      s.camera = camera;

      // 3. Lighting
      scene.add(new THREE.HemisphereLight(0xffffff, 0xd6cfc4, 1.25));
      const keyLight = new THREE.DirectionalLight(0xffffff, 1.5);
      keyLight.position.set(2, 3, 4);
      scene.add(keyLight);
      const rimLight = new THREE.DirectionalLight(0xfff4ea, 0.7);
      rimLight.position.set(-2.5, 2, -3);
      scene.add(rimLight);

      // 4. Group & Geometries
      const group = new THREE.Group();
      scene.add(group);
      s.group = group;

      const sharedSphereGeo = new THREE.SphereGeometry(1, 32, 20);
      geometriesToDispose.push(sharedSphereGeo);

      const skinMat = new THREE.MeshStandardMaterial({ color: COLOR_SKIN, roughness: 0.7 });
      materialsToDispose.push(skinMat);

      const addMesh = (row, mat, id) => {
        const [x, y, z, sx, sy, sz, rz, ry, mir] = row;
        const sides = mir && x !== 0 ? [1, -1] : [1];
        sides.forEach((side) => {
          const mesh = new THREE.Mesh(sharedSphereGeo, mat);
          mesh.position.set(x * side, y, z);
          mesh.scale.set(sx, sy, sz);
          mesh.rotation.set(0, ry * side, rz * side);
          if (id) mesh.userData.id = id;
          group.add(mesh);
        });
      };

      BASE.forEach((b) => addMesh(b, skinMat));

      s.mats = {};
      MUS.forEach(([id, ...row]) => {
        if (!s.mats[id]) {
          const mat = new THREE.MeshStandardMaterial({ color: COLOR_MUSCLE, roughness: 0.55 });
          s.mats[id] = mat;
          materialsToDispose.push(mat);
        }
        addMesh(row, s.mats[id], id);
      });

      // Áp dụng màu sắc ban đầu ngay khi tạo xong materials
      applyMaterialColors(s, selectedId, mode, secondaryList, heatMap, recoveryMap);

      // 5. Shadow plane at bottom
      const cv = document.createElement('canvas');
      cv.width = cv.height = 128;
      const cx = cv.getContext('2d');
      const gr = cx.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, 'rgba(20,18,14,.28)');
      gr.addColorStop(1, 'rgba(20,18,14,0)');
      cx.fillStyle = gr;
      cx.fillRect(0, 0, 128, 128);

      const shadowGeo = new THREE.PlaneGeometry(0.9, 0.9);
      geometriesToDispose.push(shadowGeo);

      const shadowTex = new THREE.CanvasTexture(cv);
      texturesToDispose.push(shadowTex);

      const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false });
      materialsToDispose.push(shadowMat);

      const shadow = new THREE.Mesh(shadowGeo, shadowMat);
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.y = 0.002;
      scene.add(shadow);

      // 6. Resizing
      const updateSize = () => {
        if (!container || !renderer) return;
        const w = container.clientWidth || 300;
        const h = container.clientHeight || 500;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        const fitH = 0.98 / Math.tan((camera.fov / 2) * (Math.PI / 180));
        const fitW = 0.42 / (Math.tan((camera.fov / 2) * (Math.PI / 180)) * camera.aspect);
        s.fit = Math.max(fitH, fitW) * 1.06;
        camera.updateProjectionMatrix();
      };
      updateSize();

      ro = new ResizeObserver(updateSize);
      ro.observe(container);

      // 7. Raycasting & User Interaction
      const ray = new THREE.Raycaster();
      const ptr = new THREE.Vector2();

      const pickObject = (e) => {
        const b = container.getBoundingClientRect();
        ptr.set(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1);
        ray.setFromCamera(ptr, camera);
        const hits = ray.intersectObjects(group.children, false);
        if (!hits || hits.length === 0) {
          return { id: null, x: e.clientX - b.left, y: e.clientY - b.top };
        }

        // Góc nhìn hiện tại của mô hình dựa theo góc xoay trục Y:
        // Khi s.rotY = 0 (hoặc k * 2PI), mặt trước hướng về camera (+Z).
        // cos(s.rotY) > 0.25 -> nhìn MẶT TRƯỚC
        // cos(s.rotY) < -0.25 -> nhìn MẶT SAU
        // còn lại -> nhìn CẠNH BÊN (Profile)
        const cosY = Math.cos(s.rotY);
        const currentView = cosY > 0.25 ? 'front' : cosY < -0.25 ? 'back' : 'side';

        const normalMatrix = new THREE.Matrix3();
        const validHits = [];

        for (let i = 0; i < hits.length; i++) {
          const hit = hits[i];
          if (!hit.face) continue;
          normalMatrix.getNormalMatrix(hit.object.matrixWorld);
          const worldNormal = hit.face.normal.clone().applyMatrix3(normalMatrix).normalize();
          const viewDir = camera.position.clone().sub(hit.point).normalize();

          // Chỉ nhận các mặt tam giác đang hướng về phía camera (loại bỏ mặt sau / xuyên thấu)
          if (worldNormal.dot(viewDir) > 0.05) {
            validHits.push(hit);
          }
        }

        if (validHits.length === 0) {
          return { id: null, x: e.clientX - b.left, y: e.clientY - b.top };
        }

        // Khoảng cách tiếp xúc bề mặt ngoài cùng (da hoặc cơ)
        const d0 = validHits[0].distance;

        // Lọc các cơ nằm sát bề mặt nhìn thấy (trong phạm vi 0.12 units so với tiếp xúc đầu tiên)
        const candidateMuscles = [];

        for (let i = 0; i < validHits.length; i++) {
          const hit = validHits[i];
          const mId = hit.object.userData.id;
          if (!mId) continue;

          // Nếu cơ này nằm sâu hơn bề mặt nhìn thấy > 0.12 đơn vị thì coi là bị khuất bên trong thân
          if (hit.distance - d0 > 0.12) continue;

          const mSide = MUSCLE_SIDES[mId] || 'both';

          // Khi nhìn mặt trước, không bắt nhầm các cơ ở mặt sau bị lọt góc / thò ra sau
          // Khi nhìn mặt sau, không bắt nhầm các cơ mặt trước
          if (currentView === 'front' && mSide === 'back') continue;
          if (currentView === 'back' && mSide === 'front') continue;

          candidateMuscles.push({
            id: mId,
            distance: hit.distance
          });
        }

        let pickedId = null;
        if (candidateMuscles.length > 0) {
          candidateMuscles.sort((a, b) => a.distance - b.distance);
          pickedId = candidateMuscles[0].id;
        }

        return {
          id: pickedId,
          x: e.clientX - b.left,
          y: e.clientY - b.top
        };
      };

      let isDown = false;
      let startX = 0;
      let startY = 0;
      let initRotY = 0;
      let initRotX = 0;
      let hasMoved = false;

      const onPointerDown = (e) => {
        isDown = true;
        hasMoved = false;
        startX = e.clientX;
        startY = e.clientY;
        initRotY = s.targetRotY;
        initRotX = s.targetRotX;
        container.style.cursor = 'grabbing';
      };

      const onPointerMove = (e) => {
        if (isDown) {
          const dx = e.clientX - startX;
          const dy = e.clientY - startY;
          if (Math.abs(dx) + Math.abs(dy) > 4) hasMoved = true;
          s.targetRotY = initRotY + dx * 0.011;
          s.targetRotX = Math.max(-0.35, Math.min(0.35, initRotX + dy * 0.004));
          setTooltip((prev) => ({ ...prev, visible: false }));
          return;
        }

        const picked = pickObject(e);
        if (picked.id !== s.hovered) {
          s.hovered = picked.id;
          const { selectedId: curSel, mode: curMode, secondaryList: curSec, heatMap: curHeat, recoveryMap: curRec } = propsRef.current;
          applyMaterialColors(s, curSel, curMode, curSec, curHeat, curRec);
        }
        container.style.cursor = picked.id ? 'pointer' : 'grab';
        if (picked.id) {
          setTooltip({ text: NAMES[picked.id] || picked.id, x: picked.x, y: picked.y, visible: true });
        } else {
          setTooltip((prev) => ({ ...prev, visible: false }));
        }
      };

      const onPointerUp = (e) => {
        if (!isDown) return;
        isDown = false;
        container.style.cursor = 'grab';
        if (!hasMoved) {
          const picked = pickObject(e);
          if (picked.id) {
            propsRef.current.selectedId = picked.id;
            const { mode: curMode, secondaryList: curSec, heatMap: curHeat, recoveryMap: curRec } = propsRef.current;
            applyMaterialColors(s, picked.id, curMode, curSec, curHeat, curRec);
            if (onSelectMuscleRef.current) {
              onSelectMuscleRef.current(picked.id);
            }
          }
        }
      };

      const onWheel = (e) => {
        e.preventDefault();
        s.zoom = Math.max(0.55, Math.min(1.25, (s.zoom || 1) + e.deltaY * 0.0012));
      };

      const onPointerLeave = () => {
        if (!isDown && s.hovered) {
          s.hovered = null;
          const { selectedId: curSel, mode: curMode, secondaryList: curSec, heatMap: curHeat, recoveryMap: curRec } = propsRef.current;
          applyMaterialColors(s, curSel, curMode, curSec, curHeat, curRec);
        }
        setTooltip((prev) => ({ ...prev, visible: false }));
      };

      container.addEventListener('pointerdown', onPointerDown);
      container.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      container.addEventListener('wheel', onWheel, { passive: false });
      container.addEventListener('pointerleave', onPointerLeave);

      // 8. Animation Render Loop
      const animate = (t) => {
        s.rotY += (s.targetRotY - s.rotY) * 0.12;
        s.rotX += (s.targetRotX - s.rotX) * 0.12;
        group.rotation.y = s.rotY;
        group.rotation.x = s.rotX;

        const d = s.fit * (s.zoom || 1);
        const ty = 0.92 + (1 - (s.zoom || 1)) * 0.45;
        camera.position.set(0, ty + 0.12, d);
        camera.lookAt(0, ty, 0);

        Object.values(s.mats).forEach((mat) => {
          if (mat.userData.pulse) {
            mat.emissive.set(COLOR_ACCENT);
            mat.emissiveIntensity = 0.22 + 0.14 * Math.sin(t / 300);
          }
        });

        renderer.render(scene, camera);
        rafId = requestAnimationFrame(animate);
      };

      rafId = requestAnimationFrame(animate);
      requestAnimationFrame(() => setLoading(false));

      // 9. Synchronous Clean Up (Guaranteed WebGL context release)
      return () => {
        if (rafId) cancelAnimationFrame(rafId);
        if (ro) ro.disconnect();

        container.removeEventListener('pointerdown', onPointerDown);
        container.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        container.removeEventListener('wheel', onWheel);
        container.removeEventListener('pointerleave', onPointerLeave);

        // Dispose textures, materials, and geometries
        texturesToDispose.forEach(t => t?.dispose?.());
        materialsToDispose.forEach(m => m?.dispose?.());
        geometriesToDispose.forEach(g => g?.dispose?.());

        if (renderer) {
          renderer.forceContextLoss();
          renderer.dispose();
          if (renderer.domElement && renderer.domElement.parentNode === container) {
            container.removeChild(renderer.domElement);
          }
        }
        s.renderer = null;
        s.scene = null;
        s.camera = null;
        s.group = null;
        s.mats = {};
      };
    } catch (err) {
      console.warn('WebGL init failed:', err);
      setTimeout(() => {
        setLoadError(true);
        setLoading(false);
      }, 0);
    }
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: '440px',
        borderRadius: '20px',
        overflow: 'hidden',
        background: 'radial-gradient(ellipse 70% 60% at 50% 42%, var(--body-card-bg) 0%, var(--body-shell-bg) 62%, var(--body-border-subtle) 100%)',
        border: '1px solid var(--body-card-border)',
        touchAction: 'none'
      }}
    >
      {/* Loading state indicator */}
      {loading && !loadError && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          background: 'rgba(247, 246, 243, 0.7)',
          zIndex: 3
        }}>
          <div style={{
            width: '24px',
            height: '24px',
            border: '2.5px solid var(--body-card-border)',
            borderTopColor: 'var(--body-accent)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite'
          }} />
          <span style={{ fontSize: '12px', color: 'var(--body-text-muted)', fontFamily: 'var(--body-mono)' }}>
            Đang tải mô hình 3D...
          </span>
        </div>
      )}

      {/* Fallback 2D nếu WebGL hoặc Three.js gặp lỗi */}
      {loadError && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          textAlign: 'center',
          gap: '12px'
        }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '24px', background: 'var(--body-shell-bg)', display: 'grid', placeItems: 'center', color: 'var(--body-text-muted)' }}>
            <AppIcon name="personSimple" size={24} />
          </div>
          <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--body-text-main)' }}>
            Chế độ Bản đồ giải phẫu 2D
          </span>
          <span style={{ fontSize: '12px', color: 'var(--body-text-muted)', maxWidth: '280px' }}>
            Trình duyệt không hỗ trợ WebGL hoặc đã xảy ra lỗi. Vui lòng chọn nhóm cơ ở danh sách bên cạnh.
          </span>
        </div>
      )}

      {/* Tooltip bồng bềnh khi hover vào nhóm cơ */}
      {tooltip.visible && (
        <div
          style={{
            position: 'absolute',
            left: `${tooltip.x}px`,
            top: `${tooltip.y}px`,
            transform: 'translate(-50%, -140%)',
            pointerEvents: 'none',
            padding: '5px 10px',
            borderRadius: '7px',
            background: '#15161A',
            color: '#FFFFFF',
            fontSize: '12px',
            fontWeight: 600,
            whiteSpace: 'nowrap',
            zIndex: 10,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            transition: 'opacity 0.12s ease'
          }}
        >
          {tooltip.text}
        </div>
      )}

      {/* Chú thích điều khiển góc phải dưới */}
      <div style={{
        position: 'absolute',
        right: '16px',
        bottom: '16px',
        fontSize: '11px',
        lineHeight: 1.4,
        color: '#8A8A84',
        textAlign: 'right',
        pointerEvents: 'none',
        zIndex: 2
      }}>
        Kéo để xoay 360°<br />Cuộn để phóng to
      </div>
    </div>
  );
}
