/**
 * Köye boru verilirken düzenlenen iki belgenin (Ambar Talep Formu ve Malzeme
 * Talep Fişi) kurumun kendi Excel şablonları üzerinde doldurulması.
 *
 * Şablonlar templates/ klasöründedir (kurumun kendi şablonları varsa
 * templates/ozel/ içindekiler kullanılır) ve olduğu gibi korunur: sadece aşağıda
 * tanımlı sayfalarda köy, tarih, muhtar ve boru satırları yazılır. Diğer
 * sayfalara ("ÖZ. İD." sayfaları dahil) dokunulmaz.
 *
 * Her sayfada form iki kez yer alır; alttaki kopya üsttekine formülle bağlıdır.
 */
import type { CellValue, Workbook, Worksheet } from 'exceljs'
import type { PipeCategory } from '@/features/products/types'

export interface TalepFormLine {
  category: PipeCategory
  material: string
  diameterMm: number
  /** PN10, PN12.5, SN8 ... */
  pressureClass: string
  standardLengthM: number
  pieces: number
  meters: number
}

export interface TalepFormData {
  /** YYYY-MM-DD */
  docDate: string
  village: { name: string; district: string; muhtarName: string }
  lines: TalepFormLine[]
}

export type TalepFormKind = 'ambar' | 'malzeme'

interface SheetLayout {
  sheetName: string
  category: PipeCategory
  /** Üst formdaki başlık ve imza hücreleri; muhtarNameMirror alt kopyadaki muhtar adıdır. */
  cells: { village?: string; date: string; muhtarName: string; muhtarNameMirror: string; muhtarTitle: string }
  /** Uzun unvan sığsın diye yazı boyutu hücreye göre küçültülecek hücreler. */
  shrinkToFit: string[]
  /** Üst formdaki ilk boru satırı, satır sayısı ve alt kopyadaki ilk satır. */
  firstRow: number
  rowCount: number
  mirrorFirstRow: number
  /** Boru satırının sütunları; toRow aynı sırada değer döndürür. */
  columns: string[]
  /** Alt kopyada boş satırlarda da formülü kalan sütunlar (hücre biçimi sıfırı gizler). */
  mirrorAlways: string[]
  /** Alt kopyada tam sayı biçimli miktar sütunu (ondalıklı metre yuvarlanmasın diye). */
  mirrorIntegerColumn?: string
  toRow: (line: TalepFormLine, no: number) => CellValue[]
}

const classNumber = (pressureClass: string) => pressureClass.replace(/^[A-Z]+/, '').replace('.', ',')

/** PE100 -> "PE 100" */
const spacedMaterial = (material: string) => material.replace(/^([A-Z]+)(\d+)$/, '$1 $2')

/** Sayının okunuşuna göre -lik eki: 150 lik, 200 lük, 90 lık, 160 lık, 110 luk. */
export function likSuffix(n: number): string {
  const ones = ['', 'lik', 'lik', 'lük', 'lük', 'lik', 'lık', 'lik', 'lik', 'luk']
  const tens = ['', 'luk', 'lik', 'luk', 'lık', 'lik', 'lık', 'lik', 'lik', 'lık']
  if (n % 10 !== 0) return ones[n % 10]
  if (n % 100 !== 0) return tens[(n % 100) / 10]
  if (n % 1000 !== 0) return 'lük'
  return n % 1_000_000 === 0 && n !== 0 ? 'luk' : 'lik'
}

const ambarSheet = {
  firstRow: 6,
  rowCount: 7,
  columns: ['A', 'B', 'E', 'F', 'H'],
  mirrorAlways: [],
}

const malzemeSheet = {
  cells: { village: 'C2', date: 'G2', muhtarName: 'A10', muhtarNameMirror: 'A23', muhtarTitle: 'A11' },
  shrinkToFit: [],
  firstRow: 4,
  rowCount: 5,
  mirrorFirstRow: 16,
  columns: ['A', 'B', 'E', 'G'],
  mirrorAlways: ['B', 'G'],
  mirrorIntegerColumn: 'G',
}

