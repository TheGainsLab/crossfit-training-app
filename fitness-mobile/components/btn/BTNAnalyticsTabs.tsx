import React, { useState } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'

export type TabId = 'performance' | 'effort' | 'quality' | 'heartrate'

interface Tab {
  id: TabId
  label: string
  icon: string
}

const tabs: Tab[] = [
  { id: 'performance', label: 'Performance', icon: '📊' },
  { id: 'effort', label: 'Effort', icon: '💪' },
  { id: 'quality', label: 'Quality', icon: '⭐' },
  { id: 'heartrate', label: 'Heart Rate', icon: '❤️' },
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
      {/* Tab Navigation */}
      <View style={styles.tabBarContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabBar}
        >
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              style={[
                styles.tab,
                activeTab === tab.id && styles.tabActive
              ]}
            >
              <Text style={styles.tabIcon}>{tab.icon}</Text>
              <Text style={[
                styles.tabLabel,
                activeTab === tab.id && styles.tabLabelActive
              ]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
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
    paddingVertical: 8,
  },
  tabBar: {
    paddingHorizontal: 8,
    gap: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    marginRight: 8,
    minWidth: 100,
    gap: 6,
  },
  tabActive: {
    backgroundColor: '#FE5858',
  },
  tabIcon: {
    fontSize: 16,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  tabLabelActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  content: {
    minHeight: 400,
  },
})















