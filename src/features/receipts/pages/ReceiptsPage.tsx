import { Plus } from 'lucide-react'
import { Link, useLocation } from 'react-router'
import PageHeader from '@/components/ui/PageHeader'
import DocumentList from '@/features/stock/components/DocumentList'
import { useDocuments } from '@/features/stock/hooks'

export default function ReceiptsPage() {
  const location = useLocation()
  const createdDocNo = (location.state as { createdDocNo?: string } | null)?.createdDocNo
  const { data: documents = [], isLoading, error } = useDocuments('giris')

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader title="Stok Girişi" description="Şantiyeye gelen boruların kaydı. Son 50 belge." />
        <Link
          to="/giris/yeni"
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
        >
          <Plus className="size-4" aria-hidden /> Yeni giriş
        </Link>
      </div>

      {createdDocNo && (
        <p role="status" className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">
          <strong>{createdDocNo}</strong> numaralı giriş kaydedildi.
        </p>
      )}

      <DocumentList
        documents={documents}
        isLoading={isLoading}
        error={error}
        emptyText="Henüz stok girişi yapılmadı."
        renderInfo={(doc) => (
          <>
            {doc.supplier}
            {doc.waybill_no && <span className="text-slate-500"> · İrsaliye: {doc.waybill_no}</span>}
          </>
        )}
      />
    </>
  )
}
