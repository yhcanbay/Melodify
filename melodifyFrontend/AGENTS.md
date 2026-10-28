# Melodify geliştirme rehberi

Bu dosya `melodifyFrontend/` ve altındaki çalışmalar için geçerlidir. Komutları aksi belirtilmedikçe bu klasörde çalıştır. Projenin mevcut davranışını koruyarak istenen değişikliğe odaklan; bu rehberde belirtilen geliştirme alanları kendiliğinden yeniden yazım talimatı değildir.

## Projenin amacı ve teknolojiler

Melodify, yerel müzikleri çevrimdışı çalan, çalma listeleri yöneten ve YouTube üzerinden arama/indirme yapabilen bir masaüstü uygulamasıdır. Bu klasör hem arayüzü hem Electron uygulama katmanını içerir; ayrı bir HTTP backend gerektirmez.

- Arayüz: React 18, TypeScript 5, Vite 5; düz CSS ve yerel SVG ikonları.
- Masaüstü: Electron 30; derleme entegrasyonu `vite-plugin-electron/simple`.
- Medya: HTML `<audio>`, kapak okuma için `music-metadata`, arama/indirme için yt-dlp, dönüştürme için FFmpeg/ffprobe.
- Paket yöneticisi: npm ve `package-lock.json`. Bağımlılık değişikliklerinde kilit dosyasını da güncelle.
- Dağıtım hedefi: Windows x64, portable ve NSIS kurulum paketi. Yapılandırmada macOS/Linux hedefleri bulunsa da mevcut paketleme betikleri Windows x64 gerektirir.
- Kullanıcıya görünen metinler Türkçedir. Kaynak dosyaları UTF-8 olarak oku/yaz; Türkçe karakterleri koru.

Kesin bağımlılık sürümleri için `package.json` ve `package-lock.json`, dağıtım açıklamaları için `README.md` esas alınır.

## Dosya haritası

| Yol | Sorumluluk |
| --- | --- |
| `src/main.tsx` | React giriş noktası ve genel stil yüklemesi. |
| `src/App.tsx` | Sekmeler, kitaplık, kuyruk, oynatıcı, arama/indirme, çalma listeleri ve içe/dışa aktarma arayüzü. |
| `src/App.css` | Ortak bileşenler ve temel yerleşim stilleri. |
| `src/Studio.css` | Melodify Studio paleti, ekran düzenleri, etkileşimler ve responsive tema; App.css sonrasında yüklenir. |
| `src/Appearance.css` | Studio.css sonrasında yüklenen koyu tema, görünüm kontrolleri ve uygulama geneli arka planlar. |
| `src/components/VisualEffects.tsx` | React Bits örneklerinden esinlenen yerel kart, yazı, doku ve AmbientBackdrop bileşenleri. |
| `src/components/AppearanceControls.tsx` | Açık/koyu tema ve arka plan seçimi. |
| `src/shared/appearance.ts` | Görünüm tercihlerinin doğrulanması, saklanması ve HTML tema niteliklerine uygulanması. |
| `DESIGN.md` | Tasarım referansları, görsel kimlik ve hareket tercihleri. |
| `src/index.css` | Kök boyutlandırma, yazı tipi ve genel sayfa stilleri. |
| `src/shared/melodify.ts` | Renderer ile Electron arasında kullanılan veri tipleri. |
| `electron/main.ts` | Pencere yaşam döngüsü, IPC işleyicileri, dosya sistemi, diyaloglar, kütüphane, playlist ve medya işlemleri. |
| `electron/taskbar.ts` | Windows küçük pencere önizlemesindeki medya düğmeleri; Koffi ile TaskbarButtonCreated bildirimi kaydı, pencere başına hazır olma durumu ve sistem temasına uygun ikonlar. |
| `electron/preload.ts` | `contextBridge` ile sunulan `window.melodifyApi` köprüsü. |
| `electron/electron-env.d.ts` | `Window.melodifyApi` ve Electron ortam tipleri. |
| `electron/tools.ts` | Paketli/geliştirme araç yolları ve güncellenebilir yt-dlp kopyası. |
| `scripts/dev.mjs` | Geliştirme başlatıcısı; alt süreçten `ELECTRON_RUN_AS_NODE` değişkenini kaldırır. |
| `scripts/generate-icons.cjs` | Yerel SVG markasından 512px PNG, çok boyutlu Windows ICO ve açık/koyu görev çubuğu medya ikonlarını üretir. |
| `scripts/prepare-windows-tools.mjs` | Windows araçlarını toplama, mimari/sürüm kontrolü, lisans ve SHA-256 manifesti. |
| `scripts/package-windows.mjs` | Windows paketleme araçlarını hazırlama ve electron-builder çalıştırma. |
| `vite.config.ts`, `electron-builder.json5` | Uygulama derlemesi, kaynak yolları ve dağıtım ayarları. |
| `public/` | Uygulama ikonu ve Windows görev çubuğu medya ikonları dahil statik varlıklar. |

