# BoruStok

Köylere dağıtılan içme suyu ve koruge borularının stok takibi için web
uygulaması. Kurum içindeki tek bir bilgisayarda çalışır; diğer bilgisayarlar
ona tarayıcıdan bağlanır. İnternet, bulut hizmeti ya da Docker gerektirmez.

## Ne yapar

- **Stok girişi:** depoya gelen boruları adet ve metre olarak kaydeder.
- **Dağıtım:** köye verilen boruları kaydeder; stok kendiliğinden düşer,
  depodakinden fazlası verilemez.
- **Talep formları:** her dağıtım için Ambar Talep Formu ve Malzeme Talep
  Fişini, kurumun kendi Excel şablonu üzerinde köy, tarih, muhtar ve boru
  bilgileriyle doldurulmuş olarak indirir.
- **Sayım düzeltmesi ve iptal:** kayıtlar silinmez; hatalı belge ters kayıtla
  iptal edilir, böylece geçmiş her zaman izlenebilir.
- **Raporlar:** köy bazında dağıtım, boru tipi bazında özet ve hareket dökümü;
  Excel'e aktarılabilir.
- **Roller:** yönetici (her şey), depo sorumlusu (giriş ve dağıtım), izleyici
  (yalnızca görüntüleme).
- **Denetim kaydı:** tanımlarda ve kullanıcılarda yapılan her değişiklik, kimin
  yaptığıyla birlikte saklanır.

## Nasıl çalışır

```
Tarayıcı (ofisteki bilgisayarlar, telefonlar)
        │  http://SUNUCU-IP:8080
        ▼
server/sunucu.mjs  ──  uygulama dosyaları (dist/)
        │              giriş ve oturum (/auth/v1)
        ▼
PostgREST  ──  veri arayüzü (/rest/v1)
        ▼
PostgreSQL ──  tablolar, yetkiler (RLS), stok kuralları
```

İş kurallarının tamamı (stok yeterliliği, yetkiler, çift kayıt önleme)
veritabanındadır; arayüz bunları atlayamaz.

| Katman | Teknoloji |
|---|---|
| Arayüz | React 19, TypeScript, Vite, Tailwind CSS, TanStack Query |
| Veri erişimi | supabase-js → PostgREST |
| Veritabanı | PostgreSQL 15+ (satır güvenliği ve PL/pgSQL fonksiyonları) |
| Sunucu | Node.js 22+, harici paket kullanmaz |
| Excel | ExcelJS |

## Kurulum

Sunucu bilgisayarına kurulum adım adım [server/KURULUM.md](server/KURULUM.md)
dosyasında anlatılır. Özet:

1. Node.js ve PostgreSQL kurulur.
2. PostgREST indirilip `server/bin/` içine konur.
3. `npm run build` ile uygulama derlenir.
4. `node server/kur.mjs` veritabanını kurar ve ilk yöneticiyi oluşturur.
5. `node server/sunucu.mjs` uygulamayı ağa sunar.

Windows'ta 4. ve sonraki adımları `KUR.bat` tek seferde yapar; bilgisayar
açılışında otomatik başlatmayı, günlük yedeği ve güvenlik duvarı kuralını da
ayarlar.

## Geliştirme

```bash
npm install
npm run kur       # yerel veritabanını kurar (PostgreSQL ve PostgREST gerekir)
npm run sunucu    # 8080 portunda sunucu
npm run dev       # 5173 portunda arayüz; veri isteklerini sunucuya aktarır
```

| Komut | İşlevi |
|---|---|
| `npm run build` | Tip denetimi ve üretim derlemesi (`dist/`) |
| `npm run typecheck` | Yalnızca tip denetimi |
| `npm run lint` | oxlint |
| `npm run yedekle` | Veritabanı yedeği alır |

### Klasörler

| Klasör | İçerik |
|---|---|
| `src/features/` | Ekranlar, özellik bazında (stok, dağıtım, raporlar, kullanıcılar …) |
| `src/features/distributions/templates/` | Talep formlarının Excel şablonları |
| `supabase/migrations/` | Veritabanı şeması; kurulum programı sırayla uygular |
| `supabase/tests/` | Veritabanı kurallarının SQL testleri |
| `server/` | Yerel sunucu, kurulum ve yedekleme programları |

Klasör adındaki `supabase`, projenin başlangıçta Supabase üzerinde
geliştirilmiş olmasından gelir. Yerel sunucu aynı arayüzü sunduğu için şema
dosyaları ve arayüz kodu değişmeden kullanılır.

## Sık sorulan sorular

### Genel

**İnternet gerekir mi?**
Hayır. Kurulum sırasında programları indirmek dışında internet kullanılmaz.
Veriler kurum dışına çıkmaz.

**Diğer bilgisayarlara bir şey kurmak gerekir mi?**
Hayır. Tarayıcıdan sunucunun adresi açılır. İstenirse masaüstüne kısayol
eklenir.

**Telefondan kullanılabilir mi?**
Evet, telefon kurumun ağına (Wi-Fi) bağlıysa. Arayüz küçük ekrana uyumludur.

**Sunucu bilgisayarı ne kadar güçlü olmalı?**
Normal bir ofis bilgisayarı yeterlidir. Üç parça birlikte yaklaşık 300 MB RAM
kullanır; 4 GB RAM'li bir bilgisayarda sorunsuz çalışır. Aynı bilgisayar
günlük işler için kullanılmaya devam edebilir.

