// ============================================================
//  2D-АНИМАЦИЯ: кривые ускорения, твины по ключам, пружины,
//  squash & stretch, onion-skin след.
//
//  Кривые — точный порт пресетов AniCraft (ArtCraft, MIT OR Apache-2.0):
//  crates/doc/src/easing.rs. Формулы классические (Penner/Adobe):
//    In(t) — семейство, Out(t) = 1 − In(1 − t),
//    InOut — In на первой половине и Out на второй,
//    Back перелетает ~10% (c = 1.70158),
//    Elastic = −2^(10t−10)·sin((10t − 10.75)·2π/3),
//    Bounce — четыре параболы (N = 7.5625, D = 2.75).
//  Время t всегда зажимается в 0..1, значение может выходить за 0..1.
// ============================================================

const BACK = 1.70158;
const PI = Math.PI;
const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);

function bounceOut(t) {
  const N = 7.5625, D = 2.75;
  if (t < 1 / D) return N * t * t;
  if (t < 2 / D) { const u = t - 1.5 / D; return N * u * u + 0.75; }
  if (t < 2.5 / D) { const u = t - 2.25 / D; return N * u * u + 0.9375; }
  const u = t - 2.625 / D;
  return N * u * u + 0.984375;
}

// ---- семейства: чистый ease-in ----
const FAMILY = {
  quad:    (t) => t * t,
  cubic:   (t) => t * t * t,
  quart:   (t) => t * t * t * t,
  quint:   (t) => t * t * t * t * t,
  sine:    (t) => 1 - Math.cos(t * PI * 0.5),
  back:    (t) => (BACK + 1) * t * t * t - BACK * t * t,
  circ:    (t) => 1 - Math.sqrt(Math.max(0, 1 - t * t)),
  bounce:  (t) => 1 - bounceOut(1 - t),
  elastic: (t) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return -Math.pow(2, 10 * t - 10) * Math.sin((10 * t - 10.75) * (2 * PI / 3));
  },
};

/** Ease по имени: 'quadOut', 'backInOut', 'bounceOut', 'linear', 'classic:60'. */
export function ease(name, t) {
  t = clamp01(t);
  if (!name || name === 'linear' || name === 'none') return t;
  if (name.startsWith('classic')) {
    // один слайдер, как в Adobe Animate: −100 (вход) … 0 … +100 (выход)
    const s = Math.max(-1, Math.min(1, parseFloat(name.split(':')[1] || '0') / 100));
    if (!s) return t;
    return s > 0 ? 1 - Math.pow(1 - t, 1 + s * 2) : Math.pow(t, 1 - s * 2);
  }
  if (name.startsWith('bezier:')) {
    const [x1, y1, x2, y2] = name.slice(7).split(',').map(Number);
    return cubicBezier(x1, y1, x2, y2, t);
  }
  const m = /^(quad|cubic|quart|quint|sine|back|circ|bounce|elastic)(inout|in|out)?$/i.exec(name);
  if (!m) return t;
  const f = FAMILY[m[1].toLowerCase()];
  const dir = (m[2] || 'out').toLowerCase();
  if (dir === 'in') return f(t);
  if (dir === 'out') return 1 - f(1 - t);
  return t < 0.5 ? f(t * 2) / 2 : 1 - f(2 - t * 2) / 2;   // inOut
}

/** CSS-подобная cubic-bezier(x1,y1,x2,y2): решаем x(s)=t методом Ньютона. */
export function cubicBezier(x1, y1, x2, y2, t) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (s) => ((ax * s + bx) * s + cx) * s;
  const sy = (s) => ((ay * s + by) * s + cy) * s;
  const dx = (s) => (3 * ax * s + 2 * bx) * s + cx;
  let s = t;
  for (let i = 0; i < 6; i++) {
    const d = dx(s);
    if (Math.abs(d) < 1e-5) break;
    s -= (sx(s) - t) / d;
    s = s < 0 ? 0 : s > 1 ? 1 : s;
  }
  return sy(s);
}

