'use client'

/**
 * Two tabs on the admin experience edit page (FA-1.56): the existing page form, untouched,
 * and the "Offer v2" editor. Both panels stay mounted, so switching tabs never throws away
 * what was typed in the other one.
 */

import { useState, type ReactNode } from 'react'
import { useSearchParams } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

type TabId = 'page' | 'v2'

const TABS: { id: TabId; label: string }[] = [
  { id: 'page', label: 'Page' },
  { id: 'v2',   label: 'Offer v2' },
]

export function ExperienceEditTabs({ pageForm, offerV2 }: { pageForm: ReactNode; offerV2: ReactNode }) {
  // Same pattern as the inquiry card (FA-1.33): ?tab= picks the first tab, after that it is
  // client state mirrored into the URL so a reload or a shared link lands on the same tab.
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState<TabId>(searchParams.get('tab') === 'v2' ? 'v2' : 'page')

  function handleTabChange(value: unknown) {
    const id: TabId = value === 'v2' ? 'v2' : 'page'
    setActiveTab(id)
    const params = new URLSearchParams(window.location.search)
    params.set('tab', id)
    window.history.replaceState(window.history.state, '', `?${params.toString()}`)
  }

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange}>
      <TabsList aria-label="Experience page sections" className="mb-6 h-auto flex-wrap gap-1 bg-muted/70 p-1">
        {TABS.map(tab => (
          <TabsTrigger
            key={tab.id}
            value={tab.id}
            className="flex-none h-auto px-4 py-2 text-sm font-semibold f-body rounded-lg text-muted-foreground data-active:bg-primary data-active:text-primary-foreground"
          >
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value="page" keepMounted>{pageForm}</TabsContent>
      <TabsContent value="v2" keepMounted>{offerV2}</TabsContent>
    </Tabs>
  )
}
