// ---------- Погодные явления ----------
// Дождь / снег / гроза / туман. Пиксельные частицы, лёгкие геймплей-модификаторы.
import { hex, rgb } from "./vendor/pixelfx/core/color.js?v=2";

const C = {
  rainA: hex('#9fc2e0'), rainB: hex('#7da3c8'),
  snowA: hex('#ffffff'), snowB: hex('#dfe8f4'),
  fog:   hex('#c8c4bc'),
  dark:  rgb(24, 30, 48),
  flash: rgb(235, 240, 255),
  bolt:  hex('#fff8d8'),
};

export const WEATHER_DEFS = {
  clear: { name: 'Ясно',        icon: '☀️', w: 55, mods: {} },
  rain:  { name: 'Дождь',       icon: '🌧', w: 20, mods: { enemySpeed: 0.85 }, desc: 'враги вязнут в грязи' },
  snow:  { name: 'Снегопад',    icon: '❄️', w: 8,  mods: { enemySpeed: 0.9, gold: 1.2 }, desc: 'стужа · добыча +20%' },
  storm: { name: 'Гроза',       icon: '⛈️', w: 7,  mods: { enemySpeed: 0.78 }, desc: 'молнии бьют по врагам' },
  fog:   { name: 'Туман',       icon: '🌫️', w: 6,  mods: { enemySpeed: 1.0 }, desc: 'видимость падает' },
};

export function pickWeather(day, rnd = Math.random) {
  if (day <= 1) return 'clear';
  const keys = Object.keys(WEATHER_DEFS);
  const total = keys.reduce((s, k) => s + WEATHER_DEFS[k].w, 0);
  let r = rnd() * total;
  for (const k of keys) { r -= WEATHER_DEFS[k].w; if (r <= 0) return k; }
  return 'clear';
}

export function weatherMods(kind) { return WEATHER_DEFS[kind]?.mods ?? {}; }

export function createWeather(kind) {
  const w = {
    kind, t: 0,
    drops: [], flakes: [], splashes: [],
    boltT: 2 + Math.random() * 3, flash: 0, boltX: -1, boltLife: 0,
    gust: Math.random() * 10,
  };
  if (kind === 'rain' || kind === 'storm') {
    const n = kind === 'storm' ? 80 : 55;
    for (let i = 0; i < n; i++) w.drops.push({ x: Math.random() * 680, y: Math.random() * 400, sp: 280 + Math.random() * 120 });
  }
  if (kind === 'snow') {
    // реалистичный снег: три слоя глубины (дальний мелкий, средний, крупные хлопья)
    for (let i = 0; i < 34; i++) {
      const layer = i % 3; // 0 даль, 1 середина, 2 передний
      w.flakes.push({
        x: Math.random() * 680, y: Math.random() * 400,
        v: [10, 18, 30][layer] + Math.random() * 4,
        ph: Math.random() * 7,
        layer,
        spin: Math.random() * 7,
      });
    }
  }
  return w;
}

export function updateWeather(w, dt) {
  w.t += dt; w.gust += dt;
  const wind = 28 + Math.sin(w.gust * 0.5) * 16;
  for (const d of w.drops) {
    d.y += d.sp * dt; d.x -= wind * dt * 2.8;
    if (d.y > 300) {
      // всплеск при ударе о землю
      if (w.splashes.length < 40) w.splashes.push({ x: d.x, y: 299, t: 0 });
      d.y = -8 - Math.random() * 60; d.x = 300 + Math.random() * 400;
    }
    if (d.x < -6) d.x += 700;
  }
  for (let i = w.splashes.length - 1; i >= 0; i--) {
    const s = w.splashes[i];
    s.t += dt;
    if (s.t > 0.22) w.splashes.splice(i, 1);
  }
  for (const f of w.flakes) {
    f.y += f.v * dt;
    // разные слои по-разному реагируют на ветер — эффект глубины
    f.x += (Math.sin(w.t * 0.9 + f.ph) * 4 - wind * (0.25 + f.layer * 0.35)) * dt;
    if (f.y > 304) { f.y = -6 - Math.random() * 16; f.x = 300 + Math.random() * 400; }
    if (f.x < -4) f.x += 700;
  }
  if (w.kind === 'storm') {
    w.boltT -= dt;
    if (w.boltT <= 0) {
      w.boltT = 3 + Math.random() * 4;
      w.flash = 1; w.boltLife = 0.18; w.boltX = -1;   // X задаст main.js по врагу
      w.boltPending = true;
    }
  }
  w.flash = Math.max(0, w.flash - dt * 3.2);
  w.boltLife = Math.max(0, w.boltLife - dt);
}

