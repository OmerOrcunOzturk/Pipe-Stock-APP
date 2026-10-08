import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import FullScreenMessage from '@/components/ui/FullScreenMessage'
import { useAuth } from '../authContext'
import SignOutButton from './SignOutButton'

/** Oturum açmamış veya aktif olmayan kullanıcıların sayfalara erişimini engeller. */
export default function RequireAuth({ children }: { children: ReactNode }) {
  const { isLoading, session, profile, profileError } = useAuth()
  const location = useLocation()

  if (isLoading) return <FullScreenMessage title="Yükleniyor…" />

  if (!session) {
    return <Navigate to="/oturum-ac" replace state={{ from: location.pathname }} />
  }

  if (profileError) {
    return (
      <FullScreenMessage title="Profil bilgisi alınamadı" description={profileError}>
        <SignOutButton variant="button" />
      </FullScreenMessage>
    )
  }

  if (!profile || !profile.is_active) {
    return (
      <FullScreenMessage
        title="Hesabınız aktif değil"
        description="Uygulamayı kullanabilmek için yöneticinizle iletişime geçin."
      >
        <SignOutButton variant="button" />
      </FullScreenMessage>
    )
  }

  return children
}
