import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Dimensions,
  StyleSheet,
  Modal,
} from 'react-native'
import { useRouter } from 'expo-router'
import { createClient } from '@/lib/supabase/client'
import {
  fetchRecentActivity,
  fetchDashboardData,
  fetchSkillsAnalytics,
  fetchStrengthAnalytics,
  fetchTechnicalWorkAnalytics,
  fetchAccessoriesAnalytics,
  fetchMetConAnalytics,
  fetchEngineAnalytics,
  fetchMovementSessionHistory,
  RecentSession,
  SkillData,
  StrengthMovement,
  SessionHistoryRow,
} from '@/lib/api/analytics'
import { Card } from '@/components/ui/Card'
import { StatCard } from '@/components/ui/StatCard'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { Button } from '@/components/ui/Button'
import MovementAnalyticsChart from '@/components/analytics/MovementAnalyticsChart'
import SkillsAnalyticsChart from '@/components/analytics/SkillsAnalyticsChart'
import MetConHeatMap from '@/components/analytics/MetConHeatMap'
import { EngineTab as EngineAnalyticsTab } from '@/components/engine/EngineAnalyticsViews'

const screenWidth = Dimensions.get('window').width

type TabType = 'overview' | 'skills' | 'strength' | 'technical' | 'accessories' | 'metcons' | 'engine'

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6FBFE',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    marginTop: 16,
    color: '#4B5563',
  },
  header: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  headerWithBack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  backButton: {
    paddingVertical: 4,
    paddingRight: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: '#FE5858',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333333',
    flex: 1,
  },
  tabsContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderBottomWidth: 2,
  },
  tabActive: {
    borderBottomColor: '#FE5858',
  },
  tabInactive: {
    borderBottomColor: 'transparent',
  },
  tabText: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#FE5858',
  },
  tabTextInactive: {
    color: '#4B5563',
  },
  categoryGridContainer: {
    backgroundColor: '#F6FBFE',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 16,
  },
  categorySectionHeader: {
    marginBottom: 12,
    alignItems: 'center',
  },
  categorySectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#282B34',
    marginBottom: 4,
    textAlign: 'center',
  },
  categorySectionSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  categoryGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  categoryColumn: {
    flex: 1,
    gap: 8,
  },
  categoryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#282B34',
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  categoryCardActive: {
    borderColor: '#FE5858',
    borderWidth: 2,
  },
  categoryCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#282B34',
    marginBottom: 2,
  },
  categoryCardCount: {
    fontSize: 16,
    color: '#282B34',
  },
  categoryCardCountNumber: {
    color: '#FE5858',
    fontWeight: '700',
  },
  contentBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    backgroundColor: '#FE5858',
    borderWidth: 1,
    borderColor: '#282B34',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  contentBackButtonText: {
    fontSize: 14,
    color: '#F6FBFE',
    fontWeight: '600',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  sectionGap: {
    gap: 16,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statCardWrapper: {
    flex: 1,
    minWidth: 0,
    marginBottom: 16,
  },
  trendSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  trendText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  filterScrollContainer: {
    paddingRight: 8,
    marginBottom: 20,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 9999,
  },
  filterButtonActive: {
    backgroundColor: '#FE5858',
  },
  filterButtonInactive: {
    backgroundColor: '#FFFFFF',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
  },
  filterButtonTextInactive: {
    color: '#1F2937',
  },
  emptyState: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyStateText: {
    color: '#4B5563',
    textAlign: 'center',
  },
  activityList: {
    gap: 12,
  },
  activityCardHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 12,
    marginBottom: 12,
  },
  activityDate: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333333',
  },
  activityMeta: {
    fontSize: 14,
    fontWeight: '700',
    color: '#282B34',
  },
  activityCount: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FE5858',
  },
  activitySessionType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FE5858',
  },
  activityExercises: {
    marginBottom: 12,
  },
  activityExercisesText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  activityBlocks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  blockBadge: {
    backgroundColor: '#C4E2EA',
    borderWidth: 0,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  blockBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#282B34',
  },
  blockBadgeCount: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FE5858',
  },
  skillsSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  skillsStat: {
    alignItems: 'center',
  },
  skillsStatValue: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FE5858',
    marginBottom: 4,
  },
  skillsStatLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  chartSection: {
    marginBottom: 24,
  },
  chartTitle: {
    fontWeight: '500',
    color: '#111827',
    marginBottom: 12,
  },
  chartTitleHighlight: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FE5858',
  },
  skillsList: {
    gap: 12,
  },
  skillCardHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginBottom: 12,
    position: 'relative',
  },
  skillCardTitle: {
    flex: 1,
    marginRight: 8,
    alignItems: 'center',
  },
  skillName: {
    fontWeight: '700',
    color: '#333333',
    fontSize: 16,
    marginBottom: 4,
    textAlign: 'center',
  },
  skillRepCount: {
    fontWeight: '700',
    color: '#FE5858',
    fontSize: 16,
  },
  skillIntakeLevel: {
    fontSize: 14,
    color: '#4B5563',
    fontStyle: 'italic',
  },
  repBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  repBadgeBlue: {
    backgroundColor: '#DBEAFE',
  },
  repBadgeYellow: {
    backgroundColor: '#FEF3C7',
  },
  repBadgeGray: {
    backgroundColor: '#F3F4F6',
  },
  repBadgeOrange: {
    backgroundColor: '#FED7AA',
  },
  repBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  skillStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  skillStatItem: {
    width: '48%',
    marginBottom: 12,
  },
  skillStatLabel: {
    color: '#4B5563',
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  skillStatValue: {
    fontWeight: '700',
    color: '#333333',
    fontSize: 16,
  },
  qualityGradeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  qualityGradeBox: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#FE5858',
  },
  qualityGradeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  expandButton: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  expandButtonText: {
    textAlign: 'center',
    color: '#FE5858',
    fontSize: 14,
    fontWeight: '600',
  },
  historySection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 8,
  },
  historyCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  historyDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
  },
  historyMeta: {
    fontSize: 12,
    fontWeight: '500',
    color: '#4B5563',
  },
  historySets: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
    marginBottom: 4,
  },
  historyNotes: {
    fontSize: 12,
    color: '#4B5563',
    marginTop: 8,
    fontStyle: 'italic',
  },
  strengthChartSection: {
    marginBottom: 24,
  },
  strengthChartTitle: {
    fontWeight: '500',
    color: '#111827',
    marginBottom: 12,
  },
  movementsList: {
    gap: 12,
  },
  movementCardTitle: {
    fontWeight: '700',
    color: '#333333',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 16,
  },
  movementStats: {
    gap: 12,
  },
  movementStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  movementStatLabel: {
    color: '#4B5563',
    fontSize: 14,
    fontWeight: '500',
  },
  movementStatValue: {
    fontWeight: '700',
    color: '#333333',
  },
  movementStatValueTeal: {
    fontWeight: '700',
    color: '#0D9488',
  },
  movementStatValueOrange: {
    fontWeight: '700',
    color: '#EA580C',
  },
  noDataContainer: {
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  noDataCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    padding: 24,
  },
  noDataTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  noDataText: {
    color: '#4B5563',
  },
  heatmapHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#C4E2EA',
    borderBottomWidth: 2,
    borderBottomColor: '#282B34',
  },
  heatmapHeaderCell: {
    width: 80,
    padding: 12,
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heatmapExerciseHeaderCell: {
    width: 120,
    padding: 12,
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heatmapExerciseAvgHeaderCell: {
    width: 80,
    padding: 12,
    borderLeftWidth: 2,
    borderLeftColor: '#282B34',
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#C4E2EA',
  },
  heatmapHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#282B34',
    textAlign: 'center',
  },
  heatmapRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    minHeight: 60,
    alignItems: 'stretch',
  },
  heatmapExerciseCell: {
    width: 120,
    padding: 12,
    backgroundColor: '#F6FBFE',
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  heatmapExerciseText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#282B34',
    flexWrap: 'wrap',
    flexShrink: 1,
  },
  heatmapCell: {
    width: 80,
    padding: 4,
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
  },
  heatmapExerciseAvgCell: {
    width: 80,
    padding: 4,
    borderLeftWidth: 2,
    borderLeftColor: '#282B34',
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
  },
  heatmapCellContent: {
    borderRadius: 6,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 60,
    height: 60,
  },
  heatmapCellValue: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  heatmapCellSessions: {
    fontSize: 10,
    marginTop: 2,
    opacity: 0.8,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333333',
    flex: 1,
  },
  modalCloseButton: {
    padding: 4,
  },
  modalCloseText: {
    fontSize: 24,
    color: '#4B5563',
    fontWeight: '300',
  },
  sessionHistoryTable: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    overflow: 'hidden',
  },
  sessionHistoryHeader: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  sessionHistoryHeaderCell: {
    padding: 12,
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
    flex: 1,
  },
  sessionHistoryHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    textAlign: 'center',
  },
  sessionHistoryRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  sessionHistoryRowOdd: {
    backgroundColor: '#F9FAFB',
  },
  sessionHistoryCell: {
    padding: 12,
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
    flex: 1,
    justifyContent: 'center',
  },
  sessionHistoryCellText: {
    fontSize: 14,
    color: '#374151',
    textAlign: 'center',
  },
  sessionHistoryDateCell: {
    flex: 1.2,
  },
  sessionHistoryDateText: {
    fontSize: 14,
    color: '#374151',
    textAlign: 'left',
  },
  sessionHistoryEmpty: {
    padding: 24,
    alignItems: 'center',
  },
  sessionHistoryEmptyText: {
    fontSize: 14,
    color: '#6B7280',
  },
})

