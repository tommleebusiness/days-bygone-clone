// ============================================================
//  ДНИ МИНУВШИЕ — ОСАДА (клон Days Bygone, средневековая графика)
//  Эффекты и анимации — библиотека pixelfx (github.com/patch-gg/pixelfx)
// ============================================================

import { createFrame, clearFrame, createFx, composite, Painter } from "./vendor/pixelfx/core/index.js?v=2";
import * as weather from "./weather.js?v=4";
import * as boomFx from "./fx/small-boom.js?v=1";
import * as coinDropFx from "./vendor/pixelfx/fx/spawn/coin-drop.js?v=2";
import * as hitFlashFx from "./fx/small-hit.js?v=1";
import * as floatTextFx from "./fx/float-text.js?v=1";
import * as torchFx from "./fx/small-torch.js?v=4";

import { BAL, fmt, bowCost, fireRateCost, multishotCost, critCost, pierceCost, bowDmg }
  from "./balance.js?v=2";
import { hex } from "./vendor/pixelfx/core/color.js?v=2";
import { drawSky, drawGround, drawCastle, drawArcher, drawEnemy, drawSun, drawClouds, drawScenery } from "./sprites.js?v=14";
import { STRUCT_DEFS, createStructures, updateStructures, drawStructures, drawProjectiles,
         structCost, structCd, MAX_STRUCT_LVL }
  from "./structures.js?v=12";
import { rollItem, rollDrop, itemSellPrice, describeItem, createInventory, equipBonuses, drawLootDrop,
  SLOT_ORDER, SLOT_NAMES, UNIQUES }
  from "./loot.js?v=4";
import { BOSS_TYPES, bossForDay, isBossDay } from "./bosses.js?v=1";
import { initAudio, sfx, musicStart, musicStop, musicScene, toggleMusic, toggleSfx,
         isMusicOn, isSfxOn, audioState } from "./audio.js?v=3";
import { initMonetization, onMonetization, IAP_ITEMS, REWARDED, priceOf, isOwned, markOwned,
         buy as iapBuy, restore as iapRestore, showRewarded, showInterstitial, adsRemoved,
         setBanner, isAndroid, MON } from "./monetization.js?v=1";
import { ACHIEVEMENTS, pickDaily, todayKey, questProgress } from './quests.js?v=2';
import { drawParallax, deathParticles, critSparks, iceBurst, updateParticles, drawParticles }
  from "./fx/effects.js?v=2";
import { TREE, createTreeState, treeBonuses, nodeAvailable }
  from "./tree.js?v=2";
import { loadAtlas, atlasReady, atlasSprites, drawAtlasSprite } from "./atlas.js?v=1";
import { atlasEnemiesForDay, ATLAS_BOSSES } from "./atlas-enemies.js?v=1";

// босс → спрайт из атласа (id босса совпадает с ключом темы не везде)
const BOSS_SPR = {
  ogre:       'ogre_chief',
  troll:      'stone_golem',
  necro:      'sorcerer',
  warlord:    'orc_chieftain',
  dragonling: 'demon_knight',
};
const BOSS_SPR_K = { ogre: 4, troll: 4, necro: 4, warlord: 4, dragonling: 4 };

// ---------- Канвас ----------
// Мир рисуется в 640×360 — пиксель в 2 раза мельче, детализация выше
const W = 640, H = 360, GROUND = 296, WALL_X = 100;
const ARCHER = { x: 52, y: GROUND - 128 };      // стоит на верху стены
const BOW = { x: ARCHER.x + 16, y: ARCHER.y - 16 }; // точка вылета стрел
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const frame = createFrame(W, H);
const img = ctx.createImageData(W, H);

function fitScreen() {
  // сцена вписывается в область #stage (без панели магазина), пропорции 16:9 сохраняются
  const stage = document.getElementById('stage');
  const availW = (stage ? stage.clientWidth : innerWidth);
  const availH = (stage ? stage.clientHeight : innerHeight);
  const s = Math.min(availW / W, availH / H);
  const cssW = Math.max(1, Math.floor(W * s)), cssH = Math.max(1, Math.floor(H * s));
  canvas.style.width = cssW + 'px';
  canvas.style.height = cssH + 'px';
  canvas.style.left = Math.floor((availW - cssW) / 2) + 'px';
  canvas.style.top = Math.floor((availH - cssH) / 2) + 'px';
}
// режим узкого экрана по ширине контейнера (работает и в тестах, и на телефонах)
function checkNarrow() {
  const wrap = document.getElementById('wrap');
  if (!wrap) return;
  document.body.classList.toggle('narrow', wrap.clientWidth < 700);
  document.body.classList.toggle('short', wrap.clientHeight < 500);
  if (typeof updateSlotLabels === 'function') updateSlotLabels();
}
addEventListener('resize', () => { fitScreen(); checkNarrow(); });
addEventListener('orientationchange', () => setTimeout(() => { fitScreen(); checkNarrow(); }, 120));
fitScreen(); checkNarrow(); setTimeout(fitScreen, 60); setTimeout(() => { fitScreen(); checkNarrow(); }, 400);
// пересчёт сцены при изменении размеров панели магазина/HUD (важно на мобильных)
if (window.ResizeObserver) {
  const ro = new ResizeObserver(() => fitScreen());
  const shopEl = document.getElementById('shop');
  if (shopEl) ro.observe(shopEl);
  const wrapEl = document.getElementById('wrap');
  if (wrapEl) ro.observe(wrapEl);
}

// Полноэкранный режим сцены: F — вход/выход, кнопка в HUD
document.documentElement.classList.toggle('fullscreen', !!document.fullscreenElement);
document.addEventListener('fullscreenchange', () => {
  document.documentElement.classList.toggle('fullscreen', !!document.fullscreenElement);
  fitScreen();
});
// запрет контекстного меню/выделения на долгий тап в игре
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
document.getElementById('stage').addEventListener('contextmenu', (e) => e.preventDefault());

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen().catch(() => {});
}
addEventListener('keydown', e => { if (e.key === 'f' || e.key === 'F' || e.key === 'а' || e.key === 'А') toggleFullscreen(); });

// ---------- Состояние ----------
const state = {
  running: false,
  era: 0,
  gold: 50,
  day: 1,
  waveInDay: 0,
  castleHp: BAL.castleHp,
  up: { dmg: 0, rate: 0, multi: 0, crit: 0, pierce: 0 },
  structs: createStructures(),
  inv: createInventory(),
  tree: createTreeState(),
  skillPts: 0,
  loot: [],
  particles: [],
  projectiles: [],
  stats: { kills: 0, daysSurvived: 1, totalGold: 0, bossKills: 0, crits: 0, lootFound: 0 },
  time: 0,
  fireCooldown: 0,
  bowPull: 0, recoilT: 0, sparkT: 0,
  weather: weather.createWeather('clear'),
  firing: false,
  aim: -0.35,
  waveTimer: 2.5,
  spawnQueue: 0,
  spawnTimer: 0,
  bossPending: false,
  hitStop: 0,
  shakeT: 0,
  volleyCd: 0,       // кулдаун «Залпа»
  VOLLEY_CD: 25,     // секунд
  iap: {},           // купленные товары: {noads:1, vip:1, starter:1, ...}
  adGoldPending: 0,  // невыбранное золото за рекламу
  lastInterstitial: 0,
  ach: {},           // полученные достижения: {id: 1}
  daily: null,       // текущие задания: {date, snapshot, taken:{key:1}}
  seenAch: 0,        // сколько достижений было на момент последнего просмотра
};

// ---------- СОХРАНЕНИЕ ПРОГРЕССА (localStorage) ----------
const SAVE_KEY = 'dbs_save_v1';
function saveGame() {
  try {
    const d = {
      v: 1, era: state.era, gold: Math.round(state.gold), day: state.day,
      waveInDay: state.waveInDay, castleHp: state.castleHp,
      up: state.up, structs: state.structs, inv: state.inv,
      tree: state.tree, skillPts: state.skillPts,
      stats: state.stats, aim: state.aim,
      iap: state.iap, ach: state.ach, daily: state.daily,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(d));
  } catch (e) { /* приватный режим — играем без сейва */ }
}
function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const d = JSON.parse(raw);
    if (d.v !== 1) return false;
    state.era = d.era | 0; state.gold = d.gold | 0;
    state.day = d.day || 1; state.waveInDay = d.waveInDay | 0;
    state.up = Object.assign(state.up, d.up || {});
    if (d.iap) state.iap = Object.assign(state.iap || {}, d.iap);
    if (d.structs) state.structs = d.structs;
    if (d.inv) state.inv = d.inv;
    if (d.tree) state.tree = d.tree;
    state.skillPts = d.skillPts | 0;
    state.castleHp = Math.min(d.castleHp || maxCastleHp(), maxCastleHp());
    state.stats = Object.assign(state.stats, d.stats || {});
    if (d.ach) state.ach = d.ach;
    if (d.daily) state.daily = d.daily;
    if (typeof d.aim === 'number') state.aim = d.aim;
    return true;
  } catch (e) { return false; }
}
function wipeSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} }
// ---------- РЕКОРДЫ (живут между эпохами) ----------
const REC_KEY = 'dbs_records_v1';
function loadRecords() {
  try { return JSON.parse(localStorage.getItem(REC_KEY)) || { bestDay: 0, bestKills: 0, bestGold: 0, eras: 0 }; }
  catch (e) { return { bestDay: 0, bestKills: 0, bestGold: 0, eras: 0 }; }
}
function bumpRecords() {
  const r = loadRecords();
  let newRec = false;
  if (state.stats.daysSurvived > r.bestDay) { r.bestDay = state.stats.daysSurvived; newRec = true; }
  if (state.stats.kills > r.bestKills) { r.bestKills = state.stats.kills; newRec = true; }
  if (state.stats.totalGold > r.bestGold) { r.bestGold = Math.round(state.stats.totalGold); newRec = true; }
  try { localStorage.setItem(REC_KEY, JSON.stringify(r)); } catch (e) {}
  return newRec;
}

// автосейв каждые 20с
setInterval(() => { if (state.running) saveGame(); }, 20000);
window.addEventListener('pagehide', () => { if (state.running) saveGame(); });

const enemies = [], arrows = [], fxs = [];

const dmgLvl = () => state.up.dmg;
const fireRateBaseNow = () => Math.min(BAL.fireRateCap, BAL.fireRateBase + state.up.rate * BAL.fireRatePerLvl);
const fireRate = () => fireRateBaseNow() * EB().rate;   // перчатки ускоряют стрельбу
const arrowsPerShot = () => 1 + state.up.multi + TB().extraArrows + EB().extraArrow;
const critChance = () => Math.min(BAL.critCap, BAL.critChanceBase + state.up.crit * BAL.critPerLvl);
const pierce = () => state.up.pierce + TB().pierceAdd + EB().pierceAdd;

// ---------- Визуал экипировки на герое ----------
// цвет материала по редкости: обычное — кожа/дерево, дальше металл, золото, свет
const GEAR_TIERS = [
  null,                                                    // 0 базовое — без изменений
  null,                                                    // 1 обычное — тоже без эффектов
  { metal: '#8a8f7a', dark: '#4e5344', accent: null },      // 2 необычное (зелёный металл)
  { metal: '#7f9bc4', dark: '#40567a', accent: null },      // 3 редкое (синяя сталь)
  { metal: '#a97fd0', dark: '#5a3a7c', accent: '#e0b0ff' }, // 4 эпическое (фиолетовое)
  { metal: '#f0b45a', dark: '#8a5a1a', accent: '#fff0a8' }, // 5 легендарное (золото)
];
function gearPal(slot) {
  const it = state.inv[slot];
  if (!it || it.rar < 2) return null;
  const t = GEAR_TIERS[Math.min(5, it.rar)];
  if (!t) return null;
  return [hex(t.metal), hex(t.dark), t.accent ? hex(t.accent) : null];
}
function heroGear() {
  const helm = gearPal('helmet') || gearPal('shoulders');
  const body = gearPal('armor') || gearPal('shoulders');
  const capeSrc = state.inv.armor || state.inv.shoulders;
  let cape = null;
  if (capeSrc && capeSrc.rar >= 2) {
    const t = GEAR_TIERS[Math.min(5, capeSrc.rar)];
    cape = [hex(t.dark), hex(t.metal)];
  }
  // аура: максимум из надетых редкостей (только 4-5)
  let best = 0;
  for (const s of ['weapon','helmet','armor','gloves','boots','ring','trinket','shoulders','belt','kneepads']) {
    const it = state.inv[s];
    if (it && it.rar > best) best = it.rar;
  }
  const aura = best >= 4
    ? { col: hex(GEAR_TIERS[best].metal), k: best === 5 ? 1 : 0.7 }
    : null;
  return {
    helm, body, cape,
    boot: gearPal('boots'), glove: gearPal('gloves'), bow: gearPal('weapon'),
    aura,
  };
}
const weaponKind = () => (state.inv.weapon && state.inv.weapon.kind) || 'short';
// редкость оружия определяет богатство эффекта снаряда (0..5)
const weaponRar = () => {
  const w = state.inv && state.inv.weapon;
  if (!w) return 0;
  // уникальные легендарки всегда 5
  return (w.unique ? 5 : (w.rar | 0));
};

