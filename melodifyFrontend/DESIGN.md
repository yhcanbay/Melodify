# Melodify Studio

Varsayılan görünüm gece tonları, lavanta ışığı ve sıcak mercan vurgularını kullanır.
Plak zarfı biçimindeki kitaplık görseli ve ayrı dinleme konsolu kimliği tamamlar.
Sıcak kâğıt teması üst çubuktaki güneş/ay düğmesiyle seçilebilir.
`src/Studio.css` yerleşim ve açık tema, `src/Appearance.css` koyu tema ve ortam
katmanıdır. Temel bileşenler `src/App.css` içindeki ortak stilleri kullanır.

React Bits'teki [Spotlight Card](https://reactbits.dev/components/spotlight-card),
[Gradient Text](https://reactbits.dev/text-animations/gradient-text) ve
[Grainient](https://reactbits.dev/backgrounds/grainient) örneklerinden ilham alınmıştır.
Uygulama geneli için [Aurora](https://reactbits.dev/backgrounds/aurora),
[Dark Veil](https://reactbits.dev/backgrounds/dark-veil) ve
[Floating Lines](https://reactbits.dev/backgrounds/floating-lines) fikirleri uyarlanmıştır.
`src/components/VisualEffects.tsx` bu etkileşim fikirlerini yerel React ve CSS
ile uygular; React Bits kaynak kodu veya WebGL bağımlılığı içermez.

Üst çubukta Aurora, Gece perdesi, Akış çizgileri veya Sade arka planı seçilir.
Yalnızca seçilen dekoratif katman gösterilir; Sade tüm genel arka plan katmanlarını
kapatır. Tema ve arka plan `melodify.appearance` anahtarıyla saklanır. HTML tema
nitelikleri ilk çizimden önce uygulanır; geçersiz kayıt açılışı engellemez.

İmleç ışığı DOM üzerindeki CSS değişkenleriyle güncellenir; React state veya
sürekli JavaScript animasyon döngüsü çalıştırmaz. Dekoratif katmanlar tıklamaları
engellemez. Hareketler `prefers-reduced-motion` tercihine uyar. Yazı tipleri ve
dekoratif görseller yereldir; arayüzün açılması internet bağlantısı gerektirmez.
