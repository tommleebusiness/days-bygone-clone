// ============================================================
//  3D-МИР ОСАДЫ
//  Вся сцена боя в 3D — как на начальной заставке: замок со
//  стеной и зубцами, донжон, башни с крышами и флагами, ворота,
//  факелы с мерцающим светом, лучник на стене, оборонительные
//  постройки, земля с травой и камнями, горы, звёзды и луна.
//
//  Камера — ортографическая и выровнена 1:1 с пиксельными
//  координатами игры: worldX = gameX, worldY = −gameY.
//  Поэтому вся игровая логика (стрелы, урон, коллизии, UI)
//  остаётся нетронутой, а картинка становится объёмной.
// ============================================================

import * as THREE from "./vendor/three/three.module.min.js";
import { makeUnit } from "./enemies3d.js?v=8";

const GROUND_Y = 296;            // линия земли в координатах игры
const WALL_X = 100;              // правый край стены в игре

// ---------- кэши геометрии/материалов ----------
const geoCache = new Map();
const matCache = new Map();

function G(key, make) {
  let g = geoCache.get(key);
  if (!g) { g = make(); geoCache.set(key, g); }
  return g;
}
function M(color, o = {}) {
  const k = color + '|' + (o.rough ?? '') + (o.metal ?? '') + (o.emissive ?? '') + (o.ei ?? '');
  let m = matCache.get(k);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color, roughness: o.rough ?? 0.9, metalness: o.metal ?? 0.04,
      emissive: o.emissive ?? 0x000000, emissiveIntensity: o.ei ?? 1,
      flatShading: !!o.flat,
    });
    matCache.set(k, m);
  }
  return m;
}
const BOX = (w, h, d) => G('b' + w + '_' + h + '_' + d, () => new THREE.BoxGeometry(w, h, d));
const SPH = (r, s = 12) => G('s' + r + '_' + s, () => new THREE.SphereGeometry(r, s, Math.max(6, s >> 1)));
const CYL = (rt, rb, h, s = 12) => G('c' + rt + '_' + rb + '_' + h + '_' + s, () => new THREE.CylinderGeometry(rt, rb, h, s));
const CONE = (r, h, s = 12) => G('k' + r + '_' + h + '_' + s, () => new THREE.ConeGeometry(r, h, s));

function add(parent, geo, material, x, y, z, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  if (rx) m.rotation.x = rx;
  if (ry) m.rotation.y = ry;
  if (rz) m.rotation.z = rz;
  parent.add(m);
  return m;
}

// ---------- цвета мира ----------
const COL = {
  stone: 0xa89f90, stoneD: 0x6f685c, stoneL: 0xc4bcaa,
  roof: 0xa33a2c, roofD: 0x7a2a1f,
  wood: 0x6a4a28, woodD: 0x402c16, iron: 0x4a4640,
  dirt: 0x4a3826, dirtD: 0x33241a, grass: 0x3f5c20,
  gold: 0xc9a44f, torch: 0xffa04a,
};
COL.grass = 0x3f5c20;

