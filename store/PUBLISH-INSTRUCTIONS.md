# Публикация «Дни Минувшие: Осада» — пошаговая инструкция

Всё, что можно было подготовить из Windows, готово. Ниже — что осталось
сделать за вас в консолях (это требует вашего аккаунта).

---

## ЧТО ГОТОВО

| Артефакт | Путь |
|---|---|
| AAB для Google Play | `dist/days-bygone-osada-v3.1.aab` |
| APK для теста на телефоне | `dist/days-bygone-osada-v3.1.apk` |
| Метаданные Google Play | `store/google/store-listing.md` |
| Иконка 512×512 | `store/google/icon-512.png` |
| Feature graphic 1024×500 | `store/google/feature-1024x500.png` |
| Скриншоты 1920×1080 | `store/google/screen-1..3-*.png` (3 шт) |
| Метаданные App Store | `store/apple/store-listing.md` |
| Иконка iOS 1024×1024 | `store/apple/AppIcon-1024.png` |
| Скриншоты iOS (4 размера) | `store/apple/screenshots/` |
| Код iOS (WebView + мосты) | `store/apple/ContentView.swift` |
| iOS: покупки | `store/apple/StoreKitManager.swift` |
| iOS: реклама | `store/apple/AdsManagerIOS.swift` |
| iOS: JS-шим `window.Android` | `store/apple/BridgeShim.js` |
| iOS: точка входа | `store/apple/DaysBygoneApp.swift` |
| iOS: Info.plist | `store/apple/Info.plist` |
| iOS: каталог иконок | `store/apple/Assets.xcassets/` |
| **Инструкция сборки iOS** | **`store/apple/README-BUILD.md`** |
| Политика конфиденциальности | `store/privacy-policy.md` |

**Версия:** 3.1 (versionCode 15)

---

## GOOGLE PLAY — что сделать

### Шаг 1. Внутренние покупки (сначала!)

`Монетизация → Товары в приложении → Создать товар`

Создать 8 товаров с ID **точно** как в таблице:

| Product ID | Тип | Название | Цена |
|---|---|---|---|
| `gold_small` | Расходуемый | Горсть золота | 49 ₽ |
| `gold_mid` | Расходуемый | Мешок золота | 199 ₽ |
| `gold_big` | Расходуемый | Сундук золота | 899 ₽ |
| `starter` | Одноразовый | Набор новобранца | 299 ₽ |
| `vip` | Одноразовый | Статус Хранителя | 999 ₽ |
| `noads` | Одноразовый | Без рекламы | 249 ₽ |
| `donate_small` | Расходуемый | На чай разработчику | 99 ₽ |
| `donate_big` | Расходуемый | Поддержать проект | 499 ₽ |

⚠️ ID чувствительны к регистру. Ошибка в ID = товар не загрузится в игре.

### Шаг 2. Загрузить AAB

`Производство → Создать новую версию` → загрузить `days-bygone-osada-v3.1.aab`

При первом релизе включите **Play App Signing** (Google переподпишет приложение
своим ключом — ваш keystore остаётся для локальных сборок).

### Шаг 3. Заполнить карточку

Скопировать тексты из `store/google/store-listing.md`, загрузить:
- иконку `icon-512.png`
- feature graphic `feature-1024x500.png`
- скриншоты из `store/google/`

### Шаг 4. Опросники

- **Контент:** насилие в фэнтезийном стиле → рейтинг 12+
- **Реклама:** Да (содержит рекламу)
- **Покупки:** Да (внутриигровые покупки)
- **Data safety:** собирает Ad ID для рекламы, шифрование — да

### Шаг 5. Приватность

Опубликовать `store/privacy-policy.md` по публичному URL и указать в консоли.
Быстрый способ: создать репозиторий GitHub Pages и положить туда файл.

### Шаг 6. AdMob (для дохода с рекламы)

1. Создать аккаунт на admob.google.com
2. Добавить приложение → получить App ID и три Unit ID
3. Заменить в коде:

| Что | Где заменить |
|---|---|
| App ID | `android/app/src/main/AndroidManifest.xml` → `APPLICATION_ID` |
| Баннер | `AdsManager.java` → `UNIT_BANNER` |
| Межстраничная | `AdsManager.java` → `UNIT_INTERSTITIAL` |
| Rewarded | `AdsManager.java` → `UNIT_REWARDED` |

4. Пересобрать: `cd android && ./gradlew clean bundleRelease assembleRelease`
5. Подтвердить домен и добавить `app-ads.txt` (повышает доход)

**Текущие ID — тестовые Google.** С ними можно полностью протестировать
покупки и рекламу, но денег они не приносят. Заменить перед публикацией!

---

## APP STORE — что сделать

### ⚠️ Главное ограничение

Собрать `.ipa` **физически невозможно на Windows** — нужен macOS + Xcode.
Варианты:

1. **Арендовать Mac** (MacinCloud, MacStadium) — ~$1/час
2. **Codemagic / Bitrise** (облачный CI для iOS) — есть бесплатный лимит
3. **Взять Mac у знакомых** на пару часов

