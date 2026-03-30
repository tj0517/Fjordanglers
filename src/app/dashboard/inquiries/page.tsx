import { redirect } from 'next/navigation'

export default function GuideInquiriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  void searchParams
  redirect('/dashboard/bookings?view=action')
}
