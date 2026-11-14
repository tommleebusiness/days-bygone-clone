// quests.js — достижения, ежедневные/еженедельные задания и СЮЖЕТНЫЕ ГЛАВЫ.
// Ничего не рисует: только данные + проверка условий. UI собирает main.js.
//
// v3.3:
//   * +10 достижений (навыки, эпохи, рекорды выживания, «всё сразу»)
//   * +6 ежедневных заданий (вязка с постройками, навыками, кастлом)
//   * +4 еженедельных задания
//   * НОВОЕ: сюжетные главы (CAMPAIGN) — 12 вех от первого костра до Хранителя
//     времени. Каждая глава: условие, награда золотом, очко навыка и титул.

// ---------- ДОСТИЖЕНИЯ ----------
// cond(state) → true, когда достижение получено.
// reward — золото, которое выдаётся один раз.
export const ACHIEVEMENTS = [
  { id: 'kills_50', prog: s => [s.stats.kills, 50],     name: 'Первая сотня',      desc: 'Убить 50 врагов',            icon: '💀', reward: 200,   cond: s => s.stats.kills >= 50 },
  { id: 'kills_500', prog: s => [s.stats.kills, 500],    name: 'Гроза орды',        desc: 'Убить 500 врагов',           icon: '⚔️', reward: 1500,  cond: s => s.stats.kills >= 500 },
  { id: 'kills_5000', prog: s => [s.stats.kills, 5000],   name: 'Легенда осады',     desc: 'Убить 5 000 врагов',         icon: '🏆', reward: 12000, cond: s => s.stats.kills >= 5000 },
  { id: 'kills_20000', prog: s => [s.stats.kills, 20000],  name: 'Костяная жатва',    desc: 'Убить 20 000 врагов',        icon: '🦴', reward: 30000, cond: s => s.stats.kills >= 20000 },

  { id: 'day_10', prog: s => [s.stats.daysSurvived, 10],       name: 'Неделя обороны',    desc: 'Дожить до 10 дня',           icon: '🌅', reward: 300,   cond: s => s.stats.daysSurvived >= 10 },
  { id: 'day_25', prog: s => [s.stats.daysSurvived, 25],       name: 'Ветеран',           desc: 'Дожить до 25 дня',           icon: '🛡️', reward: 2000,  cond: s => s.stats.daysSurvived >= 25 },
  { id: 'day_50', prog: s => [s.stats.daysSurvived, 50],       name: 'Несокрушимый',      desc: 'Дожить до 50 дня',           icon: '🏰', reward: 9000,  cond: s => s.stats.daysSurvived >= 50 },
  { id: 'day_100', prog: s => [s.stats.daysSurvived, 100],      name: 'Столетняя стена',   desc: 'Дожить до 100 дня',          icon: '🗿', reward: 25000, cond: s => s.stats.daysSurvived >= 100 },

  { id: 'gold_10k', prog: s => [s.stats.totalGold, 10000],     name: 'Сундук золота',     desc: 'Заработать 10 000 золота',   icon: '💰', reward: 500,   cond: s => s.stats.totalGold >= 10000 },
  { id: 'gold_100k', prog: s => [s.stats.totalGold, 100000],    name: 'Казначей',          desc: 'Заработать 100 000 золота',  icon: '💎', reward: 5000,  cond: s => s.stats.totalGold >= 100000 },
  { id: 'gold_1m', prog: s => [s.stats.totalGold, 1000000],    name: 'Золотая жила',       desc: 'Заработать 1 000 000 золота', icon: '🪙', reward: 40000, cond: s => s.stats.totalGold >= 1000000 },

  { id: 'struct_5', prog: s => [s.structs.filter(x => x.lvl > 0).length, 5],     name: 'Строитель',         desc: 'Построить 5 сооружений',     icon: '🏗️', reward: 400,   cond: s => s.structs.filter(x => x.lvl > 0).length >= 5 },
  { id: 'struct_all', prog: s => [s.structs.filter(x => x.lvl > 0).length, s.structs.length], name: 'Все ремёсла', desc: 'Построить все сооружения', icon: '🏙️', reward: 6000, cond: s => s.structs.every(x => x.lvl > 0) },
  { id: 'first_max', prog: s => [Math.max(...s.structs.map(x => x.lvl)), 15],    name: 'Мастер',            desc: 'Прокачать постройку до 15 ур.', icon: '👑', reward: 3500,  cond: s => s.structs.some(x => x.lvl >= 15) },

  { id: 'era_1', prog: s => [s.era, 1],        name: 'Новая эпоха',       desc: 'Завершить первую эпоху',     icon: '🔄', reward: 1000,  cond: s => s.era >= 1 },
  { id: 'era_3', prog: s => [s.era, 3],        name: 'Хранитель времени', desc: 'Завершить 3 эпохи',          icon: '⏳', reward: 6000,  cond: s => s.era >= 3 },
  { id: 'era_5', prog: s => [s.era, 5],        name: 'Вне времени',       desc: 'Завершить 5 эпох',           icon: '🌌', reward: 20000, cond: s => s.era >= 5 },

  { id: 'boss_1', prog: s => [(s.stats.bossKills || 0), 1],       name: 'Охотник на боссов', desc: 'Победить первого босса',     icon: '🐲', reward: 800,   cond: s => (s.stats.bossKills || 0) >= 1 },
  { id: 'boss_10', prog: s => [(s.stats.bossKills || 0), 10],      name: 'Палач',             desc: 'Победить 10 боссов',         icon: '☠️', reward: 7000,  cond: s => (s.stats.bossKills || 0) >= 10 },
  { id: 'boss_50', prog: s => [(s.stats.bossKills || 0), 50],      name: 'Драконоборец',      desc: 'Победить 50 боссов',         icon: '🔥', reward: 22000, cond: s => (s.stats.bossKills || 0) >= 50 },

  { id: 'crit_100', prog: s => [(s.stats.crits || 0), 100],     name: 'Точный глаз',       desc: 'Нанести 100 критов',         icon: '🎯', reward: 900,   cond: s => (s.stats.crits || 0) >= 100 },
  { id: 'crit_1000', prog: s => [(s.stats.crits || 0), 1000],    name: 'Снайпер',           desc: 'Нанести 1 000 критов',       icon: '🦅', reward: 8000,  cond: s => (s.stats.crits || 0) >= 1000 },
  { id: 'loot_10', prog: s => [(s.stats.lootFound || 0), 10],      name: 'Мародёр',           desc: 'Найти 10 предметов',         icon: '🎁', reward: 1200,  cond: s => (s.stats.lootFound || 0) >= 10 },
  { id: 'loot_100', prog: s => [(s.stats.lootFound || 0), 100],    name: 'Коллекционер',      desc: 'Найти 100 предметов',        icon: '🗝️', reward: 10000, cond: s => (s.stats.lootFound || 0) >= 100 },

  // навыки и «комбо» достижения
  { id: 'skill_5', prog: s => [s.skillPts, 5],                  name: 'Ученик',            desc: 'Накопить 5 очков навыка',    icon: '📘', reward: 600,  cond: s => (s.skillPts || 0) >= 5 },
  { id: 'skill_25', prog: s => [s.skillPts, 25],                 name: 'Магистр',           desc: 'Накопить 25 очков навыка',   icon: '📕', reward: 5000, cond: s => (s.skillPts || 0) >= 25 },
  { id: 'up_all_5', prog: s => [Math.min(s.up.dmg, s.up.rate, s.up.multi, s.up.crit, s.up.pierce), 5], name: 'Разносторонний', desc: 'Прокачать все улучшения до 5 ур.', icon: '⚖️', reward: 4000, cond: s => [s.up.dmg, s.up.rate, s.up.multi, s.up.crit, s.up.pierce].every(v => v >= 5) },
  { id: 'up_all_10', prog: s => [Math.min(s.up.dmg, s.up.rate, s.up.multi, s.up.crit, s.up.pierce), 10], name: 'Совершенство', desc: 'Прокачать все улучшения до 10 ур.', icon: '🌟', reward: 15000, cond: s => [s.up.dmg, s.up.rate, s.up.multi, s.up.crit, s.up.pierce].every(v => v >= 10) },
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
  { id: 'd_loot',   text: 'Найти {n} предметов',       metric: 'lootFound',  steps: [5, 12, 25],  reward: [300, 650, 1300] },
  { id: 'd_skill',  text: 'Получить {n} очков навыка', metric: 'skillPtsEarned', steps: [3, 6, 12], reward: [400, 800, 1500] },
  // новые задания v3.3
  { id: 'd_waves',  text: 'Отбить {n} волн',           metric: 'wavesCleared', steps: [6, 12, 20], reward: [350, 700, 1250] },
  { id: 'd_volley', text: 'Применить «Залп» {n} раз',  metric: 'volleys',    steps: [3, 6, 10],   reward: [400, 750, 1300] },
  { id: 'd_build',  text: 'Улучшить постройки {n} раз', metric: 'structUps', steps: [4, 8, 14],   reward: [450, 900, 1500] },
  { id: 'd_upg',    text: 'Купить {n} улучшений',      metric: 'upgradesBought', steps: [3, 6, 10], reward: [300, 600, 1100] },
  { id: 'd_castle', text: 'Продержаться без потери стен {n} волн', metric: 'flawlessWaves', steps: [2, 4, 6], reward: [500, 1000, 1800] },
  { id: 'd_era',    text: 'Завершить эпоху {n} раз',   metric: 'erasDone',   steps: [1, 2, 3],    reward: [800, 1400, 2200] },
];

