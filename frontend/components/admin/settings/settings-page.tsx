'use client'

import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import { Building2, Clock3, MapPin, Plus, Shield, Trash2, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { Panel } from '@/components/hadirpay/panel'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { DemoDataNotice } from '@/components/ui/demo-data-notice'
import { EmptyState, ErrorState } from '@/components/ui/empty-state'
import { PageLoadingSkeleton } from '@/components/ui/page-loading-skeleton'
import { workingDayOptions, type DemoSettings } from '@/lib/mock/settings'
import { getDemoSettings, saveDemoSettings } from '@/lib/services/settings-service'

const tabs = [
  { id: 'company', label: 'Perusahaan', icon: Building2 },
  { id: 'schedule', label: 'Jadwal & Jam Kerja', icon: Clock3 },
  { id: 'payroll', label: 'Kebijakan Penggajian', icon: Wallet },
  { id: 'users', label: 'Pengguna & Hak Akses', icon: Shield },
  { id: 'location', label: 'Lokasi Absensi', icon: MapPin },
] as const

type SettingsTab = (typeof tabs)[number]['id']

const roleLabels = {
  admin: 'Admin/HRD',
  karyawan: 'Karyawan',
  keuangan: 'Keuangan',
  pemilik: 'Pemilik',
} as const

const fieldClass = 'min-h-12 w-full rounded-xl border border-border bg-white px-4 text-sm text-heading focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none'

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="flex min-w-0 flex-col gap-2 text-sm font-semibold text-heading">
      {label}
      {children}
    </label>
  )
}

