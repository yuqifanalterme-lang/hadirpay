import { apiRequest } from '@/lib/api/client'
import { config } from '@/lib/config'
import { adminStats, adminWeek, attendanceTrend, employeeUser, recentAttendance } from '@/lib/mock-data'
import { latestRequest, payslip } from '@/lib/mock-data'
import { mockDepartmentAttendance, mockTardinessLeaderboard } from '@/lib/mock/reports'
import type {
  DashboardAdmin,
  DashboardKaryawan,
  DashboardKeuangan,
  DashboardPemilik,
} from '@/lib/types/dashboard'
import type { StatusBadgeStatus } from '@/components/hadirpay/status-badge'
import type { StatusPeriode } from '@/lib/types/common'
import type { JenisPengajuan } from '@/lib/types/common'
import type { RequestType } from '@/lib/mock/requests'
import { listRequests } from './request-service'

const demoDate = '2026-11-17'
const requestTypeToApi: Record<RequestType, JenisPengajuan> = {
  Izin: 'izin',
  Sakit: 'sakit',
  Cuti: 'cuti',
  'Koreksi Absensi': 'koreksi_absensi',
  Lembur: 'lembur',
}
const periodStatusLabels: Record<StatusPeriode, Extract<StatusBadgeStatus, 'Draft' | 'Menunggu validasi keuangan' | 'Disetujui' | 'Dibayar'>> = {
  draft: 'Draft',
  menunggu_validasi: 'Menunggu validasi keuangan',
  disetujui: 'Disetujui',
  dibayar: 'Dibayar',
}

export async function getFinanceDashboardView() {
  if (config.mock.dashboard) {
    const { getFinanceDashboardData } = await import('./report-service')
    const data = await getFinanceDashboardData()
    return {
      pendingCount: data.pendingValidation ? 1 : 0,
      paymentDateLabel: data.paymentDate,
      salaryPayable: data.salaryPayable,
      period: data.period.period,
      periodStatus: data.period.status,
      employeeCount: data.employeeCount,
      pendingNetPay: data.totalNetPay,
    }
  }
  const data = await getFinanceDashboard()
  const pendingPeriod = data.periode_menunggu_validasi[0]
  const scheduledPeriod = data.jadwal_pembayaran
  const period = pendingPeriod?.periode ?? scheduledPeriod?.periode ?? null
  return {
    pendingCount: data.periode_menunggu_validasi.length,
    paymentDateLabel: scheduledPeriod
      ? new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
        .format(new Date(`${scheduledPeriod.tanggal_bayar}T00:00:00`))
      : null,
    salaryPayable: data.saldo_utang_gaji,
    period,
    periodStatus: pendingPeriod
      ? periodStatusLabels.menunggu_validasi
      : scheduledPeriod
        ? periodStatusLabels[scheduledPeriod.status]
        : null,
    employeeCount: pendingPeriod?.jumlah_karyawan ?? null,
    pendingNetPay: pendingPeriod?.total_gaji_bersih ?? null,
  }
}

export async function getOwnerDashboardView() {
  if (config.mock.dashboard) {
    const { getOwnerDashboardData } = await import('./report-service')
    const data = await getOwnerDashboardData()
    return {
      payrollTotal: data.payrollTotal,
      employeeCount: data.employeeCount,
      payrollStatus: data.payrollStatus,
      payrollTrend: data.payrollTrend,
      attendanceByDepartment: data.attendanceByDepartment.map((item) => ({
        department: item.department,
        present: item.present,
        late: item.late,
        attendancePercent: item.employees ? (item.present / item.employees) * 100 : 0,
      })),
      tardiness: data.tardiness,
    }
  }
  const data = await getOwnerDashboard()
  return {
    payrollTotal: data.total_biaya_gaji_bulan_berjalan,
    employeeCount: null,
    payrollStatus: null,
    payrollTrend: data.tren_beban_gaji.map((item) => ({
      label: new Intl.DateTimeFormat('id-ID', { month: 'short' }).format(new Date(`${item.periode}-01T00:00:00`)),
      amount: item.total,
    })),
    attendanceByDepartment: data.kehadiran_per_departemen.map((item) => ({
      department: item.departemen,
      present: 0,
      late: 0,
      attendancePercent: item.persen_hadir,
    })),
    tardiness: data.top_keterlambatan.map((item) => ({
      employeeId: String(item.karyawan_id),
      employeeName: item.nama,
      department: item.departemen,
      lateDays: item.jumlah_terlambat,
      lateMinutes: item.total_menit,
    })),
  }
}