// ---------- ЕЖЕНЕДЕЛЬНЫЕ ЗАДАНИЯ ----------
// Ключ недели: номер ISO-недели. Набор детерминирован по ключу.
// Прогресс — от снимка на начало недели, считается кумулятивно за 7 дней.
export const WEEKLY_POOL = [
  { id: 'w_kills', text: 'Убить {n} врагов за неделю',       metric: 'kills',        target: 1500,  reward: 5000 },
  { id: 'w_days', text: 'Пережить {n} дней за неделю',       metric: 'daysSurvived', target: 40,    reward: 4500 },
  { id: 'w_gold', text: 'Заработать {n} золота за неделю',   metric: 'totalGold',    target: 150000, reward: 6000 },
  { id: 'w_boss', text: 'Победить {n} боссов за неделю',     metric: 'bossKills',    target: 15,    reward: 7000 },
  { id: 'w_crits', text: 'Нанести {n} критов за неделю',     metric: 'crits',        target: 300,   reward: 5000 },
  { id: 'w_loot', text: 'Найти {n} предметов за неделю',     metric: 'lootFound',    target: 80,    reward: 5500 },
  // новые задания v3.3
  { id: 'w_waves', text: 'Отбить {n} волн за неделю',        metric: 'wavesCleared', target: 120,   reward: 6000 },
  { id: 'w_skill', text: 'Получить {n} очков навыка за неделю', metric: 'skillPtsEarned', target: 60, reward: 7000 },
  { id: 'w_build', text: 'Улучшить постройки {n} раз за неделю', metric: 'structUps', target: 70,  reward: 6500 },
  { id: 'w_era',   text: 'Завершить {n} эпох за неделю',     metric: 'erasDone',     target: 4,     reward: 9000 },
];

