'use client'

/**
 * LoadingOverlay — frosted-glass spinner overlay for cards and form sections.
 *
 * Usage: place inside a `relative` container.
 *   <div className="relative">
 *     {isPending && <LoadingOverlay />}
 *     ...content...
 *   </div>
 *
 * Pass `rounded` to match the container's border-radius class
 * (default "rounded-2xl"). Use "rounded-none" for full-page forms.
 */
export function LoadingOverlay({ rounded = 'rounded-2xl' }: { rounded?: string }) {
  return (
    <div
      className={`absolute inset-0 z-20 flex items-center justify-center ${rounded}`}
      style={{ background: 'rgba(253,250,247,0.8)', backdropFilter: 'blur(2px)' }}
    >
      <svg
        className="animate-spin"
        width="32"
        height="32"
        viewBox="0 0 32 32"
        fill="none"
        style={{ color: '#E67E50' }}
      >
        <circle cx="16" cy="16" r="13" stroke="rgba(10,46,77,0.1)" strokeWidth="3" />
        <path
          d="M16 3 A13 13 0 0 1 29 16"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
    </div>
  )
}
