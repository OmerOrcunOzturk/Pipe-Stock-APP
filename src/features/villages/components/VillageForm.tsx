import { useState, type FormEvent } from 'react'
import Button from '@/components/ui/Button'
import { Field, TextArea, TextInput } from '@/components/ui/Field'
import Modal from '@/components/ui/Modal'
import { useSaveVillage } from '../hooks'
import { normalizeText, type Village, type VillageInput } from '../types'

interface VillageFormProps {
  /** Verilirse düzenleme, verilmezse yeni kayıt. */
  village?: Village
  onClose: () => void
}

type Errors = Partial<Record<keyof VillageInput, string>>

export default function VillageForm({ village, onClose }: VillageFormProps) {
  const save = useSaveVillage()
  const [name, setName] = useState(village?.name ?? '')
  const [district, setDistrict] = useState(village?.district ?? '')
  const [muhtarName, setMuhtarName] = useState(village?.muhtar_name ?? '')
  const [note, setNote] = useState(village?.note ?? '')
  const [errors, setErrors] = useState<Errors>({})

  function validate(): VillageInput | null {
    const input = {
      name: normalizeText(name),
      district: normalizeText(district),
      muhtar_name: normalizeText(muhtarName),
      note: note.trim(),
    }
    const next: Errors = {}
    if (input.name.length === 0) next.name = 'Köy adı zorunludur.'
    else if (input.name.length > 100) next.name = 'En fazla 100 karakter.'
    if (input.district.length > 100) next.district = 'En fazla 100 karakter.'
    if (input.muhtar_name.length > 100) next.muhtar_name = 'En fazla 100 karakter.'
    if (input.note.length > 500) next.note = 'En fazla 500 karakter.'
    setErrors(next)
    return Object.keys(next).length > 0 ? null : input
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (save.isPending) return
    const input = validate()
    if (!input) return
    save.mutate({ id: village?.id, input }, { onSuccess: onClose })
  }

  return (
    <Modal title={village ? 'Köyü düzenle' : 'Yeni köy'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Field label="Köy adı" error={errors.name}>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} maxLength={100} autoFocus />
        </Field>
        <Field label="İlçe" hint="İsteğe bağlı" error={errors.district}>
          <TextInput value={district} onChange={(e) => setDistrict(e.target.value)} maxLength={100} />
        </Field>
        <Field label="Muhtar" hint="İsteğe bağlı · talep formlarına yazılır" error={errors.muhtar_name}>
          <TextInput value={muhtarName} onChange={(e) => setMuhtarName(e.target.value)} maxLength={100} />
        </Field>
        <Field label="Not" hint="İsteğe bağlı" error={errors.note}>
          <TextArea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={500} />
        </Field>

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
