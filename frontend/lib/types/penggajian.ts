import type {
  Id,
  JenisPenggajian,
  MetodeKomponen,
  Periode,
  StatusPeriode,
  Tanggal,
  TipeKomponen,
  Uang,
} from './common'

export type KomponenGaji = {
  id: Id
  kode: string
  nama: string
  tipe: TipeKomponen
  metode: MetodeKomponen
  nilai: Uang | null
  keterangan?: string | null
  aktif: boolean
}
export type KomponenGajiWriteRequest = {
  kode: string
  nama: string
  tipe: TipeKomponen
  metode: MetodeKomponen
  nilai: Uang | null
  keterangan?: string | null
  aktif: boolean
}
export type KomponenGajiStatusRequest = { aktif: boolean }

export type PeriodeGaji = {
  id: Id
  periode: Periode
  label?: string
  tanggal_mulai?: Tanggal
  tanggal_selesai?: Tanggal
  tanggal_tutup: Tanggal
  hari_kerja: number
  status: StatusPeriode
  jumlah_karyawan: number
  total_gaji_bersih: Uang
  dibuat_oleh?: string
}
export type PeriodeGajiCreateRequest = { periode: Periode; tanggal_tutup: Tanggal }
export type PeriodeGajiDetail = {
  id: Id
  periode: Periode
  status: StatusPeriode
  hari_kerja: number
  ringkasan: {
    jumlah_karyawan: number
    total_pendapatan: Uang
    total_potongan: Uang
    total_gaji_bersih: Uang
  }
  riwayat_status: { status: StatusPeriode; oleh: string; waktu: string }[]
  jurnal_pengakuan_id: Id | null
  jurnal_pembayaran_id: Id | null
}
export type PeriodeListQuery = { tahun?: number; status?: StatusPeriode }

export type PeriodeRekapAbsensi = {
  karyawan: {
    karyawan_id: Id
    kode: string
    nama: string
    departemen: string
    hari_kerja: number
    hadir: number
    terlambat: number
    izin: number
    sakit: number
    cuti: number
    alpha: number
    jam_lembur_menit: number
    total_menit_terlambat: number
  }[]
  peringatan: { karyawan_id: Id; jenis: string; pesan: string }[]
}
export type PeriodeHitungResponse = {
  periode_id: Id
  jumlah_karyawan: number
  total_gaji_bersih: Uang
  dihitung_pada: string
}
export type PeriodePayrollListQuery = {
  search?: string
  departemen_id?: Id
  page?: number
  per_page?: number
}
export type PenggajianListItem = {
  id: Id
  karyawan: { id: Id; kode: string; nama: string; departemen: string }
  gaji_pokok: Uang
  tunjangan: Uang
  upah_lembur: Uang
  total_pendapatan: Uang
  total_potongan: Uang
  gaji_bersih: Uang
}
export type PenggajianDetail = {
  id: Id
  periode: Periode
  karyawan: {
    id: Id
    kode: string
    nama: string
    jabatan: string
    departemen: string
  }
  kehadiran: {
    hari_kerja: number
    hadir: number
    terlambat: number
    izin: number
    sakit: number
    cuti: number
    alpha: number
    total_menit_terlambat: number
    jam_lembur: number
  }
  tarif_harian: Uang
  rincian: { komponen_id: Id | null; nama: string; tipe: TipeKomponen; keterangan: string | null; jumlah: Uang }[]
  total_pendapatan: Uang
  total_potongan: Uang
  gaji_bersih: Uang
}
export type PeriodeKembalikanRequest = { catatan: string }
export type PeriodePembatalanRequest = { catatan: string }
export type PeriodeBayarRequest = { tanggal_bayar: Tanggal; akun_kas_id: Id; catatan?: string }
export type SlipListQuery = {
  karyawan_id?: Id
  periode?: Periode
  search?: string
  page?: number
  per_page?: number
}
export type SlipGajiItem = {
  id: Id
  penggajian_id: Id
  periode: Periode
  label: string
  tanggal_terbit: Tanggal
  karyawan: { id: Id; nama: string }
  gaji_bersih: Uang
}
export type SlipGajiDetail = PenggajianDetail & {
  nomor_slip: string
  tanggal_terbit: Tanggal
  perusahaan: { nama: string; alamat: string; logo_url: string | null }
}
export type JenisPenggajianValue = JenisPenggajian
