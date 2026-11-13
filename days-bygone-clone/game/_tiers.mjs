// _tiers.mjs — сравнение визуальных тиров построек (уровни 1..15) в одном PNG.
// Рендерит сцену отдельно для каждого уровня, вырезает зону построек,
// увеличивает x3 и складывает вертикально полосами с подписями.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const SRC = 'C:/Users/Komp/days-bygone-clone/days-bygone-clone/game';
const OUT = 'C:/Users/Komp/days-bygone-clone/_render';
fs.mkdirSync(OUT, { recursive: true });

function copyTree(rel) {
  const from = path.join(SRC, rel);
  const to = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  if (fs.statSync(from).isDirectory()) {
    for (const f of fs.readdirSync(from)) copyTree(path.join(rel, f));
  } else if (rel.endsWith('.js')) {
    const code = fs.readFileSync(from, 'utf8').replace(/(\.js)\?v=\d+/g, '$1');
    fs.writeFileSync(to, code);
  }
}
copyTree('vendor');
copyTree('sprites.js');
copyTree('structures.js');
copyTree('structure-upgrades.js');

const { Painter } = await import('file://' + path.join(OUT, 'vendor/pixelfx/core/painter.js').replace(/\\/g, '/'));
const sprites = await import('file://' + path.join(OUT, 'sprites.js').replace(/\\/g, '/'));
const structures = await import('file://' + path.join(OUT, 'structures.js').replace(/\\/g, '/'));

const W = 640, H = 360, GROUND = 296;
const t = 1.4;

// Зона построек, которую вырезаем
const CX0 = 24, CX1 = 410, CY0 = 118, CY1 = 248;
const CW = CX1 - CX0, CH = CY1 - CY0;
const SCALE = 3;

const LEVELS = [1, 3, 6, 9, 12, 15];

function renderLevel(lvl) {
  const frame = { w: W, h: H, ox: 0, oy: 0, color: new Uint32Array(W * H), light: new Uint32Array(W * H) };
  const p = new Painter(frame);
  sprites.drawSky(p, W, H);
  sprites.drawSun(p, W - 124, 60, t);
  sprites.drawClouds(p, W, t);
  sprites.drawGround(p, W, GROUND);
  sprites.drawScenery(p, W, GROUND, t, 112);
  sprites.drawCastle(p, GROUND, 0.75, t);
  // все 8 построек на одном уровне
  const structs = structures.STRUCT_DEFS.map(d => ({ key: d.key, lvl: lvl }));
  structures.drawStructures(p, structs, t);
  return frame;
}

// каждая полоса: подпись-цифра слева + зона построек
const ROWS = LEVELS.length;
const PAD_LABEL = 30;
const outW = PAD_LABEL + CW * SCALE;
const outH = ROWS * (CH * SCALE + 8);

const outColor = new Uint32Array(outW * outH);
// фон — тёмный
for (let i = 0; i < outColor.length; i++) outColor[i] = (0xff << 24) | (18 << 16) | (12 << 8) | 20;

// 3x5 пиксельные цифры для подписей уровня
const DIGITS = {
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00110', '01000', '10000', '11111'],
  '3': ['11110', '00001', '00110', '00001', '00001', '10001', '01110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
};

function putOut(x, y, rgb) {
  if (x < 0 || y < 0 || x >= outW || y >= outH) return;
  outColor[y * outW + x] = (0xff << 24) | ((rgb & 255) << 16) | (((rgb >> 8) & 255) << 8) | ((rgb >> 16) & 255);
}

function drawLabel(str, ox, oy, scale, rgb) {
  for (let ci = 0; ci < str.length; ci++) {
    const g = DIGITS[str[ci]];
    if (!g) continue;
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 5; c++) {
        if (g[r][c] !== '1') continue;
        for (let sy = 0; sy < scale; sy++)
          for (let sx = 0; sx < scale; sx++)
            putOut(ox + ci * 6 * scale + c * scale + sx, oy + r * scale + sy, rgb);
      }
    }
  }
}

LEVELS.forEach((lvl, row) => {
  const frame = renderLevel(lvl);
  const baseY = row * (CH * SCALE + 8);
  // копируем зону с апскейлом
  for (let y = 0; y < CH; y++) {
    for (let x = 0; x < CW; x++) {
      const v = frame.color[(CY0 + y) * W + (CX0 + x)];
      const rgb = (v & 0xff) | (((v >>> 8) & 0xff) << 8) | (((v >>> 16) & 0xff) << 16);
      for (let sy = 0; sy < SCALE; sy++) {
        for (let sx = 0; sx < SCALE; sx++) {
          putOut(PAD_LABEL + x * SCALE + sx, baseY + y * SCALE + sy, rgb);
        }
      }
    }
  }
  // подпись уровня слева
  drawLabel(String(lvl), 4, baseY + Math.round(CH * SCALE / 2) - 12, 3, 0xffd166);
  // разделитель
  for (let x = 0; x < outW; x++) putOut(x, baseY + CH * SCALE + 4, 0x3a2a54);
});

// ---- запись PNG
function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
const raw = Buffer.alloc((outW * 4 + 1) * outH);
for (let y = 0; y < outH; y++) {
  raw[y * (outW * 4 + 1)] = 0;
  for (let x = 0; x < outW; x++) {
    const v = outColor[y * outW + x];
    const d = y * (outW * 4 + 1) + 1 + x * 4;
    raw[d] = v & 255; raw[d + 1] = (v >>> 8) & 255; raw[d + 2] = (v >>> 16) & 255; raw[d + 3] = 255;
  }
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(outW, 0); ihdr.writeUInt32BE(outH, 4);
ihdr[8] = 8; ihdr[9] = 6;
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
]);
const outPath = path.join(OUT, 'tiers.png');
fs.writeFileSync(outPath, png);
console.log('tiers.png:', outW + 'x' + outH, png.length, 'bytes');

// статистика: цвета в зоне построек + сколько пикселей ОТЛИЧАЕТСЯ от уровня 1
const base = renderLevel(1);
LEVELS.forEach(lvl => {
  const f = renderLevel(lvl);
  const s = new Set();
  let fill = 0, diff = 0;
  for (let y = CY0; y < CY1; y++) for (let x = CX0; x < CX1; x++) {
    const i = y * W + x;
    const c = f.color[i];
    if (c) fill++;
    s.add(c);
    if (c !== base.color[i]) diff++;
  }
  console.log('lvl ' + String(lvl).padStart(2) + ': colors=' + s.size + '  changedVsLvl1=' + diff + ' px');
});
