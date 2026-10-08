import { ArrowDownToLine, Truck } from 'lucide-react'
import { Link } from 'react-router'
import PageHeader from '@/components/ui/PageHeader'
import { useAuth } from '@/features/auth/authContext'
import { roleLabels } from '@/features/auth/roles'
import { useProducts } from '@/features/products/hooks'
import DocumentList from '@/features/stock/components/DocumentList'
import StockSummary from '@/features/stock/components/StockSummary'
import { docTypeLabels } from '@/features/stock/docTypes'
import { useBalanceMap, useRecentDocuments } from '@/features/stock/hooks'
import { villageDisplayName } from '@/features/villages/types'

export default function DashboardPage() {
  const { profile, session } = useAuth()
  const { data: products = [], isLoading: productsLoading } = useProducts()
  const { map: balances, isLoading: balancesLoading } = useBalanceMap()
  const recent = useRecentDocuments()

  const canWrite = profile?.role === 'admin' || profile?.role === 'depo'

  return (
    <>
      <PageHeader
        title="Panel"
        description={`${profile?.full_name || session?.user.email || ''}${profile ? ` · ${roleLabels[profile.role]}` : ''}`}
      />

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Depodaki toplam stok</h2>
        {productsLoading || balancesLoading ? (
          <p className="text-sm text-slate-500">Yükleniyor…</p>
        ) : (
          <StockSummary products={products} balances={balances} />
        )}
      </section>

      {canWrite && (
        <section className="mb-6 flex flex-wrap gap-2">
          <Link
            to="/giris/yeni"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <ArrowDownToLine className="size-4" aria-hidden /> Yeni giriş
          </Link>
          <Link
            to="/dagitim/yeni"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
          >
            <Truck className="size-4" aria-hidden /> Yeni dağıtım
          </Link>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Son işlemler</h2>
        <DocumentList
          documents={recent.data ?? []}
          isLoading={recent.isLoading}
          error={recent.error}
          emptyText="Henüz işlem yapılmadı."
          renderInfo={(doc) => (
            <>
              <span className="font-medium">{docTypeLabels[doc.doc_type]}</span>
              <span className="text-slate-500">
                {doc.village && ` · ${villageDisplayName(doc.village)}`}
                {doc.doc_type === 'giris' && doc.supplier && ` · ${doc.supplier}`}
              </span>
            </>
          )}
        />
      </section>
    </>
  )
}
