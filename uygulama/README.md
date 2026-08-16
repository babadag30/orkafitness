# Orka EMS Fitness — İşletme Sahibi İnceleme Demosu

> ⚠️ **Bu bir üretim sürümü değildir.** Sunucu, veritabanı ve gerçek kimlik
> doğrulama yoktur. Veriler yalnızca tarayıcının localStorage'ında tutulur.
> İsimler ve telefonlar tamamen kurgudur.

17 Ağustos 2026 işletme sahibi görüşmesinde gösterilmek üzere hazırlandı.

## Giriş bilgileri (demo)

| Rol | Kullanıcı adı | Parola |
|---|---|---|
| Üye (Ahmet) | `ORK-0142` | `orka2026` |
| Üye (Ayşe — partneri) | `ORK-0143` | `orka2026` |
| Üye (Mert — paketi bitmiş) | `ORK-0087` | `orka2026` |
| Üye (Deniz — yalnızca Fitness) | `ORK-0233` | `orka2026` |
| Yönetici | `yonetici` | `orka2026` |

Giriş ekranı Ahmet'i hazır doldurur.

## Mimari

```
domain/                 iş kuralları — framework, tarayıcı ve veritabanı bağımsız
   ↑ (import)
uygulama/js/adapter.mjs demo deposu ↔ domain köprüsü
uygulama/js/store.mjs   localStorage kalıcılığı (DEMO)
uygulama/js/*.mjs       ekranlar
```

**Arayüzde hiçbir iş kuralı yoktur.** Kapasite, hak, münhasırlık, partner
uygunluğu, randevu penceresi ve iptal kuralları yalnızca `domain/` altında
yaşar. Ekranlar `RuleResult` gösterir, kendi kararını vermez.

Domain modülleri `/domain/` yolundan doğrudan yüklenir — kopya yok, derleme yok.
Böylece Phase 2'de aynı motor sunucuya taşınabilir.

## Sunum senaryosu

1. **Giriş** — `ORK-0142` / `orka2026`
2. **Ana sayfa** — "Bu hafta 1 / 2", "Paket 5 / 8"
3. **Randevu Al → EMS** — gün ve saat seç, onayla → sayaçlar 2/2 ve 6/8 olur
4. **Randevu Al → Fitness** — EMS haftalık hakkı dolu olmasına rağmen alınabilir;
   paket sayacı değişmez
5. **EMS → "Partnerimle geleceğim"** — Ayşe otomatik gelir
6. Tamamen boş bir saat seç → **Ahmet + Ayşe** özel çift seansı
7. **Yönetici** (`yonetici` / `orka2026`) → takvimde çift kartı
8. Çift seansının olduğu saate başka randevu denenirse **reddedilir**
9. Kartı sürükle veya sağ tık → **Kes**, hedef saate **Yapıştır**
10. Randevuya tıkla → **Geldi / Gelmedi / Geç iptal / Çift → tekli**
11. **Üyeler → üye → Ödeme Ekle**
12. **Ayarlar** — çalışan kurallar ve geçici kararlar listesi

Profil ve Ayarlar ekranlarındaki **DEMOYU SIFIRLA** başlangıç durumuna döner.

## Demo için alınan geçici kararlar

Bunlar nihai iş kararı **değildir** — `domain/config/policy.demo.mjs` içinde durur:

- Çift iptali randevunun tamamını iptal eder
- İptal hakkı yalnızca iptali başlatan üyeden düşer
- Yönetici çifti tek kişilik seansa çevirebilir
- Geç iptalde hak yanar ama fiziksel yer başkasına açılır

`domain/config/policy.default.mjs` bunları hâlâ `UNRESOLVED` tutar; karar
verildiğinde oraya taşınacak.

## Bilinen sınırlar

- Kimlik doğrulama sahte; parola kodda düz metin (bilinçli, demo)
- Veri cihazlar arasında paylaşılmaz
- Push bildirimi yok
- Denetim kaydı (audit log) henüz yok
- `domain/` çevrimdışı önbelleğe alınmaz (servis çalışanı kapsamı `/uygulama/`)