// ---------- Крошечные стрелы (рисуются кодом, зависят от оружия) ----------
// Вид снаряда зависит от оружия (kind) и его редкости (rar 0..5).
// Чем выше редкость — тем богаче эффект: трейл, свечение, искры, аура.
const ARROW_STYLE = {
  short: { wood: 0x8a6a3d, head: 0xe8e8f0, fletch: 0xd8d0c0, len: 7, trail: null },
  long:  { wood: 0x7a5a32, head: 0xe8e8f0, fletch: 0xc94f3d, len: 9, trail: null },
  bolt:  { wood: 0x57401f, head: 0xe8e8f0, fletch: 0xa8b0c0, len: 6, trail: 0x9aa8c0 },
  heavy: { wood: 0x4a3418, head: 0xd8d8e8, fletch: 0x837c8c, len: 8, trail: 0x6a6058 },
  arcane:{ wood: 0x6a3a9a, head: 0xd8a8ff, fletch: 0x9a4fe0, len: 7, trail: 0xc98af5 },
};

function drawArrow(p, a) {
  const x = Math.round(a.x), y = Math.round(a.y);
  const ang = Math.atan2(a.vy, a.vx);
  const dx = Math.cos(ang), dy = Math.sin(ang);
  const k = a.kind || 'short';
  const rar = a.rar | 0;
  const st = ARROW_STYLE[k] || ARROW_STYLE.short;
  const L = st.len;

  // ---- ТРЕЙЛ: тянется за стрелой, длина и цвет зависят от редкости
  const trailN = st.trail ? Math.min(14, 4 + rar * 2) : (rar >= 3 ? 4 : 0);
  for (let i = 1; i <= trailN; i++) {
    const f = i / (trailN + 1);
    const tx = Math.round(x - dx * (L + i * 2.2));
    const ty = Math.round(y - dy * (L + i * 2.2));
    const alpha = (1 - f) * (0.20 + rar * 0.10);
    const col = st.trail || (rar >= 4 ? 0xffd166 : 0x9aa8c0);
    p.dot(tx, ty, col, alpha);
    // «двойной» след на высоких редкостях
    if (rar >= 4) p.dot(tx, ty + 1, col, alpha * 0.55);
  }

  // ---- АУРА вокруг стрелы (эпик и выше)
  if (rar >= 4) {
    const pulse = 0.35 + 0.25 * Math.sin((a.x + a.y) * 0.25);
    p.dot(x, y, rar >= 5 ? 0xfff0a8 : 0xc98af5, pulse);
    p.dot(Math.round(x - dx), Math.round(y - dy), rar >= 5 ? 0xffd166 : 0x9a4fe0, pulse * 0.7);
  }

  // ---- древко
  const tailX = Math.round(x - dx * L), tailY = Math.round(y - dy * L);
  p.line(tailX, tailY, x, y, k === 'arcane' && rar >= 3 ? 0x8a4fe0 : st.wood);
  // блик по древку у редких
  if (rar >= 2) {
    p.put(Math.round(x - dx * (L * 0.55)), Math.round(y - dy * (L * 0.55)), 0xfff0c0, 0.35);
  }

  // ---- наконечник (с доп. свечением на легендарке)
  const tipX = Math.round(x + dx * 2), tipY = Math.round(y + dy * 2);
  if (rar >= 5) {
    p.dot(tipX, tipY, 0xfff0a8, 0.55);
    p.put(tipX - 1, tipY, 0xffd166, 0.7);
  }
  p.put(tipX, tipY, st.head);

  // ---- оперение
  const px = -dy, py = dx;
  const fcol = rar >= 3 ? (rar >= 5 ? 0xffd166 : 0xc98af5) : st.fletch;
  p.put(tailX, tailY, fcol);
  if (k === 'long' || rar >= 3) {
    p.put(Math.round(tailX + px), Math.round(tailY + py), fcol);
    p.put(Math.round(tailX - px), Math.round(tailY - py), fcol);
  }
  if (rar >= 3) {
    // светящиеся кончики оперения
    p.dot(tailX, tailY, rar >= 5 ? 0xffe08a : 0xd8a8ff, 0.45);
  }
  if (k === 'heavy') p.put(Math.round(x - dx), Math.round(y - dy), 0x837c8c);
  if (k === 'arcane') p.dot(Math.round(x - dx * 3), Math.round(y - dy * 3), 0xe8d0ff, 0.6 + rar * 0.05);

  // ---- искры при высоких редкостях (мерцание нерегулярное)
  if (rar >= 4) {
    for (let i = 0; i < rar; i++) {
      const ph = Math.sin((a.x * 0.7 + a.y * 1.3 + i * 2.1));
      if (ph > 0.35) {
        const sx = Math.round(x - dx * (6 + i * 3)) + (i % 2 ? 1 : -1);
        const sy = Math.round(y - dy * (6 + i * 3));
        p.dot(sx, sy, rar >= 5 ? 0xffffff : 0xe8c8ff, ph * 0.6);
      }
    }
  }
  if (a.crit) p.put(x, y, 0xf4c542);
}
// бонусы экипировки и дерева навыков
const EB = () => equipBonuses(state.inv);
const TB = () => treeBonuses(state.tree);
// VIP-статус («Хранитель») даёт +25% золота и +10% урона
const VIP_GOLD = () => (MON.vip ? 1.25 : 1);
const VIP_DMG = () => (MON.vip ? 1.10 : 1);
const totalBowDmg = () => bowDmg(dmgLvl(), state.era) * EB().dmg * TB().bowDmgMult * VIP_DMG();
const totalCrit = () => Math.min(0.85, critChance() + EB().crit + TB().critAdd);
const maxCastleHp = () => Math.round((BAL.castleHp + TB().castleHpAdd) * TB().castleHpMult);

// ---------- Эффекты ----------
function spawnFx(mod, opts) {
  fxs.push(createFx(mod, opts));
}
function coinFx(x, y) {
  sfx('coin');
  spawnFx(coinDropFx, { x: Math.round(x), y: Math.round(y), seed: (Math.random() * 1e9) | 0 });
}
function hitFx(x, y, crit, dmg) {
  spawnFx(hitFlashFx, { x: Math.round(x), y: Math.round(y), seed: (Math.random() * 100) | 0 });
  if (crit && dmg !== undefined) {
    // компактный всплывающий текст с уроном вместо гигантского «КРИТ!»
    spawnFx(floatTextFx, { x: Math.round(x), y: Math.round(y - 2), text: shortNum(dmg) + '!', crit: true });
  }
}
// компактные числа: 12.4K вместо 12431
function shortNum(n) {
  if (n < 10000) return String(Math.round(n));
  if (n < 1e6) return (n / 1e3).toFixed(1).replace('.', ',') + 'К';
  return (n / 1e6).toFixed(1).replace('.', ',') + 'М';
}
// эффекты для сооружений: 'boom' | 'fire' | 'hit'
function ctxSpawn(kind, x, y) {
  if (kind === 'boom') spawnFx(boomFx, { x, y: y - 2, seed: (Math.random() * 999) | 0 });
  else if (kind === 'fire') spawnFx(boomFx, { x, y, seed: (Math.random() * 999) | 0 });
  else spawnFx(hitFlashFx, { x, y, seed: (Math.random() * 100) | 0 });
}

// ---------- Враги ----------
function startWave() {
  state.waveInDay++;
  const day = state.day;
  const isBossWave = state.waveInDay === BAL.wavesPerDay && day % 1 === 0;
  state.spawnQueue = Math.round(BAL.enemiesBase + (day - 1) * BAL.enemiesPerDay);
  state.bossPending = isBossWave;
  state.spawnTimer = 0;
  document.getElementById('waveNum').textContent = state.waveInDay;
}

function spawnEnemy() {
  const day = state.day;
  const roll = Math.random();
  // предпочтение — врагам из атласа, если спрайты загрузились
  const pool = atlasReady() ? atlasEnemiesForDay(day) : [];
  let kind = day >= 3 && roll < 0.45 ? 'orc' : 'knight';
  let spr = null;
  if (pool.length) {
    // чем «новее» тип, тем меньше шанс (старые враги остаются массовкой)
    const weights = pool.map((e, i) => Math.pow(2.2, i));
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total, pickI = 0;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r <= 0) { pickI = i; break; }
    }
    spr = pool[pickI];
    kind = 'atlas';
  }
  const hp = Math.round(BAL.enemyHp(day, state.waveInDay) * (spr ? spr.hpMult : 1));
  enemies.push({
    kind, x: W + 10, y: GROUND,
    hp, maxHp: hp,
    speed: BAL.enemySpeed(day) * (kind === 'orc' ? 1.25 : 1) * (spr ? spr.spdMult : 1),
    walkT: Math.random() * 10,
    dmg: Math.round(BAL.enemyDmg(day) * (spr ? spr.dmgMult : 1)),
    gold: BAL.enemyGold(day, false),
    attacking: false,
    atkT: 0,
    sprKey: spr ? spr.key : null,
    sprK: spr ? spr.k : 2,
    sprVari: (Math.random() * 3) | 0,
  });
}

function spawnBoss(forceId) {
  const b = forceId ? BOSS_TYPES[forceId] : bossForDay(state.day);
  const hp = Math.round(BAL.enemyHp(state.day, BAL.wavesPerDay) * b.hpMult);
  enemies.push({
    kind: 'boss', bossId: b.id, isBoss: true, bossName: b.name,
    x: W + 14, y: GROUND,
    hp, maxHp: hp,
    speed: BAL.enemySpeed(state.day) * b.speedMult,
    walkT: 0,
    dmg: BAL.enemyDmg(state.day) * b.dmgMult,
    gold: Math.round(BAL.enemyGold(state.day, true) * (b.goldMult / 12)),
    attacking: false, atkT: 0,
    armor: b.armor || 0, evade: b.evade || 0,
    mechanic: b.mechanic, mechT: 3.0, summonT: 4.0,
    size: b.size,
    sprKey: atlasReady() ? (BOSS_SPR[b.id] || null) : null,
    sprK: BOSS_SPR_K[b.id] || 4,
    sprVari: (Math.random() * 3) | 0,
  });
  sfx('boss');
  toast(`⚠ ${b.title}`);
  state.shakeT = 0.6;
  state.bossActive = true;
}

// ---------- Стрельба ----------
const ARROW_G = 120;
// АКТИВНАЯ СПОСОБНОСТЬ «ЗАЛП»: 3 волны стрел веером по всем врагам
function fireVolley() {
  if (!state.running || state.volleyCd > 0) return;
  state.volleyCd = state.VOLLEY_CD;
  const targets = enemies.filter(e => !e.dead && e.x > WALL_X - 10);
  if (!targets.length) { toast('Некуда стрелять!'); return; }
  for (let wave = 0; wave < 3; wave++) {
    setTimeout(() => {
      if (!state.running) return;
      for (const e of targets) {
        if (e.dead) continue;
        const crit = Math.random() < totalCrit() * 1.4;
        const dmg = totalBowDmg() * 0.8 * (crit ? 2.5 : 1) * TB().bossDmgMult * (e.armor ? (1 - e.armor) : 1);
        state.firing = true;
        arrows.push({
          x: BOW.x, y: BOW.y,
          vx: Math.cos(state.aim) * BAL.arrowSpeed * 0.9,
          vy: Math.sin(state.aim) * BAL.arrowSpeed * 0.9,
          dmg: 0, crit,            // прямой урон ниже; стрелы летят для визуала
          pierceLeft: 0, hitIds: new Set(),
          kind: weaponKind(), rar: weaponRar(), volley: { target: e, dmg },
        });
      }
      state.shakeT = Math.max(state.shakeT, 0.15);
    }, wave * 350);
  }
  sfx('volley');
  toast('🏹 ЗАЛП!');
}

function shoot() {
  const n = arrowsPerShot();
  // цель — ближайший враг перед стеной
  let target = null;
  for (const e of enemies) if (!e.dead && e.x > WALL_X + 28 && (!target || e.x < target.x)) target = e;
  const sx = BOW.x, sy = BOW.y;
  let baseA = state.aim;
  if (target) {
    // баллистика: попадаем в центр врага с компенсацией гравитации
    const tx = target.x, ty = target.y - (target.kind === 'ogre' ? 9 : 6);
    const t = (tx - sx) / BAL.arrowSpeed;
    const vy = (ty - sy - 0.5 * ARROW_G * t * t) / t;
    baseA = Math.atan2(vy, BAL.arrowSpeed);
  }
  for (let i = 0; i < n; i++) {
    const spread = (i - (n - 1) / 2) * 0.10;
    const a = baseA + spread;
    const crit = Math.random() < totalCrit();
    arrows.push({
      x: sx, y: sy,
      vx: Math.cos(a) * BAL.arrowSpeed,
      vy: Math.sin(a) * BAL.arrowSpeed,
      dmg: totalBowDmg() * (crit ? 2.5 : 1),
      crit,
      pierceLeft: pierce(),
      hitIds: new Set(),
      kind: weaponKind(),                 // вид стрелы зависит от оружия
      rar: weaponRar(),                   // редкость → эффект снаряда
    });
  }
  state.firing = true;
  sfx('shot');
}

// ---------- Урон/смерть/лут ----------
// уклонение босса-дракончика: часть стрел уходит в молоко
// залповые стрелы наносят урон при подлёте к цели (визуальный полёт)
function volleyTick(a, dt) {
  if (!a.volley) return false;
  const t = a.volley.target;
  if (!t || t.dead) { a.dead = true; return true; }
  const dx = t.x - a.x, dy = (t.y - 10) - a.y;
  if (dx * dx + dy * dy < 144) {
    damageEnemy(t, a.volley.dmg, a.crit);
    a.dead = true;
    return true;
  }
  // доводка по цели
  const sp = Math.hypot(a.vx, a.vy);
  const d = Math.hypot(dx, dy) || 1;
  a.vx = dx / d * sp; a.vy = dy / d * sp;
  return false;
}

