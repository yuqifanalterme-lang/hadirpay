import type { HariKerja, Id, KategoriAkun, Role, Tanggal } from './common'

export type Pengaturan = {
  perusahaan: { nama: string; alamat: string; npwp: string | null; logo_url: string | null }
  jadwal_kerja: {
    jam_masuk: string
    jam_pulang: string
    toleransi_menit: number
    hari_kerja: HariKerja[]
  }
  kebijakan_gaji: {
    metode_potongan_alpha: string
    pembagi_hari_kerja: string
    tanggal_tutup_periode: number
    potongan_izin_tanpa_surat: boolean
    potongan_terlambat_per_keterlambatan: number
  }
  lokasi_absensi: {
    id: Id
    nama: string
    alamat: string
    latitude: number
    longitude: number
    radius_meter: number
    wajib_lokasi: boolean
  }[]
  kuota_cuti_tahunan: number
}
export type PengaturanWriteRequest = Partial<Pengaturan>
export type HariLibur = { id: Id; tanggal: Tanggal; nama: string }
export type HariLiburCreateRequest = { tanggal: Tanggal; nama: string }
export type Pengguna = { id: Id; nama: string; email: string; role: Role; aktif: boolean }
export type PenggunaRoleRequest = { role: Role }
export type PenggunaStatusRequest = { aktif: boolean }
export type LogoResponse = { logo_url: string }
export type PengaturanLogoRequest = { logo: File }
export type KategoriAkunPengaturan = KategoriAkun
