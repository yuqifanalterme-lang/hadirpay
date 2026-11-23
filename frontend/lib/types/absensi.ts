import type { ApiListMeta } from './common'
import type { Id, StatusAbsensi, Tanggal, Uang, Waktu } from './common'

export type Lokasi = {
  latitude: number
  longitude: number
  dalam_radius: boolean
}

export type AbsensiHariIni = {
  tanggal: Tanggal
  server_time: string
  jam_kerja: { masuk: Waktu; pulang: Waktu; toleransi_menit: number }
  lokasi_kantor: {
    nama: string
    alamat: string
    latitude: number
    longitude: number
    radius_meter: number
  }
  absensi: {
    id: Id
    jam_masuk: Waktu | null
    jam_pulang: Waktu | null
    status: StatusAbsensi
    menit_terlambat: number
    lokasi_masuk: Lokasi | null
  } | null
  bisa_absen_masuk: boolean
  bisa_absen_pulang: boolean
}

export type AbsensiLokasiRequest = { latitude: number; longitude: number }
export type CheckInResponse = {
  id: Id
  tanggal: Tanggal
  jam_masuk: Waktu
  status: 'hadir' | 'terlambat'
  menit_terlambat: number
}
export type CheckOutResponse = {
  id: Id
  jam_masuk: Waktu
  jam_pulang: Waktu
  durasi_menit: number
  jam_lembur_menit: number
}

export type AbsensiRiwayatQuery = { periode: string; page?: number; per_page?: number }
export type AbsensiRiwayat = {
  periode: string
  ringkasan: {
    hari_kerja: number
    hadir: number
    terlambat: number
    izin: number
    sakit: number
    cuti: number
    alpha: number
  }
  kalender: { tanggal: Tanggal; status: StatusAbsensi }[]
  riwayat: {
    id: Id
    tanggal: Tanggal
    jam_masuk: Waktu | null
    jam_pulang: Waktu | null
    durasi_menit: number | null
    status: StatusAbsensi
    koreksi_pengajuan_id: Id | null
  }[]
}

export type AbsensiAdminQuery = {
  tanggal?: Tanggal
  departemen_id?: Id
  status?: StatusAbsensi
  search?: string
  page?: number
  per_page?: number
}
export type AbsensiAdminItem = {
  id: Id
  karyawan: { id: Id; kode: string; nama: string; inisial: string }
  departemen: string
  tanggal: Tanggal
  jam_masuk: Waktu | null
  jam_pulang: Waktu | null
  durasi_menit: number | null
  status: StatusAbsensi | null
  menit_terlambat: number
  lokasi: Lokasi | null
}
export type AbsensiAdminSummary = {
  hadir: number
  terlambat: number
  izin: number
  sakit: number
  cuti: number
  alpha: number
}
export type AbsensiAdminList = {
  data: AbsensiAdminItem[]
  meta?: ApiListMeta
  ringkasan: AbsensiAdminSummary
}
export type AbsensiRekapQuery = {
  periode: string
  departemen_id?: Id
  search?: string
  page?: number
  per_page?: number
}
export type AbsensiRekap = {
  periode: string
  ringkasan: {
    total_karyawan: number
    rata_rata_hadir_persen: number
    total_terlambat: number
    total_alpha: number
    total_jam_lembur: number
  }
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
}
export type AbsensiRekapPeriode = AbsensiRekap & {
  peringatan?: { karyawan_id: Id; jenis: string; pesan: string }[]
}
export type AbsensiRingkasResponse = {
  periode: string
  hari_kerja: number
  hadir: number
  terlambat: number
  izin: number
  sakit: number
  cuti: number
  alpha: number
}
export type AbsensiExportQuery = AbsensiAdminQuery
export type AbsensiUang = Uang
