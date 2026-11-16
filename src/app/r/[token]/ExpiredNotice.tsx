/**
 * The one page every refused link gets — wrong, expired, withdrawn or guide removed — so a link
 * holder cannot tell which (FA-M.04). Carries no request detail and no reason.
 */

const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '48698936563'
const WHATSAPP_TEXT = encodeURIComponent('Hi FjordAnglers, my trip request link has expired.')

export const whatsappHref = `https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_TEXT}`

export function ExpiredNotice() {
  return (
    <div className="text-center py-12" data-testid="request-expired">
      <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5"
        style={{ background: 'rgba(10,46,77,0.07)' }}>
        <span className="text-2xl" aria-hidden>🔗</span>
      </div>
      <h1 className="text-2xl font-bold f-display mb-3" style={{ color: '#0A2E4D' }}>
        This link has expired
      </h1>
      <p className="text-base f-body mb-6" style={{ color: 'rgba(10,46,77,0.65)' }}>
        Write to us on WhatsApp and we&apos;ll sort it out.
      </p>
      <a href={whatsappHref} rel="noopener noreferrer" target="_blank"
        className="inline-flex items-center justify-center w-full max-w-xs px-6 py-3.5 rounded-xl text-base font-semibold f-body"
        style={{ background: '#0A2E4D', color: '#fff' }}>
        Write to us on WhatsApp
      </a>
    </div>
  )
}