export function initWorld3D(canvas, camSpec) {
  if (!canvas || !window.WebGLRenderingContext) return null;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  } catch (e) { return null; }

  const W = camSpec.w, H = camSpec.h;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(canvas.clientWidth || W, canvas.clientHeight || H, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.65;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  // Плотный туман: без него все слои сливаются в одну плоскость.
  // 0.0022 даёт ~40% дымки на горах (z=-140) и почти нуль на игровой плоскости.
  scene.fog = new THREE.FogExp2(0x241a30, 0.00035);

  // Ортокамера ровно в пиксельных координатах игры
  // Длиннофокусная перспектива: почти ортографическая (искажение <4% ), но с
  // лёгким наклоном вниз. В отличие от орто «в лоб», теперь ВИДНЫ верхние грани
  // зубцов, площадок башен, конусов крыш и поверхность земли — появляется объём.
  // На плоскости z=0 проекция по-прежнему ровно W×H в пиксельных координатах
  // игры (worldX=gameX, worldY=-gameY), поэтому логика не сдвинулась.
  const FOV = 14, DIST = (H / 2) / Math.tan((FOV * Math.PI / 180) / 2);
  const cam = new THREE.PerspectiveCamera(FOV, W / H, 1, 4000);
  cam.position.set(W / 2, -H / 2 + DIST * 0.18, DIST);
  cam.lookAt(W / 2, -H / 2, 0);
  cam.updateProjectionMatrix();

  // ================= СВЕТ =================
  // Меньше «плоской» заливки, больше направленного света → появляется объём
  scene.add(new THREE.HemisphereLight(0xb8c8f0, 0x241c30, 1.1));
  scene.add(new THREE.AmbientLight(0x60708e, 0.85));

  // Тёплый ключевой свет от факелов замка (слева-снизу) — лепит объём
  const sun = new THREE.DirectionalLight(0xffc880, 3.6);
  sun.position.set(-0.75, 0.45, 1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  // Ортокамера света должна накрывать ВСЮ игровую плоскость + деревья,
  // иначе тени просто не попадают в буфер и сцена выглядит плоской.
  sc.left = -W * 1.3; sc.right = W * 1.3;
  sc.top = 120; sc.bottom = -H * 1.2;
  sc.near = 1; sc.far = 1400;
  sc.updateProjectionMatrix();
  sun.shadow.bias = -0.0009;
  sun.shadow.normalBias = 0.9;
  sun.shadow.radius = 2.5;
  scene.add(sun);
  const sunTgt = new THREE.Object3D();
  sunTgt.position.set(W * 0.35, -GROUND_Y, 0);
  scene.add(sunTgt);
  sun.target = sunTgt;

  const rim = new THREE.DirectionalLight(0xbcd4ff, 2.6);
  rim.position.set(0.8, 0.55, -0.6);
  scene.add(rim);
  // заполняющий фронтальный — чтобы тёмные грани не проваливались в чёрное
  const front = new THREE.DirectionalLight(0x9cb4e0, 1.5);
  front.position.set(0.1, 0.1, 1);
  scene.add(front);

  // детерминированный генератор: одинаковый мир на каждом запуске
  // (объявлен ДО земли: она использует rnd для пятен травы)
  let seed = 1337;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

  // ================= НЕБО-ПОДЛОЖКА =================
  // Вертикальный фон во весь кадр (ортокамера смотрит прямо, поэтому
  // плоскость к ней лицом). Градиент делаем вершинными цветами.
  {
    const skyGeo = new THREE.PlaneGeometry(W * 2.4, H * 2.6, 1, 3);
    const cols = [];
    const top = new THREE.Color(0x161128), mid = new THREE.Color(0x3b2240), bot = new THREE.Color(0x8a4a3a);
    for (let row = 0; row <= 3; row++) {
      const c = row === 0 ? bot : row === 1 ? mid : top;
      for (let k = 0; k < 2; k++) cols.push(c.r, c.g, c.b);
    }
    skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    const sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, depthWrite: false }));
    sky.position.set(W * 0.5, -H * 0.5, -210);
    scene.add(sky);
  }

  // ================= ЗЕМЛЯ =================
  const land = new THREE.Group();
  scene.add(land);

  // ---------- ЗЕМЛЯ ----------
  // Одна большая горизонтальная плита: верхняя поверхность на линии GROUND,
  // уходит вдаль и навстречу камере. При наклонённой камере видно ЕЁ
  // ПОВЕРХНОСТЬ (а не набор полос), поэтому сцена читается как поле боя.
  const GROUND_D = 260;                                  // глубина поля
  const groundTop = add(land, BOX(W * 2.4, 8, GROUND_D), M(0x4e6a30, { rough: 0.95 }),
    W * 0.5, -GROUND_Y - 4, -GROUND_D / 2 + 58);
  groundTop.receiveShadow = true;              // тени врагов и замка ложатся на поле
  // передний торец плиты (грунт под травой) — виден у нижней кромки
  add(land, BOX(W * 2.4, 22, 6), M(COL.dirtD, { rough: 1 }),
    W * 0.5, -GROUND_Y - 15, 58);
  // кромка травы на сломе (между полем и торцом) — тёмно-зелёная полоса
  add(land, BOX(W * 2.4, 2.4, 3), M(0x385420, { rough: 1 }),
    W * 0.5, -GROUND_Y - 1.4, 55);
  // «земляная тень» под стеной замка — прижимает замок к земле
  add(land, G('wallshadow', () => new THREE.PlaneGeometry(W * 1.2, 26)),
    new THREE.MeshBasicMaterial({ color: 0x0a1410, transparent: true, opacity: 0.42, depthWrite: false, fog: false }),
    W * 0.22, -GROUND_Y + 0.9, 18, -Math.PI / 2, 0, 0);
  // «дорожка» у стены: утоптанная земля поперёк поля
  add(land, BOX(W * 2.4, 1.2, 26), M(0x6a5238, { rough: 1 }),
    W * 0.5, -GROUND_Y + 0.4, 26);
  // пятна травы/земли для неоднородности (инстансы)
  {
    const spots = [];
    for (let i = 0; i < 110; i++) {
      spots.push({ x: rnd() * W * 2 - W * 0.5, z: 40 - rnd() * 200, w: 8 + rnd() * 30, dark: rnd() > 0.5 });
    }
    const geo = new THREE.PlaneGeometry(1, 1);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.16, depthWrite: false });
    const inst = new THREE.InstancedMesh(geo, mat, spots.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
    q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
    const col = new THREE.Color();
    spots.forEach((sp, i) => {
      m4.compose(new THREE.Vector3(sp.x, -GROUND_Y + 0.6, sp.z), q, new THREE.Vector3(sp.w, sp.w * 1.8, 1));
      inst.setMatrixAt(i, m4);
      col.setHex(sp.dark ? 0x2a3a1c : 0x6a8a3c);
      inst.setColorAt(i, col);
    });
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    land.add(inst);
  }

  // комья земли/камни: инстансы (90 объектов = 1 draw call)
  {
    const items = [];
    for (let i = 0; i < 90; i++) {
      const x = rnd() * W * 1.6 - W * 0.1;
      const z = rnd() * 16 - 8;
      const r = 1.2 + rnd() * 2.6;
      items.push({ x, z: 20 + z * 0.4, r, dark: rnd() > 0.55 });
    }
    const geo = SPH(1, 6);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true });
    const inst = new THREE.InstancedMesh(geo, mat, items.length);
    const m4 = new THREE.Matrix4(), col = new THREE.Color();
    items.forEach((it, i) => {
      m4.makeScale(it.r, it.r * 0.55, it.r);
      m4.setPosition(it.x, -GROUND_Y + 3 + it.r * 0.35, it.z);
      inst.setMatrixAt(i, m4);
      col.setHex(it.dark ? 0x6a5238 : 0x8d8578);
      inst.setColorAt(i, col);
    });
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    land.add(inst);
  }
  // трава: один instanced mesh, а не 138 отдельных конусов
  {
    const items = [];
    for (let i = 0; i < 46; i++) {
      const x = rnd() * W * 1.5;
      for (let b = 0; b < 3; b++) items.push({ x: x + (rnd() - 0.5) * 4, z: 22 + (rnd() - 0.5) * 3, h: 3.4 + rnd() * 2 });
    }
    const geo = CONE(1.1, 1, 4);
    const mat = M(0x5f8a38, { rough: 1, flat: true });
    const inst = new THREE.InstancedMesh(geo, mat, items.length);
    const m4 = new THREE.Matrix4();
    items.forEach((it, i) => { m4.makeScale(1, it.h, 1); m4.setPosition(it.x, -GROUND_Y - 1.6 + it.h / 2, it.z); inst.setMatrixAt(i, m4); });
    inst.instanceMatrix.needsUpdate = true;
    land.add(inst);
  }

  // ================= ЗАМОК =================
  // ВАЖНО: в игре стена занимает x 0..100, её большая часть уходит за левый
  // край кадра. Сдвигаем весь замок вправо на CASTLE_OX, чтобы читался
  // цельный силуэт, НО логика (WALL_X, стрелы, урон) остаётся прежней —
  // это только визуальный слой.
  const CASTLE_OX = 46;
  const castle = new THREE.Group();
  castle.position.x = CASTLE_OX;
  scene.add(castle);
  castle.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

  const wallTopY = GROUND_Y - 128;         // верх стены (в игре 168)
  const wallH = 128;

  // Стена: каменная кладка — ОДИН InstancedMesh вместо ~280 мешей.
  // Это была главная причина рывков (сотни draw call на кадр).
  {
    const rows = Math.floor(wallH / 9);
    const items = [];
    for (let r = 0; r < rows; r++) {
      const y = -GROUND_Y + 4 + r * 9;
      const rowOff = (r % 2) * 5;
      for (let x = -WALL_X + 5 + rowOff; x < WALL_X - 2; x += 10) {
        const bw = Math.min(9, WALL_X - 2 - x);
        if (bw < 2) continue;
        items.push({ x: x + bw / 2, y, w: bw, dark: rnd() > 0.82 });
      }
    }
    const geo = new THREE.BoxGeometry(1, 8.4, 13);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true });
    const inst = new THREE.InstancedMesh(geo, mat, items.length);
    const m4 = new THREE.Matrix4(), col = new THREE.Color();
    items.forEach((it, i) => {
      m4.makeScale(it.w, 1, 1);
      m4.setPosition(it.x, it.y, 0);
      inst.setMatrixAt(i, m4);
      col.setHex(it.dark ? COL.stoneD : COL.stone);
      inst.setColorAt(i, col);
    });
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    inst.castShadow = true;
    castle.add(inst);
  }
  // тёмная подложка за кладкой, чтобы не было щелей
  add(castle, BOX(WALL_X + 4, wallH, 11), M(COL.stoneD, { rough: 1 }), 0, -GROUND_Y + wallH / 2, -0.6);

  // Зубцы на стене
  for (let x = -WALL_X + 6; x < WALL_X - 4; x += 13) {
    add(castle, BOX(8, 9, 15), M(COL.stone, { rough: 0.9, flat: true }),
      x, -wallTopY - 4.5, 0);
    add(castle, BOX(8, 1.4, 15), M(COL.stoneL, { rough: 0.85 }), x, -wallTopY - 0.5, 0);
  }

  // Донжон (главная башня) за стеной — смещён правее, чтобы читался как центр композиции
  add(castle, BOX(74, 205, 50), M(COL.stone, { rough: 0.95 }), 34, -GROUND_Y + 102, -30);
  add(castle, BOX(78, 7, 54), M(COL.stoneL, { rough: 0.9 }), 34, -GROUND_Y + 208, -30);
  // угловые контрфорсы — дают объём силуэту
  add(castle, BOX(9, 205, 9), M(COL.stoneD, { rough: 1 }), -4, -GROUND_Y + 102, -6);
  add(castle, BOX(9, 205, 9), M(COL.stoneD, { rough: 1 }), 72, -GROUND_Y + 102, -6);
  // зубцы донжона
  for (let x = -4; x <= 72; x += 12) {
    add(castle, BOX(8, 9, 8), M(COL.stone, { flat: true }), x, -GROUND_Y + 216, -52);
    add(castle, BOX(8, 9, 8), M(COL.stone, { flat: true }), x, -GROUND_Y + 216, -8);
  }
  // окна донжона (светящиеся)
  const winMat = new THREE.MeshBasicMaterial({ color: 0xffc069 });
  for (const [wx, wy] of [[10, 168], [58, 168], [10, 120], [58, 120], [34, 144]]) {
    add(castle, BOX(10, 16, 2), winMat, wx, -GROUND_Y + wy, -4.2);
    // тёплый отсвет от окна на камне
    const gl = new THREE.PointLight(0xffb060, 2.2, 46, 2); gl.position.set(wx, -GROUND_Y + wy, 4); castle.add(gl);
  }

  // Круглые башни по краям стены
  const towers = [];
  // Башни ставим ЧУТЬ ВЫШЕ стены и ближе к зрителю (z=-4..6), чтобы конус стоял на площадке, а не парил.
  // Конус: основание ровно на верхнем срезе цилиндра → верх = th + 5 + 24/2.
  for (const [tx, th, tr] of [[-WALL_X + 8, 176, 15], [WALL_X - 6, 164, 13]]) {
    const baseY = -GROUND_Y + th / 2;
    add(castle, CYL(tr, tr + 1.5, th, 18), M(COL.stone, { rough: 0.95 }), tx, baseY, 0);
    const capY = -GROUND_Y + th + 2.5;
    add(castle, CYL(tr + 2.4, tr + 2.4, 5, 18), M(COL.stoneL, { rough: 0.9 }), tx, capY, 0);
    // конус садится на площадку: центр = capY + 2.5 (верх площадки) + 12 (полвысоты конуса)
    const roofY = capY + 2.5 + 12;
    add(castle, CONE(tr + 3.4, 24, 18), M(COL.roof, { rough: 0.8 }), tx, roofY, 0);
    // флаг: шест от вершины конуса вверх, флаг приклеен к шесту (не парит)
    const poleY = roofY + 12 + 8;
    add(castle, BOX(1.2, 16, 1.2), M(COL.woodD), tx, poleY, 0);
    // полотнище: крупное, ярко-красное, с золотой каймой и гербом-ромбом
    const flag = new THREE.Group();
    const cloth = M(0xe24a34, { rough: 0.6, emissive: 0x5a1608, ei: 0.85 });
    add(flag, BOX(22, 14, 1.2), cloth, 11, 0, 0);                       // полотно
    add(flag, BOX(22, 2.2, 1.4), M(COL.gold, { metal: 0.55, rough: 0.35 }), 11, 7.4, 0);   // верх. кайма
    add(flag, BOX(22, 2.2, 1.4), M(COL.gold, { metal: 0.55, rough: 0.35 }), 11, -7.4, 0);  // ниж. кайма
    add(flag, BOX(2.2, 14, 1.4), M(COL.gold, { metal: 0.55, rough: 0.35 }), 1.1, 0, 0);    // кайма у древка
    // герб: золотой ромб в центре
    add(flag, BOX(6, 6, 1.6), M(COL.gold, { metal: 0.6, rough: 0.3 }), 12, 0, 0, 0, 0, Math.PI / 4);
    // развевающийся кончик (треугольник)
    add(flag, BOX(7, 3, 1.1), cloth, 25, -2.5, 0);
    add(flag, BOX(4, 2, 1.1), cloth, 31, -5, 0);
    // навершие древка
    add(flag, SPH(2.6, 8), M(COL.gold, { metal: 0.7, rough: 0.25 }), 0, 11, 0);
    flag.position.set(tx, poleY + 3, 0);
    castle.add(flag);
    towers.push(flag);
  }

  // Ворота
  add(castle, BOX(30, 52, 4), M(COL.woodD, { rough: 1 }), 62, -GROUND_Y + 26, 6.5);
  for (let i = 0; i < 5; i++) {
    add(castle, BOX(4, 52, 1.5), M(COL.wood, { rough: 0.9 }), 50 + i * 6, -GROUND_Y + 26, 8.6);
  }
  add(castle, BOX(16, 2.4, 2), M(COL.iron, { metal: 0.5, rough: 0.5 }), 62, -GROUND_Y + 38, 9.4);

  // ================= ФАКТЕЛЫ =================
  const torches = [];
  for (const [tx, ty] of [[14, wallTopY + 2], [86, wallTopY + 2]]) {
    add(castle, CYL(1.1, 1.6, 12, 6), M(COL.woodD), tx, -ty + 6, 8);
    const flame = add(castle, SPH(2.6, 8), new THREE.MeshBasicMaterial({ color: 0xffc46a }),
      tx, -ty - 1, 8);
    const light = new THREE.PointLight(COL.torch, 6, 70, 1.9);
    light.position.set(tx, -ty + 2, 12);
    castle.add(light);
    torches.push({ light, flame, seed: tx * 0.13 });
  }

  // ================= ЛУЧНИК =================
  // Тёплый «лунный прожектор» на лучника: он стоит на тёмной стене, без
  // локального света фигура сливается с кладкой. Светильник летает вместе
  // с ним в sync() — лучник всегда освещён.
  const archerSpot = new THREE.PointLight(0xffe0b0, 4.5, 80, 1.8);
  scene.add(archerSpot);
  const archer = new THREE.Group();
  // лучник нарисован в «человеческих» единицах (торс 8x9.5) — при сцене 640x360
  // это крошка. Увеличиваем всю группу, чтобы фигура читалась силуэтом.
  archer.scale.setScalar(1.75);   // уменьшен: был крупнее врагов и «давил» сцену
  archer.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  scene.add(archer);
  {
    const skin = M(0xf2c89a, { rough: 0.7, emissive: 0x3a2010, ei: 0.9 });
    const armor = M(0xdce4f0, { rough: 0.3, metal: 0.7, emissive: 0x303a50, ei: 1.1 });
    const leather = M(0x8a5c30, { rough: 0.7, emissive: 0x2a1808, ei: 0.8 });
    const legL = add(archer, BOX(2.6, 9, 2.6), armor, -2, 4.5, 0);
    const legR = add(archer, BOX(2.6, 9, 2.6), armor, 2, 4.5, 0);
    const torso = add(archer, BOX(8, 9.5, 4.6), armor, 0, 13.5, 0);
    add(archer, BOX(9.6, 2.6, 5), M(0xb0a888, { rough: 0.5, metal: 0.4 }), 0, 18, 0);
    add(archer, SPH(2.8), skin, 0, 21.5, 0);
    add(archer, CONE(3.2, 4), armor, 0, 25, 0);
    const armL = add(archer, BOX(2.2, 8, 2.2), armor, -4.8, 14, 0);
    const armR = add(archer, BOX(2.2, 8, 2.2), armor, 4.8, 14, 0);
    // ---------- ЛУК (крупный и читаемый) ----------
    // Дуга: тор-полуокружность радиусом 11 в плоскости XY. Стоит ТОРЦОМ
    // к камере, поэтому раньше был почти невидим — поворачиваем на 90° по Y,
    // чтобы дуга читалась профилем (как у лучника, стреляющего вправо).
    const bow = new THREE.Group();
    bow.position.set(7.0, 15, 4.5);            // вынесено ВПЕРЁД и вправо — видно поверх тела
    // Дуга: тор в плоскости XY (平台上 к камере), дуга 180° открыта влево,
    // кончики вверх/вниз. Так читается классический профиль лука.
    const limb = add(bow, G('bowlimb3', () => new THREE.TorusGeometry(13, 1.7, 8, 24, Math.PI)),
      M(0x7a5430, { rough: 0.65, emissive: 0x2a1608, ei: 0.8 }), 0, 0, 0);
    limb.rotation.z = -Math.PI / 2;            // дуга открыта влево, спинка вправо
    // кончики дуги: подсвеченные накладки
    add(bow, SPH(2.1, 8), M(0xc9a44f, { metal: 0.5, rough: 0.4 }), 0, 13, 0);
    add(bow, SPH(2.1, 8), M(0xc9a44f, { metal: 0.5, rough: 0.4 }), 0, -13, 0);
    // тетива — две линии от кончиков к точке натяжения (обновляется в sync)
    const stringMat = M(0xfff4d8, { rough: 0.3, emissive: 0x666050, ei: 0.9 });
    const strA = add(bow, BOX(0.6, 1, 0.6), stringMat, 0, 0, 0);
    const strB = add(bow, BOX(0.6, 1, 0.6), stringMat, 0, 0, 0);
    // стрела: ДРЕВКО толще и светлее, наконечник с подсветкой — читается в бою
    const shaftM = M(0xffe8b8, { rough: 0.4, emissive: 0x4a3a18, ei: 0.7 });
    add(bow, CYL(0.9, 0.9, 34, 6), shaftM, 11, 0, 0, 0, 0, Math.PI / 2);
    const tipM = M(0xfff0f8, { metal: 0.8, rough: 0.2, emissive: 0x666070, ei: 1.0 });
    add(bow, CONE(2.4, 7, 6), tipM, 31, 0, 0, 0, 0, -Math.PI / 2);
    // оперение: два пера по бокам
    add(bow, BOX(5, 0.7, 3.4), M(0xd25040, { emissive: 0x30100c, ei: 0.6 }), -3, 0, 0);
    add(bow, BOX(5, 3.4, 0.7), M(0xd25040, { emissive: 0x30100c, ei: 0.6 }), -3, 0, 0);
    // рукоять
    add(bow, BOX(3, 6, 3), M(0x4a3420, { rough: 0.8 }), 5.5, 0, 0);
    bow.userData = { limb, strA, strB };
    archer.add(bow);
    // плащ
    const cape = add(archer, BOX(9, 15, 1.2), M(0x7a2f2f, { rough: 0.9 }), -1.5, 10, -2.4);
    archer.userData = { legL, legR, armL, armR, bow, cape, torso };
  }

  // ================= ПОСТРОЙКИ =================
  // Уровни построек → высота/масса. Дорисовываем только то, что куплено.
  const structGroup = new THREE.Group();
  scene.add(structGroup);
  const structNodes = new Map();      // key → Group

  const STRUCT_X = {
    healer: 40, tower: 142, catapult: 188, mage: 226,
    ballista: 268, crossbow: 308, spikes: 330, cauldron: 104,
  };

  function buildStruct(key, lvl) {
    const g = new THREE.Group();
    g.position.set(STRUCT_X[key] ?? 150, -GROUND_Y, 0);
    const k = Math.min(1, lvl / 15);
    const stoneM = M(COL.stone, { rough: 0.9, flat: true });
    const woodM = M(COL.wood, { rough: 0.9 });
    const woodD = M(COL.woodD);
    const goldM = M(COL.gold, { rough: 0.45, metal: 0.6 });

    switch (key) {
      case 'tower': {                       // башня лучников — растёт с уровнем
        const h = 54 + k * 66, w = 12 + k * 6;
        add(g, BOX(w, h, w), stoneM, 0, h / 2, 0);
        add(g, BOX(w + 4, 4, w + 4), M(COL.stoneL, { rough: 0.85 }), 0, h + 2, 0);
        for (let i = -1; i <= 1; i++) add(g, BOX(4, 6, 4), stoneM, i * (w / 2 - 1), h + 6, w / 2 - 2);
        if (lvl >= 9) add(g, CONE(w * 0.85, 22, 8), M(COL.roof, { rough: 0.8 }), 0, h + 16, 0);
        if (lvl >= 12) add(g, SPH(2.4, 8), M(0x9a4fe0, { emissive: 0x9a4fe0, ei: 1.4 }), 0, h + 30, 0);
        if (lvl >= 15) {
          add(g, CONE(3.4, 7, 6), goldM, 0, h + 34, 0);
          add(g, BOX(3, 1, 3), goldM, 0, h + 30, 0);
        }
        break;
      }
      case 'catapult': {
        add(g, BOX(26, 6, 16), woodM, 0, 3, 0);
        add(g, BOX(4, 18, 4), woodD, -6, 12, 0, 0, 0, 0.35);
        add(g, BOX(4, 18, 4), woodD, 6, 12, 0, 0, 0, -0.35);
        const arm = add(g, BOX(3, 30, 3), woodD, 0, 20, 0, 0, 0, 0.7);
        add(g, SPH(4.5, 8), M(COL.stoneD, { flat: true }), 10, 30, 0);
        for (const [wx, wz] of [[-11, -7], [11, -7], [-11, 7], [11, 7]]) {
          add(g, CYL(4.6, 4.6, 1.6, 10), woodD, wx, 5, wz, Math.PI / 2, 0, 0);
        }
        g.userData.arm = arm;
        break;
      }
      case 'ballista': {
        add(g, BOX(20, 4, 10), woodM, 0, 6, 0);
        add(g, BOX(5, 5, 5), woodD, 0, 10, 0);
        add(g, BOX(34, 1.6, 1.6), M(0x8a8578, { metal: 0.5, rough: 0.5 }), 4, 12, 0);
        add(g, G('ballista-arm', () => new THREE.TorusGeometry(11, 0.8, 5, 10, Math.PI)),
          woodD, -2, 12, 0, 0, 0, Math.PI / 2);
        for (const wz of [-5, 5]) add(g, CYL(3.6, 3.6, 1.4, 8), woodD, -7, 5, wz, Math.PI / 2, 0, 0);
        break;
      }
      case 'cauldron': {
        add(g, CYL(8, 10, 10, 12), M(COL.iron, { metal: 0.6, rough: 0.5 }), 0, 14, 0);
        const fire = add(g, SPH(4, 8), new THREE.MeshBasicMaterial({ color: 0xff9a2d }), 0, 9, 0);
        add(g, BOX(2.4, 12, 2.4), woodD, -6, 6, 0);
        add(g, BOX(2.4, 12, 2.4), woodD, 6, 6, 0);
        g.userData.fire = fire;
        break;
      }
      case 'mage': {
        const h = 60 + k * 50;
        add(g, CYL(9, 11, h, 12), M(0x4a3a6a, { rough: 0.85 }), 0, h / 2, 0);
        add(g, CONE(12, 26, 12), M(0x6a3a8a, { rough: 0.8 }), 0, h + 12, 0);
        const orb = add(g, SPH(3.6, 10), M(0x9a4fe0, { emissive: 0x9a4fe0, ei: 1.8 }), 0, h + 28, 0);
        g.userData.orb = orb;
        break;
      }
      case 'crossbow': {
        const h = 40 + k * 40;
        add(g, BOX(14, h, 14), stoneM, 0, h / 2, 0);
        add(g, BOX(40, 2.4, 3), woodD, 0, h + 4, 0);
        add(g, BOX(22, 1.6, 1.6), M(0x9aa0a8, { metal: 0.6, rough: 0.4 }), 6, h + 6.5, 0);
        break;
      }
      case 'spikes': {
        for (let i = 0; i < 7; i++) {
          add(g, CONE(1.8, 8 + k * 5, 5), M(0x9aa0a8, { metal: 0.55, rough: 0.45 }),
            (i - 3) * 6, 5, 3);
        }
        break;
      }
      case 'healer': {
        add(g, CONE(11, 18, 10), M(0xd8d0e8, { rough: 0.9 }), 0, 9, 0);
        add(g, BOX(1.6, 12, 1.6), M(0x5a8a3a), 0, 20, 0);
        add(g, BOX(7, 1.6, 1.6), M(0x5a8a3a), 0, 22, 0);
        const heal = add(g, SPH(4, 8), new THREE.MeshBasicMaterial({ color: 0x8affa0, transparent: true, opacity: 0.35 }),
          0, 13, 0);
        g.userData.heal = heal;
        break;
      }
      default:
        add(g, BOX(12, 20, 12), stoneM, 0, 10, 0);
    }
    // общий «подиум» — видно, что постройка стоит на земле
    add(g, CYL(13, 15, 3, 12), M(COL.stoneD, { rough: 1 }), 0, 1.5, 0);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    structGroup.add(g);
    structNodes.set(key, g);
    return g;
  }

  // ================= ГОРЫ / НЕБО =================
  const far = new THREE.Group();
  scene.add(far);
  // Дальний и ближний хребты: конусы с одним основанием на горизонте,
  // цвета разведены по слоям — читается atmospheric perspective
  for (let i = 0; i < 16; i++) {
    const x = i * 62 - 120;
    const h = 90 + rnd() * 120;
    add(far, CONE(52 + rnd() * 30, h, 5), M(i % 3 ? 0x4a4266 : 0x5a4e78, { flat: true, rough: 1 }),
      x, -GROUND_Y + h / 2 - 26, -150);
  }
  for (let i = 0; i < 14; i++) {
    const x = i * 74 - 80;
    const h = 60 + rnd() * 70;
    add(far, CONE(60 + rnd() * 26, h, 5), M(i % 3 ? 0x383052 : 0x453a60, { flat: true, rough: 1 }),
      x, -GROUND_Y + h / 2 - 20, -130);
  }
  // лес на горизонте
  for (let i = 0; i < 26; i++) {
    const x = rnd() * W * 1.5 - W * 0.2;
    const h = 18 + rnd() * 12;
    add(far, CONE(6 + rnd() * 3, h, 5), M(0x24321f, { flat: true, rough: 1 }),
      x, -GROUND_Y + h / 2 - 2, -115);
  }

  // ================= ДЕРЕВЬЯ (объёмные) =================
  // Настоящие 3D-деревья: ствол-цилиндр + ярусы кроны-конусы.
  // Три размера, ставятся за игровой плоскостью, но перед горами.
  const trees = [];
  {
    const trunkM = M(0x4a3320, { rough: 1, flat: true });
    const leafM = M(0x2e4a24, { rough: 0.95, flat: true });
    const leafM2 = M(0x3d6030, { rough: 0.95, flat: true });
    const spots = [];
    for (let i = 0; i < 14; i++) spots.push({ x: 150 + rnd() * (W - 130), z: 90 + rnd() * 30, s: 0.85 + rnd() * 0.5 });
    for (const t of spots) {
      const g = new THREE.Group();
      const H = 46 * t.s;
      add(g, CYL(2.2 * t.s, 3.2 * t.s, H * 0.45, 6), trunkM, 0, H * 0.22, 0);
      add(g, CONE(12 * t.s, H * 0.52, 7), leafM, 0, H * 0.5, 0);
      add(g, CONE(9.5 * t.s, H * 0.44, 7), leafM2, 0, H * 0.72, 0);
      add(g, CONE(6.5 * t.s, H * 0.36, 7), leafM, 0, H * 0.92, 0);
      g.position.set(t.x, -GROUND_Y + 1, t.z);
      g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      scene.add(g);
      trees.push({ g, s: t.s, ph: rnd() * 6.28 });
    }
  }

  // ================= ПОГОДА =================
  // Дождь: вертикальные штрихи; снег: медленные точки. Один Points-объект
  // с буфером переиспользуется — пересоздания нет, поэтому нет рывков.
  const WX_MAX = 620;
  const wxPos = new Float32Array(WX_MAX * 3);
  for (let i = 0; i < WX_MAX; i++) {
    wxPos[i * 3] = (rnd() * 2 - 1) * W * 0.9 + W * 0.5;
    wxPos[i * 3 + 1] = -rnd() * H;
    wxPos[i * 3 + 2] = 40 + rnd() * 60;
  }
  const wxGeo = new THREE.BufferGeometry();
  wxGeo.setAttribute('position', new THREE.BufferAttribute(wxPos, 3));
  const wxMat = new THREE.PointsMaterial({ color: 0xaac8ff, size: 3.2, transparent: true, opacity: 0, depthWrite: false, sizeAttenuation: false });
  const weather3d = new THREE.Points(wxGeo, wxMat);
  weather3d.frustumCulled = false;
  scene.add(weather3d);
  const wxState = { kind: 'clear', count: 0 };

  // ================= 3D-ВРАГИ (в той же сцене) =================
  // Раньше врагов рисовал отдельный канвас 640x360 — при растянутом мире
  // (1262x539) это давало рассинхрон позиций и «неправильные спавны».
  // Теперь враги живут в этой же сцене и камере: координаты совпадают 1:1.
  const units = new Map();          // id → { group, kind, phase, punch, dead }

  // звёзды: плоское поле строго внутри кадра камеры (ортокамера не
  // «видит» объекты за пределами прямоугольника 0..W / 0..-H)
  const STARS = 260, pos = new Float32Array(STARS * 3);
  for (let i = 0; i < STARS; i++) {
    pos[i * 3] = W * 0.5 + (rnd() * W - W * 0.5) * 1.28;
    pos[i * 3 + 1] = -H * 0.34 - (rnd() * H * 0.68 - H * 0.34) * 1.28;
    pos[i * 3 + 2] = -190;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
    color: 0xe8e4ff, size: 1.9, transparent: true, opacity: 0.9, depthWrite: false, sizeAttenuation: false,
  }));
  scene.add(stars);

  // луна с ореолом
  const moonPos = new THREE.Vector3(W - 124, -60, -170);
  add(scene, SPH(26, 20), new THREE.MeshBasicMaterial({ color: 0xfff3d4 }), moonPos.x, moonPos.y, moonPos.z);
  const halo = add(scene, SPH(38, 16), new THREE.MeshBasicMaterial({ color: 0xffe6a8, transparent: true, opacity: 0.10 }), moonPos.x, moonPos.y, moonPos.z);

  // Слои воздушной перспективы: полупрозрачные полосы перед горами —
  // отделяют хребты друг от друга (глубина без тумана на всю сцену)
  for (let i = 0; i < 3; i++) {
    const hazeY = -GROUND_Y + 6 + i * 14;
    add(far, G('haze' + i, () => new THREE.PlaneGeometry(W * 2.2, 30)),
      new THREE.MeshBasicMaterial({ color: 0x6a5a8a, transparent: true, opacity: 0.13 - i * 0.03, fog: false, depthWrite: false }),
      W * 0.5, hazeY, -165 + i * 18);
  }

  // тёплое свечение у горизонта — плоский диск (не полусфера, чтобы не
  // торчал «куполом» посреди горного хребта)
  const glow = add(scene, G('glowdisc', () => new THREE.CircleGeometry(130, 24)),
    new THREE.MeshBasicMaterial({ color: 0xff9a3c, transparent: true, opacity: 0.07, fog: false, depthWrite: false }),
    W * 0.55, -GROUND_Y + 6, -180);

  // ================= АНИМАЦИЯ =================
  let t = 0, lastStructSig = '';
  const tmp = new THREE.Vector3();

  return {
    scene, cam, renderer,
    /** синхронизация со состоянием игры */
    sync(state, dt) {
      t += dt;

      // --- лучник: поза, натяжение тетивы, выстрел
      const heroX = state.heroX == null ? 58 : state.heroX;
      const heroY = state.heroY == null ? wallTopY : state.heroY;
      archer.position.set(heroX, -heroY, 0);
      archerSpot.position.set(heroX + 4, -heroY + 20, 55);   // подсветка сверху-спереди
      // корпус развёрнут вправо (в сторону врагов), лук смотрит вправо
      archer.rotation.y = 0;
      const U = archer.userData;
      const pull = state.pull == null ? 0 : state.pull;
      const aim = state.aim == null ? 0 : state.aim;
      // «дыхание» + лёгкий наклон по прицелу
      archer.position.y += Math.sin(t * 2.2) * 1.1;
      archer.rotation.z = aim * 0.35;
      if (U.armL) U.armL.rotation.x = -0.35 - pull * 0.5;
      if (U.armR) U.armR.rotation.x = -0.25 - pull * 0.45;
      // тетива: кончики дуги → точка натяжения (сдвигается назад при натяге)
      const BW = U.bow ? U.bow.userData : null;
      if (BW) {
        const R = 13;
        const tipX = 0, tipY = R;                     // кончики сверху/снизу
        const nockX = -1.5 - pull * 6.5 + (state.recoil ? Math.sin(t * 40) * state.recoil * 2 : 0);
        const segs = [[tipX, tipY, nockX, 0], [tipX, -tipY, nockX, 0]];
        const nodes = [BW.strA, BW.strB];
        for (let i = 0; i < 2; i++) {
          const [ax, ay, bx, by] = segs[i];
          const node = nodes[i];
          if (!node) continue;
          const dx = bx - ax, dy = by - ay;
          const len = Math.hypot(dx, dy) || 1;
          node.position.set((ax + bx) / 2, (ay + by) / 2, 0);
          node.scale.set(0.5, len, 0.5);
          node.rotation.z = Math.atan2(dy, dx) - Math.PI / 2;
        }
      }
      if (U.cape) U.cape.rotation.x = 0.12 + Math.sin(t * 3.1) * 0.08 + (state.recoil || 0) * 0.6;

      // --- постройки: перестраиваем только при изменении уровней
      const sig = (state.structs || []).map(s => s.key + s.lvl).join(',');
      if (sig !== lastStructSig) {
        lastStructSig = sig;
        for (const s of state.structs || []) {
          const node = structNodes.get(s.key);
          if (s.lvl <= 0) { if (node) { structGroup.remove(node); structNodes.delete(s.key); } continue; }
          const prev = node?.userData.lvl ?? -1;
          if (prev !== s.lvl) {
            if (node) { structGroup.remove(node); structNodes.delete(s.key); }
            const g = buildStruct(s.key, s.lvl);
            g.userData.lvl = s.lvl;
          }
        }
      }
      // анимация построек
      for (const [, g] of structNodes) {
        if (g.userData.arm) {                                     // катапульта
          g.userData.arm.rotation.z = 0.7 + Math.sin(t * 0.9) * 0.08 + (g.userData.kick || 0);
        }
        if (g.userData.fire) g.userData.fire.scale.setScalar(0.85 + Math.sin(t * 9) * 0.15);
        if (g.userData.orb) g.userData.orb.position.y = (g.userData.orbY ?? g.userData.orb.position.y) + Math.sin(t * 2.4) * 1.4;
        if (g.userData.heal) g.userData.heal.scale.setScalar(0.9 + Math.sin(t * 2.8) * 0.12);
      }

      // --- факелы мерцают
      for (const tr of torches) {
        tr.light.intensity = 5.4 + Math.sin(t * 8.3 + tr.seed) * 1.1 + Math.sin(t * 13.7 + tr.seed) * 0.7;
        tr.flame.scale.setScalar(0.88 + Math.sin(t * 9.1 + tr.seed) * 0.16);
      }
      // --- флаги колышутся
      for (let i = 0; i < towers.length; i++) {
        towers[i].rotation.y = Math.sin(t * 2.1 + i) * 0.3;
      }
      // ---- ВРАГИ: синхронизация 3D-моделей со списком игры
      if (state.enemyList) {
        const seen = new Set();
        for (const e of state.enemyList) {
          seen.add(e.id);
          let u = units.get(e.id);
          if (!u || u.kind !== e.kind) {
            if (u) { scene.remove(u.group); }
            const group = makeUnit(e.kind, e);
            scene.add(group);
            u = { group, kind: e.kind, phase: Math.random() * 6.28, punch: 0, dead: 0 };
            units.set(e.id, u);
          }
          const g = u.group;
          g.position.set(e.x, -e.y, e.z || 0);
          const baseK = e.kind.indexOf('boss_') === 0 ? 1.45 : 1.65;   // уменьшены для читаемости сцены
          if (e.dead) u.dead += dt;
          const dieK = e.dead ? Math.max(0.01, 1 - (u.dead || 0) * 2.4) : 1;
          if (e.hitSq) u.punch = Math.max(u.punch, e.hitSq);
          if (u.punch > 0) u.punch = Math.max(0, u.punch - dt * 2.4);
          g.scale.setScalar(baseK * dieK * (1 + u.punch * 0.28) * (g.userData.scale || 1));
          g.rotation.z = -u.punch * 0.35;
          g.rotation.y = -Math.PI / 2 + (e.yaw == null ? 0.62 : e.yaw);
          const U = g.userData;
          const walk = e.walk == null ? 1 : e.walk;
          const swing = Math.sin(t * 7.5 + u.phase) * walk;
          if (U.legL) { U.legL.rotation.x = swing * 0.5; U.legR.rotation.x = -swing * 0.5; }
          if (U.armL) U.armL.rotation.x = -swing * 0.35;
          if (U.armR) U.armR.rotation.x = swing * 0.35;
          if (!U.fly) g.position.y += Math.abs(Math.sin(t * 7.5 + u.phase)) * 0.9 * walk;
          if (U.body && e.kind === 'slime') { const sq = e.sq || 0; U.body.scale.set(1 + sq, 1 - sq, 0.9); }
          if (U.wingL) {
            const f = e.kind === 'bat' ? Math.sin(t * 14 + u.phase) : Math.sin(t * 2.2 + u.phase);
            U.wingL.rotation.z = 0.45 * f; U.wingR.rotation.z = -0.45 * f;
          }
          if (U.jaw) U.jaw.rotation.x = Math.sin(t * 3 + u.phase) * 0.15;
          if (e.dead) g.rotation.z += dt * 1.5;
        }
        for (const [id, u] of units) {
          if (!seen.has(id)) { scene.remove(u.group); units.delete(id); }
        }
        window.__e3debug = { units: units.size, rendered: (window.__e3debug ? window.__e3debug.rendered + 1 : 1) };
      }

      stars.rotation.z = Math.sin(t * 0.02) * 0.01;
      halo.material.opacity = 0.08 + Math.sin(t * 0.9) * 0.02;

      // --- деревья покачиваются (2 слоя частот: ствол + крона)
      for (const tr of trees) {
        tr.g.rotation.z = Math.sin(t * 0.8 + tr.ph) * 0.018 + Math.sin(t * 1.9 + tr.ph) * 0.008;
      }

      // --- ПОГОДА в 3D
      const wkind = state.weather || 'clear';
      const isRain = /rain|storm|дождь/i.test(wkind);
      const isSnow = /snow|снег|frost/i.test(wkind);
      const targetOp = isRain ? 0.75 : isSnow ? 0.9 : 0;
      wxMat.opacity += (targetOp - wxMat.opacity) * Math.min(1, dt * 8);
      weather3d.visible = wxMat.opacity > 0.02;
      if (weather3d.visible) {
        const arr = wxGeo.attributes.position.array;
        const speed = isSnow ? 26 : 260;
        const drift = isSnow ? 12 : 18;
        for (let i = 0; i < WX_MAX; i++) {
          const iy = i * 3 + 1;
          arr[iy] += speed * dt;
          arr[i * 3] += Math.sin(t * 1.5 + i) * drift * dt;
          if (arr[iy] > 0) { arr[iy] = -H - Math.random() * 40; arr[i * 3] = (Math.random() * 2 - 1) * W * 0.9 + W * 0.5; }
        }
        wxGeo.attributes.position.needsUpdate = true;
        wxMat.size = isSnow ? 4.2 : 2.6;
        wxMat.color.setHex(isSnow ? 0xeaf4ff : 0x9ec4ff);
      }
    },
    /** Мир заполняет ВСЮ сцену: меняем aspect камеры, а не масштаб игры.
     *  Игровая плоскость 640x360 остаётся по центру, но по бокам больше мира —
     *  чёрных полос нет. */
    resize(w, h) {
      const cw = Math.max(1, w || canvas.clientWidth);
      const ch = Math.max(1, h || canvas.clientHeight);
      renderer.setSize(cw, ch, false);
      // вертикальный FOV фиксирован, поэтому высота видимой области = H,
      // а ширина = H * (cw/ch). Игровая плоскость центрируется по X.
      cam.aspect = cw / ch;
      cam.updateProjectionMatrix();
    },
    render() { renderer.render(scene, cam); },
    /** снимок кадра сразу после рендера (до очистки буфера браузером) */
    snapshot() { renderer.render(scene, cam); return canvas.toDataURL('image/png'); },
    dispose() {
      scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { Array.isArray(o.material) ? o.material.forEach(m => m.dispose()) : o.material.dispose(); } });
      renderer.dispose();
    },
    _dbg: () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles }),
  };
}