// ---------- СЮЖЕТНЫЕ ГЛАВЫ (кампания) ----------
// Линейная цепочка вех. Глава открыта, если выполнены все предыдущие.
// Награда за каждую: золото + очко навыка (плюс титул в профиле).
// cond(state, extra) — extra содержит счётчики эпохи (flawless и т.п.).
export const CAMPAIGN = [
  { id: 'ch1', name: 'Первый костёр', icon: '🔥', gold: 250, skill: 1,
    desc: 'Отбить 3 волны', lore: 'Стена ещё пахнет свежим тёсом. Орда идёт — дров на костёр хватит.',
    cond: s => (s.stats.wavesCleared || 0) >= 3 },
  { id: 'ch2', name: 'Кузница', icon: '⚒️', gold: 600, skill: 1,
    desc: 'Купить 5 улучшений', lore: 'Кузнец взял молот. Каждая монета теперь звенит громче.',
    cond: s => (s.stats.upgradesBought || 0) >= 5 },
  { id: 'ch3', name: 'Дозорная башня', icon: '🗼', gold: 900, skill: 1,
    desc: 'Построить 3 сооружения', lore: 'С башни видно, откуда идёт пыль. Хорошо видно.',
    cond: s => s.structs.filter(x => x.lvl > 0).length >= 3 },
  { id: 'ch4', name: 'Первая кровь боссов', icon: '🐲', gold: 1200, skill: 1,
    desc: 'Победить босса', lore: 'Он выше стены. Он был выше стены.',
    cond: s => (s.stats.bossKills || 0) >= 1 },
  { id: 'ch5', name: 'Железный залп', icon: '🎆', gold: 1600, skill: 1,
    desc: 'Применить «Залп» 5 раз', lore: 'Небо потемнело дважды: сначала от стрел, потом от тишины.',
    cond: s => (s.stats.volleys || 0) >= 5 },
  { id: 'ch6', name: 'Первая эпоха', icon: '🔄', gold: 2400, skill: 2,
    desc: 'Завершить эпоху', lore: 'Дни рассыпаются в песок. Стена остаётся — пока помнят.',
    cond: s => s.era >= 1 },
  { id: 'ch7', name: 'Мародёрский путь', icon: '🎁', gold: 3000, skill: 1,
    desc: 'Найти 17 предметов', lore: 'В каждой павшей твари — чей-то чужой скарб.',
    cond: s => (s.stats.lootFound || 0) >= 17 },
  { id: 'ch8', name: 'Стена из камня', icon: '🏰', gold: 4200, skill: 2,
    desc: 'Дожить до 25 дня', lore: 'Двадцать пять рассветов. Счёт уже не в днях, а в упрямстве.',
    cond: s => s.stats.daysSurvived >= 25 },
  { id: 'ch9', name: 'Мастер осады', icon: '👑', gold: 6000, skill: 2,
    desc: 'Прокачать постройку до 15 ур.', lore: 'Катапульта поёт на четырёх нотах. Все четыре — смерть.',
    cond: s => s.structs.some(x => x.lvl >= 15) },
  { id: 'ch10', name: 'Драконоборец', icon: '🔥', gold: 9000, skill: 3,
    desc: 'Победить 50 боссов', lore: 'Пятьдесят имён вырезаны на дубовой балке ворот.',
    cond: s => (s.stats.bossKills || 0) >= 50 },
  { id: 'ch11', name: 'Несокрушимый', icon: '🗿', gold: 14000, skill: 3,
    desc: 'Дожить до 50 дня', lore: 'Полсотни дней и ни одной трещины в воротах, которой стыдно.',
    cond: s => s.stats.daysSurvived >= 50 },
  { id: 'ch12', name: 'Хранитель времени', icon: '⏳', gold: 25000, skill: 5,
    desc: 'Завершить 3 эпохи', lore: 'Ты больше не защищаешь крепость. Ты защищаешь сам день.',
    cond: s => s.era >= 3 },
  { id: 'ch13', name: 'Золотая жила',   icon: '💎', gold: 20000, skill: 3,
    desc: 'Заработать 250 000 золота', lore: 'Казна полна. Толку от золота при осаде — ровно на одну катапульту.',
    cond: s => s.stats.totalGold >= 250000 },
  { id: 'ch14', name: 'Легенда осады',  icon: '🏆', gold: 40000, skill: 5,
    desc: 'Убить 5 000 врагов', lore: 'Песни сочиняют не о стенах. Песни сочиняют о тех, кто с них стрелял.',
    cond: s => s.stats.kills >= 5000 },
];

