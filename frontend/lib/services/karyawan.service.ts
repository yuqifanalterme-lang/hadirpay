import { apiRequest, ApiError, type ApiMeta } from '@/lib/api/client'
import { config } from '@/lib/config'
import type { Employee } from '@/lib/mock/employees'
import type { MasterKind, MasterRecord } from '@/lib/mock/master-data'
import type {
  KaryawanDetail,
  KaryawanCreateRequest,
  KaryawanKehadiranRingkas,
  KaryawanListQuery,
  KaryawanRingkas,
  DataMasterItem,
  Pengguna,
  ResetPasswordResponse,
} from '@/lib/types/karyawan'
import type { Role as UiRole } from '@/lib/navigation'
import {
  createEmployee as createEmployeeMock,
  getEmployee as getEmployeeMock,
  listEmployees as listEmployeesMock,
  updateEmployee as updateEmployeeMock,
} from './employee-service'
import {
  createMasterRecord as createMasterRecordMock,
  deleteMasterRecord as deleteMasterRecordMock,
  listMasterRecords as listMasterRecordsMock,
  updateMasterRecord as updateMasterRecordMock,
} from './master-data-service'

function apiId(id: string): number {
  const parsed = Number(id)
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new ApiError(0, 'INVALID_RESOURCE_ID', 'ID data harus berupa bilangan bulat positif dari API.')
  }
  return parsed
}

function toUiStatus(status: KaryawanRingkas['status']): Employee['status'] {
  return status === 'aktif' ? 'Aktif' : 'Nonaktif'
}

function toEmployee(item: KaryawanDetail, positionName?: string, departmentName?: string): Employee {
  if (!positionName || !departmentName) {
    throw new ApiError(0, 'MASTER_DATA_NOT_FOUND', 'Jabatan atau departemen karyawan tidak ditemukan.')
  }
  return {
    id: String(item.id),
    code: item.kode,
    name: item.nama,
    position: positionName,
    department: departmentName,
    startedAt: item.tanggal_mulai,
    payrollType: item.jenis_penggajian,
    baseSalary: item.gaji_pokok,
    fixedAllowance: item.tunjangan_tetap,
    npwp: 'npwp' in item ? item.npwp ?? undefined : undefined,
    noBpjs: item.no_bpjs ?? undefined,
    status: toUiStatus(item.status),
    isMock: false,
  }
}

function masterPath(kind: MasterKind) {
  return kind === 'jabatan' ? 'jabatan' : 'departemen'
}

function toMasterRecord(item: DataMasterItem): MasterRecord {
  return {
    id: String(item.id),
    name: item.nama,
    ...(item.jumlah_karyawan === undefined ? {} : { employeeCount: item.jumlah_karyawan }),
  }
}

async function findMasterId(kind: MasterKind, name: string) {
  const result = await apiRequest<DataMasterItem[]>(masterPath(kind))
  const match = result.data.find((item) => item.nama === name)
  if (!match) {
    throw new ApiError(0, 'MASTER_DATA_NOT_FOUND', `${kind === 'jabatan' ? 'Jabatan' : 'Departemen'} "${name}" tidak ditemukan.`)
  }
  return match.id
}

function toWriteRequest(
  employee: Employee,
  jabatanId: number,
  departemenId: number,
): Pick<
  KaryawanCreateRequest,
  | 'nama'
  | 'jabatan_id'
  | 'departemen_id'
  | 'tanggal_mulai'
  | 'jenis_penggajian'
  | 'gaji_pokok'
  | 'tunjangan_tetap'
  | 'npwp'
> {
  return {
    nama: employee.name,
    jabatan_id: jabatanId,
    departemen_id: departemenId,
    tanggal_mulai: employee.startedAt,
    jenis_penggajian: employee.payrollType,
    gaji_pokok: employee.baseSalary,
    tunjangan_tetap: employee.fixedAllowance,
    npwp: employee.npwp ?? null,
  }
}

export type EmployeePage = { items: Employee[]; meta?: ApiMeta }

