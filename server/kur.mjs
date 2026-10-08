/**
 * BoruStok yerel kurulum ve güncelleme programı. Çalıştırma: npm run kur
 *
 * Tekrar tekrar çalıştırılabilir; her seferinde sadece eksik olanı yapar:
 *   1. server/ayarlar.json yoksa oluşturur (gizli anahtarları rastgele üretir).
 *   2. "borustok" veritabanını oluşturur.
 *   3. Tabloları kurar / günceller (supabase/migrations içindeki yeni dosyalar).
 *   4. PostgREST ayar dosyasını yazar.
 *   5. Hiç kullanıcı yoksa ilk yöneticiyi (admin) oluşturur.
 *
 * PostgreSQL'in "postgres" kullanıcısının şifresi sorulur (kurulumda belirlenen
 * şifre). Bu şifre hiçbir dosyaya kaydedilmez.
 */
import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { defaults, loadSettings, pgTool, postgrestConfPath, projectDir, serverDir, settingsPath } from './ayarlar.mjs'

const migrationsDir = join(projectDir, 'supabase', 'migrations')
const prompt = createInterface({ input: process.stdin, output: process.stdout })
const ask = async (question) => (await prompt.question(question)).trim()

/** SQL metin sabiti: tek tırnaklar ikilenir. */
const lit = (value) => `'${String(value).replaceAll("'", "''")}'`

function fail(message) {
  console.error(`\nHATA: ${message}`)
  process.exit(1)
}

// 1. Ayar dosyası ---------------------------------------------------------------

if (!existsSync(settingsPath)) {
  const fresh = {
    port: defaults.port,
    postgrestPort: defaults.postgrestPort,
    db: defaults.db,
    pgBin: '',
    // Oturum anahtarlarını imzalayan gizli anahtar. Değişirse herkes yeniden giriş yapar.
    jwtSecret: randomBytes(48).toString('hex'),
    // PostgREST'in veritabanına bağlandığı kullanıcının şifresi.
    authenticatorPassword: randomBytes(24).toString('hex'),
    // Yedek alan salt okunur kullanıcının şifresi.
    backupPassword: randomBytes(24).toString('hex'),
  }
  writeFileSync(settingsPath, `${JSON.stringify(fresh, null, 2)}\n`, { mode: 0o600 })
  console.log('server/ayarlar.json oluşturuldu.')
}
const settings = loadSettings()

// PostgreSQL bağlantısı ------------------------------------------------------------

const psqlPath = pgTool(settings, 'psql')
const superuser = process.env.PGUSER || 'postgres'
const superPassword =
  process.env.PGPASSWORD || (await ask(`PostgreSQL "${superuser}" kullanıcısının şifresi (yazarken görünür): `))

function psql(database, args, input) {
  const result = spawnSync(psqlPath, ['-X', '-v', 'ON_ERROR_STOP=1', '-d', database, ...args], {
    encoding: 'utf8',
    input,
    env: {
      ...process.env,
      PGHOST: settings.db.host,
      PGPORT: String(settings.db.port),
      PGUSER: superuser,
      PGPASSWORD: superPassword,
      PGCLIENTENCODING: 'UTF8',
    },
  })
  if (result.error) {
    fail(
      `psql çalıştırılamadı (${result.error.message}).\n` +
        'PostgreSQL kurulu mu? Kuruluysa bin klasörünü server/ayarlar.json içindeki "pgBin" alanına yazın,\n' +
        'örnek: "C:\\\\Program Files\\\\PostgreSQL\\\\17\\\\bin"',
    )
  }
  return result
}

function run(database, args, what, input) {
  const result = psql(database, args, input)
  if (result.status !== 0) fail(`${what} başarısız oldu:\n${result.stderr || result.stdout}`)
  return result.stdout.trim()
}

/** Şifre içeren SQL komut satırında görünmesin diye psql'e standart girdiden verilir. */
const runSecret = (database, sql, what) => run(database, ['-1', '-f', '-'], what, sql)

const query = (database, sql, what) => run(database, ['-A', '-t', '-c', sql], what)
const dbName = settings.db.name

// 2. Veritabanı --------------------------------------------------------------------

