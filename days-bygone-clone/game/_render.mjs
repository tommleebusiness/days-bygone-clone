// Рендер сцены в PNG без браузера: проверка графики попиксельно.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const SRC = 'C:/Users/Komp/days-bygone-clone/days-bygone-clone/game';
const OUT = 'C:/Users/Komp/days-bygone-clone/_render';
fs.mkdirSync(OUT, { recursive: true });

// Копируем модули, убирая ?v=N из импортов (Node их не понимает)
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
copyTree('bosses.js');

const { Painter } = await import('file://' + path.join(OUT, 'vendor/pixelfx/core/painter.js').replace(/\\/g, '/'));
const sprites = await import('file://' + path.join(OUT, 'sprites.js').replace(/\\/g, '/'));
const structures = await import('file://' + path.join(OUT, 'structures.js').replace(/\\/g, '/'));

const W = 640, H = 360, GROUND = 296;
const frame = {
  w: W, h: H, ox: 0, oy: 0,
  color: new Uint32Array(W * H),
  light: new Uint32Array(W * H),
};
const p = new Painter(frame);

const t = 1.4;
sprites.drawSky(p, W, H);
sprites.drawSun(p, W - 124, 60, t);
sprites.drawClouds(p, W, t);
sprites.drawGround(p, W, GROUND);
sprites.drawScenery(p, W, GROUND, t, 112);
sprites.drawCastle(p, GROUND, 0.75, t);

// постройки: 5 типов, разные уровни
const structs = [
  { key: 'catapult', lvl: 5 }, { key: 'ballista', lvl: 3 },
  { key: 'tower', lvl: 4 }, { key: 'mage', lvl: 5 }, { key: 'cauldron', lvl: 2 },
];
structures.drawStructures(p, structs, t);

// герой с легендарным сетом
sprites.drawArcher(p, 52, GROUND - 128 + 40, -0.4, false, t, 0.7, false, {
  helm: [0xc95a44e0, 0x8a3a1a, 0xfffff0a8],
  body: [0xc94f3de0, 0x7a2a1a, 0xffffe0b0],
  cape: [0x8a2a1a, 0xc94f3d],
  boot: [0x8a5a1a, 0xc98a3a], glove: [0x8a5a1a, 0xc98a3a],
  bow: [0xc98a3a, 0x8a5a1a, 0xfffff0a8],
  aura: { col: 0xd0a0f4, k: 1 },
});

// враги разных типов
sprites.drawEnemy(p, { kind: 'orc', x: 430, y: GROUND, walkT: 1.2, hp: 60, maxHp: 100, atkT: 0, hitT: 0.05 }, t);
sprites.drawEnemy(p, { kind: 'knight', x: 500, y: GROUND, walkT: 2.1, hp: 40, maxHp: 100, atkT: 0 }, t);
sprites.drawEnemy(p, { kind: 'skeleton', x: 560, y: GROUND, walkT: 0.4, hp: 30, maxHp: 30, atkT: 0 }, t);
sprites.drawEnemy(p, { kind: 'boss', bossId: 'ogre', isBoss: true, x: 620, y: GROUND, walkT: 1, hp: 900, maxHp: 1000, atkT: 0, mechanic: 'rage' }, t);

// ---- статистика
const col = new Uint8Array(frame.color.buffer);
const seen = new Set();
let nonBlack = 0;
for (let i = 0; i < frame.color.length; i++) {
  const c = frame.color[i];
  if (c !== 0) nonBlack++;
  seen.add(c);
}
console.log('unique colors:', seen.size, '| filled px:', nonBlack, '/', frame.color.length);

// ---- запись PNG (RGBA из color buffer, порядок байт R,G,B,A)
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
const raw = Buffer.alloc((W * 4 + 1) * H);
for (let y = 0; y < H; y++) {
  raw[y * (W * 4 + 1)] = 0;
  for (let x = 0; x < W; x++) {
    const src = y * W + x, dst = y * (W * 4 + 1) + 1 + x * 4;
    const v = frame.color[src];
    raw[dst] = v & 255; raw[dst + 1] = (v >>> 8) & 255;
    raw[dst + 2] = (v >>> 16) & 255; raw[dst + 3] = 255;
  }
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
]);
fs.writeFileSync(path.join(OUT, 'scene.png'), png);
console.log('PNG:', path.join(OUT, 'scene.png'), png.length, 'bytes');

// ---- проверки зон
const px = (x, y) => { const v = frame.color[y * W + x]; return [v & 255, (v >>> 8) & 255, (v >>> 16) & 255]; };
const region = (x0, y0, x1, y1) => {
  const s = new Set(); let fill = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const c = frame.color[y * W + x]; if (c) fill++; s.add(c);
  }
  return { colors: s.size, fill };
};
console.log('sky  :', JSON.stringify(region(200, 0, 400, 100)));
console.log('mount:', JSON.stringify(region(300, 130, 500, 200)));
console.log('castle:', JSON.stringify(region(0, 130, 95, 296)));
console.log('towers:', JSON.stringify(region(96, 170, 340, 240)));
console.log('hero :', JSON.stringify(region(35, 190, 75, 260)));
console.log('enemies:', JSON.stringify(region(420, 240, 640, 296)));
console.log('ground:', JSON.stringify(region(200, 300, 400, 330)));