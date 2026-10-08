import { useState, type FormEvent } from 'react'
import Button from '@/components/ui/Button'
import { Field, SelectInput, TextInput } from '@/components/ui/Field'
import Modal from '@/components/ui/Modal'
import { roleLabels, type UserRole } from '@/features/auth/roles'
import { MIN_PASSWORD_LENGTH, type AppUser } from '../api'
import { useCreateUser, useUpdateUser } from '../hooks'

interface UserFormProps {
  /** Verilirse düzenleme, verilmezse yeni kullanıcı. */
  user?: AppUser
  /** Düzenlenen kullanıcı, oturumdaki kullanıcının kendisi mi? */
  isSelf: boolean
  onClose: () => void
}

type Errors = Partial<Record<'email' | 'password', string>>

const roleDescriptions: Record<UserRole, string> = {
  admin: 'Tüm işlemler: tanımlar, giriş, dağıtım, iptal, sayım düzeltmesi, kullanıcı yönetimi.',
  depo: 'Stok girişi ve dağıtım yapabilir; iptal, düzeltme ve tanım değişikliği yapamaz.',
  izleyici: 'Sadece görüntüleyebilir; hiçbir kayıt yapamaz.',
}

// Veritabanındaki kuralla aynı (kullanıcıya erken geri bildirim için).
const EMAIL_PATTERN = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/

export default function UserForm({ user, isSelf, onClose }: UserFormProps) {
  const create = useCreateUser()
  const update = useUpdateUser()
  const save = user ? update : create
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState(user?.full_name ?? '')
  const [role, setRole] = useState<UserRole>(user?.role ?? 'izleyici')
  const [isActive, setIsActive] = useState(user?.is_active ?? true)
  const [errors, setErrors] = useState<Errors>({})

  const losesOwnAdmin = !!user && isSelf && user.role === 'admin' && (role !== 'admin' || !isActive)

  function validate(): boolean {
    const next: Errors = {}
    if (!user && !EMAIL_PATTERN.test(email.trim().toLowerCase())) next.email = 'Geçerli bir e-posta adresi girin.'
    // Düzenlemede şifre boş bırakılabilir: değişmez.
    if ((!user || password) && password.length < MIN_PASSWORD_LENGTH)
      next.password = `Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalıdır.`
    setErrors(next)
    return Object.keys(next).length === 0
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (save.isPending || !validate()) return
    if (
      losesOwnAdmin &&
      !confirm('Kendi yönetici yetkinizi kaldırıyorsunuz. Bunu kendiniz geri alamazsınız. Devam edilsin mi?')
    )
      return

    if (user) {
      update.mutate(
        { id: user.id, fullName: fullName.trim(), role, isActive, newPassword: password || undefined },
        { onSuccess: onClose },
      )
    } else {
      create.mutate(
        { email: email.trim().toLowerCase(), password, fullName: fullName.trim(), role },
        { onSuccess: onClose },
      )
    }
  }

  return (
    <Modal title={user ? 'Kullanıcıyı düzenle' : 'Yeni kullanıcı'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {user ? (
          <p className="text-sm text-slate-600">{user.email}</p>
        ) : (
          <Field label="E-posta" hint="Kullanıcı bu adresle giriş yapar." error={errors.email}>
            <TextInput
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={255}
              autoComplete="off"
              disabled={save.isPending}
              autoFocus
            />
          </Field>
        )}

        <Field label="Ad Soyad">
          <TextInput
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            maxLength={100}
            disabled={save.isPending}
            autoFocus={!!user}
          />
        </Field>

        <Field
          label={user ? 'Yeni şifre' : 'Şifre'}
          hint={
            user
              ? 'Değiştirmek istemiyorsanız boş bırakın. Değişirse kullanıcı yeniden giriş yapar.'
              : `En az ${MIN_PASSWORD_LENGTH} karakter. Kullanıcıya siz iletirsiniz.`
          }
          error={errors.password}
        >
          <TextInput
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            maxLength={72}
            autoComplete="new-password"
            disabled={save.isPending}
          />
        </Field>

        <Field label="Rol" hint={roleDescriptions[role]}>
          <SelectInput value={role} onChange={(e) => setRole(e.target.value as UserRole)} disabled={save.isPending}>
            {(Object.keys(roleLabels) as UserRole[]).map((r) => (
              <option key={r} value={r}>
                {roleLabels[r]}
              </option>
            ))}
          </SelectInput>
        </Field>

        {user && (
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              disabled={save.isPending}
              className="mt-0.5"
            />
            <span>
              <span className="font-medium text-slate-700">Aktif</span>
              <span className="block text-xs text-slate-500">
                Pasif kullanıcı giriş yapsa bile uygulamayı kullanamaz. Geçmiş kayıtları korunur.
              </span>
            </span>
          </label>
        )}

        {losesOwnAdmin && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Dikkat: kendi yönetici yetkinizi kaldırmak üzeresiniz.
          </p>
        )}

        {save.error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {save.error.message}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
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
