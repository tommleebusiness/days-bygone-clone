// StoreKitManager.swift — покупки на iOS через StoreKit 2.
// Отдаёт результаты в JS теми же колбэками, что и Android-мост:
//   iapOnProducts(json), iapOnPurchase(json), iapOnError(msg)
//
// ⚠️ Product ID должны совпадать с Android и с таблицей в store-listing.md.

import Foundation
import StoreKit
import WebKit

final class StoreKitManager {

    static let shared = StoreKitManager()

    /// Те же ID, что в Google Play Console.
    static let productIds: [String] = [
        "gold_small", "gold_mid", "gold_big",
        "donate_small", "donate_big",
        "starter", "vip", "noads"
    ]

    /// Расходуемые товары: после покупки нужно finish(), чтобы можно было купить снова.
    static let consumableIds: Set<String> = ["gold_small", "gold_mid", "gold_big", "donate_small", "donate_big"]

    private var products: [String: Product] = [:]
    private weak var webView: WKWebView?
    private var listenerTask: Task<Void, Never>?

    private init() { }

    func attach(_ webView: WKWebView) {
        self.webView = webView
        startTransactionListener()
    }

    // MARK: - транзакции, пришедшие вне потока покупки (продления/восстановление)
    private func startTransactionListener() {
        listenerTask?.cancel()
        listenerTask = Task.detached { [weak self] in
            for await update in Transaction.updates {
                guard let self else { return }
                if case .verified(let tx) = update {
                    await self.deliver(tx)
                    await tx.finish()
                }
            }
        }
    }

    // MARK: - запрос товаров
    func loadProducts(ids: [String]) async {
        do {
            let list = try await Product.products(for: ids)
            var out: [[String: Any]] = []
            for p in list {
                products[p.id] = p
                out.append([
                    "id": p.id,
                    "title": p.displayName,
                    "price": p.displayPrice,
                    "owned": isOwned(p.id)
                ])
            }
            sendProducts(out)
        } catch {
            sendError("products: \(error.localizedDescription)")
        }
    }

    // MARK: - покупка
    func buy(_ productId: String) async {
        guard let product = products[productId] else {
            // товар не загружен — подтягиваем и пробуем ещё раз
            await loadProducts(ids: [productId])
            guard let p2 = products[productId] else {
                sendError("product not loaded: \(productId)")
                return
            }
            await purchase(p2)
            return
        }
        await purchase(product)
    }

    private func purchase(_ product: Product) async {
        do {
            let result = try await product.purchase()
            switch result {
            case .success(let verification):
                if case .verified(let tx) = verification {
                    await deliver(tx)
                    // расходуемые закрываем сразу, невозвратные оставляем открытыми
                    if Self.consumableIds.contains(product.id) { await tx.finish() }
                } else {
                    sendError("unverified transaction")
                }
            case .userCancelled:
                sendError("cancelled")
            case .pending:
                sendError("pending")
            @unknown default:
                sendError("unknown purchase result")
            }
        } catch {
            sendError("purchase: \(error.localizedDescription)")
        }
    }

    // MARK: - восстановление
    func restore() async {
        do {
            try await AppStore.sync()
        } catch {
            sendError("restore: \(error.localizedDescription)")
        }
        var restored: [[String: Any]] = []
        for await result in Transaction.currentEntitlements {
            if case .verified(let tx) = result {
                restored.append(["id": tx.productID, "token": String(tx.id), "ok": true, "restored": true])
            }
        }
        for r in restored { sendPurchase(r) }
        if restored.isEmpty { sendProducts(currentProductsPayload()) }
    }

    // MARK: - выдача награды
    private func deliver(_ tx: Transaction) async {
        sendPurchase([
            "id": tx.productID,
            "token": String(tx.id),
            "ok": true
        ])
        if tx.productID == "noads" {
            UserDefaults.standard.set(true, forKey: "noads")
        }
    }

    func isOwned(_ productId: String) -> Bool {
        if productId == "noads" { return UserDefaults.standard.bool(forKey: "noads") }
        return false
    }

    private func currentProductsPayload() -> [[String: Any]] {
        products.values.map {
            ["id": $0.id, "title": $0.displayName, "price": $0.displayPrice, "owned": isOwned($0.id)]
        }
    }

    // MARK: - мост в JS
    private func sendProducts(_ list: [[String: Any]]) {
        guard let json = Self.encode(list) else { return }
        webView?.eval("window.iapOnProducts && window.iapOnProducts(\(Self.jsString(json)))")
    }
    private func sendPurchase(_ d: [String: Any]) {
        guard let json = Self.encode(d) else { return }
        webView?.eval("window.iapOnPurchase && window.iapOnPurchase(\(Self.jsString(json)))")
    }
    private func sendError(_ msg: String) {
        webView?.eval("window.iapOnError && window.iapOnError(\(Self.jsString(msg)))")
    }

    static func encode(_ obj: Any) -> String? {
        guard let data = try? JSONSerialization.data(withJSONObject: obj) else { return nil }
        return String(data: data, encoding: .utf8)
    }

    /// Экранирование строки для вставки в JS-литерал.
    static func jsString(_ s: String) -> String {
        var out = "'"
        for ch in s {
            switch ch {
            case "'": out += "\\'"
            case "\\": out += "\\\\"
            case "\n": out += "\\n"
            case "\r": out += "\\r"
            default: out.append(ch)
            }
        }
        return out + "'"
    }
}