function enemyEvades(e) {
  return e.evade > 0 && Math.random() < e.evade;
}
function damageEnemy(e, dmg, crit = false) {
  if (e.dead) return;
  // бонус урона по боссам (узел «Клеймо охотника»)
  if (e.isBoss) dmg *= TB().bossDmgMult;
  // броня босса гасит часть урона
  if (e.armor) dmg *= (1 - e.armor);
  e.hp -= dmg;
  e.hitT = 0.12;
  hitFx(e.x, e.y - (e.isBoss ? 26 : 12), crit, dmg);
  sfx(crit ? 'crit' : 'hit');
  if (crit) {
    state.stats.crits = (state.stats.crits || 0) + 1;
    state.particles.push(...critSparks(e.x, e.y - 14, state.stats.kills));
  }
  // вампиризм: криты лечат стену (узел «Вампиризм»)
  const ls = TB().lifesteal + EB().lifesteal;
  if (crit && ls > 0) {
    state.castleHp = Math.min(maxCastleHp(), state.castleHp + ls);
  }
  // критический взрыв (узел «Разрывная стрела»)
  if (crit && EB().freeze && !e.isBoss) {
    e.frozen = 1.4;
    state.particles.push(...iceBurst(e.x, e.y - 12));
  }
  if (crit && TB().critAoe) {
    for (const o of enemies) {
      if (o === e || o.dead) continue;
      if (Math.abs(o.x - e.x) < 20) damageEnemy(o, dmg * 0.5, false);
    }
    spawnFx(hitFlashFx, { x: Math.round(e.x), y: Math.round(e.y - 12), seed: 7 });
  }
  if (e.hp <= 0 && !e.dead) {
    e.dead = true;
    const goldMult = (weather.weatherMods(state.weather?.kind ?? 'clear').gold ?? 1) * TB().goldMult * (1 + EB().goldBoost) * VIP_GOLD();
    const g = Math.round(e.gold * goldMult);
    state.gold += g;
    state.stats.kills++;
    if (e.isBoss) state.stats.bossKills = (state.stats.bossKills || 0) + 1;
    state.stats.totalGold += g;
    coinFx(e.x, e.y - 8);
    sfx(e.isBoss ? 'bossKill' : 'kill');
    // разлёт костей/праха при смерти
    const kindTag = e.isBoss ? 'boss' : e.kind === 'skeleton' ? 'skeleton' : 'normal';
    state.particles.push(...deathParticles(e.x, e.y - 6, kindTag, state.stats.kills));
    if (e.isBoss) { state.shakeT = Math.max(state.shakeT, 0.5); }
    state.hitStop = 0.045;
    maybeDropLoot(e);
    updateHud();
  }
}

function maybeDropLoot(e) {
  const boss = e.isBoss || e.kind === 'boss';
  // шанс дропа: обычный враг 12%, босс — всегда
  if (!boss && Math.random() > 0.12) return;
  const rolls = boss ? 2 + TB().bossExtraLoot : 1;
  for (let i = 0; i < rolls; i++) {
    const item = rollDrop(state.day, boss && Math.random() < 0.5);
    state.loot.push({ x: e.x + (i - rolls / 2) * 8, y: e.y - 8, item, t: 0 });
    state.stats.lootFound = (state.stats.lootFound || 0) + 1;
  }
}

function updateLoot(dt) {
  for (let i = state.loot.length - 1; i >= 0; i--) {
    const d = state.loot[i];
    d.t += dt;
    d.y = Math.max(280, d.y - dt * 16);        // падает на землю
    if (d.t > 1.2) {                           // авто-подбор
      state.inv.bag.push(d.item);
      state.loot.splice(i, 1);
      spawnFx(hitFlashFx, { x: Math.round(d.x), y: Math.round(d.y) });
      sfx('loot');
      toast(`🎁 ${d.item.name} — ${describeItem(d.item)}`);
      renderInventory();
    }
  }
}

// ---------- Эпоха ----------
function endEra() {
  state.running = false;
  sfx('gameover');
  musicStop();
  saveGame();
  const isRecord = bumpRecords();
  const r = loadRecords();
  document.getElementById('eraStats').innerHTML =
    `Дней пережито: <b>${state.stats.daysSurvived}</b> · Врагов повержено: <b>${state.stats.kills}</b> ·` +
    ` Золота добыто: <b>${fmt(state.stats.totalGold)}</b> · Эпоха: <b>${state.era}</b>` +
    (isRecord ? '<br><span class="newrec">🏆 НОВЫЙ РЕКОРД!</span>' : '') +
    `<br><span class="recsum">Рекорды: день <b>${r.bestDay}</b> · убийств <b>${r.bestKills}</b> · золота <b>${fmt(r.bestGold)}</b></span>`;
  document.getElementById('eraScreen').style.display = 'flex';
  maybeInterstitial();   // межстраничная реклама на крупном событии (с антиспамом 90 c)
}

function newEra() {
  state.era++;
  const rec = loadRecords(); rec.eras = state.era;
  try { localStorage.setItem(REC_KEY, JSON.stringify(rec)); } catch (e) {}
  wipeSave();
  state.volleyCd = 0;
  const legacy = BAL.eraLegacy(state.era);
  state.gold = legacy.startGold;
  state.day = 1; state.waveInDay = 0;
  state.castleHp = maxCastleHp();
  state.up = { dmg: 0, rate: 0, multi: 0, crit: 0, pierce: 0 };
  state.structs = createStructures();
  state.inv = createInventory();
  state.tree = createTreeState();
  state.skillPts = 0;
  state.loot = []; state.projectiles = [];
  state.castleHp = maxCastleHp();
  state.stats = { kills: 0, daysSurvived: 1, totalGold: 0 };
  enemies.length = 0; arrows.length = 0; fxs.length = 0;
  buildTree(); buildInventoryUI(); buildStructShop();
  state.waveTimer = 2.5;
  document.getElementById('eraScreen').style.display = 'none';
  state.running = true;
  buildShop(); updateHud();
  sfx('era');
  musicStart('calm');
  toast(`Эпоха ${state.era}: лук унаследовал силу ×${legacy.startDmgMult.toFixed(1)}`);
}

// ---------- Магазин ----------
const SHOP_DEFS = [
  { key: 'dmg',   name: 'Тетива',      desc: 'Урон стрелы ×1.45',  cost: () => bowCost(state.up.dmg),     lvl: () => state.up.dmg },
  { key: 'rate',  name: 'Скорострельность', desc: '+0.25 выстр/сек', cost: () => fireRateCost(state.up.rate), lvl: () => state.up.rate },
  { key: 'multi', name: 'Веер стрел',  desc: '+1 стрела',          cost: () => multishotCost(state.up.multi), lvl: () => state.up.multi, max: BAL.multishotMax },
  { key: 'crit',  name: 'Меткий глаз', desc: '+3% шанс крита ×2.5', cost: () => critCost(state.up.crit),   lvl: () => state.up.crit, max: Math.floor((BAL.critCap - BAL.critChanceBase) / BAL.critPerLvl) },
  { key: 'pierce',name: 'Бронебойная', desc: 'Стрела пробивает +1', cost: () => pierceCost(state.up.pierce), lvl: () => state.up.pierce },
];

function buildShop() {
  const shop = document.getElementById('shop');
  shop.innerHTML = '';
  for (const def of SHOP_DEFS) {
    const el = document.createElement('div');
    el.className = 'up';
    el.dataset.key = def.key;
    bindTap(el, () => buy(def));
    shop.appendChild(el);
  }
  renderShop();
  buildStructShop();
}

function buy(def) {
  if (!state.running) return;
  const maxed = def.max !== undefined && def.lvl() >= def.max;
  const cost = def.cost();
  if (maxed || state.gold < cost) return;
  state.gold -= cost;
  state.up[def.key]++;
  sfx('buy');
  renderShop(); updateHud();
}

function renderShop() {
  for (const def of SHOP_DEFS) {
    const el = document.querySelector(`.up[data-key="${def.key}"]`);
    if (!el) continue;
    const maxed = def.max !== undefined && def.lvl() >= def.max;
    const cost = def.cost();
    el.classList.toggle('no', maxed || state.gold < cost || !state.running);
    el.innerHTML = `<div class="t">${def.name}</div>` +
      `<div class="lvl">ур. ${def.lvl()}${def.max !== undefined ? '/' + def.max : ''}</div>` +
      (maxed ? `<div class="desc">МАКСИМУМ</div>` : `<div class="cost">🪙 ${fmt(cost)}</div>`) +
      `<div class="desc">${def.desc}</div>`;
  }
}

// ---------- Сооружения (магазин) ----------
function buildStructShop() {
  const shop = document.getElementById('shop');
  shop.querySelectorAll('.up[data-skey]').forEach(e => e.remove());
  for (const def of STRUCT_DEFS) {
    const el = document.createElement('div');
    el.className = 'up struct';
    el.dataset.skey = def.key;
    bindTap(el, () => buyStruct(def));
    shop.appendChild(el);
  }
  renderStructShop();
}
function buyStruct(def) {
  if (!state.running) return;
  const s = state.structs.find(x => x.key === def.key);
  if (s.lvl >= MAX_STRUCT_LVL) return;              // максимум: легендарный вид достигнут
  const cost = structCost(def, s.lvl);
  if (state.gold < cost) return;
  state.gold -= cost;
  s.lvl++;
  sfx('build');
  if (s.lvl >= MAX_STRUCT_LVL) {
    // легендарный уровень — корона и парящие камни
    sfx('bossKill');
    state.shakeT = Math.max(state.shakeT || 0, 0.35);
    toast(`👑 ${def.name}: ЛЕГЕНДАРНЫЙ ур. ${MAX_STRUCT_LVL}!`);
    for (let i = 0; i < 18; i++) {
      state.particles.push({
        x: def.x + (Math.random() - 0.5) * 44,
        y: GROUND - 70 - Math.random() * 50,
        vx: (Math.random() - 0.5) * 60,
        vy: -40 - Math.random() * 50,
        life: 0.9, max: 0.9, col: 0xffe08a, size: 1,
      });
    }
  } else if (s.lvl === 1) {
    toast(`🏗 ${def.name} построено!`);
  } else {
    const tier = s.lvl === 3 ? ' · ✨ золотая отделка'
      : s.lvl === 6 ? ' · 🏰 второй ярус'
      : s.lvl === 9 ? ' · 🗼 шпили и самоцветы'
      : s.lvl === 12 ? ' · 🔮 руны и страж'
      : '';
    toast(`${def.name} улучшено до ур. ${s.lvl}${tier}`);
  }
  renderStructShop(); updateHud();
}
function renderStructShop() {
  for (const def of STRUCT_DEFS) {
    const el = document.querySelector(`.up[data-skey="${def.key}"]`);
    if (!el) continue;
    const s = state.structs.find(x => x.key === def.key);
    const isMax = s.lvl >= MAX_STRUCT_LVL;
    const cost = structCost(def, s.lvl);
    el.classList.toggle('no', isMax || state.gold < cost || !state.running);
    el.classList.toggle('maxed', isMax);
    // название визуального тира — чтобы апгрейд читался не только цифрой
    const tierName = ['золотая отделка', 'второй ярус', 'шпили и самоцветы', 'руны и страж', 'ЛЕГЕНДА'][
      Math.min(4, Math.floor(Math.max(0, s.lvl - 1) / 3))];
    el.innerHTML = `<div class="t">${def.name}</div>` +
      `<div class="lvl">${s.lvl === 0 ? 'не построено' : 'ур. ' + s.lvl + (isMax ? ' / ' + MAX_STRUCT_LVL : '')}</div>` +
      (isMax ? `<div class="cost maxedCost">👑 МАКС</div>` : `<div class="cost">🪙 ${fmt(cost)}</div>`) +
      `<div class="desc">${isMax ? tierName : def.desc}${s.lvl && !isMax ? ' · ' + (structCd(def, s.lvl)).toFixed(1) + 'с' : ''}</div>`;
  }
}

// ---------- Инвентарь ----------
// 6 редкостей: базовое → легендарное
const RAR = {
  0: { name: 'базовое',     col: '#9a938a', gem: '#a8a8a8' },
  1: { name: 'обычное',     col: '#c8cdd8', gem: '#c8cdd8' },
  2: { name: 'необычное',   col: '#7fc97f', gem: '#4a9e4a' },
  3: { name: 'редкое',      col: '#6fb1f2', gem: '#3f8fe8' },
  4: { name: 'эпическое',   col: '#c98af5', gem: '#9a4fe0' },
  5: { name: 'легендарное', col: '#f4a742', gem: '#e07020' },
};
// Пиксельная иконка предмета 14×14 (рисуем на canvas)
// Иконки предметов из Pixel Art Atlas (CC0). Грузятся один раз, рисуются поверх
// процедурной графики; если картинка не загрузилась — остаётся нарисованная кодом.
const itemIcons = {};      // slot -> [HTMLImageElement|null, ...]
let itemIconsReady = false;
const ITEM_SLOTS = ['weapon','helmet','armor','gloves','boots','belt','ring','trinket',
                    'shoulders','kneepads','arrow','potion'];
