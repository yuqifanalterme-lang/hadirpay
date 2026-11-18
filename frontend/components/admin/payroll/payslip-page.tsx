'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Download, FileText, Search, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Panel } from '@/components/hadirpay/panel'
import { StatusBadge } from '@/components/hadirpay/status-badge'
import { Avatar } from '@/components/ui/avatar'
import { Button, buttonVariants } from '@/components/ui/button'
import { EmptyState, ErrorState } from '@/components/ui/empty-state'
import { PageLoadingSkeleton } from '@/components/ui/page-loading-skeleton'
import { DemoDataNotice } from '@/components/ui/demo-data-notice'
import { ROLE_STORAGE_KEY, type Role } from '@/lib/navigation'
import { formatRupiah, payslip as octoberPayslip } from '@/lib/mock-data'
import type { PayrollBreakdownItem, PayrollLine, PayrollPeriod } from '@/lib/mock/payroll'
import { createPayslipPdf, type PayslipPdfData } from '@/lib/payroll/pdf'
import { getPayrollPeriod, listPayrollLines } from '@/lib/services/payroll-service'

type PayslipPeriod = '2026-11' | '2026-10'

function formatMonth(value: PayslipPeriod) {
  return value === '2026-11' ? 'November 2026' : 'Oktober 2026'
}

