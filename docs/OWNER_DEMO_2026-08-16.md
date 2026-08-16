# Orka EMS Fitness — İşletme Sahibi Sunumu
## 16 Ağustos 2026, Pazar akşamı

> ⚠️ Bu bir **önizleme demosudur**, üretim sürümü değildir.
> Kimlik doğrulama sahtedir, veriler ayrı bir demo veritabanındadır,
> isimler ve telefonlar kurgudur. Canlı site (`orkafitness.vercel.app`)
> bu çalışmadan hiç etkilenmedi.

---

## Toplantıdan önce (5 dakika)

1. **Preview'ı aç** (Mac) — aşağıdaki URL. Açılıyorsa devam.
2. **Demoyu sıfırla** — Yönetici → Ayarlar → DEMOYU SIFIRLA → onayla.
   Bu, **her iki cihazı birden** başlangıç durumuna döndürür.
3. **Mac'te yönetici takvimini aç** ve pencereyi büyük bırak.
4. **iPhone'da uygulamayı ana ekrandan aç** (Safari sekmesinden değil).
5. Ana sayfada **"Bildirimler açık"** yazdığını doğrula.
6. Bildirim kartına **dokun** → test bildirimi gelmeli.
7. Gerekirse demoyu bir kez daha sıfırla. **Bildirim izni silinmez.**

Sağ üstteki küçük nokta bağlantı durumudur:
yeşil = canlı · sarı = senkronize ediliyor · kırmızı = bağlantı sorunu.

---

## Giriş bilgileri

| Rol | Kullanıcı | Parola |
|---|---|---|
| **Ahmet** (yıldız senaryo) | `ORK-0142` | `orka2026` |
| Ayşe (Ahmet'in partneri) | `ORK-0143` | `orka2026` |
| Mert (paketi bitmiş) | `ORK-0087` | `orka2026` |
| Deniz (yalnızca Fitness) | `ORK-0233` | `orka2026` |
| **Yönetici** | `yonetici` | `orka2026` |

---

## Yıldız gösteri

**1. iPhone — randevu al**
Ahmet olarak gir → Randevu Al → EMS → bugün → **16:00** → Onayla.

**2. Mac — kendiliğinden görünsün**
Yönetici takvimine dokunma. Randevu **1–2 saniye içinde** kendi kendine belirir.
*"Kimse yenilemedi. İki cihaz aynı veriyi görüyor."*

**3. Mac — sürükle ve taşı**
16:00 kartını tut, **20:30**'a sürükle → **TAŞI VE BİLDİR**.

**4. iPhone kilitliyken bildirim**
Telefonu kilitle. Kilit ekranında:

> **Orka EMS Fitness**
> Randevunuz güncellendi
> EMS randevunuz bugün 20:30'a taşındı.

**5. Kilidi aç**
Bildirime dokun → uygulama açılır, randevu **20:30** olarak görünür.

**6. Kes / Yapıştır**
Mac'te başka bir randevuya sağ tık → **Kes** → hedef saate sağ tık → **Yapıştır**
(veya `Cmd+X` / `Cmd+V`). iPhone yine kendiliğinden güncellenir.

**7. Çift seansı**
iPhone: Randevu Al → EMS → **"Partnerimle geleceğim"** → Ayşe otomatik gelir →
tamamen boş bir saat seç → onayla.
Mac'te kart **Ahmet + Ayşe · EMS · Çift** olarak turuncu görünür.
O saate başka kimse randevu alamaz — ne EMS ne Fitness.

**8. Ödeme**
Mac: Üyeler → bir üye → **Ödeme Ekle** → tutar + Nakit/Kart/Havale → kaydet.
Borç özeti hem yöneticide hem üyenin profilinde güncellenir.

---

## Anlatılacak iş noktaları

- **Kapasite:** aynı anda EMS 3, Fitness 2, toplam 4 kişi.
- **Çift seansı stüdyoyu kapatır** — üçüncü kişi giremez.
- **Paket:** 8 seans, 28 gün, haftada en fazla 2, devir yok.
- **Fitness EMS paketinden düşmez.**
- Üye **hiçbir zaman** kapasite matematiği görmez — yalnızca *Uygun / Dolu / Kapalı*.

---

## Acil durum planı

**Bildirim gelmezse:** sunumu durdurma. Cihazlar arası canlı senkronizasyon
zaten en güçlü kısım — telefonu kilitlemeden, ekran açıkken randevunun
kendiliğinden güncellenmesini göster. Bildirim ayrı bir konu olarak ele alınır.

**Bağlantı noktası kırmızıysa:** sayfayı yenile. Değişmezse yönetici tarafını
Mac'ten tek başına göster; kurallar ve takvim yerel olarak da çalışır.

**Demo verisi karıştıysa:** Ayarlar → DEMOYU SIFIRLA. 5 saniye sürer.

---

## Bilinen sınırlar (sorulursa)

- Giriş sahte; gerçek parola/oturum güvenliği Phase 2'de gelecek.
- İş kuralı doğrulaması şu an istemcide; sunucu yalnızca sürüm ve yapı
  doğruluyor. Üretimde tamamı sunucuya taşınacak.
- Denetim kaydı (audit log) henüz yok.
- Zamanlanmış hatırlatmalar (seanstan 6 saat önce) bu demoda yok.

---

## Karara bağlanacak konular

1. **8 kredi / 28 gün / haftada 2 birbirini tam doyuruyor** — üye her hafta
   tam 2 seans yapmazsa paketi bitiremiyor. Kasıtlı mı?
2. Çift seansını üye iptal ederse ne olsun? (Demoda: tamamı iptal, hak yalnızca
   iptali başlatandan düşer.)
3. Geç iptalde yer başkasına açılsın mı? (Demoda: açılıyor, hak yanıyor.)
4. Fitness'ın ücret modeli ne? (Demoda: basit bir erişim yetkisi.)
5. Çalışma saatleri kesin mi? Pzt–Cmt 08:00–23:30 · Paz 10:00–22:00
6. Randevu ufku 14 gün, kapanış 2 saat önce — uygun mu?
