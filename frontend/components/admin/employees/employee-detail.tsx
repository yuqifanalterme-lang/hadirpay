'use client'

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  CalendarCheck,
  CalendarDays,
  CircleDollarSign,
  CircleUserRound,
  CircleX,
  Clock3,
  Download,
  FileCheck2,
  FileText,
  HeartPulse,
  Plus,
  Trash2,
  UserCheck,
} from 'lucide-react'
import { Panel } from '@/components/hadirpay/panel'
import { StatCard } from '@/components/hadirpay/stat-card'
import { StatusBadge } from '@/components/hadirpay/status-badge'
import { Avatar } from '@/components/ui/avatar'
import { Button, buttonVariants } from '@/components/ui/button'
import { Dialog, DialogFooter, DialogHeader } from '@/components/ui/dialog'
import { EmptyState, ErrorState } from '@/components/ui/empty-state'
import { PageLoadingSkeleton } from '@/components/ui/page-loading-skeleton'
import { TableActionIcon } from '@/components/ui/table-action-icon'
import { toast } from 'sonner'
import { TextField } from '@/components/auth/fields'
import { EmployeeFormDialog } from '@/components/admin/employees/employee-form-dialog'
import { config } from '@/lib/config'
import type { Employee, EmployeeHistory, EmployeeSalaryComponent } from '@/lib/mock/employees'
import { mockEmployeeHistory } from '@/lib/mock/employees'
import type { MasterRecord } from '@/lib/mock/master-data'
import { formatTanggal } from '@/lib/format'
import { formatRupiah } from '@/lib/mock-data'
import {
  assignEmployeeSalaryComponent,
  getEmployee,
  getEmployeeAttendanceSummary,
  listMasterRecords,
  removeEmployeeSalaryComponent,
} from '@/lib/services/karyawan.service'
import { listPayrollComponents } from '@/lib/services/penggajian.service'
import type { PayrollComponent } from '@/lib/mock/payroll'
import { downloadPayslipPdf, getPayslip, listPayslips } from '@/lib/services/penggajian.service'
import type { KaryawanKehadiranRingkas } from '@/lib/types/karyawan'
import type { SlipGajiDetail, SlipGajiItem } from '@/lib/types/penggajian'

const tabs = ['Profil', 'Riwayat Kehadiran', 'Komponen Gaji', 'Riwayat Slip'] as const
type EmployeeTab = (typeof tabs)[number]

const componentInputClass = 'min-h-12 w-full rounded-xl border border-border bg-white px-3 text-sm text-heading focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none'

function canManageEmployeeComponent(component: EmployeeSalaryComponent) {
  return !['BPJS', 'PPH21', 'TUN-TRANSPORT', 'POT-LEMBUR'].includes(component.code)
    && !['tunjangan-tetap', 'potongan-terlambat', 'potongan-alpha'].includes(String(component.id))
}

function currentPeriod() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function DetailValue({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border/70 py-3 last:border-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="font-semibold text-heading">{value}</dd>
    </div>
  )
}

function formatComponentValue(component: NonNullable<Employee['salaryComponents']>[number]) {
  if (component.method === 'persen') {
    return `${component.value}% dari gaji pokok periode`
  }
  const units = {
    nominal_tetap: 'per periode',
    per_hari: 'per hari',
    per_jam: 'per jam',
    per_menit: 'per menit',
    manual_periode: 'diatur saat proses gaji',
  } as const
  return `${formatRupiah(component.value)} ${units[component.method]}`
}

