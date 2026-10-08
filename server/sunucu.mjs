/**
 * BoruStok yerel sunucusu. Tek program, üç iş:
 *
 *   1. Derlenmiş uygulamayı (dist/) ağdaki bilgisayarlara sunar.
 *   2. /auth/v1/*  : giriş ve oturum yenileme (Supabase Auth'un yerine).
 *   3. /rest/v1/*  : veri isteklerini bu bilgisayarda çalışan PostgREST'e aktarır.
 *
 * PostgREST'i de bu program başlatır ve kapanırsa yeniden çalıştırır; ayrıca
 * başlatmaya gerek yoktur. Çalıştırma: npm run sunucu
 *
 * Harici paket kullanmaz; sadece Node.js yeterlidir.
 */
import { spawn } from 'node:child_process'
import { createReadStream, createWriteStream, existsSync, mkdirSync, renameSync, statSync } from 'node:fs'
import http from 'node:http'
import { networkInterfaces } from 'node:os'
import { extname, join, normalize, sep } from 'node:path'
import { loadSettings, postgrestConfPath, postgrestPath, projectDir, serverDir } from './ayarlar.mjs'
import { refreshSecret, signJwt, verifyJwt } from './jwt.mjs'

const settings = loadSettings()
const distDir = join(projectDir, 'dist')
const ACCESS_TOKEN_SECONDS = 60 * 60
const REFRESH_TOKEN_SECONDS = 30 * 24 * 60 * 60
const MAX_AUTH_BODY_BYTES = 10_000

// Günlük ---------------------------------------------------------------------
// Sunucu bilgisayar açılışında arka planda (penceresiz) çalıştığında ekrana
// yazılanlar görünmez; bu yüzden her şey server/gunluk/sunucu.log dosyasına da yazılır.

const logDir = join(serverDir, 'gunluk')
const logPath = join(logDir, 'sunucu.log')
const MAX_LOG_BYTES = 5 * 1024 * 1024
mkdirSync(logDir, { recursive: true })
// Dosya büyüdüyse bir önceki olarak saklanır, yenisine başlanır.
if (existsSync(logPath) && statSync(logPath).size > MAX_LOG_BYTES) renameSync(logPath, `${logPath}.eski`)
const logFile = createWriteStream(logPath, { flags: 'a' })

function log(...args) {
  const line = `${new Date().toLocaleString('tr-TR')} ${args.join(' ')}`
  console.log(line)
  logFile.write(`${line}\n`)
}

// Beklenmeyen hata: kaydedilir ve program kapanır; zamanlanmış görev yeniden başlatır.
process.on('uncaughtException', (err) => {
  const line = `${new Date().toLocaleString('tr-TR')} BEKLENMEYEN HATA: ${err.stack ?? err}\n`
  console.error(line)
  logFile.end(line, () => process.exit(1))
})

// PostgREST ------------------------------------------------------------------

let postgrest = null
let shuttingDown = false

function startPostgrest() {
  if (!existsSync(postgrestPath)) {
    throw new Error(`PostgREST bulunamadı: ${postgrestPath}\nKurulum adımları için server/KURULUM.md dosyasına bakın.`)
  }
  postgrest = spawn(postgrestPath, [postgrestConfPath], { stdio: ['ignore', 'pipe', 'pipe'] })
  for (const stream of [postgrest.stdout, postgrest.stderr]) {
    stream.on('data', (chunk) => {
      process.stdout.write(chunk)
      logFile.write(chunk)
    })
  }
  postgrest.on('error', (err) => log('PostgREST başlatılamadı:', err.message))
  postgrest.on('exit', (code) => {
    if (shuttingDown) return
    log(`PostgREST kapandı (kod ${code}); 3 saniye sonra yeniden başlatılıyor.`)
    setTimeout(startPostgrest, 3000)
  })
}

