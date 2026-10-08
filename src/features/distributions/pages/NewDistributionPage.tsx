import PageHeader from '@/components/ui/PageHeader'
import DistributionForm from '../components/DistributionForm'

export default function NewDistributionPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Yeni Dağıtım" description="Köye verilen boruları adet olarak girin; stok otomatik düşer." />
      <DistributionForm />
    </div>
  )
}
