// Yerel kurulumda uygulamayı sunan program (server/sunucu.mjs) aynı adreste
// /auth/v1 ve /rest/v1 yollarını da karşılar; ayrı bir adres ya da anahtar gerekmez.
// Değişkenler sadece uygulama başka bir sunucuya bağlanacaksa tanımlanır.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() || window.location.origin
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || 'yerel'

export const env = {
  supabaseUrl,
  supabaseKey,
} as const