function formatBytes(bytes: number) {
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

export function SettingsPage() {
  const [settings, setSettings] = useState<DemoSettings | null>(null)
  const [tab, setTab] = useState<SettingsTab>('company')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [holidayDate, setHolidayDate] = useState('')
  const [holidayName, setHolidayName] = useState('')
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])

  async function loadSettings() {
    setLoading(true)
    setError('')
    try {
      setSettings(await getDemoSettings())
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Pengaturan gagal dimuat.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadSettings()
  }, [])

  function updateCompany<K extends keyof DemoSettings['company']>(
    key: K,
    value: DemoSettings['company'][K],
  ) {
    setSettings((current) => current
      ? { ...current, company: { ...current.company, [key]: value } }
      : current)
  }

  function updateSchedule<K extends keyof DemoSettings['workSchedule']>(
    key: K,
    value: DemoSettings['workSchedule'][K],
  ) {
    setSettings((current) => current
      ? { ...current, workSchedule: { ...current.workSchedule, [key]: value } }
      : current)
  }

  function updatePayroll<K extends keyof DemoSettings['payrollPolicy']>(
    key: K,
    value: DemoSettings['payrollPolicy'][K],
  ) {
    setSettings((current) => current
      ? { ...current, payrollPolicy: { ...current.payrollPolicy, [key]: value } }
      : current)
  }

  function updateLocation<K extends keyof DemoSettings['attendanceLocation']>(
    key: K,
    value: DemoSettings['attendanceLocation'][K],
  ) {
    setSettings((current) => current
      ? { ...current, attendanceLocation: { ...current.attendanceLocation, [key]: value } }
      : current)
  }

  function updateUserRole(userId: string, role: DemoSettings['users'][number]['role']) {
    setSettings((current) => current
      ? {
          ...current,
          users: current.users.map((user) => user.id === userId ? { ...user, role } : user),
        }
      : current)
  }

  function handleLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Pilih berkas gambar untuk logo.')
      event.target.value = ''
      return
    }
    if (file.size > 512 * 1024) {
      toast.error(`Ukuran logo maksimal 512 KB. Berkas ini ${formatBytes(file.size)}.`)
      event.target.value = ''
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        toast.error('Logo tidak dapat dibaca.')
        return
      }
      updateCompany('logoDataUrl', reader.result)
    }
    reader.onerror = () => toast.error('Logo tidak dapat dibaca.')
    reader.readAsDataURL(file)
  }

  function addHoliday() {
    if (!holidayDate || !holidayName.trim()) {
      toast.error('Isi tanggal dan nama hari libur.')
      return
    }
    if (settings?.workSchedule.holidays.some((holiday) => holiday.date === holidayDate)) {
      toast.error('Tanggal tersebut sudah ada di daftar hari libur.')
      return
    }
    updateSchedule('holidays', [
      ...(settings?.workSchedule.holidays ?? []),
      { date: holidayDate, name: holidayName.trim() },
    ])
    setHolidayDate('')
    setHolidayName('')
  }

  function removeHoliday(date: string) {
    if (!window.confirm('Hapus hari libur ini dari perubahan pengaturan?')) return
    updateSchedule(
      'holidays',
      (settings?.workSchedule.holidays ?? []).filter((holiday) => holiday.date !== date),
    )
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!settings) return
    setSaving(true)
    try {
      const saved = await saveDemoSettings(settings)
      setSettings(saved)
      toast.success('Pengaturan demo berhasil disimpan di browser ini.')
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Pengaturan gagal disimpan.'
      toast.error(message)
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const currentIndex = tabs.findIndex((item) => item.id === tab)
    const direction = event.key === 'ArrowRight' ? 1 : -1
    const nextIndex = (currentIndex + direction + tabs.length) % tabs.length
    setTab(tabs[nextIndex].id)
    tabRefs.current[nextIndex]?.focus()
  }

  if (loading) return <PageLoadingSkeleton label="pengaturan" />
  if (error && !settings) return <ErrorState message={error} onRetry={() => void loadSettings()} />
  if (!settings) {
    return (
      <EmptyState
        title="Pengaturan belum tersedia"
        description="Data pengaturan demo belum dapat ditampilkan. Muat ulang untuk mencoba kembali."
        icon={Building2}
        action={<Button type="button" variant="outline" size="action" onClick={() => void loadSettings()}>Muat ulang</Button>}
      />
    )
  }

  return (
    <form onSubmit={handleSave} className="flex min-w-0 flex-col gap-6">
      <DemoDataNotice>
        Pengaturan ini hanya tersimpan di browser untuk mode demo. Data backend belum terhubung.
      </DemoDataNotice>

      <div
        className="flex min-w-0 gap-2 overflow-x-auto border-b border-border"
        role="tablist"
        aria-label="Pengaturan perusahaan"
        onKeyDown={handleTabKeyDown}
      >
        {tabs.map((item, index) => {
          const Icon = item.icon
          const selected = tab === item.id
          return (
            <button
              key={item.id}
              ref={(element) => { tabRefs.current[index] = element }}
              type="button"
              id={`settings-tab-${item.id}`}
              role="tab"
              aria-selected={selected}
              aria-controls={`settings-panel-${item.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setTab(item.id)}
              className={`flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                selected ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-heading'
              }`}
            >
              <Icon className="size-4" aria-hidden="true" />
              {item.label}
            </button>
          )
        })}
      </div>

      {error && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p>}

      <Panel
        title={tabs.find((item) => item.id === tab)?.label ?? 'Pengaturan'}
        description="Perubahan disimpan sebagai konfigurasi demo pada perangkat ini."
      >
        <div
          id={`settings-panel-${tab}`}
          role="tabpanel"
          aria-labelledby={`settings-tab-${tab}`}
          tabIndex={0}
          className="flex min-w-0 flex-col gap-6 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {tab === 'company' && (
            <div className="grid min-w-0 gap-5 md:grid-cols-2">
              <Field label="Nama perusahaan">
                <input className={fieldClass} value={settings.company.name} maxLength={100} required onChange={(event) => updateCompany('name', event.target.value)} />
              </Field>
              <Field label="Alamat perusahaan">
                <input className={fieldClass} value={settings.company.address} maxLength={200} required onChange={(event) => updateCompany('address', event.target.value)} />
              </Field>
              <div className="flex min-w-0 flex-col gap-2 text-sm font-semibold text-heading">
                <label htmlFor="company-logo">Logo perusahaan</label>
                <input
                  id="company-logo"
                  type="file"
                  accept="image/*"
                  onChange={handleLogo}
                  className="min-h-12 w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-2 file:font-semibold file:text-heading focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  aria-describedby="logo-help"
                />
                <span id="logo-help" className="text-xs font-normal text-muted-foreground">Gambar maksimal 512 KB. Disimpan di browser demo.</span>
                {settings.company.logoDataUrl ? (
                  <div className="flex items-center gap-3">
                    <img src={settings.company.logoDataUrl} alt="Pratinjau logo perusahaan" className="size-12 rounded-lg border border-border object-contain p-1" />
                    <Button type="button" variant="outline" size="action" onClick={() => updateCompany('logoDataUrl', undefined)}>Hapus logo</Button>
                  </div>
                ) : (
                  <div className="flex min-h-14 items-center gap-3 rounded-xl border border-border bg-surface px-3">
                    <Avatar initials={settings.company.name.slice(0, 2).toUpperCase()} tone="navy" />
                    <span className="font-bold text-heading">{settings.company.name}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'schedule' && (
            <div className="flex flex-col gap-6">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Jam masuk">
                  <input type="time" className={fieldClass} value={settings.workSchedule.startTime} required onChange={(event) => updateSchedule('startTime', event.target.value)} />
                </Field>
                <Field label="Jam pulang">
                  <input type="time" className={fieldClass} value={settings.workSchedule.endTime} required onChange={(event) => updateSchedule('endTime', event.target.value)} />
                </Field>
                <Field label="Toleransi terlambat (menit)">
                  <input type="number" min={0} max={180} className={fieldClass} value={settings.workSchedule.lateToleranceMinutes} required onChange={(event) => updateSchedule('lateToleranceMinutes', Number(event.target.value))} />
                </Field>
              </div>
              <fieldset className="flex flex-col gap-3">
                <legend className="text-sm font-semibold text-heading">Hari kerja</legend>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {workingDayOptions.map((day) => (
                    <label key={day.value} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-border bg-white px-3 text-sm text-heading">
                      <input
                        type="checkbox"
                        checked={settings.workSchedule.workDays.includes(day.value)}
                        onChange={(event) => updateSchedule(
                          'workDays',
                          event.target.checked
                            ? [...settings.workSchedule.workDays, day.value]
                            : settings.workSchedule.workDays.filter((value) => value !== day.value),
                        )}
                        className="size-4 accent-primary"
                      />
                      {day.label}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="flex flex-col gap-3">
                <h3 className="font-semibold text-heading">Hari libur perusahaan</h3>
                {settings.workSchedule.holidays.length ? (
                  <ul className="divide-y divide-border rounded-xl border border-border">
                    {settings.workSchedule.holidays.map((holiday) => (
                      <li key={holiday.date} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                        <span className="text-foreground">{holiday.date} · {holiday.name}</span>
                        <Button type="button" variant="dangerOutline" size="action" onClick={() => removeHoliday(holiday.date)}>
                          <Trash2 className="size-4" aria-hidden="true" />
                          Hapus
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="rounded-xl bg-surface px-4 py-3 text-sm text-muted-foreground">Belum ada hari libur khusus. Jadwal akhir pekan mengikuti hari kerja yang dipilih.</p>
                )}
                <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                  <Field label="Tanggal">
                    <input type="date" className={fieldClass} value={holidayDate} onChange={(event) => setHolidayDate(event.target.value)} />
                  </Field>
                  <Field label="Nama hari libur">
                    <input className={fieldClass} value={holidayName} maxLength={80} onChange={(event) => setHolidayName(event.target.value)} />
                  </Field>
                  <div className="flex items-end">
                    <Button type="button" variant="outline" size="action" onClick={addHoliday}>
                      <Plus className="size-4" aria-hidden="true" />
                      Tambah
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'payroll' && (
            <div className="grid gap-5 md:grid-cols-2">
              <Field label="Metode potongan alpha">
                <select
                  className={fieldClass}
                  value={settings.payrollPolicy.absenceDeductionMethod}
                  onChange={(event) => updatePayroll('absenceDeductionMethod', event.target.value as DemoSettings['payrollPolicy']['absenceDeductionMethod'])}
                >
                  <option value="per_day">Per hari kerja</option>
                  <option value="fixed">Nominal tetap</option>
                </select>
              </Field>
              <Field label="Nominal potongan alpha (rupiah)">
                <input type="number" min={0} className={fieldClass} value={settings.payrollPolicy.absenceDeductionAmount} onChange={(event) => updatePayroll('absenceDeductionAmount', Number(event.target.value))} />
              </Field>
              <Field label="Tarif lembur per jam (rupiah)">
                <input type="number" min={0} className={fieldClass} value={settings.payrollPolicy.overtimeRatePerHour} onChange={(event) => updatePayroll('overtimeRatePerHour', Number(event.target.value))} />
              </Field>
              <Field label="Tanggal tutup periode">
                <input type="number" min={1} max={28} className={fieldClass} value={settings.payrollPolicy.cutoffDay} onChange={(event) => updatePayroll('cutoffDay', Number(event.target.value))} />
              </Field>
              <p className="text-sm text-muted-foreground md:col-span-2">Perubahan kebijakan tersimpan untuk demo. Snapshot penggajian November 2026 tidak dihitung ulang.</p>
            </div>
          )}

          {tab === 'users' && (
            settings.users.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-left text-sm">
                  <caption className="sr-only">Pengguna demo dan hak aksesnya</caption>
                  <thead className="border-b border-border text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-3 py-3">Pengguna</th>
                      <th scope="col" className="px-3 py-3">Email</th>
                      <th scope="col" className="px-3 py-3">Hak akses</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {settings.users.map((user) => (
                      <tr key={user.id}>
                        <th scope="row" className="px-3 py-3 font-medium text-heading">{user.name}</th>
                        <td className="px-3 py-3 text-foreground">{user.email}</td>
                        <td className="px-3 py-3">
                          <label className="sr-only" htmlFor={`role-${user.id}`}>Hak akses {user.name}</label>
                          <select
                            id={`role-${user.id}`}
                            className={`${fieldClass} min-h-11 max-w-56`}
                            value={user.role}
                            onChange={(event) => updateUserRole(user.id, event.target.value as DemoSettings['users'][number]['role'])}
                          >
                            {Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-4 text-sm text-muted-foreground">Role yang dipilih saat masuk mode demo menentukan navigasi dan hak akses pada sesi tersebut.</p>
              </div>
            ) : (
              <EmptyState title="Belum ada pengguna" description="Pengguna demo akan muncul setelah data tersedia." icon={Shield} />
            )
          )}

          {tab === 'location' && (
            <div className="flex flex-col gap-5">
              <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-border bg-white px-4 text-sm font-semibold text-heading">
                <input type="checkbox" checked={settings.attendanceLocation.enabled} onChange={(event) => updateLocation('enabled', event.target.checked)} className="size-4 accent-primary" />
                Aktifkan pemeriksaan lokasi saat absensi
              </label>
              <div className="grid gap-5 md:grid-cols-2">
                <Field label="Nama lokasi">
                  <input className={fieldClass} value={settings.attendanceLocation.name} maxLength={100} required onChange={(event) => updateLocation('name', event.target.value)} />
                </Field>
                <Field label="Alamat lokasi">
                  <input className={fieldClass} value={settings.attendanceLocation.address} maxLength={200} required onChange={(event) => updateLocation('address', event.target.value)} />
                </Field>
                <Field label="Radius absensi (meter)">
                  <input type="number" min={50} max={10000} className={fieldClass} value={settings.attendanceLocation.radiusMeters} required onChange={(event) => updateLocation('radiusMeters', Number(event.target.value))} />
                </Field>
              </div>
              <p className="text-sm text-muted-foreground">Pemeriksaan lokasi masih berupa konfigurasi demo dan belum meminta akses GPS perangkat.</p>
            </div>
          )}
        </div>
      </Panel>

      <div className="flex justify-end">
        <Button type="submit" variant="primary" size="action" disabled={saving}>
          {saving ? 'Menyimpan…' : 'Simpan pengaturan'}
        </Button>
      </div>
    </form>
  )
}
