'use client'

/**
 * FA-M.12 — the "add to home screen" nudge under an answered request (Done.dc.html). Leads to the
 * Notifications section of the guide's account, where push is turned on. Hidden once this browser
 * runs FjordAnglers from the home screen with notifications allowed — nothing left to set up.
 */

import { useSyncExternalStore } from 'react'
import Link from 'next/link'
import { Bell } from 'lucide-react'

// Read once per render from the browser; nothing to subscribe to (the page reloads after setup).
const noSubscription = () => () => {}
const onServer = () => false

function alreadySetUp(): boolean {
  const standalone = typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches
  return standalone && 'Notification' in window && Notification.permission === 'granted'
}

export function HomeScreenNudge() {
  const hidden = useSyncExternalStore(noSubscription, alreadySetUp, onServer)
  if (hidden) return null

  return (
    <section data-testid="home-screen-nudge" aria-labelledby="home-screen-nudge-title"
      className="mt-4 rounded-2xl p-5 flex flex-col gap-3" style={{ background: '#0A2E4D', color: '#F8FAFB' }}>
      <div className="flex gap-3 items-start">
        <Bell size={22} strokeWidth={1.9} color="#E67E50" aria-hidden="true" className="flex-none mt-0.5" />
        <div className="flex flex-col gap-1">
          <h2 id="home-screen-nudge-title" className="text-base font-semibold f-body">Get the next one as a notification</h2>
          <p className="text-sm f-body leading-relaxed" style={{ color: '#C7D4E0' }}>
            Add FjordAnglers to your home screen — answer from the lock screen in one tap.
          </p>
        </div>
      </div>
      <Link href="/dashboard/account#notifications"
        className="flex items-center justify-center h-[46px] rounded-xl text-[15px] font-semibold f-body"
        style={{ background: '#F8FAFB', color: '#0A2E4D' }}>
        Set it up · 30 sec
      </Link>
    </section>
  )
}
