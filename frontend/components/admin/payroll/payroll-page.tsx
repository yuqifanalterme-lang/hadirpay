'use client'

import { useEffect, useState } from 'react'
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
import { ROLE_STORAGE_KEY, type Role } from '@/lib/navigation'
import { formatRupiah } from '@/lib/mock-data'
import type { PayrollLine, PayrollPeriod } from '@/lib/mock/payroll'
import { config } from '@/lib/config'
import { accountingDataChangedEvent, notifyAccountingDataChanged } from '@/lib/services/accounting-events'
import {
  cancelPayrollApproval,
  cancelPayrollPayment,
  getPayrollPeriodById,
  listPayrollCashAccountOptions,
  listPayrollLines,
  listPayrollPeriods,
  returnPayrollPeriod,
  updatePayrollStatus,
  type PayrollCashAccountOption,
} from '@/lib/services/penggajian.service'
import type { PeriodeBayarRequest, PeriodeGaji } from '@/lib/types/penggajian'
import { ApiError, type ApiErrorFields } from '@/lib/api/client'

type PayrollAction = 'submit' | 'return' | 'approve' | 'pay' | 'cancel_payment' | 'cancel_approval'
const payrollPageSize = 10

function actionLabel(action: PayrollAction) {
  if (action === 'submit') return 'Kirim ke validasi keuangan'
  if (action === 'return') return 'Kembalikan untuk diperbaiki'
  if (action === 'approve') return 'Setujui penggajian'
  if (action === 'pay') return 'Tandai sebagai dibayar'
  if (action === 'cancel_payment') return 'Batalkan pembayaran'
  return 'Batalkan persetujuan'
}

