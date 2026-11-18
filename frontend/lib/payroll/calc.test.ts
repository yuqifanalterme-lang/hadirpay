import assert from 'node:assert/strict'
import test from 'node:test'
import { calculatePayroll } from './calc'

test('menghitung contoh potongan alpha dan keterlambatan dengan pembulatan dua desimal', () => {
  const result = calculatePayroll({
    baseSalary: 4_500_000,
    fixedAllowance: 0,
    overtimePay: 100_000,
    workDays: 22,
    absenceDays: 1,
    lateDeduction: 20_000,
    otherDeductions: 0,
  })

  assert.equal(result.dailyRate, 204_545.45)
  assert.equal(result.absenceDeduction, 204_545.45)
  assert.equal(result.netPay, 4_375_454.55)
})

test('menolak hari kerja nol dan nilai potongan yang tidak valid', () => {
  assert.throws(
    () => calculatePayroll({
      baseSalary: 4_500_000,
      fixedAllowance: 0,
      overtimePay: 0,
      workDays: 0,
      absenceDays: 0,
      lateDeduction: 0,
      otherDeductions: 0,
    }),
    RangeError,
  )
  assert.throws(
    () => calculatePayroll({
      baseSalary: 4_500_000,
      fixedAllowance: 0,
      overtimePay: 0,
      workDays: 22,
      absenceDays: 0,
      lateDeduction: -1,
      otherDeductions: 0,
    }),
    RangeError,
  )
})
