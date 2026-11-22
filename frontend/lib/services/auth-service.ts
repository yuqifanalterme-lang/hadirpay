import type { Role } from '@/lib/navigation'

const passwordKey = (role: Role) => `hadirpay-demo-password-v1:${role}`
const initialDemoPassword = 'demo12345'

async function hashPassword(value: string) {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function authenticateDemoRole(role: Role, password: string) {
  if (!password) throw new Error('Kata sandi wajib diisi.')
  const storedHash = window.localStorage.getItem(passwordKey(role))
  const expectedHash = storedHash ?? await hashPassword(initialDemoPassword)
  if (await hashPassword(password) !== expectedHash) {
    throw new Error(storedHash
      ? 'Kata sandi tidak sesuai untuk role ini.'
      : 'Kata sandi awal adalah demo12345.')
  }
}

export async function updateDemoPassword(role: Role, currentPassword: string, newPassword: string) {
  if (newPassword.length < 8) throw new Error('Kata sandi baru minimal 8 karakter.')
  if (newPassword === currentPassword) throw new Error('Gunakan kata sandi baru yang berbeda.')
  await authenticateDemoRole(role, currentPassword)
  window.localStorage.setItem(passwordKey(role), await hashPassword(newPassword))
}