export default function ProgressPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [userId, setUserId] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [isAppliedPower, setIsAppliedPower] = useState(false)
  const [isEngine, setIsEngine] = useState(false)

  // Data states
  const [recentActivity, setRecentActivity] = useState<RecentSession[]>([])
  const [dashboardData, setDashboardData] = useState<any>(null)
  const [skillsData, setSkillsData] = useState<any>(null)
  const [strengthData, setStrengthData] = useState<any>(null)
  const [technicalData, setTechnicalData] = useState<any>(null)
  const [accessoriesData, setAccessoriesData] = useState<any>(null)
  const [metconData, setMetconData] = useState<any>(null)
  const [engineData, setEngineData] = useState<any>(null)
  const [activityFilter, setActivityFilter] = useState<number | null>(5)

  useEffect(() => {
    loadUser()
  }, [])

  useEffect(() => {
    if (userId) {
      loadTabData(activeTab)
    }
  }, [userId, activeTab])

  // Redirect Applied Power users away from invalid tabs
  useEffect(() => {
    if (isAppliedPower && (activeTab === 'skills' || activeTab === 'metcons' || activeTab === 'engine')) {
      setActiveTab('overview')
    }
  }, [isAppliedPower, activeTab])

  // Reload recent activity when filter changes (only on overview tab)
  useEffect(() => {
    if (userId && activeTab === 'overview') {
      const loadRecentActivity = async () => {
        try {
          const activity = await fetchRecentActivity(
            userId, 
            activityFilter === null ? 100 : activityFilter
          )
          setRecentActivity(activity)
        } catch (error) {
          console.error('Error reloading recent activity:', error)
        }
      }
      loadRecentActivity()
    }
  }, [activityFilter, userId, activeTab])

  const loadUser = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/auth/signin')
        return
      }

      const { data: userData } = await supabase
        .from('users')
        .select('id, subscription_tier')
        .eq('auth_id', user.id)
        .single()

      if (userData) {
        setUserId((userData as { id: number }).id)
        
        // Check for NULL subscription_tier - block access if missing
        if (!(userData as any).subscription_tier) {
          console.error('❌ User missing subscription_tier for analytics access')
          Alert.alert(
            'Subscription Required',
            'Please subscribe to access analytics.',
            [{ text: 'View Plans', onPress: () => router.replace('/subscriptions') }]
          )
          setLoading(false)
          router.replace('/subscriptions')
          return
        }
        
        // Check subscription tier for analytics filtering
        // isEngine should ONLY be true for standalone Engine users
        // Premium/Full-Program users should have both false to see all analytics blocks
        const subscriptionTier = (userData as any).subscription_tier.toUpperCase().trim()

        // BTN users should use the dedicated BTN analytics page
        if (subscriptionTier === 'BTN') {
          router.replace('/btn/analytics')
          return
        }

        if (subscriptionTier === 'APPLIED_POWER') {
          setIsAppliedPower(true)
        } else if (subscriptionTier === 'ENGINE') {
          setIsEngine(true)
        }
      }
    } catch (error) {
      console.error('Error loading user:', error)
      Alert.alert('Error', 'Failed to load user data')
    } finally {
      setLoading(false)
    }
  }

  const loadTabData = async (tab: TabType) => {
    if (!userId) return

    try {
      if (tab === 'overview') {
        // Preload category data based on subscription tier
        const promises: Promise<any>[] = [
          fetchRecentActivity(userId, activityFilter === null ? 100 : activityFilter),
          fetchDashboardData(userId),
        ]
        
        // Applied Power: Only Strength, Technical, Accessories
        if (!isAppliedPower) {
          promises.push(fetchSkillsAnalytics(userId, 90))
        }
        promises.push(fetchStrengthAnalytics(userId, 90))
        promises.push(fetchTechnicalWorkAnalytics(userId, 90))
        promises.push(fetchAccessoriesAnalytics(userId, 90))
        if (!isAppliedPower) {
          promises.push(fetchMetConAnalytics(userId))
        }
        // Engine analytics only for Engine or Premium users (not Applied Power)
        if (!isAppliedPower) {
          promises.push(fetchEngineAnalytics(userId))
        }
        
        const results = await Promise.all(promises)
        let resultIndex = 0
        
        setRecentActivity(results[resultIndex++])
        setDashboardData(results[resultIndex++])
        
        if (!isAppliedPower) {
          setSkillsData(results[resultIndex++])
        }
        setStrengthData(results[resultIndex++])
        setTechnicalData(results[resultIndex++])
        setAccessoriesData(results[resultIndex++])
        if (!isAppliedPower) {
          setMetconData(results[resultIndex++])
          setEngineData(results[resultIndex++])
        }
      } else if (tab === 'skills') {
        // Applied Power users shouldn't access this tab, but handle gracefully
        if (!isAppliedPower && !skillsData) {
          const data = await fetchSkillsAnalytics(userId, 90)
          setSkillsData(data)
        }
      } else if (tab === 'strength') {
        if (!strengthData) {
          const data = await fetchStrengthAnalytics(userId, 90)
          setStrengthData(data)
        }
      } else if (tab === 'technical') {
        if (!technicalData) {
          const data = await fetchTechnicalWorkAnalytics(userId, 90)
          setTechnicalData(data)
        }
      } else if (tab === 'accessories') {
        if (!accessoriesData) {
          const data = await fetchAccessoriesAnalytics(userId, 90)
          setAccessoriesData(data)
        }
      } else if (tab === 'metcons') {
        // Applied Power users shouldn't access this tab, but handle gracefully
        if (!isAppliedPower && !metconData) {
          const data = await fetchMetConAnalytics(userId)
          setMetconData(data)
        }
      } else if (tab === 'engine') {
        // Engine analytics only for Engine or Premium users (not Applied Power)
        if (!isAppliedPower && !engineData) {
          const data = await fetchEngineAnalytics(userId)
          setEngineData(data)
        }
      }
    } catch (error) {
      console.error(`Error loading ${tab} data:`, error)
    }
  }

  const onRefresh = async () => {
    setRefreshing(true)
    await loadTabData(activeTab)
    setRefreshing(false)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const today = new Date()
    const diffTime = Math.abs(today.getTime() - date.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays === 1) return 'Yesterday'
    if (diffDays === 2) return '2 days ago'
    if (diffDays <= 7) return `${diffDays} days ago`

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving':
        return '↗️'
      case 'declining':
        return '↘️'
      default:
        return '➡️'
    }
  }

  // Calculate task counts for each category
  // Counts unique (exercise, session) pairs - each exercise on each unique day counts as 1
  // Multiple sets of same exercise on same day = 1
  // Same exercise on different day = counts again
  const getTaskCount = (category: TabType): number => {
    // Helper to count unique (exercise, session) pairs from movements data
    const countUniqueExerciseSessions = (movements: Record<string, any> | undefined): number => {
      if (!movements) return 0
      let count = 0
      Object.values(movements).forEach((movement: any) => {
        if (movement.sessions) {
          // Count unique (week, day) combinations for this exercise
          const uniqueSessions = new Set(
            movement.sessions.map((s: any) => `W${s.week || 0}D${s.day || 0}`)
          )
          count += uniqueSessions.size
        }
      })
      return count
    }

    switch (category) {
      case 'skills':
        return countUniqueExerciseSessions(skillsData?.skillsAnalysis?.skills)
      case 'strength':
        return countUniqueExerciseSessions(strengthData?.strengthAnalysis?.movements)
      case 'technical':
        return countUniqueExerciseSessions(technicalData?.technicalWorkAnalysis?.movements)
      case 'accessories':
        return countUniqueExerciseSessions(accessoriesData?.accessoriesAnalysis?.movements)
      case 'metcons':
        // Sum all session_counts to get total task entries across all MetCon completions
        // Each exercise in each MetCon counts as 1 task (not unique - pullups in 3 MetCons = 3 tasks)
        if (!metconData?.heatmapCells) return 0
        return metconData.heatmapCells.reduce((sum: number, c: any) => sum + (c.session_count || 0), 0)
      case 'engine':
        return engineData?.sessions?.length || 0
      default:
        return 0
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#333333" />
        <Text style={styles.loadingText}>Loading progress...</Text>
      </View>
    )
  }

  // Helper function to get category display name
  const getCategoryName = (tab: TabType): string => {
    switch (tab) {
      case 'technical':
        return 'Technical Work'
      case 'metcons':
        return 'MetCons'
      default:
        return tab.charAt(0).toUpperCase() + tab.slice(1)
    }
  }

  return (
    <View style={[styles.container, { flex: 1 }]}>
      {/* Content */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Back button - only show when NOT on overview AND NOT on engine tab (engine has its own back logic) */}
        {activeTab !== 'overview' && activeTab !== 'engine' && (
          <TouchableOpacity 
            onPress={() => setActiveTab('overview')}
            style={styles.contentBackButton}
            activeOpacity={0.7}
          >
            <Text style={styles.contentBackButtonText}>← Back</Text>
          </TouchableOpacity>
        )}
        
        {activeTab === 'overview' && (
          <OverviewTab
            recentActivity={recentActivity}
            dashboardData={dashboardData}
            activityFilter={activityFilter}
            setActivityFilter={setActivityFilter}
            formatDate={formatDate}
            getTrendIcon={getTrendIcon}
            userId={userId}
            router={router}
            isAppliedPower={isAppliedPower}
            isEngine={isEngine}
            getTaskCount={getTaskCount}
            setActiveTab={setActiveTab}
          />
        )}
        {activeTab === 'skills' && !isAppliedPower && (
          <SkillsTab skillsData={skillsData} userId={userId} />
        )}
        {activeTab === 'strength' && (
          <StrengthTab strengthData={strengthData} userId={userId} />
        )}
        {activeTab === 'technical' && (
          <TechnicalWorkTab technicalData={technicalData} userId={userId} />
        )}
        {activeTab === 'accessories' && (
          <AccessoriesTab accessoriesData={accessoriesData} userId={userId} />
        )}
        {activeTab === 'metcons' && !isAppliedPower && <MetConTab metconData={metconData} />}
          {activeTab === 'engine' && !isAppliedPower && <EngineAnalyticsTab engineData={engineData} userId={userId} onBackToOverview={() => setActiveTab('overview')} />}
      </ScrollView>
    </View>
  )
}


