'use client'

import { useCallback, useRef, useTransition } from 'react'

/**
 * Pending state + re-entrancy lock for a data-changing action (FA-1.31).
 *
 * `run(fn)` executes `fn` inside a React transition so `isPending` flips to
 * true for the duration, and a ref-based lock drops any call that arrives
 * while a previous one is still in flight — even if it lands before React
 * has re-rendered the button as `disabled`.
 *
 * Usage:
 *   const [isPending, run] = useLockedAction()
 *   <button disabled={isPending} onClick={() => run(async () => { await serverAction() })}>
 */
export function useLockedAction(): [isPending: boolean, run: (fn: () => Promise<void>) => void] {
  const [isPending, startTransition] = useTransition()
  const lock = useRef(false)

  const run = useCallback((fn: () => Promise<void>) => {
    if (lock.current) return
    lock.current = true
    startTransition(async () => {
      try {
        await fn()
      } finally {
        lock.current = false
      }
    })
  }, [])

  return [isPending, run]
}
