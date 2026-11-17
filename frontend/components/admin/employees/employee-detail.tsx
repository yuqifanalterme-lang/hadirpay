'use client'

import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CalendarCheck, CircleUserRound, FileText, Wallet } from 'lucide-react'
import { Panel } from '@/components/hadirpay/panel'
import { StatusBadge } from '@/components/hadirpay/status-badge'
import { Avatar } from '@/components/ui/avatar'
import { Button, buttonVariants } from '@/components/ui/button'
import { DemoDataNotice } from '@/components/ui/demo-data-notice'
import { EmptyState, ErrorState } from '@/components/ui/empty-state'
import { PageLoadingSkeleton } from '@/components/ui/page-loading-skeleton'
import { EmployeeFormDialog } from '@/components/admin/employees/employee-form-dialog'
import type { Employee, EmployeeHistory } from '@/lib/mock/employees'
import { mockEmployeeHistory } from '@/lib/mock/employees'
import type { MasterRecord } from '@/lib/mock/master-data'
import { formatTanggal } from '@/lib/format'
import { formatRupiah } from '@/lib/mock-data'
import { getEmployee } from '@/lib/services/employee-service'
import { listMasterRecords } from '@/lib/services/master-data-service'

const tabs = ['Profil', 'Riwayat Kehadiran', 'Komponen Gaji', 'Riwayat Slip'] as const
type EmployeeTab = (typeof tabs)[number]

function DetailValue({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border/70 py-3 last:border-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="font-semibold text-heading">{value}</dd>
    </div>
  )
}

