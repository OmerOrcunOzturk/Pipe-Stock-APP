/**
 * Veritabanının tam yedeğini alır. Çalıştırma: npm run yedekle
 *
 * Yedekler ayarlardaki klasöre (varsayılan: proje içinde yedekler/) tarihli
 * dosyalar olarak yazılır; en yeni "keep" tanesi saklanır, eskiler silinir.
 * Windows Görev Zamanlayıcı ile her gün çalıştırılması önerilir (KURULUM.md).
 *
 * Geri yükleme:
 *   pg_restore --clean --if-exists -U postgres -d borustok yedekler/borustok-....dump
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, readdirSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { loadSettings, pgTool } from './ayarlar.mjs'

const settings = loadSettings()
const { dir, keep } = settings.backup
mkdirSync(dir, { recursive: true })

const pad = (n) => String(n).padStart(2, '0')
const now = new Date()
const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`
const file = join(dir, `borustok-${stamp}.dump`)

const result = spawnSync(pgTool(settings, 'pg_dump'), ['--format=custom', '--file', file, settings.db.name], {
  encoding: 'utf8',
  env: {
    ...process.env,
    PGHOST: settings.db.host,
    PGPORT: String(settings.db.port),
    PGUSER: 'borustok_yedek',
    PGPASSWORD: settings.backupPassword,
  },
})

if (result.error || result.status !== 0) {
  rmSync(file, { force: true })
  console.error(`Yedek alınamadı: ${result.error?.message ?? result.stderr}`)
  process.exit(1)
}
console.log(`Yedek alındı: ${file} (${Math.round(statSync(file).size / 1024)} KB)`)

// Dosya adları tarih sıralıdır; en yeni "keep" tanesi dışındakiler silinir.
const backups = readdirSync(dir).filter((f) => /^borustok-.*\.dump$/.test(f)).sort()
for (const old of backups.slice(0, Math.max(0, backups.length - keep))) {
  rmSync(join(dir, old))
  console.log(`Eski yedek silindi: ${old}`)
}
