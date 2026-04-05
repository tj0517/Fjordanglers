'use client'

/**
 * SepaQrCode — renders an EPC 069-12 SEPA Credit Transfer QR code.
 *
 * Scanned by any EU/EEA banking app (Revolut, N26, Wise, DNB, Nordea, OP…).
 * Pre-fills: recipient name, IBAN, amount, reference.
 *
 * Usage:
 *   <SepaQrCode
 *     beneficiaryName="Lars Eriksen"
 *     iban="NO9386011117947"
 *     amountEur={460}
 *     bookingId="abc123…"
 *     bic="DNBANOKKXXX"      // optional
 *   />
 */

import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { buildSepaQrPayload, buildBookingReference } from '@/lib/sepa-qr'
import { Copy, Check } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  beneficiaryName: string
  iban:            string
  amountEur:       number
  bookingId:       string
  bic?:            string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatIban(raw: string): string {
  return raw.replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim()
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SepaQrCode({ beneficiaryName, iban, amountEur, bookingId, bic }: Props) {
  const [copied, setCopied] = useState(false)

  const reference = buildBookingReference(bookingId)
  const payload   = buildSepaQrPayload({ beneficiaryName, iban, amountEur, reference, bic })

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(iban.replace(/\s+/g, ''))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard not available
    }
  }

  return (
    <div className="flex flex-col gap-4">

      {/* ── QR code ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col items-center gap-3">
        <div
          className="p-3 rounded-2xl"
          style={{ background: '#fff', border: '1px solid rgba(10,46,77,0.08)' }}
        >
          <QRCodeSVG
            value={payload}
            size={180}
            level="M"
            marginSize={0}
            fgColor="#0A2E4D"
            bgColor="#ffffff"
          />
        </div>
        <p className="text-[10px] f-body text-center" style={{ color: 'rgba(10,46,77,0.4)' }}>
          Open your banking app · tap Scan / Pay · scan the QR code
        </p>
      </div>

      {/* ── Transfer details ─────────────────────────────────────────────────── */}
      <div
        className="rounded-xl flex flex-col gap-0 overflow-hidden"
        style={{ border: '1px solid rgba(10,46,77,0.08)' }}
      >
        {/* Name */}
        <div
          className="flex items-center gap-3 px-3 py-2.5"
          style={{ borderBottom: '1px solid rgba(10,46,77,0.06)' }}
        >
          <span
            className="text-[10px] uppercase tracking-[0.16em] font-bold f-body w-16 flex-shrink-0"
            style={{ color: 'rgba(10,46,77,0.35)' }}
          >
            Name
          </span>
          <span className="text-xs font-semibold f-body" style={{ color: '#0A2E4D' }}>
            {beneficiaryName}
          </span>
        </div>

        {/* IBAN + copy button */}
        <div
          className="flex items-center gap-3 px-3 py-2.5"
          style={{ borderBottom: '1px solid rgba(10,46,77,0.06)' }}
        >
          <span
            className="text-[10px] uppercase tracking-[0.16em] font-bold f-body w-16 flex-shrink-0"
            style={{ color: 'rgba(10,46,77,0.35)' }}
          >
            IBAN
          </span>
          <span
            className="text-xs font-semibold f-body font-mono flex-1"
            style={{ color: '#0A2E4D' }}
          >
            {formatIban(iban)}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            title="Copy IBAN"
            className="flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center transition-colors"
            style={{
              background: copied ? 'rgba(22,163,74,0.1)' : 'rgba(10,46,77,0.05)',
              color:      copied ? '#16A34A'              : 'rgba(10,46,77,0.45)',
            }}
          >
            {copied
              ? <Check size={11} strokeWidth={2.5} />
              : <Copy size={11} strokeWidth={1.8} />
            }
          </button>
        </div>

        {/* Amount */}
        <div
          className="flex items-center gap-3 px-3 py-2.5"
          style={{ borderBottom: '1px solid rgba(10,46,77,0.06)' }}
        >
          <span
            className="text-[10px] uppercase tracking-[0.16em] font-bold f-body w-16 flex-shrink-0"
            style={{ color: 'rgba(10,46,77,0.35)' }}
          >
            Amount
          </span>
          <span className="text-xs font-semibold f-body" style={{ color: '#0A2E4D' }}>
            €{amountEur.toFixed(2)}
          </span>
        </div>

        {/* Reference */}
        <div className="flex items-center gap-3 px-3 py-2.5">
          <span
            className="text-[10px] uppercase tracking-[0.16em] font-bold f-body w-16 flex-shrink-0"
            style={{ color: 'rgba(10,46,77,0.35)' }}
          >
            Ref
          </span>
          <span
            className="text-xs font-semibold f-body font-mono"
            style={{ color: '#0A2E4D' }}
          >
            {reference}
          </span>
        </div>
      </div>

    </div>
  )
}
