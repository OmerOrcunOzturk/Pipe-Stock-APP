import { Plus } from 'lucide-react'
import { Link, useLocation } from 'react-router'
import PageHeader from '@/components/ui/PageHeader'
import DocumentList from '@/features/stock/components/DocumentList'
import { useDocuments } from '@/features/stock/hooks'
import { villageDisplayName } from '@/features/villages/types'
import TalepFormButtons from '../components/TalepFormButtons'

export default function DistributionsPage() {
  const location = useLocation()
  const createdDocNo = (location.state as { createdDocNo?: string } | null)?.createdDocNo
  const { data: documents = [], isLoading, error } = useDocuments('dagitim')

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title="Dağıtım"
          description="Köylere yapılan boru dağıtımları. Son 50 belge. Her dağıtımın talep formları Excel olarak indirilebilir."
        />
        <Link
          to="/dagitim/yeni"
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
        >
          <Plus className="size-4" aria-hidden /> Yeni dağıtım
        </Link>
      </div>

      {createdDocNo && (
        <p role="status" className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">
          <strong>{createdDocNo}</strong> numaralı dağıtım kaydedildi. Ambar Talep Formu ve Malzeme Talep Fişini
          aşağıdaki listeden indirebilirsiniz.
        </p>
      )}

      <DocumentList
        documents={documents}
        isLoading={isLoading}
        error={error}
        emptyText="Henüz dağıtım yapılmadı."
        renderActions={(doc) => <TalepFormButtons document={doc} />}
        renderInfo={(doc) => (
          <>
            <span className="font-medium">{doc.village ? villageDisplayName(doc.village) : '—'}</span>
            <span className="text-slate-500">
              {doc.receiver_name && ` · Teslim alan: ${doc.receiver_name}`}
              {doc.vehicle_plate && ` · ${doc.vehicle_plate}`}
              {doc.waybill_no && ` · İrsaliye: ${doc.waybill_no}`}
            </span>
          </>
        )}
      />
    </>
  )
}
