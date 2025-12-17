import { Tabs, useRouter, useLocalSearchParams } from 'expo-router'
import { Platform, View, ActivityIndicator, Text } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

type EngineView = 'dashboard' | 'trainingday' | 'analytics'

interface SubscriptionStatus {
  hasAccess: boolean
  subscriptionTier?: string
}

export default function EngineTabLayout() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { view, day } = useLocalSearchParams<{ view?: string; day?: string }>()

  // Complex state management (10+ state variables from web)
  const [loading, setLoading] = useState(true)
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>({ hasAccess: false })
  const [user, setUser] = useState<any>(null)
  const [currentView, setCurrentView] = useState<EngineView>('dashboard')
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [initialized, setInitialized] = useState(false)
  const [programVersion, setProgramVersion] = useState<string | null>(null)
  const [selectedMonth, setSelectedMonth] = useState(1)
  const [workouts, setWorkouts] = useState<any[]>([])
  const [completedSessions, setCompletedSessions] = useState<any[]>([])
  const [monthData, setMonthData] = useState<any>(null)

  // URL-based routing system (view/day parameters)
  useEffect(() => {
    if (view === 'analytics') {
      setCurrentView('analytics')
    } else if (view === 'trainingday' && day) {
      setCurrentView('trainingday')
      setSelectedDay(parseInt(day))
    } else {
      setCurrentView('dashboard')
    }
  }, [view, day])

  // User session management and initialization flow
  useEffect(() => {
    initializeEngineApp()
  }, [])

  const initializeEngineApp = async () => {
    try {
      setLoading(true)

      // 1. Check authentication
      const supabase = createClient()
      const { data: { user: authUser } } = await supabase.auth.getUser()

      if (!authUser) {
        router.replace('/auth/signin')
        return
      }
      setUser(authUser)

      // 2. Check subscription status (database-based)
      const { data: userData } = await supabase
        .from('users')
        .select('subscription_tier')
        .eq('auth_id', authUser.id)
        .single()

      const subscriptionTier = (userData as any)?.subscription_tier
      const hasEngineAccess = ['ENGINE', 'PREMIUM'].includes(subscriptionTier || '')

      setSubscriptionStatus({
        hasAccess: hasEngineAccess,
        subscriptionTier: subscriptionTier
      })

      // 3. Redirect based on subscription
      if (!hasEngineAccess) {
        // All non-Engine users go to main tabs
        router.replace('/(tabs)')
        return
      }

      // 4. Load program data and preferences
      await loadProgramVersion()
      await loadUserProgress()

      setInitialized(true)

    } catch (error) {
      console.error('Error initializing Engine app:', error)
      router.replace('/auth/signin')
    } finally {
      setLoading(false)
    }
  }

  const loadProgramVersion = async () => {
    // Load program version logic (3-day vs 5-day)
    // This would query the database for user's program version
    setProgramVersion('5-day') // Default for now
  }

  const loadUserProgress = async () => {
    // Load user's current progress in the program
    // This would query completed workouts, current month/day, etc.
    // For now, set defaults
    setSelectedMonth(1)
    setWorkouts([])
    setCompletedSessions([])
  }

  if (loading || !initialized) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5F5' }}>
        <ActivityIndicator size="large" color="#FE5858" />
        <Text style={{ marginTop: 12, color: '#666' }}>
          {loading ? 'Loading Engine...' : 'Initializing...'}
        </Text>
      </View>
    )
  }

  if (!subscriptionStatus.hasAccess) {
    return null // Will redirect during initialization
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: '#282B34',
          borderBottomWidth: 1,
          borderBottomColor: '#1F2937',
          height: Platform.OS === 'ios' ? 44 + insets.top : 56 + insets.top,
        },
        headerTitleStyle: {
          color: '#FFFFFF',
          fontSize: 18,
          fontWeight: '600',
        },
        headerTintColor: '#FFFFFF',
        tabBarActiveTintColor: '#FE5858',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: {
          backgroundColor: '#282B34',
          borderTopWidth: 1,
          borderTopColor: '#1F2937',
          height: Platform.OS === 'ios' ? 49 + insets.bottom : 64,
          paddingBottom: Platform.OS === 'ios' ? insets.bottom : 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="training"
        options={{
          title: 'Training',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="barbell-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: 'Analytics',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="stats-chart-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="nutrition"
        options={{
          title: 'Nutrition',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="nutrition-outline" size={size} color={color} />
          ),
        }}
      />
      {/* Hide components folder if it exists - should not be a route */}
      <Tabs.Screen
        name="components"
        options={{
          href: null, // Hide from tab bar
        }}
      />
    </Tabs>
  )
}
