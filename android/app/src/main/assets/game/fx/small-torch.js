// Компактный настенный факел под мир 640×360 (28×52). Контракт pixelfx:
// meta { size, origin, duration, loop } + create(opts) → { update(dt), draw(p) }.
// ВАЖНО: origin [14,40] — рисуем вокруг него, отрицательные координаты
// попадают в кадр (origin=0 обрезал бы пламя).

import { hex } from "../vendor/pixelfx/core/color.js?v=2";

const WOOD = hex('#4a3524');
const IRON = hex('#5a5560');
const IRON_L = hex('#837c8c');
const FLAME_D = hex('#b8331c');
const FLAME_M = hex('#f26a1d');
const FLAME_H = hex('#ffc23d');
const FLAME_C = hex('#fff0a8');
const CHAR = hex('#2b2118');

export const meta = {
  name: 'Small Torch',
  desc: 'Компактный настенный факел с колышущимся пламенем и искрами (2× детализация).',
  tags: ['fire', 'torch', 'prop', 'loop'],
  size: [28, 52],
  origin: [14, 40],
  duration: 2,
  loop: true,
};

export function create() {
  let t = 0;
  return {
    update(dt) { t += dt; },
    draw(p) {
      const sway = Math.sin(t * 5.1) * 1.6 + Math.sin(t * 2.3) * 1.0;
      const hgt = 12 + Math.sin(t * 7.7) * 2.2;

      // кронштейн в стене
      for (let y = 0; y <= 8; y++) p.dot(0, y, IRON);
      p.dot(0, 8, IRON_L);
      p.dot(-1, 5, IRON_L);
      // чаша — шире и с ободком
      for (let x = -4; x <= 4; x++) p.dot(x, -2, IRON);
      for (let x = -3; x <= 3; x++) p.dot(x, -1, IRON);
      p.dot(-4, -3, IRON_L); p.dot(4, -3, IRON_L);
      p.dot(-5, -2, IRON_L); p.dot(5, -2, IRON_L);
      for (let x = -2; x <= 2; x++) p.dot(x, 0, CHAR);
      // деревянная обмотка — витки
      for (let y = -8; y <= -4; y++) for (let x = -2; x <= 2; x++) p.dot(x, y, WOOD);
      p.dot(-2, -6, hex('#5f4529')); p.dot(2, -8, hex('#5f4529'));

      // пламя — три слоя, сужается вверх, колышется
      const n = Math.round(hgt);
      for (let i = 0; i < n; i++) {
        const f = i / n;
        const half = Math.max(0, Math.round((1 - f) * 3.4 + 0.5));
        const y = -12 - i;
        const ox = Math.round(sway * (0.4 + f));
        for (let x = -half; x <= half; x++) {
          const edge = Math.abs(x) === half;
          let col;
          if (i < 3 && Math.abs(x) <= 2) col = FLAME_C;
          else if (f < 0.45) col = edge ? FLAME_M : FLAME_H;
          else if (f < 0.8) col = edge ? FLAME_D : FLAME_M;
          else col = edge ? FLAME_D : FLAME_H;
          p.dot(x + ox, y, col);
          // боковые «язычки» для живости
          if (edge && i % 3 === 0) p.dot(x + ox + (x > 0 ? 1 : -1), y + 1, FLAME_D);
        }
      }
      p.dot(Math.round(sway), -13 - n, FLAME_C);
      p.dot(Math.round(sway * 1.3), -14 - n, FLAME_H);

      // редкие искры
      for (let k = 0; k < 3; k++) {
        const ph = (t * (0.8 + k * 0.3) + k * 0.4) % 1;
        if (ph < 0.7) {
          const ex = Math.round(sway + Math.sin(t * 3 + k * 2) * 2.4) + (k - 1) * 2;
          const ey = -20 - Math.round(ph * 12);
          p.dot(ex, ey, ph < 0.35 ? FLAME_H : FLAME_M);
        }
      }
    },
  };
}
