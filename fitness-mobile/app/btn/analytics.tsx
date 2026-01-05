import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet,
  TouchableOpacity,
} from 'react-native'
import { useRouter } from 'expo-router'
import { createClient } from '@/lib/supabase/client'
import { fetchBTNAnalytics, BTNAnalyticsData } from '@/lib/api/btn'
import { Card } from '@/components/ui/Card'
import { StatCard } from '@/components/ui/StatCard'
import BTNAnalyticsTabs from '@/components/btn/BTNAnalyticsTabs'
import { PerformanceView, EffortView, QualityView, HeartRateView } from '@/components/btn/BTNAnalyticsViews'

type EquipmentFilter = 'all' | 'barbell' | 'no_barbell' | 'gymnastics'

export default function BTNAnalyticsPage() {
  const router = useRouter()
  const [checkingAccess, setCheckingAccess] = useState(true)
  const [loading, setLoading] = useState(false)
  const [hasAccess, setHasAccess] = useState(false)
  const [equipmentFilter, setEquipmentFilter] = useState<EquipmentFilter>('all')
  const [analyticsData, setAnalyticsData] = useState<BTNAnalyticsData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    checkAccess()
  }, [])

  useEffect(() => {
    if (hasAccess) {
      loadAnalytics()
    }
  }, [hasAccess, equipmentFilter])

  const checkAccess = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.replace('/auth/signin')
        return
      }

      // Check BTN subscription access
      const { data: userData } = await supabase
        .from('users')
        .select('subscription_tier')
        .eq('auth_id', user.id)
        .single()

      if (userData?.subscription_tier === 'BTN') {
        setHasAccess(true)
      } else {
        Alert.alert('Access Denied', 'BTN subscription required', [
          { text: 'OK', onPress: () => router.back() },
        ])
      }
    } catch (error) {
      console.error('Error checking access:', error)
      Alert.alert('Error', 'Failed to verify access')
      router.back()
    } finally {
      setCheckingAccess(false)
    }
  }

  const loadAnalytics = async () => {
    try {
      setLoading(true)
      setError(null)
      const result = await fetchBTNAnalytics(equipmentFilter)
      if (result.success) {
        setAnalyticsData(result.data)
      } else {
        setError('Failed to load analytics data')
      }
    } catch (err: any) {
      console.error('Error loading analytics:', err)
      setError(err.message || 'Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }


  if (checkingAccess || !hasAccess) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FE5858" />
        <Text style={styles.loadingText}>
          {checkingAccess ? 'Checking access...' : 'Loading analytics...'}
        </Text>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.header}>
        <Text style={styles.title}>Analytics</Text>
        <Text style={styles.subtitle}>Track your performance across exercises and time domains</Text>
      </View>

      {/* Equipment Filter */}
      <Card style={styles.filterCard}>
        <Text style={styles.filterTitle}>Filter by Equipment</Text>
        <View style={styles.filterRow}>
          {(['all', 'barbell', 'no_barbell', 'gymnastics'] as const).map(filter => (
            <TouchableOpacity
              key={filter}
              onPress={() => setEquipmentFilter(filter)}
              style={[
                styles.filterButton,
                equipmentFilter === filter && styles.filterButtonSelected
              ]}
            >
              <Text style={[
                styles.filterButtonText,
                equipmentFilter === filter && styles.filterButtonTextSelected
              ]}>
                {filter === 'all' ? 'All' : 
                 filter === 'barbell' ? 'Barbell' :
                 filter === 'no_barbell' ? 'No Barbell' :
                 'Gymnastics'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Card>

      {/* Stats Summary */}
      {analyticsData && (
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <StatCard
              label="Total Workouts"
              value={analyticsData.totalCompletedWorkouts.toString()}
            />
          </View>
          <View style={styles.statCard}>
            <StatCard
              label="Global Score"
              value={`${analyticsData.globalFitnessScore}%`}
            />
          </View>
        </View>
      )}

      {/* Analytics Content */}
      {loading ? (
        <Card style={styles.contentCard}>
          <ActivityIndicator size="large" color="#FE5858" />
          <Text style={styles.loadingText}>Loading analytics...</Text>
        </Card>
      ) : error ? (
        <Card style={styles.contentCard}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
          <TouchableOpacity onPress={loadAnalytics} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </Card>
      ) : !analyticsData || analyticsData.exercises.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>📊</Text>
          <Text style={styles.emptyTitle}>No Analytics Data Yet</Text>
          <Text style={styles.emptyText}>
            Complete some workouts and log your results to see your performance analytics here.
          </Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => router.push('/btn/workouts')}
          >
            <Text style={styles.emptyButtonText}>View Workouts</Text>
          </TouchableOpacity>
        </Card>
      ) : (
        <View style={styles.tabsContainer}>
          <BTNAnalyticsTabs>
            {(activeTab) => {
              switch (activeTab) {
                case 'performance':
                  return <PerformanceView heatmapData={analyticsData} activeTab={activeTab} />
                case 'effort':
                  return <EffortView heatmapData={analyticsData} activeTab={activeTab} />
                case 'quality':
                  return <QualityView heatmapData={analyticsData} activeTab={activeTab} />
                case 'heartrate':
                  return <HeartRateView heatmapData={analyticsData} activeTab={activeTab} />
                default:
                  return <PerformanceView heatmapData={analyticsData} activeTab={activeTab} />
              }
            }}
          </BTNAnalyticsTabs>
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  contentContainer: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  header: {
    marginBottom: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#282B34',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  filterCard: {
    padding: 16,
    marginBottom: 16,
  },
  filterTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#282B34',
    marginBottom: 12,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    backgroundColor: '#F9FAFB',
  },
  filterButtonSelected: {
    borderColor: '#FE5858',
    backgroundColor: '#FEE2E2',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  filterButtonTextSelected: {
    color: '#FE5858',
  },
  contentCard: {
    padding: 24,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    fontSize: 16,
    color: '#DC2626',
    marginBottom: 16,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FE5858',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  emptyCard: {
    padding: 32,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#282B34',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  emptyButton: {
    backgroundColor: '#FE5858',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
  },
  tabsContainer: {
    minHeight: 500,
  },
})
















