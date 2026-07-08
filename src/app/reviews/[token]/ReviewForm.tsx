'use client'

import { useState, useCallback } from 'react'
import { submitReview } from '@/actions/reviews'
import { ReviewMediaUpload } from './ReviewMediaUpload'

export function ReviewForm({ token }: { token: string }) {
  const [rating, setRating]             = useState<number | null>(null)
  const [tripDescription, setTripDesc]  = useState('')
  const [comment, setComment]           = useState('')
  const [mediaUrls, setMediaUrls]       = useState<string[]>([])
  const [uploadBusy, setUploadBusy] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone]             = useState(false)
  const [error, setError]           = useState<string | null>(null)

  const handleMediaChange  = useCallback((urls: string[]) => setMediaUrls(urls), [])
  const handleUploadBusy   = useCallback((busy: boolean) => setUploadBusy(busy), [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (rating == null) {
      setError('Please provide a rating.')
      return
    }
    if (uploadBusy) {
      setError('Some files are still uploading — please wait.')
      return
    }
    setSubmitting(true)
    setError(null)
    const result = await submitReview(token, {
      overallRating:   rating,
      tripDescription: tripDescription.trim() || undefined,
      comment:         comment.trim() || undefined,
      mediaUrls:       mediaUrls.length > 0 ? mediaUrls : undefined,
    })
    if (result.ok) {
      setDone(true)
    } else {
      setError(result.error ?? 'Something went wrong. Please try again.')
    }
    setSubmitting(false)
  }

  if (done) {
    return (
      <div style={{ padding: '24px', background: '#f0fdf4', borderRadius: '14px', border: '1px solid #86efac' }}>
        <p style={{ fontWeight: 700, color: '#16a34a', fontSize: '20px', marginBottom: '8px' }}>
          Thank you for your feedback!
        </p>
        <p style={{ color: '#444', fontSize: '15px', lineHeight: 1.6, margin: 0 }}>
          Your review has been submitted.
          {mediaUrls.length > 0 && ` We received ${mediaUrls.length} photo${mediaUrls.length > 1 ? 's/videos' : '/video'} too — they look amazing.`}
          {' '}We really appreciate you taking the time; it helps us keep improving every trip.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>

      {/* Star rating */}
      <div>
        <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '12px', color: '#111' }}>
          Overall rating <span style={{ color: '#dc2626' }}>*</span>
        </label>
        <div style={{ display: 'flex', gap: '4px' }}>
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              style={{
                fontSize: '34px',
                lineHeight: 1,
                cursor: 'pointer',
                border: 'none',
                background: 'none',
                padding: '0 3px',
                color: rating != null && n <= rating ? '#E67E50' : '#ddd',
                transition: 'color 0.1s',
              }}
            >
              ★
            </button>
          ))}
        </div>
      </div>

      {/* Trip description */}
      <div>
        <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '8px', color: '#111' }}>
          Describe your trip & experience{' '}
          <span style={{ color: '#999', fontWeight: 400 }}>(optional)</span>
        </label>
        <textarea
          value={tripDescription}
          onChange={e => setTripDesc(e.target.value)}
          rows={5}
          placeholder="Tell us about your trip — the location, the fishing, the guide, the moments that stood out…"
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: '8px',
            border: '1px solid #ddd',
            fontSize: '14px',
            fontFamily: 'inherit',
            resize: 'vertical',
            boxSizing: 'border-box',
            outline: 'none',
          }}
        />
      </div>

      {/* Additional notes */}
      <div>
        <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '8px', color: '#111' }}>
          Anything else?{' '}
          <span style={{ color: '#999', fontWeight: 400 }}>(optional)</span>
        </label>
        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          rows={3}
          placeholder="Suggestions, things we could improve, anything you'd like us to know…"
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: '8px',
            border: '1px solid #ddd',
            fontSize: '14px',
            fontFamily: 'inherit',
            resize: 'vertical',
            boxSizing: 'border-box',
            outline: 'none',
          }}
        />
      </div>

      {/* Media upload */}
      <div>
        <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '8px', color: '#111' }}>
          Share your photos & videos{' '}
          <span style={{ color: '#999', fontWeight: 400 }}>(optional)</span>
        </label>
        <p style={{ fontSize: '12px', color: '#aaa', margin: '0 0 10px' }}>
          Full quality — RAW, HEIC, MP4, MOV, anything goes. No size limit.
        </p>
        <ReviewMediaUpload
          token={token}
          onChange={handleMediaChange}
          onBusyChange={handleUploadBusy}
        />
      </div>

      {error != null && (
        <p style={{ color: '#dc2626', fontSize: '13px', margin: 0 }}>{error}</p>
      )}

      <button
        type="submit"
        disabled={submitting || uploadBusy}
        style={{
          background: '#E67E50',
          color: '#fff',
          border: 'none',
          borderRadius: '10px',
          padding: '13px 24px',
          fontSize: '15px',
          fontWeight: 700,
          cursor: submitting || uploadBusy ? 'not-allowed' : 'pointer',
          opacity: submitting || uploadBusy ? 0.65 : 1,
          transition: 'opacity 0.15s',
        }}
      >
        {uploadBusy ? 'Waiting for uploads…' : submitting ? 'Submitting…' : 'Submit review'}
      </button>

    </form>
  )
}
