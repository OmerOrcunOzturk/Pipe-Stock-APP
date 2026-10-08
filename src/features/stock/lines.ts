import type { Product } from '@/features/products/types'
import { newUuid } from '@/utils/uuid'
import { parseDecimal } from '@/utils/number'

/** Formdaki bir satırın düzenleme hâli (değerler metin olarak tutulur). */
export interface LineDraft {
  key: string
  productId: string
  pieces: string
  meters: string
  /** Kullanıcı metreyi elle değiştirdiyse otomatik hesaplama durur. */
  metersEdited: boolean
}

/** Veritabanı fonksiyonuna gönderilen satır (pozitif miktarlar). */
export type LinePayload = {
  product_id: string
  pieces: number
  meters: number
}

export function emptyLine(): LineDraft {
  return { key: newUuid(), productId: '', pieces: '', meters: '', metersEdited: false }
}

/** adet × standart boy; adet geçersizse boş. */
export function standardMeters(pieces: string, product: Product | undefined): string {
  const n = Number(pieces)
  if (!product || !Number.isInteger(n) || n <= 0) return ''
  return String(Math.round(n * product.standard_length_m * 100) / 100)
}

/** Çıkış (dağıtım) satırlarında stok kontrolü için bakiye. */
export interface BalanceLike {
  pieces: number
  meters: number
}

/** Satır, depodaki bu boru tipinin tamamını mı çıkarıyor? */
export function takesAllStock(pieces: string, balance: BalanceLike | undefined): boolean {
  return !!balance && balance.pieces > 0 && /^\d+$/.test(pieces.trim()) && Number(pieces) === balance.pieces
}

/**
 * Otomatik metre. Çıkışta (balance verilirse) depodaki son borular seçildiyse
 * depoda kalan metre; aksi halde adet × standart boy.
 */
export function autoMeters(pieces: string, product: Product | undefined, outgoingBalance?: BalanceLike): string {
  if (takesAllStock(pieces, outgoingBalance)) return String(outgoingBalance!.meters)
  return standardMeters(pieces, product)
}

export interface LineValidation {
  payload: LinePayload[] | null
  lineErrors: Record<string, string>
  formError: string | null
}

/**
 * Veritabanı fonksiyonundaki kurallarla aynı kontroller (erken geri bildirim için).
 * outgoingBalances verilirse satırlar çıkış sayılır ve stok yeterliliği de kontrol edilir.
 */
export function validateLines(
  lines: LineDraft[],
  productsById: Map<string, Product>,
  outgoingBalances?: Map<string, BalanceLike>,
): LineValidation {
  const lineErrors: Record<string, string> = {}
  const seen = new Set<string>()
  const payload: LinePayload[] = []

  if (lines.length === 0) return { payload: null, lineErrors, formError: 'En az bir satır ekleyin.' }
  if (lines.length > 100) return { payload: null, lineErrors, formError: 'Bir belgede en fazla 100 satır olabilir.' }

  for (const line of lines) {
    const product = productsById.get(line.productId)
    const pieces = Number(line.pieces)
    const balance = outgoingBalances?.get(line.productId)
    const takesAll = takesAllStock(line.pieces, balance)
    // Son borular çıkarken metre her zaman depoda kalan metredir.
    const meters = takesAll ? balance!.meters : parseDecimal(line.meters)

    if (!product) lineErrors[line.key] = 'Boru tipi seçin.'
    else if (seen.has(line.productId)) lineErrors[line.key] = 'Bu boru tipi başka bir satırda var.'
    else if (!/^\d+$/.test(line.pieces.trim()) || pieces < 1 || pieces > 999_999)
      lineErrors[line.key] = 'Adet 1 veya daha büyük tam sayı olmalı.'
    else if (outgoingBalances && pieces > (balance?.pieces ?? 0))
      lineErrors[line.key] = `Yetersiz stok: depoda ${balance?.pieces ?? 0} adet var.`
    else if (!(meters > 0)) lineErrors[line.key] = 'Metre 0’dan büyük olmalı.'
    else if (!takesAll && !/^\d+([.,]\d{1,2})?$/.test(line.meters.trim()))
      lineErrors[line.key] = 'Metre en fazla 2 ondalık olabilir.'
    else if (meters > pieces * 1000) lineErrors[line.key] = '1 adet en fazla 1000 m olabilir.'
    else if (outgoingBalances && !takesAll && meters >= (balance?.meters ?? 0))
      lineErrors[line.key] = `Metre hatalı: depoda ${balance?.meters ?? 0} m var; kalan borulara metre kalmıyor.`

    if (product) seen.add(line.productId)
    if (!lineErrors[line.key]) payload.push({ product_id: line.productId, pieces, meters })
  }

  const hasErrors = Object.keys(lineErrors).length > 0
  return { payload: hasErrors ? null : payload, lineErrors, formError: null }
}

export function sumLines(lines: LineDraft[]): { pieces: number; meters: number } {
  return lines.reduce(
    (acc, l) => {
      const p = Number(l.pieces)
      const m = parseDecimal(l.meters)
      return {
        pieces: acc.pieces + (Number.isInteger(p) && p > 0 ? p : 0),
        meters: acc.meters + (m > 0 ? m : 0),
      }
    },
    { pieces: 0, meters: 0 },
  )
}
