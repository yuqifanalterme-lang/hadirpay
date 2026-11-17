import type { Metadata } from 'next'
import { MasterDataPage } from '@/components/admin/master-data/master-data-page'

export const metadata: Metadata = { title: 'Data Departemen · HADIRPAY' }

export default function DepartmentsPage() {
  return <MasterDataPage kind="departemen" />
}
