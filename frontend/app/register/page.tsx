import type { Metadata } from 'next'
import { AuthLayout } from '@/components/auth/auth-layout'
import { RegisterForm } from '@/components/auth/register-form'

export const metadata: Metadata = { title: 'Daftar Akun · HADIRPAY' }

export default function RegisterPage() {
  return (
    <AuthLayout title="Buat akun perusahaan" description="Mulai catat absensi dan hitung gaji tim Anda.">
      <RegisterForm />
    </AuthLayout>
  )
}
