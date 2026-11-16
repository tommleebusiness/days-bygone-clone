// ============================================================
//  ГЕРОЙ НА 3D-РИГЕ (pixelfx core/rig.js)
//  Заменяет процедурного лучника из sprites.js на скелетного
//  актёра: позы натяжения лука, выстрел, удар мечом в упор,
//  получение урона. Рендер идёт в тот же пиксельный фрейм.
// ============================================================

import { createAct, poseAt, posed, STAND, READY, painterFor, stockActor } from "./vendor/pixelfx/core/index.js?v=2";
import { hex } from "./vendor/pixelfx/core/color.js?v=2";
import { spring, ease } from "./2d/anim.js?v=1";
import * as swordSlash from "./vendor/pixelfx/fx/melee/sword-slash.js?v=1";

// ---------- Позы героя-лучника ----------
// Персонаж рига смотрит вправо (+x), как и сцена осады.
// Герой стоит на стене, рука с луком тянет тетиву: pull 0..1.

const aimPose = (aim, pull, breathe) => {
  // угол прицела слегка наклоняет корпус и поднимает руки
  const tilt = Math.max(-0.5, Math.min(0.9, aim));
  const raise = Math.round(tilt * 6);
  return {
    ...STAND,
    crouch: 2 + breathe,
    lean: Math.round(tilt * 2),
    // ближняя рука тянет тетиву к груди, дальняя держит лук вперёд
    fx: 2 - Math.round(pull * 8),          // тянущая рука уходит назад при натяжении
    fy: -20 + raise + breathe,
    bx: 13,                                 // дальняя рука впереди — на луке
    by: -22 + raise + breathe,
    // лук рисуем сами (drawBow) — у рига он уходит «в торец» и не читается
    pull: pull > 0.25 ? pull : 0,           // лук натянут (стрела на тетиве при pull)
    nocked: pull < 0.95,                    // стрела видна, пока не спущена
    ffx: 6, fbx: -6,
  };
};

// поза «только что выстрелил»: рука у тетивы отскакивает
const releasePose = (aim, breathe) => ({
  ...aimPose(aim, 0, breathe),
  fx: 6, fy: -18,
  pull: 0, nocked: false,
  lean: 3,                                  // отдача корпуса
});

// поза удара мечом в упор (враг прорвался к стене)
const meleeWind = { ...READY, weapon: "sword", sa: -2.4, fx: -8, fy: -34, lean: -3, crouch: 4 };
const meleeHit  = { ...READY, weapon: "sword", sa: 0.6, fx: 18, fy: -22, lean: 4, crouch: 5, toeB: true };

// ---------- Акт: стрельба из лука (данные, как у sword-slash) ----------
export const bowAct = {
  poses: [
    [-0.25, aimPose(0, 0.9, 0)],           // натяжение перед выстрелом
    [0, releasePose(0, 0), "snap"],        // спуск
    [0.12, releasePose(0, 1)],
    [0.4, aimPose(0, 0.3, 0)],
  ],
};

// ---------- Акт: удар мечом (свой, стилизованный под осаду) ----------
export const meleeAct = {
  poses: [
    [-0.4, meleeWind],
    [-0.1, { ...meleeWind, fx: -10, fy: -36, lean: -4 }],
    [0, meleeHit, "snap"],
    [0.3, { ...READY, weapon: "sword", fx: 12, fy: -21 }],
    [0.6, { ...READY, weapon: "sword" }],
  ],
  hits: [{ t: 0.02, stop: 0.1, shake: 0.15, amp: 2, push: 2.2 }],
  dust: [{ t: 0.02, x: 14, n: 6, dir: 1 }],
};

// ---------- Состояние героя ----------
export function createHero(x, y) {
  return {
    x, y,                     // позиция ног на экране
    aim: 0,                   // угол прицела
    pull: 0,                  // натяжение 0..1
    firing: false,            // только что выстрелил
    fireT: -1,                // таймер акта выстрела
    meleeT: -1,               // таймер акта меча
    hurtT: -1,                // таймер получения урона
    time: 0,
    // 2D-анимация: пружины вторичного движения (тетива, плащ)
    string: spring(0, 320, 16),
    cape: spring(0, 90, 9),
  };
}

// обновление: вызывать каждый кадр
export function updateHero(hero, dt) {
  hero.time += dt;
  // тетива звенит после спуска, плащ колышется от выстрела/удара
  hero.string.target = 0;
  hero.string.update(dt);
  hero.cape.update(dt);
  if (hero.fireT >= 0) {
    hero.fireT += dt;
    if (hero.fireT > 0.4) hero.fireT = -1;
  }
  if (hero.meleeT >= 0) {
    hero.meleeT += dt;
    if (hero.meleeT > 0.6) hero.meleeT = -1;
  }
  if (hero.hurtT >= 0) {
    hero.hurtT += dt;
    if (hero.hurtT > 0.35) hero.hurtT = -1;
  }
}

