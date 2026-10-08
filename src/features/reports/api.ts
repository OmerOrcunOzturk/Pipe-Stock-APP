import { toUserError } from '@/lib/dbErrors'
import { getSupabase } from '@/lib/supabase'
import type { PipeCategory } from '@/features/products/types'
import type { StockDocStatus, StockDocType } from '@/features/stock/docTypes'

export interface DateRange {
  from: string
  to: string
}

/** Köy × boru tipi net dağıtım (dağıtım − iade; iptaller hariç). */
export async function fetchVillageDistribution(range: DateRange) {
  const { data, error } = await getSupabase().rpc('report_village_distribution', {
    p_from: range.from,
    p_to: range.to,
  })
  if (error) throw toUserError(error)
  return data
}
export type VillageDistributionRow = Awaited<ReturnType<typeof fetchVillageDistribution>>[number]

/** Boru tipi başına dönem hareketleri ve güncel stok. */
export async function fetchProductSummary(range: DateRange) {
  const { data, error } = await getSupabase().rpc('report_product_summary', {
    p_from: range.from,
    p_to: range.to,
  })
  if (error) throw toUserError(error)
  return data
}
export type ProductSummaryRow = Awaited<ReturnType<typeof fetchProductSummary>>[number]

export interface MovementFilters extends DateRange {
  docType: StockDocType | ''
  villageId: string
  /** İptal edilmiş belgeler ve iptal kayıtları da gelsin mi? */
  includeCancelled: boolean
}

export interface MovementDetail {
  movement_id: number
  doc_no: number
  doc_type: StockDocType
  doc_date: string
  status: StockDocStatus
  village_name: string | null
  district: string | null
  supplier: string
  waybill_no: string
  vehicle_plate: string
  receiver_name: string
  note: string
  product_name: string
  category: PipeCategory
  qty_pieces: number
  qty_meters: number
  created_by_name: string | null
  created_at: string
}

const PAGE_SIZE = 1000
/** Güvenlik sınırı: tek raporda en fazla bu kadar satır çekilir. */
export const MOVEMENT_ROW_LIMIT = 20_000

const movementColumns =
  'movement_id, doc_no, doc_type, doc_date, status, village_name, district, supplier, waybill_no, vehicle_plate, receiver_name, note, product_name, category, qty_pieces, qty_meters, created_by_name, created_at'

/**
 * Hareket dökümü. Sunucu sorgu başına en fazla 1000 satır döndürdüğü için
 * sayfa sayfa okunur; böylece liste eksik kalmaz.
 */
export async function fetchMovementDetails(filters: MovementFilters): Promise<MovementDetail[]> {
  const all: MovementDetail[] = []

  for (let offset = 0; offset < MOVEMENT_ROW_LIMIT; offset += PAGE_SIZE) {
    let query = getSupabase()
      .from('v_movement_details')
      .select(movementColumns)
      .gte('doc_date', filters.from)
      .lte('doc_date', filters.to)

    if (filters.docType) query = query.eq('doc_type', filters.docType)
    if (filters.villageId) query = query.eq('village_id', filters.villageId)
    if (!filters.includeCancelled) query = query.eq('status', 'aktif').neq('doc_type', 'iptal')

    const { data, error } = await query
      .order('doc_date', { ascending: false })
      .order('movement_id', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)
    if (error) throw toUserError(error)

    // Görünümün sütunları tip üretiminde "boş olabilir" görünür; bu alanlar
    // kaynak tablolarda NOT NULL olduğu için güvenle daraltılır.
    all.push(...(data as unknown as MovementDetail[]))
    if (data.length < PAGE_SIZE) break
  }

  return all
}
