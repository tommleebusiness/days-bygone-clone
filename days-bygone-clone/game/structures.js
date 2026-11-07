// Оборонительные сооружения: катапульта, баллиста, котёл масла.
// Каждое: { key, lvl } — lvl 0 = не построено. Покупка/апгрейд из магазина.

import { hex } from "./vendor/pixelfx/core/color.js?v=2";

const COL = {
  wood: hex('#7a5a32'), woodD: hex('#57401f'), woodDD: hex('#3a2a14'),
  rope: hex('#b0a070'), iron: hex('#5a5560'), ironL: hex('#837c8c'),
  steel: hex('#e8e8f0'), rock: hex('#6b6153'), rockD: hex('#4a4238'),
  pot: hex('#26221e'), potL: hex('#3d3830'), fire: hex('#f26a1d'),
  fireL: hex('#ffc23d'), oil: hex('#4a5a20'), flame: hex('#ff9a2d'),
};

export const STRUCT_DEFS = [
  {
    key: 'catapult', name: 'Катапульта', x: 188, y: null,
    desc: 'Валун по площади врагов',
    baseCost: 350, costGrowth: 2.3,
    cd: () => Math.max(2.5, 7 - 0.55 * 0), // задаётся уровнем в cdFor
    dmg: (lvl) => 40 * Math.pow(1.7, lvl - 1),
    radius: 24,
  },
  {
    key: 'ballista', name: 'Баллиста', x: 268, y: null,
    desc: 'Пробивной болт навылет',
    baseCost: 500, costGrowth: 2.4,
    dmg: (lvl) => 70 * Math.pow(1.75, lvl - 1),
  },
  {
    key: 'cauldron', name: 'Котёл масла', x: 104,
    desc: 'Поджигает врагов у стены',
    baseCost: 420, costGrowth: 2.4,
    dmg: (lvl) => 12 * Math.pow(1.6, lvl - 1), // урон/сек горения
  },
  {
    key: 'tower', name: 'Башня лучников', x: 142,
    desc: 'Собственный лучник бьёт точно',
    baseCost: 650, costGrowth: 2.5,
    dmg: (lvl) => 30 * Math.pow(1.7, lvl - 1),
  },
  {
    key: 'mage', name: 'Башня мага', x: 226,
    desc: 'Огненный шар взрывается по площади',
    baseCost: 800, costGrowth: 2.5,
    dmg: (lvl) => 55 * Math.pow(1.75, lvl - 1),
    radius: 18,
  },
  {
    key: 'spikes', name: 'Шипы у стены', x: 330,
    desc: 'Ранит врагов, подошедших вплотную',
    baseCost: 300, costGrowth: 2.2,
    dmg: (lvl) => 25 * Math.pow(1.6, lvl - 1),
  },
  {
    key: 'crossbow', name: 'Арбалетная башня', x: 308,
    desc: 'Скорострельный залп арбалета',
    baseCost: 900, costGrowth: 2.5,
    dmg: (lvl) => 45 * Math.pow(1.68, lvl - 1),
  },
  {
    key: 'healer', name: 'Лагерь лекаря', x: 48,
    desc: 'Постоянно чинит стены замка',
    baseCost: 700, costGrowth: 2.6,
    heal: (lvl) => 10 * Math.pow(1.5, lvl - 1),
  },
];

export function structCost(def, lvl) {
  return Math.ceil(def.baseCost * Math.pow(def.costGrowth, lvl));
}
export function structCd(def, lvl) {
  if (def.key === 'crossbow') return Math.max(0.8, 2.6 - 0.25 * (lvl - 1));
  if (def.key === 'healer') return Math.max(2.5, 6 - 0.5 * (lvl - 1));
  if (def.key === 'catapult') return Math.max(2.2, 7 - 0.6 * (lvl - 1));
  if (def.key === 'ballista') return Math.max(1.8, 5.5 - 0.5 * (lvl - 1));
  if (def.key === 'tower') return Math.max(1.2, 3.2 - 0.25 * (lvl - 1));
  if (def.key === 'mage') return Math.max(2.0, 5.5 - 0.5 * (lvl - 1));
  if (def.key === 'spikes') return Math.max(1.5, 3.5 - 0.3 * (lvl - 1));
  return Math.max(2.5, 6.5 - 0.55 * (lvl - 1));
}

export function createStructures() {
  return STRUCT_DEFS.map(def => ({ key: def.key, lvl: 0, cd: 0, anim: 0 }));
}

