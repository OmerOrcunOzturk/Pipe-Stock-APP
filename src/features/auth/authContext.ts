import type { Session } from '@supabase/supabase-js'
import { createContext, useContext } from 'react'
import type { Profile } from './api'

export interface AuthState {
  /** Oturum bilgisi henüz yükleniyor mu (ilk açılış). */
  isLoading: boolean
  session: Session | null
  profile: Profile | null
  /** Profil okunurken hata oluştuysa mesajı. */
  profileError: string | null
}

export const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth, AuthProvider içinde kullanılmalıdır.')
  return ctx
}

/** Oturumdaki kullanıcı aktif admin mi? (Arayüz için; asıl kontrol veritabanında.) */
export function useIsAdmin(): boolean {
  const { profile } = useAuth()
  return profile?.is_active === true && profile.role === 'admin'
}
