import type { Id, KategoriAkun, Periode, SaldoNormal, Tanggal, Uang } from './common'

export type Akun = {
  id: Id
  kode: string
  nama: string
  kategori: KategoriAkun
  saldo_normal: SaldoNormal
  aktif: boolean
}
export type AkunWriteRequest = {
  kode: string
  nama: string
  kategori: KategoriAkun
  saldo_normal: SaldoNormal
  aktif: boolean
}
export type JurnalListQuery = {
  tanggal_dari?: Tanggal
  tanggal_sampai?: Tanggal
  sumber?: 'otomatis' | 'manual'
  status?: 'aktif' | 'dibatalkan'
  periode_gaji_id?: Id
  search?: string
  page?: number
  per_page?: number
}
export type JurnalDetailItem = {
  akun_id: Id
  kode_akun: string
  nama_akun: string
  debit: Uang
  kredit: Uang
}
export type Jurnal = {
  id: Id
  nomor_bukti: string
  tanggal: Tanggal
  keterangan: string
  sumber: 'otomatis' | 'manual'
  jenis: 'pengakuan_gaji' | 'pembayaran_gaji' | 'manual'
  status: 'aktif' | 'dibatalkan'
  reversal_of: Id | null
  cancelled_by: { id: Id; nama: string } | null
  cancelled_at: string | null
  cancel_reason: string | null
  dibatalkan_oleh: { id: Id; nama: string } | null
  dibatalkan_pada: string | null
  alasan_pembatalan: string | null
  periode_gaji: { id: Id; periode: Periode } | null
  total_debit: Uang
  total_kredit: Uang
  detail: JurnalDetailItem[]
}
export type JurnalBatalkanRequest = { alasan: string }
export type JurnalCreateRequest = {
  tanggal: Tanggal
  keterangan: string
  detail: { akun_id: Id; debit: Uang; kredit: Uang }[]
}
export type BukuBesarQuery = { akun_id: Id; tanggal_dari?: Tanggal; tanggal_sampai?: Tanggal }
export type BukuBesar = {
  akun: { id: Id; kode: string; nama: string; saldo_normal: SaldoNormal }
  saldo_awal: Uang
  mutasi: {
    tanggal: Tanggal
    nomor_bukti: string
    jurnal_id: Id
    keterangan: string
    debit: Uang
    kredit: Uang
    saldo: Uang
  }[]
  total_debit: Uang
  total_kredit: Uang
  saldo_akhir: Uang
}
export type NeracaSaldoQuery = { tanggal_sampai: Tanggal }
export type NeracaSaldo = {
  per_tanggal: Tanggal
  akun: { akun_id: Id; kode: string; nama: string; debit: Uang; kredit: Uang }[]
  total_debit: Uang
  total_kredit: Uang
  seimbang: boolean
}
