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

const screenWidth = Dimensions.get('window').width

type TabType = 'overview' | 'skills' | 'strength' | 'technical' | 'accessories' | 'metcons' | 'engine'

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E8F4F8',
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
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333333',
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
    justifyContent: 'space-between',
  },
  statCardWrapper: {
    width: '48%',
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
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  activityDate: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333333',
  },
  activityMeta: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FE5858',
  },
  activityExercises: {
    marginBottom: 12,
  },
  activityExercisesText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  activityBlocks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  blockBadge: {
    backgroundColor: '#6B8FA3',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  blockBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333333',
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
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  skillCardTitle: {
    flex: 1,
    marginRight: 8,
  },
  skillName: {
    fontWeight: '700',
    color: '#333333',
    fontSize: 16,
    marginBottom: 4,
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
})

export default function ProgressPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [userId, setUserId] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>('overview')

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
        .select('id')
        .eq('auth_id', user.id)
        .single()

      if (userData) {
        setUserId((userData as { id: number }).id)
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
        const [activity, dashboard] = await Promise.all([
          fetchRecentActivity(userId, activityFilter === null ? 100 : activityFilter),
          fetchDashboardData(userId),
        ])
        setRecentActivity(activity)
        setDashboardData(dashboard)
      } else if (tab === 'skills') {
        const data = await fetchSkillsAnalytics(userId, 90)
        setSkillsData(data)
      } else if (tab === 'strength') {
        const data = await fetchStrengthAnalytics(userId, 90)
        setStrengthData(data)
      } else if (tab === 'technical') {
        const data = await fetchTechnicalWorkAnalytics(userId, 90)
        setTechnicalData(data)
      } else if (tab === 'accessories') {
        const data = await fetchAccessoriesAnalytics(userId, 90)
        setAccessoriesData(data)
      } else if (tab === 'metcons') {
        const data = await fetchMetConAnalytics(userId)
        setMetconData(data)
      } else if (tab === 'engine') {
        const data = await fetchEngineAnalytics(userId)
        setEngineData(data)
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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#333333" />
        <Text style={styles.loadingText}>Loading progress...</Text>
      </View>
    )
  }

  return (
    <View style={[styles.container, { flex: 1 }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Progress & Analytics</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        {(['overview', 'skills', 'strength', 'technical', 'accessories', 'metcons', 'engine'] as TabType[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            activeOpacity={0.7}
            style={[
              styles.tab,
              activeTab === tab ? styles.tabActive : styles.tabInactive,
            ]}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === tab ? styles.tabTextActive : styles.tabTextInactive,
              ]}
            >
              {tab === 'technical' ? 'Technical Work' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
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
          />
        )}
        {activeTab === 'skills' && (
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
        {activeTab === 'metcons' && <MetConTab metconData={metconData} />}
        {activeTab === 'engine' && <EngineTab engineData={engineData} userId={userId} />}
      </ScrollView>
    </View>
  )
}

// Session History Modal Component
function SessionHistoryModal({
  visible,
  exerciseName,
  sessionHistory,
  loading,
  onClose,
}: {
  visible: boolean
  exerciseName: string
  sessionHistory: SessionHistoryRow[]
  loading?: boolean
  onClose: () => void
}) {
  const formatDateCompact = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const getQualityGrade = (quality: number | null) => {
    if (quality === null) return ''
    if (quality >= 4) return 'A'
    if (quality >= 3) return 'B'
    if (quality >= 2) return 'C'
    return 'D'
  }

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              Session history: {exerciseName}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.modalCloseButton}
              activeOpacity={0.7}
            >
              <Text style={styles.modalCloseText}>×</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.sessionHistoryEmpty}>
              <ActivityIndicator size="large" color="#FE5858" />
              <Text style={[styles.sessionHistoryEmptyText, { marginTop: 12 }]}>
                Loading session history...
              </Text>
            </View>
          ) : sessionHistory.length === 0 ? (
            <View style={styles.sessionHistoryEmpty}>
              <Text style={styles.sessionHistoryEmptyText}>
                No entries for this range.
              </Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={true}>
              <View style={styles.sessionHistoryTable}>
                {/* Header */}
                <View style={styles.sessionHistoryHeader}>
                  <View style={[styles.sessionHistoryHeaderCell, styles.sessionHistoryDateCell]}>
                    <Text style={styles.sessionHistoryHeaderText}>Date</Text>
                  </View>
                  <View style={styles.sessionHistoryHeaderCell}>
                    <Text style={styles.sessionHistoryHeaderText}>Sets</Text>
                  </View>
                  <View style={styles.sessionHistoryHeaderCell}>
                    <Text style={styles.sessionHistoryHeaderText}>Reps</Text>
                  </View>
                  <View style={styles.sessionHistoryHeaderCell}>
                    <Text style={styles.sessionHistoryHeaderText}>Wt/Time</Text>
                  </View>
                  <View style={styles.sessionHistoryHeaderCell}>
                    <Text style={styles.sessionHistoryHeaderText}>RPE</Text>
                  </View>
                  <View style={styles.sessionHistoryHeaderCell}>
                    <Text style={styles.sessionHistoryHeaderText}>Quality</Text>
                  </View>
                </View>

                {/* Rows */}
                {[...sessionHistory]
                  .sort((a, b) => (a.training_date < b.training_date ? 1 : -1))
                  .map((row, index) => (
                    <View
                      key={index}
                      style={[
                        styles.sessionHistoryRow,
                        index % 2 === 1 ? styles.sessionHistoryRowOdd : null,
                      ]}
                    >
                      <View style={[styles.sessionHistoryCell, styles.sessionHistoryDateCell]}>
                        <Text style={styles.sessionHistoryDateText}>
                          {formatDateCompact(row.training_date)}
                        </Text>
                      </View>
                      <View style={styles.sessionHistoryCell}>
                        <Text style={styles.sessionHistoryCellText}>
                          {row.sets ?? ''}
                        </Text>
                      </View>
                      <View style={styles.sessionHistoryCell}>
                        <Text style={styles.sessionHistoryCellText}>
                          {row.reps ?? ''}
                        </Text>
                      </View>
                      <View style={styles.sessionHistoryCell}>
                        <Text style={styles.sessionHistoryCellText}>
                          {row.weight_time && row.weight_time !== 'NaN' ? row.weight_time : ''}
                        </Text>
                      </View>
                      <View style={styles.sessionHistoryCell}>
                        <Text style={styles.sessionHistoryCellText}>
                          {row.rpe ?? ''}
                        </Text>
                      </View>
                      <View style={styles.sessionHistoryCell}>
                        <Text style={styles.sessionHistoryCellText}>
                          {getQualityGrade(row.completion_quality)}
                        </Text>
                      </View>
                    </View>
                  ))}
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
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
}: {
  recentActivity: RecentSession[]
  dashboardData: any
  activityFilter: number | null
  setActivityFilter: (filter: number | null) => void
  formatDate: (date: string) => string
  getTrendIcon: (trend: string) => string
  userId: number | null
  router: any
}) {
  return (
    <View style={styles.sectionGap}>
      {/* Dashboard Stats */}
      {dashboardData && (
        <Card>
          <SectionHeader title="Overview" />
          <View style={styles.statsRow}>
            <View style={styles.statCardWrapper}>
              <StatCard
                label="Training Days"
                value={dashboardData.totalWorkouts}
              />
            </View>
            <View style={styles.statCardWrapper}>
              <StatCard
                label="Tasks Completed"
                value={dashboardData.totalExercises}
              />
            </View>
            <View style={styles.statCardWrapper}>
              <StatCard
                label="MetCons Completed"
                value={dashboardData.metconsCompleted}
              />
            </View>
            <View style={styles.statCardWrapper}>
              <StatCard
                label="Fitness Score"
                value={dashboardData.fitnessScore !== null ? `${dashboardData.fitnessScore}%` : '—'}
              />
            </View>
          </View>
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
                    Week {session.week} • Day {session.day}
                  </Text>
                </View>
                <View style={styles.activityExercises}>
                  <Text style={styles.activityExercisesText}>
                    {session.totalExercises} exercises completed
                  </Text>
                </View>
                <View style={styles.activityBlocks}>
                  {session.blocks.map((block, idx) => (
                    <View
                      key={idx}
                      style={styles.blockBadge}
                    >
                      <Text style={styles.blockBadgeText}>
                        {block.blockName} ({block.exerciseCount})
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
        <View style={styles.skillsSummaryRow}>
          <View style={styles.skillsStat}>
            <Text style={styles.skillsStatValue}>
              {skillsArray.length}
            </Text>
            <Text style={styles.skillsStatLabel}>Skills Practiced</Text>
          </View>
          <View style={styles.skillsStat}>
            <Text style={styles.skillsStatValue}>
              {skillsArray.filter((s) => s.qualityGrade === 'A').length}
            </Text>
            <Text style={styles.skillsStatLabel}>Grade A Skills</Text>
          </View>
        </View>
      </Card>

      {/* Skills List */}
      <Card>
        <SectionHeader title="Individual Skills Progress" />
        <View style={styles.skillsList}>
          {skillsArray.map((skill, index) => (
            <SkillCard key={skill.name || index} skill={skill} />
          ))}
        </View>
      </Card>
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
    <Card>
      <View style={styles.skillCardHeader}>
        <View style={styles.skillCardTitle}>
          <Text style={styles.skillName}>
            {skill.name}
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
          <Text style={styles.skillStatLabel}>Total Reps</Text>
          <Text style={styles.skillStatValue}>{skill.totalReps.toLocaleString()}</Text>
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
  const [modalVisible, setModalVisible] = useState(false)
  const [selectedExercise, setSelectedExercise] = useState<string>('')
  const [sessionHistory, setSessionHistory] = useState<SessionHistoryRow[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  const handleCardPress = async (exerciseName: string) => {
    if (!userId) return
    
    setSelectedExercise(exerciseName)
    setLoadingHistory(true)
    setModalVisible(true)

    try {
      const history = await fetchMovementSessionHistory(
        userId,
        exerciseName,
        'STRENGTH AND POWER',
        90
      )
      setSessionHistory(history)
    } catch (error) {
      console.error('Error fetching session history:', error)
      setSessionHistory([])
    } finally {
      setLoadingHistory(false)
    }
  }

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
    <View style={styles.sectionGap}>
      {/* Movement Cards */}
      <View style={styles.movementsList}>
        {movementsArray.map((movement, index) => (
          <TouchableOpacity
            key={movement.name || index}
            onPress={() => handleCardPress(movement.name)}
            activeOpacity={0.7}
          >
            <Card>
              <Text style={styles.movementCardTitle}>
                {movement.name}
              </Text>
              <View style={styles.movementStats}>
                <View style={styles.movementStatRow}>
                  <Text style={styles.movementStatLabel}>Sessions</Text>
                  <Text style={styles.movementStatValue}>{movement.sessions.length}</Text>
                </View>
                <View style={styles.movementStatRow}>
                  <Text style={styles.movementStatLabel}>Max Weight</Text>
                  <Text style={styles.movementStatValueTeal}>
                    {isNaN(movement.maxWeight) ? '0' : movement.maxWeight} lbs
                  </Text>
                </View>
                <View style={styles.movementStatRow}>
                  <Text style={styles.movementStatLabel}>Avg Weight</Text>
                  <Text style={styles.movementStatValueOrange}>
                    {isNaN(movement.averageWeight) ? '0.0' : movement.averageWeight.toFixed(1)} lbs
                  </Text>
                </View>
                <View style={styles.movementStatRow}>
                  <Text style={styles.movementStatLabel}>Avg RPE</Text>
                  <Text style={styles.movementStatValue}>
                    {isNaN(movement.avgRPE) ? '0.0' : movement.avgRPE.toFixed(1)}
                  </Text>
                </View>
                <View style={styles.movementStatRow}>
                  <Text style={styles.movementStatLabel}>Total Volume</Text>
                  <Text style={styles.movementStatValue}>
                    {isNaN(movement.totalVolume) ? '0' : movement.totalVolume.toLocaleString()}
                  </Text>
                </View>
              </View>
            </Card>
          </TouchableOpacity>
        ))}
      </View>

      <SessionHistoryModal
        visible={modalVisible}
        exerciseName={selectedExercise}
        sessionHistory={sessionHistory}
        loading={loadingHistory}
        onClose={() => setModalVisible(false)}
      />
    </View>
  )
}

// Technical Work Tab Component
function TechnicalWorkTab({ technicalData, userId }: { technicalData: any; userId: number | null }) {
  const [modalVisible, setModalVisible] = useState(false)
  const [selectedExercise, setSelectedExercise] = useState<string>('')
  const [sessionHistory, setSessionHistory] = useState<SessionHistoryRow[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  const handleCardPress = async (exerciseName: string) => {
    if (!userId) return
    
    setSelectedExercise(exerciseName)
    setLoadingHistory(true)
    setModalVisible(true)

    try {
      const history = await fetchMovementSessionHistory(
        userId,
        exerciseName,
        'TECHNICAL WORK',
        90
      )
      setSessionHistory(history)
    } catch (error) {
      console.error('Error fetching session history:', error)
      setSessionHistory([])
    } finally {
      setLoadingHistory(false)
    }
  }

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
    <View style={styles.sectionGap}>
      {/* Movement Cards */}
      <View style={styles.movementsList}>
        {movementsArray.map((movement, index) => (
          <TouchableOpacity
            key={movement.name || index}
            onPress={() => handleCardPress(movement.name)}
            activeOpacity={0.7}
          >
            <Card>
              <Text style={styles.movementCardTitle}>
                {movement.name}
              </Text>
              <View style={styles.movementStats}>
                <View style={styles.movementStatRow}>
                  <Text style={styles.movementStatLabel}>Sessions</Text>
                  <Text style={styles.movementStatValue}>{movement.sessions.length}</Text>
                </View>
                <View style={styles.movementStatRow}>
                  <Text style={styles.movementStatLabel}>Max Weight</Text>
                  <Text style={styles.movementStatValueTeal}>
                    {isNaN(movement.maxWeight) ? '0' : movement.maxWeight} lbs
                  </Text>
                </View>
                <View style={styles.movementStatRow}>
                  <Text style={styles.movementStatLabel}>Avg Weight</Text>
                  <Text style={styles.movementStatValueOrange}>
                    {isNaN(movement.averageWeight) ? '0.0' : movement.averageWeight.toFixed(1)} lbs
                  </Text>
                </View>
                <View style={styles.movementStatRow}>
                  <Text style={styles.movementStatLabel}>Avg RPE</Text>
                  <Text style={styles.movementStatValue}>
                    {isNaN(movement.avgRPE) ? '0.0' : movement.avgRPE.toFixed(1)}
                  </Text>
                </View>
                <View style={styles.movementStatRow}>
                  <Text style={styles.movementStatLabel}>Total Volume</Text>
                  <Text style={styles.movementStatValue}>
                    {isNaN(movement.totalVolume) ? '0' : movement.totalVolume.toLocaleString()}
                  </Text>
                </View>
              </View>
            </Card>
          </TouchableOpacity>
        ))}
      </View>

      <SessionHistoryModal
        visible={modalVisible}
        exerciseName={selectedExercise}
        sessionHistory={sessionHistory}
        loading={loadingHistory}
        onClose={() => setModalVisible(false)}
      />
    </View>
  )
}

// Accessories Tab Component
function AccessoriesTab({ accessoriesData, userId }: { accessoriesData: any; userId: number | null }) {
  const [modalVisible, setModalVisible] = useState(false)
  const [selectedExercise, setSelectedExercise] = useState<string>('')
  const [sessionHistory, setSessionHistory] = useState<SessionHistoryRow[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  const handleCardPress = async (exerciseName: string) => {
    if (!userId) return
    
    setSelectedExercise(exerciseName)
    setLoadingHistory(true)
    setModalVisible(true)

    try {
      const history = await fetchMovementSessionHistory(
        userId,
        exerciseName,
        'ACCESSORIES',
        90
      )
      setSessionHistory(history)
    } catch (error) {
      console.error('Error fetching session history:', error)
      setSessionHistory([])
    } finally {
      setLoadingHistory(false)
    }
  }

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
    <View style={styles.sectionGap}>
      {/* Movement Cards */}
      <View style={styles.movementsList}>
        {movementsArray.map((movement, index) => (
          <TouchableOpacity
            key={movement.name || index}
            onPress={() => handleCardPress(movement.name)}
            activeOpacity={0.7}
          >
            <Card>
              <Text style={styles.movementCardTitle}>
                {movement.name}
              </Text>
              <View style={styles.movementStats}>
                <View style={styles.movementStatRow}>
                  <Text style={styles.movementStatLabel}>Sessions</Text>
                  <Text style={styles.movementStatValue}>{movement.sessions.length}</Text>
                </View>
                <View style={styles.movementStatRow}>
                  <Text style={styles.movementStatLabel}>Max Weight</Text>
                  <Text style={styles.movementStatValueTeal}>
                    {isNaN(movement.maxWeight) ? '0' : movement.maxWeight} lbs
                  </Text>
                </View>
                <View style={styles.movementStatRow}>
                  <Text style={styles.movementStatLabel}>Avg Weight</Text>
                  <Text style={styles.movementStatValueOrange}>
                    {isNaN(movement.averageWeight) ? '0.0' : movement.averageWeight.toFixed(1)} lbs
                  </Text>
                </View>
                <View style={styles.movementStatRow}>
                  <Text style={styles.movementStatLabel}>Avg RPE</Text>
                  <Text style={styles.movementStatValue}>
                    {isNaN(movement.avgRPE) ? '0.0' : movement.avgRPE.toFixed(1)}
                  </Text>
                </View>
                <View style={styles.movementStatRow}>
                  <Text style={styles.movementStatLabel}>Total Volume</Text>
                  <Text style={styles.movementStatValue}>
                    {isNaN(movement.totalVolume) ? '0' : movement.totalVolume.toLocaleString()}
                  </Text>
                </View>
              </View>
            </Card>
          </TouchableOpacity>
        ))}
      </View>

      <SessionHistoryModal
        visible={modalVisible}
        exerciseName={selectedExercise}
        sessionHistory={sessionHistory}
        loading={loadingHistory}
        onClose={() => setModalVisible(false)}
      />
    </View>
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
    { id: 'overview', title: 'Overview', description: 'Summary stats and recent activity', icon: '📊' },
    { id: 'history', title: 'My History', description: 'Performance trends by day type and modality', icon: '📈' },
    { id: 'comparisons', title: 'Comparisons', description: 'Side by side day type analysis', icon: '⚖️' },
    { id: 'time-trials', title: 'My Time Trials', description: 'Detailed time trial tracking', icon: '🎯' },
    { id: 'targets', title: 'Targets vs Actual', description: 'Compare performance against targets', icon: '🎪' },
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
            <View style={styles.statsRow}>
              <View style={styles.statCardWrapper}>
                <StatCard label="Workouts" value={engineData.totalSessions} />
              </View>
              <View style={styles.statCardWrapper}>
                <StatCard label="Time Trials" value={engineData.totalTimeTrials} />
              </View>
              {engineData.avgPerformanceRatio !== null && (
                <View style={styles.statCardWrapper}>
                  <StatCard
                    label="Avg Performance"
                    value={`${(engineData.avgPerformanceRatio * 100).toFixed(0)}%`}
                  />
                </View>
              )}
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
              <Card>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ fontSize: 32, marginRight: 12 }}>{option.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: '#333333', marginBottom: 4 }}>
                      {option.title}
                    </Text>
                    <Text style={{ fontSize: 13, color: '#4B5563' }}>
                      {option.description}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 18, color: '#9CA3AF' }}>›</Text>
                </View>
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
      {currentView === 'overview' && <EngineOverviewView engineData={engineData} />}
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
                    <Text style={styles.activityMeta}>
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

// Placeholder views for other analytics (to be implemented)
function EngineHistoryView({ engineData }: { engineData: any }) {
  return (
    <Card>
      <SectionHeader title="My History" />
      <Text style={styles.noDataText}>Performance history view coming soon!</Text>
    </Card>
  )
}

function EngineComparisonsView({ engineData }: { engineData: any }) {
  return (
    <Card>
      <SectionHeader title="Comparisons" />
      <Text style={styles.noDataText}>Comparison analytics coming soon!</Text>
    </Card>
  )
}

function EngineTimeTrialsView({ engineData }: { engineData: any }) {
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
        <SectionHeader title="My Time Trials" />
        {engineData.timeTrials?.length === 0 ? (
          <Text style={styles.noDataText}>No time trials completed yet.</Text>
        ) : (
          <View style={styles.activityList}>
            {engineData.timeTrials.map((trial: any, index: number) => (
              <Card key={trial.id || index}>
                <View style={styles.activityCardHeader}>
                  <Text style={styles.activityMeta}>{formatDate(trial.date || trial.created_at)}</Text>
                </View>
                {trial.modality && (
                  <Text style={styles.activityExercisesText}>{formatModality(trial.modality)}</Text>
                )}
                {trial.total_output && (
                  <Text style={styles.activityExercisesText}>
                    Output: {trial.total_output} {trial.units || ''}
                  </Text>
                )}
                {trial.duration_seconds && (
                  <Text style={styles.activityExercisesText}>
                    Duration: {Math.floor(trial.duration_seconds / 60)}:{(trial.duration_seconds % 60).toString().padStart(2, '0')}
                  </Text>
                )}
              </Card>
            ))}
          </View>
        )}
      </Card>
    </View>
  )
}

function EngineTargetsView({ engineData }: { engineData: any }) {
  return (
    <Card>
      <SectionHeader title="Targets vs Actual" />
      <Text style={styles.noDataText}>Target analysis coming soon!</Text>
    </Card>
  )
}

function EngineRecordsView({ engineData }: { engineData: any }) {
  return (
    <Card>
      <SectionHeader title="Personal Records" />
      <Text style={styles.noDataText}>Personal records view coming soon!</Text>
    </Card>
  )
}

function EngineHeartRateView({ engineData }: { engineData: any }) {
  return (
    <Card>
      <SectionHeader title="HR Analytics" />
      <Text style={styles.noDataText}>Heart rate analytics coming soon!</Text>
    </Card>
  )
}

function EngineWorkRestView({ engineData }: { engineData: any }) {
  return (
    <Card>
      <SectionHeader title="Work:Rest Ratio" />
      <Text style={styles.noDataText}>Work:Rest analysis coming soon!</Text>
    </Card>
  )
}

function EngineVariabilityView({ engineData }: { engineData: any }) {
  return (
    <Card>
      <SectionHeader title="Variability Trend" />
      <Text style={styles.noDataText}>Variability tracking coming soon!</Text>
    </Card>
  )
}
