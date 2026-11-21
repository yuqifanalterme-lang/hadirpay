'use client'

import { useEffect, useMemo, useState } from 'react'
import { BookOpenText, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Panel } from '@/components/hadirpay/panel'
import { StatCard } from '@/components/hadirpay/stat-card'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { DemoDataNotice } from '@/components/ui/demo-data-notice'
import { Dialog, DialogFooter, DialogHeader } from '@/components/ui/dialog'
import { EmptyState, ErrorState } from '@/components/ui/empty-state'
import { PageLoadingSkeleton } from '@/components/ui/page-loading-skeleton'
import { AccountingAccess, AccountingPageTitle } from './accounting-shared'
import { useAccountingRole } from '@/lib/hooks/use-accounting-role'
import type { AccountingAccount } from '@/lib/mock/accounting'
import { createAccount, deleteAccount, listAccounts, updateAccount } from '@/lib/services/akuntansi.service'
import type { AkunWriteRequest } from '@/lib/types/akuntansi'

type AccountForm = Omit<AkunWriteRequest, 'aktif'> & { aktif: boolean }
const blankForm: AccountForm = { kode: '', nama: '', kategori: 'aset', saldo_normal: 'debit', aktif: true }
const categoryMap = {
  Aset: 'aset',
  Liabilitas: 'kewajiban',
  Ekuitas: 'ekuitas',
  Pendapatan: 'pendapatan',
  Beban: 'beban',
} as const