if (query('postgres', `select 1 from pg_database where datname = ${lit(dbName)}`, 'Veritabanına bağlanma') !== '1') {
  run('postgres', ['-c', `create database "${dbName}" encoding 'UTF8' template template0`], 'Veritabanı oluşturma')
  console.log(`"${dbName}" veritabanı oluşturuldu.`)
}

// 3. Tablolar ----------------------------------------------------------------------

run(dbName, ['-1', '-f', join(serverDir, 'db', '00_temel.sql')], 'Temel kurulum (00_temel.sql)')
run(
  dbName,
  [
    '-c',
    `create schema if not exists yerel;
     create table if not exists yerel.uygulanan_migrationlar (
       dosya text primary key,
       uygulandi timestamptz not null default now()
     );`,
  ],
  'Kurulum geçmişi tablosu',
)

const applied = new Set(
  query(dbName, 'select dosya from yerel.uygulanan_migrationlar', 'Kurulum geçmişini okuma').split('\n').filter(Boolean),
)
const migrations = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()
for (const file of migrations) {
  if (applied.has(file)) continue
  // Dosya ve geçmiş kaydı tek işlemde: yarıda kalırsa hiçbir şey uygulanmamış olur.
  run(
    dbName,
    ['-1', '-f', join(migrationsDir, file), '-c', `insert into yerel.uygulanan_migrationlar (dosya) values (${lit(file)})`],
    `Migration (${file})`,
  )
  console.log(`Uygulandı: ${file}`)
}

run(dbName, ['-1', '-f', join(serverDir, 'db', '90_yerel_kimlik.sql')], 'Kimlik doğrulama kurulumu (90_yerel_kimlik.sql)')
runSecret(
  dbName,
  `alter role authenticator password ${lit(settings.authenticatorPassword)};
   alter role borustok_yedek password ${lit(settings.backupPassword)};`,
  'Servis şifrelerini atama',
)
console.log('Veritabanı güncel.')

// 4. PostgREST ayarı ---------------------------------------------------------------

writeFileSync(
  postgrestConfPath,
  `# Bu dosya "npm run kur" tarafından yazılır; elle değiştirmeyin.
db-uri = "postgres://authenticator:${settings.authenticatorPassword}@${settings.db.host}:${settings.db.port}/${dbName}"
db-schemas = "public, auth_api"
db-extra-search-path = "public, extensions"
db-anon-role = "anon"
db-max-rows = 1000
jwt-secret = "${settings.jwtSecret}"
# Sadece bu bilgisayarın içinden erişilir; ağa açık olan sunucu.mjs'dir.
server-host = "127.0.0.1"
server-port = ${settings.postgrestPort}
`,
  { mode: 0o600 },
)

// 5. İlk yönetici -------------------------------------------------------------------

if (query(dbName, 'select count(*) from auth.users', 'Kullanıcıları sayma') === '0') {
  console.log('\nHenüz kullanıcı yok. İlk yönetici (admin) hesabını oluşturalım.')
  const email = (process.env.BORUSTOK_ADMIN_EMAIL || (await ask('E-posta: '))).toLowerCase()
  const fullName = process.env.BORUSTOK_ADMIN_NAME || (await ask('Ad Soyad: '))
  const password = process.env.BORUSTOK_ADMIN_PASSWORD || (await ask('Şifre (en az 8 karakter, yazarken görünür): '))
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email)) fail('Geçerli bir e-posta adresi girin.')

  runSecret(
    dbName,
    `select auth_api.check_password(${lit(password)});
     insert into auth.users (email, encrypted_password, raw_user_meta_data)
     values (
       ${lit(email)},
       extensions.crypt(${lit(password)}, extensions.gen_salt('bf', 10)),
       jsonb_build_object('full_name', ${lit(fullName.slice(0, 100))})
     );
     update public.profiles set role = 'admin'
     where id = (select id from auth.users where email = ${lit(email)});`,
    'Yönetici oluşturma',
  )
  console.log(`Yönetici oluşturuldu: ${email}`)
}

prompt.close()
console.log(`\nKurulum tamam. Sunucuyu başlatmak için: npm run sunucu`)