// ctx: { enemies, damageEnemy(e, dmg), spawnFx, shake(v), time, structDmgMult, structCdMult, structFreeze }
export function updateStructures(dt, structs, ctx) {
  const live = ctx.enemies.filter(e => !e.dead && e.x > 100);
  for (const s of structs) {
    if (s.lvl <= 0) continue;
    const def = STRUCT_DEFS.find(d => d.key === s.key);
    if (s.anim > 0) s.anim -= dt;
    s.cd -= dt;
    if (s.cd > 0) continue;

    if (s.key === 'catapult') {
      // цель — самый плотный кластер врагов
      let best = null, bestScore = 0;
      for (const e of live) {
        if (e.x < 90) continue;
        let score = 0;
        for (const o of live) if (Math.abs(o.x - e.x) < 26) score++;
        if (score > bestScore) { bestScore = score; best = e; }
      }
      if (!best) continue;
      s.cd = structCd(def, s.lvl) * (ctx.structCdMult || 1);
      s.anim = 0.4;
      const T = 1.1, g = 140;
      ctx.projectiles.push({
        kind: 'rock', x: def.x + 4, y: 296 - 86,
        vx: (best.x - def.x - 4) / T,
        vy: ((best.y - 4) - (296 - 86) - 0.5 * g * T * T) / T, g,
        dmg: def.dmg(s.lvl) * (ctx.structDmgMult || 1), radius: def.radius * 2,
      });
    } else if (s.key === 'ballista') {
      const target = live.find(e => e.x > 244);
      if (!target) continue;
      s.cd = structCd(def, s.lvl) * (ctx.structCdMult || 1);
      s.anim = 0.3;
      ctx.projectiles.push({
        kind: 'bolt', x: def.x + 8, y: 296 - 90, vx: 600, vy: 0,
        dmg: def.dmg(s.lvl) * (ctx.structDmgMult || 1), pierce: true,
      });
    } else if (s.key === 'cauldron') {
      if (!live.some(e => e.x < 184)) continue;
      s.cd = structCd(def, s.lvl) * (ctx.structCdMult || 1);
      s.anim = 0.5;
      const dps = def.dmg(s.lvl) * (ctx.structDmgMult || 1);
      for (const e of live) if (e.x < 184) e.burn = { t: 3, dps, tick: 0 };
      ctx.spawnFx('fire', 121, 296 - 70);
      ctx.shake(0.15);
    } else if (s.key === 'tower') {
      // башенный лучник: навесная стрела по ближайшему врагу
      let target = null;
      for (const e of live) if (e.x > 140 && (!target || e.x < target.x)) target = e;
      if (!target) continue;
      s.cd = structCd(def, s.lvl) * (ctx.structCdMult || 1);
      s.anim = 0.25;
      const T = 0.75, g = 150;
      const sx = def.x + 8, sy = 296 - 138;
      ctx.projectiles.push({
        kind: 'tarrow', x: sx, y: sy,
        vx: (target.x - sx) / T,
        vy: ((target.y - 6) - sy - 0.5 * g * T * T) / T, g,
        dmg: def.dmg(s.lvl) * (ctx.structDmgMult || 1),
        hitSet: new Set(),
      });
    } else if (s.key === 'mage') {
      // огненный шар по ближайшей группе врагов
      let best = null, bestScore = 0;
      for (const e of live) {
        if (e.x < 200) continue;
        let score = 0;
        for (const o of live) if (Math.abs(o.x - e.x) < def.radius * 2) score++;
        if (score > bestScore) { bestScore = score; best = e; }
      }
      if (!best) continue;
      s.cd = structCd(def, s.lvl) * (ctx.structCdMult || 1);
      s.anim = 0.35;
      const T = 0.9, g = 130;
      const sx = def.x + 12, sy = 296 - 126;
      ctx.projectiles.push({
        kind: 'fireball', x: sx, y: sy,
        vx: (best.x - sx) / T,
        vy: ((best.y - 6) - sy - 0.5 * g * T * T) / T, g,
        dmg: def.dmg(s.lvl) * (ctx.structDmgMult || 1), radius: def.radius * 2,
      });
    } else if (s.key === 'crossbow') {
      const target = live.find(e => e.x > def.x - 10);
      if (!target) continue;
      s.cd = structCd(def, s.lvl) * (ctx.structCdMult || 1);
      s.anim = 0.22;
      const T = 0.55, g = 90;
      const sx = def.x + 12, sy = 296 - 110;
      ctx.projectiles.push({
        kind: 'bolt', x: sx, y: sy,
        vx: (target.x - sx) / T,
        vy: ((target.y - 6) - sy - 0.5 * g * T * T) / T, g,
        dmg: def.dmg(s.lvl) * (ctx.structDmgMult || 1),
        hitSet: new Set(),
      });
    } else if (s.key === 'healer') {
      const healed = ctx.healCastle ? ctx.healCastle(def.heal(s.lvl)) : 0;
      if (healed <= 0) { s.cd = 0.5; continue; }  // стены целы — ждём
      s.cd = structCd(def, s.lvl) * (ctx.structCdMult || 1);
      s.anim = 0.5;
      ctx.spawnFx('hit', 30, 140);
    } else if (s.key === 'spikes') {
      // периодически ранит всех врагов в зоне шипов
      const zone = live.filter(e => e.x > def.x - 24 && e.x < def.x + 32);
      if (!zone.length) continue;
      s.cd = structCd(def, s.lvl) * (ctx.structCdMult || 1);
      s.anim = 0.3;
      const dmg = def.dmg(s.lvl) * (ctx.structDmgMult || 1);
      for (const e of zone) ctx.damageEnemy(e, dmg);
      ctx.spawnFx('boom', def.x + 4, 294);
    }
  }

  // горение
  for (const e of ctx.enemies) {
    if (e.burn && !e.dead) {
      e.burn.t -= dt; e.burn.tick -= dt;
      if (e.burn.tick <= 0) { e.burn.tick = 0.5; ctx.damageEnemy(e, e.burn.dps * 0.5); }
      if (e.burn.t <= 0) e.burn = null;
    }
  }

  // снаряды
  const ps = ctx.projectiles;
  for (let i = ps.length - 1; i >= 0; i--) {
    const p = ps[i];
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.g) p.vy += p.g * dt;
    if (p.kind === 'rock' || p.kind === 'fireball') {
      const ty = 296 - 4;
      if (p.y >= ty || p.x > 650) {
        ctx.spawnFx('boom', Math.round(p.x), Math.round(ty - 4));
        ctx.shake(0.3);
        for (const e of live) {
          if (Math.abs(e.x - p.x) < p.radius) {
            ctx.damageEnemy(e, p.dmg);
          if (ctx.structFreeze && !e.isBoss) e.frozen = 1.6;
            if (ctx.structFreeze && !e.isBoss) e.frozen = 1.6;
          }
        }
        ps.splice(i, 1);
      }
    } else {
      for (const e of live) {
        if (!p.hitSet) p.hitSet = new Set();
        if (p.hitSet.has(e)) continue;
        if (Math.abs(p.x - e.x) < 12 && p.y > e.y - 32 && p.y < e.y + 4) {
          p.hitSet.add(e);
          ctx.damageEnemy(e, p.dmg);
          ctx.spawnFx('hit', Math.round(p.x), Math.round(p.y));
        }
      }
      if (p.x > W_LIMIT || p.y > 300) ps.splice(i, 1);
    }
  }
}
const W_LIMIT = 690;

function rect(p, x, y, w, h, col) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) p.put(x + i, y + j, col);
}


// ====== Отрисовка: сооружения пристроены к замку (рампорт + башни) ======
// G2 — уровень площадки рампорта, на которой стоят постройки.
const G = 296, G2 = 236;

