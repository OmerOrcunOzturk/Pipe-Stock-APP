import { ArrowLeft } from 'lucide-react'
import { Link, useParams } from 'react-router'
import ListState from '@/components/ui/ListState'
import PageHeader from '@/components/ui/PageHeader'
import { useProducts } from '@/features/products/hooks'
import { categoryLabels, productDisplayName } from '@/features/products/types'
import { villageDisplayName } from '@/features/villages/types'
import { formatDate, formatDateTime } from '@/utils/date'
import { formatNumber } from '@/utils/number'
import type { StockMovementListItem } from '../api'
import { docTypeLabels, formatDocNo } from '../docTypes'
import { useBalanceMap, useMovements } from '../hooks'

const MOVEMENT_LIMIT = 200

function signed(value: number): string {
  return `${value > 0 ? '+' : '−'}${formatNumber(Math.abs(value))}`
}

function counterparty(m: StockMovementListItem): string {
  const doc = m.document
  if (doc.village) return villageDisplayName(doc.village)
  if (doc.doc_type === 'giris') return doc.supplier
  return doc.note
}

/**
 * Her hareket için işlem sonrası stoğu hesaplar: güncel bakiyeden geriye doğru
 * yürünür (hareketler en yeniden eskiye sıralıdır).
 */
function withBalanceAfter(movements: StockMovementListItem[], pieces: number, meters: number) {
  const rows: { m: StockMovementListItem; after: { pieces: number; meters: number } }[] = []
  for (const m of movements) {
    rows.push({ m, after: { pieces, meters } })
    pieces -= m.qty_pieces
    meters = Math.round((meters - m.qty_meters) * 100) / 100
  }
  return rows
}

export default function ProductMovementsPage() {
  const { productId = '' } = useParams()
  const { data: products = [], isLoading: productsLoading } = useProducts()
  const { map: balances, isLoading: balancesLoading } = useBalanceMap()
  const { data: movements = [], isLoading: movementsLoading, error } = useMovements(productId)

  const product = products.find((p) => p.id === productId)
  const balance = balances.get(productId)
  const isLoading = productsLoading || balancesLoading || movementsLoading

  const rows = withBalanceAfter(movements, balance?.pieces ?? 0, balance?.meters ?? 0)

  if (!isLoading && !product) {
    return (
      <>
        <PageHeader title="Boru tipi bulunamadı" />
        <Link to="/stok" className="text-sm font-medium text-blue-700 underline">
          Stok listesine dön
        </Link>
      </>
    )
  }

  return (
    <>
      <Link to="/stok" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="size-4" aria-hidden /> Stok listesi
      </Link>
      <PageHeader
        title={product ? productDisplayName(product) : 'Yükleniyor…'}
        description={product ? `${categoryLabels[product.category]} · 1 adet = ${formatNumber(product.standard_length_m)} m` : undefined}
      />

      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-medium text-slate-500">Depodaki güncel stok</p>
        <p className="mt-1 text-2xl font-semibold">
          {formatNumber(balance?.pieces ?? 0)} <span className="text-base font-normal text-slate-500">adet</span>
          <span className="ml-3 text-base font-normal text-slate-600">{formatNumber(balance?.meters ?? 0)} m</span>
        </p>
      </div>

      <h2 className="mb-2 text-sm font-semibold text-slate-700">Hareket geçmişi</h2>
      <div className="rounded-xl border border-slate-200 bg-white">
        <ListState
          isLoading={isLoading}
          error={error}
          isEmpty={rows.length === 0}
          emptyText="Bu boru tipinde henüz hareket yok."
        />
        {!isLoading && !error && rows.length > 0 && (
          <ul className="divide-y divide-slate-100">
            {rows.map(({ m, after }) => {
              const doc = m.document
              const incoming = m.qty_pieces > 0
              return (
                <li key={m.id} className="flex flex-wrap items-start gap-x-4 gap-y-1 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      <span className="font-mono font-semibold">{formatDocNo(doc.doc_type, doc.doc_no)}</span>
                      <span className="ml-2">{docTypeLabels[doc.doc_type]}</span>
                      <span className="ml-2 text-slate-500">{formatDate(doc.doc_date)}</span>
                      {doc.status === 'iptal_edildi' && (
                        <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                          İptal edildi
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-slate-600">{counterparty(m)}</p>
                    <p className="text-xs text-slate-400">
                      {doc.creator?.full_name || 'Bilinmeyen kullanıcı'} · {formatDateTime(m.created_at)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${incoming ? 'text-green-700' : 'text-red-700'}`}>
                      {signed(m.qty_pieces)} adet
                    </p>
                    <p className="text-xs text-slate-500">{signed(m.qty_meters)} m</p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      Sonrası: {formatNumber(after.pieces)} adet / {formatNumber(after.meters)} m
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
      {movements.length === MOVEMENT_LIMIT && (
        <p className="mt-2 text-xs text-slate-500">Son {MOVEMENT_LIMIT} hareket gösteriliyor.</p>
      )}
    </>
  )
}
