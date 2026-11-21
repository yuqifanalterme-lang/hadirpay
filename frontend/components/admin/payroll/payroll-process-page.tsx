'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, BadgeCheck, CalendarDays, Clock3, FileCheck2, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Panel } from '@/components/hadirpay/panel'
import { StatCard } from '@/components/hadirpay/stat-card'
import { StatusBadge } from '@/components/hadirpay/status-badge'
import { Avatar } from '@/components/ui/avatar'
import { Button, buttonVariants } from '@/components/ui/button'
import { Dialog, DialogFooter, DialogHeader } from '@/components/ui/dialog'
import { EmptyState, ErrorState } from '@/components/ui/empty-state'
import { PageLoadingSkeleton } from '@/components/ui/page-loading-skeleton'
import { DemoDataNotice } from '@/components/ui/demo-data-notice'
import { ROLE_STORAGE_KEY, type Role } from '@/lib/navigation'
import { formatRupiah } from '@/lib/mock-data'
import { payrollPeriodId, type PayrollLine, type PayrollPeriod } from '@/lib/mock/payroll'
import { config } from '@/lib/config'
import { listPayrollCashAccounts } from '@/lib/services/akuntansi.service'
import {
  calculatePayrollPeriod,
  createPayrollPeriod,
  getPayrollAttendanceReview,
  getPayrollPeriod,
  getPayrollPeriodDetail,
  listPayrollLines,
  listPayrollPeriods,
  returnPayrollPeriod,
  updatePayrollStatus,
} from '@/lib/services/penggajian.service'
import type { PeriodeBayarRequest, PeriodeGaji, PeriodeRekapAbsensi } from '@/lib/types/penggajian'
import type { Akun } from '@/lib/types/akuntansi'

const payrollPageSize = 10
const steps = ['Pilih periode', 'Tinjau absensi', 'Hasil perhitungan', 'Persetujuan']
type PayrollAction = 'submit' | 'approve' | 'pay'

function actionLabel(action: PayrollAction) {
  if (action === 'submit') return 'Kirim ke validasi keuangan'
  if (action === 'approve') return 'Setujui penggajian'
  return 'Tandai sebagai dibayar'
}

function periodStatusLabel(status: PeriodeGaji['status']): PayrollPeriod['status'] {
  if (status === 'draft') return 'Draft'
  if (status === 'menunggu_validasi') return 'Menunggu validasi keuangan'
  return status === 'disetujui' ? 'Disetujui' : 'Dibayar'
}

export function PayrollProcessPage() {
  return <DemoPayrollProcessPage />
}