export function EmployeeDetail({ id }: { id: string }) {
  const router = useRouter()
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [departments, setDepartments] = useState<MasterRecord[]>([])
  const [positions, setPositions] = useState<MasterRecord[]>([])
  const [history, setHistory] = useState<EmployeeHistory | null>(null)
  const [attendanceSummary, setAttendanceSummary] = useState<KaryawanKehadiranRingkas | null>(null)
  const [attendancePeriod, setAttendancePeriod] = useState(currentPeriod)
  const [attendanceLoading, setAttendanceLoading] = useState(false)
  const [attendanceError, setAttendanceError] = useState('')
  const [attendanceReload, setAttendanceReload] = useState(0)
  const [activeTab, setActiveTab] = useState<EmployeeTab>('Profil')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [editing, setEditing] = useState(false)
  const [componentOptions, setComponentOptions] = useState<PayrollComponent[]>([])
  const [assignmentOpen, setAssignmentOpen] = useState(false)
  const [selectedComponentId, setSelectedComponentId] = useState('')
  const [componentValue, setComponentValue] = useState('')
  const [assignmentSaving, setAssignmentSaving] = useState(false)
  const [removingComponent, setRemovingComponent] = useState<EmployeeSalaryComponent | null>(null)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const salaryPreview = useMemo(() => {
    if (!employee) return null

    let income = employee.baseSalary + employee.fixedAllowance
    let deductions = 0
    let hasUncalculatedComponents = false
    for (const component of employee.salaryComponents ?? []) {
      if (component.code === 'TUN-TRANSPORT') continue
      const amount = component.method === 'nominal_tetap'
        ? component.value
        : component.method === 'persen'
          ? employee.baseSalary * component.value / 100
          : null
      if (amount === null) {
        if (component.method !== 'manual_periode') hasUncalculatedComponents = true
        continue
      }
      if (component.type === 'pendapatan') income += amount
      else deductions += amount
    }

    return {
      income,
      deductions,
      net: income - deductions,
      hasUncalculatedComponents,
    }
  }, [employee])

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

  useEffect(() => {
    if (activeTab !== 'Riwayat Kehadiran') return
    if (!/^\d{4}-\d{2}$/.test(attendancePeriod)) {
      setAttendanceLoading(false)
      setAttendanceSummary(null)
      return
    }
    let active = true
    setAttendanceLoading(true)
    setAttendanceError('')
    setAttendanceSummary(null)
    getEmployeeAttendanceSummary(id, attendancePeriod)
      .then((summary) => {
        if (active) setAttendanceSummary(summary)
      })
      .catch((error: unknown) => {
        if (active) setAttendanceError(error instanceof Error ? error.message : 'Ringkasan kehadiran gagal dimuat.')
      })
      .finally(() => {
        if (active) setAttendanceLoading(false)
      })
    return () => {
      active = false
    }
  }, [activeTab, attendancePeriod, attendanceReload, id])

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
    void load()
  }

  async function openAssignment() {
    try {
      const options = await listPayrollComponents()
      const attachedIds = new Set((employee?.salaryComponents ?? []).map((component) => String(component.id)))
      const available = options.filter((component) =>
        component.active
        && component.method !== 'manual per periode'
        && !['BPJS', 'PPH21', 'TUN-TRANSPORT', 'POT-LEMBUR', 'POT-ALPHA', 'POT-TELAT'].includes(component.code ?? '')
        && !['tunjangan-tetap', 'potongan-terlambat', 'potongan-alpha'].includes(component.id)
        && !attachedIds.has(component.id),
      )
      setComponentOptions(available)
      setSelectedComponentId(available[0]?.id ?? '')
      setComponentValue(available[0]?.amount === null || available[0]?.amount === undefined ? '' : String(available[0].amount))
      setAssignmentOpen(true)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Daftar komponen gagal dimuat.')
    }
  }

  async function saveAssignment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const currentEmployee = employee
    if (!currentEmployee) return
    const component = componentOptions.find((item) => item.id === selectedComponentId)
    const value = Number(componentValue)
    if (!component) {
      toast.error('Pilih komponen gaji yang akan dipasang.')
      return
    }
    if (componentValue.trim() === '' || !Number.isFinite(value) || value < 0 || (component.method === 'persen' && value > 100)) {
      toast.error(component.method === 'persen' ? 'Nilai persen harus antara 0 sampai 100.' : 'Nilai komponen harus berupa angka nol atau lebih.')
      return
    }

    setAssignmentSaving(true)
    try {
      const updated = await assignEmployeeSalaryComponent(currentEmployee.id, {
        id: component.id,
        code: component.code ?? component.id,
        name: component.name,
        type: component.category,
        method: ({
          'nominal tetap': 'nominal_tetap',
          persen: 'persen',
          'per hari': 'per_hari',
          'per jam': 'per_jam',
          'per menit': 'per_menit',
          'manual per periode': 'manual_periode',
        } as const)[component.method],
        value,
      })
      setEmployee(updated)
      setAssignmentOpen(false)
      toast.success(`${component.name} dipasang ke ${currentEmployee.name}. Hitung ulang payroll draft agar potongan masuk ke penggajian.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Komponen gagal dipasang ke karyawan.')
    } finally {
      setAssignmentSaving(false)
    }
  }

  async function confirmRemoveComponent() {
    if (!removingComponent || !employee) return
    setAssignmentSaving(true)
    try {
      const updated = await removeEmployeeSalaryComponent(employee.id, removingComponent.id)
      setEmployee(updated)
      setRemovingComponent(null)
      toast.success(`${removingComponent.name} dilepas dari ${employee.name}.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Komponen gagal dilepas dari karyawan.')
    } finally {
      setAssignmentSaving(false)
    }
  }

  if (loading) return <PageLoadingSkeleton label="detail karyawan" />
  if (loadError) return <ErrorState message={loadError} onRetry={() => void load()} />
  if (!employee) {
    return (
      <EmptyState
        title="Data karyawan tidak ditemukan"
        description="Karyawan ini mungkin sudah dihapus."
        icon={CircleUserRound}
        action={
          <Link href="/app/karyawan" className={buttonVariants({ variant: 'outline', size: 'action', className: 'bg-white' })}>
            Kembali ke data karyawan
          </Link>
        }
      />
    )
  }

  const payslips = history?.payslips ?? []
  const tabIndex = tabs.indexOf(activeTab)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
            <p className="text-sm text-muted-foreground">ID karyawan {employee.code ?? employee.id}</p>
            <StatusBadge status={employee.status} />
          </div>
        </div>
      </Panel>

      <div role="tablist" aria-label="Informasi karyawan" className="no-scrollbar flex overflow-x-auto border-b border-border">
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
              <DetailValue label="ID karyawan" value={employee.code ?? employee.id} />
              <DetailValue label="Jabatan" value={employee.position} />
              <DetailValue label="Departemen" value={employee.department} />
              <DetailValue label="Mulai bekerja" value={formatTanggal(employee.startedAt)} />
              <DetailValue label="Jenis penggajian" value={employee.payrollType === 'harian' ? 'Harian' : 'Bulanan'} />
              <DetailValue label="NPWP" value={employee.npwp || 'Belum diisi'} />
              <DetailValue label="BPJS" value={employee.noBpjs || employee.bpjsKesehatan || employee.bpjsKetenagakerjaan || 'Belum diisi'} />
            </dl>
          </Panel>
        )}

        {activeTab === 'Riwayat Kehadiran' && (
          <Panel title="Riwayat kehadiran" description="Ringkasan kehadiran sesuai periode yang dipilih.">
            <div className="max-w-xs">
              <TextField
                label="Periode"
                type="month"
                value={attendancePeriod}
                required
                onChange={(event) => {
                  setAttendanceSummary(null)
                  setAttendancePeriod(event.target.value)
                }}
              />
            </div>
            {attendanceLoading ? (
              <PageLoadingSkeleton label="ringkasan kehadiran" />
            ) : attendanceError ? (
              <ErrorState message={attendanceError} onRetry={() => setAttendanceReload((value) => value + 1)} />
            ) : attendanceSummary ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Hari kerja" value={String(attendanceSummary.hari_kerja)} icon={CalendarDays} tone="blue" />
                <StatCard label="Hadir" value={String(attendanceSummary.hadir)} icon={UserCheck} tone="green" />
                <StatCard label="Terlambat" value={String(attendanceSummary.terlambat)} icon={Clock3} tone="amber" />
                <StatCard label="Izin" value={String(attendanceSummary.izin)} icon={FileCheck2} tone="sky" />
                <StatCard label="Sakit" value={String(attendanceSummary.sakit)} icon={HeartPulse} tone="sky" />
                <StatCard label="Cuti" value={String(attendanceSummary.cuti)} icon={CalendarCheck} tone="violet" />
                <StatCard label="Alpha" value={String(attendanceSummary.alpha)} icon={CircleX} tone="red" />
              </div>
            ) : (
              <EmptyState
                title={attendancePeriod ? 'Ringkasan belum tersedia' : 'Pilih periode'}
                description={attendancePeriod ? 'Belum ada ringkasan kehadiran untuk periode ini.' : 'Pilih periode bulan untuk melihat ringkasan kehadiran.'}
                icon={CalendarCheck}
              />
            )}
          </Panel>
        )}

        {activeTab === 'Komponen Gaji' && (
          <Panel title="Komponen gaji" description="Data profil dan komponen terpasang menjadi input perhitungan payroll.">
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
            {salaryPreview && (
              <>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <StatCard label="Total pendapatan" value={formatRupiah(salaryPreview.income)} icon={CircleDollarSign} tone="blue" />
                  <StatCard label="Total potongan" value={formatRupiah(salaryPreview.deductions)} icon={CircleX} tone="amber" />
                  <StatCard label="Gaji bersih" value={formatRupiah(salaryPreview.net)} icon={FileCheck2} tone="green" />
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  Pratinjau menghitung gaji pokok, tunjangan tetap, nominal tetap, dan persentase.
                  {salaryPreview.hasUncalculatedComponents
                    ? ' Komponen berbasis kehadiran atau lembur dihitung setelah data periode tersedia.'
                    : ' Komponen manual periode dihitung saat proses penggajian.'}
                </p>
              </>
            )}
            <div className="mb-2 mt-4 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-heading">Komponen terpasang</h3>
              <Button type="button" variant="outline" size="sm" onClick={() => void openAssignment()}>
                <Plus aria-hidden="true" />
                Pasang komponen
              </Button>
            </div>
            {employee.salaryComponents?.length ? (
              <div className="grid gap-x-8 sm:grid-cols-2">
                {employee.salaryComponents.map((component) => (
                  <div key={component.id} className="flex items-center justify-between gap-3">
                    <dl className="min-w-0 flex-1">
                      <DetailValue label={component.name} value={formatComponentValue(component)} />
                    </dl>
                    {canManageEmployeeComponent(component) && (
                      <TableActionIcon
                        label="Lepas"
                        ariaLabel={`Lepas ${component.name} dari ${employee.name}`}
                        icon={Trash2}
                        tone="red"
                        onClick={() => setRemovingComponent(component)}
                      />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Belum ada komponen tambahan yang dipasang untuk karyawan ini.</p>
            )}
            <p className="mt-3 text-sm text-muted-foreground">
              Nilai komponen diatur per karyawan. Mengubah profil tidak menghapus komponen yang sudah terpasang.
            </p>
          </Panel>
        )}

        {activeTab === 'Riwayat Slip' && !config.mock.penggajian ? (
          <EmployeePayslipHistory employeeId={employee.id} />
        ) : activeTab === 'Riwayat Slip' &&
          (payslips.length === 0 ? (
            <EmptyState
              title="Belum ada riwayat slip"
              description="Slip gaji karyawan ini belum tersedia."
              icon={FileText}
            />
          ) : (
            <Panel title="Riwayat slip gaji" description="Ringkasan slip gaji, belum berupa berkas unduhan.">
              <div className="no-scrollbar overflow-x-auto">
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

      <Dialog open={assignmentOpen} onOpenChange={setAssignmentOpen} label="Pasang komponen gaji" size="md">
        <form noValidate onSubmit={(event) => void saveAssignment(event)}>
          <DialogHeader
            title="Pasang komponen gaji"
            description={`Pilih komponen yang berlaku untuk ${employee.name}. Nilainya akan digunakan saat payroll dihitung.`}
            onClose={() => setAssignmentOpen(false)}
          />
          <div className="grid gap-4 p-5 sm:p-6">
            {componentOptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Tidak ada komponen aktif yang bisa dipasang. Tambahkan komponen terlebih dahulu atau periksa komponen yang sudah terpasang.</p>
            ) : (
              <>
                <label className="flex flex-col gap-2 text-sm font-semibold text-heading">
                  Komponen
                  <select
                    className={componentInputClass}
                    value={selectedComponentId}
                    onChange={(event) => {
                      const selected = componentOptions.find((item) => item.id === event.target.value)
                      setSelectedComponentId(event.target.value)
                      setComponentValue(selected?.amount === null || selected?.amount === undefined ? '' : String(selected.amount))
                    }}
                  >
                    {componentOptions.map((component) => (
                      <option key={component.id} value={component.id}>{component.name} · {component.category}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-2 text-sm font-semibold text-heading">
                  Nilai {componentOptions.find((item) => item.id === selectedComponentId)?.method === 'persen' ? '(persen)' : '(rupiah)'}
                  <input
                    className={componentInputClass}
                    type="number"
                    min="0"
                    max={componentOptions.find((item) => item.id === selectedComponentId)?.method === 'persen' ? 100 : undefined}
                    step="0.01"
                    value={componentValue}
                    onChange={(event) => setComponentValue(event.target.value)}
                    required
                  />
                </label>
              </>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" size="action" onClick={() => setAssignmentOpen(false)}>Batal</Button>
            <Button type="submit" variant="primary" size="action" disabled={assignmentSaving || componentOptions.length === 0}>
              {assignmentSaving ? 'Menyimpan…' : 'Pasang komponen'}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      <Dialog open={removingComponent !== null} onOpenChange={(open) => { if (!open) setRemovingComponent(null) }} label="Lepas komponen gaji">
        <DialogHeader
          title="Lepas komponen?"
          description={`${removingComponent?.name ?? 'Komponen'} tidak akan lagi dihitung untuk karyawan ini pada payroll berikutnya.`}
          onClose={() => setRemovingComponent(null)}
        />
        <DialogFooter>
          <Button type="button" variant="outline" size="action" onClick={() => setRemovingComponent(null)}>Batal</Button>
          <Button type="button" variant="destructive" size="action" disabled={assignmentSaving} onClick={() => void confirmRemoveComponent()}>
            {assignmentSaving ? 'Menyimpan…' : 'Lepas komponen'}
          </Button>
        </DialogFooter>
      </Dialog>

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

function EmployeePayslipHistory({ employeeId }: { employeeId: string }) {
  const [slips, setSlips] = useState<SlipGajiItem[]>([])
  const [selected, setSelected] = useState<SlipGajiItem | null>(null)
  const [detail, setDetail] = useState<SlipGajiDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState('')
  const [detailError, setDetailError] = useState('')
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let active = true
    const id = Number(employeeId)
    if (!Number.isSafeInteger(id) || id < 1) {
      setError('ID karyawan tidak valid untuk memuat riwayat slip.')
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    setSlips([])
    setSelected(null)
    setDetail(null)
    listPayslips({ karyawan_id: id })
      .then((result) => {
        if (active) setSlips(result.items)
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Riwayat slip gagal dimuat.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [employeeId, reload])

  async function selectSlip(slip: SlipGajiItem) {
    setSelected(slip)
    setDetail(null)
    setDetailError('')
    setDetailLoading(true)
    try {
      setDetail(await getPayslip(slip.id))
    } catch (loadError) {
      setDetailError(loadError instanceof Error ? loadError.message : 'Rincian slip gagal dimuat.')
    } finally {
      setDetailLoading(false)
    }
  }

  async function download(slip: SlipGajiItem) {
    try {
      const blob = await downloadPayslipPdf(slip.id)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `slip-gaji-${employeeId}-${slip.periode}.pdf`
      anchor.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      toast.success('Slip gaji berhasil diunduh.')
    } catch (downloadError) {
      toast.error(downloadError instanceof Error ? downloadError.message : 'PDF slip gagal diunduh.')
    }
  }

  if (loading) return <PageLoadingSkeleton label="riwayat slip" />
  if (error) return <ErrorState message={error} onRetry={() => setReload((value) => value + 1)} />
  if (!slips.length) return <EmptyState title="Belum ada riwayat slip" description="Slip gaji karyawan ini belum diterbitkan." icon={FileText} />

  return (
    <div className="flex flex-col gap-5">
      <Panel title="Riwayat slip gaji" description="Daftar slip yang diterbitkan untuk karyawan ini.">
        <div className="no-scrollbar overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <caption className="sr-only">Riwayat slip karyawan</caption>
            <thead><tr className="border-b border-border text-xs font-semibold tracking-wide text-muted-foreground uppercase"><th scope="col" className="py-3 pr-4">Periode</th><th scope="col" className="py-3 pr-4">Tanggal terbit</th><th scope="col" className="py-3 pr-4">Gaji bersih</th><th scope="col" className="py-3">Aksi</th></tr></thead>
            <tbody>{slips.map((slip) => <tr key={slip.id} className="border-b border-border/70 last:border-0"><td className="py-3 pr-4 font-semibold text-heading">{slip.label}</td><td className="py-3 pr-4">{slip.tanggal_terbit}</td><td className="py-3 pr-4 font-semibold tabular-nums text-heading">{formatRupiah(slip.gaji_bersih)}</td><td className="py-3"><Button type="button" variant="outline" size="action" onClick={() => void selectSlip(slip)}>Lihat rincian</Button></td></tr>)}</tbody>
          </table>
        </div>
      </Panel>
      {selected && (detailLoading ? <PageLoadingSkeleton label="rincian slip" /> : detailError ? <ErrorState message={detailError} onRetry={() => void selectSlip(selected)} /> : detail ? (
        <Panel title={`Slip ${selected.label}`} description={`${detail.nomor_slip} · terbit ${detail.tanggal_terbit}`}>
          <dl className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border p-3"><dt className="text-sm text-muted-foreground">Pendapatan</dt><dd className="mt-1 font-semibold text-heading">{formatRupiah(detail.total_pendapatan)}</dd></div>
            <div className="rounded-xl border border-border p-3"><dt className="text-sm text-muted-foreground">Potongan</dt><dd className="mt-1 font-semibold text-heading">{formatRupiah(detail.total_potongan)}</dd></div>
            <div className="rounded-xl border border-border p-3"><dt className="text-sm text-muted-foreground">Gaji bersih</dt><dd className="mt-1 font-semibold text-heading">{formatRupiah(detail.gaji_bersih)}</dd></div>
          </dl>
          <Button type="button" variant="primary" size="action" className="self-start" onClick={() => void download(selected)}><Download aria-hidden="true" />Unduh PDF</Button>
        </Panel>
      ) : null)}
    </div>
  )
}
