export default function ReviewNotFound() {
  return (
    <main style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      fontFamily: 'system-ui, sans-serif',
      background: '#fafaf9',
    }}>
      <div style={{ maxWidth: '460px', width: '100%', textAlign: 'center' }}>
        <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#E67E50', marginBottom: '16px' }}>
          FjordAnglers
        </p>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#0A2E4D', marginBottom: '10px' }}>
          Review link not found
        </h1>
        <p style={{ fontSize: '15px', color: '#666', lineHeight: 1.6, margin: 0 }}>
          This review link is invalid or has already expired.<br />
          Contact us at{' '}
          <a href="mailto:contact@fjordanglers.com" style={{ color: '#E67E50' }}>
            contact@fjordanglers.com
          </a>
          {' '}and we&apos;ll sort it out.
        </p>
      </div>
    </main>
  )
}
