import type { Metadata } from 'next'
import { AuthLayout } from '@/components/auth/auth-layout'
import { LoginForm } from '@/components/auth/login-form'

export const metadata: Metadata = { title: 'Masuk · HADIRPAY' }

export default function LoginPage() {
  return (
    <AuthLayout title="Selamat datang kembali" description="Masuk untuk mengelola absensi dan penggajian.">
      <LoginForm />
    </AuthLayout>
  )
}
