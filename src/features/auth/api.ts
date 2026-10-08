import { getSupabase } from '@/lib/supabase'
import type { UserRole } from './roles'

export interface Profile {
  id: string
  full_name: string
  role: UserRole
  is_active: boolean
}

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await getSupabase().auth.signInWithPassword({ email, password })
  if (error) throw new Error(translateAuthError(error.message))
}

export async function signOut(): Promise<void> {
  const { error } = await getSupabase().auth.signOut()
  if (error) throw new Error(error.message)
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await getSupabase()
    .from('profiles')
    .select('id, full_name, role, is_active')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

function translateAuthError(message: string): string {
  if (message.includes('Invalid login credentials')) return 'E-posta veya şifre hatalı.'
  if (message.includes('Email not confirmed')) return 'E-posta adresi onaylanmamış.'
  if (message.toLowerCase().includes('fetch')) return 'Sunucuya ulaşılamadı. Ağ bağlantınızı kontrol edin.'
  return message
}
