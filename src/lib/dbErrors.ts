/** PostgREST / PostgreSQL hata nesnesinin ihtiyaç duyduğumuz kısmı. */
interface DbErrorLike {
  code?: string
  message: string
}

/** Belirli hata kodları için özel mesajlar (örn. unique ihlali için "zaten tanımlı"). */
export type DbErrorMessages = Partial<Record<string, string>>

const defaultMessages: Record<string, string> = {
  '23505': 'Bu kayıt zaten mevcut.',
  '23514': 'Girilen değerlerden biri geçersiz.',
  '23503': 'Bu kayıt başka kayıtlarla ilişkili olduğu için işlem yapılamaz.',
  '42501': 'Bu işlem için yetkiniz yok.',
  PGRST116: 'Kayıt bulunamadı.',
}

/**
 * Veritabanı hatasını kullanıcıya gösterilecek Türkçe bir Error'a çevirir.
 * Kendi fonksiyonlarımızdan gelen (P0001 vb.) mesajlar zaten Türkçe olduğu için
 * olduğu gibi gösterilir.
 */
export function toUserError(error: DbErrorLike, overrides: DbErrorMessages = {}): Error {
  const code = error.code ?? ''
  const message =
    overrides[code] ??
    defaultMessages[code] ??
    (error.message.toLowerCase().includes('fetch')
      ? 'Sunucuya ulaşılamadı. Ağ bağlantınızı kontrol edin.'
      : error.message)
  return new Error(message)
}
