// ============================================================
//  3D-ВРАГИ И БОССЫ (WebGL-оверлей поверх 2D-сцены)
//
//  Отдельный прозрачный канвас над игровым. Враги рисуются
//  настоящей 3D-геометрией (three.js) в ортографической камере,
//  1:1 с пиксельными координатами игры 640x360: worldX = gameX,
//  worldY = -gameY. Поэтому 3D-юниты стоят точно там, где их
//  считает игровая логика (стрелы, HP-полоски, урон) — они не
//  меняются, меняется только картинка.
//
//  Модели — процедурные (без GLB): быстрый старт, никаких
//  сюрпризов с масштабом skinned-мешей.
// ============================================================

import * as THREE from "./vendor/three/three.module.min.js";

const GROUND_Y = 296;                 // линия земли в координатах игры

// материалы кэшируем: юнитов много, а цвета повторяются
const matCache = new Map();
function mat(color, opts = {}) {
  const key = color + '|' + JSON.stringify(opts);
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color, roughness: opts.rough ?? 0.85, metalness: opts.metal ?? 0.05,
      emissive: opts.emissive ?? 0x000000, emissiveIntensity: opts.ei ?? 1,
      flatShading: !!opts.flat,
    });
    matCache.set(key, m);
  }
  return m;
}
const geoCache = new Map();
function geo(key, make) {
  let g = geoCache.get(key);
  if (!g) { g = make(); geoCache.set(key, g); }
  return g;
}
const B = (w, h, d) => geo('b' + w + '_' + h + '_' + d, () => new THREE.BoxGeometry(w, h, d));
const S = (r, seg = 12) => geo('s' + r + '_' + seg, () => new THREE.SphereGeometry(r, seg, seg));
const C = (rt, rb, h, seg = 12) => geo('c' + rt + '_' + rb + '_' + h + '_' + seg, () => new THREE.CylinderGeometry(rt, rb, h, seg));
const CONE = (r, h, seg = 12) => geo('k' + r + '_' + h + '_' + seg, () => new THREE.ConeGeometry(r, h, seg));

function mesh(g, material, x = 0, y = 0, z = 0, parent) {
  const m = new THREE.Mesh(g, material);
  m.position.set(x, y, z);
  if (parent) parent.add(m);
  return m;
}

// ---------- Типы юнитов ----------
export const UNIT_KINDS = ['soldier', 'orc', 'skeleton', 'slime', 'bat', 'ogre',
  'boss_ogre', 'boss_troll', 'boss_necro', 'boss_warlord', 'boss_dragonling'];

function makeSoldier(SKIN, ARMOR, WEAPON_METAL, scale = 1) {
  const g = new THREE.Group();
  const dark = mat(0x2a2320);
  // ноги
  const legL = mesh(B(3.2, 11, 3.2), mat(dark), -2.0, 5.5, 0, g);
  const legR = mesh(B(3.2, 11, 3.2), mat(dark), 2.0, 5.5, 0, g);
  // сапоги
  mesh(B(4, 2.6, 4.6), mat(0x1b1512), -2.0, 1.3, 0.6, legL);
  mesh(B(4, 2.6, 4.6), mat(0x1b1512), 2.0, 1.3, 0.6, legR);
  // торс
  mesh(B(9, 10, 5.4), mat(ARMOR, { rough: 0.6, metal: 0.35 }), 0, 16, 0, g);
  mesh(B(10.5, 3, 5.8), mat(ARMOR, { rough: 0.55, metal: 0.4 }), 0, 21, 0, g);   // наплечники
  // голова + шлем
  mesh(S(3.1), mat(SKIN), 0, 26.5, 0, g);
  mesh(CONE(3.6, 4.2), mat(ARMOR, { rough: 0.5, metal: 0.45 }), 0, 30.5, 0, g);
  // руки
  const armL = mesh(B(2.6, 9, 2.6), mat(ARMOR, { rough: 0.65, metal: 0.3 }), -5.4, 17, 0, g);
  const armR = mesh(B(2.6, 9, 2.6), mat(ARMOR, { rough: 0.65, metal: 0.3 }), 5.4, 17, 0, g);
  // оружие в правой руке (топор/меч)
  const wpn = new THREE.Group();
  wpn.position.set(5.4, 19, 3.2);                  // вынесено вперёд: видно в 3/4-виде
  mesh(B(1.2, 13, 1.2), mat(0x5a4026), 0, 5, 0, wpn);
  mesh(B(8, 8, 2), mat(WEAPON_METAL, { rough: 0.3, metal: 0.65 }), 2.4, 13.5, 0, wpn);
  mesh(B(2, 2, 2), mat(WEAPON_METAL, { rough: 0.3, metal: 0.65 }), 6.6, 13.5, 0, wpn);
  g.add(wpn);
  // щит в левой руке — развёрнут к камере
  const shield = mesh(B(2, 10, 8), mat(0x4a3a22, { rough: 0.8 }), -6.6, 16, 1.6, g);
  mesh(B(2.4, 2.4, 8), mat(0xc9a44f, { rough: 0.4, metal: 0.6 }), -7.2, 16, 1.6, g);

  g.userData = { legL, legR, armL, armR, wpn, shield, scale, h: 33 };
  g.scale.setScalar(scale);
  return g;
}

