'use client'

import { useEffect, useState } from 'react'
import { ReceiptText } from 'lucide-react'
import { Panel } from '@/components/hadirpay/panel'
import { StatIcon } from '@/components/ui/stat-icon'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { formatRupiah, payslip as mockPayslip } from '@/lib/mock-data'
import { formatTanggal } from '@/lib/format'
import { config } from '@/lib/config'
import { getPayslip } from '@/lib/services/penggajian.service'
import type { DashboardKaryawan } from '@/lib/types/dashboard'

type PayslipBreakdown = {
  rincian: { nama: string; tipe: 'pendapatan' | 'potongan'; jumlah: number }[]
  kehadiran: { hari_kerja: number; hadir: number; terlambat: number; alpha: number }
}

export function PayslipCard({ slip }: { slip: DashboardKaryawan['slip_terakhir'] }) {
  const [detail, setDetail] = useState<PayslipBreakdown | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    if (!slip) {
      setDetail(null)
      setDetailLoading(false)
      return
    }

    let active = true
    setDetail(null)
    setDetailError('')
    if (config.mock.dashboard) {
      setDetailLoading(false)
      setDetail({
        rincian: [
          ...mockPayslip.earnings.map((item) => ({ nama: item.label, tipe: 'pendapatan' as const, jumlah: item.amount })),
          ...mockPayslip.deductions.map((item) => ({ nama: item.label, tipe: 'potongan' as const, jumlah: item.amount })),
        ],
        kehadiran: { hari_kerja: 22, hadir: 20, terlambat: 1, alpha: 1 },
      })
      return () => { active = false }
    }

    setDetailLoading(true)
    void getPayslip(slip.id)
      .then((result) => {
        if (active) {
          setDetail({
            rincian: result.rincian.map(({ nama, tipe, jumlah }) => ({ nama, tipe, jumlah })),
            kehadiran: {
              hari_kerja: result.kehadiran.hari_kerja,
              hadir: result.kehadiran.hadir,
              terlambat: result.kehadiran.terlambat,
              alpha: result.kehadiran.alpha,
            },
          })
        }
      })
      .catch((loadError: unknown) => {
        if (active) setDetailError(loadError instanceof Error ? loadError.message : 'Rincian slip gaji gagal dimuat.')
      })
      .finally(() => {
        if (active) setDetailLoading(false)
      })
    return () => { active = false }
  }, [slip?.id, retry])

  if (!slip) {
    return <Panel title="Slip gaji terakhir"><EmptyState title="Belum ada slip gaji" description="Slip gaji akan tampil setelah diterbitkan." icon={ReceiptText} /></Panel>
  }
  const period = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(
    new Date(`${slip.periode}-01T00:00:00`),
  )

  return (
    <Panel title="Slip gaji terakhir" description={`Periode ${period} · terbit ${formatTanggal(slip.tanggal_terbit)}`}>
      <div className="flex items-center gap-4 rounded-2xl bg-emerald-50 p-4">
        <StatIcon icon={ReceiptText} tone="green" size="lg" />
        <div>
          <p className="text-sm font-medium text-emerald-800">Gaji bersih diterima</p>
          <p className="text-2xl font-extrabold tracking-tight text-heading">{formatRupiah(slip.gaji_bersih)}</p>
        </div>
      </div>
      {detailLoading && <p className="text-sm text-muted-foreground" aria-live="polite">Memuat rincian slip gaji…</p>}
      {detailError && (
        <div role="alert" className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p>Rincian slip gaji gagal dimuat: {detailError}</p>
          <Button type="button" variant="outline" size="action" className="self-start" onClick={() => setRetry((value) => value + 1)}>
            Coba lagi
          </Button>
        </div>
      )}
      {detail && (
        <>
          <div className="grid gap-5 md:grid-cols-2">
            {([
              ['pendapatan', 'Pendapatan', slip.total_pendapatan],
              ['potongan', 'Potongan', slip.total_potongan],
            ] as const).map(([type, title, total]) => {
              const items = detail.rincian.filter((item) => item.tipe === type)
              return (
                <section key={type} aria-label={title}>
                  <h3 className="mb-2 font-semibold text-heading">{title}</h3>
                  <dl className="flex flex-col gap-2 text-sm">
                    {items.length ? items.map((item, index) => (
                      <div key={`${item.nama}-${index}`} className="flex justify-between gap-3 border-b border-border py-2">
                        <dt className="text-muted-foreground">{item.nama}</dt>
                        <dd className="text-right font-medium tabular-nums text-heading">{formatRupiah(item.jumlah)}</dd>
                      </div>
                    )) : <p className="text-sm text-muted-foreground">Tidak ada rincian {title.toLowerCase()}.</p>}
                    <div className="flex justify-between gap-3 pt-1 font-bold text-heading">
                      <dt>Total {title.toLowerCase()}</dt>
                      <dd className="tabular-nums">{formatRupiah(total)}</dd>
                    </div>
                  </dl>
                </section>
              )
            })}
          </div>
          <section aria-label="Ringkasan kehadiran" className="border-t border-border pt-4">
            <h3 className="mb-3 font-semibold text-heading">Ringkasan kehadiran</h3>
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              {([
                ['Hari kerja', detail.kehadiran.hari_kerja],
                ['Hadir', detail.kehadiran.hadir],
                ['Terlambat', `${detail.kehadiran.terlambat} kali`],
                ['Alpha', `${detail.kehadiran.alpha} hari`],
              ] as const).map(([label, value]) => (
                <div key={label} className="rounded-xl border border-border p-3">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="mt-1 font-semibold text-heading">{value}</dd>
                </div>
              ))}
            </dl>
          </section>
        </>
      )}
    </Panel>
  )
}
