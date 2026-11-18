'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowDownWideNarrow, ArrowUpWideNarrow, NotebookPen, Plus, ReceiptText } from 'lucide-react'
import { toast } from 'sonner'
import { Panel } from '@/components/hadirpay/panel'
import { StatCard } from '@/components/hadirpay/stat-card'
import { StatusBadge } from '@/components/hadirpay/status-badge'
import { Button } from '@/components/ui/button'
import { DemoDataNotice } from '@/components/ui/demo-data-notice'
import { Dialog, DialogFooter, DialogHeader } from '@/components/ui/dialog'
import { EmptyState, ErrorState } from '@/components/ui/empty-state'
import { PageLoadingSkeleton } from '@/components/ui/page-loading-skeleton'
import { AccountingAccess, AccountingPageTitle } from './accounting-shared'
import { useAccountingRole } from '@/lib/hooks/use-accounting-role'
import { formatAccountingDate } from '@/lib/accounting/journal'
import { formatRupiah } from '@/lib/mock-data'
import type { AccountingAccount, JournalEntry } from '@/lib/mock/accounting'
import { listAccounts, listJournalEntries, saveManualJournal } from '@/lib/services/accounting-service'

function localDate() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function FormAccountSelect({
  label,
  value,
  accounts,
  onChange,
}: {
  label: string
  value: string
  accounts: AccountingAccount[]
  onChange: (value: string) => void
}) {
  return (
    <label className="flex flex-col gap-2 text-sm font-semibold text-heading">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
        className="min-h-12 w-full rounded-xl border border-border bg-white px-4 text-base focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
      >
        {accounts.map((account) => (
          <option key={account.code} value={account.code}>{account.code} · {account.name}</option>
        ))}
      </select>
    </label>
  )
}