### Шаги на Mac

📖 **Полная пошаговая инструкция: `store/apple/README-BUILD.md`** (там же — что
проверить на симуляторе и как настроить тестовые покупки).

Кратко:

```
1. Xcode → File → New → Project → iOS → App
   Product Name: Дни Минувшие
   Bundle ID:    com.tommlee.daysbygone
   Interface:    SwiftUI, Language: Swift
   Minimum iOS:  15.0  (нужен StoreKit 2)

2. Перетащить в проект 4 файла из store/apple/:
   ContentView.swift, DaysBygoneApp.swift,
   StoreKitManager.swift, AdsManagerIOS.swift
   + BridgeShim.js (Target Membership = YES)

3. Перетащить папку game/ → «Create folder references» (СИНЯЯ папка),
   НЕ «Create groups» — иначе ES-модули не загрузятся

4. Info.plist — значения из store/apple/Info.plist
   (ориентации, ATT, GADApplicationIdentifier, SKAdNetwork)

5. SPM: https://github.com/googleads/swift-package-manager-google-mobile-ads
   продукт GoogleMobileAds

6. Иконка: store/apple/Assets.xcassets → заменить папку в проекте

7. Product → Archive → Distribute App → App Store Connect
```

⚠️ Если игра открылась, но кнопки не реагируют — почти всегда причина в шаге 3
(groups вместо folder references) или `BridgeShim.js` не добавлен в target.
Проверка в Safari → Develop: `window.Android.platform()` должно вернуть `'ios'`.

### В App Store Connect

1. Создать приложение с Bundle ID `com.tommlee.daysbygone`
2. Создать 8 покупок в разделе **In-App Purchases** (ID как в таблице выше)
3. Заполнить карточку из `store/apple/store-listing.md`
4. Загрузить скриншоты из `store/apple/screenshots/` (игра ландшафтная!)
5. Загрузить иконку `AppIcon-1024.png` (без прозрачности!)
6. Заполнить App Privacy (AD ID для рекламы)
7. Добавить запрос ATT (App Tracking Transparency) в Info.plist

### Про рекламу и покупки на iOS

Уже реализовано (`AdsManagerIOS.swift`, `StoreKitManager.swift`):
- **баннер** — `BannerView` поверх WebView, прячется на экране боя;
- **межстраничная** — `InterstitialAd`, с перезагрузкой после показа;
- **rewarded** — `RewardedAd` с выдачей награды в JS;
- **покупки** — StoreKit 2: загрузка товаров, покупка, восстановление,
  автоматическое закрытие расходуемых, флаг «без рекламы» в UserDefaults;
- **ATT** — запрос разрешения на трекинг при старте.

Стоят **тестовые ID Google** — их нужно заменить перед публикацией
(три константы в `AdsManagerIOS.swift` + `GADApplicationIdentifier` в Info.plist).

**Важно:** на iOS цены в App Store должны учитывать комиссию Apple (30%).
Если в Google Play товар стоит 199 ₽, в App Store ставьте ~399 ₽,
чтобы получать сопоставимую сумму.

---

## ПОРЯДОК РЕКОМЕНДУЕМЫХ ДЕЙСТВИЙ

**Сейчас (без Mac):**
1. Создать 8 товаров в Google Play Console
2. Загрузить AAB и заполнить карточку
3. Опубликовать политику конфиденциальности
4. Настроить AdMob, заменить тестовые ID, пересобрать

**Потом (нужен Mac):**
5. Арендовать Mac / подключить Codemagic
6. Собрать .ipa, загрузить в App Store Connect
7. Пройти ревью Apple (обычно 1–3 дня)

---

## ТЕСТИРОВАНИЕ ПЕРЕД ПУБЛИКАЦИЕЙ

1. Установить `dist/days-bygone-osada-v3.1.apk` на телефон:
   ```
   adb install -r dist/days-bygone-osada-v3.1.apk
   ```
2. Открыть игру → кнопка «💎 Донат» → проверить, что цены загрузились
3. Купить тестовый товар (в тестовом режиме Google списания не будет,
   если добавить себя в список тестировщиков)
4. Кнопка «🎬 Бонус» → посмотреть тестовое видео → проверить награду
5. Проверить покупку «Без рекламы» → баннер должен исчезнуть
6. Проверить, что прогресс сохраняется после перезапуска

### Тестовые аккаунты Google Play

`Play Console → Настройки → Тестирование лицензий` → добавить свой e-mail.
Тогда покупки будут бесплатными, а реклама — тестовой.

---

## ОТКАТ / ОБНОВЛЕНИЕ ВЕРСИИ

Перед следующей сборкой поднять в `android/app/build.gradle`:
```gradle
versionCode 16      // ← увеличивать на 1 каждый раз
versionName "3.2"   // ← новая версия
```

Затем: `cd android && ./gradlew clean bundleRelease assembleRelease`

⚠️ Никогда не менять `applicationId` — иначе Play не примет обновление.
⚠️ Не терять `daysbygone.keystore` — без него нельзя обновлять приложение.
