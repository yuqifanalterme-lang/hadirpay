'use client'

import { useEffect, useState } from 'react'
import { BookOpenText } from 'lucide-react'
import { Panel } from '@/components/hadirpay/panel'
import { StatCard } from '@/components/hadirpay/stat-card'
import { Avatar } from '@/components/ui/avatar'
import { DemoDataNotice } from '@/components/ui/demo-data-notice'
import { EmptyState, ErrorState } from '@/components/ui/empty-state'
import { PageLoadingSkeleton } from '@/components/ui/page-loading-skeleton'
import { AccountingAccess, AccountingPageTitle } from './accounting-shared'
import { useAccountingRole } from '@/lib/hooks/use-accounting-role'
import type { AccountingAccount } from '@/lib/mock/accounting'
import { listAccounts } from '@/lib/services/accounting-service'

function accountInitials(name: string) {
  return name.split(/[\s/]+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()
}

export function AccountsPage() {
  const role = useAccountingRole()
  const [accounts, setAccounts] = useState<AccountingAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      setAccounts(await listAccounts())
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Data akun gagal dimuat.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (role === 'admin' || role === 'keuangan' || role === 'pemilik') void load()
    else if (role === 'karyawan' || role === null) setLoading(false)
  }, [role])

  return (
    <AccountingAccess role={role}>
      {loading ? <PageLoadingSkeleton label="data akun" /> : error ? <ErrorState message={error} onRetry={() => void load()} /> : (
        <div className="flex flex-col gap-6">
          <DemoDataNotice>Bagan akun seed mode demo. Saldo aktual akan muncul setelah transaksi dijurnal.</DemoDataNotice>
          <AccountingPageTitle
            title="Data akun"
            description="Bagan akun yang digunakan untuk jurnal penggajian dan pencatatan manual."
          />
          <StatCard label="Akun tersedia" value={String(accounts.length)} hint="Akun seed untuk demo akuntansi" icon={BookOpenText} tone="blue" />
          <Panel title="Bagan akun" description="Kode, kategori, dan saldo normal setiap akun.">
            {accounts.length === 0 ? (
              <EmptyState title="Belum ada akun" description="Bagan akun belum memiliki data seed." icon={BookOpenText} />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                  <caption className="sr-only">Bagan akun akuntansi demo</caption>
                  <thead className="bg-surface text-xs font-semibold uppercase text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-4 py-3">Kode</th>
                      <th scope="col" className="px-4 py-3">Nama akun</th>
                      <th scope="col" className="px-4 py-3">Kategori</th>
                      <th scope="col" className="px-4 py-3">Saldo normal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {accounts.map((account) => (
                      <tr key={account.code} className="hover:bg-surface/70">
                        <td className="px-4 py-3 font-semibold tabular-nums text-heading">{account.code}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar initials={accountInitials(account.name)} tone="outlined" />
                            <span className="font-semibold text-heading">{account.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">{account.category}</td>
                        <td className="px-4 py-3">{account.normalBalance}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>
      )}
    </AccountingAccess>
  )
}
