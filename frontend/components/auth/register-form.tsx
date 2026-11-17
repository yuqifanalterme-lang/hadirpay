'use client'

import Link from 'next/link'
import { toast } from 'sonner'
import { PasswordField, submitClass, TextField } from './fields'

export function RegisterForm() {
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    toast.info('Pendaftaran belum terhubung ke layanan akun.')
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <TextField label="Nama lengkap" name="name" autoComplete="name" placeholder="Contoh: Rina Kartika" required />
      <TextField label="Nama perusahaan" name="company" autoComplete="organization" placeholder="Contoh: PT Maju Bersama" required />
      <TextField label="Email kerja" type="email" name="email" autoComplete="email" placeholder="nama@perusahaan.co.id" required />
      <PasswordField name="password" autoComplete="new-password" minLength={8} placeholder="Minimal 8 karakter" required />

      <button type="submit" className={submitClass}>
        Daftar Akun
      </button>

      <p className="text-center text-sm text-muted-foreground">
        Sudah punya akun?{' '}
        <Link href="/login" className="font-semibold text-primary hover:underline">
          Masuk di sini
        </Link>
      </p>
    </form>
  )
}
