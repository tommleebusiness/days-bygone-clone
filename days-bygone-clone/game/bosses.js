// Боссы: 5 типов с уникальными механиками.
// Каждый 5-й день — босс; тип чередуется по дню. Боссы сильнее, крупнее и
// дают больше золота/лута. Механики: рывок, призыв свиты, лечение от свиты,
// щит-броня, ядовитый выдох.

export const BOSS_TYPES = {
  ogre: {
    id: 'ogre', name: 'ОГР-ГРОМИЛА', title: 'ОГР ИДЁТ!',
    hpMult: 14, speedMult: 0.55, dmgMult: 4, goldMult: 12,
    size: 1.0, color: '#7a5c30',
    mechanic: 'rage',           // злится и ускоряется, когда мало HP
    desc: 'Огр. В ярости ускоряется вдвое.',
  },
  troll: {
    id: 'troll', name: 'ТРОЛЛЬ-ЛЕКАРЬ', title: 'ТРОЛЛЬ ПЛЕТЁТ ЗАКЛЯТЬЯ!',
    hpMult: 12, speedMult: 0.6, dmgMult: 3.2, goldMult: 11,
    size: 0.95, color: '#4a7a3a',
    mechanic: 'heal',           // периодически лечится
    desc: 'Тролль. Регенерирует HP, пока жив.',
  },
  necro: {
    id: 'necro', name: 'НЕКРОМАНТ', title: 'НЕКРОМАНТ ПРИЗЫВАЕТ МЁРТВЫХ!',
    hpMult: 10, speedMult: 0.45, dmgMult: 2.5, goldMult: 13,
    size: 1.0, color: '#6a3a8a',
    mechanic: 'summon',         // призывает скелетов
    desc: 'Некромант. Вызывает свиту скелетов.',
  },
  warlord: {
    id: 'warlord', name: 'ВОЕНАЧАЛЬНИК', title: 'ВОЕНАЧАЛЬНИК ВЕДЁТ ОРДУ!',
    hpMult: 18, speedMult: 0.5, dmgMult: 5, goldMult: 16,
    size: 1.15, color: '#8a3a2a',
    mechanic: 'armor',          // толстая броня, гасит урон
    desc: 'Военачальник. Тяжёлая броня: −35% получаемого урона.',
    armor: 0.35,
  },
  dragonling: {
    id: 'dragonling', name: 'ДРАКОНЧИК', title: 'ДРАКОНЧИК ПАРИТ НАД ЗЕМЛЁЙ!',
    hpMult: 13, speedMult: 0.75, dmgMult: 3.6, goldMult: 15,
    size: 1.05, color: '#a03a20',
    mechanic: 'flight',         // летит — стрелы частично промахиваются
    desc: 'Дракончик. Летит: 25% стрел промахиваются.',
    evade: 0.25,
  },
};

// какой босс на данном дне (циклично, чтобы все повидались)
export function bossForDay(day) {
  const order = ['ogre', 'troll', 'necro', 'warlord', 'dragonling'];
  const idx = Math.floor((day - 5) / 5) % order.length;
  return BOSS_TYPES[order[(idx + order.length) % order.length]];
}

export function isBossDay(day) {
  return day >= 5 && day % 5 === 0;
}
