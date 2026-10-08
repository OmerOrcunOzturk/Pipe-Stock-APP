import type { Tables } from '@/types/database.types'

export type Village = Tables<'villages'>

export interface VillageInput {
  name: string
  district: string
  muhtar_name: string
  note: string
}

/** Baş/son boşlukları siler, art arda boşlukları teke indirir (veritabanı kuralıyla uyumlu). */
export function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

export function villageDisplayName(v: Pick<Village, 'name' | 'district'>): string {
  return v.district ? `${v.name} (${v.district})` : v.name
}
