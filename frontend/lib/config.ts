function readBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === '') return fallback
  return value.trim().toLowerCase() === 'true'
}

const useMock = readBoolean(process.env.NEXT_PUBLIC_USE_MOCK, true)

export const config = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, '') ?? '',
  useMock,
  mock: {
    auth: readBoolean(process.env.NEXT_PUBLIC_MOCK_AUTH, useMock),
    dashboard: readBoolean(process.env.NEXT_PUBLIC_MOCK_DASHBOARD, useMock),
    karyawan: readBoolean(process.env.NEXT_PUBLIC_MOCK_KARYAWAN, useMock),
    absensi: readBoolean(process.env.NEXT_PUBLIC_MOCK_ABSENSI, useMock),
    pengajuan: readBoolean(process.env.NEXT_PUBLIC_MOCK_PENGAJUAN, useMock),
    penggajian: readBoolean(process.env.NEXT_PUBLIC_MOCK_PENGGAJIAN, useMock),
    akuntansi: readBoolean(process.env.NEXT_PUBLIC_MOCK_AKUNTANSI, useMock),
    laporan: readBoolean(process.env.NEXT_PUBLIC_MOCK_LAPORAN, useMock),
    notifikasi: readBoolean(process.env.NEXT_PUBLIC_MOCK_NOTIFIKASI, useMock),
    pengaturan: readBoolean(process.env.NEXT_PUBLIC_MOCK_PENGATURAN, useMock),
  },
} as const
