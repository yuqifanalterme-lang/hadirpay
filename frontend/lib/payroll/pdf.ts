import type { PayrollBreakdownItem } from '../mock/payroll'

export type PayslipPdfData = {
  employeeName: string
  employeeId: string
  position: string
  department: string
  period: string
  netPay: number
  earnings: PayrollBreakdownItem[]
  deductions: PayrollBreakdownItem[]
  attendance: {
    presentDays: number | null
    lateCount: number | null
    absenceDays: number | null
  }
}

function toPdfText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7e]/g, '?')
    .replace(/[\\()]/g, '\\$&')
}

function textAt(value: string, x: number, y: number, size = 10, color = '0 0 0') {
  return `${color} rg BT /F1 ${size} Tf ${x} ${y} Td (${toPdfText(value)}) Tj ET\n`
}

function parseRgb(color: string) {
  const match = /^#?([0-9a-f]{6})$/i.exec(color)
  if (!match) throw new Error('Token warna HADIRPAY tidak valid untuk PDF.')
  const value = match[1]
  return [0, 2, 4].map((index) => (parseInt(value.slice(index, index + 2), 16) / 255).toFixed(3))
}

export function createPayslipPdf(data: PayslipPdfData, brandColor: string): Blob {
  const [red, green, blue] = parseRgb(brandColor)
  let content = `${red} ${green} ${blue} rg 0 744 595 98 re f\n`
  content += textAt('HADIRPAY', 44, 794, 22, '1 1 1')
  content += textAt('SLIP GAJI', 44, 770, 11, '1 1 1')
  content += textAt(`Periode ${data.period}`, 44, 716, 15, '0.059 0.090 0.165')
  content += textAt(`${data.employeeName} (${data.employeeId})`, 44, 693, 11)
  content += textAt(`${data.position} | ${data.department}`, 44, 676, 10)
  content += textAt('RINCIAN PENDAPATAN', 44, 640, 10, '0.059 0.090 0.165')

  let y = 620
  for (const item of data.earnings) {
    content += textAt(item.label, 44, y)
    content += textAt(`Rp${item.amount.toLocaleString('id-ID')}`, 410, y)
    y -= 18
  }

  y -= 8
  content += textAt('RINCIAN POTONGAN', 44, y, 10, '0.059 0.090 0.165')
  y -= 20
  for (const item of data.deductions) {
    content += textAt(item.label, 44, y)
    content += textAt(`Rp${item.amount.toLocaleString('id-ID')}`, 410, y)
    y -= 18
  }

  y -= 12
  content += `${red} ${green} ${blue} rg 44 ${y - 10} 507 1 re f\n`
  content += textAt(`Hari hadir: ${data.attendance.presentDays ?? 'Belum tersedia'}`, 44, y - 28, 9)
  content += textAt(`Terlambat: ${data.attendance.lateCount ?? 'Belum tersedia'} kali`, 220, y - 28, 9)
  content += textAt(`Alpha: ${data.attendance.absenceDays ?? 'Belum tersedia'} hari`, 390, y - 28, 9)
  content += textAt('GAJI BERSIH', 44, y - 58, 12, '0.059 0.090 0.165')
  content += textAt(`Rp${data.netPay.toLocaleString('id-ID')}`, 390, y - 58, 14, '0.059 0.090 0.165')
  content += textAt('Dokumen HADIRPAY', 44, 40, 8, '0.278 0.337 0.416')

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${content.length} >>\nstream\n${content}endstream`,
  ]
  let document = '%PDF-1.4\n'
  const offsets = [0]
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(document.length)
    document += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`
  }
  const xrefOffset = document.length
  document += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const offset of offsets.slice(1)) {
    document += `${String(offset).padStart(10, '0')} 00000 n \n`
  }
  document += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
  return new Blob([document], { type: 'application/pdf' })
}
