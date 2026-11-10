export default function OfferNotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4"
      style={{ background: '#F8FAFB' }}>
      <div className="max-w-md w-full text-center py-16">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
          style={{ background: 'rgba(239,68,68,0.1)' }}>
          <span className="text-2xl">🔗</span>
        </div>
        <h1 className="text-2xl font-bold f-display mb-3" style={{ color: '#0A2E4D' }}>
          Offer not found
        </h1>
        <p className="text-base f-body mb-6" style={{ color: 'rgba(10,46,77,0.6)' }}>
          This offer link has expired or is no longer valid.
          Please contact us and we&apos;ll send you a fresh one.
        </p>
        <a href="mailto:contact@fjordanglers.com"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold f-body"
          style={{ background: '#E67E50', color: '#fff' }}>
          Contact FjordAnglers
        </a>
      </div>
    </main>
  )
}
