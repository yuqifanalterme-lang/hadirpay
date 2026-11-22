import { apiRequest, ApiError } from '@/lib/api/client'
import { config } from '@/lib/config'
import { mockSettings, type DemoSettings, type WorkingDay } from '@/lib/mock/settings'
import type { Pengaturan, Pengguna as ApiUser, HariLibur } from '@/lib/types/pengaturan'
import type { ResetPasswordResponse } from '@/lib/types/karyawan'
import {
  getDemoSettings as getDemoSettingsMock,
  saveDemoSettings as saveDemoSettingsMock,
  settingsChangedEvent,
} from './settings-service'

export { settingsChangedEvent }

const apiRoleToUi = {
  admin_hrd: 'admin',
  karyawan: 'karyawan',
  keuangan: 'keuangan',
  pemilik: 'pemilik',
} as const
const uiRoleToApi = {
  admin: 'admin_hrd',
  karyawan: 'karyawan',
  keuangan: 'keuangan',
  pemilik: 'pemilik',
} as const

function mapSettings(settings: Pengaturan, holidays: HariLibur[], users: ApiUser[]): DemoSettings {
  const location = settings.lokasi_absensi[0]
  return {
    company: {
      name: settings.perusahaan.nama,
      address: settings.perusahaan.alamat,
      npwp: settings.perusahaan.npwp ?? '',
      logoUrl: settings.perusahaan.logo_url ?? undefined,
    },
    workSchedule: {
      startTime: settings.jadwal_kerja.jam_masuk,
      endTime: settings.jadwal_kerja.jam_pulang,
      lateToleranceMinutes: settings.jadwal_kerja.toleransi_menit,
      workDays: settings.jadwal_kerja.hari_kerja,
      holidays: holidays.map((holiday) => ({ date: holiday.tanggal, name: holiday.nama })),
      annualLeaveQuota: settings.kuota_cuti_tahunan,
    },
    payrollPolicy: {
      absenceDeductionMethod: 'per_day',
      absenceDeductionAmount: 0,
      apiAbsenceDeductionMethod: settings.kebijakan_gaji.metode_potongan_alpha,
      workDayDivisor: settings.kebijakan_gaji.pembagi_hari_kerja,
      deductPermitWithoutLetter: settings.kebijakan_gaji.potongan_izin_tanpa_surat,
      overtimeRatePerHour: settings.kebijakan_gaji.tarif_lembur_per_jam,
      cutoffDay: settings.kebijakan_gaji.tanggal_tutup_periode,
    },
    users: users.map((user) => ({
      id: String(user.id),
      name: user.nama,
      email: user.email,
      role: apiRoleToUi[user.role],
      active: user.aktif,
    })),
    attendanceLocation: {
      enabled: location?.wajib_lokasi ?? false,
      name: location?.nama ?? '',
      address: location?.alamat ?? '',
      radiusMeters: location?.radius_meter ?? 0,
    },
    apiAttendanceLocations: settings.lokasi_absensi.map((item) => ({ ...item })),
  }
}

async function loadLiveSettings(): Promise<DemoSettings> {
  const apiResult = await apiRequest<Pengaturan>('pengaturan')
  const year = new Date().getFullYear()
  const [holidaysResult, usersResult] = await Promise.all([
    apiRequest<HariLibur[]>('hari-libur', { params: { tahun: year } }),
    apiRequest<ApiUser[]>('pengguna'),
  ])
  return mapSettings(apiResult.data, holidaysResult.data, usersResult.data)
}

export async function getDemoSettings(): Promise<DemoSettings> {
  if (config.mock.pengaturan) return getDemoSettingsMock()
  return loadLiveSettings()
}

function fileFromDataUrl(dataUrl: string): File {
  const [metadata, encoded] = dataUrl.split(',')
  if (!metadata || !encoded) throw new ApiError(0, 'INVALID_LOGO_DATA', 'Format gambar logo tidak valid.')
  const mimeType = metadata.match(/^data:(.*?);base64$/)?.[1]
  if (!mimeType) throw new ApiError(0, 'INVALID_LOGO_DATA', 'Format gambar logo tidak valid.')
  const binary = atob(encoded)
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
  return new File([bytes], 'logo', { type: mimeType })
}

