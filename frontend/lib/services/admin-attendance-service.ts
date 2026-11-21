import {
  mockAdminDailyAttendance,
  mockMonthlyAttendanceSummary,
  type AdminDailyAttendance,
  type MonthlyAttendanceSummary,
} from '@/lib/mock/admin-attendance'
import { listEmployees } from '@/lib/services/employee-service'

export type AdminDailyAttendanceRow = AdminDailyAttendance & {
  name: string
  initials: string
  position: string
  department: string
  durationMinutes: number | null
  isMock: boolean
}

export type MonthlyAttendanceSummaryRow = MonthlyAttendanceSummary & {
  name: string
  initials: string
  position: string
  department: string
  isMock: boolean
}

function toMinutes(time: string) {
  const [hours, minutes] = time.split('.').map(Number)
  return hours * 60 + minutes
}

export async function listAdminDailyAttendance(date: string): Promise<AdminDailyAttendanceRow[]> {
  const employees = (await listEmployees()).filter((employee) => employee.status === 'Aktif')
  const employeesById = new Map(employees.map((employee) => [employee.id, employee]))

  return mockAdminDailyAttendance
    .filter((record) => record.date === date)
    .flatMap((record) => {
      const employee = employeesById.get(record.employeeId)
      if (!employee) return []
      const durationMinutes =
        record.checkIn && record.checkOut
          ? toMinutes(record.checkOut) - toMinutes(record.checkIn)
          : null
      return [{
        ...record,
        name: employee.name,
        initials: employee.name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase(),
        position: employee.position,
        department: employee.department,
        durationMinutes,
        isMock: true as const,
      }]
    })
}

export async function getMonthlyAttendanceSummary(period: string): Promise<MonthlyAttendanceSummaryRow[]> {
  const employees = (await listEmployees()).filter((employee) => employee.status === 'Aktif')
  const employeesById = new Map(employees.map((employee) => [employee.id, employee]))

  return mockMonthlyAttendanceSummary
    .filter((record) => record.period === period)
    .flatMap((record) => {
      const employee = employeesById.get(record.employeeId)
      if (!employee) return []
      return [{
        ...record,
        name: employee.name,
        initials: employee.name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase(),
        position: employee.position,
        department: employee.department,
        isMock: true as const,
      }]
    })
}
