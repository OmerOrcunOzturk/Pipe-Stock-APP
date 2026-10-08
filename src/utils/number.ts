/** "12,5" veya "12.5" gibi kullanıcı girişini sayıya çevirir; geçersizse NaN. */
export function parseDecimal(value: string): number {
  const normalized = value.trim().replace(',', '.')
  if (normalized === '' || !/^\d+(\.\d+)?$/.test(normalized)) return Number.NaN
  return Number(normalized)
}

const numberFormat = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 })

/** Türkçe sayı biçimi: 1.250,5 */
export function formatNumber(value: number): string {
  return numberFormat.format(value)
}