function loadItemIcons(base = 'assets/items/') {
  if (itemIconsReady) return Promise.resolve(itemIcons);
  const jobs = [];
  for (const s of ITEM_SLOTS) {
    itemIcons[s] = [];
    for (let n = 0; n < 2; n++) {
      jobs.push(new Promise((res) => {
        const im = new Image();
        im.onload = () => { itemIcons[s][n] = im; res(); };
        im.onerror = () => { itemIcons[s][n] = null; res(); };
        im.src = `${base}${s}_${n}.png`;
      }));
    }
  }
  return Promise.all(jobs).then(() => { itemIconsReady = true; return itemIcons; });
}
// вариант иконки выбираем детерминированно по uid — чтобы у предмета всегда был свой вид
function iconVariant(item) {
  let h = 0;
  const s = String(item.uid || item.name || 'x');
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 2;
}
function drawAtlasItemIcon(cv, item) {
  const list = itemIcons[item.slot];
  if (!itemIconsReady || !list) return false;
  const img = list[iconVariant(item)] || list[0];
  if (!img) return false;
  const S = 16;
  cv.width = S; cv.height = S;
  const g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.clearRect(0, 0, S, S);
  // Вписываем предмет в квадрат по «площади», а не по одной оси:
  // иначе меч (узкий и высокий) сжимается в тонкую полоску.
  // Целевое заполнение — около 88% ячейки по большей стороне.
  const b = iconBox(img);
  const TARGET = 14;                        // из 16 px ячейки
  let k = Math.min(TARGET / b.w, TARGET / b.h);
  // если предмет очень вытянутый, разрешаем занять почти всю ячейку по длинной стороне
  const long = Math.max(b.w, b.h), short = Math.min(b.w, b.h);
  if (short > 0 && long / short > 2.2) k = Math.min(15 / long, TARGET / short * 1.0);
  let dw = Math.max(1, Math.round(b.w * k));
  let dh = Math.max(1, Math.round(b.h * k));
  dw = Math.min(16, dw); dh = Math.min(16, dh);
  const dx = Math.round((S - dw) / 2), dy = Math.round((S - dh) / 2);
  g.drawImage(img, b.x, b.y, b.w, b.h, dx, dy, dw, dh);
  return true;
}

