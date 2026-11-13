// monetization.js — донат (IAP) и платная реклама для «Дни Минувшие»
// Работает и в браузере (заглушка), и в Android-обёртке (нативный мост window.Android).
//
// Нативные методы, которые вызывает этот модуль:
//   Android.iapInit()                        — подключить BillingClient
//   Android.iapProducts(jsonArrayOfIds)      — получить цены/названия
//   Android.iapBuy(productId)                — запустить покупку
//   Android.iapRestore()                     — восстановить покупки
//   Android.adsShowRewarded(placement)       — показать rewarded-видео
//   Android.adsShowInterstitial()            — показать межстраничную
//   Android.adsSetBanner(visible)            — скрыть/показать баннер
//   Android.adsIsRemoved()                   — куплено ли «без рекламы»
//
// Нативные колбэки (их вызывает Java):
//   window.iapOnProducts(json)   — [{id, price, title, owned}]
//   window.iapOnPurchase(json)   — {id, token, ok}
//   window.iapOnError(msg)
//   window.adsOnReward(json)     — {placement, ok}

// ---------- Товары ----------
// consumable: можно купить много раз (золото, паки)
// nonconsumable: один раз навсегда (без рекламы, наборы, подарки)
export const IAP_ITEMS = [
  { id: 'gold_small',  kind: 'consumable',    name: 'Горсть золота',    desc: '25 000 золота',              icons: 'coin',  fallback: '49 ₽', give: { gold: 25000 } },
  { id: 'gold_mid',    kind: 'consumable',    name: 'Мешок золота',     desc: '180 000 золота',             icons: 'coin',  fallback: '199 ₽', give: { gold: 180000 }, bonus: 'лучшая цена' },
  { id: 'gold_big',    kind: 'consumable',    name: 'Сундук золота',    desc: '1 200 000 золота',           icons: 'chest', fallback: '899 ₽', give: { gold: 1200000 }, bonus: '×1.5 бонус' },
  { id: 'starter',     kind: 'nonconsumable', name: 'Набор новобранца', desc: 'Золото + 3 уровня всем постройкам', icons: 'star', fallback: '299 ₽', give: { gold: 60000, allStructLvl: 3 }, once: true },
  { id: 'vip',         kind: 'nonconsumable', name: 'Статус Хранителя', desc: 'Навсегда: +25% золота и +10% урона', icons: 'crown', fallback: '999 ₽', give: { vip: true }, once: true },
  { id: 'noads',       kind: 'nonconsumable', name: 'Без рекламы',      desc: 'Убрать всю рекламу навсегда', icons: 'noads', fallback: '249 ₽', give: { noAds: true }, once: true },
  { id: 'donate_small', kind: 'consumable',   name: 'На чай разработчику', desc: 'Спасибо! Небольшая поддержка', icons: 'heart', fallback: '99 ₽', give: {} },
  { id: 'donate_big',   kind: 'consumable',   name: 'Поддержать проект', desc: 'Большое спасибо за игру!',     icons: 'heart', fallback: '499 ₽', give: {} },
];

// награды за rewarded-видео
export const REWARDED = {
  doubleGold: { id: 'doubleGold', name: '×2 золота',   desc: 'Посмотри видео — удвоим золото за день', amount: (st) => Math.max(500, Math.round((st.gold || 0) * 0.5 + 800)) },
  freePts:    { id: 'freePts',    name: '+1 навык',    desc: 'Посмотри видео — получи очко навыка',    amount: () => 1 },
  goldGift:   { id: 'goldGift',   name: 'Подарок',     desc: 'Посмотри видео — получи золото',         amount: (st) => Math.max(1200, Math.round((st.day || 1) * 300)) },
};

// ---------- Состояние ----------
export const MON = {
  ready: false,          // доступен ли нативный мост
  products: {},          // id -> {price, title, owned}
  pending: null,         // какой товар ждёт результата покупки
  removedAds: false,     // куплено «без рекламы»
  vip: false,
  listeners: [],
  lastError: null,
  adBusy: false,
  rewardCb: null,
  platform: 'web',       // 'web' | 'android'
};

function bridge() { return (typeof window !== 'undefined' && window.Android) ? window.Android : null; }

export function initMonetization(state) {
  MON.platform = bridge() ? 'android' : 'web';
  MON.ready = !!bridge();
  MON.removedAds = !!(state && state.iap && state.iap.noads);
  MON.vip = !!(state && state.iap && state.iap.vip);

  // нативные колбэки
  if (typeof window !== 'undefined') {
    window.iapOnProducts = (json) => {
      try {
        const list = typeof json === 'string' ? JSON.parse(json) : json;
        for (const p of list) MON.products[p.id] = p;
        if (list.length && !MON.productCb) MON.productCb = true;
        emit('products');
      } catch (e) { MON.lastError = 'products parse: ' + e.message; }
    };
    window.iapOnPurchase = (json) => {
      try {
        const d = typeof json === 'string' ? JSON.parse(json) : json;
        handlePurchase(d);
      } catch (e) { MON.lastError = 'purchase parse: ' + e.message; }
    };
    window.iapOnError = (msg) => { MON.lastError = String(msg); MON.pending = null; emit('error'); };
    window.adsOnReward = (json) => {
      MON.adBusy = false;
      let d = {};
      try { d = typeof json === 'string' ? JSON.parse(json) : (json || {}); } catch (e) { d = { ok: false }; }
      const cb = MON.rewardCb; MON.rewardCb = null;
      if (d.ok && cb) cb(d.placement);
      emit('reward', d);
    };
  }

  // запросить товары у натива
  if (MON.ready) {
    try {
      bridge().iapInit();
      bridge().iapProducts(JSON.stringify(IAP_ITEMS.map((i) => i.id)));
      MON.removedAds = MON.removedAds || !!bridge().adsIsRemoved();
      bridge().adsSetBanner(!MON.removedAds);
    } catch (e) { MON.lastError = 'bridge init: ' + e.message; }
  }

  // в браузере — цены-заглушки
  if (!MON.ready) {
    for (const it of IAP_ITEMS) MON.products[it.id] = { id: it.id, price: it.fallback, title: it.name, owned: !!(state && state.iap && state.iap[it.id]) };
  }
  return MON;
}

