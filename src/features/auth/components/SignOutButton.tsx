import { LogOut } from 'lucide-react'
import { useState } from 'react'
import { signOut } from '../api'

interface SignOutButtonProps {
  /** icon: sadece ikon (mobil başlık), link: menü satırı, button: dolu buton */
  variant: 'icon' | 'link' | 'button'
}

export default function SignOutButton({ variant }: SignOutButtonProps) {
  const [isPending, setIsPending] = useState(false)

  async function handleClick() {
    setIsPending(true)
    try {
      await signOut()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Çıkış yapılamadı.')
      setIsPending(false)
    }
  }

  const styles = {
    icon: 'rounded-lg p-2 text-slate-500 hover:bg-slate-100',
    link: 'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100',
    button:
      'flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700',
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className={`${styles[variant]} disabled:opacity-50`}
      aria-label="Çıkış yap"
    >
      <LogOut className="size-5" aria-hidden />
      {variant !== 'icon' && 'Çıkış yap'}
    </button>
  )
}
