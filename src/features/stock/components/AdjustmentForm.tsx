import { Plus, Trash2 } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import Button from '@/components/ui/Button'
import { Field, SelectInput, TextArea, TextInput } from '@/components/ui/Field'
import { useProducts } from '@/features/products/hooks'
import { categoryLabels, type PipeCategory } from '@/features/products/types'
import { todayTr } from '@/utils/date'
import { formatNumber } from '@/utils/number'
import {
  autoCountedMeters,
  countLineDiff,
  emptyCountLine,
  validateCountLines,
  type CountLineDraft,
} from '../adjustment'
import { formatDocNo } from '../docTypes'
import { useBalanceMap, useCreateAdjustment } from '../hooks'
import { useRequestKey } from '../useRequestKey'

const signed = (value: number) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${formatNumber(Math.abs(value))}`

export default function AdjustmentForm() {
  const navigate = useNavigate()
  const create = useCreateAdjustment()
  const { getKey, renew } = useRequestKey()
  const { data: allProducts = [], isLoading: productsLoading } = useProducts()
  const { map: balances, isLoading: balancesLoading, refetch: refetchBalances } = useBalanceMap()

  const products = useMemo(() => allProducts.filter((p) => p.is_active), [allProducts])
  const productsById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])

  const today = todayTr()
  const [docDate, setDocDate] = useState(today)
  const [note, setNote] = useState('')
  const [lines, setLines] = useState<CountLineDraft[]>([emptyCountLine()])
  const [headerErrors, setHeaderErrors] = useState<{ docDate?: string; note?: string }>({})
  const [lineErrors, setLineErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [isChecking, setIsChecking] = useState(false)

  const busy = create.isPending || isChecking

  function updateLine(key: string, patch: Partial<CountLineDraft>) {
    renew()
    setLines((prev) =>
      prev.map((line) => {
        if (line.key !== key) return line
        const next = { ...line, ...patch }
        if (!next.metersEdited)
          next.countedMeters = autoCountedMeters(
            next.countedPieces,
            productsById.get(next.productId),
            balances.get(next.productId),
          )
        return next
      }),
    )
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (busy) return

    const header: { docDate?: string; note?: string } = {}
    if (!docDate) header.docDate = 'Tarih seçin.'
    else if (docDate > today) header.docDate = 'İleri bir tarih seçilemez.'
    if (note.trim() === '') header.note = 'Düzeltme gerekçesi zorunludur.'
    else if (note.trim().length > 1000) header.note = 'En fazla 1000 karakter.'
    setHeaderErrors(header)

    const first = validateCountLines(lines, productsById, balances)
    setLineErrors(first.lineErrors)
    setFormError(first.formError)
    if (Object.keys(header).length > 0 || !first.payload) return

    // Fark, ekranda görünen stoğa göre hesaplandı. Kaydetmeden hemen önce stoğu
    // yeniden oku; arada başka bir işlem yapıldıysa fark yanlış olur.
    setIsChecking(true)
    const fresh = await refetchBalances()
    setIsChecking(false)
    if (fresh.error || !fresh.data) {
      setFormError('Güncel stok okunamadı. Ağ bağlantınızı kontrol edip tekrar deneyin.')
      return
    }
    const freshMap = new Map(fresh.data.map((b) => [b.product_id, b]))
    const changed = lines.some((l) => {
      const before = balances.get(l.productId)
      const after = freshMap.get(l.productId)
      return (before?.pieces ?? 0) !== (after?.pieces ?? 0) || (before?.meters ?? 0) !== (after?.meters ?? 0)
    })
    if (changed) {
      setFormError(
        'Siz formu doldururken bu boruların stoğu değişti. “Sistemde” değerleri güncellendi; farkları kontrol edip tekrar kaydedin.',
      )
      return
    }

    const payload = first.payload
    const summary = payload
      .map((l) => `${productsById.get(l.product_id)?.name}: ${signed(l.pieces)} adet / ${signed(l.meters)} m`)
      .join('\n')
    if (!confirm(`Aşağıdaki sayım düzeltmesi kaydedilsin mi?\n\n${summary}`)) return

    create.mutate(
      { clientRequestId: getKey(), docDate, note: note.trim(), lines: payload },
      {
        onSuccess: ({ docNo }) =>
          navigate('/stok/duzeltme', { replace: true, state: { createdDocNo: formatDocNo('duzeltme', docNo) } }),
      },
    )
  }

  const grouped = (Object.keys(categoryLabels) as PipeCategory[]).map((category) => ({
    category,
    items: products.filter((p) => p.category === category),
  }))
  const isLoading = productsLoading || balancesLoading

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-700">Belge bilgileri</h2>
        <Field label="Sayım tarihi" error={headerErrors.docDate}>
          <TextInput
            type="date"
            value={docDate}
            max={today}
            onChange={(e) => {
              renew()
              setDocDate(e.target.value)
            }}
            disabled={busy}
            className="md:max-w-xs"
          />
        </Field>
        <Field label="Gerekçe" hint="Farkın nedeni; örn. “Ekim sayımı, 2 boru hasarlı çıktı”." error={headerErrors.note}>
          <TextArea
            value={note}
            onChange={(e) => {
              renew()
              setNote(e.target.value)
            }}
            rows={2}
            maxLength={1000}
            disabled={busy}
          />
        </Field>
      </section>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-700">Sayılan borular</h2>
        <p className="text-xs text-slate-500">
          Sadece sayımda farklı çıkan boruları ekleyin ve depoda saydığınız adedi girin; fark otomatik hesaplanır.
        </p>
        {isLoading ? (
          <p className="text-sm text-slate-500">Yükleniyor…</p>
        ) : products.length === 0 ? (
          <p className="text-sm text-slate-500">Aktif boru tipi yok.</p>
        ) : (
          <>
            {lines.map((line, index) => {
              const product = productsById.get(line.productId)
              const balance = balances.get(line.productId)
              const diff = countLineDiff(line, balance)
              const usedElsewhere = new Set(lines.filter((l) => l.key !== line.key).map((l) => l.productId))
              const countedIsZero = line.countedPieces.trim() === '0'
              return (
                <div key={line.key} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                  <div className="flex items-start gap-2">
                    <span className="mt-2.5 w-6 shrink-0 text-xs font-medium text-slate-400">{index + 1}.</span>
                    <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 md:grid-cols-[minmax(0,1fr)_8rem_8rem]">
                      <label className="col-span-2 md:col-span-1">
                        <span className="sr-only">Boru tipi</span>
                        <SelectInput
                          value={line.productId}
                          onChange={(e) => updateLine(line.key, { productId: e.target.value })}
                          disabled={busy}
                          className="mt-0"
                        >
                          <option value="">Boru tipi seçin…</option>
                          {grouped.map(
                            (g) =>
                              g.items.length > 0 && (
                                <optgroup key={g.category} label={categoryLabels[g.category]}>
                                  {g.items.map((p) => (
                                    <option key={p.id} value={p.id} disabled={usedElsewhere.has(p.id)}>
                                      {p.name} — {formatNumber(balances.get(p.id)?.pieces ?? 0)} adet
                                    </option>
                                  ))}
                                </optgroup>
                              ),
                          )}
                        </SelectInput>
                      </label>
                      <label>
                        <span className="text-xs text-slate-500">Sayılan adet</span>
                        <TextInput
                          inputMode="numeric"
                          value={line.countedPieces}
                          onChange={(e) => updateLine(line.key, { countedPieces: e.target.value })}
                          disabled={busy}
                          className="mt-0"
                        />
                      </label>
                      <label>
                        <span className="text-xs text-slate-500">Sayılan metre</span>
                        <TextInput
                          inputMode="decimal"
                          value={countedIsZero ? '0' : line.countedMeters}
                          onChange={(e) =>
                            updateLine(line.key, {
                              countedMeters: e.target.value,
                              metersEdited: e.target.value.trim() !== '',
                            })
                          }
                          disabled={busy || countedIsZero}
                          className="mt-0"
                        />
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        renew()
                        setLines((prev) => prev.filter((l) => l.key !== line.key))
                      }}
                      disabled={busy}
                      className="mt-1 rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                      aria-label={`${index + 1}. satırı sil`}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </div>

                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 pl-8 text-xs">
                    {product && (
                      <span className="text-slate-500">
                        Sistemde: {formatNumber(balance?.pieces ?? 0)} adet / {formatNumber(balance?.meters ?? 0)} m
                      </span>
                    )}
                    {product && diff && diff.pieces !== 0 && (
                      <span className={`font-medium ${diff.pieces > 0 ? 'text-green-700' : 'text-red-700'}`}>
                        Fark: {signed(diff.pieces)} adet / {signed(diff.meters)} m
                      </span>
                    )}
                    {lineErrors[line.key] && <span className="text-red-600">{lineErrors[line.key]}</span>}
                  </div>
                </div>
              )
            })}
            <Button
              variant="secondary"
              onClick={() => {
                renew()
                setLines((prev) => [...prev, emptyCountLine()])
              }}
              disabled={busy}
            >
              <Plus className="size-4" aria-hidden /> Satır ekle
            </Button>
          </>
        )}
        {formError && <p className="text-sm text-red-600">{formError}</p>}
      </section>

      {create.error && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {create.error.message}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={() => navigate('/stok/duzeltme')} disabled={busy}>
          Vazgeç
        </Button>
        <Button type="submit" disabled={busy || isLoading || products.length === 0}>
          {isChecking ? 'Stok kontrol ediliyor…' : create.isPending ? 'Kaydediliyor…' : 'Kaydet'}
        </Button>
      </div>
    </form>
  )
}
