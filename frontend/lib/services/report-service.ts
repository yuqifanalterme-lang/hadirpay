import { adminStats, formatRupiah } from '@/lib/mock-data'
import {
  attendanceReportRows,
  demoPaymentDate,
  mockDepartmentAttendance,
  mockPayrollExpenseTrend,
  mockTardinessLeaderboard,
  reportCatalog,
  reportDepartments,
  type ReportId,
} from '@/lib/mock/reports'
import { getTrialBalance, listJournalEntries } from '@/lib/services/accounting-service'
import { listRequests } from '@/lib/services/request-service'
import { getPayrollPeriod, listPayrollLines } from '@/lib/services/payroll-service'

export type ReportMetric = {
  label: string
  value: string
  hint: string
  icon: 'users' | 'check' | 'clock' | 'calendar' | 'wallet' | 'file' | 'scale'
}

export type ReportRow = Record<string, string | number>

export type ReportDataset = {
  title: string
  description: string
  columns: { key: string; label: string }[]
  rows: ReportRow[]
  metrics: ReportMetric[]
  chartTitle: string
  chart: { label: string; value?: number; valueA?: number; valueB?: number }[]
  emptyDescription: string
  pagination?: { page: number; per_page: number; total: number; total_pages: number }
}

export const reportOptions = reportCatalog
export const reportDepartmentOptions = reportDepartments

function metric(
  label: string,
  value: string,
  hint: string,
  icon: ReportMetric['icon'],
): ReportMetric {
  return { label, value, hint, icon }
}

function makeDataset(
  id: ReportId,
  columns: ReportDataset['columns'],
  rows: ReportRow[],
  metrics: ReportMetric[],
  chartTitle: string,
  chart: ReportDataset['chart'],
  emptyDescription: string,
): ReportDataset {
  const definition = reportCatalog.find((item) => item.id === id)
  if (!definition) throw new Error('Jenis laporan tidak ditemukan.')
  return { ...definition, columns, rows, metrics, chartTitle, chart, emptyDescription }
}

function isSupportedPeriod(period: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(period)
}

function noPeriodData(id: ReportId, emptyDescription?: string) {
  return makeDataset(
    id,
    [],
    [],
    [],
    'Grafik belum tersedia',
    [],
    emptyDescription ?? 'Data demo yang tersedia hanya mencakup November 2026. Pilih periode tersebut untuk melihat laporan.',
  )
}

function filterDepartment<T extends { department: string }>(rows: T[], department: string) {
  return department === 'Semua departemen'
    ? rows
    : rows.filter((row) => row.department === department)
}

function reportRowsByDepartment(rows: ReportRow[], department: string) {
  return department === 'Semua departemen'
    ? rows
    : rows.filter((row) => row.departemen === department)
}

function formatMonth(period: string) {
  const [year, month] = period.split('-').map(Number)
  return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1))
}

function formatReportDate(date: string) {
  const [year, month, day] = date.split('-').map(Number)
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(year, month - 1, day))
}

export async function listReportCatalog() {
  return reportCatalog
}

