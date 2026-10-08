import { useState, type FormEvent } from 'react'
import Button from '@/components/ui/Button'
import { Field, TextArea } from '@/components/ui/Field'
import Modal from '@/components/ui/Modal'
import { formatDate } from '@/utils/date'
import type { StockDocumentListItem } from '../api'
import { docTypeLabels, formatDocNo } from '../docTypes'
import { useCancelDocument } from '../hooks'
import { useRequestKey } from '../useRequestKey'

interface CancelDocumentDialogProps {
  document: StockDocumentListItem
  onClose: () => void
}

export default function CancelDocumentDialog({ document: doc, onClose }: CancelDocumentDialogProps) {
  const cancel = useCancelDocument()
  const { getKey, renew } = useRequestKey()
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (cancel.isPending) return
    if (reason.trim() === '') {
      setError('İptal gerekçesi yazın.')
      return
    }
    setError(null)
    cancel.mutate(
      { clientRequestId: getKey(), documentId: doc.id, reason: reason.trim() },
      { onSuccess: onClose },
    )
  }

  return (
    <Modal title="Belgeyi iptal et" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <p className="text-sm text-slate-600">
          <strong>{formatDocNo(doc.doc_type, doc.doc_no)}</strong> numaralı {formatDate(doc.doc_date)} tarihli{' '}
          {docTypeLabels[doc.doc_type].toLocaleLowerCase('tr')} belgesi iptal edilecek. Belgenin stok etkisi
          tamamen geri alınır. Bu işlem geri alınamaz.
        </p>

        <Field label="İptal gerekçesi" error={error ?? undefined}>
          <TextArea
            value={reason}
            onChange={(e) => {
              renew()
              setReason(e.target.value)
            }}
            rows={3}
            maxLength={500}
            autoFocus
            disabled={cancel.isPending}
          />
        </Field>

        {cancel.error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {cancel.error.message}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={cancel.isPending}>
            Vazgeç
          </Button>
          <Button type="submit" variant="danger" disabled={cancel.isPending}>
            {cancel.isPending ? 'İptal ediliyor…' : 'Belgeyi iptal et'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