function makeSlime(color) {
  const g = new THREE.Group();
  const body = mesh(S(9, 14), mat(color, { rough: 0.45, emissive: color, ei: 0.12 }), 0, 6, 0, g);
  body.scale.set(1, 0.72, 0.9);
  const eyeW = mat(0xf2f7ea, { rough: 0.4 });
  const eyeB = mat(0x1a2410, { rough: 0.3 });
  mesh(S(2.4), eyeW, -3.4, 8.5, 7.4, g);
  mesh(S(2.4), eyeW, 3.0, 8.5, 7.4, g);
  mesh(S(1.2), eyeB, -3.4, 8.2, 9.4, g);
  mesh(S(1.2), eyeB, 3.0, 8.2, 9.4, g);
  g.userData = { body, h: 17 };
  return g;
}

function makeBat() {
  const g = new THREE.Group();
  mesh(S(4.6, 12), mat(0x3a2a44, { rough: 0.7 }), 0, 12, 0, g);
  const wingGeo = new THREE.PlaneGeometry(16, 9, 3, 2);
  const wingMat = mat(0x5a4468, { rough: 0.85, flat: true });
  wingMat.side = THREE.DoubleSide;
  const wingL = mesh(wingGeo, wingMat, -9, 13, 0, g);
  const wingR = mesh(wingGeo, wingMat, 9, 13, 0, g);
  wingL.rotation.y = 0.25; wingR.rotation.y = -0.25;
  mesh(S(1.2, 8), mat(0xff5a3c, { emissive: 0xff5a3c, ei: 0.9 }), -2.2, 13.5, 4, g);
  mesh(S(1.2, 8), mat(0xff5a3c, { emissive: 0xff5a3c, ei: 0.9 }), 2.2, 13.5, 4, g);
  g.userData = { wingL, wingR, h: 24, fly: true };
  return g;
}

function makeOgre(big = false, color = 0x6a9a48, eyeCol = 0xffc23d) {
  const s = big ? 1.9 : 1.35;
  const g = new THREE.Group();
  const skin = mat(color, { rough: 0.9, flat: true });
  const loin = mat(0x4a3a22);
  const legL = mesh(C(2.6, 3.2, 12, 8), skin, -4.4, 6, 0, g);
  const legR = mesh(C(2.6, 3.2, 12, 8), skin, 4.4, 6, 0, g);
  mesh(S(11.5, 12), skin, 0, 21, 0, g).scale.set(1, 0.95, 0.85);      // пузо
  mesh(B(24, 7, 13), loin, 0, 15, 0, g);                              // набедренная
  const armL = mesh(C(2.4, 2.0, 13, 8), skin, -13, 20, 0, g);
  const armR = mesh(C(2.4, 2.0, 13, 8), skin, 13, 20, 0, g);
  mesh(S(5.2, 12), skin, 0, 31, 0, g);                                // голова
  mesh(B(4.4, 2.2, 3), mat(0xe8e2d0), 0, 29, 4.6, g);                 // челюсть
  for (const ex of [-2.4, 2.4]) mesh(S(1.3, 8), mat(eyeCol, { emissive: eyeCol, ei: 0.8 }), ex, 32.5, 4.4, g);
  // дубина в правой руке
  const club = new THREE.Group();
  club.position.set(15, 24, 7);
  club.rotation.z = -0.35;                      // дубина занесена вбок, видно силуэт
  mesh(B(3, 26, 3), mat(0x6a4a2a), 0, 12, 0, club);            // рукоять
  const head = mesh(S(8, 12), mat(0x4a3420, { flat: true }), 0, 28, 0, club);
  for (const [sx, sy] of [[6, 30], [-6, 30], [0, 36], [7, 25], [-7, 25]]) {
    mesh(S(2.2, 8), mat(0x9a938a), sx, sy, 0, club);           // шипы
  }
  g.add(club);
  mesh(B(2.4, 8.5, 2.4), mat(0x8a8578, { rough: 0.5, metal: 0.4 }), -13, 26, 0, g);  // щит-пластина
  g.userData = { legL, legR, armL, armR, wpn: club, h: 36, scale: s };
  g.scale.setScalar(s);
  return g;
}

