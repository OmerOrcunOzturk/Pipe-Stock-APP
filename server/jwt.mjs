/** HS256 JWT üretme ve doğrulama (PostgREST'in beklediği biçim). */
import { createHmac, timingSafeEqual } from 'node:crypto'

const b64url = (input) => Buffer.from(input).toString('base64url')
const sign = (data, secret) => createHmac('sha256', secret).update(data).digest('base64url')

/** Oturum yenileme anahtarı ayrı bir anahtarla imzalanır; PostgREST onu erişim anahtarı olarak kabul etmez. */
export const refreshSecret = (secret) => createHmac('sha256', secret).update('refresh').digest('hex')

export function signJwt(claims, secret, lifetimeSeconds) {
  const now = Math.floor(Date.now() / 1000)
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = b64url(JSON.stringify({ ...claims, iat: now, exp: now + lifetimeSeconds }))
  return `${header}.${payload}.${sign(`${header}.${payload}`, secret)}`
}

/** Geçerliyse içeriği, değilse (imza hatalı, süresi dolmuş, bozuk) null döndürür. */
export function verifyJwt(token, secret) {
  const parts = typeof token === 'string' ? token.split('.') : []
  if (parts.length !== 3) return null
  const expected = Buffer.from(sign(`${parts[0]}.${parts[1]}`, secret))
  const given = Buffer.from(parts[2])
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null
  try {
    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString())
    const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString())
    if (header.alg !== 'HS256') return null
    if (typeof claims.exp !== 'number' || claims.exp <= Date.now() / 1000) return null
    return claims
  } catch {
    return null
  }
}
