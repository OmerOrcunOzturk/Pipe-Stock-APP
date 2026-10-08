import { ArrowLeft, Plus } from 'lucide-react'
import { Link, useLocation } from 'react-router'
import PageHeader from '@/components/ui/PageHeader'
import { useIsAdmin } from '@/features/auth/authContext'
import DocumentList from '../components/DocumentList'
import { useDocuments } from '../hooks'

export default function AdjustmentsPage() {
  const isAdmin = useIsAdmin()
  const location = useLocation()
  const createdDocNo = (location.state as { createdDocNo?: string } | null)?.createdDocNo
  const { data: documents = [], isLoading, error } = useDocuments('duzeltme')

  return (
    <>
      <Link to="/stok" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="size-4" aria-hidden /> Stok listesi
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title="Sayım Düzeltmeleri"
          description="Fiili sayım ile sistemdeki stok arasındaki farkların kaydı. Son 50 belge."
        />
        {isAdmin && (
          <Link
            to="/stok/duzeltme/yeni"
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
          >
            <Plus className="size-4" aria-hidden /> Yeni düzeltme
          </Link>
        )}
      </div>

      {createdDocNo && (
        <p role="status" className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">
          <strong>{createdDocNo}</strong> numaralı sayım düzeltmesi kaydedildi.
        </p>
      )}

      <DocumentList
        documents={documents}
        isLoading={isLoading}
        error={error}
        emptyText="Henüz sayım düzeltmesi yapılmadı."
        renderInfo={() => <span className="text-slate-500">Sayım düzeltmesi</span>}
      />
    </>
  )
}