export function PayslipPage() {
  const [role, setRole] = useState<Role | null>(null)
  const [period, setPeriod] = useState<PayrollPeriod | null>(null)
  const [lines, setLines] = useState<PayrollLine[]>([])
  const [employeeId, setEmployeeId] = useState('HP-0001')
  const [periodId, setPeriodId] = useState<PayslipPeriod>('2026-11')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [nextPeriod, nextLines] = await Promise.all([getPayrollPeriod(), listPayrollLines()])
      setPeriod(nextPeriod)
      setLines(nextLines.filter((line) => !line.isAggregate))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Slip gaji gagal dimuat.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const storedRole = localStorage.getItem(ROLE_STORAGE_KEY)
    const nextRole = storedRole === 'admin' || storedRole === 'keuangan' || storedRole === 'karyawan' ? storedRole : null
    setRole(nextRole)
    if (nextRole === 'karyawan') setPeriodId('2026-10')
  }, [])

  useEffect(() => {
    if (role) void load()
    else setLoading(false)
  }, [role])

  const filteredEmployees = useMemo(
    () => lines.filter((line) => `${line.employeeName} ${line.employeeId}`.toLowerCase().includes(query.toLowerCase())),
    [lines, query],
  )
  const selectedLine = filteredEmployees.find((line) => line.employeeId === employeeId) ?? filteredEmployees[0]
  const selectedEmployeeId = selectedLine?.employeeId ?? employeeId
  const selectedName = selectedLine?.employeeName ?? 'Andi Wijaya'
  const isOctoberDemo = periodId === '2026-10' && selectedEmployeeId === 'HP-0001'
  const hasSlip = Boolean(selectedLine) && (periodId === '2026-11' || isOctoberDemo)
  const canDownload = hasSlip && (isOctoberDemo || period?.status === 'Dibayar')
  const earnings: PayrollBreakdownItem[] = isOctoberDemo
    ? octoberPayslip.earnings
    : selectedLine?.earnings ?? []
  const deductions: PayrollBreakdownItem[] = isOctoberDemo
    ? octoberPayslip.deductions
    : selectedLine?.deductions ?? []
  const netPay = isOctoberDemo ? octoberPayslip.net : selectedLine?.netPay ?? 0
  const currentStatus = isOctoberDemo ? 'Dibayar' : period?.status ?? 'Draft'

  async function downloadPayslip() {
    if (!selectedLine || !canDownload) return
    try {
      const tokenColor = getComputedStyle(document.documentElement).getPropertyValue('--navy-2').trim()
      const data: PayslipPdfData = {
        employeeName: selectedLine.employeeName,
        employeeId: selectedLine.employeeId,
        position: selectedLine.position,
        department: selectedLine.department,
        period: formatMonth(periodId),
        netPay,
        earnings,
        deductions,
        attendance: isOctoberDemo
          ? { presentDays: null, lateCount: null, absenceDays: null }
          : {
              presentDays: selectedLine.presentDays,
              lateCount: selectedLine.lateCount,
              absenceDays: selectedLine.absenceDays,
            },
      }
      const blob = createPayslipPdf(data, tokenColor)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `slip-gaji-${selectedLine.employeeId}-${periodId}.pdf`
      anchor.click()
      URL.revokeObjectURL(url)
      toast.success('Slip gaji berhasil diunduh.')
    } catch (downloadError) {
      toast.error(downloadError instanceof Error ? downloadError.message : 'PDF gagal dibuat.')
    }
  }

  if (loading) return <PageLoadingSkeleton label="slip gaji" />
  if (!role) {
    return (
      <EmptyState
        title="Masuk untuk melihat slip gaji"
        description="Pilih mode demo Karyawan, Admin/HRD, atau Keuangan."
        icon={FileText}
        action={<Link href="/login" className={buttonVariants({ variant: 'primary', size: 'action' })}>Masuk ke HADIRPAY</Link>}
      />
    )
  }

  const isEmployee = role === 'karyawan'

  return (
    <div className="flex flex-col gap-6">
      <DemoDataNotice>
        Slip gaji memakai data contoh. Slip Oktober mengikuti data yang tampil di Beranda; rincian hari hadir untuk periode itu belum tersedia.
      </DemoDataNotice>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-heading">{isEmployee ? 'Slip gaji saya' : 'Slip gaji karyawan'}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{isEmployee ? 'Pilih periode untuk melihat slip gaji milik Anda.' : 'Cari karyawan untuk melihat rincian slip gaji demo.'}</p>
        </div>
        {!isEmployee && (
          <label className="flex w-full flex-col gap-2 text-sm font-semibold text-heading sm:max-w-sm">
            Cari karyawan
            <span className="relative">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nama atau ID karyawan" className="min-h-12 w-full rounded-xl border border-border bg-white pr-3 pl-10 text-sm focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none" />
            </span>
          </label>
        )}
      </div>

      {isEmployee ? (
        <Panel title="Periode slip" description="Slip Oktober tersedia dari data Beranda. Slip November masih berupa pratinjau sampai periode dibayar.">
          <div className="flex flex-wrap gap-3">
            {(['2026-10', '2026-11'] as PayslipPeriod[]).map((value) => (
              <Button key={value} type="button" variant={periodId === value ? 'primary' : 'outline'} size="action" aria-pressed={periodId === value} onClick={() => setPeriodId(value)}>
                {formatMonth(value)}
              </Button>
            ))}
          </div>
        </Panel>
      ) : (
        <Panel title="Pilih karyawan" description="Daftar pencarian mengikuti karyawan aktif yang tersedia di data demo.">
          {filteredEmployees.length === 0 ? (
            <EmptyState title="Karyawan tidak ditemukan" description="Coba nama atau ID lain yang ada di direktori demo." icon={Users} />
          ) : (
            <label className="flex max-w-xl flex-col gap-2 text-sm font-semibold text-heading">
              Karyawan
              <select value={selectedEmployeeId} onChange={(event) => setEmployeeId(event.target.value)} className="min-h-12 rounded-xl border border-border bg-white px-3 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none">
                {filteredEmployees.map((line) => <option key={line.employeeId} value={line.employeeId}>{line.employeeName} · {line.employeeId}</option>)}
              </select>
            </label>
          )}
        </Panel>
      )}

      {!hasSlip ? (
        <EmptyState
          title={periodId === '2026-10' ? 'Slip periode ini belum tersedia' : 'Slip gaji belum diterbitkan'}
          description={periodId === '2026-10' ? 'Data slip Oktober yang tersedia hanya untuk Andi Wijaya.' : `Slip ${formatMonth(periodId)} dapat diunduh setelah status penggajian berubah menjadi Dibayar.`}
          icon={FileText}
        />
      ) : (
        <Panel
          title={`Slip gaji ${formatMonth(periodId)}`}
          description={`${selectedName} · ${selectedLine?.employeeId ?? 'HP-0001'}`}
          action={<StatusBadge status={currentStatus} />}
        >
          <div className="flex flex-col gap-5">
            <div className="rounded-xl bg-navy-2 p-5 text-white sm:p-6">
              <p className="text-sm font-medium text-blue-100">Gaji bersih</p>
              <p className="mt-1 break-words text-2xl font-extrabold tracking-tight sm:text-3xl">{formatRupiah(netPay)}</p>
              <p className="mt-3 text-sm text-blue-100">{selectedLine?.position} · {selectedLine?.department} · {formatMonth(periodId)}</p>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <section aria-labelledby="payslip-earnings-heading">
                <h3 id="payslip-earnings-heading" className="mb-3 font-semibold text-heading">Pendapatan</h3>
                <dl className="flex flex-col gap-2">
                  {earnings.map((item) => <div key={item.label} className="flex justify-between gap-3 border-b border-border py-2 text-sm"><dt className="text-muted-foreground">{item.label}</dt><dd className="text-right font-medium tabular-nums text-heading">{formatRupiah(item.amount)}</dd></div>)}
                  <div className="flex justify-between gap-3 pt-1 text-sm font-bold text-heading"><dt>Total pendapatan</dt><dd className="tabular-nums">{formatRupiah(earnings.reduce((sum, item) => sum + item.amount, 0))}</dd></div>
                </dl>
              </section>
              <section aria-labelledby="payslip-deductions-heading">
                <h3 id="payslip-deductions-heading" className="mb-3 font-semibold text-heading">Potongan</h3>
                <dl className="flex flex-col gap-2">
                  {deductions.map((item) => <div key={item.label} className="flex justify-between gap-3 border-b border-border py-2 text-sm"><dt className="text-muted-foreground">{item.label}</dt><dd className="text-right font-medium tabular-nums text-heading">{formatRupiah(item.amount)}</dd></div>)}
                  <div className="flex justify-between gap-3 pt-1 text-sm font-bold text-heading"><dt>Total potongan</dt><dd className="tabular-nums">{formatRupiah(deductions.reduce((sum, item) => sum + item.amount, 0))}</dd></div>
                </dl>
              </section>
            </div>

            <Panel title="Ringkasan kehadiran" description="Catatan kehadiran untuk periode slip terpilih.">
              <dl className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-border p-3"><dt className="text-sm text-muted-foreground">Hari hadir</dt><dd className="mt-1 font-semibold text-heading">{isOctoberDemo ? 'Belum tersedia' : `${selectedLine?.presentDays ?? 0} hari`}</dd></div>
                <div className="rounded-xl border border-border p-3"><dt className="text-sm text-muted-foreground">Keterlambatan</dt><dd className="mt-1 font-semibold text-heading">{isOctoberDemo ? 'Belum tersedia' : `${selectedLine?.lateCount ?? 0} kali`}</dd></div>
                <div className="rounded-xl border border-border p-3"><dt className="text-sm text-muted-foreground">Alpha</dt><dd className="mt-1 font-semibold text-heading">{isOctoberDemo ? 'Belum tersedia' : `${selectedLine?.absenceDays ?? 0} hari`}</dd></div>
              </dl>
            </Panel>

            {!canDownload && (
              <p className="text-sm text-muted-foreground">Slip November adalah pratinjau dan belum dapat diunduh sebelum Keuangan menandai periode sebagai Dibayar.</p>
            )}
            <Button type="button" variant="primary" size="action" className="self-start" disabled={!canDownload} onClick={() => void downloadPayslip()}>
              <Download aria-hidden="true" />
              Unduh PDF
            </Button>
          </div>
        </Panel>
      )}
    </div>
  )
}
