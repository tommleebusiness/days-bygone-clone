// structure-upgrades.js — визуальные тиры построек до 15 уровня
// Каждый тир добавляет отдельные архитектурные слои, чтобы апгрейд читался
// по силуэту, а не только по цифре "ур. N".

import { hex } from "./vendor/pixelfx/core/color.js?v=2";

const G2 = 236;

// палитры по тирам (металл/самоцвет/аура)
// Палитры тиров подобраны как ПЛАВНЫЙ ход по цветовому кругу:
// камень → золото (45°) → сталь (210°) → аркана (270°) → багровый (345°) → золото (45°).
// Раньше 9→12 прыгало с фиолетового на оранжевый, а 12→15 с оранжевого на белый —
// читалось как «смена скина», а не как рост одной постройки.
export const TIER_PAL = [
  { metal: hex('#8a8578'), metalL: hex('#b5afa1'), gem: hex('#8a6a3d'), aura: hex('#c9a44f') }, // 0 камень
  { metal: hex('#a89a6a'), metalL: hex('#d8c68a'), gem: hex('#c9a44f'), aura: hex('#f4c542') }, // 1 золото
  { metal: hex('#8a8fa8'), metalL: hex('#c8cfe0'), gem: hex('#6ac8e8'), aura: hex('#7fd8f8') }, // 2 сталь/лёд
  { metal: hex('#9a7ac8'), metalL: hex('#d4bcf0'), gem: hex('#b47cf8'), aura: hex('#c98af5') }, // 3 аркана
  { metal: hex('#a84860'), metalL: hex('#dc8ca0'), gem: hex('#ff5a7a'), aura: hex('#ff8a9a') }, // 4 багровый
  { metal: hex('#e8c050'), metalL: hex('#fff0a8'), gem: hex('#ffffff'), aura: hex('#ffe08a') }, // 5 легенда-золото
];

function put(p, x, y, col, a) { p.put(Math.round(x), Math.round(y), col, a); }
function rct(p, x, y, w, h, col) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(p, x + i, y + j, col);
}

// ---------- второй ярус: надстройка с зубцами (тир 2+)
export function drawSecondTier(p, x, topY, W2, st, t, pal) {
  const h2 = 14 + st.tier * 2;
  const w2 = Math.max(6, W2 - 4);
  // тело яруса
  rct(p, x - w2, topY - h2, w2 * 2, h2, pal.metal);
  // светлая левая грань
  for (let j = 0; j < h2; j++) put(p, x - w2, topY - h2 + j, pal.metalL);
  // тёмная правая
  for (let j = 0; j < h2; j++) put(p, x + w2 - 1, topY - h2 + j, hex('#4a4438'));
  // кладка
  for (let row = 0; row * 6 < h2; row++) {
    const yy = topY - h2 + 3 + row * 6;
    rct(p, x - w2, yy, w2 * 2, 1, hex('#3a3428'));
  }
  // зубцы по верху
  for (let i = -w2; i < w2; i += 4) {
    const mh = (Math.abs(i) % 8 === 0) ? 5 : 3;
    rct(p, x + i, topY - h2 - mh, 3, mh, pal.metal);
    put(p, x + i, topY - h2 - mh, pal.metalL);
  }
  return topY - h2 - 5;
}

