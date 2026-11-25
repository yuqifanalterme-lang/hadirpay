import type { Id, JenisPenggajian, Role, StatusAbsensi, Tanggal, Uang } from './common'

export type KaryawanRingkas = {
  id: Id
  kode: string
  nama: string
  inisial: string
  jabatan: { id: Id; nama: string }
  departemen: { id: Id; nama: string }
  jenis_penggajian: JenisPenggajian
  status: 'aktif' | 'nonaktif'
  tanggal_mulai: Tanggal
}

export type KaryawanKomponen = {
  komponen_id: Id
  kode: string
  nama: string
  tipe: 'pendapatan' | 'potongan'
  metode: 'nominal_tetap' | 'persen' | 'per_hari' | 'per_jam' | 'per_menit'
  nilai: Uang
}

export type KaryawanDetail = {
  id: Id
  kode: string
  nama: string
  email: string
  no_hp: string | null
  jabatan_id: Id
  departemen_id: Id
  tanggal_mulai: Tanggal
  jenis_penggajian: JenisPenggajian
  gaji_pokok: Uang
  tunjangan_tetap: Uang
  npwp: string | null
  no_bpjs: string | null
  status: 'aktif' | 'nonaktif'
  role: Role
  komponen_gaji: KaryawanKomponen[]
  sisa_cuti: number
}

export type KaryawanCreateRequest = {
  nama: string
  email: string
  no_hp: string | null
  jabatan_id: Id
  departemen_id: Id
  tanggal_mulai: Tanggal
  jenis_penggajian: JenisPenggajian
  gaji_pokok: Uang
  tunjangan_tetap: Uang
  pph21: Uang
  npwp: string | null
  no_bpjs: string | null
  role: Role
  password: string
}
export type KaryawanUpdateRequest = Partial<KaryawanCreateRequest>

export type KaryawanListQuery = {
  search?: string
  departemen_id?: Id
  jabatan_id?: Id
  status?: 'aktif' | 'nonaktif'
  jenis_penggajian?: JenisPenggajian
  page?: number
  per_page?: number
  sort?: string
  order?: 'asc' | 'desc'
}

export type KaryawanStatusRequest = { status: 'aktif' | 'nonaktif' }
export type KaryawanKehadiranRingkas = {
  periode: string
  hari_kerja: number
  hadir: number
  terlambat: number
  izin: number
  sakit: number
  cuti: number
  alpha: number
}

export type DataMasterItem = { id: Id; nama: string; jumlah_karyawan?: number }
export type DataMasterWriteRequest = { nama: string }
export type Pengguna = { id: Id; nama: string; email: string; role: Role; aktif: boolean }
export type PenggunaRoleRequest = { role: Role }
export type PenggunaStatusRequest = { aktif: boolean }
export type ResetPasswordResponse = { password_sementara: string }

export type KaryawanStatusAbsensi = StatusAbsensi | null
