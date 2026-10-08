import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import Button from '@/components/ui/Button'
import { TextInput } from '@/components/ui/Field'
import ListState from '@/components/ui/ListState'
import StatusBadge from '@/components/ui/StatusBadge'
import { useIsAdmin } from '@/features/auth/authContext'
import { useDeleteVillage, useSetVillageActive, useVillages } from '../hooks'
import { villageDisplayName, type Village } from '../types'
import VillageForm from './VillageForm'

export default function VillagesTab() {
  const isAdmin = useIsAdmin()
  const { data: villages = [], isLoading, error } = useVillages()
  const setActive = useSetVillageActive()
  const remove = useDeleteVillage()

  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  // undefined: form kapalı, null: yeni kayıt, Village: düzenleme
  const [editing, setEditing] = useState<Village | null | undefined>(undefined)

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr')
    return villages.filter(
      (v) =>
        (showInactive || v.is_active) &&
        (!q || villageDisplayName(v).toLocaleLowerCase('tr').includes(q)),
    )
  }, [villages, search, showInactive])

  function toggleActive(v: Village) {
    const action = v.is_active ? 'pasife almak' : 'tekrar aktif etmek'
    if (!confirm(`"${villageDisplayName(v)}" köyünü ${action} istiyor musunuz?`)) return
    setActive.mutate(
      { id: v.id, isActive: !v.is_active },
      { onError: (err) => alert(err.message) },
    )
  }

  function handleDelete(v: Village) {
    if (
      !confirm(
        `"${villageDisplayName(v)}" köyü kalıcı olarak silinsin mi?\n\nSadece hiç stok belgesi olmayan köyler silinebilir.`,
      )
    )
      return
    remove.mutate(v.id, { onError: (err) => alert(err.message) })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <TextInput
          type="search"
          placeholder="Ara: köy veya ilçe…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mt-0 md:max-w-xs"
        />
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          Pasifleri göster
        </label>
        {isAdmin && (
          <Button onClick={() => setEditing(null)} className="md:ml-auto">
            <Plus className="size-4" aria-hidden /> Yeni köy
          </Button>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <ListState
          isLoading={isLoading}
          error={error}
          isEmpty={filtered.length === 0}
          emptyText={villages.length === 0 ? 'Henüz köy tanımlanmadı.' : 'Aramaya uygun kayıt yok.'}
        />
        {!isLoading && !error && filtered.length > 0 && (
          <ul className="divide-y divide-slate-100">
            {filtered.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{v.name}</p>
                  <p className="truncate text-xs text-slate-500">
                    {v.district || 'İlçe belirtilmemiş'}
                    {v.muhtar_name && ` · Muhtar: ${v.muhtar_name}`}
                    {v.note && ` · ${v.note}`}
                  </p>
                </div>
                <StatusBadge active={v.is_active} />
                {isAdmin && (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(v)}>
                      <Pencil className="size-4" aria-hidden /> Düzenle
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleActive(v)}
                      disabled={setActive.isPending}
                    >
                      {v.is_active ? 'Pasife al' : 'Aktif et'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:bg-red-50"
                      onClick={() => handleDelete(v)}
                      disabled={remove.isPending}
                    >
                      <Trash2 className="size-4" aria-hidden /> Sil
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {editing !== undefined && (
        <VillageForm village={editing ?? undefined} onClose={() => setEditing(undefined)} />
      )}
    </div>
  )
}
