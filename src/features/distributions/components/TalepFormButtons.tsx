import { FileSpreadsheet } from 'lucide-react'
import { useState } from 'react'
import Button from '@/components/ui/Button'
import type { StockDocumentListItem } from '@/features/stock/api'
import { exportFromTemplate } from '@/utils/excel'
import { fillTalepForm, talepFormFileName, type TalepFormData, type TalepFormKind } from '../talepForms'

// templates/ içindeki şablonlar örnektir (imza adları yer tutucudur). Kurumun
// kendi şablonları templates/ozel/ klasörüne aynı adla konur; varsa onlar
// kullanılır. ozel/ klasörü depoya girmez.
const templateUrls = import.meta.glob<string>('../templates/**/*.xlsx', {
  query: '?url',
  import: 'default',
  eager: true,
})
const templateUrl = (file: string) => templateUrls[`../templates/ozel/${file}`] ?? templateUrls[`../templates/${file}`]

const forms: { kind: TalepFormKind; label: string; templateUrl: string }[] = [
  { kind: 'ambar', label: 'Ambar Talep', templateUrl: templateUrl('ambar-talep-formu.xlsx') },
  { kind: 'malzeme', label: 'Malzeme Talep', templateUrl: templateUrl('malzeme-talep.xlsx') },
]

function toFormData(doc: StockDocumentListItem): TalepFormData {
  if (!doc.village) throw new Error('Belgenin köyü yok.')
  return {
    docDate: doc.doc_date,
    village: {
      name: doc.village.name,
      district: doc.village.district,
      muhtarName: doc.village.muhtar_name,
    },
    // Dağıtım hareketleri eksi kaydedilir; forma pozitif miktar yazılır.
    lines: doc.lines.flatMap((l) =>
      l.product
        ? [
            {
              category: l.product.category,
              material: l.product.material,
              diameterMm: l.product.diameter_mm,
              pressureClass: l.product.pressure_class,
              standardLengthM: l.product.standard_length_m,
              pieces: Math.abs(l.qty_pieces),
              meters: Math.abs(l.qty_meters),
            },
          ]
        : [],
    ),
  }
}

/** Dağıtım belgesinden Ambar Talep Formu ve Malzeme Talep Fişini Excel olarak indirir. */
export default function TalepFormButtons({ document }: { document: StockDocumentListItem }) {
  const [exporting, setExporting] = useState<TalepFormKind | null>(null)

  async function handleClick(kind: TalepFormKind, templateUrl: string) {
    setExporting(kind)
    try {
      const data = toFormData(document)
      await exportFromTemplate(templateUrl, talepFormFileName(kind, data), (workbook) =>
        fillTalepForm(workbook, kind, data),
      )
    } catch (err) {
      alert(`Excel dosyası oluşturulamadı: ${err instanceof Error ? err.message : 'bilinmeyen hata'}`)
    } finally {
      setExporting(null)
    }
  }

  return (
    <>
      {forms.map(({ kind, label, templateUrl }) => (
        <Button
          key={kind}
          variant="ghost"
          size="sm"
          onClick={() => handleClick(kind, templateUrl)}
          disabled={exporting !== null}
        >
          <FileSpreadsheet className="size-4" aria-hidden />
          {exporting === kind ? 'Hazırlanıyor…' : label}
        </Button>
      ))}
    </>
  )
}
