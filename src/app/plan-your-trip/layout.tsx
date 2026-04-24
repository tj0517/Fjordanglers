import { Footer } from '@/components/layout/footer'

export default function PlanYourTripLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Footer />
    </>
  )
}