function makeTroll() {
  return makeOgre(false, 0x4a7a3a, 0x9ad0f0);
}

function makeNecro() {
  const g = new THREE.Group();
  const robe = mat(0x2a1c3a, { rough: 0.95 });
  mesh(CONE(9, 34, 14), robe, 0, 17, 0, g);                        // балахон
  mesh(S(5.4, 12), mat(0xe8e2d0, { rough: 0.7 }), 0, 33, 0, g);    // череп
  for (const ex of [-2, 2]) mesh(S(1.5, 8), mat(0x7a3aff, { emissive: 0x7a3aff, ei: 1.2 }), ex, 33.5, 4.6, g);
  const armL = mesh(B(2.6, 11, 2.6), robe, -8, 26, 0, g);
  const armR = mesh(B(2.6, 11, 2.6), robe, 8, 26, 0, g);
  const staff = new THREE.Group();
  staff.position.set(-9, 18, 4);
  mesh(B(1.4, 30, 1.4), mat(0x4a3420), 0, 0, 0, staff);
  const orb = mesh(S(3.4, 12), mat(0x9a4fe0, { emissive: 0x9a4fe0, ei: 1.6 }), 0, 16, 0, staff);
  g.add(staff);
  g.userData = { armL, armR, wpn: staff, orb, h: 40, caster: true };
  return g;
}

function makeWarlord() {
  const g = new THREE.Group();
  const plate = mat(0x6a7078, { rough: 0.45, metal: 0.55 });
  const goldTrim = mat(0xc9a44f, { rough: 0.4, metal: 0.7 });
  const legL = mesh(B(4.4, 14, 4.4), mat(0x3a3a42), -3.2, 7, 0, g);
  const legR = mesh(B(4.4, 14, 4.4), mat(0x3a3a42), 3.2, 7, 0, g);
  mesh(B(13, 15, 7), plate, 0, 22, 0, g);
  mesh(B(15, 4, 8), goldTrim, 0, 29, 0, g);
  mesh(S(4.4, 12), mat(0x7a5a3a), 0, 34.5, 0, g);
  mesh(CONE(5.4, 6, 12), plate, 0, 39, 0, g);
  for (const sx of [-16, 16]) mesh(B(3.4, 12, 3.4), plate, sx, 24, 0, g);
  // меч
  const sword = new THREE.Group();
  sword.position.set(11, 22, 3.4);
  mesh(B(1.8, 34, 3), mat(0xd8dde4, { rough: 0.25, metal: 0.8 }), 0, 16, 0, sword);
  mesh(B(9, 2, 4), goldTrim, 0, 0, 0, sword);
  g.add(sword);
  // башенный щит
  const shield = mesh(B(11, 22, 2), mat(0x8a3a2a, { rough: 0.7 }), -17, 22, 0, g);
  mesh(B(3, 22, 2.4), goldTrim, -17, 22, 0.2, g);
  g.userData = { legL, legR, wpn: sword, shield, h: 44 };
  return g;
}

