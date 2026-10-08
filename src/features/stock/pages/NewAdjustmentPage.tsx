import PageHeader from '@/components/ui/PageHeader'
import { useIsAdmin } from '@/features/auth/authContext'
import AdjustmentForm from '../components/AdjustmentForm'

export default function NewAdjustmentPage() {
  const isAdmin = useIsAdmin()

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Yeni Sayım Düzeltmesi"
        description="Depoda saydığınız miktarı girin; sistemdeki stok bu miktara getirilir."
      />
      {isAdmin ? (
        <AdjustmentForm />
      ) : (
        <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          Sayım düzeltmesi sadece yönetici tarafından yapılabilir.
        </p>
      )}
    </div>
  )
}
