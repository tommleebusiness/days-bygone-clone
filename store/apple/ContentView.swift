// ContentView.swift — обёртка игры «Дни Минувшие» для iOS (WKWebView)
// Кладётся в SwiftUI-проект Xcode, заменяя автогенерируемый ContentView.swift.
//
// Игра живёт в папке game/ внутри bundle. В Xcode добавить её как
// "Create folder references" (синие папки), НЕ как groups.
//
// ⚠️ Для загрузки локальных ES-модулей используется loadFileURL(allowingReadAccessTo:),
// это даёт WKWebView доступ ко всем файлам папки game/.

import SwiftUI
import WebKit

struct ContentView: View {
    var body: some View {
        GameView()
            .ignoresSafeArea(.all)
            .statusBarHidden(true)
    }
}

struct GameView: UIViewRepresentable {
    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()

        // JS включён, localStorage доступен
        let prefs = WKWebpagePreferences()
        prefs.allowsContentJavaScript = true
        config.defaultWebpagePreferences = prefs

        // Разрешаем работу медиа без жеста (музыка в игре)
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.isOpaque = false
        webView.backgroundColor = UIColor(red: 0.05, green: 0.04, blue: 0.03, alpha: 1)
        webView.scrollView.isScrollEnabled = false
        webView.scrollView.bounces = false
        webView.allowsBackForwardNavigationGestures = false
        // отключаем «резинку» и масштабирование
        webView.scrollView.pinchGestureRecognizer?.isEnabled = false

        // Мост для покупок и рекламы
        let bridge = IosBridge(webView: webView)
        config.userContentController.add(bridge, name: "iap")
        config.userContentController.add(bridge, name: "ads")
        context.coordinator.bridge = bridge

        // Папка game внутри bundle
        guard let gameDir = Bundle.main.url(forResource: "game", withExtension: nil) else {
            webView.loadHTMLString("<h1 style='color:white'>game/ не найдена в bundle</h1>", baseURL: nil)
            return webView
        }
        let index = gameDir.appendingPathComponent("index.html")
        webView.loadFileURL(index, allowingReadAccessTo: gameDir)

        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator() }

    class Coordinator {
        var bridge: IosBridge?
    }
}

/// Мост JS ⇄ Swift. JS обращается как window.webkit.messageHandlers.iap.postMessage(...)
/// В JS-игре достаточно заменить `window.Android` на объект-адаптер (см. ниже).
class IosBridge: NSObject, WKScriptMessageHandler {

    weak var webView: WKWebView?

    init(webView: WKWebView) {
        self.webView = webView
        super.init()
    }

    func userContentController(_ userContentController: WKUserContentController,
                               didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any],
              let action = body["action"] as? String else { return }

        switch action {
        case "iapInit":
            eval("window.iapOnProducts && window.iapOnProducts('[]')")
        case "iapBuy":
            if let pid = body["id"] as? String {
                // Здесь вызывается StoreKit 2 (см. StoreKitManager.swift)
                NotificationCenter.default.post(name: .iapPurchaseRequested, object: pid)
            }
        case "adsShowRewarded":
            let placement = (body["placement"] as? String) ?? "default"
            // Заглушка: награда выдаётся сразу. Для реальной рекламы подключить
            // Google Mobile Ads SDK (GADRewardedAd).
            eval("window.adsOnReward && window.adsOnReward('{\"ok\":true,\"placement\":\"\(placement)\"}')")
        default:
            break
        }
    }

    func eval(_ js: String) {
        DispatchQueue.main.async { [weak self] in
            self?.webView?.evaluateJavaScript(js, completionHandler: nil)
        }
    }
}

extension Notification.Name {
    static let iapPurchaseRequested = Notification.Name("iapPurchaseRequested")
}
