import { roleLabels, type UserRole } from '@/features/auth/roles'
import { categoryLabels, type PipeCategory } from '@/features/products/types'
import type { AuditEntry } from './api'

type Row = Record<string, unknown>

export const tableLabels: Record<string, string> = {
  products: 'Boru tipi',
  villages: 'Köy',
  profiles: 'Kullanıcı',
}

export const actionLabels: Record<string, string> = {
  INSERT: 'eklendi',
  UPDATE: 'değiştirildi',
  DELETE: 'silindi',
}

/** Kullanıcıya gösterilen alanlar ve Türkçe adları. Listede olmayan alanlar (id, tarih vb.) gösterilmez. */
const fieldLabels: Record<string, Record<string, string>> = {
  products: {
    category: 'Kategori',
    material: 'Malzeme',
    diameter_mm: 'Çap (mm)',
    pressure_class: 'Sınıf',
    standard_length_m: '1 adet boyu (m)',
    is_active: 'Durum',
  },
  villages: {
    name: 'Köy adı',
    district: 'İlçe',
    muhtar_name: 'Muhtar',
    note: 'Not',
    is_active: 'Durum',
  },
  profiles: {
    full_name: 'Ad Soyad',
    role: 'Rol',
    is_active: 'Durum',
  },
}

function asRow(value: unknown): Row | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Row) : null
}

function formatValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (field === 'is_active') return value ? 'Aktif' : 'Pasif'
  if (field === 'category') return categoryLabels[value as PipeCategory] ?? String(value)
  if (field === 'role') return roleLabels[value as UserRole] ?? String(value)
  return String(value)
}

/** Kaydın okunabilir adı: boru adı, köy adı veya kullanıcı adı. */
export function recordName(entry: AuditEntry): string {
  const row = asRow(entry.new_data) ?? asRow(entry.old_data) ?? {}
  if (entry.table_name === 'products') return String(row.name ?? '')
  if (entry.table_name === 'villages') return row.district ? `${row.name} (${row.district})` : String(row.name ?? '')
  if (entry.table_name === 'profiles') return String(row.full_name || 'Adı girilmemiş kullanıcı')
  return ''
}

export interface FieldChange {
  label: string
  from: string
  to: string
}

/** Güncellemede değişen alanlar (eski -> yeni). Ekleme/silmede boş döner. */
export function fieldChanges(entry: AuditEntry): FieldChange[] {
  const before = asRow(entry.old_data)
  const after = asRow(entry.new_data)
  if (!before || !after) return []

  const labels = fieldLabels[entry.table_name] ?? {}
  return Object.entries(labels)
    .filter(([field]) => JSON.stringify(before[field]) !== JSON.stringify(after[field]))
    .map(([field, label]) => ({
      label,
      from: formatValue(field, before[field]),
      to: formatValue(field, after[field]),
    }))
}
