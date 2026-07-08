import { notFound } from 'next/navigation'
import { getReviewByToken } from '@/actions/reviews'
import { ReviewForm } from './ReviewForm'

export const metadata = { title: 'Rate your trip — FjordAnglers' }

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const review = await getReviewByToken(token)

  if (review == null) notFound()

  const expired = new Date(review.tokenExpiresAt) < new Date()

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
      <div style={{ maxWidth: '500px', width: '100%' }}>

        <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#E67E50', marginBottom: '10px' }}>
          FjordAnglers
        </p>

        <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#0A2E4D', marginBottom: '4px' }}>
          Rate your trip
        </h1>

        {review.tripTitle != null && (
          <p style={{ fontSize: '15px', color: '#666', marginBottom: '28px' }}>
            {review.tripTitle}
          </p>
        )}

        {review.submittedAt != null ? (
          <div style={{ padding: '20px', background: '#f0fdf4', borderRadius: '12px', border: '1px solid #86efac' }}>
            <p style={{ fontWeight: 700, color: '#16a34a', fontSize: '16px', marginBottom: '4px' }}>
              ✓ Review already submitted
            </p>
            <p style={{ color: '#555', fontSize: '14px' }}>Thank you for your feedback!</p>
          </div>
        ) : expired ? (
          <div style={{ padding: '20px', background: '#fef2f2', borderRadius: '12px', border: '1px solid #fca5a5' }}>
            <p style={{ fontWeight: 600, color: '#dc2626', marginBottom: '4px' }}>This review link has expired.</p>
            <p style={{ color: '#555', fontSize: '14px' }}>Please contact us at contact@fjordanglers.com if you&apos;d still like to leave feedback.</p>
          </div>
        ) : (
          <ReviewForm token={token} />
        )}

      </div>
    </main>
  )
}
