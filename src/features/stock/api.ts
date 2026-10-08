import { toUserError } from '@/lib/dbErrors'
import { getSupabase } from '@/lib/supabase'
import type { StockDocType } from './docTypes'
import type { LinePayload } from './lines'

export interface StockBalance {
  product_id: string
  pieces: number
  meters: number
}

export async function listBalances(): Promise<StockBalance[]> {
  const { data, error } = await getSupabase()
    .from('stock_balances')
    .select('product_id, pieces, meters')
  if (error) throw toUserError(error)
  return data
}

const documentSelect = `
  id, doc_no, doc_type, doc_date, status, supplier, waybill_no, vehicle_plate,
  driver_name, receiver_name, note, created_at,
  village:villages ( id, name, district, muhtar_name ),
  creator:profiles!stock_documents_created_by_fkey ( full_name ),
  lines:stock_movements (
    id, product_id, qty_pieces, qty_meters,
    product:products ( name, category, material, diameter_mm, pressure_class, standard_length_m )
  )
` as const

export async function listDocuments(type: StockDocType, limit = 50) {
  const { data, error } = await getSupabase()
    .from('stock_documents')
    .select(documentSelect)
    .eq('doc_type', type)
    .order('doc_date', { ascending: false })
    .order('doc_no', { ascending: false })
    .limit(limit)
  if (error) throw toUserError(error)
  return data
}

/** Tür ayırmadan en son kaydedilen belgeler (panel için). */
export async function listRecentDocuments(limit = 8) {
  const { data, error } = await getSupabase()
    .from('stock_documents')
    .select(documentSelect)
    .order('doc_no', { ascending: false })
    .limit(limit)
  if (error) throw toUserError(error)
  return data
}

const movementSelect = `
  id, qty_pieces, qty_meters, created_at,
  document:stock_documents!inner (
    id, doc_no, doc_type, doc_date, status, supplier, note,
    village:villages ( name, district ),
    creator:profiles!stock_documents_created_by_fkey ( full_name )
  )
` as const

/** Bir boru tipinin hareketleri, en yeni kayıt en üstte (kayıt sırasıyla). */
export async function listMovements(productId: string, limit = 200) {
  const { data, error } = await getSupabase()
    .from('stock_movements')
    .select(movementSelect)
    .eq('product_id', productId)
    .order('id', { ascending: false })
    .limit(limit)
  if (error) throw toUserError(error)
  return data
}

export type StockMovementListItem = Awaited<ReturnType<typeof listMovements>>[number]

export type StockDocumentListItem = Awaited<ReturnType<typeof listDocuments>>[number]

export async function getDocumentNo(id: string): Promise<number> {
  const { data, error } = await getSupabase()
    .from('stock_documents')
    .select('doc_no')
    .eq('id', id)
    .single()
  if (error) throw toUserError(error)
  return data.doc_no
}

export interface CancelDocumentInput {
  clientRequestId: string
  documentId: string
  reason: string
}

/**
 * Belgeyi ters kayıtla iptal eder (sadece admin). Belge silinmez; durumu
 * "iptal edildi" olur ve stok etkisi geri alınır.
 */
export async function cancelDocument(input: CancelDocumentInput): Promise<void> {
  const { error } = await getSupabase().rpc('cancel_document', {
    p_client_request_id: input.clientRequestId,
    p_document_id: input.documentId,
    p_reason: input.reason,
  })
  if (error) throw toUserError(error)
}

export interface AdjustmentInput {
  clientRequestId: string
  docDate: string
  note: string
  /** İşaretli satırlar: + sayımda fazla, - sayımda eksik. */
  lines: LinePayload[]
}

/** Sayım düzeltmesi kaydeder (sadece admin). */
export async function createAdjustment(input: AdjustmentInput): Promise<{ id: string; docNo: number }> {
  const { data: id, error } = await getSupabase().rpc('create_adjustment', {
    p_client_request_id: input.clientRequestId,
    p_doc_date: input.docDate,
    p_note: input.note,
    p_lines: input.lines,
  })
  if (error) throw toUserError(error)
  return { id, docNo: await getDocumentNo(id) }
}