export async function listEmployeesPage(query: KaryawanListQuery): Promise<EmployeePage> {
  if (config.mock.karyawan) {
    return { items: await listEmployeesMock() }
  }
  const result = await apiRequest<KaryawanRingkas[]>('karyawan', { params: { ...query } })
  if (!result.meta) {
    throw new ApiError(0, 'PAGINATION_META_MISSING', 'Respons daftar karyawan tidak menyertakan meta paginasi.')
  }
  const items = await Promise.all(result.data.map(async (summary) => {
    const detail = await apiRequest<KaryawanDetail>(`karyawan/${summary.id}`)
    return toEmployee(detail.data, summary.jabatan.nama, summary.departemen.nama)
  }))
  return { items, meta: result.meta }
}

export async function listEmployees(): Promise<Employee[]> {
  if (config.mock.karyawan) return listEmployeesMock()
  const firstPage = await listEmployeesPage({ page: 1, per_page: 100 })
  if (!firstPage.meta) {
    throw new ApiError(0, 'PAGINATION_META_MISSING', 'Respons daftar karyawan tidak menyertakan meta paginasi.')
  }
  const employees = [...firstPage.items]
  for (let page = 2; page <= firstPage.meta.total_pages; page += 1) {
    const nextPage = await listEmployeesPage({ page, per_page: firstPage.meta.per_page })
    employees.push(...nextPage.items)
  }
  return employees
}

export async function getEmployee(id: string): Promise<Employee | null> {
  if (config.mock.karyawan) return getEmployeeMock(id)
  const result = await apiRequest<KaryawanDetail>(`karyawan/${apiId(id)}`)
  const [positions, departments] = await Promise.all([
    apiRequest<DataMasterItem[]>('jabatan'),
    apiRequest<DataMasterItem[]>('departemen'),
  ])
  const positionName = positions.data.find((entry) => entry.id === result.data.jabatan_id)?.nama
  const departmentName = departments.data.find((entry) => entry.id === result.data.departemen_id)?.nama
  return toEmployee(result.data, positionName, departmentName)
}

type EmployeeCreateAccount = Pick<KaryawanCreateRequest, 'email' | 'no_hp' | 'no_bpjs' | 'role' | 'password'>

export async function createEmployee(
  employee: Employee,
  account: EmployeeCreateAccount,
): Promise<Employee> {
  if (config.mock.karyawan) return createEmployeeMock(employee)
  const [jabatanId, departemenId] = await Promise.all([
    findMasterId('jabatan', employee.position),
    findMasterId('departemen', employee.department),
  ])
  const result = await apiRequest<KaryawanDetail>('karyawan', {
    method: 'POST',
    body: {
      ...toWriteRequest(employee, jabatanId, departemenId),
      ...account,
    },
  })
  const [positions, departments] = await Promise.all([
    apiRequest<DataMasterItem[]>('jabatan'),
    apiRequest<DataMasterItem[]>('departemen'),
  ])
  const positionName = positions.data.find((entry) => entry.id === result.data.jabatan_id)?.nama
  const departmentName = departments.data.find((entry) => entry.id === result.data.departemen_id)?.nama
  return toEmployee(result.data, positionName, departmentName)
}

export async function updateEmployee(id: string, changes: Employee): Promise<Employee> {
  if (config.mock.karyawan) return updateEmployeeMock(id, changes)
  const employeeId = apiId(id)
  const [current, jabatanId, departemenId] = await Promise.all([
    apiRequest<KaryawanDetail>(`karyawan/${employeeId}`),
    findMasterId('jabatan', changes.position),
    findMasterId('departemen', changes.department),
  ])
  const body = {
    ...toWriteRequest(changes, jabatanId, departemenId),
    email: current.data.email,
    no_hp: current.data.no_hp,
    no_bpjs: changes.noBpjs ?? null,
    role: current.data.role,
  }
  await apiRequest<KaryawanDetail>(`karyawan/${employeeId}`, {
    method: 'PUT',
    body,
  })
  const nextStatus = changes.status === 'Aktif' ? 'aktif' : 'nonaktif'
  if (current.data.status !== nextStatus) {
    await setEmployeeStatus(id, nextStatus)
  }
  const result = await apiRequest<KaryawanDetail>(`karyawan/${employeeId}`)
  const [positions, departments] = await Promise.all([
    apiRequest<DataMasterItem[]>('jabatan'),
    apiRequest<DataMasterItem[]>('departemen'),
  ])
  const positionName = positions.data.find((entry) => entry.id === result.data.jabatan_id)?.nama
  const departmentName = departments.data.find((entry) => entry.id === result.data.departemen_id)?.nama
  return toEmployee(result.data, positionName, departmentName)
}

