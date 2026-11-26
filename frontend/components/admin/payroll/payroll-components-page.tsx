'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Pencil, Plus, Trash2, UserCheck, UserX } from 'lucide-react'
import { toast } from 'sonner'
import { Panel } from '@/components/hadirpay/panel'
import { StatusBadge } from '@/components/hadirpay/status-badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Dialog, DialogFooter, DialogHeader } from '@/components/ui/dialog'
import { EmptyState, ErrorState } from '@/components/ui/empty-state'
import { PageLoadingSkeleton } from '@/components/ui/page-loading-skeleton'
import { TableActionIcon } from '@/components/ui/table-action-icon'
import { ROLE_STORAGE_KEY, type Role } from '@/lib/navigation'
import { config } from '@/lib/config'
import { ApiError, type ApiErrorFields } from '@/lib/api/client'
import type { PayrollComponent, PayrollComponentCategory, PayrollComponentMethod } from '@/lib/mock/payroll'
import {
  deletePayrollComponent,
  listPayrollComponents,
  savePayrollComponent,
  updatePayrollComponentStatus,
} from '@/lib/services/penggajian.service'

type FormValue = {
  code: string
  name: string
  category: PayrollComponentCategory
  method: PayrollComponentMethod
  amount: string
  active: boolean
}

const blankForm: FormValue = {
  code: '',
  name: '',
  category: 'pendapatan',
  method: 'nominal tetap',
  amount: '',
  active: true,
}

const inputClass = 'min-h-12 w-full rounded-xl border border-border bg-white px-3 text-sm text-heading focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none'

