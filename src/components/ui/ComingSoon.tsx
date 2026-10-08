interface ComingSoonProps {
  stage: string
}

/** Henüz geliştirilmemiş sayfalar için yer tutucu. */
export default function ComingSoon({ stage }: ComingSoonProps) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
      Bu bölüm {stage} kapsamında geliştirilecek.
    </div>
  )
}
