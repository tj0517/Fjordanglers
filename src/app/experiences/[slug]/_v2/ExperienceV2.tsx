/**
 * /experiences/[slug] — template v2 (offer-centric), skeleton only.
 *
 * FA-1.52 puts the router and this placeholder in place; the actual sections
 * arrive in FA-1.53–FA-1.55. Until then it renders nothing but its own name
 * and the slug, so that "flag on + page_version = 2" is visibly v2.
 */

export default function ExperienceV2({ slug }: { slug: string }) {
  return (
    <main className="min-h-screen flex items-center justify-center px-6"
      style={{ background: '#F8FAFB', color: '#0A2E4D' }}>
      <div className="text-center">
        <h1 className="f-display text-3xl">v2 preview</h1>
        <p className="f-body mt-3 text-sm opacity-70">{slug}</p>
      </div>
    </main>
  )
}