export function PayrollComponentsPage() {
  const [role, setRole] = useState<Role | null>(null)
  const [components, setComponents] = useState<PayrollComponent[]>([])
  const [roleReady, setRoleReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editing, setEditing] = useState<PayrollComponent | null>(null)
  const [deleting, setDeleting] = useState<PayrollComponent | null>(null)
  const [form, setForm] = useState<FormValue>(blankForm)
  const [fieldErrors, setFieldErrors] = useState<ApiErrorFields>({})
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    setError('')
    try {
      setComponents(await listPayrollComponents())
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Komponen gaji gagal dimuat.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const storedRole = localStorage.getItem(ROLE_STORAGE_KEY)
    setRole(storedRole === 'admin' || storedRole === 'keuangan' || storedRole === 'karyawan' ? storedRole : null)
    setRoleReady(true)
  }, [])

  useEffect(() => {
    if (role === 'admin') void load()
    else if (roleReady) setLoading(false)
  }, [role, roleReady])

  function openForm(component?: PayrollComponent) {
    setEditing(component ?? null)
    setFieldErrors({})
    setForm(component
      ? {
          code: component.code ?? '',
          name: component.name,
          category: component.category,
          method: component.method,
          amount: component.amount === null ? '' : String(component.amount),
          active: component.active,
        }
      : blankForm)
    setFormOpen(true)
  }

  function updateFormField<K extends keyof FormValue>(field: K, value: FormValue[K]) {
    const apiField: Record<keyof FormValue, string> = {
      code: 'kode',
      name: 'nama',
      category: 'tipe',
      method: 'metode',
      amount: 'nilai',
      active: 'aktif',
    }
    setForm((current) => ({ ...current, [field]: value }))
    setFieldErrors((current) => {
      const next = { ...current }
      delete next[apiField[field]]
      return next
    })
  }

  function renderFieldErrors(field: string, id: string) {
    const messages = fieldErrors[field] ?? []
    if (messages.length === 0) return null
    return (
      <span id={id} className="text-sm font-normal text-red-700" role="alert">
        {messages.map((message, index) => <span key={`${field}-${index}`} className="block">{message}</span>)}
      </span>
    )
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const errors: ApiErrorFields = {}
    const amountText = form.amount.trim()
    const amount = amountText === '' ? null : Number(amountText)

    if (!form.name.trim()) errors.nama = ['Nama komponen wajib diisi.']
    if (!config.mock.penggajian && !form.code.trim()) errors.kode = ['Kode komponen wajib diisi.']
    if (amountText !== '' && !Number.isFinite(amount)) {
      errors.nilai = ['Nilai harus berupa angka.']
    } else if (amount !== null && amount < 0) {
      errors.nilai = ['Nilai tidak boleh negatif.']
    } else if (form.method === 'persen' && amount !== null && amount > 100) {
      errors.nilai = ['Nilai persen harus antara 0 sampai 100.']
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setFieldErrors({})
    setSaving(true)
    try {
      const updated = await savePayrollComponent({
        id: editing?.id ?? `komponen-${crypto.randomUUID()}`,
        code: editing ? form.code : form.code.trim(),
        name: form.name.trim(),
        category: form.category,
        method: form.method,
        amount,
        active: form.active,
      })
      setComponents(updated)
      setFormOpen(false)
      toast.success(editing ? 'Komponen gaji diperbarui.' : 'Komponen gaji ditambahkan.')
    } catch (saveError) {
      if (saveError instanceof ApiError && saveError.status === 422) {
        const messages = Object.values(saveError.errors ?? {}).flat()
        if (messages.length > 0) setFieldErrors(saveError.errors ?? {})
        else toast.error('Data tidak valid')
      } else {
        toast.error(saveError instanceof Error ? saveError.message : 'Komponen gaji gagal disimpan.')
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleting) return
    try {
      setComponents(await deletePayrollComponent(deleting.id))
      setDeleteOpen(false)
      setDeleting(null)
      toast.success('Komponen gaji dihapus.')
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : 'Komponen gaji gagal dihapus.')
    }
  }

  async function handleStatus(component: PayrollComponent) {
    try {
      setComponents(await updatePayrollComponentStatus(component.id, !component.active))
      toast.success(`Komponen ${component.active ? 'dinonaktifkan' : 'diaktifkan'}.`)
    } catch (statusError) {
      toast.error(statusError instanceof Error ? statusError.message : 'Status komponen gagal diubah.')
    }
  }

  if (!roleReady || loading) return <PageLoadingSkeleton label="komponen gaji" />
  if (role !== 'admin') {
    return (
      <EmptyState
        title="Pengaturan komponen dikelola Admin/HRD"
        description="Gunakan akun Admin/HRD untuk mengubah komponen gaji."
        icon={Plus}
        action={<Link href="/app/penggajian" className={buttonVariants({ variant: 'primary', size: 'action' })}>Kembali ke penggajian</Link>}
      />
    )
  }
  if (error) return <ErrorState message={error} onRetry={() => void load()} />

  const keepsAutomaticValue = editing?.amount === null && form.amount === '' && form.method === editing.method

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-heading">Komponen gaji</h2>
          <p className="mt-1 text-sm text-muted-foreground">Kelola daftar komponen pendapatan dan potongan.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/app/penggajian" className={buttonVariants({ variant: 'outline', size: 'action', className: 'bg-white' })}>
            Kembali ke penggajian
          </Link>
          <Button type="button" variant="primary" size="action" onClick={() => openForm()}>
            <Plus aria-hidden="true" />
            Tambah komponen
          </Button>
        </div>
      </div>

      <Panel title="Daftar komponen" description="Setelah disimpan, pasang komponen ke profil karyawan agar ikut dihitung dalam payroll.">
        {components.length === 0 ? (
          <EmptyState
            title="Belum ada komponen gaji"
            description="Tambahkan komponen pendapatan atau potongan untuk menyiapkan penggajian."
            icon={Plus}
            action={<Button type="button" variant="primary" size="action" onClick={() => openForm()}>Tambah komponen</Button>}
          />
        ) : (
          <div className="no-scrollbar overflow-x-auto rounded-xl border border-border">
            <table className={`w-full ${config.mock.penggajian ? 'min-w-[660px]' : 'min-w-[760px]'} border-collapse text-left text-sm`}>
              <caption className="sr-only">Daftar komponen gaji</caption>
              <thead className="bg-surface text-xs font-semibold uppercase text-muted-foreground">
                <tr>
                  {!config.mock.penggajian && <th scope="col" className="px-4 py-3">Kode</th>}
                  <th scope="col" className="px-4 py-3">Nama komponen</th>
                  <th scope="col" className="px-4 py-3">Tipe</th>
                  <th scope="col" className="px-4 py-3">Metode</th>
                  <th scope="col" className="px-4 py-3 text-right">Nilai</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {components.map((component) => (
                  <tr key={component.id} className="hover:bg-surface/70">
                    {!config.mock.penggajian && <td className="px-4 py-3 font-medium tabular-nums">{component.code}</td>}
                    <td className="px-4 py-3 font-semibold text-heading">{component.name}</td>
                    <td className="px-4 py-3 capitalize">{component.category}</td>
                    <td className="px-4 py-3 capitalize">{component.method}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {component.amount === null
                        ? component.description || 'Dihitung otomatis'
                        : component.method === 'persen'
                          ? `${component.amount}%`
                          : component.amount.toLocaleString('id-ID')}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={component.active ? 'Aktif' : 'Nonaktif'} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <TableActionIcon label="Ubah" ariaLabel={`Ubah ${component.name}`} icon={Pencil} tone="blue" onClick={() => openForm(component)} />
                        {component.active ? (
                          <TableActionIcon label="Nonaktifkan" ariaLabel={`Nonaktifkan ${component.name}`} icon={UserX} tone="red" disabled={saving} onClick={() => void handleStatus(component)} />
                        ) : (
                          <TableActionIcon label="Aktifkan" ariaLabel={`Aktifkan ${component.name}`} icon={UserCheck} tone="green" disabled={saving} onClick={() => void handleStatus(component)} />
                        )}
                        <TableActionIcon
                          label="Hapus"
                          ariaLabel={`Hapus ${component.name}`}
                          icon={Trash2}
                          tone="red"
                          onClick={() => {
                            setDeleting(component)
                            setDeleteOpen(true)
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Dialog open={formOpen} onOpenChange={setFormOpen} label={editing ? 'Ubah komponen gaji' : 'Tambah komponen gaji'} size="md">
        <form noValidate onSubmit={(event) => void handleSave(event)}>
          <DialogHeader
            title={editing ? 'Ubah komponen gaji' : 'Tambah komponen gaji'}
            description="Perubahan disimpan ke komponen gaji."
            onClose={() => setFormOpen(false)}
          />
          <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
            {!config.mock.penggajian && (
              <label className="flex flex-col gap-2 text-sm font-semibold text-heading sm:col-span-2">
                Kode komponen
                <input
                  className={inputClass}
                  value={form.code}
                  onChange={(event) => updateFormField('code', event.target.value)}
                  aria-invalid={Boolean(fieldErrors.kode?.length)}
                  aria-describedby={fieldErrors.kode?.length ? 'component-code-error' : undefined}
                />
                {renderFieldErrors('kode', 'component-code-error')}
              </label>
            )}
            <label className="flex flex-col gap-2 text-sm font-semibold text-heading sm:col-span-2">
              Nama komponen
              <input
                className={inputClass}
                value={form.name}
                onChange={(event) => updateFormField('name', event.target.value)}
                aria-invalid={Boolean(fieldErrors.nama?.length)}
                aria-describedby={fieldErrors.nama?.length ? 'component-name-error' : undefined}
              />
              {renderFieldErrors('nama', 'component-name-error')}
            </label>
            <label className="flex flex-col gap-2 text-sm font-semibold text-heading">
              Tipe
              <select
                className={inputClass}
                value={form.category}
                onChange={(event) => updateFormField('category', event.target.value as PayrollComponentCategory)}
                aria-invalid={Boolean(fieldErrors.tipe?.length)}
                aria-describedby={fieldErrors.tipe?.length ? 'component-type-error' : undefined}
              >
                <option value="pendapatan">Pendapatan</option>
                <option value="potongan">Potongan</option>
              </select>
              {renderFieldErrors('tipe', 'component-type-error')}
            </label>
            <label className="flex flex-col gap-2 text-sm font-semibold text-heading">
              Metode
              <select
                className={inputClass}
                value={form.method}
                onChange={(event) => updateFormField('method', event.target.value as PayrollComponentMethod)}
                aria-invalid={Boolean(fieldErrors.metode?.length)}
                aria-describedby={fieldErrors.metode?.length ? 'component-method-error' : undefined}
              >
                <option value="nominal tetap">Nominal tetap</option>
                <option value="persen">Persen</option>
                <option value="per hari">Per hari</option>
              </select>
              {renderFieldErrors('metode', 'component-method-error')}
            </label>
            <label className="flex flex-col gap-2 text-sm font-semibold text-heading sm:col-span-2">
              Nilai {form.method === 'persen' ? '(persen)' : '(rupiah)'}
              <input
                className={inputClass}
                type="number"
                min="0"
                max={form.method === 'persen' ? 100 : undefined}
                step="0.01"
                value={form.amount}
                onChange={(event) => updateFormField('amount', event.target.value)}
                readOnly={form.code === 'BPJS'}
                aria-invalid={Boolean(fieldErrors.nilai?.length)}
                aria-describedby={fieldErrors.nilai?.length ? 'component-amount-error' : undefined}
              />
              {form.code === 'BPJS' && <span className="text-xs font-normal text-muted-foreground">BPJS tetap 3% dari gaji pokok.</span>}
              {renderFieldErrors('nilai', 'component-amount-error')}
            </label>
            <label className="flex min-h-11 items-center gap-3 text-sm font-semibold text-heading sm:col-span-2">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(event) => updateFormField('active', event.target.checked)}
                className="size-5 accent-primary"
                aria-invalid={Boolean(fieldErrors.aktif?.length)}
                aria-describedby={fieldErrors.aktif?.length ? 'component-active-error' : undefined}
              />
              Komponen aktif
              {renderFieldErrors('aktif', 'component-active-error')}
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" size="action" onClick={() => setFormOpen(false)}>Batal</Button>
            <Button type="submit" variant="primary" size="action" disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan komponen'}</Button>
          </DialogFooter>
        </form>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen} label="Konfirmasi hapus komponen gaji">
        <DialogHeader
          title="Hapus komponen gaji?"
          description={`Komponen ${deleting?.name ?? ''} akan dihapus.`}
          onClose={() => setDeleteOpen(false)}
        />
        <DialogFooter>
          <Button type="button" variant="outline" size="action" onClick={() => setDeleteOpen(false)}>Batal</Button>
          <Button type="button" variant="destructive" size="action" onClick={() => void handleDelete()}>Hapus komponen</Button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}
