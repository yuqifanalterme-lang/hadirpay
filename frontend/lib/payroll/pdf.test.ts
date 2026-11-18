import assert from 'node:assert/strict'
import test from 'node:test'
import { createPayslipPdf } from './pdf'

test('membuat PDF slip gaji ber-brand HADIRPAY', async () => {
  const blob = createPayslipPdf({
    employeeName: 'Andi Wijaya',
    employeeId: 'HP-0001',
    position: 'Staf Keuangan',
    department: 'Keuangan',
    period: 'November 2026',
    netPay: 4_375_454.55,
    earnings: [{ label: 'Gaji pokok', amount: 4_500_000 }],
    deductions: [{ label: 'Potongan alpha', amount: 204_545.45 }],
    attendance: { presentDays: 21, lateCount: 1, absenceDays: 1 },
  }, '#1e3a8a')
  const pdf = await blob.text()

  assert.equal(blob.type, 'application/pdf')
  assert.ok(pdf.startsWith('%PDF-1.4'))
  assert.ok(pdf.includes('(HADIRPAY)'))
  assert.ok(pdf.includes('xref'))
})

test('menolak warna token PDF yang tidak valid', () => {
  assert.throws(
    () => createPayslipPdf({
      employeeName: 'Andi Wijaya',
      employeeId: 'HP-0001',
      position: 'Staf Keuangan',
      department: 'Keuangan',
      period: 'November 2026',
      netPay: 4_375_454.55,
      earnings: [],
      deductions: [],
      attendance: { presentDays: null, lateCount: null, absenceDays: null },
    }, 'blue'),
    /Token warna HADIRPAY tidak valid/,
  )
})
