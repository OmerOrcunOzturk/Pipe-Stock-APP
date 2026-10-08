import type { Session } from '@supabase/supabase-js'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type ReactNode } from 'react'
import { getSupabase } from '@/lib/supabase'
import { fetchProfile } from './api'
import { AuthContext } from './authContext'

export default function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [session, setSession] = useState<Session | null>(null)
  const [isSessionLoading, setIsSessionLoading] = useState(true)

  useEffect(() => {
    // INITIAL_SESSION olayı ilk açılışta mevcut oturumu da bildirir.
    // Not: Bu callback içinde başka Supabase çağrısı await edilmemeli.
    const { data } = getSupabase().auth.onAuthStateChange((event, newSession) => {
      setSession(newSession)
      setIsSessionLoading(false)
      if (event === 'SIGNED_OUT') queryClient.clear()
    })
    return () => data.subscription.unsubscribe()
  }, [queryClient])

  const userId = session?.user.id
  const profileQuery = useQuery({
    queryKey: ['profile', userId],
    queryFn: () => fetchProfile(userId!),
    enabled: !!userId,
  })

  const value = {
    isLoading: isSessionLoading || (!!userId && profileQuery.isPending),
    session,
    profile: profileQuery.data ?? null,
    profileError: profileQuery.error?.message ?? null,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