// ---------- шпили по углам (тир 3+)
export function drawSpires(p, x, topY, W2, st, t, pal) {
  const n = st.tier >= 5 ? 4 : 2;
  const offs = n === 4 ? [-W2 + 1, -4, 4, W2 - 2] : [-W2 + 1, W2 - 2];
  offs.forEach((ox, i) => {
    const bx = x + ox;
    const hh = 20 + (i % 2) * 6 + st.tier * 2;      // заметно выше
    // конус шпиля: широкий низ → остриё вверх
    for (let j = 0; j < hh; j++) {
      const ww = Math.max(0, Math.round((j / hh) * 3.2));
      for (let k = -ww; k <= ww; k++) {
        let c = pal.metal;
        if (k === -ww) c = pal.metalL;
        else if (k === ww) c = hex('#3a3428');
        else if (j > hh - 3) c = pal.metalL;
        put(p, bx + k, topY - j, c);
      }
    }
    // тёмная черепица поперёк
    for (let j = 3; j < hh - 2; j += 5) {
      const ww = Math.max(0, Math.round((j / hh) * 3.2));
      rct(p, bx - ww, topY - j, ww * 2 + 1, 1, hex('#4a4038'));
    }
    // навершие-самоцвет (крупнее)
    const gm = st.tier >= 4 ? pal.gem : pal.metalL;
    const pulse = 0.55 + 0.45 * Math.sin(t * 2.6 + i * 1.3);
    p.dot(bx, topY - hh - 2, 3, gm, pulse);
    p.dot(bx, topY - hh - 2, 2, hex('#ffffff'), pulse * 0.9);
    // штандарт на двух крайних шпилях (тир 4+)
    if (st.tier >= 4 && (i === 0 || i === offs.length - 1)) {
      const sx = bx + (i === 0 ? -2 : 2);
      const dir = i === 0 ? -1 : 1;
      for (let k = 0; k < 7; k++) {
        const wob = Math.round(Math.sin(t * 3 + k * 0.5) * 1.2);
        rct(p, sx + dir * k, topY - hh - 6 + wob, 1, 4 - Math.abs(k - 3) / 2, pal.aura);
      }
    }
  });
}

// ---------- самоцветы в кладке (тир 3+)
export function drawWallGems(p, x, topY, W2, H, st, t, pal) {
  const seed = (x * 13) % 17;
  for (let row = 0; row < Math.floor(H / 16); row++) {
    for (let col = 0; col < 2; col++) {
      const gx = x + (col === 0 ? -W2 + 4 : W2 - 6);
      const gy = topY + 10 + row * 16;
      // мерцание нерегулярное: hash от координат + времени
      const ph = Math.sin(t * 2.2 + (gx * 0.7 + gy * 1.9 + seed)) * 0.5 + 0.5;
      if (ph < 0.30) continue;
      // гранёный самоцвет 2x2 с бликом
      p.dot(gx, gy, 2, pal.gem, 0.92);
      put(p, gx - 1, gy - 1, pal.gem, 0.7);
      put(p, gx, gy, hex('#ffffff'), ph * 0.85);
      put(p, gx - 1, gy + 1, hex('#000000'), 0.18);
    }
  }
}

// ---------- руны (тир 4+)
const RUNE_SHAPES = [
  [[0, 0], [0, 1], [1, 1], [1, 2]],           // Γ
  [[0, 0], [1, 0], [1, 1], [0, 2]],           // Z
  [[0, 0], [0, 2], [1, 1]],                   // ⊢
  [[0, 0], [1, 1], [0, 2], [1, 2]],           // —
];
export function drawRunes(p, x, topY, H, st, t, pal) {
  const n = Math.min(5, Math.floor(H / 14));
  for (let i = 0; i < n; i++) {
    const ry = topY + 12 + i * 14;
    const rx = x - 5 + ((i * 7) % 9);
    const shape = RUNE_SHAPES[(i + Math.floor(x)) % RUNE_SHAPES.length];
    const glow = 0.35 + 0.4 * Math.sin(t * 1.8 + i * 1.1);
    for (const [dx, dy] of shape) {
      put(p, rx + dx, ry + dy, pal.aura, Math.min(1, glow + 0.25));
      put(p, rx + dx + 1, ry + dy, pal.aura, Math.min(1, glow + 0.25));
      put(p, rx + dx, ry + dy + 1, pal.aura, glow * 0.8);
    }
    if (glow > 0.5) {
      rct(p, rx - 1, ry - 1, 5, 5, pal.aura);
      // сброс альфы: подложка была яркой, вернём полупрозрачность через dot-сетку
      for (let k = 0; k < 9; k++) {
        const a = (k % 3); const b2 = (k / 3) | 0;
        if ((k + Math.floor(t * 4)) % 2 === 0) put(p, rx - 1 + a, ry - 1 + b2, hex('#000000'), 0.06);
      }
    }
  }
}

