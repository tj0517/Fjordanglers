import { SiteNav } from '@/components/layout/nav'
import { SiteFooter } from '@/components/layout/footer'

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteNav />
      {children}
      <SiteFooter />
    </>
  )
}
