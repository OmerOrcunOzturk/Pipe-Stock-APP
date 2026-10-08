import { toUserError } from '@/lib/dbErrors'
import { getSupabase } from '@/lib/supabase'
import { getDocumentNo } from '@/features/stock/api'
import type { LinePayload } from '@/features/stock/lines'

export interface ReceiptInput {
  clientRequestId: string
  docDate: string
  supplier: string
  waybillNo: string
  note: string
  lines: LinePayload[]
}

/** Stok girişi kaydeder. Aynı clientRequestId ile tekrar çağrılırsa ilk belgeyi döndürür. */
export async function createReceipt(input: ReceiptInput): Promise<{ id: string; docNo: number }> {
  const { data: id, error } = await getSupabase().rpc('create_receipt', {
    p_client_request_id: input.clientRequestId,
    p_doc_date: input.docDate,
    p_supplier: input.supplier,
    p_waybill_no: input.waybillNo,
    p_note: input.note,
    p_lines: input.lines,
  })
  if (error) throw toUserError(error)
  return { id, docNo: await getDocumentNo(id) }
}
