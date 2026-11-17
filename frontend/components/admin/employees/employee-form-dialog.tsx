'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { TextField } from '@/components/auth/fields'
import { Button } from '@/components/ui/button'
import { Dialog, DialogFooter, DialogHeader } from '@/components/ui/dialog'
import { SelectField } from '@/components/ui/select-field'
import type { MasterRecord } from '@/lib/mock/master-data'
import type { Employee, EmployeeStatus, PayrollType } from '@/lib/mock/employees'
import { createEmployee, updateEmployee } from '@/lib/services/employee-service'

type FormValues = {
  id: string
  name: string
  position: string
  department: string
  startedAt: string
  payrollType: PayrollType | ''
  baseSalary: string
  fixedAllowance: string
  npwp: string
  bpjsKesehatan: string
  bpjsKetenagakerjaan: string
  status: EmployeeStatus
}

type FieldErrors = Partial<Record<keyof FormValues, string>>

function valuesFromEmployee(employee: Employee | null): FormValues {
  return employee
    ? {
        id: employee.id,
        name: employee.name,
        position: employee.position,
        department: employee.department,
        startedAt: employee.startedAt,
        payrollType: employee.payrollType,
        baseSalary: String(employee.baseSalary),
        fixedAllowance: String(employee.fixedAllowance),
        npwp: employee.npwp ?? '',
        bpjsKesehatan: employee.bpjsKesehatan ?? '',
        bpjsKetenagakerjaan: employee.bpjsKetenagakerjaan ?? '',
        status: employee.status,
      }
    : {
        id: '',
        name: '',
        position: '',
        department: '',
        startedAt: '',
        payrollType: '',
        baseSalary: '',
        fixedAllowance: '0',
        npwp: '',
        bpjsKesehatan: '',
        bpjsKetenagakerjaan: '',
        status: 'Aktif',
      }
}

