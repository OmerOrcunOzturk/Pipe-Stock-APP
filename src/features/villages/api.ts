import { toUserError } from '@/lib/dbErrors'
import { getSupabase } from '@/lib/supabase'
import type { Village, VillageInput } from './types'

const errorMessages = {
  '23505': 'Bu ilçede aynı isimde bir köy zaten tanımlı.',
  PGRST116: 'Kayıt bulunamadı veya bu işlem için yetkiniz yok.',
  '23503': 'Bu köye ait stok belgesi var; silinemez. Bunun yerine pasife alabilirsiniz.',
}

const byTurkishName = (a: Village, b: Village) =>
  a.district.localeCompare(b.district, 'tr') || a.name.localeCompare(b.name, 'tr')

export async function listVillages(): Promise<Village[]> {
  const { data, error } = await getSupabase().from('villages').select('*')
  if (error) throw toUserError(error)
  // Türkçe alfabetik sıralama (ç, ğ, ı, ö, ş, ü) istemcide yapılır.
  return data.sort(byTurkishName)
}

export async function createVillage(input: VillageInput): Promise<Village> {
  const { data, error } = await getSupabase().from('villages').insert(input).select().single()
  if (error) throw toUserError(error, errorMessages)
  return data
}

export async function updateVillage(
  id: string,
  changes: Partial<VillageInput> & { is_active?: boolean },
): Promise<Village> {
  const { data, error } = await getSupabase()
    .from('villages')
    .update(changes)
    .eq('id', id)
    .select()
    .single()
  if (error) throw toUserError(error, errorMessages)
  return data
}

/** Hiç belgesi olmayan köyü kalıcı olarak siler (sadece admin). */
export async function deleteVillage(id: string): Promise<void> {
  const { data, error } = await getSupabase().from('villages').delete().eq('id', id).select('id')
  if (error) throw toUserError(error, errorMessages)
  // RLS silmeye izin vermediyse hata dönmez, sadece hiçbir satır silinmez.
  if (data.length === 0) throw new Error(errorMessages.PGRST116)
}
