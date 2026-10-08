import { toUserError } from '@/lib/dbErrors'
import { getSupabase } from '@/lib/supabase'
import { getDocumentNo } from '@/features/stock/api'
import type { LinePayload } from '@/features/stock/lines'

export interface DistributionInput {
  clientRequestId: string
  docDate: string
  villageId: string
  waybillNo: string
  vehiclePlate: string
  driverName: string
  receiverName: string
  note: string
  lines: LinePayload[]
}

/** Köye dağıtım kaydeder. Aynı clientRequestId ile tekrar çağrılırsa ilk belgeyi döndürür. */
export async function createDistribution(input: DistributionInput): Promise<{ id: string; docNo: number }> {
  const { data: id, error } = await getSupabase().rpc('create_distribution', {
    p_client_request_id: input.clientRequestId,
    p_doc_date: input.docDate,
    p_village_id: input.villageId,
    p_waybill_no: input.waybillNo,
    p_vehicle_plate: input.vehiclePlate,
    p_driver_name: input.driverName,
    p_receiver_name: input.receiverName,
    p_note: input.note,
    p_lines: input.lines,
  })
  if (error) throw toUserError(error)
  return { id, docNo: await getDocumentNo(id) }
}
