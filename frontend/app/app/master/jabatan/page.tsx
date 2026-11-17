import type { Metadata } from 'next'
import { MasterDataPage } from '@/components/admin/master-data/master-data-page'

export const metadata: Metadata = { title: 'Data Jabatan · HADIRPAY' }

export default function PositionsPage() {
  return <MasterDataPage kind="jabatan" />
}
