import type { Id, JenisPengajuan, StatusPengajuan, Tanggal, Waktu } from './common'

export type PengajuanListQuery = {
  jenis?: JenisPengajuan
  status?: StatusPengajuan
  departemen_id?: Id
  search?: string
  tanggal_dari?: Tanggal
  tanggal_sampai?: Tanggal
  page?: number
  per_page?: number
}

export type PengajuanListSummary = {
  menunggu: number
  disetujui: number
  ditolak: number
}

export type PengajuanItem = {
  id: Id
  jenis: JenisPengajuan
  judul: string
  karyawan: { id: Id; nama: string; inisial: string; departemen: string }
  tanggal_mulai: Tanggal
  tanggal_selesai: Tanggal
  jumlah_hari: number
  alasan: string
  lampiran_url: string | null
  status: StatusPengajuan
  tanggal_diajukan: Tanggal
  diproses_oleh: { id: Id; nama: string; label: string } | null
  diproses_pada: string | null
  alasan_penolakan: string | null
}
export type PengajuanDetail = PengajuanItem & {
  data_koreksi?: {
    tanggal: Tanggal
    jam_masuk_benar: Waktu | null
    jam_pulang_benar: Waktu | null
  }
  lembur?: { tanggal: Tanggal; jam_mulai: Waktu; jam_selesai: Waktu; durasi_menit: number }
}
export type PengajuanCreateRequest =
  | {
      jenis: 'izin' | 'sakit' | 'cuti'
      tanggal_mulai: Tanggal
      tanggal_selesai: Tanggal
      alasan: string
      lampiran?: File
    }
  | {
      jenis: 'koreksi_absensi'
      tanggal_mulai: Tanggal
      alasan: string
      jam_masuk_benar?: Waktu
      jam_pulang_benar?: Waktu
    }
  | {
      jenis: 'lembur'
      tanggal_mulai: Tanggal
      alasan: string
      jam_mulai: Waktu
      jam_selesai: Waktu
    }
export type PengajuanKuota = {
  tahun: number
  cuti_tahunan_total: number
  cuti_terpakai: number
  cuti_sisa: number
}
export type PengajuanSetujuiRequest = { catatan?: string }
export type PengajuanTolakRequest = { alasan_penolakan: string }
export type PengajuanBulkRequest = { ids: Id[]; aksi: 'setujui' | 'tolak' }
export type PengajuanBulkResponse = { berhasil: Id[]; gagal: { id: Id; alasan: string }[] }
