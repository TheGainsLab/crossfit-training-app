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

const screenWidth = Dimensions.get('window').width

type TabType = 'overview' | 'skills' | 'strength' | 'technical' | 'accessories' | 'metcons' | 'engine'

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FBFE',
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
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 16,
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
    backgroundColor: '#F8FBFE',
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
    marginBottom: 16,
    paddingVertical: 8,
  },
  contentBackButtonText: {
    fontSize: 16,
    color: '#FE5858',
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
    backgroundColor: '#F3F4F6',
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
    backgroundColor: '#F3F4F6',
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
    backgroundColor: '#DAE2EA',
    borderBottomWidth: 2,
    borderBottomColor: '#FE5858',
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
    backgroundColor: '#DAE2EA',
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
    backgroundColor: '#F8FBFE',
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
    minHeight: 50,
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
  engineAnalyticsCard: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#FE5858',
    padding: 16,
  },
  engineAnalyticsCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#282B34',
    marginBottom: 8,
  },
  engineAnalyticsCardDescription: {
    fontSize: 14,
    color: '#282B34',
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
        
        // Check subscription tier for analytics filtering
        const subscriptionTier = (userData as any).subscription_tier
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
  const getTaskCount = (category: TabType): number => {
    switch (category) {
      case 'skills':
        return skillsData?.skillsAnalysis?.skills ? Object.keys(skillsData.skillsAnalysis.skills).length : 0
      case 'strength':
        return strengthData?.strengthAnalysis?.movements ? Object.keys(strengthData.strengthAnalysis.movements).length : 0
      case 'technical':
        return technicalData?.technicalWorkAnalysis?.movements ? Object.keys(technicalData.technicalWorkAnalysis.movements).length : 0
      case 'accessories':
        return accessoriesData?.accessoriesAnalysis?.movements ? Object.keys(accessoriesData.accessoriesAnalysis.movements).length : 0
      case 'metcons':
        if (!metconData?.heatmapCells) return 0
        const uniqueExercises = new Set(metconData.heatmapCells.map((c: any) => c.exercise_name))
        return uniqueExercises.size
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
        {/* Back button - only show when NOT on overview */}
        {activeTab !== 'overview' && (
          <TouchableOpacity 
            onPress={() => setActiveTab('overview')}
            style={styles.contentBackButton}
            activeOpacity={0.7}
          >
            <Text style={styles.contentBackButtonText}>← Back to Overview</Text>
          </TouchableOpacity>
        )}
        
        {activeTab === 'overview' && (
          <>
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
          />
            
            {/* Category Cards Grid - Only show on overview */}
            <View style={styles.categoryGridContainer}>
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
          </>
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
        {activeTab === 'engine' && !isAppliedPower && <EngineTab engineData={engineData} userId={userId} />}
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
}) {
  return (
    <View style={styles.sectionGap}>
      {/* Dashboard Stats */}
      {dashboardData && (
        <Card style={{ paddingTop: 16 }}>
          <SectionHeader title="Overview" />
          {isAppliedPower ? (
            // Applied Power users: Only show Tasks Complete
            <View style={[styles.statsRow, { paddingHorizontal: 16, justifyContent: 'center' }]}>
              <View style={styles.statCardWrapper}>
                <StatCard
                  label="Tasks Complete"
                  value={dashboardData.totalExercises}
                />
              </View>
            </View>
          ) : (
            // Other users: Show all three stats
            <View style={[styles.statsRow, { paddingHorizontal: 16 }]}>
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
        </Card>
      )}

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
      <Card>
        <SectionHeader title="Skills Development Overview" />
        <View style={[styles.statsRow, { paddingHorizontal: 16 }]}>
          <View style={styles.statCardWrapper}>
            <StatCard label="Skills Practiced" value={skillsArray.length} />
          </View>
          <View style={styles.statCardWrapper}>
            <StatCard label="Grade A Skills" value={skillsArray.filter((s) => s.qualityGrade === 'A').length} />
          </View>
        </View>
      </Card>

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
function MetConTab({ metconData }: { metconData: any }) {
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

  // Helper functions for heatmap
  const getPercentile = (exerciseName: string, timeRange: string): number | null => {
    const cell = metconData.heatmapCells?.find(
      (c: any) => c.exercise_name === exerciseName && c.time_range === timeRange
    )
    return cell ? cell.avg_percentile : null
  }

  const getSessionCount = (exerciseName: string, timeRange: string): number => {
    const cell = metconData.heatmapCells?.find(
      (c: any) => c.exercise_name === exerciseName && c.time_range === timeRange
    )
    return cell ? cell.session_count : 0
  }

  const getHeatmapColor = (percentile: number | null) => {
    if (percentile === null) {
      return { bg: '#F3F4F6', text: '#9CA3AF', border: '#D1D5DB' } // gray-100, gray-400, gray-300
    }
    return { bg: '#F8FBFE', text: '#282B34', border: '#FE5858' } // light blue-gray bg, dark gray text, red border
  }

  // Extract unique exercises and time domains
  const exercises = metconData.heatmapCells 
    ? [...new Set(metconData.heatmapCells.map((c: any) => c.exercise_name))].sort() as string[]
    : []
  const timeDomains = metconData.heatmapCells
    ? ([...new Set(metconData.heatmapCells.map((c: any) => c.time_range))] as string[]).sort((a: string, b: string) => {
        const order: { [key: string]: number } = {
          '1:00–5:00': 1, '5:00–10:00': 2, '10:00–15:00': 3,
          '15:00–20:00': 4, '20:00–30:00': 5, '30:00+': 6
        }
        return (order[a] || 7) - (order[b] || 7)
      })
    : []

  // Calculate exercise averages
  const exerciseAverages = exercises.map((exerciseName: string) => {
    const exerciseCells = metconData.heatmapCells?.filter(
      (c: any) => c.exercise_name === exerciseName
    ) || []
    const totalPercentile = exerciseCells.reduce((sum: number, c: any) => sum + c.avg_percentile * c.session_count, 0)
    const totalSessions = exerciseCells.reduce((sum: number, c: any) => sum + c.session_count, 0)
    return {
      exerciseName,
      avgPercentile: totalSessions > 0 ? Math.round(totalPercentile / totalSessions) : 0
    }
  })

  return (
    <View style={styles.sectionGap}>
      {/* Heatmap Grid */}
      {metconData.heatmapCells && metconData.heatmapCells.length > 0 ? (
        (() => {
          // Helper functions
          const getPercentile = (exerciseName: string, timeRange: string): number | null => {
            const cell = metconData.heatmapCells.find(
              (c: any) => c.exercise_name === exerciseName && c.time_range === timeRange
            )
            return cell ? cell.avg_percentile : null
          }

          const getSessionCount = (exerciseName: string, timeRange: string): number => {
            const cell = metconData.heatmapCells.find(
              (c: any) => c.exercise_name === exerciseName && c.time_range === timeRange
            )
            return cell ? cell.session_count : 0
          }

          const getHeatmapColor = (percentile: number | null) => {
            if (percentile === null) {
              return { bg: '#F3F4F6', text: '#9CA3AF', border: '#D1D5DB' } // gray-100, gray-400, gray-300
            }
            return { bg: '#F8FBFE', text: '#282B34', border: '#FE5858' } // light blue-gray bg, dark gray text, red border
          }

          // Extract unique exercises and time domains
          const exercises = ([...new Set(metconData.heatmapCells.map((c: any) => c.exercise_name))] as string[]).sort()
          const timeDomains = ([...new Set(metconData.heatmapCells.map((c: any) => c.time_range))] as string[]).sort((a: string, b: string) => {
            const order: { [key: string]: number } = {
              '1:00–5:00': 1, '5:00–10:00': 2, '10:00–15:00': 3,
              '15:00–20:00': 4, '20:00–30:00': 5, '30:00+': 6
            }
            return (order[a] || 7) - (order[b] || 7)
          })

          // Calculate exercise averages
          const exerciseAverages = exercises.map(exerciseName => {
            const exerciseCells = metconData.heatmapCells.filter(
              (c: any) => c.exercise_name === exerciseName
            )
            const totalPercentile = exerciseCells.reduce((sum: number, c: any) => sum + c.avg_percentile * c.session_count, 0)
            const totalSessions = exerciseCells.reduce((sum: number, c: any) => sum + c.session_count, 0)
            return {
              exerciseName,
              avgPercentile: totalSessions > 0 ? Math.round(totalPercentile / totalSessions) : 0
            }
          })

          // Calculate time domain averages
          const calculateTimeDomainAverage = (domain: string): number | null => {
            const domainCells = metconData.heatmapCells.filter(
              (cell: any) => cell.time_range === domain
            )
            if (domainCells.length === 0) return null
            const total = domainCells.reduce(
              (sum: number, cell: any) => sum + cell.avg_percentile * cell.session_count,
              0
            )
            const sessions = domainCells.reduce(
              (sum: number, cell: any) => sum + cell.session_count,
              0
            )
            return sessions > 0 ? Math.round(total / sessions) : null
          }

          // Calculate global average (fitness score)
          const globalAvg = metconData.avgPercentile || null

          return (
            <Card>
              <SectionHeader title="Exercise Performance Heatmap" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View>
                  {/* Header Row */}
                  <View style={styles.heatmapHeaderRow}>
                    <View style={styles.heatmapExerciseHeaderCell}>
                      <Text style={styles.heatmapHeaderText}>Exercise</Text>
                    </View>
                    {timeDomains.map((domain: string) => (
                      <View key={domain} style={styles.heatmapHeaderCell}>
                        <Text style={styles.heatmapHeaderText}>{domain}</Text>
                      </View>
                    ))}
                    <View style={styles.heatmapExerciseAvgHeaderCell}>
                      <Text style={styles.heatmapHeaderText}>Exercise Avg</Text>
                    </View>
                  </View>

                  {/* Exercise Rows */}
                  {exercises.map((exerciseName: string) => {
                    const exerciseAvg = exerciseAverages.find((e: any) => e.exerciseName === exerciseName)
                    const avgColor = getHeatmapColor(exerciseAvg?.avgPercentile || null)
                    
                    return (
                      <View key={exerciseName} style={styles.heatmapRow}>
                        {/* Exercise Name */}
                        <View style={styles.heatmapExerciseCell}>
                          <Text style={styles.heatmapExerciseText} numberOfLines={0}>{exerciseName}</Text>
                        </View>
                        
                        {/* Time Domain Cells */}
                        {timeDomains.map((domain: string) => {
                          const percentile = getPercentile(exerciseName, domain)
                          const sessions = getSessionCount(exerciseName, domain)
                          const color = getHeatmapColor(percentile)
                          
                          return (
                            <View key={domain} style={styles.heatmapCell}>
                              <View style={[styles.heatmapCellContent, { 
                                backgroundColor: color.bg,
                                borderWidth: 1,
                                borderColor: color.border
                              }]}>
                                {percentile !== null ? (
                                  <View>
                                    <Text style={[styles.heatmapCellValue, { color: color.text }]}>
                                      {percentile}%
                                    </Text>
                                    {sessions > 0 ? (
                                      <Text style={[styles.heatmapCellSessions, { color: color.text }]}>
                                        {sessions} {sessions === 1 ? 'workout' : 'workouts'}
                                      </Text>
                                    ) : null}
                                  </View>
                                ) : (
                                  <Text style={[styles.heatmapCellValue, { color: color.text }]}>—</Text>
                                )}
                              </View>
                            </View>
                          )
                        })}
                        
                        {/* Exercise Average Cell */}
                        <View style={styles.heatmapExerciseAvgCell}>
                          <View style={[styles.heatmapCellContent, { 
                            backgroundColor: avgColor.bg,
                            borderWidth: 1,
                            borderColor: avgColor.border
                          }]}>
                            {exerciseAvg && exerciseAvg.avgPercentile > 0 ? (
                              <View>
                                <Text style={[styles.heatmapCellValue, { color: '#FE5858', fontWeight: '700' }]}>
                                  Avg: {exerciseAvg.avgPercentile}%
                                </Text>
                                <Text style={[styles.heatmapCellSessions, { color: '#FE5858' }]}>
                                  {metconData.heatmapCells.filter((c: any) => c.exercise_name === exerciseName).reduce((sum: number, c: any) => sum + c.session_count, 0)} {metconData.heatmapCells.filter((c: any) => c.exercise_name === exerciseName).reduce((sum: number, c: any) => sum + c.session_count, 0) === 1 ? 'workout' : 'workouts'}
                                </Text>
                              </View>
                            ) : (
                              <Text style={[styles.heatmapCellValue, { color: avgColor.text }]}>—</Text>
                            )}
                          </View>
                        </View>
                      </View>
                    )
                  })}

                  {/* Time Domain Avg Row */}
                  <View style={[styles.heatmapRow, { borderTopWidth: 2, borderTopColor: '#282B34', backgroundColor: '#F8FBFE' }]}>
                    <View style={[styles.heatmapExerciseCell, { backgroundColor: '#DAE2EA', borderRightWidth: 2, borderRightColor: '#282B34' }]}>
                      <Text style={[styles.heatmapExerciseText, { fontWeight: '700' }]} numberOfLines={0}>Time Domain Avg</Text>
                    </View>
                    {timeDomains.map((domain: string) => {
                      const avgValue = calculateTimeDomainAverage(domain)
                      const domainColor = getHeatmapColor(avgValue)
                      const totalWorkouts = metconData.heatmapCells.filter((c: any) => c.time_range === domain).reduce((sum: number, c: any) => sum + c.session_count, 0)
                      
                      return (
                        <View key={domain} style={styles.heatmapCell}>
                          <View style={[styles.heatmapCellContent, { 
                            backgroundColor: domainColor.bg,
                            borderWidth: 1,
                            borderColor: domainColor.border
                          }]}>
                            {avgValue !== null ? (
                              <View>
                                <Text style={[styles.heatmapCellValue, { color: '#FE5858', fontWeight: '700' }]}>
                                  Avg: {avgValue}%
                                </Text>
                                {totalWorkouts > 0 ? (
                                  <Text style={[styles.heatmapCellSessions, { color: '#FE5858' }]}>
                                    {totalWorkouts} {totalWorkouts === 1 ? 'workout' : 'workouts'}
                                  </Text>
                                ) : null}
                              </View>
                            ) : (
                              <Text style={[styles.heatmapCellValue, { color: domainColor.text }]}>—</Text>
                            )}
                          </View>
                        </View>
                      )
                    })}
                    {/* Global Average Cell */}
                    <View style={styles.heatmapExerciseAvgCell}>
                      <View style={[styles.heatmapCellContent, { 
                        backgroundColor: '#FE5858', 
                        minHeight: 60,
                        borderWidth: 1,
                        borderColor: '#FE5858'
                      }]}>
                        {globalAvg !== null ? (
                          <View>
                            <Text style={[styles.heatmapCellValue, { color: '#F8FBFE', fontSize: 18, fontWeight: '700' }]}>
                              {globalAvg}%
                            </Text>
                            <Text style={[styles.heatmapCellSessions, { color: '#F8FBFE', fontSize: 10, fontWeight: '600', marginTop: 4 }]}>
                              FITNESS
                            </Text>
                          </View>
                        ) : (
                          <Text style={[styles.heatmapCellValue, { color: '#F8FBFE' }]}>—</Text>
                        )}
                      </View>
                    </View>
                  </View>
                </View>
              </ScrollView>
            </Card>
          )
        })()
      ) : null}
    </View>
  )
}

// Engine Tab Component
function EngineTab({ engineData, userId }: { engineData: any; userId: number | null }) {
  const [currentView, setCurrentView] = useState('menu')
  
  if (!engineData) {
    return (
      <View style={styles.sectionGap}>
        <Card>
          <SectionHeader title="Engine Analytics" />
          <Text style={styles.noDataText}>Loading Engine data...</Text>
        </Card>
      </View>
    )
  }

  const hasData = engineData.totalSessions > 0 || engineData.totalTimeTrials > 0

  const analyticsOptions = [
    { id: 'history', title: 'My History', description: 'Performance trends by day type and modality', icon: '📈' },
    { id: 'comparisons', title: 'Comparisons', description: 'Side by side day type analysis', icon: '⚖️' },
    { id: 'time-trials', title: 'My Time Trials', description: 'Detailed time trial tracking', icon: '🎯' },
    { id: 'targets', title: 'Targets vs Actual', description: 'Compare performance against targets', icon: '🎯' },
    { id: 'records', title: 'Personal Records', description: 'Best performances by day type', icon: '🏆' },
    { id: 'heart-rate', title: 'HR Analytics', description: 'Heart rate analysis and efficiency', icon: '❤️' },
    { id: 'work-rest', title: 'Work:Rest Ratio', description: 'Interval structure analysis', icon: '⏱️' },
    { id: 'variability', title: 'Variability Trend', description: 'Consistency tracking', icon: '📉' },
  ]

  // Render menu view
  if (currentView === 'menu') {
    return (
      <View style={styles.sectionGap}>
        {/* Summary Stats */}
        {hasData && (
          <Card>
            <SectionHeader title="Engine Analytics Summary" />
            <View style={[styles.statsRow, { paddingHorizontal: 16 }]}>
              <View style={styles.statCardWrapper}>
                <StatCard label="Workouts" value={engineData.totalSessions} />
              </View>
              <View style={styles.statCardWrapper}>
                <StatCard label="Time Trials" value={engineData.totalTimeTrials} />
              </View>
            </View>
          </Card>
        )}

        {/* No Data State */}
        {!hasData && (
        <Card>
          <SectionHeader title="Engine Analytics" />
          <Text style={styles.noDataText}>
            No Engine workout data yet. Complete Engine workouts to see detailed analytics!
          </Text>
        </Card>
        )}

        {/* Analytics Menu */}
        <SectionHeader title="Analytics" />
        <View style={styles.activityList}>
          {analyticsOptions.map((option) => (
            <TouchableOpacity
              key={option.id}
              onPress={() => setCurrentView(option.id)}
              activeOpacity={0.7}
            >
              <Card style={styles.engineAnalyticsCard}>
                <Text style={styles.engineAnalyticsCardTitle}>
                  {option.title}
                </Text>
                <Text style={styles.engineAnalyticsCardDescription}>
                  {option.description}
                </Text>
              </Card>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    )
  }

  // Render detail views
  return (
    <View style={styles.sectionGap}>
      {/* Back button */}
      <TouchableOpacity
        onPress={() => setCurrentView('menu')}
        style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}
        activeOpacity={0.7}
      >
        <Text style={{ fontSize: 16, color: '#FE5858', fontWeight: '600' }}>‹ Back to Menu</Text>
      </TouchableOpacity>

      {/* Render specific view content */}
      {currentView === 'history' && <EngineHistoryView engineData={engineData} />}
      {currentView === 'comparisons' && <EngineComparisonsView engineData={engineData} />}
      {currentView === 'time-trials' && <EngineTimeTrialsView engineData={engineData} />}
      {currentView === 'targets' && <EngineTargetsView engineData={engineData} />}
      {currentView === 'records' && <EngineRecordsView engineData={engineData} />}
      {currentView === 'heart-rate' && <EngineHeartRateView engineData={engineData} />}
      {currentView === 'work-rest' && <EngineWorkRestView engineData={engineData} />}
      {currentView === 'variability' && <EngineVariabilityView engineData={engineData} />}
    </View>
  )
}

// Engine Overview View
function EngineOverviewView({ engineData }: { engineData: any }) {
  const formatModality = (modality: string) => {
    return modality.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <View style={styles.sectionGap}>
      <Card>
        <SectionHeader title="Overview" />
        <View style={styles.statsRow}>
          <View style={styles.statCardWrapper}>
            <StatCard label="Total Sessions" value={engineData.totalSessions} />
          </View>
          <View style={styles.statCardWrapper}>
            <StatCard label="Time Trials" value={engineData.totalTimeTrials} />
          </View>
        </View>
      </Card>

      {/* Modalities */}
      {engineData.modalities?.length > 0 && (
        <Card>
          <SectionHeader title="Modalities" />
          <View style={styles.activityBlocks}>
            {engineData.modalities.map((modality: string, idx: number) => (
              <View key={idx} style={styles.blockBadge}>
                <Text style={styles.blockBadgeText}>{formatModality(modality)}</Text>
              </View>
            ))}
          </View>
        </Card>
      )}

      {/* Recent Sessions */}
      {engineData.sessions?.length > 0 && (
        <View>
          <SectionHeader title="Recent Sessions" />
          <View style={styles.activityList}>
            {engineData.sessions.slice(0, 5).map((session: any, index: number) => (
              <Card key={session.id || index}>
                <View style={styles.activityCardHeader}>
                  <Text style={styles.activityMeta}>{formatDate(session.date)}</Text>
                  {session.day_type && (
                    <Text style={styles.activitySessionType}>
                      {session.day_type.charAt(0).toUpperCase() + session.day_type.slice(1)}
                    </Text>
                  )}
                </View>
                {session.modality && (
                  <Text style={styles.activityExercisesText}>{formatModality(session.modality)}</Text>
                )}
                {session.total_output && (
                  <Text style={styles.activityExercisesText}>
                    Output: {session.total_output} {session.units || ''}
                  </Text>
                )}
              </Card>
            ))}
          </View>
        </View>
      )}
    </View>
  )
}

// My History View - Performance trends by day type and modality
// Horizontal Bar Chart Component
function HorizontalBarChart({ 
  data, 
  labels, 
  maxValue, 
  unit = '', 
  height = 32 
}: { 
  data: number[], 
  labels: string[], 
  maxValue: number,
  unit?: string,
  height?: number
}) {
  return (
    <View>
      {data.map((value, index) => {
        const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0
        return (
          <View key={index} style={{ marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <Text style={{ fontSize: 12, color: '#6B7280', width: 60 }}>
                {labels[index]}
              </Text>
              <View style={{ flex: 1, height, backgroundColor: '#E5E7EB', borderRadius: 4, overflow: 'hidden', marginHorizontal: 8 }}>
                <View 
                  style={{ 
                    height: '100%', 
                    width: `${percentage}%`, 
                    backgroundColor: '#FE5858',
                    borderRadius: 4
                  }} 
                />
              </View>
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#282B34', width: 70, textAlign: 'right' }}>
                {Math.round(value)}{unit}
              </Text>
            </View>
          </View>
        )
      })}
    </View>
  )
}

function EngineHistoryView({ engineData }: { engineData: any }) {
  const [selectedDayType, setSelectedDayType] = useState('')
  const [selectedModality, setSelectedModality] = useState('')
  const [selectedMetric, setSelectedMetric] = useState<'output' | 'pace'>('output')

  // Get available day types from sessions
  const availableDayTypes = React.useMemo(() => {
    const dayTypes = new Set<string>()
    engineData.sessions?.forEach((s: any) => {
      if (s.day_type) dayTypes.add(s.day_type)
    })
    return Array.from(dayTypes).sort()
  }, [engineData.sessions])

  // Get available modalities for selected day type
  const availableModalities = React.useMemo(() => {
    const modalities = new Set<string>()
    engineData.sessions?.forEach((s: any) => {
      if (!selectedDayType || s.day_type === selectedDayType) {
        if (s.modality) modalities.add(s.modality)
      }
    })
    return Array.from(modalities).sort()
  }, [engineData.sessions, selectedDayType])

  // Filter sessions
  const filteredSessions = React.useMemo(() => {
    if (!selectedDayType || !selectedModality) return []
    
    return engineData.sessions?.filter((s: any) => 
      s.day_type === selectedDayType && 
      s.modality === selectedModality
    ).sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()) || []
  }, [engineData.sessions, selectedDayType, selectedModality])

  const formatModality = (modality: string) => {
    return modality.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
  }

  const formatDayType = (dayType: string) => {
    return dayType.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <View style={styles.sectionGap}>
      {/* Day Type Filter */}
      <Card style={{ borderWidth: 1, borderColor: '#E5E7EB', paddingTop: 16, paddingHorizontal: 16, paddingBottom: 16 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#282B34', marginBottom: 12, textAlign: 'center' }}>
          Select Day Type
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {availableDayTypes.map((dayType) => (
              <TouchableOpacity
                key={dayType}
                onPress={() => {
                  setSelectedDayType(dayType)
                  setSelectedModality('') // Reset modality
                }}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 8,
                  borderWidth: 2,
                  borderColor: selectedDayType === dayType ? '#FE5858' : '#E5E7EB',
                  backgroundColor: selectedDayType === dayType ? '#FFFFFF' : '#F3F4F6',
                }}
                activeOpacity={0.7}
              >
                <Text style={{
                  color: '#282B34',
                  fontWeight: '600',
                  fontSize: 13,
                }}>
                  {formatDayType(dayType)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </Card>

      {/* Modality Filter */}
      {selectedDayType && (
        <Card style={{ borderWidth: 1, borderColor: '#E5E7EB', paddingTop: 16, paddingHorizontal: 16, paddingBottom: 16 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#282B34', marginBottom: 12, textAlign: 'center' }}>
            Select Modality
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {availableModalities.map((modality) => (
                <TouchableOpacity
                  key={modality}
                  onPress={() => setSelectedModality(modality)}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 8,
                    borderWidth: 2,
                    borderColor: selectedModality === modality ? '#FE5858' : '#E5E7EB',
                    backgroundColor: selectedModality === modality ? '#FFFFFF' : '#F3F4F6',
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={{
                    color: '#282B34',
                    fontWeight: '600',
                    fontSize: 13,
                  }}>
                    {formatModality(modality)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </Card>
      )}

      {/* Results */}
      {selectedDayType && selectedModality && (
        <>
          <SectionHeader title={`Performance History (${filteredSessions.length} sessions)`} />
          
          {filteredSessions.length === 0 ? (
            <Card>
              <Text style={styles.noDataText}>
                No sessions found for {formatDayType(selectedDayType)} with {formatModality(selectedModality)}
              </Text>
            </Card>
          ) : filteredSessions.length === 1 ? (
            // Show single session as card if only one session
            <Card>
              <View style={styles.activityCardHeader}>
                <Text style={styles.activityMeta}>{formatDate(filteredSessions[0].date)}</Text>
                <Text style={styles.activityMeta}>Day {filteredSessions[0].program_day_number}</Text>
              </View>
                  <Text style={styles.activityExercisesText}>
                Output: {filteredSessions[0].total_output} {filteredSessions[0].units || ''}
              </Text>
              {filteredSessions[0].actual_pace && (
                <Text style={styles.activityExercisesText}>
                  Pace: {Math.round(filteredSessions[0].actual_pace)} {filteredSessions[0].units}/min
                </Text>
              )}
              {filteredSessions[0].performance_ratio && (
                <Text style={[
                  styles.activityExercisesText,
                  { 
                    color: parseFloat(filteredSessions[0].performance_ratio) >= 1.0 ? '#10B981' : 
                           parseFloat(filteredSessions[0].performance_ratio) >= 0.9 ? '#3B82F6' : '#F59E0B',
                    fontWeight: '600'
                  }
                ]}>
                  Performance: {(parseFloat(filteredSessions[0].performance_ratio) * 100).toFixed(0)}%
                  </Text>
                )}
              </Card>
          ) : (
            <ScrollView>
              {/* Metric Toggle */}
              <Card style={{ padding: 16 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#282B34', marginBottom: 12, textAlign: 'center' }}>
                  Select Metric
                </Text>
                <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
                  <TouchableOpacity
                    onPress={() => setSelectedMetric('output')}
                    style={{
                      paddingHorizontal: 20,
                      paddingVertical: 10,
                      borderRadius: 8,
                      borderWidth: 2,
                      borderColor: selectedMetric === 'output' ? '#FE5858' : '#E5E7EB',
                      backgroundColor: selectedMetric === 'output' ? '#FFFFFF' : '#F3F4F6',
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={{
                      color: '#282B34',
                      fontWeight: '600',
                      fontSize: 14,
                    }}>
                      Output
                    </Text>
                  </TouchableOpacity>
                  {filteredSessions.some((s: any) => s.actual_pace) && (
                    <TouchableOpacity
                      onPress={() => setSelectedMetric('pace')}
                      style={{
                        paddingHorizontal: 20,
                        paddingVertical: 10,
                        borderRadius: 8,
                        borderWidth: 2,
                        borderColor: selectedMetric === 'pace' ? '#FE5858' : '#E5E7EB',
                        backgroundColor: selectedMetric === 'pace' ? '#FFFFFF' : '#F3F4F6',
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={{
                        color: '#282B34',
                        fontWeight: '600',
                        fontSize: 14,
                      }}>
                        Pace
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </Card>

              {/* Output Chart */}
              {selectedMetric === 'output' && (
                <Card style={{ padding: 16 }}>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: '#282B34', marginBottom: 16, textAlign: 'center' }}>
                    Output Over Time
                  </Text>
                  <HorizontalBarChart
                    data={filteredSessions.map((s: any) => parseFloat(s.total_output) || 0)}
                    labels={filteredSessions.map((s: any) => formatDate(s.date))}
                    maxValue={Math.max(...filteredSessions.map((s: any) => parseFloat(s.total_output) || 0))}
                    unit={` ${filteredSessions[0]?.units || ''}`}
                    height={32}
                  />
                </Card>
              )}

              {/* Pace Chart */}
              {selectedMetric === 'pace' && filteredSessions.some((s: any) => s.actual_pace) && (
                <Card style={{ padding: 16 }}>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: '#282B34', marginBottom: 16, textAlign: 'center' }}>
                    Pace Over Time
                  </Text>
                  <HorizontalBarChart
                    data={filteredSessions.map((s: any) => Math.round(parseFloat(s.actual_pace) || 0))}
                    labels={filteredSessions.map((s: any) => formatDate(s.date))}
                    maxValue={Math.max(...filteredSessions.map((s: any) => Math.round(parseFloat(s.actual_pace) || 0)))}
                    unit={` ${filteredSessions[0]?.units || ''}/min`}
                    height={32}
                  />
                </Card>
              )}

              {/* Performance Ratio Chart (if available) */}
              {filteredSessions.some((s: any) => s.performance_ratio) && (
                <Card style={{ padding: 16 }}>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: '#282B34', marginBottom: 16, textAlign: 'center' }}>
                    Performance Ratio Over Time
                  </Text>
                  <HorizontalBarChart
                    data={filteredSessions.map((s: any) => (parseFloat(s.performance_ratio) || 0) * 100)}
                    labels={filteredSessions.map((s: any) => formatDate(s.date))}
                    maxValue={Math.max(...filteredSessions.map((s: any) => (parseFloat(s.performance_ratio) || 0) * 100), 100)}
                    unit="%"
                    height={32}
                  />
                </Card>
              )}
            </ScrollView>
          )}
        </>
      )}
    </View>
  )
}

function EngineComparisonsView({ engineData }: { engineData: any }) {
  const [selectedModality, setSelectedModality] = useState('')
  const [selectedDayTypes, setSelectedDayTypes] = useState<string[]>([])
  const [selectedMetric, setSelectedMetric] = useState<'pace' | 'output'>('output')

  // Get available modalities
  const availableModalities = React.useMemo(() => {
    const modalities = new Set<string>()
    engineData.sessions?.forEach((s: any) => {
      if (s.modality && s.day_type !== 'time_trial') modalities.add(s.modality)
    })
    return Array.from(modalities).sort()
  }, [engineData.sessions])

  // Get available day types for selected modality
  const availableDayTypes = React.useMemo(() => {
    if (!selectedModality) return []
    const dayTypes = new Set<string>()
    engineData.sessions?.forEach((s: any) => {
      if (s.modality === selectedModality && s.day_type && s.day_type !== 'time_trial') {
        dayTypes.add(s.day_type)
      }
    })
    return Array.from(dayTypes).sort()
  }, [engineData.sessions, selectedModality])

  // Calculate comparison data
  const comparisonData = React.useMemo(() => {
    if (!selectedModality || selectedDayTypes.length === 0) return []
    
    return selectedDayTypes.map((dayType) => {
      const sessions = engineData.sessions?.filter((s: any) => 
        s.modality === selectedModality && 
        s.day_type === dayType &&
        s.total_output
      ) || []
      
      if (sessions.length === 0) return null
      
      const avgOutput = sessions.reduce((sum: number, s: any) => sum + parseFloat(s.total_output), 0) / sessions.length
      const maxOutput = Math.max(...sessions.map((s: any) => parseFloat(s.total_output)))
      const avgPace = sessions.filter((s: any) => s.actual_pace).reduce((sum: number, s: any) => sum + parseFloat(s.actual_pace), 0) / sessions.filter((s: any) => s.actual_pace).length
      
      return {
        dayType,
        sessionCount: sessions.length,
        avgOutput: Math.round(avgOutput),
        maxOutput: Math.round(maxOutput),
        avgPace: Math.round(avgPace),
        units: sessions[0].units
      }
    }).filter(Boolean)
  }, [engineData.sessions, selectedModality, selectedDayTypes])

  const formatModality = (modality: string) => {
    return modality.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
  }

  const formatDayType = (dayType: string) => {
    return dayType.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
  }

  const toggleDayType = (dayType: string) => {
    if (selectedDayTypes.includes(dayType)) {
      setSelectedDayTypes(selectedDayTypes.filter(dt => dt !== dayType))
    } else {
      setSelectedDayTypes([...selectedDayTypes, dayType])
    }
  }

  return (
    <View style={styles.sectionGap}>
      {/* Modality Filter */}
      <Card style={{ borderWidth: 1, borderColor: '#E5E7EB', paddingTop: 16, paddingHorizontal: 16, paddingBottom: 16 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#282B34', marginBottom: 12, textAlign: 'center' }}>
          Select Modality
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {availableModalities.map((modality) => (
              <TouchableOpacity
                key={modality}
                onPress={() => {
                  setSelectedModality(modality)
                  setSelectedDayTypes([]) // Reset day types
                }}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 8,
                  borderWidth: 2,
                  borderColor: selectedModality === modality ? '#FE5858' : '#E5E7EB',
                  backgroundColor: selectedModality === modality ? '#FFFFFF' : '#F3F4F6',
                }}
                activeOpacity={0.7}
              >
                <Text style={{
                  color: '#282B34',
                  fontWeight: '600',
                  fontSize: 13,
                }}>
                  {formatModality(modality)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </Card>

      {/* Day Type Selection */}
      {selectedModality && (
        <Card style={{ borderWidth: 1, borderColor: '#E5E7EB', paddingTop: 16, paddingHorizontal: 16, paddingBottom: 16 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#282B34', marginBottom: 12, textAlign: 'center' }}>
            Select Day Types to Compare (tap multiple)
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {availableDayTypes.map((dayType) => (
              <TouchableOpacity
                key={dayType}
                onPress={() => toggleDayType(dayType)}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 8,
                  borderWidth: 2,
                  borderColor: selectedDayTypes.includes(dayType) ? '#FE5858' : '#E5E7EB',
                  backgroundColor: selectedDayTypes.includes(dayType) ? '#FFFFFF' : '#F3F4F6',
                }}
                activeOpacity={0.7}
              >
                <Text style={{
                  color: '#282B34',
                  fontWeight: '600',
                  fontSize: 13,
                }}>
                  {formatDayType(dayType)}
                </Text>
              </TouchableOpacity>
            ))}
        </View>
        </Card>
      )}

      {/* Comparison Results */}
      {comparisonData.length > 0 && (
        <>
          <SectionHeader title="Comparison Results" />
          
          {/* Metric Toggle */}
          <Card style={{ padding: 16 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#282B34', marginBottom: 12, textAlign: 'center' }}>
              Select Metric
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
              <TouchableOpacity
                onPress={() => setSelectedMetric('output')}
                style={{
                  paddingHorizontal: 20,
                  paddingVertical: 10,
                  borderRadius: 8,
                  borderWidth: 2,
                  borderColor: selectedMetric === 'output' ? '#FE5858' : '#E5E7EB',
                  backgroundColor: selectedMetric === 'output' ? '#FFFFFF' : '#F3F4F6',
                }}
                activeOpacity={0.7}
              >
                <Text style={{
                  color: '#282B34',
                  fontWeight: '600',
                  fontSize: 14,
                }}>
                  Avg Output
                </Text>
              </TouchableOpacity>
              {comparisonData.some((d: any) => d.avgPace) && (
                <TouchableOpacity
                  onPress={() => setSelectedMetric('pace')}
                  style={{
                    paddingHorizontal: 20,
                    paddingVertical: 10,
                    borderRadius: 8,
                    borderWidth: 2,
                    borderColor: selectedMetric === 'pace' ? '#FE5858' : '#E5E7EB',
                    backgroundColor: selectedMetric === 'pace' ? '#FFFFFF' : '#F3F4F6',
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={{
                    color: '#282B34',
                    fontWeight: '600',
                    fontSize: 14,
                  }}>
                    Avg Pace
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </Card>

          {/* Single Chart with All Day Types */}
          <Card style={{ padding: 16 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#282B34', marginBottom: 16, textAlign: 'center' }}>
              {selectedMetric === 'output' ? 'Average Output Comparison' : 'Average Pace Comparison'}
            </Text>
            <HorizontalBarChart
              data={comparisonData.map((data: any) => 
                selectedMetric === 'output' 
                  ? data.avgOutput 
                  : (data.avgPace || 0)
              )}
              labels={comparisonData.map((data: any) => 
                `${formatDayType(data.dayType)} (${data.sessionCount})`
              )}
              maxValue={Math.max(...comparisonData.map((data: any) => 
                selectedMetric === 'output' 
                  ? data.avgOutput 
                  : (data.avgPace || 0)
              ))}
              unit={selectedMetric === 'output' 
                ? ` ${comparisonData[0]?.units || ''}` 
                : ` ${comparisonData[0]?.units || ''}/min`}
              height={32}
            />
          </Card>
        </>
      )}
    </View>
  )
}

function EngineTimeTrialsView({ engineData }: { engineData: any }) {
  const [selectedModality, setSelectedModality] = useState('')

  const formatModality = (modality: string) => {
    return modality.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  // Get available modalities from time trials
  const availableModalities = React.useMemo(() => {
    const modalities = new Set<string>()
    engineData.timeTrials?.forEach((trial: any) => {
      if (trial.modality) modalities.add(trial.modality)
    })
    return Array.from(modalities).sort()
  }, [engineData.timeTrials])

  // Filter and sort time trials by selected modality
  const filteredTrials = React.useMemo(() => {
    if (!selectedModality) return []
    
    const trials = engineData.timeTrials?.filter((trial: any) => 
      trial.modality === selectedModality && trial.total_output
    ) || []
    
    // Sort by date (most recent first)
    return trials.sort((a: any, b: any) => {
      const dateA = new Date(a.date || a.created_at).getTime()
      const dateB = new Date(b.date || b.created_at).getTime()
      return dateB - dateA
    })
  }, [engineData.timeTrials, selectedModality])

  // Find the most recent trial (first in sorted array)
  const mostRecentTrialId = filteredTrials.length > 0 ? (filteredTrials[0].id || filteredTrials[0].date || filteredTrials[0].created_at) : null

  return (
    <View style={styles.sectionGap}>
      <SectionHeader title="My Time Trials" />
      
      {engineData.timeTrials?.length === 0 ? (
        <Card>
          <Text style={styles.noDataText}>No time trials completed yet.</Text>
        </Card>
      ) : (
        <>
          {/* Modality Filter */}
          <Card style={{ borderWidth: 1, borderColor: '#E5E7EB', paddingTop: 16, paddingHorizontal: 16, paddingBottom: 16 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#282B34', marginBottom: 12, textAlign: 'center' }}>
              Select Modality
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {availableModalities.map((modality) => (
                  <TouchableOpacity
                    key={modality}
                    onPress={() => setSelectedModality(modality)}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 10,
                      borderRadius: 8,
                      borderWidth: 2,
                      borderColor: selectedModality === modality ? '#FE5858' : '#E5E7EB',
                      backgroundColor: selectedModality === modality ? '#FFFFFF' : '#F3F4F6',
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={{
                      color: '#282B34',
                      fontWeight: '600',
                      fontSize: 13,
                    }}>
                      {formatModality(modality)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </Card>

          {/* Results */}
          {selectedModality && filteredTrials.length === 0 ? (
            <Card>
              <Text style={styles.noDataText}>
                No time trials found for {formatModality(selectedModality)}
              </Text>
            </Card>
          ) : selectedModality && filteredTrials.length > 0 ? (
            <Card style={{ padding: 16 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#282B34', marginBottom: 16, textAlign: 'center' }}>
                Time Trials - {formatModality(selectedModality)}
              </Text>
        <View>
                {filteredTrials.map((trial: any, index: number) => {
                  const isMostRecent = (trial.id || trial.date || trial.created_at) === mostRecentTrialId
                  const trialDate = formatDate(trial.date || trial.created_at)
                  const output = parseFloat(trial.total_output) || 0
                  const maxOutput = Math.max(...filteredTrials.map((t: any) => parseFloat(t.total_output) || 0))
                  const percentage = maxOutput > 0 ? (output / maxOutput) * 100 : 0

                  return (
                    <View key={trial.id || index} style={{ marginBottom: 12 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', width: 100 }}>
                          <Text style={{ fontSize: 12, color: '#6B7280' }}>
                            {trialDate}
                          </Text>
                          {isMostRecent && (
                            <View style={{ 
                              marginLeft: 6,
                              backgroundColor: '#10B981',
                              borderRadius: 10,
                              width: 20,
                              height: 20,
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}>
                              <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>✓</Text>
                            </View>
                          )}
                        </View>
                        <View style={{ flex: 1, height: 32, backgroundColor: '#E5E7EB', borderRadius: 4, overflow: 'hidden', marginHorizontal: 8 }}>
                          <View 
                            style={{ 
                              height: '100%', 
                              width: `${percentage}%`, 
                              backgroundColor: isMostRecent ? '#10B981' : '#FE5858',
                              borderRadius: 4
                            }} 
                          />
                        </View>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: '#282B34', width: 70, textAlign: 'right' }}>
                          {Math.round(output)} {trial.units || ''}
                        </Text>
                      </View>
                    </View>
                  )
                })}
              </View>
            </Card>
          ) : null}
        </>
      )}
    </View>
  )
}

function EngineTargetsView({ engineData }: { engineData: any }) {
  const [selectedDayType, setSelectedDayType] = useState('')
  const [selectedModality, setSelectedModality] = useState('')

  // Get available day types (exclude time trials)
  const availableDayTypes = React.useMemo(() => {
    const dayTypes = new Set<string>()
    engineData.sessions?.forEach((s: any) => {
      if (s.day_type && s.day_type !== 'time_trial') dayTypes.add(s.day_type)
    })
    return Array.from(dayTypes).sort()
  }, [engineData.sessions])

  // Get available modalities for selected day type
  const availableModalities = React.useMemo(() => {
    const modalities = new Set<string>()
    engineData.sessions?.forEach((s: any) => {
      if ((!selectedDayType || s.day_type === selectedDayType) && s.day_type !== 'time_trial') {
        if (s.modality) modalities.add(s.modality)
      }
    })
    return Array.from(modalities).sort()
  }, [engineData.sessions, selectedDayType])

  // Filter sessions with target data
  const filteredSessions = React.useMemo(() => {
    if (!selectedDayType || !selectedModality) return []
    
    return engineData.sessions?.filter((s: any) => 
      s.day_type === selectedDayType && 
      s.modality === selectedModality &&
      s.target_pace && s.actual_pace
    ).sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()) || []
  }, [engineData.sessions, selectedDayType, selectedModality])

  // Calculate statistics
  const stats = React.useMemo(() => {
    if (filteredSessions.length === 0) return null
    
    const avgTarget = filteredSessions.reduce((sum: number, s: any) => sum + parseFloat(s.target_pace), 0) / filteredSessions.length
    const avgActual = filteredSessions.reduce((sum: number, s: any) => sum + parseFloat(s.actual_pace), 0) / filteredSessions.length
    const avgRatio = filteredSessions.reduce((sum: number, s: any) => sum + parseFloat(s.performance_ratio || 0), 0) / filteredSessions.length
    
    // Calculate days where target was hit (performance_ratio >= 1.0)
    const daysTargetHit = filteredSessions.filter((s: any) => parseFloat(s.performance_ratio || 0) >= 1.0).length
    const totalDays = filteredSessions.length
    
    return {
      avgTarget: Math.round(avgTarget),
      avgActual: Math.round(avgActual),
      avgRatio: (avgRatio * 100).toFixed(0),
      daysTargetHit,
      totalDays
    }
  }, [filteredSessions])

  const formatModality = (modality: string) => {
    return modality.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
  }

  const formatDayType = (dayType: string) => {
    return dayType.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <View style={styles.sectionGap}>
      {/* Day Type Filter */}
      <Card style={{ borderWidth: 1, borderColor: '#E5E7EB', paddingTop: 16, paddingHorizontal: 16, paddingBottom: 16 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#282B34', marginBottom: 12, textAlign: 'center' }}>
          Select Day Type
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {availableDayTypes.map((dayType) => (
              <TouchableOpacity
                key={dayType}
                onPress={() => {
                  setSelectedDayType(dayType)
                  setSelectedModality('') // Reset modality
                }}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 8,
                  borderWidth: 2,
                  borderColor: selectedDayType === dayType ? '#FE5858' : '#E5E7EB',
                  backgroundColor: selectedDayType === dayType ? '#FFFFFF' : '#F3F4F6',
                }}
                activeOpacity={0.7}
              >
                <Text style={{
                  color: '#282B34',
                  fontWeight: '600',
                  fontSize: 13,
                }}>
                  {formatDayType(dayType)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </Card>

      {/* Modality Filter */}
      {selectedDayType && (
        <Card style={{ borderWidth: 1, borderColor: '#E5E7EB', paddingTop: 16, paddingHorizontal: 16, paddingBottom: 16 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#282B34', marginBottom: 12, textAlign: 'center' }}>
            Select Modality
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {availableModalities.map((modality) => (
                <TouchableOpacity
                  key={modality}
                  onPress={() => setSelectedModality(modality)}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 8,
                    borderWidth: 2,
                    borderColor: selectedModality === modality ? '#FE5858' : '#E5E7EB',
                    backgroundColor: selectedModality === modality ? '#FFFFFF' : '#F3F4F6',
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={{
                    color: '#282B34',
                    fontWeight: '600',
                    fontSize: 13,
                  }}>
                    {formatModality(modality)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </Card>
      )}

      {/* Results */}
      {selectedDayType && selectedModality && (
        <>
          {/* Target Hit Ratio Bar Chart */}
          {stats && stats.totalDays > 0 && (
            <Card style={{ padding: 16 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#282B34', marginBottom: 16, textAlign: 'center' }}>
                Target Performance
              </Text>
              <View style={{ marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                  <Text style={{ fontSize: 12, color: '#6B7280', width: 80 }}>
                    Days Completed
                  </Text>
                  <View style={{ flex: 1, height: 40, backgroundColor: '#E5E7EB', borderRadius: 4, overflow: 'hidden', marginHorizontal: 8, position: 'relative' }}>
                    {/* Background bar for total days */}
                    <View 
                      style={{ 
                        height: '100%', 
                        width: '100%', 
                        backgroundColor: '#E5E7EB',
                        position: 'absolute'
                      }} 
                    />
                    {/* Green bar for days target hit */}
                    <View 
                      style={{ 
                        height: '100%', 
                        width: `${(stats.daysTargetHit / stats.totalDays) * 100}%`, 
                        backgroundColor: '#10B981',
                        borderRadius: 4
                      }} 
                    />
                    {/* Red bar for days target not hit */}
                    <View 
                      style={{ 
                        height: '100%', 
                        width: `${((stats.totalDays - stats.daysTargetHit) / stats.totalDays) * 100}%`, 
                        backgroundColor: '#FE5858',
                        borderRadius: 4,
                        position: 'absolute',
                        left: `${(stats.daysTargetHit / stats.totalDays) * 100}%`
                      }} 
                    />
                  </View>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#282B34', width: 60, textAlign: 'right' }}>
                    {stats.daysTargetHit}/{stats.totalDays}
                  </Text>
                </View>
                <Text style={{ fontSize: 11, color: '#9CA3AF', textAlign: 'center', marginTop: 8 }}>
                  {stats.daysTargetHit} of {stats.totalDays} days target met
                </Text>
              </View>
            </Card>
          )}

          {/* Summary Stats */}
          {stats && (
            <Card style={{ padding: 16 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#282B34', marginBottom: 16, textAlign: 'center' }}>
                Average Performance
              </Text>
              <View style={styles.statsRow}>
                <View style={styles.statCardWrapper}>
                  <StatCard label="Target Pace" value={`${stats.avgTarget}`} />
                </View>
                <View style={styles.statCardWrapper}>
                  <StatCard label="Actual Pace" value={`${stats.avgActual}`} />
                </View>
                <View style={styles.statCardWrapper}>
                  <StatCard label="Performance" value={`${stats.avgRatio}%`} />
                </View>
              </View>
            </Card>
          )}

          {filteredSessions.length === 0 ? (
            <Card>
              <Text style={styles.noDataText}>
                No sessions with target data found for {formatDayType(selectedDayType)} with {formatModality(selectedModality)}
              </Text>
            </Card>
          ) : (
          <View style={styles.activityList}>
              {filteredSessions.map((session: any, index: number) => {
                const targetPace = Math.round(parseFloat(session.target_pace))
                const actualPace = Math.round(parseFloat(session.actual_pace))
                const performanceRatio = parseFloat(session.performance_ratio || 0)
                const maxPace = Math.max(targetPace, actualPace)
                const targetPercentage = maxPace > 0 ? (targetPace / maxPace) * 100 : 0
                const actualPercentage = maxPace > 0 ? (actualPace / maxPace) * 100 : 0
                
                return (
                  <Card key={session.id || index} style={{ padding: 16 }}>
                    {/* Header */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: '#282B34' }}>
                        {formatDate(session.date)}
                      </Text>
                      <Text style={{ fontSize: 14, color: '#6B7280' }}>
                        Day {session.program_day_number}
                      </Text>
                    </View>

                    {/* Target Bar */}
                    <View style={{ marginBottom: 12 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                        <Text style={{ fontSize: 11, color: '#9CA3AF', width: 60 }}>TARGET</Text>
                        <View style={{ flex: 1, height: 24, backgroundColor: '#E5E7EB', borderRadius: 4, overflow: 'hidden', marginHorizontal: 8 }}>
                          <View 
                            style={{ 
                              height: '100%', 
                              width: `${targetPercentage}%`, 
                              backgroundColor: '#6B7280',
                              borderRadius: 4
                            }} 
                          />
                        </View>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: '#282B34', width: 60, textAlign: 'right' }}>
                          {targetPace} {session.units}/min
                        </Text>
                      </View>
                    </View>

                    {/* Actual Bar */}
                    <View style={{ marginBottom: 12 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                        <Text style={{ fontSize: 11, color: '#9CA3AF', width: 60 }}>ACTUAL</Text>
                        <View style={{ flex: 1, height: 24, backgroundColor: '#E5E7EB', borderRadius: 4, overflow: 'hidden', marginHorizontal: 8 }}>
                          <View 
                            style={{ 
                              height: '100%', 
                              width: `${actualPercentage}%`, 
                              backgroundColor: performanceRatio >= 1.0 ? '#10B981' : performanceRatio >= 0.9 ? '#3B82F6' : '#F59E0B',
                              borderRadius: 4
                            }} 
                          />
                        </View>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: '#282B34', width: 60, textAlign: 'right' }}>
                          {actualPace} {session.units}/min
                        </Text>
                      </View>
                    </View>

                    {/* Performance Ratio */}
                    <View style={{ alignItems: 'center', marginTop: 8 }}>
                      <Text style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 4 }}>PERFORMANCE</Text>
                      <Text style={{
                        fontSize: 20,
                        fontWeight: '700',
                        color: performanceRatio >= 1.0 ? '#10B981' : performanceRatio >= 0.9 ? '#3B82F6' : '#F59E0B'
                      }}>
                        {(performanceRatio * 100).toFixed(0)}%
                      </Text>
                    </View>
                  </Card>
                )
              })}
            </View>
          )}
        </>
      )}
    </View>
  )
}

function EngineRecordsView({ engineData }: { engineData: any }) {
  const [selectedModality, setSelectedModality] = useState('')

  // Get available modalities
  const availableModalities = React.useMemo(() => {
    const modalities = new Set<string>()
    engineData.sessions?.forEach((s: any) => {
      if (s.modality) modalities.add(s.modality)
    })
    return Array.from(modalities).sort()
  }, [engineData.sessions])

  // Calculate personal records by day type for selected modality
  const personalRecords = React.useMemo(() => {
    if (!selectedModality) return {}
    
    const records: Record<string, any> = {}
    
    engineData.sessions?.forEach((session: any) => {
      if (session.modality !== selectedModality) return
      if (!session.day_type || !session.total_output) return
      
      const dayType = session.day_type
      const output = parseFloat(session.total_output)
      
      if (!records[dayType] || output > records[dayType].total_output) {
        records[dayType] = {
          ...session,
          total_output: output
        }
      }
    })
    
    return records
  }, [engineData.sessions, selectedModality])

  const formatModality = (modality: string) => {
    return modality.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
  }

  const formatDayType = (dayType: string) => {
    return dayType.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <View style={styles.sectionGap}>
      {/* Modality Filter */}
      <Card style={{ borderWidth: 1, borderColor: '#E5E7EB', paddingTop: 16, paddingHorizontal: 16, paddingBottom: 16 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#282B34', marginBottom: 12, textAlign: 'center' }}>
          Select Modality
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {availableModalities.map((modality) => (
              <TouchableOpacity
                key={modality}
                onPress={() => setSelectedModality(modality)}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 8,
                  borderWidth: 2,
                  borderColor: selectedModality === modality ? '#FE5858' : '#E5E7EB',
                  backgroundColor: selectedModality === modality ? '#FFFFFF' : '#F3F4F6',
                }}
                activeOpacity={0.7}
              >
                <Text style={{
                  color: '#282B34',
                  fontWeight: '600',
                  fontSize: 13,
                }}>
                  {formatModality(modality)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </Card>

      {/* Personal Records */}
      {selectedModality && (
        <>
          {Object.keys(personalRecords).length === 0 ? (
            <Card>
              <Text style={styles.noDataText}>
                No records found for {formatModality(selectedModality)}
              </Text>
            </Card>
          ) : (
            <Card style={{ padding: 16 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#282B34', marginBottom: 16, textAlign: 'center' }}>
                Personal Records ({Object.values(personalRecords).find((r: any) => r.actual_pace)?.units || 'cal'}/min)
              </Text>
              {Object.entries(personalRecords).filter(([_, record]: [string, any]) => record.actual_pace).length === 0 ? (
                <Text style={styles.noDataText}>
                  No pace data available for records
                </Text>
              ) : (
                <>
                  <View>
                    {Object.entries(personalRecords)
                      .filter(([_, record]: [string, any]) => record.actual_pace)
                      .sort(([_, a]: [string, any], [__, b]: [string, any]) => 
                        (parseFloat(b.actual_pace) || 0) - (parseFloat(a.actual_pace) || 0)
                      )
                      .map(([dayType, record]: [string, any], index: number) => {
                        const pace = Math.round(parseFloat(record.actual_pace) || 0)
                        const maxPace = Math.max(...Object.entries(personalRecords)
                          .filter(([_, r]: [string, any]) => r.actual_pace)
                          .map(([_, r]: [string, any]) => Math.round(parseFloat(r.actual_pace) || 0)), 1)
                        const percentage = maxPace > 0 ? (pace / maxPace) * 100 : 0
                        const units = record.units || ''
                        
                        return (
                          <View key={dayType} style={{ marginBottom: 12 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <View style={{ flex: 1, height: 32, backgroundColor: '#E5E7EB', borderRadius: 4, overflow: 'hidden', marginRight: 8, position: 'relative' }}>
                                <View 
                                  style={{ 
                                    height: '100%', 
                                    width: `${percentage}%`, 
                                    backgroundColor: '#FE5858',
                                    borderRadius: 4
                                  }} 
                                />
                                {/* Label inside bar */}
                                <View style={{ 
                                  position: 'absolute', 
                                  left: 8, 
                                  top: 0, 
                                  height: '100%', 
                                  justifyContent: 'center',
                                  zIndex: 1
                                }}>
                                  <Text style={{ 
                                    fontSize: 12, 
                                    fontWeight: '600', 
                                    color: '#FFFFFF'
                                  }}>
                                    {formatDayType(dayType)}
                                  </Text>
                                </View>
                              </View>
                              <Text style={{ fontSize: 14, fontWeight: '600', color: '#282B34', width: 70, textAlign: 'right' }}>
                                {pace}
                              </Text>
                            </View>
                          </View>
                        )
                      })}
                  </View>
                </>
              )}
            </Card>
          )}
        </>
      )}
    </View>
  )
}

function EngineHeartRateView({ engineData }: { engineData: any }) {
  const [selectedDayType, setSelectedDayType] = useState('')

  // Get baseline paces from time trials (most recent for each modality)
  const baselines = React.useMemo(() => {
    const baselineMap: Record<string, number> = {}
    
    if (!engineData.timeTrials || engineData.timeTrials.length === 0) {
      return baselineMap
    }
    
    // Get most recent time trial for each modality
    const modalityTrials: Record<string, any> = {}
    engineData.timeTrials.forEach((trial: any) => {
      const modality = trial.modality || 'unknown'
      if (!modalityTrials[modality]) {
        modalityTrials[modality] = trial
      } else {
        const trialDate = trial.date ? new Date(trial.date) : new Date(0)
        const existingDate = modalityTrials[modality].date ? new Date(modalityTrials[modality].date) : new Date(0)
        if (trialDate > existingDate) {
          modalityTrials[modality] = trial
        }
      }
    })
    
    // Calculate baseline pace for each modality (output per minute)
    Object.entries(modalityTrials).forEach(([modality, trial]: [string, any]) => {
      if (trial.total_output && trial.duration_seconds) {
        baselineMap[modality] = trial.total_output / (trial.duration_seconds / 60)
      }
    })
    
    return baselineMap
  }, [engineData.timeTrials])

  // Helper function to calculate pace from session
  const calculatePace = (session: any): number | null => {
    if (session.actual_pace) {
      return parseFloat(session.actual_pace)
    }
    if (session.total_output && session.total_work_seconds) {
      return session.total_output / (session.total_work_seconds / 60)
    }
    return null
  }

  // Get available day types with HR data
  const availableDayTypes = React.useMemo(() => {
    const dayTypes = new Set<string>()
    engineData.sessions?.forEach((s: any) => {
      if (s.day_type && (s.average_heart_rate || s.peak_heart_rate)) {
        dayTypes.add(s.day_type)
      }
    })
    return Array.from(dayTypes).sort()
  }, [engineData.sessions])

  // Calculate HR stats for selected day type
  const hrStats = React.useMemo(() => {
    if (!selectedDayType) return null
    
    const sessions = engineData.sessions?.filter((s: any) => 
      s.day_type === selectedDayType && 
      (s.average_heart_rate || s.peak_heart_rate)
    ) || []
    
    if (sessions.length === 0) return null
    
    const avgHRs = sessions.filter((s: any) => s.average_heart_rate).map((s: any) => parseFloat(s.average_heart_rate))
    const peakHRs = sessions.filter((s: any) => s.peak_heart_rate).map((s: any) => parseFloat(s.peak_heart_rate))
    
    // Calculate efficiency and training load for each session
    const efficiencies: number[] = []
    const trainingLoads: number[] = []
    
    sessions.forEach((session: any) => {
      const pace = calculatePace(session)
      const avgHR = session.average_heart_rate ? parseFloat(session.average_heart_rate) : null
      const modality = session.modality || 'unknown'
      const baseline = baselines[modality]
      
      // Get duration in minutes
      let durationMinutes = 0
      if (session.total_work_seconds) {
        durationMinutes = session.total_work_seconds / 60
      }
      
      if (pace !== null && avgHR !== null && avgHR > 0) {
        let efficiency = 0
        let trainingLoad = 0
        
        if (baseline && baseline > 0) {
          // Normalized efficiency: (pace / baseline) / avgHR * 1000
          efficiency = ((pace / baseline) / avgHR) * 1000
          // Training load: (pace / baseline) × avgHR × durationMinutes
          trainingLoad = (pace / baseline) * avgHR * durationMinutes
        } else {
          // Fallback calculation if no baseline
          efficiency = (pace / avgHR) * 1000
          trainingLoad = pace * avgHR * durationMinutes
        }
        
        efficiencies.push(efficiency)
        trainingLoads.push(trainingLoad)
      }
    })
    
    return {
      sessionCount: sessions.length,
      avgAvgHR: avgHRs.length > 0 ? Math.round(avgHRs.reduce((a: number, b: number) => a + b, 0) / avgHRs.length) : null,
      avgPeakHR: peakHRs.length > 0 ? Math.round(peakHRs.reduce((a: number, b: number) => a + b, 0) / peakHRs.length) : null,
      maxPeakHR: peakHRs.length > 0 ? Math.max(...peakHRs) : null,
      minAvgHR: avgHRs.length > 0 ? Math.min(...avgHRs) : null,
      avgEfficiency: efficiencies.length > 0 ? Math.round((efficiencies.reduce((a: number, b: number) => a + b, 0) / efficiencies.length) * 10) / 10 : null,
      avgTrainingLoad: trainingLoads.length > 0 ? Math.round(trainingLoads.reduce((a: number, b: number) => a + b, 0) / trainingLoads.length) : null,
      sessions
    }
  }, [engineData.sessions, selectedDayType, baselines])

  const formatDayType = (dayType: string) => {
    return dayType.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <View style={styles.sectionGap}>
      {/* Day Type Filter */}
      <Card style={{ borderWidth: 1, borderColor: '#E5E7EB', paddingTop: 16, paddingHorizontal: 16, paddingBottom: 16 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#282B34', marginBottom: 12, textAlign: 'center' }}>
          Select Day Type
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {availableDayTypes.map((dayType) => (
            <TouchableOpacity
              key={dayType}
              onPress={() => setSelectedDayType(dayType)}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderRadius: 8,
                borderWidth: 2,
                borderColor: selectedDayType === dayType ? '#FE5858' : '#E5E7EB',
                backgroundColor: selectedDayType === dayType ? '#FFFFFF' : '#F3F4F6',
              }}
              activeOpacity={0.7}
            >
              <Text style={{
                color: '#282B34',
                fontWeight: '600',
                fontSize: 13,
              }}>
                {formatDayType(dayType)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Card>

      {/* HR Stats */}
      {hrStats && (
        <>
          <Card>
            <SectionHeader title={`Heart Rate Analysis - ${formatDayType(selectedDayType)}`} />
            <View style={styles.statsRow}>
              <View style={styles.statCardWrapper}>
                <StatCard label="Sessions" value={hrStats.sessionCount} />
              </View>
              {hrStats.avgAvgHR && (
                <View style={styles.statCardWrapper}>
                  <StatCard label="Avg HR" value={`${hrStats.avgAvgHR} bpm`} />
                </View>
              )}
            </View>
            <View style={styles.statsRow}>
              {hrStats.avgPeakHR && (
                <View style={styles.statCardWrapper}>
                  <StatCard label="Avg Peak HR" value={`${hrStats.avgPeakHR} bpm`} />
                </View>
              )}
              {hrStats.maxPeakHR && (
                <View style={styles.statCardWrapper}>
                  <StatCard label="Max Peak HR" value={`${Math.round(hrStats.maxPeakHR)} bpm`} />
                </View>
              )}
            </View>
            {(hrStats.avgEfficiency !== null || hrStats.avgTrainingLoad !== null) && (
              <View style={styles.statsRow}>
                {hrStats.avgEfficiency !== null && (
                  <View style={styles.statCardWrapper}>
                    <StatCard label="HR Efficiency" value={hrStats.avgEfficiency.toFixed(1)} />
                  </View>
                )}
                {hrStats.avgTrainingLoad !== null && (
                  <View style={styles.statCardWrapper}>
                    <StatCard label="Training Load" value={hrStats.avgTrainingLoad.toFixed(0)} />
                  </View>
                )}
              </View>
            )}
          </Card>

          <SectionHeader title="Recent Sessions" />
          <View style={styles.activityList}>
            {hrStats.sessions.slice(0, 10).map((session: any, index: number) => {
              // Calculate efficiency and training load for this session
              const pace = calculatePace(session)
              const avgHR = session.average_heart_rate ? parseFloat(session.average_heart_rate) : null
              const modality = session.modality || 'unknown'
              const baseline = baselines[modality]
              
              let durationMinutes = 0
              if (session.total_work_seconds) {
                durationMinutes = session.total_work_seconds / 60
              }
              
              let efficiency: number | null = null
              let trainingLoad: number | null = null
              
              if (pace !== null && avgHR !== null && avgHR > 0) {
                if (baseline && baseline > 0) {
                  efficiency = ((pace / baseline) / avgHR) * 1000
                  trainingLoad = (pace / baseline) * avgHR * durationMinutes
                } else {
                  efficiency = (pace / avgHR) * 1000
                  trainingLoad = pace * avgHR * durationMinutes
                }
              }
              
              return (
                <Card key={session.id || index}>
                  <View style={styles.activityCardHeader}>
                    <Text style={styles.activityMeta}>{formatDate(session.date)}</Text>
                    <Text style={styles.activityMeta}>Day {session.program_day_number}</Text>
                  </View>
                  <View style={styles.statsRow}>
                    {session.average_heart_rate && (
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 4 }}>AVG HR</Text>
                        <Text style={{ fontSize: 18, fontWeight: '600', color: '#EF4444' }}>
                          {session.average_heart_rate}
                        </Text>
                        <Text style={{ fontSize: 11, color: '#9CA3AF' }}>bpm</Text>
                      </View>
                    )}
                    {session.peak_heart_rate && (
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 4 }}>PEAK HR</Text>
                        <Text style={{ fontSize: 18, fontWeight: '600', color: '#DC2626' }}>
                          {session.peak_heart_rate}
                        </Text>
                        <Text style={{ fontSize: 11, color: '#9CA3AF' }}>bpm</Text>
                      </View>
                    )}
                  </View>
                  {(efficiency !== null || trainingLoad !== null) && (
                    <View style={[styles.statsRow, { marginTop: 8 }]}>
                      {efficiency !== null && (
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 4 }}>EFFICIENCY</Text>
                          <Text style={{ fontSize: 16, fontWeight: '600', color: '#282B34' }}>
                            {efficiency.toFixed(1)}
                          </Text>
                        </View>
                      )}
                      {trainingLoad !== null && trainingLoad > 0 && (
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 4 }}>TRAINING LOAD</Text>
                          <Text style={{ fontSize: 16, fontWeight: '600', color: '#282B34' }}>
                            {Math.round(trainingLoad)}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                  {session.total_output && (
                    <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 8 }}>
                      Output: {session.total_output} {session.units}
                    </Text>
                  )}
                </Card>
              )
            })}
          </View>
        </>
      )}
    </View>
  )
}

function EngineWorkRestView({ engineData }: { engineData: any }) {
  const [selectedDayType, setSelectedDayType] = useState('')

  // Get available day types with work:rest ratio data
  const availableDayTypes = React.useMemo(() => {
    const dayTypes = new Set<string>()
    engineData.sessions?.forEach((s: any) => {
      if (s.day_type && s.day_type !== 'time_trial' && s.avg_work_rest_ratio) {
        dayTypes.add(s.day_type)
      }
    })
    return Array.from(dayTypes).sort()
  }, [engineData.sessions])

  // Filter sessions and calculate stats
  const filteredData = React.useMemo(() => {
    if (!selectedDayType) return null
    
    const sessions = engineData.sessions?.filter((s: any) => 
      s.day_type === selectedDayType && 
      s.avg_work_rest_ratio &&
      s.actual_pace
    ) || []
    
    if (sessions.length === 0) return null
    
    // Group by work:rest ratio ranges
    const ratioGroups: Record<string, any[]> = {}
    sessions.forEach((s: any) => {
      const ratio = parseFloat(s.avg_work_rest_ratio)
      let group = '1:1'
      if (ratio < 0.8) group = '1:2+'
      else if (ratio < 1.2) group = '1:1'
      else if (ratio < 1.8) group = '1.5:1'
      else group = '2:1+'
      
      if (!ratioGroups[group]) ratioGroups[group] = []
      ratioGroups[group].push(s)
    })
    
    const groupStats = Object.entries(ratioGroups).map(([group, sessions]) => ({
      group,
      sessionCount: sessions.length,
      avgPace: Math.round(sessions.reduce((sum, s) => sum + parseFloat(s.actual_pace), 0) / sessions.length),
      avgOutput: Math.round(sessions.reduce((sum, s) => sum + parseFloat(s.total_output), 0) / sessions.length),
      units: sessions[0].units
    })).sort((a, b) => a.group.localeCompare(b.group))
    
    return {
      sessions,
      groupStats
    }
  }, [engineData.sessions, selectedDayType])

  const formatDayType = (dayType: string) => {
    return dayType.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <View style={styles.sectionGap}>
      {/* Day Type Filter */}
      <Card style={{ borderWidth: 1, borderColor: '#E5E7EB', paddingTop: 16, paddingHorizontal: 16, paddingBottom: 16 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#282B34', marginBottom: 12, textAlign: 'center' }}>
          Select Day Type
                  </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {availableDayTypes.map((dayType) => (
            <TouchableOpacity
              key={dayType}
              onPress={() => setSelectedDayType(dayType)}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderRadius: 8,
                borderWidth: 2,
                borderColor: selectedDayType === dayType ? '#FE5858' : '#E5E7EB',
                backgroundColor: selectedDayType === dayType ? '#FFFFFF' : '#F3F4F6',
              }}
              activeOpacity={0.7}
            >
              <Text style={{
                color: '#282B34',
                fontWeight: '600',
                fontSize: 13,
              }}>
                {formatDayType(dayType)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Card>

      {/* Results */}
      {filteredData && (
        <>
          <Card>
            <SectionHeader title="Work:Rest Ratio Analysis" />
            <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 16 }}>
              How pace varies with different work:rest structures
            </Text>
            
            {filteredData.groupStats.map((stat: any) => (
              <View key={stat.group} style={{ marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#333333', marginBottom: 8 }}>
                  {stat.group} Work:Rest
                </Text>
                <View style={styles.statsRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11, color: '#9CA3AF' }}>Sessions</Text>
                    <Text style={{ fontSize: 18, fontWeight: '600', color: '#3B82F6' }}>
                      {stat.sessionCount}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11, color: '#9CA3AF' }}>Avg Pace</Text>
                    <Text style={{ fontSize: 18, fontWeight: '600', color: '#333333' }}>
                      {stat.avgPace}
                    </Text>
                    <Text style={{ fontSize: 10, color: '#9CA3AF' }}>{stat.units}/min</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11, color: '#9CA3AF' }}>Avg Output</Text>
                    <Text style={{ fontSize: 18, fontWeight: '600', color: '#10B981' }}>
                      {stat.avgOutput}
                    </Text>
                    <Text style={{ fontSize: 10, color: '#9CA3AF' }}>{stat.units}</Text>
                  </View>
                </View>
              </View>
            ))}
          </Card>

          <SectionHeader title={`All Sessions (${filteredData.sessions.length})`} />
          <View style={styles.activityList}>
            {filteredData.sessions.slice(0, 15).map((session: any, index: number) => (
              <Card key={session.id || index}>
                <View style={styles.activityCardHeader}>
                  <Text style={styles.activityMeta}>{formatDate(session.date)}</Text>
                  <Text style={styles.activityMeta}>Ratio: {parseFloat(session.avg_work_rest_ratio).toFixed(1)}</Text>
                </View>
                <View style={styles.statsRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11, color: '#9CA3AF' }}>PACE</Text>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: '#333333' }}>
                      {Math.round(parseFloat(session.actual_pace))}
                    </Text>
                    <Text style={{ fontSize: 10, color: '#9CA3AF' }}>{session.units}/min</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11, color: '#9CA3AF' }}>OUTPUT</Text>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: '#10B981' }}>
                      {session.total_output}
                    </Text>
                    <Text style={{ fontSize: 10, color: '#9CA3AF' }}>{session.units}</Text>
                  </View>
                </View>
              </Card>
            ))}
          </View>
        </>
      )}
    </View>
  )
}

function EngineVariabilityView({ engineData }: { engineData: any }) {
  const [selectedDayType, setSelectedDayType] = useState('')
  const [selectedModality, setSelectedModality] = useState('')

  // Get available day types
  const availableDayTypes = React.useMemo(() => {
    const dayTypes = new Set<string>()
    engineData.sessions?.forEach((s: any) => {
      if (s.day_type && s.day_type !== 'time_trial') dayTypes.add(s.day_type)
    })
    return Array.from(dayTypes).sort()
  }, [engineData.sessions])

  // Get available modalities for selected day type
  const availableModalities = React.useMemo(() => {
    const modalities = new Set<string>()
    engineData.sessions?.forEach((s: any) => {
      if ((!selectedDayType || s.day_type === selectedDayType) && s.day_type !== 'time_trial') {
        if (s.modality) modalities.add(s.modality)
      }
    })
    return Array.from(modalities).sort()
  }, [engineData.sessions, selectedDayType])

  // Calculate variability stats
  const variabilityData = React.useMemo(() => {
    if (!selectedDayType || !selectedModality) return null
    
    const sessions = engineData.sessions?.filter((s: any) => 
      s.day_type === selectedDayType && 
      s.modality === selectedModality &&
      s.actual_pace
    ).sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()) || []
    
    if (sessions.length < 2) return null
    
    const paces = sessions.map((s: any) => parseFloat(s.actual_pace))
    const avgPace = paces.reduce((a: number, b: number) => a + b, 0) / paces.length
    const variance = paces.reduce((sum: number, pace: number) => sum + Math.pow(pace - avgPace, 2), 0) / paces.length
    const stdDev = Math.sqrt(variance)
    const coefficientOfVariation = (stdDev / avgPace) * 100
    
    return {
      sessions,
      avgPace: Math.round(avgPace),
      stdDev: Math.round(stdDev * 10) / 10,
      coefficientOfVariation: Math.round(coefficientOfVariation * 10) / 10,
      minPace: Math.min(...paces),
      maxPace: Math.max(...paces)
    }
  }, [engineData.sessions, selectedDayType, selectedModality])

  const formatModality = (modality: string) => {
    return modality.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
  }

  const formatDayType = (dayType: string) => {
    return dayType.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <View style={styles.sectionGap}>
      {/* Day Type Filter */}
      <Card style={{ borderWidth: 1, borderColor: '#E5E7EB', paddingTop: 16, paddingHorizontal: 16, paddingBottom: 16 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#282B34', marginBottom: 12, textAlign: 'center' }}>
          Select Day Type
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {availableDayTypes.map((dayType) => (
              <TouchableOpacity
                key={dayType}
                onPress={() => {
                  setSelectedDayType(dayType)
                  setSelectedModality('') // Reset modality
                }}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 8,
                  borderWidth: 2,
                  borderColor: selectedDayType === dayType ? '#FE5858' : '#E5E7EB',
                  backgroundColor: selectedDayType === dayType ? '#FFFFFF' : '#F3F4F6',
                }}
                activeOpacity={0.7}
              >
                <Text style={{
                  color: '#282B34',
                  fontWeight: '600',
                  fontSize: 13,
                }}>
                  {formatDayType(dayType)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
              </Card>

      {/* Modality Filter */}
      {selectedDayType && (
        <Card style={{ borderWidth: 1, borderColor: '#E5E7EB', paddingTop: 16, paddingHorizontal: 16, paddingBottom: 16 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#282B34', marginBottom: 12, textAlign: 'center' }}>
            Select Modality
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {availableModalities.map((modality) => (
                <TouchableOpacity
                  key={modality}
                  onPress={() => setSelectedModality(modality)}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 8,
                    borderWidth: 2,
                    borderColor: selectedModality === modality ? '#FE5858' : '#E5E7EB',
                    backgroundColor: selectedModality === modality ? '#FFFFFF' : '#F3F4F6',
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={{
                    color: '#282B34',
                    fontWeight: '600',
                    fontSize: 13,
                  }}>
                    {formatModality(modality)}
                  </Text>
                </TouchableOpacity>
            ))}
          </View>
          </ScrollView>
        </Card>
      )}

      {/* Variability Stats */}
      {variabilityData && (
        <>
          <Card>
            <SectionHeader title="Consistency Metrics" />
            <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 16 }}>
              Lower variability indicates more consistent performance
            </Text>
            
            <View style={styles.statsRow}>
              <View style={styles.statCardWrapper}>
                <Text style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 4 }}>AVG PACE</Text>
                <Text style={{ fontSize: 24, fontWeight: '700', color: '#3B82F6' }}>
                  {variabilityData.avgPace}
                </Text>
                <Text style={{ fontSize: 11, color: '#6B7280' }}>
                  {variabilityData.sessions[0].units}/min
                </Text>
        </View>
              <View style={styles.statCardWrapper}>
                <Text style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 4 }}>STD DEV</Text>
                <Text style={{ fontSize: 24, fontWeight: '700', color: '#F59E0B' }}>
                  ±{variabilityData.stdDev}
                </Text>
                <Text style={{ fontSize: 11, color: '#6B7280' }}>
                  {variabilityData.sessions[0].units}/min
                </Text>
              </View>
            </View>
            
            <View style={styles.statsRow}>
              <View style={styles.statCardWrapper}>
                <Text style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 4 }}>VARIABILITY</Text>
                <Text style={{ fontSize: 20, fontWeight: '600', color: '#8B5CF6' }}>
                  {variabilityData.coefficientOfVariation}%
                </Text>
              </View>
              <View style={styles.statCardWrapper}>
                <Text style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 4 }}>RANGE</Text>
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#6B7280' }}>
                  {Math.round(variabilityData.minPace)} - {Math.round(variabilityData.maxPace)}
                </Text>
                <Text style={{ fontSize: 11, color: '#6B7280' }}>
                  {variabilityData.sessions[0].units}/min
                </Text>
              </View>
            </View>
          </Card>

          <SectionHeader title={`Session History (${variabilityData.sessions.length})`} />
          <View style={styles.activityList}>
            {variabilityData.sessions.map((session: any, index: number) => {
              const pace = parseFloat(session.actual_pace)
              const deviationFromAvg = pace - variabilityData.avgPace
              const isAboveAvg = deviationFromAvg > 0
              
              return (
                <Card key={session.id || index}>
                  <View style={styles.activityCardHeader}>
                    <Text style={styles.activityMeta}>{formatDate(session.date)}</Text>
                    <Text style={styles.activityMeta}>Day {session.program_day_number}</Text>
                  </View>
                  <View style={styles.statsRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 4 }}>PACE</Text>
                      <Text style={{ fontSize: 18, fontWeight: '600', color: '#333333' }}>
                        {Math.round(pace)}
                      </Text>
                      <Text style={{ fontSize: 11, color: '#9CA3AF' }}>{session.units}/min</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 4 }}>DEVIATION</Text>
                      <Text style={{
                        fontSize: 16,
                        fontWeight: '600',
                        color: isAboveAvg ? '#10B981' : '#EF4444'
                      }}>
                        {isAboveAvg ? '+' : ''}{Math.round(deviationFromAvg)}
                      </Text>
                      <Text style={{ fontSize: 11, color: '#9CA3AF' }}>from avg</Text>
                    </View>
                  </View>
                </Card>
              )
            })}
          </View>
        </>
      )}
    </View>
  )
}

