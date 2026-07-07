import { NavWithUser } from '@/components/layout/nav-with-user'
import { SiteFooter } from '@/components/layout/footer'

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <NavWithUser />
      {children}
      <SiteFooter />
    </>
  )
}
