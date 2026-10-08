# BoruStok – Yerel Sunucu Kurulumu

Uygulama, kurum içindeki bir bilgisayarda (sunucu) çalışır; diğer bilgisayarlar
ona tarayıcıdan `http://SUNUCU-IP:8080` adresiyle bağlanır. İnternet ve Docker
gerekmez. Sunucu bilgisayarında üç parça çalışır ve birlikte yaklaşık
200–300 MB RAM kullanır:

| Parça | Görevi |
|---|---|
| PostgreSQL | Veritabanı (tablolar, yetkiler, stok kuralları) |
| PostgREST (`server\bin\postgrest.exe`) | Uygulamanın veri arayüzü |
| `sunucu.mjs` (Node.js) | Uygulamayı ağa sunar, giriş/şifre işini yapar, PostgREST'i başlatır |

Aşağıdaki komutlar Windows içindir. Linux'ta aynı `node` komutları geçerlidir;
yalnızca güvenlik duvarı ve otomatik başlatma adımları farklıdır.

## Kısa yol (hazır paket)

`BoruStok-sunucu.zip` paketinde derlenmiş uygulama, sunucu programları ve
PostgREST hazır gelir. Bu paketle kurulum dört adımdır:

1. Node.js'i kurun (aşağıda 1. adım).
2. PostgreSQL'i kurun ve belirlediğiniz **postgres şifresini** not edin.
3. Paketi açıp `BoruStok` klasörünü `C:\` altına kopyalayın.
4. `C:\BoruStok\KUR.bat` dosyasına sağ tıklayıp **Yönetici olarak çalıştır**
   deyin; sorulan postgres şifresini ve ilk yönetici bilgilerini girin.

`KUR.bat`, aşağıdaki 3. ve 5. adımları kendisi yapar. Geri kalan bölümler
ayrıntı ve elle kurulum içindir.

## 1. Gerekli programlar

1. **Node.js** (LTS sürümü, 22 veya üzeri): <https://nodejs.org> – kurulum sihirbazı.
2. **PostgreSQL** (15 veya üzeri; 18 ile denendi): <https://www.postgresql.org/download/windows/>
   - Kurulumda sorulan **postgres şifresini** not edin; kurulum programı soracak.
   - Port varsayılan `5432` kalsın.
3. **PostgREST** (16.4 ile denendi): <https://github.com/PostgREST/postgrest/releases>
   - `postgrest-v16.4-windows-x86-64.zip` dosyasını indirin, içindeki
     `postgrest.exe` dosyasını `server\bin\postgrest.exe` olarak kopyalayın
     (`bin` klasörünü kendiniz oluşturun).

## 2. Uygulama dosyaları

Proje klasörünü sunucuya kopyalayın (örnek: `C:\BoruStok`). Sunucuda şunlar
bulunmalıdır:

- `dist\` – derlenmiş uygulama
- `server\` – sunucu programları
- `supabase\migrations\` – tablo tanımları

`dist` klasörü, kodun bulunduğu bilgisayarda `npm run build` ile üretilir.
Sunucu programlarının hiçbir ek pakete ihtiyacı yoktur; sunucuda `npm install`
çalıştırmak gerekmez.

## 3. Kurulum

Komut İstemi'ni proje klasöründe açın:

```bat
cd C:\BoruStok
node server\kur.mjs
```

Program sırasıyla:

- `postgres` şifresini sorar (hiçbir yere kaydedilmez),
- `borustok` veritabanını ve tabloları kurar,
- `server\ayarlar.json` ve `server\postgrest.conf` dosyalarını yazar,
- ilk **yönetici** hesabı için e-posta, ad ve şifre sorar.

`psql çalıştırılamadı` hatası alırsanız `server\ayarlar.json` içindeki `pgBin`
alanına PostgreSQL'in bin klasörünü yazıp yeniden çalıştırın:

```json
"pgBin": "C:\\Program Files\\PostgreSQL\\18\\bin"
```

Kurulum programı tekrar çalıştırılabilir; var olan veriye dokunmaz, yalnızca
eksik olanı yapar.

## 4. Sunucuyu başlatma

```bat
node server\sunucu.mjs
```

Ekranda, ağdaki bilgisayarların kullanacağı adres yazar
(ör. `http://192.168.1.20:8080`). Önce sunucunun kendisinde
`http://localhost:8080` adresini açıp yönetici hesabıyla giriş yapın.
Diğer kullanıcıları **Tanımlar → Kullanıcılar → Yeni kullanıcı** ile ekleyin.

