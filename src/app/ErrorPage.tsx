import { isRouteErrorResponse, Link, useRouteError } from 'react-router'

export default function ErrorPage() {
  const error = useRouteError()
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : 'Bilinmeyen bir hata oluştu.'

  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-xl font-semibold">Bir hata oluştu</h1>
      <p className="max-w-md text-sm text-slate-600">{message}</p>
      <Link to="/" className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white">
        Ana sayfaya dön
      </Link>
    </div>
  )
}
