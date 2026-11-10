export default function GuideIntakeNotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4"
      style={{ background: '#F8FAFB' }}>
      <div className="max-w-md w-full text-center py-16">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
          style={{ background: 'rgba(10,46,77,0.06)' }}>
          <span className="text-2xl">🔗</span>
        </div>
        <h1 className="text-2xl font-bold f-display mb-3" style={{ color: '#0A2E4D' }}>
          Form not found
        </h1>
        <p className="text-base f-body mb-6" style={{ color: 'rgba(10,46,77,0.55)' }}>
          This link is no longer active or doesn&apos;t exist.
          Please contact FjordAnglers directly if you think this is a mistake.
        </p>
        <a
          href="mailto:contact@fjordanglers.com"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold f-body"
          style={{ background: '#E67E50', color: '#fff' }}
        >
          Contact FjordAnglers
        </a>
      </div>
    </main>
  )
}
