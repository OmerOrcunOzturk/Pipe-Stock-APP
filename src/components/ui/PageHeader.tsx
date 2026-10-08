interface PageHeaderProps {
  title: string
  description?: string
}

export default function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <div className="mb-6">
      <h1 className="text-xl font-semibold md:text-2xl">{title}</h1>
      {description && <p className="mt-1 text-sm text-slate-600">{description}</p>}
    </div>
  )
}
