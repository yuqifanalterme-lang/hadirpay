export const accountingDataChangedEvent = 'hadirpay-accounting-data-changed'

export function notifyAccountingDataChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(accountingDataChangedEvent))
}
