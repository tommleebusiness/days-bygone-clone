// ContentView.swift — обёртка игры «Дни Минувшие» для iOS (WKWebView).
// Заменяет автогенерируемый ContentView.swift в SwiftUI-проекте.
//
// Файлы, которые нужно добавить в target приложения:
//   ContentView.swift   (этот файл)
//   StoreKitManager.swift
//   AdsManagerIOS.swift
//   BridgeShim.js       (ресурс, Add to target: YES)
//   DaysBygoneApp.swift
//   папка game/         ← «Create folder references» (СИНЯЯ папка), НЕ groups
//
// ⚠️ Почему folder references: игра грузится через loadFileURL(allowingReadAccessTo:),
// папка должна сохранить структуру (vendor/, fx/, assets/) на диске.

import SwiftUI
import WebKit

struct ContentView: View {
    var body: some View {
        GameWebView()
            .ignoresSafeArea(.all)
            .statusBarHidden(true)
            .preferredColorScheme(.dark)
    }
}

/// WKWebView с мостами покупок и рекламы.
final class GameWebView: UIViewRepresentable {

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()

        let prefs = WKWebpagePreferences()
        prefs.allowsContentJavaScript = true
        config.defaultWebpagePreferences = prefs

        // музыка/звук в игре — без обязательного жеста
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []

        let controller = WKUserContentController()
        config.userContentController = controller   // без этого скрипты и мосты не подключатся

        // --- ВАЖНО: шим window.Android ДО выполнения кода игры ---
        // Игра зовёт window.Android.*, а в WKWebView мост через messageHandlers.
        if let shimURL = Bundle.main.url(forResource: "BridgeShim", withExtension: "js"),
           let shimSrc = try? String(contentsOf: shimURL, encoding: .utf8) {
            let noAds = UserDefaults.standard.bool(forKey: "noads")
            let js = shimSrc.replacingOccurrences(of: "__NO_ADS__", with: noAds ? "true" : "false")
            controller.addUserScript(WKUserScript(source: js,
                                                  injectionTime: .atDocumentStart,
                                                  forMainFrameOnly: true))
        }

        let web = WKWebView(frame: .zero, configuration: config)
        web.isOpaque = false
        web.backgroundColor = UIColor(red: 0.05, green: 0.04, blue: 0.03, alpha: 1)
        web.scrollView.isScrollEnabled = false
        web.scrollView.bounces = false
        web.scrollView.pinchGestureRecognizer?.isEnabled = false
        web.allowsBackForwardNavigationGestures = false
        if #available(iOS 16.4, *) { web.isInspectable = true }   // отладка по Safari
        context.coordinator.webView = web

        // --- подключаем нативные менеджеры ---
        StoreKitManager.shared.attach(web)
        AdsManagerIOS.shared.attach(web, hostView: web)

        // --- обработчики сообщений из JS ---
        controller.add(BridgeHandler(webView: web), name: "iap")
        controller.add(BridgeHandler(webView: web), name: "ads")

        loadGame(into: web)
        return web
    }

    func updateUIView(_ uiView: WKWebView, context: Context) { }

    func makeCoordinator() -> Coordinator { Coordinator() }
    final class Coordinator { weak var webView: WKWebView? }

    /// Грузим index.html из папки game/ внутри bundle.
    private func loadGame(into web: WKWebView) {
        guard let dir = Bundle.main.url(forResource: "game", withExtension: nil) else {
            web.loadHTMLString("<h1 style='color:#fff;font-family:-apple-system'>Папка game/ не найдена в bundle</h1>", baseURL: nil)
            return
        }
        let index = dir.appendingPathComponent("index.html")
        web.loadFileURL(index, allowingReadAccessTo: dir)
    }
}

/// Приём сообщений из BridgeShim.js.
final class BridgeHandler: NSObject, WKScriptMessageHandler {

    weak var webView: WKWebView?
    init(webView: WKWebView) { self.webView = webView; super.init() }

    func userContentController(_ ucc: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any],
              let action = body["action"] as? String else { return }

        switch message.name {
        case "iap":
            handleIAP(action: action, body: body)
        case "ads":
            handleAds(action: action, body: body)
        default:
            break
        }
    }

    private func handleIAP(action: String, body: [String: Any]) {
        Task { @MainActor in
            switch action {
            case "init":
                await StoreKitManager.shared.loadProducts(ids: StoreKitManager.productIds)
            case "products":
                // игра присылает свой список ID — используем объединение с нашим
                await StoreKitManager.shared.loadProducts(ids: StoreKitManager.productIds)
            case "buy":
                if let id = body["id"] as? String { await StoreKitManager.shared.buy(id) }
            case "restore":
                await StoreKitManager.shared.restore()
            case "consume":
                // StoreKit 2 закрывает расходуемые автоматически при finish()
                break
            default:
                break
            }
        }
    }

    private func handleAds(action: String, body: [String: Any]) {
        switch action {
        case "init":
            break   // SDK инициализируется в attach()
        case "rewarded":
            AdsManagerIOS.shared.showRewarded((body["placement"] as? String) ?? "default")
        case "interstitial":
            AdsManagerIOS.shared.showInterstitial()
        case "banner":
            AdsManagerIOS.shared.setBanner((body["visible"] as? Bool) ?? true)
        default:
            break
        }
    }
}

// Удобный вызов JS из нативных менеджеров (всегда в main-очереди).
extension WKWebView {
    func eval(_ js: String) {
        DispatchQueue.main.async {
            self.evaluateJavaScript(js, completionHandler: nil)
        }
    }
}