## Geliştirme ve doğrulama komutları

Node.js 22 veya üzerini kullan; Windows araç hazırlama betiği paketlenecek Node.js için bu alt sınırı denetler.

| Komut | İşlev |
| --- | --- |
| `npm ci` | Kilit dosyasındaki bağımlılıkları kurar. |
| `npm run dev` | Vite ve Electron geliştirme akışını başlatır; tercih edilen giriş noktasıdır. |
| `npm run lint` | TypeScript/TSX dosyalarında ESLint; uyarı toleransı sıfırdır. |
| `node node_modules/typescript/bin/tsc --noEmit` | Çıktı üretmeden TypeScript kontrolü yapar. |
| `npm run build:app` | TypeScript kontrolünden sonra Vite ile renderer, main ve preload kodunu derler. EXE üretmez. |
| `npm run check:taskbar` | build:app sonrasında Windows'ta gerçek TaskbarButtonCreated bildirimi öncesinde sıfır kayıt yapıldığını, WM_COMMAND/oynatıcı IPC'sini ve gizle/göster sonrasında yeniden kurulumu doğrular. Fareyle açılan önizlemenin görünürlüğü ayrıca kontrol edilmelidir. |
| `npm run generate:icons` | public/melodify-icon.svg kaynağından public/ ve build/ simgelerini gizli Electron penceresinde yeniler. |
| `npm run prepare:tools` | Araçları `vendor/windows-x64/` altında paketlemeye hazırlar. |
| `npm run build` / `npm run build:win` | Araç hazırlığı, uygulama derlemesi ve Windows portable + setup paketleri. |
| `npm run build:portable` | Yalnızca Windows portable dağıtımını hazırlar. |

PowerShell betik çalıştırma ilkesi `npm` çağrısını engellerse aynı komutlarda `npm.cmd` kullan.

`dev:renderer` doğrudan `vite` çalıştırır; mevcut Vite yapılandırmasında Electron eklentisi de aktiftir. `npm run preview` yalnızca Vite çıktısını sunar. Normal tarayıcıda Electron preload köprüsü bulunmadığından bu komutları tam masaüstü doğrulaması sayma.

Kod değişikliklerinde lint ve TypeScript kontrolünü çalıştır. Derleme, IPC veya bağımlılık değişikliklerinde ayrıca `build:app` ile entegrasyonu doğrula. EXE paketlemeyi dağıtım/paketleme değişikliklerinde yap; rutin arayüz değişiklikleri için `npm run build` gereksiz araç hazırlığı ve paketleme başlatır. Yalnızca dokümantasyon değişikliklerinde ilgili dosya, yol ve komutların doğrulanması yeterlidir.

Genel otomatik test altyapısı veya `npm test` betiği yoktur. Görev çubuğu için `check:taskbar` odaklı bir Windows regresyon kontrolü vardır; geçici profil ve sessiz test sesi kullanır. Çalıştırmadığın testleri başarılı olarak raporlama. Diğer davranış değişikliklerini aşağıdaki ilgili manuel senaryolarla doğrula; yeni test altyapısını ihtiyaç ve görev kapsamına göre değerlendir.

