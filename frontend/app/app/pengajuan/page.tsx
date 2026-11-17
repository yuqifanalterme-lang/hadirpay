import type { Metadata } from 'next'
import { RequestsRolePage } from '@/components/app/requests-role-page'

export const metadata: Metadata = { title: 'Pengajuan · HADIRPAY' }

export default function RequestsRoute() {
  return <RequestsRolePage />
}
