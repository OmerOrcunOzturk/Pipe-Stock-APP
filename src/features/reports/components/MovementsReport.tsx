import { useMemo, useState } from 'react'
import { SelectInput } from '@/components/ui/Field'
import ListState from '@/components/ui/ListState'
import { docTypeLabels, formatDocNo, type StockDocType } from '@/features/stock/docTypes'
import { useVillages } from '@/features/villages/hooks'
import { villageDisplayName } from '@/features/villages/types'
import { formatDate, formatDateTime } from '@/utils/date'
import { exportTableToExcel } from '@/utils/excel'
import { formatNumber } from '@/utils/number'
import { MOVEMENT_ROW_LIMIT, type DateRange, type MovementDetail } from '../api'
import { useMovementDetails } from '../hooks'
import ExportButton from './ExportButton'

/** Ekranda gösterilen en fazla satır; Excel çıktısı tüm satırları içerir. */
const SCREEN_ROW_LIMIT = 300

const filterableTypes: StockDocType[] = ['giris', 'dagitim', 'iade', 'duzeltme']

const signed = (value: number) => `${value > 0 ? '+' : '−'}${formatNumber(Math.abs(value))}`

function counterparty(m: MovementDetail): string {
  if (m.village_name) return m.district ? `${m.village_name} (${m.district})` : m.village_name
  if (m.doc_type === 'giris') return m.supplier
  return m.note
}

function statusText(m: MovementDetail): string {
  if (m.doc_type === 'iptal') return 'İptal kaydı'
  return m.status === 'iptal_edildi' ? 'İptal edildi' : 'Aktif'
}

export default function MovementsReport({ range }: { range: DateRange }) {
  const { data: villages = [] } = useVillages()
  const [docType, setDocType] = useState<StockDocType | ''>('')
  const [villageId, setVillageId] = useState('')
  const [includeCancelled, setIncludeCancelled] = useState(false)

  const filters = useMemo(
    () => ({ ...range, docType, villageId, includeCancelled }),
    [range, docType, villageId, includeCancelled],
  )
  const { data: rows = [], isLoading, error, isEnabled } = useMovementDetails(filters)
  const visible = rows.slice(0, SCREEN_ROW_LIMIT)

  function handleExport() {
    return exportTableToExcel({
      fileName: `hareket-dokumu_${range.from}_${range.to}`,
      sheetName: 'Hareket Dökümü',
      title: 'Stok Hareket Dökümü',
      subtitles: [
        `Tarih aralığı: ${formatDate(range.from)} – ${formatDate(range.to)}`,
        `Tür: ${docType ? docTypeLabels[docType] : 'Tümü'} · İptaller: ${includeCancelled ? 'dahil' : 'hariç'}`,
      ],
      columns: [
        { header: 'Tarih', value: (m) => formatDate(m.doc_date), width: 12 },
        { header: 'Belge No', value: (m) => formatDocNo(m.doc_type, m.doc_no), width: 12 },
        { header: 'Tür', value: (m) => docTypeLabels[m.doc_type], width: 18 },
        { header: 'Durum', value: (m) => statusText(m), width: 14 },
        { header: 'İlçe', value: (m) => m.district ?? '', width: 16 },
        { header: 'Köy', value: (m) => m.village_name ?? '', width: 22 },
        { header: 'Tedarikçi', value: (m) => m.supplier, width: 22 },
        { header: 'Boru Tipi', value: (m) => m.product_name, width: 24 },
        { header: 'Adet', value: (m) => m.qty_pieces, format: 'int', total: true, width: 10 },
        { header: 'Metre', value: (m) => m.qty_meters, format: 'decimal', total: true, width: 12 },
        { header: 'İrsaliye No', value: (m) => m.waybill_no, width: 14 },
        { header: 'Plaka', value: (m) => m.vehicle_plate, width: 12 },
        { header: 'Teslim Alan', value: (m) => m.receiver_name, width: 18 },
        { header: 'Not', value: (m) => m.note, width: 30 },
        { header: 'Kaydeden', value: (m) => m.created_by_name ?? '', width: 18 },
        { header: 'Kayıt Zamanı', value: (m) => formatDateTime(m.created_at), width: 18 },
      ],
      rows,
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
        <SelectInput
          value={docType}
          onChange={(e) => setDocType(e.target.value as StockDocType | '')}
          className="mt-0 md:w-48"
          aria-label="İşlem türü"
        >
          <option value="">Tüm işlem türleri</option>
          {filterableTypes.map((t) => (
            <option key={t} value={t}>
              {docTypeLabels[t]}
            </option>
          ))}
        </SelectInput>
        <SelectInput
          value={villageId}
          onChange={(e) => setVillageId(e.target.value)}
          className="mt-0 md:w-56"
          aria-label="Köy"
        >
          <option value="">Tüm köyler</option>
          {villages.map((v) => (
            <option key={v.id} value={v.id}>
              {villageDisplayName(v)}
            </option>
          ))}
        </SelectInput>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={includeCancelled}
            onChange={(e) => setIncludeCancelled(e.target.checked)}
          />
          İptalleri de göster
        </label>
        <div className="md:ml-auto">
          <ExportButton onExport={handleExport} disabled={rows.length === 0} />
        </div>
      </div>

      {isEnabled && !isLoading && !error && rows.length > 0 && (
        <p className="text-sm text-slate-600">
          {formatNumber(rows.length)} hareket bulundu.
          {rows.length > SCREEN_ROW_LIMIT &&
            ` Ekranda ilk ${SCREEN_ROW_LIMIT} satır gösteriliyor; Excel çıktısı tamamını içerir.`}
          {rows.length >= MOVEMENT_ROW_LIMIT &&
            ` Dikkat: en fazla ${formatNumber(MOVEMENT_ROW_LIMIT)} satır okunur; tarih aralığını daraltın.`}
        </p>
      )}

      <div className="rounded-xl border border-slate-200 bg-white">
        {isEnabled && (
          <ListState
            isLoading={isLoading}
            error={error}
            isEmpty={rows.length === 0}
            emptyText="Bu filtrelere uyan hareket yok."
          />
        )}
        {!isLoading && !error && visible.length > 0 && (
          <ul className="divide-y divide-slate-100">
            {visible.map((m) => {
              const dimmed = m.status === 'iptal_edildi' || m.doc_type === 'iptal'
              return (
                <li
                  key={m.movement_id}
                  className={`flex flex-wrap items-start gap-x-4 gap-y-1 px-4 py-2.5 ${dimmed ? 'bg-slate-50 text-slate-400' : ''}`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      <span className="font-mono font-semibold">{formatDocNo(m.doc_type, m.doc_no)}</span>
                      <span className="ml-2">{docTypeLabels[m.doc_type]}</span>
                      <span className="ml-2 text-slate-500">{formatDate(m.doc_date)}</span>
                      {m.status === 'iptal_edildi' && (
                        <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                          İptal edildi
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-slate-600">
                      {m.product_name}
                      {counterparty(m) && ` · ${counterparty(m)}`}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    <span className={`font-semibold ${dimmed ? '' : m.qty_pieces > 0 ? 'text-green-700' : 'text-red-700'}`}>
                      {signed(m.qty_pieces)} adet
                    </span>
                    <span className="block text-xs text-slate-500">{signed(m.qty_meters)} m</span>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