// триггеры из игры
export function heroShoot(hero) {
  if (hero.fireT < 0) hero.fireT = 0;
  hero.firing = true;
  hero.string?.kick(-140);         // тетива дёргается назад
  hero.cape?.kick(-40);            // плащ отлетает
}
export function heroMelee(hero) {
  if (hero.meleeT < 0) hero.meleeT = 0;
  hero.cape?.kick(-70);
}
export function heroHurt(hero)  { if (hero.hurtT < 0) hero.hurtT = 0; hero.cape?.kick(-90); }

// ---------- Лук ----------
// Геометрия лука в одном месте: и рисование, и точка вылета стрелы
// считаются по этим формулам — иначе стрелы летят не из тетивы.
const BOW_OX = 7;          // смещение центра лука от центра героя
const BOW_OY = -22;        // высота лука над ступнями
export function bowCenter(x, y, aim) {
  const tilt = Math.max(-0.5, Math.min(0.9, aim));
  return { x: x + BOW_OX, y: y + BOW_OY + Math.round(tilt * 6) + 1, a: tilt * 0.55 };
}
// Точка схода стрелы: чуть впереди тетивы, на линии лука.
export function bowPoint(x, y, aim, pull = 0) {
  const c = bowCenter(x, y, aim);
  const nx = -1.5 - Math.max(0, Math.min(1, pull)) * 6.5 + 5;
  return {
    x: Math.round(c.x + nx * Math.cos(c.a)),
    y: Math.round(c.y + nx * Math.sin(c.a)),
  };
}
export function bowAnchor(hero) { return bowPoint(hero.x, hero.y, hero.aim, hero.pull); }

// Читаемый пиксельный лук в руке: дуга 26 px с тетивой, рукоятью и стрелой.
// Риговый лук чертится почти «в торец» и на экране не читается, поэтому
// здесь он рисуется отдельным спрайтом, повёрнутым на угол прицела.
const BOW_COL = {
  limb: hex('#7a5a32'), limbD: hex('#4a3420'), grip: hex('#c9a44f'),
  string: hex('#d8d0c0'), shaft: hex('#c8b48a'), head: hex('#e8e8f0'),
};
function drawBow(p, x, y, pull, aim, vib = 0, ox = 0, oy = 0) {
  // (ox, oy) — начало координат painter'а (place() = ноги героя).
  // put() ждёт ЭКРАННЫЕ координаты, а line() — ЛОКАЛЬНЫЕ (сам прибавит ox/oy),
  // поэтому для line() вычитаем начало координат.
  // ВАЖНО: painter.place(x,y) активен. put() ждёт ЭКРАННЫЕ координаты
  // (трансформацию применяем вручную через rot), а line() ждёт ЛОКАЛЬНЫЕ —
  // он сам прибавляет tx/ty внутри. Раньше в line передавали экранные
  // координаты, и тетива/стрела уезжали на дорогу с двойным смещением.
  const a = Math.max(-0.5, Math.min(0.9, aim)) * 0.55;   // наклон по углу прицела
  const ca = Math.cos(a), sa = Math.sin(a);
  const rot = (dx, dy) => [Math.round(dx * ca - dy * sa), Math.round(dx * sa + dy * ca)];
  const H = 13;                                          // половина длины лука
  // ---- дуга (лимб): выгиб вперёд, толщиной в два тона (put = экранные)
  for (let t = -H; t <= H; t++) {
    const u = t / H;
    const bow = 4.5 * (1 - u * u);
    const r1 = rot(bow, t), r2 = rot(bow - 1, t);
    p.put(x + r1[0], y + r1[1], BOW_COL.limb);
    p.put(x + r2[0], y + r2[1], BOW_COL.limbD);
  }
  // ---- тетива и стрела: p.line() рисует ОТНОСИТЕЛЬНО place() (ноги героя),
  // а не центра лука! Раньше не добавляли (BOW_OX, BOW_OY) — тетива
  // рисовалась на 16px левее и ниже центра, «у пояса». Теперь всё line()
  // смещаем на локальный центр лука (cx, cy) относительно ног.
  const gx = (px) => px - ox, gy = (py) => py - oy;   // экранные → локальные для line()
  const nx = -1.5 - pull * 6.5 + vib;
  const tT = rot(0, -H), tB = rot(0, H), nk = rot(nx, 0);
  p.line(gx(x + tT[0]), gy(y + tT[1]), gx(x + nk[0]), gy(y + nk[1]), BOW_COL.string, 1);
  p.line(gx(x + tB[0]), gy(y + tB[1]), gx(x + nk[0]), gy(y + nk[1]), BOW_COL.string, 1);
  // ---- рукоять
  const gk = rot(3, 0);
  p.put(x + gk[0], y + gk[1], BOW_COL.grip);
  p.put(x + gk[0], y + gk[1] + 1, BOW_COL.grip);
  p.put(x + gk[0], y + gk[1] - 1, BOW_COL.grip);
  // ---- стрела на тетиве (пока не спущена)
  if (pull < 0.95) {
    const a1 = rot(nx, 0), a2 = rot(nx + 11, 0), a3 = rot(nx + 12, 0);
    p.line(gx(x + a1[0]), gy(y + a1[1]), gx(x + a2[0]), gy(y + a2[1]), BOW_COL.shaft, 1);
    p.put(x + a3[0], y + a3[1], BOW_COL.head);
  }
}

