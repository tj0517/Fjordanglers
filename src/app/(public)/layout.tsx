import { Footer } from '@/components/layout/footer'

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Footer />
    </>
  )
}
