export default function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
        active ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'
      }`}
    >
      {active ? 'Aktif' : 'Pasif'}
    </span>
  )
}
