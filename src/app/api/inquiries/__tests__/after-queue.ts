/**
 * FA-1.61 — a stand-in for `after()` from `next/server`, shared by the route tests.
 *
 * Outside a Next request scope the real `after()` throws, so the route tests replace it. The
 * stand-in does NOT run the callback: it queues it. A test sees the state "response returned,
 * after-work not yet done" and then calls `flushAfter()` to run the queue, which is what Next
 * does once the response is closed. A route that awaited the AI work inline would leave the
 * queue empty and the work already finished — which is how the tests tell the two apart.
 *
 * Usage in a test file (the factory must be in the test file, vi.mock is hoisted there):
 *
 *   vi.mock('next/server', async (orig) => ({
 *     ...(await orig<typeof import('next/server')>()),
 *     after: (await import('./after-queue')).afterMock,
 *   }))
 */

import { vi } from 'vitest'

type AfterCallback = () => unknown | Promise<unknown>

// The queue lives on globalThis because a test file may call vi.resetModules() (the route is
// then imported afresh and would get a second copy of this module, with its own empty queue).
const QUEUE_KEY = Symbol.for('fa.test.afterQueue')
const holder = globalThis as unknown as Record<symbol, AfterCallback[] | undefined>
holder[QUEUE_KEY] ??= []

/** Callbacks handed to `after()` and not yet run, in call order. */
export const afterQueue: AfterCallback[] = holder[QUEUE_KEY]

export const afterMock = vi.fn((callback: AfterCallback): void => {
  afterQueue.push(callback)
})

/** Empty the queue without running anything — call in `beforeEach` so tests do not leak work. */
export function resetAfterQueue(): void {
  afterQueue.length = 0
}

/** Run the queued callbacks one after another and wait for each, as Next does after the response. */
export async function flushAfter(): Promise<void> {
  while (afterQueue.length > 0) {
    const callback = afterQueue.shift()!
    await callback()
  }
}
