// Типы врагов из Pixel Art Atlas: имя спрайта, масштаб в мире 640x360,
// множители скорости/HP и вес выпадения по дням.
// Спрайт 16x16 при k=2 даёт ~32px высоты — как нынешние нарисованные враги.
export const ATLAS_ENEMIES = [
  { key: 'ghoul',          k: 2, hpMult: 0.85, spdMult: 1.05, dmgMult: 0.9,  from: 1,  until: 4 },
  { key: 'zombie_soldier', k: 2, hpMult: 1.05, spdMult: 0.8,  dmgMult: 1.0,  from: 2,  until: 6 },
  { key: 'skeleton_warrior', k: 2, hpMult: 1.0, spdMult: 1.0, dmgMult: 1.0,  from: 3,  until: 99 },
  { key: 'goblin_warrior', k: 2, hpMult: 0.9, spdMult: 1.3,  dmgMult: 0.85, from: 4,  until: 99 },
  { key: 'wolf_warrior',   k: 2, hpMult: 1.1, spdMult: 1.55, dmgMult: 1.15, from: 6,  until: 99 },
  { key: 'orc_warrior',    k: 2, hpMult: 1.35, spdMult: 0.95, dmgMult: 1.25, from: 8,  until: 99 },
  { key: 'sorcerer',       k: 2, hpMult: 1.6, spdMult: 0.8,  dmgMult: 1.3,  from: 12, until: 99 },
  { key: 'orc_chieftain',  k: 3, hpMult: 2.2, spdMult: 0.85, dmgMult: 1.5,  from: 16, until: 99 },
  { key: 'demon_knight',   k: 2, hpMult: 2.0, spdMult: 1.1,  dmgMult: 1.6,  from: 20, until: 99 },
  { key: 'stone_golem',    k: 3, hpMult: 3.0, spdMult: 0.65, dmgMult: 1.8,  from: 25, until: 99 },
];

// Боссы, у которых есть спрайт в атласе (k подобран под нынешний размер босса).
export const ATLAS_BOSSES = {
  skeleton_king: { key: 'skeleton_king', k: 4 },
  ogre_chief:    { key: 'ogre_chief',    k: 4 },
  goblin_king:   { key: 'goblin_king',   k: 4 },
};

export function atlasEnemiesForDay(day) {
  return ATLAS_ENEMIES.filter((e) => day >= e.from && day <= e.until);
}
