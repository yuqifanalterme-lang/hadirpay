'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { PasswordField, TextField } from '@/components/auth/fields'
import { Button } from '@/components/ui/button'
import { Dialog, DialogFooter, DialogHeader } from '@/components/ui/dialog'
import { SelectField } from '@/components/ui/select-field'
import { ApiError } from '@/lib/api/client'
import { config } from '@/lib/config'
import type { Role } from '@/lib/types/common'
import type { MasterRecord } from '@/lib/mock/master-data'
import type { Employee, EmployeeSalaryComponent, EmployeeStatus, PayrollType } from '@/lib/mock/employees'
import { createEmployee, updateEmployee } from '@/lib/services/karyawan.service'

type SalaryComponentFormValue = Omit<EmployeeSalaryComponent, 'value'> & { value: string }

type FormValues = {
  id: string
  name: string
  email: string
  phone: string
  role: Role | ''
  password: string
  position: string
  department: string
  startedAt: string
  payrollType: PayrollType | ''
  baseSalary: string
  fixedAllowance: string
  pph21: string
  salaryComponents: SalaryComponentFormValue[]
  npwp: string
  noBpjs: string
  status: EmployeeStatus
}

type FieldErrors = Partial<Record<keyof FormValues, string>>

function valuesFromEmployee(employee: Employee | null): FormValues {
  return employee
    ? {
        id: employee.code ?? employee.id,
        name: employee.name,
        email: '',
        phone: '',
        role: '',
        password: '',
        position: employee.position,
        department: employee.department,
        startedAt: employee.startedAt,
        payrollType: employee.payrollType,
        baseSalary: String(employee.baseSalary),
        fixedAllowance: String(employee.fixedAllowance),
        pph21: String(employee.pph21 ?? 0),
        salaryComponents: (employee.salaryComponents ?? []).map((component) => ({
          ...component,
          value: String(component.value),
        })),
        npwp: employee.npwp ?? '',
        noBpjs: employee.noBpjs ?? employee.bpjsKesehatan ?? employee.bpjsKetenagakerjaan ?? '',
        status: employee.status,
      }
    : {
        id: '',
        name: '',
        email: '',
        phone: '',
        role: '',
        password: '',
        position: '',
        department: '',
        startedAt: '',
        payrollType: '',
        baseSalary: '',
        fixedAllowance: '0',
        pph21: '0',
        salaryComponents: [],
        npwp: '',
        noBpjs: '',
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
    setFormError('')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')
    const nextErrors: FieldErrors = {}
    const id = values.id.trim()
    const name = values.name.trim()
    const email = values.email.trim()
    const phone = values.phone.trim()
    const password = values.password
    const baseSalary = Number(values.baseSalary)
    const fixedAllowance = Number(values.fixedAllowance)
    const pph21 = Number(values.pph21)

    if (config.mock.karyawan && !id) nextErrors.id = 'ID karyawan wajib diisi.'
    else if (id && !/^[A-Za-z0-9._-]+$/.test(id)) nextErrors.id = 'Gunakan huruf, angka, titik, garis bawah, atau tanda hubung.'
    if (!name) nextErrors.name = 'Nama karyawan wajib diisi.'
    if (!employee && !email) nextErrors.email = 'Email wajib diisi.'
    else if (!employee && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) nextErrors.email = 'Masukkan alamat email yang valid.'
    if (!employee && !values.role) nextErrors.role = 'Pilih role karyawan.'
    if (!employee && !password) nextErrors.password = 'Password awal wajib diisi.'
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
    if (values.pph21 === '' || !Number.isFinite(pph21) || pph21 < 0) {
      nextErrors.pph21 = 'PPh 21 tidak boleh kurang dari nol.'
    }
    const invalidComponent = values.salaryComponents.find((component) => {
      const value = Number(component.value)
      return (
        component.value === '' ||
        !Number.isFinite(value) ||
        value < 0 ||
        (component.method === 'persen' && value > 100)
      )
    })
    if (invalidComponent) {
      setFormError(
        invalidComponent.method === 'persen'
          ? `Nilai ${invalidComponent.name} harus berupa persentase 0 sampai 100.`
          : `Nilai ${invalidComponent.name} harus berupa angka nol atau lebih.`,
      )
      return
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }
    if (!values.payrollType || (!employee && values.role === '')) return

    const saved: Employee = {
      id,
      name,
      position: values.position,
      department: values.department,
      startedAt: values.startedAt,
      payrollType: values.payrollType,
      baseSalary,
      fixedAllowance,
      pph21,
      salaryComponents: values.salaryComponents.map((component) => ({
        ...component,
        value: component.code === 'PPH21' ? pph21 : Number(component.value),
      })),
      npwp: values.npwp.trim() || undefined,
      noBpjs: values.noBpjs.trim() || undefined,
      status: values.status,
      isMock: true,
    }

    setSubmitting(true)
    try {
      let result: Employee
      if (employee) {
        result = await updateEmployee(employee.id, saved)
      } else {
        const role = values.role
        if (role === '') throw new Error('Pilih role karyawan.')
        result = await createEmployee(saved, {
            email,
            no_hp: phone || null,
            no_bpjs: values.noBpjs.trim() || null,
            role,
            password,
          })
      }
      toast.success(
        employee
          ? 'Data karyawan berhasil diperbarui.'
          : config.mock.karyawan
            ? 'Karyawan berhasil ditambahkan.'
            : 'Karyawan berhasil ditambahkan.',
      )
      onSaved(result, employee?.id)
      onOpenChange(false)
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) toast.error(error.message)
      if (error instanceof ApiError && error.errors) {
        const fieldMap: Partial<Record<string, keyof FormValues>> = {
          nama: 'name',
          email: 'email',
          no_hp: 'phone',
          jabatan_id: 'position',
          departemen_id: 'department',
          tanggal_mulai: 'startedAt',
          jenis_penggajian: 'payrollType',
          gaji_pokok: 'baseSalary',
          tunjangan_tetap: 'fixedAllowance',
          pph21: 'pph21',
          npwp: 'npwp',
          no_bpjs: 'noBpjs',
          role: 'role',
          password: 'password',
          status: 'status',
        }
        const fieldErrors: FieldErrors = {}
        let hasUnmappedError = false
        for (const [field, messages] of Object.entries(error.errors)) {
          const formField = fieldMap[field]
          if (!formField || !messages[0]) {
            hasUnmappedError = true
            continue
          }
          fieldErrors[formField] = messages[0]
        }
        setErrors((current) => ({ ...current, ...fieldErrors }))
        setFormError(hasUnmappedError ? error.message : '')
      } else {
        setFormError(error instanceof Error ? error.message : 'Data karyawan gagal disimpan.')
      }
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
          description="Masukkan nilai gaji pokok dan komponen sesuai data karyawan."
          onClose={() => onOpenChange(false)}
        />
        <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
          <div>
            <TextField
              id="employee-id"
              label="ID karyawan"
              value={values.id}
              onChange={(event) => update('id', event.target.value)}
              readOnly={!config.mock.karyawan}
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
          {!employee && (
            <>
              <div>
                <TextField
                  id="employee-email"
                  label="Email"
                  type="email"
                  value={values.email}
                  onChange={(event) => update('email', event.target.value)}
                  required
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? 'employee-email-error' : undefined}
                  autoComplete="email"
                />
                {fieldError('email', 'employee-email-error')}
              </div>
              <div>
                <TextField
                  id="employee-phone"
                  label="Nomor HP (opsional)"
                  type="tel"
                  value={values.phone}
                  onChange={(event) => update('phone', event.target.value)}
                  aria-invalid={Boolean(errors.phone)}
                  aria-describedby={errors.phone ? 'employee-phone-error' : undefined}
                  autoComplete="tel"
                />
                {fieldError('phone', 'employee-phone-error')}
              </div>
              <div>
                <SelectField
                  id="employee-role"
                  label="Role"
                  value={values.role}
                  onChange={(value) => {
                    if (value === '' || value === 'admin_hrd' || value === 'karyawan' || value === 'keuangan' || value === 'pemilik') {
                      update('role', value)
                    }
                  }}
                  options={['admin_hrd', 'karyawan', 'keuangan', 'pemilik']}
                  placeholder="Pilih role"
                  required
                  aria-invalid={Boolean(errors.role)}
                  aria-describedby={errors.role ? 'employee-role-error' : undefined}
                />
                {fieldError('role', 'employee-role-error')}
              </div>
              <div>
                <PasswordField
                  id="employee-password"
                  label="Password awal"
                  value={values.password}
                  onChange={(event) => update('password', event.target.value)}
                  required
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={errors.password ? 'employee-password-error' : undefined}
                  autoComplete="new-password"
                />
                {fieldError('password', 'employee-password-error')}
              </div>
            </>
          )}
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
            <TextField
              id="employee-pph21"
              label="PPh 21 per periode (Rp)"
              type="number"
              min="0"
              step="1"
              value={values.pph21}
              onChange={(event) => update('pph21', event.target.value)}
              aria-invalid={Boolean(errors.pph21)}
              aria-describedby={errors.pph21 ? 'employee-pph21-error' : undefined}
            />
            {fieldError('pph21', 'employee-pph21-error')}
          </div>
          {values.salaryComponents
            .filter((component) => component.code !== 'PPH21')
            .map((component) => {
              const unit = {
                nominal_tetap: 'Rp per periode',
                persen: '%',
                per_hari: 'Rp per hari',
                per_jam: 'Rp per jam',
                per_menit: 'Rp per menit',
              }[component.method]
              return (
                <div key={component.id}>
                  <TextField
                    id={`employee-component-${component.id}`}
                    label={`${component.name} (${unit})`}
                    type="number"
                    min="0"
                    max={component.method === 'persen' ? '100' : undefined}
                    step="any"
                    value={component.value}
                    onChange={(event) => {
                      const value = event.target.value
                      setValues((current) => ({
                        ...current,
                        salaryComponents: current.salaryComponents.map((item) =>
                          item.id === component.id ? { ...item, value } : item,
                        ),
                      }))
                      setFormError('')
                    }}
                  />
                </div>
              )
            })}
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
              label="Nomor BPJS (opsional)"
              value={values.noBpjs}
              onChange={(event) => update('noBpjs', event.target.value)}
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
