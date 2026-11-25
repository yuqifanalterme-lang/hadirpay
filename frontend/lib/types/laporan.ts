import type { Id, Periode, Tanggal, Uang } from './common'

export type LaporanQuery = {
  periode?: Periode
  periode_dari?: Periode
  periode_sampai?: Periode
  tanggal_dari?: Tanggal
  tanggal_sampai?: Tanggal
  departemen_id?: Id
  page?: number
  per_page?: number
}
export type LaporanId =
  | 'kehadiran'
  | 'keterlambatan'
  | 'izin-cuti'
  | 'penggajian'
  | 'beban-gaji'
  | 'jurnal-penggajian'
export type LaporanGrafikSatu = { label: string; nilai: number }
export type LaporanGrafikDua = { label: string; nilai_a: number; nilai_b: number }
export type LaporanData = {
  filter: Record<string, string | number | null>
  ringkasan: Record<string, string | number | null>
  grafik: (LaporanGrafikSatu | LaporanGrafikDua)[]
  tabel: Record<string, string | number | null>[]
}
export type LaporanKehadiranSummary = {
  total_hadir: number
  rata_rata_hadir_persen: number
  total_alpha: number
}
export type LaporanKeterlambatanSummary = {
  total_kejadian: number
  total_menit: number
  karyawan_terbanyak: string
}
export type LaporanIzinCutiSummary = {
  total_izin: number
  total_sakit: number
  total_cuti: number
  total_hari: number
}
export type LaporanPenggajianSummary = {
  total_pendapatan: Uang
  total_potongan: Uang
  total_gaji_bersih: Uang
}
export type LaporanJurnalPenggajianSummary = {
  total_debit: Uang
  total_kredit: Uang
  jumlah_jurnal: number
}
export type LaporanBebanGajiSummary = {
  total_beban_gaji: Uang
  rata_rata_per_bulan: Uang
  periode_tertinggi: Periode
}
