export const requestTypes = ['Izin', 'Sakit', 'Cuti', 'Koreksi Absensi', 'Lembur'] as const
export type RequestType = (typeof requestTypes)[number]

export const requestStatuses = ['Menunggu persetujuan', 'Disetujui', 'Ditolak'] as const
export type RequestStatus = (typeof requestStatuses)[number]

export type ApprovalRequest = {
  id: string
  employeeId: string
  name: string
  initials: string
  position: string
  department: string
  type: RequestType
  startDate: string
  endDate: string
  days: number
  reason: string
  attachmentName?: string
  submittedAt: string
  status: RequestStatus
  approvedBy?: string
  rejectionReason?: string
  isMock: true
}

export const mockLeaveQuota = {
  annual: 12,
  used: 3,
}

export const mockRequests: ApprovalRequest[] = [
  {
    id: 'rq-andi-cuti-nov-2026',
    employeeId: 'HP-0001',
    name: 'Andi Wijaya',
    initials: 'AW',
    position: 'Staf Keuangan',
    department: 'Keuangan',
    type: 'Cuti',
    startDate: '2026-11-24',
    endDate: '2026-11-26',
    days: 3,
    reason: 'Menghadiri acara keluarga.',
    submittedAt: '2026-11-12',
    status: 'Disetujui',
    approvedBy: 'Rina Kartika (HRD)',
    isMock: true,
  },
  {
    id: 'pg-101',
    employeeId: 'HP-0002',
    name: 'Budi Santoso',
    initials: 'BS',
    position: 'Staf Gudang',
    department: 'Gudang',
    type: 'Cuti',
    startDate: '2026-11-24',
    endDate: '2026-11-26',
    days: 3,
    reason: 'Mengurus keperluan keluarga.',
    submittedAt: '2026-11-12',
    status: 'Menunggu persetujuan',
    isMock: true,
  },
  {
    id: 'pg-102',
    employeeId: 'HP-0003',
    name: 'Siti Rahmawati',
    initials: 'SR',
    position: 'Staf Pemasaran',
    department: 'Pemasaran',
    type: 'Sakit',
    startDate: '2026-11-18',
    endDate: '2026-11-18',
    days: 1,
    reason: 'Tidak dapat bekerja karena kondisi kesehatan.',
    attachmentName: 'Surat dokter.pdf',
    submittedAt: '2026-11-18',
    status: 'Menunggu persetujuan',
    isMock: true,
  },
  {
    id: 'pg-103',
    employeeId: 'HP-0004',
    name: 'Dimas Pratama',
    initials: 'DP',
    position: 'Akuntan',
    department: 'Keuangan',
    type: 'Lembur',
    startDate: '2026-11-15',
    endDate: '2026-11-15',
    days: 1,
    reason: 'Lembur tutup buku selama 3 jam.',
    submittedAt: '2026-11-15',
    status: 'Menunggu persetujuan',
    isMock: true,
  },
]
