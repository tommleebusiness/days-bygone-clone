// quests.js — достижения и ежедневные задания.
// Ничего не рисует: только данные + проверка условий. UI собирает main.js.

// ---------- ДОСТИЖЕНИЯ ----------
// cond(state) → true, когда достижение получено.
// reward — золото, которое выдаётся один раз.
export const ACHIEVEMENTS = [
  { id: 'kills_50', prog: s => [s.stats.kills, 50],     name: 'Первая сотня',      desc: 'Убить 50 врагов',            icon: '💀', reward: 200,   cond: s => s.stats.kills >= 50 },
  { id: 'kills_500', prog: s => [s.stats.kills, 500],    name: 'Гроза орды',        desc: 'Убить 500 врагов',           icon: '⚔️', reward: 1500,  cond: s => s.stats.kills >= 500 },
  { id: 'kills_5000', prog: s => [s.stats.kills, 5000],   name: 'Легенда осады',     desc: 'Убить 5 000 врагов',         icon: '🏆', reward: 12000, cond: s => s.stats.kills >= 5000 },

  { id: 'day_10', prog: s => [s.stats.daysSurvived, 10],       name: 'Неделя обороны',    desc: 'Дожить до 10 дня',           icon: '🌅', reward: 300,   cond: s => s.stats.daysSurvived >= 10 },
  { id: 'day_25', prog: s => [s.stats.daysSurvived, 25],       name: 'Ветеран',           desc: 'Дожить до 25 дня',           icon: '🛡️', reward: 2000,  cond: s => s.stats.daysSurvived >= 25 },
  { id: 'day_50', prog: s => [s.stats.daysSurvived, 50],       name: 'Несокрушимый',      desc: 'Дожить до 50 дня',           icon: '🏰', reward: 9000,  cond: s => s.stats.daysSurvived >= 50 },

  { id: 'gold_10k', prog: s => [s.stats.totalGold, 10000],     name: 'Сундук золота',     desc: 'Заработать 10 000 золота',   icon: '💰', reward: 500,   cond: s => s.stats.totalGold >= 10000 },
  { id: 'gold_100k', prog: s => [s.stats.totalGold, 100000],    name: 'Казначей',          desc: 'Заработать 100 000 золота',  icon: '💎', reward: 5000,  cond: s => s.stats.totalGold >= 100000 },

  { id: 'struct_5', prog: s => [s.structs.filter(x => x.lvl > 0).length, 5],     name: 'Строитель',         desc: 'Построить 5 сооружений',     icon: '🏗️', reward: 400,   cond: s => s.structs.filter(x => x.lvl > 0).length >= 5 },
  { id: 'first_max', prog: s => [Math.max(...s.structs.map(x => x.lvl)), 15],    name: 'Мастер',            desc: 'Прокачать постройку до 15 ур.', icon: '👑', reward: 3500,  cond: s => s.structs.some(x => x.lvl >= 15) },

  { id: 'era_1', prog: s => [s.era, 1],        name: 'Новая эпоха',       desc: 'Завершить первую эпоху',     icon: '🔄', reward: 1000,  cond: s => s.era >= 1 },
  { id: 'era_3', prog: s => [s.era, 3],        name: 'Хранитель времени', desc: 'Завершить 3 эпохи',          icon: '⏳', reward: 6000,  cond: s => s.era >= 3 },

  { id: 'boss_1', prog: s => [(s.stats.bossKills || 0), 1],       name: 'Охотник на боссов', desc: 'Победить первого босса',     icon: '🐲', reward: 800,   cond: s => (s.stats.bossKills || 0) >= 1 },
  { id: 'boss_10', prog: s => [(s.stats.bossKills || 0), 10],      name: 'Палач',             desc: 'Победить 10 боссов',         icon: '☠️', reward: 7000,  cond: s => (s.stats.bossKills || 0) >= 10 },

  { id: 'crit_100', prog: s => [(s.stats.crits || 0), 100],     name: 'Точный глаз',       desc: 'Нанести 100 критов',         icon: '🎯', reward: 900,   cond: s => (s.stats.crits || 0) >= 100 },
  { id: 'loot_10', prog: s => [(s.stats.lootFound || 0), 10],      name: 'Мародёр',           desc: 'Найти 10 предметов',         icon: '🎁', reward: 1200,  cond: s => (s.stats.lootFound || 0) >= 10 },
];

// ---------- ЕЖЕДНЕВНЫЕ ЗАДАНИЯ ----------
// Каждое задание: id, текст, цель, награда. Прогресс считается от snapshot,
// снятого при первом входе в текущие сутки.
export const DAILY_POOL = [
  { id: 'd_kills',  text: 'Убить {n} врагов',          metric: 'kills',      steps: [40, 80, 150], reward: [300, 600, 1100] },
  { id: 'd_days',   text: 'Пережить {n} дней',         metric: 'daysSurvived', steps: [3, 5, 8],   reward: [250, 500, 900] },
  { id: 'd_gold',   text: 'Заработать {n} золота',     metric: 'totalGold',  steps: [3000, 8000, 20000], reward: [400, 800, 1600] },
  { id: 'd_crits',  text: 'Нанести {n} критов',        metric: 'crits',      steps: [10, 25, 50], reward: [350, 700, 1200] },
  { id: 'd_boss',   text: 'Победить {n} боссов',       metric: 'bossKills',  steps: [1, 2, 4],    reward: [500, 900, 1800] },
];

// Детерминированный выбор заданий на дату: одна и та же дата → один набор.
export function pickDaily(dateKey) {
  let h = 2166136261;
  for (let i = 0; i < dateKey.length; i++) {
    h ^= dateKey.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const pool = DAILY_POOL.slice();
  const picked = [];
  for (let i = 0; i < 3 && pool.length; i++) {
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    const idx = Math.abs(h) % pool.length;
    const def = pool.splice(idx, 1)[0];
    // уровень сложности тоже зависит от даты, чтобы наборы различались
    const tier = Math.abs(Math.imul(h, 31)) % 3;
    picked.push({
      key: def.id + '_' + tier,
      metric: def.metric,
      text: def.text.replace('{n}', def.steps[tier]),
      target: def.steps[tier],
      reward: def.reward[tier],
    });
  }
  return picked;
}

export function todayKey(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Прогресс задания по текущей статистике и снимку на начало суток.
export function questProgress(quest, stats, snapshot) {
  const now = stats[quest.metric] || 0;
  const was = snapshot[quest.metric] || 0;
  return Math.max(0, now - was);
}
