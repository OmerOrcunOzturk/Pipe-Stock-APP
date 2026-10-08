import { Plus, Trash2 } from 'lucide-react'
import Button from '@/components/ui/Button'
import { SelectInput, TextInput } from '@/components/ui/Field'
import { categoryLabels, type PipeCategory, type Product } from '@/features/products/types'
import { formatNumber, parseDecimal } from '@/utils/number'
import type { StockBalance } from '../api'
import { autoMeters, emptyLine, standardMeters, sumLines, takesAllStock, type LineDraft } from '../lines'

interface LineItemsEditorProps {
  lines: LineDraft[]
  onChange: (lines: LineDraft[]) => void
  /** Seçilebilir (aktif) boru tipleri. */
  products: Product[]
  balances: Map<string, StockBalance>
  errors: Record<string, string>
  disabled?: boolean
  /** Çıkış (dağıtım) modu: stok yeterliliği gösterilir, son borularda metre depodaki kalan metredir. */
  outgoing?: boolean
}

export default function LineItemsEditor({
  lines,
  onChange,
  products,
  balances,
  errors,
  disabled,
  outgoing = false,
}: LineItemsEditorProps) {
  const productsById = new Map(products.map((p) => [p.id, p]))

  // Son borular çıkarken gösterilen/kaydedilen metre depodaki kalan metredir.
  const effectiveLines = lines.map((l) => {
    const balance = outgoing ? balances.get(l.productId) : undefined
    return takesAllStock(l.pieces, balance) ? { ...l, meters: String(balance!.meters) } : l
  })
  const totals = sumLines(effectiveLines)

  function update(key: string, patch: Partial<LineDraft>) {
    onChange(
      lines.map((line) => {
        if (line.key !== key) return line
        const next = { ...line, ...patch }
        const balance = outgoing ? balances.get(next.productId) : undefined
        // Son borular seçildiyse elle girilen metre geçersizdir; otomatiğe dön.
        if (takesAllStock(next.pieces, balance)) next.metersEdited = false
        // Metre elle değiştirilmediyse otomatik değeri güncel tut.
        if (!next.metersEdited) next.meters = autoMeters(next.pieces, productsById.get(next.productId), balance)
        return next
      }),
    )
  }

  function remove(key: string) {
    onChange(lines.filter((l) => l.key !== key))
  }

  const grouped = (Object.keys(categoryLabels) as PipeCategory[]).map((category) => ({
    category,
    items: products.filter((p) => p.category === category),
  }))

  return (
    <div className="space-y-3">
      {effectiveLines.map((line, index) => {
        const product = productsById.get(line.productId)
        const balance = balances.get(line.productId)
        const std = standardMeters(line.pieces, product)
        const takesAll = outgoing && takesAllStock(line.pieces, balance)
        const exceedsStock =
          outgoing && !!product && /^\d+$/.test(line.pieces.trim()) && Number(line.pieces) > (balance?.pieces ?? 0)
        const isNonStandard =
          !takesAll && line.metersEdited && std !== '' && parseDecimal(line.meters) !== parseDecimal(std)
        const usedElsewhere = new Set(lines.filter((l) => l.key !== line.key).map((l) => l.productId))

        return (
          <div key={line.key} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            <div className="flex items-start gap-2">
              <span className="mt-2.5 w-6 shrink-0 text-xs font-medium text-slate-400">{index + 1}.</span>
              <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 md:grid-cols-[minmax(0,1fr)_7rem_8rem]">
                <label className="col-span-2 md:col-span-1">
                  <span className="sr-only">Boru tipi</span>
                  <SelectInput
                    value={line.productId}
                    onChange={(e) => update(line.key, { productId: e.target.value })}
                    disabled={disabled}
                    className="mt-0"
                  >
                    <option value="">Boru tipi seçin…</option>
                    {grouped.map(
                      (g) =>
                        g.items.length > 0 && (
                          <optgroup key={g.category} label={categoryLabels[g.category]}>
                            {g.items.map((p) => (
                              <option
                                key={p.id}
                                value={p.id}
                                disabled={
                                  usedElsewhere.has(p.id) || (outgoing && (balances.get(p.id)?.pieces ?? 0) === 0)
                                }
                              >
                                {p.name}
                                {outgoing && ` — ${formatNumber(balances.get(p.id)?.pieces ?? 0)} adet`}
                              </option>
                            ))}
                          </optgroup>
                        ),
                    )}
                  </SelectInput>
                </label>
                <label>
                  <span className="text-xs text-slate-500 md:sr-only">Adet</span>
                  <TextInput
                    inputMode="numeric"
                    placeholder="Adet"
                    value={line.pieces}
                    onChange={(e) => update(line.key, { pieces: e.target.value })}
                    disabled={disabled}
                    className="mt-0"
                  />
                </label>
                <label>
                  <span className="text-xs text-slate-500 md:sr-only">Metre</span>
                  <TextInput
                    inputMode="decimal"
                    placeholder="Metre"
                    value={line.meters}
                    onChange={(e) =>
                      update(line.key, { meters: e.target.value, metersEdited: e.target.value.trim() !== '' })
                    }
                    disabled={disabled || takesAll}
                    className="mt-0"
                  />
                </label>
              </div>
              <button
                type="button"
                onClick={() => remove(line.key)}
                disabled={disabled}
                className="mt-1 rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                aria-label={`${index + 1}. satırı sil`}
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </div>

            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 pl-8 text-xs">
              {product && (
                <span className={exceedsStock ? 'font-medium text-red-600' : 'text-slate-500'}>
                  Depoda: {formatNumber(balance?.pieces ?? 0)} adet / {formatNumber(balance?.meters ?? 0)} m
                  {' · '}1 adet = {formatNumber(product.standard_length_m)} m
                </span>
              )}
              {takesAll && (
                <span className="text-blue-700">
                  Depodaki son borular: metre, depoda kalan {formatNumber(balance?.meters ?? 0)} m olarak kaydedilir.
                </span>
              )}
              {isNonStandard && (
                <span className="text-amber-700">
                  Standart dışı metre (standart: {formatNumber(parseDecimal(std))} m).{' '}
                  <button
                    type="button"
                    className="underline"
                    onClick={() => update(line.key, { metersEdited: false })}
                    disabled={disabled}
                  >
                    Standarda dön
                  </button>
                </span>
              )}
              {errors[line.key] && <span className="text-red-600">{errors[line.key]}</span>}
            </div>
          </div>
        )
      })}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="secondary" onClick={() => onChange([...lines, emptyLine()])} disabled={disabled}>
          <Plus className="size-4" aria-hidden /> Satır ekle
        </Button>
        <p className="text-sm text-slate-600">
          Toplam: <strong>{formatNumber(totals.pieces)}</strong> adet /{' '}
          <strong>{formatNumber(totals.meters)}</strong> m
        </p>
      </div>
    </div>
  )
}
