# BoruStok: sunucuyu bilgisayar acilisinda otomatik baslatir, gunluk yedegi ve
# guvenlik duvari kuralini ayarlar. Bir kez, YONETICI olarak calistirilir:
#
#   powershell -ExecutionPolicy Bypass -File C:\BoruStok\server\otomatik-baslat.ps1
#
# Tekrar calistirilabilir; var olan gorevlerin ve kuralin uzerine yazar.
# (Bu dosyada Turkce karakter bilerek kullanilmadi: eski PowerShell surumleri
# dosya kodlamasini yanlis okuyabiliyor.)

#Requires -RunAsAdministrator
$ErrorActionPreference = 'Stop'

$serverDir = $PSScriptRoot
$projectDir = Split-Path $serverDir
$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { throw 'Node.js bulunamadi. Once Node.js kurun.' }

$settingsPath = Join-Path $serverDir 'ayarlar.json'
if (-not (Test-Path $settingsPath)) { throw 'server\ayarlar.json yok. Once kurulumu calistirin: node server\kur.mjs' }
$port = (Get-Content $settingsPath -Raw | ConvertFrom-Json).port
if (-not $port) { $port = 8080 }

# Oturum acilmasa da calissin diye gorevler SYSTEM hesabiyla kaydedilir.
$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest

# Sunucu: acilista baslar, sure siniri yoktur, kapanirsa 1 dakika sonra yeniden baslatilir.
$serverSettings = New-ScheduledTaskSettingsSet `
  -ExecutionTimeLimit ([TimeSpan]::Zero) `
  -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) `
  -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
Register-ScheduledTask -TaskName 'BoruStok Sunucu' -Force `
  -Action (New-ScheduledTaskAction -Execute $node -Argument "`"$serverDir\sunucu.mjs`"" -WorkingDirectory $projectDir) `
  -Trigger (New-ScheduledTaskTrigger -AtStartup) `
  -Principal $principal -Settings $serverSettings | Out-Null

# Yedek: her gun 12:30; bilgisayar o saatte kapaliysa acilinca alinir.
$backupSettings = New-ScheduledTaskSettingsSet `
  -ExecutionTimeLimit (New-TimeSpan -Hours 1) `
  -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
Register-ScheduledTask -TaskName 'BoruStok Yedek' -Force `
  -Action (New-ScheduledTaskAction -Execute $node -Argument "`"$serverDir\yedekle.mjs`"" -WorkingDirectory $projectDir) `
  -Trigger (New-ScheduledTaskTrigger -Daily -At '12:30') `
  -Principal $principal -Settings $backupSettings | Out-Null

# Agdaki bilgisayarlar baglanabilsin.
Get-NetFirewallRule -DisplayName 'BoruStok' -ErrorAction SilentlyContinue | Remove-NetFirewallRule
New-NetFirewallRule -DisplayName 'BoruStok' -Direction Inbound -Protocol TCP -LocalPort $port -Action Allow | Out-Null

Start-ScheduledTask -TaskName 'BoruStok Sunucu'

Write-Host ''
Write-Host "Tamam. Sunucu arka planda calisiyor ve bilgisayar her acildiginda kendiliginden baslayacak."
Write-Host "Bu bilgisayardan adres: http://localhost:$port"
Write-Host 'Diger bilgisayarlardan adres:'
Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } |
  ForEach-Object { Write-Host "  http://$($_.IPAddress):$port" }
Write-Host "Kayitlar: $serverDir\gunluk\sunucu.log"
Write-Host "Durdurmak icin:  Stop-ScheduledTask -TaskName 'BoruStok Sunucu'"
