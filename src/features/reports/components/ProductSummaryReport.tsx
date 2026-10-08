import { useMemo, useState } from 'react'
import ListState from '@/components/ui/ListState'
import { categoryLabels } from '@/features/products/types'
import { formatDate } from '@/utils/date'
import { exportTableToExcel } from '@/utils/excel'
import { formatNumber } from '@/utils/number'
import type { DateRange, ProductSummaryRow } from '../api'
import { useProductSummary } from '../hooks'
import ExportButton from './ExportButton'

const hasActivity = (r: ProductSummaryRow) =>
  r.received_pieces !== 0 ||
  r.distributed_pieces !== 0 ||
  r.returned_pieces !== 0 ||
  r.adjusted_pieces !== 0 ||
  r.balance_pieces !== 0

const signed = (value: number) => (value > 0 ? `+${formatNumber(value)}` : formatNumber(value))

function Cell({ pieces, meters, sign = false }: { pieces: number; meters: number; sign?: boolean }) {
  if (pieces === 0 && meters === 0) return <td className="px-3 py-2 text-right text-slate-300">—</td>
  return (
    <td className="px-3 py-2 text-right whitespace-nowrap">
      <span className="font-medium">{sign ? signed(pieces) : formatNumber(pieces)}</span>
      <span className="block text-xs text-slate-500">{sign ? signed(meters) : formatNumber(meters)} m</span>
    </td>
  )
}

export default function ProductSummaryReport({ range }: { range: DateRange }) {
  const { data: allRows = [], isLoading, error, isEnabled } = useProductSummary(range)
  const [showIdle, setShowIdle] = useState(false)

  const rows = useMemo(() => (showIdle ? allRows : allRows.filter(hasActivity)), [allRows, showIdle])

  function handleExport() {
    return exportTableToExcel({
      fileName: `boru-bazli-ozet_${range.from}_${range.to}`,
      sheetName: 'Boru Bazlı Özet',
      title: 'Boru Bazlı Stok Hareket Özeti',
      subtitles: [
        `Tarih aralığı: ${formatDate(range.from)} – ${formatDate(range.to)}`,
        'İptal edilen belgeler dahil değildir. Güncel stok, raporun alındığı andaki stoktur.',
      ],
      columns: [
        { header: 'Boru Tipi', value: (r) => r.product_name, width: 24 },
        { header: 'Kategori', value: (r) => categoryLabels[r.category], width: 14 },
        { header: 'Giren Adet', value: (r) => r.received_pieces, format: 'int', total: true },
        { header: 'Giren Metre', value: (r) => r.received_meters, format: 'decimal', total: true },
        { header: 'Dağıtılan Adet', value: (r) => r.distributed_pieces, format: 'int', total: true },
        { header: 'Dağıtılan Metre', value: (r) => r.distributed_meters, format: 'decimal', total: true },
        { header: 'İade Adet', value: (r) => r.returned_pieces, format: 'int', total: true },
        { header: 'İade Metre', value: (r) => r.returned_meters, format: 'decimal', total: true },
        { header: 'Düzeltme Adet', value: (r) => r.adjusted_pieces, format: 'int', total: true },
        { header: 'Düzeltme Metre', value: (r) => r.adjusted_meters, format: 'decimal', total: true },
        { header: 'Güncel Stok Adet', value: (r) => r.balance_pieces, format: 'int', total: true, width: 18 },
        { header: 'Güncel Stok Metre', value: (r) => r.balance_meters, format: 'decimal', total: true, width: 18 },
      ],
      rows,
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={showIdle} onChange={(e) => setShowIdle(e.target.checked)} />
          Hareketi ve stoğu olmayanları da göster
        </label>
        <ExportButton onExport={handleExport} disabled={rows.length === 0} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        {isEnabled && (
          <ListState
            isLoading={isLoading}
            error={error}
            isEmpty={rows.length === 0}
            emptyText="Gösterilecek boru tipi yok."
          />
        )}
        {!isLoading && !error && rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500">
                  <th className="px-3 py-2 text-left font-medium">Boru tipi</th>
                  <th className="px-3 py-2 text-right font-medium">Giren</th>
                  <th className="px-3 py-2 text-right font-medium">Dağıtılan</th>
                  <th className="px-3 py-2 text-right font-medium">İade</th>
                  <th className="px-3 py-2 text-right font-medium">Düzeltme</th>
                  <th className="px-3 py-2 text-right font-medium">Güncel stok</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.product_id}>
                    <td className="px-3 py-2">
                      <span className="font-medium">{r.product_name}</span>
                      {!r.is_active && <span className="ml-1 text-xs text-slate-400">(pasif)</span>}
                      <span className="block text-xs text-slate-500">{categoryLabels[r.category]}</span>
                    </td>
                    <Cell pieces={r.received_pieces} meters={r.received_meters} />
                    <Cell pieces={r.distributed_pieces} meters={r.distributed_meters} />
                    <Cell pieces={r.returned_pieces} meters={r.returned_meters} />
                    <Cell pieces={r.adjusted_pieces} meters={r.adjusted_meters} sign />
                    <Cell pieces={r.balance_pieces} meters={r.balance_meters} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="text-xs text-slate-500">
        “Güncel stok” sütunu seçilen dönemin sonundaki değil, şu andaki stoğu gösterir.
      </p>
    </div>
  )
}
