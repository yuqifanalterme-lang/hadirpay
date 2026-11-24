'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { NotebookPen, Plus, ReceiptText, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Panel } from '@/components/hadirpay/panel'
import { StatCard } from '@/components/hadirpay/stat-card'
import { StatusBadge } from '@/components/hadirpay/status-badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogFooter, DialogHeader } from '@/components/ui/dialog'
import { EmptyState, ErrorState } from '@/components/ui/empty-state'
import { PageLoadingSkeleton } from '@/components/ui/page-loading-skeleton'
import { AccountingAccess, AccountingPageTitle } from './accounting-shared'
import { useAccountingRole } from '@/lib/hooks/use-accounting-role'
import { formatAccountingDate } from '@/lib/accounting/journal'
import { formatRupiah } from '@/lib/mock-data'
import type { AccountingAccount, JournalEntry } from '@/lib/mock/accounting'
import { cancelManualJournal, listAccounts, listJournalEntriesPage, saveManualJournal } from '@/lib/services/akuntansi.service'
import { accountingDataChangedEvent, notifyAccountingDataChanged } from '@/lib/services/accounting-events'
import { ApiError, type ApiErrorFields } from '@/lib/api/client'

function FormAccountSelect({
  label,
  value,
  accounts,
  onChange,
  error,
}: {
  label: string
  value: string
  accounts: AccountingAccount[]
  onChange: (value: string) => void
  error?: string
}) {
  const errorId = `${label.toLowerCase().replaceAll(' ', '-')}-error`
  return (
    <label className="flex flex-col gap-2 text-sm font-semibold text-heading">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        required
        className="min-h-12 w-full rounded-xl border border-border bg-white px-4 text-base focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
      >
        {accounts.map((account) => (
          <option key={account.code} value={account.code}>{account.code} · {account.name}</option>
        ))}
      </select>
      {error && <span id={errorId} className="text-sm font-medium text-destructive" role="alert">{error}</span>}
    </label>
  )
}