## Katman sınırları ve kod kuralları

- Renderer, dosya sistemi/alt süreç/native diyalog işlemlerini `window.melodifyApi` üzerinden ister. React bileşenlerine doğrudan Node.js veya Electron erişimi ekleme.
- `BrowserWindow` için `contextIsolation: true` ve `nodeIntegration: false` ayarlarını koru. Preload yalnızca ihtiyaç duyulan yöntemleri sunsun; genel amaçlı IPC veya komut çalıştırma köprüsü açma.
- Yeni IPC işlevinde ortak tipleri, main işleyicisini, preload yöntemini, `Window` bildirimini ve renderer çağrısını birlikte güncelle. TypeScript tipleri çalışma zamanında gelen veriyi doğrulamaz; yeni/değişen IPC ve JSON girişlerinde gerekli alan, yol ve değer kontrollerini yap.
- `onMediaCommand` ve `onImportProgress` aboneliklerinin döndürdüğü temizleme fonksiyonunu effect cleanup içinde kullan.
- Alt süreçlerde argüman dizisi, `shell: false` ve Windows'ta `windowsHide: true` yaklaşımını koru. Araç yollarını `electron/tools.ts` üzerinden çöz; kullanıcı girdisini shell komutuna birleştirme.
- TypeScript strict, kullanılmayan değişken/parametre kontrolleri ve React Hooks lint kuralları etkindir. Mevcut iki boşluklu girinti, tek tırnak ve genellikle noktalı virgülsüz biçimi takip et.
- Sekmeler React state ile yönetilir; mevcut yapıda router veya harici global state kütüphanesi yoktur. Yeni bağımlılık eklemeden önce mevcut araçlarla çözümü değerlendir.
- Açık tema `Studio.css`, koyu tema ve arka planlar `Appearance.css` içindedir; yükleme sırası App.css → Studio.css → Appearance.css şeklindedir. Varsayılan görünüm koyu tema ve Aurora arka planıdır. Sidebar ve oynatıcı kendi koyu renk değişkenlerine sahiptir. Düğme etiketlerini, klavye erişimini, azaltılmış hareket tercihini ve dar pencere düzenini koru. Tema nitelikleri ilk React çiziminden önce `main.tsx` içinde uygulanır; başlangıçta beyaz ekran parlaması oluşturma.

## Veri saklama ve uyumluluk

| Veri | Konum / davranış |
| --- | --- |
| Son kitaplık ve indirme klasörü | `app.getPath('userData')/melodify-state.json`. |
| Çerez kaynağı tarayıcı tercihi | Renderer `localStorage`, `melodify.cookiesFromBrowser` anahtarı. Saklanan değer tarayıcı seçimidir. |
| Tema ve arka plan tercihi | Renderer `localStorage`, `melodify.appearance` anahtarı. `theme`: dark/light; `background`: aurora/veil/lines/none. Eksik veya geçersiz kayıt koyu/Aurora varsayılanına döner. |
| Çalma listeleri | Kitaplık kökünde `melodify-playlists.json` ve `melodify-playlists/` altındaki ayrı JSON dosyaları. |
| Kütüphane dışa aktarımı | Kullanıcının seçtiği JSON dosyası; varsayılan ad `melodify-library.json`, şema sürümü `1.0`. Ses dosyalarını içermez. |
| Güncellenebilir yt-dlp | Paketli araç mevcutsa `userData/tools/<uygulama sürümü>/yt-dlp.exe`. |

Çalma listesi kaydı iki JSON biçimini de günceller. Diskte parça yolları kitaplık köküne göre göreli ve `/` ayıracıyla saklanır; yüklenirken mutlak yollara dönüştürülür. Kök dosya ve alt klasördeki kayıtları okuyabilme davranışını, mevcut ID'leri ve kitaplığın taşınabilirliğini koru. Alt klasördeki kayıtlar aynı ID'li kök kayıtların üzerine geçer.

