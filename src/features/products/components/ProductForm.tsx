import { useState, type FormEvent } from 'react'
import Button from '@/components/ui/Button'
import { Field, SelectInput, TextInput } from '@/components/ui/Field'
import Modal from '@/components/ui/Modal'
import { parseDecimal } from '@/utils/number'
import { useSaveProduct } from '../hooks'
import {
  categoryDefaults,
  categoryLabels,
  CLASS_PATTERNS,
  MATERIAL_PATTERN,
  type PipeCategory,
  type Product,
  type ProductInput,
} from '../types'

interface ProductFormProps {
  /** Verilirse düzenleme, verilmezse yeni kayıt. */
  product?: Product
  onClose: () => void
}

type Errors = Partial<Record<keyof ProductInput, string>>

export default function ProductForm({ product, onClose }: ProductFormProps) {
  const save = useSaveProduct()
  const [category, setCategory] = useState<PipeCategory>(product?.category ?? 'icme_suyu')
  const [material, setMaterial] = useState(product?.material ?? categoryDefaults.icme_suyu.material)
  const [diameter, setDiameter] = useState(product ? String(product.diameter_mm) : '')
  const [pressureClass, setPressureClass] = useState(product?.pressure_class ?? '')
  const [length, setLength] = useState(
    String(product?.standard_length_m ?? categoryDefaults.icme_suyu.lengthM),
  )
  const [errors, setErrors] = useState<Errors>({})

  const defaults = categoryDefaults[category]

  function handleCategoryChange(next: PipeCategory) {
    // Kullanıcı varsayılanı değiştirmediyse yeni kategorinin varsayılanına geç.
    if (material === defaults.material) setMaterial(categoryDefaults[next].material)
    if (length === String(defaults.lengthM)) setLength(String(categoryDefaults[next].lengthM))
    setCategory(next)
  }

  function validate(): ProductInput | null {
    const next: Errors = {}
    const mat = material.trim().toUpperCase()
    const cls = pressureClass.replace(/\s+/g, '').toUpperCase()
    const dia = Number(diameter)
    const len = parseDecimal(length)

    if (!MATERIAL_PATTERN.test(mat)) next.material = 'Harf, rakam, boşluk, nokta veya tire kullanın (en fazla 30 karakter).'
    if (!Number.isInteger(dia) || dia < 1 || dia > 5000) next.diameter_mm = '1 ile 5000 arasında tam sayı girin.'
    if (!CLASS_PATTERNS[category].test(cls))
      next.pressure_class = `${defaults.classPrefix} ile başlamalı, örn. ${defaults.classSuggestions[1]}.`
    if (!(len > 0 && len <= 1000)) next.standard_length_m = '0’dan büyük, en fazla 1000 olmalı.'

    setErrors(next)
    if (Object.keys(next).length > 0) return null
    return { category, material: mat, diameter_mm: dia, pressure_class: cls, standard_length_m: len }
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (save.isPending) return
    const input = validate()
    if (!input) return
    save.mutate({ id: product?.id, input }, { onSuccess: onClose })
  }

  return (
    <Modal title={product ? 'Boru tipini düzenle' : 'Yeni boru tipi'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Field label="Kategori">
          <SelectInput value={category} onChange={(e) => handleCategoryChange(e.target.value as PipeCategory)}>
            {Object.entries(categoryLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </SelectInput>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Çap (mm)" error={errors.diameter_mm}>
            <TextInput
              inputMode="numeric"
              value={diameter}
              onChange={(e) => setDiameter(e.target.value)}
              placeholder="110"
              autoFocus
            />
          </Field>
          <Field label="Malzeme" error={errors.material}>
            <TextInput value={material} onChange={(e) => setMaterial(e.target.value)} className="uppercase" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field
            label={category === 'icme_suyu' ? 'Basınç sınıfı' : 'Rijitlik sınıfı'}
            error={errors.pressure_class}
          >
            <TextInput
              list="pressure-class-options"
              value={pressureClass}
              onChange={(e) => setPressureClass(e.target.value)}
              placeholder={defaults.classSuggestions[1]}
              className="uppercase"
            />
            <datalist id="pressure-class-options">
              {defaults.classSuggestions.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
          <Field label="1 adet boyu (m)" error={errors.standard_length_m}>
            <TextInput inputMode="decimal" value={length} onChange={(e) => setLength(e.target.value)} />
          </Field>
        </div>

        {save.error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {save.error.message}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Vazgeç
          </Button>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Kaydediliyor…' : 'Kaydet'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
