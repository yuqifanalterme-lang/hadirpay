import {
  BookOpenText,
  BookOpen,
  BriefcaseBusiness,
  ClipboardList,
  Building2,
  FileChartColumn,
  Fingerprint,
  History,
  House,
  LayoutDashboard,
  NotebookPen,
  ReceiptText,
  Settings,
  Scale,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

export type Role = 'admin' | 'karyawan' | 'keuangan' | 'pemilik'

export type NavItem = { label: string; href: string; icon: LucideIcon; ready?: boolean }
export type NavGroup = { label: string; items: NavItem[] }

export const navGroupsByRole: Record<Role, NavGroup[]> = {
  admin: [
    {
      label: 'Harian',
      items: [
        { label: 'Dashboard', href: '/app', icon: LayoutDashboard, ready: true },
        { label: 'Absensi', href: '/app/absensi', icon: Fingerprint, ready: true },
        { label: 'Pengajuan', href: '/app/pengajuan', icon: ClipboardList, ready: true },
        { label: 'Data Karyawan', href: '/app/karyawan', icon: Users, ready: true },
      ],
    },
    {
      label: 'Keuangan',
      items: [
        { label: 'Penggajian', href: '/app/penggajian', icon: Wallet, ready: true },
        { label: 'Slip Gaji', href: '/app/slip-gaji', icon: ReceiptText, ready: true },
        { label: 'Laporan', href: '/app/laporan', icon: FileChartColumn },
      ],
    },
    {
      label: 'Akuntansi',
      items: [
        { label: 'Data Akun', href: '/app/akuntansi/akun', icon: BookOpenText, ready: true },
        { label: 'Jurnal Umum', href: '/app/akuntansi/jurnal', icon: NotebookPen, ready: true },
        { label: 'Buku Besar', href: '/app/akuntansi/buku-besar', icon: BookOpen, ready: true },
        { label: 'Neraca Saldo', href: '/app/akuntansi/neraca-saldo', icon: Scale, ready: true },
      ],
    },
    {
      label: 'Sistem',
      items: [{ label: 'Pengaturan', href: '/app/pengaturan', icon: Settings }],
    },
    {
      label: 'Data Master',
      items: [
        { label: 'Jabatan', href: '/app/master/jabatan', icon: BriefcaseBusiness, ready: true },
        { label: 'Departemen', href: '/app/master/departemen', icon: Building2, ready: true },
      ],
    },
  ],
  karyawan: [
    {
      label: 'Kehadiran',
      items: [
        { label: 'Beranda', href: '/app/beranda', icon: House, ready: true },
        { label: 'Absensi', href: '/app/absensi', icon: Fingerprint, ready: true },
        { label: 'Riwayat Kehadiran', href: '/app/riwayat-kehadiran', icon: History, ready: true },
        { label: 'Pengajuan', href: '/app/pengajuan', icon: ClipboardList, ready: true },
      ],
    },
    {
      label: 'Gaji',
      items: [{ label: 'Slip Gaji', href: '/app/slip-gaji', icon: ReceiptText, ready: true }],
    },
  ],
  keuangan: [
    {
      label: 'Keuangan',
      items: [
        { label: 'Penggajian', href: '/app/penggajian', icon: Wallet, ready: true },
        { label: 'Slip Gaji', href: '/app/slip-gaji', icon: ReceiptText, ready: true },
      ],
    },
    {
      label: 'Akuntansi',
      items: [
        { label: 'Data Akun', href: '/app/akuntansi/akun', icon: BookOpenText, ready: true },
        { label: 'Jurnal Umum', href: '/app/akuntansi/jurnal', icon: NotebookPen, ready: true },
        { label: 'Buku Besar', href: '/app/akuntansi/buku-besar', icon: BookOpen, ready: true },
        { label: 'Neraca Saldo', href: '/app/akuntansi/neraca-saldo', icon: Scale, ready: true },
      ],
    },
  ],
  pemilik: [
    {
      label: 'Akuntansi',
      items: [
        { label: 'Data Akun', href: '/app/akuntansi/akun', icon: BookOpenText, ready: true },
        { label: 'Jurnal Umum', href: '/app/akuntansi/jurnal', icon: NotebookPen, ready: true },
        { label: 'Buku Besar', href: '/app/akuntansi/buku-besar', icon: BookOpen, ready: true },
        { label: 'Neraca Saldo', href: '/app/akuntansi/neraca-saldo', icon: Scale, ready: true },
      ],
    },
  ],
}

export const navByRole: Record<Role, NavItem[]> = {
  admin: navGroupsByRole.admin.flatMap((g) => g.items),
  karyawan: navGroupsByRole.karyawan.flatMap((g) => g.items),
  keuangan: navGroupsByRole.keuangan.flatMap((g) => g.items),
  pemilik: navGroupsByRole.pemilik.flatMap((g) => g.items),
}

export const ROLE_STORAGE_KEY = 'hadirpay-role'

export function findNavItem(href: string) {
  const items = Object.values(navByRole).flat()
  return (
    items.find((item) => item.href === href) ??
    items
      .filter((item) => item.href !== '/app' && href.startsWith(`${item.href}/`))
      .sort((a, b) => b.href.length - a.href.length)[0]
  )
}