function rampart(p, t) {
  // КОРОТКИЙ рампорт: от замка (x=92) до x=344. Псевдо-3D:
  //  - верхняя грань (яркая, «плита»),
  //  - передняя стенка (кладка),
  //  - тёмная боковая грань справа (глубина).
  const X1 = 92, X2 = 344;

  // передняя стенка
  rect(p, X1, G2 + 2, X2 - X1, G - G2 - 2, hex('#6e6758'));
  // кладка: ряды по 12 с вертикальными швами
  for (let row = 0; row * 12 < G - G2; row++) {
    const yy = G2 + 6 + row * 12;
    for (let x = X1; x < X2; x++) p.put(x, yy, hex('#544d40'));
    for (let x = X1 + ((row % 2) ? 0 : 11); x < X2; x += 22)
      for (let y = yy + 1; y < yy + 12 && y < G; y++) p.put(x, y, hex('#544d40'));
    // лёгкий блик на верхней кромке каждого ряда
    for (let x = X1; x < X2; x += 4) p.put(x, yy - 1, hex('#7d7666'), 0.5);
  }

  // ВЕРХНЯЯ ГРАНЬ («плита»): светлая полоса + фаска
  for (let x = X1; x < X2; x++) {
    p.put(x, G2 - 1, hex('#bdb7a8'));
    p.put(x, G2,     hex('#a29c8e'));
    p.put(x, G2 + 1, hex('#7a7466'));
  }
  // фаска на стыке верхней и передней грани — тёмная линия
  for (let x = X1; x < X2; x++) p.put(x, G2 + 2, hex('#4a4438'));

  // БОКОВАЯ ГРАНЬ справа: узкая тёмная полоса (глубина)
  for (let y = G2 - 1; y < G; y++) {
    p.put(X2 - 4, y, hex('#4f4a3e'));
    p.put(X2 - 3, y, hex('#443f34'));
    p.put(X2 - 2, y, hex('#3a352c'));
  }

  // зубцы: у каждого видна фронтальная и верхняя плоскость
  for (let x = X1 + 3; x < X2 - 9; x += 17) {
    const w = 8;
    // фронт
    rect(p, x, G2 - 7, w, 9, hex('#7a7466'));
    for (let row = 0; row < 9; row += 4)
      for (let i = 0; i < w; i++) p.put(x + i, G2 - 7 + row, hex('#5f594b'));
    // верх (светлый)
    for (let i = 0; i < w; i++) p.put(x + i, G2 - 8, hex('#c2bcad'));
    // правый торец (тень)
    for (let y = G2 - 8; y < G2 + 2; y++) p.put(x + w, y, hex('#413c31'));
    // левый блик
    for (let y = G2 - 6; y < G2 + 1; y++) p.put(x, y, hex('#96907f'));
  }

  // подтёки и трещины на передней стенке
  p.line(130, G2 + 16, 134, G2 + 30, hex('#4d4738'));
  p.line(132, G2 + 30, 130, G2 + 42, hex('#4d4738'));
  p.line(205, G2 + 12, 202, G2 + 26, hex('#4d4738'));
  p.line(290, G2 + 22, 294, G2 + 40, hex('#4d4738'));
  p.dot(170, G2 + 8, hex('#9a9487'), 0.45);
  p.dot(250, G2 + 36, hex('#9a9487'), 0.35);
  // влажный мох у подножия
  for (let x = X1 + 6; x < X2 - 6; x += 9) p.dot(x, G - 6 - ((x * 7) % 5), hex('#4a5a2a'), 0.5);
}

// Надстройки по уровню: высота, зубцы, флаги, золото

// ---- хелперы псевдо-3D ----
function shade(p, x, y, w) {
  // мягкая тень на земле/плите
  for (let i = 0; i < w; i++) {
    const a = 0.30 + 0.10 * Math.sin((i / w) * Math.PI);
    p.dot(x - Math.round(w / 2) + i, y, hex('#14100a'), a);
  }
}
function beamH(p, x, y, w) {
  // горизонтальная деревянная балка: верхний блик, середина, нижняя тень
  for (let i = 0; i < w; i++) {
    p.put(x + i, y, hex('#8a5a30'));
    p.put(x + i, y + 1, (i % 3 === 0) ? hex('#6e4522') : hex('#7a4e28'));
    p.put(x + i, y + 2, hex('#4a3018'));
  }
}
function beamV(p, x, y, h) {
  // вертикальная балка: левый блик, правый торец в тени
  for (let i = 0; i < h; i++) {
    p.put(x, y + i, hex('#8a5a30'));
    p.put(x + 1, y + i, (i % 2) ? hex('#7a4e28') : hex('#6e4522'));
    p.put(x + 2, y + i, hex('#4a3018'));
  }
}
function stoneFace(p, x, y, w, h, base, dark, light) {
  // каменный блок: фасад + светлая верхняя кромка + тёмный правый торец
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) p.put(x + i, y + j, base);
  for (let i = 0; i < w; i++) p.put(x + i, y, light);
  for (let j = 0; j < h; j++) p.put(x + w - 1, y + j, dark);
  for (let i = 0; i < w; i += 6) for (let j = 3; j < h; j += 6) p.put(x + i, y + j, dark);
}


function platform(p, x, w, y = G2) {
  // тёмная деревянная платформа: отделяет постройку от камня
  for (let i = -Math.round(w / 2); i < Math.round(w / 2); i++) {
    p.put(x + i, y + 1, hex('#2b2216'));
    p.put(x + i, y + 2, hex('#1e1810'));
  }
  for (let i = -Math.round(w / 2); i < Math.round(w / 2); i += 5) {
    p.put(x + i, y + 1, hex('#4a3a22'));
  }
  // опоры
  p.put(x - Math.round(w / 2), y + 3, hex('#1e1810'));
  p.put(x + Math.round(w / 2) - 1, y + 3, hex('#1e1810'));
}

function lvlStyle(lvl) {
  return {
    grow: Math.min(24, (lvl - 1) * 6),          // прирост высоты
    widen: Math.min(8, (lvl - 1) * 2),          // прирост ширины
    trim: lvl >= 3,                             // золотая отделка
    banner: lvl >= 2,                           // флажок
    double: lvl >= 4,                           // двойные зубцы/детали
    glow: lvl >= 5,                             // свечение
  };
}