export function JournalPage() {
  const role = useAccountingRole()
  const [accounts, setAccounts] = useState<AccountingAccount[]>([])
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [date, setDate] = useState(localDate)
  const [description, setDescription] = useState('')
  const [debitAccountCode, setDebitAccountCode] = useState('')
  const [creditAccountCode, setCreditAccountCode] = useState('')
  const [amount, setAmount] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [nextAccounts, nextEntries] = await Promise.all([listAccounts(), listJournalEntries()])
      setAccounts(nextAccounts)
      setEntries(nextEntries)
      setDebitAccountCode((current) => current || nextAccounts[0]?.code || '')
      setCreditAccountCode((current) => current || nextAccounts[1]?.code || '')
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Jurnal umum gagal dimuat.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (role === 'admin' || role === 'keuangan' || role === 'pemilik') void load()
    else if (role === 'karyawan' || role === null) setLoading(false)
  }, [role])

  const totals = useMemo(() => entries.reduce((result, entry) => {
    for (const line of entry.lines) {
      result.debit += line.debit
      result.credit += line.credit
    }
    return result
  }, { debit: 0, credit: 0 }), [entries])

  function resetForm() {
    setDate(localDate())
    setDescription('')
    setAmount('')
    setFormError('')
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setFormError('')
    try {
      const saved = await saveManualJournal({
        date,
        description,
        debitAccountCode,
        creditAccountCode,
        amount: Number(amount),
      })
      setEntries(await listJournalEntries())
      setDialogOpen(false)
      resetForm()
      toast.success('Jurnal manual berhasil disimpan.')
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Jurnal manual gagal disimpan.'
      setFormError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <AccountingAccess role={role}>
      {loading ? <PageLoadingSkeleton label="jurnal umum" /> : error ? <ErrorState message={error} onRetry={() => void load()} /> : (
        <div className="flex flex-col gap-6">
          <DemoDataNotice>
            Data jurnal bersifat demo. Rincian pajak dan BPJS tersedia untuk 9 karyawan; 39 karyawan lain tetap berupa agregat gaji bersih.
          </DemoDataNotice>
          <AccountingPageTitle
            title="Jurnal umum"
            description="Catat jurnal manual atau telusuri jurnal otomatis dari proses penggajian."
            action={(
              <Button type="button" variant="primary" size="action" onClick={() => setDialogOpen(true)}>
                <Plus aria-hidden="true" />
                Buat jurnal manual
              </Button>
            )}
          />

          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Jumlah jurnal" value={String(entries.length)} hint="Otomatis dan manual" icon={NotebookPen} tone="blue" />
            <StatCard label="Total debit" value={formatRupiah(totals.debit)} icon={ArrowDownWideNarrow} tone="green" />
            <StatCard label="Total kredit" value={formatRupiah(totals.credit)} icon={ArrowUpWideNarrow} tone="amber" />
          </div>

          <Panel title="Daftar jurnal" description="Setiap baris mencatat akun dan sisi debit atau kredit.">
            {entries.length === 0 ? (
              <EmptyState
                title="Belum ada jurnal"
                description="Jurnal payroll otomatis muncul setelah penggajian disetujui. Anda juga dapat membuat jurnal manual."
                icon={ReceiptText}
                action={<Button type="button" variant="primary" size="action" onClick={() => setDialogOpen(true)}>Buat jurnal manual</Button>}
              />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full min-w-[980px] border-collapse text-left text-sm">
                  <caption className="sr-only">Rincian jurnal umum dan akun-akun yang terposting</caption>
                  <thead className="bg-surface text-xs font-semibold uppercase text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-3 py-3">Tanggal</th>
                      <th scope="col" className="px-3 py-3">No. bukti</th>
                      <th scope="col" className="px-3 py-3">Jenis</th>
                      <th scope="col" className="px-3 py-3">Akun</th>
                      <th scope="col" className="px-3 py-3 text-right">Debit</th>
                      <th scope="col" className="px-3 py-3 text-right">Kredit</th>
                      <th scope="col" className="px-3 py-3">Keterangan</th>
                      <th scope="col" className="px-3 py-3">Sumber</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {entries.flatMap((entry) => entry.lines.map((line, index) => (
                      <tr key={`${entry.id}-${line.accountCode}`} className="hover:bg-surface/70">
                        <td className="whitespace-nowrap px-3 py-3">{index === 0 ? formatAccountingDate(entry.date) : ''}</td>
                        <td className="whitespace-nowrap px-3 py-3 font-semibold tabular-nums text-heading">{index === 0 ? entry.voucherNumber : ''}</td>
                        <td className="px-3 py-3">{index === 0 && <StatusBadge status={entry.type} />}</td>
                        <td className="px-3 py-3"><span className="font-medium text-heading">{line.accountCode}</span><span className="ml-2">{line.accountName}</span></td>
                        <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">{line.debit ? formatRupiah(line.debit) : '-'}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">{line.credit ? formatRupiah(line.credit) : '-'}</td>
                        <td className="px-3 py-3">{index === 0 ? entry.description : ''}</td>
                        <td className="px-3 py-3">
                          {index === 0 && entry.sourcePeriodId && entry.sourcePeriodLabel ? (
                            <Link href="/app/penggajian" className="font-semibold text-primary underline-offset-4 hover:underline">
                              Penggajian {entry.sourcePeriodLabel}
                            </Link>
                          ) : index === 0 ? 'Jurnal manual' : ''}
                        </td>
                      </tr>
                    )))}
                  </tbody>
                  <tfoot className="bg-surface font-bold text-heading">
                    <tr>
                      <th scope="row" colSpan={4} className="px-3 py-3 text-right">Jumlah</th>
                      <td className="px-3 py-3 text-right tabular-nums">{formatRupiah(totals.debit)}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{formatRupiah(totals.credit)}</td>
                      <td colSpan={2} className="px-3 py-3">
                        {totals.debit === totals.credit ? <StatusBadge status="Seimbang" /> : <span className="text-destructive">Tidak seimbang</span>}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
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
                  <input type="date" value={date} onChange={(event) => setDate(event.target.value)} required className="min-h-12 rounded-xl border border-border bg-white px-4 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none" />
                </label>
                <label className="flex flex-col gap-2 text-sm font-semibold text-heading">
                  Keterangan
                  <input value={description} onChange={(event) => setDescription(event.target.value)} required maxLength={120} className="min-h-12 rounded-xl border border-border bg-white px-4 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none" />
                </label>
                <FormAccountSelect label="Akun debit" value={debitAccountCode} accounts={accounts} onChange={setDebitAccountCode} />
                <FormAccountSelect label="Akun kredit" value={creditAccountCode} accounts={accounts} onChange={setCreditAccountCode} />
                <label className="flex flex-col gap-2 text-sm font-semibold text-heading">
                  Nominal (Rp)
                  <input type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required className="min-h-12 rounded-xl border border-border bg-white px-4 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none" />
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
        </div>
      )}
    </AccountingAccess>
  )
}
