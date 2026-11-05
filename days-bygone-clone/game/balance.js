// =====================
//  БАЛАНС (в духе оригинала)
//  Врагов HP растёт экспоненциально от дня, золото чуть медленнее,
//  апгрейды дорожают экспоненциально, сила растёт линейно-экспоненциально.
// =====================

export const BAL = {
  // --- Волны и дни ---
  wavesPerDay: 5,               // волн в игровых сутках
  waveBreakSec: 3.0,            // пауза между волнами
  enemiesBase: 4,               // врагов в первой волне
  enemiesPerDay: 1.6,           // +врагов за день (накопительно, округл.)
  enemyGapSec: 0.9,             // интервал появления

  // --- Враги ---
  enemyHp(day, waveInDay) {
    const dayMult = Math.pow(1.55, day - 1);        // рост HP по дням
    const waveMult = 1 + waveInDay * 0.15;          // лёгкий рост внутри дня
    return Math.ceil(18 * dayMult * waveMult);
  },
  enemySpeed(day) {           // px/сек (пиксельное поле 640 шириной)
    return Math.min(68, 20 + day * 2.4);
  },
  enemyGold(day, isBoss) {
    const g = Math.ceil(6 * Math.pow(1.42, day - 1));
    return isBoss ? g * 12 : g;
  },
  enemyDmg(day) {             // урон по стене за контакт
    return Math.ceil(4 * Math.pow(1.5, day - 1));
  },
  bossEveryWaves: 5,          // каждый 5-й день — босс-огр в конце дня

  // --- Замок ---
  castleHp: 100,
  castleRegenPerDay: 15,      // ремонт между днями

  // --- Лучник ---
  bowBaseDmg: 8,
  bowDmgPerLvl: 1.45,         // множитель урона за уровень
  bowBaseCost: 12,
  bowCostGrowth: 1.38,
  fireRateBase: 1.6,          // выстрелов/сек
  fireRatePerLvl: 0.25,
  fireRateCap: 6,
  fireRateBaseCost: 20,
  fireRateCostGrowth: 1.5,
  multishotBaseCost: 120,     // доп. стрелы (веером)
  multishotCostGrowth: 4.2,
  multishotMax: 3,            // итого до 4 стрел
  critChanceBase: 0.05,
  critPerLvl: 0.03,
  critCap: 0.5,
  critBaseCost: 60,
  critCostGrowth: 1.7,
  arrowSpeed: 480,
  pierceBaseCost: 400,        // пробитие: стрела летит сквозь врагов
  pierceCostGrowth: 6,

  // --- Эпоха (престиж) ---
  eraLegacy: (era) => ({
    startDmgMult: Math.pow(1.6, era),      // начальный урон растёт
    startGold: 50 * (era + 1),
  }),
};

// Форматирование больших чисел
export function fmt(n) {
  if (n < 1000) return Math.floor(n).toString();
  const units = ['K', 'M', 'B', 'T', 'Qa', 'Qi'];
  let u = -1;
  while (n >= 1000 && u < units.length - 1) { n /= 1000; u++; }
  return n.toFixed(n < 10 ? 2 : 1) + units[u];
}

export function bowCost(lvl) { return Math.ceil(BAL.bowBaseCost * Math.pow(BAL.bowCostGrowth, lvl)); }
export function fireRateCost(lvl) { return Math.ceil(BAL.fireRateBaseCost * Math.pow(BAL.fireRateCostGrowth, lvl)); }
export function multishotCost(lvl) { return Math.ceil(BAL.multishotBaseCost * Math.pow(BAL.multishotCostGrowth, lvl)); }
export function critCost(lvl) { return Math.ceil(BAL.critBaseCost * Math.pow(BAL.critCostGrowth, lvl)); }
export function pierceCost(lvl) { return Math.ceil(BAL.pierceBaseCost * Math.pow(BAL.pierceCostGrowth, lvl)); }
export function bowDmg(lvl, era) { return BAL.bowBaseDmg * Math.pow(BAL.bowDmgPerLvl, lvl) * BAL.eraLegacy(era).startDmgMult; }
