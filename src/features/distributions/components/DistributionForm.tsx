import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import Button from '@/components/ui/Button'
import { Field, SelectInput, TextArea, TextInput } from '@/components/ui/Field'
import { useProducts } from '@/features/products/hooks'
import LineItemsEditor from '@/features/stock/components/LineItemsEditor'
import { formatDocNo } from '@/features/stock/docTypes'
import { useBalanceMap } from '@/features/stock/hooks'
import { emptyLine, validateLines, type LineDraft } from '@/features/stock/lines'
import { useRequestKey } from '@/features/stock/useRequestKey'
import { useVillages } from '@/features/villages/hooks'
import { villageDisplayName } from '@/features/villages/types'
import { todayTr } from '@/utils/date'
import { formatNumber } from '@/utils/number'
import { useCreateDistribution } from '../hooks'

type HeaderField = 'docDate' | 'villageId' | 'waybillNo' | 'vehiclePlate' | 'driverName' | 'receiverName' | 'note'
type HeaderErrors = Partial<Record<HeaderField, string>>

export default function DistributionForm() {
  const navigate = useNavigate()
  const create = useCreateDistribution()
  const { getKey, renew } = useRequestKey()
  const { data: allProducts = [], isLoading: productsLoading } = useProducts()
  const { data: allVillages = [], isLoading: villagesLoading } = useVillages()
  const { map: balances, isLoading: balancesLoading } = useBalanceMap()

  const products = useMemo(() => allProducts.filter((p) => p.is_active), [allProducts])
  const productsById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])
  const villages = useMemo(() => allVillages.filter((v) => v.is_active), [allVillages])

  const today = todayTr()
  const [docDate, setDocDate] = useState(today)
  const [villageId, setVillageId] = useState('')
  const [waybillNo, setWaybillNo] = useState('')
  const [vehiclePlate, setVehiclePlate] = useState('')
  const [driverName, setDriverName] = useState('')
  const [receiverName, setReceiverName] = useState('')
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
    if (!villageId) errors.villageId = 'Köy seçin.'
    if (waybillNo.trim().length > 50) errors.waybillNo = 'En fazla 50 karakter.'
    if (vehiclePlate.trim().length > 20) errors.vehiclePlate = 'En fazla 20 karakter.'
    if (driverName.trim().length > 100) errors.driverName = 'En fazla 100 karakter.'
    if (receiverName.trim().length > 100) errors.receiverName = 'En fazla 100 karakter.'
    if (note.trim().length > 1000) errors.note = 'En fazla 1000 karakter.'
    return errors
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (create.isPending) return

    const header = validateHeader()
    const { payload, lineErrors: le, formError: fe } = validateLines(lines, productsById, balances)
    setHeaderErrors(header)
    setLineErrors(le)
    setFormError(fe)
    if (Object.keys(header).length > 0 || !payload) return

    const village = villages.find((v) => v.id === villageId)
    const totalPieces = payload.reduce((s, l) => s + l.pieces, 0)
    const totalMeters = payload.reduce((s, l) => s + l.meters, 0)
    const ok = confirm(
      `${village ? villageDisplayName(village) : 'Seçilen köy'} için ${payload.length} kalem, toplam ${formatNumber(totalPieces)} adet / ${formatNumber(totalMeters)} m dağıtım kaydedilsin mi?`,
    )
    if (!ok) return

    create.mutate(
      {
        clientRequestId: getKey(),
        docDate,
        villageId,
        waybillNo: waybillNo.trim(),
        vehiclePlate: vehiclePlate.trim(),
        driverName: driverName.trim(),
        receiverName: receiverName.trim(),
        note: note.trim(),
        lines: payload,
      },
      {
        onSuccess: ({ docNo }) =>
          navigate('/dagitim', { replace: true, state: { createdDocNo: formatDocNo('dagitim', docNo) } }),
      },
    )
  }

  const isNetworkError = create.error?.message.includes('Sunucuya ulaşılamadı')
  const isLoading = productsLoading || villagesLoading || balancesLoading
  const busy = create.isPending

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-700">Belge bilgileri</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Köy" error={headerErrors.villageId}>
            <SelectInput value={villageId} onChange={(e) => edit(setVillageId)(e.target.value)} disabled={busy}>
              <option value="">Köy seçin…</option>
              {villages.map((v) => (
                <option key={v.id} value={v.id}>
                  {villageDisplayName(v)}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Tarih" error={headerErrors.docDate}>
            <TextInput
              type="date"
              value={docDate}
              max={today}
              onChange={(e) => edit(setDocDate)(e.target.value)}
              disabled={busy}
            />
          </Field>
          <Field label="Teslim alan" hint="İsteğe bağlı" error={headerErrors.receiverName}>
            <TextInput
              value={receiverName}
              onChange={(e) => edit(setReceiverName)(e.target.value)}
              maxLength={100}
              disabled={busy}
            />
          </Field>
          <Field label="İrsaliye no" hint="İsteğe bağlı" error={headerErrors.waybillNo}>
            <TextInput
              value={waybillNo}
              onChange={(e) => edit(setWaybillNo)(e.target.value)}
              maxLength={50}
              disabled={busy}
            />
          </Field>
          <Field label="Araç plakası" hint="İsteğe bağlı" error={headerErrors.vehiclePlate}>
            <TextInput
              value={vehiclePlate}
              onChange={(e) => edit(setVehiclePlate)(e.target.value)}
              maxLength={20}
              className="uppercase"
              disabled={busy}
            />
          </Field>
          <Field label="Şoför" hint="İsteğe bağlı" error={headerErrors.driverName}>
            <TextInput
              value={driverName}
              onChange={(e) => edit(setDriverName)(e.target.value)}
              maxLength={100}
              disabled={busy}
            />
          </Field>
        </div>
        <Field label="Not" hint="İsteğe bağlı" error={headerErrors.note}>
          <TextArea
            value={note}
            onChange={(e) => edit(setNote)(e.target.value)}
            rows={2}
            maxLength={1000}
            disabled={busy}
          />
        </Field>
      </section>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-700">Borular</h2>
        {isLoading ? (
          <p className="text-sm text-slate-500">Yükleniyor…</p>
        ) : villages.length === 0 ? (
          <p className="text-sm text-slate-500">Aktif köy yok. Önce Tanımlar sayfasından köy ekleyin.</p>
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
            disabled={busy}
            outgoing
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
        <Button variant="secondary" onClick={() => navigate('/dagitim')} disabled={busy}>
          Vazgeç
        </Button>
        <Button type="submit" disabled={busy || isLoading || products.length === 0 || villages.length === 0}>
          {busy ? 'Kaydediliyor…' : 'Kaydet'}
        </Button>
      </div>
    </form>
  )
}