function accountInitials(name: string) {
  return name.split(/[\s/]+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()
}

export function AccountsPage() {
  const role = useAccountingRole()
  const [accounts, setAccounts] = useState<AccountingAccount[]>([])
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<AccountingAccount | null>(null)
  const [deleting, setDeleting] = useState<AccountingAccount | null>(null)
  const [form, setForm] = useState<AccountForm>(blankForm)
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState(false)
  const canManage = role === 'keuangan'

  async function load() {
    setLoading(true)
    setError('')
    try {
      setAccounts(await listAccounts())
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Data akun gagal dimuat.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => window.clearTimeout(timeout)
  }, [search])

  useEffect(() => {
    if (role === 'admin' || role === 'keuangan' || role === 'pemilik') void load()
    else if (role === 'karyawan' || role === null) setLoading(false)
  }, [role])

  const filteredAccounts = useMemo(() => {
    const term = debouncedSearch.trim().toLocaleLowerCase('id-ID')
    return term
      ? accounts.filter((account) =>
          [account.code, account.name, account.category]
            .some((value) => value.toLocaleLowerCase('id-ID').includes(term)),
        )
      : accounts
  }, [accounts, debouncedSearch])
  const totalPages = Math.max(1, Math.ceil(filteredAccounts.length / pageSize))
  const visibleAccounts = filteredAccounts.slice((page - 1) * pageSize, page * pageSize)

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  function openForm(account?: AccountingAccount) {
      setEditing(account ?? null)
      setForm(account ? {
        kode: account.code,
        nama: account.name,
        kategori: categoryMap[account.category],
        saldo_normal: account.normalBalance === 'Debit' ? 'debit' : 'kredit',
        aktif: account.active ?? true,
      } : blankForm)
      setFormOpen(true)
  }

  async function saveAccount(event: React.FormEvent<HTMLFormElement>) {
      event.preventDefault()
      setSaving(true)
      try {
        if (editing) {
          await updateAccount(editing.id ?? editing.code, form)
        } else {
          await createAccount(form)
        }
        await load()
        setFormOpen(false)
        toast.success(editing ? 'Akun berhasil diperbarui.' : 'Akun berhasil ditambahkan.')
      } catch (saveError) {
        toast.error(saveError instanceof Error ? saveError.message : 'Akun gagal disimpan.')
      } finally {
        setSaving(false)
      }
  }

  async function removeAccount() {
      if (!deleting) return
      setBusy(true)
      try {
        await deleteAccount(deleting.id ?? deleting.code)
        setDeleting(null)
        await load()
        toast.success('Akun berhasil dihapus.')
      } catch (deleteError) {
        toast.error(deleteError instanceof Error ? deleteError.message : 'Akun gagal dihapus.')
      } finally {
        setBusy(false)
      }
  }

  return (
    <AccountingAccess role={role}>
      {loading ? <PageLoadingSkeleton label="data akun" /> : error ? <ErrorState message={error} onRetry={() => void load()} /> : (
        <div className="flex flex-col gap-6">
          <DemoDataNotice>Bagan akun seed mode demo. Saldo aktual akan muncul setelah transaksi dijurnal.</DemoDataNotice>
          <AccountingPageTitle
            title="Data akun"
            description="Bagan akun yang digunakan untuk jurnal penggajian dan pencatatan manual."
            action={canManage ? <Button type="button" variant="primary" size="action" onClick={() => openForm()}><Plus aria-hidden="true" />Tambah akun</Button> : undefined}
          />
          <StatCard label="Akun tersedia" value={String(filteredAccounts.length)} hint="Akun dalam bagan" icon={BookOpenText} tone="blue" />
          <Panel title="Bagan akun" description="Kode, kategori, dan saldo normal setiap akun.">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <label className="flex w-full flex-col gap-2 text-sm font-semibold text-heading sm:max-w-sm">
                Cari akun
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="min-h-12 rounded-xl border border-border bg-white px-4 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-semibold text-heading">
                Per halaman
                <select
                  value={pageSize}
                  onChange={(event) => {
                    setPageSize(Number(event.target.value))
                    setPage(1)
                  }}
                  className="min-h-12 rounded-xl border border-border bg-white px-4"
                >
                  {[10, 20, 50].map((size) => <option key={size} value={size}>{size}</option>)}
                </select>
              </label>
            </div>
            {filteredAccounts.length === 0 ? (
              <EmptyState title="Belum ada akun" description="Bagan akun belum memiliki data seed." icon={BookOpenText} />
            ) : (
              <div className="no-scrollbar overflow-x-auto rounded-xl border border-border">
                <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                  <caption className="sr-only">Bagan akun akuntansi demo</caption>
                  <thead className="bg-surface text-xs font-semibold uppercase text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-4 py-3">Kode</th>
                      <th scope="col" className="px-4 py-3">Nama akun</th>
                      <th scope="col" className="px-4 py-3">Kategori</th>
                      <th scope="col" className="px-4 py-3">Saldo normal</th>
                      {canManage && <><th scope="col" className="px-4 py-3">Status</th><th scope="col" className="px-4 py-3">Aksi</th></>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {visibleAccounts.map((account) => (
                      <tr key={account.code} className="hover:bg-surface/70">
                        <td className="px-4 py-3 font-semibold tabular-nums text-heading">{account.code}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar initials={accountInitials(account.name)} tone="outlined" />
                            <span className="font-semibold text-heading">{account.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">{account.category}</td>
                        <td className="px-4 py-3">{account.normalBalance}</td>
                        {canManage && (
                          <>
                            <td className="px-4 py-3">{account.active === false ? 'Nonaktif' : 'Aktif'}</td>
                            <td className="px-4 py-3"><div className="flex gap-2"><Button type="button" variant="outline" size="icon-lg" className="min-h-11 min-w-11" aria-label={`Ubah ${account.name}`} onClick={() => openForm(account)}><Pencil aria-hidden="true" /></Button><Button type="button" variant="dangerOutline" size="icon-lg" className="min-h-11 min-w-11" aria-label={`Hapus ${account.name}`} onClick={() => setDeleting(account)}><Trash2 aria-hidden="true" /></Button></div></td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground" aria-live="polite">
                Halaman {page} dari {totalPages} · {filteredAccounts.length} akun
              </p>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="action" disabled={page <= 1 || loading} onClick={() => setPage((current) => Math.max(1, current - 1))}>Sebelumnya</Button>
                <Button type="button" variant="outline" size="action" disabled={page >= totalPages || loading} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Berikutnya</Button>
              </div>
            </div>
          </Panel>
          <Dialog open={formOpen} onOpenChange={setFormOpen} label={editing ? 'Ubah akun' : 'Tambah akun'} size="md">
            <form onSubmit={(event) => void saveAccount(event)}>
              <DialogHeader title={editing ? 'Ubah akun' : 'Tambah akun'} description="Perubahan akan dikirim ke layanan akuntansi." onClose={() => setFormOpen(false)} />
              <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
                <label className="flex flex-col gap-2 text-sm font-semibold text-heading">Kode<input value={form.kode} onChange={(event) => setForm({ ...form, kode: event.target.value })} required className="min-h-12 rounded-xl border border-border bg-white px-3" /></label>
                <label className="flex flex-col gap-2 text-sm font-semibold text-heading">Nama akun<input value={form.nama} onChange={(event) => setForm({ ...form, nama: event.target.value })} required className="min-h-12 rounded-xl border border-border bg-white px-3" /></label>
                <label className="flex flex-col gap-2 text-sm font-semibold text-heading">Kategori<select value={form.kategori} onChange={(event) => setForm({ ...form, kategori: event.target.value as AccountForm['kategori'] })} className="min-h-12 rounded-xl border border-border bg-white px-3"><option value="aset">Aset</option><option value="kewajiban">Kewajiban</option><option value="ekuitas">Ekuitas</option><option value="pendapatan">Pendapatan</option><option value="beban">Beban</option></select></label>
                <label className="flex flex-col gap-2 text-sm font-semibold text-heading">Saldo normal<select value={form.saldo_normal} onChange={(event) => setForm({ ...form, saldo_normal: event.target.value as AccountForm['saldo_normal'] })} className="min-h-12 rounded-xl border border-border bg-white px-3"><option value="debit">Debit</option><option value="kredit">Kredit</option></select></label>
                <label className="flex min-h-11 items-center gap-3 text-sm font-semibold text-heading sm:col-span-2"><input type="checkbox" checked={form.aktif} onChange={(event) => setForm({ ...form, aktif: event.target.checked })} className="size-5 accent-primary" />Akun aktif</label>
              </div>
              <DialogFooter><Button type="button" variant="outline" size="action" onClick={() => setFormOpen(false)}>Batal</Button><Button type="submit" variant="primary" size="action" disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan akun'}</Button></DialogFooter>
            </form>
          </Dialog>
          <Dialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)} label="Konfirmasi hapus akun">
            <DialogHeader title="Hapus akun?" description={`Akun ${deleting?.name ?? ''} akan dihapus.`} onClose={() => setDeleting(null)} />
            <DialogFooter><Button type="button" variant="outline" size="action" onClick={() => setDeleting(null)}>Batal</Button><Button type="button" variant="destructive" size="action" disabled={busy} onClick={() => void removeAccount()}>{busy ? 'Menghapus…' : 'Hapus akun'}</Button></DialogFooter>
          </Dialog>
        </div>
      )}
    </AccountingAccess>
  )
}