export function onMonetization(cb) { MON.listeners.push(cb); }
function emit(kind, data) { for (const cb of MON.listeners) { try { cb(kind, data); } catch (e) {} } }

export function priceOf(id) {
  const p = MON.products[id];
  return (p && p.price) ? p.price : (IAP_ITEMS.find((i) => i.id === id) || {}).fallback || '—';
}
export function isOwned(id) {
  const p = MON.products[id];
  return !!(p && p.owned) || !!(MON.ownedCache && MON.ownedCache[id]);
}
export function markOwned(id) {
  MON.ownedCache = MON.ownedCache || {};
  MON.ownedCache[id] = 1;
  if (MON.products[id]) MON.products[id].owned = true;
}

// ---------- Покупка ----------
export function buy(id) {
  const item = IAP_ITEMS.find((i) => i.id === id);
  if (!item) return { ok: false, reason: 'unknown' };
  if (item.once && isOwned(id)) return { ok: false, reason: 'owned' };
  MON.pending = id;
  const b = bridge();
  if (b) {
    try { b.iapBuy(id); return { ok: true, pending: true }; }
    catch (e) { MON.pending = null; MON.lastError = 'buy: ' + e.message; return { ok: false, reason: 'bridge' }; }
  }
  // браузер: эмулируем успех (для тестов UI)
  return { ok: true, pending: false, simulated: true, item };
}

// применяем покупку к состоянию игры
export function handlePurchase(d) {
  const id = d && d.id;
  const item = IAP_ITEMS.find((i) => i.id === id);
  MON.pending = null;
  if (!item) { emit('purchase', { id, ok: false }); return; }

  markOwned(id);
  const g = item.give || {};
  const res = { id, item, effects: [] };

  // золото
  if (g.gold) { MON.giveGold && MON.giveGold(g.gold); res.effects.push('+' + g.gold + ' золота'); }
  // всем постройкам уровень
  if (g.allStructLvl) {
    let n = 0;
    if (MON.structs) for (const s of MON.structs) {
      if (s.lvl < g.allStructLvl) { s.lvl = g.allStructLvl; n++; }
    }
    res.effects.push('постройки до ур.' + g.allStructLvl + ' (' + n + ')');
  }
  // флаги
  if (g.noAds) { MON.removedAds = true; res.effects.push('реклама отключена'); try { bridge() && bridge().adsSetBanner(false); } catch (e) {} }
  if (g.vip) { MON.vip = true; res.effects.push('статус Хранителя'); }
  if (!res.effects.length) res.effects.push('спасибо за поддержку!');

  // consumable → подтвердить у натива, чтобы можно было купить снова
  if (item.kind === 'consumable' && d.token) {
    try { bridge() && bridge().iapConsume(d.token); } catch (e) {}
  }
  MON.persist && MON.persist();
  emit('purchase', { id, ok: true, res });
  return res;
}

export function restore() {
  const b = bridge();
  if (b) { try { b.iapRestore(); return true; } catch (e) { MON.lastError = 'restore: ' + e.message; return false; } }
  return false;
}

// ---------- Реклама ----------
export function adsRemoved() { return !!(MON.removedAds); }

export function showRewarded(placement, onReward) {
  if (adsRemoved()) { if (onReward) onReward(placement); return { ok: true, skipped: true }; }
  if (MON.adBusy) return { ok: false, reason: 'busy' };
  MON.rewardCb = onReward;
  MON.adBusy = true;
  const b = bridge();
  if (b) {
    try { b.adsShowRewarded(placement || 'default'); return { ok: true }; }
    catch (e) { MON.adBusy = false; MON.rewardCb = null; MON.lastError = 'ads: ' + e.message; }
  }
  // браузер: сразу выдаём награду (заглушка для тестов)
  setTimeout(() => { MON.adBusy = false; const cb = MON.rewardCb; MON.rewardCb = null; if (cb) cb(placement); }, 300);
  return { ok: true, simulated: true };
}

export function showInterstitial() {
  if (adsRemoved()) return false;
  const b = bridge();
  if (b) { try { b.adsShowInterstitial(); return true; } catch (e) { MON.lastError = 'inter: ' + e.message; } }
  return false;
}

export function setBanner(visible) {
  if (adsRemoved()) visible = false;
  const b = bridge();
  if (b) { try { b.adsSetBanner(!!visible); return true; } catch (e) { MON.lastError = 'banner: ' + e.message; } }
  return false;
}

export function isAndroid() { return MON.platform === 'android'; }
