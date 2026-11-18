export type PayrollCalculationInput = {
  baseSalary: number
  fixedAllowance: number
  overtimePay: number
  workDays: number
  absenceDays: number
  lateDeduction: number
  otherDeductions: number
}

export type PayrollCalculation = PayrollCalculationInput & {
  dailyRate: number
  absenceDeduction: number
  totalDeductions: number
  netPay: number
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function calculatePayroll(input: PayrollCalculationInput): PayrollCalculation {
  const amounts = [
    input.baseSalary,
    input.fixedAllowance,
    input.overtimePay,
    input.absenceDays,
    input.lateDeduction,
    input.otherDeductions,
  ]

  if (!Number.isInteger(input.workDays) || input.workDays <= 0) {
    throw new RangeError('Hari kerja harus lebih dari nol.')
  }
  if (!Number.isInteger(input.absenceDays)) {
    throw new RangeError('Jumlah hari alpha harus berupa bilangan bulat.')
  }
  if (amounts.some((amount) => !Number.isFinite(amount) || amount < 0)) {
    throw new RangeError('Nilai penggajian tidak boleh negatif atau tidak valid.')
  }
  if (input.absenceDays > input.workDays) {
    throw new RangeError('Jumlah hari alpha tidak boleh melebihi hari kerja.')
  }

  const dailyRate = roundMoney(input.baseSalary / input.workDays)
  const absenceDeduction = roundMoney(dailyRate * input.absenceDays)
  const totalDeductions = roundMoney(
    absenceDeduction + input.lateDeduction + input.otherDeductions,
  )
  const netPay = roundMoney(
    input.baseSalary + input.fixedAllowance + input.overtimePay - totalDeductions,
  )

  return { ...input, dailyRate, absenceDeduction, totalDeductions, netPay }
}
