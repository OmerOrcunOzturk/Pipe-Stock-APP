import { useQuery } from '@tanstack/react-query'
import ListState from '@/components/ui/ListState'
import { formatDateTime } from '@/utils/date'
import { listAuditLog } from '../api'
import { actionLabels, fieldChanges, recordName, tableLabels } from '../describe'

const actionStyles: Record<string, string> = {
  INSERT: 'bg-green-50 text-green-700',
  UPDATE: 'bg-blue-50 text-blue-800',
  DELETE: 'bg-red-50 text-red-700',
}

export default function AuditTab() {
  // Sekme her açıldığında güncel liste gelsin.
  const { data: entries = [], isLoading, error } = useQuery({
    queryKey: ['audit-log'],
    queryFn: () => listAuditLog(),
    staleTime: 0,
  })

  return (
    <div className="space-y-4">
      <p className="rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-600">
        Boru tipi, köy ve kullanıcı kayıtlarındaki son 100 değişiklik. Stok işlemlerinin geçmişi için Stok
        sayfasından ilgili borunun hareket geçmişine bakın.
      </p>

      <div className="rounded-xl border border-slate-200 bg-white">
        <ListState
          isLoading={isLoading}
          error={error}
          isEmpty={entries.length === 0}
          emptyText="Henüz kayıtlı değişiklik yok."
        />
        {!isLoading && !error && entries.length > 0 && (
          <ul className="divide-y divide-slate-100">
            {entries.map((entry) => {
              const changes = fieldChanges(entry)
              return (
                <li key={entry.id} className="px-4 py-3">
                  <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
                    <span className="text-slate-500">{tableLabels[entry.table_name] ?? entry.table_name}</span>
                    <span className="font-medium">{recordName(entry)}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${actionStyles[entry.action] ?? ''}`}
                    >
                      {actionLabels[entry.action] ?? entry.action}
                    </span>
                  </p>
                  {changes.length > 0 && (
                    <ul className="mt-1 space-y-0.5 text-xs text-slate-600">
                      {changes.map((c) => (
                        <li key={c.label}>
                          {c.label}: <span className="text-slate-400 line-through">{c.from}</span> →{' '}
                          <span className="font-medium">{c.to}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-1 text-xs text-slate-400">
                    {entry.changer?.full_name || 'Sistem'} · {formatDateTime(entry.changed_at)}
                  </p>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
