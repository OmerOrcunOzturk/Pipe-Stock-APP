/**
 * Sunucu ayarları: server/ayarlar.json dosyasından okunur. Dosya kurulum
 * programı (kur.mjs) tarafından oluşturulur ve gizli anahtarlar içerir;
 * başka bir yere kopyalanmamalı, paylaşılmamalıdır.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const serverDir = dirname(fileURLToPath(import.meta.url))
export const projectDir = dirname(serverDir)
export const settingsPath = join(serverDir, 'ayarlar.json')
export const postgrestConfPath = join(serverDir, 'postgrest.conf')

const exe = process.platform === 'win32' ? '.exe' : ''
export const postgrestPath = join(serverDir, 'bin', `postgrest${exe}`)

export const defaults = {
  /** Uygulamanın ağda yayınlandığı port: http://SUNUCU-IP:8080 */
  port: 8080,
  /** PostgREST sadece bu bilgisayarın içinden erişilir. */
  postgrestPort: 3001,
  db: { host: '127.0.0.1', port: 5432, name: 'borustok' },
  /** PostgreSQL'in bin klasörü; boşsa PATH ve standart kurulum yerleri aranır. */
  pgBin: '',
  backup: { dir: join(projectDir, 'yedekler'), keep: 30 },
}

export function loadSettings() {
  if (!existsSync(settingsPath)) {
    throw new Error('server/ayarlar.json bulunamadı. Önce kurulumu çalıştırın: npm run kur')
  }
  const saved = JSON.parse(readFileSync(settingsPath, 'utf8'))
  return {
    ...defaults,
    ...saved,
    db: { ...defaults.db, ...saved.db },
    backup: { ...defaults.backup, ...saved.backup },
  }
}

/** psql, pg_dump gibi PostgreSQL araçlarının tam yolu (bulunamazsa sadece adı; PATH'ten aranır). */
export function pgTool(settings, name) {
  const candidates = [settings.pgBin]
  if (process.platform === 'win32') {
    for (const root of ['C:\\Program Files\\PostgreSQL', 'C:\\Program Files (x86)\\PostgreSQL']) {
      if (!existsSync(root)) continue
      // En yeni sürüm önce.
      const versions = readdirSync(root).sort((a, b) => Number(b) - Number(a))
      for (const version of versions) candidates.push(join(root, version, 'bin'))
    }
  }
  for (const dir of candidates) {
    if (dir && existsSync(join(dir, name + exe))) return join(dir, name + exe)
  }
  return name
}
