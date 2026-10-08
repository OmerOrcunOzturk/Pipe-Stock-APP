import type { ReactNode } from 'react'

interface FullScreenMessageProps {
  title: string
  description?: string
  children?: ReactNode
}

/** Yükleniyor, yetkisiz, yapılandırma hatası gibi tam ekran durum mesajları. */
export default function FullScreenMessage({ title, description, children }: FullScreenMessageProps) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-lg font-semibold">{title}</h1>
      {description && <p className="max-w-md text-sm text-slate-600">{description}</p>}
      {children}
    </div>
  )
}
