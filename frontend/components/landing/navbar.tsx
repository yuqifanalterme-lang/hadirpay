'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'
import { Logo } from '@/components/hadirpay/logo'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const links = [
  { href: '#fitur', label: 'Fitur' },
  { href: '#pratinjau', label: 'Pratinjau Sistem' },
]

export function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const solid = scrolled || open

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-colors duration-200',
        solid ? 'border-b border-border bg-white' : 'bg-transparent',
      )}
    >
      <div className="mx-auto flex h-18 max-w-7xl items-center justify-between gap-6 px-5 sm:px-8">
        <Link href="/" className="rounded-lg">
          <Logo tone={solid ? 'dark' : 'light'} />
          <span className="sr-only">HADIRPAY beranda</span>
        </Link>

        <nav aria-label="Navigasi utama" className="hidden md:block">
          <ul className="flex items-center gap-1">
            {links.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  className={cn(
                    'inline-flex min-h-11 items-center rounded-xl px-4 text-[15px] font-semibold transition-colors duration-150',
                    solid ? 'text-foreground hover:bg-surface hover:text-heading' : 'text-blue-100 hover:bg-white/10 hover:text-white',
                  )}
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/login"
            className={buttonVariants({
              variant: solid ? 'outline' : 'inverseOutline',
              size: 'nav',
              className: 'transition-colors duration-150',
            })}
          >
            Login
          </Link>
          <Link
            href="/register"
            className={buttonVariants({
              variant: 'primary',
              size: 'nav',
              className: 'shadow-sm shadow-blue-600/30 transition-colors duration-150',
            })}
          >
            Daftar
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mobile-nav"
          className={cn(
            'inline-flex min-h-11 items-center gap-2 rounded-xl px-3 md:hidden',
            solid ? 'text-heading hover:bg-surface' : 'text-white hover:bg-white/10',
          )}
        >
          {open ? <X className="size-6" aria-hidden="true" /> : <Menu className="size-6" aria-hidden="true" />}
          <span className="text-sm font-semibold">{open ? 'Tutup' : 'Menu'}</span>
        </button>
      </div>

      {open && (
        <div id="mobile-nav" className="border-t border-border bg-white px-5 pt-2 pb-5 md:hidden">
          <ul className="flex flex-col">
            {links.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="flex min-h-12 items-center rounded-xl px-3 text-base font-semibold text-heading hover:bg-surface"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Link
              href="/login"
              className={buttonVariants({
                variant: 'outline',
                size: 'mobileAction',
                className: 'justify-center bg-white',
              })}
            >
              Login
            </Link>
            <Link
              href="/register"
              className={buttonVariants({
                variant: 'primary',
                size: 'mobileAction',
                className: 'w-full justify-center',
              })}
            >
              Daftar
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}
