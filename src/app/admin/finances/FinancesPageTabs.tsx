'use client'

import { useState } from 'react'
import { MonthlyPLClient, type MonthRaw } from './MonthlyPLClient'
import { FinancesClient } from './FinancesClient'
import { PipelineClient, type PipelineDeal } from './PipelineClient'
import type { FixedCostRow } from '@/actions/finances'

type Tab = 'pl' | 'pipeline' | 'costs'

export function FinancesPageTabs({
  months,
  defaultEurRate,
  usdEurRate,
  fixedCosts,
  pipeline,
}: {
  months: MonthRaw[]
  defaultEurRate: number
  usdEurRate: number
  fixedCosts: FixedCostRow[]
  pipeline: PipelineDeal[]
}) {
  const [tab, setTab] = useState<Tab>('pl')

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: 'pl',       label: 'Monthly P&L' },
    { id: 'pipeline', label: 'Pipeline', badge: pipeline.length },
    { id: 'costs',    label: 'Fixed Costs' },
  ]

  return (
    <div>
      {/* Tab strip */}
      <div
        className="flex gap-1 mb-6 p-1 rounded-[14px] w-fit"
        style={{ background: 'rgba(10,46,77,0.06)' }}
      >
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-[11px] text-sm f-body font-medium transition-all"
            style={{
              background: tab === t.id ? '#FDFAF7' : 'transparent',
              color:      tab === t.id ? '#0A2E4D' : 'rgba(10,46,77,0.5)',
              boxShadow:  tab === t.id ? '0 1px 4px rgba(10,46,77,0.1)' : 'none',
            }}
          >
            {t.label}
            {t.badge != null && t.badge > 0 && (
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none"
                style={{ background: '#E67E50', color: '#fff' }}
              >
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'pl'       && <MonthlyPLClient months={months} defaultEurRate={defaultEurRate} />}
      {tab === 'pipeline' && <PipelineClient  deals={pipeline} eurRate={defaultEurRate} usdEurRate={usdEurRate} />}
      {tab === 'costs'    && <FinancesClient  rows={fixedCosts} />}
    </div>
  )
}