function makeDragonling() {
  const g = new THREE.Group();
  const scale1 = mat(0xa03a20, { rough: 0.6, flat: true });
  const belly = mat(0xd8a05a, { rough: 0.7 });
  const body = mesh(S(11, 14), scale1, 0, 27, 0, g);
  body.scale.set(1, 0.85, 1.5);
  for (const lx of [-5, 5]) mesh(B(2.6, 9, 2.6), scale1, lx, 17, 6, g);
  mesh(S(6.6, 12), belly, 0, 22.5, 4, g).scale.set(0.8, 0.6, 1.1);
  const neck = mesh(C(2.6, 3.4, 12, 8), scale1, 0, 34, 7, g);
  neck.rotation.x = 0.5;
  const head = mesh(S(5.4, 12), scale1, 0, 40, 13, g);
  head.scale.set(1, 0.85, 1.35);
  mesh(CONE(2.4, 6, 8), mat(0x7a2a14, { flat: true }), 0, 42, 18.5, g).rotation.x = Math.PI / 2;
  for (const ex of [-2.4, 2.4]) mesh(S(1.5, 8), mat(0xffd166, { emissive: 0xffb03c, ei: 1.4 }), ex, 41, 15.5, g);
  // крылья
  const wingGeo = new THREE.PlaneGeometry(26, 16, 4, 2);
  const wingMat = mat(0x8a2a18, { rough: 0.75, flat: true });
  wingMat.side = THREE.DoubleSide;
  const wingL = mesh(wingGeo, wingMat, -13, 32, -2, g);
  const wingR = mesh(wingGeo, wingMat, 13, 32, -2, g);
  wingL.rotation.set(0.2, 0.35, 0.25);
  wingR.rotation.set(0.2, -0.35, -0.25);
  // хвост
  const tail = mesh(CONE(3.4, 20, 8), scale1, 0, 24, -12, g);
  tail.rotation.x = Math.PI / 2.1;
  g.userData = { wingL, wingR, body, head, h: 52, fly: true };
  return g;
}

export function makeUnit(kind, opts = {}) {
  switch (kind) {
    case 'slime': return makeSlime(opts.color ?? 0x79c155);
    case 'bat': return makeBat();
    case 'ogre': return makeOgre(false);
    case 'skeleton': return makeSoldier(0xe8e2d0, 0xcfc7b0, 0xb0a890, 0.95);
    case 'orc': return makeSoldier(0x6a9a48, 0x7a5a32, 0xa0a0a0, 1.05);
    case 'boss_ogre': return makeOgre(true);
    case 'boss_troll': return makeTroll();
    case 'boss_necro': return makeNecro();
    case 'boss_warlord': return makeWarlord();
    case 'boss_dragonling': return makeDragonling();
    default: return makeSoldier(0xc9a07a, 0x8a8578, 0xd8dde4);
  }
}

