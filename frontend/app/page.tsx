import { CtaBanner, Footer } from '@/components/landing/cta-footer'
import { Features } from '@/components/landing/features'
import { Hero } from '@/components/landing/hero'
import { Navbar } from '@/components/landing/navbar'
import { PreviewGallery } from '@/components/landing/preview-gallery'

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Features />
        <PreviewGallery />
        <CtaBanner />
      </main>
      <Footer />
    </>
  )
}
