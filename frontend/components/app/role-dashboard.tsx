'use client'

import Link from 'next/link'
import { House } from 'lucide-react'
import { AdminDashboard } from '@/components/admin/admin-dashboard'
import { FinanceDashboard } from '@/components/admin/finance-dashboard'
import { OwnerDashboard } from '@/components/admin/owner-dashboard'
import { buttonVariants } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { PageLoadingSkeleton } from '@/components/ui/page-loading-skeleton'
import { useAccountingRole } from '@/lib/hooks/use-accounting-role'

export function RoleDashboard() {
  const role = useAccountingRole()

  if (role === undefined) return <PageLoadingSkeleton label="dashboard" />
  if (role === 'keuangan') return <FinanceDashboard />
  if (role === 'pemilik') return <OwnerDashboard />
  if (role === 'karyawan') {
    return (
      <EmptyState
        title="Beranda karyawan"
        description="Gunakan beranda karyawan untuk melihat kehadiran dan informasi pribadi."
        icon={House}
        action={<Link href="/app/beranda" className={buttonVariants({ variant: 'primary', size: 'action' })}>Buka beranda</Link>}
      />
    )
  }
  return <AdminDashboard />
}
