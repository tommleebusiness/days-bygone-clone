// Компактный всплывающий текст (урон/КРИТ) пиксельным шрифтом 3×5.
// Заменяет огромный crit-number 152×120 крошечной вспышкой 6×10.
// Контракт pixelfx: meta { size, origin, duration, loop } + create(opts).

import { hex } from "../vendor/pixelfx/core/color.js?v=2";

// пиксельный шрифт 3×5: массив из 5 строк по 3 символа
const FONT = {
  '0': ['111', '101', '101', '101', '111'],
  '1': ['010', '110', '010', '010', '111'],
  '2': ['111', '001', '111', '100', '111'],
  '3': ['111', '001', '111', '001', '111'],
  '4': ['101', '101', '111', '001', '001'],
  '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'],
  '7': ['111', '001', '010', '010', '010'],
  '8': ['111', '101', '111', '101', '111'],
  '9': ['111', '101', '111', '001', '111'],
  'К': ['101', '101', '110', '101', '101'],
  'Р': ['111', '101', '111', '100', '100'],
  'И': ['101', '101', '111', '101', '101'],
  'Т': ['111', '010', '010', '010', '010'],
  '!': ['010', '010', '010', '000', '010'],
  '+': ['000', '010', '111', '010', '000'],
  '.': ['000', '000', '000', '000', '010'],
  'k': ['101', '101', '110', '101', '101'],
  'м': ['000', '101', '111', '111', '101'],
};

export const meta = {
  name: 'Float Text',
  desc: 'Крошечный всплывающий пиксельный текст (урон, КРИТ) со вспышкой.',
  tags: ['ui', 'text', 'damage', 'one-shot'],
  size: [64, 24],
  origin: [32, 16],
  duration: 0.75,
  loop: false,
};

export function create(opts) {
  const text = String(opts.text ?? '');
  const crit = !!opts.crit;
  const sc = crit ? 2 : 1;                       // крит крупнее обычного урона
  const col = crit ? hex('#f4c542') : hex('#f0e8d0');
  const edge = crit ? hex('#8a2f26') : hex('#2b2118');
  let t = 0;
  return {
    update(dt) { t += dt; },
    draw(p) {
      const k = Math.min(1, t / meta.duration);
      const alpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      const rise = Math.round(k * (crit ? 14 : 10));   // поднимается вверх
      const y0 = -rise;

      // вспышка при крите: 4 луча
      if (crit) {
        const fl = 1 - k;
        p.dot(0, y0 + 2, hex('#ffe08a'), fl * 0.9);
        p.dot(-5, y0 + 2, hex('#ff9a2d'), fl * 0.7);
        p.dot(5, y0 + 2, hex('#ff9a2d'), fl * 0.7);
        p.dot(0, y0 - 3, hex('#ff9a2d'), fl * 0.7);
        p.dot(0, y0 + 7, hex('#ff9a2d'), fl * 0.5);
        p.dot(-3, y0 - 1, hex('#ffc23d'), fl * 0.5);
        p.dot(3, y0 - 1, hex('#ffc23d'), fl * 0.5);
      }

      // текст по центру, с тёмной обводкой
      const cw = 4 * sc;                              // ширина символа + пробел
      const total = text.length * cw - sc;
      let cx = -Math.floor(total / 2);
      const cy = y0 - Math.floor((5 * sc) / 2);
      for (const ch of text) {
        const glyph = FONT[ch];
        if (glyph) {
          for (let gy = 0; gy < 5; gy++) for (let gx = 0; gx < 3; gx++) {
            if (glyph[gy][gx] !== '1') continue;
            // обводка (сдвиг на 1)
            p.dot(cx + gx * sc - 0, cy + gy * sc + 1, edge, alpha * 0.8);
            p.dot(cx + gx * sc, cy + gy * sc, col, alpha);
          }
        }
        cx += cw;
      }
    },
  };
}
