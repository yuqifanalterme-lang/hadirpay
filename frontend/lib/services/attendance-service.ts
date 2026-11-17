import {
  attendanceStatuses,
  mockEmployeeAttendance,
  type AttendanceCorrection,
  type EmployeeAttendanceRecord,
  type EmployeeAttendanceStatus,
} from '@/lib/mock/attendance'
import { notifyRequestsChanged } from '@/lib/services/request-events'

const attendanceStorageKey = 'hadirpay-demo-attendance-v1'
const correctionStorageKey = 'hadirpay-demo-attendance-corrections-v1'

function isAttendanceRecord(value: unknown): value is EmployeeAttendanceRecord {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return (
    typeof record.date === 'string' &&
    (record.checkIn === null || typeof record.checkIn === 'string') &&
    (record.checkOut === null || typeof record.checkOut === 'string') &&
    typeof record.status === 'string' &&
    attendanceStatuses.includes(record.status as EmployeeAttendanceStatus) &&
    record.isMock === true
  )
}

function isCorrection(value: unknown): value is AttendanceCorrection {
  if (typeof value !== 'object' || value === null) return false
  const correction = value as Record<string, unknown>
  return (
    typeof correction.id === 'string' &&
    typeof correction.date === 'string' &&
    (correction.field === 'Masuk' || correction.field === 'Pulang') &&
    typeof correction.correctedTime === 'string' &&
    typeof correction.reason === 'string' &&
    typeof correction.submittedAt === 'string' &&
    (correction.status === 'Menunggu' ||
      correction.status === 'Disetujui' ||
      correction.status === 'Ditolak') &&
    correction.isMock === true
  )
}

function readStoredData<T>(
  key: string,
  fallback: T[],
  isItem: (value: unknown) => value is T,
  label: string,
): T[] {
  if (typeof window === 'undefined') return fallback.map((item) => ({ ...item }))
  const stored = window.localStorage.getItem(key)
  if (stored === null) return fallback.map((item) => ({ ...item }))

  let parsed: unknown
  try {
    parsed = JSON.parse(stored)
  } catch (error) {
    throw new Error(`Data ${label} demo tidak dapat dibaca. Muat ulang atau bersihkan data demo.`, {
      cause: error,
    })
  }
  if (!Array.isArray(parsed) || !parsed.every(isItem)) {
    throw new Error(`Format data ${label} demo tidak valid. Bersihkan data demo sebelum melanjutkan.`)
  }
  return parsed
}

function readAttendance(): EmployeeAttendanceRecord[] {
  return readStoredData(attendanceStorageKey, mockEmployeeAttendance, isAttendanceRecord, 'kehadiran')
}

function readCorrections(): AttendanceCorrection[] {
  return readStoredData(correctionStorageKey, [], isCorrection, 'koreksi kehadiran')
}

function writeAttendance(records: EmployeeAttendanceRecord[]) {
  window.localStorage.setItem(attendanceStorageKey, JSON.stringify(records))
}

function writeCorrections(corrections: AttendanceCorrection[]) {
  window.localStorage.setItem(correctionStorageKey, JSON.stringify(corrections))
  notifyRequestsChanged()
}

export function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function formatAttendanceTime(date: Date) {
  return new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(date).replace(':', '.')
}

function getAttendanceStatus(date: Date): EmployeeAttendanceStatus {
  const minutes = date.getHours() * 60 + date.getMinutes()
  return minutes > 8 * 60 ? 'Terlambat' : 'Hadir'
}

export async function listAttendanceRecords(): Promise<EmployeeAttendanceRecord[]> {
  return readAttendance().sort((a, b) => b.date.localeCompare(a.date))
}

export async function recordCheckIn(
  date: Date,
): Promise<EmployeeAttendanceRecord & { checkIn: string }> {
  const records = readAttendance()
  const dateKey = getLocalDateKey(date)
  if (records.some((record) => record.date === dateKey)) {
    throw new Error('Absensi hari ini sudah tercatat.')
  }

  const record: EmployeeAttendanceRecord & { checkIn: string } = {
    date: dateKey,
    checkIn: formatAttendanceTime(date),
    checkOut: null,
    status: getAttendanceStatus(date),
    isMock: true,
  }
  writeAttendance([record, ...records])
  return record
}

export async function recordCheckOut(
  date: Date,
): Promise<EmployeeAttendanceRecord & { checkIn: string; checkOut: string }> {
  const records = readAttendance()
  const dateKey = getLocalDateKey(date)
  const index = records.findIndex((record) => record.date === dateKey)
  const existing = records[index]
  if (!existing?.checkIn) throw new Error('Absen masuk hari ini belum tercatat.')
  if (existing.checkOut) throw new Error('Absen pulang hari ini sudah tercatat.')
  const checkIn = existing.checkIn

  const updated: EmployeeAttendanceRecord & { checkIn: string; checkOut: string } = {
    ...existing,
    checkIn,
    checkOut: formatAttendanceTime(date),
    isMock: true,
  }
  records[index] = updated
  writeAttendance(records)
  return updated
}

export async function submitAttendanceCorrection(
  correction: Omit<AttendanceCorrection, 'id' | 'submittedAt' | 'status' | 'isMock'>,
  submittedAt = new Date(),
): Promise<AttendanceCorrection> {
  const corrections = readCorrections()
  const request: AttendanceCorrection = {
    ...correction,
    id: `koreksi-${correction.date}-${correction.field.toLowerCase()}-${submittedAt.getTime()}`,
    submittedAt: formatAttendanceTime(submittedAt),
    submittedOn: getLocalDateKey(submittedAt),
    status: 'Menunggu',
    isMock: true,
  }
  writeCorrections([request, ...corrections])
  return request
}

export async function listAttendanceCorrections(): Promise<AttendanceCorrection[]> {
  return readCorrections()
}

export async function decideAttendanceCorrection(
  id: string,
  status: 'Disetujui' | 'Ditolak',
  approvedBy: string,
  rejectionReason = '',
): Promise<AttendanceCorrection> {
  const corrections = readCorrections()
  const index = corrections.findIndex((correction) => correction.id === id)
  if (index === -1) throw new Error('Pengajuan koreksi tidak ditemukan.')
  if (corrections[index].status !== 'Menunggu') throw new Error('Pengajuan koreksi ini sudah diproses.')
  if (status === 'Ditolak' && !rejectionReason.trim()) {
    throw new Error('Alasan penolakan wajib diisi.')
  }

  const updated: AttendanceCorrection = {
    ...corrections[index],
    status,
    approvedBy,
    rejectionReason: status === 'Ditolak' ? rejectionReason.trim() : undefined,
  }
  corrections[index] = updated
  writeCorrections(corrections)
  return updated
}