// Границы непрозрачных пикселей спрайта (кэшируется).
const _iconBoxCache = new WeakMap();
function iconBox(img) {
  if (_iconBoxCache.has(img)) return _iconBoxCache.get(img);
  let box = { x: 0, y: 0, w: img.width, h: img.height };
  try {
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
    for (let y = 0; y < c.height; y++) {
      for (let x = 0; x < c.width; x++) {
        if (d[(y * c.width + x) * 4 + 3] > 8) {
          if (x < x0) x0 = x; if (x > x1) x1 = x;
          if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
      }
    }
    if (x1 >= x0 && y1 >= y0) {
      box = { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
    }
  } catch (e) { /* canvas недоступен — рисуем как есть */ }
  _iconBoxCache.set(img, box);
  return box;
}

function drawItemIcon(cv, item) {
  if (drawAtlasItemIcon(cv, item)) return;
  cv.width = 14; cv.height = 14;
  const g = cv.getContext('2d');
  const px = (x, y, c) => { g.fillStyle = c; g.fillRect(x, y, 1, 1); };
  const rc = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  const rar = RAR[item.rar];
  const steel = '#c8cdd8', steelD = '#7d8595', gold = '#e0b13e', wood = '#6e4422', dark = '#1a1408';
  if (item.slot === 'weapon' && /лук/i.test(item.name)) {
    // лук: дуга + тетива + стрела
    const bowC = rar.gem;
    px(4, 2, bowC); px(3, 3, bowC); px(3, 4, bowC); px(3, 5, bowC);
    px(3, 8, bowC); px(3, 9, bowC); px(3, 10, bowC); px(4, 11, bowC);
    px(5, 2, bowC); px(5, 11, bowC); px(6, 1, bowC); px(6, 12, bowC);
    for (let y = 2; y <= 11; y++) px(9, y, '#d8d0c0');   // тетива
    rc(6, 6, 6, 1, wood); px(12, 6, steel);               // стрела
    px(5, 6, steel);
  } else if (item.slot === 'weapon') {
    // меч: клинок по диагонали, гарда, рукоять
    for (let i = 0; i < 7; i++) {
      px(4 + i, 10 - i, steel); px(5 + i, 10 - i, steelD);
    }
    px(11, 2, '#ffffff');
    px(4, 10, gold); px(5, 11, gold); px(3, 9, gold); px(6, 10, gold); px(5, 9, gold);
    px(3, 12, wood); px(2, 13, wood); px(2, 12, woodD2());
    px(1, 13, gold);
  } else if (item.slot === 'helmet') {
    // шлем: купол с гребнем
    rc(4, 5, 7, 5, steel); rc(5, 3, 5, 2, steel);
    rc(4, 5, 7, 1, '#e4e9f2'); rc(6, 2, 2, 2, rar.gem);      // гребень
    px(4, 8, steelD); px(10, 8, steelD); px(4, 9, steelD); px(10, 9, steelD);
    rc(6, 7, 3, 2, dark);                                     // прорезь
    px(3, 6, steelD); px(11, 6, steelD);
  } else if (item.slot === 'gloves') {
    // перчатка с манжетой
    rc(4, 4, 5, 6, rar.gem === '#a8a8a8' ? '#8a6a3d' : rar.gem);
    rc(3, 9, 7, 2, steel);                                    // манжета
    px(9, 5, steel); px(9, 6, steel); px(9, 7, steel);        // большой палец
    px(4, 4, '#ffffff'); px(5, 4, '#ffffff');
    px(5, 12, wood); px(6, 12, wood); px(7, 12, wood);
  } else if (item.slot === 'boots') {
    // сапог с отворотом
    rc(5, 2, 4, 2, gold);                                     // отворот
    rc(5, 4, 4, 6, '#6e4a26'); px(5, 4, '#8a6a3d'); px(6, 4, '#8a6a3d');
    rc(4, 10, 8, 2, dark);                                    // подошва
    px(9, 5, '#6e4a26'); px(9, 6, '#6e4a26'); px(9, 7, '#6e4a26');
    px(5, 11, steelD); px(8, 11, steelD);
  } else if (item.slot === 'ring') {
    // кольцо с самоцветом
    px(6, 8, gold); px(5, 9, gold); px(4, 10, gold); px(4, 11, gold); px(5, 12, gold);
    px(6, 13, gold); px(7, 13, gold); px(8, 12, gold); px(9, 11, gold); px(9, 10, gold);
    px(8, 9, gold); px(7, 8, gold);
    rc(6, 2, 3, 3, rar.gem); px(6, 2, '#ffffff'); px(8, 4, dark);
  } else if (item.slot === 'armor') {
    // щит: сталь с каймой и самоцветом
    rc(4, 2, 6, 7, steel); rc(4, 2, 6, 1, '#e4e9f2');
    px(3, 3, steelD); px(10, 3, steelD); px(3, 4, steelD); px(10, 4, steelD);
    px(4, 9, steelD); px(9, 9, steelD); px(5, 10, steelD); px(8, 10, steelD);
    px(6, 11, steelD); px(7, 11, steelD);
    rc(6, 4, 2, 2, rar.gem); px(6, 5, dark);
    px(6, 7, gold); px(7, 7, gold);
  } else if (item.slot === 'shoulders') {
    // наплечники: две стальные пластины с ремнём
    rc(2, 5, 4, 4, steel); rc(9, 5, 4, 4, steel);
    rc(2, 5, 4, 1, '#e4e9f2'); rc(9, 5, 4, 1, '#e4e9f2');
    px(2, 8, steelD); px(5, 8, steelD); px(9, 8, steelD); px(12, 8, steelD);
    rc(6, 6, 2, 2, wood); px(6, 6, gold);                 // пряжка
    px(3, 4, rar.gem); px(10, 4, rar.gem);                // самоцветы
    px(3, 9, wood); px(10, 9, wood);                      // ремни
  } else if (item.slot === 'kneepads') {
    // наколенник: изогнутая пластина с ремешками
    rc(4, 4, 6, 5, steel); rc(5, 3, 4, 1, steel);
    rc(4, 4, 6, 1, '#e4e9f2');
    px(4, 8, steelD); px(9, 8, steelD); px(4, 9, steelD); px(9, 9, steelD);
    px(6, 5, rar.gem); px(7, 5, rar.gem);
    rc(3, 9, 2, 2, wood); rc(9, 9, 2, 2, wood);           // ремешки
    px(6, 10, steelD); px(7, 10, steelD);
  } else if (item.slot === 'belt') {
    // пояс с большой пряжкой
    rc(2, 7, 10, 2, '#6e4a26');
    px(2, 7, '#8a6a3d'); px(11, 8, '#8a6a3d');
    rc(6, 5, 4, 6, gold); rc(7, 6, 2, 4, dark);           // пряжка
    px(5, 7, rar.gem); px(9, 8, rar.gem);                 // вставки
    px(3, 6, '#8a6a3d'); px(10, 9, '#8a6a3d');
    px(6, 4, steelD); px(7, 12, steelD);
  } else if (item.slot === 'trinket') {
    // амулет: подвеска с самоцветом
    px(6, 2, gold); px(5, 3, gold); px(6, 3, gold); px(7, 3, gold); px(8, 3, gold);
    px(9, 2, gold);
    rc(5, 5, 5, 6, rar.gem); px(5, 5, '#ffffff'); px(9, 10, dark);
    px(7, 4, gold); px(7, 11, gold);
  }
  function woodD2() { return '#4a3524'; }
}

function buildInventoryUI() {
  const modal = document.getElementById('invModal');
  modal.innerHTML = `<div class="invPanel">
    <h2>🎒 ЭКИПИРОВКА ГЕРОЯ</h2>
    <div class="d2wrap">
      <div class="d2col d2left">
        <div class="d2caption">НА ГЕРОЕ</div>
        <div class="d2body">
          <div class="d2slots d2slots-l">
            <div class="d2slot" data-slot="helmet"><span class="slabel">ШЛЕМ</span></div>
            <div class="d2slot" data-slot="weapon"><span class="slabel">ОРУЖИЕ</span></div>
            <div class="d2slot" data-slot="gloves"><span class="slabel">ПЕРЧАТКИ</span></div>
            <div class="d2slot" data-slot="boots"><span class="slabel">САПОГИ</span></div>
            <div class="d2slot" data-slot="belt"><span class="slabel">ПОЯС</span></div>
          </div>
          <div class="d2doll"><canvas id="heroDoll" width="150" height="240"></canvas></div>
          <div class="d2slots d2slots-r">
            <div class="d2slot" data-slot="shoulders"><span class="slabel">НАПЛЕЧНИКИ</span></div>
            <div class="d2slot" data-slot="ring"><span class="slabel">КОЛЬЦО</span></div>
            <div class="d2slot" data-slot="armor"><span class="slabel">БРОНЯ</span></div>
            <div class="d2slot" data-slot="kneepads"><span class="slabel">НАКОЛЕННИКИ</span></div>
            <div class="d2slot" data-slot="trinket"><span class="slabel">ТАЛИСМАН</span></div>
          </div>
        </div>
      </div>
      <div class="d2col d2right">
        <div class="d2caption">ДОСТУПНАЯ ЭКИПИРОВКА</div>
        <div id="invGrid"></div>
        <div class="d2tip" id="invTip">Коснись предмета — увидишь описание.<br>Двойной тап надевает вещь.</div>
        <div class="d2foot">
          <span class="gold">🪙 <b id="invGold">0</b></span>
          <span class="gold" id="invSummary"></span>
        </div>
      </div>
    </div>
    <div class="invBtnRow">
      <button class="btn btnSm" id="invSellJunk">🔥 ПРОДАТЬ МУСОР</button>
      <button class="btn btnSm" id="invSellAll">💰 ПРОДАТЬ ВСЁ</button>
      <button class="btn" id="invClose">ЗАКРЫТЬ</button>
    </div>
  </div>`;
  bindTap(document.getElementById('invClose'), () => modal.style.display = 'none');
  bindTap(document.getElementById('invSellJunk'), sellJunk);
  bindTap(document.getElementById('invSellAll'), sellAll);
  document.querySelectorAll('.d2slot').forEach(el => {
    bindTap(el, () => unequipSlot(el.dataset.slot));
    el.addEventListener('pointerenter', () => {
      const it = state.inv[el.dataset.slot];
      if (it) { selItem = null; showTip(it, true); }
    });
  });
  renderInventory();
  updateSlotLabels();
}

// на узком экране длинные подписи слотов не влезают — сокращаем
const SLOT_SHORT = {
  helmet: 'ШЛЕМ', weapon: 'ЛУК', gloves: 'РУКИ', boots: 'САПОГИ', belt: 'ПОЯС',
  shoulders: 'ПЛЕЧИ', ring: 'КОЛЬЦО', armor: 'БРОНЯ', kneepads: 'НОГИ', trinket: 'АМУЛЕТ',
};
function updateSlotLabels() {
  const narrow = document.body.classList.contains('narrow');
  document.querySelectorAll('.d2slot').forEach(el => {
    const lab = el.querySelector('.slabel');
    if (!lab) return;
    if (lab.dataset.full === undefined) lab.dataset.full = lab.textContent;
    lab.textContent = narrow ? (SLOT_SHORT[el.dataset.slot] || lab.dataset.full) : lab.dataset.full;
  });
}

// продать всё серое и зелёное (не уникальное) — одна кнопка
function sellJunk() {
  const junk = state.inv.bag.filter(it => it.rar <= 1 && !it.unique);
  if (!junk.length) { toast('Мусора нет — сумка чиста!'); return; }
  let sum = 0;
  for (const it of junk) {
    sum += itemSellPrice(it);
    state.inv.bag.splice(state.inv.bag.indexOf(it), 1);
  }
  state.gold += sum;
  state.stats.totalGold += sum;
  selItem = null;
  renderInventory(); updateHud();
  toast(`🔥 Продано ${junk.length} шт. за ${sum} 🪙`);
  saveGame();
}

// продать ВСЁ из сумки — двойное подтверждение на самой кнопке (confirm() в WebView не работает)
let sellAllArmT = 0;
function sellAll() {
  const bag = state.inv.bag;
  if (!bag.length) { toast('Сумка пуста'); return; }
  const btn = document.getElementById('invSellAll');
  const total = bag.reduce((s, it) => s + itemSellPrice(it), 0);
  const now = performance.now();
  if (now - sellAllArmT > 3000) {
    // первый тап — «взводим» кнопку
    sellAllArmT = now;
    if (btn) { btn.textContent = `⚠ ТОЧНО? +${total}🪙`; btn.classList.add('armed'); }
    toast('Нажми ещё раз, чтобы продать всё');
    setTimeout(() => {
      if (performance.now() - sellAllArmT >= 2900) {
        sellAllArmT = 0;
        if (btn) { btn.textContent = '💰 ПРОДАТЬ ВСЁ'; btn.classList.remove('armed'); }
      }
    }, 3000);
    return;
  }
  // второй тап — продаём
  sellAllArmT = 0;
  if (btn) { btn.textContent = '💰 ПРОДАТЬ ВСЁ'; btn.classList.remove('armed'); }
  bag.length = 0;
  state.gold += total;
  state.stats.totalGold += total;
  selItem = null;
  renderInventory(); updateHud();
  sfx('coin');
  toast(`💰 Продано всё за ${total} 🪙`);
  saveGame();
}

// снять предмет со слота (в сумку)
function unequipSlot(slot) {
  const it = state.inv[slot];
  if (!it) return;
  if (state.inv.bag.length >= 30) { toast('Сумка полна!'); return; }
  state.inv[slot] = null;
  state.inv.bag.push(it);
  renderInventory(); updateHud();
}

// ---------- Инвентарь: выбор и экипировка ----------
// Состояние объявлено ДО функций, которые его используют (иначе TDZ-ошибка).
let selItem = null, previewEl = null;
// Общее состояние двойного тапа: ячейки пересоздаются при каждой перерисовке,
// поэтому хранить счётчик внутри ячейки нельзя — он теряется.
const lastCellTap = { t: 0, uid: null };
const DOUBLE_TAP_MS = 400;

// Ищем предмет по uid в АКТУАЛЬНОЙ сумке. Это принципиально: после экипировки
// инвентарь перерисовывается, и ссылки на объекты предметов устаревают —
// именно из-за этого раньше «надевалось не то».
function bagItemByUid(uid) {
  const bag = state.inv.bag;
  for (let i = 0; i < bag.length; i++) if (bag[i] && bag[i].uid === uid) return bag[i];
  return null;
}
function selectByUid(uid) {
  const it = bagItemByUid(uid);
  if (it) selectItem(it);
}
function equipByUid(uid) {
  const it = bagItemByUid(uid);
  if (it) equipItem(it);
}

// надеть предмет из сумки
function equipItem(it) {
  if (!it) return;
  // предмет уже надет в свой слот — повторный двойной тап ничего не делает
  if (state.inv[it.slot] && state.inv[it.slot].uid === it.uid) return;
  const old = state.inv[it.slot];
  const idx = state.inv.bag.indexOf(it);
  if (idx < 0) return;                       // предмета нет в сумке
  state.inv.bag.splice(idx, 1);
  if (old) state.inv.bag.push(old);
  state.inv[it.slot] = it;
  selItem = null;                            // выбор сбрасываем: предмет уехал в слот
  lastCellTap.t = 0;
  sfx('equip');
  renderInventory(); updateHud();
  saveGame();
}

function sellItem(it) {
  const idx = state.inv.bag.indexOf(it);
  if (idx < 0) return;
  state.inv.bag.splice(idx, 1);
  state.gold += itemSellPrice(it);
  state.stats.totalGold += itemSellPrice(it);
  renderInventory(); updateHud();
  saveGame();
}

// эскиз героя на «кукле» (пиксельный лучник в полный рост)
function drawHeroDoll(cv) {
  const g = cv.getContext('2d');
  g.clearRect(0, 0, cv.width, cv.height);
  g.save();
  g.scale(0.93, 0.93);   // эскиз вписан в панель
  const px = (x, y, c) => { g.fillStyle = c; g.fillRect(x, y, 1, 1); };
  const rc = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  const C = { skin: '#d8a077', skinD: '#a87250', hood: '#3a2a14', tunic: '#8a6a3d',
    tunicD: '#5f4726', cloak: '#8a2f26', cloakH: '#c94f3d', boot: '#5f4726',
    wood: '#7a5a32', steel: '#e8e8f0', gold: '#f4c542', belt: '#57401f' };
  const cx = 75;   // центр фигуры
  // сапоги
  rc(cx - 12, 196, 9, 22, C.boot); rc(cx + 3, 196, 9, 22, C.boot);
  rc(cx - 13, 214, 11, 5, '#3a2a14'); rc(cx + 2, 214, 11, 5, '#3a2a14');
  // ноги-штаны
  rc(cx - 11, 170, 8, 30, C.tunicD); rc(cx + 3, 170, 8, 30, C.tunicD);
  // туника
  rc(cx - 16, 118, 32, 56, C.tunic);
  rc(cx - 16, 118, 32, 4, C.tunicD);
  // пояс
  rc(cx - 16, 156, 32, 7, C.belt);
  rc(cx - 5, 156, 10, 7, C.gold); px(cx, 159, '#8a6a1f');
  // плащ
  rc(cx - 24, 116, 8, 46, C.cloak);
  rc(cx - 25, 150, 6, 26, C.cloakH);
  rc(cx - 26, 168, 5, 12, C.cloak);
  rc(cx + 16, 116, 8, 46, C.cloak);
  rc(cx + 19, 150, 6, 26, C.cloakH);
  // руки
  rc(cx - 22, 128, 7, 34, C.skinD); rc(cx + 15, 128, 7, 34, C.skinD);
  rc(cx - 22, 158, 7, 7, C.skin); rc(cx + 15, 158, 7, 7, C.skin);
  // кисти-перчатки
  rc(cx - 23, 162, 9, 8, C.tunicD); rc(cx + 14, 162, 9, 8, C.tunicD);
  // голова
  rc(cx - 10, 84, 20, 24, C.skin);
  px(cx + 4, 94, '#201510'); px(cx + 4, 95, '#201510');
  px(cx + 5, 94, '#201510');
  rc(cx - 10, 102, 6, 3, C.skinD);                      // тень подбородка
  // капюшон
  rc(cx - 13, 76, 26, 16, C.hood);
  rc(cx - 13, 92, 5, 14, C.hood);
  rc(cx + 8, 92, 5, 14, C.hood);
  px(cx - 2, 73, '#2b2118'); px(cx, 72, '#2b2118');
  // колчан за спиной
  rc(cx + 22, 108, 10, 26, '#3a2a14');
  px(cx + 22, 104, C.steel); px(cx + 25, 104, C.steel); px(cx + 28, 104, C.steel);
  px(cx + 26, 105, C.steel);
  // лук в руке
  for (let i = -20; i <= 20; i++) {
    const ax = cx + 30 + Math.round(6 * (1 - (i * i) / 400));
    px(ax, 150 + i, C.wood);
  }
  px(cx + 31, 130, C.wood); px(cx + 31, 170, C.wood);
  g.strokeStyle = '#d8d0c0'; g.beginPath();
  g.moveTo(cx + 31, 130); g.lineTo(cx + 24, 150); g.lineTo(cx + 31, 170); g.stroke();
  // стрела на тетиве
  g.strokeStyle = '#e8e8f0'; g.beginPath();
  g.moveTo(cx + 24, 150); g.lineTo(cx + 42, 150); g.stroke();
  g.restore();
}

function renderInventory() {
  const grid = document.getElementById('invGrid');
  if (!grid) return;
  const goldEl = document.getElementById('invGold');
  if (goldEl) goldEl.textContent = fmt(state.gold);
  const sum = document.getElementById('invSummary');
  const eb = equipBonuses(state.inv);
  if (sum) sum.textContent =
    `×${eb.dmg.toFixed(2)} урон · +${eb.hp} HP · +${Math.round(eb.crit * 100)}% крит · ×${eb.rate.toFixed(2)} скор.`;

  // кукла героя
  drawHeroDoll(document.getElementById('heroDoll'));

  // слоты на кукле
  document.querySelectorAll('.d2slot').forEach(el => {
    const slot = el.dataset.slot;
    const it = state.inv[slot];
    el.className = 'd2slot' + (it ? ' r' + it.rar : '');
    const old = el.querySelector('canvas');
    if (old) old.remove();
    if (it) {
      const cv = document.createElement('canvas');
      el.appendChild(cv);
      drawItemIcon(cv, it);
      el.title = it.name;
    } else {
      el.style.opacity = 0.4;
    }
    if (it) el.style.opacity = 1;
  });

  // сетка инвентаря 10×3 клетки, без скроллбара
  grid.innerHTML = '';
  const total = 30;
  for (let i = 0; i < total; i++) {
    const cell = document.createElement('div');
    const it = state.inv.bag[i];
    cell.className = 'cell' + (it ? ' r' + it.rar : '');
    if (it) {
      const cv = document.createElement('canvas');
      cell.appendChild(cv);
      drawItemIcon(cv, it);
      cell.title = it.name;
      // двойной тап/клик = надеть. Счётчик живёт в общем объекте (ячейки
      // пересоздаются при каждой перерисовке, локальная переменная терялась).
      const uid = it.uid;
      bindTap(cell, () => {
        const now = performance.now();
        if (now - lastCellTap.t < DOUBLE_TAP_MS && lastCellTap.uid === uid) {
          lastCellTap.t = 0;
          equipByUid(uid);          // ищем предмет в ТЕКУЩЕЙ сумке по uid
        } else {
          lastCellTap.t = now;
          lastCellTap.uid = uid;
          selectByUid(uid);
        }
      });
      // браузерный double-click (мышь) — надёжнее на десктопе
      cell.addEventListener('dblclick', (e) => {
        e.preventDefault();
        lastCellTap.t = 0;
        equipByUid(uid);
      });
      cell.addEventListener('pointerenter', () => previewItem(it, cell));
    }
    grid.appendChild(cell);
  }
  // если открыт ранее выбранный предмет — обновить подсказку
  if (selItem && state.inv.bag.includes(selItem)) showTip(selItem);
  else if (selItem && !state.inv.bag.includes(selItem)) selItem = null;
  requestAnimationFrame(fitInvPanel);
}

// авто-подгонка панели экипировки: всегда вписывается без прокрутки
function fitInvPanel() {
  const m = document.getElementById('invModal');
  if (!m || m.style.display === 'none') return;
  const p = m.querySelector('.invPanel');
  if (!p) return;
  // на мобильном панель сама растягивается по флекс-правилам — масштаб не нужен
  if (document.body.classList.contains('narrow')) {
    p.style.transform = 'none';
    p.style.marginBottom = '0px';
    return;
  }
  p.style.transform = 'none';
  const availW = m.clientWidth - 12;
  const availH = m.clientHeight - 12;
  const w = p.offsetWidth, h = p.offsetHeight;
  if (!w || !h) return;
  const k = Math.min(1, availW / w, availH / h);
  if (k < 0.999) {
    p.style.transformOrigin = 'top center';
    p.style.transform = `scale(${k.toFixed(4)})`;
    p.style.marginBottom = `${Math.round(h * (k - 1))}px`;   // убираем пустое место снизу
  } else {
    p.style.marginBottom = '0px';
  }
}
addEventListener('resize', () => setTimeout(fitInvPanel, 30));

function previewItem(it, cell) {
  if (previewEl) previewEl.classList.remove('sel');
  previewEl = cell;
  cell.classList.add('sel');
  selItem = it;
  showTip(it);
}
function selectItem(it) {
  selItem = it;
  document.querySelectorAll('.cell.sel').forEach(e => e.classList.remove('sel'));
  showTip(it);
}
function showTip(it, equipped) {
  const tip = document.getElementById('invTip');
  if (!tip || !it) return;
  const r = RAR[it.rar];
  // сравнение с текущим надетым предметом в том же слоте
  let cmp = '';
  if (!equipped) {
    const cur = state.inv[it.slot];
    if (cur && cur.uid !== it.uid) {
      const delta = (a, b) => {
        const d = Math.round((a - b) * 100) / 100;
        return d > 0 ? ` <b style="color:#7fc97f">+${d}</b>` : d < 0 ? ` <b style="color:#c94f3d">${d}</b>` : '';
      };
      const rows = [];
      if (it.dmg || cur.dmg) rows.push(`урон${delta((it.dmg||0)*100, (cur.dmg||0)*100)}%`);
      if (it.hp || cur.hp) rows.push(`HP${delta(it.hp||0, cur.hp||0)}`);
      if (it.crit || cur.crit) rows.push(`крит${delta((it.crit||0)*100, (cur.crit||0)*100)}%`);
      if (it.regen || cur.regen) rows.push(`реген${delta(it.regen||0, cur.regen||0)}`);
      if (rows.length) cmp = `<div class="tcmp">надето: ${cur.name.slice(0, 18)} → ${rows.join(', ')}</div>`;
    }
  }
  tip.innerHTML = `<div class="tname" style="color:${r.col}">${it.name}</div>
    <div class="trar" style="color:${r.col}">${r.name} · ${SLOT_NAMES[it.slot] || it.slot}${equipped ? ' · НАДЕТО' : ''}${it.unique ? ' ★' : ''}</div>
    <div class="tstat">${describeItem(it)}</div>${cmp}
    <div class="tbtns">
      ${equipped ? '<button class="tbtn" id="tipUnequip">СНЯТЬ</button>'
        : `<button class="tbtn" id="tipEquip">НАДЕТЬ</button>
           <button class="tbtn sell" id="tipSell">ПРОДАТЬ +${itemSellPrice(it)}🪙</button>`}
    </div>`;
  if (equipped) {
    bindTap(document.getElementById('tipUnequip'), () => { unequipSlot(it.slot); selItem = null; });
    return;
  }
  bindTap(document.getElementById('tipEquip'), () => { equipItem(it); selItem = null; });
  bindTap(document.getElementById('tipSell'), () => { sellItem(it); selItem = null; });
}

// ---------- Дерево навыков ----------
function buildTree() {
  const modal = document.getElementById('treeModal');
  modal.innerHTML = `<h2>🌳 НАВЫКИ <span id="treePts"></span></h2><div id="treeCols"></div>
    <p style="font-size:11px;color:#9a8763">+1 очко за каждый пережитый день. Узлы открываются по цепочке.</p>
    <button class="btn" id="treeClose">ЗАКРЫТЬ</button>`;
  bindTap(document.getElementById('treeClose'), () => modal.style.display = 'none');
  const cols = document.getElementById('treeCols');
  for (const branch of TREE) {
    const col = document.createElement('div');
    col.className = 'treeCol';
    col.innerHTML = `<div class="treeHead" style="color:${branch.color}">${branch.branch}</div>`;
    for (const node of branch.nodes) {
      const n = document.createElement('div');
      n.className = 'treeNode';
      n.dataset.nid = node.id;
      bindTap(n, () => buyNode(node));
      col.appendChild(n);
    }
    cols.appendChild(col);
  }
  renderTree();
}
function buyNode(node) {
  if (!nodeAvailable(node, state.tree) || state.skillPts < node.cost) return;
  state.skillPts -= node.cost;
  state.tree[node.id] = true;
  sfx('skill');
  toast(`✨ Навык «${node.name}» изучен!`);
  renderTree(); updateHud();
}
function renderTree() {
  const pts = document.getElementById('treePts');
  if (pts) pts.textContent = `· очков: ${state.skillPts}`;
  for (const branch of TREE) for (const node of branch.nodes) {
    const el = document.querySelector(`.treeNode[data-nid="${node.id}"]`);
    if (!el) continue;
    const owned = !!state.tree[node.id];
    const avail = nodeAvailable(node, state.tree);
    el.className = 'treeNode' + (owned ? ' owned' : avail ? ' avail' : ' locked');
    el.innerHTML = `<div class="nname">${node.name}</div><div class="ndesc">${node.desc}</div>` +
      `<div class="ncost">${owned ? '✔ изучено' : node.cost + ' очк.'}</div>`;
  }
}

// ---------- HUD ----------
function updateHud() {
  document.getElementById('gold').textContent = fmt(state.gold);
  document.getElementById('day').textContent = state.day;
  const wEl = document.getElementById('weatherHud');
  if (wEl) wEl.textContent = weather.WEATHER_DEFS[state.weather.kind].icon;
  const dps = fireRate() * arrowsPerShot() * totalBowDmg() * (1 + totalCrit() * 1.5);
  document.getElementById('dps').textContent = fmt(dps);
  document.getElementById('castleHpFill').style.width = (state.castleHp / maxCastleHp() * 100) + '%';
  document.getElementById('waveBarFill').style.width = (state.waveInDay / BAL.wavesPerDay * 100) + '%';
  renderShop(); renderStructShop();
}

let toastTimer = null;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.style.opacity = 1;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.style.opacity = 0, 2200);
}

