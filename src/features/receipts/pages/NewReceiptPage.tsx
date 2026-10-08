import PageHeader from '@/components/ui/PageHeader'
import ReceiptForm from '../components/ReceiptForm'

export default function NewReceiptPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Yeni Stok Girişi" description="Gelen boruları adet olarak girin; metre otomatik hesaplanır." />
      <ReceiptForm />
    </div>
  )
}
