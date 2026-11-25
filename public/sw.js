/*
 * FA-M.12 — FjordAnglers service worker. Handles ONLY `push` and `notificationclick`.
 *
 * There is deliberately no fetch handler and no cache: this worker never sees a page request,
 * so every page (public or guide) loads exactly as without it. Offline mode is out of scope.
 *
 * The push payload is encrypted by the push service protocol (RFC 8291) and comes from our server
 * only (src/lib/push/guide-request-push.ts): { title, body, url, tag }. `url` is the request page
 * path `/r/<token>`; anything else is ignored and the click opens the guide panel instead.
 */

'use strict'

var FALLBACK_URL = '/dashboard'
var REQUEST_PATH = /^\/r\/[A-Za-z0-9_-]{43}$/

function clickTarget(data) {
  var url = data != null && typeof data.url === 'string' ? data.url : ''
  return REQUEST_PATH.test(url) ? url : FALLBACK_URL
}

self.addEventListener('push', function (event) {
  var data = {}
  try {
    data = event.data != null ? event.data.json() : {}
  } catch {
    data = {}
  }
  var title = typeof data.title === 'string' && data.title !== '' ? data.title : 'New request'
  var options = {
    body: typeof data.body === 'string' ? data.body : '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: typeof data.tag === 'string' ? data.tag : undefined,
    data: { url: clickTarget(data) },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  var target = clickTarget(event.notification.data)
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (windows) {
      for (var i = 0; i < windows.length; i++) {
        var w = windows[i]
        if (new URL(w.url).pathname === target && 'focus' in w) return w.focus()
      }
      return self.clients.openWindow(target)
    }),
  )
})
