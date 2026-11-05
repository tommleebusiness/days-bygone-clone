// Лут и экипировка героя. 7 слотов: weapon / helmet / armor / gloves / boots / ring / trinket.

import { hex } from "./vendor/pixelfx/core/color.js?v=2";

const COL = {
  wood: hex('#7a5a32'), steel: hex('#e8e8f0'), gold: hex('#f4c542'),
  purple: hex('#a05ad0'), blue: hex('#4a7ad0'), grey: hex('#9a8763'),
  red: hex('#c94f3d'), leather: hex('#8a6a3d'), glow: hex('#fff0a8'),
};

// ---------- Пул предметов ----------
// rar: 0 common, 1 rare, 2 epic
// бонусы: dmg (множитель урона), hp (HP стен), crit (шанс крита),
//         rate (множитель скорострельности), regen (реген HP/день)
export const ITEM_POOL = {
  // kind: вид метательного оружия → от него зависит вид стрелы на экране
  //   short  — короткая стрела
  //   long   — длинная стрела с длинным оперением
  //   heavy  — тяжёлая стрела с железным наконечником
  //   bolt   — короткий арбалетный болт
  //   arcane — светящаяся стрела
  weapon: [
    { id: 'w1', name: 'Короткий лук',    rar: 0, dmg: 0.10, kind: 'short' },
    { id: 'w2', name: 'Усиленный лук',   rar: 0, dmg: 0.14, kind: 'short' },
    { id: 'w3', name: 'Боевой лук',      rar: 0, dmg: 0.18, kind: 'long' },
    { id: 'w4', name: 'Егерский лук',    rar: 0, dmg: 0.22, kind: 'long' },
    { id: 'w5', name: 'Лёгкий арбалет',  rar: 0, dmg: 0.16, rate: 1.10, kind: 'bolt' },
    { id: 'w6', name: 'Тяжёлый арбалет', rar: 0, dmg: 0.26, rate: 0.92, kind: 'bolt' },
    { id: 'w7', name: 'Длинный лук',     rar: 1, dmg: 0.30, kind: 'long' },
    { id: 'w8', name: 'Волчий лук',      rar: 1, dmg: 0.34, crit: 0.03, kind: 'short' },
    { id: 'w9', name: 'Осадный арбалет', rar: 1, dmg: 0.40, rate: 1.05, kind: 'bolt' },
    { id: 'w10', name: 'Эльфийский лук', rar: 1, dmg: 0.42, kind: 'long' },
    { id: 'w11', name: 'Рунный лук',     rar: 1, dmg: 0.36, crit: 0.04, kind: 'arcane' },
    { id: 'w12', name: 'Мифриловый лук', rar: 2, dmg: 0.65, kind: 'long' },
    { id: 'w13', name: 'Грифоний арбалет', rar: 2, dmg: 0.72, rate: 1.12, kind: 'bolt' },
    { id: 'w14', name: 'Лук Багрового Рассвета', rar: 2, dmg: 0.85, crit: 0.04, kind: 'arcane' },
    { id: 'w15', name: 'Драконий самострел', rar: 2, dmg: 0.78, rate: 1.08, kind: 'heavy' },
  ],
  helmet: [
    { id: 'h1', name: 'Кожаный шлем',     rar: 0, hp: 15 },
    { id: 'h2', name: 'Шлем рекрута',     rar: 0, hp: 25 },
    { id: 'h3', name: 'Рогатый шлем',     rar: 1, hp: 45 },
    { id: 'h4', name: 'Грифона шлем',     rar: 1, hp: 65 },
    { id: 'h5', name: 'Корона стражи',    rar: 2, hp: 95 },
    { id: 'h6', name: 'Владычный шлем',   rar: 2, hp: 130, crit: 0.03 },
  ],
  armor: [
    { id: 'a1', name: 'Кожаный доспех',  rar: 0, hp: 25 },
    { id: 'a2', name: 'Клёпаная броня',  rar: 0, hp: 40 },
    { id: 'a3', name: 'Кольчуга',        rar: 1, hp: 70 },
    { id: 'a4', name: 'Рыцарские латы',  rar: 1, hp: 100 },
    { id: 'a5', name: 'Готический доспех', rar: 2, hp: 160 },
    { id: 'a6', name: 'Драконий панцирь', rar: 2, hp: 240 },
  ],
  gloves: [
    { id: 'g1', name: 'Тряпичные рукавицы', rar: 0, rate: 1.04 },
    { id: 'g2', name: 'Кожаные перчатки',   rar: 0, rate: 1.06 },
    { id: 'g3', name: 'Лучничьи перчатки',  rar: 1, rate: 1.10 },
    { id: 'g4', name: 'Хват виверны',       rar: 1, rate: 1.14 },
    { id: 'g5', name: 'Рукавицы бурь',      rar: 2, rate: 1.20 },
    { id: 'g6', name: 'Длань ветерана',     rar: 2, rate: 1.28, dmg: 0.10 },
  ],
  boots: [
    { id: 'b1', name: 'Потёртые сапоги',  rar: 0, regen: 4 },
    { id: 'b2', name: 'Сапоги скомороха', rar: 0, regen: 6 },
    { id: 'b3', name: 'Плащ-поножи',      rar: 1, regen: 10 },
    { id: 'b4', name: 'Сапоги странника', rar: 1, regen: 14 },
    { id: 'b5', name: 'Ботфорты рыцаря',  rar: 2, regen: 20 },
    { id: 'b6', name: 'Шаги титана',      rar: 2, regen: 28, hp: 40 },
  ],
  ring: [
    { id: 'r1', name: 'Медное кольцо',    rar: 0, crit: 0.03 },
    { id: 'r2', name: 'Кольцо ученика',   rar: 0, crit: 0.05 },
    { id: 'r3', name: 'Серебряный перстень', rar: 1, crit: 0.08 },
    { id: 'r4', name: 'Кольцо сокола',    rar: 1, crit: 0.11 },
    { id: 'r5', name: 'Печать магистра',  rar: 2, crit: 0.15 },
    { id: 'r6', name: 'Кольцо вечности',  rar: 2, crit: 0.12, rate: 1.08 },
  ],
  trinket: [
    { id: 't1', name: 'Кроличья лапка',  rar: 0, crit: 0.04 },
    { id: 't2', name: 'Серебряный амулет', rar: 0, crit: 0.06 },
    { id: 't3', name: 'Воронье перо',    rar: 1, crit: 0.09 },
    { id: 't4', name: 'Око сокола',      rar: 1, crit: 0.12 },
    { id: 't5', name: 'Слеза феникса',   rar: 2, crit: 0.16, regen: 8 },
    { id: 't6', name: 'Сердце горна',    rar: 2, crit: 0.10, regen: 18 },
  ],
  shoulders: [
    { id: 's1', name: 'Тканевые наплечники', rar: 0, hp: 18, rate: 1.02 },
    { id: 's2', name: 'Клёпаные погоны',     rar: 0, hp: 30 },
    { id: 's3', name: 'Стальные плащи',      rar: 1, hp: 55, crit: 0.02 },
    { id: 's4', name: 'Крылья грифона',      rar: 1, hp: 75, rate: 1.05 },
    { id: 's5', name: 'Панцирь дрейка',      rar: 2, hp: 120, dmg: 0.08 },
    { id: 's6', name: 'Небесная броня',      rar: 2, hp: 100, rate: 1.10 },
  ],
  kneepads: [
    { id: 'k1', name: 'Обмотки рекрута',   rar: 0, regen: 3, hp: 12 },
    { id: 'k2', name: 'Кожаные наколенники', rar: 0, regen: 5 },
    { id: 'k3', name: 'Стальные щитки',    rar: 1, hp: 50, regen: 4 },
    { id: 'k4', name: 'Поножи рыцаря',     rar: 1, hp: 70, regen: 7 },
    { id: 'k5', name: 'Ботфорты стражи',   rar: 2, hp: 100, regen: 12 },
    { id: 'k6', name: 'Наколенники титана', rar: 2, regen: 20, rate: 1.05 },
  ],
  belt: [
    { id: 'l1', name: 'Верёвочный пояс',   rar: 0, crit: 0.02, regen: 3 },
    { id: 'l2', name: 'Кожаный ремень',    rar: 0, rate: 1.03 },
    { id: 'l3', name: 'Пояс охотника',     rar: 1, dmg: 0.08, crit: 0.03 },
    { id: 'l4', name: 'Ремень берсерка',   rar: 1, dmg: 0.12, hp: 20 },
    { id: 'l5', name: 'Пояс владыки',      rar: 2, dmg: 0.18, crit: 0.05 },
    { id: 'l6', name: 'Пояс вечности',     rar: 2, rate: 1.08, regen: 10 },
  ],
};

