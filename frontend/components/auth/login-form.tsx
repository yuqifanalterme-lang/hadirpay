'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, ShieldCheck, UserRound, Wallet, Building2 } from 'lucide-react'
import { PasswordField, submitClass, TextField } from './fields'
import { ROLE_STORAGE_KEY, type Role } from '@/lib/navigation'
import { cn } from '@/lib/utils'
import { config } from '@/lib/config'
import { loginWithCredentials } from '@/lib/services/auth.service'
import { toast } from 'sonner'

const roles: { value: Role; label: string; hint: string; email: string; icon: typeof ShieldCheck }[] = [
  { value: 'admin', label: 'Admin/HRD', hint: 'Kelola absensi & gaji', email: 'rina.hrd@hadirpay.id', icon: ShieldCheck },
  { value: 'karyawan', label: 'Karyawan', hint: 'Absen & lihat slip gaji', email: 'andi.wijaya@hadirpay.id', icon: UserRound },
  { value: 'keuangan', label: 'Keuangan', hint: 'Validasi & bayar gaji', email: 'andi.wijaya@hadirpay.id', icon: Wallet },
  { value: 'pemilik', label: 'Pemilik', hint: 'Lihat laporan akuntansi', email: 'pemilik@contoh.id', icon: Building2 },
]

export function LoginForm() {
  const router = useRouter()
  const [role, setRole] = useState<Role>('admin')
  const [email, setEmail] = useState(config.mock.auth ? roles[0].email : '')
  const [loading, setLoading] = useState(false)
  const [password, setPassword] = useState(config.mock.auth ? 'demo12345' : '')

  function selectRole(r: (typeof roles)[number]) {
    setRole(r.value)
    setEmail(r.email)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const signedInRole = await loginWithCredentials(email, password, role)
      localStorage.setItem(ROLE_STORAGE_KEY, signedInRole)
      window.dispatchEvent(new Event('hadirpay-role-changed'))
      router.push(signedInRole === 'karyawan' ? '/app/beranda' : '/app')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Login gagal.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {config.mock.auth && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-semibold text-heading">Masuk sebagai</legend>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {roles.map((r) => {
              const active = role === r.value
              const Icon = r.icon
              return (
                <label
                  key={r.value}
                  className={cn(
                    'flex min-h-20 cursor-pointer flex-col gap-1 rounded-2xl border-2 p-3.5 transition-colors duration-150 has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-primary/20',
                    active ? 'border-primary bg-blue-50' : 'border-border bg-white hover:border-slate-300',
                  )}
                >
                  <input
                    type="radio"
                    name="role"
                    value={r.value}
                    checked={active}
                    onChange={() => selectRole(r)}
                    className="sr-only"
                  />
                  <span className="flex items-center gap-2 font-bold text-heading">
                    <Icon className={cn('size-5', active ? 'text-primary' : 'text-muted-foreground')} aria-hidden="true" />
                    {r.label}
                  </span>
                  <span className="text-xs text-muted-foreground">{r.hint}</span>
                </label>
              )
            })}
          </div>
        </fieldset>
      )}

      <TextField
        label="Email"
        type="email"
        name="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <PasswordField
        name="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />

      <button type="submit" className={submitClass} disabled={loading}>
        {loading ? 'Memproses…' : 'Masuk'}
        {!loading && <ArrowRight className="size-5" aria-hidden="true" />}
      </button>

      <p className="text-center text-sm text-muted-foreground">
        Belum punya akun?{' '}
        <Link href="/register" className="font-semibold text-primary hover:underline">
          Daftar di sini
        </Link>
      </p>
    </form>
  )
}
