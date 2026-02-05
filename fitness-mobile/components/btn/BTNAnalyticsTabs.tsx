import React, { useState } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'

export type TabId = 'performance' | 'effort' | 'quality' | 'heartrate'

interface Tab {
  id: TabId
  label: string
  icon: string
}

const tabs: Tab[] = [
  { id: 'performance', label: 'Performance', icon: '' },
  { id: 'effort', label: 'Effort', icon: '' },
  { id: 'quality', label: 'Quality', icon: '' },
  { id: 'heartrate', label: 'Heart Rate', icon: '' },
]

interface BTNAnalyticsTabsProps {
  children: (activeTab: TabId) => React.ReactNode
  defaultTab?: TabId
}

export default function BTNAnalyticsTabs({ 
  children, 
  defaultTab = 'performance' 
}: BTNAnalyticsTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>(defaultTab)

  return (
    <View style={styles.container}>
      {/* Tab Navigation - 2x2 Grid */}
      <View style={styles.tabBarContainer}>
        <View style={styles.tabGrid}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              style={[
                styles.tab,
                activeTab === tab.id && styles.tabActive
              ]}
            >
              <Text style={[
                styles.tabLabel,
                activeTab === tab.id && styles.tabLabelActive
              ]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Tab Content */}
      <View style={styles.content}>
        {children(activeTab)}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  tabBarContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  tabGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    width: '47%', // Slightly less than 50% to account for gap
    minHeight: 48,
  },
  tabActive: {
    backgroundColor: '#FE5858',
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    textAlign: 'center',
  },
  tabLabelActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  content: {
    minHeight: 400,
  },
})