**Kaç kişi aynı anda kullanabilir?**
Bir ofis için pratikte sınır yoktur. İki kişi aynı anda aynı boruyu dağıtmaya
çalışırsa veritabanı kayıtları sıraya koyar; stok eksiye düşmez.

**Sunucu kapalıyken ne olur?**
Uygulama açılmaz. Sunucu açıldığında kaldığı yerden devam eder; veri kaybı
olmaz.

### Veri ve güvenlik

**Veriler nerede durur?**
Sunucu bilgisayarındaki PostgreSQL veritabanında.
Başka hiçbir yere gönderilmez.

**Yedek nasıl alınır?**
`KUR.bat` her gün 12:30 için otomatik yedek ayarlar; yedekler `yedekler/`
klasörüne yazılır ve son 30 tanesi saklanır. Disk arızasına karşı yedek
klasörünü başka bir diske ya da ağ klasörüne yönlendirmeniz önerilir
(bkz. KURULUM.md).

**Bağlantı şifreli mi?**
Hayır, `http` kullanılır. Bu yüzden uygulama yalnızca kurum içi ağda
kullanılmalı, sunucu portu internete açılmamalıdır. İnternetten erişim
gerekiyorsa önüne HTTPS sağlayan bir ters vekil sunucu konmalıdır.

**Şifreler nasıl saklanır?**
bcrypt özeti olarak. Yönetici dahil kimse mevcut şifreleri göremez; yalnızca
yenisini atayabilir. Art arda hatalı girişlerde geçici engel uygulanır.

**Bir kayıt yanlış girildi, silinebilir mi?**
Stok belgeleri silinmez, iptal edilir: belge listede "iptal edildi" olarak
kalır ve stok etkisi geri alınır. Hiç kullanılmamış boru tipi ve köy tanımları
silinebilir; kullanılmış olanlar pasife alınır.

**Yönetici şifresi unutulursa?**
Başka bir yönetici Tanımlar → Kullanıcılar ekranından sıfırlar. Hiç yönetici
kalmadıysa şifre, sunucu bilgisayarında veritabanı üzerinden sıfırlanır.

### Excel formları

**Kendi kurumumun formlarını kullanabilir miyim?**
Evet. Depodaki şablonlar örnektir ve imza adları yer tutucudur. Kendi
dosyalarınızı aynı adlarla
`src/features/distributions/templates/ozel/` klasörüne koyup uygulamayı
yeniden derleyin; uygulama o klasördekileri kullanır. Bu klasör depoya
girmez.

**Şablonumun düzeni farklıysa?**
Hangi hücreye neyin yazılacağı
[`talepForms.ts`](src/features/distributions/talepForms.ts) içindeki `layouts`
tablosunda tanımlıdır (sayfa adı, köy/tarih/muhtar hücreleri, boru
satırlarının başladığı satır ve sütunlar). Düzeniniz farklıysa bu tabloyu
güncellemeniz yeterlidir.

**Şablondaki diğer sayfalara ne olur?**
Dokunulmaz. Yalnızca tanımlı sayfalar doldurulur; diğer sayfalar hücre, biçim
ve yazdırma düzeniyle aynen korunur.

**Bir dağıtımda şablondaki satır sayısından fazla kalem varsa?**
Dosya üretilmez ve uyarı gösterilir; form eksik kalemle basılmaz.

### Teknik

**Neden Docker yok?**
Hedef ortam, Docker kurulamayan ve bulut hizmeti kullanılamayan kurum
bilgisayarlarıdır. Bu yüzden her parça normal bir program olarak kurulur.

**Supabase ile kullanılabilir mi?**
Evet. `supabase/migrations` bir Supabase projesine uygulanıp `.env.local`
dosyasında `VITE_SUPABASE_URL` ve `VITE_SUPABASE_PUBLISHABLE_KEY` tanımlanırsa
arayüz o projeye bağlanır. Yalnızca kullanıcı ekleme ve şifre sıfırlama
ekranı çalışmaz (o fonksiyonlar yerel sunucuya özgüdür); kullanıcılar
Supabase panelinden eklenir.

**Linux'ta çalışır mı?**
Evet, sunucu programları platformdan bağımsızdır ve Linux'ta denenmiştir.
`KUR.bat` ve `otomatik-baslat.ps1` yalnızca Windows içindir; Linux'ta
otomatik başlatma için bir systemd birimi yazmanız gerekir.

**Güncelleme nasıl yapılır?**
Yeni `dist/`, `server/` ve `supabase/migrations/` sunucuya kopyalanır ve
kurulum programı yeniden çalıştırılır. Program yalnızca yeni şema
değişikliklerini uygular; mevcut veriye dokunmaz.

**Yeni bir veritabanı değişikliği nasıl eklenir?**
`supabase/migrations/` içine tarih önekli yeni bir `.sql` dosyası eklenir.
Uygulanmış dosyalar değiştirilmez; kurulum programı hangilerinin uygulandığını
izler.

## Bilinen sınırlar

- `KUR.bat` ve `otomatik-baslat.ps1` yazıldı ancak henüz gerçek bir Windows
  bilgisayarında denenmedi.
- Kullanıcılar kendi şifrelerini değiştiremez; şifreyi yönetici atar.
- Arayüz yalnızca Türkçedir.

## Lisans

Henüz bir lisans eklenmedi. Lisans eklenene kadar kod incelenebilir, ancak
kullanım, değiştirme ve dağıtım hakları saklıdır.
