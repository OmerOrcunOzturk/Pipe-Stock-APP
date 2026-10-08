import type { Database } from '@/types/database.types'

export type StockDocType = Database['public']['Enums']['stock_doc_type']
export type StockDocStatus = Database['public']['Enums']['stock_doc_status']

export const docTypeLabels: Record<StockDocType, string> = {
  giris: 'Giriş',
  dagitim: 'Dağıtım',
  iade: 'İade',
  duzeltme: 'Sayım Düzeltmesi',
  iptal: 'İptal',
}

const docTypePrefixes: Record<StockDocType, string> = {
  giris: 'G',
  dagitim: 'D',
  iade: 'İ',
  duzeltme: 'S',
  iptal: 'X',
}

/** Belge numarasını ekranda gösterim biçimi: G-000123 */
export function formatDocNo(type: StockDocType, docNo: number): string {
  return `${docTypePrefixes[type]}-${String(docNo).padStart(6, '0')}`
}
