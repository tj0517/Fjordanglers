'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { signOut } from '@/actions/auth'
import { LogOut } from 'lucide-react'

const TABS = [
  { label: 'Bookings', href: '/account/bookings', matchPrefixes: ['/account/bookings', '/account/trips'] },
  { label: 'Payments', href: '/account/payments', matchPrefixes: ['/account/payments'] },
  { label: 'Account',  href: '/account/settings',  matchPrefixes: ['/account/settings'] },
] as const

export default function AccountTopNav({ displayName }: { displayName: string }) {
  const pathname = usePathname()

  return (
    <header
      className="sticky top-0 z-50"
      style={{
        background:   '#0A2E4D',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        boxShadow:    '0 2px 12px rgba(10,46,77,0.3)',
      }}
    >
      <div className="flex items-stretch h-14 px-4 sm:px-8 max-w-[1400px] mx-auto">

        {/* Logo */}
        <Link href="/" className="flex items-center flex-shrink-0 mr-8">
          <Image
            src="/brand/white-logo.png"
            alt="FjordAnglers"
            width={130}
            height={32}
            className="h-7 w-auto"
          />
        </Link>

        {/* Tabs */}
        <nav className="flex items-stretch flex-1">
          {TABS.map((tab) => {
            const isActive = tab.matchPrefixes.some(p => pathname.startsWith(p))
            return (
              <Link
                key={tab.label}
                href={tab.href}
                className="relative flex items-center px-4 text-sm font-medium f-body transition-colors"
                style={{ color: isActive ? '#fff' : 'rgba(255,255,255,0.45)' }}
              >
                {tab.label}
                {isActive && (
                  <span
                    className="absolute bottom-0 left-3 right-3 rounded-t-full"
                    style={{ height: 2, background: '#E67E50' }}
                  />
                )}
              </Link>
            )
          })}
        </nav>

        {/* User + logout */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <span
            className="text-xs font-medium f-body hidden sm:block"
            style={{ color: 'rgba(255,255,255,0.55)' }}
          >
            {displayName}
          </span>
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold f-body flex-shrink-0"
            style={{
              background: 'rgba(230,126,80,0.2)',
              border:     '1.5px solid rgba(230,126,80,0.45)',
              color:      '#E67E50',
            }}
          >
            {displayName[0]?.toUpperCase()}
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="p-1.5 rounded-lg transition-colors hover:bg-white/10"
              aria-label="Sign out"
            >
              <LogOut size={14} strokeWidth={1.5} style={{ color: 'rgba(255,255,255,0.38)' }} />
            </button>
          </form>
        </div>

      </div>
    </header>
  )
}