export async function setEmployeeStatus(id: string, status: 'aktif' | 'nonaktif'): Promise<void> {
  if (config.mock.karyawan) {
    const current = await getEmployeeMock(id)
    if (!current) throw new ApiError(404, 'EMPLOYEE_NOT_FOUND', 'Karyawan tidak ditemukan.')
    await updateEmployeeMock(id, {
      ...current,
      status: status === 'aktif' ? 'Aktif' : 'Nonaktif',
    })
    return
  }
  await apiRequest<unknown>(`karyawan/${apiId(id)}/status`, {
    method: 'PATCH',
    body: { status },
  })
}

export async function listMasterRecords(kind: MasterKind): Promise<MasterRecord[]> {
  if (config.mock.karyawan) return listMasterRecordsMock(kind)
  const result = await apiRequest<DataMasterItem[]>(masterPath(kind))
  return result.data.map(toMasterRecord)
}

export async function createMasterRecord(kind: MasterKind, name: string): Promise<MasterRecord> {
  if (config.mock.karyawan) return createMasterRecordMock(kind, name)
  const result = await apiRequest<DataMasterItem>(masterPath(kind), {
    method: 'POST',
    body: { nama: name },
  })
  return toMasterRecord(result.data)
}

export async function updateMasterRecord(kind: MasterKind, id: string, name: string): Promise<MasterRecord> {
  if (config.mock.karyawan) return updateMasterRecordMock(kind, id, name)
  const result = await apiRequest<DataMasterItem>(`${masterPath(kind)}/${apiId(id)}`, {
    method: 'PUT',
    body: { nama: name },
  })
  return toMasterRecord(result.data)
}

export async function deleteMasterRecord(kind: MasterKind, id: string): Promise<void> {
  if (config.mock.karyawan) return deleteMasterRecordMock(kind, id)
  await apiRequest<null>(`${masterPath(kind)}/${apiId(id)}`, { method: 'DELETE' })
}

export async function getEmployeeAttendanceSummary(id: string, period: string): Promise<KaryawanKehadiranRingkas> {
  if (config.mock.karyawan) {
    throw new ApiError(0, 'MOCK_ATTENDANCE_SUMMARY_UNAVAILABLE', 'Ringkasan absensi karyawan belum tersedia.')
  }
  const result = await apiRequest<KaryawanKehadiranRingkas>(
    `karyawan/${apiId(id)}/kehadiran-ringkas`,
    { params: { periode: period } },
  )
  return result.data
}

export async function listUsers(): Promise<Pengguna[]> {
  if (config.mock.karyawan) {
    throw new ApiError(0, 'MOCK_USERS_UNAVAILABLE', 'Daftar pengguna belum tersedia.')
  }
  const result = await apiRequest<Pengguna[]>('pengguna')
  return result.data
}

export async function updateUserRole(id: string | number, role: Pengguna['role']): Promise<Pengguna> {
  if (config.mock.karyawan) {
    throw new ApiError(0, 'MOCK_USERS_UNAVAILABLE', 'Perubahan peran pengguna belum tersedia.')
  }
  const result = await apiRequest<Pengguna>(`pengguna/${apiId(String(id))}/role`, {
    method: 'PUT',
    body: { role },
  })
  return result.data
}

export async function resetUserPassword(id: string | number): Promise<ResetPasswordResponse> {
  if (config.mock.karyawan) {
    throw new ApiError(0, 'MOCK_USERS_UNAVAILABLE', 'Reset password pengguna belum tersedia.')
  }
  const result = await apiRequest<ResetPasswordResponse>(`pengguna/${apiId(String(id))}/reset-password`, {
    method: 'POST',
    body: {},
  })
  return result.data
}

export async function updateUserStatus(id: string | number, aktif: boolean): Promise<Pengguna> {
  if (config.mock.karyawan) {
    throw new ApiError(0, 'MOCK_USERS_UNAVAILABLE', 'Perubahan status pengguna belum tersedia.')
  }
  const result = await apiRequest<Pengguna>(`pengguna/${apiId(String(id))}/status`, {
    method: 'PATCH',
    body: { aktif },
  })
  return result.data
}

export type EmployeeRole = UiRole
