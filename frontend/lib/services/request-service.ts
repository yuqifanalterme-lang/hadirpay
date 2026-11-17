import {
  mockRequests,
  requestStatuses,
  requestTypes,
  type ApprovalRequest,
  type RequestStatus,
  type RequestType,
} from '@/lib/mock/requests'
import {
  decideAttendanceCorrection,
  listAttendanceCorrections,
} from '@/lib/services/attendance-service'
import { notifyRequestsChanged } from '@/lib/services/request-events'

const requestStorageKey = 'hadirpay-demo-requests-v1'

function isRequest(value: unknown): value is ApprovalRequest {
  if (typeof value !== 'object' || value === null) return false
  const request = value as Record<string, unknown>
  return (
    typeof request.id === 'string' &&
    typeof request.employeeId === 'string' &&
    typeof request.name === 'string' &&
    typeof request.initials === 'string' &&
    typeof request.position === 'string' &&
    typeof request.department === 'string' &&
    typeof request.type === 'string' &&
    requestTypes.includes(request.type as RequestType) &&
    typeof request.startDate === 'string' &&
    typeof request.endDate === 'string' &&
    typeof request.days === 'number' &&
    typeof request.reason === 'string' &&
    typeof request.submittedAt === 'string' &&
    typeof request.status === 'string' &&
    requestStatuses.includes(request.status as RequestStatus) &&
    request.isMock === true
  )
}

function readRequests(): ApprovalRequest[] {
  if (typeof window === 'undefined') return mockRequests.map((request) => ({ ...request }))
  const stored = window.localStorage.getItem(requestStorageKey)
  if (stored === null) return mockRequests.map((request) => ({ ...request }))

  let parsed: unknown
  try {
    parsed = JSON.parse(stored)
  } catch (error) {
    throw new Error('Data pengajuan demo tidak dapat dibaca. Muat ulang atau bersihkan data demo.', {
      cause: error,
    })
  }
  if (!Array.isArray(parsed) || !parsed.every(isRequest)) {
    throw new Error('Format data pengajuan demo tidak valid. Bersihkan data demo sebelum melanjutkan.')
  }
  return parsed
}

function writeRequests(requests: ApprovalRequest[]) {
  window.localStorage.setItem(requestStorageKey, JSON.stringify(requests))
  notifyRequestsChanged()
}

function mapCorrection(correction: Awaited<ReturnType<typeof listAttendanceCorrections>>[number]): ApprovalRequest {
  return {
    id: correction.id,
    employeeId: 'HP-0001',
    name: 'Andi Wijaya',
    initials: 'AW',
    position: 'Staf Keuangan',
    department: 'Keuangan',
    type: 'Koreksi Absensi',
    startDate: correction.date,
    endDate: correction.date,
    days: 1,
    reason: `${correction.reason} (perubahan jam ${correction.field} menjadi ${correction.correctedTime})`,
    submittedAt: correction.submittedOn ?? correction.date,
    status:
      correction.status === 'Menunggu'
        ? 'Menunggu persetujuan'
        : correction.status,
    approvedBy: correction.approvedBy,
    rejectionReason: correction.rejectionReason,
    isMock: true,
  }
}

export async function listRequests(): Promise<ApprovalRequest[]> {
  const [requests, corrections] = await Promise.all([readRequests(), listAttendanceCorrections()])
  return [...requests, ...corrections.map(mapCorrection)].sort((a, b) =>
    b.submittedAt.localeCompare(a.submittedAt),
  )
}

export async function createRequest(
  request: Omit<ApprovalRequest, 'id' | 'submittedAt' | 'status' | 'approvedBy' | 'rejectionReason' | 'isMock'>,
  submittedAt = new Date(),
): Promise<ApprovalRequest> {
  const requests = readRequests()
  const created: ApprovalRequest = {
    ...request,
    id: `rq-${crypto.randomUUID()}`,
    submittedAt: `${submittedAt.getFullYear()}-${String(submittedAt.getMonth() + 1).padStart(2, '0')}-${String(submittedAt.getDate()).padStart(2, '0')}`,
    status: 'Menunggu persetujuan',
    isMock: true,
  }
  writeRequests([created, ...requests])
  return created
}

export async function decideRequest(
  id: string,
  decision: 'Disetujui' | 'Ditolak',
  decidedBy: string,
  rejectionReason = '',
): Promise<ApprovalRequest> {
  if (id.startsWith('koreksi-')) {
    const correction = await decideAttendanceCorrection(id, decision, decidedBy, rejectionReason)
    return mapCorrection(correction)
  }

  const requests = readRequests()
  const index = requests.findIndex((request) => request.id === id)
  if (index === -1) throw new Error('Pengajuan tidak ditemukan.')
  if (requests[index].status !== 'Menunggu persetujuan') {
    throw new Error('Pengajuan ini sudah diproses.')
  }
  if (decision === 'Ditolak' && !rejectionReason.trim()) {
    throw new Error('Alasan penolakan wajib diisi.')
  }

  const updated: ApprovalRequest = {
    ...requests[index],
    status: decision,
    approvedBy: decidedBy,
    rejectionReason: decision === 'Ditolak' ? rejectionReason.trim() : undefined,
  }
  requests[index] = updated
  writeRequests(requests)
  return updated
}