export function JournalPage() {
  const role = useAccountingRole()
  const [accounts, setAccounts] = useState<AccountingAccount[]>([])
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [source, setSource] = useState('')
  const [status, setStatus] = useState<'aktif' | 'dibatalkan'>('aktif')
  const [periodId, setPeriodId] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [meta, setMeta] = useState<{ total: number; total_pages: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<ApiErrorFields>({})
  const [cancelDialogEntry, setCancelDialogEntry] = useState<JournalEntry | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelFieldErrors, setCancelFieldErrors] = useState<ApiErrorFields>({})
  const [cancelError, setCancelError] = useState('')
  const [date, setDate] = useState('')
  const [description, setDescription] = useState('')
  const [debitAccountCode, setDebitAccountCode] = useState('')
  const [creditAccountCode, setCreditAccountCode] = useState('')
  const [amount, setAmount] = useState('')
  const canManage = role === 'keuangan'
  const amountError = [
    'detail.0.debit',
    'detail.0.kredit',
    'detail.1.debit',
    'detail.1.kredit',
    'total_debit',
    'total_kredit',
    'nominal',
  ].flatMap((field) => fieldErrors[field] ?? []).filter((message) => message.trim()).join(' ')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const periodGajiId = /^\d+$/.test(periodId) && Number(periodId) > 0 ? Number(periodId) : undefined
      const [nextAccounts, journalPage] = await Promise.all([
        listAccounts(),
        listJournalEntriesPage({
          search: debouncedSearch.trim() || undefined,
          tanggal_dari: dateFrom || undefined,
          tanggal_sampai: dateTo || undefined,
          sumber: source === 'otomatis' || source === 'manual' ? source : undefined,
          status,
          periode_gaji_id: periodGajiId,
          page,
          per_page: pageSize,
        }),
      ])
      const totalPages = Math.max(1, journalPage.meta.total_pages)
      if (page > totalPages) {
        setPage(totalPages)
        return
      }
      setAccounts(nextAccounts)
      setEntries(journalPage.items)
      setMeta({ total: journalPage.meta.total, total_pages: totalPages })
      setDebitAccountCode((current) => current || nextAccounts[0]?.code || '')
      setCreditAccountCode((current) => current || nextAccounts[1]?.code || '')
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Jurnal umum gagal dimuat.')
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
  }, [role, debouncedSearch, dateFrom, dateTo, source, status, periodId, page, pageSize])

  useEffect(() => {
    if (role !== 'admin' && role !== 'keuangan' && role !== 'pemilik') return
    const refresh = () => { void load() }
    window.addEventListener(accountingDataChangedEvent, refresh)
    return () => window.removeEventListener(accountingDataChangedEvent, refresh)
  }, [role, debouncedSearch, dateFrom, dateTo, source, status, periodId, page, pageSize])

  function resetForm() {
    setDate('')
    setDescription('')
    setAmount('')
    setFormError('')
    setFieldErrors({})
  }

  function clearFieldError(field: string) {
    setFieldErrors((current) => ({ ...current, [field]: [] }))
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setFormError('')
    setFieldErrors({})
    try {
      await saveManualJournal({
        date,
        description,
        debitAccountCode,
        creditAccountCode,
        amount: Number(amount),
      })
      await load()
      setDialogOpen(false)
      resetForm()
      toast.success('Jurnal manual berhasil disimpan.')
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Jurnal manual gagal disimpan.'
      setFormError(message)
      if (saveError instanceof ApiError && saveError.errors) setFieldErrors(saveError.errors)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  async function handleCancelJournal(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!cancelDialogEntry) return
    const reason = cancelReason.trim()
    if (!reason) {
      setCancelFieldErrors({ alasan: ['Alasan wajib diisi.'] })
      return
    }

    setSaving(true)
    setCancelError('')
    setCancelFieldErrors({})
    try {
      await cancelManualJournal(cancelDialogEntry.id, { alasan: reason })
      setCancelDialogEntry(null)
      setCancelReason('')
      notifyAccountingDataChanged()
      toast.success('Jurnal berhasil dibatalkan.')
    } catch (cancelActionError) {
      const message = cancelActionError instanceof Error ? cancelActionError.message : 'Jurnal gagal dibatalkan.'
      setCancelError(message)
      if (cancelActionError instanceof ApiError && cancelActionError.errors) {
        setCancelFieldErrors(cancelActionError.errors)
      }
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  function closeCancelJournal() {
    if (saving) return
    setCancelDialogEntry(null)
    setCancelReason('')
    setCancelFieldErrors({})
    setCancelError('')
  }

  function formatCancellationDate(value: string) {
    const dateValue = new Date(value)
    if (Number.isNaN(dateValue.getTime())) return value
    return new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Jakarta',
    }).format(dateValue)
  }

  return (
    <AccountingAccess role={role}>
      {loading ? <PageLoadingSkeleton label="jurnal umum" /> : error ? <ErrorState message={error} onRetry={() => void load()} /> : (
        <div className="flex flex-col gap-6">
          <AccountingPageTitle
            title="Jurnal umum"
            description="Catat jurnal manual atau telusuri jurnal otomatis dari proses penggajian."
            action={canManage ? (
              <Button type="button" variant="primary" size="action" onClick={() => setDialogOpen(true)}>
                <Plus aria-hidden="true" />
                Buat jurnal manual
              </Button>
            ) : undefined}
          />

          <div className="grid gap-4">
            <StatCard label="Jumlah jurnal" value={String(meta?.total ?? entries.length)} hint="Otomatis dan manual" icon={NotebookPen} tone="blue" />
          </div>

          <Panel title="Daftar jurnal" description="Setiap baris mencatat akun dan sisi debit atau kredit.">
            <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <label className="flex flex-col gap-2 text-sm font-semibold text-heading sm:col-span-2">
                Cari jurnal
                <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} className="min-h-12 rounded-xl border border-border bg-white px-4 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none" />
              </label>
              <label className="flex flex-col gap-2 text-sm font-semibold text-heading">
                Sumber
                <select value={source} onChange={(event) => { setSource(event.target.value); setPage(1) }} className="min-h-12 rounded-xl border border-border bg-white px-4">
                  <option value="">Semua sumber</option>
                  <option value="otomatis">Otomatis</option>
                  <option value="manual">Manual</option>
                </select>
              </label>
              <label className="flex flex-col gap-2 text-sm font-semibold text-heading">
                Status
                <select value={status} onChange={(event) => { setStatus(event.target.value as 'aktif' | 'dibatalkan'); setPage(1) }} className="min-h-12 rounded-xl border border-border bg-white px-4">
                  <option value="aktif">Aktif</option>
                  <option value="dibatalkan">Dibatalkan</option>
                </select>
              </label>
              <label className="flex flex-col gap-2 text-sm font-semibold text-heading">
                ID periode gaji
                <input type="number" min="1" step="1" value={periodId} onChange={(event) => { setPeriodId(event.target.value); setPage(1) }} className="min-h-12 rounded-xl border border-border bg-white px-4" />
              </label>
              <label className="flex flex-col gap-2 text-sm font-semibold text-heading">
                Tanggal dari
                <input type="date" value={dateFrom} onChange={(event) => { setDateFrom(event.target.value); setPage(1) }} className="min-h-12 rounded-xl border border-border bg-white px-4" />
              </label>
              <label className="flex flex-col gap-2 text-sm font-semibold text-heading">
                Tanggal sampai
                <input type="date" value={dateTo} onChange={(event) => { setDateTo(event.target.value); setPage(1) }} className="min-h-12 rounded-xl border border-border bg-white px-4" />
              </label>
              <label className="flex flex-col gap-2 text-sm font-semibold text-heading">
                Per halaman
                <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1) }} className="min-h-12 rounded-xl border border-border bg-white px-4">
                  {[10, 20, 50].map((size) => <option key={size} value={size}>{size}</option>)}
                </select>
              </label>
            </div>
            {entries.length === 0 ? (
              <EmptyState
                title="Belum ada jurnal"
                description="Jurnal payroll otomatis muncul setelah penggajian disetujui. Anda juga dapat membuat jurnal manual."
                icon={ReceiptText}
                action={canManage ? <Button type="button" variant="primary" size="action" onClick={() => setDialogOpen(true)}>Buat jurnal manual</Button> : undefined}
              />
            ) : (
              <div className="no-scrollbar overflow-x-auto rounded-xl border border-border">
                <table className="w-full min-w-[1360px] border-collapse text-left text-sm">
                  <caption className="sr-only">Rincian jurnal umum dan akun-akun yang terposting</caption>
                  <thead className="bg-surface text-xs font-semibold uppercase text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-3 py-3">Tanggal</th>
                      <th scope="col" className="px-3 py-3">No. bukti</th>
                      <th scope="col" className="px-3 py-3">Jenis</th>
                      <th scope="col" className="px-3 py-3">Akun</th>
                      <th scope="col" className="px-3 py-3 text-right">Debit</th>
                      <th scope="col" className="px-3 py-3 text-right">Kredit</th>
                      <th scope="col" className="px-3 py-3 text-right">Total debit</th>
                      <th scope="col" className="px-3 py-3 text-right">Total kredit</th>
                      <th scope="col" className="px-3 py-3">Keterangan</th>
                      <th scope="col" className="px-3 py-3">Sumber</th>
                      <th scope="col" className="px-3 py-3">Status</th>
                      <th scope="col" className="px-3 py-3">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {entries.flatMap((entry) => entry.lines.map((line, index) => (
                      <tr key={`${entry.id}-${line.accountCode}`} className={entry.status === 'dibatalkan' ? 'bg-surface/70 text-muted-foreground' : 'hover:bg-surface/70'}>
                        <td className="whitespace-nowrap px-3 py-3">{index === 0 ? formatAccountingDate(entry.date) : ''}</td>
                        <td className="whitespace-nowrap px-3 py-3 font-semibold tabular-nums text-heading">{index === 0 ? entry.voucherNumber : ''}</td>
                        <td className="px-3 py-3">{index === 0 && <StatusBadge status={entry.type} />}</td>
                        <td className="px-3 py-3"><span className="font-medium text-heading">{line.accountCode}</span><span className="ml-2">{line.accountName}</span></td>
                        <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">{line.debit ? formatRupiah(line.debit) : '-'}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">{line.credit ? formatRupiah(line.credit) : '-'}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">{index === 0 && entry.totalDebit !== undefined ? formatRupiah(entry.totalDebit) : index === 0 ? '-' : ''}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">{index === 0 && entry.totalCredit !== undefined ? formatRupiah(entry.totalCredit) : index === 0 ? '-' : ''}</td>
                        <td className="px-3 py-3">{index === 0 ? entry.description : ''}</td>
                        <td className="px-3 py-3">
                          {index === 0 && entry.sourcePeriodId && entry.sourcePeriodLabel ? (
                            <Link href="/app/penggajian" className="font-semibold text-primary underline-offset-4 hover:underline">
                              Penggajian {entry.sourcePeriodLabel}
                            </Link>
                          ) : index === 0 ? 'Jurnal manual' : ''}
                        </td>
                        <td className="px-3 py-3">
                          {index === 0 && <StatusBadge status={entry.status === 'dibatalkan' ? 'Dibatalkan' : 'Aktif'} />}
                          {index === 0 && entry.status === 'dibatalkan' && (
                            <div className="mt-2 max-w-64 space-y-1 text-xs">
                              <p>Alasan: {entry.alasan_pembatalan || '-'}</p>
                              <p>Oleh: {entry.dibatalkan_oleh?.nama || '-'}</p>
                              <p>Kapan: {entry.dibatalkan_pada ? formatCancellationDate(entry.dibatalkan_pada) : '-'}</p>
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          {index === 0 && canManage && entry.type === 'Manual' && entry.status === 'aktif' && (
                            <Button type="button" variant="outline" size="action" onClick={() => {
                              setCancelDialogEntry(entry)
                              setCancelFieldErrors({})
                              setCancelError('')
                            }}>
                              <Trash2 aria-hidden="true" />
                              Hapus
                            </Button>
                          )}
                        </td>
                      </tr>
                    )))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground" aria-live="polite">
                Halaman {page} dari {Math.max(1, meta?.total_pages ?? 1)} · {meta?.total ?? entries.length} jurnal
              </p>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="action" disabled={page <= 1 || loading} onClick={() => setPage((current) => Math.max(1, current - 1))}>Sebelumnya</Button>
                <Button type="button" variant="outline" size="action" disabled={page >= (meta?.total_pages ?? 1) || loading} onClick={() => setPage((current) => Math.min(meta?.total_pages ?? 1, current + 1))}>Berikutnya</Button>
              </div>
            </div>
          </Panel>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen} label="Buat jurnal manual">
            <form onSubmit={(event) => void handleSave(event)}>
              <DialogHeader
                title="Buat jurnal manual"
                description="Jurnal hanya tersimpan jika akun debit dan kredit seimbang."
                onClose={() => setDialogOpen(false)}
              />
              <div className="flex flex-col gap-4 p-5 sm:p-6">
                <label className="flex flex-col gap-2 text-sm font-semibold text-heading">
                  Tanggal
                  <input type="date" value={date} onChange={(event) => { setDate(event.target.value); clearFieldError('tanggal') }} aria-invalid={Boolean(fieldErrors.tanggal?.length)} aria-describedby={fieldErrors.tanggal?.length ? 'journal-date-error' : undefined} required className="min-h-12 rounded-xl border border-border bg-white px-4 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none" />
                  {fieldErrors.tanggal?.[0] && <span id="journal-date-error" className="text-sm font-medium text-destructive" role="alert">{fieldErrors.tanggal[0]}</span>}
                </label>
                <label className="flex flex-col gap-2 text-sm font-semibold text-heading">
                  Keterangan
                  <input value={description} onChange={(event) => { setDescription(event.target.value); clearFieldError('keterangan') }} aria-invalid={Boolean(fieldErrors.keterangan?.length)} aria-describedby={fieldErrors.keterangan?.length ? 'journal-description-error' : undefined} required maxLength={120} className="min-h-12 rounded-xl border border-border bg-white px-4 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none" />
                  {fieldErrors.keterangan?.[0] && <span id="journal-description-error" className="text-sm font-medium text-destructive" role="alert">{fieldErrors.keterangan[0]}</span>}
                </label>
                <FormAccountSelect label="Akun debit" value={debitAccountCode} accounts={accounts} onChange={(value) => { setDebitAccountCode(value); clearFieldError('detail.0.akun_id') }} error={fieldErrors['detail.0.akun_id']?.[0] ?? fieldErrors.detail?.[0]} />
                <FormAccountSelect label="Akun kredit" value={creditAccountCode} accounts={accounts} onChange={(value) => { setCreditAccountCode(value); clearFieldError('detail.1.akun_id') }} error={fieldErrors['detail.1.akun_id']?.[0]} />
                <label className="flex flex-col gap-2 text-sm font-semibold text-heading">
                  Nominal (Rp)
                  <input type="number" min="0.01" step="0.01" value={amount} onChange={(event) => { setAmount(event.target.value); clearFieldError('nominal'); clearFieldError('detail.0.debit'); clearFieldError('detail.0.kredit'); clearFieldError('detail.1.debit'); clearFieldError('detail.1.kredit'); clearFieldError('total_debit'); clearFieldError('total_kredit') }} aria-invalid={Boolean(amountError)} aria-describedby={amountError ? 'journal-amount-error' : undefined} required className="min-h-12 rounded-xl border border-border bg-white px-4 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none" />
                  {amountError && <span id="journal-amount-error" className="text-sm font-medium text-destructive" role="alert">{amountError}</span>}
                </label>
                {formError && <p className="text-sm font-medium text-destructive" role="alert">{formError}</p>}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" size="action" disabled={saving} onClick={() => setDialogOpen(false)}>Batal</Button>
                <Button type="submit" variant="primary" size="action" disabled={saving || !accounts.length}>
                  {saving ? 'Menyimpan…' : 'Simpan jurnal'}
                </Button>
              </DialogFooter>
            </form>
          </Dialog>

          <Dialog open={cancelDialogEntry !== null} onOpenChange={(open) => !open && closeCancelJournal()} label="Konfirmasi pembatalan jurnal">
            <form onSubmit={(event) => void handleCancelJournal(event)}>
              <DialogHeader
                title="Batalkan jurnal manual"
                description={cancelDialogEntry ? `Jurnal ${cancelDialogEntry.voucherNumber} akan dibatalkan.` : undefined}
                onClose={closeCancelJournal}
              />
              <div className="flex flex-col gap-4 p-5 sm:p-6">
                <label className="flex flex-col gap-2 text-sm font-semibold text-heading">
                  Alasan pembatalan
                  <textarea
                    value={cancelReason}
                    onChange={(event) => {
                      setCancelReason(event.target.value)
                      setCancelFieldErrors((current) => ({ ...current, alasan: [] }))
                    }}
                    aria-invalid={Boolean(cancelFieldErrors.alasan?.length)}
                    aria-describedby={cancelFieldErrors.alasan?.length ? 'journal-cancel-reason-error' : undefined}
                    required
                    className="min-h-24 rounded-xl border border-border bg-white px-4 py-3 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                  />
                  {cancelFieldErrors.alasan?.[0] && <span id="journal-cancel-reason-error" className="text-sm font-medium text-destructive" role="alert">{cancelFieldErrors.alasan[0]}</span>}
                </label>
                {cancelError && <p className="text-sm font-medium text-destructive" role="alert">{cancelError}</p>}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" size="action" disabled={saving} onClick={closeCancelJournal}>Batal</Button>
                <Button type="submit" variant="primary" size="action" disabled={saving}>
                  {saving ? 'Memproses…' : 'Konfirmasi pembatalan'}
                </Button>
              </DialogFooter>
            </form>
          </Dialog>
        </div>
      )}
    </AccountingAccess>
  )
}
