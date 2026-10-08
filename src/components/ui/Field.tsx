import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

const controlClass =
  'mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base focus:border-blue-600 focus:ring-2 focus:ring-blue-200 focus:outline-none disabled:bg-slate-100 md:text-sm'

interface FieldProps {
  label: string
  hint?: string
  error?: string
  children: ReactNode
}

/** Etiket + kontrol + ipucu/hata satırı. */
export function Field({ label, hint, error, children }: FieldProps) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs text-red-600">{error}</span>
      ) : (
        hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>
      )}
    </label>
  )
}

export function TextInput({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${controlClass} ${className}`} {...props} />
}

export function SelectInput({ className = '', ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`${controlClass} ${className}`} {...props} />
}

export function TextArea({ className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${controlClass} ${className}`} {...props} />
}
