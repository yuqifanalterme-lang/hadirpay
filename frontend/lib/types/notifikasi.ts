import type { ApiListMeta, Id } from './common'

export type Notifikasi = {
  id: Id
  judul: string
  pesan: string
  tipe: 'pengajuan' | 'penggajian' | 'slip' | 'sistem'
  tautan: string
  dibaca: boolean
  dibuat_pada: string
}
export type NotifikasiListQuery = {
  belum_dibaca?: boolean
  page?: number
  per_page?: number
}
export type NotifikasiList = {
  data: Notifikasi[]
  meta: ApiListMeta
  jumlah_belum_dibaca: number
}
export type NotifikasiBacaResponse = null
