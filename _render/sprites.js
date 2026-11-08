// Средневековые пиксельные спрайты — рисуются кодом в pixelfx-кадр
// (Painter: p.put(x, y, color), p.line(...)), поэтому спрайты и эффекты
// живут в одном пиксельном слое. Мир 640×360: пиксель мелкий, детали тонкие.

import { hex } from "./vendor/pixelfx/core/color.js";

export const COL = {
  stone: hex('#8a8578'), stoneD: hex('#615b4e'), stoneDD: hex('#3d392f'),
  stoneL: hex('#a8a294'), stoneLL: hex('#c2bcae'),
  wood: hex('#7a5a32'), woodD: hex('#57401f'), woodDD: hex('#3a2a14'),
  skin: hex('#d8a077'), skinD: hex('#a87250'),
  armor: hex('#9aa2ad'), armorD: hex('#6a727c'),
  leather: hex('#8a6a3d'), leatherD: hex('#5f4726'),
  orc: hex('#6a8a3d'), orcD: hex('#485e28'),
  gold: hex('#f4c542'),
  red: hex('#c94f3d'), redD: hex('#8a2f26'),
  dark: hex('#201510'), visor: hex('#14181d'), steel: hex('#e8e8f0'),
  grass: hex('#5a6b34'), grassD: hex('#43502a'),
  dirt: hex('#4a3d28'), dirtD: hex('#372d1e'), dirtL: hex('#5b4c33'),
  rock: hex('#6b6153'),
  mount: hex('#241d18'), mountL: hex('#332a22'),
  sun: hex('#e8a34d'), sunGlow: hex('#c2793a'),
  skyA: hex('#3a3147'), skyB: hex('#5c4152'), skyC: hex('#8f5a44'),
  hpBarBg: hex('#2a1408'), hpGreen: hex('#7fc97f'), hpYellow: hex('#f4c542'),
};

function rect(p, x, y, w, h, col) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) p.put(x + i, y + j, col);
}

// ---------- Небо ----------
export function drawSky(p, w, h) {
  // Многоступенчатый градиент: тёмно-фиолетовый верх → багровый → золотой горизонт
  const stops = [
    [0.00, hex('#1a1428')],
    [0.18, hex('#2a1c38')],
    [0.36, hex('#3d2340')],
    [0.52, hex('#5a2f42')],
    [0.66, hex('#7a3f42')],
    [0.78, hex('#9c5440')],
    [0.88, hex('#c0703c')],
    [1.00, hex('#e0954a')],
  ];
  for (let y = 0; y < h; y++) {
    const f = y / h;
    let a = stops[0], b = stops[stops.length - 1];
    for (let i = 0; i < stops.length - 1; i++) {
      if (f >= stops[i][0] && f <= stops[i + 1][0]) { a = stops[i]; b = stops[i + 1]; break; }
    }
    const span = (b[0] - a[0]) || 1;
    const k = (f - a[0]) / span;
    // ручная интерполяция ABGR по каналам
    const ar = a[1] & 255, ag = (a[1] >> 8) & 255, ab = (a[1] >> 16) & 255;
    const br = b[1] & 255, bg = (b[1] >> 8) & 255, bb = (b[1] >> 16) & 255;
    const rr = Math.round(ar + (br - ar) * k);
    const gg = Math.round(ag + (bg - ag) * k);
    const bl = Math.round(ab + (bb - ab) * k);
    const col = (255 << 24) | (bl << 16) | (gg << 8) | rr;
    for (let x = 0; x < w; x++) p.put(x, y, col);
  }
  // редкие звёзды в верхней трети (детерминированные)
  for (let i = 0; i < 60; i++) {
    const sx = (i * 137 + 41) % w;
    const sy = (i * 53 + 17) % Math.round(h * 0.34);
    const tw = ((i * 7) % 10) / 10;
    p.put(sx, sy, hex('#cfc8e8'), 0.25 + tw * 0.5);
  }
  // блик у горизонта — тёплое свечение
  for (let y = Math.round(h * 0.72); y < Math.round(h * 0.9); y++) {
    const k = 1 - (y - h * 0.72) / (h * 0.18);
    for (let x = 0; x < w; x += 3) p.put(x, y, hex('#ffcf8a'), 0.05 + k * 0.06);
  }
}

export function drawSun(p, x, y, time = 0) {
  const pulse = Math.sin(time * 2) * 0.5 + 0.5;
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6 + Math.sin(time * 0.7) * 0.1;
    const r1 = 24 + pulse * 4, r2 = 33 + pulse * 6;
    p.line(x + Math.round(Math.cos(a) * r1), y + Math.round(Math.sin(a) * r1),
           x + Math.round(Math.cos(a) * r2), y + Math.round(Math.sin(a) * r2),
           COL.sunGlow, 0.7 + pulse * 0.3);
  }
  // гало: 3 чётких кольца с плавным затуханием (без шахматки)
  const RINGS = [[196, 324, 0.55], [324, 576, 0.34], [576, 900, 0.18], [900, 1296, 0.09]];
  for (const [r0, r1, a] of RINGS) {
    const rr1 = Math.sqrt(r1);
    for (let dy = -rr1; dy <= rr1; dy++) {
      for (let dx = -rr1; dx <= rr1; dx++) {
        const d2 = dx * dx + dy * dy;
        if (d2 > r0 && d2 <= r1) p.put(x + dx, y + dy, COL.sunGlow, a);
      }
    }
  }
  for (let dy = -18; dy <= 18; dy++) for (let dx = -18; dx <= 18; dx++) {
    const d2 = dx * dx + dy * dy;
    if (d2 <= 324) p.put(x + dx, y + dy, d2 > 196 ? hex('#ffe08a') : d2 > 100 ? hex('#f8d060') : hex('#fff2b0'));
  }
  p.put(x - 6, y - 8, hex('#fffbe0')); p.put(x - 7, y - 7, hex('#fffbe0'));
  p.put(x - 7, y - 8, hex('#fff0c8'));
}

export function drawClouds(p, w, t) {
  const clouds = [[80, 44, 1.0], [336, 72, 0.8], [496, 32, 0.6], [560, 90, 0.9]];
  for (const [bx, by, s] of clouds) {
    const cx = Math.round(((bx + t * 5) % (w + 160)) - 80);
    // три «пузыря» разного размера — мягкий силуэт
    const puffs = [[-18, 0, 20, 6], [4, -3, 26, 9], [26, 0, 18, 6], [-34, 2, 12, 4]];
    for (const [ox, oy, pw, ph] of puffs) {
      const ww = Math.round(pw * s), hh = Math.round(ph * s);
      const x0 = cx + Math.round(ox * s), y0 = by + Math.round(oy * s);
      for (let yy = 0; yy < hh; yy++) {
        // скругление краёв: сужаем строки к верху и низу
        const shrink = Math.round((1 - Math.sin(((yy + 1) / (hh + 1)) * Math.PI)) * ww * 0.35);
        for (let xx = shrink; xx < ww - shrink; xx++) {
          p.put(x0 + xx, y0 + yy, yy === 0 ? hex('#8a6480') : COL.skyB);
        }
      }
    }
    // тёплый подсвет снизу от заката
    for (let i = 0; i < 3; i++) {
      const ox = [-14, 6, 24][i];
      for (let d = 0; d < 8; d++) p.put(cx + Math.round(ox * s) + d, by + Math.round(6 * s), hex('#c07080'), 0.35);
    }
  }
}

