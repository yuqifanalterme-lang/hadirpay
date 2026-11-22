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
import { ROLE_STORAGE_KEY, type Role } from '@/lib/navigation'
import { config } from '@/lib/config'
import { formatRupiah, payslip as octoberPayslip } from '@/lib/mock-data'
import type { PayrollBreakdownItem, PayrollLine, PayrollPeriod } from '@/lib/mock/payroll'
import { createPayslipPdf, type PayslipPdfData } from '@/lib/payroll/pdf'
import { downloadPayslipPdf, getPayslip, getPayrollPeriod, listPayslips, listPayrollLines } from '@/lib/services/penggajian.service'
import type { SlipGajiDetail, SlipGajiItem } from '@/lib/types/penggajian'

type PayslipPeriod = '2026-11' | '2026-10'

function formatMonth(value: PayslipPeriod) {
  return value === '2026-11' ? 'November 2026' : 'Oktober 2026'
}

export function PayslipPage() {
  return <DemoPayslipPage />
}

function DemoPayslipPage() {
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
      setLines(nextLines.items.filter((line) => !line.isAggregate))
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
    if (config.mock.penggajian && role) void load()
    else if (config.mock.penggajian) setLoading(false)
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

  if (!config.mock.penggajian) return <LivePayslipPage />
  if (loading) return <PageLoadingSkeleton label="slip gaji" />
  if (!role) {
    return (
      <EmptyState
        title="Masuk untuk melihat slip gaji"
        description="Pilih role Karyawan, Admin/HRD, atau Keuangan."
        icon={FileText}
        action={<Link href="/login" className={buttonVariants({ variant: 'primary', size: 'action' })}>Masuk ke HADIRPAY</Link>}
      />
    )
  }

  function LivePayslipPage() {
    const [role, setRole] = useState<Role | null>(null)
    const [roleReady, setRoleReady] = useState(false)
    const [period, setPeriod] = useState('')
    const [query, setQuery] = useState('')
    const [debouncedQuery, setDebouncedQuery] = useState('')
    const [slips, setSlips] = useState<SlipGajiItem[]>([])
    const [slipsMeta, setSlipsMeta] = useState<{ total: number; total_pages: number } | null>(null)
    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState(20)
    const [selected, setSelected] = useState<SlipGajiItem | null>(null)
    const [detail, setDetail] = useState<SlipGajiDetail | null>(null)
    const [loading, setLoading] = useState(false)
    const [detailLoading, setDetailLoading] = useState(false)
    const [reload, setReload] = useState(0)
    const [error, setError] = useState('')
    const [detailError, setDetailError] = useState('')

    useEffect(() => {
      const storedRole = localStorage.getItem(ROLE_STORAGE_KEY)
      setRole(storedRole === 'admin' || storedRole === 'keuangan' || storedRole === 'karyawan' ? storedRole : null)
      setRoleReady(true)
    }, [])

    useEffect(() => {
      const timeout = window.setTimeout(() => setDebouncedQuery(query.trim()), 300)
      return () => window.clearTimeout(timeout)
    }, [query])

    useEffect(() => {
      if (!roleReady || !role) return
      let active = true
      setLoading(true)
      setError('')
      listPayslips({
        ...(period ? { periode: period } : {}),
        ...(!['karyawan'].includes(role) && debouncedQuery ? { search: debouncedQuery } : {}),
        page,
        per_page: pageSize,
      })
        .then((result) => {
          if (!active) return
          setSlips(result.items)
          setSlipsMeta({ total: result.meta.total, total_pages: result.meta.total_pages })
          setSelected(null)
          setDetail(null)
        })
        .catch((loadError: unknown) => {
          if (active) setError(loadError instanceof Error ? loadError.message : 'Daftar slip gagal dimuat.')
        })
        .finally(() => {
          if (active) setLoading(false)
        })
      return () => {
        active = false
      }
    }, [roleReady, role, period, debouncedQuery, page, pageSize, reload])

    async function selectSlip(slip: SlipGajiItem) {
      setSelected(slip)
      setDetail(null)
      setDetailError('')
      setDetailLoading(true)
      try {
        setDetail(await getPayslip(slip.id))
      } catch (loadError) {
        setDetailError(loadError instanceof Error ? loadError.message : 'Rincian slip gagal dimuat.')
      } finally {
        setDetailLoading(false)
      }
    }

    async function downloadPdf() {
      if (!selected) return
      try {
        const blob = await downloadPayslipPdf(selected.id)
        const url = URL.createObjectURL(blob)
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = `slip-gaji-${selected.id}-${selected.periode}.pdf`
        anchor.click()
        window.setTimeout(() => URL.revokeObjectURL(url), 1000)
        toast.success('Slip gaji berhasil diunduh.')
      } catch (downloadError) {
        toast.error(downloadError instanceof Error ? downloadError.message : 'PDF slip gagal diunduh.')
      }
    }

    if (!roleReady) return <PageLoadingSkeleton label="slip gaji" />
    if (!role) {
      return <EmptyState title="Masuk untuk melihat slip gaji" description="Pilih mode Karyawan, Admin/HRD, atau Keuangan." icon={FileText} action={<Link href="/login" className={buttonVariants({ variant: 'primary', size: 'action' })}>Masuk ke HADIRPAY</Link>} />
    }

    const inputClass = 'min-h-12 w-full rounded-xl border border-border bg-white px-3 text-sm focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none'

    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-heading">{role === 'karyawan' ? 'Slip gaji saya' : 'Slip gaji karyawan'}</h2>
            <p className="mt-1 text-sm text-muted-foreground">Daftar dan rincian slip dimuat dari layanan penggajian.</p>
          </div>
          <div className="grid w-full gap-3 sm:max-w-xl sm:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm font-semibold text-heading">
              Periode
              <input type="month" value={period} onChange={(event) => { setPeriod(event.target.value); setPage(1) }} className={inputClass} />
            </label>
            {role !== 'karyawan' && (
              <label className="flex flex-col gap-2 text-sm font-semibold text-heading">
                Cari slip
                <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} placeholder="Nama karyawan" className={inputClass} />
              </label>
            )}
          </div>
        </div>

        {error ? <ErrorState message={error} onRetry={() => setReload((value) => value + 1)} /> : loading ? (
          <PageLoadingSkeleton label="daftar slip gaji" />
        ) : slips.length === 0 ? (
          <EmptyState title="Slip gaji belum tersedia" description="Belum ada slip untuk filter yang dipilih." icon={FileText} />
        ) : (
          <Panel title="Daftar slip" description="Pilih slip untuk melihat rincian dan mengunduh PDF.">
            <div className="flex flex-col gap-2">
              {slips.map((slip) => (
                <button
                  type="button"
                  key={slip.id}
                  aria-pressed={selected?.id === slip.id}
                  onClick={() => void selectSlip(slip)}
                  className={`flex min-h-12 flex-col gap-2 rounded-xl border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:flex-row sm:items-center sm:justify-between ${selected?.id === slip.id ? 'border-primary bg-blue-50' : 'border-border hover:bg-surface'}`}
                >
                  <span><span className="block font-semibold text-heading">{slip.karyawan.nama}</span><span className="text-sm text-muted-foreground">{slip.label} · terbit {slip.tanggal_terbit}</span></span>
                  <span className="font-semibold tabular-nums text-heading">{formatRupiah(slip.gaji_bersih)}</span>
                </button>
              ))}
            </div>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                Per halaman
                <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1) }} className="min-h-11 rounded-xl border border-border bg-white px-3 text-heading">
                  {[10, 20, 50].map((size) => <option key={size} value={size}>{size}</option>)}
                </select>
              </label>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <p className="text-sm text-muted-foreground" aria-live="polite">
                  Menampilkan {slipsMeta?.total ? (page - 1) * pageSize + 1 : 0} sampai {Math.min(page * pageSize, slipsMeta?.total ?? 0)} dari {slipsMeta?.total ?? 0} slip. Halaman {page} dari {Math.max(1, slipsMeta?.total_pages ?? 1)}
                </p>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="action" disabled={page <= 1 || loading} onClick={() => setPage((current) => Math.max(1, current - 1))}>Sebelumnya</Button>
                  <Button type="button" variant="outline" size="action" disabled={page >= (slipsMeta?.total_pages ?? 1) || loading} onClick={() => setPage((current) => Math.min(slipsMeta?.total_pages ?? 1, current + 1))}>Berikutnya</Button>
                </div>
              </div>
            </div>
          </Panel>
        )}

        {selected && (
          detailLoading ? <PageLoadingSkeleton label="rincian slip gaji" /> : detailError ? <ErrorState message={detailError} onRetry={() => void selectSlip(selected)} /> : detail ? (
            <Panel title={`Slip gaji ${selected.label}`} description={`${detail.karyawan.nama} · ${detail.nomor_slip}`}>
              <div className="flex flex-col gap-5">
                <div className="rounded-xl bg-navy-2 p-5 text-white sm:p-6">
                  <p className="text-sm font-medium text-blue-100">Gaji bersih</p>
                  <p className="mt-1 break-words text-2xl font-extrabold tracking-tight sm:text-3xl">{formatRupiah(detail.gaji_bersih)}</p>
                  <p className="mt-3 text-sm text-blue-100">{detail.perusahaan.nama} · {detail.periode}</p>
                </div>
                <div className="grid gap-5 md:grid-cols-2">
                  <section aria-labelledby="live-payslip-earnings-heading">
                    <h3 id="live-payslip-earnings-heading" className="mb-3 font-semibold text-heading">Pendapatan</h3>
                    <dl className="flex flex-col gap-2">{detail.rincian.filter((item) => item.tipe === 'pendapatan').map((item) => <div key={`${item.komponen_id}-${item.nama}`} className="flex justify-between gap-3 border-b border-border py-2 text-sm"><dt className="text-muted-foreground">{item.nama}</dt><dd className="text-right font-medium tabular-nums text-heading">{formatRupiah(item.jumlah)}</dd></div>)}<div className="flex justify-between gap-3 pt-1 text-sm font-bold text-heading"><dt>Total pendapatan</dt><dd className="tabular-nums">{formatRupiah(detail.total_pendapatan)}</dd></div></dl>
                  </section>
                  <section aria-labelledby="live-payslip-deductions-heading">
                    <h3 id="live-payslip-deductions-heading" className="mb-3 font-semibold text-heading">Potongan</h3>
                    <dl className="flex flex-col gap-2">{detail.rincian.filter((item) => item.tipe === 'potongan').map((item) => <div key={`${item.komponen_id}-${item.nama}`} className="flex justify-between gap-3 border-b border-border py-2 text-sm"><dt className="text-muted-foreground">{item.nama}</dt><dd className="text-right font-medium tabular-nums text-heading">{formatRupiah(item.jumlah)}</dd></div>)}<div className="flex justify-between gap-3 pt-1 text-sm font-bold text-heading"><dt>Total potongan</dt><dd className="tabular-nums">{formatRupiah(detail.total_potongan)}</dd></div></dl>
                  </section>
                </div>
                <Panel title="Ringkasan kehadiran" description="Ringkasan kehadiran yang disertakan pada slip.">
                  <dl className="grid gap-3 sm:grid-cols-4">
                    <div className="rounded-xl border border-border p-3"><dt className="text-sm text-muted-foreground">Hari kerja</dt><dd className="mt-1 font-semibold text-heading">{detail.kehadiran.hari_kerja}</dd></div>
                    <div className="rounded-xl border border-border p-3"><dt className="text-sm text-muted-foreground">Hadir</dt><dd className="mt-1 font-semibold text-heading">{detail.kehadiran.hadir}</dd></div>
                    <div className="rounded-xl border border-border p-3"><dt className="text-sm text-muted-foreground">Terlambat</dt><dd className="mt-1 font-semibold text-heading">{detail.kehadiran.terlambat}</dd></div>
                    <div className="rounded-xl border border-border p-3"><dt className="text-sm text-muted-foreground">Alpha</dt><dd className="mt-1 font-semibold text-heading">{detail.kehadiran.alpha}</dd></div>
                  </dl>
                </Panel>
                <Button type="button" variant="primary" size="action" className="self-start" onClick={() => void downloadPdf()}><Download aria-hidden="true" />Unduh PDF</Button>
              </div>
            </Panel>
          ) : null
        )}
      </div>
    )
  }

  const isEmployee = role === 'karyawan'

  return (
    <div className="flex flex-col gap-6">

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-heading">{isEmployee ? 'Slip gaji saya' : 'Slip gaji karyawan'}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{isEmployee ? 'Pilih periode untuk melihat slip gaji milik Anda.' : 'Cari karyawan untuk melihat rincian slip gaji.'}</p>
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
        <Panel title="Pilih karyawan" description="Daftar pencarian mengikuti karyawan aktif.">
          {filteredEmployees.length === 0 ? (
            <EmptyState title="Karyawan tidak ditemukan" description="Coba nama atau ID lain yang ada di direktori." icon={Users} />
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
                  <div className="flex justify-between gap-3 pt-1 text-sm font-bold text-heading"><dt>Total pendapatan</dt><dd className="tabular-nums">{formatRupiah(selectedLine?.totalEarnings ?? 0)}</dd></div>
                </dl>
              </section>
              <section aria-labelledby="payslip-deductions-heading">
                <h3 id="payslip-deductions-heading" className="mb-3 font-semibold text-heading">Potongan</h3>
                <dl className="flex flex-col gap-2">
                  {deductions.map((item) => <div key={item.label} className="flex justify-between gap-3 border-b border-border py-2 text-sm"><dt className="text-muted-foreground">{item.label}</dt><dd className="text-right font-medium tabular-nums text-heading">{formatRupiah(item.amount)}</dd></div>)}
                  <div className="flex justify-between gap-3 pt-1 text-sm font-bold text-heading"><dt>Total potongan</dt><dd className="tabular-nums">{formatRupiah(selectedLine?.totalDeductions ?? 0)}</dd></div>
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