// ---------- МОНЕТИЗАЦИЯ: донат и реклама ----------
// Подключаем мост к нативному слою (Android). В браузере всё работает в
// режиме заглушки: покупки эмулируются, реклама сразу выдаёт награду.
initMonetization(state);
MON.giveGold = (n) => { state.gold += n; if (state.stats) state.stats.totalGold = (state.stats.totalGold || 0) + n; };
MON.structs = state.structs;
MON.persist = () => { state.iap = state.iap || {}; if (MON.removedAds) state.iap.noads = 1; if (MON.vip) state.iap.vip = 1; saveGame(); };

if (state.iap && state.iap.noads) MON.removedAds = true;
if (state.iap && state.iap.vip) MON.vip = true;

onMonetization((kind, data) => {
  if (kind === 'purchase' && data && data.ok) {
    const r = data.res;
    markOwned(data.id);
    state.iap = state.iap || {};
    state.iap[data.id] = 1;
    if (r && r.effects && r.effects.length) toast('✅ ' + (r.item ? r.item.name : data.id) + ': ' + r.effects.join(', '));
    sfx('buy');
    renderDonate(); renderShop(); renderStructShop(); updateHud(); saveGame();
  } else if (kind === 'purchase' && data && !data.ok) {
    toast('Покупка не завершена');
  } else if (kind === 'error') {
    if (MON.lastError && /cancel/i.test(MON.lastError)) toast('Покупка отменена');
    else if (MON.lastError) toast('Ошибка покупки');
  } else if (kind === 'reward') {
    // награда выдаётся в колбэке showRewarded
  }
});

// --- выдаём награду за просмотр рекламы
function grantRewarded(placement) {
  if (placement === 'doubleGold') {
    const amount = REWARDED.doubleGold.amount(state) * (MON.vip ? 1.25 : 1);
    state.gold += Math.round(amount);
    if (state.stats) state.stats.totalGold = (state.stats.totalGold || 0) + Math.round(amount);
    toast('🎬 +' + fmt(Math.round(amount)) + ' золота за просмотр');
  } else if (placement === 'freePts') {
    state.skillPts = (state.skillPts || 0) + 1;
    toast('🎬 +1 очко навыка');
  } else if (placement === 'goldGift') {
    const amount = REWARDED.goldGift.amount(state);
    state.gold += amount;
    if (state.stats) state.stats.totalGold = (state.stats.totalGold || 0) + amount;
    toast('🎬 Подарок: +' + fmt(amount) + ' золота');
  }
  sfx('coin');
  renderShop(); renderStructShop(); updateHud(); saveGame();
}

function watchAd(placement) {
  if (adsRemoved()) { grantRewarded(placement); return; }
  const r = showRewarded(placement, grantRewarded);
  if (!r.ok) {
    if (r.reason === 'busy') toast('Реклама ещё загружается…');
    else toast('Реклама недоступна');
  } else if (r.skipped) {
    // реклама отключена покупкой — награда уже выдана
  } else {
    toast('Загружаем рекламу…');
  }
}

// --- межстраничная реклама (не чаще раза в 90 c, и только по крупным событиям)
function maybeInterstitial() {
  if (adsRemoved()) return;
  const now = Date.now();
  if (now - (state.lastInterstitial || 0) < 90000) return;
  state.lastInterstitial = now;
  showInterstitial();
}

// --- отрисовка панели доната
function renderDonate() {
  const wrap = document.getElementById('donateList');
  if (!wrap) return;
  const premium = IAP_ITEMS.filter(i => i.kind === 'nonconsumable');
  const consum = IAP_ITEMS.filter(i => i.kind === 'consumable');
  let h = '<div class="dsec">Наборы</div>';
  for (const it of premium) h += donateCard(it, true);
  h += '<div class="dsec">Золото и поддержка</div>';
  for (const it of consum) h += donateCard(it, false);
  h += '<div class="dfoot">' +
       '<button class="dbtn small" id="restoreBtn">Восстановить покупки</button>' +
       '<span class="dnote">' + (isAndroid() ? 'Оплата через Google Play' : 'Демо-режим в браузере') + '</span></div>';
  wrap.innerHTML = h;
  const rb = document.getElementById('restoreBtn');
  if (rb) bindTap(rb, () => { iapRestore(); toast('Восстанавливаем покупки…'); });
  wrap.querySelectorAll('[data-buy-iap]').forEach(el => {
    bindTap(el, () => onBuyIap(el.dataset.buyIap));
  });
}

function donateCard(it, owned_once) {
  const owned = owned_once && (isOwned(it.id) || (state.iap && state.iap[it.id]));
  const price = priceOf(it.id);
  const cls = owned ? 'ditem owned' : 'ditem';
  return `<div class="${cls}">
    <div class="dic ic_${it.icons}">${donateGlyph(it.icons)}</div>
    <div class="dbody">
      <div class="dname">${it.name}${it.bonus ? ' <span class="dbonus">' + it.bonus + '</span>' : ''}</div>
      <div class="ddesc">${it.desc}</div>
    </div>
    ${owned
      ? '<div class="dprice own">КУПЛЕНО</div>'
      : `<div class="dprice" data-buy-iap="${it.id}">${price}</div>`}
  </div>`;
}

function donateGlyph(k) {
  return { coin: '🪙', chest: '🎁', star: '⭐', crown: '👑', noads: '🚫', heart: '❤️' }[k] || '💎';
}

function onBuyIap(id) {
  const item = IAP_ITEMS.find(i => i.id === id);
  if (!item) return;
  const r = iapBuy(id);
  if (!r.ok) {
    if (r.reason === 'owned') toast('Уже куплено');
    else toast('Покупка недоступна');
    return;
  }
  if (r.simulated) {
    // браузер: сразу применяем покупку (демо для проверки UI)
    toast('💳 Демо-покупка: ' + item.name);
    MON.giveGold && item.give && item.give.gold && MON.giveGold(item.give.gold);
    if (item.give && item.give.noAds) { MON.removedAds = true; }
    if (item.give && item.give.vip) { MON.vip = true; }
    markOwned(id);
    state.iap = state.iap || {}; state.iap[id] = 1;
    renderDonate(); renderShop(); renderStructShop(); updateHud(); saveGame();
  } else {
    toast('Открываем оплату…');
  }
}

function openDonate() {
  const m = document.getElementById('donateModal');
  if (!m) return;
  renderDonate();
  m.style.display = 'flex';
  setBanner(false);
}
function closeDonate() {
  const m = document.getElementById('donateModal');
  if (m) m.style.display = 'none';
  setBanner(true);
}

// ---------- Атмосферные эффекты ----------
// Факелы — по краям верхней площадки стены (зубцы на GROUND-74), не перекрывают лучника.
const ambient = {
  torchL: createFx(torchFx, { x: 18, y: GROUND - 128, scale: 1 }),
  torchR: createFx(torchFx, { x: 82, y: GROUND - 128, scale: 1 }),
};

// --- панель бонусов за рекламу
function renderAdPanel() {
  const wrap = document.getElementById('adList');
  if (!wrap) return;
  if (adsRemoved()) {
    wrap.innerHTML = '<div class="noadsNote">✅ Реклама отключена покупкой. Все бонусы доступны сразу.</div>';
  }
  let h = '';
  for (const key in REWARDED) {
    const r = REWARDED[key];
    const amt = r.amount(state);
    const label = key === 'freePts' ? '+1 очко' : '+' + fmt(amt);
    h += `<div class="adcard">
      <div class="dic">${key === 'freePts' ? '⭐' : '��'}</div>
      <div class="dbody">
        <div class="dname">${r.name}</div>
        <div class="ddesc">${r.desc} · награда ${label}</div>
      </div>
      <div class="adgo" data-ad="${key}">СМОТРЕТЬ</div>
    </div>`;
  }
  if (adsRemoved()) {
    // при отключённой рекламе меняем подпись: награда сразу
    h = h.replace(/СМОТРЕТЬ/g, 'ЗАБРАТЬ');
  }
  h += '<div class="dfoot"><span class="dnote">Награда начисляется после просмотра</span></div>';
  wrap.innerHTML = h;
  wrap.querySelectorAll('[data-ad]').forEach(el => bindTap(el, () => {
    el.classList.add('busy');
    setTimeout(() => el.classList.remove('busy'), 1200);
    watchAd(el.dataset.ad);
    closeAdPanel();
  }));
}

function openAdPanel() {
  const m = document.getElementById('adModal');
  if (!m) return;
  renderAdPanel();
  m.style.display = 'flex';
  setBanner(false);
}
function closeAdPanel() {
  const m = document.getElementById('adModal');
  if (m) m.style.display = 'none';
  setBanner(true);
}

// ---------- Главный цикл ----------
let last = performance.now();
function tick(now) {
  requestAnimationFrame(tick);
  let dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (state.hitStop > 0) { state.hitStop -= dt; dt *= 0.15; }
  state.time += dt;

  // Атмосферные эффекты живут всегда — и на стартовом экране тоже
  ambient.torchL.update(dt); ambient.torchR.update(dt);

  try {
    if (state.running) update(dt);
  } catch (err) {
    window.__err = String(err && err.stack || err);
    state.running = false;
  }
  render(dt);
}

