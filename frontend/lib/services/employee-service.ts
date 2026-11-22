import { mockEmployees, type Employee } from '@/lib/mock/employees'

const storageKey = 'hadirpay-demo-employees'

function isEmployee(value: unknown): value is Employee {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return (
    typeof record.id === 'string' &&
    typeof record.name === 'string' &&
    typeof record.position === 'string' &&
    typeof record.department === 'string' &&
    typeof record.startedAt === 'string' &&
    (record.payrollType === 'bulanan' || record.payrollType === 'harian') &&
    typeof record.baseSalary === 'number' &&
    typeof record.fixedAllowance === 'number' &&
    (record.status === 'Aktif' || record.status === 'Nonaktif') &&
    record.isMock === true
  )
}

function readEmployees(): Employee[] {
  if (typeof window === 'undefined') return mockEmployees.map((employee) => ({ ...employee }))
  const stored = window.localStorage.getItem(storageKey)
  if (stored === null) return mockEmployees.map((employee) => ({ ...employee }))

  let parsed: unknown
  try {
    parsed = JSON.parse(stored)
  } catch (error) {
    throw new Error('Data karyawan tidak dapat dibaca. Muat ulang atau coba lagi.', { cause: error })
  }
  if (!Array.isArray(parsed) || !parsed.every(isEmployee)) {
    throw new Error('Format data karyawan tidak valid. Periksa data sebelum melanjutkan.')
  }
  return parsed
}

function writeEmployees(employees: Employee[]) {
  window.localStorage.setItem(storageKey, JSON.stringify(employees))
}

export async function listEmployees(): Promise<Employee[]> {
  return readEmployees()
}

export async function getEmployee(id: string): Promise<Employee | null> {
  return readEmployees().find((employee) => employee.id === id) ?? null
}

export async function createEmployee(employee: Employee): Promise<Employee> {
  const employees = readEmployees()
  if (employees.some((item) => item.id.toLowerCase() === employee.id.toLowerCase())) {
    throw new Error('ID karyawan sudah digunakan.')
  }
  const created = { ...employee, id: employee.id.trim(), isMock: true as const }
  writeEmployees([created, ...employees])
  return created
}

export async function updateEmployee(id: string, changes: Employee): Promise<Employee> {
  const employees = readEmployees()
  if (changes.id.toLowerCase() !== id.toLowerCase() && employees.some((item) => item.id.toLowerCase() === changes.id.toLowerCase())) {
    throw new Error('ID karyawan sudah digunakan.')
  }
  const index = employees.findIndex((item) => item.id === id)
  if (index === -1) throw new Error('Karyawan tidak ditemukan.')
  const updated = { ...changes, id: changes.id.trim(), isMock: true as const }
  employees[index] = updated
  writeEmployees(employees)
  return updated
}

export async function deleteEmployee(id: string): Promise<void> {
  const employees = readEmployees()
  if (!employees.some((employee) => employee.id === id)) throw new Error('Karyawan tidak ditemukan.')
  writeEmployees(employees.filter((employee) => employee.id !== id))
}