// ---------- Оверлей ----------
export function initEnemies3D(canvas, W = 640, H = 360) {
  if (!canvas || !window.WebGLRenderingContext) return null;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  } catch (e) { return null; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(canvas.clientWidth || W, canvas.clientHeight || H, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 2.3;

  const scene = new THREE.Scene();
  // ортокамера 1:1 с пикселями игры: world (x, -y) → экран (x, y)
  const cam = new THREE.OrthographicCamera(0, W, 0, -H, 0.1, 2000);
  cam.position.set(0, 0, 600);
  cam.lookAt(0, 0, 0);

  // свет: как в сцене осады — закатное солнце справа, холодный подсвет слева
  scene.add(new THREE.HemisphereLight(0xffc890, 0x3a3040, 1.5));
  scene.add(new THREE.AmbientLight(0x6a7a9a, 0.95));
  const sun = new THREE.DirectionalLight(0xffd8b0, 4.2); sun.position.set(0.9, 0.7, 1.4); scene.add(sun);
  const rim = new THREE.DirectionalLight(0xbcd0ff, 3.0); rim.position.set(-1, 0.5, -0.9); scene.add(rim);
  // «факел» со стороны замка: тёплый контражур, отделяет врагов от фона
  const torch = new THREE.DirectionalLight(0xff9a4a, 2.4); torch.position.set(-1, 0.3, 0.6); scene.add(torch);
  // тёплый свет от стены замка (слева), чтобы враги читались силуэтом
  const wallGlow = new THREE.PointLight(0xffa04a, 90, 260, 2.0);
  wallGlow.position.set(60, -GROUND_Y + 40, 90);
  scene.add(wallGlow);
  // ФРОНТАЛЬНЫЙ заполняющий свет (со стороны камеры): без него передние
  // грани моделей уходили в тень и враги читались чёрными силуэтами
  const fill = new THREE.DirectionalLight(0xfff0dc, 3.6); fill.position.set(0.3, 0.25, 1); scene.add(fill);
  // холодная подсветка контура — отделяет фигуру от фона
  const edge = new THREE.DirectionalLight(0x9ad0ff, 2.0); edge.position.set(-0.5, 1, 0.4); scene.add(edge);

  const units = new Map();          // id → { group, kind, data }
  let t = 0;
  window.__e3debug = { units: 0, rendered: 0, camPos: null };

  function world(x, y) { return { x, y: -y }; }

  return {
    /** синхронизировать 3D-юниты со списком врагов игры */
    sync(list, dt) {
      t += dt;
      const seen = new Set();
      for (const e of list) {
        seen.add(e.id);
        let u = units.get(e.id);
        if (!u || u.kind !== e.kind) {
          if (u) { scene.remove(u.group); }
          const group = makeUnit(e.kind, e);
          scene.add(group);
          u = { group, kind: e.kind, phase: Math.random() * 6.28, hurt: 0, dead: 0 };
          units.set(e.id, u);
        }
        const g = u.group;
        const w = world(e.x, e.y);
        g.position.set(w.x, w.y, e.z || 0);
        // масштаб: 3D-модели чуть крупнее 2D-спрайтов, чтобы читались детали
        const baseK = e.kind.startsWith('boss_') ? 1.95 : 2.2;
        const dieK = e.dead ? Math.max(0.01, 1 - (u.dead || 0) * 2.4) : 1;
        // «пунч» от удара: кратковременное раздувание + отдача корпуса назад
        if (e.hitSq) u.punch = Math.max(u.punch || 0, e.hitSq);
        if (u.punch > 0) u.punch = Math.max(0, u.punch - dt * 2.4);
        const punch = 1 + (u.punch || 0) * 0.28;
        g.scale.setScalar(baseK * dieK * punch * (g.userData.scale || 1));
        g.rotation.z = -(u.punch || 0) * 0.35;
        // лицом к замку (влево), с лёгким доворотом к камере
        // 3/4-разворот: враг смотрит на замок (влево), но корпус чуть к камере,
        // иначе оружие уходит за спину и его не видно
        g.rotation.y = -Math.PI / 2 + (e.yaw ?? 0.62);
        const U = g.userData;
        const walk = (e.walk ?? 1) * (e.speedK ?? 1);
        const swing = Math.sin(t * 7.5 + u.phase) * walk;

        if (U.legL) { U.legL.rotation.x = swing * 0.5; U.legR.rotation.x = -swing * 0.5; }
        if (U.armL) U.armL.rotation.x = -swing * 0.35;
        if (U.armR) U.armR.rotation.x = swing * 0.35;
        // дыхание/подпрыгивание
        if (!U.fly) g.position.y += Math.abs(Math.sin(t * 7.5 + u.phase)) * 0.9 * walk;

        if (U.body && e.kind === 'slime') {                 // squash & stretch
          const sq = e.sq || 0;
          U.body.scale.set(1 + sq, 1 - sq, 0.9);
        }
        if (U.wingL) {                                     // взмах крыльев
          const f = e.kind === 'bat' ? Math.sin(t * 14 + u.phase) : Math.sin(t * 2.2 + u.phase);
          U.wingL.rotation.z = 0.45 * f;
          U.wingR.rotation.z = -0.45 * f;
          U.wingL.rotation.y = 0.25 + 0.2 * f;
          U.wingR.rotation.y = -0.25 - 0.2 * f;
        }
        if (U.wpn && e.attack) U.wpn.rotation.x = -1.2 + Math.sin(t * 12) * 0.9;   // замах по стене
        else if (U.wpn) U.wpn.rotation.x *= 0.9;

        // вспышка урона: подсветка эмиссии
        if (e.hurt) u.hurt = 0.18;
        if (u.hurt > 0) {
          u.hurt -= dt;
          const k = Math.max(0, u.hurt / 0.18);
          g.traverse(o => { if (o.material && o.material.emissive && !o.userData.noFlash) { o.material.emissiveIntensity = 1 + k * 6; } });
        } else {
          g.traverse(o => { if (o.material && o.material.emissive) o.material.emissiveIntensity = 1; });
        }
        // смерть — падение и сжатие (обрабатывается в fade)
        if (e.dead) { u.dead += dt; g.rotation.z += dt * 1.5; }
      }
      // убрать исчезнувших
      for (const [id, u] of units) {
        if (!seen.has(id)) { scene.remove(u.group); units.delete(id); }
      }
    },
    resize(w, h) {
      renderer.setSize(w || canvas.clientWidth, h || canvas.clientHeight, false);
    },
    render() {
      renderer.render(scene, cam);
      window.__e3debug.rendered++;
      window.__e3debug.units = units.size;
    },
    /** отладочный доступ: проверить содержимое сцены и отрисовать вручную */
    _dbg() {
      return { renderer, scene, cam, units: units.size, drawn: renderer.info.render.calls, tris: renderer.info.render.triangles };
    },
    dispose() {
      for (const [, u] of units) scene.remove(u.group);
      units.clear();
      renderer.dispose();
    },
  };
}
