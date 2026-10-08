import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router'
import FullScreenMessage from '@/components/ui/FullScreenMessage'
import { signIn } from '../api'
import { useAuth } from '../authContext'

export default function LoginPage() {
  const { isLoading, session } = useAuth()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (isLoading) return <FullScreenMessage title="Yükleniyor…" />
  // Oturum açıldığında (veya zaten açıksa) istenen sayfaya yönlendir.
  if (session) return <Navigate to={from} replace />

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      await signIn(email.trim(), password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Giriş yapılamadı.')
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div>
          <h1 className="text-xl font-semibold text-blue-800">Boru Stok</h1>
          <p className="mt-1 text-sm text-slate-600">Devam etmek için giriş yapın.</p>
        </div>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">E-posta</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-base focus:border-blue-600 focus:ring-2 focus:ring-blue-200 focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">Şifre</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-base focus:border-blue-600 focus:ring-2 focus:ring-blue-200 focus:outline-none"
          />
        </label>

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
        >
          {isSubmitting ? 'Giriş yapılıyor…' : 'Giriş yap'}
        </button>
      </form>
    </div>
  )
}
