'use client'

import Link from 'next/link'
import { BookOpenText } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { PageLoadingSkeleton } from '@/components/ui/page-loading-skeleton'
import type { Role } from '@/lib/navigation'

export function AccountingAccess({
  role,
  children,
}: {
  role: Role | null | undefined
  children: React.ReactNode
}) {
  if (role === undefined) return <PageLoadingSkeleton label="akses akuntansi" />
  if (role !== 'admin' && role !== 'keuangan' && role !== 'pemilik') {
    return (
      <EmptyState
        title="Akuntansi hanya untuk Admin, Keuangan, dan Pemilik"
        description="Pilih salah satu role tersebut untuk membuka data akuntansi."
        icon={BookOpenText}
        action={<Link href="/login" className={buttonVariants({ variant: 'primary', size: 'action' })}>Pilih role</Link>}
      />
    )
  }
  return children
}

export function AccountingPageTitle({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-xl font-bold text-heading">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  )
}
