// Спрайты врагов из Pixel Art Atlas (CC0, huggingface.co/datasets/Angais/pixel-art-atlas-1.4m).
// 16x16 PNG с прозрачным фоном; рисуются в мир 640x360 с integer-масштабом.
const ATLAS_FILES = {
  skeleton_warrior: ['skeleton_warrior_0.png', 'skeleton_warrior_1.png', 'skeleton_warrior_2.png'],
  knight:           ['knight_0.png', 'knight_1.png', 'knight_2.png'],
  ghoul:            ['ghoul_0.png', 'ghoul_1.png', 'ghoul_2.png'],
  zombie_soldier:   ['zombie_soldier_0.png', 'zombie_soldier_1.png', 'zombie_soldier_2.png'],
  wolf_warrior:     ['wolf_warrior_0.png', 'wolf_warrior_1.png', 'wolf_warrior_2.png'],
  orc_warrior:      ['orc_warrior_0.png', 'orc_warrior_1.png', 'orc_warrior_2.png'],
  goblin_warrior:   ['goblin_warrior_0.png', 'goblin_warrior_1.png', 'goblin_warrior_2.png'],
  goblin_king:      ['goblin_king_0.png', 'goblin_king_1.png', 'goblin_king_2.png'],
  sorcerer:         ['sorcerer_0.png', 'sorcerer_1.png', 'sorcerer_2.png'],
  stone_golem:      ['stone_golem_0.png', 'stone_golem_1.png', 'stone_golem_2.png'],
  demon_knight:     ['demon_knight_0.png', 'demon_knight_1.png', 'demon_knight_2.png'],
  skeleton_king:    ['skeleton_king_0.png', 'skeleton_king_1.png', 'skeleton_king_2.png'],
  ogre_chief:       ['ogre_chief_0.png', 'ogre_chief_1.png', 'ogre_chief_2.png'],
  orc_chieftain:    ['orc_chieftain_0.png', 'orc_chieftain_1.png', 'orc_chieftain_2.png'],
};

// name -> { img, w, h, rz: [{data:Uint32Array,w,h}] }  (rz — заранее увеличенные копии)
export const atlasSprites = {};
let loaded = false;

function loadOne(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// Готовит целочисленно увеличенную копию спрайта: качество пиксель-арта сохраняется,
// а рисование становится простым копированием 4-байтных пикселей.
function upscale(img, k) {
  const w = img.width * k, h = img.height * k;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(img, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h).data;
  const out = new Uint32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const r = d[i * 4], gg = d[i * 4 + 1], b = d[i * 4 + 2], a = d[i * 4 + 3];
    out[i] = ((a << 24) | (b << 16) | (gg << 8) | r) >>> 0;
  }
  return { data: out, w, h };
}

export async function loadAtlas(base = 'assets/sprites/') {
  if (loaded) return atlasSprites;
  const jobs = [];
  for (const [name, files] of Object.entries(ATLAS_FILES)) {
    for (const f of files) {
      jobs.push(loadOne(base + f).then((img) => {
        if (!img) return;
        const key = f.replace(/_\d+\.png$/, '');
        if (!atlasSprites[key]) atlasSprites[key] = { imgs: [], rz: [] };
        atlasSprites[key].imgs.push(img);
      }));
    }
  }
  await Promise.all(jobs);
  // варианты с разным масштабом
  for (const k of Object.keys(atlasSprites)) {
    const a = atlasSprites[k];
    a.rz = [2, 3, 4].map((s) => upscale(a.imgs[0], s));
    a.variants = a.imgs.map((im) => {
      const out = {};
      for (const s of [2, 3, 4]) out[s] = upscale(im, s);
      return out;
    });
  }
  loaded = true;
  return atlasSprites;
}

export const atlasReady = () => loaded;

// Рисует спрайт в кадр: sx,sy — левый верхний угол, k — масштаб.
// flip — зеркалить ли по горизонтали (враги идут справа налево).
export function drawAtlasSprite(p, key, variant, sx, sy, k = 2, flip = false, flash = 0) {
  const a = atlasSprites[key];
  if (!a || !a.variants) return false;
  const v = a.variants[(variant | 0) % a.variants.length];
  const set = v && v[k];
  if (!set) return false;
  const { data, w, h } = set;
  sx = Math.round(sx); sy = Math.round(sy);
  for (let yy = 0; yy < h; yy++) {
    const py = sy + yy;
    if (py < 0 || py >= p.h) continue;
    for (let xx = 0; xx < w; xx++) {
      const src = flip ? (yy * w + (w - 1 - xx)) : (yy * w + xx);
      const px = data[src];
      if (((px >>> 24) & 0xff) < 8) continue;      // прозрачный
      const dx = sx + xx;
      if (dx < 0 || dx >= p.w) continue;
      if (flash > 0) {
        // белая вспышка при попадании
        const r = px & 0xff, g = (px >>> 8) & 0xff, b = (px >>> 16) & 0xff;
        const nr = r + (255 - r) * flash, ng = g + (255 - g) * flash, nb = b + (255 - b) * flash;
        p.put(dx, py, ((0xff << 24) | ((nb | 0) << 16) | ((ng | 0) << 8) | (nr | 0)) >>> 0);
      } else {
        p.put(dx, py, px);
      }
    }
  }
  return true;
}
