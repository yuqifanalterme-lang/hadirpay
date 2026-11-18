'use client'

import { useState } from 'react'
import { BookOpenText, CalendarCheck, Wallet } from 'lucide-react'
import { AttendanceTable } from '@/components/hadirpay/attendance-table'
import { BrowserFrame } from '@/components/hadirpay/browser-frame'
import { StatusBadge } from '@/components/hadirpay/status-badge'
import { formatRupiah, journalEntries, payslip, recentAttendance } from '@/lib/mock-data'
import { cn } from '@/lib/utils'

const tabs = [
  { id: 'absensi', label: 'Absensi & Rekap', icon: CalendarCheck, url: 'app.hadirpay.id/absensi' },
  { id: 'gaji', label: 'Perhitungan Gaji', icon: Wallet, url: 'app.hadirpay.id/penggajian' },
  { id: 'jurnal', label: 'Jurnal Umum', icon: BookOpenText, url: 'app.hadirpay.id/akuntansi/jurnal' },
] as const

type TabId = (typeof tabs)[number]['id']

function AttendancePanel() {
  const summary = [
    { label: 'Hadir', value: 41, bg: 'bg-success' },
    { label: 'Terlambat', value: 4, bg: 'bg-amber-700' },
    { label: 'Izin', value: 1, bg: 'bg-sky-700' },
    { label: 'Cuti', value: 1, bg: 'bg-violet-700' },
    { label: 'Alpha', value: 1, bg: 'bg-red-600' },
  ]
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold">Rekap Absensi Harian</h3>
          <p className="text-sm text-muted-foreground">Selasa, 17 Nov 2026 · 48 karyawan</p>
        </div>
        <ul className="flex flex-wrap gap-2">
          {summary.map((s) => (
            <li
              key={s.label}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-white',
                s.bg,
              )}
            >
              <span>{s.label}</span>
              <strong className="font-bold text-white">{s.value}</strong>
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-2xl border border-border bg-white px-4">
        <AttendanceTable rows={recentAttendance} caption="Rekap absensi 17 Nov 2026" />
      </div>
    </div>
  )
}

