// ============================================================
//  3D-ФОН СТАРТОВОГО ЭКРАНА
//  Настоящая 3D-сцена на three.js: замок с башнями, стена с
//  зубцами, ворота, флаги, факелы с мерцающим светом, луна,
//  звёзды и медленный облёт камеры. Рисуется за меню и гаснет,
//  когда начинается осада (чтобы не тратить GPU в бою).
// ============================================================

import * as THREE from "./vendor/three/three.module.min.js";

const STONE = 0x8d8778, STONE_D = 0x625c50, ROOF = 0xa33a2c, WOOD = 0x5a4026;
const flags = [];                 // флаги на башнях (анимируются в цикле)

function box(w, h, d, color, x, y, z, parent) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0.02 })
  );
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

export function initMenu3D(canvas, onReady) {
  if (!canvas || !window.WebGLRenderingContext) { onReady?.(false); return null; }
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  } catch (e) { onReady?.(false); return null; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(canvas.clientWidth || 640, canvas.clientHeight || 360, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.45;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x161022, 0.032);

  const camera = new THREE.PerspectiveCamera(46, (canvas.clientWidth || 640) / (canvas.clientHeight || 360), 0.1, 140);
  camera.position.set(7.6, 4.2, 7.6);
  camera.lookAt(0, 2.05, 0);

  // ---- свет: холодная луна + тёплые факелы + подсветка снизу
  scene.add(new THREE.HemisphereLight(0x8fa0d8, 0x3a2a1e, 0.95));
  scene.add(new THREE.AmbientLight(0x4a5570, 0.75));
  const moonLight = new THREE.DirectionalLight(0xc2d4ff, 2.7);
  moonLight.position.set(-7, 9, -6);
  scene.add(moonLight);
  // тёплый контровой свет, чтобы камень читался объёмом
  const warm = new THREE.DirectionalLight(0xffb46a, 0.95);
  warm.position.set(5, 3, 6);
  scene.add(warm);

  // ---- земля
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(22, 40),
    new THREE.MeshStandardMaterial({ color: 0x3a2f21, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // ---- замок
  const castle = new THREE.Group();
  scene.add(castle);

  // главный донжон
  box(2.0, 3.4, 1.5, STONE, -1.15, 1.7, -0.2, castle);
  // зубцы донжона
  for (let i = 0; i < 4; i++) box(0.30, 0.28, 0.28, STONE_D, -2.05 + i * 0.58, 3.52, 0.52, castle);

  // стена
  box(4.6, 1.15, 0.55, STONE, 0.9, 0.58, 0.75, castle);
  for (let i = 0; i < 9; i++) box(0.26, 0.24, 0.3, STONE_D, -1.2 + i * 0.52, 1.28, 0.78, castle);

  // ---- ворота
  box(0.62, 0.86, 0.1, 0x2a1c10, 0.9, 0.43, 1.04, castle);

  // ---- светящиеся окна: дают масштаб и «жизнь» замку
  const winMat = new THREE.MeshBasicMaterial({ color: 0xffc069 });
  for (const [wx, wy, wz] of [[-1.55, 2.4, 0.56], [-0.95, 2.4, 0.56], [-1.55, 1.5, 0.56], [-0.95, 1.5, 0.56]]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.24), winMat);
    w.position.set(wx, wy, wz);
    castle.add(w);
  }

  // две башни с коническими крышами
  for (const [tx, tz, th] of [[-2.55, 0.35, 3.9], [2.75, 0.1, 4.4]]) {
    const tower = new THREE.Mesh(
      new THREE.CylinderGeometry(0.52, 0.6, th, 14),
      new THREE.MeshStandardMaterial({ color: STONE, roughness: 0.95 })
    );
    tower.position.set(tx, th / 2, tz);
    castle.add(tower);
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(0.72, 1.15, 14),
      new THREE.MeshStandardMaterial({ color: ROOF, roughness: 0.8 })
    );
    roof.position.set(tx, th + 0.57, tz);
    castle.add(roof);
    // флаг
    box(0.04, 0.55, 0.04, WOOD, tx, th + 1.35, tz, castle);
    const flag = box(0.34, 0.2, 0.02, 0xc9a44f, tx + 0.19, th + 1.52, tz, castle);
    flag.userData.flag = true;
    flags.push(flag);
  }

  // ---- факелы: тёплый мерцающий свет у ворот и на стене
  const torches = [];
  for (const [tx, ty, tz] of [[0.2, 1.55, 1.0], [1.65, 1.55, 1.0]]) {
    const post = box(0.07, 0.42, 0.07, WOOD, tx, ty - 0.2, tz, castle);
    const flame = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffc46a })
    );
    flame.position.set(tx, ty + 0.05, tz);
    castle.add(flame);
    const light = new THREE.PointLight(0xffa04a, 3.6, 8, 1.7);
    light.position.set(tx, ty + 0.12, tz + 0.15);
    castle.add(light);
    torches.push({ light, flame, seed: Math.random() * 10, post });
  }

  // ---- луна
  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(0.95, 24, 24),
    new THREE.MeshBasicMaterial({ color: 0xfff3d4 })
  );
  moon.position.set(5.5, 6.4, -11);
  scene.add(moon);
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(1.5, 20, 20),
    new THREE.MeshBasicMaterial({ color: 0xffe6a8, transparent: true, opacity: 0.16 })
  );
  halo.position.copy(moon.position);
  halo.position.y -= 0.15;
  scene.add(halo);

  // ---- звёзды
  const STARS = 260, pos = new Float32Array(STARS * 3);
  for (let i = 0; i < STARS; i++) {
    const r = 26 + Math.random() * 14;
    const a = Math.random() * Math.PI * 2, h = 4 + Math.random() * 16;
    pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = h; pos[i * 3 + 2] = Math.sin(a) * r;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
    color: 0xcfd8ff, size: 0.09, transparent: true, opacity: 0.75, depthWrite: false,
  }));
  scene.add(stars);

  let raf = 0, t = 0;
  const clock = new THREE.Clock();
  let dead = false;

  function loop() {
    if (dead) return;
    raf = requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05);
    t += dt;
    // медленный облёт камеры + лёгкое дыхание
    const a = 0.62 + Math.sin(t * 0.05) * 0.5;
    const r = 8.6;
    camera.position.set(Math.cos(a) * r, 3.9 + Math.sin(t * 0.3) * 0.14, Math.sin(a) * r);
    camera.lookAt(0, 2.45, 0);
    // факелы мерцают
    for (const tr of torches) {
      const f = 3.0 + Math.sin(t * 8.3 + tr.seed) * 0.45 + Math.sin(t * 13.7 + tr.seed) * 0.28;
      tr.light.intensity = f;
      tr.flame.scale.setScalar(0.85 + Math.sin(t * 9.1 + tr.seed) * 0.18);
    }
    // флаги колышутся
    for (let i = 0; i < flags.length; i++) {
      flags[i].rotation.y = Math.sin(t * 2.2 + i) * 0.25;
      flags[i].position.x += 0;               // держим на древке
    }
    stars.rotation.y = t * 0.006;
    renderer.render(scene, camera);
  }
  loop();
  onReady?.(true);

  return {
    /** плавно погасить и освободить GPU */
    dispose() {
      dead = true;
      cancelAnimationFrame(raf);
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
          else o.material.dispose();
        }
      });
      renderer.dispose();
    },
  };
}
