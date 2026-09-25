'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
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
  // FA-1.33: the initial tab comes from the URL (deep link / reload); after that the tab is client
  // state. Switching never navigates — all five panels are already in the browser — the URL is
  // updated with history.replaceState so ?tab= links and reloads keep working.
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab') as TabId | null
  const validTab = TABS.some(t => t.id === tabParam)
  const initialTab: TabId = validTab && tabParam != null ? tabParam : defaultTabForStatus[status]
  const [activeTab, setActiveTab] = useState<TabId>(initialTab)

  function handleTabChange(value: unknown) {
    const id = value as TabId
    setActiveTab(id)
    const params = new URLSearchParams(window.location.search)
    params.set('tab', id)
    window.history.replaceState(window.history.state, '', `?${params.toString()}`)
  }

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange}>
      {/* FA-1.15 pill style (tj decision, FA-1.33): muted bar, active tab filled Fjord Navy */}
      <TabsList aria-label="Inquiry sections" className="mb-6 h-auto flex-wrap gap-1 bg-muted/70 p-1">
        {TABS.map(tab => (
          <TabsTrigger
            key={tab.id}
            value={tab.id}
            className="flex-none h-auto px-4 py-2 text-sm font-semibold f-body rounded-lg text-muted-foreground data-active:bg-primary data-active:text-primary-foreground"
          >
            {tab.label}
            {tab.id === 'conversation' && conversationCount > 0 && (
              <span className="ml-1.5 px-[7px] py-px rounded-full text-[11px] font-semibold bg-primary/10 text-foreground in-data-active:bg-primary-foreground/20 in-data-active:text-primary-foreground">
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
