import { StatusPage } from '@/components/app/status-page'

export default function NotFound() {
  return (
    <StatusPage
      code="404"
      title="Halaman tidak ditemukan"
      description="Alamat halaman tidak tersedia. Kembali ke dashboard untuk melanjutkan."
    />
  )
}
