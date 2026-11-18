import type { Metadata } from 'next'
import { RoleDashboard } from '@/components/app/role-dashboard'

export const metadata: Metadata = { title: 'Dashboard · HADIRPAY' }

export default function DashboardPage() {
  return <RoleDashboard />
}
