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
  /** Messages in the Correspondence thread — shown as a count on the Conversation tab */
  conversationCount:   number
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
  conversationCount,
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
      <TabsList
        variant="line"
        aria-label="Inquiry sections"
        className="mb-5 h-auto w-full justify-start flex-wrap gap-7 rounded-none border-b border-border px-1 p-0"
      >
        {TABS.map(tab => (
          <TabsTrigger
            key={tab.id}
            value={tab.id}
            className="flex-none h-auto rounded-none px-0 py-3 text-sm font-medium f-body text-muted-foreground border-0 border-b-2 border-transparent -mb-px data-active:border-primary data-active:font-bold data-active:text-foreground after:hidden"
          >
            {tab.label}
            {tab.id === 'conversation' && conversationCount > 0 && (
              <span className="ml-1 px-[7px] py-px rounded-full bg-muted text-[11px] font-semibold text-foreground">
                {conversationCount}
              </span>
            )}
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