// ---------- аура вокруг постройки (тир 4+), рисуется ПОД постройкой
export function drawStructureAura(p, x, topY, W2, H, st, t, pal) {
  if (!st.aura) return;
  const cx = x, cy = topY + H / 2;
  const rx = W2 + 12, ry = H / 2 + 10;
  const strong = st.tier >= 5 ? 1.5 : 1;   // у легендарных — вдвое заметнее
  // плотный ореол: три кольца с ВЫСОКОЙ альфой (dither не съедает)
  for (let ring = 3; ring >= 1; ring--) {
    const k = ring / 3;
    const a = Math.min(0.85, (0.34 + (1 - k) * 0.26) * strong);
    const col = ring === 3 ? mixHex(pal.aura, 0xffffff, 0.35) : pal.aura;
    const n = Math.round((rx + ry) * 3.0);
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2;
      const wob = 1 + Math.sin(ang * 5 + t * 1.4) * 0.035;
      put(p, cx + Math.cos(ang) * (rx + ring * 2) * wob,
        cy + Math.sin(ang) * (ry + ring * 2) * wob, col, a);
    }
  }
  // второй проход — утолщаем кольцо (2px), чтобы читалось как свечение
  for (let ring = 2; ring >= 1; ring--) {
    const a = Math.min(0.55, 0.24 * strong);
    const n = Math.round((rx + ry) * 3.0);
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2;
      const wob = 1 + Math.sin(ang * 5 + t * 1.4) * 0.035;
      const px = cx + Math.cos(ang) * (rx + ring * 2) * wob;
      const py = cy + Math.sin(ang) * (ry + ring * 2) * wob;
      put(p, px, py + Math.sign(py - cy || 1), pal.aura, a);
    }
  }
  // восходящие искры (крупнее и ярче)
  for (let i = 0; i < 6; i++) {
    const ph = (t * 0.5 + i * 0.19) % 1;
    const sy = topY + H - ph * (H + 20);
    const sx = cx + Math.sin(i * 2.3 + t) * (W2 - 1);
    const a = (1 - ph) * 0.95;
    if (a <= 0.1) continue;
    p.dot(sx, sy, pal.aura, a);
    if (st.tier >= 5 && a > 0.5) p.dot(sx, sy, 0xffffff, a * 0.8);
  }
}

// смешать два ABGR-цвета (внутренний помощник)
function mixHex(c1, c2, k) {
  const r1 = c1 & 255, g1 = (c1 >> 8) & 255, b1 = (c1 >> 16) & 255;
  const r2 = c2 & 255, g2 = (c2 >> 8) & 255, b2 = (c2 >> 16) & 255;
  return (0xff000000
    | ((Math.round(b1 + (b2 - b1) * k)) << 16)
    | ((Math.round(g1 + (g2 - g1) * k)) << 8)
    | (Math.round(r1 + (r2 - r1) * k))) >>> 0;
}

// ---------- гаргулья / страж наверху (тир 4+)
export function drawGargoyle(p, x, y, st, t, pal) {
  const flap = Math.sin(t * 3.2) > 0.4;
  // тело
  rct(p, x - 3, y, 7, 6, hex('#4a4438'));
  rct(p, x - 2, y + 1, 5, 4, hex('#6b6153'));
  // голова с рожками
  rct(p, x - 2, y - 3, 5, 4, hex('#6b6153'));
  put(p, x - 2, y - 4, hex('#3a3428'));
  put(p, x + 2, y - 4, hex('#3a3428'));
  // глаза
  const eye = 0.5 + 0.5 * Math.sin(t * 4);
  put(p, x - 1, y - 2, pal.gem, eye);
  put(p, x + 1, y - 2, pal.gem, eye);
  // крылья
  const wy = flap ? -3 : 0;
  for (let i = 0; i < 4; i++) {
    put(p, x - 4 - i, y + 1 + wy + i / 2, hex('#4a4438'));
    put(p, x + 4 + i, y + 1 + wy + i / 2, hex('#4a4438'));
  }
  // лапы на парапете
  rct(p, x - 3, y + 6, 2, 2, hex('#3a3428'));
  rct(p, x + 2, y + 6, 2, 2, hex('#3a3428'));
}

