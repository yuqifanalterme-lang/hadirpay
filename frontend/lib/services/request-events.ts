export const requestsChangedEvent = 'hadirpay-requests-changed'

export function notifyRequestsChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(requestsChangedEvent))
  }
}
