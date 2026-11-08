# Melodify Android mobil sürümü geliştirme planı

Oluşturulma tarihi: 8 Kasım 2026.

Durum: Mimari temel ve adım 1–4 tamamlandı. Telefon arayüzü 10.000 parçalık yerel test verisi ve gerçek ARM64/API 33 telefonda doğrulandı; güncel geliştirme sürümü telefona yüklendi. Kullanıcının adım sonunda durma isteğine uyularak adım 5'e geçilmedi. Kalıcı indirme servisi, native listeler/aktarım, çerezler ve release kabulü sonraki aşamalarda.

Bu belge sonraki geliştirme oturumlarının kalıcı referansıdır. Bir aşamaya başlamadan önce gerçek kaynak kodu ve aşağıdaki ilerleme kaydı birlikte kontrol edilmeli; yapılan işler ve doğrulama sonuçları oturum sonunda güncellenmelidir. Planın kaydedilmiş olması bütün aşamaların kendiliğinden başlatılması anlamına gelmez; kullanıcının güncel görev kapsamı esas alınır.

**Telefonda işlem yetkisi — 8 Kasım 2026:** Kullanıcının talimatı [proje kökündeki kalıcı yönergelere](../AGENTS.md) kaydedildi. Telefonda yalnızca Melodify'ı yükleme, çalıştırma ve hata ayıklama işlemleri yapılabilir. Dosya silme (uygulamayı kaldırma veya verilerini temizleme dahil), başka uygulamalara müdahale ve sistem ayarı değişiklikleri için işlemden önce kullanıcıdan açık onay alınmalıdır. Bu plandaki cihaz testleri ve temizlik senaryoları bu talimatı geçersiz kılmaz.

## 1. Teknoloji seçimi ve hedef

**Tercih: mevcut React + TypeScript + Capacitor yapısını korumak; Android özelliklerini Kotlin ile geliştirmek.**

Projede Capacitor 8.5.3 tabanlı, yalnızca karşılama ekranı gösteren bir Android başlangıcı zaten bulunuyor. React Native'e geçiş mevcut HTML/CSS ekranlarının yeniden yazılmasını gerektirir; indirme, dosya erişimi ve arka plan oynatma için yine native geliştirme gerekir. Bu proje için Capacitor temelini genişletmek daha uygun. Kotlin servislerine erişim, tipli Capacitor eklentileri üzerinden sağlanacak. [Capacitor native entegrasyonu](https://capacitorjs.com/docs/android/custom-code)

Kullanıcıyla netleştirilen kapsam:

- İlk sürüm **Android** için hazırlanacak ve **imzalı APK** olarak teslim edilecek.
- Arama, indirme ve MP3 dönüşümü **telefon üzerinde** çalışacak.
- Müzikler kullanıcının seçtiği klasörde saklanacak; uygulama kaldırıldığında dosyalar kalacak.
- Kitaplık klasörü ve indirme klasörü ayrı seçilebilecek.
- `cookies.txt` içe aktarma ve silme desteklenecek.
- Arayüz Türkçe olacak; mevcut görsel kimlik ve müzik işlevleri korunacak.
- Mevcut minimum Android API 24 ve hedef API 36 esas alınacak.

Başarı ölçütü: Kullanıcının telefonda müzik arayıp indirebilmesi, indirdiği parçayı internetsiz ve ekran kapalıyken dinleyebilmesi, kuyruk ve listelerini yönetebilmesi.

8 Kasım 2026 tarihli planlama sırasında mevcut `npm.cmd run lint` ve `node node_modules/typescript/bin/tsc --noEmit --project tsconfig.mobile.json` kontrolleri geçti. Native indirme, cihaz davranışı ve release APK henüz doğrulanmış değil. Bu kayıt sonraki kod değişikliklerinin doğrulandığı anlamına gelmez.

## 2. İlk aşama: proje dosyaları ve mimari temel

Mevcut mobil giriş genişletilecek. İlk çalışma, aşağıdaki sorumlulukları ayıran dosyaların ve çalışır uygulama iskeletinin hazırlanması olacak:

```text
mobile/src/
  app/                  Uygulama başlangıcı, gezinme ve tema
  components/           Ortak telefon bileşenleri
  features/
    library/            Kitaplık
    player/             Mini ve tam ekran oynatıcı
    playlists/          Listeler ve beğeniler
    downloads/          Arama, indirme ve iş durumları
    transfer/           JSON içe/dışa aktarma
    settings/           Klasörler, görünüm, çerezler ve araçlar
  platform/             Tipli native köprüler ve adaptörler
  styles/               Mobil yerleşim ve tasarım değişkenleri

src/shared/              Ortak sözlük, aktarım tipleri ve saf yardımcılar

android/.../melodify/
  bridge/               Capacitor eklentileri
  library/              Klasör erişimi, tarama ve kapaklar
  playback/             Media3 oynatıcı ve medya oturumu
  downloads/            İndirme motoru, kuyruk ve servis
  data/                 Room veritabanı ve kalıcı ayarlar
```