const layouts: Record<TalepFormKind, SheetLayout[]> = {
  ambar: [
    {
      ...ambarSheet,
      sheetName: 'Koruge',
      category: 'korige',
      cells: { date: 'H3', muhtarName: 'G17', muhtarNameMirror: 'G39', muhtarTitle: 'G18' },
      shrinkToFit: ['G18', 'G40'],
      mirrorFirstRow: 27,
      toRow: (l, no) => [
        no,
        `Ø ${l.diameterMm} mm SN ${classNumber(l.pressureClass)} Koruge Boru`,
        'mt.',
        l.meters,
        `${l.pieces} Adet`,
      ],
    },
    {
      ...ambarSheet,
      sheetName: 'Pe100',
      category: 'icme_suyu',
      cells: { date: 'H3', muhtarName: 'G17', muhtarNameMirror: 'G37', muhtarTitle: 'G18' },
      shrinkToFit: ['G18', 'G38'],
      mirrorFirstRow: 26,
      toRow: (l, no) => [
        no,
        `Ø ${l.diameterMm} / ${classNumber(l.pressureClass)} ${spacedMaterial(l.material)} Boru`,
        'mt.',
        l.meters,
        l.meters,
      ],
    },
  ],
  malzeme: [
    {
      ...malzemeSheet,
      sheetName: 'İÇMESUYU',
      category: 'icme_suyu',
      // Kangal: uzun (genelde 100 m) sarım; kısa boylar düz borudur.
      toRow: (l, no) => [
        no,
        `${l.diameterMm}/${classNumber(l.pressureClass)} atü ${l.standardLengthM >= 50 ? 'kangal boru' : 'boru'}`,
        'mt.',
        l.meters,
      ],
    },
    {
      ...malzemeSheet,
      sheetName: 'KORİGE BORU',
      category: 'korige',
      toRow: (l, no) => [
        no,
        `${l.diameterMm} ${likSuffix(l.diameterMm)} Korige boru ( SN ${classNumber(l.pressureClass)} )`,
        'Ad.',
        l.pieces,
      ],
    },
  ],
}

const formTitles: Record<TalepFormKind, string> = {
  ambar: 'Ambar Talep Formu',
  malzeme: 'Malzeme Talep Fişi',
}

function villageHeading(v: TalepFormData['village']): string {
  return [v.district, v.name].filter(Boolean).join(' ').toLocaleUpperCase('tr')
}

function muhtarTitle(v: TalepFormData['village']): string {
  const place = [v.district, v.name].filter(Boolean).join(' ')
  return /(köyü|mahallesi)$/i.test(v.name) ? `${place} Muhtarı` : `${place} Köyü Muhtarı`
}

