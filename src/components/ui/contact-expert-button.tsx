'use client'

import { useState, useRef, useEffect } from 'react'
import { Mail, MessageCircle } from 'lucide-react'

const WHATSAPP_URL =
  'https://wa.me/48698936563?text=Hi!%20I%27m%20interested%20in%20a%20guided%20fishing%20trip%20in%20Scandinavia.%20Can%20you%20help%20me%20plan%20it%3F'
const EMAIL_URL =
  'mailto:contact@fjordanglers.com?subject=Question%20about%20a%20guided%20fishing%20trip'

export function ContactExpertButton({
  variant = 'on-dark',
  popoverPosition = 'above',
}: {
  variant?: 'on-dark' | 'on-light'
  popoverPosition?: 'above' | 'below'
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [open])

  const btnStyle =
    variant === 'on-dark'
      ? {
          background: 'rgba(255,255,255,0.1)',
          color: '#fff',
          border: '1.5px solid rgba(255,255,255,0.22)',
        }
      : {
          background: 'transparent',
          color: '#0A2E4D',
          border: '1.5px solid rgba(10,46,77,0.22)',
        }

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full text-sm font-semibold f-body transition-all hover:brightness-110 active:scale-[0.98]"
        style={btnStyle}
      >
        <MessageCircle size={15} strokeWidth={2} />
        Talk to an Expert
      </button>

      {open && (
        <div
          className={`absolute left-1/2 -translate-x-1/2 z-50 rounded-2xl overflow-hidden ${
            popoverPosition === 'above' ? 'bottom-full mb-2' : 'top-full mt-2'
          }`}
          style={{
            background: '#fff',
            boxShadow: '0 8px 32px rgba(10,46,77,0.2)',
            border: '1px solid rgba(10,46,77,0.08)',
            minWidth: '230px',
          }}
        >
          <div className="px-4 pt-3.5 pb-2">
            <p
              className="text-[10px] font-bold uppercase tracking-[0.2em] f-body"
              style={{ color: 'rgba(10,46,77,0.38)' }}
            >
              Get in touch
            </p>
          </div>

          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[rgba(37,211,102,0.06)]"
            style={{ textDecoration: 'none' }}
          >
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(37,211,102,0.12)' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#25D366" aria-hidden="true">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold f-body" style={{ color: '#0A2E4D', margin: 0 }}>
                WhatsApp
              </p>
              <p className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.45)', margin: 0 }}>
                Quick reply · usually same day
              </p>
            </div>
          </a>

          <a
            href={EMAIL_URL}
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-3 mb-1 transition-colors hover:bg-[rgba(10,46,77,0.04)]"
            style={{ textDecoration: 'none' }}
          >
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(10,46,77,0.07)' }}
            >
              <Mail size={15} style={{ color: '#0A2E4D' }} />
            </div>
            <div>
              <p className="text-sm font-semibold f-body" style={{ color: '#0A2E4D', margin: 0 }}>
                Email us
              </p>
              <p className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.45)', margin: 0 }}>
                Reply within 24 hours
              </p>
            </div>
          </a>
        </div>
      )}
    </div>
  )
}
