// Компактный взрыв (40×32) вместо vendor-fireball (136×56, loop → не удалялся и копился).
// Контракт pixelfx: meta { size, origin, duration, loop } + create(opts) → { update(dt), draw(p) }.

import { hex } from "../vendor/pixelfx/core/color.js?v=2";

const CORE = hex('#fff3a6');
const HOT = hex('#ffc23d');
const FLAME = hex('#f2561d');
const DEEP = hex('#8a1f17');
const SMOKE = hex('#4a443c');
const SMOKE_L = hex('#6b6459');
const EMBER = hex('#ff8a2a');

export const meta = {
  name: 'Small Boom',
  desc: 'Компактный взрыв: вспышка, клубы пламени, искры и дым. Не цикличный — корректно завершается.',
  tags: ['impact', 'explosion', 'fire', 'one-shot'],
  size: [40, 32],
  origin: [16, 20],
  duration: 0.55,
  loop: false,
};

export function create(opts) {
  const seed = opts.seed ?? 1;
  const rnd = (i) => {
    // детерминированный «случай» по seed, чтобы каждый взрыв выглядел по-своему
    const v = Math.sin((seed + i * 12.9898) * 43758.5453);
    return v - Math.floor(v);
  };
  let t = 0;
  return {
    update(dt) { t += dt; },
    draw(p) {
      const k = Math.min(1, t / meta.duration);        // 0..1
      const r = 2 + k * 13;                            // радиус разлёта
      const fade = 1 - k;

      // --- ядро вспышки (первые 40%) ---
      if (k < 0.4) {
        const s = 1 - k / 0.4;
        for (let dy = -4; dy <= 4; dy++) for (let dx = -5; dx <= 5; dx++) {
          if (dx * dx + dy * dy > 24) continue;
          const inner = dx * dx + dy * dy < 9;
          p.dot(dx, dy - 2, inner ? CORE : HOT, s);
        }
      }

      // --- клубы пламени, разлетающиеся вверх ---
      for (let i = 0; i < 7; i++) {
        const a = -Math.PI / 2 + (rnd(i) - 0.5) * 2.6;
        const sp = 0.5 + rnd(i + 20) * 0.7;
        const d = r * sp;
        const x = Math.round(Math.cos(a) * d);
        const y = Math.round(Math.sin(a) * d * 0.8) - 3;
        if (k > 0.75) break;
        const col = k < 0.3 ? HOT : k < 0.55 ? FLAME : DEEP;
        p.dot(x, y, col, fade);
        if (k < 0.45) p.dot(x + 1, y + 1, col, fade * 0.7);
      }

      // --- дым: поднимается после вспышки ---
      if (k > 0.25) {
        const sk = (k - 0.25) / 0.75;
        for (let i = 0; i < 5; i++) {
          const sx = Math.round((rnd(i + 40) - 0.5) * 16);
          const sy = Math.round(-6 - sk * (8 + rnd(i + 60) * 10));
          const a = (1 - sk) * 0.75;
          p.dot(sx, sy, i % 2 ? SMOKE : SMOKE_L, a);
          if (sk > 0.3) p.dot(sx + 1, sy + 1, SMOKE, a * 0.6);
        }
      }

      // --- искры ---
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + rnd(i + 80) * 0.8;
        const d = 3 + k * (14 + rnd(i + 90) * 8);
        const x = Math.round(Math.cos(a) * d);
        const y = Math.round(Math.sin(a) * d * 0.7);
        if (k > 0.85) break;
        p.dot(x, y, i % 2 ? EMBER : HOT, (1 - k) * 0.9);
      }

      // --- ударная волна: расходящееся кольцо в начале ---
      if (k < 0.5) {
        const rr = 4 + k * 18;
        const a2 = (1 - k / 0.5) * 0.5;
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * Math.PI * 2;
          p.dot(Math.round(Math.cos(a) * rr), Math.round(Math.sin(a) * rr * 0.55), hex('#fff3a6'), a2);
        }
      }
    },
  };
}
