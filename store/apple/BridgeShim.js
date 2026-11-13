// BridgeShim.js — инъекция в WKWebView ДО загрузки игры.
// Игра вызывает window.Android.<method>(...), поэтому на iOS мы определяем
// объект с тем же API и пересылаем вызовы в нативные messageHandlers.
// Код игры при этом НЕ меняется.

(function () {
  var noAds = __NO_ADS__;          // подставляется из UserDefaults при сборке скрипта
  var handlers = (window.webkit && window.webkit.messageHandlers) || {};

  function post(name, payload) {
    var h = handlers[name];
    if (!h) return;
    try { h.postMessage(payload); } catch (e) { }
  }

  // Ответы натива приходят как вызовы этих глобальных функций —
  // их вызывает StoreKitManager/AdsManagerIOS через evaluateJavaScript.
  window.iapOnProducts = window.iapOnProducts || function () { };
  window.iapOnPurchase = window.iapOnPurchase || function () { };
  window.iapOnError = window.iapOnError || function () { };
  window.adsOnReward = window.adsOnReward || function () { };

  window.Android = {
    // ---- покупки ----
    iapInit: function () { post('iap', { action: 'init' }); },
    iapProducts: function (idsJson) { post('iap', { action: 'products', ids: idsJson }); },
    iapBuy: function (productId) { post('iap', { action: 'buy', id: productId }); },
    iapRestore: function () { post('iap', { action: 'restore' }); },
    iapConsume: function (token) { post('iap', { action: 'consume', token: token }); },

    // ---- реклама ----
    adsInit: function () { post('ads', { action: 'init' }); },
    adsShowRewarded: function (placement) { post('ads', { action: 'rewarded', placement: placement }); },
    adsShowInterstitial: function () { post('ads', { action: 'interstitial' }); },
    adsSetBanner: function (visible) { post('ads', { action: 'banner', visible: !!visible }); },

    // синхронный ответ: значение впекается при создании скрипта
    adsIsRemoved: function () { return noAds; },

    platform: function () { return 'ios'; }
  };
})();