## 5. Açılışta otomatik başlatma, yedek ve güvenlik duvarı

4. adımda sunucunun çalıştığını gördükten sonra o pencereyi kapatın
(Ctrl+C). Sonra **Yönetici olarak** açılmış bir PowerShell penceresinde bir kez
şunu çalıştırın:

```bat
powershell -ExecutionPolicy Bypass -File C:\BoruStok\server\otomatik-baslat.ps1
```

Bu betik üç şey yapar:

- **Sunucu:** bilgisayar her açıldığında, kimse oturum açmasa bile arka planda
  başlar; kapanırsa 1 dakika içinde yeniden başlatılır.
- **Yedek:** her gün 12:30'da yedek alınır (bilgisayar o saatte kapalıysa
  açılınca alınır).
- **Güvenlik duvarı:** ağdaki bilgisayarların bağlanabilmesi için uygulamanın
  portu açılır.

Sunucu arka planda penceresiz çalışır. Ne yaptığını görmek için
`server\gunluk\sunucu.log` dosyasına bakın. Elle durdurmak ya da başlatmak için
Görev Zamanlayıcı'da "BoruStok Sunucu" görevini kullanın.

Ayrıca:

- **Sabit IP:** Sunucunun IP adresi değişmemelidir. Ağ ayarlarından sabit IP
  verin ya da modemde/DHCP sunucusunda bu bilgisayara IP ayırın.
- **Uyku:** Güç Seçenekleri'nden uykuya geçmeyi kapatın; sunucu uyurken kimse
  uygulamayı kullanamaz.

## 6. Yedekler

Tüm veri tek bir bilgisayarda durur; **yedek şarttır**. Yedekler `yedekler\`
klasörüne tarihli dosyalar olarak yazılır ve en yeni 30 tanesi saklanır. Elle
yedek almak için:

```bat
node server\yedekle.mjs
```

Yedeklerin başka bir diske ya da ağ klasörüne yazılması için
`server\ayarlar.json` dosyasına ekleyin:

```json
"backup": { "dir": "D:\\BoruStokYedek", "keep": 30 }
```

**Geri yükleme** (mevcut verinin üzerine yazar):

```bat
pg_restore --clean --if-exists -U postgres -d borustok yedekler\borustok-2026-10-08_1230.dump
```

## 7. Güncelleme

1. Yeni `dist\`, `server\` ve `supabase\migrations\` klasörlerini sunucuya
   kopyalayın (`server\ayarlar.json`, `server\postgrest.conf` ve
   `server\bin\` yerinde kalmalı).
2. `node server\kur.mjs` – yeni tablo değişiklikleri varsa uygular.
3. Sunucuyu yeniden başlatın (Görev Zamanlayıcı → "BoruStok Sunucu" → Sonlandır, sonra Çalıştır; ya da bilgisayarı yeniden başlatın).

## 8. Güvenlik notları

- Bağlantı `http` üzerindendir, yani şifreler ağda şifrelenmeden taşınır.
  Uygulama yalnızca kurum içi ağda kullanılmalı; 8080 portu modemden
  internete **açılmamalıdır**.
- `server\ayarlar.json` gizli anahtarlar içerir. Kimseyle paylaşmayın.
  Kaybolursa kurulum yeniden çalıştırılarak üretilir, ancak herkes yeniden
  giriş yapmak zorunda kalır.
- Şifreler veritabanında bcrypt özeti olarak saklanır; yönetici dahil kimse
  mevcut şifreleri göremez, yalnızca yenisini atayabilir.
- Aynı adresten art arda 8 hatalı giriş denemesinden sonra 10 dakika yeni
  deneme kabul edilmez.

## 9. Sorun giderme

| Belirti | Bakılacak yer |
|---|---|
| Sayfa hiç açılmıyor | Görev Zamanlayıcı'da "BoruStok Sunucu" çalışıyor mu? `server\gunluk\sunucu.log` ne diyor? IP doğru mu? |
| “Veritabanı servisine ulaşılamadı” | PostgreSQL hizmeti çalışıyor mu (Hizmetler → postgresql)? |
| “PostgREST bulunamadı” | `server\bin\postgrest.exe` yerinde mi? |
| Yönetici şifresi unutuldu | Başka bir yönetici sıfırlayabilir. Hiç yönetici kalmadıysa şifre veritabanından sıfırlanır. |
