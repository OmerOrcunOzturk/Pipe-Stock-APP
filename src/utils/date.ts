const isoDateTr = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Istanbul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** Türkiye saatine göre bugünün tarihi, YYYY-MM-DD (veritabanındaki today_tr ile aynı). */
export function todayTr(): string {
  return isoDateTr.format(new Date())
}

/** YYYY-MM-DD -> GG.AA.YYYY */
export function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.slice(0, 10).split('-')
  return `${d}.${m}.${y}`
}

const dateTimeTr = new Intl.DateTimeFormat('tr-TR', {
  timeZone: 'Europe/Istanbul',
  dateStyle: 'short',
  timeStyle: 'short',
})

/** Zaman damgası -> GG.AA.YYYY SS:DD (Türkiye saati) */
export function formatDateTime(timestamp: string): string {
  return dateTimeTr.format(new Date(timestamp))
}

/** Türkiye saatine göre içinde bulunulan ayın ilk günü, YYYY-MM-DD. */
export function startOfMonthTr(): string {
  return `${todayTr().slice(0, 8)}01`
}

/** Türkiye saatine göre içinde bulunulan yılın ilk günü, YYYY-MM-DD. */
export function startOfYearTr(): string {
  return `${todayTr().slice(0, 4)}-01-01`
}

/** Geçen ayın ilk ve son günü, YYYY-MM-DD. */
export function lastMonthRangeTr(): { from: string; to: string } {
  const [y, m] = todayTr().split('-').map(Number)
  const year = m === 1 ? y - 1 : y
  const month = m === 1 ? 12 : m - 1
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const mm = String(month).padStart(2, '0')
  return { from: `${year}-${mm}-01`, to: `${year}-${mm}-${String(lastDay).padStart(2, '0')}` }
}
