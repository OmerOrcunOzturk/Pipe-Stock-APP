interface ListStateProps {
  isLoading: boolean
  error: Error | null
  isEmpty: boolean
  emptyText: string
}

/** Listelerde yükleniyor / hata / boş durumlarını tek yerden gösterir. null dönerse liste çizilir. */
export default function ListState({ isLoading, error, isEmpty, emptyText }: ListStateProps) {
  if (isLoading) return <p className="p-6 text-center text-sm text-slate-500">Yükleniyor…</p>
  if (error)
    return <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error.message}</p>
  if (isEmpty) return <p className="p-6 text-center text-sm text-slate-500">{emptyText}</p>
  return null
}