function PayrollPanel() {
  const earnings = payslip.earnings.reduce((s, e) => s + e.amount, 0)
  const deductions = payslip.deductions.reduce((s, e) => s + e.amount, 0)
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold">Rincian Gaji · Andi Wijaya</h3>
          <p className="text-sm text-muted-foreground">Staf Keuangan · Periode {payslip.periode} · 21 hari kerja</p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {[
          { title: 'Pendapatan', items: payslip.earnings, total: earnings, negative: false },
          { title: 'Potongan', items: payslip.deductions, total: deductions, negative: true },
        ].map((group) => (
          <div key={group.title} className="flex flex-col rounded-2xl border border-border bg-white p-4">
            <p className="mb-2 text-sm font-bold text-heading">{group.title}</p>
            <dl className="flex flex-col text-sm">
              {group.items.map((i) => (
                <div key={i.label} className="flex justify-between gap-3 border-b border-dashed border-border py-2">
                  <dt>{i.label}</dt>
                  <dd className="font-semibold text-heading tabular-nums">{formatRupiah(i.amount)}</dd>
                </div>
              ))}
              <div className="flex justify-between gap-3 pt-3">
                <dt className="font-bold text-heading">Total {group.title.toLowerCase()}</dt>
                <dd className={cn('font-bold tabular-nums', group.negative ? 'text-red-600' : 'text-heading')}>
                  {formatRupiah(group.total)}
                </dd>
              </div>
            </dl>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-navy to-navy-2 p-5 text-white">
        <span className="text-blue-100">Gaji bersih (take home pay)</span>
        <span className="text-2xl font-extrabold tabular-nums">{formatRupiah(payslip.net)}</span>
      </div>
    </div>
  )
}

function JournalPanel() {
  const debit = journalEntries.reduce((s, e) => s + e.debit, 0)
  const credit = journalEntries.reduce((s, e) => s + e.credit, 0)
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold">Jurnal Umum · Penggajian Oktober 2026</h3>
          <p className="text-sm text-muted-foreground">No. bukti JU-2026-10-031 · dibuat otomatis dari proses gaji</p>
        </div>
        <StatusBadge status="Seimbang" className="px-3 py-1.5 text-sm" />
      </div>
      <div className="no-scrollbar overflow-x-auto rounded-2xl border border-border bg-white">
        <table className="w-full min-w-[560px] text-left text-sm">
          <caption className="sr-only">Jurnal umum penggajian Oktober 2026</caption>
          <thead>
            <tr className="border-b border-border bg-surface text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              <th scope="col" className="px-4 py-3 font-semibold">Tanggal</th>
              <th scope="col" className="px-4 py-3 font-semibold">Kode</th>
              <th scope="col" className="px-4 py-3 font-semibold">Akun</th>
              <th scope="col" className="px-4 py-3 text-right font-semibold">Debit</th>
              <th scope="col" className="px-4 py-3 text-right font-semibold">Kredit</th>
            </tr>
          </thead>
          <tbody>
            {journalEntries.map((e) => (
              <tr key={e.code} className="border-b border-border/70">
                <td className="px-4 py-3">{e.date}</td>
                <td className="px-4 py-3 text-muted-foreground tabular-nums">{e.code}</td>
                <td className={cn('px-4 py-3 font-semibold text-heading', e.credit > 0 && 'pl-10')}>{e.account}</td>
                <td className="px-4 py-3 text-right tabular-nums">{e.debit ? formatRupiah(e.debit) : '—'}</td>
                <td className="px-4 py-3 text-right tabular-nums">{e.credit ? formatRupiah(e.credit) : '—'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-emerald-50/60 font-bold text-heading">
              <td colSpan={3} className="px-4 py-3">Total</td>
              <td className="px-4 py-3 text-right tabular-nums">{formatRupiah(debit)}</td>
              <td className="px-4 py-3 text-right tabular-nums">{formatRupiah(credit)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

export function PreviewGallery() {
  const [active, setActive] = useState<TabId>('absensi')
  const current = tabs.find((t) => t.id === active)!

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const idx = tabs.findIndex((t) => t.id === active)
    let next = idx
    if (e.key === 'ArrowRight') next = (idx + 1) % tabs.length
    else if (e.key === 'ArrowLeft') next = (idx - 1 + tabs.length) % tabs.length
    else return
    e.preventDefault()
    setActive(tabs[next].id)
    document.getElementById(`tab-${tabs[next].id}`)?.focus()
  }

  return (
    <section id="pratinjau" className="scroll-mt-20 bg-white pt-14 pb-20 sm:pt-16 sm:pb-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">
            Pratinjau Sistem HADIRPAY
          </h2>
        </div>

        <div
          role="tablist"
          aria-label="Pilih pratinjau"
          onKeyDown={onKeyDown}
          className="mx-auto mt-10 flex max-w-full flex-wrap items-center justify-center gap-2 sm:gap-2.5"
        >
          {tabs.map((t) => {
            const selected = t.id === active
            const Icon = t.icon
            return (
              <button
                key={t.id}
                id={`tab-${t.id}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`panel-${t.id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setActive(t.id)}
                className={cn(
                  'flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold whitespace-nowrap transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:px-5 sm:text-[15px]',
                  selected
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-transparent text-foreground hover:bg-slate-100 hover:text-heading',
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
                {t.label}
              </button>
            )
          })}
        </div>

        <div
          id={`panel-${active}`}
          role="tabpanel"
          aria-labelledby={`tab-${active}`}
          className="mt-10"
        >
          <BrowserFrame url={current.url}>
            <div key={active} className="bg-surface p-4 duration-300 animate-in fade-in slide-in-from-bottom-2 sm:p-8">
              {active === 'absensi' && <AttendancePanel />}
              {active === 'gaji' && <PayrollPanel />}
              {active === 'jurnal' && <JournalPanel />}
            </div>
          </BrowserFrame>
        </div>
      </div>
    </section>
  )
}