// ---------- Горы и земля ----------
export function drawGround(p, w, groundY) {
  // ---- ДАЛЬНИЙ ХРЕБЕТ: острые пики с освещённой гранью ----
  for (let x = 0; x < w; x += 2) {
    const h1 = 48 + Math.round(34 * Math.sin(x * 0.019) + 20 * Math.sin(x * 0.051 + 2));
    // левая (тёмная) грань
    rect(p, x, groundY - h1 - 66, 2, h1, hex('#2a2438'));
    // солнечная подсветка правого склона (только у вершин, нерегулярно)
    if (h1 > 82 && Math.sin(x * 0.019) > 0.55) {
      const lh = Math.round(h1 * 0.5);
      rect(p, x, groundY - h1 - 66, 2, lh, hex('#4a4260'), 0.5);
    }
    // снежная шапка на высоких пиках
    if (h1 > 78) {
      const capH = Math.min(9, h1 - 78);
      rect(p, x, groundY - h1 - 66, 2, capH, hex('#5a5470'));
      if (h1 > 88) p.put(x, groundY - h1 - 66, hex('#8a84a0'));
    }
  }
  // ---- СРЕДНИЙ ХРЕБЕТ: светлее, со скальной текстурой ----
  for (let x = 0; x < w; x += 2) {
    const h2 = 30 + Math.round(24 * Math.sin(x * 0.031 + 1.4) + 14 * Math.sin(x * 0.077 + 0.6));
    rect(p, x, groundY - h2 - 48, 2, h2, hex('#3a3450'));
    // освещённый правый склон — только у «рёбер» пиков (нерегулярно)
    const edge = (Math.sin(x * 0.031 + 1.4) > 0.62);
    if (edge) {
      const eh = Math.round(h2 * 0.7);
      rect(p, x, groundY - h2 - 48, 2, eh, hex('#5a5280'), 0.5);
    }
    // редкие трещины — псевдослучайно, без регулярного шага
    const hash = (x * 2654435761) % 1000;
    if (hash < 26) {
      const th = 2 + (hash % 5);
      const ty = groundY - 48 - Math.round(h2 * (0.25 + (hash % 40) / 100));
      for (let d = 0; d < th; d++) p.put(x, ty + d, hex('#262038'), 0.45);
    }
  }
  // ---- МЯГКАЯ ДЫМКА у подножия (без регулярной сетки) ----
  for (let i = 0; i < 260; i++) {
    // псевдослучайные точки, сгруппированные у стыка гор и леса
    const rx = (i * 97 + 13) % w;
    const ry = groundY - 58 + ((i * 37) % 12);
    const k = 1 - Math.abs(ry - (groundY - 52)) / 7;
    p.put(rx, ry, hex('#8a7a98'), Math.max(0, k) * 0.10);
  }
  // ---- ПОЛОСА ТУМАНА У ПОДНОЖИЯ ----
  for (let y = groundY - 44; y < groundY - 30; y++) {
    const k = 1 - Math.abs(y - (groundY - 37)) / 7;
    for (let x = 0; x < w; x += 2) {
      if (((x * 3 + y) % 7) < 3) p.put(x, y, hex('#9c8fa8'), k * 0.18);
    }
  }
  // ---- ЗЕМЛЯ: слоями, с травой и камнями ----
  rect(p, 0, groundY, w, 360 - groundY, COL.dirt);
  // верхний слой — темнее (утрамбованный)
  rect(p, 0, groundY, w, 3, COL.dirtD);
  // текстура земли: несколько слоёв оттенков + галька + корни
  for (let y = groundY + 4; y < 360; y += 5) {
    for (let x = ((y * 7) % 22); x < w; x += 22) {
      p.put(x, y, COL.dirtD);
      p.put(x + 5, y + 2, COL.dirtL);
      p.put(x + 11, y + 1, COL.dirtD);
      if ((x + y) % 3 === 0) p.put(x + 3, y + 3, hex('#4a3826'));
    }
  }
  // темнее к низу — глубина почвы
  const gH = 360 - groundY;
  for (let y = groundY; y < 360; y++) {
    const k = (y - groundY) / gH;
    if (k > 0.35) {
      for (let x = ((y * 3) % 5); x < w; x += 5) p.put(x, y, hex('#31251a'), Math.min(0.35, k * 0.35));
    }
  }
  // галька и мелкие камешки
  for (let i = 0; i < 46; i++) {
    const gx = (i * 97 + 31) % w;
    const gy = groundY + 6 + ((i * 53) % Math.max(4, gH - 8));
    const c = i % 3 === 0 ? hex('#6a6152') : i % 3 === 1 ? hex('#57503f') : hex('#7d7460');
    p.put(gx, gy, c);
    p.put(gx + 1, gy, c);
    if (i % 4 === 0) p.put(gx, gy + 1, hex('#463d2c'));
  }
  // корни и трещины у поверхности
  for (let i = 0; i < 18; i++) {
    const rx = (i * 71 + 13) % w;
    const ry = groundY + 3;
    p.put(rx, ry, hex('#3d2e1e'));
    p.put(rx + 1, ry + 1, hex('#3d2e1e'));
    p.put(rx + 2, ry + 1, hex('#4a3826'));
    if (i % 3 === 0) p.put(rx - 1, ry + 2, hex('#3d2e1e'));
  }
  // тёмные лужи/тени между комьями
  for (let i = 0; i < 12; i++) {
    const sx = (i * 113 + 47) % w;
    const sy = groundY + 10 + ((i * 37) % Math.max(3, gH - 14));
    for (let d = 0; d < 6; d++) p.put(sx + d, sy, hex('#2a1f16'), 0.5);
  }
  // ---- ТРАВА: густая, с травинками разной высоты ----
  for (let x = 0; x < w; x++) {
    p.put(x, groundY - 1, COL.grass);
    p.put(x, groundY - 2, (x & 1) ? COL.grass : COL.grassD);
    const blade = (x * 7 + 3) % 5;
    if (blade < 2) p.put(x, groundY - 3, COL.grass);
    if (blade === 0) p.put(x, groundY - 4, COL.grassD);
    if ((x * 11 + 5) % 13 === 0) p.put(x, groundY - 5, hex('#5a8a3a'));
  }
  // ---- КАМНИ И КОЧКИ ----
  for (let x = 28; x < w; x += 94) {
    const gy = groundY + 8 + (x % 10);
    rect(p, x, gy, 7, 5, COL.rock);
    p.put(x + 2, gy - 1, COL.stoneL);   // блик
    p.put(x + 5, gy - 1, COL.stoneL);
    p.put(x + 4, gy + 5, COL.dirtD);    // тень
    p.put(x - 1, gy + 4, COL.dirtD);
  }
  // мелкие цветы/травинки у стены
  for (let x = 8; x < 90; x += 11) {
    if ((x * 3) % 4 === 0) {
      p.put(x, groundY - 4, hex('#d86a8a'));
      p.put(x, groundY - 5, hex('#f0a0b8'));
    }
  }
}