export function EmployeeDetail({ id }: { id: string }) {
  const router = useRouter()
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [departments, setDepartments] = useState<MasterRecord[]>([])
  const [positions, setPositions] = useState<MasterRecord[]>([])
  const [history, setHistory] = useState<EmployeeHistory | null>(null)
  const [activeTab, setActiveTab] = useState<EmployeeTab>('Profil')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [editing, setEditing] = useState(false)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  async function load() {
    setLoading(true)
    setLoadError('')
    try {
      const [employeeData, departmentData, positionData] = await Promise.all([
        getEmployee(id),
        listMasterRecords('departemen'),
        listMasterRecords('jabatan'),
      ])
      setEmployee(employeeData)
      setHistory(employeeData ? mockEmployeeHistory[employeeData.id] ?? null : null)
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
  }, [id])

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex = index
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length
    else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length
    else if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = tabs.length - 1
    else return
    event.preventDefault()
    setActiveTab(tabs[nextIndex])
    tabRefs.current[nextIndex]?.focus()
  }

  function handleSaved(updated: Employee, previousId?: string) {
    setEmployee(updated)
    setEditing(false)
    if (previousId && previousId !== updated.id) {
      router.replace(`/app/karyawan/${encodeURIComponent(updated.id)}`)
    }
  }

  if (loading) return <PageLoadingSkeleton label="detail karyawan" />
  if (loadError) return <ErrorState message={loadError} onRetry={() => void load()} />
  if (!employee) {
    return (
      <EmptyState
        title="Data karyawan tidak ditemukan"
        description="Karyawan ini mungkin sudah dihapus dari data contoh."
        icon={CircleUserRound}
        action={
          <Link href="/app/karyawan" className={buttonVariants({ variant: 'outline', size: 'action', className: 'bg-white' })}>
            Kembali ke data karyawan
          </Link>
        }
      />
    )
  }

  const attendance = history?.attendance ?? []
  const payslips = history?.payslips ?? []
  const tabIndex = tabs.indexOf(activeTab)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <DemoDataNotice>Profil ini menggunakan data contoh untuk mode demo.</DemoDataNotice>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/app/karyawan"
            className={buttonVariants({ variant: 'outline', size: 'action', className: 'gap-2 bg-white' })}
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Daftar karyawan
          </Link>
          <Button type="button" variant="primary" size="action" onClick={() => setEditing(true)}>
            Ubah profil
          </Button>
        </div>
      </div>

      <Panel title={employee.name} description={`${employee.position} · ${employee.department}`}>
        <div className="flex flex-wrap items-center gap-4">
          <Avatar
            initials={employee.name
              .split(' ')
              .map((part) => part[0])
              .join('')}
            size="lg"
            tone="muted"
          />
          <div className="flex flex-col gap-1">
            <p className="text-sm text-muted-foreground">ID karyawan {employee.id}</p>
            <StatusBadge status={employee.status} />
          </div>
        </div>
      </Panel>

      <div role="tablist" aria-label="Informasi karyawan" className="flex overflow-x-auto border-b border-border">
        {tabs.map((tab, index) => (
          <button
            key={tab}
            ref={(element) => {
              tabRefs.current[index] = element
            }}
            type="button"
            role="tab"
            id={`employee-tab-${index}`}
            aria-selected={activeTab === tab}
            aria-controls="employee-tab-panel"
            tabIndex={activeTab === tab ? 0 : -1}
            onClick={() => setActiveTab(tab)}
            onKeyDown={(event) => handleTabKeyDown(event, index)}
            className={`min-h-11 shrink-0 border-b-2 px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
              activeTab === tab
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-heading'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <section
        id="employee-tab-panel"
        role="tabpanel"
        aria-labelledby={`employee-tab-${tabIndex}`}
        tabIndex={0}
        className="flex flex-col gap-6 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {activeTab === 'Profil' && (
          <Panel title="Informasi profil">
            <dl className="grid gap-x-8 sm:grid-cols-2">
              <DetailValue label="Nama lengkap" value={employee.name} />
              <DetailValue label="ID karyawan" value={employee.id} />
              <DetailValue label="Jabatan" value={employee.position} />
              <DetailValue label="Departemen" value={employee.department} />
              <DetailValue label="Mulai bekerja" value={formatTanggal(employee.startedAt)} />
              <DetailValue label="Jenis penggajian" value={employee.payrollType === 'harian' ? 'Harian' : 'Bulanan'} />
              <DetailValue label="NPWP" value={employee.npwp || 'Belum diisi'} />
              <DetailValue label="BPJS Kesehatan" value={employee.bpjsKesehatan || 'Belum diisi'} />
              <DetailValue label="BPJS Ketenagakerjaan" value={employee.bpjsKetenagakerjaan || 'Belum diisi'} />
            </dl>
          </Panel>
        )}

        {activeTab === 'Riwayat Kehadiran' &&
          (attendance.length === 0 ? (
            <EmptyState
              title="Belum ada riwayat kehadiran"
              description="Riwayat akan tampil di sini setelah data absensi tersedia."
              icon={CalendarCheck}
            />
          ) : (
            <Panel title="Riwayat kehadiran" description="Ringkasan absensi pada data contoh.">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <caption className="sr-only">Riwayat kehadiran {employee.name}</caption>
                  <thead>
                    <tr className="border-b border-border text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      <th scope="col" className="py-3 pr-4">Tanggal</th>
                      <th scope="col" className="py-3 pr-4">Masuk</th>
                      <th scope="col" className="py-3 pr-4">Pulang</th>
                      <th scope="col" className="py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendance.map((record) => (
                      <tr key={record.date} className="border-b border-border/70 last:border-0">
                        <td className="py-3 pr-4">{formatTanggal(record.date)}</td>
                        <td className="py-3 pr-4 tabular-nums">{record.checkIn}</td>
                        <td className="py-3 pr-4 tabular-nums">{record.checkOut}</td>
                        <td className="py-3"><StatusBadge status={record.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          ))}

        {activeTab === 'Komponen Gaji' && (
          <Panel title="Komponen gaji" description="Nilai mengikuti jenis penggajian karyawan.">
            <dl className="grid gap-x-8 sm:grid-cols-2">
              <DetailValue
                label={employee.payrollType === 'harian' ? 'Tarif harian' : 'Gaji pokok'}
                value={`${formatRupiah(employee.baseSalary)}${employee.payrollType === 'harian' ? ' per hari' : ''}`}
              />
              <DetailValue
                label="Tunjangan tetap"
                value={`${formatRupiah(employee.fixedAllowance)}${employee.payrollType === 'harian' ? ' per hari' : ''}`}
              />
            </dl>
            <div className="flex items-start gap-3 rounded-xl bg-surface p-4">
              <Wallet className="mt-0.5 size-5 text-primary" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">
                Perhitungan bersih dan potongan belum terhubung ke layanan penggajian.
              </p>
            </div>
          </Panel>
        )}

        {activeTab === 'Riwayat Slip' &&
          (payslips.length === 0 ? (
            <EmptyState
              title="Belum ada riwayat slip"
              description="Slip gaji karyawan ini belum tersedia pada data contoh."
              icon={FileText}
            />
          ) : (
            <Panel title="Riwayat slip gaji" description="Ringkasan slip gaji contoh, belum berupa berkas unduhan.">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <caption className="sr-only">Riwayat slip gaji {employee.name}</caption>
                  <thead>
                    <tr className="border-b border-border text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      <th scope="col" className="py-3 pr-4">Periode</th>
                      <th scope="col" className="py-3 pr-4">Tanggal terbit</th>
                      <th scope="col" className="py-3">Gaji bersih</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payslips.map((slip) => (
                      <tr key={slip.period} className="border-b border-border/70 last:border-0">
                        <td className="py-3 pr-4 font-semibold text-heading">{slip.period}</td>
                        <td className="py-3 pr-4">{slip.issuedAt}</td>
                        <td className="py-3 font-semibold tabular-nums text-heading">{formatRupiah(slip.net)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          ))}
      </section>

      <EmployeeFormDialog
        open={editing}
        employee={employee}
        positions={positions}
        departments={departments}
        onOpenChange={setEditing}
        onSaved={(updated, previousId) => void handleSaved(updated, previousId)}
      />
    </div>
  )
}