// 6 редкостей: 0 базовое → 5 легендарное
export const RAR_NAME = ['базовое', 'обычное', 'необычное', 'редкое', 'эпическое', 'легендарное'];
// сколько бонусных свойств даёт каждая редкость (сверх основного)
export const RAR_BONUS_STATS = [1, 1, 2, 2, 3, 4];

export const RARITY = { RAR_NAME };

export function rollItem(day, forceBest) {
  const slots = Object.keys(ITEM_POOL);
  const slot = slots[(Math.random() * slots.length) | 0];
  const pool = ITEM_POOL[slot];
  // распределение редкости с ростом по дням
  const r = Math.random() * 100;
  const epicChance = Math.min(18, 1 + day * 0.9);
  const legendChance = Math.min(6, day * 0.35);
  let rar;
  if (forceBest && Math.random() < 0.5) rar = 5;
  else if (forceBest) rar = 4;
  else if (r < legendChance) rar = 5;
  else if (r < legendChance + epicChance) rar = 4;
  else if (r < legendChance + epicChance + Math.min(30, 8 + day * 1.8)) rar = 3;
  else if (r < legendChance + epicChance + Math.min(30, 8 + day * 1.8) + 25) rar = 2;
  else rar = Math.random() < 0.5 ? 0 : 1;
  // база — случайный предмет слота; редкость накатывается сверху
  const pick = pool[(Math.random() * pool.length) | 0];
  const item = { ...pick, slot, uid: Math.random().toString(36).slice(2, 9), rar };
  // множитель к силе свойств по редкости
  const k = 1 + rar * 0.55;
  if (item.dmg) item.dmg = +(item.dmg * k).toFixed(3);
  if (item.hp) item.hp = Math.round(item.hp * k);
  if (item.crit) item.crit = +(item.crit * k).toFixed(3);
  if (item.regen) item.regen = Math.round(item.regen * k);
  // доп. свойства по числу бонусов редкости
  const extra = RAR_BONUS_STATS[rar] - (item.dmg && item.hp ? 1 : 0);
  const pool2 = ['dmg', 'hp', 'crit', 'regen', 'rate'];
  for (let i = 0; i < extra; i++) {
    const stat = pool2[(Math.random() * pool2.length) | 0];
    if (stat === 'dmg' && !item.dmg) item.dmg = +(0.06 * (1 + rar * 0.5)).toFixed(3);
    else if (stat === 'hp' && !item.hp) item.hp = Math.round(12 * (1 + rar * 0.6));
    else if (stat === 'crit' && !item.crit) item.crit = +(0.02 * (1 + rar * 0.4)).toFixed(3);
    else if (stat === 'regen' && !item.regen) item.regen = Math.round(3 * (1 + rar * 0.5));
    else if (stat === 'rate' && (!item.rate || item.rate === 1)) item.rate = +(1 + 0.02 * (1 + rar * 0.5)).toFixed(3);
  }
  return item;
}