// Overview Tab Component
function OverviewTab({
  recentActivity,
  dashboardData,
  activityFilter,
  setActivityFilter,
  formatDate,
  getTrendIcon,
  userId,
  router,
  isAppliedPower,
  isEngine,
  getTaskCount,
  setActiveTab,
}: {
  recentActivity: RecentSession[]
  dashboardData: any
  activityFilter: number | null
  setActivityFilter: (filter: number | null) => void
  formatDate: (date: string) => string
  getTrendIcon: (trend: string) => string
  userId: number | null
  router: any
  isAppliedPower: boolean
  isEngine: boolean
  getTaskCount: (category: TabType) => number
  setActiveTab: (tab: TabType) => void
}) {
  return (
    <View style={styles.sectionGap}>
      {/* Dashboard Stats */}
      {dashboardData && (
        <View style={{ marginTop: 8 }}>
          {isAppliedPower ? (
            // Applied Power users: Only show Tasks Complete
            <View style={[styles.statsRow, { justifyContent: 'center' }]}>
              <View style={styles.statCardWrapper}>
                <StatCard
                  label="Tasks Complete"
                  value={dashboardData.totalExercises}
                />
              </View>
            </View>
          ) : (
            // Other users: Show all three stats
          <View style={styles.statsRow}>
            <View style={styles.statCardWrapper}>
              <StatCard
                label="MetCons Complete"
                value={dashboardData.metconsCompleted}
              />
            </View>
            <View style={styles.statCardWrapper}>
              <StatCard
                label="Tasks Complete"
                value={dashboardData.totalExercises}
              />
            </View>
            <View style={styles.statCardWrapper}>
              <StatCard
                label="Fitness Score"
                value={dashboardData.fitnessScore !== null ? `${dashboardData.fitnessScore}%` : '—'}
              />
            </View>
          </View>
          )}
        </View>
      )}

      {/* Segment Summary - removed per design update */}

      {/* Category Cards Grid */}
      <View style={styles.categoryGridContainer}>
        <View style={styles.categorySectionHeader}>
          <Text style={styles.categorySectionTitle}>Training Categories</Text>
          <Text style={styles.categorySectionSubtitle}>Tap to explore detailed analytics</Text>
        </View>
        <View style={styles.categoryGrid}>
          {/* Left Column */}
          <View style={styles.categoryColumn}>
            {/* Skills button - hide for Applied Power and Engine users */}
            {!isAppliedPower && !isEngine && (
            <TouchableOpacity
              style={styles.categoryCard}
              onPress={() => setActiveTab('skills')}
              activeOpacity={0.7}
            >
              <Text style={styles.categoryCardCount}>
                <Text style={styles.categoryCardCountNumber}>{getTaskCount('skills')}</Text> Skills
              </Text>
            </TouchableOpacity>
            )}
            
            {/* Technical button - show for Applied Power and Premium, hide for Engine */}
            {!isEngine && (
            <TouchableOpacity
              style={styles.categoryCard}
              onPress={() => setActiveTab('technical')}
              activeOpacity={0.7}
            >
              <Text style={styles.categoryCardCount}>
                <Text style={styles.categoryCardCountNumber}>{getTaskCount('technical')}</Text> Technical
              </Text>
            </TouchableOpacity>
            )}
            
            {/* Strength button - show for Applied Power and Premium, hide for Engine */}
            {!isEngine && (
            <TouchableOpacity
              style={styles.categoryCard}
              onPress={() => setActiveTab('strength')}
              activeOpacity={0.7}
            >
              <Text style={styles.categoryCardCount}>
                <Text style={styles.categoryCardCountNumber}>{getTaskCount('strength')}</Text> Strength
              </Text>
            </TouchableOpacity>
            )}
          </View>
          
          {/* Right Column */}
          <View style={styles.categoryColumn}>
            {/* Accessories button - show for Applied Power and Premium, hide for Engine */}
            {!isEngine && (
            <TouchableOpacity
              style={styles.categoryCard}
              onPress={() => setActiveTab('accessories')}
              activeOpacity={0.7}
            >
              <Text style={styles.categoryCardCount}>
                <Text style={styles.categoryCardCountNumber}>{getTaskCount('accessories')}</Text> Accessories
              </Text>
            </TouchableOpacity>
            )}
            
            {/* MetCons button - hide for Applied Power and Engine users */}
            {!isAppliedPower && !isEngine && (
            <TouchableOpacity
              style={styles.categoryCard}
              onPress={() => setActiveTab('metcons')}
              activeOpacity={0.7}
            >
              <Text style={styles.categoryCardCount}>
                <Text style={styles.categoryCardCountNumber}>{getTaskCount('metcons')}</Text> MetCons
              </Text>
            </TouchableOpacity>
            )}
            
            {/* Engine button - hide for Applied Power, show for Engine and Premium */}
            {!isAppliedPower && (
            <TouchableOpacity
              style={styles.categoryCard}
              onPress={() => setActiveTab('engine')}
              activeOpacity={0.7}
            >
              <Text style={styles.categoryCardCount}>
                <Text style={styles.categoryCardCountNumber}>{getTaskCount('engine')}</Text> Engine
              </Text>
            </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* Recent Activity */}
      <SectionHeader title="Recent Training Activity" />
      
      {/* Filter Buttons */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterScrollContainer}
      >
        <View style={styles.filterRow}>
          {[5, 10, 25, null].map((count) => (
            <TouchableOpacity
              key={count ?? 'all'}
              onPress={() => setActivityFilter(count)}
              activeOpacity={0.7}
              style={[
                styles.filterButton,
                activityFilter === count
                  ? styles.filterButtonActive
                  : styles.filterButtonInactive,
              ]}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  activityFilter === count
                    ? styles.filterButtonTextActive
                    : styles.filterButtonTextInactive,
                ]}
              >
                {count === null ? 'All Time' : `Last ${count}`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {recentActivity.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>
            No recent training sessions found. Complete some exercises to see
            your activity here!
          </Text>
        </View>
      ) : (
        <View style={styles.activityList}>
          {recentActivity.map((session, index) => (
            <TouchableOpacity
              key={session.sessionKey || index}
              onPress={() => {
                if (session.programId) {
                  router.push(
                    `/session-review/${userId}-${session.programId}-${session.week}-${session.day}`
                  )
                }
              }}
              activeOpacity={0.7}
            >
              <Card>
                <View style={styles.activityCardHeader}>
                  <Text style={styles.activityMeta}>
                    Week {session.week} • Day {session.day}{' '}
                    <Text style={styles.activityCount}>({session.totalExercises})</Text>
                  </Text>
                </View>
                <View style={styles.activityBlocks}>
                  {session.blocks.map((block, idx) => (
                    <View
                      key={idx}
                      style={styles.blockBadge}
                    >
                      <Text style={styles.blockBadgeText}>
                        {block.blockName} <Text style={styles.blockBadgeCount}>({block.exerciseCount})</Text>
                      </Text>
                    </View>
                  ))}
                </View>
              </Card>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  )
}

// Skills Tab Component
function SkillsTab({
  skillsData,
  userId,
}: {
  skillsData: any
  userId: number | null
}) {
  if (!skillsData?.skillsAnalysis?.skills) {
    return (
      <View style={styles.noDataContainer}>
        <View style={styles.noDataCard}>
          <Text style={styles.noDataTitle}>
            Skills Development
          </Text>
          <Text style={styles.noDataText}>
            No skills movement data available yet. Complete more skills
            exercises to see detailed analytics!
          </Text>
        </View>
      </View>
    )
  }

  const skillsArray = Object.values(skillsData.skillsAnalysis.skills) as SkillData[]

  return (
    <View style={styles.sectionGap}>
      {/* Summary Stats */}
      <View style={[styles.statsRow, { marginTop: 8 }]}>
        <View style={styles.statCardWrapper}>
          <StatCard label="Skills Practiced" value={skillsArray.length} />
        </View>
        <View style={styles.statCardWrapper}>
          <StatCard label="Grade A Skills" value={skillsArray.filter((s) => s.qualityGrade === 'A').length} />
        </View>
      </View>

      {/* Skills Chart */}
      <SkillsAnalyticsChart skills={skillsArray} userId={userId} />
    </View>
  )
}

// Skill Card Component
function SkillCard({ skill }: { skill: SkillData }) {
  const [expanded, setExpanded] = useState(false)

  const getRepBadge = (totalReps: number) => {
    if (totalReps >= 2000) return { emoji: '💎', text: 'Diamond', colorStyle: styles.repBadgeBlue }
    if (totalReps >= 1000) return { emoji: '🥇', text: 'Gold', colorStyle: styles.repBadgeYellow }
    if (totalReps >= 500) return { emoji: '🥈', text: 'Silver', colorStyle: styles.repBadgeGray }
    if (totalReps >= 200) return { emoji: '🥉', text: 'Bronze', colorStyle: styles.repBadgeOrange }
    return null
  }

  const repBadge = getRepBadge(skill.totalReps)

  return (
    <Card style={{ padding: 16 }}>
      <View style={styles.skillCardHeader}>
        <View style={styles.skillCardTitle}>
          <Text style={styles.skillName}>
            {skill.name} <Text style={styles.skillRepCount}>({skill.totalReps.toLocaleString()})</Text>
          </Text>
          {skill.intakeLevel && (
            <Text style={styles.skillIntakeLevel}>
              {skill.intakeLevel}
            </Text>
          )}
        </View>
        {repBadge && repBadge.colorStyle && (
          <View style={[styles.repBadge, repBadge.colorStyle]}>
            <Text style={styles.repBadgeText}>
              {repBadge.emoji} {repBadge.text}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.skillStatsGrid}>
        <View style={styles.skillStatItem}>
          <Text style={styles.skillStatLabel}>Sessions</Text>
          <Text style={styles.skillStatValue}>{skill.sessions.length}</Text>
        </View>
        <View style={styles.skillStatItem}>
          <Text style={styles.skillStatLabel}>Avg RPE</Text>
          <Text style={styles.skillStatValue}>{skill.avgRPE.toFixed(1)}</Text>
        </View>
        <View style={styles.skillStatItem}>
          <Text style={styles.skillStatLabel}>Quality Grade</Text>
          <View style={styles.qualityGradeBadge}>
            <View style={styles.qualityGradeBox}>
              <Text style={styles.qualityGradeText}>{skill.qualityGrade}</Text>
            </View>
          </View>
        </View>
      </View>

      <TouchableOpacity
        onPress={() => setExpanded(!expanded)}
        style={styles.expandButton}
        activeOpacity={0.7}
      >
        <Text style={styles.expandButtonText}>
          {expanded ? '↑ Hide training history' : '↓ View training history'}
        </Text>
      </TouchableOpacity>

      {expanded && skill.sessions.length > 0 && (
        <View style={styles.historySection}>
          {skill.sessions
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 5)
            .map((session, idx) => (
              <Card key={idx}>
                <View style={styles.historyCardHeader}>
                  <Text style={styles.historyDate}>
                    Week {session.week} • {new Date(session.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </Text>
                  <Text style={styles.historyMeta}>
                    RPE {session.rpe} • Quality {session.quality}/4
                  </Text>
                </View>
                <Text style={styles.historySets}>
                  {session.sets} sets × {session.reps} reps = {session.sets * session.reps} total
                </Text>
                {session.notes && (
                  <Text style={styles.historyNotes}>
                    "{session.notes}"
                  </Text>
                )}
              </Card>
            ))}
        </View>
      )}
    </Card>
  )
}


// Strength Tab Component
function StrengthTab({ strengthData, userId }: { strengthData: any; userId: number | null }) {
  if (!strengthData?.strengthAnalysis?.movements) {
    return (
      <View>
        <Card>
          <SectionHeader title="Strength Analysis" />
          <Text style={styles.noDataText}>
            No strength movement data available yet. Complete more strength
            exercises to see detailed analytics!
          </Text>
        </Card>
      </View>
    )
  }

  const movementsArray = Object.values(
    strengthData.strengthAnalysis.movements
  ) as StrengthMovement[]

  return (
    <MovementAnalyticsChart 
      movements={movementsArray} 
      userId={userId} 
      blockType="STRENGTH AND POWER"
    />
  )
}

// Technical Work Tab Component
function TechnicalWorkTab({ technicalData, userId }: { technicalData: any; userId: number | null }) {
  if (!technicalData?.technicalWorkAnalysis?.movements) {
    return (
      <View>
        <Card>
          <SectionHeader title="Technical Work Analysis" />
          <Text style={styles.noDataText}>
            No technical work movement data available yet. Complete more technical work
            exercises to see detailed analytics!
          </Text>
        </Card>
      </View>
    )
  }

  const movementsArray = Object.values(
    technicalData.technicalWorkAnalysis.movements
  ) as StrengthMovement[]

  return (
    <MovementAnalyticsChart 
      movements={movementsArray} 
      userId={userId} 
      blockType="TECHNICAL WORK"
    />
  )
}

// Accessories Tab Component
function AccessoriesTab({ accessoriesData, userId }: { accessoriesData: any; userId: number | null }) {
  if (!accessoriesData?.accessoriesAnalysis?.movements) {
    return (
      <View>
        <Card>
          <SectionHeader title="Accessories Analysis" />
          <Text style={styles.noDataText}>
            No accessories movement data available yet. Complete more accessories
            exercises to see detailed analytics!
          </Text>
        </Card>
      </View>
    )
  }

  const movementsArray = Object.values(
    accessoriesData.accessoriesAnalysis.movements
  ) as StrengthMovement[]

  return (
    <MovementAnalyticsChart 
      movements={movementsArray} 
      userId={userId} 
      blockType="ACCESSORIES"
    />
  )
}

// MetCon Tab Component
type MetConMetricType = 'percentile' | 'rpe' | 'quality' | 'heartrate'

function MetConTab({ metconData }: { metconData: any }) {
  const [activeMetric, setActiveMetric] = useState<MetConMetricType>('percentile')

  if (!metconData) {
    return (
      <View>
        <Card>
          <SectionHeader title="MetCon Analytics" />
          <Text style={styles.noDataText}>Loading MetCon data...</Text>
        </Card>
      </View>
    )
  }

  if (metconData.totalMetCons === 0) {
    return (
      <View>
        <Card>
          <SectionHeader title="MetCon Analytics" />
          <Text style={styles.noDataText}>
            No MetCon data yet. Complete more MetCon workouts to see detailed
            analytics!
          </Text>
        </Card>
      </View>
    )
  }

  // Calculate exercise averages for the shared component
  const exercises = [...new Set(metconData.heatmapCells?.map((c: any) => c.exercise_name) || [])] as string[]
  const exerciseAverages = exercises.map((exerciseName: string) => {
    const exerciseCells = metconData.heatmapCells?.filter(
      (c: any) => c.exercise_name === exerciseName
    ) || []
    const totalPercentile = exerciseCells.reduce((sum: number, c: any) => sum + c.avg_percentile * c.session_count, 0)
    const totalSessions = exerciseCells.reduce((sum: number, c: any) => sum + c.session_count, 0)
    return {
      exercise_name: exerciseName,
      total_sessions: totalSessions,
      overall_avg_percentile: totalSessions > 0 ? Math.round(totalPercentile / totalSessions) : 0
    }
  })

  const metricTabs: { key: MetConMetricType; label: string; icon: string }[] = [
    { key: 'percentile', label: 'Performance', icon: '📊' },
    { key: 'rpe', label: 'Effort', icon: '💪' },
    { key: 'quality', label: 'Quality', icon: '⭐' },
    { key: 'heartrate', label: 'Heart Rate', icon: '❤️' },
  ]

  const getHeatmapTitle = (metric: MetConMetricType): string => {
    switch (metric) {
      case 'percentile':
        return 'Percentile Heatmap'
      case 'rpe':
        return 'RPE Heatmap'
      case 'quality':
        return 'Quality Heatmap'
      case 'heartrate':
        return 'Heart Rate Heatmap'
      default:
        return 'Performance Heatmap'
    }
  }

  return (
    <View style={styles.sectionGap}>
      {/* Metric Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={metconTabStyles.tabsContainer}
      >
        {metricTabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[
              metconTabStyles.metricTab,
              activeMetric === tab.key && metconTabStyles.metricTabActive,
            ]}
            onPress={() => setActiveMetric(tab.key)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                metconTabStyles.metricTabLabel,
                activeMetric === tab.key && metconTabStyles.metricTabLabelActive,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {metconData.heatmapCells && metconData.heatmapCells.length > 0 ? (
        <Card>
          <SectionHeader title={getHeatmapTitle(activeMetric)} />
          <MetConHeatMap
            heatmapCells={metconData.heatmapCells}
            exerciseAverages={exerciseAverages}
            globalFitnessScore={metconData.avgPercentile}
            metric={activeMetric}
            hideTitle
          />
        </Card>
      ) : null}
    </View>
  )
}

const metconTabStyles = StyleSheet.create({
  tabsContainer: {
    paddingHorizontal: 4,
    paddingVertical: 8,
    gap: 8,
    flexDirection: 'row',
  },
  metricTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 6,
  },
  metricTabActive: {
    backgroundColor: '#FE5858',
    borderColor: '#FE5858',
  },
  metricTabIcon: {
    fontSize: 16,
  },
  metricTabLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  metricTabLabelActive: {
    color: '#FFFFFF',
  },
})

