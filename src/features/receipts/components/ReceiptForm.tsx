import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import Button from '@/components/ui/Button'
import { Field, TextArea, TextInput } from '@/components/ui/Field'
import { useProducts } from '@/features/products/hooks'
import LineItemsEditor from '@/features/stock/components/LineItemsEditor'
import { formatDocNo } from '@/features/stock/docTypes'
import { useBalanceMap } from '@/features/stock/hooks'
import { emptyLine, sumLines, validateLines, type LineDraft } from '@/features/stock/lines'
import { useRequestKey } from '@/features/stock/useRequestKey'
import { todayTr } from '@/utils/date'
import { formatNumber } from '@/utils/number'
import { OPENING_STOCK_SUPPLIER } from '../constants'
import { useCreateReceipt } from '../hooks'

type HeaderErrors = Partial<Record<'docDate' | 'supplier' | 'waybillNo' | 'note', string>>

export default function ReceiptForm() {
  const navigate = useNavigate()
  const create = useCreateReceipt()
  const { getKey, renew } = useRequestKey()
  const { data: allProducts = [], isLoading: productsLoading } = useProducts()
  const { map: balances } = useBalanceMap()

  const products = useMemo(() => allProducts.filter((p) => p.is_active), [allProducts])
  const productsById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])

  const today = todayTr()
  const [docDate, setDocDate] = useState(today)
  const [supplier, setSupplier] = useState('')
  const [waybillNo, setWaybillNo] = useState('')
  const [note, setNote] = useState('')
  const [lines, setLines] = useState<LineDraft[]>([emptyLine()])
  const [headerErrors, setHeaderErrors] = useState<HeaderErrors>({})
  const [lineErrors, setLineErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)

  // Her içerik değişikliğinde istek anahtarı yenilenir (bkz. useRequestKey).
  function edit<T>(setter: (v: T) => void) {
    return (value: T) => {
      renew()
      setter(value)
    }
  }

  function validateHeader(): HeaderErrors {
    const errors: HeaderErrors = {}
    if (!docDate) errors.docDate = 'Tarih seçin.'
    else if (docDate > today) errors.docDate = 'İleri bir tarih seçilemez.'
    else if (docDate < '2000-01-01') errors.docDate = 'Geçersiz tarih.'
    if (supplier.trim() === '') errors.supplier = 'Tedarikçi zorunludur.'
    else if (supplier.trim().length > 200) errors.supplier = 'En fazla 200 karakter.'
    if (waybillNo.trim().length > 50) errors.waybillNo = 'En fazla 50 karakter.'
    if (note.trim().length > 1000) errors.note = 'En fazla 1000 karakter.'
    return errors
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (create.isPending) return

    const header = validateHeader()
    const { payload, lineErrors: le, formError: fe } = validateLines(lines, productsById)
    setHeaderErrors(header)
    setLineErrors(le)
    setFormError(fe)
    if (Object.keys(header).length > 0 || !payload) return

    const totals = sumLines(lines)
    const ok = confirm(
      `${payload.length} kalem, toplam ${formatNumber(totals.pieces)} adet / ${formatNumber(totals.meters)} m stok girişi kaydedilsin mi?`,
    )
    if (!ok) return

    create.mutate(
      {
        clientRequestId: getKey(),
        docDate,
        supplier: supplier.trim(),
        waybillNo: waybillNo.trim(),
        note: note.trim(),
        lines: payload,
      },
      {
        onSuccess: ({ docNo }) =>
          navigate('/giris', { replace: true, state: { createdDocNo: formatDocNo('giris', docNo) } }),
      },
    )
  }

  const isNetworkError = create.error?.message.includes('Sunucuya ulaşılamadı')

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-700">Belge bilgileri</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Tarih" error={headerErrors.docDate}>
            <TextInput
              type="date"
              value={docDate}
              max={today}
              onChange={(e) => edit(setDocDate)(e.target.value)}
              disabled={create.isPending}
            />
          </Field>
          <Field label="İrsaliye no" hint="İsteğe bağlı" error={headerErrors.waybillNo}>
            <TextInput
              value={waybillNo}
              onChange={(e) => edit(setWaybillNo)(e.target.value)}
              maxLength={50}
              disabled={create.isPending}
            />
          </Field>
        </div>
        <Field label="Tedarikçi" error={headerErrors.supplier}>
          <TextInput
            value={supplier}
            onChange={(e) => edit(setSupplier)(e.target.value)}
            maxLength={200}
            disabled={create.isPending}
          />
        </Field>
        <button
          type="button"
          onClick={() => edit(setSupplier)(OPENING_STOCK_SUPPLIER)}
          disabled={create.isPending}
          className="-mt-2 text-xs font-medium text-blue-700 underline"
        >
          Açılış stoğu girişi (tedarikçi: “{OPENING_STOCK_SUPPLIER}”)
        </button>
        <Field label="Not" hint="İsteğe bağlı" error={headerErrors.note}>
          <TextArea
            value={note}
            onChange={(e) => edit(setNote)(e.target.value)}
            rows={2}
            maxLength={1000}
            disabled={create.isPending}
          />
        </Field>
      </section>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-700">Borular</h2>
        {productsLoading ? (
          <p className="text-sm text-slate-500">Boru tipleri yükleniyor…</p>
        ) : products.length === 0 ? (
          <p className="text-sm text-slate-500">
            Aktif boru tipi yok. Önce Tanımlar sayfasından boru tipi ekleyin.
          </p>
        ) : (
          <LineItemsEditor
            lines={lines}
            onChange={edit(setLines)}
            products={products}
            balances={balances}
            errors={lineErrors}
            disabled={create.isPending}
          />
        )}
        {formError && <p className="text-sm text-red-600">{formError}</p>}
      </section>

      {create.error && (
        <div role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          <p>{create.error.message}</p>
          {isNetworkError && (
            <p className="mt-1 text-xs">
              Kayıt sunucuya ulaşmış olabilir. Formda hiçbir şeyi değiştirmeden tekrar “Kaydet”e basarsanız
              çift kayıt oluşmaz.
            </p>
          )}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={() => navigate('/giris')} disabled={create.isPending}>
          Vazgeç
        </Button>
        <Button type="submit" disabled={create.isPending || products.length === 0}>
          {create.isPending ? 'Kaydediliyor…' : 'Kaydet'}
        </Button>
      </div>
    </form>
  )
}
