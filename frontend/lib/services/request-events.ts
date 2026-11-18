export const requestsChangedEvent = 'hadirpay-requests-changed'
export const notificationsChangedEvent = 'hadirpay-notifications-changed'

export function notifyNotificationsChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(notificationsChangedEvent))
}

export function notifyRequestsChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(requestsChangedEvent))
    notifyNotificationsChanged()
  }
}
