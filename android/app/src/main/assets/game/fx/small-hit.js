// Компактная вспышка попадания (24×20) — вместо громоздкой hit-flash 80×64.
// Контракт pixelfx: meta { size, origin, duration, loop } + create(opts).

import { hex } from "../vendor/pixelfx/core/color.js?v=2";

const HOT = hex('#fff4c0');
const MID = hex('#ffc23d');
const DIM = hex('#f26a1d');

export const meta = {
  name: 'Small Hit',
  desc: 'Крошечная звёздочка-вспышка при попадании.',
  tags: ['impact', 'hit', 'spark', 'one-shot'],
  size: [24, 20],
  origin: [12, 10],
  duration: 0.22,
  loop: false,
};

export function create(opts) {
  const seed = opts.seed ?? 1;
  let t = 0;
  return {
    update(dt) { t += dt; },
    draw(p) {
      const k = Math.min(1, t / meta.duration);
      const r = 1 + Math.round(k * 5);            // искры разлетаются
      const a = 1 - k;
      // центр
      p.dot(0, 0, k < 0.4 ? HOT : MID, a);
      // 6 искр по кругу (с фиксированным разбросом от seed)
      for (let i = 0; i < 6; i++) {
        const ang = i * Math.PI / 3 + (seed % 7) * 0.4;
        const x = Math.round(Math.cos(ang) * r);
        const y = Math.round(Math.sin(ang) * r * 0.7);
        p.dot(x, y, i % 2 ? MID : DIM, a * 0.9);
      }
      // короткий крест в момент удара
      if (k < 0.5) {
        p.dot(-1, 0, HOT, a); p.dot(1, 0, HOT, a);
        p.dot(0, -1, HOT, a); p.dot(0, 1, HOT, a);
      }
    },
  };
}
