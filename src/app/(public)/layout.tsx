import { NavWithUser } from '@/components/layout/nav-with-user'
import { SiteFooter } from '@/components/layout/footer'

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <NavWithUser />
      {children}
      {/* This layout covers /blog, /guides and /guides/[id] — a single guide can be
          non-Nordic and the layout has no access to that per-page data. Neutral is
          never wrong; the Nordic-flavoured line would be, for a Patagonia guide. */}
      <SiteFooter neutralTagline />
    </>
  )
}
