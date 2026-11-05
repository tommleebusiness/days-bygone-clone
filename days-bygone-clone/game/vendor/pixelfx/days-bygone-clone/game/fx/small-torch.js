// Компактный настенный факел для маленькой стены (46 px).
// Написан по контракту pixelfx (docs/AUTHORING.md): draw(p, t, o) в локальных
// координатах, origin — основание факела, пламя растёт вверх.
import { hex, mix, rand } from "../../core/index.js";

export const meta = {
  name: "Small Torch",
  desc: "A compact wall torch: a short iron bracket holding a wrapped head, a small licking flame with a bright core, drifting embers and a soft warm glow.",
  tags: ["fire", "torch", "prop", "light", "small", "loop"],
  size: [20, 32],
  origin: [10, 30],
  duration: 2,
  loop: true,
  fps: 30,
  options: { seed: 7 },
};

const DARK = hex("#241310");
const IRON = hex("#4a4550");
const IRON_L = hex("#7a7385");
const WRAP = hex("#6b4426");
const FLAME_D = hex("#c9281f");
const FLAME_M = hex("#f2561d");
const FLAME_H = hex("#ffc23d");
const FLAME_C = hex("#fff3a6");

export function draw(p, t) {
  // смещение пламени (лёгкое колыхание в лупах — без разрывов)
  const sway = Math.sin(t * 5.2) * 1.1 + Math.sin(t * 2.7) * 0.6;
  const hgt = 7 + Math.sin(t * 7.3) * 1.2;

  // кронштейн: держатель в стене
  for (let y = -6; y <= 0; y++) p.put(0, y, IRON);
  p.put(0, -6, IRON_L);
  // чаша
  for (let x = -2; x <= 2; x++) p.put(x, -1, IRON);
  for (let x = -2; x <= 2; x++) p.put(x, 0, DARK);

  // обмотка (фитиль)
  for (let y = -5; y <= -2; y++) for (let x = -1; x <= 1; x++) p.put(x, y, WRAP);

  // пламя: три слоя, сужающиеся вверх
  const cx = Math.round(sway * 0.5);
  for (let i = 0; i < Math.round(hgt); i++) {
    const f = i / hgt;                       // 0 снизу .. 1 сверху
    const half = Math.max(0, Math.round((1 - f) * 2.1 + 0.4));
    const y = -6 - i;
    const ox = Math.round(sway * f * 1.4);
    for (let x = -half; x <= half; x++) {
      const edge = Math.abs(x) === half;
      let col = FLAME_M;
      if (i < 2 && Math.abs(x) <= 1) col = FLAME_C;
      else if (f < 0.45) col = edge ? FLAME_D : FLAME_H;
      else if (f < 0.8) col = edge ? FLAME_M : FLAME_H;
      else col = edge ? FLAME_D : FLAME_M;
      p.put(x + cx + ox, y, col);
    }
  }
  // ядро
  p.put(cx, -7, FLAME_C);
  p.put(cx + (sway > 0 ? 1 : -1), -8, FLAME_C);

  // искры
  for (let k = 0; k < 3; k++) {
    const ph = (t * (0.9 + k * 0.25) + k * 0.37) % 1;
    const ex = Math.round(sway * 1.5 + Math.sin(t * 3 + k * 2) * 1.5);
    const ey = -10 - Math.round(ph * 9);
    if (ph < 0.75) p.put(ex + (k - 1), ey, mix(FLAME_H, FLAME_C, 1 - ph));
  }

  // тёплое свечение вокруг
  for (let a = 0; a < 10; a++) {
    const ang = (a / 10) * Math.PI * 2;
    const r = 3 + Math.sin(t * 4 + a) * 0.7;
    const gx = Math.round(Math.cos(ang) * r + cx);
    const gy = Math.round(Math.sin(ang) * r * 0.8 - 8);
    p.add(p.toX(gx, gy) | 0, p.toY(gx, gy) | 0, 0x2a1a08, 0.55);
  }
  void rand;
}
