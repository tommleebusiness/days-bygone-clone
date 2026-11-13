package com.tommlee.daysbygone;

import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;

import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.AdSize;
import com.google.android.gms.ads.AdView;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.interstitial.InterstitialAd;
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback;
import com.google.android.gms.ads.rewarded.RewardedAd;
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback;

/**
 * Реклама AdMob: баннер, межстраничная, rewarded-видео.
 *
 * ⚠️ ТЕСТОВЫЕ ID (сейчас активны — безопасно, пока не в проде):
 *   app id      : ca-app-pub-3940256099942544~3347511713
 *   banner      : ca-app-pub-3940256099942544/6300978111
 *   interstitial: ca-app-pub-3940256099942544/1033173712
 *   rewarded    : ca-app-pub-3940256099942544/5224354917
 * Когда появятся свои ID — замени константы ниже и android:value в AndroidManifest.
 */
public class AdsManager {

    private static final String TAG = "DaysBygoneAds";

    // ==== замени на свои ID перед публикацией ====
    private static final String UNIT_BANNER       = "ca-app-pub-3940256099942544/6300978111";
    private static final String UNIT_INTERSTITIAL = "ca-app-pub-3940256099942544/1033173712";
    private static final String UNIT_REWARDED     = "ca-app-pub-3940256099942544/5224354917";

    private static final String PREFS = "daysbygone_iap";
    private static final String KEY_NOADS = "noads";

    private final Activity activity;
    private FrameLayout bannerWrap;
    private AdView banner;
    private InterstitialAd interstitial;
    private RewardedAd rewarded;
    private boolean initialized = false;
    private boolean rewardedLoading = false;
    private String pendingPlacement = null;

    public AdsManager(Activity a, ViewGroup root) {
        this.activity = a;
        createBannerWrapper(root);
    }

    public static boolean isAdsRemovedFromPrefs() {
        SharedPreferences sp = com.tommlee.daysbygone.MainActivity.appContext()
                .getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        return sp.getBoolean(KEY_NOADS, false);
    }

    public static void setAdsRemoved(boolean removed) {
        MainActivity.appContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit().putBoolean(KEY_NOADS, removed).apply();
    }

    private void createBannerWrapper(ViewGroup root) {
        bannerWrap = new FrameLayout(activity);
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
                Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL);
        bannerWrap.setLayoutParams(lp);
        bannerWrap.setVisibility(View.GONE);
        root.addView(bannerWrap);
    }

    public void init() {
        if (initialized) return;
        initialized = true;
        MobileAds.initialize(activity, s -> {
            Log.d(TAG, "ads initialized");
            loadInterstitial();
            loadRewarded();
        });
    }

    // ---------- баннер ----------
    public void setBanner(final boolean visible) {
        if (!initialized) init();
        if (isAdsRemovedFromPrefs()) {
            activity.runOnUiThread(() -> { if (bannerWrap != null) bannerWrap.setVisibility(View.GONE); });
            return;
        }
        activity.runOnUiThread(() -> {
            if (bannerWrap == null) return;
            if (!visible) { bannerWrap.setVisibility(View.GONE); return; }
            if (banner == null) {
                banner = new AdView(activity);
                banner.setAdUnitId(UNIT_BANNER);
                banner.setAdSize(bannerAdSize());
                bannerWrap.addView(banner, new FrameLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.WRAP_CONTENT));
                banner.loadAd(new AdRequest.Builder().build());
            }
            bannerWrap.setVisibility(View.VISIBLE);
        });
    }

    private AdSize bannerAdSize() {
        int w = activity.getResources().getDisplayMetrics().widthPixels;
        int dp = (int) (w / activity.getResources().getDisplayMetrics().density);
        return AdSize.getCurrentOrientationAnchoredAdaptiveBannerAdSize(activity, dp);
    }

    // ---------- межстраничная ----------
    private void loadInterstitial() {
        if (isAdsRemovedFromPrefs()) return;
        InterstitialAd.load(activity, UNIT_INTERSTITIAL, new AdRequest.Builder().build(),
                new InterstitialAdLoadCallback() {
                    @Override public void onAdLoaded(InterstitialAd ad) {
                        interstitial = ad;
                        ad.setFullScreenContentCallback(new FullScreenContentCallback() {
                            @Override public void onAdDismissedFullScreenContent() {
                                interstitial = null;
                                loadInterstitial();
                            }
                            @Override public void onAdFailedToShowFullScreenContent(AdError e) {
                                interstitial = null;
                            }
                        });
                    }
                    @Override public void onAdFailedToLoad(LoadAdError e) {
                        Log.w(TAG, "interstitial failed: " + e.getMessage());
                        interstitial = null;
                    }
                });
    }

    public void showInterstitial() {
        if (isAdsRemovedFromPrefs()) return;
        if (interstitial == null) { loadInterstitial(); return; }
        activity.runOnUiThread(() -> interstitial.show(activity));
    }

    // ---------- rewarded ----------
    private void loadRewarded() {
        if (rewardedLoading) return;
        rewardedLoading = true;
        RewardedAd.load(activity, UNIT_REWARDED, new AdRequest.Builder().build(),
                new RewardedAdLoadCallback() {
                    @Override public void onAdLoaded(RewardedAd ad) {
                        rewardedLoading = false;
                        rewarded = ad;
                        ad.setFullScreenContentCallback(new FullScreenContentCallback() {
                            @Override public void onAdDismissedFullScreenContent() {
                                rewarded = null;
                                loadRewarded();
                            }
                            @Override public void onAdFailedToShowFullScreenContent(AdError e) {
                                rewarded = null;
                                String p = pendingPlacement == null ? "default" : pendingPlacement;
                                pendingPlacement = null;
                                IapBridge.reward("{\"ok\":false,\"placement\":\"" + p + "\"}");
                            }
                        });
                    }
                    @Override public void onAdFailedToLoad(LoadAdError e) {
                        rewardedLoading = false;
                        Log.w(TAG, "rewarded failed: " + e.getMessage());
                        rewarded = null;
                    }
                });
    }

    public void showRewarded(final String placement) {
        if (isAdsRemovedFromPrefs()) {
            // рекламу убрали — награду всё равно выдаём
            IapBridge.reward("{\"ok\":true,\"placement\":\"" + placement + "\",\"noads\":true}");
            return;
        }
        if (rewarded == null) {
            pendingPlacement = placement;
            loadRewarded();
            IapBridge.reward("{\"ok\":false,\"placement\":\"" + placement + "\",\"reason\":\"loading\"}");
            return;
        }
        pendingPlacement = placement;
        activity.runOnUiThread(() -> rewarded.show(activity, rewardItem -> {
            IapBridge.reward("{\"ok\":true,\"placement\":\"" + placement + "\",\"amount\":" + rewardItem.getAmount() + "}");
            pendingPlacement = null;
        }));
    }

    public void destroy() {
        activity.runOnUiThread(() -> {
            if (banner != null) { banner.destroy(); banner = null; }
        });
        interstitial = null;
        rewarded = null;
    }
}
