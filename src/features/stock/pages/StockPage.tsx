import { ChevronRight, ClipboardCheck } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { SelectInput, TextInput } from '@/components/ui/Field'
import ListState from '@/components/ui/ListState'
import PageHeader from '@/components/ui/PageHeader'
import { useProducts } from '@/features/products/hooks'
import { categoryLabels, productDisplayName, type PipeCategory } from '@/features/products/types'
import { formatNumber } from '@/utils/number'
import StockSummary from '../components/StockSummary'
import { useBalanceMap } from '../hooks'

export default function StockPage() {
  const { data: products = [], isLoading: productsLoading, error: productsError } = useProducts()
  const { map: balances, isLoading: balancesLoading, error: balancesError } = useBalanceMap()

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<PipeCategory | ''>('')
  const [onlyInStock, setOnlyInStock] = useState(false)

  const rows = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr')
    return products.filter((p) => {
      const pieces = balances.get(p.id)?.pieces ?? 0
      // Pasif boru tipi sadece stoğu varsa gösterilir.
      if (!p.is_active && pieces === 0) return false
      if (onlyInStock && pieces === 0) return false
      if (category && p.category !== category) return false
      return !q || productDisplayName(p).toLocaleLowerCase('tr').includes(q)
    })
  }, [products, balances, search, category, onlyInStock])

  const isLoading = productsLoading || balancesLoading
  const error = productsError ?? balancesError

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader title="Stok Durumu" description="Boru tiplerine göre depodaki güncel miktarlar." />
        <Link
          to="/stok/duzeltme"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <ClipboardCheck className="size-4" aria-hidden /> Sayım düzeltmeleri
        </Link>
      </div>

      {!isLoading && !error && (
        <div className="mb-4">
          <StockSummary products={products} balances={balances} />
        </div>
      )}

      <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center">
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
          <input type="checkbox" checked={onlyInStock} onChange={(e) => setOnlyInStock(e.target.checked)} />
          Sadece stokta olanlar
        </label>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <ListState
          isLoading={isLoading}
          error={error}
          isEmpty={rows.length === 0}
          emptyText={products.length === 0 ? 'Henüz boru tipi tanımlanmadı.' : 'Gösterilecek kayıt yok.'}
        />
        {!isLoading && !error && rows.length > 0 && (
          <ul className="divide-y divide-slate-100">
            {rows.map((p) => {
              const balance = balances.get(p.id)
              const pieces = balance?.pieces ?? 0
              return (
                <li key={p.id}>
                  <Link to={`/stok/${p.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">
                        {productDisplayName(p)}
                        {!p.is_active && <span className="ml-2 text-xs font-normal text-slate-400">(pasif)</span>}
                      </p>
                      <p className="text-xs text-slate-500">{categoryLabels[p.category]}</p>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold ${pieces === 0 ? 'text-slate-400' : ''}`}>
                        {formatNumber(pieces)} adet
                      </p>
                      <p className="text-xs text-slate-500">{formatNumber(balance?.meters ?? 0)} m</p>
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-slate-300" aria-hidden />
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </>
  )
}