// ---------- Отрисовка ----------
// Рисует героя в пиксельный фрейм игры. painter — painterFor(frame),
// уже placed на (0,0); рисуем напрямую в frame.color через posed().
// Мы рисуем сами (без createAct), т.к. герой управляется игровым кодом.
export function drawHero(frame, hero, gear = null) {
  const breathe = Math.round(Math.sin(hero.time * 2.2));
  const p = painterFor(frame);
  p.place(hero.x, hero.y);

  // какой акт сейчас играет
  let pose;
  if (hero.meleeT >= 0) {
    pose = poseAt(meleeAct.poses, Math.min(hero.meleeT, 0.6));
  } else if (hero.fireT >= 0) {
    // акт выстрела: натяжение → спуск → возврат
    const t = hero.fireT;
    if (t < 0.06) pose = aimPose(hero.aim, Math.max(hero.pull, 1 - t / 0.06 * 0), breathe);
    else if (t < 0.18) pose = releasePose(hero.aim, breathe);
    else pose = aimPose(hero.aim, hero.pull, breathe);
  } else {
    pose = aimPose(hero.aim, hero.pull, breathe);
  }

  // если герой ранен — откинуться назад
  if (hero.hurtT >= 0) {
    const k = 1 - hero.hurtT / 0.35;
    pose = { ...pose, lean: (pose.lean ?? 0) - Math.round(k * 6), crouch: (pose.crouch ?? 0) + Math.round(k * 3), x: -(1 - k) * 3 };
  }

  // ---- ПЛАЩ (вторичное движение на пружине, за телом) ----
  {
    const cw = Math.round((hero.cape?.value || 0) * 0.12);      // −20..+20 → −2..+2 px
    const baseX = hero.x - 7, baseY = hero.y + 1;
    const col = hex('#7a2f2f'), colD = hex('#4a1c1c');
    for (let j = 0; j < 15; j++) {
      const sway = Math.round(Math.sin(hero.time * 3 + j * 0.5) * 1.1 + cw * (j / 15) * 1.6);
      const wdt = Math.max(1, 6 - Math.round(j / 4));
      for (let dx = 0; dx < wdt; dx++) {
        p.put(baseX - dx + sway, baseY - 13 + j, dx >= wdt - 1 ? colD : col);
      }
    }
  }

  const r = posed(pose);
  // Координаты рига: ступни в (0,0), тело уходит вверх (y<0), низ фигуры ys=-1.
  // Значит пиксель кладём на hero.y + ys + 1: подошва встаёт ровно на hero.y
  // (уровень верха стены), фигура полностью над линией — больше не парит.
  for (let i = 0; i < r.n; i++) {
    p.put(hero.x + r.xs[i] - 6, hero.y + r.ys[i] + 1, r.color[i]);
  }

  // ЛУК в дальней руке: позиция берётся из позы (bx, by — рука на луке)
  {
    // дрожание тетивы: пружина даёт ±несколько px сразу после выстрела
    const vib = Math.max(-1.5, Math.min(1.5, (hero.string?.value || 0) * 0.02));
    const bc = bowCenter(hero.x, hero.y, hero.aim);
    drawBow(p, bc.x, bc.y, pose.pull || 0, hero.aim, vib, hero.x, hero.y);
  }

  // тень у ног
  for (let dx = -9; dx <= 9; dx++) {
    const k = 1 - Math.abs(dx) / 10;
    if (k > 0) p.put(hero.x + dx - 6, hero.y + 1, 0x40281a10, 0.4 * k);
  }

  // экипировка: аура редких предметов поверх рига
  if (gear && gear.aura && gear.aura.k > 0) {
    const k = gear.aura.k, ac = gear.aura.col;
    const pulse = 0.5 + 0.5 * Math.sin(hero.time * 3);
    for (let i = 0; i < 10; i++) {
      const a = i * Math.PI / 5 + hero.time * 0.8;
      const rx = Math.round(Math.cos(a) * 16), ry = Math.round(Math.sin(a) * 6);
      p.add(hero.x + rx, hero.y - 20 + ry, ac, (0.35 + 0.35 * pulse) * k);
    }
  }
  return pose;
}
