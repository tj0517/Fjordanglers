/**
 * FA-M.12 — public/sw.js run in a sandbox with a fake service-worker global. Covers: only `push`
 * and `notificationclick` listeners (no fetch handler — pages are never intercepted); a push shows
 * the notification with the click target in its data; tapping it opens `/r/<token>` (or focuses
 * the tab already on it); any other click target falls back to the guide panel.
 */

import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { runInNewContext } from 'node:vm'
import { randomBytes } from 'node:crypto'

type Handler = (event: unknown) => void

function loadWorker(windows: Array<{ url: string; focus: () => Promise<unknown> }> = []) {
  const handlers: Record<string, Handler> = {}
  const self = {
    addEventListener: (type: string, fn: Handler) => { handlers[type] = fn },
    registration: { showNotification: vi.fn(async () => undefined) },
    clients: { matchAll: vi.fn(async () => windows), openWindow: vi.fn(async () => null) },
  }
  runInNewContext(readFileSync(join(process.cwd(), 'public/sw.js'), 'utf8'), { self, URL })
  return { handlers, self }
}

function extendable<T extends object>(extra: T) {
  const pending: Promise<unknown>[] = []
  return { event: { ...extra, waitUntil: (p: Promise<unknown>) => { pending.push(p) } }, settle: () => Promise.all(pending) }
}

const TOKEN = randomBytes(32).toString('base64url')

describe('public/sw.js', () => {
  it('registers only push and notificationclick — no fetch handler', () => {
    const { handlers } = loadWorker()
    expect(Object.keys(handlers).sort()).toEqual(['notificationclick', 'push'])
  })

  it('push → shows the notification with the request page as its click target', async () => {
    const { handlers, self } = loadWorker()
    const payload = { title: 'New request · Taupō, 14–15 Jan', body: '2 anglers. Tap to accept, decline or suggest dates.', url: `/r/${TOKEN}`, tag: 'request-1' }
    const { event, settle } = extendable({ data: { json: () => payload } })
    handlers.push(event)
    await settle()
    expect(self.registration.showNotification).toHaveBeenCalledWith('New request · Taupō, 14–15 Jan', {
      body: payload.body, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', tag: 'request-1', data: { url: `/r/${TOKEN}` },
    })
  })

  it('push with an unreadable payload still shows a notification, pointing at the guide panel', async () => {
    const { handlers, self } = loadWorker()
    const { event, settle } = extendable({ data: { json: () => { throw new SyntaxError('bad') } } })
    handlers.push(event)
    await settle()
    expect(self.registration.showNotification).toHaveBeenCalledWith('New request', expect.objectContaining({ data: { url: '/dashboard' } }))
  })

  it('notificationclick → closes the notification and opens /r/<token>', async () => {
    const { handlers, self } = loadWorker()
    const close = vi.fn()
    const { event, settle } = extendable({ notification: { close, data: { url: `/r/${TOKEN}` } } })
    handlers.notificationclick(event)
    await settle()
    expect(close).toHaveBeenCalledOnce()
    expect(self.clients.openWindow).toHaveBeenCalledWith(`/r/${TOKEN}`)
  })

  it('notificationclick → focuses a tab already on that request instead of opening another', async () => {
    const focus = vi.fn(async () => undefined)
    const { handlers, self } = loadWorker([
      { url: 'http://localhost:3000/dashboard', focus: vi.fn(async () => undefined) },
      { url: `http://localhost:3000/r/${TOKEN}`, focus },
    ])
    const { event, settle } = extendable({ notification: { close: vi.fn(), data: { url: `/r/${TOKEN}` } } })
    handlers.notificationclick(event)
    await settle()
    expect(focus).toHaveBeenCalledOnce()
    expect(self.clients.openWindow).not.toHaveBeenCalled()
  })

  it.each([
    'https://evil.example.com/r/abc',
    '//evil.example.com',
    `/r/${TOKEN}/../../admin`,
    '/r/short',
    'javascript:alert(1)',
    undefined,
  ])('notificationclick with target %s → opens the guide panel, nothing else', async url => {
    const { handlers, self } = loadWorker()
    const { event, settle } = extendable({ notification: { close: vi.fn(), data: { url } } })
    handlers.notificationclick(event)
    await settle()
    expect(self.clients.openWindow).toHaveBeenCalledWith('/dashboard')
  })
})