export async function getReportDataset(
  id: ReportId,
  period: string,
  department: string,
): Promise<ReportDataset> {
  if (!isSupportedPeriod(period)) throw new Error('Pilih periode laporan yang valid.')
  if (!reportCatalog.some((item) => item.id === id)) throw new Error('Jenis laporan tidak ditemukan.')
  if (id === 'beban-gaji' && period !== '2026-11' && department !== 'Semua departemen') {
    return noPeriodData(id, 'Rincian beban gaji per departemen hanya tersedia untuk November 2026.')
  }
  if (period !== '2026-11' && id !== 'beban-gaji') return noPeriodData(id)

  if (id === 'kehadiran') {
    const departments = filterDepartment(mockDepartmentAttendance, department)
    const attendanceRows = reportRowsByDepartment(attendanceReportRows.map((row) => ({
      tanggal: row.date,
      karyawan: row.employeeName,
      departemen: row.department,
      masuk: row.checkIn,
      pulang: row.checkOut,
      status: row.status,
    })), department)
    const totals = departments.reduce(
      (result, item) => ({
        employees: result.employees + item.employees,
        present: result.present + item.present,
        late: result.late + item.late,
        absent: result.absent + item.permission + item.sick + item.leave + item.absent,
      }),
      { employees: 0, present: 0, late: 0, absent: 0 },
    )
    return makeDataset(id,
      [
        { key: 'departemen', label: 'Departemen' },
        { key: 'totalKaryawan', label: 'Total karyawan' },
        { key: 'hadir', label: 'Hadir' },
        { key: 'terlambat', label: 'Terlambat' },
        { key: 'tidakHadir', label: 'Tidak hadir' },
      ],
      departments.map((item) => ({
        departemen: item.department,
        totalKaryawan: item.employees,
        hadir: item.present,
        terlambat: item.late,
        tidakHadir: item.permission + item.sick + item.leave + item.absent,
      })),
      [
        metric('Total karyawan', String(totals.employees), 'Karyawan pada departemen terpilih', 'users'),
        metric('Hadir', String(department === 'Semua departemen' ? adminStats.hadir : totals.present), 'Rekap 17 Nov 2026', 'check'),
        metric('Terlambat', String(department === 'Semua departemen' ? adminStats.terlambat : totals.late), 'Lewat pukul 08.00', 'clock'),
      ],
      'Karyawan hadir per departemen',
      departments.map((item) => ({ label: item.department, value: item.present })),
      attendanceRows.length
        ? ''
        : 'Tidak ada catatan kehadiran untuk departemen terpilih pada tanggal ini.',
    )
  }

  if (id === 'keterlambatan') {
    const rows = filterDepartment(mockTardinessLeaderboard, department)
    const lateDays = rows.reduce((total, row) => total + row.lateDays, 0)
    const lateMinutes = rows.reduce((total, row) => total + row.lateMinutes, 0)
    return makeDataset(id,
      [
        { key: 'karyawan', label: 'Karyawan' },
        { key: 'departemen', label: 'Departemen' },
        { key: 'jumlahHari', label: 'Hari terlambat' },
        { key: 'totalMenit', label: 'Total menit' },
      ],
      rows.map((row) => ({
        karyawan: row.employeeName,
        departemen: row.department,
        jumlahHari: row.lateDays,
        totalMenit: row.lateMinutes,
      })),
      [
        metric('Karyawan tercatat', String(rows.length), 'Pada daftar keterlambatan demo', 'users'),
        metric('Hari terlambat', String(lateDays), 'Akumulasi dari daftar', 'calendar'),
        metric('Total menit', String(lateMinutes), 'Akumulasi dari daftar', 'clock'),
      ],
      'Menit keterlambatan per karyawan',
      rows.map((row) => ({ label: row.employeeName, value: row.lateMinutes })),
      'Belum ada data keterlambatan untuk departemen terpilih.',
    )
  }

  if (id === 'izin-cuti') {
    const requests = (await listRequests())
      .filter((request) =>
        ['Izin', 'Sakit', 'Cuti'].includes(request.type) &&
        request.startDate.slice(0, 7) === period &&
        (department === 'Semua departemen' || request.department === department),
      )
    const waiting = requests.filter((request) => request.status === 'Menunggu persetujuan').length
    const approved = requests.filter((request) => request.status === 'Disetujui').length
    const categoryCounts = ['Izin', 'Sakit', 'Cuti'].map((type) => ({
      label: type,
      value: requests.filter((request) => request.type === type).length,
    }))
    return makeDataset(id,
      [
        { key: 'karyawan', label: 'Karyawan' },
        { key: 'departemen', label: 'Departemen' },
        { key: 'jenis', label: 'Jenis' },
        { key: 'tanggal', label: 'Tanggal' },
        { key: 'hari', label: 'Hari' },
        { key: 'status', label: 'Status' },
      ],
      requests.map((request) => ({
        karyawan: request.name,
        departemen: request.department,
        jenis: request.type,
        tanggal: request.startDate === request.endDate
          ? formatReportDate(request.startDate)
          : `${formatReportDate(request.startDate)} - ${formatReportDate(request.endDate)}`,
        hari: request.days,
        status: request.status,
      })),
      [
        metric('Total pengajuan', String(requests.length), formatMonth(period), 'file'),
        metric('Menunggu', String(waiting), 'Perlu ditinjau Admin/HRD', 'clock'),
        metric('Disetujui', String(approved), 'Pada periode terpilih', 'check'),
      ],
      'Jumlah pengajuan per jenis',
      categoryCounts,
      'Belum ada pengajuan izin, sakit, atau cuti pada periode dan departemen terpilih.',
    )
  }

  if (id === 'lembur') {
    const lines = (await listPayrollLines())
      .filter((line) => !line.isAggregate && line.overtimeHours > 0)
      .filter((line) => department === 'Semua departemen' || line.department === department)
    const hours = lines.reduce((total, line) => total + line.overtimeHours, 0)
    const overtimePay = lines.reduce((total, line) => total + line.overtimePay, 0)
    const chart = reportDepartments.map((name) => ({
      label: name,
      value: lines.filter((line) => line.department === name)
        .reduce((total, line) => total + line.overtimeHours, 0),
    })).filter((item) => item.value > 0)
    return makeDataset(id,
      [
        { key: 'karyawan', label: 'Karyawan' },
        { key: 'departemen', label: 'Departemen' },
        { key: 'jam', label: 'Jam lembur' },
        { key: 'nilai', label: 'Nilai lembur' },
      ],
      lines.map((line) => ({
        karyawan: line.employeeName,
        departemen: line.department,
        jam: line.overtimeHours,
        nilai: formatRupiah(line.overtimePay),
      })),
      [
        metric('Karyawan lembur', String(lines.length), formatMonth(period), 'users'),
        metric('Total jam', String(hours), 'Dari rincian payroll individu', 'clock'),
        metric('Nilai lembur', formatRupiah(overtimePay), 'Termasuk dalam penggajian bulanan', 'wallet'),
      ],
      'Jam lembur per departemen',
      chart,
      'Belum ada rincian lembur untuk departemen terpilih.',
    )
  }

  if (id === 'penggajian-bulanan') {
    const lines = (await listPayrollLines())
      .filter((line) =>
        department === 'Semua departemen'
          ? true
          : !line.isAggregate && line.department === department,
      )
    const total = lines.reduce((sum, line) => sum + line.netPay, 0)
    const employeeCount = lines.reduce((sum, line) => sum + line.employeeCount, 0)
    const periodInfo = await getPayrollPeriod()
    return makeDataset(id,
      [
        { key: 'karyawan', label: 'Karyawan' },
        { key: 'departemen', label: 'Departemen' },
        { key: 'jenis', label: 'Jenis penggajian' },
        { key: 'gajiBersih', label: 'Gaji bersih' },
        { key: 'catatan', label: 'Catatan' },
      ],
      lines.map((line) => ({
        karyawan: line.employeeName,
        departemen: line.department,
        jenis: line.isAggregate ? 'Agregat' : line.payrollType,
        gajiBersih: formatRupiah(line.netPay),
        catatan: line.isAggregate ? `${line.employeeCount} karyawan, tanpa rincian individu` : 'Data contoh individu',
      })),
      [
        metric(
          'Total gaji bersih',
          formatRupiah(total),
          department === 'Semua departemen'
            ? 'Sama dengan ringkasan payroll untuk periode'
            : 'Subtotal dari rincian individu departemen',
          'wallet',
        ),
        metric('Karyawan', String(employeeCount), 'Karyawan pada rincian terpilih', 'users'),
        metric('Status periode', periodInfo.status, 'November 2026', 'file'),
      ],
      'Gaji bersih per karyawan',
      lines.map((line) => ({
        label: line.isAggregate ? `${line.employeeCount} karyawan lain` : line.employeeName,
        value: line.netPay,
      })),
      'Belum ada rincian penggajian untuk departemen terpilih.',
    )
  }

  if (id === 'beban-gaji') {
    const trend = mockPayrollExpenseTrend.filter((item) => item.period <= period)
    const selected = trend.find((item) => item.period === period)
    if (!selected) return noPeriodData(id)
    const departmentLines = department === 'Semua departemen'
      ? []
      : (await listPayrollLines()).filter((line) => !line.isAggregate && line.department === department)
    const total = department === 'Semua departemen'
      ? selected.amount
      : departmentLines.reduce((sum, line) => sum + line.netPay, 0)
    const departmentHeadCount = department === 'Semua departemen'
      ? adminStats.totalKaryawan
      : mockDepartmentAttendance.find((item) => item.department === department)?.employees ?? 0
    const rows = department === 'Semua departemen'
      ? trend.map((item) => ({ periode: item.label, biayaGaji: formatRupiah(item.amount) }))
      : departmentLines.map((line) => ({ periode: line.employeeName, biayaGaji: formatRupiah(line.netPay) }))
    return makeDataset(id,
      department === 'Semua departemen'
        ? [{ key: 'periode', label: 'Periode' }, { key: 'biayaGaji', label: 'Beban gaji' }]
        : [{ key: 'periode', label: 'Karyawan' }, { key: 'biayaGaji', label: 'Gaji bersih' }],
      rows,
      [
        metric(
          department === 'Semua departemen' ? 'Beban gaji' : 'Subtotal gaji bersih',
          formatRupiah(total),
          department === 'Semua departemen'
            ? `${formatMonth(period)} · data demo`
            : 'Rincian individu, bukan total departemen',
          'wallet',
        ),
        metric('Periode tersedia', String(trend.length), 'Riwayat contoh mulai Juni 2026', 'calendar'),
        metric(
          department === 'Semua departemen' ? 'Total karyawan' : 'Karyawan terinci',
          String(department === 'Semua departemen' ? departmentHeadCount : departmentLines.length),
          department === 'Semua departemen'
            ? 'Jumlah pada data demo HADIRPAY'
            : `${departmentHeadCount} karyawan di departemen ini, rincian gaji individu terbatas`,
          'users',
        ),
      ],
      department === 'Semua departemen' ? 'Tren beban gaji enam bulan' : `Gaji bersih · ${department}`,
      department === 'Semua departemen'
        ? trend.map((item) => ({ label: item.label, value: item.amount }))
        : departmentLines.map((line) => ({ label: line.employeeName, value: line.netPay })),
      department === 'Semua departemen'
        ? 'Belum ada data beban gaji untuk periode ini.'
        : 'Belum ada rincian gaji individu untuk departemen ini.',
    )
  }

  const entries = (await listJournalEntries())
    .filter((entry) => entry.type === 'Otomatis' && entry.date.slice(0, 7) === period)
  const journalLines = entries.flatMap((entry) =>
    entry.lines.map((line) => ({
      tanggal: entry.date,
      nomorBukti: entry.voucherNumber,
      akun: `${line.accountCode} · ${line.accountName}`,
      debit: formatRupiah(line.debit),
      kredit: formatRupiah(line.credit),
      keterangan: entry.description,
    })),
  )
  const debit = entries.flatMap((entry) => entry.lines).reduce((sum, line) => sum + line.debit, 0)
  const credit = entries.flatMap((entry) => entry.lines).reduce((sum, line) => sum + line.credit, 0)
  const accountTotals = new Map<string, number>()
  for (const entry of entries) {
    for (const line of entry.lines) {
      const current = accountTotals.get(line.accountName) ?? 0
      accountTotals.set(line.accountName, current + line.debit + line.credit)
    }
  }
  const noDepartmentBreakdown = department !== 'Semua departemen'
  return makeDataset(id,
    [
      { key: 'tanggal', label: 'Tanggal' },
      { key: 'nomorBukti', label: 'No. bukti' },
      { key: 'akun', label: 'Akun' },
      { key: 'debit', label: 'Debit' },
      { key: 'kredit', label: 'Kredit' },
      { key: 'keterangan', label: 'Keterangan' },
    ],
    noDepartmentBreakdown ? [] : journalLines,
    [
      metric('Jurnal otomatis', String(noDepartmentBreakdown ? 0 : entries.length), formatMonth(period), 'file'),
      metric('Total debit', formatRupiah(noDepartmentBreakdown ? 0 : debit), 'Jurnal penggajian', 'wallet'),
      metric('Total kredit', formatRupiah(noDepartmentBreakdown ? 0 : credit), 'Harus sama dengan debit', 'scale'),
    ],
    'Mutasi per akun jurnal',
    noDepartmentBreakdown
      ? []
      : [...accountTotals].map(([label, value]) => ({ label, value })),
    noDepartmentBreakdown
      ? 'Jurnal penggajian tidak menyimpan rincian departemen. Pilih Semua departemen untuk melihat jurnal.'
      : entries.length
        ? ''
        : 'Jurnal otomatis belum terbentuk. Setujui periode penggajian untuk membuat jurnal.',
  )
}

