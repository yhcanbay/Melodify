# Melodify proje yönergeleri

Bu dosya projenin tamamında geçerlidir. `melodifyFrontend/` altındaki çalışmalarda ayrıca [geliştirme rehberini](melodifyFrontend/AGENTS.md) ve Android görevlerinde [mobil geliştirme planını](melodifyFrontend/MOBILE_PLAN.md) oku.

## Oturumun durdurma isteği — 9 Kasım 2026

Kullanıcı mevcut adımın sonunda sonraki adıma geçmeden durulmasını istedi; telefonu başka işleri için kullanacak. Çalışma durdurulduktan sonra 9 Kasım 2026'da “devam edebilirsin reis” diyerek yeniden başlattı. Adım 4'ün arayüz ve cihaz doğrulamaları tamamlandı ve istendiği gibi duruldu. Kullanıcı yeniden devam demeden adım 5 veya yeni cihaz işlemi başlatılmayacak. Kalan işler `melodifyFrontend/MOBILE_PLAN.md` içinde tutulur.

## Telefonda işlem sınırları

Kullanıcının 8 Kasım 2026 tarihinde bu proje için kalıcı olarak kaydedilmesini istediği talimat:

> Telefonda yalnızca bu uygulamayı yükleme, çalıştırma ve hata ayıklama işlemleri yap. Dosya silme, başka uygulamalara müdahale etme veya sistem ayarlarını değiştirmeden önce benden onay al.

- Telefonda verilen yetki yalnızca Melodify uygulamasını yüklemeyi, çalıştırmayı ve hata ayıklamayı kapsar.
- Herhangi bir dosyayı silmeden, başka uygulamalara müdahale etmeden veya sistem ayarlarını değiştirmeden önce ilgili işlem için kullanıcıdan açık onay al.
- Melodify'ı kaldırmak, uygulama verilerini temizlemek veya test dosyalarını silmek de veri silme kapsamındadır; yükleme ya da hata ayıklama yetkisi bu işlemlere onay sayılmaz.
- Bu kural sonraki geliştirme ve cihaz testi oturumlarında da uygulanır. Telefon üzerinde yapılacak işlemleri bu sınırlar içinde tut.

### Araç doğrulama denemesi için sınırlı onay — 8 Kasım 2026

Kullanıcı, Android araç doğrulama denemesi boyunca yalnızca Melodify'ın kendi oluşturduğu uygulamaya özel araç ve geçici çalışma dosyalarının temizlenmesine açıkça izin verdi: “Evet, yalnızca bu dosyalar için izin veriyorum.” Bu onay yalnızca bu denemenin araç çalışma alanını kapsar; müzik dosyalarına, kullanıcının seçtiği klasörlere, başka uygulamalara, uygulamayı kaldırmaya/verilerini tümüyle temizlemeye veya sistem ayarlarına genişletilemez. Genel telefon sınırları geçerliliğini korur.