// ---------- Замок (640×360: стена 92 wide, детали мельче) ----------
export function drawCastle(p, groundY, hpFrac, t) {
  const wallTop = groundY - 128, wallW = 92;
  const flick = Math.sin(t * 7) > 0 ? 1 : 0;

  // ---- ОСНОВАНИЕ: цоколь с валунами ----
  rect(p, 0, groundY - 7, wallW + 6, 7, hex('#4a4238'));
  for (let x = 0; x < wallW + 6; x += 11) {
    rect(p, x, groundY - 7, 9, 5, hex('#5c5346'));
    p.put(x + 1, groundY - 7, hex('#6e6454'));
    p.put(x + 7, groundY - 3, hex('#3a332a'));
  }

  // ---- СТЕНА: кладка с объёмом (свет слева сверху) ----
  rect(p, 0, wallTop, wallW, groundY - 7 - wallTop, COL.stone);
  for (let row = 0; row * 8 < groundY - wallTop; row++) {
    const yy = wallTop + 5 + row * 8;
    for (let x = 0; x < wallW; x++) p.put(x, yy, COL.stoneD);
    for (let x = ((row % 2) ? 0 : 7); x < wallW; x += 15) {
      for (let y = yy + 1; y < yy + 8 && y < groundY; y++) p.put(x, y, COL.stoneD);
    }
    // блик сверху каждого ряда — создаёт объём
    for (let x = 0; x < wallW; x += 2) p.put(x, yy + 1, COL.stoneL, 0.3);
    // случайные тёмные камни для разнообразия
    for (let x = ((row * 5) % 13); x < wallW; x += 19) {
      p.put(x, yy + 3, hex('#8a8478'));
      p.put(x + 1, yy + 4, hex('#8a8478'));
    }
  }
  // правая грань стены — в тени
  for (let y = wallTop; y < groundY - 7; y++) {
    p.put(wallW - 1, y, hex('#6b6558'));
    p.put(wallW - 2, y, hex('#7d776a'), 0.5);
  }
  // мох у основания
  for (let x = 0; x < wallW; x += 3) {
    if ((x * 7) % 5 < 2) {
      p.put(x, groundY - 8, hex('#3f5a2a'));
      p.put(x + 1, groundY - 9, hex('#4f6a30'));
    }
  }

  // ---- ЗУБЦЫ стены с глубиной (фронт + верхняя грань светлее) ----
  for (let x = 0; x < wallW; x += 16) {
    rect(p, x, wallTop - 10, 9, 11, COL.stone);
    for (let i = 0; i < 9; i++) p.put(x + i, wallTop - 10, COL.stoneLL);
    // тёмная правая грань зубца
    for (let y = wallTop - 10; y < wallTop + 1; y++) p.put(x + 8, y, hex('#7d776a'));
    for (let i = 0; i < 9; i += 4) p.put(x + i, wallTop - 6, COL.stoneD);
  }

  // ---- ЛЕВАЯ БАШНЯ (главная, с черепичной крышей) ----
  const tw = 32, tTop = wallTop - 46;
  rect(p, 0, tTop, tw, groundY - tTop, COL.stone);
  for (let row = 0; row * 8 < groundY - tTop; row++) {
    const yy = tTop + 5 + row * 8;
    for (let x = 0; x < tw; x++) p.put(x, yy, COL.stoneD);
    for (let x = ((row % 2) ? 0 : 6); x < tw; x += 12) {
      for (let y = yy + 1; y < yy + 8 && y < groundY; y++) p.put(x, y, COL.stoneD);
    }
  }
  // светлая грань башни
  for (let y = tTop; y < groundY - 7; y++) {
    p.put(tw - 3, y, COL.stoneL);
    p.put(tw - 2, y, hex('#8a8478'));
  }
  // черепичная крыша-конус с цветными рядами
  const roofH = 20;
  for (let i = 0; i < roofH; i++) {
    const hw = Math.max(0, Math.round((tw * 0.62) * (i / roofH)) - 1);
    const yy = tTop - roofH + i;
    for (let dx = -hw; dx <= hw; dx++) {
      const isDark = (i + Math.abs(dx)) % 4 < 2;
      p.put(16 + dx, yy, isDark ? hex('#7a2f26') : hex('#9c3f30'));
    }
    // блик на левом скате
    for (let dx = -hw; dx < -hw / 2; dx++) p.put(16 + dx, yy, hex('#c25a44'), 0.45);
  }
  // флюгер
  rect(p, 16, tTop - roofH - 8, 1, 8, hex('#5c5346'));
  const fdir = Math.sin(t * 1.6) > 0 ? 1 : -1;
  p.put(16 + fdir, tTop - roofH - 8, COL.gold);
  p.put(16 + fdir * 2, tTop - roofH - 7, COL.gold);
  p.put(16 - fdir, tTop - roofH - 9, hex('#b8b0a0'));

  // окно-бойница с тёплым светом изнутри (мерцает)
  rect(p, 11, tTop + 24, 9, 15, hex('#2a2620'));
  rect(p, 12, tTop + 25, 7, 13, flick ? hex('#f0a83c') : hex('#d88c28'));
  rect(p, 13, tTop + 26, 5, 11, hex('#ffc85a'), 0.6);
  p.put(14, tTop + 28, hex('#fff0b0'));
  p.line(12, tTop + 31, 18, tTop + 31, hex("#3a3228"));
  // факел у окна — живое пламя
  rect(p, 24, tTop + 30, 1, 7, hex('#4a3a28'));
  for (let i = 0; i < 3; i++) {
    const fy = tTop + 30 - i - (flick ? 1 : 0);
    p.put(24, fy, i === 2 ? hex('#fff2b0') : i === 1 ? hex('#ffb03c') : hex('#e0641c'));
    if (i < 2) p.put(24 + ((i % 2) ? 1 : -1), fy, hex('#f08030'), 0.6);
  }
  p.put(24, tTop + 26, hex('#ffd080'), 0.15 + 0.1 * flick);

  // ---- ВОРОТА: арка, доски, кольцо, факелы по бокам ----
  const gw = 34, gh = 42, gx = 30;
  rect(p, gx, groundY - gh, gw, gh, COL.woodD);
  for (let i = 3; i < gw; i += 5) rect(p, gx + i, groundY - gh, 1, gh, COL.wood);
  // арка сверху
  for (let i = 0; i < gw; i++) {
    const dy = Math.round(Math.abs(i - gw / 2) * 0.95);
    for (let y = groundY - gh; y < groundY - gh + dy; y++) p.put(gx + i, y, COL.stoneDD);
  }
  // железные полосы
  for (let x = gx + 5; x < gx + gw; x += 9) rect(p, x, groundY - gh + 14, 1, gh - 14, hex('#4a4440'));
  // кольцо
  p.put(gx + 17, groundY - 19, COL.gold);
  p.put(gx + 18, groundY - 19, COL.gold);
  p.put(gx + 17, groundY - 18, hex('#b8901e'));
  // факелы по бокам ворот
  for (const fx of [gx - 4, gx + gw + 2]) {
    rect(p, fx, groundY - 32, 1, 8, hex('#4a3a28'));
    const h = flick ? 3 : 2;
    for (let i = 0; i < h; i++) p.put(fx, groundY - 32 - i, i === h - 1 ? hex('#ffe08a') : hex('#f08030'));
    p.put(fx, groundY - 36, hex('#ffb03c'), 0.2);
    // отсвет на стене
    p.put(fx + (fx < gx ? 1 : -1), groundY - 30, hex('#c98a3a'), 0.25);
  }

  // ---- ПРАВАЯ МАЛАЯ БАШНЯ (у края стены) ----
  const rw = 20, rTop = wallTop - 30, rx = wallW - rw;
  rect(p, rx, rTop, rw, groundY - 7 - rTop, COL.stone);
  for (let row = 0; row * 8 < groundY - rTop; row++) {
    const yy = rTop + 5 + row * 8;
    for (let x = rx; x < wallW; x++) p.put(x, yy, COL.stoneD);
  }
  for (let y = rTop; y < groundY - 7; y++) p.put(wallW - 1, y, hex('#6b6558'));
  // зубцы малой башни
  for (let x = rx; x < wallW; x += 9) {
    rect(p, x, rTop - 7, 6, 8, COL.stone);
    for (let i = 0; i < 6; i++) p.put(x + i, rTop - 7, COL.stoneLL);
  }
  // синий флаг на малой башне (развевается)
  const fw = Math.round(Math.sin(t * 3.2) * 2);
  rect(p, rx + 9, rTop - 26, 1, 20, hex('#5c5346'));
  for (let i = 0; i < 14; i++) {
    const wob = Math.round(Math.sin(t * 3.2 + i * 0.25) * (i / 8));
    for (let h = 0; h < 8 - Math.abs(i - 7) / 3; h++) {
      p.put(rx + 10 + i, rTop - 26 + h + wob, h === 0 ? hex('#4a6fa8') : hex('#3a5f98'));
    }
  }
  p.put(rx + 10, rTop - 27, COL.gold);

  // ---- КРАСНЫЙ ФЛАГ на стене между башнями (древко стоит на зубцах) ----
  const flagX = 50;
  const poleTop = wallTop - 20;
  rect(p, flagX, poleTop, 1, 20, COL.woodD);        // древко от зубцов вверх
  p.put(flagX, poleTop - 1, COL.gold);              // навершие
  for (let i = 0; i < 14; i++) {                    // полотнище вправо, развевается
    const wob = Math.round(Math.sin(t * 3 + i * 0.35) * (i / 8));
    const hh = 8 - Math.round(Math.abs(i - 6) / 2.4);
    for (let h = 0; h < hh; h++) {
      p.put(flagX + 1 + i, poleTop + 2 + h + wob, h === 0 ? hex('#e05a44') : COL.red);
    }
  }
  p.put(flagX + 4, poleTop + 5, COL.gold);
  p.put(flagX + 6, poleTop + 5, COL.gold);
  p.put(flagX + 5, poleTop + 4, COL.gold);

  // ---- ТРЕЩИНЫ ОТ УРОНА ----
  const dmgLvl = Math.floor((1 - hpFrac) * 8);
  for (let d = 0; d < dmgLvl; d++) {
    const cx = 6 + d * 11, cy = wallTop + 26 + (d % 4) * 20;
    p.line(cx, cy, cx + 6, cy + 4, COL.stoneDD);
    p.line(cx + 6, cy + 4, cx + 4, cy + 10, COL.stoneDD);
    p.put(cx + 6, cy + 4, COL.stoneDD);
    p.line(cx + 4, cy + 10, cx + 9, cy + 14, COL.stoneDD);
    p.put(cx + 2, cy + 2, hex('#6b6558'));
    // пыль из трещины
    if (flick) p.put(cx + 5, cy + 12, hex('#b8b0a0'), 0.5);
  }
}