function DemoPayrollProcessPage() {
  const [role, setRole] = useState<Role | null>(null)
  const [period, setPeriod] = useState<PayrollPeriod | null>(null)
  const [periodInput, setPeriodInput] = useState(payrollPeriodId)
  const [lines, setLines] = useState<PayrollLine[]>([])
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pendingAction, setPendingAction] = useState<PayrollAction | null>(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [nextPeriod, nextLines] = await Promise.all([getPayrollPeriod(), listPayrollLines()])
      setPeriod(nextPeriod)
      setLines(nextLines.items)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Proses penggajian gagal dimuat.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const storedRole = localStorage.getItem(ROLE_STORAGE_KEY)
    setRole(storedRole === 'admin' || storedRole === 'keuangan' || storedRole === 'karyawan' ? storedRole : null)
  }, [])

  useEffect(() => {
    if (config.mock.penggajian && (role === 'admin' || role === 'keuangan')) void load()
    else setLoading(false)
  }, [role])

  if (!config.mock.penggajian) return <LivePayrollProcessPage />

  const detailedLines = lines.filter((line) => !line.isAggregate)
  const totals = useMemo(() => ({
    net: period?.totalNetPay ?? 0,
    late: detailedLines.reduce((sum, line) => sum + line.lateCount, 0),
    absent: detailedLines.reduce((sum, line) => sum + line.absenceDays, 0),
    present: detailedLines.reduce((sum, line) => sum + line.presentDays, 0),
    overtimeHours: detailedLines.reduce((sum, line) => sum + line.overtimeHours, 0),
  }), [lines])

  async function handleAction() {
    if (!role || !pendingAction) return
    setBusy(true)
    try {
      setPeriod(await updatePayrollStatus(role, pendingAction))
      toast.success('Status proses penggajian berhasil diperbarui.')
      setPendingAction(null)
    } catch (actionError) {
      toast.error(actionError instanceof Error ? actionError.message : 'Status penggajian gagal diperbarui.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <PageLoadingSkeleton label="proses penggajian" />
  if (!role || role === 'karyawan') {
    return (
      <EmptyState
        title="Proses ini untuk Admin/HRD dan Keuangan"
        description="Masuk dengan mode demo Admin/HRD atau Keuangan untuk melanjutkan proses."
        icon={FileCheck2}
        action={<Link href="/login" className={buttonVariants({ variant: 'primary', size: 'action' })}>Pilih mode demo</Link>}
      />
    )
  }

  function LivePayrollProcessPage() {
    const [role, setRole] = useState<Role | null>(null)
    const [periods, setPeriods] = useState<PeriodeGaji[]>([])
    const [selectedId, setSelectedId] = useState('')
    const [detail, setDetail] = useState<Awaited<ReturnType<typeof getPayrollPeriodDetail>> | null>(null)
    const [attendance, setAttendance] = useState<PeriodeRekapAbsensi | null>(null)
    const [calculation, setCalculation] = useState<Awaited<ReturnType<typeof calculatePayrollPeriod>> | null>(null)
    const [lines, setLines] = useState<PayrollLine[]>([])
    const [linesMeta, setLinesMeta] = useState<{ total: number; total_pages: number } | null>(null)
    const [linePage, setLinePage] = useState(1)
    const [linePageLoading, setLinePageLoading] = useState(false)
    const [cashAccounts, setCashAccounts] = useState<Akun[]>([])
    const [step, setStep] = useState(0)
    const [periodValue, setPeriodValue] = useState('')
    const [cutoffDate, setCutoffDate] = useState('')
    const [paymentDate, setPaymentDate] = useState('')
    const [cashAccountId, setCashAccountId] = useState('')
    const [returnNote, setReturnNote] = useState('')
    const [loading, setLoading] = useState(true)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')

    async function loadSelected(id: string) {
      const [nextDetail, nextAttendance] = await Promise.all([
        getPayrollPeriodDetail(id),
        getPayrollAttendanceReview(id),
      ])
      setDetail(nextDetail)
      setAttendance(nextAttendance)
      setCalculation(null)
      setLines([])
      setLinesMeta(null)
      setLinePage(1)
    }

    async function load() {
      setLoading(true)
      setError('')
      try {
        const [nextPeriods, nextCashAccounts] = await Promise.all([
          listPayrollPeriods(),
          listPayrollCashAccounts(),
        ])
        setPeriods(nextPeriods)
        setCashAccounts(nextCashAccounts)
        const nextSelected = nextPeriods.find((item) => String(item.id) === selectedId) ?? nextPeriods[0]
        if (nextSelected) {
          setSelectedId(String(nextSelected.id))
          await loadSelected(String(nextSelected.id))
        } else {
          setSelectedId('')
          setDetail(null)
          setAttendance(null)
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Proses penggajian gagal dimuat.')
      } finally {
        setLoading(false)
      }
    }

    useEffect(() => {
      const storedRole = localStorage.getItem(ROLE_STORAGE_KEY)
      setRole(storedRole === 'admin' || storedRole === 'keuangan' ? storedRole : null)
    }, [])

    useEffect(() => {
      if (role === 'admin' || role === 'keuangan') void load()
      else if (role !== null) setLoading(false)
    }, [role])

    async function handleSelectPeriod(id: string) {
      setSelectedId(id)
      setLinePage(1)
      setStep(0)
      setLoading(true)
      setError('')
      try {
        await loadSelected(id)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Periode penggajian gagal dimuat.')
      } finally {
        setLoading(false)
      }
    }

    async function handleCreatePeriod(event: React.FormEvent<HTMLFormElement>) {
      event.preventDefault()
      setBusy(true)
      try {
        const created = await createPayrollPeriod({ periode: periodValue, tanggal_tutup: cutoffDate })
        const nextPeriods = await listPayrollPeriods()
        setPeriods(nextPeriods)
        setSelectedId(String(created.id))
        await loadSelected(String(created.id))
        setPeriodValue('')
        setCutoffDate('')
        toast.success('Periode penggajian berhasil dibuat.')
      } catch (createError) {
        toast.error(createError instanceof Error ? createError.message : 'Periode penggajian gagal dibuat.')
      } finally {
        setBusy(false)
      }
    }

    async function handleCalculate() {
      if (!selectedId) return
      setBusy(true)
      try {
        const result = await calculatePayrollPeriod(selectedId)
        const nextLines = await listPayrollLines({ page: 1, per_page: payrollPageSize }, selectedId)
        setCalculation(result)
        setLines(nextLines.items)
        setLinesMeta({ total: nextLines.meta.total, total_pages: nextLines.meta.total_pages })
        setLinePage(1)
        toast.success('Penggajian berhasil dihitung oleh server.')
      } catch (calculateError) {
        toast.error(calculateError instanceof Error ? calculateError.message : 'Penggajian gagal dihitung.')
      } finally {
        setBusy(false)
      }
    }

    async function handlePayrollPageChange(nextPage: number) {
      if (!selectedId) return
      setLinePageLoading(true)
      try {
        const result = await listPayrollLines({ page: nextPage, per_page: payrollPageSize }, selectedId)
        setLines(result.items)
        setLinesMeta({ total: result.meta.total, total_pages: result.meta.total_pages })
        setLinePage(nextPage)
      } catch (pageError) {
        toast.error(pageError instanceof Error ? pageError.message : 'Daftar penggajian gagal dimuat.')
      } finally {
        setLinePageLoading(false)
      }
    }

    async function handleTransition(action: PayrollAction) {
      if (!role || !selectedId) return
      setBusy(true)
      try {
        const payment: PeriodeBayarRequest | undefined = action === 'pay'
          ? { tanggal_bayar: paymentDate, akun_kas_id: Number(cashAccountId) }
          : undefined
        await updatePayrollStatus(role, action, payment, selectedId)
        await load()
        toast.success('Status proses penggajian berhasil diperbarui.')
      } catch (transitionError) {
        toast.error(transitionError instanceof Error ? transitionError.message : 'Status penggajian gagal diperbarui.')
      } finally {
        setBusy(false)
      }
    }

    async function handleReturn() {
      if (!selectedId || !returnNote.trim()) return
      setBusy(true)
      try {
        await returnPayrollPeriod(selectedId, { catatan: returnNote.trim() })
        setReturnNote('')
        await load()
        toast.success('Periode dikembalikan untuk diperbaiki.')
      } catch (returnError) {
        toast.error(returnError instanceof Error ? returnError.message : 'Periode gagal dikembalikan.')
      } finally {
        setBusy(false)
      }
    }

    if (loading) return <PageLoadingSkeleton label="proses penggajian" />
    if (!role) {
      return <EmptyState title="Proses ini untuk Admin/HRD dan Keuangan" description="Masuk dengan mode Admin/HRD atau Keuangan untuk melanjutkan proses." icon={FileCheck2} />
    }
    if (error) return <ErrorState message={error} onRetry={() => void load()} />

    const selected = periods.find((item) => String(item.id) === selectedId) ?? null
    const canSubmit = role === 'admin' && selected?.status === 'draft'
    const canReview = role === 'keuangan' && selected?.status === 'menunggu_validasi'
    const canPay = role === 'keuangan' && selected?.status === 'disetujui'
    const fieldClass = 'min-h-12 rounded-xl border border-border bg-white px-3 text-sm focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none'

    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-heading">Proses penggajian</h2>
            <p className="mt-1 text-sm text-muted-foreground">Tinjau data server dan jalankan setiap tahap sesuai status periode.</p>
          </div>
          <Link href="/app/penggajian" className={buttonVariants({ variant: 'outline', size: 'action', className: 'bg-white' })}>
            <ArrowLeft aria-hidden="true" />
            Daftar penggajian
          </Link>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4" aria-label="Langkah proses penggajian">
          {steps.map((label, index) => (
            <button
              type="button"
              key={label}
              aria-current={step === index ? 'step' : undefined}
              onClick={() => setStep(index)}
              className={`flex min-h-12 items-center gap-3 rounded-xl border px-3 text-left text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${step === index ? 'border-primary bg-blue-50 text-primary' : 'border-border bg-white text-muted-foreground hover:bg-surface'}`}
            >
              <span className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs ${step === index ? 'bg-primary text-white' : 'bg-surface text-heading'}`}>{index + 1}</span>
              {label}
            </button>
          ))}
        </div>

        {step === 0 && (
          <Panel title="Pilih atau buat periode" description="Periode dan status berasal dari API.">
            {periods.length > 0 && (
              <label className="flex max-w-xl flex-col gap-2 text-sm font-semibold text-heading">
                Periode tersedia
                <select value={selectedId} onChange={(event) => void handleSelectPeriod(event.target.value)} className={fieldClass}>
                  {periods.map((item) => <option key={item.id} value={item.id}>{item.label ?? item.periode} · {item.status}</option>)}
                </select>
              </label>
            )}
            {role === 'admin' && (
              <form onSubmit={(event) => void handleCreatePeriod(event)} className="grid gap-4 border-t border-border pt-5 sm:grid-cols-3">
                <label className="flex flex-col gap-2 text-sm font-semibold text-heading">
                  Periode baru
                  <input type="month" required value={periodValue} onChange={(event) => setPeriodValue(event.target.value)} className={fieldClass} />
                </label>
                <label className="flex flex-col gap-2 text-sm font-semibold text-heading">
                  Tanggal tutup
                  <input type="date" required value={cutoffDate} onChange={(event) => setCutoffDate(event.target.value)} className={fieldClass} />
                </label>
                <Button type="submit" variant="outline" size="action" disabled={busy} className="self-end">
                  Buat periode
                </Button>
              </form>
            )}
            {!periods.length && role !== 'admin' && <EmptyState title="Belum ada periode penggajian" description="Admin/HRD perlu membuat periode terlebih dahulu." icon={CalendarDays} />}
            {selected && (
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-border p-4"><p className="text-sm text-muted-foreground">Periode</p><p className="mt-1 font-semibold text-heading">{selected.label ?? selected.periode}</p></div>
                <div className="rounded-xl border border-border p-4"><p className="text-sm text-muted-foreground">Hari kerja</p><p className="mt-1 font-semibold text-heading">{selected.hari_kerja}</p></div>
                <div className="rounded-xl border border-border p-4"><p className="text-sm text-muted-foreground">Karyawan</p><p className="mt-1 font-semibold text-heading">{selected.jumlah_karyawan}</p></div>
                <StatusBadge status={periodStatusLabel(selected.status)} />
              </div>
            )}
          </Panel>
        )}

        {step === 1 && (
          <Panel title="Tinjau rekap absensi" description="Data kehadiran per karyawan dari periode yang dipilih.">
            {!attendance?.karyawan.length ? (
              <EmptyState title="Rekap absensi belum tersedia" description="Pilih periode lain atau muat ulang data." icon={Users} />
            ) : (
              <div className="no-scrollbar overflow-x-auto rounded-xl border border-border">
                <table className="w-full min-w-[840px] border-collapse text-left text-sm">
                  <thead className="bg-surface text-xs font-semibold uppercase text-muted-foreground">
                    <tr>{['Karyawan', 'Hari kerja', 'Hadir', 'Terlambat', 'Izin', 'Sakit', 'Cuti', 'Alpha'].map((label) => <th key={label} scope="col" className="px-3 py-3">{label}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {attendance.karyawan.map((item) => (
                      <tr key={item.karyawan_id}>
                        <td className="px-3 py-3"><span className="font-semibold text-heading">{item.nama}</span><span className="block text-xs text-muted-foreground">{item.kode} · {item.departemen}</span></td>
                        <td className="px-3 py-3">{item.hari_kerja}</td><td className="px-3 py-3">{item.hadir}</td><td className="px-3 py-3">{item.terlambat}</td><td className="px-3 py-3">{item.izin}</td><td className="px-3 py-3">{item.sakit}</td><td className="px-3 py-3">{item.cuti}</td><td className="px-3 py-3">{item.alpha}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {attendance?.peringatan.map((warning) => <p key={`${warning.karyawan_id}-${warning.jenis}`} className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{warning.pesan}</p>)}
          </Panel>
        )}

        {step === 2 && (
          <Panel title="Hasil perhitungan" description="Nilai penggajian dihitung dan dikirim oleh server.">
            <Button type="button" variant="primary" size="action" disabled={!selected || busy} onClick={() => void handleCalculate()}>
              {busy ? 'Menghitung…' : 'Hitung penggajian'}
            </Button>
            {calculation && (
              <div className="grid gap-4 sm:grid-cols-2">
                <StatCard label="Jumlah karyawan" value={String(calculation.jumlah_karyawan)} icon={Users} tone="blue" />
                <StatCard label="Total gaji bersih" value={formatRupiah(calculation.total_gaji_bersih)} icon={BadgeCheck} tone="green" />
              </div>
            )}
            {lines.length > 0 && (
              <div className="no-scrollbar overflow-x-auto rounded-xl border border-border">
                <table className="w-full min-w-[680px] border-collapse text-left text-sm">
                  <thead className="bg-surface text-xs font-semibold uppercase text-muted-foreground"><tr><th scope="col" className="px-3 py-3">Karyawan</th><th scope="col" className="px-3 py-3 text-right">Pendapatan</th><th scope="col" className="px-3 py-3 text-right">Potongan</th><th scope="col" className="px-3 py-3 text-right">Gaji bersih</th></tr></thead>
                  <tbody className="divide-y divide-border">{lines.map((line) => <tr key={line.employeeId}><td className="px-3 py-3 font-semibold text-heading">{line.employeeName}</td><td className="px-3 py-3 text-right tabular-nums">{formatRupiah(line.totalEarnings ?? line.netPay)}</td><td className="px-3 py-3 text-right tabular-nums">{formatRupiah(line.totalDeductions)}</td><td className="px-3 py-3 text-right font-bold tabular-nums">{formatRupiah(line.netPay)}</td></tr>)}</tbody>
                </table>
              </div>
            )}
            {lines.length > 0 && (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground" aria-live="polite">
                  Menampilkan {(linePage - 1) * payrollPageSize + 1} sampai {Math.min(linePage * payrollPageSize, linesMeta?.total ?? 0)} dari {linesMeta?.total ?? 0} karyawan.
                  {' '}Halaman {linePage} dari {Math.max(1, linesMeta?.total_pages ?? 1)}
                </p>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="action" disabled={linePage <= 1 || linePageLoading} onClick={() => void handlePayrollPageChange(Math.max(1, linePage - 1))}>Sebelumnya</Button>
                  <Button type="button" variant="outline" size="action" disabled={linePage >= (linesMeta?.total_pages ?? 1) || linePageLoading} onClick={() => void handlePayrollPageChange(Math.min(linesMeta?.total_pages ?? 1, linePage + 1))}>Berikutnya</Button>
                </div>
              </div>
            )}
          </Panel>
        )}

        {step === 3 && (
          <Panel title="Persetujuan dan pembayaran" description="Aksi tersedia mengikuti peran dan status periode dari API.">
            {selected && detail && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4">
                  <div><p className="font-semibold text-heading">{selected.label ?? selected.periode}</p><p className="text-sm text-muted-foreground">{detail.ringkasan.jumlah_karyawan} karyawan · total bersih {formatRupiah(detail.ringkasan.total_gaji_bersih)}</p></div>
                  <StatusBadge status={periodStatusLabel(selected.status)} />
                </div>
                {canSubmit && <Button type="button" variant="primary" size="action" disabled={busy} onClick={() => void handleTransition('submit')}>Kirim ke validasi keuangan</Button>}
                {canReview && (
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button type="button" variant="primary" size="action" disabled={busy} onClick={() => void handleTransition('approve')}>Setujui penggajian</Button>
                    <label className="flex flex-1 flex-col gap-2 text-sm font-semibold text-heading">Catatan pengembalian<input value={returnNote} onChange={(event) => setReturnNote(event.target.value)} className={fieldClass} /></label>
                    <Button type="button" variant="outline" size="action" disabled={busy || !returnNote.trim()} onClick={() => void handleReturn()}>Kembalikan</Button>
                  </div>
                )}
                {canPay && (
                  <div className="grid gap-4 sm:grid-cols-3">
                    <label className="flex flex-col gap-2 text-sm font-semibold text-heading">Tanggal bayar<input type="date" required value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} className={fieldClass} /></label>
                    <label className="flex flex-col gap-2 text-sm font-semibold text-heading">Akun kas<select required value={cashAccountId} onChange={(event) => setCashAccountId(event.target.value)} className={fieldClass}><option value="">Pilih akun</option>{cashAccounts.map((account) => <option key={account.id} value={account.id}>{account.kode} · {account.nama}</option>)}</select></label>
                    <Button type="button" variant="success" size="action" disabled={busy || !paymentDate || !cashAccountId} className="self-end" onClick={() => void handleTransition('pay')}>Tandai dibayar</Button>
                  </div>
                )}
                {!canSubmit && !canReview && !canPay && <p className="text-sm text-muted-foreground">Tidak ada aksi yang tersedia untuk peran dan status periode ini.</p>}
              </div>
            )}
            {!selected && <EmptyState title="Pilih periode terlebih dahulu" description="Pilih atau buat periode pada langkah pertama." icon={FileCheck2} />}
          </Panel>
        )}

        <div className="flex flex-col-reverse justify-between gap-3 sm:flex-row">
          <Button type="button" variant="outline" size="action" disabled={step === 0} onClick={() => setStep((value) => Math.max(0, value - 1))}><ArrowLeft aria-hidden="true" />Langkah sebelumnya</Button>
          {step < steps.length - 1 && <Button type="button" variant="primary" size="action" onClick={() => setStep((value) => Math.min(steps.length - 1, value + 1))}>Langkah berikutnya<ArrowRight aria-hidden="true" /></Button>}
        </div>
      </div>
    )
  }
  if (error) return <ErrorState message={error} onRetry={() => void load()} />
  if (periodInput !== payrollPeriodId) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-xl font-bold text-heading">Proses penggajian</h2>
          <p className="mt-1 text-sm text-muted-foreground">Pilih periode penggajian yang akan ditinjau.</p>
        </div>
        <label className="flex max-w-sm flex-col gap-2 text-sm font-semibold text-heading">
          Periode
          <input type="month" value={periodInput} onChange={(event) => setPeriodInput(event.target.value)} className="min-h-12 rounded-xl border border-border bg-white px-3 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none" />
        </label>
        <EmptyState
          title="Data periode ini belum tersedia"
          description="Data proses demo saat ini hanya tersedia untuk November 2026."
          icon={CalendarDays}
          action={<Button type="button" variant="outline" size="action" onClick={() => setPeriodInput(payrollPeriodId)}>Pilih November 2026</Button>}
        />
      </div>
    )
  }
  if (!period || !lines.length) {
    return <EmptyState title="Belum ada data untuk diproses" description="Periksa data karyawan aktif dan coba muat ulang periode." icon={Users} />
  }

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
        Perhitungan memakai 9 rincian karyawan aktif dan satu agregat untuk 39 karyawan lain. Total periode tetap mengikuti angka dashboard.
      </DemoDataNotice>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-heading">Proses penggajian</h2>
          <p className="mt-1 text-sm text-muted-foreground">Tinjau periode, absensi, dan hasil sebelum dikirim untuk validasi.</p>
        </div>
        <Link href="/app/penggajian" className={buttonVariants({ variant: 'outline', size: 'action', className: 'bg-white' })}>
          <ArrowLeft aria-hidden="true" />
          Daftar penggajian
        </Link>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4" aria-label="Langkah proses penggajian">
        {steps.map((label, index) => (
          <button
            type="button"
            key={label}
            aria-current={step === index ? 'step' : undefined}
            onClick={() => setStep(index)}
            className={`flex min-h-12 items-center gap-3 rounded-xl border px-3 text-left text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
              step === index ? 'border-primary bg-blue-50 text-primary' : 'border-border bg-white text-muted-foreground hover:bg-surface'
            }`}
          >
            <span className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs ${step === index ? 'bg-primary text-white' : 'bg-surface text-heading'}`}>
              {index + 1}
            </span>
            {label}
          </button>
        ))}
      </div>

      {step === 0 && (
        <Panel title="Pilih periode" description="Periode yang tersedia untuk data demo saat ini.">
          <label className="flex max-w-sm flex-col gap-2 text-sm font-semibold text-heading">
            Periode penggajian
            <input type="month" value={periodInput} onChange={(event) => setPeriodInput(event.target.value)} className="min-h-12 rounded-xl border border-border bg-white px-3 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none" />
          </label>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border p-4"><p className="text-sm text-muted-foreground">Periode</p><p className="mt-1 font-semibold text-heading">{period.period}</p></div>
            <div className="rounded-xl border border-border p-4"><p className="text-sm text-muted-foreground">Tanggal penutupan</p><p className="mt-1 font-semibold text-heading">{period.cutoffDate}</p></div>
            <div className="rounded-xl border border-border p-4"><p className="text-sm text-muted-foreground">Hari kerja</p><p className="mt-1 font-semibold text-heading">{period.workDays} hari</p></div>
          </div>
          <StatusBadge status={period.status} />
        </Panel>
      )}

      {step === 1 && (
        <div className="flex flex-col gap-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Hari kerja" value={String(period.workDays)} hint="November 2026" icon={CalendarDays} tone="blue" />
            <StatCard label="Hari hadir" value={String(totals.present)} hint="Akumulasi 9 rincian individu" icon={Users} tone="green" />
            <StatCard label="Keterlambatan" value={String(totals.late)} hint="Karyawan dengan potongan telat" icon={Clock3} tone="amber" />
            <StatCard label="Hari alpha" value={String(totals.absent)} hint="Data karyawan yang dirinci" icon={BadgeCheck} tone="red" />
          </div>
          <Panel title="Tinjauan kehadiran" description="Ringkasan absensi yang dipakai dalam perhitungan gaji.">
            {detailedLines.length === 0 ? (
              <EmptyState title="Rekap absensi belum tersedia" description="Tidak ada rincian karyawan untuk ditinjau." icon={Users} />
            ) : (
              <div className="flex flex-col gap-3">
                {detailedLines.map((line) => (
                  <div key={line.employeeId} className="flex flex-col gap-2 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar initials={line.initials} tone="outlined" />
                      <div><p className="font-semibold text-heading">{line.employeeName}</p><p className="text-sm text-muted-foreground">{line.department}</p></div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Hadir {line.presentDays} hari · Terlambat {line.lateCount} kali · Alpha {line.absenceDays} hari · Lembur {line.overtimeHours} jam
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      )}

      {step === 2 && (
        <Panel title="Hasil perhitungan" description={`Rumus gaji bersih: gaji pokok + tunjangan + upah lembur - total potongan. Total periode ${formatRupiah(totals.net)}.`}>
          <div className="no-scrollbar hidden overflow-x-auto rounded-xl border border-border md:block">
            <table className="w-full min-w-[980px] border-collapse text-left text-sm">
              <caption className="sr-only">Hasil perhitungan gaji periode {period.period}</caption>
              <thead className="bg-surface text-xs font-semibold uppercase text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-3">Karyawan</th>
                  <th scope="col" className="px-3 py-3 text-right">Gaji pokok</th>
                  <th scope="col" className="px-3 py-3 text-right">Tunjangan</th>
                  <th scope="col" className="px-3 py-3 text-right">Lembur</th>
                  <th scope="col" className="px-3 py-3 text-right">Potongan</th>
                  <th scope="col" className="px-3 py-3 text-right">Gaji bersih</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {lines.map((line) => (
                  <tr key={line.employeeId} className="hover:bg-surface/70">
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-3"><Avatar initials={line.initials} tone={line.isAggregate ? 'muted' : 'outlined'} /><div><p className="font-semibold text-heading">{line.employeeName}</p><p className="text-xs text-muted-foreground">{line.department}</p></div></div>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{line.isAggregate ? 'Agregat' : formatRupiah(line.baseSalary)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{line.isAggregate ? 'Agregat' : formatRupiah(line.fixedAllowance)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{line.isAggregate ? 'Agregat' : formatRupiah(line.overtimePay)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{line.isAggregate ? 'Agregat' : formatRupiah(line.totalDeductions)}</td>
                    <td className="px-3 py-3 text-right font-bold tabular-nums text-heading">{formatRupiah(line.netPay)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-surface font-bold text-heading">
                <tr><th scope="row" colSpan={5} className="px-3 py-3 text-right">Total gaji bersih</th><td className="px-3 py-3 text-right tabular-nums">{formatRupiah(totals.net)}</td></tr>
              </tfoot>
            </table>
          </div>
          <ul className="flex flex-col gap-3 md:hidden">
            {lines.map((line) => (
              <li key={line.employeeId} className="rounded-xl border border-border p-4">
                <div className="mb-3 flex items-center gap-3"><Avatar initials={line.initials} tone={line.isAggregate ? 'muted' : 'outlined'} /><div><p className="font-semibold text-heading">{line.employeeName}</p><p className="text-sm text-muted-foreground">{line.department}</p></div></div>
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <dt className="text-muted-foreground">Gaji pokok</dt><dd className="text-right">{line.isAggregate ? 'Agregat' : formatRupiah(line.baseSalary)}</dd>
                  <dt className="text-muted-foreground">Tunjangan</dt><dd className="text-right">{line.isAggregate ? 'Agregat' : formatRupiah(line.fixedAllowance)}</dd>
                  <dt className="text-muted-foreground">Lembur</dt><dd className="text-right">{line.isAggregate ? 'Agregat' : formatRupiah(line.overtimePay)}</dd>
                  <dt className="text-muted-foreground">Potongan</dt><dd className="text-right">{line.isAggregate ? 'Agregat' : formatRupiah(line.totalDeductions)}</dd>
                  <dt className="font-semibold text-heading">Gaji bersih</dt><dd className="text-right font-bold">{formatRupiah(line.netPay)}</dd>
                </dl>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {step === 3 && (
        <Panel title="Persetujuan dan finalisasi" description="Admin/HRD mengirim hasil yang telah diperiksa. Keuangan memvalidasi lalu menandai pembayaran.">
          <div className="flex flex-col gap-4 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-heading">{period.period} · {formatRupiah(totals.net)}</p>
              <p className="mt-1 text-sm text-muted-foreground">{period.employeeCount} karyawan · tutup periode {period.cutoffDate}</p>
            </div>
            <StatusBadge status={period.status} />
          </div>
          <ol className="grid gap-3 sm:grid-cols-3">
            <li className="rounded-xl border border-border p-4"><p className="font-semibold text-heading">1. Pemeriksaan HRD</p><p className="mt-1 text-sm text-muted-foreground">Periksa absensi dan rincian gaji.</p></li>
            <li className="rounded-xl border border-border p-4"><p className="font-semibold text-heading">2. Validasi Keuangan</p><p className="mt-1 text-sm text-muted-foreground">Tinjau hasil sebelum persetujuan.</p></li>
            <li className="rounded-xl border border-border p-4"><p className="font-semibold text-heading">3. Pembayaran</p><p className="mt-1 text-sm text-muted-foreground">Catat periode sebagai sudah dibayar.</p></li>
          </ol>
          {action ? (
            <Button type="button" variant={action === 'pay' ? 'success' : 'primary'} size="action" className="self-start" onClick={() => setPendingAction(action)}>
              {actionLabel(action)}
            </Button>
          ) : (
            <p className="text-sm font-medium text-muted-foreground">
              {period.status === 'Draft' ? 'Menunggu Admin/HRD mengirim hasil untuk validasi.' : period.status === 'Menunggu validasi keuangan' ? 'Menunggu Keuangan memeriksa hasil.' : 'Periode telah selesai dibayar.'}
            </p>
          )}
        </Panel>
      )}

      <div className="flex flex-col-reverse justify-between gap-3 sm:flex-row">
        <Button type="button" variant="outline" size="action" disabled={step === 0} onClick={() => setStep((current) => Math.max(0, current - 1))}>
          <ArrowLeft aria-hidden="true" />
          Langkah sebelumnya
        </Button>
        {step < steps.length - 1 && (
          <Button type="button" variant="primary" size="action" onClick={() => setStep((current) => Math.min(steps.length - 1, current + 1))}>
            Langkah berikutnya
            <ArrowRight aria-hidden="true" />
          </Button>
        )}
      </div>

      <Dialog open={pendingAction !== null} onOpenChange={(open) => !open && setPendingAction(null)} label="Konfirmasi langkah penggajian">
        <DialogHeader
          title={pendingAction === 'pay' ? 'Konfirmasi pembayaran' : 'Konfirmasi penggajian'}
          description={pendingAction === 'pay' ? `Tandai ${period.period} sebesar ${formatRupiah(totals.net)} sebagai dibayar?` : `${pendingAction ? actionLabel(pendingAction) : ''} untuk periode ${period.period}?`}
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