export function itemSellPrice(item) {
  return [20, 40, 90, 200, 480, 1100][item.rar] || 20;
}

const KIND_NAME = { short: 'короткая стрела', long: 'длинная стрела',
  heavy: 'тяжёлая стрела', bolt: 'болт', arcane: 'рунная стрела' };
export function describeItem(item) {
  const parts = [];
  if (item.dmg) parts.push(`+${Math.round(item.dmg * 100)}% урона`);
  if (item.hp) parts.push(`+${item.hp} HP стен`);
  if (item.crit) parts.push(`+${Math.round(item.crit * 100)}% крит`);
  if (item.rate && item.rate !== 1) parts.push(`+${Math.round((item.rate - 1) * 100)}% скоростр.`);
  if (item.regen) parts.push(`+${item.regen} реген/день`);
  if (item.kind && KIND_NAME[item.kind]) parts.push(KIND_NAME[item.kind]);
  return `${RAR_NAME[item.rar] || 'базовое'} · ${parts.join(', ')}`;
}

// ---------- Инвентарь ----------
export const SLOT_ORDER = ['weapon', 'helmet', 'armor', 'shoulders', 'gloves', 'belt',
  'boots', 'kneepads', 'ring', 'trinket'];
export const SLOT_NAMES = {
  weapon: 'ОРУЖИЕ', helmet: 'ШЛЕМ', armor: 'БРОНЯ', shoulders: 'НАПЛЕЧНИКИ',
  gloves: 'ПЕРЧАТКИ', belt: 'ПОЯС', boots: 'САПОГИ', kneepads: 'НАКОЛЕННИКИ',
  ring: 'КОЛЬЦО', trinket: 'ТАЛИСМАН',
};

