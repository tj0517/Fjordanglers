'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { defaultTabForStatus, type TabId } from '@/lib/ui/defaultTabForStatus'
import type { InquiryStatus } from '@/lib/inquiries/state'

interface Props {
  status:              InquiryStatus
  overviewContent:     React.ReactNode
  conversationContent: React.ReactNode
  briefContent:        React.ReactNode
  guideContent:        React.ReactNode
  offerContent:        React.ReactNode
}

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview',      label: 'Overview' },
  { id: 'conversation',  label: 'Conversation' },
  { id: 'brief',         label: 'Brief' },
  { id: 'guide',         label: 'Guide' },
  { id: 'offer',         label: 'Offer & payment' },
]

export function InquiryDetailTabs({
  status,
  overviewContent,
  conversationContent,
  briefContent,
  guideContent,
  offerContent,
}: Props) {
  const searchParams = useSearchParams()
  const router       = useRouter()

  const tabParam = searchParams.get('tab') as TabId | null
  const validTab = TABS.some(t => t.id === tabParam)
  const activeTab: TabId = validTab && tabParam != null ? tabParam : defaultTabForStatus[status]

  function handleTabChange(value: unknown) {
    const id = value as TabId
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', id)
    router.replace(`?${params.toString()}`, { scroll: false })
  }

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange}>
      <TabsList className="mb-6 h-auto flex-wrap gap-1 bg-muted/70 p-1">
        {TABS.map(tab => (
          <TabsTrigger
            key={tab.id}
            value={tab.id}
            className="px-4 py-2 text-sm font-semibold rounded-lg data-active:bg-primary data-active:text-primary-foreground"
          >
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="overview">
        {overviewContent}
      </TabsContent>

      <TabsContent value="conversation">
        {conversationContent}
      </TabsContent>

      <TabsContent value="brief">
        {briefContent}
      </TabsContent>

      <TabsContent value="guide">
        {guideContent}
      </TabsContent>

      <TabsContent value="offer">
        {offerContent}
      </TabsContent>
    </Tabs>
  )
}
