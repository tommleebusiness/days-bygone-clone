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
  stone: 0x8d8578, stoneD: 0x655e52, stoneL: 0xa9a294,
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
  scene.fog = new THREE.FogExp2(0x241a30, 0.00055);

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
  scene.add(new THREE.HemisphereLight(0xffd8a8, 0x3a3048, 1.5));
  scene.add(new THREE.AmbientLight(0x8494b8, 1.0));

  const sun = new THREE.DirectionalLight(0xffd0a0, 3.0);
  sun.position.set(-0.55, 0.75, 1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  const sc = sun.shadow.camera;
  sc.left = -W * 0.6; sc.right = W * 0.6; sc.top = H; sc.bottom = -H;
  sc.near = -400; sc.far = 1200;
  sun.shadow.bias = -0.0012;
  scene.add(sun);
  const sunTgt = new THREE.Object3D();
  sunTgt.position.set(W * 0.35, -GROUND_Y, 0);
  scene.add(sunTgt);
  sun.target = sunTgt;

  const rim = new THREE.DirectionalLight(0x9ab4ff, 1.7);
  rim.position.set(1, 0.4, -1);
  scene.add(rim);

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

  // Поверхность земли: настоящая горизонтальная плоскость от дальнего края
  // до переднего. При наклонной камере видна её поверхность — уходит вдаль.
  add(land, G('groundtop', () => new THREE.PlaneGeometry(W * 2.6, 300, 1, 1)),
    M(COL.dirt, { rough: 1 }), W * 0.5, -GROUND_Y - 1.5, -80,
    -Math.PI / 2, 0, 0);
  // вертикальный срез грунта спереди (торец плиты у нижней кромки кадра)
  add(land, BOX(W * 2.6, 26, 2), M(COL.dirtD, { rough: 1 }),
    W * 0.5, -GROUND_Y - 14, 68);
  // тёмная полоса глубины внизу
  add(land, BOX(W * 2.2, 16, 35), M(COL.dirtD, { rough: 1 }),
    W * 0.5, -H - 4, 0.5);
  // верхняя кромка ground: светлая «поверхность», чуть выступает вперёд
  add(land, BOX(W * 2.2, 3, 40), M(0x5c4630, { rough: 1 }), W * 0.5, -GROUND_Y + 1, 1);

  // полоса травы на линии земли
  const grassStrip = add(land, BOX(W * 2.2, 3, 42), M(COL.grass, { rough: 1 }), W * 0.55, -GROUND_Y - 1, 2);

  // комья земли и камни (детерминированно, без Math.random в кадре)
  let seed = 1337;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let i = 0; i < 90; i++) {
    const x = rnd() * W * 1.6 - W * 0.1;
    const z = rnd() * 16 - 8;
    const r = 1.2 + rnd() * 2.6;
    const isRock = rnd() > 0.55;
    const m = add(land, SPH(r, 6), M(isRock ? 0x8d8578 : 0x6a5238, { flat: true, rough: 1 }),
      x, -GROUND_Y + 3 + r * 0.35, 20 + (z * 0.4));
    m.scale.set(1, 0.55, 1);
    m.castShadow = false;
  }
  // редкие пучки травы
  for (let i = 0; i < 46; i++) {
    const x = rnd() * W * 1.5;
    const z = rnd() * 12 - 6;
    for (let b = 0; b < 3; b++) {
      add(land, CONE(1.1, 3.4 + rnd() * 2, 4), M(0x5f8a38, { rough: 1, flat: true }),
        x + (rnd() - 0.5) * 4, -GROUND_Y - 1.6, 22 + (rnd() - 0.5) * 3);
    }
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

  const wallTopY = GROUND_Y - 128;         // верх стены (в игре 168)
  const wallH = 128;

  // Стена: каменная кладка блоками (объём)
  const brickRows = Math.floor(wallH / 9);
  for (let r = 0; r < brickRows; r++) {
    const y = -GROUND_Y + 4 + r * 9;
    const rowOff = (r % 2) * 5;
    for (let x = -WALL_X + 5 + rowOff; x < WALL_X - 2; x += 10) {
      const bw = Math.min(9, WALL_X - 2 - x);
      if (bw < 2) continue;
      const shade = rnd() > 0.82 ? COL.stoneD : COL.stone;
      add(castle, BOX(bw, 8.4, 13), M(shade, { rough: 0.95, flat: true }),
        x + bw / 2, y, 0);
    }
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
    const flag = add(castle, BOX(11, 7, 0.8), M(COL.gold, { rough: 0.6, metal: 0.3 }),
      tx + 6, poleY + 5, 0);
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
  const archer = new THREE.Group();
  scene.add(archer);
  {
    const skin = M(0xc9a07a, { rough: 0.8 });
    const armor = M(0x8f96a0, { rough: 0.45, metal: 0.6 });
    const leather = M(0x5a3f22, { rough: 0.85 });
    const legL = add(archer, BOX(2.6, 9, 2.6), armor, -2, 4.5, 0);
    const legR = add(archer, BOX(2.6, 9, 2.6), armor, 2, 4.5, 0);
    const torso = add(archer, BOX(8, 9.5, 4.6), armor, 0, 13.5, 0);
    add(archer, BOX(9.6, 2.6, 5), M(0xb0a888, { rough: 0.5, metal: 0.4 }), 0, 18, 0);
    add(archer, SPH(2.8), skin, 0, 21.5, 0);
    add(archer, CONE(3.2, 4), armor, 0, 25, 0);
    const armL = add(archer, BOX(2.2, 8, 2.2), armor, -4.8, 14, 0);
    const armR = add(archer, BOX(2.2, 8, 2.2), armor, 4.8, 14, 0);
    // лук в дальней руке
    const bow = new THREE.Group();
    bow.position.set(5.6, 14, 1.5);
    bow.rotation.z = -0.25;
    add(bow, G('bowlimb', () => new THREE.TorusGeometry(9, 0.9, 6, 14, Math.PI * 1.15)),
      leather, 0, 0, 0, 0, 0, Math.PI * 0.42);
    add(bow, BOX(0.35, 19, 0.35), M(0xe8e0cc), 0, 0, 0);
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

      // --- лучник: поза, натяжение, выстрел
      const heroX = state.heroX ?? 58, heroY = state.heroY ?? wallTopY;
      archer.position.set(heroX, -heroY, 0);
      archer.rotation.y = -0.55 + (state.aim ?? 0) * 0.25;
      const U = archer.userData;
      const pull = state.pull ?? 0;
      const breathe = Math.sin(t * 2.2) * 1.2;
      archer.position.y += breathe;
      if (U.armL) U.armL.rotation.x = -0.5 - pull * 0.35;
      if (U.armR) U.armR.rotation.x = -0.4 - pull * 0.3;
      if (U.bow) U.bow.rotation.z = -0.25 + (state.aim ?? 0) * 0.4;
      if (U.cape) U.cape.rotation.x = 0.1 + Math.sin(t * 3.1) * 0.07 + (state.recoil ?? 0) * 0.5;

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
      stars.rotation.z = Math.sin(t * 0.02) * 0.01;
      halo.material.opacity = 0.08 + Math.sin(t * 0.9) * 0.02;
    },
    resize(w, h) {
      renderer.setSize(w || canvas.clientWidth, h || canvas.clientHeight, false);
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
