/**
 * A hand-drawn salmon line — the one piece of pure decoration on the offer page. It is
 * what keeps the page from reading as a form: a stroke that crosses the layout the way a
 * river crosses a map. Decorative only, so hidden from assistive tech.
 */

export default function OfferSquiggle({ className = '' }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 1200 140"
      fill="none"
      preserveAspectRatio="none"
      className={`pointer-events-none ${className}`}
    >
      <path
        d="M-20 96 C 140 96, 200 18, 330 22 S 520 128, 650 104 S 820 10, 960 26 S 1140 118, 1230 70"
        stroke="var(--fa-salmon)"
        strokeWidth="2.5"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