export async function getOwnerDashboardData() {
  const [lines, payrollPeriod] = await Promise.all([listPayrollLines(), getPayrollPeriod()])
  return {
    payrollTotal: lines.reduce((sum, line) => sum + line.netPay, 0),
    employeeCount: lines.reduce((sum, line) => sum + line.employeeCount, 0),
    payrollStatus: payrollPeriod.status,
    payrollTrend: mockPayrollExpenseTrend,
    attendanceByDepartment: mockDepartmentAttendance,
    tardiness: mockTardinessLeaderboard,
  }
}

export async function getFinanceDashboardData() {
  const [period, lines, balance] = await Promise.all([
    getPayrollPeriod(),
    listPayrollLines(),
    getTrialBalance('2026-11'),
  ])
  const salaryPayable = balance.rows.find((row) => row.account.code === '2-1200')
  return {
    period,
    totalNetPay: lines.reduce((sum, line) => sum + line.netPay, 0),
    employeeCount: lines.reduce((sum, line) => sum + line.employeeCount, 0),
    pendingValidation: period.status === 'Menunggu validasi keuangan',
    paymentDate: demoPaymentDate,
    salaryPayable: salaryPayable ? Math.max(salaryPayable.credit - salaryPayable.debit, 0) : 0,
  }
}
