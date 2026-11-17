import { Hourglass } from 'lucide-react'
import { findNavItem } from '@/lib/navigation'

export default async function ComingSoonPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params
  const item = findNavItem(`/app/${slug.join('/')}`)

  return (
    <section className="mx-auto flex max-w-lg flex-col items-center gap-4 rounded-2xl border border-border bg-white px-6 py-16 text-center shadow-sm">
      <span className="flex size-16 items-center justify-center rounded-2xl bg-blue-50 text-primary">
        <Hourglass className="size-8" aria-hidden="true" />
      </span>
      <h2 className="text-2xl font-extrabold">Segera hadir</h2>
      <p className="text-base leading-relaxed text-pretty">
        Halaman <strong className="text-heading">{item?.label ?? 'ini'}</strong> sedang kami siapkan. Gunakan menu
        di samping untuk kembali ke halaman utama.
      </p>
    </section>
  )
}