export async function getAdminDashboard(date?: string): Promise<DashboardAdmin> {
  if (!config.mock.dashboard) {
    const result = await apiRequest<DashboardAdmin>('dashboard/admin', { params: { tanggal: date } })
    return result.data
  }
  const requests = (await listRequests())
    .filter((request) => request.status === 'Menunggu persetujuan')
    .map((request) => ({
      id: Number(request.id.replace(/\D/g, '')) || 0,
      jenis: requestTypeToApi[request.type],
      karyawan: { id: Number(request.employeeId.replace(/\D/g, '')) || 0, nama: request.name, inisial: request.initials },
      judul: request.type,
      durasi_label: `${request.days} hari`,
      tanggal_mulai: request.startDate,
      tanggal_selesai: request.endDate,
    }))
  return {
    tanggal: date ?? demoDate,
    sapaan_rekap: {
      persen_terisi: 85,
      pengajuan_menunggu: requests.length,
      periode_ditutup: '2026-11-25',
    },
    statistik: {
      total_karyawan: adminStats.totalKaryawan,
      hadir_hari_ini: adminStats.hadir,
      persen_hadir: 85,
      terlambat: adminStats.terlambat,
      batas_terlambat: '08:00',
      tidak_hadir: { total: adminStats.tidakHadir, izin: 1, cuti: 1, alpha: 1 },
      total_gaji_bulan_berjalan: adminStats.totalGaji,
      periode_gaji: '2026-11',
    },
    kehadiran_minggu_ini: {
      rata_rata_minggu_lalu: 92,
      hari: adminWeek.map((day) => ({
        tanggal: day.date === '16 Nov' ? '2026-11-16' : day.date === '17 Nov' ? demoDate : '2026-11-18',
        persen_hadir: day.note ? Number(day.note.replace('%', '')) : null,
        status: day.state === 'today' ? 'hari_ini' : day.state === 'upcoming' ? 'akan_datang' : 'selesai',
      })),
    },
    tren_kehadiran: attendanceTrend.map((day, index) => ({
      tanggal: `2026-11-${String(9 + index).padStart(2, '0')}`,
      hadir: day.hadir,
      tepat_waktu: day.tepatWaktu,
    })),
    pengajuan_menunggu: requests,
    absensi_terbaru: recentAttendance.map((item) => ({
      karyawan: {
        id: Number(item.name.replace(/\D/g, '')) || 0,
        nama: item.name,
        inisial: item.name.split(' ').map((part) => part[0]).join(''),
      },
      departemen: item.division,
      jam_masuk: item.checkIn === '—' ? null : item.checkIn.replace('.', ':'),
      jam_pulang: item.checkOut === '—' ? null : item.checkOut.replace('.', ':'),
      status: item.status.toLowerCase().replace(' ', '_') as DashboardAdmin['absensi_terbaru'][number]['status'],
    })),
  }
}

export async function getEmployeeDashboard(): Promise<DashboardKaryawan> {
  if (!config.mock.dashboard) {
    const result = await apiRequest<DashboardKaryawan>('dashboard/karyawan')
    return result.data
  }
  return {
    tanggal: demoDate,
    server_time: '2026-11-17T07:52:10+07:00',
    jam_kerja: { masuk: '08:00', pulang: '17:00' },
    lokasi_kantor: { nama: 'Kantor Pusat', alamat: 'Jl. Sudirman No. 21, Jakarta' },
    absensi_hari_ini: { sudah_masuk: false, sudah_pulang: false, jam_masuk: null, jam_pulang: null, status: null },
    kehadiran_minggu_ini: { tercatat: 1, total_hari: 5, jumlah_terlambat: 0, hari: [] },
    slip_terakhir: {
      id: 118,
      periode: '2026-10',
      tanggal_terbit: '2026-10-31',
      gaji_bersih: payslip.net,
      total_pendapatan: payslip.earnings.reduce((sum, item) => sum + item.amount, 0),
      total_potongan: payslip.deductions.reduce((sum, item) => sum + item.amount, 0),
    },
    pengajuan_terakhir: {
      id: 29,
      jenis: 'cuti',
      judul: latestRequest.type,
      tanggal_mulai: '2026-11-24',
      status: 'disetujui',
      tanggal_diajukan: '2026-11-12',
      disetujui_oleh: latestRequest.approver,
    },
    jumlah_notifikasi: 1,
  }
}

export async function getFinanceDashboard(): Promise<DashboardKeuangan> {
  if (!config.mock.dashboard) {
    const result = await apiRequest<DashboardKeuangan>('dashboard/keuangan')
    return result.data
  }
  return {
    periode_menunggu_validasi: [],
    jadwal_pembayaran: { periode: '2026-10', tanggal_bayar: '2026-11-01', status: 'dibayar' },
    saldo_utang_gaji: 0,
    total_beban_gaji_bulan_berjalan: adminStats.totalGaji,
  }
}

export async function getOwnerDashboard(): Promise<DashboardPemilik> {
  if (!config.mock.dashboard) {
    const result = await apiRequest<DashboardPemilik>('dashboard/pemilik')
    return result.data
  }
  return {
    total_biaya_gaji_bulan_berjalan: adminStats.totalGaji,
    tren_beban_gaji: [],
    kehadiran_per_departemen: mockDepartmentAttendance.map((item) => ({
      departemen: item.department,
      persen_hadir: item.employees ? (item.present / item.employees) * 100 : 0,
    })),
    top_keterlambatan: mockTardinessLeaderboard.map((item) => ({
      karyawan_id: Number(item.employeeId.replace(/\D/g, '')) || 0,
      nama: item.employeeName,
      departemen: item.department,
      jumlah_terlambat: item.lateDays,
      total_menit: item.lateMinutes,
    })),
  }
}

export const dashboardDemoEmployeeName = employeeUser.name
