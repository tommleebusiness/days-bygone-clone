// Звук и музыка на Web Audio API. Без файлов — всё синтезируется на лету,
// поэтому игра остаётся лёгкой и работает офлайн (в том числе в Android WebView).
//
// Использование:
//   initAudio()            — вызвать из обработчика жеста (клик/тап), иначе браузер блокирует звук
//   sfx('shot')            — короткий звуковой эффект
//   musicStart('calm'|'battle'|'boss') / musicStop()
//   toggleMusic() / toggleSfx() — вернуть новое состояние
//
// Настройки (вкл/выкл) сохраняются в localStorage.

const LS_KEY = 'dbs_audio_v1';

let ctx = null;
let master = null, musicBus = null, sfxBus = null;
let started = false;

let musicOn = true, sfxOn = true;
try {
  const s = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
  if (typeof s.music === 'boolean') musicOn = s.music;
  if (typeof s.sfx === 'boolean') sfxOn = s.sfx;
} catch (e) { /* игнорируем */ }

function save() {
  try { localStorage.setItem(LS_KEY, JSON.stringify({ music: musicOn, sfx: sfxOn })); } catch (e) {}
}

export function isMusicOn() { return musicOn; }
export function isSfxOn() { return sfxOn; }

// ---------- Инициализация (только по жесту пользователя) ----------
export function initAudio() {
  if (started) { resumeAudio(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;                       // очень старый браузер — играем без звука
  try {
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);

    musicBus = ctx.createGain();
    musicBus.gain.value = musicOn ? 0.16 : 0;
    musicBus.connect(master);

    sfxBus = ctx.createGain();
    sfxBus.gain.value = sfxOn ? 0.5 : 0;
    sfxBus.connect(master);

    started = true;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    stats.ctxState = ctx.state;
  } catch (e) { ctx = null; }
}

function resumeAudio() {
  if (ctx && ctx.state === 'suspended') ctx.resume();
}

export function audioState() {
  return {
    ready: started && !!ctx,
    ctxState: ctx ? ctx.state : 'none',
    music: musicOn, sfx: sfxOn,
    sfxPlayed: stats.sfxPlayed, notes: stats.notes,
    scene: music.scene, playing: music.playing,
  };
}

const stats = { sfxPlayed: 0, notes: 0, ctxState: 'none' };

// ---------- Базовые примитивы синтеза ----------
function env(node, t0, a, d, peak) {
  const g = node.gain;
  g.cancelScheduledValues(t0);
  g.setValueAtTime(0.0001, t0);
  g.exponentialRampToValueAtTime(Math.max(0.0001, peak), t0 + a);
  g.exponentialRampToValueAtTime(0.0001, t0 + a + d);
}

// тон с частотным скольжением
function tone({ freq = 440, to = null, type = 'square', dur = 0.12, vol = 0.5,
                at = 0, attack = 0.005, bus = null, detune = 0 }) {
  if (!ctx) return;
  const t0 = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (to && to !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
  if (detune) osc.detune.setValueAtTime(detune, t0);
  env(g, t0, attack, dur, vol);
  osc.connect(g); g.connect(bus || sfxBus);
  osc.start(t0);
  osc.stop(t0 + dur + attack + 0.02);
  stats.sfxPlayed++;
}

// шум (удар, взрыв, свист)
let noiseBuf = null;
function noiseBufGet() {
  if (noiseBuf || !ctx) return noiseBuf;
  const len = Math.floor(ctx.sampleRate * 0.6);
  noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}
function noise({ dur = 0.15, vol = 0.4, filter = 1200, q = 1, at = 0, sweep = null, bus = null }) {
  if (!ctx) return;
  const t0 = ctx.currentTime + at;
  const src = ctx.createBufferSource();
  src.buffer = noiseBufGet();
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.setValueAtTime(filter, t0);
  f.Q.value = q;
  if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(60, sweep), t0 + dur);
  const g = ctx.createGain();
  env(g, t0, 0.004, dur, vol);
  src.connect(f); f.connect(g); g.connect(bus || sfxBus);
  src.start(t0);
  src.stop(t0 + dur + 0.05);
  stats.sfxPlayed++;
}

// ---------- Звуковые эффекты ----------
export function sfx(name) {
  if (!ctx || !sfxOn) return;
  const R = (a, b) => a + Math.random() * (b - a);   // лёгкая вариативность
  switch (name) {
    case 'shot':                                   // выстрел из лука
      noise({ dur: 0.07, vol: 0.35, filter: R(1800, 2600), q: 1.2, sweep: 500 });
      tone({ freq: R(700, 820), to: 320, type: 'triangle', dur: 0.07, vol: 0.16 });
      break;
    case 'hit':                                    // попадание
      noise({ dur: 0.05, vol: 0.28, filter: R(900, 1400), q: 0.9 });
      break;
    case 'crit':                                   // критический удар
      noise({ dur: 0.09, vol: 0.4, filter: 2200, q: 1.6, sweep: 700 });
      tone({ freq: 1320, to: 660, type: 'square', dur: 0.1, vol: 0.22 });
      tone({ freq: 1980, to: 880, type: 'triangle', dur: 0.09, vol: 0.12, at: 0.01 });
      break;
    case 'kill':                                   // смерть врага
      tone({ freq: R(240, 300), to: 90, type: 'sawtooth', dur: 0.22, vol: 0.3 });
      noise({ dur: 0.16, vol: 0.24, filter: 700, sweep: 220 });
      break;
    case 'bossKill':                               // падение босса
      tone({ freq: 180, to: 55, type: 'sawtooth', dur: 0.7, vol: 0.4 });
      noise({ dur: 0.6, vol: 0.35, filter: 500, sweep: 120 });
      tone({ freq: 320, to: 160, type: 'square', dur: 0.5, vol: 0.2, at: 0.05 });
      break;
    case 'coin':                                   // золото
      tone({ freq: 1180, type: 'square', dur: 0.06, vol: 0.16 });
      tone({ freq: 1560, type: 'square', dur: 0.1, vol: 0.14, at: 0.05 });
      break;
    case 'buy':                                    // покупка улучшения
      tone({ freq: 520, to: 780, type: 'square', dur: 0.1, vol: 0.24 });
      tone({ freq: 1040, type: 'triangle', dur: 0.12, vol: 0.14, at: 0.07 });
      break;
    case 'build':                                  // постройка
      noise({ dur: 0.22, vol: 0.3, filter: 420, sweep: 180 });
      tone({ freq: 200, to: 300, type: 'sawtooth', dur: 0.2, vol: 0.22 });
      break;
    case 'volley':                                 // залп
      for (let i = 0; i < 5; i++) {
        noise({ dur: 0.08, vol: 0.2, filter: 2000, sweep: 600, at: i * 0.05 });
      }
      tone({ freq: 380, to: 900, type: 'square', dur: 0.35, vol: 0.18 });
      break;
    case 'wave':                                   // начало волны
      tone({ freq: 300, type: 'square', dur: 0.14, vol: 0.24 });
      tone({ freq: 400, type: 'square', dur: 0.14, vol: 0.24, at: 0.14 });
      tone({ freq: 500, type: 'square', dur: 0.2, vol: 0.26, at: 0.28 });
      break;
    case 'boss':                                   // рёв босса
      tone({ freq: 160, to: 70, type: 'sawtooth', dur: 1.1, vol: 0.4, attack: 0.08 });
      tone({ freq: 110, to: 55, type: 'triangle', dur: 1.2, vol: 0.3, at: 0.05, attack: 0.1 });
      noise({ dur: 1.0, vol: 0.2, filter: 300, sweep: 90 });
      break;
    case 'hurt':                                   // урон стене
      tone({ freq: 140, to: 80, type: 'sawtooth', dur: 0.3, vol: 0.34 });
      noise({ dur: 0.25, vol: 0.3, filter: 380, sweep: 120 });
      break;
    case 'equip':                                  // надел предмет
      tone({ freq: 660, type: 'triangle', dur: 0.09, vol: 0.2 });
      tone({ freq: 990, type: 'triangle', dur: 0.12, vol: 0.18, at: 0.07 });
      break;
    case 'loot':                                   // выпал лут
      tone({ freq: 880, type: 'sine', dur: 0.1, vol: 0.2 });
      tone({ freq: 1320, type: 'sine', dur: 0.16, vol: 0.18, at: 0.08 });
      tone({ freq: 1760, type: 'sine', dur: 0.18, vol: 0.12, at: 0.16 });
      break;
    case 'skill':                                  // изучен навык
      [523, 659, 784, 1046].forEach((f, i) =>
        tone({ freq: f, type: 'triangle', dur: 0.18, vol: 0.2, at: i * 0.07 }));
      break;
    case 'era':                                    // новая эпоха
      [392, 523, 659, 784, 1046].forEach((f, i) =>
        tone({ freq: f, type: 'square', dur: 0.3, vol: 0.22, at: i * 0.12 }));
      break;
    case 'gameover':                               // стены пали
      [392, 349, 294, 220].forEach((f, i) =>
        tone({ freq: f, type: 'sawtooth', dur: 0.4, vol: 0.28, at: i * 0.18 }));
      break;
    case 'ui':                                     // клик по интерфейсу
      tone({ freq: 700, to: 900, type: 'square', dur: 0.04, vol: 0.12 });
      break;
    default: break;
  }
}

// ---------- Музыка: процедурный чиптюн ----------
// 16 шагов в такте, 4 такта в петле. Аккордовая сетка меняется по сцене.
const SCENES = {
  calm: {
    bpm: 88,
    chords: [[0, 3, 7], [-2, 3, 5], [-4, 0, 5], [-5, -2, 2]],   // мягкая минорная петля
    bassOct: 2, arpOct: 4, leadOct: 5, drums: 'soft',
  },
  battle: {
    bpm: 116,
    chords: [[0, 3, 7], [5, 8, 12], [3, 7, 10], [-2, 2, 5]],
    bassOct: 2, arpOct: 4, leadOct: 5, drums: 'full',
  },
  boss: {
    bpm: 132,
    chords: [[0, 3, 6], [-1, 3, 6], [-3, 0, 4], [-2, 1, 6]],    // тревожные тритоны
    bassOct: 1, arpOct: 4, leadOct: 5, drums: 'hard',
  },
};

const music = { playing: false, scene: 'calm', step: 0, nextTime: 0, timer: null };
const ROOT = 220;   // A3
const semis = (n, oct) => ROOT * Math.pow(2, n / 12) * Math.pow(2, oct - 3);

function noteAt(scene, step) {
  const S = SCENES[scene];
  const bar = Math.floor(step / 16) % S.chords.length;
  const beat = step % 16;
  const chord = S.chords[bar];
  const out = [];

  // бас — на сильных долях
  if (beat % 4 === 0) {
    out.push({ f: semis(chord[0], S.bassOct), type: 'triangle', dur: 0.34, vol: 0.5 });
  } else if (beat === 6 || beat === 14) {
    out.push({ f: semis(chord[0] + 7, S.bassOct), type: 'triangle', dur: 0.18, vol: 0.35 });
  }
  // арпеджио — восьмые
  if (beat % 2 === 0) {
    const n = chord[(beat / 2) % chord.length];
    out.push({ f: semis(n, S.arpOct), type: 'square', dur: 0.13, vol: 0.22 });
  }
  // мелодия — редкие ноты
  if (beat === 0 || beat === 5 || beat === 10 || beat === 13) {
    const n = chord[(beat + bar) % chord.length] + 7;
    out.push({ f: semis(n, S.leadOct), type: 'triangle', dur: 0.3, vol: 0.18 });
  }
  // барабаны
  if (S.drums !== 'soft' || beat % 4 === 0) {
    if (beat === 0 || beat === 8) out.push({ drum: 'kick' });
    if (S.drums === 'full' && (beat === 4 || beat === 12)) out.push({ drum: 'snare' });
    if (S.drums === 'hard' && (beat === 2 || beat === 6 || beat === 10 || beat === 14)) out.push({ drum: 'kick' });
    if (S.drums !== 'soft' && beat % 2 === 1) out.push({ drum: 'hat', vol: beat % 4 === 1 ? 0.18 : 0.1 });
  }
  return out;
}

function playNote(ev, time) {
  if (!ctx) return;
  if (ev.drum) {
    if (ev.drum === 'kick') {
      const osc = ctx.createOscillator(), g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(120, time);
      osc.frequency.exponentialRampToValueAtTime(45, time + 0.11);
      env(g, time, 0.003, 0.13, 0.6);
      osc.connect(g); g.connect(musicBus);
      osc.start(time); osc.stop(time + 0.18);
    } else if (ev.drum === 'snare') {
      const src = ctx.createBufferSource(); src.buffer = noiseBufGet();
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.8;
      const g = ctx.createGain(); env(g, time, 0.002, 0.12, 0.35);
      src.connect(f); f.connect(g); g.connect(musicBus);
      src.start(time); src.stop(time + 0.16);
    } else {
      const src = ctx.createBufferSource(); src.buffer = noiseBufGet();
      const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6500;
      const g = ctx.createGain(); env(g, time, 0.001, 0.04, ev.vol || 0.12);
      src.connect(f); f.connect(g); g.connect(musicBus);
      src.start(time); src.stop(time + 0.07);
    }
    stats.notes++;
    return;
  }
  const osc = ctx.createOscillator(), g = ctx.createGain();
  osc.type = ev.type;
  osc.frequency.setValueAtTime(ev.f, time);
  env(g, time, 0.01, ev.dur, ev.vol * 0.5);
  osc.connect(g); g.connect(musicBus);
  osc.start(time); osc.stop(time + ev.dur + 0.05);
  stats.notes++;
}

// планировщик с опережением: стабильный ритм без пропусков
function pump() {
  if (!ctx || !music.playing) return;
  const S = SCENES[music.scene];
  const stepDur = 60 / S.bpm / 4;                 // 16-е
  while (music.nextTime < ctx.currentTime + 0.18) {
    for (const ev of noteAt(music.scene, music.step)) playNote(ev, music.nextTime);
    music.nextTime += stepDur;
    music.step = (music.step + 1) % 64;
  }
}

export function musicStart(scene = 'calm') {
  if (!ctx || !musicOn) return;
  if (music.playing && music.scene === scene) return;
  music.scene = scene;
  music.step = 0;
  music.nextTime = ctx.currentTime + 0.06;
  if (!music.playing) {
    music.playing = true;
    music.timer = setInterval(pump, 30);
  }
  pump();
}

export function musicStop() {
  music.playing = false;
  if (music.timer) { clearInterval(music.timer); music.timer = null; }
}

export function musicScene(scene) {
  if (!ctx || !musicOn) { music.scene = scene; return; }
  if (!music.playing) { musicStart(scene); return; }
  if (music.scene !== scene) { music.scene = scene; music.step = 0; }
}

export function toggleMusic() {
  musicOn = !musicOn;
  if (ctx) musicBus.gain.value = musicOn ? 0.16 : 0;
  if (musicOn) musicStart(music.scene); else musicStop();
  save();
  return musicOn;
}

export function toggleSfx() {
  sfxOn = !sfxOn;
  if (ctx) sfxBus.gain.value = sfxOn ? 0.5 : 0;
  save();
  return sfxOn;
}

// Разблокировка звука по первому реальному жесту: браузеры (и Android WebView)
// создают AudioContext в состоянии suspended и требуют жест пользователя.
if (typeof window !== 'undefined') {
  const unlock = () => {
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    if (ctx.state === 'running' && musicOn && !music.playing) musicStart(music.scene);
  };
  ['pointerdown', 'touchstart', 'keydown', 'click'].forEach((ev) =>
    window.addEventListener(ev, unlock, { passive: true }));
}

// приостановка при уходе со страницы (экономия батареи на телефоне)
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) { if (ctx.state === 'running') ctx.suspend(); }
    else { if (ctx.state === 'suspended') ctx.resume(); }
  });
}
