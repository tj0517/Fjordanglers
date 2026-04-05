import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function PlanYourTripLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login?next=/plan-your-trip')

  return <>{children}</>
}