function update(dt) {
  // прицел на ближайшего врага
  let nearest = null;
  for (const e of enemies) if (!nearest || e.x < nearest.x) nearest = e;
  if (nearest && nearest.x > WALL_X + 28) {
    const t = (nearest.x - BOW.x) / BAL.arrowSpeed;
    const vy = ((nearest.y - 8) - BOW.y - 0.5 * ARROW_G * t * t) / t;
    state.aim = Math.atan2(vy, BAL.arrowSpeed);
  } else {
    state.aim = -0.35;
  }

  // стрельба: плавный цикл натяжения, отдача и вспышка при спуске
  state.fireCooldown -= dt;
  const fr = fireRate();
  state.bowPull = Math.max(0, Math.min(1, 1 - state.fireCooldown * fr));
  state.recoilT = Math.max(0, state.recoilT - dt);
  state.sparkT = Math.max(0, state.sparkT - dt);
  if (nearest && nearest.x > WALL_X + 28) {
    if (state.fireCooldown <= 0) { shoot(); state.fireCooldown = 1 / fr; state.recoilT = 0.13; state.sparkT = 0.09; }
  } else state.firing = false;
  if (state.fireCooldown < 1 / fr - 0.08) state.firing = false;

  // волны
  if (state.spawnQueue > 0) {
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) { spawnEnemy(); state.spawnQueue--; state.spawnTimer = BAL.enemyGapSec; }
  } else if (state.bossPending && enemies.length === 0) {
    state.bossPending = false;
    spawnBoss();
  } else if (enemies.length === 0 && !state.bossPending) {
    state.waveTimer -= dt;
    if (state.waveTimer <= 0) {
      if (state.waveInDay >= BAL.wavesPerDay) {
        // новый день
        state.day++;
        state.waveInDay = 0;
        state.skillPts += TB().pointsPerDay;
        saveGame();
        state.stats.daysSurvived = Math.max(state.stats.daysSurvived, state.day);
        state.castleHp = Math.min(maxCastleHp(),
          state.castleHp + BAL.castleRegenPerDay + EB().regen + TB().regenAdd);
        // погода нового дня
        const kind = weather.pickWeather(state.day);
        state.weather = weather.createWeather(kind);
        const wdef = weather.WEATHER_DEFS[kind];
        toast(`${wdef.icon} День ${state.day} — ${wdef.name}${wdef.desc ? ': ' + wdef.desc : ''}`);
        toast(`☀ День ${state.day}. Стены подлатаны. +1 очко навыка!`);
        renderTree();
        state.waveTimer = BAL.waveBreakSec;
      } else {
        sfx('wave');
        startWave();
        state.waveTimer = BAL.waveBreakSec;
      }
      updateHud();
    }
  }

  // враги (погода влияет на скорость)
  const wmod = weather.weatherMods(state.weather.kind);
  for (const e of enemies) {
    e.walkT += dt;
    if (e.hitT > 0) e.hitT -= dt;
    // заморозка (узел «Ледяные ядра»): враг ползёт на 40% медленнее
    let speedMult = 1;
    if (e.frozen > 0) { e.frozen -= dt; speedMult *= 0.4; }
    // ---- механики боссов ----
    if (e.isBoss && !e.dead) {
      // ярость огра: при <35% HP ускоряется вдвое
      if (e.mechanic === 'rage' && e.hp < e.maxHp * 0.35) {
        if (!e.enraged) { e.enraged = true; e.speed *= 2.0; toast('💢 Огр впал в ярость!'); }
      }
      // тролль-лекарь: раз в 2.5с восстанавливает 3% HP
      if (e.mechanic === 'heal') {
        e.mechT -= dt;
        if (e.mechT <= 0) {
          e.mechT = 2.5;
          const heal = Math.round(e.maxHp * 0.03);
          if (e.hp < e.maxHp) { e.hp = Math.min(e.maxHp, e.hp + heal); spawnFx(hitFlashFx, { x: Math.round(e.x), y: Math.round(e.y - 26) }); }
        }
      }
      // некромант: призывает скелетов
      if (e.mechanic === 'summon') {
        e.summonT -= dt;
        if (e.summonT <= 0) {
          e.summonT = 6.0;
          for (let k = 0; k < 2; k++) {
            const hp2 = Math.round(BAL.enemyHp(state.day, state.waveInDay) * 0.6);
            enemies.push({ kind: 'skeleton', x: Math.min(W - 6, e.x + 10 + k * 8), y: GROUND,
              hp: hp2, maxHp: hp2, speed: BAL.enemySpeed(state.day) * 1.1, walkT: Math.random() * 5,
              dmg: BAL.enemyDmg(state.day) * 0.7, gold: Math.round(BAL.enemyGold(state.day, false) * 0.3),
              attacking: false, atkT: 0 });
          }
          toast('💀 Некромант призвал скелетов!');
        }
      }
    }
    if (e.x > WALL_X + 4) {
      e.x -= e.speed * (wmod.enemySpeed ?? 1) * speedMult * dt;
    } else {
      // атакует стену
      e.atkT -= dt;
      if (e.atkT <= 0) {
        e.atkT = 1.0;
        state.castleHp -= e.dmg;
        sfx('hurt');
        // шипованный вал (узел «Шипованный вал»): враг ранится об стену
        if (TB().wallThorns > 0) damageEnemy(e, TB().wallThorns, false);
        state.shakeT = 0.25;
        spawnFx(hitFlashFx, { x: WALL_X - 4, y: GROUND - 28 });
        if (state.castleHp <= 0) { state.castleHp = 0; endEra(); }
        updateHud();
      }
    }
  }
  // убрать мёртвых
  for (let i = enemies.length - 1; i >= 0; i--) if (enemies[i].dead) enemies.splice(i, 1);

  // погода: обновление + молнии грозы бьют по врагам
  weather.updateWeather(state.weather, dt);
  if (state.weather.boltPending) {
    let target = null;
    for (const e of enemies) if (!e.dead && (!target || e.x < target.x)) target = e;
    const bx = weather.takeBolt(state.weather, target ? Math.round(target.x) : 200 + Math.random() * 160);
    if (target) {
      damageEnemy(target, 18 + state.day * 3, false);
      state.shakeT = Math.max(state.shakeT, 0.3);
    }
  }

  // сооружения + лут
  updateStructures(dt, state.structs, {
    enemies, projectiles: state.projectiles,
    damageEnemy, spawnFx: ctxSpawn, shake: (v) => { state.shakeT = Math.max(state.shakeT, v); },
    structDmgMult: TB().structDmgMult, structCdMult: TB().structCdMult,
    structFreeze: TB().structFreeze,
    healCastle: (v) => {
      const before = state.castleHp;
      state.castleHp = Math.min(maxCastleHp(), state.castleHp + v);
      return state.castleHp - before;
    },
  });
  updateLoot(dt);

  // стрелы
  for (let i = arrows.length - 1; i >= 0; i--) {
    const a = arrows[i];
    a.x += a.vx * dt; a.y += a.vy * dt;
    a.vy += ARROW_G * dt;
    let removed = false;
    // залповые стрелы: самонаводящиеся, урон при подлёте
    if (volleyTick(a, dt)) { arrows.splice(i, 1); continue; }
    for (const e of enemies) {
      if (e.dead || a.hitIds.has(e)) continue;
      const ex = e.x, ey = e.y - (e.isBoss ? 24 : 10);
      if (Math.abs(a.x - ex) < 14 && Math.abs(a.y - ey) < 26) {
        // дракончик уклоняется — стрела проходит мимо
        if (enemyEvades(e)) {
          a.hitIds.add(e);
          spawnFx(hitFlashFx, { x: Math.round(a.x), y: Math.round(a.y), seed: 3 });
          continue;
        }
        damageEnemy(e, a.dmg, a.crit);
        a.hitIds.add(e);
        if (a.pierceLeft > 0) { a.pierceLeft--; a.dmg *= 0.7; }
        else { removed = true; break; }
      }
    }
    if (removed || a.x > W + 20 || a.y > GROUND) arrows.splice(i, 1);
  }

  // эффекты
  for (let i = fxs.length - 1; i >= 0; i--) {
    fxs[i].update(dt);
    if (fxs[i].done()) fxs.splice(i, 1);
  }
  updateParticles(state.particles, dt);

  // ---- динамическая музыка: спокойно → бой → босс ----
  if (state.running) {
    const hasBoss = enemies.some(e => e.isBoss && !e.dead);
    const inBattle = enemies.length > 0;
    if (hasBoss) musicScene('boss');
    else if (inBattle) musicScene('battle');
    else musicScene('calm');
  }
  if (state.volleyCd > 0) {
    state.volleyCd -= dt;
    updateVolleyBtn();
  }
  if (state.shakeT > 0) state.shakeT -= dt;
}

// ---------- Отрисовка ----------
const painter = new Painter(frame);

// Рисует врага из атласа. Возвращает true, если спрайт отрисован.
// Анимации в датасете нет, поэтому ходьба имитируется покачиванием и отражением.
function drawEnemyAtlas(e, x, y, time, step) {
  const spr = atlasSprites[e.sprKey];
  if (!spr || !spr.variants) return false;
  const k = e.sprK || 2;
  const set = spr.variants[(e.sprVari || 0) % spr.variants.length];
  const sz = set && set[k];
  if (!sz) return false;
  const w = sz.w, h = sz.h;
  // стоят на земле: низ спрайта на линии y, центруем по x
  const bob = (e.x > 104) ? Math.round(Math.sin(e.walkT * 8) * (k > 2 ? 1 : 1)) : 0;
  const sx = Math.round(x - w / 2);
  const sy = Math.round(y - h + Math.abs(bob));
  // враги идут справа налево → отражаем по горизонтали
  const flash = e.hitT > 0 ? Math.min(0.75, e.hitT * 5) : 0;
  drawAtlasSprite(painter, e.sprKey, e.sprVari, sx, sy, k, true, flash);
  return true;
}
function drawLootDropsSafe(painter) {
  for (const d of state.loot) drawLootDrop(painter, d, state.time);
}
function render(dt) {
  clearFrame(frame);

  drawSky(painter, W, H);
  drawSun(painter, W - 124, 60, state.time);
  drawClouds(painter, W, state.time);
  drawParallax(painter, W, GROUND, state.time, state.time * 6);
  drawGround(painter, W, GROUND);
  // деревья и кусты — только ПРАВЕЕ замка, чтобы не «прорастать» сквозь стену
  drawScenery(painter, W, GROUND, state.time, WALL_X + 12);
  weather.drawWeatherBack(painter, state.weather);          // пелена дождя / туман
  drawCastle(painter, GROUND, state.castleHp / maxCastleHp(), state.time);
  drawStructures(painter, state.structs, state.time);
  drawArcher(painter, ARCHER.x, ARCHER.y, state.aim, state.firing, state.time, state.bowPull, state.recoilT > 0, heroGear());

  // эффекты за персонажами
  for (const fx of fxs) fx.draw(frame, 'back');

  // тряска экрана — сдвигаем всё ПОСЛЕ отрисовки
  let ox = 0, oy = 0;
  if (state.shakeT > 0) {
    ox = Math.round((Math.random() - 0.5) * 8);
    oy = Math.round((Math.random() - 0.5) * 6);
  }
  frame.ox = -ox; frame.oy = -oy;

  for (const e of enemies) drawEnemy(painter, e, state.time, drawEnemyAtlas);
  drawParticles(painter, state.particles);
  drawLootDropsSafe(painter);
  // трейл стрел: тающий след позади + золотое свечение крита
  for (const a of arrows) {
    // лёгкий след
    painter.line(Math.round(a.x - a.vx * 0.02), Math.round(a.y - a.vy * 0.02),
      Math.round(a.x), Math.round(a.y), 0xf0e8d0, a.crit ? 0.4 : 0.18);
    drawArrow(painter, a);
  }
  // вспышка спуска у кончика лука
  if (state.sparkT > 0) {
    const k = state.sparkT / 0.09;
    const fx0 = ARCHER.x + 20, fy0 = ARCHER.y - 24 + Math.round(state.aim * 16);
    for (let i = 0; i < 4; i++) {
      const ang = -0.4 + i * 0.35 + (Math.random() - 0.5) * 0.2;
      painter.line(fx0, fy0, Math.round(fx0 + Math.cos(ang) * 4 * k), Math.round(fy0 + Math.sin(ang) * 4 * k),
        0xfff4c0, k);
    }
  }
  drawProjectiles(painter, state.projectiles);
  weather.drawWeatherFront(painter, state.weather);         // капли / снег / молния
  for (const fx of fxs) fx.draw(frame, 'front');
  ambient.torchL.draw(frame, 'front');
  ambient.torchR.draw(frame, 'front');

  composite(frame, img.data, 0x0d0a08);
  frame.ox = 0; frame.oy = 0;
  ctx.putImageData(img, 0, 0);
}

// ---------- Запуск ----------
function beginSiege() {
  if (state.running) return;
  initAudio();                       // можно только по жесту пользователя
  const ss = document.getElementById('startScreen');
  if (ss) ss.style.display = 'none';
  const restored = loadGame();
  state.running = true;
  state.castleHp = maxCastleHp(); // полный HP на старте сессии
  buildShop(); buildTree(); buildInventoryUI(); buildStructShop(); updateHud();
  musicStart('battle');
  toast(restored ? `💾 Осада продолжена: день ${state.day}` : 'Волна приближается с востока!');
}
function showStartRecords() {
  const el = document.getElementById('recStart');
  if (!el) return;
  const r = loadRecords();
  el.innerHTML = r.bestDay > 0
    ? `🏆 Рекорды: день <b>${r.bestDay}</b> · убийств <b>${r.bestKills}</b> · эпох пройдено <b>${r.eras}</b>`
    : 'Первая осада — установи свой первый рекорд!';
}
showStartRecords();

