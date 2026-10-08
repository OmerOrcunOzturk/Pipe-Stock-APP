import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import { env } from './env'

let client: SupabaseClient<Database> | null = null

/**
 * Uygulama genelinde tek veri istemcisi. Yerel sunucu Supabase ile aynı
 * arayüzü (PostgREST + /auth/v1) sunduğu için supabase-js kullanılmaya devam eder.
 */
export function getSupabase(): SupabaseClient<Database> {
  client ??= createClient<Database>(env.supabaseUrl, env.supabaseKey)
  return client
}