// ---------- золотая корона (тир 5)
export function drawCrown(p, x, y, t, pal) {
  const h = 7;
  for (let i = -5; i <= 5; i++) {
    const peak = (Math.abs(i) === 5 || i === 0) ? h : (Math.abs(i) === 3 ? h - 2 : h - 4);
    for (let j = 0; j < peak; j++) {
      const shade = j > peak - 2 ? hex('#fff0a8') : hex('#e8c050');
      put(p, x + i, y - j, shade);
    }
  }
  // основание
  rct(p, x - 5, y + 1, 11, 2, hex('#b08a30'));
  // самоцветы в короне
  put(p, x, y - 2, hex('#ff5a7a'), 0.9 + 0.1 * Math.sin(t * 3));
  put(p, x - 5, y - 3, hex('#6ad8ff'), 0.85);
  put(p, x + 5, y - 3, hex('#6ad8ff'), 0.85);
  // блик
  put(p, x - 4, y - h + 1, hex('#ffffff'), 0.7);
}

// ---------- парящие камни (тир 5)
export function drawLevitating(p, x, topY, W2, st, t, pal) {
  const n = 3;
  for (let i = 0; i < n; i++) {
    const ph = (t * 0.6 + i * 0.33) % 1;
    const ox = (i - 1) * (W2 + 6);
    const oy = -12 - Math.sin(t * 1.6 + i * 1.9) * 4;
    const cx = Math.round(x + ox), cy = Math.round(topY + oy);
    // камень 7x5 с яркой подсветкой снизу (магия держит его)
    rct(p, cx - 3, cy - 2, 7, 5, hex('#6b6153'));
    rct(p, cx - 2, cy - 2, 5, 3, hex('#8a8578'));
    put(p, cx - 3, cy - 3, hex('#a8a294'));      // светлая верхняя грань
    put(p, cx + 3, cy + 2, hex('#3a3428'));      // тёмный низ-справа
    const gl = 0.75 + 0.25 * Math.sin(t * 3 + i);
    rct(p, cx - 3, cy + 3, 7, 2, pal.aura);      // светящееся «пламя» под камнем
    put(p, cx - 1, cy + 4, 0xffffff, gl);
    put(p, cx + 1, cy + 4, 0xffffff, gl * 0.8);
    // луч света вниз, к постройке
    for (let k = 0; k < 10; k++) {
      put(p, cx - (k % 3 - 1), cy + 5 + k, pal.aura, 0.30 * (1 - k / 10));
    }
    // призрачная тень на земле
    put(p, cx, G2 - 1, hex('#000000'), 0.14);
  }
}

// ---------- свет фонарей на стене (тир 3+)
export function drawLanterns(p, x, topY, W2, st, t, pal) {
  if (st.tier < 3) return;
  const n = st.tier >= 4 ? 2 : 1;
  for (let i = 0; i < n; i++) {
    const lx = x + (n === 1 ? W2 - 2 : (i === 0 ? -W2 + 2 : W2 - 3));
    const ly = topY + 18;
    // кронштейн
    put(p, lx, ly - 3, hex('#3a3428'));
    put(p, lx, ly - 2, hex('#3a3428'));
    // корпус фонаря
    rct(p, lx - 2, ly - 2, 5, 7, hex('#2a2620'));
    rct(p, lx - 1, ly - 1, 3, 5, hex('#4a3d28'));
    // огонь внутри + мерцание
    const fl = 0.6 + 0.4 * Math.sin(t * 7 + i * 2);
    p.dot(lx, ly + 1, 2, pal.aura, fl);
    put(p, lx, ly, hex('#fff0a8'), fl);
    put(p, lx, ly + 2, hex('#ffc23d'), fl * 0.85);
    // ореол света на камне
    for (let r = 1; r <= 5; r++) {
      const a = (1 - r / 6) * 0.20 * fl;
      for (let k = 0; k < 10; k++) {
        const ang = (k / 10) * Math.PI * 2;
        put(p, lx + Math.cos(ang) * r, ly + 1 + Math.sin(ang) * r, pal.aura, a);
      }
    }
  }
}

// ---------- заголовок: собрать все слои для постройки
export function drawHighTierDeco(p, st, x, topY, W2, H, t) {
  const pal = TIER_PAL[Math.min(5, st.tier)];
  // аура ПОД постройкой
  drawStructureAura(p, x, topY, W2, H, st, t, pal);
  drawWallGems(p, x, topY, W2, H, st, t, pal);
  drawLanterns(p, x, topY, W2, st, t, pal);
  if (st.runes) drawRunes(p, x, topY, H, st, t, pal);
  return pal;
}

export { G2 };
