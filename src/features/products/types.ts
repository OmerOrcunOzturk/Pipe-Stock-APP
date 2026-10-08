import type { Tables } from '@/types/database.types'

export type Product = Tables<'products'>
export type PipeCategory = Product['category']

/** Formdan kaydedilebilen alanlar (id, tarih ve created_by veritabanında dolar). */
export interface ProductInput {
  category: PipeCategory
  material: string
  diameter_mm: number
  pressure_class: string
  standard_length_m: number
}

export const categoryLabels: Record<PipeCategory, string> = {
  icme_suyu: 'İçme Suyu',
  korige: 'Koruge',
}

/** Kategoriye göre formdaki varsayılanlar ve öneriler. */
export const categoryDefaults: Record<
  PipeCategory,
  { lengthM: number; material: string; classPrefix: string; classSuggestions: string[] }
> = {
  icme_suyu: {
    lengthM: 100,
    material: 'PE100',
    classPrefix: 'PN',
    classSuggestions: ['PN6', 'PN10', 'PN12.5', 'PN16', 'PN20', 'PN25'],
  },
  korige: {
    lengthM: 6,
    material: 'PE',
    classPrefix: 'SN',
    classSuggestions: ['SN2', 'SN4', 'SN8', 'SN16'],
  },
}

/** Veritabanındaki CHECK kısıtlarıyla aynı kurallar (kullanıcıya erken geri bildirim için). */
export const MATERIAL_PATTERN = /^[A-Z0-9][A-Z0-9 .-]{0,29}$/
export const CLASS_PATTERNS: Record<PipeCategory, RegExp> = {
  icme_suyu: /^PN[0-9]{1,3}(\.[0-9])?$/,
  korige: /^SN[0-9]{1,3}$/,
}

export function productDisplayName(p: Pick<Product, 'name' | 'diameter_mm' | 'material' | 'pressure_class'>) {
  return p.name ?? `Ø${p.diameter_mm} ${p.material} ${p.pressure_class}`
}