// ---------- Лучник (2× детализация, тонкие линии) ----------
// gear: { helm: [col,colDark]|null, body: [...], boot, glove, bow, cape, aura: {col, k} }
export function drawArcher(p, x, y, aimAngle, firing, time = 0, bowPull = 0, recoil = false, gear = null) {
  const breathe = Math.round(Math.sin(time * 2.2));
  const breathe2 = Math.sin(time * 2.2) > 0.6 ? 1 : 0;
  const lean = Math.round(bowPull * 3);
  const bx0 = x - lean;

  // мягкая тень на земле под героем
  for (let dx = -12; dx <= 14; dx++) {
    const k = 1 - Math.abs(dx - 1) / 14;
    if (k > 0) p.put(x + dx, y, 0x40281a10, 0.42 * k);
  }
  for (let dx = -8; dx <= 11; dx++) {
    const k = 1 - Math.abs(dx - 1.5) / 10;
    if (k > 0) p.put(x + dx, y + 1, 0x40281a10, 0.3 * k);
  }
  // сапоги (цвет зависит от надетых сапог)
  const bootC = gear && gear.boot ? gear.boot[0] : COL.leatherD;
  const bootL = gear && gear.boot ? gear.boot[1] : COL.leather;
  rect(p, x + 2, y - 8, 4, 8, bootC);
  rect(p, x + 8, y - 8, 4, 8, bootC);
  p.put(x + 2, y - 2, COL.dark); p.put(x + 8, y - 2, COL.dark);
  p.line(x + 2, y - 4, x + 5, y - 4, bootL);
  p.line(x + 8, y - 4, x + 11, y - 4, bootL);
  // туника + пояс с пряжкой (цвет = надетый доспех)
  const bodyC = gear && gear.body ? gear.body[0] : COL.leather;
  const bodyD = gear && gear.body ? gear.body[1] : COL.leatherD;
  rect(p, x, y - 22 + breathe, 14, 16, bodyC);
  rect(p, x + 1, y - 22 + breathe, 12, 2, bodyD);
  rect(p, x, y - 10, 14, 2, COL.woodD);
  rect(p, x + 6, y - 10, 3, 2, COL.gold);
  p.put(x + 7, y - 9, COL.woodDD);
  // складки + нагрудная пластина
  p.line(x + 2, y - 18 + breathe, x + 2, y - 12, bodyD);
  p.line(x + 11, y - 18 + breathe, x + 11, y - 12, bodyD);
  if (gear && gear.body && gear.body[2]) {           // металлическая пластина у редких доспехов
    rect(p, x + 4, y - 19 + breathe, 6, 7, gear.body[2]);
    p.put(x + 4, y - 19 + breathe, 0xffffffff);
  }
  if (gear && gear.helm) {                            // наплечники того же металла
    p.put(x - 1, y - 21 + breathe, gear.helm[0]);
    p.put(x + 14, y - 21 + breathe, gear.helm[0]);
  }
  // плащ с волной (цвет от редкости брони)
  const capeC = gear && gear.cape ? gear.cape[0] : COL.redD;
  const capeL = gear && gear.cape ? gear.cape[1] : COL.red;
  const flapPh = Math.sin(time * 3.4);
  const flap = Math.round(flapPh);
  rect(p, x - 4, y - 20 + breathe, 4, 18, capeC);
  p.put(x - 5, y - 10 + flap, capeC);
  p.put(x - 6, y - 12 + flap, capeC);
  p.put(x - 5, y - 6 + breathe2, capeL);
  p.put(x - 7, y - 8 + Math.round(Math.sin(time * 3.4 - 0.7)), capeC);
  p.put(x - 4, y - 19 + breathe, capeL);
  // колчан за спиной
  rect(p, x - 4, y - 32, 6, 12, COL.woodDD);
  rect(p, x - 3, y - 32, 1, 12, COL.woodD);
  // ободок колчана
  for (let dx = -4; dx <= 1; dx++) p.put(x + dx, y - 32, COL.leatherD);
  // три стрелы с цветным оперением
  const arrowFeathers = [COL.red, 0xffd8e0ff, COL.gold];
  for (let i = 0; i < 3; i++) {
    const ax = x - 4 + i * 2;
    rect(p, ax, y - 38, 1, 7, COL.woodD);          // древко
    p.put(ax, y - 39, COL.steel);                   // наконечник
    p.put(ax - 1, y - 37, arrowFeathers[i]);        // оперение
    p.put(ax + 1, y - 36, arrowFeathers[i]);
  }
  // ремень колчана через плечо
  p.line(x - 3, y - 30, x + 4, y - 20, COL.leatherD);
  // голова
  rect(p, x + 4, y - 32 + breathe, 8, 10, COL.skin);
  p.put(x + 10, y - 28 + breathe, COL.dark);
  p.put(x + 10, y - 27 + breathe, COL.skinD);
  if (gear && gear.helm) {
    // металлический шлем с забралом и гребнем
    const hC = gear.helm[0], hD = gear.helm[1];
    rect(p, x + 2, y - 37 + breathe, 12, 8, hC);
    rect(p, x + 2, y - 37 + breathe, 12, 2, 0xffffffff);
    rect(p, x + 3, y - 31 + breathe, 10, 2, hD);       // козырёк
    p.put(x + 6, y - 39 + breathe, hD); p.put(x + 7, y - 40 + breathe, hD);
    if (gear.helm[2]) {                                  // плюмаж у редких
      p.put(x + 5, y - 41 + breathe, gear.helm[2]);
      p.put(x + 6, y - 42 + breathe, gear.helm[2]);
      p.put(x + 8, y - 41 + breathe, gear.helm[2]);
    }
  } else {
    // капюшон
    rect(p, x + 2, y - 36 + breathe, 12, 8, COL.woodDD);
    rect(p, x + 2, y - 30 + breathe, 2, 4, COL.woodDD);
    rect(p, x + 12, y - 30 + breathe, 2, 4, COL.woodDD);
    p.put(x + 6, y - 38 + breathe, COL.dark);
    p.put(x + 7, y - 39 + breathe, COL.dark);
  }
  // передняя рука к луку (перчатка по редкости)
  const gloveC = gear && gear.glove ? gear.glove[0] : COL.skinD;
  rect(p, x + 12, y - 24 + breathe, 3, 10, gloveC);
  p.put(x + 12, y - 22 + breathe, gear && gear.glove ? gear.glove[1] : COL.skin);
  // лук: тонкая дуга из точек
  const kick = recoil ? 2 : 0;
  const pull = recoil ? 0 : Math.round(bowPull * 8);
  const bx = bx0 + 19 - kick, by = y - 24 + breathe;
  const tilt = Math.round(aimAngle * 12);
  const bowC = gear && gear.bow ? gear.bow[0] : COL.wood;
  const bowT = gear && gear.bow ? gear.bow[1] : COL.woodD;
  for (let i = -14; i <= 14; i++) {
    const ax = bx + Math.round(2.5 * (1 - (i * i) / 196));
    p.put(ax, by + i + Math.round(tilt * (1 - Math.abs(i) / 16)), bowC);
  }
  p.put(bx + 2, by - 14 + tilt, bowT);
  p.put(bx + 2, by + 14 + tilt, bowT);
  if (gear && gear.bow && gear.bow[2]) {                 // золотые наконечники у легендарного
    p.put(bx + 2, by - 15 + tilt, gear.bow[2]);
    p.put(bx + 2, by + 15 + tilt, gear.bow[2]);
  }
  // аура от редких/легендарных предметов
  if (gear && gear.aura && gear.aura.k > 0) {
    const k = gear.aura.k, ac = gear.aura.col;
    const pulse = 0.5 + 0.5 * Math.sin(time * 3);
    // светящееся кольцо вокруг героя
    for (let i = 0; i < 10; i++) {
      const a = i * Math.PI / 5 + time * 0.8;
      const rx = Math.round(Math.cos(a) * 16), ry = Math.round(Math.sin(a) * 6);
      p.dot(x + 6 + rx, y - 20 + ry, ac, (0.35 + 0.35 * pulse) * k);
    }
    // искры, поднимающиеся вверх
    for (let i = 0; i < 3; i++) {
      const ph = (time * 0.6 + i * 0.33) % 1;
      const sx = x + 6 + Math.round(Math.sin(time * 2 + i * 2) * 10);
      const sy = y - 24 - Math.round(ph * 26);
      p.dot(sx, sy, ac, (1 - ph) * 0.8 * k);
    }
  }
  // контровой свет: контур подсвечивается цветом ауры (у редких/легендарных)
  if (gear && gear.aura && gear.aura.k > 0.3) {
    const ac = gear.aura.col, ak = 0.18 + 0.12 * Math.sin(time * 3);
    // правая кромка тела и головы
    for (let yy = y - 34; yy < y - 4; yy++) p.dot(x + 14, yy + breathe, ac, ak);
    p.dot(x + 12, y - 33 + breathe, ac, ak * 1.4);
    p.dot(x + 9, y - 40 + breathe, ac, ak * 1.2);
    // плечо
    p.dot(x + 15, y - 21 + breathe, ac, ak);
  }
  // тетива
  const vib = recoil ? Math.round(Math.sin(time * 60) * 1.5) : 0;
  const nockX = bx - pull + (recoil ? 4 + vib : 0);
  p.line(bx + 2, by - 14 + tilt, nockX, by + tilt, 0xd8d0c0);
  p.line(nockX, by + tilt, bx + 2, by + 14 + tilt, 0xd8d0c0);
  // задняя рука при натяжении
  if (pull > 0 && !recoil) {
    p.put(nockX - 1, by + tilt, COL.skin);
    p.put(nockX - 2, by - 1 + tilt, COL.skinD);
    p.line(x + 8, y - 20 + breathe, nockX - 2, by + tilt, COL.skinD);
  }
  // стрела на тетиве
  if (!firing && !recoil) {
    const dx = Math.cos(aimAngle), dy = Math.sin(aimAngle);
    p.line(nockX, by + tilt, Math.round(nockX + dx * 16), Math.round(by + tilt + dy * 16), COL.woodD);
    p.put(Math.round(nockX + dx * 17), Math.round(by + tilt + dy * 17), COL.steel);
    p.put(Math.round(nockX + dx * 18), Math.round(by + tilt + dy * 18), COL.steel);
  }
}

