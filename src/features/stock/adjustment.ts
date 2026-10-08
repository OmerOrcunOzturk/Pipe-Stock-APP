import type { Product } from '@/features/products/types'
import { parseDecimal } from '@/utils/number'
import { newUuid } from '@/utils/uuid'
import type { BalanceLike, LinePayload } from './lines'

/** Sayım düzeltmesi formundaki bir satır: kullanıcı SAYILAN miktarı girer. */
export interface CountLineDraft {
  key: string
  productId: string
  countedPieces: string
  countedMeters: string
  /** Kullanıcı sayılan metreyi elle değiştirdiyse otomatik hesaplama durur. */
  metersEdited: boolean
}

export function emptyCountLine(): CountLineDraft {
  return { key: newUuid(), productId: '', countedPieces: '', countedMeters: '', metersEdited: false }
}

const round2 = (n: number) => Math.round(n * 100) / 100
const isWholeNumber = (s: string) => /^\d+$/.test(s.trim())

/**
 * Sayılan adede göre beklenen metre: adet değişmediyse mevcut metre; değiştiyse
 * fark kadar standart boy eklenir/çıkarılır.
 */
export function autoCountedMeters(
  countedPieces: string,
  product: Product | undefined,
  balance: BalanceLike | undefined,
): string {
  if (!product || !isWholeNumber(countedPieces)) return ''
  const counted = Number(countedPieces)
  const current = balance ?? { pieces: 0, meters: 0 }
  if (counted === 0) return '0'
  if (counted === current.pieces) return String(current.meters)
  const estimate = round2(current.meters + (counted - current.pieces) * product.standard_length_m)
  // Tahmin anlamsız çıkarsa (ör. standart dışı boylar) sayılan adet × standart boy.
  return String(estimate > 0 ? estimate : round2(counted * product.standard_length_m))
}

export interface CountLineDiff {
  pieces: number
  meters: number
}

/** Satırın farkı (sayılan − sistemdeki); girişler eksik/geçersizse null. */
export function countLineDiff(line: CountLineDraft, balance: BalanceLike | undefined): CountLineDiff | null {
  if (!line.productId || !isWholeNumber(line.countedPieces)) return null
  const current = balance ?? { pieces: 0, meters: 0 }
  const counted = Number(line.countedPieces)
  const countedMeters = counted === 0 ? 0 : parseDecimal(line.countedMeters)
  if (Number.isNaN(countedMeters)) return null
  return { pieces: counted - current.pieces, meters: round2(countedMeters - current.meters) }
}

export interface CountValidation {
  payload: LinePayload[] | null
  lineErrors: Record<string, string>
  formError: string | null
}

/** create_adjustment fonksiyonunun kurallarıyla aynı kontroller. */
export function validateCountLines(
  lines: CountLineDraft[],
  productsById: Map<string, Product>,
  balances: Map<string, BalanceLike>,
): CountValidation {
  const lineErrors: Record<string, string> = {}
  const seen = new Set<string>()
  const payload: LinePayload[] = []

  if (lines.length === 0) return { payload: null, lineErrors, formError: 'En az bir satır ekleyin.' }
  if (lines.length > 100) return { payload: null, lineErrors, formError: 'Bir belgede en fazla 100 satır olabilir.' }

  for (const line of lines) {
    const product = productsById.get(line.productId)
    const diff = countLineDiff(line, balances.get(line.productId))
    const counted = Number(line.countedPieces)

    if (!product) lineErrors[line.key] = 'Boru tipi seçin.'
    else if (seen.has(line.productId)) lineErrors[line.key] = 'Bu boru tipi başka bir satırda var.'
    else if (!isWholeNumber(line.countedPieces) || counted > 999_999)
      lineErrors[line.key] = 'Sayılan adet 0 veya daha büyük tam sayı olmalı.'
    else if (counted > 0 && !/^\d+([.,]\d{1,2})?$/.test(line.countedMeters.trim()))
      lineErrors[line.key] = 'Sayılan metre sayı olmalı (en fazla 2 ondalık).'
    else if (!diff) lineErrors[line.key] = 'Girilen değerler geçersiz.'
    else if (diff.pieces === 0)
      lineErrors[line.key] = 'Sayılan adet sistemdekiyle aynı; bu boru için düzeltme gerekmiyor.'
    else if (counted > 0 && parseDecimal(line.countedMeters) <= 0)
      lineErrors[line.key] = 'Sayılan metre 0’dan büyük olmalı.'
    else if (Math.sign(diff.meters) !== Math.sign(diff.pieces))
      lineErrors[line.key] =
        diff.pieces > 0
          ? 'Adet arttığına göre sayılan metre de sistemdekinden fazla olmalı.'
          : 'Adet azaldığına göre sayılan metre de sistemdekinden az olmalı.'
    else if (Math.abs(diff.meters) > Math.abs(diff.pieces) * 1000)
      lineErrors[line.key] = 'Metre farkı çok büyük (1 adet en fazla 1000 m).'

    if (product) seen.add(line.productId)
    if (!lineErrors[line.key] && diff)
      payload.push({ product_id: line.productId, pieces: diff.pieces, meters: diff.meters })
  }

  const hasErrors = Object.keys(lineErrors).length > 0
  return { payload: hasErrors ? null : payload, lineErrors, formError: null }
}
