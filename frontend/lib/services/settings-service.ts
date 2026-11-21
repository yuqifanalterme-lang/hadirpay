import { mockSettings, type DemoSettings } from '@/lib/mock/settings'
import type { Role } from '@/lib/navigation'

const settingsStorageKey = 'hadirpay-demo-settings-v1'
export const settingsChangedEvent = 'hadirpay-settings-changed'
const roles: Role[] = ['admin', 'karyawan', 'keuangan', 'pemilik']

function isDemoSettings(value: unknown): value is DemoSettings {
  if (!value || typeof value !== 'object') return false
  const settings = value as Partial<DemoSettings>
  return Boolean(
    settings.company &&
    typeof settings.company.name === 'string' &&
    typeof settings.company.address === 'string' &&
    (settings.company.npwp === undefined || typeof settings.company.npwp === 'string') &&
    (settings.company.logoDataUrl === undefined || typeof settings.company.logoDataUrl === 'string') &&
    settings.workSchedule &&
    typeof settings.workSchedule.startTime === 'string' &&
    typeof settings.workSchedule.endTime === 'string' &&
    typeof settings.workSchedule.lateToleranceMinutes === 'number' &&
    Array.isArray(settings.workSchedule.workDays) &&
    Array.isArray(settings.workSchedule.holidays) &&
    (settings.workSchedule.annualLeaveQuota === undefined ||
      typeof settings.workSchedule.annualLeaveQuota === 'number') &&
    settings.payrollPolicy &&
    (settings.payrollPolicy.absenceDeductionMethod === 'per_day' ||
      settings.payrollPolicy.absenceDeductionMethod === 'fixed') &&
    typeof settings.payrollPolicy.absenceDeductionAmount === 'number' &&
    (settings.payrollPolicy.workDayDivisor === undefined ||
      typeof settings.payrollPolicy.workDayDivisor === 'string') &&
    (settings.payrollPolicy.deductPermitWithoutLetter === undefined ||
      typeof settings.payrollPolicy.deductPermitWithoutLetter === 'boolean') &&
    typeof settings.payrollPolicy.overtimeRatePerHour === 'number' &&
    typeof settings.payrollPolicy.cutoffDay === 'number' &&
    Array.isArray(settings.users) &&
    settings.users.every((user) =>
      typeof user.id === 'string' &&
      typeof user.name === 'string' &&
      typeof user.email === 'string' &&
      roles.includes(user.role),
    ) &&
    settings.attendanceLocation &&
    typeof settings.attendanceLocation.enabled === 'boolean' &&
    typeof settings.attendanceLocation.name === 'string' &&
    typeof settings.attendanceLocation.address === 'string' &&
    typeof settings.attendanceLocation.radiusMeters === 'number',
  )
}

function copyDefaults(): DemoSettings {
  return structuredClone(mockSettings)
}

function readSettings(): DemoSettings {
  if (typeof window === 'undefined') return copyDefaults()
  const stored = window.localStorage.getItem(settingsStorageKey)
  if (!stored) return copyDefaults()

  let parsed: unknown
  try {
    parsed = JSON.parse(stored)
  } catch (error) {
    throw new Error('Pengaturan demo tidak dapat dibaca. Coba muat ulang atau bersihkan data demo.', { cause: error })
  }
  if (!isDemoSettings(parsed)) {
    throw new Error('Format pengaturan demo tidak valid. Periksa atau bersihkan data demo sebelum melanjutkan.')
  }
  const defaults = copyDefaults()
  return {
    ...defaults,
    ...parsed,
    company: { ...defaults.company, ...parsed.company },
    workSchedule: { ...defaults.workSchedule, ...parsed.workSchedule },
    payrollPolicy: { ...defaults.payrollPolicy, ...parsed.payrollPolicy },
  }
}

function validateSettings(settings: DemoSettings) {
  if (!settings.company.name.trim()) throw new Error('Nama perusahaan wajib diisi.')
  if (!settings.workSchedule.workDays.length) throw new Error('Pilih setidaknya satu hari kerja.')
  if (!/^\d{2}:\d{2}$/.test(settings.workSchedule.startTime) ||
      !/^\d{2}:\d{2}$/.test(settings.workSchedule.endTime) ||
      settings.workSchedule.startTime >= settings.workSchedule.endTime) {
    throw new Error('Jam kerja harus valid dan jam masuk harus lebih awal dari jam pulang.')
  }
  if (!Number.isInteger(settings.workSchedule.lateToleranceMinutes) ||
      settings.workSchedule.lateToleranceMinutes < 0 ||
      settings.workSchedule.lateToleranceMinutes > 180) {
    throw new Error('Toleransi keterlambatan harus antara 0 sampai 180 menit.')
  }
  if (!Number.isInteger(settings.workSchedule.annualLeaveQuota) ||
      settings.workSchedule.annualLeaveQuota < 0) {
    throw new Error('Kuota cuti tahunan harus berupa bilangan bulat yang tidak negatif.')
  }
  const divisor = settings.payrollPolicy.workDayDivisor
  if (divisor && (!Number.isFinite(Number(divisor)) || Number(divisor) <= 0)) {
    throw new Error('Pembagi hari kerja harus lebih besar dari nol.')
  }
  if (settings.payrollPolicy.absenceDeductionAmount < 0 ||
      settings.payrollPolicy.overtimeRatePerHour < 0 ||
      !Number.isInteger(settings.payrollPolicy.cutoffDay) ||
      settings.payrollPolicy.cutoffDay < 1 ||
      settings.payrollPolicy.cutoffDay > 28) {
    throw new Error('Kebijakan penggajian harus berisi nilai yang valid.')
  }
  if (!settings.users.some((user) => user.role === 'admin')) {
    throw new Error('Setidaknya satu pengguna harus memiliki hak akses Admin/HRD.')
  }
  if (settings.users.some((user) => !user.name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email))) {
    throw new Error('Nama dan alamat email pengguna harus valid.')
  }
  if (!settings.attendanceLocation.name.trim() || !settings.attendanceLocation.address.trim() ||
      !Number.isInteger(settings.attendanceLocation.radiusMeters) ||
      settings.attendanceLocation.radiusMeters < 50 ||
      settings.attendanceLocation.radiusMeters > 10000) {
    throw new Error('Lokasi absensi harus diisi dengan radius 50 sampai 10.000 meter.')
  }
}

export async function getDemoSettings(): Promise<DemoSettings> {
  return readSettings()
}

export async function saveDemoSettings(settings: DemoSettings): Promise<DemoSettings> {
  validateSettings(settings)
  if (typeof window === 'undefined') {
    throw new Error('Pengaturan demo hanya dapat disimpan dari browser.')
  }
  window.localStorage.setItem(settingsStorageKey, JSON.stringify(settings))
  window.dispatchEvent(new Event(settingsChangedEvent))
  return structuredClone(settings)
}
