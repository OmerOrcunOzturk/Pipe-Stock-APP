/**
 * Excel (.xlsx) dışa aktarma. ExcelJS büyük bir kütüphane olduğu için sadece
 * aktarım anında yüklenir (dinamik import); uygulamanın açılışını yavaşlatmaz.
 *
 * Hazır bir Excel şablonunu doldurarak çıktı almak için exportFromTemplate
 * kullanılır (şablon açılır, hücreler yazılır, biçim ve diğer sayfalar korunur).
 */
import type { Workbook } from 'exceljs'

export type ExcelCell = string | number | null

export interface ExcelColumn<Row> {
  header: string
  /** Hücre değeri. */
  value: (row: Row) => ExcelCell
  width?: number
  /** Sayı biçimi: 'int' = 1.234, 'decimal' = 1.234,50 */
  format?: 'int' | 'decimal'
  /** Toplam satırında bu sütun toplansın mı? */
  total?: boolean
}

export interface ExcelTableOptions<Row> {
  fileName: string
  sheetName: string
  title: string
  /** Başlığın altındaki açıklama satırları (tarih aralığı, filtreler vb.). */
  subtitles?: string[]
  columns: ExcelColumn<Row>[]
  rows: Row[]
}

const numberFormats = { int: '#,##0', decimal: '#,##0.00' } as const
const xlsxMimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
/** ExcelJS'in, dosyada yazmayan yazıcı çözünürlüğü için kullandığı yer tutucu. */
const UNSET_DPI = 4294967295

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

/** Başlık + tablo + toplam satırı içeren tek sayfalı bir Excel dosyası indirir. */
export async function exportTableToExcel<Row>(options: ExcelTableOptions<Row>): Promise<void> {
  const { default: ExcelJS } = await import('exceljs')
  const { columns, rows } = options

  const workbook = new ExcelJS.Workbook()
  workbook.created = new Date()
  const sheet = workbook.addWorksheet(options.sheetName.slice(0, 31))

  sheet.addRow([options.title]).font = { bold: true, size: 14 }
  for (const line of options.subtitles ?? []) {
    sheet.addRow([line]).font = { color: { argb: 'FF64748B' } }
  }
  sheet.addRow([])

  const headerRow = sheet.addRow(columns.map((c) => c.header))
  headerRow.eachCell((cell) => {
    cell.font = { bold: true }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } }
    cell.border = { bottom: { style: 'thin' } }
  })
  sheet.views = [{ state: 'frozen', ySplit: headerRow.number }]

  for (const row of rows) {
    sheet.addRow(columns.map((c) => c.value(row)))
  }

  if (columns.some((c) => c.total) && rows.length > 0) {
    const totals = columns.map((c, i) => {
      if (c.total) {
        const sum = rows.reduce((acc, row) => acc + (Number(c.value(row)) || 0), 0)
        return Math.round(sum * 100) / 100
      }
      return i === 0 ? 'TOPLAM' : null
    })
    const totalRow = sheet.addRow(totals)
    totalRow.font = { bold: true }
    totalRow.eachCell((cell) => {
      cell.border = { top: { style: 'thin' } }
    })
  }

  columns.forEach((c, i) => {
    const column = sheet.getColumn(i + 1)
    column.width = c.width ?? 16
    if (c.format) column.numFmt = numberFormats[c.format]
  })

  const buffer = await workbook.xlsx.writeBuffer()
  downloadBlob(
    new Blob([buffer], { type: xlsxMimeType }),
    options.fileName.endsWith('.xlsx') ? options.fileName : `${options.fileName}.xlsx`,
  )
}

/**
 * Hazır bir Excel şablonunu indirir, fill ile doldurur ve sonucu kullanıcıya
 * indirtir. fill hata fırlatırsa dosya indirilmez.
 */
export async function exportFromTemplate(
  templateUrl: string,
  fileName: string,
  fill: (workbook: Workbook) => void,
): Promise<void> {
  const [{ default: ExcelJS }, response] = await Promise.all([import('exceljs'), fetch(templateUrl)])
  if (!response.ok) throw new Error('Excel şablonu yüklenemedi.')

  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(await response.arrayBuffer())
  // ExcelJS şablonda bulunmayan yazdırma ayarlarını varsayılan değerlerle doldurup
  // dosyaya yazar; bunlar temizlenir ki sayfaların yazdırma düzeni aynı kalsın.
  for (const sheet of workbook.worksheets) {
    const setup = sheet.pageSetup
    if (setup.firstPageNumber === 1) setup.firstPageNumber = undefined
    if (setup.horizontalDpi === UNSET_DPI) setup.horizontalDpi = undefined
    if (setup.verticalDpi === UNSET_DPI) setup.verticalDpi = undefined
  }
  fill(workbook)

  const buffer = await workbook.xlsx.writeBuffer()
  downloadBlob(new Blob([buffer], { type: xlsxMimeType }), fileName)
}
