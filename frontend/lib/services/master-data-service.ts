import { mockDepartments, mockPositions, type MasterKind, type MasterRecord } from '@/lib/mock/master-data'
import { listEmployees } from '@/lib/services/employee-service'

const storageKeys: Record<MasterKind, string> = {
  jabatan: 'hadirpay-demo-jabatan',
  departemen: 'hadirpay-demo-departemen',
}

function isMasterRecord(value: unknown): value is MasterRecord {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return typeof record.id === 'string' && typeof record.name === 'string'
}

function defaults(kind: MasterKind) {
  return (kind === 'jabatan' ? mockPositions : mockDepartments).map((item) => ({ ...item }))
}

function readRecords(kind: MasterKind): MasterRecord[] {
  if (typeof window === 'undefined') return defaults(kind)
  const stored = window.localStorage.getItem(storageKeys[kind])
  if (stored === null) return defaults(kind)

  let parsed: unknown
  try {
    parsed = JSON.parse(stored)
  } catch (error) {
    throw new Error(`Data ${kind} contoh tidak dapat dibaca. Muat ulang atau bersihkan data demo.`, { cause: error })
  }
  if (!Array.isArray(parsed) || !parsed.every(isMasterRecord)) {
    throw new Error(`Format data ${kind} contoh tidak valid. Bersihkan data demo sebelum melanjutkan.`)
  }
  return parsed
}

function writeRecords(kind: MasterKind, records: MasterRecord[]) {
  window.localStorage.setItem(storageKeys[kind], JSON.stringify(records))
}

export async function listMasterRecords(kind: MasterKind): Promise<MasterRecord[]> {
  return readRecords(kind)
}

export async function createMasterRecord(kind: MasterKind, name: string): Promise<MasterRecord> {
  const records = readRecords(kind)
  const normalized = name.trim()
  if (records.some((item) => item.name.toLocaleLowerCase('id-ID') === normalized.toLocaleLowerCase('id-ID'))) {
    throw new Error(`${kind === 'jabatan' ? 'Jabatan' : 'Departemen'} sudah tersedia.`)
  }
  const created = { id: `${kind}-${crypto.randomUUID()}`, name: normalized }
  writeRecords(kind, [created, ...records])
  return created
}

export async function updateMasterRecord(kind: MasterKind, id: string, name: string): Promise<MasterRecord> {
  const records = readRecords(kind)
  const normalized = name.trim()
  if (records.some((item) => item.id !== id && item.name.toLocaleLowerCase('id-ID') === normalized.toLocaleLowerCase('id-ID'))) {
    throw new Error(`${kind === 'jabatan' ? 'Jabatan' : 'Departemen'} sudah tersedia.`)
  }
  const index = records.findIndex((item) => item.id === id)
  if (index === -1) throw new Error(`${kind === 'jabatan' ? 'Jabatan' : 'Departemen'} tidak ditemukan.`)
  const updated = { ...records[index], name: normalized }
  records[index] = updated
  writeRecords(kind, records)
  return updated
}

export async function deleteMasterRecord(kind: MasterKind, id: string): Promise<void> {
  const records = readRecords(kind)
  const record = records.find((item) => item.id === id)
  if (!record) throw new Error(`${kind === 'jabatan' ? 'Jabatan' : 'Departemen'} tidak ditemukan.`)

  const employees = await listEmployees()
  const inUse = employees.some((employee) =>
    kind === 'departemen' ? employee.department === record.name : employee.position === record.name,
  )
  if (inUse) {
    throw new Error(`${kind === 'jabatan' ? 'Jabatan' : 'Departemen'} masih digunakan oleh karyawan.`)
  }
  writeRecords(kind, records.filter((item) => item.id !== id))
}
