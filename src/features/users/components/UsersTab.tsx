import { Pencil, Plus } from 'lucide-react'
import { useState } from 'react'
import Button from '@/components/ui/Button'
import ListState from '@/components/ui/ListState'
import StatusBadge from '@/components/ui/StatusBadge'
import { useAuth } from '@/features/auth/authContext'
import { roleLabels } from '@/features/auth/roles'
import { formatDateTime } from '@/utils/date'
import type { AppUser } from '../api'
import { useUsers } from '../hooks'
import UserForm from './UserForm'

export default function UsersTab() {
  const { session } = useAuth()
  const { data: users = [], isLoading, error } = useUsers()
  // undefined: form kapalı, null: yeni kullanıcı, AppUser: düzenleme
  const [editing, setEditing] = useState<AppUser | null | undefined>(undefined)

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setEditing(null)}>
          <Plus className="size-4" aria-hidden /> Yeni kullanıcı
        </Button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <ListState isLoading={isLoading} error={error} isEmpty={users.length === 0} emptyText="Kullanıcı yok." />
        {!isLoading && !error && users.length > 0 && (
          <ul className="divide-y divide-slate-100">
            {users.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {u.full_name || <span className="text-slate-400">Ad girilmemiş</span>}
                    {u.id === session?.user.id && (
                      <span className="ml-2 text-xs font-normal text-slate-400">(siz)</span>
                    )}
                  </p>
                  <p className="truncate text-xs text-slate-500">{u.email}</p>
                  <p className="text-xs text-slate-400">
                    Son giriş: {u.last_sign_in_at ? formatDateTime(u.last_sign_in_at) : 'hiç giriş yapmadı'}
                  </p>
                </div>
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-800">
                  {roleLabels[u.role]}
                </span>
                <StatusBadge active={u.is_active} />
                <Button variant="ghost" size="sm" onClick={() => setEditing(u)}>
                  <Pencil className="size-4" aria-hidden /> Düzenle
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {editing !== undefined && (
        <UserForm
          user={editing ?? undefined}
          isSelf={editing?.id === session?.user.id}
          onClose={() => setEditing(undefined)}
        />
      )}
    </div>
  )
}