/** main.js зовёт при boltPending: бьёт молнией в ближайшего врага, возвращает x или -1 */
export function takeBolt(w, targetX) {
  w.boltPending = false;
  w.boltX = targetX;
  return targetX;
}

// Тёмная пелена + туман за персонажами (мягкая — солнце остаётся видно)
export function drawWeatherBack(p, w) {
  if (w.kind === 'rain' || w.kind === 'storm') p.rect(0, 0, 640, 360, C.dark, 0.10);
  if (w.kind === 'snow') p.rect(0, 0, 640, 360, C.dark, 0.05);
  if (w.kind === 'fog') {
    const t = w.t * 0.4;
    for (let i = 0; i < 3; i++) {
      const yy = 200 + i * 44 + Math.sin(t + i * 2) * 8;
      p.ellipse(200 + Math.sin(t * 0.7 + i) * 120, yy, 380, 18 + i * 6, C.fog, 0.10 - i * 0.02);
    }
  }
}

// Дождь, снег, молния — поверх всего
export function drawWeatherFront(p, w) {
  if (w.kind === 'rain' || w.kind === 'storm') {
    const c = w.kind === 'storm' ? C.rainA : C.rainB;
    const len = w.kind === 'storm' ? 7 : 4;   // штрихи дождя
    for (const d of w.drops) {
      const x = Math.round(d.x), y = Math.round(d.y);
      p.line(x, y, x - 2, y + len, c, 0.5);
    }
    // всплески у земли
    for (const s of w.splashes) {
      const k = Math.round(s.t * 28);
      p.put(Math.round(s.x - k), Math.round(s.y - k), c);
      p.put(Math.round(s.x + k), Math.round(s.y - k), c);
    }
  }
  if (w.kind === 'snow') {
    for (const f of w.flakes) {
      const x = Math.round(f.x), y = Math.round(f.y);
      if (f.layer === 2) {
        // крупный хлопья: ромбик 2×2 с подсветкой — читается как настоящий снег
        p.dot(x, y, C.snowA, 0.95);
        p.put(x + 1, y, C.snowB, 0.7); p.put(x, y + 1, C.snowB, 0.7);
        p.put(x - 1, y, C.snowB, 0.4); p.put(x, y - 1, C.snowB, 0.4);
      } else if (f.layer === 1) {
        p.dot(x, y, C.snowB, 0.8);
      } else {
        p.put(x, y, C.snowB, 0.4 + 0.2 * Math.sin(w.t * 3 + f.spin)); // дальний мерцает
      }
    }
  }
  if (w.boltLife > 0 && w.boltX >= 0) {
    // зигзаг молнии сверху до земли
    let y = 0, x = w.boltX;
    while (y < 296) {
      const ny = y + 16 + Math.round(Math.random() * 12);
      const nx = x + (Math.random() < 0.5 ? -6 : 6);
      p.line(x, y, nx, Math.min(ny, 296), C.bolt, Math.min(1, w.boltLife * 6));
      x = nx; y = ny;
    }
    p.disc(w.boltX, 296, 8, C.bolt, Math.min(1, w.boltLife * 4));
  }
  if (w.flash > 0) p.rect(0, 0, 640, 360, C.flash, w.flash * 0.5);
}
