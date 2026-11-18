'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, BadgeCheck, CircleDollarSign, FileCheck2, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Panel } from '@/components/hadirpay/panel'
import { StatCard } from '@/components/hadirpay/stat-card'
import { StatusBadge } from '@/components/hadirpay/status-badge'
import { StatIcon } from '@/components/ui/stat-icon'
import { Avatar } from '@/components/ui/avatar'
import { Button, buttonVariants } from '@/components/ui/button'
import { Dialog, DialogFooter, DialogHeader } from '@/components/ui/dialog'
import { EmptyState, ErrorState } from '@/components/ui/empty-state'
import { PageLoadingSkeleton } from '@/components/ui/page-loading-skeleton'
import { DemoDataNotice } from '@/components/ui/demo-data-notice'
import { ROLE_STORAGE_KEY, type Role } from '@/lib/navigation'
import { formatRupiah } from '@/lib/mock-data'
import type { PayrollLine, PayrollPeriod } from '@/lib/mock/payroll'
import { getPayrollPeriod, listPayrollLines, updatePayrollStatus } from '@/lib/services/payroll-service'

type PayrollAction = 'submit' | 'approve' | 'pay'

function actionLabel(action: PayrollAction) {
  if (action === 'submit') return 'Kirim ke validasi keuangan'
  if (action === 'approve') return 'Setujui penggajian'
  return 'Tandai sebagai dibayar'
}

