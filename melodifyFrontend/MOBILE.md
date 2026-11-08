# Melodify Android geliştirme hazırlığı

React + TypeScript + Capacitor tabanlı Android uygulamasında mimari temel ve adım 1–4 tamamlanmıştır. Kitaplık taraması/Room kalıcılığı, ilk indirme akışı, Media3 oynatıcı ve telefon arayüzü doğrulanmıştır. Kalıcı indirme servisi adım 5, native listeler/JSON aktarımı adım 6, çerezler/araç güncelleme adım 7 kapsamındadır. Arayüz, henüz uygulanmayan native işlemleri kullanılabilir göstermez. Uygulama sırası ve gerçek doğrulamalar [kalıcı mobil geliştirme planında](MOBILE_PLAN.md) tutulur.

Telefonda işlem sınırları [proje yönergelerinde](../AGENTS.md) kayıtlıdır. Yalnızca Melodify'ı yükleme, çalıştırma ve hata ayıklama yetkisi vardır. Dosya silme, uygulamayı kaldırma/verilerini temizleme, başka uygulamalara müdahale veya sistem ayarı değişikliği için önceden kullanıcı onayı alınır.

## Gereksinimler

- Node.js 22.18 veya üzeri ve npm; mobil birim testleri Node.js'in yerleşik TypeScript desteğini kullanır.
- Capacitor `core`, `android` ve `cli`: birlikte sabitlenen `8.5.3` sürümü; `npm ci` ile kurulur.
- Android Studio ve JDK 21. Android Studio'nun beraberindeki JDK farklı bir ana sürümse projede JDK 21 seçilmeli.
- Android SDK Platform 36, SDK Platform-Tools ve Android SDK Build-Tools 35.0.0.
- Gradle 8.14.3; projedeki wrapper ilk derlemede otomatik indirir. Global Gradle kurulumu gerekmez.
- Kotlin Gradle eklentisi 2.2.10; ilk native derlemede Maven üzerinden çözülür.
- Android NDK `28.2.13676358`; FFmpeg'in eksik C++ çalışma zamanı için bu sürümün sabit hashli dosyaları kullanılır. `ANDROID_NDK_HOME` başka bir konumu gösteriyorsa sürüm ve hashlerin eşleşmesi gerekir.
- Cihazda çalıştırmak için USB hata ayıklaması açık bir Android cihaz veya çalışan Android emülatörü.

Android minimum API seviyesi 24, compile/target API seviyesi 36'dır. Değerler `android/variables.gradle` içindedir. Release uygulama kimliği `com.yhcanbay.melodify`, debug uygulama kimliği `com.yhcanbay.melodify.debug` ve debug uygulama adı `Melodify Dev` olur. `versionName`, `package.json` sürümünden okunur. Debug sürümü, release uygulamasından ayrı kurulur.

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
| `npm run test:mobile` | Gezinme, native durum doğrulaması, eski isteklerin elenmesi ve abonelik temizliğini Node.js üzerinde test eder. |
| `npm run check:mobile-ui` | Mobil web paketini derler; mevcut Electron bağımlılığıyla gizli bir pencerede gezinme, geri dönüş, tema kalıcılığı ve küçük ekran kontrollerini çalıştırır. Telefona erişmez. |
| `npm run preview:mobile` | Oluşturulan mobil web paketinin önizlemesini sunar. |
| `npm run android:doctor` | JDK 21, Android SDK Platform, adb ve Build-Tools kurulumunu denetler. |
| `npm run prepare:android-tools` | Sabit AAR paketlerini hash kontrollü yerel Maven deposuna, yt-dlp/EJS ve NDK çalışma zamanını `.cache/android-tools/generated/` altına hazırlar. Telefona erişmez. `android:build` ve Gradle `preBuild` de bu hazırlığı çalıştırır. |
| `npm run android:check-bridge -- <cihaz-seri-no>` | Açık Melodify Dev uygulamasının kendi WebView soketinden beş native köprüyü, sekmeleri ve hata sözleşmelerini kontrol eder. Yalnızca belirtilen cihaz/hedef uygulamaya bağlanır; sistem ayarı değiştirmez ve telefonda dosya silmez. |
| `npm run android:sync` | Mobil web paketini oluşturur ve Android projesine kopyalar; native eklenti bağlantılarını yeniler. |
| `npm run android:open` | Mevcut Android projesini Android Studio'da açar. İlk açılıştan önce `android:sync` çalıştırın. |
| `npm run android:build` | Senkronizasyon ardından Gradle wrapper ile debug APK oluşturur. |
| `npm run android:run` | Senkronizasyon ardından bağlı cihaza/emülatöre derler ve yükler. |

