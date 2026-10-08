import { categoryLabels, type PipeCategory, type Product } from '@/features/products/types'
import { formatNumber } from '@/utils/number'
import type { StockBalance } from '../api'

interface StockSummaryProps {
  products: Product[]
  balances: Map<string, StockBalance>
}

/** Kategori bazında toplam stok kartları. */
export default function StockSummary({ products, balances }: StockSummaryProps) {
  const categories = Object.keys(categoryLabels) as PipeCategory[]

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {categories.map((category) => {
        const items = products.filter((p) => p.category === category)
        const pieces = items.reduce((s, p) => s + (balances.get(p.id)?.pieces ?? 0), 0)
        const meters = items.reduce((s, p) => s + (balances.get(p.id)?.meters ?? 0), 0)
        const inStock = items.filter((p) => (balances.get(p.id)?.pieces ?? 0) > 0).length
        return (
          <div key={category} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-medium text-slate-500">{categoryLabels[category]}</p>
            <p className="mt-1 text-2xl font-semibold">
              {formatNumber(pieces)} <span className="text-base font-normal text-slate-500">adet</span>
            </p>
            <p className="text-sm text-slate-600">{formatNumber(meters)} m</p>
            <p className="mt-1 text-xs text-slate-400">Stokta {inStock} boru tipi</p>
          </div>
        )
      })}
    </div>
  )
}