export function PayrollPage() {
  const [role, setRole] = useState<Role | null>(null)
  const [period, setPeriod] = useState<PayrollPeriod | null>(null)
  const [lines, setLines] = useState<PayrollLine[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detailOpen, setDetailOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState<PayrollAction | null>(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [nextPeriod, nextLines] = await Promise.all([getPayrollPeriod(), listPayrollLines()])
      setPeriod(nextPeriod)
      setLines(nextLines)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Data penggajian gagal dimuat.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const storedRole = localStorage.getItem(ROLE_STORAGE_KEY)
    setRole(storedRole === 'admin' || storedRole === 'keuangan' || storedRole === 'karyawan' || storedRole === 'pemilik' ? storedRole : null)
  }, [])

  useEffect(() => {
    if (role === 'admin' || role === 'keuangan' || role === 'pemilik') void load()
    else setLoading(false)
  }, [role])

  const totals = useMemo(() => ({
    net: lines.reduce((sum, line) => sum + line.netPay, 0),
    employees: lines.reduce((sum, line) => sum + line.employeeCount, 0),
  }), [lines])

  async function handleAction() {
    if (!role || !pendingAction) return
    setBusy(true)
    try {
      const updated = await updatePayrollStatus(role, pendingAction)
      setPeriod(updated)
      toast.success(`Status penggajian berubah menjadi ${updated.status}.`)
      setPendingAction(null)
    } catch (actionError) {
      toast.error(actionError instanceof Error ? actionError.message : 'Status penggajian gagal diperbarui.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <PageLoadingSkeleton label="daftar penggajian" />
  if (!role || role === 'karyawan') {
    return (
      <EmptyState
        title="Penggajian untuk Admin, Keuangan, dan Pemilik"
        description="Pilih mode demo Admin/HRD atau Keuangan untuk mengelola gaji. Pemilik dapat melihat ringkasan."
        icon={FileCheck2}
        action={<Link href="/login" className={buttonVariants({ variant: 'primary', size: 'action' })}>Pilih mode demo</Link>}
      />
    )
  }
  if (error) return <ErrorState message={error} onRetry={() => void load()} />
  if (!period) return <EmptyState title="Periode penggajian belum tersedia" description="Periksa kembali data demo penggajian." icon={FileCheck2} />

  const action: PayrollAction | null =
    role === 'admin' && period.status === 'Draft'
      ? 'submit'
      : role === 'keuangan' && period.status === 'Menunggu validasi keuangan'
        ? 'approve'
        : role === 'keuangan' && period.status === 'Disetujui'
          ? 'pay'
          : null

  return (
    <div className="flex flex-col gap-6">
      <DemoDataNotice>
        Periode November 2026 memakai data contoh. Rincian tersedia untuk 9 karyawan aktif, sedangkan 39 karyawan lain ditampilkan sebagai agregat agar total sama dengan dashboard.
      </DemoDataNotice>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-heading">Penggajian</h2>
          <p className="mt-1 text-sm text-muted-foreground">Tinjau total periode dan lanjutkan persetujuan sesuai peran.</p>
        </div>
        {(role === 'admin' || role === 'keuangan') && (
          <div className="flex flex-wrap gap-3">
            <Link href="/app/penggajian/komponen" className={buttonVariants({ variant: 'outline', size: 'action', className: 'bg-white' })}>
              Komponen gaji
            </Link>
            <Link href="/app/penggajian/proses" className={buttonVariants({ variant: 'primary', size: 'action' })}>
              Buka proses penggajian
              <ArrowRight aria-hidden="true" />
            </Link>
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Total gaji bersih" value={formatRupiah(totals.net)} hint="Nilai periode pada dashboard admin" icon={CircleDollarSign} tone="blue" />
        <StatCard label="Karyawan dalam periode" value={String(totals.employees)} hint={`${lines.filter((line) => !line.isAggregate).length} rincian individu, sisanya agregat`} icon={Users} tone="green" />
        <StatCard label="Periode" value={period.period} hint={`Tutup periode ${period.cutoffDate}`} icon={BadgeCheck} tone="amber" />
      </div>

      <Panel title="Periode penggajian" description="Status mengikuti urutan pemeriksaan HRD, validasi Keuangan, lalu pembayaran.">
        {!lines.length ? (
          <EmptyState title="Rincian penggajian belum tersedia" description="Data periode ini belum memiliki rincian untuk ditampilkan." icon={FileCheck2} />
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <StatIcon icon={FileCheck2} tone="primary" size="md" />
                <div className="min-w-0">
                  <p className="font-semibold text-heading">{period.period}</p>
                  <p className="text-sm text-muted-foreground">48 karyawan · tutup {period.cutoffDate}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge status={period.status} />
                <Button type="button" variant="outline" size="action" onClick={() => setDetailOpen(true)}>Lihat rincian</Button>
                {action && (
                  <Button type="button" variant={action === 'pay' ? 'success' : 'primary'} size="action" onClick={() => setPendingAction(action)}>
                    {actionLabel(action)}
                  </Button>
                )}
              </div>
            </div>
            <p className="text-right text-lg font-bold tabular-nums text-heading">{formatRupiah(totals.net)}</p>
          </div>
        )}
      </Panel>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen} label={`Rincian penggajian ${period.period}`} size="drawer">
        <DialogHeader
          title={`Rincian ${period.period}`}
          description="Rincian individu demo dan agregat karyawan lain."
          onClose={() => setDetailOpen(false)}
        />
        <div className="flex flex-col gap-4 p-5 sm:p-6">
          {lines.map((line) => (
            <div key={line.employeeId} className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar initials={line.initials} tone={line.isAggregate ? 'muted' : 'outlined'} />
                <div className="min-w-0">
                  <p className="font-semibold text-heading">{line.employeeName}</p>
                  <p className="text-sm text-muted-foreground">{line.position} · {line.department}</p>
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:text-right">
                <dt className="text-muted-foreground">Pendapatan</dt>
                <dd className="font-medium tabular-nums">{line.isAggregate ? 'Agregat' : formatRupiah(line.baseSalary + line.fixedAllowance + line.overtimePay)}</dd>
                <dt className="text-muted-foreground">Potongan</dt>
                <dd className="font-medium tabular-nums">{line.isAggregate ? 'Agregat' : formatRupiah(line.totalDeductions)}</dd>
                <dt className="font-semibold text-heading">Gaji bersih</dt>
                <dd className="font-bold tabular-nums text-heading">{formatRupiah(line.netPay)}</dd>
              </dl>
            </div>
          ))}
          <p className="text-right text-lg font-bold text-heading">Total: {formatRupiah(totals.net)}</p>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" size="action" onClick={() => setDetailOpen(false)}>Tutup rincian</Button>
        </DialogFooter>
      </Dialog>

      <Dialog open={pendingAction !== null} onOpenChange={(open) => !open && setPendingAction(null)} label="Konfirmasi perubahan status penggajian">
        <DialogHeader
          title={pendingAction === 'pay' ? 'Konfirmasi pembayaran' : 'Konfirmasi status penggajian'}
          description={
            pendingAction === 'pay'
              ? `Tandai ${period.period} sebesar ${formatRupiah(totals.net)} sebagai sudah dibayar?`
              : `${actionLabel(pendingAction ?? 'submit')} untuk periode ${period.period}?`
          }
          onClose={() => setPendingAction(null)}
        />
        <DialogFooter>
          <Button type="button" variant="outline" size="action" onClick={() => setPendingAction(null)}>Batal</Button>
          <Button type="button" variant={pendingAction === 'pay' ? 'success' : 'primary'} size="action" disabled={busy} onClick={() => void handleAction()}>
            {busy ? 'Memproses…' : pendingAction ? actionLabel(pendingAction) : 'Konfirmasi'}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}
