import { useMemo } from 'react'
import ListState from '@/components/ui/ListState'
import { categoryLabels } from '@/features/products/types'
import { formatDate } from '@/utils/date'
import { exportTableToExcel } from '@/utils/excel'
import { formatNumber } from '@/utils/number'
import type { DateRange, VillageDistributionRow } from '../api'
import { useVillageDistribution } from '../hooks'
import ExportButton from './ExportButton'

interface VillageGroup {
  villageId: string
  title: string
  rows: VillageDistributionRow[]
  pieces: number
  meters: number
}

function groupByVillage(rows: VillageDistributionRow[]): VillageGroup[] {
  const groups = new Map<string, VillageGroup>()
  for (const row of rows) {
    let group = groups.get(row.village_id)
    if (!group) {
      group = {
        villageId: row.village_id,
        title: row.district ? `${row.village_name} (${row.district})` : row.village_name,
        rows: [],
        pieces: 0,
        meters: 0,
      }
      groups.set(row.village_id, group)
    }
    group.rows.push(row)
    group.pieces += row.pieces
    group.meters += row.meters
  }
  return [...groups.values()].sort((a, b) => a.title.localeCompare(b.title, 'tr'))
}

export default function VillageDistributionReport({ range }: { range: DateRange }) {
  const { data: rows = [], isLoading, error, isEnabled } = useVillageDistribution(range)
  const groups = useMemo(() => groupByVillage(rows), [rows])
  const totalPieces = groups.reduce((s, g) => s + g.pieces, 0)
  const totalMeters = groups.reduce((s, g) => s + g.meters, 0)

  function handleExport() {
    return exportTableToExcel({
      fileName: `koy-bazli-dagitim_${range.from}_${range.to}`,
      sheetName: 'Köy Bazlı Dağıtım',
      title: 'Köy Bazlı Boru Dağıtım Raporu',
      subtitles: [
        `Tarih aralığı: ${formatDate(range.from)} – ${formatDate(range.to)}`,
        'Net dağıtım (dağıtım − iade). İptal edilen belgeler dahil değildir.',
      ],
      columns: [
        { header: 'İlçe', value: (r) => r.district, width: 18 },
        { header: 'Köy', value: (r) => r.village_name, width: 24 },
        { header: 'Boru Tipi', value: (r) => r.product_name, width: 24 },
        { header: 'Kategori', value: (r) => categoryLabels[r.category], width: 14 },
        { header: 'Adet', value: (r) => r.pieces, format: 'int', total: true, width: 12 },
        { header: 'Metre', value: (r) => r.meters, format: 'decimal', total: true, width: 14 },
        { header: 'Belge Sayısı', value: (r) => r.document_count, format: 'int', width: 14 },
      ],
      rows: groups.flatMap((g) => g.rows),
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600">
          {isEnabled && !isLoading && !error && (
            <>
              {groups.length} köy · toplam <strong>{formatNumber(totalPieces)}</strong> adet /{' '}
              <strong>{formatNumber(totalMeters)}</strong> m
            </>
          )}
        </p>
        <ExportButton onExport={handleExport} disabled={rows.length === 0} />
      </div>

      {isEnabled && (
        <ListState
          isLoading={isLoading}
          error={error}
          isEmpty={groups.length === 0}
          emptyText="Bu tarih aralığında dağıtım yok."
        />
      )}

      {!isLoading &&
        !error &&
        groups.map((g) => (
          <div key={g.villageId} className="rounded-xl border border-slate-200 bg-white">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 px-4 py-2.5">
              <h3 className="font-medium">{g.title}</h3>
              <p className="text-sm font-medium">
                {formatNumber(g.pieces)} adet / {formatNumber(g.meters)} m
              </p>
            </div>
            <ul className="divide-y divide-slate-50 text-sm">
              {g.rows.map((r) => (
                <li key={r.product_id} className="flex flex-wrap justify-between gap-2 px-4 py-2">
                  <span>
                    {r.product_name}
                    <span className="ml-2 text-xs text-slate-400">{categoryLabels[r.category]}</span>
                  </span>
                  <span className="text-slate-600">
                    {formatNumber(r.pieces)} adet / {formatNumber(r.meters)} m
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
    </div>
  )
}
