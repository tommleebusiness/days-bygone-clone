// Эффекты: смерть врагов, боевые вспышки, параллакс-фон.
import { hex } from "../vendor/pixelfx/core/color.js?v=2";

const COL = {
  bone: hex('#e8e2d0'), blood: hex('#8a1f17'), bloodD: hex('#5a1008'),
  smoke: hex('#4a443c'), smokeL: hex('#6b6459'), gold: hex('#f4c542'),
  purple: hex('#a05ad0'), ice: hex('#9ad0f0'), spark: hex('#ffc23d'),
};

// ---------- Параллакс: дальние горы и лес ----------
// Рисуется под небом, смещается медленно (глубина). Не мешает геймплею.
export function drawParallax(p, w, groundY, time, scrollX = 0) {
  // три слоя гор разной дальности
  const layers = [
    { y: groundY - 118, h: 46, col: hex('#2a2634'), step: 90, off: 0.0 },
    { y: groundY - 104, h: 36, col: hex('#353045'), step: 120, off: 0.5 },
    { y: groundY - 92,  h: 28, col: hex('#413a55'), step: 150, off: 1.0 },
  ];
  for (const L of layers) {
    for (let x = -40; x < w + 40; x += L.step) {
      const ox = x - Math.round((scrollX * 0.15 + L.off * L.step) % L.step);
      // треугольник горы
      for (let i = 0; i < L.h; i++) {
        const hw = Math.round(L.h * 0.8 * (1 - i / L.h));
        for (let dx = -hw; dx <= hw; dx++) {
          p.put(ox + dx, L.y + L.h - i, L.col);
        }
      }
      // снежная шапка у верхнего слоя
      if (L.off === 0) {
        for (let dx = -3; dx <= 3; dx++) p.put(ox + dx, L.y - 1, hex('#6a6480'));
        p.put(ox, L.y - 2, hex('#8a84a0'));
      }
    }
  }
  // дальний лес — зубчатая кромка
  for (let x = 0; x < w; x += 7) {
    const hh = 6 + Math.round(Math.sin(x * 0.3) * 3) + ((x * 13) % 5);
    for (let i = 0; i < hh; i++) {
      const hw = Math.round((hh - i) * 0.35);
      for (let dx = -hw; dx <= hw; dx++) p.put(x + dx, groundY - 56 + i, hex('#1e2a1a'));
    }
  }
}

// ---------- Эффект смерти врага: разлёт костей и праха ----------
// spawnDeathFx(x, y, kind) — вызывается при смерти
export function deathParticles(x, y, kind, seed = 1) {
  const out = [];
  const n = kind === 'boss' ? 26 : kind === 'skeleton' ? 10 : 14;
  const isSkeleton = kind === 'skeleton' || kind === 'necro';
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (seed % 7) * 0.2;
    const sp = 20 + ((i * 37 + seed) % 40);
    out.push({
      x, y,
      vx: Math.cos(a) * sp,
      vy: -Math.abs(Math.sin(a) * sp) - 20,
      life: 0.7 + ((i * 13) % 40) / 100,
      col: isSkeleton ? COL.bone : (i % 3 === 0 ? COL.blood : COL.smokeL),
      size: kind === 'boss' && i % 4 === 0 ? 2 : 1,
      isBone: isSkeleton && i % 3 === 0,
    });
  }
  return out;
}

// ---------- Вспышка-искры при попадании крита ----------
export function critSparks(x, y, seed = 1) {
  const out = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + (seed % 5) * 0.3;
    out.push({ x, y, vx: Math.cos(a) * 60, vy: Math.sin(a) * 60,
      life: 0.3, col: i % 2 ? COL.gold : COL.spark, size: 1 });
  }
  return out;
}

// ---------- Ледяной взрыв при заморозке ----------
export function iceBurst(x, y) {
  const out = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    out.push({ x, y, vx: Math.cos(a) * 40, vy: Math.sin(a) * 40 - 10,
      life: 0.5, col: i % 2 ? COL.ice : hex('#e0f0ff'), size: 1 });
  }
  return out;
}

// ---------- Обновление/отрисовка частиц ----------
export function updateParticles(list, dt) {
  for (let i = list.length - 1; i >= 0; i--) {
    const q = list[i];
    q.x += q.vx * dt;
    q.y += q.vy * dt;
    q.vy += 160 * dt;          // гравитация
    q.vx *= 0.98;
    q.life -= dt;
    if (q.life <= 0) list.splice(i, 1);
  }
}
export function drawParticles(p, list) {
  for (const q of list) {
    const a = Math.min(1, q.life * 2.5);
    if (q.size === 2) {
      p.put(Math.round(q.x), Math.round(q.y), q.col, a);
      p.put(Math.round(q.x) + 1, Math.round(q.y), q.col, a * 0.6);
    } else {
      p.put(Math.round(q.x), Math.round(q.y), q.col, a);
    }
  }
}