Kitaplık klasörü ile indirme klasörü farklı olabilir. Toplu içe aktarma eksik parçaları son seçili kitaplık klasörüne indirir. Yeni özelliklerde bu iki hedefi birbirine karıştırma. Kalıcı veri biçimini değiştirirken mevcut dosyaları okuyabilmeyi ve gerekiyorsa veri geçişini ele al.

## Medya akışında korunacak davranışlar

- Kitaplık taraması alt klasörlere iner; noktayla başlayan girdileri, sembolik bağlantıları ve `melodify-playlists` klasörünü atlar. `MusicTrack.id` mutlak dosya yoludur; başlık dosya adından türetilir.
- Yeni ses formatı eklerken main tarafındaki uzantı/MIME eşlemelerini ve renderer tarafındaki MIME/`canPlayType` denetimini birlikte ele al. Dosyanın taranabilmesi oynatılabildiği anlamına gelmez.
- Oynatma tek bir `<audio>` üzerinden yürür: main dosyayı `ArrayBuffer` olarak yollar, renderer Blob URL oluşturur. Parça değişimindeki eski async sonucu eleme ve `URL.revokeObjectURL` temizliğini koru.
- Görünen kitaplık ile çalma kuyruğu ayrı state'lerdir. Kitaplık klasörü değiştiğinde mevcut kuyruk ve çalan parça korunabilir; bunları otomatik olarak birbirine eşitleme.
- Kapaklar önce gömülü metadata, sonra parça ile aynı adlı görsel ve klasör kapağından aranır. Renderer istekleri toplar ve önbellekler; main ayrıca önbellek kullanır. Liste satırlarına ayrı, tekrarlı IPC istekleri eklemekten kaçın.
- Windows görev çubuğu medya komutları ve Media Session entegrasyonu aynı oynatıcı durumuyla uyumlu kalmalıdır.
- Görev çubuğu düğmeleri yalnızca o pencereye ait gerçek Windows TaskbarButtonCreated bildirimi geldikten sonra kurulur. show, ready-to-show ve did-finish-load olayları Windows görev çubuğunun hazır olduğunu kanıtlamaz. Electron 30 başarısız ilk ThumbBarAddButtons çağrısını da kurulmuş sayabildiği için erken çağrı yapma. Hazır olmadan ve gizliyken gelen medya durumu yalnızca bellekte saklanır; gizle/göster sonrasında yeni Windows bildirimi beklenir. Parça yoksa düğmeler pasiftir. Pencere kapanınca zamanlayıcılar ve nativeTheme aboneliği temizlenir. Windows açık/koyu tema ikonları uygulamanın kendi görünüm tercihinden bağımsızdır.
- Koffi yalnızca main tarafında Windows mesaj kimliğini RegisterWindowMessageW ile almak ve yükseltilmiş uygulamaya Explorer bildirimini kabul ettirmek için kullanılır. Renderer'a native erişim sunma. Koffi'yi Vite main paketinde external tut; koffi ve @koromix platform paketleri electron-builder asarUnpack kapsamındadır. Node-API hazır binary'si Electron ile birlikte dağıtılır; kullanıcıdan ek araç kurulumu istenmez.
- Electron 30'da etkin thumbnail düğmeleri için `flags: []` kullan. Belgede geçen `enabled` metni native katmanda reddedilir ve tıklama bağlantılarını siler. Kontrolleri yalnızca JS `click()` işlevini çağırarak doğrulama; Windows bildirimini ve son setThumbarButtons sonucunu kontrol et.
- Uygulama ikonunun kaynak dosyası public/melodify-icon.svg'dir; değişiklikten sonra generate:icons çalıştır. Windows başlık çubuğu ICO'yu kullanır; görev çubuğu için appId, appIconPath, relaunchCommand ve relaunchDisplayName pencere görünmeden önce birlikte atanır. Paketli simge yolu Windows'un okuyabileceği gerçek EXE olmalıdır; portable sürümde geçici çıkarma yolu yerine PORTABLE_EXECUTABLE_FILE kullanılır. Kurulu sürümün appId değeri electron-builder ile aynı kalır. Geliştirmede `.development`, portable sürümde `.portable` son eki kullanılır; böylece kurulu eski sürümün Başlat menüsü kaydı onların simgesini ve görev çubuğu grubunu devralmaz. Her sürümün kullanıcı ayarları aynı konumda kalır.
- yt-dlp arama ve indirmeleri açıkça seçilen Node.js çalışma zamanı ve `--ignore-config` ile çalışır. Kullanıcının sistem yt-dlp ayarlarına istemeden bağımlılık oluşturma.
- İndirmeler MP3'e dönüştürülür, kapak/metadata gömülür ve `%(title)s [%(id)s].%(ext)s` biçiminde adlandırılır. İçe/dışa aktarma YouTube ID'sini bu dosya adından çıkarır; adlandırma değişikliği bu akışı da etkiler.
- İçe aktarma mevcut dosyaları dosya adı/YouTube ID'siyle eşleştirir, eksikleri sırayla indirir ve ilerleme olayı yollar. URL'siz parçalar için adla arama, arayüzdeki kullanıcı tercihine bağlıdır.
- Çerez kaynağı seçimi desteklenen tarayıcı listesiyle sınırlıdır. DPAPI ve YouTube oturum hataları için mevcut Türkçe hata yönlendirmelerini koru.