Android Studio'da `android/` klasörünü açın. IDE içindeki Gradle JDK ayarını da JDK 21 yapın; IDE, terminal betiğinin Java seçimini kendiliğinden kullanmaz. Henüz release anahtarı, mağaza imzalama yapılandırması veya yayın süreci oluşturulmadı.

Temiz bir checkout'ta Android Studio/Gradle'ı doğrudan kullanmadan önce `npm run prepare:android-tools` çalıştırın. Büyük `library` ve `ffmpeg` AAR dosyaları, `android-tools.json` SHA-256 değerleriyle doğrulanarak `.cache/android-tools/repository/` içindeki yerel Maven deposuna hazırlanır. Gradle bu iki modülü yalnızca bu depodan çözer; diğer bağımlılıklar mevcut Google/Maven Central depolarını kullanır. İlk indirme internet gerektirir; doğrulanmış önbellek sonraki derlemelerde kullanılır.

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
| `mobile/src/main.tsx`, `mobile/src/app/` | İlk çizim öncesi tema, uygulama kabuğu, sekme/katman gezinmesi ve durum yaşam döngüsü. |
| `mobile/src/components/` | Ortak ikonlar ve özellik/boş durum bileşenleri. |
| `mobile/src/features/` | Kitaplık, arama/indirme, oynatıcı/sıra, listeler, aktarım ve ayarlar ekranları. |
| `mobile/src/platform/` | Tipli Capacitor köprüleri, Android/tarayıcı adaptörleri, durum doğrulaması ve abonelik yönetimi. |
| `mobile/src/styles/mobile.css` | Mobil yerleşim, koyu/açık tema, arka planlar ve ekran kenarı boşlukları. |
| `src/shared/mobile.ts` | Mobil parça/kitaplık kimlikleri, content URI'leri, kuyruk/iş durumları ve native komut sözleşmeleri. |
| `src/shared/appearance.ts`, `src/shared/melodify.ts` | Mevcut görünüm tercihleri ve masaüstüyle uyumlu aktarım/arama sözlüğü. |
| `vite.mobile.config.ts` | Electron eklentisi içermeyen mobil Vite yapılandırması. |
| `tsconfig.mobile.json` | Mobil giriş, paylaşılan kaynaklar ve mobil yapılandırmanın TypeScript kontrolü. |
| `capacitor.config.ts` | Uygulama kimliği, adı ve `dist-mobile` web çıktı konumu. |
| `android/` | Git'te saklanan Android native proje kaynakları ve Gradle wrapper. |
| `scripts/android.mjs` | Yerel araç kontrolü, senkronizasyon, IDE açma ve debug derleme komutları. |
| `scripts/mobile.test.mjs`, `scripts/check-mobile-ui.*` | Yeni bağımlılık gerektirmeyen odaklı mobil davranış ve arayüz kontrolleri. |
| `android-tools.json`, `scripts/prepare-android-tools.mjs` | İndirme araçları aday sürüm/hash kaydı, resmî yt-dlp/EJS ve NDK C++ çalışma zamanı hazırlığı. |
| `scripts/check-android-bridge.mjs` | Yalnızca Melodify Dev sürecinin hata ayıklama soketinden gerçek cihaz kontrolü. |

Masaüstü `src/main.tsx` ve `vite.config.ts` üzerinden çalışır. Mobil giriş Electron'a veya `window.melodifyApi` köprüsüne bağımlı değildir. Masaüstünün mutlak yol tabanlı `MusicTrack` tipi değiştirilmemiştir; mobilde `id`, `libraryId` ve `contentUri` ayrı alanlardır.

## Native köprüler ve durumun sahibi

`MainActivity`, aşağıdaki Kotlin eklentilerini `super.onCreate` çağrısından önce kaydeder. Native kaynaklar `android/app/src/main/java/com/yhcanbay/melodify/` altındadır.

| Capacitor eklentisi | Sözleşme |
| --- | --- |
| `MelodifyLibrary` | Klasör seçimi, tarama, kapak, kitaplık/erişim durumu. |
| `MelodifyPlayback` | Kuyruk, oynatma komutları, konum, tekrar/karıştırma ve durum olayları. |
| `MelodifyDownloads` | Arama, işe ekleme, iptal, yeniden deneme ve ilerleme/durum olayları. |
| `MelodifyPlaylists` | Liste oluşturma/düzenleme/silme ve parça/sıra işlemleri. |
| `MelodifySettings` | Uygulama/araç bilgileri, indirme klasörü, çerezler, JSON aktarımı, öne dönüş ve Android geri gezinmesi. |

