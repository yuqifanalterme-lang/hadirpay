'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowDown, ArrowUp, ArrowUpDown, Users } from 'lucide-react'
import { Panel } from '@/components/hadirpay/panel'
import { StatusBadge } from '@/components/hadirpay/status-badge'
import { Avatar } from '@/components/ui/avatar'
import { Button, buttonVariants } from '@/components/ui/button'
import { DemoDataNotice } from '@/components/ui/demo-data-notice'
import { EmptyState, ErrorState } from '@/components/ui/empty-state'
import { PageLoadingSkeleton } from '@/components/ui/page-loading-skeleton'
import { SelectField } from '@/components/ui/select-field'
import { TextField } from '@/components/auth/fields'
import type { Employee } from '@/lib/mock/employees'
import type { MasterRecord } from '@/lib/mock/master-data'
import { formatRupiah } from '@/lib/mock-data'
import { listEmployees } from '@/lib/services/employee-service'
import { listMasterRecords } from '@/lib/services/master-data-service'
import { EmployeeFormDialog } from './employee-form-dialog'

type SortKey = 'id' | 'name' | 'position' | 'department' | 'baseSalary' | 'status'

export function EmployeeList() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [departments, setDepartments] = useState<MasterRecord[]>([])
  const [positions, setPositions] = useState<MasterRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [search, setSearch] = useState('')
  const [department, setDepartment] = useState('')
  const [position, setPosition] = useState('')
  const [status, setStatus] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)
  const [formEmployee, setFormEmployee] = useState<Employee | null | undefined>(undefined)

  async function load() {
    setLoading(true)
    setLoadError('')
    try {
      const [employeeData, departmentData, positionData] = await Promise.all([
        listEmployees(),
        listMasterRecords('departemen'),
        listMasterRecords('jabatan'),
      ])
      setEmployees(employeeData)
      setDepartments(departmentData)
      setPositions(positionData)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Data karyawan gagal dimuat.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('id-ID')
    return employees
      .filter((employee) => {
        const matchesSearch =
          !query ||
          [employee.id, employee.name, employee.position, employee.department].some((value) =>
            value.toLocaleLowerCase('id-ID').includes(query),
          )
        return (
          matchesSearch &&
          (!department || employee.department === department) &&
          (!position || employee.position === position) &&
          (!status || employee.status === status)
        )
      })
      .sort((a, b) => {
        const left = a[sortKey]
        const right = b[sortKey]
        const comparison =
          typeof left === 'number' && typeof right === 'number'
            ? left - right
            : String(left).localeCompare(String(right), 'id-ID')
        return sortDirection === 'asc' ? comparison : -comparison
      })
  }, [department, employees, position, search, sortDirection, sortKey, status])

  useEffect(() => {
    setPage(1)
  }, [department, position, search, status, sortDirection, sortKey])

  const pageSize = 5
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const visibleEmployees = filtered.slice((page - 1) * pageSize, page * pageSize)

  useEffect(() => {
    setPage((current) => Math.min(current, pageCount))
  }, [pageCount])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDirection('asc')
    }
  }

  function sortLabel(key: SortKey, label: string) {
    const Icon = sortKey !== key ? ArrowUpDown : sortDirection === 'asc' ? ArrowUp : ArrowDown
    return (
      <button
        type="button"
        onClick={() => toggleSort(key)}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-1 text-xs font-semibold text-muted-foreground hover:text-heading focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {label}
        <Icon className="size-3.5" aria-hidden="true" />
      </button>
    )
  }

  function handleSaved(employee: Employee, previousId?: string) {
    setEmployees((current) => [employee, ...current.filter((item) => item.id !== previousId && item.id !== employee.id)])
    setFormEmployee(undefined)
  }

  if (loading) return <PageLoadingSkeleton label="data karyawan" />
  if (loadError) return <ErrorState message={loadError} onRetry={() => void load()} />

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <DemoDataNotice>
          Daftar ini berisi 10 karyawan contoh untuk mode demo. Perubahan disimpan di browser ini saja.
        </DemoDataNotice>
        <Button type="button" variant="primary" size="action" onClick={() => setFormEmployee(null)}>
          Tambah karyawan
        </Button>
      </div>
      <Panel title="Daftar karyawan" description="Cari, filter, urutkan, lalu buka profil untuk melihat detail.">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <TextField
            label="Cari karyawan"
            type="search"
            placeholder="Nama, ID, jabatan, atau departemen"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <SelectField
            label="Departemen"
            value={department}
            onChange={setDepartment}
            options={departments.map((item) => item.name)}
            placeholder="Semua departemen"
          />
          <SelectField
            label="Jabatan"
            value={position}
            onChange={setPosition}
            options={positions.map((item) => item.name)}
            placeholder="Semua jabatan"
          />
          <SelectField
            label="Status"
            value={status}
            onChange={setStatus}
            options={['Aktif', 'Nonaktif']}
            placeholder="Semua status"
          />
        </div>

        {employees.length === 0 ? (
          <EmptyState
            title="Belum ada karyawan contoh"
            description="Tambahkan karyawan untuk mulai mengisi direktori demo."
            icon={Users}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="Tidak ada karyawan yang cocok"
            description="Ubah kata pencarian atau filter untuk melihat hasil lain."
            icon={Users}
            action={
              <Button
                type="button"
                variant="outline"
                size="action"
                className="bg-white"
                onClick={() => {
                  setSearch('')
                  setDepartment('')
                  setPosition('')
                  setStatus('')
                }}
              >
                Hapus filter
              </Button>
            }
          />
        ) : (
          <>
            <div className="no-scrollbar overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-sm">
                <caption className="sr-only">Daftar karyawan contoh HadirPay</caption>
                <thead>
                  <tr className="border-b border-border">
                    <th scope="col" aria-sort={sortKey === 'id' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}>{sortLabel('id', 'ID')}</th>
                    <th scope="col" aria-sort={sortKey === 'name' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}>{sortLabel('name', 'Nama')}</th>
                    <th scope="col" aria-sort={sortKey === 'position' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}>{sortLabel('position', 'Jabatan')}</th>
                    <th scope="col" aria-sort={sortKey === 'department' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}>{sortLabel('department', 'Departemen')}</th>
                    <th scope="col">Jenis gaji</th>
                    <th scope="col" aria-sort={sortKey === 'baseSalary' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}>{sortLabel('baseSalary', 'Gaji pokok')}</th>
                    <th scope="col" aria-sort={sortKey === 'status' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}>{sortLabel('status', 'Status')}</th>
                    <th scope="col" className="py-3 pr-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleEmployees.map((employee) => (
                    <tr key={employee.id} className="border-b border-border/70 last:border-0">
                      <td className="py-3 pr-4 font-medium tabular-nums">{employee.id}</td>
                      <td className="py-3 pr-4">
                        <Link href={`/app/karyawan/${encodeURIComponent(employee.id)}`} className="flex min-h-11 items-center gap-3 font-semibold text-heading hover:text-primary focus-visible:outline-2 focus-visible:outline-primary">
                          <Avatar
                            initials={employee.name
                              .split(' ')
                              .map((part) => part[0])
                              .join('')}
                            size="md"
                            tone="muted"
                          />
                          {employee.name}
                        </Link>
                      </td>
                      <td className="py-3 pr-4">{employee.position}</td>
                      <td className="py-3 pr-4">{employee.department}</td>
                      <td className="py-3 pr-4 capitalize">{employee.payrollType}</td>
                      <td className="py-3 pr-4 tabular-nums">
                        {formatRupiah(employee.baseSalary)}
                        {employee.payrollType === 'harian' && <span className="text-muted-foreground"> / hari</span>}
                      </td>
                      <td className="py-3 pr-4">
                        <StatusBadge status={employee.status} />
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/app/karyawan/${encodeURIComponent(employee.id)}`}
                            className={buttonVariants({ variant: 'outline', size: 'action', className: 'bg-white' })}
                          >
                            Detail
                          </Link>
                          <Button type="button" variant="ghost" size="action" onClick={() => setFormEmployee(employee)}>
                            Ubah
                            <span className="sr-only">{employee.name}</span>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Menampilkan {(page - 1) * pageSize + 1} sampai {Math.min(page * pageSize, filtered.length)} dari {filtered.length} karyawan.
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="action"
                  className="bg-white"
                  disabled={page === 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  Sebelumnya
                </Button>
                <span className="min-w-20 text-center text-sm text-muted-foreground">
                  Halaman {page} dari {pageCount}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="action"
                  className="bg-white"
                  disabled={page === pageCount}
                  onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                >
                  Berikutnya
                </Button>
              </div>
            </div>
          </>
        )}
      </Panel>

      <EmployeeFormDialog
        open={formEmployee !== undefined}
        employee={formEmployee ?? null}
        positions={positions}
        departments={departments}
        onOpenChange={(open) => {
          if (!open) setFormEmployee(undefined)
        }}
        onSaved={handleSaved}
      />
    </div>
  )
}
