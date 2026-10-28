# Melodify

Windows için yerel müzik oynatıcısı ve müzik kütüphanesi uygulaması.

## Kullanıcılara verilecek dosyalar

`release/1.0.1/` klasöründe iki dağıtım bulunur:

- `Melodify-Windows-1.0.1-x64-Portable.exe`: Kurulum yapmadan çift tıklayarak açılır. Tek başına bu dosyayı paylaşabilirsiniz.
- `Melodify-Windows-1.0.1-x64-Setup.exe`: Melodify'ı bilgisayara kurar ve kısayol oluşturur. Ek araç kurulumu istemez.

Her iki paket de Electron, Node.js, yt-dlp, FFmpeg ve ffprobe içerir. Kullanıcıların Node.js, Python veya FFmpeg kurmasına gerek yoktur. Windows 10/11 64 bit hedeflenir.

Yerel müzikleri dinlemek için internet gerekmez. Çevrimiçi arama, indirme ve yt-dlp güncellemesi internet gerektirir. Taşınabilir sürüm açılırken içeriğini geçici klasöre çıkardığı için ilk açılış biraz sürebilir. Ayarlar ve güncellenen yt-dlp, Windows kullanıcı profilindeki uygulama veri klasöründe tutulur; taşınabilir dosyanın yanına yazılmaz.

`win-unpacked/Melodify.exe` tek başına dağıtılmaz; o sürüm bütün `win-unpacked` klasörüne ihtiyaç duyar.

Paketler kod imzalama sertifikası olmadan üretildiğinde Windows indirme veya açılış sırasında yayıncı uyarısı gösterebilir.

## Windows paketini yeniden oluşturma

Bu gereksinimler yalnızca **derleme bilgisayarı** içindir:

- Windows x64 ve Node.js 22 veya üzeri.
- PATH içinde Windows x64 `yt-dlp.exe`, `ffmpeg.exe` ve `ffprobe.exe`.
- İlk hazırlıkta bağımlılık ve lisans dosyalarını indirmek için internet.

```powershell
cd melodifyFrontend
npm ci
npm run build
```

Bu komut hem taşınabilir hem kurulumlu paketi üretir. Yalnızca taşınabilir paket için:

```powershell
npm run build:portable
```

Araçlar PATH içinde değilse üçünü aynı klasöre koyup konumunu belirtin:

```powershell
$env:MELODIFY_TOOLS_DIR = 'C:\MelodifyTools'
npm run build
```

`prepare:tools` araçları `vendor/windows-x64/` içine kopyalar, mimari ve sürüm kontrolü yapar; sürümleri, SHA-256 özetlerini ve lisans bildirimlerini paket için hazırlar. Node.js yürütücüsü derlemeyi çalıştıran Node.js'ten alınır. Bu klasör ve `release/` Git'e eklenmez. yt-dlp güncellemeleri paket içindeki dosyayı değiştirmek yerine kullanıcı veri klasöründeki kopyayı günceller.

Yeni sürüm için `package.json` içindeki `version` alanını değiştirip aynı komutu çalıştırın; çıktı klasörü ve dosya adları sürüm numarasını izler.

## Geliştirme

```powershell
npm run dev
npm run lint
npm run build:app
```

`build:app` yalnızca arayüzü ve Electron kodunu derler; dağıtılabilir exe üretmez. Geliştirmede hazırlanmış araçlar yoksa yt-dlp, Node.js ve FFmpeg sistem PATH'inden kullanılır.

Uygulama simgesinin kaynağı `public/melodify-icon.svg` dosyasıdır. Değiştirdikten sonra `npm run generate:icons` ile PNG ve çok boyutlu Windows ICO dosyalarını yenileyin, ardından Windows paketini tekrar derleyin.

Geliştirme, portable ve kurulu sürüm Windows görev çubuğunda ayrı gruplar kullanır; kurulu eski bir sürümün simgesi geliştirme/portable penceresine taşınmaz. Kurulu sürümün simgesini güncellemek için yeni setup paketini çalıştırın.

Windows görev çubuğunda Melodify'ın üzerine gelerek küçük pencere önizlemesindeki önceki parça, oynat/duraklat ve sonraki parça düğmelerini kullanabilirsiniz. Bu kontroller uygulama küçültülmüşken de çalışır; parça seçilmemişse pasif görünür.

Görev çubuğu değişikliklerini Windows'ta `npm run build:app` ardından `npm run check:taskbar` ile doğrulayın. Bu kontrol ayrı bir geçici profil kullanır; gerçek Windows TaskbarButtonCreated bildirimi gelmeden hiçbir thumbnail API çağrısı yapılmadığını, tıklama bildiriminin gerçek oynatıcıyı kontrol ettiğini ve gizle/göster sonrasında düğmelerin yeniden kurulduğunu sınar. Fareyle açılan küçük pencere önizlemesindeki görünürlüğü ayrıca elle kontrol edin.
