'use client'

/**
 * FA-M.12 — "Notifications" on /dashboard/account (Settings.dc.html): the push toggle for THIS
 * browser, and the WhatsApp row that is always on. Push is an extra; WhatsApp is the guaranteed
 * channel (mockup decision 7).
 *
 * Turning push on: ask permission (first thing in the tap — Safari needs the user gesture) →
 * register /sw.js → subscribe with the VAPID public key → store through the server action.
 * Turning it off: delete the stored row, then unsubscribe the browser.
 */

import { useEffect, useState, useTransition } from 'react'
import {
  savePushSubscriptionAction, deletePushSubscriptionAction, pushSubscriptionStatusAction,
} from '@/actions/push'

type PushState = 'loading' | 'unavailable' | 'unsupported' | 'denied' | 'on' | 'off'

const NAVY = '#0A2E4D'
const MUTED = 'rgba(10,46,77,0.55)'

const HINT: Record<PushState, string> = {
  loading:     'Checking this phone…',
  on:          'On for this phone',
  off:         'Off — you will only get WhatsApp',
  unavailable: 'Not available yet — you get every request on WhatsApp',
  unsupported: 'Add FjordAnglers to your home screen first (steps below)',
  denied:      'Blocked in your browser settings — allow notifications for this site, then try again',
}

function browserSupportsPush(): boolean {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4))
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.getRegistration('/')
  return (await registration?.pushManager.getSubscription()) ?? null
}

export function PushSettings({ publicKey }: { publicKey: string | null }) {
  const [state, setState]            = useState<PushState>('loading')
  const [error, setError]            = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    let cancelled = false
    async function read(): Promise<PushState> {
      if (publicKey == null) return 'unavailable'
      if (!browserSupportsPush()) return 'unsupported'
      if (Notification.permission === 'denied') return 'denied'
      const subscription = await currentSubscription()
      if (subscription == null || Notification.permission !== 'granted') return 'off'
      const { saved } = await pushSubscriptionStatusAction(subscription.endpoint)
      return saved ? 'on' : 'off'
    }
    read().then(s => { if (!cancelled) setState(s) }, () => { if (!cancelled) setState('off') })
    return () => { cancelled = true }
  }, [publicKey])

  function turnOn() {
    if (publicKey == null) return
    // Not awaited before anything else: Safari only shows the prompt inside the tap.
    const permission = Notification.requestPermission()
    startTransition(async () => {
      setError(null)
      try {
        const answer = await permission
        if (answer !== 'granted') { setState(answer === 'denied' ? 'denied' : 'off'); return }
        const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
        await navigator.serviceWorker.ready
        const subscription = (await registration.pushManager.getSubscription())
          ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) })
        const result = await savePushSubscriptionAction(subscription.toJSON())
        if (!result.success) { setError(result.error); setState('off'); return }
        setState('on')
      } catch {
        setError('Could not turn on notifications on this phone. Please try again.')
        setState('off')
      }
    })
  }

  function turnOff() {
    startTransition(async () => {
      setError(null)
      try {
        const subscription = await currentSubscription()
        if (subscription != null) {
          const result = await deletePushSubscriptionAction(subscription.endpoint)
          if (!result.success) { setError(result.error); return }
          await subscription.unsubscribe()
        }
        setState('off')
      } catch {
        setError('Could not turn off notifications. Please try again.')
      }
    })
  }

  const on = state === 'on'
  const togglable = state === 'on' || state === 'off'

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-4 px-6 py-4" style={{ borderBottom: '1px solid rgba(10,46,77,0.04)' }}>
        <span className="flex-1 flex flex-col gap-0.5">
          <span className="text-sm font-semibold f-body" style={{ color: NAVY }}>Push notifications</span>
          <span className="text-xs f-body" style={{ color: MUTED }} data-testid="push-hint">{HINT[state]}</span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Push notifications"
          onClick={on ? turnOff : turnOn}
          disabled={!togglable || isPending}
          className="flex-shrink-0 w-[52px] h-8 rounded-full p-[3px] flex transition-colors duration-200 disabled:opacity-50"
          style={{ background: on ? NAVY : '#C9D3DC', justifyContent: on ? 'flex-end' : 'flex-start' }}
        >
          <span className="block w-[26px] h-[26px] rounded-full bg-white shadow" />
        </button>
      </div>
      <div className="flex items-center gap-4 px-6 py-4">
        <span className="flex-1 flex flex-col gap-0.5">
          <span className="text-sm font-semibold f-body" style={{ color: NAVY }}>WhatsApp</span>
          <span className="text-xs f-body" style={{ color: MUTED }}>Every request, always</span>
        </span>
        <span className="text-xs font-semibold f-body" style={{ color: MUTED }}>Always on</span>
      </div>
      {error != null && (
        <p className="text-xs f-body mx-6 mb-4 px-3 py-2.5 rounded-xl" style={{ background: 'rgba(239,68,68,0.07)', color: '#DC2626' }}>
          {error}
        </p>
      )}
    </div>
  )
}

/** The navy "Add FjordAnglers to your home screen" block (Settings.dc.html), iOS + Android steps. */
export function HomeScreenSteps() {
  return (
    <section className="rounded-2xl p-5 flex flex-col gap-3" style={{ background: NAVY, color: '#F8FAFB' }}
             aria-labelledby="home-screen-title">
      <h2 id="home-screen-title" className="text-base font-semibold f-body">Add FjordAnglers to your home screen</h2>
      <p className="text-xs f-body leading-relaxed" style={{ color: '#C7D4E0' }}>On iPhone, notifications only work after this step.</p>
      <ol className="list-decimal pl-5 flex flex-col gap-1.5 text-sm f-body leading-snug">
        <li>Open this page in Safari.</li>
        <li>Tap <strong className="font-semibold">Share</strong>, then <strong className="font-semibold">Add to Home Screen</strong>.</li>
        <li>Open FjordAnglers from the home screen and turn on notifications.</li>
      </ol>
      <p className="text-xs f-body" style={{ color: '#C7D4E0' }}>
        Android: tap <strong className="font-semibold" style={{ color: '#F8FAFB' }}>Install app</strong> when your browser offers it.
      </p>
    </section>
  )
}