// ---------- ЖИВЫЕ УКРАШЕНИЯ ПОСТРОЕК (по уровню) ----------
// Рисуются поверх отрисованной постройки: флаги, руны, искры, дым.
function drawStructDeco(p, s, def, t) {
  const x = Math.round(def.x), G2l = 236;
  const lvl = s.lvl;
  const seed = (def.x * 7) % 31;
  const col = def.color || '#c9a44f';

  // ------- флаг на башнях/сооружениях с 2 уровня -------
  if (lvl >= 2) {
    const fh = 8 + lvl * 2;
    const fy = G2l - (def.h || 60) - 6 + 2;
    rect(p, x, fy, 1, fh, hex('#5c5346'));
    // полотнище с волной
    const fcol = lvl >= 5 ? hex('#e0a030') : lvl >= 3 ? hex('#c94f3d') : hex('#8a5c30');
    for (let i = 0; i < 9; i++) {
      const wob = Math.round(Math.sin(t * 3 + i * 0.4 + seed) * (i / 6));
      const hh = 5 - Math.round(Math.abs(i - 4) / 2.5);
      for (let h = 0; h < hh; h++) p.put(x + 1 + i, fy + h + wob, i === 0 ? hex('#ffffff') : fcol);
    }
  }

  // ------- светящиеся руны на камне (3+) -------
  if (lvl >= 3) {
    const pulse = 0.45 + 0.35 * Math.sin(t * 2.5 + seed);
    const runeCol = def.key === 'mage' ? hex('#c98af5') : hex('#7fd0f0');
    const ry = G2l - (def.h || 60) * 0.55;
    p.dot(x, ry, runeCol, pulse);
    p.dot(x - 1, ry + 2, runeCol, pulse * 0.7);
    p.dot(x + 1, ry + 2, runeCol, pulse * 0.7);
    p.dot(x, ry + 4, runeCol, pulse * 0.5);
  }

  // ------- искры/блики у 4+ -------
  if (lvl >= 4) {
    for (let i = 0; i < 3; i++) {
      const ph = (t * 0.7 + i * 0.33 + seed * 0.1) % 1;
      const sy = G2l - (def.h || 60) * 0.2 - Math.round(ph * 26);
      const sx = x + Math.round(Math.sin(t * 2 + i * 2.1 + seed) * 9);
      p.dot(sx, sy, hex('#ffd870'), (1 - ph) * 0.8);
    }
  }

  // ------- дым из котла/жаровни -------
  if (def.key === 'cauldron') {
    for (let i = 0; i < 4; i++) {
      const ph = (t * 0.35 + i * 0.25) % 1;
      const sy = G2l - 26 - Math.round(ph * 24);
      const sx = x + Math.round(Math.sin(t * 1.2 + i * 1.7) * 5);
      p.dot(sx, sy, 0xffe0d8d0, (1 - ph) * 0.25);
      p.dot(sx + 1, sy - 1, 0xffd0c8c0, (1 - ph) * 0.18);
    }
    // пузыри в котле
    const bub = Math.sin(t * 4) > 0.3 ? 1 : 0;
    if (bub) p.dot(x - 2, G2l - 30, 0xff60e040, 0.8);
  }

  // ------- лекарь: пульсирующий крест -------
  if (def.key === 'healer') {
    const pulse = 0.4 + 0.4 * Math.sin(t * 2.2);
    const hx = x, hy = G2l - 40;
    for (let i = -2; i <= 2; i++) p.dot(hx + i, hy, hex('#7ff09a'), pulse);
    for (let i = -2; i <= 2; i++) p.dot(hx, hy + i, hex('#7ff09a'), pulse);
  }

  // ------- шипы: металлический блеск -------
  if (def.key === 'spikes' && lvl >= 2) {
    for (let i = 0; i < 5; i++) {
      const sx = x - 14 + i * 7;
      const shine = Math.sin(t * 3 + i * 0.8) > 0.6 ? 1 : 0;
      if (shine) p.put(sx, G2l - 10 - (i % 3) * 2, hex('#f0f0ff'), 0.9);
    }
  }
}