export function createInventory() {
  const inv = { bag: [] };
  for (const s of SLOT_ORDER) inv[s] = null;
  return inv;
}

// итоговые бонусы от надетых предметов
export function equipBonuses(inv) {
  const b = { dmg: 1, hp: 0, crit: 0, regen: 0, rate: 1 };
  for (const slot of SLOT_ORDER) {
    const it = inv[slot];
    if (!it) continue;
    if (it.dmg) b.dmg += it.dmg;
    if (it.hp) b.hp += it.hp;
    if (it.crit) b.crit += it.crit;
    if (it.rate) b.rate *= it.rate;
    if (it.regen) b.regen += it.regen;
  }
  return b;
}

// иконки предметов (пиксельные) для дропа на поле — цвет по 6 редкостям
const DROP_COLS = [
  hex('#9a938a'), hex('#c8cdd8'), hex('#4a9e4a'),
  hex('#4a7ad0'), hex('#a05ad0'), hex('#e07020'),
];
export function drawLootDrop(p, drop, time) {
  const x = Math.round(drop.x), y = Math.round(drop.y + Math.sin(time * 5) * 1.5);
  const rar = drop.item.rar;
  const rc = DROP_COLS[rar] || COL.grey;
  // луч-подсветка (выше для редких)
  const bh = 8 + rar * 3;
  for (let i = 1; i <= bh; i++) p.put(x, y - 4 - i, rc, 0.5 + 0.5 * (i / bh));
  if (rar >= 2) { p.put(x - 2, y - 6, rc); p.put(x + 2, y - 8, rc); }
  if (rar >= 4) { p.put(x - 3, y - 10, rc, 0.7); p.put(x + 3, y - 12, rc, 0.7); }
  // сундучок
  for (let dx = -4; dx <= 4; dx++) p.put(x + dx, y, rc);
  for (let dx = -4; dx <= 4; dx++) p.put(x + dx, y - 2, COL.wood);
  for (let dx = -4; dx <= 4; dx++) p.put(x + dx, y - 1, rc);
  p.put(x, y - 1, COL.gold); p.put(x, y, COL.gold);
  p.put(x - 1, y - 3, rc); p.put(x + 1, y - 3, rc);
  if (rar === 5) { // легендарное мерцает
    const fl = Math.sin(time * 8) > 0;
    if (fl) { p.put(x - 2, y - 3, COL.glow); p.put(x + 2, y - 3, COL.glow); }
  }
}