// ---------- Враги (2× детализация) ----------
export function drawEnemy(p, e, time = 0) {
  const x = Math.round(e.x), y = Math.round(e.y);
  const walking = e.x > 104;
  // тень под врагом (шире у боссов)
  const shW = e.isBoss ? 20 : e.kind === 'ogre' ? 16 : 10;
  for (let dx = -shW; dx <= shW; dx++) {
    const k = 1 - Math.abs(dx) / (shW + 1);
    if (k > 0) p.put(x + dx, y, 0x48180e08, 0.4 * k);
  }
  const step = walking ? Math.round(Math.sin(e.walkT * 8)) : 0;
  // замах оружием при ударе по стене
  const atkPhase = (!walking && e.atkT > 0) ? (e.atkT > 0.5 ? 1 : 0) : 0;
  if (e.burn) {
    const fl = Math.sin(time * 12) > 0 ? 1 : 0;
    p.put(x - 4, y - 28 - fl, 0xfff26a1d);
    p.put(x + 6, y - 32 + fl, 0xffffc23d);
    p.put(x, y - 24, 0xfff26a1d);
    p.put(x + 2, y - 34 + fl, 0xffffc23d);
  }
  if (e.kind === 'boss') {
    drawBoss(p, e, x, y, time, step);
  } else if (e.kind === 'skeleton') {
    drawSkeleton(p, e, x, y, time, step);
  } else if (e.kind === 'ogre') {
    // ОГР: крупные читаемые формы. тёмный контур всей фигуры, 2 оттенка зелёного
    const OG = hex('#6a9a48');      // светлый зелёный (освещённая сторона)
    const OGD = hex('#3e5f28');     // тёмный зелёный (тень)
    const OUTL = hex('#1e2a14');    // контур
    // ноги-колонны
    rect(p, x - 13, y - 14, 11, 14, OGD);
    rect(p, x + 4, y - 14, 11, 14, OGD);
    rect(p, x - 13, y - 14, 4, 14, OG);         // блик на левой ноге
    rect(p, x + 4, y - 14, 3, 14, OG);
    // ступни
    rect(p, x - 15, y - 4, 15, 4, OUTL);
    rect(p, x + 3, y - 4, 15, 4, OUTL);
    // массивный торс (трапеция)
    for (let i = 0; i < 20; i++) {
      const hw = 12 + Math.round(i * 0.35);
      const yy = y - 34 + i;
      for (let dx = -hw; dx <= hw; dx++) {
        const light = dx < -hw * 0.15;
        p.put(x + dx, yy, light ? OG : OGD);
      }
    }
    // контур торса
    for (let i = 0; i < 20; i++) {
      const hw = 12 + Math.round(i * 0.35);
      p.put(x - hw, y - 34 + i, OUTL);
      p.put(x + hw, y - 34 + i, OUTL);
    }
    // набедренная повязка
    rect(p, x - 12, y - 18, 25, 5, hex('#5a4228'));
    rect(p, x - 12, y - 18, 25, 1, hex('#7a5c38'));
    // голова: крупная, с выраженным подбородком
    rect(p, x - 9, y - 50, 19, 17, OGD);
    rect(p, x - 9, y - 50, 6, 17, OG);              // освещённая половина лица
    for (let i = 0; i < 19; i++) { p.put(x - 9 + i, y - 50, OUTL); p.put(x - 9 + i, y - 34, OUTL); }
    for (let i = 0; i < 17; i++) { p.put(x - 9, y - 50 + i, OUTL); p.put(x + 9, y - 50 + i, OUTL); }
    // надбровные дуги + глубоко посаженные глаза
    rect(p, x - 7, y - 46, 6, 2, OUTL);
    rect(p, x + 2, y - 46, 6, 2, OUTL);
    rect(p, x - 6, y - 44, 4, 3, hex('#f2c23a'));   // жёлтые глаза
    rect(p, x + 3, y - 44, 4, 3, hex('#f2c23a'));
    p.put(x - 5, y - 43, hex('#8a1f17'));           // зрачок
    p.put(x + 4, y - 43, hex('#8a1f17'));
    // нос-кнопка и оскал с клыками
    rect(p, x - 1, y - 41, 3, 3, OUTL);
    rect(p, x - 6, y - 37, 13, 3, hex('#3a1a14'));  // рот
    p.put(x - 5, y - 37, hex('#e8e2d0'));           // клыки
    p.put(x - 5, y - 36, hex('#e8e2d0'));
    p.put(x + 5, y - 37, hex('#e8e2d0'));
    p.put(x + 5, y - 36, hex('#e8e2d0'));
    // плечи-валуны
    rect(p, x - 19, y - 34, 8, 10, OGD);
    rect(p, x + 12, y - 34, 8, 10, OGD);
    rect(p, x - 19, y - 34, 8, 3, OG);
    rect(p, x + 12, y - 34, 8, 3, OG);
    // руки: толстые, с кулаками
    rect(p, x - 21, y - 30 + step, 7, 16, OGD);
    rect(p, x + 15, y - 30 - step, 7, 16, OGD);
    rect(p, x - 22, y - 16 + step, 9, 7, OG);       // кулак
    rect(p, x + 15, y - 16 - step, 9, 7, OG);
    // дубина с шипами
    const hy2 = y - 44 - step * 2 + atkPhase * 16;
    rect(p, x + 20, hy2, 5, 26, hex('#5a4528'));
    rect(p, x + 20, hy2, 2, 26, hex('#7a5f38'));
    rect(p, x + 17, hy2 - 8, 11, 10, hex('#4a3520'));
    for (const [dx2, dy2] of [[-1, -2], [9, -1], [3, 7], [-2, 6], [10, 6], [4, -5]]) {
      p.put(x + 17 + dx2, hy2 - 8 + dy2, hex('#b8b0a0'));
    }
  } else if (e.kind === 'orc') {
    rect(p, x - 4, y - 6, 4, 6, COL.orcD);
    rect(p, x + 2, y - 6, 4, 6, COL.orcD);
    // тело
    rect(p, x - 8, y - 22 + step, 18, 18, COL.orc);
    rect(p, x - 8, y - 22 + step, 18, 2, COL.orcD);
    p.line(x - 6, y - 18 + step, x - 6, y - 8 + step, COL.orcD);
    // голова
    rect(p, x - 6, y - 32 + step, 14, 12, COL.orcD);
    // боевая раскраска — красные полосы на щеке
    p.line(x - 6, y - 26 + step, x - 3, y - 30 + step, hex('#c9302a'));
    p.line(x - 5, y - 24 + step, x - 2, y - 28 + step, hex('#c9302a'));
    // глаза с бликом
    p.put(x - 4, y - 28 + step, COL.red); p.put(x - 4, y - 27 + step, hex('#ffd24a'));
    p.put(x + 4, y - 28 + step, COL.red); p.put(x + 4, y - 27 + step, hex('#ffd24a'));
    p.put(x - 2, y - 22 + step, COL.steel);        // клык
    p.put(x + 4, y - 22 + step, COL.steel);
    // костяные бусы на груди
    for (let i = 0; i < 4; i++) {
      p.put(x - 5 + i * 3, y - 20 + step + (i % 2), hex('#e8e2d0'));
    }
    // кожаные ремни через торс
    p.line(x - 7, y - 21 + step, x + 8, y - 15 + step, hex('#4a2f18'));
    p.line(x - 7, y - 20 + step, x + 8, y - 14 + step, hex('#6a4522'));
    // копьё с замахом
    const spear = atkPhase ? -6 : 0;
    rect(p, x + 10 + spear, y - 32, 2, 32, COL.wood);
    p.put(x + 10 + spear, y - 34, COL.steel);
    p.put(x + 11 + spear, y - 33, COL.steel);
    p.put(x + 10 + spear, y - 31, COL.armor);
  } else {
    rect(p, x - 4, y - 6, 4, 6, COL.armorD);
    rect(p, x + 2, y - 6, 4, 6, COL.armorD);
    // тело
    rect(p, x - 8, y - 24 + step, 18, 20, COL.armor);
    rect(p, x - 8, y - 24 + step, 18, 2, COL.steel);
    // красный сюрко поверх доспеха
    rect(p, x - 2, y - 23 + step, 7, 19, hex('#a8322a'));
    rect(p, x - 2, y - 23 + step, 3, 19, hex('#c94f3d'));
    // золотая эмблема на сюрко
    p.put(x + 1, y - 18 + step, COL.gold);
    p.put(x + 1, y - 17 + step, COL.gold);
    p.put(x, y - 16 + step, hex('#b8901e'));
    rect(p, x - 4, y - 18 + step, 10, 8, COL.armorD);   // нагрудник
    p.put(x - 4, y - 16 + step, COL.steel); p.put(x + 4, y - 16 + step, COL.steel);
    p.line(x - 8, y - 12 + step, x + 9, y - 12 + step, COL.armorD);
    p.line(x - 8, y - 7 + step, x + 9, y - 7 + step, COL.armorD);
    // наплечники с бликом
    rect(p, x - 10, y - 24 + step, 3, 5, hex('#b8b8c8'));
    rect(p, x + 8, y - 24 + step, 3, 5, hex('#b8b8c8'));
    // шлем с забралом и плюмажем
    rect(p, x - 6, y - 36 + step, 14, 12, COL.armorD);
    rect(p, x - 6, y - 36 + step, 14, 2, COL.steel);
    // золотая окантовка шлема
    for (let i = 0; i < 14; i++) p.put(x - 6 + i, y - 35 + step, hex('#c9a44f'), 0.8);
    rect(p, x - 4, y - 32 + step, 10, 2, COL.visor);
    p.line(x - 4, y - 29 + step, x + 5, y - 29 + step, COL.visor);
    // плюмаж: три пера разного цвета, колышутся
    const pl = Math.round(Math.sin(time * 4 + x) * 1);
    p.put(x - 7, y - 40 + step, hex('#d94a3a'));
    p.put(x - 6, y - 41 + step, hex('#e86a50'));
    p.put(x - 8 + pl, y - 42 + step, hex('#f09070'));
    p.put(x - 5, y - 42 + step, hex('#c93d2a'));
    // щит с гербом
    rect(p, x - 14, y - 24 + step, 6, 14, COL.red);
    rect(p, x - 14, y - 24 + step, 6, 2, COL.redD);
    p.put(x - 11, y - 18 + step, COL.gold); p.put(x - 12, y - 17 + step, COL.gold);
    // меч с замахом
    const swing = atkPhase ? -8 : 0;
    rect(p, x + 12 + swing, y - 26 + step, 2, 18, COL.steel);
    p.put(x + 12 + swing, y - 27 + step, COL.steel);
    p.put(x + 12 + swing, y - 10 + step, COL.woodD); p.put(x + 13 + swing, y - 10 + step, COL.woodD);
    p.put(x + 10 + swing, y - 9 + step, COL.wood); p.put(x + 15 + swing, y - 9 + step, COL.wood);
  }

// ---------- БОССЫ: 5 типов, крупные силуэты ----------
function drawBoss(p, e, x, y, time, walkStep) {
  const bob = Math.round(Math.sin(time * 3) * 1.5);
  const enraged = e.enraged;
  const flash = e.hp < e.maxHp * 0.35 ? (Math.sin(time * 10) > 0 ? 1 : 0) : 0;

  if (e.bossId === 'ogre') {
    // ОГР-ГРОМИЛА: огромный, с дубиной, ярость = красные глаза
    // ноги
    rect(p, x - 13, y - 14, 10, 14, COL.orcD);
    rect(p, x + 5, y - 14, 10, 14, COL.orcD);
    p.put(x - 12, y - 13, COL.orc); p.put(x + 6, y - 13, COL.orc);
    // живот
    rect(p, x - 16, y - 40 + bob, 34, 28, COL.orc);
    rect(p, x - 16, y - 40 + bob, 34, 4, COL.orcD);
    rect(p, x - 8, y - 30 + bob, 16, 14, hex('#6a8a3a'));   // светлый живот
    p.line(x - 14, y - 22 + bob, x + 16, y - 22 + bob, COL.orcD);
    // голова
    rect(p, x - 11, y - 58 + bob, 24, 19, COL.orcD);
    const eyeCol = enraged ? hex('#ff3b2e') : COL.red;
    rect(p, x - 6, y - 52 + bob, 6, 5, eyeCol);
    rect(p, x + 4, y - 52 + bob, 6, 5, eyeCol);
    p.put(x - 5, y - 51 + bob, 0xfffff07a); p.put(x + 5, y - 51 + bob, 0xfffff07a);
    // клыки
    rect(p, x - 5, y - 42 + bob, 2, 5, COL.steel);
    rect(p, x + 6, y - 42 + bob, 2, 5, COL.steel);
    // рога
    p.line(x - 11, y - 58 + bob, x - 15, y - 66 + bob, hex('#c9b991'));
    p.line(x + 12, y - 58 + bob, x + 16, y - 66 + bob, hex('#c9b991'));
    // руки
    rect(p, x - 25, y - 38 + bob - walkStep, 8, 20, COL.orc);
    rect(p, x + 19, y - 38 + bob + walkStep, 8, 20, COL.orc);
    // дубина (огромная)
    const swing = e.atkT > 0 && e.atkT < 0.5 ? 8 : 0;
    rect(p, x + 22, y - 62 + swing + bob, 5, 36, COL.wood);
    rect(p, x + 18, y - 70 + swing + bob, 13, 12, COL.woodD);
    for (const [dx, dy] of [[-1, -3], [8, -2], [3, 6], [-3, 4], [11, 5]]) {
      p.put(x + 20 + dx, y - 66 + swing + bob + dy, COL.steel);
    }
  } else if (e.bossId === 'troll') {
    // ТРОЛЛЬ-ЛЕКАРЬ: зелёный, с посохом, лечится (зелёные искры)
    rect(p, x - 10, y - 12, 8, 12, hex('#3a6a2e'));
    rect(p, x + 3, y - 12, 8, 12, hex('#3a6a2e'));
    // тело
    rect(p, x - 13, y - 36 + bob, 28, 25, hex('#4a7a3a'));
    rect(p, x - 13, y - 36 + bob, 28, 3, hex('#3a6a2e'));
    // горб
    p.line(x - 13, y - 34 + bob, x - 18, y - 40 + bob, hex('#4a7a3a'));
    p.line(x - 18, y - 40 + bob, x - 12, y - 44 + bob, hex('#5a8a4a'));
    // голова с ушами
    rect(p, x - 8, y - 50 + bob, 18, 15, hex('#5a8a4a'));
    p.line(x - 8, y - 48 + bob, x - 14, y - 52 + bob, hex('#5a8a4a'));
    p.line(x + 9, y - 48 + bob, x + 15, y - 52 + bob, hex('#5a8a4a'));
    // глаза (жёлтые, светятся)
    rect(p, x - 4, y - 45 + bob, 4, 3, hex('#f2e94a'));
    rect(p, x + 4, y - 45 + bob, 4, 3, hex('#f2e94a'));
    // нос и рот
    p.put(x + 1, y - 41 + bob, hex('#3a6a2e'));
    p.line(x - 3, y - 38 + bob, x + 6, y - 38 + bob, hex('#2a4a1e'));
    // посох с зелёным кристаллом
    rect(p, x + 17, y - 56 + bob, 2, 44, COL.wood);
    const glow = 0.5 + 0.5 * Math.sin(time * 4);
    p.dot(x + 18, y - 58 + bob, hex('#7ff09a'), glow);
    p.dot(x + 18, y - 60 + bob, hex('#a8f0b8'), glow * 0.7);
    // целительные искры при лечении
    if (e.mechT !== undefined && e.mechT > 2.0) {
      for (let i = 0; i < 4; i++) {
        const a = i * 1.6 + time * 2;
        p.dot(x + Math.round(Math.cos(a) * 12), y - 30 + Math.round(Math.sin(a) * 10), hex('#7ff09a'), 0.8);
      }
    }
  } else if (e.bossId === 'necro') {
    // НЕКРОМАНТ: тёмный балахон, череп, светящиеся руки, призывает скелетов
    // балахон (конус)
    for (let i = 0; i < 30; i++) {
      const w = Math.round(14 * (1 - i / 30));
      const yy = y - 30 + i;
      for (let dx = -w; dx <= w; dx++) p.put(x + dx, yy, i % 5 === 0 ? hex('#2a1a3a') : hex('#3a2a4a'));
    }
    // капюшон
    rect(p, x - 9, y - 52 + bob, 19, 24, hex('#2a1a3a'));
    for (let dx = -9; dx <= 9; dx++) p.put(x + dx, y - 52 + bob, hex('#4a3a5a'));
    // лицо-череп во тьме
    rect(p, x - 6, y - 46 + bob, 13, 12, hex('#c9c2b0'));
    rect(p, x - 4, y - 43 + bob, 3, 4, hex('#1a0a1a'));
    rect(p, x + 4, y - 43 + bob, 3, 4, hex('#1a0a1a'));
    p.put(x - 3, y - 42 + bob, hex('#c94fff'));      // фиолетовый огонь в глазах
    p.put(x + 5, y - 42 + bob, hex('#c94fff'));
    p.line(x - 3, y - 37 + bob, x + 5, y - 37 + bob, hex('#8a7a6a'));   // зубы
    p.put(x, y - 39 + bob, hex('#6a5a4a'));
    // руки с магией
    const mg = 0.5 + 0.5 * Math.sin(time * 3.5);
    p.dot(x - 14, y - 30 + bob, hex('#c94fff'), mg);
    p.dot(x + 14, y - 30 + bob, hex('#c94fff'), mg);
    p.dot(x - 16, y - 32 + bob, hex('#e8a0ff'), mg * 0.6);
    // посох с черепом
    rect(p, x + 17, y - 54 + bob, 2, 40, hex('#3a2a1a'));
    rect(p, x + 15, y - 60 + bob, 7, 8, hex('#c9c2b0'));
    p.put(x + 17, y - 57 + bob, hex('#c94fff')); p.put(x + 20, y - 57 + bob, hex('#c94fff'));
  } else if (e.bossId === 'warlord') {
    // ВОЕНАЧАЛЬНИК: тяжёлая броня, шлем с рогами, огромный топор
    rect(p, x - 11, y - 14, 9, 14, hex('#5a5a66'));
    rect(p, x + 3, y - 14, 9, 14, hex('#5a5a66'));
    // торс в броне
    rect(p, x - 15, y - 42 + bob, 31, 29, hex('#7a7a8a'));
    rect(p, x - 15, y - 42 + bob, 31, 3, hex('#9a9aaa'));
    // наплечники с шипами
    rect(p, x - 21, y - 42 + bob, 8, 9, hex('#8a8a9a'));
    rect(p, x + 14, y - 42 + bob, 8, 9, hex('#8a8a9a'));
    p.put(x - 21, y - 44 + bob, COL.steel); p.put(x + 20, y - 44 + bob, COL.steel);
    // нагрудник с гербом
    rect(p, x - 8, y - 36 + bob, 17, 15, hex('#5a5a6a'));
    rect(p, x - 2, y - 33 + bob, 5, 9, hex('#c93d2a'));
    p.put(x, y - 30 + bob, COL.gold);
    // шлем с рогами и забралом
    rect(p, x - 9, y - 58 + bob, 19, 18, hex('#5a5a6a'));
    rect(p, x - 9, y - 58 + bob, 19, 2, hex('#9a9aaa'));
    rect(p, x - 6, y - 52 + bob, 13, 3, hex('#1a1a22'));
    p.line(x - 9, y - 58 + bob, x - 16, y - 68 + bob, hex('#c9b991'));
    p.line(x + 10, y - 58 + bob, x + 17, y - 68 + bob, hex('#c9b991'));
    // плащ
    for (let i = 0; i < 22; i++) p.put(x - 17 - (i % 3), y - 40 + bob + i, hex('#8a2a1a'));
    // топор
    const sw = e.atkT > 0 && e.atkT < 0.5 ? 10 : 0;
    rect(p, x + 20, y - 58 + sw + bob, 3, 42, COL.wood);
    rect(p, x + 14, y - 66 + sw + bob, 16, 11, hex('#b0b0c0'));
    p.put(x + 14, y - 68 + sw + bob, COL.steel);
    p.put(x + 29, y - 60 + sw + bob, COL.steel);
  } else if (e.bossId === 'dragonling') {
    // ДРАКОНЧИК: парит над землёй, крылья машут, дышит огнём
    const hover = Math.round(Math.sin(time * 2.5) * 3);
    const yy = y + hover - 6;
    // крылья (машут)
    const wing = Math.sin(time * 6) * 5;
    for (let i = 0; i < 14; i++) {
      p.put(x - 14 - i, yy - 30 - Math.round(wing * (i / 14)), hex('#8a2a1a'));
      p.put(x - 14 - i, yy - 29 - Math.round(wing * (i / 14)), hex('#a03a20'));
      p.put(x + 16 + i, yy - 30 - Math.round(wing * (i / 14)), hex('#8a2a1a'));
      p.put(x + 16 + i, yy - 29 - Math.round(wing * (i / 14)), hex('#a03a20'));
    }
    // тело
    rect(p, x - 12, yy - 26, 25, 18, hex('#a03a20'));
    rect(p, x - 12, yy - 26, 25, 3, hex('#c94f2a'));
    // брюхо
    rect(p, x - 6, yy - 18, 13, 8, hex('#e8a06a'));
    // голова с пастью
    rect(p, x + 8, yy - 36, 16, 13, hex('#c94f2a'));
    rect(p, x + 9, yy - 26, 14, 4, hex('#8a2a1a'));      // пасть
    p.put(x + 12, yy - 27, COL.steel); p.put(x + 16, yy - 27, COL.steel);  // зубы
    p.put(x + 14, yy - 32, hex('#ffe08a'));              // глаз
    p.line(x + 10, yy - 38, x + 14, yy - 42, hex('#c9b991'));  // рог
    // хвост
    for (let i = 0; i < 12; i++) p.put(x - 13 - i, yy - 20 + Math.round(Math.sin(time * 3 + i * 0.4) * 2), hex('#8a2a1a'));
    // огонь из пасти при атаке
    if (e.atkT > 0 && e.atkT < 0.6) {
      for (let i = 0; i < 8; i++) {
        p.dot(x + 22 + i * 2, yy - 25 + Math.round(Math.sin(time * 20 + i) * 2), i < 4 ? hex('#fff3a6') : hex('#f2561d'), 1 - i / 10);
      }
    }
  }
}

// скелеты (призыв некроманта)
function drawSkeleton(p, e, x, y, time, step) {
  const BONE = hex('#e8e2d0'), BONED = hex('#a89f8c'), OUTL = hex('#2a2620');
  // ноги
  rect(p, x - 4, y - 8, 3, 8, BONED);
  rect(p, x + 2, y - 8, 3, 8, BONED);
  p.put(x - 5, y - 1, OUTL); p.put(x + 5, y - 1, OUTL);
  // позвоночник
  rect(p, x, y - 22 + step, 2, 14, BONED);
  // три крупных ребра (читаемо на мелком масштабе)
  for (let i = 0; i < 3; i++) {
    const ry = y - 20 + step + i * 4;
    rect(p, x - 5 + i, ry, 11 - i * 2, 2, BONE);
    p.put(x - 6 + i, ry, OUTL);
    p.put(x + 6 - i, ry, OUTL);
  }
  // таз
  rect(p, x - 4, y - 9, 9, 2, BONE);
  // плечи
  rect(p, x - 6, y - 23 + step, 13, 2, BONE);
  // череп: крупный, с глазницами и челюстью
  rect(p, x - 5, y - 33 + step, 11, 10, BONE);
  for (let i = 0; i < 11; i++) p.put(x - 5 + i, y - 33 + step, hex('#ffffff'));
  p.put(x - 5, y - 32 + step, OUTL); p.put(x + 5, y - 32 + step, OUTL);
  // глазницы
  rect(p, x - 4, y - 30 + step, 3, 3, OUTL);
  rect(p, x + 2, y - 30 + step, 3, 3, OUTL);
  // красный огонёк в глазах (нежить)
  p.put(x - 3, y - 29 + step, hex('#c93d2a'));
  p.put(x + 3, y - 29 + step, hex('#c93d2a'));
  // нос и зубы
  p.put(x, y - 27 + step, OUTL);
  for (let i = 0; i < 4; i++) p.put(x - 3 + i * 2, y - 24 + step, OUTL);
  // копьё
  rect(p, x + 9, y - 28, 1, 28, hex('#6a5a4a'));
  rect(p, x + 9, y - 30, 2, 3, hex('#b0b0c0'));
  p.put(x + 10, y - 29, hex('#e8e8f0'));
  // рваный плащ
  for (let i = 0; i < 8; i++) {
    p.put(x - 7 - (i % 2), y - 22 + step + i * 2, hex('#4a4038'), 0.8);
  }
}

  // ---- СТАТУСНЫЕ ОВЕРЛЕИ ----
  // заморозка: голубоватая кромка + ледяные кристаллы
  if (e.frozen > 0) {
    const ik = Math.min(1, e.frozen);
    const bw = e.isBoss ? 18 : e.kind === 'ogre' ? 14 : 8;
    const bh = e.isBoss ? 46 : e.kind === 'ogre' ? 34 : 22;
    for (let dx = -bw; dx <= bw; dx++) {
      p.put(x + dx, y - 1, 0xfff0d090, 0.35 * ik);
    }
    for (let dy = 0; dy < bh; dy += 3) {
      p.put(x - bw, y - dy, 0xffeed8a0, 0.22 * ik);
      p.put(x + bw, y - dy, 0xffeed8a0, 0.22 * ik);
    }
    // кристаллы льда
    for (let i = 0; i < 5; i++) {
      const cx2 = x + ((i * 7) % (bw * 2)) - bw;
      const cy2 = y - ((i * 11) % bh);
      p.put(cx2, cy2, 0xfff8f0e0, 0.75 * ik);
      p.put(cx2, cy2 - 1, 0xffffe8d0, 0.5 * ik);
    }
  }
  // вспышка при попадании — белая подсветка силуэта
  if (e.hitT > 0) {
    const hk = Math.min(1, e.hitT * 14) * 0.55;
    const bw = e.isBoss ? 20 : e.kind === 'ogre' ? 15 : 9;
    const bh = e.isBoss ? 52 : e.kind === 'ogre' ? 38 : 26;
    for (let dy = 0; dy < bh; dy += 2) {
      for (let dx = -bw; dx <= bw; dx += 2) {
        p.put(x + dx, y - dy, 0xffffffff, hk * 0.35);
      }
    }
  }
  // ярость огра: красная пульсация
  if (e.enraged) {
    const pk = 0.25 + 0.2 * Math.sin(time * 12);
    for (let dx = -18; dx <= 18; dx += 3) {
      p.put(x + dx, y - 2, 0xffff3020, pk * 0.5);
    }
  }

  // полоса HP: у боссов шире, с рамкой и делениями
  const w = e.isBoss ? 56 : e.kind === 'ogre' ? 32 : 20;
  const frac = Math.max(0, e.hp / e.maxHp);
  const hy = y - (e.isBoss ? 78 : e.kind === 'ogre' ? 52 : 42);
  rect(p, x - (w >> 1) - 1, hy - 1, w + 2, e.isBoss ? 7 : 5, COL.hpBarBg);
  const fillCol = frac > 0.5 ? COL.hpGreen : frac > 0.25 ? COL.hpYellow : COL.red;
  rect(p, x - (w >> 1), hy, Math.max(1, Math.round(w * frac)), e.isBoss ? 5 : 3, fillCol);
  if (e.isBoss) {
    // деления на 4 части + блик
    for (let i = 1; i < 4; i++) p.put(x - (w >> 1) + Math.round(w * i / 4), hy, COL.dark);
    for (let i = 0; i < Math.round(w * frac); i += 2) p.put(x - (w >> 1) + i, hy, 0xffffffff > 0 ? COL.steel : COL.steel, 0.25);
    // корона над полосой = это босс
    p.put(x - 2, hy - 3, COL.gold); p.put(x + 1, hy - 3, COL.gold);
    p.put(x, hy - 4, COL.gold);
  }
}

