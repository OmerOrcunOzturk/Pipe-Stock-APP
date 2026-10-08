import { TextInput } from '@/components/ui/Field'
import { lastMonthRangeTr, startOfMonthTr, startOfYearTr, todayTr } from '@/utils/date'
import type { DateRange } from '../api'

interface DateRangeFilterProps {
  value: DateRange
  onChange: (range: DateRange) => void
}

/** Tüm kayıtları kapsayan başlangıç (veritabanındaki en erken geçerli belge tarihi). */
const EARLIEST = '2000-01-01'

export default function DateRangeFilter({ value, onChange }: DateRangeFilterProps) {
  const today = todayTr()
  const presets: { label: string; range: DateRange }[] = [
    { label: 'Bu ay', range: { from: startOfMonthTr(), to: today } },
    { label: 'Geçen ay', range: lastMonthRangeTr() },
    { label: 'Bu yıl', range: { from: startOfYearTr(), to: today } },
    { label: 'Tümü', range: { from: EARLIEST, to: today } },
  ]
  const invalid = !!value.from && !!value.to && value.from > value.to

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Başlangıç</span>
          <TextInput
            type="date"
            value={value.from}
            max={today}
            onChange={(e) => onChange({ ...value, from: e.target.value })}
            className="mt-0.5"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Bitiş</span>
          <TextInput
            type="date"
            value={value.to}
            max={today}
            onChange={(e) => onChange({ ...value, to: e.target.value })}
            className="mt-0.5"
          />
        </label>
        <div className="flex flex-wrap gap-1 pb-0.5">
          {presets.map((p) => {
            const active = p.range.from === value.from && p.range.to === value.to
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => onChange(p.range)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                  active ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {p.label}
              </button>
            )
          })}
        </div>
      </div>
      {invalid && <p className="text-xs text-red-600">Başlangıç tarihi bitiş tarihinden sonra olamaz.</p>}
      {(!value.from || !value.to) && <p className="text-xs text-red-600">Başlangıç ve bitiş tarihini seçin.</p>}
    </div>
  )
}
