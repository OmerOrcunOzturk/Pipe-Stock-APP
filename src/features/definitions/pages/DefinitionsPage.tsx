import { useSearchParams } from 'react-router'
import PageHeader from '@/components/ui/PageHeader'
import AuditTab from '@/features/audit/components/AuditTab'
import { useIsAdmin } from '@/features/auth/authContext'
import ProductsTab from '@/features/products/components/ProductsTab'
import UsersTab from '@/features/users/components/UsersTab'
import VillagesTab from '@/features/villages/components/VillagesTab'

const tabs = [
  { key: 'borular', label: 'Boru Tipleri', adminOnly: false },
  { key: 'koyler', label: 'Köyler', adminOnly: false },
  { key: 'kullanicilar', label: 'Kullanıcılar', adminOnly: true },
  { key: 'gecmis', label: 'Değişiklik Geçmişi', adminOnly: true },
] as const

type TabKey = (typeof tabs)[number]['key']

export default function DefinitionsPage() {
  const isAdmin = useIsAdmin()
  // Seçili sekme adreste tutulur (?sekme=koyler); yenileyince kaybolmaz.
  const [params, setParams] = useSearchParams()
  const visibleTabs = tabs.filter((t) => !t.adminOnly || isAdmin)
  const requested = params.get('sekme')
  const active: TabKey = visibleTabs.find((t) => t.key === requested)?.key ?? 'borular'

  return (
    <>
      <PageHeader title="Tanımlar" description="Boru tipleri, köyler ve kullanıcılar." />

      <div role="tablist" className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200">
        {visibleTabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            type="button"
            aria-selected={active === t.key}
            onClick={() => setParams({ sekme: t.key }, { replace: true })}
            className={`-mb-px shrink-0 border-b-2 px-4 py-2 text-sm font-medium ${
              active === t.key
                ? 'border-blue-700 text-blue-800'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {active === 'borular' && <ProductsTab />}
      {active === 'koyler' && <VillagesTab />}
      {active === 'kullanicilar' && <UsersTab />}
      {active === 'gecmis' && <AuditTab />}
    </>
  )
}