/** Sunucu programının PostgREST'e kendi adına (iç rol ile) yaptığı çağrı. */
async function authRpc(name, args) {
  const token = signJwt({ role: 'service_role' }, settings.jwtSecret, 60)
  const response = await fetch(`http://127.0.0.1:${settings.postgrestPort}/rpc/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Profile': 'auth_api',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(args),
  })
  if (!response.ok) throw new Error(`auth_api.${name}: ${response.status} ${await response.text()}`)
  return response.json()
}

// Giriş denemesi sınırı ----------------------------------------------------------
// Aynı adresten ya da aynı e-postaya art arda hatalı şifre denenirse bir süre
// yeni deneme kabul edilmez (şifre tahmin saldırısına karşı).

const MAX_FAILURES = 8
const FAILURE_WINDOW_MS = 10 * 60 * 1000
const failures = new Map()

function isBlocked(keys) {
  const now = Date.now()
  return keys.some((key) => {
    const entry = failures.get(key)
    return entry && entry.count >= MAX_FAILURES && now - entry.last < FAILURE_WINDOW_MS
  })
}

function recordFailure(keys) {
  const now = Date.now()
  for (const key of keys) {
    const entry = failures.get(key)
    if (entry && now - entry.last < FAILURE_WINDOW_MS) {
      entry.count += 1
      entry.last = now
    } else {
      failures.set(key, { count: 1, last: now })
    }
  }
}

setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of failures) if (now - entry.last >= FAILURE_WINDOW_MS) failures.delete(key)
}, FAILURE_WINDOW_MS).unref()

// Kimlik doğrulama (/auth/v1) ------------------------------------------------------

function sendJson(res, status, body) {
  const data = body === undefined ? '' : JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(data),
    'Cache-Control': 'no-store',
  })
  res.end(data)
}

/** supabase-js'in anladığı hata biçimi. */
const sendAuthError = (res, status, errorCode, message) =>
  sendJson(res, status, { code: status, error_code: errorCode, msg: message })

async function readJsonBody(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_AUTH_BODY_BYTES) throw new Error('İstek çok büyük.')
    chunks.push(chunk)
  }
  const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
  return parsed && typeof parsed === 'object' ? parsed : {}
}

/** supabase-js'in beklediği kullanıcı nesnesi. */
function publicUser(user) {
  return {
    id: user.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: user.email,
    email_confirmed_at: user.created_at,
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: user.user_metadata ?? {},
    created_at: user.created_at,
    updated_at: user.updated_at,
    last_sign_in_at: user.last_sign_in_at,
  }
}

function sessionFor(user) {
  return {
    access_token: signJwt(
      { role: 'authenticated', sub: user.id, email: user.email },
      settings.jwtSecret,
      ACCESS_TOKEN_SECONDS,
    ),
    token_type: 'bearer',
    expires_in: ACCESS_TOKEN_SECONDS,
    expires_at: Math.floor(Date.now() / 1000) + ACCESS_TOKEN_SECONDS,
    refresh_token: signJwt(
      { typ: 'refresh', sub: user.id, pv: user.password_version },
      refreshSecret(settings.jwtSecret),
      REFRESH_TOKEN_SECONDS,
    ),
    user: publicUser(user),
  }
}

const bearerToken = (req) => /^Bearer (.+)$/i.exec(req.headers.authorization ?? '')?.[1] ?? null

async function handleAuth(req, res, url) {
  const route = `${req.method} ${url.pathname}`

  if (route === 'POST /auth/v1/token' && url.searchParams.get('grant_type') === 'password') {
    const body = await readJsonBody(req)
    const email = String(body.email ?? '').trim().toLowerCase()
    const keys = [`ip:${req.socket.remoteAddress}`, `email:${email}`]
    if (isBlocked(keys)) {
      return sendAuthError(res, 429, 'over_request_rate_limit', 'Çok fazla hatalı deneme. 10 dakika sonra tekrar deneyin.')
    }
    const user = await authRpc('login', { p_email: email, p_password: String(body.password ?? '') })
    if (!user) {
      recordFailure(keys)
      return sendAuthError(res, 400, 'invalid_credentials', 'Invalid login credentials')
    }
    failures.delete(`email:${email}`)
    return sendJson(res, 200, sessionFor(user))
  }

  if (route === 'POST /auth/v1/token' && url.searchParams.get('grant_type') === 'refresh_token') {
    const body = await readJsonBody(req)
    const claims = verifyJwt(body.refresh_token, refreshSecret(settings.jwtSecret))
    const user = claims?.typ === 'refresh' ? await authRpc('get_user', { p_user_id: claims.sub }) : null
    // Şifre değiştiyse eski oturum yenilenmez; kullanıcı yeniden giriş yapar.
    if (!user || user.password_version !== claims.pv) {
      return sendAuthError(res, 400, 'refresh_token_not_found', 'Invalid Refresh Token: Refresh Token Not Found')
    }
    return sendJson(res, 200, sessionFor(user))
  }

  if (route === 'GET /auth/v1/user') {
    const claims = verifyJwt(bearerToken(req), settings.jwtSecret)
    const user = claims?.role === 'authenticated' ? await authRpc('get_user', { p_user_id: claims.sub }) : null
    if (!user) return sendAuthError(res, 401, 'bad_jwt', 'Invalid JWT')
    return sendJson(res, 200, publicUser(user))
  }

  // Oturum sunucuda tutulmaz; çıkışta tarayıcı kendi anahtarlarını siler.
  if (route === 'POST /auth/v1/logout') {
    res.writeHead(204)
    return res.end()
  }

  return sendAuthError(res, 404, 'not_found', 'Bu işlem yerel sunucuda desteklenmiyor.')
}

// Veri istekleri (/rest/v1 -> PostgREST) ----------------------------------------------

function proxyRest(req, res, url) {
  const headers = { ...req.headers }
  delete headers.host
  delete headers.connection

  // supabase-js giriş yapılmamışken "apikey" değerini anahtar olarak da gönderir;
  // bu bir JWT değildir. Atılır, istek giriş yapmamış (anon) sayılır.
  if (headers.authorization === `Bearer ${headers.apikey}`) delete headers.authorization
  delete headers.apikey

  // İç şema sadece bu programın kendi çağrılarına açıktır.
  const profile = `${headers['content-profile'] ?? ''} ${headers['accept-profile'] ?? ''}`
  if (profile.includes('auth_api')) return sendJson(res, 403, { message: 'Bu işlem için yetkiniz yok.' })

  const upstream = http.request(
    {
      host: '127.0.0.1',
      port: settings.postgrestPort,
      method: req.method,
      path: url.pathname.slice('/rest/v1'.length) + url.search || '/',
      headers,
    },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers)
      upstreamRes.pipe(res)
    },
  )
  upstream.on('error', () => {
    if (res.headersSent) return res.destroy()
    sendJson(res, 503, { code: 'PGRST000', message: 'Veritabanı servisine ulaşılamadı. Sunucu bilgisayarını kontrol edin.' })
  })
  req.pipe(upstream)
}

// Uygulama dosyaları (dist/) --------------------------------------------------------

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

function serveStatic(req, res, url) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405)
    return res.end()
  }

  let pathname
  try {
    pathname = decodeURIComponent(url.pathname)
  } catch {
    res.writeHead(400)
    return res.end()
  }

  let filePath = normalize(join(distDir, pathname))
  // dist klasörünün dışına çıkan yollar reddedilir.
  if (filePath !== distDir && !filePath.startsWith(distDir + sep)) {
    res.writeHead(403)
    return res.end()
  }

  const isFile = existsSync(filePath) && statSync(filePath).isFile()
  if (!isFile) {
    // Dosya uzantılı ama olmayan istek gerçek bir 404'tür; diğerleri uygulama
    // içi sayfa adresidir (/dagitim gibi) ve index.html ile karşılanır.
    if (extname(pathname)) {
      res.writeHead(404)
      return res.end()
    }
    filePath = join(distDir, 'index.html')
    if (!existsSync(filePath)) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
      return res.end('Uygulama derlenmemiş. Sunucu bilgisayarında "npm run build" çalıştırın.')
    }
  }

  res.writeHead(200, {
    'Content-Type': mimeTypes[extname(filePath).toLowerCase()] ?? 'application/octet-stream',
    'Content-Length': statSync(filePath).size,
    // Derleme çıktısındaki dosya adları içerik özetlidir; index.html her seferinde tazelenir.
    'Cache-Control': pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
    'X-Content-Type-Options': 'nosniff',
  })
  if (req.method === 'HEAD') return res.end()
  createReadStream(filePath).pipe(res)
}

// HTTP sunucusu -----------------------------------------------------------------------

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost')
  if (url.pathname.startsWith('/auth/v1/')) {
    handleAuth(req, res, url).catch((err) => {
      log('Kimlik doğrulama hatası:', err.message)
      if (!res.headersSent) sendAuthError(res, 500, 'unexpected_failure', 'Sunucu hatası. Sunucu bilgisayarını kontrol edin.')
    })
  } else if (url.pathname === '/rest/v1' || url.pathname.startsWith('/rest/v1/')) {
    proxyRest(req, res, url)
  } else {
    serveStatic(req, res, url)
  }
})

function shutdown() {
  shuttingDown = true
  postgrest?.kill()
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(0), 2000).unref()
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

server.on('error', (err) => {
  throw new Error(
    err.code === 'EADDRINUSE'
      ? `${settings.port} portu kullanımda. Sunucu zaten çalışıyor olabilir.`
      : `Sunucu başlatılamadı: ${err.message}`,
  )
})

startPostgrest()
server.listen(settings.port, '0.0.0.0', () => {
  log(`BoruStok sunucusu çalışıyor (port ${settings.port}). Ağdaki bilgisayarlardan şu adreslerle açılır:`)
  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family === 'IPv4' && !address.internal) log(`  http://${address.address}:${settings.port}`)
    }
  }
  log(`  http://localhost:${settings.port}  (bu bilgisayardan)`)
})
