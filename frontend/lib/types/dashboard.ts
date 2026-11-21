import type { Id, JenisPengajuan, Periode, StatusAbsensi, StatusPengajuan, StatusPeriode, Tanggal, Uang, Waktu } from './common'

export type DashboardAdmin = {
  tanggal: Tanggal
  sapaan_rekap: {
    persen_terisi: number
    pengajuan_menunggu: number
    periode_ditutup: Tanggal
  }
  statistik: {
    total_karyawan: number
    hadir_hari_ini: number
    persen_hadir: number
    terlambat: number
    batas_terlambat: Waktu
    tidak_hadir: { total: number; izin: number; cuti: number; alpha: number }
    total_gaji_bulan_berjalan: Uang
    periode_gaji: Periode
  }
  kehadiran_minggu_ini: {
    rata_rata_minggu_lalu: number
    hari: { tanggal: Tanggal; persen_hadir: number | null; status: 'selesai' | 'hari_ini' | 'akan_datang' }[]
  }
  tren_kehadiran: { tanggal: Tanggal; hadir: number; tepat_waktu: number }[]
  pengajuan_menunggu: {
    id: Id
    jenis: JenisPengajuan
    karyawan: { id: Id; nama: string; inisial: string }
    judul: string
    durasi_label: string
    tanggal_mulai: Tanggal
    tanggal_selesai: Tanggal
  }[]
  absensi_terbaru: {
    karyawan: { id: Id; nama: string; inisial: string }
    departemen: string
    jam_masuk: Waktu | null
    jam_pulang: Waktu | null
    status: StatusAbsensi | null
  }[]
}

export type DashboardKaryawan = {
  tanggal: Tanggal
  server_time: string
  jam_kerja: { masuk: Waktu; pulang: Waktu }
  lokasi_kantor: { nama: string; alamat: string }
  absensi_hari_ini: {
    sudah_masuk: boolean
    sudah_pulang: boolean
    jam_masuk: Waktu | null
    jam_pulang: Waktu | null
    status: StatusAbsensi | null
  }
  kehadiran_minggu_ini: {
    tercatat: number
    total_hari: number
    jumlah_terlambat: number
    hari: { tanggal: Tanggal; status: StatusAbsensi | null }[]
  }
  slip_terakhir: {
    id: Id
    periode: Periode
    tanggal_terbit: Tanggal
    gaji_bersih: Uang
    total_pendapatan: Uang
    total_potongan: Uang
  } | null
  pengajuan_terakhir: {
    id: Id
    jenis: JenisPengajuan
    judul: string
    tanggal_mulai: Tanggal
    status: StatusPengajuan
    tanggal_diajukan: Tanggal
    disetujui_oleh: string | null
  } | null
  jumlah_notifikasi: number
}

export type DashboardKeuangan = {
  periode_menunggu_validasi: { id: Id; periode: Periode; total_gaji_bersih: Uang; jumlah_karyawan: number }[]
  jadwal_pembayaran: { periode: Periode; tanggal_bayar: Tanggal; status: StatusPeriode } | null
  saldo_utang_gaji: Uang
  total_beban_gaji_bulan_berjalan: Uang
}

export type DashboardPemilik = {
  total_biaya_gaji_bulan_berjalan: Uang
  tren_beban_gaji: { periode: Periode; total: Uang }[]
  kehadiran_per_departemen: { departemen: string; persen_hadir: number }[]
  top_keterlambatan: {
    karyawan_id: Id
    nama: string
    departemen: string
    jumlah_terlambat: number
    total_menit: number
  }[]
}
