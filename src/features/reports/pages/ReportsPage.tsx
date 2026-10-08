import { useSearchParams } from 'react-router'
import PageHeader from '@/components/ui/PageHeader'
import { startOfMonthTr, todayTr } from '@/utils/date'
import type { DateRange } from '../api'
import DateRangeFilter from '../components/DateRangeFilter'
import MovementsReport from '../components/MovementsReport'
import ProductSummaryReport from '../components/ProductSummaryReport'
import VillageDistributionReport from '../components/VillageDistributionReport'

const tabs = [
  { key: 'koy', label: 'Köy Bazlı Dağıtım' },
  { key: 'boru', label: 'Boru Bazlı Özet' },
  { key: 'hareket', label: 'Hareket Dökümü' },
] as const

type TabKey = (typeof tabs)[number]['key']

const isIsoDate = (value: string | null): value is string => !!value && /^\d{4}-\d{2}-\d{2}$/.test(value)

export default function ReportsPage() {
  // Seçili rapor ve tarih aralığı adreste tutulur; yenileyince veya bağlantı
  // paylaşılınca aynı rapor açılır. Tarih alanı boşaltılırsa parametre '' olur.
  const [params, setParams] = useSearchParams()
  const active: TabKey = tabs.find((t) => t.key === params.get('rapor'))?.key ?? 'koy'
  const range: DateRange = {
    from: params.has('bas') ? (isIsoDate(params.get('bas')) ? params.get('bas')! : '') : startOfMonthTr(),
    to: params.has('bit') ? (isIsoDate(params.get('bit')) ? params.get('bit')! : '') : todayTr(),
  }

  function update(next: { tab?: TabKey; range?: DateRange }) {
    const r = next.range ?? range
    setParams({ rapor: next.tab ?? active, bas: r.from, bit: r.to }, { replace: true })
  }

  return (
    <>
      <PageHeader title="Raporlar" description="Tarih aralığına göre dağıtım ve stok hareket raporları." />

      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
        <DateRangeFilter value={range} onChange={(r) => update({ range: r })} />
      </div>

      <div role="tablist" className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            type="button"
            aria-selected={active === t.key}
            onClick={() => update({ tab: t.key })}
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

      {active === 'koy' && <VillageDistributionReport range={range} />}
      {active === 'boru' && <ProductSummaryReport range={range} />}
      {active === 'hareket' && <MovementsReport range={range} />}
    </>
  )
}
