// Средневековые пиксельные спрайты — рисуются кодом в pixelfx-кадр
// (Painter: p.put(x, y, color), p.line(...)), поэтому спрайты и эффекты
// живут в одном пиксельном слое. Мир 640×360: пиксель мелкий, детали тонкие.

import { hex } from "./vendor/pixelfx/core/color.js?v=2";

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
  for (let y = 0; y < h; y++) {
    const f = y / h;
    const col = f < 0.22 ? COL.skyA : f < 0.52 ? COL.skyB : COL.skyC;
    for (let x = 0; x < w; x++) p.put(x, y, col);
  }
  for (const fy of [0.22, 0.52]) {
    const y0 = Math.round(fy * h);
    for (let y = y0 - 6; y <= y0 + 6; y++) {
      if (y < 0 || y >= h) continue;
      for (let x = 0; x < w; x += 2) if (((x + y) & 3) === 0) p.put(x, y, y < y0 ? COL.skyB : COL.skyC);
    }
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
  for (let dy = -36; dy <= 36; dy++) for (let dx = -36; dx <= 36; dx++) {
    const d2 = dx * dx + dy * dy;
    if (d2 <= 1296 && d2 > 196) {
      const a = d2 > 800 ? 0.22 : d2 > 480 ? 0.45 : 0.8;
      p.put(x + dx, y + dy, COL.sunGlow, a);
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
  const clouds = [[80, 42, 1.0], [336, 70, 0.8], [496, 30, 0.6], [560, 88, 0.9]];
  for (const [bx, by, s] of clouds) {
    const cx = Math.round(((bx + t * 5) % (w + 140)) - 70);
    for (let i = 0; i < 4; i++) {
      rect(p, cx + i * 12 - 16, by + ((i % 2) ? 2 : 0), Math.round((22 + (i % 3) * 10) * s), Math.round((4 + (i % 2) * 4) * s), COL.skyB);
    }
    // лёгкая подсветка сверху
    for (let i = 0; i < 3; i++) p.put(cx - 8 + i * 12, by - 1, hex('#6d4f63'));
  }
}

// ---------- Горы и земля ----------
export function drawGround(p, w, groundY) {
  for (let x = 0; x < w; x += 2) {
    const mh = 44 + Math.round(30 * Math.sin(x * 0.019) + 16 * Math.sin(x * 0.051 + 2));
    rect(p, x, groundY - mh - 60, 2, mh, COL.mount);
  }
  for (let x = 0; x < w; x += 2) {
    const mh = 28 + Math.round(20 * Math.sin(x * 0.031 + 1.4) + 12 * Math.sin(x * 0.077 + 0.6));
    rect(p, x, groundY - mh - 44, 2, mh, COL.mountL);
  }
  rect(p, 0, groundY, w, 360 - groundY, COL.dirt);
  for (let y = groundY + 2; y < 360; y += 6) {
    for (let x = ((y * 7) % 26); x < w; x += 26) {
      p.put(x, y, COL.dirtD);
      p.put(x + 8, y + 2, COL.dirtL);
      p.put(x + 15, y + 1, COL.dirtD);
    }
  }
  for (let x = 0; x < w; x++) {
    p.put(x, groundY - 1, COL.grass);
    p.put(x, groundY - 2, (x & 1) ? COL.grass : COL.grassD);
    if ((x * 7 + 3) % 5 < 2) p.put(x, groundY - 3, COL.grass);
    if ((x * 11 + 5) % 9 < 2) p.put(x, groundY - 4, COL.grassD);
  }
  for (let x = 28; x < w; x += 94) {
    const gy = groundY + 8 + (x % 10);
    rect(p, x, gy, 6, 4, COL.rock);
    p.put(x + 2, gy - 1, COL.stoneL);
    p.put(x + 4, gy + 4, COL.dirtD);
  }
}

// ---------- Замок (640×360: стена 92 wide, детали мельче) ----------
export function drawCastle(p, groundY, hpFrac, t) {
  const wallTop = groundY - 128, wallW = 92;
  rect(p, 0, wallTop, wallW, groundY - wallTop, COL.stone);
  // кладка: ряды по 8px, «кирпичи» со смещением — мельче, чем раньше
  for (let row = 0; row * 8 < groundY - wallTop; row++) {
    const yy = wallTop + 5 + row * 8;
    for (let x = 0; x < wallW; x++) p.put(x, yy, COL.stoneD);
    for (let x = ((row % 2) ? 0 : 7); x < wallW; x += 15)
      for (let y = yy + 1; y < yy + 8 && y < groundY; y++) p.put(x, y, COL.stoneD);
    // блик на верхнем краю ряда
    for (let x = 0; x < wallW; x += 3) p.put(x, yy + 1, COL.stoneL, 0.35);
  }
  for (let x = 0; x < wallW; x++) p.put(x, wallTop + 1, COL.stoneL);
  // зубцы (мерлоны) мельче и ровнее
  for (let x = 0; x < wallW; x += 16) {
    rect(p, x, wallTop - 10, 9, 11, COL.stone);
    for (let i = 0; i < 9; i++) p.put(x + i, wallTop - 10, COL.stoneLL);
    for (let i = 0; i < 9; i += 4) p.put(x + i, wallTop - 6, COL.stoneD);
    p.put(x, wallTop - 1, COL.stoneD);
  }
  // башня слева (шире, с окном и черепицей)
  const tw = 32, tTop = wallTop - 40;
  rect(p, 0, tTop, tw, groundY - tTop, COL.stone);
  for (let row = 0; row * 8 < groundY - tTop; row++) {
    const yy = tTop + 5 + row * 8;
    for (let x = 0; x < tw; x++) p.put(x, yy, COL.stoneD);
  }
  for (let y = tTop; y < groundY; y++) p.put(tw - 2, y, COL.stoneL);
  for (let x = 0; x < tw; x += 14) {
    rect(p, x, tTop - 10, 8, 11, COL.stone);
    for (let i = 0; i < 8; i++) p.put(x + i, tTop - 10, COL.stoneLL);
  }
  rect(p, 12, tTop + 20, 7, 14, COL.stoneDD);   // окно-бойница
  p.put(15, tTop + 20, COL.dark);
  p.put(13, tTop + 25, COL.dark);
  // ворота с аркой, досками и кольцом
  const gw = 32, gh = 40;
  rect(p, 32, groundY - gh, gw, gh, COL.woodD);
  for (let i = 3; i < gw; i += 5) rect(p, 32 + i, groundY - gh, 1, gh, COL.wood);
  for (let i = 0; i < gw; i++) {
    const dy = Math.round(Math.abs(i - gw / 2) * 0.9);
    for (let y = groundY - gh; y < groundY - gh + dy; y++) p.put(32 + i, y, COL.stoneDD);
  }
  for (let x = 34; x < 32 + gw; x += 9) rect(p, x, groundY - gh + 12, 1, gh - 12, COL.stoneDD);
  p.put(46, groundY - 18, COL.gold);
  p.put(47, groundY - 18, COL.gold);
  // трещины от урона — больше уровней, тонкие
  const dmgLvl = Math.floor((1 - hpFrac) * 7);
  for (let d = 0; d < dmgLvl; d++) {
    const cx = 8 + d * 12, cy = wallTop + 28 + (d % 3) * 24;
    p.line(cx, cy, cx + 6, cy + 4, COL.stoneDD);
    p.line(cx + 6, cy + 4, cx + 4, cy + 10, COL.stoneDD);
    p.put(cx + 6, cy + 4, COL.stoneDD);
    p.line(cx + 4, cy + 10, cx + 9, cy + 14, COL.stoneDD);
    p.put(cx + 2, cy + 2, COL.stoneD);
  }
  // флаг
  const flagX = 24, wave = Math.round(Math.sin(t * 3) * 2);
  rect(p, flagX, wallTop - 36, 2, 24, COL.woodD);
  rect(p, flagX + 2, wallTop - 36, 16, 10, COL.red);
  rect(p, flagX + 2, wallTop - 28, 16, 2, COL.redD);
  p.put(flagX + 4, wallTop - 36, COL.woodD);
  p.put(flagX + 9 + wave, wallTop - 31, COL.gold);
  p.put(flagX + 4 + wave, wallTop - 31, COL.gold);
}

// ---------- Лучник (2× детализация, тонкие линии) ----------
// gear: { helm: [col,colDark]|null, body: [...], boot, glove, bow, cape, aura: {col, k} }
export function drawArcher(p, x, y, aimAngle, firing, time = 0, bowPull = 0, recoil = false, gear = null) {
  const breathe = Math.round(Math.sin(time * 2.2));
  const breathe2 = Math.sin(time * 2.2) > 0.6 ? 1 : 0;
  const lean = Math.round(bowPull * 3);
  const bx0 = x - lean;
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
  p.put(x - 4, y - 34, COL.steel); p.put(x - 2, y - 34, COL.steel);
  p.put(x - 1, y - 33, COL.steel);
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
  if (e.kind === 'ogre') {
    // ноги
    rect(p, x - 10, y - 10, 8, 10, COL.orcD);
    rect(p, x + 4, y - 10, 8, 10, COL.orcD);
    p.put(x - 9, y - 9, COL.orc); p.put(x + 5, y - 9, COL.orc);
    // туловище
    rect(p, x - 12, y - 30, 26, 22, COL.orc);
    rect(p, x - 12, y - 30, 26, 3, COL.orcD);
    rect(p, x - 2, y - 24, 7, 12, COL.orcD);
    p.line(x - 10, y - 18, x - 4, y - 22, COL.orcD);
    // голова
    rect(p, x - 8, y - 42, 18, 14, COL.orcD);
    rect(p, x - 4, y - 38, 4, 4, COL.red);
    rect(p, x + 4, y - 38, 4, 4, COL.red);
    p.put(x - 3, y - 37, 0xffff7b6a); p.put(x + 5, y - 37, 0xffff7b6a);
    // клыки
    p.put(x - 2, y - 30, COL.steel); p.put(x + 4, y - 30, COL.steel);
    p.put(x - 2, y - 29, COL.steel); p.put(x + 4, y - 29, COL.steel);
    // руки и дубина
    rect(p, x - 18, y - 28 + step, 6, 14, COL.orc);
    rect(p, x + 12 - atkPhase * 4, y - 28 - step, 6, 14, COL.orc);
    const hy2 = y - 40 - step * 2 + atkPhase * 16;
    rect(p, x + 16, hy2, 4, 24, COL.wood);
    rect(p, x + 14, hy2 - 6, 8, 8, COL.woodD);
    p.put(x + 17, hy2 - 7, COL.steel); p.put(x + 15, hy2 - 2, COL.steel);
    p.put(x + 19, hy2 + 2, COL.steel);
  } else if (e.kind === 'orc') {
    rect(p, x - 4, y - 6, 4, 6, COL.orcD);
    rect(p, x + 2, y - 6, 4, 6, COL.orcD);
    // тело
    rect(p, x - 8, y - 22 + step, 18, 18, COL.orc);
    rect(p, x - 8, y - 22 + step, 18, 2, COL.orcD);
    p.line(x - 6, y - 18 + step, x - 6, y - 8 + step, COL.orcD);
    // голова
    rect(p, x - 6, y - 32 + step, 14, 12, COL.orcD);
    p.put(x - 4, y - 28 + step, COL.red); p.put(x - 4, y - 27 + step, COL.red);
    p.put(x + 4, y - 28 + step, COL.red); p.put(x + 4, y - 27 + step, COL.red);
    p.put(x - 2, y - 22 + step, COL.steel);        // клык
    p.put(x + 4, y - 22 + step, COL.steel);
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
    rect(p, x - 4, y - 18 + step, 10, 8, COL.armorD);   // нагрудник
    p.put(x - 4, y - 16 + step, COL.steel); p.put(x + 4, y - 16 + step, COL.steel);
    p.line(x - 8, y - 12 + step, x + 9, y - 12 + step, COL.armorD);
    p.line(x - 8, y - 7 + step, x + 9, y - 7 + step, COL.armorD);
    // шлем с забралом и плюмажем
    rect(p, x - 6, y - 36 + step, 14, 12, COL.armorD);
    rect(p, x - 6, y - 36 + step, 14, 2, COL.steel);
    rect(p, x - 4, y - 32 + step, 10, 2, COL.visor);
    p.line(x - 4, y - 29 + step, x + 5, y - 29 + step, COL.visor);
    p.put(x - 8, y - 40 + step, COL.red); p.put(x - 7, y - 40 + step, COL.red);
    p.put(x - 7, y - 41 + step, COL.redD);
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
  // полоса HP — тоньше
  const w = e.kind === 'ogre' ? 32 : 20;
  const frac = Math.max(0, e.hp / e.maxHp);
  const hy = y - (e.kind === 'ogre' ? 52 : 42);
  rect(p, x - (w >> 1) - 1, hy - 1, w + 2, 5, COL.hpBarBg);
  rect(p, x - (w >> 1), hy, Math.max(1, Math.round(w * frac)), 3,
    frac > 0.5 ? COL.hpGreen : frac > 0.25 ? COL.hpYellow : COL.red);
}

// ---------- Ландшафт: деревья, кусты, птицы (анимированные, мелкий пиксель) ----------
export function drawScenery(p, w, groundY, time = 0) {
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
