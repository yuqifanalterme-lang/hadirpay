import { StatusPage } from '@/components/app/status-page'

export default function ForbiddenRoute() {
  return (
    <StatusPage
      code="403"
      title="Akses tidak tersedia"
      description="Role yang sedang digunakan tidak memiliki izin untuk membuka halaman ini."
    />
  )
}
