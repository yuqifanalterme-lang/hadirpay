export type MasterKind = 'jabatan' | 'departemen'

export type MasterRecord = {
  id: string
  name: string
}

export const mockDepartments: MasterRecord[] = [
  { id: 'dept-keuangan', name: 'Keuangan' },
  { id: 'dept-gudang', name: 'Gudang' },
  { id: 'dept-hrd', name: 'HRD' },
  { id: 'dept-operasional', name: 'Operasional' },
  { id: 'dept-pemasaran', name: 'Pemasaran' },
  { id: 'dept-administrasi', name: 'Administrasi' },
]

export const mockPositions: MasterRecord[] = [
  { id: 'pos-staf-keuangan', name: 'Staf Keuangan' },
  { id: 'pos-akuntan', name: 'Akuntan' },
  { id: 'pos-staf-gudang', name: 'Staf Gudang' },
  { id: 'pos-staf-pemasaran', name: 'Staf Pemasaran' },
  { id: 'pos-staf-hrd', name: 'Staf HRD' },
  { id: 'pos-operator-operasional', name: 'Operator Operasional' },
  { id: 'pos-supervisor-pemasaran', name: 'Supervisor Pemasaran' },
  { id: 'pos-staf-administrasi', name: 'Staf Administrasi' },
]