Her eklenti `getSnapshot()` sunar. Kitaplık, Media3 oynatıcı ve ilk indirme akışı uygulanmıştır; henüz uygulanmayan liste/aktarım/çerez/güncelleme işlemleri `NOT_IMPLEMENTED` hatasıyla reddedilir. İndirme araçlarının hazır olması `engineReady` ile ayrıca bildirilir; araç hazırlığı gerektirmeden geçmiş görüntülenebilir.

Protokol sürümü `1` olarak TypeScript ve Kotlin tarafında tanımlıdır. Uyumsuz protokol veya bozuk durum verisi kullanıcıya hata olarak gösterilir. Android geri komutu açık Ayarlar/oynatıcı katmanını kapatır; diğer sekmelerden Kitaplık'a döner. Kitaplık ana ekranında sistemin varsayılan geri davranışı korunur.

Oynatıcı ve indirmelerin sahibi native katmandır. React açılışta, uygulama yeniden öne geldiğinde ve native durum olaylarında bütün durum görüntüsünü okur. Eski asenkron yanıtlar yeni durumu ezemez; abonelikler, geç tamamlanan kayıtlar dahil kapanışta temizlenir. Bağlantı hatasında tekrar deneme hem durum okumasını hem olay aboneliklerini yeniden kurar.

Tarayıcı adaptörü yalnızca ekranları önizlemeye yarar; cihaz işlemlerini `ANDROID_REQUIRED` ile reddeder. Mobil web paketinde Node.js, Electron veya Windows araçları bulunmaz. Görünüm tercihi mevcut `melodify.appearance` anahtarını kullanır ve ilk React çiziminden önce uygulanır.

## İndirme araçlarının ilk doğrulaması

Adım 1'in çalışma zamanı denemesi Ayarlar → İndirme araçları → Araçları doğrula üzerinden hazırlanmıştır. Açılışta veya `android:check-bridge` sırasında otomatik başlatılmaz. `initializeTools`, `youtubedl-android` ve FFmpeg çalışma dosyalarını hazırlayıp beş aracın sürüm/SHA-256 bilgisini okur; başarısız hazırlık arayüze hata olarak döner. Bu deneme arama veya MP3 indirme değildir.

`youtubedl-android:0.18.1` ve `ffmpeg:0.18.1` sabitlenmiştir. FFmpeg'in eksik `libc++_shared.so` dosyası NDK `28.2.13676358` içinden APK'ya eklenir ve aracın uygulamaya özel `LD_LIBRARY_PATH` klasörüne kopyalanır. Resmî yt-dlp `2026.10.26` zipimport paketi EJS ile birlikte gömülür. Paketler ARM64/API 33 üzerinde adım 1 doğrulamasından geçmiştir; durum `android-tools.json` içindedir. Release lisans/16 KB uyumluluk kontrolleri sonraki kabul aşamasında yapılacaktır.

**Cihaz yetkisi:** Native kütüphane, hazırlıkta/hata durumunda kendi oluşturduğu araç çalışma klasörlerini temizleyebilir. Kullanıcının telefonda dosya silme kuralı nedeniyle bu denemeyi ajan üzerinden başlatmadan önce yalnızca bu uygulamaya özel araç/geçici dosya temizliğine açık onay alınmalıdır. Kitaplık, indirme hedefi, başka uygulamalar veya sistem ayarları bu izne dahil değildir.

Bu açık onay alındıktan sonra, açık Melodify Dev üzerinde otomatik araç doğrulaması için `npm run android:check-bridge -- <cihaz-seri-no> --initialize-tools` kullanılabilir. Bu seçenek verilmezse köprü kontrolü araç hazırlığını başlatmaz. Gerçek sürüm/hash raporu yalnızca doğrulama başarılı olursa bilgisayarda `.cache/device-checks/android-tools.json` dosyasına yazılır.

`dist-mobile/`, `.cache/`, Android derleme çıktıları, kopyalanmış web dosyaları, `local.properties` ve imzalama anahtarları Git'e eklenmez. `android/` kaynak klasörünü, wrapper JAR'ını ve native kaynakları sürüm kontrolünde tutun. `capacitor.settings.gradle` ve `app/capacitor.build.gradle` senkronizasyonla yeniden üretildiğinden bunlara elle özellik kodu eklemeyin.

## Kitaplık ve kalıcı veri