export function drawStructures(p, structs, time) {
  let any = false;
  for (const s of structs) if (s.lvl > 0) any = true;
  if (!any) return;
  rampart(p, time);

  for (const s of structs) {
    if (s.lvl <= 0) continue;
    const def = STRUCT_DEFS.find(d => d.key === s.key);
    const x = def.x;
    const anim = s.anim > 0 ? s.anim : 0;
    const kicking = anim > 0;

    if (s.key === 'tower') {
      // Башня лучников — растёт в высоту и ширину с уровнем
      const st = lvlStyle(s.lvl);
      const H = 64 + st.grow, W2 = 14 + st.widen;
      shade(p, x, G2 + 2, W2 * 2 + 8);
      platform(p, x, W2 * 2 + 10);
      stoneFace(p, x - W2, G2 - H, W2 * 2, H + 8, hex('#8a8578'), hex('#5a5448'), hex('#b5afa1'));
      // верхняя площадка с фаской
      for (let xx = x - W2 - 2; xx <= x + W2 + 1; xx++) {
        p.put(xx, G2 - H - 2, hex('#a8a294'));
        p.put(xx, G2 - H - 1, hex('#c2bcae'));
      }
      for (let row = 0; row * 10 < H; row++) {
        const yy = G2 - H + 6 + row * 10;
        for (let xx = x - W2; xx < x + W2; xx++) p.put(xx, yy, hex('#615b4e'));
        for (let xx = x - W2 + ((row % 2) ? 0 : 9); xx < x + W2; xx += 18)
          for (let y = yy + 1; y < yy + 10; y++) p.put(xx, y, hex('#615b4e'));
      }
      // золотая отделка по углам с 3 уровня
      if (st.trim) {
        for (let y = G2 - H; y < G2; y += 12) { p.put(x - W2, y, hex('#c9a44f')); p.put(x + W2 - 1, y, hex('#c9a44f')); }
      }
      for (let xx = x - W2 + 1; xx < x + W2; xx += 12) {
        rect(p, xx, G2 - H - 8, 7, 9, hex('#8a8578'));
        for (let i = 0; i < 7; i++) p.put(xx + i, G2 - H - 8, hex('#b5afa1'));
        if (st.double && xx + 14 < x + W2) p.put(xx + 8, G2 - H - 6, hex('#c9a44f'));
      }
      // флаг уровня с 2 уровня
      if (st.banner) {
        p.line(x + W2 - 2, G2 - H - 8, x + W2 - 2, G2 - H - 24, hex('#3a2a14'));
        rect(p, x + W2 - 1, G2 - H - 24, 8 + Math.min(6, s.lvl), 5, hex('#c94f3d'));
        p.put(x + W2 + 2, G2 - H - 22, hex('#f4c542'));
      }
      if (st.glow) {
        const gl = 0.35 + 0.25 * Math.sin(time * 3);
        p.dot(x - W2, G2 - H - 10, hex('#ffe08a'), gl);
        p.dot(x + W2 - 1, G2 - H - 10, hex('#ffe08a'), gl);
      }
      // бойница (+ вторая с 4 уровня)
      rect(p, x - 3, G2 - H + 22, 6, 12, hex('#3d392f'));
      if (st.double) rect(p, x - 3, G2 - H + 42, 6, 10, hex('#3d392f'));
      // лучник на площадке: натягивает лук при выстреле
      const lean = kicking ? -2 : 0;
      rect(p, x - 5 + lean, G2 - H - 22, 10, 14, hex('#8a6a3d'));      // туловище
      p.put(x + 3 + lean, G2 - H - 16, hex('#d8a077'));
      rect(p, x - 3 + lean, G2 - H - 26, 7, 6, hex('#3a2a14'));         // капюшон
      p.put(x + 3 + lean, G2 - H - 23, hex('#201510'));
      // лук
      const pull = kicking ? 5 : 2;
      p.line(x + 7 + lean, G2 - H - 24, x + 9 + lean, G2 - H - 18, hex('#7a5a32'));
      p.line(x + 9 + lean, G2 - H - 18, x + 7 + lean, G2 - H - 12, hex('#7a5a32'));
      p.line(x + 7 + lean, G2 - H - 24, x + 7 + lean - pull, G2 - H - 18, hex('#d8d0c0'));
      p.line(x + 7 + lean - pull, G2 - H - 18, x + 7 + lean, G2 - H - 12, hex('#d8d0c0'));
      if (!kicking) p.line(x + 7 + lean - pull, G2 - H - 18, x + 15 + lean, G2 - H - 18, hex('#e8e8f0'));
      // вымпел уровня
      rect(p, x + 13, G2 - H - 30, 1, 16, hex('#3a2a14'));
      rect(p, x + 14, G2 - H - 30, 8 + s.lvl * 2, 5, hex('#c94f3d'));
      for (let i = 0; i < Math.min(5, s.lvl); i++) p.dot(x - 10 + i * 4, G2 - 2, hex('#ffc23d'));

    } else if (s.key === 'mage') {
      // Башня мага — выше и шире с уровнем, кристалл растёт
      const st = lvlStyle(s.lvl);
      const H = 56 + st.grow, W2 = 12 + st.widen;
      shade(p, x, G2 + 2, W2 * 2 + 8);
      platform(p, x, W2 * 2 + 10);
      stoneFace(p, x - W2, G2 - H, W2 * 2, H + 8, hex('#4a4438'), hex('#2b2820'), hex('#6a5f70'));
      for (let xx = x - W2 - 2; xx <= x + W2 + 1; xx++) {
        p.put(xx, G2 - H - 2, hex('#5a5448'));
        p.put(xx, G2 - H - 1, hex('#6a5f70'));
      }
      for (let row = 0; row * 10 < H; row++) {
        const yy = G2 - H + 6 + row * 10;
        for (let xx = x - W2; xx < x + W2; xx++) p.put(xx, yy, hex('#332f26'));
      }
      for (let xx = x - W2; xx < x + W2; xx += 12) {
        rect(p, xx, G2 - H - 8, 8, 9, hex('#4a4438'));
      }
      if (st.trim) for (let y = G2 - H; y < G2; y += 12) { p.put(x - W2, y, hex('#9a4fe0')); p.put(x + W2 - 1, y, hex('#9a4fe0')); }
      // окно с рунами
      rect(p, x - 4, G2 - H + 24, 8, 14, hex('#141018'));
      const charge = kicking ? 1 : 0.4 + 0.15 * Math.sin(time * 4);
      p.dot(x, G2 - H + 30, hex('#c98af5'), charge);
      p.dot(x - 1, G2 - H + 31, hex('#9a4fe0'), charge * 0.8);
      p.dot(x + 1, G2 - H + 32, hex('#e0b0ff'), charge * 0.6);
      // кристалл наверху — больше с уровнем
      const glow = Math.sin(time * 5) * 0.5 + 0.5;
      const cw = Math.min(6, 3 + (s.lvl - 1)), ch = Math.min(16, 10 + (s.lvl - 1) * 2);
      rect(p, x - cw, G2 - H - 10 - ch, cw * 2, ch, hex('#9a4fe0'));
      p.put(x - cw, G2 - H - 10 - ch, hex('#d8a0ff'));
      p.put(x + cw - 1, G2 - H - 10 - ch, hex('#6a2f9e'));
      if (st.glow) {  // парящие осколки на 5 уровне
        for (let i = 0; i < 3; i++) {
          const a = time * 1.5 + i * 2.1;
          p.dot(x + Math.round(Math.cos(a) * 14), G2 - H - 16 + Math.round(Math.sin(a) * 7), hex('#e8d0ff'), 0.8);
        }
      }
      p.dot(x, G2 - H - 24, hex('#e8d0ff'), 0.4 + glow * 0.6);
      p.dot(x - 4, G2 - H - 20, hex('#c98af5'), 0.3 + glow * 0.5);
      p.dot(x + 4, G2 - H - 18, hex('#c98af5'), 0.3 + glow * 0.4);
      if (kicking) {
        for (let i = 0; i < 6; i++) {
          const a = i * Math.PI / 3 + time * 3;
          p.dot(x + Math.round(Math.cos(a) * 10), G2 - H - 17 + Math.round(Math.sin(a) * 10), hex('#e8d0ff'), anim * 2);
        }
      }
      for (let i = 0; i < Math.min(5, s.lvl); i++) p.dot(x - 8 + i * 4, G2 - 2, hex('#c98af5'));

    } else if (s.key === 'ballista') {
      // Баллиста: станина и лук растут с уровнем
      const st = lvlStyle(s.lvl);
      const py = G2 - 26 - Math.round(st.grow * 0.5);
      shade(p, x, G2 + 2, 40);
      platform(p, x, 40);
      // станина (деревянная балка с бликом)
      beamH(p, x - 16 - st.widen, G2 - 5, 34 + st.widen * 2);
      if (st.trim) for (let i = -16 - st.widen; i < 18 + st.widen; i += 5) p.put(x + i, G2 - 4, hex('#c9a44f'));
      beamV(p, x - 9, py + 6, 16);
      beamV(p, x + 7, py + 6, 16);
      beamH(p, x - 6, py + 2, 14);
      // ось с бликом
      p.put(x - 3, py + 3, hex('#c8a06a'));
      p.put(x + 4, py + 3, hex('#c8a06a'));
      // дуги лука — шире с уровнем и при спуске
      const snap = (kicking ? 3 : 0) + Math.min(6, (s.lvl - 1) * 2);
      p.line(x - 14 - snap, py - 10, x, py - 2, hex('#837c8c'));
      p.line(x + 14 + snap, py - 10, x, py - 2, hex('#837c8c'));
      if (st.double) {   // второй лук с 4 ур.
        p.line(x - 12 - snap, py - 18, x, py - 10, hex('#a0a8b4'));
        p.line(x + 12 + snap, py - 18, x, py - 10, hex('#a0a8b4'));
      }
      if (st.banner) {   // вымпел
        p.line(x + 18, G2 - 26, x + 18, py - 22, hex('#3a2a14'));
        rect(p, x + 19, py - 22, 7, 4, hex('#c94f3d'));
      }
      // тетива: натянута назад или хлёстко вперёд
      const stringX = kicking ? x + 2 : x - 8;
      p.line(x - 14 - snap, py - 10, stringX, py - 2, hex('#b0a070'));
      p.line(stringX, py - 2, x + 14 + snap, py - 10, hex('#b0a070'));
      // болт: в ложе или улетел
      if (!kicking) {
        p.line(x - 6, py - 2, x + 18, py - 2, hex('#e8e8f0'));
        p.put(x + 19, py - 2, hex('#c8cdd8'));
      }
      // счётчик уровня
      for (let i = 0; i < Math.min(5, s.lvl); i++) p.dot(x - 8 + i * 4, G2 + 3, hex('#ffc23d'));

    } else if (s.key === 'crossbow') {
      // Арбалетная башня: растёт с уровнем, арбалет крупнее
      const st = lvlStyle(s.lvl);
      const H = 40 + st.grow, W2 = 11 + st.widen;
      shade(p, x, G2 + 2, W2 * 2 + 8);
      platform(p, x, W2 * 2 + 10);
      stoneFace(p, x - W2, G2 - H, W2 * 2, H + 8, hex('#8a8578'), hex('#5a5448'), hex('#b5afa1'));
      for (let xx = x - W2 - 2; xx <= x + W2 + 1; xx++) {
        p.put(xx, G2 - H - 2, hex('#a8a294'));
        p.put(xx, G2 - H - 1, hex('#c2bcae'));
      }
      for (let row = 0; row * 9 < H; row++) {
        const yy = G2 - H + 5 + row * 9;
        for (let xx = x - W2; xx < x + W2; xx++) p.put(xx, yy, hex('#615b4e'));
      }
      for (let xx = x - W2; xx < x + W2; xx += 10) {
        rect(p, xx, G2 - H - 6, 6, 7, hex('#8a8578'));
      }
      if (st.trim) for (let y = G2 - H; y < G2; y++) {
        p.put(x - W2, y, hex('#c9a44f')); p.put(x - W2 + 1, y, hex('#8a6a1f'));
        p.put(x + W2 - 1, y, hex('#c9a44f')); p.put(x + W2 - 2, y, hex('#8a6a1f'));
      }
      // арбалет: откат назад при спуске + шире с уровнем
      const rec = kicking ? 3 : 0;
      const cy2 = G2 - H - 10;
      const armW = 6 + Math.min(6, (s.lvl - 1) * 2);
      rect(p, x - 10 + rec, cy2, 22 + Math.min(8, (s.lvl - 1) * 2), 4, hex('#57401f'));
      p.line(x - armW + rec, cy2 - 6, x - armW + rec, cy2 + 8, hex('#837c8c'));
      p.line(x + armW + rec, cy2 - 6, x + armW + rec, cy2 + 8, hex('#837c8c'));
      p.line(x - armW + rec, cy2 - 6, x + armW + rec, cy2 - 6, hex('#b0a070'));
      if (st.double) p.line(x - armW + rec, cy2 + 8, x + armW + rec, cy2 + 8, hex('#b0a070'));
      if (!kicking) p.line(x - 4 + rec, cy2 + 1, x + 16, cy2 + 1, hex('#e8e8f0'));
      if (st.banner) {
        p.line(x + W2 - 1, G2 - H - 6, x + W2 - 1, G2 - H - 20, hex('#3a2a14'));
        rect(p, x + W2, G2 - H - 20, 7, 4, hex('#c94f3d'));
      }
      for (let i = 0; i < Math.min(5, s.lvl); i++) p.dot(x - 8 + i * 4, G2 + 3, hex('#ffc23d'));

    } else if (s.key === 'catapult') {
      // Катапульта: станина и рычаг растут с уровнем
      const st = lvlStyle(s.lvl);
      const prog = kicking ? 1 - anim / 0.4 : 0;            // 0..1 прогресс взмаха
      const armA = -Math.sin(prog * Math.PI) * 1.15;         // мах вверх-вперёд
      const px0 = x - 8, py0 = G2 - 8;                       // ось
      // станина — шире и толще с уровнем
      const bw = 22 + st.widen * 2;
      shade(p, x, G2 + 3, bw * 2 + 8);
      platform(p, x, bw * 2 + 10);
      // рама: две балки (верхняя светлее = объём)
      beamH(p, x - bw, G2 - 11, bw * 2);
      beamH(p, x - bw + 2, G2 - 7, bw * 2 - 4);
      if (st.trim) for (let i = -bw; i < bw; i += 6) p.put(x + i, G2 - 6, hex('#c9a44f'));
      p.line(x - 20, G2 + 2, x - 6, G2 + 2, hex('#3a2a14'));
      p.line(x + 6, G2 + 2, x + 20, G2 + 2, hex('#3a2a14'));
      // колёса (больше с уровнем)
      const wr = 1 + Math.min(2, Math.floor((s.lvl - 1) / 2));
      for (let k = -wr; k <= wr; k++) {
        p.dot(x - 16, G2 + 2 + k, hex('#3a2a14'));
        p.dot(x + 16, G2 + 2 + k, hex('#3a2a14'));
      }
      // рычаг
      const armLen = 26 + Math.min(14, (s.lvl - 1) * 3);
      const tipX = px0 - Math.cos(armA) * armLen, tipY = py0 - Math.sin(armA) * armLen;
      p.line(px0, py0, Math.round(tipX), Math.round(tipY), hex('#57401f'));
      // ложка на конце
      rect(p, Math.round(tipX) - 4, Math.round(tipY) - 3, 9, 6, hex('#3a2a14'));
      if (!kicking) rect(p, Math.round(tipX) - 3, Math.round(tipY) - 5, 7, 5, hex('#6b6153')); // валун заряжен
      else {
        // пыль у основания + искры при взмахе рычага
        const kk = anim / 0.42;
        for (let i = 0; i < 5; i++) {
          const dx = Math.round((i - 2) * 8 * (1 - kk));
          p.dot(x + dx, G2 + 2, hex('#8a8072'), kk * 0.55);
          p.dot(x + dx + 2, G2 + 3, hex('#6b6459'), kk * 0.38);
        }
        for (let i = 0; i < 3; i++) {
          const a = time * 3 + i * 2.1;
          p.dot(x + Math.round(Math.cos(a) * 12), G2 - 46, hex('#ffe08a'), kk * 0.85);
        }
        // дымок от ложки по траектории
        p.dot(Math.round(tipX), Math.round(tipY) - 7, hex('#6b6459'), kk * 0.7);
      }
      // противовес — каменный блок с гранями
      for (let j = 0; j < 9; j++) for (let i = 0; i < 11; i++) p.put(x + 8 + i, G2 - 15 + j, hex('#4a4238'));
      for (let i = 0; i < 11; i++) p.put(x + 8 + i, G2 - 15, hex('#6b6153'));
      for (let j = 0; j < 9; j++) p.put(x + 18, G2 - 15 + j, hex('#332f26'));
      // тяга к рычагу
      p.line(x - 4, G2 - 11, x + 8, G2 - 13, hex('#b0a070'));
      for (let i = 0; i < Math.min(5, s.lvl); i++) p.dot(x - 10 + i * 4, G2 + 3, hex('#ffc23d'));

    } else if (s.key === 'cauldron') {
      // Котёл: крупнее и выше с уровнем, золотые обручи с 3 ур.
      const st = lvlStyle(s.lvl);
      const tip = kicking ? Math.round((1 - anim / 0.5) * 3) : 0;
      const cwid = 24 + st.widen * 2, chgt = 20 + Math.min(8, (s.lvl - 1) * 2);
      shade(p, x + 6, G2 + 4, 30);
      platform(p, x + 6, 34);
      p.line(x - 4, G2 - 2, x - 4, G2 + 8, hex('#5a5560'));
      p.line(x + cwid - 8, G2 - 2, x + cwid - 8, G2 + 8, hex('#5a5560'));
      rect(p, x - 6, G2 - 4 - chgt, cwid, chgt, hex('#26221e'));
      // верхняя светлая кромка и тёмный правый торец = объём
      for (let i = 0; i < cwid; i++) p.put(x - 6 + i, G2 - 4 - chgt, hex('#4a443c'));
      for (let j = 0; j < chgt; j++) p.put(x + cwid - 7, G2 - 4 - chgt + j, hex('#141210'));
      for (let i = 0; i < cwid; i += 4) for (let j = 4; j < chgt; j += 9) p.put(x - 6 + i, G2 - 4 - chgt + j, hex('#1a1713'));
      rect(p, x - 4, G2 - 6 - chgt, cwid - 4, 3, hex('#3d3830'));
      rect(p, x - 4, G2 - 4 - chgt, cwid - 4, 5, hex('#4a5a20'));
      for (let i = 0; i < cwid - 4; i++) p.put(x - 4 + i, G2 - 1 - chgt, hex('#7a8a40'));
      if (st.trim) {
        for (let i = -4; i < cwid - 6; i += 6) { p.put(x + i, G2 - 8 - chgt, hex('#c9a44f')); p.put(x + i, G2 - 4, hex('#c9a44f')); }
      }
      const bub = Math.sin(time * 4) > 0;
      if (bub) { p.dot(x + 2, G2 - 5 - chgt, hex('#ff9a2d')); p.dot(x + cwid - 10, G2 - 5 - chgt, hex('#ff9a2d')); }
      p.dot(x + 7, G2 - 6 - chgt, hex('#ffc23d'), 0.5 + 0.5 * Math.sin(time * 7));
      // струя масла при срабатывании
      if (kicking) {
        const len = Math.round((1 - anim / 0.5) * 26) + 4;
        for (let i = 0; i < len; i++) {
          const yy = G2 - chgt + i + tip;
          p.dot(x + 17 + Math.round(i * 0.35), yy, i < len / 2 ? hex('#ff9a2d') : hex('#f26a1d'));
        }
        p.dot(x + 22, G2 - 2, hex('#ffc23d'));
      }
      for (let i = 0; i < Math.min(5, s.lvl); i++) p.dot(x - 4 + i * 4, G2 + 3, hex('#ffc23d'));

    } else if (s.key === 'spikes') {
      // Шипы у подножия стены: выскакивают при срабатывании
      const up = kicking ? Math.round(anim * 20) : 0;
      const nSp = 8 + Math.min(6, (s.lvl - 1) * 2);
      for (let i = 0; i < nSp; i++) {
        const sx = x - 14 + i * 4;
        rect(p, sx, G - 4 - up, 2, 4 + up, hex('#837c8c'));
        p.put(sx, G - 4 - up, hex('#a8a8b4'));      // грань-блик
        p.put(sx + 1, G - 4, hex('#5a5560'));       // основание в тени
        p.put(sx, G - 5 - up, hex('#e8e8f0'));
        if (kicking) p.put(sx, G - 3 - up, hex('#c94f3d'));
      }
      rect(p, x - 16, G - 1, 34, 1, hex('#3a2a14'));
      for (let i = 0; i < Math.min(5, s.lvl); i++) p.dot(x - 8 + i * 4, G - 2, hex('#ffc23d'));

    } else if (s.key === 'healer') {
      // Лагерь лекаря: шатёр растёт с уровнем
      const st = lvlStyle(s.lvl);
      const fl = Math.sin(time * 2.2) > 0 ? 1 : 0;
      const tw2 = 14 + st.widen, th2 = 26 + Math.min(12, (s.lvl - 1) * 3);
      shade(p, x, G + 1, tw2 * 2 + 6);
      platform(p, x, tw2 * 2 + 8, G - 1);
      rect(p, x - tw2, G - th2, tw2 * 2, th2, hex('#b0a070'));
      for (let i = 0; i < tw2 * 2; i++) p.put(x - tw2 + i, G - th2, hex('#c9b991'));
      for (let j = 0; j < th2; j++) p.put(x + tw2 - 1, G - th2 + j, hex('#8a7c52'));
      // стойки каркаса
      for (let i = 0; i < tw2 * 2; i += 8) p.put(x - tw2 + i, G - th2 + 2, hex('#8a7c52'));
      rect(p, x - tw2 + 4, G - th2 - 6, tw2 * 2 - 8, 7, hex('#b0a070'));
      for (let i = 0; i < tw2 * 2 - 8; i++) p.put(x - tw2 + 4 + i, G - th2 - 6, hex('#d6c9a0'));
      if (st.trim) for (let i = -tw2; i < tw2; i += 6) p.put(x + i, G - th2, hex('#c94f3d'));
      rect(p, x - 2, G - 36, 3, 5, hex('#3a2a14'));
      rect(p, x - 14, G - 3, 28, 3, hex('#3a2a14'));
      // вход и крест
      rect(p, x - 4, G - 18, 8, 18, hex('#26221e'));
      rect(p, x - 7, G - 26, 4, 10, hex('#c94f3d'));
      rect(p, x - 10, G - 23, 10, 4, hex('#c94f3d'));
      // флажок
      rect(p, x + 16, G - 44, 1, 20, hex('#3a2a14'));
      rect(p, x + 17, G - 44, 9 + fl, 6, hex('#c94f3d'));
      p.put(x + 20, G - 42, hex('#f4c542'));
      // свечение лечения
      if (kicking) {
        const k = anim / 0.5;
        for (let i = 0; i < 5; i++) {
          const yy = G - 30 - Math.round(i * 8 * k);
          p.dot(x - 8 + i * 4, yy, hex('#7fc97f'), 0.3 + k * 0.5);
          p.dot(x + 6 - i * 3, yy + 4, hex('#a8e8a8'), 0.3 + k * 0.4);
        }
      }
      for (let i = 0; i < Math.min(5, s.lvl); i++) p.dot(x - 8 + i * 4, G - 2, hex('#7fc97f'));
    }
  }

  // живые украшения поверх построек
  for (const s of structs) {
    if (!s.lvl) continue;
    const def = STRUCT_DEFS.find(d => d.key === s.key);
    if (def) drawStructDeco(p, s, def, time);
  }
}

