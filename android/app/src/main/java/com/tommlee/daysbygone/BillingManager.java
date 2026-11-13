package com.tommlee.daysbygone;

import android.app.Activity;
import android.util.Log;

import androidx.annotation.NonNull;

import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.ConsumeParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Обёртка Google Play Billing.
 * Все результаты отдаются в JS через IapBridge.
 *
 * ⚠️ ПЕРЕД ПУБЛИКАЦИЕЙ: productId должны совпадать с товарами, созданными
 * в Google Play Console (Монетизация → Товары в приложении).
 */
public class BillingManager implements PurchasesUpdatedListener, BillingClientStateListener {

    private static final String TAG = "DaysBygoneBilling";

    // ==== ID товаров: создай такие же в Play Console ====
    public static final Set<String> PRODUCT_IDS = new HashSet<>();
    static {
        // расходуемые (можно купить многократно)
        PRODUCT_IDS.add("gold_small");
        PRODUCT_IDS.add("gold_mid");
        PRODUCT_IDS.add("gold_big");
        PRODUCT_IDS.add("donate_small");
        PRODUCT_IDS.add("donate_big");
        // невозвратные (покупаются один раз)
        PRODUCT_IDS.add("starter");
        PRODUCT_IDS.add("vip");
        PRODUCT_IDS.add("noads");
    }

    private final Activity activity;
    private BillingClient client;
    private final Map<String, ProductDetails> details = new HashMap<>();
    private boolean connected = false;

    public BillingManager(Activity a) {
        this.activity = a;
    }

    public void start() {
        client = BillingClient.newBuilder(activity)
                .setListener(this)
                .enablePendingPurchases()
                .build();
        connect();
    }

    private void connect() {
        if (client == null) return;
        client.startConnection(this);
    }

    @Override
    public void onBillingSetupFinished(@NonNull BillingResult r) {
        if (r.getResponseCode() == BillingClient.BillingResponseCode.OK) {
            connected = true;
            Log.d(TAG, "billing ready");
            queryProducts();
            queryOwned();
        } else {
            connected = false;
            Log.w(TAG, "billing setup failed: " + r.getDebugMessage());
            IapBridge.error("billing setup: " + r.getResponseCode() + " " + r.getDebugMessage());
        }
    }

    @Override
    public void onBillingServiceDisconnected() {
        connected = false;
        Log.w(TAG, "billing disconnected");
    }

    /** Запрос цен и названий для UI. */
    public void queryProducts() {
        if (client == null) { IapBridge.error("billing not started"); return; }
        List<QueryProductDetailsParams.Product> list = new ArrayList<>();
        for (String id : PRODUCT_IDS) {
            list.add(QueryProductDetailsParams.Product.newBuilder()
                    .setProductId(id)
                    .setProductType(BillingClient.ProductType.INAPP)
                    .build());
        }
        QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder()
                .setProductList(list)
                .build();

        client.queryProductDetailsAsync(params, (result, productDetailsList) -> {
            JSONArray arr = new JSONArray();
            if (result.getResponseCode() == BillingClient.BillingResponseCode.OK && productDetailsList != null) {
                for (ProductDetails d : productDetailsList) {
                    details.put(d.getProductId(), d);
                    JSONObject o = new JSONObject();
                    try {
                        o.put("id", d.getProductId());
                        o.put("title", d.getName());
                        o.put("owned", false);
                        String price = "—";
                        ProductDetails.OneTimePurchaseOfferDetails od = d.getOneTimePurchaseOfferDetails();
                        if (od != null && od.getFormattedPrice() != null) price = od.getFormattedPrice();
                        o.put("price", price);
                    } catch (JSONException e) { /* пропускаем битый товар */ }
                    arr.put(o);
                }
            } else {
                Log.w(TAG, "queryProducts: " + result.getResponseCode());
            }
            IapBridge.products(arr.toString());
        });
    }

    /** Восстановление уже купленных товаров. */
    public void queryOwned() {
        if (client == null) return;
        QueryPurchasesParams p = QueryPurchasesParams.newBuilder()
                .setProductType(BillingClient.ProductType.INAPP)
                .build();
        client.queryPurchasesAsync(p, (result, purchases) -> {
            if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) return;
            for (Purchase pur : purchases) {
                for (String id : pur.getProducts()) {
                    JSONObject o = new JSONObject();
                    try {
                        o.put("id", id);
                        o.put("token", pur.getPurchaseToken());
                        o.put("ok", true);
                        o.put("restored", true);
                    } catch (JSONException e) { }
                    IapBridge.purchase(o.toString());
                    // невозвратные нужно подтвердить, если ещё не подтверждены
                    if (!pur.isAcknowledged()) acknowledge(pur.getPurchaseToken());
                }
            }
        });
    }

    /** Запуск покупки. */
    public void buy(String productId) {
        if (client == null || !connected) { IapBridge.error("billing not connected"); return; }
        ProductDetails d = details.get(productId);
        if (d == null) {
            // товар не пришёл в queryProductDetails — пробуем обновить список
            queryProducts();
            IapBridge.error("product not loaded: " + productId);
            return;
        }
        BillingFlowParams.ProductDetailsParams pp = BillingFlowParams.ProductDetailsParams.newBuilder()
                .setProductDetails(d)
                .build();
        BillingFlowParams flow = BillingFlowParams.newBuilder()
                .setProductDetailsParamsList(java.util.Collections.singletonList(pp))
                .build();
        BillingResult r = client.launchBillingFlow(activity, flow);
        if (r.getResponseCode() != BillingClient.BillingResponseCode.OK) {
            IapBridge.error("launch: " + r.getResponseCode() + " " + r.getDebugMessage());
        }
    }

    @Override
    public void onPurchasesUpdated(@NonNull BillingResult r, List<Purchase> purchases) {
        if (r.getResponseCode() == BillingClient.BillingResponseCode.OK && purchases != null) {
            for (Purchase p : purchases) handlePurchase(p);
        } else if (r.getResponseCode() == BillingClient.BillingResponseCode.USER_CANCELED) {
            IapBridge.error("cancelled");
        } else {
            IapBridge.error("purchase: " + r.getResponseCode() + " " + r.getDebugMessage());
        }
    }

    private void handlePurchase(Purchase p) {
        for (String id : p.getProducts()) {
            JSONObject o = new JSONObject();
            try {
                o.put("id", id);
                o.put("token", p.getPurchaseToken());
                o.put("ok", true);
            } catch (JSONException e) { }
            IapBridge.purchase(o.toString());
        }
        if (!p.isAcknowledged()) acknowledge(p.getPurchaseToken());
    }

    private void acknowledge(String token) {
        AcknowledgePurchaseParams params = AcknowledgePurchaseParams.newBuilder()
                .setPurchaseToken(token)
                .build();
        client.acknowledgePurchase(params, res -> {
            if (res.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                Log.w(TAG, "ack failed: " + res.getResponseCode());
            }
        });
    }

    /** Расходуемый товар: подтверждаем расход, чтобы можно было купить снова. */
    public void consume(String token) {
        if (client == null) return;
        ConsumeParams params = ConsumeParams.newBuilder().setPurchaseToken(token).build();
        client.consumeAsync(params, (res, t) -> {
            if (res.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                Log.w(TAG, "consume failed: " + res.getResponseCode());
            }
        });
    }

    public boolean isReady() { return connected; }

    public void destroy() {
        try { if (client != null) client.endConnection(); } catch (Exception e) { }
        client = null;
    }
}