## Windows paketleme ve üretilen dosyalar

Paketleme Windows x64 üzerinde yapılır. `yt-dlp.exe`, `ffmpeg.exe`, `ffprobe.exe` PATH üzerinde veya `MELODIFY_TOOLS_DIR` ile belirtilen klasörde olmalıdır; betik PATH'te bulunamayan araçlar için hazırlanmış vendor kopyasını da dener. Paketlenecek `node.exe`, betiği çalıştıran Node.js'ten alınır. İlk araç/lisans ve paketleme aracı hazırlığı internet gerektirebilir.

Geliştirmede araçlar önce `vendor/windows-x64/` altında aranır; bulunamazsa PATH kullanılır. Paketli Windows uygulamasında `process.resourcesPath/tools` altındaki eksik araç hata üretir. yt-dlp güncellemesi yazılabilir kullanıcı veri kopyasına uygulanır; kurulum klasöründeki aracı değiştirme. Portable sürümün ayarları da kullanıcı profilinde tutulur.

- `dist/`, `dist-electron/`, `release/`, `vendor/windows-x64/` ve `node_modules/` üretilen/harici içeriktir; uygulama kaynakları yerine bunları elle düzenleme.
- `dist-electron/main.js` ve `dist-electron/preload.mjs` şu anda `.gitignore` kuralına rağmen Git tarafından izleniyor. Derlemeden sonra diff'i kontrol et; görev kapsamı dışındaki üretilmiş değişiklikleri teslimata katma ve kullanıcının mevcut değişikliklerini silme.
- `vite.config.ts` içindeki `base: './'`, paketli `dist/index.html` yüklemesi ve `preload.mjs` yolu birlikte çalışır. Kaynak/asset yollarını değiştirirken paketli açılışı doğrula.
- Paketler `release/<version>/` altına çıkar. Sürüm değişikliğinde `package.json` ile kilit dosyasını tutarlı tut; README'deki örnek dosya adlarını da gözden geçir.
- Araç hazırlığındaki mimari, sürüm, SHA-256 ve lisans bildirimlerini koru. Paketleme betiği `--publish never` kullanır; paket oluşturmak yayınlamak değildir.

## Değişiklik alanına göre manuel kontroller