Mobil kod Electron'a veya `window.melodifyApi` köprüsüne bağlanmayacak. Masaüstünden yalnız ihtiyaç duyulan saf yardımcılar, veri sözlüğü ve tasarım değerleri paylaşılacak.

**Native arayüzler şu sorumluluklarla oluşturulacak:**

| Arayüz | İşlemler |
| --- | --- |
| Kitaplık | Klasör seçme, tarama, yenileme, kapak ve erişim durumu |
| Oynatıcı | Kuyruk yükleme, oynatma, duraklatma, sarma, sıralama, tekrar ve karıştırma |
| İndirme | Arama, sıraya ekleme, iptal, yeniden deneme, durum ve ilerleme |
| Listeler | Oluşturma, düzenleme, silme, parça ekleme/çıkarma |
| Aktarım ve ayarlar | JSON aktarımı, klasörler, çerez dosyası ve araç güncellemesi |

Masaüstündeki mutlak dosya yolu tabanlı kimlik yerine mobilde **kalıcı parça kimliği, kitaplık kimliği ve `contentUri`** ayrı tutulacak. Mevcut masaüstü tipleri bozulmadan mobil tipler eklenecek.

Oynatıcı ve indirme durumlarının sahibi native katman olacak. React, komut gönderecek ve durum görüntüleyecek; uygulama yeniden öne geldiğinde güncel durumun tamamını okuyacak.

**Aşama çıktısı:** Gezinebilir mobil iskelet, kayıtlı native eklentiler, temel veri sözleşmeleri ve güncellenmiş [mobil geliştirme rehberi](MOBILE.md).

## 3. Sıralı mobil kodlama adımları

### Adım 1 — İndirme motorunun telefonda çalıştığını kanıtlama

Tam ekran geliştirmesinden önce, basit bir deneme ekranıyla şu akış tamamlanacak:

**Arama → sonuç seçimi → indirme → MP3 dönüşümü → kapak/metadata → seçilen klasöre yazma → çevrimdışı oynatma.**

