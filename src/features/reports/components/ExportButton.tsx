import { FileSpreadsheet } from 'lucide-react'
import { useState } from 'react'
import Button from '@/components/ui/Button'

interface ExportButtonProps {
  /** Excel dosyasını üretip indiren işlem. */
  onExport: () => Promise<void>
  disabled?: boolean
}

export default function ExportButton({ onExport, disabled }: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false)

  async function handleClick() {
    setIsExporting(true)
    try {
      await onExport()
    } catch (err) {
      alert(`Excel dosyası oluşturulamadı: ${err instanceof Error ? err.message : 'bilinmeyen hata'}`)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Button variant="secondary" onClick={handleClick} disabled={disabled || isExporting}>
      <FileSpreadsheet className="size-4" aria-hidden />
      {isExporting ? 'Hazırlanıyor…' : 'Excel’e aktar'}
    </Button>
  )
}
