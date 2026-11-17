/**
 * The one page every refused connect link gets — wrong, revoked, used or expired — so a link holder
 * cannot tell which (FA-M.09). Carries no guide data and no reason.
 */

const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '48698936563'
const WHATSAPP_TEXT = encodeURIComponent('Hi FjordAnglers, my calendar link no longer works.')

export default function ConnectCalendarNotFound() {
  return (
    <main className="min-h-screen px-5 flex items-center justify-center" style={{ background: '#F8FAFB' }}>
      <div className="w-full max-w-md text-center py-12" data-testid="connect-calendar-invalid">
        <h1 className="text-2xl font-bold f-display mb-3" style={{ color: '#0A2E4D' }}>
          This link no longer works
        </h1>
        <p className="text-base f-body mb-6" style={{ color: 'rgba(10,46,77,0.65)' }}>
          Calendar links work once and for 7 days. Write to us on WhatsApp and we&apos;ll send a new one.
        </p>
        <a href={`https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_TEXT}`} rel="noopener noreferrer" target="_blank"
          className="inline-flex items-center justify-center w-full max-w-xs px-6 py-3.5 rounded-xl text-base font-semibold f-body"
          style={{ background: '#0A2E4D', color: '#fff' }}>
          Write to us on WhatsApp
        </a>
      </div>
    </main>
  )
}
