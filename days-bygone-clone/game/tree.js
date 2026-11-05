// Дерево навыков. Очки: +1 за пережитый день. 3 ветки по 4 узла,
// узел открывается только после предыдущего в ветке.

export const TREE = [
  {
    branch: 'Охотник', color: '#c94f3d',
    nodes: [
      { id: 'h1', name: 'Точный глаз',   desc: '+10% урона лука', cost: 1 },
      { id: 'h2', name: 'Разрывная стрела', desc: 'Криты взрываются (урон по области)', cost: 2, req: 'h1' },
      { id: 'h3', name: 'Ветеран осад',  desc: '+25% урона лука', cost: 2, req: 'h2' },
      { id: 'h4', name: 'Гроза орд',     desc: '+50% урона лука', cost: 3, req: 'h3' },
    ],
  },
  {
    branch: 'Оборона', color: '#7fc97f',
    nodes: [
      { id: 'd1', name: 'Каменная кладка', desc: '+50 HP стен', cost: 1 },
      { id: 'd2', name: 'Ремонтные бригады', desc: '+10 реген HP/день', cost: 2, req: 'd1' },
      { id: 'd3', name: 'Крепостной гарнизон', desc: '+120 HP стен', cost: 2, req: 'd2' },
      { id: 'd4', name: 'Вечная твердыня', desc: '+30% макс. HP стен', cost: 3, req: 'd3' },
    ],
  },
  {
    branch: 'Инженерия', color: '#4a7ad0',
    nodes: [
      { id: 'e1', name: 'Смазка механизмов', desc: 'Сооружения бьют на 15% чаще', cost: 1 },
      { id: 'e2', name: 'Тяжёлые снаряды', desc: 'Сооружения: +30% урона', cost: 2, req: 'e1' },
      { id: 'e3', name: 'Пороховые заряды', desc: 'Сооружения: +60% урона', cost: 2, req: 'e2' },
      { id: 'e4', name: 'Мастер цеха', desc: 'Сооружения: −25% перезарядки', cost: 3, req: 'e3' },
    ],
  },
];

export function createTreeState() {
  return {}; // { nodeId: true }
}

export function treeBonuses(treeState) {
  const b = {
    bowDmgMult: 1, critAoe: false,
    castleHpMult: 1, castleHpAdd: 0, regenAdd: 0,
    structDmgMult: 1, structCdMult: 1,
  };
  if (treeState.h1) b.bowDmgMult += 0.10;
  if (treeState.h2) b.critAoe = true;
  if (treeState.h3) b.bowDmgMult += 0.25;
  if (treeState.h4) b.bowDmgMult += 0.50;
  if (treeState.d1) b.castleHpAdd += 50;
  if (treeState.d2) b.regenAdd += 10;
  if (treeState.d3) b.castleHpAdd += 120;
  if (treeState.d4) b.castleHpMult += 0.30;
  if (treeState.e1) b.structCdMult *= 0.85;
  if (treeState.e2) b.structDmgMult *= 1.30;
  if (treeState.e3) b.structDmgMult *= 1.60;
  if (treeState.e4) b.structCdMult *= 0.75;
  return b;
}

export function nodeAvailable(node, treeState) {
  if (treeState[node.id]) return false;
  if (!node.req) return true;
  return !!treeState[node.req];
}
