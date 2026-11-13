// AdsManagerIOS.swift — реклама на iOS через Google Mobile Ads SDK.
// Подключение SDK: Xcode → File → Add Package Dependencies →
//   https://github.com/googleads/swift-package-manager-google-mobile-ads
//   (продукт: GoogleMobileAds)
//
// ⚠️ ТЕСТОВЫЕ ID (безопасны, пока не в проде). Замени на свои из AdMob:
//   app id       : ca-app-pub-3940256099942544~1458002511
//   banner       : ca-app-pub-3940256099942544/2934735716
//   interstitial : ca-app-pub-3940256099942544/4411468910
//   rewarded     : ca-app-pub-3940256099942544/1712485313

import UIKit
import GoogleMobileAds
import AppTrackingTransparency
import WebKit

final class AdsManagerIOS: NSObject {

    static let shared = AdsManagerIOS()

    // ==== замени на свои ID перед публикацией ====
    private let unitBanner = "ca-app-pub-3940256099942544/2934735716"
    private let unitInterstitial = "ca-app-pub-3940256099942544/4411468910"
    private let unitRewarded = "ca-app-pub-3940256099942544/1712485313"

    private weak var webView: WKWebView?
    private var bannerView: BannerView?
    private var interstitial: InterstitialAd?
    private var rewarded: RewardedAd?
    private var bannerContainer: UIView?
    private var pendingPlacement: String?

    private var adsRemoved: Bool {
        UserDefaults.standard.bool(forKey: "noads")
    }

    private override init() { super.init() }

    func attach(_ webView: WKWebView, hostView: UIView) {
        self.webView = webView
        setupBannerContainer(hostView)
        MobileAds.shared.start { _ in
            self.loadInterstitial()
            self.loadRewarded()
        }
        // ATT-запрос (нужен для персонализированной рекламы на iOS 14+)
        if #available(iOS 14, *) {
            ATTrackingManager.requestTrackingAuthorization { _ in }
        }
    }

    private func setupBannerContainer(_ host: UIView) {
        let c = UIView()
        c.translatesAutoresizingMaskIntoConstraints = false
        c.isHidden = true
        host.addSubview(c)
        NSLayoutConstraint.activate([
            c.leadingAnchor.constraint(equalTo: host.leadingAnchor),
            c.trailingAnchor.constraint(equalTo: host.trailingAnchor),
            c.bottomAnchor.constraint(equalTo: host.safeAreaLayoutGuide.bottomAnchor),
            c.heightAnchor.constraint(equalToConstant: 50)
        ])
        bannerContainer = c
    }

    // MARK: - баннер
    func setBanner(_ visible: Bool) {
        guard !adsRemoved else {
            DispatchQueue.main.async { self.bannerContainer?.isHidden = true }
            return
        }
        DispatchQueue.main.async {
            guard let container = self.bannerContainer else { return }
            if visible {
                if self.bannerView == nil {
                    let b = BannerView(adSize: AdSizeBanner)
                    b.adUnitID = self.unitBanner
                    b.rootViewController = self.webView?.window?.rootViewController
                    b.translatesAutoresizingMaskIntoConstraints = false
                    container.addSubview(b)
                    NSLayoutConstraint.activate([
                        b.centerXAnchor.constraint(equalTo: container.centerXAnchor),
                        b.centerYAnchor.constraint(equalTo: container.centerYAnchor)
                    ])
                    b.load(Request())
                    self.bannerView = b
                }
                container.isHidden = false
            } else {
                container.isHidden = true
            }
        }
    }

    // MARK: - межстраничная
    private func loadInterstitial() {
        guard !adsRemoved else { return }
        InterstitialAd.load(with: unitInterstitial, request: Request()) { [weak self] ad, error in
            guard let self else { return }
            if let ad {
                self.interstitial = ad
                ad.fullScreenContentDelegate = self
            } else if let error {
                print("[ads] interstitial: \(error.localizedDescription)")
            }
        }
    }

    func showInterstitial() {
        guard !adsRemoved, let ad = interstitial else { loadInterstitial(); return }
        DispatchQueue.main.async {
            ad.present(from: self.webView?.window?.rootViewController)
        }
    }

    // MARK: - rewarded
    private func loadRewarded() {
        RewardedAd.load(with: unitRewarded, request: Request()) { [weak self] ad, error in
            guard let self else { return }
            if let ad {
                self.rewarded = ad
                ad.fullScreenContentDelegate = self
            } else if let error {
                print("[ads] rewarded: \(error.localizedDescription)")
            }
        }
    }

    func showRewarded(_ placement: String) {
        if adsRemoved {
            // рекламу убрали покупкой — награду всё равно выдаём
            sendReward(placement, ok: true)
            return
        }
        guard let ad = rewarded else {
            pendingPlacement = placement
            loadRewarded()
            sendReward(placement, ok: false)
            return
        }
        pendingPlacement = placement
        DispatchQueue.main.async {
            ad.present(from: self.webView?.window?.rootViewController) { [weak self] in
                self?.sendReward(placement, ok: true)
            }
        }
    }

    private func sendReward(_ placement: String, ok: Bool) {
        let payload: [String: Any] = ["ok": ok, "placement": placement]
        guard let json = StoreKitManager.encode(payload) else { return }
        webView?.eval("window.adsOnReward && window.adsOnReward(\(StoreKitManager.jsString(json)))")
    }
}

extension AdsManagerIOS: FullScreenContentDelegate {
    func adDidDismissFullScreenContent(_ ad: FullScreenPresentingAd) {
        if ad is InterstitialAd { interstitial = nil; loadInterstitial() }
        if ad is RewardedAd { rewarded = nil; loadRewarded() }
    }
    func ad(_ ad: FullScreenPresentingAd, didFailToPresentFullScreenContentWithError error: Error) {
        print("[ads] present failed: \(error.localizedDescription)")
        if let p = pendingPlacement {
            sendReward(p, ok: false)
            pendingPlacement = nil
        }
    }
}