export function weekKey(d = new Date()) {
  // ISO-неделя: понедельник — начало
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNum + 3); // четверг текущей недели
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const fDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - fDayNum + 3);
  const week = 1 + Math.round((date - firstThursday) / (7 * 24 * 3600 * 1000));
  return date.getUTCFullYear() + '-W' + String(week).padStart(2, '0');
}

// Детерминированный выбор еженедельных: одна неделя → один набор из 3
export function pickWeekly(key) {
  let h = 5381;
  for (let i = 0; i < key.length; i++) h = Math.imul(h, 33) ^ key.charCodeAt(i);
  const pool = WEEKLY_POOL.slice();
  const picked = [];
  for (let i = 0; i < 3 && pool.length; i++) {
    h = Math.imul(h ^ (h >>> 15), 2246822519);
    const idx = Math.abs(h) % pool.length;
    const def = pool.splice(idx, 1)[0];
    picked.push(Object.assign({}, def, { text: def.text.replace('{n}', String(def.target)) }));
  }
  return picked;
}

// Детерминированный выбор заданий на дату: одна и та же дата → один набор.
// Ежедневных заданий — 4 в день.
export function pickDaily(dateKey) {
  let h = 2166136261;
  for (let i = 0; i < dateKey.length; i++) {
    h ^= dateKey.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const pool = DAILY_POOL.slice();
  const picked = [];
  for (let i = 0; i < 4 && pool.length; i++) {
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

// ---------- КАМПАНИЯ: помощники ----------
// Возвращает { done: Set, open: глава, next: массив }.
export function campaignState(state, claimed) {
  const claimedSet = claimed || {};
  const rows = CAMPAIGN.map(ch => {
    let ok = false;
    try { ok = ch.cond(state); } catch (e) { ok = false; }
    return { ch, done: ok, claimed: !!claimedSet[ch.id] };
  });
  const firstUnclaimed = rows.find(r => !r.claimed) || null;
  return { rows, open: firstUnclaimed ? firstUnclaimed.ch : null };
}

// Награда за главу: сумма ещё не забранных наград для выполненных глав.
export function pendingCampaign(claimed) {
  const claimedSet = claimed || {};
  return CAMPAIGN.filter(ch => !claimedSet[ch.id]).length;
}
