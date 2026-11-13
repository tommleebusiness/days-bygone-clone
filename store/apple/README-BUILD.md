# Сборка iOS-версии «Дни Минувшие: Осада»

iOS нельзя собрать из Windows — нужен macOS с Xcode. Но здесь лежит **весь код**,
поэтому на Mac это работа на ~15 минут, без написания кода.

## Что уже готово в этой папке

| Файл | Назначение |
|---|---|
| `ContentView.swift` | WKWebView-обёртка + мосты покупок/рекламы |
| `DaysBygoneApp.swift` | точка входа, блокировка ландшафтной ориентации |
| `StoreKitManager.swift` | покупки (StoreKit 2): товары, покупка, восстановление |
| `AdsManagerIOS.swift` | реклама (AdMob iOS): баннер, межстраничная, rewarded |
| `BridgeShim.js` | JS-шим: даёт игре привычный `window.Android.*` |
| `Info.plist` | ориентации, ATT, AdMob App ID, SKAdNetwork |
| `Assets.xcassets/` | каталог иконок с AppIcon 1024×1024 |
| `screenshots/` | скриншоты нужных размеров для App Store |

## Шаги на Mac

### 1. Создать проект
Xcode → **File → New → Project… → iOS → App**

- Product Name: `Дни Минувшие`
- Bundle Identifier: `com.tommlee.daysbygone`
- Interface: **SwiftUI**, Language: **Swift**
- Minimum Deployments: **iOS 15.0** (StoreKit 2)

### 2. Добавить исходники
Удалить автогенерируемый `ContentView.swift` и `<Имя>App.swift`,
затем перетащить в проект из этой папки:

```
ContentView.swift
DaysBygoneApp.swift
StoreKitManager.swift
AdsManagerIOS.swift
BridgeShim.js          ← обязательно: Target Membership = YES
```

### 3. Добавить игру
Перетащить папку `days-bygone-clone/game` в проект.

⚠️ В диалоге выбрать **«Create folder references»** (папка станет **синей**),
а НЕ «Create groups». Иначе `vendor/`, `fx/`, `assets/` потеряют структуру
и ES-модули не загрузятся — игра откроется, но кнопки не будут работать.

Проверка после импорта: в Project → Build Phases → Copy Bundle Resources
должна быть запись `game` (одна, синяя), а не сотня отдельных `.js`.

### 4. Подключить SDK рекламы
**File → Add Package Dependencies…**
```
https://github.com/googleads/swift-package-manager-google-mobile-ads
```
Продукт: **GoogleMobileAds** → Add to target.

### 5. Заменить Info.plist
Скопировать значения из `Info.plist` этой папки в Info.plist проекта
(или заменить файл целиком, сохранив `$(PRODUCT_BUNDLE_IDENTIFIER)`).

Проверить, что есть:
- `UISupportedInterfaceOrientations` = только Landscape Left/Right
- `GADApplicationIdentifier` = ваш AdMob App ID (сейчас тестовый)
- `NSUserTrackingUsageDescription`

### 6. Иконка
Проект → Assets → AppIcon → перетащить `AppIcon-1024.png`
(или заменить папку `Assets.xcassets` целиком из этой папки).

⚠️ Иконка **не должна содержать прозрачность** — Apple отклоняет такие билды.

### 7. Проверить на симуляторе
Product → Run. Что проверить:
1. Игра открывается, меню видно, «НАЧАТЬ ОСАДУ» реагирует на тап
2. Поворот идёт только в ландшафт
3. Кнопка «💎 Донат» открывает «Лавку Хранителя»; цены подтягиваются
   из StoreKit (в симуляторе нужен StoreKit Configuration File — см. ниже)
4. Кнопка «🎬 Бонус» показывает тестовое rewarded-видео
5. HUD не обрезан, лента апгрейдов снизу не перекрывает сцену

### 8. Тестовые покупки в симуляторе
Xcode → File → New → File… → **StoreKit Configuration File** →
добавить 8 товаров с ID из `store-listing.md` → затем
Product → Scheme → Edit Scheme → Run → Options → StoreKit Configuration = этот файл.

### 9. Собрать и загрузить
```
Product → Archive → Distribute App → App Store Connect → Upload
```
Затем в App Store Connect: создать 8 покупок с теми же ID, заполнить карточку
(тексты в `store-listing.md`), загрузить скриншоты, отправить на ревью.

## ⚠️ Важные детали

1. **ID товаров должны совпадать** с Google Play и с таблицей в `store-listing.md`:
   `gold_small, gold_mid, gold_big, donate_small, donate_big, starter, vip, noads`.
2. **Цены для iOS выше**, чем в Play: Apple берёт 30% (15% для малых разработчиков).
   Например, 199 ₽ в Play → ~399 ₽ в App Store для сопоставимой выручки.
3. **Баннер** добавляется поверх WKWebView. Если он перекрывает низ сцены,
   в `AdsManagerIOS.swift` в `setupBannerContainer` поменяйте привязку на
   родительское view вместо `web`.
4. **Отладка WebView:** Safari → Develop → <Ваш iPhone/симулятор> → страница игры.
   В консоли должно быть видно `window.Android.platform() === 'ios'`.
   Если `window.Android` отсутствует — `BridgeShim.js` не добавлен в target.
5. **Реклама не грузится в симуляторе** — это нормально, нужен реальный
   девайс или тестовые ID (они уже стоят).

## Что заменить перед публикацией

В `AdsManagerIOS.swift`:
```swift
private let unitBanner       = "..."   // ваш banner unit id
private let unitInterstitial = "..."   // ваш interstitial unit id
private let unitRewarded     = "..."   // ваш rewarded unit id
```
И в `Info.plist` → `GADApplicationIdentifier` → ваш App ID из AdMob.