const startBtnEl = document.getElementById('startBtn');
// pointerdown срабатывает и на тач-экранах Android, и мышью
startBtnEl.addEventListener('pointerdown', (e) => { e.preventDefault(); beginSiege(); });
startBtnEl.addEventListener('click', beginSiege);
document.getElementById('eraBtn').addEventListener('click', newEra);
document.getElementById('fsBtn').addEventListener('click', toggleFullscreen);
function openTree() {
  sfx('ui');
  saveGame();
  renderTree();
  document.getElementById('treeModal').style.display = 'flex';
}
function openInv() {
  sfx('ui');
  saveGame();
  renderInventory();
  document.getElementById('invModal').style.display = 'flex';
  setTimeout(fitInvPanel, 0);
  setTimeout(fitInvPanel, 120);
}
// надёжная привязка кнопок HUD: pointerdown (тач) + click (мышь), без двойного срабатывания
// Тап = нажал и отпустил БЕЗ прокрутки/сдвига.
// Критично для мобильных: покупка не должна срабатывать при скролле ленты улучшений.
const TAP_MOVE_PX = 12;      // допуск сдвига пальца
const TAP_MAX_MS = 700;      // слишком долгое нажатие — не тап
// После pointerup браузер присылает click — это «эхо» одного и того же нажатия,
// его надо гасить. Но повторный pointerup (второй тап двойного нажатия) гасить
// нельзя, иначе двойной тап не работает. Поэтому эхо ловим коротким окном и
// только для click, идущего сразу за pointerup.
const TAP_ECHO_MS = 350;
function bindTap(el, fn) {
  if (!el) return;
  let sx = 0, sy = 0, st = 0, moved = false, active = false;
  let lastUp = 0;              // время последнего обработанного pointerup

  el.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    sx = e.clientX; sy = e.clientY; st = performance.now();
    moved = false; active = true;
  }, { passive: true });

  el.addEventListener('pointermove', (e) => {
    if (!active) return;
    if (Math.abs(e.clientX - sx) > TAP_MOVE_PX || Math.abs(e.clientY - sy) > TAP_MOVE_PX) {
      moved = true;              // это скролл, а не тап
      active = false;
    }
  }, { passive: true });

  el.addEventListener('pointercancel', () => { active = false; moved = true; }, { passive: true });

  el.addEventListener('pointerup', (e) => {
    if (!active) return;
    active = false;
    if (moved) return;
    if (performance.now() - st > TAP_MAX_MS) return;
    lastUp = performance.now();
    if (e.cancelable) e.preventDefault();
    fn();                        // повторные тапы проходят всегда — нужен двойной
  });

  // click приходит после pointerup как эхо — гасим его; если pointer-событий
  // не было вовсе (старый браузер/клавиатура), обрабатываем click как тап
  el.addEventListener('click', (e) => {
    if (e.pointerType) return;                                  // pointerup уже обработал
    if (performance.now() - lastUp < TAP_ECHO_MS) return;       // эхо pointerup
    fn();
  });
}
bindTap(document.getElementById('volleyBtn'), fireVolley);

// ---- кнопки звука ----
function updateAudioBtns() {
  const m = document.getElementById('musicBtn');
  const s = document.getElementById('sfxBtn');
  if (m) {
    m.innerHTML = (isMusicOn() ? '🎵' : '🔇') + '<span class="lbl"> Музыка</span>';
    m.classList.toggle('off', !isMusicOn());
  }
  if (s) {
    s.innerHTML = (isSfxOn() ? '🔊' : '🔈') + '<span class="lbl"> Звук</span>';
    s.classList.toggle('off', !isSfxOn());
  }
}
bindTap(document.getElementById('musicBtn'), () => {
  initAudio();
  toggleMusic();
  updateAudioBtns();
  if (isSfxOn()) sfx('ui');
});
bindTap(document.getElementById('sfxBtn'), () => {
  initAudio();
  const on = toggleSfx();
  updateAudioBtns();
  if (on) sfx('ui');
});
updateAudioBtns();

// состояние кнопки залпа
function updateVolleyBtn() {
  const el = document.getElementById('volleyBtn');
  if (!el) return;
  const cd = Math.max(0, state.volleyCd);
  const cdEl = document.getElementById('volleyCd');
  if (cd > 0) {
    el.classList.add('cool'); el.classList.remove('ready');
    if (cdEl) cdEl.textContent = Math.ceil(cd);
  } else {
    el.classList.remove('cool'); el.classList.add('ready');
    if (cdEl) cdEl.textContent = '';
  }
}

// ---------- ДОСТИЖЕНИЯ И ЕЖЕДНЕВНЫЕ ЗАДАНИЯ ----------
function ensureDaily() {
  const key = todayKey();
  if (!state.daily || state.daily.date !== key) {
    // снимок статистики на начало суток: прогресс считается с нуля каждый день
    const snap = {};
    for (const q of pickDaily(key)) snap[q.metric] = state.stats[q.metric] || 0;
    state.daily = { date: key, snapshot: snap, taken: {} };
    saveGame();
  }
  return state.daily;
}

function dailyQuests() { return ensureDaily().snapshot ? pickDaily(state.daily.date) : []; }

function achCount() { return Object.keys(state.ach || {}).length; }

function checkAchievements() {
  let gained = 0;
  for (const a of ACHIEVEMENTS) {
    if (state.ach[a.id]) continue;
    let ok = false;
    try { ok = a.cond(state); } catch (e) { ok = false; }
    if (!ok) continue;
    state.ach[a.id] = 1;
    state.gold += a.reward;
    state.stats.totalGold += a.reward;
    gained += a.reward;
    toast(`🏆 ${a.name}: +${fmt(a.reward)} золота`);
    sfx('bossKill');
  }
  if (gained) { saveGame(); updateQuestBadge(); }
  return gained;
}

function questReadyCount() {
  const d = ensureDaily();
  let n = 0;
  for (const q of pickDaily(d.date)) {
    const done = questProgress(q, state.stats, d.snapshot) >= q.target;
    if (done && !d.taken[q.key]) n++;
  }
  // незабранные достижения
  n += Math.max(0, achCount() - (state.seenAch || 0));
  return n;
}

function updateQuestBadge() {
  const el = document.getElementById('questBadge');
  const btn = document.getElementById('questBtn');
  if (!el || !btn) return;
  const n = questReadyCount();
  el.textContent = n ? ` ${n}` : '';
  btn.classList.toggle('hasnew', n > 0);
}

let questTab = 'daily';
function openQuests() {
  state.seenAch = achCount();
  updateQuestBadge();
  saveGame();
  document.getElementById('questModal').style.display = 'flex';
  renderQuests();
  setBanner(false);
}
function closeQuests() {
  document.getElementById('questModal').style.display = 'none';
  syncBanner(true);
}
function setQuestTab(tab) {
  questTab = tab;
  document.querySelectorAll('.qtab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  document.getElementById('qDaily').style.display = tab === 'daily' ? '' : 'none';
  document.getElementById('qAch').style.display = tab === 'ach' ? '' : 'none';
  renderQuests();
}

function renderQuests() {
  const d = ensureDaily();
  const wrap = questTab === 'daily' ? document.getElementById('qDaily') : document.getElementById('qAch');
  if (!wrap) return;
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  if (questTab === 'daily') {
    const qs = pickDaily(d.date);
    const rows = qs.map(q => {
      const cur = Math.min(q.target, questProgress(q, state.stats, d.snapshot));
      const done = cur >= q.target;
      const claimed = !!d.taken[q.key];
      const pct = Math.round(cur / q.target * 100);
      const action = claimed
        ? '<span class="qreward">✓ получено</span>'
        : done
          ? `<button class="qget" data-qclaim="${esc(q.key)}">Забрать</button>`
          : `<span class="qreward">🪙 ${fmt(q.reward)}</span>`;
      return `<div class="qitem ${claimed ? 'claimed' : done ? 'done' : ''}">
        <div class="qic">${done ? '✅' : '📜'}</div>
        <div class="qmain">
          <div class="qname">${esc(q.text)}</div>
          <div class="qbar"><div class="qbarfill" style="width:${pct}%"></div></div>
          <div class="qprog">${fmt(cur)} / ${fmt(q.target)}</div>
        </div>${action}</div>`;
    }).join('');
    wrap.innerHTML = `<div class="qsection">ОБНОВЛЯЮТСЯ КАЖДЫЙ ДЕНЬ · ${esc(d.date)}</div>${rows}`;
    wrap.querySelectorAll('[data-qclaim]').forEach(btn => {
      bindTap(btn, () => claimQuest(btn.dataset.qclaim));
    });
  } else {
    const done = ACHIEVEMENTS.filter(a => state.ach[a.id]);
    const todo = ACHIEVEMENTS.filter(a => !state.ach[a.id]);
    const row = (a, got) => {
      // прогресс: сколько осталось до открытия
      let bar = '';
      if (!got && typeof a.prog === 'function') {
        let cur = 0, goal = 1;
        try { const pr = a.prog(state); cur = Math.min(pr[0], pr[1]); goal = pr[1] || 1; } catch (e) { }
        const pct = Math.max(0, Math.min(100, Math.round(cur / goal * 100)));
        bar = `<div class="qbar"><div class="qbarfill" style="width:${pct}%"></div></div>` +
              `<div class="qprog">${fmt(cur)} / ${fmt(goal)}</div>`;
      }
      return `<div class="qitem ${got ? 'done' : ''}">
        <div class="qic">${a.icon}</div>
        <div class="qmain"><div class="qname">${esc(a.name)}</div>
        <div class="qdesc">${esc(a.desc)}</div>${bar}</div>
        <span class="qreward">${got ? '✓ +' + fmt(a.reward) : '🪙 ' + fmt(a.reward)}</span></div>`;
    };
    wrap.innerHTML = `<div class="qsection">ПОЛУЧЕНО ${done.length} / ${ACHIEVEMENTS.length}</div>` +
      (done.length ? done.map(a => row(a, true)).join('') : '<div class="qdesc" style="padding:6px">Пока ни одного — начни осаду!</div>') +
      (todo.length ? '<div class="qsection">ЕЩЁ НЕ ОТКРЫТЫ</div>' + todo.map(a => row(a, false)).join('') : '');
  }
}

function claimQuest(key) {
  const d = ensureDaily();
  const q = pickDaily(d.date).find(x => x.key === key);
  if (!q || d.taken[key]) return;
  if (questProgress(q, state.stats, d.snapshot) < q.target) return;
  d.taken[key] = 1;
  state.gold += q.reward;
  state.stats.totalGold += q.reward;
  sfx('coin');
  toast(`📜 Задание выполнено: +${fmt(q.reward)} золота`);
  saveGame();
  renderQuests();
  updateQuestBadge();
  updateHud();
}

bindTap(document.getElementById('questBtn'), openQuests);
bindTap(document.getElementById('questClose'), closeQuests);
document.querySelectorAll('.qtab').forEach(t => bindTap(t, () => setQuestTab(t.dataset.tab)));

bindTap(document.getElementById('treeBtn'), openTree);
bindTap(document.getElementById('invBtn'), openInv);
// монетизация: донат и бонусы за рекламу
bindTap(document.getElementById('donateBtn'), openDonate);
// баннер рекламы: показываем вне боя, скрываем во время осады
let _bannerState = null;
function syncBanner() {
  // в бою и в модалках баннер не нужен
  const inBattle = !!state.running;
  const modalOpen = ['donateModal', 'adModal', 'invModal', 'treeModal'].some(id => {
    const m = document.getElementById(id);
    return m && m.style.display === 'flex';
  });
  const want = !inBattle && !modalOpen;
  if (_bannerState !== want) { _bannerState = want; setBanner(want); }
}
setBanner(true); _bannerState = true;
bindTap(document.getElementById('donateClose'), closeDonate);
bindTap(document.getElementById('adBtn'), openAdPanel);
bindTap(document.getElementById('adClose'), closeAdPanel);
// клик по затемнению закрывает панели
['donateModal', 'adModal'].forEach(id => {
  const m = document.getElementById(id);
  if (m) m.addEventListener('click', (e) => { if (e.target === m) { closeDonate(); closeAdPanel(); } });
});
// счётчик очков навыков в HUD
function updateSkillBadge() {
  const el = document.getElementById('skillPts');
  if (el) el.textContent = state.skillPts;
  el && (el.style.color = state.skillPts > 0 ? '#7fc97f' : '#e8d5a3');
}
const _updateHud = updateHud;
let _achTick = 0;
updateHud = function () { _updateHud(); updateSkillBadge(); renderTreePtsOnly(); updateVipBadge(); syncBanner();
  if (++_achTick % 8 === 0) { checkAchievements(); updateQuestBadge(); } };
// VIP-статус показываем рядом с золотом
function updateVipBadge() {
  const g = document.getElementById('gold');
  if (!g) return;
  let b = document.getElementById('vipBadge');
  if (MON.vip || (state.iap && state.iap.vip)) {
    if (!b) {
      b = document.createElement('span');
      b.id = 'vipBadge';
      b.textContent = '👑';
      b.title = 'Статус Хранителя: +25% золота, +10% урона';
      b.style.cssText = 'margin-left:4px;cursor:help';
      g.parentNode.appendChild(b);
    }
  } else if (b) b.remove();
}
function renderTreePtsOnly() {
  const pts = document.getElementById('treePts');
  if (pts) pts.textContent = `· очков: ${state.skillPts}`;
}

buildShop(); buildStructShop(); buildInventoryUI(); buildTree(); updateHud();
window.__dbg = { state, enemies, arrows, fxs, weather, spawnBoss, bossForDay, audioState, sfx, musicScene,
  checkAchievements, dailyQuests, claimQuest, questReadyCount, openQuests, renderQuests, ACHIEVEMENTS };
// спрайты врагов и иконки предметов из Pixel Art Atlas (CC0) — грузим фоном, игра стартует сразу
Promise.all([loadAtlas('assets/sprites/'), loadItemIcons('assets/items/')]).then(() => {
  window.__dbg.atlas = atlasSprites;
  renderInventory();
  toast('🎨 Спрайты и иконки загружены');
}).catch(() => {});
ensureDaily();
updateQuestBadge();
requestAnimationFrame(tick);
