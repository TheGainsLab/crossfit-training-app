import { Tabs, useRouter, useSegments } from 'expo-router'
import { Platform, View, ActivityIndicator, Text } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function BTNTabLayout() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const segments = useSegments()
  const [loading, setLoading] = useState(true)
  const [hasAccess, setHasAccess] = useState(false)

  useEffect(() => {
    checkAccess()
  }, [])

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
        // Not BTN user, redirect based on tier
        if (userData?.subscription_tier === 'ENGINE') {
              router.replace('/engine/training')
        } else {
          router.replace('/(tabs)')
        }
      }
    } catch (error) {
      console.error('Error checking BTN access:', error)
      router.replace('/auth/signin')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5F5' }}>
        <ActivityIndicator size="large" color="#FE5858" />
        <Text style={{ marginTop: 12, color: '#666' }}>Loading...</Text>
      </View>
    )
  }

  if (!hasAccess) {
    return null // Will redirect
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
        name="generate"
        options={{
          title: 'Generator',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="flash-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="workouts"
        options={{
          title: 'Workouts',
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
    </Tabs>
  )
}
