'use client'

import React, { useState } from 'react'

type TabId = 'performance' | 'effort' | 'quality' | 'heartrate'

interface Tab {
  id: TabId
  label: string
  icon: string
}

const tabs: Tab[] = [
  { id: 'performance', label: 'Performance', icon: '📊' },
  { id: 'effort', label: 'Effort', icon: '💪' },
  { id: 'quality', label: 'Quality', icon: '⭐' },
  { id: 'heartrate', label: 'Heart Rate', icon: '❤️' }
]

interface MetConAnalyticsTabsProps {
  children: (activeTab: TabId) => React.ReactNode
  defaultTab?: TabId
}

export default function MetConAnalyticsTabs({ children, defaultTab = 'performance' }: MetConAnalyticsTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>(defaultTab)

  return (
    <div className="space-y-4">
      {/* Mobile-First Tab Navigation */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 pb-2">
        <div className="flex overflow-x-auto scrollbar-hide -mx-4 px-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-shrink-0 px-4 py-3 mx-1 rounded-lg font-medium text-sm transition-all min-w-[100px] ${
                activeTab === tab.id
                  ? 'bg-[#FE5858] text-white shadow-md'
                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
              }`}
            >
              <div className="flex flex-col items-center gap-1">
                <span className="text-lg">{tab.icon}</span>
                <span>{tab.label}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {children(activeTab)}
      </div>
    </div>
  )
}

