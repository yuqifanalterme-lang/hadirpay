export type Role = 'admin_hrd' | 'karyawan' | 'keuangan' | 'pemilik'
export type StatusAbsensi =
  | 'hadir'
  | 'terlambat'
  | 'izin'
  | 'sakit'
  | 'cuti'
  | 'alpha'
  | 'dinas_luar'
export type JenisPengajuan = 'izin' | 'sakit' | 'cuti' | 'koreksi_absensi'
export type StatusPengajuan = 'menunggu' | 'disetujui' | 'ditolak'
export type StatusPeriode = 'draft' | 'menunggu_validasi' | 'disetujui' | 'dibayar' | 'dibatalkan'
export type JenisPenggajian = 'bulanan' | 'harian'
export type TipeKomponen = 'pendapatan' | 'potongan'
export type MetodeKomponen = 'nominal_tetap' | 'persen' | 'per_hari' | 'per_jam' | 'per_menit' | 'manual_periode'
export type KategoriAkun = 'aset' | 'kewajiban' | 'ekuitas' | 'pendapatan' | 'beban'
export type SaldoNormal = 'debit' | 'kredit'
export type HariKerja =
  | 'senin'
  | 'selasa'
  | 'rabu'
  | 'kamis'
  | 'jumat'
  | 'sabtu'
  | 'minggu'

export type ApiListMeta = {
  page: number
  per_page: number
  total: number
  total_pages: number
}

export type Id = number
export type Tanggal = string
export type Waktu = string
export type Periode = string
export type Uang = number