1. **Kitaplık/oynatıcı:** Klasör seç, alt klasörleri ve Türkçe/boşluk içeren yolları dene; oynat/duraklat, önceki/sonraki, sarma, ses ve parça sonu geçişini kontrol et. Çalma sırasında klasör değiştirerek kuyruk davranışını doğrula.
2. **Kuyruk/çalma listeleri:** Kuyruğu sürükleyerek sırala ve karıştır. Sürükleme sırasında üst/alt yarıya göre görünen tema rengindeki çizgi ve Buraya taşı etiketinin bırakma konumuyla eşleştiğini; ilk/son konuma, satır arasına bırakmayı ve iptalde işaretin temizlenmesini kontrol et. Çalma listesi oluştur, parçalar ekle/çıkar, yeniden sırala, listeyi yeniden adlandır ve kaydet. Uygulamayı yeniden açıp listeleri yükle; liste silmenin ses dosyalarını etkilemediğini kontrol et. Geçici bir kitaplık kopyasında göreli yolların taşınabilirliğini dene.
3. **Kapak/arayüz:** Kapaklı ve kapaksız dosyaları, hızlı parça geçişlerini, boş kitaplığı ve dar pencereyi kontrol et. Açık/koyu tema, üç arka plan ve Sade seçeneğini; seçim menülerinin okunabilirliğini ve görünüm tercihlerinin yeniden açılışta korunmasını dene. Görev çubuğu kontrollerini etkileyen değişiklikleri Electron içinde dene.
4. **Arama/indirme:** Sonuçları, ayrı indirme klasörünü, başarılı MP3 çıktısını ve araç/ağ hatalarının arayüze yansımasını kontrol et. Çerez kullanımını yalnızca ilgili kullanıcı seçimiyle dene.
5. **İçe/dışa aktarma:** JSON dışa aktarımı, mevcut/eksik parça ayrımı, URL'siz parça tercihi, ilerleme bildirimi ve iptal edilen dosya diyaloğunu kontrol et. Yazma/indirme kontrollerinde geçici bir kitaplık kullan.
6. **Paketleme:** Portable ve setup çıktısını aç; asset/preload yüklemesini ve paketli araçlarla çalışmayı doğrula. Paket doğrulaması yapılmadıysa bunu açıkça belirt.

## İleride genişletirken dikkate alınacak mevcut sınırlar

`App.tsx` ve `electron/main.ts` çok sayıda sorumluluğu bir arada tutuyor. Büyük yeni özelliklerde ilgili bileşen/hook/servisi ayırmak uygun olabilir; küçük değişikliklere geniş kapsamlı refactor ekleme.

Tekrar düğmesinin modları kapalı, her parçayı bir kez tekrarla ve aynı parçayı sürekli tekrarla şeklindedir. Bir kez tekrar modunda sıra A → A → B → B şeklinde ilerler ve son parçada durur. Parça seçimi veya tekrar modu değiştiğinde tekrar sayacı sıfırlanır; duraklatıp sürdürmek sayacı korur. Beğen düğmesi çalan parçayı seçili kitaplığın Beğendiklerim listesine kaydeder, liste yoksa oluşturur ve aynı dosya yolunu ikinci kez eklemez. Listedeki parçanın kalbine yeniden tıklamak parçayı listeden çıkarır; liste boşalsa da korunur. Kalbin dolu veya boş görünümü yalnızca başarılı kayıttan sonra güncellenir.

Karıştırma kapatıldığında kuyruk mevcut çalma listesine değil, oynatılabilir kitaplık parçalarına döner. Bu mevcut davranıştır; yeni ürün gereksinimlerinde ayrıca değerlendir.

Ses dosyaları şu anda tamamen belleğe alınır. Renderer kapak önbelleği sınırsızdır; main tarafındaki toplu kapak çıkarımı paralel çalışır. Büyük kitaplık veya büyük dosya desteğinde bellek kullanımı, istek sayısı ve önbellek geçersizleştirmesi ayrıca değerlendirilmelidir.

IPC ve içe aktarılan JSON doğrulaması kapsamlı değildir; dosya yolları genel olarak kitaplık köküyle sınırlandırılmaz. State ve playlist yazmaları atomik/sıralanmış değildir; bazı playlist I/O hataları yalnızca loglanır. Genel indirme/güncelleme kilidi, zaman aşımı veya işlem iptali de yoktur. Bu alanları değiştiren görevlerde mevcut uygulamayı garantili kabul etme; gereken doğrulamayı ve eşzamanlılık davranışını açıkça tasarla.

Mimari, komutlar veya saklama biçimleri değiştiğinde bu rehberi de güncel tut. Teslimatta değişikliği, yapılan doğrulamayı ve doğrulanmayan ilgili davranışları kısa biçimde belirt.
