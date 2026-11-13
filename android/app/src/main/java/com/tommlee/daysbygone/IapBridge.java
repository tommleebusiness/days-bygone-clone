package com.tommlee.daysbygone;

import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

/**
 * Мост между JS-игрой и нативным слоем (биллинг + реклама).
 * JS вызывает методы этого класса через window.Android.<method>().
 */
public class IapBridge {

    private static final String TAG = "DaysBygoneBridge";
    private static final Handler MAIN = new Handler(Looper.getMainLooper());
    private static WebView webRef;
    private static BillingManager billing;
    private static AdsManager ads;

    public static void attach(WebView web) { webRef = web; }
    public static void setBilling(BillingManager b) { billing = b; }
    public static void setAds(AdsManager a) { ads = a; }

    // ---------- вызовы в JS ----------
    private static void callJs(final String fn, final String arg) {
        if (webRef == null) return;
        MAIN.post(() -> {
            if (webRef == null) return;
            String js = "window." + fn + " && window." + fn + "(" + jsStr(arg) + ")";
            try { webRef.evaluateJavascript(js, null); }
            catch (Exception e) { Log.w(TAG, "evaluate: " + e.getMessage()); }
        });
    }

    private static String jsStr(String s) {
        if (s == null) return "''";
        StringBuilder sb = new StringBuilder("'");
        for (char c : s.toCharArray()) {
            switch (c) {
                case '\'': sb.append("\\'"); break;
                case '\\': sb.append("\\\\"); break;
                case '\n': sb.append("\\n"); break;
                case '\r': sb.append("\\r"); break;
                default: sb.append(c);
            }
        }
        return sb.append("'").toString();
    }

    public static void products(String json) { callJs("iapOnProducts", json); }
    public static void purchase(String json) { callJs("iapOnPurchase", json); }
    public static void error(String msg) { callJs("iapOnError", msg); }
    public static void reward(String json) { callJs("adsOnReward", json); }

    // ---------- методы, вызываемые из JS ----------

    @JavascriptInterface
    public void iapInit() {
        if (billing != null) MAIN.post(() -> billing.start());
    }

    @JavascriptInterface
    public void iapProducts(String jsonIds) {
        if (billing != null) MAIN.post(billing::queryProducts);
    }

    @JavascriptInterface
    public void iapBuy(String productId) {
        if (billing != null) MAIN.post(() -> billing.buy(productId));
        else error("billing unavailable");
    }

    @JavascriptInterface
    public void iapRestore() {
        if (billing != null) MAIN.post(billing::queryOwned);
        else error("billing unavailable");
    }

    @JavascriptInterface
    public void iapConsume(String token) {
        if (billing != null) MAIN.post(() -> billing.consume(token));
    }

    @JavascriptInterface
    public void adsInit() {
        if (ads != null) MAIN.post(ads::init);
    }

    @JavascriptInterface
    public void adsShowRewarded(String placement) {
        if (ads != null) MAIN.post(() -> ads.showRewarded(placement));
        else reward("{\"ok\":false,\"placement\":\"" + placement + "\"}");
    }

    @JavascriptInterface
    public void adsShowInterstitial() {
        if (ads != null) MAIN.post(ads::showInterstitial);
    }

    @JavascriptInterface
    public void adsSetBanner(boolean visible) {
        if (ads != null) MAIN.post(() -> ads.setBanner(visible));
    }

    @JavascriptInterface
    public boolean adsIsRemoved() {
        // в JS нет локального состояния — читаем из SharedPreferences игры
        return AdsManager.isAdsRemovedFromPrefs();
    }

    @JavascriptInterface
    public String platform() { return "android"; }
}