// ---------- Ландшафт: деревья, кусты, птицы (анимированные, мелкий пиксель) ----------
export function drawScenery(p, w, groundY, time = 0, minX = 0) {
  const COLT = {
    trunk: hex('#5a4026'), trunkD: hex('#3f2c17'),
    leaf: hex('#4a6b2d'), leafD: hex('#38521f'), leafL: hex('#5d7f3a'),
    bush: hex('#405a26'), flowerY: hex('#f4c542'), flowerR: hex('#c94f3d'),
    bird: hex('#2b241c'), rock: hex('#6b6153'),
  };
  const sway = (x) => Math.round(Math.sin(time * 1.6 + x * 0.7) * 2);

  const trees = [
    [192, 1.4, 'oak'], [276, 0.9, 'pine'], [352, 1.6, 'oak'], [444, 1.0, 'pine'],
    [524, 1.25, 'oak'], [592, 0.85, 'pine'], [48, 1.1, 'oak'], [624, 1.3, 'oak'],
    [128, 0.75, 'pine'], [236, 1.05, 'oak'], [410, 0.8, 'oak'], [484, 1.15, 'pine'], [560, 0.95, 'oak'],
  ];
  for (const [tx, sc, kind] of trees) {
    if (tx < minX) continue;                       // не рисуем поверх замка
    const s = sway(tx), th = Math.round(68 * sc);
    if (kind === 'pine') {
      rect(p, tx, groundY - th, 6, th, COLT.trunk);
      rect(p, tx + 4, groundY - th, 2, th, COLT.trunkD);
      for (let tier = 0; tier < 4; tier++) {
        const ty = groundY - th + tier * Math.round(14 * sc);
        const tw = Math.round((6 + tier * 8) * sc);
        rect(p, tx + 3 - tw + s * (tier + 1), ty, tw * 2, Math.round(16 * sc), COLT.leafD);
        rect(p, tx + 3 - tw + s * (tier + 1), ty, tw * 2, Math.round(6 * sc), COLT.leaf);
      }
      p.put(tx + 3 + s, groundY - th - 4, COLT.leaf);
    } else {
      rect(p, tx, groundY - th, Math.max(6, Math.round(8 * sc)), th, COLT.trunk);
      rect(p, tx, groundY - th, 2, th, COLT.trunkD);
      p.put(tx - 2, groundY - 2, COLT.trunk); p.put(tx + 9, groundY - 2, COLT.trunk);
      rect(p, tx + 4, groundY - Math.round(th * 0.6), Math.round(6 * sc), 2, COLT.trunkD);
      const cy = groundY - th;
      rect(p, tx - 14 + s, cy - 20, 32, 16, COLT.leaf);
      rect(p, tx - 22 + s, cy - 10, 46, 14, COLT.leaf);
      rect(p, tx - 8 + s, cy - 30, 20, 12, COLT.leaf);
      rect(p, tx - 28 + s, cy - 4, 12, 8, COLT.leafD);
      for (let i = 0; i < 10; i++) p.put(tx - 20 + s + i * 5, cy + 2, COLT.leafD);
      for (let i = 0; i < 8; i++) p.put(tx - 10 + s + i * 4, cy - 28, COLT.leafL);
      p.put(tx + 9 + s, cy - 22, COLT.leafL); p.put(tx - 24 + s, cy - 8, COLT.leafL);
    }
  }
  // камни
  for (const rx of [116, 236, 400, 500, 570]) {
    if (rx < minX) continue;
    rect(p, rx, groundY - 6, 12, 6, COLT.rock);
    rect(p, rx + 2, groundY - 8, 8, 2, COLT.rock);
    p.put(rx + 2, groundY - 8, hex('#8a8072')); p.put(rx, groundY - 2, hex('#4d453b'));
    p.put(rx + 10, groundY - 4, hex('#57503f'));
  }
  // опадающие листья
  for (let i = 0; i < 8; i++) {
    const ph = time * 0.5 + i * 1.7;
    const lx = Math.round(80 + i * 68 + Math.sin(ph * 2) * 16);
    const ly = Math.round(((ph * 10 + i * 30) % 240));
    p.put(lx, 40 + ly, i % 2 ? hex('#8a9a3d') : hex('#c9a44f'), 0.8);
    p.put(lx + 1, 40 + ly, i % 2 ? hex('#7a8a33') : hex('#b9944a'), 0.5);
  }
  // кусты
  for (const bx of [140, 256, 356, 472, 576]) {
    if (bx < minX) continue;
    const s = sway(bx + 40) > 0 ? 1 : 0;
    rect(p, bx, groundY - 8, 16, 8, COLT.bush);
    rect(p, bx + 4, groundY - 10, 8, 2, COLT.bush);
    p.put(bx + 3 + s, groundY - 10, COLT.bush);
    if (bx % 2) p.put(bx + 6, groundY - 12, bx % 3 ? COLT.flowerY : COLT.flowerR);
  }
  // трава
  for (let gx = 120; gx < w - 10; gx += 18) {
    const s = Math.round(Math.sin(time * 2 + gx) * 2);
    p.put(gx, groundY - 1, hex('#6d7f42'));
    p.put(gx + s, groundY - 2, hex('#6d7f42'));
    p.put(gx + s, groundY - 3, hex('#7d8f4c'), 0.6);
  }
  // птицы
  for (let b = 0; b < 4; b++) {
    const bx = Math.round(((time * (28 + b * 12) + b * 260) % (w + 80)) - 40);
    const by = 36 + b * 18 + Math.round(Math.sin(time * 1.3 + b * 2) * 12);
    const fl = Math.round(Math.sin(time * 9 + b * 3));
    p.put(bx, by, COLT.bird);
    p.put(bx - 1, by - fl - 1, COLT.bird);
    p.put(bx + 1, by - fl - 1, COLT.bird);
    p.put(bx - 2, by - fl, COLT.bird);
    p.put(bx + 2, by - fl, COLT.bird);
  }
}
