'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { signOut } from '@/actions/auth'
import { useState, useRef, useEffect } from 'react'
import { LogOut, Settings, ChevronDown } from 'lucide-react'

const TABS = [
  { key: 'bookings', label: 'Bookings', href: '/account/bookings' },
  { key: 'payments', label: 'Payments', href: '/account/payments' },
  { key: 'receipts', label: 'Receipts', href: '/account/receipts' },
]

export default function AccountTopNav({
  displayName,
  email,
}: {
  displayName: string
  email: string
}) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const initial = displayName[0]?.toUpperCase() ?? 'A'

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
        <Link href="/" className="flex items-center flex-shrink-0 mr-6 sm:mr-8">
          <Image
            src="/brand/white-logo.png"
            alt="FjordAnglers"
            width={130}
            height={32}
            className="h-7 w-auto"
          />
        </Link>

        {/* Tab navigation */}
        <nav className="flex items-stretch gap-0.5 overflow-x-auto">
          {TABS.map(tab => {
            const active = pathname.startsWith(tab.href)
            return (
              <Link
                key={tab.key}
                href={tab.href}
                className="flex items-center flex-shrink-0 h-full px-3.5 sm:px-4 text-sm f-body font-medium border-b-2 transition-colors whitespace-nowrap"
                style={{
                  color:       active ? '#FFFFFF' : 'rgba(255,255,255,0.5)',
                  borderColor: active ? '#E67E50' : 'transparent',
                }}
              >
                {tab.label}
              </Link>
            )
          })}
        </nav>

        {/* Spacer */}
        <div className="flex-1" />

        {/* User avatar + dropdown */}
        <div ref={dropdownRef} className="relative flex items-center">
          <button
            type="button"
            className="flex items-center gap-2 h-full px-2 transition-colors hover:bg-white/10 rounded-lg"
            onClick={() => setOpen(v => !v)}
            aria-haspopup="true"
            aria-expanded={open}
          >
            {/* Avatar circle */}
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold f-body flex-shrink-0"
              style={{
                background: 'rgba(230,126,80,0.2)',
                border:     '1.5px solid rgba(230,126,80,0.45)',
                color:      '#E67E50',
              }}
            >
              {initial}
            </div>
            <span
              className="text-xs font-medium f-body hidden sm:block max-w-[120px] truncate"
              style={{ color: 'rgba(255,255,255,0.75)' }}
            >
              {displayName}
            </span>
            <ChevronDown
              size={12}
              className="flex-shrink-0 transition-transform duration-150"
              style={{
                color:     'rgba(255,255,255,0.4)',
                transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
              }}
            />
          </button>

          {/* Dropdown panel */}
          {open && (
            <div
              className="absolute right-0 top-full mt-1.5 w-56 rounded-2xl shadow-xl overflow-hidden z-50"
              style={{
                background: '#FFFFFF',
                border:     '1px solid rgba(10,46,77,0.1)',
                boxShadow:  '0 8px 32px rgba(10,46,77,0.18)',
              }}
            >
              {/* User info header */}
              <div
                className="px-4 py-3"
                style={{ borderBottom: '1px solid rgba(10,46,77,0.07)' }}
              >
                <p className="text-sm font-semibold f-body truncate" style={{ color: '#0A2E4D' }}>
                  {displayName}
                </p>
                <p className="text-xs f-body truncate mt-0.5" style={{ color: 'rgba(10,46,77,0.5)' }}>
                  {email}
                </p>
              </div>

              {/* Settings link */}
              <Link
                href="/account/settings"
                className="flex items-center gap-3 px-4 py-3 text-sm f-body font-medium transition-colors hover:bg-[#F9F6F1]"
                style={{ color: '#0A2E4D' }}
                onClick={() => setOpen(false)}
              >
                <Settings size={15} style={{ color: 'rgba(10,46,77,0.4)' }} />
                Account settings
              </Link>

              {/* Divider */}
              <div style={{ height: '1px', background: 'rgba(10,46,77,0.07)' }} />

              {/* Sign out */}
              <form action={signOut}>
                <button
                  type="submit"
                  className="flex items-center gap-3 px-4 py-3 text-sm f-body font-medium w-full text-left transition-colors hover:bg-red-50"
                  style={{ color: '#DC2626' }}
                >
                  <LogOut size={15} />
                  Sign out
                </button>
              </form>
            </div>
          )}
        </div>

      </div>
    </header>
  )
}