Kitaplık → Kitaplık seç ile SAF üzerinden okuma/yazma izni alınır. İndirme hedefinden bağımsız kitaplık kimliği ve seçimi Room içinde saklanır. Alt klasörler taranır; gizli dosyalar, sanal belgeler ve `melodify-playlists` klasörleri atlanır. Masaüstündeki ses uzantıları desteklenir. Yeniden tarama parça kimliklerini korur; bulunamayan dosyaların kayıtları `missing` olarak tutulur. İzin kaybı, bulunamayan klasör ve bağlı olmayan depolama ayrı durumlarla bildirilir. Başarısız tarama son sağlam indeksi korur.

Room `2.8.5`, Kotlin ile uyumlu KSP `2.2.10-2.0.2` kullanır. Şema `android/app/schemas/` altında sürümlenir; veritabanı `melodify-mobile.db` dosyasıdır. Ana iş parçacığında sorgu ve veri silen migration kullanılmaz. İndirme iş geçmişi ve oynatıcı kurtarma durumu saklanır; önceki oturumdaki aktif işler yeniden açılışta `interrupted` olur ve otomatik başlamaz. Media3 kuyruk kurtarması adım 3'te doğrulanmıştır; kalıcı indirme servisi adım 5'te tamamlanacaktır.

Kapaklar önce gömülü görselden, ardından aynı adlı veya klasörün `cover`/`folder` görselinden okunur. En fazla 384 px JPEG üretilir; önbellek 8 MB bellekle sınırlıdır. Disk önbelleği veya kullanıcı dosyası temizliği yapılmaz. Salt okunur, dışa kapalı ContentProvider üzerinden WebView'a aktarılır. Kitaplık listesi görünür satırlar ve küçük bir tamponla sanallaştırılır; Home/End ve ok tuşları odağı taşır. Ortak kapak istekleri 128 girişle sınırlıdır. Adım 4'te arayüz ve mevcut native işlevlerin telefon UX kontrolü tamamlanmıştır; native listelerin gerçek cihaz kabulü adım 6'da kalır.

`check:mobile-ui` ayrıca Android paketine girmeyen ayrı bir test girişi derler. 10.000 parçayla sınırlı DOM/kapak isteği, arama, klavye odağı, mini/tam oynatıcı, kuyruk sürüklemesi, liste diyalogları/hata kurtarması ve büyük yazı dahil 43 kontrol çalışır. `tsconfig.mobile-tests.json` fixture'ın tiplerini ayrıca denetler. Liste işlemleri bu testte bellekte uygulanır; telefona test verisi yazılmaz.

Adım 4'te liste kartı/ayrıntı ve düzenleme arayüzleri tipli köprüye bağlanmıştır; native liste özelliği adım 6'ya kadar kapalı kalır. Geri gezinme, liste ayrıntısını ve açık diyalogları korur. Sürgüler hareket bitiminde komut gönderir; kuyruğun 50 parçalık sayfaları tüm sıra kimliklerini korur. Ayarlar'daki klasör düğmeleri kitaplık/indirme hedefini ayrı tutar.

Gerçek cihazda `--phone-ui-test`; kapak, mini/tam oynatıcı, sürgünün native konumla eşleşmesi, ilk ekrandaki temel düğmeler, erişilebilirlik ağacı, büyük yazı ve kendi Activity geri dispatcher'ını doğrular. `--keyboard-test` yalnız Melodify arama alanına dokunup gerçek Android klavyesinde alanın görünürlüğünü kontrol eder. Raporlar `.cache/device-checks/android-phone-ui.json` ve `android-keyboard.json`; tam oynatıcı görüntüsü `mobile-player.png` olur. Sistem erişilebilirlik/yazı ayarları değiştirilmez.

Kullanıcı kitaplık klasörünü seçtikten sonra `npm run android:check-bridge -- <cihaz-seri-no> --library-test`; yeniden tarama kimliklerini, aramayı, gerçek JPEG görüntüsünü ve indirme hedefinin korunmasını doğrular. Ardından `node scripts/check-android-library-storage.mjs <cihaz-seri-no>` yalnız Melodify'ı durdurur, kendi Room dosyalarını salt okur, bilgisayardaki kopyanın bütünlüğünü/tablolarını/kimliklerini denetler ve uygulamayı yeniden açar. `--library-test` tekrar çalıştırılırsa önceki raporla süreçler arası kalıcı kimlikler de karşılaştırılır. Raporlar `.cache/device-checks/android-library*.json` konumundadır. Kontroller izin kaldırmaz, telefon ayarlarını değiştirmez veya dosya silmez. İzin kaldırma/SD çıkarma fiziksel testleri kullanıcının ayrıca katılımını gerektirir.