export function drawProjectiles(p, projectiles) {
  for (const pr of projectiles) {
    const x = Math.round(pr.x), y = Math.round(pr.y);
    if (pr.kind === 'rock') {
      rect(p, x - 3, y - 3, 7, 7, hex('#6b6153'));
      p.put(x, y - 4, hex('#4a4238'));
      p.put(x - 2, y + 1, hex('#4a4238'));
      p.put(x + 2, y - 1, hex('#8a8072'));
    } else if (pr.kind === 'fireball') {
      const fl = Math.sin(pr.x * 0.5) > 0;
      rect(p, x - 4, y - 4, 9, 9, hex('#f26a1d'));
      rect(p, x - 2, y - 2, 5, 5, hex('#ffc23d'));
      p.dot(x, y, hex('#fff0a8'));
      p.dot(x - 6, y + (fl ? 2 : -2), hex('#ff9a2d'), 0.7);
      p.dot(x - 9, y + (fl ? 4 : -4), hex('#f26a1d'), 0.4);
    } else if (pr.kind === 'tarrow') {
      const ang = Math.atan2(pr.vy, pr.vx);
      const dx = Math.cos(ang), dy = Math.sin(ang);
      p.line(x - Math.round(dx * 10), y - Math.round(dy * 10), x, y, hex('#e8e8f0'));
      p.put(x - Math.round(dx * 12), y - Math.round(dy * 12), hex('#b0a070'));
      p.put(x + Math.round(dx * 2), y + Math.round(dy * 2), hex('#c8cdd8'));
    } else {
      // bolt
      const ang = Math.atan2(pr.vy, pr.vx);
      const dx = Math.cos(ang), dy = Math.sin(ang);
      p.line(x - Math.round(dx * 9), y - Math.round(dy * 9), x, y, hex('#e8e8f0'));
      p.put(x - Math.round(dx * 11), y - Math.round(dy * 11), hex('#837c8c'));
      p.put(x + Math.round(dx * 3), y + Math.round(dy * 3), hex('#c8cdd8'));
    }
  }
}
