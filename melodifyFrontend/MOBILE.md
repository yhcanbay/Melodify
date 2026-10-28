# Melodify Android geliştirme hazırlığı

Bu hazırlık React + Capacitor tabanlı Android başlangıç projesini kurar. Mobil uygulama şu anda yalnızca Melodify karşılama ekranını gösterir. Kitaplık taraması, native oynatıcı, arka planda çalma, çalma listeleri ve yt-dlp henüz mobile bağlanmadı; bunların uygulama planı sonraki aşamada hazırlanacak.

## Gereksinimler

- Node.js 22 veya üzeri ve npm.
- Capacitor `core`, `android` ve `cli`: birlikte sabitlenen `8.5.3` sürümü; `npm ci` ile kurulur.
- Android Studio ve JDK 21. Android Studio'nun beraberindeki JDK farklı bir ana sürümse projede JDK 21 seçilmeli.
- Android SDK Platform 36, SDK Platform-Tools ve Android SDK Build-Tools 35.0.0.
- Gradle 8.14.3; projedeki wrapper ilk derlemede otomatik indirir. Global Gradle kurulumu gerekmez.
- Cihazda çalıştırmak için USB hata ayıklaması açık bir Android cihaz veya çalışan Android emülatörü.

Android minimum API seviyesi 24, compile/target API seviyesi 36'dır. Değerler `android/variables.gradle` içindedir. Uygulama kimliği `com.yhcanbay.melodify` olarak hazırlanmıştır; mağaza kaydından önce kesinleştirilmelidir.

Çalışma klasöründeki Türkçe karakterler nedeniyle `android/gradle.properties` içinde `android.overridePathCheck=true` kullanılır. Bu ayar AGP'nin ön yol denetimini kaldırır; native araçların bu konumda çalışması ayrıca debug derlemesiyle doğrulanmalıdır.

## Komutlar

Komutları `melodifyFrontend/` içinde çalıştırın. PowerShell'de `npm` yerine `npm.cmd` kullanılabilir.

```powershell
npm ci
npm run android:doctor
npm run android:build
```

`android:build`, mobil web kodunu derler, Capacitor senkronizasyonunu yapar ve debug APK üretir:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

| Komut | İşlev |
| --- | --- |
| `npm run dev:mobile` | Mobil web başlangıcını `http://127.0.0.1:5174` üzerinde açar. Native özellikler tarayıcıda çalışmaz. |
| `npm run build:mobile` | TypeScript kontrolleriyle mobil web paketini `dist-mobile/` altında oluşturur. |
| `npm run preview:mobile` | Oluşturulan mobil web paketinin önizlemesini sunar. |
| `npm run android:doctor` | JDK 21, Android SDK Platform, adb ve Build-Tools kurulumunu denetler. |
| `npm run android:sync` | Mobil web paketini oluşturur ve Android projesine kopyalar; native eklenti bağlantılarını yeniler. |
| `npm run android:open` | Mevcut Android projesini Android Studio'da açar. İlk açılıştan önce `android:sync` çalıştırın. |
| `npm run android:build` | Senkronizasyon ardından Gradle wrapper ile debug APK oluşturur. |
| `npm run android:run` | Senkronizasyon ardından bağlı cihaza/emülatöre derler ve yükler. |

Android Studio'da `android/` klasörünü açın. IDE içindeki Gradle JDK ayarını da JDK 21 yapın; IDE, terminal betiğinin Java seçimini kendiliğinden kullanmaz. Henüz release anahtarı, mağaza imzalama yapılandırması veya yayın süreci oluşturulmadı.

## Yerel araçların bulunması

`scripts/android.mjs`, makinenin genel ortam değişkenlerini değiştirmeden alt süreçleri hazırlar:

- `JAVA_HOME` tanımlıysa JDK 21 olması gerekir. Tanımlı değilse Windows'ta yaygın JDK kurulumları, Android Studio'nun JDK'sı ve PATH kontrol edilir.
- SDK, `ANDROID_HOME`, `ANDROID_SDK_ROOT`, mevcut `android/local.properties` veya yaygın SDK konumlarından bulunur.
- Eksikse `android/local.properties` içine makineye özel SDK yolu yazılır. Bu dosya Git'e eklenmez.
- Varsayılan Gradle önbelleği `.cache/gradle/`, Android kullanıcı verisi `.cache/android/` altındadır. Önceden tanımlı `GRADLE_USER_HOME` ve `ANDROID_USER_HOME` tercihlerine uyulur.

Otomatik algılama kullanılamıyorsa aynı terminal oturumu için konumları belirtin:

```powershell
$env:JAVA_HOME = 'C:\Program Files\Java\jdk-21.0.10'
$env:ANDROID_HOME = 'C:\Android\sdk'
npm run android:doctor
```

Bu yollar örnektir; kendi kurulum konumlarınıza göre değiştirin. `android:open` Android Studio'yu bulamıyorsa `CAPACITOR_ANDROID_STUDIO_PATH` ile `studio64.exe` konumunu belirtin.

## Kaynakların düzeni

| Yol | Amaç |
| --- | --- |
| `mobile/index.html` | Mobil web HTML giriş noktası. |
| `mobile/src/main.tsx`, `mobile/src/mobile.css` | Minimal mobil karşılama ekranı. |
| `src/shared/` | Platformlar arasında paylaşılabilecek veri modelleri ve yardımcılar. |
| `vite.mobile.config.ts` | Electron eklentisi içermeyen mobil Vite yapılandırması. |
| `tsconfig.mobile.json` | Mobil giriş, paylaşılan kaynaklar ve mobil yapılandırmanın TypeScript kontrolü. |
| `capacitor.config.ts` | Uygulama kimliği, adı ve `dist-mobile` web çıktı konumu. |
| `android/` | Git'te saklanan Android native proje kaynakları ve Gradle wrapper. |
| `scripts/android.mjs` | Yerel araç kontrolü, senkronizasyon, IDE açma ve debug derleme komutları. |

Masaüstü `src/main.tsx` ve `vite.config.ts` üzerinden çalışır. Mobil giriş Electron'a veya `window.melodifyApi` köprüsüne bağımlı değildir. Ortak özelliklerin taşınması için sonraki aşamada platform adaptörleri tasarlanacaktır.

`dist-mobile/`, `.cache/`, Android derleme çıktıları, kopyalanmış web dosyaları, `local.properties` ve imzalama anahtarları Git'e eklenmez. `android/` kaynak klasörünü, wrapper JAR'ını ve native kaynakları sürüm kontrolünde tutun. `capacitor.settings.gradle` ve `app/capacitor.build.gradle` senkronizasyonla yeniden üretildiğinden bunlara elle özellik kodu eklemeyin.

## Doğrulama

```powershell
npm run lint
npm run build:mobile
npm run android:doctor
npm run android:build
npm run build:app
```

Debug APK'nın üretilmesi cihazda oynatma veya arka plan davranışının doğrulandığı anlamına gelmez. Cihaz/emülatör kontrolleri ilgili native özellikler geliştirildiğinde ayrıca yapılmalıdır.

Resmî kaynaklar: [Capacitor kurulumu](https://capacitorjs.com/docs/getting-started), [Android gereksinimleri](https://capacitorjs.com/docs/getting-started/environment-setup), [Android geliştirme akışı](https://capacitorjs.com/docs/android).
