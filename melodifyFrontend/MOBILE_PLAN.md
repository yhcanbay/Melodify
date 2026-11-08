# Melodify Android mobil sürümü geliştirme planı

Oluşturulma tarihi: 8 Kasım 2026.

Durum: Plan kaydedildi; aşağıdaki uygulama aşamaları henüz tamamlanmadı. Mevcut Android başlangıç projesi yalnızca karşılama ekranını içeriyor.

Bu belge sonraki geliştirme oturumlarının kalıcı referansıdır. Bir aşamaya başlamadan önce gerçek kaynak kodu ve aşağıdaki ilerleme kaydı birlikte kontrol edilmeli; yapılan işler ve doğrulama sonuçları oturum sonunda güncellenmelidir. Planın kaydedilmiş olması bütün aşamaların kendiliğinden başlatılması anlamına gelmez; kullanıcının güncel görev kapsamı esas alınır.

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
- [ ] Proje dosyaları ve mimari temel hazırlandı (bölüm 2).
- [ ] İndirme motoru gerçek telefonda doğrulandı (adım 1).
- [ ] Klasör erişimi ve kalıcı veri tamamlandı (adım 2).
- [ ] Native oynatıcı ve arka planda çalma tamamlandı (adım 3).
- [ ] Telefon arayüzü tamamlandı (adım 4).
- [ ] Kalıcı indirme kuyruğu ve hata yönetimi tamamlandı (adım 5).
- [ ] Listeler, beğeniler ve JSON aktarımı tamamlandı (adım 6).
- [ ] Çerezler ve araç güncellemeleri tamamlandı (adım 7).
- [ ] Otomatik testler ve cihaz kabul senaryoları tamamlandı (bölüm 4).
- [ ] İmzalı APK oluşturuldu, doğrulandı ve teslim edildi (bölüm 5).

**Son kayıt — 8 Kasım 2026:** Plan dosyası ve dokümantasyon bağlantıları oluşturuldu. Bu kayıt sırasında uygulama kodu değiştirilmedi ve yeni build/cihaz testi yapılmadı.

**Sıradaki uygulama işi:** Kullanıcı mobil geliştirmeye devam edilmesini istediğinde bölüm 2'deki proje dosyaları ve mimari temel ile başla; ardından adım 1'deki gerçek cihaz indirme doğrulamasını tamamla. İlerleme işaretlerini yalnız ilgili çıktı ve doğrulamalar gerçekten tamamlandığında güncelle.
