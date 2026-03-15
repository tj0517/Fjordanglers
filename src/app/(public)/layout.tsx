import { HomeNav } from '@/components/home/home-nav'
import { Footer } from '@/components/layout/footer'

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <HomeNav pinned />
      {children}
      <Footer />
    </>
  )
}
