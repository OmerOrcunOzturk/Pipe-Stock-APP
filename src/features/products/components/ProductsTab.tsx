import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import Button from '@/components/ui/Button'
import { SelectInput, TextInput } from '@/components/ui/Field'
import ListState from '@/components/ui/ListState'
import StatusBadge from '@/components/ui/StatusBadge'
import { useIsAdmin } from '@/features/auth/authContext'
import { formatNumber } from '@/utils/number'
import { useDeleteProduct, useProducts, useSetProductActive } from '../hooks'
import { categoryLabels, productDisplayName, type PipeCategory, type Product } from '../types'
import ProductForm from './ProductForm'

export default function ProductsTab() {
  const isAdmin = useIsAdmin()
  const { data: products = [], isLoading, error } = useProducts()
  const setActive = useSetProductActive()
  const remove = useDeleteProduct()

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<PipeCategory | ''>('')
  const [showInactive, setShowInactive] = useState(false)
  // undefined: form kapalı, null: yeni kayıt, Product: düzenleme
  const [editing, setEditing] = useState<Product | null | undefined>(undefined)

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr')
    return products.filter(
      (p) =>
        (showInactive || p.is_active) &&
        (!category || p.category === category) &&
        (!q || productDisplayName(p).toLocaleLowerCase('tr').includes(q)),
    )
  }, [products, search, category, showInactive])

  function toggleActive(p: Product) {
    const action = p.is_active ? 'pasife almak' : 'tekrar aktif etmek'
    if (!confirm(`"${productDisplayName(p)}" boru tipini ${action} istiyor musunuz?`)) return
    setActive.mutate(
      { id: p.id, isActive: !p.is_active },
      { onError: (err) => alert(err.message) },
    )
  }

  function handleDelete(p: Product) {
    if (
      !confirm(
        `"${productDisplayName(p)}" boru tipi kalıcı olarak silinsin mi?\n\nSadece hiç stok hareketi olmayan boru tipleri silinebilir.`,
      )
    )
      return
    remove.mutate(p.id, { onError: (err) => alert(err.message) })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <TextInput
          type="search"
          placeholder="Ara: çap, malzeme, sınıf…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mt-0 md:max-w-xs"
        />
        <SelectInput
          value={category}
          onChange={(e) => setCategory(e.target.value as PipeCategory | '')}
          className="mt-0 md:w-44"
        >
          <option value="">Tüm kategoriler</option>
          {Object.entries(categoryLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </SelectInput>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          Pasifleri göster
        </label>
        {isAdmin && (
          <Button onClick={() => setEditing(null)} className="md:ml-auto">
            <Plus className="size-4" aria-hidden /> Yeni boru tipi
          </Button>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <ListState
          isLoading={isLoading}
          error={error}
          isEmpty={filtered.length === 0}
          emptyText={products.length === 0 ? 'Henüz boru tipi tanımlanmadı.' : 'Aramaya uygun kayıt yok.'}
        />
        {!isLoading && !error && filtered.length > 0 && (
          <ul className="divide-y divide-slate-100">
            {filtered.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{productDisplayName(p)}</p>
                  <p className="text-xs text-slate-500">
                    {categoryLabels[p.category]} · 1 adet = {formatNumber(p.standard_length_m)} m
                  </p>
                </div>
                <StatusBadge active={p.is_active} />
                {isAdmin && (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(p)}>
                      <Pencil className="size-4" aria-hidden /> Düzenle
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleActive(p)}
                      disabled={setActive.isPending}
                    >
                      {p.is_active ? 'Pasife al' : 'Aktif et'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:bg-red-50"
                      onClick={() => handleDelete(p)}
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
        <ProductForm product={editing ?? undefined} onClose={() => setEditing(undefined)} />
      )}
    </div>
  )
}