export async function saveDemoSettings(settings: DemoSettings): Promise<DemoSettings> {
  if (config.mock.pengaturan) return saveDemoSettingsMock(settings)

  const currentSettings = await apiRequest<Pengaturan>('pengaturan')
  const oldHolidays = await apiRequest<HariLibur[]>('hari-libur', {
    params: { tahun: new Date().getFullYear() },
  })
  const currentUsers = await apiRequest<ApiUser[]>('pengguna')
  const locations = currentSettings.data.lokasi_absensi.map((item) => ({ ...item }))
  const selectedLocation = settings.apiAttendanceLocations?.[0]
  const selectedLocationIndex = selectedLocation
    ? locations.findIndex((item) => String(item.id) === String(selectedLocation.id))
    : -1
  if (selectedLocation && selectedLocationIndex < 0) {
    throw new ApiError(409, 'ATTENDANCE_LOCATION_NOT_FOUND', 'Lokasi absensi yang dipilih tidak lagi tersedia.')
  }
  if (!selectedLocation && locations.length > 0) {
    throw new ApiError(0, 'ATTENDANCE_LOCATION_CONTEXT_MISSING', 'Data lokasi absensi dari API tidak tersedia untuk disimpan.')
  }
  const updatedLocations = locations.map((item, index) => index === selectedLocationIndex
    ? {
        ...item,
        nama: settings.attendanceLocation.name,
        alamat: settings.attendanceLocation.address,
        radius_meter: settings.attendanceLocation.radiusMeters,
        wajib_lokasi: settings.attendanceLocation.enabled,
      }
    : item)
  if (settings.payrollPolicy.apiAbsenceDeductionMethod !== currentSettings.data.kebijakan_gaji.metode_potongan_alpha) {
    throw new ApiError(
      0,
      'SETTINGS_DEDUCTION_METHOD_UNSUPPORTED',
      'Metode potongan alpha dari API belum memiliki pemetaan yang disepakati dengan tampilan.',
    )
  }

  await apiRequest<Pengaturan>('pengaturan', {
    method: 'PUT',
    body: {
      perusahaan: {
        nama: settings.company.name,
        alamat: settings.company.address,
        npwp: settings.company.npwp.trim() || null,
        logo_url: currentSettings.data.perusahaan.logo_url,
      },
      jadwal_kerja: {
        jam_masuk: settings.workSchedule.startTime,
        jam_pulang: settings.workSchedule.endTime,
        toleransi_menit: settings.workSchedule.lateToleranceMinutes,
        hari_kerja: settings.workSchedule.workDays,
      },
      kuota_cuti_tahunan: settings.workSchedule.annualLeaveQuota,
      kebijakan_gaji: {
        ...currentSettings.data.kebijakan_gaji,
        pembagi_hari_kerja: settings.payrollPolicy.workDayDivisor,
        tarif_lembur_per_jam: settings.payrollPolicy.overtimeRatePerHour,
        tanggal_tutup_periode: settings.payrollPolicy.cutoffDay,
        potongan_izin_tanpa_surat: settings.payrollPolicy.deductPermitWithoutLetter,
      },
      lokasi_absensi: updatedLocations,
    },
  })

  const oldByDate = new Map(oldHolidays.data.map((holiday) => [holiday.tanggal, holiday]))
  const newByDate = new Map(settings.workSchedule.holidays.map((holiday) => [holiday.date, holiday]))
  await Promise.all([
    ...settings.workSchedule.holidays
      .filter((holiday) => !oldByDate.has(holiday.date))
      .map((holiday) => apiRequest<HariLibur>('hari-libur', {
        method: 'POST',
        body: { tanggal: holiday.date, nama: holiday.name },
      })),
    ...oldHolidays.data
      .filter((holiday) => !newByDate.has(holiday.tanggal))
      .map((holiday) => apiRequest<null>(`hari-libur/${holiday.id}`, { method: 'DELETE' })),
    ...settings.users.map((user) => {
      const current = currentUsers.data.find((item) => item.email === user.email)
      if (!current) return Promise.resolve()
      if (apiRoleToUi[current.role] === user.role) return Promise.resolve()
      return apiRequest<ApiUser>(`pengguna/${current.id}/role`, {
        method: 'PUT',
        body: { role: uiRoleToApi[user.role] },
      })
    }),
  ])

  if (settings.company.logoDataUrl?.startsWith('data:')) {
    const formData = new FormData()
    formData.append('logo', fileFromDataUrl(settings.company.logoDataUrl))
    await apiRequest<{ logo_url: string }>('pengaturan/logo', {
      method: 'POST',
      formData,
    })
  }
  return loadLiveSettings()
}

export function getWorkingDaysForSettings(): WorkingDay[] {
  return [...mockSettings.workSchedule.workDays]
}

export async function resetUserPasswordForSettings(id: string): Promise<ResetPasswordResponse> {
  if (config.mock.pengaturan) {
    throw new ApiError(0, 'MOCK_USERS_UNAVAILABLE', 'Reset password pengguna belum tersedia.')
  }
  const parsed = Number(id)
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new ApiError(0, 'INVALID_RESOURCE_ID', 'ID pengguna harus berupa bilangan bulat positif dari API.')
  }
  const result = await apiRequest<ResetPasswordResponse>(`pengguna/${parsed}/reset-password`, {
    method: 'POST',
    body: {},
  })
  return result.data
}

export async function updateUserStatusForSettings(id: string, aktif: boolean): Promise<ApiUser> {
  if (config.mock.pengaturan) {
    throw new ApiError(0, 'MOCK_USERS_UNAVAILABLE', 'Perubahan status pengguna belum tersedia.')
  }
  const parsed = Number(id)
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new ApiError(0, 'INVALID_RESOURCE_ID', 'ID pengguna harus berupa bilangan bulat positif dari API.')
  }
  const result = await apiRequest<ApiUser>(`pengguna/${parsed}/status`, {
    method: 'PATCH',
    body: { aktif },
  })
  return result.data
}
