'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { BriefcaseBusiness, Building2, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Panel } from '@/components/hadirpay/panel'
import { Button } from '@/components/ui/button'
import { Dialog, DialogFooter, DialogHeader } from '@/components/ui/dialog'
import { EmptyState, ErrorState } from '@/components/ui/empty-state'
import { PageLoadingSkeleton } from '@/components/ui/page-loading-skeleton'
import { TextField } from '@/components/auth/fields'
import { TableActionIcon } from '@/components/ui/table-action-icon'
import { ApiError } from '@/lib/api/client'
import { config } from '@/lib/config'
import type { MasterKind, MasterRecord } from '@/lib/mock/master-data'
import type { Employee } from '@/lib/mock/employees'
import {
  createMasterRecord,
  deleteMasterRecord,
  listMasterRecords,
  updateMasterRecord,
} from '@/lib/services/karyawan.service'
import { listEmployees } from '@/lib/services/karyawan.service'

const pageSize = 7

function kindLabel(kind: MasterKind) {
  return kind === 'jabatan' ? 'Jabatan' : 'Departemen'
}

function kindDescription(kind: MasterKind) {
  return kind === 'jabatan'
    ? 'Kelola nama jabatan yang dapat dipilih pada profil karyawan.'
    : 'Kelola departemen yang digunakan untuk mengelompokkan karyawan.'
}