## Native oynatıcı

Media3 `1.11.1` ExoPlayer, `PlaybackService` içindeki `MediaSessionService` tarafından yönetilir. Activity/WebView kapanması oynatıcıyı duraklatmaz; medya bildirimi, kilit ekranı ve güvenilir medya denetleyicileri aynı oturuma bağlanır. Ses odağı yönetimi ve kulaklık çıkarılınca duraklatma ExoPlayer'a devredilir. `setVolume` yalnız oynatıcının uygulama sesini değiştirir; telefonun sistem ses ayarını değiştirmez. Parçalar gerçek `content://` URI üzerinden okunur.

Mobil komutlar yalnız Room'da kayıtlı parça UUID'lerini kullanır; JavaScript'ten gönderilen dosya yolu veya URI'ye güvenilmez. Bir kez tekrarda fiziksel Media3 sırası `A,A,B,B` olur; React tekil `A,B` kuyruğunu ve ilk/ikinci çalma sayacını görür. Otomatik bitiş son parçada durur; elle önceki/sonraki kuyruk uçlarında döner. Üç saniyeyi geçen konumda önceki parçayı başa alır. Kuyruğun sırasını veya tekrarını değiştirmek mevcut konumu korur; elle parça seçmek tekrar sayacını sıfırlar. Kitaplık seçimi kuyruğu değiştirmez; karıştırmayı açıkça kapatmak seçili, erişilebilir kitaplık sırasını yükler.

Kuyruk, parça, konum, tekrar sayacı, karıştırma ve uygulama sesi Room `playback_recovery/current` kaydında tutulur. Yeniden açılış duraklatılmış olarak kurtarılır. Eski deneme oynatıcısı ayrı `probe` kaydı kullanır. Native oynatıcı ve deneme oynatıcısı birbirini duraklatır. Kotlin saf sıra testleri `android:test` kapsamındadır. Cihazda `--native-playback-test` gerçek URI, sarma, medya oturumu komutları, tekrar modları, ses ve bozuk komut reddini; yalnız Melodify yeniden açıldıktan sonra `--native-recovery-test` süreçler arası kurtarma ve sürdürmeyi doğrular. Rapor `android-native-playback.json` olur.

Kısa ekran kapalı kontrolü için `--background-prepare` yalnız debug sürümünde üç dakikalık, sonunda otomatik duran bir tekrar denemesi başlatır. Ekranı kullanıcı kendisi kapatmalıdır. `node scripts/check-android-background.mjs <seri-no>` yalnız bu uygulama PID'sinin `MelodifyPlayback` günlüklerini ve kendi servis durumunu okur; ekran kapalı çalma/otomatik tekrar/foreground servisi kontrol eder. Günlük temizlemez, dosya silmez, ekranı veya sistem ayarını değiştirmez. Bu kısa deneme 30 dakikalık release kabulü ve gerçek çok parçalı/kulaklık/Bluetooth/telefon araması testleri yerine geçmez.

Resmî tasarım kaynakları: [Media3 sürümleri](https://developer.android.com/jetpack/androidx/releases/media3), [MediaSessionService](https://developer.android.com/media/media3/session/background-playback), [oynatıcı komutlarını sarmalama](https://developer.android.com/reference/androidx/media3/common/ForwardingSimpleBasePlayer).

## Doğrulama

```powershell
npm run lint
npm run test:mobile
npm run check:mobile-ui
npm run build:mobile
npm run android:doctor
npm run android:build
npm run build:app
```

Debug APK'nın üretilmesi cihazda oynatma veya arka plan davranışının doğrulandığı anlamına gelmez. Cihaz/emülatör kontrolleri ilgili native özellikler geliştirildiğinde ayrıca yapılmalıdır.

Windows'ta kısıtlı bir çalışma ortamı Capacitor için `uv_os_get_passwd` veya Electron alt süreçlerini başlatırken erişim hatası üretebilir. Bu durumda aynı komutu normal kullanıcı terminalinde çalıştırın; sistem Java/SDK ayarlarını veya güvenlik ilkelerini değiştirmeyin.

Resmî kaynaklar: [Capacitor kurulumu](https://capacitorjs.com/docs/getting-started), [Android gereksinimleri](https://capacitorjs.com/docs/getting-started/environment-setup), [Android geliştirme akışı](https://capacitorjs.com/docs/android).