- Kotlin üzerinden `youtubedl-android` yürütme katmanı kullanılacak.
- Python, FFmpeg, ffprobe ve QuickJS Android'e uygun paketlenecek.
- Başlangıç yt-dlp paketi, EJS bileşenlerini içeren resmî zipimport dağıtımı olacak; Python 3.11+ uyumluluğu doğrulanacak. YouTube desteği için JavaScript çalışma zamanı ve EJS çözümleyicisi de gereklidir. [yt-dlp gereksinimleri](https://github.com/yt-dlp/yt-dlp#dependencies), [EJS kurulumu](https://github.com/yt-dlp/yt-dlp/wiki/EJS)
- MP3 kalite ayarı `0`, JPG kapak, metadata ve mevcut `%(title)s [%(id)s].%(ext)s` adlandırması korunacak.
- Araç sürümleri ve hash değerleri kayıt altına alınacak; kabul testinden geçen paket sabitlenecek.

Upstream FFmpeg paketinde bildirilen eksik `libc++_shared.so` sorunu ayrıca kontrol edilecek. Gerekiyorsa sabitlenmiş kaynaklardan düzeltilmiş Android paketi üretilecek. [İlgili sorun kaydı](https://github.com/yausername/youtubedl-android/issues/369)

**Geçiş koşulu:** Gerçek ARM64 telefonda MP3, kapak ve metadata doğrulanmadan sonraki kapsamlı geliştirme adımlarına geçilmeyecek. İptal edildiğinde Python, FFmpeg ve QuickJS süreçlerinin tamamının durduğu da kanıtlanacak.

### Adım 2 — Klasör erişimi ve kalıcı veri

- Kitaplık ve indirme hedefi Android'in sistem klasör seçicisiyle seçilecek.
- Kalıcı okuma/yazma URI izinleri alınacak; son seçimler yeniden açılışta korunacak. Bu yaklaşım seçilen klasöre erişim sağlar. [Android SAF belgeleri](https://developer.android.com/training/data-storage/shared/documents-files)
- Alt klasör taraması, arama, sıralama ve mevcut ses uzantıları taşınacak.
- İzin kaldırılması, klasörün taşınması, SD kartın çıkarılması ve dosyanın silinmesi ayrı durumlar olarak gösterilecek.
- Room; parça indeksi, iş kayıtları ve oynatıcı kurtarma durumunu saklayacak. Kapak önbelleği boyutla sınırlandırılacak.

FFmpeg geçici gerçek dosya yollarında çalışacak. Tamamlanan çıktı, native akışla seçilen klasöre yazılacak; `content://` URI doğrudan dosya yolu gibi kullanılmayacak.

**Aşama çıktısı:** Uygulama yeniden açıldığında seçilen kitaplığı bulabilen, dosyaları tarayan ve izin kaybını yönetebilen veri katmanı.

### Adım 3 — Native oynatıcı ve arka planda çalma

Media3 ExoPlayer ve ayrı bir `MediaSessionService` geliştirilecek. Oynatıcı, ekranın ve React yaşam döngüsünün dışında çalışacak. [Android arka plan oynatma yaklaşımı](https://developer.android.com/media/media3/session/background-playback)

- Oynat/duraklat, önceki/sonraki, sarma, süre ve ses kontrolü eklenecek.
- Bildirim, kilit ekranı ve kulaklık komutları aynı oynatıcı durumunu yönetecek.
- Telefon araması, ses odağı kaybı ve kulaklık çıkarılması ele alınacak.
- Ses dosyasının tamamı JavaScript belleğine alınmayacak; URI üzerinden oynatılacak.
- Son kuyruk ve konum saklanacak; süreç kaybından sonra kullanıcı oynatmayı sürdürebilecek.

Mevcut davranışlar özellikle korunacak:

- "Bir kez tekrar": **A → A → B → B → dur**.
- Sürekli tekrar: aynı parçanın tekrar çalması.
- Önceki düğmesi, konum üç saniyeyi geçmişse parçayı başa alması.
- Elle sonraki/önceki geçişinin kuyruk uçlarında dönmesi; otomatik bitişin son parçada durması.
- Karıştırma kapatılınca oynatılabilir kitaplık sırasına dönülmesi.
- Kitaplık değişiminin mevcut kuyruğu ve çalan parçayı silmemesi.

**Aşama çıktısı:** Ekran kapalıyken kuyruk geçişlerini sürdüren ve sistem medya kontrollerinden yönetilebilen oynatıcı.

### Adım 4 — Telefon arayüzü

Alt gezinme **Kitaplık / Ara ve indir / Listeler / Sıra** şeklinde kurulacak. Ayarlar üst bölümden açılacak.

| Ekran | Telefon düzeni |
| --- | --- |
| Kitaplık | Arama, sıralama, klasör işlemleri ve sanallaştırılmış parça listesi |
| Ara ve indir | Arama sonuçları, indirme düğmeleri ve bağımsız indirme geçmişi |
| Listeler | Liste kartları; detayda çal, karıştır, düzenle ve parça yönetimi |
| Sıra | Aktif parça, yeniden sıralama ve doğrudan parça seçimi |
| Oynatıcı | Sabit mini oynatıcı; dokununca tam ekran kontroller |
| Ayarlar | Klasörler, görünüm, çerezler, araç sürümleri ve güncelleme |

Koyu/Aurora varsayılanı, açık tema ve mevcut arka plan seçenekleri korunacak. Dokunma alanları en az 48 dp olacak; büyük yazı, ekran okuyucu, Android geri hareketi, klavye ve ekran kenarı boşlukları desteklenecek.

Kuyruk ve liste sıralaması dokunma tutamacıyla yapılacak; erişilebilirlik için "yukarı/aşağı taşı" işlemleri de bulunacak.

**Aşama çıktısı:** Küçük telefon ekranında tüm temel işlevlere erişilebilen, mini oynatıcısı sürekli kullanılabilir arayüz.

### Adım 5 — Kalıcı indirme kuyruğu ve hata yönetimi

İlk prototip, tam indirme sistemine dönüştürülecek.

- Aynı anda tek indirme/dönüştürme çalışacak; diğer işler kalıcı sırada bekleyecek.
- Her iş; kaynak, hedef, aşama, ilerleme, hata ve çıktı URI'sini taşıyacak.
- Hazırlama, indirme, dönüştürme ve kaydetme aşamaları ayrı gösterilecek.
- Aynı hedefte mevcut olan aynı YouTube parçası yeniden indirilmeden kullanılacak.
- İptal, sınırlı ağ yeniden denemesi ve kullanıcı tarafından yeniden başlatma desteklenecek.
- Yarım çıktı kitaplığa eklenmeyecek. Hedef dosya yazılmadan önce bekleyen kayıt oluşturulacak; açılışta yarım yazmalar temizlenecek veya tamamlanmış çıktı uzlaştırılacak.

İndirme ve ona bağlı dönüşüm, ayrı bir `dataSync` foreground servisinde çalışacak. Başlatma kullanıcı işlemiyle yapılacak; oynatıcının servisi ve bildirimi ayrı kalacak. Android bu servis türünde indirme ve yerel dosya işlemeyi destekler. [Servis türleri](https://developer.android.com/develop/background-work/services/fgs/service-types#data-sync)

Sistem zaman aşımı veya zorla durdurma sonrasında iş "kesintiye uğradı" olarak korunacak; uygulama açıldığında kullanıcı sürdürebilecek. Servis zaman aşımında süreçler sonlandırılıp servis kapatılacak. [Android zaman aşımı davranışı](https://developer.android.com/develop/background-work/services/fgs/timeout)

**Aşama çıktısı:** Ekran değişiminden etkilenmeyen, bildirimden izlenebilen ve başarısız işleri kurtarılabilen indirme sistemi.

### Adım 6 — Çalma listeleri, beğeniler ve JSON aktarımı

- Liste oluşturma, ad/açıklama düzenleme, silme, parça ekleme/çıkarma ve sıralama taşınacak.
- Beğendiklerim başarılı kayıttan sonra güncellenecek; aynı parça tekrar eklenmeyecek.
- Liste silmek veya listeden parça çıkarmak ses dosyasını silmeyecek.
- Mevcut kök ve alt klasör playlist JSON biçimleri okunup yazılacak; ID ve göreli yol uyumluluğu korunacak. Yazmalar sıraya alınacak, hatalar kullanıcıya bildirilecek.
- Kütüphane JSON şeması `1.0` korunacak; Windows ve Android arasında karşılıklı aktarım test edilecek.
- İçe aktarma mevcut parçaları dosya adı/YouTube ID ile eşleştirecek; eksikleri **kitaplık klasörüne** indirecek.
- Bağlantısı bulunmayan parçalar için adla arama, kullanıcının seçimine bağlı kalacak.

**Aşama çıktısı:** Kalıcı listeler ve masaüstüyle uyumlu kitaplık aktarımı.

### Adım 7 — Çerezler ve indirme aracı güncellemeleri

- Kullanıcı sistem dosya seçicisinden Netscape biçimindeki `cookies.txt` dosyasını alabilecek.
- Dosya uygulamaya özel, yedek dışında tutulan alana kopyalanacak; görüntülenebilen bilgi yalnız yüklenme durumu olacak.
- Çerez silme ve değiştirme, aktif işlemlerle çakışmayacak; içerik loglara yazılmayacak.
- Oturum gereksinimi, geçersiz çerez, erişilemeyen içerik ve ağ hataları Türkçe açıklanacak.

Araç güncellemesi için kullanıcı tarafından başlatılan **stable kanal** kullanılacak. Yeni yt-dlp paketi imza/hash ve çalışma zamanı uyumluluğu doğrulandıktan sonra etkinleştirilecek; başarısız güncelleme mevcut çalışan sürümü koruyacak. Arama/indirme sırasında güncelleme yapılmayacak. Native Python, FFmpeg ve QuickJS değişiklikleri imzalı APK güncellemesiyle dağıtılacak.

**Aşama çıktısı:** Yönetilebilir oturum desteği ve geri alınabilir indirici güncelleme akışı.

## 4. Testler ve kabul koşulları

Otomatik testler, kritik davranışlara odaklanacak:

- **React testleri:** Gezinme, oynatıcı durumları, indirme ilerlemesi ve hata/izin ekranları.
- **Kotlin testleri:** Kuyruk/tekrar kuralları, iş durumları, iptal, yeniden açılış kurtarması ve JSON eşleştirmesi.
- **Cihaz testleri:** Klasör seçimi, native köprüler, gerçek dosya yazma, oynatma ve servis yaşam döngüsü.
- **Masaüstü regresyonu:** Ortak kod değişikliklerinde mevcut lint, TypeScript ve uygulama build kontrolleri.

Release kabul senaryoları:

1. Gerçek telefonda arama, MP3 indirme, kapak/metadata ve uçak modunda oynatma.
2. Ekran kapalıyken en az 30 dakika oynatma ve parçalar arasında otomatik geçiş.
3. Bildirim, kilit ekranı, Bluetooth/kulaklık ve ses odağı kontrolleri.
4. İndirme/dönüştürme sırasında iptal, ağ kopması, alan yetersizliği ve klasör izni kaybı.
5. Sürecin durması ve yeniden açılışta kuyruk/çıktı tutarlılığı.
6. Windows ↔ Android JSON aktarımı ve taşınabilir playlist uyumluluğu.
7. API 24, 29, 33 ve 34–36 davranışlarının kontrolü.
8. Tüm native bağımlılıkların 16 KB sayfalı ortamda doğrulanması. [Android 16 KB uyumluluğu](https://developer.android.com/guide/practices/page-sizes)
9. Büyük kitaplıkta akıcı kaydırma ve sınırlı bellek kullanımı.
10. Temiz kurulum ve aynı imzayla güncellemede verilerin korunması.

Canlı YouTube kontrolleri, ağdan bağımsız otomatik testlerden ayrı yürütülecek.

## 5. Son aşama: build, imzalama ve teslim

Geliştirme sırasında debug derlemeleriyle ara doğrulamalar yapılacak. **Son teslim build'i bütün kabul kontrollerinden sonra üretilecek.**

- Mevcut Android komutları korunacak; mobil test, native kontrol, release ve APK doğrulama komutları eklenecek.
- `versionName`, uygulama sürümüyle eşitlenecek; `versionCode` her release'te artırılacak.
- Debug sürümü ayrı `.debug` uygulama kimliği kullanacak.
- Release anahtarı güvenli yerel konumda tutulacak; parolalar ortam değişkenleri/CI secrets üzerinden alınacak.
- Release APK, ARM64 ve ARMv7 telefonları kapsayacak; x86_64 debug paketi emülatör testlerinde kullanılacak.
- Android CI; lint, tip kontrolü, otomatik testler ve debug build çalıştıracak.

Son doğrulama sırası:

```text
Bağımlılıkları kilit dosyasından kur
→ Lint ve TypeScript kontrolü
→ Mobil davranış testleri
→ Mobil web build
→ Android araç ve native test kontrolleri
→ Debug APK ve cihaz kabul testleri
→ Masaüstü regresyon build'i
→ İmzalı release APK
→ İmza, paket içeriği ve 16 KB uyumluluk kontrolü
→ Release APK ile temiz kurulum/güncelleme testi
```

**Teslim edilecekler:** Kurulabilir imzalı APK, SHA-256 özeti, sürüm notları, kurulum/güncelleme rehberi, araç sürüm ve lisans kayıtları, cihaz test sonuçları ve güncel geliştirme dokümantasyonu.

**Tamamlanma koşulu:** Teslim edilen release APK üzerinden müzik indirilebilmeli, dosya seçilen klasörde bulunmalı, internetsiz ve ekran kapalıyken çalınabilmeli; listeler, kuyruk ve aktarım işlevleri doğrulanmış olmalı.

## 6. İlerleme kaydı ve sonraki oturum

- [x] Mevcut proje ve mobil başlangıç yapısı incelendi.
- [x] Platform, bağımsız indirme, APK dağıtımı, klasör ve çerez tercihleri netleştirildi.
- [x] Geliştirme planı kalıcı olarak kaydedildi.
- [x] Proje dosyaları ve mimari temel hazırlandı (bölüm 2).
- [x] İndirme motoru gerçek telefonda doğrulandı (adım 1).
- [x] Klasör erişimi ve kalıcı veri tamamlandı (adım 2).
- [x] Native oynatıcı ve arka planda çalma tamamlandı (adım 3).
- [x] Telefon arayüzü tamamlandı (adım 4).
- [ ] Kalıcı indirme kuyruğu ve hata yönetimi tamamlandı (adım 5).
- [ ] Listeler, beğeniler ve JSON aktarımı tamamlandı (adım 6).
- [ ] Çerezler ve araç güncellemeleri tamamlandı (adım 7).
- [ ] Otomatik testler ve cihaz kabul senaryoları tamamlandı (bölüm 4).
- [ ] İmzalı APK oluşturuldu, doğrulandı ve teslim edildi (bölüm 5).

**Son kayıt — 8 Kasım 2026:**

- `mobile/src/` altında uygulama, ortak bileşen, özellik, platform ve stil katmanları ayrıldı. Dört ana sekme, Ayarlar, mini oynatıcı yerleşimi ve görünüm tercihleri eklendi. Tam telefon arayüzü (adım 4) tamamlanmış sayılmadı.
- Masaüstü tipleri korunarak mobil kimlik/content URI, kuyruk, indirme işi ve aktarım sözleşmeleri eklendi. Beş Kotlin Capacitor eklentisi kaydedildi; uygulanmayan işlemler açık hata döndürüyor. Öne dönüşte tüm native durumun yenilenmesi, protokol/veri kontrolü ve abonelik temizliği kuruldu.
- `Melodify Dev` (`com.yhcanbay.melodify.debug`, sürüm `1.0.1`) gerçek Redmi 12C, ARM64, API 33 telefona yüklendi ve açıldı. USB kurulum/bağlantı izinlerini kullanıcı telefondan verdi; telefon sistem ayarları komutla değiştirilmedi. Cihazda dosya silme veya uygulama verisi temizleme yapılmadı.
- Gerçek cihazda beş köprünün durum yanıtı, dört sekme, Ayarlar/geri düğmesi ve hata sözleşmeleri `android:check-bridge` ile doğrulandı. Bu kontrol fiziksel geri hareketi, oynatma veya indirme kabul testi değildir.
- Lint, mobil/masaüstü TypeScript, 9 mobil birim kontrolü, 13 mobil arayüz kontrolü, mobil web build, mimari temelin debug APK build'i ve masaüstü `build:app` kontrolü geçti.
- Adım 1 için `youtubedl-android:0.18.1` paketleri incelendi: ARM64 Python paketi Python 3.12 içeriyor. FFmpeg AAR'ında ve iç yükünde `libc++_shared.so` bulunmadığı doğrulandı; yerel NDK `28.2.13676358` çalışma zamanını derlemeye dahil eden hazırlık eklendi. Runtime düzeltmesinin telefonda çalışması henüz doğrulanmadı.
- Resmî `yt-dlp 2026.10.26` zipimport paketi SHA-256 ve EJS içeriğiyle doğrulandı. AAR ve NDK hashleri `android-tools.json` içine **kabul bekleyen aday** olarak kaydedildi; bu kayıt araç kabulünün tamamlandığı anlamına gelmez.
- Araç paketi ve doğrulama düğmesini içeren güncel debug APK derlendi, veriler temizlenmeden telefona güncellendi ve açıldı. Yeni pakette köprü/gezinme/hata kontrolleri geçti. APK'nın `extractNativeLibs=true` ayarı, üç ABI için C++ dosyaları ve gömülü yt-dlp SHA-256 değeri doğrulandı.
- Araç hazırlığı açılışta otomatik başlamıyor. Native kütüphane ilk hazırlıkta veya hatada kendi araç çalışma klasörlerini temizleyebildiğinden, telefondaki `initializeTools` denemesi öncesinde kullanıcının dosya silme sınırı ayrıca uygulanmalı.
- Kullanıcı, yalnızca Melodify'ın oluşturduğu uygulamaya özel araç/geçici çalışma dosyalarının bu araç doğrulama denemesi sırasında temizlenmesine açıkça onay verdi. Sınırlı onay proje kökündeki `AGENTS.md` dosyasına kaydedildi. Bu izin kişisel müziklere, seçilen klasörlere, diğer uygulamalara, uygulamayı kaldırmaya/verilerini tümüyle temizlemeye veya sistem ayarlarına genişletilemez.
- Gerçek telefonda araç doğrulaması geçti: Python `3.12.11`, yt-dlp `2026.10.26`, FFmpeg/ffprobe `7.1.1`, QuickJS `2025-04-26`; gerçek dosya SHA-256 değerleri `.cache/device-checks/android-tools.json` raporuna yazıldı. QuickJS `--help` çıktısının beklenen `1` dönüş kodu özel olarak doğrulandı.
- Upstream iptal yöntemine bağlı kalmadan, yalnızca Melodify'ın oluşturduğu süreç gruplarını yönetebilen küçük bir NDK/JNI denetleyici eklendi. Üç ABI için kaynaklardan derleniyor. Gerçek telefonda Python, FFmpeg ve QuickJS aynı anda çalıştırıldı; iptal sonrasında üçünün de durduğu doğrulandı (`.cache/device-checks/android-cancellation.json`). Bu sentetik süreç denemesi gerçek indirme/dönüştürme iptali kabulünü tek başına tamamlamaz.
- Basit arama/indirme ekranı, sistem klasör seçicisi ve yalnızca seçilen hedefe yazan SAF akışı eklendi. Kullanıcı hedefi kendisi seçti. Canlı arama, kısa test videosunun güncel `DTi8wZ1a1TA` kopyasını buldu; MP3 kalite `0`, `%(title)s [%(id)s].%(ext)s` adı, gömülü JPG kapak, başlık/sanatçı ve `9936 ms` süre doğrulandı. Hedef kopyanın SHA-256 değeri kaynakla aynı: `e190d38bfcc732925f6818954a56a531f4bb3284e3735d55c31353746302c696` (`.cache/device-checks/android-download.json`).
- Kullanıcı uçak modunu kendisi açıp Wi-Fi'yi kapattı. Kayıtlı `content://` dosyası MediaPlayer ile oynatıldı; konum `1529 ms` üzerine ilerledi ve duraklatma doğrulandı (`.cache/device-checks/android-offline-playback.json`). Android Wi-Fi durum kodu `3` uçak modunda kapalı durum olarak resmi kaynakla doğrulandı. Bu ön plandaki deneme, adım 3'ün Media3/arka plan oynatıcısı değildir.
- Kullanıcı interneti kendisi yeniden açtı. Gerçek indirme sırasında Python ve gerçek MP3 dönüşümü sırasında FFmpeg süreçleri uygulamanın kendi UID'sinde gözlendi; her iki aşamada arayüzün İptal et düğmesi kullanıldı. İşler `canceled` oldu, `outputUri=null` kaldı ve uygulamaya ait Python/FFmpeg/QuickJS süreçleri kalmadı (`.cache/device-checks/android-download-cancellation.json`). Dönüşümün gözlenebilmesi için yalnız debug denemesinde gerçek zamanlı FFmpeg girişi kullanıldı; normal indirmeler yavaşlatılmadı.
- Güncel lint, mobil TypeScript, 10 Node mobil testi, 13 arayüz kontrolü, 4 Kotlin/JUnit girdi testi ve debug APK derlemesi geçti. Windows'taki test argüman dosyası/kodlama sorunu yalnız test JVM'sinde `file.encoding=COMPAT` ile çözüldü; sistem ayarı değiştirilmedi. Masaüstü regresyon derlemesi mimari temel sırasında geçti.
- Mevcut test MP3'ü hedef klasörde korundu; kişisel dosya silme, başka uygulamaya müdahale veya komutla telefon ayarı değişikliği yapılmadı. Prototip işler/kuyruk bellekte tutulur; kalıcı kuyruk, tam kitaplık tarama ve arka plan oynatma henüz tamamlanmış sayılmaz.

- Adım 2'nin kaynakları eklendi: ayrı SAF kitaplık seçimi ve kalıcı izin, alt klasör taraması, masaüstü ses uzantıları, arama/sıralama, kalıcı UUID parça kimlikleri, izin/klasör/depolama/eksik dosya durumları. Başarısız tarama son indeksi korur. Room `2.8.5` ve KSP `2.2.10-2.0.2` ile kitaplık/parça/iş/kurtarma şeması oluşturuldu; yıkıcı migration yoktur. İndirme iş geçmişi artık Room'a yazılır; aktif eski işler yeniden açılışta `interrupted` olur. Tam kuyruk ve servis adım 5 kapsamında kalır.
- Kapaklar gömülü veya yan görselden alınır, 384 px JPEG'e küçültülür; 8 MB bellek önbelleği ve salt okunur uygulama içi ContentProvider kullanılır. Disk önbelleği veya telefon dosyası temizliği eklenmedi. İlk kitaplık ekranı 50'şer kayıt gösterir; tam sanallaştırma adım 4'te kalır.
- Adım 2 için lint, mobil/masaüstü TypeScript, 11 mobil Node testi, 13 arayüz kontrolü, 8 Kotlin/JUnit testi ve güncel debug APK derlemesi geçti. APK telefona veriler korunarak güncellendi; beş native köprü ve gezinme kontrolü yeniden geçti. Kullanıcıdan ayrı kitaplık seçimi istendi; gerçek tarama/kapak/Room yeniden açılış doğrulaması henüz yapılmadı.

**9 Kasım 2026 doğrulaması:** Kullanıcı kitaplık klasörünü ayrıca seçti. `--library-test` gerçek test MP3'ünü, yeniden taramada aynı UUID'yi, arama filtresini, 384 px sınırındaki gerçek JPEG kapağı ve ayrı indirme hedefinin korunmasını doğruladı. Yalnız Melodify süreci durduruldu; kendi Room dosyalarının bilgisayardaki salt okuma kopyasında SQLite bütünlüğü, dört veri tablosu, seçili kitaplık ve parça kaydı doğrulandı. Yeniden açılan farklı süreçte aynı kimlikler, klasör erişimi ve kapak tekrar doğrulandı (`android-library.json`, `android-library-storage.json`). Dosya silme, izin kaldırma, başka uygulamaya müdahale veya sistem ayarı değişikliği yapılmadı. Fiziksel SD çıkarma/izin kaldırma/klasör taşıma testleri yapılmadı; ilgili durum sınıflandırmaları Kotlin testleriyle kontrol edildi ve release kabulünde açık kalır.

- Adım 3'ün Media3 `1.11.1` ExoPlayer/MediaSessionService kaynakları, foreground medya servisi izinleri, güvenilir oturum erişimi, native komut doğrulaması ve temel Kitaplık/Oynatıcı/Sıra kontrolleri eklendi. Ses odağı ve kulaklık çıkarma yönetimi ExoPlayer'da etkin; uygulama sesi sistem sesi değiştirilmeden ayarlanır. Bir kez tekrar fiziksel `A,A,B,B` sırası, elle uçlarda dönme, 3 saniyelik önceki eşiği, sıralamada konum ve tekrar sayacı koruma Kotlin testleriyle kontrol edildi. Kitaplık seçimi oynatıcı kuyruğundan bağımsız kaldı.
- Gerçek telefonda kitaplıktaki dosyayı URI üzerinden oynatma, duraklatma/sarma, kendi MediaController'ından önceki/sonraki/oynat komutları, bir kez tekrarın ikinci çalmadan sonra durması, sürekli tekrar, uygulama sesi, karıştırma kapatma ve geçersiz komut reddi doğrulandı. Yalnız Melodify yeniden açılınca Room'dan aynı kuyruk ve yaklaşık `2400 ms` konum duraklatılmış olarak kurtarıldı; kullanıcı komutuyla bu konumdan sürdürme geçti (`android-native-playback.json`).
- Güncel lint, mobil/masaüstü TypeScript, 12 mobil Node testi, 13 arayüz kontrolü, 12 Kotlin testi, debug APK ve masaüstü regresyon build'i geçti. Ekran kapalı testi için yalnız debug sürümünde, otomatik duran ve yalnız kendi PID'sine tanı günlüğü yazan sınırlı deneme eklendi. Ekran kapalı doğrulaması henüz yapılmadığından adım 3 işaretlenmedi.

- Kullanıcı ekranı kendisi kapattı. Yalnız Melodify PID'sinin tanı günlüğünden ekran kapalı (`interactive=false`) `13647 ms` gerçek çalma ve bir otomatik tekrar gözlendi; kendi medya servisi `isForeground=true` kaldı (`android-background-playback.json`). Sonrasında yalnız uygulama oynatımı duraklatıldı. Telefon ekranı/ayarları komutla değiştirilmedi, dosya silinmedi. Bu kısa tek dosyalı servis kanıtı 30 dakikalık ve gerçek çok parçalı/Bluetooth/kulaklık/telefon araması release kabulünü tamamlamaz.

- Adım 4'te kitaplık sanallaştırması, klavyeyle ilk/son parça odağı, görünür satırlarla sınırlı kapak istekleri, 128 girişle sınırlı ortak kapak istek önbelleği, mini oynatıcıda ayrı oynat/duraklat ve tam oynatıcı kapağı eklendi. Kuyrukta dokunma/pointer tutamacı ve erişilebilir yukarı/aşağı düğmeleri uygulandı. Pointer yakalama dışında satıra geçen hareketler liste düzeyinde ele alınarak sürükleme düzeltildi.
- Android paketine girmeyen ayrı bir arayüz test derlemesinde 10.000 parça kullanıldı. Aynı anda 30'dan az satır/kapak isteği, sona kaydırma, filtreleme, Home/End odağı, mini/tam oynatıcı, on parçalı kuyrukta düğmeyle ve gerçek Chromium pointer olaylarıyla sıralama doğrulandı. Güncel mobil build ve 27 arayüz kontrolü geçti. Bu test verileri telefona yazılmadı. Son arayüz kodu henüz APK olarak telefona yüklenmedi.
- Kullanıcı 9 Kasım 2026'da mevcut adımın sonunda durulmasını ve sonraki adıma geçilmemesini istedi; telefonu başka işlerinde kullanacak. Bu istekten sonra yeni telefon işlemi başlatılmadı. Arayüzün mevcut değişiklikleri yerelde toparlanıp çalışma durduruldu. Adım 4'ün tamamı veya cihaz kontrolü yapılmış gibi işaretlenmedi.

**Adım 4 tamamlanışı — 9 Kasım 2026:**

- Kullanıcı “devam edebilirsin reis” diyerek çalışmayı yeniden başlattı. Bu tur yalnız adım 4'ü bitirip durma kapsamıyla yürütüldü.
- Liste kartları, ayrıntı, oluşturma/düzenleme, parça ekleme/çıkarma, sıralama ve silme onayı arayüzleri mevcut tipli sözleşmelere bağlandı. Native liste motoru adım 6'da kalır; cihazda `not-implemented` olduğu için bu işlemler açılmaz. Bu ekranların davranışları yalnız ayrı yerel test derlemesindeki bellek verisiyle doğrulandı; telefonda liste veya dosya silme işlemi yapılmadı.
- Liste ayrıntısı → Ayarlar/oynatıcı → geri zinciri ve modal iptali kuruldu. Konum/ses sürgüsü hareket bitiminde komut gönderir; parça değişince önceki kapağın görünmesi önlendi. Kuyruk 50'şer parçayla sayfalanır; tüm parçalar üzerinde sıralama kimlikleri korunur. Ayarlar'dan kitaplık ve indirme hedefi ayrı değiştirilebilir; çalışan işlemlerde seçim düğmeleri pasiftir.
- Uzun başlıklarda temel oynatma düğmeleri ilk ekranda kalacak şekilde kapak ve başlık düzeni daraltıldı; kitaplık klasör işlemleri açılır bölüme alındı. 320 px ve 24 px kök yazıyla taşma/dokunma hedefi kontrolleri geçti. Görünüm tercihleri korundu.
- Güncel lint, mobil/masaüstü ve test verisi TypeScript, 13 Node davranış testi, 43 arayüz senaryosu, masaüstü regresyon build'i ve debug APK build'i geçti. 10.000 parçalık fixture Android paketine girmez. Güncel APK telefona veriler korunarak yüklendi.
- Gerçek telefonda kitaplık taraması/kalıcı kimlik, gerçek JPEG kapak, mini oynatıcıdan duraklatma, tam oynatıcıdan `2400 ms` sarma ve native konumun ekrana yansıması doğrulandı. Ana düğmelerin ilk ekranda görünmesi, büyük yazıda yatay taşmama, en az 48 px hedefler, erişilebilirlik ağacındaki sürgü ve yalnız kendi Activity'sinin geri dispatcher'ı kontrol edildi (`android-phone-ui.json`, `mobile-player.png`). Gerçek Android klavyesinde görünür alan `753.5 → 495.5 px` oldu ve arama alanı görünür kaldı (`android-keyboard.json`). TalkBack/sistem yazı ayarı değiştirilmedi; fiziksel ekran okuyucu kabulü ayrıca yapılmadı.
- Test sonunda yalnız Melodify oynatımı duraklatıldı. Dosya silme, uygulama verisi temizleme, başka uygulamaya müdahale veya sistem ayarı değişikliği yapılmadı. İstendiği gibi adım 5 başlatılmadan duruldu.

**Kullanıcı yeniden devam ederse:** Sıradaki iş adım 5: tek aktif işli kalıcı indirme kuyruğu, dataSync foreground servisi, iptal/yeniden deneme ve kesinti kurtarması. Native listeler/aktarım adım 6, çerez/araç güncelleme adım 7'de kalır. Release için 30 dakika, çok parçalı gerçek akış, Bluetooth/kulaklık/arama, farklı API/16 KB ve fiziksel erişim kaybı kontrolleri açık. Telefon işlemlerinde genel sınırları ve yalnız önceki araç denemesine verilmiş sınırlı onayın kapsamını koru; yeni temizlik gereksinimini otomatik yetki sayma.
