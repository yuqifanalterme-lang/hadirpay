import { BookOpenText, Calculator, FileDown, Fingerprint, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

type Feature = {
  title: string
  body: string
  icon: LucideIcon
  accent: 'blue' | 'green'
  snippet: React.ReactNode
}

const features: Feature[] = [
  {
    title: 'Absensi Digital Real-Time',
    body: 'Check-in dan check-out lewat web, waktu tercatat otomatis, plus pengajuan izin dan cuti.',
    icon: Fingerprint,
    accent: 'blue',
    snippet: (
      <div className="flex flex-col gap-1 rounded-xl bg-surface px-3 py-2.5 text-sm">
        <span className="text-xs text-muted-foreground">Waktu check-in</span>
        <span className="font-bold text-heading">[DATA ABSENSI]</span>
      </div>
    ),
  },
  {
    title: 'Hitung Gaji Otomatis',
    body: 'Gaji pokok, tunjangan, lembur, dan potongan absen terhitung presisi.',
    icon: Calculator,
    accent: 'green',
    snippet: (
      <div className="flex flex-col gap-1 rounded-xl bg-surface px-3 py-2.5 text-xs tabular-nums">
        <span className="flex justify-between"><span>Pendapatan</span><span className="font-semibold text-heading">[DATA GAJI]</span></span>
        <span className="flex justify-between"><span>Potongan</span><span className="font-semibold text-red-600">[DATA POTONGAN]</span></span>
      </div>
    ),
  },
  {
    title: 'Slip Gaji PDF Instan',
    body: 'Karyawan bisa melihat rincian dan mengunduh slip gaji kapan saja.',
    icon: FileDown,
    accent: 'blue',
    snippet: (
      <div className="flex items-center gap-3 rounded-xl bg-surface px-3 py-2.5">
        <span className="flex h-9 w-7 items-center justify-center rounded-md bg-red-50 text-[9px] font-bold text-red-600 ring-1 ring-red-100">
          PDF
        </span>
        <span className="text-xs">
          <span className="block font-semibold text-heading">[SLIP GAJI]</span>
          <span className="text-muted-foreground">Pratinjau dokumen</span>
        </span>
      </div>
    ),
  },
  {
    title: 'Jurnal Akuntansi Otomatis',
    body: 'Transaksi gaji langsung menjadi jurnal umum dan buku besar.',
    icon: BookOpenText,
    accent: 'green',
    snippet: (
      <div className="flex flex-col gap-1.5 rounded-xl bg-surface px-3 py-2.5 text-xs">
        <div className="flex h-2 overflow-hidden rounded-full bg-white" aria-hidden="true">
          <span className="w-1/2 bg-primary" />
          <span className="w-1/2 bg-success" />
        </div>
        <span className="flex justify-between font-semibold text-heading">
          <span>Debit</span>
          <span>= Kredit</span>
        </span>
      </div>
    ),
  },
]

export function Features() {
  return (
    <section id="fitur" className="scroll-mt-20 bg-white py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 text-center">
          <p className="text-sm font-bold tracking-wider text-primary uppercase">Fitur utama</p>
          <h2 className="text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">
            Satu alur dari kehadiran sampai laporan keuangan
          </h2>
          <p className="text-lg text-pretty text-foreground">
            Data absensi mengalir langsung ke perhitungan gaji, lalu tercatat sebagai jurnal tanpa input ulang.
          </p>
        </div>

        <ul className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => {
            const Icon = f.icon
            return (
              <li
                key={f.title}
                className="group flex flex-col gap-4 rounded-xl border border-border bg-white p-6 transition-colors duration-200 hover:border-primary"
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      'flex size-12 items-center justify-center rounded-xl',
                      f.accent === 'blue' ? 'bg-blue-50 text-primary' : 'bg-emerald-50 text-emerald-600',
                    )}
                  >
                    <Icon className="size-6" aria-hidden="true" />
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  <h3 className="text-lg font-bold">{f.title}</h3>
                  <p className="text-[15px] leading-relaxed">{f.body}</p>
                </div>
                <div className="mt-auto" aria-hidden="true">
                  {f.snippet}
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