export function MasterDataPage({ kind }: { kind: MasterKind }) {
  const [records, setRecords] = useState<MasterRecord[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [formRecord, setFormRecord] = useState<MasterRecord | null | undefined>(undefined)
  const [deleteRecord, setDeleteRecord] = useState<MasterRecord | null>(null)
  const [formError, setFormError] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [saving, setSaving] = useState(false)
  const [formName, setFormName] = useState('')

  async function load() {
    setLoading(true)
    setLoadError('')
    try {
      const masterRecords = await listMasterRecords(kind)
      setRecords(masterRecords)
      if (config.mock.karyawan) {
        setEmployees(await listEmployees())
      } else {
        setEmployees([])
      }
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : `Data ${kindLabel(kind).toLowerCase()} gagal dimuat.`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [kind])

  useEffect(() => {
    if (formRecord === undefined) return
    setFormError('')
    setFormName(formRecord?.name ?? '')
  }, [formRecord])

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('id-ID')
    return records
      .filter((record) => record.name.toLocaleLowerCase('id-ID').includes(query))
      .sort((a, b) => a.name.localeCompare(b.name, 'id-ID'))
  }, [records, search])

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const visibleRecords = filtered.slice((page - 1) * pageSize, page * pageSize)

  useEffect(() => {
    setPage(1)
  }, [search, kind])

  useEffect(() => {
    setPage((current) => Math.min(current, pageCount))
  }, [pageCount])

  function usageCount(record: MasterRecord) {
    if (record.employeeCount !== undefined) return record.employeeCount
    return employees.filter((employee) =>
      kind === 'jabatan' ? employee.position === record.name : employee.department === record.name,
    ).length
  }

  async function saveRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = formName.trim()
    if (!name) {
      setFormError(`Nama ${kindLabel(kind).toLowerCase()} wajib diisi.`)
      return
    }
    if (name.length > 60) {
      setFormError(`Nama ${kindLabel(kind).toLowerCase()} maksimal 60 karakter.`)
      return
    }

    setSaving(true)
    setFormError('')
    try {
      if (formRecord) await updateMasterRecord(kind, formRecord.id, name)
      else await createMasterRecord(kind, name)
      setFormRecord(undefined)
      toast.success(`${kindLabel(kind)} berhasil disimpan.`)
      await load()
    } catch (error) {
      const message = error instanceof Error ? error.message : `${kindLabel(kind)} gagal disimpan.`
      setFormError(message)
      if (!(error instanceof ApiError && error.status === 403)) toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    if (!deleteRecord) return
    setDeleteError('')
    try {
      await deleteMasterRecord(kind, deleteRecord.id)
      toast.success(`${kindLabel(kind)} berhasil dihapus.`)
      setDeleteRecord(null)
      await load()
    } catch (error) {
      const message = error instanceof Error ? error.message : `${kindLabel(kind)} gagal dihapus.`
      setDeleteError(message)
      if (!(error instanceof ApiError && error.status === 403)) toast.error(message)
    }
  }

  const Icon = kind === 'jabatan' ? BriefcaseBusiness : Building2

  if (loading) return <PageLoadingSkeleton label={`data ${kindLabel(kind).toLowerCase()}`} />
  if (loadError) return <ErrorState message={loadError} onRetry={() => void load()} />

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button type="button" variant="primary" size="action" onClick={() => setFormRecord(null)}>
          <Plus className="size-4" aria-hidden="true" />
          Tambah {kindLabel(kind).toLowerCase()}
        </Button>
      </div>

      <Panel title={`Data ${kindLabel(kind).toLowerCase()}`} description={kindDescription(kind)}>
        <div className="max-w-xl">
          <TextField
            label={`Cari ${kindLabel(kind).toLowerCase()}`}
            type="search"
            placeholder={`Masukkan nama ${kindLabel(kind).toLowerCase()}`}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            title={records.length === 0 ? `Belum ada data ${kindLabel(kind).toLowerCase()}` : 'Data tidak ditemukan'}
            description={
              records.length === 0
                ? `Tambahkan ${kindLabel(kind).toLowerCase()} agar dapat dipilih pada data karyawan.`
                : 'Ubah kata pencarian atau tambahkan data baru.'
            }
            icon={Icon}
            action={
              records.length > 0 ? (
                <Button type="button" variant="outline" size="action" className="bg-white" onClick={() => setSearch('')}>
                  Hapus pencarian
                </Button>
              ) : null
            }
          />
        ) : (
          <>
            <div className="no-scrollbar overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <caption className="sr-only">Daftar {kindLabel(kind).toLowerCase()}</caption>
                <thead>
                  <tr className="border-b border-border text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    <th scope="col" className="py-3 pr-4">Nama {kindLabel(kind).toLowerCase()}</th>
                    <th scope="col" className="py-3 pr-4">Jumlah karyawan</th>
                    <th scope="col" className="py-3 pr-4">Tindakan</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRecords.map((record) => (
                    <tr key={record.id} className="border-b border-border/70 last:border-0">
                      <td className="py-3 pr-4 font-semibold text-heading">{record.name}</td>
                      <td className="py-3 pr-4">{usageCount(record)} karyawan</td>
                      <td className="py-3">
                        <div className="flex items-center gap-1">
                          <TableActionIcon
                            label="Ubah"
                            ariaLabel={`Ubah ${record.name}`}
                            icon={Pencil}
                            tone="blue"
                            onClick={() => setFormRecord(record)}
                          />
                          <TableActionIcon
                            label="Hapus"
                            ariaLabel={`Hapus ${record.name}`}
                            icon={Trash2}
                            tone="red"
                            onClick={() => {
                              setDeleteError('')
                              setDeleteRecord(record)
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Menampilkan {(page - 1) * pageSize + 1} sampai {Math.min(page * pageSize, filtered.length)} dari {filtered.length} data.
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

      <Dialog
        open={formRecord !== undefined}
        onOpenChange={(open) => {
          if (!open) setFormRecord(undefined)
        }}
        label={formRecord ? `Ubah ${kindLabel(kind).toLowerCase()}` : `Tambah ${kindLabel(kind).toLowerCase()}`}
      >
        <form noValidate onSubmit={saveRecord}>
          <DialogHeader
            title={formRecord ? `Ubah ${kindLabel(kind).toLowerCase()}` : `Tambah ${kindLabel(kind).toLowerCase()}`}
            description="Perubahan tersimpan ke data master."
            onClose={() => setFormRecord(undefined)}
          />
          <div className="flex flex-col gap-2 p-5 sm:p-6">
            <TextField
              label={`Nama ${kindLabel(kind).toLowerCase()}`}
              name="name"
              value={formName}
              onChange={(event) => setFormName(event.target.value)}
              maxLength={60}
              autoComplete="off"
            />
            {formError && <p className="text-sm text-red-700" role="alert">{formError}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" size="action" className="bg-white" onClick={() => setFormRecord(undefined)}>
              Batal
            </Button>
            <Button type="submit" variant="primary" size="action" disabled={saving}>
              {saving ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      <Dialog
        open={deleteRecord !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteRecord(null)
        }}
        label={`Konfirmasi hapus ${kindLabel(kind).toLowerCase()}`}
      >
        <DialogHeader
          title={`Hapus ${kindLabel(kind).toLowerCase()}?`}
          description="Tindakan ini tidak dapat dibatalkan."
          onClose={() => setDeleteRecord(null)}
        />
        <div className="flex flex-col gap-2 p-5 sm:p-6">
          <p className="text-sm text-foreground">
            {deleteRecord ? `Data ${deleteRecord.name} akan dihapus dari daftar.` : ''}
          </p>
          {deleteError && <p className="text-sm text-red-700" role="alert">{deleteError}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" size="action" className="bg-white" onClick={() => setDeleteRecord(null)}>
            Batal
          </Button>
          <Button type="button" variant="destructive" size="action" onClick={() => void confirmDelete()}>
            <Trash2 className="size-4" aria-hidden="true" />
            Hapus {kindLabel(kind).toLowerCase()}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}
