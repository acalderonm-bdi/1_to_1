import { PageSkeleton } from '@/components/shared/page-skeleton'

export default function Loading() {
  return <PageSkeleton variant="dashboard" kpiCount={4} rowCount={5} />
}