/** YYYY-MM-DD -> Excel'in gün kaymadan okuyacağı tarih (ExcelJS tarihleri UTC yazar). */
function excelDate(isoDate: string): Date {
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

const isMergeSlave = (cell: { isMerged: boolean; master: { address: string }; address: string }) =>
  cell.isMerged && cell.master.address !== cell.address

/**
 * Paylaşımlı formülleri düz formüle çevirir. Aksi halde paylaşımın ana hücresine
 * değer yazıldığında ona bağlı hücreler bozulur.
 */
function unshareFormulas(sheet: Worksheet) {
  const formulas: [string, string][] = []
  sheet.eachRow((row) =>
    row.eachCell((cell) => {
      if (!isMergeSlave(cell) && cell.formula) formulas.push([cell.address, cell.formula])
    }),
  )
  for (const [address, formula] of formulas) sheet.getCell(address).value = { formula }
}

const SIMPLE_REF = /^\$?([A-Z]{1,3})\$?(\d+)$/

function resolveValue(sheet: Worksheet, address: string, depth = 0): CellValue {
  const value = sheet.getCell(address).value
  if (value && typeof value === 'object' && 'formula' in value) {
    const ref = SIMPLE_REF.exec(value.formula ?? '')
    return ref && depth < 20 ? resolveValue(sheet, ref[1] + ref[2], depth + 1) : null
  }
  if (value && typeof value === 'object' && 'richText' in value) {
    return value.richText.map((part) => part.text).join('')
  }
  return value
}

/**
 * Formül hücrelerinin kayıtlı sonuçlarını günceller. Excel dosyayı açarken
 * yeniden hesaplar; ama telefon önizlemesi gibi hesaplamayan görüntüleyiciler
 * kayıtlı sonucu gösterir. Şablondaki formüllerin hepsi tek hücre başvurusudur.
 */
function refreshFormulaResults(sheet: Worksheet) {
  sheet.eachRow((row) =>
    row.eachCell((cell) => {
      const value = cell.value
      if (isMergeSlave(cell) || !value || typeof value !== 'object' || !('formula' in value)) return
      const formula = value.formula ?? ''
      const ref = SIMPLE_REF.exec(formula)
      if (!ref) return
      const result = resolveValue(sheet, ref[1] + ref[2])
      const usable = typeof result === 'string' || typeof result === 'number' || result instanceof Date
      cell.value = usable && result !== '' ? { formula, result } : { formula }
    }),
  )
}

/** Sayfayı doldurur; bu kategoride boru varsa true döner. */
function fillSheet(sheet: Worksheet, layout: SheetLayout, data: TalepFormData): boolean {
  const lines = data.lines
    .filter((l) => l.category === layout.category)
    .sort((a, b) => a.diameterMm - b.diameterMm || a.pressureClass.localeCompare(b.pressureClass, 'tr'))
  if (lines.length > layout.rowCount) {
    throw new Error(
      `Şablonun "${layout.sheetName}" sayfasında ${layout.rowCount} satır var; bu dağıtımda ${lines.length} kalem bulunuyor.`,
    )
  }

  unshareFormulas(sheet)

  // Başlık ve imza her iki sayfada da güncellenir; boru olmayan sayfa boş form olarak kalır.
  const { cells } = layout
  if (cells.village) sheet.getCell(cells.village).value = villageHeading(data.village)
  sheet.getCell(cells.date).value = excelDate(data.docDate)
  sheet.getCell(cells.muhtarName).value = data.village.muhtarName || null
  // Muhtar adı boşsa düz başvuru (=G17) alt kopyada "0" gösterirdi.
  sheet.getCell(cells.muhtarNameMirror).value = {
    formula: `IF(${cells.muhtarName}="","",${cells.muhtarName})`,
    result: data.village.muhtarName,
  }
  sheet.getCell(cells.muhtarTitle).value = muhtarTitle(data.village)
  for (const address of layout.shrinkToFit) {
    const cell = sheet.getCell(address)
    // Biçim nesnesi aynı biçimli hücrelerle ortaktır; yerinde değiştirilmez, kopyası atanır.
    cell.style = { ...cell.style, alignment: { ...cell.alignment, wrapText: false, shrinkToFit: true } }
  }

  for (let i = 0; i < layout.rowCount; i++) {
    const values = i < lines.length ? layout.toRow(lines[i], i + 1) : null
    const row = layout.firstRow + i
    const mirrorRow = layout.mirrorFirstRow + i
    layout.columns.forEach((column, c) => {
      sheet.getCell(column + row).value = values ? values[c] : null
      const mirror = sheet.getCell(column + mirrorRow)
      mirror.value = values || layout.mirrorAlways.includes(column) ? { formula: column + row } : null
      const value = values?.[c]
      if (column === layout.mirrorIntegerColumn && typeof value === 'number' && !Number.isInteger(value)) {
        mirror.style = { ...mirror.style, numFmt: '0.##;-0.##;;@' }
      }
    })
  }

  refreshFormulaResults(sheet)
  return lines.length > 0
}

/** Şablon çalışma kitabını verilen dağıtımın bilgileriyle doldurur (yerinde değiştirir). */
export function fillTalepForm(workbook: Workbook, kind: TalepFormKind, data: TalepFormData): void {
  let firstFilled: Worksheet | undefined
  for (const layout of layouts[kind]) {
    const sheet = workbook.getWorksheet(layout.sheetName)
    if (!sheet) throw new Error(`Şablonda "${layout.sheetName}" sayfası bulunamadı.`)
    if (fillSheet(sheet, layout, data)) firstFilled ??= sheet
  }
  if (!firstFilled) throw new Error('Bu dağıtımda forma yazılacak boru yok.')

  // Dosya doldurulan sayfada açılsın. Birden çok sayfa seçili kalırsa Excel
  // "grup" kipinde açılır; bu yüzden diğer sayfaların seçimi kaldırılır.
  const activeTab = workbook.worksheets.indexOf(firstFilled)
  for (const sheet of workbook.worksheets) {
    sheet.views = sheet.views.map((view) => ({ ...view, tabSelected: sheet === firstFilled }))
  }
  workbook.views = workbook.views.map((view) => ({
    ...view,
    activeTab,
    firstSheet: Math.min(view.firstSheet ?? 0, activeTab),
  }))
  workbook.calcProperties = { ...workbook.calcProperties, fullCalcOnLoad: true }
}

/** "Ambar Talep Formu - Merkez Örnekköy - 02.10.2026.xlsx" */
export function talepFormFileName(kind: TalepFormKind, data: TalepFormData): string {
  const [y, m, d] = data.docDate.split('-')
  const place = [data.village.district, data.village.name].filter(Boolean).join(' ')
  return `${formTitles[kind]} - ${place} - ${d}.${m}.${y}.xlsx`.replace(/[\\/:*?"<>|]/g, ' ')
}