export function EmployeeFormDialog({
  open,
  employee,
  positions,
  departments,
  onOpenChange,
  onSaved,
}: {
  open: boolean
  employee: Employee | null
  positions: MasterRecord[]
  departments: MasterRecord[]
  onOpenChange: (open: boolean) => void
  onSaved: (employee: Employee, previousId?: string) => void
}) {
  const [values, setValues] = useState<FormValues>(() => valuesFromEmployee(employee))
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setValues(valuesFromEmployee(employee))
    setErrors({})
    setFormError('')
  }, [employee, open])

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')
    const nextErrors: FieldErrors = {}
    const id = values.id.trim()
    const name = values.name.trim()
    const baseSalary = Number(values.baseSalary)
    const fixedAllowance = Number(values.fixedAllowance)

    if (!id) nextErrors.id = 'ID karyawan wajib diisi.'
    else if (!/^[A-Za-z0-9._-]+$/.test(id)) nextErrors.id = 'Gunakan huruf, angka, titik, garis bawah, atau tanda hubung.'
    if (!name) nextErrors.name = 'Nama karyawan wajib diisi.'
    if (!values.position) nextErrors.position = 'Pilih jabatan karyawan.'
    if (!values.department) nextErrors.department = 'Pilih departemen karyawan.'
    if (!values.startedAt) nextErrors.startedAt = 'Tanggal mulai bekerja wajib diisi.'
    if (!values.payrollType) nextErrors.payrollType = 'Pilih jenis penggajian.'
    if (!values.baseSalary || !Number.isFinite(baseSalary) || baseSalary <= 0) {
      nextErrors.baseSalary = 'Masukkan gaji pokok atau tarif harian yang lebih dari nol.'
    }
    if (values.fixedAllowance === '' || !Number.isFinite(fixedAllowance) || fixedAllowance < 0) {
      nextErrors.fixedAllowance = 'Tunjangan tetap tidak boleh kurang dari nol.'
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }
    if (!values.payrollType) return

    const saved: Employee = {
      id,
      name,
      position: values.position,
      department: values.department,
      startedAt: values.startedAt,
      payrollType: values.payrollType,
      baseSalary,
      fixedAllowance,
      npwp: values.npwp.trim() || undefined,
      bpjsKesehatan: values.bpjsKesehatan.trim() || undefined,
      bpjsKetenagakerjaan: values.bpjsKetenagakerjaan.trim() || undefined,
      status: values.status,
      isMock: true,
    }

    setSubmitting(true)
    try {
      const result = employee ? await updateEmployee(employee.id, saved) : await createEmployee(saved)
      toast.success(employee ? 'Data karyawan berhasil diperbarui.' : 'Karyawan contoh berhasil ditambahkan.')
      onSaved(result, employee?.id)
      onOpenChange(false)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Data karyawan gagal disimpan.')
    } finally {
      setSubmitting(false)
    }
  }

  const fieldError = (key: keyof FormValues, id: string) =>
    errors[key] ? (
      <p id={id} className="text-sm text-red-700" role="alert">
        {errors[key]}
      </p>
    ) : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange} label={employee ? 'Ubah data karyawan' : 'Tambah karyawan'} size="lg">
      <form noValidate onSubmit={handleSubmit}>
        <DialogHeader
          title={employee ? 'Ubah data karyawan' : 'Tambah karyawan'}
          description="Data yang disimpan di sini hanya berlaku untuk mode demo."
          onClose={() => onOpenChange(false)}
        />
        <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
          <div>
            <TextField
              id="employee-id"
              label="ID karyawan"
              value={values.id}
              onChange={(event) => update('id', event.target.value)}
              aria-invalid={Boolean(errors.id)}
              aria-describedby={errors.id ? 'employee-id-error' : undefined}
              autoComplete="off"
            />
            {fieldError('id', 'employee-id-error')}
          </div>
          <div>
            <TextField
              id="employee-name"
              label="Nama lengkap"
              value={values.name}
              onChange={(event) => update('name', event.target.value)}
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? 'employee-name-error' : undefined}
              autoComplete="name"
            />
            {fieldError('name', 'employee-name-error')}
          </div>
          <div>
            <SelectField
              id="employee-position"
              label="Jabatan"
              value={values.position}
              onChange={(value) => update('position', value)}
              options={positions.map((position) => position.name)}
              placeholder="Pilih jabatan"
              aria-invalid={Boolean(errors.position)}
              aria-describedby={errors.position ? 'employee-position-error' : undefined}
            />
            {fieldError('position', 'employee-position-error')}
          </div>
          <div>
            <SelectField
              id="employee-department"
              label="Departemen"
              value={values.department}
              onChange={(value) => update('department', value)}
              options={departments.map((department) => department.name)}
              placeholder="Pilih departemen"
              aria-invalid={Boolean(errors.department)}
              aria-describedby={errors.department ? 'employee-department-error' : undefined}
            />
            {fieldError('department', 'employee-department-error')}
          </div>
          <div>
            <TextField
              id="employee-started-at"
              label="Tanggal mulai bekerja"
              type="date"
              value={values.startedAt}
              onChange={(event) => update('startedAt', event.target.value)}
              aria-invalid={Boolean(errors.startedAt)}
              aria-describedby={errors.startedAt ? 'employee-started-at-error' : undefined}
            />
            {fieldError('startedAt', 'employee-started-at-error')}
          </div>
          <div>
            <SelectField
              id="employee-payroll-type"
              label="Jenis penggajian"
              value={values.payrollType}
              onChange={(value) => {
                if (value === '' || value === 'bulanan' || value === 'harian') update('payrollType', value)
              }}
              options={['bulanan', 'harian']}
              placeholder="Pilih jenis penggajian"
              aria-invalid={Boolean(errors.payrollType)}
              aria-describedby={errors.payrollType ? 'employee-payroll-type-error' : undefined}
            />
            {fieldError('payrollType', 'employee-payroll-type-error')}
          </div>
          <div>
            <TextField
              id="employee-base-salary"
              label={values.payrollType === 'harian' ? 'Tarif harian (Rp)' : 'Gaji pokok (Rp)'}
              type="number"
              min="1"
              step="1"
              value={values.baseSalary}
              onChange={(event) => update('baseSalary', event.target.value)}
              aria-invalid={Boolean(errors.baseSalary)}
              aria-describedby={errors.baseSalary ? 'employee-base-salary-error' : undefined}
            />
            {fieldError('baseSalary', 'employee-base-salary-error')}
          </div>
          <div>
            <TextField
              id="employee-fixed-allowance"
              label="Tunjangan tetap (Rp)"
              type="number"
              min="0"
              step="1"
              value={values.fixedAllowance}
              onChange={(event) => update('fixedAllowance', event.target.value)}
              aria-invalid={Boolean(errors.fixedAllowance)}
              aria-describedby={errors.fixedAllowance ? 'employee-fixed-allowance-error' : undefined}
            />
            {fieldError('fixedAllowance', 'employee-fixed-allowance-error')}
          </div>
          <div>
            <SelectField
              label="Status karyawan"
              value={values.status}
              onChange={(value) => {
                if (value === 'Aktif' || value === 'Nonaktif') update('status', value)
              }}
              options={['Aktif', 'Nonaktif']}
              placeholder="Pilih status"
              required
            />
          </div>
          <div>
            <TextField
              label="NPWP (opsional)"
              value={values.npwp}
              onChange={(event) => update('npwp', event.target.value)}
              autoComplete="off"
            />
          </div>
          <div>
            <TextField
              label="BPJS Kesehatan (opsional)"
              value={values.bpjsKesehatan}
              onChange={(event) => update('bpjsKesehatan', event.target.value)}
              autoComplete="off"
            />
          </div>
          <div>
            <TextField
              label="BPJS Ketenagakerjaan (opsional)"
              value={values.bpjsKetenagakerjaan}
              onChange={(event) => update('bpjsKetenagakerjaan', event.target.value)}
              autoComplete="off"
            />
          </div>
          {formError && (
            <p className="text-sm text-red-700 sm:col-span-2" role="alert">
              {formError}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" size="action" className="bg-white" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button type="submit" variant="primary" size="action" disabled={submitting}>
            {submitting ? 'Menyimpan...' : 'Simpan karyawan'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}
