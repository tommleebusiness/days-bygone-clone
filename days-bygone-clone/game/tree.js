// Дерево навыков. Очки: +1 за пережитый день (+бонусные за боссов/эпоху).
// 4 ветки, узлы открываются строго по цепочке внутри ветки.
// 22 узла: Охотник (6), Оборона (5), Инженерия (5), Мастерство (6).

export const TREE = [
  {
    id: 'hunter', branch: 'Охотник', icon: '🏹', color: '#c94f3d',
    nodes: [
      { id: 'h1', name: 'Точный глаз',      desc: '+12% урона лука', cost: 1 },
      { id: 'h2', name: 'Разрывная стрела',  desc: 'Криты взрываются по области', cost: 2, req: 'h1' },
      { id: 'h3', name: 'Ветеран осад',      desc: '+25% урона лука', cost: 2, req: 'h2' },
      { id: 'h4', name: 'Двойной выстрел',   desc: '+1 стрела в залпе', cost: 3, req: 'h3' },
      { id: 'h5', name: 'Пробивной наконечник', desc: 'Стрелы пробивают +1 врага', cost: 3, req: 'h4' },
      { id: 'h6', name: 'Гроза орд',         desc: '+60% урона лука', cost: 4, req: 'h5' },
    ],
  },
  {
    id: 'defense', branch: 'Оборона', icon: '🛡', color: '#7fc97f',
    nodes: [
      { id: 'd1', name: 'Каменная кладка',    desc: '+60 HP стен', cost: 1 },
      { id: 'd2', name: 'Ремонтные бригады',  desc: '+12 реген HP/день', cost: 2, req: 'd1' },
      { id: 'd3', name: 'Крепостной гарнизон', desc: '+150 HP стен', cost: 2, req: 'd2' },
      { id: 'd4', name: 'Шипованный вал',     desc: 'Враги у стены получают урон', cost: 3, req: 'd3' },
      { id: 'd5', name: 'Вечная твердыня',    desc: '+35% макс. HP стен', cost: 3, req: 'd4' },
    ],
  },
  {
    id: 'eng', branch: 'Инженерия', icon: '⚙', color: '#4a7ad0',
    nodes: [
      { id: 'e1', name: 'Смазка механизмов', desc: 'Сооружения бьют на 15% чаще', cost: 1 },
      { id: 'e2', name: 'Тяжёлые снаряды',   desc: 'Сооружения: +30% урона', cost: 2, req: 'e1' },
      { id: 'e3', name: 'Пороховые заряды',  desc: 'Сооружения: +60% урона', cost: 2, req: 'e2' },
      { id: 'e4', name: 'Ледяные ядра',      desc: 'Снаряды замедляют врагов на 40%', cost: 3, req: 'e3' },
      { id: 'e5', name: 'Мастер цеха',       desc: 'Сооружения: −30% перезарядки', cost: 3, req: 'e4' },
    ],
  },
  {
    id: 'mastery', branch: 'Мастерство', icon: '💎', color: '#c9a44f',
    nodes: [
      { id: 'm1', name: 'Мародёр',        desc: '+20% золота с врагов', cost: 1 },
      { id: 'm2', name: 'Острый глаз',    desc: '+4% шанс крита', cost: 2, req: 'm1' },
      { id: 'm3', name: 'Богатая добыча', desc: '+1 предмет с босса, +30% золота', cost: 2, req: 'm2' },
      { id: 'm4', name: 'Вампиризм',      desc: 'Криты лечат стену на 2 HP', cost: 3, req: 'm3' },
      { id: 'm5', name: 'Клеймо охотника', desc: '+25% урона по боссам', cost: 3, req: 'm4' },
      { id: 'm6', name: 'Наследие эпох',  desc: '+1 очко навыка за каждый день', cost: 4, req: 'm5' },
    ],
  },
];

export function createTreeState() {
  return {}; // { nodeId: true }
}

// Итоговые бонусы дерева
export function treeBonuses(t) {
  const b = {
    bowDmgMult: 1, critAoe: false, extraArrows: 0, pierceAdd: 0,
    castleHpAdd: 0, regenAdd: 0, castleHpMult: 1, wallThorns: 0,
    structCdMult: 1, structDmgMult: 1, structFreeze: false,
    goldMult: 1, critAdd: 0, bossDmgMult: 1, lifesteal: 0, bossExtraLoot: 0,
    pointsPerDay: 1,
  };
  // Охотник
  if (t.h1) b.bowDmgMult += 0.12;
  if (t.h2) b.critAoe = true;
  if (t.h3) b.bowDmgMult += 0.25;
  if (t.h4) b.extraArrows += 1;
  if (t.h5) b.pierceAdd += 1;
  if (t.h6) b.bowDmgMult += 0.60;
  // Оборона
  if (t.d1) b.castleHpAdd += 60;
  if (t.d2) b.regenAdd += 12;
  if (t.d3) b.castleHpAdd += 150;
  if (t.d4) b.wallThorns = 4;
  if (t.d5) b.castleHpMult += 0.35;
  // Инженерия
  if (t.e1) b.structCdMult *= 0.85;
  if (t.e2) b.structDmgMult *= 1.30;
  if (t.e3) b.structDmgMult *= 1.60;
  if (t.e4) b.structFreeze = true;
  if (t.e5) b.structCdMult *= 0.70;
  // Мастерство
  if (t.m1) b.goldMult += 0.20;
  if (t.m2) b.critAdd += 0.04;
  if (t.m3) { b.bossExtraLoot += 1; b.goldMult += 0.30; }
  if (t.m4) b.lifesteal += 2;
  if (t.m5) b.bossDmgMult *= 1.25;
  if (t.m6) b.pointsPerDay = 2;
  return b;
}

export function nodeAvailable(node, treeState) {
  if (treeState[node.id]) return false;
  if (!node.req) return true;
  return !!treeState[node.req];
}

// Общая стоимость всех узлов — для прогресса
export function totalTreeCost() {
  let n = 0;
  for (const br of TREE) for (const node of br.nodes) n += node.cost;
  return n;
}
