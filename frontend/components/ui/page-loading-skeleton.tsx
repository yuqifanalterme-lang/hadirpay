export function PageLoadingSkeleton({ label }: { label: string }) {
  return (
    <section className="flex flex-col gap-6" aria-busy="true" aria-label={`Memuat ${label}`}>
      <span className="sr-only">Memuat {label}</span>
      <div className="h-8 w-56 rounded-lg bg-muted" />
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-white p-5 sm:p-6">
        <div className="h-5 w-48 rounded-lg bg-muted" />
        <div className="h-12 w-full rounded-xl bg-muted" />
        <div className="h-12 w-full rounded-xl bg-muted" />
        <div className="h-12 w-full rounded-xl bg-muted" />
      </div>
    </section>
  )
}