export function PayrollPage() {
  const [role, setRole] = useState<Role | null>(null)
  const [periods, setPeriods] = useState<PeriodeGaji[]>([])
  const [selectedPeriodId, setSelectedPeriodId] = useState('')
  const [period, setPeriod] = useState<PayrollPeriod | null>(null)
  const [lines, setLines] = useState<PayrollLine[]>([])
  const [linesMeta, setLinesMeta] = useState<{ total: number; total_pages: number } | null>(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detailOpen, setDetailOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState<PayrollAction | null>(null)
  const [cashAccounts, setCashAccounts] = useState<PayrollCashAccountOption[]>([])
  const [cashAccountLoading, setCashAccountLoading] = useState(false)
  const [paymentDate, setPaymentDate] = useState('')
  const [cashAccountId, setCashAccountId] = useState('')
  const [paymentNote, setPaymentNote] = useState('')
  const [returnNote, setReturnNote] = useState('')
  const [cancellationNote, setCancellationNote] = useState('')
  const [cancellationFieldErrors, setCancellationFieldErrors] = useState<ApiErrorFields>({})
  const [busy, setBusy] = useState(false)

  async function load(preferredPeriodId?: string, requestedPage = page) {
    setLoading(true)
    setError('')
    try {
      const nextPeriods = await listPayrollPeriods()
      setPeriods(nextPeriods)
      const requestedId = preferredPeriodId ?? selectedPeriodId
      const selectedPeriod = nextPeriods.find((item) => String(item.id) === requestedId) ?? nextPeriods[0]
      if (!selectedPeriod) {
        setSelectedPeriodId('')
        setPeriod(null)
        setLines([])
        setLinesMeta(null)
        return
      }

      const id = String(selectedPeriod.id)
      setSelectedPeriodId(id)
      const [nextPeriod, nextLines] = await Promise.all([
        getPayrollPeriodById(id),
        listPayrollLines({ page: requestedPage, per_page: payrollPageSize }, id),
      ])
      const totalPages = Math.max(1, nextLines.meta.total_pages)
      if (requestedPage > totalPages) {
        setPage(totalPages)
        return
      }
      setPeriod(nextPeriod)
      setLines(nextLines.items)
      setLinesMeta({ total: nextLines.meta.total, total_pages: totalPages })
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
    if (role === 'admin' || role === 'keuangan' || role === 'pemilik') void load(undefined, page)
    else setLoading(false)
  }, [role, page])

  useEffect(() => {
    if (role !== 'admin' && role !== 'keuangan' && role !== 'pemilik') return
    const refresh = () => { void load(selectedPeriodId, page) }
    window.addEventListener(accountingDataChangedEvent, refresh)
    return () => window.removeEventListener(accountingDataChangedEvent, refresh)
  }, [role, selectedPeriodId, page])

  const totals = {
    net: period?.totalNetPay ?? 0,
    employees: period?.employeeCount ?? 0,
  }

  async function handleAction() {
    if (!role || !pendingAction) return
    if (pendingAction === 'pay' && (!paymentDate || !cashAccountId)) {
      toast.error('Tanggal bayar dan akun kas wajib dipilih.')
      return
    }
    if (pendingAction === 'return' && !returnNote.trim()) {
      toast.error('Catatan pengembalian wajib diisi.')
      return
    }
    if ((pendingAction === 'cancel_payment' || pendingAction === 'cancel_approval') && !cancellationNote.trim()) {
      setCancellationFieldErrors({ catatan: ['Catatan wajib diisi.'] })
      return
    }

    setBusy(true)
    try {
      if (pendingAction === 'return') {
        await returnPayrollPeriod(selectedPeriodId, { catatan: returnNote.trim() })
      } else if (pendingAction === 'cancel_payment') {
        await cancelPayrollPayment(selectedPeriodId, { catatan: cancellationNote.trim() })
        notifyAccountingDataChanged()
      } else if (pendingAction === 'cancel_approval') {
        await cancelPayrollApproval(selectedPeriodId, { catatan: cancellationNote.trim() })
        notifyAccountingDataChanged()
      } else {
        let payment: PeriodeBayarRequest | undefined
        if (pendingAction === 'pay' && !config.mock.penggajian) {
          const accountId = Number(cashAccountId)
          if (!Number.isSafeInteger(accountId) || accountId < 1) {
            toast.error('Akun kas dari API tidak valid.')
            return
          }
          payment = {
            tanggal_bayar: paymentDate,
            akun_kas_id: accountId,
            ...(paymentNote.trim() ? { catatan: paymentNote.trim() } : {}),
          }
        }
        await updatePayrollStatus(role, pendingAction, payment, selectedPeriodId)
      }
      if (pendingAction !== 'cancel_payment' && pendingAction !== 'cancel_approval') {
        await load(selectedPeriodId)
      }
      toast.success('Status proses penggajian berhasil diperbarui.')
      closeAction()
    } catch (actionError) {
      if (
        (pendingAction === 'cancel_payment' || pendingAction === 'cancel_approval') &&
        actionError instanceof ApiError &&
        actionError.status === 422 &&
        actionError.errors
      ) {
        setCancellationFieldErrors(actionError.errors)
      }
      toast.error(actionError instanceof Error ? actionError.message : 'Status penggajian gagal diperbarui.')
    } finally {
      setBusy(false)
    }
  }

  function closeAction() {
    setPendingAction(null)
    setPaymentDate('')
    setCashAccountId('')
    setPaymentNote('')
    setReturnNote('')
    setCancellationNote('')
    setCancellationFieldErrors({})
  }

  async function openAction(action: PayrollAction) {
    if (action === 'pay') {
      setCashAccountLoading(true)
      try {
        setCashAccounts(await listPayrollCashAccountOptions())
      } catch (accountError) {
        toast.error(accountError instanceof Error ? accountError.message : 'Akun kas gagal dimuat.')
        setCashAccountLoading(false)
        return
      }
      setCashAccountLoading(false)
    }
    setPendingAction(action)
  }

  async function handlePeriodChange(id: string) {
    setSelectedPeriodId(id)
    setPage(1)
    setDetailOpen(false)
    await load(id, 1)
  }

  if (loading) return <PageLoadingSkeleton label="daftar penggajian" />
  if (!role || role === 'karyawan') {
    return (
      <EmptyState
        title="Penggajian untuk Admin, Keuangan, dan Pemilik"
        description="Pilih Admin/HRD atau Keuangan untuk mengelola gaji. Pemilik dapat melihat ringkasan."
        icon={FileCheck2}
        action={<Link href="/login" className={buttonVariants({ variant: 'primary', size: 'action' })}>Pilih role</Link>}
      />
    )
  }
  if (error) return <ErrorState message={error} onRetry={() => void load()} />
  if (!period) return <EmptyState title="Periode penggajian belum tersedia" description="Periksa kembali data penggajian." icon={FileCheck2} />

  const actions: PayrollAction[] = []
  if (role === 'admin' && period.status === 'Draft') actions.push('submit')
  if (role === 'keuangan' && period.status === 'Menunggu validasi keuangan') actions.push('return', 'approve')
  if (role === 'keuangan' && period.status === 'Disetujui') actions.push('pay')
  if (role === 'keuangan' && period.status === 'Dibayar') actions.push('cancel_payment')
  if (role === 'keuangan' && period.status === 'Disetujui') actions.push('cancel_approval')
  const fieldClass = 'min-h-12 rounded-xl border border-border bg-white px-3 text-sm focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none'

  return (
    <div className="flex flex-col gap-6">

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-heading">Penggajian</h2>
          <p className="mt-1 text-sm text-muted-foreground">Tinjau total periode dan lanjutkan persetujuan sesuai peran.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex min-w-56 flex-col gap-2 text-sm font-semibold text-heading">
            Periode penggajian
            <select
              value={selectedPeriodId}
              onChange={(event) => void handlePeriodChange(event.target.value)}
              className={fieldClass}
            >
              {periods.map((item) => (
                <option key={item.id} value={item.id}>{item.label ?? item.periode}</option>
              ))}
            </select>
          </label>
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
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Total gaji bersih" value={formatRupiah(totals.net)} hint="Nilai periode pada dashboard admin" icon={CircleDollarSign} tone="blue" />
        <StatCard
          label="Karyawan dalam periode"
          value={String(totals.employees)}
          hint={period.isMock
            ? `${lines.filter((line) => !line.isAggregate).length} rincian individu, sisanya agregat`
            : `${linesMeta?.total ?? 0} rincian individu`}
          icon={Users}
          tone="green"
        />
        <StatCard label="Periode" value={period.period} hint={`Tutup periode ${period.cutoffDate}`} icon={BadgeCheck} tone="amber" />
      </div>

      <Panel title="Periode penggajian" description="Status mengikuti urutan pemeriksaan HRD, validasi Keuangan, lalu pembayaran.">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <StatIcon icon={FileCheck2} tone="primary" size="md" />
              <div className="min-w-0">
                <p className="font-semibold text-heading">{period.period}</p>
                <p className="text-sm text-muted-foreground">{period.employeeCount} karyawan · tutup {period.cutoffDate}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge status={period.status} />
              {lines.length > 0 && (
                <Button type="button" variant="outline" size="action" onClick={() => setDetailOpen(true)}>Lihat rincian</Button>
              )}
              {actions.map((action) => (
                <Button
                  key={action}
                  type="button"
                  variant={action === 'pay' ? 'success' : action === 'return' || action.startsWith('cancel_') ? 'outline' : 'primary'}
                  size="action"
                  disabled={cashAccountLoading}
                  onClick={() => void openAction(action)}
                >
                  {action === 'pay' && cashAccountLoading ? 'Memuat akun kas…' : actionLabel(action)}
                </Button>
              ))}
            </div>
          </div>
          {lines.length > 0
            ? <p className="text-right text-lg font-bold tabular-nums text-heading">{formatRupiah(totals.net)}</p>
            : <EmptyState title="Rincian penggajian belum tersedia" description="Data periode ini belum memiliki rincian untuk ditampilkan." icon={FileCheck2} />}
        </div>
      </Panel>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen} label={`Rincian penggajian ${period.period}`} size="drawer">
        <DialogHeader
          title={`Rincian ${period.period}`}
          description={period.isMock ? 'Rincian individu dan agregat karyawan lain.' : undefined}
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
                <dd className="font-medium tabular-nums">{line.isAggregate ? 'Agregat' : formatRupiah(line.totalEarnings ?? line.netPay)}</dd>
                <dt className="text-muted-foreground">Potongan</dt>
                <dd className="font-medium tabular-nums">{line.isAggregate ? 'Agregat' : formatRupiah(line.totalDeductions)}</dd>
                <dt className="font-semibold text-heading">Gaji bersih</dt>
                <dd className="font-bold tabular-nums text-heading">{formatRupiah(line.netPay)}</dd>
              </dl>
            </div>
          ))}
          <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground" aria-live="polite">
              Menampilkan {linesMeta?.total ? (page - 1) * payrollPageSize + 1 : 0} sampai {Math.min(page * payrollPageSize, linesMeta?.total ?? 0)} dari {linesMeta?.total ?? 0} karyawan.
              {' '}Halaman {page} dari {Math.max(1, linesMeta?.total_pages ?? 1)}
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="action" disabled={page <= 1 || loading} onClick={() => setPage((current) => Math.max(1, current - 1))}>Sebelumnya</Button>
              <Button type="button" variant="outline" size="action" disabled={page >= (linesMeta?.total_pages ?? 1) || loading} onClick={() => setPage((current) => Math.min(linesMeta?.total_pages ?? 1, current + 1))}>Berikutnya</Button>
            </div>
          </div>
          <p className="text-right text-lg font-bold text-heading">Total: {formatRupiah(totals.net)}</p>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" size="action" onClick={() => setDetailOpen(false)}>Tutup rincian</Button>
        </DialogFooter>
      </Dialog>

      <Dialog open={pendingAction !== null} onOpenChange={(open) => !open && closeAction()} label="Konfirmasi perubahan status penggajian">
        <form onSubmit={(event) => { event.preventDefault(); void handleAction() }}>
          <DialogHeader
            title={pendingAction === 'pay' ? 'Konfirmasi pembayaran' : pendingAction === 'return' ? 'Kembalikan periode' : pendingAction === 'cancel_payment' ? 'Batalkan pembayaran' : pendingAction === 'cancel_approval' ? 'Batalkan persetujuan' : 'Konfirmasi status penggajian'}
            description={
              pendingAction === 'pay'
                ? `Tandai ${period.period} sebesar ${formatRupiah(totals.net)} sebagai sudah dibayar?`
                : pendingAction === 'return'
                  ? `Kembalikan periode ${period.period} untuk diperbaiki.`
                  : pendingAction === 'cancel_payment' || pendingAction === 'cancel_approval'
                    ? `${actionLabel(pendingAction)} untuk periode ${period.period}?`
                  : `${actionLabel(pendingAction ?? 'submit')} untuk periode ${period.period}?`
            }
            onClose={closeAction}
          />
          {(pendingAction === 'pay' || pendingAction === 'return' || pendingAction === 'cancel_payment' || pendingAction === 'cancel_approval') && (
            <div className="flex flex-col gap-4 p-5 sm:p-6">
              {pendingAction === 'pay' ? (
                <>
                  <label className="flex flex-col gap-2 text-sm font-semibold text-heading">
                    Tanggal bayar
                    <input type="date" required value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} className={fieldClass} />
                  </label>
                  <label className="flex flex-col gap-2 text-sm font-semibold text-heading">
                    Akun kas
                    <select required value={cashAccountId} onChange={(event) => setCashAccountId(event.target.value)} className={fieldClass}>
                      <option value="">Pilih akun kas</option>
                      {cashAccounts.map((account) => (
                        <option key={account.id} value={account.id}>{account.code} · {account.name}</option>
                      ))}
                    </select>
                  </label>
                  {!cashAccounts.length && <p className="text-sm text-muted-foreground">Tidak ada akun kas kategori aset yang tersedia.</p>}
                  <label className="flex flex-col gap-2 text-sm font-semibold text-heading">
                    Catatan
                    <textarea value={paymentNote} onChange={(event) => setPaymentNote(event.target.value)} className={`${fieldClass} min-h-24 py-3`} />
                  </label>
                </>
              ) : pendingAction === 'return' ? (
                <label className="flex flex-col gap-2 text-sm font-semibold text-heading">
                  Catatan pengembalian
                  <textarea required value={returnNote} onChange={(event) => setReturnNote(event.target.value)} className={`${fieldClass} min-h-24 py-3`} />
                </label>
              ) : (
                <label className="flex flex-col gap-2 text-sm font-semibold text-heading">
                  Catatan
                  <textarea
                    required
                    value={cancellationNote}
                    onChange={(event) => {
                      setCancellationNote(event.target.value)
                      setCancellationFieldErrors((current) => ({ ...current, catatan: [] }))
                    }}
                    aria-invalid={Boolean(cancellationFieldErrors.catatan?.length)}
                    aria-describedby={cancellationFieldErrors.catatan?.length ? 'payroll-cancellation-note-error' : undefined}
                    className={`${fieldClass} min-h-24 py-3`}
                  />
                  {cancellationFieldErrors.catatan?.[0] && <span id="payroll-cancellation-note-error" className="text-sm font-medium text-destructive" role="alert">{cancellationFieldErrors.catatan[0]}</span>}
                </label>
              )}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" size="action" onClick={closeAction}>Batal</Button>
            <Button
              type="submit"
              variant={pendingAction === 'pay' ? 'success' : 'primary'}
              size="action"
              disabled={busy || (pendingAction === 'pay' && !cashAccounts.length)}
            >
              {busy ? 'Memproses…' : pendingAction ? actionLabel(pendingAction) : 'Konfirmasi'}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  )
}
