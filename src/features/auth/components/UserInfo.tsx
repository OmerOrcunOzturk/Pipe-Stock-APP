import { useAuth } from '../authContext'
import { roleLabels } from '../roles'

/** Oturumdaki kullanıcının adı ve rolü. */
export default function UserInfo() {
  const { profile, session } = useAuth()
  if (!profile) return null

  return (
    <div className="min-w-0">
      <p className="truncate text-sm font-medium text-slate-800">
        {profile.full_name || session?.user.email}
      </p>
      <p className="truncate text-xs text-slate-500">{roleLabels[profile.role]}</p>
    </div>
  )
}