// ---------- Твин ----------
// Один объект, одно значение: tween(v0, v1, dur, ease) → update(dt), done, value.
export function tween(from, to, dur = 0.3, easeName = 'quadOut', onUpdate) {
  let t = 0;
  const tw = {
    done: false,
    value: from,
    update(dt) {
      if (tw.done) return to;
      t = Math.min(dur, t + dt);
      const k = dur > 0 ? ease(easeName, t / dur) : 1;
      tw.value = from + (to - from) * k;
      onUpdate?.(tw.value, t / dur);
      if (t >= dur) tw.done = true;
      return tw.value;
    },
    reset() { t = 0; tw.done = false; tw.value = from; return tw; },
  };
  return tw;
}

// ---------- Ключевые кадры (классический твин) ----------
// keys: [{t: 0..1, ease: 'cubicInOut', pose: {x, y, r, a}}]
// sample(t) интерполирует числовые поля между соседними ключами.
export function sampleKeys(keys, t, out = {}) {
  if (!keys.length) return out;
  t = clamp01(t);
  let i = 0;
  while (i < keys.length - 1 && keys[i + 1].t <= t) i++;
  const a = keys[i], b = keys[Math.min(i + 1, keys.length - 1)];
  const span = b.t - a.t;
  const raw = span > 0 ? (t - a.t) / span : 0;
  const k = ease(b.ease || 'linear', raw);
  for (const key in a.pose) {
    const va = a.pose[key], vb = b.pose[key] ?? va;
    out[key] = va + (vb - va) * k;
  }
  return out;
}

// ---------- Пружина (secondary motion) ----------
// Демпфированная пружина: годится для тетивы, плаща, камеры, ползунков UI.
export function spring(value = 0, stiffness = 180, damping = 14) {
  const s = {
    value, target: value, vel: 0, stiffness, damping,
    update(dt) {
      // полунеявный Эйлер, устойчив при больших dt
      const steps = Math.max(1, Math.ceil(dt / (1 / 240)));
      const h = dt / steps;
      for (let i = 0; i < steps; i++) {
        const a = (s.target - s.value) * s.stiffness - s.vel * s.damping;
        s.vel += a * h;
        s.value += s.vel * h;
      }
      return s.value;
    },
    kick(v) { s.vel += v; return s; },
    set(v) { s.value = s.target = v; s.vel = 0; return s; },
  };
  return s;
}

// ---------- Squash & stretch ----------
// Классический принцип анимации: при ударе фигура сплющивается,
// в полёте — вытягивается. Возвращает {sx, sy} — масштабы по осям.
export function squash(amount = 0, vertical = 0) {
  // amount > 0 — прижатие (sx>1, sy<1), vertical > 0 — вытягивание
  const sx = 1 + amount - vertical * 0.5;
  const sy = 1 - amount + vertical * 0.5;
  return { sx: Math.max(0.35, sx), sy: Math.max(0.35, sy) };
}

// ---------- Onion skin: след движения ----------
// AniCraft рисует «луковую кожуру» — предыдущие кадры полупрозрачно.
// Здесь то же самое для быстрых объектов: 3 призрака с затуханием.
export function trail(max = 6, life = 0.18) {
  const pts = [];
  return {
    push(x, y, extra) {
      pts.push({ x, y, t: 0, extra });
      if (pts.length > max) pts.shift();
    },
    update(dt) {
      for (let i = pts.length - 1; i >= 0; i--) {
        pts[i].t += dt;
        if (pts[i].t > life) pts.splice(i, 1);
      }
    },
    each(fn) {
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        fn(p.x, p.y, 1 - p.t / life, i / Math.max(1, pts.length), p.extra);
      }
    },
    get length() { return pts.length; },
    clear() { pts.length = 0; },
  };
}

// ---------- Вспомогательное: пульс ----------
export function pulse(time, speed = 2.2) {
  return 0.5 + 0.5 * Math.sin(time * speed);
}
