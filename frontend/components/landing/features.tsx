import Image from 'next/image'

type Feature = {
  title: string
  body: string
  image: string
  alt: string
  rotation: string
}

const features: Feature[] = [
  {
    title: 'Absensi Digital Real-Time',
    body: 'Check-in dan check-out lewat web, waktu tercatat otomatis, plus pengajuan izin dan cuti.',
    image: '/sidikjari.svg',
    alt: 'Ilustrasi pemindai sidik jari untuk absensi digital',
    rotation: '-3deg',
  },
  {
    title: 'Hitung Gaji Otomatis',
    body: 'Gaji pokok, tunjangan, dan potongan absen terhitung presisi.',
    image: '/kalkulator.svg',
    alt: 'Ilustrasi kalkulator untuk perhitungan gaji otomatis',
    rotation: '2deg',
  },
  {
    title: 'Slip Gaji PDF Instan',
    body: 'Karyawan bisa melihat rincian dan mengunduh slip gaji kapan saja.',
    image: '/slip.svg',
    alt: 'Ilustrasi dokumen slip gaji format PDF',
    rotation: '-2deg',
  },
  {
    title: 'Jurnal Akuntansi Otomatis',
    body: 'Transaksi gaji langsung menjadi jurnal umum dan buku besar.',
    image: '/buku.svg',
    alt: 'Ilustrasi buku jurnal akuntansi dan pembukuan otomatis',
    rotation: '3deg',
  },
]

export function Features() {
  return (
    <section id="fitur" className="scroll-mt-20 bg-white pt-14 pb-20 sm:pt-16 sm:pb-24">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">
            Satu alur dari kehadiran sampai laporan keuangan
          </h2>
          <p className="text-lg text-pretty text-foreground">
            Data absensi mengalir langsung ke perhitungan gaji, lalu tercatat sebagai jurnal tanpa input ulang.
          </p>
        </div>

        <ul className="mt-[110px] grid gap-x-5 gap-y-[120px] sm:mt-[120px] sm:grid-cols-2 lg:grid-cols-4 lg:gap-y-5">
          {features.map((f) => (
            <li
              key={f.title}
              className="group relative flex flex-col rounded-xl border border-border bg-white px-6 pb-6 pt-[110px] transition-colors duration-200 hover:border-primary"
            >
              <div className="absolute -top-[90px] inset-x-0 z-10 mx-auto flex h-[190px] w-full justify-center px-4">
                <div
                  className="relative h-full w-full max-w-[240px] origin-bottom"
                  style={{ transform: `rotate(${f.rotation})`, transformOrigin: 'bottom center' }}
                >
                  <Image
                    src={f.image}
                    alt={f.alt}
                    fill
                    className="object-contain"
                    sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <h3 className="text-lg font-bold">{f.title}</h3>
                <p className="text-[15px] leading-relaxed">{f.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
