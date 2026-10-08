@echo off
rem BoruStok sunucu kurulumu. Sag tiklayip "Yonetici olarak calistir" ile acilir.
rem Once Node.js ve PostgreSQL kurulmus olmalidir (bkz. server\KURULUM.md).
rem (Turkce karakter bilerek kullanilmadi: komut penceresi yanlis gosterebiliyor.)
setlocal
cd /d "%~dp0"

net session >nul 2>&1
if errorlevel 1 (
  echo Bu dosyayi sag tiklayip "Yonetici olarak calistir" ile acin.
  pause
  exit /b 1
)

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js bulunamadi. Once https://nodejs.org adresinden LTS surumunu kurun,
  echo sonra bu dosyayi yeniden calistirin.
  pause
  exit /b 1
)

if not exist "dist\index.html" (
  echo dist klasoru eksik. Paketi eksiksiz kopyaladiginizdan emin olun.
  pause
  exit /b 1
)

if not exist "server\bin\postgrest.exe" (
  echo server\bin\postgrest.exe eksik. Paketi eksiksiz kopyaladiginizdan emin olun.
  pause
  exit /b 1
)

echo.
echo === 1/2: Veritabani kuruluyor ===
node server\kur.mjs
if errorlevel 1 (
  echo.
  echo Kurulum tamamlanamadi. Yukaridaki hata mesajini not edin.
  pause
  exit /b 1
)

echo.
echo === 2/2: Otomatik baslatma, yedek ve guvenlik duvari ayarlaniyor ===
powershell -NoProfile -ExecutionPolicy Bypass -File "server\otomatik-baslat.ps1"
if errorlevel 1 (
  echo.
  echo Otomatik baslatma ayarlanamadi. Yukaridaki hata mesajini not edin.
  pause
  exit /b 1
)

echo.
echo KURULUM TAMAM. Bu pencereyi kapatabilirsiniz.
pause
