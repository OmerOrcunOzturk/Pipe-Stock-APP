import { useState, type ReactNode } from 'react'
import Button from '@/components/ui/Button'
import ListState from '@/components/ui/ListState'
import { useIsAdmin } from '@/features/auth/authContext'
import { formatDate, formatDateTime } from '@/utils/date'
import { formatNumber } from '@/utils/number'
import type { StockDocumentListItem } from '../api'
import { formatDocNo } from '../docTypes'
import CancelDocumentDialog from './CancelDocumentDialog'

interface DocumentListProps {
  documents: StockDocumentListItem[]
  isLoading: boolean
  error: Error | null
  emptyText: string
  /** Belgeye özgü başlık bilgisi (tedarikçi, köy vb.). */
  renderInfo: (doc: StockDocumentListItem) => ReactNode
  /** İptal edilmemiş belgelerde gösterilen ek işlemler (form indirme vb.). */
  renderActions?: (doc: StockDocumentListItem) => ReactNode
}

const formatAbs = (value: number) => formatNumber(Math.abs(value))
const formatSigned = (value: number) =>
  value === 0 ? '0' : `${value > 0 ? '+' : '−'}${formatNumber(Math.abs(value))}`

export default function DocumentList({
  documents,
  isLoading,
  error,
  emptyText,
  renderInfo,
  renderActions,
}: DocumentListProps) {
  const isAdmin = useIsAdmin()
  const [showCancelled, setShowCancelled] = useState(false)
  const [cancelling, setCancelling] = useState<StockDocumentListItem | null>(null)

  const cancelledCount = documents.filter((d) => d.status === 'iptal_edildi').length
  const visible = showCancelled ? documents : documents.filter((d) => d.status !== 'iptal_edildi')

  return (
    <div className="space-y-2">
      {cancelledCount > 0 && (
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={showCancelled} onChange={(e) => setShowCancelled(e.target.checked)} />
          İptal edilenleri göster ({cancelledCount})
        </label>
      )}

      <div className="rounded-xl border border-slate-200 bg-white">
        <ListState
          isLoading={isLoading}
          error={error}
          isEmpty={visible.length === 0}
          emptyText={documents.length === 0 ? emptyText : 'Gösterilecek aktif belge yok.'}
        />
        {!isLoading && !error && visible.length > 0 && (
          <ul className="divide-y divide-slate-100">
            {visible.map((doc) => {
              const cancelled = doc.status === 'iptal_edildi'
              // Düzeltme belgelerinde satırlar artı da eksi de olabilir; işaretli gösterilir.
              const fmt = doc.doc_type === 'duzeltme' ? formatSigned : formatAbs
              const totalPieces = doc.lines.reduce((s, l) => s + (fmt === formatSigned ? l.qty_pieces : Math.abs(l.qty_pieces)), 0)
              const totalMeters = doc.lines.reduce((s, l) => s + (fmt === formatSigned ? l.qty_meters : Math.abs(l.qty_meters)), 0)
              return (
                <li key={doc.id} className={`px-4 py-3 ${cancelled ? 'bg-slate-50 text-slate-400' : ''}`}>
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="font-mono text-sm font-semibold">{formatDocNo(doc.doc_type, doc.doc_no)}</span>
                    <span className="text-sm">{formatDate(doc.doc_date)}</span>
                    {cancelled && (
                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                        İptal edildi
                      </span>
                    )}
                    <span className="min-w-0 flex-1 text-sm">{renderInfo(doc)}</span>
                    <span className="text-sm font-medium">
                      {fmt(totalPieces)} adet / {fmt(totalMeters)} m
                    </span>
                  </div>
                  <ul className={`mt-1.5 space-y-0.5 text-xs ${cancelled ? 'line-through' : 'text-slate-600'}`}>
                    {doc.lines.map((l) => (
                      <li key={l.id}>
                        {l.product?.name}: {fmt(l.qty_pieces)} adet / {fmt(l.qty_meters)} m
                      </li>
                    ))}
                  </ul>
                  <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-slate-400">
                      {doc.creator?.full_name || 'Bilinmeyen kullanıcı'} · {formatDateTime(doc.created_at)}
                      {doc.note && ` · ${doc.note}`}
                    </p>
                    {!cancelled && (
                      <div className="flex flex-wrap items-center gap-1">
                        {renderActions?.(doc)}
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:bg-red-50"
                            onClick={() => setCancelling(doc)}
                          >
                            İptal et
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {cancelling && <CancelDocumentDialog document={cancelling} onClose={() => setCancelling(null)} />}
    </div>
  )
}
