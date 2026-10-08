import { Link } from 'react-router'
import PageHeader from '@/components/ui/PageHeader'

export default function NotFoundPage() {
  return (
    <>
      <PageHeader title="Sayfa bulunamadı" />
      <Link to="/" className="text-sm font-medium text-blue-700 underline">
        Ana sayfaya dön
      </Link>
    </>
  )
}
